import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';

// Atom view (Stage 2a): electron clouds sampled from published Hartree–Fock orbitals.
// Lengths: the data are in bohr; the scene uses 1 unit = 100 pm.

const MAX_Z = 18;
const Z = Number(new URLSearchParams(location.search).get('Z'));
const side = document.getElementById('a-side');
const caption = document.getElementById('a-caption');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const supDigits = s => s.replace(/(\d+)([spdfg])(\d+)/g, '$1$2<sup>$3</sup>');

const [DATA, SRC] = await Promise.all([
  fetch('data/elements.json').then(r => r.json()),
  fetch('data/sources.json').then(r => r.json()),
]);
const EL = DATA.elements.find(e => e.Z === Z);
const SOURCES = SRC.sources;

if (!EL || Z < 1 || Z > MAX_Z) {
  document.getElementById('a-loading').remove();
  document.getElementById('a-title').textContent = EL ? `${EL.name} atom` : 'Atom view';
  side.innerHTML = `<p>The atom view covers hydrogen through argon so far. Potassium through xenon come next.</p>
    <p><a href="./">Back to the periodic table</a></p>`;
  throw new Error('atom view not available for this element yet');
}

const [ATOM, INDEX] = await Promise.all([
  fetch(`data/atoms/${Z}.json`).then(r => r.json()),
  fetch('data/atoms/index.json').then(r => r.json()),
]);
const ION_KEY = INDEX.ions[String(Z)]?.[0] || null; // e.g. "11+"
let ION = null, ION_ORBS = null;
let compare = false;
const A0 = ATOM.bohr_pm;          // pm per bohr
const UNIT = 100;                  // pm per scene unit
const toUnits = rBohr => (rBohr * A0) / UNIT;

document.title = `${EL.name} Atom`;
document.getElementById('a-title').textContent = `${EL.name} atom`;
document.getElementById('a-sub').textContent =
  Z === 1 ? 'Exact electron cloud of hydrogen' : 'Calculated electron cloud (Hartree–Fock model)';

// ------------------------------------------------------------------ math
const fact = n => (n <= 1 ? 1 : n * fact(n - 1));
function radialFn(basis) {
  const t = basis.map(([n, z, c]) => [n, z, c * Math.pow(2 * z, n + 0.5) / Math.sqrt(fact(2 * n))]);
  return r => { let s = 0; for (const [n, z, k] of t) s += k * Math.pow(r, n - 1) * Math.exp(-z * r); return s; };
}
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Inverse-CDF sampler for the radial probability r²R(r)².
function radialSampler(R, rMax) {
  const N = 4000, rs = new Float64Array(N), cdf = new Float64Array(N);
  const lo = Math.log(1e-5), hi = Math.log(rMax);
  let prev = 0, prevR = 0;
  for (let i = 0; i < N; i++) {
    const r = Math.exp(lo + ((hi - lo) * i) / (N - 1));
    const p = r * r * R(r) ** 2;
    rs[i] = r;
    cdf[i] = i ? cdf[i - 1] + 0.5 * (p + prev) * (r - prevR) : 0;
    prev = p; prevR = r;
  }
  const tot = cdf[N - 1];
  for (let i = 0; i < N; i++) cdf[i] /= tot;
  return u => {
    let a = 0, b = N - 1;
    while (b - a > 1) { const m = (a + b) >> 1; if (cdf[m] < u) a = m; else b = m; }
    const f = (u - cdf[a]) / (cdf[b] - cdf[a] || 1);
    return rs[a] + f * (rs[b] - rs[a]);
  };
}
function randomDir(rng) {
  const z = 2 * rng() - 1, phi = 2 * Math.PI * rng(), s = Math.sqrt(1 - z * z);
  return [s * Math.cos(phi), s * Math.sin(phi), z];
}
// chemistry axes (x, y, z) -> scene axes; chemistry z points up on screen
const toScene = (x, y, z) => [x, z, -y];
const AXIS_INDEX = { x: 0, y: 1, z: 2 };

