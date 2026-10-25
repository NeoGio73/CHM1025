// Stage: ROBO-LAB, an early-80s style maze shooter. Zap the robot carrying the matching term.
(() => {
"use strict";
const MX = 16, MY = HUD_H + 6;          // maze origin
const COLS = 5, ROWS = 3;
const CW = (W - MX * 2) / COLS, CH = (H - MY - 14) / ROWS;
const WT = 6, DOOR = 64;                // wall thickness, door opening
const OPP = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };
const LEVEL_COLORS = ['#ffd23f', '#ff8c42', '#38f0c8', '#c77dff', '#ff4d6d', '#7bdff2', '#b5e48c', '#ffffff'];
const WALL_COLORS = ['#2b59ff', '#00a6a6', '#7a3cff', '#1f8a4c', '#b8336a', '#3d5a80'];
let R = null, P = null;   // room and player

// Outer walls with a door gap on each side; interior posts each grow a wall segment in a random
// direction. Regenerated until every cell is reachable.
function makeMaze(entrySide) {
  for (let tries = 0; tries < 200; tries++) {
    const walls = [];
    const x0 = MX, y0 = MY, x1 = MX + COLS * CW, y1 = MY + ROWS * CH;
    const midX = MX + CW * 2.5, midY = MY + CH * 1.5;
    walls.push({ x: x0, y: y0, w: midX - DOOR / 2 - x0, h: WT }, { x: midX + DOOR / 2, y: y0, w: x1 - midX - DOOR / 2, h: WT });
    walls.push({ x: x0, y: y1 - WT, w: midX - DOOR / 2 - x0, h: WT }, { x: midX + DOOR / 2, y: y1 - WT, w: x1 - midX - DOOR / 2, h: WT });
    walls.push({ x: x0, y: y0, w: WT, h: midY - DOOR / 2 - y0 }, { x: x0, y: midY + DOOR / 2, w: WT, h: y1 - midY - DOOR / 2 });
    walls.push({ x: x1 - WT, y: y0, w: WT, h: midY - DOOR / 2 - y0 }, { x: x1 - WT, y: midY + DOOR / 2, w: WT, h: y1 - midY - DOOR / 2 });
    const vEdge = [...Array(ROWS)].map(() => Array(COLS).fill(false));
    const hEdge = [...Array(ROWS)].map(() => Array(COLS).fill(false));
    for (let pr = 1; pr < ROWS; pr++) for (let pc = 1; pc < COLS; pc++) {
      const px = MX + pc * CW, py = MY + pr * CH, dir = ri(0, 3);
      if (dir === 0) { walls.push({ x: px - WT / 2, y: py - CH, w: WT, h: CH + WT / 2 }); vEdge[pr - 1][pc - 1] = true; }
      if (dir === 1) { walls.push({ x: px - WT / 2, y: py - WT / 2, w: WT, h: CH }); vEdge[pr][pc - 1] = true; }
      if (dir === 2) { walls.push({ x: px - CW, y: py - WT / 2, w: CW + WT / 2, h: WT }); hEdge[pr - 1][pc - 1] = true; }
      if (dir === 3) { walls.push({ x: px - WT / 2, y: py - WT / 2, w: CW, h: WT }); hEdge[pr - 1][pc] = true; }
    }
    const seen = new Set(['1,2']), q = [[1, 2]];
    while (q.length) {
      const [r, c] = q.shift(), nb = [];
      if (c < COLS - 1 && !vEdge[r][c]) nb.push([r, c + 1]);
      if (c > 0 && !vEdge[r][c - 1]) nb.push([r, c - 1]);
      if (r < ROWS - 1 && !hEdge[r][c]) nb.push([r + 1, c]);
      if (r > 0 && !hEdge[r - 1][c]) nb.push([r - 1, c]);
      for (const n of nb) { const k = n.join(); if (!seen.has(k)) { seen.add(k); q.push(n); } }
    }
    if (seen.size !== ROWS * COLS) continue;
    const doors = {
      left:   { x: x0 - 2, y: midY - DOOR / 2, w: WT + 4, h: DOOR },
      right:  { x: x1 - WT - 2, y: midY - DOOR / 2, w: WT + 4, h: DOOR },
      top:    { x: midX - DOOR / 2, y: y0 - 2, w: DOOR, h: WT + 4 },
      bottom: { x: midX - DOOR / 2, y: y1 - WT - 2, w: DOOR, h: WT + 4 }
    };
    return { walls, doors, entry: entrySide };
  }
}
const cellCenter = (r, c) => ({ x: MX + c * CW + CW / 2, y: MY + r * CH + CH / 2 });
const entryCell = side => ({ left: [1, 0], right: [1, 4], top: [0, 2], bottom: [2, 2] }[side] || [1, 0]);

function buildRoom(fromSide, target) {
  const maze = makeMaze(fromSide);
  const nRobots = clamp(3 + Math.ceil(E.level / 2), 4, 7);
  const terms = shuffle([target, ...E.distractors(target, nRobots - 1)]);
  const [er, ec] = entryCell(fromSide);
  const cells = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (Math.abs(r - er) + Math.abs(c - ec) > 1) cells.push([r, c]);
  shuffle(cells);
  const robots = terms.map((term, i) => {
    const [r, c] = cells[i % cells.length], cc = cellCenter(r, c);
    return { x: cc.x - 9 + rand(-20, 20), y: cc.y - 11 + rand(-25, 25), w: 18, h: 22, term,
      alive: true, cool: rand(1.5, 3.5), angry: 0, flash: 0, wrongHit: false, eye: rand(0, 6) };
  });
  const lv = E.level;
  R = { maze, target, robots, solved: false, doorsOpen: false, time: 0, wrongs: 0, reveal: false,
        radical: null, radicalAt: Math.max(9, 20 - lv * 1.5), bullets: [], rbullets: [],
        color: LEVEL_COLORS[(lv - 1) % LEVEL_COLORS.length], wall: WALL_COLORS[(lv - 1) % WALL_COLORS.length] };
  placePlayer();
}
function placePlayer() {
  const side = R.maze.entry, [er, ec] = entryCell(side), sp = cellCenter(er, ec);
  const off = { left: [-CW / 2 + 24, 0], right: [CW / 2 - 36, 0], top: [0, -CH / 2 + 22], bottom: [0, CH / 2 - 46] }[side];
  P = { x: sp.x + off[0] - 6, y: sp.y + off[1] - 12, w: 12, h: 24, face: { x: OPP[side] === 'left' ? -1 : 1, y: 0 },
        cool: 0, walk: 0, dead: 0, burst: false, inv: 1.2 };
  if (side === 'top') P.face = { x: 0, y: 1 }; if (side === 'bottom') P.face = { x: 0, y: -1 };
}

const solidAt = rect => R.maze.walls.some(w => hit(rect, w));
const doorBlocked = side => side === R.maze.entry || !R.doorsOpen;   // the way you came in stays sealed

function killPlayer(why) { if (P.dead > 0) return; P.dead = 2.2; P.burst = false; E.kill(why); }
function explodeRobot(r) { r.alive = false; E.particles(r.x + r.w / 2, r.y + r.h / 2, R.color, 30, 200); Sound.boom(); }

function shootRobot(r) {
  if (R.solved) { explodeRobot(r); E.addScore(50); return; }
  if (r.term.id === R.target.id) {
    R.solved = true; R.doorsOpen = true;
    explodeRobot(r);
    const pts = Math.max(100, 500 + E.level * 100 + Math.max(0, Math.round((R.radicalAt - R.time) * 20)) - R.wrongs * 100);
    E.correct(pts); Sound.correct(); setTimeout(() => Sound.door(), 350);
    const room = R;
    R.robots.filter(o => o.alive).forEach((o, i) => setTimeout(() => { if (o.alive && R === room) { explodeRobot(o); E.addScore(50); } }, 300 + i * 180));
  } else {
    R.wrongs++; r.angry = 1; r.flash = 0.6; r.wrongHit = true;
    E.wrong(r.term, 50); Voice.say('wrong');
    if (R.wrongs >= 3) R.reveal = true;   // after 3 misses the right robot glows
  }
}
function exitRoom() {
  const cx = P.x + P.w / 2, cy = P.y + P.h / 2;
  const side = cx < MX ? 'left' : cx > MX + COLS * CW ? 'right' : cy < MY ? 'top' : 'bottom';
  if (R.solved) E.addScore(R.robots.every(r => !r.alive) ? 100 : 0);
  else { E.skip(); Voice.say('flee'); }
  Sound.exit();
  E.nextRound({ from: OPP[side] });
}

function drawPerson(x, y, s, color, walk) {
  // lab-coat scientist with goggles (original sprite)
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = color;
  ctx.fillRect(-4, -12, 8, 8);
  ctx.fillStyle = '#000'; ctx.fillRect(-3, -9, 6, 2); ctx.fillStyle = color;
  ctx.fillRect(-6, -3, 12, 13);
  const k = Math.sin(walk) * 4;
  ctx.fillRect(-5 + k * 0.3, 10, 3, 9 + Math.max(0, k)); ctx.fillRect(2 - k * 0.3, 10, 3, 9 + Math.max(0, -k));
  ctx.fillRect(-9, -2, 3, 9); ctx.fillRect(6, -2, 3, 9);
  ctx.restore();
}
function drawRobot(r) {
  const glow = R.reveal && r.term.id === R.target.id;
  const col = r.flash > 0 && Math.floor(r.flash * 20) % 2 ? '#ffffff' : (r.angry ? '#ff4d6d' : R.color);
  ctx.save(); ctx.translate(Math.round(r.x), Math.round(r.y));
  if (glow) { ctx.shadowColor = '#38f0c8'; ctx.shadowBlur = 14 + Math.sin(E.time * 8) * 6; }
  ctx.fillStyle = col;
  ctx.fillRect(7, -4, 4, 4); ctx.fillRect(8, -7, 2, 3);
  ctx.fillRect(2, 0, 14, 8);
  ctx.fillStyle = '#000'; ctx.fillRect(4 + Math.round((Math.sin(r.eye) + 1) * 3.5), 3, 3, 2);
  ctx.fillStyle = col;
  ctx.fillRect(0, 9, 18, 8);
  ctx.fillStyle = '#000'; ctx.fillRect(4, 11, 10, 3); ctx.fillStyle = col;
  ctx.fillRect(-3, 10, 3, 6); ctx.fillRect(18, 10, 3, 6);
  ctx.fillRect(3, 17, 4, 5); ctx.fillRect(11, 17, 4, 5);
  ctx.restore();
  ctx.font = '19px VT323'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  const label = r.term.short, tw = ctx.measureText(label).width;
  const lx = clamp(r.x + r.w / 2, MX + tw / 2 + 6, MX + COLS * CW - tw / 2 - 6), ly = r.y - 9;
  ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(lx - tw / 2 - 4, ly - 17, tw + 8, 18);
  ctx.fillStyle = r.wrongHit ? '#ff4d6d' : (glow ? '#38f0c8' : '#e8f6ff'); ctx.fillText(label, lx, ly + 1);
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
}
function drawRadical(rd) {
  // a nucleus with one lonely, unpaired electron
  ctx.save(); ctx.translate(rd.x, rd.y);
  const sq = 1 + Math.max(0, 0.25 - Math.abs(Math.sin(rd.ph))) * 1.2; ctx.scale(sq, 1 / sq);
  ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 0, 16, 7, E.time * 2, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 0, 16, 7, -E.time * 2 + 1, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#000'; ctx.fillRect(-4, -3, 2, 2); ctx.fillRect(2, -3, 2, 2); ctx.fillRect(-3, 2, 6, 1);
  const a = E.time * 5; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(Math.cos(a) * 16, Math.sin(a) * 7, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

registerStage({
  id: 'robo-lab', name: 'ROBO-LAB', color: '#38f0c8', hudLabel: 'FIND THE TERM:', fourWay: false,
  cart: {   // pixel sprite for the Free Play cartridge label
    icon: ['.....r.....',
           '....rrr....',
           '..#######..',
           '..#e#####..',
           '..#######..',
           '...........',
           '#.#######.#',
           '#.#.....#.#',
           '..#######..',
           '..##...##..',
           '..##...##..'],
    pal: { '#': '#1b1f2a', r: '#ff4d6d', e: '#ffd23f' }
  },
  howTo: ['Zap the robot carrying the term that matches the clue.', 'Move: arrows or WASD.  Fire: space, the way you face.', 'Walls are electrified. Dawdle and the Free Radical comes.'],
  start(target, info) {
    buildRoom((info && info.from) || 'left', target);
    if (!(info && info.fresh)) Voice.say('enter');
  },
  respawn() {
    // same question after a death; if it was already answered, move on to a new one
    if (R.solved) return E.nextRound({ from: R.maze.entry });
    buildRoom(R.maze.entry, R.target);
  },
  isDying: () => P && P.dead > 0,
  isSolved: () => R && R.solved,
  hudColor: () => R ? R.wall : '#2b59ff',

  update(dt, inp) {
    if (P.dead > 0) {
      P.dead -= dt;
      if (P.dead < 0.8 && !P.burst) { P.burst = true; E.particles(P.x + P.w / 2, P.y + P.h / 2, '#38f0c8', 50, 240); }
      if (P.dead <= 0) E.deathDone();
      return;
    }
    R.time += dt; P.inv = Math.max(0, P.inv - dt);
    // move
    if (inp.x || inp.y) {
      P.face = { x: inp.x, y: inp.y };
      const len = Math.hypot(inp.x, inp.y);
      P.x += inp.x / len * 125 * dt; P.y += inp.y / len * 125 * dt; P.walk += dt * 10;
    }
    if (P.inv <= 0 && solidAt(P)) return killPlayer('Touched an electrified wall!');
    for (const side in R.maze.doors) if (hit(P, R.maze.doors[side]) && doorBlocked(side) && P.inv <= 0) return killPlayer('That door is sealed!');
    if (P.x + P.w < MX || P.x > MX + COLS * CW || P.y + P.h < MY || P.y > MY + ROWS * CH) return exitRoom();
    // fire
    P.cool -= dt;
    if (inp.fire && P.cool <= 0 && R.bullets.length < 2) {
      const f = P.face, len = Math.hypot(f.x, f.y) || 1;
      R.bullets.push({ x: P.x + P.w / 2, y: P.y + 8, vx: f.x / len * 520, vy: f.y / len * 520, life: 1.2 });
      P.cool = 0.28; Sound.zap();
    }
    for (const b of R.bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      const br = { x: b.x - 2, y: b.y - 2, w: 4, h: 4 };
      if (solidAt(br)) { b.life = 0; E.particles(b.x, b.y, R.wall, 4, 60); continue; }
      for (const r of R.robots) if (r.alive && hit(br, r)) { b.life = 0; shootRobot(r); break; }
    }
    R.bullets = R.bullets.filter(b => b.life > 0);
    // robots
    const alive = R.robots.filter(r => r.alive);
    for (const r of alive) {
      r.flash = Math.max(0, r.flash - dt); r.eye += dt * 4;
      const dx = (P.x + P.w / 2) - (r.x + r.w / 2), dy = (P.y + P.h / 2) - (r.y + r.h / 2);
      const spd = (14 + E.level * 3) * (r.angry ? 2.2 : 1) * (R.time < 1.2 ? 0 : 1);
      const step = (ax, ay) => {
        const n = { x: r.x + ax, y: r.y + ay, w: r.w, h: r.h };
        if (!solidAt(n) && !alive.some(o => o !== r && hit(n, o)) && n.x > MX && n.y > MY && n.x + n.w < MX + COLS * CW && n.y + n.h < MY + ROWS * CH) { r.x = n.x; r.y = n.y; }
      };
      if (Math.abs(dx) > 4) step(Math.sign(dx) * spd * dt, 0);
      if (Math.abs(dy) > 4) step(0, Math.sign(dy) * spd * dt);
      r.cool -= dt;
      const aligned = Math.abs(dx) < 14 || Math.abs(dy) < 14 || Math.abs(Math.abs(dx) - Math.abs(dy)) < 18;
      if (r.cool <= 0 && aligned && R.time > 1.5 && R.rbullets.length < 1 + Math.floor(E.level / 2) && Math.hypot(dx, dy) < 420) {
        const sx = Math.abs(dx) < 14 ? 0 : Math.sign(dx), sy = Math.abs(dy) < 14 ? 0 : Math.sign(dy);
        const l = Math.hypot(sx, sy) || 1, bs = 170 + E.level * 15;
        R.rbullets.push({ x: r.x + r.w / 2, y: r.y + 10, vx: sx / l * bs, vy: sy / l * bs, life: 2.5 });
        r.cool = rand(1.6, 3.2) / (r.angry ? 1.8 : 1) / (1 + E.level * 0.08);
        Sound.robotZap();
      }
      if (P.inv <= 0 && hit(P, r)) return killPlayer('Grabbed by a robot!');
    }
    for (const b of R.rbullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      const br = { x: b.x - 2, y: b.y - 2, w: 4, h: 4 };
      if (solidAt(br)) b.life = 0;
      else if (P.inv <= 0 && hit(br, P)) { b.life = 0; return killPlayer('Zapped by a robot!'); }
      for (const pb of R.bullets) if (Math.hypot(pb.x - b.x, pb.y - b.y) < 7) { pb.life = 0; b.life = 0; E.particles(b.x, b.y, '#fff', 6, 80); }
    }
    R.rbullets = R.rbullets.filter(b => b.life > 0);
    // the Free Radical: enters from the door farthest from the player
    if (!R.radical && R.time > R.radicalAt) {
      const d = Object.values(R.maze.doors).reduce((best, door) => { const dist = Math.hypot(door.x - P.x, door.y - P.y); return dist > best.dist ? { door, dist } : best; }, { door: null, dist: -1 }).door;
      R.radical = { x: d.x + d.w / 2, y: d.y + d.h / 2, base: d.y + d.h / 2, ph: 0, bounceT: 0 };
      R.doorsOpen = true; Sound.radical(); Voice.say('radical');
      E.banner('FREE RADICAL!', '#ff4d6d', 'Doors unlocked. Run, or answer and run.', 2.2);
    }
    if (R.radical) {
      const rd = R.radical, tx = P.x + P.w / 2, ty = P.y + P.h / 2;
      const sp = 55 + E.level * 6 + R.time * 0.6, a = Math.atan2(ty - rd.base, tx - rd.x);
      rd.x += Math.cos(a) * sp * dt; rd.base += Math.sin(a) * sp * dt;
      rd.ph += dt * 6; rd.y = rd.base - Math.abs(Math.sin(rd.ph)) * 26;
      if (Math.abs(Math.sin(rd.ph)) < 0.08 && E.time - rd.bounceT > 0.2) { rd.bounceT = E.time; Sound.bounce(); }
      if (P.inv <= 0 && Math.hypot(tx - rd.x, ty - rd.y) < 18) return killPlayer('Caught by the Free Radical!');
    }
  },

  draw() {
    const t = E.time;
    ctx.fillStyle = R.wall;
    for (const w of R.maze.walls) ctx.fillRect(w.x, w.y, w.w, w.h);
    for (const side in R.maze.doors) {
      const d = R.maze.doors[side];
      if (doorBlocked(side)) {
        ctx.fillStyle = side === R.maze.entry ? '#5d6b80' : (Math.floor(t * 4) % 2 ? '#ff4d6d' : '#7a1f30');
        ctx.fillRect(d.x + (d.w > d.h ? 0 : 1), d.y + (d.w > d.h ? 1 : 0), d.w - (d.w > d.h ? 0 : 2), d.h - (d.w > d.h ? 2 : 0));
      } else if (Math.floor(t * 3) % 2) {
        ctx.fillStyle = '#38f0c8'; ctx.font = '14px "Press Start 2P"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const ax = d.x + d.w / 2 + ({ left: 14, right: -14 }[side] || 0), ay = d.y + d.h / 2 + ({ top: 14, bottom: -14 }[side] || 0);
        ctx.fillText({ left: '◀', right: '▶', top: '▲', bottom: '▼' }[side], ax, ay); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      }
    }
    for (const r of R.robots) if (r.alive) drawRobot(r);
    ctx.fillStyle = '#ffffff';
    for (const b of R.bullets) { const l = Math.hypot(b.vx, b.vy); ctx.fillRect(b.x - b.vx / l * 6 - 1.5, b.y - b.vy / l * 6 - 1.5, 3, 3); ctx.fillRect(b.x - 1.5, b.y - 1.5, 3, 3); }
    ctx.fillStyle = R.color;
    for (const b of R.rbullets) ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
    const ready = G.ready || G.state === 'card';
    if (P.dead <= 0 && !(P.inv > 0 && !ready && Math.floor(t * 12) % 2)) drawPerson(P.x + P.w / 2, P.y + 12, 1, '#38f0c8', P.walk);
    if (P.dead > 0 && !P.burst) { const zc = ['#ffffff', '#ff4d6d', '#ffd23f', '#38f0c8', '#c77dff', '#2b59ff']; drawPerson(P.x + P.w / 2, P.y + 12, 1, zc[Math.floor(t * 24) % zc.length], 0); }
    if (R.radical) drawRadical(R.radical);
  },
  drawHud() {
    if (!R.radical && !R.solved && !G.ready) {
      const f = clamp(1 - R.time / R.radicalAt, 0, 1);
      ctx.fillStyle = '#1d2636'; ctx.fillRect(14, HUD_H - 10, W - 28, 4);
      ctx.fillStyle = f < 0.25 ? '#ff4d6d' : '#5d6b80'; ctx.fillRect(14, HUD_H - 10, (W - 28) * f, 4);
    }
  },
  drawLifeIcon(x, y) { drawPerson(x, y, 0.55, '#38f0c8', 0); }
});
})();
