# Changelog

Track each phase from docs/15_roadmap.md here. Tick a phase only when its "Done when" checks pass.

- [x] Phase 0 — Foundations
- [x] Phase 1 — Vertical slice
- [ ] Phase 2 — Economy and careers
- [ ] Phase 3 — Crime breadth and police
- [ ] Phase 4 — Combat and vehicles
- [ ] Phase 5 — Property, hideouts, operations, crews
- [ ] Phase 6 — Full town
- [ ] Phase 7 — Late game
- [ ] Phase 8 — Polish

<!-- Per phase: Built / How to try / Assumptions / Art debt / Known issues -->

## Resume here (updated 2026-10-12) — the first thing a new session reads
1. **Read**, in order:
   - `CLAUDE.md` (the rules; autopilot is on);
   - this file's Phase 2 checklist and the "Handover" section below;
   - `docs/00_GAME_DESIGN.md` and `docs/15_roadmap.md` (Phase 2);
   - the system docs for the next milestone: 01 (streets, the two-lanes-each-way rule), 02 (shops), 03 (jobs), 08 (vehicles, the car dealer), 11 (creator, phone), 18 (interiors: the questions and drafts), 13 (art);
   - `art/STYLE_GUIDE.md` before any art.
2. **Check where the code is.** Run `git fetch origin`, then look at the open PRs:
   - **Milestone 5 (money and phone)** was merged in PR #10 on 2026-10-12.
   - **The UI redesign** (larger text, more pictures; your request of 2026-10-12) is on `claude/ui-redesign`. If its PR is still open and CI is green, merge it (autopilot). If CI is red, fix it first.
   - **Milestone 6 (map growth, shops, creator)** was started on `claude/p2-map-shops`, with **unfinished, untested** work committed as "WIP Phase 2 milestone 6". It holds:
     - `art/source/suburb.py`: houses, the Swiftish Couriers depot, the Torque & Sons garage, the dealer cabin, Ashby Timber's site trailer, and woods props;
     - multi-lane road support started in `art/source/downtown_map.py`;
     - `src/maps/types.ts`: lanes with stop lines, and a separate `roads` centre-line list;
     - `src/systems/traffic.ts`: a light phase per stop line, so lanes can turn.
   - **To continue M6:**
     - Merge `main` into that branch once the UI redesign is in.
     - New UI must follow the redesign: the 5 × 7 font, pictures from `art/source/ui_icons.py`, and the sizes in docs/11.
     - Then run `npx tsc --noEmit`, `npm test` and the map pipeline (`downtown_map.py --no-render` → `check_city.py` → `pack_city.py`) to see where it stands.
3. **Set up the container** before npm, preview or Playwright:
   - `export NO_PROXY=localhost,127.0.0.1 no_proxy=localhost,127.0.0.1 npm_config_noproxy=localhost,127.0.0.1`
   - `npm install`
   - `pip install numpy pillow` if missing.
   - The art sprite cache isn't committed, so the first map render takes a few minutes.
4. **Work one milestone at a time:** plan → build → test (`npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run test:e2e`) → screenshots (`npm run shots`) → update this file → PR → merge when green → a short note to the user with screenshots → the next milestone. Follow the remaining Phase 2 order: M6 (map growth, two-lane roads, shops, car dealer, creator), M7 (three new jobs, office tasks, uniforms and lockers), M8 (odd jobs, guided first day, econ sim, phase close).
5. **Before you stop**, commit and push all work: the container is discarded. Unfinished work goes on its branch with a "WIP" commit, and this block says where it is.


