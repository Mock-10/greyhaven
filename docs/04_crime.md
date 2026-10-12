# 04 — Crime

Every crime is available **from day one**. Tiers set difficulty, risk and payout. Tools (bought from fences and dealers) widen minigame tolerances (see 06). Payouts are **dirty money** unless stated otherwise. Values are expected payouts; the actual amount is rolled within a range.

## Criminal reputation
- Reputation is earned from completed crimes: **payout ÷ 6, plus 20 per crime**. There is a +25% bonus when you escape with stars, and no reputation if you are arrested.
- Tiers:

| Tier | Name | Reputation needed | Typical arrival (crime-heavy play) |
|---|---|---|---|
| 0 | Nobody | 0 | start |
| 1 | Hustler | 400 | day 4–5 |
| 2 | Known | 1,800 | day 10–15 |
| 3 | Connected | 5,000 | day 18–27 |
| 4 | Boss | 11,000 | day 26–39 |

Tiers unlock contacts and services (see 10). They **do not** lock crimes.

## Crime catalogue
| Crime | Tier | Minigame(s) | Payout | Base stars if seen | Notes |
|---|---|---|---|---|---|
| Trunk looting | 0 | Lockpick (easy) → quick search | $20–120 plus items | 1★ | Loot table: phone, wallet, tools, sometimes product or a gun |
| Carjacking a parked car | 0 | Lockpick → hotwire | 15–30% of the car's value at the chop shop, at an early rate below tier 2 (about $260–600; decided 2026-10-11) | 1★ (alarm 30% chance) | Car is "hot" for 2 days. Respray at a mechanic or chop it. |
| Carjacking an occupied car | 0 | Pull out (button mash) | Same as above | 2★ | The driver becomes a witness |
| Store robbery | 0–1 | Intimidate (hold meter) → register grab; optional back room (lockpick door → crack safe) and security room (disable cameras / wipe footage) | Register $250–600; back-room safe +$600–1,500 | 2★ | Clerk may hit the silent alarm: +1★ after 20 s. Cameras identify unmasked robbers unless disabled or wiped. See *Store layout* below. |
| House burglary | 1 | Lockpick → search rooms (timed) → fence goods | $200–900 in goods | 1★ (2★ if the owner is home) | Best at night or when the house is empty (delivery perk) |
| Chop shop / scrap sale | 0 | — | 15–30% of the car's value (below rep tier 2: 35% of that, capped at $600) | — | Marlo's Tow & Salvage (Industrial from Phase 6). Park in the white dotted spot in his side yard and press E: Marlo walks out and pays dirty money. |
| ATM robbery | 2 | ATM hack (memory) **or** drill (hold) | $800–1,500 | 2★ (3★ downtown) | ATM drill tool $900 from a fence (Known tier) |
| Smuggling, tier 1 product | 1 | Drive to the drop on a timer | Buy $300 → sell $650 | 2★ if stopped and searched | Supplier at the Docks |
| Smuggling, tier 2 product | 2 | Drive, drop guarded by NPCs | Buy $1,500 → sell $3,200 | 3★ | — |
| Smuggling, tier 3 product | 3 | Long drive, roadblock risk | Buy $5,000 → sell $11,500 | 4★ | — |
| Counterfeit printing | 2 | Hideout op (see 09) → count/bundle | $1,000 supplies → $2,600 fake cash | — | Spending fake cash at fences adds a 10% chance of +1★ |
| Armored truck | 3 | Stop the truck (road block or ram) → crack the rear door (safe crack) | $4,000–8,000 | 3★ instantly | Route times come from the office tip-off perk or a gang contact ($500) |
| Heist | 3–4 | Prep phase, then a set piece | $25,000–60,000 | 4★ | See below |

### Smuggling rules
- Buy product at the Docks supplier with dirty cash, load it into **your vehicle's trunk**, and deliver it to a drop within a time limit (shown as a ring on the radar).
- **Cargo value drops with vehicle damage:** delivered value = base × (vehicle health %), floored at 40%. The lumberjack hidden-compartment perk halves this loss.
- Police stops: driving with 2★ or more means a 20% chance per minute of a roadblock on the route. Being searched means the cargo is lost.
- Late delivery: −10% value per in-game hour late. After 3 hours the buyer leaves.
- A crew driver can run shipments automatically (see 09).

### Airdrops (Outskirts fields)
A second way to get product, alongside the Docks supplier.
- Order through a contact (phone) from **reputation tier 2**. You pay up front (dirty money) at **−20% versus the Docks price** for the same tier.
- At night a small plane drops a crate into one of the Outskirts fields at a set time. A gold-rimmed crate shows on the radar for **2 in-game hours**.
- **Risks:** a 25% chance a police patrol checks the field (1★ if they see you with the crate); rival ambush (see below); after 2 hours the crate is gone and the money is lost.
- The farmer job's perks give warnings, schedules and a barn stash.
- Product picked up from an airdrop still has to be delivered to a buyer as a normal smuggling run.

