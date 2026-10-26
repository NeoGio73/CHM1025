// Completion-code tests for Lewis Manor (Step 5 of COMPLETION_CODE_FIXES.md).
// Checks the game's code function against the instructor's checker, which is the reference function.
// The checker is private and is NOT in this repository; point CHECKER_HTML at it:
//   CHECKER_HTML=../SmallerThanSmall/checker.html node lewis-manor/test/completion-code.test.mjs
// (default: ../SmallerThanSmall/checker.html next to this repository).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const checkerPath = path.resolve(process.env.CHECKER_HTML || path.join(repo, '..', 'SmallerThanSmall', 'checker.html'));
const gamePath = path.resolve(process.env.GAME_HTML || path.join(repo, 'lewis-manor', 'index.html'));

let failures = 0, checks = 0;
function ok(cond, msg) { checks++; if (!cond) { failures++; if (failures <= 20) console.error('FAIL: ' + msg); } }

// ---------- the checker (reference) ----------
const checkerHtml = readFileSync(checkerPath, 'utf8');
const checkerJs = checkerHtml.slice(checkerHtml.indexOf('<script>') + 8, checkerHtml.indexOf('// ---------- One student'));
const C = vm.createContext({ TextEncoder, BigInt, Uint8Array, Uint32Array, DataView, Map });
vm.runInContext(checkerJs + '\n;this.api = { SECRET, ALPHABET, normalize, sha256, codeFor, clean, judge };', C);
const chk = C.api;

// The checker's function with fields appended after the username. With no fields it must be the checker's own codeFor.
function checkerCode(prefix, secret, username, fields) {
  const extra = fields && fields.length ? '|' + fields.join('|') : '';
  const h = chk.sha256(new TextEncoder().encode(secret + '|' + chk.normalize(username) + extra));
  let v = 0n;
  for (let i = 0; i < 5; i++) v = (v << 8n) | BigInt(h[i]);
  let s = '';
  for (let i = 0; i < 8; i++) s += chk.ALPHABET[Number((v >> BigInt(35 - 5 * i)) & 31n)];
  return `${prefix}-${s.slice(0, 4)}-${s.slice(4)}`;
}

// ---------- the game ----------
const gameHtml = readFileSync(gamePath, 'utf8').replace(/\r\n/g, '\n');
const start = gameHtml.indexOf('const CODE_PREFIX');
const end = gameHtml.indexOf('\n', gameHtml.indexOf('const cleanCode'));
const vStart = gameHtml.indexOf('function verifyCode(');
const vEnd = gameHtml.indexOf('\n}\n', vStart) + 2;
const dayLine = gameHtml.slice(gameHtml.indexOf('const dayKey'), gameHtml.indexOf('\n', gameHtml.indexOf('const dayKey')));
if (start < 0 || end < 0 || vStart < 0) { console.error('Could not find the code functions in lewis-manor/index.html'); process.exit(2); }
const G = vm.createContext({ TextEncoder, BigInt, Uint8Array, Uint32Array, DataView, Date, String, Number, Math });
vm.runInContext(gameHtml.slice(start, end) + '\n' + dayLine + '\n' + gameHtml.slice(vStart, vEnd) +
  '\n;this.api = { CODE_PREFIX, CODE_SECRET, normalizeUser, completionCode, certCode, verifyCode, dayKey, cleanCode };', G);
const game = G.api;

// ---------- random inputs ----------
let seed = 20261028;
const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
const pick = s => s[Math.floor(rnd() * s.length)];
function randomUser() {
  const letters = 'abcdefghijklmnopqrstuvwxyz', digits = '0123456789';
  const kind = Math.floor(rnd() * 5);
  if (kind === 0) return 'n00' + Array.from({ length: 6 }, () => pick(digits)).join('');            // student number
  let u = Array.from({ length: 3 + Math.floor(rnd() * 8) }, () => pick(letters + digits)).join('');
  if (kind === 1) u = u[0].toUpperCase() + u.slice(1) + '.' + pick(letters) + pick(letters);        // Name.xx
  if (kind === 2) u = '  ' + u.toUpperCase() + ' ';                                                   // spaces and caps
  if (kind === 3) u = u + '@students.example.edu';                                                    // an email
  return u;
}
const randomDay = () => `2026-${String(1 + Math.floor(rnd() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rnd() * 28)).padStart(2, '0')}`;

