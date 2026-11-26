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

## Models

| Used for | Asset | Source | Author | License | Files |
|---|---|---|---|---|---|
| The donkey | Donkey (rigged and animated) | https://poly.pizza/m/qmX6nhnvp7 | Quaternius | CC0 1.0 | `game/public/models/donkey.glb` |

Donkey: imported into Blender 5.2 on 2026-11-26, scaled to 1.9 m long, given matte materials, and exported as glTF. Only the Idle, Idle_Headlow, Walk and Eating animations were kept; the attack and death animations were removed (handoff section 2: no harm to any animal).

## Made in code (no license needed)

Room geometry, desks and chairs, tube light fixtures, the water surface and ripples, and the pool caustics are generated in `game/src/`. So are the placeholder wall phones, goat and exit door (`props.js`), the door plates and bay numbers, and the hum and phone ring (`audio.js`, synthesized; no sound files).
