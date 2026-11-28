// Daughter, build step 2: graybox. Six stations, terminals, dose, checkpoints and the completion code.
// three.js r187 (pinned), WebGPURenderer with automatic WebGL 2 fallback, TSL post-processing.
//
// URL options:  ?webgl                      force the WebGL 2 backend
//               ?tier=ultra|high|medium|low  start on a tier (skips the auto check)
//               ?station=1..6                testing (dev server only): start at that station with the earlier ones solved
//               ?fresh                       ignore the saved game

import * as THREE from 'three/webgpu';
import { buildLevel, GLOW_BLUE } from './level.js';
import { loadRoomArt, loadAO } from './art.js';
import { createGlimpses } from './glimpses.js';
import { initRenderer, createPipeline, TIERS, ORDER } from './engine.js';
import { transmission } from './dose.js';
import { AudioRig } from './audio.js';
import { CONFIG } from './config.js';
import { RADIO } from './radio.js';
import { createRadio } from './voice.js';
import { DEBRIEF, HALF_LIFE } from './questions.js';
import { createStations, makePicks, freshState, objective, RECORDS } from './stations.js';
import { certCode, dayKey, normalizeUser } from './code.js';
import { $, openPanel, closePanel, panelOpen, toast, caption, clearCaptions } from './ui.js';

const params = new URLSearchParams( location.search );
const STATION_NAMES = [ '', '16.1 Natural Radioactivity', '16.2 Nuclear Reactions', '16.3 Radiation Measurement', '16.4 Half-Life of a Radioisotope', '16.5 Medical Applications', '16.6 Nuclear Fission and Fusion' ];
const ROOM_STATION = { vestibule: 1, hall: 1, vault: 2, vaultA: 2, vaultB: 2, vaultC: 2, c2: 2, monitor: 3, c3: 3, ante: 4, hot: 4, infirmary: 5, c5: 5, control: 6 };
const HOT_K = 700; // mSv/h at 1 m when the corridor source is at the safe activity (game value): about 2.6 mSv to cross when safe, 40 mSv at 16 times
const fill = s => s.replace( /\{HP\}/g, CONFIG.names.physicist ).replace( /\{FACILITY\}/g, CONFIG.names.facility ).replace( /\{NUCLIDE\}/g, CONFIG.names.nuclide );

// ---------------------------------------------------------------- storage (may be blocked inside the D2L iframe: memory fallback)

const SAVE_KEY = 'daughter.v1';
const store = {
	get() { try { return JSON.parse( localStorage.getItem( SAVE_KEY ) || 'null' ); } catch ( e ) { return null; } },
	set( v ) { try { localStorage.setItem( SAVE_KEY, JSON.stringify( v ) ); } catch ( e ) { /* in-memory only */ } },
	clear() { try { localStorage.removeItem( SAVE_KEY ); } catch ( e ) { /* ignore */ } }
};

let saved = params.has( 'fresh' ) ? null : store.get();
const options = Object.assign( { lights: false, captions: true, motion: false }, saved?.options || {} );

// ---------------------------------------------------------------- renderer

const fatal = msg => { const f = $( 'fatal' ); f.innerHTML = msg; f.style.display = 'flex'; $( 'title' ).hidden = true; };

let renderer;
try {

	renderer = await initRenderer( params.has( 'webgl' ) );

} catch ( e ) {

	console.error( e );
	fatal( '<div><h2>This device cannot run the game</h2><p>Daughter needs a browser with WebGPU or WebGL 2 (Chrome, Edge, Firefox or Safari from 2021 or later) on a laptop or desktop computer.</p></div>' );
	throw e;

}

const isWebGPU = !! renderer.backend.isWebGPUBackend;
const backendName = isWebGPU ? 'WebGPU' : 'WebGL 2';
renderer.setSize( innerWidth, innerHeight );
document.body.prepend( renderer.domElement );
const canvas = renderer.domElement;

// ---------------------------------------------------------------- scene

const scene = new THREE.Scene();
scene.background = new THREE.Color( 0x000000 );
scene.fog = new THREE.FogExp2( 0x07090a, 0.03 );
const camera = new THREE.PerspectiveCamera( 75, innerWidth / innerHeight, 0.05, 80 );
const hFov = 100;
function updateFov() {

	camera.aspect = innerWidth / innerHeight;
	camera.fov = THREE.MathUtils.radToDeg( 2 * Math.atan( Math.tan( THREE.MathUtils.degToRad( hFov ) / 2 ) / camera.aspect ) );
	camera.updateProjectionMatrix();

}

updateFov();

$( 'status' ).textContent = 'Building the facility…';
await new Promise( r => setTimeout( r, 30 ) );
const L = buildLevel( scene );
// art pass: rooms modelled in Blender replace the graybox where they exist (the graybox stays if a file fails to load)
// the published copy (daughter/play/) loads the models from the game's own folder, so they are stored in the repo once
const MODELS = import.meta.env.DEV ? './models/' : '../game/public/models/';
// ao: the room's baked ambient occlusion for Medium and Low (downloaded only when one of them is used)
const ART = [
	{ name: 'entry hall', url: MODELS + 'hall.glb', room: 'HALL', region: { x0: - 2.3, x1: 2.3, z0: - 28.05, z1: 0.3 } },
	{ name: 'records vault', url: MODELS + 'vault.glb', room: 'VAULT', region: { x0: - 7.5, x1: 7.5, z0: - 38.15, z1: - 27.75 } },
	{ name: 'monitoring station', url: MODELS + 'monitor.glb', room: 'MON', region: { x0: - 4.4, x1: 4.4, z0: - 52.15, z1: - 38.15 } },
	{ name: 'hot corridor', url: MODELS + 'hot.glb', room: 'HOT', region: { x0: - 3.3, x1: 3.7, z0: - 76.15, z1: - 52.15 } },
	{ name: 'infirmary', url: MODELS + 'infirmary.glb', room: 'INF', region: { x0: - 5.3, x1: 5.3, z0: - 86.15, z1: - 76.15 } },
	{ name: 'control room', url: MODELS + 'control.glb', room: 'CTL', region: { x0: - 6.3, x1: 6.3, z0: - 108.3, z1: - 86.15 } }
];
for ( const a of ART ) a.ao = MODELS + 'ao/' + a.url.slice( MODELS.length ).replace( '.glb', '.webp' );
$( 'status' ).textContent = 'Loading the rooms…';
await Promise.all( ART.map( a => loadRoomArt( L, scene, a.url, a ).catch( e => console.warn( `The ${ a.name } art did not load; using the graybox.`, e ) ) ) );