// 1. The checker's own test vectors, and the appended-fields function equals it with no fields
for (const [u, c] of [['jdoe', 'STS-DLBB-28EH'], ['n00123456', 'STS-UUQE-NY6P'], ['maria.lopez', 'STS-XWWC-RT88']]) {
  ok(chk.codeFor(u) === c, `checker test vector ${u}`);
  ok(checkerCode('STS', chk.SECRET, u, []) === c, `appended-fields function with no fields, ${u}`);
}
ok(game.CODE_PREFIX === 'LM', 'prefix is LM');
ok(game.CODE_SECRET !== chk.SECRET, 'Lewis Manor uses its own secret, not the Smaller Than Small one');

// 2. 2,000 random usernames, scores and dates: the game's code equals the reference, and each changed field fails
const N = 2000;
for (let i = 0; i < N; i++) {
  const u = randomUser(), k = Math.floor(rnd() * 9), day = randomDay();
  const code = game.certCode(u, k / 2, day);
  const ref = checkerCode('LM', game.CODE_SECRET, u, ['LM', k, day]);
  ok(code === ref, `same code as the reference for ${JSON.stringify(u)}, ${k}/8, ${day}: ${code} vs ${ref}`);
  ok(game.normalizeUser(u) === chk.normalize(u), `same username normalization for ${JSON.stringify(u)}`);
  ok(/^LM-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/.test(code), `code format ${code}`);

  let other = randomUser(); while (chk.normalize(other) === chk.normalize(u)) other = randomUser();
  ok(checkerCode('LM', game.CODE_SECRET, other, ['LM', k, day]) !== code, `fails under another username (${u} vs ${other})`);
  const k2 = (k + 1 + Math.floor(rnd() * 8)) % 9;
  ok(checkerCode('LM', game.CODE_SECRET, u, ['LM', k2, day]) !== code, `fails with another score (${k} vs ${k2})`);
  let day2 = randomDay(); while (day2 === day) day2 = randomDay();
  ok(checkerCode('LM', game.CODE_SECRET, u, ['LM', k, day2]) !== code, `fails with another date (${day} vs ${day2})`);
  // another prefix: the same fields under RR, the Smaller Than Small code for this username, and the checker's STS judgment
  ok(checkerCode('RR', game.CODE_SECRET, u, ['RR', k, day]).slice(3) !== code.slice(3), 'fails with prefix RR in the hash');
  ok(chk.codeFor(u).slice(4) !== code.slice(3), 'differs from the STS code for the same username');
  ok(chk.judge(u, 'STS' + code.slice(2)).kind === 'no', 'an LM code with its prefix changed to STS fails the STS check');
}

// 3. The in-game instructor check recovers the score and date, and rejects a changed username or code
const today = new Date();
for (let i = 0; i < 150; i++) {
  const u = randomUser(), k = Math.floor(rnd() * 9);
  const d = new Date(today); d.setDate(today.getDate() - Math.floor(rnd() * 200));
  const day = game.dayKey(d);
  const code = game.certCode(u, k / 2, day);
  const r = game.verifyCode(u, code.toLowerCase().replace(/-/g, ' '));
  ok(r && r.pts === k / 2 && r.day === day, `in-game check recovers ${k / 2} points on ${day} for ${u}`);
  let other = randomUser(); while (chk.normalize(other) === chk.normalize(u)) other = randomUser();
  ok(game.verifyCode(other, code) === null, 'in-game check rejects another username');
  ok(game.verifyCode(u, 'LM-' + 'ABCD-EFGH') === null || code === 'LM-ABCD-EFGH', 'in-game check rejects a made-up code');
}

console.log(`${checks - failures} of ${checks} checks passed (${N} random cases).`);
process.exit(failures ? 1 : 0);