// ------------------------------------------------------------------ orbitals
// Sublevels in filling order (n + l, then n): 1s 2s 2p 3s 3p. The data file lists all s before p.
function prepOrbs(json) {
  const orbs = json.orbitals.map(o => ({ ...o, R: radialFn(o.basis), rMaxBohr: (o.r999_pm / A0) * 1.6 }))
    .sort((a, b) => (a.n + a.l) - (b.n + b.l) || a.n - b.n);
  orbs.forEach(o => { o.sample = radialSampler(o.R, o.rMaxBohr); });
  return orbs;
}
const ORBS = prepOrbs(ATOM);
// Real orbitals shown as boxes: s -> one, p -> px, py, pz. Electrons placed by Hund's rule.
const BOXES = [];
for (const o of ORBS) {
  const axes = o.l === 0 ? [null] : ['x', 'y', 'z'];
  const e = axes.map((_, i) => (o.occ > i ? 1 : 0) + (o.occ > axes.length + i ? 1 : 0));
  axes.forEach((ax, i) => BOXES.push({ orb: o, axis: ax, electrons: e[i],
    key: o.name + (ax || ''), label: o.l === 0 ? o.name : `${o.name}<sub>${ax}</sub>` }));
}
const NCOLORS = ['#0072B2', '#E69F00', '#009E73', '#CC79A7']; // Okabe–Ito, by energy level n = 1, 2, 3, 4

let selection = 'all';

// ------------------------------------------------------------------ scene
const canvas = document.getElementById('a-scene');
const stage = canvas.parentElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
const scene = new THREE.Scene();
const dark = matchMedia('(prefers-color-scheme: dark)').matches;
scene.background = new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--scene-bg').trim() || '#eceae4');
const camera = new THREE.PerspectiveCamera(35, 1, 0.001, 100);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xffffff, 0x777788, 1.4));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(2, 4, 3);
scene.add(sun);

const frameR = toUnits(ATOM.total.r999_pm / A0) * 1.05; // whole atom fits; the same scale for every orbital
const isPhone = matchMedia('(max-width: 800px)').matches;

// nucleus (drawn far larger than real)
const nucleus = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.012, frameR * 0.012), 20, 12),
  new THREE.MeshStandardMaterial({ color: 0xc0392b }));
scene.add(nucleus);

// axes
const axes = new THREE.Group();
for (const [name, dir] of [['x', [1, 0, 0]], ['y', [0, 1, 0]], ['z', [0, 0, 1]]]) {
  const d = toScene(...dir).map(v => v * frameR * 1.08);
  const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...d.map(v => -v)), new THREE.Vector3(...d)]);
  axes.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: dark ? 0x777777 : 0x999999 })));
  axes.add(textSprite(name, d, 0.1 * frameR));
}
scene.add(axes);

// 100 pm rings in the horizontal plane, with labels
function makeRings(maxPm, labelH, labelDir = [0.79, -0.62]) {
  const g = new THREE.Group();
  for (let k = 1; k * 100 <= maxPm * 1.05 || k === 1; k++) {
    const pts = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * k, 0, Math.sin(a) * k));
    }
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: dark ? 0x888888 : 0x777777, transparent: true, opacity: 0.6 })));
    // label on the side of the ring that faces the screen's right edge in the starting view
    g.add(textSprite(`${k * 100} pm`, [k * labelDir[0], 0, k * labelDir[1]], labelH));
  }
  return g;
}
const rings = makeRings(ATOM.total.r999_pm, 0.085 * frameR);
scene.add(rings);

function textSprite(text, pos, h) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = '600 36px system-ui, sans-serif';
  g.fillStyle = dark ? '#ddd' : '#333';
  g.textBaseline = 'middle';
  g.fillText(text, 6, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(h * 4, h, 1);
  s.position.set(...pos);
  s.center.set(0, 0.5);
  return s;
}

let points = null, surface = null;

