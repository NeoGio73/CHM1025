// Electron configurations for periods 1 to 4, written in filling order (1s 2s 2p 3s 3p 4s 3d 4p).
// Checked against the Chapter 5 slides (5.4 and 5.5 tables, 2026-11-26): period 4 is written 4s before 3d,
// sublevels with no spaces between them, and the noble gas core in brackets with no space ([Ar]4s²3d⁶).
// Prof. Picione teaches configurations in filling order, not numerical order (3d before 4s): keep it this way.
// The chromium and copper exceptions are out of scope (handoff section 11, item 2): plain filling order is used,
// and no question, plate or bay number uses Cr or Cu.

const ORDER = [ [ 1, 's' ], [ 2, 's' ], [ 2, 'p' ], [ 3, 's' ], [ 3, 'p' ], [ 4, 's' ], [ 3, 'd' ], [ 4, 'p' ] ];
const CAP = { s: 2, p: 6, d: 10 };
const CORES = [ [ 18, 'Ar' ], [ 10, 'Ne' ], [ 2, 'He' ] ];
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
export const sup = n => String( n ).split( '' ).map( d => SUP[ d ] ).join( '' );

// [ { n, l, e } ] in filling order
export function sublevels( z ) {

	const out = [];
	let left = z;
	for ( const [ n, l ] of ORDER ) {

		if ( left <= 0 ) break;
		const e = Math.min( CAP[ l ], left );
		out.push( { n, l, e } );
		left -= e;

	}

	return out;

}

const fmt = list => list.map( s => `${ s.n }${ s.l }${ sup( s.e ) }` ).join( '' );

export const fullConfig = z => fmt( sublevels( z ) );

// noble gas core: the last noble gas before the element (neon is written [He]2s²2p⁶, as on the slides)
export function shortConfig( z ) {

	const core = CORES.find( ( [ cz ] ) => cz < z );
	if ( ! core ) return fullConfig( z );
	const rest = sublevels( z );
	let skip = core[ 0 ];
	while ( skip > 0 ) skip -= rest.shift().e;
	return `[${ core[ 1 ] }]${ fmt( rest ) }`;

}

// electrons in 3d (the bay numbers on the parking level); null for Cr and Cu (out of scope)
export function dCount( z ) {

	if ( z === 24 || z === 29 ) return null;
	return sublevels( z ).find( s => s.n === 3 && s.l === 'd' )?.e ?? 0;

}

// orbital diagram as box states per sublevel: one electron in each orbital of a sublevel before any pair up
// (the slides give the rule without a name): [ { label, boxes: [ '', '↑', '↑↓' ] } ]
export function orbitalDiagram( z ) {

	return sublevels( z ).map( s => {

		const k = { s: 1, p: 3, d: 5 }[ s.l ];
		const boxes = [];
		for ( let i = 0; i < k; i ++ ) boxes.push( s.e > k + i ? '↑↓' : s.e > i ? '↑' : '' );
		return { label: `${ s.n }${ s.l }`, boxes };

	} );

}
