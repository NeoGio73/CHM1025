# Generator checks

Scripts that exercise the randomized question generators of the HTML games thousands of times and grade the games' own answers against independently typed chemistry tables. They are what the paper's "Randomized questions, and how they were checked" paragraph refers to.

Requirements: Node 18+ and Playwright with Chromium (`npm i playwright` then `npx playwright install chromium`). Run from this folder.

| Script | Game | What it does | Run |
| --- | --- | --- | --- |
| `lewis_manor_qa.js` | Escape from Lewis Manor | Serves a copy of the page with its trial builders exposed, instantiates every registered trial N times in headless Chromium, clicks every wrong option (must be rejected) and the independently recomputed right one (must be accepted) | `node lewis_manor_qa.js 10000` (about 2.5 min) |
| `beaker_catch_qa.js` | Beaker Catch | Extracts the statement pool and the round picker from the page and runs them in Node | `node beaker_catch_qa.js 20000` |
| `periodic_panic_qa.js` | Periodic Panic | Loads the page in headless Chromium and drives the target and distractor pickers of each stage; needs the repository served at `http://localhost:8765/` (for example `python3 -m http.server 8765` in the repository root), or set `PP_URL`; `lewis_manor_qa.js` needs the same server, or `LM_URL` | `node periodic_panic_qa.js 20000 2000` |

Each script prints every check with its pass/fail count and writes `*_results.json` beside itself. `check_tables.md` is the list of checks from the run of October 28, 2026 (Lewis Manor 10,000 draws per trial; Beaker Catch 20,000 rounds; Periodic Panic 20,000 rounds per stage at all chapters plus 2,000 per stage per chapter). That run found two faults in Lewis Manor, both fixed in commit 0084992: the Tower's "What holds them together?" trial could lose one force class or show four clumps instead of five, and the melting-race pair Br2/PBr3 was right for boiling point but wrong for melting point (replaced by Cl2/PCl3). The reference tables are typed into the scripts, not read from the games; if the course changes a value, change it in both places.
