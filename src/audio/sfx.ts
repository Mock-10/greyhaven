// Sound-effect player (docs/13 must-have list). Renders the recipes into AudioBuffers on first use, plays
// one-shots with a little pitch spread, caps how many copies of a sound overlap, and runs the loops: the
// engine (pitched by speed) and the siren (positional). Not wired to game events yet.
//
// Use it after the first click (docs/14: browsers unlock audio then), e.g. with Phaser's sound context:
//   const audio = createAudio((this.sound as Phaser.Sound.WebAudioSoundManager).context);
//   audio.sfx.play('cash');

import { Rng } from '../core/rng';
import { Mixer, spatialise, type AudioContextLike, type MixerLevels, type Point } from './mixer';
import { RECIPES, RENDER_RATE, SFX_IDS, renderSfx, type SfxId } from './recipes';

/** Time constant for rate, volume and pan changes on a playing voice. */
export const VOICE_SMOOTH_S = 0.05;
/** Fade when a loop stops or a voice is cut for a newer one. */
export const STOP_FADE_S = 0.08;

// Engine pitch (docs/13: car engine loop with pitch by speed). Playback rate of the idle take, which fires
// at ENGINE_BASE_HZ. The rate climbs through each gear and drops back at the shift.
export const ENGINE_IDLE_RATE = 0.8;
export const ENGINE_GEARS = 4;
/** Rate gained across one gear. */
export const ENGINE_GEAR_SPAN = 0.9;
/** How much higher each gear starts than the one before. */
export const ENGINE_GEAR_STEP = 0.25;
/** Engine loudness at idle and at full speed. */
export const ENGINE_IDLE_GAIN = 0.55;
export const ENGINE_FULL_GAIN = 1;

/** Playback rate of the engine loop at a speed fraction (0 = idle, 1 = top speed). */
export function engineRate(speedFrac: number): number {
  const s = Math.min(1, Math.max(0, Number.isFinite(speedFrac) ? speedFrac : 0));
  const gear = Math.min(ENGINE_GEARS - 1, Math.floor(s * ENGINE_GEARS));
  const inGear = s * ENGINE_GEARS - gear;
  return ENGINE_IDLE_RATE + gear * ENGINE_GEAR_STEP + inGear * ENGINE_GEAR_SPAN;
}

/** Engine loudness at a speed fraction. */
export function engineGain(speedFrac: number): number {
  const s = Math.min(1, Math.max(0, Number.isFinite(speedFrac) ? speedFrac : 0));
  return ENGINE_IDLE_GAIN + (ENGINE_FULL_GAIN - ENGINE_IDLE_GAIN) * s;
}

export interface PlayOptions {
  /** 0–1, on top of the bus level. */
  volume?: number;
  /** Playback rate (1 = as rendered); the recipe's random spread is applied on top for one-shots. */
  rate?: number;
  /** Stereo pan, −1 (left) to 1 (right). */
  pan?: number;
  /** A fixed take, instead of a random one. */
  variant?: number;
}

export interface Voice {
  readonly id: SfxId;
  readonly playing: boolean;
  setRate(rate: number): void;
  setVolume(volume: number): void;
  setPan(pan: number): void;
  /** Fades out and stops. */
  stop(fade?: number): void;
}

export interface EngineVoice extends Voice {
  /** Speed as a fraction of the car's top speed. */
  setSpeed(speedFrac: number): void;
}

export interface SirenVoice extends Voice {
  /** Re-pans and re-levels the siren for where it is relative to the player (world units). */
  setPosition(listener: Point, source: Point): void;
}

class PlayingVoice implements Voice {
  playing = true;

  constructor(
    readonly id: SfxId,
    private readonly ctx: AudioContextLike,
    private readonly src: AudioBufferSourceNode,
    private readonly amp: GainNode,
    private readonly panner: StereoPannerNode | null,
    private readonly onEnd: (v: PlayingVoice) => void,
  ) {
    src.onended = () => this.ended();
  }

  setRate(rate: number): void {
    this.src.playbackRate.setTargetAtTime(Math.max(0.05, rate), this.ctx.currentTime, VOICE_SMOOTH_S);
  }

  setVolume(volume: number): void {
    this.amp.gain.setTargetAtTime(Math.min(1, Math.max(0, volume)), this.ctx.currentTime, VOICE_SMOOTH_S);
  }

  setPan(pan: number): void {
    this.panner?.pan.setTargetAtTime(Math.min(1, Math.max(-1, pan)), this.ctx.currentTime, VOICE_SMOOTH_S);
  }

