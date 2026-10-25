# CHM 1025: Introduction to Chemistry

Games and activities for a college-level introductory chemistry course. Everything runs in a web browser, with nothing to install and no account to create.

## Activities

| Topic | Activity | Type |
| --- | --- | --- |
| Scale, metric prefixes, scientific notation, atoms, ions, isotopes, and atomic mass | [Smaller Than Small](https://neogio73.github.io/CHM1025/smaller-than-small/) | Game (3D, WebGL) |
| Bonding, shapes, polarity, and intermolecular forces (Ch. 10) | [Escape from Lewis Manor](https://neogio73.github.io/CHM1025/lewis-manor/) | Game (Halloween) |
| Course policies in the syllabus | [Beaker Catch](https://neogio73.github.io/CHM1025/beaker-catch/) | Game (first week, ungraded) |
| Key terms from Chapters 1–12 and 14 | [Robo-Lab](https://neogio73.github.io/CHM1025/robo-lab/) | Game (vocabulary review, ungraded) |

## Smaller Than Small

A 3D game about the size of things. You play Ångström, a scientist in a shrinking suit, guided by BOHR, the suit's lab assistant. Each trip on a shrink pad makes you 1000 times smaller, from a chemistry lab down to the sodium and chloride ions of a single grain of salt.

The game is being built one level at a time. Levels 1 to 3 are playable now; finishing each level leads straight into the next.

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

- **Move** with <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or the arrow keys, hold <kbd>Shift</kbd> to walk, and press <kbd>Space</kbd> to jump. Hold the right mouse button and drag to look around, and scroll to zoom.
- **Use** a terminal, pad, or the Atom Forge console with <kbd>E</kbd>. <kbd>Space</kbd> or a click moves BOHR's dialogue along. In the Atom Forge, hold a **+** or **-** button to change a count quickly, and press **Lock in** or <kbd>Enter</kbd>.
- **Wrong answers** give a hint, then a worked example with different numbers. Typed answers are accepted within 2%, except atomic masses, which must be within 0.02 amu.
- **Sound** is on by default. Press <kbd>M</kbd> to mute or unmute.
- **Nothing is sent anywhere.** The mission report at the end of each level shows how many checkpoints were right on the first try. The browser remembers which levels are finished, so students can stop and come back later on the same computer and browser.
- **Extra credit.** After the last level, a student who has finished every level types their D2L username and gets a completion code (like `STS-XXXX-XXXX`) that only matches that username. They submit the username and code in D2L.

The game needs a computer with a browser that supports WebGL 2, which covers current versions of Chrome, Edge, Firefox, and Safari. The first load downloads about 50 MB.

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

## Robo-Lab

A vocabulary review game in the style of early-1980s maze shooters. A clue appears at the top of the screen, and robots wander the maze carrying key terms. Zap the robot whose term matches the clue to unlock the doors, then move on to the next room. The terms are the Key Terms of Chapters 1–12 and 14 of Timberlake, *Basic Chemistry*, 6th edition (243 terms), and students choose which chapters to play.

- **Move** with the arrow keys or <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> and fire with <kbd>Space</kbd>, in the direction you face. On a phone, an on-screen stick and fire button appear at the first touch.
- **Each room starts paused** so students can read the clue and scan the robots' terms; moving, firing, or tapping starts it. The menu can turn this off.
- **Wrong answers** make the robot say what its own term means, and it gets angry. After three misses the right robot glows. Missed terms come back a few rooms later.
- **The walls are electrified**, and waiting too long brings the Free Radical, which cannot be shot. When it appears the doors unlock so students can escape.
- **Five lives**, plus a bonus life every 5,000 points. The end screen lists every term the student missed, with its clue and textbook section, to review.
- **Nothing is recorded.** It is a practice tool.

The clues are written for this game in plain language, not quoted from the textbook.

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

Robo-Lab is two files: [`robo-lab/index.html`](robo-lab/index.html), the game, with its art and sound made in code, and [`robo-lab/terms.js`](robo-lab/terms.js), the term bank. The term bank is generated from source files kept outside this repository, so the folder is replaced as a whole when the terms change. The game loads two fonts from Google Fonts and opens straight from the file with a double-click.

Smaller Than Small is a finished build of a Unity project that is kept outside this repository. Its folder is replaced as a whole when the game changes, so edits made to its files here would be lost. To run a copy on your own computer, serve the folder with a web server, for example `python -m http.server 8000`, then open `http://localhost:8000/smaller-than-small/`.

## Credits

- Sound effects are from Kenney's [Interface Sounds](https://opengameart.org/content/interface-sounds) and [Sci-Fi Sounds](https://opengameart.org/content/sci-fi-sounds) (CC0, www.kenney.nl).
- Particle effects are from Unity Technologies' [Particle Pack](https://assetstore.unity.com/packages/vfx/particles/particle-pack-starter-assets-127325) on the Unity Asset Store.
- The hero is the [Sci Fi Space Soldier](https://assetstore.unity.com/packages/3d/characters/humanoids/sci-fi/sci-fi-space-soldier-polygonr-66384) model by PolygonR from the Unity Asset Store, recolored. Its animations are from [Mixamo](https://www.mixamo.com/).
