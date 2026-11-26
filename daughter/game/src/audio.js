// All sound is synthesized with Web Audio (no audio files, nothing to license).
// - Geiger counter: Poisson-timed clicks whose rate follows the dose rate, from a panner at the right hand.
// - Room tone: low rumble, mains hum, faint air handling.
// - Positional buzz from the working emergency lamp.
// - Footsteps on concrete, and the flashlight switch.

export class AudioRig {

	constructor() {

		this.ctx = null;
		this.rate = 0.2; // clicks per second
		this.onClick = null; // visual LED hook
		this.nextClick = 0;

	}

	start() {

		if ( this.ctx ) { this.ctx.resume(); return; }
		const AC = window.AudioContext || window.webkitAudioContext;
		if ( ! AC ) return;
		const ctx = this.ctx = new AC();

		const comp = ctx.createDynamicsCompressor();
		comp.threshold.value = - 14; comp.ratio.value = 3;
		this.master = ctx.createGain(); this.master.gain.value = 0.9;
		this.master.connect( comp ).connect( ctx.destination );

		this.listener = ctx.listener;

		this._roomTone();
		this._geiger();
		this.buzzers = [];

		this.nextClick = ctx.currentTime + 0.2;
		this.timer = setInterval( () => this._schedule(), 25 );

	}

	// ---------- helpers ----------

	_noiseBuffer( seconds, brown = false ) {

		const ctx = this.ctx, n = Math.floor( ctx.sampleRate * seconds ), buf = ctx.createBuffer( 1, n, ctx.sampleRate ), d = buf.getChannelData( 0 );
		let last = 0;
		for ( let i = 0; i < n; i ++ ) {

			const w = Math.random() * 2 - 1;
			if ( brown ) { last = ( last + 0.02 * w ) / 1.02; d[ i ] = last * 3.5; } else d[ i ] = w;

		}

		// crossfade the loop point
		const f = Math.min( 2000, n >> 4 );
		for ( let i = 0; i < f; i ++ ) { const t = i / f; d[ n - f + i ] = d[ n - f + i ] * ( 1 - t ) + d[ i ] * t; }
		return buf;

	}

	_roomTone() {

		const ctx = this.ctx;
		const bus = ctx.createGain(); bus.gain.value = 1; bus.connect( this.master );

		const rumble = ctx.createBufferSource(); rumble.buffer = this._noiseBuffer( 6, true ); rumble.loop = true;
		const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160;
		const rg = ctx.createGain(); rg.gain.value = 0.42;
		rumble.connect( lp ).connect( rg ).connect( bus ); rumble.start();
		// slow swell in the rumble
		const lfo = ctx.createOscillator(); lfo.frequency.value = 0.045; const lg = ctx.createGain(); lg.gain.value = 0.16;
		lfo.connect( lg ).connect( rg.gain ); lfo.start();

		const air = ctx.createBufferSource(); air.buffer = this._noiseBuffer( 5 ); air.loop = true;
		const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.6;
		const ag = ctx.createGain(); ag.gain.value = 0.012;
		air.connect( bp ).connect( ag ).connect( bus ); air.start();

		for ( const [ f, g ] of [ [ 60, 0.012 ], [ 120, 0.008 ], [ 180, 0.003 ] ] ) {

			const o = ctx.createOscillator(); o.frequency.value = f; const og = ctx.createGain(); og.gain.value = g;
			o.connect( og ).connect( bus ); o.start();

		}

	}

	_geiger() {

		const ctx = this.ctx;
		// a few click variants: a sharp impulse into a small speaker resonance
		this.clicks = [];
		for ( let v = 0; v < 4; v ++ ) {

			const n = Math.floor( ctx.sampleRate * 0.012 ), buf = ctx.createBuffer( 1, n, ctx.sampleRate ), d = buf.getChannelData( 0 );
			const f = 2900 + v * 260, sr = ctx.sampleRate;
			for ( let i = 0; i < n; i ++ ) {

				const t = i / sr;
				d[ i ] = ( Math.sin( 2 * Math.PI * f * t ) * 0.7 + ( Math.random() * 2 - 1 ) * 0.6 ) * Math.exp( - t * 900 ) + ( i < 3 ? 0.9 : 0 );

			}

			this.clicks.push( buf );

		}

		this.geigerPan = ctx.createPanner();
		Object.assign( this.geigerPan, { panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 0.5, rolloffFactor: 1 } );
		this.geigerGain = ctx.createGain(); this.geigerGain.gain.value = 0.55;
		this.geigerPan.connect( this.geigerGain ).connect( this.master );

	}

	_schedule() {

		const ctx = this.ctx; if ( ! ctx ) return;
		const ahead = ctx.currentTime + 0.12;
		// if the rate jumped up, do not wait out an old long interval
		const maxGap = 3 / Math.max( this.rate, 0.05 );
		if ( this.nextClick - ctx.currentTime > maxGap ) this.nextClick = ctx.currentTime + Math.random() * maxGap;
		while ( this.nextClick < ahead ) {

			if ( this.nextClick >= ctx.currentTime - 0.02 ) {

				const s = ctx.createBufferSource(); s.buffer = this.clicks[ ( Math.random() * 4 ) | 0 ];
				const g = ctx.createGain(); g.gain.value = 0.6 + Math.random() * 0.4;
				s.connect( g ).connect( this.geigerPan ); s.start( this.nextClick );
				if ( this.onClick ) { const delay = Math.max( 0, ( this.nextClick - ctx.currentTime ) * 1000 ); setTimeout( this.onClick, delay ); }

			}

			this.nextClick += - Math.log( 1 - Math.random() ) / Math.max( this.rate, 0.05 );

		}

	}

