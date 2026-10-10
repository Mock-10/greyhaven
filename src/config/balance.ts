// Every tunable number in the game lives here (CLAUDE.md §2: no magic numbers in systems).
// Phase 0 only needs the camera, the debug walker and the render settings.

export const BALANCE = {
  sim: {
    /** Fixed simulation rate (docs/14: fixed timestep, e.g. 30 Hz). */
    tickHz: 30,
    /** Longest frame the simulation will catch up on, in seconds (avoids a spiral after a stall). */
    maxFrameSeconds: 0.25,
  },

  camera: {
    /** Integer zoom levels the player can step through with Ctrl + wheel (docs/11). ?zoom=1 also works for debugging. */
    zoomLevels: [2, 3, 4] as readonly number[],
    /** Default zoom is the largest whole number that fits this many art pixels on screen. */
    fitWidth: 640,
    fitHeight: 360,
    /** Mouse pan reaches up to this many tiles from the player (docs/11). */
    panMaxTiles: 12,
    /** The camera springs back to the player after this many seconds without pan input (docs/11). */
    panIdleReturnSeconds: 3,
    /** Spring-back speed: fraction of the pan offset removed per second. */
    panReturnRate: 4,
    /** Edge scroll starts when the mouse is this close to the canvas edge, in CSS pixels. */
    edgeScrollMarginCss: 8,
    /** Edge scroll speed in art pixels per second (at any zoom). */
    edgeScrollSpeed: 360,
    /** Soft deadzone around the followed target, in art pixels. */
    deadzoneW: 48,
    deadzoneH: 32,
    /** Follow smoothing: fraction of the remaining distance closed per second. */
    followRate: 8,
  },

  walker: {
    /** Walking speed in world units per second (1.4 m/s ≈ 1 tile per second). */
    walkSpeed: 32,
    /** Sprint multiplier (Shift). */
    sprintMultiplier: 1.9,
    /** Walk-cycle frames per second (idle → walk1 → idle → walk2). */
    walkFps: 7,
    /** Collision radius of a person, in world units. */
    radius: 6,
  },

  render: {
    /** Ground shadow strength (art/source/scene.py: shadow mask × 0.42). */
    shadowStrength: 0.42,
    /** Shadow mask values for box and blob shadows (scene.py polygon 150, ellipse 170). */
    shadowBoxValue: 150,
    shadowBlobValue: 170,
    /** A tall sprite in front of the player fades to this opacity (docs/11, docs/14). */
    occludedAlpha: 0.35,
    /** Sprites shorter than this (art px above their anchor) never fade. */
    occluderMinHeight: 56,
    /** Interactable idle shimmer frame rate (STYLE_GUIDE: about 6 fps). */
    shimmerFps: 6,
    /** Ground chunks are baked in blocks of this many tiles per side. */
    chunkTiles: 16,
    /** Most baked ground chunks kept in video memory at once. */
    maxChunks: 24,
  },
} as const;
