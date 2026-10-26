// Periodic Panic engine: the canvas, sound, controls, term bank, clue bar, scoring, and the
// arcade flow that warps from one stage (game) to the next. Each stage plugs in with
// registerStage() and talks back through E (correct, wrong, kill, nextRound ...).
"use strict";

// ============================================================ canvas & helpers
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const W = 800, H = 600, HUD_H = 92;
// Landscape: the canvas fills the screen. Portrait phones: the canvas spans the full width under a
// readable HTML strip that carries the clue and feedback (see updateStrip); controls go below it.
let portrait = false, touchMode = false;   // touchMode turns on at the first touch
function fit() {
  portrait = innerHeight > innerWidth && innerWidth < 900;
  document.body.classList.toggle('portrait', portrait);
  // landscape with touch: leave a margin each side for the stick and fire button, so they never
  // cover the play field (Zip Sort's bottom row of boxes, for example)
  const side = touchMode && !portrait ? 2 * 112 : 0;
  const s = portrait ? innerWidth / W : Math.min((innerWidth - side) / W, innerHeight / H);
  cv.style.width = W * s + 'px'; cv.style.height = H * s + 'px';
  fitScale = s; layoutTouch(); layoutHudBtns();
}
// Pause / mute / menu buttons: beside the canvas when there is room, otherwise inside the top corner
// of the play field (under the clue bar); in portrait, centred just under the canvas.
function layoutHudBtns() {
  const box = document.getElementById('hudBtns'); if (!box) return;
  const r = cv.getBoundingClientRect(), bw = 38 * 3 + 12;
  if (portrait) Object.assign(box.style, { flexDirection: 'row', left: (innerWidth - bw) / 2 + 'px', top: r.bottom + 6 + 'px' });
  else if (innerWidth - r.right >= 50) Object.assign(box.style, { flexDirection: 'column', left: r.right + 6 + 'px', top: r.top + 6 + 'px' });
  else Object.assign(box.style, { flexDirection: 'row', left: r.right - bw - 8 + 'px', top: r.top + (HUD_H + 8) * fitScale + 'px' });
}
let fitScale = 1;
function layoutTouch() {
  const stick = document.getElementById('stick'), fire = document.getElementById('fire'), knob = document.getElementById('knob');
  if (!stick || !fire || !knob) return;
  if (!touchMode) { stick.style.cssText = fire.style.cssText = knob.style.cssText = ''; return; }
  let st, fr, sx, fx, bottom;
  if (portrait) {   // in the space below the canvas, which shrinks when the clue strip grows
    const room = innerHeight - cv.getBoundingClientRect().bottom - 20 - 46;   // 46: the pause/mute/menu row
    st = Math.max(70, Math.min(150, room)); fr = Math.max(64, Math.min(110, room * 0.75));
    sx = Math.round(innerWidth * 0.06); fx = Math.round(innerWidth * 0.06); bottom = 12;
  } else {          // in the side margins left beside the canvas
    const margin = (innerWidth - W * fitScale) / 2;
    st = Math.max(70, Math.min(150, margin - 16)); fr = Math.max(64, Math.min(110, margin - 16));
    sx = Math.max(6, (margin - st) / 2); fx = Math.max(6, (margin - fr) / 2); bottom = 14;
  }
  const k = Math.round(st * 0.4);
  Object.assign(stick.style, { width: st + 'px', height: st + 'px', left: sx + 'px', bottom: bottom + 'px' });
  Object.assign(fire.style, { width: fr + 'px', height: fr + 'px', right: fx + 'px', bottom: bottom + 4 + 'px' });
  Object.assign(knob.style, { width: k + 'px', height: k + 'px', margin: -k / 2 + 'px' });
}
addEventListener('resize', fit); addEventListener('orientationchange', fit); fit();
// the portrait clue strip changes height with its text; keep the touch controls clear of the canvas
if (window.ResizeObserver) new ResizeObserver(() => { if (portrait) { layoutTouch(); layoutHudBtns(); } }).observe(document.getElementById('strip'));

