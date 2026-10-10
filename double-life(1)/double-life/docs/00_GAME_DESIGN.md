# Double Life — Master Game Design Document

**Working title:** Double Life
**Genre:** Single-player, open-world life sim and crime sandbox
**Platform:** Desktop web browser (mouse + keyboard)
**Stack:** Phaser 3 + TypeScript
**View:** Isometric pixel art in the style of Project Zomboid / RollerCoaster Tycoon 2, using the Grey Weather palette
**Target length:** 10–15 hours, or about 30–45 in-game days (1 in-game day = 20 real minutes by default)

This file is the overview and the map of the docs. Every system has its own file, and the numbers live in those files. When this overview and a system file disagree, **the system file wins**.

---

## 1. Pitch

You arrive in **Greyhaven**, a small grey city, with a basic job and a tiny apartment. You can earn a living honestly by filing paperwork in the downtown tower, fixing cars, felling trees or delivering parcels. You can also pull on a mask after your shift and steal cars, rob stores, smuggle product and launder the cash.

Nobody forces a path. The game is about balancing **safe, slow, clean money** against **fast, risky, dirty money**, and about how each life protects or endangers the other.

## 2. Design pillars

1. **Freedom of path.** Every job and every crime is open from the first day. What gates them is skill, tools, money and reputation, never a class choice.
2. **Risk versus reward.** Crime pays about 1.5–2.5× more per real hour than honest work at the same stage. Heat, fines, jail, laundering losses and lost cargo eat into that margin.
3. **The two lives touch.** A day job gives you a clean income, a cover and insider access. A criminal record freezes promotions and costs shifts. Masks and bribes protect your identity.
4. **Hands-on actions.** Every job task and every crime runs through a short skill-check minigame, never a single button press.
5. **Readable, moody pixel art.** The world is muted lavender-grey. **Gold always means "valuable or interactable."**

## 3. Core loops

**Moment to moment** (seconds): walk or drive → spot something interactable (gold rim) → press E → play the minigame → get a payout or set off an alarm.

**Daily** (one 20-minute day):
```
06:00 wake → commute → 08:00–10:00 clock in → shift: 3–4 key tasks → clock out (clean pay)
→ evening: free roam, shopping, upgrades, laundering
→ 22:00–06:00 night: crime window (fewer witnesses, darker)
→ sleep at home: skip to morning + autosave
```

**Weekly** (7 days): rent is due every 7 days. Promotions and the weekly clean-record bonus land, operations need restocking and crew get paid.

**Long term** (whole game): career rank in each job, criminal reputation tiers (Nobody → Hustler → Known → Connected → Boss), property and hideout add-ons, crews, front businesses, and big heists.

## 4. Systems index

| # | File | Covers |
|---|------|--------|
| 01 | [World and Time](01_world_and_time.md) | Districts, map, day/night clock, schedules, NPC crowd |
| 02 | [Economy](02_economy.md) | Clean and dirty money, laundering, costs, all prices, pacing targets |
| 03 | [Civilian Careers](03_civilian_careers.md) | Jobs, shifts, promotion XP, pay, insider perks, arrest effects |
| 04 | [Crime](04_crime.md) | Crime catalogue by tier, smuggling, printing, chop shop, heists, reputation |
| 05 | [Police and Wanted](05_police_and_wanted.md) | Stars, witnesses, cameras, masks, response tiers, arrest, jail, bribery |
| 06 | [Minigames](06_minigames.md) | Skill-check framework, every minigame, difficulty, tools, assists |
| 07 | [Combat and Weapons](07_combat_and_weapons.md) | Weapons, ammo, dealers, looting, health, death |
| 08 | [Vehicles](08_vehicles.md) | Arcade driving, damage, fuel, upgrades, carjacking, trunks, garages |
| 09 | [Property, Hideouts and Crews](09_property_hideouts_crews.md) | Housing, hideout add-ons, operations, crew roles |
| 10 | [Progression](10_progression.md) | Career ranks, reputation tiers, the full unlock table |
| 11 | [UI, HUD and Controls](11_ui_hud_controls.md) | HUD, prompts, menus, camera, key bindings |
| 12 | [Save System](12_save_system.md) | Slots, autosave, export/import, versioning |
| 13 | [Art and Audio](13_art_and_audio.md) | Using the art pack, making new art, sound effects list |
| 14 | [Tech Architecture](14_tech_architecture.md) | Project layout, isometric engine, simulation, data-driven config |
| 15 | [Roadmap](15_roadmap.md) | Build phases, starting with the vertical slice |
| 16 | [Open Questions](16_open_questions.md) | Things not decided yet. **Ask the user; do not invent answers.** |
| 17 | [Story and Characters](17_story_and_characters.md) | Light story: named characters, optional mission chains |
| 18 | [Interiors](18_interiors.md) | Cutaway interior rules, 4 draft rooms, interior list, questions to ask before building each one |
| 19 | [Sight and Hidden Rooms](19_visibility.md) | Line of sight: unseen rooms covered, remembered rooms dimmed, closed doors block sight; NPCs use the same rules |

