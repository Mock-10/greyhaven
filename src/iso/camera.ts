// Camera controller (docs/11): follows a target with a soft deadzone and a critically damped spring, pans with the
// middle mouse or the screen edge (up to 12 tiles from the player, springing back on C or after 3 s idle), zooms in
// integer steps with Ctrl + wheel, and steps out by a context offset (driving, 2026-10-11 camera rework). Scroll is always a whole art pixel and the camera origin is the
// top-left corner, so every sprite lands on a whole screen pixel (CLAUDE.md hard rule 3).

import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { TILE } from '../config/constants';
import { worldToScreen, type Vec2 } from './projection';
import {
  applyDeadzone,
  approach,
  clampCenter,
  clampLength,
  fitZoom,
  offsetZoom,
  scrollFor,
  springStep,
  stepZoom,
} from './cameraMath';
import type { Rect } from './shadows';

const C = BALANCE.camera;
/** Screen length of the pan limit: 12 tiles along a ground axis. */
const PAN_MAX_PX = Math.hypot(worldToScreen(TILE, 0).x, worldToScreen(TILE, 0).y) * C.panMaxTiles;

export class CameraController {
  zoom: number;
  private focus: Vec2;
  private vel: Vec2 = { x: 0, y: 0 };
  /** Context zoom offset in levels (driving: -1), applied on top of the chosen or fitted zoom. */
  private context = 0;
  private pan: Vec2 = { x: 0, y: 0 };
  private panIdle = 0;
  private dragging = false;
  private pointerInside = false;
  private lastPointer: Vec2 = { x: 0, y: 0 };
  private readonly cam: Phaser.Cameras.Scene2D.Camera;
  private userZoom: number;
  /** The view is kept over this screen rect (plus a margin), when given. */
  private bounds: Rect | null;
  private readonly canvas: HTMLCanvasElement;
  private readonly onWheel: (e: WheelEvent) => void;
  private readonly onEnter = () => (this.pointerInside = true);
  private readonly onLeave = () => (this.pointerInside = false);

