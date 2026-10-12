// Procedural sound recipes (docs/13 "Audio": short, soft, slightly lo-fi; jsfxr-style, generated in code).
// Every sound is synthesised into a mono Float32Array from a seeded RNG, so a recipe always renders the same
// samples. No audio files, no network: the buffers are built on the player's machine at load.
//
// The synth numbers below (frequencies, envelopes, filter cut-offs) are the sound catalogue, the audio
// counterpart of an art model in art/source/, not gameplay balance.

import { Rng } from '../core/rng';

/** Render rate. 22.05 kHz keeps the top end soft (part of the lo-fi feel) and halves the render work. */
export const RENDER_RATE = 22050;
/** Output bit depth of the lo-fi pass. */
export const LOFI_BITS = 10;
/** One-pole low-pass on every sound, so nothing is bright or harsh. */
export const LOFI_CUTOFF_HZ = 6500;
/** High-pass corner of the DC blocker every sound goes through. */
export const DC_CUTOFF_HZ = 20;
/** Loops render this much extra and crossfade it over their start, so the seam never clicks. */
export const LOOP_XFADE_S = 0.04;
/** One-shots fade in and out over these, so a sound never starts or ends on a click. */
export const EDGE_IN_S = 0.002;
export const EDGE_OUT_S = 0.012;

export const SFX_IDS = [
  'step_concrete',
  'step_grass',
  'engine_loop',
  'tyre_screech',
  'crash',
  'door_open',
  'door_close',
  'lock_click',
  'lock_fail',
  'hotwire_spark',
  'siren_loop',
  'radio_blip',
  'cash',
  'ui_click',
  'ui_confirm',
  'ui_cancel',
  'paper_shuffle',
  'stamp',
  'clock_in_bell',
] as const;

export type SfxId = (typeof SFX_IDS)[number];

/** Mixer bus a sound plays on (docs/13: master, music, SFX and UI). Music is not a sound effect. */
export type SfxBus = 'sfx' | 'ui';

export interface Recipe {
  bus: SfxBus;
  /** Length in seconds (for a loop, one period). */
  seconds: number;
  /** Plays as a seamless loop rather than once. */
  loop: boolean;
  /** Seeded takes rendered for this sound; a play picks one, so repeats (footsteps) don't sound mechanical. */
  variants: number;
  /** Peak level after normalising, 0–1. Lower is softer; sets the loudness of sounds against each other. */
  peak: number;
  /** Random playback-rate spread per play, as a fraction (0.04 = ±4 %). */
  jitter: number;
  /** Most copies of this sound playing at once; the oldest is cut when another starts. */
  maxVoices: number;
  synth: (s: Synth) => void;
}

// ---------------------------------------------------------------------------------------------------------
// Synth primitives. All of them add into the take's buffer, so a recipe layers parts.

export type Wave = 'sine' | 'square' | 'saw' | 'triangle';
/** Amplitude 0–1 at time t (seconds) into a part of length dur. */
export type Env = (t: number, dur: number) => number;
/** Frequency in Hz at time t (seconds) into a part. */
export type Freq = number | ((t: number, dur: number) => number);

/** Sharp attack, exponential decay with time constant `decay` (seconds). */
export const perc =
  (attack: number, decay: number): Env =>
  (t) =>
    t < attack ? t / attack : Math.exp(-(t - attack) / decay);

/** Linear attack, hold, linear release to the end of the part. */
export const ahr =
  (attack: number, release: number): Env =>
  (t, dur) =>
    t < attack ? t / attack : t > dur - release ? Math.max(0, (dur - t) / release) : 1;

/** Constant level (for loops, which must not fade). */
export const flat: Env = () => 1;

/** Linear glide from `a` Hz to `b` Hz over the part. */
export const glide =
  (a: number, b: number): Freq =>
  (t, dur) =>
    a + (b - a) * Math.min(1, t / dur);

/** Exponential glide (pitch drops sound natural this way). */
export const sweep =
  (a: number, b: number): Freq =>
  (t, dur) =>
    a * Math.pow(b / a, Math.min(1, t / dur));

function waveAt(w: Wave, phase: number): number {
  const p = phase - Math.floor(phase);
  switch (w) {
    case 'sine':
      return Math.sin(2 * Math.PI * p);
    case 'square':
      // Softened square: rounded edges sound less buzzy than a hard one.
      return Math.tanh(4 * Math.sin(2 * Math.PI * p));
    case 'saw':
      return 2 * p - 1;
    case 'triangle':
      return 1 - 4 * Math.abs(p - 0.5);
  }
}

