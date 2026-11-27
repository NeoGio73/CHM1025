// Build step 2: the whole building, generated from src/elements.js.
// Floors are periods (period 1 on top), x position is the group, room size follows atomic size.
// Every floor has one hallway along the front of its rooms (z from 0 to HALL_W); rooms are behind it (z < 0).
// Two switchback stairwells join the floors: one at the west end (x < 0) and one at the east end (x > XE),
// so no walk between floors has to cross the whole building twice.
// Surfaces reuse the approved look test materials, plus two CC0 concretes (ambientCG) added in the art pass: light
// concrete for the stairs, landings, pillars and parking ceilings, darker stained concrete for the parking floor.
// The stairwells have railings, step nosings, stringers, soffits and floor numbers; the exit room's back wall has the
// exit doorway.

import * as THREE from 'three/webgpu';
import { positionWorld, normalWorld, texture, vec2, float, floor, clamp, select, mix, materialColor, materialAO } from 'three/tsl';
import { ELEMENTS, roomKind, valenceOf } from './elements.js';
import { shortConfig, dCount } from './chem.js';
import { buildWater } from './world.js';

export const FLOOR_DY = 5; // metres between floors
export const HALL_W = 2.5, HALL_H = 2.6;
const COL = 13; // metres per periodic-table column
const X0 = 2; // where group 1 starts
const XE = X0 + 18 * COL; // where group 18 ends: every floor's hallway ends here, at the east stairwell
const DOOR = { w: 1.1, h: 2.1 };
export const floorY = p => - ( p - 1 ) * FLOOR_DY;
// room size from atomic radius: big enough to walk in even for helium, potassium the largest
export const roomSide = r => 4 + 0.035 * r;
export const roomHeight = r => 2.4 + 0.006 * r;
export const colCentre = g => X0 + ( g - 0.5 ) * COL;

const SETS = {
	carpet: { size: 1.6, avg: 0x343b48, rough: 1 },
	wall: { size: 1.4, avg: 0xe0e1dc, rough: 1 },
	ceiling: { size: 2.4, avg: 0xf2f2f0, rough: 1 },
	tile: { size: 1.2, avg: 0xeeeeec, rough: 0.6 },
	pooltile: { size: 0.9, avg: 0x3bb5d3, rough: 0.6 },
	concrete: { size: 2.5, avg: 0xb3b3b1, rough: 1 }, // ambientCG Concrete 034: stairs, landings, pillars, parking ceilings
	garage: { size: 3, avg: 0x969187, rough: 1 }, // ambientCG Concrete 036: the parking level's floor
	nosing: { size: 1, avg: 0x2e2f2e, rough: 1, flat: true },
	curb: { size: 1, avg: 0xb39232, rough: 1, flat: true }, // safety yellow: wheel stops, bands on the parking pillars
	paint: { size: 2, avg: 0xb9b6ae, rough: 1, flat: true }
};

// The building's identity (confirmed 2026-11-27): Calder & Finch Maintenance, an older look. Signs are brass plates
// with dark brown serif letters; painted lettering is the same brown.
const BRASS = { text: '#2b1f12', paint: '#3b2c1e', font: 'Georgia, "Times New Roman", serif' };
function brassPlate( g, W, H ) {

	const gr = g.createLinearGradient( 0, 0, W, H );
	gr.addColorStop( 0, '#d6b978' ); gr.addColorStop( 0.45, '#b8955a' ); gr.addColorStop( 0.55, '#c7a66a' ); gr.addColorStop( 1, '#9c7b45' );
	g.fillStyle = gr; g.fillRect( 0, 0, W, H );
	const b = Math.max( 4, Math.round( Math.min( W, H ) * 0.035 ) );
	g.strokeStyle = '#6b5130'; g.lineWidth = b; g.strokeRect( b / 2, b / 2, W - b, H - b );
	g.strokeStyle = 'rgba(255,236,190,0.55)'; g.lineWidth = Math.max( 1, b / 3 ); g.strokeRect( b * 1.6, b * 1.6, W - b * 3.2, H - b * 3.2 );
	for ( const [ x, y ] of [ [ b * 3, b * 3 ], [ W - b * 3, b * 3 ], [ b * 3, H - b * 3 ], [ W - b * 3, H - b * 3 ] ] ) {

		g.fillStyle = '#7d6239'; g.beginPath(); g.arc( x, y, b * 0.8, 0, Math.PI * 2 ); g.fill();

	}

}

