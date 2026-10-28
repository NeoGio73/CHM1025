// QA for Beaker Catch (syllabus true/false game).
// Extracts SETTINGS, STATEMENTS, shuffle() and pickRound() verbatim from the game's index.html
// and runs them in Node. Usage: node beaker_catch_qa.js [draws]
'use strict';
const fs = require('fs'), vm = require('vm');
const SRC = process.env.BC_SRC || require('path').join(__dirname, '..', 'beaker-catch', 'index.html');
const DRAWS = parseInt(process.argv[2] || '20000', 10);
const html = fs.readFileSync(SRC, 'utf8');

// --- extract the data block (first <script>) and the two functions from the game script
const dataBlock = html.match(/<script>\s*\/\* =+\s*BEAKER CATCH[\s\S]*?<\/script>/)[0].replace(/<\/?script>/g, '');
const fnText = name => {
  const i = html.indexOf(`function ${name}(`);
  if (i < 0) throw new Error('function not found: ' + name);
  let depth = 0, j = html.indexOf('{', i);
  for (; j < html.length; j++) { if (html[j] === '{') depth++; else if (html[j] === '}') { depth--; if (depth === 0) break; } }
  return html.slice(i, j + 1);
};
const ctx = { Math, Set, console };
vm.createContext(ctx);
const { SETTINGS, STATEMENTS, pickRound } = vm.runInContext(dataBlock + '\n' + fnText('shuffle') + '\n' + fnText('pickRound') + '\n({ SETTINGS, STATEMENTS, pickRound });', ctx);

const results = { checks: {}, faults: [] };
const check = (name, ok, detail) => {
  results.checks[name] = results.checks[name] || { pass: 0, fail: 0 };
  if (ok) results.checks[name].pass++; else { results.checks[name].fail++; if (results.checks[name].fail <= 5) results.faults.push({ check: name, detail }); }
};

// --- fixed data checks
const n = STATEMENTS.length;
console.log(`STATEMENTS: ${n}; roundsPerGame=${SETTINGS.roundsPerGame}; topics=${new Set(STATEMENTS.map(s => s.topic)).size}`);
const texts = new Map();
STATEMENTS.forEach((s, i) => {
  check('field:text non-empty', typeof s.text === 'string' && s.text.trim().length > 0, { i, s });
  check('field:fix non-empty', typeof s.fix === 'string' && s.fix.trim().length > 0, { i, s });
  check('field:section non-empty', typeof s.section === 'string' && s.section.trim().length > 0, { i, s });
  check('field:topic non-empty', typeof s.topic === 'string' && s.topic.trim().length > 0, { i, s });
  check('field:isTrue boolean', typeof s.isTrue === 'boolean', { i, s });
  check('text length <= 80 chars (author guideline ~70)', s.text.length <= 80, { i, text: s.text, len: s.text.length });
  const key = s.text.trim().toLowerCase();
  check('no duplicate statement text', !texts.has(key), { i, dup: texts.get(key), text: s.text });
  texts.set(key, i);
  // the statement must not announce its own answer
  check('text does not contain the words true/false', !/\b(true|false)\b/i.test(s.text), { i, text: s.text });
  // a false statement's fix should differ from the statement (otherwise the "fix" confirms it)
  if (!s.isTrue) check('false statement: fix differs from text', s.fix.trim().toLowerCase() !== key, { i, s });
});
// per-topic: every statement in a topic has a single, fixed flag (consistency across draws is
// guaranteed by reference identity, but we also verify the same text never carries two flags)
const flagByText = new Map();
STATEMENTS.forEach(s => { const k = s.text.trim().toLowerCase(); if (flagByText.has(k) && flagByText.get(k) !== s.isTrue) results.faults.push({ check: 'same text with two flags', text: s.text }); flagByText.set(k, s.isTrue); });
const topics = new Set(STATEMENTS.map(s => s.topic));
check('enough topics for a full round', topics.size >= SETTINGS.roundsPerGame, { topics: topics.size });
const nTrue = STATEMENTS.filter(s => s.isTrue).length, nFalse = n - nTrue;
console.log(`true=${nTrue} false=${nFalse}; topics with a true statement=${new Set(STATEMENTS.filter(s => s.isTrue).map(s => s.topic)).size}, with a false one=${new Set(STATEMENTS.filter(s => !s.isTrue).map(s => s.topic)).size}`);
// bonus question
const b = SETTINGS.bonus;
check('bonus: exactly one choice matches answer', b.choices.filter(c => c.id === b.answer).length === 1, b);
check('bonus: choice ids unique', new Set(b.choices.map(c => c.id)).size === b.choices.length, b);
check('bonus: question does not contain the answer name', !b.question.toLowerCase().includes(b.answer.toLowerCase()), b);

// --- draws
const nRound = Math.min(SETTINGS.roundsPerGame, n);
const trueTarget = Math.round(nRound * 0.55), falseTarget = nRound - trueTarget;
const seen = new Map();   // statement index -> {true,false} flags observed across draws
const appear = new Array(n).fill(0);
const trueCounts = {};
for (let d = 0; d < DRAWS; d++) {
  const r = pickRound();
  check('draw: exactly roundsPerGame statements', r.length === nRound, { d, len: r.length });
  check('draw: 10 distinct statements', new Set(r).size === r.length, { d, texts: r.map(s => s.text) });
  check('draw: 10 distinct texts', new Set(r.map(s => s.text)).size === r.length, { d });
  check('draw: no two statements share a topic', new Set(r.map(s => s.topic)).size === r.length, { d, topics: r.map(s => s.topic) });
  const t = r.filter(s => s.isTrue).length;
  trueCounts[t] = (trueCounts[t] || 0) + 1;
  check(`draw: true/false split is ${trueTarget}/${falseTarget}`, t === trueTarget, { d, t });
  check('draw: every statement is from the pool', r.every(s => STATEMENTS.includes(s)), { d });
  r.forEach(s => {
    const i = STATEMENTS.indexOf(s); appear[i]++;
    const f = seen.get(i) || new Set(); f.add(s.isTrue); seen.set(i, f);
    check('draw: isTrue flag identical to the pool entry', s.isTrue === STATEMENTS[i].isTrue, { d, i });
  });
}
for (const [i, f] of seen) check('statement keeps one flag across all draws', f.size === 1, { i, text: STATEMENTS[i].text });
const never = STATEMENTS.map((s, i) => [s, appear[i]]).filter(([, a]) => a === 0).map(([s]) => s.text);
console.log(`true-count distribution over ${DRAWS} draws:`, trueCounts);
console.log(`statements never drawn in ${DRAWS} draws: ${never.length}${never.length ? ' -> ' + JSON.stringify(never) : ''}`);
console.log('appearance min/max:', Math.min(...appear), Math.max(...appear));

// --- summary
let pass = 0, fail = 0;
for (const [k, v] of Object.entries(results.checks)) { pass += v.pass; fail += v.fail; console.log(`${v.fail ? 'FAIL' : 'ok  '} ${k}: ${v.pass} passed, ${v.fail} failed`); }
console.log(`TOTAL checks: ${pass} passed, ${fail} failed`);
if (results.faults.length) console.log('FAULT EXAMPLES:', JSON.stringify(results.faults, null, 1));
fs.writeFileSync(__dirname + '/beaker_catch_results.json', JSON.stringify({ draws: DRAWS, statements: n, checks: results.checks, faults: results.faults, trueCounts, neverDrawn: never }, null, 1));
