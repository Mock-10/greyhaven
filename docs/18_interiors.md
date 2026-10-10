# 18 — Interiors

Interiors are separate small maps you enter through a door. This doc sets the **rules every interior follows**. It includes four **draft interiors** that show the intended direction, and a **question list Claude Code must ask the user** before building each interior.

## Draft interiors (reference direction, v2)
These lock in the look. Match them. Generate new drafts with `art/source/rooms.py`: `compose()`, `back_walls()` with wall decals, `partition_segments()` for internal walls, and the furniture and decoration library in `decor.py`.

| Draft | File | Shows |
|---|---|---|
| Starter apartment | `art/drafts/interiors/interior_apartment.png` | Bed, wardrobe and stash (interactable), kitchen with clutter and tiles, dining table with chairs facing it, TV ↔ sofa facing each other, armchair, rugs, plants, paintings, clock, mirror, curtains |
| Corner store (3 rooms) | `art/drafts/interiors/interior_store.png` | Shop floor (register, clerk, shelves, freezers, ATM, news rack), **locked back room** (lockpick door, safe, stock shelves, ledger desk), **security room** (CCTV desk: disable cameras; DVR: wipe footage) |
| Office floor | `art/drafts/interiors/interior_office.png` | Cubicles with chairs facing the monitors, desk clutter and small plants, filing cabinets (job task), whiteboard, bookshelf, manager's desk with visitor chairs facing it, break corner (vending, cooler, coffee, armchairs), big plants |
| Bank heist (multi-room) | `art/drafts/interiors/interior_bank.png` | Lobby, manager's office, security room, corridor gate and vault, with the numbered heist steps and a legend (see `04_crime.md`) |
| Decoration library | `art/drafts/decor_library.png` | All 58 furniture and decoration assets |

## Visual rules
1. **Cutaway view (Project Zomboid style).** The two back walls (top-left and top-right edges of the room) are full height and show their inner faces. The two front walls are cut down to **stubs about 7 units tall** so the room is always visible. The **cut tops of all walls are dark plum** (`night` ramp), which reads as a section cut.
2. **Same projection and scale as outdoors:** 1 tile = 32 units, a person is 40 units tall. Ceiling height is **62 units** (≈ 2.7 m) and walls are **5 units** thick. Standard doors are **22 units** wide; double doors and vault openings are 44–52.
3. **Back-wall detail:** wallpaper with subtle vertical stripes, a dark wood baseboard, a white crown strip, windows (showing a faint grey skyline), framed pictures and posters.
4. **Floors:** interior floor tiles from `ground2d.py`: `woodfloor` (homes), `linoleum` (stores), `carpet` (offices), `marble` (bank), `concrete` (warehouses, garages, hideout rooms). There are no tile-edge seams indoors.
5. **Ambient occlusion:** a soft dark strip along the base of the back walls, plus contact shadows under furniture. Interiors don't get the outdoor night tint. Only the windows change with the time of day.
6. **Interactables follow the gold rules:** idle rim in range, hover rim plus prompt when targeted, sparkles on valuables. Furniture that does nothing has no rim.
7. **Furniture is built in the same SDF style:** smooth forms, realistic proportions, nothing blocky. Heights relative to a 40-unit person: bed 13, counter 21, desk 17, fridge 43, wardrobe 49, shelf 35.

## Multi-room buildings
- Buildings are split into rooms by **internal partition walls**. These are always drawn **cut down** (about 11 units tall, dark cut top), like the front stubs, so every room in the building is readable at once. Only the two outer back walls are full height.
- In the game, partition walls are depth-sorted with the furniture in short segments (16 units), as in the drafts.
- Doors in partitions are door-leaf objects standing in the gap. A locked door gets the gold rim and a `LOCKPICK DOOR` or keycard prompt.
- Rooms have a **purpose and a security state**: public, staff-only (locked), or secure (keycard or code). Heists and robberies move through them in order.

