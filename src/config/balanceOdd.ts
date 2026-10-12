// Numbers for the Phase 2 M8 weekend odd jobs (docs/02 "Weekend odd jobs", docs/03, docs/06): the car wash gig at
// Squeaky's Car Wash and the bar shift at The Low Tide. One const so it can be folded into BALANCE (as
// BALANCE.oddJobs). Times are in seconds unless they say minutes. Odd-job tasks are job tasks, so they pause the
// world (docs/06) and every timer here is real time spent in the panel.

export const BALANCE_ODD = {
  /** docs/01 and 03: odd jobs run on the weekend only (day of the week 0 = Monday, so 5 and 6 are Sat and Sun). */
  days: [5, 6] as readonly number[],
  /** docs/03: a gig pays this share of the shift pay of your current job's rank. */
  payShare: 0.6,
  /** Tips on top of the gig pay, as a share of it, by the gig's typical grade (the rounded-down average of its
   *  tasks, fail counted as poor, as for a shift): poor, OK, good, excellent. */
  tipShare: [0, 0.05, 0.1, 0.2] as readonly number[],

  /** Score thresholds (share of a perfect run) for the score-graded tasks: at or above each is that grade. */
  grades: { excellent: 0.95, good: 0.8, ok: 0.55, poor: 0.25 },

  gigs: {
    /** Squeaky's Car Wash: start a gig between `from` and `until` (minutes of the day); wash `tasks` cars. */
    carWash: { from: 9 * 60, until: 16 * 60, tasks: 3 },
    /** The Low Tide (open 16:00–02:00, docs/18): a shift is `tasks` rushes at the counter. */
    barShift: { from: 16 * 60, until: 22 * 60, tasks: 3 },
  },

  /** Car wash: scrub a car's side clean. The side is a grid of cells holding dirt (0 = clean). Mud is 1–2 coats;
   *  tar spots and bird droppings are `stubborn` coats. Each car carries `patches` mud patches (and one more per
   *  car after the first) and `spots` stubborn spots. Holding scrub takes `rate` coats a second off the cells
   *  under the sponge, falling off to nothing at `radius` cells. Scrubbing uses `sudsUse` of the sponge's suds a
   *  second; a dry sponge doesn't clean, and dunking it in the bucket refills it but takes `dunkTime`. A cell is
   *  clean at `cleanAt` or less. The sponge moves at `spongeSpeed` widths a second on the keys. */
  carWash: {
    cols: 18,
    rows: 6,
    /** The car's cabin (windows and roof) takes the top `rows` rows, between these shares of the width; the rest
     *  of those rows is sky, with no dirt. */
    cabin: { rows: 2, from: 0.22, to: 0.78 },
    seconds: 18,
    patches: 4,
    patchRadius: 2.2,
    spots: 2,
    stubborn: 3,
    rate: 3.2,
    radius: 1.6,
    sudsUse: 0.22,
    dunkTime: 0.7,
    cleanAt: 0.15,
    spongeSpeed: 1,
    /** Every cell clean with this share of the time left: excellent; every cell clean: good. Short of that, this
     *  share of the dirty cells cleaned is OK, and `poorShare` poor; less is a fail. */
    excellentTimeShare: 0.3,
    okShare: 0.8,
    poorShare: 0.5,
  },

  /** Bar shift: patrons sit at `seats` stools and order a drink; pick its tap and hold to pour. A glass fills at
   *  the drink's `rate` (glasses a second) and is right when it stops within `good` of the `line` (`great` for a
   *  perfect pour); short of that it's a short pour, and past `spill` it runs over and is wasted. A pour goes to
   *  the patron who has waited longest for that drink; no patron wanting it wastes it. Patrons arrive every `gap`
   *  seconds (the first at once) and leave after `patience` seconds unserved. A rush is `patrons` patrons. */
  barShift: {
    seats: 3,
    patrons: 6,
    gap: 2.6,
    patience: 11,
    line: 0.85,
    good: 0.07,
    great: 0.03,
    spill: 1.0,
    /** Seconds before the next glass can go under a tap (setting down a pour, or mopping up a spill). */
    serveTime: 0.35,
    spillTime: 0.9,
    /** Score per patron by how they were served. */
    score: { perfect: 1, fine: 0.8, short: 0.4, missed: 0 },
  },
} as const;
