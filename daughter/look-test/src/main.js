// Daughter, step 1: look test.
// three.js r187 (pinned), WebGPURenderer with automatic WebGL 2 fallback, TSL post-processing.
//
// URL options:  ?webgl      force the WebGL 2 backend
//               ?tier=ultra|high|medium|low   start on a tier (skips the auto check)

import * as THREE from 'three/webgpu';
import {
	pass, mrt, output, normalView, diffuseColor, velocity, roughness, vec2, vec3, vec4, float, uniform,
	packNormalToRGB, unpackRGBToNormal, sample, renderOutput, convertToTexture, screenUV, screenSize, Fn, mix,
	smoothstep, length, max, min, abs, dot, time, rand, luminance, fract
} from 'three/tsl';
import { ssgi } from 'three/addons/tsl/display/SSGINode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { ssr } from 'three/addons/tsl/display/SSRNode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js';
import { buildCorridor, LAYER_VOL, transmission } from './corridor.js';
import { AudioRig } from './audio.js';

const $ = id => document.getElementById( id );
const params = new URLSearchParams( location.search );

// ---------------------------------------------------------------- tiers (handoff section 6.2)

const TIERS = {
	ultra: {
		label: 'Ultra', scale: 1.0, minScale: 0.8, maxDpr: 2, variant: 'full',
		flashShadow: 2048, glowShadow: 1024, volume: { steps: 16, res: 1.0 }, cone: false, haze: false,
		ao: 'ssgi', ssr: { quality: 0.6, res: 1.0 }, aa: 'traa', bloom: { strength: 0.85, radius: 0.55, threshold: 0.55, res: 1.0 },
		ca: true, grain: true, fog: 0.03, baked: false, pixelated: false
	},
	high: {
		label: 'High', scale: 1.0, minScale: 0.8, maxDpr: 2, variant: 'full',
		flashShadow: 1024, glowShadow: 512, volume: { steps: 10, res: 0.5 }, cone: false, haze: false,
		ao: 'gtao', ssr: { quality: 0.35, res: 0.5 }, aa: 'traa', bloom: { strength: 0.85, radius: 0.55, threshold: 0.55, res: 0.5 },
		ca: true, grain: true, fog: 0.03, baked: false, pixelated: false
	},
	medium: {
		label: 'Medium', scale: 0.85, minScale: 0.75, maxDpr: 1.25, variant: 'med',
		flashShadow: 512, glowShadow: 256, volume: null, cone: true, haze: true,
		ao: null, ssr: null, aa: 'fxaa', bloom: { strength: 0.8, radius: 0.5, threshold: 0.55, res: 0.5 },
		ca: false, grain: false, fog: 0.07, baked: false, pixelated: false
	},
	low: {
		label: 'Low', scale: 0.6, minScale: 0.5, maxDpr: 1, variant: 'low',
		flashShadow: 0, glowShadow: 0, volume: null, cone: false, haze: true,
		ao: null, ssr: null, aa: null, bloom: null,
		ca: false, grain: false, fog: 0.085, baked: true, pixelated: true
	}
};
const ORDER = [ 'low', 'medium', 'high', 'ultra' ];

// ---------------------------------------------------------------- renderer

const fatal = msg => { const f = $( 'fatal' ); f.innerHTML = msg; f.style.display = 'flex'; $( 'overlay' ).style.display = 'none'; };

let renderer;
try {

	renderer = new THREE.WebGPURenderer( { antialias: false, forceWebGL: params.has( 'webgl' ), powerPreference: 'high-performance' } );
	await renderer.init();

} catch ( e ) {

	console.error( e );
	fatal( '<div><h2>This device cannot run the game</h2><p>Daughter needs a browser with WebGPU or WebGL 2 (Chrome, Edge, Firefox or Safari from 2021 or later) and a laptop or desktop computer.</p></div>' );
	throw e;

}

const isWebGPU = !! renderer.backend.isWebGPUBackend;
const backendName = isWebGPU ? 'WebGPU' : 'WebGL 2';
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setSize( innerWidth, innerHeight );
document.body.prepend( renderer.domElement );
const canvas = renderer.domElement;

// ---------------------------------------------------------------- scene

const scene = new THREE.Scene();
scene.background = new THREE.Color( 0x000000 );
scene.fog = new THREE.FogExp2( 0x07090a, 0.03 );

