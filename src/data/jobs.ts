// The job catalogue (docs/03). The four starting jobs: the Office Worker since Phase 1, the garage, the lumber camp
// and the depot since Phase 2 milestone 7. The later jobs arrive in Phase 6.

export type JobId = 'office' | 'mechanic' | 'lumberjack' | 'delivery';
export type TaskId =
  | 'filing'
  | 'dataEntry'
  | 'stampSign'
  | 'meeting'
  | 'diagnose'
  | 'boltTorque'
  | 'tyreChange'
  | 'respray'
  | 'chop'
  | 'fell'
  | 'loadLogs'
  | 'loadVan'
  | 'route'
  | 'doorstep'
  | 'signature';

/** The minigame panels a task opens (MinigameScene kinds). */
export type TaskGame =
  | 'filing'
  | 'dataEntry'
  | 'stampSign'
  | 'meeting'
  | 'diagnose'
  | 'boltTorque'
  | 'tyreChange'
  | 'respray'
  | 'chop'
  | 'fell'
  | 'load'
  | 'route'
  | 'doorstep'
  | 'signature';

export interface TaskDef {
  name: string;
  game: TaskGame;
  /** What the load task stacks. */
  mode?: 'crates' | 'logs';
  /** Lowest rank that gets this task (the office meeting is rank 3+). */
  minRank?: number;
  /** Tasks that must be done earlier in the same shift (a parcel needs a loaded van). */
  after?: readonly TaskId[];
  /** Done at most once a shift (each delivery step). */
  once?: boolean;
}

export const TASKS: Record<TaskId, TaskDef> = {
  filing: { name: 'FILE PAPERWORK', game: 'filing' },
  dataEntry: { name: 'DATA ENTRY', game: 'dataEntry' },
  stampSign: { name: 'STAMP AND SIGN', game: 'stampSign' },
  meeting: { name: 'MEETING', game: 'meeting', minRank: 3 },
  diagnose: { name: 'DIAGNOSE', game: 'diagnose' },
  boltTorque: { name: 'TORQUE BOLTS', game: 'boltTorque' },
  tyreChange: { name: 'CHANGE TYRE', game: 'tyreChange' },
  respray: { name: 'RESPRAY', game: 'respray' },
  chop: { name: 'CHOP', game: 'chop' },
  fell: { name: 'FELL TREES', game: 'fell' },
  loadLogs: { name: 'LOAD LOGS', game: 'load', mode: 'logs' },
  loadVan: { name: 'LOAD VAN', game: 'load', mode: 'crates', once: true },
  route: { name: 'PLAN ROUTE', game: 'route', once: true },
  doorstep: { name: 'DELIVER PARCELS', game: 'doorstep', after: ['loadVan', 'route'], once: true },
  signature: { name: 'GET SIGNATURE', game: 'signature', after: ['loadVan', 'route'], once: true },
};

export const TASK_NAMES: Record<TaskId, string> = Object.fromEntries(
  Object.entries(TASKS).map(([k, t]) => [k, t.name]),
) as Record<TaskId, string>;

export interface Perk {
  rank: number;
  text: string;
  /** Works in the game now; the rest wait for their systems (docs/15) and only show on the job board. */
  live: boolean;
}

export interface JobDef {
  id: JobId;
  name: string;
  /** Short name for tight spots (the phone's front page). */
  short: string;
  /** Where the job is, for the job board. */
  where: string;
  /** Rank titles 1–5. */
  ranks: readonly string[];
  /** Tasks a shift draws from, and how many make a shift (3–4, docs/03). */
  tasks: readonly TaskId[];
  tasksPerShift: number;
  /** Open on the job board. */
  hiring: boolean;
  /** Who you clock in with (the toasts speak as them). Role names: new characters need the user's approval. */
  boss: string;
  /** The boss in a sentence ("CLOCK IN WITH THE FOREMAN"). */
  bossRef: string;
  /** The interior with the time clock. */
  site: string;
  /** Where to go, for the objective line. */
  goTo: string;
  /** Where the tasks are, for the objective line. */
  taskHint: string;
  /** The work uniform (an outfit in data/looks.ts) the locker hands out, or null for none. */
  uniform: string | null;
  perks: readonly Perk[];
}

