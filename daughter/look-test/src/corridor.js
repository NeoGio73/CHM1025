// The look-test corridor: geometry, materials (three variants per surface, one per tier group),
// lights, the raymarched fog volume, the Medium-tier beam cone and glow hazes,
// and a CPU light bake that stands in for the Blender bake on the Low tier.

import * as THREE from 'three/webgpu';
import {
	Fn, texture, texture3D, uv, vec2, vec3, vec4, float, mix, uniform, time, vertexColor, screenCoordinate,
	positionLocal, positionView, viewportDepthTexture, perspectiveDepthToViewZ, cameraNear, cameraFar, saturate, smoothstep, mx_noise_float, length
} from 'three/tsl';
import { bayer16 } from 'three/addons/tsl/math/Bayer.js';
import * as TX from './textures.js';

export const LAYER_VOL = 10;

// Cherenkov-like blue. Never green.
export const GLOW_BLUE = new THREE.Color( 0x3f78ff );
const WARM = new THREE.Color( 0xff9a48 );

export function buildCorridor( scene ) {

	const mats = {}; // key -> { full, med, low }
	const statics = []; // meshes whose material swaps per tier
	const occluders = []; // AABB slabs for the CPU bake and for dose shielding: { min, max, atten }
	const lights = {};
	const S = { mats, statics, occluders, lights };

	// ---------------- textures ----------------
	const T = {
		wall: TX.wallTextures(), floor: TX.floorTextures(), conc: TX.concreteTextures(),
		door: TX.doorTextures(), puddle: TX.puddleTexture()
	};

	// ---------------- materials ----------------

	const bakeGain = uniform( 1.0 );
	S.bakeGain = bakeGain;

	function pbr( key, { maps = {}, tile = [ 1, 1 ], color = null, roughness = 1, metalness = 0, normalScale = 1, floor = false, alphaTest = 0, transparent = false } ) {

		const base = { roughness, metalness, alphaTest, transparent };
		if ( maps.map ) base.map = maps.map; else if ( color ) base.color = new THREE.Color( color );
		if ( maps.roughnessMap ) base.roughnessMap = maps.roughnessMap;
		if ( maps.metalnessMap ) base.metalnessMap = maps.metalnessMap;

		const full = new THREE.MeshStandardNodeMaterial( { ...base, normalMap: maps.normalMap || null, normalScale: new THREE.Vector2( normalScale, normalScale ) } );
		const med = new THREE.MeshStandardNodeMaterial( base );

		// Low: Lambert for the flashlight, plus baked light carried in the vertex colors as emissive
		const low = new THREE.MeshLambertNodeMaterial( { map: base.map || null, color: base.color || 0xffffff, alphaTest, transparent } );
		const albedo = base.map ? texture( base.map ).rgb : vec3( low.color.r, low.color.g, low.color.b );

		if ( floor ) {

			// puddles: their own tile at a different scale, so they do not repeat with the floor
			const puddle = texture( T.puddle, uv().mul( 0.41 ).add( vec2( 0.37, 0.11 ) ) ).r;
			const wetAlbedo = texture( base.map ).rgb.mul( mix( float( 1 ), float( 0.42 ), puddle ) );
			for ( const m of [ full, med ] ) {

				m.colorNode = vec4( wetAlbedo, 1 );
				m.roughnessNode = mix( texture( maps.roughnessMap ).r, float( 0.025 ), puddle );

			}

			low.colorNode = vec4( wetAlbedo, 1 );
			low.emissiveNode = wetAlbedo.mul( vertexColor().rgb ).mul( bakeGain );

		} else {

			low.emissiveNode = albedo.mul( vertexColor().rgb ).mul( bakeGain );

		}

		for ( const m of [ full, med, low ] ) m.shadowSide = THREE.DoubleSide;
		mats[ key ] = { full, med, low, tile };

	}

	function emissive( key, color, intensity ) {

		const m = new THREE.MeshBasicNodeMaterial();
		const c = new THREE.Color( color );
		m.colorNode = vec3( c.r, c.g, c.b ).mul( intensity );
		mats[ key ] = { full: m, med: m, low: m, tile: [ 1, 1 ], emissive: true };

	}

	pbr( 'wall', { maps: T.wall, tile: [ 4, 3 ], normalScale: 0.9 } );
	pbr( 'floor', { maps: T.floor, tile: [ 3, 3 ], normalScale: 0.7, floor: true } );
	pbr( 'conc', { maps: T.conc, tile: [ 3, 3 ], normalScale: 0.8 } );
	pbr( 'door', { maps: T.door, tile: [ 1, 1 ], normalScale: 0.8 } );
	pbr( 'metal', { color: 0x3b3d3c, roughness: 0.55, metalness: 0.7 } );
	pbr( 'pipe', { color: 0x4a4436, roughness: 0.6, metalness: 0.5 } );
	pbr( 'trim', { color: 0x2a2f31, roughness: 0.5, metalness: 0.3 } );
	pbr( 'diffuser', { color: 0x6d6b63, roughness: 0.4 } );
	pbr( 'paper', { color: 0xa9a493, roughness: 0.85 } );
	pbr( 'cardboard', { color: 0x5f4a33, roughness: 0.9 } );
	pbr( 'tile', { color: 0x8b8779, roughness: 0.9 } );
	pbr( 'sign', { maps: { map: TX.radiationSignTexture() }, roughness: 0.6 } );
	pbr( 'stripe', { maps: { map: TX.stripeTexture() }, roughness: 0.7, tile: [ 1.2, 1 ] } );
	emissive( 'bulbWarm', 0xffb36b, 30 );
	emissive( 'bulbDead', 0x1a1714, 1 );
	emissive( 'glowStrip', GLOW_BLUE, 2.6 ); // low enough that tone mapping keeps it blue, not white

	const labelKeys = {};
	function labelMat( text ) {

		const key = 'label:' + text;
		if ( ! labelKeys[ key ] ) { pbr( key, { maps: { map: TX.labelTexture( text ) }, roughness: 0.7, alphaTest: 0.3 } ); labelKeys[ key ] = true; }
		return key;

	}

	// ---------------- geometry helpers ----------------

	const AX = { x: new THREE.Vector3( 1, 0, 0 ), y: new THREE.Vector3( 0, 1, 0 ), z: new THREE.Vector3( 0, 0, 1 ) };

	function finishMesh( geo, key, { cast = true, receive = true, bake = true, layer = 0 } = {} ) {

		if ( bake && ! geo.attributes.color ) {

			const n = geo.attributes.position.count;
			geo.setAttribute( 'color', new THREE.BufferAttribute( new Float32Array( n * 3 ).fill( 0.02 ), 3 ) );

		}

		geo.computeBoundingSphere(); geo.computeBoundingBox();
		const mesh = new THREE.Mesh( geo, mats[ key ].full );
		mesh.castShadow = cast; mesh.receiveShadow = receive;
		mesh.userData.matKey = key; mesh.userData.bake = bake;
		mesh.matrixAutoUpdate = false;
		if ( layer ) mesh.layers.set( layer );
		scene.add( mesh ); statics.push( mesh );
		return mesh;

	}

	// Axis-aligned quad. face = normal direction ('+x' ... '-z'); c = coordinate along the normal axis.
	// For x faces (a, b) = (z, y); for y faces (a, b) = (x, z); for z faces (a, b) = (x, y). Subdivided for the vertex bake.
	function quad( face, c, a0, a1, b0, b1, key, { occlude = true, atten = 0.1, step = 0.35, offset = 0, bake = true, cast = true, localUV = false, uvFn = null } = {} ) {

		const sign = face[ 0 ] === '+' ? 1 : - 1, axis = face[ 1 ];
		const n = AX[ axis ].clone().multiplyScalar( sign );
		const [ ea, eb ] = axis === 'x' ? [ AX.z, AX.y ] : axis === 'y' ? [ AX.x, AX.z ] : [ AX.x, AX.y ];
		const tile = mats[ key ].tile;
		const na = Math.max( 1, Math.ceil( Math.abs( a1 - a0 ) / step ) ), nb = Math.max( 1, Math.ceil( Math.abs( b1 - b0 ) / step ) );
		const pos = [], nor = [], uvs = [], idx = [];
		for ( let j = 0; j <= nb; j ++ ) for ( let i = 0; i <= na; i ++ ) {

			const a = a0 + ( a1 - a0 ) * i / na, b = b0 + ( b1 - b0 ) * j / nb;
			const p = new THREE.Vector3().addScaledVector( ea, a ).addScaledVector( eb, b );
			p[ axis ] = c + sign * offset; // offset moves the quad along its normal
			pos.push( p.x, p.y, p.z ); nor.push( n.x, n.y, n.z );
			if ( uvFn ) uvs.push( ...uvFn( a, b ) );
			else if ( localUV ) uvs.push( i / na, j / nb );
			else uvs.push( a / tile[ 0 ], b / tile[ 1 ] );

		}

		const flip = new THREE.Vector3().crossVectors( ea, eb ).dot( n ) * Math.sign( ( a1 - a0 ) * ( b1 - b0 ) ) < 0;
		for ( let j = 0; j < nb; j ++ ) for ( let i = 0; i < na; i ++ ) {

			const v0 = j * ( na + 1 ) + i, v1 = v0 + 1, v2 = v0 + na + 1, v3 = v2 + 1;
			if ( flip ) idx.push( v0, v2, v1, v1, v2, v3 ); else idx.push( v0, v1, v2, v1, v3, v2 );

		}

		const geo = new THREE.BufferGeometry();
		geo.setAttribute( 'position', new THREE.Float32BufferAttribute( pos, 3 ) );
		geo.setAttribute( 'normal', new THREE.Float32BufferAttribute( nor, 3 ) );
		geo.setAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ) );
		geo.setIndex( idx );
		const mesh = finishMesh( geo, key, { bake, cast } );

		if ( occlude ) {

			// a 0.2 m slab behind the face
			const lo = new THREE.Vector3(), hi = new THREE.Vector3();
			const ca = [ Math.min( a0, a1 ), Math.max( a0, a1 ) ], cb = [ Math.min( b0, b1 ), Math.max( b0, b1 ) ];
			const cc = sign > 0 ? [ c - 0.2, c ] : [ c, c + 0.2 ];
			const set = ( v, k, lohi ) => { v[ k ] = lohi; };
			const ka = axis === 'x' ? 'z' : 'x', kb = axis === 'y' ? 'z' : 'y';
			set( lo, axis, cc[ 0 ] ); set( hi, axis, cc[ 1 ] ); set( lo, ka, ca[ 0 ] ); set( hi, ka, ca[ 1 ] ); set( lo, kb, cb[ 0 ] ); set( hi, kb, cb[ 1 ] );
			occluders.push( { min: lo, max: hi, atten } );

		}

		return mesh;

	}

	// Box from min/max corners, optional transform applied after (for tilted props)
	function box( min, max, key, { occlude = false, atten = 0.3, matrix = null, cast = true, bake = true } = {} ) {

		const sx = max[ 0 ] - min[ 0 ], sy = max[ 1 ] - min[ 1 ], sz = max[ 2 ] - min[ 2 ];
		const geo = new THREE.BoxGeometry( sx, sy, sz );
		geo.translate( ( min[ 0 ] + max[ 0 ] ) / 2, ( min[ 1 ] + max[ 1 ] ) / 2, ( min[ 2 ] + max[ 2 ] ) / 2 );
		if ( matrix ) geo.applyMatrix4( matrix );
		const mesh = finishMesh( geo, key, { cast, bake } );
		if ( occlude ) occluders.push( { min: new THREE.Vector3( ...min ), max: new THREE.Vector3( ...max ), atten } );
		return mesh;

	}

	function pipeZ( x, y, r, z0, z1, key ) {

		const geo = new THREE.CylinderGeometry( r, r, Math.abs( z1 - z0 ), 14, Math.ceil( Math.abs( z1 - z0 ) / 1.5 ), true );
		geo.rotateX( Math.PI / 2 ); geo.translate( x, y, ( z0 + z1 ) / 2 );
		return finishMesh( geo, key );

	}

	// ---------------- the corridor ----------------
	// Main corridor: x -1.5..1.5, y 0..3, z +2..-24 (player starts at z = 0 looking toward -z).
	// At the far end a side passage opens to +x (z -23.8..-21.2) and ends at a heavy shield door, slightly ajar.
	// The source is in the room behind that door. It is never visible directly: only its blue light is.

	const X0 = - 1.5, X1 = 1.5, Z0 = 2, Z1 = - 24, H = 3;
	const PZ0 = - 23.8, PZ1 = - 21.2, PH = 2.4, PX1 = 5.0;

	quad( '+y', 0, X0, X1, Z0, Z1, 'floor', { occlude: true } );
	quad( '-y', H, X0, X1, Z0, Z1, 'conc' );
	quad( '+x', X0, Z0, Z1, 0, H, 'wall' );
	quad( '-x', X1, Z0, PZ1, 0, H, 'wall' );
	quad( '-x', X1, PZ0, Z1, 0, H, 'wall' );
	quad( '-x', X1, PZ1, PZ0, PH, H, 'wall' );
	quad( '+z', Z1, X0, X1, 0, H, 'wall' );
	quad( '-z', Z0, X0, X1, 0, H, 'wall' );

	// side passage
	quad( '+y', 0, X1, PX1, PZ0, PZ1, 'floor' );
	quad( '-y', PH, X1, PX1, PZ0, PZ1, 'conc' );
	quad( '+z', PZ0, X1, PX1, 0, PH, 'wall' );
	quad( '-z', PZ1, X1, PX1, 0, PH, 'wall' );

	// the room behind the shield door (only ever seen through the gap)
	const RX1 = 9, RZ0 = - 25, RZ1 = - 20, RH = 3.2;
	quad( '+y', 0, PX1, RX1, RZ0, RZ1, 'conc' );
	quad( '-y', RH, PX1, RX1, RZ0, RZ1, 'conc' );
	quad( '-x', RX1, RZ0, RZ1, 0, RH, 'conc' );
	quad( '+z', RZ0, PX1, RX1, 0, RH, 'conc' );
	quad( '-z', RZ1, PX1, RX1, 0, RH, 'conc' );
	quad( '+x', PX1, RZ0, PZ0, 0, RH, 'conc' );
	quad( '+x', PX1, PZ1, RZ1, 0, RH, 'conc' );
	quad( '+x', PX1, PZ0, PZ1, PH, RH, 'conc' );

	// shield door, hinged at (PX1, PZ0), swung 4 degrees into the room
	const doorAngle = THREE.MathUtils.degToRad( 7 );
	const doorW = PZ1 - PZ0, doorT = 0.16;
	{

		const m = new THREE.Matrix4().makeTranslation( PX1, 0, PZ0 ).multiply( new THREE.Matrix4().makeRotationY( doorAngle ) );
		box( [ 0, 0.045, 0 ], [ doorT, PH - 0.02, doorW ], 'door', { matrix: m } );
		// warning sign on the corridor face of the door
		const sm = m.clone().multiply( new THREE.Matrix4().makeTranslation( - 0.006, 1.45, doorW * 0.5 ) ).multiply( new THREE.Matrix4().makeRotationY( - Math.PI / 2 ) );
		const sg = new THREE.PlaneGeometry( 0.46, 0.575 ); sg.applyMatrix4( sm );
		finishMesh( sg, 'sign', { cast: false } );
		// slices for occlusion
		for ( let k = 0; k < 12; k ++ ) {

			const b3 = new THREE.Box3();
			for ( const lx of [ 0, doorT ] ) for ( const lz of [ k * doorW / 12, ( k + 1 ) * doorW / 12 ] ) b3.expandByPoint( new THREE.Vector3( lx, 0, lz ).applyMatrix4( m ) );
			occluders.push( { min: new THREE.Vector3( b3.min.x, 0.045, b3.min.z ), max: new THREE.Vector3( b3.max.x, PH, b3.max.z ), atten: 0.04, group: 'shieldDoor' } );

		}

		// blue light leaking under the door
		const sg2 = new THREE.PlaneGeometry( doorW * 0.98, 0.04 ); sg2.rotateY( - Math.PI / 2 ); sg2.translate( PX1 - 0.002, 0.02, ( PZ0 + PZ1 ) / 2 );
		finishMesh( sg2, 'glowStrip', { cast: false, bake: false } );

	}

	// hazard stripes across the passage entrance
	quad( '+y', 0, 1.62, 1.86, PZ0, PZ1, 'stripe', { occlude: false, offset: 0.003, step: 1, cast: false, uvFn: ( a, b ) => [ b / 0.6, ( a - 1.62 ) / 0.24 ] } );

	// ordinary doors along the corridor; the one at z = -12 has the blue glow under it
	function door( side, zc, label, glow = false ) {

		const x = side < 0 ? X0 : X1, inward = side < 0 ? 1 : - 1;
		const y0 = glow ? 0.03 : 0.0;
		const xa = x, xb = x + inward * 0.045;
		box( [ Math.min( xa, xb ), y0, zc - 0.5 ], [ Math.max( xa, xb ), 2.1, zc + 0.5 ], 'door', { occlude: true, atten: 0.3 } );
		// frame
		const fx0 = x, fx1 = x + inward * 0.07;
		const lo = Math.min( fx0, fx1 ), hi = Math.max( fx0, fx1 );
		box( [ lo, 0, zc - 0.58 ], [ hi, 2.18, zc - 0.5 ], 'trim' );
		box( [ lo, 0, zc + 0.5 ], [ hi, 2.18, zc + 0.58 ], 'trim' );
		box( [ lo, 2.1, zc - 0.58 ], [ hi, 2.18, zc + 0.58 ], 'trim' );
		// label above
		const face = side < 0 ? '+x' : '-x';
		quad( face, x, side < 0 ? zc + 0.22 : zc - 0.22, side < 0 ? zc - 0.22 : zc + 0.22, 2.24, 2.4, labelMat( label ), { occlude: false, offset: 0.004, step: 1, cast: false, localUV: true } );
		if ( glow ) {

			const g = new THREE.PlaneGeometry( 0.98, 0.03 ); g.rotateY( side < 0 ? Math.PI / 2 : - Math.PI / 2 ); g.translate( x + inward * 0.025, 0.015, zc );
			finishMesh( g, 'glowStrip', { cast: false, bake: false } );

		}

	}

	door( - 1, - 5, 'C-201' );
	door( 1, - 8.5, 'C-202' );
	door( - 1, - 12, 'C-203', true );
	door( 1, - 15.5, 'C-204' );
	door( - 1, - 19.5, 'C-205' );
	quad( '-x', X1, - 20.1, - 19.4, 1.15, 2.0, 'sign', { occlude: false, offset: 0.005, step: 1, cast: false, localUV: true } );
	quad( '-z', PZ1, 3.1, 2.1, 1.6, 1.95, labelMat( 'C-210' ), { occlude: false, offset: 0.005, step: 1, cast: false, localUV: true } );

	// ceiling services: two pipes, brackets, a cable tray
	pipeZ( 1.06, 2.72, 0.075, Z0, Z1, 'pipe' );
	pipeZ( 1.3, 2.8, 0.045, Z0, Z1, 'pipe' );
	for ( let z = 0.5; z > Z1; z -= 2.6 ) box( [ 0.92, 2.86, z - 0.025 ], [ X1, 2.9, z + 0.025 ], 'metal', { bake: true } );
	box( [ - 1.15, 2.8, Z1 ], [ - 0.75, 2.815, Z0 ], 'metal' );
	box( [ - 1.15, 2.815, Z1 ], [ - 1.14, 2.87, Z0 ], 'metal' );
	box( [ - 0.76, 2.815, Z1 ], [ - 0.75, 2.87, Z0 ], 'metal' );

	// dead fluorescent fixtures; one hangs askew
	for ( const z of [ - 1.5, - 5.5, - 9.5, - 13.5, - 17.5, - 21.5 ] ) {

		const m = z === - 13.5 ? new THREE.Matrix4().makeTranslation( 0, 2.95, z ).multiply( new THREE.Matrix4().makeRotationX( 0.22 ) ).multiply( new THREE.Matrix4().makeTranslation( 0, - 2.95 - 0.12, - z ) ) : null;
		box( [ - 0.12, 2.9, z - 0.62 ], [ 0.12, 2.98, z + 0.62 ], 'metal', { matrix: m } );
		box( [ - 0.1, 2.885, z - 0.6 ], [ 0.1, 2.9, z + 0.6 ], 'diffuser', { matrix: m } );

	}

	// emergency lamps: caged tungsten bulbs on wall brackets
	function sconce( x, y, z, inward, alive ) {

		box( [ Math.min( x, x + inward * 0.18 ), y + 0.07, z - 0.03 ], [ Math.max( x, x + inward * 0.18 ), y + 0.1, z + 0.03 ], 'metal' );
		const bulb = new THREE.SphereGeometry( 0.05, 16, 12 ); bulb.translate( x + inward * 0.17, y, z );
		const bm = finishMesh( bulb, alive ? 'bulbWarm' : 'bulbDead', { cast: false, bake: false } );
		const cage = new THREE.CylinderGeometry( 0.075, 0.075, 0.16, 8, 1, true ); cage.translate( x + inward * 0.17, y, z );
		const wire = new THREE.WireframeGeometry( cage );
		const cm = new THREE.LineSegments( wire, new THREE.LineBasicNodeMaterial( { color: 0x1c1c1a } ) );
		scene.add( cm );
		return bm;

	}

	sconce( X0, 2.2, - 7.0, 1, true );
	sconce( X1, 2.2, - 17.5, - 1, true );

	// junction box with conduit
	box( [ X0, 1.35, - 2.9 ], [ X0 + 0.12, 1.75, - 2.55 ], 'trim' );
	pipeZ( X0 + 0.04, 1.86, 0.018, - 2.7, - 2.69, 'pipe' );
	box( [ X0 + 0.02, 1.75, - 2.74 ], [ X0 + 0.06, 3, - 2.7 ], 'pipe' );

	// debris: papers, a fallen ceiling tile, boxes
	const rnd = mulberry( 4417 );
	for ( let k = 0; k < 9; k ++ ) {

		const x = - 1.2 + rnd() * 2.4, z = - 2 - rnd() * 20;
		const m = new THREE.Matrix4().makeTranslation( x, 0.002, z ).multiply( new THREE.Matrix4().makeRotationY( rnd() * 6.3 ) ).multiply( new THREE.Matrix4().makeTranslation( - x, 0, - z ) );
		box( [ x - 0.105, 0.0005, z - 0.148 ], [ x + 0.105, 0.0025, z + 0.148 ], 'paper', { matrix: m, cast: false } );

	}

	{

		const m = new THREE.Matrix4().makeTranslation( - 0.3, 0.05, - 13.4 ).multiply( new THREE.Matrix4().makeRotationZ( 0.09 ) ).multiply( new THREE.Matrix4().makeRotationY( 0.5 ) );
		box( [ - 0.3, - 0.01, - 0.3 ], [ 0.3, 0.01, 0.3 ], 'tile', { matrix: m } );

	}

	box( [ 0.95, 0, - 14.2 ], [ 1.45, 0.42, - 13.6 ], 'cardboard' );
	box( [ 1.0, 0.42, - 14.1 ], [ 1.4, 0.72, - 13.7 ], 'cardboard', { matrix: new THREE.Matrix4().makeRotationY( 0.0 ) } );
	box( [ - 1.45, 0, - 22.9 ], [ - 1.0, 0.5, - 22.2 ], 'cardboard' );

	// ---------------- lights ----------------

	const hemi = new THREE.HemisphereLight( 0x33363a, 0x0d0b09, 0.22 );
	scene.add( hemi );
	lights.hemi = hemi;

	// flashlight: a shadowed spotlight held at the right hand
	const cookie = TX.flashlightCookie();
	const flash = new THREE.SpotLight( 0xfff1de, 180, 30, 0.4, 0.85, 2 );
	flash.map = cookie;
	S.cookie = cookie;
	flash.shadow.camera.near = 0.08; flash.shadow.camera.far = 30;
	flash.shadow.bias = - 0.0004; flash.shadow.normalBias = 0.02;
	flash.layers.enable( LAYER_VOL );
	lights.flash = flash;

	function point( color, intensity, pos, { distance = 0, vol = false, shadow = false } = {} ) {

		const l = new THREE.PointLight( color, intensity, distance, 2 );
		l.position.copy( pos );
		if ( vol ) l.layers.enable( LAYER_VOL );
		if ( shadow ) { l.shadow.camera.near = 0.05; l.shadow.camera.far = 14; l.shadow.bias = - 0.002; l.shadow.normalBias = 0.03; }
		scene.add( l );
		return l;

	}

	lights.sconceA = point( WARM, 9, new THREE.Vector3( X0 + 0.3, 2.15, - 7.0 ), { vol: true } );
	lights.sconceB = point( WARM, 4, new THREE.Vector3( X1 - 0.3, 2.15, - 17.5 ), { vol: true } );
	// range capped inside the shadow camera's far plane, so the light never reaches past its own shadows
	lights.blueMain = point( GLOW_BLUE, 420, new THREE.Vector3( 7.6, 1.1, - 22.6 ), { vol: true, shadow: true, distance: 13 } );
	lights.blueDoor = point( GLOW_BLUE, 16, new THREE.Vector3( PX1 - 0.1, 1.2, ( PZ0 + PZ1 ) / 2 ), { distance: 7 } );
	lights.blueLeak = point( GLOW_BLUE, 2.2, new THREE.Vector3( X0 + 0.1, 0.035, - 12 ), { distance: 3.0 } );
	lights.blueMain.userData.base = 420;
	lights.sconceA.userData.base = 9; lights.sconceB.userData.base = 4;

	// ---------------- raymarched fog volume (Ultra and High) ----------------

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
	const vol = new THREE.Mesh( new THREE.BoxGeometry( 6.6, 3.05, 26.2 ), volMat );
	vol.position.set( 1.75, 1.5, - 11 );
	vol.receiveShadow = true;
	vol.layers.disableAll(); vol.layers.enable( LAYER_VOL );
	scene.add( vol );
	S.volume = vol; S.volMat = volMat; S.fogDensity = fogDensity;

	// ---------------- soft additive helpers for Medium and Low ----------------

	// fade out where the effect meets scene geometry, so cones and hazes never show hard intersection lines
	const softFade = ( dist ) => {

		const sceneZ = perspectiveDepthToViewZ( viewportDepthTexture(), cameraNear, cameraFar );
		return saturate( positionView.z.sub( sceneZ ).div( dist ) );

	};

	// flashlight beam cone (Medium)
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
		// fade the part of the cone close to the eye, or its inner wall shows up as a hard band
		const nearFade = smoothstep( 0.6, 2.8, positionView.z.negate() );
		const a = along.mul( n ).mul( float( 1 ).sub( radial.mul( 0.3 ) ) ).mul( softFade( 0.6 ) ).mul( nearFade ).mul( coneStrength );
		return vec4( vec3( 1.0, 0.93, 0.82 ).mul( a ), 1 );

	} )();
	const cone = new THREE.Mesh( coneGeo, coneMat );
	cone.renderOrder = 5;
	cone.frustumCulled = false;
	S.cone = cone; S.coneStrength = coneStrength;

	// glow hazes (Medium and Low stand-ins for volumetric scattering)
	const hazes = [];
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
		sp.renderOrder = 6;
		scene.add( sp ); hazes.push( sp );

	}

	haze( new THREE.Vector3( 4.75, 1.1, - 21.45 ), 2.4, 0.35 );
	haze( new THREE.Vector3( 4.7, 0.12, - 22.5 ), 1.6, 0.25 );
	haze( new THREE.Vector3( 2.6, 1.0, - 22.5 ), 3.6, 0.08 );
	haze( new THREE.Vector3( X0 + 0.3, 0.08, - 12 ), 1.5, 0.05 );
	S.hazes = hazes;

	// ---------------- dose sources (game values, not real measurements) ----------------

	S.sources = [
		{ pos: lights.blueMain.position.clone(), strength: 1200 }, // µSv/h at 1 m, unshielded
		{ pos: new THREE.Vector3( X0 - 1.0, 0.6, - 12 ), strength: 80 }
	];
	S.background = 0.12;

	// ---------------- walking area ----------------
	S.walkable = [
		{ x0: X0, x1: X1, z0: Z1, z1: Z0 },
		{ x0: 0, x1: PX1 - 0.12, z0: PZ0, z1: PZ1 }
	];

	S.bounds = { X0, X1, Z0, Z1 };

	// ---------------- tier variants ----------------
	S.applyVariant = ( variant ) => {

		for ( const m of statics ) m.material = mats[ m.userData.matKey ][ variant ];

	};

	S.bake = ( onProgress ) => bakeVertexLighting( S, onProgress );
	S.baked = false;

	return S;

}

