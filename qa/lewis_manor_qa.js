// QA for Escape from Lewis Manor (lewis-manor/index.html, CHM 1025 rooms).
// The game's trial builders live inside one IIFE, so this script copies index.html, appends a
// line that exposes the trial functions and data on window.__LM, serves that copy to headless
// Chromium (page.route; every other request goes to http://localhost:8765/lewis-manor/), and then
// instantiates every trial thousands of times, clicking its real buttons/SVG hit areas and checking
// the real feedback (api.good / api.partial / api.bad) against independently recomputed chemistry.
// Usage: node lewis_manor_qa.js [draws]   (default 3000 per trial type; some cheap ones use more)
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const SRC = process.env.LM_SRC || path.join(__dirname, '..', 'lewis-manor', 'index.html');
const URL = process.env.LM_URL || 'http://localhost:8765/lewis-manor/index.html';
const N = parseInt(process.argv[2] || '3000', 10);

// ---------------------------------------------------------------- patched copy of the page
const EXPOSE = `
window.__LM = { Room, api, fb, setFeedback, VALENCE, BOND_PATTERN, LONE_SETS, foyerValence10, foyerBonds, foyerShare, foyerLonePairs,
  cryptCount, cryptIonic, cryptBuild, C_MOLS_10, C_IONS_10, COUNTS, countOf, IONIC_PAIRS, VAL,
  galleryCatch, galleryRealFake, galleryWhich, galleryTruth, RES_SETS, resForm, RES_PAIRS, resMol, HAS_RES, FC_MOLS,
  gardenGroups, gardenTrim, gardenNotes, gardenAngles, VS, vsShape, SHAPE_KEYS, SHAPE_NAMES, SHAPE_DESCS, pickShapes, autoMol,
  parlorBoard, parlorDeltas, parlorAuras, parlorRank, EN, dEN, bondClass, POOL, AURA_SETS, POLAR_RANK,
  mirrorCancel, mirrorPairs, mirrorTwoQuestions, molPolarity, POLAR_KEYS, MIRROR_PAIRS,
  towerForces, towerRank, towerMelt, towerWaterBoss, IMF_MOLS, MP_PAIRS, IMF, ROOM_BUILDERS, ROOMS };
`;
const original = fs.readFileSync(SRC, 'utf8');
const tail = '\n})();\n</script>';
const at = original.lastIndexOf(tail);
if (at < 0) throw new Error('could not find the end of the game IIFE');
const patched = original.slice(0, at) + '\n' + EXPOSE + original.slice(at);
const COPY_DIR = path.join(require('os').tmpdir(), 'lm_copy');
fs.mkdirSync(COPY_DIR, { recursive: true });
fs.writeFileSync(path.join(COPY_DIR, 'index.html'), patched);

