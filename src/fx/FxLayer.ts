// The effects layer (docs/13 "Effects"): draws fx/particles.ts with pooled Phaser images on the world's
// object layer, so smoke, dust and sparks project and depth-sort with everything else (docs/14), plus the rain
// streaks over the world. Pixel-perfect: positions are whole pixels and nothing is scaled (CLAUDE.md rule 3).
//
// Wiring (WorldScene): create one after the layers exist, call `update(dt)` every frame, and feed it from the
// trackers (StepFx for the player, CarFx for the driven car) or `emit` for one-off events.

import Phaser from 'phaser';
import { FX } from '../config/balanceFx';
import { FX_PRESETS, type FxPreset } from '../data/fxPresets';
import { depthOf } from '../iso/depthSort';
import { screenToWorld, worldToScreen } from '../iso/projection';
import type { FxEvent } from './events';
import { FX_TEXTURE } from './fxAssets';
import { ParticleSim, particleAlpha, particleFrame, type EmitOptions } from './particles';
import { RainSim } from './rain';

/** Decals sort below every object on the layer. */
const DECAL_DEPTH = -1e7;

export interface FxLayerOptions {
  /** Depth for a moving object at a ground point (WorldScene's footprint-aware rule); default x + y. */
  depthAt?: (x: number, y: number) => number;
  seed?: number;
  /** The visible area in art pixels (iso/camera.ts CameraController.view); default the camera's worldView. */
  view?: () => { x: number; y: number; w: number; h: number };
}

export class FxLayer {
  readonly sim: ParticleSim;
  private pool: Phaser.GameObjects.Image[] = [];
  private rainPool: Phaser.GameObjects.Image[] = [];
  private rain = new RainSim(5);
  private rainLevel = 0;
  private depthAt: (x: number, y: number) => number;
  private view: () => { x: number; y: number; w: number; h: number };

  constructor(
    private scene: Phaser.Scene,
    private layer: Phaser.GameObjects.Layer,
    private overlay: Phaser.GameObjects.Layer,
    o: FxLayerOptions = {},
  ) {
    this.sim = new ParticleSim(o.seed ?? 1, FX.world.maxParticles);
    this.depthAt = o.depthAt ?? depthOf;
    this.view =
      o.view ??
      (() => {
        const v = this.scene.cameras.main.worldView;
        return { x: v.x, y: v.y, w: v.width, h: v.height };
      });
  }

  /** Move the effects to other layers (entering or leaving an interior). Live particles are dropped. */
  setLayers(layer: Phaser.GameObjects.Layer, overlay: Phaser.GameObjects.Layer): void {
    this.sim.clear();
    for (const im of [...this.pool, ...this.rainPool]) im.destroy();
    this.pool = [];
    this.rainPool = [];
    this.layer = layer;
    this.overlay = overlay;
  }

  emit(preset: FxPreset, x: number, y: number, z: number, n = 1, opts: EmitOptions = {}): void {
    this.sim.emit(FX_PRESETS[preset], x, y, z, n, opts);
  }

  /** Spawn what a tracker (StepFx, CarFx) asked for. */
  play(events: readonly FxEvent[]): void {
    for (const e of events) this.emit(e.preset, e.x, e.y, e.z, e.n, e.opts);
  }

  /** Rain intensity 0–1 (fx/weather.ts rainAt; 0 indoors). */
  setRain(level: number): void {
    this.rainLevel = level;
  }

  private image(k: number, pool: Phaser.GameObjects.Image[], layer: Phaser.GameObjects.Layer) {
    let im = pool[k];
    if (!im) {
      im = this.scene.add.image(0, 0, FX_TEXTURE.fx, 'spark/0');
      layer.add(im);
      pool[k] = im;
    }
    return im;
  }

  update(dt: number): void {
    // rain first: its splashes join this frame's particles
    const view = this.view();
    const splashes = this.rain.update(dt, Math.ceil(view.w), Math.ceil(view.h), this.rainLevel);
    for (const s of splashes) {
      const g = screenToWorld(view.x + s.x, view.y + s.y);
      this.sim.emit(FX_PRESETS.splash, g.x, g.y, 0, 1);
    }
    this.sim.update(dt);
    const list = this.sim.list;
    for (let k = 0; k < list.length; k++) {
      const p = list[k]!;
      const im = this.image(k, this.pool, this.layer);
      const tex = FX_TEXTURE[p.spec.sheet];
      const frame = particleFrame(p);
      if (im.texture.key !== tex || im.frame.name !== frame) im.setTexture(tex, frame);
      const s = worldToScreen(p.x, p.y, p.z);
      im.setPosition(Math.round(s.x), Math.round(s.y));
      im.setDepth(p.spec.decal ? DECAL_DEPTH + p.t : this.depthAt(p.x, p.y) + 0.002);
      im.setAlpha(particleAlpha(p));
      im.setBlendMode(p.spec.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
      im.setVisible(true);
    }
    for (let k = list.length; k < this.pool.length; k++) this.pool[k]!.setVisible(false);
    // the streaks, over the world
    const drops = this.rain.drops;
    for (let k = 0; k < drops.length; k++) {
      const d = drops[k]!;
      const im = this.image(k, this.rainPool, this.overlay);
      const frame = `streak/${d.v}`;
      if (im.frame.name !== frame) im.setFrame(frame);
      im.setPosition(Math.round(view.x + d.x), Math.round(view.y + d.y));
      im.setAlpha(FX.rain.alpha);
      im.setVisible(this.rainLevel > 0);
    }
    for (let k = drops.length; k < this.rainPool.length; k++) this.rainPool[k]!.setVisible(false);
  }

  destroy(): void {
    for (const im of [...this.pool, ...this.rainPool]) im.destroy();
    this.pool = [];
    this.rainPool = [];
  }
}
