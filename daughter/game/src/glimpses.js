// The glimpses (build step 5). Handoff section 3: a rocking chair, and later a shape, seen three times.
// Lights-on mode removes all of them (handoff section 2), so every glimpse checks options.lights.
//
// Glimpse 1, entry hall: a creak is heard before anything is seen. The chair is rocking alone at the end of
// the hall and stops the moment the flashlight reaches it. It starts when the last barrier (gamma) opens,
// so the creak comes while the door is still rising. It happens once per run (G.state.glimpse1).
//
// Glimpse 2, hot corridor: when the corridor clock is advanced (station 4), the chair is no longer in the
// hall. During the time skip it has moved to the middle of the hot corridor, facing the player, and the shape
// is sitting in it. The first time the player looks at it for half a second, the shape is gone and the empty
// chair rocks, as if someone had just stood up. Once per run (G.state.glimpse2).
//
// Glimpse 3, control room: when the infirmary's exit opens, the chair is beside the core door, and the shape
// stands in front of the decay console, between the player and the core. It is dense: the counter behind it
// is almost silent (it is a dose occluder, like a wall; the core's radiation streams out along the doorway's
// axis, which is where the player enters and where the console is). Whenever the player is not looking it
// turns to face them. When the player starts the final equations it steps aside and the counter climbs
// (G.state.glimpse3). In the ending the view turns to the chair, which rocks once more and stops, empty.
//
// The shape (handoff 6.4) is unlit and near-black, readable only against the fog or the blue glow. On Ultra
// and High its edge bends what is behind it, like heat haze; on Medium and Low it is a plain dark figure.

import * as THREE from 'three/webgpu';
import { Fn, float, vec2, vec3, vec4, mix, abs, dot, sin, cos, length, saturate, uv, time, normalView, positionViewDirection, positionWorld, screenUV, viewportSharedTexture } from 'three/tsl';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { registerMaterial } from './art.js';
import { GLOW_BLUE } from './level.js';

const HALL = new THREE.Vector3( 0, 0.672, - 26.55 ); // the pivot: centre of the rockers' arc, radius 0.672 m
const HOT = new THREE.Vector3( 0, 0.672, - 66.6 );   // hot corridor, just short of the source alcove
const CTL = new THREE.Vector3( - 1.95, 0.672, - 100.45 ), CTL_YAW = 0.45; // control room, beside the core door
const SEAT_DY = - 0.072;                             // the seat, relative to the pivot
const CHEST_DY = 0.3;                                // the seated shape's chest, relative to the pivot
const ROCK_DEG = 9, ROCK_HZ = 0.55;
const SEEN_FOR = 0.5;                                // seconds in view before the seated shape is gone
const VIEW_COS = Math.cos( THREE.MathUtils.degToRad( 28 ) );

const CORE = new THREE.Vector3( 0, 1.3, - 105 );     // level.js L.props.coreSource
const STAND = new THREE.Vector3( 0, 0, - 99.6 );     // the standing shape, in front of the decay console
const STAND_ATTEN = 0.12;                            // what fraction of the core's radiation gets past it
const STEP = 1.0, STEP_TIME = 1.5;                   // stepping aside: metres, seconds
const ENTRY = new THREE.Vector3( 0, 1.65, - 90 );     // the control room's south doorway, at eye height (it faces this at first)

const DARK = new THREE.Color( 0x020304 );

function shapeMaterials() {

	// full: near-black, with an edge that shows what is behind it, slightly bent (heat haze)
	const full = new THREE.MeshBasicNodeMaterial();
	full.transparent = true; full.depthWrite = true; // drawn after the opaque pass so the edge can sample it
	full.colorNode = Fn( () => {

		const rim = float( 1 ).sub( abs( dot( normalView, positionViewDirection ) ) ).pow( 2.5 );
		const wob = vec2( sin( time.mul( 3.1 ).add( positionWorld.y.mul( 23 ) ) ), cos( time.mul( 2.3 ).add( positionWorld.x.mul( 19 ) ) ) ).mul( 0.008 ).mul( rim );
		const behind = viewportSharedTexture( screenUV.add( wob ) ).rgb;
		return vec4( mix( vec3( DARK.r, DARK.g, DARK.b ), behind, rim.mul( 0.85 ) ), 1 );

	} )();
	full.name = 'shape';
	const med = new THREE.MeshBasicMaterial( { color: DARK, name: 'shape' } );
	return { full, med, low: med, tile: [ 1, 1 ] };

}

