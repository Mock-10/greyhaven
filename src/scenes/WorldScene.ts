// The outdoor world: ground, buildings and props, the player, the camera, interaction, and day/night.
// Phase 1 milestone 1 shows Downtown; ?scene=reference shows the Phase 0 reference test map instead.

import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { BG_DAY, DIRS, PAL, SHADOW_RGB, TILE } from '../config/constants';
import { KEYS } from '../config/keys';
import { FixedStep } from '../core/clock';
import { Rng } from '../core/rng';
import { createState, loadSettings, type GameState, type Settings } from '../core/store';
import { framePixels, frameInfo } from '../assets/atlasLoader';
import { highlight, HIGHLIGHT_PAD } from '../assets/highlight';
import { addPixelsTexture } from '../assets/runtimeTextures';
import {
  buildingFrame,
  characterFrame,
  cityFrame,
  hasNightVariant,
  interactableFrame,
  poseFromWalk,
  propFrame,
  vehicleFrame,
  WALK_CYCLE,
  type FrameRef,
} from '../assets/sprites';
import { CameraController } from '../iso/camera';
import { unionRect } from '../iso/chunks';
import { depthAgainstFootprints, depthOf, type Footprint } from '../iso/depthSort';
import { isOccluding, rectsOverlap } from '../iso/occlusion';
import { facingFromWorld, roundHalfEven, worldToScreen, worldToTile } from '../iso/projection';
import { rasterizeShadows, shadowAlpha, shadowShape, type Rect } from '../iso/shadows';
import { GroundRenderer } from '../iso/tilemap';
import { VectorGroundRenderer } from '../iso/vectorGroundRenderer';
import { depthAmong, staticOrder, type Box } from '../iso/staticDepth';
import { DOWNTOWN } from '../maps/downtown';
import { tileSeed as referenceSeed, TEST_MAP } from '../maps/testMap';
import type { Door, MapData, Placement } from '../maps/types';
import { advance, calendar, darkness, tintAt } from '../systems/clock';
import { selectTarget } from '../systems/interaction';
import { moveVector, moveWithCollision, type CollisionRules, type Solid } from '../systems/movement';
import { promptPixels } from '../ui/promptPlate';
import { hook } from '../debug/hooks';
import type { Params } from '../debug/params';
import { lampTextures, windowGlowTexture } from '../world/nightLights';

interface Placed {
  placement: Placement;
  sprite: Phaser.GameObjects.Sprite;
  info: { w: number; h: number; ax: number; ay: number; bounds: Rect };
  /** Screen bounds of the opaque pixels. */
  bounds: Rect;
  height: number;
  dayFrame: FrameRef;
  nightFrame: FrameRef | null;
  glow: Phaser.GameObjects.Image | null;
  /** Usable object: how to show its idle / hover cue. */
  cue: { kind: 'atlas'; name: string } | { kind: 'runtime' } | null;
}

/** Ground footprint used for depth sorting (art/source/downtown_map.py `fp`): trees sort by their trunk. */
export function footprintOf(p: Placement): Box {
  const s = p.shadow;
  if (s.kind === 'box') return [p.x - s.hx, p.y - s.hy, p.x + s.hx, p.y + s.hy];
  if (s.kind === 'obox') {
    const ex = Math.abs(s.hx * Math.cos(s.ang)) + Math.abs(s.hy * Math.sin(s.ang));
    const ey = Math.abs(s.hx * Math.sin(s.ang)) + Math.abs(s.hy * Math.cos(s.ang));
    return [p.x - ex, p.y - ey, p.x + ex, p.y + ey];
  }
  const r = /^prop\/(tree|pine)/.test(p.sprite) ? 4 : s.r;
  return [p.x - r, p.y - r, p.x + r, p.y + r];
}

/** Something E can be used on: a placed object or a street door. */
interface Usable {
  id: string;
  x: number;
  y: number;
  label: string;
  placed: Placed | null;
  door: Door | null;
}

export interface HudSnapshot {
  px: number;
  py: number;
  /** On-screen heading of the player (radians, y down). */
  heading: number;
  minutes: number;
  money: { clean: number; dirty: number };
  stars: number;
  health: number;
  armor: number;
  district: string;
  street: string | null;
  map: MapData;
  buildings: { x: number; y: number; hx: number; hy: number }[];
  doors: Door[];
  target: string | null;
}

