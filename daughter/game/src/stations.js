// Station logic: what each terminal shows and checks. Puzzles draw from src/questions.js.
// G is the game context from main.js (state, dose, doors, saving, sound).

import * as Q from './questions.js';
import { el, openPanel, closePanel, feedback, equationEl, termHTML, nucHTML, totals } from './ui.js';

const ELEMENT_NAMES = { He: 'helium', e: 'electron', n: 'neutron' };

// ---------------------------------------------------------------- per-run picks (saved, so a restart keeps the same questions)

export function makePicks( rng ) {

	const pick = a => a[ Math.floor( rng() * a.length ) ];
	const shuffle = a => { const b = [ ...a ]; for ( let i = b.length - 1; i > 0; i -- ) { const j = Math.floor( rng() * ( i + 1 ) ); [ b[ i ], b[ j ] ] = [ b[ j ], b[ i ] ]; } return b; };
	const idx = a => Math.floor( rng() * a.length );

	// station 2: alpha, beta and positron in the side vaults (random order), gamma or bombardment on the exit door
	const kinds = shuffle( [ 'alpha', 'beta', 'positron' ] );
	const exitKind = rng() < 0.5 ? 'gamma' : 'bombardment';
	const conv = idx( Q.CONVERSIONS );
	const hl = idx( Q.HALF_LIFE );
	const fis = Q.SORT_STATEMENTS.filter( s => s.a === 'fission' ), fus = Q.SORT_STATEMENTS.filter( s => s.a === 'fusion' );
	return {
		s1order: shuffle( Q.SYMBOL_MATCH ),
		s2: {
			vaultA: { kind: kinds[ 0 ], i: idx( Q.EQUATIONS_16_2[ kinds[ 0 ] ] ) },
			vaultB: { kind: kinds[ 1 ], i: idx( Q.EQUATIONS_16_2[ kinds[ 1 ] ] ) },
			vaultC: { kind: kinds[ 2 ], i: idx( Q.EQUATIONS_16_2[ kinds[ 2 ] ] ) },
			vaultExit: { kind: exitKind, i: idx( Q.EQUATIONS_16_2[ exitKind ] ) }
		},
		s3: { units: shuffle( Q.UNITS.map( ( u, i ) => i ) ), conv, convX: pick( Q.CONVERSIONS[ conv ].x ) },
		s4: { iso: hl, safe: pick( Q.SAFE_ACTIVITY ), n: pick( Q.HALF_LIVES_NEEDED ) },
		s6: {
			sort: shuffle( [ ...shuffle( fis ).slice( 0, 3 ), ...shuffle( fus ).slice( 0, 3 ) ].map( s => Q.SORT_STATEMENTS.indexOf( s ) ) ),
			fissionMissing: rng() < 0.5 ? 0 : 1,
			rodOrder: shuffle( [ 0, 1, 2, 3 ] ),
			whyOrder: shuffle( [ 0, 1, 2, 3 ] )
		}
	};

}

export function freshState() {

	return {
		s1: { symbols: false, barriers: [ false, false, false ] },
		s2: { vaultA: false, vaultB: false, vaultC: false, vaultExit: false },
		s3: { equip: false, units: false, conv: false },
		s4: { elapsed: 0, set: false },
		s5: { charts: [ false, false, false ], why: false },
		s6: { sort: false, fission: false, rods: false, finale: 0 },
		completed: [ false, false, false, false, false, false ]
	};

}

