// Build step 6: the shape and its three glimpses, and the goose that honks a moment before each (handoff sections 5
// and 6). The shape is a dark human silhouette, seen three times for about a second, always at a distance or through
// something, and it never comes closer:
//   1. work order 3: its reflection in a pool, with no one standing there (the water draws it: world.js ghost);
//      when the player looks in through a pool room's doorway on period 3, or steps into a pool room that is not the
//      one to find
//   2. work order 4 (or 5, if the player did not pass the booth in 4): behind the attendant's booth's frosted glass,
//      as the player comes along the period 4 hallway toward it
//   3. work order 6: at the far west end of the period 4 hallway, by the stairs, as the lights there fail. (The
//      handoff puts it in the long period 1 hallway; work order 6 runs along period 4, from arsenic to potassium.)
// Lights-on mode (the calm mode) has none of them. The goose (Prof. Picione's, made for this game) stands near the
// place during those work orders, turns to watch the player go by, and honks just before the shape shows.

import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createBird } from './bird.js';
import { ghost } from './world.js';
import { colCentre, floorY, HALL_W } from './building.js';

const EYE = 1.62;

// the shape: about 1.75 m, arms down, black and unlit (only the fog softens it)
export function createShape() {

	const part = ( geo, x, y, z, sx = 1, sz = 1 ) => geo.scale( sx, 1, sz ).translate( x, y, z );
	const capsule = ( r, len ) => new THREE.CapsuleGeometry( r, len, 4, 10 );
	const geos = [
		part( capsule( 0.075, 0.72 ), - 0.1, 0.44, 0 ), part( capsule( 0.075, 0.72 ), 0.1, 0.44, 0 ), // legs
		part( capsule( 0.17, 0.42 ), 0, 1.12, 0, 1.25, 0.65 ), // body
		part( capsule( 0.052, 0.56 ), - 0.27, 1.06, 0 ), part( capsule( 0.052, 0.56 ), 0.27, 1.06, 0 ), // arms
		part( new THREE.CylinderGeometry( 0.05, 0.06, 0.12, 8 ), 0, 1.5, 0 ), // neck
		part( new THREE.SphereGeometry( 0.105, 12, 10 ), 0, 1.62, 0, 0.9, 1.05 ) // head
	];
	for ( const g of geos ) for ( const k of Object.keys( g.attributes ) ) if ( k !== 'position' ) g.deleteAttribute( k );
	const geo = mergeGeometries( geos.map( g => g.index ? g.toNonIndexed() : g ) );
	const figure = new THREE.Mesh( geo, new THREE.MeshBasicMaterial( { color: 0x050505 } ) );
	figure.visible = false;
	return figure;

}

// the shape behind frosted glass: a soft dark blur of a head and shoulders, drawn on the booth's window
function glassShadow( booth, y ) {

	const c = document.createElement( 'canvas' ); c.width = 160; c.height = 200;
	const g = c.getContext( '2d' );
	g.filter = 'blur(9px)';
	g.fillStyle = '#000';
	g.beginPath(); g.ellipse( 80, 66, 23, 28, 0, 0, Math.PI * 2 ); g.fill(); // head (the plane is the glass: 1 m tall)
	g.beginPath(); g.moveTo( 30, 200 ); g.lineTo( 34, 128 ); g.quadraticCurveTo( 80, 96, 126, 128 ); g.lineTo( 130, 200 ); g.fill(); // shoulders
	g.fillRect( 66, 86, 28, 30 ); // neck
	const t = new THREE.CanvasTexture( c ); t.colorSpace = THREE.SRGBColorSpace;
	const w = booth.window, gh = w.h - w.sill;
	const m = new THREE.MeshBasicMaterial( { map: t, color: 0x000000, transparent: true, opacity: 0, depthWrite: false } );
	const plane = new THREE.Mesh( new THREE.PlaneGeometry( 0.8, gh ), m );
	plane.position.set( w.c + 0.3, y + w.sill + gh / 2, HALL_W + 0.024 ); // just on the hallway side of the glass
	plane.rotation.y = Math.PI;
	plane.renderOrder = 2;
	plane.visible = false;
	return plane;

}