const rand = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rand(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = ri(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
// Term labels: try the base size on one line, then one step smaller, and only then wrap onto two
// lines (at the larger size if it fits, else the smaller). Returns lines, size, and box size.
function fitLabel(text, maxW, base = 19) {
  const sizes = [base, base - 2, base - 4];
  const width = (t, s) => { ctx.font = `${s}px VT323, monospace`; return ctx.measureText(t).width; };
  for (const s of sizes.slice(0, 2)) { const w = width(text, s); if (w <= maxW) return { lines: [text], size: s, w, h: Math.round(s * 0.95) }; }
  const words = text.split(' ');
  for (const s of sizes) {
    let best = null;
    for (let i = 1; i < words.length; i++) {   // the most balanced split into two lines
      const a = words.slice(0, i).join(' '), b = words.slice(i).join(' '), w = Math.max(width(a, s), width(b, s));
      if (!best || w < best.w) best = { lines: [a, b], w };
    }
    if (best && best.w <= maxW) return { lines: best.lines, size: s, w: best.w, h: Math.round(s * 0.95) * 2 };
  }
  const s = sizes[2];   // a single long word: smallest size, even if a little wide
  return { lines: [text], size: s, w: width(text, s), h: Math.round(s * 0.95) };
}
// Draw a fitted label in a dark box whose top-left is (x, y); returns the box.
function drawFittedLabel(fit, x, y, textColor, borderColor) {
  const bw = fit.w + 8, bh = fit.h + 3, lh = Math.round(fit.size * 0.95);
  ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(x, y, bw, bh);
  if (borderColor) { ctx.strokeStyle = borderColor; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, bw - 1, bh - 1); }
  ctx.font = `${fit.size}px VT323, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = textColor;
  fit.lines.forEach((l, i) => ctx.fillText(l, x + bw / 2, y + 2 + i * lh));
  ctx.textAlign = 'left';
  return { x, y, w: bw, h: bh };
}
function wrapText(text, maxW, font) {
  ctx.font = font; const words = text.split(' '), lines = []; let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line); return lines;
}

// ============================================================ sound: emulated sound chips
// No recordings. Each stage's sounds are rendered by an emulation of the kind of chip its era used:
//   'tia'    the Atari 2600's TIA: 5-bit frequency dividers and polynomial counters (buzzy, off-key)
//   'sn'     the SN76489 used by the ColecoVision: three square-wave tones with 10-bit dividers,
//            2 dB volume steps, and a 15-bit noise shift register
//   'arcade' an early-80s arcade board: timer-driven square waves and a clocked noise generator,
//            through the board's output filter
// Effects are written the way games of the time wrote them: a list of chip settings, one per
// 1/60 s frame. Each effect is rendered once to a buffer and cached.
const Sound = (() => {
  let ac = null, master = null, on = store.get('ca_sound', true), music = store.get('ca_music', true);
  const cache = {};
  function init() {
    // browsers (iOS especially) keep audio suspended until a tap or key press; any later press wakes it
    if (ac) { if (ac.state === 'suspended' && ac.resume) ac.resume().catch(() => {}); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.55;
      const tv = ac.createBiquadFilter(); tv.type = 'lowpass'; tv.frequency.value = 9000;   // a little like a TV/cabinet speaker
      master.connect(tv); tv.connect(ac.destination);
    } catch (e) { ac = null; }
  }
  const seq = (n, fn) => Array.from({ length: n }, (_, i) => fn(i, n));
  const expo = (a, b, k) => a * Math.pow(b / a, k);
  const FRAME = 1 / 60;

  // ---------------- Atari 2600 TIA ----------------
  // a frame is [voice0, voice1]; a voice is [AUDC 0-15, AUDF 0-31, AUDV 0-15] or null
  const lfsr = (bits, tap, len) => { let s = (1 << bits) - 1; const out = []; for (let i = 0; i < len; i++) { out.push(s & 1); const fb = ((s >> 0) ^ (s >> tap)) & 1; s = (s >> 1) | (fb << (bits - 1)); } return out; };
  const BIT4 = lfsr(4, 1, 15), BIT5 = lfsr(5, 2, 31), BIT9 = lfsr(9, 4, 511);
  const DIV31 = seq(31, i => (i === 17 || i === 30) ? 1 : 0);
  function renderTIA(frames) {
    const RATE = 31440, spf = Math.round(RATE * FRAME), n = frames.length * spf;
    const buf = ac.createBuffer(1, n, RATE), d = buf.getChannelData(0);
    const vs = [0, 1].map(() => ({ cnt: 1, p4: 0, p5: 0, p9: 0, out: 0 }));
    let dc = 0;
    for (let f = 0; f < frames.length; f++) {
      const fr = Array.isArray(frames[f][0]) || frames[f][0] === null ? frames[f] : [frames[f], null];
      for (let s = 0; s < spf; s++) {
        let sum = 0;
        for (let v = 0; v < 2; v++) {
          const p = fr[v], st = vs[v]; if (!p) continue;
          const [c, af, vol] = p;
          if (c === 0 || c === 11) { sum += vol; continue; }
          if (--st.cnt <= 0) {
            st.cnt = (af + 1) * ((c & 0x0c) === 0x0c ? 3 : 1);
            st.p5 = (st.p5 + 1) % 31;
            if ((c & 2) === 0 || ((c & 1) === 0 && DIV31[st.p5]) || ((c & 1) === 1 && BIT5[st.p5])) {
              if (c & 4) st.out = st.out ? 0 : 1;
              else if (c & 8) { if (c === 8) { st.p9 = (st.p9 + 1) % 511; st.out = BIT9[st.p9]; } else st.out = BIT5[st.p5]; }
              else { st.p4 = (st.p4 + 1) % 15; st.out = BIT4[st.p4]; }
            }
          }
          sum += st.out * vol;
        }
        const x = sum / 30; dc += (x - dc) * 0.002;   // remove the DC offset (the TIA output is one-sided)
        d[f * spf + s] = (x - dc) * 1.0;
      }
    }
    return buf;
  }

  // ---------------- SN76489 (ColecoVision) ----------------
  // a frame is { t: [[hz, att], ...up to 3], n: [rate 0-3, att, white] }; att 0 = loudest, 15 = off
  const SN_CLOCK = 3579545 / 16;
  const snN = hz => clamp(Math.round(SN_CLOCK / (2 * hz)), 1, 1023);          // the 10-bit divider the chip really uses
  const SN_VOL = seq(16, a => a === 15 ? 0 : Math.pow(10, -a * 2 / 20));
  function renderSN(frames) {
    const RATE = 44100, spf = Math.round(RATE * FRAME), n = frames.length * spf, tick = SN_CLOCK / RATE;
    const buf = ac.createBuffer(1, n, RATE), d = buf.getChannelData(0);
    const tone = [0, 1, 2].map(() => ({ cnt: 0, out: 1 })), nz = { cnt: 0, ff: 0, reg: 0x4000 };
    for (let f = 0; f < frames.length; f++) {
      const fr = frames[f] || {}, ts = fr.t || [], ns = fr.n;
      for (let s = 0; s < spf; s++) {
        let sum = 0;
        for (let k = 0; k < 3; k++) {
          const p = ts[k]; if (!p || p[1] >= 15) continue;
          const N = snN(p[0]), st = tone[k];
          st.cnt -= tick; while (st.cnt <= 0) { st.cnt += N; st.out = -st.out; }
          sum += st.out * SN_VOL[p[1]];
        }
        if (ns && ns[1] < 15) {
          const N = [16, 32, 64][ns[0]] || (ts[2] ? snN(ts[2][0]) : 64);
          nz.cnt -= tick;
          while (nz.cnt <= 0) {
            nz.cnt += N; nz.ff ^= 1;
            if (nz.ff) { const fb = ns[2] ? ((nz.reg ^ (nz.reg >> 1)) & 1) : (nz.reg & 1); nz.reg = (nz.reg >> 1) | (fb << 14); }
          }
          sum += ((nz.reg & 1) ? 1 : -1) * SN_VOL[ns[1]];
        }
        d[f * spf + s] = sum * 0.42;
      }
    }
    return buf;
  }

  // ---------------- early-80s arcade board ----------------
  // a frame is { t: [[hz, vol 0-1], ...], n: [clock hz, vol 0-1] }
  function renderArcade(frames) {
    const RATE = 44100, spf = Math.round(RATE * FRAME), n = frames.length * spf;
    const buf = ac.createBuffer(1, n, RATE), d = buf.getChannelData(0);
    const ph = [0, 0, 0]; let nph = 0, reg = 0x1ffff, lp = 0;
    const alpha = 1 - Math.exp(-2 * Math.PI * 6500 / RATE);   // the board's output filter
    for (let f = 0; f < frames.length; f++) {
      const fr = frames[f] || {}, ts = fr.t || [], ns = fr.n;
      for (let s = 0; s < spf; s++) {
        let sum = 0;
        ts.forEach((p, k) => { if (!p || !p[1]) return; ph[k] = (ph[k] + p[0] / RATE) % 1; sum += (ph[k] < 0.5 ? 1 : -1) * p[1]; });
        if (ns && ns[1]) {
          nph += ns[0] / RATE;
          while (nph >= 1) { nph -= 1; const fb = ((reg >> 0) ^ (reg >> 3)) & 1; reg = (reg >> 1) | (fb << 16); }
          sum += ((reg & 1) ? 1 : -1) * ns[1];
        }
        lp += (sum - lp) * alpha;
        d[f * spf + s] = lp * 0.32;
      }
    }
    return buf;
  }
  const RENDER = { tia: renderTIA, sn: renderSN, arcade: renderArcade };

  // ---------------- the effects, per chip ----------------
  const T = (c, f, v) => [c, clamp(Math.round(f), 0, 31), clamp(Math.round(v), 0, 15)];
  const notes = (list, frames, fn) => list.flatMap(x => seq(frames, i => fn(x, i)));
  const SFX = {
    tia: {   // Jungle Jump
      jump:    () => seq(8, i => T(4, 18 - i * 1.7, 10)),
      land:    () => seq(2, () => T(8, 18, 6)),
      grab:    () => [...seq(6, i => T(12, 14 - i * 2, 11)), ...seq(6, i => T(12, 4 + i * 1.5, 9))],
      splash:  () => seq(32, i => T(8, 2 + i * 0.5, 13 - i * 0.4)),
      chomp:   () => [...seq(4, () => T(3, 26, 15)), [null, null], [null, null], ...seq(3, () => T(3, 29, 12))],
      logHit:  () => seq(9, i => T(15, 20, 13 - i * 1.4)),
      sink:    () => seq(70, i => T(6, 8 + i * 0.33, 11 - i * 0.12)),
      crumble: () => seq(24, i => T(8, 8 + i * 0.7, 11 - i * 0.45)),
      correct: () => notes([17, 13, 11, 8], 5, f => T(4, f, 10)),
      wrong:   () => seq(22, i => T(7, 28, 12 - i * 0.3)),
      death:   () => [...seq(66, i => [T(1, Math.floor(i / 3) % 2 ? 8 : 15, 12), T(8, 4, 5)]), ...seq(24, i => T(12, 6 + i, 10 - i * 0.4))],
      exit:    () => seq(12, i => T(4, 6 + i * 1.2, 9)),
      blip:    () => seq(2, () => T(4, 5, 8)),
      warp:    () => seq(42, i => [T(12, 31 - i * 0.74, 10), T(4, 31 - i * 0.6, 4)]),
      // Shield Spell
      nibble:     () => seq(2, () => T(15, 5, 8)),
      letter:     () => notes([12, 9, 7], 3, f => T(4, f, 11)),
      shot:       () => seq(4, i => T(8, 3 + i, 8)),
      cannonReady:() => seq(24, i => T(12, 28 - i, 6 + i * 0.2)),
      cannonFire: () => seq(18, i => [T(8, 2 + i * 0.8, 14 - i * 0.5), T(6, 4 + i, 10)]),
      coreBoom:   () => seq(110, i => [T(8, (i * 3) % 31, 15 - i * 0.13), T(3, 31 - (i % 31), 11 - i * 0.1)]),
      swirl:      () => seq(30, i => T(1, 4 + (i % 8), 10))
    },
    sn: {    // Mole Hole
      throwBall: () => seq(7, i => ({ t: [[expo(500, 1600, i / 6), 2]] })),
      pop:       () => seq(13, i => ({ t: [[expo(900, 130, i / 12), 2 + i * 0.7 | 0]], n: [1, 4 + i | 0, 1] })),
      electron:  () => [...seq(3, () => ({ t: [[1760, 4]] })), ...seq(3, () => ({ t: [[2350, 5]] }))],
      wobble:    () => notes([140, 175, 140, 175], 7, f => ({ t: [[f, 3]] })),
      thud:      () => seq(18, i => ({ t: [[expo(160, 55, i / 17), 3 + i * 0.6 | 0]], n: [2, 2 + i * 0.7 | 0, 1] })),
      crumble:   () => seq(30, i => ({ n: [i < 10 ? 0 : i < 20 ? 1 : 2, 3 + i * 0.4 | 0, 1] })),
      spawn:     () => seq(10, i => ({ t: [[expo(200, 420, i / 9), 6]] })),
      digger:    () => seq(24, i => ({ t: [[i % 2 ? 300 : 345, 6], [150, 9]] })),
      clear:     () => notes([523, 784, 659, 1047, 784, 1319, 1568], 5, f => ({ t: [[f, 3], [f / 2, 7]] })),
      correct:   () => notes([523, 659, 784, 1047, 1319], 4, f => ({ t: [[f, 3]] })),
      wrong:     () => seq(24, i => ({ t: [[i % 4 < 2 ? 117 : 110, 3], [i % 4 < 2 ? 123 : 116, 5]] })),
      death:     () => [...seq(70, i => ({ t: [[i % 2 ? 220 - i : 330 - i, 3]], n: [2, 8, 1] })), ...seq(26, i => ({ t: [[expo(700, 110, i / 25), 3 + i / 3 | 0]] }))],
      exit:      () => seq(16, i => ({ t: [[expo(1200, 160, i / 15), 5]] })),
      blip:      () => seq(2, () => ({ t: [[1400, 5]] })),
      warp:      () => seq(42, i => ({ t: [[expo(220, 1760, (i % 14) / 13), 4], [expo(110, 880, i / 41), 8]] })),
      // Isotope
      laser:      () => seq(6, i => ({ t: [[expo(1800, 600, i / 5), 3]] })),
      turretShot: () => seq(5, i => ({ t: [[expo(400, 900, i / 4), 6]] })),
      explode:    () => seq(30, i => ({ t: [[expo(200, 50, i / 29), 6 + i * 0.3 | 0]], n: [i < 10 ? 0 : 1, 1 + i * 0.45 | 0, 1] })),
      fuel:       () => notes([392, 523, 659, 784], 4, f => ({ t: [[f, 4], [f * 1.5, 8]] })),
      lowFuel:    () => seq(10, i => ({ t: [[880, i < 5 ? 5 : 15]] })),
      zapField:   () => seq(16, i => ({ t: [[i % 2 ? 600 : 900, 4]], n: [0, 6, 1] })),
      // Zip Sort
      zipEdge:    () => [...seq(2, () => ({ t: [[1320, 6]] })), ...seq(2, () => ({ t: [[1760, 7]] }))],
      fillBox:    () => seq(8, i => ({ t: [[expo(330, 1320, i / 7), 4]] })),
      power:      () => notes([523, 659, 784, 1047, 784, 1047, 1319], 3, f => ({ t: [[f, 3], [f / 2, 6]] })),
      eat:        () => seq(10, i => ({ t: [[expo(1500, 200, i / 9), 3]] }))
    },
    arcade: {   // Robo-Lab
      zap:      () => seq(7, i => ({ t: [[expo(2800, 420, i / 6), 0.9]] })),
      robotZap: () => seq(9, i => ({ t: [[expo(1300, 330, i / 8), 0.6]], n: [6000, 0.12] })),
      boom:     () => seq(34, i => ({ t: [[expo(320, 55, Math.min(1, i / 18)), 0.35 * (1 - i / 34)]], n: [expo(9000, 500, i / 33), 0.9 * (1 - i / 34)] })),
      radical:  () => notes([880, 587, 880, 587, 880, 587, 880, 587], 5, f => ({ t: [[f, 0.6]] })),
      bounce:   () => seq(4, i => ({ t: [[expo(150, 70, i / 3), 0.5]] })),
      door:     () => seq(15, i => ({ t: [[300 + i * 70, 0.7]] })),
      exit:     () => seq(19, i => ({ t: [[expo(1200, 160, i / 18), 0.55]] })),
      correct:  () => notes([523, 659, 784, 1047, 1319], 4, f => ({ t: [[f, 0.6]] })),
      wrong:    () => seq(24, i => ({ t: [[i % 4 < 2 ? 110 : 98, 0.8], [i % 4 < 2 ? 55 : 49, 0.4]] })),
      death:    () => [...seq(80, i => ({ t: [[(i % 2 ? 0.35 : 1.6) * expo(220, 110, i / 79), 0.8]], n: [2500, 0.18] })), ...seq(27, i => ({ t: [[expo(700, 70, i / 26), 0.7]] }))],
      blip:     () => seq(2, () => ({ t: [[1400, 0.5]] })),
      warp:     () => seq(42, i => ({ t: [[expo(300, 2400, (i % 14) / 13), 0.5], [expo(150, 1200, i / 41), 0.3]] }))
    }
  };
  // which chip voices a sound: the current stage's chip if it has the sound, otherwise its owner
  const OWNER = {};
  for (const chip in SFX) for (const name in SFX[chip]) if (!OWNER[name]) OWNER[name] = chip;
  const chipFor = name => { const cur = G && G.stage && G.stage.chip; return cur && SFX[cur][name] ? cur : OWNER[name]; };
  function playBuf(buf, gain = 1) {
    const s = ac.createBufferSource(); s.buffer = buf;
    const g = ac.createGain(); g.gain.value = gain; s.connect(g); g.connect(master); s.start();
  }
  function playOn(chip, name) {
    if (!ac || !on || !SFX[chip] || !SFX[chip][name]) return;
    const key = chip + ':' + name;
    if (!cache[key]) cache[key] = RENDER[chip](SFX[chip][name]());
    playBuf(cache[key]);
  }

  // Mole Hole's original tune on the SN76489, one step at a time while the mole moves (MIDI, 0 = rest)
  const MEL = [72, 0, 76, 79, 77, 0, 74, 77, 76, 0, 72, 76, 74, 71, 67, 0, 72, 0, 76, 79, 81, 0, 79, 77, 76, 74, 76, 72, 74, 0, 72, 0];
  const BASS = [48, 55, 48, 55, 50, 57, 50, 57, 52, 55, 52, 55, 43, 50, 43, 50];
  const midi = m => 440 * Math.pow(2, (m - 69) / 12);
  let step = 0;
  function note(key, frames) { if (!cache[key]) cache[key] = renderSN(frames); playBuf(cache[key]); }

  const api = {
    init, get on() { return on; }, get music() { return music; },
    toggle() { on = !on; store.set('ca_sound', on); return on; },
    toggleMusic() { music = !music; store.set('ca_music', music); return music; },
    playOn,
    sounds: chip => Object.keys(SFX[chip] || {}),
    _render: (chip, name) => RENDER[chip](SFX[chip][name]()),   // for automated tests
    musicStep() {
      if (!ac || !on || !music) return;
      const m = MEL[step % MEL.length], b = BASS[Math.floor(step / 2) % BASS.length];
      if (m) note('mel' + m, seq(7, i => ({ t: [[midi(m), i < 5 ? 6 : 9]] })));
      if (step % 2 === 0) { let hz = midi(b); if (hz < 110) hz *= 2; note('bass' + b, seq(12, i => ({ t: [[hz, i < 8 ? 4 : 8]] }))); }
      step++;
    }
  };
  for (const name in OWNER) api[name] = () => playOn(chipFor(name), name);
  return api;
})();

// Optional robot voice for Robo-Lab: browser text-to-speech with original lines.
const Voice = (() => {
  let on = store.get('ca_voice', true), last = 0;
  const lines = {
    enter: ['Intruder in the lab.', 'Human detected. Begin quiz.', 'Scientist located.', 'Prepare for review.'],
    wrong: ['Incorrect, human.', 'Wrong term.', 'Check your notes.', 'Error. Error.'],
    radical: ['Free radical released.', 'Unpaired electron approaching.'],
    flee: ['The human is fleeing.', 'Come back and study.']
  };
  return {
    get on() { return on; },
    toggle() { on = !on; store.set('ca_voice', on); return on; },
    say(kind) {
      if (!on || !('speechSynthesis' in window) || !Sound.on) return;
      const now = performance.now(); if (now - last < 2500) return; last = now;
      try { const u = new SpeechSynthesisUtterance(pick(lines[kind])); u.pitch = 0.1; u.rate = 0.85; u.volume = 0.8; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {}
    }
  };
})();

// ============================================================ term bank
const BANK = (window.TERMS || []).filter(t => !(window.SKIP_SECTIONS || []).includes(t.section) && !(window.SKIP_TERMS || []).includes(t.id));
const CH_NAMES = window.CHAPTER_NAMES || {};

// ============================================================ input
const keys = {};
let touchUsed = false, pressLatch = false, fireLatch = false, lastAxisKey = null;
let readFirst = store.get('ca_readfirst', true);
const touchVec = { x: 0, y: 0, fire: false };
addEventListener('pointerdown', () => Sound.init(), { passive: true });   // unlock audio on the first tap
addEventListener('keydown', e => {
  Sound.init();   // ...or the first key press
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k) && G) e.preventDefault();
  keys[k] = true;
  if (!e.repeat && ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' '].includes(k)) pressLatch = true;
  if (['arrowup', 'arrowdown', 'w', 's'].includes(k)) lastAxisKey = 'v';
  if (['arrowleft', 'arrowright', 'a', 'd'].includes(k)) lastAxisKey = 'h';
  if (k === ' ') fireLatch = true;
  if ((k === 'p' || k === 'escape') && G && G.state !== 'over') G.paused = !G.paused;
  if (k === 'm') { Sound.toggle(); syncButtons(); }
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
(function setupTouch() {
  addEventListener('touchstart', () => { touchUsed = true; touchMode = true; document.getElementById('touch').classList.add('on'); fit(); }, { once: true, passive: true });
  cv.addEventListener('pointerdown', () => { if (G) G.startReq = true; });
  document.getElementById('strip').addEventListener('pointerdown', () => { if (G) G.startReq = true; });   // portrait clue strip
  const stick = document.getElementById('stick'), knob = document.getElementById('knob'), fire = document.getElementById('fire');
  let sid = null;
  const move = t => {
    const r = stick.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = t.clientX - cx, dy = t.clientY - cy; const m = Math.hypot(dx, dy), max = r.width / 2;
    if (m > max) { dx *= max / m; dy *= max / m; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    const four = G && G.stage && G.stage.fourWay;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < max * 0.3) { touchVec.x = touchVec.y = 0; }
    else if (four) { if (Math.abs(dx) > Math.abs(dy)) { touchVec.x = Math.sign(dx); touchVec.y = 0; } else { touchVec.y = Math.sign(dy); touchVec.x = 0; } }
    else { touchVec.x = Math.abs(dx) > max * 0.3 ? Math.sign(dx) : 0; touchVec.y = Math.abs(dy) > max * 0.3 ? Math.sign(dy) : 0; }
  };
  stick.addEventListener('touchstart', e => { e.preventDefault(); Sound.init(); sid = e.changedTouches[0].identifier; move(e.changedTouches[0]); });
  stick.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === sid) move(t); });
  const end = e => { for (const t of e.changedTouches) if (t.identifier === sid) { sid = null; touchVec.x = touchVec.y = 0; knob.style.transform = ''; } };
  stick.addEventListener('touchend', end); stick.addEventListener('touchcancel', end);
  fire.addEventListener('touchstart', e => { e.preventDefault(); touchVec.fire = true; fireLatch = true; });
  fire.addEventListener('touchend', e => { e.preventDefault(); touchVec.fire = false; });
})();
// x/y for 8-way stages; dir (one of four, favouring the last axis pressed) for 4-way stages
function readInput() {
  let x = 0, y = 0;
  if (keys['arrowleft'] || keys['a']) x -= 1;
  if (keys['arrowright'] || keys['d']) x += 1;
  if (keys['arrowup'] || keys['w']) y -= 1;
  if (keys['arrowdown'] || keys['s']) y += 1;
  x = x || touchVec.x; y = y || touchVec.y;
  const h = x ? (x < 0 ? 'left' : 'right') : null, v = y ? (y < 0 ? 'up' : 'down') : null;
  const dir = h && v ? (lastAxisKey === 'h' ? h : v) : (h || v);
  const fire = fireLatch || keys[' '] || touchVec.fire; fireLatch = false;
  return { x, y, dir, fire };
}

// ============================================================ stages & game flow
const STAGES = [];
function registerStage(s) { STAGES.push(s); }
const ROUNDS_PER_STAGE = 4;   // correct answers before warping to the next stage (arcade mode)
let G = null;

const E = {   // what stages call
  addScore(n) {
    G.score = Math.max(0, G.score + n);
    if (G.score >= G.nextLifeAt) { G.lives++; G.nextLifeAt += 5000; E.banner('BONUS LIFE', '#ffd23f', '', 1.5); Sound.correct(); }
  },
  particles(x, y, color, n = 24, spd = 160) {
    for (let i = 0; i < n; i++) { const a = rand(0, Math.PI * 2), s = rand(spd * 0.3, spd); G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.4, 0.9), color }); }
  },
  banner(text, color, sub, dur = 2.6) { G.banner = { text, color, sub, t: dur }; },
  // wrong choices for the current target: mostly from the same chapter so they are tempting. If the
  // chosen chapters are too small to fill a round, terms from the other chapters are borrowed.
  distractors(target, n) {
    const same = shuffle(G.pool.filter(t => t.id !== target.id && t.chapter === target.chapter));
    const other = shuffle(G.pool.filter(t => t.id !== target.id && t.chapter !== target.chapter));
    const inPool = new Set(G.pool.map(t => t.id));
    const borrowed = shuffle(BANK.filter(t => !inPool.has(t.id)));
    const out = [];
    for (const t of [...same.slice(0, Math.ceil(n * 0.6)), ...other, ...same, ...borrowed]) {
      if (out.length >= n) break;
      if (!out.includes(t) && t.short.toLowerCase() !== target.short.toLowerCase()) out.push(t);
    }
    return out;
  },
  correct(pts) {
    E.addScore(pts); G.solved++; G.stageSolved++;
    if (G.mode === 'free' && G.solved % ROUNDS_PER_STAGE === 0) { G.level++; setTimeout(() => G && E.banner('LEVEL ' + G.level, '#ffd23f', 'Faster now.', 1.8), 1600); }
    E.banner('CORRECT! +' + pts, '#38f0c8', G.target.term, 2.3);
  },
  wrong(term, penalty) {
    E.addScore(-penalty); Sound.wrong();
    G.missed.set(G.target.id, G.target);
    if (!G.target.group) G.queue.splice(Math.min(3, G.queue.length), 0, G.target);   // it comes back soon (category questions are picked by their stage)
    E.banner('NOPE: ' + term.term.toUpperCase(), '#ff4d6d', term.clue, 4.2);
  },
  mistake(text, sub, penalty) {   // a slip that isn't choosing another term (e.g. a wrong letter)
    E.addScore(-penalty); Sound.wrong();
    if (!G.missed.has(G.target.id)) { G.missed.set(G.target.id, G.target); if (!G.target.group) G.queue.splice(Math.min(3, G.queue.length), 0, G.target); }
    E.banner(text, '#ff4d6d', sub, 2.2);
  },
  skip() {   // left the round without answering
    G.missed.set(G.target.id, G.target);
    if (!G.target.group) G.queue.splice(Math.min(2, G.queue.length), 0, G.target);
  },
  kill(why) { G.lives--; Sound.death(); E.banner('OUCH', '#ff4d6d', why, 1.7); },
  deathDone() { if (G.lives <= 0) return gameOver(); G.stage.respawn(); setReady(); },
  // next question: same stage, or warp to the next stage in arcade mode
  nextRound(info) {
    if (G.mode === 'arcade' && G.stageSolved >= ROUNDS_PER_STAGE) {
      const next = (G.stageIdx + 1) % STAGES.length;
      G.level++;
      if (next === 0) G.loop++;
      return startStage(next, true);
    }
    G.target = nextTarget(); G.stage.start(G.target, info || {}); setReady();
  },
  get level() { return G.level; },
  get target() { return G.target; },
  get time() { return G.t; }
};

// Next question. A stage can limit which terms suit it (stage.accepts); others wait in the queue.
function nextTarget() {
  if (G.stage && G.stage.pickTarget) { const t = G.stage.pickTarget(); if (t) return t; }   // e.g. Zip Sort asks about a category
  const ok = t => !G.stage || !G.stage.accepts || G.stage.accepts(t);
  if (!G.queue.length) G.queue = shuffle(G.pool.slice());
  for (let i = 0; i < G.queue.length; i++) if (ok(G.queue[i])) return G.queue.splice(i, 1)[0];
  const fits = G.pool.filter(ok);
  if (fits.length) return pick(fits);
  const borrowed = BANK.filter(ok);   // none of the chosen chapters' terms suit this stage: borrow one
  return borrowed.length ? pick(borrowed) : G.queue.shift();
}
const IGNORE_PRESS = 0.3;   // seconds after a title card or a new round during which presses are ignored
function setReady() { G.ready = readFirst; G.readyT = 0; G.startReq = false; }
let selected = new Set(store.get('ca_chapters', [...new Set(BANK.map(t => t.chapter))]));

function newGame(mode, stageIdx) {
  const pool = BANK.filter(t => selected.has(t.chapter));
  store.set('ca_chapters', [...selected]);
  G = { mode, stageIdx: 0, stage: null, pool, queue: shuffle(pool.slice()), score: 0, lives: 5, level: 1, loop: 1,
        solved: 0, stageSolved: 0, missed: new Map(), state: 'card', cardT: 0, paused: false, t: 0,
        particles: [], banner: null, nextLifeAt: 5000, ready: false, readyT: 0, startReq: false, target: null };
  startStage(stageIdx || 0, false);
}
function startStage(idx, warp) {
  G.stageIdx = idx; G.stage = STAGES[idx]; G.stageSolved = 0;
  G.target = nextTarget();
  G.stage.start(G.target, { fresh: true });
  G.state = 'card'; G.cardT = 0; G.warp = warp; G.banner = null; G.startReq = false; pressLatch = false;
  if (warp) Sound.warp();
}

function update(dt) {
  if (!G || G.state === 'over' || G.paused) return;
  G.t += dt;
  G.particles = G.particles.filter(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.95; p.vy *= 0.95; return (p.life -= dt) > 0; });
  if (G.banner && (G.banner.t -= dt) <= 0) G.banner = null;
  if (G.state === 'card') {
    G.cardT += dt;   // time the title card has been up
    // the card stays until a key press or tap; presses in the first 0.3 s don't count (no accidental skips)
    if (G.cardT > IGNORE_PRESS && (pressLatch || G.startReq || touchVec.fire)) { G.state = 'play'; setReady(); Sound.blip(); }
    pressLatch = false; G.startReq = false;
    return;
  }
  const inp = readInput();
  if (G.ready) {
    // read-the-clue pause: a press in the first 0.3 s is dropped (it was meant for the screen before);
    // the next press starts play, and the status line switches to the stage's instruction at once
    G.readyT += dt;
    if (G.readyT < IGNORE_PRESS) { pressLatch = false; G.startReq = false; return; }
    if (pressLatch || G.startReq || touchVec.x || touchVec.y) { G.ready = false; pressLatch = false; G.startReq = false; Sound.blip(); }
    else return;
  }
  G.stage.update(dt, inp);
}

// ============================================================ drawing
function drawHUD() {
  const S = G.stage, accent = S.hudColor ? S.hudColor() : S.color;
  ctx.fillStyle = '#080a10'; ctx.fillRect(0, 0, W, HUD_H);
  ctx.fillStyle = accent; ctx.fillRect(0, HUD_H - 3, W, 3);
  ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.font = '10px "Press Start 2P", monospace';
  if (G.ready && !(S.isDying && S.isDying())) {
    ctx.fillStyle = Math.floor(G.t * 2) % 2 ? '#ffd23f' : '#e8f6ff';
    ctx.fillText(touchUsed ? 'READ THE CLUE · TAP TO START' : 'READ THE CLUE · MOVE OR SPACE TO START', 14, 10);
    ctx.strokeStyle = `rgba(255,210,63,${0.5 + 0.5 * Math.sin(G.t * 5)})`; ctx.lineWidth = 3; ctx.strokeRect(4, 4, W - 8, HUD_H - 10);
  } else { ctx.fillStyle = '#5d6b80'; ctx.fillText(`CH ${G.target.chapter}  ·  ${S.hudLabel}`, 14, 10); }
  ctx.textAlign = 'right'; ctx.fillStyle = '#e8f6ff'; ctx.fillText(`SCORE ${G.score}`, W - 14, 10);
  ctx.fillStyle = '#5d6b80'; ctx.fillText(`LV ${G.level}`, W - 172, 10);
  ctx.textAlign = 'left';
  for (let i = 0; i < Math.min(G.lives, 8); i++) S.drawLifeIcon(W - 20 - i * 16, 32);
  // arcade mode: pips showing progress toward the next warp
  if (G.mode === 'arcade') {
    for (let i = 0; i < ROUNDS_PER_STAGE; i++) { ctx.fillStyle = i < G.stageSolved ? accent : '#1d2636'; ctx.fillRect(W - 290 + i * 12, 11, 8, 8); }
  }
  if (S.drawHud) S.drawHud();
  if (portrait) return;   // in portrait the clue is in the HTML strip, at a readable size
  const lines = wrapText(G.target.clue, W - 170, '26px VT323, monospace');
  ctx.font = '26px VT323, monospace'; ctx.fillStyle = S.isSolved && S.isSolved() ? '#38f0c8' : '#ffd23f';
  lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, 14, 28 + i * 26));
}
function drawBanner() {
  const b = G.banner; if (!b || portrait) return;   // in portrait, feedback shows in the strip
  ctx.globalAlpha = clamp(b.t * 3, 0, 1);
  const subLines = b.sub ? wrapText(b.sub, W - 180, '24px VT323, monospace') : [];
  const bh = 44 + subLines.length * 24, by = H - bh - 22;
  ctx.fillStyle = 'rgba(0,0,0,.88)'; ctx.fillRect(70, by, W - 140, bh);
  ctx.strokeStyle = b.color; ctx.lineWidth = 2; ctx.strokeRect(70, by, W - 140, bh);
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.font = '14px "Press Start 2P", monospace'; ctx.fillStyle = b.color; ctx.fillText(b.text, W / 2, by + 12);
  ctx.font = '24px VT323, monospace'; ctx.fillStyle = '#e8f6ff'; subLines.forEach((l, i) => ctx.fillText(l, W / 2, by + 34 + i * 24));
  ctx.textAlign = 'left'; ctx.globalAlpha = 1;
}
// Portrait phones: mirror the clue, the stage instructions, and feedback into the HTML strip,
// where they read at phone size (the canvas is only ~half scale there). DOM is touched only on change.
const strip = { label: document.getElementById('stripLabel'), text: document.getElementById('stripText'), note: document.getElementById('stripNote'), last: '' };
function updateStrip() {
  if (!portrait || !G) return;
  const S = G.stage;
  let label, text, note = '', noteColor = '#e8f6ff';
  if (G.state === 'card') {
    label = G.mode === 'arcade' ? `STAGE ${G.stageIdx + 1} OF ${STAGES.length}` + (G.loop > 1 ? ` · LOOP ${G.loop}` : '') : 'FREE PLAY';
    text = `${S.name}: ${S.howTo.join(' ')}`;
    note = G.cardT > IGNORE_PRESS ? 'Tap to start. (Tip: turn your phone sideways for a bigger playfield.)' : '';
    noteColor = '#ffd23f';
  } else {
    const dying = S.isDying && S.isDying();
    label = G.ready && !dying ? 'READ THE CLUE · TAP TO START' : `CH ${G.target.chapter} · ${S.hudLabel}`;
    text = G.target.clue;
    if (G.banner) { note = G.banner.text + (G.banner.sub ? ': ' + G.banner.sub : ''); noteColor = G.banner.color; }
  }
  const key = label + '|' + text + '|' + note;
  if (key === strip.last) return;
  strip.last = key;
  strip.label.textContent = label; strip.text.textContent = text;
  strip.note.textContent = note; strip.note.style.color = noteColor;
  document.getElementById('strip').style.borderBottomColor = S.color;
  layoutTouch(); layoutHudBtns();   // the strip's height may have changed, moving the canvas
}
function drawCard() {
  // stage title card (start of game and every warp)
  const S = G.stage, k = clamp(G.cardT * 3, 0, 1);
  ctx.fillStyle = `rgba(0,0,0,${0.85 * k})`; ctx.fillRect(0, 0, W, H);
  if (G.warp) {   // streaking stars for the warp
    for (let i = 0; i < 60; i++) {
      const a = i * 2.39996, r = ((G.t * 400 + i * 37) % 500), x = W / 2 + Math.cos(a) * r, y = H / 2 + Math.sin(a) * r;
      ctx.fillStyle = i % 3 ? '#5d6b80' : S.color; ctx.fillRect(x, y, 2 + r / 120, 2 + r / 120);
    }
  }
  ctx.globalAlpha = k; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = '12px "Press Start 2P", monospace'; ctx.fillStyle = '#5d6b80';
  const label = G.mode === 'arcade' ? `STAGE ${G.stageIdx + 1} OF ${STAGES.length}` + (G.loop > 1 ? `  ·  LOOP ${G.loop}` : '') : 'FREE PLAY';
  ctx.fillText(G.warp ? 'WARP!  ' + label : label, W / 2, 170);
  ctx.font = '40px "Press Start 2P", monospace'; ctx.fillStyle = S.color; ctx.fillText(S.name, W / 2, 205);
  ctx.font = '26px VT323, monospace'; ctx.fillStyle = '#e8f6ff';
  S.howTo.forEach((l, i) => ctx.fillText(l, W / 2, 285 + i * 30));
  if (G.mode === 'arcade') { ctx.fillStyle = '#5d6b80'; ctx.fillText(`${ROUNDS_PER_STAGE} correct answers warp you to the next stage.`, W / 2, 285 + S.howTo.length * 30 + 20); }
  // stays up until the player is ready
  if (G.cardT > IGNORE_PRESS && Math.floor(G.t * 2.5) % 2) {
    ctx.font = '14px "Press Start 2P", monospace'; ctx.fillStyle = '#ffd23f';
    ctx.fillText(touchUsed ? 'TAP TO START' : 'PRESS SPACE TO START', W / 2, 470);
  }
  ctx.textAlign = 'left'; ctx.globalAlpha = 1;
}
function draw() {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  syncHudBtns();
  if (!G) return;
  G.stage.draw();
  for (const p of G.particles) { ctx.globalAlpha = clamp(p.life * 1.5, 0, 1); ctx.fillStyle = p.color; ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); }
  ctx.globalAlpha = 1;
  drawHUD();
  drawBanner();
  if (G.state === 'card') drawCard();
  updateStrip();
  if (G.paused) {
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.font = '22px "Press Start 2P", monospace'; ctx.fillStyle = '#ffd23f'; ctx.fillText('PAUSED', W / 2, H / 2 - 10);
    ctx.font = '22px VT323, monospace'; ctx.fillStyle = '#e8f6ff'; ctx.fillText(touchUsed ? 'Tap ❚❚ to keep playing' : 'Press P to keep playing', W / 2, H / 2 + 26);
    ctx.textAlign = 'left';
  }
}
// show the pause/mute/menu buttons during a game; update their icons only when something changed
let hudBtnsKey = '';
function syncHudBtns() {
  const on = !!G && G.state !== 'over' && G.state !== 'finale';
  const key = `${on}|${on && G.paused}|${Sound.on}`;
  if (key === hudBtnsKey) return;
  hudBtnsKey = key;
  document.getElementById('hudBtns').classList.toggle('on', on);
  const pb = document.getElementById('pauseBtn'), mb = document.getElementById('muteBtn');
  pb.textContent = on && G.paused ? '▶' : '❚❚'; pb.setAttribute('aria-label', on && G.paused ? 'Resume' : 'Pause');
  mb.textContent = Sound.on ? '♪' : '✕'; mb.setAttribute('aria-label', Sound.on ? 'Sound is on; turn it off' : 'Sound is off; turn it on');
  if (on) layoutHudBtns();
}

// ============================================================ game over & menus
function gameOver() {
  G.state = 'over';
  const hi = store.get('ca_hi', 0); if (G.score > hi) store.set('ca_hi', G.score);
  document.getElementById('overTitle').textContent = G.score > hi ? 'NEW HIGH SCORE' : 'GAME OVER';
  document.getElementById('overStats').textContent = `SCORE ${G.score}   ANSWERED ${G.solved}   LEVEL ${G.level}`;
  const ul = document.getElementById('missedList'); ul.innerHTML = '';
  const missed = [...G.missed.values()];
  document.getElementById('missedHead').textContent = missed.length ? 'REVIEW THESE' : 'NO MISSES. NICE.';
  missed.forEach(t => {
    const li = document.createElement('li');
    li.innerHTML = '<b></b> <span class="sub"></span><br><span class="c"></span>';
    li.querySelector('b').textContent = t.term;
    li.querySelector('.sub').textContent = t.group ? `(${t.where})` : `(Section ${t.section})`;
    li.querySelector('.c').textContent = t.review || t.clue;
    ul.appendChild(li);
  });
  document.getElementById('over').classList.remove('hidden');
}
function buildMenu() {
  const list = document.getElementById('chapterList'); list.innerHTML = '';
  const chs = [...new Set(BANK.map(t => t.chapter))].sort((a, b) => a - b);
  chs.forEach(ch => {
    const n = BANK.filter(t => t.chapter === ch).length;
    const lab = document.createElement('label'); lab.title = CH_NAMES[ch] || '';
    lab.innerHTML = `<input type="checkbox" ${selected.has(ch) ? 'checked' : ''}> Ch ${ch} <span class="sub">(${n})</span>`;
    lab.querySelector('input').onchange = e => { e.target.checked ? selected.add(ch) : selected.delete(ch); updCount(); };
    list.appendChild(lab);
  });
  document.getElementById('allBtn').onclick = () => { chs.forEach(c => selected.add(c)); buildMenu(); };
  document.getElementById('noneBtn').onclick = () => { selected.clear(); buildMenu(); };
  // free play buttons, one per stage
  const fp = document.getElementById('freePlay'); fp.innerHTML = '';
  STAGES.forEach((s, i) => {
    const b = document.createElement('button'); b.className = 'cart'; b.dataset.needsTerms = '1';
    b.title = 'Free play: ' + s.name; b.setAttribute('aria-label', 'Free play: ' + s.name);
    b.style.setProperty('--c', s.color); b.innerHTML = cartSVG(s);
    b.onclick = () => { Sound.init(); Sound.thud(); setTimeout(() => start('free', i), 160); };   // "clunk" as the cart goes in
    fp.appendChild(b);
  });
  updCount();
  const hs = store.get('ca_hi', 0); document.getElementById('hiScore').textContent = hs ? `HIGH SCORE ${hs}` : '';
}
// An original 8-bit game cartridge drawn in SVG: grey shell, grip ridges, gold contacts, and a
// coloured label with the stage's pixel sprite (stage.cart.icon) and name.
function cartSVG(s) {
  const r = (x, y, w, h, f, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}" ${extra}/>`;
  let out = '';
  out += r(4, 0, 36, 2, '#3a3f4b') + r(2, 2, 40, 48, '#3a3f4b');          // shell with notched top corners
  out += r(2, 2, 2, 48, '#565d6d') + r(40, 2, 2, 48, '#22252d') + r(4, 0, 36, 1, '#565d6d');
  out += r(6, 8, 32, 31, s.color) + r(6, 8, 32, 2, 'rgba(255,255,255,.35)') + r(6, 37, 32, 2, 'rgba(0,0,0,.25)');   // label
  for (let y = 42; y <= 46; y += 2) out += r(8, y, 28, 1, '#22252d');      // grip ridges
  out += r(8, 50, 28, 4, '#22252d');                                       // edge connector
  for (let x = 10; x <= 33; x += 3) out += r(x, 51, 1.5, 2.5, '#c9a227');
  // pixel sprite, centred on the label
  const icon = (s.cart && s.cart.icon) || [], pal = (s.cart && s.cart.pal) || {};
  const rows = icon.length, cols = rows ? Math.max(...icon.map(l => l.length)) : 0;
  if (rows) {
    const px = Math.min(24 / cols, 15 / rows), ox = 22 - cols * px / 2, oy = 20.5 - rows * px / 2;
    icon.forEach((line, y) => [...line].forEach((ch, x) => { if (pal[ch]) out += r(ox + x * px, oy + y * px, px + 0.05, px + 0.05, pal[ch]); }));
  }
  out += `<text x="22" y="35.6" text-anchor="middle" font-family="'Press Start 2P', monospace" font-size="${Math.min(3.2, 30 / s.name.length).toFixed(2)}" fill="#000">${s.name}</text>`;
  return `<svg viewBox="0 0 44 54" width="110" height="135" shape-rendering="crispEdges" aria-hidden="true">${out}</svg>`;
}
function updCount() {
  const n = BANK.filter(t => selected.has(t.chapter)).length;
  document.getElementById('poolCount').textContent = `${n} terms selected`;
  // any selection can be played: short chapters borrow wrong answers from the others (E.distractors)
  document.querySelectorAll('#startBtn, [data-needs-terms]').forEach(b => { b.disabled = n < 1; });
  const note = document.getElementById('chapterNote');
  if (selected.size === 1 && n < 6) {
    const ch = [...selected][0];
    note.textContent = `Chapter ${ch} has ${n} term${n === 1 ? '' : 's'}; other chapters' terms will appear as wrong answers.`;
  } else note.textContent = '';
}
function syncButtons() {
  document.getElementById('soundBtn').textContent = 'SOUND: ' + (Sound.on ? 'ON' : 'OFF');
  document.getElementById('musicBtn').textContent = 'MUSIC: ' + (Sound.music ? 'ON' : 'OFF');
  document.getElementById('voiceBtn').textContent = 'ROBOT VOICE: ' + (Voice.on ? 'ON' : 'OFF');
  document.getElementById('readBtn').textContent = 'PAUSE TO READ: ' + (readFirst ? 'ON' : 'OFF');
}
function start(mode, idx) {
  Sound.init();
  if (document.activeElement) document.activeElement.blur();   // so SPACE doesn't re-click a button
  document.getElementById('menu').classList.add('hidden'); document.getElementById('over').classList.add('hidden');
  newGame(mode, idx);
}
function bootArcade() {
  document.getElementById('startBtn').onclick = () => start('arcade', 0);
  document.getElementById('againBtn').onclick = () => start(G ? G.mode : 'arcade', G && G.mode === 'free' ? G.stageIdx : 0);
  const toMenu = () => { G = null; document.getElementById('over').classList.add('hidden'); document.getElementById('menu').classList.remove('hidden'); buildMenu(); };
  document.getElementById('menuBtn').onclick = toMenu;
  // on-screen buttons (touch screens have no P or M key); blur so SPACE never re-presses them
  const tap = (id, fn) => { const b = document.getElementById(id); b.onclick = () => { Sound.init(); fn(); b.blur(); }; };
  tap('pauseBtn', () => { if (G && G.state !== 'over') G.paused = !G.paused; });
  tap('muteBtn', () => { Sound.toggle(); syncButtons(); });
  let quitArm = -Infinity;   // leaving takes two taps within 3 s, so a stray tap cannot end a game
  tap('quitBtn', () => {
    if (!G) return;
    if (performance.now() - quitArm < 3000) { quitArm = -Infinity; toMenu(); return; }
    quitArm = performance.now();
    E.banner('TAP ☰ AGAIN FOR THE MENU', '#ffd23f', 'This game will end.', 3);
  });
  document.getElementById('soundBtn').onclick = () => { Sound.init(); Sound.toggle(); syncButtons(); };
  document.getElementById('musicBtn').onclick = () => { Sound.toggleMusic(); syncButtons(); };
  document.getElementById('voiceBtn').onclick = () => { Voice.toggle(); syncButtons(); };
  document.getElementById('readBtn').onclick = () => { readFirst = !readFirst; store.set('ca_readfirst', readFirst); syncButtons(); };
  // sound test: each stage's sounds, played on that stage's emulated chip
  const CHIP_NAMES = { arcade: 'arcade board', sn: 'SN76489', tia: 'Atari TIA' };
  const soundOn = () => { Sound.init(); if (!Sound.on) { Sound.toggle(); syncButtons(); } };
  const box = document.getElementById('soundTest'); box.style.display = 'block';
  STAGES.forEach(s => {
    const row = document.createElement('div'); row.className = 'row';
    const lab = document.createElement('span'); lab.className = 'sub'; lab.style.minWidth = '170px';
    lab.textContent = `${s.name} (${CHIP_NAMES[s.chip] || s.chip})`; lab.style.color = s.color; row.appendChild(lab);
    Sound.sounds(s.chip).forEach(name => {
      const b = document.createElement('button'); b.className = 'small'; b.textContent = name.replace(/([A-Z])/g, ' $1').toUpperCase();
      b.onclick = () => { soundOn(); Sound.playOn(s.chip, name); }; row.appendChild(b);
    });
    if (s.chip === 'sn') {
      const b = document.createElement('button'); b.className = 'small'; b.textContent = 'TUNE';
      b.onclick = () => { soundOn(); for (let i = 0; i < 32; i++) setTimeout(() => Sound.musicStep(), i * 150); }; row.appendChild(b);
    }
    box.appendChild(row);
  });
  syncButtons(); buildMenu();
  // ?stage=<id> opens one stage straight away in free play (e.g. ?stage=robo-lab); the old
  // stand-alone Robo-Lab and Mole Hole pages forward here this way, so their links keep working
  const wanted = STAGES.findIndex(s => s.id === new URLSearchParams(location.search).get('stage'));
  if (wanted >= 0) start('free', wanted);
  // Wait for the (embedded) fonts before the first frame, so canvas text never starts in a fallback
  // font and swaps mid-read; give up after 3 s so the game still starts if they cannot load.
  const fontLoads = document.fonts && document.fonts.load
    ? Promise.all([document.fonts.load('20px VT323'), document.fonts.load('12px "Press Start 2P"')]) : Promise.resolve();
  Promise.race([fontLoads, new Promise(r => setTimeout(r, 3000))]).catch(() => {}).then(() => {
    let lastT = performance.now();
    (function frame(now) { const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; update(dt); draw(); requestAnimationFrame(frame); })(lastT);
  });
}
