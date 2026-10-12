// Phase 3 police numbers (docs/05, docs/02, docs/04, docs/03, docs/07): the 1–5★ response, cameras and
// identification, the chase speed-ups, bribes and jail. Kept apart from balance.ts so the police work can land
// without touching the shared file; the star fines, jail days and escape timers stay in BALANCE.wanted.
// Real seconds unless noted; in-game time in minutes; distances in tiles.

export type PoliceWeapon = 'pistol' | 'shotgun' | 'rifle';

/** One row of the docs/05 response table. Counts are [min, max]; rolled once when the level is reached. */
export interface ResponseTier {
  cruisers: readonly [number, number];
  /** 1★ investigates the reported spot; 2★ and up chase actively. */
  chase: boolean;
  weapon: PoliceWeapon;
  /** Roadblocks the dispatcher keeps standing at once, and whether they come with spike strips. */
  roadblocks: number;
  spikeStrips: boolean;
  swatVans: number;
  helicopters: number;
  /** Military-style units in armored vehicles (5★). */
  armored: number;
}

export const BALANCE_POLICE = {
  /** docs/05 star levels and police response, index 0 = 1★. 4★ and 5★ keep the cruisers and roadblocks of 3★
   *  (the response stacks); the SWAT van and armored counts are assumptions, the docs name the unit types only. */
  response: [
    {
      cruisers: [1, 1],
      chase: false,
      weapon: 'pistol',
      roadblocks: 0,
      spikeStrips: false,
      swatVans: 0,
      helicopters: 0,
      armored: 0,
    },
    {
      cruisers: [2, 3],
      chase: true,
      weapon: 'pistol',
      roadblocks: 0,
      spikeStrips: false,
      swatVans: 0,
      helicopters: 0,
      armored: 0,
    },
    {
      cruisers: [4, 5],
      chase: true,
      weapon: 'shotgun',
      roadblocks: 1,
      spikeStrips: true,
      swatVans: 0,
      helicopters: 0,
      armored: 0,
    },
    {
      cruisers: [4, 5],
      chase: true,
      weapon: 'rifle',
      roadblocks: 2,
      spikeStrips: true,
      swatVans: 2,
      helicopters: 1,
      armored: 0,
    },
    {
      cruisers: [4, 5],
      chase: true,
      weapon: 'rifle',
      roadblocks: 3,
      spikeStrips: true,
      swatVans: 2,
      helicopters: 2,
      armored: 2,
    },
  ] as readonly ResponseTier[],
  /** Officers per cruiser (milestone 4 runs two) and per SWAT van / armored vehicle (assumed). */
  officersPerCruiser: 2,
  officersPerVan: 4,
  /** docs/07: police warn at 1★ and only shoot at 2★ and above, or once the player has shot first. */
  shootFromStars: 2,
  /** docs/01: "police are fewer and slower" in the hood. Assumed: one cruiser fewer (never below 1) and
   *  dispatch takes this much longer. */
  hood: { cruiserCut: 1, dispatchFactor: 1.5 },
  /** Seconds from a report to the first unit leaving (assumed; 0 keeps milestone 4's instant dispatch). */
  dispatchSeconds: 0,
  /** Roadblocks: a chance per real minute of a new one on the player's route while the level allows one. docs/04
   *  gives 20% a minute for smuggling at 2★+; the same rate is assumed for the 3★+ response. */
  roadblockChancePerMinute: 0.2,
  smugglingRoadblockFromStars: 2,
  /** docs/07: shooting at police raises the level to at least 3★, killing an officer to at least 4★; docs/08:
   *  stealing a cruiser adds 1★. */
  shotPoliceMinStars: 3,
  killedPoliceMinStars: 4,
  stoleCruiserStars: 1,
  /** docs/05: "sustained 4★ chaos" reaches 5★. Assumed: this many seconds at 4★ in police sight in one chase. */
  chaosSecondsTo5: 120,

  /** Escape speed-ups (docs/05, docs/03), each once per chase. */
  speedUps: {
    /** Changing vehicle, or mask or clothes, while unseen: the remaining escape timer drops by this share. */
    timerCut: 0.25,
    /** Entering an owned property unseen clears a wanted level of this many stars or fewer (docs/05 "1–2★"). */
    propertyClearsUpTo: 2,
    /** Road worker rank 4 high-vis disguise and scrap yard rank 2 crush (docs/03): −1★ each. */
    highVisStars: 1,
    crushStars: 1,
  },

  /** Identification and heat (docs/05 "Identification and heat"). */
  heat: {
    /** A known face lasts this many in-game minutes after the last identification (2 in-game days). */
    knownFaceMinutes: 2 * 24 * 60,
    /** Police who see a known face carrying a visible weapon add this many stars (once per chase, assumed). */
    knownFaceSightingStars: 1,
    /** Witnesses call a known face in 30% faster. */
    knownFaceCallCut: 0.3,
    /** Mask in daylight: witnesses within 5 tiles watch you, +25% call chance for any crime. */
    maskWatchTiles: 5,
    maskCallBonus: 0.25,
    /** Postal rank 1 uniform: witnesses 30% slower to call daytime crimes in the Suburbs (docs/03). */
    postalUniformCallSlow: 0.3,
    /** Daylight for the mask and postal rules: the clock's darkness at or below this (the witness night-sight
     *  rule in the world uses the same 0.5 line). */
    daylightDarkness: 0.5,
  },

  /** Cameras (docs/04, docs/05): store wall cameras, ATMs and banks. Field of view and range are assumed. */
  camera: {
    fovDegrees: 90,
    rangeTiles: 8,
    /** Security guard rank 3 disables a store's cameras for this long (docs/03). */
    guardDisableSeconds: 60,
  },

  /** Bribes (docs/02 "Fines and bribes", docs/05). */
  bribes: {
    /** On-scene police bribe by phone, in dirty cash, by stars (1–3★ only; null = not offered). */
    onScene: [300, 800, 2000, null, null] as readonly (number | null)[],
    /** Lawyer: clean cash (carried first, then the bank, assumed), −1 jail day. */
    lawyer: 1500,
    lawyerDays: 1,
    /** Judge: dirty cash, converts jail into a fine; rep tier 3 (Connected) only. */
    judge: 5000,
    judgeTier: 3,
  },

  /** Jail (docs/05). */
  jail: {
    /** A first offense is booked and released this many in-game minutes later (milestone 4: an hour). */
    firstOffenseMinutes: 60,
    /** Jail time ends at this minute of the day (06:00) after the jail days. */
    releaseMinute: 6 * 60,
    /** The surrender prompt appears at this many stars and below, or whenever cornered. */
    surrenderUpTo: 2,
  },
} as const;
