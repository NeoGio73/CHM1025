// Step 3 placeholder props, made in code: the wall phones, the desks in the safe rooms, the goat, the exit door.
// The art pass (build step 5) replaces the phone, desk and goat with real models.

import * as THREE from 'three/webgpu';

export function buildProps( scene, B, { phoneRooms, safeRooms, exitRoom } ) {

	// every prop goes dark with the room it stands in (B.zoneMaterial), like the walls
	const mat = ( color, o = {} ) => B.zoneMaterial( new THREE.MeshStandardNodeMaterial( { color, roughness: 0.6, ...o } ) );

	const group = new THREE.Group();
	scene.add( group );
	const add = ( geo, m, x, y, z, parent = group ) => { const o = new THREE.Mesh( geo, m ); o.position.set( x, y, z ); o.castShadow = o.receiveShadow = true; parent.add( o ); return o; };

	// ---- wall phones: on the west wall of the room, just inside the door, with a lamp that blinks while it rings
	const phoneBody = mat( 0xcfc8b4 ), phoneDark = mat( 0x2a2c2e );
	const phones = {};
	for ( const sym of phoneRooms ) {

		const r = B.room( sym );
		const x = r.x0 + 0.05, y = r.y + 1.35, z = - 1.1;
		add( new THREE.BoxGeometry( 0.1, 0.3, 0.2 ), phoneBody, x, y, z );
		add( new THREE.BoxGeometry( 0.07, 0.24, 0.06 ), phoneDark, x + 0.07, y + 0.01, z - 0.04 ); // handset
		const lampMat = mat( 0x3a1c18 ); // one per phone: each lamp blinks on its own
		add( new THREE.SphereGeometry( 0.018, 10, 8 ), lampMat, x + 0.055, y + 0.12, z + 0.07 );
		phones[ sym ] = { at: new THREE.Vector3( r.x0 + 0.55, r.y, z ), face: new THREE.Vector3( x, y, z ), lampMat };

	}

	function setRinging( sym, on, t = 0 ) {

		const p = phones[ sym ];
		if ( ! p ) return;
		const blink = on && ( t % 1.2 ) < 0.6;
		p.lampMat.emissive.setHex( blink ? 0xff3a20 : 0x000000 );
		p.lampMat.emissiveIntensity = blink ? 4 : 0;

	}

	// ---- desks in the safe rooms (the goat stands on the furniture at a checkpoint)
	const deskMat = mat( 0x8a7760, { roughness: 0.7 } ), legMat = mat( 0x3b3d40, { metalness: 0.4, roughness: 0.5 } );
	const desks = {}, blockers = [];
	for ( const sym of safeRooms ) {

		const r = B.room( sym );
		const side = r.x1 - r.x0, x = r.x1 - 0.75, z = - side * 0.5, y = r.y;
		add( new THREE.BoxGeometry( 0.8, 0.05, 1.5 ), deskMat, x, y + 0.72, z );
		for ( const [ dx, dz ] of [ [ - 0.35, - 0.68 ], [ 0.35, - 0.68 ], [ - 0.35, 0.68 ], [ 0.35, 0.68 ] ] ) add( new THREE.BoxGeometry( 0.04, 0.7, 0.04 ), legMat, x + dx, y + 0.35, z + dz );
		desks[ sym ] = new THREE.Vector3( x, y + 0.745, z );
		blockers.push( { x0: x - 0.4 - 0.25, x1: x + 0.4 + 0.25, z0: z - 0.75 - 0.25, z1: z + 0.75 + 0.25, y } );

	}

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

	// ---- the exit: a door in the back wall of the largest room, closed until the last work order is done
	const er = B.room( exitRoom );
	const ecx = er.cx, ez = er.z0 + 0.012;
	const doorMat = mat( 0x4b5650, { roughness: 0.5, metalness: 0.3 } );
	const door = add( new THREE.PlaneGeometry( 1.2, 2.15 ), doorMat, ecx, er.y + 1.075, ez );
	const frame = mat( 0x2c2f31 );
	add( new THREE.BoxGeometry( 1.34, 0.07, 0.06 ), frame, ecx, er.y + 2.18, ez );
	for ( const s of [ - 1, 1 ] ) add( new THREE.BoxGeometry( 0.07, 2.18, 0.06 ), frame, ecx + s * 0.635, er.y + 1.09, ez );
	const c = document.createElement( 'canvas' ); c.width = 256; c.height = 96;
	const g = c.getContext( '2d' );
	g.fillStyle = '#0e3b1f'; g.fillRect( 0, 0, 256, 96 ); g.fillStyle = '#6dff9c'; g.font = '700 64px Arial, sans-serif'; g.textAlign = 'center'; g.fillText( 'EXIT', 128, 72 );
	const signTex = new THREE.CanvasTexture( c ); signTex.colorSpace = THREE.SRGBColorSpace;
	add( new THREE.PlaneGeometry( 0.5, 0.19 ), new THREE.MeshStandardMaterial( { map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 1.5 } ), ecx, er.y + 2.45, ez + 0.01 );
	const exit = {
		at: new THREE.Vector3( ecx, er.y, er.z0 + 1.0 ),
		face: new THREE.Vector3( ecx, er.y + 1.2, ez ),
		open() { doorMat.color.setHex( 0xffffff ); doorMat.emissive.setHex( 0xfff6e6 ); doorMat.emissiveIntensity = 3; doorMat.metalness = 0; }
	};

	return { phones, setRinging, desks, blockers, goat, goatAt, exit };

}
