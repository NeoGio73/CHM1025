# Accurate 3D Periodic Table — Project Plan (revised)

Handoff spec for Claude Code. Inspired by https://sael.net/periodic-table/, but built to be scientifically accurate, especially wherever electrons are shown. Every number on screen has a source. Anything predicted, approximate, or model-dependent is visibly marked.

Revision 2 (2026-10-30). Changes from the first draft are listed in "Revision notes" at the end.

## Decisions
1. **Platform:** three.js web page on GitHub Pages for the table, atom view, spectra and data, plus a Unity WebGL scene for the flame-test bench, connected by two-way messaging (see Stage 4).
2. **Primary audience:** CHM 1025, Introductory Chemistry at Daytona State College (textbook: Timberlake, *Basic Chemistry*, 6th ed.; delivered on D2L). See "Audience defaults."
3. **Repo and hosting:** the `periodic-table/` folder of the CHM1025 repo, served at `https://neogio73.github.io/CHM1025/periodic-table/`.

## Audience defaults (CHM 1025)
- **Terminology:** match Timberlake's (e.g., "energy level," "sublevel," "orbital," "valence electrons," "atomic size"). Check terms against the textbook's usage where possible.
- **Periodic trends:** the course covers **atomic size only (of atoms and ions)**, not ionization energy, electronegativity, or metallic character.
  - Default table property: atomic size (see "Default atomic size set" in Stage 1).
  - Other properties (ionization energy, electronegativity, melting point, density) sit behind an "Explore more" control, not shown by default.
- **Atomic weights:** show the conventional value Timberlake uses (e.g., C 12.011). The IUPAC interval (e.g., [12.0096, 12.0116]) appears under "More detail."
- **Atom view default ("Basic"):**
  - Point cloud plus the 90% boundary surface, with energy level / sublevel / orbital labels.
  - Electron configuration shown in Timberlake style, including the orbital-diagram (boxes and arrows) form and the noble-gas abbreviation.
  - An **energy-level diagram** (levels as horizontal lines, electrons as arrows; no orbits) to bridge to the textbook's 2-8-8 shell pictures.
  - Atom-to-ion size comparison front and center (Na vs. Na⁺, Cl vs. Cl⁻).
- **"More detail" toggle (off by default):**
  - Radial probability plot.
  - Term symbols.
  - Relativistic effects.
  - Real vs. complex orbital sets.
  - Atomic-weight intervals.
  - Measured-vs-model caveats beyond one short line.
- **Reading level:** short plain-language explanations, no calculus on screen, units always shown.
- **Flame tests and spectra:** connect to the course's coverage of light, energy levels and electrons moving between levels.

## Ground rules
- **Sourced values.** Each value carries a `source` field. Clicking a value in the UI shows its source.
- **Measured vs. predicted.** Data is tagged `measured`, `recommended`, `computed`, or `predicted`. Predicted and theory-only values render differently (glass or dashed style) with a legend.
- **No silent distortion.** Any scale compression or color gamut mapping is announced on screen.
- **No physics-free animation of electrons.** Never show electrons orbiting, or "where the electron is right now."
- **Label every model choice.** Wherever the display depends on a convention (90% surface, real orbital set, open-shell averaging, nucleus packing), the label says so.
- **Heavy computation offline.** Wavefunction calculations, CIE integration and crystal processing run offline in Python. The browser loads small precomputed per-element files, lazily. Light work, such as sampling points from a tabulated radial function, may run in the browser (see Stage 2).
- **Licensing.** Only commit data whose terms allow redistribution in a public MIT-licensed repo. Each data file records its source and license in `pipeline/SOURCES.md`; where terms forbid bulk redistribution, ship only the values actually used and cite them, or leave the property out.
- **Accessibility.** Daytona State is a public institution under the DOJ's ADA Title II rule (WCAG 2.1 AA, in force since April 2026). Every 3D view has a text or table equivalent, everything works by keyboard, and color scales are color-blind safe with a non-color cue (height, pattern, or label).

## Citation format
- Each source has an entry in `site/data/sources.json` with: id, full citation, DOI or URL, the table/page used, license, and retrieval date.
- Each value points to a source id. The UI shows a short form ("NIST ASD, 2026") that opens the full entry.
- Computed values cite the method and the published work they were validated against. Predicted values cite the theory paper.

