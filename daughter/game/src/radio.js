// Radio script: old recordings left by the health physicist (never a live conversation).
// DRAFT lines for Prof. Picione to edit. Every spoken line lives in this file so recordings can be matched to it.
// Audio is not recorded yet (handoff section 9, item 6), so the game shows these as captions only.
// {HP}, {FACILITY} and {NUCLIDE} are filled in from src/config.js.

export const RADIO = {
	start: [
		'Recording. This is {HP}, health physics, {FACILITY}. Everyone else has gone home. Someone has to watch the source tonight.'
	],
	s2: [
		'The logs call it {NUCLIDE}. We just called it the Parent. It was never supposed to leave the core room. I am writing down everything, in case nobody believes me.'
	],
	s3: [
		'Clip your dosimeter on before you go any further. Time, distance, shielding. Remember all three.'
	],
	s4: [
		'The corridor clock is wrong again. Near the source the hours run strange. I stopped trying to explain it.'
	],
	s5: [
		'If you are hearing this, you came for the Parent. It is not the Parent anymore. It has a daughter now.'
	],
	s6: [
		'I am going to stand between it and the door. Somebody has to. Bring it down to something stable, and then go home.'
	],
	end: [
		'It is quiet now. That is all I wanted. End of recording.'
	]
};