// what the player should do next (HUD objective line)
export function objective( S, picks, cp ) {

	if ( cp <= 1 ) {

		if ( ! S.s1.symbols ) return 'Identify the radiation symbols at the ID chart.';
		const b = S.s1.barriers.indexOf( false );
		if ( b >= 0 ) return `Take the right protection from the locker at the ${ [ 'alpha', 'beta', 'gamma' ][ b ] } barrier.`;
		return 'Go on to the records vault.';

	}

	if ( cp === 2 ) {

		const left = [ 'vaultA', 'vaultB', 'vaultC', 'vaultExit' ].filter( k => ! S.s2[ k ] ).length;
		return left ? `Balance the nuclear equations on the vault locks (${ 4 - left } of 4 open).` : 'Go on to the monitoring station.';

	}

	if ( cp === 3 ) {

		if ( ! S.s3.equip ) return 'Take the Geiger counter and dosimeter from the bench.';
		if ( ! S.s3.units || ! S.s3.conv ) return 'Calibrate the instruments at the calibration terminal.';
		return 'Go on to the hot corridor.';

	}

	if ( cp === 4 ) return S.s4.set ? 'Cross the hot corridor. Do not linger.' : 'Read the source log, then set the corridor clock.';
	if ( cp === 5 ) {

		const c = S.s5.charts.filter( Boolean ).length;
		if ( c < 3 ) return `Choose the right radioisotope for each patient chart (${ c } of 3).`;
		if ( ! S.s5.why ) return 'Open the key cabinet.';
		return 'Take the key to the control room.';

	}

	if ( cp === 6 ) {

		if ( ! S.s6.sort ) return 'Sort the reactor log entries.';
		if ( ! S.s6.fission ) return 'Complete the fission equation on the fission monitor.';
		if ( ! S.s6.rods ) return 'Lower the control rods.';
		return 'Bring the Daughter to a stable isotope at the decay console.';

	}

	return '';

}

// ---------------------------------------------------------------- shared widgets

// slot for a missing nuclide: mass number, atomic number, symbol
function nuclideSlot() {

	const A = el( 'input', { class: 'num a', inputmode: 'numeric', 'aria-label': 'mass number', maxlength: 3, placeholder: 'A' } );
	const Z = el( 'input', { class: 'num z', inputmode: 'numeric', 'aria-label': 'atomic number', maxlength: 4, placeholder: 'Z' } );
	const S = el( 'input', { class: 'sym', 'aria-label': 'element symbol', maxlength: 2, placeholder: 'Sym', autocapitalize: 'off', spellcheck: 'false' } );
	const slot = el( 'span', { class: 'slot nucslot' }, el( 'span', { class: 'az' }, A, Z ), S );
	slot.read = () => ( { A: parseInt( A.value, 10 ), Z: parseInt( ( Z.value || '' ).replace( '−', '-' ), 10 ), sym: S.value.trim() } );
	slot.inputs = [ A, Z, S ];
	return slot;

}

// slot for a missing particle: one button per particle in Table 16.2
function particleSlot() {

	const slot = el( 'span', { class: 'slot partslot' } );
	const row = el( 'div', { class: 'choices particles' } );
	let chosen = null;
	for ( const k of [ 'alpha', 'beta', 'positron', 'gamma', 'neutron', 'proton' ] ) {

		const P = Q.PARTICLES[ k ];
		const b = el( 'button', { class: 'choice', type: 'button', 'aria-label': P.name, html: nucHTML( P.A, P.Z, P.sym, { zPlus: k === 'positron' } ) } );
		b.addEventListener( 'click', () => { chosen = k; row.querySelectorAll( 'button' ).forEach( x => x.classList.toggle( 'on', x === b ) ); slot.innerHTML = nucHTML( P.A, P.Z, P.sym, { zPlus: k === 'positron' } ); } );
		row.append( b );

	}

	slot.innerHTML = '<span class="q">?</span>';
	slot.read = () => chosen;
	slot.row = row;
	return slot;

}

const normSym = s => s ? s[ 0 ].toUpperCase() + s.slice( 1 ).toLowerCase() : '';

// checks a nuclide answer and explains what is off
function checkNuclide( eq, ans ) {

	const want = eq.rhs[ eq.missing ];
	const L = totals( eq.lhs ), others = totals( eq.rhs.filter( ( t, i ) => i !== eq.missing ) );
	const needA = L.A - others.A, needZ = L.Z - others.Z;
	if ( ! Number.isFinite( ans.A ) || ! Number.isFinite( ans.Z ) || ! ans.sym ) return { ok: false, msg: 'Fill in the mass number, the atomic number and the symbol.' };
	if ( ans.A !== needA ) return { ok: false, msg: `Check the mass number. The mass numbers on the left add up to ${ L.A }, so the right side must also add up to ${ L.A }.` };
	if ( ans.Z !== needZ ) return { ok: false, msg: `Check the atomic number. The atomic numbers on the left add up to ${ L.Z }, so the right side must also add up to ${ L.Z }.` };
	if ( normSym( ans.sym ) !== want.sym ) return { ok: false, msg: `The numbers are right. Now find the element with atomic number ${ needZ } on the periodic table.` };
	return { ok: true, msg: `Balanced. The new nucleus is ${ want.name }.` };

}

