// The job catalogue (docs/03). The four starting jobs; the Office Worker is playable since Phase 1, the garage,
// the lumber camp and the depot open later in Phase 2 (`hiring`). The later jobs arrive in Phase 6.

export type JobId = 'office' | 'mechanic' | 'lumberjack' | 'delivery';
export type TaskId = 'filing' | 'dataEntry';

export interface JobDef {
  id: JobId;
  name: string;
  /** Short name for tight spots (the phone's front page). */
  short: string;
  /** Where the job is, for the job board. */
  where: string;
  /** Rank titles 1–5. */
  ranks: readonly string[];
  /** Tasks a shift draws from, and how many make a shift (Phase 1: 3 filing / data-entry tasks). */
  tasks: readonly TaskId[];
  tasksPerShift: number;
  /** Open on the job board yet (the garage, the camp and the depot open as they are built). */
  hiring: boolean;
}

export const JOBS: Record<JobId, JobDef> = {
  office: {
    id: 'office',
    name: 'OFFICE WORKER',
    short: 'OFFICE',
    where: 'PELLRIDGE TOWER',
    ranks: ['CLERK', 'ANALYST', 'SENIOR ANALYST', 'MANAGER', 'DIRECTOR'],
    tasks: ['filing', 'dataEntry'],
    tasksPerShift: 3,
    hiring: true,
  },
  mechanic: {
    id: 'mechanic',
    name: 'CAR MECHANIC',
    short: 'MECHANIC',
    where: 'TORQUE & SONS',
    ranks: ['APPRENTICE', 'MECHANIC', 'SENIOR', 'SHOP LEAD', "OWNER'S PARTNER"],
    tasks: [],
    tasksPerShift: 3,
    hiring: false,
  },
  lumberjack: {
    id: 'lumberjack',
    name: 'LUMBERJACK',
    short: 'LUMBER',
    where: 'ASHBY TIMBER',
    ranks: ['HAND', 'FELLER', 'RIGGER', 'CREW BOSS', 'CAMP BOSS'],
    tasks: [],
    tasksPerShift: 3,
    hiring: false,
  },
  delivery: {
    id: 'delivery',
    name: 'DELIVERY DRIVER',
    short: 'DELIVERY',
    where: 'SWIFTISH COURIERS',
    ranks: ['COURIER', 'DRIVER', 'SENIOR DRIVER', 'ROUTE PLANNER', 'DEPOT MANAGER'],
    tasks: [],
    tasksPerShift: 3,
    hiring: false,
  },
};

export const TASK_NAMES: Record<TaskId, string> = { filing: 'FILE PAPERWORK', dataEntry: 'DATA ENTRY' };
