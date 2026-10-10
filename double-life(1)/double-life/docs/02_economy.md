# 02 — Economy

All numbers here are **starting values for tuning**. They must live in one config file (`src/data/balance.ts`). Never hard-code them in systems.

## Currencies
| | Clean money | Dirty money |
|---|---|---|
| Earned from | Shifts, promotions, side gigs, front-business revenue, selling legal goods | Every crime payout, fences, chop shop, smuggling, printing |
| Spend on | Everything legal: rent, houses, cars, repairs, fuel, legal shops, fines, hospital, lawyers | The black market: dealer weapons and ammo, product supplies, crew wages, bribes to police and gang contacts, tools from fences |
| Risks | None | Seized when jailed (carried cash only). Hideout stash is safe. |

Spending dirty money in a legal shop is not allowed: the cashier refuses it. **This is what makes laundering matter.**

## Laundering
| Method | Unlocked at | Cut | Daily capacity | Notes |
|---|---|---|---|---|
| NPC launderer (bar back room, Downtown) | From the start | 35% | $1,500 | Opens 18:00–02:00 |
| NPC launderer, better terms | Rep tier 2 (Known) | 25% | $3,000 | Gang-contact bribe: −5% cut for 7 days for $1,000 dirty |
| Front: laundromat | Rep tier 3, buy for $12,000 clean | 12% | $2,500/day | Also earns $80/day clean revenue |
| Front: car wash | Rep tier 3, buy for $25,000 clean | 12% | $6,000/day | Also earns $150/day clean revenue |
| Front: nightclub | Rep tier 4, buy for $60,000 clean | 10% | $15,000/day | Also earns $400/day clean revenue |

Fronts launder automatically each night from the hideout stash, up to their capacity.

## Living costs
| Cost | Amount | Notes |
|---|---|---|
| Starter apartment rent | $350 every 7 days | Due Monday 06:00 |
| Late rent | +$50 per day late | Eviction after **two missed weekly payments** (14 days unpaid). Belongings go to city storage ($200 to recover). |
| Owned house | Property tax $60 per week | Replaces rent |
| Fuel | $3 per unit; a sedan tank holds 40 units ≈ 15 min of driving | Gas stations in every district |
| Repairs | 5–40% of vehicle value, scaled by damage | Mechanic job discount: −20% |
| Hospital (on death) | 10% of carried clean cash, min $100, max $1,500 | You keep your items |

## Prices
**Vehicles** (clean money; stolen cars are free but "hot", see 08):

| Beater | Sedan | Van | Pickup | Sports | Armored SUV |
|---|---|---|---|---|---|
| $1,500 | $5,000 | $9,000 | $7,000 | $25,000 | $40,000 |

**Property and hideout add-ons**: see 09.
**Weapons and ammo**: see 07.

## Fines and bribes (fixed by tier)
| Stars at arrest | 1★ | 2★ | 3★ | 4★ | 5★ |
|---|---|---|---|---|---|
| Fine (clean) | $200 | $500 | $1,200 | $3,000 | $6,000 |
| On-scene police bribe (dirty) | $300 | $800 | $2,000 | n/a | n/a |
| Jail days (repeat offense) | 1 | 1 | 2 | 3 | 4 |

| Other bribes | Cost | Effect |
|---|---|---|
| Lawyer | $1,500 clean | −1 jail day (minimum 0) |
| Judge (rep tier 3) | $5,000 dirty | Convert jail into a fine |
| HR / boss | $150 clean | Cover one missed shift: no pay lost, no XP penalty |
| HR / boss | $600 clean | Lift a promotion freeze |
| Gang contact | $1,000 dirty | −5% laundering cut for 7 days |

## Pacing targets (verified with an expected-value sim)
| Milestone | Pure civilian | Mixed (work by day, crime by night) | Pure criminal |
|---|---|---|---|
| First $1,500 (a beater car) | day 8 | day 4 | day 6 |
| Career rank 2 / 3 / 4 | days 4 / 12 / 26 | days 4 / 12 / 26 | n/a |
| Hustler / Known / Connected / Boss | n/a | days 5 / 15 / 27 / 39 | days 4 / 10 / 18 / 26 |
| $12,000 (starter house) | day 35 | day 21 | day 18 |
| First front business | n/a | day ~33 | day ~27 |
| Wealth at day 42 (clean, after costs) | ~$15k | ~$26k | ~$72k |

**Balance rules to keep while tuning:**
1. Low-tier crime pays **about 2.3×** a rank-1 shift per real hour, before arrests. Keep the ratio between **1.5× and 2.5×** at every stage.
2. Dirty income is only worth something once laundered. The NPC launderer's **daily cap** stops a criminal from converting unlimited cash early.
3. Pure crime gets the most money but the most variance: arrests, seized cash, jail time and lost cargo. Pure civilian life is slow but safe. It gets a **clean-record bonus** of +15% of the week's pay every week with no offenses.
4. Costs scale with ambition: ammo, crew wages and restocks keep high-tier money moving, so cash never becomes meaningless.

The sim script is in `tools/econ_sim.py`. Re-run it after any change to pay, payouts, reputation thresholds or laundering numbers, and update this table.
