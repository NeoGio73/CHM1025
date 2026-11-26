// Graybox level (build step 2): six station rooms and the corridors between them, as plain boxes.
// The art pass (step 4) replaces these rooms one at a time. Layout runs north along -z:
//
//   vestibule -> 16.1 entry hall (3 barriers) -> 16.2 records vault -> 16.3 monitoring station
//   -> 16.4 anteroom + hot corridor -> 16.5 infirmary -> 16.6 control room (core behind the north wall)

import * as THREE from 'three/webgpu';
import {
	Fn, texture, texture3D, uv, vec3, vec4, float, mix, uniform, time, screenCoordinate,
	positionLocal, positionView, viewportDepthTexture, perspectiveDepthToViewZ, cameraNear, cameraFar, saturate, smoothstep, mx_noise_float, length
} from 'three/tsl';
import { bayer16 } from 'three/addons/tsl/math/Bayer.js';
import * as TX from './textures.js';

export const LAYER_VOL = 10;
export const GLOW_BLUE = new THREE.Color( 0x3f78ff );
const WARM = new THREE.Color( 0xff9a48 );

const WALL_T = 0.2;

export function buildLevel( scene ) {

	const L = {
		statics: [], mats: {}, occluders: [], walkable: [], blockers: [], doors: {}, lights: {},
		interact: [], props: {}, sources: [], hazes: [], rooms: {}, warmLights: [], spawns: {}
	};
	const { mats, statics } = L;

	// ---------------------------------------------------------------- materials (three variants per surface, swapped by tier)

	const T = { wall: TX.wallTextures(), floor: TX.floorTextures(), conc: TX.concreteTextures(), door: TX.doorTextures() };

	function pbr( key, { maps = {}, tile = [ 1, 1 ], color = null, roughness = 1, metalness = 0, normalScale = 1, alphaTest = 0, transparent = false } ) {

		const base = { roughness, metalness, alphaTest, transparent };
		if ( maps.map ) base.map = maps.map; else if ( color ) base.color = new THREE.Color( color );
		if ( maps.roughnessMap ) base.roughnessMap = maps.roughnessMap;
		if ( maps.metalnessMap ) base.metalnessMap = maps.metalnessMap;
		const full = new THREE.MeshStandardNodeMaterial( { ...base, normalMap: maps.normalMap || null, normalScale: new THREE.Vector2( normalScale, normalScale ) } );
		const med = new THREE.MeshStandardNodeMaterial( base );
		const low = new THREE.MeshLambertNodeMaterial( { map: base.map || null, color: base.color || 0xffffff, alphaTest, transparent } );
		for ( const m of [ full, med, low ] ) m.shadowSide = THREE.DoubleSide;
		mats[ key ] = { full, med, low, tile };

	}

	function emissive( key, color, intensity ) {

		const m = new THREE.MeshBasicNodeMaterial();
		const c = new THREE.Color( color );
		const k = uniform( intensity );
		m.colorNode = vec3( c.r, c.g, c.b ).mul( k );
		mats[ key ] = { full: m, med: m, low: m, tile: [ 1, 1 ], level: k };

	}

	pbr( 'wall', { maps: T.wall, tile: [ 4, 3 ], normalScale: 0.9 } );
	pbr( 'floor', { maps: T.floor, tile: [ 3, 3 ], normalScale: 0.7 } );
	pbr( 'conc', { maps: T.conc, tile: [ 3, 3 ], normalScale: 0.8 } );
	pbr( 'door', { maps: T.door, tile: [ 1.2, 2.2 ], normalScale: 0.8 } );
	pbr( 'metal', { color: 0x3b3d3c, roughness: 0.55, metalness: 0.7 } );
	pbr( 'gray', { color: 0x5a5a55, roughness: 0.85 } );
	pbr( 'shelf', { color: 0x46413a, roughness: 0.8 } );
	pbr( 'sheet', { color: 0x9b978a, roughness: 0.9 } );
	pbr( 'lead', { color: 0x2c2f33, roughness: 0.6, metalness: 0.4 } );
	pbr( 'sign', { maps: { map: TX.radiationSignTexture() }, roughness: 0.6 } );
	pbr( 'stripe', { maps: { map: TX.stripeTexture() }, roughness: 0.7, tile: [ 1.2, 1 ] } );
	emissive( 'bulbWarm', 0xffb36b, 30 );
	emissive( 'glowStrip', GLOW_BLUE, 2.6 );
	emissive( 'screenIdle', 0xffc47a, 0.55 );
	emissive( 'screenDone', 0x8fb4ff, 0.7 );
	emissive( 'rodLamp', 0xff7a3a, 1.2 );

	// ---------------------------------------------------------------- mesh helpers

	function addMesh( geo, key, { cast = true, receive = true } = {} ) {

		const mesh = new THREE.Mesh( geo, mats[ key ].full );
		mesh.castShadow = cast; mesh.receiveShadow = receive;
		mesh.userData.matKey = key;
		scene.add( mesh ); statics.push( mesh );
		return mesh;

	}

	// box from min/max with world-space UVs on every face, so textures tile at a constant scale
	function box( min, max, key, { occlude = false, atten = 0.15, group = null, block = false, cast = true } = {} ) {

		const sx = max[ 0 ] - min[ 0 ], sy = max[ 1 ] - min[ 1 ], sz = max[ 2 ] - min[ 2 ];
		const geo = new THREE.BoxGeometry( sx, sy, sz );
		const tile = mats[ key ].tile;
		const pos = geo.attributes.position, nor = geo.attributes.normal, uvA = geo.attributes.uv;
		const cx = ( min[ 0 ] + max[ 0 ] ) / 2, cy = ( min[ 1 ] + max[ 1 ] ) / 2, cz = ( min[ 2 ] + max[ 2 ] ) / 2;
		for ( let i = 0; i < pos.count; i ++ ) {

			const x = pos.getX( i ) + cx, y = pos.getY( i ) + cy, z = pos.getZ( i ) + cz;
			const ax = Math.abs( nor.getX( i ) ), ay = Math.abs( nor.getY( i ) );
			let a, b;
			if ( ax > 0.5 ) { a = z; b = y; } else if ( ay > 0.5 ) { a = x; b = z; } else { a = x; b = y; }
			uvA.setXY( i, a / tile[ 0 ], b / tile[ 1 ] );

		}

		geo.translate( cx, cy, cz );
		const mesh = addMesh( geo, key, { cast } );
		const bounds = { min: new THREE.Vector3( ...min ), max: new THREE.Vector3( ...max ), atten, group };
		if ( occlude ) L.occluders.push( bounds );
		if ( block ) L.blockers.push( { x0: min[ 0 ], x1: max[ 0 ], z0: min[ 2 ], z1: max[ 2 ] } );
		mesh.userData.bounds = bounds;
		return mesh;

	}

	// flat decal/sign plane facing +x/-x/+z/-z
	function plane( w, h, key, pos, face ) {

		const geo = new THREE.PlaneGeometry( w, h );
		const mesh = addMesh( geo, key, { cast: false } );
		mesh.position.copy( pos );
		mesh.rotation.y = { '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': - Math.PI / 2 }[ face ];
		return mesh;

	}

	const signCache = {};
	function sign( text, pos, face, { w = 1.6, h = 0.4, bg = '#1c1d1b', fg = '#d8d1b6', sub = '' } = {} ) {

		const key = 'sign:' + text + '|' + sub + '|' + w + h + bg;
		if ( ! signCache[ key ] ) {

			pbr( key, { maps: { map: signTexture( text, sub, w, h, bg, fg ) }, roughness: 0.7 } );
			signCache[ key ] = true;

		}

		return plane( w, h, key, pos, face );

	}

	// ---------------------------------------------------------------- rooms
	// room( name, x0, x1, zN, zS, h, openings ) : zN < zS. openings: [{ side:'n'|'s'|'e'|'w', at, w }]
	// Walls are boxes with gaps at the openings; floor and ceiling are boxes too.

	function room( name, x0, x1, zN, zS, h, openings = [], { floor = 'floor', wall = 'wall', ceil = 'conc' } = {} ) {

		box( [ x0, - 0.2, zN ], [ x1, 0, zS ], floor, { cast: false } );
		box( [ x0, h, zN ], [ x1, h + 0.2, zS ], ceil, { cast: false } );
		const t = WALL_T;
		const sides = {
			n: { fixed: zN, a0: x0, a1: x1, axis: 'z', out: - 1 },
			s: { fixed: zS, a0: x0, a1: x1, axis: 'z', out: 1 },
			w: { fixed: x0, a0: zN, a1: zS, axis: 'x', out: - 1 },
			e: { fixed: x1, a0: zN, a1: zS, axis: 'x', out: 1 }
		};
		for ( const s in sides ) {

			const S = sides[ s ];
			const gaps = openings.filter( o => o.side === s ).map( o => [ o.at - o.w / 2, o.at + o.w / 2, o.h ?? 2.2 ] ).sort( ( p, q ) => p[ 0 ] - q[ 0 ] );
			let a = S.a0;
			const seg = ( a0, a1, y0, y1 ) => {

				if ( a1 - a0 < 1e-3 ) return;
				const f0 = S.out > 0 ? S.fixed : S.fixed - t, f1 = S.out > 0 ? S.fixed + t : S.fixed;
				if ( S.axis === 'z' ) box( [ a0, y0, f0 ], [ a1, y1, f1 ], wall, { occlude: true } );
				else box( [ f0, y0, a0 ], [ f1, y1, a1 ], wall, { occlude: true } );

			};

			for ( const [ g0, g1, gh ] of gaps ) { seg( a, g0, 0, h ); seg( g0, g1, gh, h ); a = g1; }
			seg( a, S.a1, 0, h );

		}

		L.walkable.push( { x0, x1, z0: zN, z1: zS, name } );
		L.rooms[ name ] = { x0, x1, zN, zS, h };

	}

	// walkable strip through a doorway in a north/south wall (or east/west)
	function passage( side, at, wall, w ) {

		if ( side === 'ns' ) L.walkable.push( { x0: at - w / 2, x1: at + w / 2, z0: wall - 0.7, z1: wall + 0.7 } );
		else L.walkable.push( { x0: wall - 0.7, x1: wall + 0.7, z0: at - w / 2, z1: at + w / 2 } );

	}

	// sliding door in a doorway; closed doors block movement and shield
	function door( id, side, at, wall, { w = 1.4, h = 2.2, label = '', sub = '', face = '+z', atten = 0.5 } = {} ) {

		const g = new THREE.Group();
		const thick = 0.12;
		const geo = side === 'ns' ? new THREE.BoxGeometry( w, h, thick ) : new THREE.BoxGeometry( thick, h, w );
		const tile = mats.door.tile;
		const uvA = geo.attributes.uv; // door texture once per face
		for ( let i = 0; i < uvA.count; i ++ ) uvA.setXY( i, uvA.getX( i ) * w / tile[ 0 ], uvA.getY( i ) * h / tile[ 1 ] );
		const mesh = new THREE.Mesh( geo, mats.door.full );
		mesh.userData.matKey = 'door'; mesh.castShadow = true; mesh.receiveShadow = true;
		statics.push( mesh ); g.add( mesh );
		mesh.position.y = h / 2;
		if ( side === 'ns' ) g.position.set( at, 0, wall ); else g.position.set( wall, 0, at );
		scene.add( g );
		const occ = side === 'ns'
			? { min: new THREE.Vector3( at - w / 2, 0, wall - 0.1 ), max: new THREE.Vector3( at + w / 2, h, wall + 0.1 ), atten }
			: { min: new THREE.Vector3( wall - 0.1, 0, at - w / 2 ), max: new THREE.Vector3( wall + 0.1, h, at + w / 2 ), atten };
		L.occluders.push( occ );
		const blk = side === 'ns'
			? { x0: at - w / 2, x1: at + w / 2, z0: wall - 0.08, z1: wall + 0.08 }
			: { x0: wall - 0.08, x1: wall + 0.08, z0: at - w / 2, z1: at + w / 2 };
		L.blockers.push( blk );
		passage( side, at, wall, w );
		const d = { id, group: g, mesh, open: false, t: 0, h, occ, blk, baseAtten: atten };
		d.setOpen = ( v ) => { d.open = v; occ.atten = v ? 1 : atten; blk.disabled = v; };
		L.doors[ id ] = d;
		if ( label ) {

			const off = side === 'ns' ? new THREE.Vector3( 0, h + 0.32, face === '+z' ? 0.13 : - 0.13 ) : new THREE.Vector3( face === '+x' ? 0.13 : - 0.13, h + 0.32, 0 );
			sign( label, g.position.clone().add( off ), face, { w: Math.min( 1.8, w + 0.2 ), h: 0.36, sub } );

		}

		return d;

	}

	// terminal: a console with a screen; interacting opens a panel (src/stations.js)
	function terminal( id, pos, face, label, { title = label } = {} ) {

		const g = new THREE.Group();
		const body = new THREE.Mesh( new THREE.BoxGeometry( 0.7, 1.05, 0.45 ), mats.metal.full );
		body.userData.matKey = 'metal'; body.castShadow = true; body.receiveShadow = true; statics.push( body );
		body.position.y = 0.525;
		const screen = new THREE.Mesh( new THREE.PlaneGeometry( 0.52, 0.34 ), mats.screenIdle.full );
		screen.userData.matKey = 'screenIdle'; statics.push( screen );
		screen.position.set( 0, 1.2, - 0.02 ); screen.rotation.x = - 0.35;
		const lid = new THREE.Mesh( new THREE.BoxGeometry( 0.62, 0.44, 0.06 ), mats.metal.full );
		lid.userData.matKey = 'metal'; statics.push( lid );
		lid.position.set( 0, 1.2, 0.015 ); lid.rotation.x = - 0.35;
		g.add( body, lid, screen );
		g.position.copy( pos );
		g.rotation.y = { '+z': 0, '-z': Math.PI, '+x': Math.PI / 2, '-x': - Math.PI / 2 }[ face ];
		scene.add( g );
		// the screen faces the group's +z
		screen.position.z = 0.05; lid.position.z = 0.02;
		const fw = new THREE.Vector3( 0, 0, 1 ).applyAxisAngle( new THREE.Vector3( 0, 1, 0 ), g.rotation.y );
		const half = 0.36;
		L.blockers.push( { x0: pos.x - half, x1: pos.x + half, z0: pos.z - half, z1: pos.z + half } );
		const it = { id, kind: 'terminal', pos: pos.clone().add( new THREE.Vector3( 0, 1.15, 0 ) ), label, title, screen, done: false, normal: fw };
		it.setDone = v => { it.done = v; screen.material = v ? mats.screenDone.full : mats.screenIdle.full; screen.userData.matKey = v ? 'screenDone' : 'screenIdle'; };
		L.interact.push( it );
		sign( label, pos.clone().add( new THREE.Vector3( 0, 1.72, 0 ) ).addScaledVector( fw, 0.0 ), face, { w: 1.1, h: 0.26 } );
		return it;

	}

	function point( name, color, intensity, pos, { distance = 0, vol = false, shadow = false, warm = false } = {} ) {

		const l = new THREE.PointLight( color, intensity, distance, 2 );
		l.position.copy( pos );
		if ( vol ) l.layers.enable( LAYER_VOL );
		if ( shadow ) { l.shadow.camera.near = 0.05; l.shadow.camera.far = distance || 14; l.shadow.bias = - 0.002; l.shadow.normalBias = 0.03; }
		l.userData.base = intensity;
		scene.add( l );
		L.lights[ name ] = l;
		if ( warm ) L.warmLights.push( l );
		return l;

	}

	// ceiling lamp: a bulb mesh and a warm light
	function lamp( name, x, y, z, intensity = 6 ) {

		box( [ x - 0.18, y - 0.05, z - 0.18 ], [ x + 0.18, y + 0.02, z + 0.18 ], 'metal', { cast: false } );
		const bulb = new THREE.Mesh( new THREE.SphereGeometry( 0.06, 12, 8 ), mats.bulbWarm.full );
		bulb.userData.matKey = 'bulbWarm'; statics.push( bulb );
		bulb.position.set( x, y - 0.1, z ); scene.add( bulb );
		return point( name, WARM, intensity, new THREE.Vector3( x, y - 0.25, z ), { vol: true, warm: true, distance: 14 } );

	}

	// ================================================================ the layout

	// --- vestibule (start)
	room( 'vestibule', - 2, 2, - 4, 0, 3, [ { side: 'n', at: 0, w: 1.4 } ] );
	lamp( 'lampVest', 0, 3, - 2, 5 );
	sign( 'SEALED BY ORDER', new THREE.Vector3( 0, 2.3, - 0.12 ), '-z', { w: 1.8, h: 0.4, sub: 'radiation safety inspection only' } );
	L.spawns[ 1 ] = { pos: new THREE.Vector3( 0, 1.65, - 1.2 ), yaw: 0 };

	// --- station 1: entry hall, 16.1 (three barriers across the hall)
	room( 'hall', - 1.5, 1.5, - 28, - 4, 3, [ { side: 's', at: 0, w: 1.4 }, { side: 'n', at: 0, w: 1.4 } ] );
	passage( 'ns', 0, - 4, 1.4 );
	sign( '16.1  ENTRY HALL', new THREE.Vector3( - 1.49 + 0.01, 2.35, - 5.5 ), '+x', { w: 1.6, h: 0.36 } );
	lamp( 'lampHall', 0, 3, - 13, 6 );
	lamp( 'lampHall2', 0, 3, - 25, 3 );
	const BARRIERS = [ - 10, - 16, - 22 ];
	BARRIERS.forEach( ( z, i ) => {

		// partition wall with a door
		box( [ - 1.5, 0, z - 0.1 ], [ - 0.7, 3, z + 0.1 ], 'wall', { occlude: true, atten: 0.3, block: true } );
		box( [ 0.7, 0, z - 0.1 ], [ 1.5, 3, z + 0.1 ], 'wall', { occlude: true, atten: 0.3, block: true } );
		box( [ - 0.7, 2.2, z - 0.1 ], [ 0.7, 3, z + 0.1 ], 'wall', { occlude: true, atten: 0.3 } );
		door( 'barrier' + i, 'ns', 0, z, { w: 1.4, label: [ 'ALPHA SOURCE', 'BETA SOURCE', 'GAMMA SOURCE' ][ i ], sub: 'protection required to pass', face: '+z' } );
		// the leaking source: a container in a recess on the right
		box( [ 1.05, 0, z + 0.5 ], [ 1.5, 0.9, z + 1.3 ], 'lead', { block: true } );
		plane( 0.4, 0.4, 'sign', new THREE.Vector3( 1.04, 0.62, z + 0.9 ), '-x' );
		L.props[ 'src' + i ] = new THREE.Vector3( 1.28, 0.7, z + 0.9 );
		// protection locker on the left
		L.props[ 'locker' + i ] = terminal( 'locker' + i, new THREE.Vector3( - 1.12, 0, z + 1.2 ), '+x', 'PROTECTION LOCKER' );

	} );
	L.props.symbolChart = terminal( 'symbols', new THREE.Vector3( 1.12, 0, - 6.4 ), '-x', 'RADIATION ID CHART' );

	// --- station 2: records vault, 16.2
	room( 'vault', - 5, 5, - 38, - 28, 3.2, [ { side: 's', at: 0, w: 1.4 }, { side: 'n', at: 0, w: 1.4 }, { side: 'w', at: - 31, w: 1.2 }, { side: 'w', at: - 35.5, w: 1.2 }, { side: 'e', at: - 33, w: 1.2 } ] );
	passage( 'ns', 0, - 28, 1.4 );
	L.spawns[ 2 ] = { pos: new THREE.Vector3( 0, 1.65, - 29.2 ), yaw: 0 };
	lamp( 'lampVault', 0, 3.2, - 33, 7 );
	sign( '16.2  RECORDS VAULT', new THREE.Vector3( 0, 2.6, - 28.22 ), '-z', { w: 1.8, h: 0.38 } ); // just north of the hall's wall (it was buried inside it)
	// three side vaults (closets)
	const closets = [ { id: 'vaultA', side: 'w', at: - 31, x: - 5 }, { id: 'vaultB', side: 'w', at: - 35.5, x: - 5 }, { id: 'vaultC', side: 'e', at: - 33, x: 5 } ];
	for ( const c of closets ) {

		const xa = c.side === 'w' ? - 7.2 : 5, xb = c.side === 'w' ? - 5 : 7.2;
		room( c.id, xa, xb, c.at - 1.4, c.at + 1.4, 2.6, [ { side: c.side === 'w' ? 'e' : 'w', at: c.at, w: 1.2 } ], { wall: 'wall' } );
		door( c.id, 'ew', c.at, c.x, { w: 1.2, face: c.side === 'w' ? '+x' : '-x' } );
		// shelves of records inside
		const sx = c.side === 'w' ? - 7.15 : 6.75;
		box( [ sx, 0, c.at - 1.2 ], [ sx + 0.4, 2.1, c.at + 1.2 ], 'shelf', { block: true } );
		L.props[ c.id + 'Note' ] = new THREE.Vector3( c.side === 'w' ? - 6.2 : 6.2, 1.2, c.at );
		const tz = c.at + ( c.side === 'w' ? 1.0 : - 1.0 );
		L.props[ c.id + 'Lock' ] = terminal( c.id + 'Lock', new THREE.Vector3( c.side === 'w' ? - 4.55 : 4.55, 0, tz ), c.side === 'w' ? '+x' : '-x', 'EQUATION LOCK' );
		// readable record inside the closet
		L.props[ c.id + 'Read' ] = { id: c.id + 'Read', kind: 'note', pos: new THREE.Vector3( c.side === 'w' ? - 6.3 : 6.3, 1.2, c.at ), label: 'Read the record', enabled: false };
		L.interact.push( L.props[ c.id + 'Read' ] );

	}

	door( 'vaultExit', 'ns', 0, - 38, { label: 'MONITORING', face: '+z' } );
	L.props.vaultExitLock = terminal( 'vaultExitLock', new THREE.Vector3( 1.6, 0, - 37.4 ), '+z', 'EQUATION LOCK' );

	// --- corridor to station 3
	room( 'c2', - 1, 1, - 44, - 38, 2.8, [ { side: 's', at: 0, w: 1.4 }, { side: 'n', at: 0, w: 1.4 } ] );

	// --- station 3: monitoring station, 16.3
	room( 'monitor', - 4, 4, - 52, - 44, 3, [ { side: 's', at: 0, w: 1.4 }, { side: 'n', at: 0, w: 1.4 } ] );
	passage( 'ns', 0, - 44, 1.4 );
	L.spawns[ 3 ] = { pos: new THREE.Vector3( 0, 1.65, - 45 ), yaw: 0 };
	lamp( 'lampMon', 0, 3, - 48, 6 );
	sign( '16.3  MONITORING STATION', new THREE.Vector3( - 3.99, 2.35, - 47 ), '+x', { w: 2.0, h: 0.38 } );
	box( [ - 3.6, 0, - 49.5 ], [ - 2.6, 0.9, - 46.5 ], 'shelf', { block: true } ); // equipment bench
	L.props.equipment = { id: 'equipment', kind: 'pickup', pos: new THREE.Vector3( - 3.1, 1.0, - 48 ), label: 'Take the Geiger counter and dosimeter' };
	L.interact.push( L.props.equipment );
	const gm = box( [ - 3.35, 0.9, - 48.4 ], [ - 2.95, 1.08, - 48.1 ], 'metal' );
	const dm = box( [ - 3.3, 0.9, - 47.8 ], [ - 3.05, 0.96, - 47.6 ], 'lead' );
	L.props.equipMeshes = [ gm, dm ];
	L.props.calib = terminal( 'calib', new THREE.Vector3( 3.2, 0, - 48 ), '-x', 'CALIBRATION' );
	// badge board: every film badge has gone black (set dressing from the handoff)
	// (left of the exit door; it used to hang over the doorway)
	sign( 'FILM BADGES', new THREE.Vector3( - 2.4, 2.25, - 51.88 ), '+z', { w: 1.6, h: 0.3 } );
	for ( let i = 0; i < 12; i ++ ) box( [ - 3.15 + ( i % 6 ) * 0.25, 1.55 - Math.floor( i / 6 ) * 0.3, - 51.82 ], [ - 3.0 + ( i % 6 ) * 0.25, 1.75 - Math.floor( i / 6 ) * 0.3, - 51.79 ], 'lead', { cast: false } );
	door( 'monExit', 'ns', 0, - 52, { label: 'HOT CORRIDOR', face: '+z' } );

	// --- corridor and anteroom, station 4: 16.4
	room( 'c3', - 1, 1, - 56, - 52, 2.8, [ { side: 's', at: 0, w: 1.4 }, { side: 'n', at: 0, w: 1.4 } ] );
	room( 'ante', - 3, 3, - 60, - 56, 3, [ { side: 's', at: 0, w: 1.4 }, { side: 'n', at: 0, w: 1.4 } ] );
	passage( 'ns', 0, - 56, 1.4 );
	L.spawns[ 4 ] = { pos: new THREE.Vector3( 0, 1.65, - 56.8 ), yaw: 0 };
	lamp( 'lampAnte', 0, 3, - 58, 5 );
	sign( '16.4  HOT CORRIDOR', new THREE.Vector3( - 2.99, 2.35, - 58 ), '+x', { w: 1.6, h: 0.36 } );
	L.props.log = terminal( 'log', new THREE.Vector3( - 2.3, 0, - 59.3 ), '+x', 'SOURCE LOG' );
	L.props.clock = terminal( 'clock', new THREE.Vector3( 2.3, 0, - 59.3 ), '-x', 'CORRIDOR CLOCK' );
	door( 'interlock', 'ns', 0, - 60, { label: 'INTERLOCK', sub: 'opens when the clock is set', face: '+z', atten: 0.02 } );
	// hot corridor with the source alcove on the east side
	room( 'hot', - 1.25, 1.25, - 76, - 60, 3, [ { side: 's', at: 0, w: 1.4 }, { side: 'n', at: 0, w: 1.4 }, { side: 'e', at: - 68, w: 1.6, h: 2.4 } ] );
	room( 'alcove', 1.25, 3.4, - 69.6, - 66.4, 2.6, [ { side: 'w', at: - 68, w: 1.6, h: 2.4 } ] );
	L.walkable.pop(); // the alcove is not walkable (the source is in it)
	box( [ 1.4, 0, - 68.9 ], [ 1.6, 1.1, - 67.1 ], 'lead', { block: true, occlude: true, atten: 0.25 } ); // low shield lip at the alcove mouth
	L.blockers.push( { x0: 1.2, x1: 3.4, z0: - 69.6, z1: - 66.4 } );
	box( [ 1.6, 0.0, - 68.4 ], [ 1.9, 0.02, - 67.6 ], 'glowStrip', { cast: false } );
	point( 'blueHot', GLOW_BLUE, 140, new THREE.Vector3( 2.7, 0.9, - 68 ), { vol: true, shadow: true, distance: 12 } );
	L.props.hotSource = new THREE.Vector3( 2.7, 0.9, - 68 );

	// --- station 5: infirmary, 16.5
	room( 'infirmary', - 5, 5, - 86, - 76, 3, [ { side: 's', at: 0, w: 1.4 }, { side: 'n', at: 0, w: 1.4 } ] );
	passage( 'ns', 0, - 76, 1.4 );
	L.spawns[ 5 ] = { pos: new THREE.Vector3( 0, 1.65, - 77.2 ), yaw: 0 };
	lamp( 'lampInf', 0, 3, - 81, 6 );
	sign( '16.5  INFIRMARY', new THREE.Vector3( 4.99, 2.35, - 78.5 ), '-x', { w: 1.6, h: 0.36 } );
	[ - 79, - 81.5, - 84 ].forEach( ( z, i ) => {

		box( [ - 4.8, 0, z - 0.5 ], [ - 2.8, 0.6, z + 0.5 ], 'sheet', { block: true } ); // bed
		L.props[ 'chart' + i ] = terminal( 'chart' + i, new THREE.Vector3( - 2.3, 0, z ), '+x', 'PATIENT CHART ' + 'ABC'[ i ] );

	} );
	// radiopharmacy shelf and the cabinet with the control room key
	box( [ 4.4, 0, - 85.2 ], [ 4.9, 2.0, - 82.2 ], 'shelf', { block: true } );
	sign( 'RADIOPHARMACY', new THREE.Vector3( 4.39, 2.2, - 83.7 ), '-x', { w: 1.6, h: 0.3 } );
	L.props.cabinet = terminal( 'cabinet', new THREE.Vector3( 3.7, 0, - 80 ), '-x', 'KEY CABINET' );
	door( 'infExit', 'ns', 0, - 86, { label: 'CONTROL ROOM', sub: 'key required', face: '+z' } );

	// --- station 6: control room, 16.6; the core is behind the north wall
	room( 'c5', - 1, 1, - 90, - 86, 2.8, [ { side: 's', at: 0, w: 1.4 }, { side: 'n', at: 0, w: 1.4 } ] );
	room( 'control', - 6, 6, - 102, - 90, 3.5, [ { side: 's', at: 0, w: 1.4 }, { side: 'n', at: 0, w: 1.0, h: 2.0 } ] );
	passage( 'ns', 0, - 90, 1.4 );
	L.spawns[ 6 ] = { pos: new THREE.Vector3( 0, 1.65, - 91 ), yaw: 0 };
	lamp( 'lampCtl', - 3, 3.5, - 95, 5 );
	sign( '16.6  CONTROL ROOM', new THREE.Vector3( - 5.99, 2.6, - 92.5 ), '+x', { w: 1.8, h: 0.38 } );
	// thick shield wall in front of the north wall, with a sealed core door that leaks blue light underneath
	box( [ - 6, 0, - 102 ], [ - 0.5, 3.5, - 101.4 ], 'conc', { occlude: true, atten: 0.02, group: 'coreShield', block: true } );
	box( [ 0.5, 0, - 102 ], [ 6, 3.5, - 101.4 ], 'conc', { occlude: true, atten: 0.02, group: 'coreShield', block: true } );
	box( [ - 0.5, 2.0, - 102 ], [ 0.5, 3.5, - 101.4 ], 'conc', { occlude: true, atten: 0.02, group: 'coreShield' } );
	const coreDoor = box( [ - 0.5, 0.03, - 101.75 ], [ 0.5, 2.0, - 101.45 ], 'lead', { occlude: true, atten: 0.02, group: 'coreShield', block: true } );
	L.props.coreDoor = coreDoor;
	box( [ - 0.5, 0, - 101.45 ], [ 0.5, 0.03, - 101.2 ], 'glowStrip', { cast: false } );
	plane( 0.5, 0.5, 'sign', new THREE.Vector3( 0, 1.4, - 101.44 ), '+z' );
	room( 'core', - 3, 3, - 108, - 102, 3.5, [ { side: 's', at: 0, w: 1.0, h: 2.0 } ] );
	L.walkable.pop(); // the core room is never entered
	point( 'blueCore', GLOW_BLUE, 260, new THREE.Vector3( 0, 1.3, - 105 ), { vol: true, shadow: true, distance: 12 } );
	point( 'blueCoreLeak', GLOW_BLUE, 3, new THREE.Vector3( 0, 0.05, - 101.1 ), { distance: 3 } );
	L.props.coreSource = new THREE.Vector3( 0, 1.3, - 105 );

	L.props.sort = terminal( 'sort', new THREE.Vector3( - 5.3, 0, - 94 ), '+x', 'REACTOR LOG' );
	L.props.fission = terminal( 'fission', new THREE.Vector3( - 5.3, 0, - 98 ), '+x', 'FISSION MONITOR' );
	L.props.rods = terminal( 'rods', new THREE.Vector3( 5.3, 0, - 96 ), '-x', 'CONTROL RODS' );
	L.props.finale = terminal( 'finale', new THREE.Vector3( 0, 0, - 100.5 ), '+z', 'DECAY CONSOLE' );
	// control rod status lamps
	L.props.rodLamps = [];
	for ( let i = 0; i < 4; i ++ ) {

		const m = new THREE.Mesh( new THREE.BoxGeometry( 0.12, 0.12, 0.04 ), mats.rodLamp.full );
		m.userData.matKey = 'rodLamp'; m.position.set( 5.98, 1.9, - 96.6 + i * 0.4 ); m.rotation.y = - Math.PI / 2;
		scene.add( m ); L.props.rodLamps.push( m );

	}

	// ---------------------------------------------------------------- lights shared by the whole level

	L.lights.hemi = new THREE.HemisphereLight( 0x33363a, 0x0d0b09, 0.22 );
	scene.add( L.lights.hemi );

	const flash = new THREE.SpotLight( 0xfff1de, 180, 30, 0.4, 0.85, 2 );
	flash.castShadow = true;
	flash.shadow.camera.near = 0.1; flash.shadow.camera.far = 30;
	flash.shadow.bias = - 0.0004; flash.shadow.normalBias = 0.02;
	flash.layers.enable( LAYER_VOL );
	L.lights.flash = flash;
	L.cookie = TX.flashlightCookie();

	// ---------------------------------------------------------------- raymarched fog volume (follows the camera)

	const fogTex = TX.fogNoise3D( 64 );
	const fogDensity = uniform( 1.0 );
	const volMat = new THREE.VolumeNodeMaterial();
	volMat.steps = 16;
	volMat.offsetNode = bayer16( screenCoordinate );
	volMat.scatteringNode = Fn( ( { positionRay } ) => {

		const drift = vec3( time.mul( 0.035 ), time.mul( 0.008 ), time.mul( - 0.02 ) );
		const n1 = texture3D( fogTex, positionRay.mul( 0.11 ).add( drift ).mod( 1 ), 0 ).r;
		const n2 = texture3D( fogTex, positionRay.mul( 0.37 ).sub( drift.mul( 1.7 ) ).mod( 1 ), 0 ).r;
		const heightFalloff = mix( float( 1.35 ), float( 0.65 ), saturate( positionRay.y.div( 3 ) ) );
		return n1.mul( n2 ).mul( 2.2 ).add( 0.25 ).mul( heightFalloff ).mul( fogDensity );

	} );
	const vol = new THREE.Mesh( new THREE.BoxGeometry( 22, 3.6, 22 ), volMat );
	vol.position.set( 0, 1.75, 0 );
	vol.receiveShadow = true;
	vol.layers.disableAll(); vol.layers.enable( LAYER_VOL );
	vol.frustumCulled = false;
	scene.add( vol );
	L.volume = vol; L.volMat = volMat; L.fogDensity = fogDensity;

	// ---------------------------------------------------------------- Medium/Low stand-ins: beam cone and glow hazes

	const softFade = ( dist ) => {

		const sceneZ = perspectiveDepthToViewZ( viewportDepthTexture(), cameraNear, cameraFar );
		return saturate( positionView.z.sub( sceneZ ).div( dist ) );

	};

	const coneLen = 7, coneR = Math.tan( 0.38 ) * coneLen;
	const coneGeo = new THREE.ConeGeometry( coneR, coneLen, 40, 8, true );
	coneGeo.rotateX( Math.PI / 2 ); coneGeo.translate( 0, 0, - coneLen / 2 );
	const coneMat = new THREE.MeshBasicNodeMaterial( { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide } );
	const coneStrength = uniform( 0.025 );
	coneMat.colorNode = Fn( () => {

		const t = saturate( positionLocal.z.negate().div( coneLen ) );
		const radial = saturate( length( positionLocal.xy ).div( t.mul( coneR ).add( 0.001 ) ) );
		const n = mx_noise_float( positionLocal.mul( vec3( 2.2, 2.2, 0.8 ) ).add( vec3( 0, time.mul( 0.15 ), time.mul( - 0.25 ) ) ) ).mul( 0.5 ).add( 0.6 );
		const along = float( 1 ).sub( t ).pow( 1.6 );
		const nearFade = smoothstep( 0.6, 2.8, positionView.z.negate() );
		const a = along.mul( n ).mul( float( 1 ).sub( radial.mul( 0.3 ) ) ).mul( softFade( 0.6 ) ).mul( nearFade ).mul( coneStrength );
		return vec4( vec3( 1.0, 0.93, 0.82 ).mul( a ), 1 );

	} )();
	const cone = new THREE.Mesh( coneGeo, coneMat );
	cone.renderOrder = 5; cone.frustumCulled = false;
	L.cone = cone;

	function haze( pos, size, strength ) {

		const m = new THREE.SpriteNodeMaterial( { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending } );
		const s = uniform( strength );
		m.colorNode = Fn( () => {

			const d = length( uv().sub( 0.5 ) ).mul( 2 );
			const fall = saturate( float( 1 ).sub( d ) ).pow( 2.2 );
			return vec4( vec3( GLOW_BLUE.r, GLOW_BLUE.g, GLOW_BLUE.b ).mul( fall ).mul( s ).mul( softFade( 0.5 ) ), 1 );

		} )();
		const sp = new THREE.Sprite( m );
		sp.position.copy( pos ); sp.scale.setScalar( size );
		sp.renderOrder = 6; sp.userData.strength = s; sp.userData.base = strength;
		scene.add( sp ); L.hazes.push( sp );
		return sp;

	}

	L.hazeHot = [ haze( new THREE.Vector3( 1.3, 1.0, - 68 ), 2.6, 0.3 ), haze( new THREE.Vector3( 0.6, 0.12, - 68 ), 1.8, 0.2 ) ];
	L.hazeCore = [ haze( new THREE.Vector3( 0, 0.12, - 101.0 ), 1.6, 0.25 ), haze( new THREE.Vector3( 0, 1.0, - 100.8 ), 2.6, 0.05 ) ];

	// ---------------------------------------------------------------- dose sources (game values in mSv/h at 1 m, not measurements)
	// Sources are mutable: the stations change their strengths (corridor clock, control rods, finale).

	const src = ( id, pos, strength ) => { const s = { id, pos: pos.clone(), strength, base: strength }; L.sources.push( s ); return s; };
	BARRIERS.forEach( ( z, i ) => src( 'barrier' + i, L.props[ 'src' + i ], 1.5 ) );
	src( 'vault', new THREE.Vector3( 6.6, 1.2, - 33 ), 4 );
	src( 'check', new THREE.Vector3( - 3.1, 1.0, - 48 ), 0.6 ); // check source on the bench
	L.hotSrc = src( 'hot', L.props.hotSource, 0 ); // set by the corridor clock
	src( 'pharmacy', new THREE.Vector3( 4.65, 1.2, - 83.7 ), 5 );
	L.coreSrc = src( 'core', L.props.coreSource, 3000 );
	L.background = 0.02; // mSv/h

	// ---------------------------------------------------------------- tier variants

	L.applyVariant = ( variant ) => {

		for ( const m of statics ) m.material = mats[ m.userData.matKey ][ variant ];

	};

	L.setScreen = ( it, done ) => { it.setDone( done ); it.screen.material = mats[ it.screen.userData.matKey ][ L.variant || 'full' ]; };

	return L;

}

// sign texture: a title line and an optional smaller second line
function signTexture( text, sub, w, h, bg, fg ) {

	const px = 256, cw = Math.round( px * w / h * 0.5 ) * 2, ch = px;
	const c = document.createElement( 'canvas' ); c.width = Math.min( 2048, cw ); c.height = ch;
	const x = c.getContext( '2d' );
	x.fillStyle = bg; x.fillRect( 0, 0, c.width, ch );
	x.strokeStyle = fg; x.globalAlpha = 0.5; x.lineWidth = 6; x.strokeRect( 10, 10, c.width - 20, ch - 20 ); x.globalAlpha = 1;
	x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
	const fit = ( t, size, y, weight ) => {

		let s = size;
		do { x.font = `${ weight } ${ s }px "Arial Narrow", Arial, sans-serif`; s -= 4; } while ( x.measureText( t ).width > c.width - 50 && s > 20 );
		x.fillText( t, c.width / 2, y );

	};

	if ( sub ) { fit( text, ch * 0.42, ch * 0.4, 'bold' ); fit( sub, ch * 0.2, ch * 0.76, 'normal' ); } else fit( text, ch * 0.55, ch * 0.53, 'bold' );
	const t = new THREE.CanvasTexture( c ); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
	return t;

}
