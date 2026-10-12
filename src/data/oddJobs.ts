// The weekend odd jobs (docs/02 "Weekend odd jobs", docs/03 decisions 2026-10-11): two gigs open to everyone on
// Saturday and Sunday, at the 60% side-gig rate and with no promotion XP. Their hours and task counts are in
// config/balanceOdd.ts; this is the catalogue (names, places, what a task is called) and the drinks the bar pours.

export type GigId = 'carWash' | 'barShift';

export interface GigDef {
  id: GigId;
  name: string;
  /** Where the gig is, for the job board and the prompt. */
  where: string;
  /** The panel title of a task, and what one task is called ("CAR 2/3"). */
  title: string;
  unit: string;
  /** Who hands out the gig and pays it (toasts). */
  boss: string;
}

export const GIGS: Record<GigId, GigDef> = {
  carWash: {
    id: 'carWash',
    name: 'CAR WASH',
    where: "SQUEAKY'S CAR WASH",
    title: 'CAR WASH',
    unit: 'CAR',
    boss: 'SQUEAKY',
  },
  barShift: {
    id: 'barShift',
    name: 'BAR SHIFT',
    where: 'THE LOW TIDE',
    title: 'BAR SHIFT',
    unit: 'RUSH',
    boss: 'BARTENDER',
  },
};

export const GIG_IDS: readonly GigId[] = ['carWash', 'barShift'];

export type DrinkId = 'lager' | 'stout' | 'cider';

export interface DrinkDef {
  id: DrinkId;
  name: string;
  /** Glasses a second while the tap is open: the stout pours slowly, the cider fast. */
  rate: number;
}

/** The Low Tide's three taps, left to right (keys 1–3). */
export const DRINKS: readonly DrinkDef[] = [
  { id: 'lager', name: 'LAGER', rate: 0.5 },
  { id: 'stout', name: 'STOUT', rate: 0.36 },
  { id: 'cider', name: 'CIDER', rate: 0.64 },
];