const camera = new THREE.PerspectiveCamera( 75, innerWidth / innerHeight, 0.05, 60 );
camera.layers.enable( 0 );
let hFov = 100;
function updateFov() {

	camera.aspect = innerWidth / innerHeight;
	camera.fov = THREE.MathUtils.radToDeg( 2 * Math.atan( Math.tan( THREE.MathUtils.degToRad( hFov ) / 2 ) / camera.aspect ) );
	camera.updateProjectionMatrix();

}

updateFov();

$( 'status' ).textContent = 'Generating textures…';
await new Promise( r => setTimeout( r, 30 ) );
const C = buildCorridor( scene );

// flickering bulb: drive the emissive with a uniform
const bulbLevel = uniform( 1 );
C.mats.bulbWarm.full.colorNode = vec3( 1.0, 0.70, 0.42 ).mul( 30 ).mul( bulbLevel );

const flash = C.lights.flash;
scene.add( flash, flash.target );
scene.add( C.cone );

// ---------------------------------------------------------------- post-processing pipeline

const pipeline = new THREE.RenderPipeline( renderer );
pipeline.outputColorTransform = false;

const U = {
	lensK: uniform( 0.12 ), ca: uniform( 0.012 ), grain: uniform( 0.05 ), vignette: uniform( 1.0 ),
	volIntensity: uniform( 0.03 ), denoise: uniform( 0.6 )
};
const volLayer = new THREE.Layers(); volLayer.disableAll(); volLayer.enable( LAYER_VOL );
let disposables = [];