### Rivals (light)
**Decision:** light rivals only. Occasional rival crews cause trouble; there are no turf wars or district control.
- Rival activity starts at **reputation tier 2**.
- **Shipment ambush:** 10% chance per tier 2 run, 15% per tier 3 run (also airdrop pickups). 3–5 armed rivals in a car try to ram and steal the cargo. Escape or fight them off. If they take the cargo you can chase it down within 1 in-game hour.
- **Hideout hit:** 4% chance per night per running operation. You get a phone alert and have 1 in-game hour to go and defend it (3–5 rivals). If you don't, they steal that operation's current batch. The stash room is never hit.
- Rivals carry pistols and SMGs and drop them as loot (07). Fighting rivals raises stars only if witnesses or police see it.
- Vance's mission chain (17) can pause rival activity for 14 days.

### Store robbery layout (every corner store)
Each store has three rooms. The draft is `art/drafts/interiors/interior_store.png`.
1. **Shop floor:** the clerk at the register, customers (witnesses) and 1–2 wall cameras.
2. **Locked back room:** stock shelves, a ledger desk and the **safe**. Lockpick the door (tier 1), then crack the safe (tier 1–2). The safe holds the day's takings ($600–1,500). The back room has no camera, but working the safe takes 20–40 s, so the clerk's alarm timer keeps running.
3. **Security room:** the CCTV desk with monitors and the DVR recorder.
   - **Disable cameras** (wire minigame): cameras stop recording for the rest of the robbery.
   - **Wipe footage** (hold minigame, 10 s): erases what was already recorded. Your identification at this store is cleared, even if you were unmasked.
   - The security guard rank 3 perk does both instantly.

There are several ways to play it:
- **Smash-and-grab:** take the register only. Fast, but 2★ and possibly identified.
- **Clean job:** cameras first, then the register, then the back room. More money and no identification, but it takes longer, so the silent-alarm risk grows.
- **Night job:** the store is closed. Lockpick the back door, then the safe and footage. No clerk, but there is an alarm panel by the door that must be cut within 10 s.

