// Automated playthrough for device testing. Dev server only: it drives the game through window.__game, which the
// published build does not have. It plays the real terminals (opens each one, fills in the right answer, presses
// Check), walks the player from room to room, waits for the glimpses, the ending and the code, and reports.
//
// In any browser's console on the dev server (http://localhost:5179/?fresh&tier=high, after pressing Start):
//   const t = await import( '/test/playthrough.js' ); console.table( ( await t.run() ).steps ); await t.tour();
//
// run( { stopAfter } ) stops after that station, so a test can reload and press Continue; a later run() picks up
// where the saved game is (every step skips what is already solved).

const sleep = ms => new Promise( r => setTimeout( r, ms ) );
const $ = id => document.getElementById( id );

export async function run( { stopAfter = 6, wrongOnce = true, evacuate = true, log = console.log } = {} ) {

	const g = window.__game;
	if ( ! g ) throw new Error( 'window.__game is missing: run this on the dev server, after the game has loaded' );
	const Q = await import( '/src/questions.js' );
	const { CONFIG } = await import( '/src/config.js' );
	const report = { ok: true, steps: [], errors: [] };
	const onErr = e => report.errors.push( String( e.message || e.reason || e ) );
	addEventListener( 'error', onErr ); addEventListener( 'unhandledrejection', onErr );
	const t0 = performance.now();
	const note = ( msg, extra = {} ) => { const s = { t: + ( ( performance.now() - t0 ) / 1000 ).toFixed( 1 ), msg, ...extra }; report.steps.push( s ); log( '[playthrough]', JSON.stringify( s ) ); };
	const fail = msg => { report.ok = false; note( 'FAIL: ' + msg ); throw Object.assign( new Error( msg ), { report } ); };
	const until = async ( fn, ms, what ) => { const t = performance.now(); while ( ! fn() ) { if ( performance.now() - t > ms ) fail( 'timed out waiting for ' + what ); await sleep( 50 ); } };

	const G = g.G, S = () => G.state, P = () => G.picks;
	const body = () => $( 'panelBody' );
	const panelUp = () => ! $( 'panel' ).hidden;
	const unpause = () => { if ( ! $( 'pause' ).hidden ) $( 'pause' ).hidden = true; };
	const click = ( b, what ) => { if ( ! b ) fail( 'no button: ' + what ); b.click(); };
	const check = () => click( body().querySelector( '.actions button.primary' ), 'Check' );
	const close = async () => { if ( panelUp() ) $( 'panelClose' ).click(); await sleep( 150 ); };
	const buttons = () => [ ...body().querySelectorAll( 'button' ) ];
	const clickText = t => click( buttons().find( b => b.textContent.trim() === t ), t );
	const okText = q => q.options.find( o => o.ok ).t;
	const place = ( x, z, yaw = 0, pitch = - 0.1 ) => { unpause(); g.player.pos.set( x, 1.65, z ); g.player.yaw = yaw; g.player.pitch = pitch; };

	// stand in front of a terminal, facing it, give the room check a moment, then press E on it
	async function use( id ) {

		unpause();
		const it = g.L.interact.find( i => i.id === id );
		if ( ! it ) fail( 'no terminal ' + id );
		const n = it.normal ? it.normal.clone().setY( 0 ) : null;
		if ( n && n.lengthSq() > 0.25 ) { n.normalize(); place( it.pos.x + n.x * 1.1, it.pos.z + n.z * 1.1, Math.atan2( n.x, n.z ), - 0.15 ); } else place( it.pos.x, it.pos.z + 1, 0, - 0.4 );
		await sleep( 400 );
		g.use( id );
		if ( it.kind !== 'pickup' ) await until( panelUp, 6000, 'the ' + id + ' panel' );

	}

	async function selects() { for ( const s of body().querySelectorAll( 'select' ) ) s.value = s.dataset.want; check(); await sleep( 250 ); }

	async function equation( eq ) {

		const want = eq.rhs[ eq.missing ];
		if ( want.p ) click( [ ...body().querySelectorAll( '.choices.particles button' ) ].find( b => b.getAttribute( 'aria-label' ) === Q.PARTICLES[ want.p ].name ), want.p );
		else { const s = body().querySelector( '.nucslot' ); s.querySelector( '.num.a' ).value = want.A; s.querySelector( '.num.z' ).value = want.Z; s.querySelector( '.sym' ).value = want.sym; }
		check(); await sleep( 250 );
		if ( ! body().querySelector( '.feedback.good' ) ) fail( 'equation not accepted: ' + JSON.stringify( want ) );

	}

	const state = () => ( { cp: G.cp, points: g.points(), dose: + G.dose.toFixed( 2 ) } );

	// ===== station 1
	if ( ! S().s1.symbols ) { await use( 'symbols' ); await selects(); if ( ! S().s1.symbols ) fail( 'symbols not accepted' ); await close(); }
	for ( let i = 0; i < 3; i ++ ) {

		if ( S().s1.barriers[ i ] ) continue;
		await use( 'locker' + i );
		clickText( Q.PROTECTION.find( p => p.rank === Q.SOURCES_16_1[ i ].needs ).label ); await sleep( 250 );
		if ( ! S().s1.barriers[ i ] ) fail( 'locker ' + i + ' did not open' );
		await close(); await sleep( 1300 ); // the barrier slides up

	}
	if ( ! S().completed[ 0 ] ) fail( 'station 1 not complete' );
	// glimpse 1: the chair rocks at the end of the hall and stops when the flashlight reaches it
	if ( ! S().glimpse1 ) { place( 0, - 19, 0, - 0.12 ); await until( () => S().glimpse1, 12000, 'glimpse 1' ); }
	note( 'station 1 done, glimpse 1 seen', state() );
	if ( stopAfter <= 1 ) return finish();

	// ===== station 2
	for ( const k of [ 'vaultA', 'vaultB', 'vaultC', 'vaultExit' ] ) {

		if ( S().s2[ k ] ) continue;
		await use( k + 'Lock' );
		const pk = P().s2[ k ]; await equation( Q.EQUATIONS_16_2[ pk.kind ][ pk.i ] );
		if ( ! S().s2[ k ] ) fail( k + ' did not open' );
		await close(); await sleep( 300 );

	}
	await use( 'vaultARead' ); if ( ! body().textContent.trim() ) fail( 'the vault A record is empty' ); await close();
	if ( ! S().completed[ 1 ] || G.cp < 2 ) fail( 'station 2 not complete or no checkpoint' );
	note( 'station 2 done', state() );
	if ( stopAfter <= 2 ) return finish();

	// ===== station 3
	if ( ! S().s3.equip ) { await use( 'equipment' ); await sleep( 300 ); if ( ! S().s3.equip ) fail( 'equipment not taken' ); }
	if ( ! S().s3.conv ) {

		await use( 'calib' );
		if ( ! S().s3.units ) { await selects(); if ( ! S().s3.units ) fail( 'units not accepted' ); await sleep( 200 ); }
		const c = Q.CONVERSIONS[ P().s3.conv ];
		body().querySelector( '.numrow input' ).value = String( c.ans( P().s3.convX ) ); check(); await sleep( 250 );
		if ( ! S().s3.conv || ! G.dosimeter ) fail( 'conversion not accepted' );
		await close();

	}
	note( 'station 3 done, dosimeter live', state() );
	if ( stopAfter <= 3 ) return finish();

	// ===== station 4
	await use( 'log' ); if ( ! body().querySelector( 'table.log' ) ) fail( 'no source log' ); await close();
	if ( evacuate && G.cp === 4 ) {

		// the dose limit: a slow white-out, then back to the checkpoint with the checkpoint's dose
		place( 0, - 57 );
		G.dose = CONFIG.doseLimit - 0.0005;
		await until( () => $( 'evac' ).style.display === 'flex', 15000, 'the evacuation screen' );
		await until( () => $( 'evac' ).style.display === 'none', 15000, 'the evacuation to end' );
		await sleep( 1600 );
		const sp = g.L.spawns[ G.cp ].pos;
		if ( g.player.pos.distanceTo( sp ) > 0.5 ) fail( 'not sent back to the checkpoint' );
		if ( G.dose >= CONFIG.doseLimit * CONFIG.checkpointDoseCap + 1e-6 ) fail( 'dose not reset after evacuation: ' + G.dose );
		note( 'evacuation worked', state() );

	}
	if ( ! S().s4.set || G.hotActivityRatio() > 1 + 1e-6 ) {

		await use( 'clock' );
		const h = Q.HALF_LIFE[ P().s4.iso ];
		body().querySelector( '.numrow input' ).value = String( P().s4.n * h.t ); check();
		await sleep( 2600 ); // the time-skip fade
		await close();
		if ( G.hotActivityRatio() > 1 + 1e-6 ) fail( 'the corridor is not at the safe level' );

	}
	// glimpse 2: the chair in the middle of the corridor, seen for half a second
	if ( ! S().glimpse2 ) { place( 0, - 59, 0, - 0.12 ); await until( () => S().glimpse2, 8000, 'glimpse 2' ); }
	// cross the corridor
	for ( let z = - 59; z > - 79; z -= 1.5 ) { place( 0.2, z ); await sleep( 120 ); }
	await sleep( 500 );
	if ( G.cp < 5 || ! S().completed[ 3 ] ) fail( 'station 4 not complete after crossing' );
	note( 'station 4 done, glimpse 2 seen', state() );
	if ( stopAfter <= 4 ) return finish();

	// ===== station 5 (one wrong answer here: the dosimeter is live, so it costs dose, not points)
	for ( let i = 0; i < 3; i ++ ) {

		if ( S().s5.charts[ i ] ) continue;
		await use( 'chart' + i );
		const want = Q.SHELF.find( s => s.id === Q.CHARTS[ i ].answer ).name;
		const pick = name => click( buttons().find( b => b.querySelector( 'b' )?.textContent === name ), name );
		if ( wrongOnce && i === 0 ) {

			const d0 = G.dose, pts = g.points();
			pick( Q.SHELF.find( s => s.id !== Q.CHARTS[ i ].answer ).name ); await sleep( 200 );
			if ( G.dose < d0 + CONFIG.wrongAnswerDose - 1e-6 || g.points() !== pts ) fail( 'a wrong answer did not cost dose (or cost points)' );
			note( 'wrong answer cost ' + CONFIG.wrongAnswerDose + ' mSv, no points', state() );

		}
		pick( want ); await sleep( 250 );
		if ( ! S().s5.charts[ i ] ) fail( 'chart ' + i + ' not accepted' );
		await close();

	}
	if ( ! S().s5.why ) { await use( 'cabinet' ); clickText( okText( Q.SHORT_HALF_LIFE ) ); await sleep( 250 ); if ( ! S().s5.why ) fail( 'cabinet not opened' ); await close(); await sleep( 1300 ); }
	note( 'station 5 done', state() );
	if ( stopAfter <= 5 ) return finish();

	// ===== station 6
	if ( ! S().s6.sort ) {

		await use( 'sort' );
		for ( const r of body().querySelectorAll( '.srow' ) ) click( [ ...r.querySelectorAll( 'button' ) ].find( b => b.textContent.toLowerCase() === Q.SORT_STATEMENTS[ + r.dataset.si ].a ), 'sort' );
		check(); await sleep( 250 ); if ( ! S().s6.sort ) fail( 'sort not accepted' ); await close();

	}
	if ( ! S().s6.fission ) { await use( 'fission' ); await equation( { ...Q.FISSION, missing: P().s6.fissionMissing } ); await close(); }
	if ( ! S().s6.rods ) { await use( 'rods' ); clickText( okText( Q.CONTROL_RODS ) ); await sleep( 250 ); if ( ! S().s6.rods ) fail( 'rods not lowered' ); await close(); }
	note( 'rods down', state() );
	// glimpse 3: the shape steps aside before the decay console opens
	const g3before = g.glimpses?.g3;
	await use( 'finale' );
	if ( g.glimpses && ! S().glimpse3 ) fail( 'the shape did not step aside (g3 was ' + g3before + ')' );
	for ( let step = S().s6.finale; step < Q.FINALE.length; step ++ ) {

		await until( () => panelUp() && body().textContent.includes( `Step ${ step + 1 } of` ), 6000, 'finale step ' + ( step + 1 ) );
		await equation( Q.FINALE[ step ] );

	}
	note( 'finale solved, waiting for the ending', state() );
	await until( () => ! $( 'debrief' ).hidden, 60000, 'the debrief' );
	note( 'debrief shown', { dose: $( 'dbDose' ).textContent } );
	$( 'btnToCode' ).click(); await sleep( 200 );
	$( 'd2lInput' ).value = 'testrunner'; $( 'd2lGo' ).click(); await sleep( 200 );
	const code = $( 'codeVal' ).textContent;
	if ( ! code || $( 'codeOut' ).hidden ) fail( 'no completion code' );
	if ( g.points() !== 6 ) fail( 'expected 6 points, got ' + g.points() );
	note( 'completion code shown', { code, score: $( 'codeScore' ).textContent } );
	return finish();

	function finish() {

		removeEventListener( 'error', onErr ); removeEventListener( 'unhandledrejection', onErr );
		report.final = state();
		return report;

	}

}

// frame rate in each room on each tier (a fixed view per room, flashlight on)
export async function tour( { tiers = [ 'ultra', 'high', 'medium', 'low' ], secs = 2.5 } = {} ) {

	const g = window.__game;
	const views = { 1: [ 0, - 6, 0 ], 2: [ 0, - 30.5, 0 ], 3: [ 0, - 44, 0.5 ], 4: [ 0, - 58, 0 ], 5: [ 0, - 78.5, - 0.6 ], 6: [ 0, - 93, 0 ] };
	const out = {};
	for ( const tier of tiers ) {

		await g.setTier( tier );
		const row = {};
		for ( const [ n, [ x, z, yaw ] ] of Object.entries( views ) ) {

			if ( ! $( 'pause' ).hidden ) $( 'pause' ).hidden = true;
			g.player.pos.set( x, 1.65, z ); g.player.yaw = yaw; g.player.pitch = - 0.1;
			await sleep( 1200 );
			const f0 = g.frames, t = performance.now();
			await sleep( secs * 1000 );
			row[ 'room ' + n ] = Math.round( ( g.frames - f0 ) / ( ( performance.now() - t ) / 1000 ) );

		}
		out[ tier ] = row;

	}
	return out;

}
