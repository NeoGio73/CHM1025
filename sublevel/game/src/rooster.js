// The chicken (handoff section 4): the hint. When the player has been looking for the safe room for a long time,
// Prof. Picione's Barred Rock rooster (made in Blender for this game, art/scripts/birds.py) turns up in the hallway of
// the right floor and struts to the right door, then pecks at its threshold until the player gets there.
// If the player is on that floor he starts just out of their view, a few metres away; otherwise he starts at the
// hallway end on their side. He goes dark with the lights like everything else and never blocks the way.

import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const SPEED = 1.3; // metres a second, a hurried strut (the player walks at 1.7)
const LANE = 1.65; // he walks down the hallway clear of the machines along its front wall (z = 0)
const EYE = 1.62;

export function createRooster( scene, W ) {

	const holder = new THREE.Group();
	holder.visible = false;
	scene.add( holder );
	let mixer = null, now = null, path = [], t = 0, yaw = 0, want = 0;
	const act = {}, face = new THREE.Vector3(), fwd = new THREE.Vector3();

	new GLTFLoader().loadAsync( './models/chicken.glb' ).then( gltf => {

		const m = gltf.scene;
		m.traverse( o => { if ( o.isMesh ) { o.castShadow = o.receiveShadow = true; o.frustumCulled = false; o.material = W.zoneMaterial( o.material ); } } );
		holder.add( m );
		mixer = new THREE.AnimationMixer( m );
		for ( const c of gltf.animations ) act[ c.name ] = mixer.clipAction( c );
		if ( act.Walk ) act.Walk.timeScale = 2.4; // the walk cycle sped up to his pace

	} ).catch( e => console.warn( 'The chicken did not load; the hint stays text only.', e ) );

	function play( name, fade = 0.25 ) {

		const a = act[ name ];
		if ( ! a || a === now ) return;
		a.reset().play();
		if ( now ) now.crossFadeTo( a, fade, false );
		now = a;

	}

	// send him to the door of room sym; from = the player's eye position. Returns 'near' (he starts on the player's
	// floor), 'far', or null if the model is not there.
	function lead( sym, from, camera ) {

		if ( ! mixer ) return null;
		const r = W.room( sym ), y = r.y, xEnd = W.hallEnds[ r.e.period ];
		const clampX = x => THREE.MathUtils.clamp( x, 1, xEnd - 1 );
		const px = clampX( from.x );
		const near = Math.abs( from.y - EYE - y ) < 2;
		let sx;
		if ( near ) {

			// of two spots four metres either side of the player, the one they are not looking at
			camera.getWorldDirection( fwd );
			const a = clampX( px - 4 ), b = clampX( px + 4 );
			sx = Math.sign( a - px ) * fwd.x < Math.sign( b - px ) * fwd.x ? a : b;

		} else sx = r.cx > px ? 1 : xEnd - 1;

		const dir = Math.sign( r.cx - sx ) || 1;
		path = [ new THREE.Vector3( r.cx - dir * 0.75, y, LANE ), new THREE.Vector3( r.cx - dir * 0.7, y, 0.55 ) ];
		face.set( r.cx, y, - 0.5 ); // the doorway
		holder.position.set( sx, y, LANE );
		yaw = want = Math.atan2( dir, 0 );
		holder.rotation.y = yaw;
		holder.visible = true;
		play( 'Walk', 0 );
		return near ? 'near' : 'far';

	}

	function hide() {

		holder.visible = false;
		path = [];

	}

	function update( dt ) {

		if ( ! mixer || ! holder.visible ) return;
		mixer.update( dt );
		if ( path.length ) {

			const p = path[ 0 ], dx = p.x - holder.position.x, dz = p.z - holder.position.z, d = Math.hypot( dx, dz ), step = SPEED * dt;
			if ( d <= step ) { holder.position.x = p.x; holder.position.z = p.z; path.shift(); } else { holder.position.x += dx / d * step; holder.position.z += dz / d * step; want = Math.atan2( dx, dz ); }
			if ( ! path.length ) { want = Math.atan2( face.x - holder.position.x, face.z - holder.position.z ); play( 'Idle' ); t = 1; }

		} else if ( ( t -= dt ) < 0 ) { // at the door: peck at the threshold, look about, peck again

			if ( now === act.Peck ) { play( 'Idle' ); t = 2 + Math.random() * 3; } else { play( 'Peck', 0.15 ); t = act.Peck ? act.Peck.getClip().duration : 2; }

		}

		const turn = Math.atan2( Math.sin( want - yaw ), Math.cos( want - yaw ) );
		yaw += turn * Math.min( 1, dt * 8 );
		holder.rotation.y = yaw;

	}

	return { lead, hide, update, object: holder };

}
