# 06 — Minigames

Every interaction with weight (job tasks, crimes, laundering) is a short minigame of **5–25 seconds**. They share one framework so they all feel consistent.

## Shared framework
- A minigame opens as a **small framed panel over the world**, roughly 40% of the screen, in the same pixel art and palette. The world stays visible behind it. Time **does not** pause during crime minigames (police and witnesses keep moving). It does pause during job tasks.
- Common inputs: **Space** to hit, **mouse** to aim or drag, **WASD/arrows** for sequences. Esc cancels; cancelling a crime minigame counts as a fail.
- Output is a **grade** (Fail, Poor, OK, Good, Excellent). Jobs map grades to XP (03). Crimes map grades to speed and noise.
- **Failing a crime minigame** makes noise: a 30% alarm or witness-alert chance, and a tool may break.

### The core skill check (Dead by Daylight style)
A progress bar fills while you hold the action. At random moments a **needle sweeps around a dial**:
- Hitting Space inside the **great zone** gives +progress and a speed bonus.
- Hitting the **good zone** keeps progress.
- **Missing** knocks progress back and makes noise.

Difficulty parameters:

| Parameter | Tier 0 | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---|---|---|---|---|
| Needle speed (rev/s) | 0.8 | 1.0 | 1.2 | 1.45 | 1.7 |
| Good zone width (°) | 60 | 48 | 38 | 30 | 24 |
| Great zone width (°) | 14 | 11 | 9 | 7 | 6 |
| Checks per attempt | 2 | 3 | 4 | 5 | 6 |

**Tools give tolerance:** a basic tool adds +15% to zone width, a pro tool adds +30% and −1 check. Each tool has durability (for example 10 uses); fails cost 2 uses.

## Minigame list
| Minigame | Used by | Mechanic |
|---|---|---|
| **Lockpick** | Cars, doors, trunks | Core skill check. Tool: lockpicks (basic $40 / pro $250). |
| **Hotwire** | Carjacking | Match 3–5 coloured wire pairs before a timer runs out. A wrong pair sparks (noise). |
| **Safe crack** | Safes, armored truck door, vault | Rotate the dial with the mouse and stop on each click (shown as a pulse on the dial). 3–5 numbers. Tool: stethoscope widens the click window. |
| **ATM hack** | ATM robbery | Memorise and repeat a growing arrow sequence (Simon-style). The alternative is **Drill**: hold, keeping a heat needle out of red. |
| **Intimidate** | Store robbery, witnesses | Hold right mouse to aim. Keep the clerk's "nerve" meter between too low (they stall) and too high (they hit the alarm). |
| **Register grab / search** | Robbery, trunks, burglary | Click glinting items in a grid before the timer runs out. Gold items are worth more. |
| **Pull out** | Occupied carjack | Button-mash bar against the driver's resistance |
| **Filing** | Office | Papers drop in; drag each to the tray of matching colour and stamp. Speed rises. |
| **Data entry** | Office | Type a short sequence of keys shown on screen |
| **Diagnose** | Mechanic | Listen and look: pick the faulty part out of 4 from symptoms |
| **Bolt torque** | Mechanic | Core skill check, but each check is one bolt |
| **Chop** | Lumberjack | Swing meter: stop the cursor in the sweet spot. Each hit cuts the notch deeper. |
| **Load / stack** | Lumberjack, delivery | Tetris-like packing of crates or logs into a truck bed |
| **Route** | Delivery | Pick the shortest of 3 drawn routes within 5 s |
| **Patrol / camera watch** | Security | Spot the odd one out across 4 camera feeds |
| **Jackhammer / paint lines** | Road worker | Rhythm hits, or hold a steady line along a guide |
| **Money count** | Laundering, printing | Count bills into bundles of 10 quickly; miscounts cost a % |
| **Plough / plant** | Farmer | Steer the tractor along furrow guide lines; drifting off the line lowers the grade |
| **Harvest** | Farmer | Timing: hit as the cutter passes ripe rows |
| **Crane magnet** | Scrap yard | Swing the crane and drop the car on the target pad |
| **Crush** | Scrap yard | Timing bar to crush cleanly without jamming |
| **Sort metal** | Scrap yard, farmer (produce) | Drag items into the matching bins as they arrive |
| **Alarm bypass** | Alarm panels (store after hours, jewellery closet, bank security room) | Two parts: cut the correct wires in an order shown by a colour-coded diagram (a wrong wire ends it), then enter a 4-digit code (from the vault code item, or crack it Mastermind-style) |
| **Disable cameras** | CCTV desks | Toggle the camera feeds off in sequence before a detection bar fills |
| **Wipe footage** | DVR recorders | Hold to erase, keeping a scrub marker inside a moving window (like the drill) |
| **Crowd control** | Robberies, heists | Keep the hostage meter up: aim at hotspots and press the shout key as figures start to rise |
| **Vault drill** | Bank vault door | Long core skill check (8–10 checks). Overheating pauses it; tools add tolerance. |
| **Thermal charge** | Vault doors, gates | Place 4 charges on marked points in under 10 s, then detonate (loud) |

## Accessibility: minigame assists
Settings toggles, each on its own:
- **Slower needle** (−30% speed)
- **Wider zones** (+40%)
- **Hold instead of mash**
- **No time limit on job tasks**
- **Auto-complete job tasks** at an "OK" grade

Assists do not change payouts. Auto-complete caps the grade at OK.