function buildPipeline( T ) {

	for ( const d of disposables ) d?.dispose?.();
	disposables = [];

	const scenePass = pass( scene, camera );
	disposables.push( scenePass );
	const outs = { output };
	// roughness rides in the normal target's alpha: Ultra's targets must fit WebGPU's default 32 bytes per sample
	if ( T.ao || T.ssr ) outs.normal = vec4( packNormalToRGB( normalView ), roughness );
	if ( T.ao === 'ssgi' ) outs.diffuseColor = diffuseColor;
	if ( T.aa === 'traa' ) outs.velocity = velocity;
	if ( Object.keys( outs ).length > 1 ) scenePass.setMRT( mrt( outs ) );
	for ( const k of [ 'normal', 'diffuseColor' ] ) if ( outs[ k ] ) scenePass.getTexture( k ).type = THREE.UnsignedByteType;

	const color = scenePass.getTextureNode( 'output' );
	const depth = scenePass.getTextureNode( 'depth' );
	const normal = outs.normal ? sample( uv => unpackRGBToNormal( scenePass.getTextureNode( 'normal' ).sample( uv ) ) ) : null;

	let hdr = color;

	if ( T.ao === 'ssgi' ) {

		const gi = ssgi( color, depth, normal, camera );
		gi.sliceCount.value = 2; gi.stepCount.value = 8; gi.radius.value = 4;
		disposables.push( gi );
		const diffuse = scenePass.getTextureNode( 'diffuseColor' );
		hdr = vec4( color.rgb.mul( gi.getAONode() ).add( diffuse.rgb.mul( gi.getGINode().rgb ) ), color.a );

	} else if ( T.ao === 'gtao' ) {

		const aoPass = ao( depth, normal, camera );
		aoPass.resolutionScale = 0.5;
		disposables.push( aoPass );
		const aoVal = aoPass.getTextureNode().sample( screenUV ).r;
		hdr = vec4( color.rgb.mul( mix( float( 1 ), aoVal, 0.85 ) ), color.a );

	}

	if ( T.ssr ) {

		// every reflective surface here is a dielectric (wet concrete, paint), so metalness is taken as 0
		const rough = scenePass.getTextureNode( 'normal' ).a;
		const s = ssr( color, depth, normal, { metalnessNode: float( 0 ), roughnessNode: rough, reflectNonMetals: true, camera } );
		s.quality.value = T.ssr.quality; s.maxDistance.value = 6; s.thickness.value = 0.03;
		if ( s.resolutionScale !== undefined ) s.resolutionScale = T.ssr.res;
		disposables.push( s );
		hdr = vec4( hdr.rgb.add( s.rgb ), 1 );

	}

	if ( T.volume ) {

		const vp = pass( scene, camera, { depthBuffer: false } );
		vp.setLayers( volLayer );
		vp.setResolutionScale( T.volume.res );
		disposables.push( vp );
		C.volMat.steps = T.volume.steps;
		C.volMat.depthNode = depth.sample( screenUV );
		C.volMat.needsUpdate = true;
		hdr = vec4( hdr.rgb.add( gaussianBlur( vp, U.denoise ).rgb.mul( U.volIntensity ) ), 1 );

	}

	if ( T.aa === 'traa' ) {

		const vel = scenePass.getTextureNode( 'velocity' );
		const t = traa( hdr, depth, vel, camera );
		disposables.push( t );
		hdr = t;

	}

	if ( T.bloom ) {

		const b = bloom( hdr, T.bloom.strength, T.bloom.radius, T.bloom.threshold );
		b.setResolutionScale( T.bloom.res );
		disposables.push( b );
		hdr = vec4( hdr.rgb.add( b.rgb ), 1 );

	}

	// tone mapping (ACES filmic, low exposure) and sRGB
	let out = renderOutput( hdr );
	if ( T.aa === 'fxaa' ) out = fxaa( out );

	// lens: barrel distortion (wide bodycam-style lens) + chromatic aberration toward the edges
	const lensTex = convertToTexture( out );
	disposables.push( lensTex );
	const useCA = T.ca;
	const lens = Fn( () => {

		const p = screenUV.sub( 0.5 ).mul( 2 ).toVar();
		const asp = screenSize.x.div( screenSize.y );
		const q = p.mul( vec2( asp, 1 ) ).div( length( vec2( asp, 1 ) ) );
		const r2 = dot( q, q );
		const f = float( 1 ).add( U.lensK.mul( r2 ) ).div( U.lensK.add( 1 ) );
		const at = k => p.mul( f.mul( k ) ).mul( 0.5 ).add( 0.5 );
		if ( ! useCA ) return lensTex.sample( at( float( 1 ) ) );
		const c = U.ca.mul( r2 );
		return vec4( lensTex.sample( at( c.add( 1 ) ) ).r, lensTex.sample( at( float( 1 ) ) ).g, lensTex.sample( at( float( 1 ).sub( c ) ) ).b, 1 );

	} )();

	// grade, rounded vignette, grain (display space)
	const useGrain = T.grain;
	const finish = Fn( () => {

		const col = lens.rgb.toVar();
		const l = luminance( col );
		// keep saturation in the lights and the blue glow, pull it out of the dirty mid-tones
		col.assign( mix( vec3( l ), col, mix( float( 0.7 ), float( 1.0 ), smoothstep( 0.2, 0.7, l ) ) ) );
		// cool, slightly green shadows; warm highlights
		col.mulAssign( mix( vec3( 0.97, 1.0, 0.99 ), vec3( 1.05, 1.0, 0.93 ), smoothstep( 0.05, 0.55, l ) ) );
		// lifted blacks (shadows keep detail, like the reference)
		col.addAssign( vec3( 0.009, 0.010, 0.009 ).mul( float( 1 ).sub( l ) ) );

		// rounded-rectangle vignette: corners go to black like a lens housing
		const asp = screenSize.x.div( screenSize.y );
		const p = screenUV.sub( 0.5 ).mul( 2 ).mul( vec2( asp, 1 ) );
		const half = vec2( asp.mul( 0.9 ), 0.88 ), rr = float( 0.55 );
		const qd = abs( p ).sub( half ).add( rr );
		const sd = length( max( qd, vec2( 0 ) ) ).add( min( max( qd.x, qd.y ), 0 ) ).sub( rr );
		const edge = float( 1 ).sub( smoothstep( - 0.5, 0.06, sd ) );
		const radial = float( 1 ).sub( dot( p, p ).mul( 0.06 ) );
		col.mulAssign( mix( float( 1 ), edge.mul( radial ), U.vignette ) );

		if ( useGrain ) {

			const n = rand( screenUV.add( vec2( fract( time.mul( 0.731 ) ), fract( time.mul( 0.419 ) ) ) ) ).sub( 0.5 );
			col.addAssign( n.mul( U.grain ).mul( float( 1 ).sub( l.mul( 0.6 ) ) ) );

		}

		return vec4( col, 1 );

	} )();

	pipeline.outputNode = finish;
	pipeline.needsUpdate = true;

}

// ---------------------------------------------------------------- apply a tier

let tierKey = null, renderScale = 1, auto = true, busy = false;