function checkParticle( eq, k ) {

	if ( ! k ) return { ok: false, msg: 'Pick a particle.' };
	const want = eq.rhs[ eq.missing ].p;
	if ( k === want ) return { ok: true, msg: `Balanced. The nucleus gives off a ${ Q.PARTICLES[ want ].name }.` };
	const L = totals( eq.lhs ), others = totals( eq.rhs.filter( ( t, i ) => i !== eq.missing ) );
	return { ok: false, msg: `That does not balance. The missing piece must have mass number ${ L.A - others.A } and atomic number ${ L.Z - others.Z }.` };

}

// one equation with a check button; calls onSolved when right
function equationTask( body, G, eq, onSolved, { intro = '' } = {} ) {

	if ( intro ) body.append( el( 'p', { html: intro } ) );
	const isParticle = !! eq.rhs[ eq.missing ].p;
	const slot = isParticle ? particleSlot() : nuclideSlot();
	body.append( equationEl( eq, slot ) );
	if ( isParticle ) body.append( slot.row );
	else body.append( el( 'p', { class: 'hint', html: 'Type the mass number (top), the atomic number (bottom) and the symbol of the missing nucleus.' } ) );
	const btn = el( 'button', { class: 'primary', type: 'button' }, 'Check' );
	body.append( el( 'div', { class: 'actions' }, btn ) );
	const go = () => {

		const r = isParticle ? checkParticle( eq, slot.read() ) : checkNuclide( eq, slot.read() );
		if ( r.ok ) { feedback( body, r.msg, true ); btn.disabled = true; slot.inputs?.forEach( i => i.disabled = true ); G.sfx( 'good' ); onSolved(); } else feedback( body, r.msg + G.wrong(), false );

	};

	btn.addEventListener( 'click', go );
	slot.inputs?.forEach( i => i.addEventListener( 'keydown', e => { if ( e.key === 'Enter' ) go(); } ) );

}

function solvedNote( body, text ) { body.append( el( 'p', { class: 'done' }, text ) ); }

// multiple choice; options in a saved order
function choiceTask( body, G, q, order, onSolved ) {

	body.append( el( 'p', { class: 'q' }, q.q ) );
	const box = el( 'div', { class: 'choices col' } );
	order.forEach( i => {

		const o = q.options[ i ];
		const b = el( 'button', { class: 'choice', type: 'button' }, o.t );
		b.addEventListener( 'click', () => {

			if ( o.ok ) { b.classList.add( 'right' ); box.querySelectorAll( 'button' ).forEach( x => x.disabled = true ); feedback( body, 'Correct.', true ); G.sfx( 'good' ); onSolved(); } else { b.classList.add( 'wrong' ); b.disabled = true; feedback( body, ( o.why || 'Not quite.' ) + G.wrong(), false ); }

		} );
		box.append( b );

	} );
	body.append( box );

}

// ---------------------------------------------------------------- handlers

