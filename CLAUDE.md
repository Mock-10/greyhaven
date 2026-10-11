# CLAUDE.md — instructions for building *Double Life*

You are building **Double Life**, a single-player isometric pixel-art life sim and crime sandbox for desktop browsers, using **Phaser 3 + TypeScript + Vite**. The design is finished and lives in `/docs`. The art direction is locked and lives in `/art`. Your job is to turn them into a working game, **one phase at a time**.

## 0. Where you run, and where the game runs
- **The game is 100% client-side.** It is a static site: HTML, JS and the bundled assets. There is no backend, no server calls, no accounts, no analytics, no CDN fonts or scripts at runtime, and no network requests after load. Saves live in IndexedDB (12). Everything must work when served from a plain static host.
- **You run in Claude Code on the web**, in a cloud container with a clone of the `greyhaven` repo. The user is **not** at a terminal. They can't run `npm run dev` or open `localhost`, so they play the build at **GitHub Pages** (`https://<user>.github.io/greyhaven/`).
- **So the deploy comes first.** Phase 0 sets up `.github/workflows/deploy.yml` (lint → test → build → deploy to Pages on push to `main`). From then on, every phase ends with a deployed, playable link.
- **Your eyes are Playwright.** Run `npm run build && npx vite preview`, or the dev server, inside the container. Drive it with Playwright (headless Chromium) and **take screenshots** to check your visual work. Attach the key screenshots to the PR description or your summary, so the user sees the result before merging.
- **Git flow:** work on a branch, commit often, push and open a PR with a short summary, screenshots and "how to try it". **Autopilot (user, 2026-10-11):** Claude merges its own PR once CI is green, which deploys; the user reviews afterwards. Push straight to `main` only if the user says so.
- **Sessions don't share memory.** `CHANGELOG.md` is the handover: keep the phase checklist, assumptions, art debt and known issues up to date there, so a fresh session can continue.
- **Tools in the container:** Node/npm for the game. Python 3 with `numpy` and `Pillow` for `art/source/` and `tools/econ_sim.py` (`pip install numpy pillow` if missing). Generated art is committed to the repo as PNG + JSON. The game never runs Python.

