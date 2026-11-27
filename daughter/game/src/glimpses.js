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
// The shape (handoff 6.4) is unlit and near-black, readable only against the fog or the blue glow. On Ultra
// and High its edge bends what is behind it, like heat haze; on Medium and Low it is a plain dark figure.

import * as THREE from 'three/webgpu';
import { Fn, float, vec2, vec3, vec4, mix, abs, dot, sin, cos, length, saturate, uv, time, normalView, positionViewDirection, positionWorld, screenUV, viewportSharedTexture } from 'three/tsl';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { registerMaterial } from './art.js';
import { GLOW_BLUE } from './level.js';

const HALL = new THREE.Vector3( 0, 0.672, - 26.55 ); // the pivot: centre of the rockers' arc, radius 0.672 m
const HOT = new THREE.Vector3( 0, 0.672, - 66.6 );   // hot corridor, just short of the source alcove
const SEAT_DY = - 0.072;                             // the seat, relative to the pivot
const CHEST_DY = 0.3;                                // the shape's chest, relative to the pivot
const ROCK_DEG = 9, ROCK_HZ = 0.55;
const SEEN_FOR = 0.5;                                // seconds in view before the shape is gone
const VIEW_COS = Math.cos( THREE.MathUtils.degToRad( 28 ) );

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
	L.mats.shape ??= shapeMaterials();
	const mine = new Set();
	chair.traverse( o => {

		if ( ! o.isMesh ) return;
		const isShape = shape && ( o === shape || o.parent === shape );
		o.userData.matKey = isShape ? 'shape' : registerMaterial( L, o.material );
		o.material = L.mats[ o.userData.matKey ][ L.variant || 'full' ];
		o.castShadow = true; o.receiveShadow = ! isShape;
		L.statics.push( o ); mine.add( o );

	} );
	if ( shape ) shape.renderOrder = 7; // after the glow below, so the edge bends it
	scene.add( chair );

	// the source's glow in the air just behind the chair (the low shield lip keeps the light itself off the
	// floor), so the shape has something to be seen against even with the flashlight off
	const glowMat = new THREE.SpriteNodeMaterial( { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending } );
	glowMat.colorNode = Fn( () => {

		const f = saturate( float( 1 ).sub( length( uv().sub( 0.5 ) ).mul( 2 ) ) ).pow( 2.2 );
		return vec4( vec3( GLOW_BLUE.r, GLOW_BLUE.g, GLOW_BLUE.b ).mul( f ).mul( 0.3 ), 1 );

	} )();
	const glow = new THREE.Sprite( glowMat );
	glow.position.set( 0.2, 0.85, HOT.z - 1.8 ); glow.scale.setScalar( 2.2 ); glow.renderOrder = 6; glow.visible = false;
	scene.add( glow );

	const blk = { x0: 0, x1: 0, z0: 0, z1: 0, art: 'chair' };
	L.blockers.push( blk );

	let at = '';
	function moveTo( where ) {

		at = where;
		const p = where === 'hot' ? HOT : HALL;
		chair.position.copy( p ); chair.rotation.x = 0;
		Object.assign( blk, { x0: p.x - 0.36, x1: p.x + 0.36, z0: p.z - 0.45, z1: p.z + 0.45 } );
		if ( where === 'hot' ) { phase = 'gone'; g2 = G.state.glimpse2 ? 'done' : 'armed'; seenT = 0; settle = 0; }
		else { g2 = 'off'; phase = G.state.glimpse1 ? 'still' : 'wait'; }

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

	// ---- glimpse 2: the shape in the chair, seen for half a second
	let g2 = 'off', seenT = 0, settle = 0, st = 0, losTick = 0, los = false, losList = null;
	const chest = new THREE.Vector3(), toChest = new THREE.Vector3(), ray = new THREE.Raycaster();

	function lineOfSight( from, dir, d ) {

		if ( ! losList || losTick % 60 === 0 ) losList = L.statics.filter( m => m.isMesh && m.visible && m.parent?.visible && ! mine.has( m ) );
		ray.set( from, dir ); ray.far = d;
		return ray.intersectObjects( losList, false ).length === 0;

	}

	function glimpse2( dt, camPos, camDir ) {

		if ( g2 === 'armed' ) {

			chest.copy( chair.position ).y += CHEST_DY;
			toChest.subVectors( chest, camPos );
			const d = toChest.length(); toChest.divideScalar( d );
			const inCone = d < 16 && toChest.dot( camDir ) > VIEW_COS;
			if ( inCone ) { if ( losTick ++ % 4 === 0 ) los = lineOfSight( camPos, toChest, d ); } else { los = false; losTick = 0; }
			if ( inCone && los ) seenT += dt;
			if ( seenT >= SEEN_FOR || d < 2.5 ) {

				// gone; the empty chair rocks as if someone had just stood up
				g2 = 'done'; settle = 0.5; st = 0;
				seat.copy( chair.position ).y += SEAT_DY;
				audio.creak( seat, 0.45, 0.9 );
				G.state.glimpse2 = true; save();

			}

		}

		if ( settle > 0.01 ) { st += dt; chair.rotation.x = THREE.MathUtils.degToRad( ROCK_DEG ) * settle * Math.sin( st * ROCK_HZ * 2 * Math.PI ); settle *= Math.exp( - dt * 0.9 ); }
		else chair.rotation.x = 0;

	}

	function update( dt, { flashOn, handPos, beamDir, camPos } ) {

		const where = G.state.s4?.set ? 'hot' : 'hall';
		if ( where !== at ) moveTo( where );
		const off = options.lights;
		chair.visible = ! off; blk.disabled = off;
		if ( shape ) shape.visible = ! off && g2 === 'armed';
		glow.visible = ! off && at === 'hot';
		if ( off ) { chair.rotation.x = 0; return; }
		if ( at === 'hall' ) glimpse1( dt, flashOn, handPos, beamDir );
		else glimpse2( dt, camPos, beamDir );

	}

	return { update, chair, shape, glow, get phase() { return phase; }, get g2() { return g2; } };

}
