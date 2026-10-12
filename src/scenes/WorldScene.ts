// The outdoor world: ground, buildings and props, the player, the camera, interaction, and day/night.
// Phase 1 milestone 1 shows Downtown; ?scene=reference shows the Phase 0 reference test map instead.

import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { BG_DAY, DIRS, PAL, SHADOW_RGB, TILE, UI_BASE_H, UI_BASE_W } from '../config/constants';
import { KEYS } from '../config/keys';
import { FixedStep } from '../core/clock';
import { Rng } from '../core/rng';
import { createState, loadSettings, saveSettings, type GameState, type Settings } from '../core/store';
import { framePixels, frameInfo, opaqueAt } from '../assets/atlasLoader';
import type { AtlasKey } from '../assets/manifest';
import { highlight, HIGHLIGHT_PAD } from '../assets/highlight';
import { outlinePixels } from '../assets/outline';
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
import { coverage, rectsOverlap, type MaskedSprite } from '../iso/occlusion';
import { Silhouette } from '../world/silhouette';
import { StreetLife } from '../world/streetLife';
import { Police } from '../world/police';
import { buildRoads, type RoadGraph } from '../systems/roads';
import { startFlee } from '../systems/crowd';
import {
  addStars,
  arrest,
  canSee,
  emptyWanted,
  reportCrime,
  searchRadius,
  tickWanted,
} from '../systems/wanted';
import { typeOfModel } from '../data/vehicles';
import { facingFromWorld, roundHalfEven, worldToScreen, worldToTile } from '../iso/projection';
import { rasterizeShadows, shadowAlpha, shadowShape, type Rect } from '../iso/shadows';
import { GroundRenderer } from '../iso/tilemap';
import { VectorGroundRenderer } from '../iso/vectorGroundRenderer';
import { depthAmong, depthRange, obbFirst, staticOrder, type Box, type Obb } from '../iso/staticDepth';
import { DOWNTOWN } from '../maps/downtown';
import { tileSeed as referenceSeed, TEST_MAP } from '../maps/testMap';
import type { Door, MapData, Placement } from '../maps/types';
import { advance, calendar, darkness, sleepUntil, tintAt } from '../systems/clock';
import {
  arrestEffects,
  clockIn,
  clockOut,
  hasKeyCard,
  rankTitle,
  recordTask,
  tasksLeft,
  type Grade,
} from '../systems/career';
import { runCalendar } from '../systems/days';
import { credit } from '../systems/finance';
import { rollTrunk, takeLoot, type LootItem } from '../systems/loot';
import { lockTool, wearLockpicks } from '../systems/shop';
import { atmPage, bagPage, phoneRoot, PHONE_SENDERS, type PhoneCtx } from '../world/phone';
import type { ListRequest } from './ListScene';
import { INTERIORS, interiorForDoor, isOpen, type InteriorDef, type InteriorId } from '../data/interiors';
import { JOBS, TASK_NAMES, type TaskId } from '../data/jobs';
import { TYPE_LABEL } from '../data/vehicles';
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
import { capLeft, launder } from '../systems/laundering';
import {
  chopPrice,
  dirOf,
  distToCar,
  drive,
  exitSpots,
  parkAtHome,
  parkedCar,
  parkedIn,
  stats,
  pourCan,
  refuel,
  needsRepair,
  repairKit,
  topSpeed,
  trunkSpot,
  vehicleSolid,
  type Vehicle,
} from '../systems/vehicle';
import { selectTarget } from '../systems/interaction';
import {
  collides,
  moveVector,
  moveWithCollision,
  type CollisionRules,
  type Solid,
} from '../systems/movement';
import { promptPixels } from '../ui/promptPlate';
import { hook } from '../debug/hooks';
import type { Params } from '../debug/params';
import { makeSave, nextAutoSlot, type SaveFile, type SaveMeta, type SlotId } from '../core/save';
import { askPersist, saveStore } from '../core/storage';
import { CHEAT_HELP, parseCheat } from '../debug/cheats';
import { CheatConsole } from '../debug/cheatConsole';
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
  /** Key shown on the prompt (E unless said otherwise). */
  key?: string;
  /** Not usable right now and not shown (Marlo's spot with no car in it). */
  hidden?: boolean;
}

/** A drivable car on the street: its state lives in GameState.vehicles, this is how it is drawn. */
interface CarView {
  v: Vehicle;
  placed: Placed;
  shadow: Phaser.GameObjects.Image;
  usable: Usable;
  /** LOOT TRUNK at the car's rear (docs/04 trunk looting). */
  trunk: Usable;
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
  statics: { fp: Box; depth: number; bounds: Rect; over?: boolean }[];
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
  /** The car being driven (fractions 0–1), or null on foot. */
  vehicle: { type: string; fuel: number; health: number; speed: number } | null;
  /** Wanted and out of sight: the stars flash and the radar shows the search circle (docs/05, docs/11). */
  starsFlash: boolean;
  search: { x: number; y: number; r: number } | null;
  police: { x: number; y: number }[];
  /** An officer is busting the player: the surrender prompt. */
  surrender: boolean;
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
  private statics: { fp: Box; depth: number; bounds: Rect; over?: boolean }[] = [];
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
    'up' | 'down' | 'left' | 'right' | 'sprint' | 'recenter' | 'use' | 'cycle' | 'vehicle' | 'handbrake',
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
  private cars: CarView[] = [];
  /** Camera look-ahead while driving, in world units (docs/11). */
  private lead = { x: 0, y: 0 };
  /** The car a crime minigame (lockpick, hotwire) is about. */
  private pendingCar: string | null = null;
  private launderPending = false;
  private resumedAt = -1e9;
  private toldOutOfFuel = false;

  constructor() {
    super('world');
  }

  init(params: Params): void {
    this.params = params;
    this.settings = loadSettings();
    this.rng = new Rng(params.seed);
    this.map = params.scene === 'reference' ? TEST_MAP : DOWNTOWN;
    // a save chosen in the menu (scenes/MenuScene.ts) restarts this scene with its state
    const loaded = this.registry.get('pendingLoad') as SaveFile | undefined;
    this.registry.remove('pendingLoad');
    this.loaded = loaded ?? null;
    this.state = loaded
      ? (JSON.parse(JSON.stringify(loaded.state)) as GameState)
      : createState(params.seed, this.map.id, params.spawn ?? this.map.spawn, params.minute ?? undefined);
    this.placed = [];
    this.statics = [];
    this.footprints = [];
    this.solids = [];
    this.usables = [];
    this.lamps = [];
    this.cars = [];
    this.lastDark = -1;
    this.playing = params.scene !== 'title' || loaded !== undefined;
  }

  /** The save this scene was started from, if any. */
  private loaded: SaveFile | null = null;

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

    // parked cars can drive away, so they cast a moving shadow instead of a baked one
    const shapes = this.map.placements
      .filter((p) => !p.parked)
      .map((p) => shadowShape(p.x, p.y, p.shadow, SHADOW_VALUES));
    const seedFor = this.isReference ? referenceSeed : (i: number, j: number) => (i * 31 + j * 17) % 7;
    this.ground = this.map.ground
      ? new VectorGroundRenderer(this, this.map, shapes, this.groundLayer)
      : new GroundRenderer(this, this.map, seedFor, shapes, this.groundLayer);

