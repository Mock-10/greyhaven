# 11 — UI, HUD and Controls

## HUD (classic GTA layout, pixel style)
**Reference mockups (match these):**
- `art/drafts/hud/hud_mockup_street.png`: 2★ escape after a store robbery, radar search area, phone message, loot prompt.
- `art/drafts/hud/hud_mockup_lockpick.png`: lockpick minigame panel open next to the target car.
- `art/drafts/hud/hud_kit.png`: every HUD part (stars, weapon icons, money icons, bars, prompts, radar legend, message, objective, key hints).

The generator is `art/source/hud.py` (with `pixfont.py`), and the shapes, colours and sizes in it are the spec. Rebuild these in Phaser as UI-scene game objects; don't use the PNGs as one overlay.

**Layout** (internal resolution 640 × 360, scaled ×3 to 1080p, all pixel-perfect):

| Element | Position | Size | Contents |
|---|---|---|---|
| Weapon + vitals panel | top-left (6, 6) | 112 × 36 | Weapon icon · ammo in the clip (2× font) / reserve · ammo type or MELEE · health bar (red, heart icon) · armor bar (blue-grey, 2 plates) |
| Wanted stars | top-centre | 5 stars, 11 px pitch | Empty (dark), wanted (gold), searching (flash frame alternating at 2 Hz) |
| Time + money panel | top-right | 92 × 36 | Moon or sun icon · day · clock · **clean** cash (cream, khaki bill icon) · **dirty** cash (plum-red, red bill icon) |
| Radar | bottom-left, centre (46, 314) | radius 38 | Iso-oriented map (same projection as the world, ≈0.13 scale). Roads, sidewalks, grass, water, buildings. Blips: player arrow, police (red/blue), objective (gold diamond), home, shops. The police search area is a dashed red/blue ellipse. Off-radar blips stick to the rim. |
| Objective line | bottom-centre | text width + 18 | Gold arrow + current objective (job task, mission step, "LOSE THE COPS") |
| Phone message | bottom-right, above the hints | text width + 22 | Phone icon · sender in gold · one-line message. Stays 5 s, then slides out. |
| Key hints | bottom-right | — | Gold keycaps + muted labels (context hints such as M MASK, P PHONE) |