const SHADOW_VALUES = { box: BALANCE.render.shadowBoxValue, blob: BALANCE.render.shadowBlobValue };
const BG_NIGHT = 0x2e2430;

export class WorldScene extends Phaser.Scene {
  private params!: Params;
  private settings!: Settings;
  private map!: MapData;
  private state!: GameState;
  private step = new FixedStep(BALANCE.sim.tickHz, BALANCE.sim.maxFrameSeconds);
  private ground!: GroundRenderer | VectorGroundRenderer;
  /** City maps: static objects with their footprints, for slotting moving objects into the depth order. */
  private statics: { fp: Box; depth: number; bounds: Rect }[] = [];
  private groundLayer!: Phaser.GameObjects.Layer;
  private objectLayer!: Phaser.GameObjects.Layer;
  private overlayLayer!: Phaser.GameObjects.Layer;
  private placed: Placed[] = [];
  private footprints: { fp: Footprint; bounds: Rect; sprite: string }[] = [];
  private solids: Solid[] = [];
  private usables: Usable[] = [];
  private lamps: { halo: Phaser.GameObjects.Image; pool: Phaser.GameObjects.Image }[] = [];
  private player: Phaser.GameObjects.Sprite | null = null;
  private playerShadow: Phaser.GameObjects.Image | null = null;
  private prompt: Phaser.GameObjects.Image | null = null;
  private camCtl!: CameraController;
  private keys!: Record<
    'up' | 'down' | 'left' | 'right' | 'sprint' | 'recenter' | 'use' | 'cycle',
    Phaser.Input.Keyboard.Key
  >;
  private debugGfx!: Phaser.GameObjects.Graphics;
  private debugOn = false;
  private playing = false;
  private rng!: Rng;
  private shimmerClock = 0;
  private lastDark = -1;
  private cycle = 0;
  private target: string | null = null;
  private inRange = new Set<string>();
  private street: string | null = null;
  private radarBuildings: HudSnapshot['buildings'] = [];
  private dezTold = false;

  constructor() {
    super('world');
  }

  init(params: Params): void {
    this.params = params;
    this.settings = loadSettings();
    this.rng = new Rng(params.seed);
    this.map = params.scene === 'reference' ? TEST_MAP : DOWNTOWN;
    this.state = createState(
      params.seed,
      this.map.id,
      params.spawn ?? this.map.spawn,
      params.minute ?? undefined,
    );
    this.placed = [];
    this.statics = [];
    this.footprints = [];
    this.solids = [];
    this.usables = [];
    this.lamps = [];
    this.lastDark = -1;
    this.playing = params.scene !== 'title';
  }

  get isReference(): boolean {
    return this.params.scene === 'reference';
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BG_DAY);
    this.groundLayer = this.add.layer().setDepth(0);
    this.objectLayer = this.add.layer().setDepth(1);
    this.overlayLayer = this.add.layer().setDepth(2);

    const shapes = this.map.placements.map((p) => shadowShape(p.x, p.y, p.shadow, SHADOW_VALUES));
    const seedFor = this.isReference ? referenceSeed : (i: number, j: number) => (i * 31 + j * 17) % 7;
    this.ground = this.map.ground
      ? new VectorGroundRenderer(this, this.map, shapes, this.groundLayer)
      : new GroundRenderer(this, this.map, seedFor, shapes, this.groundLayer);

    for (const p of this.map.placements) this.place(p);
    if (this.map.ground) this.sortStatics();
    this.radarBuildings = this.footprints
      .filter((f) => (this.map.ground ? f.sprite.startsWith('bld/') : f.fp.maxX - f.fp.minX > 80))
      .map((f) => ({
        x: (f.fp.minX + f.fp.maxX) / 2,
        y: (f.fp.minY + f.fp.maxY) / 2,
        hx: (f.fp.maxX - f.fp.minX) / 2,
        hy: (f.fp.maxY - f.fp.minY) / 2,
      }));
    if (this.isReference) this.addStaticPrompts();
    else {
      for (const d of this.map.doors ?? [])
        this.usables.push({ id: `door:${d.target}`, x: d.x, y: d.y, label: d.label, placed: null, door: d });
      this.createPlayer();
      this.createLamps();
    }

