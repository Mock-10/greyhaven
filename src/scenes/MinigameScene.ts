// Minigame and menu overlay (docs/06 "Shared framework", docs/11 "Minigame panels", mockup
// art/drafts/hud/hud_mockup_lockpick.png): the world dimmed by 35%, a framed plate beside the player, a gold
// title at 2×. Panels can be dragged by their top strip and remember where they were put. Job tasks and menus
// pause the world (docs/01); crime minigames do too until the police arrive in milestone 4.
// The drawing lives in ui/panels.ts (pure, layout-tested); this scene handles input and timing.

import Phaser from 'phaser';
import { UI_BASE_H, UI_BASE_W } from '../config/constants';
import { Rng } from '../core/rng';
import { hook } from '../debug/hooks';
import { SHOP_STOCK, type ShopId } from '../data/items';
import {
  DataEntryGame,
  DuffelGame,
  FilingGame,
  HotwireGame,
  MoneyCountGame,
  SearchGame,
  SkillCheckGame,
  type MinigameLogic,
} from '../minigames/logic';
import type { Grade } from '../systems/career';
import { BoltTorqueGame } from '../minigames/boltTorque';
import { ChopGame } from '../minigames/chop';
import { DiagnoseGame } from '../minigames/diagnose';
import { DoorstepGame } from '../minigames/doorstep';
import { FellGame } from '../minigames/fell';
import { jobTier } from '../minigames/jobGrade';
import { LoadGame, type LoadMode } from '../minigames/load';
import { MeetingGame } from '../minigames/meeting';
import { ResprayGame } from '../minigames/respray';
import { RouteGame } from '../minigames/route';
import { SignatureGame } from '../minigames/signature';
import { BarShiftGame } from '../minigames/barShift';
import { CarWashGame } from '../minigames/carWash';
import {
  ODD_PANEL_SIZE,
  barGlass,
  barTap,
  carWashArea,
  carWashBucket,
  drawBarShift,
  drawCarWash,
} from '../ui/panelsOdd';
import { StampSignGame } from '../minigames/stampSign';
import { TyreChangeGame, type ArrowDir } from '../minigames/tyreChange';
import {
  JOB_PANEL_SIZE,
  chopMeter,
  diagnoseOption,
  drawBoltTorque,
  drawChop,
  drawDiagnose,
  drawDoorstep,
  drawFell,
  drawSignature,
  doorstepHouse,
  signaturePad,
  drawLoad,
  drawMeeting,
  drawRespray,
  drawRoute,
  drawStampSign,
  drawTyreChange,
  loadBed,
  LOAD_CELL,
  meetingReply,
  resprayArea,
  routeOption,
  type JobPanelKind,
} from '../ui/panelsJobs';
import type { LootItem } from '../systems/loot';
import { buy, type Wallet } from '../systems/shop';
import { blend, clear, createSurface, type Surface } from '../ui/hudDraw';
import { dimAlpha, Presence, transition } from '../ui/anim/transition';
import { Bursts, Shake } from '../ui/anim/motion';
import {
  DRAG_STRIP,
  PANEL_SIZE,
  drawDuffel,
  drawEntry,
  drawHeldStack,
  duffelLayout,
  drawFiling,
  drawHotwire,
  drawLockpick,
  drawMoneyCount,
  drawSearch,
  drawShop,
  filingLayout,
  hotwireLayout,
  searchCell,
  shopCard,
  type PanelKind,
} from '../ui/panels';