type FilterKind = 'lowpass' | 'highpass' | 'bandpass';

/** RBJ biquad, applied in place. */
export function biquad(x: Float32Array, sr: number, kind: FilterKind, freq: number, q = 0.707): Float32Array {
  const w = (2 * Math.PI * Math.min(freq, sr * 0.45)) / sr;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  let b0: number, b1: number, b2: number;
  if (kind === 'lowpass') {
    b0 = (1 - cos) / 2;
    b1 = 1 - cos;
    b2 = b0;
  } else if (kind === 'highpass') {
    b0 = (1 + cos) / 2;
    b1 = -(1 + cos);
    b2 = b0;
  } else {
    b0 = alpha;
    b1 = 0;
    b2 = -alpha;
  }
  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const x0 = x[i]!;
    const y0 = (b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  return x;
}

interface Part {
  /** Start, seconds into the take. */
  at?: number;
  /** Length in seconds (defaults to the rest of the take). */
  dur?: number;
  env?: Env;
  gain?: number;
}

export interface ToneOpts extends Part {
  freq: Freq;
  wave?: Wave;
  /** Vibrato: depth as a fraction of the frequency, and rate in Hz. */
  vibrato?: [depth: number, rate: number];
}

export interface NoiseOpts extends Part {
  lowpass?: number;
  highpass?: number;
  /** Band-pass centre (Hz) and Q. */
  band?: [freq: number, q: number];
  /** Noise colour: 'white', or 'crackle' (sparse random impulses, for sparks and grit). */
  kind?: 'white' | 'crackle';
  /** For crackle: chance per sample of an impulse. */
  density?: number;
}

/** The buffer a recipe writes into, plus the take's RNG. */
export class Synth {
  readonly buf: Float32Array<ArrayBuffer>;

  /**
   * @param seconds length of the take (for a loop, one period plus the crossfade tail)
   * @param period for a loop, the loop length; anything periodic must repeat over it
   */
  constructor(
    readonly sr: number,
    readonly seconds: number,
    readonly rng: Rng,
    readonly period = seconds,
  ) {
    this.buf = new Float32Array(Math.round(seconds * sr));
  }

  private span(p: Part): [start: number, len: number] {
    const start = Math.round((p.at ?? 0) * this.sr);
    const len = Math.max(0, Math.min(this.buf.length - start, Math.round((p.dur ?? this.seconds) * this.sr)));
    return [start, len];
  }

  /** An oscillator with a frequency curve and an envelope. */
  tone(o: ToneOpts): this {
    const [start, len] = this.span(o);
    const wave = o.wave ?? 'sine';
    const gain = o.gain ?? 1;
    const env = o.env ?? flat;
    const dur = len / this.sr;
    let phase = 0;
    for (let i = 0; i < len; i++) {
      const t = i / this.sr;
      let f = typeof o.freq === 'number' ? o.freq : o.freq(t, dur);
      if (o.vibrato) f *= 1 + o.vibrato[0] * Math.sin(2 * Math.PI * o.vibrato[1] * t);
      this.buf[start + i]! += gain * env(t, dur) * waveAt(wave, phase);
      phase += f / this.sr;
    }
    return this;
  }

  /** Filtered noise with an envelope. */
  noise(o: NoiseOpts): this {
    const [start, len] = this.span(o);
    const gain = o.gain ?? 1;
    const env = o.env ?? flat;
    const dur = len / this.sr;
    const n = new Float32Array(len);
    const density = o.density ?? 0.02;
    for (let i = 0; i < len; i++) {
      if (o.kind === 'crackle') n[i] = this.rng.chance(density) ? this.rng.range(-1, 1) : 0;
      else n[i] = this.rng.range(-1, 1);
    }
    if (o.highpass) biquad(n, this.sr, 'highpass', o.highpass);
    if (o.lowpass) biquad(n, this.sr, 'lowpass', o.lowpass);
    if (o.band) biquad(n, this.sr, 'bandpass', o.band[0], o.band[1]);
    for (let i = 0; i < len; i++) this.buf[start + i]! += gain * env(i / this.sr, dur) * n[i]!;
    return this;
  }

  /** A struck, inharmonic bell or metal partial set: `ratios` of `freq`, each decaying a little faster. */
  bell(o: Part & { freq: number; ratios: readonly number[]; decay: number }): this {
    o.ratios.forEach((r, k) => {
      this.tone({
        at: o.at,
        dur: o.dur,
        freq: o.freq * r,
        gain: (o.gain ?? 1) / (k + 1),
        env: perc(0.002, o.decay / (1 + k * 0.6)),
      });
    });
    return this;
  }

  /** A short low thump (pitch drops from `from` to `to` Hz). */
  thump(o: Part & { from: number; to: number; decay: number }): this {
    return this.tone({
      at: o.at,
      dur: o.dur ?? o.decay * 6,
      freq: sweep(o.from, o.to),
      gain: o.gain,
      env: perc(0.002, o.decay),
    });
  }
}

// ---------------------------------------------------------------------------------------------------------
// The catalogue (docs/13, must-have list).

/** Engine firing rate at idle. 50 Hz divides RENDER_RATE exactly (441 samples), so the loop is periodic. */
export const ENGINE_BASE_HZ = 50;
const ENGINE_PULSES = 50; // one second of firing pulses, each with its own seeded strength

/** Siren carrier centre; centre × loop length is a whole number of cycles, so the loop is periodic. */
const SIREN_CENTRE_HZ = 960;
const SIREN_DEPTH_HZ = 330;

export const RECIPES: Record<SfxId, Recipe> = {
  // Footsteps: a dull heel thud plus a short scuff. Concrete is tighter and brighter, grass a soft crunch.
  step_concrete: {
    bus: 'sfx',
    seconds: 0.09,
    loop: false,
    variants: 4,
    peak: 0.35,
    jitter: 0.06,
    maxVoices: 4,
    synth: (s) =>
      s
        .thump({ from: 140, to: 70, decay: 0.012, gain: 0.8 })
        .noise({ band: [1500 + s.rng.range(-300, 300), 1.2], env: perc(0.001, 0.014), gain: 1.4 }),
  },
  step_grass: {
    bus: 'sfx',
    seconds: 0.13,
    loop: false,
    variants: 4,
    peak: 0.28,
    jitter: 0.08,
    maxVoices: 4,
    synth: (s) =>
      s
        .thump({ from: 110, to: 60, decay: 0.015, gain: 0.5 })
        .noise({
          kind: 'crackle',
          density: 0.25,
          highpass: 1800,
          lowpass: 5000,
          env: perc(0.008, 0.035),
          gain: 2,
        })
        .noise({ band: [2600, 0.8], env: perc(0.01, 0.03), gain: 0.6 }),
  },

  // Engine: one period of a four-stroke idle. Each firing is a decaying pulse with a seeded strength; the
  // car plays it faster with speed (engineRate in sfx.ts).
  engine_loop: {
    bus: 'sfx',
    seconds: ENGINE_PULSES / ENGINE_BASE_HZ,
    loop: true,
    variants: 1,
    peak: 0.4,
    jitter: 0,
    maxVoices: 4,
    synth: (s) => {
      const strength = Array.from({ length: ENGINE_PULSES }, () => s.rng.range(0.75, 1));
      for (let i = 0; i < s.buf.length; i++) {
        const cyc = (i * ENGINE_BASE_HZ) / s.sr;
        const k = Math.floor(cyc);
        const p = cyc - k;
        const pulse = Math.exp(-p * 5) * (Math.sin(2 * Math.PI * p) + 0.5 * Math.sin(4 * Math.PI * p));
        const lope = k % 2 === 0 ? 1 : 0.85; // a slight lope every other firing
        s.buf[i]! += strength[k % ENGINE_PULSES]! * lope * pulse;
      }
      biquad(s.buf, s.sr, 'lowpass', 900, 0.9);
      s.noise({ lowpass: 400, gain: 0.08 });
    },
  },

  // Tyre screech: a wavering squeal over band-passed hiss.
  tyre_screech: {
    bus: 'sfx',
    seconds: 0.75,
    loop: false,
    variants: 2,
    peak: 0.32,
    jitter: 0.05,
    maxVoices: 2,
    synth: (s) =>
      s
        .tone({
          freq: glide(1050 + s.rng.range(-80, 80), 880),
          wave: 'triangle',
          vibrato: [0.025, 23],
          env: ahr(0.04, 0.25),
          gain: 0.6,
        })
        .tone({ freq: glide(2100, 1760), vibrato: [0.03, 31], env: ahr(0.05, 0.25), gain: 0.15 })
        .noise({ band: [1800, 2.5], env: ahr(0.03, 0.3), gain: 1.2 }),
  },

  // Crash: a heavy thump, a burst of crunch, metal ringing and falling debris.
  crash: {
    bus: 'sfx',
    seconds: 0.9,
    loop: false,
    variants: 3,
    peak: 0.6,
    jitter: 0.06,
    maxVoices: 3,
    synth: (s) =>
      s
        .thump({ from: 120, to: 38, decay: 0.08, gain: 1 })
        .noise({ lowpass: 2500, env: perc(0.002, 0.08), gain: 1.1 })
        .bell({ freq: 310 + s.rng.range(-40, 40), ratios: [1, 1.47, 2.09, 2.83], decay: 0.18, gain: 0.35 })
        .noise({ at: 0.08, kind: 'crackle', density: 0.01, highpass: 1500, env: perc(0.01, 0.2), gain: 1.3 }),
  },

  // Doors: open is a latch click then a short creak of the hinge; close is a thud and the latch.
  door_open: {
    bus: 'sfx',
    seconds: 0.45,
    loop: false,
    variants: 2,
    peak: 0.32,
    jitter: 0.05,
    maxVoices: 2,
    synth: (s) =>
      s
        .noise({ band: [3200, 3], env: perc(0.0005, 0.006), gain: 2 })
        .noise({ at: 0.03, dur: 0.012, band: [2000, 3], env: perc(0.0005, 0.004), gain: 1.4 })
        .tone({
          at: 0.08,
          dur: 0.32,
          freq: glide(330 + s.rng.range(-30, 30), 420),
          wave: 'saw',
          vibrato: [0.04, 17],
          env: ahr(0.06, 0.12),
          gain: 0.12,
        }),
  },
  door_close: {
    bus: 'sfx',
    seconds: 0.3,
    loop: false,
    variants: 2,
    peak: 0.42,
    jitter: 0.05,
    maxVoices: 2,
    synth: (s) =>
      s
        .thump({ from: 150, to: 55, decay: 0.03, gain: 1 })
        .noise({ lowpass: 1200, env: perc(0.001, 0.03), gain: 0.7 })
        .noise({ at: 0.035, band: [2800, 3], env: perc(0.0005, 0.006), gain: 1.6 }),
  },

  // Lockpick: a pin setting is a tiny bright tick; a fail is a dull clack and a falling twang.
  lock_click: {
    bus: 'sfx',
    seconds: 0.05,
    loop: false,
    variants: 3,
    peak: 0.3,
    jitter: 0.08,
    maxVoices: 3,
    synth: (s) =>
      s
        .noise({ band: [4200 + s.rng.range(-500, 500), 4], env: perc(0.0003, 0.004), gain: 2 })
        .tone({ freq: 2900, env: perc(0.0005, 0.006), gain: 0.2 }),
  },
  lock_fail: {
    bus: 'sfx',
    seconds: 0.35,
    loop: false,
    variants: 1,
    peak: 0.34,
    jitter: 0.03,
    maxVoices: 1,
    synth: (s) =>
      s
        .noise({ band: [1400, 2], env: perc(0.0005, 0.012), gain: 1.8 })
        .tone({
          at: 0.02,
          dur: 0.25,
          freq: sweep(520, 170),
          wave: 'square',
          env: perc(0.003, 0.07),
          gain: 0.25,
        })
        .noise({ at: 0.06, band: [900, 2], env: perc(0.0005, 0.01), gain: 1 }),
  },

  // Hotwire spark: a crackle of sparks with a mains-like buzz under it.
  hotwire_spark: {
    bus: 'sfx',
    seconds: 0.4,
    loop: false,
    variants: 3,
    peak: 0.34,
    jitter: 0.07,
    maxVoices: 2,
    synth: (s) =>
      s
        .noise({ kind: 'crackle', density: 0.04, highpass: 2500, env: perc(0.001, 0.12), gain: 2.5 })
        .tone({
          dur: 0.12 + s.rng.range(0, 0.08),
          freq: 120,
          wave: 'square',
          env: perc(0.002, 0.05),
          gain: 0.25,
        })
        .noise({ band: [5000, 1.5], env: perc(0.0005, 0.02), gain: 0.9 }),
  },

  // Siren: one cycle of a wail (rise and fall). Played as a positional loop (docs/13).
  siren_loop: {
    bus: 'sfx',
    seconds: 2,
    loop: true,
    variants: 1,
    peak: 0.3,
    jitter: 0,
    maxVoices: 3,
    synth: (s) => {
      const f = (t: number) => SIREN_CENTRE_HZ - SIREN_DEPTH_HZ * Math.cos((2 * Math.PI * t) / s.period);
      s.tone({ freq: f, wave: 'triangle', gain: 0.8 }).tone({ freq: (t) => 2 * f(t), gain: 0.12 });
    },
  },

  // Police radio: a squelch burst and two short beeps through a telephone band.
  radio_blip: {
    bus: 'sfx',
    seconds: 0.3,
    loop: false,
    variants: 2,
    peak: 0.26,
    jitter: 0.02,
    maxVoices: 1,
    synth: (s) => {
      s.noise({ dur: 0.06, highpass: 400, lowpass: 3000, env: perc(0.002, 0.03), gain: 0.9 })
        .tone({ at: 0.07, dur: 0.06, freq: 1250, wave: 'square', env: ahr(0.003, 0.01), gain: 0.35 })
        .tone({ at: 0.15, dur: 0.06, freq: 1650, wave: 'square', env: ahr(0.003, 0.01), gain: 0.35 })
        .noise({ at: 0.22, dur: 0.05, highpass: 400, lowpass: 3000, env: perc(0.001, 0.015), gain: 0.6 });
      biquad(s.buf, s.sr, 'bandpass', 1400, 0.7);
    },
  },

  // Cash pickup: a flick of notes and a small two-coin chime.
  cash: {
    bus: 'sfx',
    seconds: 0.4,
    loop: false,
    variants: 2,
    peak: 0.32,
    jitter: 0.03,
    maxVoices: 2,
    synth: (s) =>
      s
        .noise({ dur: 0.08, band: [3500, 1], env: perc(0.003, 0.02), gain: 0.8 })
        .bell({ at: 0.03, freq: 1760, ratios: [1, 2.4], decay: 0.08, gain: 0.35 })
        .bell({ at: 0.1, freq: 2350, ratios: [1, 2.4], decay: 0.12, gain: 0.35 }),
  },

  // UI: a click is a soft tick; confirm rises, cancel falls.
  ui_click: {
    bus: 'ui',
    seconds: 0.04,
    loop: false,
    variants: 1,
    peak: 0.22,
    jitter: 0.02,
    maxVoices: 2,
    synth: (s) =>
      s
        .tone({ freq: 1800, env: perc(0.0005, 0.006) })
        .noise({ band: [3000, 2], env: perc(0.0003, 0.003), gain: 0.5 }),
  },
  ui_confirm: {
    bus: 'ui',
    seconds: 0.18,
    loop: false,
    variants: 1,
    peak: 0.24,
    jitter: 0,
    maxVoices: 1,
    synth: (s) =>
      s
        .tone({ dur: 0.07, freq: 660, wave: 'square', env: ahr(0.003, 0.03), gain: 0.5 })
        .tone({ at: 0.07, dur: 0.11, freq: 990, wave: 'square', env: perc(0.003, 0.05), gain: 0.5 }),
  },
  ui_cancel: {
    bus: 'ui',
    seconds: 0.18,
    loop: false,
    variants: 1,
    peak: 0.22,
    jitter: 0,
    maxVoices: 1,
    synth: (s) =>
      s
        .tone({ dur: 0.07, freq: 520, wave: 'square', env: ahr(0.003, 0.03), gain: 0.5 })
        .tone({ at: 0.07, dur: 0.11, freq: 350, wave: 'square', env: perc(0.003, 0.05), gain: 0.5 }),
  },

  // Filing: paper shuffle is bursts of soft hiss; the stamp is a firm thump with a papery slap.
  paper_shuffle: {
    bus: 'sfx',
    seconds: 0.38,
    loop: false,
    variants: 3,
    peak: 0.24,
    jitter: 0.06,
    maxVoices: 2,
    synth: (s) => {
      let at = 0;
      while (at < s.seconds - 0.06) {
        const dur = s.rng.range(0.04, 0.09);
        s.noise({
          at,
          dur,
          band: [s.rng.range(2500, 4500), 0.9],
          env: ahr(0.01, dur * 0.6),
          gain: s.rng.range(0.5, 1),
        });
        at += dur * s.rng.range(0.6, 1);
      }
    },
  },
  stamp: {
    bus: 'sfx',
    seconds: 0.22,
    loop: false,
    variants: 2,
    peak: 0.45,
    jitter: 0.04,
    maxVoices: 2,
    synth: (s) =>
      s
        .thump({ from: 180, to: 70, decay: 0.025, gain: 1 })
        .noise({ lowpass: 1800, env: perc(0.0005, 0.02), gain: 0.9 })
        .noise({ band: [3000, 1], env: perc(0.001, 0.015), gain: 0.4 }),
  },

  // Clock-in bell: a small desk bell, "ding".
  clock_in_bell: {
    bus: 'sfx',
    seconds: 1.3,
    loop: false,
    variants: 1,
    peak: 0.3,
    jitter: 0,
    maxVoices: 1,
    synth: (s) => s.bell({ freq: 1320, ratios: [1, 2.76, 5.4, 8.93], decay: 0.35, gain: 1 }),
  },
};

// ---------------------------------------------------------------------------------------------------------
// Rendering.

/** Seed of a take: stable per sound and variant, so a recipe always renders the same samples. */
export function takeSeed(id: SfxId, variant: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193);
  return (h ^ Math.imul(variant + 1, 0x9e3779b1)) >>> 0;
}