function mulberry( a ) {

	return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul( a ^ a >>> 15, 1 | a ); t = t + Math.imul( t ^ t >>> 7, 61 | t ) ^ t; return ( ( t ^ t >>> 14 ) >>> 0 ) / 4294967296; };

}

// ---------------- segment vs AABB, shared by the bake and the dose model ----------------

export function segmentHitsBox( p, q, b, eps = 1e-4 ) {

	let t0 = 0, t1 = 1;
	for ( const k of [ 'x', 'y', 'z' ] ) {

		const d = q[ k ] - p[ k ];
		if ( Math.abs( d ) < 1e-9 ) { if ( p[ k ] < b.min[ k ] || p[ k ] > b.max[ k ] ) return false; continue; }
		let ta = ( b.min[ k ] - p[ k ] ) / d, tb = ( b.max[ k ] - p[ k ] ) / d;
		if ( ta > tb ) [ ta, tb ] = [ tb, ta ];
		t0 = Math.max( t0, ta ); t1 = Math.min( t1, tb );
		if ( t0 > t1 ) return false;

	}

	return t1 > eps && t0 < 1 - eps;

}

export function transmission( p, q, occluders ) {

	// slices of one barrier (group) attenuate once, not once per slice
	let T = 1;
	const seen = new Set();
	for ( const b of occluders ) {

		if ( b.group && seen.has( b.group ) ) continue;
		if ( segmentHitsBox( p, q, b ) ) { T *= b.atten; if ( b.group ) seen.add( b.group ); if ( T < 1e-6 ) return 0; }

	}

	return T;

}