### Heists: intricate, grounded set pieces
**Design rule (the user's direction):** heists are **multi-room operations with real security systems**, in the spirit of GTA V. They are never one interaction.
- Each heist moves through **several rooms in order**. Every room has a job to do and a way to fail.
- **Security comes first.** Alarms, cameras and locks must be dealt with **before** the loud part. If the player skips them, the system reacts. For example, drilling or blowing the vault with alarms live triggers a silent alarm, and police arrive in 60 s at 4★.
- There are **two approaches**: a loud one (fast, more stars, more risk) and a quiet one (slower, more minigames, fewer stars).
- Loot has **weight**. Gold is heavy and slows you; cash is light. Bag capacity is limited, so you choose what to carry. A crew member can carry a second bag.
- The **escape** is part of the heist: several exits, a getaway vehicle staged during prep, and job perks that open new routes.
- Prep stays **short** (1–3 tasks, as decided) but feeds the set piece directly. For example, a keycard from prep skips a lock.

| Heist | Tier | Prep tasks (short) | Set piece: rooms in order | Payout |
|---|---|---|---|---|
| **Downtown bank** | 4 | Getaway car · case the bank (photograph cameras and guards) · *optional:* vault schedule (security rank 4 **or** $3,000 to a gang contact) | See the bank walkthrough below | $60,000 (gold heavy, cash light) |
| **Jewellery store** | 3 | Fast car · masks · case the store (photograph 3 cameras) | Front room: smash display cases (timed; each case is a rush of loot) → back office: crack the safe → **security closet:** cut the alarm *before* the cases, or the silent alarm starts a 90 s police timer → escape through the front or the alley | $25,000 |
| **Docks container** | 3 | Bribe the dock foreman ($2,000) **or** steal his manifest · get a truck | Guard hut: take the yard keys and gate code → **crane control room:** disable the floodlights (stealth) or leave them on → container stacks: find the marked container (the manifest shows the row) → crane it onto the truck (crane minigame) → drive out past the gate | $30,000 in product (sold by smuggling) |

#### Bank heist walkthrough (draft: `art/drafts/interiors/interior_bank.png`)
1. **Lobby, crowd control.** Pull weapons and the **hostage meter** starts. Customers and tellers stay down while the meter is high. Intimidate (aim, shout) to keep it up. If it drops to zero, someone runs or calls the police: +1★ and a 90 s timer. The guard can be disarmed or taken down.
2. **Manager's office: keycard and vault code.** Take the keycard from the desk. The vault code is in the office safe (crack it) or comes from the manager under intimidation. *Prep shortcut:* office rank 2 already has a key card.
3. **Security room: disable alarms and cameras.** The keycard opens the door. At the alarm panel, play the wire-and-code minigame to disable the alarms. At the CCTV desk, disable the cameras or wipe the footage. **If the player skips this room**, step 5 trips the silent alarm and police arrive in 60 s at 4★.
4. **Corridor gate:** swipe the keycard, or lockpick it (tier 3, slow, noisy).
5. **Vault door:** **drill** (about 60 s of skill checks, quieter) or **thermal charge** (instant, loud, +1★ even with the alarms off). Requires the vault code or a successful drill.
6. **Vault:** deposit boxes (drill each, small random loot including rare items), gold bars (heavy, high value) and a cash cart (light). Grab what the bags can hold.
7. **Escape:** the front door (police converge here), the back alley (needs the getaway car staged in prep), or the sewer (road worker rank 2 manhole tunnels, which drop the stars by 1 when you enter).

Heists can be replayed after a 7-day cooldown, with −30% payout each replay. Each heist interior is a dedicated map, and the build follows the interior process in `18_interiors.md`.

## Planning crimes with the day job
- Crimes during your shift hours make you **late** for work. That is a deliberate tension.
- Wearing your work uniform during a crime gets you **identified 100% of the time** (the uniform has your name tag). Change clothes first.


## Decisions (question round of 2026-10-11, before autopilot)
- **Trunk looting moves forward to Phase 2** so the guided first day can teach it.
- **Store robbery:** no bulletproof glass. Every clerk stands at an open counter.
- **House burglary:** 3 layouts; owners can be home asleep (noise wakes them); about 1 in 3 houses has an alarm panel. No pets. **Occupancy reads from the driveway:** in daytime, a house with no cars outside is empty; a house with cars outside may have someone home, which raises the risk.
- **Fence:** the PAWN shop becomes enterable, run by a new minor named character. It sells masks (balaclava, bandana, hockey-style) and basic tools and buys stolen goods.
- **Rival crew:** **Saltgate Union**, Vance's smuggling syndicate: grey peacoats with red armbands.
- **Jewellery store heist:** 10 display cases and a rooftop escape down to the alley.
- **Bank heist:** 2 guards; the vault is in a basement, which adds a stair route to the escape choices.

## Phase 2 build (milestone 5, 2026-10-11): trunk looting
- Every parked car you don't own shows **LOOT TRUNK** at its rear bumper. It is a 1★ crime if a witness or an officer sees it.
- A locked car needs the lockpick first (the trunk lock is the car's lock, so the car opens too); an unlocked car goes straight to the search.
- A trunk holds 2–4 valuables (cash and wallets worth $20–120 dirty in all, stolen phones, a watch, sometimes a lockpick set with 5 uses) plus 2–4 pieces of junk. Phones and watches wait in the bag for the fence (Phase 3). Product and guns join the table in Phases 3–4.
- A searched trunk stays empty (saved with the car).

## Phase 3 build (milestones 9–10, 2026-10-12)
Built from PR #18's logic. Assumptions are marked (assumed).
- **Reputation:** trunk loot (cash plus the fence's price for phones and watches) and car sales to Marlo earn reputation (payout ÷ 6 + 20). A crime finished while wanted pays only after the escape (+25%); an arrest loses it. Tier-ups arrive as messages from Dez. The phone's CONTACTS shows your street rep and the crime contacts.
- **Store robbery (Open Most Hours):** TAB at the till picks ROB THE REGISTER: the intimidate minigame, then the till (2★ from the clerk when you walk out; the silent alarm adds +1★ 20 s after it's pressed). The staff door can be lockpicked to reach the safe (safe crack). The CCTV desk (wire order, 15 s) stops the cameras; the DVR (wipe) clears this store's identification. Leaving across the shop floor on camera unmasked identifies you. **Night job:** at a closed store with lockpicks, E at the door picks the back door; the alarm panel then has 10 s (cut the wires in order). A robbed store is empty for a day. (Assumed: the register grab uses the intimidate grade; no separate grab minigame.)
- **ATM robbery:** TAB at any ATM picks ROB ATM. The hack (Simon, 3 rounds) is silent, a fail trips the alarm; with a drill in the bag it drills instead (loud: heard 14 tiles away). 2★, 3★ in the Ledger. The ATM camera identifies an unmasked face. An emptied ATM waits 2 days.
- **The fence** deals at the pawn shop's door on Overcast Avenue, 10:00–22:00 (assumed; the pawn shop interior comes later): sells stolen goods for dirty cash, and sells masks (bandana $40, balaclava $80, hockey mask $120; dirty cash first, then clean; assumed) and, from Known, the ATM drill ($900 dirty, 5 uses).
