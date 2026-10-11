// Minigame and menu overlay (docs/06 "Shared framework", docs/11 "Minigame panels", mockup
// art/drafts/hud/hud_mockup_lockpick.png): the world dimmed by 35%, a 176 × 128 framed plate beside the player,
// a gold title at 2×. Job tasks and menus pause the world (docs/01); the world scene resumes when this closes.
//   filing      papers drop in; drag each into the tray of its colour (or press 1–3) and it gets stamped
//   dataEntry   type the key sequences before the time runs out
//   shop        the corner store's basics, clean cash only
// Drawn with the hud.py primitives into one canvas at UI resolution, scaled by a whole number like the HUD.

import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { UI_BASE_H, UI_BASE_W } from '../config/constants';
import { Rng } from '../core/rng';
import { ITEMS, SHOP_STOCK, type ItemId } from '../data/items';
import { DataEntryGame, FilingGame, TRAY_COLOURS } from '../minigames/logic';
import type { Grade } from '../systems/career';
import { buy, priceOf, type Wallet } from '../systems/shop';
import {
  C,
  bar,
  blend,
  clear,
  createSurface,
  hintKeys,
  plate,
  text,
  textWidthPx,
  type RGB,
  type Surface,
} from '../ui/hudDraw';

export type MinigameRequest =
  | { kind: 'filing' | 'dataEntry'; seed: number; task: string }
  | { kind: 'shop'; title: string; wallet: Wallet };

export interface MinigameResult {
  kind: MinigameRequest['kind'];
  /** Null when quit with Esc (a job task then doesn't count). */
  grade: Grade | null;
}

const TEX = 'minigame-canvas';
const PW = 176;
const PH = 128;
const TRAY_RGB: Record<(typeof TRAY_COLOURS)[number], RGB> = {
  red: [185, 94, 94],
  navy: [94, 114, 160],
  sage: [117, 134, 114],
};
const GRADE_TEXT: Record<Grade, string> = {
  fail: 'FAILED',
  poor: 'POOR',
  ok: 'OK',
  good: 'GOOD',
  excellent: 'EXCELLENT',
};

export class MinigameScene extends Phaser.Scene {
  private req!: MinigameRequest;
  private z = 1;
  private surface!: Surface;
  private tex: Phaser.Textures.CanvasTexture | null = null;
  private image!: Phaser.GameObjects.Image;
  private filing: FilingGame | null = null;
  private entry: DataEntryGame | null = null;
  private resultT = -1;
  private message: { text: string; t: number } | null = null;
  private drag: { dx: number; dy: number; x: number; y: number } | null = null;
  private px = 0;
  private py = 0;

  constructor() {
    super('minigame');
  }

  init(req: MinigameRequest): void {
    this.req = req;
    this.filing = null;
    this.entry = null;
    this.resultT = -1;
    this.message = null;
    this.drag = null;
    if (req.kind === 'filing') this.filing = new FilingGame(new Rng(req.seed));
    if (req.kind === 'dataEntry') this.entry = new DataEntryGame(new Rng(req.seed));
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
    this.game.events.emit('minigame:open', this.req.kind);
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
    this.px = Math.max(4, Math.floor(w / 2) - PW - 24);
    this.py = Math.floor((h - PH) / 2);
    this.redraw();
  }

  // ---------------------------------------------------------------- input

