// Periodic Panic engine: the canvas, sound, controls, term bank, clue bar, scoring, and the
// arcade flow that warps from one stage (game) to the next. Each stage plugs in with
// registerStage() and talks back through E (correct, wrong, kill, nextRound ...).
"use strict";

// ============================================================ canvas & helpers
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const W = 800, H = 600, HUD_H = 92;
function fit() { const s = Math.min(innerWidth / W, innerHeight / H); cv.style.width = W * s + 'px'; cv.style.height = H * s + 'px'; }
addEventListener('resize', fit); fit();

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
function wrapText(text, maxW, font) {
  ctx.font = font; const words = text.split(' '), lines = []; let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line); return lines;
}

// ============================================================ sound (all synthesized, no samples)
// Early-80s style: square waves, stepped pitch sweeps, sample-and-hold noise, an 8-bit quantizer.
const Sound = (() => {
  let ac = null, master = null, on = store.get('ca_sound', true), music = store.get('ca_music', true);
  function init() {
    if (ac) return;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.3;
      const crush = ac.createWaveShaper(), n = 2048, curve = new Float32Array(n), steps = 12;
      for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; curve[i] = Math.round(x * steps) / steps; }
      crush.curve = curve; master.connect(crush); crush.connect(ac.destination);
    } catch (e) { ac = null; }
  }
  const ready = () => ac && on;
  function sweep({ type = 'square', f0, f1 = f0, dur, vol = 0.3, delay = 0, steps = 12, lin = false }) {
    if (!ready()) return;
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    for (let i = 0; i <= steps; i++) { const k = i / steps; o.frequency.setValueAtTime(lin ? f0 + (f1 - f0) * k : f0 * Math.pow(f1 / f0, k), t + k * dur); }
    g.gain.setValueAtTime(vol, t); g.gain.setValueAtTime(vol, t + dur * 0.75); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.03);
  }
  function noise({ dur = 0.45, vol = 0.5, hold0 = 1, hold1 = 36, cutoff = 5000, delay = 0 }) {
    if (!ready()) return;
    const t = ac.currentTime + delay, n = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0); let v = 0;
    for (let i = 0; i < n; i++) { const hold = Math.max(1, Math.round(hold0 + (hold1 - hold0) * i / n)); if (i % hold === 0) v = Math.random() < 0.5 ? -1 : 1; d[i] = v; }
    const s = ac.createBufferSource(); s.buffer = buf;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff;
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(lp); lp.connect(g); g.connect(master); s.start(t);
  }
  function buzz({ f0, f1 = f0, dur, rate = 28, depth = 0.6, vol = 0.3, delay = 0 }) {
    if (!ready()) return;
    const t = ac.currentTime + delay, o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(), g = ac.createGain();
    o.type = 'square'; lfo.type = 'square';
    o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f1, t + dur);
    lfo.frequency.setValueAtTime(rate, t); lfo.frequency.linearRampToValueAtTime(rate * 0.5, t + dur);
    lg.gain.value = f0 * depth; lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(vol, t); g.gain.setValueAtTime(vol, t + dur * 0.8); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(master); o.start(t); lfo.start(t); o.stop(t + dur + 0.03); lfo.stop(t + dur + 0.03);
  }
  // Mole Hole's original tune, played one step at a time while the mole moves (MIDI numbers, 0 = rest)
  const MEL = [72, 0, 76, 79, 77, 0, 74, 77, 76, 0, 72, 76, 74, 71, 67, 0, 72, 0, 76, 79, 81, 0, 79, 77, 76, 74, 76, 72, 74, 0, 72, 0];
  const BASS = [48, 55, 48, 55, 50, 57, 50, 57, 52, 55, 52, 55, 43, 50, 43, 50];
  const midi = m => 440 * Math.pow(2, (m - 69) / 12);
  let step = 0;
  const fx = {
    // shared
    correct()  { [523, 659, 784, 1047, 1319].forEach((f, i) => sweep({ f0: f, dur: 0.07, vol: 0.22, steps: 1, delay: i * 0.065 })); },
    wrong()    { buzz({ f0: 110, f1: 90, dur: 0.38, rate: 14, depth: 0.4, vol: 0.3 }); },
    death()    { buzz({ f0: 220, f1: 110, dur: 1.35, rate: 26, depth: 0.7, vol: 0.32 }); noise({ dur: 1.35, vol: 0.12, hold0: 3, hold1: 20, cutoff: 3000 }); sweep({ f0: 700, f1: 70, dur: 0.45, vol: 0.25, steps: 14, delay: 1.3 }); },
    blip()     { sweep({ f0: 1400, dur: 0.04, vol: 0.18, steps: 1 }); },
    warp()     { for (let i = 0; i < 14; i++) sweep({ f0: 300 + i * 90, f1: 600 + i * 120, dur: 0.06, vol: 0.18, steps: 3, delay: i * 0.05 }); },
    // Robo-Lab
    zap()      { sweep({ f0: 2800, f1: 420, dur: 0.11, vol: 0.28, steps: 10 }); },
    robotZap() { sweep({ type: 'sawtooth', f0: 1300, f1: 330, dur: 0.15, vol: 0.2, steps: 8 }); },
    boom()     { noise({ dur: 0.55, vol: 0.55, hold0: 1, hold1: 40 }); sweep({ f0: 320, f1: 55, dur: 0.3, vol: 0.14, steps: 8 }); },
    radical()  { for (let i = 0; i < 8; i++) sweep({ f0: i % 2 ? 587 : 880, dur: 0.08, vol: 0.22, steps: 1, delay: i * 0.085 }); },
    bounce()   { sweep({ f0: 150, f1: 70, dur: 0.07, vol: 0.18, steps: 4 }); },
    door()     { sweep({ type: 'triangle', f0: 300, f1: 1300, dur: 0.25, vol: 0.3, steps: 10, lin: true }); },
    exit()     { sweep({ f0: 1200, f1: 160, dur: 0.32, vol: 0.2, steps: 16 }); },
    // Mole Hole
    throwBall(){ sweep({ f0: 500, f1: 1600, dur: 0.12, vol: 0.22, steps: 8 }); },
    pop()      { sweep({ f0: 900, f1: 120, dur: 0.22, vol: 0.28, steps: 10 }); noise({ dur: 0.18, vol: 0.25, hold0: 1, hold1: 10 }); },
    electron() { sweep({ f0: 1800, f1: 2400, dur: 0.05, vol: 0.14, steps: 2 }); },
    wobble()   { for (let i = 0; i < 4; i++) sweep({ f0: i % 2 ? 140 : 170, dur: 0.07, vol: 0.18, steps: 1, delay: i * 0.12 }); },
    thud()     { noise({ dur: 0.35, vol: 0.5, hold0: 6, hold1: 50, cutoff: 1500 }); sweep({ f0: 160, f1: 50, dur: 0.25, vol: 0.25, steps: 6 }); },
    crumble()  { noise({ dur: 0.5, vol: 0.45, hold0: 2, hold1: 30 }); },
    spawn()    { sweep({ type: 'sawtooth', f0: 200, f1: 400, dur: 0.18, vol: 0.15, steps: 6 }); },
    digger()   { buzz({ f0: 300, f1: 340, dur: 0.4, rate: 40, depth: 0.3, vol: 0.18 }); },
    clear()    { [523, 784, 659, 1047, 784, 1319, 1568].forEach((f, i) => sweep({ f0: f, dur: 0.09, vol: 0.2, steps: 1, delay: i * 0.09 })); },
    musicStep() {
      if (!ready() || !music) return;
      const m = MEL[step % MEL.length], b = BASS[Math.floor(step / 2) % BASS.length];
      if (m) sweep({ f0: midi(m), dur: 0.12, vol: 0.12, steps: 1 });
      if (step % 2 === 0) sweep({ type: 'triangle', f0: midi(b), dur: 0.2, vol: 0.2, steps: 1 });
      step++;
    }
  };
  return Object.assign({
    init, get on() { return on; }, get music() { return music; },
    toggle() { on = !on; store.set('ca_sound', on); return on; },
    toggleMusic() { music = !music; store.set('ca_music', music); return music; }
  }, fx);
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
const BANK = (window.TERMS || []).filter(t => !(window.SKIP_SECTIONS || []).includes(t.section));
const CH_NAMES = window.CHAPTER_NAMES || {};