export function createStations( G ) {

	const S = () => G.state, P = () => G.picks;

	const H = {};

	// ===== station 1: entry hall, 16.1

	H.symbols = () => openPanel( 'Radiation ID chart (16.1)', body => {

		if ( S().s1.symbols ) { solvedNote( body, 'All six symbols are identified.' ); return; }
		body.append( el( 'p', {}, 'Before you go past the barriers, match each symbol to the kind of radiation or particle it stands for.' ) );
		const rows = el( 'div', { class: 'match' } );
		const selects = [];
		for ( const k of P().s1order ) {

			const Pt = Q.PARTICLES[ k ];
			const sel = el( 'select', { 'aria-label': 'name for symbol' }, el( 'option', { value: '' }, 'choose…' ), ...Q.SYMBOL_MATCH.map( m => el( 'option', { value: m }, Q.PARTICLES[ m ].name ) ) );
			sel.dataset.want = k; selects.push( sel );
			rows.append( el( 'div', { class: 'mrow' }, el( 'span', { class: 'big', html: nucHTML( Pt.A, Pt.Z, Pt.sym, { zPlus: k === 'positron' } ) } ), sel ) );

		}

		body.append( rows );
		const btn = el( 'button', { class: 'primary', type: 'button' }, 'Check' );
		body.append( el( 'div', { class: 'actions' }, btn ) );
		btn.addEventListener( 'click', () => {

			let bad = 0;
			for ( const s of selects ) { const ok = s.value === s.dataset.want; s.classList.toggle( 'wrong', ! ok ); if ( ! ok ) bad ++; }
			if ( ! bad ) { S().s1.symbols = true; G.setScreen( 'symbols', true ); feedback( body, 'All six are right. The barrier controls are unlocked.', true ); btn.disabled = true; G.sfx( 'good' ); G.changed(); }
			else feedback( body, `${ bad } ${ bad === 1 ? 'is' : 'are' } not right yet (marked). Look at the mass number (top) and the charge (bottom).` + G.wrong(), false );

		} );

	} );

	for ( let i = 0; i < 3; i ++ ) H[ 'locker' + i ] = () => openPanel( 'Protection locker', body => {

		const src = Q.SOURCES_16_1[ i ];
		if ( S().s1.barriers[ i ] ) { solvedNote( body, 'This barrier is open.' ); return; }
		if ( ! S().s1.symbols ) { body.append( el( 'p', {}, 'The locker is locked. A note on it says: "Identify the radiation types at the ID chart first."' ) ); return; }
		if ( i > 0 && ! S().s1.barriers[ i - 1 ] ) { body.append( el( 'p', {}, 'Open the barrier before this one first.' ) ); return; }
		body.append( el( 'p', { html: `The barrier ahead holds a leaking <b>${ src.type }</b> source (${ src.isotope }). Take the lightest protection that is enough to stop its radiation.` } ) );
		const box = el( 'div', { class: 'choices col' } );
		for ( const pr of Q.PROTECTION ) {

			const b = el( 'button', { class: 'choice', type: 'button' }, pr.label );
			b.addEventListener( 'click', () => {

				if ( pr.rank < src.needs ) { b.classList.add( 'wrong' ); b.disabled = true; feedback( body, `Not enough. ${ src.why }` + G.wrong(), false ); return; }
				const extra = pr.rank > src.needs ? ` (That works too, but it is more than you need. ${ src.why })` : ` ${ src.why }`;
				box.querySelectorAll( 'button' ).forEach( x => x.disabled = true ); b.classList.add( 'right' );
				feedback( body, 'The barrier opens.' + extra, true );
				S().s1.barriers[ i ] = true; G.setScreen( 'locker' + i, true ); G.openDoor( 'barrier' + i ); G.sfx( 'good' );
				if ( i === 2 ) G.complete( 1 );
				G.changed();

			} );
			box.append( b );

		}

		body.append( box );

	} );

	// ===== station 2: records vault, 16.2

	for ( const k of [ 'vaultA', 'vaultB', 'vaultC', 'vaultExit' ] ) H[ k + 'Lock' ] = () => openPanel( 'Equation lock (16.2)', body => {

		const pk = P().s2[ k ], eq = Q.EQUATIONS_16_2[ pk.kind ][ pk.i ];
		const label = { alpha: 'alpha decay', beta: 'beta decay', positron: 'positron emission', gamma: 'gamma emission', bombardment: 'a bombardment reaction' }[ pk.kind ];
		if ( S().s2[ k ] ) { solvedNote( body, 'This lock is open.' ); body.append( equationEl( eq, el( 'span', { html: termHTML( eq.rhs[ eq.missing ] ) } ) ) ); return; }
		if ( k === 'vaultExit' && ! [ 'vaultA', 'vaultB', 'vaultC' ].every( v => S().s2[ v ] ) ) { body.append( el( 'p', {}, 'The exit lock stays dark until the three side vaults are open.' ) ); return; }
		equationTask( body, G, eq, () => {

			S().s2[ k ] = true; G.setScreen( k + 'Lock', true ); G.openDoor( k );
			if ( k !== 'vaultExit' ) G.enableNote( k + 'Read', RECORDS[ k ] );
			if ( k === 'vaultExit' ) G.complete( 2 );
			G.changed();

		}, { intro: `This lock shows ${ label }. Complete the equation. Mass numbers and atomic numbers must add up to the same totals on both sides.` } );

	}, { wide: true } );

	// ===== station 3: monitoring station, 16.3

	H.equipment = () => {

		if ( S().s3.equip ) return;
		S().s3.equip = true; G.takeEquipment(); G.sfx( 'pickup' );
		G.toast( 'You take the Geiger counter and the dosimeter. Calibrate them at the calibration terminal.' );
		G.changed();

	};

	H.calib = () => openPanel( 'Calibration (16.3)', body => {

		if ( ! S().s3.equip ) { body.append( el( 'p', {}, 'Bring the Geiger counter and the dosimeter from the bench first.' ) ); return; }
		if ( S().s3.units && S().s3.conv ) { solvedNote( body, 'Both instruments are calibrated. The dosimeter is live.' ); return; }

		if ( ! S().s3.units ) {

			body.append( el( 'p', {}, 'Step 1. Set each unit to what it measures.' ) );
			const rows = el( 'div', { class: 'match' } );
			const selects = [];
			for ( const ui of P().s3.units ) {

				const u = Q.UNITS[ ui ];
				const sel = el( 'select', { 'aria-label': 'what ' + u.unit + ' measures' }, el( 'option', { value: '' }, 'choose…' ), ...Object.entries( Q.UNIT_CATS ).map( ( [ v, t ] ) => el( 'option', { value: v }, t ) ) );
				sel.dataset.want = u.cat; selects.push( sel );
				rows.append( el( 'div', { class: 'mrow' }, el( 'span', { class: 'unit' }, u.unit ), sel ) );

			}

			body.append( rows );
			const btn = el( 'button', { class: 'primary', type: 'button' }, 'Check' );
			body.append( el( 'div', { class: 'actions' }, btn ) );
			btn.addEventListener( 'click', () => {

				let bad = 0;
				for ( const s of selects ) { const ok = s.value === s.dataset.want; s.classList.toggle( 'wrong', ! ok ); if ( ! ok ) bad ++; }
				if ( ! bad ) { S().s3.units = true; G.sfx( 'good' ); G.changed(); H.calib(); }
				else feedback( body, `${ bad } ${ bad === 1 ? 'is' : 'are' } not right yet (marked). Each kind of measurement has a common unit and an SI unit.` + G.wrong(), false );

			} );
			return;

		}

		const c = Q.CONVERSIONS[ P().s3.conv ], x = P().s3.convX, want = c.ans( x );
		body.append( el( 'p', {}, 'Step 2. Check the scale on the dosimeter.' ), el( 'p', { class: 'q' }, c.q( x ) ) );
		const inp = el( 'input', { class: 'num wide', inputmode: 'decimal', 'aria-label': 'answer in ' + c.unit } );
		body.append( el( 'div', { class: 'numrow' }, inp, el( 'span', { class: 'unitlbl' }, c.unit ) ) );
		const btn = el( 'button', { class: 'primary', type: 'button' }, 'Check' );
		body.append( el( 'div', { class: 'actions' }, btn ) );
		const go = () => {

			const v = parseFloat( inp.value.replace( ',', '.' ) );
			if ( Math.abs( v - want ) < 1e-6 ) {

				S().s3.conv = true; G.setScreen( 'calib', true ); G.dosimeterOn(); G.openDoor( 'monExit' ); G.complete( 3 ); G.sfx( 'good' );
				feedback( body, `Right: ${ want } ${ c.unit }. The dosimeter is live. From now on it records your dose.`, true ); btn.disabled = true; inp.disabled = true;
				G.changed();

			} else feedback( body, 'Not quite. Use 1 Gy = 100 rad and 1 Sv = 100 rem.' + G.wrong(), false );

		};

		btn.addEventListener( 'click', go );
		inp.addEventListener( 'keydown', e => { if ( e.key === 'Enter' ) go(); } );

	} );

	// ===== station 4: hot corridor, 16.4

	const hl = () => Q.HALF_LIFE[ P().s4.iso ];
	const A0 = () => P().s4.safe * 2 ** P().s4.n;
	const activity = () => A0() * 0.5 ** ( S().s4.elapsed / hl().t );
	const fmtA = a => Math.abs( a - Math.round( a ) ) < 1e-6 ? String( Math.round( a ) ) : a >= 10 ? a.toFixed( 0 ) : a >= 1 ? a.toFixed( 1 ) : a.toFixed( 2 );
	G.hotActivityRatio = () => activity() / P().s4.safe;

	H.log = () => openPanel( 'Source log (16.4)', body => {

		const h = hl();
		body.append(
			el( 'p', {}, 'The last entry in the log for the corridor source:' ),
			el( 'table', { class: 'log' },
				el( 'tr', {}, el( 'th', {}, 'Isotope' ), el( 'td', {}, `${ h.name } (${ h.sym })` ) ),
				el( 'tr', {}, el( 'th', {}, 'Half-life' ), el( 'td', {}, `${ h.t.toFixed( h.t % 1 ? 1 : 0 ) } ${ h.unit }` ) ),
				el( 'tr', {}, el( 'th', {}, 'Activity now' ), el( 'td', {}, `${ fmtA( A0() ) } mCi` ) )
			),
			el( 'p', { html: `The sign on the interlock reads: <b>SAFE TO CROSS AT ${ P().s4.safe } mCi OR LESS.</b>` } ),
			el( 'p', { class: 'hint' }, 'Work out how many half-lives must pass, and how long that takes. Then set the corridor clock.' )
		);

	} );

	H.clock = () => openPanel( 'Corridor clock (16.4)', body => {

		const h = hl();
		body.append( el( 'p', { html: `Source: ${ h.name }. Activity now: <b>${ fmtA( activity() ) } mCi</b>. Safe to cross at <b>${ P().s4.safe } mCi</b> or less.` } ) );
		if ( S().s4.elapsed > 0 ) body.append( el( 'p', {}, `The clock has been advanced ${ +S().s4.elapsed.toFixed( 2 ) } ${ h.unit } so far. It only runs forward.` ) );
		if ( activity() <= P().s4.safe + 1e-6 ) { solvedNote( body, 'The activity is at the safe level. The interlock is open.' ); return; }
		body.append( el( 'p', {}, 'Advance the clock by:' ) );
		const inp = el( 'input', { class: 'num wide', inputmode: 'decimal', 'aria-label': 'time in ' + h.unit } );
		body.append( el( 'div', { class: 'numrow' }, inp, el( 'span', { class: 'unitlbl' }, h.unit ) ) );
		const btn = el( 'button', { class: 'primary', type: 'button' }, 'Advance the clock' );
		body.append( el( 'div', { class: 'actions' }, btn ) );
		const go = () => {

			const v = parseFloat( inp.value.replace( ',', '.' ) );
			if ( ! ( v > 0 ) ) { feedback( body, 'Enter a time greater than zero.', false ); return; }
			if ( v > h.t * 12 ) { feedback( body, 'That is far longer than you need. Count the half-lives again.', false ); return; }
			const wasSet = S().s4.set;
			S().s4.elapsed += v; S().s4.set = true;
			const a = activity(), nDone = S().s4.elapsed / h.t;
			btn.disabled = true; inp.disabled = true;
			G.clockAdvanced( () => {

				G.setHot( a / P().s4.safe );
				if ( ! wasSet ) G.openDoor( 'interlock' );
				G.changed();

			} );
			if ( a <= P().s4.safe + 1e-6 ) {

				G.setScreen( 'clock', true );
				feedback( body, `${ +nDone.toFixed( 2 ) } half-lives have passed. Activity: ${ fmtA( a ) } mCi. That is safe. The interlock opens.`, true );
				G.sfx( 'good' );

			} else {

				feedback( body, `${ +nDone.toFixed( 2 ) } half-lives have passed. Activity: ${ fmtA( a ) } mCi. That is still above ${ P().s4.safe } mCi. The interlock opens anyway, but crossing now will cost a large dose. You can advance the clock further.`, false );

			}

		};

		btn.addEventListener( 'click', go );
		inp.addEventListener( 'keydown', e => { if ( e.key === 'Enter' ) go(); } );

	} );

	// ===== station 5: infirmary, 16.5

	for ( let i = 0; i < 3; i ++ ) H[ 'chart' + i ] = () => openPanel( `Patient chart ${ 'ABC'[ i ] } (16.5)`, body => {

		const ch = Q.CHARTS[ i ];
		body.append( el( 'p', { class: 'q' }, ch.patient ) );
		if ( S().s5.charts[ i ] ) { solvedNote( body, `Done: ${ Q.SHELF.find( s => s.id === ch.answer ).name }. ${ ch.why }` ); return; }
		body.append( el( 'p', {}, 'Choose the radioisotope from the radiopharmacy shelf:' ) );
		const tbl = el( 'div', { class: 'choices col shelf' } );
		for ( const s of Q.SHELF ) {

			const b = el( 'button', { class: 'choice', type: 'button', html: `<b>${ s.name }</b><span class="meta">half-life ${ s.t } · ${ s.rad.toLowerCase() }</span>` } );
			b.addEventListener( 'click', () => {

				if ( s.id === ch.answer ) {

					tbl.querySelectorAll( 'button' ).forEach( x => x.disabled = true ); b.classList.add( 'right' );
					feedback( body, ch.why, true );
					S().s5.charts[ i ] = true; G.setScreen( 'chart' + i, true ); G.sfx( 'good' ); G.changed();

				} else { b.classList.add( 'wrong' ); b.disabled = true; feedback( body, 'That is not the right isotope for this patient.' + G.wrong(), false ); }

			} );
			tbl.append( b );

		}

		body.append( tbl );

	}, { wide: true } );

	H.cabinet = () => openPanel( 'Key cabinet (16.5)', body => {

		if ( S().s5.why ) { solvedNote( body, 'The cabinet is open. You have the control room key.' ); return; }
		if ( ! S().s5.charts.every( Boolean ) ) { body.append( el( 'p', {}, 'The cabinet opens once all three patient charts are complete.' ) ); return; }
		choiceTask( body, G, Q.SHORT_HALF_LIFE, P().s6.whyOrder, () => {

			S().s5.why = true; G.setScreen( 'cabinet', true ); G.openDoor( 'infExit' ); G.complete( 5 );
			feedback( body, 'Correct. The cabinet opens and you take the control room key.', true );
			G.changed();

		} );

	} );

	// ===== station 6: control room, 16.6

	H.sort = () => openPanel( 'Reactor log (16.6)', body => {

		if ( S().s6.sort ) { solvedNote( body, 'The log is sorted.' ); return; }
		body.append( el( 'p', {}, 'Sort each entry in the reactor log: does it describe fission or fusion?' ) );
		const rows = el( 'div', { class: 'sort' } );
		const picks = {};
		for ( const si of P().s6.sort ) {

			const st = Q.SORT_STATEMENTS[ si ];
			const r = el( 'div', { class: 'srow' } );
			const bF = el( 'button', { class: 'choice sm', type: 'button' }, 'Fission' ), bU = el( 'button', { class: 'choice sm', type: 'button' }, 'Fusion' );
			const set = v => { picks[ si ] = v; bF.classList.toggle( 'on', v === 'fission' ); bU.classList.toggle( 'on', v === 'fusion' ); r.classList.remove( 'wrong' ); };
			bF.addEventListener( 'click', () => set( 'fission' ) ); bU.addEventListener( 'click', () => set( 'fusion' ) );
			r.append( el( 'span', { class: 'st' }, st.t ), el( 'span', { class: 'btns' }, bF, bU ) );
			r.dataset.si = si; rows.append( r );

		}

		body.append( rows );
		const btn = el( 'button', { class: 'primary', type: 'button' }, 'Check' );
		body.append( el( 'div', { class: 'actions' }, btn ) );
		btn.addEventListener( 'click', () => {

			let bad = 0;
			rows.querySelectorAll( '.srow' ).forEach( r => { const si = + r.dataset.si; const ok = picks[ si ] === Q.SORT_STATEMENTS[ si ].a; r.classList.toggle( 'wrong', ! ok ); if ( ! ok ) bad ++; } );
			if ( ! bad ) { S().s6.sort = true; G.setScreen( 'sort', true ); btn.disabled = true; feedback( body, 'All sorted. Fission splits a large nucleus; fusion joins small ones.', true ); G.sfx( 'good' ); G.changed(); }
			else feedback( body, `${ bad } ${ bad === 1 ? 'entry is' : 'entries are' } not right yet (marked).` + G.wrong(), false );

		} );

	}, { wide: true } );

	H.fission = () => openPanel( 'Fission monitor (16.6)', body => {

		const eq = { ...Q.FISSION, missing: P().s6.fissionMissing };
		if ( S().s6.fission ) { solvedNote( body, 'The fission equation is complete.' ); body.append( equationEl( eq, el( 'span', { html: termHTML( eq.rhs[ eq.missing ] ) } ) ) ); return; }
		if ( ! S().s6.sort ) { body.append( el( 'p', {}, 'The monitor shows the reactor log first. Sort the log entries.' ) ); return; }
		equationTask( body, G, eq, () => { S().s6.fission = true; G.setScreen( 'fission', true ); G.changed(); }, {
			intro: 'A neutron hits a uranium-235 nucleus and it splits. Complete the equation.'
		} );

	}, { wide: true } );

	H.rods = () => openPanel( 'Control rods (16.6)', body => {

		if ( S().s6.rods ) { solvedNote( body, 'The control rods are down. The chain reaction has stopped.' ); return; }
		if ( ! S().s6.fission ) { body.append( el( 'p', {}, 'The rod controls are locked until the fission monitor is read.' ) ); return; }
		choiceTask( body, G, Q.CONTROL_RODS, P().s6.rodOrder, () => {

			S().s6.rods = true; G.setScreen( 'rods', true ); G.rodsDown();
			feedback( body, 'Correct. You lower the rods. The counter slows as the chain reaction stops.', true );
			G.changed();

		} );

	} );

	H.finale = () => openPanel( 'Decay console', body => {

		if ( ! S().s6.rods ) { body.append( el( 'p', {}, 'The console is dark. Stop the chain reaction first.' ) ); return; }
		const step = S().s6.finale;
		if ( step >= Q.FINALE.length ) { solvedNote( body, 'Lead-206. Stable.' ); return; }
		body.append( el( 'p', { class: 'hint' }, `The Daughter is still decaying. Take it down to a stable isotope. Step ${ step + 1 } of ${ Q.FINALE.length }.` ) );
		const eq = Q.FINALE[ step ];
		const kind = eq.rhs[ 1 ].p === 'alpha' ? 'alpha decay' : 'beta decay';
		equationTask( body, G, eq, () => {

			S().s6.finale = step + 1; G.changed();
			if ( S().s6.finale >= Q.FINALE.length ) { G.complete( 6 ); setTimeout( () => { closePanel(); G.ending(); }, 1400 ); }
			else setTimeout( () => H.finale(), 1100 );

		}, { intro: `${ eq.lhs[ 0 ].name[ 0 ].toUpperCase() + eq.lhs[ 0 ].name.slice( 1 ) } undergoes ${ kind }.` } );

	}, { wide: true } );

	return H;

}

export { ELEMENT_NAMES };

// what the player finds behind each side vault door (set dressing; draft text)
export const RECORDS = {
	vaultA: 'Shift log, last page: "Parent moved to core room for storage. Readings normal." The next forty lines are blank.',
	vaultB: 'A stack of film-badge reports. Every badge from the final week reads off the scale.',
	vaultC: 'Inventory card: "Parent: 1 sealed source." Someone has crossed out "Parent" and written, in pencil, "and its daughter."'
};