    for (const p of this.map.placements) if (!p.parked) this.place(p);
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
      for (const z of this.map.zones ?? []) {
        // Marlo's dotted spot shows only with a car in it; the shelter is at the chapel's door
        if (z.id === 'marlo_spot')
          this.usables.push({
            id: `zone:${z.id}`,
            x: (z.x0 + z.x1) / 2,
            y: (z.y0 + z.y1) / 2,
            label: 'SELL CAR TO MARLO',
            placed: null,
            door: null,
            hidden: true,
          });
        else if (z.id === 'shelter' && z.npc)
          this.usables.push({
            id: 'zone:shelter',
            x: z.npc.x,
            y: z.npc.y,
            label: 'SLEEP (SHELTER)',
            placed: null,
            door: null,
          });
      }
      this.createEntranceOutlines();
      this.createPlayer();
      this.createCars();
      this.createLamps();
      this.createStreetLife();
    }

    this.debugGfx = this.add.graphics();
    this.overlayLayer.add(this.debugGfx);
    if (!this.isReference) this.silhouette = new Silhouette(this, this.overlayLayer);
    this.setupInput();

    const bounds = this.placed.reduce((r, p) => unionRect(r, p.bounds), this.ground.bounds);
    const target = this.isReference
      ? () => ({ x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 })
      : () => this.cameraTarget();
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
    const onToast = (m: { who: string; text: string }) => this.logMessage(m.who, m.text);
    this.game.events.on('hud:toast', onToast);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('minigame:done', onDone);
      this.game.events.off('hud:toast', onToast);
    });
    if (this.loaded) {
      const area = this.state.area;
      if (area.kind === 'interior' && INTERIORS[area.id]) {
        const at = { x: this.state.player.x, y: this.state.player.y };
        this.enterInterior(INTERIORS[area.id], at);
      }
      hook().started = true;
    }
    const startIn = this.loaded ? null : (this.params.area as InteriorId | null);
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

  // ---------------------------------------------------------------- street life and police (milestone 4)

  private life: StreetLife | null = null;
  private police: Police | null = null;
  private roads: RoadGraph | null = null;
  private buildingBoxes: [number, number, number, number][] = [];
  /** Seconds an officer has been close enough to bust the player (docs/05). */
  private bustT = 0;
  /** Crimes are numbered, so several witnesses of one crime raise its stars once (docs/05). */
  private crimeSeq = 0;
  private reported = new Set<number>();
  /** A car alarm about to reach the police. */
  private alarm: { t: number; at: { x: number; y: number } } | null = null;

  private createStreetLife(): void {
    if (!this.map.walkways && !this.map.lanes) return;
    this.buildingBoxes = this.map.placements
      .filter((q) => q.sprite.startsWith('bld/') && q.solid !== false)
      .map((q) => footprintOf(q) as [number, number, number, number]);
    const place = (sp: Phaser.GameObjects.Sprite, x: number, y: number, r: number) => {
      const s = worldToScreen(x, y);
      sp.setPosition(Math.round(s.x), Math.round(s.y));
      const near = this.statics.filter((o) => rectsOverlap(o.bounds, this.spriteRect(sp)));
      sp.setDepth(depthAmong([x - r, y - r, x + r, y + r], near, depthOf(x, y)));
    };
    const carShadow = (model: string, dir: number) =>
      this.carShadowTexture({ type: typeOfModel(model) }, dir);
    this.life = new StreetLife(this, this.map, {
      place,
      ensureWalkAnims: (c) => this.ensureWalkAnims(c),
      view: () => this.camCtl?.view() ?? { x: 0, y: 0, w: 0, h: 0 },
      obstacles: () => {
        const out: Obb[] = [];
        const r = BALANCE.walker.radius;
        if (!this.inside) {
          const p = this.state.player;
          if (!this.drivenCar()) out.push({ x: p.x, y: p.y, hx: r, hy: r, ang: 0 });
        }
        for (const c of this.cars) {
          const S = stats(c.v);
          out.push({ x: c.v.x, y: c.v.y, hx: S.halfLength, hy: S.halfWidth, ang: c.v.heading });
        }
        const cr = this.police?.cruiserBox();
        if (cr) out.push(cr);
        return out;
      },
      carShadow,
      layer: this.objectLayer,
      groundLayer: this.groundLayer,
      rng: this.rng,
    });
    const pre = this.map.zones?.find((z) => z.id === 'precinct');
    const base = pre?.slots?.[0] ?? { ...this.map.spawn, dir: 0 };
    this.roads = buildRoads(this.map.lanes ?? [], this.map.crossings ?? []);
    this.police = new Police(this, {
      place,
      ensureWalkAnims: (c) => this.ensureWalkAnims(c),
      carShadow,
      layer: this.objectLayer,
      groundLayer: this.groundLayer,
      rng: this.rng,
      roads: this.roads,
      solids: () => [...this.solids, ...this.cars.map((c) => vehicleSolid(c.v))],
      rules: this.collisionRules,
      buildings: this.buildingBoxes,
      base,
    });
  }

  /**
   * A crime happened at `at` (docs/05): an officer who sees it raises the stars at once; people who see it run and
   * phone the police, which takes 6–10 seconds and can be stopped.
   */
  private crime(stars: number, at: { x: number; y: number }): void {
    const W = BALANCE.wanted;
    const id = ++this.crimeSeq;
    if (this.police?.active && this.police.sees(at)) {
      reportCrime(this.state.wanted, this.reported, id, stars, at);
      return;
    }
    const night = darkness(this.minuteOfDay()) > 0.5;
    const range = night ? W.witnessNightTiles : W.witnessTiles;
    for (const pv of this.life?.peds ?? []) {
      const q = pv.ped;
      if (q.call || !canSee(q, at, range, this.buildingBoxes)) continue;
      const [lo, hi] = W.callSeconds as [number, number];
      q.call = { t: lo + (hi - lo) * this.rng.next(), at: { ...at }, stars, crime: id };
      startFlee(q, at);
    }
  }

  private updateStreetLife(dt: number): void {
    if (!this.life || !this.police) return;
    const W = BALANCE.wanted;
    const wanted = this.state.wanted;
    this.life.update(dt, this.minuteOfDay(), !this.inside);
    // witness calls and alarms getting through
    for (const pv of this.life.peds) {
      const c = pv.ped.call;
      if (!c) continue;
      c.t -= dt;
      if (c.t <= 0) {
        if (reportCrime(wanted, this.reported, c.crime, c.stars, c.at))
          this.toast('POLICE', 'A WITNESS CALLED IT IN.');
        pv.ped.call = null;
      }
    }
    if (this.alarm) {
      this.alarm.t -= dt;
      if (this.alarm.t <= 0) {
        addStars(wanted, W.crimeStars.alarm, this.alarm.at);
        this.alarm = null;
      }
    }
    // where the police think the player is: outside, or at the door of the building they went into
    const p = this.state.player;
    const street = this.inside ? (this.state.streetReturn ?? p) : p;
    const car = this.drivenCar();
    const view = {
      x: street.x,
      y: street.y,
      driving: !!car && Math.abs(car.v.speed) > W.stoppedCarSpeed,
      speed: car ? Math.abs(car.v.speed) : 0,
    };
    const busting = this.police.update(dt, wanted, view);
    const seen = !this.inside && this.police.active && this.police.sees(street);
    // a hot stolen car seen by the police (docs/08: 20% a minute)
    if (car && car.v.hotUntil > this.state.minutes && seen && wanted.stars === 0) {
      const chance = 1 - Math.pow(1 - W.hotCarChancePerMinute, dt / 60);
      if (this.rng.chance(chance)) addStars(wanted, W.crimeStars.hotCar, street);
    }
    if (tickWanted(wanted, dt, seen, street)) {
      this.toast('POLICE', 'YOU LOST THEM.');
      this.reported.clear();
    }
    // people get out of the way of a fast car
    if (car && Math.abs(car.v.speed) > 70)
      for (const pv of this.life.peds) {
        const dx = pv.ped.x - car.v.x;
        const dy = pv.ped.y - car.v.y;
        const ahead = dx * Math.cos(car.v.heading) + dy * Math.sin(car.v.heading);
        if (ahead > 0 && Math.hypot(dx, dy) < 3 * TILE && pv.ped.mode !== 'flee') startFlee(pv.ped, car.v);
      }
    // the bust (docs/05): an officer close for long enough; Y surrenders
    if (busting > 0 && wanted.stars > 0 && !this.inside) {
      this.bustT += dt;
      if (this.bustT >= W.bustSeconds) this.doArrest(false);
    } else this.bustT = Math.max(0, this.bustT - dt * 2);
  }

  /** Arrested (docs/05): the fine, maybe jail and seized dirty cash, the stolen car impounded, release at Precinct 1. */
  private doArrest(surrendered: boolean): void {
    // busted in the middle of a lockpick or a hotwire: the panel closes
    if (this.scene.isActive('minigame')) {
      this.scene.stop('minigame');
      hook().minigame = null;
      this.pendingCar = null;
      this.pendingTrunk = null;
    }
    const st = this.state;
    const stars = Math.max(1, st.wanted.stars);
    const arrestedAt = st.minutes;
    const o = arrest(st.money, st.record, stars, st.minutes, surrendered);
    const car = this.drivenCar();
    let impounded = false;
    if (car) {
      this.leaveCar({ x: car.v.x, y: car.v.y });
      if (car.v.hotUntil > 0) {
        this.removeCar(car);
        impounded = true;
      }
    }
    st.wanted = emptyWanted();
    this.bustT = 0;
    this.alarm = null;
    for (const pv of this.life?.peds ?? []) pv.ped.call = null;
    this.police?.destroy();
    const day = Math.floor(st.minutes / 1440);
    st.minutes = o.jailDays > 0 ? (day + o.jailDays) * 1440 + BALANCE.sleep.wakeMinute : st.minutes + 60;
    // the record follows the person into every job (docs/03): freeze, extra work, no clean-record bonus
    arrestEffects(st.career, arrestedAt, st.minutes);
    const door = this.map.zones?.find((z) => z.id === 'precinct')?.npc ?? this.map.spawn;
    st.player.x = door.x + 14;
    st.player.y = door.y;
    this.camCtl.snap();
    const lines = [
      o.repeat ? 'REPEAT OFFENSE' : 'FIRST OFFENSE: A FINE ONLY',
      `FINE $${o.fine}${surrendered ? ' (SURRENDERED: -30%)' : ''}${o.paid < o.fine ? `, PAID $${o.paid}` : ''}`,
    ];
    if (o.jailDays > 0) lines.push(`${o.jailDays} DAY${o.jailDays > 1 ? 'S' : ''} IN JAIL`);
    if (o.seized > 0) lines.push(`DIRTY CASH SEIZED: $${o.seized}`);
    if (impounded) lines.push('THE STOLEN CAR WAS IMPOUNDED');
    lines.push(`PROMOTION FROZEN ${BALANCE.careers.freezeDays} DAYS, EXTRA WORK AFTER`);
    lines.push('RELEASED AT PRECINCT 1, PEWTER STREET');
    this.prompt?.setVisible(false);
    this.scene.pause();
    this.scene.launch('menu', { info: { title: 'BUSTED', lines } });
    this.game.events.once('menu:closed', () => {
      this.scene.resume();
      this.resumedAt = this.time.now;
      // missed shifts while in jail, rent and the rest of the calendar during the time that passed
      this.runDays(true);
    });
  }

  /** Esc: the pause menu (docs/11), which pauses the world. */
  private openMenu(): void {
    if (!this.playing || this.isReference || this.scene.isPaused() || this.busy) return;
    if (this.time.now - this.resumedAt < BALANCE.ui.keyGuardMs) return;
    this.prompt?.setVisible(false);
    this.scene.pause();
    this.scene.launch('menu');
    this.game.events.once('menu:closed', () => {
      this.scene.resume();
      this.resumedAt = this.time.now;
    });
  }

  /**
   * A list panel (scenes/ListScene.ts): the phone (P), the ATM and the bag (I). Like the pause menu, it pauses the
   * world until it closes.
   */
  private openList(name: 'phone' | 'atm' | 'bag'): void {
    if (!this.playing || this.isReference || this.scene.isPaused() || this.busy) return;
    if (this.time.now - this.resumedAt < BALANCE.ui.keyGuardMs) return;
    const ctx: PhoneCtx = { state: this.state, wallet: this.wallet() };
    const root = { phone: phoneRoot, atm: atmPage, bag: bagPage }[name];
    const req: ListRequest = {
      style: name === 'phone' ? 'phone' : 'menu',
      name,
      root: () => root(ctx),
      onChange: () => this.syncMoneyHook(),
    };
    this.prompt?.setVisible(false);
    hook().minigame = name;
    this.scene.pause();
    this.scene.launch('list', req);
    this.game.events.once('list:closed', () => {
      hook().minigame = null;
      this.scene.resume();
      this.resumedAt = this.time.now;
      this.updateInteriorObjective();
    });
  }

  /** Money, rent and the bag on the read-only debug hook. */
  private syncMoneyHook(): void {
    const h = hook();
    const st = this.state;
    h.clean = st.money.clean;
    h.dirty = st.money.dirty;
    h.bank = st.money.bank;
    h.rentOwed = st.finance.rent.owed;
    h.evicted = st.finance.rent.evicted;
    h.inventory = { ...st.inventory };
    h.health = st.player.health;
  }

  /** Messages from people and services go into the phone's MESSAGES app (newest first). */
  private logMessage(who: string, text: string): void {
    if (!PHONE_SENDERS.has(who) || !this.state) return;
    const list = this.state.messages;
    list.unshift({ at: this.state.minutes, who, text });
    list.length = Math.min(list.length, BALANCE.phone.messagesKept);
  }

  /**
   * The calendar's fixed moments for the time that passed (systems/days.ts): rent and the weekly bonus on Monday
   * 06:00, late fees and eviction, missed shifts at 10:00, the Sunday rent reminder. Each message shows on the
   * phone. Passing 06:00 also autosaves when you aren't wanted (docs/12), unless the caller saves anyway.
   */
  private runDays(autosave: boolean): void {
    const st = this.state;
    if (this.isReference || !(st.minutes > st.calendarAt)) {
      st.calendarAt = Math.max(st.calendarAt, st.minutes);
      return;
    }
    const wake = BALANCE.sleep.wakeMinute;
    const crossed = Math.floor((st.minutes - wake) / 1440) > Math.floor((st.calendarAt - wake) / 1440);
    const msgs = runCalendar(st, st.calendarAt, st.minutes);
    st.calendarAt = st.minutes;
    for (const m of msgs) this.toast(m.who, m.text);
    if (msgs.length) this.updateInteriorObjective();
    if (crossed && autosave && this.playing) void this.autosave();
  }

  // ---------------------------------------------------------------- saves (docs/12)

  /** Is the player at the shelter's door (St. Brine's, after an eviction: sleep and save)? */
  private atShelter(): boolean {
    const z = this.map.zones?.find((q) => q.id === 'shelter');
    if (!z?.npc || this.inside) return false;
    const p = this.state.player;
    return Math.hypot(p.x - z.npc.x, p.y - z.npc.y) <= BALANCE.interact.rangeTiles * TILE * 2;
  }

  /** Manual saves happen at home (the apartment) or the shelter, and never while wanted (docs/12). */
  canSave(): { ok: boolean; why: string } {
    if (this.state.wanted.stars > 0) return { ok: false, why: 'NOT WHILE WANTED' };
    if (this.atShelter()) return { ok: true, why: '' };
    const evicted = this.state.finance.rent.evicted;
    if (this.inside?.def.id !== 'apartment' || evicted)
      return {
        ok: false,
        why: evicted ? "SAVE AT ST. BRINE'S SHELTER, PEWTER ST" : 'SAVE AT HOME: DRIZZLE ROW RESIDENCES',
      };
    return { ok: true, why: '' };
  }

  /** A small picture of the screen for the save summary. */
  private thumbnail(): Promise<string | undefined> {
    return new Promise((resolve) => {
      try {
        this.game.renderer.snapshot((img) => {
          try {
            const c = document.createElement('canvas');
            c.width = 160;
            c.height = 90;
            const ctx = c.getContext('2d');
            if (!ctx || !(img instanceof HTMLImageElement)) return resolve(undefined);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, 0, 0, c.width, c.height);
            resolve(c.toDataURL('image/png'));
          } catch {
            resolve(undefined);
          }
        });
      } catch {
        resolve(undefined);
      }
    });
  }

  /** Write the current game to a slot. Returns an error message, or null when saved. */
  async saveTo(slot: SlotId): Promise<string | null> {
    const store = await saveStore();
    if (store.kind === 'none') return 'BROWSER STORAGE IS OFF: USE EXPORT';
    try {
      const file = makeSave(this.state, slot, Date.now(), await this.thumbnail());
      await store.put(file);
      askPersist();
      return null;
    } catch {
      return 'COULD NOT SAVE';
    }
  }

  /** The current game as a save file, for exporting without storage. */
  snapshotSave(slot: SlotId): SaveFile {
    return makeSave(this.state, slot, Date.now());
  }

  /** Autosave (docs/12): on sleep, rotating between the two autosave slots. */
  private async autosave(): Promise<void> {
    if (this.state.wanted.stars > 0) return;
    const store = await saveStore();
    if (store.kind === 'none') return;
    const metas: Partial<Record<SlotId, SaveMeta>> = {};
    for (const f of await store.all()) metas[f.meta.slot] = f.meta;
    const err = await this.saveTo(nextAutoSlot(metas));
    if (!err) this.toast('AUTOSAVE', 'GAME SAVED.');
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
      vehicle: kb.addKey(KEYS.vehicle),
      handbrake: kb.addKey(KEYS.handbrake),
    };
    kb.addCapture([KEYS.up, KEYS.down, KEYS.left, KEYS.right, KEYS.debugOverlay, KEYS.cycle, KEYS.handbrake]);
    // while a crime minigame is open the world keeps running (docs/06) but its keys belong to the panel
    const free = () => !hook().minigame;
    this.keys.vehicle.on('down', () => free() && this.enterOrExit());
    this.keys.recenter.on('down', () => this.camCtl.recenter());
    this.keys.use.on('down', () => free() && this.use());
    this.keys.cycle.on('down', () => free() && this.cycle++);
    kb.on(`keydown-${KEYS.sightLines}`, () => {
      this.settings.sightLines = !this.settings.sightLines;
      saveSettings(this.settings);
      this.game.events.emit('hud:toast', {
        who: 'SETTINGS',
        text: this.settings.sightLines ? 'SIGHT LINES ON' : 'SIGHT LINES OFF: EVERY ROOM VISIBLE',
      });
    });
    kb.on(`keydown-${KEYS.debugOverlay}`, () => this.setDebug(!this.debugOn));
    kb.on('keydown-ESC', () => free() && this.openMenu());
    kb.on(`keydown-${KEYS.phone}`, () => free() && this.openList('phone'));
    kb.on(`keydown-${KEYS.bag}`, () => free() && this.openList('bag'));
    kb.on('keydown-Y', () => {
      if (this.bustT > 0 && !this.scene.isPaused()) this.doArrest(true);
    });
    this.cheats ??= new CheatConsole(
      (line) => this.runCheat(line),
      (open) => {
        if (this.input.keyboard) {
          this.input.keyboard.enabled = !open;
          if (open) this.input.keyboard.resetKeys();
        }
      },
    );
  }

  private cheats: CheatConsole | null = null;

  /** Apply a cheat-console line (debug/cheats.ts). */
  private runCheat(line: string): void {
    const c = parseCheat(line);
    if ('error' in c) {
      this.toast('CHEAT', c.error);
      return;
    }
    const st = this.state;
    const day = Math.floor(st.minutes / 1440);
    switch (c.kind) {
      case 'cash':
        st.money.clean = c.clean;
        break;
      case 'dirty':
        st.money.dirty = c.amount;
        break;
      case 'bank':
        st.money.bank = c.amount;
        break;
      case 'item': {
        const key = (Object.keys(st.inventory) as (keyof typeof st.inventory)[]).find(
          (k) => k.toLowerCase() === c.item.replace(/[^a-z]/g, ''),
        );
        if (!key) {
          this.toast('CHEAT', `ITEMS: ${Object.keys(st.inventory).join(', ').toUpperCase()}`);
          return;
        }
        st.inventory[key] = c.count;
        break;
      }
      case 'time':
        st.minutes = day * 1440 + c.minute + (c.minute < st.minutes % 1440 ? 1440 : 0);
        break;
      case 'day':
        st.minutes = (c.day - 1) * 1440 + (st.minutes % 1440);
        break;
      case 'rank': {
        const job = st.career.jobs[st.career.current];
        if (job) {
          job.rank = c.rank;
          job.xp = 0;
        }
        break;
      }
      case 'tp': {
        const car = this.drivenCar();
        if (car) {
          car.v.x = c.x;
          car.v.y = c.y;
          car.v.speed = 0;
        }
        st.player.x = c.x;
        st.player.y = c.y;
        break;
      }
      case 'car': {
        if (this.inside) {
          this.toast('CHEAT', 'CARS ONLY ON THE STREET.');
          return;
        }
        if (!this.textures.get('vehicles').has(`${c.model}/SE`)) {
          this.toast(
            'CHEAT',
            'MODELS: SEDAN_LAV, SEDAN_TEAL, SEDAN_CLAY, SEDAN_KHAKI, TAXI, VAN_WHITE, VAN_SAGE',
          );
          return;
        }
        const ang = (st.player.dir * Math.PI) / 4;
        const x = c.x ?? st.player.x + Math.cos(ang) * 60;
        const y = c.y ?? st.player.y + Math.sin(ang) * 60;
        const v = parkedCar(`cheat${this.cheatCars++}`, c.model, x, y, c.dir);
        v.locked = false;
        v.running = true;
        v.hotUntil = st.minutes + BALANCE.crime.hotMinutes;
        st.vehicles.push(v);
        this.addCarView(v);
        break;
      }
      case 'heal':
        st.player.health = BALANCE.player.maxHealth;
        break;
      case 'stars':
        if (c.stars === 0) st.wanted = emptyWanted();
        else {
          st.wanted = emptyWanted();
          addStars(st.wanted, c.stars, this.inside ? (st.streetReturn ?? st.player) : st.player);
        }
        break;
      case 'help':
        this.toast('CHEAT', CHEAT_HELP);
        return;
    }
    // turning the clock back doesn't replay the calendar; forward runs it
    st.calendarAt = Math.min(st.calendarAt, st.minutes);
    this.toast('CHEAT', line.trim().toUpperCase());
  }

  private cheatCars = 0;

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
    const items = this.placed.map((pl) => ({
      fp: footprintOf(pl.placement),
      bounds: pl.bounds,
      over: pl.placement.over === true,
    }));
    const rank = staticOrder(items);
    this.placed.forEach((pl, i) => {
      const d = rank[i] as number;
      pl.sprite.setDepth(d);
      pl.glow?.setDepth(d + 0.001);
      this.statics.push({ fp: items[i]!.fp, depth: d, bounds: pl.bounds, over: items[i]!.over });
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

  private promptTexture(label: string, blocked = false, keyCap = 'E'): string {
    const key = `prompt:${keyCap}:${label}:${blocked ? 'red' : ''}`;
    if (!this.textures.exists(key))
      addPixelsTexture(this.textures, key, promptPixels(keyCap, label, blocked));
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
    this.keepClearOfHud(img);
  }

  /**
   * Keep a world prompt off the HUD panels (handover known issue): the top panels, the bottom strip with the
   * objective and key hints, and the radar. The HUD is drawn at its own whole-number scale (HudScene).
   */
  private keepClearOfHud(img: Phaser.GameObjects.Image): void {
    const cam = this.cameras.main;
    const z = this.camCtl?.zoom ?? cam.zoom;
    const W = cam.width;
    const H = cam.height;
    const ui = Math.max(1, Math.floor(Math.min(W / UI_BASE_W, H / UI_BASE_H)));
    const S = BALANCE.hud.promptSafe;
    let x = (img.x - cam.scrollX) * z;
    let y = (img.y - cam.scrollY) * z;
    const w = img.width * z;
    const h = img.height * z;
    const top = S.top * ui;
    const bottom = H - S.bottom * ui;
    if (y < top) y = top;
    if (y + h > bottom) y = bottom - h;
    x = Math.min(Math.max(S.side * ui, x), W - S.side * ui - w);
    // the radar in the bottom-left corner
    const rr = S.radar * ui;
    if (x < rr && y + h > H - rr) x = rr;
    img.setPosition(Math.round(x / z + cam.scrollX), Math.round(y / z + cam.scrollY));
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

  /** The 8 walk animations of a costume, made once. */
  private ensureWalkAnims(costume: string): void {
    for (let d = 0; d < 8; d++) {
      const key = `walk-${costume}-${DIRS[d]}`;
      if (this.anims.exists(key)) continue;
      const frames = WALK_CYCLE.map((pose) => {
        const f = characterFrame(costume, pose, d);
        return { key: f.atlas, frame: f.frame };
      });
      this.anims.create({ key, frames, frameRate: BALANCE.walker.walkFps, repeat: -1 });
    }
  }

  private createPlayer(): void {
    const costume = this.state.player.costume;
    this.ensureWalkAnims(costume);
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
    if (this.playing) this.state.playtime += dt;
    if (!this.isReference) {
      this.state.minutes = advance(this.state.minutes, dt, this.settings.dayLengthMinutes);
      this.runDays(true);
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
    if (!this.isReference) this.updateStreetLife(dt);
    const k = this.keys;
    const car = this.drivenCar();
    if (car) {
      this.driveTick(car, dt);
      return;
    }
    if (hook().minigame) {
      p.moving = false;
      return;
    }
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
    const next = moveWithCollision(p.x, p.y, v.x * dt, v.y * dt, this.walkSolids(), this.collisionRules);
    p.x = next.x;
    p.y = next.y;
    p.dir = facingFromWorld(v.x, v.y);
    p.moving = true;
  }

  private syncPlayer(): void {
    if (!this.player || this.drivenCar()) return;
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

  /** Buildings you can enter, each with the door that leads in and a gold 1 px outline around its sprite. */
  private entrances: { id: string; door: Door; pl: Placed; img: Phaser.GameObjects.Image }[] = [];

  /**
   * Mark enterable buildings (user request, 2026-10-11): a subtle gold outline that fades in as you come near the
   * building and brightens when its door is the one E would use.
   */
  private createEntranceOutlines(): void {
    for (const d of this.map.doors ?? []) {
      let best: { pl: Placed; dist: number } | null = null;
      for (const pl of this.placed) {
        if (!pl.placement.sprite.startsWith('bld/')) continue;
        const [x0, y0, x1, y1] = footprintOf(pl.placement);
        const dx = Math.max(x0 - d.x, 0, d.x - x1);
        const dy = Math.max(y0 - d.y, 0, d.y - y1);
        const dist = Math.hypot(dx, dy);
        if (dist <= BALANCE.render.entrance.doorReach && (!best || dist < best.dist)) best = { pl, dist };
      }
      if (!best) continue;
      const pl = best.pl;
      const ref = pl.dayFrame;
      const key = `outline:${ref.atlas}:${ref.frame}`;
      if (!this.textures.exists(key)) {
        const f = frameInfo(ref.atlas as AtlasKey, ref.frame);
        const src = framePixels(this.textures, ref.atlas as AtlasKey, ref.frame);
        addPixelsTexture(
          this.textures,
          key,
          outlinePixels(src, [(PAL.goldMid >> 16) & 255, (PAL.goldMid >> 8) & 255, PAL.goldMid & 255]),
          { ax: f.ax + 1, ay: f.ay + 1 },
        );
      }
      const img = this.add
        .image(pl.sprite.x, pl.sprite.y, key)
        .setAlpha(0)
        .setDepth(pl.sprite.depth + 0.0004);
      this.objectLayer.add(img);
      this.entrances.push({ id: `door:${d.target}`, door: d, pl, img });
    }
  }

  private updateEntranceOutlines(dt: number): void {
    const E = BALANCE.render.entrance;
    const p = this.state.player;
    for (const e of this.entrances) {
      let want = 0;
      if (!this.inside) {
        if (this.target === e.id) want = E.hoverAlpha;
        else if (Math.hypot(p.x - e.door.x, p.y - e.door.y) <= E.nearTiles * TILE) want = E.idleAlpha;
      }
      const a = e.img.alpha + (want - e.img.alpha) * Math.min(1, dt * E.fadeRate);
      e.img.setAlpha(Math.min(Math.abs(a - want) < 0.01 ? want : a, e.pl.sprite.alpha));
      e.img.setVisible(e.img.alpha > 0.01);
    }
  }

  private updateInteraction(dt: number): void {
    this.updateEntranceOutlines(dt);
    if (!this.player || !this.playing) return;
    const p = this.state.player;
    const ang = (p.dir * Math.PI) / 4;
    if (this.inside) this.refreshInteriorLabels();
    else this.refreshStreetLabels();
    // with sight lines on, nothing in a room you can't see can be used (doors stand between rooms: always)
    const view = this.inside?.view;
    const shown = this.usables.filter((u) => !u.hidden);
    const usable = view
      ? shown.filter((u) => u.spot?.kind === 'door' || view.stateAt(u.x, u.y) === VIS)
      : shown;
    const t = this.drivenCar()
      ? this.driveTarget()
      : selectTarget(
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
        if (s.texture.key !== u.placed.dayFrame.atlas || s.frame.name !== u.placed.dayFrame.frame)
          s.setTexture(u.placed.dayFrame.atlas, u.placed.dayFrame.frame);
      } else {
        const key = this.runtimeCue(u.placed.dayFrame, state, frame, u.placed.placement.valuable ?? false);
        if (s.texture.key !== key) s.setTexture(key);
      }
    }
    const tgt = this.usables.find((u) => u.id === this.target);
    // an open panel (a crime minigame keeps the world running) hides the world prompt
    if (!tgt || hook().minigame) {
      this.prompt?.setVisible(false);
      return;
    }
    const key = this.promptTexture(tgt.label, tgt.blocked ?? false, tgt.key);
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
    if (this.time.now - this.resumedAt < BALANCE.ui.keyGuardMs) return;
    const u = this.usables.find((x) => x.id === this.target);
    if (!u) return;
    if (u.id.startsWith('witness:')) {
      const ped = this.life?.peds.find((pv) => `witness:${pv.ped.id}` === u.id)?.ped;
      if (ped) {
        ped.call = null;
        startFlee(ped, this.state.player);
        this.toast('WITNESS', 'THEY HANG UP AND RUN.');
      }
      return;
    }
    if (u.id === 'zone:marlo_spot') {
      const car = this.carForMarlo();
      if (car) this.sellToMarlo(car);
    } else if (u.door) this.tryEnter(u.door);
    else if (u.spot) this.useSpot(u.spot);
    else if (u.id === 'zone:shelter') this.sleep('shelter');
    else if (u.id.startsWith('car:')) this.useCar(u.id.slice(4));
    else if (u.id.startsWith('trunk:')) this.lootTrunk(u.id.slice(6));
    else if (u.id.startsWith('pump')) this.usePump(u);
    else if (u.id.startsWith('atm')) this.openList('atm');
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
      const withCar = this.drivenCar() ?? this.cars.find((c) => !c.v.locked);
      this.toast(
        'MARLO',
        withCar ? 'ROUND THE SIDE. PARK IT IN THE DOTTED SPOT OFF GULLSWAY.' : 'COME BACK WITH A CAR.',
      );
      return;
    }
    if (def.id === 'apartment' && this.state.finance.rent.evicted) {
      this.toast('LANDLORD', 'EVICTED: MOVE BACK IN FROM THE PHONE, BANK.');
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
        this.openMinigame({
          kind: 'shop',
          title: r.def.name,
          shop: a.shop ?? 'store',
          wallet: this.wallet(),
        });
        break;
      case 'launder':
        this.startLaundering();
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

  /** Sleep to 06:00 at home or at St. Brine's shelter (after an eviction), then autosave (docs/12). */
  private sleep(where: 'home' | 'shelter' = 'home'): void {
    if (where === 'home' && this.state.finance.rent.evicted) {
      this.toast('LANDLORD', "EVICTED. TRY ST. BRINE'S SHELTER ON PEWTER STREET.");
      return;
    }
    if (this.state.wanted.stars > 0) {
      this.toast(where === 'home' ? 'HOME' : 'SHELTER', 'NOT WITH THE POLICE AFTER YOU.');
      return;
    }
    this.fade(() => {
      this.state.minutes = sleepUntil(this.state.minutes, BALANCE.sleep.wakeMinute);
      this.runDays(false);
      const cal = calendar(this.state.minutes);
      if (where === 'home') this.toast('HOME', `SLEPT UNTIL 06:00, ${cal.weekday}.`);
      else this.toast('SHELTER', `A COT AT ST. BRINE'S. UP AT 06:00, ${cal.weekday}.`);
      void this.autosave();
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
      const res = clockOut(c, this.state.minutes);
      if (!res) return;
      const st = this.state;
      credit(st.money, st.finance, st.minutes, `PAY, ${JOBS[c.current].short}`, res.pay);
      credit(st.money, st.finance, st.minutes, 'PROMOTION BONUS', res.bonus);
      this.toast(
        'MS. HOLLIS',
        res.frozen
          ? `+$${res.pay} TO THE BANK. NO XP: YOUR PROMOTION IS FROZEN.`
          : `GOOD WORK. +$${res.pay} TO THE BANK, +${res.xp} XP.`,
      );
      void this.autosave();
      if (res.promoted)
        this.time.delayedCall(2200, () =>
          this.toast(
            'MS. HOLLIS',
            `PROMOTED TO ${rankTitle(c)}! +$${res.bonus} BONUS TO THE BANK.${hasKeyCard(c) ? ' HERE IS YOUR KEY CARD.' : ''}`,
          ),
        );
      this.updateInteriorObjective();
      return;
    }
    const r = clockIn(c, this.state.minutes);
    if (r.ok) {
      const n = tasksLeft(c);
      const extra = n > JOBS[c.current].tasksPerShift ? ' ONE EXTRA, AFTER YOUR LITTLE ADVENTURE.' : '';
      this.toast(
        'MS. HOLLIS',
        r.late
          ? `YOU'RE LATE. THAT'S 80% PAY TODAY. ${n} TASKS.${extra}`
          : `MORNING. ${n} TASKS TODAY.${extra}`,
      );
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
    const total = c.shift.tasks;
    const done = total - tasksLeft(c);
    this.pendingTask = task;
    this.openMinigame({ kind: task, seed: this.rng.int(1, 2 ** 30), task: `TASK ${done + 1}/${total}` });
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

  /** Job tasks and menus pause the world; crime minigames don't: witnesses and police keep moving (docs/06). */
  private openMinigame(req: MinigameRequest): void {
    this.prompt?.setVisible(false);
    hook().minigame = req.kind;
    // the panel's logic arrives when the scene starts (next frame); until then, nothing stale
    hook().minigameState = null;
    if (!(req.kind === 'lockpick' || req.kind === 'hotwire' || req.kind === 'search')) this.scene.pause();
    this.scene.launch('minigame', req);
  }

  private minigameDone(r: MinigameResult): void {
    hook().minigame = null;
    if (this.scene.isPaused()) this.scene.resume();
    // keys pressed in the panel (the hotwire's F terminal, E) must not also act in the world
    this.resumedAt = this.time.now;
    if (this.pendingTrunk) this.trunkMinigameDone(r);
    else if (r.kind === 'lockpick' || r.kind === 'hotwire') this.carMinigameDone(r);
    if (r.kind === 'duffel') this.launderDone(r);
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

  // ---------------------------------------------------------------- cars (docs/08, docs/04 carjacking)

  /** Parked map cars become vehicles the first time the street loads. */
  private createCars(): void {
    if (this.loaded) {
      const home = this.map.zones?.find((z) => z.id === 'home_parking');
      parkAtHome(this.state.vehicles, this.state.lastCar, home?.slots ?? []);
    }
    if (this.state.vehicles.length === 0)
      this.map.placements.forEach((p, i) => {
        if (!p.parked) return;
        const model = p.sprite.split('/')[1] as string;
        this.state.vehicles.push(parkedCar(`car${i}`, model, p.x, p.y, p.dir));
      });
    for (const v of this.state.vehicles) this.addCarView(v);
  }

  private addCarView(v: Vehicle): void {
    const ref = vehicleFrame(v.model, dirOf(v.heading));
    const sprite = this.add.sprite(0, 0, ref.atlas, ref.frame);
    this.objectLayer.add(sprite);
    const shadow = this.add.image(0, 0, this.carShadowTexture(v, dirOf(v.heading))).setDepth(1e6 - 2);
    this.groundLayer.add(shadow);
    const info = frameInfo(ref.atlas, ref.frame);
    const placed: Placed = {
      placement: {
        sprite: `veh/${v.model}`,
        dir: dirOf(v.heading),
        x: v.x,
        y: v.y,
        shadow: { kind: 'blob', r: 0 },
        interact: { id: `car:${v.id}`, label: '' },
      },
      sprite,
      info,
      bounds: { x: 0, y: 0, w: 0, h: 0 },
      height: info.ay - info.bounds.y,
      dayFrame: ref,
      nightFrame: null,
      glow: null,
      cue: { kind: 'runtime' },
    };
    const usable: Usable = { id: `car:${v.id}`, x: v.x, y: v.y, label: 'LOCKPICK', placed, door: null };
    const rear = trunkSpot(v);
    const trunk: Usable = { id: `trunk:${v.id}`, ...rear, label: 'LOOT TRUNK', placed: null, door: null };
    this.usables.push(usable, trunk);
    this.cars.push({ v, placed, shadow, usable, trunk });
  }

  private removeCar(c: CarView): void {
    c.placed.sprite.destroy();
    c.shadow.destroy();
    this.cars = this.cars.filter((x) => x !== c);
    this.usables = this.usables.filter((u) => u !== c.usable && u !== c.trunk);
    this.state.vehicles = this.state.vehicles.filter((v) => v !== c.v);
  }

  /** A moving box shadow for each of the 8 car directions, made once. */
  private carShadowTexture(v: Pick<Vehicle, 'type'>, dir: number): string {
    const key = `car-shadow-${v.type}-${dir}`;
    if (this.textures.exists(key)) return key;
    const S = stats(v);
    const shape = shadowShape(
      0,
      0,
      { kind: 'obox', hx: S.halfLength, hy: S.halfWidth, h: S.shadowHeight, ang: (dir * Math.PI) / 4 },
      SHADOW_VALUES,
    );
    const pts = shape.kind === 'poly' ? shape.pts : [];
    const x0 = Math.min(...pts.map((q) => q.x));
    const y0 = Math.min(...pts.map((q) => q.y));
    const rect = {
      x: x0,
      y: y0,
      w: Math.max(...pts.map((q) => q.x)) - x0 + 1,
      h: Math.max(...pts.map((q) => q.y)) - y0 + 1,
    };
    const mask = rasterizeShadows([shape], rect, () => true);
    const data = new Uint8ClampedArray(rect.w * rect.h * 4);
    mask.forEach((v, k) => {
      if (v) data.set([...SHADOW_RGB, shadowAlpha(v, BALANCE.render.shadowStrength)], k * 4);
    });
    addPixelsTexture(
      this.textures,
      key,
      { width: rect.w, height: rect.h, data },
      { ax: -rect.x, ay: -rect.y },
    );
    return key;
  }

  /** Everything the walker bumps into outside: the street's solids plus every car. */
  private walkSolids(): Solid[] {
    if (this.inside) return this.solids;
    return [
      ...this.solids,
      ...this.cars.filter((c) => c.v.id !== this.state.driving).map((c) => vehicleSolid(c.v)),
      ...this.movingSolids(),
    ];
  }

  /** Traffic and the police cruiser as turned boxes. */
  private movingSolids(): Solid[] {
    const boxes = [...(this.life?.carBoxes().map((c) => c.obb) ?? [])];
    const cr = this.police?.cruiserBox();
    if (cr) boxes.push(cr);
    return boxes.map((o) => ({
      kind: 'obox' as const,
      x: o.x,
      y: o.y,
      hx: o.hx,
      hy: o.hy,
      r: 0,
      ang: o.ang,
    }));
  }

  private drivenCar(): CarView | null {
    if (!this.state.driving || this.inside) return null;
    return this.cars.find((c) => c.v.id === this.state.driving) ?? null;
  }

  private driveTick(car: CarView, dt: number): void {
    const k = this.keys;
    const p = this.state.player;
    const v = car.v;
    const input =
      this.playing && !hook().minigame
        ? {
            throttle: (k.up.isDown ? 1 : 0) - (k.down.isDown ? 1 : 0),
            steer: (k.right.isDown ? 1 : 0) - (k.left.isDown ? 1 : 0),
            handbrake: k.handbrake.isDown,
          }
        : { throttle: 0, steer: 0, handbrake: true };
    const others = [
      ...this.cars.filter((c) => c !== car).map((c) => vehicleSolid(c.v)),
      ...this.movingSolids(),
    ];
    const fuelBefore = v.fuel;
    const impact = drive(v, input, dt, [...this.solids, ...others], this.collisionRules);
    if (impact > BALANCE.vehicles.crashToastSpeed && v.wrecked) this.toast('CAR', 'WRECKED. GET OUT: F.');
    if (fuelBefore > 0 && v.fuel === 0 && !this.toldOutOfFuel) {
      this.toldOutOfFuel = true;
      this.toast('CAR', 'OUT OF FUEL. USE A FUEL CAN OR PUSH ON TO A PUMP.');
    }
    p.x = v.x;
    p.y = v.y;
    p.dir = dirOf(v.heading);
    p.moving = false;
  }

  /**
   * Look-ahead (docs/11, 2026-10-11 camera rework): in a car the view leads in the direction of travel, so the car
   * sits toward the trailing edge (more of the road ahead shows); on foot it leans gently toward the mouse. Both in
   * screen pixels, smoothed. Driving also steps the zoom out one level.
   */
  private updateLead(dt: number): void {
    const C = BALANCE.camera;
    const car = this.inside ? null : this.drivenCar();
    this.camCtl.setContext(car ? C.drivingZoomStep : 0);
    let want = { x: 0, y: 0 };
    if (car) {
      const v = car.v;
      const view = this.camCtl.view();
      const d = worldToScreen(Math.cos(v.heading), Math.sin(v.heading));
      const len = Math.hypot(d.x, d.y) || 1;
      const reach = (C.driveLeadShare * (Math.min(view.w, view.h) / 2) * v.speed) / stats(v).topSpeed;
      want = { x: (d.x / len) * reach, y: (d.y / len) * reach };
    } else if (!this.inside && this.playing) {
      const m = this.camCtl.pointer();
      want = { x: m.x * C.mouseLeadPx, y: m.y * C.mouseLeadPx };
    }
    const a = 1 - Math.exp(-C.leadRate * dt);
    this.lead.x += (want.x - this.lead.x) * a;
    this.lead.y += (want.y - this.lead.y) * a;
  }

  private cameraTarget(): { x: number; y: number } {
    const s = this.playerScreen();
    return { x: s.x + this.lead.x, y: s.y + this.lead.y };
  }

  private syncCars(): void {
    if (this.inside) return;
    for (const c of this.cars) {
      const v = c.v;
      const dir = dirOf(v.heading);
      const ref = vehicleFrame(v.model, dir);
      const s = worldToScreen(v.x, v.y);
      const x = Math.round(s.x);
      const y = Math.round(s.y);
      const sp = c.placed.sprite;
      sp.setPosition(x, y);
      if (c.placed.dayFrame.frame !== ref.frame) {
        c.placed.dayFrame = ref;
        c.placed.info = frameInfo(ref.atlas, ref.frame);
        c.placed.placement.dir = dir;
        if (sp.texture.key === ref.atlas) sp.setFrame(ref.frame);
        c.shadow.setTexture(this.carShadowTexture(v, dir));
      }
      c.shadow.setPosition(x, y);
      const info = c.placed.info;
      c.placed.bounds = {
        x: x - info.ax + info.bounds.x,
        y: y - info.ay + info.bounds.y,
        w: info.bounds.w,
        h: info.bounds.h,
      };
      c.placed.placement.x = v.x;
      c.placed.placement.y = v.y;
      c.usable.x = v.x;
      c.usable.y = v.y;
      Object.assign(c.trunk, trunkSpot(v));
      // sort by the car's ground box among the static objects its sprite overlaps
      const { halfLength: L, halfWidth: W } = stats(v);
      const ex = Math.abs(L * Math.cos(v.heading)) + Math.abs(W * Math.sin(v.heading));
      const ey = Math.abs(L * Math.sin(v.heading)) + Math.abs(W * Math.cos(v.heading));
      const fp: Box = [v.x - ex, v.y - ey, v.x + ex, v.y + ey];
      const near = this.statics.filter((o) => rectsOverlap(o.bounds, c.placed.bounds));
      sp.setDepth(depthAmong(fp, near, depthOf(v.x, v.y)));
    }
  }

  /** Labels on the street: car prompts and Marlo's door change with what you have. */
  private refreshStreetLabels(): void {
    for (const c of this.cars) {
      const u = c.usable;
      const v = c.v;
      const tank = stats(v).tank;
      u.key = 'E';
      u.blocked = false;
      if (v.wrecked) {
        u.label = 'WRECKED';
        u.blocked = true;
      } else if (v.locked) u.label = this.state.inventory.lockpicks > 0 ? 'LOCKPICK' : 'LOCKPICK (NO TOOLS)';
      else if (this.state.inventory.repairKits > 0 && needsRepair(v)) u.label = 'USE REPAIR KIT';
      else if (this.state.inventory.fuelCans > 0 && v.fuel <= tank - BALANCE.vehicles.canUnits)
        u.label = 'USE FUEL CAN';
      else {
        u.key = 'F';
        u.label = v.running ? 'GET IN' : 'HOTWIRE';
      }
      // the trunk: not on a car you own or drive, and only once (docs/12: a looted car stays looted)
      c.trunk.hidden = !!v.looted || !!v.owned || v.wrecked || this.state.driving === v.id;
    }
    this.usables = this.usables.filter((u) => !u.id.startsWith('witness:'));
    const reach = BALANCE.wanted.scareTiles * TILE;
    for (const pv of this.life?.peds ?? []) {
      const q = pv.ped;
      if (q.call && Math.hypot(q.x - this.state.player.x, q.y - this.state.player.y) < reach + TILE)
        this.usables.push({
          id: `witness:${q.id}`,
          x: q.x,
          y: q.y,
          label: 'SCARE OFF',
          placed: null,
          door: null,
        });
    }
    const spot = this.usables.find((u) => u.id === 'zone:marlo_spot');
    if (spot) spot.hidden = this.marloWalker !== null || !this.carForMarlo();
  }

  /** While driving, E reaches the pumps and Marlo's yard from the car. */
  private driveTarget(): { target: string | null; inRange: string[] } {
    const car = this.drivenCar() as CarView;
    const V = BALANCE.vehicles;
    let best: { id: string; d: number } | null = null;
    for (const u of this.usables) {
      if (u.hidden) continue;
      const zone = u.id.startsWith('zone:');
      const reach = u.id.startsWith('pump') ? V.pumpReach : zone ? 0 : -1;
      if (reach < 0) continue;
      const d = zone ? 0 : distToCar(car.v, u.x, u.y);
      if (d <= reach && (!best || d < best.d)) best = { id: u.id, d };
    }
    return { target: best?.id ?? null, inRange: best ? [best.id] : [] };
  }

  /** The stolen car Marlo would buy: one stopped in his dotted spot (docs/08, decided 2026-10-11). */
  private carForMarlo(): CarView | null {
    const z = this.map.zones?.find((q) => q.id === 'marlo_spot');
    if (!z) return null;
    return this.cars.find((c) => !c.v.locked && parkedIn(c.v, z)) ?? null;
  }

  private useCar(id: string): void {
    const c = this.cars.find((x) => x.v.id === id);
    if (!c || this.busy) return;
    const v = c.v;
    if (v.wrecked) this.toast('CAR', 'WRECKED. NOTHING LEFT TO DRIVE.');
    else if (v.locked) {
      this.crime(BALANCE.wanted.crimeStars.carjack, { x: v.x, y: v.y });
      this.pendingCar = id;
      this.openLockpick('CAR DOOR');
    } else if (this.state.inventory.repairKits > 0 && needsRepair(v)) {
      repairKit(v, this.state.inventory);
      this.toast(
        'REPAIR KIT',
        `PATCHED UP TO ${Math.round(BALANCE.tools.repairKitTo * 100)}%. ${this.state.inventory.repairKits} KIT(S) LEFT.`,
      );
    } else if (this.state.inventory.fuelCans > 0 && v.fuel <= stats(v).tank - BALANCE.vehicles.canUnits) {
      pourCan(v, this.state.inventory);
      this.toldOutOfFuel = false;
      this.toast(
        'FUEL CAN',
        `+${BALANCE.vehicles.canUnits} UNITS. ${this.state.inventory.fuelCans} CAN(S) LEFT.`,
      );
    } else this.enterOrExit();
  }

  /** F: get in the nearest unlocked car (hotwiring it first), or get out. */
  private enterOrExit(): void {
    if (!this.playing || this.busy || this.inside || !this.player) return;
    if (this.time.now - this.resumedAt < BALANCE.ui.keyGuardMs) return;
    const driven = this.drivenCar();
    if (driven) {
      this.exitCar(driven);
      return;
    }
    const p = this.state.player;
    const near = this.cars
      .map((c) => ({ c, d: distToCar(c.v, p.x, p.y) }))
      .filter((x) => x.d <= BALANCE.vehicles.reach)
      .sort((a, b) => a.d - b.d)[0]?.c;
    if (!near) return;
    const v = near.v;
    if (v.wrecked) this.toast('CAR', 'WRECKED. NOTHING LEFT TO DRIVE.');
    else if (v.locked) this.toast('CAR', 'LOCKED. PRESS E TO PICK THE LOCK.');
    else if (!v.running) {
      this.pendingCar = v.id;
      const bonus = this.state.inventory.toolbox > 0 ? BALANCE.tools.toolboxHotwireSeconds : 0;
      this.openMinigame({ kind: 'hotwire', seed: this.rng.int(1, 2 ** 30), bonusSeconds: bonus });
    } else this.getIn(near);
  }

  private getIn(c: CarView): void {
    this.state.driving = c.v.id;
    this.state.lastCar = c.v.id;
    this.lead = { x: 0, y: 0 };
    this.player?.setVisible(false);
    this.playerShadow?.setVisible(false);
    this.prompt?.setVisible(false);
    this.state.player.x = c.v.x;
    this.state.player.y = c.v.y;
  }

  private exitCar(c: CarView): void {
    if (Math.abs(c.v.speed) > BALANCE.vehicles.exitMaxSpeed) {
      this.toast('CAR', 'SLOW DOWN BEFORE YOU GET OUT.');
      return;
    }
    const others = [...this.solids, ...this.cars.map((x) => vehicleSolid(x.v))];
    const spot = exitSpots(c.v, BALANCE.walker.radius).find(
      (q) => !collides(q.x, q.y, others, this.collisionRules),
    );
    if (!spot) {
      this.toast('CAR', 'NO ROOM TO OPEN THE DOOR.');
      return;
    }
    c.v.speed = 0;
    this.leaveCar(spot);
  }

  private leaveCar(at: { x: number; y: number }): void {
    this.state.driving = null;
    const p = this.state.player;
    p.x = at.x;
    p.y = at.y;
    p.moving = false;
    this.player?.setVisible(true);
    this.playerShadow?.setVisible(true);
  }

  /** The lockpick panel (docs/06), with the bag's lockpicks as the tool if there are any. */
  private openLockpick(label: string): void {
    this.pickTool = lockTool(this.state.inventory);
    this.openMinigame({
      kind: 'lockpick',
      seed: this.rng.int(1, 2 ** 30),
      tier: 0,
      tool: this.pickTool,
      label,
    });
  }

  /** The tool the open lockpick attempt uses, worn after it (docs/06: 1 use, 2 on a failure). */
  private pickTool: 'none' | 'basic' = 'none';

  private wearPicks(failed: boolean): void {
    if (this.pickTool !== 'basic') return;
    this.pickTool = 'none';
    if (wearLockpicks(this.state.inventory, failed))
      this.toast('LOCKPICK', 'THE LAST PICK SNAPPED. BUY MORE AT HARDWARE.');
  }

  private carMinigameDone(r: MinigameResult): void {
    const c = this.cars.find((x) => x.v.id === this.pendingCar);
    this.pendingCar = null;
    if (r.kind === 'lockpick') this.wearPicks(r.grade === 'fail' || r.grade === null);
    if (!c || r.grade === null) return;
    const ok = r.grade !== 'fail';
    if (r.kind === 'lockpick') {
      if (ok) {
        c.v.locked = false;
        this.toast('LOCKPICK', 'UNLOCKED. PRESS F TO GET IN AND HOTWIRE IT.');
      } else this.lockpickFailed(c);
      return;
    }
    if (ok) {
      c.v.running = true;
      c.v.hotUntil = this.state.minutes + BALANCE.crime.hotMinutes;
      this.getIn(c);
      this.toast('HOTWIRE', 'IT STARTED. MARLO BUYS CARS, NO QUESTIONS.');
      this.objective("SELL THE CAR AT MARLO'S TOW & SALVAGE");
    } else this.toast('HOTWIRE', 'SPARKS. TRY AGAIN.');
  }

  // ---------------------------------------------------------------- trunk looting (docs/04, brought forward)

  /** The car whose trunk is being opened or searched, and what's in it once it's open. */
  private pendingTrunk: { car: string; items: LootItem[] | null } | null = null;

  /** E at a car's rear: a 1★ crime if seen; pick the lock unless the car is open, then search the trunk. */
  private lootTrunk(id: string): void {
    const c = this.cars.find((x) => x.v.id === id);
    // a trunk already being opened (the moment between the picked lock and the search panel) isn't opened twice
    if (!c || this.busy || c.v.looted || this.pendingTrunk) return;
    this.crime(BALANCE.wanted.crimeStars.trunk, { x: c.trunk.x, y: c.trunk.y });
    this.pendingTrunk = { car: id, items: null };
    if (c.v.locked) this.openLockpick('TRUNK');
    else this.searchTrunk();
  }

  private searchTrunk(): void {
    const t = this.pendingTrunk;
    if (!t) return;
    t.items = rollTrunk(this.rng);
    this.openMinigame({ kind: 'search', seed: this.rng.int(1, 2 ** 30), label: 'TRUNK', items: t.items });
  }

  private trunkMinigameDone(r: MinigameResult): void {
    const t = this.pendingTrunk;
    const c = this.cars.find((x) => x.v.id === t?.car);
    if (r.kind === 'lockpick') {
      this.wearPicks(r.grade === 'fail' || r.grade === null);
      if (!c || r.grade === null || r.grade === 'fail') {
        this.pendingTrunk = null;
        if (c && r.grade === 'fail') this.lockpickFailed(c);
        return;
      }
      // the trunk lock is the car's lock: the car opens too
      c.v.locked = false;
      this.time.delayedCall(BALANCE.ui.keyGuardMs, () => this.searchTrunk());
      return;
    }
    this.pendingTrunk = null;
    if (r.kind !== 'search' || !c || r.grade === null) return;
    const haul = r.haul ?? [];
    c.v.looted = true;
    const got = takeLoot(haul, this.state.money, this.state.inventory);
    this.toast('TRUNK', got.summary === 'NOTHING' ? 'NOTHING WORTH TAKING.' : `TOOK ${got.summary}.`);
    if (got.cash > 0 && this.state.wanted.stars === 0)
      this.objective('WASH THE CASH: DEZ, THE LOW TIDE BACK ROOM (18:00-02:00)');
  }

  /** A failed pick: 30% of the time the car alarm goes off (docs/05), otherwise try again. */
  private lockpickFailed(c: CarView): void {
    if (this.rng.chance(BALANCE.crime.alarmChance)) {
      this.toast('CAR ALARM', 'THE ALARM IS GOING OFF. THE POLICE WILL HEAR OF IT.');
      this.alarm = { t: BALANCE.wanted.alarmSeconds, at: { x: c.v.x, y: c.v.y } };
      for (const pv of this.life?.peds ?? [])
        if (Math.hypot(pv.ped.x - c.v.x, pv.ped.y - c.v.y) < 8 * TILE) startFlee(pv.ped, c.v);
    } else this.toast('LOCKPICK', 'THE PICK SLIPPED. TRY AGAIN.');
  }

  /** E at a pump: fill the car you drive, or the stolen car parked beside it, for clean cash. */
  private usePump(u: Usable): void {
    const reach = BALANCE.vehicles.pumpReach;
    const car =
      this.drivenCar() ??
      this.cars
        .filter((c) => !c.v.locked && distToCar(c.v, u.x, u.y) <= reach)
        .sort((a, b) => distToCar(a.v, u.x, u.y) - distToCar(b.v, u.x, u.y))[0];
    if (!car) {
      this.toast('PUMP & GO', 'PULL A CAR UP TO THE PUMP.');
      return;
    }
    if (car.v.fuel >= stats(car.v).tank - 0.5) {
      this.toast('PUMP & GO', 'THE TANK IS FULL.');
      return;
    }
    const units = refuel(car.v, this.state.money);
    if (units === 0) this.toast('PUMP & GO', 'NOT ENOUGH CLEAN CASH. CARD ONLY, NO DIRTY BILLS.');
    else {
      this.toldOutOfFuel = false;
      this.toast('PUMP & GO', `+${units} UNITS FOR $${units * BALANCE.vehicles.fuelPrice} CLEAN.`);
    }
  }

  /** Marlo walking out to a car in his spot, and back: a road-worker sprite (his workwear) while it runs. */
  private marloWalker: Phaser.GameObjects.Sprite | null = null;

  /** E with a car in the dotted spot: Marlo walks out of his side door to the car, pays, and takes it away. */
  private sellToMarlo(c: CarView): void {
    if (this.busy || this.marloWalker) return;
    const z = this.map.zones?.find((q) => q.id === 'marlo_spot');
    if (!z?.npc) return;
    const home = z.npc;
    const to = exitSpots(c.v, BALANCE.walker.radius)
      .slice(0, 2)
      .sort((a, b) => Math.hypot(a.x - home.x, a.y - home.y) - Math.hypot(b.x - home.x, b.y - home.y))[0]!;
    const price = chopPrice(c.v, this.rng.next());
    const costume = 'road_worker';
    this.ensureWalkAnims(costume);
    const s = this.add.sprite(0, 0, 'characters', characterFrame(costume, 'idle', 0).frame);
    this.objectLayer.add(s);
    this.marloWalker = s;
    this.refreshStreetLabels();
    const walk = (from: { x: number; y: number }, dest: { x: number; y: number }, done: () => void) => {
      const dist = Math.hypot(dest.x - from.x, dest.y - from.y);
      const dir = facingFromWorld(dest.x - from.x, dest.y - from.y);
      s.play(`walk-${costume}-${DIRS[dir]}`, true);
      const pos = { x: from.x, y: from.y };
      this.tweens.add({
        targets: pos,
        x: dest.x,
        y: dest.y,
        duration: (dist / BALANCE.vehicles.marloWalkSpeed) * 1000,
        onUpdate: () => this.placeWalker(s, pos.x, pos.y),
        onComplete: () => {
          s.stop();
          s.setFrame(characterFrame(costume, 'idle', dir).frame);
          done();
        },
      });
      this.placeWalker(s, pos.x, pos.y);
    };
    walk(home, to, () => {
      if (!this.cars.includes(c) || !parkedIn(c.v, z)) {
        this.toast('MARLO', 'MAKE UP YOUR MIND.');
        walk(to, home, () => {
          s.destroy();
          this.marloWalker = null;
          this.marloPos = null;
        });
        return;
      }
      this.toast('MARLO', `$${price} DIRTY. NOW GET LOST.`);
      this.fade(() => {
        if (this.state.driving === c.v.id) {
          const out = exitSpots(c.v, BALANCE.walker.radius).find(
            (p) => !collides(p.x, p.y, this.solids, this.collisionRules),
          );
          this.leaveCar(out ?? { x: to.x + 12, y: to.y });
        }
        this.removeCar(c);
        this.state.money.dirty += price;
        this.objective('WASH THE CASH: DEZ, THE LOW TIDE BACK ROOM (18:00-02:00)');
        walk(to, home, () => {
          s.destroy();
          this.marloWalker = null;
          this.marloPos = null;
        });
      });
    });
  }

  /**
   * Cars, the player and Marlo against each other (2026-10-11 camera rework): each already sits between the static
   * objects it's in front of and behind; where two of them overlap on screen, their turned footprints decide which
   * draws first, nudging the depths without leaving those static limits.
   */
  private orderMovers(): void {
    if (this.inside || !this.map.ground) return;
    type M = { sp: Phaser.GameObjects.Sprite; obb: Obb; b: Rect; lo: number; hi: number };
    const ms: M[] = [];
    const add = (sp: Phaser.GameObjects.Sprite, obb: Obb, b: Rect) => {
      const ex = Math.abs(obb.hx * Math.cos(obb.ang)) + Math.abs(obb.hy * Math.sin(obb.ang));
      const ey = Math.abs(obb.hx * Math.sin(obb.ang)) + Math.abs(obb.hy * Math.cos(obb.ang));
      const fp: Box = [obb.x - ex, obb.y - ey, obb.x + ex, obb.y + ey];
      const near = this.statics.filter((o) => rectsOverlap(o.bounds, b));
      ms.push({ sp, obb, b, ...depthRange(fp, near) });
    };
    const r = BALANCE.walker.radius;
    for (const c of this.cars) {
      const { halfLength, halfWidth } = stats(c.v);
      add(
        c.placed.sprite,
        { x: c.v.x, y: c.v.y, hx: halfLength, hy: halfWidth, ang: c.v.heading },
        c.placed.bounds,
      );
    }
    const p = this.state.player;
    if (this.player?.visible) add(this.player, { x: p.x, y: p.y, hx: r, hy: r, ang: 0 }, this.playerBounds());
    for (const pv of this.life?.peds ?? [])
      add(pv.sprite, { x: pv.ped.x, y: pv.ped.y, hx: r, hy: r, ang: 0 }, this.spriteRect(pv.sprite));
    for (const c of this.life?.carBoxes() ?? []) add(c.sprite, c.obb, this.spriteRect(c.sprite));
    if (this.police?.cruiser) {
      const box = this.police.cruiserBox() as Obb;
      add(this.police.cruiser.sprite, box, this.spriteRect(this.police.cruiser.sprite));
    }
    for (const o of this.police?.officers ?? [])
      if (!o.inCar) add(o.sprite, { x: o.x, y: o.y, hx: r, hy: r, ang: 0 }, this.spriteRect(o.sprite));
    if (this.marloWalker && this.marloPos) {
      const g = this.marloWalker.getBounds();
      add(
        this.marloWalker,
        { ...this.marloPos, hx: r, hy: r, ang: 0 },
        { x: g.x, y: g.y, w: g.width, h: g.height },
      );
    }
    const step = 0.002;
    for (let pass = 0; pass < 3; pass++)
      for (let i = 0; i < ms.length; i++)
        for (let j = i + 1; j < ms.length; j++) {
          const a = ms[i] as M;
          const b = ms[j] as M;
          if (!rectsOverlap(a.b, b.b)) continue;
          const [back, front] = obbFirst(a.obb, b.obb) < 0 ? [a, b] : [b, a];
          if (back.sp.depth < front.sp.depth) continue;
          if (back.sp.depth + step < front.hi) front.sp.setDepth(back.sp.depth + step);
          else if (front.sp.depth - step > back.lo) back.sp.setDepth(front.sp.depth - step);
        }
  }

  private spriteRect(sp: Phaser.GameObjects.Sprite): Rect {
    const b = sp.getBounds();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  }

  /** Marlo's position while he walks to a car and back. */
  private marloPos: { x: number; y: number } | null = null;

  /** Put an NPC walking on the street at a world point, sorted among the static objects. */
  private placeWalker(s: Phaser.GameObjects.Sprite, x: number, y: number): void {
    if (s === this.marloWalker) this.marloPos = { x, y };
    const p = worldToScreen(x, y);
    s.setPosition(Math.round(p.x), Math.round(p.y));
    const r = BALANCE.walker.radius;
    const b = s.getBounds();
    const near = this.statics.filter((o) =>
      rectsOverlap(o.bounds, { x: b.x, y: b.y, w: b.width, h: b.height }),
    );
    s.setDepth(depthAmong([x - r, y - r, x + r, y + r], near, depthOf(x, y)));
  }

  private vehicleReadout(): HudSnapshot['vehicle'] {
    const c = this.drivenCar();
    if (!c) return null;
    const S = stats(c.v);
    return {
      type: TYPE_LABEL[c.v.type],
      fuel: c.v.fuel / S.tank,
      health: c.v.health / S.health,
      speed: Math.abs(c.v.speed) / topSpeed(c.v),
    };
  }

  // ---------------------------------------------------------------- laundering (docs/02)

  private startLaundering(): void {
    const day = calendar(this.state.minutes).day;
    if (this.state.money.dirty <= 0) this.toast('DEZ', 'BRING ME SOMETHING TO WASH FIRST.');
    else if (capLeft(this.state.laundered, day) <= 0)
      this.toast('DEZ', "THAT'S ENOUGH FOR TODAY. COME BACK TOMORROW.");
    else {
      this.launderPending = true;
      this.openMinigame({ kind: 'duffel', seed: this.rng.int(1, 2 ** 30), label: 'DEZ' });
    }
  }

  private launderDone(r: MinigameResult): void {
    if (!this.launderPending) return;
    this.launderPending = false;
    if (r.grade === null) return;
    const res = launder(
      this.state.money,
      this.state.laundered,
      calendar(this.state.minutes).day,
      r.grade as Grade,
    );
    this.toast('DEZ', `WASHED $${res.washed}. $${res.paid} CLEAN (${Math.round(res.cut * 100)}% CUT).`);
    this.updateInteriorObjective();
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
    for (const c of this.cars) c.placed.sprite.setTint(this.inRange.has(c.usable.id) ? cueTint : objTint);
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

  /** A sprite's cell on screen with a per-pixel opacity test, for occlusion coverage. */
  private masked(sp: Phaser.GameObjects.Sprite, frame?: FrameRef): MaskedSprite {
    const atlas = frame?.atlas ?? (sp.texture.key as AtlasKey);
    const name = frame?.frame ?? sp.frame.name;
    const f = frameInfo(atlas, name);
    return {
      x: sp.x - f.ax,
      y: sp.y - f.ay,
      w: f.w,
      h: f.h,
      opaque: (u, v) => opaqueAt(atlas, name, u, v),
    };
  }

  /**
   * Occlusion (docs/11, reworked 2026-10-11): anything in front whose pixels hide enough of the player (or the car
   * you drive) fades, and the hidden parts show through as a silhouette.
   */
  private updateOcclusion(dt: number): void {
    if (!this.player) return;
    const car = this.drivenCar();
    const tSprite = car ? car.placed.sprite : this.player;
    const tBounds = car ? car.placed.bounds : this.playerBounds();
    const target = this.inside ? null : this.masked(tSprite, car ? car.placed.dayFrame : undefined);
    const depth = tSprite.depth;
    const { occludedAlpha, occluderMinHeight, occludeShare } = BALANCE.render;
    const covering: Phaser.GameObjects.Sprite[] = [];
    for (const pl of this.placed) {
      let want = 1;
      if (target && pl.sprite.visible && pl.sprite.depth > depth && rectsOverlap(pl.bounds, tBounds)) {
        const share = coverage(this.masked(pl.sprite, pl.dayFrame), target);
        if (share > 0) covering.push(pl.sprite);
        if (share >= occludeShare && pl.height >= occluderMinHeight) want = occludedAlpha;
      }
      const a = pl.sprite.alpha + (want - pl.sprite.alpha) * Math.min(1, dt * 10);
      const alpha = Math.abs(a - want) < 0.01 ? want : a;
      pl.sprite.setAlpha(alpha);
      if (pl.glow) pl.glow.setAlpha(Math.min(pl.glow.alpha, alpha));
    }
    // other cars in front hide the player too
    if (target)
      for (const c of this.cars) {
        if (c === car || c.placed.sprite.depth <= depth || !rectsOverlap(c.placed.bounds, tBounds)) continue;
        if (coverage(this.masked(c.placed.sprite, c.placed.dayFrame), target) > 0)
          covering.push(c.placed.sprite);
      }
    if (this.inside) this.silhouette?.hide();
    else this.silhouette?.update(tSprite, covering);
  }

  private silhouette: Silhouette | null = null;

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
    this.syncCars();
    this.syncPlayer();
    this.orderMovers();
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
    this.updateLead(dt);
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
    h.stars = this.state.wanted.stars;
    h.rank = this.state.career.jobs.office.rank;
    h.tasksLeft = this.state.career.shift ? tasksLeft(this.state.career) : -1;
    this.syncMoneyHook();
    h.driving = this.state.driving;
    h.cars = this.state.vehicles.map((v) => ({
      id: v.id,
      x: v.x,
      y: v.y,
      locked: v.locked,
      running: v.running,
      fuel: v.fuel,
      heading: v.heading,
      speed: v.speed,
      health: v.health,
      looted: !!v.looted,
    }));
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
        objective: this.state.wanted.stars > 0 ? 'LOSE THE COPS' : this.objectiveText,
        vehicle: this.vehicleReadout(),
        starsFlash: this.state.wanted.stars > 0 && !this.state.wanted.seen,
        search:
          this.state.wanted.stars > 0 && !this.state.wanted.seen && this.state.wanted.lastKnown
            ? { ...this.state.wanted.lastKnown, r: searchRadius(this.state.wanted.stars) }
            : null,
        police: this.police?.blips() ?? [],
        surrender: this.bustT > 0,
      };
      this.game.events.emit('hud:frame', snap);
    }
  }
}
