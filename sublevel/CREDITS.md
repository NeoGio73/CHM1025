# Sublevel: asset credits

Every asset file in `sublevel/` is listed here with its source, author and license. Only CC0 assets are used, because the repository is public and the files can be downloaded directly.

## Textures

Downloaded on 2026-11-26 as 2K JPG sets from ambientCG. ambientCG states that all of its assets are released under CC0 1.0 Universal (https://docs.ambientcg.com/license/). The Color, NormalGL, Roughness and Ambient Occlusion maps were resized and repacked at 2048 px and 1024 px; roughness and ambient occlusion share one file (`*_orm.jpg`: red = ambient occlusion, green = roughness).

| Used for | Asset | Source | Author | License | Files |
|---|---|---|---|---|---|
| Office and hallway carpet | Carpet 012 | https://ambientcg.com/a/Carpet012 | Lennart Demes (ambientCG) | CC0 1.0 | `game/public/textures/*/carpet_*.jpg` |
| Office and hallway walls | Wallpaper 002 A | https://ambientcg.com/a/Wallpaper002A | Lennart Demes (ambientCG) | CC0 1.0 | `game/public/textures/*/wall_*.jpg` |
| Ceilings | Office Ceiling 001 | https://ambientcg.com/a/OfficeCeiling001 | Lennart Demes (ambientCG) | CC0 1.0 | `game/public/textures/*/ceiling_*.jpg` |
| Pool room walls and deck | Tiles 107 | https://ambientcg.com/a/Tiles107 | Lennart Demes (ambientCG) | CC0 1.0 | `game/public/textures/*/tile_*.jpg` |
| Inside of the pool | Tiles 132 A | https://ambientcg.com/a/Tiles132A | Lennart Demes (ambientCG) | CC0 1.0 | `game/public/textures/*/pooltile_*.jpg` |
| Stairs, landings, parking pillars and ceilings | Concrete 034 | https://ambientcg.com/a/Concrete034 | Lennart Demes (ambientCG) | CC0 1.0 | `game/public/textures/*/concrete_*.jpg` |
| Parking floor | Concrete 036 | https://ambientcg.com/a/Concrete036 | Lennart Demes (ambientCG) | CC0 1.0 | `game/public/textures/*/garage_*.jpg` |

Concrete 034 and 036 were downloaded on 2026-11-27, approved by Prof. Picione the same day. These two sets have no ambient occlusion map, so the red channel of `*_orm.jpg` is made from their displacement map (lower spots slightly darker).

## Models

| Used for | Asset | Source | Author | License | Files |
|---|---|---|---|---|---|
| The donkey | Donkey (rigged and animated) | https://poly.pizza/m/qmX6nhnvp7 | Quaternius | CC0 1.0 | `game/public/models/donkey.glb` |
| The goat (made from it) | Deer (rigged and animated) | https://poly.pizza/m/T6Cs7tmMHJ | Quaternius | CC0 1.0 | `game/public/models/goat.glb` |

Donkey: imported into Blender 5.2 on 2026-11-26, scaled to 1.9 m long, given matte materials, and exported as glTF. Only the Idle, Idle_Headlow, Walk and Eating animations were kept; the attack and death animations were removed (handoff section 2: no harm to any animal). On 2026-11-27 its colours were changed to match Prof. Picione's donkey (brown coat, pale muzzle and belly, dark mane), from Prof. Picione's photos.

Goat: the Deer from the same Quaternius pack (the donkey's, so the same rig), downloaded on 2026-11-27 and reshaped in Blender 5.2 by `art/scripts/goat.py` into Prof. Picione's goat, from the farm photos: shorter legs, a deeper and wider body, a shorter neck, ears held out sideways, horns and a beard added, and its colours. Only the Idle, Idle_2, Idle_Headlow, Eating, Walk and Jump_toIdle animations were kept; the attack, hit and death animations were removed (handoff section 2).

## Made for this game (no license needed)

Modelled in Blender 5.2 for Sublevel on 2026-11-27 (source `art/props.blend`, kept out of git), with no outside assets: the wall phone (`game/public/models/phone.glb`), the steel desk and office chair (`desk.glb`), the exit door (`door.glb`), the vending machine (`vending.glb`), the water cooler (`cooler.glb`) and the wet-floor sign (`wetsign.glb`). Their labels (the snack shelves, the "Refreshments" header, the caution face) are drawn in code in `props.js`.

The rooster and the goose (`game/public/models/chicken.glb`, `goose.glb`) were modelled, rigged and animated in Blender 5.2 for Sublevel on 2026-11-27 by a script (`art/scripts/birds.py`, kept out of git), with no outside assets, after Prof. Picione's own Barred Rock rooster and brown Chinese-type goose (from the farm photos). The rooster's barred feathers are a small striped texture made by the same script.

Generated in `game/src/`: room geometry, the stairwell railings, step nosings and floor numbers, the parking bay markings, wheel stops, pillar bands, ceiling pipes and oil stains, the flooded corridor and the attendant's booth, tube light fixtures, the water surface and ripples, the pool caustics, the block goat that stands in while the goat model loads (`props.js`), the shape, its reflection in the pools and its blur on the booth's glass (`glimpses.js`, `world.js`), the door plates and bay numbers, the wrong-way exit signs, and the hum, tube buzz, phone ring, goose honk and the exit door shutting (`audio.js`, synthesized; no sound files).
