// The building's data: periods 1 to 4 of the periodic table, one room per element.
// period = floor (1 is the top floor), group = position along the floor (1 to 18, left to right).
// radius: atomic radius in picometres, used ONLY to size the rooms (game values for the trend; no question
// uses these numbers: the Chapter 5 slides teach only the direction of the trend).
// valence: valence electrons for representative elements (groups 1, 2, 13 to 18) = lit tubes in the room.

export const ELEMENTS = [
	// period 1
	{ z: 1, sym: 'H', name: 'Hydrogen', period: 1, group: 1, radius: 37 },
	{ z: 2, sym: 'He', name: 'Helium', period: 1, group: 18, radius: 32 },
	// period 2
	{ z: 3, sym: 'Li', name: 'Lithium', period: 2, group: 1, radius: 152 },
	{ z: 4, sym: 'Be', name: 'Beryllium', period: 2, group: 2, radius: 112 },
	{ z: 5, sym: 'B', name: 'Boron', period: 2, group: 13, radius: 85 },
	{ z: 6, sym: 'C', name: 'Carbon', period: 2, group: 14, radius: 77 },
	{ z: 7, sym: 'N', name: 'Nitrogen', period: 2, group: 15, radius: 75 },
	{ z: 8, sym: 'O', name: 'Oxygen', period: 2, group: 16, radius: 73 },
	{ z: 9, sym: 'F', name: 'Fluorine', period: 2, group: 17, radius: 72 },
	{ z: 10, sym: 'Ne', name: 'Neon', period: 2, group: 18, radius: 71 },
	// period 3
	{ z: 11, sym: 'Na', name: 'Sodium', period: 3, group: 1, radius: 186 },
	{ z: 12, sym: 'Mg', name: 'Magnesium', period: 3, group: 2, radius: 160 },
	{ z: 13, sym: 'Al', name: 'Aluminum', period: 3, group: 13, radius: 143 },
	{ z: 14, sym: 'Si', name: 'Silicon', period: 3, group: 14, radius: 118 },
	{ z: 15, sym: 'P', name: 'Phosphorus', period: 3, group: 15, radius: 110 },
	{ z: 16, sym: 'S', name: 'Sulfur', period: 3, group: 16, radius: 103 },
	{ z: 17, sym: 'Cl', name: 'Chlorine', period: 3, group: 17, radius: 100 },
	{ z: 18, sym: 'Ar', name: 'Argon', period: 3, group: 18, radius: 98 },
	// period 4
	{ z: 19, sym: 'K', name: 'Potassium', period: 4, group: 1, radius: 227 },
	{ z: 20, sym: 'Ca', name: 'Calcium', period: 4, group: 2, radius: 197 },
	{ z: 21, sym: 'Sc', name: 'Scandium', period: 4, group: 3, radius: 162 },
	{ z: 22, sym: 'Ti', name: 'Titanium', period: 4, group: 4, radius: 147 },
	{ z: 23, sym: 'V', name: 'Vanadium', period: 4, group: 5, radius: 134 },
	{ z: 24, sym: 'Cr', name: 'Chromium', period: 4, group: 6, radius: 128 },
	{ z: 25, sym: 'Mn', name: 'Manganese', period: 4, group: 7, radius: 127 },
	{ z: 26, sym: 'Fe', name: 'Iron', period: 4, group: 8, radius: 126 },
	{ z: 27, sym: 'Co', name: 'Cobalt', period: 4, group: 9, radius: 125 },
	{ z: 28, sym: 'Ni', name: 'Nickel', period: 4, group: 10, radius: 124 },
	{ z: 29, sym: 'Cu', name: 'Copper', period: 4, group: 11, radius: 128 },
	{ z: 30, sym: 'Zn', name: 'Zinc', period: 4, group: 12, radius: 134 },
	{ z: 31, sym: 'Ga', name: 'Gallium', period: 4, group: 13, radius: 135 },
	{ z: 32, sym: 'Ge', name: 'Germanium', period: 4, group: 14, radius: 122 },
	{ z: 33, sym: 'As', name: 'Arsenic', period: 4, group: 15, radius: 120 },
	{ z: 34, sym: 'Se', name: 'Selenium', period: 4, group: 16, radius: 119 },
	{ z: 35, sym: 'Br', name: 'Bromine', period: 4, group: 17, radius: 114 },
	{ z: 36, sym: 'Kr', name: 'Krypton', period: 4, group: 18, radius: 112 }
];

export const blockOf = e => e.sym === 'He' ? 's' : e.group <= 2 ? 's' : e.group <= 12 ? 'd' : 'p'; // helium is s block by configuration (1s2) but its room is a pool room (group 18), decided 2026-11-26
// helium is an s-block element by configuration (1s2) but sits in group 18; its room is a pool room like the rest of group 18
export const roomKind = e => e.group <= 2 ? 'office' : e.group <= 12 ? 'parking' : 'pool';
export const valenceOf = e => e.sym === 'He' ? 2 : e.group <= 2 ? e.group : e.group >= 13 ? e.group - 10 : null;
