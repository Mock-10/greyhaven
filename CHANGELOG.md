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

## Handover (updated 2026-10-11) — read this first in a new session

**Where things stand**
- **The current phase is still Phase 1 (vertical slice).** It is delivered in milestones, one PR each. Milestone 1 is done; **milestone 1b (the Downtown rework) is in progress** on branch `claude/sweet-albattani-4dbzox`. Phase 2 is parked until Phase 1 is finished and the user says go.
- **`main`** has Phase 0, Phase 1 milestone 1 and the milestone 2 WIP logic (PR #1, #2 and #3, all merged). It is live at `https://mock-10.github.io/greyhaven/`.
- **Milestone 2 WIP logic is already on `main`** (PR #3 merged it), not wired into the game yet:
  - `art/source/export_interiors.py` → `art/interiors/` (game-ready interior sheets and geometry);
  - `src/systems/sight.ts` (docs/19 rules, tests in `tests/sight.test.ts`);
  - `src/data/interiors.ts` (hours, door rules, prompt actions, NPC schedules);
  - `src/data/jobs.ts` + `src/systems/career.ts` (tests in `tests/career.test.ts`);
  - `src/minigames/logic.ts` (filing and data-entry rules, tests in `tests/minigames.test.ts`).
- **The Downtown map is a test map, not the final city** (user, 2026-10-11). The final city is a massive, dense open world at about 320 × 320 tiles (docs/01), laid out in Phase 6.

**Decisions of 2026-10-11 (question round before milestone 1b)**
- Walk 48 units/s, sprint 2.3× (about 3.4 tiles/s), tuned by feel. *Done.*
- Curves are built as **vector-baked ground** (docs/14 "Vector ground").
- Curved features in the test Downtown: a **curved plaza at Pellridge Tower** and a **bending street**, plus rounded kerbs and curved planters and walls.
- Infill buildings and shopfronts are **facades only**.
- The **3 × 3 density rule** is approved and binding (docs/01).
- Idle and interact animations stay single poses until **Phase 8 (Polish)**.
- The corner store **sells a few basics** in Phase 1: snacks that heal and a fuel can, clean cash only (docs/18).
- **All milestone 1 and milestone 2 assumptions are approved** (start Monday 07:00 with $250, opening hours, STAFF ONLY door, shift XP rounding, XP carry-over, filing and data-entry sizes).
- Town target raised to **320 × 320 tiles**, with a **hood district** and large plain grass areas to fill in later; open fields and woods stay (docs/01, docs/15 Phase 6).

**Milestone 1b, the Downtown rework (your feedback, 2026-10-10)**
Your words, after playing milestone 1: *"The player when sprinting feels still too slow for such a vast and open world. Driving will be a portion implemented later on of course. The entire map feels lackluster and desolate with a lot of empty space. For example stores have huge portions of repeated sidewalk/concrete and the design feels very open space but lacks any level of details with decorations. Implement a lot more decorations, close the space, and process it like an actual city as opposed to such vast empty spaces. The map also feels very squared off and boxed like although this is only a small section being drafted and shown right now. I'd like for rounded corners or streets with more curved turns and an increased addition of curved spaces and geometry as seen fit going with the look and feel of the game."*

The binding rules are now in `docs/01_world_and_time.md` ("Street layout and density"), `CLAUDE.md` (hard rule 7) and the street art list in `docs/13`. The work:
1. **Faster on foot.** Done 2026-10-11: walking 48 units/s, sprinting 2.3×, walk cycle 18 fps (×1.8 sprinting) so the feet don't slide.
2. **Close the space.**
   - Rework `src/maps/downtown.ts` into a real city block pattern:
     - tighter blocks, with buildings fronting the sidewalk;
     - infill buildings and shopfronts, plus alleys between them;
     - parking lots smaller and edged with planters, fences or low walls;
     - no wide strips of plain concrete in front of the stores.
   - Keep the approved names and the five buildings with doors, plus the Phase 1 needs: a parking lot with cars to steal, the chop shop at the edge, and room for police and traffic later.
3. **Decorate densely.** Add many more street props, made with `art/source` (`decor.py` / `env.py`). Examples: bus stops, newspaper boxes, phone booths, bike racks, café tables with awnings, kiosks, alley clutter (dumpsters, pallets, crates, pipes, AC units), wall posters, fences, tree pits and grates. Break up the repeated paving with variants, patterns, cracks, puddles and kerb details.
4. **Curves.** Round the street corners, add the curved Pellridge plaza and a bending street, plus curved planters and walls where they fit. Built as vector-baked ground (decided): material swatches from `art/source/ground2d.py`, shapes in world units. Collision for curves uses footprint polygons in world units (docs/14).
5. **Draft first.** This is a big visual change. Before building it in the game, render a draft of the new Downtown with `art/source` (like the reference scenes and the interior drafts) and get your approval.
6. Then check it in the game with Playwright screenshots (day and night), compare them with the reference scenes and the approved draft, update tests and the smoke test (the building positions change), open a PR, and check the Pages build after merge.

Then merge `main` into the milestone 2 branch and continue below.

**Next steps (milestone 2, in order)**
1. **Minigame overlay scene** (`MinigameScene`): it dims the world by 35%, shows a 176 × 128 panel matching `art/drafts/hud/` (the lockpick mockup) and a gold title at 2×. Draw the filing and data-entry panels with `src/ui/hudDraw.ts`. Job tasks pause the world.
2. **Interior area:** split `WorldScene` into the shared parts (player, camera, interaction, HUD feed) and two area views, street and interior, with a fade between them.
   - Loading and depth: load `art/interiors/<id>.json`. The floor goes in the ground layer, walls at the back, stubs on top, segments at depth x + y − 2, items at x + y + zBias. Use footprint-aware depth for the player against box-shadow items and wall segments.
   - Collision: the room edges, partitions minus their gaps, closed doors, and furniture footprints.
   - Doors: OPEN / CLOSE DOOR prompts, and LOCKED shown in red. Door rules follow `data/interiors.ts` (open, locked, key card at rank 2, staff hours).
   - Moving between areas: the exit at the entrance, elevator links between the lobby and floor 4, and opening hours on street doors. After hours, the tower needs the key card. The chop shop says "MARLO: COME BACK WITH A CAR."
   - NPCs appear according to their hours.
3. **Sight rendering** (docs/19):
   - dithered lids over unseen cells;
   - remembered cells dimmed;
   - back walls darkened above rooms you can't see;
   - lavender NPC "ghosts" at 40%;
   - 150 ms fades;
   - the **sight lines** setting turns all of this off;
   - remembered rooms kept in the game state.
4. **Office job in game:** clock in with Ms. Hollis, then 3 tasks at the filing cabinets and your desk, then clock out for pay, XP and rank, with objective lines and phone toasts. Rank 2 gives the key card (after-hours lobby and the server room).
5. **Sleep** in the apartment: skip to 06:00 the next day. Autosave arrives with saves in milestone 4.
6. Unit and e2e tests for the above, screenshots in `docs/screenshots/phase1_m2/` compared with the drafts, the milestone 2 notes below, a PR, and a Pages check after merge.

**Tweaks you asked for**
- "Animations are a bit stiff" (after Phase 0): **done in milestone 1**. There is now an 8-frame walk and sprint cycle, with new in-between poses. Idle and interact poses: deferred to Phase 8 (decided 2026-10-11).
- Dez's back room made bigger, with bills and laundering clutter on the floor and tables: **done**, and the draft was approved.
- Check every draft for furniture facing the right way and for overlaps or clipping: **done**. `art/source/check_layout.py` now checks this automatically, and all three drafts pass with 0 issues.
- **Outstanding (2026-10-10, after milestone 1): sprinting too slow, Downtown too empty and open, too boxy. Wanted: more decoration, a closed-in city feel, rounded corners and curved streets.** Not done yet. It is milestone 1b above.

**Questions**
- Answered 2026-10-11: corner store basics (yes), assumptions (all approved).
- Still open from docs/16, but **not needed yet**: names and looks for the rival crew (3 options, needed by Phase 5), an outline of each story chain before it is written, and the hood district's name and details (Phase 6).

**Session notes for whoever picks this up**
- npm goes through the proxy. Before `npm`, `npx vite preview` or Playwright, set `export NO_PROXY=localhost,127.0.0.1 no_proxy=localhost,127.0.0.1 npm_config_noproxy=localhost,127.0.0.1`. Playwright uses the pre-installed Chromium (`/opt/pw-browsers`), so don't run `playwright install` locally.
- `npm run shots` starts its own preview server and kills it afterwards. Don't use `pkill -f "vite preview"`, because it also kills the calling shell.
- Interior art pipeline: edit `art/source/rooms.py` → `python3 art/source/check_layout.py` (must report 0 issues) → `python3 art/source/export_interiors.py` → commit `art/interiors/*`.
- The simulation runs on `game.loop.rawDelta`, because Phaser's smoothed delta crawls in headless Chromium.

## Phase 1 — Vertical slice (in progress)

Decisions from the question round (2026-10-10) are recorded in docs/18 ("Answers"), docs/01 ("Names") and docs/16. Delivered in playable milestones, one PR each.

### Milestone 1: Downtown, player, clock, HUD (2026-10-10)
- [x] Downtown ("The Ledger") map, 48 × 48 tiles, with the approved names: Pellridge Tower and its plaza, Open Most Hours and its parking lot, a second lot on Millwright Road, Drizzle Row Residences, The Low Tide, Marlo's Tow & Salvage at the east edge. Overcast Avenue and Drizzle Row run east–west; Pewter Street and Millwright Road run north–south. Crosswalks, traffic lights and street signs at every crossing, lamps, benches, planters, hydrants, bins and trees along the sidewalks, parked cars in the lots, junk cars in Marlo's yard.
- [x] New exterior art made with `art/source/`: The Low Tide, Marlo's chop shop and Drizzle Row Residences (`env.py`), plus named versions of the tower and the store. Business names are drawn on the sign boards in the 3 × 5 pixel font, inside the model's material, so they read in every orientation. Every Phase 1 building has a `_night` variant with lit windows. Packed by `art/source/pack_phase1.py` into `art/buildings2.png/.json`.
- [x] Player: walk and sprint in 8 directions with a smoother 8-frame walk cycle (new in-between poses from `art/source/pack_steps.py`, `art/characters_steps.png/.json`), collision, footprint-aware depth, occlusion fade.
- [x] Interaction: everything usable within 1.5 tiles shows the idle gold rim; the one in front of you shows the hover rim and the prompt; **Tab** cycles; **E** uses. In this milestone: the plaza ATM and the five street doors.
- [x] Clock: the 20-minute day (setting stored for 15 / 20 / 30), Monday 07:00 start, darkness ramps at dawn and dusk, night tints from the style guide (objects, ground and usable objects separately), lit windows that ignore the tint, warm dithered lamp pools, a darker sky.
- [x] HUD drawn with the `hud.py` primitives at UI resolution and scaled by whole numbers: vitals panel, stars, day/clock/clean/dirty panel, radar (iso-oriented, buildings, home and shop blips, the arrow points where you face), objective line, phone messages (Ms. Hollis at the start, Dez at 17:30), street name and district when you enter a street, key hints. The F3 readout moved into the HUD.

### Milestone 1b: Downtown rework (your feedback, 2026-10-10; plan of 2026-10-11)
- [x] Question round and decisions recorded in the docs (2026-10-11).
- [x] Faster walking and sprinting (`BALANCE.walker`: 48 units/s, sprint 2.3×, walk cycle in step).
- [x] New street props made with `art/source` (`street.py`): bus shelter, newspaper boxes, phone booth, bike rack, café tables with an awning, kiosk, tree pits and grates, bollards, fences, straight and curved low walls, curved planters, wall posters, fountain, and alley clutter (pallets, pipes, AC units, crates, bins).
- [x] Infill buildings and shopfronts (`infill.py`: 10 shopfronts, 3 walk-ups, 3 mid-rise offices, a workshop), facades with signs, awnings and `_night` lit windows, every side dressed.
- [x] Ground material swatches from `ground2d.py` (asphalt, sidewalk, plaza paving and rings, cobbles, brick paving, lot, grass, dirt, painted markings) and the vector street format.
- [x] Downtown authored as one data file shared by the draft renderer and the game: tighter blocks, buildings fronting the sidewalk, infill and alleys, smaller lots edged with planters, fences or low walls, the curved Pellridge plaza and a bending street, rounded kerbs. Keeps the five buildings with doors, a lot of stealable cars, the chop shop at the edge, and room for police and traffic.
- [x] **Draft rendered (day and dusk) and approved by you before building it in the game.** Approved 2026-10-11 with one change: more greenery (lawns in courtyards and back yards, planting strips along Drizzle Row's residential stretch, a lawn behind the tower, a few corners), while staying mostly paved. `art/drafts/downtown/` holds the full map day and dusk and close-ups.
  - Draft pipeline: `art/source/downtown_map.py` (the map, writes `src/maps/downtown.json` and the drafts), `ground_vec.py` (swatches, rasterising, kerb faces), `citygeo.py` (curves and rounded blocks), `draft_city.py` (renderer with topological depth order), `check_city.py` (overlaps, buildings on roads, the 3 × 3 density rule: 0 issues).
- [ ] In game: vector ground baking, the new map, polygon collision for curved walls, the radar drawn from the new layout.
- [ ] Leftovers fixed on the way: camera world bounds (open since Phase 0), faint lamp pools early in dusk.
- [ ] Tests: the density rule (no bare patch over 3 × 3 tiles), vector ground rasterising, collision, updated smoke test.
- [ ] Screenshots (day and night) compared with the reference scenes and the approved draft, notes, PR.

### Milestone 2: interiors and the office job
- [x] Drafts approved (2026-10-10, after one revision: a bigger back room for Dez with laundering clutter, and fixes from the new layout checker): `interior_tower_lobby.png`, `interior_office_floor.png`, `interior_bar.png`.
- [x] Export of the approved drafts into game-ready sprites and geometry (`art/source/export_interiors.py` → `art/interiors/`). *On the WIP branch.*
- [x] Sight rules as tested logic (`src/systems/sight.ts`). *On the WIP branch, not drawn in game yet.*
- [x] Interior definitions: hours, door rules, prompt actions, NPC schedules (`src/data/interiors.ts`). *On the WIP branch.*
- [x] Career logic for the office job: clock-in window, late pay, pay, XP, promotion bonus, key card (`src/systems/career.ts`, `src/data/jobs.ts`). *On the WIP branch.*
- [x] Filing and data-entry minigame rules (`src/minigames/logic.ts`). *On the WIP branch, no on-screen panel yet.*
- [ ] Minigame overlay scene (panels drawn to match `art/drafts/hud/`).
- [ ] Interior scene with doors and the sight system (docs/19): apartment, office building, corner store (shopping), bar.
- [ ] Office Worker job: clock in, 3 filing / data-entry tasks, pay, promotion XP, rank 1 → 2.
- [ ] Sleep at the apartment.
- [ ] Tests, screenshots, notes, PR.

### Milestone 2 notes (in progress)
**Assumptions (approved 2026-10-11):**
- Opening hours: corner store 07:00–21:00, Pellridge Tower 08:00–18:00, The Low Tide 16:00–02:00, with Dez in the back room 18:00–02:00 (all from docs/18). Outside opening hours the street door is locked. The tower lets you in after hours only with the rank 2 key card.
- Dez's back-room door opens only while Dez is in (18:00–02:00). At other times it shows "STAFF ONLY". The store's back-room door stays locked in Phase 1, because robbery comes in Phase 3.
- In Phase 1 the draft's crime prompts in the store (rob register, lockpick, safe, cameras, footage) are hidden. The counter shows SHOP (see the question in the handover). The wardrobe and stash in the apartment show "coming in Phase 3 / Phase 5" messages. Dez's LAUNDER says "bring me something to wash first" until dirty cash exists in milestone 3.
- A shift counts on Monday to Friday, clock-in 08:00–10:00, late after 09:00 at 80% pay, one shift per day (docs/03).
- **Shift XP:** docs/03 lists XP by shift result ("mostly poor / OK / good / excellent" = 6 / 9 / 11 / 14). I take "mostly" to mean the average task grade, rounded down. A minigame can also end in **fail** (for example when data entry runs out of time), which counts like poor.
- Spare XP carries over after a promotion. The promotion bonus is paid in clean cash with the shift's pay.
- **Filing:** 8 papers in 3 colours (red, navy, sage), each falling a little faster than the last; a misfile cancels one correct paper. docs/06 also mentions dragging and stamping each paper, which the overlay must add. The logic currently files with keys 1–3 or a click.
- **Data entry:** 3 sequences of 5 keys in 14 seconds. Excellent needs no errors and at least 35% of the time left.

**Art debt:** none. All interior sprites come from the approved drafts through `art/source/`.

**Known issues:** milestone 2 is not playable yet. Street doors still only show a phone message on `main`.

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

**Assumptions (approved 2026-10-11):**
- A new game starts on Monday 07:00 with $250 clean and $0 dirty (docs/02 gives no starting cash).
- Darkness ramps from 18:00 to 21:30 and from 05:00 to 07:00; lamps and lit windows switch on past 35% darkness.
- Doors and the ATM are usable but only show a phone message until their systems arrive (interiors in milestone 2, banking with the phone in Phase 2).
- The vitals panel shows UNARMED until weapons arrive (Phase 4).
- Lamp light is drawn additively (warm colour in 4 dithered bands), an approximation of the reference composer's lamp formula.

**Art debt:** none. All new art was generated with `art/source/`.

**Known issues:**
- Parked cars can't be used yet (milestone 3). There are no pedestrians or traffic yet (milestone 4).
- Lamp light pools are faint at the start of dusk and full only after 21:30.
- Still open from Phase 0: the camera has no world bounds (panning can show the background past the map edge, within the 12-tile pan limit). Headless Chromium renders at about 12 fps, so screenshots and e2e runs are slow (real GPUs are fine). The JS bundle is about 1.3 MB, mostly Phaser, so no code splitting yet.

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