// ---------------- CPU vertex light bake (Low tier stand-in for the Blender bake) ----------------
// Direct light from every static light with hard visibility through the AABB occluders,
// plus a cool ambient term with short-range ambient occlusion. Written into the vertex colors.

async function bakeVertexLighting( S, onProgress ) {

	if ( S.baked ) return;
	const L = [ S.lights.sconceA, S.lights.sconceB, S.lights.blueMain, S.lights.blueDoor, S.lights.blueLeak ].map( l => ( {
		pos: l.position, col: l.color, I: l.userData.base ?? l.intensity, dist: l.distance, shadow: l === S.lights.blueMain || l === S.lights.sconceA || l === S.lights.sconceB
	} ) );
	const amb = new THREE.Color( 0x33363a ).multiplyScalar( 0.22 );
	const dirs = [];
	for ( let k = 0; k < 10; k ++ ) { const a = k * 2.399963, z = ( k + 0.5 ) / 10; const r = Math.sqrt( 1 - z * z ); dirs.push( new THREE.Vector3( Math.cos( a ) * r, Math.sin( a ) * r, z ) ); }

	const meshes = S.statics.filter( m => m.userData.bake );
	const total = meshes.reduce( ( s, m ) => s + m.geometry.attributes.position.count, 0 );
	let done = 0, lastYield = performance.now();
	const p = new THREE.Vector3(), n = new THREE.Vector3(), q = new THREE.Vector3(), d = new THREE.Vector3(), t = new THREE.Vector3(), b = new THREE.Vector3();
	const near = [];

	for ( const mesh of meshes ) {

		const pos = mesh.geometry.attributes.position, nor = mesh.geometry.attributes.normal, col = mesh.geometry.attributes.color;
		for ( let i = 0; i < pos.count; i ++ ) {

			p.fromBufferAttribute( pos, i ); n.fromBufferAttribute( nor, i ).normalize();
			const o = p.clone().addScaledVector( n, 0.025 );
			let r = 0, g = 0, bl = 0;

			for ( const l of L ) {

				d.subVectors( l.pos, o ); const dist = d.length(); d.divideScalar( dist );
				const ndl = n.dot( d ); if ( ndl <= 0 ) continue;
				let att = 1 / Math.max( dist * dist, 0.01 );
				if ( l.dist > 0 ) { const x = Math.min( 1, Math.pow( dist / l.dist, 4 ) ); att *= ( 1 - x ) * ( 1 - x ); }
				if ( att < 1e-5 ) continue;
				const vis = l.shadow ? transmission( o, l.pos, S.occluders ) : 1;
				const e = l.I * ndl * att * vis / Math.PI;
				r += l.col.r * e; g += l.col.g * e; bl += l.col.b * e;

			}

			// short-range AO from the occluder slabs near this vertex
			near.length = 0;
			for ( const bx of S.occluders ) { if ( o.x > bx.min.x - 0.6 && o.x < bx.max.x + 0.6 && o.y > bx.min.y - 0.6 && o.y < bx.max.y + 0.6 && o.z > bx.min.z - 0.6 && o.z < bx.max.z + 0.6 ) near.push( bx ); }
			t.set( Math.abs( n.y ) < 0.9 ? 0 : 1, Math.abs( n.y ) < 0.9 ? 1 : 0, 0 ).cross( n ).normalize(); b.crossVectors( n, t );
			let hits = 0;
			for ( const dir of dirs ) {

				q.copy( o ).addScaledVector( t, dir.x * 0.55 ).addScaledVector( b, dir.y * 0.55 ).addScaledVector( n, dir.z * 0.55 );
				for ( const bx of near ) if ( segmentHitsBox( o, q, bx ) ) { hits ++; break; }

			}

			const ao = 1 - 0.75 * hits / dirs.length;
			const up = 0.6 + 0.4 * n.y;
			col.setXYZ( i, r + amb.r * ao * up / Math.PI * 3, g + amb.g * ao * up / Math.PI * 3, bl + amb.b * ao * up / Math.PI * 3 );

			done ++;
			if ( performance.now() - lastYield > 30 ) { onProgress?.( done / total ); await new Promise( res => setTimeout( res, 0 ) ); lastYield = performance.now(); }

		}

		col.needsUpdate = true;

	}

	S.baked = true;
	onProgress?.( 1 );

}
