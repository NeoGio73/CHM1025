# Daughter: the game (build step 2, graybox)

All six stations as plain rooms, with working terminals, dose, checkpoints, an ending, the debrief and the completion code. It is playable from start to finish. The look (lighting, fog, glow, post effects and quality tiers) is carried over from the approved look test in `../look-test/`.

## Run it

```
cd daughter/game
npm install
npm run dev
```

Then open http://localhost:5179/.

| URL | What it does |
|---|---|
| `/` | Auto: picks a quality tier, then the title screen |
| `/?tier=ultra` (or `high`, `medium`, `low`) | Starts on that tier |
| `/?webgl` | Forces the WebGL 2 backend |
| `/?fresh` | Ignores the saved game |
| `/?station=4` | **Dev server only.** Starts at station 4 with stations 1 to 3 solved. It does nothing in the published build. |

`npm run build` writes the static site to `dist/` (not committed). The copy served on GitHub Pages is `../play/`. To update it, run `npx vite build --outDir ../play --emptyOutDir`.

## Keys

WASD move · mouse look (or drag with the button held if the mouse is not captured) · E use · F flashlight · Esc pause or close a terminal.

## The route

| Station | Room | What the student does |
|---|---|---|
| 1 · 16.1 | Entry hall | Matches six radiation symbols (Table 16.2), then takes the lightest protection that stops each of three leaking sources (alpha, beta, gamma) to open three barriers |
| 2 · 16.2 | Records vault | Balances four equation locks: alpha, beta and positron (side vaults, random order and nuclides), then gamma or a bombardment reaction (exit) |
| 3 · 16.3 | Monitoring station | Takes the Geiger counter and dosimeter, matches the six units to activity, absorbed dose and biological damage, and does one conversion (1 Gy = 100 rad or 1 Sv = 100 rem). The dosimeter goes live. |
| 4 · 16.4 | Hot corridor | Reads the source log (random isotope from Table 16.7 and P-32), works out how many half-lives bring it down to the posted safe level, and advances the corridor clock. Crossing early costs a large dose. |
| 5 · 16.5 | Infirmary | Picks the radioisotope for three patient charts (Tc-99m, I-131, F-18) from a shelf of six, then answers why short half-lives are used in the body to get the control room key |
| 6 · 16.6 | Control room | Sorts six statements into fission or fusion, completes the U-235 fission equation, lowers the control rods (they absorb neutrons), then completes Pb-210 → Bi-210 → Po-210 → Pb-206 |

Each station is 1 point. Wrong answers cost 2 mSv once the dosimeter is live (station 3 on), never points. At 50 mSv the screen fades to white, "You were evacuated." appears and the player restarts at the last checkpoint.

## Files

| File | What is in it |
|---|---|
| `src/config.js` | Names, scoring, dose limit, code prefix and secret, and `codeRegistered` (true: the secret is in the private checker) |
| `src/questions.js` | All chemistry, with the slide each fact comes from |
| `src/radio.js` | All radio lines (draft), shown as captions |
| `src/stations.js` | Terminal puzzles and checks |
| `src/level.js` | Graybox rooms, doors, terminals, lights, dose sources |
| `src/engine.js` | Renderer, tiers, post-processing (from the look test) |
| `src/code.js` | Completion code, copied unchanged from Lewis Manor |
| `src/main.js` | Player, interaction, dose, checkpoints, saving, title and ending |

## What is not in the graybox yet

The three glimpses, the chair, the shape, recorded radio audio and the art pass (steps 4 and 5). Low uses real-time lights until the Blender bake.

## Pinned versions

three.js 0.187.0 (r187), Vite 8.3.8.
