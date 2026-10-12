// Phase 3 crime numbers (docs/04, docs/05, docs/10): reputation, store robbery, house burglary, ATM robbery and the
// fence. Kept apart from balance.ts so the crime systems can grow without touching the shared file. Real seconds
// unless noted; money in dollars (payouts are dirty).

import type { Grade } from '../systems/career';

/** Share of the loot a minigame grade gets (search grids, the ATM cassette): every valuable is good or better. */
const GRAB_SHARE: Record<Grade, number> = { excellent: 1, good: 1, ok: 2 / 3, poor: 1 / 3, fail: 0 };

export const BALANCE_CRIME = {
  /** Criminal reputation (docs/04): payout ÷ 6 plus 20 per completed crime, +25% when you escape with stars,
   *  nothing when arrested. Tier thresholds 0 / 400 / 1,800 / 5,000 / 11,000. */
  reputation: {
    perCrime: 20,
    payoutDivisor: 6,
    escapeBonus: 0.25,
    tiers: [0, 400, 1800, 5000, 11000] as readonly number[],
  },

  /** Identification (docs/05): a face on file is a "known face" for 2 in-game days (minutes). */
  identification: { knownFaceMinutes: 2 * 24 * 60 },

  /** Store robbery (docs/04 "Store robbery layout"). */
  robbery: {
    /** The register holds $250–600; the back-room safe holds the day's takings, $600–1,500. */
    registerCash: [250, 600] as readonly [number, number],
    safeCash: [600, 1500] as readonly [number, number],
    /** Base stars when the robbery is reported (docs/04: 2★). */
    stars: 2,
    /** The clerk's silent alarm reaches the police this long after it's pressed and adds +1★ (docs/04). */
    silentAlarmSeconds: 20,
    silentAlarmStars: 1,
    /** Chance the clerk presses the silent alarm the moment they're intimidated, by intimidate grade. */
    alarmOnIntimidate: { excellent: 0, good: 0.05, ok: 0.15, poor: 0.35, fail: 1 } as Record<Grade, number>,
    /** ...and per second afterwards while the robbery runs, by the same grade: a longer job is a riskier job. */
    alarmPerSecond: { excellent: 0.004, good: 0.008, ok: 0.015, poor: 0.03, fail: 0 } as Record<
      Grade,
      number
    >,
    /** The register grab is a search grid: the share of the register taken by grade. */
    grabShare: GRAB_SHARE,
    /** Share of the safe taken by safe-crack grade (a fail leaves it shut). */
    safeShare: { excellent: 1, good: 1, ok: 1, poor: 0.8, fail: 0 } as Record<Grade, number>,
    /** Night job (docs/04): the alarm panel by the back door must be cut within 10 s or the alarm goes off. */
    nightPanelSeconds: 10,
    /** A burglar alarm reports the break-in at this many stars. */
    nightAlarmStars: 2,
    /** A robbed store's register and safe stay empty this many in-game minutes (assumed: until the next day). */
    restockMinutes: 24 * 60,
  },

  /** House burglary (docs/04: tier 1, $200–900 in goods, 1★, 2★ if the owner is home; decisions 2026-10-11). */
  burglary: {
    goods: [200, 900] as readonly [number, number],
    stars: 1,
    ownerHomeStars: 2,
    /** About 1 in 3 houses has an alarm panel; it must be cut this fast after the door opens. */
    alarmChance: 1 / 3,
    alarmPanelSeconds: 10,
    /** Occupancy (decided 2026-10-11): by day, no cars outside means empty; cars outside means someone may be in.
     *  At night the owners are usually home, asleep. Chances assumed. */
    homeChanceDayWithCars: 0.6,
    homeChanceNight: 0.85,
    /** Night is from this minute of the day to `nightEnd` (matches dusk's end and dawn's start in balance.ts). */
    nightStart: 21 * 60 + 30,
    nightEnd: 5 * 60,
    /** Noise wakes a sleeping owner when it reaches 1. Each action adds noise; a failed minigame adds more. */
    noise: {
      lockpick: 0.1,
      lockpickFail: 0.35,
      search: 0.12,
      searchFail: 0.3,
      panelFail: 1,
    } as Record<'lockpick' | 'lockpickFail' | 'search' | 'searchFail' | 'panelFail', number>,
    /** Noise fades this much per second while the player keeps still. */
    noiseFade: 0.01,
    /** An awake owner's call reaches the police after 6–10 s (docs/05 witness call) unless they're scared off. */
    ownerCallSeconds: [6, 10] as readonly [number, number],
    /** The search grid's take by grade. */
    grabShare: GRAB_SHARE,
    /** A burgled house has nothing worth taking for this many in-game minutes (assumed: a week). */
    restockMinutes: 7 * 24 * 60,
    /** Chance a house has cars in the driveway on a given day (assumed; by day no cars means nobody home). */
    carsOutsideChance: 0.5,
    /** Junk items mixed into a room's search grid. */
    junkPerRoom: 4,
    /** Walk this far from a door you failed to pick and the job is dropped. */
    giveUpTiles: 6,
  },

  /** ATM robbery (docs/04: tier 2, hack or drill, $800–1,500, 2★ or 3★ downtown; docs/10: the drill at Known). */
  atm: {
    cash: [800, 1500] as readonly [number, number],
    stars: 2,
    downtownStars: 3,
    /** The cassette share taken by hack or drill grade. */
    grabShare: { excellent: 1, good: 0.9, ok: 0.75, poor: 0.5, fail: 0 } as Record<Grade, number>,
    /** A failed hack trips the ATM's alarm, which reaches the police after this long (docs/05 alarms). */
    alarmSeconds: 3,
    /** The drill is loud: witnesses hear it this many tiles away (sight is 10). The hack is silent. */
    drillNoiseTiles: 14,
    /** The ATM drill: $900 dirty from the fence at Known (docs/04, docs/10), uses before it wears out (assumed). */
    drillPrice: 900,
    drillTier: 2,
    drillUses: 5,
    /** A robbed ATM is empty until it's refilled (assumed: 2 in-game days). */
    refillMinutes: 2 * 24 * 60,
  },

  /** The fence (docs/04 decisions: the pawn shop buys stolen goods). Dirty dollars per item; assumed. */
  fence: {
    phone: 40,
    watch: 120,
    /** Burglary goods sell for their rolled value (docs/04 gives the payout in goods). */
    goodsShare: 1,
    /** Masks, in dirty or clean carried cash (dirty first; assumed). */
    masks: { bandana: 40, balaclava: 80, hockey: 120 } as Record<string, number>,
    /** The pawn shop's hours (assumed). */
    hours: { from: 10 * 60, to: 22 * 60 },
  },

  /** The crime minigames (docs/06). Seconds are real seconds; all assumed and tuned by play. */
  minigames: {
    /** Intimidate: hold to press the clerk. Keep the nerve meter inside the band for `need` seconds before
     *  `seconds` run out; past `alarmAt` the clerk hits the alarm (a fail). */
    intimidate: {
      seconds: 10,
      need: 3.5,
      start: 0.25,
      band: [0.45, 0.8] as readonly [number, number],
      alarmAt: 0.97,
      rise: 0.42,
      fall: 0.3,
      /** The clerk's mood wanders: a drift that changes direction every `wobble` seconds. */
      drift: 0.16,
      wobble: 0.9,
    },
    /** Safe crack: turn the dial (0–99) and set each number when the click pulses. `window` is ± numbers;
     *  the stethoscope widens it. Numbers = base + tier. */
    safeCrack: {
      seconds: 40,
      numbers: 3,
      turnSpeed: 32,
      window: 2.2,
      stethoscope: 1.6,
      maxMisses: 3,
    },
    /** ATM hack (Simon): rounds of a growing arrow sequence; `show` seconds per arrow while it plays. */
    atmHack: {
      rounds: [3, 4, 5] as readonly number[],
      show: 0.55,
      /** Input seconds per arrow before the grade starts to fall. */
      perArrow: 0.9,
    },
    /** ATM drill: hold to drill; heat builds while drilling and cools when released. Over 1 the bit jams. */
    drill: {
      seconds: 30,
      rate: 0.11,
      heatUp: 0.42,
      cool: 0.55,
      red: 0.8,
      jamSetback: 0.15,
      jamHeat: 0.55,
      maxJams: 3,
    },
    /** Wipe footage: hold to erase while the scrub marker stays inside the moving window (docs/06: 10 s). */
    wipe: {
      need: 10,
      seconds: 25,
      window: 0.16,
      markerSpeed: 0.7,
      smear: 0.25,
    },
    /** Alarm bypass (store panel at night): cut the panel's wires in the order shown. */
    bypass: { wires: 4 },
  },
} as const;
