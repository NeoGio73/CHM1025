// Kessler's radio recordings (handoff 6.4): old tapes, never a live conversation.
// Each line of src/radio.js can have a voiced clip in public/audio/radio/: <key>.mp3 for its first line,
// <key>-2.mp3 for its second, and so on. A line without a clip is a caption only, as before, so the game
// works with any or none of the clips present. Captions follow the clip's length when there is one.
//
// The clips play through an "old recording" chain: a narrow radio band, mild saturation, slight wow and
// flutter, tape hiss, and a soft click when the tape starts and stops. Not positional: it is the player's radio.

export function createRadio( { audio, base, caption, speaker, captionsOn } ) {

	const raw = new Map();     // file -> Promise<ArrayBuffer | null>
	const decoded = new Map(); // file -> AudioBuffer | null
	const queue = [];
	let busy = false, playing = [];

	function fetchClip( file ) {

		if ( ! raw.has( file ) ) raw.set( file, fetch( base + file ).then( r => ( r.ok && ! ( r.headers.get( 'content-type' ) || '' ).includes( 'text/html' ) ) ? r.arrayBuffer() : null ).catch( () => null ) );
		return raw.get( file );

	}

	async function clip( file ) {

		if ( decoded.has( file ) ) return decoded.get( file );
		const data = await fetchClip( file );
		let buf = null;
		if ( data && audio.ctx ) try { buf = await audio.ctx.decodeAudioData( data.slice( 0 ) ); } catch ( e ) { buf = null; }
		if ( audio.ctx ) decoded.set( file, buf );
		return buf;

	}

	const fileFor = ( key, i ) => key + ( i ? '-' + ( i + 1 ) : '' ) + '.mp3';

	// start downloading every clip (after the player's first click, so it never delays the title screen)
	function preload( script ) { for ( const [ key, lines ] of Object.entries( script ) ) lines.forEach( ( l, i ) => fetchClip( fileFor( key, i ) ) ); }

	function play( buf ) {

		const ctx = audio.ctx, t = ctx.currentTime + 0.18, end = t + buf.duration;
		const nodes = [];
		const keep = n => { nodes.push( n ); return n; };

		const src = keep( ctx.createBufferSource() ); src.buffer = buf;
		// wow and flutter: the tape speed wanders a little
		const wow = keep( ctx.createOscillator() ); wow.frequency.value = 0.55;
		const wowG = keep( ctx.createGain() ); wowG.gain.value = 0.003;
		const flut = keep( ctx.createOscillator() ); flut.frequency.value = 6.8;
		const flutG = keep( ctx.createGain() ); flutG.gain.value = 0.0012;
		wow.connect( wowG ).connect( src.playbackRate ); flut.connect( flutG ).connect( src.playbackRate );

		const hp = keep( ctx.createBiquadFilter() ); hp.type = 'highpass'; hp.frequency.value = 300; hp.Q.value = 0.7;
		const lp = keep( ctx.createBiquadFilter() ); lp.type = 'lowpass'; lp.frequency.value = 3300; lp.Q.value = 0.7;
		const pk = keep( ctx.createBiquadFilter() ); pk.type = 'peaking'; pk.frequency.value = 1700; pk.gain.value = 4; pk.Q.value = 1;
		const sat = keep( ctx.createWaveShaper() );
		const curve = new Float32Array( 1024 );
		for ( let i = 0; i < 1024; i ++ ) { const x = i / 511.5 - 1; curve[ i ] = Math.tanh( 1.8 * x ) / Math.tanh( 1.8 ); }
		sat.curve = curve;
		const vg = keep( ctx.createGain() ); vg.gain.value = 0.85;
		src.connect( hp ).connect( lp ).connect( pk ).connect( sat ).connect( vg ).connect( audio.master );

		// hiss under the whole tape, and a click at each end
		const hiss = keep( ctx.createBufferSource() ); hiss.buffer = audio._noiseBuffer( 2 ); hiss.loop = true;
		const hb = keep( ctx.createBiquadFilter() ); hb.type = 'bandpass'; hb.frequency.value = 4500; hb.Q.value = 0.6;
		const hg = keep( ctx.createGain() ); hg.gain.setValueAtTime( 0, t - 0.15 );
		hg.gain.linearRampToValueAtTime( 0.014, t - 0.05 ); hg.gain.setValueAtTime( 0.014, end + 0.25 ); hg.gain.linearRampToValueAtTime( 0, end + 0.4 );
		hiss.connect( hb ).connect( hg ).connect( audio.master );
		for ( const at of [ t - 0.16, end + 0.38 ] ) {

			const c = keep( ctx.createBufferSource() ); c.buffer = audio._noiseBuffer( 0.03 );
			const cf = keep( ctx.createBiquadFilter() ); cf.type = 'highpass'; cf.frequency.value = 900;
			const cg = keep( ctx.createGain() ); cg.gain.setValueAtTime( 0.07, at ); cg.gain.exponentialRampToValueAtTime( 0.0005, at + 0.03 );
			c.connect( cf ).connect( cg ).connect( audio.master ); c.start( at ); c.stop( at + 0.04 );

		}

		src.start( t ); wow.start( t ); flut.start( t ); hiss.start( t - 0.15 );
		const stopAt = end + 0.45;
		src.stop( stopAt ); wow.stop( stopAt ); flut.stop( stopAt ); hiss.stop( stopAt );
		const entry = { nodes, stop() { for ( const n of nodes ) { try { n.stop?.(); } catch ( e ) { /* not started or already stopped */ } try { n.disconnect(); } catch ( e ) { /* already disconnected */ } } } };
		playing.push( entry );
		src.onended = () => { playing = playing.filter( p => p !== entry ); setTimeout( () => entry.stop(), 600 ); };
		return buf.duration + 0.6; // seconds, clicks included

	}

	async function next() {

		const item = queue.shift();
		if ( ! item ) { busy = false; return; }
		busy = true;
		const buf = audio.ctx ? await clip( item.file ) : null;
		const secs = buf ? play( buf ) : 0;
		const ms = secs ? secs * 1000 + 400 : Math.max( 3500, item.text.length * 65 );
		caption( speaker(), item.text, captionsOn(), ms );
		setTimeout( next, ms + 250 );

	}

	// queue the lines for one radio key (lines already filled in)
	function say( key, lines ) {

		lines.forEach( ( text, i ) => queue.push( { file: fileFor( key, i ), text } ) );
		if ( ! busy ) next();

	}

	function stop() { queue.length = 0; for ( const p of playing ) p.stop(); playing = []; }

	// resolves when every queued line has finished (or after maxMs, so nothing can hang on it)
	function whenDone( maxMs = 16000 ) {

		const t0 = performance.now();
		return new Promise( res => { const check = () => ( ! busy || performance.now() - t0 > maxMs ) ? res() : setTimeout( check, 100 ); check(); } );

	}

	return { say, preload, stop, whenDone, fileFor };

}
