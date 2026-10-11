// The outdoor world: ground, buildings and props, the player, the camera, interaction, and day/night.
// Phase 1 milestone 1 shows Downtown; ?scene=reference shows the Phase 0 reference test map instead.

import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { BG_DAY, DIRS, PAL, SHADOW_RGB, TILE } from '../config/constants';
import { KEYS } from '../config/keys';
import { FixedStep } from '../core/clock';
import { Rng } from '../core/rng';
import { createState, loadSettings, saveSettings, type GameState, type Settings } from '../core/store';
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
import { advance, calendar, darkness, sleepUntil, tintAt } from '../systems/clock';
import {
  clockIn,
  clockOut,
  hasKeyCard,
  rankTitle,
  recordTask,
  tasksLeft,
  type Grade,
} from '../systems/career';
import { INTERIORS, interiorForDoor, isOpen, type InteriorDef, type InteriorId } from '../data/interiors';
import { TASK_NAMES, type TaskId } from '../data/jobs';
import { ATLASES } from '../assets/manifest';
import {
  createDoors,
  doorPrompt,
  interiorSolids,
  npcOnDuty,
  useSpots,
  type DoorRuntime,
  type InteriorJson,
  type UseSpot,
} from '../world/interiorModel';
import { InteriorView } from '../world/interiorView';
import { VIS } from '../systems/sight';
import type { MinigameRequest, MinigameResult } from './MinigameScene';
import type { Wallet } from '../systems/shop';
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

/** Something E can be used on: a placed object, a street door, or a spot inside an interior. */
interface Usable {
  id: string;
  x: number;
  y: number;
  label: string;
  placed: Placed | null;
  door: Door | null;
  spot?: UseSpot;
  /** The label shows in red: a requirement isn't met. */
  blocked?: boolean;
}

/** An interior while the player is in it. */
interface InteriorRun {
  def: InteriorDef;
  json: InteriorJson;
  view: InteriorView;
  doors: DoorRuntime[];
  npcs: boolean[];
}

/** What the street keeps while the player is inside. */
interface StreetSaved {
  placed: Placed[];
  footprints: { fp: Footprint; bounds: Rect; sprite: string }[];
  solids: Solid[];
  usables: Usable[];
  statics: { fp: Box; depth: number; bounds: Rect }[];
}