## 1. Read before you code
At the start of every session:
1. `docs/00_GAME_DESIGN.md`: the overview, pillars and the decisions table.
2. `docs/15_roadmap.md`: find the **current phase** (the first one whose box in `CHANGELOG.md` isn't ticked).
3. The system docs that the current phase touches (01–14).
4. `art/STYLE_GUIDE.md` before any visual work (plus `art/reference/README.md` for the palette references and close-ups).
5. `docs/16_open_questions.md`: things you must **ask about**, never assume.
6. Before building any **interior**, follow `docs/18_interiors.md`: ask the user its question list, render a draft with `art/source/interiors.py`, and get approval before implementing it.
7. Before building any **HUD or UI**, open the mockups in `art/drafts/hud/` and match them.

**The docs are the source of truth.** If code and docs disagree, the docs win, unless the user says otherwise. Then update the docs in the same change.

## 2. How to work
- **One phase at a time.** Plan the phase as a checklist in `CHANGELOG.md`, build it, test it, show it (screenshots + PR), then tell the user what is ready to try and where (the Pages link after merge). **Autopilot (user, 2026-10-11):** carry on into the next phase without waiting; send a short note with screenshots at each milestone and phase end, and stop only when blocked. Interior drafts, story outlines and other approvals: build from the recorded answers and let the user review afterwards, except heist interiors, which still need approval first.
- **Small, playable steps.** Keep the game building and booting after every step (`npm run build` plus the smoke test). Commit often, with clear messages.
- **Data-driven.** Every number (prices, payouts, timers, XP, stars, speeds) goes in `src/config/balance.ts`. Every catalogue (jobs, crimes, weapons, vehicles, properties) goes in `src/data/*.ts`. **No magic numbers in systems.**
- **State apart from rendering.** Game state is one serialisable store, and Phaser objects only display it (see 14). This keeps saving simple and systems testable.
- **Test the logic.** Write Vitest unit tests for economy, laundering, wanted level, arrests, careers and save migrations. Run `npm test` before saying a step is done.
- **Look at what you build.** After visual work, run the game and take screenshots, for example with Playwright. Compare them to `art/scene_overcast_day.png` and `art/scene_rainy_dusk.png`. Projection, scale, depth order and palette must match.
- **When a doc is silent**, choose the simplest behaviour that fits the pillars and note it in the phase log under "Assumptions" so the user can review it. When a decision is in `16_open_questions.md`, or is a major design choice, **ask the user**.
- **Balance changes:** if you change economy numbers, re-run `python3 tools/econ_sim.py` and update the pacing table in `docs/02_economy.md`.

## 3. Hard rules
1. **Art:** use the art pack's sprites. New art must be generated with `art/source/` so it matches the style (see `docs/13_art_and_audio.md`). The user rejected blocky or voxel figures and rounded "bubble" cars, so don't reintroduce them. Never ship coloured rectangles; log any temporary debug sprite under "Art debt".
2. **Gold is reserved** for valuables and interactables. Don't use gold for decoration or general UI.
3. **Pixel-perfect rendering:** `pixelArt: true`, `roundPixels: true`, integer zoom only, nearest-neighbour scaling, no sub-pixel camera positions.
4. **Projection must match the art:** `screenX = x − y`, `screenY = (x + y)/2 − z`. 1 tile = 32 world units = 64 × 32 px. Sort objects by the world `x + y` of their ground anchor.
5. **Saves never break.** Bump `SAVE_VERSION` and add a migration and its test whenever the save shape changes.
6. **Content guardrails:** drugs are abstract "product" (3 tiers, no real names or processes). Blood is allowed (user, 2026-10-11): blood marks and pools where people go down, run-overs and robberies gone wrong; downed people fall and then fade out. No dismemberment. Violence stays readable at pixel scale.
7. **Dense, lived-in spaces:** interiors and streets must never feel empty. Follow the decoration density rules in `docs/18_interiors.md`, use `art/source/decor.py`, and make new decoration assets whenever something is missing. Outdoors, build a **real city**, not open lots: tight blocks, buildings close to the sidewalk, alleys and infill, densely dressed sidewalks, varied paving and no big runs of bare concrete. The user also wants **rounded corners, curved streets and curved spaces** instead of a squared-off grid. See `docs/01_world_and_time.md` ("Street layout and density").
8. **Furniture faces the right way:** every model's front is local +y. Use `face()`, and check the pairs (chair → desk, sofa ↔ TV and so on) in a render before shipping.
9. **Sight matters:** interiors follow `docs/19_visibility.md`. With the **sight lines** setting on (the default), never show the inside of a room the character can't see. With it off, everything is visible, like the presentation drafts. The setting is visual only, and NPCs always use line of sight.
10. **Heists are intricate:** multi-room, security first (alarms, cameras, locks), a loud and a quiet approach, loot weight and several escapes. See `docs/04_crime.md`. Never reduce a heist to a single interaction.
11. **No scope creep:** don't add systems the docs don't describe (e.g. world events, rival turf wars, multiplayer) without asking.
12. **Browser only, no backend:** never add a server, API, database, login or telemetry. All assets are bundled in the build under Vite `base` `/greyhaven/`, and no runtime fetches go to other origins. The game must work fully offline once loaded.

## 4. Commands (set these up in Phase 0)
```
npm install
npm run dev        # Vite dev server (inside the container, for Playwright)
npm run build      # static build to dist/ (base /greyhaven/)
npm run preview    # serve dist/ locally for screenshot checks
npm test           # Vitest unit tests
npm run test:e2e   # Playwright smoke test
npm run lint
```

## 5. Definition of done (every phase)
- Every item in the phase checklist works in the running game.
- Unit tests pass and the smoke test passes. No TypeScript errors and no lint errors.
- Screenshots of the new features have been checked against the reference scenes.
- `CHANGELOG.md` updated: what was built, how to try it, assumptions made, art debt, known issues.
- Docs updated if any behaviour or number changed.
- Pushed, with a PR open (or merged, if the user allows direct pushes). The deploy workflow passes on `main` after merge.
- A short summary for the user: the Pages link, what to try, what to look at (with screenshots), and any questions.

## 6. Doc map
| File | Topic |
|---|---|
| docs/00_GAME_DESIGN.md | Overview, pillars, loops, decisions |
| docs/01_world_and_time.md | Districts, map, clock, NPC crowd |
| docs/02_economy.md | Money, laundering, prices, fines, pacing |
| docs/03_civilian_careers.md | Jobs, shifts, promotions, perks, arrest effects |
| docs/04_crime.md | Crimes, smuggling, heists, reputation |
| docs/05_police_and_wanted.md | Detection, stars, response, arrest, death |
| docs/06_minigames.md | Skill-check framework and every minigame |
| docs/07_combat_and_weapons.md | Weapons, ammo, health |
| docs/08_vehicles.md | Driving, damage, fuel, upgrades, stealing |
| docs/09_property_hideouts_crews.md | Houses, add-ons, operations, crews |
| docs/10_progression.md | Ranks, reputation unlocks, goals |
| docs/11_ui_hud_controls.md | HUD, prompts, menus, controls, camera, onboarding |
| docs/12_save_system.md | Saves, export/import, versioning |
| docs/13_art_and_audio.md | Art pack usage, new art, sound effects |
| docs/14_tech_architecture.md | Stack, layout, isometric engine, performance, tests |
| docs/15_roadmap.md | Phases 0–8 |
| docs/16_open_questions.md | Ask the user |
| docs/17_story_and_characters.md | Light story: cast, optional mission chains |
| docs/19_visibility.md | Sight rules: visible / remembered / unseen rooms, what blocks sight |
| docs/18_interiors.md | Interior rules, drafts, and the questions to ask before each interior |
