# 17 — Story, Characters and Missions (light story)

**Decision:** a *light story*. The game stays a sandbox. A small cast of named characters offers **optional mission chains** that teach systems, give rewards and add personality. There is no main plot, no forced ending and no failure state. Every chain can be ignored.

## Rules
- Each chain is **3–5 short missions** built from existing systems (jobs, minigames, crimes, driving). Missions add no new mechanics.
- Characters are reached through the **phone contacts** (11) and appear at fixed spots in the world. They use the character art pipeline (named outfits plus a portrait).
- Mission rewards are money, unique items, discounts or early access to a service. Never give power that skips the economy (no free front business).
- Chains unlock by career rank, reputation tier or day number. One chain can be active per character at a time.
- Tone follows the path (00 §6): civilian chains are dry and wry, crime chains are tense.
- Dialogue is short: 1–4 lines per beat, shown in a pixel speech panel. No voice acting.

## Cast (approved)
The user approved this cast. **Before writing each character's chain**, show the user its outline and get confirmation (see 16).

| Character | Where | Path | Chain unlocks | Chain outline | Reward |
|---|---|---|---|---|---|
| **Ms. Hollis**, your office manager | Greyhaven tower | Civilian | Office rank 2 | Fix a filing disaster, cover a missing report, survive an audit | +XP, $500 bonus, a key card early |
| **Dez**, bar owner and launderer | The bar, Downtown | Crime | Day 2 evening | First laundering run, a fence errand, "lose the tail" | Laundering cut −5% for good |
| **Marlo**, chop shop boss | Industrial | Crime | First carjack sold | Steal 3 specific cars, deliver under a time limit, respray | Chop prices +10%, a free respray |
| **Old Pete**, farmer | Outskirts farm | Both | Farming rank 1 **or** reputation tier 2 | Help with the harvest, notice night planes, "keep quiet" or "take a cut" | Airdrop schedule early, or a clean-money bonus |
| **Det. Ruiz**, police detective | Police HQ (meets you after your first jail) | Pressure | First repeat-offense jail | Low-key warnings. Optional "informant" choice: report a rival crew for a lighter record. | Offense record −1, or nothing |
| **Vance**, rival crew leader | Docks | Rival | Reputation tier 2 | Escalating friction: a stolen shipment, a hideout hit, a final showdown | Rival hits stop for 14 days; unique weapon |

## Mission framework (tech)
- Missions are data in `src/data/missions.ts`: id, character, unlock condition, steps (objective type, target, timer) and rewards.
- Objective types reuse systems: `goTo`, `doJobTask`, `minigame`, `stealCar`, `deliver`, `survive`, `loseWanted`, `talkTo`.
- Mission progress is saved (12).


## Decisions (question round of 2026-10-11, before autopilot)
- Claude writes the outlines for all 6 chains in one document and builds from it; the user reviews afterwards.
- Vance's crew is the **Saltgate Union** (see 04).
