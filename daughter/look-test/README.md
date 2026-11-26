# Daughter: look test (build step 1)

One corridor with the flashlight, fog, the blue glow, Geiger counter audio and the four quality tiers. It exists so the look can be approved before any stations are built. There is no gameplay.

## Run it

```
cd daughter/look-test
npm install
npm run dev
```

Then open http://localhost:5178/. Click **Click to enter** (this starts the audio and captures the mouse).

| URL | What it does |
|---|---|
| `/` | Auto: starts at High (WebGPU) or Medium (WebGL 2), measures for a few seconds, then moves up or down one tier |
| `/?tier=ultra` (or `high`, `medium`, `low`) | Starts on that tier |
| `/?webgl` | Forces the WebGL 2 backend (can be combined: `/?webgl&tier=low`) |

## Keys

WASD move · mouse look · F flashlight · 1–4 tier (Ultra, High, Medium, Low) · 0 auto · [ ] FOV · L lens distortion on/off · M reduced motion (no sway, grain or chromatic aberration) · H hide help · Esc release the mouse (the tier buttons can then be clicked).

## What each tier does

| | Ultra | High | Medium | Low |
|---|---|---|---|---|
| Materials | PBR + normal maps | PBR + normal maps | PBR, no normal maps | Lambert + baked light |
| Flashlight | shadow 2048 | shadow 1024 | shadow 512 | no shadow |
| Volumetrics | raymarched, 16 steps, full res | raymarched, 10 steps, half res | beam cone + glow hazes + fog | glow hazes + fog |
| AO / GI | SSGI | GTAO | none | baked |
| Reflections | SSR | SSR (half res) | none | none |
| AA | TRAA | TRAA | FXAA | none |
| Post | bloom, grade, lens, CA, grain, vignette | same | bloom (half res), grade, lens, vignette | grade, lens, vignette; nearest-neighbour upscale |
| Render scale | 1.0 | 1.0 | 0.85 | 0.6 |

Low's lighting is baked on the CPU at load (vertex lighting with shadows and short-range AO). It stands in for the Blender bake planned for the art pass.

## Pinned versions

three.js 0.187.0 (r187), Vite 8.3.8.

## Assets

None. Every texture and sound is generated in code, so there is nothing to credit yet (see `../CREDITS.md`).
