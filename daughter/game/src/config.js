// Everything Prof. Picione still has to decide (handoff section 9) lives in this one file.
// Values marked PLACEHOLDER are stand-ins so the graybox is playable. Values marked CONFIRMED were approved on 2026-11-26.

export const CONFIG = {

	// Section 9, item 4: names (CONFIRMED 2026-11-26)
	names: {
		facility: 'Vesper Ridge Research Reactor',
		physicist: 'Dr. Miriam Kessler',
		physicistShort: 'Kessler',
		nuclide: 'maternium', // the fictional nuclide (from Latin mater, mother: the parent of the daughter); never appears in an equation the student balances
		nuclideSymbol: 'Mx' // not used by any element or common unit
	},

	// Section 9, item 3: scoring (CONFIRMED 2026-11-26)
	// 1 point per station completed; wrong answers cost dose, not points.
	pointsPerStation: 1,
	stationCount: 6,

	// Section 9, item 7: dose limit for the run (CONFIRMED 2026-11-26, with the 2 mSv wrong-answer cost)
	doseLimit: 50, // mSv
	// mSv added by a wrong answer once the dosimeter is live (station 3 on)
	wrongAnswerDose: 2,
	// one real second counts as this many seconds of exposure (game value, keeps doses readable)
	exposureTimeScale: 60,
	// after an evacuation the dosimeter restarts at the checkpoint's dose, but never above this fraction of the limit
	checkpointDoseCap: 0.6,

	// Completion code (handoff section 7): same scheme as Lewis Manor and Retro Reactions.
	// Issued only at the end of the run; no partial-credit code (CONFIRMED 2026-11-26).
	// Prefix 'DA' CONFIRMED 2026-11-26. Secret generated 2026-11-26 (24 random letters and digits, like Lewis Manor's).
	// Like the other games, the secret ships in the public page. It is registered in the instructor's private checker.
	codePrefix: 'DA',
	codeSecret: 'oXiQzCgB3AXXd8MYSuKiPyFK',
	// true: DA and this secret are in the private checker (added 2026-11-26), so the code screen shows no warning
	codeRegistered: true

};