**Panels** use the dark plum plate (#2d222e at about 90%) with a 1 px gold edge (#b98f3a) and a 1 px rounded corner, the same style as the interaction prompts. Phone messages use a muted lavender edge instead of gold.

**Text:** the 3 × 5 pixel font in `pixfont.py` (caps, digits, punctuation). Use 2× scale only for the ammo count and minigame titles.

**Minigame panels** (06): a framed plate over a dimmed world (35% dark overlay). The title is in 2× gold with the tier on the right. Show the main element (for example the lockpick dial: cream good zone, gold great zone, red needle), progress bar, checks, tool and durability, keycap hints and a noise meter. The panel sits beside the target, never covering it. **Every pop-up panel (job tasks, the shop, crime minigames) can be dragged by its top strip** and remembers where it was put for the session (user request, 2026-10-11). No text or icon in a panel may overlap another; `tests/panels.test.ts` checks every panel state. The shop shows a card per item: an icon (soda can, chips, sandwich, fuel can), the name, the effect, the price and a number key.

**Car readout** (milestone 3): while driving, a 112 × 33 panel under the vitals shows SEDAN, the speed as a share of top speed, a fuel bar (pump icon) and a condition bar (wrench icon); both turn red when low. The key hints switch to W/S DRIVE · A/D STEER · SPACE BRAKE · F EXIT.

## Interaction prompts
- In range (≤ 1.5 tiles) the object shows the **idle gold rim**. When targeted (nearest in the facing direction, or under the mouse) it shows the **hover rim** plus a prompt plate: `[E] LOCKPICK`.
- If several objects overlap, **Tab** cycles between them.
- Prompts show requirements in red when they aren't met: `[E] LOCKPICK — needs lockpicks`.

## Menus
- **Pause** (Esc): resume, settings, save, load, export/import, quit.
- **Phone** (P): job board, map, contacts (launderer, dealer, gang contact, HR, lawyer), crew, properties, bank (clean balance). This is the main hub for the systems.
- **Inventory** (I): grid with weight; weapons; tools with durability.
- **Shop screens:** list with icons, prices, a clean/dirty toggle where relevant.
- **Life Summary** (from the phone).

## Controls (rebindable)
| Action | Key |
|---|---|
| Move (on foot) | WASD |
| Sprint | Shift |
| Interact | E |
| Aim / fire | Right mouse / Left mouse |
| Switch weapon | 1–4 / mouse wheel (when not zooming) |
| Reload | R |
| Enter/exit vehicle | F |
| Drive | W/S throttle/brake, A/D steer, Space handbrake |
| Horn | H |
| Put on / remove mask | M |
| Phone | P |
| Inventory | I |
| Surrender | Y (when prompted) |
| Camera pan | hold middle mouse and drag, or push the mouse to the screen edge |
| Camera recenter | C |
| Sight lines on/off (until the settings menu exists) | L |
| Zoom | Ctrl + mouse wheel (integer steps: 1×, 2×, 3×, 4×) |
| Cheat console (playtesting, also on Pages) | Ctrl + Shift + F1 |

## Camera
- Isometric and fixed angle (no rotation, matching the pre-rendered sprites).
- **Default view (reworked 2026-10-11):** the largest whole-number zoom that still shows 960 × 540 art pixels, about 2× more world than the first build. 1080p runs at 2×, 720p at 1×, 4K at 4×. Ctrl + wheel steps through 1×–4×.
- **Follow:** a soft deadzone and a critically damped spring (no overshoot, no wobble); the scroll is always a whole art pixel.
- **Look-ahead:** in a car the view leads in the direction of travel, up to 55% of the half view at top speed, so the car sits toward the trailing edge and more road shows ahead. On foot the view leans up to 40 art px toward the mouse.
- **Context zoom:** getting into a car steps the zoom out one level (never below 1×); getting out steps back in.
- **Mouse pan:** drag with the middle mouse, or edge-scroll. It can move up to 12 tiles from the player and springs back on C or after 3 s idle.
- **Zoom** is **integer only** so pixels stay crisp. Rendering is pixel-perfect (`pixelArt: true`, `roundPixels`).
- **Occlusion (reworked 2026-10-11):** anything in front of the player (or the car you drive) whose pixels hide at least 12% of them fades to 35% opacity, whatever its height (kerb-high things excepted); thin lamp posts and the empty corners of a tree's sprite don't count. Where the player or car is still hidden, a **silhouette** in muted lavender shows through (WebGL). This is essential for the Project Zomboid feel.
- **Overhead roofs** (the fuel canopy) draw over whatever stands under them and fade as you get close.
- **Sorting of moving things:** cars, the player and NPCs are sorted against each other by their turned footprints (the one on the far side of a separating line draws first), within the order of the static objects around them.
- **Enterable buildings** get a 1 px gold outline (gold because doors are interactables): faint within about 7 tiles of the door, bright when the door is targeted.
- **World prompts** stay clear of the HUD: below the top panels, above the objective and hint strip, off the radar. The key hints sit on a plate.

## Character creator (new game)
A simple creator, shown before the guided first day:
- **Skin tone:** 6 swatches from the `skin` ramp.
- **Hair style:** short, long, bun, bald (plus a cap or hood as headwear later).
- **Hair color:** 5 swatches (dark brown, black, khaki-blonde, grey, plum-red).
- **Starting outfit:** 3 casual outfits in palette colors.
- **Name:** text field, 16 characters.
- A live 8-direction preview spins slowly.
- Implementation: **palette swapping**. Player sprites are rendered once per hair style (geometry) with marker ramps for skin, hair, top and bottom. At load, the game recolours those ramps into the chosen colours on a canvas and caches the result as a texture. Generate the marker-ramp sprites with `art/source/` (13).

## Settings
Audio volumes · key bindings · minigame assists (06) · **day length 15/20/30 min** · **sight lines on/off** (default on; see 19) · screen shake on/off · UI scale (integer).

## Onboarding: the guided first day
A short guided first day of about 15 real minutes, with skippable hints:
1. Wake in the apartment. Movement hint, then walk to the bus stop or taxi.
2. Pick your starting job at the job board, and travel there.
3. Do the first shift, with each minigame introduced.
4. Get paid, buy something at a store (shows clean money).
5. Evening: an NPC at the bar mentions "easier money". Lockpick a car's trunk, with the stars and witness system shown (low-stakes, 1★).
6. Lose the cops, go home, sleep: shows the autosave and the rent reminder.


## Decisions (question round of 2026-10-11, before autopilot)
- **Camera rework:** the default view shows about **2× more world** (fit about 960 × 540 art pixels, so 1080p runs at 2×). When you drive, the camera **steps out one integer zoom level** and leads ahead so the car sits toward the trailing edge. A player or car hidden behind a building shows as a **silhouette**, and the covering building **cuts away or fades**.
- **Cheat console:** on the Pages build behind a hidden key combo, so the user can playtest (add cash, set stars, set rank or reputation, skip time).
- **Character creator:** as specced (no body types, no extra hair).
- **Onboarding:** no bus or taxi step; step 5 uses trunk looting (brought forward to Phase 2).
