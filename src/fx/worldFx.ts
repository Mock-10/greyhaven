// Everything the world shows as effects, behind one object so the world scene needs only a few lines
// (docs/13 "Effects"): the effects layer, footstep dust, the driven car's exhaust, skids and crashes, rain from
// the weather schedule, cash glints and a pixel camera shake.

import type Phaser from 'phaser';
import { FX } from '../config/balanceFx';
import type { FxPreset } from '../data/fxPresets';
import { Shake } from '../ui/anim/motion';
import { CarFx, type CarFxInput } from './carFx';
import { FxLayer, type FxLayerOptions } from './FxLayer';
import type { EmitOptions } from './particles';
import { StepFx } from './stepFx';
import { rainAt } from './weather';

/** Ground kinds that kick up dust (vector materials and tile kinds). */
const SOFT = /^(grass|dirt|soil|gravel)/;

export function isSoftGround(kind: string | undefined): boolean {
  return kind !== undefined && SOFT.test(kind);
}

export interface WorldFxFrame {
  /** The player on foot (null while driving or with no player). */
  walker: { x: number; y: number; moving: boolean; sprinting: boolean } | null;
  /** The car being driven, if any. */
  car: Omit<CarFxInput, 'soft'> | null;
  /** Ground kind at a point (maps/groundQuery.ts). */
  groundAt: (x: number, y: number) => string | undefined;
  /** In-game minutes and the world seed, for the weather; indoors it never rains. */
  minutes: number;
  seed: number;
  indoors: boolean;
  /** Clean + dirty cash, to glint when it changes. */
  cash: number;
}

export class WorldFx {
  readonly layer: FxLayer;
  private steps = new StepFx();
  private carFx = new CarFx();
  readonly shake = new Shake();
  private cash: number | null = null;
  /** True while the driven car's tyres are skidding (for the sound layer). */
  skidding = false;
  /** Rain intensity now (0–1), also for the sound layer and the world's wet tint. */
  rain = 0;
  /** Force the weather (debug, screenshots): null follows the schedule. */
  rainOverride: number | null = null;

  constructor(
    scene: Phaser.Scene,
    objects: Phaser.GameObjects.Layer,
    overlay: Phaser.GameObjects.Layer,
    o: FxLayerOptions = {},
  ) {
    this.layer = new FxLayer(scene, objects, overlay, o);
    // ?rain=0–1 forces the weather (screenshots), like the other view-only debug parameters (debug/params.ts)
    const forced = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('rain');
    if (forced !== null && Number.isFinite(Number(forced)))
      this.rainOverride = Math.max(0, Math.min(1, Number(forced)));
  }

  /** Entering or leaving an interior: effects move to its layers. */
  setLayers(objects: Phaser.GameObjects.Layer, overlay: Phaser.GameObjects.Layer): void {
    this.layer.setLayers(objects, overlay);
    this.steps.reset();
    this.carFx.reset();
  }

  emit(preset: FxPreset, x: number, y: number, z: number, n = 1, opts: EmitOptions = {}): void {
    this.layer.emit(preset, x, y, z, n, opts);
  }

  update(dt: number, f: WorldFxFrame): void {
    if (f.walker && f.walker.moving) {
      const w = f.walker;
      this.layer.play(this.steps.update({ ...w, soft: isSoftGround(f.groundAt(w.x, w.y)) }));
    } else this.steps.reset();
    if (f.car) {
      const out = this.carFx.update(dt, { ...f.car, soft: isSoftGround(f.groundAt(f.car.x, f.car.y)) });
      this.layer.play(out.events);
      if (out.shake) this.shake.kick(out.shake);
      this.skidding = out.skidding;
    } else {
      this.carFx.reset();
      this.skidding = false;
    }
    const at = f.walker ?? f.car;
    if (this.cash !== null && f.cash !== this.cash && at)
      this.layer.emit('cashGlint', at.x, at.y, 22, FX.world.cashGlints);
    this.cash = f.cash;
    this.rain = f.indoors ? 0 : (this.rainOverride ?? rainAt(f.seed, f.minutes));
    this.layer.setRain(this.rain);
    this.shake.update(dt);
    this.layer.update(dt);
  }

  /** The camera shake to add this frame, in screen pixels. */
  get shakeOffset(): { x: number; y: number } {
    return this.shake.offset;
  }

  destroy(): void {
    this.layer.destroy();
  }
}
