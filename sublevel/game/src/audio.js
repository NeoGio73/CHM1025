// Sound made in code (no files): the fluorescent hum, the buzz of a failing tube, the phone ring, the goose's honk
// and the exit door shutting.
// The hum follows how many lights are on around the player, so the dark is heard before it is seen (handoff section 6).
// Every sound also has an on-screen cue (the prompt and toasts). The art pass replaces these with recorded sounds.

export function createAudio() {

	let ctx = null, master, hum, buzz, crackle, ringGain, ringTimer = 0;

	function start() {

		if ( ctx ) { ctx.resume?.(); return; }
		try { ctx = new ( window.AudioContext || window.webkitAudioContext )(); } catch ( e ) { return; }
		master = ctx.createGain(); master.gain.value = 0.6; master.connect( ctx.destination );
		// hum: 120 Hz mains buzz with a little 240 Hz, low-passed
		hum = ctx.createGain(); hum.gain.value = 0;
		const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
		for ( const [ f, g ] of [ [ 120, 0.05 ], [ 240, 0.018 ], [ 360, 0.006 ] ] ) {

			const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
			const og = ctx.createGain(); og.gain.value = g;
			o.connect( og ).connect( lp ); o.start();

		}

		lp.connect( hum ).connect( master );
		// a failing tube up close: a harsher, brighter buzz, and a crackle while it stutters
		buzz = ctx.createGain(); buzz.gain.value = 0;
		const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 0.8;
		for ( const [ f, g ] of [ [ 120, 0.08 ], [ 240, 0.05 ] ] ) {

			const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
			const og = ctx.createGain(); og.gain.value = g;
			o.connect( og ).connect( bp ); o.start();

		}

		bp.connect( buzz ).connect( master );
		const noise = ctx.createBuffer( 1, ctx.sampleRate, ctx.sampleRate ), nd = noise.getChannelData( 0 );
		for ( let i = 0; i < nd.length; i ++ ) nd[ i ] = ( Math.random() * 2 - 1 ) * ( Math.random() < 0.08 ? 1 : 0.15 );
		const ns = ctx.createBufferSource(); ns.buffer = noise; ns.loop = true;
		const np = ctx.createBiquadFilter(); np.type = 'bandpass'; np.frequency.value = 3200; np.Q.value = 0.7;
		crackle = ctx.createGain(); crackle.gain.value = 0;
		ns.connect( np ).connect( crackle ).connect( master ); ns.start();
		ringGain = ctx.createGain(); ringGain.gain.value = 0; ringGain.connect( master );
		for ( const f of [ 440, 480 ] ) { const o = ctx.createOscillator(); o.frequency.value = f; o.connect( ringGain ); o.start(); }

	}

	// level 0 (dark) to 1 (all lights on nearby)
	function setHum( level ) { if ( ctx ) hum.gain.setTargetAtTime( level * 0.5, ctx.currentTime, 0.25 ); }

	// level 0 to 1 (how close the failing tube is); stutter: it is flickering right now; on: its tube is lit
	function setBuzz( level, stutter, on ) {

		if ( ! ctx ) return;
		const t = ctx.currentTime;
		buzz.gain.setTargetAtTime( level * ( on ? 0.22 : 0.04 ), t, 0.015 );
		crackle.gain.setTargetAtTime( stutter ? level * 0.12 : 0, t, 0.02 );

	}

	// a ring cadence: two seconds on, four off
	function ring( on ) {

		clearInterval( ringTimer );
		if ( ! ctx ) return;
		const burst = () => {

			const t = ctx.currentTime;
			ringGain.gain.cancelScheduledValues( t );
			for ( let i = 0; i < 2; i ++ ) {

				ringGain.gain.setValueAtTime( 0.12, t + i * 0.8 );
				ringGain.gain.setValueAtTime( 0, t + i * 0.8 + 0.5 );

			}

		};

		if ( on ) { burst(); ringTimer = setInterval( burst, 4000 ); } else ringGain.gain.setValueAtTime( 0, ctx.currentTime );

	}

	// the goose: two nasal honks (when its bill opens in the Honk clip, 0.4 s and 0.73 s in); level 0..1 (distance)
	function honk( level = 1 ) {

		if ( ! ctx || level <= 0 ) return;
		for ( const at of [ 0.38, 0.71 ] ) {

			const t = ctx.currentTime + at, g = ctx.createGain();
			g.gain.setValueAtTime( 0, t );
			g.gain.linearRampToValueAtTime( 0.32 * level, t + 0.025 );
			g.gain.setValueAtTime( 0.32 * level, t + 0.12 );
			g.gain.exponentialRampToValueAtTime( 0.001, t + 0.26 );
			const o = ctx.createOscillator(); o.type = 'sawtooth';
			o.frequency.setValueAtTime( 330, t ); o.frequency.linearRampToValueAtTime( 430, t + 0.06 ); o.frequency.linearRampToValueAtTime( 370, t + 0.26 );
			// a rough, nasal voice: two formants and a fast flutter
			const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 1150; f1.Q.value = 2.5;
			const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 2500; f2.Q.value = 3;
			const flutter = ctx.createGain(); flutter.gain.value = 0.75;
			const lfo = ctx.createOscillator(); lfo.frequency.value = 38; const lg = ctx.createGain(); lg.gain.value = 0.25;
			lfo.connect( lg ).connect( flutter.gain );
			o.connect( flutter ); flutter.connect( f1 ); flutter.connect( f2 );
			const mix = ctx.createGain(); mix.gain.value = 2.2;
			f1.connect( mix ); f2.connect( mix ); mix.connect( g ).connect( master );
			o.start( t ); lfo.start( t ); o.stop( t + 0.3 ); lfo.stop( t + 0.3 );

		}

	}

	// a heavy steel door shutting: a low thump and a short rattle
	function thud( level = 1 ) {

		if ( ! ctx ) return;
		const t = ctx.currentTime, g = ctx.createGain();
		g.gain.setValueAtTime( 0.5 * level, t ); g.gain.exponentialRampToValueAtTime( 0.001, t + 0.5 );
		const o = ctx.createOscillator(); o.frequency.setValueAtTime( 85, t ); o.frequency.exponentialRampToValueAtTime( 42, t + 0.3 );
		o.connect( g ).connect( master ); o.start( t ); o.stop( t + 0.5 );
		const n = ctx.createBuffer( 1, ctx.sampleRate * 0.25, ctx.sampleRate ), d = n.getChannelData( 0 );
		for ( let i = 0; i < d.length; i ++ ) d[ i ] = ( Math.random() * 2 - 1 ) * Math.exp( - i / ( ctx.sampleRate * 0.04 ) );
		const ns = ctx.createBufferSource(); ns.buffer = n;
		const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
		const ng = ctx.createGain(); ng.gain.value = 0.4 * level;
		ns.connect( lp ).connect( ng ).connect( master ); ns.start( t );

	}

	return { start, setHum, setBuzz, ring, honk, thud };

}
