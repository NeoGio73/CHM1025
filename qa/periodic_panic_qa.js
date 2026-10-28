// QA for Periodic Panic (terms.js + engine.js + stages/*.js).
// Loads the real page in headless Chromium (served from http://localhost:8765/periodic-panic/) and
// drives the game's own round builders from inside the page: nextTarget(), E.distractors(),
// each stage's start(target) and the stage _debug()/choices() views of the round it built.
// Usage: node periodic_panic_qa.js [drawsAllChapters] [drawsPerSingleChapter]
'use strict';
const fs = require('fs');
const { chromium } = require('playwright');
const URL = process.env.PP_URL || 'http://localhost:8765/periodic-panic/index.html';
const DRAWS_ALL = parseInt(process.argv[2] || '20000', 10);
const DRAWS_ONE = parseInt(process.argv[3] || '2000', 10);

// ---------------------------------------------------------------- in-page harness
function pageHarness(cfg) {
  const out = { checks: {}, faults: [], info: {} };
  const check = (name, ok, detail) => {
    const c = out.checks[name] = out.checks[name] || { pass: 0, fail: 0 };
    if (ok) c.pass++; else { c.fail++; if (c.fail <= 4) out.faults.push({ check: name, detail }); }
  };
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const bare = t => t.replace(/\s*\(.*?\)/g, '').trim();
  const clueHasWord = (clue, word) => new RegExp('(^|[^A-Za-z])' + esc(word) + '(s|es)?([^A-Za-z]|$)', 'i').test(clue);

  // ---- fixed data ---------------------------------------------------------------------------
  if (cfg.fixed) {
    const T = window.TERMS, ids = new Map(), terms = new Map(), shorts = new Map();
    out.info.totalTerms = T.length; out.info.bankTerms = BANK.length;
    out.info.skipSections = window.SKIP_SECTIONS; out.info.skipTerms = window.SKIP_TERMS;
    T.forEach((t, i) => {
      for (const k of ['id', 'term', 'short', 'clue', 'section']) check('term field non-empty: ' + k, typeof t[k] === 'string' && t[k].trim().length > 0, { i, t });
      check('term chapter is a number', Number.isInteger(t.chapter), { i, t });
      check('term chapter has a name', !!window.CHAPTER_NAMES[String(t.chapter)], { i, t });
      check('section belongs to chapter', t.section.split('.')[0] === String(t.chapter), { i, t });
      check('no duplicate id', !ids.has(t.id), { i, t, first: ids.get(t.id) }); ids.set(t.id, i);
      const tk = t.term.toLowerCase(); check('no duplicate term', !terms.has(tk), { i, t, first: terms.get(tk) }); terms.set(tk, i);
      const sk = t.short.toLowerCase(); check('no duplicate short label', !shorts.has(sk), { i, t, first: shorts.get(sk) }); shorts.set(sk, i);
      check('short fits the strip (<= 16 chars)', t.short.length <= 16, { i, short: t.short, len: t.short.length });
      // the clue must not give away the term (whole word; the bare term, its short, and the parenthesised symbol)
      const words = [bare(t.term), bare(t.short)];
      const paren = (t.term.match(/\((.*?)\)/) || [])[1]; if (paren) words.push(paren);
      const leak = words.filter(w => w.length >= 2 && clueHasWord(t.clue, w));
      check('clue does not contain the term/short/symbol', leak.length === 0, { id: t.id, term: t.term, short: t.short, clue: t.clue, leak });
    });
    // groups
    const bankIds = new Set(BANK.map(t => t.id)), allIds = new Set(T.map(t => t.id));
    out.info.groups = [];
    window.GROUPS.forEach(g => {
      check('group members exist in TERMS', g.members.every(id => allIds.has(id)), { g: g.id, missing: g.members.filter(id => !allIds.has(id)) });
      check('group tricky exist in TERMS', g.tricky.every(id => allIds.has(id)), { g: g.id, missing: g.tricky.filter(id => !allIds.has(id)) });
      check('group tricky disjoint from members', !g.tricky.some(id => g.members.includes(id)), { g: g.id });
      check('group members unique', new Set(g.members).size === g.members.length, { g: g.id });
      const inBank = g.members.filter(id => bankIds.has(id));
      out.info.groups.push({ id: g.id, members: g.members.length, inBank: inBank.length, playable: inBank.length >= 3 });
    });
    // a term that is a member of two groups (would make a Zip Sort round ambiguous)
    const memberOf = {};
    window.GROUPS.forEach(g => g.members.forEach(id => (memberOf[id] = memberOf[id] || []).push(g.id)));
    Object.entries(memberOf).forEach(([id, gs]) => check('term belongs to at most one group', gs.length === 1, { id, groups: gs }));
    // shield-spell suitability
    const sh = STAGES.find(s => s.id === 'shield-spell')._debug();
    out.info.shieldSuits = BANK.filter(sh.suits).length;
    out.info.shieldUnsuited = BANK.filter(t => !sh.suits(t)).map(t => t.term);
    return out;
  }

  // ---- draws --------------------------------------------------------------------------------
  selected = new Set(cfg.chapters);
  newGame('free', 0);
  G.level = cfg.level || 1;
  const byId = Object.fromEntries(BANK.map(t => [t.id, t]));
  const pool = G.pool;
  out.info.pool = pool.length;
  const stageIds = cfg.stages || ['robo-lab', 'mole-hole', 'jungle-jump', 'isotope', 'shield-spell', 'zip-sort'];
  const asked = {};
  for (const sid of stageIds) {
    const stage = STAGES.find(s => s.id === sid);
    G.stage = stage; G.stageIdx = STAGES.indexOf(stage); G.stageSolved = 0; G.queue = shuffle(G.pool.slice());
    const tag = `${sid}`;
    for (let d = 0; d < cfg.draws; d++) {
      const target = nextTarget();
      G.target = target;
      check(tag + ': target is defined', !!target, { d });
      if (!target) break;
      stage.start(target, { fresh: true });
      asked[target.id] = (asked[target.id] || 0) + 1;
      if (sid === 'zip-sort') {
        const S = stage._debug().S;
        const tb = S.boxes.filter(b => b.term);
        const good = tb.filter(b => b.good), bad = tb.filter(b => !b.good);
        check(tag + ': one fork box', S.boxes.filter(b => b.fork).length === 1, { d });
        check(tag + ': fork box carries no term', S.boxes.every(b => !(b.fork && b.term)), { d });
        check(tag + ': no duplicate term among boxes', new Set(tb.map(b => b.term.id)).size === tb.length, { d, terms: tb.map(b => b.term.term) });
        check(tag + ': no duplicate label among boxes', new Set(tb.map(b => b.term.term.toLowerCase())).size === tb.length, { d });
        check(tag + ': need equals number of good boxes', S.need === good.length, { d, need: S.need, good: good.length });
        if (target.group) {
          const g = target.group, members = new Set(g.members);
          const inPool = g.members.filter(id => byId[id] && pool.includes(byId[id]));
          check(tag + ': group has >= 3 members in the chosen chapters', inPool.length >= 3, { d, g: g.id, inPool });
          check(tag + ': good boxes are all members of the group', good.every(b => members.has(b.term.id)), { d, g: g.id, good: good.map(b => b.term.id) });
          check(tag + ': good count = min(4, members in pool)', good.length === Math.min(4, inPool.length), { d, g: g.id, good: good.length, inPool: inPool.length });
          check(tag + ': no wrong box is a member of the group', bad.every(b => !members.has(b.term.id)), { d, g: g.id, bad: bad.map(b => b.term.id) });
          // wrong boxes come only from the group's tricky list and from other groups' members, restricted to the chosen chapters
          const trickyAvail = g.tricky.filter(id => byId[id] && pool.includes(byId[id]) && !members.has(id));
          const othersAvail = [...new Set(window.GROUPS.filter(o => o.id !== g.id).flatMap(o => o.members))].filter(id => byId[id] && pool.includes(byId[id]) && !members.has(id) && !g.tricky.includes(id));
          const expectWrong = Math.min(9 - good.length, Math.min(3, trickyAvail.length) + othersAvail.length);
          check(tag + ': wrong-box count = min(9 - good, candidates available)', bad.length === expectWrong, { d, g: g.id, bad: bad.length, expectWrong, trickyAvail, othersAvail: othersAvail.length });
          out.info['boxCount:' + tb.length] = (out.info['boxCount:' + tb.length] || 0) + 1;
          check(tag + ': boxes are from the chosen chapters', tb.every(b => pool.includes(b.term)), { d });
          check(tag + ': clue names the category prompt', target.clue.includes(g.prompt), { d, clue: target.clue });
          // record which wrong terms appear for which category (for the ambiguity review)
          const key = 'wrongBy:' + g.id; out.info[key] = out.info[key] || {};
          bad.forEach(b => { out.info[key][b.term.id] = (out.info[key][b.term.id] || 0) + 1; });
        } else {
          check(tag + ': single-term fallback has the target once', good.length === 1 && good[0].term.id === target.id, { d, target: target.id });
          check(tag + ': fallback wrong boxes are not the target', bad.every(b => b.term.id !== target.id), { d });
        }
        continue;
      }
      if (sid === 'shield-spell') {
        const dbg = stage._debug(), S = dbg.S;
        check(tag + ': target suits the stage', dbg.suits(target), { d, target: target.term });
        check(tag + ': word is the bare term', S.word === dbg.wordOf(target), { d, word: S.word, term: target.term });
        const need = [...S.word].filter(ch => /[A-Z]/.test(ch));
        check(tag + ': word has 3-15 letters', need.length >= 3 && need.length <= 15, { d, word: S.word });
        const have = {}; S.cells.forEach(c => { if (c.ch) have[c.ch] = (have[c.ch] || 0) + 1; });
        const want = {}; need.forEach(ch => { want[ch] = (want[ch] || 0) + 1; });
        check(tag + ': every letter of the word is on the shield (with multiplicity)', Object.entries(want).every(([ch, n]) => (have[ch] || 0) >= n), { d, word: S.word, want, have });
        check(tag + ': first position skips non-letters', /[A-Z]/.test(S.word[S.pos]), { d, word: S.word, pos: S.pos });
        check(tag + ': clue does not contain the word', !clueHasWord(target.clue, bare(target.term)), { d, term: target.term, clue: target.clue });
        continue;
      }
      // the four "pick the term" stages
      let opts, labelOf, expected;
      if (sid === 'robo-lab') { opts = stage._debug().R.robots.map(r => r.term); labelOf = t => t.term; expected = clamp(3 + Math.ceil(G.level / 2), 4, 7); }
      else if (sid === 'jungle-jump') { opts = stage._debug().S.treasures.map(t => t.term); labelOf = t => t.term; expected = 3; }
      else if (sid === 'isotope') { opts = stage._debug().S.choices; labelOf = t => t.short; expected = 3; }
      else if (sid === 'mole-hole') {
        // Mole Hole exposes no debug view: use the portrait-strip choice list (short labels)
        const labels = stage.choices().map(c => c.text);
        check(tag + ': 4 crystals placed', labels.length === 4, { d, labels, target: target.short });
        check(tag + ': target crystal present exactly once', labels.filter(l => l === target.short).length === 1, { d, labels, target: target.short });
        check(tag + ': no duplicate crystal labels', new Set(labels.map(l => l.toLowerCase())).size === labels.length, { d, labels });
        check(tag + ': clue does not contain the term', !clueHasWord(target.clue, bare(target.term)) && !clueHasWord(target.clue, bare(target.short)), { d, target: target.term, clue: target.clue });
        continue;
      }
      const ids = opts.map(t => t.id), labels = opts.map(labelOf);
      check(tag + ': option count as designed', opts.length === expected, { d, n: opts.length, expected, pool: pool.length });
      check(tag + ': target present exactly once', ids.filter(i => i === target.id).length === 1, { d, ids, target: target.id });
      check(tag + ': no duplicate option ids', new Set(ids).size === ids.length, { d, ids });
      check(tag + ': no duplicate option labels', new Set(labels.map(l => l.toLowerCase())).size === labels.length, { d, labels });
      check(tag + ': no distractor shares the target short label', opts.every(t => t.id === target.id || t.short.toLowerCase() !== target.short.toLowerCase()), { d, labels });
      check(tag + ': no distractor shares the target term', opts.every(t => t.id === target.id || t.term.toLowerCase() !== target.term.toLowerCase()), { d, labels });
      check(tag + ': all options are bank terms', opts.every(t => byId[t.id] === t), { d, ids });
      const same = opts.filter(t => t.id !== target.id && t.chapter === target.chapter).length;
      out.info['sameChapterDistractors:' + sid] = (out.info['sameChapterDistractors:' + sid] || 0) + same;
      check(tag + ': clue does not contain the term', !clueHasWord(target.clue, bare(target.term)) && !clueHasWord(target.clue, bare(target.short)), { d, target: target.term, clue: target.clue });
      // distractor whose clue would also fit (same term text ignoring parenthesis) -- label-level only
      check(tag + ': no distractor with the same bare term', opts.every(t => t.id === target.id || bare(t.term).toLowerCase() !== bare(target.term).toLowerCase()), { d, labels });
    }
  }
  out.info.distinctTargets = Object.keys(asked).length;
  return out;
}