function buildPoints() {
  if (points) { scene.remove(points); points.geometry.dispose(); points.material.dispose(); }
  const rng = mulberry32(1025 + Z * 101 + (selection === 'all' ? 0 : selection.length * 7919));
  const N = selection === 'all' ? (isPhone ? 12000 : 30000) : (isPhone ? 8000 : 18000);
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const box = BOXES.find(b => b.key === selection);
  const weights = ORBS.map(o => o.occ), wsum = weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < N; i++) {
    let o, d;
    if (box) {
      o = box.orb;
      // angular part: s is uniform; p_x, p_y, p_z by rejection on (component)^2
      for (;;) { d = randomDir(rng); if (!box.axis || rng() < d[AXIS_INDEX[box.axis]] ** 2) break; }
    } else {
      // total density: choose a sublevel by its electron count; directions averaged (the atom has no preferred direction)
      let u = rng() * wsum, j = 0;
      while (u > weights[j]) { u -= weights[j]; j++; }
      o = ORBS[j];
      d = randomDir(rng);
    }
    const r = toUnits(o.sample(rng()));
    const [x, y, z] = toScene(d[0] * r, d[1] * r, d[2] * r);
    pos.set([x, y, z], i * 3);
    const c = new THREE.Color(box ? NCOLORS[0] : NCOLORS[(o.n - 1) % 4]);
    col.set([c.r, c.g, c.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  points = new THREE.Points(g, new THREE.PointsMaterial({ size: isPhone ? 2 : 2.2, sizeAttenuation: false,
    vertexColors: true, transparent: true, opacity: dark ? 0.75 : 0.6, depthWrite: false }));
  points.visible = document.getElementById('t-dots').checked;
  scene.add(points);
}

function disposeTree(obj) {
  obj.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
}

function buildSurface() {
  if (surface) { scene.remove(surface); disposeTree(surface); }
  const mat = () => new THREE.MeshStandardMaterial({ color: 0x56B4E9, transparent: true, opacity: 0.26, roughness: 0.4,
    side: THREE.DoubleSide, depthWrite: false });
  const sphere = rPm => new THREE.Mesh(new THREE.SphereGeometry(rPm / UNIT, 64, 40), mat());
  const box = BOXES.find(b => b.key === selection);
  surface = new THREE.Group();
  if (!box) {
    // Whole atom: the sphere holding 90% of the outer (valence) electrons. (An all-electron sphere would be
    // dominated by the core electrons and would not follow the atomic-size trend.)
    surface.add(sphere(ATOM.valence.r90_pm));
  } else if (box.orb.l === 0) {
    // s orbital: the 90% region is a set of concentric shells, drawn exactly from the precomputed radii.
    for (const [a, b] of box.orb.shells90_pm) {
      surface.add(sphere(b));
      if (a > 0) surface.add(sphere(a));
    }
  } else {
    // p orbital: one marching-cubes grid per region between radial nodes, so thin node gaps are resolved.
    const o = box.orb, ai = AXIS_INDEX[box.axis], ang = 3 / (4 * Math.PI);
    const nodes = o.nodes_pm.map(x => x / A0);
    const bounds = [0, ...nodes, o.r999_pm / A0 * 1.15];
    for (let s = 0; s < bounds.length - 1; s++) {
      const rIn = bounds[s], rOut = bounds[s + 1];
      const res = 64, L = rOut * 1.04, half = res / 2;
      const mc = new MarchingCubes(res, mat(), false, false, 60000);
      for (let k = 0; k < res; k++) for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
        const sx = ((i - half) / half) * L, sy = ((j - half) / half) * L, sz = ((k - half) / half) * L;
        const r = Math.hypot(sx, sy, sz) || 1e-9;
        if (r < rIn || r > rOut) { mc.field[i + j * res + k * res * res] = 0; continue; }
        const chem = [sx, -sz, sy]; // scene axes -> chemistry axes
        mc.field[i + j * res + k * res * res] = o.R(r) ** 2 * ang * (chem[ai] / r) ** 2;
      }
      mc.isolation = o.c90;
      mc.update();
      mc.scale.setScalar(toUnits(L));
      surface.add(mc);
    }
  }
  surface.visible = document.getElementById('t-surface').checked;
  scene.add(surface);
}

function frameCamera() {
  if (compare && compareGroup) {
    // look from the front so the two clouds sit side by side
    const { halfW, cx } = compareGroup.userData;
    const fovH = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    const d = Math.max(halfW / Math.tan(fovH / 2), (halfW * 0.6) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.1;
    camera.position.set(cx, d * 0.42, d * 0.91);
    controls.target.set(cx, 0, 0);
    camera.near = d / 500; camera.far = d * 20;
    camera.updateProjectionMatrix();
    return;
  }
  const d = frameR / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (camera.aspect < 1 ? 1.25 / camera.aspect : 1.15);
  camera.position.set(d * 0.55, d * 0.45, d * 0.7);
  controls.target.set(0, 0, 0);
  camera.near = d / 500; camera.far = d * 20;
  camera.updateProjectionMatrix();
}
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  frameCamera();
}
new ResizeObserver(resize).observe(stage);
renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });

