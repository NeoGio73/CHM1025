// Look test geometry: one office (s block), a stretch of hallway and one pool room (p block).
// Everything here is generated in code; surfaces use the CC0 texture sets in public/textures (see ../CREDITS.md).
// Units are metres. The hallway runs along +x; the office is at the west end, the pool room at the east end.

import * as THREE from 'three/webgpu';
import { texture, uv, time, vec2, vec3, vec4, float, sin, abs, pow, mix, normalMap, positionWorld, output, Fn } from 'three/tsl';

// texture sets: real-world size of one texture repeat (m) and the average color used on the Low tier
const SETS = {
	carpet: { size: 1.6, avg: 0x343b48, rough: 1 },
	wall: { size: 1.4, avg: 0xe0e1dc, rough: 1 },
	ceiling: { size: 2.4, avg: 0xf2f2f0, rough: 1 },
	tile: { size: 1.2, avg: 0xeeeeec, rough: 0.6 },
	pooltile: { size: 0.9, avg: 0x3bb5d3, rough: 0.6 }
};

export const LAYOUT = {
	office: { x0: - 12, x1: - 4, z0: - 4.5, z1: 4.5, h: 2.75 },
	hall: { x0: - 4, x1: 10, z0: - 1.25, z1: 1.25, h: 2.6 },
	pool: { x0: 10, x1: 21, z0: - 5.5, z1: 5.5, h: 3.1 },
	basin: { x0: 12.5, x1: 18.5, z0: - 3.5, z1: 3.5, depth: 0.55, water: - 0.12 },
	door: { w: 1.1, h: 2.1 }
};

