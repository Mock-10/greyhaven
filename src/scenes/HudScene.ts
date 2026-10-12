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
  CLOCK_PANEL,
  clear,
  createSurface,
  hintKeys,
  hintKeysWidth,
  plate,
  radar,
  senderIcon,
  stars,
  text,
  textWidthPx,
  toast,
  topLeft,
  topRight,
  vehiclePanel,
  VITALS,
  type Surface,
} from '../ui/hudDraw';
import type { HudSnapshot } from './WorldScene';
import { groundSampler } from '../maps/groundQuery';
import { money } from './hudFormat';
import type { Params } from '../debug/params';
import { SENDER_ICON } from '../data/senders';
import { HudAnimator, streetSlide, toastSlide } from '../ui/anim/hudAnim';

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
  /** Messages that arrived while another was showing (rent and the bonus land together on Monday 06:00). */
  private toastQueue: { who: string; text: string }[] = [];
  private streetMsg: { name: string; t: number } | null = null;
  private acc = 0;
  private objectiveText = 'EXPLORE THE LEDGER (DOWNTOWN)';
  /** HUD motion: rolling cash, damage trail, star flashes, typed objective (ui/anim/hudAnim.ts). */
  private anim = new HudAnimator();
  /** The last car readout, kept while its panel folds away after getting out. */
  private lastVehicle: HudSnapshot['vehicle'] | null = null;

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
      ['hud:toast', (m: { who: string; text: string }) => this.pushToast(m)],
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

  /** Show a message now, or after the one on screen has had its minimum time. */
  private pushToast(m: { who: string; text: string }): void {
    const H = BALANCE.hud;
    if (!this.toastMsg || this.toastMsg.t >= H.toastMinSeconds) this.toastMsg = { ...m, t: 0 };
    else {
      this.toastQueue.push(m);
      if (this.toastQueue.length > H.toastQueue) this.toastQueue.shift();
    }
  }

  update(): void {
    // raw frame time, like the world: Phaser's smoothed delta crawls in slow (headless) frames
    const dt = Math.min(0.1, this.game.loop.rawDelta / 1000);
    if (this.toastMsg) {
      this.toastMsg.t += dt;
      const next = this.toastQueue[0];
      if (next && this.toastMsg.t >= BALANCE.hud.toastMinSeconds) {
        this.toastQueue.shift();
        this.toastMsg = { ...next, t: 0 };
      } else if (this.toastMsg.t > BALANCE.hud.toastSeconds + 0.4) this.toastMsg = null;
    }
    if (this.streetMsg) {
      this.streetMsg.t += dt;
      if (this.streetMsg.t > BALANCE.hud.streetSeconds) this.streetMsg = null;
    }
    this.acc += dt;
    const snap = this.snap;
    if (snap)
      this.anim.update(dt, {
        clean: snap.money.clean,
        dirty: snap.money.dirty,
        health: snap.health,
        stars: snap.stars,
        objective: snap.objective || this.objectiveText,
        hints: snap.surrender ? 's' : snap.vehicle ? 'v' : snap.target ? 't' : 'f',
        driving: !!snap.vehicle,
      });
    // while something moves the HUD redraws every frame, otherwise at the radar's rate
    if (this.anim.busy || this.acc >= 1 / BALANCE.hud.radarHz) {
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
      topLeft(s, 6, 6, { ammo: '-/-', label: 'UNARMED', hp: this.anim.health, armor: snap.armor });
      this.anim.drawVitals(s, 6, 6);
      stars(
        s,
        Math.floor(W / 2),
        5,
        snap.stars,
        snap.starsFlash && Math.floor(this.time.now / 250) % 2 === 0,
      );
      this.anim.drawStars(s, Math.floor(W / 2), 5);
      topRight(s, W - 6, 6, {
        day: cal.weekday,
        clock: formatClock(cal.minute),
        clean: money(this.anim.clean.value),
        dirty: money(this.anim.dirty.value),
        night: darkness(cal.minute) > 0.5,
      });
      this.anim.drawCashPopups(s, W - 6, 6 + CLOCK_PANEL.h);
      radar(s, 52, H - 52, BALANCE.hud.radarRadius, BALANCE.hud.radarScale, {
        px: snap.px,
        py: snap.py,
        heading: snap.heading,
        groundAt: groundSampler(snap.map),
        buildings: snap.buildings,
        blips: [
          ...snap.doors
            .filter((d) => d.target === 'apartment' || d.target === 'store')
            .map((d) => ({
              kind: d.target === 'apartment' ? ('home' as const) : ('shop' as const),
              x: d.x,
              y: d.y,
            })),
          ...snap.police.map((q) => ({ kind: 'police' as const, x: q.x, y: q.y })),
        ],
        search: snap.search,
      });
      this.anim.drawObjective(s, Math.floor(W / 2), H - 24, snap.objective || this.objectiveText);
      if (snap.vehicle) this.lastVehicle = snap.vehicle;
      if (this.anim.showCarPanel && this.lastVehicle) {
        vehiclePanel(s, 6, 6 + VITALS.h + 4, this.lastVehicle);
        this.anim.carPanelTransition(s, { x: 6, y: 6 + VITALS.h + 4, w: CAR_PANEL.w, h: CAR_PANEL.h });
      }
      const hints: [string, string][] = snap.surrender
        ? [['Y', 'SURRENDER']]
        : snap.vehicle
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
                ['P', 'PHONE'],
                ['I', 'BAG'],
                ['SHIFT', 'SPRINT'],
              ];
      // a plate behind the hints, so they read over light pavement (handover known issue)
      const hw = hintKeysWidth(hints) - 10;
      // the hint strip sits beside the objective, or a row above it when both don't fit (the driving hints)
      const objW = textWidthPx(snap.objective || this.objectiveText) + 24;
      const hintsY = W - 12 - hw < Math.floor(W / 2) + Math.ceil(objW / 2) + 6 ? H - 48 : H - 26;
      plate(s, W - 12 - hw, hintsY, hw + 12, 19, C.LAVLT2, 0.82);
      hintKeys(s, W - 6 - hw, hintsY + 4, hints);
      this.anim.fadeHints(s, { x: W - 12 - hw, y: hintsY, w: hw + 12, h: 19 });
      let stackY = hintsY - 6;
      if (this.toastMsg) {
        const t = this.toastMsg.t;
        const who = this.toastMsg.who;
        stackY -= 40 + 4;
        const slide = toastSlide(t, BALANCE.hud.toastSeconds);
        toast(s, W - 6, stackY, who, this.toastMsg.text, senderIcon(who, SENDER_ICON), slide);
      }
      if (this.streetMsg) {
        const label = this.streetMsg.name;
        const dist = snap.district;
        const w = Math.max(textWidthPx(label), textWidthPx(dist)) + 14;
        stackY -= 26 + 4;
        const x = W - 6 - w + streetSlide(this.streetMsg.t, BALANCE.hud.streetSeconds);
        plate(s, x, stackY, w, 26, C.LAVLT2);
        text(s, x + 7, stackY + 4, label, C.CREAM);
        text(s, x + 7, stackY + 14, dist, C.MUTED);
      }
    }
    this.anim.drawBursts(s);
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
      const dy = 6 + VITALS.h + 4 + (snap?.vehicle ? CAR_PANEL.h + 4 : 0);
      plate(s, 6, dy, w, lines.length * 10 + 6, C.LAVLT2);
      lines.forEach((l, k) => text(s, 10, dy + 4 + k * 10, l, C.CREAM));
    }
    const ctx = this.tex.getContext();
    const img = ctx.createImageData(s.width, s.height);
    img.data.set(s.data);
    ctx.putImageData(img, 0, 0);
    this.tex.refresh();
  }
}
