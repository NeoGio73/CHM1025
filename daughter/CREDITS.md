# Daughter: credits and licenses

Every third-party model, texture, sound or font used in Daughter is listed here with its source and license.

## Code

| Item | Source | License |
|---|---|---|
| three.js r187 | https://threejs.org | MIT |
| Vite (build tool, not shipped) | https://vite.dev | MIT |

## Assets

The look test (`look-test/`) contains no model, texture, image or sound files. The game's graybox rooms are built in code as listed below; rooms that have had the art pass are listed after the table.

| Kind | What is used | Source | License |
|---|---|---|---|
| Models | Rooms, doors, terminals, lockers, lamps, the source and the control rods | Built from three.js boxes, cylinders and planes in `game/src/level.js` | Original to this project |
| Textures | Concrete, paint, doors, signs, flashlight cookie, fog noise | Drawn in code in `src/textures.js` | Original to this project |
| Sounds | Geiger clicks, room tone, lamp buzz, footsteps, switch, terminal chime, evacuation rumble, chair creak | Synthesized with the Web Audio API in `src/audio.js` | Original to this project |
| Fonts | Georgia, Times New Roman, the browser's serif | The player's own system fonts; none is downloaded or shipped | Not redistributed |
| Symbol | Radiation trefoil | Drawn in code | Public safety symbol |

### Room art (`game/public/models/*.glb`)

Rooms are modelled in Blender, all in one source file, `art/facility.blend`, which is kept out of the repository because of its size. All six areas are done: the entry hall and vestibule (`hall.glb`), the records vault (`vault.glb`), the corridor and monitoring station (`monitor.glb`), the anteroom and hot corridor (`hot.glb`), the infirmary (`infirmary.glb`), and the corridor, control room and core room (`control.glb`). The textures inside the `.glb` are the 1k versions, converted to WebP.

| Kind | Asset | Author | Source | License |
|---|---|---|---|---|
| Texture | Concrete Wall 004 (walls) | Charlotte Baglioni, Dario Barresi | https://polyhaven.com/a/concrete_wall_004 | CC0 |
| Texture | Concrete Wall 008 (ceilings) | Charlotte Baglioni, Dario Barresi | https://polyhaven.com/a/concrete_wall_008 | CC0 |
| Texture | Floor Tiles 06 (floors) | Rob Tuytel | https://polyhaven.com/a/floor_tiles_06 | CC0 |
| Texture | Blue Metal Plate (lockers, doors, console) | Rob Tuytel | https://polyhaven.com/a/blue_metal_plate | CC0 |
| Texture | Smooth Concrete Floor (records vault floor) | Dimitrios Savva | https://polyhaven.com/a/smooth_concrete_floor | CC0 |
| Texture | Old Linoleum Flooring 01 (infirmary floor, tinted) | Charlotte Baglioni | https://polyhaven.com/a/old_linoleum_flooring_01 | CC0 |
| Model | Painted Wooden Bench (vestibule) | Kirill Sannikov | https://polyhaven.com/a/painted_wooden_bench | CC0 |
| Model | Power Box 01 (vestibule breaker box, door posed open) | Rico Cilliers, Yann Kervran | https://polyhaven.com/a/power_box_01 | CC0 |
| Model | Fire Alarm (hall wall) | Slinc | https://polyhaven.com/a/fire_alarm | CC0 |
| Model | Rockingchair 01 (the rocking chair, `game/public/models/chair.glb`) | Jorge Camacho | https://polyhaven.com/a/Rockingchair_01 | CC0 |
| Models | Entry hall: walls, trim, door frames, barrier doors, lockers, lead casks, ID chart console, lamps, pipes, cable tray, sealed entrance. Records vault: filing cabinets, side-vault wheel doors, record shelving and boxes, equation-lock consoles, reading table and chair, papers. Monitoring station: equipment bench, survey meter (Geiger counter), pocket dosimeter and film badge, calibration rack and lead source pig, film-badge board, hand-and-foot monitor, desk, shelving. Hot corridor: source-log and clock consoles, corridor clock, interlock door, red beacon, step-off pad, shoe-cover bin, lead-brick source alcove with shield lip, open source container and fallen lid. Infirmary: beds, privacy curtains and rails, patient-chart stands, radiopharmacy cabinet with lead pots and vials, key cabinet, sink, IV stand, stool. Control room: four control desks, instrument walls with dials and chart recorders, rod-position board, shield wall and sealed lead core door, cable trays, chairs, wall clock, core room | Modelled for this project in Blender | `art/facility.blend` | Original to this project |
| Images | Hazard stripes, trefoil plates, ID chart poster, meter dial, dose-chart poster, lead bricks, radiation-boundary stripes, clock face | Drawn for this project with Python in Blender | `art/facility.blend` | Original to this project |

The reference clips and the Pearson slides used while designing the game are kept out of the repository (see `.gitignore`) and are not part of the game.

The completion-code function in `game/src/code.js` is copied from this repo's Lewis Manor game.
