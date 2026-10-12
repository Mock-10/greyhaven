# 20 — Workflow details for Claude Code

`CLAUDE.md` has only the short rules. Read the section you need here when it applies.

## Environment
- The game is a 100% client-side static site: HTML, JS and bundled assets. There is no backend, no server calls, no accounts, no analytics, no CDN fonts or scripts, and no network requests after load. Saves go in IndexedDB (docs/12). It must work from a plain static host and offline, under Vite `base` `/greyhaven/`.
- Claude runs in Claude Code on the web, in a cloud container. The user is not at a terminal. They play at GitHub Pages (`https://<user>.github.io/greyhaven/`).
- Deploy: `.github/workflows/deploy.yml` (lint → test → build → deploy to Pages on push to `main`). Every phase ends with a deployed, playable link.
- Tools: Node/npm for the game. Python 3 with `numpy` and `Pillow` for `art/source/` and `tools/econ_sim.py` (`pip install numpy pillow` if missing). Generated art is committed as PNG + JSON. The game never runs Python.

## Commands
```
npm install
npm run dev        # Vite dev server (in the container, for Playwright)
npm run build      # static build to dist/ (base /greyhaven/)
npm run preview    # serve dist/ for screenshot checks
npm test           # Vitest unit tests
npm run test:e2e   # Playwright smoke test
npm run lint
```

## Checking visuals (Playwright)
Run `npm run build && npx vite preview` (or the dev server), drive it with headless Chromium and take screenshots. Compare them to `art/scene_overcast_day.png` and `art/scene_rainy_dusk.png`: the projection, scale, depth order and palette must match. Attach the key screenshots to the PR or summary.

## Git flow and autopilot (user, 2026-10-11)
- Work on a branch, commit often, push, and open a PR with a short summary, screenshots and "how to try it".
- Claude merges its own PR once CI is green, which deploys. The user reviews afterwards. Push straight to `main` only if the user says so.
- Carry on into the next phase without waiting. Send a short note with screenshots at each milestone and at phase end. Stop only when blocked.
- Interior drafts, story outlines and other approvals: build from the recorded answers and let the user review afterwards. **Heist interiors still need approval first.**

## Session start (read only what the step needs)
1. `CHANGELOG.md` "START HERE" section: the handover between sessions (phase checklist, assumptions, art debt, known issues).
2. `docs/15_roadmap.md`: the current phase is the first one whose box in `CHANGELOG.md` is not ticked.
3. The system docs (01–19) that the current step touches. `docs/00_GAME_DESIGN.md` for pillars and decisions when a choice is unclear.
4. Visual work: `art/STYLE_GUIDE.md` (and `art/reference/README.md` for palette references and close-ups).
5. Before an interior: `docs/18_interiors.md` (ask its question list, render a draft with `art/source/interiors.py`, get approval as above).
6. Before HUD/UI work: the mockups in `art/drafts/hud/`. Match their sizes, the 5 × 7 font and the pictures of the UI redesign (docs/11, 2026-10-12: larger text, more images).
7. `docs/16_open_questions.md`: ask about these, never assume.

## Definition of done (every phase)
- Every item in the phase checklist works in the running game.
- Unit tests and the smoke test pass. No TypeScript or lint errors.
- Screenshots of the new features have been checked against the reference scenes.
- `CHANGELOG.md` updated: what was built, how to try it, assumptions, art debt, known issues.
- Docs updated if a behaviour or number changed.
- Pushed with a PR (merged under autopilot). The deploy workflow passes on `main`.
- A short summary for the user: the Pages link, what to try, screenshots, and any questions.

## Doc map
| File | Topic |
|---|---|
| 00_GAME_DESIGN | Overview, pillars, loops, decisions |
| 01_world_and_time | Districts, map, clock, NPC crowd, street layout |
| 02_economy | Money, laundering, prices, fines, pacing |
| 03_civilian_careers | Jobs, shifts, promotions, perks, arrest effects |
| 04_crime | Crimes, smuggling, heists, reputation |
| 05_police_and_wanted | Detection, stars, response, arrest, death |
| 06_minigames | Skill-check framework and every minigame |
| 07_combat_and_weapons | Weapons, ammo, health |
| 08_vehicles | Driving, damage, fuel, upgrades, stealing |
| 09_property_hideouts_crews | Houses, add-ons, operations, crews |
| 10_progression | Ranks, reputation unlocks, goals |
| 11_ui_hud_controls | HUD, prompts, menus, controls, camera, onboarding |
| 12_save_system | Saves, export/import, versioning |
| 13_art_and_audio | Art pack usage, new art, sound |
| 14_tech_architecture | Stack, layout, isometric engine, performance, tests |
| 15_roadmap | Phases 0–8 |
| 16_open_questions | Ask the user |
| 17_story_and_characters | Cast, optional mission chains |
| 18_interiors | Interior rules, drafts, questions before each interior |
| 19_visibility | Sight rules: visible / remembered / unseen rooms |
| 20_workflow | This file |
