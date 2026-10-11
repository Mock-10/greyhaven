# 13 — Art and Audio

## The art pack (`/art`)
The art direction is **locked**. Read `art/STYLE_GUIDE.md` before touching anything visual. Summary:
- Isometric 64 × 32 tiles, a person is about 40 px tall, buildings are true scale.
- Grey Weather palette (`art/palette.json`), lifted slightly. **Gold is reserved for valuables and interactables.**
- 1 px self-colored outlines, 4 × 4 Bayer dithering, light from the upper left.
- Pre-rendered sprites with smooth, realistic forms. Nothing blocky or voxel-like. The user explicitly rejected blocky figures and bubble-shaped cars. Cars must read as real cars: a flat-panelled cabin with a flat windshield, pillars and a roof, clearly separate from the hood and the trunk (see `source/cars.py`).

### Contents
| Atlas | What |
|---|---|
| `characters.png/.json` | 6 outfits (office worker, masked thief, road worker, 2 civilians, police) × 8 directions × idle/walk1/walk2 |
| `vehicles.png/.json` | 4 sedan colors, taxi, police car, 2 vans × 8 directions |
| `buildings.png/.json` | Office tower (day and lit-night), corner store, 2 houses, warehouse, 3 containers |
| `props.png/.json` | Trees, pine, bush, planter, lamp, bench, trash can, hydrant, mailbox, dumpster, crate, barrels, traffic light, street sign |
| `interactables.png/.json` | ATM, safe, gold bars, cash stack, loot bag, loot crate, toolbox, filing cabinet, desk, cash register. Each comes as normal / idle0–2 / hover. |
| `tiles.png/.json` | 24 ground tiles: asphalt, wet asphalt, road lanes (edge/centre/dashed for both axes), crosswalks, intersection, manhole, 2 sidewalks, 2 grass, dirt, planks, water, 2 lots |
| `tiles_var.png/.json` | The same 26 ground tiles in all 7 seeded variants (`<kind>/s<seed>`). The game draws ground from this sheet. The reference scenes pick seed `(i·31 + j·17) % 7` per tile. Made by `source/tile_variants.py`. |
| `buildings2.png/.json` | Phase 1 buildings in 4 orientations with `_night` variants: Pellridge Tower and Open Most Hours (named versions), The Low Tide, Marlo's Tow & Salvage, Drizzle Row Residences (`source/pack_phase1.py`) |
| `city.png/.json` | City art for vector-ground maps, packed by `source/pack_city.py` from what the map uses: street props in any of 8 directions, wall, fence, railing, hedge and planting-bed segments in 16 directions, infill buildings with `_night` variants, and ground decals (grass tufts, weeds). Frame keys `<kind>/<name>/<dir>`. |
| `ground.png/.json` | One repeating swatch per vector-ground material (asphalt, paint, sidewalk, kerb, plaza, brick paving, cobbles, terrazzo, concrete, grass with blades, soil, gravel, dirt, lot, grates, iron), from `source/ground_vec.py` |
| `characters_steps.png/.json` | In-between walk poses (`step1` = walk +0.4, `step2` = −0.4) for the 8-frame cycle idle, step1, walk1, step1, idle, step2, walk2, step2 (`source/pack_steps.py`) |
| `scene_*.png` | Reference compositions: overcast day and rainy dusk. **Match these.** |
| `drafts/hud/` | HUD mockups (street and lockpick) and the HUD kit (see 11) |
| `drafts/interiors/` | Interior drafts v2: apartment, 3-room store, office, multi-room bank heist (see 18) |
| `drafts/decor_library.png` | 58 furniture and decoration assets (`source/decor.py`) |

### Atlas format
Each `.json` holds `cell` [w, h] and `frames`. A frame key is `name/variant/direction` (or `name/state`), with its cell rect `x y w h` and an `anchor` [ax, ay], which is the ground point inside the cell.

In Phaser, load the PNG as a spritesheet or add the frames manually, then set each sprite's origin to `anchor / cell size`. Write a small loader (`src/assets/atlasLoader.ts`) that converts this format, rather than editing the files.

### Making new art
New sprites must match the existing ones exactly. Generate them with the same pipeline in `art/source/` (Python, numpy + Pillow):
- `sdf.py`: the renderer (signed-distance models, isometric ray-march, palette quantisation, dithering, outlines, `highlight()` for interactable states, `scaled()`).
- `humans.py`, `cars.py`, `env.py`, `props2.py`: model definitions. Copy an existing model and adapt it.
- `ground2d.py`: ground tiles, including interior floors. `rooms.py`: multi-room cutaway composer, wall decals (paintings, clocks, posters, curtains, tiles, signs) and the four v2 drafts. `decor.py`: furniture and decoration library, where every model's front is local +y and `face()` sets the direction. `interiors.py`: older furniture models still in use. `hud.py` + `pixfont.py`: HUD parts and the pixel font. `cache.py`: rendering plus scale constants. `atlas.py`: packs the atlases. `scene.py`: composes reference scenes.

