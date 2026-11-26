// The six work orders (handoff section 5). Build step 4: checked against Prof. Picione's Chapter 5 slides
// (Timberlake, Basic Chemistry 6e, "Electronic Structure of Atoms and Periodic Trends", sections 5.3 to 5.6) on 2026-11-26,
// and approved by Prof. Picione the same day (all 71 variants and the debrief, reviewed in sublevel/REVIEW_questions.md).
// Scope (handoff section 5): periods 1 to 4; atomic size is the only periodic trend; no atomic spectra or light;
// no chromium or copper exceptions; no electron-dot symbols (they are not in the Chapter 5 slides).
// The wording is original; it follows the slides' terms (energy level, sublevel, orbital, "Group 5A (15)",
// abbreviated configuration with the noble gas in brackets, 4s written before 3d).
//
// Each work order: the phone room (where it rings), the call (captioned), three questions, then a room to find.
// Each of the three question slots is a small pool of variants on the same idea; one variant is drawn per call,
// so a replay or a neighbour's run asks different questions. Answer choices are shuffled, except number lists
// and lists marked keep, which stay in their written order.
// The room to find is the safe room: the goat waits there, and reaching it stops the dark and earns the point.
// The donkey stands in front of one wrong door on the way. No question gives away the room to find.
//
// Question types:
//   choice   { q, options, answer (index), why, hint, keep? }
//   orbital  { q, z, why, hint }   the player fills in the orbital diagram (boxes and arrows) for 1s to 3p

import { fullConfig as F, shortConfig as S } from './chem.js';

const N = [ '0', '1', '2', '3' ];

