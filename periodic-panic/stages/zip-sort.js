// Stage: ZIP SORT, an early-80s style box-zipping maze game, and the finale of Periodic Panic.
// The clue names a category ("a gas law"); zip shut every box whose term belongs to it.
// After five stages about what single terms mean, this one asks which terms belong together.
(() => {
"use strict";
const BC = 5, BR = 4;                       // boxes across and down
const X0 = 50, Y0 = 126, BW = 140, BH = 114;
const nx = c => X0 + c * BW, ny = r => Y0 + r * BH;
const FILL_COLS = ['#3d2a6b', '#2a4d6b', '#2a6b4d', '#6b4d2a', '#6b2a4d'];
let S = null, P = null, recent = [];

// ---------- the question: a category (group) whose members are in the chosen chapters
function pickGroup() {
  const pool = new Set(G.pool.map(t => t.id));
  // a category plays only with at least 3 of its terms in play (skipped sections can empty a group)
  const ok = (window.GROUPS || []).filter(g => g.members.filter(id => pool.has(id)).length >= 3);
  if (!ok.length) return null;
  const fresh = ok.filter(g => !recent.includes(g.id));
  const g = pick(fresh.length ? fresh : ok);
  recent = [g.id, ...recent].slice(0, Math.min(8, ok.length - 1));
  const byId = Object.fromEntries(G.pool.map(t => [t.id, t]));
  const members = g.members.filter(id => byId[id]).map(id => byId[id]);
  const chs = [...new Set(members.map(t => t.chapter))].sort((a, b) => a - b);
  return {
    id: g.id, group: g, term: g.name, short: g.name, chapter: chs.join(', '),
    where: (chs.length > 1 ? 'Ch. ' : 'Ch. ') + chs.join(', '),
    clue: `Zip shut every box that names ${g.prompt}.`,
    review: `${g.name}: ${g.members.filter(id => byId[id]).map(id => byId[id].term).join(', ')}.`
  };
}

function buildMaze(target) {
  const byId = Object.fromEntries(G.pool.map(t => [t.id, t]));
  let correct, wrong;
  if (target.group) {
    const g = target.group;
    correct = shuffle(g.members.filter(id => byId[id]).map(id => byId[id])).slice(0, 4);
    const others = new Set((window.GROUPS || []).filter(o => o.id !== g.id).flatMap(o => o.members));
    const tricky = shuffle(g.tricky.filter(id => byId[id] && !g.members.includes(id)).map(id => byId[id]));
    const rest = shuffle([...others].filter(id => byId[id] && !g.members.includes(id) && !g.tricky.includes(id)).map(id => byId[id]));
    // prefer lookalikes from the same chapters, so the choice takes thought
    const chs = new Set(correct.map(t => t.chapter));
    rest.sort((a, b) => (chs.has(b.chapter) ? 1 : 0) - (chs.has(a.chapter) ? 1 : 0));
    wrong = [...tricky.slice(0, 3), ...rest].slice(0, 9 - correct.length);
  } else {   // no category fits the chosen chapters: zip the one box that matches the clue
    correct = [target]; wrong = E.distractors(target, 6);
  }
  const slots = shuffle([...Array(BC * BR).keys()]);
  const boxes = [...Array(BC * BR)].map((_, i) => ({ c: i % BC, r: Math.floor(i / BC), term: null, good: false, fork: false, filled: false }));
  [...correct.map(t => [t, true]), ...wrong.map(t => [t, false])].forEach(([t, good], i) => { const b = boxes[slots[i]]; b.term = t; b.good = good; });
  boxes[slots[correct.length + wrong.length]].fork = true;
  S = { target, boxes, h: [...Array(BR + 1)].map(() => Array(BC).fill(false)), v: [...Array(BR)].map(() => Array(BC + 1).fill(false)),
        need: correct.length, got: 0, wrongs: 0, reveal: false, solved: false, clearT: 0, power: 0, col: FILL_COLS[(E.level - 1) % FILL_COLS.length] };
  resetActors();
}
function resetActors() {
  P = { x: nx(0), y: ny(BR), dir: 'right', last: { c: 0, r: BR }, dead: 0, burst: false, inv: 1.2, anim: 0 };
  const n = Math.min(4, 2 + Math.floor(E.level / 2));
  S.eyes = [...Array(n)].map((_, i) => { const c = BC - (i % 2), r = Math.floor(i / 2); return { x: nx(c), y: ny(r), c, r, tc: c, tr: r, dir: 'left', home: { c, r }, gone: 0, wait: 1 + i * 0.6 }; });
  S.power = 0;
}

// ---------- moving along the lines
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const REV = { up: 'down', down: 'up', left: 'right', right: 'left' };
const near = (v, k) => Math.abs(v - k) < 9;
function movePlayer(want, dist) {
  const c = Math.round((P.x - X0) / BW), r = Math.round((P.y - Y0) / BH);
  const onNode = near(P.x, nx(c)) && near(P.y, ny(r));
  let d = want || null;
  if (d) {
    const horiz = DIRS[d][0] !== 0;
    const lineOk = horiz ? near(P.y, ny(r)) : near(P.x, nx(c));   // can only travel along a line
    if (!lineOk) d = P.dir;
    else if (onNode) { if (horiz) P.y = ny(r); else P.x = nx(c); }
  }
  if (!d) return false;
  const [dx, dy] = DIRS[d];
  const x1 = clamp(P.x + dx * dist, nx(0), nx(BC)), y1 = clamp(P.y + dy * dist, ny(0), ny(BR));
  const moved = x1 !== P.x || y1 !== P.y;
  // did we pass or reach a node? zip the edge from the last node we stood on
  if (dx) for (let k = 0; k <= BC; k++) { const kx = nx(k); if ((P.x - kx) * (x1 - kx) <= 0 && x1 !== P.x) arrive(k, Math.round((P.y - Y0) / BH)); }
  if (dy) for (let k = 0; k <= BR; k++) { const ky = ny(k); if ((P.y - ky) * (y1 - ky) <= 0 && y1 !== P.y) arrive(Math.round((P.x - X0) / BW), k); }
  P.x = x1; P.y = y1; P.dir = d;
  return moved;
}
function arrive(c, r) {
  const L = P.last;
  if (L.c === c && L.r === r) return;
  if (Math.abs(L.c - c) + Math.abs(L.r - r) === 1) {
    if (L.r === r) { const cc = Math.min(L.c, c); if (!S.h[r][cc]) { S.h[r][cc] = true; Sound.zipEdge(); checkBox(cc, r - 1); checkBox(cc, r); } }
    else { const rr = Math.min(L.r, r); if (!S.v[rr][c]) { S.v[rr][c] = true; Sound.zipEdge(); checkBox(c - 1, rr); checkBox(c, rr); } }
  }
  P.last = { c, r };
}
function checkBox(c, r) {
  if (c < 0 || r < 0 || c >= BC || r >= BR) return;
  const b = S.boxes[r * BC + c];
  if (b.filled || !(S.h[r][c] && S.h[r + 1][c] && S.v[r][c] && S.v[r][c + 1])) return;
  b.filled = true;
  const cx = nx(c) + BW / 2, cy = ny(r) + BH / 2;
  if (b.fork) { S.power = 7; Sound.power(); E.banner('PITCHFORK!', '#ffd23f', 'Chase the eyes for a few seconds.', 1.6); E.particles(cx, cy, '#ffd23f', 30, 180); return; }
  if (!b.term) { E.addScore(50); Sound.fillBox(); E.particles(cx, cy, '#c77dff', 12, 100); return; }
  if (b.good) {
    S.got++; E.addScore(300); Sound.fillBox(); E.particles(cx, cy, '#38f0c8', 30, 180);
    if (S.got >= S.need && !S.solved) {
      S.solved = true; S.clearT = 2.2;
      E.correct(Math.max(300, 1200 + E.level * 100 - S.wrongs * 200)); Sound.correct();
    } else E.banner(`YES: ${b.term.term.toUpperCase()}`, '#38f0c8', `${S.need - S.got} more to find.`, 1.4);
  } else {
    S.wrongs++; if (S.wrongs >= 2) S.reveal = true;
    E.particles(cx, cy, '#ff4d6d', 24, 160);
    E.wrong(b.term, 100);
  }
}
function moveEye(e, dt) {
  if (e.gone > 0) { e.gone -= dt; if (e.gone <= 0) { e.c = e.tc = e.home.c; e.r = e.tr = e.home.r; e.x = nx(e.c); e.y = ny(e.r); } return; }
  if (e.wait > 0) { e.wait -= dt; return; }
  const spd = S.power > 0 ? 55 : 70 + E.level * 8;
  const gx = nx(e.tc), gy = ny(e.tr), d = Math.hypot(gx - e.x, gy - e.y), step = spd * dt;
  if (d > step) { e.x += (gx - e.x) / d * step; e.y += (gy - e.y) / d * step; return; }
  e.x = gx; e.y = gy; e.c = e.tc; e.r = e.tr;
  const pc = Math.round((P.x - X0) / BW), pr = Math.round((P.y - Y0) / BH);
  let opts = Object.keys(DIRS).map(dir => ({ dir, c: e.c + DIRS[dir][0], r: e.r + DIRS[dir][1] })).filter(o => o.c >= 0 && o.c <= BC && o.r >= 0 && o.r <= BR);
  if (opts.length > 1) opts = opts.filter(o => o.dir !== REV[e.dir]);
  const dist = o => Math.abs(o.c - pc) + Math.abs(o.r - pr);
  let best;
  if (Math.random() < 0.25) best = pick(opts);
  else best = opts.reduce((a, o) => (S.power > 0 ? dist(o) > dist(a) : dist(o) < dist(a)) ? o : a);
  e.tc = best.c; e.tr = best.r; e.dir = best.dir;
}

// ---------- drawing
function wrap2(text, maxW) {
  ctx.font = '20px VT323';
  if (ctx.measureText(text).width <= maxW) return [text];
  const words = text.split(' '); let a = '', i = 0;
  for (; i < words.length; i++) { const t = a ? a + ' ' + words[i] : words[i]; if (ctx.measureText(t).width > maxW && a) break; a = t; }
  return [a, words.slice(i).join(' ')];
}
function drawPull(x, y, col) {
  // a zipper pull with eyes (original sprite)
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = col || '#d9dde6'; ctx.beginPath(); ctx.roundRect(-9, -13, 18, 26, 6); ctx.fill();
  ctx.fillStyle = col ? col : '#8a93ad'; ctx.fillRect(-4, 4, 8, 6);                  // the hole
  ctx.fillStyle = '#000'; ctx.fillRect(-5, -7, 3, 4); ctx.fillRect(2, -7, 3, 4);     // eyes
  ctx.fillStyle = col || '#ff8fb1'; ctx.fillRect(-2, -1, 4, 2);
  ctx.restore();
}
function drawEyes(e) {
  const scared = S.power > 0, blink = scared && S.power < 2 && Math.floor(E.time * 8) % 2;
  const ex = clamp((P.x - e.x) / 60, -2.5, 2.5), ey = clamp((P.y - e.y) / 60, -2.5, 2.5);
  for (const ox of [-7, 7]) {
    ctx.fillStyle = scared ? (blink ? '#ffffff' : '#3b6bff') : '#ffffff';
    ctx.beginPath(); ctx.arc(e.x + ox, e.y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = scared ? '#ffffff' : '#c2185b'; ctx.beginPath(); ctx.arc(e.x + ox + ex, e.y + ey, 3, 0, Math.PI * 2); ctx.fill();
  }
  if (!scared) { ctx.fillStyle = '#5a1030'; ctx.fillRect(e.x - 14, e.y - 9, 28, 3); }   // frowning brows
}
function drawZip(x1, y1, x2, y2, zipped) {
  if (!zipped) { ctx.strokeStyle = '#3a3355'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); return; }
  ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.fillStyle = '#e8d27a';   // zipper teeth
  const len = Math.hypot(x2 - x1, y2 - y1), n = Math.floor(len / 7);
  for (let i = 0; i <= n; i++) { const k = i / n, x = x1 + (x2 - x1) * k, y = y1 + (y2 - y1) * k; if (x1 === x2) ctx.fillRect(x + (i % 2 ? 1 : -5), y - 1, 4, 3); else ctx.fillRect(x - 1, y + (i % 2 ? 1 : -5), 3, 4); }
}

registerStage({
  id: 'zip-sort', name: 'ZIP SORT', color: '#c77dff', hudLabel: 'SORT IT OUT:', fourWay: true, chip: 'sn',
  howTo: ['The finale: zip shut every box that belongs to the category.', 'Move along the lines: arrows or WASD. Trace all 4 sides to close a box.', 'Avoid the eyes. Close the pitchfork box to chase them!'],
  cart: {
    icon: ['...gggggg...',
           '..gssssssg..',
           '..gsk..ksg..',
           '..gssssssg..',
           '..gsspps.g..',
           '..gssssssg..',
           '..gss..ssg..',
           '..gss..ssg..',
           '...gggggg...'],
    pal: { g: '#5a5f73', s: '#d9dde6', k: '#000000', p: '#ff8fb1' }
  },
  pickTarget: pickGroup,
  start(target) { buildMaze(target); },
  respawn() { if (S.solved) return E.nextRound(); resetActors(); },
  isDying: () => P && P.dead > 0,
  isSolved: () => S && S.solved,
  _debug: () => ({ S, P, arrive, checkBox }),

  update(dt, inp) {
    if (S.solved) { S.clearT -= dt; if (S.clearT <= 0) E.nextRound(); return; }
    if (P.dead > 0) {
      P.dead -= dt;
      if (P.dead < 0.8 && !P.burst) { P.burst = true; E.particles(P.x, P.y, '#d9dde6', 50, 220); }
      if (P.dead <= 0) E.deathDone();
      return;
    }
    P.inv = Math.max(0, P.inv - dt); S.power = Math.max(0, S.power - dt);
    if (movePlayer(inp.dir, 150 * dt)) P.anim += dt * 10;
    for (const e of S.eyes) {
      moveEye(e, dt);
      if (e.gone > 0 || Math.hypot(e.x - P.x, e.y - P.y) > 20) continue;
      if (S.power > 0) { e.gone = 4; E.addScore(500); Sound.eat(); E.particles(e.x, e.y, '#3b6bff', 20, 140); }
      else if (P.inv <= 0) { P.dead = 2.2; P.burst = false; E.kill('Caught by the eyes!'); return; }
    }
  },

  draw() {
    ctx.fillStyle = '#120d1f'; ctx.fillRect(0, HUD_H, W, H - HUD_H);
    // boxes
    for (const b of S.boxes) {
      const x = nx(b.c), y = ny(b.r), cx = x + BW / 2, cy = y + BH / 2;
      const glow = S.reveal && b.good && !b.filled;
      if (b.filled) {
        ctx.fillStyle = b.fork ? '#6b5a1d' : !b.term ? S.col : b.good ? '#1f6b3a' : '#6b1f2f';
        ctx.fillRect(x + 3, y + 3, BW - 6, BH - 6);
      } else if (glow) { ctx.fillStyle = `rgba(56,240,200,${0.12 + 0.1 * Math.sin(E.time * 6)})`; ctx.fillRect(x + 3, y + 3, BW - 6, BH - 6); }
      if (b.term) {
        const lines = wrap2(b.term.short, BW - 16);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '20px VT323';
        ctx.fillStyle = glow ? '#38f0c8' : b.filled ? '#ffffff' : '#e8f6ff';
        lines.forEach((l, i) => ctx.fillText(l, cx, cy + (i - (lines.length - 1) / 2) * 20));
        if (b.filled) { ctx.font = '14px "Press Start 2P"'; ctx.fillStyle = b.good ? '#38f0c8' : '#ff4d6d'; ctx.fillText(b.good ? '✓' : '✗', x + BW - 16, y + 16); }
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      } else if (b.fork && !b.filled) {   // pitchfork power-up
        ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3; ctx.beginPath();
        ctx.moveTo(cx, cy + 22); ctx.lineTo(cx, cy - 12); ctx.moveTo(cx - 10, cy - 22); ctx.lineTo(cx - 10, cy - 10); ctx.lineTo(cx + 10, cy - 10); ctx.lineTo(cx + 10, cy - 22);
        ctx.moveTo(cx, cy - 22); ctx.lineTo(cx, cy - 10); ctx.stroke();
      }
    }
    // lines: zipped edges get zipper teeth
    for (let r = 0; r <= BR; r++) for (let c = 0; c < BC; c++) drawZip(nx(c), ny(r), nx(c + 1), ny(r), S.h[r][c]);
    for (let r = 0; r < BR; r++) for (let c = 0; c <= BC; c++) drawZip(nx(c), ny(r), nx(c), ny(r + 1), S.v[r][c]);
    for (const e of S.eyes) if (e.gone <= 0) drawEyes(e);
    const ready = G.ready || G.state === 'card';
    if (P.dead <= 0) { if (!(P.inv > 0 && !ready && Math.floor(E.time * 12) % 2)) drawPull(P.x, P.y); }
    else if (!P.burst) { const zc = ['#ffffff', '#ff4d6d', '#ffd23f', '#38f0c8']; drawPull(P.x, P.y, zc[Math.floor(E.time * 24) % zc.length]); }
  },
  drawHud() {
    ctx.font = '16px VT323'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    const left = Math.max(0, S.need - S.got);
    ctx.fillStyle = '#c77dff'; ctx.fillText(S.solved ? 'ALL FOUND!' : `${left} TO ZIP`, W - 14, 58);
    if (S.power > 0) { ctx.fillStyle = '#ffd23f'; ctx.fillText(`PITCHFORK ${Math.ceil(S.power)}`, W - 90, 58); }
    ctx.textAlign = 'left';
  },
  drawLifeIcon(x, y) { ctx.save(); ctx.translate(x, y + 6); ctx.scale(0.5, 0.5); drawPull(0, 0); ctx.restore(); }
});
})();
