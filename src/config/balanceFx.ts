// Every number of the animation and effects pass (CLAUDE.md "No magic numbers in systems"): UI motion, the
// particle effects, rain and the player's tool animations. Times are in seconds, distances in UI pixels for the
// UI and world units (32 per tile) for the world.

export const FX = {
  ui: {
    /** A panel (minigame, shop, phone, menu) unfolds in this long and folds away faster. */
    panelOpen: 0.16,
    panelClose: 0.11,
    /** Pixels a panel rises through as it opens. */
    panelRise: 6,
    /** Small plates (the prompt, the car readout) rise this far as they pop in. */
    popRise: 3,
    /** Toasts and the street name slide in from this far right. */
    slideIn: 28,
    /** The cash readout rolls to a new amount over this long. */
    moneyRoll: 0.55,
    /** A "+$40" floats up this many pixels while it fades. */
    popupRise: 12,
    popupSeconds: 1.3,
    /** At most this many cash pop-ups at once (older ones drop). */
    popupMax: 3,
    /** The health bar's damage trail waits this long, then drains over `trailDrain`. */
    trailHold: 0.35,
    trailDrain: 0.45,
    /** Health at or under this pulses the vitals panel red, at this rate (Hz). */
    lowHealth: 0.25,
    lowHealthHz: 1.6,
    /** A star gained or lost flashes this long. */
    starFlash: 0.6,
    /** The objective types itself out at this many characters a second, and its plate glints this long. */
    typeCps: 45,
    objectiveGlint: 0.5,
    /** The hint strip dithers in this fast when it changes. */
    hintFade: 0.14,
    /** A shake (a failed pick, a fumble): this many pixels, decaying over this long. */
    shakePx: 3,
    shakeSeconds: 0.28,
    /** UI sparks and confetti (successes, the star burst). */
    burstGravity: 160,
    burstMax: 80,
  },

  world: {
    /** Particles alive at once (the oldest drop first). */
    maxParticles: 500,
    /** A footstep every this many world units walked (a stride), and how much dust it kicks up. */
    stride: 22,
    sprintStride: 30,
    /** Dust puffs per step: sprinting on pavement, and any step on soft ground (dirt, grass, gravel). */
    sprintDust: 1,
    softDust: 1,
    /** Exhaust puffs a second at idle, plus this much more at full throttle. */
    exhaustIdle: 3,
    exhaustThrottle: 9,
    /** Braking harder than this (world units/s²) above `skidSpeed` leaves skid marks and tyre smoke. */
    skidDecel: 260,
    skidSpeed: 70,
    /** A skid mark every this many units travelled while skidding; tyre smoke puffs a second. */
    skidEvery: 7,
    tyreSmokeRate: 18,
    /** Turning this fast (radians/s) above `skidSpeed` also skids. */
    skidTurn: 1.6,
    /** Wheel dust a second on soft ground at speed (above `dustSpeed`). */
    wheelDustRate: 10,
    dustSpeed: 40,
    /** A crash this hard (impact speed) throws chips and sparks: count per impact speed, capped. */
    crashMin: 40,
    crashChipsPer100: 8,
    crashSparksPer100: 10,
    crashMaxEach: 16,
    /** Camera shake in screen pixels per 100 impact speed, capped. */
    crashShakePer100: 2,
    crashShakeMax: 4,
    /** Glints when cash changes hands. */
    cashGlints: 6,
    /** Sparks a hotwire attempt throws (and on a fumble). */
    hotwireSparks: 5,
  },
  rain: {
    /** Streaks on screen at full rain, per 100 × 100 screen pixels (at 1×). */
    density: 2.2,
    /** Fall speed in screen pixels a second; streaks slant down-left at half that sideways. */
    fallSpeed: 300,
    /** Share of streaks that end in a splash on the ground. */
    splashShare: 0.6,
    /** Streak opacity (STYLE_GUIDE: about 45%). */
    alpha: 0.45,
    /** About 25% of nights it rains (docs/01), starting between 20:00 and 23:00, for 2 to 5 hours. */
    nightChance: 0.25,
    startMin: 20 * 60,
    startSpread: 3 * 60,
    lengthMin: 2 * 60,
    lengthSpread: 3 * 60,
    /** Minutes for the rain to build up and die down. */
    ramp: 20,
  },
  actions: {
    /** Seconds the "use" reach plays before going back to idle (doors, ATMs, any E). */
    useSeconds: 0.35,
    /** The idle breathing loop starts after standing still this long. */
    breatheAfter: 1.2,
  },
} as const;
