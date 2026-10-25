// Stage: SHIELD SPELL, an early-80s style home-console shooter. Spell the term by eating its letters
// out of the core's shield in order, then blast the core with the cannon.
(() => {
"use strict";
const TOP = 142, BOT = 590;                 // play area (the spelling bar sits above TOP)
const CELL = 22, SCOLS = 6, SROWS = 14;     // shield grid
const SX = 618;                             // shield's left edge
const CORE_X = SX + 4.6 * CELL;             // core sits in the shield's hollow
const NZ_L = 300, NZ_R = 352;               // the shimmering safe zone
const BLOCK_COLS = ['#ff5ec4', '#ff8c42', '#7bdff2', '#b5e48c', '#c77dff', '#ffd23f'];
const LETTERS = 'ABCDEFGHIJKLMNOPRSTUVWY';
let S = null, P = null;

// The word to spell: the term without anything in parentheses; letters only, spaces/hyphens/
// apostrophes filled in for free. Terms with other characters or too many letters don't suit this stage.
function wordOf(term) {
  const w = term.term.replace(/\s*\(.*?\)/g, '').replace(/,.*$/, '').replace(/[’']/g, "'").trim().toUpperCase();
  return w;
}
function suits(term) {
  const w = wordOf(term);
  if (!/^[A-Z][A-Z '\-]*$/.test(w)) return false;
  const n = w.replace(/[^A-Z]/g, '').length;
  return n >= 3 && n <= 15;
}
const isAuto = ch => !/[A-Z]/.test(ch);

function buildRound(target) {
  const word = wordOf(target);
  // crescent-shaped shield with a hollow for the core
  const cells = [];
  for (let r = 0; r < SROWS; r++) {
    const dr = Math.abs(r - (SROWS - 1) / 2) / ((SROWS - 1) / 2);
    const left = Math.round(dr * dr * 3.2);
    for (let c = left; c < SCOLS; c++) {
      if (c >= 4 && r >= 5 && r <= 8) continue;        // the core's hollow
      cells.push({ c, r, ch: null, flash: 0, cool: 0 });
    }
  }
  // one letter cell for every letter in the word, plus decoys; letters avoid the outermost column
  const need = [...word].filter(ch => !isAuto(ch));
  const decoys = 6 + Math.min(6, E.level);
  const spots = shuffle(cells.filter(x => x.c >= 1));
  need.forEach((ch, i) => { if (spots[i]) spots[i].ch = ch; });
  for (let i = 0; i < decoys && need.length + i < spots.length; i++) spots[need.length + i].ch = pick(LETTERS);
  S = { target, word, pos: 0, cells, shieldY: (TOP + BOT) / 2, shieldV: 26 + E.level * 3, color: BLOCK_COLS[(E.level - 1) % BLOCK_COLS.length],
        armed: false, cannonY: (TOP + BOT) / 2, cshot: null, rearm: 0, solved: false, boomT: 0, wrongs: 0, reveal: false,
        missile: null, swirl: { state: 'home', t: rand(9, 13), x: 0, y: 0, vx: 0, vy: 0, a: 0 }, shot: null, t: 0 };
  skipAuto();
  resetPlayer();
}
function skipAuto() { while (S.pos < S.word.length && isAuto(S.word[S.pos])) S.pos++; }
function resetPlayer() {
  P = { x: 70, y: (TOP + BOT) / 2, face: { x: 1, y: 0, flip: 1 }, dead: 0, burst: false, inv: 1.2, flap: 0 };
  S.missile = { x: CORE_X, y: S.shieldY, };
  S.swirl.state = 'home'; S.swirl.t = rand(9, 13); S.shot = null;
}
const cellRect = cl => ({ x: SX + cl.c * CELL, y: S.shieldY - SROWS / 2 * CELL + cl.r * CELL, w: CELL - 2, h: CELL - 2 });
const coreRect = () => ({ x: CORE_X - 14, y: S.shieldY - 16, w: 30, h: 32 });
const inZone = x => x > NZ_L && x < NZ_R;

function killPlayer(why) { if (P.dead > 0 || S.solved) return; P.dead = 2.2; P.burst = false; E.kill(why); }

function eatCell(cl) {
  if (!cl.ch) {   // blank block: just a nibble
    S.cells = S.cells.filter(x => x !== cl); E.addScore(10); Sound.nibble();
    E.particles(cellRect(cl).x + 10, cellRect(cl).y + 10, S.color, 6, 70); return;
  }
  if (!S.armed && S.pos < S.word.length && cl.ch === S.word[S.pos]) {
    S.cells = S.cells.filter(x => x !== cl); S.pos++; skipAuto();
    E.addScore(50); Sound.letter(); E.particles(cellRect(cl).x + 10, cellRect(cl).y + 10, '#ffffff', 14, 120);
    if (S.pos >= S.word.length) {
      S.armed = true; S.cannonY = P.y; Sound.cannonReady();
      E.banner('SPELLED IT!', '#38f0c8', 'Fire the cannon (space) at the core.', 2.4);
    }
  } else if (!S.armed && cl.cool <= 0) {   // the cooldown just stops one bump counting twice
    cl.flash = 0.6; cl.cool = 1; S.wrongs++;
    if (S.wrongs >= 3) S.reveal = true;
    E.mistake(`NOT "${cl.ch}"`, `The next letter isn't ${cl.ch}.`, 50);
  }
}

// ---------- drawing
function drawBug(x, y, face, flap, col) {
  // a little winged bug (original sprite). It turns to face any of 8 directions, mirrored for
  // leftward directions so it never flies upside-down.
  const flip = face.x < 0 || (face.x === 0 && face.flip < 0) ? -1 : 1;
  const ang = Math.atan2(face.y || 0, Math.abs(face.x || 0));
  ctx.save(); ctx.translate(x, y); ctx.scale(flip, 1); ctx.rotate(ang);
  const w = Math.sin(flap) * 7;
  ctx.fillStyle = col || 'rgba(200,240,255,.75)';
  ctx.beginPath(); ctx.ellipse(-4, -6 - w * 0.3, 9, 4 + Math.abs(w) * 0.4, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-4, 6 + w * 0.3, 9, 4 + Math.abs(w) * 0.4, 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col || '#ffd23f'; ctx.fillRect(-10, -3, 14, 6);              // body
  ctx.fillStyle = col || '#2a2a2a'; ctx.fillRect(-8, -3, 2, 6); ctx.fillRect(-3, -3, 2, 6);   // stripes
  ctx.fillStyle = col || '#ffd23f'; ctx.fillRect(4, -4, 6, 8);                  // head
  ctx.fillStyle = col || '#38f0c8'; ctx.fillRect(7, -3, 3, 3);                  // eye (goggles)
  ctx.fillStyle = col || '#ffd23f'; ctx.fillRect(9, -7, 1, 4); ctx.fillRect(11, -8, 2, 2);   // antenna
  ctx.restore();
}
function drawCore(x, y, t, col) {
  // a benzene-ring reactor core with angry eyes (original)
  ctx.save(); ctx.translate(x, y); const pulse = 1 + Math.sin(t * 6) * 0.06; ctx.scale(pulse, pulse);
  ctx.strokeStyle = col || '#ff4d6d'; ctx.lineWidth = 3; ctx.beginPath();
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * 15, Math.sin(a) * 15); }
  ctx.closePath(); ctx.stroke();
  ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = col || '#ffd23f'; ctx.fillRect(-6, -4, 4, 3); ctx.fillRect(2, -4, 4, 3);
  ctx.restore();
}

registerStage({
  id: 'shield-spell', name: 'SHIELD SPELL', color: '#ff5ec4', hudLabel: 'SPELL THE TERM:', fourWay: false, chip: 'tia',
  howTo: ['Spell the term that matches the clue: fly into its letters in order.', 'Move: arrows or WASD.  Space shoots blank blocks; spell it, then fire the cannon.', 'Dodge the homing missile. The shimmering zone is safe.'],
  cart: {
    icon: ['..ww...ww...',
           '.wwww.wwww..',
           '..wwwwwww...',
           '...yky.yyyy.',
           'yykykyyyyggy',
           '...yky.yyyy.',
           '..wwwwwww...',
           '.wwww.wwww..',
           '..ww...ww...'],
    pal: { w: '#e8f6ff', y: '#ffd23f', k: '#1b1f2a', g: '#38f0c8' }
  },
  accepts: suits,
  start(target) { buildRound(target); },
  respawn() { if (S.solved) return E.nextRound(); resetPlayer(); },
  isDying: () => P && P.dead > 0,
  isSolved: () => S && S.solved,
  _debug: () => ({ S, P, wordOf, suits }),

  update(dt, inp) {
    S.t += dt;
    // shield and core drift up and down together
    const half = SROWS / 2 * CELL;
    S.shieldY += S.shieldV * dt;
    if (S.shieldY < TOP + half) { S.shieldY = TOP + half; S.shieldV = Math.abs(S.shieldV); }
    if (S.shieldY > BOT - half) { S.shieldY = BOT - half; S.shieldV = -Math.abs(S.shieldV); }
    S.cells.forEach(cl => { cl.flash = Math.max(0, cl.flash - dt); cl.cool = Math.max(0, cl.cool - dt); });
    if (S.solved) { S.boomT -= dt; if (S.boomT <= 0) E.nextRound(); return; }
    if (P.dead > 0) {
      P.dead -= dt;
      if (P.dead < 0.8 && !P.burst) { P.burst = true; E.particles(P.x, P.y, '#ffd23f', 50, 220); }
      if (P.dead <= 0) E.deathDone();
      return;
    }
    P.inv = Math.max(0, P.inv - dt);
    // fly (the screen wraps top to bottom)
    if (inp.x || inp.y) {
      const len = Math.hypot(inp.x, inp.y);
      P.x += inp.x / len * 170 * dt; P.y += inp.y / len * 170 * dt;
      // face the way it flies, diagonals included; remember the last left/right for straight up/down
      P.face = { x: inp.x, y: inp.y, flip: inp.x ? inp.x : P.face.flip };
    }
    P.flap += dt * 30;
    P.x = clamp(P.x, 14, SX + SCOLS * CELL - 11);   // can reach every block; only the core itself is solid
    const cr0 = coreRect();
    if (hit({ x: P.x - 11, y: P.y - 9, w: 22, h: 18 }, { x: cr0.x - 6, y: cr0.y - 4, w: cr0.w + 40, h: cr0.h + 8 })) P.x = cr0.x - 18;
    if (P.y < TOP) P.y = BOT; if (P.y > BOT) P.y = TOP;
    // touching the shield: eat a block (and bounce back a little)
    const pr = { x: P.x - 11, y: P.y - 9, w: 22, h: 18 };
    for (const cl of S.cells) if (hit(pr, cellRect(cl))) { eatCell(cl); P.x -= 14; break; }
    // shoot blank blocks (before the word is spelled); not inside the safe zone
    if (inp.fire && !S.armed && !S.shot && !inZone(P.x)) {
      // shots fly the way the bug faces (any of 8 directions)
      const fx = P.face.x || 0, fy = P.face.y || 0, l = Math.hypot(fx, fy);
      const dx = l ? fx / l : (P.face.flip || 1), dy = l ? fy / l : 0;
      S.shot = { x: P.x + 10 * dx, y: P.y + 10 * dy, vx: 420 * dx, vy: 420 * dy }; Sound.shot();
    }
    if (S.shot) {
      S.shot.x += S.shot.vx * dt; S.shot.y += S.shot.vy * dt;
      if (S.shot.y < TOP - 10 || S.shot.y > BOT + 10) { S.shot = null; }
    }
    if (S.shot) {
      const sr = { x: S.shot.x - 3, y: S.shot.y - 3, w: 6, h: 6 };
      const cl = S.cells.find(c => hit(sr, cellRect(c)));
      if (cl) { if (!cl.ch) { S.cells = S.cells.filter(x => x !== cl); E.addScore(10); Sound.nibble(); } S.shot = null; }
      else if (S.swirl.state === 'fly' && Math.hypot(S.shot.x - S.swirl.x, S.shot.y - S.swirl.y) < 18) { S.swirl.state = 'home'; S.swirl.t = rand(9, 13); E.addScore(500); E.particles(S.shot.x, S.shot.y, '#ff4d6d', 24, 160); S.shot = null; }
      else if (S.shot.x < 0 || S.shot.x > W) S.shot = null;
    }
    // the cannon: tracks the bug along the left edge once the word is spelled
    if (S.armed) {
      S.cannonY += (P.y - S.cannonY) * Math.min(1, dt * 6);
      S.rearm = Math.max(0, S.rearm - dt);
      if (inp.fire && !S.cshot && S.rearm <= 0) { S.cshot = { x: 26, y: S.cannonY }; Sound.cannonFire(); }
      if (S.cshot) {
        S.cshot.x += 380 * dt;
        const cr = { x: S.cshot.x - 10, y: S.cshot.y - 8, w: 20, h: 16 };
        S.cells = S.cells.filter(cl => { if (hit(cr, cellRect(cl))) { E.particles(cellRect(cl).x + 10, cellRect(cl).y + 10, S.color, 4, 80); return false; } return true; });
        if (hit(cr, coreRect())) {
          S.solved = true; S.boomT = 2.6; S.cshot = null;
          const pts = Math.max(200, 1000 + E.level * 100 - S.wrongs * 100);
          E.correct(pts); Sound.coreBoom();
          E.particles(CORE_X, S.shieldY, '#ffffff', 60, 300); E.particles(CORE_X, S.shieldY, '#ff4d6d', 60, 220);
          return;
        }
        if (S.cshot.x > W + 20) { S.cshot = null; S.rearm = 0.8; }
      }
    }
    // the homing missile: slow, but it never stops; harmless inside the safe zone
    const m = S.missile, ms = 46 + E.level * 6, a = Math.atan2(P.y - m.y, P.x - m.x);
    m.x += Math.cos(a) * ms * dt; m.y += Math.sin(a) * ms * dt;
    if (P.inv <= 0 && !inZone(P.x) && Math.hypot(P.x - m.x, P.y - m.y) < 12) { S.missile = { x: CORE_X, y: S.shieldY }; return killPlayer('Hit by the homing missile!'); }
    // the swirl (from level 2): the core spins up, then lunges at where the bug was
    const sw = S.swirl;
    if (E.level >= 2) {
      if (sw.state === 'home') { sw.x = CORE_X; sw.y = S.shieldY; sw.t -= dt; if (sw.t <= 0) { sw.state = 'warn'; sw.t = 1.1; Sound.swirl(); } }
      else if (sw.state === 'warn') { sw.x = CORE_X; sw.y = S.shieldY; sw.a += dt * 20; sw.t -= dt; if (sw.t <= 0) { const b = Math.atan2(P.y - sw.y, P.x - sw.x); sw.vx = Math.cos(b) * 300; sw.vy = Math.sin(b) * 300; sw.state = 'fly'; } }
      else if (sw.state === 'fly') {
        sw.x += sw.vx * dt; sw.y += sw.vy * dt; sw.a += dt * 20;
        if (P.inv <= 0 && Math.hypot(P.x - sw.x, P.y - sw.y) < 18) { sw.state = 'home'; sw.t = rand(9, 13); return killPlayer('Hit by the swirl!'); }
        if (sw.x < -30 || sw.y < TOP - 40 || sw.y > BOT + 40) { sw.state = 'home'; sw.t = rand(9, 13); }
      }
    }
  },

  draw() {
    const t = E.time;
    // spelling bar
    const chars = [...S.word], bw = Math.min(30, (W - 40) / chars.length), bx = W / 2 - chars.length * bw / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '26px VT323';
    chars.forEach((ch, i) => {
      const x = bx + i * bw + bw / 2, y = 118;
      if (isAuto(ch)) { ctx.fillStyle = '#5d6b80'; ctx.fillText(ch === ' ' ? '·' : ch, x, y); return; }
      const done = i < S.pos;
      ctx.fillStyle = done ? '#38f0c8' : (i === S.pos && !S.armed ? (Math.floor(t * 3) % 2 ? '#ffd23f' : '#5d6b80') : '#2a3346');
      ctx.fillRect(x - bw / 2 + 3, y + 12, bw - 6, 3);
      if (done) { ctx.fillStyle = '#e8f6ff'; ctx.fillText(ch, x, y); }
    });
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    // the safe zone
    for (let i = 0; i < 70; i++) {
      const y = TOP + ((i * 53 + Math.floor(t * 30) * 17) % (BOT - TOP)), x = NZ_L + ((i * 29 + Math.floor(t * 24) * 7) % (NZ_R - NZ_L));
      ctx.fillStyle = BLOCK_COLS[(i + Math.floor(t * 10)) % BLOCK_COLS.length]; ctx.globalAlpha = 0.45; ctx.fillRect(x, y, 6, 3);
    }
    ctx.globalAlpha = 1;
    // shield
    ctx.font = '21px VT323'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const nextCh = S.word[S.pos];
    for (const cl of S.cells) {
      const r = cellRect(cl);
      if (!cl.ch) { ctx.fillStyle = S.color; ctx.fillRect(r.x, r.y, r.w, r.h); continue; }
      const glow = S.reveal && !S.armed && cl.ch === nextCh;
      ctx.fillStyle = cl.flash > 0 && Math.floor(cl.flash * 16) % 2 ? '#ff4d6d' : (glow ? '#0e4d40' : '#151a26');
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = glow ? '#38f0c8' : S.color; ctx.lineWidth = 1; ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      ctx.fillStyle = glow ? '#38f0c8' : '#ffffff'; ctx.fillText(cl.ch, r.x + r.w / 2, r.y + r.h / 2 + 1);
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    // core (or the swirl winding up)
    const sw = S.swirl;
    if (!S.solved) {
      if (sw.state === 'home') drawCore(CORE_X, S.shieldY, t);
      else { ctx.save(); ctx.translate(sw.x, sw.y); ctx.rotate(sw.a); drawCore(0, 0, t, Math.floor(t * 12) % 2 ? '#ffffff' : '#ff4d6d'); ctx.restore(); if (sw.state === 'fly') drawCore(CORE_X, S.shieldY, t, '#5d6b80'); }
    }
    // missile
    if (Math.floor(t * 8) % 2) { ctx.fillStyle = '#ffffff'; ctx.fillRect(S.missile.x - 3, S.missile.y - 1, 6, 3); }
    // player's shot and the cannon
    if (S.shot) { ctx.fillStyle = '#ffd23f'; ctx.fillRect(S.shot.x - 3, S.shot.y - 3, 6, 6); }
    if (S.armed && !S.solved) {
      const y = S.cannonY, glow = Math.floor(t * 6) % 2;
      ctx.fillStyle = glow ? '#38f0c8' : '#7bdff2'; ctx.fillRect(4, y - 10, 16, 20); ctx.fillRect(20, y - 4, 8, 8);
      if (S.cshot) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(S.cshot.x, S.cshot.y, 8, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#38f0c8'; ctx.fillRect(S.cshot.x - 30, S.cshot.y - 2, 22, 4); }
    }
    // the bug
    const ready = G.ready || G.state === 'card';
    if (P.dead <= 0) { if (!(P.inv > 0 && !ready && Math.floor(t * 12) % 2)) drawBug(P.x, P.y, P.face, P.flap); }
    else if (!P.burst) { const zc = ['#ffffff', '#ff4d6d', '#ffd23f', '#38f0c8', '#c77dff']; drawBug(P.x, P.y, P.face, 0, zc[Math.floor(t * 24) % zc.length]); }
    // the big finish: rainbow bands sweep the screen
    if (S.solved) {
      const k = S.boomT / 2.6;
      for (let y = TOP; y < BOT; y += 8) { ctx.fillStyle = BLOCK_COLS[(Math.floor(y / 8) + Math.floor(t * 30)) % BLOCK_COLS.length]; ctx.globalAlpha = 0.5 * k; ctx.fillRect(0, y, W, 8); }
      ctx.globalAlpha = 1;
    }
  },
  drawLifeIcon(x, y) { ctx.save(); ctx.translate(x, y + 6); ctx.scale(0.6, 0.6); drawBug(0, 0, { x: -1, y: 0 }, 0); ctx.restore(); }
});
})();