const flash = L.lights.flash;
const FLASH_BASE = flash.intensity;
// The most light the beam may put on a surface (intensity / m², before the cookie). Inverse-square would blow
// near walls out to white, so the beam dims until nothing it touches is brighter than a surface about 6 m away.
const FLASH_CAP = 5;
const FLASH_EDGE = Math.tan( 0.25 ); // the edge rays: 0.25 rad off the beam's axis, where the spot is ~65% as bright
const flashRay = new THREE.Raycaster(); flashRay.far = 7;
const flashEdge = [ 9, 9, 9, 9 ], flashDir = new THREE.Vector3();
let flashTick = 0, flashK = 1, flashGoal = 1, flashList = null;
// what the beam can hit: every visible static mesh (rebuilt when visibility may have changed)
function flashTargets() {

	if ( ! flashList || flashTick % 90 === 1 ) flashList = L.statics.filter( m => m.isMesh && m.visible && m.parent && m.parent.visible );
	return flashList;

}
scene.add( flash, flash.target, L.cone );

const { pipeline, U, build } = createPipeline( renderer, scene, camera, L );

// ---------------------------------------------------------------- tiers

let tierKey = null, renderScale = 1, auto = true, busy = false;

function applyShadow( light, size ) {

	light.castShadow = size > 0;
	if ( size > 0 && light.shadow.mapSize.x !== size ) {

		light.shadow.mapSize.set( size, size );
		if ( light.shadow.map ) { light.shadow.map.dispose(); light.shadow.map = null; }

	}

}

async function setTier( key ) {

	if ( busy ) return; busy = true;
	const T = TIERS[ key ];
	tierKey = key;
	renderScale = T.scale;
	L.variant = T.variant;
	if ( T.variant !== 'full' ) await loadAO( L );
	L.applyVariant( T.variant );
	applyShadow( flash, T.flashShadow );
	flash.map = T.flashShadow > 0 ? L.cookie : null;
	applyShadow( L.lights.blueHot, T.glowShadow );
	applyShadow( L.lights.blueCore, T.glowShadow );
	// without shadows the blue lights would shine through walls, so their reach is cut back to their own rooms
	L.lights.blueHot.distance = T.glowShadow ? 12 : 5;
	L.lights.blueCore.distance = T.glowShadow ? 12 : 3.4;
	L.volume.visible = !! T.volume;
	L.cone.visible = T.cone && flashOn;
	for ( const h of L.hazes ) h.visible = T.haze;
	applyLook();
	canvas.style.imageRendering = T.pixelated ? 'pixelated' : 'auto';
	applySize();
	build( T );
	refreshTierButtons();
	busy = false;

}

function applySize() {

	const T = TIERS[ tierKey ];
	renderer.setPixelRatio( Math.min( devicePixelRatio, T.maxDpr ) * renderScale );
	renderer.setSize( innerWidth, innerHeight );
	updateFov();

}

addEventListener( 'resize', () => tierKey && applySize() );

function refreshTierButtons() {

	for ( const id of [ 'tierBarTitle', 'tierBarPause' ] ) {

		const bar = $( id );
		if ( ! bar.childElementCount ) {

			for ( const k of [ 'auto', 'ultra', 'high', 'medium', 'low' ] ) {

				const b = document.createElement( 'button' );
				b.type = 'button'; b.dataset.tier = k; b.textContent = k === 'auto' ? 'Auto' : TIERS[ k ].label;
				b.addEventListener( 'click', () => pickTier( k ) );
				bar.append( b );

			}

		}

		bar.querySelectorAll( 'button' ).forEach( b => b.classList.toggle( 'active', b.dataset.tier === ( auto ? 'auto' : tierKey ) || ( auto && b.dataset.tier === tierKey ) ) );

	}

}

function pickTier( k ) {

	if ( k === 'auto' ) { auto = true; setTier( isWebGPU ? 'high' : 'medium' ).then( () => runBenchmark( false ) ); return; }
	auto = false;
	setTier( k );

}

// lights-on mode and reduced motion
function applyLook() {

	const on = options.lights;
	const T = TIERS[ tierKey ] || TIERS.high;
	L.lights.hemi.intensity = on ? 2.2 : 0.22;
	L.lights.hemi.color.set( on ? 0x8a8a84 : 0x33363a );
	for ( const l of L.warmLights ) l.intensity = l.userData.base * ( on ? 3 : 1 );
	scene.fog.density = T.fog * ( on ? 0.45 : 1 );
	renderer.toneMappingExposure = on ? 1.5 : 1.15;
	U.grain.value = options.motion ? 0 : 0.05;
	U.ca.value = options.motion ? 0 : 0.012;

}

// ---------------------------------------------------------------- game state

const audio = new AudioRig();
let ledTimer = 0;
audio.onClick = () => { if ( options.motion ) return; const l = $( 'led' ); l.classList.add( 'on' ); clearTimeout( ledTimer ); ledTimer = setTimeout( () => l.classList.remove( 'on' ), 35 ); };

const G = {
	state: freshState(),
	picks: null,
	seed: 0,
	dose: 0, // mSv
	cp: 1, cpDose: 0,
	dosimeter: false,
	finishedAt: null,
	d2l: '',
	ended: false
};