// ---------------------------------------------------------------- in-page harness
function harness(cfg) {
  const LM = window.__LM;
  const out = { checks: {}, faults: [], info: {} };
  const check = (name, ok, detail) => {
    const c = out.checks[name] = out.checks[name] || { pass: 0, fail: 0 };
    if (ok) c.pass++; else { c.fail++; if (c.fail <= 4) out.faults.push({ check: name, detail }); }
  };
  const realTimeout = window.setTimeout;
  window.setTimeout = fn => { fn(); return 0; };   // the trials' short animation delays run at once
  if (!SVGElement.prototype.click) SVGElement.prototype.click = function () { this.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); };

  // ---------- independent chemistry (not taken from the game) ----------
  const VAL_REF = { H: 1, Li: 1, Na: 1, K: 1, Be: 2, Mg: 2, Ca: 2, B: 3, C: 4, Si: 4, N: 5, P: 5, O: 6, S: 6, F: 7, Cl: 7, Br: 7, I: 7 };
  const BONDS_REF = { H: 1, C: 4, N: 3, O: 2, F: 1, Si: 4, P: 3, S: 2, Cl: 1, Br: 1 };
  const GROUP_REF = { 1: '1A (1)', 2: '2A (2)', 3: '3A (13)', 4: '4A (14)', 5: '5A (15)', 6: '6A (16)', 7: '7A (17)' };
  // Timberlake Figure 10.2 electronegativity values, typed independently of the game's table
  const EN_REF = { H: 2.1, Li: 1.0, Be: 1.5, B: 2.0, C: 2.5, N: 3.0, O: 3.5, F: 4.0, Na: 0.9, Mg: 1.2, Al: 1.5, Si: 1.8, P: 2.1, S: 2.5, Cl: 3.0,
    K: 0.8, Ca: 1.0, Ga: 1.6, Ge: 1.8, As: 2.0, Se: 2.4, Br: 2.8, Rb: 0.8, Sr: 1.0, In: 1.7, Sn: 1.8, Sb: 1.9, Te: 2.1, I: 2.5,
    Cs: 0.7, Ba: 0.9, Tl: 1.8, Pb: 1.9, Bi: 1.9, Po: 2.0, At: 2.1 };
  const dEN_REF = (a, b) => Math.round(Math.abs(EN_REF[a] - EN_REF[b]) * 10) / 10;
  const classRef = d => d <= 0.4 ? 'nonpolar covalent' : d <= 1.8 ? 'polar covalent' : 'ionic';   // Timberlake: 0.0-0.4, 0.5-1.8, 1.9-3.3
  // VSEPR reference by formula: [central, lone pairs on central, bonded atoms]
  const VSEPR_REF = { 'CO₂': [0, 2], 'CS₂': [0, 2], 'HCN': [0, 2], 'H₂CO': [0, 3], 'SO₃': [0, 3], 'NO₃⁻': [0, 3], 'SO₂': [1, 2], 'NO₂⁻': [1, 2],
    'CH₄': [0, 4], 'CCl₄': [0, 4], 'SiCl₄': [0, 4], 'NH₄⁺': [0, 4], 'NH₃': [1, 3], 'PCl₃': [1, 3], 'NF₃': [1, 3], 'H₂O': [2, 2], 'OF₂': [2, 2], 'SCl₂': [2, 2], 'H₂S': [2, 2], 'ClO₂⁻': [2, 2],
    'SiF₄': [0, 4], 'CF₄': [0, 4], 'CHF₃': [0, 4], 'CH₃F': [0, 4], 'CH₃Cl': [0, 4], 'PBr₃': [1, 3], 'H₃O⁺': [1, 3], 'Cl₂O': [2, 2] };
  const SHAPE_REF = { '2,2': ['linear', 180], '3,3': ['trigonal planar', 120], '3,2': ['bent (120°)', 120], '4,4': ['tetrahedral', 109], '4,3': ['trigonal pyramidal', 109], '4,2': ['bent (109°)', 109] };
  const vseprRef = f => { const [lp, b] = VSEPR_REF[f]; const g = lp + b; const [name, angle] = SHAPE_REF[`${g},${b}`]; return { groups: g, bonded: b, name, angle }; };
  // molecular polarity reference (Timberlake 10.5 rule), by formula
  const POLAR_REF = { 'CO₂': false, 'CS₂': false, 'H₂O': true, 'NH₃': true, 'CH₄': false, 'CCl₄': false, 'PCl₃': true, 'SO₃': false, 'SO₂': true, 'OF₂': true, 'NF₃': true,
    'SiF₄': false, 'CHF₃': true, 'CH₃F': true, 'CH₃Cl': true, 'HCl': true, 'Cl₂': false, 'CO': true, 'SCl₂': true, 'PBr₃': true, 'H₂CO': true, 'CF₄': false };
  // intermolecular force reference, by formula (hb = H on N/O/F; dd = polar; disp = nonpolar)
  const IMF_REF = { 'HF': 'Hydrogen bonds', 'H₂O': 'Hydrogen bonds', 'NH₃': 'Hydrogen bonds', 'CH₃OH': 'Hydrogen bonds', 'H₂O₂': 'Hydrogen bonds',
    'HCl': 'Dipole–dipole attractions', 'HBr': 'Dipole–dipole attractions', 'PCl₃': 'Dipole–dipole attractions', 'H₂S': 'Dipole–dipole attractions', 'NF₃': 'Dipole–dipole attractions', 'CH₃Cl': 'Dipole–dipole attractions', 'BrF': 'Dipole–dipole attractions',
    'Br₂': 'Dispersion forces', 'Cl₂': 'Dispersion forces', 'CH₄': 'Dispersion forces', 'CO₂': 'Dispersion forces', 'CF₄': 'Dispersion forces', 'O₂': 'Dispersion forces' };
  const MP_REF = { 'HF|HBr': 'HF', 'H₂O|H₂Se': 'H₂O', 'NH₃|PH₃': 'NH₃', 'F₂|HF': 'HF', 'Br₂|PBr₃': 'PBr₃', 'Cl₂|PCl₃': 'PCl₃', 'CH₄|CH₃OH': 'CH₃OH', 'H₂|HCl': 'HCl', 'Cl₂|Br₂': 'Br₂' };
  const VE_REF = { 'ClO₃⁻': 26, 'NH₄⁺': 8, 'CO₃²⁻': 24, 'SO₄²⁻': 32, 'NO₃⁻': 24, 'PO₄³⁻': 32, 'H₃O⁺': 8, 'CN⁻': 10, 'CCl₄': 32, 'CS₂': 16, 'PCl₃': 26, 'NF₃': 26, 'CH₂O': 12 };
  const RES_REF = { 'O₃': true, 'SO₂': true, 'SO₃': true, 'NO₃⁻': true, 'NO₂⁻': true, 'SCl₂': false, 'H₂O': false, 'CH₄': false, 'HCN': false, 'PCl₃': false };
  const IONIC_REF = { NaCl: ['Na', 'Cl', 1], KF: ['K', 'F', 1], KCl: ['K', 'Cl', 1], LiBr: ['Li', 'Br', 1], MgO: ['Mg', 'O', 2], CaO: ['Ca', 'O', 2] };
  const AURA_REF = { 'H₂': 'np', 'Cl₂': 'np', 'Br₂': 'np', 'F₂': 'np', 'HCl': 'p', 'HBr': 'p', 'ClF': 'p', 'NaCl': 'i', 'KBr': 'i', 'LiF': 'i' };
  const LONE_REF = { 'H₂O': 2, 'NH₃': 1, 'HF': 3 };
  const fByKey = Object.fromEntries(Object.entries(LM.VS).map(([k, v]) => [v.f, k]));

  // ---------- helpers ----------
  const newApi = () => { const ev = []; return { ev, partial(m) { ev.push(['partial', m]); }, good(m) { ev.push(['good', m]); }, bad(m) { ev.push(['bad', m]); } }; };
  const start = (fn, ...extra) => { LM.Room.locked = false; const host = document.createElement('div'); const api = newApi(); fn(host, api, ...extra); host.appendChild(LM.fb); return { host, api }; };
  const fire = (api, el) => { const n = api.ev.length; el.click(); return api.ev.slice(n); };
  const expectKinds = (tag, api, el, kinds, detail) => {
    const got = fire(api, el);
    const ok = got.length === 1 && kinds.includes(got[0][0]);
    check(tag, ok, Object.assign({ got: got.map(g => g[0]), msg: got[0] && got[0][1] }, detail));
    if (got[0] && typeof got[0][1] === 'string') check('feedback text has no undefined/NaN', !/undefined|NaN/.test(got[0][1]), { tag, msg: got[0][1] });
    return got;
  };
  const choices = root => [...root.querySelectorAll('button.btn.choice')];
  const nextBtn = root => [...root.querySelectorAll('button.btn')].find(b => /▸$/.test(b.textContent) && !b.classList.contains('choice'));
  // click every wrong option first (must each give 'bad'), then the expected one (must give partial/good)
  const stepChoice = (tag, api, btns, labelOf, expected, detail, okKinds) => {
    const want = btns.filter(b => labelOf(b) === expected);
    check(tag + ': exactly one option matches the recomputed answer', want.length === 1, Object.assign({ labels: btns.map(labelOf), expected }, detail));
    check(tag + ': option labels unique', new Set(btns.map(labelOf)).size === btns.length, Object.assign({ labels: btns.map(labelOf) }, detail));
    for (const b of btns) if (b !== want[0]) expectKinds(tag + ': wrong option rejected', api, b, ['bad'], Object.assign({ label: labelOf(b), expected }, detail));
    if (want[0] && okKinds && okKinds.length === 0) { const got = fire(api, want[0]); check(tag + ': recomputed answer accepted (silently, next step follows)', got.length === 0, Object.assign({ got: got.map(g => g[0]), label: labelOf(want[0]) }, detail)); return got; }
    if (want[0]) return expectKinds(tag + ': recomputed answer accepted', api, want[0], okKinds || ['partial', 'good'], Object.assign({ label: labelOf(want[0]) }, detail));
    return [];
  };
  const txt = b => b.textContent.trim();
  const svgOf = (root, i = 0) => root.querySelectorAll('svg')[i];

  const draws = (name, n) => { out.info[name] = n; return n; };

  // ================================================================ Room I: Foyer
  for (let d = 0; d < draws('foyerValence10', cfg.n); d++) {
    // read the element from the prompt, then test every electron count 0..8 on fresh instances
    for (let k = 0; k <= 8; k++) {
      const { host, api } = start(LM.foyerValence10);
      const name = host.querySelector('p.ins b').textContent;
      const el = LM.VALENCE.find(e => e.name === name);
      check('foyerValence10: element in table', !!el, { name });
      if (!el) continue;
      const v = VAL_REF[el.s];
      check('foyerValence10: game valence = reference', el.v === v, { el });
      check('foyerValence10: prompt does not state the count', !new RegExp(`\\b${v}\\b`).test(host.querySelector('p.ins').textContent), { prompt: host.querySelector('p.ins').textContent });
      const spots = [...host.querySelectorAll('.hit')];
      check('foyerValence10: 8 electron spots', spots.length === 8, { n: spots.length });
      for (let i = 0; i < k; i++) spots[i].click();
      const chk = [...host.querySelectorAll('button.btn')].find(b => txt(b) === 'Check');
      const got = expectKinds('foyerValence10: Check gives good iff count = valence', api, chk, k === v ? ['good'] : ['bad'], { el: el.s, placed: k, v });
      if (k === v && got[0]) check('foyerValence10: good message states the right group and count', got[0][1].includes(`Group ${GROUP_REF[v]}`) && got[0][1].includes(`shows ${v} valence`), { msg: got[0][1] });
    }
  }
  for (let d = 0; d < draws('foyerBonds', cfg.n); d++) {
    const { host, api } = start(LM.foyerBonds);
    const seen = [];
    for (let step = 0; step < 3; step++) {
      const holder = host.querySelector('.stack');
      const sym = svgOf(holder).querySelector('text.sym').textContent;
      const dots = svgOf(holder).querySelectorAll('circle.e').length;
      seen.push(sym);
      check('foyerBonds: Lewis symbol shows the right number of dots', dots === VAL_REF[sym], { sym, dots });
      stepChoice('foyerBonds', api, choices(holder), txt, `${BONDS_REF[sym]} bond${BONDS_REF[sym] > 1 ? 's' : ''}`, { sym, d });
      if (step < 2) nextBtn(holder).click();
    }
    check('foyerBonds: three different elements', new Set(seen).size === 3, { seen });
  }
  for (let d = 0; d < draws('foyerShare', cfg.n); d++) {
    const { host, api } = start(LM.foyerShare);
    const name = host.querySelector('p.ins').textContent.match(/Two (\w+) atoms/)[1];
    const sym = { fluorine: 'F', chlorine: 'Cl' }[name];
    const svg = svgOf(host);
    check('foyerShare: 14 electrons drawn (7 per atom)', svg.querySelectorAll('circle.e').length === 14, { name });
    const hits = [...svg.querySelectorAll('.hit')];
    const byAtom = [hits.filter(h => +h.getAttribute('cx') < 180), hits.filter(h => +h.getAttribute('cx') >= 180)];
    byAtom.forEach((hs, ai) => {
      const sides = {}; hs.forEach(h => { const s = h.getAttribute('aria-label').match(/, (\w+) side/)[1]; sides[s] = (sides[s] || 0) + 1; });
      const singles = Object.entries(sides).filter(([, n]) => n === 1).map(([s]) => s);
      check('foyerShare: each atom has exactly one unpaired electron', singles.length === 1 && Object.values(sides).reduce((a, b) => a + b, 0) === 7, { ai, sides });
      const paired = hs.find(h => !h.getAttribute('aria-label').includes(singles[0] + ' side'));
      expectKinds('foyerShare: paired electron rejected', api, paired, ['bad'], { ai });
      const single = hs.find(h => h.getAttribute('aria-label').includes(singles[0] + ' side'));
      const got = fire(api, single);
      check('foyerShare: unpaired electron accepted silently', got.length === 0, { ai, got });
    });
    const btns = choices(host);
    check('foyerShare: bonded view appeared with 4 options', btns.length === 4, { labels: btns.map(txt) });
    stepChoice('foyerShare', api, btns, txt, '8', { sym });
  }
  for (let d = 0; d < draws('foyerLonePairs', cfg.n); d++) {
    const { host, api } = start(LM.foyerLonePairs);
    const f = [...host.querySelectorAll('p.ins b')].pop().textContent;
    const svg = svgOf(host);
    const hs = [...svg.querySelectorAll('text.hsym')];
    const hSides = hs.map(h => { const dx = +h.getAttribute('x') - 150, dy = +h.getAttribute('y') - 95; return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'top' : 'bottom'); });
    const hits = [...svg.querySelectorAll('.hit')];
    const sideOf = h => h.getAttribute('aria-label').match(/on the (\w+)/)[1];
    const lone = hits.filter(h => !hSides.includes(sideOf(h)));
    check('foyerLonePairs: lone-pair count = reference', lone.length === LONE_REF[f] && hs.length === 4 - LONE_REF[f], { f, hSides, lone: lone.length });
    hits.filter(h => hSides.includes(sideOf(h))).forEach(h => expectKinds('foyerLonePairs: bonding pair rejected', api, h, ['bad'], { f, side: sideOf(h) }));
    lone.forEach((h, i) => {
      const got = fire(api, h);
      if (i < lone.length - 1) check('foyerLonePairs: partial progress is silent', got.length === 0, { f, got });
      else { check('foyerLonePairs: last lone pair gives good', got.length === 1 && got[0][0] === 'good', { f, got }); if (got[0]) check('foyerLonePairs: good message counts agree', got[0][1].includes(`All ${LONE_REF[f]} found`) && got[0][1].includes(`${4 - LONE_REF[f]} bonding pair`), { msg: got[0][1] }); }
    });
  }

  // ================================================================ Room II: Crypt
  for (let d = 0; d < draws('cryptCount', cfg.n); d++) {
    const { host, api } = start(LM.cryptCount);
    const seen = [];
    for (let step = 0; step < 3; step++) {
      const holder = host.querySelector('.stack');
      const f = holder.querySelector('.formula').textContent; seen.push(f);
      const ans = VE_REF[f];
      check('cryptCount: formula in reference', ans !== undefined, { f });
      const inp = holder.querySelector('input.numin'), btn = [...holder.querySelectorAll('button.btn')].find(b => txt(b) === 'Count it');
      const item = LM.COUNTS.find(c => c[0] === f), q = item ? item[2] : 0;
      for (const wrong of [ans - 1, ans + 1, q ? ans + q : ans + 2]) { inp.value = String(wrong); expectKinds('cryptCount: wrong total rejected', api, btn, ['bad'], { f, typed: wrong, ans }); }
      inp.value = String(ans);
      const got = expectKinds('cryptCount: reference total accepted', api, btn, ['partial', 'good'], { f, ans });
      if (got[0]) check('cryptCount: message shows the same total', got[0][1].includes(`= ${ans} valence electrons`), { msg: got[0][1] });
      if (step < 2) nextBtn(holder).click();
    }
    check('cryptCount: one neutral + two ions, all distinct', new Set(seen).size === 3 && seen.filter(f => /[⁺⁻]/.test(f)).length === 2, { seen });
  }
  for (let d = 0; d < draws('cryptIonic', cfg.n); d++) {
    const { host, api } = start(LM.cryptIonic);
    const f = host.querySelector('p.ins b').textContent;
    const [m, x, c] = IONIC_REF[f];
    const tiles = [...host.querySelectorAll('button.painting')];
    check('cryptIonic: four drawings', tiles.length === 4, { f });
    const kind = t => {
      const s = t.querySelector('svg'), br = s.querySelectorAll('.bracket').length, ch = [...s.querySelectorAll('text.charge')].map(e => e.textContent);
      if (!br) return [...s.querySelectorAll('circle.e')].some(e => +e.getAttribute('cx') < 160) ? 'atoms' : 'shared';   // 'shared' draws no dots on the metal
      return ch[0].includes('−') ? 'swapped' : 'correct';
    };
    const kinds = tiles.map(kind);
    check('cryptIonic: the four variants are all different', new Set(kinds).size === 4, { f, kinds });
    const correct = tiles[kinds.indexOf('correct')];
    if (correct) {
      const s = correct.querySelector('svg'), ch = [...s.querySelectorAll('text.charge')].map(e => e.textContent);
      check('cryptIonic: correct drawing has the right charges and an octet on the anion', ch[0] === (c === 1 ? '+' : `${c}+`) && ch[1] === (c === 1 ? '−' : `${c}−`) && s.querySelectorAll('circle.e').length === 8 && [...s.querySelectorAll('text.sym')].map(e => e.textContent).join() === `${m},${x}`, { f, ch, dots: s.querySelectorAll('circle.e').length });
    }
    tiles.filter(t => t !== correct).forEach(t => expectKinds('cryptIonic: wrong drawing rejected', api, t, ['bad'], { f, kind: kind(t) }));
    const got = expectKinds('cryptIonic: correct drawing accepted', api, correct, ['good'], { f });
    if (got[0]) check('cryptIonic: good message names the ions', got[0][1].includes(m) && got[0][1].includes(x), { msg: got[0][1] });
  }
  // the builder: brute-force all lone-pair/bond-order assignments the game's rule accepts, then play one
  const buildSolutions = m => {
    const SIDES = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] };
    const side = (i, j) => { const dx = m.atoms[j][1] - m.atoms[i][1], dy = m.atoms[j][2] - m.atoms[i][2]; return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'bottom' : 'top'); };
    const occ = m.atoms.map(() => new Set()); m.bonds.forEach(([i, j]) => { occ[i].add(side(i, j)); occ[j].add(side(j, i)); });
    const open = m.atoms.map((a, i) => a[0] === 'H' ? 0 : 4 - occ[i].size);
    const total = m.atoms.reduce((s, a) => s + VAL_REF[a[0]], 0) - m.q;
    const hBond = m.bonds.map(([i, j]) => m.atoms[i][0] === 'H' || m.atoms[j][0] === 'H');
    const sols = [];
    const rec = (bi, orders) => {
      if (bi < m.bonds.length) { for (let o = 1; o <= (hBond[bi] ? 1 : 3); o++) rec(bi + 1, [...orders, o]); return; }
      const recL = (ai, lps) => {
        if (ai < m.atoms.length) { for (let l = 0; l <= open[ai]; l++) recL(ai + 1, [...lps, l]); return; }
        const drawn = lps.reduce((s, l) => s + 2 * l, 0) + orders.reduce((s, o) => s + 2 * o, 0);
        if (drawn !== total) return;
        for (let i = 0; i < m.atoms.length; i++) { const ar = 2 * lps[i] + m.bonds.reduce((s, [a, b], k) => s + (a === i || b === i ? 2 * orders[k] : 0), 0); if (ar !== (m.atoms[i][0] === 'H' ? 2 : 8)) return; }
        sols.push({ orders, lps });
      };
      recL(0, []);
    };
    rec(0, []);
    return { sols, total, open };
  };
  const builderMols = [...LM.C_MOLS_10.map(m => [m, false]), ...LM.C_IONS_10.map(m => [m, true])];
  out.info.builderSolutions = {};
  builderMols.forEach(([m]) => { const { sols, total } = buildSolutions(m); out.info.builderSolutions[m.f] = { total, solutions: sols.length }; check('cryptBuild: every builder molecule has an accepted octet structure', sols.length >= 1, { f: m.f, total }); });
  for (let d = 0; d < draws('cryptBuild', cfg.n); d++) {
    const isIon = d % 2 === 1;
    const m = isIon ? LM.C_IONS_10[Math.floor(Math.random() * LM.C_IONS_10.length)] : LM.C_MOLS_10[Math.floor(Math.random() * LM.C_MOLS_10.length)];
    const { host, api } = start(LM.cryptBuild, m, isIon);
    const { sols, total } = buildSolutions(m);
    if (!sols.length) continue;
    const sol = sols[Math.floor(Math.random() * sols.length)];
    const seal = [...host.querySelectorAll('button.btn')].find(b => txt(b) === 'Seal the coffin');
    const initial = sol.orders.every(o => o === 1) && sol.lps.every(l => l === 0);
    if (!initial) {
      const got = expectKinds('cryptBuild: bare skeleton rejected', api, seal, ['bad'], { f: m.f });
      const drawn0 = 2 * m.bonds.length;
      if (got[0]) check('cryptBuild: skeleton message reports the drawn count', drawn0 === total ? true : got[0][1].includes(`drawn ${drawn0} electrons`), { f: m.f, msg: got[0][1] });
    }
    // realise the solution by clicking the real hit areas (they are re-rendered on every click)
    const svg = svgOf(host);
    const bondHit = k => { const [i, j] = m.bonds[k]; const lab = `${m.atoms[i][0]}–${m.atoms[j][0]} bond`; return [...svg.querySelectorAll('polygon.hit')].filter(h => h.getAttribute('aria-label').startsWith(lab)); };
    const bondIdx = m.bonds.map((b, k) => { const [i, j] = b; const lab = `${m.atoms[i][0]}–${m.atoms[j][0]} bond`; return m.bonds.slice(0, k).filter(([a, c]) => `${m.atoms[a][0]}–${m.atoms[c][0]} bond` === lab).length; });
    sol.orders.forEach((o, k) => { for (let t = 1; t < o; t++) bondHit(k)[bondIdx[k]].click(); });
    m.atoms.forEach((a, i) => {
      for (let t = 0; t < sol.lps[i]; t++) {
        const s = a[0], same = m.atoms.slice(0, i).filter(b => b[0] === s && b[1] === a[1] && b[2] === a[2]).length;
        const empties = [...svg.querySelectorAll('rect.hit')].filter(h => h.getAttribute('aria-label').startsWith(s + ' ') && h.getAttribute('aria-label').endsWith('empty') && Math.abs(+h.getAttribute('x') + (+h.getAttribute('width')) / 2 - a[1]) < 60 && Math.abs(+h.getAttribute('y') + (+h.getAttribute('height')) / 2 - a[2]) < 60);
        check('cryptBuild: an empty lone-pair spot is available where the solution needs one', empties.length > 0, { f: m.f, atom: s, i, same });
        if (empties.length) empties[0].click();
      }
    });
    const tally = host.querySelector('p.count').textContent;
    check('cryptBuild: tally shows the full electron count', tally === `Electrons drawn: ${total}`, { f: m.f, tally, total });
    const got = expectKinds('cryptBuild: recomputed octet structure accepted', api, seal, ['good'], { f: m.f, sol });
    if (got[0]) {
      const bp = sol.orders.reduce((s, o) => s + o, 0), lp = sol.lps.reduce((s, l) => s + l, 0);
      check('cryptBuild: good message counts agree', got[0][1].includes(`${total} valence electrons, ${bp} bonding pairs and ${lp} lone pairs`), { f: m.f, msg: got[0][1], bp, lp });
    }
  }

  // ================================================================ Room III: Gallery
  // resonance forms the game draws: electron count and octets, checked independently
  LM.RES_SETS.forEach(set => set.terms.forEach((_, k) => {
    const m = LM.resForm(set, k);
    const e = Object.values(m.lp).reduce((s, l) => s + 2 * l.length, 0) + m.bonds.reduce((s, b) => s + 2 * b[2], 0);
    const want = m.atoms.reduce((s, a) => s + VAL_REF[a[0]], 0) - m.q;
    check('galleryCatch: resonance form has the right electron count', e === want, { f: set.f, k, e, want });
    m.atoms.forEach((a, i) => { const ar = 2 * (m.lp[i] || []).length + m.bonds.reduce((s, [x, y, o]) => s + (x === i || y === i ? 2 * o : 0), 0); check('galleryCatch: every atom in each resonance form has an octet', ar === 8, { f: set.f, k, i, ar }); });
  }));
  for (let d = 0; d < draws('galleryCatch', cfg.n); d++) {
    const { host, api } = start(LM.galleryCatch);
    const f = host.querySelector('p.ins b').textContent;
    const set = LM.RES_SETS.find(s => s.f === f), n = set.terms.length;
    const hang = [...host.querySelectorAll('button.btn')].find(b => txt(b) === 'Hang the gallery');
    expectKinds('galleryCatch: hanging before every form is captured is rejected', api, hang, ['bad'], { f });
    const bonds = () => [...svgOf(host).querySelectorAll('polygon.hit')];
    check('galleryCatch: one hit area per bond', bonds().length === n, { f, n: bonds().length });
    for (let k = 1; k < n; k++) { bonds()[k].click(); if (k < n - 1) expectKinds('galleryCatch: still incomplete is rejected', api, hang, ['bad'], { f, k }); }
    check('galleryCatch: shelf shows every form', host.querySelectorAll('.res-shelf .painting').length === n, { f });
    const got = expectKinds('galleryCatch: all forms captured is accepted', api, hang, ['good'], { f });
    if (got[0]) check('galleryCatch: message states the number of forms', got[0][1].includes(`All ${n} resonance structures`), { msg: got[0][1] });
  }
  const molInfo = svg => ({ atoms: [...svg.querySelectorAll('text.sym, text.hsym')].map(t => t.textContent).join(''), e: svg.querySelectorAll('circle.e').length + 2 * svg.querySelectorAll('line.bond').length });
  for (let d = 0; d < draws('galleryRealFake', cfg.n); d++) {
    const { host, api } = start(LM.galleryRealFake);
    const seen = [];
    for (let step = 0; step < 4; step++) {
      const holder = host.querySelector('.stack');
      const [a, b] = [...holder.querySelectorAll('.res-pair svg')].map(molInfo);
      seen.push(a.atoms + '|' + b.atoms + '|' + a.e + '|' + b.e);
      const real = a.atoms === b.atoms && a.e === b.e;   // same skeleton in the same order, same electron count
      stepChoice('galleryRealFake', api, choices(holder), txt, real ? 'Real resonance structures' : 'Forgery', { a, b, d });
      if (step < 3) nextBtn(holder).click();
    }
    check('galleryRealFake: four distinct pairs', new Set(seen).size === 4, { seen });
  }
  for (let d = 0; d < draws('galleryWhich', cfg.n); d++) {
    const { host, api } = start(LM.galleryWhich);
    const tiles = [...host.querySelectorAll('button.painting')];
    const fs = tiles.map(txt);
    check('galleryWhich: four distinct formulas, 2 with resonance and 2 without', new Set(fs).size === 4 && fs.filter(f => RES_REF[f]).length === 2 && fs.every(f => f in RES_REF), { fs });
    const reveal = [...host.querySelectorAll('button.btn')].find(b => txt(b) === 'Reveal');
    expectKinds('galleryWhich: selecting nothing is rejected', api, reveal, ['bad'], { fs });
    tiles.forEach(t => { if (RES_REF[txt(t)]) t.click(); });
    // flip one tile at a time: every single flip must be rejected
    tiles.forEach(t => { t.click(); expectKinds('galleryWhich: one flipped tile is rejected', api, reveal, ['bad'], { fs, flipped: txt(t) }); t.click(); });
    const got = expectKinds('galleryWhich: the reference set is accepted', api, reveal, ['good'], { fs });
    if (got[0]) check('galleryWhich: explanation names all four', fs.every(f => got[0][1].includes(f.replace(/[⁻]/g, '⁻'))), { msg: got[0][1], fs });
  }
  for (let d = 0; d < draws('galleryTruth', cfg.n); d++) {
    const { host, api } = start(LM.galleryTruth);
    const REF = ['identical, with a length between a single and a double bond', 'where the electrons are placed'];
    for (let q = 0; q < 2; q++) {
      const rows = host.querySelectorAll('.stack');
      const btns = choices(rows[q]);
      check('galleryTruth: four options', btns.length === 4, { q });
      stepChoice('galleryTruth', api, btns, txt, REF[q], { q });
    }
  }

  // ================================================================ Room IV: Garden
  const gardenRun = (name, fn, labelOf, expectedOf, extra) => {
    for (let d = 0; d < draws(name, cfg.n); d++) {
      const { host, api } = start(fn);
      const seen = [];
      for (let step = 0; step < 3; step++) {
        const holder = host.querySelector('.stack');
        const f = holder.querySelector('p.count').textContent.split(' · ')[0];
        const ref = vseprRef(f); seen.push(ref.name);
        if (extra) extra(holder, f, ref);
        const got = stepChoice(name, api, choices(holder), txt, expectedOf(ref), { f, d });
        if (got[0]) check(name + ': feedback names the formula', got[0][1].includes(f), { msg: got[0][1], f });
        if (step < 2) nextBtn(holder).click();
      }
      check(name + ': three hedges of three different shapes', new Set(seen).size === 3, { seen });
    }
  };
  // the game's shape function vs. the reference, for every molecule it draws
  Object.entries(LM.VS).forEach(([k, sp]) => { if (sp.f in VSEPR_REF) { const g = LM.vsShape(sp), r = vseprRef(sp.f); check('vsShape = reference (groups, bonded, name, angle)', g.groups === r.groups && g.bonded === r.bonded && g.name === r.name && g.angle === r.angle, { k, g, r }); } });
  gardenRun('gardenGroups', LM.gardenGroups, txt, r => `${r.groups} groups`, (holder, f, r) => {
    const svg = svgOf(holder), lines = svg.querySelectorAll('line.bond').length, dots = svg.querySelectorAll('circle.e').length;
    const total = Object.entries(LM.VS).find(([, v]) => v.f === f)[1];
    const want = (total.c ? [total.c, ...total.t] : []).reduce((s, a) => s + VAL_REF[a], 0) - (total.q || 0);
    check('gardenGroups: drawn molecule has the right electron count', dots + 2 * lines === want, { f, dots, lines, want });
  });
  gardenRun('gardenTrim', LM.gardenTrim, txt, r => r.name);
  gardenRun('gardenAngles', LM.gardenAngles, txt, r => `${r.angle}°`);
  for (let d = 0; d < draws('gardenNotes', cfg.n); d++) {
    const { host, api } = start(LM.gardenNotes);
    const seen = [];
    for (let step = 0; step < 3; step++) {
      const holder = host.querySelector('.stack');
      const [, g, b] = holder.querySelector('.note-page').textContent.match(/(\d) electron groups and (\d) bonded atoms/);
      const name = SHAPE_REF[`${g},${b}`][0]; seen.push(name);
      stepChoice('gardenNotes', api, choices(holder), txt, name, { g, b, d });
      if (step < 2) nextBtn(holder).click();
    }
    check('gardenNotes: three different descriptions', new Set(seen).size === 3, { seen });
  }

  // ================================================================ Room V: Parlor
  Object.keys(EN_REF).forEach(s => check('EN table = Timberlake Figure 10.2 values', LM.EN[s] === EN_REF[s], { s, game: LM.EN[s], ref: EN_REF[s] }));
  check('EN table has no extra elements', Object.keys(LM.EN).every(s => s in EN_REF), { extra: Object.keys(LM.EN).filter(s => !(s in EN_REF)) });
  Object.entries(LM.POOL).forEach(([k, pairs]) => pairs.forEach(p => check('POOL classification = reference cutoffs', { nonpolar: 'nonpolar covalent', polar: 'polar covalent', ionic: 'ionic' }[k] === classRef(dEN_REF(...p)), { k, p, d: dEN_REF(...p) })));
  out.info.poolSizes = Object.fromEntries(Object.entries(LM.POOL).map(([k, v]) => [k, v.length]));
  const parseWork = msg => msg.match(/ΔEN = (\d\.\d) − (\d\.\d) = (\d\.\d)/);
  for (let d = 0; d < draws('parlorBoard', cfg.n); d++) {
    const { host, api } = start(LM.parlorBoard);
    const seen = [], classes = [];
    for (let step = 0; step < 4; step++) {
      const bond = svgOf(host).querySelector('text.sym.small').textContent, [a, b] = bond.split('–');
      const dd = dEN_REF(a, b), cls = classRef(dd); seen.push(bond); classes.push(cls);
      check('parlorBoard: both atoms in the EN table', a in EN_REF && b in EN_REF, { bond });
      const got = stepChoice('parlorBoard', api, choices(host), b2 => txt(b2).toLowerCase(), cls, { bond, d: dd });
      if (got[0]) {
        const w = parseWork(got[0][1]);
        check('parlorBoard: shown arithmetic is right and uses the table values', !!w && +w[1] === Math.max(EN_REF[a], EN_REF[b]) && +w[2] === Math.min(EN_REF[a], EN_REF[b]) && +w[3] === dd, { msg: got[0][1], a, b });
        check('parlorBoard: message names the class', got[0][1].includes(cls), { msg: got[0][1], cls });
      }
    }
    check('parlorBoard: four different bonds', new Set(seen.map(s => s.split('–').sort().join())).size === 4, { seen });
    check('parlorBoard: all three classes appear', new Set(classes).size === 3, { classes });
  }
  for (let d = 0; d < draws('parlorDeltas', cfg.n); d++) {
    const { host, api } = start(LM.parlorDeltas);
    const seen = [], kinds = [];
    for (let step = 0; step < 3; step++) {
      const holder = host.querySelector('.stack');
      const [a, c] = [...svgOf(holder).querySelectorAll('text.sym')].map(t => t.textContent);
      const dd = dEN_REF(a, c), polar = dd >= 0.5; seen.push(a + c); kinds.push(polar);
      check('parlorDeltas: bond is covalent (not ionic)', dd <= 1.8, { a, c, dd });
      const row = holder.querySelectorAll('.row')[0];
      const exp = polar ? (EN_REF[a] > EN_REF[c] ? `δ− on ${a}` : `δ− on ${c}`) : 'Nonpolar: no partial charges';
      if (polar) check('parlorDeltas: polar bond has no EN tie', EN_REF[a] !== EN_REF[c], { a, c });
      const got1 = stepChoice('parlorDeltas (charges)', api, choices(row), txt, exp, { a, c, dd }, polar ? [] : ['partial', 'good']);
      if (polar) {
        const row2 = holder.querySelectorAll('.row')[1];
        const expArrow = EN_REF[a] > EN_REF[c] ? `Toward ${a}` : `Toward ${c}`;
        const got2 = stepChoice('parlorDeltas (arrow)', api, choices(row2), b => txt(b).split('  ')[0], expArrow, { a, c });
        if (got2[0]) { const hi = EN_REF[a] > EN_REF[c] ? a : c; check('parlorDeltas: arrow message gives ΔEN and the δ− atom', got2[0][1].includes(`ΔEN = ${dd.toFixed(1)}`) && got2[0][1].includes(`${hi} (${EN_REF[hi].toFixed(1)}) pulls harder`), { msg: got2[0][1] }); }
      } else if (got1[0]) check('parlorDeltas: nonpolar message gives ΔEN', got1[0][1].includes(`ΔEN = ${dd.toFixed(1)}`), { msg: got1[0][1] });
      if (step < 2) nextBtn(holder).click();
    }
    check('parlorDeltas: two polar bonds and one nonpolar', kinds.filter(Boolean).length === 2, { seen, kinds });
    check('parlorDeltas: three different bonds', new Set(seen).size === 3, { seen });
  }
  LM.AURA_SETS.forEach(set => check('AURA_SETS: molecules classified as the reference', AURA_REF[set.np] === 'np' && AURA_REF[set.p] === 'p' && AURA_REF[set.i] === 'i', { set }));
  for (let d = 0; d < draws('parlorAuras', cfg.n); d++) {
    const { host, api } = start(LM.parlorAuras);
    const svg = svgOf(host);
    const auraKind = g => g.querySelector('circle[fill="#2a3ad8"]') ? 'i' : (g.querySelector('ellipse[fill^="url"]').getAttribute('fill').endsWith('c)') ? 'np' : 'p');
    const auras = () => [...svg.querySelectorAll('g.aura')];
    const coffins = () => [...svg.querySelectorAll('g.coffin')];
    const kinds = auras().map(auraKind), names = coffins().map(c => c.querySelector('.coffinlabel').textContent);
    check('parlorAuras: three auras of three kinds', new Set(kinds).size === 3, { kinds });
    check('parlorAuras: three molecules of three kinds', new Set(names.map(n => AURA_REF[n])).size === 3 && names.every(n => n in AURA_REF), { names });
    const bind = [...host.querySelectorAll('button.btn')].find(b => txt(b) === 'Bind the spirits');
    const assign = perm => { for (let i = 0; i < 3; i++) { auras()[perm[i]].querySelector('.hit').click(); coffins()[i].querySelector('.hit').click(); } };
    // a wrong assignment: swap two
    const right = names.map(n => kinds.indexOf(AURA_REF[n]));
    assign([right[1], right[0], right[2]]);
    expectKinds('parlorAuras: wrong assignment rejected', api, bind, ['bad'], { kinds, names });
    assign(right);
    expectKinds('parlorAuras: reference assignment accepted', api, bind, ['good'], { kinds, names });
  }
  for (let d = 0; d < draws('parlorRank', cfg.n); d++) {
    const { host, api } = start(LM.parlorRank);
    const svg = svgOf(host);
    const balls = () => [...svg.querySelectorAll('rect.hit')];
    const bonds = balls().map(h => h.getAttribute('aria-label').match(/holding (\S+)/)[1]);
    const ds = bonds.map(b => dEN_REF(...b.split('–')));
    check('parlorRank: three bonds with distinct ΔEN', new Set(ds).size === 3, { bonds, ds });
    const order = [0, 1, 2].sort((i, j) => ds[j] - ds[i]);
    const gaze = [...host.querySelectorAll('button.btn')].find(b => txt(b) === 'Gaze into them'), clear = [...host.querySelectorAll('button.btn')].find(b => txt(b) === 'Start over');
    // every wrong permutation must be rejected, then the reference order accepted
    const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]].filter(p => p.join() !== order.join());
    for (const p of perms) { clear.click(); p.forEach(i => balls()[i].click()); expectKinds('parlorRank: wrong order rejected', api, gaze, ['bad'], { bonds, p }); }
    clear.click(); order.forEach(i => balls()[i].click());
    const got = expectKinds('parlorRank: reference order accepted', api, gaze, ['good'], { bonds, order });
    if (got[0]) check('parlorRank: message lists the bonds from most to least polar', got[0][1].includes(order.map(i => `${bonds[i]} (ΔEN ${ds[i].toFixed(1)})`).join(' > ')), { msg: got[0][1] });
  }

  // ================================================================ Room VI: Mirrors
  LM.POLAR_KEYS.forEach(k => { const sp = LM.VS[k]; check('molPolarity = reference for every POLAR_KEYS molecule', LM.molPolarity(sp).polar === POLAR_REF[sp.f], { k, f: sp.f, game: LM.molPolarity(sp).polar, ref: POLAR_REF[sp.f] }); });
  for (let d = 0; d < draws('mirrorCancel', cfg.n); d++) {
    const { host, api } = start(LM.mirrorCancel);
    const seen = [], pol = [];
    for (let step = 0; step < 4; step++) {
      const holder = host.querySelector('.stack');
      const [f, shapeTxt] = holder.querySelector('p.count').textContent.split(' · ');
      seen.push(f); pol.push(POLAR_REF[f]);
      check('mirrorCancel: formula in reference', f in POLAR_REF, { f });
      const key = fByKey[f], sp = LM.VS[key];
      if (sp.t.length > 1 && sp.f in VSEPR_REF) check('mirrorCancel: stated shape = reference', shapeTxt === `shape: ${vseprRef(sp.f).name}`, { f, shapeTxt });
      const got = stepChoice('mirrorCancel', api, choices(holder), txt, POLAR_REF[f] ? 'Polar' : 'Nonpolar', { f });
      if (got[0]) check('mirrorCancel: explanation ends with the same verdict', got[0][1].includes(POLAR_REF[f] ? `${f} is polar.` : `${f} is nonpolar.`) || got[0][1].includes(POLAR_REF[f] ? 'so it is polar' : 'so it is nonpolar'), { msg: got[0][1], f });
      if (step < 3) nextBtn(holder).click();
    }
    check('mirrorCancel: four different molecules, two polar and two nonpolar', new Set(seen).size === 4 && pol.filter(Boolean).length === 2, { seen, pol });
  }
  for (let d = 0; d < draws('mirrorPairs', cfg.n); d++) {
    const { host, api } = start(LM.mirrorPairs);
    const seen = [];
    for (let step = 0; step < 3; step++) {
      const holder = host.querySelector('.stack');
      const frames = [...holder.querySelectorAll('button.mirror')];
      const fs = frames.map(fr => fr.querySelector('.mirror-cap').textContent); seen.push(fs.slice().sort().join('|'));
      check('mirrorPairs: exactly one of the pair is polar (reference)', fs.filter(f => POLAR_REF[f]).length === 1, { fs });
      const wrong = frames.find(fr => !POLAR_REF[fr.querySelector('.mirror-cap').textContent]), right = frames.find(fr => POLAR_REF[fr.querySelector('.mirror-cap').textContent]);
      expectKinds('mirrorPairs: nonpolar twin rejected', api, wrong, ['bad'], { fs });
      expectKinds('mirrorPairs: polar twin accepted', api, right, ['partial', 'good'], { fs });
      if (step < 2) nextBtn(holder).click();
    }
    check('mirrorPairs: three different pairs', new Set(seen).size === 3, { seen });
  }
  for (let d = 0; d < draws('mirrorTwoQuestions', cfg.n); d++) {
    const { host, api } = start(LM.mirrorTwoQuestions);
    const seen = [];
    for (let step = 0; step < 2; step++) {
      const holder = host.querySelector('.stack');
      const f = holder.querySelector('p.count').textContent.split(' · ')[0]; seen.push(f);
      const sp = LM.VS[fByKey[f]];
      const polarBonds = sp.t.some(x => dEN_REF(sp.c, x) >= 0.5);
      const row1 = holder.querySelectorAll('.row')[0];
      stepChoice('mirrorTwoQuestions (step 1)', api, choices(row1), txt, polarBonds ? 'Yes, polar bonds' : 'No, nonpolar bonds', { f }, polarBonds ? [] : ['partial', 'good']);
      if (polarBonds) {
        const row2 = holder.querySelectorAll('.row')[1];
        check('mirrorTwoQuestions: step 2 appears for polar bonds', !!row2, { f });
        if (row2) {
          const q2 = holder.querySelectorAll('p.ins')[1].textContent;
          check('mirrorTwoQuestions: step 2 names the reference shape', q2.includes(`${f} is ${vseprRef(f).name}`), { q2, f });
          stepChoice('mirrorTwoQuestions (step 2)', api, choices(row2), txt, POLAR_REF[f] ? 'They don\'t cancel: polar' : 'They cancel: nonpolar', { f });
        }
      } else check('mirrorTwoQuestions: no step 2 for nonpolar bonds', holder.querySelectorAll('p.ins').length === 1, { f });
      if (step < 1) nextBtn(holder).click();
    }
    check('mirrorTwoQuestions: two different molecules', new Set(seen).size === 2, { seen });
  }

  // ================================================================ Room VII: Tower
  LM.IMF_MOLS.forEach(([f, k]) => check('IMF_MOLS = reference', LM.IMF[k] === IMF_REF[f], { f, game: LM.IMF[k], ref: IMF_REF[f] }));
  LM.MP_PAIRS.forEach(([a, b, w]) => check('MP_PAIRS winner = reference', MP_REF[`${a}|${b}`] === w, { a, b, w }));
  for (let d = 0; d < draws('towerForces', cfg.n); d++) {
    const { host, api } = start(LM.towerForces);
    const seen = [];
    const total = +host.querySelector('.stack p.count').textContent.match(/of (\d+)/)[1];
    out.info['towerForcesClumps:' + total] = (out.info['towerForcesClumps:' + total] || 0) + 1;
    check('towerForces: five clumps, as the prompt promises', total === 5, { total });
    for (let step = 0; step < total; step++) {
      const holder = host.querySelector('.stack');
      const f = holder.querySelector('.formula.monster').textContent; seen.push(f);
      check('towerForces: formula in reference', f in IMF_REF, { f });
      const got = stepChoice('towerForces', api, choices(holder), txt, IMF_REF[f], { f }, step < total - 1 ? ['partial'] : ['good']);
      if (step < total - 1) { const nb = nextBtn(holder); check('towerForces: next clump offered', !!nb, { step, total, seen }); if (!nb) break; nb.click(); }
    }
    check('towerForces: distinct molecules', new Set(seen).size === seen.length, { seen });
    check('towerForces: all three forces present (design intent of the generator)', new Set(seen.map(f => IMF_REF[f])).size === 3, { seen });
  }
  for (let d = 0; d < draws('towerRank', cfg.n); d++) {
    const { host, api } = start(LM.towerRank);
    const tiles = () => [...host.querySelectorAll('button.chain-tile')];
    const labels = tiles().map(t => t.textContent.trim());
    const REF = ['Hydrogen bonds', 'Dipole–dipole attractions', 'Dispersion forces'];
    check('towerRank: three forces offered', labels.slice().sort().join() === REF.slice().sort().join(), { labels });
    const pull = [...host.querySelectorAll('button.btn')].find(b => txt(b) === 'Pull the chains');
    const idx = REF.map(r => labels.indexOf(r));
    const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
    for (const p of perms) {
      const order = p.map(i => idx[i]);
      // toggling: click the three tiles in the wanted order (clear any previous order first by re-clicking)
      tiles().forEach(t => { if (t.classList.contains('chosen')) t.click(); });
      order.forEach(i => tiles()[i].click());
      expectKinds('towerRank: only strongest-to-weakest is accepted', api, pull, p.join() === '0,1,2' ? ['good'] : ['bad'], { p });
    }
  }
  for (let d = 0; d < draws('towerMelt', cfg.n); d++) {
    const { host, api } = start(LM.towerMelt);
    const seen = [];
    for (let step = 0; step < 3; step++) {
      const holder = host.querySelector('.stack');
      const cands = [...holder.querySelectorAll('button.race-candle')];
      const fs = cands.map(c => c.querySelector('.rc-label').textContent);
      const key = Object.keys(MP_REF).find(k => k.split('|').sort().join() === fs.slice().sort().join());
      seen.push(key);
      check('towerMelt: pair in reference', !!key, { fs });
      if (!key) continue;
      const win = MP_REF[key];
      const loser = cands.find(c => c.querySelector('.rc-label').textContent !== win), winner = cands.find(c => c.querySelector('.rc-label').textContent === win);
      expectKinds('towerMelt: weaker-forces candle rejected', api, loser, ['bad'], { fs });
      expectKinds('towerMelt: stronger-forces candle accepted', api, winner, ['partial', 'good'], { fs });
      if (step < 2) nextBtn(holder).click();
    }
    check('towerMelt: three different pairs', new Set(seen).size === 3, { seen });
  }
  for (let d = 0; d < draws('towerWaterBoss', cfg.n); d++) {
    const { host, api } = start(LM.towerWaterBoss);
    const svg = svgOf(host);
    const hit = lab => [...svg.querySelectorAll('rect.hit')].find(h => h.getAttribute('aria-label') === lab);
    ['left O', 'bottom H', 'right molecule'].forEach(l => expectKinds('towerWaterBoss: wrong first pick rejected', api, hit(l), ['bad'], { l }));
    expectKinds('towerWaterBoss: δ+ hydrogen accepted', api, hit('right H'), ['partial'], {});
    ['right O atom', 'H on the right molecule'].forEach(l => expectKinds('towerWaterBoss: wrong second pick rejected', api, hit(l), ['bad'], { l }));
    const got = fire(api, hit('left lone pair of the right O'));
    check('towerWaterBoss: lone pair accepted (no feedback event, question appears)', got.length === 0 && host.querySelectorAll('button.btn.choice.wide').length === 4, { got });
    stepChoice('towerWaterBoss (question)', api, [...host.querySelectorAll('button.btn.choice.wide')], txt, 'Water molecules are held together by hydrogen bonds', {});
  }

  window.setTimeout = realTimeout;
  return out;
}

// ---------------------------------------------------------------- runner
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGE ERROR', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  await page.route(URL, route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: patched }));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__LM);
  const rooms = await page.evaluate(() => window.__LM.ROOMS.map((r, i) => `${r.n} ${r.name} (${r.topic}): ${window.__LM.ROOM_BUILDERS[i]().length} trials`));
  console.log('rooms:', rooms.join('\n       '));
  const t0 = Date.now();
  const res = await page.evaluate(harness, { n: N });
  console.log(`harness ran in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  let P = 0, F = 0;
  for (const [k, v] of Object.entries(res.checks)) { P += v.pass; F += v.fail; console.log(`${v.fail ? 'FAIL' : 'ok  '} ${k}: ${v.pass} passed, ${v.fail} failed`); }
  console.log('draws per trial type:', JSON.stringify(res.info));
  console.log(`TOTAL checks: ${P} passed, ${F} failed`);
  if (res.faults.length) console.log('FAULT EXAMPLES:\n' + res.faults.map(f => JSON.stringify(f)).join('\n'));
  fs.writeFileSync(__dirname + '/lewis_manor_results.json', JSON.stringify({ draws: N, rooms, checks: res.checks, info: res.info, faults: res.faults }, null, 1));
  await browser.close();
})();
