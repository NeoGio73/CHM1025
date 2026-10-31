import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ------------------------------------------------------------------ data
const [DATA, SRC] = await Promise.all([
  fetch('data/elements.json').then(r => r.json()),
  fetch('data/sources.json').then(r => r.json()),
]);
const META = DATA.properties;
const ELS = DATA.elements;
const SOURCES = SRC.sources;
const DEFAULT_PROP = Object.keys(META).find(k => META[k].default);

const STATUS = {
  measured: 'Measured',
  recommended: 'Evaluated value',
  computed: 'Calculated',
  estimated: 'Estimate',
  predicted: 'Predicted',
};
const isTentative = d => d.status === 'predicted' || d.status === 'estimated';
// Which second source each property is cross-checked against.
const CHECKED_AGAINST = {
  config: 'PubChem and the mendeleev database',
  atomic_weight: 'PubChem',
  ionization_energy: 'PubChem',
  covalent_radius: 'a second transcription of Cordero et al. (Wikipedia)',
  electronegativity: 'the CRC Handbook (via mendeleev)',
  melting_point: 'the CRC Handbook (via mendeleev)',
  boiling_point: 'the CRC Handbook (via mendeleev)',
  density: 'the CRC Handbook (via mendeleev)',
  ion: 'a second transcription of Shannon 1976 (pymatgen)',
};
const OTHER_NAME = { pubchem: 'PubChem', mendeleev: 'CRC Handbook (via mendeleev)' };
// Common ions in an introductory course; the panel compares the atom with this ion.
const COMMON_ION = {
  Li: 1, Na: 1, K: 1, Rb: 1, Cs: 1, Be: 2, Mg: 2, Ca: 2, Sr: 2, Ba: 2, Al: 3, Ga: 3,
  N: -3, P: -3, O: -2, S: -2, Se: -2, Te: -2, F: -1, Cl: -1, Br: -1, I: -1,
  Fe: 3, Cu: 2, Zn: 2, Ag: 1, Ni: 2,
};
const ROMAN = { II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12, XIV: 14 };

const ATOM_VIEW_MAX_Z = 18; // Stage 2a: the atom view covers H–Ar
let prop = DEFAULT_PROP;
let selected = ELS.findIndex(e => e.sym === 'Na');

// ------------------------------------------------------------------ formatting
const supDigits = s => s.replace(/(\d+)([spdfg])(\d+)/g, '$1$2<sup>$3</sup>');
const chargeText = q => (Math.abs(q) === 1 ? '' : Math.abs(q)) + (q > 0 ? '+' : '−');
const ionName = (sym, q) => `${sym}<sup>${chargeText(q)}</sup>`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function fmtNum(v) {
  if (v === null || v === undefined) return '';
  return Number(v).toLocaleString('en-US', { maximumSignificantDigits: 12, useGrouping: false });
}
function fmtVal(key, d) {
  if (!d) return '';
  const unit = d.u ? ` ${d.u}` : '';
  const main = key === 'atomic_weight' ? d.digits : fmtNum(d.v);
  const unc = d.unc != null && key !== 'atomic_weight' ? ` ± ${fmtNum(d.unc)}` : '';
  return `${main}${unc}${unit}`;
}
// Cordero's spread is a standard deviation of bond lengths, not a measurement uncertainty.
function spreadNote(d) {
  return d.spread != null ? `Spread of the bond-length data (standard deviation): ${d.spread} pm.` : '';
}
function termHTML(t) {
  const m = /^(\d+)([A-Z])(\*?)<?([\d/]+)>?$/.exec(t);
  if (!m) {
    const j = /<?([\d/]+)>?/.exec(t);
    return j ? `J = ${j[1]} (no term letter assigned)` : esc(t);
  }
  return `<sup>${m[1]}</sup>${m[2]}${m[3] ? '<sup>o</sup>' : ''}<sub>${m[4]}</sub>`;
}

// ------------------------------------------------------------------ color scale (viridis, color-blind safe)
const VIRIDIS = ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'];
function viridis(t) {
  t = Math.min(1, Math.max(0, t));
  const x = t * (VIRIDIS.length - 1), i = Math.min(VIRIDIS.length - 2, Math.floor(x));
  return new THREE.Color(VIRIDIS[i]).lerp(new THREE.Color(VIRIDIS[i + 1]), x - i);
}
const cssGradient = `linear-gradient(90deg, ${VIRIDIS.join(', ')})`;

