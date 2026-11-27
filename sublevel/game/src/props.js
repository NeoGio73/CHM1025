// Props: the wall phones, the desks in the safe rooms, the goat and the exit door.
// Art pass (build step 5): the phone, the desk with its chair and the exit door are models made in Blender
// (art/props.blend, exported to public/models/*.glb; no outside assets). Each place gets a simple block until its
// model has loaded. The goat is still a block (it waits for Prof. Picione's photos).

import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function buildProps( scene, B, { phoneRooms, safeRooms, exitRoom } ) {

	// every prop goes dark with the room it stands in (B.zoneMaterial), like the walls
	const mat = ( color, o = {} ) => B.zoneMaterial( new THREE.MeshStandardNodeMaterial( { color, roughness: 0.6, ...o } ) );

	const group = new THREE.Group();
	scene.add( group );
	const add = ( geo, m, x, y, z, parent = group ) => { const o = new THREE.Mesh( geo, m ); o.position.set( x, y, z ); o.castShadow = o.receiveShadow = true; parent.add( o ); return o; };

	// load a model once and put a copy in every holder, in place of its stand-in block; the model's materials
	// are turned into darkening ones once and shared by every copy. own( mesh ) may give a mesh its own material.
	const loader = new GLTFLoader();
	function placeModel( url, spots, own = () => null ) {

		return loader.loadAsync( url ).then( gltf => {

			const shared = new Map();
			for ( const s of spots ) {

				const m = gltf.scene.clone();
				m.traverse( o => {

					if ( ! o.isMesh ) return;
					o.castShadow = o.receiveShadow = true;
					const mine = own( o, s );
					if ( mine ) { o.material = mine; return; }
					if ( ! shared.has( o.material.name ) ) shared.set( o.material.name, B.zoneMaterial( o.material ) );
					o.material = shared.get( o.material.name );

				} );
				s.holder.add( m );
				if ( s.stand ) s.holder.remove( s.stand );
				s.model = m;

			}

		} ).catch( e => console.warn( `${ url } did not load; the stand-in stays.`, e ) );

	}

	// ---- wall phones: on the west wall of the room, just inside the door, with a lamp that blinks while it rings.
	// The model faces +z with its back plate at z = 0.
	const phones = {};
	const phoneSpots = [];
	for ( const sym of phoneRooms ) {

		const r = B.room( sym );
		const x = r.x0 + 0.001, y = r.y + 1.35, z = - 1.1;
		const holder = new THREE.Group();
		holder.position.set( x, y, z ); holder.rotation.y = Math.PI / 2; // facing into the room (+x)
		group.add( holder );
		const stand = add( new THREE.BoxGeometry( 0.18, 0.26, 0.06 ), mat( 0xa8a089 ), 0, 0, 0.03, holder );
		const lampMat = mat( 0x3a1c18, { roughness: 0.25 } ); // one per phone: each lamp blinks on its own
		phoneSpots.push( { holder, stand, lampMat } );
		phones[ sym ] = { at: new THREE.Vector3( r.x0 + 0.55, r.y, z ), face: new THREE.Vector3( x + 0.06, y, z ), lampMat };

	}

	placeModel( './models/phone.glb', phoneSpots, ( o, s ) => o.material.name === 'Lamp' ? s.lampMat : null );

	function setRinging( sym, on, t = 0 ) {

		const p = phones[ sym ];
		if ( ! p ) return;
		const blink = on && ( t % 1.2 ) < 0.6;
		p.lampMat.emissive.setHex( blink ? 0xff3a20 : 0x000000 );
		p.lampMat.emissiveIntensity = blink ? 4 : 0;

	}

	// ---- a steel desk and a chair in each safe room, against the east wall (the goat stands on the desk).
	// The model's desk is 1.5 m wide and 0.8 m deep, its top at 0.745 m, the chair in front of it; it faces +z.
	const desks = {}, blockers = [], deskSpots = [];
	for ( const sym of safeRooms ) {

		const r = B.room( sym );
		const side = r.x1 - r.x0, x = r.x1 - 0.75, z = - side * 0.5, y = r.y;
		const holder = new THREE.Group();
		holder.position.set( x, y, z ); holder.rotation.y = - Math.PI / 2; // the drawers and the chair face the room (-x)
		group.add( holder );
		const stand = add( new THREE.BoxGeometry( 1.5, 0.745, 0.8 ), mat( 0x7d7a70 ), 0, 0.3725, 0, holder );
		deskSpots.push( { holder, stand } );
		desks[ sym ] = new THREE.Vector3( x, y + 0.745, z );
		// the desk and the chair in front of it
		blockers.push( { x0: x - 1.2, x1: x + 0.4 + 0.25, z0: z - 0.75 - 0.25, z1: z + 0.75 + 0.25, y } );

	}

	placeModel( './models/desk.glb', deskSpots );

	// ---- the goat: a block placeholder (no CC0 goat model yet), off-white, facing the door (+z)
	const goat = new THREE.Group();
	const white = mat( 0xe9e4d8, { roughness: 0.9 } ), grey = mat( 0x6d6a64, { roughness: 0.8 } ), horn = mat( 0x9b8f78 );
	add( new THREE.BoxGeometry( 0.3, 0.32, 0.7 ), white, 0, 0.58, 0, goat ); // body
	for ( const [ lx, lz ] of [ [ - 0.1, - 0.27 ], [ 0.1, - 0.27 ], [ - 0.1, 0.27 ], [ 0.1, 0.27 ] ] ) add( new THREE.BoxGeometry( 0.07, 0.42, 0.07 ), white, lx, 0.21, lz, goat );
	add( new THREE.BoxGeometry( 0.13, 0.28, 0.13 ), white, 0, 0.82, 0.35, goat ); // neck
	add( new THREE.BoxGeometry( 0.17, 0.17, 0.27 ), white, 0, 0.98, 0.46, goat ); // head
	add( new THREE.BoxGeometry( 0.07, 0.07, 0.05 ), grey, 0, 0.95, 0.6, goat ); // nose
	for ( const s of [ - 1, 1 ] ) {

		add( new THREE.BoxGeometry( 0.03, 0.16, 0.03 ), horn, s * 0.05, 1.12, 0.4, goat ).rotation.x = - 0.5;
		add( new THREE.BoxGeometry( 0.12, 0.04, 0.05 ), white, s * 0.13, 1.0, 0.42, goat ); // ears

	}

	add( new THREE.BoxGeometry( 0.04, 0.1, 0.04 ), grey, 0, 0.88, 0.58, goat ); // beard
	add( new THREE.BoxGeometry( 0.05, 0.12, 0.05 ), white, 0, 0.78, - 0.36, goat ).rotation.x = - 0.6; // tail
	group.add( goat );
	const goatAt = sym => { const d = desks[ sym ]; if ( d ) { goat.position.copy( d ); goat.rotation.y = 0; goat.visible = true; } };

	// ---- the exit: a steel door with a push bar in the back wall of the largest room. The building leaves a doorway
	// there with a bright space behind it; at the end the door swings open onto it, away from the player.
	const er = B.room( exitRoom );
	const ecx = er.cx, ez = er.z0;
	const doorHolder = new THREE.Group();
	doorHolder.position.set( ecx, er.y, ez );
	group.add( doorHolder );
	const doorSpot = { holder: doorHolder, stand: add( new THREE.BoxGeometry( 1.2, 2.15, 0.05 ), mat( 0x3f4943 ), 0, 1.075, 0, doorHolder ) };
	let leaf = null, openT = 0, opening = false;
	placeModel( './models/door.glb', [ doorSpot ] ).then( () => { leaf = doorSpot.model?.getObjectByName( 'DoorLeaf' ) || null; } );

	const c = document.createElement( 'canvas' ); c.width = 256; c.height = 96;
	const g = c.getContext( '2d' );
	g.fillStyle = '#0e3b1f'; g.fillRect( 0, 0, 256, 96 ); g.fillStyle = '#6dff9c'; g.font = '700 64px Arial, sans-serif'; g.textAlign = 'center'; g.fillText( 'EXIT', 128, 72 );
	const signTex = new THREE.CanvasTexture( c ); signTex.colorSpace = THREE.SRGBColorSpace;
	add( new THREE.PlaneGeometry( 0.5, 0.19 ), new THREE.MeshStandardMaterial( { map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 1.5 } ), ecx, er.y + 2.45, ez + 0.02 );
	const exit = {
		at: new THREE.Vector3( ecx, er.y, er.z0 + 1.0 ),
		face: new THREE.Vector3( ecx, er.y + 1.2, ez ),
		open() { opening = true; }
	};

	function update( dt ) {

		if ( ! opening || openT >= 1 ) return;
		openT = Math.min( 1, openT + dt / 1.8 );
		const k = openT * openT * ( 3 - 2 * openT );
		if ( leaf ) leaf.rotation.y = 1.65 * k; // swings out, into the bright space
		else if ( doorSpot.stand ) doorSpot.stand.visible = openT < 0.5;

	}

	return { phones, setRinging, desks, blockers, goat, goatAt, exit, update };

}
