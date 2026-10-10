# Art style guide — pixel crime/life sim

Isometric pixel art in the spirit of Project Zomboid and RollerCoaster Tycoon 2, coloured with the
**Grey Weather** palette, lifted slightly so the game is never as dark or washed-out as the raw palette.

## Grid and scale
- Tile: 64 x 32 px isometric diamond (2:1). Ground tiles have 1–4 px side faces so curbs and sidewalks read as raised.
- A standing person is about 40 px tall (≈1.75 m), so 1 tile ≈ 1.4 m. Cars are ≈90 px long; a two-lane road is 4 tiles wide. Cars are realistic and boxy: flat glass panels, visible pillars, and a cabin set apart from the hood and trunk. Never rounded "bubble" shapes.
- Buildings are true scale relative to people: a house is ≈3 x 2 tiles, the store ≈4 x 2.5, the office tower ≈4.5 x 4.5 and ≈440 px tall.
- Render at 1x and scale the game canvas by whole numbers (2x/3x, nearest-neighbour). Never smooth-scale.

## Colour
- Every colour comes from `palette.json`. Ramps run dark → light. The 20 Grey Weather swatches are used exactly.
  The extra tints only extend ramps for highlights and shadows.
- Mood: muted lavender-grey world, cool shadows, warm skin and wood, desaturated greens.
- **Gold is reserved.** Only valuables (cash, gold, loot), door handles and interactable cues use the gold ramp, so the eye learns that gold means "you can use this".

## Light and shading
- One light from the upper left of the screen (world vector 0.22, 0.58, 0.78). Top faces are lightest, the screen-left face is mid, and the screen-right face is darkest.
- Gradients are shown with 4x4 ordered (Bayer) dithering between neighbouring ramp tones, not with new colours.
- Every sprite has a 1 px outer outline that uses the darkest tone of its own ramp, never pure black.
- Ground shadows are cast toward the upper right, as a cool plum multiply (#2a1e34 at about 40%).

## Interactables
- **normal**: no cue.
- **idle** (player in range): 1 px gold rim with a dashed shimmer. Cycle frames idle0 → idle1 → idle2 at about 6 fps.
- **hover** (targeted): 1 px bright-gold rim plus a 1 px dark keyline outside it. The sprite is lifted by about 8% brightness.
- Valuables also get 2–3 cross-shaped sparkle pixels.
- Prompt: a dark plate with a gold edge, a gold keycap ("E") and a cream 3x5 pixel-font label, pointing at the object.
- At night or in rain, cues and lit windows are exempt from the darkening tint, so they always pop.

## Sprites and atlases
- Every atlas `.json` lists frames with a cell rect and an `anchor`. The anchor is the pixel that sits on the object's ground point (the feet or the footprint centre). Ground tiles anchor on the diamond's top vertex.
- Characters and vehicles have 8 directions named by on-screen facing: SE, S, SW, W, NW, N, NE, E.
- Character walk cycle: idle → walk1 → idle → walk2.
- Draw order: tiles first, then objects sorted by world (x + y) of their ground point.

## Atmosphere variants
- Rainy dusk: multiply objects by about (0.66, 0.66, 0.80) and tiles by (0.60, 0.62, 0.78), and swap some asphalt for wet asphalt (puddles that reflect the cool sky).
- Add warm street-lamp pools, quantised into 4 dithered bands.
- Rain: slanted 3–6 px streaks in #bcafb6 at about 45% opacity.

## Interiors, decoration and facing (added after the interior review)
- Interiors are cutaway rooms. The outer back walls are full height; front walls and internal partitions are cut down with dark tops. See `drafts/interiors/` and `docs/18_interiors.md`.
- **Spaces must feel lived-in:** plants in corners, art and clocks on walls, rugs that define areas, and clutter on every surface. The library is in `source/decor.py` (preview: `drafts/decor_library.png`). Make new pieces whenever needed.
- **Facing:** every model's front is local +y. Place models with `face()`. Chairs face desks, the sofa and TV face each other, and storage faces into the room.