export function buildWorld( scene ) {

	const loader = new THREE.TextureLoader();
	const texCache = {};
	function tex( res, name, map, color ) {

		const k = `${ res }/${ name }_${ map }`;
		if ( ! texCache[ k ] ) {

			const t = loader.load( `./textures/${ k }.jpg` );
			t.wrapS = t.wrapT = THREE.RepeatWrapping;
			t.anisotropy = 8;
			t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
			texCache[ k ] = t;

		}

		return texCache[ k ];

	}

	// one material per set and variant; geometry UVs are in texture repeats, so materials are shared
	const mats = {};
	for ( const name in SETS ) {

		const S = SETS[ name ];
		mats[ name ] = {
			pbr: res => {

				const m = new THREE.MeshStandardMaterial( { map: tex( res, name, 'color', true ), normalMap: tex( res, name, 'normal' ), aoMap: tex( res, name, 'orm' ), roughnessMap: tex( res, name, 'orm' ), roughness: S.rough, metalness: 0 } );
				m.aoMapIntensity = 0.8;
				m.normalScale.set( 1, 1 );
				return m;

			},
			baked: () => new THREE.MeshLambertMaterial( { color: S.avg } )
		};

	}

	const surfaces = []; // { mesh, set }
	const group = new THREE.Group();
	scene.add( group );

	// a rectangle with UVs in texture repeats; normal faces the given direction
	function quad( set, w, h, pos, rotY = 0, rotX = 0 ) {

		const g = new THREE.PlaneGeometry( w, h );
		const s = SETS[ set ].size;
		const a = g.attributes.uv;
		for ( let i = 0; i < a.count; i ++ ) a.setXY( i, a.getX( i ) * w / s, a.getY( i ) * h / s );
		const m = new THREE.Mesh( g );
		m.position.copy( pos );
		m.rotation.order = 'YXZ';
		m.rotation.y = rotY; m.rotation.x = rotX;
		m.receiveShadow = true;
		group.add( m );
		surfaces.push( { mesh: m, set } );
		return m;

	}

	// a wall along one side with optional door openings (centre c along the wall, width w)
	function wall( set, ax, a0, a1, fixed, h, facing, doors = [], y0 = 0 ) {

		const cuts = [ ...doors ].sort( ( p, q ) => p.c - q.c );
		let a = a0;
		const piece = ( b0, b1, yb, yt ) => {

			if ( b1 - b0 < 1e-3 || yt - yb < 1e-3 ) return;
			const mid = ( b0 + b1 ) / 2, ym = ( yb + yt ) / 2;
			const pos = ax === 'x' ? new THREE.Vector3( mid, ym, fixed ) : new THREE.Vector3( fixed, ym, mid );
			const rot = ax === 'x' ? ( facing > 0 ? 0 : Math.PI ) : ( facing > 0 ? Math.PI / 2 : - Math.PI / 2 );
			quad( set, b1 - b0, yt - yb, pos, rot );

		};

		for ( const d of cuts ) {

			piece( a, d.c - d.w / 2, y0, h );
			piece( d.c - d.w / 2, d.c + d.w / 2, d.h, h ); // lintel
			a = d.c + d.w / 2;

		}

		piece( a, a1, y0, h );

	}

	function room( R, floorSet, wallSet, open = {}, doors = {} ) {

		const cx = ( R.x0 + R.x1 ) / 2, cz = ( R.z0 + R.z1 ) / 2, w = R.x1 - R.x0, d = R.z1 - R.z0;
		if ( floorSet ) quad( floorSet, w, d, new THREE.Vector3( cx, 0, cz ), 0, - Math.PI / 2 );
		quad( 'ceiling', w, d, new THREE.Vector3( cx, R.h, cz ), 0, Math.PI / 2 );
		if ( ! open.n ) wall( wallSet, 'x', R.x0, R.x1, R.z0, R.h, 1, doors.n );
		if ( ! open.s ) wall( wallSet, 'x', R.x0, R.x1, R.z1, R.h, - 1, doors.s );
		if ( ! open.w ) wall( wallSet, 'z', R.z0, R.z1, R.x0, R.h, 1, doors.w );
		if ( ! open.e ) wall( wallSet, 'z', R.z0, R.z1, R.x1, R.h, - 1, doors.e );

	}

	const { office, hall, pool, basin, door } = LAYOUT;
	const D = { c: 0, w: door.w, h: door.h };
	room( office, 'carpet', 'wall', {}, { e: [ D ] } );
	room( hall, 'carpet', 'wall', { w: true, e: true } );
	// pool room: tile floor is built around the basin
	room( pool, null, 'tile', {}, { w: [ D ] } );
	const deck = [
		[ pool.x0, basin.x0, pool.z0, pool.z1 ], [ basin.x1, pool.x1, pool.z0, pool.z1 ],
		[ basin.x0, basin.x1, pool.z0, basin.z0 ], [ basin.x0, basin.x1, basin.z1, pool.z1 ]
	];
	for ( const [ x0, x1, z0, z1 ] of deck ) quad( 'tile', x1 - x0, z1 - z0, new THREE.Vector3( ( x0 + x1 ) / 2, 0, ( z0 + z1 ) / 2 ), 0, - Math.PI / 2 );
	// basin: floor and four inner walls in blue pool tile
	const bd = - basin.depth, bw = basin.x1 - basin.x0, bl = basin.z1 - basin.z0;
	quad( 'pooltile', bw, bl, new THREE.Vector3( ( basin.x0 + basin.x1 ) / 2, bd, 0 ), 0, - Math.PI / 2 );
	wall( 'pooltile', 'x', basin.x0, basin.x1, basin.z0, 0, - 1, [], bd );
	wall( 'pooltile', 'x', basin.x0, basin.x1, basin.z1, 0, 1, [], bd );
	wall( 'pooltile', 'z', basin.z0, basin.z1, basin.x0, 0, - 1, [], bd );
	wall( 'pooltile', 'z', basin.z0, basin.z1, basin.x1, 0, 1, [], bd );
	// door frames: thin returns so the openings have depth
	for ( const x of [ office.x1, pool.x0 ] ) {

		for ( const s of [ - 1, 1 ] ) quad( 'wall', 0.16, door.h, new THREE.Vector3( x, door.h / 2, s * door.w / 2 ), s > 0 ? Math.PI : 0 );
		quad( 'wall', 0.16, door.w, new THREE.Vector3( x, door.h, 0 ), 0, Math.PI / 2 );

	}

	// ---- props: skirting, desks and chairs (simple, in code)
	const trimMat = new THREE.MeshStandardMaterial( { color: 0x5d6168, roughness: 0.6 } );
	const deskMat = new THREE.MeshStandardMaterial( { color: 0xb9ad98, roughness: 0.55 } );
	const legMat = new THREE.MeshStandardMaterial( { color: 0x3c3f44, roughness: 0.4, metalness: 0.6 } );
	const chairMat = new THREE.MeshStandardMaterial( { color: 0x2f3440, roughness: 0.85 } );
	const props = [];
	const box = ( w, h, d, mat, x, y, z ) => {

		const m = new THREE.Mesh( new THREE.BoxGeometry( w, h, d ), mat );
		m.position.set( x, y, z ); m.castShadow = true; m.receiveShadow = true;
		group.add( m ); props.push( m );
		return m;

	};

	function desk( x, z, rot ) {

		const g = new THREE.Group();
		const add = ( ...a ) => { const m = box( ...a ); group.remove( m ); g.add( m ); };
		add( 1.4, 0.04, 0.7, deskMat, 0, 0.73, 0 );
		for ( const sx of [ - 0.66, 0.66 ] ) add( 0.04, 0.71, 0.62, legMat, sx, 0.355, 0 );
		add( 1.3, 0.35, 0.02, deskMat, 0, 0.5, - 0.3 );
		// chair
		add( 0.46, 0.06, 0.46, chairMat, 0, 0.46, 0.55 );
		add( 0.46, 0.5, 0.06, chairMat, 0, 0.74, 0.78 );
		add( 0.05, 0.43, 0.05, legMat, 0, 0.215, 0.55 );
		add( 0.5, 0.03, 0.06, legMat, 0, 0.03, 0.55 );
		add( 0.06, 0.03, 0.5, legMat, 0, 0.03, 0.55 );
		g.position.set( x, 0, z ); g.rotation.y = rot;
		group.add( g );

	}

	desk( - 9.6, - 2.6, 0 );
	desk( - 7.0, - 2.6, 0 );
	desk( - 9.6, 2.2, Math.PI );
	// skirting along the office and hallway walls
	const skirt = ( x0, x1, z0, z1 ) => box( Math.max( x1 - x0, 0.02 ), 0.08, Math.max( z1 - z0, 0.02 ), trimMat, ( x0 + x1 ) / 2, 0.04, ( z0 + z1 ) / 2 );
	skirt( office.x0, office.x1, office.z0, office.z0 + 0.02 ); skirt( office.x0, office.x1, office.z1 - 0.02, office.z1 );
	skirt( office.x0, office.x0 + 0.02, office.z0, office.z1 );
	skirt( hall.x0, hall.x1, hall.z0, hall.z0 + 0.02 ); skirt( hall.x0, hall.x1, hall.z1 - 0.02, hall.z1 );
	for ( const p of props ) if ( p.geometry.parameters.height === 0.08 ) p.castShadow = false;

	// ---- tube lights: emissive fixtures plus a few real lights
	const tubeMat = new THREE.MeshStandardMaterial( { color: 0xffffff, emissive: 0xf4f8ff, emissiveIntensity: 6, roughness: 0.4 } );
	const housingMat = new THREE.MeshStandardMaterial( { color: 0xd8d8d4, roughness: 0.5, metalness: 0.2 } );
	const fixtures = [];
	function fixture( x, z, h, along = 'x' ) {

		const g = new THREE.Group();
		const hw = along === 'x' ? [ 1.2, 0.3 ] : [ 0.3, 1.2 ];
		const hb = new THREE.Mesh( new THREE.BoxGeometry( hw[ 0 ] + 0.04, 0.02, hw[ 1 ] + 0.04 ), housingMat );
		g.add( hb );
		for ( const o of [ - 0.075, 0.075 ] ) {

			const t = new THREE.Mesh( new THREE.CylinderGeometry( 0.016, 0.016, 1.16, 10 ), tubeMat );
			t.rotation.z = along === 'x' ? Math.PI / 2 : 0;
			t.rotation.x = along === 'x' ? 0 : Math.PI / 2;
			if ( along === 'x' ) t.position.z = o; else t.position.x = o;
			t.position.y = - 0.03;
			g.add( t );

		}

		g.position.set( x, h - 0.012, z );
		group.add( g );
		fixtures.push( g );

	}

	for ( const x of [ - 10.4, - 8, - 5.6 ] ) for ( const z of [ - 2.4, 0, 2.4 ] ) fixture( x, z, office.h );
	for ( let x = - 2.5; x < 10; x += 3 ) fixture( x, 0, hall.h, 'x' );
	for ( const x of [ 12.5, 15.5, 18.5 ] ) for ( const z of [ - 3, 0, 3 ] ) fixture( x, z, pool.h, 'z' );

	// real lights: hemisphere for the bounce, one shadow-casting spot per area, point lights to fill
	const hemi = new THREE.HemisphereLight( 0xeef1f4, 0xb4b8bc, 1.5 );
	scene.add( hemi );
	const spots = [];
	function spot( x, z, h, intensity, angle ) {

		const s = new THREE.SpotLight( 0xf4f7ff, intensity, 14, angle, 0.9, 1.6 );
		s.position.set( x, h - 0.06, z );
		s.target.position.set( x, 0, z );
		s.shadow.bias = - 0.0004; s.shadow.normalBias = 0.02; s.shadow.radius = 4;
		s.shadow.camera.near = 0.2; s.shadow.camera.far = 8;
		scene.add( s, s.target );
		spots.push( s );
		return s;

	}

	spot( - 9.2, - 1.2, office.h, 22, 1.25 );
	spot( - 6.8, 1.2, office.h, 22, 1.25 );
	spot( 0.5, 0, hall.h, 12, 1.2 );
	spot( 6.5, 0, hall.h, 12, 1.2 );
	spot( 14, 0, pool.h, 22, 1.25 );
	spot( 18, 0, pool.h, 22, 1.25 );

	// ---- water: shallow and still, slow ripples (code shader, no texture files)
	const water = buildWater( basin );
	group.add( water.mesh );

	function apply( T, envMap ) {

		for ( const s of surfaces ) s.mesh.material = T.lit === 'baked' ? cached( s.set, 'baked' ) : cached( s.set, T.tex );
		for ( const s of spots ) { s.castShadow = T.shadow > 0; if ( T.shadow ) { s.shadow.mapSize.set( T.shadow, T.shadow ); if ( s.shadow.map ) { s.shadow.map.dispose(); s.shadow.map = null; } } }
		// Low tier: the same spots light the rooms, without shadows (a Blender light bake can replace them later)
		hemi.intensity = T.lit === 'baked' ? 1.6 : 1.5;
		for ( const p of props ) p.castShadow = T.shadow > 0;
		water.setMode( T.water, envMap );

	}

	const matCache = {};
	function cached( set, variant ) {

		const k = set + '/' + variant;
		if ( ! matCache[ k ] ) matCache[ k ] = variant === 'baked' ? mats[ set ].baked() : mats[ set ].pbr( variant );
		return matCache[ k ];

	}

	return { apply, group, fixtures, water, spots, hemi };

}

