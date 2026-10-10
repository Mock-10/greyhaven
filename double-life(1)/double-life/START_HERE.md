# Start here

This folder holds everything Claude Code needs to build **Double Life**: the design docs, the art pack, the drafts and the build instructions.

**How it runs:** the game is **100% browser-based**. It is a static site that runs entirely client-side, with no server, no accounts and no downloads, and saves are kept in the browser. **Claude Code builds it in the cloud** (Claude Code on the web). Every phase is deployed to **GitHub Pages**, so you play each build from a link, on any computer, without installing anything.

## One-time setup (about 10 minutes)
1. **Create the repo.** On GitHub, create a new repository named **`greyhaven`**. Make it public: GitHub Pages is free for public repos, and private repos need a paid plan.
2. **Upload this package.** Unzip it, then on the repo page choose **Add file → Upload files**. Drag in *everything inside* the `double-life` folder (`CLAUDE.md`, `START_HERE.md`, `docs/`, `art/`, `tools/`) and commit to `main`.
   - Upload the *contents* of the folder, not the folder itself, so `CLAUDE.md` sits at the repo root.
   - If the web uploader skips folders, drag in a few at a time.
3. **Turn on Pages.** In the repo, open **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**. Claude Code adds the workflow in Phase 0.
4. **Connect GitHub to Claude Code.** Open **claude.ai/code**, sign in, and connect your GitHub account when asked. This installs the Claude GitHub App. Give it access to the `greyhaven` repo.
5. **Cloud environment.** When you start the session, use an environment with network access (the default "Trusted" setting allows npm and pip). If you can edit the environment's **setup script**, add this line so the art tools work:
   ```
   pip install numpy pillow
   ```
   This is optional, because Claude Code installs them itself if they're missing.

## Start the build
Start a new session at **claude.ai/code** with the `greyhaven` repo selected, and send:

> Read CLAUDE.md, then docs/00_GAME_DESIGN.md and docs/15_roadmap.md. Plan Phase 0 as a checklist in CHANGELOG.md, then build it. Get the GitHub Pages deploy working in Phase 0. Stop when Phase 0's "Done when" checks pass, and give me the link to play it.

## After each phase
- Claude Code pushes its work, opens a pull request (or pushes to `main`, if you've told it to), and gives you the **Pages link** plus screenshots.
- **Merge the PR**, wait about a minute for the deploy, then open `https://<your-username>.github.io/greyhaven/` and play.
- Reply in the same session with "continue to the next phase" or with what to change. You can also start a fresh session later. Claude Code picks up where it left off from `CHANGELOG.md`, since cloud sessions don't share memory.

## What Claude Code will ask you along the way
- The question round for each interior before it is built (`docs/18_interiors.md`).
- Street and business names for Greyhaven, as a proposed list (Phase 1).
- Each story character's chain outline before writing it (`docs/17_story_and_characters.md`).
- A name and look for the rival crew (Phase 5).

## Map of the folder
- `CLAUDE.md`: rules and workflow for Claude Code
- `docs/`: the game design (00 is the overview; 19 is the sight rules)
- `art/`: atlases, palette, style guide, reference scenes, drafts (HUD, interiors, street close-ups, decoration library), the user's palette references in `art/reference/`, and the art generator in `art/source/`
- `tools/econ_sim.py`: the economy balance check
