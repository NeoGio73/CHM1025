// Everything Prof. Picione still has to decide (handoff section 11) lives in this one file, as in Daughter.
// Values marked PLACEHOLDER are stand-ins so step 3 is playable. Values marked CONFIRMED were approved.

export const CONFIG = {

	// Section 11, item 7: building identity. CONFIRMED 2026-11-27: Calder & Finch Maintenance, an older look
	// (serif letters on brass plates; brown, brass and cream). The signs are drawn in building.js (BRASS).
	names: {
		company: 'Calder & Finch Maintenance',
		building: 'the building'
	},

	// Section 11, item 4: scoring (CONFIRMED 2026-11-26)
	// 1 point per work order completed; wrong answers make the dark come faster, they never cost points.
	pointsPerWorkOrder: 1,
	workOrderCount: 6,

	// The dark (handoff section 6). Game values, to tune by playing.
	dark: {
		interval: 7, // seconds between rooms (or hallway stretches) going dark behind the player
		wrongSpeedup: 0.35, // each wrong answer in the current work order makes the dark this much faster
		linger: 35, // seconds in one place, once everything behind is dark, before the dark reaches the player
		lingerSpeedup: 2, // the dark runs this many times faster while the player lingers
		inDark: 3 // seconds the player can stand in a dark room before the lights fail around them
	},

	// a hint after this many wrong answers to a question (text), or this long looking for a room (text, and the rooster
	// struts to the right door: rooster.js)
	hintAfterWrong: 2,
	hintAfterSeconds: 120,
	// the rooster also comes sooner when the player is stuck (handoff section 4: "two wrong answers"): after this many
	// wrong rooms tried during one search (more than a metre inside a room that is neither the one to find nor the phone's)
	hintAfterWrongRooms: 2,

	// Completion code (handoff section 9): same scheme as Daughter, Lewis Manor and Retro Reactions.
	// CONFIRMED prefix 'SL' (2026-11-26). Secret generated 2026-11-26 (24 random letters and digits).
	// Like the other games, the secret ships in the public page; it must be registered in the instructor's private checker.
	codePrefix: 'SL',
	codeSecret: 'oPolP9H37I9z0ZLFvJLWjcZy',
	// true: registered in the instructor's private checker (game SL) on 2026-11-26 and verified, so no warning
	codeRegistered: true

};

// Where models and textures load from (as in Daughter): public/ on the dev server; in the published copy (../play/)
// they stay in ../game/public/, so the repo holds them only once.
export const ASSETS = import.meta.env.DEV ? './' : '../game/public/';
