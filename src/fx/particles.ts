// The particle simulation behind the effects layer (docs/13 "Effects"): dust, exhaust, tyre smoke, sparks,
// glints, chips, leaves, rain splashes and the flipbook effects (smoke, fire, explosions, muzzle flashes).
// Particles live in world units (x, y on the ground, z up), so they project and depth-sort like everything
// else (docs/14). Pure and seeded, so it is unit tested; fx/FxLayer.ts draws it with Phaser.

import { frameAt } from '../anim/ease';
import { Rng } from '../core/rng';

/** Which sprite sheet a particle draws from: our particle sheet (art/fx) or the effects sheet (art/effects). */
export type FxSheet = 'fx' | 'effects';

export interface ParticleSpec {
  sheet: FxSheet;
  /** Frame key prefix, e.g. 'dust' → 'dust/0'…; '{dir}' is replaced by the particle's facing. */
  sprite: string;
  frames: number;
  /** Flipbook rate; when absent the frames are spread over the particle's life. */
  fps?: number;
  loop?: boolean;
  /** Seconds. */
  life: readonly [number, number];
  /** Initial speed on the ground plane (world units a second) within `spread` of the emit direction. */
  speed: readonly [number, number];
  /** Radians either side of the emit direction (π = all around). */
  spread: number;
  /** Initial upward speed. */
  up: readonly [number, number];
  /** Upward acceleration (negative falls). */
  gravity: number;
  /** Seconds for the ground speed to halve (air drag). 0 = none. */
  drag: number;
  /** Spawn scatter radius on the ground. */
  jitter: number;
  /** Fraction of vertical speed kept when bouncing on the ground (0 = stops dead). */
  bounce?: number;
  /** Drawn with additive blending (light: glows, flashes). */
  add?: boolean;
  /** Opacity (only for soft things like rain; most sprites fade by dithering in their own frames). */
  alpha?: number;
  /** A ground decal: drawn under everything on the object layer. */
  decal?: boolean;
  /** Stays on its first frame and only fades out over the last part of its life (decals). */
  hold?: boolean;
}

export interface Particle {
  spec: ParticleSpec;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  t: number;
  life: number;
  /** 0–7 facing for per-direction sprites. */
  dir: number;
  /** Randomised flipbook start for looping sprites, so a group doesn't animate in lockstep. */
  phase: number;
}

export const DIR_NAMES = ['SE', 'S', 'SW', 'W', 'NW', 'N', 'NE', 'E'] as const;

/** The frame key a particle shows now. */
export function particleFrame(p: Particle): string {
  const s = p.spec;
  let k: number;
  if (s.hold) k = 0;
  else if (s.fps) k = frameAt(p.t + p.phase, s.fps, s.frames, s.loop ?? false);
  else k = Math.min(s.frames - 1, Math.floor((p.t / p.life) * s.frames));
  const base = s.sprite.replace('{dir}', DIR_NAMES[p.dir] as string);
  return s.frames > 1 || !s.sprite.includes('{dir}') ? `${base}/${k}` : base;
}

/** Opacity now: the spec's alpha, and a fade over the last 30% of life for held decals. */
export function particleAlpha(p: Particle): number {
  const a = p.spec.alpha ?? 1;
  if (!p.spec.hold) return a;
  const u = p.t / p.life;
  return u < 0.7 ? a : a * Math.max(0, (1 - u) / 0.3);
}

export interface EmitOptions {
  /** Ground-plane direction, radians (world: 0 = +x). Default: random. */
  angle?: number;
  /** Facing 0–7 for per-direction sprites. */
  dir?: number;
  /** Added to every particle's velocity (a moving car's speed). */
  vx?: number;
  vy?: number;
  /** Multiplies the spec's speed. */
  speedScale?: number;
}

export class ParticleSim {
  readonly list: Particle[] = [];
  private rng: Rng;

  constructor(
    seed: number,
    private max: number,
  ) {
    this.rng = new Rng(seed);
  }

  private r(range: readonly [number, number]): number {
    return range[0] + this.rng.next() * (range[1] - range[0]);
  }

  emit(spec: ParticleSpec, x: number, y: number, z: number, n: number, o: EmitOptions = {}): void {
    for (let k = 0; k < n; k++) {
      const base = o.angle ?? this.rng.next() * Math.PI * 2;
      const a = base + (this.rng.next() * 2 - 1) * spec.spread;
      const v = this.r(spec.speed) * (o.speedScale ?? 1);
      const ja = this.rng.next() * Math.PI * 2;
      const jr = Math.sqrt(this.rng.next()) * spec.jitter;
      this.list.push({
        spec,
        x: x + Math.cos(ja) * jr,
        y: y + Math.sin(ja) * jr,
        z,
        vx: Math.cos(a) * v + (o.vx ?? 0),
        vy: Math.sin(a) * v + (o.vy ?? 0),
        vz: this.r(spec.up),
        t: 0,
        life: this.r(spec.life),
        dir: o.dir ?? 0,
        phase: spec.loop ? this.rng.next() * 2 : 0,
      });
    }
    // the oldest go first when the pool is full
    if (this.list.length > this.max) this.list.splice(0, this.list.length - this.max);
  }

  update(dt: number): void {
    for (const p of this.list) {
      p.t += dt;
      const s = p.spec;
      if (s.drag > 0) {
        const k = 0.5 ** (dt / s.drag);
        p.vx *= k;
        p.vy *= k;
      }
      p.vz += s.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.z < 0) {
        p.z = 0;
        if (s.bounce && p.vz < -8) p.vz = -p.vz * s.bounce;
        else {
          p.vz = 0;
          // resting on the ground: slide to a stop
          p.vx *= 0.5 ** (dt / 0.08);
          p.vy *= 0.5 ** (dt / 0.08);
        }
      }
    }
    let w = 0;
    for (const p of this.list) if (p.t < p.life) this.list[w++] = p;
    this.list.length = w;
  }

  clear(): void {
    this.list.length = 0;
  }
}

/**
 * A steady source (a running engine's exhaust, a fire): emits `rate` particles a second while active. Keeps
 * the fractional remainder, so low rates at high frame rates still emit.
 */
export class Emitter {
  private acc = 0;

  constructor(
    readonly spec: ParticleSpec,
    public rate: number,
  ) {}

  /** How many to emit this frame. */
  tick(dt: number): number {
    this.acc += this.rate * dt;
    const n = Math.floor(this.acc);
    this.acc -= n;
    return n;
  }
}
