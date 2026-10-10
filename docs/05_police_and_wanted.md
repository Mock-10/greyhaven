# 05 — Police and Wanted Level

## Detection
A crime only raises stars if it is **detected**:
1. **Witness:** an NPC with line of sight within 10 tiles (7.5 at night or in rain). The witness flees and starts a phone call that takes **6–10 seconds**. It can be **interrupted** by intimidating them (aiming a weapon, or getting within 2 tiles and pressing E) or by knocking them down. Interrupting by violence adds +1★ if anyone else sees it.
2. **Camera:** stores, banks and ATMs. Cameras record you. If you are **unmasked** on camera, you are **identified**.
3. **Police eyes:** an officer who sees a crime raises stars instantly, with no delay.
4. **Alarms:** car alarms (30% chance on lockpick failure), the store silent alarm, the bank vault alarm.

## Sight and noise
Witnesses, guards and police see only along unblocked lines of sight, and closed doors block sight. Noise (lockpicking, drills, shots, charges) carries further and is halved by walls. See `19_visibility.md`.

## Identification and heat
- **Footage:** cameras feed a DVR in that building's security room. Disabling cameras stops new recording. **Wiping the DVR erases the identification from that building**, even if you were unmasked.
- **Masked:** police chase the masked suspect. Once stars clear, there is **no carry-over**.
- **Identified** (unmasked on camera or seen by police): your face goes on file and you become a **"known face" for 2 in-game days**. During that time police who see you get +1★ on sight if you are carrying a visible weapon. Witnesses also call 30% faster.
- Wearing a mask in public in **daylight** is suspicious: witnesses within 5 tiles watch you. This raises their call chance for any crime by 25%.

## Star levels and police response
| Stars | Triggered by (examples) | Response |
|---|---|---|
| 1★ | Trunk looting, lockpick seen, fighting | 1 patrol car investigates the reported spot, officers on foot |
| 2★ | Store robbery, carjacking an occupied car, ATM | 2–3 cruisers, active chase, pistols |
| 3★ | Shooting civilians, armored truck, attacking police | Roadblocks, spike strips, 4–5 cruisers, shotguns |
| 4★ | Killing police, heists | SWAT vans, **helicopter** with searchlight, rifles |
| 5★ | Sustained 4★ chaos, bank heist escape | **Military-style units**, armored vehicles, a second helicopter |

Stars stack: each new detected crime while wanted adds its stars, capped at 5.

## Search and losing stars
- When police lose line of sight, the HUD stars **flash**. Police search a circle around your **last known position**: radius 12 tiles at 1★, up to 30 tiles at 5★. The circle shows on the radar.
- **Escape timer:** stay out of sight and outside the circle for long enough and the stars drop to 0.

| Stars | 1★ | 2★ | 3★ | 4★ | 5★ |
|---|---|---|---|---|---|
| Real seconds out of sight | 30 | 50 | 80 | 120 | 160 |

- **Speed-ups** (each can be used once per chase):
  - Change vehicle while unseen: −25% of the remaining timer.
  - Change mask or clothes while unseen: −25%.
  - Bribe an officer on the phone (1–3★ only): stars clear at once for the tier's bribe price (see 02).
  - Road-worker tunnels and the high-vis disguise (see 03).
- Entering an **owned property** clears 1–2★ at once if you weren't seen entering.

## Arrest
- Police try to **bust** you when within 1.5 tiles while you are on foot or in a stopped car.
- A **"Surrender? [Y]"** prompt appears at 2★ and below, and whenever you are cornered. Surrendering means **−30% fine and −1 jail day**.
- If you **run**, the chase continues.
- Your **offense record** counts arrests in the last 14 in-game days:
  - **First offense:** pay the fine for the stars you had (02). You keep your dirty cash.
  - **Repeat offense:** jail for the listed days (time skips) plus the fine. **All carried dirty cash and illegal items (product, unregistered weapons) are seized.** The hideout stash is safe.
- Career effects: see 03.
- Bribes: lawyer (−1 jail day) and judge (convert jail into a fine, Connected tier only) are offered on the jail screen.

## Death
Wake at the nearest hospital at the next 06:00. Pay 10% of carried clean cash (min $100, max $1,500). **You keep your items.** Stars clear. Your offense record is unchanged. There are no other death penalties (decided).
