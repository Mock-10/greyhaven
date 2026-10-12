// Audio mixer (docs/13: master, music, SFX and UI volume sliders; sirens are positional).
// The level maths are pure functions; Mixer builds the WebAudio bus graph:
//   music ─┐
//   sfx  ──┼─> master ─> destination
//   ui   ──┘
// Not wired to the settings menu yet: whoever adds the sliders calls setLevel().

/** The slice of BaseAudioContext the audio code uses (narrow, so tests can stand in a fake). */
export type AudioContextLike = Pick<
  BaseAudioContext,
  'createGain' | 'createBuffer' | 'createBufferSource' | 'createStereoPanner' | 'destination' | 'currentTime'
>;

export type BusName = 'master' | 'music' | 'sfx' | 'ui';
export const BUSES: readonly BusName[] = ['master', 'music', 'sfx', 'ui'];

/** Slider positions, 0–1 each, plus a global mute. */
export interface MixerLevels {
  master: number;
  music: number;
  sfx: number;
  ui: number;
  muted: boolean;
}

/** Starting slider positions until the settings menu stores the player's own. */
export const DEFAULT_LEVELS: Readonly<MixerLevels> = {
  master: 0.8,
  music: 0.6,
  sfx: 0.8,
  ui: 0.7,
  muted: false,
};

/** Time constant for level changes, so moving a slider never clicks. */
export const LEVEL_SMOOTH_S = 0.03;

export const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** Slider position to linear gain. Squared, so the slider feels even to the ear (loudness is not linear). */
export function sliderToGain(v: number): number {
  const c = clamp01(v);
  return c * c;
}

/** Gain a sound on `bus` ends up with, through its bus and the master. */
export function effectiveGain(levels: MixerLevels, bus: BusName): number {
  if (levels.muted) return 0;
  const master = sliderToGain(levels.master);
  return bus === 'master' ? master : master * sliderToGain(levels[bus]);
}

// ---------------------------------------------------------------------------------------------------------
// Positional sound (sirens). World units: 1 tile = 32.

/** Full volume within this distance. */
export const POS_NEAR = 4 * 32;
/** Silent beyond this distance. */
export const POS_FAR = 40 * 32;
/** Screen-x offset (px, at 1× zoom) for the largest pan. */
export const POS_PAN_SPAN = 12 * 64;
/** Largest pan, short of hard left/right so a far siren never sits in one ear only. */
export const POS_PAN_MAX = 0.8;

export interface Point {
  x: number;
  y: number;
}

/**
 * Volume and stereo pan of a sound at `source` heard from `listener` (the player). Pan follows the
 * screen: the projection's screenX = x − y (docs/14), so a siren to the right on screen is in the right ear.
 */
export function spatialise(listener: Point, source: Point): { gain: number; pan: number } {
  const dx = source.x - listener.x;
  const dy = source.y - listener.y;
  const d = Math.hypot(dx, dy);
  let gain: number;
  if (d <= POS_NEAR) gain = 1;
  else if (d >= POS_FAR) gain = 0;
  else gain = (1 - (d - POS_NEAR) / (POS_FAR - POS_NEAR)) ** 2; // sirens carry: a slow fall-off
  const pan = Math.max(-POS_PAN_MAX, Math.min(POS_PAN_MAX, ((dx - dy) / POS_PAN_SPAN) * POS_PAN_MAX));
  return { gain, pan };
}

// ---------------------------------------------------------------------------------------------------------

export class Mixer {
  private readonly lv: MixerLevels;
  private readonly nodes: Record<BusName, GainNode>;

  constructor(
    private readonly ctx: AudioContextLike,
    levels: Partial<MixerLevels> = {},
  ) {
    this.lv = { ...DEFAULT_LEVELS, ...levels };
    const make = (): GainNode => ctx.createGain();
    this.nodes = { master: make(), music: make(), sfx: make(), ui: make() };
    this.nodes.master.connect(ctx.destination);
    for (const b of ['music', 'sfx', 'ui'] as const) this.nodes[b].connect(this.nodes.master);
    for (const b of BUSES) this.nodes[b].gain.value = this.nodeGain(b);
  }

  /** A copy of the current slider positions (for the settings menu and the save). */
  get levels(): MixerLevels {
    return { ...this.lv };
  }

  /** Where a sound on `bus` connects. */
  input(bus: Exclude<BusName, 'master'>): AudioNode {
    return this.nodes[bus];
  }

  setLevel(bus: BusName, v: number): void {
    this.lv[bus] = clamp01(v);
    this.apply(bus);
  }

  setMuted(muted: boolean): void {
    this.lv.muted = muted;
    this.apply('master');
  }

  /** Overall gain on a bus (master included). */
  gain(bus: BusName): number {
    return effectiveGain(this.lv, bus);
  }

  private nodeGain(bus: BusName): number {
    if (bus === 'master') return this.lv.muted ? 0 : sliderToGain(this.lv.master);
    return sliderToGain(this.lv[bus]);
  }

  private apply(bus: BusName): void {
    this.nodes[bus].gain.setTargetAtTime(this.nodeGain(bus), this.ctx.currentTime, LEVEL_SMOOTH_S);
  }
}
