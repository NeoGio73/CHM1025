// Question pools for the six stations (Timberlake, Basic Chemistry 6e, Chapter 16).
// Each item notes where its facts come from in Prof. Picione's Chapter 16 slides ("16.2 s7" = deck 16.2, slide 7).
// Items marked "not on slides" use real, standard data that the slides do not show; review those first.
// The wording is original. Nothing here is copied from the slides.

// ---------------------------------------------------------------- particles (Table 16.2, 16.1 s13)

export const PARTICLES = {
	alpha: { A: 4, Z: 2, sym: 'He', name: 'alpha particle', short: 'α' },
	beta: { A: 0, Z: - 1, sym: 'e', name: 'beta particle', short: 'β' },
	positron: { A: 0, Z: 1, sym: 'e', name: 'positron', short: 'β⁺' },
	gamma: { A: 0, Z: 0, sym: 'γ', name: 'gamma ray', short: 'γ' },
	neutron: { A: 1, Z: 0, sym: 'n', name: 'neutron', short: 'n' },
	proton: { A: 1, Z: 1, sym: 'H', name: 'proton', short: 'p' }
};

// ---------------------------------------------------------------- station 1: 16.1 natural radioactivity

// Shielding (Table 16.3, 16.1 s19 to s23). "rank" is how much each item stops; the source needs at least its rank.
export const PROTECTION = [
	{ id: 'paper', label: 'A sheet of paper', rank: 1 },
	{ id: 'coat', label: 'Heavy lab coat and gloves', rank: 2 },
	{ id: 'lead', label: 'Lead shield (or thick concrete)', rank: 3 }
];

export const SOURCES_16_1 = [
	{ type: 'alpha', label: 'ALPHA SOURCE', needs: 1, isotope: 'radium-226',
		why: 'Alpha particles travel only a few centimeters in air. Paper or clothing stops them.' },
	{ type: 'beta', label: 'BETA SOURCE', needs: 2, isotope: 'carbon-14',
		why: 'Beta particles go through paper and travel meters in air. Heavy clothing, a lab coat and gloves stop them.' },
	{ type: 'gamma', label: 'GAMMA SOURCE', needs: 3, isotope: 'technetium-99m',
		why: 'Gamma rays pass through paper, clothing and the body. Only dense shielding such as lead or thick concrete stops them.' }
];
// Typical sources are those listed in Table 16.3 (16.1 s23).

// Symbol matching (Table 16.2, 16.1 s13)
export const SYMBOL_MATCH = [ 'alpha', 'beta', 'positron', 'gamma', 'neutron', 'proton' ];

// ---------------------------------------------------------------- station 2: 16.2 nuclear reactions
// Equations: lhs and rhs are lists of terms. A term is a nuclide { A, Z, sym, name } or a particle { p: 'alpha', n: count }.
// "missing" is the rhs index the student fills in.

const N = ( A, Z, sym, name ) => ( { A, Z, sym, name } );
const P = ( p, n = 1 ) => ( { p, n } );