    this.debugGfx = this.add.graphics();
    this.overlayLayer.add(this.debugGfx);
    this.setupInput();

    const bounds = this.placed.reduce((r, p) => unionRect(r, p.bounds), this.ground.bounds);
    const target = this.isReference
      ? () => ({ x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 })
      : () => this.playerScreen();
    this.camCtl = new CameraController(this, target, {
      zoom: this.params.zoom || this.settings.zoom || (this.isReference ? 1 : 0),
      // the view stays over the map (open since Phase 0); the reference view is free
      bounds: this.isReference ? undefined : this.ground.bounds,
    });
    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.camCtl.onResize());

    this.setDebug(this.params.debug);
    this.applyDayNight(true);
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
    this.time.delayedCall(1500, () =>
      this.game.events.emit('hud:toast', { who: 'MS. HOLLIS', text: "SHIFT STARTS AT 8. DON'T BE LATE." }),
    );
  }

  setDebug(on: boolean): void {
    this.debugOn = on;
    this.debugGfx.setVisible(on);
    this.game.events.emit('debug:overlay', on);
  }

  private setupInput(): void {
    const kb = this.input.keyboard;
    if (!kb) throw new Error('keyboard input unavailable');
    this.keys = {
      up: kb.addKey(KEYS.up),
      down: kb.addKey(KEYS.down),
      left: kb.addKey(KEYS.left),
      right: kb.addKey(KEYS.right),
      sprint: kb.addKey(KEYS.sprint),
      recenter: kb.addKey(KEYS.recenter),
      use: kb.addKey(KEYS.use),
      cycle: kb.addKey(KEYS.cycle),
    };
    kb.addCapture([KEYS.up, KEYS.down, KEYS.left, KEYS.right, KEYS.debugOverlay, KEYS.cycle]);
    this.keys.recenter.on('down', () => this.camCtl.recenter());
    this.keys.use.on('down', () => this.use());
    this.keys.cycle.on('down', () => this.cycle++);
    kb.on(`keydown-${KEYS.debugOverlay}`, () => this.setDebug(!this.debugOn));
  }

  // ---------------------------------------------------------------- placement

  private frameFor(p: Placement, night = false): FrameRef {
    const [kind, name] = p.sprite.split('/') as [string, string];
    const city = cityFrame(kind, night ? `${name}_night` : name, p.dir);
    if (city) return city;
    switch (kind) {
      case 'bld':
        return buildingFrame(night ? `${name}_night` : name, p.dir);
      case 'prop':
        return propFrame(name);
      case 'char':
        return characterFrame(name, poseFromWalk(p.walk ?? 0), p.dir);
      case 'veh':
        return vehicleFrame(name, p.dir);
      case 'int':
        // The reference scene shows the idle shimmer on its middle frame; usable objects start plain.
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
    // Reference map: atlas interactables ship with their cue frames; anything else gets its rim at runtime.
    if (p.cue && !p.sprite.startsWith('int/')) {
      const key = this.runtimeCue(ref, p.cue, 1, p.valuable ?? false);
      texKey = key;
      frameKey = undefined;
      info = this.paddedInfo(base);
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
    const name = p.sprite.split('/')[1] as string;
    const nightFrame =
      p.night && p.sprite.startsWith('bld/') && hasNightVariant(name, p.dir) ? this.frameFor(p, true) : null;
    let glow: Phaser.GameObjects.Image | null = null;
    if (nightFrame) {
      const key = windowGlowTexture(this.textures, ref.atlas, ref.frame, nightFrame.frame, {
        ax: base.ax,
        ay: base.ay,
      });
      glow = this.add
        .image(sx, sy, key)
        .setDepth(sprite.depth + 0.001)
        .setVisible(false);
      this.objectLayer.add(glow);
    }
    const placed: Placed = {
      placement: p,
      sprite,
      info,
      bounds,
      height: info.ay - info.bounds.y,
      dayFrame: ref,
      nightFrame,
      glow,
      cue: p.interact ? (p.sprite.startsWith('int/') ? { kind: 'atlas', name } : { kind: 'runtime' }) : null,
    };
    this.placed.push(placed);
    if (p.interact)
      this.usables.push({ id: p.interact.id, x: p.x, y: p.y, label: p.interact.label, placed, door: null });
    if (p.shadow.kind === 'box') {
      const { hx, hy } = p.shadow;
      this.footprints.push({
        fp: { minX: p.x - hx, minY: p.y - hy, maxX: p.x + hx, maxY: p.y + hy, depth: depthOf(p.x, p.y) },
        bounds,
        sprite: p.sprite,
      });
      const small = Math.max(hx, hy) <= BALANCE.walker.smallPropMaxRadius && !p.sprite.startsWith('bld/');
      if (p.solid) this.solids.push({ kind: 'box', x: p.x, y: p.y, hx, hy, r: 0, small });
    } else if (p.shadow.kind === 'obox') {
      const { hx, hy, ang } = p.shadow;
      if (p.solid) this.solids.push({ kind: 'obox', x: p.x, y: p.y, hx, hy, r: 0, ang });
    } else if (p.solid) {
      this.solids.push({
        kind: 'circle',
        x: p.x,
        y: p.y,
        hx: 0,
        hy: 0,
        r: p.shadow.r,
        small: p.shadow.r <= BALANCE.walker.smallPropMaxRadius,
      });
    }
  }

  /** City maps: order every static object topologically (staticDepth.ts) and use the rank as its depth. */
  private sortStatics(): void {
    const items = this.placed.map((pl) => ({ fp: footprintOf(pl.placement), bounds: pl.bounds }));
    const rank = staticOrder(items);
    this.placed.forEach((pl, i) => {
      const d = rank[i] as number;
      pl.sprite.setDepth(d);
      pl.glow?.setDepth(d + 0.001);
      this.statics.push({ fp: items[i]!.fp, depth: d, bounds: pl.bounds });
    });
    const byKey = new Map(this.placed.map((pl, i) => [pl, rank[i] as number]));
    for (const f of this.footprints) {
      const pl = this.placed.find((q) => q.bounds === f.bounds);
      if (pl) f.fp.depth = byKey.get(pl) as number;
    }
  }

  private paddedInfo(base: Placed['info']): Placed['info'] {
    const pad = HIGHLIGHT_PAD;
    return {
      w: base.w + 2 * pad,
      h: base.h + 2 * pad,
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

  /** A rim texture for a sprite with no baked cue frames (cars, doors), made once per state and frame. */
  private runtimeCue(ref: FrameRef, state: 'idle' | 'hover', frame: number, valuable: boolean): string {
    const key = `cue:${ref.atlas}:${ref.frame}:${state}${state === 'idle' ? frame : ''}`;
    if (!this.textures.exists(key)) {
      const base = frameInfo(ref.atlas, ref.frame);
      const hi = highlight(framePixels(this.textures, ref.atlas, ref.frame), state, {
        frame,
        valuable,
        rng: this.rng,
      });
      addPixelsTexture(this.textures, key, hi, { ax: base.ax + HIGHLIGHT_PAD, ay: base.ay + HIGHLIGHT_PAD });
    }
    return key;
  }

  private promptTexture(label: string): string {
    const key = `prompt:E:${label}`;
    if (!this.textures.exists(key)) addPixelsTexture(this.textures, key, promptPixels('E', label));
    return key;
  }

  /** Reference map: the prompts are always shown, exactly as scene.py composes them. */
  private addStaticPrompts(): void {
    for (const pl of this.placed) {
      const pr = pl.placement.prompt;
      if (!pr) continue;
      const key = this.promptTexture(pr[1]);
      const img = this.add.image(0, 0, key).setOrigin(0, 0);
      this.positionPrompt(img, pl.bounds.x + pl.bounds.w / 2, pl.bounds.y - 3);
      this.overlayLayer.add(img);
    }
  }

  private positionPrompt(img: Phaser.GameObjects.Image, cx: number, top: number): void {
    img.setPosition(roundHalfEven(cx - img.width / 2), roundHalfEven(top - img.height));
  }

  private createLamps(): void {
    const tex = lampTextures(this.textures);
    for (const p of this.map.placements) {
      if (!p.lamp) continue;
      // scene.py: the bulb sits 91 units up, 16.5 units along the lamp's local +y from the post; the pool is
      // below it. The arm turns with the lamp's direction.
      const a = (p.dir * Math.PI) / 4;
      const bulb = worldToScreen(p.x - 16.5 * Math.sin(a), p.y + 16.5 * Math.cos(a), 91);
      const pool = this.add
        .image(Math.round(bulb.x), Math.round(bulb.y + 91), tex.pool)
        .setBlendMode(Phaser.BlendModes.ADD);
      pool.setDepth(1e6 - 1).setVisible(false);
      this.groundLayer.add(pool);
      const halo = this.add
        .image(Math.round(bulb.x), Math.round(bulb.y), tex.halo)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setVisible(false);
      this.overlayLayer.add(halo);
      this.lamps.push({ halo, pool });
    }
  }

  // ---------------------------------------------------------------- player

  private createPlayer(): void {
    const costume = this.state.player.costume;
    for (let d = 0; d < 8; d++) {
      const key = `walk-${costume}-${DIRS[d]}`;
      if (this.anims.exists(key)) continue;
      const frames = WALK_CYCLE.map((pose) => {
        const f = characterFrame(costume, pose, d);
        return { key: f.atlas, frame: f.frame };
      });
      this.anims.create({ key, frames, frameRate: BALANCE.walker.walkFps, repeat: -1 });
    }
    const p = this.state.player;
    const ref = characterFrame(costume, 'idle', p.dir);
    this.player = this.add.sprite(0, 0, ref.atlas, ref.frame);
    this.objectLayer.add(this.player);

    // A blob shadow that moves with the player (static shadows are baked into the ground).
    const shape = shadowShape(0, 0, { kind: 'blob', r: BALANCE.walker.radius }, SHADOW_VALUES);
    if (shape.kind === 'ellipse') {
      const rect = { x: shape.x0, y: shape.y0, w: shape.x1 - shape.x0 + 1, h: shape.y1 - shape.y0 + 1 };
      const mask = rasterizeShadows([shape], rect, () => true);
      const data = new Uint8ClampedArray(rect.w * rect.h * 4);
      mask.forEach((v, k) => {
        if (v) data.set([...SHADOW_RGB, shadowAlpha(v, BALANCE.render.shadowStrength)], k * 4);
      });
      addPixelsTexture(
        this.textures,
        'player-shadow',
        { width: rect.w, height: rect.h, data },
        { ax: -rect.x, ay: -rect.y },
      );
      this.playerShadow = this.add.image(0, 0, 'player-shadow').setDepth(1e6);
      this.groundLayer.add(this.playerShadow);
    }
    this.syncPlayer();
  }

  private playerScreen(): { x: number; y: number } {
    return worldToScreen(this.state.player.x, this.state.player.y);
  }

  private get collisionRules(): CollisionRules {
    const W = BALANCE.walker;
    return {
      radius: W.radius,
      mapW: this.map.width * TILE,
      mapH: this.map.height * TILE,
      smallScale: W.smallPropScale,
      smallSlack: W.smallPropSlack,
    };
  }

  private tick(dt: number): void {
    const p = this.state.player;
    if (!this.isReference) {
      this.state.minutes = advance(this.state.minutes, dt, this.settings.dayLengthMinutes);
      // Dez checks in once on the first evening (the HUD mockup's message).
      if (
        !this.dezTold &&
        this.playing &&
        calendar(this.state.minutes).minute >= 17 * 60 + 30 &&
        this.state.minutes < 24 * 60
      ) {
        this.dezTold = true;
        this.game.events.emit('hud:toast', { who: 'DEZ', text: "BACK ROOM'S OPEN AFTER 6." });
      }
    }
    const k = this.keys;
    const sx = (k.right.isDown ? 1 : 0) - (k.left.isDown ? 1 : 0);
    const sy = (k.down.isDown ? 1 : 0) - (k.up.isDown ? 1 : 0);
    if (!this.playing || !this.player || (sx === 0 && sy === 0)) {
      p.moving = false;
      p.sprinting = false;
      return;
    }
    // WASD: the same screen speed in every direction, two-key diagonals along the tile edges (systems/movement.ts)
    p.sprinting = k.sprint.isDown;
    const speed = BALANCE.walker.walkSpeed * (p.sprinting ? BALANCE.walker.sprintMultiplier : 1);
    const v = moveVector(sx, sy, speed) as { x: number; y: number };
    const next = moveWithCollision(p.x, p.y, v.x * dt, v.y * dt, this.solids, this.collisionRules);
    p.x = next.x;
    p.y = next.y;
    p.dir = facingFromWorld(v.x, v.y);
    p.moving = true;
  }

  private syncPlayer(): void {
    if (!this.player) return;
    const p = this.state.player;
    const s = this.playerScreen();
    const x = Math.round(s.x);
    const y = Math.round(s.y);
    this.player.setPosition(x, y);
    this.playerShadow?.setPosition(x, y);
    const anim = `walk-${p.costume}-${DIRS[p.dir]}`;
    if (p.moving) {
      if (this.player.anims.currentAnim?.key !== anim || !this.player.anims.isPlaying) {
        // keep the cycle's phase when turning, so the legs don't snap back to idle
        const progress = this.player.anims.isPlaying ? this.player.anims.getProgress() : 0;
        this.player.play(anim, true);
        this.player.anims.setProgress(progress);
      }
      this.player.anims.timeScale = p.sprinting ? BALANCE.walker.sprintFpsMultiplier : 1;
    } else {
      this.player.stop();
      const ref = characterFrame(p.costume, 'idle', p.dir);
      if (this.player.texture.key !== ref.atlas || this.player.frame.name !== ref.frame)
        this.player.setTexture(ref.atlas, ref.frame);
    }
    const bounds = this.playerBounds();
    if (this.map.ground) {
      const r = BALANCE.walker.radius;
      const fp: Box = [p.x - r, p.y - r, p.x + r, p.y + r];
      const near = this.statics.filter((o) => rectsOverlap(o.bounds, bounds));
      this.player.setDepth(depthAmong(fp, near, -1));
    } else {
      const near = this.footprints.filter((f) => rectsOverlap(f.bounds, bounds)).map((f) => f.fp);
      this.player.setDepth(depthAgainstFootprints(p.x, p.y, near));
    }
  }

  private playerBounds(): Rect {
    const sp = this.player as Phaser.GameObjects.Sprite;
    const f = frameInfo(sp.texture.key as 'characters', sp.frame.name);
    return { x: sp.x - f.ax + f.bounds.x, y: sp.y - f.ay + f.bounds.y, w: f.bounds.w, h: f.bounds.h };
  }

  // ---------------------------------------------------------------- interaction

  private updateInteraction(dt: number): void {
    if (!this.player || !this.playing) return;
    const p = this.state.player;
    const ang = (p.dir * Math.PI) / 4;
    const t = selectTarget(
      this.usables,
      p.x,
      p.y,
      { x: Math.cos(ang), y: Math.sin(ang) },
      BALANCE.interact.rangeTiles * TILE,
      BALANCE.interact.facingWeight,
      this.cycle,
    );
    if (t.inRange.length === 0) this.cycle = 0;
    this.inRange = new Set(t.inRange);
    this.target = t.target;
    this.shimmerClock += dt;
    const frame = Math.floor(this.shimmerClock * BALANCE.render.shimmerFps) % 3;
    for (const u of this.usables) {
      if (!u.placed?.cue) continue;
      const state = u.id === this.target ? 'hover' : this.inRange.has(u.id) ? 'idle' : 'normal';
      const s = u.placed.sprite;
      if (u.placed.cue.kind === 'atlas') {
        const f = interactableFrame(
          u.placed.cue.name,
          state === 'idle' ? (`idle${frame}` as 'idle0') : state,
        );
        if (s.frame.name !== f.frame) s.setFrame(f.frame);
      } else if (state === 'normal') {
        if (s.texture.key !== u.placed.dayFrame.atlas)
          s.setTexture(u.placed.dayFrame.atlas, u.placed.dayFrame.frame);
      } else {
        const key = this.runtimeCue(u.placed.dayFrame, state, frame, u.placed.placement.valuable ?? false);
        if (s.texture.key !== key) s.setTexture(key);
      }
    }
    const tgt = this.usables.find((u) => u.id === this.target);
    if (!tgt) {
      this.prompt?.setVisible(false);
      return;
    }
    const key = this.promptTexture(tgt.label);
    if (!this.prompt) {
      this.prompt = this.add.image(0, 0, key).setOrigin(0, 0);
      this.overlayLayer.add(this.prompt);
    }
    if (this.prompt.texture.key !== key) this.prompt.setTexture(key);
    this.prompt.setVisible(true);
    if (tgt.placed)
      this.positionPrompt(
        this.prompt,
        tgt.placed.bounds.x + tgt.placed.bounds.w / 2,
        tgt.placed.bounds.y - 3,
      );
    else {
      const s = worldToScreen(tgt.x, tgt.y, 52);
      this.positionPrompt(this.prompt, s.x, s.y);
    }
  }

  private use(): void {
    if (!this.playing || !this.target) return;
    const u = this.usables.find((x) => x.id === this.target);
    if (!u) return;
    if (u.door) {
      this.game.events.emit('hud:toast', {
        who: u.door.label.replace(/^ENTER /, ''),
        text: 'INTERIORS OPEN IN THE NEXT UPDATE.',
      });
    } else if (u.id.startsWith('atm')) {
      this.game.events.emit('hud:toast', { who: 'ATM', text: 'BANKING ARRIVES WITH THE PHONE.' });
    }
  }

  // ---------------------------------------------------------------- day / night

  private applyDayNight(force = false): void {
    const d = this.isReference ? 0 : darkness(calendar(this.state.minutes).minute);
    if (!force && Math.abs(d - this.lastDark) < 0.01) return;
    this.lastDark = d;
    const N = BALANCE.dayNight;
    const objTint = tintAt(d, N.objectTint);
    const cueTint = tintAt(d, N.cueTint);
    this.ground.setTint(tintAt(d, N.tileTint));
    const lit = d >= BALANCE.clock.lightsOnDarkness;
    const K = BALANCE.clock;
    const lightAlpha = lit
      ? Math.min(1, K.lightsStartAlpha + (d - K.lightsOnDarkness) / K.lightsRampDarkness)
      : 0;
    for (const pl of this.placed) {
      pl.sprite.setTint(pl.cue && this.inRange.has(pl.placement.interact?.id ?? '') ? cueTint : objTint);
      if (pl.nightFrame) {
        const want = lit ? pl.nightFrame : pl.dayFrame;
        if (pl.sprite.frame.name !== want.frame) pl.sprite.setFrame(want.frame);
        pl.glow?.setVisible(lit).setAlpha(lightAlpha);
      }
    }
    this.player?.setTint(objTint);
    for (const l of this.lamps) {
      l.pool.setVisible(lit).setAlpha(lightAlpha * N.lampGlow);
      l.halo.setVisible(lit).setAlpha(lightAlpha * N.lampGlow);
    }
    const bg = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(BG_DAY),
      Phaser.Display.Color.ValueToColor(BG_NIGHT),
      100,
      Math.round(d * 100),
    );
    this.cameras.main.setBackgroundColor(Phaser.Display.Color.GetColor(bg.r, bg.g, bg.b));
  }

  // ---------------------------------------------------------------- per frame

  private updateOcclusion(dt: number): void {
    if (!this.player) return;
    const target = this.playerBounds();
    const { occludedAlpha, occluderMinHeight } = BALANCE.render;
    for (const pl of this.placed) {
      const occ = isOccluding(
        { bounds: pl.bounds, depth: pl.sprite.depth, height: pl.height },
        target,
        this.player.depth,
        occluderMinHeight,
      );
      const want = occ ? occludedAlpha : 1;
      const a = pl.sprite.alpha + (want - pl.sprite.alpha) * Math.min(1, dt * 10);
      const alpha = Math.abs(a - want) < 0.01 ? want : a;
      pl.sprite.setAlpha(alpha);
      if (pl.glow) pl.glow.setAlpha(Math.min(pl.glow.alpha, alpha));
    }
  }

  private updateStreet(): void {
    const p = this.state.player;
    const streets = this.map.streets ?? [];
    const inside = (s: (typeof streets)[number]) => p.x >= s.x0 && p.x < s.x1 && p.y >= s.y0 && p.y < s.y1;
    const current = streets.find((s) => s.name === this.street && inside(s)) ?? streets.find(inside);
    const name = current?.name ?? null;
    if (name !== this.street) {
      this.street = name;
      if (name) this.game.events.emit('hud:street', name);
    }
  }

  private drawDebug(): void {
    const g = this.debugGfx;
    g.clear();
    if (!this.debugOn) return;
    g.lineStyle(1, PAL.red3, 1);
    for (const s of this.solids) {
      if (s.kind === 'box') {
        const pts = [
          { x: s.x - s.hx, y: s.y - s.hy },
          { x: s.x + s.hx, y: s.y - s.hy },
          { x: s.x + s.hx, y: s.y + s.hy },
          { x: s.x - s.hx, y: s.y + s.hy },
        ].map((q) => worldToScreen(q.x, q.y));
        g.strokePoints(pts, true);
      } else if (s.kind === 'obox') {
        const ca = Math.cos(s.ang ?? 0);
        const sa = Math.sin(s.ang ?? 0);
        const pts = [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(([a, b]) => {
          const u = (a as number) * s.hx;
          const v = (b as number) * s.hy;
          return worldToScreen(s.x + ca * u - sa * v, s.y + sa * u + ca * v);
        });
        g.strokePoints(pts, true);
      } else {
        const c = worldToScreen(s.x, s.y);
        g.strokeEllipse(c.x, c.y, s.r * 2 * Math.SQRT2, s.r * Math.SQRT2);
      }
    }
    g.lineStyle(1, PAL.cream, 1);
    for (const u of this.usables) {
      const c = worldToScreen(u.x, u.y);
      g.strokeEllipse(
        c.x,
        c.y,
        BALANCE.interact.rangeTiles * TILE * 2 * Math.SQRT2,
        BALANCE.interact.rangeTiles * TILE * Math.SQRT2,
      );
    }
    if (this.player) {
      const c = this.playerScreen();
      g.strokeEllipse(c.x, c.y, BALANCE.walker.radius * 2 * Math.SQRT2, BALANCE.walker.radius * Math.SQRT2);
    }
  }

  update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    // The simulation runs on real elapsed time (capped by the fixed step), not Phaser's smoothed delta,
    // which is clamped to 1/60 s per frame whenever the page is unfocused or frames run slow.
    this.step.advance(this.game.loop.rawDelta / 1000, (h) => this.tick(h));
    this.syncPlayer();
    this.updateInteraction(dt);
    this.updateOcclusion(dt);
    this.applyDayNight();
    this.updateStreet();
    this.camCtl.update(dt);
    this.ground.update(this.camCtl.view());
    this.drawDebug();

    const h = hook();
    h.zoom = this.camCtl.zoom;
    h.fps = this.game.loop.actualFps;
    h.pan = this.camCtl.panOffset;
    h.minutes = this.state.minutes;
    h.target = this.target;
    const p = this.state.player;
    if (this.player) h.walker = { x: p.x, y: p.y, depth: this.player.depth, dir: DIRS[p.dir] as string };
    const tile = worldToTile(p.x, p.y);
    this.game.events.emit('debug:stats', {
      fps: this.game.loop.actualFps,
      zoom: this.camCtl.zoom,
      x: p.x,
      y: p.y,
      i: tile.i,
      j: tile.j,
      depth: this.player?.depth ?? 0,
      chunks: this.ground.bakedCount(),
      pan: this.camCtl.panOffset,
    });
    if (!this.isReference) {
      const fw = worldToScreen(Math.cos((p.dir * Math.PI) / 4), Math.sin((p.dir * Math.PI) / 4));
      const snap: HudSnapshot = {
        px: p.x,
        py: p.y,
        heading: Math.atan2(fw.y, fw.x),
        minutes: this.state.minutes,
        money: this.state.money,
        stars: this.state.wanted.stars,
        health: p.health / BALANCE.player.maxHealth,
        armor: p.armor,
        district: this.map.name ?? '',
        street: this.street,
        map: this.map,
        buildings: this.radarBuildings,
        doors: this.map.doors ?? [],
        target: this.target,
      };
      this.game.events.emit('hud:frame', snap);
    }
  }
}