Signs: `env.sign_text()` draws the 3 × 5 pixel font into a building's material in its local coordinates (one font pixel is about one screen pixel), so names read in every orientation. On a +x face, run the text along −y.

City maps (Phase 1 milestone 1b): `downtown_map.py` authors the map (vector ground shapes, placements, doors, streets) with `citygeo.py` (curves, rounded blocks) and writes `src/maps/downtown.json` plus the drafts in `drafts/downtown/` (`draft_city.py`). `street.py` holds the street props, segments and decals, `infill.py` the infill buildings, `ground_vec.py` the ground materials and rasteriser, `check_city.py` the map checks (overlaps, buildings on roads, the 3 × 3 density rule). After changing the map: `python3 downtown_map.py && python3 check_city.py && python3 pack_city.py`, then commit the JSON, `city.*`, `ground.*` and the drafts.

Workflow for a new asset:
1. Add the model to the right file.
2. Register it in `cache.factories()` with the right scale.
3. Run `atlas.py`.
4. **View the output image** and compare it to the reference scenes.
5. Commit the PNG and JSON.

Never hand-draw placeholder rectangles in the shipped game. If an asset is missing, generate it. During early phases, a clearly temporary debug sprite is allowed, but log it in `docs/16_open_questions.md` under "Art debt".

### Missing art (to make as each phase needs it)
- **Characters:** palette-swap player sprites for the character creator (marker ramps; 4 hair styles), story characters (17), rival crew members, farmer and scrap yard outfits, more civilian variety, clerk, mechanic, lumberjack, delivery uniform, security guard, SWAT, military unit, crew portraits.
- **Vehicles:** small airdrop plane (night flyover sprite plus shadow), tractor, scrap-yard crane, beater, pickup, sports car, armored SUV, log truck, SWAT van, helicopter (with a rotor animation), armored truck.
- **Buildings:** bank, police HQ, gas station, mechanic garage, scrap yard, chop shop, bar, lumber camp, farm (fields, barn), legal scrap yard (car crusher, metal piles), docks crane, apartment block, front businesses (laundromat, car wash, nightclub), interiors.
- **Streets (user direction 2026-10-10, see 01 "Street layout and density"):**
  - Ground (decided 2026-10-11: baked from a vector street layout, see 14): repeating material swatches from `ground2d.py` (asphalt, sidewalk, plaza paving patterns, cobbles, lot, grass, dirt, painted markings), plus grates, cracks and puddles.
  - Props (made in milestone 1b, `source/street.py`): bus shelter, phone booth, café sets, kiosk, advertising column, sandwich board, parking meter, utility box, bollard, fountain, wheelie bins, pallets, pipes, AC units, bags, boxes, cones; segments for brick and stone walls, railings, chain-link fences, hedges and planting beds; grass tufts and weeds. Still wanted later: posters on building walls, awnings over cafés as separate props.
  - Infill buildings and shopfronts (made in milestone 1b, `source/infill.py`): 10 shopfronts, 3 walk-ups, 3 mid-rise offices, a workshop.
- **Effects:** muzzle flash, tracer, smoke, fire, explosion, blood-free hit spark, rain splash, siren light glow.
- **UI:** the phone screens, inventory grid, shop screens, pause menu, Life Summary. (The HUD, prompts and the lockpick panel are drafted in `drafts/hud/`.)

## Audio (sound effects first; music later)
SFX should be short, soft, slightly lo-fi, and consistent with the muted visuals. Use procedural generation (e.g. jsfxr) or CC0 libraries, and credit them in `CREDITS.md`.

| Priority | Sounds |
|---|---|
| Must-have (vertical slice) | Footsteps (concrete, grass), car engine loop with pitch by speed, tyre screech, crash, door open/close, lockpick click/fail, hotwire spark, siren (loop), police radio blip, cash pickup, UI click/confirm/cancel, paper shuffle and stamp (filing), clock-in bell |
| Next | Gunshots per weapon, reload, shell drop, ricochet, glass break, store alarm, car alarm, rain loop, ambient city loop, crowd panic, helicopter loop, explosion |
| Music (later) | Calm civilian daytime loop, tense chase loop that layers in with stars, rainy night ambience |

Mixer: master, music, SFX and UI volume sliders. Sirens are positional (pan and volume by distance).