## Decoration density (spaces must never feel empty)
**Rule for Claude Code:** an interior is not finished until it reads as lived-in. Use the decoration library generously.
- **Floor:** at least one piece of furniture or decoration per ~2 × 2 tiles of floor, plus rugs that define areas (living, dining, waiting).
- **Back walls:** something on every ~3 tiles of wall: a window with curtains, a painting, a poster, a clock, a shelf, a whiteboard, a calendar, a fire extinguisher, an exit sign or a fuse box.
- **Surfaces:** tables, desks and counters carry clutter: papers, mugs, vases, fruit, lamps, kitchen items, monitors.
- **Corners** get plants (tall plant, snake plant or ficus) or a lamp.
- **Context fits the place:** homes are warm and personal; offices are tidy, with clutter on desks; stores have stock, signs and freezers; back rooms are utilitarian (boxes, mop, broom, shelving); banks are formal (stanchions, marble, gold accents, big plants).
- **Exteriors too:** streets get planters, bins, newspaper boxes, bike racks, bollards, bus stops, benches and lamps (in the library and the street scene).
- **Keep paths walkable:** at least 1 tile of clear path between the doors and every interactable.
- **Never cover an interactable** with decoration, and never use gold on decoration (gold stays reserved for interactables and valuables).
- When something is missing from the library, **make a new asset** with the same pipeline. Don't leave the space bare.

## Facing rules (furniture must face the right way)
- **Convention:** every model's **front faces local +y**. Place models with `face('+x' | '-x' | '+y' | '-y')`, which returns the render angle that points the front in that world direction.
  - Wall-mounted models have their back on the wall plane.
  - Character sprite indices: 0 = facing +x, 2 = +y, 4 = −x, 6 = −y.
- **Pairs must face each other or their target:**
  - chair → desk, table or monitor
  - sofa ↔ TV
  - armchair → coffee table or TV
  - visitor chairs → desk front
  - clerk → counter front
  - teller → customers
  - cabinets, wardrobes, fridges and shelves → into the room (back against the wall)
  - bed head against a wall
- **Check before shipping:** render the room, then confirm each pair visually. The user caught chairs facing away from computers and a sofa and TV facing apart in the first drafts; don't repeat that.

## Sight inside buildings
The drafts show every room for presentation. **In the game, rooms the character can't see are hidden** (dark lid), and rooms seen earlier are dimmed without live objects. See `19_visibility.md`.

## How interiors work in the game
- **Entering:** press E at an exterior door (gold rim). The screen fades for about 0.3 s and the Interior scene loads at that door's spawn point. Exit through the interior door the same way. In-game time keeps running.
- Each interior is a separate map file: `src/maps/interiors/<id>.json`. It holds the room grid (floor kinds), walls with doors and windows, furniture placements with collision footprints, interactables, NPC spots and schedules, cameras, and the exit door link.
- **Collision:** furniture footprints in world units. Walls are blocked cells.
- **Occlusion:** not needed for back walls. Tall furniture near the front fades when the player is behind it.
- **Crime rules indoors:** witnesses and cameras work exactly as outside (05). Clerks are witnesses. Cameras have a cone drawn on the floor when the security-guard perk (rank 2) is active.
- **Ownership:** player properties are interiors with customisation slots (09). Hideout add-ons appear as new rooms or stations.

## Interior list
| Interior | Building / district | Purpose | Key interactables | Needed by | Draft |
|---|---|---|---|---|---|
| Starter apartment | Apartment block, Suburbs | Home, save, sleep | Bed (sleep/save), wardrobe (outfit/mask), stash | Phase 1 | ✅ |
| Office floor | Greyhaven tower, Downtown | Office job | Filing cabinets, desk (data entry), manager's office (meetings) | Phase 1 | ✅ |
| Corner store (3 rooms) | Downtown and Suburbs | Shopping, robbery | Register (rob), shelves (buy), locked back room door, safe, CCTV desk, DVR | Phase 1 (shop), Phase 3 (robbery) | ✅ |
| Bar and back room | Downtown | Launderer (Dez), crew hiring | Dez (launder), job board for crew, back-room door | Phase 1 | — |
| Small and family house | Suburbs | Bought homes | Bed, wardrobe, stash, add-on rooms | Phase 5 | — |
| Burglary houses (2–3 layouts) | Suburbs | House burglary | Drawers, safes, TVs and jewellery boxes to loot | Phase 3 | — |
| Mechanic garage | Industrial | Mechanic job, upgrades, respray | Lift, toolbench, spray booth | Phase 2 | — |
| Scrap yard office | Industrial | Scrap job sign-in, chop shop contact | Clock-in, Marlo's door | Phase 6 | — |
| Hideout rooms | Inside owned property | Add-ons | Stash room, workbench, press, chop bay, lab, crew room | Phase 5 | — |
| Bank (lobby, manager office, security room, corridor, vault) | Downtown | Bank heist | See the bank walkthrough in 04 | Phase 7 | ✅ |
| Jewellery store | Downtown | Heist | Display cases (smash), back safe | Phase 7 | — |
| Police station front desk and cells | Downtown | Jail release, bribes | Front desk (lawyer/judge bribes), lockers with seized items | Phase 3 | — |
| Front businesses | Laundromat, car wash, nightclub | Laundering fronts | Office safe (counts laundered cash), manager | Phase 7 | — |
| Hospital ward | Downtown | Wake after death | Bed, discharge desk | Phase 4 | — |