for (const [id, kind, get] of [['t-dots', 'dots', () => points], ['t-surface', 'surface', () => surface],
  ['t-rings', 'rings', () => rings]]) {
  document.getElementById(id).addEventListener('change', ev => {
    const o = get(); if (o) o.visible = ev.target.checked;
    compareGroup?.traverse(c => { if (c.userData.kind === kind) c.visible = ev.target.checked; });
  });
}

// ------------------------------------------------------------------ atom vs ion
let compareGroup = null;
const CHARGE_TXT = q => (Math.abs(q) === 1 ? '' : Math.abs(q)) + (q > 0 ? '+' : '−');
const ionLabel = q => `${EL.sym}<sup>${CHARGE_TXT(q)}</sup>`;
const ionPlain = q => `${EL.sym}${CHARGE_TXT(q)}`;
const ANION_NAME = { 1: 'hydride', 7: 'nitride', 8: 'oxide', 9: 'fluoride', 15: 'phosphide', 16: 'sulfide', 17: 'chloride' };
const ionName = q => (q < 0 ? `${ANION_NAME[Z]} ion` : `${EL.name.toLowerCase()} ion`);

// a whole-atom (or whole-ion) dot cloud: sublevel chosen by electron count, direction averaged
function wholeCloud(orbs, seed, N, x0) {
  const rng = mulberry32(seed);
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const w = orbs.map(o => o.occ), ws = w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < N; i++) {
    let u = rng() * ws, j = 0;
    while (u > w[j]) { u -= w[j]; j++; }
    const o = orbs[j], d = randomDir(rng), r = toUnits(o.sample(rng()));
    const [x, y, z] = toScene(d[0] * r, d[1] * r, d[2] * r);
    pos.set([x + x0, y, z], i * 3);
    const c = new THREE.Color(NCOLORS[(o.n - 1) % 4]);
    col.set([c.r, c.g, c.b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size: isPhone ? 2 : 2.2, sizeAttenuation: false,
    vertexColors: true, transparent: true, opacity: dark ? 0.75 : 0.6, depthWrite: false }));
}

