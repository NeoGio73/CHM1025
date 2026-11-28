// Props: the wall phones, the desks in the safe rooms, the goat, the exit door, and the set dressing (vending
// machines, water coolers, wet-floor signs; handoff section 3).
// Art pass (build step 5): the phone, the desk with its chair and the exit door are models made in Blender
// (art/props.blend, exported to public/models/*.glb; no outside assets). Each place gets a simple block until its
// model has loaded. The goat is Prof. Picione's own goat, made from a CC0 deer (see the goat below and ../CREDITS.md).

import * as THREE from 'three/webgpu';
import { ASSETS } from './config.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { colCentre, floorY, HALL_W } from './building.js';

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

	placeModel( ASSETS + 'models/phone.glb', phoneSpots, ( o, s ) => o.material.name === 'Lamp' ? s.lampMat : null );

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

	placeModel( ASSETS + 'models/desk.glb', deskSpots );

	// ---- the goat: Prof. Picione's goat (art/scripts/goat.py: Quaternius's CC0 deer reshaped after the farm photos),
	// standing on the desk along its length, facing the door (+z). One goat, moved to whichever desk the run needs.
	// A block goat stands in until the model has loaded.
	const goat = new THREE.Group();
	const goatStand = new THREE.Group();
	const white = mat( 0xe9e4d8, { roughness: 0.9 } ), grey = mat( 0x6d6a64, { roughness: 0.8 } );
	add( new THREE.BoxGeometry( 0.26, 0.28, 0.55 ), white, 0, 0.42, 0, goatStand ); // body
	for ( const [ lx, lz ] of [ [ - 0.08, - 0.2 ], [ 0.08, - 0.2 ], [ - 0.08, 0.2 ], [ 0.08, 0.2 ] ] ) add( new THREE.BoxGeometry( 0.06, 0.3, 0.06 ), white, lx, 0.15, lz, goatStand );
	add( new THREE.BoxGeometry( 0.14, 0.15, 0.24 ), white, 0, 0.66, 0.34, goatStand ); // head
	add( new THREE.BoxGeometry( 0.04, 0.1, 0.04 ), grey, 0, 0.55, 0.42, goatStand ); // beard
	goat.add( goatStand );
	group.add( goat );
	const goatAt = sym => { const d = desks[ sym ]; if ( d ) { goat.position.copy( d ); goat.rotation.y = 0; goat.visible = true; } };
	// it stands, now and then changes its weight or lowers its head (the deer's Idle, Idle_2 and Idle_Headlow)
	let goatMixer = null, goatIdles = [], goatNow = null, goatT = 6, goatScripted = false;
	const goatAct = {};
	loader.loadAsync( ASSETS + 'models/goat.glb' ).then( gltf => {

		const m = gltf.scene;
		m.traverse( o => { if ( o.isMesh ) { o.castShadow = o.receiveShadow = true; o.frustumCulled = false; o.material = B.zoneMaterial( o.material ); } } );
		goat.add( m );
		goat.remove( goatStand );
		goatMixer = new THREE.AnimationMixer( m );
		for ( const c of gltf.animations ) goatAct[ c.name ] = goatMixer.clipAction( c );
		goatIdles = [ 'Idle', 'Idle_2', 'Idle_Headlow' ].map( n => goatAct[ n ] ).filter( Boolean );
		goatNow = goatIdles[ 0 ];
		goatNow?.play();

	} ).catch( e => console.warn( 'models/goat.glb did not load; the block goat stays.', e ) );

	function updateGoat( dt ) {

		if ( ! goatMixer || ! goat.visible ) return;
		goatMixer.update( dt );
		if ( goatScripted ) return;
		goatT -= dt;
		if ( goatT < 0 && goatIdles.length > 1 ) {

			const next = goatNow === goatIdles[ 0 ] ? goatIdles[ 1 + Math.floor( Math.random() * ( goatIdles.length - 1 ) ) ] : goatIdles[ 0 ];
			next.reset().play();
			goatNow.crossFadeTo( next, 0.8, false );
			goatNow = next;
			goatT = next === goatIdles[ 0 ] ? 6 + Math.random() * 6 : 4 + Math.random() * 2;

		}

	}

	// ---- the exit: a steel door with a push bar in the back wall of the largest room. The building leaves a doorway
	// there with a bright space behind it; at the end the door swings open onto it, away from the player.
	const er = B.room( exitRoom );
	const ecx = er.cx, ez = er.z0;
	const doorHolder = new THREE.Group();
	doorHolder.position.set( ecx, er.y, ez );
	group.add( doorHolder );
	const doorSpot = { holder: doorHolder, stand: add( new THREE.BoxGeometry( 1.2, 2.15, 0.05 ), mat( 0x3f4943 ), 0, 1.075, 0, doorHolder ) };
	let leaf = null, openT = 0, opening = false, closing = 0;
	placeModel( ASSETS + 'models/door.glb', [ doorSpot ] ).then( () => { leaf = doorSpot.model?.getObjectByName( 'DoorLeaf' ) || null; } );

	const c = document.createElement( 'canvas' ); c.width = 256; c.height = 96;
	const g = c.getContext( '2d' );
	g.fillStyle = '#0e3b1f'; g.fillRect( 0, 0, 256, 96 ); g.fillStyle = '#6dff9c'; g.font = '700 64px Arial, sans-serif'; g.textAlign = 'center'; g.fillText( 'EXIT', 128, 72 );
	const signTex = new THREE.CanvasTexture( c ); signTex.colorSpace = THREE.SRGBColorSpace;
	add( new THREE.PlaneGeometry( 0.5, 0.19 ), new THREE.MeshStandardMaterial( { map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 1.5 } ), ecx, er.y + 2.45, ez + 0.02 );
	const exit = {
		at: new THREE.Vector3( ecx, er.y, er.z0 + 1.0 ),
		face: new THREE.Vector3( ecx, er.y + 1.2, ez ),
		open() { opening = true; },
		close( seconds = 1.8 ) { opening = false; closing = seconds; } // the ending: it swings shut behind the player
	};

	// the ending moves the goat itself: stop its idling, and play a clip (at a speed)
	function goatScript( on ) { goatScripted = on; }
	function goatPlay( name, fade = 0.3, speed = 1 ) {

		const a = goatAct[ name ];
		if ( ! a || a === goatNow ) return;
		a.timeScale = speed;
		a.reset().play();
		goatNow?.crossFadeTo( a, fade, false );
		goatNow = a;

	}

	function update( dt ) {

		updateGoat( dt );
		if ( closing > 0 ) { openT = Math.max( 0, openT - dt / closing ); if ( openT === 0 ) closing = 0; }
		else if ( ! opening || openT >= 1 ) return;
		else openT = Math.min( 1, openT + dt / 1.8 );
		const k = openT * openT * ( 3 - 2 * openT );
		if ( leaf ) leaf.rotation.y = 1.65 * k; // swings out, into the bright space
		else if ( doorSpot.stand ) doorSpot.stand.visible = openT < 0.5;

	}

	// ---- set dressing (handoff section 3): vending machines and water coolers against the hallways' front wall,
	// in the long empty stretches (between doors, so they never narrow a doorway), water coolers in a few offices,
	// and wet-floor signs in the pool rooms and at both ends of the flooded corridor. Models made in Blender
	// (art/props.blend); their labels and the sign faces are drawn here.
	// a place for one model; half = its half size in x and z around (x, z), which blocks walking (with 0.25 m to spare)
	const spot = ( list, x, y, z, ry, half, cz = z ) => {

		const holder = new THREE.Group();
		holder.position.set( x, y, z ); holder.rotation.y = ry;
		group.add( holder );
		list.push( { holder } );
		blockers.push( { x0: x - half[ 0 ] - 0.25, x1: x + half[ 0 ] + 0.25, z0: cz - half[ 1 ] - 0.25, z1: cz + half[ 1 ] + 0.25, y } );

	};

	const vendSpots = [], coolerSpots = [], signSpots = [];
	// against the hallway's front wall (z = HALL_W), facing into the hallway; x is a column boundary, far from any door
	const edge = g => colCentre( g ) + 6.5;
	// vending machine: 0.92 m wide, 0.82 m deep; water cooler with its cup holder: about 0.6 m wide, 0.41 m deep
	for ( const [ p, x ] of [ [ 1, edge( 6 ) ], [ 2, edge( 7 ) - 0.5 ], [ 2, edge( 7 ) + 0.5 ], [ 3, edge( 5 ) ], [ 4, edge( 4 ) ] ] ) spot( vendSpots, x, floorY( p ), HALL_W, Math.PI, [ 0.46, 0.41 ], HALL_W - 0.41 );
	for ( const [ p, x ] of [ [ 1, edge( 6 ) + 0.85 ], [ 2, edge( 7 ) + 1.3 ], [ 3, edge( 10 ) ] ] ) spot( coolerSpots, x, floorY( p ), HALL_W, Math.PI, [ 0.3, 0.2 ], HALL_W - 0.2 );
	// water coolers in the back left corner of a few offices, facing the room
	for ( const sym of [ 'Be', 'Na', 'Ca' ] ) { const r = B.room( sym ); spot( coolerSpots, r.x0 + 0.55, r.y, r.z0, 0, [ 0.3, 0.2 ], r.z0 + 0.2 ); }
	// wet-floor signs: just inside each pool room, right of the door; and at both ends of the flooded corridor
	for ( const r of B.rooms ) if ( r.kind === 'pool' ) spot( signSpots, r.cx + 0.95, r.y, - 0.7, - 0.5 + ( r.e.z % 5 ) * 0.2, [ 0.18, 0.18 ] );
	if ( B.flood ) {

		const F = B.flood, fy = floorY( F.p );
		spot( signSpots, F.x0 - 0.7, fy, 0.75, 0.4 + Math.PI / 2, [ 0.18, 0.18 ] );
		spot( signSpots, F.x1 + 0.7, fy, HALL_W - 0.75, - 0.3 - Math.PI / 2, [ 0.18, 0.18 ] );

	}

	// drawn faces: the vending machine's lit shelves and header, the sign's caution face
	const canvasTex = ( w, h, draw ) => {

		const c = document.createElement( 'canvas' ); c.width = w; c.height = h;
		draw( c.getContext( '2d' ), w, h );
		const t = new THREE.CanvasTexture( c ); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
		t.flipY = false; // glTF texture coordinates run top to bottom
		return t;

	};

	const shelves = canvasTex( 256, 460, ( g, w, h ) => {

		g.fillStyle = '#20262b'; g.fillRect( 0, 0, w, h );
		const cols = [ '#c8372d', '#e0892b', '#e8c43a', '#3c8d4a', '#2f6fb3', '#7a3f9a', '#d9d4c8', '#a0522d' ];
		let k = 7;
		const rnd = () => ( k = ( k * 9301 + 49297 ) % 233280 ) / 233280;
		for ( let row = 0; row < 5; row ++ ) {

			const yb = h - ( 0.06 + row * ( 1 - 0.08 / 1.06 ) / 5 ) * h - 6; // just above each shelf lip
			for ( let i = 0; i < 5; i ++ ) {

				const x = 10 + i * 48, pw = 36, ph = 50 + rnd() * 18;
				g.fillStyle = cols[ Math.floor( rnd() * cols.length ) ];
				g.beginPath(); g.roundRect( x, yb - ph, pw, ph, [ 6, 6, 2, 2 ] ); g.fill();
				g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect( x + 5, yb - ph + 8, pw - 10, 8 );
				g.fillStyle = '#e9e4d6'; g.font = '600 11px Arial, sans-serif'; g.textAlign = 'center';
				g.fillText( String.fromCharCode( 69 - row ) + ( i + 1 ), x + pw / 2, yb + 4 );

			}

		}

		const gr = g.createLinearGradient( 0, 0, 0, h ); gr.addColorStop( 0, 'rgba(255,250,235,0.18)' ); gr.addColorStop( 1, 'rgba(0,0,0,0.15)' );
		g.fillStyle = gr; g.fillRect( 0, 0, w, h );

	} );
	const header = canvasTex( 512, 92, ( g, w, h ) => {

		const gr = g.createLinearGradient( 0, 0, 0, h ); gr.addColorStop( 0, '#6a4426' ); gr.addColorStop( 1, '#3e2614' );
		g.fillStyle = gr; g.fillRect( 0, 0, w, h );
		g.fillStyle = '#f1e2c2'; g.font = 'italic 600 50px Georgia, serif'; g.textAlign = 'center'; g.fillText( 'Refreshments', w / 2, 63 );

	} );
	const signFace = canvasTex( 256, 492, ( g, w, h ) => {

		g.fillStyle = '#e9b41c'; g.fillRect( 0, 0, w, h );
		g.fillStyle = '#141414'; g.textAlign = 'center';
		g.font = '800 46px Arial, sans-serif'; g.fillText( 'CAUTION', w / 2, 70 );
		// a warning triangle with a figure slipping
		g.lineWidth = 12; g.strokeStyle = '#141414'; g.lineJoin = 'round';
		g.beginPath(); g.moveTo( w / 2, 110 ); g.lineTo( w - 30, 330 ); g.lineTo( 30, 330 ); g.closePath(); g.stroke();
		g.lineWidth = 11; g.lineCap = 'round';
		g.beginPath(); g.arc( 150, 185, 15, 0, Math.PI * 2 ); g.fill();
		g.beginPath(); g.moveTo( 140, 205 ); g.lineTo( 115, 265 ); g.lineTo( 80, 285 ); g.moveTo( 115, 265 ); g.lineTo( 150, 300 ); g.moveTo( 135, 220 ); g.lineTo( 175, 235 ); g.moveTo( 135, 220 ); g.lineTo( 100, 215 ); g.stroke();
		g.beginPath(); g.moveTo( 60, 312 ); g.lineTo( 196, 312 ); g.lineWidth = 6; g.stroke();
		g.font = '800 44px Arial, sans-serif'; g.fillText( 'WET', w / 2, 400 ); g.fillText( 'FLOOR', w / 2, 450 );

	} );

	const lit = ( map, intensity ) => B.zoneMaterial( new THREE.MeshStandardMaterial( { map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: intensity, roughness: 0.6 } ) );
	const dressing = {
		VendInterior: lit( shelves, 0.55 ),
		VendLabel: lit( header, 0.9 ),
		// glass and the cooler's bottle write depth: otherwise ambient occlusion (High, Ultra) draws what is behind them
		VendGlass: B.zoneMaterial( new THREE.MeshStandardMaterial( { color: 0xdfe8ec, roughness: 0.05, transparent: true, opacity: 0.16, depthWrite: true } ) ),
		CoolerBottle: B.zoneMaterial( new THREE.MeshStandardMaterial( { color: 0x7fb3e0, roughness: 0.12, transparent: true, opacity: 0.6, depthWrite: true } ) ),
		SignFace: B.zoneMaterial( new THREE.MeshStandardMaterial( { map: signFace, roughness: 0.45 } ) )
	};
	const dressed = o => dressing[ o.material.name ] || null;
	placeModel( ASSETS + 'models/vending.glb', vendSpots, dressed );
	placeModel( ASSETS + 'models/cooler.glb', coolerSpots, dressed );
	placeModel( ASSETS + 'models/wetsign.glb', signSpots, dressed );

	// ---- easter eggs (handoff section 4, "keep if cheap"), small things made here, each a chemistry pun:
	// eggshells in the calcium room (calcium carbonate; brown, as a Barred Rock lays them) with one of the rooster's
	// barred feathers, a salt lick in the sodium room (the goat's; NaCl), and an iron horseshoe, open end up, in the
	// iron room (the donkey's). They go dark with their rooms and block nothing.
	{

		const ca = B.room( 'Ca' ), na = B.room( 'Na' ), fe = B.room( 'Fe' );
		// two broken halves (the cup of an egg 5.5 cm long) and three bits of shell, in the back right corner
		const shell = mat( 0xc79d72, { roughness: 0.75, side: THREE.DoubleSide } );
		const cup = new THREE.SphereGeometry( 0.021, 12, 8, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.58 );
		const bit = new THREE.CircleGeometry( 0.009, 3 );
		const ex = ca.x1 - 0.55, ez = ca.z0 + 0.5;
		// one cup tipped on its side, one upside down
		for ( const [ dx, dy, dz, rx, rz, ry ] of [ [ 0, 0.024, 0, 0.35, 0.2, 0.6 ], [ 0.09, 0.018, 0.05, 2.2, - 0.4, 2.1 ] ] ) {

			const h = add( cup, shell, ex + dx, ca.y + dy, ez + dz );
			h.scale.set( 1, 1.3, 1 ); h.rotation.set( rx, ry, rz );

		}
		for ( const [ dx, dz, r ] of [ [ - 0.06, 0.08, 0.4 ], [ 0.05, - 0.07, 2.6 ], [ 0.14, 0.11, 4.1 ] ] ) {

			const s = add( bit, shell, ex + dx, ca.y + 0.003, ez + dz );
			s.rotation.set( - Math.PI / 2, 0, r ); s.castShadow = false;

		}
		// the feather: dark and light bars, drawn with its outline (alpha) on a small canvas
		const fc = document.createElement( 'canvas' ); fc.width = 32; fc.height = 128;
		const fg = fc.getContext( '2d' );
		fg.beginPath(); fg.moveTo( 16, 2 ); fg.quadraticCurveTo( 31, 40, 22, 118 ); fg.lineTo( 10, 118 ); fg.quadraticCurveTo( 1, 40, 16, 2 ); fg.clip();
		for ( let y = 0; y < 128; y += 12 ) { fg.fillStyle = '#d4d0c6'; fg.fillRect( 0, y, 32, 6 ); fg.fillStyle = '#222022'; fg.fillRect( 0, y + 6, 32, 6 ); }
		fg.fillStyle = '#e8e4da'; fg.fillRect( 15, 0, 2, 128 ); // the shaft
		const ft = new THREE.CanvasTexture( fc ); ft.colorSpace = THREE.SRGBColorSpace;
		const feather = add( new THREE.PlaneGeometry( 0.042, 0.11 ), B.zoneMaterial( new THREE.MeshStandardMaterial( { map: ft, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 } ) ), ex - 0.16, ca.y + 0.003, ez - 0.05 );
		feather.rotation.set( - Math.PI / 2, 0, 0.9 );
		feather.castShadow = false;

		// the salt lick: a reddish mineral block in a steel holder on the east wall, at a goat's height
		const steel = mat( 0x8d9192, { roughness: 0.45, metalness: 0.6 } );
		const sx = na.x1 - 0.01, sz = ( na.z0 + na.z1 ) / 2, sy = na.y + 0.55;
		add( new THREE.BoxGeometry( 0.012, 0.22, 0.28 ), steel, sx - 0.006, sy + 0.05, sz ); // back plate
		add( new THREE.BoxGeometry( 0.2, 0.012, 0.28 ), steel, sx - 0.1, sy - 0.06, sz ); // tray
		add( new THREE.BoxGeometry( 0.2, 0.08, 0.012 ), steel, sx - 0.1, sy - 0.02, sz - 0.14 ); // its sides
		add( new THREE.BoxGeometry( 0.2, 0.08, 0.012 ), steel, sx - 0.1, sy - 0.02, sz + 0.14 );
		add( new THREE.BoxGeometry( 0.012, 0.05, 0.28 ), steel, sx - 0.2, sy - 0.03, sz ); // front lip
		const lick = add( new RoundedBoxGeometry( 0.17, 0.11, 0.24, 3, 0.02 ), mat( 0x9a5a49, { roughness: 0.95 } ), sx - 0.1, sy + 0.0, sz );
		lick.scale.y = 0.95;

		// the horseshoe: open end up, for luck, on a nail in the back wall of the iron room's bay
		const ARC = Math.PI * 1.42; // the torus runs from angle 0 round to ARC; the rest is the shoe's open end
		const shoeGeo = new THREE.TorusGeometry( 0.055, 0.009, 6, 24, ARC );
		shoeGeo.rotateZ( - Math.PI / 2 - ARC / 2 ); // the middle of the gap to the top
		shoeGeo.scale( 1, 1.15, 0.6 ); // a little taller than wide, like a real shoe, and flat
		add( shoeGeo, mat( 0x4b3f37, { roughness: 0.65, metalness: 0.55 } ), fe.cx - 0.9, fe.y + 1.75, fe.z0 + 0.008 );
		// it hangs from the inside of its bottom curve
		const nail = add( new THREE.CylinderGeometry( 0.004, 0.004, 0.02, 6 ), steel, fe.cx - 0.9, fe.y + 1.75 - 0.049, fe.z0 + 0.01 );
		nail.rotation.x = Math.PI / 2;

	}

	return { phones, setRinging, desks, blockers, goat, goatAt, goatScript, goatPlay, exit, update };

}
