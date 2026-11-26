# Daughter: credits and licenses

Every third-party model, texture, sound or font used in Daughter is listed here with its source and license.

## Code

| Item | Source | License |
|---|---|---|
| three.js r187 | https://threejs.org | MIT |
| Vite (build tool, not shipped) | https://vite.dev | MIT |

## Assets

The look test (`look-test/`) and the graybox game (`game/`) contain no model, texture, image or sound files.

| Kind | What is used | Source | License |
|---|---|---|---|
| Models | Rooms, doors, terminals, lockers, lamps, the source and the control rods | Built from three.js boxes, cylinders and planes in `game/src/level.js` | Original to this project |
| Textures | Concrete, paint, doors, signs, flashlight cookie, fog noise | Drawn in code in `src/textures.js` | Original to this project |
| Sounds | Geiger clicks, room tone, lamp buzz, footsteps, switch, terminal chime, evacuation rumble | Synthesized with the Web Audio API in `src/audio.js` | Original to this project |
| Fonts | Georgia, Times New Roman, the browser's serif | The player's own system fonts; none is downloaded or shipped | Not redistributed |
| Symbol | Radiation trefoil | Drawn in code | Public safety symbol |

The reference clips and the Pearson slides used while designing the game are kept out of the repository (see `.gitignore`) and are not part of the game.

The completion-code function in `game/src/code.js` is copied from this repo's Lewis Manor game.