const INTERIOR_BG = 0x241c28;

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
  objective: string;
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
  private inside: InteriorRun | null = null;
  private streetSaved: StreetSaved | null = null;
  private inGround!: Phaser.GameObjects.Layer;
  private inObjects!: Phaser.GameObjects.Layer;
  private busy = false;
  private lastNpcMinute = -1;

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
    this.inGround = this.add.layer().setDepth(0).setVisible(false);
    this.inObjects = this.add.layer().setDepth(1).setVisible(false);
    if (this.params.sight !== null) this.settings.sightLines = this.params.sight;

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
    const onDone = (r: MinigameResult) => this.minigameDone(r);
    this.game.events.on('minigame:done', onDone);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off('minigame:done', onDone));
    const startIn = this.params.area as InteriorId | null;
    if (startIn && INTERIORS[startIn] && !this.isReference) {
      const def = INTERIORS[startIn];
      const door = (this.map.doors ?? []).find((d) => d.target === def.street) ?? this.map.doors?.[0];
      this.state.streetReturn = door ? { x: door.x, y: door.y + 12 } : { ...this.map.spawn };
      this.enterInterior(def, this.params.spawn ?? def.entrance ?? def.elevator ?? { x: 40, y: 40 });
    }
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
    kb.on(`keydown-${KEYS.sightLines}`, () => {
      this.settings.sightLines = !this.settings.sightLines;
      saveSettings(this.settings);
      this.game.events.emit('hud:toast', {
        who: 'SETTINGS',
        text: this.settings.sightLines ? 'SIGHT LINES ON' : 'SIGHT LINES OFF: EVERY ROOM VISIBLE',
      });
    });
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

  private promptTexture(label: string, blocked = false): string {
    const key = `prompt:E:${label}:${blocked ? 'red' : ''}`;
    if (!this.textures.exists(key)) addPixelsTexture(this.textures, key, promptPixels('E', label, blocked));
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
      mapW: this.inside ? this.inside.json.W : this.map.width * TILE,
      mapH: this.inside ? this.inside.json.D : this.map.height * TILE,
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
    if (this.inside && Math.floor(this.state.minutes) !== this.lastNpcMinute) {
      this.lastNpcMinute = Math.floor(this.state.minutes);
      this.updateNpcs();
      if (this.lastNpcMinute % 10 === 0) this.updateInteriorObjective();
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
    if (this.inside) {
      const near = this.inside.view.footprints.filter((f) => rectsOverlap(f.bounds, bounds)).map((f) => f.fp);
      this.player.setDepth(depthAgainstFootprints(p.x, p.y, near));
    } else if (this.map.ground) {
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
    if (this.inside) this.refreshInteriorLabels();
    // with sight lines on, nothing in a room you can't see can be used (doors stand between rooms: always)
    const view = this.inside?.view;
    const usable = view
      ? this.usables.filter((u) => u.spot?.kind === 'door' || view.stateAt(u.x, u.y) === VIS)
      : this.usables;
    const t = selectTarget(
      usable,
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
    const key = this.promptTexture(tgt.label, tgt.blocked ?? false);
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
    if (u.door) this.tryEnter(u.door);
    else if (u.spot) this.useSpot(u.spot);
    else if (u.id.startsWith('atm')) {
      this.game.events.emit('hud:toast', { who: 'ATM', text: 'BANKING ARRIVES WITH THE PHONE.' });
    }
  }

  // ---------------------------------------------------------------- interiors (docs/18)

  private toast(who: string, text: string): void {
    this.game.events.emit('hud:toast', { who, text });
  }

  private objectiveText = 'EXPLORE THE LEDGER (DOWNTOWN)';

  private objective(text: string): void {
    this.objectiveText = text;
  }

  private minuteOfDay(): number {
    return calendar(this.state.minutes).minute;
  }

  /** Street door: opening hours, the key card after hours, and Marlo, who only deals in cars. */
  private tryEnter(door: Door): void {
    if (this.busy) return;
    const def = interiorForDoor(door.target);
    if (!def) {
      this.toast('MARLO', 'COME BACK WITH A CAR.');
      return;
    }
    const open = isOpen(def.hours, this.minuteOfDay());
    const keyCard = def.id === 'tower_lobby' && hasKeyCard(this.state.career);
    if (!open && !keyCard) {
      const h = def.hours as { from: number; to: number };
      const hhmm = (m: number) =>
        `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      this.toast(def.name, `CLOSED. OPEN ${hhmm(h.from)} TO ${hhmm(h.to)}.`);
      return;
    }
    this.state.streetReturn = { x: door.x, y: door.y + 12 };
    this.fade(() => this.enterInterior(def, def.entrance ?? { x: 40, y: 40 }));
  }

  /** Fade out, run `mid`, fade back in (docs/18: about 0.3 s). */
  private fade(mid: () => void): void {
    this.busy = true;
    const half = BALANCE.interiors.fadeMs / 2;
    const cam = this.cameras.main;
    cam.fadeOut(half, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      mid();
      cam.fadeIn(half, 0, 0, 0);
      this.busy = false;
    });
  }

  private npcsOnDuty(def: InteriorDef, json: InteriorJson): boolean[] {
    const m = this.minuteOfDay();
    return json.npcs.map((_, i) => npcOnDuty(def.npcs[i]?.hours ?? null, m));
  }

  private enterInterior(def: InteriorDef, at: { x: number; y: number }): void {
    if (this.inside) this.leaveInteriorView();
    else {
      this.streetSaved = {
        placed: this.placed,
        footprints: this.footprints,
        solids: this.solids,
        usables: this.usables,
        statics: this.statics,
      };
      this.groundLayer.setVisible(false);
      this.objectLayer.setVisible(false);
      for (const l of this.lamps) l.halo.setVisible(false);
    }
    const json = ATLASES[`in_${def.id}` as keyof typeof ATLASES].json as unknown as InteriorJson;
    this.inGround.setVisible(true);
    this.inObjects.setVisible(true);
    const view = new InteriorView(this, json, def, this.inGround, this.inObjects);
    const doors = createDoors(json, def);
    const npcs = this.npcsOnDuty(def, json);
    this.inside = { def, json, view, doors, npcs };
    this.state.area = { kind: 'interior', id: def.id };
    if (this.player) {
      this.objectLayer.remove(this.player);
      this.inObjects.add(this.player);
      if (this.playerShadow) {
        this.groundLayer.remove(this.playerShadow);
        this.inGround.add(this.playerShadow);
      }
    }
    // the interior's own objects become the scene's
    this.placed = view.placed.map((pl) => this.placedFromInterior(pl, json));
    this.footprints = [];
    this.statics = [];
    this.usables = useSpots(json, def, doors).map((spot) => ({
      id: spot.id,
      x: spot.x,
      y: spot.y,
      label: spot.kind === 'exit' ? 'EXIT TO STREET' : spot.kind === 'action' ? spot.label : 'OPEN DOOR',
      placed:
        spot.kind === 'action'
          ? (this.placed.find((pl) => pl.placement.interact?.id === spot.id) ?? null)
          : spot.kind === 'door'
            ? (this.placed.find((pl) => pl.placement.interact?.id === spot.id) ?? null)
            : null,
      door: null,
      spot,
    }));
    this.worldChanged();
    const p = this.state.player;
    p.x = at.x;
    p.y = at.y;
    p.dir = 6;
    p.moving = false;
    this.lastNpcMinute = Math.floor(this.state.minutes);
    this.camCtl.setBounds(view.bounds);
    this.syncPlayer();
    this.camCtl.snap();
    this.lastDark = -1;
    this.applyDayNight(true);
    this.game.events.emit('hud:street', def.name);
    this.updateInteriorObjective();
  }

  private placedFromInterior(pl: InteriorView['placed'][number], json: InteriorJson): Placed {
    const it = json.items[pl.item] as InteriorJson['items'][number];
    const f = frameInfo(pl.frame.atlas, pl.frame.frame);
    const id = it.door ? null : `${json.id}:${pl.item}`;
    const doorIdx = it.door ? json.items.filter((x, k) => x.door && k < pl.item).length : -1;
    return {
      placement: {
        sprite: `int/${it.kind}`,
        dir: 0,
        x: it.x,
        y: it.y,
        shadow: { kind: 'blob', r: 0 },
        valuable: it.valuable,
        interact: it.door
          ? { id: `${json.id}:door${doorIdx}`, label: '' }
          : it.prompt
            ? { id: id as string, label: '' }
            : undefined,
      },
      sprite: pl.sprite,
      info: f,
      bounds: pl.bounds,
      height: pl.height,
      dayFrame: pl.frame,
      nightFrame: null,
      glow: null,
      cue: it.prompt || it.door ? { kind: 'runtime' } : null,
    };
  }

  /** Doors or NPCs changed: rebuild collision and redraw. */
  private worldChanged(): void {
    const r = this.inside;
    if (!r) return;
    this.solids = interiorSolids(r.json, r.doors, r.npcs, BALANCE.walker.radius);
    r.view.setWorld(r.doors, r.npcs);
  }

  private leaveInteriorView(): void {
    const r = this.inside;
    if (!r) return;
    if (this.player) this.inObjects.remove(this.player);
    if (this.playerShadow) this.inGround.remove(this.playerShadow);
    r.view.destroy();
    this.inside = null;
  }

  private exitToStreet(): void {
    const back = this.streetSaved;
    if (!back) return;
    this.leaveInteriorView();
    this.inGround.setVisible(false);
    this.inObjects.setVisible(false);
    this.groundLayer.setVisible(true);
    this.objectLayer.setVisible(true);
    Object.assign(this, back);
    this.streetSaved = null;
    if (this.player) {
      this.objectLayer.add(this.player);
      if (this.playerShadow) this.groundLayer.add(this.playerShadow);
    }
    const p = this.state.player;
    const at = this.state.streetReturn ?? this.map.spawn;
    p.x = at.x;
    p.y = at.y;
    p.dir = 2;
    this.state.area = { kind: 'street' };
    this.camCtl.setBounds(this.ground.bounds);
    this.syncPlayer();
    this.camCtl.snap();
    this.street = null;
    this.lastDark = -1;
    this.applyDayNight(true);
    this.updateInteriorObjective();
  }

  /** Door and clock-in labels change with the time of day and the shift. */
  private refreshInteriorLabels(): void {
    const r = this.inside;
    if (!r) return;
    const ctx = { minuteOfDay: this.minuteOfDay(), keyCard: hasKeyCard(this.state.career) };
    for (const u of this.usables) {
      const sp = u.spot;
      if (!sp) continue;
      if (sp.kind === 'door') {
        const d = doorPrompt(r.doors[sp.door] as DoorRuntime, ctx);
        u.label = d.label;
        u.blocked = d.blocked;
      } else if (sp.kind === 'action' && sp.action.kind === 'clock') {
        const c = this.state.career;
        u.label = c.shift ? (tasksLeft(c) === 0 ? 'CLOCK OUT' : `TASKS LEFT: ${tasksLeft(c)}`) : 'CLOCK IN';
        u.blocked = !!c.shift && tasksLeft(c) > 0;
      }
    }
  }

  private useSpot(spot: UseSpot): void {
    const r = this.inside;
    if (!r || this.busy) return;
    if (spot.kind === 'exit') {
      this.fade(() => this.exitToStreet());
      return;
    }
    if (spot.kind === 'door') {
      const d = r.doors[spot.door] as DoorRuntime;
      const pr = doorPrompt(d, { minuteOfDay: this.minuteOfDay(), keyCard: hasKeyCard(this.state.career) });
      if (pr.blocked) {
        this.toast('DOOR', pr.label);
        return;
      }
      d.open = !d.open;
      // don't shut a door on the player standing in it
      if (!d.open && this.solidsWouldTrapPlayer()) d.open = true;
      this.worldChanged();
      return;
    }
    const a = spot.action;
    switch (a.kind) {
      case 'later':
        this.toast(a.who, a.text);
        break;
      case 'elevator': {
        const to = INTERIORS[a.to];
        this.fade(() => this.enterInterior(to, to.elevator ?? to.entrance ?? { x: 40, y: 40 }));
        break;
      }
      case 'sleep':
        this.sleep();
        break;
      case 'shop':
        this.openMinigame({ kind: 'shop', title: r.def.name, wallet: this.wallet() });
        break;
      case 'clock':
        this.clockAction();
        break;
      case 'job':
        this.jobTask(a.task);
        break;
    }
  }

  private solidsWouldTrapPlayer(): boolean {
    const r = this.inside;
    if (!r) return false;
    const solids = interiorSolids(r.json, r.doors, r.npcs, BALANCE.walker.radius);
    const p = this.state.player;
    const rules = this.collisionRules;
    return solids.some(
      (s) =>
        s.kind === 'box' &&
        Math.abs(p.x - s.x) <= s.hx + rules.radius &&
        Math.abs(p.y - s.y) <= s.hy + rules.radius,
    );
  }

  private sleep(): void {
    this.fade(() => {
      this.state.minutes = sleepUntil(this.state.minutes, BALANCE.sleep.wakeMinute);
      const cal = calendar(this.state.minutes);
      this.toast('HOME', `SLEPT UNTIL 06:00, ${cal.weekday}. SAVING ARRIVES IN MILESTONE 4.`);
      this.lastDark = -1;
      this.updateNpcs(true);
      this.updateInteriorObjective();
    });
  }

  private clockAction(): void {
    const c = this.state.career;
    if (c.shift) {
      const left = tasksLeft(c);
      if (left > 0) {
        this.toast('MS. HOLLIS', `${left} TASK${left > 1 ? 'S' : ''} LEFT. FILING CABINETS OR YOUR DESK.`);
        return;
      }
      const res = clockOut(c);
      if (!res) return;
      this.state.money.clean += res.pay + res.bonus;
      this.toast('MS. HOLLIS', `GOOD WORK. +$${res.pay} CLEAN, +${res.xp} XP.`);
      if (res.promoted)
        this.time.delayedCall(2200, () =>
          this.toast(
            'MS. HOLLIS',
            `PROMOTED TO ${rankTitle(c)}! +$${res.bonus} BONUS.${hasKeyCard(c) ? ' HERE IS YOUR KEY CARD.' : ''}`,
          ),
        );
      this.updateInteriorObjective();
      return;
    }
    const r = clockIn(c, this.state.minutes);
    if (r.ok) {
      this.toast('MS. HOLLIS', r.late ? "YOU'RE LATE. THAT'S 80% PAY TODAY." : 'MORNING. THREE TASKS TODAY.');
    } else {
      const why: Record<typeof r.reason, string> = {
        weekend: "IT'S THE WEEKEND. GO HOME.",
        early: 'CLOCK-IN OPENS AT 08:00.',
        tooLate: 'CLOCK-IN CLOSED AT 10:00. TRY TOMORROW.',
        alreadyWorked: 'YOU ALREADY WORKED TODAY.',
        onShift: 'YOU ARE ALREADY ON SHIFT.',
      };
      this.toast('MS. HOLLIS', why[r.reason]);
    }
    this.updateInteriorObjective();
  }

  private jobTask(task: TaskId): void {
    const c = this.state.career;
    if (!c.shift) {
      this.toast('MS. HOLLIS', 'CLOCK IN WITH ME FIRST. MY OFFICE, BACK RIGHT.');
      return;
    }
    if (tasksLeft(c) === 0) {
      this.toast('MS. HOLLIS', "THAT'S ENOUGH FOR TODAY. CLOCK OUT WITH ME.");
      return;
    }
    const done = 3 - tasksLeft(c);
    this.pendingTask = task;
    this.openMinigame({ kind: task, seed: this.rng.int(1, 2 ** 30), task: `TASK ${done + 1}/3` });
  }

  private pendingTask: TaskId | null = null;

  /** Money, health and inventory as the shop sees them (health lives on the player). */
  private wallet(): Wallet {
    const p = this.state.player;
    return {
      money: this.state.money,
      inventory: this.state.inventory,
      get health() {
        return p.health;
      },
      set health(v: number) {
        p.health = v;
      },
    };
  }

  private openMinigame(req: MinigameRequest): void {
    this.prompt?.setVisible(false);
    hook().minigame = req.kind;
    this.scene.pause();
    this.scene.launch('minigame', req);
  }

  private minigameDone(r: MinigameResult): void {
    hook().minigame = null;
    this.scene.resume();
    if ((r.kind === 'filing' || r.kind === 'dataEntry') && this.pendingTask) {
      const task = this.pendingTask;
      this.pendingTask = null;
      if (r.grade) {
        recordTask(this.state.career, task, r.grade as Grade);
        const left = tasksLeft(this.state.career);
        this.toast(
          TASK_NAMES[task],
          left > 0
            ? `${r.grade.toUpperCase()}. ${left} TO GO.`
            : `${r.grade.toUpperCase()}. CLOCK OUT WITH MS. HOLLIS.`,
        );
      }
      this.updateInteriorObjective();
    }
  }

  private updateInteriorObjective(): void {
    const c = this.state.career;
    if (c.shift) {
      const left = tasksLeft(c);
      this.objective(
        left > 0
          ? `DO ${left} MORE TASK${left > 1 ? 'S' : ''}: FILING CABINETS OR YOUR DESK`
          : 'CLOCK OUT WITH MS. HOLLIS',
      );
      return;
    }
    const m = this.minuteOfDay();
    const workday = BALANCE.careers.workdays.includes((calendar(this.state.minutes).day - 1) % 7);
    if (workday && c.lastShiftDay !== calendar(this.state.minutes).day && m < BALANCE.careers.clockInUntil)
      this.objective(
        this.inside?.def.id === 'office_floor'
          ? 'CLOCK IN WITH MS. HOLLIS (08:00-10:00)'
          : 'GO TO WORK: PELLRIDGE TOWER, FLOOR 4 (08:00-10:00)',
      );
    else
      this.objective(
        m >= 20 * 60 || m < 6 * 60
          ? 'GO HOME AND SLEEP: DRIZZLE ROW RESIDENCES'
          : 'EXPLORE THE LEDGER (DOWNTOWN)',
      );
  }

  /** NPCs come and go with their hours. */
  private updateNpcs(force = false): void {
    const r = this.inside;
    if (!r) return;
    const now = this.npcsOnDuty(r.def, r.json);
    if (force || now.some((v, i) => v !== r.npcs[i])) {
      r.npcs = now;
      this.worldChanged();
    }
  }

  // ---------------------------------------------------------------- day / night

  private applyDayNight(force = false): void {
    if (this.inside) {
      // interiors don't take the outdoor night tint (docs/18)
      if (!force) return;
      for (const pl of this.placed) pl.sprite.clearTint();
      this.player?.clearTint();
      this.cameras.main.setBackgroundColor(INTERIOR_BG);
      return;
    }
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
    if (this.inside) {
      const r = this.inside;
      const seen = new Set(this.state.sight[r.def.id] ?? []);
      const vis = r.view.updateSight(this.state.player, r.doors, seen, this.settings.sightLines);
      if (vis) {
        for (const room of vis) seen.add(room);
        this.state.sight[r.def.id] = [...seen];
      }
      r.view.tick(dt);
    } else this.updateStreet();
    this.camCtl.update(dt);
    if (!this.inside) this.ground.update(this.camCtl.view());
    this.drawDebug();

    const h = hook();
    h.zoom = this.camCtl.zoom;
    h.fps = this.game.loop.actualFps;
    h.pan = this.camCtl.panOffset;
    h.minutes = this.state.minutes;
    h.target = this.target;
    const p = this.state.player;
    if (this.player) h.walker = { x: p.x, y: p.y, depth: this.player.depth, dir: DIRS[p.dir] as string };
    h.area = this.inside ? this.inside.def.id : 'street';
    h.clean = this.state.money.clean;
    h.rank = this.state.career.jobs.office.rank;
    h.tasksLeft = this.state.career.shift ? tasksLeft(this.state.career) : -1;
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
      // inside, the radar shows where the building stands on the street
      const onMap = this.inside ? (this.state.streetReturn ?? p) : p;
      const snap: HudSnapshot = {
        px: onMap.x,
        py: onMap.y,
        heading: Math.atan2(fw.y, fw.x),
        minutes: this.state.minutes,
        money: this.state.money,
        stars: this.state.wanted.stars,
        health: p.health / BALANCE.player.maxHealth,
        armor: p.armor,
        district: this.map.name ?? '',
        street: this.inside ? this.inside.def.name : this.street,
        map: this.map,
        buildings: this.radarBuildings,
        doors: this.map.doors ?? [],
        target: this.target,
        objective: this.objectiveText,
      };
      this.game.events.emit('hud:frame', snap);
    }
  }
}