export function createGlimpses( scene, W, audio ) {

	const goose = createBird( scene, W, './models/goose.glb', { speed: 0.9, walkScale: 1.6 } );
	const figure = createShape();
	scene.add( figure );
	const B = W.booth, y4 = floorY( 4 );
	const glass = glassShadow( B, y4 );
	scene.add( glass );
	const fwd = new THREE.Vector3(), feet = new THREE.Vector3();

	// where the goose stands in each work order (period, x, facing: +1 east, -1 west), near the place of its glimpse
	const POSTS = {
		3: { p: 3, x: colCentre( 15 ) + 6.5, dir: - 1 }, // among the pool rooms of period 3
		4: { p: 4, x: B.x1 + 4, dir: 1 }, // east of the booth (the player comes from the east stairs)
		5: { p: 4, x: B.x0 - 4, dir: - 1 }, // west of the booth (the player comes from iron)
		6: { p: 4, x: 66, dir: 1 } // the west half of the period 4 hallway, on the way to potassium
	};
	let postAt = null, run = null, ending = false;

	// after each change of phase: the goose to this work order's post (or away)
	function sync( G ) {

		if ( ending ) return;
		const post = G.phase !== 'exit' && ! G.ended ? POSTS[ G.wo ] : null;
		if ( ! post ) { goose.hide(); postAt = null; return; }
		if ( postAt === post ) return;
		postAt = post;
		goose.ready.then( () => { if ( postAt === post && ! ending ) goose.show( post.x, floorY( post.p ), 1.95, post.dir * Math.PI / 2 ); } );

	}

	// the three glimpses: where the shape is, and how it shows
	function start( n, at, G ) {

		G.glimpsed[ n - 1 ] = true;
		run = { n, t: 0, at };
		if ( goose.object.visible ) {

			goose.face( at.x, at.z );
			goose.play( 'Honk', 0.15 );
			const d = goose.object.position.distanceTo( feet );
			audio.honk( THREE.MathUtils.clamp( 1 - d / 45, 0.25, 1 ) );

		} else audio.honk( 0.5 );

	}

	const env = ( t, a, b ) => THREE.MathUtils.clamp( Math.min( ( t - a ) / 0.15, ( b - t ) / 0.3 ), 0, 1 ); // in, hold, out

	// find: the work order's search ( target, donkey ); active: the player can move
	function update( dt, { G, find, player, camera, options, active } ) {

		goose.update( dt );
		if ( run ) {

			run.t += dt;
			const t = run.t;
			if ( t > 1.7 && goose.current === goose.act.Honk ) goose.play( 'Idle', 0.4 );
			if ( run.n === 1 ) { ghost.value.set( run.at.x, run.at.y, run.at.z, env( t, 0.8, 2.1 ) ); }
			else if ( run.n === 2 ) { glass.visible = t < 2.2; glass.material.opacity = 0.85 * env( t, 0.8, 2.1 ); }
			else {

				figure.visible = t > 0.75 && t < 2.05;
				if ( t > 1.35 && ! run.off ) { run.off = true; W.setZoneLit( 'h:4:1', false ); } // the lights at the far end fail
				if ( t > 3.1 && ! run.on ) { run.on = true; W.setZoneLit( 'h:4:1', true ); } // and come back: nothing there

			}

			if ( t > 3.3 ) { run = null; ghost.value.w = 0; glass.visible = false; figure.visible = false; }
			return;

		}

		if ( ending ) return;
		const p = player.pos;
		feet.copy( p ).setY( p.y - EYE );
		// the goose turns to watch the player go by
		if ( goose.object.visible && ! goose.walking && goose.object.position.distanceTo( feet ) < 9 ) goose.face( p.x, p.z );
		if ( options.lights || G.phase !== 'find' || ! active || ! find ) return;
		camera.getWorldDirection( fwd );
		const fl = Math.round( - feet.y / 5 ) + 1, inHall = p.z > 0.15 && p.z < HALL_W && p.x > 0;
		const zone = W.zoneAt( p );

		if ( G.wo === 3 && ! G.glimpsed[ 0 ] && fl === 3 ) {

			for ( const r of W.rooms ) {

				if ( r.e.period !== 3 || r.kind !== 'pool' || r.e.sym === find.donkey || ! W.isLit( 'r:' + r.e.sym ) ) continue;
				const looking = inHall && Math.abs( p.x - r.cx ) < 1.0 && fwd.z < - 0.6;
				const inside = zone === 'r:' + r.e.sym && r.e.sym !== find.target;
				if ( looking || inside ) { start( 1, new THREE.Vector3( r.cx, r.y, r.z0 + 0.55 ), G ); break; }

			}

		} else if ( ( G.wo === 4 || G.wo === 5 ) && ! G.glimpsed[ 1 ] && fl === 4 && inHall && W.isLit( zone ) ) {

			const d = Math.abs( p.x - B.window.c );
			if ( d > 1.3 && d < 5 ) start( 2, new THREE.Vector3( B.window.c, y4, HALL_W + 0.5 ), G );

		} else if ( G.wo === 6 && ! G.glimpsed[ 2 ] && fl === 4 && inHall && p.x > 16 && p.x < 58 && fwd.x < - 0.5 && W.isLit( 'h:4:1' ) ) {

			figure.position.set( 1.3, y4, 1.25 );
			figure.rotation.y = Math.PI / 2; // facing down the hallway, toward the player
			start( 3, figure.position.clone(), G );

		}

	}

	// the ending takes the goose and the shape over
	function takeOver() { ending = true; run = null; ghost.value.w = 0; glass.visible = false; figure.visible = false; if ( W.isLit( 'h:4:1' ) === false ) W.setZoneLit( 'h:4:1', true ); }

	return { sync, update, goose, figure, takeOver, get busy() { return !! run; } };

}
