// Art pass (build step 4): loads a room modelled in Blender (daughter/art/*.blend, exported to public/models/*.glb)
// and puts it in place of the graybox for that area. Gameplay data (walkable areas, blockers, dose occluders,
// terminals) still comes from level.js, so the art never changes how the game plays.
//
// Naming convention in the .glb (set in Blender):
//   <ROOM>_static     every static piece of the room, one mesh with one primitive per material
//   DOOR_<id>         replaces the graybox door L.doors[id]; origin at the doorway's bottom centre
//   SCREEN_<id>       where terminal <id>'s screen goes (faces the empty's +z); extras w, h = screen size in metres
//   LABEL_<id>        where terminal <id>'s label sign goes; extras w = sign width
//   BLOCK_<name>      an invisible box the player cannot walk through
//   material "game:<key>" is replaced by the game's own material <key> (so lamp flicker and lights-on still work)
//   UV map 3 (uv2)    <ROOM>_static's ambient-occlusion layout, for the room's baked AO texture (see loadAO)

import * as THREE from 'three/webgpu';
import { texture, uv, mix, float, vec4, pow, materialColor, uniform } from 'three/tsl';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

// three variants per material, matching level.js: full (all maps), med (no normal map), low (Lambert)
export function registerMaterial( L, src ) {

	const key = 'glb:' + src.name;
	if ( L.mats[ key ] ) return key;
	const full = src;
	full.shadowSide = THREE.DoubleSide;
	const med = src.clone(); med.normalMap = null;
	// Lambert has no metalness: metal would come out flat and bright, so darken it by how metallic it is
	const low = new THREE.MeshLambertMaterial( { map: src.map || null, color: src.color.clone().multiplyScalar( 1 - 0.6 * ( src.metalness || 0 ) ), emissive: src.emissive?.clone(), emissiveMap: src.emissiveMap || null, side: src.side } );
	L.mats[ key ] = { full, med, low, tile: [ 1, 1 ] };
	return key;

}

export async function loadRoomArt( L, scene, url, { region, room, ao = null } ) {

	const gltf = await loader.loadAsync( url );
	const root = gltf.scene;
	root.updateMatrixWorld( true );
	const nodes = {};
	root.traverse( o => { if ( o.name ) nodes[ o.name ] = o; } );

	// 1. hide the graybox inside the region (signs with text, screens and doors are handled separately)
	scene.updateMatrixWorld( true ); // terminals sit in rotated groups; their world positions must be current
	const box = new THREE.Box3(), c = new THREE.Vector3();
	const doorMeshes = new Set( Object.values( L.doors ).map( d => d.mesh ) );
	for ( const m of L.statics ) {

		const k = m.userData.matKey || '';
		if ( k.startsWith( 'sign:' ) || k.startsWith( 'screen' ) || doorMeshes.has( m ) ) continue;
		box.setFromObject( m ).getCenter( c );
		if ( c.x > region.x0 && c.x < region.x1 && c.z > region.z0 && c.z < region.z1 ) { m.visible = false; m.userData.artHidden = true; }

	}

	// 2. static meshes: game materials or registered GLB materials, shadows on
	const statics = [];
	nodes[ room + '_static' ].traverse( o => { if ( o.isMesh ) statics.push( o ); } );
	for ( const name of Object.keys( nodes ) ) if ( name.startsWith( 'DOOR_' ) ) nodes[ name ].traverse( o => { if ( o.isMesh ) statics.push( o ); } );
	for ( const m of statics ) {

		const n = m.material.name || '';
		m.userData.matKey = n.startsWith( 'game:' ) && L.mats[ n.slice( 5 ) ] ? n.slice( 5 ) : registerMaterial( L, m.material );
		m.material = L.mats[ m.userData.matKey ].full;
		const glow = m.userData.matKey === 'bulbWarm';
		m.castShadow = ! glow; m.receiveShadow = ! glow;
		L.statics.push( m );

	}

	scene.add( nodes[ room + '_static' ] );

	// the room's static meshes that carry the AO layout (lamps, screens and other glowing materials are left out)
	if ( ao ) {

		const meshes = statics.filter( m => m.geometry.attributes.uv2 && ! L.mats[ m.userData.matKey ].level && L.mats[ m.userData.matKey ].low !== L.mats[ m.userData.matKey ].full );
		( L.aoRooms ??= [] ).push( { room, url: ao, meshes } );

	}

	// 2b. pickups: PROPS_<key>_<n> replace the graybox meshes in the array L.props[key] (the game hides them when taken)
	const groups = {};
	for ( const [ name, o ] of Object.entries( nodes ) ) {

		const m = name.match( /^PROPS_([A-Za-z]+)_\d+$/ );
		if ( ! m || ! Array.isArray( L.props[ m[ 1 ] ] ) ) continue;
		( groups[ m[ 1 ] ] ??= [] ).push( o );
		o.traverse( c => {

			if ( ! c.isMesh ) return;
			const n = c.material.name || '';
			c.userData.matKey = n.startsWith( 'game:' ) && L.mats[ n.slice( 5 ) ] ? n.slice( 5 ) : registerMaterial( L, c.material );
			c.material = L.mats[ c.userData.matKey ].full; c.castShadow = c.receiveShadow = true;
			L.statics.push( c );

		} );

	}

	for ( const [ key, list ] of Object.entries( groups ) ) {

		for ( const old of L.props[ key ] ) { old.visible = false; old.userData.artHidden = true; }
		for ( const o of list ) scene.attach( o ); // visible; the game's state sync hides them if already taken
		L.props[ key ] = list;

	}

	// 3. doors: the new door goes inside the graybox door's group; level/main.js slide d.mesh up by d.h - 0.15
	for ( const [ id, d ] of Object.entries( L.doors ) ) {

		const art = nodes[ 'DOOR_' + id ];
		if ( ! art ) continue;
		const wrap = new THREE.Group();
		art.position.set( 0, - d.h / 2, 0 ); art.quaternion.identity();
		wrap.add( art );
		wrap.position.copy( d.mesh.position );
		d.mesh.visible = false; d.mesh.userData.artHidden = true;
		d.group.add( wrap );
		d.mesh = wrap;

	}

	// 4. terminals: move each screen and label onto the model
	const q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
	for ( const it of L.interact ) {

		const labelGuess = it.pos.clone().add( new THREE.Vector3( 0, 0.57, 0 ) ); // terminal() puts the label 1.72 m up, it.pos is 1.15 m up
		const scr = nodes[ 'SCREEN_' + it.id ];
		if ( scr ) {

			scr.matrixWorld.decompose( p, q, s );
			scene.attach( it.screen );
			it.screen.position.copy( p ); it.screen.quaternion.copy( q );
			const w = scr.userData.w || 0.52, h = scr.userData.h || 0.34;
			it.screen.scale.set( w / 0.52, h / 0.34, 1 );
			it.pos = p.clone();
			it.normal = new THREE.Vector3( 0, 0, 1 ).applyQuaternion( q );

		}

		const lab = nodes[ 'LABEL_' + it.id ];
		if ( lab ) {

			// the label sign that terminal() made: the nearest sign mesh above the old console
			let best = null, bd = 1;
			for ( const m of L.statics ) {

				if ( ! ( m.userData.matKey || '' ).startsWith( 'sign:' + it.label ) ) continue;
				const dd = m.getWorldPosition( c ).distanceTo( labelGuess );
				if ( dd < bd ) { bd = dd; best = m; }

			}

			if ( best ) {

				lab.matrixWorld.decompose( p, q, s );
				best.position.copy( p ); best.quaternion.copy( q );
				const w = lab.userData.w; if ( w ) best.scale.set( w / best.geometry.parameters.width, w / best.geometry.parameters.width, 1 );

			}

		}

	}

	// 5. collision boxes
	for ( const [ name, o ] of Object.entries( nodes ) ) {

		if ( ! name.startsWith( 'BLOCK_' ) ) continue;
		box.setFromObject( o );
		L.blockers.push( { x0: box.min.x, x1: box.max.x, z0: box.min.z, z1: box.max.z, art: name } );
		o.visible = false;

	}

	return { statics: statics.length, url };

}