## Verification (how we confirm values are right)
1. **Scripted extraction.** Values are pulled from downloaded source files by script, never typed. Raw files are kept in `pipeline/raw/` with a SHA-256 hash and download date, so every value traces to a line in a raw file and the whole build can be rerun.
2. **Transcribed tables** (sources available only as PDF tables) are the exception: they are entered once, then checked value by value against an independent second source; every mismatch is listed for review.
3. **Cross-check.** Every property is compared with an independent second source (e.g., PubChem). Differences beyond a set tolerance go to a review list in `pipeline/out/crosscheck.md`; they are never silently accepted. Where trusted sources disagree, the UI says so.
4. **Science checks.** Electron count = Z, sensible ranges and units, and periodic trends hold except for a listed set of known exceptions; an unlisted exception fails the build.
5. **Independent spot-check.** After each stage, a separate reviewer opens the cited source for a random sample of values and confirms the number, units and location. Flame entries are checked 100%.
6. **Textbook check.** A comparison sheet of the site's values beside Timberlake's, for the instructor to review.
7. **After launch.** A "Report a problem" link on each value; fixes are logged in a changelog.

## Architecture
```
periodic-table/
  pipeline/        Python, run once, outputs to site/data
    SOURCES.md     every data source, citation, license, retrieval date
    orbitals/      PySCF atomic HF/X2C runs, radial tables, validation
    properties/    property table builder with per-value sources
    spectra/       NIST line lists, CIE color computation
    flame/         flame-test emitter data and colors
    crystals/      CIF → atom positions for the sample box
    tests/         validation tests (see "Validation")
  site/            three.js app (static, GitHub Pages)
    data/          generated JSON + per-element radial tables
    src/           views: table, atom, spectrum, flame, sample
  unity/           flame-bench Unity project (build output copied to site/flame/)
```