// ------------------------------------------------------------------ layout
function gridPos(e) {
  if (e.group) return { col: e.group, row: e.period };
  return { col: 3 + e.fcol, row: e.period + 3.4 }; // f rows sit below the main table, with a gap
}
const CELL = 1.0, MAX_H = 4;

// ------------------------------------------------------------------ three.js scene
const canvas = document.getElementById('scene');
const view = document.getElementById('view3d');
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
const TARGET = new THREE.Vector3(0, 0, 1.0);
const VIEW_DIR = new THREE.Vector3(0, 0.9, 0.44).normalize(); // looking down at the table from the front
camera.position.copy(TARGET).addScaledVector(VIEW_DIR, 24);
const controls = new OrbitControls(camera, canvas);
controls.target.copy(TARGET);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.47;
controls.minDistance = 6;
controls.maxDistance = 45;

scene.add(new THREE.HemisphereLight(0xffffff, 0x666677, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(-6, 14, 10);
scene.add(sun);

function themeColors() {
  const cs = getComputedStyle(document.documentElement);
  scene.background = new THREE.Color(cs.getPropertyValue('--scene-bg').trim() || '#eceae4');
}
themeColors();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { themeColors(); rebuild(); });

const group = new THREE.Group();
scene.add(group);
let tiles = []; // { mesh, e, idx, top }

function labelTexture(e, bg, hatch) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 128, 128);
  if (hatch) {
    g.strokeStyle = 'rgba(128,128,128,0.55)';
    g.lineWidth = 6;
    for (let i = -128; i < 256; i += 20) { g.beginPath(); g.moveTo(i, 128); g.lineTo(i + 128, 0); g.stroke(); }
  }
  const col = new THREE.Color(bg);
  const lum = 0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b;
  g.fillStyle = lum > 0.45 ? '#111' : '#fff';
  g.textAlign = 'center';
  g.font = 'bold 54px system-ui, sans-serif';
  g.fillText(e.sym, 64, 86);
  g.font = '22px system-ui, sans-serif';
  g.textAlign = 'left';
  g.fillText(String(e.Z), 8, 26);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function propRange(key) {
  const vals = ELS.map(e => e.props[key]?.v).filter(v => typeof v === 'number');
  return { min: Math.min(...vals), max: Math.max(...vals) };
}

function rebuild() {
  for (const t of tiles) {
    t.mesh.geometry.dispose();
    [].concat(t.mesh.material).forEach(m => { m.map?.dispose(); m.dispose(); });
  }
  group.clear();
  tiles = [];
  const { max } = propRange(prop);
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const gapBg = dark ? '#3a3b42' : '#d4d2cb';

  ELS.forEach((e, idx) => {
    const d = e.props[prop];
    const { col, row } = gridPos(e);
    const x = (col - 9.5) * CELL, z = (row - 5) * CELL;
    let mesh;
    if (d && typeof d.v === 'number') {
      const h = Math.max(0.03, (d.v / max) * MAX_H);
      const color = viridis(d.v / max);
      const predicted = isTentative(d);
      const side = new THREE.MeshStandardMaterial({
        color, roughness: 0.55, metalness: 0.05,
        transparent: predicted, opacity: predicted ? 0.32 : 1, depthWrite: !predicted,
      });
      const top = new THREE.MeshStandardMaterial({
        map: labelTexture(e, '#' + color.getHexString(), false), roughness: 0.6,
        transparent: predicted, opacity: predicted ? 0.6 : 1,
      });
      const geo = new THREE.BoxGeometry(0.86 * CELL, h, 0.86 * CELL);
      mesh = new THREE.Mesh(geo, [side, side, top, side, side, side]);
      mesh.position.set(x, h / 2, z);
      if (predicted) {
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo),
          new THREE.LineDashedMaterial({ color, dashSize: 0.12, gapSize: 0.08 }));
        edges.computeLineDistances();
        mesh.add(edges);
      }
    } else {
      const geo = new THREE.BoxGeometry(0.86 * CELL, 0.04, 0.86 * CELL);
      const m = new THREE.MeshStandardMaterial({ color: gapBg, roughness: 0.9 });
      const top = new THREE.MeshStandardMaterial({ map: labelTexture(e, gapBg, true), roughness: 0.9 });
      mesh = new THREE.Mesh(geo, [m, m, top, m, m, m]);
      mesh.position.set(x, 0.02, z);
    }
    mesh.userData.idx = idx;
    group.add(mesh);
    tiles.push({ mesh, e, idx });
  });
  // selection marker
  group.add(selRing);
  placeSelection();
  renderLegend();
  renderTable();
}