export const JOBS: Record<JobId, JobDef> = {
  office: {
    id: 'office',
    name: 'OFFICE WORKER',
    short: 'OFFICE',
    where: 'PELLRIDGE TOWER',
    ranks: ['CLERK', 'ANALYST', 'SENIOR ANALYST', 'MANAGER', 'DIRECTOR'],
    tasks: ['filing', 'dataEntry', 'stampSign', 'meeting'],
    tasksPerShift: 3,
    hiring: true,
    boss: 'MS. HOLLIS',
    bossRef: 'MS. HOLLIS',
    site: 'office_floor',
    goTo: 'PELLRIDGE TOWER, FLOOR 4',
    taskHint: 'CABINETS, DESK OR COPIER',
    uniform: null,
    perks: [
      { rank: 2, text: 'KEY CARD: THE TOWER AFTER HOURS', live: true },
      { rank: 3, text: 'TIP-OFFS: ARMORED TRUCK TIMES', live: false },
      { rank: 4, text: 'EXPENSE ACCOUNT: -10% IN SHOPS', live: true },
    ],
  },
  mechanic: {
    id: 'mechanic',
    name: 'CAR MECHANIC',
    short: 'MECHANIC',
    where: 'TORQUE & SONS',
    ranks: ['APPRENTICE', 'MECHANIC', 'SENIOR', 'SHOP LEAD', "OWNER'S PARTNER"],
    tasks: ['diagnose', 'boltTorque', 'tyreChange', 'respray'],
    tasksPerShift: 3,
    hiring: true,
    boss: 'SHOP FOREMAN',
    bossRef: 'THE FOREMAN',
    site: 'garage',
    goTo: 'TORQUE & SONS, HEDGEROW WAY',
    taskHint: 'THE BAY, THE BENCH OR THE BOOTH',
    uniform: 'coveralls',
    perks: [
      { rank: 1, text: '-20% REPAIRS AND UPGRADES', live: false },
      { rank: 2, text: 'RESPRAY STOLEN CARS LEGALLY', live: false },
      { rank: 4, text: 'GARAGE ADD-ONS 30% CHEAPER', live: false },
    ],
  },
  lumberjack: {
    id: 'lumberjack',
    name: 'LUMBERJACK',
    short: 'LUMBER',
    where: 'ASHBY TIMBER',
    ranks: ['HAND', 'FELLER', 'RIGGER', 'CREW BOSS', 'CAMP BOSS'],
    tasks: ['chop', 'fell', 'loadLogs'],
    tasksPerShift: 3,
    hiring: true,
    boss: 'SITE BOSS',
    bossRef: 'THE SITE BOSS',
    site: 'site_trailer',
    goTo: 'ASHBY TIMBER, ASHBY ROAD',
    taskHint: 'THE YARD: TREES, BLOCK OR TRUCK',
    uniform: 'flannel',
    perks: [
      { rank: 2, text: 'TRUCK LICENSE: BORROW THE LOG TRUCK', live: false },
      { rank: 3, text: 'HIDDEN COMPARTMENTS IN THE TRUCK', live: false },
      { rank: 4, text: 'REMOTE DROPS MARKED IN THE WOODS', live: false },
    ],
  },
  delivery: {
    id: 'delivery',
    name: 'DELIVERY DRIVER',
    short: 'DELIVERY',
    where: 'SWIFTISH COURIERS',
    ranks: ['COURIER', 'DRIVER', 'SENIOR DRIVER', 'ROUTE PLANNER', 'DEPOT MANAGER'],
    tasks: ['loadVan', 'route', 'doorstep', 'signature'],
    tasksPerShift: 4,
    hiring: true,
    boss: 'DISPATCH',
    bossRef: 'DISPATCH',
    site: 'depot',
    goTo: 'SWIFTISH COURIERS, LINDEN AVENUE',
    taskHint: 'LOAD THE VAN, PLAN THE ROUTE, DELIVER',
    uniform: 'courier',
    perks: [
      { rank: 1, text: 'UNIFORM: WITNESSES SLOWER (SUBURBS, DAY)', live: false },
      { rank: 2, text: 'ROUTE KNOWLEDGE: +20% SMUGGLING TIME', live: false },
      { rank: 3, text: 'HOUSE OCCUPANCY VISIBLE', live: false },
    ],
  },
};

/** The job whose time clock is in an interior, if any. */
export function jobAtSite(site: string): JobId | null {
  return (Object.keys(JOBS) as JobId[]).find((j) => JOBS[j].site === site) ?? null;
}

/** The job a task belongs to. */
export function jobOfTask(task: TaskId): JobId {
  return (Object.keys(JOBS) as JobId[]).find((j) => JOBS[j].tasks.includes(task)) ?? 'office';
}