  stop(fade = STOP_FADE_S): void {
    if (!this.playing) return;
    const now = this.ctx.currentTime;
    this.amp.gain.cancelScheduledValues(now);
    this.amp.gain.setTargetAtTime(0, now, Math.max(0.001, fade / 4));
    this.src.stop(now + fade);
    this.ended();
  }

  private ended(): void {
    if (!this.playing) return;
    this.playing = false;
    this.onEnd(this);
  }
}

export class Sfx {
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly voices = new Map<SfxId, PlayingVoice[]>();
  private readonly rng: Rng;

  constructor(
    private readonly ctx: AudioContextLike,
    readonly mixer: Mixer,
    seed = 0x5f3a,
  ) {
    this.rng = new Rng(seed);
  }

  /** The buffer of one take, rendered on first use and kept. */
  buffer(id: SfxId, variant = 0): AudioBuffer {
    const v = variant % RECIPES[id].variants;
    const key = `${id}/${v}`;
    let b = this.buffers.get(key);
    if (!b) {
      const data = renderSfx(id, v);
      b = this.ctx.createBuffer(1, data.length, RENDER_RATE);
      b.copyToChannel(data, 0);
      this.buffers.set(key, b);
    }
    return b;
  }

  /** Renders every take up front (e.g. behind the title screen), so the first play never stalls. */
  prewarm(ids: readonly SfxId[] = SFX_IDS): void {
    for (const id of ids) for (let v = 0; v < RECIPES[id].variants; v++) this.buffer(id, v);
  }

  /** How many copies of a sound are playing. */
  playingCount(id: SfxId): number {
    return this.voices.get(id)?.length ?? 0;
  }

  /** Plays a sound once (or starts a loop, for loop recipes). Cuts the oldest copy when at the voice cap. */
  play(id: SfxId, opts: PlayOptions = {}): Voice {
    const r = RECIPES[id];
    const list = this.voices.get(id) ?? [];
    this.voices.set(id, list);
    while (list.length >= r.maxVoices) list[0]!.stop();

    const variant = opts.variant ?? this.rng.int(0, r.variants - 1);
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer(id, variant);
    src.loop = r.loop;
    const spread = r.loop ? 1 : 1 + this.rng.range(-r.jitter, r.jitter);
    src.playbackRate.value = (opts.rate ?? 1) * spread;

    const amp = this.ctx.createGain();
    amp.gain.value = Math.min(1, Math.max(0, opts.volume ?? 1));
    src.connect(amp);
    let panner: StereoPannerNode | null = null;
    if (typeof this.ctx.createStereoPanner === 'function') {
      panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.min(1, Math.max(-1, opts.pan ?? 0));
      amp.connect(panner);
      panner.connect(this.mixer.input(r.bus));
    } else {
      amp.connect(this.mixer.input(r.bus));
    }

    const voice = new PlayingVoice(id, this.ctx, src, amp, panner, (v) => {
      const k = list.indexOf(v);
      if (k >= 0) list.splice(k, 1);
    });
    list.push(voice);
    src.start(this.ctx.currentTime);
    return voice;
  }

  /** Starts the engine loop; call setSpeed() every frame while driving. */
  engine(speedFrac = 0): EngineVoice {
    const v = this.play('engine_loop', { rate: engineRate(speedFrac), volume: engineGain(speedFrac) });
    return Object.assign(v, {
      setSpeed(s: number) {
        v.setRate(engineRate(s));
        v.setVolume(engineGain(s));
      },
    });
  }

  /** Starts a positional siren loop; call setPosition() as the police car and the player move. */
  siren(listener: Point, source: Point): SirenVoice {
    const at = spatialise(listener, source);
    const v = this.play('siren_loop', { volume: at.gain, pan: at.pan });
    return Object.assign(v, {
      setPosition(l: Point, s: Point) {
        const p = spatialise(l, s);
        v.setVolume(p.gain);
        v.setPan(p.pan);
      },
    });
  }

  /** Stops everything (e.g. on pause or when leaving to the title). */
  stopAll(fade = STOP_FADE_S): void {
    for (const list of this.voices.values()) for (const v of [...list]) v.stop(fade);
  }
}

/** Builds the mixer and the effect player on an audio context. */
export function createAudio(
  ctx: AudioContextLike,
  levels: Partial<MixerLevels> = {},
): { mixer: Mixer; sfx: Sfx } {
  const mixer = new Mixer(ctx, levels);
  return { mixer, sfx: new Sfx(ctx, mixer) };
}
