// Stage: JUNGLE JUMP, an early-80s style jungle runner. Grab the treasure labeled with the matching term.
(() => {
"use strict";
const GY = 470;                    // top of the ground
const PIT_L = 320, PIT_R = 520;    // the hazard in the middle of every screen
const WATER_Y = 488;               // water / tar surface
const EXIT_X = 770;                // bushes block the way out until the answer is found
const CROCS = [360, 420, 480];     // crocodile head centres
const HEAD_W = 40, HEAD_Y = 480;
const METALS = [['#ffd23f', '#fff1a8'], ['#c9d1da', '#ffffff'], ['#e08a4a', '#ffc79a']];   // gold, silver, copper ingots
let S = null, P = null;            // screen and player

function buildScreen(target) {
  const kinds = ['vine', 'croc', 'tar'].filter(k => !S || k !== S.kind);
  const kind = pick(kinds);
  // three ingots: at least one on each side of the hazard
  const terms = shuffle([target, ...E.distractors(target, 2)]);
  const leftCount = ri(1, 2), slots = [];
  const place = (lo, hi) => { for (let t = 0; t < 50; t++) { const x = ri(lo, hi); if (slots.every(s => Math.abs(s - x) > 70)) { slots.push(x); return; } } slots.push(ri(lo, hi)); };
  for (let i = 0; i < 3; i++) i < leftCount ? place(110, 280) : place(565, 740);
  const treasures = terms.map((term, i) => ({ term, x: slots[i], broken: false, metal: METALS[i % 3] }));
  S = { kind, target, treasures, logs: [], logT: 2.5, solved: false, wrongs: 0, reveal: false, t: 0 };
  resetPlayer();
}
function resetPlayer() {
  P = { x: 40, y: GY, vx: 0, vy: 0, onGround: true, face: 1, state: 'ground', stun: 0, knock: 0, inv: 1.2,
        walk: 0, dead: 0, burst: false, sinking: false, grabCool: 0, prevJump: true };
  S.logs = []; S.logT = 2.5;
}

// ---------- the hazards
const lv = () => E.level;
function vineState() {
  const L = 250, ax = 420, ay = 150, w = 2 * Math.PI / 3.2 * (1 + lv() * 0.05), A = 0.72;
  const th = A * Math.sin(S.t * w), dth = A * w * Math.cos(S.t * w);
  return { ax, ay, L, th, x: ax + L * Math.sin(th), y: ay + L * Math.cos(th), vx: L * Math.cos(th) * dth, vy: -L * Math.sin(th) * dth };
}
// How far the crocodiles' jaws are open, 0 to 1. Shut ~3 s, creep open ~0.8 s (a warning, still safe),
// fully open ~1 s (dangerous), then snap shut. Speeds up a little with each level.
function crocJaw() {
  const sp = 1 + lv() * 0.03, shut = 3.0 / sp, opening = 0.8 / sp, open = 1.0 / sp, closing = 0.3 / sp;
  const k = S.t % (shut + opening + open + closing);
  if (k < shut) return 0;
  if (k < shut + opening) return (k - shut) / opening * 0.85;   // creeping open: not dangerous yet
  if (k < shut + opening + open) return 1;
  return 1 - (k - shut - opening - open) / closing;
}
const crocOpen = () => crocJaw() >= 1;   // only a fully open mouth bites
function tarHalf() {   // the tar pit opens and closes: 0 = closed, 100 = fully open
  const per = 4.5, k = S.t % per;
  if (k < 1.3) return 0; if (k < 1.8) return (k - 1.3) / 0.5 * 100; if (k < 4.0) return 100; return (1 - (k - 4.0) / 0.5) * 100;
}
// ground height under x, or null over open water/tar
function surfaceAt(x) {
  if (x < PIT_L || x > PIT_R) return GY;
  if (S.kind === 'vine') return null;
  if (S.kind === 'croc') return CROCS.some(c => Math.abs(x - c) < HEAD_W / 2) ? HEAD_Y : null;
  return Math.abs(x - 420) < tarHalf() ? null : GY;
}

function killPlayer(why, sink) { if (P.dead > 0) return; P.dead = 2.2; P.burst = false; P.sinking = !!sink; P.state = 'dead'; E.kill(why); }

function grabTreasure(tr) {
  tr.broken = true;
  if (tr.term.id === S.target.id) {
    S.solved = true;
    const pts = Math.max(200, 800 + lv() * 100 - S.wrongs * 200);
    E.correct(pts); Sound.correct();
    for (let i = 0; i < 3; i++) E.particles(tr.x, GY - 10, tr.metal[i % 2], 20, 200);
  } else {
    S.wrongs++; if (S.wrongs >= 2) S.reveal = true;
    E.particles(tr.x, GY - 8, '#8a7a5a', 30, 140); Sound.crumble();
    E.wrong(tr.term, 100);
  }
}

// ---------- drawing
function drawExplorer(x, feet, face, walk, col) {
  // explorer in a pith helmet and lab goggles (original sprite)
  ctx.save(); ctx.translate(Math.round(x), Math.round(feet)); ctx.scale(face, 1);
  const k = Math.sin(walk) * 5;
  ctx.fillStyle = col || '#6b4a2a';                                      // trousers / legs
  ctx.fillRect(-5, -13, 4, 13 + Math.min(0, k * 0.2)); ctx.fillRect(1, -13, 4, 13);
  ctx.fillRect(-5 + k * 0.6, -4, 4, 4); ctx.fillRect(1 - k * 0.6, -4, 4, 4);
  ctx.fillStyle = col || '#3f8a3a'; ctx.fillRect(-6, -25, 12, 13);      // shirt
  ctx.fillRect(-9 + (walk ? k * 0.3 : 0), -24, 3, 9); ctx.fillRect(6 - (walk ? k * 0.3 : 0), -24, 3, 9);
  ctx.fillStyle = col || '#f0c090'; ctx.fillRect(-4, -33, 8, 8);         // face
  ctx.fillStyle = '#38f0c8'; ctx.fillRect(0, -31, 4, 2);                 // goggles
  ctx.fillStyle = col || '#e8d39a'; ctx.fillRect(-7, -36, 14, 3); ctx.fillRect(-4, -39, 8, 3);   // helmet
  ctx.restore();
}
function drawBackground() {
  const g = ctx.createLinearGradient(0, HUD_H, 0, GY);
  g.addColorStop(0, '#0a2410'); g.addColorStop(1, '#16421d');
  ctx.fillStyle = g; ctx.fillRect(0, HUD_H, W, GY - HUD_H);
  ctx.fillStyle = '#3d2610';
  for (const x of [50, 190, 260, 610, 700]) ctx.fillRect(x, 140, 16, GY - 140);
  for (let i = 0; i < 22; i++) {   // canopy
    ctx.fillStyle = i % 2 ? '#1f6b2a' : '#2a8a35';
    ctx.beginPath(); ctx.arc(i * 38 + 10, 128 + (i % 3) * 8, 30, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#1f6b2a'; ctx.fillRect(0, HUD_H, W, 30);
  // ground band and the underground below
  ctx.fillStyle = '#c9a33a'; ctx.fillRect(0, GY, W, 20);
  ctx.fillStyle = '#e3c35a'; ctx.fillRect(0, GY, W, 3);
  ctx.fillStyle = '#3a2810'; ctx.fillRect(0, GY + 20, W, H - GY - 20);
  ctx.fillStyle = '#2a1c0a';
  for (let y = GY + 30; y < H; y += 18) for (let x = ((y / 18) % 2) * 20; x < W; x += 40) ctx.fillRect(x, y, 38, 2);
}
function drawHazard() {
  const t = E.time;
  if (S.kind === 'tar') {
    const h = tarHalf();
    // a dark, cracked crust marks where the tar pit opens
    ctx.fillStyle = '#7a6420'; ctx.fillRect(PIT_L, GY, PIT_R - PIT_L, 20);
    ctx.fillStyle = '#3a2e10';
    for (let x = PIT_L + 6; x < PIT_R - 6; x += 22) { ctx.fillRect(x, GY + 4 + (x % 3) * 3, 12, 2); ctx.fillRect(x + 8, GY + 9 + (x % 2) * 4, 2, 6); }
    if (h > 0) {
      ctx.fillStyle = '#0c0c0c'; ctx.fillRect(420 - h, GY, h * 2, 60);
      ctx.fillStyle = '#262626';
      for (let i = 0; i < 4; i++) { const bx = 420 - h + ((t * 30 + i * 47) % (h * 2 || 1)); ctx.beginPath(); ctx.arc(bx, GY + 8 + (i % 2) * 6, 3, 0, Math.PI * 2); ctx.fill(); }
    }
    return;
  }
  // water pit
  ctx.fillStyle = '#1b1208'; ctx.fillRect(PIT_L, GY, PIT_R - PIT_L, 70);
  ctx.fillStyle = '#1f5fbf'; ctx.fillRect(PIT_L, WATER_Y, PIT_R - PIT_L, 52);
  ctx.fillStyle = '#5a9be8';
  for (let x = PIT_L; x < PIT_R; x += 16) ctx.fillRect(x + ((t * 20) % 16), WATER_Y + 2 + Math.sin(t * 3 + x) * 1.5, 8, 2);
  if (S.kind === 'croc') {
    const jaw = crocJaw(), bite = jaw >= 1;
    for (const c of CROCS) {
      ctx.fillStyle = '#2f7d32'; ctx.fillRect(c - HEAD_W / 2, HEAD_Y, HEAD_W, 9);          // lower jaw / head
      ctx.fillStyle = '#ffffff'; for (let i = 0; i < 5; i++) ctx.fillRect(c - 15 + i * 7, HEAD_Y - 2, 3, 3);
      // upper jaw hinges open from the back of the head; the eye turns red while it is dangerous
      ctx.save(); ctx.translate(c - HEAD_W / 2, HEAD_Y); ctx.rotate(-0.6 * jaw);
      ctx.fillStyle = '#3c9a3e'; ctx.fillRect(0, -8, HEAD_W, 7);
      ctx.fillStyle = '#ffffff'; for (let i = 0; i < 5; i++) ctx.fillRect(5 + i * 7, -1, 3, 3);
      ctx.fillStyle = bite ? '#ff4d6d' : (jaw > 0 && Math.floor(E.time * 10) % 2 ? '#ff8c42' : '#ffd23f');
      ctx.fillRect(4, -12, 5, 4);
      ctx.restore();
    }
  }
}
function drawVine() {
  const v = vineState();
  ctx.strokeStyle = '#5a8f2a'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(v.ax, v.ay);
  ctx.quadraticCurveTo((v.ax + v.x) / 2 + Math.sin(v.th) * 10, (v.ay + v.y) / 2, v.x, v.y); ctx.stroke();
  ctx.fillStyle = '#2a8a35'; ctx.beginPath(); ctx.arc(v.x, v.y, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3d2610'; ctx.fillRect(v.ax - 40, v.ay - 6, 80, 8);   // branch
}
function drawTreasure(tr) {
  const glow = S.reveal && tr.term.id === S.target.id, [c, hi] = tr.metal, y = GY;
  ctx.save();
  if (glow) { ctx.shadowColor = '#38f0c8'; ctx.shadowBlur = 16 + Math.sin(E.time * 8) * 8; }
  ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(tr.x - 14, y); ctx.lineTo(tr.x + 14, y); ctx.lineTo(tr.x + 9, y - 12); ctx.lineTo(tr.x - 9, y - 12); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0; ctx.fillStyle = hi; ctx.fillRect(tr.x - 7, y - 10, 9, 2);
  if (Math.floor(E.time * 2 + tr.x) % 4 === 0) { ctx.fillStyle = '#fff'; ctx.fillRect(tr.x + 5, y - 15, 2, 2); }
  ctx.restore();
  // full-term label (placed by layoutTreasureLabels) with a thin line down to its ingot
  const L = tr.lab; if (!L) return;
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(tr.x, L.y + L.h); ctx.lineTo(tr.x, y - 16); ctx.stroke();
  drawFittedLabel(tr.fit, L.x, L.y, glow ? '#38f0c8' : '#fff4e6', c);
}
// Labels show the full term (up to two lines) above each ingot; when two would collide, the later
// one is lifted above the other, so they stack instead of overlapping.
function layoutTreasureLabels() {
  const placed = [];
  for (const tr of S.treasures.filter(t => !t.broken).sort((a, b) => a.x - b.x)) {
    if (!tr.fit) tr.fit = fitLabel(tr.term.term, 170, 20);
    const bw = tr.fit.w + 8, bh = tr.fit.h + 3;
    const box = { x: clamp(tr.x - bw / 2, 6, W - bw - 6), y: GY - 46 - bh, w: bw, h: bh };
    let moved = true;
    while (moved) { moved = false; for (const p of placed) if (box.x < p.x + p.w + 4 && box.x + box.w + 4 > p.x && box.y < p.y + p.h + 4 && box.y + box.h + 4 > p.y) { box.y = p.y - bh - 6; moved = true; } }
    tr.lab = box; placed.push(box);
  }
}
function drawLog(l) {
  ctx.save(); ctx.translate(l.x, l.y - 12); ctx.rotate(l.rot);
  ctx.fillStyle = '#7a4a1e'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#4a2a0e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#4a2a0e'; ctx.fillRect(-1, -12, 2, 6);
  ctx.restore();
}
function drawExit() {
  if (!S.solved) {
    for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? '#1f6b2a' : '#2a8a35'; ctx.beginPath(); ctx.arc(EXIT_X + 12 + (i % 2) * 10, GY - 10 - i * 14, 18, 0, Math.PI * 2); ctx.fill(); }
  } else if (Math.floor(E.time * 3) % 2) {
    ctx.fillStyle = '#38f0c8'; ctx.font = '16px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('▶', EXIT_X + 10, GY - 30); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  }
}

registerStage({
  id: 'jungle-jump', name: 'JUNGLE JUMP', color: '#7cd34a', hudLabel: 'GRAB THE TERM:', fourWay: false, chip: 'tia',
  howTo: ['Grab the treasure labeled with the term that matches the clue.', 'Run: arrows or WASD.  Jump: space or up.  Let go of a vine: space.', 'Jump the rolling logs, and don\'t fall in!'],
  cart: {
    icon: ['.gg.gg......',
           'gggggggggg..',
           'gygggggggggg',
           'gggggggggggg',
           '.w.w.w.w.w..',
           '............',
           '.w.w.w.w.w..',
           'gggggggggggg',
           '.gggggggggg.'],
    pal: { g: '#1f5a22', y: '#ffd23f', w: '#ffffff' }
  },
  start(target) { buildScreen(target); },
  respawn() { if (S.solved) return E.nextRound(); resetPlayer(); },
  isDying: () => P && P.dead > 0,
  isSolved: () => S && S.solved,
  _debug: () => ({ S, P, vineState, buildScreen }),   // for automated tests

  update(dt, inp) {
    S.t += dt;
    // logs keep rolling, even during a death
    S.logT -= dt;
    if (S.logT <= 0 && P.dead <= 0) { S.logs.push({ x: EXIT_X - 4, y: GY, rot: 0, vx: -(85 + lv() * 8), falling: false }); S.logT = rand(3, 5) / (1 + lv() * 0.1); }
    for (const l of S.logs) {
      l.x += l.vx * dt; l.rot += l.vx * dt / 12;
      if (!l.falling && l.x < PIT_R && surfaceAt(l.x) === null) l.falling = true;
      if (l.falling) { l.y += 220 * dt; if (l.y > WATER_Y + 10 && !l.splashed) { l.splashed = true; E.particles(l.x, WATER_Y, '#5a9be8', 10, 90); } }
    }
    S.logs = S.logs.filter(l => l.x > -20 && l.y < WATER_Y + 40);

    if (P.dead > 0) {
      P.dead -= dt;
      if (P.sinking) P.y = Math.min(P.y + 18 * dt, WATER_Y + 30);
      if (P.dead < 0.8 && !P.burst) { P.burst = true; if (!P.sinking) E.particles(P.x, P.y - 15, '#7cd34a', 50, 220); }
      if (P.dead <= 0) E.deathDone();
      return;
    }
    P.inv = Math.max(0, P.inv - dt); P.grabCool = Math.max(0, P.grabCool - dt);
    const jumpHeld = inp.fire || inp.y < 0, jumpPressed = jumpHeld && !P.prevJump; P.prevJump = jumpHeld;

    // swinging on the vine
    if (P.state === 'swing') {
      const v = vineState(); P.x = v.x; P.y = v.y + 28;
      if (jumpPressed || inp.y > 0) { P.state = 'air'; P.vx = v.vx * 0.9; P.vy = Math.min(v.vy, 0) - 60; P.grabCool = 0.5; Sound.jump(); }
      return;
    }
    // run and jump
    if (P.stun > 0) { P.stun -= dt; P.vx = P.knock; P.knock *= 0.9; }
    else { P.vx = inp.x * 140; if (inp.x) P.face = inp.x; }
    if (P.onGround && jumpPressed) { P.vy = -335; P.onGround = false; P.state = 'air'; Sound.jump(); }
    const wasAir = !P.onGround;
    P.vy += 900 * dt; P.x += P.vx * dt; const prevY = P.y; P.y += P.vy * dt;
    if (P.onGround && P.vx) P.walk += dt * 12; else if (P.onGround) P.walk = 0;
    // edges: bushes block the exit until the right treasure is found
    P.x = Math.max(8, P.x);
    if (!S.solved) P.x = Math.min(P.x, EXIT_X - 8);
    else if (P.x > W + 6) { Sound.exit(); return E.nextRound(); }
    // landing
    const surf = surfaceAt(P.x);
    if (surf !== null && P.vy >= 0 && prevY <= surf + 2 && P.y >= surf) {
      P.y = surf; P.vy = 0; if (wasAir && !P.onGround) Sound.land(); P.onGround = true; P.state = 'ground';
    } else if (surf === null || P.y < surf - 1) { P.onGround = false; if (P.state === 'ground') P.state = 'air'; }
    else if (P.onGround) P.y = surf;
    // hazards
    if (S.kind === 'croc' && P.onGround && P.x > PIT_L && P.x < PIT_R && crocOpen()) { Sound.chomp(); return killPlayer('Chomped by a crocodile!'); }
    if (P.y > WATER_Y + 4 && P.x > PIT_L - 6 && P.x < PIT_R + 6) {
      if (S.kind === 'tar') { Sound.sink(); return killPlayer('Stuck in the tar pit!', true); }
      Sound.splash(); E.particles(P.x, WATER_Y, '#5a9be8', 24, 160); return killPlayer('Fell in the swamp!', true);
    }
    // grab the vine
    if (S.kind === 'vine' && P.state === 'air' && P.grabCool <= 0) {
      const v = vineState();
      if (Math.hypot(P.x - v.x, (P.y - 28) - v.y) < 30) { P.state = 'swing'; P.vx = P.vy = 0; Sound.grab(); return; }
    }
    // rolling logs knock you back
    for (const l of S.logs) {
      if (!l.falling && P.inv <= 0 && Math.abs(P.x - l.x) < 16 && P.y > l.y - 24) {
        P.stun = 0.45; P.knock = -160; P.inv = 1; E.addScore(-50); Sound.logHit();
        E.banner('OOF! -50', '#ffb347', 'Jump over the logs.', 1.2);
      }
    }
    // treasure
    for (const tr of S.treasures) if (!tr.broken && Math.abs(P.x - tr.x) < 18 && P.y > GY - 30 && P.onGround) grabTreasure(tr);
  },

  draw() {
    drawBackground();
    drawHazard();
    drawExit();
    layoutTreasureLabels();
    for (const tr of S.treasures) if (!tr.broken) drawTreasure(tr);
    if (S.kind === 'vine') drawVine();
    for (const l of S.logs) drawLog(l);
    const ready = G.ready || G.state === 'card';
    if (P.dead <= 0) { if (!(P.inv > 0 && !ready && Math.floor(E.time * 12) % 2)) drawExplorer(P.x, P.y, P.face, P.state === 'ground' ? P.walk : 0.6); }
    else if (!P.burst || P.sinking) {
      const zc = ['#ffffff', '#ff4d6d', '#ffd23f', '#38f0c8', '#c77dff'];
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, P.sinking ? WATER_Y + 2 : H); ctx.clip();
      drawExplorer(P.x, P.y, P.face, 0, P.sinking ? null : zc[Math.floor(E.time * 24) % zc.length]);
      ctx.restore();
    }
  },
  drawLifeIcon(x, y) { ctx.save(); ctx.translate(x, y + 9); ctx.scale(0.5, 0.5); drawExplorer(0, 0, 1, 0); ctx.restore(); }
});
})();
