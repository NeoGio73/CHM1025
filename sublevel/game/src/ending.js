// Build step 6: the ending (handoff section 5). The exit door in the potassium room stands open onto daylight, and the
// animals wait by it (the goat on the desk, as always). When the player goes to the door, the animals walk out first,
// one after another: the rooster, the goose, the donkey, and the goat, who hops down from the desk. Then the player
// follows them into the light and turns around. Far back in the building, beyond the room's front door, the shape
// stands in the hallway as the exit door swings shut. It is not explained. Lights-on mode leaves the shape out.

import * as THREE from 'three/webgpu';

const EYE = 1.62;
const smooth = k => k * k * ( 3 - 2 * k );

// walk an object (the donkey, the goat) through points at a pace, turning to face the way it goes
function walker( obj ) {

	let path = [], pace = 1, done = null;
	return {
		go( points, p, then ) { path = points.map( v => v.clone() ); pace = p; done = then; },
		update( dt ) {

			if ( ! path.length ) return;
			const q = path[ 0 ], dx = q.x - obj.position.x, dz = q.z - obj.position.z, d = Math.hypot( dx, dz ), step = pace * dt;
			if ( d <= step ) { obj.position.x = q.x; obj.position.z = q.z; path.shift(); } else { obj.position.x += dx / d * step; obj.position.z += dz / d * step; }
			const want = Math.atan2( dx, dz ), turn = Math.atan2( Math.sin( want - obj.rotation.y ), Math.cos( want - obj.rotation.y ) );
			obj.rotation.y += turn * Math.min( 1, dt * 5 );
			if ( ! path.length ) { const f = done; done = null; f?.(); }

		}
	};

}

