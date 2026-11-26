// The glimpses (build step 5). Handoff section 3: a rocking chair, and later a shape, seen three times.
// Lights-on mode removes all of them (handoff section 2), so every glimpse checks options.lights.
//
// Glimpse 1, entry hall: a creak is heard before anything is seen. The chair is rocking alone at the end of
// the hall and stops the moment the flashlight reaches it. It starts when the last barrier (gamma) opens,
// so the creak comes while the door is still rising. It happens once per run (G.state.glimpse1).

import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { registerMaterial } from './art.js';

const CHAIR_POS = new THREE.Vector3( 0, 0.672, - 26.55 ); // the pivot: centre of the rockers' arc, radius 0.672 m
const SEAT = new THREE.Vector3( 0, 0.6, - 26.55 );          // what the flashlight has to find
const ROCK_DEG = 9, ROCK_HZ = 0.55;

export async function createGlimpses( { scene, L, G, audio, options, url, save } ) {

	const gltf = await new GLTFLoader().loadAsync( url );
	const chair = gltf.scene.getObjectByName( 'CHAIR_pivot' ) || gltf.scene;
	chair.traverse( o => {

		if ( ! o.isMesh ) return;
		o.userData.matKey = registerMaterial( L, o.material );
		o.material = L.mats[ o.userData.matKey ][ L.variant || 'full' ];
		o.castShadow = o.receiveShadow = true;
		L.statics.push( o );

	} );
	chair.position.copy( CHAIR_POS );
	scene.add( chair );
	const blk = { x0: - 0.36, x1: 0.36, z0: - 27.0, z1: - 26.1, art: 'chair' };
	L.blockers.push( blk );

	let phase = 'wait', amp = 0, t = 0, lastPeak = 0;
	const toSeat = new THREE.Vector3();

	function update( dt, { flashOn, handPos, beamDir } ) {

		const off = options.lights;
		chair.visible = ! off; blk.disabled = off;
		if ( off ) { chair.rotation.x = 0; return; }

		if ( G.state.glimpse1 ) phase = 'still';
		else if ( phase === 'still' && ! L.doors.barrier2?.open ) phase = 'wait'; // a new run
		if ( phase === 'wait' && L.doors.barrier2?.open ) { phase = 'rocking'; amp = 1; t = 0; }

		if ( phase === 'rocking' || phase === 'stopping' ) {

			t += dt;
			const s = Math.sin( t * ROCK_HZ * 2 * Math.PI );
			chair.rotation.x = THREE.MathUtils.degToRad( ROCK_DEG ) * amp * s;
			// a creak at each end of the swing, slightly different each time
			const peak = Math.floor( t * ROCK_HZ * 2 + 0.5 );
			if ( phase === 'rocking' && peak !== lastPeak ) { lastPeak = peak; audio.creak( SEAT, 0.55, peak % 2 ? 1.0 : 0.86 ); }

		}

		if ( phase === 'rocking' && flashOn ) {

			// the beam reaches the chair: inside the cone and close enough to be lit
			toSeat.subVectors( SEAT, handPos );
			const d = toSeat.length();
			if ( d < 14 && toSeat.normalize().dot( beamDir ) > Math.cos( 0.3 ) ) phase = 'stopping';

		}

		if ( phase === 'stopping' ) {

			amp *= Math.exp( - dt * 16 ); // stops almost at once
			if ( amp < 0.01 ) { phase = 'still'; chair.rotation.x = 0; G.state.glimpse1 = true; save(); }

		}

		if ( phase === 'still' ) chair.rotation.x = 0;

	}

	return { update, chair, get phase() { return phase; } };

}