function rngFrom( seed ) {

	let a = seed >>> 0;
	return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul( a ^ a >>> 15, 1 | a ); t = t + Math.imul( t ^ t >>> 7, 61 | t ) ^ t; return ( ( t ^ t >>> 14 ) >>> 0 ) / 4294967296; };

}

function newRun() {

	G.seed = ( Math.random() * 2 ** 31 ) | 0;
	G.picks = makePicks( rngFrom( G.seed ) );
	G.state = freshState();
	G.dose = 0; G.cp = 1; G.cpDose = 0; G.dosimeter = false; G.finishedAt = null; G.ended = false;

}

function persist() {

	store.set( { v: 1, seed: G.seed, state: G.state, dose: G.dose, cp: G.cp, cpDose: G.cpDose, finishedAt: G.finishedAt, d2l: G.d2l, options, ended: G.ended } );

}

function loadRun( s ) {

	G.seed = s.seed; G.picks = makePicks( rngFrom( G.seed ) );
	G.state = Object.assign( freshState(), s.state );
	G.dose = s.dose || 0; G.cp = s.cp || 1; G.cpDose = s.cpDose || 0; G.finishedAt = s.finishedAt || null; G.d2l = s.d2l || ''; G.ended = !! s.ended;

}

const points = () => G.state.completed.filter( Boolean ).length * CONFIG.pointsPerStation;

// ---------------------------------------------------------------- context for the stations

Object.assign( G, {
	rng: Math.random,
	changed() { persist(); updateObjective(); },
	wrong() {

		audio.chime( false );
		if ( ! G.dosimeter ) return '';
		addDose( CONFIG.wrongAnswerDose );
		return ` <span class="dosecost">(+${ CONFIG.wrongAnswerDose } mSv)</span>`;

	},
	sfx( k ) { if ( k === 'good' ) audio.chime( true ); if ( k === 'pickup' ) audio.switchClick(); },
	toast,
	openDoor( id ) { const d = L.doors[ id ]; if ( d && ! d.open ) { d.setOpen( true ); audio.rumble( 1.2, 0.2 ); } },
	setScreen( id, done ) { const it = L.interact.find( i => i.id === id ); if ( it?.screen ) L.setScreen( it, done ); },
	complete( n ) {

		if ( G.state.completed[ n - 1 ] ) return;
		G.state.completed[ n - 1 ] = true;
		toast( `Station ${ n } complete: ${ STATION_NAMES[ n ] }. <span class="lbl">(${ points() } of ${ CONFIG.stationCount * CONFIG.pointsPerStation } points)</span>`, 4200 );
		persist();

	},
	enableNote( id, text ) { const it = L.interact.find( i => i.id === id ); if ( it ) { it.enabled = true; it.text = text; } },
	takeEquipment() { for ( const m of L.props.equipMeshes ) m.visible = false; L.props.equipment.enabled = false; },
	dosimeterOn() { G.dosimeter = true; G.cpDose = G.dose; },
	setHot( r ) {

		L.hotSrc.strength = HOT_K * r;
		const k = 0.3 + 0.7 * Math.min( 1, r / 16 );
		L.lights.blueHot.intensity = L.lights.blueHot.userData.base * k;
		for ( const h of L.hazeHot ) h.userData.strength.value = h.userData.base * k;

	},
	clockAdvanced( done ) {

		// the one piece of time fiction: the scene fades, the clock spins, time resumes
		fadeTo( 0, 0.6 ).then( () => { done(); audio.rumble( 1.6, 0.12 ); setTimeout( () => fadeTo( 1, 0.9 ), 700 ); } );

	},
	rodsDown() {

		L.coreSrc.strength = L.coreSrc.base * 0.1;
		for ( const m of L.props.rodLamps ) m.visible = false;
		audio.rumble( 2.2, 0.3 );
		L.lights.blueCore.intensity = L.lights.blueCore.userData.base * 0.6;

	},
	ending: () => startEnding()
} );

const H = createStations( G );

// sync the world (doors, screens, sources) to the saved state
function syncWorld() {

	const S = G.state;
	for ( const d of Object.values( L.doors ) ) { d.setOpen( false ); d.t = 0; }
	for ( const it of L.interact ) if ( it.screen ) L.setScreen( it, false );
	const open = id => { L.doors[ id ].setOpen( true ); L.doors[ id ].t = 1; };
	if ( S.s1.symbols ) G.setScreen( 'symbols', true );
	S.s1.barriers.forEach( ( b, i ) => { if ( b ) { open( 'barrier' + i ); G.setScreen( 'locker' + i, true ); } } );
	for ( const k of [ 'vaultA', 'vaultB', 'vaultC', 'vaultExit' ] ) if ( S.s2[ k ] ) { open( k ); G.setScreen( k + 'Lock', true ); }
	for ( const k of [ 'vaultA', 'vaultB', 'vaultC' ] ) { const it = L.interact.find( i => i.id === k + 'Read' ); it.enabled = S.s2[ k ]; it.text = RECORDS[ k ]; }
	for ( const m of L.props.equipMeshes ) m.visible = ! S.s3.equip;
	L.props.equipment.enabled = ! S.s3.equip;
	G.dosimeter = S.s3.conv;
	if ( S.s3.conv ) { open( 'monExit' ); G.setScreen( 'calib', true ); }
	G.setHot( S.s4.set ? G.hotActivityRatio() : 2 ** G.picks.s4.n );
	if ( S.s4.set ) open( 'interlock' );
	if ( S.s4.set && G.hotActivityRatio() <= 1 + 1e-6 ) G.setScreen( 'clock', true );
	S.s5.charts.forEach( ( c, i ) => c && G.setScreen( 'chart' + i, true ) );
	if ( S.s5.why ) { open( 'infExit' ); G.setScreen( 'cabinet', true ); }
	if ( S.s6.sort ) G.setScreen( 'sort', true );
	if ( S.s6.fission ) G.setScreen( 'fission', true );
	L.coreSrc.strength = L.coreSrc.base; L.lights.blueCore.intensity = L.lights.blueCore.userData.base;
	for ( const m of L.props.rodLamps ) m.visible = true;
	if ( S.s6.rods ) { G.setScreen( 'rods', true ); L.coreSrc.strength = L.coreSrc.base * 0.1; for ( const m of L.props.rodLamps ) m.visible = false; L.lights.blueCore.intensity = L.lights.blueCore.userData.base * 0.6; }
	if ( S.s6.finale >= 3 ) G.setScreen( 'finale', true );
}