function applyShadow( light, size ) {

	light.castShadow = size > 0;
	if ( size > 0 && light.shadow.mapSize.x !== size ) {

		light.shadow.mapSize.set( size, size );
		if ( light.shadow.map ) { light.shadow.map.dispose(); light.shadow.map = null; }

	}

}

async function setTier( key, { scale = null } = {} ) {

	if ( busy ) return; busy = true;
	const T = TIERS[ key ];
	if ( T.baked && ! C.baked ) {

		$( 'status' ).textContent = 'Baking light for the Low tier…';
		await C.bake( f => { $( 'tierInfo' ).textContent = `baking ${ Math.round( f * 100 ) }%`; } );

	}

	tierKey = key;
	renderScale = scale ?? T.scale;
	C.applyVariant( T.variant );
	applyShadow( flash, T.flashShadow );
	// the cookie is projected through the shadow matrix, so it needs a shadowed light
	flash.map = T.flashShadow > 0 ? C.cookie : null;
	applyShadow( C.lights.blueMain, T.glowShadow );
	for ( const k of [ 'sconceA', 'sconceB', 'blueMain', 'blueDoor', 'blueLeak', 'hemi' ] ) C.lights[ k ].visible = ! T.baked;
	C.volume.visible = !! T.volume;
	C.cone.visible = T.cone && flashOn;
	for ( const h of C.hazes ) h.visible = T.haze;
	scene.fog.density = T.fog;
	canvas.style.imageRendering = T.pixelated ? 'pixelated' : 'auto';
	applySize();
	buildPipeline( T );
	document.querySelectorAll( '#tierBar button' ).forEach( b => b.classList.toggle( 'active', auto ? b.dataset.tier === 'auto' || b.dataset.tier === key : b.dataset.tier === key ) );
	busy = false;

}

function applySize() {

	const T = TIERS[ tierKey ];
	renderer.setPixelRatio( Math.min( devicePixelRatio, T.maxDpr ) * renderScale );
	renderer.setSize( innerWidth, innerHeight );
	updateFov();

}

addEventListener( 'resize', () => tierKey && applySize() );

// ---------------------------------------------------------------- player, flashlight rig, sway

const player = { pos: new THREE.Vector3( 0, 1.65, 0.6 ), yaw: 0, pitch: 0, speed: 1.55 };
const keys = {};
let flashOn = true, reducedMotion = false, locked = false, stepPhase = 0;
const handQ = new THREE.Quaternion(), handPos = new THREE.Vector3();

function walkable( x, z ) {

	const r = 0.3;
	return C.walkable.some( w => x > w.x0 + r && x < w.x1 - r && z > w.z0 + r && z < w.z1 - r );

}

addEventListener( 'keydown', e => {

	keys[ e.code ] = true;
	if ( e.code === 'KeyF' ) { flashOn = ! flashOn; flash.visible = flashOn; C.cone.visible = flashOn && TIERS[ tierKey ].cone; audio.switchClick(); $( 'flashState' ).textContent = flashOn ? 'ON' : 'OFF'; }
	if ( e.code === 'Digit1' ) pick( 'ultra' );
	if ( e.code === 'Digit2' ) pick( 'high' );
	if ( e.code === 'Digit3' ) pick( 'medium' );
	if ( e.code === 'Digit4' ) pick( 'low' );
	if ( e.code === 'Digit0' ) pick( 'auto' );
	if ( e.code === 'BracketLeft' ) { hFov = Math.max( 70, hFov - 5 ); updateFov(); }
	if ( e.code === 'BracketRight' ) { hFov = Math.min( 118, hFov + 5 ); updateFov(); }
	if ( e.code === 'KeyL' ) U.lensK.value = U.lensK.value > 0 ? 0 : 0.12;
	if ( e.code === 'KeyM' ) { reducedMotion = ! reducedMotion; U.grain.value = reducedMotion ? 0 : 0.05; U.ca.value = reducedMotion ? 0 : 0.012; }
	if ( e.code === 'KeyH' ) for ( const id of [ 'hudBR', 'tierBar', 'hudTL' ] ) $( id ).style.visibility = $( id ).style.visibility === 'hidden' ? '' : 'hidden';

} );
addEventListener( 'keyup', e => { keys[ e.code ] = false; } );
addEventListener( 'blur', () => { for ( const k in keys ) keys[ k ] = false; } );

