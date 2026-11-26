// Segment-vs-box shielding for the dose model (same as the look test).
// Each occluder is { min, max, atten }; slices of one barrier share a group and attenuate once.

export function segmentHitsBox( p, q, b, eps = 1e-4 ) {

	let t0 = 0, t1 = 1;
	for ( const k of [ 'x', 'y', 'z' ] ) {

		const d = q[ k ] - p[ k ];
		if ( Math.abs( d ) < 1e-9 ) { if ( p[ k ] < b.min[ k ] || p[ k ] > b.max[ k ] ) return false; continue; }
		let ta = ( b.min[ k ] - p[ k ] ) / d, tb = ( b.max[ k ] - p[ k ] ) / d;
		if ( ta > tb ) [ ta, tb ] = [ tb, ta ];
		t0 = Math.max( t0, ta ); t1 = Math.min( t1, tb );
		if ( t0 > t1 ) return false;

	}

	return t1 > eps && t0 < 1 - eps;

}

export function transmission( p, q, occluders ) {

	let T = 1;
	const seen = new Set();
	for ( const b of occluders ) {

		if ( b.atten >= 1 ) continue;
		if ( b.group && seen.has( b.group ) ) continue;
		if ( segmentHitsBox( p, q, b ) ) { T *= b.atten; if ( b.group ) seen.add( b.group ); if ( T < 1e-6 ) return 0; }

	}

	return T;

}