// Water: a flat plane. Full: glossy with moving normals (picked up by SSR) and caustics on the basin.
// Env: glossy with moving normals, reflections from the environment map. Flat: tinted, no animation.
// light (optional): a node from 0 (dark) to 1 (lit). The building passes its zone lighting, so the water,
// its reflections and the caustics go dark with the room; the look test passes nothing and is unchanged.
export function buildWater( B, light = null ) {

	const w = B.x1 - B.x0, l = B.z1 - B.z0;
	const geo = new THREE.PlaneGeometry( w, l );
	const mesh = new THREE.Mesh( geo );
	mesh.rotation.x = - Math.PI / 2;
	mesh.position.set( ( B.x0 + B.x1 ) / 2, B.water, ( B.z0 + B.z1 ) / 2 );

	// procedural ripple normal from a few slow travelling waves (world-space xz)
	const ripple = Fn( () => {

		const p = positionWorld.xz;
		const t = time.mul( 0.35 );
		const dx = sin( p.x.mul( 3.1 ).add( t ) ).mul( 0.6 ).add( sin( p.x.mul( 1.7 ).add( p.y.mul( 2.3 ) ).sub( t.mul( 1.3 ) ) ).mul( 0.4 ) );
		const dz = sin( p.y.mul( 2.7 ).sub( t.mul( 0.8 ) ) ).mul( 0.6 ).add( sin( p.y.mul( 1.3 ).sub( p.x.mul( 2.1 ) ).add( t.mul( 1.1 ) ) ).mul( 0.4 ) );
		return vec3( dx.mul( 0.5 ).add( 0.5 ), dz.mul( 0.5 ).add( 0.5 ), 1 );

	} )();

	const glossy = new THREE.MeshStandardNodeMaterial( { color: 0x9fd3dd, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.55 } );
	glossy.normalNode = normalMap( ripple, vec2( 0.06 ) );
	glossy.depthWrite = false;
	const flat = new THREE.MeshLambertNodeMaterial( { color: 0x7cc6d6, transparent: true, opacity: 0.6, depthWrite: false } );
	if ( light ) {

		for ( const m of [ glossy, flat ] ) m.outputNode = vec4( output.rgb.mul( light ), output.a );
		// screen-space reflections (High, Ultra) read the gloss, not the color: a dark room's water turns matte
		glossy.roughnessNode = mix( float( 1 ), float( 0.04 ), light );

	}

	// soft caustics: an additive layer just above the basin floor
	const caustMat = new THREE.MeshBasicNodeMaterial( { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending } );
	caustMat.colorNode = Fn( () => {

		const p = positionWorld.xz.mul( 2.2 );
		const t = time.mul( 0.25 );
		const a = sin( p.x.add( sin( p.y.mul( 1.3 ).add( t ) ) ).add( t ) );
		const b = sin( p.y.mul( 1.1 ).add( sin( p.x.mul( 1.7 ).sub( t ) ) ).sub( t.mul( 0.7 ) ) );
		const c = pow( float( 1 ).sub( abs( a.add( b ).mul( 0.5 ) ) ), float( 6 ) );
		const col = vec3( 0.55, 0.8, 0.85 ).mul( c ).mul( 0.35 );
		return light ? col.mul( light ) : col;

	} )();
	const caust = new THREE.Mesh( new THREE.PlaneGeometry( w - 0.02, l - 0.02 ), caustMat );
	caust.rotation.x = - Math.PI / 2;
	caust.position.set( mesh.position.x, - B.depth + 0.004, mesh.position.z );
	caust.renderOrder = 1;

	const group = new THREE.Group();
	group.add( caust );

	function setMode( mode, envMap ) {

		mesh.material = mode === 'flat' ? flat : glossy;
		glossy.envMap = envMap || null;
		glossy.envMapIntensity = mode === 'env' ? 1.0 : 0.6;
		caust.visible = mode === 'full';

	}

	mesh.add( group );
	group.rotation.x = Math.PI / 2; // undo the parent's rotation for the caustic layer
	group.position.set( 0, 0, 0 );
	caust.position.set( 0, - B.depth + 0.004 - B.water, 0 );
	return { mesh, setMode };

}