export async function createGlimpses( { scene, L, G, audio, options, url, save } ) {

	const gltf = await new GLTFLoader().loadAsync( url );
	const chair = gltf.scene.getObjectByName( 'CHAIR_pivot' ) || gltf.scene;
	const shape = chair.getObjectByName( 'SHAPE_seated' );
	const stand = gltf.scene.getObjectByName( 'SHAPE_standing' );
	L.mats.shape ??= shapeMaterials();
	const mine = new Set();
	const isShape = o => ( shape && ( o === shape || o.parent === shape ) ) || ( stand && ( o === stand || o.parent === stand ) );
	for ( const root of [ chair, stand ] ) root?.traverse( o => {

		if ( ! o.isMesh ) return;
		o.userData.matKey = isShape( o ) ? 'shape' : registerMaterial( L, o.material );
		o.material = L.mats[ o.userData.matKey ][ L.variant || 'full' ];
		o.castShadow = true; o.receiveShadow = ! isShape( o );
		if ( isShape( o ) ) o.renderOrder = 7; // after the glows, so the edge bends them
		L.statics.push( o ); mine.add( o );

	} );
	chair.rotation.order = 'YXZ'; // rock about the chair's own axis when it is turned
	scene.add( chair );
	if ( stand ) { stand.visible = false; scene.add( stand ); }

	// the source's glow in the air just behind the chair in the hot corridor (the low shield lip keeps the light
	// itself off the floor), so the shape has something to be seen against even with the flashlight off
	const glowMat = new THREE.SpriteNodeMaterial( { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending } );
	glowMat.colorNode = Fn( () => {

		const f = saturate( float( 1 ).sub( length( uv().sub( 0.5 ) ).mul( 2 ) ) ).pow( 2.2 );
		return vec4( vec3( GLOW_BLUE.r, GLOW_BLUE.g, GLOW_BLUE.b ).mul( f ).mul( 0.3 ), 1 );

	} )();
	const glow = new THREE.Sprite( glowMat );
	glow.position.set( 0.2, 0.85, HOT.z - 1.8 ); glow.scale.setScalar( 2.2 ); glow.renderOrder = 6; glow.visible = false;
	scene.add( glow );

	const blk = { x0: 0, x1: 0, z0: 0, z1: 0, art: 'chair' };
	const standBlk = { x0: 0, x1: 0, z0: 0, z1: 0, art: 'shape', disabled: true };
	const standOcc = { min: new THREE.Vector3(), max: new THREE.Vector3(), atten: 1, group: 'shape' };
	L.blockers.push( blk, standBlk );
	L.occluders.push( standOcc );

	let at = '';
	function moveTo( where ) {

		at = where;
		const p = { hall: HALL, hot: HOT, ctl: CTL }[ where ];
		chair.position.copy( p ); chair.rotation.set( 0, where === 'ctl' ? CTL_YAW : 0, 0 );
		const r = where === 'ctl' ? 0.5 : 0.36, back = where === 'ctl' ? 0.1 : 0;
		Object.assign( blk, { x0: p.x - r, x1: p.x + r, z0: p.z - 0.45 - back, z1: p.z + 0.45 - back } );
		settle = 0;
		g2 = where !== 'hot' ? 'off' : G.state.glimpse2 ? 'done' : 'armed'; seenT = 0;
		if ( where === 'hall' ) phase = G.state.glimpse1 ? 'still' : 'wait';
		g3 = where !== 'ctl' ? 'off' : G.state.glimpse3 ? 'gone' : 'standing';
		if ( stand && g3 === 'standing' ) placeStand( STAND, ENTRY );

	}

	// ---- glimpse 1: the chair rocks alone in the hall until the flashlight finds it
	let phase = 'wait', amp = 0, t = 0, lastPeak = 0;
	const seat = new THREE.Vector3(), toSeat = new THREE.Vector3();

	function glimpse1( dt, flashOn, handPos, beamDir ) {

		if ( G.state.glimpse1 ) phase = 'still';
		else if ( phase === 'still' && ! L.doors.barrier2?.open ) phase = 'wait'; // a new run
		if ( phase === 'wait' && L.doors.barrier2?.open ) { phase = 'rocking'; amp = 1; t = 0; }
		seat.copy( chair.position ).y += SEAT_DY;

		if ( phase === 'rocking' || phase === 'stopping' ) {

			t += dt;
			const s = Math.sin( t * ROCK_HZ * 2 * Math.PI );
			chair.rotation.x = THREE.MathUtils.degToRad( ROCK_DEG ) * amp * s;
			// a creak at each end of the swing, slightly different each time
			const peak = Math.floor( t * ROCK_HZ * 2 + 0.5 );
			if ( phase === 'rocking' && peak !== lastPeak ) { lastPeak = peak; audio.creak( seat, 0.55, peak % 2 ? 1.0 : 0.86 ); }

		}

		if ( phase === 'rocking' && flashOn ) {

			// the beam reaches the chair: inside the cone and close enough to be lit
			toSeat.subVectors( seat, handPos );
			const d = toSeat.length();
			if ( d < 14 && toSeat.normalize().dot( beamDir ) > Math.cos( 0.3 ) ) phase = 'stopping';

		}

		if ( phase === 'stopping' ) {

			amp *= Math.exp( - dt * 16 ); // stops almost at once
			if ( amp < 0.01 ) { phase = 'still'; chair.rotation.x = 0; G.state.glimpse1 = true; save(); }

		}

		if ( phase === 'still' || phase === 'wait' ) chair.rotation.x = 0;

	}

	// ---- the empty chair rocking by itself after someone has left it (glimpse 2 and the ending)
	let settle = 0, st = 0, settleRate = 0.9;
	function rockOnce( a, rate ) { settle = a; settleRate = rate; st = 0; seat.copy( chair.position ).y += SEAT_DY; audio.creak( seat, 0.45, 0.9 ); }
	function updateSettle( dt ) {

		if ( settle > 0.01 ) { st += dt; chair.rotation.x = THREE.MathUtils.degToRad( ROCK_DEG ) * settle * Math.sin( st * ROCK_HZ * 2 * Math.PI ); settle *= Math.exp( - dt * settleRate ); }
		else chair.rotation.x = 0;

	}

	// ---- what the player can see: inside the view and not behind a wall
	const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), sphere = new THREE.Sphere();
	const ray = new THREE.Raycaster(), toP = new THREE.Vector3();
	let losList = null, losTick = 0;
	function lineOfSight( from, to ) {

		if ( ! losList || losTick ++ % 60 === 0 ) losList = L.statics.filter( m => m.isMesh && m.visible && m.parent?.visible && ! mine.has( m ) );
		toP.subVectors( to, from ); const d = toP.length(); toP.divideScalar( d );
		ray.set( from, toP ); ray.far = d - 0.3;
		return ray.intersectObjects( losList, false ).length === 0;

	}

	function canSee( camera, pos, radius ) {

		pv.multiplyMatrices( camera.projectionMatrix, camera.matrixWorldInverse ); frustum.setFromProjectionMatrix( pv );
		sphere.center.copy( pos ); sphere.radius = radius;
		return frustum.intersectsSphere( sphere ) && lineOfSight( camera.position, pos );

	}

	// ---- glimpse 2: the shape in the chair, seen for half a second
	let g2 = 'off', seenT = 0, losT = 0, los = false;
	const chest = new THREE.Vector3(), toChest = new THREE.Vector3();

	function glimpse2( dt, camPos, camDir ) {

		if ( g2 === 'armed' ) {

			chest.copy( chair.position ).y += CHEST_DY;
			toChest.subVectors( chest, camPos );
			const d = toChest.length(); toChest.divideScalar( d );
			const inCone = d < 16 && toChest.dot( camDir ) > VIEW_COS;
			if ( inCone ) { if ( losT ++ % 4 === 0 ) los = lineOfSight( camPos, chest ); } else { los = false; losT = 0; }
			if ( inCone && los ) seenT += dt;
			if ( seenT >= SEEN_FOR || d < 2.5 ) {

				// gone; the empty chair rocks as if someone had just stood up
				g2 = 'done'; rockOnce( 0.5, 0.9 );
				G.state.glimpse2 = true; save();

			}

		}

	}

	// ---- glimpse 3: the shape stands between the player and the core
	let g3 = 'off', stepT = 0, checkT = 0, endT = - 1;
	const standPos = new THREE.Vector3(), stepFrom = new THREE.Vector3(), stepTo = new THREE.Vector3();
	const tmp = new THREE.Vector3(), chestW = new THREE.Vector3();

	function placeStand( p, camPos ) {

		standPos.copy( p );
		stand.position.copy( p );
		if ( camPos ) stand.rotation.set( 0, Math.atan2( camPos.x - p.x, camPos.z - p.z ), 0 );
		Object.assign( standBlk, { x0: p.x - 0.25, x1: p.x + 0.25, z0: p.z - 0.2, z1: p.z + 0.2 } );
		// its shadow is a little wider than its shoulders, so the whole front of the console is quiet behind it
		standOcc.min.set( p.x - 0.42, 0, p.z - 0.15 ); standOcc.max.set( p.x + 0.42, 1.82, p.z + 0.15 );

	}

	function glimpse3( dt, camera ) {

		const camPos = camera.position;
		if ( g3 === 'standing' && ( checkT -= dt ) <= 0 ) {

			// it turns to face the player, but only while they are not looking
			checkT = 0.1;
			const want = Math.atan2( camPos.x - standPos.x, camPos.z - standPos.z );
			if ( Math.abs( Math.atan2( Math.sin( want - stand.rotation.y ), Math.cos( want - stand.rotation.y ) ) ) > 0.15 && ! canSee( camera, chestW.copy( standPos ).setY( 1.0 ), 0.9 ) ) stand.rotation.y = want;

		}

		if ( g3 === 'stepping' ) {

			stepT += dt;
			const u = Math.min( 1, stepT / STEP_TIME ), k = u * u * ( 3 - 2 * u );
			tmp.lerpVectors( stepFrom, stepTo, k );
			placeStand( tmp, null );
			stand.position.y = 0.03 * Math.abs( Math.sin( 2 * Math.PI * u ) ); // two steps
			stand.rotation.z = 0.035 * Math.sin( 2 * Math.PI * u );
			if ( u >= 1 ) {

				g3 = 'aside'; stand.position.y = 0; stand.rotation.z = 0;
				standOcc.atten = 1; // nothing between the player and the core now
				G.state.glimpse3 = true; save();

			}

		}

		if ( endT >= 0 ) {

			// the ending: the view turns to the chair; the shape is gone; the chair rocks once more and stops
			endT += dt;
			if ( stand.visible && ( endT > 2.2 || ! canSee( camera, chestW.copy( standPos ).setY( 1.0 ), 0.5 ) ) ) g3 = 'gone';
			if ( endT > 2.4 && endT - dt <= 2.4 ) { g3 = 'gone'; rockOnce( 0.75, 1.3 ); }

		}

	}

	function update( dt, { flashOn, handPos, beamDir, camera } ) {

		const S = G.state;
		const where = S.s5?.why ? 'ctl' : S.s4?.set ? 'hot' : 'hall';
		if ( where !== at ) moveTo( where );
		const off = options.lights;
		chair.visible = ! off; blk.disabled = off;
		if ( off ) { chair.rotation.x = 0; settle = 0; }
		else if ( at === 'hall' ) glimpse1( dt, flashOn, handPos, beamDir );
		else if ( at === 'hot' ) glimpse2( dt, camera.position, beamDir );
		else if ( stand ) glimpse3( dt, camera );
		if ( ! off && at !== 'hall' ) updateSettle( dt );

		const standing = ! off && ( g3 === 'standing' || g3 === 'stepping' || g3 === 'aside' );
		if ( shape ) shape.visible = ! off && g2 === 'armed';
		if ( stand ) stand.visible = standing;
		standBlk.disabled = ! standing;
		if ( ! standing || g3 === 'aside' ) standOcc.atten = 1; else standOcc.atten = STAND_ATTEN;
		glow.visible = ! off && at === 'hot';

	}

	// the player has started the final equations: the shape steps aside. Returns how long it takes, in ms
	// (0 if there is nothing to step aside), so the console can wait for it.
	function stepAside( camPos ) {

		if ( options.lights || at !== 'ctl' || g3 !== 'standing' || ! stand ) return 0;
		toP.subVectors( camPos, standPos ).setY( 0 ).normalize();
		const side = new THREE.Vector3( - toP.z, 0, toP.x ); // perpendicular to the player's line of sight
		const ends = [ side, side.clone().negate() ].map( s => standPos.clone().addScaledVector( s, STEP ) )
			.filter( e => Math.abs( e.x ) < 5.3 && Math.hypot( e.x - CTL.x, e.z - CTL.z ) > 1.0 )
			.sort( ( a, b ) => ( b.x - a.x ) ); // away from the chair (which is on the west side) when both fit
		stepFrom.copy( standPos ); stepTo.copy( ends[ 0 ] || standPos.clone().addScaledVector( side, STEP ) );
		g3 = 'stepping'; stepT = 0;
		return STEP_TIME * 1000 + 200;

	}

	// the ending: returns the chair's seat, for the view to turn to (null in lights-on mode)
	function ending() {

		if ( options.lights || at !== 'ctl' ) return null;
		endT = 0;
		return chair.position.clone().setY( chair.position.y + SEAT_DY );

	}

	return { update, stepAside, ending, chair, shape, stand, glow, get phase() { return phase; }, get g2() { return g2; }, get g3() { return g3; } };

}
