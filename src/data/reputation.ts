// Criminal reputation tiers, what each unlocks, and the phone contacts it opens (docs/04 "Criminal reputation",
// docs/10 Track B). The thresholds are numbers, so they live in config/balanceCrime.ts; this is the catalogue.
// Tiers unlock contacts and services; they never lock crimes (docs/04).

export type RepTier = 0 | 1 | 2 | 3 | 4;

export const TIER_NAMES: Record<RepTier, string> = {
  0: 'NOBODY',
  1: 'HUSTLER',
  2: 'KNOWN',
  3: 'CONNECTED',
  4: 'BOSS',
};

/** Everything a reputation tier opens (docs/10 Track B). Systems ask `hasService` before offering one. */
export type ServiceId =
  | 'fence'
  | 'chopShop'
  | 'dealers'
  | 'launderer'
  | 'productT1'
  | 'workbench'
  | 'proLockpicks'
  | 'stethoscope'
  | 'airdrops'
  | 'rivals'
  | 'launderBetter'
  | 'productT2'
  | 'atmDrill'
  | 'counterfeitPress'
  | 'chopBay'
  | 'crew'
  | 'gangBribes'
  | 'productT3'
  | 'productLab'
  | 'truckIntel'
  | 'judgeBribe'
  | 'fronts'
  | 'jewelleryHeist'
  | 'docksHeist'
  | 'nightclub'
  | 'bankHeist'
  | 'crewTraining';

export const TIER_SERVICES: Record<RepTier, readonly ServiceId[]> = {
  0: ['fence', 'chopShop', 'dealers', 'launderer'],
  1: ['productT1', 'workbench', 'proLockpicks', 'stethoscope'],
  2: [
    'airdrops',
    'rivals',
    'launderBetter',
    'productT2',
    'atmDrill',
    'counterfeitPress',
    'chopBay',
    'crew',
    'gangBribes',
  ],
  3: ['productT3', 'productLab', 'truckIntel', 'judgeBribe', 'fronts', 'jewelleryHeist', 'docksHeist'],
  4: ['nightclub', 'bankHeist', 'crewTraining'],
};

/** Crime-side phone contacts (docs/11 phone: launderer, dealer, gang contact). Dez and Marlo are there from the
 *  start; the others join the phone when the tier is reached. */
export type ContactId = 'dez' | 'marlo' | 'fence' | 'dealer' | 'supplier' | 'gangContact';

export interface ContactDef {
  id: ContactId;
  /** Shown in the phone's CONTACTS list. */
  name: string;
  /** Second line in the list: what they do for you. */
  role: string;
  tier: RepTier;
}

export const CONTACTS: readonly ContactDef[] = [
  { id: 'dez', name: 'DEZ', role: 'LAUNDERING', tier: 0 },
  { id: 'marlo', name: 'MARLO', role: 'CHOP SHOP', tier: 0 },
  { id: 'fence', name: 'THE FENCE', role: 'STOLEN GOODS, TOOLS', tier: 0 },
  { id: 'dealer', name: 'THE DEALER', role: 'WEAPONS', tier: 0 },
  { id: 'supplier', name: 'THE SUPPLIER', role: 'PRODUCT', tier: 1 },
  { id: 'gangContact', name: 'GANG CONTACT', role: 'BRIBES, INTEL', tier: 2 },
];

/** The phone message sent when a new tier is reached (from Dez, who hears everything at the bar). */
export const TIER_UP_TEXT: Record<RepTier, string> = {
  0: '',
  1: 'PEOPLE KNOW YOUR NAME NOW. HUSTLER. THE FENCE HAS PRO GEAR FOR YOU.',
  2: 'YOU ARE KNOWN. BETTER TERMS AT MY TABLE, AND A GANG CONTACT WANTS TO MEET.',
  3: 'CONNECTED. THE BIG JOBS ARE ON THE TABLE NOW.',
  4: 'THEY CALL YOU BOSS. THE BANK IS YOURS TO TAKE.',
};
