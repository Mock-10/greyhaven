# 02 — Economy

All numbers here are **starting values for tuning**. They must live in one config file (`src/config/balance.ts`). Never hard-code them in systems.

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

**Corner store basics (Phase 1, decided 2026-10-11)**, clean cash only: soda $3 (+5 HP), chips $6 (+10 HP), sandwich $12 (+25 HP), fuel can $40 (10 units, docs/08). Food is eaten on the spot. The full shop catalogue arrives in Phase 2.

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


## Decisions (question round of 2026-10-11, before autopilot)
- **Chop prices:** 15–30% of each car type's value (docs/08), scaled by damage, with the cheap types valued so an early car pays about $300–500. Each type pays differently. Re-run `tools/econ_sim.py` after setting the values.
- **Bank:** clean cash is either carried or in the bank. Pay goes to the bank; ATMs deposit and withdraw. Death and arrest only touch carried cash.
- **Rent** is taken automatically from the bank on Monday 06:00. If the bank is short, late fees build (+$50 a day) and eviction follows after two missed weeks. **After eviction you sleep at a shelter, which still allows saving.**
- **Phase 2 shops:** corner store (full: food, fuel can, first-aid kit), clothing store (outfits; masks come in Phase 3), hardware store (basic lockpicks, toolbox, repair kit), car dealer (beater and sedan to start).
- **Weekend odd jobs** (instead of side gigs of your own job): a **car wash** gig and a **bar shift at The Low Tide** (pour drinks), at the 60% side-gig rate, no promotion XP.

## Phase 2 build (milestone 5, 2026-10-11)
- **Bank:** carried clean cash and a bank balance. Shift pay and promotion bonuses go to the bank. ATMs (the plaza ATM) deposit all carried clean cash or withdraw $20 / $50 / $100 / $500. Dirty cash never enters the bank. Shops, pumps and fines take only carried clean cash. The phone's BANK app shows the balance, rent and a statement of the last 24 lines.
- **Rent** ($350) is taken from the bank on Monday 06:00, all or nothing. If the bank can't cover everything owed, nothing is taken and the debt stays. From the next day, each 06:00 adds a $50 late fee and retries the bank. You can also pay from the phone (BANK → PAY RENT NOW). A rent reminder comes on Sunday at 20:00.
- **Eviction** comes 14 days after the first unpaid rent. It clears the debt, your belongings go to city storage, and the apartment door refuses you. Moving back in costs a week's rent plus the $200 storage fee, from the phone's BANK app. Meanwhile you sleep and save at **St. Brine's Mission**, the chapel on Pewter Street (open to anyone, any time).
- **Clean-record bonus:** 15% of the week's job pay, paid to the bank on Monday 06:00 before rent, unless the week had an arrest.
- **HR bribes** come from the bank: $150 covers a missed shift from the last 7 days (the −5 XP comes back, no pay), $600 lifts a promotion freeze.