// ---------------------------------------------------------------- runner
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGE ERROR', e.message));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof STAGES !== 'undefined' && STAGES.length === 6);
  const all = { fixed: null, runs: [] };
  const merge = (name, r) => {
    let pass = 0, fail = 0;
    for (const v of Object.values(r.checks)) { pass += v.pass; fail += v.fail; }
    console.log(`\n== ${name}: ${pass} passed, ${fail} failed; info=${JSON.stringify(Object.fromEntries(Object.entries(r.info).filter(([k]) => !k.startsWith('wrongBy') && k !== 'shieldUnsuited' && k !== 'groups')))}`);
    for (const [k, v] of Object.entries(r.checks)) if (v.fail) console.log(`  FAIL ${k}: ${v.pass} passed, ${v.fail} failed`);
    if (r.faults.length) console.log('  faults:', JSON.stringify(r.faults.slice(0, 6)));
    all.runs.push({ name, pass, fail, checks: r.checks, faults: r.faults, info: r.info });
  };
  const fixed = await page.evaluate(pageHarness, { fixed: true });
  merge('fixed data', fixed); all.fixed = fixed;
  console.log('  groups:', JSON.stringify(fixed.info.groups));
  console.log('  shield-spell: suited terms', fixed.info.shieldSuits, 'unsuited:', JSON.stringify(fixed.info.shieldUnsuited));
  const chapters = await page.evaluate(() => [...new Set(BANK.map(t => t.chapter))].sort((a, b) => a - b));
  console.log('chapters:', chapters);
  merge(`all chapters, level 1, ${DRAWS_ALL} draws/stage`, await page.evaluate(pageHarness, { chapters, draws: DRAWS_ALL, level: 1 }));
  merge(`all chapters, level 9, ${Math.min(DRAWS_ALL, 5000)} draws/stage`, await page.evaluate(pageHarness, { chapters, draws: Math.min(DRAWS_ALL, 5000), level: 9 }));
  for (const c of chapters) merge(`chapter ${c} only, level 3, ${DRAWS_ONE} draws/stage`, await page.evaluate(pageHarness, { chapters: [c], draws: DRAWS_ONE, level: 3 }));
  merge(`chapters 1+7, level 3, ${DRAWS_ONE} draws/stage`, await page.evaluate(pageHarness, { chapters: [1, 7], draws: DRAWS_ONE, level: 3 }));
  merge(`chapters 10+11+12, level 5, ${DRAWS_ONE} draws/stage`, await page.evaluate(pageHarness, { chapters: [10, 11, 12], draws: DRAWS_ONE, level: 5 }));
  let P = 0, F = 0; all.runs.forEach(r => { P += r.pass; F += r.fail; });
  console.log(`\nTOTAL checks: ${P} passed, ${F} failed`);
  fs.writeFileSync(__dirname + '/periodic_panic_results.json', JSON.stringify(all, null, 1));
  await browser.close();
})();
