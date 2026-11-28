// Sublevel, build step 3: the work orders (phone, questions, the dark, safe rooms, completion code) with placeholder art.
// ?look shows the approved step 1 look test.
// three.js r187 (pinned, as Daughter), WebGPURenderer with automatic WebGL 2 fallback, TSL post-processing.
// The tier logic, speed test, tier buttons, options, pause, save and code screen are Daughter's (daughter/game/src/main.js), adapted.
//
// URL options:  ?webgl                      force the WebGL 2 backend
//               ?tier=ultra|high|medium|low  start on a tier (skips the auto check)
//               ?look                        the step 1 look test instead of the building
//               ?fresh                       ignore the saved run
// Keys:         WASD move · Shift faster · E use · Esc pause · 1 Low · 2 Medium · 3 High · 4 Ultra · 0 Auto

import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { initRenderer, createPipeline, TIERS, ORDER } from './engine.js';
import { buildWorld, LAYOUT } from './world.js';
import { buildBuilding, floorY } from './building.js';
import { buildProps } from './props.js';
import { createRooster } from './rooster.js';
import { createGlimpses } from './glimpses.js';
import { createEnding } from './ending.js';
import { CONFIG, ASSETS } from './config.js';
import { WORK_ORDERS, DEBRIEF } from './questions.js';
import { orbitalDiagram } from './chem.js';
import { $, el, openPanel, closePanel, panelOpen, feedback, toast, caption, clearCaptions, diagramHTML } from './ui.js';
import { createAudio } from './audio.js';
import { certCode, dayKey, normalizeUser } from './code.js';

const params = new URLSearchParams( location.search );
const sleep = ms => new Promise( r => setTimeout( r, ms ) );
const fill = s => s.replace( /\{COMPANY\}/g, CONFIG.names.company );
const LOOK = params.has( 'look' );

// ---------------------------------------------------------------- storage (may be blocked inside the D2L iframe: memory fallback)

const SAVE_KEY = 'sublevel.v1';
const store = {
	get() { try { return JSON.parse( localStorage.getItem( SAVE_KEY ) || 'null' ); } catch ( e ) { return null; } },
	set( v ) { try { localStorage.setItem( SAVE_KEY, JSON.stringify( v ) ); } catch ( e ) { /* in-memory only */ } }
};

const saved = params.has( 'fresh' ) ? null : store.get();
const options = Object.assign( { lights: false, captions: true, motion: false }, saved?.options || {} );

// ---------------------------------------------------------------- renderer

const fatal = msg => { const f = $( 'fatal' ); f.innerHTML = msg; f.style.display = 'flex'; $( 'title' ).hidden = true; };
let renderer;
try {

	renderer = await initRenderer( params.has( 'webgl' ) );

} catch ( e ) {

	console.error( e );
	fatal( '<div><h2>This device cannot run the game</h2><p>Sublevel needs a browser with WebGPU or WebGL 2 (Chrome, Edge, Firefox or Safari from 2021 or later) on a laptop or desktop computer.</p></div>' );
	throw e;

}

const isWebGPU = !! renderer.backend.isWebGPUBackend;
const backendName = isWebGPU ? 'WebGPU' : 'WebGL 2';
renderer.setSize( innerWidth, innerHeight );
document.body.prepend( renderer.domElement );
const canvas = renderer.domElement;

// ---------------------------------------------------------------- scene

const scene = new THREE.Scene();
const SKY = new THREE.Color( 0xc9ccc8 ), DARK = new THREE.Color( 0x07080a );
scene.background = SKY.clone();
scene.fog = new THREE.FogExp2( 0xc9ccc8, 0.022 );
const camera = new THREE.PerspectiveCamera( 75, innerWidth / innerHeight, 0.05, 80 );
const hFov = 95;
function updateFov() {

	camera.aspect = innerWidth / innerHeight;
	camera.fov = THREE.MathUtils.radToDeg( 2 * Math.atan( Math.tan( THREE.MathUtils.degToRad( hFov ) / 2 ) / camera.aspect ) );
	camera.updateProjectionMatrix();

}

updateFov();

$( 'status' ).textContent = 'Building the rooms…';
const EXIT_ROOM = 'K';
const W = LOOK ? buildWorld( scene ) : buildBuilding( scene, { exitRoom: EXIT_ROOM } );
const pmrem = new THREE.PMREMGenerator( renderer );
const envMap = pmrem.fromScene( new RoomEnvironment(), 0.04 ).texture;
const WOS = WORK_ORDERS;
const P = LOOK ? null : buildProps( scene, W, {
	phoneRooms: WOS.map( w => w.phone ),
	safeRooms: [ WOS[ 0 ].phone, ...WOS.map( w => w.find.target ) ],
	exitRoom: EXIT_ROOM
} );