## Stage 1 — Data pipeline and sourced property table
- **Sources:**
  - Ionization energies: NIST Atomic Spectra Database (check NIST Standard Reference Data terms before committing bulk tables; NIST SRD carries a Commerce Department copyright notice).
  - Atomic weights: IUPAC/CIAAW, conventional value plus interval.
  - Melting point, boiling point and density: **not** copied from the CRC Handbook (copyrighted compilation). Use an openly licensed source (e.g., PubChem's element data, keeping the original citation it gives) or leave the property out. These are "Explore more" only, so a gap is acceptable.
  - Electronegativity: Pauling by default, Allen as an alternative (Explore more only).
  - Radii, one consistent set per type, with the type always named:
    - Covalent: Cordero et al. 2008 (Z = 1–96).
    - van der Waals: Alvarez 2013.
    - Metallic: source to be chosen and cited; until then, not offered.
    - **Ionic: Shannon 1976 (crystal ionic radii), with coordination number stated.** Required for the atom-vs-ion comparison.
  - Ground-state configurations and term symbols: NIST, including the exceptions (Cr, Cu, Nb, Mo, Ru, Rh, Pd, Ag, Pt, Au, La, Ce, Gd, Th, Pa, U, Np, Cm, Lr, and the rest of the f block). Superheavy configurations tagged `predicted`.
- **Default atomic size set:** Cordero covalent radii, because one set covers H through Cm, noble gases included. Before building, check Timberlake's atomic-size figure and note in the UI if its values come from a different set. Elements 97–118 show the gap marker.
- **3D table view:** column height = the selected property, plus a gap marker where no value exists (e.g., electronegativity of He). An equivalent sortable HTML data table is always available.
- **Done when:** every value has a source, status and license, the table renders for all 118 elements, and the table view passes keyboard and screen-reader checks.

## Stage 2 — Atom view, real orbitals, H–Xe (the heart of the project)
- **Wavefunctions (decided after the feasibility check, 2026-10-30):** the Roothaan–Hartree–Fock orbitals of Bunge, Barrientos & Bunge, *At. Data Nucl. Data Tables* 53, 113–162 (1993), evaluated directly from the authors' own data file (RHF.TABLES, mirrored at https://server.ccl.net/cca/data/atomic-RHF-wavefunctions/tables). It gives Slater-type exponents and coefficients for every occupied orbital of the neutral ground-state atoms He–Xe. Hydrogen uses the exact analytic solution. No quantum-chemistry program is needed for neutral atoms H–Xe.
  - **Why not PySCF:** PySCF has no Windows package on PyPI; conda-forge has one only for Python 3.11, which needs micromamba (not installed). Using the published functions directly is simpler and is the reference itself.
  - **Feasibility result:** for all 53 atoms, orbitals recomputed from the coefficients reproduce the expectation values printed in the same file: normalization within 3×10⁻⁶, ⟨r⟩ within 1.5×10⁻⁵ (relative), ⟨1/r⟩ within 3×10⁻⁶, ⟨1/r²⟩ within 6×10⁻⁵, ⟨r²⟩ within 3×10⁻⁴ (rounding of the printed value), orthogonality within 2×10⁻⁶. The file's RHOat0 equals 2π × the density at the nucleus (agrees within 1%).
  - **Known artifact:** because the coefficients are printed to 6 decimals, 160 orbitals change sign again far out in the tail. At most 3.3×10⁻⁶ of the orbital's probability lies beyond such a point, so it is invisible; the pipeline counts nodes only inside the radius holding 99.999% of the probability and cuts the tail there.
  - **Open-shell atoms:** Bunge's functions are for the ground term (e.g., C ³P), with one radial function per sublevel; the angular part and the per-orbital occupation follow the display rule below.
  - Range: **H–Xe (Z = 1–54)**.
  - Still to cross-check: ⟨r⟩ against Clementi–Roetti 1974 (an independent calculation) within 1%.
- **What ships:** each occupied orbital's radial function R(r) on a log grid (a few KB per element), plus occupations. The browser samples |ψ|² = R(r)²·|Y(θ,φ)|² with a fixed random seed, which keeps clouds identical for all students and lets phones use fewer points.
- **Radial nodes:** must be visible (2s ≠ small 1s, 3p ≠ big 2p).
- **Open-shell atoms (decided rule):** the calculation is spherically averaged, so a partly filled sublevel (e.g., C 2p²) has fractional occupation spread over its orbitals. The **total density** view shows that honestly. The **single-orbital** view shows each orbital's shape and says how many electrons the orbital diagram puts in it (e.g., "2p_x: 1 electron in the orbital diagram; the calculation spreads 2 electrons evenly over the three 2p orbitals"). This text is under "More detail"; the Basic view shows the orbital diagram next to the shapes.
- **Three linked views:**
  1. Point cloud: a probability map, labeled as such.
  2. 90% boundary surface: the density contour enclosing 90% of the probability, labeled as a convention.
  3. Radial probability plot r²R²(r) showing penetration (2s vs 2p, 4s vs 3d). "More detail" only.
- **"Measure" mode:** each click places one detected position **sampled from the total electron density** (the observable), so the cloud builds up statistically. The label says that a measurement finds "an electron," not a particular orbital's electron.
- **"Total density" toggle:** shows the sum of all orbitals becoming nearly spherical, with a caveat that individual orbitals are a model and only total density is observable.
- **Orbital sets:** real (p_x, p_y, p_z) orbitals by default. For f orbitals, state which set is shown (cubic or general).
- **Scale:**
  - True-scale toggle: nucleus at its real radius, ≈1.2·A^(1/3) fm (about 1/100,000 of the atom; the UI says it is too small to see).
  - Labeled log or compressed mode so inner shells stay visible.
  - Show 100 pm reference rings.
- **Nucleus:** protons plus neutrons of the most abundant isotope, labeled "packing is a model."
- **Ions:**
  - Computed electron clouds only for ions that are stable as free gas-phase ions: cations (Na⁺, Mg²⁺, Al³⁺, K⁺, Ca²⁺, …) and the singly charged anions H⁻, F⁻, Cl⁻, Br⁻, I⁻.
  - **Source (decided 2026-10-30):** Koga, Kanayama, Watanabe & Thakkar, Int. J. Quantum Chem. 71, 491 (1999): Hartree–Fock orbitals for He–Xe, Li⁺–Cs⁺ and H⁻–I⁻, taken from the files packaged by theochem/AtomDB (pinned commit; GPL repository used as a data source only, not redistributed). Checked: the kinetic energy recomputed from every file's orbitals matches the printed value (all 198 files, within 3×10⁻⁷), and Koga's neutral atoms agree with Bunge 1993 (⟨r⟩ within 6×10⁻⁶, energies within 10⁻⁶ hartree), which is also the independent cross-check of the Bunge data. PySCF is not needed.
  - **Built:** H⁻, Li⁺, F⁻, Na⁺, Cl⁻, shown side by side with their atoms (`atom.html?Z=11&compare=1`). The build fails if any cation is not smaller, or any anion not larger, than its atom.
  - **Not available:** 2+ and 3+ ions (Be²⁺, Mg²⁺, Al³⁺): not in Koga's set; the page says so and gives Shannon's crystal radius. O²⁻, N³⁻, S²⁻, P³⁻: not bound as free ions; the page says so and gives the crystal radius.
  - **O²⁻, N³⁻, S²⁻ and other multiply charged anions are not bound as free ions**, so no wavefunction cloud is drawn for them. Their size appears as a Shannon crystal ionic radius sphere, labeled "size in a crystal; this ion does not exist on its own."
  - The atom-vs-ion comparison states which radius is shown: computed free-ion density for the cloud, Shannon radius for the number.
- **Done when:** H–Xe atoms and the listed ions render from validated wavefunctions, validation tests pass, and every model choice above is labeled.
- **Status (2026-10-30): Stage 2a built for H–Ar** (`site/atom.html`, data from `pipeline/orbitals/build_orbitals.py`):
  - Point cloud (seeded, so every student sees the same picture), 90% surface, 100 pm rings, axes, nucleus marked as enlarged, Timberlake-style configuration, electrons per energy level, Hund's-rule orbital diagram whose boxes select orbitals.
  - 90% surfaces: s orbitals drawn as exact concentric spheres from precomputed radii; p orbitals by marching cubes, one grid per region between radial nodes; isovalues computed with the angular part integrated exactly (hydrogen 1s within 5×10⁻⁵ of the exact value).
  - Whole-atom view: the sphere holding 90% of the **outer (valence) electrons**, not of all electrons (the all-electron sphere is dominated by the core and puts Na below Li). The outer-electron radius follows the size trend for all of H–Ar (checked in `out/orbitals.md`).
  - Independent review: data, sampling (KS test), axis mapping and marching-cubes mapping all reproduced; its fixes (whole-atom sphere, node artifacts, wording) are applied.
  - **Ion clouds added** (see Ions): Li⁺, Na⁺, H⁻, F⁻, Cl⁻ side by side with their atoms.
  - **Still to do (2b):** K–Xe (d orbitals; Bunge and Koga both cover them), K⁺/Br⁻ etc. with those atoms, radial plot, Measure mode, total-density toggle, true-scale nucleus.

## Stage 3 — Extend to all elements (Z = 55–118)
- **Method:** PySCF with scalar-relativistic X2C, spherically averaged, for the clouds and radial plots. Desclaux 1973 is used **only** to check ⟨r⟩ and orbital energies, since it lists expectation values, not full wavefunctions, and can't produce clouds.
- **Relativistic effects to show:** 6s contraction (Au, Hg), side by side with a non-relativistic run of the same atom.
- **Spin–orbit (p₁/₂ / p₃/₂) splitting:** needs a two-component (spinor) calculation, not scalar X2C. Advanced toggle, optional; build only if time allows.
- **Superheavy elements:** configurations and orbitals flagged as theory-only (`predicted`) and drawn in the predicted style.
- **Done when:** all 118 elements render, relativistic elements are labeled as such, and Z = 55–86 pass the Desclaux comparison.

## Stage 4 — Emission spectra and flame tests
### Spectra
- **Lines:** NIST Atomic Spectra Database lines with relative intensities. Neutral (I) and ionized (II) stages kept separate.
- **Intensity caveat:** NIST relative intensities come from different sources and conditions and are not strictly comparable. Discharge-tube colors computed from them carry a visible note. Where a measured discharge-tube spectrum with a usable license exists, prefer it.
- **Color:** computed with the CIE 1931 2° color-matching functions from intensity-weighted lines, then converted to sRGB. Spectral-line colors are often outside the screen's range (gamut), so the pipeline uses one documented gamut-mapping method (desaturate toward the white point at constant hue), and the UI says "closest color this screen can show."
- **Absorption toggle:** dark lines on a continuum, linked to stellar spectroscopy.
- **Course link:** hydrogen's Balmer lines tie directly to electrons dropping between energy levels.

### Flame tests (new; not on the original site)

**Approach: Unity scene connected to the three.js site (two-way messaging)**
- **Build:** the flame-test bench is a separate Unity WebGL build in `site/flame/`.
- **GitHub Pages hosting:** Pages does not send `Content-Encoding` headers for Unity's `.br`/`.gz` files. Build with **Decompression Fallback** enabled (or uncompressed). Target a build under ~15 MB and test on a phone; if mobile fails, the flame view must degrade to the three.js spectrum strip plus a still image.
- **Embedding:** loaded lazily in a frame/overlay only when a student opens it, so the table stays fast.
- **Two-way messaging:**
  - three.js → Unity: the selected element (e.g., opening from strontium loads the strontium chloride loop).
  - Unity → three.js: close/return, so the student lands back on the same element.
  - Uses browser `postMessage` plus a Unity `.jslib` plugin and `SendMessage`.
- **Single source of truth:** flame data lives in `site/data/flame.json`, read by both the three.js spectrum strip and the Unity scene. Neither side hard-codes colors or wavelengths.

**No invented data (strict rule)**
- Every flame entry cites a published source for the emitter species, wavelengths or bands, and observed color.
- **Molecular bands are not in NIST.** Sources for CaOH, SrOH, SrCl, BaOH, BaCl, CuCl, CuOH bands: flame and pyrotechnic spectroscopy literature (e.g., Gaydon, *The Spectroscopy of Flames*; E.-C. Koch's reviews of molecular emitters in pyrotechnics), preferably open-access measured flame spectra. Expect several elements to end up "No data available" until a source is found.
- **"No data available":** if no source is found, the UI shows exactly that. The Unity scene shows the loop but no colored flame, plus that message. Never guess, interpolate, or borrow a neighboring element's color.
- **Two distinct states:**
  - "No characteristic flame color": only when a source documents that the element gives no distinctive color.
  - "No data available": when no source was found.
- **Computed vs. observed color (decided rule):** each entry stores both the CIE-computed color and the cited observed color name. The flame is drawn with the computed color. If the two disagree, the UI says so and explains why. Example: potassium's main lines (766.5/769.9 nm) are at the edge of human vision, so a line-only calculation looks deep red, while the observed lilac includes violet lines (404.4/404.7 nm) and a continuum. If a measured flame spectrum is available, compute the color from that instead of from lines alone.
- **Status tags:** each entry carries `source`, `status` (measured / literature-reported / no data) and `license`.

**Starting emitter table (unverified; verify every row before use, drop or mark any row that can't be verified)**

| Element | Flame color | Emitter |
|---|---|---|
| Na | yellow | atomic 589.0/589.6 nm doublet |
| Li | crimson | atomic 670.8 nm |
| K | lilac | atomic 766.5/769.9 nm (near-IR) + 404.4/404.7 nm, plus continuum |
| Ca | orange-red | CaOH bands, plus atomic 422.7 nm |
| Sr | red | SrOH / SrCl bands |
| Ba | green | BaOH / BaCl bands |
| Cu | green or blue | CuOH (green) / CuCl (blue) bands; salt-dependent |

- **Other emitters:** add Rb, Cs, In, Tl, B and others as sources allow.
- **Setup:** wire loop with the chloride salt, flame, and the resulting spectrum strip.
- **Boltzmann note:** at ~2000 K only low-lying states are populated, which is why flame spectra are simpler than discharge tubes.
- **Lab realism:** sodium contamination masking potassium, and cobalt-blue glass filtering out Na.
- **Done when:** the flame and spectrum agree with the published emitter data, every color is computed via CIE with the gamut mapping announced, and computed/observed mismatches are explained on screen.

## Stage 5 — Sample box
- **Real molecular forms:** H₂, N₂, O₂, F₂, Cl₂, Br₂ (liquid at room temp), I₂ (solid), P₄ (white) and red P, S₈, and carbon as graphite or diamond.
- **Crystal structures:** from the Crystallography Open Database (CC0 CIF files), including complex cells (α-Mn's 58-atom cell). No simplified stand-ins.
- **Temperature-dependent phases:** e.g., Fe α → γ → δ, then liquid. Phase boundaries come from cited data.
- **Motion (first version):** atoms vibrate about lattice sites with amplitudes from published mean-square displacement (Debye–Waller) data where available; gas molecules move with Maxwell–Boltzmann speeds for the element's mass. State plainly that melting is not emergent. Full molecular dynamics is a later, optional upgrade.
- **Thermal glow:** incandescence of hot samples via blackbody color (CIE, same gamut mapping as Stage 4).

## Stage 6 — Demos (optional, last)
- Alkali metals in water, a neon sign, liquid O₂ held by a magnet, decay chains (IAEA nuclide data, real order, compressed times announced). Same ground rules apply: no physics-free motion.

## Validation (automated, in `pipeline/tests/`)
- Every orbital is normalized: ∫r²R²dr = 1 to within 10⁻⁵ (the file's coefficients are rounded to 6 decimals).
- Orbitals evaluated from the Bunge 1993 coefficients reproduce the ⟨r⟩, ⟨1/r⟩ and ⟨1/r²⟩ printed in the same file to within 10⁻⁴ (relative); orthogonality within 10⁻⁵.
- Orbital ⟨r⟩ matches Clementi–Roetti 1974 to within 1% (H–Xe) and Desclaux 1973 to within 2% (Cs–Rn).
- Number of radial nodes = n − l − 1 for every orbital.
- CIE pipeline: the Na D doublet lands at its known chromaticity (x ≈ 0.575, y ≈ 0.424, within 0.002); the blackbody routine matches the Planckian locus at 2000 K and 6500 K.
- Every value in `site/data` has `source`, `status` and `license`; the build fails otherwise.
- `flame.json` schema check, and a test that the Unity build reads the same file (no embedded copies).

## Accuracy checklist (for review at each stage)
- [ ] Every displayed value has a source, status and license tag.
- [ ] No orbiting or "current position" electrons anywhere.
- [ ] Radial nodes present; validation tests pass.
- [ ] Every scale compression and gamut mapping is announced on screen.
- [ ] Predicted and theory-only values are visually distinct.
- [ ] No wavefunction cloud for ions that aren't bound as free ions.
- [ ] Flame colors come from the correct emitter (atomic vs. molecular).
- [ ] Every flame entry is sourced; anything unsourced shows "No data available."
- [ ] Computed vs. observed flame color mismatches are explained.
- [ ] Unity and three.js read the same flame.json and show identical data.
- [ ] All colors are computed with CIE 1931, never hand-picked.
- [ ] WCAG 2.1 AA: text/table alternatives, keyboard access, color-blind-safe scales.

## Performance targets
- Per-element data lazily loaded; total download for the first atom view under ~2 MB (radial tables make this easy).
- Smooth on a typical student laptop; usable on a phone (fewer sampled points).
- Unity flame bench loaded only on demand, target under ~15 MB, with a non-Unity fallback.

## Revision notes (changes from the first draft)
1. Repo decided: `CHM1025/periodic-table/`.
2. O²⁻, N³⁻ and other multiply charged anions: no wavefunction clouds (not bound as free ions); shown with Shannon crystal radii instead.
3. Desclaux tables used only for validation; Stage 3 clouds come from PySCF X2C. Spin–orbit splitting needs a spinor calculation.
4. Rule for CIE-computed vs. observed flame colors, and announced gamut mapping.
5. CRC Handbook dropped as a bulk source; licensing tracked per file; NIST SRD terms to be checked.
6. Molecular flame-band sources named (NIST doesn't cover them).
7. NIST relative-intensity caveat for discharge-tube colors.
8. Shannon ionic radii added; Cordero covalent radii chosen as the default atomic size set.
9. Stage 2 range widened to H–Xe; orbitals computed with PySCF and validated against Bunge and Clementi–Roetti instead of hand-transcribed.
10. Open-shell display rule decided.
11. Measure mode samples the total density.
12. Ship radial functions and sample in the browser instead of shipping point clouds.
13. Unity on GitHub Pages: Decompression Fallback, size target, non-Unity fallback.
14. Accessibility (WCAG 2.1 AA, ADA Title II) added as a ground rule.
15. Stage 5 motion simplified to data-driven vibration and Maxwell–Boltzmann speeds; full MD optional.
16. Conventional atomic weights by default, energy-level diagram, nucleus "packing is a model" label, automated validation tests.
