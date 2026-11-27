// A bird made for this game (art/scripts/birds.py): the rooster or the goose. It loads its model, plays its clips
// (Idle, Walk and its own: Peck or Honk) and walks a path of points at a set pace. The rooster and the goose build on it.

import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function createBird( scene, W, url, { speed = 1, walkScale = 1 } = {} ) {

	const holder = new THREE.Group();
	holder.visible = false;
	scene.add( holder );
	let mixer = null, now = null, path = [], yaw = 0, want = 0, pace = speed, arrived = null;
	const act = {};

	const ready = new GLTFLoader().loadAsync( url ).then( gltf => {

		const m = gltf.scene;
		m.traverse( o => { if ( o.isMesh ) { o.castShadow = o.receiveShadow = true; o.frustumCulled = false; o.material = W.zoneMaterial( o.material ); } } );
		holder.add( m );
		mixer = new THREE.AnimationMixer( m );
		for ( const c of gltf.animations ) act[ c.name ] = mixer.clipAction( c );
		if ( act.Walk ) act.Walk.timeScale = walkScale;
		return true;

	} ).catch( e => { console.warn( `${ url } did not load.`, e ); return false; } );

	function play( name, fade = 0.25 ) {

		const a = act[ name ];
		if ( ! a || a === now ) return;
		a.reset().play();
		if ( now ) now.crossFadeTo( a, fade, false );
		now = a;

	}

	// stand at (x, y, z) facing yaw (0 = +z), idling
	function show( x, y, z, yawTo = 0 ) {

		holder.position.set( x, y, z );
		yaw = want = yawTo;
		holder.rotation.y = yaw;
		holder.visible = true;
		path = []; arrived = null;
		play( 'Idle', 0 );

	}

	function hide() { holder.visible = false; path = []; arrived = null; }

	// walk through the points (Vector3s; y is taken from them), then call done() (or face the point face, if given)
	function goTo( points, { done = null, face = null, pace: p = speed } = {} ) {

		path = points.map( v => v.clone() );
		pace = p;
		arrived = () => { if ( face ) want = Math.atan2( face.x - holder.position.x, face.z - holder.position.z ); play( 'Idle' ); done?.(); };
		play( 'Walk', 0.2 );

	}

	function face( x, z ) { want = Math.atan2( x - holder.position.x, z - holder.position.z ); }

	function update( dt ) {

		if ( ! mixer || ! holder.visible ) return;
		mixer.update( dt );
		if ( path.length ) {

			const p = path[ 0 ], dx = p.x - holder.position.x, dz = p.z - holder.position.z, d = Math.hypot( dx, dz ), step = pace * dt;
			if ( d <= step ) { holder.position.set( p.x, p.y, p.z ); path.shift(); } else { holder.position.x += dx / d * step; holder.position.z += dz / d * step; holder.position.y = p.y; want = Math.atan2( dx, dz ); }
			if ( ! path.length ) { const a = arrived; arrived = null; a?.(); }

		}

		const turn = Math.atan2( Math.sin( want - yaw ), Math.cos( want - yaw ) );
		yaw += turn * Math.min( 1, dt * 8 );
		holder.rotation.y = yaw;

	}

	return {
		ready, play, show, hide, goTo, face, update, object: holder,
		get loaded() { return !! mixer; }, get walking() { return path.length > 0; }, get current() { return now; }, act
	};

}