export type MinigameRequest =
  | { kind: 'filing' | 'dataEntry'; seed: number; task: string }
  | {
      kind: 'lockpick';
      seed: number;
      tier: number;
      tool: 'none' | 'basic' | 'pro';
      label: string;
      uses?: number;
    }
  | { kind: 'hotwire'; seed: number; bonusSeconds: number }
  | { kind: 'search'; seed: number; label: string; items: LootItem[] }
  | { kind: 'moneyCount'; label: string }
  | { kind: 'duffel'; seed: number; label: string }
  | { kind: 'shop'; title: string; shop: ShopId; wallet: Wallet }
  /** The M7 job tasks (ui/panelsJobs.ts): `rank` sets the bolt-torque tier, `mode` what the load task stacks. */
  | { kind: JobPanelKind; seed: number; task: string; rank: number; mode?: LoadMode }
  /** The weekend odd jobs (ui/panelsOdd.ts): `car` picks the car wash's body colour. */
  | { kind: 'carWash' | 'barShift'; seed: number; task: string; car?: number };

/** Every panel's size: the Phase 1 panels and the job tasks. */
const SIZES: Record<AnyPanel, { w: number; h: number }> = { ...PANEL_SIZE, ...JOB_PANEL_SIZE, ...ODD_PANEL_SIZE };
type AnyPanel = PanelKind | JobPanelKind | 'carWash' | 'barShift';
const ARROWS: Record<string, ArrowDir> = {
  ARROWUP: 'up',
  W: 'up',
  ARROWDOWN: 'down',
  S: 'down',
  ARROWLEFT: 'left',
  A: 'left',
  ARROWRIGHT: 'right',
  D: 'right',
};

export interface MinigameResult {
  kind: MinigameRequest['kind'];
  /** Null when quit with Esc. */
  grade: Grade | null;
  /** The search panel: what was grabbed. */
  haul?: LootItem[];
}

const TEX = 'minigame-canvas';
/** Where each kind of panel was last dragged to, relative to its default spot (kept for the session). */
const offsets = new Map<AnyPanel, { x: number; y: number }>();
const handled = new WeakSet<KeyboardEvent>();

type Rect = { x: number; y: number; w: number; h: number };

export class MinigameScene extends Phaser.Scene {
  private req!: MinigameRequest;
  private z = 1;
  private surface!: Surface;
  private tex: Phaser.Textures.CanvasTexture | null = null;
  private image!: Phaser.GameObjects.Image;
  private logic: MinigameLogic | null = null;
  private resultT = -1;
  private message: { text: string; t: number } | null = null;
  private paperDrag: { dx: number; dy: number; x: number; y: number } | null = null;
  /** A cash stack held by the pointer (duffel): its table slot and where it is. */
  private stackDrag: { slot: number; x: number; y: number } | null = null;
  private panelDrag: { sx: number; sy: number; ox: number; oy: number } | null = null;
  private selected = 0;
  /** Seconds since the panel opened (sparkles). */
  private clock = 0;
  private baseX = 0;
  private baseY = 0;
  private presence = new Presence();
  private bursts = new Bursts(1);
  private shake = new Shake();
  private graded = false;

  constructor() {
    super('minigame');
  }