  private onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.close(null);
      return;
    }
    if (this.resultT >= 0) return;
    if (this.filing && ['1', '2', '3'].includes(e.key)) this.filing.file(Number(e.key) - 1);
    else if (this.entry && /^[a-zA-Z]$/.test(e.key)) this.entry.key(e.key);
    else if (this.req.kind === 'shop' && /^[1-9]$/.test(e.key)) {
      const id = SHOP_STOCK.store[Number(e.key) - 1];
      if (id) this.message = { text: buy(this.req.wallet, id).text, t: 0 };
    }
  }

  private uiPointer(p: Phaser.Input.Pointer): { x: number; y: number } {
    return { x: p.x / this.z, y: p.y / this.z };
  }

  private paperRect(): { x: number; y: number; w: number; h: number } {
    const f = this.filing as FilingGame;
    const top = this.py + 24;
    const span = 34;
    if (this.drag) return { x: this.drag.x - this.drag.dx, y: this.drag.y - this.drag.dy, w: 22, h: 26 };
    return { x: this.px + 38, y: Math.round(top + f.fall * span), w: 22, h: 26 };
  }

  private trayRect(k: number): { x: number; y: number; w: number; h: number } {
    return { x: this.px + 8 + k * 30, y: this.py + 88, w: 26, h: 10 };
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (!this.filing || this.filing.done || this.resultT >= 0) return;
    const q = this.uiPointer(p);
    const r = this.paperRect();
    if (q.x >= r.x && q.x < r.x + r.w && q.y >= r.y && q.y < r.y + r.h)
      this.drag = { dx: q.x - r.x, dy: q.y - r.y, x: q.x, y: q.y };
    else
      for (let k = 0; k < 3; k++) {
        const t = this.trayRect(k);
        if (q.x >= t.x && q.x < t.x + t.w && q.y >= t.y && q.y < t.y + t.h) this.filing.file(k);
      }
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (!this.drag) return;
    const q = this.uiPointer(p);
    this.drag.x = q.x;
    this.drag.y = q.y;
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (!this.drag || !this.filing) return;
    const q = this.uiPointer(p);
    this.drag = null;
    for (let k = 0; k < 3; k++) {
      const t = this.trayRect(k);
      if (q.x >= t.x - 4 && q.x < t.x + t.w + 4 && q.y >= t.y - 10 && q.y < t.y + t.h + 4)
        this.filing.file(k);
    }
  }

  // ---------------------------------------------------------------- loop

  update(_t: number, deltaMs: number): void {
    const dt = Math.min(0.1, this.game.loop.rawDelta / 1000 || deltaMs / 1000);
    if (this.message) this.message.t += dt;
    const g = this.filing ?? this.entry;
    if (g) {
      // a held paper doesn't fall
      if (!(this.filing && this.drag)) g.update(dt);
      else if (this.filing.last) this.filing.last.t += dt;
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
    const x = this.px;
    const y = this.py;
    plate(s, x, y, PW, PH, C.EDGE, 0.96);
    const req = this.req;
    if (req.kind === 'filing') this.drawFiling(s, x, y);
    else if (req.kind === 'dataEntry') this.drawEntry(s, x, y);
    else if (req.kind === 'shop') this.drawShop(s, x, y, req.title, req.wallet);
    const ctx = this.tex.getContext();
    const img = ctx.createImageData(s.width, s.height);
    img.data.set(s.data);
    ctx.putImageData(img, 0, 0);
    this.tex.refresh();
  }

  private title(s: Surface, x: number, y: number, t: string, right: string): void {
    text(s, x + 8, y + 7, t, C.GOLD, C.INK, 2);
    text(s, x + PW - 8 - textWidthPx(right), y + 9, right, C.MUTED);
  }

  private result(s: Surface, x: number, y: number, grade: Grade | null): void {
    if (this.resultT < 0 || !grade) return;
    blend(s, y + 40, y + 76, x + 1, x + PW - 1, C.PLATE, 0.96);
    const t = GRADE_TEXT[grade];
    const col = grade === 'fail' || grade === 'poor' ? C.RED3 : C.GOLD;
    text(s, x + Math.round((PW - textWidthPx(t, 2)) / 2), y + 52, t, col, C.INK, 2);
    text(s, x + Math.round((PW - textWidthPx('TASK DONE')) / 2), y + 44, 'TASK DONE', C.MUTED);
  }

  private drawFiling(s: Surface, x: number, y: number): void {
    const f = this.filing as FilingGame;
    const req = this.req as { task: string };
    this.title(s, x, y, 'FILING', req.task);
    // chute
    blend(s, y + 22, y + 85, x + 8, x + 92, C.INK);
    blend(s, y + 22, y + 23, x + 8, x + 92, C.PLATE_HI);
    // paper
    if (!f.done && f.current) {
      const r = this.paperRect();
      const col = TRAY_RGB[f.current];
      blend(s, r.y + 1, r.y + r.h + 1, r.x + 1, r.x + r.w + 1, C.INK, 0.6);
      blend(s, r.y, r.y + r.h, r.x, r.x + r.w, C.CREAM);
      blend(s, r.y, r.y + 6, r.x, r.x + r.w, col);
      for (let k = 0; k < 5; k++)
        blend(s, r.y + 9 + k * 3, r.y + 10 + k * 3, r.x + 3, r.x + r.w - 3 - (k % 2) * 5, C.MUTED);
    }
    // stamp on the last paper
    if (f.last && f.last.t < 0.6) {
      const t = this.trayRect(f.last.tray);
      const word = f.last.ok ? 'FILED' : 'WRONG';
      const col = f.last.ok ? C.SAGE4 : C.RED3;
      plate(s, t.x - 2, t.y - 14, textWidthPx(word) + 6, 10, col, 0.9);
      text(s, t.x + 1, t.y - 12, word, col);
    }
    // trays
    TRAY_COLOURS.forEach((c, k) => {
      const t = this.trayRect(k);
      blend(s, t.y, t.y + t.h, t.x, t.x + t.w, TRAY_RGB[c]);
      blend(s, t.y, t.y + 2, t.x, t.x + t.w, C.INK, 0.4);
      text(
        s,
        t.x + Math.round((t.w - textWidthPx(String(k + 1))) / 2),
        t.y + 3,
        String(k + 1),
        C.CREAM,
        C.INK,
      );
    });
    // right column
    const rx = x + 100;
    const total = f.papers.length;
    text(s, rx, y + 26, 'PROGRESS', C.MUTED);
    bar(s, rx, y + 34, 66, 7, f.index / total, C.GOLD, C.GOLD_LO);
    text(s, rx, y + 48, `FILED ${f.correct}`, C.CREAM);
    text(s, rx, y + 57, `MISFILED ${f.misfiled}`, f.misfiled ? C.RED3 : C.MUTED);
    text(s, rx, y + 66, `DROPPED ${f.missed}`, f.missed ? C.RED3 : C.MUTED);
    text(s, rx, y + 80, 'DRAG TO A TRAY', C.MUTED);
    hintKeys(s, x + 8, y + PH - 16, [
      ['1-3', 'FILE'],
      ['ESC', 'QUIT'],
    ]);
    this.result(s, x, y, f.grade);
  }

  private drawEntry(s: Surface, x: number, y: number): void {
    const e = this.entry as DataEntryGame;
    const req = this.req as { task: string };
    this.title(s, x, y, 'DATA ENTRY', req.task);
    const word = e.word;
    const kw = 13;
    const wx = x + Math.round((PW - word.length * (kw + 3)) / 2);
    text(s, x + 8, y + 30, `RECORD ${Math.min(e.round + 1, e.rounds.length)}/${e.rounds.length}`, C.MUTED);
    [...word].forEach((ch, k) => {
      const kx = wx + k * (kw + 3);
      const ky = y + 44;
      const done = k < e.pos;
      const cur = k === e.pos && !e.done;
      const face: RGB = done ? C.SAGE1 : cur ? C.GOLD : C.CREAM;
      blend(s, ky, ky + kw, kx, kx + kw, face);
      blend(s, ky + kw - 2, ky + kw, kx, kx + kw, done ? C.INK : C.GOLD_LO);
      text(s, kx + Math.round((kw - textWidthPx(ch)) / 2), ky + 3, ch, done ? C.SAGE4 : C.PLATE);
    });
    const wrong = e.wrongT < 0.3;
    if (wrong) blend(s, y + 40, y + 41, x + 8, x + PW - 8, C.RED3);
    text(s, x + 8, y + 70, 'TIME', C.MUTED);
    bar(s, x + 32, y + 69, PW - 40, 7, e.timeLeft / e.timeTotal, C.GOLD, C.GOLD_LO);
    text(s, x + 8, y + 82, `ERRORS ${e.errors}`, e.errors ? C.RED3 : C.MUTED);
    hintKeys(s, x + 8, y + PH - 16, [
      ['A-Z', 'TYPE'],
      ['ESC', 'QUIT'],
    ]);
    this.result(s, x, y, e.grade);
  }

  private drawShop(s: Surface, x: number, y: number, title: string, w: Wallet): void {
    this.title(s, x, y, 'SHOP', title);
    const stock = SHOP_STOCK.store;
    stock.forEach((id: ItemId, k) => {
      const ry = y + 28 + k * 16;
      const price = priceOf(id);
      const can = w.money.clean >= price;
      blend(s, ry, ry + 9, x + 8, x + 17, C.GOLD);
      blend(s, ry + 8, ry + 9, x + 8, x + 17, C.GOLD_LO);
      text(s, x + 11, ry + 2, String(k + 1), C.PLATE);
      text(s, x + 22, ry + 2, ITEMS[id].name, can ? C.CREAM : C.MUTED);
      const heal = BALANCE.shop[id].heal;
      if (heal) text(s, x + 82, ry + 2, `+${heal} HP`, C.MUTED);
      const pt = `$${price}`;
      text(s, x + PW - 8 - textWidthPx(pt), ry + 2, pt, can ? C.GOLD : C.RED3);
    });
    text(s, x + 8, y + 80, `CLEAN CASH $${w.money.clean}`, C.CREAM);
    text(s, x + 8, y + 89, 'DIRTY CASH NOT ACCEPTED', C.MUTED);
    if (this.message && this.message.t < 3) text(s, x + 8, y + 100, this.message.text, C.SAGE4);
    hintKeys(s, x + 8, y + PH - 16, [
      ['1-3', 'BUY'],
      ['ESC', 'LEAVE'],
    ]);
  }
}