export const WORK_ORDERS = [

	{
		n: 1, title: 'Energy levels and sublevels', phone: 'H',
		call: [
			'This is {COMPANY}. You are on the top floor. Before we send you down, a few checks on how this building is organized.',
			'Each floor is an energy level. Each wing is a sublevel. Answer on the phone keypad.'
		],
		questions: [
			// slot 1: the sublevels in an energy level
			[
				{ type: 'choice', q: 'Which sublevels are in energy level n = 3?', options: [ '3s only', '3s and 3p', '3s, 3p and 3d', '3s, 3p, 3d and 3f' ], answer: 2, keep: true,
					why: 'An energy level has as many sublevels as its number n. For n = 3 they are 3s, 3p and 3d.', hint: 'Count: energy level 1 has one sublevel, energy level 2 has two.' },
				{ type: 'choice', q: 'Which sublevels are in energy level n = 2?', options: [ '2s only', '2s and 2p', '2s, 2p and 2d', '2p only' ], answer: 1, keep: true,
					why: 'Energy level 2 has two sublevels: 2s and 2p.', hint: 'The number of sublevels equals n.' },
				{ type: 'choice', q: 'How many sublevels are in energy level n = 4?', options: [ '1', '2', '3', '4' ], answer: 3,
					why: 'The number of sublevels equals n. Energy level 4 has 4s, 4p, 4d and 4f.', hint: 'Energy level 3 has three sublevels.' },
				{ type: 'choice', q: 'In energy level n = 3, which sublevel is lowest in energy?', options: [ '3s', '3p', '3d', 'They all have the same energy' ], answer: 0, keep: true,
					why: 'Within an energy level, s is lowest in energy, then p, then d, then f.', hint: 'The order within a level is s, p, d, f.' }
			],
			// slot 2: orbitals
			[
				{ type: 'choice', q: 'How many orbitals are in a p sublevel?', options: [ '1', '3', '5', '7' ], answer: 1,
					why: 'An s sublevel has 1 orbital, a p sublevel has 3, a d sublevel has 5 and an f sublevel has 7.', hint: 'The three p orbitals point along the x, y and z axes.' },
				{ type: 'choice', q: 'How many orbitals are in a d sublevel?', options: [ '1', '3', '5', '7' ], answer: 2,
					why: 'A d sublevel has 5 orbitals, so it holds up to 10 electrons.', hint: 's has 1, p has 3; each type adds two more.' },
				{ type: 'choice', q: 'How many orbitals are in energy level n = 2?', options: [ '1', '2', '4', '8' ], answer: 2,
					why: 'Energy level 2 has one 2s orbital and three 2p orbitals: 4 orbitals.', hint: 'Add the orbitals in 2s and in 2p.' },
				{ type: 'choice', q: 'What is an orbital?', options: [ 'The region around the nucleus where an electron is most likely to be found', 'The circular path an electron follows around the nucleus', 'The nucleus of the atom', 'The energy given off when an electron drops to a lower level' ], answer: 0,
					why: 'An orbital is a three-dimensional region where an electron is most likely to be found. Its shape shows electron density, not a path.', hint: 'Electrons do not follow fixed paths.' }
			],
			// slot 3: how many electrons fit
			[
				{ type: 'choice', q: 'What is the greatest number of electrons a d sublevel can hold?', options: [ '2', '6', '10', '14' ], answer: 2,
					why: 'A d sublevel has 5 orbitals with 2 electrons each: 10 electrons.', hint: 'A d sublevel has 5 orbitals.' },
				{ type: 'choice', q: 'What is the greatest number of electrons a p sublevel can hold?', options: [ '2', '3', '6', '10' ], answer: 2,
					why: 'A p sublevel has 3 orbitals with 2 electrons each: 6 electrons.', hint: 'Each orbital holds at most 2 electrons.' },
				{ type: 'choice', q: 'What is the greatest number of electrons in energy level n = 3?', options: [ '8', '9', '18', '32' ], answer: 2,
					why: 'An energy level holds up to 2n² electrons: 2 × 3² = 18 (2 in 3s, 6 in 3p, 10 in 3d).', hint: 'Use 2n², or add up 3s, 3p and 3d.' },
				{ type: 'choice', q: 'Two electrons share one orbital. What must be true of them?', options: [ 'They have opposite spins', 'They have the same spin', 'They are in different energy levels', 'Nothing: an orbital holds only one electron' ], answer: 0,
					why: 'An orbital holds at most two electrons, and they must have opposite spins (the Pauli exclusion principle).', hint: 'In an orbital diagram a pair is drawn as one arrow up and one arrow down.' }
			]
		],
		find: { target: 'Li', donkey: 'Be',
			text: 'Go down one floor. Report to the room of the element with 2 electrons in energy level 1 and 1 electron in energy level 2.',
			hint: 'That is 3 electrons in all. Look for atomic number 3 on the door plates.' }
	},

	{
		n: 2, title: 'Orbital diagrams', phone: 'Li',
		call: [
			'{COMPANY} again. The offices on these floors are the s block. We need orbital diagrams filled in.',
			'Click a box to add an electron: one arrow, then a pair. Fill the lowest energy sublevels first. In a p sublevel, put one electron in each orbital before any of them pair up.'
		],
		questions: [
			// slot 1: draw a period 2 atom
			[
				{ type: 'orbital', z: 7, q: 'Fill in the orbital diagram for nitrogen (7 electrons).',
					why: `Nitrogen: ${ F( 7 ) }. The three 2p electrons go one in each 2p orbital, all unpaired.`, hint: 'Fill 1s, then 2s, then spread the rest over the three 2p boxes.' },
				{ type: 'orbital', z: 6, q: 'Fill in the orbital diagram for carbon (6 electrons).',
					why: `Carbon: ${ F( 6 ) }. The two 2p electrons go in separate 2p orbitals, with the same spin.`, hint: '1s and 2s take 4 electrons. Two are left for 2p.' },
				{ type: 'orbital', z: 8, q: 'Fill in the orbital diagram for oxygen (8 electrons).',
					why: `Oxygen: ${ F( 8 ) }. Three 2p electrons go one per orbital; the fourth pairs up, leaving two unpaired.`, hint: 'Four electrons in three 2p boxes: one box gets a pair.' },
				{ type: 'orbital', z: 9, q: 'Fill in the orbital diagram for fluorine (9 electrons).',
					why: `Fluorine: ${ F( 9 ) }. Five 2p electrons: two pairs and one single electron.`, hint: 'Five electrons in three 2p boxes.' }
			],
			// slot 2: reading a diagram
			[
				{ type: 'choice', q: 'How many unpaired electrons are in an oxygen atom?', options: N, answer: 2,
					why: 'Oxygen has 4 electrons in 2p: one pair and two single electrons.', hint: 'Draw the 2p boxes: 4 electrons in 3 boxes.' },
				{ type: 'choice', q: 'How many unpaired electrons are in a phosphorus atom?', options: N, answer: 3,
					why: `Phosphorus: ${ S( 15 ) }. The three 3p electrons go one in each 3p orbital, all unpaired.`, hint: 'Look at 3p only: 3 electrons in 3 boxes.' },
				{ type: 'choice', q: 'How many unpaired electrons are in a neon atom?', options: N, answer: 0,
					why: `Neon: ${ F( 10 ) }. Every orbital holds a pair.`, hint: 'Neon has a full 2p sublevel.' },
				{ type: 'choice', q: 'Carbon has 2 electrons in its 2p sublevel. How are they placed?', options: [ 'One in each of two 2p orbitals, with the same spin', 'Both in the first 2p orbital, with opposite spins', 'One in 2p and one in 3s', 'Both in 2s' ], answer: 0,
					why: 'In a p sublevel, one electron goes in each orbital, with parallel spins, before any of them pair up.', hint: 'Electrons spread out over the orbitals of a sublevel before pairing.' }
			],
			// slot 3: draw a period 3 atom
			[
				{ type: 'orbital', z: 11, q: 'Fill in the orbital diagram for sodium (11 electrons).',
					why: `Sodium: ${ F( 11 ) }. Every orbital is full except 3s, which has one electron.`, hint: 'Neon has 10 electrons and every box full. Sodium has one more.' },
				{ type: 'orbital', z: 13, q: 'Fill in the orbital diagram for aluminum (13 electrons).',
					why: `Aluminum: ${ F( 13 ) }. After a full 3s, the last electron goes into one 3p orbital.`, hint: 'Fill up to 3s, then one electron in 3p.' },
				{ type: 'orbital', z: 15, q: 'Fill in the orbital diagram for phosphorus (15 electrons).',
					why: `Phosphorus: ${ F( 15 ) }. The three 3p electrons go one in each 3p orbital.`, hint: 'After [Ne] and 3s², three electrons are left for 3p.' },
				{ type: 'orbital', z: 16, q: 'Fill in the orbital diagram for sulfur (16 electrons).',
					why: `Sulfur: ${ F( 16 ) }. Four 3p electrons: one pair and two single electrons.`, hint: 'Four electrons in three 3p boxes.' }
			]
		],
		find: { target: 'Mg', donkey: 'Na', diagram: 12,
			text: 'Go down one more floor. Report to the room of the element with this orbital diagram:',
			hint: 'Count the arrows: that is the atomic number.' }
	},

	{
		n: 3, title: 'Electron configurations', phone: 'Mg',
		call: [
			'{COMPANY}. The tiled rooms are the p block. Their door plates show the abbreviated configuration, with the noble gas in brackets.',
			'Check yours before you go looking.'
		],
		questions: [
			// slot 1: the full configuration
			[
				{ type: 'choice', q: 'What is the electron configuration of sulfur (16 electrons)?', options: [ F( 16 ), '1s²2s²2p⁶3s²3p⁶', '1s²2s²2p⁶3p⁶', '1s²2s²2p⁴3s²3p⁶' ], answer: 0,
					why: 'Fill 1s, 2s, 2p, 3s, then 3p: 2 + 2 + 6 + 2 + 4 = 16.', hint: 'The electrons must add up to 16, and 3s fills before 3p.' },
				{ type: 'choice', q: 'What is the electron configuration of aluminum (13 electrons)?', options: [ F( 13 ), '1s²2s²2p⁶3s³', '1s²2s²2p⁶3p³', '1s²2s²2p⁵3s²3p²' ], answer: 0,
					why: 'Fill 1s, 2s, 2p, 3s, then 3p: 2 + 2 + 6 + 2 + 1 = 13.', hint: 'An s sublevel holds at most 2 electrons.' },
				{ type: 'choice', q: 'What is the electron configuration of magnesium (12 electrons)?', options: [ F( 12 ), '1s²2s²2p⁸', '1s²2s²2p⁶3p²', '1s²2s²2p⁶3s¹' ], answer: 0,
					why: '2 + 2 + 6 = 10 fills energy levels 1 and 2. The last 2 go into 3s.', hint: 'A p sublevel holds at most 6 electrons.' },
				{ type: 'choice', q: 'What is the electron configuration of fluorine (9 electrons)?', options: [ F( 9 ), '1s²2s²2p³', '1s²2p⁷', '1s²2s²2p⁶' ], answer: 0,
					why: '2 in 1s, 2 in 2s, and the last 5 in 2p: 9 electrons.', hint: 'The superscripts must add up to 9.' }
			],
			// slot 2: the abbreviated configuration
			[
				{ type: 'choice', q: 'What is the abbreviated electron configuration of phosphorus?', options: [ S( 15 ), '[Ar]3s²3p³', '[He]3s²3p³', '[Ne]3p⁵' ], answer: 0,
					why: `The noble gas before phosphorus is neon (10 electrons). Phosphorus has 5 more: ${ S( 15 ) }.`, hint: 'Use the noble gas at the end of the period above.' },
				{ type: 'choice', q: 'What is the abbreviated electron configuration of sodium?', options: [ S( 11 ), '[He]3s¹', '[Ne]2s¹', '[Ar]3s¹' ], answer: 0,
					why: `Neon has 10 electrons. Sodium has one more, in 3s: ${ S( 11 ) }.`, hint: 'Sodium starts period 3, right after neon.' },
				{ type: 'choice', q: 'What is the abbreviated electron configuration of oxygen?', options: [ S( 8 ), '[Ne]2s²2p⁴', '[He]2p⁶', '[He]2s²2p⁶' ], answer: 0,
					why: `Helium has 2 electrons. Oxygen has 6 more: ${ S( 8 ) }.`, hint: 'The noble gas before a period 2 element is helium.' },
				{ type: 'choice', q: 'What is the abbreviated electron configuration of silicon?', options: [ S( 14 ), '[Ar]3s²3p²', '[Ne]3s⁴', '[Ne]3p⁴' ], answer: 0,
					why: `Neon has 10 electrons. Silicon has 4 more: 2 in 3s and 2 in 3p.`, hint: '3s fills before 3p.' }
			],
			// slot 3: which element is it?
			[
				{ type: 'choice', q: `Which element has the electron configuration ${ F( 8 ) }?`, options: [ 'N', 'O', 'F', 'S' ], answer: 1, keep: true,
					why: '2 + 2 + 4 = 8 electrons: oxygen.', hint: 'Add the superscripts.' },
				{ type: 'choice', q: `Which element has the abbreviated configuration ${ S( 14 ) }?`, options: [ 'C', 'Al', 'Si', 'P' ], answer: 2, keep: true,
					why: '[Ne] is 10 electrons, plus 4 more: 14, silicon.', hint: '[Ne] stands for 10 electrons.' },
				{ type: 'choice', q: `Which element has the electron configuration ${ F( 18 ) }?`, options: [ 'Ne', 'Cl', 'Ar', 'K' ], answer: 2, keep: true,
					why: '2 + 2 + 6 + 2 + 6 = 18 electrons: argon, with a full 3p sublevel.', hint: 'Add the superscripts.' },
				{ type: 'choice', q: `Which element has the abbreviated configuration ${ S( 5 ) }?`, options: [ 'Be', 'B', 'C', 'Al' ], answer: 1, keep: true,
					why: '[He] is 2 electrons, plus 3 more: 5, boron.', hint: '[He] stands for 2 electrons.' }
			]
		],
		find: { target: 'Cl', donkey: 'S',
			text: `Stay on this floor. Report to the room with configuration ${ F( 17 ) }.`,
			hint: 'Write it abbreviated: the first 10 electrons are [Ne]. Then find the door plate that matches.' }
	},

	{
		n: 4, title: 'Period 4 and the periodic table', phone: 'Cl',
		call: [
			'{COMPANY}. The bottom floor is period 4. The parking bays are the d block, and the number painted in each bay is how many electrons that atom has in 3d.',
			'On this floor, 4s fills before 3d: electrons in 4s are slightly lower in energy.'
		],
		questions: [
			// slot 1: blocks and filling order
			[
				{ type: 'choice', q: 'Which sublevel fills right after 4s?', options: [ '4p', '3d', '4d', '3p' ], answer: 1,
					why: 'After 4s comes 3d. That is why the d block starts in period 4.', hint: 'The d block sits between Group 2A (2) and Group 3A (13) in period 4.' },
				{ type: 'choice', q: 'Why does 4s fill before 3d?', options: [ 'Electrons in 4s are slightly lower in energy than electrons in 3d', 'A 4s orbital holds more electrons than a 3d orbital', '3d is already full by then', 's sublevels always fill last' ], answer: 0,
					why: 'The 4s electrons are slightly lower in energy, so 4s fills first. The same happens with 5s and 4d, and 6s and 5d.', hint: 'Electrons fill the lowest energy sublevel available.' },
				{ type: 'choice', q: 'The d block in period 4 fills which sublevel?', options: [ '4d', '3d', '4p', '5d' ], answer: 1,
					why: 'The d sublevel is one less than the period number (n − 1): period 4 fills 3d.', hint: 'Take one away from the period number.' },
				{ type: 'choice', q: 'How many elements are in each period of the d block?', options: [ '2', '6', '10', '14' ], answer: 2,
					why: 'Five d orbitals hold up to 10 electrons, so each period of the d block has 10 elements.', hint: 'A d sublevel has 5 orbitals.' }
			],
			// slot 2: configurations in the d block (not Cr or Cu, and not the room to find)
			[
				{ type: 'choice', q: 'What is the abbreviated electron configuration of titanium (22 electrons)?', options: [ S( 22 ), '[Ar]3d⁴', '[Ar]4s²4d²', '[Kr]4s²3d²' ], answer: 0,
					why: `Argon has 18. Titanium has 4 more: 4s² first, then 3d². ${ S( 22 ) }.`, hint: 'Start from [Ar] and fill 4s before 3d.' },
				{ type: 'choice', q: 'What is the abbreviated electron configuration of vanadium (23 electrons)?', options: [ S( 23 ), '[Ar]4s²4p³', '[Ar]3d⁵', '[Ar]4s³3d²' ], answer: 0,
					why: `Argon has 18. Vanadium has 5 more: 4s², then 3d³.`, hint: 'An s sublevel holds at most 2 electrons.' },
				{ type: 'choice', q: 'What is the abbreviated electron configuration of manganese (25 electrons)?', options: [ S( 25 ), '[Ar]3d⁷', '[Ar]4s²4d⁵', '[Ar]4s²3d⁷' ], answer: 0,
					why: `Argon has 18. Manganese has 7 more: 4s², then 3d⁵.`, hint: 'Start from [Ar] and fill 4s before 3d.' },
				{ type: 'choice', q: 'What is the electron configuration of zinc (30 electrons)?', options: [ F( 30 ), '1s²2s²2p⁶3s²3p⁶3d¹²', '1s²2s²2p⁶3s²3p⁶4s²4p⁶3d⁴', '1s²2s²2p⁶3s²3p⁶4s²3d⁸' ], answer: 0,
					why: 'After [Ar] come 4s² and then a full 3d¹⁰: 18 + 2 + 10 = 30.', hint: 'A d sublevel holds at most 10 electrons.' }
			],
			// slot 3: the rest of period 4
			[
				{ type: 'choice', q: `Which element has the abbreviated configuration ${ S( 35 ) }?`, options: [ 'Cl', 'Se', 'Br', 'Kr' ], answer: 2, keep: true,
					why: '[Ar] is 18 electrons, then 2 + 10 + 5 = 17 more: 35, bromine.', hint: 'It is the fifth element of the 4p block.' },
				{ type: 'choice', q: 'What is the abbreviated electron configuration of gallium (31 electrons)?', options: [ S( 31 ), '[Ar]4s²4p¹', '[Ar]4s²3d¹', '[Ar]3d¹⁰4p³' ], answer: 0,
					why: `After 4s² and a full 3d¹⁰, gallium's last electron starts 4p: ${ S( 31 ) }.`, hint: 'The 3d sublevel fills before 4p.' },
				{ type: 'choice', q: `Which element has the abbreviated configuration ${ S( 28 ) }?`, options: [ 'Fe', 'Co', 'Ni', 'Zn' ], answer: 2, keep: true,
					why: '[Ar] is 18 electrons, then 2 + 8 = 10 more: 28, nickel.', hint: 'Count across the d block: 3d⁸ is the eighth element.' },
				{ type: 'choice', q: `Which element has the abbreviated configuration ${ S( 20 ) }?`, options: [ 'K', 'Ca', 'Sc', 'Mg' ], answer: 1, keep: true,
					why: '[Ar] is 18 electrons, plus 4s²: 20, calcium.', hint: '[Ar] stands for 18 electrons.' }
			]
		],
		find: { target: 'Fe', donkey: 'Co',
			text: 'Go down to the parking level. Report to the bay of the element whose atoms have 6 electrons in 3d.',
			hint: 'Look at the numbers painted on the bay floors.' }
	},

	{
		n: 5, title: 'Valence electrons', phone: 'Fe',
		call: [
			'{COMPANY}. Valence electrons are the s and p electrons in the highest energy level. In the representative elements, the number of lit tubes in each room is the number of valence electrons.',
			'You can read it from the group number.'
		],
		questions: [
			// slot 1: from the group number
			[
				{ type: 'choice', q: 'How many valence electrons does an atom of a Group 6A (16) element have?', options: [ '2', '4', '6', '16' ], answer: 2,
					why: 'For the representative elements, the number of valence electrons is the A group number: Group 6A, 6 valence electrons.', hint: 'Group 16 is Group 6A.' },
				{ type: 'choice', q: 'Chlorine is in Group 7A (17). How many valence electrons does it have?', options: [ '1', '7', '10', '17' ], answer: 1,
					why: `Chlorine's valence electrons are 3s²3p⁵: 7, the same as its A group number.`, hint: 'Use the A group number.' },
				{ type: 'choice', q: 'Aluminum is in Group 3A (13). How many valence electrons does it have?', options: [ '1', '3', '10', '13' ], answer: 1,
					why: `Aluminum's valence electrons are 3s²3p¹: 3.`, hint: 'Use the A group number, not 13.' },
				{ type: 'choice', q: 'Which group has 1 valence electron?', options: [ 'Group 1A (1)', 'Group 2A (2)', 'Group 7A (17)', 'Group 8A (18)' ], answer: 0, keep: true,
					why: 'The elements in Group 1A (1) have one valence electron, in an s orbital.', hint: 'The answer is the group of sodium and potassium.' }
			],
			// slot 2: which electrons count
			[
				{ type: 'choice', q: 'Which electrons are the valence electrons?', options: [ 'The s and p electrons in the highest energy level', 'All the electrons in the atom', 'The electrons in the d sublevel', 'The electrons in energy level 1' ], answer: 0,
					why: 'Valence electrons are the s and p electrons in the highest energy level. They decide how the element reacts.', hint: 'They are the outermost electrons.' },
				{ type: 'choice', q: 'What is the valence electron configuration of germanium (Group 4A (14), period 4)?', options: [ '4s²4p²', '3d¹⁰4s²4p²', '4p²', '4s²' ], answer: 0,
					why: 'Valence electrons are only the 4s and 4p electrons. The 3d electrons are not valence electrons.', hint: 'Leave out the d electrons.' },
				{ type: 'choice', q: 'What is the valence electron configuration of calcium?', options: [ '4s²', '3p⁶4s²', '4s¹', '3d²' ], answer: 0,
					why: 'Calcium is in Group 2A (2) and period 4: two valence electrons in 4s.', hint: 'Group 2A, period 4.' },
				{ type: 'choice', q: 'Bromine has 35 electrons. How many of them are valence electrons?', options: [ '5', '7', '17', '35' ], answer: 1,
					why: `Bromine's valence electrons are 4s²4p⁵: 7. The 3d¹⁰ electrons do not count.`, hint: 'Bromine is in Group 7A (17).' }
			],
			// slot 3: the lit tubes
			[
				{ type: 'choice', q: 'Magnesium is in Group 2A (2). How many tubes are lit in the magnesium room?', options: [ '1', '2', '8', '12' ], answer: 1,
					why: 'Magnesium has 2 valence electrons (3s²), so 2 tubes are lit.', hint: 'Lit tubes equal valence electrons.' },
				{ type: 'choice', q: 'How many tubes are lit in the sulfur room?', options: [ '2', '4', '6', '16' ], answer: 2,
					why: 'Sulfur is in Group 6A (16): 6 valence electrons (3s²3p⁴), so 6 lit tubes.', hint: 'Sulfur is in Group 6A (16).' },
				{ type: 'choice', q: 'A room has 3 lit tubes. Which group is it in?', options: [ 'Group 1A (1)', 'Group 2A (2)', 'Group 3A (13)', 'Group 8A (18)' ], answer: 2, keep: true,
					why: 'Three valence electrons: Group 3A (13).', hint: 'The A group number equals the valence electrons.' },
				{ type: 'choice', q: 'Neon has a complete octet. How many tubes are lit in the neon room?', options: [ '2', '6', '8', '10' ], answer: 2,
					why: 'Neon is in Group 8A (18): 8 valence electrons (2s²2p⁶). Helium, also a noble gas, has only 2.', hint: 'An octet is 8.' }
			]
		],
		find: { target: 'As', donkey: 'Se',
			text: 'Stay on this floor. Report to the tiled room with 5 lit tubes.',
			hint: 'Five valence electrons: Group 5A (15).' }
	},

	{
		n: 6, title: 'Atomic size: the way out', phone: 'As',
		call: [
			'{COMPANY}. Last one. The rooms are sized to their atoms.',
			'Atoms get smaller going across a period and larger going down a group. The exit is in the room of the largest atom in the building.'
		],
		questions: [
			// slot 1: across a period
			[
				{ type: 'choice', q: 'Which atom is larger: sodium or chlorine?', options: [ 'Sodium', 'Chlorine', 'They are the same size' ], answer: 0, keep: true,
					why: 'Across a period, more protons pull the valence electrons closer, so atoms get smaller. Sodium is on the left.', hint: 'Both are in period 3. Which is farther left?' },
				{ type: 'choice', q: 'Which atom is larger: magnesium or sulfur?', options: [ 'Magnesium', 'Sulfur', 'They are the same size' ], answer: 0, keep: true,
					why: 'Magnesium is farther left in period 3, with fewer protons pulling on its valence electrons.', hint: 'Atomic size decreases from left to right.' },
				{ type: 'choice', q: 'Which atom is larger: boron or fluorine?', options: [ 'Boron', 'Fluorine', 'They are the same size' ], answer: 0, keep: true,
					why: 'Both are in period 2. Fluorine has more protons, which pull its valence electrons closer.', hint: 'Atomic size decreases from left to right.' },
				{ type: 'choice', q: 'Which atom is larger: calcium or bromine?', options: [ 'Calcium', 'Bromine', 'They are the same size' ], answer: 0, keep: true,
					why: 'Both are in period 4. Calcium is on the left, so it is larger.', hint: 'Same period: which is farther left?' }
			],
			// slot 2: down a group
			[
				{ type: 'choice', q: 'Which atom is larger: lithium or potassium?', options: [ 'Lithium', 'Potassium', 'They are the same size' ], answer: 1, keep: true,
					why: 'Down a group, each atom has another energy level, so it is larger. Potassium is below lithium.', hint: 'Both are in Group 1A (1). Which has more energy levels?' },
				{ type: 'choice', q: 'Which atom is larger: fluorine or chlorine?', options: [ 'Fluorine', 'Chlorine', 'They are the same size' ], answer: 1, keep: true,
					why: 'Chlorine is below fluorine in Group 7A (17): its valence electrons are in energy level 3, farther from the nucleus.', hint: 'Same group: which is lower?' },
				{ type: 'choice', q: 'Which atom is larger: nitrogen or phosphorus?', options: [ 'Nitrogen', 'Phosphorus', 'They are the same size' ], answer: 1, keep: true,
					why: 'Phosphorus is below nitrogen in Group 5A (15), with one more energy level.', hint: 'Atomic size increases going down a group.' },
				{ type: 'choice', q: 'Put these in order from smallest to largest: Mg, Ca, Be.', options: [ 'Be < Mg < Ca', 'Ca < Mg < Be', 'Mg < Be < Ca', 'Be < Ca < Mg' ], answer: 0,
					why: 'All three are in Group 2A (2). Size increases going down the group: Be, then Mg, then Ca.', hint: 'They are all in the same group.' }
			],
			// slot 3: the reasons
			[
				{ type: 'choice', q: 'Why do atoms get smaller from left to right across a period?', options: [ 'More protons pull the valence electrons closer to the nucleus', 'Each atom has one more energy level', 'The atoms lose valence electrons', 'The electrons move into d orbitals' ], answer: 0,
					why: 'Across a period the energy level stays the same, but each atom has more protons, which pull the valence electrons closer.', hint: 'Elements in the same period have the same number of energy levels.' },
				{ type: 'choice', q: 'Why do atoms get larger going down a group?', options: [ 'Each atom has one more energy level, so its valence electrons are farther from the nucleus', 'Each atom has fewer protons', 'Each atom has more valence electrons', 'The nucleus gets larger' ], answer: 0,
					why: 'Going down a group adds an energy level, so the valence electrons are farther from the nucleus.', hint: 'Elements in a group have the same number of valence electrons.' },
				{ type: 'choice', q: 'Put these in order from smallest to largest: Na, Cl, Si.', options: [ 'Cl < Si < Na', 'Na < Si < Cl', 'Si < Cl < Na', 'Na < Cl < Si' ], answer: 0,
					why: 'All three are in period 3. Size decreases from left to right: Na, Si, Cl, so the smallest is Cl.', hint: 'Same period: the one farthest right is smallest.' }
			]
		],
		find: { target: 'K', donkey: 'Ca',
			text: 'Find the exit: the room of the largest atom in the building.',
			hint: 'The largest atoms are at the bottom left: the lowest floor, the first group.' }
	}

];

// Debrief (handoff section 9). Wording approved by Prof. Picione on 2026-11-26.
export const DEBRIEF = [
	'Each floor was a period, filling one more energy level: period 1 at the top, period 4 at the bottom.',
	'Each room\'s position along the hallway was its group.',
	'The wings were the sublevel blocks: offices for s, tiled rooms for p, parking bays for d.',
	'Each room\'s size was the atom\'s size: smaller going across a period, larger going down a group.',
	'In the s and p blocks, the lit tubes were the valence electrons.'
];