document.addEventListener( 'mousemove', e => {

	if ( ! locked ) return;
	player.yaw -= e.movementX * 0.0022;
	player.pitch = THREE.MathUtils.clamp( player.pitch - e.movementY * 0.0022, - 1.35, 1.35 );

} );
document.addEventListener( 'pointerlockchange', () => {

	locked = document.pointerLockElement === canvas;
	if ( ! locked && started ) { $( 'overlay' ).style.display = 'flex'; $( 'enter' ).textContent = 'Click to resume'; }

} );

function pick( k ) {

	if ( k === 'auto' ) { auto = true; setTier( isWebGPU ? 'high' : 'medium' ).then( () => runBenchmark( false ) ); return; }
	auto = false;
	setTier( k );

}

document.querySelectorAll( '#tierBar button' ).forEach( b => b.addEventListener( 'click', e => { e.stopPropagation(); pick( b.dataset.tier ); } ) );

// ---------------------------------------------------------------- dose model (game values, plausible, not measurements)

function doseRateAt( p ) {

	let rate = C.background;
	for ( const s of C.sources ) {

		const d2 = Math.max( p.distanceToSquared( s.pos ), 0.25 );
		rate += s.strength * transmission( p, s.pos, C.occluders ) / d2;

	}

	return rate; // µSv/h

}

// ---------------------------------------------------------------- audio

const audio = new AudioRig();
let ledTimer = 0;
audio.onClick = () => { if ( reducedMotion ) return; const l = $( 'led' ); l.classList.add( 'on' ); clearTimeout( ledTimer ); ledTimer = setTimeout( () => l.classList.remove( 'on' ), 35 ); };
let buzzA = null;

// ---------------------------------------------------------------- start / benchmark (handoff 6.3)

let started = false;
const frameTimes = [];
let benchmarking = false;

$( 'enter' ).addEventListener( 'click', async () => {

	if ( ! started ) { started = true; audio.start(); buzzA = audio.addBuzzer( C.lights.sconceA.position, 0.035 ); }
	else audio.start();
	$( 'overlay' ).style.display = 'none';
	try { await canvas.requestPointerLock(); } catch ( e ) { /* blocked in some iframes; mouse look then needs the button held */ }

} );

async function measure( frames ) {

	frameTimes.length = 0;
	benchmarking = true;
	const t0 = performance.now();
	// a hidden tab renders no frames: give up after 6 s and keep the current tier
	while ( frameTimes.length < frames ) { if ( performance.now() - t0 > 6000 ) { benchmarking = false; return null; } await new Promise( r => setTimeout( r, 50 ) ); }
	benchmarking = false;
	const s = [ ...frameTimes ].sort( ( a, b ) => a - b );
	return s[ Math.floor( s.length * 0.5 ) ] * 0.5 + s.reduce( ( a, b ) => a + b, 0 ) / s.length * 0.5;

}

async function runBenchmark( first ) {

	$( 'enter' ).disabled = first; if ( first ) $( 'enter' ).textContent = 'Checking graphics…';
	$( 'status' ).textContent = `Backend: ${ backendName }. Measuring ${ TIERS[ tierKey ].label }…`;
	await new Promise( r => setTimeout( r, 700 ) ); // let shaders compile
	let ms = await measure( 90 );
	if ( ms === null ) {

		$( 'status' ).textContent = `Backend: ${ backendName } · ${ TIERS[ tierKey ].label } (could not measure; press 0 to retry)`;
		$( 'enter' ).disabled = false; $( 'enter' ).textContent = started ? 'Click to resume' : 'Click to enter';
		return;

	}

	const idx = ORDER.indexOf( tierKey );
	const top = isWebGPU ? 3 : 1; // WebGL 2 auto-selects at most Medium (handoff table)
	if ( ms < 18.5 && idx < top ) {

		const prev = tierKey;
		await setTier( ORDER[ idx + 1 ] );
		$( 'status' ).textContent = `Trying ${ TIERS[ tierKey ].label }…`;
		await new Promise( r => setTimeout( r, 900 ) );
		const ms2 = await measure( 90 );
		if ( ms2 === null || ms2 > 19.5 ) await setTier( prev ); else ms = ms2;

	} else if ( ms > 34 && idx > 0 ) {

		await setTier( ORDER[ idx - 1 ] );

	}

	$( 'status' ).textContent = `Backend: ${ backendName } · picked ${ TIERS[ tierKey ].label } (${ ( 1000 / ms ).toFixed( 0 ) } fps measured)`;
	$( 'enter' ).disabled = false; $( 'enter' ).textContent = started ? 'Click to resume' : 'Click to enter';

}

