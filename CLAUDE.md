# CLAUDE.md — Double Life

Single-player isometric pixel-art life sim / crime sandbox. Phaser 3 + TypeScript + Vite, browser only. Design is in `/docs` (source of truth: if code and docs disagree, docs win unless the user says otherwise, then update the docs in the same change). Art direction is in `/art`.

**Start of session:** read the "START HERE" section of `CHANGELOG.md` and only the files it names. Workflow, commands, Playwright checks, definition of done and the doc map: `docs/20_workflow.md` (read the section you need, not the whole file).

## Workflow (short)
- One phase at a time, small playable steps; keep `npm run build`, `npm test`, `npm run lint` green. Commit often on a branch, open a PR with screenshots.
- **Autopilot (user, 2026-10-11):** merge your own PR once CI is green, carry on into the next phase, short note with screenshots per milestone, stop only when blocked. Heist interiors need approval first.
- `CHANGELOG.md` is the handover between sessions: keep checklist, assumptions, art debt and known issues current.
- Doc silent → simplest behaviour that fits the pillars, log it under "Assumptions". Items in `docs/16_open_questions.md` or major design choices → ask the user.
- Visual work → screenshot with Playwright and compare to `art/scene_overcast_day.png` / `art/scene_rainy_dusk.png`. Read `art/STYLE_GUIDE.md` first; HUD/UI must match `art/drafts/hud/`.
- Economy numbers changed → re-run `python3 tools/econ_sim.py` and update the pacing table in `docs/02_economy.md`.

## Code rules
- All numbers in `src/config/balance.ts`; all catalogues in `src/data/*.ts`. No magic numbers.
- One serialisable state store; Phaser only displays it (docs/14).
- Vitest tests for economy, laundering, wanted, arrests, careers, save migrations.

## Hard rules
1. **Art:** use the art pack; new art only via `art/source/` (docs/13). No blocky/voxel figures, no rounded "bubble" cars, never coloured rectangles. Log temporary sprites under "Art debt".
2. **Gold** only for valuables and interactables.
3. **Pixel-perfect:** `pixelArt: true`, `roundPixels: true`, integer zoom, nearest-neighbour, no sub-pixel camera.
4. **Projection:** `screenX = x − y`, `screenY = (x + y)/2 − z`; 1 tile = 32 world units = 64 × 32 px; sort by world `x + y` of the ground anchor.
5. **Saves never break:** shape change → bump `SAVE_VERSION`, add migration + test.
6. **Content:** drugs are abstract "product" (3 tiers, no real names/processes). Blood allowed (marks/pools where people go down; downed people fall then fade). No dismemberment. Violence readable at pixel scale.
7. **Dense spaces:** never empty. Follow density rules in docs/18, use `art/source/decor.py`, make missing decor. Outdoors is a real city: tight blocks, alleys, infill, dressed sidewalks, varied paving, rounded corners and curved streets. New streets ≥ 2 lanes each way (existing Downtown streets stay 1). See docs/01.
8. **Furniture** front is local +y; use `face()` and check pairs (chair → desk, sofa ↔ TV) in a render.
9. **Sight:** interiors follow docs/19. Sight lines on (default) → never show rooms the character can't see. Visual only; NPCs always use line of sight.
10. **Heists:** multi-room, security first, loud + quiet approach, loot weight, several escapes (docs/04). Never a single interaction.
11. **No scope creep:** no systems the docs don't describe without asking.
12. **No backend:** no server, API, database, login, telemetry or runtime fetches to other origins. Fully offline once loaded; assets bundled under base `/greyhaven/`.
13. **Interiors:** follow docs/18 (questions, draft via `art/source/interiors.py`) before building one.