export function buildBuilding( scene, { exitRoom = null } = {} ) {

	const loader = new THREE.TextureLoader();
	const texCache = {}, matCache = {};
	function tex( res, name, map, color ) {

		const k = `${ res }/${ name }_${ map }`;
		if ( ! texCache[ k ] ) {

			const t = loader.load( `./textures/${ k }.jpg` );
			t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
			t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
			texCache[ k ] = t;

		}

		return texCache[ k ];

	}

	// ---- the dark, on the surfaces: a small table of how lit each zone is (1 on, 0 off), looked up from the world position.
	// Column 0 is the west stairwell, columns 1 to 18 the groups, column 19 the east stairwell; two rows per floor (hallway, then rooms).
	const ZW = 20, ZH = 8;
	const zoneData = new Uint8Array( ZW * ZH * 4 ).fill( 255 );
	const zoneTex = new THREE.DataTexture( zoneData, ZW, ZH, THREE.RGBAFormat );
	zoneTex.magFilter = zoneTex.minFilter = THREE.NearestFilter; zoneTex.needsUpdate = true;
	const zoneShow = new Float32Array( ZW * ZH ).fill( 1 ); // what is shown, easing toward the target
	const zoneTarget = new Float32Array( ZW * ZH ).fill( 1 );
	const zoneLightNode = ( () => {

		const wp = positionWorld;
		const p = clamp( floor( wp.y.negate().add( 4 ).div( FLOOR_DY ) ).add( 1 ), 1, 4 );
		const stair = wp.x.lessThan( - 0.01 ).or( wp.x.lessThan( 0.01 ).and( normalWorld.x.lessThan( - 0.5 ) ) );
		const east = wp.x.greaterThan( XE + 0.01 ).or( wp.x.greaterThan( XE - 0.01 ).and( normalWorld.x.greaterThan( 0.5 ) ) );
		const col = select( stair, float( 0 ), select( east, float( 19 ), clamp( floor( wp.x.sub( X0 ).div( COL ) ).add( 1 ), 1, 18 ) ) );
		const isRoom = select( wp.z.lessThan( - 0.02 ).or( wp.z.lessThan( 0.02 ).and( normalWorld.z.lessThan( - 0.5 ) ) ), float( 1 ), float( 0 ) );
		const row = p.sub( 1 ).mul( 2 ).add( isRoom );
		const f = texture( zoneTex, vec2( col.add( 0.5 ).div( ZW ), row.add( 0.5 ).div( ZH ) ) ).r;
		return mix( float( 0.02 ), float( 1 ), f );

	} )();

	function material( set, variant ) {

		const S = SETS[ set ];
		const k = set + '/' + ( S.flat && variant !== 'baked' ? 'pbr' : variant );
		if ( matCache[ k ] ) return matCache[ k ];
		let m;
		if ( variant === 'baked' ) m = new THREE.MeshLambertNodeMaterial( { color: S.avg } );
		else if ( S.flat ) m = new THREE.MeshStandardNodeMaterial( { color: S.avg, roughness: 0.95 } );
		else {

			m = new THREE.MeshStandardNodeMaterial( { map: tex( variant, set, 'color', true ), normalMap: tex( variant, set, 'normal' ), aoMap: tex( variant, set, 'orm' ), roughnessMap: tex( variant, set, 'orm' ), roughness: S.rough } );
			m.aoMapIntensity = 0.8;

		}

		// a dark zone stays dark whatever light reaches it: the color and the ambient light both follow the zone
		m.colorNode = materialColor.mul( zoneLightNode );
		m.aoNode = m.aoMap ? materialAO.mul( zoneLightNode ) : zoneLightNode;
		return ( matCache[ k ] = m );

	}

	// the same darkening for things placed in the building (props, the donkey): a standard material is
	// copied into a node material whose color and ambient light follow the zone it stands in. Emissive parts
	// (the phone's lamp, the EXIT sign) still glow in the dark.
	function zoneMaterial( m ) {

		let nm = m;
		if ( ! m.isNodeMaterial ) {

			nm = new THREE.MeshStandardNodeMaterial();
			for ( const k of [ 'name', 'map', 'normalMap', 'normalScale', 'roughness', 'roughnessMap', 'metalness', 'metalnessMap', 'aoMap', 'aoMapIntensity', 'emissiveMap', 'emissiveIntensity', 'vertexColors', 'transparent', 'opacity', 'alphaTest', 'side', 'flatShading', 'depthWrite' ] ) if ( m[ k ] !== undefined ) nm[ k ] = m[ k ];
			nm.color.copy( m.color ); if ( m.emissive ) nm.emissive.copy( m.emissive );

		}

		nm.colorNode = materialColor.mul( zoneLightNode );
		nm.aoNode = nm.aoMap ? materialAO.mul( zoneLightNode ) : zoneLightNode;
		return nm;

	}

	// the flooded corridor (handoff section 3): ankle-deep water where the carpet used to be, on the period 4 hallway
	// between the zinc and gallium doors, where the parking level gives way to the pool rooms (work order 5 crosses it)
	const FLOOD = { p: 4, x0: colCentre( 12 ) + DOOR.w / 2 + 0.3, x1: colCentre( 13 ) - DOOR.w / 2 - 0.3, sink: 0.08, level: 0.02 };
	// the parking attendant's booth (handoff, work order 4: the second glimpse is behind its frosted glass): a small room
	// behind the period 4 hallway's front wall, in front of nickel, with a frosted window onto the hallway
	const BOOTH = { p: 4, x0: colCentre( 10 ) - 1.3, x1: colCentre( 10 ) + 1.3, z1: HALL_W + 2.1, h: 2.4 };
	BOOTH.window = { c: colCentre( 10 ) - 0.25, w: 1.4, h: 1.95, sill: 0.95 };

	const group = new THREE.Group();
	scene.add( group );
	const surfaces = [];
	const boxes = {}; // boxes (stairs, pillars, dividers), instanced per set
	const bars = []; // round bars (railings): [ from, to, radius ]

	// one geometry per set: every quad is merged into it, so the whole building is a handful of draw calls
	const batches = {};
	const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler( 0, 0, 0, 'YXZ' ), one = new THREE.Vector3( 1, 1, 1 );
	function quad( set, w, h, pos, rotY = 0, rotX = 0 ) {

		if ( w < 1e-3 || h < 1e-3 ) return;
		const g = new THREE.PlaneGeometry( w, h );
		const s = SETS[ set ].size, a = g.attributes.uv;
		// world-anchored UVs would be nicer; repeats per metre are enough here
		for ( let i = 0; i < a.count; i ++ ) a.setXY( i, a.getX( i ) * w / s, a.getY( i ) * h / s );
		tmpE.set( rotX, rotY, 0 );
		g.applyMatrix4( tmpM.compose( pos, tmpQ.setFromEuler( tmpE ), one ) );
		( batches[ set ] ||= [] ).push( g );

	}

	function wall( set, ax, a0, a1, fixed, y0, y1, facing, doors = [] ) {

		let a = a0;
		const piece = ( b0, b1, yb, yt ) => {

			if ( b1 - b0 < 1e-3 || yt - yb < 1e-3 ) return;
			const mid = ( b0 + b1 ) / 2, ym = ( yb + yt ) / 2;
			const pos = ax === 'x' ? new THREE.Vector3( mid, ym, fixed ) : new THREE.Vector3( fixed, ym, mid );
			const rot = ax === 'x' ? ( facing > 0 ? 0 : Math.PI ) : ( facing > 0 ? Math.PI / 2 : - Math.PI / 2 );
			quad( set, b1 - b0, yt - yb, pos, rot );

		};

		for ( const d of [ ...doors ].sort( ( p, q ) => p.c - q.c ) ) {

			piece( a, d.c - d.w / 2, y0, y1 );
			piece( d.c - d.w / 2, d.c + d.w / 2, y0 + d.h, y1 );
			if ( d.sill ) piece( d.c - d.w / 2, d.c + d.w / 2, y0, y0 + d.sill ); // a window: wall below the opening too
			a = d.c + d.w / 2;

		}

		piece( a, a1, y0, y1 );

	}

	const floorQ = ( set, x0, x1, z0, z1, y ) => quad( set, x1 - x0, z1 - z0, new THREE.Vector3( ( x0 + x1 ) / 2, y, ( z0 + z1 ) / 2 ), 0, - Math.PI / 2 );
	const ceilQ = ( set, x0, x1, z0, z1, y ) => quad( set, x1 - x0, z1 - z0, new THREE.Vector3( ( x0 + x1 ) / 2, y, ( z0 + z1 ) / 2 ), 0, Math.PI / 2 );

	// ---- walkable areas: flat rectangles and stair ramps; the player follows the ground under them
	const walk = []; // { x0, x1, z0, z1, y } or { ..., ramp: { ya, yb, axis: 'x', a0, a1 } }
	const area = ( x0, x1, z0, z1, y, ramp ) => walk.push( { x0, x1, z0, z1, y, ramp } );

	// ---- zones: every room, every column-wide stretch of hallway and each stair landing can go dark on its own (the dark, step 3)
	// zone ids: 'r:Na' (room), 'h:3:7' (period 3 hallway, column 7), 's:3' (west stairwell at period 3), 'e:3' (east stairwell)
	const zoneLit = new Map();
	const hallZone = ( p, x ) => `h:${ p }:${ Math.max( 1, Math.min( 18, Math.floor( ( x - X0 ) / COL ) + 1 ) ) }`;

	// ---- lights: emissive tubes everywhere; a small pool of real lights follows the player (see updateLights)
	const tubeOn = new THREE.MeshStandardMaterial( { color: 0xffffff, emissive: 0xf4f8ff, emissiveIntensity: 6, roughness: 0.4 } );
	const tubeOff = zoneMaterial( new THREE.MeshStandardMaterial( { color: 0xb9bcbf, roughness: 0.35, metalness: 0.1 } ) );
	const housingMat = zoneMaterial( new THREE.MeshStandardMaterial( { color: 0xd8d8d4, roughness: 0.5, metalness: 0.2 } ) );
	const tubeGeo = new THREE.CylinderGeometry( 0.016, 0.016, 1.16, 8 ).rotateZ( Math.PI / 2 );
	const housingGeo = new THREE.BoxGeometry( 1.24, 0.02, 0.34 );
	const tubesOn = [], tubesOff = [], housings = [], tubeZone = [];
	function fixture( x, z, y, lit, zone ) { // two tube slots; lit = how many of them are on (0, 1 or 2)

		housings.push( new THREE.Vector3( x, y - 0.012, z ) );
		for ( let i = 0; i < 2; i ++ ) {

			const v = new THREE.Vector3( x, y - 0.042, z + ( i ? 0.075 : - 0.075 ) );
			if ( i < lit ) { tubesOn.push( v ); tubeZone.push( zone ); } else tubesOff.push( v );

		}

	}

	const lightSpots = []; // candidate light positions { pos, floor, intensity }
	const rooms = [];
	const hallEnds = {};
	const plates = [], bays = [];
	const waters = [];
	let floodWater = null; // the flooded corridor's water (buildFlood)

	// ---- floors
	for ( let p = 1; p <= 4; p ++ ) {

		const y = floorY( p );
		const els = ELEMENTS.filter( e => e.period === p );
		const last = Math.max( ...els.map( e => e.group ) );
		const xEnd = colCentre( last ) + COL / 2;
		const doors = [];

		for ( const e of els ) {

			const side = roomSide( e.radius ), h = roomHeight( e.radius ), kind = roomKind( e );
			const cx = colCentre( e.group );
			const R = { x0: cx - side / 2, x1: cx + side / 2, z0: - side, z1: 0, h, y };
			rooms.push( { e, kind, ...R, cx, cz: - side / 2 } );
			doors.push( { c: cx, w: DOOR.w, h: DOOR.h } );

			const floorSet = kind === 'office' ? 'carpet' : kind === 'pool' ? 'tile' : 'garage';
			const wallSet = kind === 'office' ? 'wall' : kind === 'pool' ? 'tile' : 'paint';
			// floor (the pool rooms leave a hole for the basin)
			if ( kind === 'pool' ) {

				const b = { x0: cx - side * 0.27, x1: cx + side * 0.27, z0: - side * 0.75, z1: - side * 0.3 };
				floorQ( floorSet, R.x0, b.x0, R.z0, R.z1, y ); floorQ( floorSet, b.x1, R.x1, R.z0, R.z1, y );
				floorQ( floorSet, b.x0, b.x1, R.z0, b.z0, y ); floorQ( floorSet, b.x0, b.x1, b.z1, R.z1, y );
				const depth = 0.45;
				floorQ( 'pooltile', b.x0, b.x1, b.z0, b.z1, y - depth );
				// the basin's sides face inward (into the water), like a room's walls; facing out, they were culled
				// and the floor below showed through, lit even when this room was dark
				wall( 'pooltile', 'x', b.x0, b.x1, b.z0, y - depth, y, 1 );
				wall( 'pooltile', 'x', b.x0, b.x1, b.z1, y - depth, y, - 1 );
				wall( 'pooltile', 'z', b.z0, b.z1, b.x0, y - depth, y, 1 );
				wall( 'pooltile', 'z', b.z0, b.z1, b.x1, y - depth, y, - 1 );
				const W = buildWater( { ...b, depth, water: - 0.1 }, zoneLightNode );
				W.mesh.position.y += y;
				group.add( W.mesh ); waters.push( W );
				// walkable: the deck around the basin
				const r = 0.3;
				area( R.x0 + r, b.x0 - r, R.z0 + r, R.z1, y ); area( b.x1 + r, R.x1 - r, R.z0 + r, R.z1, y );
				area( b.x0 - r, b.x1 + r, R.z0 + r, b.z0 - r, y ); area( b.x0 - r, b.x1 + r, b.z1 + r, R.z1, y );

			} else {

				floorQ( floorSet, R.x0, R.x1, R.z0, R.z1, y );
				area( R.x0 + 0.3, R.x1 - 0.3, R.z0 + 0.3, R.z1, y );

			}

			ceilQ( kind === 'parking' ? 'concrete' : 'ceiling', R.x0, R.x1, R.z0, R.z1, y + h );
			// the exit room's back wall has the exit doorway; behind it, a small bright space the door opens onto
			const exitHere = e.sym === exitRoom;
			wall( wallSet, 'x', R.x0, R.x1, R.z0, y, y + h, 1, exitHere ? [ { c: cx, w: 1.2, h: 2.15 } ] : [] );
			if ( exitHere ) {

				const v = new THREE.Mesh( new THREE.BoxGeometry( 1.5, 2.4, 1.5 ), new THREE.MeshBasicMaterial( { color: 0xfff4e2, side: THREE.BackSide } ) );
				v.position.set( cx, y + 1.15, R.z0 - 0.75 );
				group.add( v );

			}

			wall( wallSet, 'z', R.z0, R.z1, R.x0, y, y + h, 1 );
			wall( wallSet, 'z', R.z0, R.z1, R.x1, y, y + h, - 1 );
			wall( wallSet, 'x', R.x0, R.x1, R.z1, y, y + h, - 1, [ { c: cx, w: DOOR.w, h: DOOR.h } ] );
			area( cx - DOOR.w / 2 + 0.25, cx + DOOR.w / 2 - 0.25, - 0.4, 0.4, y ); // the doorway

			// tubes: in representative-element rooms, the number of lit tubes is the number of valence electrons
			const v = valenceOf( e );
			const slots = 8; // four fixtures, two tubes each
			const lit = v === null ? slots : v;
			const zone = 'r:' + e.sym;
			zoneLit.set( zone, true );
			const fx = [ [ - 0.22, - 0.3 ], [ 0.22, - 0.3 ], [ - 0.22, - 0.7 ], [ 0.22, - 0.7 ] ];
			fx.forEach( ( [ fxr, fzr ], i ) => fixture( cx + fxr * side, fzr * side, y + h, Math.max( 0, Math.min( 2, lit - i * 2 ) ), zone ) );
			lightSpots.push( { pos: new THREE.Vector3( cx, y + h - 0.06, - side / 2 ), floor: p, intensity: 6 + 2.2 * Math.max( lit, 1 ), reach: side * 1.3, zone } );
			if ( kind === 'parking' ) for ( const sx of [ - 1, 1 ] ) for ( const sz of [ 0.2, 0.8 ] ) pillar( cx + sx * side * 0.3, - side * sz, y, h );

			plates.push( { e, kind, x: cx + DOOR.w / 2 + 0.45, y: y + 1.5, z: 0.01 } );
			// parking bays: the number painted on the floor is the 3d electron count (no number for Cr and Cu: out of scope)
			if ( kind === 'parking' ) bays.push( { n: dCount( e.z ), x: cx, y, side, seed: e.z } );
			// a wheel stop at the back of the bay (the bay itself is painted further down)
			if ( kind === 'parking' ) box( 1.7, 0.12, 0.16, cx, y + 0.06, - side * 0.5 - Math.min( 5.2, side * 0.7 ) / 2 + 0.45, 'curb' );
			// pipes along the parking ceiling, on hangers
			if ( kind === 'parking' ) for ( const [ dz, r, dy ] of [ [ 0, 0.06, 0.22 ], [ - 0.24, 0.04, 0.17 ] ] ) {

				const pz = - side * 0.12 + dz, py = y + h - dy;
				bar( new THREE.Vector3( R.x0, py, pz ), new THREE.Vector3( R.x1, py, pz ), r );
				for ( let x = R.x0 + 1; x < R.x1 - 0.5; x += 2 ) bar( new THREE.Vector3( x, py, pz ), new THREE.Vector3( x, y + h, pz ), 0.008 );

			}


		}

		// hallway along the front of the floor, from the west stair landing (x = 0) to the east one (x = XE)
		if ( p === FLOOD.p ) { floorQ( 'carpet', 0, FLOOD.x0, 0, HALL_W, y ); floorQ( 'carpet', FLOOD.x1, xEnd, 0, HALL_W, y ); buildFlood( y ); }
		else floorQ( 'carpet', 0, xEnd, 0, HALL_W, y );
		ceilQ( 'ceiling', 0, xEnd, 0, HALL_W, y + HALL_H );
		wall( 'wall', 'x', 0, xEnd, 0, y, y + HALL_H, 1, doors );
		wall( 'wall', 'x', 0, xEnd, HALL_W, y, y + HALL_H, - 1, p === BOOTH.p ? [ BOOTH.window ] : [] );
		if ( p === BOOTH.p ) buildBooth( y );
		area( 0, xEnd, 0.3, HALL_W - 0.3, y );
		for ( let g = 1; g <= last; g ++ ) zoneLit.set( `h:${ p }:${ g }`, true );
		for ( let x = 2; x < xEnd - 1; x += 4 ) fixture( x, HALL_W / 2, y + HALL_H, 2, hallZone( p, x ) );
		for ( let x = 4; x < xEnd - 1; x += 8 ) lightSpots.push( { pos: new THREE.Vector3( x, y + HALL_H - 0.06, HALL_W / 2 ), floor: p, intensity: 9, reach: 7, zone: hallZone( p, x ) } );
		hallEnds[ p ] = xEnd;

	}

	// ---- stairwell: two flights per floor in a shaft at x from -12 to 0
	const SX0 = - 12, SX1 = 0, SZ0 = - HALL_W, SZ1 = HALL_W, LAND = 2, LANE = 0.15;
	const topY = floorY( 1 ) + HALL_H, botY = floorY( 4 );
	wall( 'paint', 'x', SX0, SX1, SZ0, botY, topY, 1 );
	wall( 'paint', 'x', SX0, SX1, SZ1, botY, topY, - 1 );
	wall( 'paint', 'z', SZ0, SZ1, SX0, botY, topY, 1 );
	ceilQ( 'paint', SX0, SX1, SZ0, SZ1, topY );
	for ( let p = 1; p <= 4; p ++ ) {

		const y = floorY( p );
		// landing at the hallway end: x from -2 to 0, both lanes
		zoneLit.set( 's:' + p, true );
		fixture( - 1, 0, y + HALL_H, 2, 's:' + p );
		lightSpots.push( { pos: new THREE.Vector3( - 4, y + HALL_H - 0.06, 0 ), floor: p, intensity: 8, reach: 7, zone: 's:' + p } );
		floorQ( 'concrete', - LAND, SX1, SZ0, SZ1, y );
		area( - LAND, SX1 + 0.3, SZ0 + 0.3, SZ1 - 0.3, y );
		// the wall between the stairwell and the room side of the hallway (z < 0 is open only in the stairwell)
		wall( 'wall', 'z', SZ0, 0, SX1, y, y + HALL_H, - 1 );
		if ( p === 4 ) continue;
		const mid = y - FLOOR_DY / 2, run = ( SX1 - LAND ) - ( SX0 + LAND );
		// flight A: from this floor's landing westward in the south lane (z > 0), down to the half landing
		stairs( SX1 - LAND, SX0 + LAND, LANE, SZ1, y, mid, LANE );
		area( SX0 + LAND, SX1 - LAND, LANE + 0.25, SZ1 - 0.3, y, { ya: y, yb: mid, a0: SX1 - LAND, a1: SX0 + LAND } );
		// half landing at the west end
		floorQ( 'concrete', SX0, SX0 + LAND, SZ0, SZ1, mid );
		area( SX0 + 0.3, SX0 + LAND, SZ0 + 0.3, SZ1 - 0.3, mid );
		// flight B: back eastward in the north lane (z < 0), down to the next floor's landing
		const fb = stairs( SX0 + LAND, SX1 - LAND, SZ0, - LANE, mid, floorY( p + 1 ), - LANE );
		area( SX0 + LAND, SX1 - LAND, SZ0 + 0.3, - LANE - 0.25, mid, { ya: mid, yb: floorY( p + 1 ), a0: SX0 + LAND, a1: SX1 - LAND } );
		turnRail( SX0 + LAND, fb.L( SX0 + LAND ), LANE + 0.04, - LANE - 0.04 ); // across the half landing
		ceilQ( 'paint', SX0, SX0 + LAND, SZ0, SZ1, mid - 0.42 ); // under the half landing
		ceilQ( 'paint', - LAND, SX1, SZ0, SZ1, floorY( p + 1 ) - 0.42 ); // under the next floor's landing
		// the shaft's hallway side between the next floor's hallway ceiling and this floor
		wall( 'paint', 'z', SZ0, SZ1, SX1, floorY( p + 1 ) + HALL_H, y, - 1 );
		void run;

	}

	// ---- east stairwell: the same, mirrored, in a shaft at x from XE to XE + 12
	const EX0 = XE, EX1 = XE + 12;
	wall( 'paint', 'x', EX0, EX1, SZ0, botY, topY, 1 );
	wall( 'paint', 'x', EX0, EX1, SZ1, botY, topY, - 1 );
	wall( 'paint', 'z', SZ0, SZ1, EX1, botY, topY, - 1 );
	ceilQ( 'paint', EX0, EX1, SZ0, SZ1, topY );
	for ( let p = 1; p <= 4; p ++ ) {

		const y = floorY( p );
		zoneLit.set( 'e:' + p, true );
		fixture( EX0 + 1, 0, y + HALL_H, 2, 'e:' + p );
		lightSpots.push( { pos: new THREE.Vector3( EX0 + 4, y + HALL_H - 0.06, 0 ), floor: p, intensity: 8, reach: 7, zone: 'e:' + p } );
		floorQ( 'concrete', EX0, EX0 + LAND, SZ0, SZ1, y );
		area( EX0 - 0.3, EX0 + LAND, SZ0 + 0.3, SZ1 - 0.3, y );
		wall( 'wall', 'z', SZ0, 0, EX0, y, y + HALL_H, 1 );
		if ( p === 4 ) continue;
		const mid = y - FLOOR_DY / 2;
		// flight A: eastward in the south lane, down to the half landing at the east end
		stairs( EX0 + LAND, EX1 - LAND, LANE, SZ1, y, mid, LANE );
		area( EX0 + LAND, EX1 - LAND, LANE + 0.25, SZ1 - 0.3, y, { ya: y, yb: mid, a0: EX0 + LAND, a1: EX1 - LAND } );
		floorQ( 'concrete', EX1 - LAND, EX1, SZ0, SZ1, mid );
		area( EX1 - LAND, EX1 - 0.3, SZ0 + 0.3, SZ1 - 0.3, mid );
		// flight B: back westward in the north lane, down to the next floor's landing
		const fb = stairs( EX1 - LAND, EX0 + LAND, SZ0, - LANE, mid, floorY( p + 1 ), - LANE );
		area( EX0 + LAND, EX1 - LAND, SZ0 + 0.3, - LANE - 0.25, mid, { ya: mid, yb: floorY( p + 1 ), a0: EX1 - LAND, a1: EX0 + LAND } );
		turnRail( EX1 - LAND, fb.L( EX1 - LAND ), LANE + 0.04, - LANE - 0.04 );
		ceilQ( 'paint', EX1 - LAND, EX1, SZ0, SZ1, mid - 0.42 );
		ceilQ( 'paint', EX0, EX0 + LAND, SZ0, SZ1, floorY( p + 1 ) - 0.42 );
		wall( 'paint', 'z', SZ0, SZ1, EX0, floorY( p + 1 ) + HALL_H, y, 1 );

	}

	// a flight of steps from (xa, ya) down to (xb, yb), in the lane z0..z1. zIn is the lane's open side (toward the other
	// flight), the other side is the shaft wall. Art pass: a dark nosing on each step, a stringer on the open side,
	// a soffit underneath, a railing with balusters on the open side and a handrail on the wall.
	function stairs( xa, xb, z0, z1, ya, yb, zIn ) {

		const n = Math.round( Math.abs( ya - yb ) / 0.18 ), dx = ( xb - xa ) / n, rise = ( ya - yb ) / n;
		const zOut = zIn === z0 ? z1 : z0, s = Math.sign( zOut - zIn ), w = z1 - z0;
		for ( let i = 0; i < n; i ++ ) {

			// the tread, and the riser at its back edge up to the step above, as flat pieces so the concrete keeps its size
			const top = ya - rise * ( i + 1 ), xn = xa + dx * i;
			floorQ( 'concrete', Math.min( xn, xn + dx ), Math.max( xn, xn + dx ), z0, z1, top );
			wall( 'concrete', 'z', z0, z1, xn, top, top + rise, Math.sign( dx ) );
			// the nosing: a dark strip along the tread's front edge (where it drops to the next step)
			box( 0.05, 0.012, w - 0.04, xn + dx - Math.sign( dx ) * 0.025, top + 0.006, ( z0 + z1 ) / 2, 'nosing' );

		}

		// the nosing line (through the treads' front edges, from the landing above to the one below), the stringer's
		// top just above it, and the soffit under the flight
		const L = x => ya - ( x - xa ) / dx * rise;
		const T = x => L( x ) + 0.04, M = x => L( x ) - 2 * rise - 0.06;
		const V = ( x, y, z ) => new THREE.Vector3( x, y, z );
		// the stringer on the open side, facing the other lane (and its back, facing this lane's underside)
		const sa = V( xa, M( xa ), zIn ), sb = V( xb, M( xb ), zIn ), ta = V( xa, T( xa ), zIn ), tb = V( xb, T( xb ), zIn );
		if ( ( xb - xa ) * s < 0 ) { para( 'paint', sa, sb, tb, ta ); para( 'paint', sb, sa, ta, tb ); } else { para( 'paint', sb, sa, ta, tb ); para( 'paint', sa, sb, tb, ta ); }
		// soffit, facing down
		const ua = V( xa, M( xa ), z0 ), ub = V( xb, M( xb ), z0 ), uc = V( xb, M( xb ), z1 ), ud = V( xa, M( xa ), z1 );
		if ( xb > xa ) para( 'paint', ua, ub, uc, ud ); else para( 'paint', ub, ua, ud, uc );

		// railing on the open side: handrail 0.9 m above the nosings, a bottom rail, balusters and posts
		const zr = zIn + s * 0.04, len = Math.abs( xb - xa );
		bar( V( xa, L( xa ) + 0.9, zr ), V( xb, L( xb ) + 0.9, zr ), 0.024 );
		bar( V( xa, L( xa ) + 0.26, zr ), V( xb, L( xb ) + 0.26, zr ), 0.014 );
		const nb = Math.round( len / 0.14 );
		for ( let i = 0; i <= nb; i ++ ) {

			const x = xa + ( xb - xa ) * i / nb, post = i === 0 || i === nb || i % 9 === 0;
			bar( V( x, L( x ) - ( post ? rise : - 0.26 ), zr ), V( x, L( x ) + 0.9, zr ), post ? 0.022 : 0.009 );

		}

		// handrail on the wall, on brackets
		const zw = zOut - s * 0.07;
		bar( V( xa, L( xa ) + 0.9, zw ), V( xb, L( xb ) + 0.9, zw ), 0.02 );
		const nk = Math.max( 2, Math.round( len / 1.6 ) );
		for ( let i = 0; i <= nk; i ++ ) { const x = xa + ( xb - xa ) * ( 0.04 + 0.92 * i / nk ); bar( V( x, L( x ) + 0.84, zw ), V( x, L( x ) + 0.84, zOut ), 0.008 ); }
		return { L, zr };

	}

	// the railing across the half landing, joining the two flights' open-side railings
	function turnRail( x, y, za, zb ) {

		const V = ( a, b, c ) => new THREE.Vector3( a, b, c );
		bar( V( x, y + 0.9, za ), V( x, y + 0.9, zb ), 0.024 );
		bar( V( x, y + 0.26, za ), V( x, y + 0.26, zb ), 0.014 );
		const n = Math.round( Math.abs( zb - za ) / 0.14 );
		for ( let i = 1; i < n; i ++ ) { const z = za + ( zb - za ) * i / n; bar( V( x, y + 0.26, z ), V( x, y + 0.9, z ), 0.009 ); }

	}

	// a flat four-cornered piece (corners counter-clockwise seen from the side it faces), into the batch for its set
	function para( set, a, b, c, d ) {

		const g = new THREE.BufferGeometry();
		const nrm = new THREE.Vector3().subVectors( b, a ).cross( new THREE.Vector3().subVectors( d, a ) ).normalize();
		const S = SETS[ set ].size, ab = a.distanceTo( b ) / S, ad = a.distanceTo( d ) / S;
		g.setAttribute( 'position', new THREE.Float32BufferAttribute( [ ...a.toArray(), ...b.toArray(), ...c.toArray(), ...d.toArray() ], 3 ) );
		g.setAttribute( 'normal', new THREE.Float32BufferAttribute( [ ...nrm.toArray(), ...nrm.toArray(), ...nrm.toArray(), ...nrm.toArray() ], 3 ) );
		g.setAttribute( 'uv', new THREE.Float32BufferAttribute( [ 0, 0, ab, 0, ab, ad, 0, ad ], 2 ) );
		g.setIndex( [ 0, 1, 2, 0, 2, 3 ] );
		( batches[ set ] ||= [] ).push( g );

	}

	function bar( a, b, r ) { bars.push( [ a, b, r ] ); }

	function box( w, h, d, x, y, z, set ) { ( boxes[ set ] ||= [] ).push( [ w, h, d, x, y, z ] ); }
	// a parking pillar: four faces in the concrete batch (so the texture keeps its size), and a painted band
	function pillar( x, z, y, h ) {

		const r = 0.25;
		wall( 'concrete', 'x', x - r, x + r, z + r, y, y + h, 1 ); wall( 'concrete', 'x', x - r, x + r, z - r, y, y + h, - 1 );
		wall( 'concrete', 'z', z - r, z + r, x + r, y, y + h, 1 ); wall( 'concrete', 'z', z - r, z + r, x - r, y, y + h, - 1 );
		box( 0.52, 0.25, 0.52, x, y + 1.02, z, 'curb' );

	}

	// ---- the flooded corridor: the floor drops 8 cm to bare wet concrete under 10 cm of murky water
	function buildFlood( y ) {

		const F = FLOOD, fy = y - F.sink;
		floorQ( 'garage', F.x0, F.x1, 0, HALL_W, fy );
		// the sunken edges: down from the carpet at each end, and along both walls
		wall( 'garage', 'z', 0, HALL_W, F.x0, fy, y, 1 ); wall( 'garage', 'z', 0, HALL_W, F.x1, fy, y, - 1 );
		wall( 'paint', 'x', F.x0, F.x1, 0, fy, y, 1 ); wall( 'paint', 'x', F.x0, F.x1, HALL_W, fy, y, - 1 );
		const W = buildWater( { x0: F.x0, x1: F.x1, z0: 0, z1: HALL_W, depth: F.sink, water: F.level }, zoneLightNode, { color: 0x5e6457, flatColor: 0x5a6055, opacity: 0.68, reflect: 0.45, caustics: 0.3, rings: 3 } );
		W.mesh.position.y += y;
		group.add( W.mesh ); waters.push( W ); floodWater = W;

	}

	// drips now and then; ripples that start before the player steps in; a wake while wading
	let dripT = 2, wakeT = 0, aheadArmed = true;
	const onFloodFloor = pos => Math.round( - ( pos.y - 1.62 ) / FLOOR_DY ) + 1 === FLOOD.p;
	const inFlood = pos => onFloodFloor( pos ) && pos.x > FLOOD.x0 && pos.x < FLOOD.x1 && pos.z > 0 && pos.z < HALL_W;
	function updateFlood( pos, dt, moving ) {

		if ( ! floodWater ) return;
		floodWater.update( dt );
		const F = FLOOD;
		if ( ( dripT -= dt ) < 0 ) { dripT = 2.5 + Math.random() * 3.5; floodWater.ring( 0, F.x0 + 0.5 + Math.random() * ( F.x1 - F.x0 - 1 ), 0.3 + Math.random() * ( HALL_W - 0.6 ) ); }
		if ( ! onFloodFloor( pos ) ) return;
		const inside = pos.x > F.x0 && pos.x < F.x1;
		const dist = inside ? 0 : Math.min( Math.abs( pos.x - F.x0 ), Math.abs( pos.x - F.x1 ) );
		if ( ! inside && dist < 6 && aheadArmed ) {

			aheadArmed = false; // something stirs the water a few metres in, before the player gets there
			floodWater.ring( 1, pos.x < F.x0 ? F.x0 + 2.5 : F.x1 - 2.5, HALL_W * ( 0.3 + Math.random() * 0.4 ) );

		}

		if ( dist > 9 ) aheadArmed = true;
		if ( inside && moving && ( wakeT -= dt ) < 0 ) { wakeT = 0.7; floodWater.ring( 2, pos.x, pos.z ); }

	}

	// ---- the attendant's booth behind the period 4 hallway's front wall: frosted window, counter, stool, lamp
	function buildBooth( y ) {

		const B = BOOTH, z0 = HALL_W, z1 = B.z1, top = y + B.h, wdw = B.window;
		floorQ( 'garage', B.x0, B.x1, z0, z1, y );
		ceilQ( 'concrete', B.x0, B.x1, z0, z1, top );
		wall( 'paint', 'x', B.x0, B.x1, z1, y, top, - 1 );
		wall( 'paint', 'z', z0, z1, B.x0, y, top, 1 ); wall( 'paint', 'z', z0, z1, B.x1, y, top, - 1 );
		wall( 'paint', 'x', B.x0, B.x1, z0, y, top, 1, [ wdw ] ); // the inside of the hallway wall

		const M = ( color, o = {} ) => zoneMaterial( new THREE.MeshStandardMaterial( { color, roughness: 0.6, ...o } ) );
		const put = ( geo, m, x, yy, z ) => { const o = new THREE.Mesh( geo, m ); o.position.set( x, yy, z ); o.castShadow = o.receiveShadow = true; group.add( o ); return o; };
		const cx = wdw.c, bx = ( B.x0 + B.x1 ) / 2, gh = wdw.h - wdw.sill;
		// frosted glass: a little warm light comes through from the lamp inside, and only a blur of what is behind it.
		// It writes depth, or the ambient occlusion on High and Ultra would trace the room behind it onto the glass.
		const glass = new THREE.Mesh( new THREE.PlaneGeometry( wdw.w, gh ), zoneMaterial( new THREE.MeshStandardMaterial( { color: 0xd3d9d6, roughness: 0.35, transparent: true, opacity: 0.9, depthWrite: true, side: THREE.DoubleSide, emissive: 0x4a3a22, emissiveIntensity: 0.7 } ) ) );
		glass.position.set( cx, y + wdw.sill + gh / 2, z0 + 0.03 );
		group.add( glass );
		const frameM = M( 0x3a3d3b, { metalness: 0.3, roughness: 0.5 } );
		for ( const s of [ - 1, 1 ] ) put( new THREE.BoxGeometry( 0.05, gh + 0.1, 0.12 ), frameM, cx + s * ( wdw.w / 2 + 0.0 ), y + wdw.sill + gh / 2, z0 );
		put( new THREE.BoxGeometry( wdw.w + 0.1, 0.05, 0.12 ), frameM, cx, y + wdw.h, z0 );
		put( new THREE.BoxGeometry( 0.025, gh, 0.03 ), frameM, cx, y + wdw.sill + gh / 2, z0 + 0.03 ); // the middle bar
		// a ledge on the hallway side; inside, a counter under the window, a stool, a lamp, a radio, a key cabinet
		put( new THREE.BoxGeometry( wdw.w + 0.1, 0.035, 0.22 ), M( 0x6b6458 ), cx, y + wdw.sill + 0.0175, z0 - 0.11 );
		put( new THREE.BoxGeometry( B.x1 - B.x0 - 0.08, 0.04, 0.55 ), M( 0x7a7264 ), bx, y + 0.92, z0 + 0.33 );
		put( new THREE.BoxGeometry( B.x1 - B.x0 - 0.08, 0.88, 0.5 ), M( 0x55605a ), bx, y + 0.44, z0 + 0.3 );
		put( new THREE.CylinderGeometry( 0.17, 0.17, 0.05, 16 ), M( 0x26282a ), cx + 0.25, y + 0.68, z0 + 0.95 );
		put( new THREE.CylinderGeometry( 0.025, 0.025, 0.66, 8 ), M( 0x8a8c8e, { metalness: 0.6, roughness: 0.4 } ), cx + 0.25, y + 0.33, z0 + 0.95 );
		const lampX = cx + wdw.w / 2 - 0.15;
		put( new THREE.CylinderGeometry( 0.07, 0.08, 0.02, 16 ), M( 0x2c2e30 ), lampX, y + 0.95, z0 + 0.42 );
		put( new THREE.CylinderGeometry( 0.008, 0.008, 0.32, 6 ), M( 0x2c2e30 ), lampX, y + 1.1, z0 + 0.42 );
		put( new THREE.CylinderGeometry( 0.045, 0.1, 0.13, 16, 1, true ), new THREE.MeshStandardMaterial( { color: 0xf3d9a4, emissive: 0xffc77a, emissiveIntensity: 2.2, side: THREE.DoubleSide } ), lampX, y + 1.27, z0 + 0.42 );
		put( new THREE.BoxGeometry( 0.26, 0.13, 0.09 ), M( 0x3b3530 ), cx - 0.35, y + 1.005, z0 + 0.45 );
		put( new THREE.BoxGeometry( 0.45, 0.55, 0.07 ), M( 0x8a8e86 ), bx + 0.6, y + 1.55, z1 - 0.035 );
		// the sign above the window
		const c = document.createElement( 'canvas' ); c.width = 512; c.height = 112;
		const g = c.getContext( '2d' );
		brassPlate( g, 512, 112 );
		g.fillStyle = BRASS.text; g.font = `600 58px ${ BRASS.font }`; g.textAlign = 'center'; g.fillText( 'ATTENDANT', 256, 75 );
		const t = new THREE.CanvasTexture( c ); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
		const sign = new THREE.Mesh( new THREE.PlaneGeometry( 0.9, 0.197 ), zoneMaterial( new THREE.MeshStandardMaterial( { map: t, roughness: 0.4, metalness: 0.25 } ) ) );
		sign.position.set( cx, y + wdw.h + 0.22, z0 - 0.006 ); sign.rotation.y = Math.PI;
		group.add( sign );

	}

	// ---- bake the batches into meshes
	for ( const set in batches ) {

		const g = mergeGeometries( batches[ set ] );
		const m = new THREE.Mesh( g );
		m.receiveShadow = true;
		group.add( m ); surfaces.push( { mesh: m, set } );

	}

	for ( const set in boxes ) {

		const list = boxes[ set ];
		const geo = new THREE.BoxGeometry( 1, 1, 1 );
		const im = new THREE.InstancedMesh( geo, undefined, list.length );
		list.forEach( ( [ w, h, d, x, y, z ], i ) => im.setMatrixAt( i, tmpM.compose( new THREE.Vector3( x, y, z ), tmpQ.identity(), new THREE.Vector3( w, h, d ) ) ) );
		im.castShadow = im.receiveShadow = true;
		group.add( im ); surfaces.push( { mesh: im, set } );

	}

	const inst = ( geo, mat, list, scale ) => {

		const im = new THREE.InstancedMesh( geo, mat, list.length );
		list.forEach( ( p, i ) => im.setMatrixAt( i, tmpM.compose( p, tmpQ.identity(), scale || one ) ) );
		group.add( im );
		return im;

	};

	// railings: one instanced mesh of round bars, painted metal, dark with the stairwell
	if ( bars.length ) {

		const railMat = zoneMaterial( new THREE.MeshStandardMaterial( { color: 0x4d5852, roughness: 0.5, metalness: 0.2 } ) );
		const im = new THREE.InstancedMesh( new THREE.CylinderGeometry( 1, 1, 1, 8 ), railMat, bars.length );
		const up = new THREE.Vector3( 0, 1, 0 ), d = new THREE.Vector3(), mid = new THREE.Vector3(), sc = new THREE.Vector3();
		bars.forEach( ( [ a, b, r ], i ) => {

			d.subVectors( b, a ); const l = d.length();
			tmpQ.setFromUnitVectors( up, d.normalize() );
			im.setMatrixAt( i, tmpM.compose( mid.addVectors( a, b ).multiplyScalar( 0.5 ), tmpQ, sc.set( r, l, r ) ) );

		} );
		im.castShadow = im.receiveShadow = true;
		group.add( im );

	}

	inst( housingGeo, housingMat, housings );
	const onMesh = inst( tubeGeo, tubeOn, tubesOn );
	inst( tubeGeo, tubeOff, tubesOff );
	// the same lit tubes, drawn dark; each tube is shown in exactly one of the two meshes
	const zero = new THREE.Vector3( 0, 0, 0 );
	const darkMesh = inst( tubeGeo, tubeOff, tubesOn, zero );
	const zoneTubes = new Map();
	tubeZone.forEach( ( z, i ) => { if ( ! zoneTubes.has( z ) ) zoneTubes.set( z, [] ); zoneTubes.get( z ).push( i ); } );
	function setZoneLit( zone, lit ) {

		if ( ! zoneLit.has( zone ) || zoneLit.get( zone ) === lit ) return;
		zoneLit.set( zone, lit );
		for ( const i of zoneTubes.get( zone ) || [] ) {

			onMesh.setMatrixAt( i, tmpM.compose( tubesOn[ i ], tmpQ.identity(), lit ? one : zero ) );
			darkMesh.setMatrixAt( i, tmpM.compose( tubesOn[ i ], tmpQ.identity(), lit ? zero : one ) );

		}

		onMesh.instanceMatrix.needsUpdate = darkMesh.instanceMatrix.needsUpdate = true;
		for ( const i of texels( zone ) ) zoneTarget[ i ] = lit ? 1 : 0;

	}

	function texels( zone ) {

		const [ k, a, b ] = zone.split( ':' );
		if ( k === 's' ) return [ ( + a - 1 ) * 2 * ZW, ( ( + a - 1 ) * 2 + 1 ) * ZW ];
		if ( k === 'e' ) return [ ( + a - 1 ) * 2 * ZW + 19, ( ( + a - 1 ) * 2 + 1 ) * ZW + 19 ];
		if ( k === 'h' ) return [ ( + a - 1 ) * 2 * ZW + + b ];
		const r = rooms.find( q => q.e.sym === a );
		return [ ( ( r.e.period - 1 ) * 2 + 1 ) * ZW + r.e.group ];

	}

	// ease what the surfaces show toward the zones' state: lights fail with a flicker, and come back on more slowly
	function updateDark( dt ) {

		let changed = false;
		for ( let i = 0; i < zoneShow.length; i ++ ) {

			const s = zoneShow[ i ], t = zoneTarget[ i ];
			if ( s === t ) continue;
			let v = t < s ? ( Math.random() < 0.12 ? Math.min( 1, s + 0.5 ) : s - dt * 1.6 ) : s + dt * 1.2;
			v = t < s ? Math.max( t, v ) : Math.min( t, v );
			zoneShow[ i ] = v; zoneData[ i * 4 ] = Math.round( v * 255 ); changed = true;

		}

		if ( changed ) zoneTex.needsUpdate = true;

	}

	const allLit = () => { for ( const z of [ ...zoneLit.keys() ] ) setZoneLit( z, true ); };
	const isLit = z => zoneLit.get( z ) !== false;

	// which zone a position (the player's eye) is in: rooms first, then the hallway, then the stairwell
	function zoneAt( pos ) {

		const p = Math.max( 1, Math.min( 4, Math.round( - ( pos.y - 1.62 ) / FLOOR_DY ) + 1 ) );
		if ( pos.x < 0 ) return 's:' + p;
		if ( pos.x > XE ) return 'e:' + p;
		if ( pos.z < 0 ) {

			for ( const r of rooms ) if ( r.e.period === p && pos.x >= r.x0 && pos.x <= r.x1 && pos.z >= r.z0 ) return 'r:' + r.e.sym;

		}

		return hallZone( p, pos.x );

	}

	// a zone and the zones next to it, for the ambient light and the hum
	function nearZones( zone ) {

		const [ k, a, b ] = zone.split( ':' );
		if ( k === 'r' ) { const r = rooms.find( q => q.e.sym === a ); return [ zone, hallZone( r.e.period, r.cx ) ]; }
		if ( k === 's' ) return [ zone, `h:${ a }:1` ];
		if ( k === 'e' ) return [ zone, `h:${ a }:18` ];
		const g = + b, out = [ zone, `h:${ a }:${ g - 1 }`, `h:${ a }:${ g + 1 }` ];
		for ( const r of rooms ) if ( r.e.period === + a && r.e.group === g ) out.push( 'r:' + r.e.sym );
		if ( g === 1 ) out.push( 's:' + a );
		if ( g === 18 ) out.push( 'e:' + a );
		return out.filter( z => zoneLit.has( z ) );

	}

	// ---- door plates: element symbol and atomic number; the tiled rooms (p block) also show the short configuration
	for ( const pl of plates ) {

		const W = 320, H = 256;
		const c = document.createElement( 'canvas' ); c.width = W; c.height = H;
		const g = c.getContext( '2d' );
		brassPlate( g, W, H );
		g.fillStyle = BRASS.text; g.font = `600 46px ${ BRASS.font }`; g.textAlign = 'left'; g.fillText( String( pl.e.z ), 30, 66 );
		const conf = pl.kind === 'pool';
		g.font = `600 ${ conf ? 104 : 128 }px ${ BRASS.font }`; g.textAlign = 'center'; g.fillText( pl.e.sym, W / 2, conf ? 160 : 196 );
		if ( conf ) {

			const txt = shortConfig( pl.e.z );
			let fs = 38; g.font = `600 ${ fs }px ${ BRASS.font }`;
			while ( g.measureText( txt ).width > W - 40 && fs > 18 ) { fs -= 2; g.font = `600 ${ fs }px ${ BRASS.font }`; }
			g.fillText( txt, W / 2, 220 );

		}

		const t = new THREE.CanvasTexture( c ); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
		const m = new THREE.Mesh( new THREE.PlaneGeometry( 0.45, 0.36 ), zoneMaterial( new THREE.MeshStandardMaterial( { map: t, roughness: 0.4, metalness: 0.25 } ) ) );
		m.position.set( pl.x, pl.y, pl.z + 0.005 );
		group.add( m );

	}

	// ---- the parking level: each room is one painted bay with the 3d electron count in it (no number for Cr and Cu:
	// out of scope) and a few oil stains on the floor; the wheel stop and the pillars are added with the room
	const stainTex = ( () => {

		const c = document.createElement( 'canvas' ); c.width = c.height = 128;
		const g = c.getContext( '2d' );
		for ( const [ x, y, r, a ] of [ [ 64, 64, 60, 0.5 ], [ 50, 72, 30, 0.35 ], [ 80, 52, 24, 0.3 ] ] ) {

			const gr = g.createRadialGradient( x, y, 0, x, y, r );
			gr.addColorStop( 0, `rgba(24,21,17,${ a })` ); gr.addColorStop( 0.6, `rgba(24,21,17,${ a * 0.6 })` ); gr.addColorStop( 1, 'rgba(24,21,17,0)' );
			g.fillStyle = gr; g.fillRect( 0, 0, 128, 128 );

		}

		const t = new THREE.CanvasTexture( c ); t.colorSpace = THREE.SRGBColorSpace;
		return t;

	} )();
	const stainMat = zoneMaterial( new THREE.MeshStandardMaterial( { map: stainTex, transparent: true, depthWrite: false, roughness: 0.3 } ) );
	const decal = ( w, d, m, x, y, z, rot = 0 ) => { const o = new THREE.Mesh( new THREE.PlaneGeometry( w, d ), m ); o.rotation.set( - Math.PI / 2, 0, rot ); o.position.set( x, y, z ); group.add( o ); return o; };
	for ( const b of bays ) {

		const BW = 2.8, BD = Math.min( 5.2, b.side * 0.7 ), bz = - b.side * 0.5;
		const W = 512, H = Math.round( W * BD / ( BW + 0.2 ) ), px = W / ( BW + 0.2 );
		const c = document.createElement( 'canvas' ); c.width = W; c.height = H;
		const g = c.getContext( '2d' );
		// the outline: two sides and the back (the canvas top is the back of the bay, toward the room's back wall)
		g.fillStyle = '#dedad0';
		const lw = 0.12 * px;
		g.fillRect( 0.1 * px - lw / 2, 0, lw, H ); g.fillRect( W - 0.1 * px - lw / 2, 0, lw, H ); g.fillRect( 0.1 * px - lw / 2, 0, W - 0.2 * px + lw, lw );
		if ( b.n !== null ) {

			g.fillStyle = '#e3c950'; g.font = `700 ${ Math.round( 1.3 * px ) }px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
			g.fillText( String( b.n ), W / 2, H * 0.55 );

		}

		const t = new THREE.CanvasTexture( c ); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
		decal( BW + 0.2, BD, zoneMaterial( new THREE.MeshStandardMaterial( { map: t, transparent: true, roughness: 0.8, depthWrite: false } ) ), b.x, b.y + 0.008, bz );
		// oil stains where cars stood (placed from the element's number, so every run looks the same)
		let r = b.seed * 9301 + 49297;
		const rnd = () => ( r = ( r * 9301 + 49297 ) % 233280 ) / 233280;
		for ( let i = 0; i < 3; i ++ ) {

			const sz = 0.5 + rnd() * 0.8;
			decal( sz, sz * ( 0.7 + rnd() * 0.5 ), stainMat, b.x + ( rnd() - 0.5 ) * 1.4, b.y + 0.005 + i * 0.001, bz + ( rnd() - 0.4 ) * BD * 0.6, rnd() * Math.PI );

		}

	}

	// ---- floor numbers painted on the stairwell walls at each floor's landing (both stairwells, both lanes),
	// with the company's brass plaque under each
	const plaque = ( () => {

		const c = document.createElement( 'canvas' ); c.width = 512; c.height = 128;
		const g = c.getContext( '2d' );
		brassPlate( g, 512, 128 );
		g.fillStyle = BRASS.text; g.textAlign = 'center';
		g.font = `600 44px ${ BRASS.font }`; g.fillText( 'CALDER & FINCH', 256, 62 );
		g.font = `italic 28px ${ BRASS.font }`; g.fillText( 'Maintenance', 256, 100 );
		const t = new THREE.CanvasTexture( c ); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
		return zoneMaterial( new THREE.MeshStandardMaterial( { map: t, roughness: 0.4, metalness: 0.25 } ) );

	} )();
	for ( let p = 1; p <= 4; p ++ ) {

		const c = document.createElement( 'canvas' ); c.width = 256; c.height = 320;
		const g = c.getContext( '2d' );
		g.fillStyle = BRASS.paint; g.textAlign = 'center';
		g.font = `600 48px ${ BRASS.font }`; g.fillText( 'FLOOR', 128, 52 );
		g.font = `600 250px ${ BRASS.font }`; g.fillText( String( p ), 128, 292 );
		const t = new THREE.CanvasTexture( c ); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
		const m = zoneMaterial( new THREE.MeshStandardMaterial( { map: t, transparent: true, roughness: 0.9, depthWrite: false } ) );
		for ( const [ x, z, ry ] of [ [ - 1, SZ0 + 0.006, 0 ], [ - 1, SZ1 - 0.006, Math.PI ], [ EX0 + 1, SZ0 + 0.006, 0 ], [ EX0 + 1, SZ1 - 0.006, Math.PI ] ] ) {

			const o = new THREE.Mesh( new THREE.PlaneGeometry( 0.56, 0.7 ), m );
			o.position.set( x, floorY( p ) + 1.55, z ); o.rotation.y = ry;
			group.add( o );
			const q = new THREE.Mesh( new THREE.PlaneGeometry( 0.44, 0.11 ), plaque );
			q.position.set( x, floorY( p ) + 1.07, z + ( ry ? - 0.002 : 0.002 ) ); q.rotation.y = ry;
			group.add( q );

		}

	}

	// ---- real lights: a fixed pool, moved to the candidate positions nearest the player each half second
	const hemi = new THREE.HemisphereLight( 0xeef1f4, 0xb4b8bc, 1.5 );
	scene.add( hemi );
	const POOL = 8;
	const pool = [];
	for ( let i = 0; i < POOL; i ++ ) {

		const s = new THREE.SpotLight( 0xf4f7ff, 0, 12, 1.25, 0.9, 1.6 );
		s.shadow.bias = - 0.0004; s.shadow.normalBias = 0.02; s.shadow.radius = 4;
		s.shadow.camera.near = 0.2; s.shadow.camera.far = 8;
		scene.add( s, s.target );
		pool.push( s );

	}

	let shadowCount = 0;
	function updateLights( pos ) {

		const floor = Math.round( - pos.y / FLOOR_DY ) + 1;
		const near = lightSpots.filter( l => isLit( l.zone ) && ( Math.abs( l.floor - floor ) === 0 || Math.abs( l.pos.y - pos.y ) < 4 ) )
			.map( l => [ l, l.pos.distanceToSquared( pos ) ] ).sort( ( a, b ) => a[ 1 ] - b[ 1 ] ).slice( 0, POOL );
		pool.forEach( ( s, i ) => {

			const l = near[ i ]?.[ 0 ];
			if ( ! l ) { s.intensity = 0; return; }
			s.position.copy( l.pos ); s.target.position.set( l.pos.x, l.pos.y - 3, l.pos.z );
			s.intensity = l.intensity; s.distance = Math.max( 8, l.reach + 4 );
			s.castShadow = i < shadowCount;

		} );

	}

	function apply( T, envMap ) {

		for ( const s of surfaces ) s.mesh.material = material( s.set, T.lit === 'baked' ? 'baked' : T.tex );
		shadowCount = T.shadow ? 3 : 0;
		pool.forEach( ( s, i ) => { if ( T.shadow && i < shadowCount ) { s.shadow.mapSize.set( T.shadow, T.shadow ); if ( s.shadow.map ) { s.shadow.map.dispose(); s.shadow.map = null; } } s.castShadow = i < shadowCount; } );
		for ( const w of waters ) w.setMode( T.water, envMap );

	}

	const room = sym => rooms.find( r => r.e.sym === sym );
	return { group, walk, rooms, room, apply, updateLights, hemi, zoneAt, nearZones, setZoneLit, allLit, isLit, updateDark, zones: zoneLit, hallEnds, zoneMaterial, updateFlood, inFlood, flood: FLOOD, booth: BOOTH };

}

// minimal merge (positions, normals, uvs, indices) so the building is a few draw calls per material
function mergeGeometries( list ) {

	let nv = 0, ni = 0;
	for ( const g of list ) { nv += g.attributes.position.count; ni += g.index.count; }
	const pos = new Float32Array( nv * 3 ), nor = new Float32Array( nv * 3 ), uv = new Float32Array( nv * 2 ), idx = new Uint32Array( ni );
	let ov = 0, oi = 0;
	for ( const g of list ) {

		pos.set( g.attributes.position.array, ov * 3 ); nor.set( g.attributes.normal.array, ov * 3 ); uv.set( g.attributes.uv.array, ov * 2 );
		const I = g.index.array;
		for ( let i = 0; i < I.length; i ++ ) idx[ oi + i ] = I[ i ] + ov;
		ov += g.attributes.position.count; oi += I.length;
		g.dispose();

	}

	const out = new THREE.BufferGeometry();
	out.setAttribute( 'position', new THREE.BufferAttribute( pos, 3 ) );
	out.setAttribute( 'normal', new THREE.BufferAttribute( nor, 3 ) );
	out.setAttribute( 'uv', new THREE.BufferAttribute( uv, 2 ) );
	out.setIndex( new THREE.BufferAttribute( idx, 1 ) );
	out.computeBoundingSphere();
	return out;

}
