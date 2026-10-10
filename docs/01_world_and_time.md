# 01 — World and Time

## Scale and grid
- One tile is a 64 × 32 px isometric diamond, which is 32 world units (≈ 1.4 m).
- A person is about 40 px tall. A car is about 90 px long. A two-lane road is 4 tiles wide, with sidewalks 2 tiles wide on each side.
- Buildings are true scale relative to people. See `art/STYLE_GUIDE.md`.

## Town layout
The town is called **Greyhaven**. It is compact and hand-authored. Target size is about **160 × 160 tiles**, with the main districts joined by a ring road and a highway spur out to the fields.

| District | Feel | Contents | Main jobs and crimes |
|----------|------|----------|------------------------|
| **Downtown** | Towers, plazas, rain on glass | Office tower (office job), bank, ATMs, corner stores, jewellery store, police HQ, NPC launderer (back room of a bar) | Office worker, security guard · store robbery, ATM robbery, carjacking, bank heist |
| **Suburbs** | Gable roofs, lawns, mailboxes | Rentable and buyable houses, a small store, the starter apartment block | Delivery routes · house burglary, trunk looting |
| **Industrial** | Warehouses, rust, dumpsters | Mechanic garage, legal scrap yard, chop shop (black market, behind the scrap yard), weapon dealer, warehouses for hideouts | Car mechanic, road worker, scrap yard worker · chop shop, smuggling pickups |
| **Docks** | Containers, water, cranes | Container yard, piers, fishing shacks | Smuggling drops, armored truck route, product supplier |
| **Outskirts** | Fields, forest, dirt roads | Lumber camp, Old Pete's farm, open fields where planes airdrop product at night, highway, isolated barns | Lumberjack, farmer · airdrop pickups, remote smuggling drops, chop shop dumping |

Building interiors are separate small maps entered through doors: apartment, store, office floor, bank vault and so on. This keeps the outdoor map light and gives heists a contained stage.

## Time
- **1 in-game day = 20 real minutes by default.** 1 in-game hour = 50 real seconds.
- **Day-length setting:** 15, 20 or 30 real minutes per in-game day. All in-game-time values (shift length, opening hours, operation cycles, rent, timers measured in in-game hours or days) scale automatically, because they are stored in in-game units. Values measured in **real seconds** (minigame timings, the star escape timer, witness call delay) do **not** scale. The economy is balanced per in-game day, so money per day stays the same and only real playtime changes (about 7.5–11 h at 15 min, 15–22 h at 30 min).
- Phases:
  - **Morning** 06:00–10:00: commute and clock-in window.
  - **Day** 10:00–18:00.
  - **Evening** 18:00–22:00: shops close at 21:00.
  - **Night** 22:00–06:00: dark, fewer witnesses, higher alert at banks.
- There is a 7-day week. Shifts run Monday–Friday. On weekends there are optional side gigs at 60% pay.
- **Sleeping** at an owned or rented home skips to 06:00 the next morning and autosaves. There are no survival needs (no hunger and no tiredness).
- The game is paused while menus and minigames are open. Time keeps flowing in the open world.

## Lighting and weather
- Day is an overcast palette. Dusk and night use a tint (see the style guide) with warm lamp pools and lit windows.
- **Rain** comes up at random, about 25% of nights. Rain lowers witness sight range by 25% and makes roads slick (−10% grip).
- Gold interactable cues and lit windows ignore the night tint, so they always stand out.

## NPC crowd (GTA V-style, kept simple)
- Pedestrians spawn around the player within the camera bounds plus a margin, and despawn out of sight. Target **20–35 on screen** downtown, fewer elsewhere. Density follows the time of day: busy at commute times, sparse at night.
- Traffic follows lane splines with simple car-following and stops at red lights.
- NPCs **don't remember** the player, except for the "known face" heat state (see 05).
- Reactions only matter around crime:
  - **Calm**: walk their route.
  - **Alarmed** (gunshot, crash, visible weapon within 12 tiles): flee away from the threat.
  - **Witness** (saw a crime with line of sight within 10 tiles, 7.5 at night or in rain): start the phone-call timer described in 05.
- Clerks, guards and bank tellers are named-role NPCs with fixed behaviour. A clerk hands over the till, hits the silent alarm when your back is turned, or hides.
