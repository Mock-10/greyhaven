// Minigame and menu overlay (docs/06 "Shared framework", docs/11 "Minigame panels", mockup
// art/drafts/hud/hud_mockup_lockpick.png): the world dimmed by 35%, a framed plate beside the player, a gold
// title at 2×. Panels can be dragged by their top strip and remember where they were put. Job tasks and menus
// pause the world (docs/01); crime minigames do too until the police arrive in milestone 4.
// The drawing lives in ui/panels.ts (pure, layout-tested); this scene handles input and timing.

import Phaser from 'phaser';
import { UI_BASE_H, UI_BASE_W } from '../config/constants';
import { Rng } from '../core/rng';
import { hook } from '../debug/hooks';
import { SHOP_STOCK } from '../data/items';
import {
  DataEntryGame,
  DuffelGame,
  FilingGame,
  HotwireGame,
  MoneyCountGame,
  SkillCheckGame,
  type MinigameLogic,
} from '../minigames/logic';
import type { Grade } from '../systems/career';
import { buy, type Wallet } from '../systems/shop';
import { blend, clear, createSurface, type Surface } from '../ui/hudDraw';
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
  drawShop,
  filingLayout,
  hotwireLayout,
  shopCard,
  type PanelKind,
} from '../ui/panels';

export type MinigameRequest =
  | { kind: 'filing' | 'dataEntry'; seed: number; task: string }
  | { kind: 'lockpick'; seed: number; tier: number; tool: string }
  | { kind: 'hotwire'; seed: number }
  | { kind: 'moneyCount'; label: string }
  | { kind: 'duffel'; seed: number; label: string }
  | { kind: 'shop'; title: string; wallet: Wallet };

export interface MinigameResult {
  kind: MinigameRequest['kind'];
  /** Null when quit with Esc. */
  grade: Grade | null;
}

