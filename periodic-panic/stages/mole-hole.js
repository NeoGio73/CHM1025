// Stage: MOLE HOLE, an early-80s style digging game. Tunnel to the crystal with the matching term.
(() => {
"use strict";
const T = 48, COLS = 15, ROWS = 10, X0 = 40, Y0 = 100;   // dirt grid
const tc = c => X0 + c * T + T / 2, tr = r => Y0 + r * T + T / 2;
const colOf = x => Math.floor((x - X0) / T), rowOf = y => Math.floor((y - Y0) / T);
const inGrid = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS;
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const REV = { up: 'down', down: 'up', left: 'right', right: 'left' };
const PALETTES = [   // dirt colours per level: [base, speckle, edge]
  ['#8a4f1d', '#a8682e', '#5e3412'], ['#6b6b2a', '#8c8c3c', '#44441a'], ['#2f6b5a', '#3f8a75', '#1d4439'],
  ['#7a2f4f', '#9c4268', '#4d1d32'], ['#3a4f8a', '#4f68a8', '#25325a'], ['#8a6a1d', '#a8862e', '#5e4712']
];
const GEM_COLS = ['#38f0c8', '#c77dff', '#ff8c42', '#7bdff2', '#ffd23f'];
let L = null, P = null, beat = 0;

// A fresh field: a starting tunnel, a monster den, boulders, electrons, and four crystals.
function newField(target) {
  const dug = [...Array(ROWS)].map(() => Array(COLS).fill(false));
  const start = { c: 7, r: 9 }, den = { c: 7, r: 3 };
  for (let c = 5; c <= 9; c++) dug[9][c] = true;
  for (let c = 4; c <= 10; c++) dug[den.r][c] = true;
  for (let k = 0; k < 2; k++) {
    if (Math.random() < 0.5) { const r = ri(1, 7), c0 = ri(0, 8); for (let c = c0; c < c0 + ri(3, 6) && c < COLS; c++) dug[r][c] = true; }
    else { const c = pick([1, 2, 12, 13]), r0 = ri(1, 4); for (let r = r0; r < r0 + ri(3, 5) && r < ROWS - 1; r++) dug[r][c] = true; }
  }
  const taken = new Set([`${start.c},${start.r}`]);
  const free = (c, r) => inGrid(c, r) && !dug[r][c] && !taken.has(`${c},${r}`);
  const crystals = [];
  for (const term of shuffle([target, ...E.distractors(target, 3)])) {
    for (let tries = 0; tries < 400; tries++) {
      const c = ri(0, COLS - 1), r = ri(1, ROWS - 2);
      if (!free(c, r)) continue;
      if (crystals.some(x => Math.abs(x.c - c) + Math.abs(x.r - r) < 5)) continue;
      if (Math.abs(c - start.c) + Math.abs(r - start.r) < 3) continue;
      crystals.push({ c, r, term, broken: false, col: GEM_COLS[crystals.length % GEM_COLS.length] }); taken.add(`${c},${r}`); break;
    }
  }
  const boulders = [];
  for (let tries = 0; boulders.length < 6 && tries < 400; tries++) {
    const c = ri(0, COLS - 1), r = ri(0, ROWS - 3);
    if (!free(c, r) || dug[r + 1][c] || taken.has(`${c},${r + 1}`)) continue;
    if (boulders.some(b => Math.abs(b.c - c) <= 1 && Math.abs(b.r - r) <= 1)) continue;
    boulders.push({ c, r, y: tr(r), state: 'rest', t: 0, fallen: 0 }); taken.add(`${c},${r}`);
  }
  const dots = new Set();
  for (let k = 0, tries = 0; k < 3 && tries < 300; tries++) {
    const c = ri(0, COLS - 2), r = ri(0, ROWS - 3);
    const cells = [[c, r], [c + 1, r], [c, r + 1], [c + 1, r + 1]];
    if (!cells.every(([a, b]) => free(a, b))) continue;
    cells.forEach(([a, b]) => { dots.add(`${a},${b}`); taken.add(`${a},${b}`); }); k++;
  }
  L = { dug, start, den, crystals, boulders, dots, target, monsters: [], ball: null, ballCool: 0,
        spawnT: 2.5, diggerT: 12, wrongs: 0, reveal: false, solved: false, clearT: 0,
        pal: PALETTES[(E.level - 1) % PALETTES.length], distMap: null, distT: 0 };
  resetPlayer();
}
function resetPlayer() {
  P = { x: tc(L.start.c), y: tr(L.start.r), dir: 'left', moving: false, dead: 0, burst: false, inv: 1, anim: 0 };
  L.monsters = []; L.ball = null; L.ballCool = 0; L.spawnT = 2.5; L.diggerT = 12;
}

const boulderAt = (c, r) => L.boulders.find(b => b.c === c && b.r === r && b.state !== 'fall');
const solidFor = (c, r) => !!boulderAt(c, r);
// Move along the tile lanes. Turning needs the entity near a tile centre (it snaps);
// otherwise it keeps going the way it was headed until it reaches one.
function moveLane(e, want, dist, canEnter) {
  if (!want) return false;
  const c = colOf(e.x), r = rowOf(e.y), cx = tc(c), cy = tr(r);
  let d = want;
  const horiz = DIRS[d][0] !== 0, off = horiz ? Math.abs(e.y - cy) : Math.abs(e.x - cx);
  if (off > 10) {
    d = (horiz ? (e.dir === 'up' || e.dir === 'down') : (e.dir === 'left' || e.dir === 'right')) ? e.dir
      : horiz ? (e.y < cy ? 'down' : 'up') : (e.x < cx ? 'right' : 'left');
  } else if (horiz) e.y = cy; else e.x = cx;
  const [dx, dy] = DIRS[d], c2 = colOf(e.x), r2 = rowOf(e.y), cx2 = tc(c2), cy2 = tr(r2);
  const blocked = !inGrid(c2 + dx, r2 + dy) || !canEnter(c2 + dx, r2 + dy);
  let nx = e.x + dx * dist, ny = e.y + dy * dist;
  if (blocked) {
    if (dx > 0) nx = Math.min(nx, Math.max(e.x, cx2)); if (dx < 0) nx = Math.max(nx, Math.min(e.x, cx2));
    if (dy > 0) ny = Math.min(ny, Math.max(e.y, cy2)); if (dy < 0) ny = Math.max(ny, Math.min(e.y, cy2));
  }
  const moved = Math.abs(nx - e.x) + Math.abs(ny - e.y) > 0.01;
  e.x = nx; e.y = ny; e.dir = d; return moved;
}
function buildDistMap() {   // tunnel distance from every dug tile to the mole
  const dist = [...Array(ROWS)].map(() => Array(COLS).fill(Infinity));
  const sc = colOf(P.x), sr = rowOf(P.y); if (!inGrid(sc, sr)) return dist;
  dist[sr][sc] = 0; const q = [[sc, sr]];
  while (q.length) {
    const [c, r] = q.shift();
    for (const d in DIRS) {
      const nc = c + DIRS[d][0], nr = r + DIRS[d][1];
      if (inGrid(nc, nr) && L.dug[nr][nc] && !solidFor(nc, nr) && dist[nr][nc] === Infinity) { dist[nr][nc] = dist[r][c] + 1; q.push([nc, nr]); }
    }
  }
  return dist;
}

function killPlayer(why) { if (P.dead > 0) return; P.dead = 2.2; P.burst = false; E.kill(why); }
function killMonster(m, pts) { L.monsters = L.monsters.filter(x => x !== m); E.particles(m.x, m.y, m.digger ? '#ff4dc4' : '#8ee000', 26, 180); E.addScore(pts); Sound.pop(); }
function spawnMonster() { L.monsters.push({ x: tc(L.den.c), y: tr(L.den.r), tc: L.den.c, tr: L.den.r, dir: 'left', digger: 0, wob: rand(0, 6) }); Sound.spawn(); }

function updateMonster(m, dt) {
  m.wob += dt * 6;
  if (m.digger) m.digger = Math.max(0, m.digger - dt);
  const spd = (m.digger ? 52 : 62 + E.level * 7) * (L.wrongs ? 1.15 : 1);
  const gx = tc(m.tc), gy = tr(m.tr), d = Math.hypot(gx - m.x, gy - m.y), step = spd * dt;
  if (d > step) { m.x += (gx - m.x) / d * step; m.y += (gy - m.y) / d * step; return; }
  m.x = gx; m.y = gy;
  if (m.digger && !L.dug[m.tr][m.tc]) L.dug[m.tr][m.tc] = true;
  const opts = [];
  for (const dir in DIRS) {
    const nc = m.tc + DIRS[dir][0], nr = m.tr + DIRS[dir][1];
    if (!inGrid(nc, nr) || solidFor(nc, nr) || (!m.digger && !L.dug[nr][nc])) continue;
    opts.push({ dir, nc, nr });
  }
  if (!opts.length) return;
  const choices = opts.length > 1 ? opts.filter(o => o.dir !== REV[m.dir]) : opts;
  let best;
  if (Math.random() < 0.15) best = pick(choices);
  else if (m.digger) {
    const pc = colOf(P.x), pr = rowOf(P.y);
    best = choices.reduce((a, o) => (Math.abs(o.nc - pc) + Math.abs(o.nr - pr) < Math.abs(a.nc - pc) + Math.abs(a.nr - pr) ? o : a));
  } else {
    const dm = L.distMap;
    best = choices.reduce((a, o) => (dm[o.nr][o.nc] < dm[a.nr][a.nc] ? o : a));
    if (dm[best.nr][best.nc] === Infinity) best = pick(choices);   // mole unreachable: wander
  }
  m.tc = best.nc; m.tr = best.nr; m.dir = best.dir;
}
function throwBall() {
  const c = colOf(P.x), r = rowOf(P.y);
  const open = d => { const nc = c + DIRS[d][0], nr = r + DIRS[d][1]; return inGrid(nc, nr) && L.dug[nr][nc] && !solidFor(nc, nr); };
  const dir = open(P.dir) ? P.dir : Object.keys(DIRS).find(open);
  if (!dir) { L.ballCool = 0.5; return; }
  L.ball = { x: tc(c), y: tr(r), tc: c + DIRS[dir][0], tr: r + DIRS[dir][1], dir, life: 2.6, trail: [] };
  Sound.throwBall();
}
function updateBall(dt) {
  const b = L.ball;
  b.life -= dt; b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 6) b.trail.shift();
  let step = 300 * dt;
  while (step > 0) {
    const gx = tc(b.tc), gy = tr(b.tr), d = Math.hypot(gx - b.x, gy - b.y);
    if (d > step) { b.x += (gx - b.x) / d * step; b.y += (gy - b.y) / d * step; break; }
    b.x = gx; b.y = gy; step -= d;
    const open = dir => { const nc = b.tc + DIRS[dir][0], nr = b.tr + DIRS[dir][1]; return inGrid(nc, nr) && L.dug[nr][nc] && !solidFor(nc, nr); };
    const nd = open(b.dir) ? b.dir : shuffle(Object.keys(DIRS).filter(x => x !== b.dir && x !== REV[b.dir] && open(x)))[0] || (open(REV[b.dir]) ? REV[b.dir] : null);
    if (!nd) { b.life = 0; break; }
    b.dir = nd; b.tc += DIRS[nd][0]; b.tr += DIRS[nd][1];
  }
  for (const m of L.monsters) if (Math.hypot(m.x - b.x, m.y - b.y) < 22) { killMonster(m, 500); L.ball = null; L.ballCool = 3; return; }
  if (b.life <= 0) { L.ball = null; L.ballCool = 1; }
}
function updateBoulders(dt) {
  for (const b of [...L.boulders]) {
    if (b.state === 'rest') {
      const below = b.r + 1, underPlayer = colOf(P.x) === b.c && rowOf(P.y) === below && P.dead <= 0;
      if (below < ROWS && L.dug[below][b.c] && !boulderAt(b.c, below) && !underPlayer) { b.state = 'wobble'; b.t = 0.7; Sound.wobble(); }
    } else if (b.state === 'wobble') {
      b.t -= dt; if (b.t <= 0) { b.state = 'fall'; b.fallen = 0; b.y = tr(b.r); }
    } else {
      b.y += 270 * dt;
      const bx = tc(b.c);
      if (P.dead <= 0 && Math.abs(P.x - bx) < T * 0.55 && P.y > b.y && P.y - b.y < T * 0.75) killPlayer('Flattened by a boulder!');
      for (const m of [...L.monsters]) if (Math.abs(m.x - bx) < T * 0.55 && m.y > b.y && m.y - b.y < T * 0.75) killMonster(m, 1000);
      if (b.y >= tr(b.r + 1)) {
        b.r++; b.fallen++; L.dug[b.r][b.c] = true;
        const nr = b.r + 1;
        if (nr >= ROWS || !L.dug[nr][b.c] || boulderAt(b.c, nr)) {
          b.y = tr(b.r);
          if (b.fallen >= 2) { L.boulders = L.boulders.filter(x => x !== b); E.particles(bx, b.y, '#9a8f86', 30, 160); Sound.crumble(); }
          else { b.state = 'rest'; Sound.thud(); }
        }
      }
    }
  }
}
function solveRound(cr) {
  cr.broken = true; L.solved = true; L.clearT = 2.4;
  const pts = Math.max(200, 1000 + E.level * 100 - L.wrongs * 200);
  E.correct(pts); Sound.clear();
  E.particles(tc(cr.c), tr(cr.r), cr.col, 50, 260);
  const field = L;
  L.monsters.forEach((m, i) => setTimeout(() => { if (L === field && L.monsters.includes(m)) killMonster(m, 100); }, 250 + i * 160));
}
function wrongCrystal(cr) {
  cr.broken = true; L.wrongs++;
  E.particles(tc(cr.c), tr(cr.r), '#ff4d6d', 30, 200);
  E.wrong(cr.term, 100);
  if (L.wrongs >= 2) L.reveal = true;
  L.spawnT = 0;   // a wrong crystal lets out another blob
}

// ---------- drawing
const hash = (c, r) => { let h = (c * 374761393 + r * 668265263) ^ 0x5bd1e995; h = (h ^ (h >>> 13)) * 1274126177; return (h ^ (h >>> 16)) >>> 0; };
function drawField() {
  const [base, speck, edge] = L.pal, t = E.time;
  ctx.fillStyle = base; ctx.fillRect(X0, Y0, COLS * T, ROWS * T);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const x = X0 + c * T, y = Y0 + r * T;
    if (L.dug[r][c]) { ctx.fillStyle = '#000'; ctx.fillRect(x, y, T, T); continue; }
    const h = hash(c, r);
    ctx.fillStyle = speck;
    for (let k = 0; k < 6; k++) ctx.fillRect(x + ((h >> (k * 4)) & 15) * 3 % (T - 4) + 2, y + ((h >> (k * 3 + 7)) & 15) * 3 % (T - 4) + 2, 3, 3);
    ctx.fillStyle = edge; ctx.fillRect(x + ((h >> 20) & 31) % (T - 6), y + ((h >> 9) & 31) % (T - 6), 4, 2);
  }
  ctx.fillStyle = edge;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (!L.dug[r][c]) continue; const x = X0 + c * T, y = Y0 + r * T;
    if (r > 0 && !L.dug[r - 1][c]) ctx.fillRect(x, y, T, 3);
    if (r < ROWS - 1 && !L.dug[r + 1][c]) ctx.fillRect(x, y + T - 3, T, 3);
    if (c > 0 && !L.dug[r][c - 1]) ctx.fillRect(x, y, 3, T);
    if (c < COLS - 1 && !L.dug[r][c + 1]) ctx.fillRect(x + T - 3, y, 3, T);
  }
  const dx = tc(L.den.c), dy = tr(L.den.r);
  ctx.strokeStyle = '#4a4a4a'; ctx.lineWidth = 3; ctx.strokeRect(dx - 14, dy - 14, 28, 28);
  ctx.fillStyle = '#2a2a2a'; for (let i = -9; i <= 9; i += 6) ctx.fillRect(dx - 10, dy + i - 1, 20, 2);
  ctx.strokeStyle = '#000'; ctx.lineWidth = 4; ctx.strokeRect(X0 - 2, Y0 - 2, COLS * T + 4, ROWS * T + 4);
  for (const k of L.dots) {
    const [c, r] = k.split(',').map(Number), x = tc(c), y = tr(r), a = t * 4 + c + r;
    ctx.strokeStyle = 'rgba(123,223,242,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, 11, 5, a * 0.3, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#7bdff2'; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 11 * Math.cos(a * 0.3), y + Math.sin(a) * 5, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8fbff'; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
  }
}
function drawCrystal(cr) {
  const x = tc(cr.c), y = tr(cr.r), glow = L.reveal && cr.term.id === L.target.id;
  ctx.save(); ctx.translate(x, y);
  if (glow) { ctx.shadowColor = '#38f0c8'; ctx.shadowBlur = 16 + Math.sin(E.time * 8) * 8; }
  ctx.fillStyle = cr.col; ctx.beginPath();
  ctx.moveTo(0, -15); ctx.lineTo(11, -6); ctx.lineTo(11, 7); ctx.lineTo(0, 15); ctx.lineTo(-11, 7); ctx.lineTo(-11, -6); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(11, -6); ctx.lineTo(0, -1); ctx.lineTo(-5, -9); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.moveTo(0, 15); ctx.lineTo(-11, 7); ctx.lineTo(0, 3); ctx.closePath(); ctx.fill();
  if (Math.floor(E.time * 3 + cr.c) % 5 === 0) { ctx.fillStyle = '#fff'; ctx.fillRect(4, -10, 2, 2); }
  ctx.restore();
}
function drawLabel(cr) {
  const glow = L.reveal && cr.term.id === L.target.id;
  // the short label, on two lines if it is wider than three dirt tiles
  if (!cr.fit) cr.fit = fitLabel(cr.term.short, T * 3, 20);
  const bw = cr.fit.w + 8, bh = cr.fit.h + 3;
  const x = clamp(tc(cr.c) - bw / 2, X0 + 4, X0 + COLS * T - bw - 4), y = tr(cr.r) - 16 - bh;
  drawFittedLabel(cr.fit, x, y, glow ? '#38f0c8' : '#fff4e6', cr.col);
}
function drawBoulder(b) {
  const wob = b.state === 'wobble' ? Math.sin(E.time * 40) * 3 : 0;
  const x = tc(b.c) + wob, y = b.state === 'fall' ? b.y : tr(b.r);
  ctx.fillStyle = '#6d645d'; ctx.beginPath(); ctx.arc(x, y + 2, 19, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#9a8f86'; ctx.beginPath(); ctx.arc(x - 2, y, 17, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c2b8ae'; ctx.beginPath(); ctx.arc(x - 7, y - 6, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6d645d'; ctx.fillRect(x + 3, y + 2, 6, 3); ctx.fillRect(x - 6, y + 8, 4, 3);
}
function drawMole(x, y, dir, anim, col) {
  // goggled mole (original sprite)
  ctx.save(); ctx.translate(x, y);
  if (dir === 'up') ctx.rotate(-Math.PI / 2); else if (dir === 'down') ctx.rotate(Math.PI / 2); else if (dir === 'left') ctx.scale(-1, 1);
  ctx.fillStyle = col || '#7a5230'; ctx.beginPath(); ctx.ellipse(-2, 0, 16, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5a3a20'; ctx.beginPath(); ctx.ellipse(-6, 4, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
  const k = Math.sin(anim) * 3;
  ctx.fillStyle = '#ffc2a8'; ctx.fillRect(8, 6 + k, 7, 4); ctx.fillRect(6, -10 - k, 7, 4);
  ctx.fillStyle = '#ff8fb1'; ctx.beginPath(); ctx.arc(16, 0, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222'; ctx.fillRect(-4, -9, 14, 3);
  ctx.fillStyle = '#38f0c8'; ctx.beginPath(); ctx.arc(7, -6, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(7, -8, 2, 2);
  ctx.restore();
}
function drawMonster(m) {
  const sq = Math.sin(m.wob) * 2;
  ctx.save(); ctx.translate(m.x, m.y);
  ctx.fillStyle = m.digger ? (Math.floor(E.time * 8) % 2 ? '#ff4dc4' : '#c23b97') : '#8ee000';
  ctx.beginPath();
  ctx.moveTo(-15, 12); ctx.quadraticCurveTo(-17, -16 - sq, 0, -15 - sq); ctx.quadraticCurveTo(17, -16 - sq, 15, 12);
  for (let i = 0; i < 4; i++) ctx.lineTo(15 - (i + 0.5) * 7.5, 12 + (i % 2 ? -3 : 3) + sq * 0.5);
  ctx.closePath(); ctx.fill();
  const ex = clamp((P.x - m.x) / 40, -2, 2), ey = clamp((P.y - m.y) / 40, -2, 2);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-5, -4, 5, 0, Math.PI * 2); ctx.arc(6, -4, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#000'; ctx.fillRect(-6 + ex, -5 + ey, 3, 3); ctx.fillRect(5 + ex, -5 + ey, 3, 3);
  if (m.digger) {
    ctx.fillStyle = '#ddd'; ctx.rotate({ left: Math.PI, right: 0, up: -Math.PI / 2, down: Math.PI / 2 }[m.dir] || 0);
    ctx.beginPath(); ctx.moveTo(15, -6); ctx.lineTo(25, 0); ctx.lineTo(15, 6); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

registerStage({
  id: 'mole-hole', name: 'MOLE HOLE', color: '#ffb347', hudLabel: 'DIG TO THE TERM:', fourWay: true, chip: 'sn',
  cart: {   // pixel sprite for the Free Play cartridge label
    icon: ['....#####....',
           '..#########..',
           '.####kkkkkk..',
           '.###kggkgg#..',
           '####kgwkgw##n',
           '#############',
           '.###########.',
           '..#########..',
           '...c.....c...'],
    pal: { '#': '#5a3a20', k: '#1b1f2a', g: '#38f0c8', w: '#ffffff', n: '#ff8fb1', c: '#ffe0cc' }
  },
  howTo: ['Tunnel to the crystal whose term matches the clue.', 'Dig: arrows or WASD.  Space throws the bouncing catalyst.', 'Dig under a boulder to drop it on the grime blobs.'],
  start(target) { newField(target); },
  respawn() { if (L.solved) return E.nextRound(); resetPlayer(); },
  isDying: () => P && P.dead > 0,
  isSolved: () => L && L.solved,
  choices: () => L.crystals.filter(c => !c.broken).map(c => ({ text: c.term.short, color: c.col })),   // for the portrait strip
  hudColor: () => L ? L.pal[0] : '#8a4f1d',

  update(dt, inp) {
    if (L.solved) { updateBoulders(dt); L.clearT -= dt; if (L.clearT <= 0) E.nextRound(); return; }
    updateBoulders(dt);
    if (P.dead > 0) {
      P.dead -= dt;
      if (P.dead < 0.8 && !P.burst) { P.burst = true; E.particles(P.x, P.y, '#ffb347', 50, 220); }
      if (P.dead <= 0) E.deathDone();
      return;
    }
    P.inv = Math.max(0, P.inv - dt);
    // the mole
    const pc = colOf(P.x), pr = rowOf(P.y);
    let digging = false;
    if (inp.dir) { const [dx, dy] = DIRS[inp.dir]; digging = inGrid(pc + dx, pr + dy) && !L.dug[pr + dy][pc + dx]; }
    P.moving = moveLane(P, inp.dir, (digging ? 82 : 125) * dt, (c, r) => !solidFor(c, r));
    if (P.moving) { P.anim += dt * 12; beat -= dt; if (beat <= 0) { beat = 0.15; Sound.musicStep(); } }
    const c = colOf(P.x), r = rowOf(P.y);
    if (inGrid(c, r) && !L.dug[r][c]) { L.dug[r][c] = true; if (Math.random() < 0.4) E.particles(P.x, P.y, L.pal[1], 3, 60); }
    const dk = `${c},${r}`;
    if (L.dots.has(dk) && Math.abs(P.x - tc(c)) < 14 && Math.abs(P.y - tr(r)) < 14) {
      L.dots.delete(dk); E.addScore(50); Sound.electron();
      if (L.dots.size === 0) { E.addScore(1000); E.banner('ALL ELECTRONS +1000', '#7bdff2', '', 1.6); }
    }
    for (const cr of L.crystals) {
      if (cr.broken || Math.hypot(P.x - tc(cr.c), P.y - tr(cr.r)) > 16) continue;
      if (cr.term.id === L.target.id) return solveRound(cr);
      wrongCrystal(cr);
    }
    // catalyst
    L.ballCool = Math.max(0, L.ballCool - dt);
    if (inp.fire && !L.ball && L.ballCool <= 0) throwBall();
    if (L.ball) updateBall(dt);
    // grime blobs
    L.distT -= dt; if (L.distT <= 0 || !L.distMap) { L.distMap = buildDistMap(); L.distT = 0.25; }
    L.spawnT -= dt;
    if (L.spawnT <= 0 && L.monsters.length < Math.min(3 + Math.floor(E.level / 2) + L.wrongs, 7)) { spawnMonster(); L.spawnT = Math.max(2, 5 - E.level * 0.3); }
    L.diggerT -= dt;
    if (L.diggerT <= 0) {
      const cand = L.monsters.filter(m => !m.digger); if (cand.length) { pick(cand).digger = 6; Sound.digger(); }
      L.diggerT = Math.max(6, 13 - E.level);
    }
    for (const m of L.monsters) {
      updateMonster(m, dt);
      if (P.inv <= 0 && Math.hypot(m.x - P.x, m.y - P.y) < 30) return killPlayer('Caught by the grime!');
    }
  },

  draw() {
    drawField();
    for (const cr of L.crystals) if (!cr.broken) drawCrystal(cr);
    for (const b of L.boulders) drawBoulder(b);
    if (L.ball) {
      L.ball.trail.forEach((t, i) => { ctx.globalAlpha = i / 8; ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(t.x, t.y, 4, 0, Math.PI * 2); ctx.fill(); });
      ctx.globalAlpha = 1; ctx.fillStyle = '#fff6b0'; ctx.beginPath(); ctx.arc(L.ball.x, L.ball.y, 6, 0, Math.PI * 2); ctx.fill();
    }
    for (const m of L.monsters) drawMonster(m);
    const ready = G.ready || G.state === 'card';
    if (P.dead <= 0 && !(P.inv > 0 && !ready && Math.floor(E.time * 12) % 2)) drawMole(P.x, P.y, P.dir, P.anim);
    if (P.dead > 0 && !P.burst) { const zc = ['#ffffff', '#ff4d6d', '#ffd23f', '#38f0c8', '#c77dff']; drawMole(P.x, P.y, P.dir, 0, zc[Math.floor(E.time * 24) % zc.length]); }
    for (const cr of L.crystals) if (!cr.broken) drawLabel(cr);
  },
  drawHud() {
    const rdy = !L.ball && L.ballCool <= 0;
    ctx.fillStyle = rdy ? '#ffd23f' : '#4a3f36'; ctx.beginPath(); ctx.arc(W - 22, 66, 6, 0, Math.PI * 2); ctx.fill();
    ctx.font = '16px VT323, monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillStyle = rdy ? '#ffd23f' : '#7a6a5d';
    ctx.fillText(rdy ? 'CATALYST' : 'RECHARGING', W - 34, 58); ctx.textAlign = 'left';
  },
  drawLifeIcon(x, y) { ctx.save(); ctx.translate(x, y + 4); ctx.scale(0.42, 0.42); drawMole(0, 0, 'left', 0); ctx.restore(); }
});
})();