export const EQUATIONS_16_2 = {
	alpha: [
		{ lhs: [ N( 241, 95, 'Am', 'americium-241' ) ], rhs: [ N( 237, 93, 'Np', 'neptunium-237' ), P( 'alpha' ) ], missing: 0, src: '16.2 s7 to s11' },
		{ lhs: [ N( 222, 86, 'Rn', 'radon-222' ) ], rhs: [ N( 218, 84, 'Po', 'polonium-218' ), P( 'alpha' ) ], missing: 0, src: 'not on slides (handoff example; radon-222 is in Table 16.7 as an alpha emitter)' },
		{ lhs: [ N( 226, 88, 'Ra', 'radium-226' ) ], rhs: [ N( 222, 86, 'Rn', 'radon-222' ), P( 'alpha' ) ], missing: 0, src: 'Table 16.7 lists radium-226 as an alpha emitter; the equation is not on the slides' },
		{ lhs: [ N( 238, 92, 'U', 'uranium-238' ) ], rhs: [ N( 234, 90, 'Th', 'thorium-234' ), P( 'alpha' ) ], missing: 0, src: 'Table 16.7 lists uranium-238 as an alpha emitter; the equation is not on the slides' }
	],
	beta: [
		{ lhs: [ N( 90, 39, 'Y', 'yttrium-90' ) ], rhs: [ N( 90, 40, 'Zr', 'zirconium-90' ), P( 'beta' ) ], missing: 0, src: '16.2 s14 to s17' },
		{ lhs: [ N( 14, 6, 'C', 'carbon-14' ) ], rhs: [ N( 14, 7, 'N', 'nitrogen-14' ), P( 'beta' ) ], missing: 0, src: 'Table 16.7 lists carbon-14 as a beta emitter; the equation is not on the slides' },
		{ lhs: [ N( 32, 15, 'P', 'phosphorus-32' ) ], rhs: [ N( 32, 16, 'S', 'sulfur-32' ), P( 'beta' ) ], missing: 0, src: 'Table 16.8 lists phosphorus-32 as a beta emitter; the equation is not on the slides' }
	],
	positron: [
		{ lhs: [ N( 49, 25, 'Mn', 'manganese-49' ) ], rhs: [ N( 49, 24, 'Cr', 'chromium-49' ), P( 'positron' ) ], missing: 0, src: '16.2 s19 to s21' },
		{ lhs: [ N( 18, 9, 'F', 'fluorine-18' ) ], rhs: [ N( 18, 8, 'O', 'oxygen-18' ), P( 'positron' ) ], missing: 0, src: '16.5 s9 and Table 16.8 list fluorine-18 as a positron emitter; the equation is not on the slides' },
		{ lhs: [ N( 11, 6, 'C', 'carbon-11' ) ], rhs: [ N( 11, 5, 'B', 'boron-11' ), P( 'positron' ) ], missing: 0, src: 'Table 16.7 lists carbon-11 as a positron emitter; the equation is not on the slides' }
	],
	// the emitted particle is the missing piece in these
	gamma: [
		{ lhs: [ N( 99, 43, 'Tc', 'technetium-99m' ) ], rhs: [ N( 99, 43, 'Tc', 'technetium-99' ), P( 'gamma' ) ], missing: 1, src: '16.2 s22' }
	],
	bombardment: [
		{ lhs: [ P( 'alpha' ), N( 10, 5, 'B', 'boron-10' ) ], rhs: [ N( 13, 7, 'N', 'nitrogen-13' ), P( 'neutron' ) ], missing: 0, src: '16.2 s24' },
		{ lhs: [ P( 'proton' ), N( 58, 28, 'Ni', 'nickel-58' ) ], rhs: [ N( 55, 27, 'Co', 'cobalt-55' ), P( 'alpha' ) ], missing: 0, src: '16.2 s28 to s30' },
		{ lhs: [ N( 249, 98, 'Cf', 'californium-249' ), N( 15, 7, 'N', 'nitrogen-15' ) ], rhs: [ N( 260, 105, 'Db', 'dubnium-260' ), P( 'neutron', 4 ) ], missing: 0, src: '16.2 s25' }
	]
};
// technetium-99m: the metastable mark is carried in the name; the display adds "m" after the mass number
EQUATIONS_16_2.gamma[ 0 ].lhs[ 0 ].meta = true;

// ---------------------------------------------------------------- station 3: 16.3 radiation measurement (Table 16.4, 16.3 s5 to s9)

export const UNITS = [
	{ unit: 'curie (Ci)', cat: 'activity' },
	{ unit: 'becquerel (Bq)', cat: 'activity' },
	{ unit: 'rad', cat: 'absorbed' },
	{ unit: 'gray (Gy)', cat: 'absorbed' },
	{ unit: 'rem', cat: 'biological' },
	{ unit: 'sievert (Sv)', cat: 'biological' }
];
export const UNIT_CATS = {
	activity: 'Activity (disintegrations per second)',
	absorbed: 'Absorbed dose',
	biological: 'Biological damage'
};

// 1 Gy = 100 rad; 1 Sv = 100 rem (16.3 s6, s7, s9)
export const CONVERSIONS = [
	{ q: ( x ) => `A tissue sample absorbed ${ x } Gy. How many rad is that?`, x: [ 2, 3, 4 ], ans: x => x * 100, unit: 'rad' },
	{ q: ( x ) => `A worker received ${ x } Sv. How many rem is that?`, x: [ 2, 3, 5 ], ans: x => x * 100, unit: 'rem' },
	{ q: ( x ) => `A dose of ${ x } rem is how many sieverts?`, x: [ 200, 300, 500 ], ans: x => x / 100, unit: 'Sv' }
];

