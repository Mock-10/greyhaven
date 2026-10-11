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

**Phase 1 tuning (sedan, `BALANCE.vehicles`):** in world units per second, top speed 240 (about 7.5 tiles/s), reverse 70, acceleration 140, braking 320, rolling drag 70, steering 2.4 rad/s at speed. Glancing hits slide along walls; head-on hits bounce back at 25% speed. Impacts below 40 units/s do no damage, above that damage is 0.12 per unit/s. Parked cars start with 35% fuel. The camera leads by up to 3 tiles at top speed.

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
