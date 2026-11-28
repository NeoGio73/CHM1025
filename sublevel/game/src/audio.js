// The sound: the fluorescent hum, the buzz of a failing tube, the phone ring, the goose's honk and the exit door shutting.
// The hum follows how many lights are on around the player, so the dark is heard before it is seen (handoff section 6).
// Every sound also has an on-screen cue (the prompt and toasts).
// Recorded (CC0, from Freesound; see ../../CREDITS.md; cut by art/scripts/sounds.py): the ring (a 1950s Western
// Electric 500), the hum (a fluorescent tube) and the door. Each takes over from its version made in code once it has
// loaded; until then, or if it fails to load, the code version plays. The failing tube and the honk are made in code.

import { ASSETS } from './config.js';

const FILES = { ring: 'sounds/ring.mp3', door: 'sounds/door.mp3', hum: 'sounds/hum.mp3' };
// the hum file is a seamless loop of this length followed by 1 s of its own start; the game loops it from 0.5 s, well
// inside, so it does not matter whether the MP3 decoder keeps the encoder's padding at the ends
const HUM_LOOP = 575899 / 48000;

export function createAudio() {

	let ctx = null, master, hum, humCode, buzz, crackle, ringGain, ringTimer = 0, ringSrc = null;
	const rec = {}; // decoded recordings, by name

	function start() {

		if ( ctx ) { ctx.resume?.(); return; }
		try { ctx = new ( window.AudioContext || window.webkitAudioContext )(); } catch ( e ) { return; }
		master = ctx.createGain(); master.gain.value = 0.6; master.connect( ctx.destination );
		// hum (made in code until the recording is in): 120 Hz mains buzz with a little 240 Hz, low-passed
		hum = ctx.createGain(); hum.gain.value = 0;
		humCode = ctx.createGain();
		const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
		const humOsc = [];
		for ( const [ f, g ] of [ [ 120, 0.05 ], [ 240, 0.018 ], [ 360, 0.006 ] ] ) {

			const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
			const og = ctx.createGain(); og.gain.value = g;
			o.connect( og ).connect( lp ); o.start();
			humOsc.push( o );

		}

		lp.connect( humCode ).connect( hum ).connect( master );

		// the recordings
		for ( const k in FILES ) {

			fetch( ASSETS + FILES[ k ] ).then( r => { if ( ! r.ok ) throw new Error( r.status ); return r.arrayBuffer(); } )
				.then( b => ctx.decodeAudioData( b ) )
				.then( buf => {

					rec[ k ] = buf;
					if ( k !== 'hum' ) return;
					// the recorded hum fades in as the one made in code fades out
					const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = 0.5; s.loopEnd = 0.5 + HUM_LOOP;
					const g = ctx.createGain(); g.gain.setValueAtTime( 0, ctx.currentTime ); g.gain.setTargetAtTime( 0.26, ctx.currentTime, 0.3 );
					s.connect( g ).connect( hum ); s.start( 0, 0.5 );
					humCode.gain.setTargetAtTime( 0, ctx.currentTime, 0.3 );
					setTimeout( () => { for ( const o of humOsc ) o.stop(); }, 3000 );

				} )
				.catch( e => console.warn( `${ FILES[ k ] } did not load; the sound made in code plays instead.`, e ) );

		}
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

	// the recorded ring: one burst of the bell (about 2 s, then its ring dying away), every 6 s as on a North American
	// line; answering cuts it off, as lifting the receiver does
	function stopRing() {

		if ( ! ringSrc ) return;
		const t = ctx.currentTime;
		ringSrc.g.gain.setTargetAtTime( 0, t, 0.015 );
		ringSrc.s.stop( t + 0.12 );
		ringSrc = null;

	}

	function ring( on ) {

		clearInterval( ringTimer );
		if ( ! ctx ) return;
		const burst = () => {

			const t = ctx.currentTime;
			if ( rec.ring ) {

				stopRing();
				const s = ctx.createBufferSource(), g = ctx.createGain();
				s.buffer = rec.ring; g.gain.value = 0.5;
				s.connect( g ).connect( master ); s.start( t );
				ringSrc = { s, g };
				return;

			}

			// made in code: a double ring every four seconds
			ringGain.gain.cancelScheduledValues( t );
			for ( let i = 0; i < 2; i ++ ) {

				ringGain.gain.setValueAtTime( 0.12, t + i * 0.8 );
				ringGain.gain.setValueAtTime( 0, t + i * 0.8 + 0.5 );

			}

		};

		if ( on ) { burst(); ringTimer = setInterval( burst, rec.ring ? 6000 : 4000 ); } else { stopRing(); ringGain.gain.setValueAtTime( 0, ctx.currentTime ); }

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

	// a heavy steel door shutting: the recording, or (made in code) a low thump and a short rattle
	function thud( level = 1 ) {

		if ( ! ctx ) return;
		if ( rec.door ) {

			const s = ctx.createBufferSource(), g = ctx.createGain();
			s.buffer = rec.door; g.gain.value = 0.6 * level; // about 3 dB above the thud made in code: a slam, not a jump scare
			s.connect( g ).connect( master ); s.start();
			return;

		}

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