// ---------------------------------------------------------------- station 4: 16.4 half-life (Table 16.7, 16.4 s9; 16.4 s5 worked example)
// "unit" is how the half-life is written in Table 16.7. Activities in millicuries (mCi).

export const HALF_LIFE = [
	{ name: 'iodine-131', sym: '¹³¹I', t: 8.0, unit: 'days' },
	{ name: 'radon-222', sym: '²²²Rn', t: 3.8, unit: 'days' },
	{ name: 'chromium-51', sym: '⁵¹Cr', t: 28, unit: 'days' },
	{ name: 'iron-59', sym: '⁵⁹Fe', t: 44, unit: 'days' },
	{ name: 'technetium-99m', sym: '⁹⁹ᵐTc', t: 6.0, unit: 'hours' },
	{ name: 'phosphorus-32', sym: '³²P', t: 14.3, unit: 'days' } // 16.4 s5
];
export const SAFE_ACTIVITY = [ 5, 10, 20 ]; // mCi
// 3 or 4 half-lives, so that crossing before the clock is set costs a large dose (8 or 16 times the safe dose)
export const HALF_LIVES_NEEDED = [ 3, 4 ];

// ---------------------------------------------------------------- station 5: 16.5 medical applications (Table 16.8, 16.5 s6; 16.5 s8, s9)

export const SHELF = [
	{ id: 'Tc-99m', name: 'Technetium-99m', t: '6.0 h', rad: 'Gamma' },
	{ id: 'I-131', name: 'Iodine-131', t: '8.0 days', rad: 'Beta' }, // Table 16.8 says beta; Table 16.7 says gamma (flagged)
	{ id: 'F-18', name: 'Fluorine-18', t: '110 min', rad: 'Positron' },
	{ id: 'P-32', name: 'Phosphorus-32', t: '14.3 days', rad: 'Beta' },
	{ id: 'Y-90', name: 'Yttrium-90', t: '2.7 days', rad: 'Beta' },
	{ id: 'Sr-85', name: 'Strontium-85', t: '65 days', rad: 'Gamma' }
];

export const CHARTS = [
	{ bed: 'A', patient: 'Needs images of the heart muscle, then the liver and spleen.', answer: 'Tc-99m',
		why: 'Technetium-99m is a gamma emitter used to image many organs. It is the most widely used radioisotope in nuclear medicine.' },
	{ bed: 'B', patient: 'Overactive thyroid (hyperthyroidism). Treatment ordered.', answer: 'I-131',
		why: 'The thyroid collects iodine, so iodine-131 goes straight to it. It is used to treat hyperthyroidism and thyroid cancer.' },
	{ bed: 'C', patient: 'PET scan of brain metabolism ordered. The tracer is attached to glucose.', answer: 'F-18',
		why: 'PET needs a positron emitter. Fluorine-18 is one, and it is combined with glucose to study the brain.' }
];

export const SHORT_HALF_LIFE = {
	q: 'Why are isotopes with short half-lives used inside the body?',
	options: [
		{ t: 'Their activity falls quickly, so the patient receives less radiation after the scan or treatment is done.', ok: true },
		{ t: 'They emit more energetic radiation than isotopes with long half-lives.', ok: false, why: 'A short half-life says how fast a sample decays, not how energetic its radiation is.' },
		{ t: 'They are not radioactive by the time they reach the organ.', ok: false, why: 'They must still be radioactive in the organ, or nothing could be detected.' },
		{ t: 'Cells absorb them faster than stable isotopes.', ok: false, why: 'Cells do not tell a radioactive atom from a stable one of the same element (16.5 s5).' }
	],
	src: 'not stated on the slides in these words; 16.4 s17 notes that medical radioisotopes have short half-lives'
};

// ---------------------------------------------------------------- station 6: 16.6 fission and fusion

export const SORT_STATEMENTS = [
	{ t: 'A large nucleus splits into smaller nuclei.', a: 'fission', src: '16.6 s3' },
	{ t: 'A uranium-235 nucleus absorbs a neutron and breaks apart.', a: 'fission', src: '16.6 s4' },
	{ t: 'Neutrons released by the reaction can cause more reactions (a chain reaction).', a: 'fission', src: '16.6 s7, s8' },
	{ t: 'The reaction used in nuclear power plants today.', a: 'fission', src: 'not on slides (16.6 s3 calls the energy "atomic energy")' },
	{ t: 'Small nuclei combine to form a larger nucleus.', a: 'fusion', src: '16.6 s9' },
	{ t: 'Happens continuously in the Sun and other stars.', a: 'fusion', src: '16.6 s9' },
	{ t: 'Needs temperatures of about 100 000 000 °C.', a: 'fusion', src: '16.6 s9' },
	{ t: 'Hydrogen-3 and hydrogen-2 combine to form helium-4 and a neutron.', a: 'fusion', src: '16.6 s10' }
];