function buildCompare() {
  compareGroup = new THREE.Group();
  const items = [[ATOM, ORBS, `${EL.name} atom`], [ION, ION_ORBS, `${ionPlain(ION.charge)} ion`]];
  const ext = items.map(([j]) => j.total.r999_pm / UNIT);
  const gap = 0.15 * Math.max(...ext);
  const xs = [-(ext[0] + gap / 2), ext[1] + gap / 2];
  const labelH = 0.07 * Math.max(...ext) * 2;
  items.forEach(([j, orbs, label], i) => {
    const x0 = xs[i];
    const dots = wholeCloud(orbs, 2025 + Z * 31 + i, isPhone ? 9000 : 22000, x0);
    dots.userData.kind = 'dots';
    dots.visible = document.getElementById('t-dots').checked;
    const sph = new THREE.Mesh(new THREE.SphereGeometry(j.valence.r90_pm / UNIT, 64, 40),
      new THREE.MeshStandardMaterial({ color: 0x56B4E9, transparent: true, opacity: 0.26, roughness: 0.4,
        side: THREE.DoubleSide, depthWrite: false }));
    sph.position.x = x0;
    sph.userData.kind = 'surface';
    sph.visible = document.getElementById('t-surface').checked;
    const rg = makeRings(j.total.r999_pm, labelH * 0.8, [0.0, 1.0]);
    rg.position.x = x0;
    rg.userData.kind = 'rings';
    rg.visible = document.getElementById('t-rings').checked;
    const nuc = new THREE.Mesh(new THREE.SphereGeometry(nucleus.geometry.parameters.radius, 20, 12), nucleus.material);
    nuc.position.x = x0;
    const tag = textSprite(label, [x0 - labelH * 1.6, ext[i] * 0.9, 0], labelH);
    compareGroup.add(dots, sph, rg, nuc, tag);
  });
  compareGroup.userData = { halfW: (xs[1] + ext[1] - (xs[0] - ext[0])) / 2, cx: (xs[0] - ext[0] + xs[1] + ext[1]) / 2 };
  scene.add(compareGroup);
}

async function setCompare(on) {
  if (on && !ION) {
    ION = await fetch(`data/atoms/${ION_KEY}.json`).then(r => r.json());
    ION_ORBS = prepOrbs(ION);
    buildCompare();
  }
  compare = on;
  for (const o of [points, surface, rings, axes, nucleus]) if (o) o.visible = !on && (
    o === points ? document.getElementById('t-dots').checked
      : o === surface ? document.getElementById('t-surface').checked
        : o === rings ? document.getElementById('t-rings').checked : true);
  if (compareGroup) compareGroup.visible = on;
  frameCamera();
  render();
}

// ------------------------------------------------------------------ side panel
const fmt = (v, d = 0) => Number(v).toFixed(d);
const levelCounts = {};
for (const o of ORBS) levelCounts[o.n] = (levelCounts[o.n] || 0) + o.occ;

function describe() {
  const box = BOXES.find(b => b.key === selection);
  if (!box) {
    const v = ATOM.valence;
    return `Whole ${EL.name.toLowerCase()} atom (all ${Z} electron${Z > 1 ? 's' : ''}). The shaded sphere holds 90% of the ` +
      `${v.electrons} outer electron${v.electrons > 1 ? 's' : ''} (level ${v.level}): radius ${fmt(v.r90_pm)} pm.`;
  }
  const o = box.orb, k = o.nodes_pm.length;
  const shape = o.l === 0
    ? (k ? `a small inner sphere and ${k === 1 ? 'an outer shell' : `${k} shells around it`}, separated by spherical node${k > 1 ? 's' : ''}` : 'a sphere')
    : `two lobes along the ${box.axis} axis${k ? `, with smaller inner lobes inside a spherical node` : ''}`;
  return `${o.name}${box.axis ? box.axis : ''} orbital of ${EL.name.toLowerCase()}: ${shape}.` +
    (box.electrons === 0 ? ' This orbital is empty in this atom.' : '');
}

// Common ions for which no calculated cloud is shown, with the reason. Shannon crystal radii come from elements.json.
const NO_CLOUD = {
  4: [2, 'singly'], 12: [2, 'singly'], 13: [3, 'singly'],
  7: [-3, 'unbound'], 8: [-2, 'unbound'], 15: [-3, 'unbound'], 16: [-2, 'unbound'],
};
function shannon(q) {
  const ions = (EL.ions || []).filter(i => i.charge === q && i.spin !== 'LS');
  return ions.find(i => i.cn === 'VI') || ions[0] || null;
}
const ROMAN = { II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9 };

