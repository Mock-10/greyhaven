// The world view. Phase 0: the test map from the reference scene, a debug walker to check depth
// sorting and occlusion, and the camera (follow, pan, integer zoom).

import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { BG_DAY, DIRS, PAL, SHADOW_RGB, TILE } from '../config/constants';
import { FixedStep } from '../core/clock';
import { Rng } from '../core/rng';
import { createState, type GameState } from '../core/store';
import { framePixels, frameInfo, type FrameInfo } from '../assets/atlasLoader';
import { highlight, HIGHLIGHT_PAD } from '../assets/highlight';
import { addPixelsTexture } from '../assets/runtimeTextures';
import {
  buildingFrame,
  characterFrame,
  dirName,
  interactableFrame,
  poseFromWalk,
  propFrame,
  vehicleFrame,
  type FrameRef,
} from '../assets/sprites';
import { CameraController } from '../iso/camera';
import { depthAgainstFootprints, depthOf, type Footprint } from '../iso/depthSort';
import { isOccluding, rectsOverlap } from '../iso/occlusion';
import {
  facingFromWorld,
  roundHalfEven,
  screenDirToWorld,
  worldToScreen,
  worldToTile,
} from '../iso/projection';
import { rasterizeShadows, shadowAlpha, shadowShape, type Rect } from '../iso/shadows';
import { GroundRenderer } from '../iso/tilemap';
import { unionRect } from '../iso/chunks';
import { tileSeed, TEST_MAP } from '../maps/testMap';
import type { MapData, Placement } from '../maps/types';
import { promptPixels } from '../ui/promptPlate';
import { hook } from '../debug/hooks';
import type { Params } from '../debug/params';
import { KEYS } from '../config/keys';

interface Placed {
  placement: Placement;
  sprite: Phaser.GameObjects.Sprite;
  info: { w: number; h: number; ax: number; ay: number; bounds: Rect };
  /** Screen bounds of the opaque pixels. */
  bounds: Rect;
  height: number;
}

interface Solid {
  kind: 'box' | 'circle';
  x: number;
  y: number;
  hx: number;
  hy: number;
  r: number;
}

const SHADOW_VALUES = { box: BALANCE.render.shadowBoxValue, blob: BALANCE.render.shadowBlobValue };
const WALKER_COSTUME = 'office_worker';

export class WorldScene extends Phaser.Scene {
  private params!: Params;
  private map: MapData = TEST_MAP;
  private state!: GameState;
  private step = new FixedStep(BALANCE.sim.tickHz, BALANCE.sim.maxFrameSeconds);
  private ground!: GroundRenderer;
  private objectLayer!: Phaser.GameObjects.Layer;
  private overlayLayer!: Phaser.GameObjects.Layer;
  private placed: Placed[] = [];
  /** Box footprints of placed objects, with their sprites' screen bounds. */
  private footprints: { fp: Footprint; bounds: Rect }[] = [];
  private solids: Solid[] = [];
  private walker: Phaser.GameObjects.Sprite | null = null;
  private walkerShadow: Phaser.GameObjects.Image | null = null;
  private camCtl!: CameraController;
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'sprint' | 'recenter', Phaser.Input.Keyboard.Key>;
  private debugGfx!: Phaser.GameObjects.Graphics;
  private debugOn = false;
  private playing = false;
  private shimmer: { sprite: Phaser.GameObjects.Sprite; name: string }[] = [];
  private shimmerClock = 0;
  private rng!: Rng;

  constructor() {
    super('world');
  }

  init(params: Params): void {
    this.params = params;
    this.rng = new Rng(params.seed);
    this.state = createState(params.seed, params.spawn ?? this.map.spawn);
    this.placed = [];
    this.footprints = [];
    this.solids = [];
    this.shimmer = [];
    this.playing = params.scene !== 'title';
  }