// ============================================================ input
const keys = {};
let touchUsed = false, pressLatch = false, fireLatch = false, lastAxisKey = null;
let readFirst = store.get('ca_readfirst', true);
const touchVec = { x: 0, y: 0, fire: false };
addEventListener('keydown', e => {
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
  addEventListener('touchstart', () => { touchUsed = true; document.getElementById('touch').classList.add('on'); }, { once: true, passive: true });
  cv.addEventListener('pointerdown', () => { if (G) G.startReq = true; });
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
  // wrong choices for the current target: mostly from the same chapter so they are tempting
  distractors(target, n) {
    const same = shuffle(G.pool.filter(t => t.id !== target.id && t.chapter === target.chapter));
    const other = shuffle(G.pool.filter(t => t.id !== target.id && t.chapter !== target.chapter));
    const out = [];
    for (const t of [...same.slice(0, Math.ceil(n * 0.6)), ...other, ...same]) {
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
    G.queue.splice(Math.min(3, G.queue.length), 0, G.target);   // it comes back soon
    E.banner('NOPE: ' + term.term.toUpperCase(), '#ff4d6d', term.clue, 4.2);
  },
  skip() {   // left the round without answering
    G.missed.set(G.target.id, G.target);
    G.queue.splice(Math.min(2, G.queue.length), 0, G.target);
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

function nextTarget() { if (!G.queue.length) G.queue = shuffle(G.pool.slice()); return G.queue.shift(); }
function setReady() { G.ready = readFirst; G.armed = false; G.startReq = false; }
let selected = new Set(store.get('ca_chapters', [...new Set(BANK.map(t => t.chapter))]));

function newGame(mode, stageIdx) {
  const pool = BANK.filter(t => selected.has(t.chapter));
  store.set('ca_chapters', [...selected]);
  G = { mode, stageIdx: 0, stage: null, pool, queue: shuffle(pool.slice()), score: 0, lives: 5, level: 1, loop: 1,
        solved: 0, stageSolved: 0, missed: new Map(), state: 'card', cardT: 0, paused: false, t: 0,
        particles: [], banner: null, nextLifeAt: 5000, ready: false, armed: false, startReq: false, target: null };
  startStage(stageIdx || 0, false);
}
function startStage(idx, warp) {
  G.stageIdx = idx; G.stage = STAGES[idx]; G.stageSolved = 0;
  G.target = nextTarget();
  G.stage.start(G.target, { fresh: true });
  G.state = 'card'; G.cardT = 2.8; G.warp = warp; G.banner = null; G.startReq = false; pressLatch = false;
  if (warp) Sound.warp();
}

function update(dt) {
  if (!G || G.state === 'over' || G.paused) return;
  G.t += dt;
  G.particles = G.particles.filter(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.95; p.vy *= 0.95; return (p.life -= dt) > 0; });
  if (G.banner && (G.banner.t -= dt) <= 0) G.banner = null;
  if (G.state === 'card') {
    G.cardT -= dt;
    // a key press can skip the title card after a moment
    if (G.cardT <= 0 || (G.cardT < 2 && (pressLatch || G.startReq))) { G.state = 'play'; setReady(); }
    pressLatch = false; G.startReq = false;
    return;
  }
  const inp = readInput();
  if (G.ready) {
    if (!G.armed) { G.armed = true; pressLatch = false; }
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
  ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.font = '10px "Press Start 2P"';
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
  const lines = wrapText(G.target.clue, W - 170, '26px VT323');
  ctx.font = '26px VT323'; ctx.fillStyle = S.isSolved && S.isSolved() ? '#38f0c8' : '#ffd23f';
  lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, 14, 28 + i * 26));
}
function drawBanner() {
  const b = G.banner; if (!b) return;
  ctx.globalAlpha = clamp(b.t * 3, 0, 1);
  const subLines = b.sub ? wrapText(b.sub, W - 180, '24px VT323') : [];
  const bh = 44 + subLines.length * 24, by = H - bh - 22;
  ctx.fillStyle = 'rgba(0,0,0,.88)'; ctx.fillRect(70, by, W - 140, bh);
  ctx.strokeStyle = b.color; ctx.lineWidth = 2; ctx.strokeRect(70, by, W - 140, bh);
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.font = '14px "Press Start 2P"'; ctx.fillStyle = b.color; ctx.fillText(b.text, W / 2, by + 12);
  ctx.font = '24px VT323'; ctx.fillStyle = '#e8f6ff'; subLines.forEach((l, i) => ctx.fillText(l, W / 2, by + 34 + i * 24));
  ctx.textAlign = 'left'; ctx.globalAlpha = 1;
}
function drawCard() {
  // stage title card (start of game and every warp)
  const S = G.stage, k = clamp((2.8 - G.cardT) * 3, 0, 1);
  ctx.fillStyle = `rgba(0,0,0,${0.85 * k})`; ctx.fillRect(0, 0, W, H);
  if (G.warp) {   // streaking stars for the warp
    for (let i = 0; i < 60; i++) {
      const a = i * 2.39996, r = ((G.t * 400 + i * 37) % 500), x = W / 2 + Math.cos(a) * r, y = H / 2 + Math.sin(a) * r;
      ctx.fillStyle = i % 3 ? '#5d6b80' : S.color; ctx.fillRect(x, y, 2 + r / 120, 2 + r / 120);
    }
  }
  ctx.globalAlpha = k; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.font = '12px "Press Start 2P"'; ctx.fillStyle = '#5d6b80';
  const label = G.mode === 'arcade' ? `STAGE ${G.stageIdx + 1} OF ${STAGES.length}` + (G.loop > 1 ? `  ·  LOOP ${G.loop}` : '') : 'FREE PLAY';
  ctx.fillText(G.warp ? 'WARP!  ' + label : label, W / 2, 170);
  ctx.font = '40px "Press Start 2P"'; ctx.fillStyle = S.color; ctx.fillText(S.name, W / 2, 205);
  ctx.font = '26px VT323'; ctx.fillStyle = '#e8f6ff';
  S.howTo.forEach((l, i) => ctx.fillText(l, W / 2, 285 + i * 30));
  if (G.mode === 'arcade') { ctx.fillStyle = '#5d6b80'; ctx.fillText(`${ROUNDS_PER_STAGE} correct answers warp you to the next stage.`, W / 2, 285 + S.howTo.length * 30 + 20); }
  ctx.textAlign = 'left'; ctx.globalAlpha = 1;
}
function draw() {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (!G) return;
  G.stage.draw();
  for (const p of G.particles) { ctx.globalAlpha = clamp(p.life * 1.5, 0, 1); ctx.fillStyle = p.color; ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); }
  ctx.globalAlpha = 1;
  drawHUD();
  drawBanner();
  if (G.state === 'card') drawCard();
  if (G.paused) {
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.font = '22px "Press Start 2P"'; ctx.fillStyle = '#ffd23f'; ctx.fillText('PAUSED', W / 2, H / 2 - 10); ctx.textAlign = 'left';
  }
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
    li.querySelector('.sub').textContent = `(Section ${t.section})`;
    li.querySelector('.c').textContent = t.clue;
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
  out += `<text x="22" y="35.6" text-anchor="middle" font-family="'Press Start 2P', monospace" font-size="3.2" fill="#000">${s.name}</text>`;
  return `<svg viewBox="0 0 44 54" width="110" height="135" shape-rendering="crispEdges" aria-hidden="true">${out}</svg>`;
}
function updCount() {
  const n = BANK.filter(t => selected.has(t.chapter)).length;
  document.getElementById('poolCount').textContent = `${n} terms selected`;
  document.querySelectorAll('#startBtn, [data-needs-terms]').forEach(b => { b.disabled = n < 4; });
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
  document.getElementById('menuBtn').onclick = () => { G = null; document.getElementById('over').classList.add('hidden'); document.getElementById('menu').classList.remove('hidden'); buildMenu(); };
  document.getElementById('soundBtn').onclick = () => { Sound.init(); Sound.toggle(); syncButtons(); };
  document.getElementById('musicBtn').onclick = () => { Sound.toggleMusic(); syncButtons(); };
  document.getElementById('voiceBtn').onclick = () => { Voice.toggle(); syncButtons(); };
  document.getElementById('readBtn').onclick = () => { readFirst = !readFirst; store.set('ca_readfirst', readFirst); syncButtons(); };
  const tests = [['LASER', 'zap'], ['ROBOT SHOT', 'robotZap'], ['EXPLOSION', 'boom'], ['RADICAL', 'radical'], ['DOORS', 'door'], ['EXIT', 'exit'],
    ['CATALYST', 'throwBall'], ['POP', 'pop'], ['ELECTRON', 'electron'], ['WOBBLE', 'wobble'], ['THUD', 'thud'], ['CRUMBLE', 'crumble'], ['DIGGER', 'digger'],
    ['CORRECT', 'correct'], ['WRONG', 'wrong'], ['DEATH', 'death'], ['WARP', 'warp']];
  tests.forEach(([label, fn]) => {
    const b = document.createElement('button'); b.className = 'small'; b.textContent = label;
    b.onclick = () => { Sound.init(); if (!Sound.on) { Sound.toggle(); syncButtons(); } Sound[fn](); };
    document.getElementById('soundTest').appendChild(b);
  });
  const mb = document.createElement('button'); mb.className = 'small'; mb.textContent = 'MOLE TUNE';
  mb.onclick = () => { Sound.init(); if (!Sound.on) { Sound.toggle(); syncButtons(); } for (let i = 0; i < 32; i++) setTimeout(() => Sound.musicStep(), i * 150); };
  document.getElementById('soundTest').appendChild(mb);
  syncButtons(); buildMenu();
  let lastT = performance.now();
  (function frame(now) { const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; update(dt); draw(); requestAnimationFrame(frame); })(lastT);
}
