// The pause menu (docs/11 "Menus", docs/12 saves): resume, save at home, load, export and import. Esc in the world
// opens it and pauses the world. Drawing lives in ui/menus.ts; this scene handles input, storage and files.

import Phaser from 'phaser';
import { UI_BASE_H, UI_BASE_W } from '../config/constants';
import { exportName, SLOTS, AUTO_SLOTS, validate, type SaveFile, type SlotId } from '../core/save';
import { saveStore, type SaveStore } from '../core/storage';
import { hook } from '../debug/hooks';
import type { Params } from '../debug/params';
import { calendar } from '../systems/clock';
import { blend, clear, createSurface, type Surface } from '../ui/hudDraw';
import { drawMenu, MENU_PANEL, menuRow, type MenuRow } from '../ui/menus';
import type { WorldScene } from './WorldScene';

type Mode = 'main' | 'save' | 'load' | 'export' | 'import';

const TEX = 'menu-canvas';
const SLOT_NAMES: Record<SlotId, string> = {
  slot1: 'SLOT 1',
  slot2: 'SLOT 2',
  slot3: 'SLOT 3',
  auto1: 'AUTOSAVE A',
  auto2: 'AUTOSAVE B',
};

/** One line about a save: day, time and cash. */
export function saveSummary(f: SaveFile): string {
  const c = calendar(f.meta.minutes);
  const hh = String(Math.floor(c.minute / 60)).padStart(2, '0');
  const mm = String(c.minute % 60).padStart(2, '0');
  return `DAY ${c.day} ${c.weekday} ${hh}:${mm}  $${f.meta.clean} / $${f.meta.dirty}`;
}

export class MenuScene extends Phaser.Scene {
  private mode: Mode = 'main';
  private selected = 0;
  private message: string | null = null;
  private store: SaveStore | null = null;
  private saves = new Map<SlotId, SaveFile>();
  private importing: SaveFile | null = null;
  private surface!: Surface;
  private tex: Phaser.Textures.CanvasTexture | null = null;
  private image!: Phaser.GameObjects.Image;
  private z = 1;

  constructor() {
    super('menu');
  }

  init(): void {
    this.mode = 'main';
    this.selected = 0;
    this.message = null;
    this.importing = null;
  }

  private get world(): WorldScene {
    return this.scene.get('world') as WorldScene;
  }