	// positional hum/buzz attached to a world position (tungsten lamp ballast)
	addBuzzer( pos, level = 0.05 ) {

		if ( ! this.ctx ) return null;
		const ctx = this.ctx;
		const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 120;
		const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
		const g = ctx.createGain(); g.gain.value = level;
		const p = ctx.createPanner();
		Object.assign( p, { panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 1, rolloffFactor: 1.4 } );
		p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z;
		o.connect( lp ).connect( g ).connect( p ).connect( this.master ); o.start();
		const b = { gain: g, level };
		this.buzzers.push( b );
		return b;

	}

	setBuzz( b, k ) { if ( b ) b.gain.gain.setTargetAtTime( b.level * k, this.ctx.currentTime, 0.03 ); }

	footstep( intensity = 1 ) {

		const ctx = this.ctx; if ( ! ctx ) return;
		const t = ctx.currentTime;
		const s = ctx.createBufferSource(); s.buffer = this._stepBuf || ( this._stepBuf = this._noiseBuffer( 0.25 ) );
		const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500 + Math.random() * 300; bp.Q.value = 0.9;
		const g = ctx.createGain();
		g.gain.setValueAtTime( 0, t ); g.gain.linearRampToValueAtTime( 0.16 * intensity, t + 0.008 ); g.gain.exponentialRampToValueAtTime( 0.001, t + 0.16 );
		s.connect( bp ).connect( g ).connect( this.master ); s.start( t ); s.stop( t + 0.25 );
		// grit
		const s2 = ctx.createBufferSource(); s2.buffer = this._stepBuf;
		const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500;
		const g2 = ctx.createGain(); g2.gain.setValueAtTime( 0.02 * intensity, t + 0.02 ); g2.gain.exponentialRampToValueAtTime( 0.0005, t + 0.2 );
		s2.connect( hp ).connect( g2 ).connect( this.master ); s2.start( t + 0.015, Math.random() * 0.05 ); s2.stop( t + 0.25 );

	}

	// soft confirmation: two quiet sine notes (never a stinger)
	chime( up = true ) {

		const ctx = this.ctx; if ( ! ctx ) return;
		const t = ctx.currentTime;
		( up ? [ 660, 990 ] : [ 520, 390 ] ).forEach( ( f, i ) => {

			const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
			const g = ctx.createGain(); const t0 = t + i * 0.09;
			g.gain.setValueAtTime( 0, t0 ); g.gain.linearRampToValueAtTime( 0.05, t0 + 0.02 ); g.gain.exponentialRampToValueAtTime( 0.0005, t0 + 0.5 );
			o.connect( g ).connect( this.master ); o.start( t0 ); o.stop( t0 + 0.55 );

		} );

	}

	// heavy door or mechanism: filtered noise swell
	rumble( dur = 1.2, level = 0.25 ) {

		const ctx = this.ctx; if ( ! ctx ) return;
		const t = ctx.currentTime;
		const s = ctx.createBufferSource(); s.buffer = this._rumbleBuf || ( this._rumbleBuf = this._noiseBuffer( 3, true ) );
		const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
		const g = ctx.createGain();
		g.gain.setValueAtTime( 0, t ); g.gain.linearRampToValueAtTime( level, t + 0.15 ); g.gain.setValueAtTime( level, t + dur * 0.7 ); g.gain.linearRampToValueAtTime( 0, t + dur );
		s.connect( lp ).connect( g ).connect( this.master ); s.start( t ); s.stop( t + dur + 0.05 );

	}

	setMasterLevel( v, time = 0.5 ) { if ( this.ctx ) this.master.gain.setTargetAtTime( v, this.ctx.currentTime, time ); }

	switchClick() {

		const ctx = this.ctx; if ( ! ctx ) return;
		const t = ctx.currentTime;
		for ( const [ dt, f ] of [ [ 0, 1800 ], [ 0.035, 1300 ] ] ) {

			const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
			const g = ctx.createGain(); g.gain.setValueAtTime( 0.05, t + dt ); g.gain.exponentialRampToValueAtTime( 0.0005, t + dt + 0.02 );
			o.connect( g ).connect( this.master ); o.start( t + dt ); o.stop( t + dt + 0.03 );

		}

	}

	updateListener( camera, handPos ) {

		const ctx = this.ctx; if ( ! ctx ) return;
		const l = this.listener, e = camera.matrixWorld.elements, t = ctx.currentTime;
		const p = camera.position;
		if ( l.positionX ) {

			l.positionX.setValueAtTime( p.x, t ); l.positionY.setValueAtTime( p.y, t ); l.positionZ.setValueAtTime( p.z, t );
			l.forwardX.setValueAtTime( - e[ 8 ], t ); l.forwardY.setValueAtTime( - e[ 9 ], t ); l.forwardZ.setValueAtTime( - e[ 10 ], t );
			l.upX.setValueAtTime( e[ 4 ], t ); l.upY.setValueAtTime( e[ 5 ], t ); l.upZ.setValueAtTime( e[ 6 ], t );

		} else {

			l.setPosition( p.x, p.y, p.z ); l.setOrientation( - e[ 8 ], - e[ 9 ], - e[ 10 ], e[ 4 ], e[ 5 ], e[ 6 ] );

		}

		if ( this.geigerPan && handPos ) {

			this.geigerPan.positionX.setValueAtTime( handPos.x, t ); this.geigerPan.positionY.setValueAtTime( handPos.y, t ); this.geigerPan.positionZ.setValueAtTime( handPos.z, t );

		}

	}

}
