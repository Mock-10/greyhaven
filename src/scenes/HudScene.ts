// The HUD (docs/11, mockups in art/drafts/hud/). Everything is drawn with the hud.py primitives into one
// canvas at UI resolution (the window size divided by the integer UI zoom), redrawn a few times a second
// and shown scaled by that whole number, so it stays pixel-perfect. Also shows the F3 debug readout.

import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { UI_BASE_H, UI_BASE_W } from '../config/constants';
import { calendar, darkness, formatClock } from '../systems/clock';
import {
  C,
  CAR_PANEL,
  clear,
  createSurface,
  hintKeys,
  hintKeysWidth,
  objective,
  plate,
  radar,
  stars,
  text,
  textWidthPx,
  toast,
  topLeft,
  topRight,
  vehiclePanel,
  type Surface,
} from '../ui/hudDraw';
import type { HudSnapshot } from './WorldScene';
import { groundSampler } from '../maps/groundQuery';
import { money } from './hudFormat';
import type { Params } from '../debug/params';

interface Stats {
  fps: number;
  zoom: number;
  x: number;
  y: number;
  i: number;
  j: number;
  depth: number;
  chunks: number;
  pan: { x: number; y: number };
}

const HUD_TEX = 'hud-canvas';

export class HudScene extends Phaser.Scene {
  private z = 1;
  private surface!: Surface;
  private tex: Phaser.Textures.CanvasTexture | null = null;
  private image!: Phaser.GameObjects.Image;
  private snap: HudSnapshot | null = null;
  private stats: Stats | null = null;
  private debugOn = false;
  private toastMsg: { who: string; text: string; t: number } | null = null;
  private streetMsg: { name: string; t: number } | null = null;
  private acc = 0;
  private objectiveText = 'EXPLORE THE LEDGER (DOWNTOWN)';

  constructor() {
    super('hud');
  }

  create(params: Params): void {
    this.debugOn = params.debug;
    this.image = this.add.image(0, 0, '__WHITE').setOrigin(0, 0);
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    const ev = this.game.events;
    const handlers: [string, (...a: never[]) => void][] = [
      ['hud:frame', (s: HudSnapshot) => (this.snap = s)],
      ['debug:stats', (s: Stats) => (this.stats = s)],
      ['debug:overlay', (on: boolean) => (this.debugOn = on)],
      ['hud:toast', (m: { who: string; text: string }) => (this.toastMsg = { ...m, t: 0 })],
      ['hud:street', (name: string) => (this.streetMsg = { name, t: 0 })],
      ['hud:objective', (t: string) => (this.objectiveText = t)],
    ];
    for (const [e, h] of handlers) ev.on(e, h);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const [e, h] of handlers) ev.off(e, h);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.z = Math.max(1, Math.floor(Math.min(width / UI_BASE_W, height / UI_BASE_H)));
    const w = Math.ceil(width / this.z);
    const h = Math.ceil(height / this.z);
    this.surface = createSurface(w, h);
    if (this.tex) this.textures.remove(HUD_TEX);
    this.tex = this.textures.createCanvas(HUD_TEX, w, h);
    this.image.setTexture(HUD_TEX).setScale(this.z);
    this.redraw();
  }

  update(_t: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    if (this.toastMsg) {
      this.toastMsg.t += dt;
      if (this.toastMsg.t > BALANCE.hud.toastSeconds + 0.4) this.toastMsg = null;
    }
    if (this.streetMsg) {
      this.streetMsg.t += dt;
      if (this.streetMsg.t > BALANCE.hud.streetSeconds) this.streetMsg = null;
    }
    this.acc += dt;
    if (this.acc >= 1 / BALANCE.hud.radarHz) {
      this.acc = 0;
      this.redraw();
    }
  }

  private redraw(): void {
    const s = this.surface;
    if (!s || !this.tex) return;
    clear(s);
    const W = s.width;
    const H = s.height;
    const snap = this.snap;
    if (snap) {
      const cal = calendar(snap.minutes);
      topLeft(s, 6, 6, { ammo: '-/-', label: 'UNARMED', hp: snap.health, armor: snap.armor });
      stars(s, Math.floor(W / 2), 6, snap.stars);
      topRight(s, W - 6, 6, {
        day: cal.weekday,
        clock: formatClock(cal.minute),
        clean: money(snap.money.clean),
        dirty: money(snap.money.dirty),
        night: darkness(cal.minute) > 0.5,
      });
      radar(s, 46, H - 46, BALANCE.hud.radarRadius, BALANCE.hud.radarScale, {
        px: snap.px,
        py: snap.py,
        heading: snap.heading,
        groundAt: groundSampler(snap.map),
        buildings: snap.buildings,
        blips: snap.doors
          .filter((d) => d.target === 'apartment' || d.target === 'store')
          .map((d) => ({
            kind: d.target === 'apartment' ? ('home' as const) : ('shop' as const),
            x: d.x,
            y: d.y,
          })),
      });
      objective(s, Math.floor(W / 2), H - 20, snap.objective || this.objectiveText);
      if (snap.vehicle) vehiclePanel(s, 6, 46, snap.vehicle);
      const hints: [string, string][] = snap.vehicle
        ? [
            ['W/S', 'DRIVE'],
            ['A/D', 'STEER'],
            ['SPACE', 'BRAKE'],
            ['F', 'EXIT'],
          ]
        : snap.target
          ? [
              ['E', 'USE'],
              ['TAB', 'NEXT'],
            ]
          : [
              ['SHIFT', 'SPRINT'],
              ['C', 'CAMERA'],
            ];
      hintKeys(s, W - 6 - hintKeysWidth(hints) + 8, H - 20, hints);
      let stackY = H - 52;
      if (this.toastMsg) {
        const t = this.toastMsg.t;
        const out = Math.max(0, t - BALANCE.hud.toastSeconds) / 0.4;
        const inn = Math.max(0, 0.25 - t) / 0.25;
        toast(s, W - 6, stackY, this.toastMsg.who, this.toastMsg.text, Math.max(out, inn));
        stackY -= 16;
      }
      if (this.streetMsg) {
        const label = this.streetMsg.name;
        const dist = snap.district;
        const w = Math.max(textWidthPx(label), textWidthPx(dist)) + 10;
        plate(s, W - 6 - w, stackY, w, 20, C.LAVLT2);
        text(s, W - 6 - w + 5, stackY + 4, label, C.CREAM);
        text(s, W - 6 - w + 5, stackY + 11, dist, C.MUTED);
      }
    }
    if (this.debugOn && this.stats) {
      const st = this.stats;
      const lines = [
        `FPS ${Math.round(st.fps)}`,
        `ZOOM ${st.zoom}X`,
        `WORLD ${st.x.toFixed(1)} ${st.y.toFixed(1)}`,
        `TILE ${st.i} ${st.j}`,
        `DEPTH ${st.depth.toFixed(2)}`,
        `PAN ${Math.round(st.pan.x)} ${Math.round(st.pan.y)}`,
        `CHUNKS ${st.chunks}`,
      ];
      const w = Math.max(...lines.map((l) => textWidthPx(l))) + 8;
      const dy = snap?.vehicle ? 46 + CAR_PANEL.h + 4 : 46;
      plate(s, 6, dy, w, lines.length * 7 + 6, C.LAVLT2);
      lines.forEach((l, k) => text(s, 10, dy + 3 + k * 7, l, C.CREAM));
    }
    const ctx = this.tex.getContext();
    const img = ctx.createImageData(s.width, s.height);
    img.data.set(s.data);
    ctx.putImageData(img, 0, 0);
    this.tex.refresh();
  }
}