const selRing = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(0.98 * CELL, 0.02, 0.98 * CELL)),
  new THREE.LineBasicMaterial({ color: 0xff3366 }));
function placeSelection() {
  const t = tiles[selected];
  if (!t) return;
  const box = new THREE.Box3().setFromObject(t.mesh);
  selRing.position.set(t.mesh.position.x, box.max.y + 0.02, t.mesh.position.z);
}

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  // Move the camera back along the view direction until every column fits on screen.
  const pts = [];
  for (const t of tiles) {
    const b = new THREE.Box3().setFromObject(t.mesh);
    pts.push(b.min, b.max, new THREE.Vector3(b.min.x, b.max.y, b.max.z), new THREE.Vector3(b.max.x, b.max.y, b.min.z));
  }
  let dist = 10;
  for (; dist < 80; dist += 0.5) {
    camera.position.copy(TARGET).addScaledVector(VIEW_DIR, dist);
    camera.lookAt(TARGET);
    camera.updateMatrixWorld();
    if (pts.every(p => { const s = p.clone().project(camera); return Math.abs(s.x) < 0.96 && Math.abs(s.y) < 0.94; })) break;
  }
  controls.update();
}
new ResizeObserver(resize).observe(stage);

renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });

// ------------------------------------------------------------------ picking and hover
const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2();
const tip = document.getElementById('tip');
function pick(ev) {
  const r = canvas.getBoundingClientRect();
  ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  const hit = ray.intersectObjects(tiles.map(t => t.mesh), false)[0];
  return hit ? hit.object.userData.idx : null;
}
canvas.addEventListener('pointermove', ev => {
  const idx = pick(ev);
  if (idx === null) { tip.hidden = true; canvas.style.cursor = ''; return; }
  const e = ELS[idx], d = e.props[prop];
  tip.innerHTML = `<b>${e.name}</b> — ${d ? fmtVal(prop, d) : 'no value'}${d && isTentative(d) ? ` (${STATUS[d.status].toLowerCase()})` : ''}`;
  const r = stage.getBoundingClientRect();
  tip.style.left = `${ev.clientX - r.left + 14}px`;
  tip.style.top = `${ev.clientY - r.top + 14}px`;
  tip.hidden = false;
  canvas.style.cursor = 'pointer';
});
canvas.addEventListener('pointerleave', () => { tip.hidden = true; });
let downAt = null;
canvas.addEventListener('pointerdown', ev => { downAt = [ev.clientX, ev.clientY]; });
canvas.addEventListener('pointerup', ev => {
  if (!downAt || Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]) > 6) return; // was a drag
  const idx = pick(ev);
  if (idx !== null) { selected = idx; placeSelection(); openPanel(idx); }
});

// keyboard: arrows move across the grid, Enter opens
canvas.addEventListener('keydown', ev => {
  const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (dirs[ev.key]) {
    ev.preventDefault();
    const [dx, dz] = dirs[ev.key];
    const cur = gridPos(ELS[selected]);
    let best = null, bestScore = Infinity;
    ELS.forEach((e, i) => {
      const p = gridPos(e);
      const ax = (p.col - cur.col) * dx + (p.row - cur.row) * dz; // distance along the arrow
      const off = Math.abs(dx ? p.row - cur.row : p.col - cur.col);
      if (ax <= 0.1) return;
      const score = ax + off * 3;
      if (score < bestScore) { bestScore = score; best = i; }
    });
    if (best !== null) {
      selected = best;
      placeSelection();
      const e = ELS[best], d = e.props[prop];
      canvas.setAttribute('aria-label', `${e.name}, ${d ? fmtVal(prop, d) : 'no value'}. Press Enter for details.`);
      if (!panel.hidden) openPanel(best, false);
    }
  } else if (ev.key === 'Enter' || ev.key === ' ') {
    ev.preventDefault();
    openPanel(selected);
  } else if (ev.key === 'Escape') {
    closePanel();
  }
});