  create(): void {
    hook().minigame = 'menu';
    this.image = this.add.image(0, 0, '__WHITE').setOrigin(0, 0);
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    const kb = this.input.keyboard;
    kb?.on('keydown', this.onKey, this);
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      kb?.off('keydown', this.onKey, this);
      this.input.off('pointerdown', this.onDown, this);
      this.input.off('pointermove', this.onMove, this);
    });
    void this.refresh();
  }

  private async refresh(): Promise<void> {
    this.store = await saveStore();
    this.saves.clear();
    for (const f of await this.store.all()) this.saves.set(f.meta.slot, f);
    this.redraw();
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
    this.redraw();
  }

  private get pos(): { x: number; y: number } {
    return {
      x: Math.floor((this.surface.width - MENU_PANEL.w) / 2),
      y: Math.floor((this.surface.height - MENU_PANEL.h) / 2),
    };
  }

  // ---------------------------------------------------------------- rows

  private rows(): MenuRow[] {
    const none = this.store?.kind === 'none';
    const slotRow = (slot: SlotId, emptyOk: boolean): MenuRow => {
      const f = this.saves.get(slot);
      return { label: SLOT_NAMES[slot], detail: f ? saveSummary(f) : 'EMPTY', enabled: !!f || emptyOk };
    };
    switch (this.mode) {
      case 'main': {
        const can = this.world.canSave();
        return [
          { label: 'RESUME', enabled: true },
          {
            label: 'SAVE GAME',
            detail: none ? 'STORAGE OFF' : can.ok ? '' : can.why,
            enabled: !none && can.ok,
          },
          { label: 'LOAD GAME', detail: none ? 'STORAGE OFF' : '', enabled: !none },
          { label: 'EXPORT SAVE', detail: 'DOWNLOAD A BACKUP FILE', enabled: true },
          { label: 'IMPORT SAVE', detail: none ? 'STORAGE OFF' : 'FROM A FILE', enabled: !none },
        ];
      }
      case 'save':
        return SLOTS.map((s) => slotRow(s, true));
      case 'load':
        return [...SLOTS, ...AUTO_SLOTS].map((s) => slotRow(s, false));
      case 'export':
        return [
          { label: 'THIS GAME, NOW', enabled: true },
          ...[...SLOTS, ...AUTO_SLOTS].map((s) => slotRow(s, false)),
        ];
      case 'import':
        return SLOTS.map((s) => slotRow(s, true));
    }
  }

  private get title(): string {
    return { main: 'PAUSED', save: 'SAVE', load: 'LOAD', export: 'EXPORT', import: 'IMPORT TO' }[this.mode];
  }

  // ---------------------------------------------------------------- input

  private onKey(e: KeyboardEvent): void {
    const n = this.rows().length;
    if (e.key === 'Escape') {
      if (this.mode === 'main') this.close();
      else this.back();
    } else if (e.key === 'ArrowDown') this.selected = (this.selected + 1) % n;
    else if (e.key === 'ArrowUp') this.selected = (this.selected + n - 1) % n;
    else if (e.key === 'Enter' || e.key === ' ') void this.choose(this.selected);
    this.redraw();
  }

  private hit(p: Phaser.Input.Pointer): number {
    const q = { x: p.x / this.z, y: p.y / this.z };
    const { x, y } = this.pos;
    return this.rows().findIndex((_, k) => {
      const r = menuRow(x, y, k);
      return q.x >= r.x && q.x < r.x + r.w && q.y >= r.y && q.y < r.y + r.h;
    });
  }

  private onMove(p: Phaser.Input.Pointer): void {
    const k = this.hit(p);
    if (k >= 0 && k !== this.selected) {
      this.selected = k;
      this.redraw();
    }
  }

  private onDown(p: Phaser.Input.Pointer): void {
    const k = this.hit(p);
    if (k >= 0) void this.choose(k);
  }

  private back(): void {
    this.mode = 'main';
    this.selected = 0;
    this.importing = null;
  }

  private async choose(k: number): Promise<void> {
    const row = this.rows()[k];
    if (!row) return;
    this.selected = k;
    if (!row.enabled) {
      this.message = row.detail || 'NOT AVAILABLE';
      this.redraw();
      return;
    }
    this.message = null;
    if (this.mode === 'main') {
      if (k === 0) return this.close();
      this.mode = (['main', 'save', 'load', 'export', 'import'] as const)[k] as Mode;
      this.selected = 0;
      if (this.mode === 'import') {
        this.mode = 'main';
        this.pickFile();
      }
    } else if (this.mode === 'save') {
      const slot = SLOTS[k] as SlotId;
      const err = await this.world.saveTo(slot);
      this.message = err ?? `SAVED TO ${SLOT_NAMES[slot]}`;
      await this.refresh();
    } else if (this.mode === 'load') {
      const slot = [...SLOTS, ...AUTO_SLOTS][k] as SlotId;
      const f = this.saves.get(slot);
      if (f) this.loadSave(f);
      return;
    } else if (this.mode === 'export') {
      const f =
        k === 0
          ? this.world.snapshotSave('slot1')
          : this.saves.get([...SLOTS, ...AUTO_SLOTS][k - 1] as SlotId);
      if (f) this.download(f);
      this.message = 'FILE DOWNLOADED';
    } else if (this.mode === 'import' && this.importing && this.store) {
      const slot = SLOTS[k] as SlotId;
      const file = { ...this.importing, meta: { ...this.importing.meta, slot } };
      try {
        await this.store.put(file);
        this.message = `IMPORTED TO ${SLOT_NAMES[slot]}`;
      } catch {
        this.message = 'COULD NOT IMPORT';
      }
      this.importing = null;
      this.mode = 'main';
      this.selected = 2;
      await this.refresh();
    }
    this.redraw();
  }

  private loadSave(f: SaveFile): void {
    const params = this.registry.get('params') as Params;
    this.registry.set('pendingLoad', f);
    hook().minigame = null;
    this.scene.stop();
    const world = this.scene.get('world');
    world.scene.restart({ ...params, scene: 'world' });
  }

  private download(f: SaveFile): void {
    const blob = new Blob([JSON.stringify(f)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = exportName(f);
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  private pickFile(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const res = validate(JSON.parse(await file.text()));
        if (!res.ok) this.message = res.error;
        else {
          this.importing = res.file;
          this.mode = 'import';
          this.selected = 0;
          this.message = saveSummary(res.file);
        }
      } catch {
        this.message = 'NOT A SAVE FILE';
      }
      this.redraw();
    };
    input.click();
  }

  private close(): void {
    hook().minigame = null;
    this.scene.stop();
    this.game.events.emit('menu:closed');
  }

  // ---------------------------------------------------------------- drawing

  private redraw(): void {
    const s = this.surface;
    if (!s || !this.tex) return;
    clear(s);
    blend(s, 0, s.height, 0, s.width, [20, 14, 24], 0.45);
    const { x, y } = this.pos;
    const footer =
      this.store?.kind === 'none'
        ? 'BROWSER STORAGE IS OFF HERE: EXPORT ONLY'
        : this.mode === 'main'
          ? null
          : 'SAVES LIVE IN THIS BROWSER ONLY. EXPORT TO BACK UP.';
    drawMenu(s, x, y, this.title, 'GREYHAVEN', this.rows(), this.selected, footer, this.message);
    const ctx = this.tex.getContext();
    const img = ctx.createImageData(s.width, s.height);
    img.data.set(s.data);
    ctx.putImageData(img, 0, 0);
    this.tex.refresh();
  }
}