// ---------------------------------------------------------------- player

const player = { pos: new THREE.Vector3(), yaw: 0, pitch: 0, speed: 1.55 };
const keys = {};
let flashOn = true, locked = false, playing = false, stepPhase = 0, inputBlocked = false;
const handQ = new THREE.Quaternion(), handPos = new THREE.Vector3();

function walkable( x, z ) {

	const r = 0.3;
	if ( ! L.walkable.some( w => x > w.x0 + r && x < w.x1 - r && z > w.z0 + r && z < w.z1 - r ) ) return false;
	for ( const b of L.blockers ) if ( ! b.disabled && x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r ) return false;
	return true;

}

function roomAt( x, z ) {

	for ( const w of L.walkable ) if ( w.name && x > w.x0 && x < w.x1 && z > w.z0 && z < w.z1 ) return w.name;
	return null;

}

function spawnAt( n ) {

	const s = L.spawns[ n ];
	player.pos.copy( s.pos ); player.yaw = s.yaw; player.pitch = 0;
	handQ.setFromEuler( new THREE.Euler( 0, s.yaw, 0, 'YXZ' ) );

}

const typing = e => e.target && ( e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA' );

addEventListener( 'keydown', e => {

	if ( panelOpen() ) { if ( e.code === 'Escape' ) { e.preventDefault(); closePanel(); } return; }
	if ( typing( e ) ) return;
	keys[ e.code ] = true;
	if ( ! playing ) return;
	if ( e.code === 'KeyF' ) toggleFlash();
	if ( e.code === 'KeyE' ) useTarget();
	if ( e.code === 'Escape' && ! locked ) showPause();

} );
addEventListener( 'keyup', e => { keys[ e.code ] = false; } );
addEventListener( 'blur', () => { for ( const k in keys ) keys[ k ] = false; } );

function toggleFlash() {

	flashOn = ! flashOn; flash.visible = flashOn; L.cone.visible = flashOn && TIERS[ tierKey ].cone;
	audio.switchClick(); $( 'flashState' ).textContent = flashOn ? 'ON' : 'OFF';

}

// mouse look: pointer lock, or drag with the button held when the iframe blocks pointer lock
let dragging = false;
document.addEventListener( 'mousemove', e => {

	if ( ! playing || inputBlocked || panelOpen() ) return;
	if ( ! locked && ! dragging ) return;
	player.yaw -= e.movementX * 0.0022;
	player.pitch = THREE.MathUtils.clamp( player.pitch - e.movementY * 0.0022, - 1.35, 1.35 );

} );
canvas.addEventListener( 'mousedown', () => { if ( ! playing || panelOpen() ) return; dragging = true; lock(); } );
addEventListener( 'mouseup', () => { dragging = false; } );

let wantPause = true;
function lock() { try { const p = canvas.requestPointerLock(); p?.catch?.( () => {} ); } catch ( e ) { /* blocked: drag to look */ } }
function unlockQuiet() { wantPause = false; if ( document.pointerLockElement ) document.exitPointerLock(); setTimeout( () => { wantPause = true; }, 300 ); }
document.addEventListener( 'pointerlockchange', () => {

	locked = document.pointerLockElement === canvas;
	if ( ! locked && playing && wantPause && ! panelOpen() && ! inputBlocked ) showPause();

} );

// ---------------------------------------------------------------- interaction

const camDir = new THREE.Vector3(), toIt = new THREE.Vector3();
let target = null;

function findTarget() {

	camera.getWorldDirection( camDir );
	let best = null, bestScore = Infinity;
	for ( const it of L.interact ) {

		if ( it.enabled === false ) continue;
		toIt.subVectors( it.pos, camera.position );
		const d = toIt.length();
		if ( d > 2.3 ) continue;
		toIt.divideScalar( d );
		const ang = Math.acos( THREE.MathUtils.clamp( toIt.dot( camDir ), - 1, 1 ) );
		if ( ang > 0.5 ) continue;
		// terminals are used from the screen side
		if ( it.normal && toIt.dot( it.normal ) > 0.2 ) continue;
		const score = ang + d * 0.1;
		if ( score < bestScore ) { bestScore = score; best = it; }

	}

	return best;

}

function useTarget() {

	if ( ! target ) return;
	if ( target.kind === 'note' ) { openPanel( 'Record', b => { b.innerHTML = `<p>${ target.text || '' }</p>`; }, {} ); unlockQuiet(); return; }
	const h = H[ target.id ];
	if ( ! h ) return;
	if ( target.kind === 'pickup' ) { h(); return; }
	// glimpse 3: the shape standing in front of the decay console steps aside before the final equations open
	const wait = target.id === 'finale' && G.state.s6.rods ? glimpses?.stepAside( camera.position ) : 0;
	if ( wait ) {

		inputBlocked = true;
		for ( const k in keys ) keys[ k ] = false;
		setTimeout( () => { if ( G.ended || evacuating ) return; inputBlocked = false; unlockQuiet(); h(); }, wait );
		return;

	}

	unlockQuiet();
	h();

}

$( 'panelClose' ).addEventListener( 'click', () => closePanel() );
// every panel close goes back to the game
new MutationObserver( () => { if ( $( 'panel' ).hidden && playing ) { lock(); updateObjective(); } } ).observe( $( 'panel' ), { attributes: true, attributeFilter: [ 'hidden' ] } );

// ---------------------------------------------------------------- dose

function doseRateAt( p ) {

	let rate = L.background;
	for ( const s of L.sources ) {

		if ( s.strength <= 0 ) continue;
		const d2 = Math.max( p.distanceToSquared( s.pos ), 0.25 );
		rate += s.strength * transmission( p, s.pos, L.occluders ) / d2;

	}

	return rate; // mSv/h (game value)

}

function addDose( mSv ) {

	if ( ! G.dosimeter || G.ended ) return;
	G.dose += mSv;
	if ( G.dose >= CONFIG.doseLimit ) evacuate();

}

let evacuating = false;
async function evacuate() {

	if ( evacuating ) return;
	evacuating = true; inputBlocked = true;
	closePanel();
	for ( const k in keys ) keys[ k ] = false;
	// slow white-out (about 1.5 s): never a flash
	await tween( v => { U.whiteout.value = v; }, 0, 1, 1500 );
	$( 'evac' ).style.display = 'flex';
	audio.setMasterLevel( 0.2, 0.4 );
	await sleep( 2600 );
	G.dose = Math.min( G.cpDose, CONFIG.doseLimit * CONFIG.checkpointDoseCap );
	spawnAt( G.cp );
	persist();
	$( 'evac' ).style.display = 'none';
	audio.setMasterLevel( 0.9, 0.6 );
	await tween( v => { U.whiteout.value = v; }, 1, 0, 1400 );
	toast( `You were evacuated and sent back to the start of station ${ G.cp }. The dosimeter reads ${ G.dose.toFixed( 1 ) } mSv.`, 5200 );
	inputBlocked = false; evacuating = false;

}

const sleep = ms => new Promise( r => setTimeout( r, ms ) );
function tween( fn, a, b, ms ) {

	return new Promise( res => {

		const t0 = performance.now();
		const step = () => { const k = Math.min( 1, ( performance.now() - t0 ) / ms ); fn( a + ( b - a ) * k * k * ( 3 - 2 * k ) ); if ( k < 1 ) requestAnimationFrame( step ); else res(); };
		step();

	} );

}

function fadeTo( v, s ) { const a = U.fade.value; return tween( x => { U.fade.value = x; }, a, v, s * 1000 ); }

// ---------------------------------------------------------------- checkpoints and radio

// Kessler's recordings: a voiced clip from public/audio/radio/ when there is one (src/voice.js), a caption either way
const radioVoice = createRadio( {
	audio, caption, base: import.meta.env.DEV ? './audio/radio/' : '../game/public/audio/radio/',
	speaker: () => `${ CONFIG.names.physicistShort.toUpperCase() } (recording):`, captionsOn: () => options.captions
} );
function radio( key ) { radioVoice.say( key, ( RADIO[ key ] || [] ).map( fill ) ); }

function checkRoom() {

	const room = roomAt( player.pos.x, player.pos.z );
	const n = ROOM_STATION[ room ];
	if ( ! n || n <= G.cp ) return;
	// a new station: checkpoint
	if ( n >= 5 && G.state.s4.set ) G.complete( 4 );
	G.cp = n; G.cpDose = G.dose;
	persist();
	radio( 's' + n );
	toast( `Checkpoint. Station ${ n }: ${ STATION_NAMES[ n ] }.` );
	updateObjective();

}

function updateObjective() {

	$( 'station' ).textContent = `Station ${ G.cp } of 6 · ${ STATION_NAMES[ G.cp ] }`;
	$( 'objective' ).textContent = objective( G.state, G.picks, G.cp );

}

// ---------------------------------------------------------------- title, pause, start

const inIframe = ( () => { try { return window.self !== window.top; } catch ( e ) { return true; } } )();
const selfUrl = location.href.split( '#' )[ 0 ];
$( 'btnNewTab' ).href = selfUrl; $( 'newTabLink' ).href = selfUrl;
$( 'btnNewTab' ).hidden = ! inIframe;
$( 'iframeWarn' ).hidden = ! inIframe;
$( 'mobileWarn' ).hidden = ! ( matchMedia( '(pointer: coarse)' ).matches && ! matchMedia( '(pointer: fine)' ).matches );

function bindToggle( ids, key, after ) {

	for ( const id of ids ) {

		const box = $( id );
		box.checked = options[ key ];
		box.addEventListener( 'change', () => { options[ key ] = box.checked; for ( const o of ids ) $( o ).checked = options[ key ]; applyLook(); after?.(); persist(); } );

	}

}

bindToggle( [ 'optLights', 'pLights' ], 'lights' );
bindToggle( [ 'optCaptions', 'pCaptions' ], 'captions', () => { if ( ! options.captions ) clearCaptions(); } );
bindToggle( [ 'optMotion', 'pMotion' ], 'motion' );

if ( saved && saved.seed && ! saved.ended ) { $( 'btnContinue' ).hidden = false; $( 'btnContinue' ).textContent = `Continue (station ${ saved.cp || 1 })`; }

function enterGame() {

	audio.start();
	radioVoice.preload( RADIO );
	$( 'title' ).hidden = true; $( 'pause' ).hidden = true;
	for ( const id of [ 'hudTL', 'hudTR', 'hudBL', 'cross' ] ) $( id ).hidden = false;
	playing = true;
	updateObjective();
	lock();

}

$( 'btnStart' ).addEventListener( 'click', () => {

	newRun(); syncWorld(); spawnAt( 1 ); persist();
	enterGame();
	setTimeout( () => radio( 'start' ), 1500 );

} );
$( 'btnContinue' ).addEventListener( 'click', () => {

	loadRun( saved ); syncWorld(); spawnAt( G.cp );
	enterGame();

} );

function showPause() {

	if ( ! playing ) return;
	$( 'pauseInfo' ).textContent = `Station ${ G.cp } of 6 · ${ points() } of 6 points so far · dose ${ G.dosimeter ? G.dose.toFixed( 1 ) + ' mSv' : 'not recorded yet' }`;
	$( 'pause' ).hidden = false;
	for ( const k in keys ) keys[ k ] = false;

}

$( 'btnResume' ).addEventListener( 'click', () => { $( 'pause' ).hidden = true; lock(); } );
$( 'btnCheckpoint' ).addEventListener( 'click', () => {

	$( 'pause' ).hidden = true;
	// the dose stays as it is: restarting is not a way to lower it
	spawnAt( G.cp );
	lock();

} );

// ---------------------------------------------------------------- ending, debrief, code

async function startEnding() {

	G.ended = true; G.finishedAt = Date.now(); persist();
	inputBlocked = true;
	for ( const k in keys ) keys[ k ] = false;
	L.coreSrc.strength = 0;
	radio( 'end' );
	// the view turns to the rocking chair beside the core door: it rocks once more and stops, empty
	const seat = glimpses?.ending();
	if ( seat ) {

		const dx = seat.x - camera.position.x, dz = seat.z - camera.position.z, dy = seat.y + 0.2 - camera.position.y;
		const y0 = player.yaw, p0 = player.pitch, yaw = Math.atan2( - dx, - dz );
		const y1 = y0 + Math.atan2( Math.sin( yaw - y0 ), Math.cos( yaw - y0 ) ), p1 = Math.atan2( dy, Math.hypot( dx, dz ) );
		tween( k => { player.yaw = y0 + ( y1 - y0 ) * k; player.pitch = p0 + ( p1 - p0 ) * k; }, 0, 1, 2400 );

	}

	// the counter falls silent, the blue light goes out
	const b0 = L.lights.blueCore.intensity, h0 = L.lights.blueHot.intensity;
	await tween( v => {

		L.lights.blueCore.intensity = b0 * v; L.lights.blueCoreLeak.intensity = 3 * v; L.lights.blueHot.intensity = h0 * v;
		for ( const h of [ ...L.hazeCore, ...L.hazeHot ] ) h.userData.strength.value = h.userData.base * v;
		L.mats.glowStrip.level.value = 2.6 * v;

	}, 1, 0, 4000 );
	await Promise.all( [ sleep( 2500 ), radioVoice.whenDone( 16000 ) ] ); // let her last line finish before the fade
	await fadeTo( 0, 2.0 );
	playing = false;
	unlockQuiet();
	for ( const id of [ 'hudTL', 'hudTR', 'hudBL', 'cross', 'prompt' ] ) $( id ).hidden = true;
	$( 'prompt' ).style.display = 'none';
	showDebrief();

}

function showDebrief() {

	$( 'dbReal' ).innerHTML = DEBRIEF.real.map( t => `<li>${ fill( t ) }</li>` ).join( '' );
	$( 'dbFiction' ).innerHTML = DEBRIEF.fiction.map( t => `<li>${ fill( t ) }</li>` ).join( '' );
	$( 'dbDose' ).textContent = `${ G.dose.toFixed( 1 ) } mSv of the ${ CONFIG.doseLimit } mSv limit`;
	$( 'debrief' ).hidden = false;

}

$( 'btnToCode' ).addEventListener( 'click', () => { $( 'debrief' ).hidden = true; showCodeScreen(); } );

function showCodeScreen() {

	$( 'codeScore' ).textContent = `You completed ${ G.state.completed.filter( Boolean ).length } of 6 stations: ${ points() } of ${ CONFIG.stationCount * CONFIG.pointsPerStation } points.`;
	$( 'd2lInput' ).value = G.d2l || '';
	$( 'codeWarn' ).hidden = CONFIG.codeRegistered;
	$( 'codeScreen' ).hidden = false;
	if ( G.d2l ) showCode();

}

function showCode() {

	const user = normalizeUser( G.d2l );
	$( 'codeOut' ).hidden = ! user;
	if ( ! user ) return;
	const when = G.finishedAt ? new Date( G.finishedAt ) : new Date();
	$( 'codeVal' ).textContent = certCode( CONFIG.codePrefix, CONFIG.codeSecret, user, points(), dayKey( when ) );
	$( 'codeUser' ).textContent = user;

}

function saveD2l() {

	const raw = $( 'd2lInput' ).value.trim();
	if ( normalizeUser( raw ).length < 2 ) { $( 'd2lErr' ).textContent = 'Type your D2L username first.'; return; }
	$( 'd2lErr' ).textContent = '';
	G.d2l = raw; persist(); showCode();

}

$( 'd2lGo' ).addEventListener( 'click', saveD2l );
$( 'd2lInput' ).addEventListener( 'keydown', e => { if ( e.key === 'Enter' ) saveD2l(); } );
$( 'btnToTitle' ).addEventListener( 'click', () => location.reload() );

// ---------------------------------------------------------------- benchmark (handoff 6.3)

const frameTimes = [];
let benchmarking = false;

async function measure( frames ) {

	frameTimes.length = 0;
	benchmarking = true;
	const t0 = performance.now();
	while ( frameTimes.length < frames ) { if ( performance.now() - t0 > 6000 ) { benchmarking = false; return null; } await sleep( 50 ); }
	benchmarking = false;
	const s = [ ...frameTimes ].sort( ( a, b ) => a - b );
	return s[ Math.floor( s.length * 0.5 ) ] * 0.5 + s.reduce( ( a, b ) => a + b, 0 ) / s.length * 0.5;

}

async function runBenchmark( first ) {

	const btn = $( 'btnStart' );
	if ( first ) { btn.disabled = true; btn.textContent = 'Checking graphics…'; }
	$( 'status' ).textContent = `Backend: ${ backendName }. Measuring ${ TIERS[ tierKey ].label }…`;
	await sleep( 700 );
	let ms = await measure( 90 );
	if ( ms !== null ) {

		const idx = ORDER.indexOf( tierKey );
		const top = isWebGPU ? 3 : 1;
		if ( ms < 18.5 && idx < top ) {

			const prev = tierKey;
			await setTier( ORDER[ idx + 1 ] );
			await sleep( 900 );
			const ms2 = await measure( 90 );
			if ( ms2 === null || ms2 > 19.5 ) await setTier( prev ); else ms = ms2;

		} else if ( ms > 34 && idx > 0 ) {

			await setTier( ORDER[ idx - 1 ] );
			await sleep( 900 );
			const ms2 = await measure( 90 ); // so the title screen shows the speed of the tier it settled on, not the one it left
			if ( ms2 !== null ) ms = ms2;

		}

	}

	$( 'status' ).textContent = ms === null ? `Backend: ${ backendName } · ${ TIERS[ tierKey ].label } (could not measure)` : `Backend: ${ backendName } · ${ TIERS[ tierKey ].label } (${ ( 1000 / ms ).toFixed( 0 ) } fps measured)`;
	btn.disabled = false; btn.textContent = 'Start';

}

// ---------------------------------------------------------------- loop

const clock = new THREE.Timer();
let fpsAcc = 0, fpsN = 0, fpsShow = 0, lowSince = 0, hudT = 0, smoothedRate = 0.02, roomT = 0;
const fwd = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(), e = new THREE.Euler( 0, 0, 0, 'YXZ' );
const noise1 = t => Math.sin( t * 1.7 ) * 0.5 + Math.sin( t * 2.9 + 1.3 ) * 0.3 + Math.sin( t * 5.3 + 4.1 ) * 0.2;
const debug = { frames: 0 };

// title backdrop: a slow look down the entry hall
spawnAt( 1 );

function frame() {

	clock.update();
	const dt = Math.min( clock.getDelta(), 0.1 ), t = clock.getElapsed();
	if ( benchmarking ) frameTimes.push( dt * 1000 );
	const active = playing && ! inputBlocked && ! panelOpen() && $( 'pause' ).hidden;

	// --- movement
	let mx = 0, mz = 0;
	if ( active ) {

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

	if ( ! playing ) player.yaw = Math.sin( t * 0.08 ) * 0.25;

	// --- camera with handheld bob and sway
	const sway = options.motion ? 0 : 1, bob = moving ? 1 : 0;
	camera.position.copy( player.pos );
	camera.position.y += sway * ( Math.abs( Math.sin( stepPhase ) ) * 0.04 * bob - 0.02 * bob + Math.sin( t * 1.1 ) * 0.004 );
	e.set(
		player.pitch + sway * ( noise1( t * 0.35 ) * 0.006 + Math.sin( stepPhase * 2 ) * 0.006 * bob ),
		player.yaw + sway * ( noise1( t * 0.27 + 9 ) * 0.008 + Math.sin( stepPhase ) * 0.008 * bob ),
		sway * ( noise1( t * 0.21 + 3 ) * 0.01 + Math.sin( stepPhase ) * 0.012 * bob )
	);
	camera.quaternion.setFromEuler( e );
	camera.updateMatrixWorld();

	// --- flashlight
	handQ.slerp( camera.quaternion, 1 - Math.exp( - dt * 14 ) );
	right.set( 1, 0, 0 ).applyQuaternion( camera.quaternion ); up.set( 0, 1, 0 ).applyQuaternion( camera.quaternion ); fwd.set( 0, 0, - 1 ).applyQuaternion( camera.quaternion );
	handPos.copy( camera.position ).addScaledVector( right, 0.2 ).addScaledVector( up, - 0.2 ).addScaledVector( fwd, 0.1 );
	flash.position.copy( handPos );
	fwd.set( 0, 0, - 1 ).applyQuaternion( handQ );
	flash.target.position.copy( camera.position ).addScaledVector( fwd, 6 );
	flash.target.updateMatrixWorld();
	// close-range softening (see FLASH_CAP): one ray down the beam, and one near its edge that takes the four sides
	// in turn, so a wall beside the beam (looking down a corridor) dims it too
	if ( flashOn && ( flashTick ++ % 3 ) === 0 ) {

		const targets = flashTargets();
		flashRay.set( handPos, fwd );
		const hit = flashRay.intersectObjects( targets, false )[ 0 ];
		const side = ( flashTick / 3 | 0 ) % 4, a = side * Math.PI / 2;
		flashDir.copy( fwd ).addScaledVector( right, Math.cos( a ) * FLASH_EDGE ).addScaledVector( up, Math.sin( a ) * FLASH_EDGE ).normalize();
		flashRay.set( handPos, flashDir );
		const edge = flashRay.intersectObjects( targets, false )[ 0 ];
		flashEdge[ side ] = edge ? edge.distance : 9;
		const d = Math.min( hit ? hit.distance : 9, Math.min( ...flashEdge ) / 0.8 ); // the edge gets ~0.8² as much light
		flashGoal = THREE.MathUtils.clamp( FLASH_CAP * d * d / FLASH_BASE, 0.01, 1 );

	}

	// dim quickly (never a glare), brighten more slowly (no pumping as the beam sweeps past near edges)
	flashK += ( flashGoal - flashK ) * ( 1 - Math.exp( - dt * ( flashGoal < flashK ? 10 : 4 ) ) );
	flash.intensity = FLASH_BASE * flashK;
	L.cone.position.copy( handPos ); L.cone.quaternion.copy( handQ );
	glimpses?.update( dt, { flashOn, handPos, beamDir: fwd, camera } );
	L.volume.position.set( Math.round( camera.position.x ), 1.75, Math.round( camera.position.z ) );

	// --- doors slide up
	for ( const d of Object.values( L.doors ) ) {

		const goal = d.open ? 1 : 0;
		if ( d.t !== goal ) { d.t += Math.sign( goal - d.t ) * Math.min( Math.abs( goal - d.t ), dt / 1.1 ); }
		d.mesh.position.y = d.h / 2 + d.t * ( d.h - 0.15 );

	}

	// --- lamps: slow, smooth flicker (never strobing)
	if ( ! options.lights ) for ( const [ i, l ] of L.warmLights.entries() ) l.intensity = l.userData.base * ( 0.9 + 0.1 * noise1( t * 1.3 + i * 7 ) );

	// --- dose and Geiger
	const rate = doseRateAt( camera.position );
	smoothedRate += ( rate - smoothedRate ) * ( 1 - Math.exp( - dt * 3 ) );
	audio.rate = Math.min( 300, rate * 6 ); // clicks per second (game scale)
	audio.updateListener( camera, handPos );
	if ( active && G.dosimeter ) addDose( rate * dt * CONFIG.exposureTimeScale / 3600 );

	// --- interaction target
	target = active ? findTarget() : null;
	const pr = $( 'prompt' );
	if ( target ) { pr.innerHTML = `<kbd>E</kbd>${ target.kind === 'terminal' ? 'Use · ' : '' }${ target.label }`; pr.style.display = 'block'; } else pr.style.display = 'none';

	roomT -= dt;
	if ( active && roomT < 0 ) { roomT = 0.25; checkRoom(); }

	pipeline.render();
	debug.frames ++;

	// --- perf, adaptive quality, HUD
	fpsAcc += dt; fpsN ++;
	if ( fpsAcc > 0.5 ) { fpsShow = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
	if ( auto && playing && ! benchmarking && ! busy ) {

		if ( fpsShow > 0 && fpsShow < 30 ) lowSince += dt; else lowSince = 0;
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
		const cal = G.state.s3.units && G.state.s3.conv;
		$( 'rate' ).textContent = cal ? ( smoothedRate < 10 ? smoothedRate.toFixed( 2 ) : smoothedRate.toFixed( 0 ) ) : 'UNCAL';
		$( 'rateUnit' ).textContent = cal ? 'mSv/h (game value)' : '';
		const f = THREE.MathUtils.clamp( ( Math.log10( Math.max( smoothedRate, 0.01 ) ) + 2 ) / 4, 0, 1 );
		$( 'meterFill' ).style.width = ( f * 100 ).toFixed( 1 ) + '%';
		$( 'doseRow' ).classList.toggle( 'inactive', ! G.dosimeter );
		$( 'dose' ).textContent = G.dosimeter ? `${ G.dose.toFixed( 1 ) } / ${ CONFIG.doseLimit } mSv` : ( G.state.s3.equip ? 'not calibrated' : 'not issued' );
		$( 'doseFill' ).style.width = ( Math.min( 1, G.dose / CONFIG.doseLimit ) * 100 ).toFixed( 1 ) + '%';
		$( 'tierInfo' ).textContent = `${ TIERS[ tierKey ].label }${ auto ? ' (auto)' : '' } · ${ backendName }`;
		$( 'perfInfo' ).textContent = `${ fpsShow.toFixed( 0 ) } fps`;

	}

}

// ---------------------------------------------------------------- go

const startKey = TIERS[ params.get( 'tier' ) ] ? params.get( 'tier' ) : ( isWebGPU ? 'high' : 'medium' );
if ( params.get( 'tier' ) ) auto = false;
newRun(); syncWorld();
// step 5: the glimpses (the game runs without them if the chair fails to load)
let glimpses = null;
try { glimpses = await createGlimpses( { scene, L, G, audio, options, url: MODELS + 'chair.glb', save: persist } ); } catch ( e ) { console.warn( 'The chair did not load; no glimpses.', e ); }
await setTier( startKey );
renderer.setAnimationLoop( frame );

// testing shortcut: ?station=N starts at station N with the earlier stations solved
const jump = import.meta.env.DEV ? parseInt( params.get( 'station' ) || '', 10 ) : NaN; // dev server only: never in the published build
if ( jump >= 1 && jump <= 6 ) {

	newRun();
	solveThrough( jump - 1 );
	G.cp = jump; G.cpDose = G.dose;
	syncWorld();
	$( 'btnContinue' ).hidden = true;
	$( 'btnStart' ).onclick = null;
	$( 'btnStart' ).replaceWith( $( 'btnStart' ).cloneNode( true ) );
	$( 'btnStart' ).addEventListener( 'click', () => { spawnAt( jump ); enterGame(); } );

}

function solveThrough( n ) {

	const S = G.state;
	if ( n >= 1 ) { S.s1.symbols = true; S.s1.barriers = [ true, true, true ]; S.completed[ 0 ] = true; }
	if ( n >= 2 ) { Object.keys( S.s2 ).forEach( k => S.s2[ k ] = true ); S.completed[ 1 ] = true; }
	if ( n >= 3 ) { S.s3 = { equip: true, units: true, conv: true }; S.completed[ 2 ] = true; G.dosimeter = true; }
	if ( n >= 4 ) { S.s4 = { elapsed: G.picks.s4.n * HALF_LIFE[ G.picks.s4.iso ].t, set: true }; S.completed[ 3 ] = true; }
	if ( n >= 5 ) { S.s5 = { charts: [ true, true, true ], why: true }; S.completed[ 4 ] = true; }

}

if ( auto ) runBenchmark( true );
else { $( 'btnStart' ).disabled = false; $( 'btnStart' ).textContent = 'Start'; $( 'status' ).textContent = `Backend: ${ backendName } · ${ TIERS[ tierKey ].label } (chosen in the URL)`; }

refreshTierButtons();

// debugging and automated testing
Object.assign( debug, { G, L, H, glimpses, player, walkable, roomAt, checkRoom, doseRateAt, spawnAt, setTier, TIERS, renderer, camera, scene, U, points, step: ( n = 1 ) => { for ( let i = 0; i < n; i ++ ) frame(); }, use: id => { const it = L.interact.find( i => i.id === id ); target = it; useTarget(); } } );
if ( import.meta.env.DEV ) window.__game = debug;