// ------------------------------------------------------------------ controls
const sel = document.getElementById('prop');
const explore = document.getElementById('explore');
function fillSelect() {
  const keys = Object.keys(META).filter(k => META[k].default || explore.checked);
  if (!keys.includes(prop)) prop = DEFAULT_PROP;
  sel.innerHTML = keys.map(k => {
    const m = META[k];
    return `<option value="${k}"${k === prop ? ' selected' : ''}>${m.label}${m.unit ? ` (${m.unit})` : ''}</option>`;
  }).join('');
}
explore.addEventListener('change', () => { fillSelect(); rebuild(); if (!panel.hidden) openPanel(selected, false); });
sel.addEventListener('change', () => { prop = sel.value; rebuild(); if (!panel.hidden) openPanel(selected, false); });

document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.seg button').forEach(x => x.setAttribute('aria-checked', String(x === b)));
  const table = b.dataset.view === 'table';
  document.getElementById('tableview').hidden = !table;
  view.hidden = table;
  if (!table) resize();
}));

// ------------------------------------------------------------------ legend
function renderLegend() {
  const m = META[prop];
  const { min, max } = propRange(prop);
  const gaps = ELS.filter(e => !e.props[prop]).length;
  const predicted = ELS.filter(e => e.props[prop] && isTentative(e.props[prop])).length;
  document.getElementById('legend').innerHTML = `<div class="l-main">
    <b>${m.label}</b>${m.detail ? ` — ${m.detail}` : ''}${m.unit ? ` (${m.unit})` : ''}
    <div>${m.explain}</div>
    <div class="bar" style="background:${cssGradient}"></div>
    <div class="ends"><span>0</span><span>${fmtNum(+max.toPrecision(4))}${m.unit ? ' ' + m.unit : ''}</span></div></div>
    <div><p class="scale">Height and color are proportional to the value, starting at zero. No scale compression.
      Smallest value: ${fmtNum(+min.toPrecision(4))}${m.unit ? ' ' + m.unit : ''}.</p>
    <ul>
      <li><span class="sw solid"></span> Measured or evaluated value</li>
      ${predicted ? `<li><span class="sw glass"></span> Predicted or rough estimate (glass, dashed edge): ${predicted} elements</li>` : ''}
      <li><span class="sw gap"></span> No value available: ${gaps} elements</li>
    </ul></div>`;
}

// ------------------------------------------------------------------ panel
const panel = document.getElementById('panel');
const pBody = document.getElementById('p-body');
let lastFocus = null;
document.getElementById('p-close').addEventListener('click', closePanel);
function closePanel() {
  panel.hidden = true;
  (lastFocus || canvas).focus();
}

function srcButton(d, key) {
  const s = SOURCES[d.src];
  return `<button type="button" class="srcbtn" data-src="${d.src}" data-key="${key}">${s ? s.short : d.src}</button>`;
}
function checkText(key, d) {
  const against = CHECKED_AGAINST[key];
  if (d.check === 'agrees') return `<span class="check-agrees">✓ Matches ${against}</span>`;
  if (d.check === 'differs') {
    return d.other
      ? `<span class="check-differs">Another source (${OTHER_NAME[d.other.src]}) lists ${fmtNum(d.other.v)}${d.u ? ' ' + d.u : ''}</span>`
      : `<span class="check-differs">Differs from ${against}; see review notes</span>`;
  }
  return 'Not yet confirmed by a second source';
}
function metaLine(key, d) {
  const badge = `<span class="badge ${d.status}">${STATUS[d.status]}</span>`;
  const notes = [d.note, spreadNote(d)].filter(Boolean).join(' ');
  return `<div class="meta">${badge}<span>Source: ${srcButton(d, key)}</span><span>${checkText(key, d)}</span></div>
    ${notes ? `<p class="note">${esc(notes)}</p>` : ''}`;
}

