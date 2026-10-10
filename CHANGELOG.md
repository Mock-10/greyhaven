# Changelog

Track each phase from docs/15_roadmap.md here. Tick a phase only when its "Done when" checks pass.

- [x] Phase 0 — Foundations
- [ ] Phase 1 — Vertical slice
- [ ] Phase 2 — Economy and careers
- [ ] Phase 3 — Crime breadth and police
- [ ] Phase 4 — Combat and vehicles
- [ ] Phase 5 — Property, hideouts, operations, crews
- [ ] Phase 6 — Full town
- [ ] Phase 7 — Late game
- [ ] Phase 8 — Polish

<!-- Per phase: Built / How to try / Assumptions / Art debt / Known issues -->

## Phase 1 — Vertical slice (in progress)

Decisions from the question round (2026-10-10) are recorded in docs/18 ("Answers"), docs/01 ("Names") and docs/16. Delivered in playable milestones, one PR each.

### Milestone 1: Downtown, player, clock, HUD (2026-10-10)
- [x] Downtown ("The Ledger") map, 48 × 48 tiles, with the approved names: Pellridge Tower and its plaza, Open Most Hours and its parking lot, a second lot on Millwright Road, Drizzle Row Residences, The Low Tide, Marlo's Tow & Salvage at the east edge. Overcast Avenue and Drizzle Row run east–west; Pewter Street and Millwright Road run north–south. Crosswalks, traffic lights and street signs at every crossing, lamps, benches, planters, hydrants, bins and trees along the sidewalks, parked cars in the lots, junk cars in Marlo's yard.
- [x] New exterior art made with `art/source/`: The Low Tide, Marlo's chop shop and Drizzle Row Residences (`env.py`), plus named versions of the tower and the store. Business names are drawn on the sign boards in the 3 × 5 pixel font, inside the model's material, so they read in every orientation. Every Phase 1 building has a `_night` variant with lit windows. Packed by `art/source/pack_phase1.py` into `art/buildings2.png/.json`.
- [x] Player: walk and sprint in 8 directions with a smoother 8-frame walk cycle (new in-between poses from `art/source/pack_steps.py`, `art/characters_steps.png/.json`), collision, footprint-aware depth, occlusion fade.
- [x] Interaction: everything usable within 1.5 tiles shows the idle gold rim; the one in front of you shows the hover rim and the prompt; **Tab** cycles; **E** uses. In this milestone: the plaza ATM and the five street doors.
- [x] Clock: the 20-minute day (setting stored for 15 / 20 / 30), Monday 07:00 start, darkness ramps at dawn and dusk, night tints from the style guide (objects, ground and usable objects separately), lit windows that ignore the tint, warm dithered lamp pools, a darker sky.
- [x] HUD drawn with the `hud.py` primitives at UI resolution and scaled by whole numbers: vitals panel, stars, day/clock/clean/dirty panel, radar (iso-oriented, buildings, home and shop blips, the arrow points where you face), objective line, phone messages (Ms. Hollis at the start, Dez at 17:30), street name and district when you enter a street, key hints. The F3 readout moved into the HUD.

### Milestone 2: interiors and the office job
- [x] Drafts approved (2026-10-10, after one revision: a bigger back room for Dez with laundering clutter, and fixes from the new layout checker): `interior_tower_lobby.png`, `interior_office_floor.png`, `interior_bar.png`.
- [ ] Interior scene with doors and the sight system (docs/19): apartment, office building, corner store (shopping), bar.
- [ ] Office Worker job: clock in, 3 filing / data-entry tasks, pay, promotion XP, rank 1 → 2.
- [ ] Sleep at the apartment.

### Milestone 3: driving and the carjack loop
- [ ] One sedan with arcade handling, fuel and basic damage; enter and exit (F).
- [ ] Carjacking a parked car: lockpick and hotwire minigames; sell it at the chop shop for dirty money; launder at Dez's.

### Milestone 4: police, saves, crowd
- [ ] Wanted 1–2★: witnesses with the call delay, one police car and officers, search circle, escape timer, arrest with surrender, fine, first-offense rule.
- [ ] Saves: 3 slots, autosave on sleep, export and import, SAVE_VERSION and migrations.
- [ ] A few pedestrians and ambient traffic.
- [ ] **Done when:** a full day loop can be played (work → evening carjack → escape or arrest → launder → sleep → reload the save), all unit tests pass, and the frame rate holds.

### Milestone 1 notes
**How to try:** click to start, walk with WASD (Shift sprints). Walk up to the ATM on the plaza or any building door: the gold rim and the `[E]` prompt appear; Tab switches target when two are in range. Watch the clock: dusk starts at 18:00 and windows and street lamps light up. Debug links: `?scene=world&time=19:45` (dusk), `?scene=world&time=23:30` (night).

**Assumptions (please review):**
- A new game starts on Monday 07:00 with $250 clean and $0 dirty (docs/02 gives no starting cash).
- Darkness ramps from 18:00 to 21:30 and from 05:00 to 07:00; lamps and lit windows switch on past 35% darkness.
- Doors and the ATM are usable but only show a phone message until their systems arrive (interiors in milestone 2, banking with the phone in Phase 2).
- The vitals panel shows UNARMED until weapons arrive (Phase 4).
- Lamp light is drawn additively (warm colour in 4 dithered bands), an approximation of the reference composer's lamp formula.

**Art debt:** none. All new art was generated with `art/source/`.

**Known issues:**
- Parked cars can't be used yet (milestone 3). There are no pedestrians or traffic yet (milestone 4).
- Lamp light pools are faint at the start of dusk and full only after 21:30.

## Phase 0 — Foundations (2026-10-10)

