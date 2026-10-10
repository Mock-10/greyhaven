# 19 — Sight and Hidden Rooms

**Decision (the user's direction):** sight matters. The player only sees what their character could see. A room behind a wall stays hidden until a door is opened or there is another line of sight into it. For example, a player in the bank lobby **cannot** see the gold and cash in the vault.

The four interior drafts in `art/drafts/interiors/` show everything at once *for presentation only*. In the game, every interior uses the rules below.

**Reference drafts:**
- `art/drafts/interiors/interior_bank_sight_lobby.png`: standing in the lobby with the security and vault doors shut.
- `art/drafts/interiors/interior_bank_sight_vault.png`: in the corridor with the vault open; earlier rooms are remembered.

## Setting: Sight lines (on / off)
Players can switch this in **Settings → Gameplay → Sight lines**. **Default: On.**
- **On:** everything in this document applies. Unseen rooms are covered by the dark lid, rooms seen earlier are dimmed with last-seen ghosts, and back walls above hidden rooms are darkened.
- **Off:** nothing is blacked out or dimmed. Every room is fully visible at all times, with every wall cut down. This is the look of the presentation drafts (`interior_store.png`, `interior_bank.png` and others). Interactable rims and prompts still only appear in range, as usual.
- The setting is **visual only**. Guards, witnesses and police still use line of sight, closed doors still block *their* view, and noise still travels the same way. Turning it off reveals the map to the player but doesn't change how the world reacts.
- It can be changed at any time, including mid-heist. The change applies instantly with a short fade (about 150 ms), and no save or reload is needed.
- Remembered-room data keeps being recorded while the setting is off, so switching it back on shows the correct remembered state.

## The three states of a space
| State | When | What is drawn |
|---|---|---|
| **Visible** | The player's current room, plus anything an unblocked line of sight reaches | Everything: furniture, decoration, people, loot, interactable rims and prompts |
| **Remembered** | Rooms seen earlier that are not visible now | Floor, walls and **static** furniture, dimmed (about 50%, cooler). **Live things show as last-seen ghosts** (decided): a faint outline at the spot you last saw each person or piece of loot, frozen at that moment. Ghosts may be out of date, because guards move and loot gets taken. No rims or prompts. |
| **Unseen** | Never seen | A **dark lid** at the height of the cut walls covers the room (dithered plum, slightly lighter at the edge). The back wall above it is darkened. Walls between two unseen rooms are not drawn. Nothing inside is drawn. |

## What blocks sight
| Blocks | Doesn't block |
|---|---|
| Walls and partitions; **closed doors** (wood, metal, the vault door) | **Open** doorways; **gates and bars** (the corridor gate); **glass** (teller glass, interior windows, glass doors); furniture (it never hides a room) |

- **Doors** have open and closed states. Opening one (E) reveals what is behind it at once. NPCs can close doors again.
- The **player's current room** is always fully visible, including corners behind furniture.
- Sight range indoors is about 13 tiles (420 units). In practice walls limit it first.
- **CCTV (decided):** sitting at a camera desk in a security room lets you **watch the camera feeds**. Each camera-covered room is *visible* while you watch, and its ghosts update. This is the reward for reaching the security room before disabling the cameras.

## Guards, staff and witnesses use the same rules
- NPCs see the player only along unblocked lines of sight, so a guard behind a closed door can't see you.
- **Noise travels further than sight:** lockpicking, drilling, shouting, shots and charges emit noise in a radius. Walls and closed doors halve it. NPCs who hear a noise come to investigate, so a loud vault charge pulls guards from other rooms even if they can't see you.

## Outdoors
- **Full street view** (decided): there is no vision cone outdoors. The player sees the whole street around them; only interiors are hidden.
- **No peeking through exterior windows** (decided). Casing a place means walking in.
- Building interiors are **never** visible from the street. You see the exterior building sprite (roof, walls, windows), and the interior map only loads when you enter.
- Outdoor line of sight for **NPCs and police** uses buildings as blockers, which already affects witnesses and the police search (05).

## Implementation (Phaser)
- Use a sight grid of **8-unit cells** (4 per tile) per interior map. Walls and closed doors are edges on that grid.
- Recompute when the player moves more than about 4 units, a door changes state, or the player enters or leaves a CCTV desk. Use **symmetric shadowcasting** (or ray casts to cell centres, as in `art/source/sight.py`).
- Each room is the flood-fill region bounded by walls, with every doorway treated as a wall. The current room is always visible.
- **Remembered** state is stored per room in the save (rooms seen per interior), along with a last-seen snapshot of the people and loot there. Ghosts are drawn as a 1 px outline in a muted lavender at about 40% opacity, never with the gold rim.
- **Rendering:**
  - unseen cells: a lid layer at the cut-wall height, depth-sorted with objects
  - remembered: a dim tint on the floor and static sprites
  - back-wall segments above non-visible cells: darkened
  - fade between states over about 150 ms
- **Performance:** the bank map (12 × 10 tiles) is 1,920 cells. Recomputing it must take under 2 ms.
- The reference implementation used to make the drafts is `art/source/sight.py`, with the lid and dim rendering in `art/source/rooms.py` (`compose(..., sight=...)`).