// 16.6 s5: n + U-235 -> U-236 -> Kr-91 + Ba-142 + 3n + energy (the intermediate U-236 is left out here)
export const FISSION = {
	lhs: [ P( 'neutron' ), N( 235, 92, 'U', 'uranium-235' ) ],
	rhs: [ N( 91, 36, 'Kr', 'krypton-91' ), N( 142, 56, 'Ba', 'barium-142' ), P( 'neutron', 3 ) ],
	src: '16.6 s5'
};

export const CONTROL_RODS = {
	q: 'The reactor is still running a chain reaction. What do the control rods do when they are lowered into the core?',
	options: [
		{ t: 'They absorb neutrons, so fewer neutrons are left to split more uranium-235.', ok: true },
		{ t: 'They add neutrons, so the reaction burns out faster.', ok: false, why: 'More neutrons would mean more fission, not less.' },
		{ t: 'They cool the core so that fission stops.', ok: false, why: 'Cooling removes heat. It is the neutrons that keep a chain reaction going.' },
		{ t: 'They absorb gamma rays from the core.', ok: false, why: 'Shielding stops gamma rays, but the chain reaction is carried by neutrons.' }
	],
	src: 'not on slides (handoff section 5: control rods absorb neutrons); chain reaction is 16.6 s7, s8'
};

// Finale: the last real steps of the uranium-238 decay series, ending in stable lead-206.
// Not on the slides. Standard data: Pb-210 (beta) -> Bi-210 (beta) -> Po-210 (alpha) -> Pb-206 (stable).
export const FINALE = [
	{ lhs: [ N( 210, 82, 'Pb', 'lead-210' ) ], rhs: [ N( 210, 83, 'Bi', 'bismuth-210' ), P( 'beta' ) ], missing: 0 },
	{ lhs: [ N( 210, 83, 'Bi', 'bismuth-210' ) ], rhs: [ N( 210, 84, 'Po', 'polonium-210' ), P( 'beta' ) ], missing: 0 },
	{ lhs: [ N( 210, 84, 'Po', 'polonium-210' ) ], rhs: [ N( 206, 82, 'Pb', 'lead-206' ), P( 'alpha' ) ], missing: 0 }
];

// ---------------------------------------------------------------- debrief (handoff section 7 draft; for Prof. Picione to review)

export const DEBRIEF = {
	real: [
		'Alpha, beta and gamma radiation, and what stops each one: paper or clothing for alpha, heavy clothing for beta, lead or thick concrete for gamma.',
		'Balancing nuclear equations: mass numbers and atomic numbers add up to the same totals on both sides.',
		'The units: curie and becquerel for activity, rad and gray for absorbed dose, rem and sievert for biological damage.',
		'Half-life: after each half-life, half of the activity is left.',
		'Medical isotopes such as technetium-99m, iodine-131 and fluorine-18 and what they are used for.',
		'Fission, fusion, chain reactions and the control rods that absorb neutrons.',
		'Time, distance and shielding: less time, more distance and dense shielding all lower the dose you receive.',
		'A blue glow has been reported in real criticality accidents.',
		'The last steps of a natural decay series: lead-210 to bismuth-210 to polonium-210, then alpha decay to stable lead-206.',
		'50 mSv (5 rem) is the U.S. annual occupational dose limit for radiation workers.'
	],
	fiction: [
		'The nuclide in this game, {NUCLIDE}, does not exist. Its name comes from the Latin for mother: in real chemistry, a parent nuclide decays into a daughter nuclide.',
		'A radioactive source does not move by itself.',
		'Time cannot be sped up near a source. The corridor clock is the one piece of time fiction in the game.',
		'The shape.',
		'The game\'s dose rates are made-up values chosen to be plausible, not measurements.',
		'Radiation does not make things glow green, and being exposed to radiation does not make a person radioactive.'
	]
};