// ---------------------------------------------------------------- baked ambient occlusion (Medium and Low)
// Ultra and High darken corners on screen (SSGI, GTAO). Medium and Low get the same darkening from a texture
// baked in Blender (art/facility.blend, ao.py), one per room, on the room's third UV map. It multiplies the
// surface colour, so it darkens every light on it (as GTAO does on High), not only the faint ambient light.
// The textures are only downloaded the first time Medium or Low is used.

export const aoStrength = uniform( 0.9 ); // 0: no AO, 1: the full bake
export const aoContrast = uniform( 1.8 ); // power on the bake: deepens corners and contact shadows to about what GTAO gives on High
const aoLoader = new THREE.TextureLoader();
let aoLoading = null;

export function loadAO( L ) {

	aoLoading ??= Promise.all( ( L.aoRooms || [] ).map( async r => {

		let tex;
		try { tex = await aoLoader.loadAsync( r.url ); } catch ( e ) { console.warn( `The ${ r.room } AO did not load; that room has none.`, e ); return; }
		tex.flipY = false; // glTF UVs run top to bottom
		tex.colorSpace = THREE.NoColorSpace;
		tex.anisotropy = 4;
		const occ = mix( float( 1 ), pow( texture( tex, uv( 2 ) ).r, aoContrast ), aoStrength );
		const colour = vec4( materialColor.rgb.mul( occ ), materialColor.a );
		for ( const m of r.meshes ) {

			const key = m.userData.matKey, aoKey = key + '@ao:' + r.room;
			if ( ! L.mats[ aoKey ] ) {

				const base = L.mats[ key ];
				const med = new THREE.MeshStandardNodeMaterial().copy( base.med );
				const low = new THREE.MeshLambertNodeMaterial().copy( base.low );
				med.colorNode = colour; low.colorNode = colour;
				L.mats[ aoKey ] = { full: base.full, med, low, tile: base.tile };

			}

			m.userData.aoKey = aoKey;

		}

	} ) );
	return aoLoading;

}
