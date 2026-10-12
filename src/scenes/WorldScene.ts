// The outdoor world: ground, buildings and props, the player, the camera, interaction, and day/night.
// Phase 1 milestone 1 shows Downtown; ?scene=reference shows the Phase 0 reference test map instead.

import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { BG_DAY, DIRS, PAL, SHADOW_RGB, TILE, UI_BASE_H, UI_BASE_W } from '../config/constants';
import { KEYS } from '../config/keys';
import { FixedStep } from '../core/clock';
import { Rng, hashString } from '../core/rng';
import { createState, loadSettings, saveSettings, type GameState, type Settings } from '../core/store';
import { framePixels, frameInfo, opaqueAt } from '../assets/atlasLoader';
import type { AtlasKey } from '../assets/manifest';
import { paintPlayer } from '../assets/playerLook';
import { outfitOf, playerCostume, type Look } from '../data/looks';
import { BALANCE_CRIME } from '../config/balanceCrime';
import { BALANCE_POLICE } from '../config/balancePolice';
import {
  arrested,
  completeCrime,
  restocked,
  starsCleared,
  tierFor,
  type RepChange,
} from '../systems/reputation';
import {
  callSeconds,
  cameraSource,
  fileIdentification,
  knownFace,
  pruneHeat,
  sighted,
  wipeFootage as wipeFile,
  type Disguise,
} from '../systems/identify';
import {
  cctvDisable,
  cctvWipe,
  crackSafe,
  cutPanel,
  grabRegister,
  intimidate,
  leaveStore,
  onShopFloor,
  openBackDoor,
  startRobbery,
  tickRobbery,
  type RobberyState,
} from '../systems/robbery';
import type { CrimeReport } from '../systems/reputation';
import type { CrimeStep } from '../data/interiors';
import { atmReady, robAtm, type AtmMethod } from '../systems/atmCrime';
import {
  burglaryStars,
  cutHousePanel,
  leaveHouse,
  ownerSees,
  pickDoor,
  rollHouse,
  rollOccupant,
  scareOwner,
  searchRoom,
  startBurglary,
  tickBurglary,
  type BurglaryState,
  type House,
} from '../systems/burglary';
import { GOODS_NAMES, LAYOUTS } from '../data/burglary';
import {
  changedOutfit,
  dropStars,
  emptyChase,
  enteredOwnedProperty,
  tickChaos,
  type ChaseState,
} from '../systems/response';
import { fencePage } from '../world/fence';
import { CombatWorld } from '../world/combatWorld';
import { armsPage } from '../world/arms';
import { servicePage, type ServiceCtx } from '../world/garageService';
import { respray } from '../systems/carService';
import { searchTrunk } from '../systems/trunk';
import { trunkPage } from '../world/trunkPage';
import {
  addAmmo,
  hurt,
  cycleWeapon,
  drawnWeapon,
  giveWeapon,
  statsOf,
  armorShare,
  hudWeapon,
  moveFactor,
  pickUp,
  reload,
  rollTrunkWeapon,
  revive,
  seizeUnregistered,
  selectSlot,
  setRaised,
  tickCombat,
  visibleWeapon,
  type Box as ShotBox,
} from '../systems/combat';
import { WEAPONS, type WeaponId } from '../data/weapons';
import { policeSighting } from '../systems/response';
import {
  bribeJudge,
  book,
  hireLawyer,
  judgeOffered,
  lawyerOffered,
  sentence,
  type Sentence,
} from '../systems/jail';
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
import { addStars, canSee, emptyWanted, reportCrime, searchRadius, tickWanted } from '../systems/wanted';
import { typeOfModel } from '../data/vehicles';
import { facingFromWorld, roundHalfEven, screenToWorld, worldToScreen, worldToTile } from '../iso/projection';
import { rasterizeShadows, shadowAlpha, shadowShape, type Rect } from '../iso/shadows';
import { GroundRenderer } from '../iso/tilemap';
import { VectorGroundRenderer } from '../iso/vectorGroundRenderer';
import { depthAmong, depthRange, obbFirst, staticOrder, type Box, type Obb } from '../iso/staticDepth';
import { DOWNTOWN } from '../maps/downtown';
import { tileSeed as referenceSeed, TEST_MAP } from '../maps/testMap';
import type { Door, MapData, Placement } from '../maps/types';
import { districtAt } from '../maps/groundQuery';
import { advance, calendar, darkness, formatClock, sleepUntil, tintAt } from '../systems/clock';
import {
  arrestEffects,
  canClockIn,
  clockIn,
  clockOut,
  deliveryDrops,
  hasKeyCard,
  legalDiscount,
  rankTitle,
  recordTask,
  taskBlock,
  tasksLeft,
  type Grade,
} from '../systems/career';
import { runCalendar } from '../systems/days';
import { credit, debit } from '../systems/finance';
import { rollTrunk, takeLoot, type LootItem } from '../systems/loot';
import { lockTool, wearLockpicks } from '../systems/shop';
import { atmPage, bagPage, phoneRoot, PHONE_SENDERS, type PhoneCtx } from '../world/phone';
import { clothingPage, dealerPage, lockerPage, wardrobePage, type ShopCtx } from '../world/shops';
import type { ListPage, ListRow } from '../ui/listPanel';
import { bayFree, boughtCar, payDealer } from '../systems/dealer';
import type { ListRequest } from './ListScene';
import { INTERIORS, interiorForDoor, isOpen, type InteriorDef, type InteriorId } from '../data/interiors';
import { JOBS, TASKS, jobAtSite, jobOfTask, type JobId, type TaskId } from '../data/jobs';
import { GIGS, type GigId } from '../data/oddJobs';
import { DEZ_TIP, type OnboardEvent } from '../data/onboarding';
import { finishGig, gigTasksLeft, quitGig, recordGigTask, startGig } from '../systems/oddJobs';
import {
  currentStepId,
  onboardEvent,
  onboardHint,
  onboardingActive,
  skipOnboarding,
  tipDue,
} from '../systems/onboarding';
import { MODEL_COLOUR, TYPE_LABEL } from '../data/vehicles';
import { HOMES, HOME_IDS, PROPERTY_TYPES, type HomeId } from '../data/property';
import { homeOf, stashAt } from '../systems/property';
import {
  garagePage,
  plansPage,
  salePage,
  stashPage,
  workbenchPage,
  type GarageCtx,
  type WorkbenchCtx,
} from '../world/propertyPages';
import { ATLASES } from '../assets/manifest';
import {
  createDoors,
  doorPrompt,
  interiorSolids,
  npcOnDuty,
  useSpots,
  withAddons,
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
  onStrip,
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
import { WorldFx } from '../fx/worldFx';
import { groundSampler } from '../maps/groundQuery';
import { ACTIONS_TEXTURE, contextAction, paintPlayerActions, PlayerActions } from '../anim/playerActions';

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
/** The rooms of a home you own (docs/09): its add-ons decide what stands in them. */
const OWNED_ROOMS: readonly InteriorId[] = ['home_small', 'home_family', 'hideout'];

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
  /** The weapon panel (docs/11): label and CLIP/RESERVE. */
  weapon: { label: string; ammo: string };
  /** The weapon is raised: draw the crosshair at the mouse. */
  aiming: boolean;
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
  /** Gold objective marks on the radar: the job's drops, yard spots, or where to clock in. */
  marks: { x: number; y: number }[];
  /** An officer is busting the player: the surrender prompt. */
  surrender: boolean;
  /** The first-day guide is on: the hint strip offers F2 to skip it. */
  guide: boolean;
}

const SHADOW_VALUES = { box: BALANCE.render.shadowBoxValue, blob: BALANCE.render.shadowBlobValue };
const BG_NIGHT = 0x2e2430;

