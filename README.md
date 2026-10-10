# Double Life

Isometric pixel-art life sim and crime sandbox for the browser. By day you file paperwork; by night you might do something else.

- **Design:** `docs/00_GAME_DESIGN.md` (start here)
- **Build instructions for Claude Code:** `CLAUDE.md`
- **Art pack and style guide:** `art/` (`art/STYLE_GUIDE.md`, reference scenes `art/scene_*.png`)
- **Economy sim:** `python3 tools/econ_sim.py`

Runs entirely in the browser (static site on GitHub Pages, no backend). Built with Claude Code on the web. To start, follow `START_HERE.md`.

## Play

`https://mock-10.github.io/greyhaven/`. Progress, what to try and known issues for each phase are in `CHANGELOG.md`.

## Develop

```
npm install
npm run dev        # Vite dev server at http://localhost:5173/greyhaven/
npm run build      # static build to dist/ (base /greyhaven/)
npm run preview    # serve dist/ at http://localhost:4173/greyhaven/
npm test           # Vitest unit tests
npm run test:e2e   # Playwright smoke test against the production build
npm run lint       # ESLint + Prettier
npm run shots      # screenshots to shots/ (after npm run build)
npm run compare    # pixel comparison of shots/reference_1x.png with art/scene_overcast_day_1x.png
```