// room: the exit room. donkey: { obj, walk(), idle(), hold( on ) }; P: the props (the goat, the exit door)
export function createEnding( { room, P, rooster, goose, donkey, figure, audio } ) {

	const cx = room.cx, y = room.y, z0 = room.z0;
	const V = ( x, z, yy = y ) => new THREE.Vector3( x, yy, z );
	const SPOT = { donkey: V( cx + 2.4, z0 + 2.7 ), goose: V( cx - 1.7, z0 + 2.2 ), rooster: V( cx - 0.8, z0 + 3.1 ) };
	const OUT = z0 - 2.5; // the far end of the bright space behind the door, where the animals go out of sight
	const faceDoor = v => Math.atan2( cx - v.x, z0 - v.z );
	const donkeyWalk = donkey ? walker( donkey.obj ) : null, goatWalk = walker( P.goat );
	let T = 0, cues = [], tweens = [], resolve = null, running = false;

	// at the exit phase: the animals wait by the open exit door (the donkey also blocks walking: main.js)
	function stage() {

		rooster?.bird.ready.then( () => { if ( running ) return; rooster.hide(); rooster.bird.show( SPOT.rooster.x, y, SPOT.rooster.z, faceDoor( SPOT.rooster ) ); } );
		goose?.ready.then( () => { if ( ! running ) goose.show( SPOT.goose.x, y, SPOT.goose.z, faceDoor( SPOT.goose ) ); } );
		if ( donkey ) {

			donkey.obj.position.copy( SPOT.donkey );
			donkey.obj.rotation.y = faceDoor( SPOT.donkey );
			donkey.obj.visible = true;

		}

	}

	// the camera (the player's eyes) from where it is to pos, looking at a point, over dur seconds
	function look( player, at, pos, target, dur ) {

		cues.push( { at, fn: () => {

			const p0 = player.pos.clone(), y0 = player.yaw, k0 = player.pitch;
			const d = target.clone().sub( pos ), y1 = Math.atan2( - d.x, - d.z ), k1 = Math.atan2( d.y, Math.hypot( d.x, d.z ) );
			const dy = Math.atan2( Math.sin( y1 - y0 ), Math.cos( y1 - y0 ) );
			tweens.push( { t: 0, dur, fn: k => { const e = smooth( k ); player.pos.lerpVectors( p0, pos, e ); player.yaw = y0 + dy * e; player.pitch = k0 + ( k1 - k0 ) * e; } } );

		} } );

	}

	function play( { player, options } ) {

		running = true; T = 0; cues = []; tweens = [];
		P.goatScript( true );
		const E = y + EYE;
		// 1. step back from the door to watch
		look( player, 0, V( cx + 1.7, z0 + 3.8, E ), V( cx - 0.3, z0 - 0.5, y + 1.0 ), 1.6 );
		// 2. the animals go out: the rooster, the goose, the donkey, then the goat down from the desk
		const hideAtEnd = o => () => { o.visible = false; };
		cues.push( { at: 0.8, fn: () => rooster?.bird.goTo( [ V( cx + 0.15, z0 + 0.9 ), V( cx + 0.15, OUT ) ], { pace: 1.3, done: hideAtEnd( rooster.bird.object ) } ) } );
		cues.push( { at: 1.5, fn: () => goose?.goTo( [ V( cx - 0.15, z0 + 0.9 ), V( cx - 0.15, OUT ) ], { pace: 1.1, done: hideAtEnd( goose.object ) } ) } );
		cues.push( { at: 2.5, fn: () => { if ( ! donkey ) return; donkey.walk(); donkeyWalk.go( [ V( cx, z0 + 1.4 ), V( cx, OUT + 0.1 ) ], 1.1, () => { donkey.obj.visible = false; } ); } } );
		cues.push( { at: 0.6, fn: () => {

			// the hop: from the desk top down to the floor beside it, toward the room
			const g = P.goat, a = g.position.clone(), b = V( a.x - 1.1, a.z + 0.2 );
			P.goatPlay( 'Jump_toIdle', 0.1 );
			tweens.push( { t: 0, dur: 1.1, fn: k => { g.position.lerpVectors( a, b, k ); g.position.y = a.y + ( b.y - a.y ) * k + Math.sin( k * Math.PI ) * 0.35; g.rotation.y = - Math.PI / 2 * smooth( k ); } } );

		} } );
		cues.push( { at: 2.1, fn: () => { P.goatPlay( 'Walk', 0.3, 1.8 ); goatWalk.go( [ V( cx + 0.35, z0 + 0.9 ), V( cx, OUT ) ], 1.4, () => { P.goat.visible = false; } ); } } );
		// 3. the player follows them out into the light
		look( player, 8.6, V( cx + 0.1, z0 + 1.1, E ), V( cx, z0 - 3, y + 1.4 ), 1.3 );
		look( player, 9.9, V( cx + 0.45, z0 - 2.1, E ), V( cx + 0.45, z0 - 6, y + 1.5 ), 1.9 );
		// 4. and turns around: far back, beyond the room's front door, the shape stands in the hallway
		const shape = V( cx, 1.75 );
		look( player, 11.9, V( cx + 0.45, z0 - 2.1, E ), V( cx, 1.75, y + 1.3 ), 1.5 );
		if ( ! options.lights ) cues.push( { at: 13.2, fn: () => { figure.position.copy( shape ); figure.rotation.y = 0; figure.visible = true; } } );
		// 5. the door swings shut on it
		cues.push( { at: 13.9, fn: () => P.exit.close( 1.8 ) } );
		cues.push( { at: 15.7, fn: () => { audio.thud( 1 ); figure.visible = false; } } );
		cues.push( { at: 16.2, fn: () => { running = false; resolve?.(); } } );
		return new Promise( r => { resolve = r; } );

	}

	function update( dt ) {

		if ( ! running ) return;
		T += dt;
		for ( const c of cues ) if ( ! c.done && T >= c.at ) { c.done = true; c.fn(); }
		for ( const w of tweens ) { if ( w.t >= w.dur ) continue; w.t = Math.min( w.dur, w.t + dt ); w.fn( w.t / w.dur ); }
		donkeyWalk?.update( dt );
		goatWalk.update( dt );

	}

	return { stage, play, update, spot: SPOT, get running() { return running; } };

}