const TEX = 'minigame-canvas';
/** Where each kind of panel was last dragged to, relative to its default spot (kept for the session). */
const offsets = new Map<PanelKind, { x: number; y: number }>();
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
  private baseX = 0;
  private baseY = 0;

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
    switch (req.kind) {
      case 'filing':
        this.logic = new FilingGame(new Rng(req.seed));
        break;
      case 'dataEntry':
        this.logic = new DataEntryGame(new Rng(req.seed));
        break;
      case 'lockpick':
        this.logic = new SkillCheckGame(new Rng(req.seed), req.tier);
        break;
      case 'hotwire':
        this.logic = new HotwireGame(new Rng(req.seed));
        break;
      case 'moneyCount':
        this.logic = new MoneyCountGame();
        break;
      case 'duffel':
        this.logic = new DuffelGame(new Rng(req.seed));
        break;
      default:
        this.logic = null;
    }
    // read-only, for the smoke test and the screenshot script
    hook().minigameState = this.logic;
  }

  private get kind(): PanelKind {
    return this.req.kind;
  }

  create(): void {
    this.image = this.add.image(0, 0, '__WHITE').setOrigin(0, 0);
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    const kb = this.input.keyboard;
    kb?.on('keydown', this.onKey, this);
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      kb?.off('keydown', this.onKey, this);
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
    const P = PANEL_SIZE[this.kind];
    this.baseX = Math.max(4, Math.floor(w / 2) - P.w - 24);
    this.baseY = Math.floor((h - P.h) / 2);
    this.redraw();
  }

  /** Top-left of the panel, after any dragging, kept on screen. */
  private get pos(): { x: number; y: number } {
    const P = PANEL_SIZE[this.kind];
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
    if (g instanceof FilingGame && ['1', '2', '3'].includes(k)) g.file(Number(k) - 1);
    else if (g instanceof DataEntryGame && /^[A-Z]$/.test(k)) g.key(k);
    else if (g instanceof SkillCheckGame && e.key === ' ') g.hit();
    else if (g instanceof HotwireGame) {
      if (/^[1-5]$/.test(k)) g.pickLeft(Number(k) - 1);
      const r = ['A', 'S', 'D', 'F', 'G'].indexOf(k);
      if (r >= 0) g.pickRight(r);
    } else if (g instanceof MoneyCountGame) {
      if (e.key === ' ') g.count();
      if (k === 'B') g.band();
    } else if (this.req.kind === 'shop') {
      const n = SHOP_STOCK.store.length;
      if (/^[1-9]$/.test(k) && Number(k) <= n) this.buy(Number(k) - 1);
      else if (e.key === 'ArrowRight') this.selected = (this.selected + 1) % n;
      else if (e.key === 'ArrowLeft') this.selected = (this.selected + n - 1) % n;
      else if (e.key === 'ArrowDown') this.selected = (this.selected + 2) % n;
      else if (e.key === 'ArrowUp') this.selected = (this.selected + n - 2) % n;
      else if (e.key === 'Enter') this.buy(this.selected);
    }
  }

  private buy(k: number): void {
    const req = this.req;
    const id = SHOP_STOCK.store[k];
    if (req.kind !== 'shop' || !id) return;
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
    const P = PANEL_SIZE[this.kind];
    // the top strip drags the panel
    if (this.inRect(q, { x, y, w: P.w, h: DRAG_STRIP })) {
      this.panelDrag = { sx: q.x, sy: q.y, ox: x - this.baseX, oy: y - this.baseY };
      return;
    }
    if (this.resultT >= 0) return;
    const g = this.logic;
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
        if (this.inRect(q, { x: x + 8, y: pt.y - 3, w: 34, h: 12 })) g.pickLeft(k);
      });
      L.right.forEach((pt, k) => {
        if (this.inRect(q, { x: pt.x - 2, y: pt.y - 3, w: 32, h: 12 })) g.pickRight(k);
      });
    } else if (g instanceof SkillCheckGame) g.hit();
    else if (g instanceof MoneyCountGame) g.count();
    else if (g instanceof DuffelGame && !g.done) {
      const L = duffelLayout(x, y, g.stacks.length);
      L.slots.forEach((r, k) => {
        if (!g.stacks[k]!.bagged && this.inRect(q, { x: r.x - 2, y: r.y - 2, w: r.w + 4, h: r.h + 4 }))
          this.stackDrag = { slot: k, x: q.x, y: q.y };
      });
    } else if (this.req.kind === 'shop')
      SHOP_STOCK.store.forEach((_, k) => {
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
    if (this.stackDrag) {
      this.stackDrag.x = q.x;
      this.stackDrag.y = q.y;
    } else if (this.paperDrag) {
      this.paperDrag.x = q.x;
      this.paperDrag.y = q.y;
    } else if (this.req.kind === 'shop') {
      const { x, y } = this.pos;
      SHOP_STOCK.store.forEach((_, k) => {
        if (this.inRect(q, shopCard(x, y, k))) this.selected = k;
      });
    }
  }

  private onUp(p: Phaser.Input.Pointer): void {
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
    if (this.message) this.message.t += dt;
    const g = this.logic;
    if (g) {
      // a held paper doesn't fall
      if (g instanceof FilingGame && this.paperDrag) {
        if (g.last) g.last.t += dt;
      } else g.update(dt);
      if (g.done) {
        if (this.resultT < 0) this.resultT = 0;
        this.resultT += dt;
        if (this.resultT > 1.4) this.close(g.grade);
      }
    }
    this.redraw();
  }

  private close(grade: Grade | null): void {
    const result: MinigameResult = { kind: this.req.kind, grade };
    this.scene.stop();
    this.game.events.emit('minigame:done', result);
  }

  // ---------------------------------------------------------------- drawing

  private redraw(): void {
    const s = this.surface;
    if (!s || !this.tex) return;
    clear(s);
    blend(s, 0, s.height, 0, s.width, [20, 14, 24], 0.35); // dim the world
    const { x, y } = this.pos;
    const req = this.req;
    const g = this.logic;
    if (req.kind === 'filing' && g instanceof FilingGame) {
      const d = this.paperDrag;
      drawFiling(s, x, y, g, req.task, d ? { x: d.x - d.dx, y: d.y - d.dy } : null);
    } else if (req.kind === 'dataEntry' && g instanceof DataEntryGame) drawEntry(s, x, y, g, req.task);
    else if (req.kind === 'lockpick' && g instanceof SkillCheckGame)
      drawLockpick(s, x, y, g, req.tier, req.tool);
    else if (req.kind === 'hotwire' && g instanceof HotwireGame) drawHotwire(s, x, y, g);
    else if (req.kind === 'moneyCount' && g instanceof MoneyCountGame) drawMoneyCount(s, x, y, g, req.label);
    else if (req.kind === 'duffel' && g instanceof DuffelGame) {
      const d = this.stackDrag;
      drawDuffel(s, x, y, g, req.label, d && !g.done ? d.slot : null);
      if (d && !g.done) drawHeldStack(s, d.x, d.y, g.stacks[d.slot]!.dyed);
    } else if (req.kind === 'shop')
      drawShop(s, x, y, {
        title: req.title,
        stock: SHOP_STOCK.store,
        clean: req.wallet.money.clean,
        selected: this.selected,
        message: this.message && this.message.t < 3 ? this.message.text : null,
      });
    const ctx = this.tex.getContext();
    const img = ctx.createImageData(s.width, s.height);
    img.data.set(s.data);
    ctx.putImageData(img, 0, 0);
    this.tex.refresh();
  }
}