## Questions Claude Code must ask before building each interior
Before building any interior, Claude Code asks the user the **general questions** plus that interior's **specific questions**. It then makes a draft render with `interiors.py`, shows it, and builds only after the user approves. Where a draft above already answers a question, it confirms rather than re-asks.

**General (every interior)**
1. One room, or several rooms? Roughly how big (in tiles)?
2. Mood: wallpaper, floor and accent colours (from the palette)? Clean or run-down?
3. What can the player do here? Which objects are interactable?
4. Who is here, and when (staff, customers, guards)? Opening hours?
5. *(Crime interiors)* Security: cameras, alarms, guards, locked doors? Where?
6. *(Player-owned)* What can be customised or upgraded?
7. Entrances: front door only, or also a back door, windows or roof access?

**Specific**
- **Starter apartment:** keep the single open-plan room from the draft, or add a separate bedroom and bathroom? Can the player decorate it (buyable furniture)?
- **Office floor:** one floor, or several (lobby, open office, manager's office, break room)? Does the key-card perk open a server room or executive floor for crimes?
- **Corner store:** *(answered)* three rooms: shop floor, a locked back room with the safe, and a security room for the cameras. Still ask: should some stores have the clerk behind bulletproof glass, and how many store layouts should there be?
- **Bar:** what is Dez's back room like, and is the bar a social hub (darts, jukebox) or purely functional?
- **Houses for burglary:** how many layouts? Should owners sometimes be home asleep (stealth)? Pets or alarms?
- **Hideout rooms:** is each add-on its own room, or one big space with stations? What do the press, lab and chop bay look like?
- **Bank:** *(direction set by the draft)* lobby → manager's office → security room → corridor gate → vault. Still ask: how many guards, and should there be a second floor or a basement?
- **Jewellery store:** *(direction set in 04)* front room, back office safe, security closet. Still ask: how many display cases, and is there a rooftop escape?
- **Police station:** is it walkable inside, or only a jail/bribe screen?
- **Front businesses:** is each one a full interior, or a small office plus an exterior?
- **Hospital:** walkable inside, or a wake-up screen only?

Record the answers in this file under each interior's row (or in a new section) before building.

## Answers (question round of 2026-10-10, Phase 1)
- **Starter apartment:** keep the single open-plan room from the draft (7 × 6 tiles): bed (sleep / save), wardrobe (change outfit), floor stash, kitchen, dining table, sofa ↔ TV. Front door only. Warm wood floor, stone wallpaper. No buyable furniture yet (customisation can come with property in Phase 5). The apartment block, Drizzle Row Residences, stands on the edge of Downtown (see 01).
- **Office (Pellridge Tower):** four rooms: a ground-floor **lobby** (reception desk with a receptionist, elevator, waiting chairs), the **open office** from the draft (cubicles, filing cabinets, your desk), a separate **manager's office** (Ms. Hollis: clock in / out, meetings later) and a **server room**. The rank 2 key card opens the lobby after hours and the server room (crime use comes in later phases). Open 08:00–18:00. 3–4 coworkers plus Ms. Hollis during work hours. Lavender carpet, cool light. No security systems in Phase 1. A new draft is needed (the existing one shows the open office only).
- **Corner store (Open Most Hours):** the drafted three-room layout (shop floor, locked back room, security room), clerk at an open counter, open 07:00–21:00. Phase 1 uses it for shopping only; robbery comes in Phase 3. There will be **two store layouts**: the second is drafted and approved when the Suburbs store is built (Phase 6).
- **Bar (The Low Tide):** functional, two rooms, about 9 × 7 tiles. Main room: long counter with a bartender, stools facing it, two booths, jukebox and dartboard (decoration only, no extra minigames), beer signs and plants; open 16:00–02:00 with 2–4 patrons in the evening. **Dez's back room** behind a staff door: Dez's desk (launder: money count minigame), a safe, crates and a lamp; Dez is there 18:00–02:00 (02). Dark wood, plum and brick tones, warm lamps. No security in Phase 1. Front door only for now. A new draft is needed.