// the donkey (Quaternius, CC0): plants itself in front of a wrong door
const animals = [];
let donkey = null, donkeyRig = null;
$( 'status' ).textContent = 'Loading the donkey…';
try {

	const gltf = await new GLTFLoader().loadAsync( ASSETS + 'models/donkey.glb' );
	donkey = gltf.scene;
	if ( LOOK ) { donkey.position.set( 6.6, 0, - 0.35 ); donkey.rotation.y = - Math.PI / 2 - 0.35; }
	donkey.traverse( o => { if ( o.isMesh ) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; if ( ! LOOK ) o.material = W.zoneMaterial( o.material ); } } );
	scene.add( donkey );
	const mixer = new THREE.AnimationMixer( donkey );
	const clip = n => gltf.animations.find( a => a.name === n );
	const idle = mixer.clipAction( clip( 'Idle' ) ), head = mixer.clipAction( clip( 'Idle_Headlow' ) ), walk = mixer.clipAction( clip( 'Walk' ) );
	idle.play();
	const a = { mixer, idle, head, t: 6, hold: false };
	animals.push( a );
	// for the ending: it walks out with the player
	const to = b => { for ( const c of [ idle, head, walk ] ) if ( c !== b && c.isRunning() ) c.crossFadeTo( b, 0.4, false ); b.reset().play(); };
	donkeyRig = { obj: donkey, walk() { a.hold = true; to( walk ); }, idle() { a.hold = true; to( idle ); } };

} catch ( e ) { console.warn( 'The donkey did not load.', e ); }

// the rooster (made for this game): the hint, leading the way to the safe room's door (rooster.js)
const rooster = LOOK ? null : createRooster( scene, W );

const audio = createAudio();
// the shape's three glimpses and the goose (glimpses.js), and the ending (ending.js)
const glimpses = LOOK ? null : createGlimpses( scene, W, audio, () => caption( '', '[a goose honks]', options.captions ) );
const ending = LOOK ? null : createEnding( { room: W.room( EXIT_ROOM ), P, rooster, goose: glimpses.goose, donkey: donkeyRig, figure: glimpses.figure, audio } );
const { pipeline, U, build } = createPipeline( renderer, scene, camera );
U.lensK.value = 0.05; // straighter walls than Daughter: offices read as wrong when lines bend

// ---------------------------------------------------------------- tiers (Daughter's, adapted)

let tierKey = null, renderScale = 1, auto = true, busy = false;

async function setTier( key ) {

	if ( busy ) return; busy = true;
	const T = TIERS[ key ];
	tierKey = key;
	renderScale = T.scale;
	W.apply( T, envMap );
	scene.environment = T.lit === 'baked' ? null : envMap;
	scene.environmentIntensity = 0.25;
	scene.fog.density = T.fog;
	applyLook();
	renderer.toneMappingExposure = T.lit === 'baked' ? 1.05 : 1.0;
	canvas.style.imageRendering = T.pixelated ? 'pixelated' : 'auto';
	applySize();
	build( T );
	refreshTierButtons();
	busy = false;

}

function applyLook() {

	const T = TIERS[ tierKey ];
	if ( ! T ) return;
	U.grain.value = T.grain && ! options.motion ? 0.035 : 0;
	U.ca.value = T.ca && ! options.motion ? 0.006 : 0;
	U.vignette.value = T.vignette;

}

function applySize() {

	const T = TIERS[ tierKey ];
	renderer.setPixelRatio( Math.min( devicePixelRatio, T.maxDpr ) * renderScale );
	renderer.setSize( innerWidth, innerHeight );
	updateFov();

}

addEventListener( 'resize', () => tierKey && applySize() );