  constructor(
    private scene: Phaser.Scene,
    private target: () => Vec2,
    options: { zoom?: number; bounds?: Rect } = {},
  ) {
    this.bounds = options.bounds ?? null;
    this.cam = scene.cameras.main;
    this.cam.setOrigin(0, 0);
    this.cam.setRoundPixels(true);
    this.canvas = scene.game.canvas;
    this.userZoom = options.zoom ?? 0;
    this.zoom = this.effective();
    this.focus = { ...target() };

    const input = scene.input;
    input.mouse?.disableContextMenu();
    input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.middleButtonDown()) {
        this.dragging = true;
        this.lastPointer = { x: p.x, y: p.y };
      }
    });
    input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!p.middleButtonDown()) this.dragging = false;
    });
    input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.pointerInside = true;
      if (!this.dragging) return;
      this.addPan((this.lastPointer.x - p.x) / this.zoom, (this.lastPointer.y - p.y) / this.zoom);
      this.lastPointer = { x: p.x, y: p.y };
    });

    // Ctrl + wheel zooms. The listener must be non-passive to stop the browser's own page zoom.
    this.onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      if (e.deltaY !== 0) this.wheelZoom(e.deltaY < 0 ? 1 : -1);
    };
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.canvas.addEventListener('mouseenter', this.onEnter);
    this.canvas.addEventListener('mouseleave', this.onLeave);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    this.apply();
  }

  private fit(): number {
    return fitZoom(this.cam.width, this.cam.height, C.zoomLevels, C.fitWidth, C.fitHeight);
  }

  /** The zoom actually used: the player's choice (or the fit), moved by the context offset. */
  private effective(): number {
    return offsetZoom(this.userZoom || this.fit(), this.context, C.zoomLevels);
  }

  /** Ctrl + wheel: change the base zoom by one level. While driving the context offset still applies. */
  private wheelZoom(delta: 1 | -1): void {
    const base = this.userZoom || this.fit();
    this.setZoom(stepZoom(base, delta, C.zoomLevels));
  }

  setZoom(z: number): void {
    this.userZoom = z;
    this.zoom = this.effective();
    this.apply();
    this.scene.game.events.emit('camera:zoom', z);
  }

  /** Step the zoom by a context offset (driving), keeping the same point in the middle of the view. */
  setContext(step: number): void {
    if (step === this.context) return;
    this.context = step;
    this.zoom = this.effective();
    this.apply();
  }

  /** Re-pick the zoom after the window size changes (unless the player chose one). */
  onResize(): void {
    this.zoom = this.effective();
    this.apply();
  }

  /** Where the mouse is, from -1 to 1 across the view on each axis (0 when it's outside the canvas). */
  pointer(): Vec2 {
    if (!this.pointerInside || this.dragging) return { x: 0, y: 0 };
    const p = this.scene.input.activePointer;
    const cl = (v: number) => Math.max(-1, Math.min(1, v));
    return { x: cl((p.x / this.cam.width) * 2 - 1), y: cl((p.y / this.cam.height) * 2 - 1) };
  }

  /** Keep the view over another area (entering or leaving an interior). */
  setBounds(bounds: Rect | null): void {
    this.bounds = bounds;
    this.pan = { x: 0, y: 0 };
  }

  recenter(): void {
    this.pan = { x: 0, y: 0 };
  }

  /** Jump straight to the target (no smoothing), e.g. after a teleport. */
  snap(): void {
    this.focus = { ...this.target() };
    this.vel = { x: 0, y: 0 };
    this.apply();
  }

  private addPan(dx: number, dy: number): void {
    this.pan = clampLength({ x: this.pan.x + dx, y: this.pan.y + dy }, PAN_MAX_PX);
    this.panIdle = 0;
  }

  update(dtSeconds: number): void {
    // Edge scrolling, in CSS pixels from the canvas edge.
    const p = this.scene.input.activePointer;
    if (this.pointerInside && !this.dragging && document.hasFocus()) {
      const r = this.canvas.getBoundingClientRect();
      const ratio = r.width / this.cam.width; // CSS px per device px
      const cx = p.x * ratio;
      const cy = p.y * ratio;
      const m = C.edgeScrollMarginCss;
      const step = C.edgeScrollSpeed * dtSeconds;
      let ex = 0;
      let ey = 0;
      if (cx <= m) ex = -step;
      else if (cx >= r.width - m) ex = step;
      if (cy <= m) ey = -step;
      else if (cy >= r.height - m) ey = step;
      if (ex || ey) this.addPan(ex, ey);
    }
    this.panIdle += dtSeconds;
    if (this.panIdle >= C.panIdleReturnSeconds && !this.dragging) {
      this.pan = {
        x: approach(this.pan.x, 0, C.panReturnRate, dtSeconds),
        y: approach(this.pan.y, 0, C.panReturnRate, dtSeconds),
      };
      if (Math.hypot(this.pan.x, this.pan.y) < 0.5) this.pan = { x: 0, y: 0 };
    }
    const desired = applyDeadzone(this.focus, this.target(), C.deadzoneW, C.deadzoneH);
    const sx = springStep(this.focus.x, this.vel.x, desired.x, C.followOmega, dtSeconds);
    const sy = springStep(this.focus.y, this.vel.y, desired.y, C.followOmega, dtSeconds);
    this.focus = { x: sx.pos, y: sy.pos };
    this.vel = { x: sx.vel, y: sy.vel };
    // The deadzone is a hard limit: the target never leaves it, even while smoothing catches up.
    this.focus = applyDeadzone(this.focus, this.target(), C.deadzoneW, C.deadzoneH);
    this.apply();
  }

  private apply(): void {
    this.cam.setZoom(this.zoom);
    let center = { x: this.focus.x + this.pan.x, y: this.focus.y + this.pan.y };
    if (this.bounds)
      center = clampCenter(
        center,
        this.cam.width / this.zoom,
        this.cam.height / this.zoom,
        this.bounds,
        C.boundsMarginPx,
      );
    const s = scrollFor(center, this.cam.width, this.cam.height, this.zoom);
    this.cam.setScroll(s.x, s.y);
  }

  /** The visible area in art pixels. */
  view(): Rect {
    return {
      x: this.cam.scrollX,
      y: this.cam.scrollY,
      w: this.cam.width / this.zoom,
      h: this.cam.height / this.zoom,
    };
  }

  get panOffset(): Vec2 {
    return { ...this.pan };
  }

  destroy(): void {
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('mouseenter', this.onEnter);
    this.canvas.removeEventListener('mouseleave', this.onLeave);
  }
}