// ---------------------------------------------------------------- loop

const clock = new THREE.Timer();
const debug = { frames: 0 };
let fpsAcc = 0, fpsN = 0, fpsShow = 0, lowSince = 0, hudT = 0, smoothedRate = C.background, dipT = 6 + Math.random() * 8, dip = 1, deadB = 0;
const fwd = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3( 0, 1, 0 ), tmpQ = new THREE.Quaternion(), e = new THREE.Euler( 0, 0, 0, 'YXZ' );

function noise1( t ) { return Math.sin( t * 1.7 ) * 0.5 + Math.sin( t * 2.9 + 1.3 ) * 0.3 + Math.sin( t * 5.3 + 4.1 ) * 0.2; }

function frame() {

	clock.update();
	const dt = Math.min( clock.getDelta(), 0.1 ), t = clock.getElapsed();
	if ( benchmarking ) frameTimes.push( dt * 1000 );

	// --- movement
	let mx = 0, mz = 0;
	if ( locked || started ) {

		if ( keys.KeyW || keys.ArrowUp ) mz -= 1; if ( keys.KeyS || keys.ArrowDown ) mz += 1;
		if ( keys.KeyA || keys.ArrowLeft ) mx -= 1; if ( keys.KeyD || keys.ArrowRight ) mx += 1;

	}

	const moving = mx !== 0 || mz !== 0;
	if ( moving ) {

		const l = Math.hypot( mx, mz ); mx /= l; mz /= l;
		const s = Math.sin( player.yaw ), c = Math.cos( player.yaw );
		const dx = ( mx * c + mz * s ) * player.speed * dt, dz = ( - mx * s + mz * c ) * player.speed * dt;
		const p = player.pos;
		if ( walkable( p.x + dx, p.z + dz ) ) { p.x += dx; p.z += dz; } else if ( walkable( p.x + dx, p.z ) ) p.x += dx; else if ( walkable( p.x, p.z + dz ) ) p.z += dz;
		const before = Math.floor( stepPhase / Math.PI );
		stepPhase += dt * 7.2;
		if ( Math.floor( stepPhase / Math.PI ) !== before ) audio.footstep( 0.8 + Math.random() * 0.4 );

	}

	// --- camera with handheld bob and sway
	const sway = reducedMotion ? 0 : 1;
	const bob = moving ? 1 : 0;
	camera.position.copy( player.pos );
	camera.position.y += sway * ( Math.abs( Math.sin( stepPhase ) ) * 0.04 * bob - 0.02 * bob + Math.sin( t * 1.1 ) * 0.004 );
	e.set(
		player.pitch + sway * ( noise1( t * 0.35 ) * 0.006 + Math.sin( stepPhase * 2 ) * 0.006 * bob ),
		player.yaw + sway * ( noise1( t * 0.27 + 9 ) * 0.008 + Math.sin( stepPhase ) * 0.008 * bob ),
		sway * ( noise1( t * 0.21 + 3 ) * 0.01 + Math.sin( stepPhase ) * 0.012 * bob )
	);
	camera.quaternion.setFromEuler( e );
	camera.updateMatrixWorld();

	// --- flashlight follows the view with a little lag, held at the right hand
	handQ.slerp( camera.quaternion, 1 - Math.exp( - dt * 14 ) );
	right.set( 1, 0, 0 ).applyQuaternion( camera.quaternion ); up.set( 0, 1, 0 ).applyQuaternion( camera.quaternion ); fwd.set( 0, 0, - 1 ).applyQuaternion( camera.quaternion );
	handPos.copy( camera.position ).addScaledVector( right, 0.2 ).addScaledVector( up, - 0.2 ).addScaledVector( fwd, 0.1 );
	flash.position.copy( handPos );
	// aim converges on what the player looks at, about 6 m ahead
	fwd.set( 0, 0, - 1 ).applyQuaternion( handQ );
	flash.target.position.copy( camera.position ).addScaledVector( fwd, 6 );
	flash.target.updateMatrixWorld();
	C.cone.position.copy( handPos ); C.cone.quaternion.copy( handQ );

	// --- lamps: slow flicker and occasional brown-outs (smooth, never strobing)
	dipT -= dt;
	if ( dipT < 0 ) { dip = 0; dipT = 9 + Math.random() * 14; }
	dip = Math.min( 1, dip + dt * 1.6 );
	const dipK = 0.3 + 0.7 * smoothstepJS( 0, 1, dip );
	const fA = ( 0.9 + 0.1 * noise1( t * 1.3 ) ) * dipK;
	if ( ! TIERS[ tierKey ].baked ) {

		C.lights.sconceA.intensity = C.lights.sconceA.userData.base * fA;
		deadB = ( noise1( t * 0.13 + 2 ) > 0.55 ) ? Math.max( 0, deadB - dt * 2 ) : Math.min( 1, deadB + dt * 1.5 );
		C.lights.sconceB.intensity = C.lights.sconceB.userData.base * ( 0.15 + 0.85 * deadB ) * ( 0.9 + 0.1 * noise1( t * 2.1 ) );
		C.lights.blueMain.intensity = C.lights.blueMain.userData.base * ( 0.94 + 0.06 * Math.sin( t * 0.9 ) );

	}

	bulbLevel.value = fA;
	audio.setBuzz( buzzA, fA );

	// --- dose and Geiger
	const rate = doseRateAt( camera.position );
	smoothedRate += ( rate - smoothedRate ) * ( 1 - Math.exp( - dt * 3 ) );
	audio.rate = Math.min( 300, rate * 3.0 ); // clicks per second (game scale)
	audio.updateListener( camera, handPos );

	// --- render
	pipeline.render();
	debug.frames ++;

	// --- perf, adaptive quality (auto mode only), HUD
	fpsAcc += dt; fpsN ++;
	if ( fpsAcc > 0.5 ) { fpsShow = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
	if ( auto && started && ! benchmarking && ! busy ) {

		if ( fpsShow > 0 && fpsShow < 30 ) { lowSince += dt; } else lowSince = 0;
		if ( lowSince > 4 ) {

			lowSince = 0;
			const T = TIERS[ tierKey ];
			if ( renderScale - 0.1 >= T.minScale - 1e-6 ) { renderScale -= 0.1; applySize(); }
			else if ( ORDER.indexOf( tierKey ) > 0 ) setTier( ORDER[ ORDER.indexOf( tierKey ) - 1 ] );

		}

	}

	hudT -= dt;
	if ( hudT < 0 ) {

		hudT = 0.1;
		$( 'rate' ).textContent = smoothedRate < 10 ? smoothedRate.toFixed( 2 ) : smoothedRate.toFixed( 0 );
		const f = THREE.MathUtils.clamp( ( Math.log10( Math.max( smoothedRate, 0.1 ) ) + 1 ) / 4, 0, 1 );
		$( 'meterFill' ).style.width = ( f * 100 ).toFixed( 1 ) + '%';
		const T = TIERS[ tierKey ];
		$( 'tierInfo' ).textContent = `${ T.label }${ auto ? ' (auto)' : '' } · ${ backendName }`;
		$( 'perfInfo' ).textContent = `${ fpsShow.toFixed( 0 ) } fps · scale ${ renderScale.toFixed( 2 ) } · ${ canvas.width }×${ canvas.height } · FOV ${ hFov }°${ U.lensK.value ? '' : ' · lens off' }${ reducedMotion ? ' · reduced motion' : '' }`;

	}

}

function smoothstepJS( a, b, x ) { const k = Math.min( 1, Math.max( 0, ( x - a ) / ( b - a ) ) ); return k * k * ( 3 - 2 * k ); }

// ---------------------------------------------------------------- go

const startKey = TIERS[ params.get( 'tier' ) ] ? params.get( 'tier' ) : ( isWebGPU ? 'high' : 'medium' );
if ( params.get( 'tier' ) ) auto = false;
await setTier( startKey );
renderer.setAnimationLoop( frame );
if ( auto ) runBenchmark( true );
else { $( 'enter' ).disabled = false; $( 'enter' ).textContent = 'Click to enter'; $( 'status' ).textContent = `Backend: ${ backendName } · ${ TIERS[ tierKey ].label } (chosen in the URL)`; }

// expose for debugging in the console
Object.assign( debug, { doseRateAt, step: ( n = 1 ) => { for ( let i = 0; i < n; i ++ ) frame(); }, renderer, scene, camera, C, TIERS, setTier, U, player } );
window.__look = debug;