/** The palette-swapped player in the fence's mask (art/source/pack_player.py style 'masked'). */
const MASKED_COSTUME = 'player/masked';

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
  /** Effects: dust, exhaust, skids, crashes, rain, cash glints (fx/worldFx.ts). */
  private fx: WorldFx | null = null;
  /** The hardest hit and the controls of the driven car since the last frame, for the car's effects. */
  private carImpact = 0;
  private carInput = { throttle: 0, handbrake: false };
  /** The player's tool and interact animations (anim/playerActions.ts). */
  private actions = new PlayerActions();

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
        // the Linden Avenue front doors (the delivery drops) can be broken into (Phase 3, docs/04)
        else if (z.id.startsWith('drop_') && z.npc) {
          this.usables.push({
            id: `house:${z.id}`,
            x: z.npc.x,
            y: z.npc.y,
            label: 'BREAK IN',
            placed: null,
            door: null,
          });
          // two of them are for sale (Phase 5, docs/09): your own front door once bought
          const home = HOME_IDS.find((k) => HOMES[k].door === z.id);
          if (home)
            this.usables.push({
              id: `home:${home}`,
              x: z.npc.x,
              y: z.npc.y,
              label: 'ENTER HOME',
              placed: null,
              door: null,
              hidden: true,
            });
        }
        // the homes for sale (Phase 5, docs/09): the driveway is the home's garage
        else if (z.id.startsWith('park_') && z.npc)
          this.usables.push({
            id: `garage:${z.id.slice(5)}`,
            x: z.npc.x,
            y: z.npc.y,
            label: 'GARAGE',
            placed: null,
            door: null,
            hidden: true,
          });
        // Torque & Sons' service bay (Phase 4, docs/08): shows with a car stopped on the apron
        else if (z.id === 'garage_service' && z.npc)
          this.usables.push({
            id: 'zone:garage_service',
            x: z.npc.x,
            y: z.npc.y,
            label: 'CAR SERVICE',
            placed: null,
            door: null,
            hidden: true,
          });
        // the arms dealer's open van in the alley (Phase 4, docs/07)
        else if (z.id === 'arms_dealer' && z.npc)
          this.usables.push({
            id: 'zone:arms_dealer',
            x: z.npc.x,
            y: z.npc.y,
            label: 'ARMS DEALER',
            placed: null,
            door: null,
          });
        // the weekend odd jobs' street spots (milestone 8): Squeaky's wash apron
        else if (z.id.startsWith('gig_') && z.npc) {
          const gig = z.id.slice(4) as GigId;
          this.usables.push({
            id: `gig:${gig}`,
            x: z.npc.x,
            y: z.npc.y,
            label: GIGS[gig].name,
            placed: null,
            door: null,
          });
        }
        // the lumberjack's spots in the timber yard (milestone 7)
        else if (z.id.startsWith('job_') && z.npc) {
          const task = z.id.slice(4) as TaskId;
          this.usables.push({
            id: `job:${task}`,
            x: z.npc.x,
            y: z.npc.y,
            label: TASKS[task].name,
            placed: null,
            door: null,
            hidden: true,
          });
        }
      }
      // the delivery drops move to the day's two Linden Avenue doors (refreshStreetLabels)
      for (const task of ['doorstep', 'signature'] as const)
        this.usables.push({
          id: `job:${task}`,
          x: 0,
          y: 0,
          label: TASKS[task].name,
          placed: null,
          door: null,
          hidden: true,
        });
      this.createEntranceOutlines();
      this.createPlayer();
      this.createCars();
      this.createLamps();
      this.createStreetLife();
      this.fx = new WorldFx(this, this.objectLayer, this.overlayLayer, {
        depthAt: (x, y) => this.moverDepth(x, y),
        seed: this.state.seed,
        view: () => this.camCtl.view(),
      });
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
        this.homeHere = area.home ?? null;
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
  private combatWorld: CombatWorld | null = null;
  /** Mouse buttons in the street (Phase 4): left fires, right raises the weapon. */
  private mouse = { left: false, right: false, x: 0, y: 0, clicked: false };
  private roads: RoadGraph | null = null;
  private buildingBoxes: [number, number, number, number][] = [];
  /** Seconds an officer has been close enough to bust the player (docs/05). */
  private bustT = 0;
  /** Crimes are numbered, so several witnesses of one crime raise its stars once (docs/05). */
  private crimeSeq = 0;
  /** This chase's once-only moves (bribe, outfit change...): reset when the stars clear (systems/response.ts). */
  private chase: ChaseState = emptyChase();
  private lastStars = 0;
  /** The player was a known face when this chase began. */
  private knownAtChase = false;
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
        for (const b of this.police?.boxes() ?? []) out.push(b.obb);
        return out;
      },
      carShadow,
      layer: this.objectLayer,
      groundLayer: this.groundLayer,
      rng: this.rng,
    });
    const pre = this.map.zones?.find((z) => z.id === 'precinct');
    const base = pre?.slots?.[0] ?? { ...this.map.spawn, dir: 0 };
    this.roads = buildRoads(this.map.roads ?? this.map.lanes ?? [], this.map.crossings ?? []);
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
    this.combatWorld = new CombatWorld(this, {
      layer: this.objectLayer,
      groundLayer: this.groundLayer,
      rng: this.rng,
      place: (sp, x, y, r) => place(sp as Phaser.GameObjects.Sprite, x, y, r),
      player: () => this.state.player,
      vitals: () => this.state.player,
      combat: () => this.state.combat,
      wanted: () => this.state.wanted,
      peds: () =>
        this.inside
          ? []
          : (this.life?.peds ?? []).map((pv) => ({
              id: pv.ped.id,
              x: pv.ped.x,
              y: pv.ped.y,
              sprite: pv.sprite,
            })),
      removePed: (id) => this.life?.removePed(id),
      cops: () => (this.inside ? [] : (this.police?.officers ?? []).filter((o) => !o.inCar)),
      removeCop: (sp) => this.police?.removeOfficer(sp),
      blockers: () => this.shotBlockers(),
      buildings: this.buildingBoxes,
      crime: (stars, at, hear) => this.crime(stars, at, hear),
      toast: (who, text) => this.toast(who, text),
      playerDown: () => this.playerDown(),
      addUsable: (id, x, y, label) =>
        (this.streetSaved?.usables ?? this.usables).push({ id, x, y, label, placed: null, door: null }),
      removeUsable: (id) => {
        this.usables = this.usables.filter((u) => u.id !== id);
        if (this.streetSaved) this.streetSaved.usables = this.streetSaved.usables.filter((u) => u.id !== id);
      },
      playAction: (a) => this.actions.play(a, BALANCE.combatWorld.flashSeconds * 6),
    });
  }

  /** Police spike strips (docs/05 3★): driving over one bursts the tyres, unless they're level 2 (docs/08). */
  private spikesTick(): void {
    const car = this.drivenCar();
    const strips = this.police?.spikeStrips() ?? [];
    const v = car?.v;
    const on = !!v && strips.some((s) => onStrip(v, s));
    if (v && on && !this.onSpikes) {
      if ((v.mods?.tires ?? 0) >= BALANCE.vehicles.flat.resistLevel)
        this.toast('CAR', 'RUN-FLATS. THE SPIKES DO NOTHING.');
      else if (!v.flat) {
        v.flat = true;
        v.speed = Math.min(v.speed, topSpeed(v));
        this.toast('CAR', 'SPIKES! THE TYRES ARE GONE.');
      }
    }
    this.onSpikes = on;
  }

  private onSpikes = false;

  /** Smoke and fire from damaged cars, and wrecks that explode (docs/08). */
  private carDamageTick(dt: number): void {
    const V = BALANCE.vehicles;
    this.damageFxT += dt;
    const puff = this.damageFxT >= V.damageFxSeconds;
    if (puff) this.damageFxT = 0;
    for (const c of [...this.cars]) {
      const v = c.v;
      const S = stats(v);
      const share = v.health / S.health;
      if (puff && !this.inside && v.burning !== -1) {
        if (share < V.fireShare) this.fx?.emit('fireSmall', v.x, v.y, 14, 1);
        else if (share < V.smokeShare) this.fx?.emit('smoke', v.x, v.y, 16, 1);
      }
      if (!v.wrecked || v.burning === -1) continue;
      v.burning = (v.burning ?? 0) + dt;
      if (v.burning < V.explodeSeconds) continue;
      v.burning = -1;
      this.carExploded(c);
    }
  }

  private damageFxT = 0;

  /** A wreck explodes: the blast hurts whoever is near (the driver most), and a bought car goes to insurance. */
  private carExploded(c: CarView): void {
    const v = c.v;
    const E = BALANCE.vehicles.explosion;
    const st = this.state;
    this.combatWorld?.carExplosion(v, E.damage, E.radiusTiles);
    this.cameras.main.shake(BALANCE.vehicles.explosionShakeMs, 0.004);
    if (st.driving === v.id) this.leaveCar({ x: v.x + 30, y: v.y + 30 });
    const p = st.player;
    const d = Math.hypot(p.x - v.x, p.y - v.y);
    if (!this.inside && d < E.radiusTiles * TILE) {
      const r = hurt(p, st.combat, Math.round(E.damage * (1 - d / (E.radiusTiles * TILE)) + 1));
      if (r.down) {
        this.playerDown();
        return;
      }
    }
    // a bought car is insured (docs/08): it waits at home for 10% of its value
    if (v.owned) {
      const fee = Math.round(BALANCE.vehicles.types[v.type].value * BALANCE.vehicles.insuranceShare);
      debit(st.money, st.finance, st.minutes, 'CAR INSURANCE', Math.min(fee, st.money.bank));
      const home = this.map.zones?.find((z) => z.id === 'home_parking')?.slots?.[0];
      if (home) {
        v.x = home.x;
        v.y = home.y;
        v.heading = (home.dir * Math.PI) / 4;
      }
      v.health = stats(v).health;
      v.wrecked = false;
      v.burning = undefined;
      v.fuel = stats(v).tank;
      this.toast('INSURANCE', `YOUR ${TYPE_LABEL[v.type]} IS BACK AT HOME. $${fee} FROM THE BANK.`);
    }
  }

  /** What stops a bullet in the street: buildings and every car, as ground boxes. */
  private shotBlockers(): ShotBox[] {
    const out: ShotBox[] = [...this.buildingBoxes];
    const add = (o: { x: number; y: number; hx: number; hy: number; ang: number }) => {
      const c = Math.abs(Math.cos(o.ang));
      const sn = Math.abs(Math.sin(o.ang));
      const ex = o.hx * c + o.hy * sn;
      const ey = o.hx * sn + o.hy * c;
      out.push([o.x - ex, o.y - ey, o.x + ex, o.y + ey]);
    };
    for (const c of this.cars) {
      if (c.v.id === this.state.driving) continue;
      const S = stats(c.v);
      add({ x: c.v.x, y: c.v.y, hx: S.halfLength, hy: S.halfWidth, ang: c.v.heading });
    }
    for (const b of this.life?.carBoxes() ?? []) add(b.obb);
    for (const b of this.police?.boxes() ?? []) add(b.obb);
    return out;
  }

  /** The aim: from the player to the ground point under the mouse. */
  private aimAngle(): number {
    const cam = this.cameras.main;
    const wp = cam.getWorldPoint(this.mouse.x, this.mouse.y);
    const g = screenToWorld(wp.x, wp.y);
    const p = this.state.player;
    return Math.atan2(g.y - p.y, g.x - p.x);
  }

  /** Combat each fixed step (on foot in the street): timers, the trigger, facing the aim, the aim pose. */
  private combatTick(dt: number): void {
    const st = this.state;
    tickCombat(st.combat, st.player, dt);
    const can = this.playing && !this.inside && !st.driving && !hook().minigame && !this.busy;
    setRaised(st.combat, can && this.mouse.right);
    if (!can) {
      this.mouse.clicked = false;
      this.combatWorld?.trigger(0, false);
      return;
    }
    const pull = this.mouse.left || this.mouse.clicked;
    this.mouse.clicked = false;
    const aiming = st.combat.raised || pull;
    const angle = this.aimAngle();
    if (aiming) st.player.dir = facingFromWorld(Math.cos(angle), Math.sin(angle));
    this.combatWorld?.trigger(angle, pull);
    const w = drawnWeapon(st.combat);
    const cls = w ? WEAPONS[w.id].cls : null;
    const pose =
      st.combat.raised && cls
        ? cls === 'handgun'
          ? 'aim_pistol'
          : cls === 'heavy'
            ? 'aim_heavy'
            : cls === 'melee'
              ? null
              : 'aim_rifle'
        : null;
    this.actions.hold(pose);
  }

  /** Down at 0 HP (docs/05 "Death"): wake at 06:00 in St. Brine's infirmary, pay 10% of carried clean cash. */
  private playerDown(): void {
    const st = this.state;
    const D = BALANCE.death;
    const bill = Math.min(
      st.money.clean,
      Math.max(D.minBill, Math.min(D.maxBill, Math.round(st.money.clean * D.billShare))),
    );
    st.money.clean -= bill;
    st.wanted = emptyWanted();
    this.chase = emptyChase();
    this.lastStars = 0;
    this.bustT = 0;
    this.police?.destroy();
    this.combatWorld?.clear();
    revive(st.player, st.combat);
    st.minutes = sleepUntil(st.minutes, BALANCE.sleep.wakeMinute);
    const z = this.map.zones?.find((q) => q.id === 'shelter')?.npc ?? this.map.spawn;
    st.player.x = z.x + 14;
    st.player.y = z.y;
    this.camCtl.snap();
    this.prompt?.setVisible(false);
    this.scene.pause();
    this.scene.launch('menu', {
      info: {
        title: 'DOWN',
        lines: [
          "YOU WOKE UP IN ST. BRINE'S INFIRMARY",
          `06:00, ${calendar(st.minutes).weekday}`,
          `THE BILL: $${bill} (CLEAN CASH)`,
          'YOU KEPT YOUR THINGS. THE STARS ARE GONE.',
        ],
      },
    });
    this.game.events.once('menu:closed', () => {
      this.scene.resume();
      this.resumedAt = this.time.now;
      this.runDays(true);
    });
  }

  /**
   * A crime happened at `at` (docs/05): an officer who sees it raises the stars at once; people who see it run and
   * phone the police, which takes 6–10 seconds and can be stopped.
   */
  private crime(stars: number, at: { x: number; y: number }, hearTiles = 0): void {
    const W = BALANCE.wanted;
    const id = ++this.crimeSeq;
    if (this.police?.active && this.police.sees(at)) {
      reportCrime(this.state.wanted, this.reported, id, stars, at);
      return;
    }
    const night = darkness(this.minuteOfDay()) > 0.5;
    const range = Math.max(night ? W.witnessNightTiles : W.witnessTiles, hearTiles);
    for (const pv of this.life?.peds ?? []) {
      const q = pv.ped;
      if (q.call || !canSee(q, at, range, this.buildingBoxes)) continue;
      const [lo, hi] = W.callSeconds as [number, number];
      const known = knownFace(this.state.heat, this.state.minutes);
      const t = callSeconds(lo + (hi - lo) * this.rng.next(), {
        knownFace: known,
        watchingMask: false,
        postalUniform: false,
      });
      q.call = { t, at: { ...at }, stars, crime: id };
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
      heading: car?.v.heading,
    };
    const busting = this.police.update(dt, wanted, view);
    const seen = !this.inside && this.police.active && this.police.sees(street);
    // a hot stolen car seen by the police (docs/08: 20% a minute)
    if (car && car.v.hotUntil > this.state.minutes && seen && wanted.stars === 0) {
      const chance = 1 - Math.pow(1 - W.hotCarChancePerMinute, dt / 60);
      if (this.rng.chance(chance)) addStars(wanted, W.crimeStars.hotCar, street);
    }
    // an officer who sees a bare face during a chase puts it on file (docs/05)
    if (seen && wanted.stars > 0) sighted(this.state.heat, 'police', this.disguise(), this.state.minutes);
    // a face already on file when the chase began, seen with a visible weapon: +1★ (docs/05)
    if (this.lastStars === 0 && wanted.stars > 0)
      this.knownAtChase = knownFace(this.state.heat, this.state.minutes);
    if (seen && wanted.stars > 0 && this.knownAtChase)
      policeSighting(
        this.chase,
        wanted,
        this.state.heat,
        this.state.minutes,
        visibleWeapon(this.state.combat),
        street,
      );
    if (tickWanted(wanted, dt, seen, street)) {
      this.toast('POLICE', 'YOU LOST THEM.');
      this.reported.clear();
    }
    // sustained 4★ in police sight goes to 5★ (docs/05)
    if (tickChaos(this.chase, wanted, dt)) this.toast('POLICE', 'ALL UNITS. ARMORED RESPONSE IS ROLLING.');
    if (this.lastStars > 0 && wanted.stars === 0) this.chaseOver();
    this.lastStars = wanted.stars;
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

  /** What the player wears for identification: a mask, or a work uniform's name tag (docs/04, docs/05). */
  private disguise(): Disguise {
    return { masked: !!this.state.maskOn, uniform: outfitOf(this.state.look.outfit).from === 'uniform' };
  }

  /** The stars cleared without an arrest (escaped or bribed): waiting reputation pays with the escape bonus. */
  private chaseOver(): void {
    this.chase = emptyChase();
    pruneHeat(this.state.heat, this.state.minutes);
    this.repNews(starsCleared(this.state.crime));
  }

  /** A crime is done and its payout in hand (docs/04): reputation now, or after the chase. */
  private crimeDone(payout: number): void {
    this.repNews(completeCrime(this.state.crime, payout, this.state.wanted.stars > 0));
  }

  /** Tier-ups reach the phone from Dez, who hears everything at the bar. */
  private repNews(ch: RepChange | null): void {
    if (!ch) return;
    for (const m of ch.messages) this.toast('DEZ', m);
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
    // the court's sentence first; the jail screen can still change it before booking (systems/jail.ts)
    const s = sentence(st.record, stars, st.minutes, surrendered);
    const repLost = arrested(st.crime);
    const car = this.drivenCar();
    let impounded = false;
    let trunkTaken = 0;
    if (car) {
      // docs/08: the police search the trunk (the hidden compartment passes it most of the time)
      trunkTaken = searchTrunk(car.v, this.rng);
      this.leaveCar({ x: car.v.x, y: car.v.y });
      if (car.v.hotUntil > 0) {
        this.removeCar(car);
        impounded = true;
      }
    }
    st.wanted = emptyWanted();
    this.chase = emptyChase();
    this.lastStars = 0;
    this.bustT = 0;
    this.alarm = null;
    for (const pv of this.life?.peds ?? []) pv.ped.call = null;
    this.police?.destroy();
    // booked at the precinct: the face goes on file
    sighted(st.heat, 'police', { masked: false, uniform: false }, st.minutes);
    this.prompt?.setVisible(false);
    this.scene.pause();
    const done = () => this.booked(s, arrestedAt, impounded, repLost, trunkTaken);
    if (lawyerOffered(s) || judgeOffered(s, tierFor(st.crime.rep))) this.jailScreen(s, done);
    else done();
  }

  /** The jail screen (docs/05): a lawyer cuts a day, the judge (Connected) turns jail into a fine. */
  private jailScreen(s: Sentence, done: () => void): void {
    const st = this.state;
    const tier = tierFor(st.crime.rep);
    const page = (): ListPage => {
      const rows: ListRow[] = [];
      if (lawyerOffered(s))
        rows.push({
          label: 'HIRE A LAWYER',
          icon: 'app/jobs',
          sub: 'ONE DAY LESS, CLEAN MONEY',
          detail: `$${BALANCE_POLICE.bribes.lawyer}`,
          act: () => ({ say: hireLawyer(s, st.money).text }),
        });
      if (judgeOffered(s, tier))
        rows.push({
          label: 'BRIBE THE JUDGE',
          icon: 'item/cash',
          sub: 'A FINE INSTEAD OF JAIL, DIRTY CASH',
          detail: `$${BALANCE_POLICE.bribes.judge}`,
          act: () => ({ say: bribeJudge(s, st.money, tier).text }),
        });
      rows.push({
        label: s.jailDays > 0 ? 'SERVE THE TIME' : 'PAY THE FINE',
        icon: 'face/cop',
        sub: s.jailDays > 0 ? `${s.jailDays} DAY${s.jailDays > 1 ? 'S' : ''}` : 'AND WALK OUT',
        act: () => ({ close: true }),
      });
      return {
        title: 'BOOKED',
        icon: 'face/cop',
        lines: [
          `FINE $${s.fine}`,
          s.jailDays > 0 ? `JAIL ${s.jailDays} DAY${s.jailDays > 1 ? 'S' : ''}` : 'NO JAIL',
        ],
        rows,
      };
    };
    hook().minigame = 'jail';
    this.scene.launch('list', {
      style: 'menu',
      name: 'jail',
      root: page,
      onChange: () => this.syncMoneyHook(),
      clock: () => formatClock(calendar(this.state.minutes).minute),
    } satisfies ListRequest);
    this.game.events.once('list:closed', () => {
      hook().minigame = null;
      done();
    });
  }

  /** Book the arrest: the fine, any seizure, jail time, the career record, release at Precinct 1. */
  private booked(s: Sentence, arrestedAt: number, impounded: boolean, repLost: number, trunkTaken = 0): void {
    const st = this.state;
    const o = book(s, st.money, st.record, {}, st.minutes);
    st.minutes = o.releaseAt;
    // the record follows the person into every job (docs/03): freeze, extra work, no clean-record bonus
    arrestEffects(st.career, arrestedAt, st.minutes);
    // released at Precinct 1's front desk; the street door is outside
    const door = this.map.doors?.find((d) => d.target === 'precinct');
    const zone = this.map.zones?.find((z) => z.id === 'precinct')?.npc ?? this.map.spawn;
    st.streetReturn = door ? { x: door.x, y: door.y + 12 } : { x: zone.x + 14, y: zone.y };
    st.player.x = st.streetReturn.x;
    st.player.y = st.streetReturn.y;
    const lobby = INTERIORS.precinct;
    this.enterInterior(lobby, { x: lobby.entrance!.x - 40, y: lobby.entrance!.y - 60 });
    this.camCtl.snap();
    const lines = [
      s.repeat ? 'REPEAT OFFENSE' : 'FIRST OFFENSE: A FINE ONLY',
      `FINE $${s.fine}${s.surrendered ? ' (SURRENDERED: -30%)' : ''}${o.paid < s.fine ? `, PAID $${o.paid}` : ''}`,
    ];
    if (s.judge) lines.push('THE JUDGE MADE IT A FINE');
    else if (o.jailDays > 0)
      lines.push(`${o.jailDays} DAY${o.jailDays > 1 ? 'S' : ''} IN JAIL${s.lawyer ? ' (LAWYER)' : ''}`);
    if (o.seizedCash > 0) lines.push(`DIRTY CASH SEIZED: $${o.seizedCash}`);
    if (s.repeat) {
      const guns = seizeUnregistered(st.combat);
      if (guns.length) lines.push(`SEIZED: ${guns.map((g) => WEAPONS[g].name).join(', ')}`);
    }
    this.combatWorld?.clear();
    if (impounded) lines.push('THE STOLEN CAR WAS IMPOUNDED');
    if (trunkTaken > 0) lines.push(`TRUNK SEARCHED: ${trunkTaken} ITEM${trunkTaken > 1 ? 'S' : ''} TAKEN`);
    if (repLost > 0) lines.push(`STREET REP LOST: ${repLost}`);
    lines.push(`PROMOTION FROZEN ${BALANCE.careers.freezeDays} DAYS, EXTRA WORK AFTER`);
    lines.push('RELEASED AT PRECINCT 1, PEWTER STREET');
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
    const ctx: PhoneCtx = { state: this.state, wallet: this.wallet(), chase: this.chase };
    const root = { phone: phoneRoot, atm: atmPage, bag: bagPage }[name];
    this.openPanel(name, () => root(ctx));
  }

  /** The shop lists (milestone 6b): the clothing store, the wardrobe and fitting booths, the used-car desk. */
  private openShopList(name: 'clothing' | 'wardrobe' | 'dealer' | 'locker'): void {
    const ctx: ShopCtx = {
      state: this.state,
      wear: (outfit) => this.setLook({ ...this.state.look, outfit }),
      buyCar: (model) => this.buyCar(model),
    };
    const job = this.siteJob() ?? this.state.career.current;
    const root = {
      clothing: clothingPage,
      wardrobe: wardrobePage,
      dealer: dealerPage,
      locker: (c: ShopCtx) => lockerPage(c, job),
    }[name];
    this.openPanel(name, () => root(ctx));
  }

  private openPanel(name: string, root: () => ListPage): void {
    if (!this.playing || this.isReference || this.scene.isPaused() || this.busy) return;
    if (this.time.now - this.resumedAt < BALANCE.ui.keyGuardMs) return;
    const req: ListRequest = {
      style: name === 'phone' ? 'phone' : 'menu',
      name,
      root,
      onChange: () => this.syncMoneyHook(),
      clock: () => formatClock(calendar(this.state.minutes).minute),
    };
    this.prompt?.setVisible(false);
    hook().minigame = name;
    this.showContextPose();
    this.scene.pause();
    this.scene.launch('list', req);
    const cleanBefore = this.state.money.clean;
    this.game.events.once('list:closed', () => {
      if (name === 'clothing' && this.state.money.clean < cleanBefore) this.guide('bought');
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
    if (this.homeHere && this.inside && OWNED_ROOMS.includes(this.inside.def.id))
      return { ok: true, why: '' };
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

  /** The look the player wears (docs/11). */
  get look(): Look {
    return this.state.look;
  }

  /** Change the player's look (the creator, the clothing store, a wardrobe): repaint the palette-swapped sprites. */
  setLook(look: Look): void {
    this.state.look = { ...look };
    paintPlayer(this.textures, look);
    paintPlayerActions(this.textures, look);
    const costume = this.state.maskOn ? MASKED_COSTUME : playerCostume(look);
    hook().look = { ...look };
    if (costume === this.state.player.costume) return;
    this.state.player.costume = costume;
    this.ensureWalkAnims(costume);
    if (this.player) {
      const ref = characterFrame(costume, 'idle', this.state.player.dir);
      this.player.stop();
      this.player.setTexture(ref.atlas, ref.frame);
    }
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
    kb.addCapture([
      KEYS.up,
      KEYS.down,
      KEYS.left,
      KEYS.right,
      KEYS.debugOverlay,
      KEYS.skipGuide,
      KEYS.cycle,
      KEYS.handbrake,
    ]);
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
    kb.on(`keydown-${KEYS.mask}`, () => free() && this.toggleMask());
    // weapons (docs/11): 1-4 draw a slot (again holsters), R reloads, the wheel cycles (Ctrl+wheel zooms)
    for (const [k, slot] of [
      ['ONE', 0],
      ['TWO', 1],
      ['THREE', 2],
      ['FOUR', 3],
    ] as const)
      kb.on(`keydown-${k}`, () => free() && !this.inside && selectSlot(this.state.combat, slot));
    kb.on(`keydown-${KEYS.reload}`, () => free() && reload(this.state.combat));
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      this.mouse.x = ptr.x;
      this.mouse.y = ptr.y;
      if (ptr.leftButtonDown()) {
        this.mouse.left = true;
        // a click shorter than a frame still fires once (consumed by the next step)
        this.mouse.clicked = true;
      }
      if (ptr.rightButtonDown()) this.mouse.right = true;
    });
    this.input.on('pointerup', (ptr: Phaser.Input.Pointer) => {
      if (!ptr.leftButtonDown()) this.mouse.left = false;
      if (!ptr.rightButtonDown()) this.mouse.right = false;
    });
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      this.mouse.x = ptr.x;
      this.mouse.y = ptr.y;
    });
    this.input.on('wheel', (ptr: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (ptr.event instanceof WheelEvent && ptr.event.ctrlKey) return;
      if (free() && !this.inside && dy !== 0) cycleWeapon(this.state.combat, dy > 0 ? 1 : -1);
    });
    kb.on(`keydown-${KEYS.skipGuide}`, () => {
      if (!free() || !onboardingActive(this.state.onboarding)) return;
      skipOnboarding(this.state.onboarding);
      this.toast('GUIDE', 'GUIDE OFF. YOUR OBJECTIVES STAY ON THE STRIP.');
    });
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
      case 'job': {
        const id = (Object.keys(JOBS) as JobId[]).find((j) => j === c.job);
        if (!id || st.career.shift) {
          this.toast('CHEAT', id ? 'FINISH THE SHIFT FIRST.' : 'JOB OFFICE|MECHANIC|LUMBERJACK|DELIVERY');
          return;
        }
        st.career.current = id;
        this.updateInteriorObjective();
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
        const ref = vehicleFrame(c.model, 0);
        if (!this.textures.get(ref.atlas).has(ref.frame)) {
          this.toast('CHEAT', 'MODELS: SEDAN_TEAL, TAXI, VAN_WHITE, PICKUP_SAGE, SPORTS_RED, ARMORED_SUV...');
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
      case 'rep':
        st.crime.rep = c.rep;
        break;
      case 'roadblock': {
        // 3★ and a roadblock with its spike strip ahead of the driven car (Phase 4 testing)
        const car = this.drivenCar();
        if (car && st.wanted.stars < 3) addStars(st.wanted, 3 - st.wanted.stars, { x: car.v.x, y: car.v.y });
        if (car)
          this.police?.placeRoadblock({
            x: car.v.x,
            y: car.v.y,
            driving: true,
            speed: 0,
            heading: car.v.heading,
          });
        break;
      }
      case 'gun': {
        // a weapon with a full reserve, drawn (Phase 4 testing)
        const id = c.weapon as WeaponId;
        if (!(id in WEAPONS)) break;
        giveWeapon(st.combat, id, false, statsOf(id).clip, false);
        const ammo = WEAPONS[id].ammo;
        if (ammo) addAmmo(st.combat, ammo, 999);
        const slot = st.combat.slots.findIndex((w) => w?.id === id);
        if (slot >= 0 && st.combat.drawn !== slot) selectSlot(st.combat, slot);
        break;
      }
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
    if (p.interact) {
      this.usables.push({ id: p.interact.id, x: p.x, y: p.y, label: p.interact.label, placed, door: null });
      // every ATM can also be robbed (Phase 3, docs/04): TAB picks it
      if (p.interact.id.startsWith('atm') && !this.isReference)
        this.usables.push({
          id: `rob:${p.interact.id}`,
          x: p.x,
          y: p.y,
          label: 'ROB ATM',
          placed,
          door: null,
        });
    }
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
    // the palette-swapped player (docs/11): paint the 'player' texture in this game's look first
    paintPlayer(this.textures, this.state.look);
    paintPlayerActions(this.textures, this.state.look);
    hook().look = { ...this.state.look };
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
      if (this.playing) this.guideTick();
      if (this.robbery && !this.robbery.done) this.robReport(tickRobbery(this.robbery, dt, this.rng));
      if (this.burglary && !this.burglary.done) this.burgleTick(dt);
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
    if (!this.isReference) this.carDamageTick(dt);
    if (!this.isReference) this.spikesTick();
    if (!this.isReference) {
      this.combatTick(dt);
      this.combatWorld?.update(dt, !!this.inside);
    }
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
    if (this.state.combat.raised) p.sprinting = false;
    const speed =
      BALANCE.walker.walkSpeed *
      (p.sprinting ? BALANCE.walker.sprintMultiplier : 1) *
      (this.state.combat.raised ? BALANCE.combatWorld.aimWalk : 1) *
      moveFactor(this.state.combat);
    const v = moveVector(sx, sy, speed) as { x: number; y: number };
    const next = moveWithCollision(p.x, p.y, v.x * dt, v.y * dt, this.walkSolids(), this.collisionRules);
    p.x = next.x;
    p.y = next.y;
    // aiming, the player faces the mouse and steps sideways or backwards
    if (!this.state.combat.raised && !this.mouse.left) p.dir = facingFromWorld(v.x, v.y);
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
    const aimFrame =
      p.moving && this.state.combat.raised && p.costume.startsWith('player/')
        ? this.actions.frame(p.costume.slice(7), p.dir)
        : null;
    if (aimFrame) {
      this.player.stop();
      if (this.player.texture.key !== ACTIONS_TEXTURE || this.player.frame.name !== aimFrame)
        this.player.setTexture(ACTIONS_TEXTURE, aimFrame);
    } else if (p.moving) {
      if (this.player.anims.currentAnim?.key !== anim || !this.player.anims.isPlaying) {
        // keep the cycle's phase when turning, so the legs don't snap back to idle
        const progress = this.player.anims.isPlaying ? this.player.anims.getProgress() : 0;
        this.player.play(anim, true);
        this.player.anims.setProgress(progress);
      }
      this.player.anims.timeScale = p.sprinting ? BALANCE.walker.sprintFpsMultiplier : 1;
    } else {
      this.player.stop();
      // standing: a tool or interact animation if one is playing, else the idle sprite
      const action = p.costume.startsWith('player/') ? this.actions.frame(p.costume.slice(7), p.dir) : null;
      const ref = action
        ? { atlas: ACTIONS_TEXTURE, frame: action }
        : characterFrame(p.costume, 'idle', p.dir);
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
    const g = this.geometryFrame(sp);
    const f = frameInfo(g.atlas as 'characters', g.frame);
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
    // reach out to whatever is used
    this.actions.play('use');
    if (u.id.startsWith('jack:')) {
      this.pullOut(u.id.slice(5));
      return;
    }
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
    else if (u.id.startsWith('rob:atm')) this.robAtmStart(u.id.slice(4), u);
    else if (u.id.startsWith('house:')) this.breakIn(u.id.slice(6), u);
    else if (u.id.startsWith('drop:')) this.takeDrop(u.id);
    else if (u.id === 'zone:arms_dealer') this.openArms();
    else if (u.id === 'zone:garage_service') this.openService();
    else if (u.id.startsWith('sale:')) this.openSale(u.id.slice(5) as HomeId);
    else if (u.id.startsWith('home:')) this.enterHome(u.id.slice(5) as HomeId);
    else if (u.id.startsWith('garage:')) this.openGarage(u.id.slice(7) as HomeId);
    else if (u.id === 'owner') this.scareOff();
    else if (u.id.startsWith('job:')) this.jobTask(u.id.slice(4) as TaskId);
    else if (u.id.startsWith('gig:')) this.gigAction(u.id.slice(4) as GigId);
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
    if (!open && !keyCard && def.id === 'store' && this.state.inventory.lockpicks > 0) {
      // the night job (docs/04): pick the back door, then the alarm panel inside has 10 seconds
      this.state.streetReturn = { x: door.x, y: door.y + 12 };
      this.pendingRob = 'night';
      this.openLockpick('BACK DOOR');
      return;
    }
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
    // a burglary house's owner shows only when someone is up (asleep in bed, or out)
    if (def.id.startsWith('house_')) {
      const o = this.burglary?.occupant;
      return json.npcs.map(() => o === 'awake' || o === 'calling');
    }
    const m = this.minuteOfDay();
    return json.npcs.map((_, i) => npcOnDuty(def.npcs[i]?.hours ?? null, m));
  }

  private enterInterior(def: InteriorDef, at: { x: number; y: number }): void {
    // a home you own and its hideout (docs/09): the stations its add-ons built, the stash room's door
    const owned =
      OWNED_ROOMS.includes(def.id) && this.homeHere ? homeOf(this.state.property, this.homeHere) : null;
    if (def.id === 'hideout' && owned?.addons.includes('stashRoom'))
      def = { ...def, doors: def.doors.map(() => ({ kind: 'open' as const })) };
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
    const json = withAddons(
      ATLASES[`in_${def.id}` as keyof typeof ATLASES].json as unknown as InteriorJson,
      owned?.addons ?? [],
    );
    this.inGround.setVisible(true);
    this.inObjects.setVisible(true);
    const view = new InteriorView(this, json, def, this.inGround, this.inObjects);
    this.fx?.setLayers(this.inObjects, this.overlayLayer);
    const doors = createDoors(json, def);
    const npcs = this.npcsOnDuty(def, json);
    this.inside = { def, json, view, doors, npcs };
    this.state.area = owned
      ? { kind: 'interior', id: def.id, home: owned.id }
      : { kind: 'interior', id: def.id };
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
    this.guide('leftHome');
    if (this.robbery) this.robLeave();
    if (this.burglary?.doorOpen) this.burgleLeave();
    this.leaveInteriorView();
    this.inGround.setVisible(false);
    this.inObjects.setVisible(false);
    this.groundLayer.setVisible(true);
    this.objectLayer.setVisible(true);
    this.fx?.setLayers(this.objectLayer, this.overlayLayer);
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
    this.homeHere = null;
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
        const mine = !!c.shift && c.shift.job === this.siteJob();
        u.label = mine ? (tasksLeft(c) === 0 ? 'CLOCK OUT' : `TASKS LEFT: ${tasksLeft(c)}`) : 'CLOCK IN';
        u.blocked = mine && tasksLeft(c) > 0;
      } else if (sp.kind === 'action' && sp.action.kind === 'job') {
        const t = TASKS[sp.action.task];
        const why = this.state.career.shift ? taskBlock(this.state.career, sp.action.task) : null;
        u.label =
          why === 'rank' ? `${t.name} (RANK ${t.minRank}+)` : why === 'done' ? `${t.name}: DONE` : t.name;
        u.blocked = why === 'rank' || why === 'done' || why === 'needs';
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
        // the store's staff door can be picked: that's the robbery's back room (docs/04)
        if (r.def.id === 'store' && d.rule.kind === 'locked') {
          this.ensureRobbery();
          this.pendingRob = 'door';
          this.openLockpick('STAFF DOOR');
          return;
        }
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
      case 'stash':
        this.openStash();
        break;
      case 'basement': {
        const to = INTERIORS.hideout;
        this.fade(() => this.enterInterior(to, to.elevator ?? { x: 40, y: 40 }));
        break;
      }
      case 'upstairs': {
        const to = this.homeInterior();
        if (to) this.fade(() => this.enterInterior(to, to.elevator ?? to.entrance ?? { x: 40, y: 40 }));
        break;
      }
      case 'plans':
        this.openPlans();
        break;
      case 'workbench':
        this.openWorkbench();
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
      case 'clothes':
        this.openShopList('clothing');
        break;
      case 'wardrobe':
        this.openShopList('wardrobe');
        break;
      case 'locker':
        this.openShopList('locker');
        break;
      case 'dealer':
        this.openShopList('dealer');
        break;
      case 'clock':
        this.clockAction();
        break;
      case 'job':
        this.jobTask(a.task);
        break;
      case 'gig':
        this.gigAction(a.gig);
        break;
      case 'crime':
        this.robStep(a.step);
        break;
      case 'burgle':
        this.burgleRoom(a.room);
        break;
      case 'housePanel':
        this.housePanel();
        break;
      case 'fence':
        this.openPanel('fence', () => fencePage(this.state));
        break;
      case 'frontDesk':
        this.frontDesk();
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
    if (where === 'home' && this.state.finance.rent.evicted && !this.homeHere) {
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
      this.guide('slept');
      const cal = calendar(this.state.minutes);
      if (where === 'home') this.toast('HOME', `SLEPT UNTIL 06:00, ${cal.weekday}.`);
      else this.toast('SHELTER', `A COT AT ST. BRINE'S. UP AT 06:00, ${cal.weekday}.`);
      void this.autosave();
      this.lastDark = -1;
      this.updateNpcs(true);
      this.updateInteriorObjective();
    });
  }

  /** The job whose time clock is in the interior the player is in, if any. */
  private siteJob(): JobId | null {
    return this.inside ? jobAtSite(this.inside.def.id) : null;
  }

  private clockAction(): void {
    const c = this.state.career;
    const job = this.siteJob() ?? c.current;
    const J = JOBS[job];
    if (c.shift) {
      if (c.shift.job !== job) {
        this.toast(J.boss, `YOU'RE ON SHIFT AT ${JOBS[c.shift.job].where}.`);
        return;
      }
      const left = tasksLeft(c);
      if (left > 0) {
        this.toast(J.boss, `${left} TASK${left > 1 ? 'S' : ''} LEFT. ${J.taskHint}.`);
        return;
      }
      const res = clockOut(c, this.state.minutes);
      if (!res) return;
      this.guide('shiftDone');
      const st = this.state;
      credit(st.money, st.finance, st.minutes, `PAY, ${J.short}`, res.pay);
      credit(st.money, st.finance, st.minutes, 'PROMOTION BONUS', res.bonus);
      this.toast(
        J.boss,
        res.frozen
          ? `+$${res.pay} TO THE BANK. NO XP: YOUR PROMOTION IS FROZEN.`
          : `GOOD WORK. +$${res.pay} TO THE BANK, +${res.xp} XP.`,
      );
      void this.autosave();
      if (res.promoted) {
        const card = job === 'office' && hasKeyCard(c) ? ' HERE IS YOUR KEY CARD.' : '';
        this.time.delayedCall(2200, () =>
          this.toast(J.boss, `PROMOTED TO ${rankTitle(c, job)}! +$${res.bonus} BONUS TO THE BANK.${card}`),
        );
      }
      this.updateInteriorObjective();
      return;
    }
    // the uniform goes on at the locker before clocking in (docs/03 decisions)
    if (canClockIn(c, this.state.minutes, job).ok && J.uniform && this.state.look.outfit !== J.uniform) {
      this.toast(J.boss, 'UNIFORM FIRST. YOUR LOCKER IS IN THE STAFF ROOM.');
      return;
    }
    const r = clockIn(c, this.state.minutes, job);
    if (r.ok) {
      this.guide('clockedIn');
      const n = tasksLeft(c);
      const extra = n > J.tasksPerShift ? ' ONE EXTRA, AFTER YOUR LITTLE ADVENTURE.' : '';
      this.toast(
        J.boss,
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
        otherJob: `YOU DON'T WORK HERE. TAKE THE JOB ON YOUR PHONE'S JOB BOARD.`,
      };
      this.toast(J.boss, why[r.reason]);
    }
    this.updateInteriorObjective();
  }

  private jobTask(task: TaskId): void {
    const c = this.state.career;
    const T = TASKS[task];
    const job = jobOfTask(task);
    const why = taskBlock(c, task);
    if (why) {
      const J = JOBS[job];
      const text: Record<typeof why, string> = {
        noShift: this.siteJob() === job ? 'CLOCK IN WITH ME FIRST.' : `CLOCK IN FIRST: ${J.goTo}.`,
        otherJob: `YOU'RE ON SHIFT AT ${JOBS[c.shift?.job ?? c.current].where}.`,
        shiftDone: "THAT'S ENOUGH FOR TODAY. CLOCK OUT.",
        rank: `THAT'S FOR ${J.ranks[(T.minRank ?? 1) - 1]}S AND UP.`,
        needs: `${(T.after ?? []).map((t) => TASKS[t].name).join(' AND ')} FIRST.`,
        done: 'ALREADY DONE THIS SHIFT.',
      };
      this.toast(J.boss, text[why]);
      return;
    }
    const shift = c.shift;
    if (!shift) return;
    const label = `TASK ${shift.tasks - tasksLeft(c) + 1}/${shift.tasks}`;
    const seed = this.rng.int(1, 2 ** 30);
    this.pendingTask = task;
    if (T.game === 'filing' || T.game === 'dataEntry') this.openMinigame({ kind: T.game, seed, task: label });
    else this.openMinigame({ kind: T.game, seed, task: label, rank: c.jobs[shift.job].rank, mode: T.mode });
  }

  private pendingTask: TaskId | null = null;
  private pendingGig: GigId | null = null;
  /** Clean cash when a shop opened: spending some there is the guide's shop step. */
  private cleanAtShop = 0;

  // ---------------------------------------------------------------- weekend odd jobs (docs/02, milestone 8)

  /** E at a gig's spot: start the gig, or do its next task. */
  private gigAction(id: GigId): void {
    const o = this.state.oddJobs;
    const G = GIGS[id];
    if (o.gig && o.gig.id !== id) {
      this.toast(G.boss, `FINISH YOUR ${GIGS[o.gig.id].name} FIRST.`);
      return;
    }
    if (this.state.career.shift) {
      this.toast(G.boss, "YOU'RE ON SHIFT ELSEWHERE.");
      return;
    }
    if (!o.gig) {
      const r = startGig(o, id, this.state.minutes);
      if (!r.ok) {
        const H = BALANCE.oddJobs.gigs[id];
        const hours = `SAT-SUN ${formatClock(H.from)}-${formatClock(H.until)}`;
        const text: Record<typeof r.reason, string> = {
          weekday: `WEEKENDS ONLY. ${hours}.`,
          early: `NOT YET. ${hours}.`,
          tooLate: `WE'RE DONE FOR TODAY. ${hours}.`,
          alreadyWorked: "THAT'S YOUR SHIFT FOR TODAY. SEE YOU TOMORROW.",
          onGig: 'FINISH WHAT YOU STARTED.',
        };
        this.toast(G.boss, text[r.reason]);
        return;
      }
      this.toast(G.boss, `${BALANCE.oddJobs.gigs[id].tasks} ${G.unit}S. ESC WALKS OFF THE JOB, UNPAID.`);
    }
    const g = o.gig;
    if (!g) return;
    this.pendingGig = id;
    const n = g.grades.length;
    this.openMinigame({
      kind: id,
      seed: this.rng.int(1, 2 ** 30),
      task: `${G.unit} ${n + 1}/${g.tasks}`,
      car: id === 'carWash' ? n : undefined,
    });
  }

  /** A gig task closed: record it, pay out after the last one, or walk off unpaid on Esc. */
  private gigTaskDone(r: MinigameResult): void {
    const o = this.state.oddJobs;
    const id = this.pendingGig;
    this.pendingGig = null;
    if (!id || !o.gig) return;
    const G = GIGS[id];
    if (r.grade === null) {
      quitGig(o);
      this.toast(G.boss, 'YOU WALKED OFF. NO PAY TODAY.');
      this.updateInteriorObjective();
      return;
    }
    recordGigTask(o, r.grade as Grade);
    const left = gigTasksLeft(o);
    if (left > 0) {
      this.toast(G.name, `${r.grade.toUpperCase()}. ${left} MORE. PRESS E FOR THE NEXT ${G.unit}.`);
      this.updateInteriorObjective();
      return;
    }
    const c = this.state.career;
    const res = finishGig(o, c.jobs[c.current].rank);
    if (!res.ok) return;
    const st = this.state;
    credit(st.money, st.finance, st.minutes, G.name, res.pay);
    // tips are handed over in cash: clean, carried
    st.money.clean += res.tips;
    this.toast(G.boss, `+$${res.pay} TO THE BANK${res.tips > 0 ? `, +$${res.tips} IN TIPS` : ''}. SEE YOU.`);
    this.syncMoneyHook();
    void this.autosave();
    this.updateInteriorObjective();
  }

  // ---------------------------------------------------------------- store robbery (docs/04, Phase 3)

  private robbery: RobberyState | null = null;
  private pendingRob: CrimeStep | 'door' | 'night' | 'panel' | null = null;
  /** One crime id per robbery report key, so the same crime raises the stars once (wanted.reportCrime). */
  private robIds = new Map<string, number>();

  /** The robbery in progress, started now if there isn't one (an open store, with the clerk). */
  private ensureRobbery(): RobberyState {
    if (!this.robbery) {
      this.robbery = startRobbery(this.rng, 'open', { uniform: this.disguise().uniform });
      this.robIds.clear();
      // a store robbed in the last day has nothing left in the till or the safe
      if (
        !restocked(this.state.crimeLog.stores.store, this.state.minutes, BALANCE_CRIME.robbery.restockMinutes)
      ) {
        this.robbery.register = 0;
        this.robbery.safe = 0;
      }
    }
    return this.robbery;
  }

  private robStep(step: CrimeStep): void {
    const seed = this.rng.int(1, 2 ** 30);
    if (step === 'register') {
      const r = this.inside;
      const clerk = r ? r.def.npcs.findIndex((n) => n.role === 'clerk') : -1;
      if (!r || clerk < 0 || !r.npcs[clerk]) {
        this.toast('REGISTER', 'NOBODY TO OPEN IT.');
        return;
      }
      const s = this.ensureRobbery();
      if (s.registerOpen) {
        this.toast('REGISTER', s.register > 0 ? 'ALREADY OPEN.' : 'EMPTY.');
        return;
      }
      this.pendingRob = 'register';
      this.openMinigame({ kind: 'intimidate', seed, label: 'CLERK' });
      return;
    }
    const s = this.robbery;
    if (step === 'safe') {
      if (!s?.backDoorOpen) {
        this.toast('SAFE', 'THE BACK ROOM IS LOCKED.');
        return;
      }
      if (s.safeOpen || s.safe <= 0) {
        this.toast('SAFE', 'EMPTY.');
        return;
      }
      this.pendingRob = 'safe';
      this.openMinigame({ kind: 'safeCrack', seed, label: 'BACK ROOM', tier: 1 });
      return;
    }
    // the security desk works whenever you're in there; it starts the job if nothing else has
    this.ensureRobbery();
    this.pendingRob = step;
    if (step === 'cctv') this.openMinigame({ kind: 'bypass', seed, label: 'CCTV', seconds: 15 });
    else this.openMinigame({ kind: 'wipe', seed, label: 'DVR' });
  }

  private robDone(r: MinigameResult): void {
    const step = this.pendingRob;
    this.pendingRob = null;
    const st = this.state;
    if (step === 'night') {
      this.wearPicks(r.grade === 'fail' || r.grade === null);
      if (r.grade === null || r.grade === 'fail') return;
      const def = INTERIORS.store;
      this.robbery = startRobbery(this.rng, 'night', { uniform: this.disguise().uniform });
      this.robIds.clear();
      if (!restocked(st.crimeLog.stores.store, st.minutes, BALANCE_CRIME.robbery.restockMinutes))
        this.robbery.safe = 0;
      openBackDoor(this.robbery);
      this.fade(() => {
        this.enterInterior(def, def.entrance ?? { x: 40, y: 40 });
        this.unlockStaffDoor();
        this.toast('ALARM', 'THE PANEL BEEPS. CUT IT!');
        const left = Math.max(1, (this.robbery?.panelDeadline ?? 0) - (this.robbery?.t ?? 0));
        this.pendingRob = 'panel';
        this.time.delayedCall(BALANCE.ui.keyGuardMs, () =>
          this.openMinigame({
            kind: 'bypass',
            seed: this.rng.int(1, 2 ** 30),
            label: 'BACK DOOR',
            seconds: left,
          }),
        );
      });
      return;
    }
    const s = this.robbery;
    if (!s) return;
    if (step === 'panel') {
      this.robReport(cutPanel(s, r.grade !== null && r.grade !== 'fail'));
      this.toast(
        'ALARM',
        s.panel === 'cut' ? 'PANEL CUT. THE SAFE IS IN THE BACK.' : 'THE ALARM IS RINGING!',
      );
      return;
    }
    if (step === 'door') {
      this.wearPicks(r.grade === 'fail' || r.grade === null);
      if (r.grade === null || r.grade === 'fail') return;
      openBackDoor(s);
      this.unlockStaffDoor();
      return;
    }
    if (r.grade === null) return;
    if (step === 'register') {
      onShopFloor(s, !!st.maskOn);
      if (!intimidate(s, r.grade as Grade, this.rng)) {
        this.toast('CLERK', 'THEY FROZE. THE ALARM IS PRESSED.');
        return;
      }
      const got = grabRegister(s, r.grade as Grade, st.money);
      this.toast('REGISTER', got > 0 ? `+$${got} DIRTY.` : 'NOTHING IN THE TILL.');
    } else if (step === 'safe') {
      const got = crackSafe(s, r.grade as Grade, st.money);
      this.toast('SAFE', got > 0 ? `+$${got} DIRTY.` : 'IT WOULDNT OPEN.');
    } else if (step === 'cctv') {
      if (r.grade === 'fail') this.toast('CCTV', 'WRONG WIRE. STILL RECORDING.');
      else {
        cctvDisable(s);
        this.toast('CCTV', 'CAMERAS OFF.');
      }
    } else if (step === 'wipe') {
      if (r.grade === 'fail') this.toast('DVR', 'NOT ALL OF IT. THE TAPE STILL HAS YOU.');
      else {
        cctvWipe(s);
        wipeFile(st.heat, 'store');
        this.toast('DVR', 'THE TAPE IS CLEAN.');
      }
    }
    this.syncMoneyHook();
  }

  /** The staff door to the back room stands open once picked. */
  private unlockStaffDoor(): void {
    const d = this.inside?.doors.find((q) => q.rule.kind === 'locked');
    if (!d) return;
    d.rule = { kind: 'open' };
    d.open = true;
    this.worldChanged();
  }

  /** Robbery reports reach the police at the store's street door. */
  private robReport(reports: CrimeReport[]): void {
    const at = this.state.streetReturn ?? this.state.player;
    for (const q of reports) {
      let id = this.robIds.get(q.key);
      if (id === undefined) {
        id = ++this.crimeSeq;
        this.robIds.set(q.key, id);
      }
      if (reportCrime(this.state.wanted, this.reported, id, q.stars, at))
        this.toast('POLICE', 'THE STORE CALLED IT IN.');
    }
  }

  /** Walking out: back across the shop floor (on camera), the clerk's call, the face on file, the reputation. */
  private robLeave(): void {
    const s = this.robbery;
    if (!s) return;
    const st = this.state;
    if (s.mode === 'open') onShopFloor(s, !!st.maskOn);
    const res = leaveStore(s);
    this.robbery = null;
    this.robReport(res.reports);
    if (res.take > 0 || s.nerve !== null) st.crimeLog.stores.store = st.minutes;
    if (res.identified && (res.take > 0 || s.nerve !== null)) {
      fileIdentification(st.heat, s.uniform ? 'witness' : cameraSource('store'), st.minutes);
      this.toast('CCTV', 'THE CAMERAS GOT YOUR FACE.');
    }
    if (res.take > 0) this.crimeDone(res.take);
  }

  // ---------------------------------------------------------------- the fence and masks (docs/04, docs/05)

  /** E on a weapon on the ground (docs/07 looting): looted weapons are unregistered. */
  private takeDrop(id: string): void {
    const d = this.combatWorld?.take(id);
    if (!d) return;
    const r = pickUp(this.state.combat, d);
    if (r.text) this.toast('WEAPON', r.text);
    if (r.dropped) {
      const p = this.state.player;
      this.combatWorld?.dropAt(p.x + 8, p.y + 8, { weapon: r.dropped.id, rounds: r.dropped.clip });
    }
  }

  /** The arms dealer's van (docs/07 decisions): weapons, ammo and armor for dirty cash, at night (assumed). */
  private openArms(): void {
    const H = BALANCE.combatWorld.dealerHours;
    if (!isOpen(H, this.minuteOfDay())) {
      this.toast('ARMS DEALER', `NOT NOW. ${formatClock(H.from)} TO ${formatClock(H.to)}.`);
      return;
    }
    this.openPanel('arms', () => armsPage(this.state));
  }

  /** The car stopped in Torque & Sons' bay: one you can drive (yours, or one you've opened). */
  private carForService(): CarView | null {
    const z = this.map.zones?.find((q) => q.id === 'garage_service');
    if (!z) return null;
    return this.cars.find((c) => (c.v.owned || !c.v.locked) && parkedIn(c.v, z)) ?? null;
  }

  /** CAR SERVICE at Torque & Sons (docs/08): repair, upgrades and the respray, in the garage's hours. */
  private openService(): void {
    const H = INTERIORS.garage.hours;
    if (H && !isOpen(H, this.minuteOfDay())) {
      this.toast('TORQUE & SONS', `CLOSED. ${formatClock(H.from)} TO ${formatClock(H.to)}.`);
      return;
    }
    const car = this.carForService();
    if (!car) return;
    const st = this.state;
    const ctx: ServiceCtx = {
      state: st,
      car: car.v,
      respray: () => {
        const m = respray(car.v, this.rng);
        // docs/08: −1★ if nobody sees the car go in
        if (st.wanted.stars > 0 && !st.wanted.seen) dropStars(st.wanted, 1);
        return m;
      },
    };
    this.openPanel('service', () => servicePage(ctx));
  }

  // ---------------------------------------------------------------- property (docs/09, Phase 5)

  /** The home you're in (or under), while inside it or its hideout. */
  private homeHere: HomeId | null = null;
  /** An add-on was built in the hideout: walk back in so its station appears. */
  private rebuildRoom = false;

  private homeInterior(): InteriorDef | null {
    const id = this.homeHere;
    const room = id ? PROPERTY_TYPES[HOMES[id].type].interior : null;
    return room ? INTERIORS[room] : null;
  }

  /** The FOR SALE signs, your front doors and garages, and the burglary doors of houses you own. */
  private refreshHomes(): void {
    for (const id of HOME_IDS) {
      const owned = !!homeOf(this.state.property, id);
      const sign = this.usables.find((u) => u.id === `sale:${id}`);
      if (sign) {
        sign.hidden = owned;
        sign.placed?.sprite.setVisible(!owned);
      }
      const door = this.usables.find((u) => u.id === `home:${id}`);
      if (door) door.hidden = !owned;
      const garage = this.usables.find((u) => u.id === `garage:${id}`);
      if (garage) garage.hidden = !owned;
      const burgle = this.usables.find((u) => u.id === `house:${HOMES[id].door}`);
      if (burgle && owned) burgle.hidden = true;
    }
  }

  private openSale(id: HomeId): void {
    this.openPanel('sale', () => salePage(this.state, id, () => this.refreshHomes()));
  }

  /** Your front door: in, and a 1–2★ wanted level clears if no officer sees you go in (docs/05). */
  private enterHome(id: HomeId): void {
    if (this.busy || !homeOf(this.state.property, id)) return;
    const room = PROPERTY_TYPES[HOMES[id].type].interior;
    const z = this.map.zones?.find((q) => q.id === HOMES[id].door)?.npc;
    if (!room || !z) return;
    const st = this.state;
    const seen = !!this.police?.active && this.police.sees(st.player);
    if (enteredOwnedProperty(st.wanted, seen)) this.toast('HOME', 'INSIDE AND OUT OF SIGHT. THEY LOST YOU.');
    st.streetReturn = { x: z.x, y: z.y + 12 };
    this.homeHere = id;
    const def = INTERIORS[room];
    this.fade(() => this.enterInterior(def, def.entrance ?? { x: 40, y: 40 }));
  }

  private openStash(): void {
    const place = this.inside?.def.id === 'apartment' ? 'apartment' : this.homeHere;
    const box = place ? stashAt(this.state.property, place) : null;
    if (!box) return;
    this.openPanel('stash', () => stashPage(this.state, box, place === 'apartment' ? 'STASH' : 'HOME STASH'));
  }

  private openPlans(): void {
    const id = this.homeHere;
    if (!id) return;
    this.openPanel('plans', () => plansPage(this.state, id, () => (this.rebuildRoom = true)));
  }

  private openWorkbench(): void {
    const id = this.homeHere;
    if (!id) return;
    const st = this.state;
    const car = this.cars.find((c) => {
      const z = this.map.zones?.find((q) => q.id === `park_${id}`);
      return !!z && parkedIn(c.v, z);
    });
    const ctx: WorkbenchCtx = {
      state: st,
      respray: car
        ? () => {
            const m = respray(car.v, this.rng);
            if (st.wanted.stars > 0 && !st.wanted.seen) dropStars(st.wanted, 1);
            return MODEL_COLOUR[m] ?? 'NEW';
          }
        : null,
    };
    this.openPanel('workbench', () => workbenchPage(ctx));
  }

  /** The driveway is the garage (docs/09): store the car standing there, or bring a stored one out. */
  private openGarage(id: HomeId): void {
    const h = homeOf(this.state.property, id);
    const z = this.map.zones?.find((q) => q.id === `park_${id}`);
    const slot = z?.slots?.[0];
    if (!h || !z || !slot) return;
    const ctx: GarageCtx = {
      state: this.state,
      home: h,
      onDriveway: () => this.cars.find((c) => parkedIn(c.v, z) && !c.v.wrecked)?.v ?? null,
      store: () => {
        const c = this.cars.find((q) => parkedIn(q.v, z) && !q.v.wrecked);
        if (!c || this.state.driving === c.v.id) return false;
        c.v.storedAt = id;
        this.removeCar(c, true);
        return true;
      },
      takeOut: (v) => {
        if (this.cars.some((q) => parkedIn(q.v, z))) return false;
        v.storedAt = undefined;
        v.x = slot.x;
        v.y = slot.y;
        v.heading = (slot.dir * Math.PI) / 4;
        v.speed = 0;
        this.addCarView(v);
        return true;
      },
    };
    this.openPanel('garage', () => garagePage(ctx));
  }

  /** Precinct 1's desk sergeant reads out your record (docs/05). */
  private frontDesk(): void {
    const st = this.state;
    const window = BALANCE.wanted.recordDays * 1440;
    const recent = st.record.arrests.filter((m) => st.minutes - m < window).length;
    const known = knownFace(st.heat, st.minutes);
    this.toast(
      'DESK SERGEANT',
      `${recent ? `${recent} ARREST${recent > 1 ? 'S' : ''} IN TWO WEEKS. ` : 'A CLEAN SHEET. '}${known ? 'AND WE KNOW YOUR FACE.' : 'MOVE ALONG.'}`,
    );
  }

  /** M: put the mask on or take it off. Doing it unseen during a chase shortens the escape (docs/05). */
  private toggleMask(): void {
    if (!this.playing || this.state.driving) return;
    const st = this.state;
    if (st.masks.length === 0) {
      this.toast('MASK', 'NO MASK. THE FENCE AT THE PAWN SHOP SELLS THEM.');
      return;
    }
    st.maskOn = st.maskOn ? null : (st.masks[0] ?? null);
    if (st.wanted.stars > 0 && !st.wanted.seen) changedOutfit(this.chase, st.wanted);
    this.setLook(st.look);
    hook().masked = !!st.maskOn;
  }

  // ---------------------------------------------------------------- ATM robbery (docs/04, Phase 3)

  private pendingAtm: { id: string; method: AtmMethod; at: { x: number; y: number } } | null = null;

  /** E on ROB ATM: the drill if one is in the bag (loud, sure), else the hack (silent, a fail trips the alarm). */
  private robAtmStart(id: string, at: { x: number; y: number }): void {
    if (!atmReady(this.state.crimeLog.atms[id], this.state.minutes)) {
      this.toast('ATM', 'EMPTY. WAITING FOR A REFILL.');
      return;
    }
    const method: AtmMethod = this.state.inventory.drill > 0 ? 'drill' : 'hack';
    this.pendingAtm = { id, method, at: { x: at.x, y: at.y } };
    this.openMinigame({
      kind: method === 'drill' ? 'drill' : 'atmHack',
      seed: this.rng.int(1, 2 ** 30),
      label: districtAt(this.map, at.x, at.y),
    });
  }

  private robAtmDone(r: MinigameResult): void {
    const job = this.pendingAtm;
    this.pendingAtm = null;
    if (!job || r.grade === null) return;
    const st = this.state;
    const d = this.disguise();
    const res = robAtm(this.rng, job.method, r.grade as Grade, st.money, {
      downtown: districtAt(this.map, job.at.x, job.at.y) === this.map.name,
      masked: d.masked,
      uniform: d.uniform,
      drillUses: st.inventory.drill,
    });
    st.inventory.drill = res.drillUses;
    // the ATM's own alarm goes straight to the police; anyone who sees (or hears the drill) calls it in
    const id = ++this.crimeSeq;
    for (const q of res.reports)
      if (reportCrime(st.wanted, this.reported, id, q.stars, job.at))
        this.toast('POLICE', 'THE ATM ALARM WENT OFF.');
    if (res.cash > 0 || res.noiseTiles > 0) this.crime(res.stars, job.at, res.noiseTiles);
    if (res.identified && res.cash > 0) fileIdentification(st.heat, cameraSource(job.id), st.minutes);
    if (res.cash > 0) {
      st.crimeLog.atms[job.id] = st.minutes;
      this.toast('ATM', `+$${res.cash} DIRTY.${res.identified ? ' THE CAMERA SAW YOUR FACE.' : ''}`);
      this.crimeDone(res.cash);
    } else this.toast('ATM', r.grade === 'fail' ? 'IT LOCKED UP.' : 'NOTHING CAME OUT.');
    this.syncMoneyHook();
  }

  // ---------------------------------------------------------------- house burglary (docs/04, Phase 3)

  private burglary: BurglaryState | null = null;
  /** The house's street door, where the police get the call. */
  private burgleDoor: { x: number; y: number } | null = null;
  private pendingBurgle: { step: 'door' } | { step: 'panel' } | { step: 'room'; room: number } | null = null;
  private burgleIds = new Map<string, number>();

  /** A house's layout and alarm, the same every time for this game (rolled from the game's seed and the house). */
  private houseFor(id: string): House {
    return rollHouse(new Rng(hashString(`${this.state.seed}:${id}`)), id);
  }

  /** Cars in the driveway today: by day an empty driveway means nobody's home (assumed: half the houses a day). */
  private carsOutside(id: string): boolean {
    const day = calendar(this.state.minutes).day;
    return new Rng(hashString(`${this.state.seed}:${id}:${day}`)).chance(
      BALANCE_CRIME.burglary.carsOutsideChance,
    );
  }

  /** E at a Linden Avenue front door: pick the lock (anyone watching calls it in). */
  private breakIn(id: string, at: { x: number; y: number }): void {
    const st = this.state;
    if (!restocked(st.crimeLog.houses[id], st.minutes, BALANCE_CRIME.burglary.restockMinutes)) {
      this.toast('HOUSE', 'CLEANED OUT ALREADY. NOTHING LEFT WORTH TAKING.');
      return;
    }
    if (this.burglary?.house.id !== id) {
      const house = this.houseFor(id);
      const occupant = rollOccupant(this.rng, this.minuteOfDay(), this.carsOutside(id));
      this.burglary = startBurglary(this.rng, house, occupant, { uniform: this.disguise().uniform });
      this.burgleIds.clear();
    }
    this.burgleDoor = { x: at.x, y: at.y };
    // picking a front door in view of the street is a crime anyone can see
    this.crime(burglaryStars(this.burglary), at);
    this.pendingBurgle = { step: 'door' };
    this.openLockpick('FRONT DOOR');
  }

  private burgleDone(r: MinigameResult): void {
    const p = this.pendingBurgle;
    this.pendingBurgle = null;
    const s = this.burglary;
    if (!p || !s) return;
    const st = this.state;
    if (p.step === 'door') {
      this.wearPicks(r.grade === 'fail' || r.grade === null);
      if (r.grade === null || !pickDoor(s, r.grade as Grade)) return;
      const def = INTERIORS[`house_${s.house.layout}` as InteriorId];
      st.streetReturn = { x: this.burgleDoor?.x ?? st.player.x, y: (this.burgleDoor?.y ?? st.player.y) + 12 };
      this.fade(() => {
        this.enterInterior(def, def.entrance ?? { x: 40, y: 40 });
        if (s.panel === 'armed') this.toast('ALARM', 'THE KEYPAD BEEPS BY THE DOOR. 10 SECONDS!');
        // an owner who is up sees the intruder come in and reaches for the phone
        if (s.occupant === 'awake') {
          ownerSees(s, this.rng);
          this.toast('OWNER', "WHO'S THERE?! I'M CALLING THE POLICE!");
        }
        this.updateNpcs(true);
        this.refreshOwner();
      });
      return;
    }
    if (p.step === 'panel') {
      this.burgleReport(cutHousePanel(s, r.grade !== null && r.grade !== 'fail'));
      this.toast('ALARM', s.panel === 'cut' ? 'ALARM OFF.' : 'THE ALARM IS RINGING!');
      this.refreshOwner();
      return;
    }
    if (r.grade === null) return;
    const taken = searchRoom(s, p.room, r.grade as Grade, st.money);
    const names = taken.map((g) => GOODS_NAMES[g.kind]);
    this.toast('SEARCH', taken.length ? `TOOK ${names.join(', ')}.` : 'NOTHING WORTH TAKING.');
    this.syncMoneyHook();
    this.refreshOwner();
  }

  /** A room's search grid: its goods as glinting items among the junk (no goods icons yet: art debt). */
  private burgleRoom(room: number): void {
    const s = this.burglary;
    if (!s?.doorOpen) return;
    const r = s.rooms[room];
    if (!r || r.searched) {
      this.toast('SEARCH', 'ALREADY TURNED OVER.');
      return;
    }
    const items: LootItem[] = r.goods.map((g) =>
      g.kind === 'cash_tin'
        ? { kind: 'cash', value: g.value }
        : { kind: g.kind === 'jewellery' ? 'watch' : 'phone', value: 0 },
    );
    for (let k = 0; k < BALANCE_CRIME.burglary.junkPerRoom; k++) items.push({ kind: 'junk', value: 0 });
    this.pendingBurgle = { step: 'room', room };
    const name = LAYOUTS[s.house.layout].rooms[room]?.name ?? 'ROOM';
    this.openMinigame({ kind: 'search', seed: this.rng.int(1, 2 ** 30), label: name, items });
  }

  private housePanel(): void {
    const s = this.burglary;
    if (!s || s.panel !== 'armed' || s.panelDeadline === null) {
      this.toast('ALARM', s?.panel === 'cut' ? 'ALREADY CUT.' : 'NOT ARMED.');
      return;
    }
    this.pendingBurgle = { step: 'panel' };
    this.openMinigame({
      kind: 'bypass',
      seed: this.rng.int(1, 2 ** 30),
      label: 'KEYPAD',
      seconds: Math.max(1, s.panelDeadline - s.t),
    });
  }

  private burgleTick(dt: number): void {
    const s = this.burglary;
    if (!s) return;
    const before = s.occupant;
    this.burgleReport(tickBurglary(s, dt, this.rng));
    if (before === 'asleep' && s.occupant === 'calling') {
      this.toast('OWNER', 'A LIGHT GOES ON. SOMEONE IS ON THE PHONE!');
      this.updateNpcs(true);
      this.refreshOwner();
    }
    // walked off without getting in: the job is over
    if (!s.doorOpen && !this.inside && this.burgleDoor) {
      const p = this.state.player;
      if (
        Math.hypot(p.x - this.burgleDoor.x, p.y - this.burgleDoor.y) >
        BALANCE_CRIME.burglary.giveUpTiles * TILE
      )
        this.burglary = null;
    }
  }

  /** The owner's spot is a SCARE THEM OFF prompt while they are on the phone (docs/05: within 2 tiles, E). */
  private refreshOwner(): void {
    this.usables = this.usables.filter((u) => u.id !== 'owner');
    const r = this.inside;
    if (!r || this.burglary?.occupant !== 'calling') return;
    const n = r.json.npcs[0];
    if (n)
      this.usables.push({ id: 'owner', x: n.x, y: n.y, label: 'SCARE THEM OFF', placed: null, door: null });
  }

  private scareOff(): void {
    const s = this.burglary;
    if (s && scareOwner(s)) this.toast('OWNER', 'OKAY! OKAY! TAKE WHAT YOU WANT!');
    this.refreshOwner();
  }

  private burgleReport(reports: CrimeReport[]): void {
    const at = this.burgleDoor ?? this.state.player;
    for (const q of reports) {
      let id = this.burgleIds.get(q.key);
      if (id === undefined) {
        id = ++this.crimeSeq;
        this.burgleIds.set(q.key, id);
      }
      if (reportCrime(this.state.wanted, this.reported, id, q.stars, at))
        this.toast('POLICE', 'THE HOUSE CALLED IT IN.');
    }
  }

  /** Out of the house with the goods: into the bag for the fence, the cash tins already counted, reputation. */
  private burgleLeave(): void {
    const s = this.burglary;
    if (!s) return;
    const st = this.state;
    const res = leaveHouse(s);
    this.burglary = null;
    this.usables = this.usables.filter((u) => u.id !== 'owner');
    st.goods.push(...res.goods);
    if (res.payout > 0) {
      st.crimeLog.houses[s.house.id] = st.minutes;
      this.crimeDone(res.payout);
    }
    if (res.identified) fileIdentification(st.heat, 'witness', st.minutes);
    if (res.goods.length)
      this.toast('GOODS', `${res.goods.length} ITEM${res.goods.length > 1 ? 'S' : ''} FOR THE FENCE.`);
  }

  // ---------------------------------------------------------------- the guided first day (docs/11)

  /** Where the player stood when the guide's first step began on the street. */
  private guideFrom: { x: number; y: number } | null = null;

  private guide(ev: OnboardEvent): void {
    onboardEvent(this.state.onboarding, ev);
  }

  /** Per tick: the cops step ends with no stars, and Dez's evening tip arrives as a phone message. */
  private guideTick(): void {
    const o = this.state.onboarding;
    if (!onboardingActive(o)) return;
    const step = currentStepId(o);
    // new games start on the street: a short walk there ends the first step too
    if (step === 'move' && !this.inside) {
      const p = this.state.player;
      this.guideFrom ??= { x: p.x, y: p.y };
      if (Math.hypot(p.x - this.guideFrom.x, p.y - this.guideFrom.y) >= BALANCE.onboarding.walkToStart)
        this.guide('leftHome');
    }
    if (step === 'cops' && this.state.wanted.stars === 0) this.guide('clear');
    if (tipDue(o, this.state.minutes)) this.toast('DEZ', DEZ_TIP);
  }

  /** Money, health and inventory as the shop sees them (health lives on the player). */
  private wallet(): Wallet {
    const p = this.state.player;
    return {
      money: this.state.money,
      inventory: this.state.inventory,
      discount: legalDiscount(this.state.career),
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
    if (req.kind === 'shop') this.cleanAtShop = this.state.money.clean;
    this.prompt?.setVisible(false);
    hook().minigame = req.kind;
    this.showContextPose();
    // the panel's logic arrives when the scene starts (next frame); until then, nothing stale
    hook().minigameState = null;
    const live = [
      'lockpick',
      'hotwire',
      'search',
      'intimidate',
      'safeCrack',
      'atmHack',
      'drill',
      'wipe',
      'bypass',
    ];
    if (!live.includes(req.kind)) this.scene.pause();
    this.scene.launch('minigame', req);
  }

  private minigameDone(r: MinigameResult): void {
    hook().minigame = null;
    if (this.scene.isPaused()) this.scene.resume();
    // keys pressed in the panel (the hotwire's F terminal, E) must not also act in the world
    this.resumedAt = this.time.now;
    if (this.pendingTrunk) this.trunkMinigameDone(r);
    else if (this.pendingRob || this.pendingBurgle) {
      // the robbery's own lockpicks (staff door, back door) are handled in robDone
    } else if (r.kind === 'lockpick' || r.kind === 'hotwire') this.carMinigameDone(r);
    if (r.kind === 'duffel') this.launderDone(r);
    if (r.kind === 'shop' && this.state.money.clean < this.cleanAtShop) this.guide('bought');
    if (this.pendingGig && r.kind === this.pendingGig) this.gigTaskDone(r);
    if (this.pendingRob) this.robDone(r);
    if (this.pendingAtm) this.robAtmDone(r);
    if (this.pendingBurgle) this.burgleDone(r);
    if (this.pendingTask && r.kind === TASKS[this.pendingTask].game) {
      const task = this.pendingTask;
      this.pendingTask = null;
      const c = this.state.career;
      if (r.grade && c.shift) {
        const boss = JOBS[c.shift.job].bossRef;
        recordTask(c, task, r.grade as Grade);
        const left = tasksLeft(c);
        this.toast(
          TASKS[task].name,
          left > 0
            ? `${r.grade.toUpperCase()}. ${left} TO GO.`
            : `${r.grade.toUpperCase()}. CLOCK OUT WITH ${boss}.`,
        );
      }
      this.updateInteriorObjective();
    }
  }

  private updateInteriorObjective(): void {
    const c = this.state.career;
    const gig = this.state.oddJobs.gig;
    if (gig) {
      const G = GIGS[gig.id];
      const left = gigTasksLeft(this.state.oddJobs);
      this.objective(`${G.name}: ${left} ${G.unit}${left === 1 ? '' : 'S'} LEFT AT ${G.where}`);
      return;
    }
    const here = this.siteJob();
    if (c.shift) {
      const J = JOBS[c.shift.job];
      const left = tasksLeft(c);
      if (left === 0)
        this.objective(here === c.shift.job ? `CLOCK OUT WITH ${J.bossRef}` : `CLOCK OUT: ${J.goTo}`);
      else this.objective(this.shiftObjective(left));
      return;
    }
    const J = JOBS[c.current];
    const m = this.minuteOfDay();
    const workday = BALANCE.careers.workdays.includes((calendar(this.state.minutes).day - 1) % 7);
    if (workday && c.lastShiftDay !== calendar(this.state.minutes).day && m < BALANCE.careers.clockInUntil)
      this.objective(
        here === c.current
          ? `CLOCK IN WITH ${J.bossRef} (08:00-10:00)`
          : `GO TO WORK: ${J.goTo} (08:00-10:00)`,
      );
    else if (outfitOf(this.state.look.outfit).from === 'uniform')
      this.objective('CHANGE OUT OF YOUR UNIFORM: A LOCKER OR YOUR WARDROBE');
    else
      this.objective(
        m >= 20 * 60 || m < 6 * 60
          ? 'GO HOME AND SLEEP: DRIZZLE ROW RESIDENCES'
          : 'EXPLORE THE LEDGER (DOWNTOWN)',
      );
  }

  /** What's next on a shift with `left` tasks to go. */
  private shiftObjective(left: number): string {
    const s = this.state.career.shift;
    if (!s) return '';
    const J = JOBS[s.job];
    const more = `${left} MORE TASK${left > 1 ? 'S' : ''}`;
    if (s.job === 'delivery') {
      const prep = (['loadVan', 'route'] as const).filter((t) => !s.done.includes(t));
      if (prep.length) return `AT THE DEPOT: ${prep.map((t) => TASKS[t].name).join(' AND ')}`;
      // the stops are marked on the radar; the doorstep task finds the right doors from the van
      const stops = (['doorstep', 'signature'] as const).filter((t) => !s.done.includes(t)).length;
      if (stops) return `DELIVER ON LINDEN AVENUE: ${stops} MARKED STOP${stops > 1 ? 'S' : ''}`;
    }
    if (s.job === 'lumberjack') return `DO ${more} IN THE YARD: FELL, CHOP OR LOAD LOGS`;
    return `DO ${more}: ${J.taskHint}`;
  }

  /** Today's delivery drop for a step: the house's front door and its number (null off a delivery shift). */
  private dropFor(task: 'doorstep' | 'signature'): { x: number; y: number; n: number } | null {
    const s = this.state.career.shift;
    if (!s || s.job !== 'delivery') return null;
    const drops = (this.map.zones ?? [])
      .filter((z) => z.id.startsWith('drop_') && z.npc)
      .map((z) => ({ x: z.npc!.x, y: z.npc!.y, n: Number(z.id.slice(5)) }))
      .sort((p, q) => p.n - q.n);
    if (drops.length < 2) return null;
    const [a, b] = deliveryDrops(s.day, drops.length);
    return drops[task === 'doorstep' ? a : b] ?? null;
  }

  /** Gold radar marks for the job (docs/11 objective blips): the drops, the yard spots, or the place to clock. */
  private jobMarks(): { x: number; y: number }[] {
    if (this.inside) return [];
    const c = this.state.career;
    const s = c.shift;
    if (s && tasksLeft(c) > 0) {
      if (s.job === 'delivery')
        return (['doorstep', 'signature'] as const)
          .filter((t) => !taskBlock(c, t))
          .map((t) => this.dropFor(t))
          .filter((d): d is { x: number; y: number; n: number } => d !== null);
      if (s.job === 'lumberjack')
        return this.usables.filter(
          (u) => u.id.startsWith('job:') && jobOfTask(u.id.slice(4) as TaskId) === 'lumberjack',
        );
      return [];
    }
    const job = s?.job ?? c.current;
    const today = calendar(this.state.minutes).day;
    const toClockIn = !s && c.lastShiftDay !== today && this.minuteOfDay() < BALANCE.careers.clockInUntil;
    if (!s && !toClockIn) return [];
    const site = INTERIORS[JOBS[job].site as InteriorId];
    const target = site.street ?? (job === 'office' ? 'tower_lobby' : null);
    const door = (this.map.doors ?? []).find((d) => d.target === target);
    return door ? [{ x: door.x, y: door.y }] : [];
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
      // the last car waits at home: your own driveway once you have one (docs/09), else the apartment's spot
      const own = this.state.property.homes[0];
      const home = this.map.zones?.find((z) => z.id === (own ? `park_${own.id}` : 'home_parking'));
      const last = this.state.vehicles.find((v) => v.id === this.state.lastCar);
      if (!last?.storedAt) parkAtHome(this.state.vehicles, this.state.lastCar, home?.slots ?? []);
    }
    if (this.state.vehicles.length === 0)
      this.map.placements.forEach((p, i) => {
        if (!p.parked) return;
        const model = p.sprite.split('/')[1] as string;
        this.state.vehicles.push(parkedCar(`car${i}`, model, p.x, p.y, p.dir));
      });
    // cars stored in a home's garage (docs/09) wait off the street
    for (const v of this.state.vehicles) if (!v.storedAt) this.addCarView(v);
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
    // a car bought indoors joins the street's usables, which are put away while you're inside
    (this.streetSaved?.usables ?? this.usables).push(usable, trunk);
    this.cars.push({ v, placed, shadow, usable, trunk });
  }

  /** The used-car desk (docs/08): pay, then the car waits in the lot's pickup bay, keyed and full. */
  private buyCar(model: string): string {
    const st = this.state;
    const slot = this.map.zones?.find((z) => z.id === 'dealer_pickup')?.slots?.[0];
    if (!slot) return 'NO CARS TODAY.';
    if (!bayFree(st.vehicles, slot)) return 'MOVE THE CAR IN THE PICKUP BAY FIRST.';
    if (!payDealer(st.money, st.finance, st.minutes, model, legalDiscount(st.career)))
      return 'NOT ENOUGH CLEAN MONEY.';
    const v = boughtCar(`bought${Math.floor(st.minutes)}_${st.vehicles.length}`, model, slot);
    st.vehicles.push(v);
    this.addCarView(v);
    this.syncMoneyHook();
    return 'SOLD. IT IS IN THE PICKUP BAY, KEYS IN.';
  }

  private removeCar(c: CarView, keep = false): void {
    c.placed.sprite.destroy();
    c.shadow.destroy();
    this.cars = this.cars.filter((x) => x !== c);
    this.usables = this.usables.filter((u) => u !== c.usable && u !== c.trunk);
    if (!keep) this.state.vehicles = this.state.vehicles.filter((v) => v !== c.v);
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
    for (const b of this.police?.boxes() ?? []) boxes.push(b.obb);
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
    this.carImpact = Math.max(this.carImpact, impact);
    this.carInput = input;
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
      // your own car's trunk is storage (docs/08); anyone else's is loot, once (docs/12: a looted car stays looted)
      c.trunk.label = v.owned ? 'TRUNK' : 'LOOT TRUNK';
      c.trunk.hidden = (!v.owned && !!v.looted) || v.wrecked || this.state.driving === v.id;
    }
    this.usables = this.usables.filter((u) => !u.id.startsWith('witness:') && !u.id.startsWith('jack:'));
    // docs/08: a traffic car stopped (or crawling) close by can be taken from its driver, at the driver's door
    const J = BALANCE.carjack;
    if (!this.state.driving)
      for (const cv of this.life?.cars ?? []) {
        const t = cv.car;
        if (t.speed > J.maxSpeed) continue;
        const side = stats({ type: typeOfModel(t.model) }).halfWidth + J.doorGap;
        const door = { x: t.x + Math.sin(t.heading) * side, y: t.y - Math.cos(t.heading) * side };
        if (Math.hypot(door.x - this.state.player.x, door.y - this.state.player.y) > J.reachTiles * TILE)
          continue;
        this.usables.push({
          id: `jack:${t.id}`,
          ...door,
          label: 'PULL OUT DRIVER',
          placed: null,
          door: null,
        });
      }
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
    const bay = this.usables.find((u) => u.id === 'zone:garage_service');
    if (bay) bay.hidden = !this.carForService();
    this.refreshHomes();
    const c = this.state.career;
    for (const u of this.usables) {
      if (!u.id.startsWith('job:')) continue;
      const task = u.id.slice(4) as TaskId;
      if (task === 'doorstep' || task === 'signature') {
        const at = this.dropFor(task);
        u.hidden = !at || taskBlock(c, task) !== null;
        if (at) {
          u.x = at.x;
          u.y = at.y;
        }
      } else {
        // the yard spots show for lumberjacks; off shift they say so in red
        const job = jobOfTask(task);
        u.hidden = c.current !== job;
        u.blocked = c.shift?.job !== job;
      }
    }
  }

  /** While driving, E reaches the pumps and Marlo's yard from the car. */
  private driveTarget(): { target: string | null; inRange: string[] } {
    const car = this.drivenCar() as CarView;
    const V = BALANCE.vehicles;
    let best: { id: string; d: number } | null = null;
    for (const u of this.usables) {
      if (u.hidden) continue;
      // from a car only Marlo's yard counts as a zone (the shelter is for people on foot)
      const zone = u.id === 'zone:marlo_spot' || u.id === 'zone:garage_service';
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

  /** docs/08 pulling drivers out: the car is yours to drive (hot, like any stolen car), the driver runs and calls
   *  it in; some swing at you first. */
  private pullOut(id: string): void {
    if (this.busy || !this.life) return;
    const t = this.life.takeCar(id);
    if (!t) return;
    const J = BALANCE.carjack;
    const st = this.state;
    const p = st.player;
    if (this.rng.chance(J.fightShare)) {
      const r = hurt(p, st.combat, J.fightDamage);
      this.toast('DRIVER', 'THE DRIVER SWINGS AT YOU, THEN RUNS.');
      if (r.down) {
        this.playerDown();
        return;
      }
    }
    const v = parkedCar(`jacked${this.jackSeq++}`, t.model, t.x, t.y, dirOf(t.heading));
    v.heading = t.heading;
    v.locked = false;
    v.running = true;
    v.hotUntil = st.minutes + BALANCE.crime.hotMinutes;
    st.vehicles.push(v);
    this.addCarView(v);
    const driver = this.life.addDriver(p.x, p.y, { x: t.x, y: t.y });
    const at = { x: t.x, y: t.y };
    this.crime(BALANCE.wanted.crimeStars.carjack, at);
    // the driver saw it all: always a witness
    if (driver && !driver.call)
      driver.call = {
        t: BALANCE.wanted.callSeconds[1] ?? 0,
        at,
        stars: BALANCE.wanted.crimeStars.carjack,
        crime: this.crimeSeq,
      };
    const c = this.cars.find((x) => x.v.id === v.id);
    if (c) this.getIn(c);
  }

  private jackSeq = 0;

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
      uses: this.state.inventory.lockpicks,
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
    if (c?.v.owned) {
      this.openPanel('trunk', () => trunkPage(this.state, c.v));
      return;
    }
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
    this.guide('looted');
    // docs/04: sometimes a gun in the trunk (Phase 4); unregistered, so it's seized in jail
    const gun = rollTrunkWeapon(this.rng);
    if (gun) {
      const r = pickUp(this.state.combat, gun);
      if (r.text) this.toast('TRUNK', `${r.text}.`);
      if (r.dropped) {
        const p = this.state.player;
        this.combatWorld?.dropAt(p.x + 8, p.y + 8, { weapon: r.dropped.id, rounds: r.dropped.clip });
      }
    }
    // reputation counts the haul at what it's worth: the cash plus the fence's price for phones and watches
    const F = BALANCE_CRIME.fence;
    const worth =
      got.cash +
      haul.filter((i) => i.kind === 'phone').length * F.phone +
      haul.filter((i) => i.kind === 'watch').length * F.watch;
    if (worth > 0) this.crimeDone(worth);
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
        this.crimeDone(price);
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
    for (const b of this.police?.boxes() ?? []) add(b.sprite, b.obb, this.spriteRect(b.sprite));
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
  /**
   * The atlas frame whose shape stands for a sprite in bounds and occlusion tests. A player playing a tool
   * animation (a runtime texture, not in the atlas registry) counts as their idle sprite.
   */
  private geometryFrame(sp: Phaser.GameObjects.Sprite): FrameRef {
    if (sp.texture.key === ACTIONS_TEXTURE) {
      const p = this.state.player;
      return characterFrame(p.costume, 'idle', p.dir);
    }
    return { atlas: sp.texture.key as AtlasKey, frame: sp.frame.name };
  }

  private masked(sp: Phaser.GameObjects.Sprite, frame?: FrameRef): MaskedSprite {
    const g = frame ?? this.geometryFrame(sp);
    const atlas = g.atlas as AtlasKey;
    const name = g.frame;
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

  /** Depth for a small moving thing (an effect) at a ground point, like the player's (syncPlayer). */
  private moverDepth(x: number, y: number): number {
    if (this.inside || !this.map.ground) return depthOf(x, y);
    const s = worldToScreen(x, y);
    const b = { x: s.x - 6, y: s.y - 12, w: 12, h: 14 };
    const near = this.statics.filter((o) => rectsOverlap(o.bounds, b));
    return depthAmong([x - 2, y - 2, x + 2, y + 2], near, -1);
  }

  /** Show the pose for what just opened (the world pauses under most panels, so set it now). */
  private showContextPose(): void {
    this.actions.hold(contextAction(hook().minigame));
    this.syncPlayer();
  }

  private updateFx(dt: number): void {
    this.actions.hold(contextAction(hook().minigame));
    this.actions.update(dt, this.state.player.moving || !!this.drivenCar());
    const fx = this.fx;
    if (!fx) return;
    const car = this.drivenCar();
    const p = this.state.player;
    const sampler = groundSampler(this.map);
    fx.update(dt, {
      walker: car || !this.player ? null : { x: p.x, y: p.y, moving: p.moving, sprinting: p.sprinting },
      car: car
        ? {
            x: car.v.x,
            y: car.v.y,
            heading: car.v.heading,
            speed: car.v.speed,
            running: car.v.running && !car.v.wrecked && car.v.fuel > 0,
            halfLength: stats(car.v).halfLength,
            halfWidth: stats(car.v).halfWidth,
            throttle: this.carInput.throttle,
            handbrake: this.carInput.handbrake,
            impact: this.carImpact,
          }
        : null,
      groundAt: (x, y) => (this.inside ? undefined : sampler(x, y)),
      minutes: this.state.minutes,
      seed: this.state.seed,
      indoors: !!this.inside,
      cash: this.state.money.clean + this.state.money.dirty,
    });
    this.carImpact = 0;
    // a crash shakes the view, in whole screen pixels
    const sh = fx.shakeOffset;
    if (sh.x || sh.y) {
      const cam = this.cameras.main;
      cam.setScroll(cam.scrollX + sh.x / cam.zoom, cam.scrollY + sh.y / cam.zoom);
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
    // an add-on just built at the plans table: walk the room back in so its station stands there
    if (this.rebuildRoom && this.inside && !this.scene.isPaused()) {
      this.rebuildRoom = false;
      const p = this.state.player;
      this.enterInterior(this.inside.def.id === 'hideout' ? INTERIORS.hideout : this.inside.def, {
        x: p.x,
        y: p.y,
      });
    }
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
    // raw frame time, like the simulation (the smoothed delta crawls in slow frames)
    this.updateFx(Math.min(0.1, this.game.loop.rawDelta / 1000));
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
    h.rank = this.state.career.jobs[this.state.career.current].rank;
    h.tasksLeft = this.state.career.shift ? tasksLeft(this.state.career) : -1;
    h.job = this.state.career.current;
    h.shiftDone = [...(this.state.career.shift?.done ?? [])];
    h.objective = this.objectiveText;
    h.rep = this.state.crime.rep;
    h.robbing = !!this.robbery;
    h.goods = this.state.goods.length;
    h.weapon = hudWeapon(this.state.combat);
    h.peds = (this.life?.peds ?? []).map((pv) => ({ x: pv.ped.x, y: pv.ped.y }));
    h.traffic = (this.life?.cars ?? []).map((cv) => ({
      id: cv.car.id,
      x: cv.car.x,
      y: cv.car.y,
      speed: cv.car.speed,
      heading: cv.car.heading,
    }));
    if (this.player) {
      // the camera's world points under canvas pixels (0,0) and (1,1) give the inverse transform
      const cam = this.cameras.main;
      const a = cam.getWorldPoint(0, 0);
      const b = cam.getWorldPoint(1, 1);
      h.playerScreen = { x: (this.player.x - a.x) / (b.x - a.x), y: (this.player.y - a.y) / (b.y - a.y) };
    }
    h.masked = !!this.state.maskOn;
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
      model: v.model,
      owned: !!v.owned,
      hot: v.hotUntil > this.state.minutes,
      flat: !!v.flat,
      stash: v.stash ? v.stash.weapons.length + v.stash.goods.length : 0,
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
        armor: armorShare(p),
        weapon: hudWeapon(this.state.combat),
        aiming: this.state.combat.raised,
        district: districtAt(this.map, this.state.player.x, this.state.player.y),
        street: this.inside ? this.inside.def.name : this.street,
        map: this.map,
        buildings: this.radarBuildings,
        doors: this.map.doors ?? [],
        target: this.target,
        objective:
          this.state.wanted.stars > 0
            ? 'LOSE THE COPS'
            : (onboardHint(this.state.onboarding) ?? this.objectiveText),
        vehicle: this.vehicleReadout(),
        starsFlash: this.state.wanted.stars > 0 && !this.state.wanted.seen,
        search:
          this.state.wanted.stars > 0 && !this.state.wanted.seen && this.state.wanted.lastKnown
            ? { ...this.state.wanted.lastKnown, r: searchRadius(this.state.wanted.stars) }
            : null,
        police: this.police?.blips() ?? [],
        marks: this.jobMarks().map((m) => ({ x: m.x, y: m.y })),
        surrender: this.bustT > 0,
        guide: onboardingActive(this.state.onboarding),
      };
      this.game.events.emit('hud:frame', snap);
    }
  }
}