  get isReference(): boolean {
    return this.params.scene === 'reference';
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BG_DAY);
    const groundLayer = this.add.layer().setDepth(0);
    this.objectLayer = this.add.layer().setDepth(1);
    this.overlayLayer = this.add.layer().setDepth(2);

    const shapes = this.map.placements.map((p) => shadowShape(p.x, p.y, p.shadow, SHADOW_VALUES));
    this.ground = new GroundRenderer(this, this.map, tileSeed, shapes, groundLayer);

    for (const p of this.map.placements) this.place(p);
    this.addPrompts();
    if (!this.isReference) this.createWalker(groundLayer);

    this.debugGfx = this.add.graphics();
    this.overlayLayer.add(this.debugGfx);

    const kb = this.input.keyboard;
    if (!kb) throw new Error('keyboard input unavailable');
    this.keys = {
      up: kb.addKey(KEYS.up),
      down: kb.addKey(KEYS.down),
      left: kb.addKey(KEYS.left),
      right: kb.addKey(KEYS.right),
      sprint: kb.addKey(KEYS.sprint),
      recenter: kb.addKey(KEYS.recenter),
    };
    kb.addCapture([KEYS.up, KEYS.down, KEYS.left, KEYS.right, KEYS.debugOverlay]);
    this.keys.recenter.on('down', () => this.camCtl.recenter());
    kb.on(`keydown-${KEYS.debugOverlay}`, () => this.setDebug(!this.debugOn));

