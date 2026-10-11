# 14 — Tech Architecture

## Stack
- **Phaser 3** (latest stable 3.x at project start; check the version with npm and pin it exactly). If the user later chooses Phaser 4, treat that as a separate migration task.
- **TypeScript** in strict mode. **Vite** for dev server and build. **Vitest** for unit tests. **Playwright** for one boot/smoke test.
- **ESLint + Prettier.** No other frameworks unless a phase doc justifies one. Possible small libs: `idb-keyval` (saves), `easystarjs` or a hand-written A* (pathfinding).
- Output is a static site (`npm run build` → `dist/`).
- **Hosting: GitHub Pages** (decided). The repository is called **`greyhaven`** (decided), so set Vite `base` to `/greyhaven/` for production builds. The game will live at `https://<user>.github.io/greyhaven/`. Add a GitHub Actions workflow (`.github/workflows/deploy.yml`) that runs lint, tests and build, then deploys `dist/` to Pages on every push to `main`. Use the official `actions/upload-pages-artifact` and `actions/deploy-pages` actions. Keep every asset path relative to `base`.

## Runtime: browser only (decided)
- The game is **entirely client-side**: no backend, no server calls, no accounts, no telemetry. Play stats stay in the save (12).
- **All assets are bundled** (atlases, fonts, audio) under `base`. No runtime requests to other origins and no CDN scripts or fonts, so the game works offline once loaded.
- **Target browsers:** current desktop Chrome, Edge and Firefox. Safari is best effort. WebGL renderer with Canvas fallback (Phaser `AUTO`).
- **Storage:** IndexedDB for saves, localStorage for settings. Handle "storage unavailable" (private windows) with a clear message and export-only saving.
- **Focus and audio:** pause the simulation when the tab is hidden (`visibilitychange`). Audio unlocks on the first click (browser autoplay rules), so the title screen needs a "click to start".
- **Resize:** scale mode FIT with an integer zoom picked from the window size. Never use fractional scaling.

## Development environment (Claude Code on the web)
- Development happens in a **cloud container**. The user plays only the deployed Pages build.
- **Visual checks:** serve the build in the container (`npm run preview`) and capture screenshots with Playwright's headless Chromium. Keep a script, `tools/shots.ts` (`npm run shots`), that boots the game with a `?scene=<name>&seed=<n>` URL parameter, waits for a "ready" flag, and saves PNGs to `shots/`. Use it to compare against the reference scenes. Debug URL parameters are allowed in all builds but must be harmless (view-only: scene jump, seed, debug overlay). Cheats stay dev-only.
- **Python** (numpy, Pillow) is only for `art/source/` and `tools/econ_sim.py`. Commit the generated art to the repo; the build never runs Python.

## Project layout
```
/                     CLAUDE.md, package.json, vite.config.ts, tsconfig.json
/docs                 design docs (this folder) — the source of truth
/art                  art pack: atlases, palette, STYLE_GUIDE.md, source/ (generator)
/public/assets        atlases copied/linked from /art for the build
/tools                econ_sim.py and other dev scripts
/src
  main.ts             Phaser.Game config (pixelArt: true, roundPixels: true, scale mode FIT or RESIZE, integer zoom)
  config/             balance.ts (ALL tunable numbers), keys.ts, constants.ts
  data/               jobs.ts, crimes.ts, items.ts, weapons.ts, vehicles.ts, properties.ts — data tables, no logic
  core/               eventBus.ts, store.ts (game state), clock.ts (fixed timestep), rng.ts (seeded)
  iso/                projection.ts, depthSort.ts, tilemap.ts, occlusion.ts, camera.ts
  assets/             atlasLoader.ts (art-pack JSON → Phaser frames + origins)
  entities/           Player, Pedestrian, Vehicle, Police, Interactable
  systems/            time, economy, laundering, careers, crime, wanted, police AI, witnesses, npcCrowd, traffic,
                      combat, vehicles, property, operations, crew, save
  minigames/          Minigame base class + one file per minigame
  scenes/             Boot, Preload, Title, World, Interior, UI (HUD overlay), Minigame overlay, Pause, Phone
  ui/                 HUD widgets, prompt plate, pixel font, menus
  maps/               district map data (JSON from Tiled or hand-built)
/tests                unit tests for systems (economy, wanted, careers, save migrations)
```

