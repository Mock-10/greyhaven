# 12 — Save System

## Storage
- **Browser only.** Use IndexedDB through a small wrapper (for example `idb-keyval`), not localStorage, because saves can exceed localStorage's ~5 MB limit. Fall back to localStorage only if IndexedDB is unavailable.
- **Slots:** 3 manual slots plus 1 autosave slot (rotating, the last 2 are kept).
- Saves exist only in that browser on that computer, and clearing site data deletes them. Say so once in the save menu, and point to **Export** as the backup and the way to move saves between computers. Call `navigator.storage.persist()` on the first save to ask the browser not to evict them.
- If storage is unavailable (some private windows), show a notice and allow export-only saving.

## When the game saves
- **Autosave:** when sleeping, at clock-out, when buying property, and every in-game morning at 06:00 if the player is not wanted.
- **Manual save:** at any owned home or hideout (the bed or the phone while inside). Saving is blocked while wanted or in a minigame.

## What is saved
The complete game state, as one plain JSON-serialisable object:
- `meta`: save version, slot, timestamp, playtime, in-game day and time, a thumbnail (a small PNG data URL of the screen).
- `player`: position and district, health, armor, inventory, loadout, mask/outfit, clean and dirty cash, offense record, heat states, active stars (always 0 at save).
- `careers`: rank and XP per job, current job, freeze and extra-work timers.
- `crime`: reputation, contacts unlocked, heist cooldowns.
- `property`: owned properties, add-ons, stash contents, operations' state and timers, fronts.
- `crew`: members, roles, stats, wage-paid-until.
- `vehicles`: owned vehicles (health, fuel, upgrades, trunk, location), hot timers on stolen cars.
- `world`: weather seed, rent ledger, persistent props (e.g. a looted car stays looted for the day).
- `story`: mission chain progress per character, rival pause timer.
- `sight`: rooms seen per interior (for the remembered state); door open/closed states for owned properties.
- `appearance`: the character creator choices and name.
- `stats`: local-only play stats (below).
- `settings` are stored **separately**, not in slots. This includes the sight lines toggle, which is a per-player preference and not part of a save slot.

## Local-only play stats (for balancing)
Recorded in the save and **never sent anywhere** (decided): money earned per source per day, time per activity (work, crime, driving, menus), arrests, deaths, star levels reached, minigame grades per type, rank/tier reached per day.
Viewable in the dev panel (F1 cheat console → Stats) and exportable as JSON with the save. Use this data to check the pacing table in 02.

The NPC crowd and traffic are **not** saved. They respawn.

## Phase 1 build (milestone 4)
- SAVE_VERSION 1. Storage is IndexedDB, with localStorage when it's missing and export only when neither works.
- Esc opens the pause menu: RESUME, SAVE GAME (in the apartment, not while wanted), LOAD GAME, EXPORT SAVE, IMPORT SAVE.
- Autosave on sleep, rotating between two autosave slots. Clock-out, property purchase and the 06:00 autosave come with Phase 2.
- After a load, the car you drove last waits in the apartment's street spot on Drizzle Row (decided 2026-10-11).

## Export and import
- **Export:** download `doublelife-save-<slot>-<date>.json`. The file includes the version number and a checksum.
- **Import:** pick a file, validate the schema and checksum, show the summary (day, cash, ranks), then pick the slot to load it into.

## Versioning
- `SAVE_VERSION` is an integer. A migration function exists for each version bump (`migrations[n](state) → state for n+1`).
- **Never** break old saves without a migration. Add a unit test per migration.

## Phase 2 build (milestone 5, 2026-10-11)
- **SAVE_VERSION 2.** The v1 → v2 migration adds the bank balance, the statement and rent, the calendar marker, the phone's messages, the career's freeze and extra-work timers, missed shifts and the week's pay, entries for all four jobs, and the fuller bag (fuel cans, first-aid kits, repair kits, lockpick uses, toolbox, stolen phones and watches). Cars keep a `looted` flag (optional, so no migration needed).
- **Autosave** also on clock-out and every morning at 06:00 when not wanted (sleeping still autosaves once).
- **Manual save** also at St. Brine's shelter (stand at its door). While evicted, the apartment doesn't count as home.

## Phase 3 build (milestone 9, 2026-10-12): save v6
New fields: `crime` (reputation, waiting payouts, contacts), `heat` (identifications by source), `crimeLog` (when each store, house and ATM was last hit), `goods` (burglary goods for the fence), `masks` and `maskOn`, and `inventory.drill`. Migration 5 → 6 starts everyone with no reputation and nothing on file.

## Phase 4 build (milestone 14, 2026-10-12): save v8
Each saved car gets `mods` (upgrade levels) and `stash` (its trunk: weapons and goods); `flat` (burst tyres) is optional. Migration 7 → 8 gives every car no upgrades and an empty trunk and drops a wreck's burning timer. (Save v7, milestone 13, added `combat`: the loadout, ammo and the drawn slot.)

