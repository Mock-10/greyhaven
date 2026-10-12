# 08 — Vehicles

## Driving model (arcade)
- Top-down arcade physics: acceleration, top speed, braking, steering that tightens at low speed, and a handbrake for drifts. The car is an oriented box for collisions.
- **8 sprite directions** from the art pack. The heading is continuous; the sprite snaps to the nearest 45°. Turning between directions is smooth because the snap happens every 45°.
- Collisions with buildings, props and other cars cause damage proportional to impact speed. Pedestrians dive out of the way when possible.
- Camera: follows the car with look-ahead in the direction of travel (see 11).

## Stats
| Vehicle | Top speed | Accel | Grip | Health | Trunk slots | Tank | Price |
|---|---|---|---|---|---|---|---|
| Beater | 70 | low | low | 70 | 2 | 30 | $1,500 |
| Sedan | 85 | mid | mid | 100 | 4 | 40 | $5,000 |
| Pickup | 80 | mid | mid | 120 | 6 | 50 | $7,000 |
| Van | 70 | low | low | 140 | 10 | 60 | $9,000 |
| Sports | 120 | high | high | 80 | 2 | 45 | $25,000 |
| Armored SUV | 85 | mid | mid | 250 | 4 | 70 | $40,000 |
| Police cruiser | 100 | high | mid | 130 | — | — | stealing one gives +1★ |

**Phase 1 tuning (`BALANCE.vehicles.types`):** the sedan, the taxi (a sedan body, value $4,500, assumed) and the van (top speed 198 units/s, slower to accelerate and turn, health 140, tank 60) each have their own stats. Sedan: in world units per second, top speed 240 (about 7.5 tiles/s), reverse 70, acceleration 140, braking 320, rolling drag 70, steering 2.4 rad/s at speed. Glancing hits slide along walls; head-on hits bounce back at 25% speed. Impacts below 40 units/s do no damage, above that damage is 0.12 per unit/s. Parked cars start with 35% fuel. The camera leads ahead of the car and steps the zoom out one level (11).

## Damage
- Vehicle health from 0 to 100%. Below 50%, smoke appears. Below 25%, top speed −30% and fire risk. At 0, it explodes after 3 s.
- Damage reduces the value of shipments being carried (see 04).
- Repair at a mechanic for 5–40% of value (mechanic job: −20%), or with a repair kit (partial repair to 50%, $150).

## Fuel
- Fuel drains with throttle. A full tank lasts about 15 real minutes of driving.
- Refuel at gas stations at $3 per unit.
- Empty tank: the car coasts to a stop. A jerry can costs $40 (10 units).

## Upgrades (mechanic garage; clean money)
| Upgrade | Levels | Cost per level | Effect |
|---|---|---|---|
| Engine | 3 | $1,000 / $2,500 / $5,000 | +8% top speed and acceleration per level |
| Brakes | 3 | $600 / $1,500 / $3,000 | +15% braking |
| Armor | 3 | $1,500 / $3,500 / $7,000 | +20% health |
| Tires | 2 | $800 / $2,000 | +10% grip, second level resists spike strips |
| Hidden compartment | 1 | $4,000 | −50% cargo value loss, passes police searches 70% of the time |
| Respray | — | $400 | Changes color. Clears "hot" status. Removes 1★ if unseen. |

## Ownership, stealing and storage
- **Bought cars** are registered to you. They respawn at your garage if destroyed, for a 10% insurance fee.
- **Stolen cars** are "hot" for 2 in-game days: police who see a hot car get a 20% chance per minute to recognise it (+1★). Respray or chop it.
- **Garage:** each owned property has 1 parking spot. Garage add-ons give 2–4 more (see 09). Stored cars keep their health, fuel and trunk contents.
- **Trunks:** every car has trunk slots. The player can loot other cars' trunks (lockpick) or store items in their own (product, weapons, loot).
- **Selling:** the legal dealer pays 50% of value (clean money, owned cars only). The chop shop pays 15–30% of value (dirty money, any car, no questions).
- **Pulling drivers out:** press E at the door of an occupied car. Some drivers fight back or flee. The driver becomes a witness.


