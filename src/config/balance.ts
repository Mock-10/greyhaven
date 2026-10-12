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
    /** The view may show this many art pixels of background past the map edge, no more. */
    boundsMarginPx: 48,
    /** Integer zoom levels the player can step through with Ctrl + wheel (docs/11). 1x since the 2026-10-11 camera
     *  rework, for large windows and driving. ?zoom=1 also works for debugging. */
    zoomLevels: [1, 2, 3, 4] as readonly number[],
    /** Default zoom is the largest whole number that fits this many art pixels on screen. 960 x 540 since 2026-10-11
     *  (about 2x more world than the first 640 x 360): 1080p runs at 2x. */
    fitWidth: 960,
    fitHeight: 540,
    /** Context zoom (decided 2026-10-11): driving steps the zoom out by this many levels (never below 1x). */
    drivingZoomStep: -1,
    /** Driving look-ahead: the car sits toward the trailing edge, led by this share of the half view at top speed. */
    driveLeadShare: 0.55,
    /** On foot the view leans toward the mouse by up to this many art pixels. */
    mouseLeadPx: 40,
    /** How fast the look-ahead offsets settle (per second). */
    leadRate: 2.2,
    /** Follow stiffness of the critically damped camera spring (per second). */
    followOmega: 9,
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
  },

  clock: {
    /** Real minutes per in-game day (docs/01: setting 15, 20 or 30; default 20). */
    dayLengthMinutes: 20,
    dayLengthOptions: [15, 20, 30] as readonly number[],
    /** A new game starts on day 1 (Monday) at this in-game minute (07:00). */
    startMinute: 7 * 60,
    /** Darkness curve (in-game minutes): dawn brightens from 05:00 to 07:00, dusk darkens 18:00 to 21:30. */
    dawnStart: 5 * 60,
    dawnEnd: 7 * 60,
    duskStart: 18 * 60,
    duskEnd: 21 * 60 + 30,
    /** Street lamps and lit windows switch on above this darkness. */
    lightsOnDarkness: 0.35,
    /** ...and reach full strength this much darkness later (they were faint for most of dusk before). */
    lightsRampDarkness: 0.2,
    /** Lamp and window glow strength the moment they switch on. */
    lightsStartAlpha: 0.35,
  },

  economy: {
    /** Cash at the start of a new game (docs/02 is silent; assumption logged in CHANGELOG). */
    startClean: 250,
    startDirty: 0,
    startBank: 0,
    /** Bank statement lines kept for the phone (newest first). */
    ledgerSize: 24,
    /** ATM buttons (clean cash only; docs/02 decision 2026-10-11). */
    atmSteps: [20, 50, 100, 500] as readonly number[],
  },

  /** Rent on the starter apartment (docs/02 living costs; decided 2026-10-11: taken from the bank). */
  rent: {
    weekly: 350,
    /** Due on this weekday (0 = Monday) at this minute. Late fees and eviction checks also run daily then. */
    dueWeekday: 0,
    dueMinute: 6 * 60,
    lateFeePerDay: 50,
    /** Two missed weekly payments: evicted once rent has been unpaid this many days. */
    evictDays: 14,
    /** Belongings go to city storage on eviction; getting them back costs this (paid when moving back in). */
    storageFee: 200,
  },

  careers: {
    /** docs/03: clock in between 08:00 and 10:00; after 09:00 the shift pays 80%. Shifts run Monday–Friday. */
    clockInFrom: 8 * 60,
    lateAfter: 9 * 60,
    clockInUntil: 10 * 60,
    lateMultiplier: 0.8,
    workdays: [0, 1, 2, 3, 4] as readonly number[],
    /** Pay per shift (clean) by rank 1–5. */
    payByRank: [180, 260, 370, 510, 700] as readonly number[],
    /** XP needed to reach the next rank, from rank 1–4. */
    xpToNext: [40, 70, 110, 160] as readonly number[],
    /** One-time bonus on reaching rank 2–5. */
    promotionBonus: [250, 500, 900, 1500] as readonly number[],
    /** Shift XP by its typical grade: mostly poor / OK / good / excellent. */
    shiftXp: [6, 9, 11, 14] as readonly number[],
    /** Office rank that gets the building key card (docs/03 perk). */
    keyCardRank: 2,
    /** docs/03: a missed workday costs this much promotion XP (never below 0) and pays nothing. Day 1 (the guided
     *  first day) never counts as missed. */
    missedXp: 5,
    missedFromDay: 2,
    /** Arrest effects (docs/03): a promotion freeze, then extra work after release. */
    freezeDays: 3,
    extraDays: 2,
    extraTasks: 1,
    extraXpFactor: 1.1,
    /** Weekly clean-record bonus: this share of the week's pay, paid Monday 06:00 if the week had no arrest. */
    cleanRecordShare: 0.15,
    /** HR bribes (docs/02), clean money from the bank: cover a missed shift (within this many days), lift a freeze. */
    hrCoverShift: 150,
    hrLiftFreeze: 600,
    hrCoverWindowDays: 7,
  },

  minigames: {
    filing: { papers: 8, startFall: 18, fallAccel: 2.2, misfilePenalty: 1 },
    dataEntry: { rounds: 3, length: 5, seconds: 14 },
    /** docs/06 core skill check by tier: needle speed (rev/s), good and great zone widths (degrees), checks. */
    skillTiers: [
      { speed: 0.8, good: 60, great: 14, checks: 2 },
      { speed: 1.0, good: 48, great: 11, checks: 3 },
      { speed: 1.2, good: 38, great: 9, checks: 4 },
      { speed: 1.45, good: 30, great: 7, checks: 5 },
      { speed: 1.7, good: 24, great: 6, checks: 6 },
    ],
    /** Lockpick: misses allowed before the pick slips (fail), and progress lost per miss. */
    lockpick: { maxMisses: 3 },
    /** docs/06: tools widen the zones (basic +15%, pro +30% and one check fewer) and wear out: a set lasts 10 uses,
     *  a failed attempt costs 2. */
    tools: { basicWiden: 0.15, proWiden: 0.3, proFewerChecks: 1, uses: 10, failUses: 2 },
    /** Hotwire (docs/06): 3–5 wire pairs before the timer runs out; a wrong pair sparks (noise). */
    hotwire: { pairs: 4, seconds: 12, maxSparks: 3 },
    /** Money count (docs/06): count bills into bundles of 10; miscounts cost a share of the wash. */
    moneyCount: { bills: 30, seconds: 16 },
    /** Duffel (Dez's laundering since 2026-10-11): stacks on the table, how many are dye-stained, the timer, and the
     *  share of time that must be left for an excellent grade. */
    duffel: { stacks: 8, dyed: 2, seconds: 14, excellentTimeShare: 0.3 },
    /** Search (docs/06 register grab / search): click glinting items in a grid before the timer runs out. */
    search: { cols: 4, rows: 3, seconds: 6, excellentTimeShare: 0.35 },
  },

  player: {
    maxHealth: 100,
  },

  /** Driving (docs/08), in world units and seconds. The sedan's docs/08 stats (top speed 85, tank 40) are scaled
   *  to the map: top speed 85 → 240 units/s (7.5 tiles/s). */
  vehicles: {
    /** Stats per car type (docs/08), scaled to the map: the sedan's top speed 85 → 240 units/s, so 1 docs unit of
     *  speed ≈ 2.82 units/s. `value` is the docs/02 price, used for chop-shop pay (the taxi has no docs price:
     *  assumed a little under a sedan). */
    types: {
      sedan: {
        topSpeed: 240,
        reverseSpeed: 70,
        accel: 140,
        brake: 320,
        /** Rolling slowdown with no throttle. */
        drag: 70,
        /** Steering rate at speed (radians per second); tighter at low speed. */
        turnRate: 2.4,
        /** Half length and half width of the body for collision. */
        halfLength: 38,
        halfWidth: 15,
        /** Height of the body for its moving ground shadow. */
        shadowHeight: 22,
        health: 100,
        /** docs/08: a sedan tank holds 40 units, about 15 real minutes of full throttle. */
        tank: 40,
        fuelPerSecond: 40 / (15 * 60),
        value: 5000,
      },
      taxi: {
        topSpeed: 240,
        reverseSpeed: 70,
        accel: 140,
        brake: 320,
        drag: 70,
        turnRate: 2.4,
        halfLength: 38,
        halfWidth: 15,
        shadowHeight: 22,
        health: 100,
        tank: 40,
        fuelPerSecond: 40 / (15 * 60),
        value: 4500,
      },
      /** docs/08 police cruiser: top speed 100, high acceleration, health 130. Not for sale. */
      police: {
        topSpeed: 282,
        reverseSpeed: 80,
        accel: 175,
        brake: 360,
        drag: 70,
        turnRate: 2.5,
        halfLength: 38,
        halfWidth: 15,
        shadowHeight: 22,
        health: 130,
        tank: 50,
        fuelPerSecond: 0,
        value: 0,
      },
      /** docs/08 van: top speed 70, low acceleration and grip, health 140, tank 60. */
      van: {
        topSpeed: 198,
        reverseSpeed: 60,
        accel: 105,
        brake: 260,
        drag: 70,
        turnRate: 2.0,
        halfLength: 42,
        halfWidth: 16,
        shadowHeight: 30,
        health: 140,
        tank: 60,
        fuelPerSecond: 60 / (15 * 60),
        value: 9000,
      },
    },
    /** Damage per unit of impact speed; below these healths the car smokes / loses 30% top speed (docs/08). */
    damagePerSpeed: 0.12,
    /** Bumps slower than this do no damage (parking, scraping a wall). */
    minImpactSpeed: 40,
    /** A blocked car slides along a wall when at least this share of its heading runs along it. */
    slideMinShare: 0.5,
    smokeBelow: 50,
    limpBelow: 25,
    limpFactor: 0.7,
    /** Bounce on impact: share of speed kept, reversed. */
    bounce: 0.25,
    /** How close (world units) you must stand to a car to use or enter it, or drive to a pump or Marlo. */
    reach: 40,
    pumpReach: 64,
    /** Marlo's dotted sale spot (decided 2026-10-11): the car's centre must be inside it, give or take this many
     *  units, and the car stopped (slower than saleMaxSpeed). Marlo walks out at walking pace. */
    spotSlack: 12,
    saleMaxSpeed: 6,
    marloWalkSpeed: 48,
    /** Fuel price (docs/02: $3 per unit) and a jerry can's contents (docs/08: 10 units). */
    fuelPrice: 3,
    canUnits: 10,
    /** Getting out only below this speed (units per second). */
    exitMaxSpeed: 40,
    /** A crash this fast or harder gets a phone message when it wrecks the car. */
    crashToastSpeed: 30,
    /** Starting fuel of a parked car, as a share of the tank. */
    parkedFuel: 0.35,
  },

  /** Crime (docs/04): carjacking a parked car and the chop shop. */
  crime: {
    /** Trunk looting (docs/04): valuables per trunk, the cash total spread over bills and wallets, junk filler,
     *  what each valuable is (weights), and the uses on a found lockpick set. */
    trunk: {
      valuables: [2, 4] as readonly [number, number],
      cash: [20, 120] as readonly [number, number],
      junk: [2, 4] as readonly [number, number],
      weights: { cash: 34, wallet: 26, phone: 18, lockpicks: 12, watch: 10 },
      lockpickUses: 5,
      /** The trunk prompt sits this share of the car's length behind its centre (at the rear bumper). */
      reach: 0.45,
    },
    /** Chop shop pay (decided 2026-10-11): 15–30% of the car type's value (docs/08), scaled by condition. Below
     *  reputation tier `fullRateTier` Marlo pays only `earlyFactor` of that, capped at `earlyCap`, so an early car
     *  fetches about $250–600 (docs/04's $150–400 range, nudged up). */
    chop: { share: [0.15, 0.3] as readonly number[], earlyFactor: 0.35, earlyCap: 600, fullRateTier: 2 },
    /** Chance a failed lockpick sets off the car alarm (docs/05: 30%). */
    alarmChance: 0.3,
    /** A stolen car stays hot this many in-game minutes (docs/08: 2 days). */
    hotMinutes: 2 * 24 * 60,
  },

  /** Laundering with Dez (docs/02): cut, daily cap; a sloppy bagging (the duffel minigame) adds to the cut. */
  laundering: {
    cut: 0.35,
    dailyCap: 1500,
    /** Extra cut by duffel grade (dropped and dye-stained cash). */
    miscountCut: { excellent: 0, good: 0.02, ok: 0.05, poor: 0.1, fail: 0.15 },
  },

  /** Corner-store basics (docs/02 "Phase 1 shop"): price in clean dollars, health restored when eaten. */
  shop: {
    soda: { price: 3, heal: 5, adds: 0 },
    chips: { price: 6, heal: 10, adds: 0 },
    sandwich: { price: 12, heal: 25, adds: 0 },
    /** docs/08: a jerry can costs $40 and holds 10 fuel units. */
    fuel_can: { price: 40, heal: 0, adds: 1 },
    /** docs/07: a first-aid kit costs $60; used from the bag it restores full health. */
    first_aid: { price: 60, heal: 0, adds: 1 },
    /** docs/06: basic lockpicks $40, a set of 10 uses. */
    lockpicks: { price: 40, heal: 0, adds: 10 },
    /** A toolbox: the basic tool for hotwiring (+3 s on the timer). Price assumed (docs are silent). */
    toolbox: { price: 120, heal: 0, adds: 1 },
    /** docs/08: a repair kit costs $150 and repairs a car to 50%. */
    repair_kit: { price: 150, heal: 0, adds: 1 },
  },
  /** Toolbox bonus on the hotwire timer, in seconds; a repair kit restores a car to this share of its health. */
  tools: { toolboxHotwireSeconds: 3, repairKitTo: 0.5 },

  /** Police and the wanted level (docs/05, docs/02 fines). Real seconds unless noted; distances in tiles. */
  wanted: {
    maxStars: 5,
    /** Escape timer per star level: seconds out of sight and outside the search circle (docs/05). */
    escapeSeconds: [30, 50, 80, 120, 160] as readonly number[],
    /** Search circle radius per star level (docs/05: 12 tiles at 1★ up to 30 at 5★). */
    searchTiles: [12, 16, 20, 25, 30] as readonly number[],
    /** A witness's phone call takes 6–10 s (docs/05); an alarm reaches the police faster. */
    callSeconds: [6, 10] as readonly number[],
    alarmSeconds: 3,
    /** Witness sight (docs/05): 10 tiles, 7.5 at night or in rain. Police see 12 tiles. */
    witnessTiles: 10,
    witnessNightTiles: 7.5,
    policeSightTiles: 12,
    /** Scaring a witness off the phone: within 2 tiles, press E (docs/05). */
    scareTiles: 2,
    /** Busting (docs/05): an officer within 1.5 tiles while you're on foot or in a stopped car, for this long. */
    bustTiles: 1.5,
    bustSeconds: 2.2,
    stoppedCarSpeed: 12,
    /** Stars by crime when detected (docs/04). */
    crimeStars: { carjack: 1, alarm: 1, hotCar: 1, trunk: 1 },
    /** A hot stolen car seen by police is recognised with this chance per real minute (docs/08: 20%). */
    hotCarChancePerMinute: 0.2,
    /** Fines in clean dollars and jail days by stars at arrest (docs/02), the surrender discount (docs/05: −30%
     *  fine, −1 jail day) and the window that makes an arrest a repeat offense (docs/05: 14 in-game days). */
    fines: [200, 500, 1200, 3000, 6000] as readonly number[],
    jailDays: [1, 1, 2, 3, 4] as readonly number[],
    surrenderFineCut: 0.3,
    recordDays: 14,
  },

  /** Police officers and their cruiser (milestone 4: one car and two officers at 1–2★, docs/15). */
  police: {
    officers: 2,
    runSpeed: 92,
    walkSpeed: 40,
    /** The cruiser stops this close to where it's going and the officers get out (world units). */
    arriveDistance: 90,
    /** Officers search random points inside the circle; they give up a point after this long. */
    searchPointSeconds: 6,
    /** Steering look-ahead along the route, world units. */
    lookAhead: 70,
    /** Despawn when the stars are gone and they are this far off screen (art px). */
    despawnMarginPx: 120,
  },

  /** The pedestrian crowd (docs/01, milestone 4), in world units and real seconds. */
  crowd: {
    walkSpeed: 34,
    /** Each person walks this much faster or slower, at random. */
    walkVariance: 0.25,
    /** Fleeing from a crime or a speeding car. */
    fleeSpeed: 95,
    fleeSeconds: 4,
    /** At the end of a sidewalk people cross to another sidewalk end within this reach, or turn back. */
    linkReach: 170,
    turnBackChance: 0.2,
    /** How many people are about, by hour of day (docs/01: busy at commute times, sparse at night). The docs aim
     *  at 20–35 on screen downtown; the test map is small, so these are for the whole area around the camera. */
    byHour: [
      6, 4, 3, 3, 4, 8, 14, 24, 30, 22, 18, 20, 24, 22, 20, 20, 22, 28, 30, 24, 18, 14, 10, 8,
    ] as readonly number[],
    /** People appear this far outside the view (art px) and go away this far outside it. */
    spawnMarginPx: 80,
    despawnMarginPx: 260,
  },

  /** Ambient traffic (docs/01, milestone 4): cars follow lanes, keep their distance and stop at red lights. */
  traffic: {
    cruise: 150,
    accel: 90,
    brake: 260,
    /** Gap kept to the car (or anything) ahead, bumper to bumper. */
    gap: 26,
    /** Look this far ahead for obstacles across the lane's width. */
    lookAhead: 150,
    laneHalfWidth: 20,
    byHour: [
      4, 3, 2, 2, 4, 8, 12, 18, 20, 16, 14, 14, 16, 16, 14, 14, 16, 20, 20, 16, 12, 10, 8, 6,
    ] as readonly number[],
    /** Traffic lights: a green and a yellow per direction, in seconds; crossings are out of step by `offset`. */
    green: 11,
    yellow: 2,
    offset: 7,
    /** Cars stop this far before a crossing's centre (the stop line, downtown_map.py: road half width + 44). */
    stopBack: 112,
    /** The car body length used for gaps. */
    length: 80,
  },

  /** Sleeping at home skips to this minute of the next day (docs/01: 06:00). */
  sleep: { wakeMinute: 6 * 60 },

  interiors: {
    /** Fade between the street and an interior (docs/18: about 0.3 s), in milliseconds. */
    fadeMs: 300,
    /** Sight is recomputed when the player has moved this far (docs/19: about 4 units). */
    sightMoveUnits: 4,
    /** Sight state changes fade over this long (docs/19: about 150 ms), in seconds. */
    sightFadeSeconds: 0.15,
    /** Remembered rooms dimmed with last-seen ghosts (docs/19). ON HOLD until Phase 8 (user, 2026-10-11):
     *  while false, rooms seen before are drawn like visible ones; only never-seen rooms get the lid. */
    rememberedDimming: false,
    /** Remembered rooms: floor dim overlay strength and the tint on static furniture (docs/19: about 50%, cooler). */
    rememberedDim: 0.5,
    rememberedTint: 0x8a82a8,
    /** Last-seen NPC ghosts: opacity (docs/19: about 40%). */
    ghostAlpha: 0.4,
    /** Indoor sight range in world units (docs/19: about 13 tiles). */
    sightRange: 420,
  },

  interact: {
    /** Objects within this range show the idle rim (docs/11: 1.5 tiles). */
    rangeTiles: 1.5,
    /** Among objects in range, prefer the one most in front of the player: weight of facing vs distance. */
    facingWeight: 0.6,
  },

  /** The phone (docs/11): messages kept in its MESSAGES app. */
  phone: { messagesKept: 30 },

  /** Input: keys pressed inside a minigame panel are ignored by the world this long after it closes. */
  ui: { keyGuardMs: 300 },

  hud: {
    /** Phone messages stay this long, then slide out (docs/11). */
    toastSeconds: 5,
    /** A message that arrives while another shows waits until that one has been up this long (at most `toastQueue`
     *  wait). */
    toastMinSeconds: 2.2,
    toastQueue: 4,
    /** The street name shows for this long after entering a new street. */
    streetSeconds: 4,
    /** Radar radius in UI pixels and its world scale (docs/11: radius 38, about 0.13). */
    radarRadius: 44,
    radarScale: 0.13,
    radarHz: 15,
    /** World prompts stay inside these UI-pixel margins, clear of the top panels, the objective and hint strip at
     *  the bottom and the radar (which takes this square in the bottom-left corner). */
    /** Room kept clear of the HUD panels for world prompts, in UI pixels (sized for the UI redesign of 2026-10-12). */
    promptSafe: { top: 66, bottom: 30, side: 4, radar: 104 },
  },

  walker: {
    /** Walking speed in world units per second along a tile edge (1.5 tiles per second; raised from 32 after the
     *  milestone 1 playtest). Every key direction covers the same screen distance per second (systems/movement.ts). */
    walkSpeed: 48,
    /** Sprint multiplier (Shift): about 110 units/s, 3.4 tiles per second. */
    sprintMultiplier: 2.3,
    /** Walk-cycle frames per second for the 8-frame cycle (idle, step1, walk1, step1, idle, step2, walk2, step2).
     *  Kept in step with walkSpeed (12 fps at 32 units/s) so the feet don't slide. */
    walkFps: 18,
    /** The cycle runs faster while sprinting (longer strides, so less than the speed multiplier). */
    sprintFpsMultiplier: 1.8,
    /** Collision radius of a person, in world units. */
    radius: 6,
    /** Small decoration (bollards, hydrants, lamp posts, meters, bins): hit circle scale, and how much the
     *  walker's own radius shrinks against it, so brushing past one at a run doesn't stop you (2026-10-11). */
    smallPropScale: 0.6,
    smallPropSlack: 2,
    /** A prop counts as small when its footprint radius (or half width) is at most this, in world units. */
    smallPropMaxRadius: 9,
  },

  dayNight: {
    /** Full-night multiply tints (STYLE_GUIDE rainy dusk): objects, ground tiles, and usable objects (kept lighter). */
    objectTint: [0.66, 0.66, 0.8] as readonly number[],
    tileTint: [0.6, 0.62, 0.78] as readonly number[],
    cueTint: [0.86, 0.86, 0.94] as readonly number[],
    /** Street-lamp light pool strength at full night (0–1). */
    lampGlow: 0.65,
  },

  render: {
    /** Ground shadow strength (art/source/scene.py: shadow mask × 0.42). */
    shadowStrength: 0.42,
    /** Shadow mask values for box and blob shadows (scene.py polygon 150, ellipse 170). */
    shadowBoxValue: 150,
    shadowBlobValue: 170,
    /** A sprite in front of the player or the car fades to this opacity (docs/11, docs/14). */
    occludedAlpha: 0.35,
    /** Sprites shorter than this (art px above their anchor) never fade: kerb-high things don't hide anyone.
     *  Lowered from 56 in the 2026-10-11 camera rework, which fades any building that covers the car. */
    occluderMinHeight: 18,
    /** ...and a sprite fades only when its pixels hide at least this share of the player's or car's pixels (thin
     *  lamp posts and the empty corners of a tree's cell don't count). */
    occludeShare: 0.12,
    /** The silhouette drawn where the player or car is hidden (2026-10-11): muted lavender (docs/19's ghost colour),
     *  and the size of its mask texture in art px (bigger than any car or person sprite cell). */
    silhouette: { colour: 0x8a82a8, alpha: 0.6, maskSize: 192 },
    /** Enterable buildings (2026-10-11): a gold 1 px outline, shown faintly within `nearTiles` of the door and
     *  brightly when the door is targeted. A door belongs to the building whose footprint is within `doorReach`. */
    entrance: { nearTiles: 7, idleAlpha: 0.45, hoverAlpha: 0.95, fadeRate: 6, doorReach: 24 },
    /** Interactable idle shimmer frame rate (STYLE_GUIDE: about 6 fps). */
    shimmerFps: 6,
    /** Ground chunks are baked in blocks of this many tiles per side. */
    chunkTiles: 16,
    /** Most baked ground chunks kept in video memory at once. */
    maxChunks: 24,
    /** Vector-ground chunks are screen-aligned blocks of this many art pixels (a multiple of the swatch size). */
    vectorChunkW: 512,
    vectorChunkH: 256,
  },
} as const;