function ionSection() {
  if (ION_KEY) {
    const q = ION_KEY.endsWith('+') ? 1 : -1;
    return `<h2>Atom and ion</h2>
      <button type="button" class="btn allbtn" data-compare="1" aria-label="Compare the ${EL.name.toLowerCase()} atom with the ${ionName(q)}, ${ionPlain(q)}">Compare ${esc(EL.sym)} with ${ionLabel(q)}</button>
      <p class="note">See the ${EL.name.toLowerCase()} atom and the ${ionName(q)} side by side, at the same scale.</p>`;
  }
  const nc = NO_CLOUD[Z];
  if (!nc) return '';
  const [q, why] = nc, sh = shannon(q);
  const reason = why === 'unbound'
    ? `${ionLabel(q)} is not stable on its own: a free ${EL.sym} atom does not hold ${Math.abs(q)} extra electrons. It exists only surrounded by other ions in a crystal or solution, so no free-ion cloud can be calculated.`
    : `The calculated ion data used here cover only ions with a 1+ or 1− charge, so ${ionLabel(q)} has no cloud yet.`;
  return `<h2>Atom and ion</h2><p class="note">${reason}${sh ? ` In crystals, ${ionLabel(q)} has an ionic radius of
    ${sh.v} pm with ${ROMAN[sh.cn] ?? sh.cn} neighbors (Shannon 1976).` : ''}</p>`;
}

const configHTML = orbs => orbs.map(o => `${o.name}<sup>${o.occ}</sup>`).join(' ');

function renderCompare() {
  const q = ION.charge, A = ATOM.valence, I = ION.valence;
  const sh = shannon(q), cov = EL.props.covalent_radius;
  const why = q > 0
    ? `${ionLabel(q)} has lost its level ${A.level} electron${A.electrons > 1 ? 's' : ''}. Its outer electrons are now in
       level ${I.level}, much closer to the nucleus, so the ion is much smaller than the atom.`
    : `${ionLabel(q)} has gained an electron in the same level (${I.level}). The nuclear charge stays the same while
       there are more electrons repelling each other, so the cloud spreads out and the ion is larger than the atom.`;
  side.innerHTML = `
    <button type="button" class="btn allbtn" data-compare="0">← Back to the ${EL.name.toLowerCase()} atom</button>
    <h2>Atom and ion</h2>
    <table class="cmp"><thead><tr><th></th><th>${esc(EL.sym)} atom</th><th>${ionLabel(q)} ion</th></tr></thead><tbody>
      <tr><th scope="row">Electrons</th><td>${Z}</td><td>${ION.electrons}</td></tr>
      <tr><th scope="row">Configuration</th><td>${configHTML(ORBS)}</td><td>${configHTML(ION_ORBS)}</td></tr>
      <tr><th scope="row">Outer electrons</th><td>${A.electrons} (level ${A.level})</td><td>${I.electrons} (level ${I.level})</td></tr>
      <tr><th scope="row">90% of outer electrons within</th><td><b>${fmt(A.r90_pm)} pm</b></td><td><b>${fmt(I.r90_pm)} pm</b></td></tr>
    </tbody></table>
    <p class="note">${why}</p>
    <p class="note">The shaded spheres hold 90% of each one's outer electrons. Rings are 100 pm apart around each nucleus.</p>
    ${sh && cov ? `<p class="note">The table on the main page measures size differently, from atoms and ions in solids:
      ${esc(EL.sym)} atom ${cov.v} pm (covalent radius), ${ionLabel(q)} ${sh.v} pm (ionic radius in a crystal). The numbers
      differ from the free-atom values above, but the change goes the same way.</p>` : ''}
    <h2>Where this comes from</h2>
    <p class="note"><span class="badge computed">Calculated</span> Hartree–Fock model, free atom and free ion.
      Sources: <button type="button" class="srcbtn" data-src="${ATOM.src}">${esc(SOURCES[ATOM.src].short)}</button> (atom),
      <button type="button" class="srcbtn" data-src="${ION.src}">${esc(SOURCES[ION.src].short)}</button> (ion),
      <button type="button" class="srcbtn" data-src="codata2022">${esc(SOURCES.codata2022.short)}</button>.</p>`;
  const txt = `${EL.name} atom and ${ionPlain(q)} ion side by side: 90% of the outer electrons lie within ` +
    `${fmt(A.r90_pm)} pm for the atom and ${fmt(I.r90_pm)} pm for the ion.`;
  caption.textContent = `${txt} Rings: 100 pm apart.`;
  canvas.setAttribute('aria-label', txt);
}

