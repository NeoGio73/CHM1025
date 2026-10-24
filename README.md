# CHM 1025: Introduction to Chemistry

Games and activities for a college-level introductory chemistry course. Everything runs in a web browser, with nothing to install and no account to create.

## Activities

| Topic | Activity | Type |
| --- | --- | --- |
| Scale, metric prefixes, and scientific notation | [Smaller Than Small](https://neogio73.github.io/CHM1025/smaller-than-small/) | Game (3D, WebGL) |

## Smaller Than Small

A 3D game about the size of things. You play Ångström, a scientist in a shrinking suit, guided by BOHR, the suit's lab assistant. Each trip on a shrink pad makes you 1000 times smaller, from a chemistry lab down to the sodium and chloride ions of a single grain of salt.

The game is being built one level at a time. Level 1 is playable now.

| World | Your height | Checkpoint |
| --- | --- | --- |
| The Lab | 1.85 m | Dividing by 1000 |
| Millimeter World | 1.85 mm | Millimeters to meters in scientific notation |
| Micrometer World | 1.85 µm | Micrometers to nanometers |
| Nanometer World | 1.85 nm | Picometers to nanometers, then a typed calculation |

- **Move** with <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or the arrow keys, hold <kbd>Shift</kbd> to walk, and press <kbd>Space</kbd> to jump. Hold the right mouse button and drag to look around, and scroll to zoom.
- **Use** a terminal or shrink pad with <kbd>E</kbd>. <kbd>Space</kbd> or a click moves BOHR's dialogue along.
- **Wrong answers** give a hint, then a worked example with different numbers. Typed answers are accepted within 2%.
- **Nothing is recorded.** The mission report at the end shows how many checkpoints were right on the first try.

The game needs a computer with a browser that supports WebGL 2, which covers current versions of Chrome, Edge, Firefox, and Safari. The first load downloads about 40 MB.

## For instructors

The repository is published with GitHub Pages from the `main` branch, so every file is served at `https://neogio73.github.io/CHM1025/` followed by its path.

Smaller Than Small is a finished build of a Unity project that is kept outside this repository. Its folder is replaced as a whole when the game changes, so edits made to its files here would be lost. To run a copy on your own computer, serve the folder with a web server, for example `python -m http.server 8000`, then open `http://localhost:8000/smaller-than-small/`.

## Credits

- The hero is the [Sci Fi Space Soldier](https://assetstore.unity.com/packages/3d/characters/humanoids/sci-fi/sci-fi-space-soldier-polygonr-66384) model by PolygonR from the Unity Asset Store, recolored. Its animations are from [Mixamo](https://www.mixamo.com/).
