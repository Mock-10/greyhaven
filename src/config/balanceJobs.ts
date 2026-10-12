// Numbers for the Phase 2 M7 job minigames (docs/06, docs/03): the mechanic's diagnose, bolt torque, tyre change
// and respray, the lumberjack's chop, load / stack for the lumber camp and the depot, the courier's route pick, and
// the office's stamp-and-sign and meeting. One const so it can be folded into BALANCE (as BALANCE.jobMinigames).
// Times are in seconds. Job tasks pause the world (docs/06), so every timer here is real time spent in the panel.

export const BALANCE_JOBS = {
  /** Score thresholds (share of a perfect run) for the score-graded tasks: at or above each is that grade. */
  grades: { excellent: 0.95, good: 0.8, ok: 0.55, poor: 0.25 },
  /** Core-skill-check tier (docs/06 table) for a job task at each rank 1–5: the work gets fiddlier as you rise. */
  tierByRank: [1, 1, 2, 2, 3],

  /** Diagnose (mechanic): pick the faulty part out of 4 from two symptoms. Cars per task, the timer for all of
   *  them, and the share of time left for an excellent grade. */
  diagnose: { rounds: 3, options: 4, seconds: 20, excellentTimeShare: 0.4 },

  /** Bolt torque (mechanic): the core skill check where each check is one bolt. A wheel has at least `minBolts`;
   *  higher tiers have more (the tier's check count). Over-torques allowed before the stud strips (fail). */
  boltTorque: { minBolts: 4, maxMisses: 4 },

  /** Tyre change (mechanic): six steps, each a short arrow sequence. */
  tyreChange: { minKeys: 2, maxKeys: 3, seconds: 18, excellentTimeShare: 0.35 },

  /** Respray (mechanic): spray a door panel evenly. The panel is a grid of cells that collect coats of paint.
   *  `rate` is coats per second under the nozzle centre, falling off to nothing at `radius` cells. A cell is even
   *  between `lo` and `hi` coats and runs (drips) past `runAt`; each run costs `runPenalty` of an even cell.
   *  `nozzleSpeed` is the keyboard nozzle's speed in panel widths per second. */
  respray: {
    cols: 16,
    rows: 6,
    seconds: 14,
    rate: 4.5,
    radius: 2,
    lo: 0.7,
    hi: 1.8,
    runAt: 2.4,
    runPenalty: 1,
    nozzleSpeed: 0.6,
  },

  /** Chop (lumberjack): a swing meter. The cursor sweeps the bar `speed` times a second (one end to the other),
   *  a little faster after every swing; a great hit cuts the notch 2 deep, a good one 1, a miss glances off. The
   *  zones are half-widths as a share of the bar. Each swing takes `swingTime` (the cursor waits). */
  chop: {
    depth: 6,
    maxSwings: 9,
    speed: 0.9,
    speedUp: 0.07,
    good: 0.11,
    great: 0.035,
    spotMin: 0.18,
    spotMax: 0.82,
    swingTime: 0.35,
    /** Felled in at most this many swings with no miss: excellent. */
    excellentSwings: 4,
  },

  /** Load / stack (lumberjack logs, delivery crates): drop pieces into a truck bed seen from the side, Tetris-like.
   *  The pieces fill about `fill` of the bed; a piece that doesn't fit is left behind. */
  load: {
    cols: 8,
    rows: 4,
    fill: 0.8,
    seconds: 24,
    excellentTimeShare: 0.3,
    /** Piece shapes (width × height in bed cells) per mode. Logs lie lengthwise and can't be turned. */
    shapes: {
      crates: [
        [1, 1],
        [2, 1],
        [1, 2],
        [2, 2],
        [3, 1],
      ],
      logs: [
        [2, 1],
        [3, 1],
        [3, 1],
        [4, 1],
      ],
    },
  },

  /** Route (delivery): pick the shortest of 3 drawn routes within `seconds` (docs/06: 5 s), `rounds` times. The
   *  map is a street grid `gridW` blocks wide and `gridH` tall. All correct with an average pick under `fastAvg`
   *  seconds is excellent. */
  route: { rounds: 3, seconds: 5, gridW: 8, gridH: 6, fastAvg: 2 },

  /** Stamp and sign (office): papers slide past the desk stamp; hit Space as each stamp box, then each signature
   *  line, passes under it. Positions are in paper widths (the marks measured from the paper's leading edge); speed in paper widths per second, rising per second
   *  of play. Windows are half-widths. A good hit is worth `goodWorth` of a great one. */
  stamp: {
    docs: 5,
    pitch: 1.0,
    lead: 1.1,
    stampAt: 0.25,
    signAt: 0.62,
    speed: 0.42,
    accel: 0.012,
    great: 0.035,
    good: 0.09,
    goodWorth: 0.75,
  },

  /** Meeting (office, rank 3+): three questions from the boss, a reply each; the boss's mood (0–100) sets the
   *  grade. Saying nothing before the timer runs out costs `silence`. */
  meeting: {
    rounds: 3,
    seconds: 9,
    startMood: 40,
    silence: -12,
    /** Mood at the end for each grade: only three of the boss's favourite replies reach excellent. */
    moodFor: { excellent: 88, good: 66, ok: 45, poor: 25 },
  },

  /** Fell direction (lumberjack): fell each tree into the clear lane. The aim sweeps back and forth `sweep` degrees
   *  either side of the lane at `aimSpeed` degrees a second; the tree's lean and the wind push its fall off the aim
   *  by up to `leanMax` and `windMax` degrees, so aim against them. A fall within `great`, `good` or `lane` degrees
   *  of the lane's centre lands clean, close, or just in; outside it hits something. Each tree falls on its own
   *  (wherever the lean takes it) after `seconds`. */
  fell: {
    trees: 3,
    seconds: 6,
    sweep: 60,
    aimSpeed: 70,
    leanMin: 4,
    leanMax: 14,
    windMax: 10,
    great: 5,
    good: 11,
    lane: 20,
    /** Score per tree: clean, close, just in (a miss scores 0). */
    worth: { great: 1, good: 0.75, ok: 0.5 },
  },

  /** Doorstep (delivery): walk the street strip to the house on each parcel's label and hand it over. Houses on the
   *  strip, parcels per task, the timer, a step's time, and the share of time left for an excellent grade. */
  doorstep: { houses: 8, parcels: 3, seconds: 16, stepTime: 0.18, excellentTimeShare: 0.3 },

  /** Signature (delivery): trace the customer's squiggle with the mouse. The pad is 1 wide and `aspect` tall. A
   *  pen sample within `tolerance` of the line is on it, and a point of the line is covered when a sample passed
   *  within `tolerance` of it. The score is coverage × the share of samples on the line. */
  signature: { points: 48, seconds: 8, tolerance: 0.045, aspect: 0.36, waves: 3, amplitude: 0.11 },
} as const;