function render() {
  if (compare) return renderCompare();
  const box = BOXES.find(b => b.key === selection);
  const rows = [];
  for (const o of ORBS) { // ORBS is in filling order; rows are reversed below so higher energy is on top
    const bs = BOXES.filter(b => b.orb === o);
    rows.push(`<div class="orow"><span class="lab">${o.name}</span><div class="boxes" role="group" aria-label="${o.name} sublevel">${
      bs.map(b => `<button type="button" class="obox" data-key="${b.key}" aria-pressed="${b.key === selection}"
        aria-label="${b.key.replace(/([xyz])$/, ' $1')} orbital, ${b.electrons} electron${b.electrons === 1 ? '' : 's'}">
        <span aria-hidden="true">${b.electrons === 2 ? '↑↓' : b.electrons === 1 ? '↑' : '&nbsp;'}</span>
        ${b.axis ? `<small aria-hidden="true">${b.axis}</small>` : ''}</button>`).join('')}</div></div>`);
  }
  let detail;
  if (!box) {
    const v = ATOM.valence;
    detail = `<dl class="facts">
      <dt>Electrons</dt><dd>${Z}</dd>
      <dt>Outer electrons (level ${v.level})</dt><dd>${v.electrons}</dd>
      <dt>90% of the outer electrons within</dt><dd>${fmt(v.r90_pm)} pm</dd>
    </dl>
    <p class="note">The shaded sphere is drawn for the outer electrons, because they set the size of the atom.
      Compare atoms with it: it shrinks across a period and grows down a group, like the atomic sizes in the table.
      A free atom's cloud has no edge, so this number is larger than the atomic size measured from bonded atoms.</p>
    <p class="note">Dots are colored by energy level:</p>
    <ul class="legend-dots">${Object.keys(levelCounts).map(n => `<li><i style="background:${NCOLORS[(n - 1) % 4]}"></i>Level ${n}</li>`).join('')}</ul>
    ${ORBS.some(o => o.l > 0 && o.occ % 6) ? `<p class="note">A partly filled sublevel can point in several directions, all with
      the same energy. The whole-atom picture averages over them, so it has no preferred direction.</p>` : ''}`;
  } else {
    const o = box.orb;
    detail = `<dl class="facts">
      <dt>Electrons in this orbital</dt><dd>${box.electrons} (from the orbital diagram)</dd>
      <dt>Average distance from nucleus</dt><dd>${fmt(o.r_mean_pm)} pm</dd>
      <dt>Most likely distance</dt><dd>${fmt(o.r_peak_pm)} pm</dd>
      <dt>Radial nodes</dt><dd>${o.nodes_pm.length ? `${o.nodes_pm.length} (at ${o.nodes_pm.map(x => fmt(x)).join(', ')} pm)` : 'none'}</dd>
    </dl>
    ${box.electrons === 0 ? `<p class="note">This orbital is empty in ${EL.name.toLowerCase()}. The cloud shows where an
      electron in it would be found.</p>` : ''}
    ${o.l > 0 ? `<p class="note">The three ${o.name} orbitals have the same shape and size, pointing along x, y and z.
      Which box gets a single electron (x, y or z) is only a convention.</p>` : ''}`;
  }

  side.innerHTML = `
    <h2>Electron configuration</h2>
    <div class="config">${supDigits(EL.config.v)}</div>
    <div class="levels" aria-label="Electrons per energy level">${Object.entries(levelCounts).map(([n, c]) =>
      `<span>Level ${n}: ${c}</span>`).join('')}</div>

    <h2>Orbital diagram</h2>
    <button type="button" class="btn allbtn" data-key="all" aria-pressed="${selection === 'all'}">All electrons</button>
    <div class="odiag">${rows.reverse().join('')}</div>
    <p class="note">Click a box to see that orbital. Higher rows are higher in energy.</p>

    <h2 class="orbname">${box ? `${box.orb.name}${box.axis ? `<sub>${box.axis}</sub>` : ''} orbital` : 'Whole atom'}</h2>
    ${detail}

    <h2>What you are seeing</h2>
    <p class="note">Each dot marks a place where an electron could be found, drawn with the probability the
    wavefunction gives: where dots crowd together, the electron is more likely to be. Electrons do not travel in
    orbits, and this is not a picture of where they are right now.</p>
    <p class="note">For one orbital, the shaded <b>90% surface</b> encloses the densest part of the cloud, holding 90% of
    the probability. For the whole atom it is the sphere holding 90% of the outer electrons. The 90% cutoff is a
    convention; the cloud has no sharp edge.</p>
    <p class="note">The scale is linear: rings are 100 pm apart. The red nucleus is drawn hundreds to thousands of
    times larger than it really is, so you can see where it is.</p>

    <h2>Where this comes from</h2>
    <p class="note"><span class="badge computed">${Z === 1 ? 'Exact' : 'Calculated'}</span>
      ${Z === 1 ? 'Exact solution for hydrogen.' : 'Hartree–Fock model: each electron moves in the average field of the others. A very good model of atomic size and shape, but not exact.'}
      Sources: <button type="button" class="srcbtn" data-src="${ATOM.src}">${esc(SOURCES[ATOM.src].short)}</button>,
      <button type="button" class="srcbtn" data-src="codata2022">${esc(SOURCES.codata2022.short)}</button>.</p>`;
  side.querySelector('.orbname').insertAdjacentHTML('beforebegin', ionSection());

  caption.textContent = `${describe()} Rings: 100 pm apart (linear scale).`;
  canvas.setAttribute('aria-label', describe());
}

