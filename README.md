# CHM 1025: Introduction to Chemistry

Games and activities for a college-level introductory chemistry course. Everything runs in a web browser, with nothing to install and no account to create.

## Activities

| Topic | Activity | Type |
| --- | --- | --- |
| Scale, metric prefixes, scientific notation, atoms, ions, isotopes, atomic mass, light, energy levels, and electron configurations | [Smaller Than Small](https://neogio73.github.io/CHM1025/smaller-than-small/) | Game (3D, WebGL) |
| Bonding, shapes, polarity, and intermolecular forces (Ch. 10) | [Escape from Lewis Manor](https://neogio73.github.io/CHM1025/lewis-manor/) | Game (Halloween) |
| Course policies in the syllabus | [Beaker Catch](https://neogio73.github.io/CHM1025/beaker-catch/) | Game (first week, ungraded) |
| Key terms from Chapters 1–12 and 14 | [Periodic Panic](https://neogio73.github.io/CHM1025/periodic-panic/) | Game (vocabulary review, ungraded; six arcade games in one) |
| Key terms from Chapters 1–12 and 14 | [Robo-Lab](https://neogio73.github.io/CHM1025/robo-lab/) | Opens Periodic Panic at stage 1 (the old link still works) |
| Key terms from Chapters 1–12 and 14 | [Mole Hole](https://neogio73.github.io/CHM1025/mole-hole/) | Opens Periodic Panic at stage 2 (the old link still works) |
| Acids and bases (Ch. 14) | [Spring to Sea](https://neogio73.github.io/CHM1025/spring-to-sea/) | Game (3D, WebGL) — in progress |

## Smaller Than Small

A 3D game about the size of things. You play Ångström, a scientist in a shrinking suit, guided by BOHR, the suit's lab assistant. Each trip on a shrink pad makes you 1000 times smaller, from a chemistry lab down to the sodium and chloride ions of a single grain of salt.

The game has five levels; finishing each level leads straight into the next.

**Level 1: Scale Drop**

| World | Your height | Checkpoint |
| --- | --- | --- |
| The Lab | 1.85 m | Dividing by 1000 |
| Millimeter World | 1.85 mm | Millimeters to meters in scientific notation |
| Micrometer World | 1.85 µm | Micrometers to nanometers |
| Nanometer World | 1.85 nm | Picometers to nanometers, then a typed calculation |

**Level 2: Atom Forge** (1.85 pm). Inside an atom, you build atoms and ions on a 3D display by adding protons, neutrons, and electrons. A scanner names the element from the number of protons.

| Build | What it practices |
| --- | --- |
| <sup>4</sup>He and <sup>12</sup>C | Atomic number, mass number, neutral atoms |
| <sup>23</sup>Na<sup>+</sup> and <sup>35</sup>Cl<sup>-</sup> | Ions with a 1+ or 1- charge |
| <sup>24</sup>Mg<sup>2+</sup> | A 2+ ion |
| <sup>56</sup>Fe<sup>3+</sup> (boss) | Putting it all together |

Four multiple-choice checkpoints sit between the builds: what a new proton does, mass number, what changes when an atom becomes an ion, and finding a charge. A wrong build gets a hint for the count that is off, then a worked example with a different ion.

**Level 3: Isotope Vault** (1.85 pm). Isotopes are written as full atomic symbols, with the mass number at the upper left and the atomic number at the lower left.

| Part | What it practices |
| --- | --- |
| Build hydrogen-1, hydrogen-2, and oxygen-18 | Isotopes: same number of protons, different numbers of neutrons |
| Checkpoints on iodine-131 and calcium isotopes | Counting neutrons and recognizing isotopes from atomic symbols |
| Isotope sorter (a model of a mass spectrometer) | Percent abundance, using samples of gallium and rubidium |
| Gallium, step by step, then rubidium (boss) | Typed atomic mass as a weighted average, in amu |

Atomic-mass answers must be within 0.02 amu, because a 2% margin would also accept wrong methods, such as averaging the two isotope masses. Isotope masses and abundances come from the NIST [Atomic Weights and Isotopic Compositions](https://www.nist.gov/pml/atomic-weights-and-isotopic-compositions-relative-atomic-masses) tables, rounded to two decimal places.

**Level 4: Light & Energy Levels** (sections 5.1 and 5.2, concepts only: no E = hν or c = λν calculations).

| Zone | Your height | What it practices |
| --- | --- | --- |
| Wave Deck | 185 nm | Wavelength measured in your own heights, frequency from crests counted at a gate, photons, the electromagnetic spectrum, then a typed calculation |
| Energy Ladder (inside a hydrogen atom) | 1.85 pm | Energy levels, ground and excited states; moving the electron between levels makes hydrogen's red, blue-green, and violet lines |
| Flame Bench (back in the lab) | 1.85 m | Flame colors of sodium (yellow), strontium (red), and copper (green, an extension), then a boss that matches mystery spectra to hydrogen, helium, or sodium |

Line wavelengths come from the NIST [Atomic Spectra Database](https://physics.nist.gov/asd); the flame colors of strontium and copper follow Baldwin et al., *J. Chem. Educ.* **2010**, *87*, 790–792.

**Level 5: Electron Shells** (sections 5.3 to 5.6, and the octet from 6.1; stops at calcium, with 4s filling before 3d).

| Part | Your height | What it practices |
| --- | --- | --- |
| Shell Hall | 1.85 pm | Energy levels, sublevels (s, p, d, f), orbitals and their shapes, and how many electrons each holds, then a typed calculation |
| Orbital Builder | 1.85 pm | Orbital diagrams and electron configurations for oxygen, sodium, phosphorus, potassium, and calcium (boss), including abbreviated forms such as [Ne] 3s<sup>1</sup> |
| Periodic table wall (back in the lab) | 1.85 m | s and p blocks, valence electrons, Lewis symbols, and the octet: why sodium and chlorine form Na<sup>+</sup> and Cl<sup>−</sup>; boss: identify a mystery element and its ion |

Ground-state electron configurations were checked against the NIST [Atomic Spectra Database](https://physics.nist.gov/asd).

- **Move** with <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or the arrow keys, hold <kbd>Shift</kbd> to walk, and press <kbd>Space</kbd> to jump. Hold the right mouse button and drag to look around, and scroll to zoom.
- **Use** a terminal, pad, or the Atom Forge console with <kbd>E</kbd>. <kbd>Space</kbd> or a click moves BOHR's dialogue along. In the Atom Forge, hold a **+** or **-** button to change a count quickly, and press **Lock in** or <kbd>Enter</kbd>. On the energy ladder, click a level to move the electron there; at the flame bench, click each sample. In the Orbital Builder, click a box to add an electron (a second click pairs it, a third empties it), then press **Lock in**.
- **Wrong answers** give a hint, then a worked example with different numbers. Typed answers are accepted within 2%, except atomic masses, which must be within 0.02 amu.
- **Sound** is on by default. Press <kbd>M</kbd> to mute or unmute.
- **Nothing is sent anywhere.** The mission report at the end of each level shows how many checkpoints were right on the first try. The browser remembers which levels are finished, so students can stop and come back later on the same computer and browser.
- **Extra credit.** After Level 5, a student who has finished all five levels types their D2L username and gets a completion code (like `STS-XXXX-XXXX`) that only matches that username. They submit the username and code in D2L. If a level is missing, the screen lists it instead.

The game needs a computer with a browser that supports WebGL 2, which covers current versions of Chrome, Edge, Firefox, and Safari. The first load downloads about 31 MB.

## Escape from Lewis Manor

A Halloween escape-room game for Chapter 10, Bonding and Properties of Solids and Liquids (Timberlake, *Basic Chemistry*, 6th edition). You play a chemistry student locked in a haunted manor at night. Walk the hall with the arrow keys (or the on-screen buttons on a phone), and enter a room with the up arrow. Each room's puzzles break one of the seven wax seals on the front door.

| Room | Section | Topic | Points |
| --- | --- | --- | --- |
| I. The Foyer | 10.1 | Lewis symbols and bonding patterns | ½ |
| II. The Crypt | 10.1 | Lewis structures of molecules, polyatomic ions, and ionic compounds | ½ |
| III. The Phantom Gallery | 10.2 | Resonance structures | ½ |
| IV. The Topiary Garden | 10.3 | Shapes of molecules (VSEPR), up to four electron groups | ½ |
| V. The Séance Parlor | 10.4 | Electronegativity and bond polarity | ½ |
| VI. The Hall of Mirrors | 10.5 | Polarity of molecules | ½ |
| VII. The Tower | 10.6 | Intermolecular forces | 1 |

The game follows the book's values and wording: the electronegativities of Figure 10.2, the bond-type ranges of Table 10.7 (0.0–0.4 nonpolar covalent, 0.5–1.8 polar covalent, 1.9–3.3 ionic), and the shapes and 180°, 120°, and 109° angles of Table 10.6.

Each room has three candles. A wrong answer blows one out with a hint, and losing all three restarts the room with new questions. The questions change every time. Your browser remembers which seals you have broken, so you can stop and come back with Continue.

Breaking all seven seals ends with a Certificate of Escape: your name, the date, each room's points out of 4, and a verification code. Download it and upload it to the Lewis Manor assignment in D2L. If you stop early, the Certificate button in the corner gives a Record of Progress for the seals you have broken.

**Instructors:** the "Instructor: check a certificate code" link on the title screen confirms a code. Type the student's name exactly as printed and the code; a valid code shows the score and the date it was issued. An edited certificate will not match.

The game has sound, so turn it on. It contains mild, cartoon-style jump scares. A version for General Chemistry I, built on a different chapter, is in the CHM1045 repository; the two keep separate progress.

## Beaker Catch

A short game for the first week that sends students to the syllabus. True and false statements about course policies fall from the top of the screen. Catch the true ones in the beaker and let the false ones splash on the bench. Each game draws 10 statements from a pool of 38, so it changes every time.

- **Move** the beaker by dragging, or with the <kbd>←</kbd> <kbd>→</kbd> keys. It works on phones and computers.
- **Wrong answers** show what the syllabus says and which section to read. The end screen lists them again.
- **Eight or more right** turns the beaker pink, like a titration reaching its endpoint.
- **Bonus round:** a molecule is hidden in the syllabus posted in D2L, and students pick it from four look-alikes.
- **Nothing is recorded.** It is just for fun.

## Periodic Panic

The vocabulary review games in one arcade game, using the Key Terms of Chapters 1–12 and 14 of Timberlake, *Basic Chemistry*, 6th edition, except those from sections this course does not cover (204 terms). Each stage is a different early-1980s style game, described in the sections below. The stages build on each other: the first five work on single terms (recognizing what a term means, and in Shield Spell spelling it exactly), and the last, Zip Sort, ties them together by asking which terms belong together.

- **Arcade mode** plays the stages in order: Robo-Lab, Mole Hole, Jungle Jump, Shield Spell, Isotope, then the finale, Zip Sort. Four correct answers warp the player to the next stage, keeping the score, lives, and list of missed terms. Clearing all six stages (24 correct answers) brings a finale screen, "You beat Periodic Panic!", with the score and the run's review list; students can stop there or keep going, and the stages loop back, a little faster each time, for a high score.
- **Free play** lets students pick one game from a row of cartridges and practice it as long as they like.
- Students choose the chapters, each stage opens with a screen of instructions that stays up until they press a key or tap, every round starts paused so they can read the clue, and the end screen lists every term they missed across the whole run, with its clue and textbook section.
- **Sound** comes from emulations of the sound chips each game's era used (an early-80s arcade board for Robo-Lab, the ColecoVision's SN76489 for Mole Hole, Isotope, and Zip Sort, the Atari 2600's TIA for Jungle Jump and Shield Spell). No recordings are used, and every sound effect and tune is original.
- **Phones and tablets:** in portrait the clue sits in a readable strip above the game; a touch stick and fire button appear at the first touch, beside or below the play field, along with pause, sound, and menu buttons (leaving for the menu takes two taps).
- **Nothing is recorded.** It is a practice tool.

### Robo-Lab (stage 1)

In the style of early-1980s maze shooters. A clue appears at the top of the screen, and robots wander the maze carrying key terms. Zap the robot whose term matches the clue to unlock the doors, then move on to the next room.

- **Move** with the arrow keys or <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> and fire with <kbd>Space</kbd>, in the direction you face. On a phone, an on-screen stick and fire button appear at the first touch.
- **Wrong answers** make the robot say what its own term means, and it gets angry. After three misses the right robot glows. Missed terms come back a few rooms later.
- **The walls are electrified**, and waiting too long brings the Free Radical, which cannot be shot. When it appears the doors unlock so students can escape.

### Mole Hole (stage 2)

In the style of early-1980s digging games. You play a mole in goggles. A clue appears at the top of the screen, and four crystals labeled with terms are buried in the dirt. Tunnel to the crystal whose term matches the clue to clear the field and get a new one.

- **Dig** with the arrow keys or <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>. On a phone, an on-screen stick and throw button appear at the first touch.
- **Wrong crystals** shatter, show what their term means, and let out another grime blob. After two misses the right crystal glows. Missed terms come back a few fields later.
- **Grime blobs** chase the mole through its tunnels, and now and then one turns into a digger that burrows straight through the dirt. Dig under a boulder to drop it on them, or press <kbd>Space</kbd> to throw the catalyst, which bounces through the tunnels and recharges after a hit. Boulders can flatten the mole too.
- **Electrons** in the dirt are worth points, with a bonus for collecting them all. A tune plays only while the mole is moving; the menu can turn it off.

### Jungle Jump (stage 3)

A jungle runner in the style of early-1980s home console games, so far only in Periodic Panic. Three metal ingots labeled with terms lie around the screen; grab the one whose term matches the clue, and the bushes on the right open onto the next screen.

- **Run** with the arrow keys or <kbd>A</kbd> <kbd>D</kbd>, and **jump** with <kbd>Space</kbd> or the up arrow.
- Each screen has one hazard in the middle: a swamp crossed on a swinging vine (jump to grab it, <kbd>Space</kbd> to let go), crocodile heads to hop across while their mouths are shut, or a tar pit that opens and closes. Falling in costs a life.
- Rolling logs knock the explorer back and cost 50 points.
- A wrong ingot crumbles and shows what its term means; after two misses the right one glows.

### Shield Spell (stage 4)

The spelling stage, in the style of early-1980s home console shooters. A reactor core hides behind a shield of blocks, some of them carrying letters. Fly a little bug into the letters of the term **in order**, as a spelling bar under the clue fills in; then a cannon appears on the left edge, and firing it at the core finishes the round.

- **Move** with the arrow keys or <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>; the bug flies and faces in all 8 directions (hold two arrows for a diagonal), and the screen wraps from top to bottom. <kbd>Space</kbd> shoots the way the bug faces, clearing blank blocks to reach letters deeper in the shield, and fires the cannon once the word is spelled.
- A wrong letter flashes and gives a hint ("The next letter isn't A"); after three, the next correct letter glows. Spaces and hyphens fill in by themselves.
- A slow homing missile chases the bug, except inside the shimmering zone in the middle of the screen. From level 2, the core sometimes spins up and lunges at the bug.
- Only terms that make sense to spell are used here (153 of the 204; those with subscripts or symbols, such as H<sub>3</sub>O<sup>+</sup>, and very long names appear in the other stages).

### Isotope (stage 5)

A fortress flyer in the style of early-1980s isometric arcade games, seen from a slanted 3D view. Each force-field wall has three openings at different heights, each in its own colour; a legend under the clue shows which term goes with which colour. Fly through the opening whose term matches the clue.

- **Steer** with the left and right arrows (or <kbd>A</kbd> <kbd>D</kbd>), **climb and dive** with up and down (or <kbd>W</kbd> <kbd>S</kbd>), and **fire** with <kbd>Space</kbd>. The ship's shadow and the altitude meter on the left show its height; the meter also marks the height of each opening in its colour.
- A wrong opening zaps the ship, shows what that term means, and the wall is rebuilt ahead with one fewer choice; after two misses the right opening glows. Hitting the solid wall, an electric barrier, or a turret's shot costs a life.
- Fuel runs down while flying. Diving low to shoot the orange fuel tanks refills it, and so does a correct gate.

### Zip Sort (stage 6, the finale)

The finale, in the style of early-1980s box-zipping maze games, and the stage that ties the others together. Stages 1–5 ask what single terms mean; Zip Sort asks **which terms belong together**. The clue names a category, such as "a gas law", "a type of chemical reaction", or "an intermolecular force", and students zip shut every box whose term fits it, while avoiding tricky lookalikes (Henry's law among the gas laws, hydrogen bond among the chemical bonds). Sorting the vocabulary into groups, often across chapters, turns a list of definitions into connected concepts, so the last stage reviews how everything in the earlier stages fits together.

- **Move** a zipper pull along the lines of the maze with the arrow keys or <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>. Tracing all four sides of a box zips it shut.
- A box that fits the category turns green, and a counter shows how many are left; a box that does not turns red and shows what its term means. After two wrong boxes, the remaining right ones glow.
- Roaming eyes chase the zipper pull. Closing the pitchfork box lets it chase them for a few seconds.
- There are 19 categories, built only from the Key Terms already in the game (a category is used only when at least three of its terms are in the course). A missed category appears on the end screen with all of its members.

## Spring to Sea (in progress)

A 3D paddleboarding game for Chapter 14, Acids and Bases (Timberlake, *Basic Chemistry*, 6th edition). You paddle Florida water from a clear spring, down a tannin-stained blackwater river, across a seagrass lagoon, through an inlet, and out to a coral reef — with the dog Alastair riding the nose of the board. He is happy at the spring, hides from the acid rain, and at the reef he sits with his back to the ocean, because he hates it. Each zone has a stop with questions from the chapter, and the numbers change every play.

| Zone | Sections | Chemistry |
| --- | --- | --- |
| The spring | 14.1 | litmus, properties of acids and bases, names and formulas, CO2 making carbonic acid |
| The river | 14.3, 14.7, 14.8 | strong and weak acids, acid rain, neutralization, titrating a river sample |
| The seagrass lagoon | 14.2 | proton donors and acceptors, conjugate acid-base pairs, bicarbonate acting both ways |
| The reef | 14.6 | pH and [H3O+], the tenfold rule, ocean acidification |

- **Paddle** with <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>. Hold <kbd>C</kbd> to dip the camera under the surface, and hold <kbd>E</kbd> to anchor the board and snorkel (<kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> swims, the mouse looks, <kbd>Space</kbd> rises).
- **Answer questions** with <kbd>Q</kbd> at a stop. **Scoop a sample** with <kbd>R</kbd>: predict acid, base, or neutral first, then the meter shows the reading. **Take photos** with <kbd>P</kbd>; they appear in the trip summary.
- **Ask Alastair** for one hint per question; a question answered with his help earns half points.
- **Nothing is sent anywhere.** The trip summary at the end shows the score and a completion code (like `SEA-XXXX`) to enter in D2L.

The game is being built; this is an early test build. It needs a browser that supports WebGL 2, and the first load downloads about 31 MB.

## For instructors

The repository is published with GitHub Pages from the `main` branch, so every file is served at `https://neogio73.github.io/CHM1025/` followed by its path.

Completion codes are checked with a private checker page kept by the instructor; it is not part of this repository.

To check a later part without replaying from the start, add `?zone=1`, `?zone=2`, or `?zone=3` to the address to start Level 1 in a later world, or `?level=2` or `?level=3` to start at Level 2 or 3. For example, [`smaller-than-small/?level=3`](https://neogio73.github.io/CHM1025/smaller-than-small/?level=3) opens the Isotope Vault.

Escape from Lewis Manor is a single file, [`lewis-manor/index.html`](lewis-manor/index.html), with its art and sound made in code; it loads three fonts from Google Fonts and opens straight from the file with a double-click.

Beaker Catch is a single file, [`beaker-catch/index.html`](beaker-catch/index.html). The statements and settings are in a block at the top of the file: where students find the syllabus (`syllabusNote`), an optional direct link to it (`syllabusUrl`), the number of statements per game, and the bonus round. The bonus answer is caffeine, drawn small at the bottom of the Falcon Online Forgiveness section of the syllabus. If the syllabus in D2L doesn't have the drawing, set `bonus.enabled` to `false`. To show it in a D2L announcement, add this in the HTML editor:

```html
<iframe src="https://neogio73.github.io/CHM1025/beaker-catch/" width="100%" height="560" style="border:0;max-width:720px" title="Beaker Catch"></iframe>
<p><a href="https://neogio73.github.io/CHM1025/beaker-catch/" target="_blank">Play Beaker Catch</a></p>
```

The plain link is for students who read the announcement by email or in the Pulse app, where the game may not show.

Periodic Panic is in [`periodic-panic/`](periodic-panic/index.html): `index.html`, the shared `engine.js` (sound, controls, clue bar, scoring, menus), one file per stage in `stages/` (their order in `index.html` is the order of arcade mode), and the same generated `terms.js` as the stand-alone games. Like them, it is built outside this repository and replaced as a whole, and it opens straight from the file with a double-click.

Robo-Lab and Mole Hole began as separate games and are now stages 1 and 2 of Periodic Panic. Their old folders, [`robo-lab/`](robo-lab/index.html) and [`mole-hole/`](mole-hole/index.html), each hold one small page that forwards to Periodic Panic at that stage, so links already posted in D2L keep working. Any stage can be linked the same way by adding `?stage=` and its name to the Periodic Panic address: `robo-lab`, `mole-hole`, `jungle-jump`, `shield-spell`, `isotope`, or `zip-sort` (for example [`periodic-panic/?stage=isotope`](https://neogio73.github.io/CHM1025/periodic-panic/?stage=isotope)). The link opens that stage in free play with the chapters the student last chose.

Smaller Than Small is a finished build of a Unity project that is kept outside this repository. Its folder is replaced as a whole when the game changes, so edits made to its files here would be lost. To run a copy on your own computer, serve the folder with a web server, for example `python -m http.server 8000`, then open `http://localhost:8000/smaller-than-small/`.

Spring to Sea, in [`spring-to-sea/`](spring-to-sea/), is built the same way: a Unity WebGL build from a project kept outside this repository, replaced as a whole when the game changes. Its completion codes are checked with the instructor's private checker, like the others.

## Credits

- Sound effects are from Kenney's [Interface Sounds](https://opengameart.org/content/interface-sounds) and [Sci-Fi Sounds](https://opengameart.org/content/sci-fi-sounds) (CC0, www.kenney.nl).
- Particle effects are from Unity Technologies' [Particle Pack](https://assetstore.unity.com/packages/vfx/particles/particle-pack-starter-assets-127325) on the Unity Asset Store.
- The hero is the [Sci Fi Space Soldier](https://assetstore.unity.com/packages/3d/characters/humanoids/sci-fi/sci-fi-space-soldier-polygonr-66384) model by PolygonR from the Unity Asset Store, recolored. Its animations are from [Mixamo](https://www.mixamo.com/).
- In Spring to Sea, the paddleboard is "Colorfull sup board with fin" by Ernest Szarek ([BlendKit](https://blendkit.art/), royalty free); the paddler and the base paddling motion are from [Mixamo](https://www.mixamo.com/); the water, river, and grass rendering use [Stylized Water 3](https://assetstore.unity.com/packages/vfx/shaders/stylized-water-3-287769) and the [Stylized Grass Shader](https://assetstore.unity.com/packages/vfx/shaders/stylized-grass-shader-143830) by Staggart Creations from the Unity Asset Store. The wildlife and bank vegetation come from [Poly Pizza](https://poly.pizza/): ["Oak Tree"](https://poly.pizza/m/56cDueZB7TR) by Esdras Paravizo (CC-BY 3.0), ["Manatee"](https://poly.pizza/m/7nDfJjW0Csq) and ["Dolphin"](https://poly.pizza/m/1y2iPj1CFg7) by Poly by Google (CC-BY 3.0), and public-domain (CC0) trees, bushes, fish, and shark by Quaternius and Kenney. Alastair is a real dog.
- Periodic Panic embeds two fonts in its page so it loads nothing from outside: [VT323](https://fonts.google.com/specimen/VT323) by Peter Hull and [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) by CodeMan38, both under the [SIL Open Font License 1.1](https://openfontlicense.org/), which permits embedding. Its art, music, and sound effects are made in code.