  init(req: MinigameRequest): void {
    this.req = req;
    this.resultT = -1;
    this.message = null;
    this.paperDrag = null;
    this.stackDrag = null;
    this.panelDrag = null;
    this.selected = 0;
    this.clock = 0;
    this.presence = new Presence();
    this.bursts = new Bursts(req.kind.length);
    this.shake = new Shake();
    this.graded = false;
    switch (req.kind) {
      case 'filing':
        this.logic = new FilingGame(new Rng(req.seed));
        break;
      case 'dataEntry':
        this.logic = new DataEntryGame(new Rng(req.seed));
        break;
      case 'lockpick':
        this.logic = new SkillCheckGame(new Rng(req.seed), req.tier, undefined, req.tool);
        break;
      case 'hotwire':
        this.logic = new HotwireGame(new Rng(req.seed), req.bonusSeconds);
        break;
      case 'moneyCount':
        this.logic = new MoneyCountGame();
        break;
      case 'duffel':
        this.logic = new DuffelGame(new Rng(req.seed));
        break;
      case 'search':
        this.logic = new SearchGame(new Rng(req.seed), req.items);
        break;
      case 'diagnose':
        this.logic = new DiagnoseGame(new Rng(req.seed));
        break;
      case 'boltTorque':
        this.logic = new BoltTorqueGame(new Rng(req.seed), jobTier(req.rank));
        break;
      case 'tyreChange':
        this.logic = new TyreChangeGame(new Rng(req.seed));
        break;
      case 'respray':
        this.logic = new ResprayGame();
        break;
      case 'chop':
        this.logic = new ChopGame(new Rng(req.seed));
        break;
      case 'load':
        this.logic = new LoadGame(new Rng(req.seed), req.mode ?? 'crates');
        break;
      case 'route':
        this.logic = new RouteGame(new Rng(req.seed));
        break;
      case 'stampSign':
        this.logic = new StampSignGame();
        break;
      case 'meeting':
        this.logic = new MeetingGame(new Rng(req.seed));
        break;
      case 'fell':
        this.logic = new FellGame(new Rng(req.seed));
        break;
      case 'doorstep':
        this.logic = new DoorstepGame(new Rng(req.seed));
        break;
      case 'signature':
        this.logic = new SignatureGame(new Rng(req.seed));
        break;
      case 'carWash':
        this.logic = new CarWashGame(new Rng(req.seed), req.car ?? 0);
        break;
      case 'barShift':
        this.logic = new BarShiftGame(new Rng(req.seed));
        break;
      default:
        this.logic = null;
    }
    // read-only, for the smoke test and the screenshot script
    hook().minigameState = this.logic;
  }

  private get kind(): AnyPanel {
    return this.req.kind;
  }

  /** Keys held down (the respray nozzle moves while an arrow is held and sprays while Space is). */
  private held = new Set<string>();
  private pointerHeld = false;

