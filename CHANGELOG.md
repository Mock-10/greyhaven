# Changelog

Track each phase from docs/15_roadmap.md here. Tick a phase only when its "Done when" checks pass.

- [x] Phase 0 — Foundations
- [x] Phase 1 — Vertical slice
- [x] Phase 2 — Economy and careers
- [x] Phase 3 — Crime breadth and police
- [x] Phase 4 — Combat and vehicles
- [ ] Phase 5 — Property, hideouts, operations, crews
- [ ] Phase 6 — Full town
- [ ] Phase 7 — Late game
- [ ] Phase 8 — Polish

<!-- Per phase: Built / How to try / Assumptions / Art debt / Known issues -->

## START HERE (cold start for a new session)
**Phase 5 (property, hideouts, operations, crews) is in progress.** M15 (PR #29) and M16 (PR #30) are merged. M17a (crews and Saltgate Union hits, save v11) is on `claude/p5-crew` (PR "Phase 5 M17a"). Next: **M17b: the lab, smuggling, drivers, airdrops, shipment ambushes**, which waits on the user's answer about the Docks and the Outskirts.

**First command:**
```
export NO_PROXY=localhost,127.0.0.1 no_proxy=localhost,127.0.0.1 npm_config_noproxy=localhost,127.0.0.1
git fetch origin && git checkout main && git pull origin main && npm install && npx tsc --noEmit
```

**Read only these, nothing else:** `CLAUDE.md`, this section, the "Phase 5" checklist below, `docs/09_property_hideouts_crews.md` (Operations, Crews, "Phase 5 build"). Use `grep -n` to find spots in `WorldScene.ts`; don't read it whole.

**Next steps, in order:**
1. If the M17a PR isn't merged: check its CI, merge when green. Then branch from main.
2. **M17b, once the user has answered** where the Docks supplier and the Outskirts airdrop fields go before Phase 6 (stand-ins on the current map, the full town first, or wait): the product lab (`ready: false` in `src/data/property.ts`; a station with `needs='lab'` in `art/source/rooms_property.py`; abstract product, docs/00), smuggling in 3 tiers (the hidden compartment's cargo cut), drivers at the bar, airdrops, shipment ambushes (`systems/rivals.ts`).
3. Close Phase 5 (econ sim, docs, e2e, screenshots, tick, PR, merge, note).

**Paste-ready resume prompt:**
> Resume Double Life. Read CLAUDE.md, then only the "START HERE" section at the top of CHANGELOG.md on main, and follow its numbered steps in order. Read only the files each step names. Keep token use low: no side threads, no re-reading big docs, e2e and screenshots only at the end of the milestone. Commit and push WIP before stopping.

## Handover (updated 2026-10-12, session 6, stopped mid-M8 at the user's request) — read this first in a new session
This is the only handover section. The user stopped all work on 2026-10-12 (05:48 UTC) and asked for this handover; nothing is running.

### Token budget (user, 2026-10-12)
The usage limit was hit. **No more side threads:** the main thread finishes everything itself, lean. Read only the files a step needs (this section, the checklist, the one doc a step touches), don't re-read big docs or whole scenes, and keep browser/e2e runs to the end of a milestone.

### Where we are
- **Phases 0 and 1 are done and live** at https://mock-10.github.io/greyhaven/.
- **Phase 2 (economy and careers):** M5 (#10), the UI redesign (#11), M6a (#12), M6b (#13) and **M7, the three new jobs (#22)** are merged on main. **M8 was stopped midway** on `claude/p2-map-shops-do5oew`.
- **Autopilot is on** (CLAUDE.md): merge my own PR when CI is green, carry on, a short note with screenshots per milestone; heist interiors still need approval.

### What changed this session
- **M7 merged (#22):** mechanic, lumberjack and delivery jobs, 12 job minigames wired, uniforms and lockers, perks page, office expense discount, save v4. See "Milestone 7" below.
- **Progress reel** republished with M6b, M7, the odd-jobs panels and the Phase 4 art: https://claude.ai/artifact/RRSp1Gt5LucfCh6BZttAoX (shots in `/mnt/project-files/progress/`).
- **M8 on `claude/p2-map-shops-do5oew`** (not merged, no PR yet):
  - `art/source/suburb.py`: new `car_wash` building (Squeaky's Car Wash: wash tunnel with roller brushes, pay office, sign, roof bubbles). Rendered into `art/city.*`.
  - `downtown_map.py` / `src/maps/downtown.json`: the car wash stands in the former yard east of Torque & Sons, with a wash apron, a waiting dirty car and a `gig_carWash` zone (with an `npc` point). `check_city.py`: 0 issues.
  - `rooms.py` / `art/interiors/bar.json`: The Low Tide's beer taps carry the prompt `BAR SHIFT` (no interior action wired yet).
  - `BALANCE.oddJobs` (folds in `balanceOdd.ts`) and `BALANCE.onboarding.tipAt` (17:00).
  - Guided first day logic: `src/data/onboarding.ts` (8 steps, hints, Dez's tip text) and `src/systems/onboarding.ts` (step machine, later events skip ahead, trunk step waits for the evening tip, skip). Tests in `tests/onboarding.test.ts`.
  - Save v5: `oddJobs` and `onboarding` in the game state; migration 4 → 5 (no gig, guide counts as done for old saves) with a test. Unit tests for save and onboarding pass.

### Stopped midway (finish these first)
1. **WIP commit `1d83db7`, NOT type-checked:** it merges the animation branch (`claude/polish-anim-6zvc8q`, PR #23) into this branch, and starts the car wash / bar shift hookup in `src/scenes/MinigameScene.ts` (request kinds, sizes, init, keys, clicks, held-key sponge movement, drawing). Still missing there: `onMove` should call `aimSponge` while the pointer is held on the car wash (next to the respray line). Run `npx tsc --noEmit`, `npm run lint` and `npm test` first.
2. **PR #23 (animation pass)** was open with CI still running; not merged. Merge it once green (it touches BootScene, WorldScene, HudScene, ListScene, MenuScene, MinigameScene). This branch already contains it, so after #23 merges, merging main here is trivial.
3. **WorldScene, not started:** the `gig_carWash` street prompt and a `{kind: 'gig', gig: 'barShift'}` interior action at the bar's taps → `startGig`, one minigame per task (`TASK n/N`), `recordGigTask`, `finishGig(rank)` pays to the bank, tips as carried clean cash (not counted toward the clean-record bonus), `quitGig` pays nothing; objective lines; optional `drawGigPay` panel. The phone's JOB BOARD should list the gigs (`openGigs`).
4. **Guided first day in the game, not started:** call `onboardEvent` from WorldScene (leaving the apartment, opening the job board, clock in, clock out, a shop buy, a trunk loot, stars at 0, sleep), send `DEZ_TIP` as a phone message when `tipDue`, show `onboardHint` on the objective strip with `F2: SKIP THE GUIDE`, and start new games at step 0 (the creator's START THE DAY).
5. **Then the phase close:** `python3 tools/econ_sim.py` (odd jobs add weekend income), docs/02 pacing table, docs/02/03/11 notes for M8, tick Phase 2, e2e test for a gig, screenshots, PR, merge.

### Leftovers from PR #23 (animation pass, from its thread)
- Carry-while-walking for delivery (`hold('carry')` plus the carry cycle while moving).
- The rain gameplay effects from docs/01 (sight −25%, grip −10%) and a wet tint.
- Close animations (only opening animates now).
- Docs: an "Effects" note in docs/13, a "UI animation" note in docs/11, and its CHANGELOG entry.
- Interiors: call `fx.setLayers` when a saved game loads inside an interior.
- Its e2e run was stopped before finishing; run the full e2e after merging.

### Side-thread pieces merged to main but not wired (do each in its phase)
- **#14 job interiors, #15 job minigames:** wired in M7 (done).
- **#21 odd jobs** (M8, above).
- **#20 Phase 4 art:** `art/vehicles2.*`, `art/effects.*` (sources `cars2.py`, `effects.py`). Add to `manifest.ts`; rows have their own cell sizes (use each frame's rect); helicopter = shadow at ground point, body lifted by altitude, `helicopter_rotor/f0-f3` at body anchor + `mounts.helicopter_rotor[dir]`; `effects.json` has an `anims` table (frames, fps, loop, ADD blend, anchors). docs/13 text is in the PR description. (#23 already uses some of the effects atlas.)
- **#19 sound effects** (`src/audio/*`): wire to events and the settings volumes.
- **#18 crime logic** (Phase 3): robbery, burglary, ATM crime, reputation; needs a crime state and a save bump.
- **#17 police logic** (Phase 3): response table, identification, jail.
- **#16 combat logic** (Phase 4): weapons and combat.
- Each PR description lists its integration steps and the assumptions to record; fold its balance file into `balance.ts` and its doc notes into the docs when wiring it.

### Assumptions in this session's work (please review)
- **Odd jobs (#21):** 60% of the current job's rank pay; tips 0/5/10/20% by the typical grade; Saturday and Sunday only; car wash 09:00–16:00, bar 16:00–22:00; each gig once a day; quitting pays nothing; pay to the bank, tips in carried clean cash.
- **Squeaky's Car Wash** sits next to Torque & Sons (it was an empty yard); the gig is played at a dirty car on its apron. The bar shift starts at The Low Tide's taps.
- **Guided first day:** a later event finishes earlier steps (a player who clocks in first skips the job board step); Dez's tip arrives by phone at 17:00 once the shopping step is done; F2 skips the guide; old saves count it as done.

### What's left in Phase 2
- Nothing: M8 closed the phase (session 7, 2026-10-12). PR #23 (animation pass) was merged first.

### Bugs and known issues
- **Traffic:**
  - Traffic lights don't show their colour on the light sprites.
  - The police cruiser follows the roads but can clip kerbs and props at sharp turns; it backs up when stuck.
  - Traffic doesn't stop for pedestrians, and pedestrians can't be hit yet.
  - Traffic only turns right (no left turns or lane changes yet).
  - Where two lane routes overlap at a junction, cars can stack on each other.
- **UI:**
  - Save thumbnails are stored but not shown anywhere.
  - The camera has no world bounds: panning can show the background past the map edge.
  - At 720p the open phone covers the cash panel (the world is paused while it's open).
  - The title, the phone and the minigame panels assume the HUD's UI scale (2× at 720p, 3× at 1080p).
- **Doors:** a door added to the map without an interior falls back to Marlo's chop-shop message.
- **Jobs (M7):**
  - The delivery stops are walked or driven to in your own car; the depot's van stays parked (borrowing work vehicles comes with the truck licence perk, Phase 5).
  - The doorstep task's house numbers are its own strip of houses, not the Linden Avenue numbers; the world shows the two stops as radar marks.
  - Haul (the log truck to the mill) waits for the mill (Phase 6).
  - The minigame accessibility assists are not hooked up to job tasks (Phase 8).
- **Shops:** a car bought at the lot waits in the pickup bay; while a car stands in the bay the desk asks you to move it first.
- **Tests and tooling:**
  - Headless Chromium runs at about 12 fps, so e2e runs and screenshots are slow (real GPUs are fine).
  - The trunk e2e test was flaky before its fix in PR #10 (a race on the E key); watch it in CI.
  - Headless Chromium can drop to a few frames a second on the 70 × 96 map; scene tweens (Marlo's walk) then crawl, so e2e waits are generous.
- **Map art:**
  - The parking garage's parked cars are simple shapes, readable only up close.
  - The map drafts were stale (70 × 48) until this session; they are now re-rendered on the branch, but main still has the old ones until M6a merges.

### Your requests and where they stand
- **Wider streets, two lanes each way on every new street:** done on `claude/p2-map-shops` (Hedgerow Way, Ashby Road, Linden Avenue), in PR #12; not merged yet. The rule is permanent and is written in docs/01 ("Street width") and CLAUDE.md rule 7. The existing Downtown streets stay one lane each way, as you said.
- **Full CHANGELOG handovers:** done (this section).
- **Resume instructions for a new session:** done ("The exact next step" above).
- **UI redesign (better graphics, larger text, more pictures):** done, merged in PR #11. The spec is permanent in docs/11 ("UI redesign"), docs/13 and CLAUDE.md step 7.
- **"Stop real quick":** done. I stopped the background render and e2e run. The render had in fact finished, and its drafts are committed on the branch.
- **Not done yet, from earlier sessions:**
  - **Remembered-room dimming (docs/19):** off until Phase 8, as you asked (`BALANCE.interiors.rememberedDimming = false`).
  - **Idle and interact animations:** Phase 8.
  - **Higher resolution:** its own Phase 9, after Phase 8. New art stays at today's scale until then.
  - **The 320 × 320 city, the hood district and Marlo's move to Industrial:** Phase 6.

### Decisions and assumptions (please review)
They are recorded in docs 01, 02, 08 and 11.
- **Map:**
  - The test map is now 70 × 96 tiles; Downtown keeps the north 70 × 48.
  - The street of houses is named **Linden Avenue** (needs your OK). The new boulevard is Hedgerow Way.
  - **Ashby Road continues Millwright Road** south from Hedgerow Way.
  - **District areas:** everything south of Hedgerow Way is Hedgerow Park, except east of Ashby Road, which is Far Acres (the timber yard). The HUD's district name follows them.
  - **The depot faces Linden Avenue**, at the east end of the house row, behind a loading apron.
- **Traffic:** routes only turn right for now, and Millwright Road's traffic carries on as Ashby Road.
- **Cars:**
  - **The cars in house driveways can be stolen** like any parked car, as can those in the garage yard and the shoppers' car park.
  - **The dealer's display cars stay scenery**; you buy from the desk and your car appears in the pickup bay (the first bay of the front row, with a gap in the pennants to drive out).
- **Shops (M6b):**
  - Plain trade names (HARDWARE, CLOTHING, USED CARS) on the doors and panels, since business names need your approval (docs/01). Tell me names if you want them.
  - Opening hours: hardware 08:00–21:00, clothing 09:00–21:00 (docs/01: shops close at 21:00), the car desk 09:00–18:00.
  - Outfit prices $60–$300 in clean carried cash (docs are silent). The wardrobe and the fitting booths change outfits for free.
  - The car desk takes clean money: the bank card first, then carried clean cash. Bought cars are owned, unlocked, keyed, full, never hot. The beater's stats follow docs/08 (top speed 70 vs the sedan's 85, health 70, tank 30).
  - The creator's six skin tones and five hair colours are palette ramps, some shifted one tone (docs/11).
- **Jobs (M7), see docs/03 "Phase 2 build (milestone 7)":**
  - Bosses are roles (SHOP FOREMAN, SITE BOSS, DISPATCH) until you name them.
  - Uniform colours: blue-grey coveralls, red flannel, navy and khaki for the courier. A uniform is needed to clock in at the three new jobs; it comes from the site locker and comes off at any locker or wardrobe.
  - Shifts: 3 tasks for the office, mechanic and lumberjack, 4 for delivery (van, route, two stops, in order). Tasks can repeat within a shift except the delivery steps.
  - The office's stamp-and-sign is at the copier and the meeting at the whiteboard (rank 3+).
  - The sites keep 08:00–18:00 (the garage's hours from the decisions; the depot and the trailer the same).
  - The office expense account (rank 4) takes 10% off every legal shop, clothes and cars. The other perks show on the phone as LATER.
- **UI redesign:**
  - It keeps the palette, the plate style, the gold rules and the screen positions of the hud.py mockups. Only the sizes, the font (5 × 7) and the pictures (rendered with the game's 3D renderer) changed.
  - Contact portraits are rendered from the person models, so faces are small and simple at 32 px.
  - From a car, only Marlo's spot counts as a zone target.
- **Still open for review from M5:** the bank and rent rules, the HR cover rule, the open shelter and the toolbox price ($120). See "Milestone 5" below.

### Questions I owe you
- **Odd jobs pay:** keep the tips on top of the flat 60% of your job's rank pay (as built in #21), or pay a flat 60% with no tips? docs/02 only says "the 60% side-gig rate".
- **Is "Linden Avenue" OK** for the street of houses?
- **Hardware store, clothing store and car dealer interiors:** built from the recorded answers (M6b); please review the drafts in `art/drafts/interiors/interior_{hardware,clothing,dealer}.png`.
- **Shop names:** the three new shops use plain trade names until you name them.
- **The extras you said you'd name later** ("I'll tell you later"): still waiting on you.
- **Heist interiors** (jewellery store, bank) need your approval before they're built (Phases 3 and 7).
- **The job sites (M7)** were built from the recorded answers; please review `art/drafts/interiors/interior_{garage,depot,site_trailer}.png`, the boss role names and the meeting dialogue (`src/data/meetings.ts`).

### Art debt
- None. All new art (the suburb buildings, woods props, UI pictures and font) is made with `art/source/` and committed as PNG + JSON.

### Git state
- **`main`:** PRs #9–#22 merged (M7 is live). Pages deploys from main: https://mock-10.github.io/greyhaven/.
- **`claude/p2-map-shops-do5oew`:** merged (#24, Phase 2).
- **`claude/p3-crime-police`:** Phase 3 (M9–M12), PR #26.
- **`claude/polish-anim-6zvc8q`:** PR #23, merged (2026-10-12, session 7).
- Other `claude/*` branches are merged and can be ignored.

### Answered decisions, in short (full text in the docs)
- **Phase 1:**
  - Chop pay is 15–30% of value by car type, with an early cap.
  - The taxi and the van can be stolen.
  - Bag-it laundering has a timer, and dye-stained stacks must be left out.
  - Marlo: park in the dotted spot and press E; he walks over. Open 24 h.
  - The camera is about 2× wider.
  - There is a precinct on the test map; arrests use a screen for now.
- **Phase 2:**
  - No bus or taxi.
  - The test map grows with the garage block, a street of houses with the depot, and woods.
  - A bank account with carried vs banked cash. Rent is auto-paid on Monday 06:00.
  - A shelter after eviction, where you can still save.
  - Your apartment has a parking spot where saved cars spawn.
  - Shops: corner store, clothing, hardware, car dealer.
  - Weekend odd jobs: car wash and a bar shift.
  - Uniforms are changed by hand.
  - Trunk looting moves forward for the first day.
  - The creator is built as specced.
  - Garage: bay + spray booth + office. Lumber: outdoor camp + site trailer. Delivery: depot + house row.
  - I write the meeting dialogue.
  - New streets have two lanes each way.
  - The UI redesign: larger text and more pictures.
- **Later phases:**
  - Blood is allowed (no dismemberment).
  - Masks are sold at the clothing store and the fence (a pawn shop with a new character).
  - The dealer works from a back-alley van.
  - Burglary: 3 layouts, sleeping owners, some alarms, occupancy read from the cars outside.
  - Rival crew: the Saltgate Union.
  - Hideouts: one big space with stations, plus locked rooms to buy.
  - The hood: hostile, but no turf system.
  - Marlo moves to Industrial in Phase 6.
  - 10–15 enterable buildings Downtown.
  - All 6 story-chain outlines go in one doc.
  - Jewellery heist: 10 cases and a rooftop escape. Bank: 2 guards and a vault basement.
  - Fronts are full interiors.
  - Procedural sound effects; music is a mix of CC0 and procedural.
  - Higher resolution becomes Phase 9.

### Session notes for whoever picks this up
- **Proxy:** npm goes through the proxy. Set the `NO_PROXY` line above before `npm`, `npx vite preview` or Playwright.
- **Playwright:** it uses the pre-installed Chromium (`/opt/pw-browsers`) with `--use-gl=angle --use-angle=swiftshader`. Don't run `playwright install`.
- **Screenshots:**
  - `npm run build` first. Then `npm run shots -- <names>` starts and stops its own preview server and writes to `shots/` (git-ignored; copy the keepers into `docs/screenshots/`).
  - Presets are in `tools/shots.ts`, with an optional `cheats: [...]`. M6a presets: `p2_garage`, `p2_dealer`, `p2_shops`, `p2_linden`, `p2_depot`, `p2_timber`, `p2_blvd_dusk`.
  - UI shots: `node tools/ui_shots.ts [names]` (port 4174).
- **Processes:** **never** use `pkill -f "vite preview"` or `pgrep -f`; they kill the calling shell. Find the PID with `ps -eo pid,args | grep "[n]ode.*vite preview"`.
- **Waiting:** foreground `sleep` is blocked in the container. Wait on a background job with an until-loop instead.
- **Debug hook** (`window.__DL__`, read-only): `dirty`, `stars`, `driving`, `cars` (with `looted`, `model`, `owned`), `minigameState`, `bank`, `rentOwed`, `evicted`, `health`, `inventory`, `listPage`, `look` and `creator` (the creator's look and row while it's open). List panels set `minigame` to their name (`clothing`, `wardrobe`, `dealer`, `atm` ...).
  - Cheats are never read from the URL. The cheat console (Ctrl + Shift + F1) is how tests and screenshots set things up: `day N`, `stars N`, `bank N`, `item lockpicks 10` and so on.
- **Interior art pipeline:** edit `art/source/rooms.py` → `python3 art/source/check_layout.py <room ...>` (0 issues) → `python3 art/source/export_interiors.py <room ...>` → commit `art/interiors/*`, add the atlas to `src/assets/manifest.ts` (`in_<id>`), an `InteriorDef` in `src/data/interiors.ts` and the door in `downtown_map.py`. Shop furniture is in `art/source/decor_shops.py`.
- **Player sprites:** `python3 art/source/pack_player.py 8` renders `art/player.png/.json` (4 hair styles, marker ramps `mk_*` in `sdf.py`); the game repaints them in the look (`src/assets/playerLook.ts`, `src/systems/lookSwap.ts`). New outfits are two ramps in `src/data/looks.ts` plus an `outfit/<id>` icon in `ui_icons.py`.
- **Vehicles atlas:** `atlas.py` repacks every atlas; for vehicles only, repack the `veh/` rows the same way (cell 139 × 110, existing frames unchanged).
- **City map pipeline**, run in `art/source/`:
  1. Edit `downtown_map.py`, then run `python3 downtown_map.py --no-render` (writes `src/maps/downtown.json`).
  2. `python3 check_city.py` must report 0 issues.
  3. `python3 pack_city.py` adds new sprites to the city atlas (`art/city.png/.json`, 231 frames).
  - **Full drafts:** `python3 downtown_map.py --procs 4` takes several minutes at 70 × 96 and writes `art/drafts/downtown/downtown_{day,dusk}{,_1x}.png` and `downtown_debug.png` (all committed).
  - **Sprite cache:** `art/source/cache/` is keyed by name and not committed. After editing a model, delete `cache/bld__<name>*`. A fresh session renders the sprites once.
  - If `ground_vec.py` changes, re-run `python3 make_ground_fixture.py`.
- **Map script structure** (`downtown_map.py`):
  - Map size `NW, NH = 70, 96`.
  - New streets have the half width `HW4 = 4 * T` and `LANES_PER_DIR = {HEDGEROW WAY: 2, ASHBY ROAD: 2, LINDEN AVENUE: 2}`. Downtown streets default to 1.
  - Road tables `ROADS_X` / `ROADS_Y`, spans `XSPAN` / `YSPAN`.
  - Traffic: `lanes()` writes 20 lanes, each with `stops` ({s, c}); `crossings()`; and `roads()` (8 centre lines, for police routing).
  - The exported `districts`.
  - New blocks: `block_boulevard_band`, `block_linden`, `block_woods`, `block_timber`.
  - New building models are in `art/source/suburb.py`.
- **Game side:**
  - `src/maps/types.ts`: lanes with stops, plus `roads` and `districts`.
  - `src/systems/traffic.ts`: `buildLanes` reads `l.stops`, with a light phase (`ew`) per stop.
  - `districtAt()` is in `src/maps/groundQuery.ts`.
- **Simulation timing:**
  - The simulation runs on `game.loop.rawDelta`, because Phaser's smoothed delta crawls in headless Chromium.
  - `MinigameScene` and `ListScene` ignore repeated key events; `ListScene` also ignores keys for 300 ms after opening.
  - Skill-check e2e tests poll `minigameState` and press inside the good zone. Keep that pattern, because fixed timings are frame-rate dependent in CI.
- **Saves:** `SAVE_VERSION` is 4 (v1 → v2 → v3 → v4; v3 adds the look and the wardrobe, v4 the shift's done tasks). Bump it and add a migration and its test whenever the save shape changes.
- **Jobs (M7):** `src/data/jobs.ts` holds `JOBS` (site, boss, tasks, uniform, perks) and `TASKS` (each task's minigame); `taskBlock()` in `systems/career.ts` says why a task can't start. Interior prompts map to `{kind: 'job', task}`, `clock` and `locker` actions; outdoor spots are map zones `job_<task>` and `drop_<n>`. The cheat `job mechanic` switches job off shift; the debug hook has `job`, `shiftDone` and `objective`.

## Phase 5 — Property, hideouts, operations, crews (in progress)
Milestones: M15 homes and the hideout (PR #29), M16 the press and the chop bay (PR #30), M17a crews and hideout hits (this PR), M17b the lab and smuggling, the close.

- [x] Two houses for sale on Linden Avenue (small $12,000, family $30,000), bought with clean money; weekly tax with the rent. (M15)
- [x] Homes: bed (sleep, save), wardrobe, stash, the basement; unseen entry clears 1–2★; the apartment's stash opens. (M15)
- [x] The basement hideout: plans table, add-on slots and rep tiers, the stash room, the workbench, the garage bay; garage storage at the driveway. (M15)
- [x] Operations: the press and the chop bay; stalls (radar), restocking, collecting with the money count, nightly raids. (M16)
- [ ] The product lab (with smuggling). (M17)
- [x] Crew room, hiring at The Low Tide, operators on the press, wages and quitting; Saltgate Union hideout hits. (M17a)
- [ ] Drivers, smuggling 3 tiers, airdrops, shipment ambushes. (M17b)

### Milestone 17a: crews and Saltgate Union hits (2026-10-12)
**Built:** see docs/09 "Phase 5 build (milestone 17a)" and docs/04 "Saltgate Union hits". Save v11 (`property.crew`, `property.hits`). New art: eight crew portraits (ui_icons.py), the Saltgate Union rival costume (humans.py `rival`, appended to the character sheets by the new `pack_costumes_add.py`), the HIRE CREW booth at The Low Tide, the crew table in the hideout.

**How to try:** own a home with a crew room (`rep 100000`), `dirty 5000`, the first booth at The Low Tide after 16:00; the crew table in the hideout posts operators. `hit` starts a Saltgate Union hit on your first home; `gun smg` to answer it.

**Assumptions:** three candidates a day, operators only until smuggling; operators don't run the chop bay; hits at 22:00; rivals fire within 9 tiles, softer than police.

**Art debt:** rivals have no aiming pose.

**Known issues:** none known.

**Screenshots:** `docs/screenshots/p5/` (hire, rivals).

### Milestone 16: the press and the chop bay (2026-10-12)
**Built:** see docs/09 "Phase 5 build (milestone 16)". Save v10 (`ops` per home). New art: the counterfeit press and a counting table, the chop bay's lift with a car, an engine stand and tyres (rooms_property.py); the radar marks your homes, red while an operation stalls.

**How to try:** buy 10 Linden Avenue, `rep 100000`, build the press and the chop bay at the plans table; `dirty 1000` and restock the press; `day 3` and collect.

**Assumptions:** the money count's bonus shares; raids at 03:00; supplies paid from carried dirty cash, then the stash; any car you don't own can be chopped.

**Art debt:** none new.

**Known issues:** none known.

**Screenshots:** `docs/screenshots/p5/` (hideout_ops, press_panel, money_count).

### Milestone 15: homes, the stash, the hideout (2026-10-12)
**Built:** see docs/09 "Phase 5 build (milestone 15)". Save v9 (`property`, `storedAt`, `area.home`). New art: the FOR SALE sign (street.py), the home interiors and the basement hideout (rooms_property.py, home mode in rooms_houses.py), icons for the home app and the add-ons. Interiors can now hide or show items by add-on (`needs`).

**How to try:** Linden Avenue, south of Hedgerow Way: the FOR SALE signs at no. 4 and no. 10. Cheats: `bank 50000`, `rep 400` (for the workbench's tier).

**Assumptions:** which two houses are on the market; tax arrears without foreclosure; the garage stores cars at the driveway; crafting at half price; the apartment's stash has the base 10 slots.

**Art debt:** none new.

**Known issues:** none known.

**Screenshots:** `docs/screenshots/p5/` (sale_sign, sale_panel, home_small, hideout_bare, plans, hideout_built, stash).

## Phase 4 — Combat and vehicles (done 2026-10-12)
Milestones: M13 combat (PR #27), M14 vehicles and the close.

- [x] Weapons, ammo, the arms dealer (van in the Overcast alley, 18:00–04:00), armor. (M13)
- [x] Shooting and melee in the street: aim, raise, fire, reload, slots, crosshair, the weapon panel. (M13)
- [x] People and officers go down with blood pools that fade; officers drop weapons (looting). (M13)
- [x] Police combat: fire at 2★+ or once you shoot; weapon by stars; known face + visible weapon +1★. (M13)
- [x] Death: wake at St. Brine's infirmary at 06:00, pay 10%. (M13; the hospital comes with the full town.)
- [x] Trunks sometimes hold a gun; unregistered weapons are seized on a repeat-offense jail stay. (M13)
- [x] All vehicle types, damage states, upgrades, respray, repair, trunk storage, insurance, pulling drivers out. (M14)
- [x] Spike strips (M14); the legal gun store comes with the full Downtown (Phase 6).

### Milestone 14: vehicles and the phase close (2026-10-12)
**Built:** see docs/08 "Phase 4 build (milestone 14)". Save v8 (cars' `mods` and `stash`). The pickup, sports car and armored SUV on the lot and parked about; smoke, fire, explosions and insurance; Torque & Sons' CAR SERVICE bay (repair, five upgrades, respray); your own trunk; the police search of it; pulling drivers out of traffic; spike strips at roadblocks. New art: the spike strip decal (`fx_particles.py`), the new cars in the map renderer's cache.

**How to try:** drive any car onto the concrete apron in front of Torque & Sons (08:00–18:00), stop, E. Walk up to a car waiting at a red light, E at the driver's door. Cheats: `car pickup_sage`, `roadblock` (3★ and a roadblock with spikes ahead of the car you drive).

**Assumptions:** the bay serves any car you can drive; one in four drivers swings at you (12 damage); spike strips with every roadblock, 2.5 tiles before it; burst tyres halve top speed and cut steering to 60%, $200 to replace; the hidden compartment's cargo-value cut waits for product cargo (Phase 5).

**Art debt:** none new.

**Known issues:** the driver's door is on the car's left, which is the far side on screen for cars heading one way.

**Screenshots:** `docs/screenshots/p4/` (m14_service_bay, m14_service_panel, m14_pull_out, m14_pulled, m14_spikes).

### Milestone 13: combat in the street (2026-10-12)
**Built:** see docs/07 "Phase 4 build (milestone 13)". Save v7 (`combat`). New art: weapon poses for the player in every style (aim pistol / rifle / heavy, bat swing, knife stab; the masked style now has every tool animation too), weapon, ammo and armor icons, blood pool and spatter decals. The map gains the dealer's van and zone.

**How to try:** after 18:00, the alley behind the Overcast Avenue shops (east end): ARMS DEALER. Or the cheat console: `gun pistol` (any weapon name). Right mouse raises, left fires, 1–4 switch, R reloads.

**Assumptions:** people 40 HP, officers 80; gunfire heard 16 tiles (1★), a hit is 3★; police rounds do 45% damage; dealer hours; bodies stay 30 s; St. Brine's infirmary stands in for the hospital; combat only in the street.

**Art debt:** downed people are the standing sprite turned on its side; police have no aim pose (their shots show a muzzle flash and a tracer from where they stand).

**Known issues:** the camera's edge-pan can still move the view while aiming near the screen edge.

**Screenshots:** `docs/screenshots/p4/` (aim_pistol, arms_dealer, down_with_blood, police_shooting).

## Phase 3 — Crime breadth and police (done 2026-10-12)
Status key: [x] done and playable · [~] partly done · [ ] not started. Milestones: M9 core (save v6, reputation, heat, jail, bribes), M10 store and ATM robbery, the fence, masks, M11 house burglary, M12 police response and the close.

- [x] Trunk looting (Phase 2), now earning reputation. (M9)
- [x] Reputation tiers and contacts: rep from crimes, waiting while wanted, Dez's tier-up messages, crime contacts in the phone. (M9)
- [x] Jail and seizure: sentence, jail screen (lawyer, judge), booking. (M9)
- [x] Bribes: the on-scene cop at 1–3★ in the phone; the judge at Connected. (M9)
- [~] Cameras and identification: store and ATM cameras, police sightings, booking, DVR wipe, known face. (M9–M10; outdoor street cameras not built.)
- [x] Store robbery: till (intimidate), staff door + safe, CCTV desk, DVR, night job with the alarm panel. (M10)
- [x] ATM robbery: hack or drill. (M10)
- [~] Masks and outfits: the fence's three masks (one sprite), M to wear, the outfit-change escape bonus for masks. (M10; changing clothes at a wardrobe during a chase not wired.)
- [x] The fence: the pawn shop interior with the fence's counter (goods, masks, drill). (M10, M12)
- [x] House burglary: three house interiors, occupancy, alarms, sleeping owners, scare off, goods for the fence. (M11)
- [x] Full 1–5★ police response: cruisers, SWAT vans, armored SUVs, helicopters, roadblocks, 4★→5★; the precinct lobby. (M12; spike strips and police gunfire wait for Phase 4 combat.)
- [x] Econ sim (unchanged: the crime payouts sit inside the sim's tier nights), docs, e2e, screenshots, PR. (Close)

### Milestones 11–12: house burglary, the police response, the pawn shop and the precinct (2026-10-12; PR #26)
**Built:** see docs/04, 05 and 18 "Phase 3 build (milestones 11–12)". New interiors: three burglary houses, the pawn shop, the Precinct 1 lobby (drafts in `art/drafts/interiors/`, built from the recorded answers for review after). Map: doors for the pawn shop and the precinct. The SWAT van, armored SUV and helicopter from PR #20's art.

**How to try:** Linden Avenue (south, the delivery houses): TAB at a front door for BREAK IN. The pawn shop next to the cafe on Overcast Avenue. Cheat `stars 4` to see the helicopter and SWAT; drive at 3★+ for roadblocks. Get busted to walk out of the precinct lobby.

**Assumptions:** half the driveways have cars on a given day; goods use phone/watch icons in the search grid; the house keypad stands on a hall stand; units leave the precinct 3 s apart; the helicopter sees 16 tiles over buildings.

**Art debt:** no burglary goods icons; the masked player has no tool animations; one masked sprite for three masks.

**Known issues:** spike strips and police gunfire wait for Phase 4; police units can overlap each other (they don't collide among themselves); outdoor street cameras aren't placed.

**Screenshots:** `docs/screenshots/p3/` (house_family, pawn_shop, precinct_lobby, police_4stars_helicopter, plus the M9–M10 shots).

### Milestones 9–10: crime core, store and ATM robbery (2026-10-12; PR from `claude/p3-crime-police`)
**Built:** see docs/04, 05, 06 and 12 "Phase 3 build". Save v6. Six crime minigames with panels. New art: contact portraits (fence, dealer, supplier, gang contact, cop, clerk), mask and drill icons, a masked player sprite (`pack_player.py` style `masked`).

**How to try:** the corner store (Overcast Avenue): TAB at the till for ROB THE REGISTER; E on the STAFF ONLY door with lockpicks; the CCTV desk and DVR in the side room. Any ATM: TAB for ROB ATM. The fence: the pawn shop door next to the cafe, 10:00–22:00. M wears a bought mask. At 1–3★, P → CONTACTS → A COP ON THE TAKE.

**Assumptions:** listed in docs/04–06 (store grab uses the intimidate grade; bypass without the code part; fence hours and mask prices; three masks share one sprite). CrimeState.knownFaceUntil from #18 is unused; the heat file (#17) is the one source of "known face".

**Art debt:** one masked sprite for all three masks; the masked player has no tool animations (it stands still while using things); the drill icon reads a little odd.

**Known issues:** the clerk doesn't react on screen (no hands-up pose); customers in the store aren't witnesses yet.

**Screenshots:** `docs/screenshots/p3/`.

## Phase 2 — Economy and careers (done 2026-10-12)
Status key: [x] done and playable · [~] partly done (what's left is said) · [ ] not started. Milestones: M5 money and phone (done, PR #10), the UI redesign (done, PR #11), M6a map growth (done, PR #12), M6b shops and the creator (built on `claude/p2-map-shops-do5oew`), M7 the three new jobs, M8 odd jobs, the first day and the close.

**Standing rule from now on (user, 2026-10-11): every new street is at least two lanes in each direction (4 lanes in all).** The existing Downtown streets stay as they are: they have one lane each way, which suits a compact downtown. Everything built from now on follows the rule, starting with the Phase 2 map growth (the garage block road, the house row with the depot, the road through the woods) and later the Phase 6 city. See docs/01 ("Street width").

- [x] **Street width rule:** new streets are at least two lanes each way. (M6a, PR #12: a lane count per road, one lane line per lane with stop lines, dividers; traffic picks a lane.)
- [x] Test map grows: Torque & Sons garage block, a street of houses with the Swiftish Couriers depot, a patch of woods with Ashby Timber and a road (all reachable on foot or by car). All new roads are two lanes each way. (M6a, PR #12: 70 × 96 tiles, with Hedgerow Way, Ashby Road, Linden Avenue and the Hedgerow Park and Far Acres districts.)
- [x] Bank account: carried vs banked clean cash, ATMs, pay into the bank. (M5)
- [x] Rent auto-paid on Monday 06:00, late fees, eviction after two missed weeks, shelter (sleep and save). (M5)
- [x] Character creator (palette-swap sprites, as specced) before the first day. (M6b: name, hair style, skin, hair colour, starting outfit, a spinning preview.)
- [x] Office: stamp-and-sign and meeting tasks (rank 3+). (M7: the copier and the whiteboard.)
- [x] Car mechanic: garage interior (bay, lift, spray booth, office), diagnose, bolt torque, tyre change, respray. (M7.)
- [~] Lumberjack: chop, fell direction, load logs, haul with the log truck; site trailer to clock in. (M7: all but haul, which waits for the mill in Phase 6.)
- [x] Delivery: depot interior, load van, route, doorstep, signature; marked doors on the house row. (M7: two radar-marked stops a day on Linden Avenue.)
- [x] Rank ladders and perks for the 4 jobs (stub the perks that need later systems). (M7: the phone's PERKS page; the key card and the expense account work, the rest are LATER.)
- [x] Work uniforms and lockers (change by hand). (M7.)
- [x] Weekend odd jobs: car wash and a bar shift at The Low Tide. (M8: Squeaky's Car Wash, the bar's taps, the job board.)
- [x] Shops: full corner store, clothing store, hardware store, car dealer (beater and sedan). (M5: the corner store. M6b: the hardware store (lockpicks, toolbox, repair kit), the clothing store (6 outfits, fitting booths, the wardrobe at home), and the used-car desk (beaters and sedans in 6 colours).)
- [x] Arrest effects on careers (freeze, missed shifts, extra work, HR bribes on the phone), clean-record bonus. (M5)
- [x] Phone: job board, bank, contacts (first pass); the bag (I). (M5)
- [x] Trunk looting (brought forward). (M5)
- [x] Guided first day (no bus or taxi step; trunk looting in step 5). (M8: hints on the objective strip, Dez's tip by phone, F2 skips.)
- [x] Econ sim re-run, tests, screenshots, notes, PR. (M8.)
- [x] UI redesign: larger text (5 × 7 font), more pictures (rendered icon atlas), a bigger HUD, the handset phone, picture grids. (Your request, 2026-10-12; merged in PR #11.)

### Milestone 8: weekend odd jobs, the guided first day, the phase close (2026-10-12)
**Built**
- **Squeaky's Car Wash** (new `car_wash` building east of Torque & Sons, with a wash apron and a waiting dirty car). E at the apron on Saturday or Sunday, 09:00–16:00, starts the gig: 3 cars, each a scrub minigame (mouse or arrows aim, Space scrubs, R dunks the sponge, Enter calls the car done).
- **Bar shift** at The Low Tide's beer taps (`BAR SHIFT`), weekends 16:00–22:00: 3 counter rushes, pour lager/stout/cider (1–3, hold Space).
- A finished gig pays 60% of your job's shift pay at your rank to the bank, plus tips in carried cash by grade. Esc in a task walks off unpaid; each gig once a day; not while on a shift. The objective strip tracks what's left. The phone's JOB BOARD lists both gigs (OPEN / SHUT / DONE / ON IT).
- **The guided first day:** 8 steps with hints on the objective strip (LOSE THE COPS still wins); a short walk on the street, any interior exit, the job board, clock in/out, a store or clothing buy, a trunk loot, no stars and sleep move it on. Dez's tip arrives as a phone message at 17:00. F2 skips it (shown on the hint strip while it runs).
- Save v5 (odd jobs + guide state; old saves count the guide as done). Econ sim re-run and docs/02 pacing table updated; notes in docs/02, 03, 11. E2E: a full car wash gig paying to the bank.

**How to try:** start a new game and follow the hints, or press F2. For a gig: cheat console (Ctrl+Shift+F1) `day 6`, `time 10:00`, walk to Squeaky's Car Wash (south-east of Torque & Sons) and press E at the apron; or `time 17:00` and the taps at The Low Tide.

**Assumptions:** Esc in a gig task means walking off the gig (no pay). A gig can't start during a work shift. The guide's first step also ends after a two-tile walk, because new games start on the street. Gig icons on the job board reuse the sedan and cash icons. Pacing sim: civilians work both gigs each weekend day, mixed players the car wash only, tips at "good".

**Screenshots:** `docs/screenshots/m8/` (car wash panel, bar shift panel, job board, street with the guide hint).

**Known issues:** the gigs sit below the fold on the job board (scroll down). The car wash TIME bar is drawn in the gold of the key plates (from #21's panel); check against the gold rule in the polish pass.

### Milestone 7: the three new jobs (2026-10-12; on `claude/p2-map-shops-do5oew`)
**Built:**
- **Three job sites open from the street:** Torque & Sons garage (Hedgerow Way), the Swiftish Couriers depot (Linden Avenue) and Ashby Timber's site office (east of Ashby Road). Interiors from PR #14 (`art/source/rooms_jobs.py`, `decor_jobs.py`); the depot's route map became PLAN ROUTE.
- **All four jobs are hiring**, each with a time clock, a boss, its tasks and a uniform (docs/03 "Phase 2 build (milestone 7)"):
  - **Mechanic:** diagnose, torque bolts, change tyre, respray.
  - **Lumberjack:** chop, fell trees and load logs at three spots in the yard.
  - **Delivery:** load van and plan route at the depot, then two radar-marked stops on Linden Avenue (deliver parcels, get a signature).
  - **Office:** stamp and sign at the copier and the meeting at the whiteboard (rank 3+).
- **Twelve job minigames** from PR #15 wired into the panel scene with keys and mouse (docs/06).
- **Lockers and uniforms:** coveralls, flannel and the courier uniform; needed to clock in; off at any locker or wardrobe. New `outfit/*` pictures.
- **Perks:** a PERKS page on the phone's job board; the office expense account (rank 4, 10% off legal purchases) is live.
- **Radar marks** (gold) for the site door at clock-in time, the yard spots and the delivery stops.
- **Saves:** `SAVE_VERSION` 4 (the shift remembers its done tasks), with a migration and test.
- **Tests:** `tests/jobs.test.ts` (catalogue, clock-in rules, delivery order, the meeting rank, drops, the expense account, the locker), door and interior checks for the new sites; e2e: a full garage shift (no clock-in out of uniform, the locker, three tasks, pay, the change-out reminder).
- Screenshots: `docs/screenshots/phase2_m7/`.

**How to try:** open the phone (P), JOB BOARD, and pick a job. On a weekday between 08:00 and 10:00 go to its site (the gold radar mark), take the uniform from the LOCKER, CLOCK IN, do the tasks, and clock out. Delivery: load the van and plan the route, then follow the two radar marks on Linden Avenue.

**Assumptions:** see "Decisions and assumptions" (Jobs) in the handover.

**Art debt:** none; the uniforms are palette swaps and the new art comes from `art/source/`.

### Milestone 6b: shops and the character creator (2026-10-12; merged in PR #13)
**Built:**
- **Character creator** (docs/11), between the title and the first day: name (16 characters), hair style (short, long, bun, bald), 6 skin tones, 5 hair colours, the 3 starting outfits, and a live 8-direction preview that spins. Keys (W/S rows, A/D change, typing on the name row, Enter starts) and the mouse both work. `src/ui/creator.ts`, `src/scenes/CreatorScene.ts`.
- **Palette-swapped player:** `art/source/pack_player.py` renders the player once per hair style with marker colours; the game repaints the `player` texture in your look (`src/assets/playerLook.ts`, `src/systems/lookSwap.ts`), so a change of clothes is instant everywhere.
- **Three new interiors** (drafts in `art/drafts/interiors/`, new furniture in `art/source/decor_shops.py`: clothing racks, mannequins, display tables, fitting booths, a shoe shelf, a tool pegboard, paint shelving, a lumber rack, a step ladder, bins of fixings, a key cutter, a model car):
  - **Hardware store:** paint, tool walls, timber, aisles, the till by the door (SHOP: lockpicks, the toolbox, repair kits) and a locked stockroom.
  - **Clothing store:** racks, tables, mannequins, a shoe shelf, two fitting booths (CHANGE OUTFIT) and the till (BUY CLOTHES: 6 outfits, $60–$300, worn straight away).
  - **Used-car cabin:** the salesman's desk (BUY A CAR) with visitor chairs, brochures, coffee and water, a model car.
- **Doors** on Hedgerow Way for all three; the apartment wardrobe now changes outfits.
- **Buying a car:** beaters ($1,500, new hatchback art in two colours) and sedans ($5,000) in 6 colours. Clean money, the bank first. Your car waits in the lot's pickup bay, unlocked, keyed and full, and drives out through a gap in the pennants.
- **New pictures:** an `outfit/*` dress form per outfit and a `car/*` picture per car for the lists.
- **Saves:** `SAVE_VERSION` 3 adds the look and the wardrobe (migration and test).
- **Tests:** `tests/shops.test.ts` (looks, the palette swap, outfits, the dealer), new interior and door checks; e2e: the creator in the first test, the clothing store and booth, and buying and driving off a beater.
- Screenshots: `docs/screenshots/phase2_m6b/`.

**How to try:** start a new game and make your character. Walk to Hedgerow Way (south of Downtown): the hardware and clothing stores are west of Pewter Street, the used-car lot between Millwright Road and Gullsway. Buy an outfit, change at a booth or at home, then buy a beater and drive it away.

**Assumptions:** see "Decisions and assumptions" (Shops) in the handover.

**Art debt:** none; all new art comes from `art/source/`.

### Milestone 6a: the new district south of Downtown (2026-10-12; merged in PR #12)
**Built:**
- **The map grew from 70 × 48 to 70 × 96 tiles** (`art/source/downtown_map.py` → `src/maps/downtown.json`; the city atlas is repacked at 231 frames).
- **Two-lanes-each-way streets** (your rule): **Hedgerow Way** along Downtown's south edge, **Ashby Road** south from Hedgerow Way (it continues Millwright Road and bends to the map edge), and **Linden Avenue** west from Ashby Road. Each has 8 tiles of asphalt, dashed lane dividers, a double centre line, stop lines and crossings.
  - The road code is generic: road tables, spans, a lane count per road, junctions, corner furniture per junction, and street spans per segment.
- **North side of Hedgerow Way:**
  - the hardware store and the clothing store with neighbours, a service alley and a shoppers' car park (west of Pewter Street);
  - **Torque & Sons Garage**, with its bay apron, a yard of waiting cars and a corner café;
  - the **used-car lot** with its sales cabin and pennants (Millwright Road to Gullsway).
- **Linden Avenue:** a **row of houses** with lawns, paths, driveways (parked cars), picket fences and mailboxes, and the **Swiftish Couriers depot** at the east end, facing Linden Avenue behind a loading apron. South of Linden Avenue are **the woods**, with a footpath.
- **Ashby Timber:** a dirt yard in the woods east of Ashby Road, with the site trailer, reached by a gravel drive.
- New building models are in `art/source/suburb.py`: houses, the depot, the garage, the dealer cabin, the site trailer, and woods props.
- **Districts:** the map JSON gains `districts` (Hedgerow Park south of Hedgerow Way; Far Acres east of Ashby Road) and `roads` (8 centre lines for police routing). `districtAt()` drives the HUD's district name.
- **Traffic:** 20 lanes (4 on Hedgerow Way), each with its own stop lines and a light phase per stop. Cars pick a lane, and routes take right turns only.
- **Tests:** `tests/downtown.test.ts` (the map size, the districts, the new buildings) and `tests/streetLife.test.ts` (20 lanes, 4 on Hedgerow Way, stops in order, lanes run edge to edge, 8 road lines). 192 unit tests pass; `check_city.py` reports 0 issues.
- **Drafts and screenshots:**
  - The full map drafts are re-rendered at 70 × 96 (`art/drafts/downtown/`).
  - In-game screenshots are in `docs/screenshots/phase2_m6a/`: garage, dealer, shops, Linden Avenue, depot, timber yard, and the boulevard at dusk.

**How to try** (after the merge, or locally on the branch): walk or drive south from Downtown across Hedgerow Way. Then go down Ashby Road and west along Linden Avenue, and find the timber yard east of Ashby Road. The district name in the HUD changes to HEDGEROW PARK or FAR ACRES.

**Assumptions (please review):** see "Decisions and assumptions" in the handover. In short:
- the street names (Linden Avenue still needs your OK);
- Ashby Road continues Millwright Road;
- right-turn-only routes;
- the depot faces Linden Avenue;
- driveway cars can be stolen;
- dealer cars are scenery;
- the new shops are facades for now.

**Art debt:** none.

**Finished in session 6 (2026-10-12):**
- **E2E on the 70 × 96 map:** all 17 tests pass. The only failure was Marlo's sale: his walk is a scene tween on Phaser's smoothed clock, which crawls when headless Chromium drops to a few frames a second, so the test now gives him 75 s (CI was already green).
- **Traffic density:** the car count now scales with the total lane length (`BALANCE.traffic.perLaneUnits`, cap `maxCars` 60). The new map has about 2.7× Downtown's lanes, so the evening peak is about 54 cars instead of 20, the same density per street as before. Screenshot: `docs/screenshots/phase2_m6a/p2_traffic.png` (Hedgerow Way at 17:30, 1×).

**Known issues:**
- The new buildings have no doors yet (a door without an interior would fall back to Marlo's message).

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
**How to try** (live at `https://mock-10.github.io/greyhaven/`; merged in PR #10):
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

**Art debt:** none. The shelter uses the existing chapel. (The item and loot icons were pixel arrays in `src/ui/hudDraw.ts`; the UI redesign replaced them with the rendered atlas.)

**Known issues:**
- The search panel can cover part of the car you're looting (panels sit beside the player, as before).
- The hardware store, the clothing store and the car dealer have no interiors yet (their buildings arrive with M6a; interiors in M6b), so lockpicks, the toolbox and repair kits can only come from the cheat console or a trunk for now. The corner store sells the first-aid kit.
- The phone has no map, crew or properties apps yet (later phases).

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