## Decisions (question round of 2026-10-11, before autopilot)
- The catalogue and upgrades stay as specced.
- **Phase 1 stealable cars:** the sedans, the taxi and the white van, each with its own stats and chop price.
- **Selling to Marlo:** park in the white dotted spot in his back yard and press E; Marlo walks over and pays. Open 24 hours.
- **Home parking:** Drizzle Row Residences has a parking spot outside. Saved vehicles, bought or stolen, spawn there on load.

## Phase 2 build (milestone 5, 2026-10-11)
- **Repair kit** (hardware store, $150): E USE REPAIR KIT on any unlocked car below 50% health brings it to 50%. A wrecked car (0%) can't be saved by a kit.

## Phase 2 build (milestone 6a, 2026-10-12)
- **Dealer cars are scenery**: the used-car lot on Hedgerow Way shows rows of display cars that can't be entered, bought or stolen.
- **House driveway cars** on Linden Avenue are ordinary parked cars: they can be lockpicked, hotwired, looted and sold to Marlo like any other.
- New roads have two lanes each way. Traffic picks a lane, stops at the stop lines and only turns right for now.


## Phase 2 build (milestone 6b, 2026-10-12)
- **Buying a car:** the salesman's desk in the lot's cabin sells beaters ($1,500; khaki or brick) and sedans ($5,000; teal, clay, khaki or lavender). Clean money: the bank first, then carried clean cash.
- The car is **registered to you**: unlocked, keyed (F gets in, no hotwire), a full tank, never hot, and its trunk isn't a loot target. It waits in the **pickup bay** (the first bay of the lot's front row) and drives out through a gap in the pennants. While a car stands in the bay, the desk asks you to move it first.
- **Beater stats** (`BALANCE.vehicles.types.beater`): top speed 198 units/s (70 vs the sedan's 85), acceleration 110, turn rate 2.1, health 70, tank 30. A shorter hatchback body with a primer door, rust and a faded roof (`art/source/cars.py`).

## Phase 4 build (milestone 14, 2026-10-12)
- **New types** from `art/vehicles2`: the pickup, the sports car and the armored SUV, with the stats and prices in the table. All three are at the used-car lot; a pickup and a sports car stand among the parked cars (the Pewter Street lot, the strip lot, Torque & Sons' yard), and the lot's display rows show them too.
- **Damage states:** smoke below 50%, fire and −30% top speed below 25%, and at 0 the car burns and explodes 3 s later (blast damage to anyone near, the camera shakes). A bought car that's destroyed comes back at home parking for 10% of its value, paid from the bank.
- **Torque & Sons service bay:** stop a car on the concrete apron in front of the garage (08:00–18:00) and press E: **CAR SERVICE** lists the repair (5–40% of value by the damage, −20% for mechanics on staff), the five upgrades with their levels and the respray. Clean money only: the bank first, then carried cash. The bay serves any car you can drive (yours or one you've opened).
- **Upgrades:** engine (+8% top speed and acceleration a level), brakes (+15%), armor (+20% health, the car stays full), tires (+10% steering grip; level 2 resists spike strips), hidden compartment.
- **Respray:** another colour of the same model, the hot status gone, and −1★ when you're wanted but unseen.
- **Your trunk:** on a car you own, the trunk prompt reads TRUNK and opens a list: take out what's in it, or store a weapon (its clip goes with it; reserve ammo stays on you) or burglary goods. One slot per item, up to the type's trunk slots.
- **Police search:** arrested out of a car, the trunk is searched: goods and unregistered weapons are taken, registered ones stay. A hidden compartment passes the search 70% of the time.
- **Pulling drivers out:** a traffic car stopped or crawling (below 20 units/s) shows PULL OUT DRIVER at its driver's door. The car is yours to drive (hot, like any stolen car), the driver runs and always calls it in (1★); one in four swings at you first (12 damage).
- **Spike strips:** every roadblock (3★+) lays one across the road a little before it, on your side. Driving over it bursts the tyres (half top speed, 60% steering) unless the tires are level 2; the garage's repair fits new ones ($200 added).
- **Assumptions:** the cargo-value half of the hidden compartment waits for product cargo (Phase 5); the service bay doesn't need the car to be yours; burst tyres don't need a repair kit fix.

