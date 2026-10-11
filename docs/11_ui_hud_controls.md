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

**Minigame panels** (06): a framed plate over a dimmed world (35% dark overlay). The title is in 2× gold with the tier on the right. Show the main element (for example the lockpick dial: cream good zone, gold great zone, red needle), progress bar, checks, tool and durability, keycap hints and a noise meter. The panel sits beside the target, never covering it.

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
| Zoom | Ctrl + mouse wheel (integer steps: 2×, 3×, 4×) |

## Camera
- Isometric and fixed angle (no rotation, matching the pre-rendered sprites).
- Follows the player with a soft deadzone. In a car, it leads in the direction of travel by up to 3 tiles.
- **Mouse pan:** drag with the middle mouse, or edge-scroll. It can move up to 12 tiles from the player and springs back on C or after 3 s idle.
- **Zoom** is **integer only** so pixels stay crisp. Rendering is pixel-perfect (`pixelArt: true`, `roundPixels`).
- **Occlusion:** when the player is behind a tall building, that building fades to 35% opacity, or its top floors are cut away. This is essential for the Project Zomboid feel.

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