/** Renders one take of a sound: synth, lo-fi pass, edge fades or the loop crossfade, normalise. */
export function renderSfx(id: SfxId, variant = 0, sr = RENDER_RATE): Float32Array<ArrayBuffer> {
  const r = RECIPES[id];
  const v = ((variant % r.variants) + r.variants) % r.variants;
  const tail = r.loop ? LOOP_XFADE_S : 0;
  const s = new Synth(sr, r.seconds + tail, new Rng(takeSeed(id, v)), r.seconds);
  r.synth(s);
  let out = s.buf;
  lofi(out, sr);
  if (r.loop) out = crossfadeLoop(out, Math.round(r.seconds * sr));
  if (!r.loop) fadeEdges(out, sr);
  normalise(out, r.peak);
  return out;
}

/** Soft low-pass, DC blocker and bit-depth reduction (docs/13: slightly lo-fi). */
export function lofi(x: Float32Array, sr: number): void {
  const a = 1 - Math.exp((-2 * Math.PI * LOFI_CUTOFF_HZ) / sr);
  const r = Math.exp((-2 * Math.PI * DC_CUTOFF_HZ) / sr);
  let y = 0,
    prev = 0,
    hp = 0;
  const steps = 2 ** (LOFI_BITS - 1);
  let peak = 0;
  for (let i = 0; i < x.length; i++) {
    y += a * (x[i]! - y);
    hp = y - prev + r * hp; // removes any DC offset, which would waste headroom and thump on start/stop
    prev = y;
    x[i] = hp;
    peak = Math.max(peak, Math.abs(hp));
  }
  if (peak === 0) return;
  // Quantise relative to the peak so quiet sounds keep their resolution.
  for (let i = 0; i < x.length; i++) x[i] = (Math.round((x[i]! / peak) * steps) / steps) * peak;
}

/** Scales so the loudest sample sits at `peak`. */
export function normalise(x: Float32Array, peak: number): void {
  let m = 0;
  for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]!));
  if (m === 0) return;
  const k = peak / m;
  for (let i = 0; i < x.length; i++) x[i]! *= k;
}

export function fadeEdges(x: Float32Array, sr: number): void {
  const fin = Math.min(x.length, Math.round(EDGE_IN_S * sr));
  const fout = Math.min(x.length, Math.round(EDGE_OUT_S * sr));
  for (let i = 0; i < fin; i++) x[i]! *= i / fin;
  for (let i = 0; i < fout; i++) x[x.length - 1 - i]! *= i / fout;
}

/**
 * Folds the extra tail of a loop take over its start: the first samples blend from the tail (which follows
 * the last sample) into the head, so the end runs into the start without a seam. Returns `period` samples.
 */
export function crossfadeLoop(x: Float32Array, period: number): Float32Array<ArrayBuffer> {
  const xf = x.length - period;
  const out = x.slice(0, period);
  for (let i = 0; i < xf; i++) {
    const w = i / xf;
    out[i] = x[i]! * w + x[period + i]! * (1 - w);
  }
  return out;
}