const valueRegistry = new Map(); // key -> d, for the source dialog
function openPanel(idx, focus = true) {
  const e = ELS[idx];
  valueRegistry.clear();
  const reg = (key, d) => { valueRegistry.set(key, d); return key; };
  const loc = e.group ? `Group ${e.group}, Period ${e.period}` : `Period ${e.period} (f-block row)`;
  const aw = e.props.atomic_weight;

  let html = `<h2 id="p-name">${e.name}</h2>
    <p class="zline">Atomic number ${e.Z} · ${e.sym} · ${loc}</p>
    <h3>Electron configuration</h3>
    <div class="config">${supDigits(e.config.v)}</div>
    ${metaLine(reg('config', e.config), e.config)}
    ${e.Z <= ATOM_VIEW_MAX_Z
      ? `<a class="btn atomlink" href="atom.html?Z=${e.Z}">See the electron cloud →</a>`
      : `<p class="note">Electron-cloud view: hydrogen to argon so far; more elements are coming.</p>`}`;

  // atom vs ion
  const q = COMMON_ION[e.sym];
  const atom = e.props.covalent_radius;
  if (q !== undefined && atom) {
    // Prefer 6 neighbors; for ions with spin states, use high spin (the usual state in simple salts).
    const ions = e.ions.filter(i => i.charge === q && i.spin !== 'LS');
    const ion = ions.find(i => i.cn === 'VI') || ions[0];
    html += `<h3>Atom and ion size</h3>`;
    if (ion) {
      const px = r => Math.round(r * 0.42);
      reg('ion', ion);
      html += `<div class="ioncmp">
        <figure><div class="ball" style="width:${px(atom.v)}px;height:${px(atom.v)}px"></div>${e.sym} atom<br><b>${atom.v} pm</b></figure>
        <figure><div class="ball ion" style="width:${px(ion.v)}px;height:${px(ion.v)}px"></div>${ionName(e.sym, q)} ion<br><b>${fmtNum(ion.v)} pm</b></figure>
      </div>
      <p class="note">The atom's size is its covalent radius; the ion's is its ionic radius in a crystal with
      ${ROMAN[ion.cn] ?? ion.cn} neighboring ions. They are different kinds of measurement, so the drawing shows the
      direction of the change (${q > 0 ? 'positive ions are smaller than their atoms' : 'negative ions are larger than their atoms'}),
      not an exact ratio.</p>
      <div class="vrow"><span class="lab">${ionName(e.sym, q)} ionic radius</span><span class="val">${fmtNum(ion.v)} pm</span>
      ${metaLine('ion', ion)}</div>`;
    } else {
      html += `<p class="note">Shannon's table (1976) has no ionic radius for ${ionName(e.sym, q)}, so no comparison is shown.</p>`;
    }
  }

  // property values, selected property first
  const keys = Object.keys(META).filter(k => META[k].default || explore.checked || k === 'atomic_weight');
  keys.sort((a, b) => (b === prop) - (a === prop));
  html += `<h3>Values</h3>`;
  for (const k of keys) {
    const d = e.props[k], m = META[k];
    const cur = k === prop ? ' current' : '';
    if (d) {
      reg(k, d);
      html += `<div class="vrow${cur}"><span class="lab">${m.label}${m.detail ? ` (${m.detail.toLowerCase()})` : ''}</span>
        <span class="val">${fmtVal(k, d)}</span>${metaLine(k, d)}</div>`;
    } else {
      const why = e.gaps?.[k];
      html += `<div class="vrow${cur}"><span class="lab">${m.label}</span><span class="val">—</span>
        <p class="note">${why ? esc(why) : 'No value available from the sources used.'}</p></div>`;
    }
  }

  // more detail
  const SPIN = { HS: ' (high spin)', LS: ' (low spin)' };
  const allIons = e.ions.map(i => `<tr><td>${ionName(e.sym, i.charge)}</td><td>${ROMAN[i.cn] ?? esc(i.cn)}${SPIN[i.spin] || ''}</td>
    <td class="num">${fmtNum(i.v)}${i.status === 'estimated' ? ' <span class="badge estimated">Estimate</span>' : ''}</td></tr>`).join('');
  html += `<details><summary>More detail</summary>
    <h3>Full configuration</h3><div>${e.config.full ? supDigits(e.config.full) : supDigits(e.config.v)}</div>
    ${e.term ? `<h3>Ground-state term symbol</h3><div class="config">${termHTML(e.term.v)}</div>${metaLine(reg('term', e.term), e.term)}` : ''}
    ${aw?.standard ? `<h3>Standard atomic weight (CIAAW 2024)</h3><div>${esc(aw.standard)}</div>
      <p class="note">Values in brackets are an interval: the atomic weight varies with the sample's source.</p>` : ''}
    ${allIons ? `<h3>All ionic radii (Shannon 1976)</h3><table><thead><tr><th>Ion</th><th>Neighbors</th><th>Radius (pm)</th></tr></thead>
      <tbody>${allIons}</tbody></table>` : ''}
  </details>
  <a class="report" target="_blank" rel="noopener"
    href="https://github.com/NeoGio73/CHM1025/issues/new?title=${encodeURIComponent(`Periodic table: problem with ${e.name}`)}">Report a problem with this element</a>`;

  pBody.innerHTML = html;
  panel.hidden = false;
  if (focus) {
    lastFocus = document.activeElement;
    panel.focus();
  }
}
pBody.addEventListener('click', ev => {
  const b = ev.target.closest('.srcbtn');
  if (b) showSource(b.dataset.src, valueRegistry.get(b.dataset.key), b.dataset.key);
});
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !panel.hidden && !dlg.open) closePanel(); });

// ------------------------------------------------------------------ source dialog
const dlg = document.getElementById('srcdlg');
function showSource(id, d, key) {
  const s = SOURCES[id];
  const row = (k, v) => (v ? `<dt>${k}</dt><dd>${v}</dd>` : '');
  const via = s.via ? `Machine-readable copy from ${SOURCES[s.via].short} (${SOURCES[s.via].license}), checked as shown below.` : '';
  document.getElementById('s-body').innerHTML = `<h2 id="s-title">${esc(s.short)}</h2>
    <p>${esc(s.citation)}</p>
    <dl>
      ${row('DOI', s.doi ? `<a href="https://doi.org/${s.doi}" target="_blank" rel="noopener">${s.doi}</a>` : '')}
      ${row('Web', s.url ? `<a href="${s.url}" target="_blank" rel="noopener">${esc(s.url)}</a>` : '')}
      ${row('Table used', s.table ? esc(s.table) : '')}
      ${row('Copied via', via)}
      ${row('License', esc(s.license))}
      ${row('Retrieved', s.retrieved)}
      ${d ? row('This value', `${STATUS[d.status]}${d.ref ? `; NIST bibliography code ${esc(d.ref)}` : ''}`) : ''}
      ${d ? row('Cross-check', checkText(key, d)) : ''}
    </dl>`;
  dlg.showModal();
}

// ------------------------------------------------------------------ table view
let sortKey = 'Z', sortDir = 1;
function renderTable() {
  const m = META[prop];
  document.getElementById('t-caption').textContent =
    `${m.label}${m.unit ? ` (${m.unit})` : ''} for all 118 elements. Select an element to see its details and sources.`;
  document.getElementById('t-prop').textContent = `${m.label}${m.unit ? ` (${m.unit})` : ''}`;
  const rows = ELS.map((e, i) => ({ e, i, d: e.props[prop] }));
  rows.sort((a, b) => {
    const va = sortKey === 'v' ? a.d?.v : sortKey === 'name' ? a.e.name : a.e.Z;
    const vb = sortKey === 'v' ? b.d?.v : sortKey === 'name' ? b.e.name : b.e.Z;
    if (va === undefined) return 1;
    if (vb === undefined) return -1;
    return (va > vb ? 1 : va < vb ? -1 : 0) * sortDir;
  });
  document.querySelector('#data-table tbody').innerHTML = rows.map(({ e, i, d }) => `<tr>
    <td>${e.Z}</td>
    <td><button type="button" class="el" data-idx="${i}">${e.name} (${e.sym})</button></td>
    <td class="num">${d ? fmtVal(prop, d) : `— <span class="note">${e.gaps?.[prop] ? 'see details' : 'no value'}</span>`}</td>
    <td>${d ? `<span class="badge ${d.status}">${STATUS[d.status]}</span>` : ''}</td>
    <td class="src">${d ? esc(SOURCES[d.src].short) : ''}</td></tr>`).join('');
}
document.querySelector('#data-table thead').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-sort]');
  if (!b) return;
  sortDir = sortKey === b.dataset.sort ? -sortDir : 1;
  sortKey = b.dataset.sort;
  renderTable();
});
document.querySelector('#data-table tbody').addEventListener('click', ev => {
  const b = ev.target.closest('button.el');
  if (b) { selected = +b.dataset.idx; placeSelection(); openPanel(selected); }
});

// ------------------------------------------------------------------ start
fillSelect();
rebuild();
resize();
document.getElementById('loading').remove();