  create(): void {
    this.image = this.add.image(0, 0, '__WHITE').setOrigin(0, 0);
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    const kb = this.input.keyboard;
    kb?.on('keydown', this.onKey, this);
    kb?.on('keyup', this.onKeyUp, this);
    this.held.clear();
    this.pointerHeld = false;
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      kb?.off('keydown', this.onKey, this);
      kb?.off('keyup', this.onKeyUp, this);
      this.input.off('pointerdown', this.onDown, this);
      this.input.off('pointermove', this.onMove, this);
      this.input.off('pointerup', this.onUp, this);
    });
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.z = Math.max(1, Math.floor(Math.min(width / UI_BASE_W, height / UI_BASE_H)));
    const w = Math.ceil(width / this.z);
    const h = Math.ceil(height / this.z);
    this.surface = createSurface(w, h);
    if (this.tex) this.textures.remove(TEX);
    this.tex = this.textures.createCanvas(TEX, w, h);
    this.image.setTexture(TEX).setScale(this.z);
    // beside the player (who stands in the middle of the screen), never over them (docs/11)
    const P = SIZES[this.kind];
    this.baseX = Math.max(4, Math.floor(w / 2) - P.w - 24);
    this.baseY = Math.floor((h - P.h) / 2);
    this.redraw();
  }

  /** Top-left of the panel, after any dragging, kept on screen. */
  private get pos(): { x: number; y: number } {
    const P = SIZES[this.kind];
    const o = offsets.get(this.kind) ?? { x: 0, y: 0 };
    const s = this.surface;
    return {
      x: Math.min(Math.max(0, this.baseX + o.x), s.width - P.w),
      y: Math.min(Math.max(0, this.baseY + o.y), s.height - P.h),
    };
  }

  // ---------------------------------------------------------------- input

  private onKey(e: KeyboardEvent): void {
    // Phaser can hand the same DOM event over more than once when several arrive in one slow frame; a fast
    // money count or lockpick tap must count once
    if (handled.has(e)) return;
    handled.add(e);
    if (e.key === 'Escape') {
      this.close(null);
      return;
    }
    if (this.resultT >= 0) return;
    const g = this.logic;
    const k = e.key.toUpperCase();
    this.held.add(k);
    if (this.jobKey(g, e, k)) return;
    if (g instanceof FilingGame && ['1', '2', '3'].includes(k)) g.file(Number(k) - 1);
    else if (g instanceof DataEntryGame && /^[A-Z]$/.test(k)) g.key(k);
    else if (g instanceof SkillCheckGame && e.key === ' ') g.hit();
    else if (g instanceof HotwireGame) {
      if (/^[1-5]$/.test(k)) g.pickLeft(Number(k) - 1);
      const r = ['A', 'S', 'D', 'F', 'G'].indexOf(k);
      if (r >= 0) g.pickRight(r);
    } else if (g instanceof SearchGame) {
      if (e.key === 'ArrowRight') g.move(1, 0);
      else if (e.key === 'ArrowLeft') g.move(-1, 0);
      else if (e.key === 'ArrowDown') g.move(0, 1);
      else if (e.key === 'ArrowUp') g.move(0, -1);
      else if (e.key === ' ' || e.key === 'Enter') g.grab(g.cursor);
    } else if (g instanceof MoneyCountGame) {
      if (e.key === ' ') g.count();
      if (k === 'B') g.band();
    } else if (this.req.kind === 'shop') {
      const n = SHOP_STOCK[this.req.shop].length;
      if (/^[1-9]$/.test(k) && Number(k) <= n) this.buy(Number(k) - 1);
      else if (e.key === 'ArrowRight') this.selected = (this.selected + 1) % n;
      else if (e.key === 'ArrowLeft') this.selected = (this.selected + n - 1) % n;
      else if (e.key === 'ArrowDown') this.selected = (this.selected + 2) % n;
      else if (e.key === 'ArrowUp') this.selected = (this.selected + n - 2) % n;
      else if (e.key === 'Enter') this.buy(this.selected);
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.held.delete(e.key.toUpperCase());
    if (e.key === ' ' && this.logic instanceof BarShiftGame) this.logic.pour(false);
  }

  /** Keys for the job tasks (PR #15's wiring table). True when the key was theirs. */
  private jobKey(g: MinigameLogic | null, e: KeyboardEvent, k: string): boolean {
    const n = /^[1-9]$/.test(k) ? Number(k) - 1 : -1;
    if (g instanceof DiagnoseGame) {
      if (n >= 0) g.pick(n);
    } else if (g instanceof BoltTorqueGame) {
      if (e.key === ' ') g.hit();
    } else if (g instanceof TyreChangeGame) {
      const d = ARROWS[k];
      if (d) g.press(d);
    } else if (g instanceof ResprayGame) {
      if (e.key === 'Enter') g.finish();
    } else if (g instanceof ChopGame) {
      if (e.key === ' ') g.swing();
    } else if (g instanceof LoadGame) {
      if (k === 'ARROWLEFT' || k === 'A') g.move(-1);
      else if (k === 'ARROWRIGHT' || k === 'D') g.move(1);
      else if (k === 'W' || k === 'ARROWUP') g.turn();
      else if (e.key === ' ' || k === 'S' || k === 'ARROWDOWN') g.drop();
    } else if (g instanceof RouteGame) {
      if (n >= 0) g.pick(n);
    } else if (g instanceof StampSignGame) {
      if (e.key === ' ') g.press();
    } else if (g instanceof MeetingGame) {
      if (n >= 0) g.choose(n);
    } else if (g instanceof FellGame) {
      if (e.key === ' ') g.cut();
    } else if (g instanceof DoorstepGame) {
      if (k === 'ARROWLEFT' || k === 'A') g.move(-1);
      else if (k === 'ARROWRIGHT' || k === 'D') g.move(1);
      else if (e.key === ' ' || e.key === 'Enter') g.deliver();
    } else if (g instanceof SignatureGame) {
      // traced with the mouse only
    } else if (g instanceof CarWashGame) {
      // the sponge moves while a key is held (update); Space scrubs, B dunks, Enter calls the car done
      if (k === 'B' || k === 'E') g.dunk();
      else if (e.key === 'Enter') g.finish();
    } else if (g instanceof BarShiftGame) {
      if (n >= 0) g.select(n);
      else if (e.key === ' ' && !e.repeat) g.pour(true);
    } else return false;
    if (e.key === ' ' || k.startsWith('ARROW')) e.preventDefault?.();
    return true;
  }

  /** Clicks on the job panels' answers, the load bed and the respray door. */
  private jobClick(g: MinigameLogic | null, q: { x: number; y: number }, x: number, y: number): boolean {
    if (g instanceof DiagnoseGame) {
      for (const k of [0, 1, 2, 3]) if (this.inRect(q, diagnoseOption(x, y, k))) g.pick(k);
    } else if (g instanceof RouteGame) {
      for (const k of [0, 1, 2]) if (this.inRect(q, routeOption(x, y, k))) g.pick(k);
    } else if (g instanceof MeetingGame) {
      for (const k of [0, 1, 2]) if (this.inRect(q, meetingReply(x, y, k))) g.choose(k);
    } else if (g instanceof LoadGame) {
      const bed = loadBed(x, y, g);
      if (this.inRect(q, { x: bed.x, y: bed.y - 3 * LOAD_CELL, w: bed.w, h: bed.h + 3 * LOAD_CELL })) {
        g.moveTo(Math.floor((q.x - bed.x) / LOAD_CELL));
        g.drop();
      }
    } else if (g instanceof ResprayGame) {
      this.pointerHeld = true;
      this.aimRespray(g, q);
    } else if (g instanceof BoltTorqueGame) g.hit();
    else if (g instanceof ChopGame) {
      if (this.inRect(q, chopMeter(x, y))) g.swing();
    } else if (g instanceof StampSignGame) g.press();
    else if (g instanceof FellGame) g.cut();
    else if (g instanceof DoorstepGame) {
      for (let k = 0; k < g.numbers.length; k++) if (this.inRect(q, doorstepHouse(x, y, k))) g.goTo(k);
    } else if (g instanceof SignatureGame) {
      const P = signaturePad(x, y, g);
      if (this.inRect(q, P)) g.penDown((q.x - P.x) / P.w, (q.y - P.y) / P.w);
    } else if (g instanceof CarWashGame) {
      if (this.inRect(q, carWashBucket(x, y))) g.dunk();
      else if (this.inRect(q, carWashArea(x, y, g))) {
        this.pointerHeld = true;
        this.aimSponge(g, q);
      }
    } else if (g instanceof BarShiftGame) {
      for (const k of [0, 1, 2]) if (this.inRect(q, barTap(x, y, k))) g.select(k);
      if (this.inRect(q, barGlass(x, y))) g.pour(true);
    } else return false;
    return true;
  }

  private aimSponge(g: CarWashGame, q: { x: number; y: number }): void {
    const a = carWashArea(this.pos.x, this.pos.y, g);
    g.aim((q.x - a.x) / a.w, (q.y - a.y) / a.h);
  }

  private aimRespray(g: ResprayGame, q: { x: number; y: number }): void {
    const { x, y } = this.pos;
    const a = resprayArea(x, y, g);
    g.aim((q.x - a.x) / a.w, (q.y - a.y) / a.h);
  }

  private buy(k: number): void {
    const req = this.req;
    if (req.kind !== 'shop') return;
    const id = SHOP_STOCK[req.shop][k];
    if (!id) return;
    this.selected = k;
    this.message = { text: buy(req.wallet, id).text, t: 0 };
  }

  private ui(p: Phaser.Input.Pointer): { x: number; y: number } {
    return { x: p.x / this.z, y: p.y / this.z };
  }

  private inRect(q: { x: number; y: number }, r: Rect): boolean {
    return q.x >= r.x && q.x < r.x + r.w && q.y >= r.y && q.y < r.y + r.h;
  }

  private onDown(p: Phaser.Input.Pointer): void {
    const q = this.ui(p);
    const { x, y } = this.pos;
    const P = SIZES[this.kind];
    // the top strip drags the panel
    if (this.inRect(q, { x, y, w: P.w, h: DRAG_STRIP })) {
      this.panelDrag = { sx: q.x, sy: q.y, ox: x - this.baseX, oy: y - this.baseY };
      return;
    }
    if (this.resultT >= 0) return;
    const g = this.logic;
    if (this.jobClick(g, q, x, y)) return;
    if (g instanceof FilingGame && !g.done) {
      const L = filingLayout(x, y, g, null);
      if (this.inRect(q, L.paper))
        this.paperDrag = { dx: q.x - L.paper.x, dy: q.y - L.paper.y, x: q.x, y: q.y };
      else
        L.trays.forEach((t, k) => {
          if (this.inRect(q, t)) g.file(k);
        });
    } else if (g instanceof HotwireGame) {
      const L = hotwireLayout(x, y, g.left.length);
      L.left.forEach((pt, k) => {
        if (this.inRect(q, { x: x + 8, y: pt.y - 4, w: 48, h: 16 })) g.pickLeft(k);
      });
      L.right.forEach((pt, k) => {
        if (this.inRect(q, { x: pt.x - 2, y: pt.y - 4, w: 42, h: 16 })) g.pickRight(k);
      });
    } else if (g instanceof SkillCheckGame) g.hit();
    else if (g instanceof MoneyCountGame) g.count();
    else if (g instanceof SearchGame)
      g.cells.forEach((_, k) => {
        if (this.inRect(q, searchCell(x, y, k, g.cols))) g.grab(k);
      });
    else if (g instanceof DuffelGame && !g.done) {
      const L = duffelLayout(x, y, g.stacks.length);
      L.slots.forEach((r, k) => {
        if (!g.stacks[k]!.bagged && this.inRect(q, { x: r.x - 2, y: r.y - 2, w: r.w + 4, h: r.h + 4 }))
          this.stackDrag = { slot: k, x: q.x, y: q.y };
      });
    } else if (this.req.kind === 'shop')
      SHOP_STOCK[this.req.shop].forEach((_, k) => {
        if (this.inRect(q, shopCard(x, y, k))) this.buy(k);
      });
  }

  private onMove(p: Phaser.Input.Pointer): void {
    const q = this.ui(p);
    if (this.panelDrag) {
      offsets.set(this.kind, {
        x: this.panelDrag.ox + (q.x - this.panelDrag.sx),
        y: this.panelDrag.oy + (q.y - this.panelDrag.sy),
      });
      return;
    }
    if (this.logic instanceof ResprayGame && this.pointerHeld) this.aimRespray(this.logic, q);
    else if (this.logic instanceof CarWashGame && this.pointerHeld) this.aimSponge(this.logic, q);
    else if (this.logic instanceof SignatureGame) {
      const P = signaturePad(this.pos.x, this.pos.y, this.logic);
      this.logic.penMove((q.x - P.x) / P.w, (q.y - P.y) / P.w);
    } else if (this.logic instanceof LoadGame) {
      const bed = loadBed(this.pos.x, this.pos.y, this.logic);
      if (q.x >= bed.x && q.x < bed.x + bed.w) this.logic.moveTo(Math.floor((q.x - bed.x) / LOAD_CELL));
    }
    if (this.stackDrag) {
      this.stackDrag.x = q.x;
      this.stackDrag.y = q.y;
    } else if (this.paperDrag) {
      this.paperDrag.x = q.x;
      this.paperDrag.y = q.y;
    } else if (this.req.kind === 'shop') {
      const { x, y } = this.pos;
      SHOP_STOCK[this.req.shop].forEach((_, k) => {
        if (this.inRect(q, shopCard(x, y, k))) this.selected = k;
      });
    }
  }

  private onUp(p: Phaser.Input.Pointer): void {
    this.pointerHeld = false;
    if (this.logic instanceof SignatureGame) this.logic.penUp();
    if (this.logic instanceof BarShiftGame) this.logic.pour(false);
    if (this.panelDrag) {
      // keep the clamped spot, so a panel pushed against an edge comes straight back when dragged again
      const { x, y } = this.pos;
      offsets.set(this.kind, { x: x - this.baseX, y: y - this.baseY });
      this.panelDrag = null;
      return;
    }
    const g = this.logic;
    if (this.stackDrag && g instanceof DuffelGame) {
      const q = this.ui(p);
      const { x, y } = this.pos;
      if (this.inRect(q, duffelLayout(x, y, g.stacks.length).bag)) g.bag(this.stackDrag.slot);
      this.stackDrag = null;
      return;
    }
    if (!this.paperDrag || !(g instanceof FilingGame)) return;
    const q = this.ui(p);
    this.paperDrag = null;
    const { x, y } = this.pos;
    filingLayout(x, y, g, null).trays.forEach((t, k) => {
      if (this.inRect(q, { x: t.x - 4, y: t.y - 10, w: t.w + 8, h: t.h + 14 })) g.file(k);
    });
  }

  // ---------------------------------------------------------------- loop

  update(): void {
    const dt = Math.min(0.1, this.game.loop.rawDelta / 1000);
    this.clock += dt;
    this.presence.update(dt);
    this.bursts.update(dt);
    this.shake.update(dt);
    if (this.message) this.message.t += dt;
    const g = this.logic;
    if (g instanceof ResprayGame && !g.done) {
      const h = this.held;
      const dx = (h.has('ARROWRIGHT') || h.has('D') ? 1 : 0) - (h.has('ARROWLEFT') || h.has('A') ? 1 : 0);
      const dy = (h.has('ARROWDOWN') || h.has('S') ? 1 : 0) - (h.has('ARROWUP') || h.has('W') ? 1 : 0);
      if (dx || dy) g.move(dx, dy, dt);
      g.spray(this.pointerHeld || h.has(' '));
    }
    if (g instanceof CarWashGame && !g.done) {
      const h = this.held;
      const dx = (h.has('ARROWRIGHT') || h.has('D') ? 1 : 0) - (h.has('ARROWLEFT') || h.has('A') ? 1 : 0);
      const dy = (h.has('ARROWDOWN') || h.has('S') ? 1 : 0) - (h.has('ARROWUP') || h.has('W') ? 1 : 0);
      if (dx || dy) g.move(dx, dy, dt);
      g.scrub(this.pointerHeld || h.has(' '));
    }
    if (g) {
      // a held paper doesn't fall
      if (g instanceof FilingGame && this.paperDrag) {
        if (g.last) g.last.t += dt;
      } else g.update(dt);
      if (g.done) {
        if (this.resultT < 0) {
          this.resultT = 0;
          this.celebrate(g.grade);
        }
        this.resultT += dt;
        if (this.resultT > 1.4) this.close(g.grade);
      }
    }
    this.redraw();
  }

  /** The result lands: confetti for a good or excellent job, a shake for a fail (ui/anim/motion.ts). */
  private celebrate(grade: Grade | null): void {
    if (this.graded) return;
    this.graded = true;
    const P = SIZES[this.kind];
    const { x, y } = this.pos;
    if (grade === 'excellent' || grade === 'good')
      this.bursts.emit('confetti', x + P.w / 2, y + P.h / 2, grade === 'excellent' ? 40 : 22, 110);
    else if (grade === 'fail') this.shake.kick();
  }

  private close(grade: Grade | null): void {
    const result: MinigameResult = { kind: this.req.kind, grade };
    if (this.logic instanceof SearchGame) result.haul = this.logic.haul;
    this.scene.stop();
    this.game.events.emit('minigame:done', result);
  }

  // ---------------------------------------------------------------- drawing

  private redraw(): void {
    const s = this.surface;
    if (!s || !this.tex) return;
    clear(s);
    blend(s, 0, s.height, 0, s.width, [20, 14, 24], dimAlpha(0.35, this.presence.t)); // dim the world
    const sh = this.shake.offset;
    const x = this.pos.x + sh.x;
    const y = this.pos.y + sh.y;
    const req = this.req;
    const g = this.logic;
    if (req.kind === 'filing' && g instanceof FilingGame) {
      const d = this.paperDrag;
      drawFiling(s, x, y, g, req.task, d ? { x: d.x - d.dx, y: d.y - d.dy } : null);
    } else if (req.kind === 'dataEntry' && g instanceof DataEntryGame) drawEntry(s, x, y, g, req.task);
    else if (req.kind === 'lockpick' && g instanceof SkillCheckGame)
      drawLockpick(s, x, y, g, req.tier, req.label, req.tool, req.uses ?? 0);
    else if (req.kind === 'hotwire' && g instanceof HotwireGame) drawHotwire(s, x, y, g);
    else if (req.kind === 'moneyCount' && g instanceof MoneyCountGame) drawMoneyCount(s, x, y, g, req.label);
    else if (req.kind === 'duffel' && g instanceof DuffelGame) {
      const d = this.stackDrag;
      drawDuffel(s, x, y, g, req.label, d && !g.done ? d.slot : null);
      if (d && !g.done) drawHeldStack(s, d.x, d.y, g.stacks[d.slot]!.dyed);
    } else if (req.kind === 'search' && g instanceof SearchGame)
      drawSearch(s, x, y, g, req.label, this.clock);
    else if (g instanceof DiagnoseGame && 'task' in req) drawDiagnose(s, x, y, g, req.task);
    else if (g instanceof BoltTorqueGame && 'task' in req) drawBoltTorque(s, x, y, g, req.task);
    else if (g instanceof TyreChangeGame && 'task' in req) drawTyreChange(s, x, y, g, req.task);
    else if (g instanceof ResprayGame && 'task' in req) drawRespray(s, x, y, g, req.task);
    else if (g instanceof ChopGame && 'task' in req) drawChop(s, x, y, g, req.task);
    else if (g instanceof LoadGame && 'task' in req) drawLoad(s, x, y, g, req.task);
    else if (g instanceof RouteGame && 'task' in req) drawRoute(s, x, y, g, req.task);
    else if (g instanceof StampSignGame && 'task' in req) drawStampSign(s, x, y, g, req.task);
    else if (g instanceof MeetingGame && 'task' in req) drawMeeting(s, x, y, g, req.task);
    else if (g instanceof FellGame && 'task' in req) drawFell(s, x, y, g, req.task);
    else if (g instanceof DoorstepGame && 'task' in req) drawDoorstep(s, x, y, g, req.task);
    else if (g instanceof SignatureGame && 'task' in req) drawSignature(s, x, y, g, req.task);
    else if (g instanceof CarWashGame && req.kind === 'carWash') drawCarWash(s, x, y, g, req.task, req.car ?? 0);
    else if (g instanceof BarShiftGame && 'task' in req) drawBarShift(s, x, y, g, req.task);
    else if (req.kind === 'shop')
      drawShop(s, x, y, {
        title: req.title,
        stock: SHOP_STOCK[req.shop],
        clean: req.wallet.money.clean,
        discount: req.wallet.discount ?? 0,
        selected: this.selected,
        message: this.message && this.message.t < 3 ? this.message.text : null,
      });
    transition(s, { x, y, ...SIZES[this.kind] }, this.presence.t);
    this.bursts.draw(s);
    const ctx = this.tex.getContext();
    const img = ctx.createImageData(s.width, s.height);
    img.data.set(s.data);
    ctx.putImageData(img, 0, 0);
    this.tex.refresh();
  }
}