## Phase 2 — Economy and careers (in progress)
Status key: [x] done and playable · [~] partly done (what's left is said) · [ ] not started. Milestones: M5 money and phone (done), M6 map growth, shops and the creator, M7 the three new jobs, M8 odd jobs, the first day and the close.

**Standing rule from now on (user, 2026-10-11): every new street is at least two lanes in each direction (4 lanes in all).** The existing Downtown streets stay as they are: they have one lane each way, which suits a compact downtown. Everything built from now on follows the rule, starting with the Phase 2 map growth (the garage block road, the house row with the depot, the road through the woods) and later the Phase 6 city. See docs/01 ("Street width").

- [ ] **Street width rule:** new streets are at least two lanes each way. The map script, the lane data and the traffic code must support several lanes per direction first (see the handover).
- [ ] Test map grows: Torque & Sons garage block, a street of houses with the Swiftish Couriers depot, a patch of woods with Ashby Timber and a road (all reachable on foot or by car). All new roads are two lanes each way.
- [x] Bank account: carried vs banked clean cash, ATMs, pay into the bank. (M5)
- [x] Rent auto-paid on Monday 06:00, late fees, eviction after two missed weeks, shelter (sleep and save). (M5)
- [ ] Character creator (palette-swap sprites, as specced) before the first day.
- [ ] Office: stamp-and-sign and meeting tasks (rank 3+).
- [ ] Car mechanic: garage interior (bay, lift, spray booth, office), diagnose, bolt torque, tyre change, respray.
- [ ] Lumberjack: chop, fell direction, load logs, haul with the log truck; site trailer to clock in.
- [ ] Delivery: depot interior, load van, route, doorstep, signature; marked doors on the house row.
- [~] Rank ladders and perks for the 4 jobs (stub the perks that need later systems). (All four jobs and their rank titles are in `data/jobs.ts`; the three new ones are marked "not hiring yet" until M7.)
- [ ] Work uniforms and lockers (change by hand).
- [ ] Weekend odd jobs: car wash and a bar shift at The Low Tide.
- [~] Shops: full corner store, clothing store, hardware store, car dealer (beater and sedan). (M5: the full corner store with the first-aid kit. M6: the hardware store building, clothing, the car dealer.)
- [x] Arrest effects on careers (freeze, missed shifts, extra work, HR bribes on the phone), clean-record bonus. (M5)
- [x] Phone: job board, bank, contacts (first pass); the bag (I). (M5)
- [x] Trunk looting (brought forward). (M5)
- [ ] Guided first day (no bus or taxi step; trunk looting in step 5).
- [ ] Econ sim re-run, tests, screenshots, notes, PR.

### UI redesign: larger text and more pictures (your request, 2026-10-12)
**What changed:**
- **Text:** a new 5 × 7 pixel font (`art/source/pixfont7.py` → `src/ui/font7.json`) for everything you read: the HUD, prompts in the world, panels, the phone, menus and the title. The old 3 × 5 font is left only for tiny captions.
- **Pictures:** `art/source/ui_icons.py` renders 35 small 3D models with the game's own renderer, so they match the world art. The atlas is `art/ui_icons.png`; a contact sheet is in `art/drafts/hud/ui_icons_sheet.png`.
  - item pictures: shop goods, tools, trunk loot;
  - phone app pictures, plus an axe and a parcel for the jobs;
  - HUD badges;
  - contact portraits.
- **HUD:**
  - bigger panels with a heart, a vest, bills, a sun or moon, and pump and wrench pictures;
  - stars at 2×;
  - a bigger radar;
  - messages with the sender's portrait and up to two lines;
  - bigger key hints, which move up a row when they would hit the objective (the driving hints).
- **The phone (P):** drawn as a handset.
  - The home screen is a grid of app tiles with badges: unread messages, and "!" when rent is late. A BAG app is new.
  - Every list has pictures. Contacts open a card with the person's portrait.
  - The job board shows a picture for each job.
- **ATM:** a grid of cash buttons. **Bag (I):** a grid of item tiles with counts. **Shop:** picture cards.
- **Trunk search:** the loot shows as pictures.
- **Lockpick:** shows the tool's picture and the uses left.
- **Minigames and the pause menu:** bigger panels.

**How to try it:**
- Walk around and read the HUD. Press **P** for the phone and **I** for the bag.
- Use the plaza ATM and the Open Most Hours counter.
- Pick a car lock, or loot a trunk.
- Screenshots are in `docs/screenshots/ui_redesign/`. Regenerate them with `npm run build && node tools/ui_shots.ts`.

**Fixes along the way:**
- While driving, the shelter's SLEEP prompt was targeted from anywhere on the map (a milestone 5 bug); from a car, only Marlo's spot counts now.
- The lockpick panel's TOOL line showed the target ("CAR DOOR") instead of the tool.
- The HUD's message slide now runs on real frame time.

**Assumptions (please review):**
- The redesign keeps the palette, the plate style, the gold rules and the screen positions of the hud.py mockups; only the sizes, the font and the pictures changed.
- At 720p the open phone covers the cash panel (the world is paused while it's open).
- Contact portraits are rendered from the person models, so faces are small and simple at 32 px.

**Art debt:** none. All pictures come from `art/source/ui_icons.py`. The hand-drawn pixel item icons were removed.

**Known issues:**
- The title, the phone and the minigame panels assume the UI scale of the HUD: 2× at 720p, 3× at 1080p.
- At 640 × 360 UI pixels, the larger HUD leaves less of the world uncovered on small windows.

### Milestone 5: money and the phone (2026-10-11)
**How to try** (`https://mock-10.github.io/greyhaven/` once the PR is merged):
- **Get paid to the bank:** work a shift at Pellridge Tower; Ms. Hollis says "+$180 TO THE BANK". Press **P** for the phone → BANK: the balance and the STATEMENT.
- **ATM:** E at the ATM on the Pellridge plaza: deposit your carried clean cash or take out $20–500. Shops, pumps and fines take carried cash only.
- **Rent:** Monday 06:00 takes $350 from the bank. With an empty bank you get a LANDLORD message, then $50 a day late fees; 14 days late you're evicted. Try it fast with the cheat console: `day 23` from a new game. The apartment door then refuses you; sleep and save at **St. Brine's Mission**, the chapel on Pewter Street next to the precinct (E SLEEP (SHELTER), Esc → SAVE GAME at its door). Move back in from the phone's BANK app ($550).
- **Trunk looting:** walk up to the rear bumper of any parked car: **E LOOT TRUNK**. Pick the lock (lockpicks from the bag make it easier), then click the glinting items before the 6 s run out. Cash is dirty; phones and watches wait in the bag (I) for the fence. Someone who sees you calls the police (1★).
- **Arrest effects:** get busted (`stars 1` and wait), and the arrest screen says the promotion is frozen. The next shift has an extra task; the JOB BOARD shows the freeze. HR on the phone (CONTACTS) lifts it for $600 or covers a missed shift for $150.
- **Bag (I):** use a first-aid kit; see lockpick uses, kits, stolen goods. **Repair kit:** E USE REPAIR KIT on a car under 50%.
- New cheats for testing: `bank N`, `item lockpicks 10` (also firstaid, repairkits, fuelcans, toolbox).

**Built:**
- `systems/finance.ts` (bank, statement, rent, late fees, eviction, moving back in), `systems/days.ts` (`runCalendar`: Monday rent and bonus, daily late fees and eviction, missed shifts at 10:00, the Sunday reminder), wired into the clock, sleep and jail time.
- `systems/career.ts`: arrest effects, missed shifts, HR cover, the week's pay and the clean-record bonus.
- The phone, the ATM and the bag: `scenes/ListScene.ts`, `ui/listPanel.ts`, `world/phone.ts`. Messages from people and services are kept (last 30). HUD messages now queue instead of replacing each other; key hints show P PHONE · I BAG.
- Trunk looting: `systems/loot.ts`, the search minigame (`SearchGame`, `drawSearch`), the LOOT TRUNK prompt at each car's rear (`trunkSpot`), lockpick wear (`wearLockpicks`), the toolbox's +3 s on the hotwire.
- The repair kit (`repairKit`), the evicted apartment door, the shelter zone at the chapel (`art/source/downtown_map.py` → `src/maps/downtown.json`).
- Autosave on clock-out and at 06:00 (docs/12); manual saves at the shelter.
- **Fix:** several witnesses of one crime raised the stars once each (three witnesses of a lockpick gave 3★). Now each crime raises its stars once (`reportCrime`).
- Save version 2 with its migration and test.
- Tests: 190 unit (new: finance, calendar, arrest effects, loot, search and list-panel layouts, the one-crime-one-report rule, new cheats), 17 e2e (new: ATM deposit and withdrawal, the phone's bank app, looting a trunk, eviction and the shelter). Screenshots in `docs/screenshots/phase2_m5/`.

**Assumptions (please review):**
- Pay and bonuses go to the bank; shops, pumps and fines use carried cash; rent, HR bribes and moving back in come from the bank. A fine bigger than your carried cash takes only what you carry.
- Rent is all or nothing; late fees start the day after it falls due; eviction 14 days after the first unpaid rent clears the debt.
- St. Brine's shelter is open to anyone at any time (not only when evicted). Saving there works at its door.
- The HR cover gives the 5 XP back but no pay, for misses in the last 7 days.
- The extra-work days run to the end of the second day after release; an arrest also loses a shift in progress (and, if before 10:00, the day counts as missed).
- Picking a trunk's lock unlocks the whole car. A trunk can be searched once; quitting the search with Esc leaves it unsearched.
- Lockpicks: 10 uses, a failure costs 2, the bare-hands pick still works (tier-0 dial). The toolbox is $120 (docs silent).
- A first-aid kit heals fully. A repair kit can't fix a wrecked car.
- Missing shifts during the jail days count as missed (docs/03: "missed shifts while jailed").

**Art debt:** none. The item and loot icons are pixel arrays in `src/ui/hudDraw.ts`, like the other icons; the shelter uses the existing chapel.

**Known issues:**
- The search panel can cover part of the car you're looting (panels sit beside the player, as before).
- The hardware store, the clothing store and the car dealer have no buildings yet (M6), so lockpicks, the toolbox and repair kits can only come from the cheat console or a trunk for now. The corner store sells the first-aid kit.
- The phone has no map, crew or properties apps yet (later phases).

## Handover (updated 2026-10-11, session 4) — read this first in a new session

**Where things stand**
- **Phases 0 and 1 are done and live** at `https://mock-10.github.io/greyhaven/`. Milestone 4 (saves, crowd and traffic, police 1–2★, arrests) was merged in PR #9 on 2026-10-11, which closed Phase 1.
- **Phase 2 (economy and careers) has started.** It is planned as four milestones, one PR each:
  - **M5, money and phone (done):** bank and ATMs, rent and eviction with a shelter, the phone (P), the bag (I), the full corner store, trunk looting, arrest effects on careers, and the clean-record bonus.
  - **M6, map growth and shops:**
    - the garage block, the house row with the depot, and the woods with Ashby Timber, all with **two-lane-each-way roads**;
    - clothing store, hardware store and car dealer (buildings, interiors, stock);
    - the character creator.
  - **M7, the three new jobs:**
    - mechanic, lumberjack and delivery, with their interiors and minigames;
    - the office stamp-and-sign and meeting tasks;
    - uniforms and lockers, rank perks.
  - **M8, the rest:** weekend odd jobs (car wash, bar shift), the guided first day, the econ sim re-run, and the phase close.
- **The Downtown map is a test map, not the final city.** The final city is a dense open world of about 320 × 320 tiles with a hood district, open fields and woods (docs/01, built in Phase 6).
- **Autopilot is on** (CLAUDE.md): I merge my own PRs once CI is green, carry on from phase to phase, and send a short note with screenshots at each milestone. Heist interiors still need your approval first.

**M5 (money and phone) is done** (see "Milestone 5" above). Next is **M6**: multi-lane roads first (below), then the garage block, the house row with the depot, the woods, the hardware and clothing stores, the car dealer, and the character creator.

**Making the streets wider (your request, 2026-10-11): not done yet, applies to all new streets**
- **Today:**
  - Downtown roads are 4 tiles wide (`HW = 2 * T` in `art/source/downtown_map.py`), one lane each way.
  - `lanes()` in `downtown_map.py` writes one lane per direction, and `systems/traffic.ts` and `world/streetLife.ts` assume a single lane per direction.
  - These stay as they are.
- **From now on:**
  - Every new road has at least **two lanes in each direction**, about 8 tiles of asphalt at 2 tiles per lane, plus sidewalks.
  - Before the M6 map growth:
    - give the map script a per-road lane count;
    - write one lane line per lane;
    - let traffic pick a lane on spawn (lane changes can wait);
    - draw lane dividers (dashed white between same-direction lanes, the centre line between directions).
  - Police routing (`systems/roads.ts`) works on road centrelines and should only need the wider half-width.

**Art debt**
- None in use. The new item icons are hand-placed pixel arrays in `src/ui/hudDraw.ts`, like the existing ones. When the bag gets a proper inventory grid (docs/11), consider moving them into an atlas made with `art/source/`.

**Known bugs and limits (carried over from Phase 1)**
- Traffic lights don't show their colour on the light sprites yet.
- The cruiser follows the roads but can clip kerbs and props at sharp turns; it backs up when stuck.
- Traffic drives straight along its road (no turns), doesn't stop for pedestrians, and pedestrians can't be hit yet.
- Save thumbnails are stored but not shown anywhere.
- The camera has no world bounds: panning can show the background past the map edge, within the 12-tile limit.
- Headless Chromium renders at about 12 fps, so e2e runs and screenshots are slow (real GPUs are fine). The bundle is about 1.3 MB (mostly Phaser).
- The parking garage's parked cars are simple shapes, readable only up close.

**Tweaks you asked for that aren't done yet**
- **Wider streets:** at least two lanes each way on every new street (above).
- **Remembered-room dimming (docs/19):** off until Phase 8, as you asked. `BALANCE.interiors.rememberedDimming = false`; the data is still recorded.
- **Idle and interact animations:** Phase 8.
- **Higher resolution / more pixels:** its own Phase 9, after Phase 8. Keep new art at today's scale until then.
- **The 320 × 320 city, the hood district and Marlo's move to Industrial:** Phase 6.
- **Done this session, for the record:**
  - the gas station canopy, kiosk and wider forecourt;
  - the bag-it laundering minigame;
  - Marlo's dotted spot and prices by car type;
  - the camera rework;
  - entrance outlines;
  - 12 new Downtown building types;
  - the precinct;
  - saves, crowd, traffic and police.

**Questions I still owe you**
- None are blocking. All earlier questions were answered in the 2026-10-11 round (recorded under "Decisions (question round of 2026-10-11)" in docs 00–18 and in CLAUDE.md).
- **Still to come from you:** the extras that aren't in the docs ("I'll tell you later").
- **Still needs your approval when we get there:** the heist interiors (jewellery store, bank) before they are built (Phases 3 and 7).
- **Worth a look now that M5 is playable:** its assumptions (bank and rent rules, the HR cover rule, the open shelter, the toolbox price).

**Answered decisions, in short (full text in the docs)**
- **Phase 1:**
  - Chop pay is 15–30% of value by car type, with an early cap.
  - The taxi and the van can be stolen.
  - Bag-it laundering has a timer, and dye-stained stacks must be left out.
  - Marlo: park in the dotted spot and press E; he walks over. Open 24 h.
  - Camera about 2× wider.
  - Precinct on the test map; arrests use a screen for now.
- **Phase 2:**
  - No bus or taxi.
  - The test map grows with the garage block, a street of houses with the depot, and woods.
  - Bank account with carried vs banked cash. Rent is auto-paid on Monday 06:00.
  - A shelter after eviction, where you can still save.
  - Your apartment has a parking spot where saved cars spawn.
  - Shops: corner store, clothing, hardware, car dealer.
  - Weekend odd jobs: car wash and a bar shift.
  - Uniforms are changed by hand.
  - Trunk looting moves forward for the first day.
  - Creator as specced.
  - Garage: bay + spray booth + office. Lumber: outdoor camp + site trailer. Delivery: depot + house row.
  - I write the meeting dialogue.
- **Later phases:**
  - Blood is allowed (no dismemberment).
  - Masks at the clothing store and the fence (a pawn shop with a new character).
  - The dealer works from a back-alley van.
  - Burglary: 3 layouts, sleeping owners, some alarms, occupancy read from the cars outside.
  - Rival crew: the Saltgate Union.
  - Hideouts: one big space with stations, plus locked rooms to buy.
  - The hood: hostile but no turf system.
  - Marlo moves to Industrial in Phase 6.
  - 10–15 enterable buildings Downtown.
  - All 6 story chain outlines in one doc.
  - Jewellery heist: 10 cases and a rooftop escape. Bank: 2 guards and a vault basement.
  - Fronts are full interiors.
  - Procedural sound effects; music is a mix of CC0 and procedural.
  - Higher resolution becomes Phase 9.

**Session notes for whoever picks this up**
- npm goes through the proxy. Before `npm`, `npx vite preview` or Playwright, set `export NO_PROXY=localhost,127.0.0.1 no_proxy=localhost,127.0.0.1 npm_config_noproxy=localhost,127.0.0.1`. Playwright uses the pre-installed Chromium (`/opt/pw-browsers`) with `--use-gl=angle --use-angle=swiftshader`; don't run `playwright install`.
- `npm run shots -- <names>` starts and stops its own preview server (presets in `tools/shots.ts`, with an optional `cheats: [...]`). **Never** use `pkill -f "vite preview"` or `pgrep -f`: they kill the calling shell. Find the PID with `ps -eo pid,args | grep "[n]ode.*vite preview"`.
- Foreground `sleep` is blocked in the container. Wait on a background job with an until-loop instead.
- Debug hook (`window.__DL__`, read-only): `dirty`, `stars`, `driving`, `cars` (with `looted`), `minigameState` (the open minigame's logic, so tests can play it like a person), `bank`, `rentOwed`, `evicted`, `health`, `inventory`, `listPage` (the open phone, ATM or bag page; refreshed after each action while the world is paused). Cheats are never read from the URL. The cheat console (Ctrl + Shift + F1) is how tests and screenshots set things up.
- Interior art pipeline: edit `art/source/rooms.py` → `python3 art/source/check_layout.py` (0 issues) → `python3 art/source/export_interiors.py` → commit `art/interiors/*`.
- City map pipeline, run in `art/source/`:
  1. Edit `downtown_map.py`, then run `python3 downtown_map.py --no-render` (writes `src/maps/downtown.json`).
  2. `python3 check_city.py` must report 0 issues.
  3. `python3 pack_city.py` adds new sprites to the city atlas.
  - Full drafts: `python3 downtown_map.py --procs 4` (about 4 minutes); delete `art/drafts/downtown/downtown_debug.png` afterwards (not committed).
  - The sprite cache (`art/source/cache/`) is keyed by name and not committed. After editing a model, delete `cache/bld__<name>*`. A fresh session renders the sprites once.
  - If `ground_vec.py` changes, re-run `python3 make_ground_fixture.py`.
- The map is 70 × 48 tiles; the drafts in `art/drafts/downtown/` are current.
- The simulation runs on `game.loop.rawDelta`, because Phaser's smoothed delta crawls in headless Chromium. In slow frames Phaser can hand the same key event over more than once; `MinigameScene` and `ListScene` ignore repeats (a `WeakSet` of handled events). `ListScene` also ignores keys for 300 ms after opening.
- The carjack e2e test plays the lockpick by polling the needle (`minigameState`) and pressing inside the good zone. Keep that pattern for new skill-check tests, because fixed timings are frame-rate dependent in CI.

## Phase 1 — Vertical slice (done 2026-10-11)

Decisions from the question round (2026-10-10) are recorded in docs/18 ("Answers"), docs/01 ("Names") and docs/16. Delivered in playable milestones, one PR each.

### Milestone 1: Downtown, player, clock, HUD (2026-10-10)
- [x] Downtown ("The Ledger") map, 48 × 48 tiles, with the approved names: Pellridge Tower and its plaza, Open Most Hours and its parking lot, a second lot on Millwright Road, Drizzle Row Residences, The Low Tide, Marlo's Tow & Salvage at the east edge. Overcast Avenue and Drizzle Row run east–west; Pewter Street and Millwright Road run north–south. Crosswalks, traffic lights and street signs at every crossing, lamps, benches, planters, hydrants, bins and trees along the sidewalks, parked cars in the lots, junk cars in Marlo's yard.
- [x] New exterior art made with `art/source/`: The Low Tide, Marlo's chop shop and Drizzle Row Residences (`env.py`), plus named versions of the tower and the store. Business names are drawn on the sign boards in the 3 × 5 pixel font, inside the model's material, so they read in every orientation. Every Phase 1 building has a `_night` variant with lit windows. Packed by `art/source/pack_phase1.py` into `art/buildings2.png/.json`.
- [x] Player: walk and sprint in 8 directions with a smoother 8-frame walk cycle (new in-between poses from `art/source/pack_steps.py`, `art/characters_steps.png/.json`), collision, footprint-aware depth, occlusion fade.
- [x] Interaction: everything usable within 1.5 tiles shows the idle gold rim; the one in front of you shows the hover rim and the prompt; **Tab** cycles; **E** uses. In this milestone: the plaza ATM and the five street doors.
- [x] Clock: the 20-minute day (setting stored for 15 / 20 / 30), Monday 07:00 start, darkness ramps at dawn and dusk, night tints from the style guide (objects, ground and usable objects separately), lit windows that ignore the tint, warm dithered lamp pools, a darker sky.
- [x] HUD drawn with the `hud.py` primitives at UI resolution and scaled by whole numbers: vitals panel, stars, day/clock/clean/dirty panel, radar (iso-oriented, buildings, home and shop blips, the arrow points where you face), objective line, phone messages (Ms. Hollis at the start, Dez at 17:30), street name and district when you enter a street, key hints. The F3 readout moved into the HUD.

### Milestone 1b: Downtown rework (your feedback, 2026-10-10; built 2026-10-11)
- [x] Question round and decisions recorded in the docs (2026-10-11).
- [x] Faster walking and sprinting (`BALANCE.walker`: 48 units/s, sprint 2.3×, walk cycle in step).
- [x] New street props made with `art/source` (`street.py`): bus shelter, newspaper boxes, phone booth, bike rack, café tables with an awning, kiosk, tree pits and grates, bollards, fences, straight and curved low walls, curved planters, wall posters, fountain, and alley clutter (pallets, pipes, AC units, crates, bins).
- [x] Infill buildings and shopfronts (`infill.py`: 10 shopfronts, 3 walk-ups, 3 mid-rise offices, a workshop), facades with signs, awnings and `_night` lit windows, every side dressed.
- [x] Ground material swatches from `ground2d.py` (asphalt, sidewalk, plaza paving and rings, cobbles, brick paving, lot, grass, dirt, painted markings) and the vector street format.
- [x] Downtown authored as one data file shared by the draft renderer and the game: tighter blocks, buildings fronting the sidewalk, infill and alleys, smaller lots edged with planters, fences or low walls, the curved Pellridge plaza and a bending street, rounded kerbs. Keeps the five buildings with doors, a lot of stealable cars, the chop shop at the edge, and room for police and traffic.
- [x] **Draft rendered (day and dusk) and approved by you before building it in the game.** Approved 2026-10-11 with one change: more greenery (lawns in courtyards and back yards, planting strips along Drizzle Row's residential stretch, a lawn behind the tower, a few corners), while staying mostly paved. `art/drafts/downtown/` holds the full map day and dusk and close-ups.
  - Draft pipeline: `art/source/downtown_map.py` (the map, writes `src/maps/downtown.json` and the drafts), `ground_vec.py` (swatches, rasterising, kerb faces), `citygeo.py` (curves and rounded blocks), `draft_city.py` (renderer with topological depth order), `check_city.py` (overlaps, buildings on roads, the 3 × 3 density rule: 0 issues).
- [x] Grass blades and tufts (your request, 2026-10-11): blade strokes in the grass texture; grass tufts, dry tufts and flowering weeds baked into the ground along lawn edges, in tree pits, at wall bases, along kerbs, in alleys and in the yard.
- [x] In game: vector ground baking (`src/iso/vectorGround.ts`, `vectorGroundRenderer.ts`), the new map, collision for turned wall and fence segments, the radar drawn from the new layout, topological depth order for dense streets (`src/iso/staticDepth.ts`).
- [x] Leftovers fixed on the way: camera world bounds (open since Phase 0), lamp pools and lit windows now reach full strength soon after they switch on.
- [x] Tests: the density rule, vector ground parity with the Python compositor, depth order, camera bounds, turned-box shadows, the new map's doors, lot and streets; smoke test updated (100 unit tests, 6 e2e).
- [x] Screenshots (day, dusk and night) compared with the reference scenes and the approved draft (`docs/screenshots/phase1_m1b/`), notes, PR.

### Milestone 1b notes
**How to try:** `https://mock-10.github.io/greyhaven/` after the PR is merged. Walk and sprint (Shift) around: it's faster now. Visit the fountain plaza in front of Pellridge Tower, Ledger Lane behind The Low Tide, the bend in Millwright Road past Marlo's, and the lawns and planting strips on Drizzle Row. Watch the street lamps come on at dusk (`?scene=world&time=19:45`). The camera now stops at the map edge. Overview: `?scene=world&zoom=1&x=768&y=768`.

**Built:**
- The test Downtown rebuilt as vector ground: rounded kerbs at every corner, the bending Millwright Road, the curved Pellridge plaza with ring paving, a fountain, curved planting beds and benches facing the fountain, a curved garden at the bend, Ledger Lane (cobbles, bollards), a smaller walled parking lot with 5 cars, Marlo's yard behind a chain-link fence along the curve.
- 17 infill buildings close the gaps; all five Phase 1 entrances still face the camera; the five doors work as before.
- About 470 objects (street furniture, alley clutter, trees in grates, walls, fences, hedges), about 850 grass tufts and weeds, lane markings, crosswalks, stop lines, drains, manholes and puddles, paving variety (cracked slabs, brick, cobbles, terrazzo, plaza slabs, gravel).
- The map, its drafts and the game share one data file. A checker and a unit test enforce the density rule.

**Assumptions (please review):**
- Infill shop signs use plain trade words (DELI, PAWN, BARBER, NOODLES, PHARMACY, BOOKS, CAFE, TAILOR, HARDWARE, BAKERY, NEWS) rather than new business names, so no new names needed approval.
- Buildings across a street from the camera show their dressed backs (windows, fire escapes, back doors), the usual isometric trade-off.
- Wall, fence and bed segments are drawn at 16 directions (22.5° steps), so very tight curves look slightly stepped up close.
- Road centre lines stay gold, as in the approved reference scene, even though gold is otherwise reserved.

**Art debt:** none. Everything was generated with `art/source/`.

**Known issues:**
- A tree crown fades when you stand just behind or beside its trunk (the occlusion fade working as designed, but it can look early).
- The bundle grew to about 1.6 MB of JS (the map data is about 280 KB of it) and 0.8 MB of ground swatches. Still well under the 5 s load target.
- No pedestrians or traffic yet (milestone 4), parked cars can't be used yet (milestone 3).

### Milestone 2: interiors and the office job
- [x] Drafts approved (2026-10-10, after one revision: a bigger back room for Dez with laundering clutter, and fixes from the new layout checker): `interior_tower_lobby.png`, `interior_office_floor.png`, `interior_bar.png`.
- [x] Export of the approved drafts into game-ready sprites and geometry (`art/source/export_interiors.py` → `art/interiors/`). *On the WIP branch.*
- [x] Sight rules as tested logic (`src/systems/sight.ts`). *On the WIP branch, not drawn in game yet.*
- [x] Interior definitions: hours, door rules, prompt actions, NPC schedules (`src/data/interiors.ts`). *On the WIP branch.*
- [x] Career logic for the office job: clock-in window, late pay, pay, XP, promotion bonus, key card (`src/systems/career.ts`, `src/data/jobs.ts`). *On the WIP branch.*
- [x] Filing and data-entry minigame rules (`src/minigames/logic.ts`). *On the WIP branch, no on-screen panel yet.*
- [x] Movement fixes from the 1b playtest: the same screen speed in every direction; small props (bollards, hydrants, lamp posts, meters, bins) collide with a smaller circle and round props push you aside instead of stopping you (`src/systems/movement.ts`).
- [x] Minigame overlay scene (`src/scenes/MinigameScene.ts`), matching the lockpick mockup: filing (drag a paper into its tray or press 1–3; FILED / WRONG stamps), data entry, and the shop menu. Job tasks and menus pause the world.
- [x] Interiors in the street scene (`src/world/interiorModel.ts`, `interiorView.ts`): fade in and out, opening hours on street doors, key card after hours at the tower, Marlo's "COME BACK WITH A CAR", collision, doors with OPEN / CLOSE prompts and red locked labels, the elevator between the lobby and floor 4, NPCs by their hours.
- [x] Sight (docs/19): dithered lids over unseen rooms, remembered rooms dimmed with ghosts of the people last seen there, back walls darkened above rooms out of sight, 150 ms fades, remembered rooms kept in the game state, the sight-lines setting (key L until the settings menu exists, `?sight=0`).
- [x] Office Worker job: clock in with Ms. Hollis, 3 filing / data-entry tasks, clock out for pay, XP and promotions (rank 2 brings the key card), objective lines and phone messages.
- [x] Sleep at the apartment: skip to 06:00 the next day.
- [x] Corner store basics: chips, sandwich (heal), fuel can, clean cash only.
- [x] Tests (114 unit, 9 e2e), screenshots in `docs/screenshots/phase1_m2/`, notes, PR.

### Milestone 2 notes (merged in PR #5)
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

**How to try:** walk to Pellridge Tower after 08:00 (`?scene=world&time=08:00`), press E at the door, take the elevator up, clock in with Ms. Hollis in the back-right office, do three tasks at the filing cabinets or your desk, then clock out. The corner store sells snacks and a fuel can (counter: SHOP). Dez's back room at The Low Tide opens at 18:00. Sleep in your apartment at Drizzle Row Residences. Press L to switch sight lines off and on. Debug: `?scene=world&area=office_floor&time=08:30` starts inside.

**Assumptions (please review):**
- Doors with no lock start open (Ms. Hollis's office door); locked and staff doors start closed. Doors don't remember their state after you leave.
- Food from the store is eaten on the spot (no inventory screen yet); the fuel can is carried for milestone 3.
- Quitting a job task with Esc doesn't count as a task (no grade, no penalty).
- While sight lines are on, objects in rooms you can't see can't be used.
- The sight-lines toggle sits on key L until the settings menu exists.

**Art debt:** none.

**Known issues:**
- Camera fades are slow in headless Chromium (the e2e tests wait for them); real browsers are fine.
- No save yet (milestone 4): sleeping says so.

### Milestone 3: driving and the carjack loop (built 2026-10-11, pushed to `main`)
- [x] One sedan with arcade handling, fuel and basic damage; enter and exit (F).
- [x] Carjacking a parked car: lockpick and hotwire minigames; sell it at the chop shop for dirty money; launder at Dez's.
- [x] Fuel station (your request): Pump & Go on Millwright Road with two pumps (REFUEL, clean cash, $3 a unit), the jerry can from the store works on foot (E USE FUEL CAN).
- [x] UI fixes (your request): remembered-room dimming put on hold; filing panel re-laid out (no overlapping text); shop redesigned as item cards with icons (soda can, chips, sandwich, fuel can); every pop-up panel draggable by its top strip; an automatic overlap check for every panel and the HUD.
- [x] Tests (134 unit, 10 e2e including a full lockpick → hotwire → drive run), screenshots in `docs/screenshots/phase1_m3/`, notes.
- [x] Follow-ups from your review (answers of 2026-10-11 in the docs), built 2026-10-11 (milestone 3b, see the notes below):
  - [x] Gas station moved to a bigger lot; tall canopy you can drive under that fades when you're under it; kiosk facing the forecourt; Downtown drafts re-rendered.
  - [x] Duffel minigame replaces the money count: drag stacks into the bag before the timer runs out; leave dye-stained stacks out.
  - [x] Marlo's yard with a white dotted sale spot: park, press E, Marlo walks up. Open 24 h.
  - [x] Chop pay by car type: 15–30% of value, scaled by damage, at an early rate with a $600 cap. The taxi and the van are stealable, each with its own stats.
  - [x] Camera rework: about 2× wider default view, one zoom step out when driving, velocity look-ahead, critically damped follow, a silhouette through buildings plus fade of whatever covers you, car-vs-car sorting by turned footprints. docs/11 updated, screenshots taken.
  - [x] Handover leftovers: key hints on a plate, prompts kept clear of HUD panels, tree crowns fading too early (fixed by pixel-accurate occlusion).
  - [x] Brought forward from milestone 4: the cheat console (Ctrl + Shift + F1, on Pages too).

### Milestone 3 notes
**How to try:** walk to the parking lot behind Open Most Hours (`?scene=world&x=841&y=184`). Stand by a sedan: **E LOCKPICK** opens the dial (space when the needle is in the zone). Then **F** hotwires it (press a wire 1–4, then its colour A/S/D/F). Drive with **W/S** (throttle and brake or reverse), **A/D** to steer, **Space** for the handbrake, **F** to get out (below walking pace). Fill up at **Pump & Go** in the south-east (E REFUEL beside a pump). Drive to **Marlo's Tow & Salvage** on Drizzle Row: **E SELL CAR TO MARLO** pays dirty cash. After 18:00, take it to Dez in the back room of **The Low Tide** (E LAUNDER, then count the bills: space counts, B bands each 10). Panels can be dragged by their top strip.

**Built:**
- `src/systems/vehicle.ts`: the car model (heading, speed, fuel, health, locked, running, hot until, wrecked), arcade driving with steering that tightens at low speed and flips in reverse, handbrake, collision against the street and other cars (slides along walls on glancing hits, bounces on head-on hits, damage by impact speed, limping below 25%, wrecked at 0), refuel, fuel can, chop price, exit spots.
- `src/systems/laundering.ts`: Dez's 35% cut plus the money-count penalty, the $1,500 daily cap.
- In the world: the 3 sedans in the store lot are real cars with moving shadows, depth among the static objects, the gold rim and prompts (LOCKPICK, HOTWIRE, GET IN, USE FUEL CAN, WRECKED). The camera leads ahead of the car by up to 3 tiles. Tall things in front of the car fade. Pumps and Marlo's door can be used from the driver's seat.
- New HUD car readout (fuel, condition, speed) and driving key hints.
- Minigame panels: lockpick dial (matches the mockup), hotwire wires, money count, shop cards with item icons, all in `src/ui/panels.ts` (pure code, layout-tested) and draggable in `MinigameScene`.
- New art made with `art/source/`: `gas_pump` (street.py), `fuel_canopy` and `fuel_kiosk` with night variants (infill.py), item icons (hud.py).

**Assumptions (please review):**
- Lockpicking a parked car is tier 0 and needs no tool (docs/04 tier 0). A failed pick sets off the alarm 30% of the time (docs/05); until the police exist (milestone 4) the alarm is only a phone message. Otherwise you can try again.
- A failed hotwire only costs the attempt (sparks); you can try again. A hotwired car stays running.
- Crime minigames pause the world, like job tasks, until the police arrive in milestone 4.
- F gets into the nearest unlocked car within 40 units. You can only get out below 40 units/s, beside the doors first.
- E on an unlocked car pours a fuel can when you have one and the tank has room for 10 units; otherwise the prompt is F GET IN.
- A pump fills as much as the tank takes and your clean cash allows (no amount choice). Pumps reach a car within 64 units; Marlo buys a stolen car within 96 units of his door, while you drive it or parked there.
- Chop price: $150–400 (docs/04) times a condition factor of 40%–100%. The car is removed after the sale.
- Laundering washes all your dirty cash up to the day's remaining cap in one count. Extra cut by grade: excellent 0, good 2%, OK 5%, poor 10%, fail 15%. Quitting with Esc washes nothing.
- Bumps under 40 units/s do no damage; glancing hits slide along walls.
- Parked cars start with 35% fuel. Stolen cars are marked hot for 2 days (used by the police in milestone 4).
- Keys pressed in a panel are ignored by the world for 300 ms after it closes (the hotwire's F terminal would otherwise also get you out of the car).
- Soda added to the store ($3, +5 HP) so the shop has four cards.

**Art debt:** none. All new art was generated with `art/source/`. (The gas station canopy and kiosk need a rework, see the follow-ups.)

**Known issues:**
- **Gas station:** the canopy roof is too low and clips into the car; the kiosk faces away from the pumps; the forecourt is cramped against the south map edge, so a car parked at the pumps can hide one of them. (Follow-ups 1–2.)
- The money count is to be replaced (follow-up 3). Before the fix this session, fast key presses in slow frames could count several times; that is fixed.
- No smoke below 50%, no fire below 25% and no explosion at 0 health yet (docs/08); a wrecked car just stops and stays.
- The car alarm and the hot status have no effect until the police exist (milestone 4).
- Cars, the car you drive and the day's laundering live in the game state (`vehicles`, `driving`, `laundered`), but there are no saves yet (milestone 4). SAVE_VERSION starts with milestone 4, so no migration was needed.
- Only the 3 sedans can be stolen; the lot's taxi and van and Marlo's junk cars are props (see the questions).
- The key-hint labels at the bottom right are hard to read over light pavement (muted text without a plate).
- World prompts near the screen edge can sit under a HUD panel.
- The `art/drafts/downtown/` drafts don't show the gas station yet.

### Milestone 3b notes (the follow-ups, 2026-10-11)
**How to try:** `https://mock-10.github.io/greyhaven/` once the PR is merged.
- **Pump & Go** moved to the south-east corner, between Millwright Road and the new street **Gullsway**: drive in from either side, stop beside the pump island under the tall canopy, press E. The roof fades as you get close; the kiosk at the back faces the pumps.
- **Marlo:** drive a stolen car through the gate on Gullsway into the white dotted spot beside his shop, stop, and press E (also from the driver's seat). Marlo walks out of his side door and pays. Knocking on his front door tells you where to park.
- **Stealable:** the three sedans, the taxi and the white van in the store lot. Each type drives differently (the van is slower and heavier) and pays differently.
- **Dez:** after 18:00 with dirty cash, LAUNDER opens *Bag it*: drag the clean stacks into the duffel; leave the red-dyed ones on the table.
- **Camera:** 1080p now shows 2× more of the city. Get in a car: the view steps out one level and leads ahead of you. Walk behind the tower or a tree: whatever hides you fades, and your hidden parts show as a lavender silhouette. Ctrl + wheel still zooms 1×–4×.
- **Cheat console:** Ctrl + Shift + F1, then e.g. `dirty 800`, `time 18:30`, `car taxi`, `tp 1600 1000`, `rank 2`, `help`. Esc closes it.

**Built:**
- Map: the test map is now 64 × 48 tiles. Gullsway runs along the east side, with a sidewalk and a grass embankment and fence on the far side (the town's edge toward The Works), a bus shelter, more shops (DELI, TAILOR) and walk-ups in the north-east block. Map tools (`check_city.py`, `draft_city.py`) handle non-square maps.
- New art from `art/source/infill.py`: the canopy roof (`fuel_canopy`, now an overhead object with roof seams and vents) and `canopy_post`. Drafts re-rendered (`art/drafts/downtown/`), city atlas repacked.
- Overhead objects: a placement flag `over` that sorts a roof after anything standing under it (`staticDepth.ts`, `draft_city.py`).
- Map zones: Marlo's spot is a `zone` in the map data with where Marlo comes out; `parkedIn()` tests whether a car is stopped in it.
- Vehicle types (`BALANCE.vehicles.types`, `src/data/vehicles.ts`): sedan, taxi and van stats, the HUD car readout shows the type.
- The duffel minigame (`DuffelGame`, `drawDuffel`), the cheat console (`src/debug/cheats.ts`, `cheatConsole.ts`).
- Camera: `springStep`, `offsetZoom`, context zoom and pointer look-ahead in `CameraController`; pixel coverage (`coverage()`, `opaqueAt()`), the silhouette (`src/world/silhouette.ts`), turned-box ordering for movers (`obbFirst()`, `orderMovers()`).
- Tests: 149 unit (car types and chop pay, the duffel, the cheat parser, the spring and zoom maths, pixel coverage, turned-box order, the new map: Gullsway, Marlo's spot in plain view, the overhead canopy), 11 e2e including selling a car to Marlo. Screenshots in `docs/screenshots/phase1_m3b/`.

**Assumptions (please review):**
- Chop pay: value × 15–30% (rolled) × condition (40–100%); below reputation tier 2 Marlo pays 35% of that, capped at $600. Sedan ($5,000) about $263–525, taxi ($4,500, no docs price) a bit less, van ($9,000) mostly the $600 cap. The econ sim's tier-0 night income (about $400) still holds, so the pacing table didn't change.
- Van stats from docs/08 scaled like the sedan (top speed 70 → 198 units/s, health 140, tank 60); the taxi drives like a sedan.
- Marlo uses the road-worker sprite (work clothes and a vest) until the story characters get their own art.
- The sale spot is beside Marlo's shop rather than strictly behind it: in this view the area behind a building is hidden by it, so the spot faces the camera, fenced off from the rest of the yard with its own gate on Gullsway.
- Bag it: 8 stacks, 2 dye-stained, 14 seconds. A dyed stack in the bag counts against the grade, as do clean stacks left behind. The grade adds to Dez's cut as the money count did (excellent 0% … fail 15%).
- On foot the camera leans up to 40 art px toward the mouse. Driving at 1080p shows the city at 1× (a wide view).
- The cheat console accepts CASH, DIRTY, TIME, DAY, RANK, TP, CAR, HEAL and HELP. Stars come with the police in milestone 4.

**Art debt:** none. All new art was generated with `art/source/`.

**Known issues:**
- The silhouette needs WebGL; on the Canvas fallback only the fade shows.
- The canopy roof also fades when you stand just behind it, not only under it (it covers you on screen there).
- The money-count minigame is kept for counterfeit printing (Phase 5) but no longer used.

### Milestone 3c: city variety, a wider gas station, entrance outlines (your requests, 2026-10-11)
- [x] At least 10 new, diverse buildings: 12 made with `art/source/infill2.py` (diner, cinema, chapel, art-deco office, glass tower, brownstones, parking garage, hotel, library, fire station, round-cornered corner block, flower shop), each with a lit-window night variant, placed in place of repeated walk-ups and mid-rises.
- [x] A wider Pump & Go: Gullsway moved 5 tiles east (map 70 × 48); two pump islands with four pumps under one wide canopy, a lane each side of each island; parking bays and an air post east of the canopy.
- [x] Enterable buildings marked with a subtle gold outline (faint near the door, bright when the door is targeted).
- [x] Tests (150 unit, 11 e2e), drafts re-rendered, screenshots in `docs/screenshots/phase1_m3c/`.

**How to try:** walk Downtown: the cinema, the diner and the flower shop on Overcast Avenue, the round-cornered block and the glass tower at Gullsway, the hotel on Ledger Lane, the library on Drizzle Row, the chapel on Pewter Street, the brownstones by the plaza, the parking garage and fire station south of Drizzle Row. Walk up to The Low Tide or Open Most Hours: a thin gold edge appears around the building. Drive into Pump & Go: four pumps now, room for a car at each.

**Assumptions (please review):**
- The new buildings are facades (not enterable), like the other infill. Their signs use plain words (DINER, CINEMA, NOW SHOWING, HOTEL, LIBRARY, FIRE STATION, FLOWERS, P), so no new names needed approval.
- Buildings across a street still show their backs (the fire station and parking garage face Drizzle Row, so you see their backs from the south).
- The outline is gold, the interactable colour; the door hotspot keeps its prompt as before. Marlo's shop is outlined too (its door talks).

**Art debt:** none.

**Known issues:**
- The parking garage's parked cars are simple shapes, readable only up close.

### Milestone 4: police, saves, crowd
- [x] A small Greyhaven PD precinct on the test map (Pewter Street, new art in `infill2.py`).
- [x] Wanted 1–2★: witnesses with the call delay, one police car and officers from the precinct, search circle, escape timer, arrest with surrender, fine, first-offense rule, arrest screen.
- [x] Saves: 3 slots, autosave on sleep, export and import, SAVE_VERSION and migrations. A parking spot outside Drizzle Row where your last car waits after a load.
- [x] Cheat console behind a hidden key combo, on Pages too (built early, in milestone 3b).
- [x] Pedestrians and ambient traffic (sidewalk paths, lanes, traffic lights).
- [x] **Done when:** a full day loop can be played (work → evening carjack → escape or arrest → launder → sleep → reload the save), all unit tests pass (171), the e2e tests pass (13, including save/load and a police bust).

### Milestone 4 notes (2026-10-11) — Phase 1 is complete
**How to try:**
- **Saves:** go home (Drizzle Row Residences), press Esc → SAVE GAME → a slot. Sleep for an autosave. Esc → LOAD GAME anywhere. EXPORT downloads a backup file; IMPORT reads one back into a slot.
- **The crowd and traffic:** people walk every sidewalk and cross at the corners; cars drive both ways on every road and stop at red lights.
- **Police:** lockpick a car where people can see you: they run and phone (walk up and press E to SCARE OFF a caller). After 6–10 s you get a star; a cruiser comes from Precinct 1 on Pewter Street. Out of sight the stars flash and the radar shows the search circle; stay outside it to lose them. If an officer reaches you, press Y to surrender or run. A first arrest costs the fine; a second within 14 days means jail and losing your dirty cash.
- Cheat console: `stars 2` to call the police at once.

**Built:** `src/core/save.ts` and `storage.ts` (saves), `src/scenes/MenuScene.ts` and `src/ui/menus.ts` (pause menu, arrest notice), `src/systems/crowd.ts`, `traffic.ts`, `paths.ts`, `roads.ts`, `wanted.ts`, `src/world/streetLife.ts` and `police.ts`, map data for sidewalk paths, lanes, crossings and zones (`downtown_map.py`), the precinct model, the HUD's flashing stars, search circle, police blips and surrender hint.

**Assumptions (please review):**
- One cruiser and two officers at both 1★ and 2★ (the roadmap's "one police car plus officers"); no shooting until Phase 4.
- A first-offense arrest takes an in-game hour; jail ends at 06:00 after the jail days. A fine bigger than your clean cash takes what you have.
- The stolen car you're in when arrested is impounded (gone).
- Witnesses only matter for crimes they can see within 10 tiles (7.5 at night) with no building in between; scaring one off doesn't add a star in Phase 1 (nobody else sees it).
- Traffic drives straight along its road (no turns yet) and doesn't stop for pedestrians; pedestrians step out of the way of fast cars but can't be hit yet.
- Crime minigames (lockpick, hotwire) no longer pause the world, as docs/06 says; job tasks, shops and menus still do.
- Saving is in the pause menu while you're in the apartment (the docs' "the bed or the phone": the phone comes in Phase 2).

**Art debt:** none. The precinct was made with `art/source/infill2.py`.

**Known issues:**
- Traffic lights don't show their colour on the light sprites yet.
- The cruiser follows the roads but can clip kerbs and props at sharp turns; it backs up when stuck.
- The thumbnail in a save isn't shown anywhere yet.

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
