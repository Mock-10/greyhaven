# 07 — Combat and Weapons

## Feel
Top-down isometric shooting. **Aim with the mouse** and **left-click to fire**. **Right-click** raises the weapon, which is needed to intimidate and improves accuracy. Bullets are fast hitscan with a short tracer line; shotguns spread pellets. There is no cover system: buildings and cars block shots and line of sight.

## Health and armor
- Player has **100 HP**. HP regenerates slowly to 50 when out of combat for 10 s. Above 50 needs a first-aid kit ($60) or a hospital visit.
- **Body armor** ($400, from dealers) absorbs 50 damage, then breaks.
- Down at 0 HP means death (see 05).

## Weapons
Dealers sell to **everyone**. Heavy weapons are **very expensive**. Every weapon uses its own ammo type. Purchases at dealers are paid in dirty money; there's also a legal gun store (pistol and shotgun only, clean money, registered: a registered weapon is not seized in jail).

| Weapon | Class | Price | Ammo type | Ammo price | Damage | Notes |
|---|---|---|---|---|---|---|
| Bat | Melee | $80 | — | — | 25 | Silent, knockdown |
| Knife | Melee | $120 | — | — | 35 | Silent |
| Pistol | Handgun | $600 | 9mm | $30 / 24 | 20 | Concealable: doesn't count as a visible weapon when holstered |
| Revolver | Handgun | $1,100 | .357 | $40 / 18 | 40 | Slow, strong |
| Shotgun | Shotgun | $1,800 | 12 gauge | $40 / 16 | 8 × 8 pellets | Short range, knockback |
| SMG | Automatic | $2,500 | 9mm | (shared with pistol) | 14 | High rate of fire, inaccurate |
| Assault rifle | Rifle | $6,000 | 5.56 | $70 / 60 | 28 | Rep-free but pricey |
| Hunting rifle | Rifle | $3,500 | .308 | $50 / 20 | 70 | Long range |
| LMG | Heavy | $18,000 | belt | $300 / 100 | 30 | Very expensive. Slows movement. |
| Grenade launcher | Heavy | $25,000 | grenade | $400 each | 120 area | Very expensive. Damages vehicles. |

## Loadout and looting
- Carry 1 melee weapon, 2 firearms and 1 heavy weapon. Extra weapons stay in the hideout stash or the car trunk.
- **Looting:** downed police and enemies drop their weapon plus some ammo, picked up with E (gold rim). Police drop pistols at 1–2★, shotguns at 3★ and rifles at 4–5★. Looted weapons are **unregistered** and are seized if you are jailed.

## Combat with police
- Police warn at 1★ ("Stop! Police!") and **only shoot at 2★ and above**, or if you shoot first.
- Shooting at police instantly raises the wanted level to at least 3★. Killing an officer raises it to at least 4★.


## Decisions (question round of 2026-10-11, before autopilot)
- **Weapon dealer:** a dealer with an open van in a back alley (in the hood once it exists). The legal gun store arrives with the full Downtown.
- **Downed people** fall, leave blood marks and pools, then fade out; whether they are dead stays ambiguous.

## Phase 4 build (milestone 13, 2026-10-12): combat in the street
- **Controls:** the mouse aims; right mouse raises the weapon (the aim pose, a crosshair, slower walking, tighter spread); left mouse fires (held for the SMG, assault rifle and LMG); 1–4 draw a slot (the same key again holsters); the wheel cycles (Ctrl+wheel still zooms); R reloads. With nothing drawn, left click punches. Combat is street-only for now (not inside interiors, not from a car).
- **Hits:** hitscan with a muzzle flash and a short tracer; buildings and cars stop bullets (a spark). People take 40 damage and officers 80 before they go down (assumed). Downed people fall where they stood, a blood pool spreads under them, and after 30 s they fade (user 2026-10-11). Hits leave blood spatter on the ground.
- **Crimes:** shots fired are heard 16 tiles away (1★, assumed); hitting someone is a shooting (3★); hitting an officer raises it to at least 3★, killing one to at least 4★ (docs/07).
- **Police combat:** officers on foot fire at 2★+, or as soon as you've fired; pistols at 1–2★, shotguns at 3★, rifles at 4–5★. Their rounds do 45% of the weapon's damage to you (assumed, so there's time to run or fight back). Downed officers drop their weapon with some ammo (E: TAKE ...); looted weapons are unregistered and seized on a repeat-offense jail stay. A known face (already on file when the chase starts) seen with a visible weapon adds 1★.
- **Death:** at 0 HP you wake at 06:00 in St. Brine's infirmary (assumed: the chapel stands in for the hospital until the full town), pay 10% of carried clean cash ($100–1,500 as far as it goes), keep your things; the stars clear.
- **The arms dealer:** an open van at the quiet end of the alley behind the Overcast Avenue shops, 18:00–04:00 (assumed). Weapons, ammo for the guns you carry, body armor; dirty cash. The legal gun store comes with the full Downtown (decisions).
- **Trunks** sometimes hold a gun (6%, assumed).
