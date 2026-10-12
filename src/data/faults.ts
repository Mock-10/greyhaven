// Car faults for the mechanic's Diagnose task (docs/06: "listen and look: pick the faulty part out of 4 from
// symptoms"). Each fault has two symptoms, each with a kind that picks its picture in the panel: something you hear,
// see coming out, see on the dash, or feel at the wheel. No two faults share a symptom, so every car has one answer.

export type SymptomKind = 'sound' | 'smoke' | 'leak' | 'dash' | 'feel';

export interface Symptom {
  kind: SymptomKind;
  text: string;
}

export interface Fault {
  part: string;
  symptoms: readonly [Symptom, Symptom];
}

export const FAULTS: readonly Fault[] = [
  {
    part: 'SPARK PLUGS',
    symptoms: [
      { kind: 'sound', text: 'MISFIRES AT IDLE' },
      { kind: 'feel', text: 'JERKS WHEN PULLING AWAY' },
    ],
  },
  {
    part: 'BATTERY',
    symptoms: [
      { kind: 'sound', text: "CLICKS BUT WON'T CRANK" },
      { kind: 'dash', text: 'DASH LIGHTS DIM' },
    ],
  },
  {
    part: 'BRAKE PADS',
    symptoms: [
      { kind: 'sound', text: 'SQUEALS WHEN BRAKING' },
      { kind: 'feel', text: 'TAKES LONGER TO STOP' },
    ],
  },
  {
    part: 'ALTERNATOR',
    symptoms: [
      { kind: 'dash', text: 'BATTERY LIGHT ON' },
      { kind: 'feel', text: 'DIES AFTER A FEW MILES' },
    ],
  },
  {
    part: 'RADIATOR',
    symptoms: [
      { kind: 'smoke', text: 'STEAM FROM THE HOOD' },
      { kind: 'leak', text: 'GREEN PUDDLE UNDERNEATH' },
    ],
  },
  {
    part: 'EXHAUST',
    symptoms: [
      { kind: 'sound', text: 'LOUD RUMBLE UNDERNEATH' },
      { kind: 'smoke', text: 'FUMES IN THE CABIN' },
    ],
  },
  {
    part: 'FUEL PUMP',
    symptoms: [
      { kind: 'feel', text: 'SPUTTERS UP HILLS' },
      { kind: 'sound', text: 'WHINE FROM THE TANK' },
    ],
  },
  {
    part: 'HEAD GASKET',
    symptoms: [
      { kind: 'smoke', text: 'WHITE SMOKE FROM EXHAUST' },
      { kind: 'dash', text: 'TEMP NEEDLE CLIMBS' },
    ],
  },
  {
    part: 'WHEEL BEARING',
    symptoms: [
      { kind: 'sound', text: 'HUM THAT RISES WITH SPEED' },
      { kind: 'feel', text: 'WOBBLE IN THE WHEEL' },
    ],
  },
  {
    part: 'OIL SEAL',
    symptoms: [
      { kind: 'leak', text: 'BLACK DRIPS ON THE FLOOR' },
      { kind: 'smoke', text: 'BURNING SMELL WHEN HOT' },
    ],
  },
  {
    part: 'SHOCKS',
    symptoms: [
      { kind: 'feel', text: 'BOUNCES OVER BUMPS' },
      { kind: 'sound', text: 'KNOCK OVER POTHOLES' },
    ],
  },
  {
    part: 'STARTER',
    symptoms: [
      { kind: 'sound', text: 'GRINDS WHEN STARTING' },
      { kind: 'dash', text: 'LIGHTS FINE, NO CRANK' },
    ],
  },
];
