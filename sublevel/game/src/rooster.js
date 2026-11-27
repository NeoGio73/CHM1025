// The chicken (handoff section 4): the hint. When the player has been looking for the safe room for a long time,
// Prof. Picione's Barred Rock rooster (made in Blender for this game, art/scripts/birds.py) turns up in the hallway of
// the right floor and struts to the right door, then pecks at its threshold until the player gets there.
// If the player is on that floor he starts just out of their view, a few metres away; otherwise he starts at the
// hallway end on their side. He goes dark with the lights like everything else and never blocks the way.

import * as THREE from 'three/webgpu';
import { createBird } from './bird.js';

const LANE = 1.2; // down the middle of the hallway: clear of the machines against its front wall (z = HALL_W)
// and of the donkey across a doorway
const EYE = 1.62;

export function createRooster( scene, W ) {

	// a hurried strut, 1.3 m/s (the player walks at 1.7): the walk cycle sped up to match
	const bird = createBird( scene, W, './models/chicken.glb', { speed: 1.3, walkScale: 2.4 } );
	const fwd = new THREE.Vector3();
	let pecking = false, t = 0;

	// send him to the door of room sym; from = the player's eye position. Returns 'near' (he starts on the player's
	// floor), 'far', or null if the model is not there.
	function lead( sym, from, camera ) {

		if ( ! bird.loaded ) return null;
		const r = W.room( sym ), y = r.y, xEnd = W.hallEnds[ r.e.period ];
		const clampX = x => THREE.MathUtils.clamp( x, 1, xEnd - 1 );
		const px = clampX( from.x );
		const near = Math.abs( from.y - EYE - y ) < 2;
		let sx;
		if ( near ) {

			// of two spots four metres either side of the player, the one they are not looking at
			camera.getWorldDirection( fwd );
			const a = clampX( px - 4 ), b = clampX( px + 4 );
			sx = Math.sign( a - px ) * fwd.x < Math.sign( b - px ) * fwd.x ? a : b;

		} else sx = r.cx > px ? 1 : xEnd - 1;

		const dir = Math.sign( r.cx - sx ) || 1;
		bird.show( sx, y, LANE, Math.atan2( dir, 0 ) );
		pecking = false;
		bird.goTo( [ new THREE.Vector3( r.cx - dir * 0.75, y, LANE ), new THREE.Vector3( r.cx - dir * 0.7, y, 0.55 ) ], {
			face: new THREE.Vector3( r.cx, y, - 0.5 ), // the doorway
			done: () => { pecking = true; t = 1; }
		} );
		return near ? 'near' : 'far';

	}

	function hide() { bird.hide(); pecking = false; }

	function update( dt ) {

		bird.update( dt );
		if ( ! pecking || ! bird.object.visible ) return;
		if ( ( t -= dt ) < 0 ) { // at the door: peck at the threshold, look about, peck again

			if ( bird.current === bird.act.Peck ) { bird.play( 'Idle' ); t = 2 + Math.random() * 3; } else { bird.play( 'Peck', 0.15 ); t = bird.act.Peck ? bird.act.Peck.getClip().duration : 2; }

		}

	}

	return { lead, hide, update, bird, object: bird.object };

}