function refreshTierButtons() {

	for ( const id of [ 'tierBarTitle', 'tierBarHud', 'tierBarPause' ] ) {

		const bar = $( id );
		if ( ! bar.childElementCount ) {

			for ( const k of [ 'auto', 'ultra', 'high', 'medium', 'low' ] ) {

				const b = document.createElement( 'button' );
				b.type = 'button'; b.dataset.tier = k; b.textContent = k === 'auto' ? 'Auto' : TIERS[ k ].label;
				b.addEventListener( 'click', e => { e.stopPropagation(); pickTier( k ); b.blur(); } );
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

// ---------------------------------------------------------------- speed test (Daughter's)

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

const startLabel = () => LOOK ? 'Walk around' : 'Start';

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

		} else if ( ms > 34 && idx > 0 ) await setTier( ORDER[ idx - 1 ] );

	}

	$( 'status' ).textContent = ms === null ? `Backend: ${ backendName } · ${ TIERS[ tierKey ].label } (could not measure)` : `Backend: ${ backendName } · ${ TIERS[ tierKey ].label } (${ ( 1000 / ms ).toFixed( 0 ) } fps measured)`;
	btn.disabled = false; btn.textContent = startLabel();

}

// ---------------------------------------------------------------- player and walking

const EYE = 1.62;
const player = LOOK ? { pos: new THREE.Vector3( - 10.5, EYE, 3.2 ), yaw: - 2.2, pitch: - 0.05, speed: 1.7 } : { pos: new THREE.Vector3( 6, floorY( 1 ) + EYE, 1.25 ), yaw: - Math.PI / 2, pitch: - 0.05, speed: 1.7 };
const keys = {};
let playing = false, locked = false, inputBlocked = false;
const { office, hall, pool, basin } = LAYOUT;
const R = 0.3;
// look test: walkable areas (shrunk by the player's radius); the basin is not walkable
const AREAS = [
	{ x0: office.x0 + R, x1: office.x1 - R, z0: office.z0 + R, z1: office.z1 - R },
	{ x0: office.x1 - R - 0.1, x1: hall.x0 + R + 0.1, z0: - 0.55 + R, z1: 0.55 - R },
	{ x0: hall.x0, x1: hall.x1, z0: hall.z0 + R, z1: hall.z1 - R },
	{ x0: hall.x1 - R - 0.1, x1: pool.x0 + R + 0.1, z0: - 0.55 + R, z1: 0.55 - R },
	{ x0: pool.x0 + R, x1: pool.x1 - R, z0: pool.z0 + R, z1: pool.z1 - R, hole: basin }
];

// the donkey's spot blocks its doorway; the desks block too
const donkeyBlock = { x: 0, z: 0, y: 0, r: 0.85, on: false };
function blocked( x, z, feet ) {

	if ( donkeyBlock.on && Math.abs( donkeyBlock.y - feet ) < 1 && ( x - donkeyBlock.x ) ** 2 + ( z - donkeyBlock.z ) ** 2 < donkeyBlock.r ** 2 ) return true;
	if ( P ) for ( const b of P.blockers ) if ( Math.abs( b.y - feet ) < 1 && x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 ) return true;
	return false;

}

// returns the ground height at (x, z) reachable from the current feet height, or null if not walkable
function groundAt( x, z, feet ) {

	if ( LOOK ) return AREAS.some( a => x >= a.x0 && x <= a.x1 && z >= a.z0 && z <= a.z1 && ! ( a.hole && x > a.hole.x0 - R && x < a.hole.x1 + R && z > a.hole.z0 - R && z < a.hole.z1 + R ) ) ? 0 : null;
	if ( blocked( x, z, feet ) ) return null;
	let best = null;
	for ( const a of W.walk ) {

		if ( x < a.x0 || x > a.x1 || z < a.z0 || z > a.z1 ) continue;
		const y = a.ramp ? a.ramp.ya + ( a.ramp.yb - a.ramp.ya ) * THREE.MathUtils.clamp( ( x - a.ramp.a0 ) / ( a.ramp.a1 - a.ramp.a0 ), 0, 1 ) : a.y;
		if ( Math.abs( y - feet ) < 0.6 && ( best === null || Math.abs( y - feet ) < Math.abs( best - feet ) ) ) best = y;

	}

	return best;

}

let wantPause = true, dragging = false;
function lock() { try { const p = canvas.requestPointerLock(); p?.catch?.( () => {} ); } catch ( e ) { /* blocked: drag to look */ } }
function unlockQuiet() { wantPause = false; if ( document.pointerLockElement ) document.exitPointerLock(); setTimeout( () => { wantPause = true; }, 300 ); }
document.addEventListener( 'pointerlockchange', () => {

	locked = document.pointerLockElement === canvas;
	if ( ! locked && playing && wantPause && ! panelOpen() && ! inputBlocked && ! LOOK ) showPause();

} );
canvas.addEventListener( 'mousedown', () => { if ( ! playing || panelOpen() ) return; dragging = true; if ( ! locked ) lock(); } );
addEventListener( 'mouseup', () => { dragging = false; } );
addEventListener( 'mousemove', e => {

	if ( ! playing || inputBlocked || panelOpen() || ! $( 'pause' ).hidden ) return;
	if ( ! locked && ! dragging ) return;
	player.yaw -= e.movementX * 0.0022;
	player.pitch = THREE.MathUtils.clamp( player.pitch - e.movementY * 0.0022, - 1.4, 1.4 );

} );
addEventListener( 'keydown', e => {

	if ( e.target && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox' ) return;
	if ( panelOpen() ) { if ( e.code === 'Escape' ) { e.preventDefault(); closePanel(); } return; }
	keys[ e.code ] = true;
	const map = { Digit1: 'low', Digit2: 'medium', Digit3: 'high', Digit4: 'ultra', Digit0: 'auto' };
	if ( map[ e.code ] ) pickTier( map[ e.code ] );
	if ( ! playing ) return;
	if ( e.code === 'KeyE' ) useTarget();
	if ( e.code === 'Escape' ) { if ( LOOK ) showTitle(); else if ( ! locked ) showPause(); }

} );
addEventListener( 'keyup', e => { keys[ e.code ] = false; } );
addEventListener( 'blur', () => { for ( const k in keys ) keys[ k ] = false; } ); // no key stays held after Alt+Tab (Daughter)

// ---------------------------------------------------------------- the run

const G = { wo: 1, phase: 'ring', qi: 0, qs: [], wrong: 0, completed: [], d2l: '', ended: false, finishedAt: 0, findT: 0, hinted: false, glimpsed: [ false, false, false ] };
const points = () => G.completed.filter( Boolean ).length * CONFIG.pointsPerWorkOrder;
const cur = () => WOS[ G.wo - 1 ];

function persist() {

	store.set( { options, wo: G.wo, phase: G.phase === 'call' ? 'ring' : G.phase, wrong: G.wrong, completed: G.completed, d2l: G.d2l, ended: G.ended, finishedAt: G.finishedAt, glimpsed: G.glimpsed } );

}

function newRun() { Object.assign( G, { wo: 1, phase: 'ring', qi: 0, qs: [], wrong: 0, completed: [], ended: false, finishedAt: 0, findT: 0, hinted: false, glimpsed: [ false, false, false ] } ); }
function loadRun( s ) { Object.assign( G, { wo: s.wo || 1, phase: s.phase || 'ring', qi: 0, qs: [], wrong: s.wrong || 0, completed: s.completed || [], d2l: s.d2l || '', ended: !! s.ended, finishedAt: s.finishedAt || 0, findT: 0, hinted: false, glimpsed: s.glimpsed || [ false, false, false ] } ); }

// where the player stands after starting, continuing or losing the lights: at the phone of the current work order
function checkpointRoom() { return G.phase === 'exit' ? EXIT_ROOM : cur().phone; }
function spawnAt( sym ) {

	const r = W.room( sym );
	player.pos.set( r.x0 + 1.3, r.y + EYE, - 1.1 );
	player.yaw = Math.PI / 2; // facing the phone on the west wall
	player.pitch = - 0.05;
	dark.reset();

}

// put the goat and the donkey where the current step of the run needs them
function syncWorld() {

	if ( ! P ) return;
	if ( G.phase === 'find' || G.phase === 'exit' ) P.goatAt( G.phase === 'exit' ? EXIT_ROOM : cur().find.target );
	else P.goatAt( cur().phone );
	if ( donkey ) {

		const d = W.room( cur().find.donkey );
		donkey.position.set( d.cx, d.y, 0.62 );
		donkey.rotation.y = Math.PI / 2; // side-on across the doorway
		Object.assign( donkeyBlock, { x: d.cx, z: 0.62, y: d.y, on: true } );
		donkey.visible = true;

	}

	if ( rooster && ! ( G.phase === 'find' && G.hinted ) ) rooster.hide();
	glimpses.sync( G );
	if ( G.phase === 'exit' ) {

		P.exit.open();
		// the animals wait by the open exit door for the ending (ending.js); the donkey blocks walking there instead
		ending.stage();
		const s = ending.spot.donkey;
		Object.assign( donkeyBlock, { x: s.x, z: s.z, y: s.y } );

	}

	audio.ring( G.phase === 'ring' );
	updateObjective();

}

function updateObjective() {

	const w = cur();
	$( 'wo' ).textContent = G.phase === 'exit' ? 'All six work orders done' : `Work order ${ w.n } of 6 · ${ w.title }`;
	let html = '';
	if ( G.phase === 'ring' ) html = `A phone is ringing in the <b>${ w.phone }</b> room. Answer it.`;
	else if ( G.phase === 'call' ) html = 'Finish the call at the phone.';
	else if ( G.phase === 'find' ) {

		html = fill( w.find.text );
		if ( w.find.diagram ) html += diagramHTML( orbitalDiagram( w.find.diagram ) );
		if ( G.hinted ) html += `<div style="color:var(--warn);margin-top:4px">Hint: ${ w.find.hint }</div>`;

	} else if ( G.phase === 'exit' ) html = 'The exit door is open. Go out.';
	$( 'objective' ).innerHTML = html;

}

// ---------------------------------------------------------------- the phone call: the work order and its questions

function answerPhone() {

	const w = cur();
	if ( G.phase === 'ring' ) {

		G.phase = 'call'; G.qi = 0; G.qs = drawQuestions( w );
		audio.ring( false );
		P.setRinging( w.phone, false );
		for ( const t of w.call ) caption( 'PHONE', fill( t ), options.captions );

	}

	if ( ! G.qs.length ) G.qs = drawQuestions( w );
	unlockQuiet();
	openPanel( `Work order ${ w.n } of 6 · ${ w.title }`, renderQuestion, { onClose: () => { updateObjective(); if ( playing ) lock(); } } );
	updateObjective();

}

$( 'panelClose' ).addEventListener( 'click', closePanel );

// One variant from each of the work order's question slots, with the answer choices shuffled
// (number lists and lists marked keep stay in their written order).
function drawQuestions( w ) {

	return w.questions.map( slot => {

		const q = slot[ Math.floor( Math.random() * slot.length ) ];
		if ( q.type !== 'choice' || q.keep || q.options.every( o => /^\d+$/.test( o ) ) ) return q;
		const order = q.options.map( ( _, i ) => i );
		for ( let i = order.length - 1; i > 0; i -- ) { const j = Math.floor( Math.random() * ( i + 1 ) ); [ order[ i ], order[ j ] ] = [ order[ j ], order[ i ] ]; }
		return { ...q, options: order.map( i => q.options[ i ] ), answer: order.indexOf( q.answer ) };

	} );

}

function renderQuestion( body ) {

	const w = cur(), qs = G.qs;
	body.innerHTML = '';
	if ( G.qi >= qs.length ) {

		body.append( el( 'p', { class: 'q' }, 'That is all on the phone. Your work order:' ) );
		body.append( el( 'p', { html: `<b>${ fill( w.find.text ) }</b>` } ) );
		if ( w.find.diagram ) body.append( el( 'div', { html: diagramHTML( orbitalDiagram( w.find.diagram ) ) } ) );
		body.append( el( 'p', { class: 'hint', html: options.lights ? 'Lights-on mode: the lights stay on.' : 'When you hang up, the lights behind you will start going out. Keep moving.' } ) );
		body.append( el( 'div', { class: 'actions' }, el( 'button', { class: 'primary', onclick: startFind }, 'Hang up and go' ) ) );
		return;

	}

	const q = qs[ G.qi ];
	body.append( el( 'div', { class: 'progress' }, `Question ${ G.qi + 1 } of ${ qs.length }` ) );
	body.append( el( 'p', { class: 'q' }, q.q ) );
	let misses = 0;
	const next = () => { G.qi ++; renderQuestion( body ); };
	const nextBtn = () => body.append( el( 'div', { class: 'actions' }, el( 'button', { class: 'primary', onclick: next }, G.qi + 1 < qs.length ? 'Next question' : 'Continue' ) ) );
	const miss = text => {

		misses ++; G.wrong ++;
		feedback( body, text + ( misses >= CONFIG.hintAfterWrong ? `<div class="hint">Hint: ${ q.hint }</div>` : '' ) + ( options.lights ? '' : '<div class="note">The lights will go out a little faster.</div>' ), false );

	};

	if ( q.type === 'choice' ) {

		const box = el( 'div', { class: 'choices' } );
		q.options.forEach( ( o, i ) => {

			const b = el( 'button', { class: 'choice', type: 'button' }, o );
			b.addEventListener( 'click', () => {

				if ( i === q.answer ) {

					b.classList.add( 'right' );
					box.querySelectorAll( 'button' ).forEach( x => { x.disabled = true; } );
					feedback( body, 'Correct. ' + q.why, true );
					nextBtn();

				} else { b.classList.add( 'wrong' ); b.disabled = true; miss( 'Not that one.' ); }

			} );
			box.append( b );

		} );
		body.append( box );

	} else if ( q.type === 'orbital' ) {

		// the player fills in boxes for 1s to 3p; a click adds an electron: empty, one arrow, a pair, empty again
		const want = orbitalDiagram( q.z );
		const rows = [ [ '1s', 1 ], [ '2s', 1 ], [ '2p', 3 ], [ '3s', 1 ], [ '3p', 3 ] ];
		const state = rows.map( ( [ , k ] ) => new Array( k ).fill( '' ) );
		const orb = el( 'div', { class: 'orb' } );
		rows.forEach( ( [ label ], ri ) => {

			const row = el( 'div', { class: 'orow' }, el( 'span', { class: 'olbl' }, label ) );
			state[ ri ].forEach( ( _, bi ) => {

				const b = el( 'button', { class: 'obox', type: 'button', 'aria-label': `${ label } orbital ${ bi + 1 }, empty` } );
				b.addEventListener( 'click', () => {

					const s = state[ ri ][ bi ];
					state[ ri ][ bi ] = s === '' ? '↑' : s === '↑' ? '↑↓' : '';
					b.textContent = state[ ri ][ bi ];
					b.setAttribute( 'aria-label', `${ label } orbital ${ bi + 1 }, ${ { '': 'empty', '↑': 'one electron', '↑↓': 'two electrons' }[ state[ ri ][ bi ] ] }` );

				} );
				row.append( b );

			} );
			orb.append( row );

		} );
		body.append( orb );
		const check = el( 'button', { class: 'primary', type: 'button' }, 'Check the diagram' );
		check.addEventListener( 'click', () => {

			const count = state.flat().reduce( ( n, s ) => n + s.length, 0 );
			const ok = rows.every( ( [ label ], ri ) => {

				const w2 = want.find( r => r.label === label );
				const a = [ ...state[ ri ] ].sort().join( ',' ), b = ( w2 ? [ ...w2.boxes ] : new Array( state[ ri ].length ).fill( '' ) ).sort().join( ',' );
				return a === b;

			} );
			if ( ok ) {

				check.disabled = true; orb.querySelectorAll( 'button' ).forEach( x => { x.disabled = true; } );
				feedback( body, 'Correct. ' + q.why, true );
				nextBtn();
				return;

			}

			// say what kind of mistake it is
			const pRow = state.find( ( s, ri ) => rows[ ri ][ 1 ] === 3 && s.includes( '↑↓' ) && s.includes( '' ) );
			if ( count !== q.z ) miss( `That diagram has ${ count } electron${ count === 1 ? '' : 's' }. The atom has ${ q.z }.` );
			else if ( pRow ) miss( 'Right number of electrons, but in a p sublevel each orbital gets one electron, with the same spin, before any of them pair up.' );
			else miss( 'Right number of electrons, but fill the lower sublevels first: 1s, 2s, 2p, 3s, 3p.' );

		} );
		body.append( el( 'div', { class: 'actions' }, check ) );

	}

}

function startFind() {

	const w = cur();
	G.phase = 'find'; G.findT = 0; G.hinted = false;
	closePanel();
	persist();
	syncWorld();
	dark.reset();
	if ( ! options.lights ) toast( 'Behind you, the hum changes.' );

}

// ---------------------------------------------------------------- the dark (handoff section 6)
// After the call, the rooms and hallway stretches the player has passed go dark one by one, oldest first.
// Wrong answers in this work order speed it up; so does lingering. Once everything behind is dark and the player still lingers,
// the lights fail where they stand; the player is taken back to the last phone (no points lost). The safe room stops it.

const dark = {
	visited: [], cur: null, timer: 0, linger: 0, inDark: 0, level: 1,
	reset() { W.allLit?.(); this.visited = []; this.cur = null; this.timer = CONFIG.dark.interval; this.linger = 0; this.inDark = 0; },
	darken( z ) {

		W.setZoneLit( z, false );
		const [ k, p, g ] = z.split( ':' );
		if ( k === 'h' ) for ( const r of W.rooms ) if ( r.e.period === + p && r.e.group === + g && 'r:' + r.e.sym !== this.cur ) W.setZoneLit( 'r:' + r.e.sym, false );

	},
	update( dt ) {

		const z = W.zoneAt( player.pos );
		if ( z !== this.cur ) {

			this.cur = z; this.linger = 0;
			this.visited = this.visited.filter( v => v !== z ); this.visited.push( z );

		}

		if ( G.phase !== 'find' || options.lights || inputBlocked ) return;
		this.linger += dt;
		if ( ! W.isLit( z ) ) { this.inDark += dt; if ( this.inDark > CONFIG.dark.inDark ) lightsOut(); return; }
		this.inDark = 0;
		const lingering = this.linger > CONFIG.dark.linger;
		this.timer -= dt * ( 1 + CONFIG.dark.wrongSpeedup * G.wrong ) * ( lingering ? CONFIG.dark.lingerSpeedup : 1 );
		if ( this.timer > 0 ) return;
		this.timer = CONFIG.dark.interval;
		const behind = this.visited.find( v => v !== z && W.isLit( v ) );
		if ( behind ) this.darken( behind );
		else if ( lingering ) this.darken( z );

	}
};

async function lightsOut() {

	inputBlocked = true;
	for ( const k in keys ) keys[ k ] = false;
	audio.setHum( 0 );
	await tween( v => { U.fade.value = v; }, U.fade.value, 0, 1200 );
	spawnAt( checkpointRoom() );
	syncWorld();
	toast( 'The lights went out around you. You found your way back to the last phone. No points lost.', 5000 );
	await sleep( 600 );
	await tween( v => { U.fade.value = v; }, 0, 1, 1200 );
	inputBlocked = false;

}

function tween( fn, a, b, ms ) {

	return new Promise( res => {

		const t0 = performance.now();
		const step = () => { const k = Math.min( 1, ( performance.now() - t0 ) / ms ); fn( a + ( b - a ) * k ); if ( k < 1 ) requestAnimationFrame( step ); else res(); };
		step();

	} );

}

// ---------------------------------------------------------------- reaching the safe room, the exit

function checkArrival() {

	if ( G.phase !== 'find' ) return;
	const w = cur();
	if ( W.zoneAt( player.pos ) !== 'r:' + w.find.target ) return;
	G.completed[ w.n - 1 ] = true;
	W.allLit();
	if ( w.n < WOS.length ) {

		toast( `Safe room. Work order ${ w.n } done: ${ points() } of 6 points. The lights come back on.`, 4500 );
		G.wo = w.n + 1; G.phase = 'ring'; G.qi = 0; G.qs = []; G.wrong = 0;
		persist();
		syncWorld();
		audio.ring( false );
		setTimeout( () => { if ( G.phase === 'ring' ) audio.ring( true ); }, 2500 );

	} else {

		G.phase = 'exit';
		persist();
		syncWorld();
		toast( `Work order 6 done: ${ points() } of 6 points. The exit door is open.`, 5000 );

	}

}

// what the player can use from where they stand
function useable() {

	if ( ! P || inputBlocked ) return null;
	const near = ( v, d ) => Math.abs( v.y - ( player.pos.y - EYE ) ) < 1 && Math.hypot( v.x - player.pos.x, v.z - player.pos.z ) < d;
	if ( ( G.phase === 'ring' || G.phase === 'call' ) && near( P.phones[ cur().phone ].at, 1.6 ) ) return { kind: 'phone', label: G.phase === 'ring' ? 'Answer the phone' : 'Pick up the phone again' };
	if ( G.phase === 'exit' && near( P.exit.at, 1.6 ) ) return { kind: 'exit', label: 'Go out through the exit' };
	return null;

}

function useTarget() {

	const u = useable();
	if ( ! u ) return;
	if ( u.kind === 'phone' ) answerPhone();
	else if ( u.kind === 'exit' ) startEnding();

}

async function startEnding() {

	G.ended = true; G.finishedAt = Date.now(); persist();
	inputBlocked = true;
	for ( const k in keys ) keys[ k ] = false;
	for ( const id of [ 'hudTL', 'hudTR', 'cross' ] ) $( id ).hidden = true;
	$( 'prompt' ).style.display = 'none';
	// the animals walk out, the player follows them into the light, and the door shuts on the shape (ending.js)
	glimpses.takeOver();
	await ending.play( { player, options } );
	$( 'fade' ).classList.add( 'white' ); $( 'fade' ).style.opacity = 1;
	audio.setHum( 0 );
	await sleep( 2400 );
	playing = false;
	unlockQuiet();
	for ( const id of [ 'hudTL', 'hudTR', 'cross' ] ) $( id ).hidden = true;
	$( 'prompt' ).style.display = 'none';
	clearCaptions();
	showDebrief();

}

// ---------------------------------------------------------------- debrief and code (Daughter's)

function showDebrief() {

	$( 'dbList' ).innerHTML = DEBRIEF.map( t => `<li>${ t }</li>` ).join( '' );
	$( 'debrief' ).hidden = false;

}

$( 'btnToCode' ).addEventListener( 'click', () => { $( 'debrief' ).hidden = true; showCodeScreen(); } );

function showCodeScreen() {

	$( 'codeScore' ).textContent = `You completed ${ G.completed.filter( Boolean ).length } of 6 work orders: ${ points() } of ${ CONFIG.workOrderCount * CONFIG.pointsPerWorkOrder } points.`;
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

// ---------------------------------------------------------------- title, options, pause (Daughter's)

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

bindToggle( [ 'optLights', 'pLights' ], 'lights', () => { if ( options.lights ) W.allLit?.(); } );
bindToggle( [ 'optCaptions', 'pCaptions' ], 'captions', () => { if ( ! options.captions ) clearCaptions(); } );
bindToggle( [ 'optMotion', 'pMotion' ], 'motion', () => W.setSteady?.( options.motion ) );
W.setSteady?.( options.motion ); // reduced motion: no flickering tubes, the lights fade out without blinking

if ( ! LOOK && saved && ! saved.ended && ( saved.wo > 1 || saved.phase !== 'ring' ) ) {

	$( 'btnContinue' ).hidden = false;
	$( 'btnContinue' ).textContent = saved.phase === 'exit' ? 'Continue (at the exit)' : `Continue (work order ${ saved.wo })`;

}

function enterGame() {

	audio.start();
	$( 'title' ).hidden = true; $( 'pause' ).hidden = true;
	for ( const id of [ 'hudTR', 'cross' ] ) $( id ).hidden = false;
	$( 'hudTL' ).hidden = LOOK;
	playing = true;
	if ( ! LOOK ) syncWorld();
	lock();

}

$( 'btnStart' ).addEventListener( 'click', () => {

	if ( LOOK ) { enterGame(); return; }
	newRun(); spawnAt( checkpointRoom() ); persist();
	enterGame();
	toast( 'A phone is ringing.' );

} );
$( 'btnContinue' ).addEventListener( 'click', () => {

	loadRun( saved ); spawnAt( checkpointRoom() );
	enterGame();

} );

function showTitle() { playing = false; $( 'title' ).hidden = false; $( 'hudTR' ).hidden = true; for ( const k in keys ) keys[ k ] = false; }

function showPause() {

	if ( ! playing || LOOK ) return;
	$( 'pauseInfo' ).textContent = G.phase === 'exit' ? `All 6 work orders done · ${ points() } of 6 points` : `Work order ${ G.wo } of 6 · ${ points() } of 6 points so far`;
	$( 'pause' ).hidden = false;
	for ( const k in keys ) keys[ k ] = false;

}

$( 'btnResume' ).addEventListener( 'click', () => { $( 'pause' ).hidden = true; lock(); } );
$( 'btnCheckpoint' ).addEventListener( 'click', () => {

	$( 'pause' ).hidden = true;
	spawnAt( checkpointRoom() );
	syncWorld();
	lock();

} );

// ---------------------------------------------------------------- loop

const clock = new THREE.Timer();
let fpsAcc = 0, fpsN = 0, fpsShow = 0, lowSince = 0, hudT = 0, titleT = 0, lightT = 0, ringT = 0, ambient = 1;
const e3 = new THREE.Euler( 0, 0, 0, 'YXZ' );

function frame() {

	clock.update();
	const dt = Math.min( clock.getDelta(), 0.1 );
	if ( benchmarking ) frameTimes.push( dt * 1000 );
	const active = playing && ! inputBlocked && ! panelOpen() && $( 'pause' ).hidden;

	let moving = false;
	if ( active ) {

		const mx = ( keys.KeyD ? 1 : 0 ) - ( keys.KeyA ? 1 : 0 ), mz = ( keys.KeyS ? 1 : 0 ) - ( keys.KeyW ? 1 : 0 );
		moving = mx !== 0 || mz !== 0;
		const c = Math.cos( player.yaw ), s = Math.sin( player.yaw );
		// wading through the flooded corridor is slower
		const sp = player.speed * ( keys.ShiftLeft || keys.ShiftRight ? 1.7 : 1 ) * ( W.inFlood?.( player.pos ) ? 0.7 : 1 ) * dt;
		const dx = ( mx * c + mz * s ) * sp, dz = ( - mx * s + mz * c ) * sp;
		const feet = player.pos.y - EYE;
		let g = groundAt( player.pos.x + dx, player.pos.z, feet );
		if ( g !== null ) { player.pos.x += dx; player.pos.y = g + EYE; }
		g = groundAt( player.pos.x, player.pos.z + dz, player.pos.y - EYE );
		if ( g !== null ) { player.pos.z += dz; player.pos.y = g + EYE; }

	} else if ( ! playing ) {

		// title backdrop: a slow look around
		titleT += dt;
		player.yaw = ( LOOK ? - 2.2 : - Math.PI / 2 ) + Math.sin( titleT * 0.08 ) * 0.5;

	}

	camera.position.copy( player.pos );
	e3.set( player.pitch, player.yaw, 0 );
	camera.quaternion.setFromEuler( e3 );

	for ( const a of animals ) {

		a.mixer.update( dt );
		if ( a.hold ) continue; // the ending moves it
		a.t -= dt;
		if ( a.t < 0 ) { // now and then the donkey lowers its head, then goes back to standing
			const from = a.idle.isRunning() ? a.idle : a.head, to = from === a.idle ? a.head : a.idle;
			to.reset().play(); from.crossFadeTo( to, 0.8, false );
			a.t = to === a.head ? 5 : 7 + Math.random() * 5;

		}

	}

	if ( ! LOOK ) {

		if ( playing ) {

			dark.update( active ? dt : 0 );
			if ( active ) checkArrival();
			if ( G.phase === 'find' && active ) {

				G.findT += dt;
				if ( ! G.hinted && G.findT > CONFIG.hintAfterSeconds ) {

					G.hinted = true; updateObjective();
					const r = rooster?.lead( cur().find.target, player.pos, camera );
					toast( `${ r === 'near' ? 'The rooster is heading for the right door. ' : r ? 'The rooster has gone to wait at the right door. ' : '' }Hint: ${ cur().find.hint }`, 6000 );

				}

			}

			const u = active ? useable() : null;
			const pr = $( 'prompt' );
			pr.style.display = u ? 'block' : 'none';
			if ( u ) pr.innerHTML = `<kbd>E</kbd>${ u.label }`;

		}

		ringT += dt;
		P.setRinging( cur().phone, G.phase === 'ring', ringT );
		P.update( dt );
		rooster?.update( dt );
		glimpses.update( dt, { G, find: G.phase === 'find' ? cur().find : null, player, camera, options, active } );
		ending.update( dt );

		// ambient light, fog and hum follow how many lights are on around the player
		const zs = dark.cur ? W.nearZones( dark.cur ) : [];
		let lit = 1;
		if ( zs.length ) { let n = 0, on = 0; zs.forEach( ( z, i ) => { const w = i === 0 ? 2 : 1; n += w; if ( W.isLit( z ) ) on += w; } ); lit = on / n; }
		ambient += ( lit - ambient ) * Math.min( 1, dt * 1.5 );
		W.hemi.intensity = 1.5 * ( 0.06 + 0.94 * ambient );
		scene.background.copy( DARK ).lerp( SKY, ambient );
		scene.fog.color.copy( scene.background );
		if ( playing ) audio.setHum( ambient );

		W.updateDark( dt );
		W.updateFlood( player.pos, dt, moving );
		W.updateFlicker( dt );
		const fl = playing ? W.flickerNear( player.pos ) : null;
		audio.setBuzz( fl ? Math.max( 0, 1 - fl.d / 7 ) : 0, fl?.stutter, fl?.on ?? true );
		if ( ( lightT -= dt ) < 0 ) { lightT = 0.4; W.updateLights( player.pos ); }

	}

	pipeline.render();

	fpsAcc += dt; fpsN ++;
	if ( fpsAcc > 0.5 ) { fpsShow = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
	// the auto tier never changes during a scare (a glimpse or the ending: handoff section 8)
	if ( auto && playing && ! benchmarking && ! busy && ! glimpses?.busy && ! ending?.running ) {

		if ( fpsShow > 0 && fpsShow < 30 ) lowSince += dt; else lowSince = 0;
		if ( lowSince > 4 ) {

			lowSince = 0;
			const T = TIERS[ tierKey ];
			if ( renderScale - 0.1 >= T.minScale - 1e-6 ) { renderScale -= 0.1; applySize(); }
			else if ( ORDER.indexOf( tierKey ) > 0 ) setTier( ORDER[ ORDER.indexOf( tierKey ) - 1 ] );

		}

	}

	hudT -= dt;
	if ( hudT < 0 ) { hudT = 0.25; $( 'perfInfo' ).textContent = `${ TIERS[ tierKey ].label }${ auto ? ' (auto)' : '' } · ${ backendName } · ${ fpsShow.toFixed( 0 ) } fps`; }

}

// ---------------------------------------------------------------- go

if ( ! LOOK ) syncWorld();
const startKey = TIERS[ params.get( 'tier' ) ] ? params.get( 'tier' ) : ( isWebGPU ? 'high' : 'medium' );
if ( params.get( 'tier' ) ) auto = false;
await setTier( startKey );
renderer.setAnimationLoop( frame );
refreshTierButtons();
if ( auto ) runBenchmark( true );
else { $( 'btnStart' ).disabled = false; $( 'btnStart' ).textContent = startLabel(); $( 'status' ).textContent = `Backend: ${ backendName } · ${ TIERS[ tierKey ].label } (chosen in the URL)`; }

if ( import.meta.env.DEV ) window.__look = { groundAt, renderer, scene, camera, player, setTier, TIERS, W, P, G, dark, syncWorld, spawnAt, answerPhone, startFind, checkArrival, rooster, glimpses, ending, get tier() { return tierKey; }, get fps() { return fpsShow; } };

