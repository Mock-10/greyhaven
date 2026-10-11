# 01 — World and Time

## Scale and grid
- One tile is a 64 × 32 px isometric diamond, which is 32 world units (≈ 1.4 m).
- A person is about 40 px tall. A car is about 90 px long. A two-lane road is 4 tiles wide, with sidewalks 2 tiles wide on each side.
- Buildings are true scale relative to people. See `art/STYLE_GUIDE.md`.

## Town layout
The town is called **Greyhaven**. It is hand-authored. Target size is about **320 × 320 tiles** (raised from 160 × 160 on 2026-10-11), with the main districts joined by a ring road and a highway spur out to the fields.

**The end goal is a massive, dense open world** (user direction, 2026-10-11): a vast Downtown with skyscrapers and many buildings to enter, suburbs on the outskirts, a hood district, the Docks and Industrial areas, and a range of housing options. Outside the detailed districts, the map is filled with **large plain areas of grass or unused ground** that can be built on later. The big open fields and the woods (for the lumber and farming jobs) stay part of the plan.

**The Phase 1 Downtown is a test map, not the final city.** It packs one of each kind of place (tower, store, apartment block, bar, chop shop) close together for testing. Don't treat its size or layout as the final Downtown. The full city is laid out in Phase 6.

| District | Feel | Contents | Main jobs and crimes |
|----------|------|----------|------------------------|
| **Downtown** | Towers, plazas, rain on glass | Office tower (office job), bank, ATMs, corner stores, jewellery store, police HQ, NPC launderer (back room of a bar) | Office worker, security guard · store robbery, ATM robbery, carjacking, bank heist |
| **Suburbs** | Gable roofs, lawns, mailboxes | Rentable and buyable houses, a small store, the starter apartment block | Delivery routes · house burglary, trunk looting |
| **Industrial** | Warehouses, rust, dumpsters | Mechanic garage, legal scrap yard, chop shop (black market, behind the scrap yard), weapon dealer, warehouses for hideouts | Car mechanic, road worker, scrap yard worker · chop shop, smuggling pickups |
| **Docks** | Containers, water, cranes | Container yard, piers, fishing shacks | Smuggling drops, armored truck route, product supplier |
| **The hood** (added 2026-10-11; name and details decided at Phase 6 planning) | Dense, run-down blocks | Low-rise housing, corner shops, courts, alleys | To be decided with the user |
| **Outskirts** | Fields, forest, dirt roads | Lumber camp, Old Pete's farm, open fields where planes airdrop product at night, highway, isolated barns | Lumberjack, farmer · airdrop pickups, remote smuggling drops, chop shop dumping |

The starter apartment block, **Drizzle Row Residences**, stands on the edge of Downtown (decided 2026-10-10), so the Phase 1 vertical slice has a home. It stays there when the Suburbs are built.

### Street layout and density (user direction, 2026-10-10)
After playing the first Downtown build, the user found it too empty, too open and too boxy. These rules apply to every outdoor area:
- **A real city, not open lots.** Close the space in. Blocks are tight, and buildings front onto the sidewalk with infill buildings, shopfronts and alleys between them. Parking lots are small and edged with planters, fences or low walls. Avoid wide strips of plain sidewalk or concrete, especially in front of stores.
- **Dense decoration.** Every stretch of sidewalk is dressed: lamps, benches, bins, planters, trees in tree pits, hydrants, bus stops, newspaper boxes, phone booths, bike racks, café tables and awnings, kiosks, signage and posters. Alleys get dumpsters, pallets, crates, pipes and AC units. Plazas get fountains, seating and planters.
  - **Density rule (approved 2026-10-11):** no walkable open patch larger than about 3 × 3 tiles without a prop or a change in paving, except roads and deliberately designed open spaces. The map tests check it.
- **Varied surfaces.** Break up repeated paving with tile variants, paving patterns, kerb details, grates, cracks, puddles and painted markings.
- **Curves, not a box grid.** Use rounded street corners, streets with curved bends, and curved spaces (curved plazas, a roundabout, curved planters and walls) wherever they suit the look. Downtown can stay mostly orthogonal, but not squared off. Outer districts can curve more.
  - **How (decided 2026-10-11):** streets, sidewalks, plazas and paving are drawn as **vector shapes in world units** and baked into the ground chunks in the pixel style, so curves can have any radius. The ground textures come from `art/source/ground2d.py`. See 14 ("Ground").
  - **In the test Downtown (decided 2026-10-11):** a curved plaza in front of Pellridge Tower and at least one bending street, plus rounded kerbs at every crossing and curved planters and low walls where they fit.
- **Infill buildings** (decided 2026-10-11): the small buildings and shopfronts that close the gaps between the main buildings are facades only (signs, awnings, lit windows at night). Some can become enterable later, each with its own interior question round.
- **Faster on foot.** Walking and sprinting must feel quick for the size of the map, and driving comes later for longer trips. The speeds live in `BALANCE.walker`. The first build's sprint (about 1.9 tiles/s) was too slow. Since 2026-10-11: walking 48 units/s (1.5 tiles/s), sprinting 2.3× (about 3.4 tiles/s), tuned by feel from there.

### Names (approved 2026-10-10)
- **District nicknames:** Downtown "The Ledger", Suburbs "Hedgerow Park", Industrial "The Works", Docks "Saltgate", Outskirts "Far Acres".
- **Downtown streets:** Overcast Avenue (main east–west), Pewter Street (main north–south), Ledger Lane, Drizzle Row, Gullsway (towards the Docks), Millwright Road (towards Industrial).
- **Businesses:** office: Pellridge Mutual Assurance in Pellridge Tower · corner store: Open Most Hours · bar (Dez): The Low Tide · chop shop: Marlo's Tow & Salvage ("WE BUY ANY CAR*") · apartments: Drizzle Row Residences · bank: Greyhaven Savings & Loan · police: Greyhaven PD, Precinct 1 · jeweller: Gilt & Ward · gas station: Pump & Go · mechanic: Torque & Sons Garage · scrap yard: Ferris Metals · lumber: Ashby Timber · delivery depot: Swiftish Couriers · hospital: St. Agnes General · fronts: Clean Getaway Laundromat, Squeaky's Car Wash, Static (nightclub).

Building interiors are separate small maps entered through doors: apartment, store, office floor, bank vault and so on. This keeps the outdoor map light and gives heists a contained stage.

## Time
- **1 in-game day = 20 real minutes by default.** 1 in-game hour = 50 real seconds.
- **Day-length setting:** 15, 20 or 30 real minutes per in-game day. All in-game-time values (shift length, opening hours, operation cycles, rent, timers measured in in-game hours or days) scale automatically, because they are stored in in-game units. Values measured in **real seconds** (minigame timings, the star escape timer, witness call delay) do **not** scale. The economy is balanced per in-game day, so money per day stays the same and only real playtime changes (about 7.5–11 h at 15 min, 15–22 h at 30 min).
- **Walking speed** is the same on screen in every direction; with two keys the character walks along the tile edges (decided 2026-10-11 after the user found straight up and down slower than diagonals).
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
