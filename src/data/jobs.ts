// The job catalogue (docs/03). Phase 1 has the Office Worker; the other jobs arrive in Phase 2 and 6.

export type JobId = 'office';
export type TaskId = 'filing' | 'dataEntry';

export interface JobDef {
  id: JobId;
  name: string;
  /** Rank titles 1–5. */
  ranks: readonly string[];
  /** Tasks a shift draws from, and how many make a shift (Phase 1: 3 filing / data-entry tasks). */
  tasks: readonly TaskId[];
  tasksPerShift: number;
}

export const JOBS: Record<JobId, JobDef> = {
  office: {
    id: 'office',
    name: 'OFFICE WORKER',
    ranks: ['CLERK', 'ANALYST', 'SENIOR ANALYST', 'MANAGER', 'DIRECTOR'],
    tasks: ['filing', 'dataEntry'],
    tasksPerShift: 3,
  },
};

export const TASK_NAMES: Record<TaskId, string> = { filing: 'FILE PAPERWORK', dataEntry: 'DATA ENTRY' };