### Checklist
- [x] Package moved to the repo root (the upload had landed in `double-life(1)/double-life/`).
- [x] Vite + TypeScript (strict) + Phaser 3.90.0 (latest 3.x, pinned) project.
- [x] ESLint + Prettier (`npm run lint`), Vitest unit tests (`npm test`), Playwright smoke test (`npm run test:e2e`).
- [x] GitHub Pages workflow `.github/workflows/deploy.yml`: lint → test → build → smoke test on every push and PR, deploy to Pages on `main`. Vite `base` is `/greyhaven/`.
- [x] Screenshot script `npm run shots` (`tools/shots.ts`, `?scene=…&seed=…` URLs and a ready flag) and a pixel comparison against the reference scene, `npm run compare` (`tools/compare_reference.py`).
- [x] "Click to start" title screen, drawn over the live world.
- [x] Atlas loader for the art-pack format: frames get a custom pivot at their ground anchor, and opaque bounds are measured at load.
- [x] Isometric projection (`screenX = x − y`, `screenY = (x + y)/2 − z`), chunk-baked ground renderer with static ground shadows, depth sorting by world x + y, and footprint-aware sorting for anything that moves.
- [x] Pixel-perfect camera: the canvas runs at device resolution, zoom is a whole number (2×, 3× or 4×, picked from the window size, Ctrl + wheel to change), the scroll is always a whole pixel, and the camera pans with the middle mouse or the screen edge (12-tile limit, springs back after 3 s or on C).
- [x] Test map: the 28 × 28 tile district of `art/scene_overcast_day.png`, ported from `art/source/scene.py` with the same numbers.
- [x] Occlusion: a tall sprite in front of the walker fades to 35%.
- [x] Debug overlay (F3): fps, zoom, world position, tile, depth, pan, baked chunks, collision shapes.
- [x] **Done when:** the test map matches the reference (see below), a character sorts correctly in front of and behind a building (smoke test plus screenshots), and the Pages link works after merge.

### Built
- **Matches the reference:** at 1× the test map matches `art/scene_overcast_day_1x.png` on 99.60% of pixels exactly and 99.95% within ±3 colour levels. What's left: anti-aliasing at the edges of a few shadow polygons, the dash phase of the car's gold rim, and the ATM prompt 1 px to the left. `npm run shots -- reference_1x && npm run compare` regenerates the numbers and `shots/reference_diff.png`.
- **New art:** `art/tiles_var.png/.json`, every ground tile in the 7 seeded variants the reference scenes use, made with `art/source/tile_variants.py` (the main tile atlas only holds seed 3). The generator reproduces the existing atlas tiles exactly.
- **Debug walker:** an office-worker sprite you can walk with WASD (Shift to sprint), with 8-direction walk animation, a moving blob shadow and simple collision with buildings, cars and props. It's there to test sorting and the camera; the real player controller comes in Phase 1.
- **Code layout** follows docs/14: `src/config` (all numbers in `balance.ts`), `src/core` (event bus, seeded RNG, fixed-step clock, state store), `src/iso` (projection, depth, shadows, chunks, camera, occlusion), `src/assets` (atlas loader, interactable rim), `src/ui` (pixel font, prompt plate), `src/maps`, `src/scenes`, `src/debug`.

### How to try
- Play: `https://mock-10.github.io/greyhaven/` (after the PR is merged and the deploy finishes).
- Click to start, then walk with **WASD** (**Shift** sprints). Pan with the **middle mouse** or by pushing the mouse to the screen edge; **C** recentres. **Ctrl + wheel** zooms 2× / 3× / 4×. **F3** shows the debug overlay.
- Walk behind the office tower or the corner store: the building fades so you can still see yourself. Walk in front: you draw over it.
- Debug URLs (view only): `?scene=world` skips the title, `?scene=reference` shows the whole map at 1× like the reference image, `?zoom=1..4`, `?x=…&y=…` sets the start position in world units, `?debug=1` opens the overlay, `?seed=n`.
- Developers: `npm install`, `npm run dev`, `npm test`, `npm run test:e2e`, `npm run build && npm run shots`, `npm run compare`.

### Assumptions (please review)
- The test map shows the interactable cues (gold rims, prompts) all the time, like the reference image. Showing them only in range, and pressing E, arrive with the interaction system in Phase 1.
- Sprites sit on the pixel that Python's `round()` gives (round half to even), so they land exactly where the reference composer put them.
- Moving objects use footprint-aware depth (in front of a building once past its far edge, behind it before its near edge). Static objects keep the reference composer's anchor sort.
- Static shadows are baked into the ground. A moving object's shadow is its own sprite, so where it overlaps a static shadow the two darken twice (rare and subtle).
- The simulation runs on real elapsed time with a fixed 30 Hz step, capped at 0.25 s per frame, rather than Phaser's smoothed delta, so the game never slows down when the frame rate drops.
- The canvas runs at device resolution (CSS size × devicePixelRatio), so art pixels stay square on 125%/150% scaled screens. Checked at 1×, 1.25× and 2×.

### Art debt
None. No debug sprites or placeholder rectangles were added.

### Known issues
- The camera has no world bounds yet: pan can show the background beyond the map edge (within the 12-tile pan limit).
- Headless Chromium (SwiftShader) renders slowly (about 12 frames per second at 720p), so screenshots and the smoke test are slow. Real GPUs are unaffected.
- The production bundle is about 1.3 MB of JS (Phaser is most of it). It loads well under the 5 s target, but code splitting can come later.

### Next (Phase 1)
Phase 1 starts with questions for you: the 18_interiors question round for the starter apartment, office floor, corner store and bar, and a proposed list of street and business names for Greyhaven (docs/16).