## 5. Decisions at a glance

| Area | Decision |
|------|----------|
| Money | Two currencies: **clean** and **dirty**. Dirty money must be laundered before legal spending. |
| Laundering | NPC launderers early (35%, later 25% cut). Front businesses later (12% cut, higher daily capacity). |
| Tone | Mixed. Civilian life is grounded and wry; crime is tense and gritty. |
| Time | Full day/night cycle with job shifts. Shifts are shortened: 3–4 key tasks, then clock out. |
| Start | Civilian with a small rented apartment. The player picks a starting job: office worker, car mechanic, lumberjack or delivery driver. |
| Crimes | All available from day one, but harder without tools or skill. Minigame difficulty scales by crime tier, and tools add tolerance. |
| Wanted | Classic 1–5 stars. Witnesses call after an interruptible delay, cameras record, police investigate then search. |
| Police top tier | Helicopters and military-style units. |
| Losing stars | A timer, sped up by changing vehicle, changing mask or clothes, or bribing police. |
| Arrest | Surrender for a lower penalty, or run. First offense is a fine; repeat offenses mean jail. Dirty cash is seized only on jail. |
| Career impact of arrest | Promotion freeze for a few days, missed shifts cost pay, and extra work required for 1–2 days afterwards. |
| Bribery | Police, lawyers and judges, gang contacts, bosses/HR. Fixed amounts by tier. |
| Progression | Separate tracks: career rank per job (kept when switching jobs) and criminal reputation. |
| Gangs | Crews you recruit. Operators run operations and drivers run shipments. Cap of 4. |
| Hideouts | Add-ons to an owned house. Operations give passive income but need restocking or they stall. |
| Smuggling | Buy product, drive it to a drop. 3 product tiers. Cargo value drops with vehicle damage. |
| Heists | One big set piece with a short prep phase. |
| Combat | Several weapon types, each with its own ammo type. Dealers are open to everyone, and heavy weapons are very expensive. Weapons can also be looted. |
| Vehicles | Arcade driving with damage, fuel and upgrades. No gating, anything you can afford. |
| Death | Wake at the hospital, pay a fee, keep your items. |
| Costs | Rent every 7 days, plus fuel, repairs and ammo. Late rent builds fees, with eviction after two missed weeks. |
| NPCs | A simple crowd. Witnesses only matter during crimes (GTA V-style reactions). |
| World | Compact town: Downtown, Suburbs, Industrial, Docks, plus Outskirts fields for lumber and farming. |
| Camera | Isometric. The player can pan it with the mouse. |
| HUD | Classic GTA style: radar, health, weapon and ammo, stars, both cash amounts, clock. |
| Save | Browser storage, multiple slots, export and import of backup files. |
| Audio | Sound effects first, music later. |
| Onboarding | A short guided first day. |
| Accessibility | Minigame assist options. |
| World events | None at first; add later. |
| Town | **Greyhaven**. |
| Story | Light story: a few named characters with optional mission chains (17). Pure sandbox otherwise. |
| Character | Simple creator: skin tone, hair style and color, starting outfit. |
| Firing | **Never.** Arrests only cause freezes, lost pay and extra work. |
| Rivals | Light rivals: occasional rival crews ambush shipments or hit hideouts. No turf wars. |
| Jobs | 4 starting jobs plus 4 later ones: security guard, road worker, farmer, scrap yard worker. |
| Airdrops | Product can also arrive by small plane, dropped into Outskirts fields at night. |
| Day length | Setting: 15, 20 (default) or 30 real minutes. |
| Heists | Three: jewellery store, docks container, downtown bank. |
| Death | Hospital fee only. |
| Hosting | GitHub Pages (static build). **Fully browser-based**: client-side only, no backend, all assets bundled, saves in the browser. |
| Development | Claude Code on the web (cloud). Every phase is deployed to Pages so the user plays it from a link. |
| Analytics | Local-only play stats in the save, shown in a dev panel. Never sent anywhere. |
| HUD | Drafted: `art/drafts/hud/` (see 11). |
| Sight | Players only see what their character could see. Rooms behind closed doors stay hidden; the vault's gold is unseen from the lobby (see 19). A **Sight lines** setting (default on) can turn this off so everything is visible; NPC line of sight is unaffected. |
| Interiors | Cutaway style, drafted: `art/drafts/interiors/` (see 18). Claude Code asks the user per interior before building. |
| Build order | Vertical slice first: one district, one job, one crime, driving, saving. |

## 6. Content and tone guardrails

- Drugs are abstracted as **"product"** in three tiers. There are no real drug names and no recipes. A lab is a hideout room that turns supplies into product.
- Violence is shown at the pixel scale with no gore. Downed NPCs fade out.
- The tone of the game shifts with the active path. Civilian scenes carry light, dry humour. Crime is tense: music cues, rain and sirens.
