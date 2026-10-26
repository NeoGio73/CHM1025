// Stage: ISOTOPE, an early-80s style isometric fortress flyer. Fly through the force-field gate whose
// term matches the clue, minding your altitude and your fuel.
(() => {
"use strict";
// World: x = across the fortress (0..LW), z = forward, alt = height. Drawn in a slanted (isometric-
// style) view: forward runs to the upper right, across runs to the lower right, height straight up.
const LW = 240, ALT_MAX = 120, WALL_H = 130;
const OX = 40, OY = 440;
const FX = 0.9, FY = -0.32, LX = 0.72, LY = 0.34;
const SHIP_REL = 150;                       // the ship sits this far ahead of the camera
const GATE_REL = 600;                       // new gates appear this far ahead
const GATE_COLS = ['#38f0c8', '#ff5ec4', '#ffd23f'];
let S = null, P = null, fuel = 100;

const proj = (x, rel, alt) => [OX + rel * FX + x * LX, OY + rel * FY + x * LY - alt];
const shipZ = () => S.camZ + SHIP_REL;

function makeGate(z, terms) {
  // openings spread across the fortress, each at its own height band
  const xs = shuffle([48, 120, 192]), bands = shuffle([8, 38, 70]);
  const openings = terms.map((term, i) => ({ term, x: xs[i], w: 58, lo: bands[i], hi: bands[i] + 48, col: GATE_COLS[i] }));
  // letters as well as colours (for colour-blind players): A, B, C from left to right across the wall
  openings.sort((a, b) => a.x - b.x).forEach((o, i) => { o.mark = 'ABC'[i]; });
  return { z, flash: 0, openings };
}
function buildCourse(fresh) {
  const z0 = S.camZ;
  const terms = S.choices.filter(t => !S.gone.has(t.id));
  S.gate = makeGate(z0 + (fresh ? GATE_REL : 430), terms);
  S.barrier = fresh && Math.random() < 0.75 ? { z: z0 + 330, lo: pick([22, 46, 70]), h: 12 } : null;
  S.turrets = []; S.tanks = [];
  if (fresh) {
    for (let i = 0; i < 1 + Math.floor(E.level / 2); i++) S.turrets.push({ x: rand(30, LW - 30), z: z0 + rand(260, 540), alive: true, cool: rand(0.6, 1.6) });
    for (let i = 0; i < 2; i++) S.tanks.push({ x: rand(30, LW - 30), z: z0 + rand(200, 540), alive: true });
  }
  S.ebullets = []; S.bullets = [];
}
function buildRound(target, fresh) {
  S = { target, choices: shuffle([target, ...E.distractors(target, 2)]), gone: new Set(), camZ: 0, gate: null, barrier: null,
        turrets: [], tanks: [], bullets: [], ebullets: [], solved: false, clearT: 0, wrongs: 0, reveal: false, lowBeep: 0 };
  if (fresh) fuel = 100;
  buildCourse(true);
  resetShip();
}
function resetShip() { P = { x: LW / 2, alt: 60, dead: 0, burst: false, inv: 1.5, cool: 0, bank: 0 }; }

function killShip(why) {
  if (P.dead > 0 || S.solved) return;
  P.dead = 2.2; P.burst = false; Sound.explode(); E.kill(why);
}

// ---------- drawing
function poly(pts, fill, stroke) {
  ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}
function drawFloor() {
  const near = -80, far = 1100;
  poly([proj(0, near, 0), proj(LW, near, 0), proj(LW, far, 0), proj(0, far, 0)], '#18233d');
  // scrolling grid
  ctx.strokeStyle = '#27365c'; ctx.lineWidth = 1;
  const step = 60, first = Math.ceil((S.camZ + near) / step) * step;
  for (let z = first; z < S.camZ + far; z += step) { const a = proj(0, z - S.camZ, 0), b = proj(LW, z - S.camZ, 0); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  for (let x = 0; x <= LW; x += 60) { const a = proj(x, near, 0), b = proj(x, far, 0); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  // the fortress's side wall (far side) and lip (near side)
  poly([proj(0, near, 0), proj(0, far, 0), proj(0, far, 26), proj(0, near, 26)], '#33467a');
  poly([proj(LW, near, 0), proj(LW, far, 0), proj(LW, far, -10), proj(LW, near, -10)], '#0f1626');
}
function drawGate(g) {
  const rel = g.z - S.camZ;
  const outer = [proj(0, rel, 0), proj(LW, rel, 0), proj(LW, rel, WALL_H), proj(0, rel, WALL_H)];
  // force field with the openings cut out
  ctx.beginPath(); outer.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
  for (const o of g.openings) {
    const pts = [proj(o.x - o.w / 2, rel, o.lo), proj(o.x - o.w / 2, rel, o.hi), proj(o.x + o.w / 2, rel, o.hi), proj(o.x + o.w / 2, rel, o.lo)];
    ctx.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(([x, y]) => ctx.lineTo(x, y)); ctx.closePath();
  }
  const shimmer = 0.32 + Math.sin(E.time * 8) * 0.06 + (g.flash > 0 ? 0.4 : 0);
  ctx.fillStyle = g.flash > 0 ? `rgba(255,77,109,${shimmer})` : `rgba(123,150,255,${shimmer})`; ctx.fill('evenodd');
  ctx.strokeStyle = '#9fb3ff'; ctx.lineWidth = 2; poly(outer, null, '#9fb3ff');
  for (const o of g.openings) {
    const glow = S.reveal && o.term.id === S.target.id;
    ctx.lineWidth = glow ? 4 : 3;
    poly([proj(o.x - o.w / 2, rel, o.lo), proj(o.x - o.w / 2, rel, o.hi), proj(o.x + o.w / 2, rel, o.hi), proj(o.x + o.w / 2, rel, o.lo)], null, glow && Math.floor(E.time * 6) % 2 ? '#ffffff' : o.col);
    // the opening's letter, in the middle of the opening
    const [mx, my] = proj(o.x, rel, (o.lo + o.hi) / 2);
    ctx.font = '14px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.strokeText(o.mark, mx, my);
    ctx.fillStyle = o.col; ctx.fillText(o.mark, mx, my);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  }
  // pylons
  for (const x of [0, LW]) poly([proj(x, rel - 6, 0), proj(x, rel + 6, 0), proj(x, rel + 6, WALL_H + 10), proj(x, rel - 6, WALL_H + 10)], '#5a6a99');
}
function drawBarrier(b) {
  const rel = b.z - S.camZ;
  for (const x of [0, LW]) poly([proj(x, rel - 5, 0), proj(x, rel + 5, 0), proj(x, rel + 5, b.lo + b.h + 16), proj(x, rel - 5, b.lo + b.h + 16)], '#7a5a99');
  const a = proj(0, rel, b.lo + b.h / 2), c = proj(LW, rel, b.lo + b.h / 2);
  ctx.strokeStyle = Math.floor(E.time * 20) % 2 ? '#ffffff' : '#c77dff'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(a[0], a[1]);
  for (let i = 1; i <= 12; i++) { const k = i / 12; ctx.lineTo(a[0] + (c[0] - a[0]) * k + (i < 12 ? rand(-3, 3) : 0), a[1] + (c[1] - a[1]) * k + (i < 12 ? rand(-5, 5) : 0)); }
  ctx.stroke();
}
function drawTurret(t) {
  const rel = t.z - S.camZ, [x, y] = proj(t.x, rel, 0);
  ctx.fillStyle = '#2a2f40'; ctx.beginPath(); ctx.ellipse(x, y, 13, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8a93ad'; ctx.fillRect(x - 8, y - 14, 16, 12); ctx.fillStyle = '#ff4d6d'; ctx.fillRect(x - 3, y - 20, 6, 8);
}
function drawTank(t) {
  const rel = t.z - S.camZ, [x, y] = proj(t.x, rel, 0);
  ctx.fillStyle = '#2a2f40'; ctx.beginPath(); ctx.ellipse(x, y, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffb347'; ctx.fillRect(x - 9, y - 18, 18, 16); ctx.fillStyle = '#000'; ctx.font = '12px VT323, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('FUEL', x, y - 10); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
}
function drawShip(x, alt, bank, col) {
  // a small jet seen from the slanted view (original sprite); nose points "forward"
  const [cx, cy] = proj(x, SHIP_REL, alt);
  const f = [FX * 28, FY * 28], l = [LX * 17, LY * 17];
  const nose = [cx + f[0], cy + f[1]], tail = [cx - f[0] * 0.7, cy - f[1] * 0.7];
  const wl = [cx - l[0] - f[0] * 0.3, cy - l[1] - f[1] * 0.3 - bank * 3], wr = [cx + l[0] - f[0] * 0.3, cy + l[1] - f[1] * 0.3 + bank * 3];
  poly([nose, wl, tail, wr], col || '#e8f6ff');
  poly([nose, [cx, cy - 4], tail], col || '#7bdff2');
  if (!col) { ctx.fillStyle = '#ffd23f'; ctx.fillRect(tail[0] - 2, tail[1] - 2, 4, 4); }
}

registerStage({
  id: 'isotope', name: 'ISOTOPE', color: '#7b96ff', hudLabel: 'FLY THROUGH THE TERM:', fourWay: false, chip: 'sn',
  howTo: ['Fly through the gate whose term matches the clue.', 'Left/right: steer.  Up/down: climb and dive.  Space: fire.', 'Watch your shadow and altitude. Shoot fuel tanks to refuel.'],
  cart: {
    icon: ['......w.....',
           '.....www....',
           '....wwbww...',
           '..wwwwbwwww.',
           'wwwwwwwwwwww',
           '....wwwww...',
           '.....yyy....',
           '......y.....'],
    pal: { w: '#e8f6ff', b: '#1b3a8a', y: '#ffd23f' }
  },
  start(target, info) { buildRound(target, info && info.fresh); },
  respawn() { if (S.solved) return E.nextRound(); fuel = 100; buildCourse(true); resetShip(); },
  isDying: () => P && P.dead > 0,
  isSolved: () => S && S.solved,
  choices: () => S.gate ? S.gate.openings.map(o => ({ text: o.term.short, color: o.col, mark: o.mark })) : [],   // for the portrait strip
  _debug: () => ({ S, P, getFuel: () => fuel, setFuel: v => { fuel = v; } }),

  update(dt, inp) {
    const speed = 100 + E.level * 6;
    if (S.gate) S.gate.flash = Math.max(0, S.gate.flash - dt);
    if (P.dead > 0) {
      P.dead -= dt;
      if (P.dead < 0.8 && !P.burst) { P.burst = true; const [x, y] = proj(P.x, SHIP_REL, P.alt); E.particles(x, y, '#ffd23f', 50, 220); E.particles(x, y, '#ff4d6d', 30, 160); }
      if (P.dead <= 0) E.deathDone();
      return;
    }
    const prevZ = shipZ();
    S.camZ += speed * dt;
    const z = shipZ();
    if (S.solved) { S.clearT -= dt; if (S.clearT <= 0) E.nextRound(); return; }
    P.inv = Math.max(0, P.inv - dt);
    // steer and climb
    P.x = clamp(P.x + inp.x * 120 * dt, 12, LW - 12);
    P.alt = clamp(P.alt - inp.y * 90 * dt, 4, ALT_MAX);
    P.bank += (inp.x - P.bank) * Math.min(1, dt * 8);
    // fuel
    fuel -= dt * (3.2 + E.level * 0.2);
    if (fuel < 25) { S.lowBeep -= dt; if (S.lowBeep <= 0) { Sound.lowFuel(); S.lowBeep = 1.2; } }
    if (fuel <= 0) { fuel = 0; return killShip('Out of fuel!'); }
    // fire
    P.cool -= dt;
    if (inp.fire && P.cool <= 0 && S.bullets.length < 2) { S.bullets.push({ x: P.x, z, alt: P.alt }); P.cool = 0.25; Sound.laser(); }
    for (const b of S.bullets) {
      b.z += (speed + 420) * dt;
      for (const t of S.turrets) if (t.alive && Math.abs(b.x - t.x) < 16 && b.alt < 26 && Math.abs(b.z - t.z) < 14) { t.alive = false; b.dead = true; E.addScore(300); Sound.explode(); const [x, y] = proj(t.x, t.z - S.camZ, 8); E.particles(x, y, '#ff4d6d', 24, 160); }
      for (const t of S.tanks) if (t.alive && Math.abs(b.x - t.x) < 16 && b.alt < 26 && Math.abs(b.z - t.z) < 14) { t.alive = false; b.dead = true; fuel = Math.min(100, fuel + 35); E.addScore(300); Sound.fuel(); const [x, y] = proj(t.x, t.z - S.camZ, 8); E.particles(x, y, '#ffb347', 24, 160); E.banner('FUEL +35', '#ffb347', '', 1); }
      if (S.gate && b.z > S.gate.z) b.dead = true;
      if (b.z > S.camZ + 1100) b.dead = true;
    }
    S.bullets = S.bullets.filter(b => !b.dead);
    // turrets fire at where the ship is
    for (const t of S.turrets) {
      const rel = t.z - S.camZ;
      if (!t.alive || rel < SHIP_REL + 60 || rel > 620) continue;
      t.cool -= dt;
      if (t.cool <= 0) {
        const dx = P.x - t.x, dz = z - t.z, da = P.alt - 10, d = Math.hypot(dx, dz, da), sp = 150;
        S.ebullets.push({ x: t.x, z: t.z, alt: 10, vx: dx / d * sp, vz: dz / d * sp + speed * 0.3, va: da / d * sp, life: 4 });
        t.cool = rand(1.6, 2.8) / (1 + E.level * 0.1); Sound.turretShot();
      }
    }
    for (const b of S.ebullets) {
      b.x += b.vx * dt; b.z += b.vz * dt; b.alt += b.va * dt; b.life -= dt;
      if (P.inv <= 0 && Math.hypot(b.x - P.x, b.z - z, b.alt - P.alt) < 11) { b.life = 0; return killShip('Hit by a turret!'); }
    }
    S.ebullets = S.ebullets.filter(b => b.life > 0);
    // flying low into a turret or a tank
    for (const t of [...S.turrets, ...S.tanks]) if (t.alive && prevZ < t.z && z >= t.z && Math.abs(P.x - t.x) < 14 && P.alt < 22 && P.inv <= 0) return killShip('Crashed into the fortress!');
    // electric barrier
    const br = S.barrier;
    if (br && prevZ < br.z && z >= br.z && P.alt > br.lo - 8 && P.alt < br.lo + br.h + 8 && P.inv <= 0) return killShip('Zapped by the electric barrier!');
    // the gate
    const g = S.gate;
    if (g && prevZ < g.z && z >= g.z) {
      const o = g.openings.find(o => Math.abs(P.x - o.x) < o.w / 2 - 3 && P.alt > o.lo + 3 && P.alt < o.hi - 3);
      if (!o) { if (P.inv <= 0) return killShip('Hit the force field wall!'); }
      else if (o.term.id === S.target.id) {
        S.solved = true; S.clearT = 1.6; fuel = Math.min(100, fuel + 40);
        E.correct(Math.max(200, 1000 + E.level * 100 - S.wrongs * 200)); Sound.correct();
        const [x, y] = proj(P.x, SHIP_REL, P.alt); E.particles(x, y, o.col, 40, 220);
      } else {
        // wrong gate: a zap, the term's meaning, and the wall rebuilds ahead without that choice
        S.gone.add(o.term.id); S.wrongs++; if (S.wrongs >= 2) S.reveal = true;
        Sound.zapField(); E.wrong(o.term, 100);
        const [x, y] = proj(P.x, SHIP_REL, P.alt); E.particles(x, y, '#ff4d6d', 30, 180);
        buildCourse(false); S.gate.flash = 0.5;
      }
    }
  },

  draw() {
    drawFloor();
    // shadow first, then everything sorted far to near, with the ship slotted in by depth
    const [sx, sy] = proj(P.x, SHIP_REL, 0);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.ellipse(sx, sy, 18, 8, -0.35, 0, Math.PI * 2); ctx.fill();
    const items = [];
    if (S.gate) items.push({ z: S.gate.z, d: () => drawGate(S.gate) });
    if (S.barrier) items.push({ z: S.barrier.z, d: () => drawBarrier(S.barrier) });
    S.turrets.forEach(t => t.alive && items.push({ z: t.z, d: () => drawTurret(t) }));
    S.tanks.forEach(t => t.alive && items.push({ z: t.z, d: () => drawTank(t) }));
    S.bullets.forEach(b => items.push({ z: b.z, d: () => { const [x, y] = proj(b.x, b.z - S.camZ, b.alt); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 3, y - 1, 7, 3); } }));
    S.ebullets.forEach(b => items.push({ z: b.z, d: () => { const [x, y] = proj(b.x, b.z - S.camZ, b.alt); ctx.fillStyle = '#ff4d6d'; ctx.fillRect(x - 2, y - 2, 5, 5); } }));
    const ready = G.ready || G.state === 'card';
    items.push({ z: S.camZ + SHIP_REL, d: () => {
      if (P.dead <= 0) { if (!(P.inv > 0 && !ready && Math.floor(E.time * 12) % 2)) drawShip(P.x, P.alt, P.bank); }
      else if (!P.burst) { const zc = ['#ffffff', '#ff4d6d', '#ffd23f', '#38f0c8']; drawShip(P.x, P.alt, 0, zc[Math.floor(E.time * 24) % zc.length]); }
    } });
    items.sort((a, b) => b.z - a.z).forEach(i => i.d());
    // gate legend: which colour is which term
    const opens = S.gate ? S.gate.openings : [];
    ctx.font = '22px VT323, monospace'; ctx.textBaseline = 'middle';
    let x = 14;
    for (const o of opens) {
      // the short label, on two lines if a chip would be wider than 200 px
      const glow = S.reveal && o.term.id === S.target.id;
      if (!o.fit) o.fit = fitLabel(o.term.short, 200, 22);
      const lh = Math.round(o.fit.size * 0.95), w = o.fit.w + 32, h = Math.max(24, o.fit.h + 6);
      ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(x, 98, w, h);
      ctx.strokeStyle = o.col; ctx.lineWidth = glow ? 3 : 1; ctx.strokeRect(x, 98, w, h);
      ctx.fillStyle = o.col; ctx.fillRect(x + 5, 98 + h / 2 - 7, 14, 14);   // colour swatch with the gate's letter
      ctx.font = '10px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#000';
      ctx.fillText(o.mark, x + 12, 98 + h / 2 + 1); ctx.textAlign = 'left';
      ctx.font = `${o.fit.size}px VT323, monospace`; ctx.textBaseline = 'middle'; ctx.fillStyle = glow ? '#ffffff' : '#e8f6ff';
      o.fit.lines.forEach((l, i) => ctx.fillText(l, x + 24, 98 + h / 2 + (i - (o.fit.lines.length - 1) / 2) * lh));
      x += w + 10;
    }
    ctx.textBaseline = 'top';
    // altitude meter
    const mx = 14, my0 = 520, mh = 260;
    ctx.fillStyle = '#1d2636'; ctx.fillRect(mx, my0 - mh, 10, mh);
    ctx.fillStyle = '#7b96ff'; ctx.fillRect(mx, my0 - mh * P.alt / ALT_MAX, 10, mh * P.alt / ALT_MAX);
    if (S.gate) for (const o of S.gate.openings) { ctx.fillStyle = o.col; ctx.fillRect(mx + 12, my0 - mh * o.hi / ALT_MAX, 4, mh * (o.hi - o.lo) / ALT_MAX); }
    ctx.font = '16px VT323, monospace'; ctx.fillStyle = '#5d6b80'; ctx.fillText('ALT', mx - 2, my0 + 4);
  },
  drawHud() {
    const f = clamp(fuel / 100, 0, 1), low = fuel < 25;
    ctx.font = '16px VT323, monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillStyle = low && Math.floor(E.time * 4) % 2 ? '#ff4d6d' : '#ffb347';
    ctx.fillText('FUEL', W - 118, 58); ctx.textAlign = 'left';
    ctx.fillStyle = '#1d2636'; ctx.fillRect(W - 112, 62, 98, 8);
    ctx.fillStyle = low ? '#ff4d6d' : '#ffb347'; ctx.fillRect(W - 112, 62, 98 * f, 8);
  },
  drawLifeIcon(x, y) {
    ctx.save(); ctx.translate(x, y + 4); ctx.fillStyle = '#e8f6ff';
    ctx.beginPath(); ctx.moveTo(6, -4); ctx.lineTo(-5, -4); ctx.lineTo(-7, 3); ctx.lineTo(5, 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7bdff2'; ctx.fillRect(-1, -3, 4, 3); ctx.restore();
  }
});
})();