## Core principles
1. **Data-driven.** All numbers come from `config/balance.ts`, and catalogues from `data/*.ts`. Systems contain logic, not numbers.
2. **State and view kept apart.** Game state lives in one serialisable store (`core/store.ts`, plain objects). Phaser objects are views that read the state. This makes saving trivial and systems testable without Phaser.
3. **Fixed-timestep simulation** (e.g. 30 Hz) for game logic and the clock, with rendering every frame. Game time scales from real time (1 in-game hour = 50 s).
4. **Event bus** for cross-system events (`crime:detected`, `wanted:changed`, `shift:completed`, `day:started`, …). Systems never call into each other's internals.
5. **Seeded RNG** (`core/rng.ts`) for all randomness, so bugs can be reproduced.

## Isometric engine
- **World coordinates**: x and y on the ground plane, z is height. 1 tile = 32 units. Screen projection must match the art exactly:
  `screenX = (x − y)`, `screenY = (x + y) / 2 − z` (then camera transform and zoom).
- **Tile (i, j)** has its top vertex at world (32i, 32j). Draw the tile image with its anchor (the top vertex) at that point.
- **Depth sorting:** tiles draw first (by i + j). Objects draw after, sorted by the world `x + y` of their **ground anchor**. Use Phaser `setDepth(x + y)` on a dedicated object layer. Large buildings use their footprint's front corner. Test with people walking around buildings.
- **Collision:** the ground is a tile grid of walkable/blocked cells. Buildings and props have **footprint polygons in world units**, and vehicles use oriented boxes. Do collision in world space, never in screen space.
- **Occlusion:** if the player is behind a tall sprite (screen overlap and smaller world depth), fade that sprite.
- **Map size:** about 320 × 320 tiles (raised on 2026-10-11), so the world must stream: render only tiles and objects inside the camera bounds plus a margin. Pool and reuse sprites.
- **Ground (built in Phase 0):** tiles never move, so they are baked into 16 × 16-tile chunk textures together with the static ground shadows. Only chunks near the camera are kept (least recently used are dropped past a cap). Chunk textures have even sizes; an odd-sized render texture draws 1 px out of place.
- **Vector ground (decided 2026-10-11, built in Phase 1 milestone 1b):** streets, kerbs, sidewalks, plazas and paving patterns are vector shapes in world units (polygons, arcs and stroked centre lines for markings), so curves can have any radius. When a chunk is baked, the shapes are rasterised into a material buffer at pixel centres (no anti-aliasing), each pixel takes its colour from that material's repeating texture swatch, and raised edges get kerb faces. The swatches are made by `art/source/ground2d.py`, so the colours, dithering and texture match the tile art. Nothing large is shipped per map, so this scales to the full city. Plain areas can still use the tile grid. The Python draft renderer and the game use the same map data and the same rules.
- **Pixel-perfect canvas (built in Phase 0):** the canvas runs at device resolution (CSS size × devicePixelRatio) with scale mode NONE, the camera origin is its top-left corner, and the scroll is a whole art pixel, so every sprite lands on whole screen pixels at any integer zoom.

## Performance targets
- 60 fps on a mid-range laptop at 1080p with 35 pedestrians, 20 cars and 5 police.
- Initial load under 5 s. Atlases are small: the whole current pack is under 1 MB of PNG.

## Testing
- Unit tests for economy maths, laundering caps, wanted escalation and decay, arrest outcomes, promotion XP, save migrations.
- A smoke test (Playwright): the game boots, a new game starts, the player moves. Also run it against the production build (`base` `/greyhaven/`) to catch broken asset paths before deploy.
- A **debug overlay** (F3): fps, world coordinates, tile, depth values, collision shapes, NPC states.
- A **cheat console** (F1, dev builds only): add cash, set stars, set rank and reputation, skip time. Essential for balancing.
