# CHM 1025: Introduction to Chemistry

Games and activities for a college-level introductory chemistry course. Everything runs in a web browser, with nothing to install and no account to create.

## Activities

| Topic | Activity | Type |
| --- | --- | --- |
| Scale, metric prefixes, scientific notation, atoms, and ions | [Smaller Than Small](https://neogio73.github.io/CHM1025/smaller-than-small/) | Game (3D, WebGL) |

## Smaller Than Small

A 3D game about the size of things. You play Ångström, a scientist in a shrinking suit, guided by BOHR, the suit's lab assistant. Each trip on a shrink pad makes you 1000 times smaller, from a chemistry lab down to the sodium and chloride ions of a single grain of salt.

The game is being built one level at a time. Levels 1 and 2 are playable now; finishing Level 1 leads straight into Level 2.

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

- **Move** with <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or the arrow keys, hold <kbd>Shift</kbd> to walk, and press <kbd>Space</kbd> to jump. Hold the right mouse button and drag to look around, and scroll to zoom.
- **Use** a terminal, pad, or the Atom Forge console with <kbd>E</kbd>. <kbd>Space</kbd> or a click moves BOHR's dialogue along. In the Atom Forge, hold a **+** or **-** button to change a count quickly, and press **Lock in** or <kbd>Enter</kbd>.
- **Wrong answers** give a hint, then a worked example with different numbers. Typed answers are accepted within 2%.
- **Nothing is recorded.** The mission report at the end of each level shows how many checkpoints were right on the first try.

The game needs a computer with a browser that supports WebGL 2, which covers current versions of Chrome, Edge, Firefox, and Safari. The first load downloads about 45 MB.

## For instructors

The repository is published with GitHub Pages from the `main` branch, so every file is served at `https://neogio73.github.io/CHM1025/` followed by its path.

To check a later part without replaying from the start, add `?zone=1`, `?zone=2`, or `?zone=3` to the address to start Level 1 in a later world, or `?level=2` to start at Level 2. For example, [`smaller-than-small/?level=2`](https://neogio73.github.io/CHM1025/smaller-than-small/?level=2) opens the Atom Forge.

Smaller Than Small is a finished build of a Unity project that is kept outside this repository. Its folder is replaced as a whole when the game changes, so edits made to its files here would be lost. To run a copy on your own computer, serve the folder with a web server, for example `python -m http.server 8000`, then open `http://localhost:8000/smaller-than-small/`.

## Credits

- The hero is the [Sci Fi Space Soldier](https://assetstore.unity.com/packages/3d/characters/humanoids/sci-fi/sci-fi-space-soldier-polygonr-66384) model by PolygonR from the Unity Asset Store, recolored. Its animations are from [Mixamo](https://www.mixamo.com/).