    // The reference view centres on everything drawn (ground and sprites), like the reference crop.
    const bounds = this.placed.reduce((r, p) => unionRect(r, p.bounds), this.ground.bounds);
    const target = this.isReference
      ? () => ({ x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 })
      : () => this.walkerScreen();
    this.camCtl = new CameraController(this, target, {
      zoom: this.params.zoom || (this.isReference ? 1 : 0),
    });
    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.camCtl.onResize());
    this.game.events.on('camera:zoom', (z: number) => (hook().zoom = z));

    this.setDebug(this.params.debug);
    this.ground.update(this.camCtl.view());

    const h = hook();
    h.scene = this.params.scene;
    h.depthOf = (sprite) => this.placed.find((p) => p.placement.sprite === sprite)?.sprite.depth ?? null;
    h.alphaOf = (sprite) => this.placed.find((p) => p.placement.sprite === sprite)?.sprite.alpha ?? null;
    this.game.events.once(Phaser.Core.Events.POST_RENDER, () => {
      h.ready = true;
    });
  }

  /** Called by the title screen once the player clicks. */
  startPlay(): void {
    this.playing = true;
    hook().started = true;
  }

  setDebug(on: boolean): void {
    this.debugOn = on;
    this.debugGfx.setVisible(on);
    this.game.events.emit('debug:overlay', on);
  }

  // ---------------------------------------------------------------- placement

  private frameFor(p: Placement): FrameRef {
    const [kind, name] = p.sprite.split('/') as [string, string];
    switch (kind) {
      case 'bld':
        return buildingFrame(name, p.dir);
      case 'prop':
        return propFrame(name);
      case 'char':
        return characterFrame(name, poseFromWalk(p.walk), p.dir);
      case 'veh':
        return vehicleFrame(name, p.dir);
      case 'int':
        // The reference scene shows the idle shimmer on its middle frame.
        return interactableFrame(name, p.cue === 'hover' ? 'hover' : p.cue === 'idle' ? 'idle1' : 'normal');
      default:
        throw new Error(`unknown sprite kind ${kind}`);
    }
  }

  private place(p: Placement): void {
    const ref = this.frameFor(p);
    const base = frameInfo(ref.atlas, ref.frame);
    let texKey: string = ref.atlas;
    let frameKey: string | undefined = ref.frame;
    let info: Placed['info'] = base;
    // Atlas interactables ship with their cue frames. Anything else that can be used (cars) gets
    // its rim made at runtime from the same rules.
    if (p.cue && !p.sprite.startsWith('int/')) {
      const key = `cue:${ref.atlas}:${ref.frame}:${p.cue}`;
      const px = framePixels(this.textures, ref.atlas, ref.frame);
      const hi = highlight(px, p.cue, { frame: 1, valuable: p.valuable ?? false, rng: this.rng });
      const pad = HIGHLIGHT_PAD;
      addPixelsTexture(this.textures, key, hi, { ax: base.ax + pad, ay: base.ay + pad });
      texKey = key;
      frameKey = undefined;
      info = {
        w: hi.width,
        h: hi.height,
        ax: base.ax + pad,
        ay: base.ay + pad,
        bounds: {
          x: base.bounds.x + pad - 1,
          y: base.bounds.y + pad - 1,
          w: base.bounds.w + 2,
          h: base.bounds.h + 2,
        },
      };
    }
    const s = worldToScreen(p.x, p.y);
    const sx = roundHalfEven(s.x);
    const sy = roundHalfEven(s.y);
    const sprite = this.add.sprite(sx, sy, texKey, frameKey);
    sprite.setDepth(depthOf(p.x, p.y));
    this.objectLayer.add(sprite);
    const bounds = {
      x: sx - info.ax + info.bounds.x,
      y: sy - info.ay + info.bounds.y,
      w: info.bounds.w,
      h: info.bounds.h,
    };
    this.placed.push({ placement: p, sprite, info, bounds, height: info.ay - info.bounds.y });
    if (p.sprite.startsWith('int/') && p.cue === 'idle' && !this.isReference) {
      this.shimmer.push({ sprite, name: p.sprite.slice(4) });
    }
    if (p.shadow.kind === 'box') {
      const { hx, hy } = p.shadow;
      const fp = { minX: p.x - hx, minY: p.y - hy, maxX: p.x + hx, maxY: p.y + hy, depth: depthOf(p.x, p.y) };
      this.footprints.push({ fp, bounds });
      if (p.solid) this.solids.push({ kind: 'box', x: p.x, y: p.y, hx, hy, r: 0 });
    } else if (p.solid) {
      this.solids.push({ kind: 'circle', x: p.x, y: p.y, hx: 0, hy: 0, r: p.shadow.r });
    }
  }

  /** Prompt plates, placed exactly as scene.py does: centred over the sprite, 3 px above its top. */
  private addPrompts(): void {
    for (const pl of this.placed) {
      const pr = pl.placement.prompt;
      if (!pr) continue;
      const [key, label] = pr;
      const texKey = `prompt:${key}:${label}`;
      const px = promptPixels(key, label);
      addPixelsTexture(this.textures, texKey, px);
      const cx = pl.bounds.x + pl.bounds.w / 2;
      const top = pl.bounds.y - 3;
      const img = this.add
        .image(roundHalfEven(cx - px.width / 2), roundHalfEven(top - px.height), texKey)
        .setOrigin(0, 0);
      this.overlayLayer.add(img);
    }
  }

  // ---------------------------------------------------------------- debug walker

  private createWalker(groundLayer: Phaser.GameObjects.Layer): void {
    for (let d = 0; d < 8; d++) {
      const key = `walk-${WALKER_COSTUME}-${DIRS[d]}`;
      if (this.anims.exists(key)) continue;
      const f = (pose: 'idle' | 'walk1' | 'walk2') => ({
        key: 'characters',
        frame: characterFrame(WALKER_COSTUME, pose, d).frame,
      });
      this.anims.create({
        key,
        frames: [f('idle'), f('walk1'), f('idle'), f('walk2')],
        frameRate: BALANCE.walker.walkFps,
        repeat: -1,
      });
    }
    const w = this.state.walker;
    const ref = characterFrame(WALKER_COSTUME, 'idle', w.dir);
    this.walker = this.add.sprite(0, 0, ref.atlas, ref.frame);
    this.objectLayer.add(this.walker);

    // A blob shadow that moves with the walker (static shadows are baked into the ground).
    const shape = shadowShape(0, 0, { kind: 'blob', r: BALANCE.walker.radius }, SHADOW_VALUES);
    if (shape.kind === 'ellipse') {
      const rect = { x: shape.x0, y: shape.y0, w: shape.x1 - shape.x0 + 1, h: shape.y1 - shape.y0 + 1 };
      const mask = rasterizeShadows([shape], rect, () => true);
      const data = new Uint8ClampedArray(rect.w * rect.h * 4);
      mask.forEach((v, k) => {
        if (!v) return;
        data.set([...SHADOW_RGB, shadowAlpha(v, BALANCE.render.shadowStrength)], k * 4);
      });
      addPixelsTexture(
        this.textures,
        'walker-shadow',
        { width: rect.w, height: rect.h, data },
        { ax: -rect.x, ay: -rect.y },
      );
      this.walkerShadow = this.add.image(0, 0, 'walker-shadow');
      groundLayer.add(this.walkerShadow);
      this.walkerShadow.setDepth(1e6);
    }
    this.syncWalker();
  }

  private walkerScreen(): { x: number; y: number } {
    const w = this.state.walker;
    return worldToScreen(w.x, w.y);
  }

  private collides(x: number, y: number): boolean {
    const r = BALANCE.walker.radius;
    const maxX = this.map.width * TILE;
    const maxY = this.map.height * TILE;
    if (x < r || y < r || x > maxX - r || y > maxY - r) return true;
    for (const s of this.solids) {
      if (s.kind === 'box') {
        const cx = Math.max(s.x - s.hx, Math.min(x, s.x + s.hx));
        const cy = Math.max(s.y - s.hy, Math.min(y, s.y + s.hy));
        if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) return true;
      } else if ((x - s.x) ** 2 + (y - s.y) ** 2 < (r + s.r) ** 2) return true;
    }
    return false;
  }

  private tick(dt: number): void {
    const w = this.state.walker;
    const k = this.keys;
    const sx = (k.right.isDown ? 1 : 0) - (k.left.isDown ? 1 : 0);
    const sy = (k.down.isDown ? 1 : 0) - (k.up.isDown ? 1 : 0);
    if (!this.playing || (sx === 0 && sy === 0)) {
      w.moving = false;
      return;
    }
    // WASD move along the screen; convert to a world direction of unit length.
    const d = screenDirToWorld(sx, sy);
    const len = Math.hypot(d.x, d.y);
    const speed = BALANCE.walker.walkSpeed * (k.sprint.isDown ? BALANCE.walker.sprintMultiplier : 1) * dt;
    const mx = (d.x / len) * speed;
    const my = (d.y / len) * speed;
    if (!this.collides(w.x + mx, w.y)) w.x += mx;
    if (!this.collides(w.x, w.y + my)) w.y += my;
    w.dir = facingFromWorld(d.x, d.y);
    w.moving = true;
  }

  private syncWalker(): void {
    if (!this.walker) return;
    const w = this.state.walker;
    const s = this.walkerScreen();
    const x = Math.round(s.x);
    const y = Math.round(s.y);
    this.walker.setPosition(x, y);
    this.walkerShadow?.setPosition(x, y);
    const anim = `walk-${WALKER_COSTUME}-${DIRS[w.dir]}`;
    if (w.moving) {
      if (this.walker.anims.currentAnim?.key !== anim || !this.walker.anims.isPlaying)
        this.walker.play(anim, true);
    } else {
      this.walker.stop();
      const ref = characterFrame(WALKER_COSTUME, 'idle', w.dir);
      if (this.walker.frame.name !== ref.frame) this.walker.setFrame(ref.frame);
    }
    const bounds = this.walkerBounds();
    const near = this.footprints.filter((f) => rectsOverlap(f.bounds, bounds)).map((f) => f.fp);
    this.walker.setDepth(depthAgainstFootprints(w.x, w.y, near));
  }

  private walkerBounds(): Rect {
    const sp = this.walker as Phaser.GameObjects.Sprite;
    const f: FrameInfo = frameInfo('characters', sp.frame.name);
    return { x: sp.x - f.ax + f.bounds.x, y: sp.y - f.ay + f.bounds.y, w: f.bounds.w, h: f.bounds.h };
  }

  private updateOcclusion(dt: number): void {
    if (!this.walker) return;
    const target = this.walkerBounds();
    const { occludedAlpha, occluderMinHeight } = BALANCE.render;
    for (const pl of this.placed) {
      const occ = isOccluding(
        { bounds: pl.bounds, depth: pl.sprite.depth, height: pl.height },
        target,
        this.walker.depth,
        occluderMinHeight,
      );
      const want = occ ? occludedAlpha : 1;
      const a = pl.sprite.alpha + (want - pl.sprite.alpha) * Math.min(1, dt * 10);
      pl.sprite.setAlpha(Math.abs(a - want) < 0.01 ? want : a);
    }
  }

  private updateShimmer(dt: number): void {
    if (this.shimmer.length === 0) return;
    this.shimmerClock += dt;
    const frame = Math.floor(this.shimmerClock * BALANCE.render.shimmerFps) % 3;
    for (const s of this.shimmer)
      s.sprite.setFrame(interactableFrame(s.name, `idle${frame}` as 'idle0').frame);
  }

  private drawDebug(): void {
    const g = this.debugGfx;
    g.clear();
    if (!this.debugOn) return;
    const poly = (pts: { x: number; y: number }[], color: number) => {
      g.lineStyle(1, color, 1);
      g.strokePoints(
        pts.map((p) => worldToScreen(p.x, p.y)),
        true,
      );
    };
    for (const s of this.solids) {
      if (s.kind === 'box') {
        poly(
          [
            { x: s.x - s.hx, y: s.y - s.hy },
            { x: s.x + s.hx, y: s.y - s.hy },
            { x: s.x + s.hx, y: s.y + s.hy },
            { x: s.x - s.hx, y: s.y + s.hy },
          ],
          PAL.red3,
        );
      } else {
        const c = worldToScreen(s.x, s.y);
        g.lineStyle(1, PAL.red3, 1);
        g.strokeEllipse(c.x, c.y, s.r * 2 * Math.SQRT2, s.r * Math.SQRT2);
      }
    }
    if (this.walker) {
      const w = this.state.walker;
      const c = worldToScreen(w.x, w.y);
      g.lineStyle(1, PAL.cream, 1);
      g.strokeEllipse(c.x, c.y, BALANCE.walker.radius * 2 * Math.SQRT2, BALANCE.walker.radius * Math.SQRT2);
    }
  }

  update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    // The simulation runs on real elapsed time (capped by the fixed step), not Phaser's smoothed delta,
    // which is clamped to 1/60 s per frame whenever the page is unfocused or frames run slow.
    this.step.advance(this.game.loop.rawDelta / 1000, (h) => this.tick(h));
    this.syncWalker();
    this.updateOcclusion(dt);
    this.updateShimmer(dt);
    this.camCtl.update(dt);
    this.ground.update(this.camCtl.view());
    this.drawDebug();

    const h = hook();
    h.zoom = this.camCtl.zoom;
    h.fps = this.game.loop.actualFps;
    h.pan = this.camCtl.panOffset;
    if (this.walker) {
      const w = this.state.walker;
      h.walker = { x: w.x, y: w.y, depth: this.walker.depth, dir: dirName(w.dir) };
    }
    const w = this.state.walker;
    const tile = worldToTile(w.x, w.y);
    this.game.events.emit('debug:stats', {
      fps: this.game.loop.actualFps,
      zoom: this.camCtl.zoom,
      x: w.x,
      y: w.y,
      i: tile.i,
      j: tile.j,
      depth: this.walker?.depth ?? 0,
      chunks: this.ground.bakedCount(),
      pan: this.camCtl.panOffset,
    });
  }
}