side.addEventListener('click', ev => {
  const cmp = ev.target.closest('[data-compare]');
  if (cmp) {
    const on = cmp.dataset.compare === '1';
    const url = new URL(location.href);
    if (on) url.searchParams.set('compare', '1'); else url.searchParams.delete('compare');
    history.replaceState(null, '', url);
    setCompare(on).then(() => side.querySelector('[data-compare]')?.focus());
    return;
  }
  const b = ev.target.closest('[data-key]');
  if (b) {
    selection = b.dataset.key;
    buildPoints(); buildSurface(); render();
    side.querySelector(`[data-key="${selection}"]`)?.focus();
    return;
  }
  const s = ev.target.closest('.srcbtn');
  if (s) showSource(s.dataset.src);
});

const dlg = document.getElementById('srcdlg');
function showSource(id) {
  const s = SOURCES[id];
  const row = (k, v) => (v ? `<dt>${k}</dt><dd>${v}</dd>` : '');
  document.getElementById('s-body').innerHTML = `<h2 id="s-title">${esc(s.short)}</h2><p>${esc(s.citation)}</p><dl>
    ${row('DOI', s.doi ? `<a href="https://doi.org/${s.doi}" target="_blank" rel="noopener">${s.doi}</a>` : '')}
    ${row('Web', s.url ? `<a href="${s.url}" target="_blank" rel="noopener">${esc(s.url)}</a>` : '')}
    ${row('Used for', s.table ? esc(s.table) : '')}
    ${row('License', esc(s.license))}
    ${row('Retrieved', s.retrieved)}</dl>`;
  dlg.showModal();
}

buildPoints();
buildSurface();
render();
resize();
if (ION_KEY && new URLSearchParams(location.search).get('compare') === '1') await setCompare(true);
document.getElementById('a-loading').remove();
