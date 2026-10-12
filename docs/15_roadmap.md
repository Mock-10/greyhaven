# 15 — Roadmap

Build **one phase at a time**. Each phase ends playable, tested and committed, with a short demo note in `CHANGELOG.md`. Don't start the next phase until the current phase's acceptance checks pass.

Development runs in Claude Code on the web, and the user plays every phase in the browser at the GitHub Pages link (see docs/20_workflow.md).

## Phase 0: Foundations
- Vite + TS + Phaser project, lint, tests, and the Playwright smoke test.
- **GitHub Pages deploy workflow** (`.github/workflows/deploy.yml`), Vite `base` `/greyhaven/`, and the screenshot script (`npm run shots`, see 14).
- A "click to start" title screen (unlocks audio later).
- Atlas loader for the art pack. Isometric projection, a tilemap renderer, depth sorting, pixel-perfect camera with integer zoom and mouse pan.
- **Done when:** a test map of about 30 × 30 tiles built from the art-pack tiles renders exactly like `art/scene_overcast_day.png` (same projection and alignment; checked with a screenshot), a static character sorts correctly in front of and behind a building, and **the user can open it at `https://<user>.github.io/greyhaven/`** and pan around.

## Phase 1: Vertical slice (one district, one job, one crime, driving, save)
- **Interiors** (ask the 18 questions first): starter apartment, office floor, corner store (shopping only), bar. Doors and the sight system from `19_visibility.md` go in from the start.
- **District:** Downtown, about 48 × 48 tiles: office tower, corner store, a small parking lot, roads, sidewalks, the bar (NPC launderer), a chop shop at the edge.
- **Player:** walk/sprint with 8-direction animation, collision, interact (E) with gold-rim highlights and prompts.
- **Clock:** day/night cycle, the 20-minute day, sleep at the apartment (a simple interior or a door that triggers sleep).
- **Job:** Office Worker. Clock in, 3 filing/data-entry tasks, get paid, earn promotion XP, rank 1→2.
- **Crime:** carjacking a parked car: lockpick + hotwire minigames, then sell it at the chop shop for dirty money. Then launder it at the NPC launderer.
- **Driving:** one sedan model with arcade handling, fuel, basic damage.
- **Wanted:** 1–2★ only, with a small precinct on the test map. Witnesses with the call delay, one police car plus officers, search circle, escape timer, arrest with surrender, fine, and the first-offense rule.
- **HUD:** radar (simple), stars, clean and dirty cash, clock, HP.
- **Save:** 3 slots plus autosave on sleep, plus export/import.
- **Crowd:** a few pedestrians and ambient traffic, minimal.
- **Done when:** a full day loop can be played (work → evening carjack → escape or arrest → launder → sleep → reload the save), all unit tests pass, and the frame rate holds.

## Phase 2: Economy and careers
Grow the test map with the garage block, a street of houses with the delivery depot, and a patch of woods (01) · bank account and ATMs · character creator · all 4 starting jobs and their minigames · weekend odd jobs (car wash, bar shift) · trunk looting (brought forward for the guided first day) · rank ladders and perks (stub any perk that needs a later system) · rent, late fees, eviction · shops · arrest effects on the career · clean-record bonus · the guided first day.

## Phase 3: Crime breadth and police
Trunk looting, store robbery, house burglary, ATM · reputation tiers and contacts · full 1–5★ police response (the helicopter and military units can be simple versions first) · cameras and identification · masks and outfits · bribes · jail and seizure.

## Phase 4: Combat and vehicles
All weapons, ammo, dealers, looting, armor · combat AI for police · all vehicle types, upgrades, garages, trunks, respray, hot cars.

## Phase 5: Property, hideouts, operations, crews
Houses, add-ons, stash · counterfeit press, chop bay, lab · operators and drivers · raids · smuggling in 3 tiers · airdrops · light rivals (ambushes and hideout hits).

## Phase 6: Full town
Lay out the full city at about 320 × 320 tiles (see 01): a vast Downtown, Suburbs, the hood, Industrial, Docks and Outskirts districts (open fields, woods) plus interiors, with plain ground left for later building · traffic and crowd density by district and time · the security guard, road worker, farmer and scrap yard jobs.

## Phase 7: Late game
Front businesses · armored truck · the 3 heists · story mission chains (17) · Life Summary and goals.

## Phase 8: Polish
Audio pass (SFX → music) · rain and weather · accessibility options · balancing with `tools/econ_sim.py` and playtest data · performance · bug fixing.

## Phase 9 (after Phase 8, to decide with the user then)
Higher resolution: sprites at 2× detail to go with the wider view (art pipeline, style guide, atlases, HUD scale).

## Later / not now
World events (the user decided against them for now) · more heists (the user decided three is enough).
