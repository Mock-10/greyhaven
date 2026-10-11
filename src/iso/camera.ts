// Camera controller (docs/11): follows a target with a soft deadzone, pans with the middle mouse or
// the screen edge (up to 12 tiles from the player, springing back on C or after 3 s idle), zooms in
// integer steps with Ctrl + wheel. Scroll is always a whole art pixel and the camera origin is the
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
  scrollFor,
  stepZoom,
} from './cameraMath';
import type { Rect } from './shadows';

const C = BALANCE.camera;
/** Screen length of the pan limit: 12 tiles along a ground axis. */
const PAN_MAX_PX = Math.hypot(worldToScreen(TILE, 0).x, worldToScreen(TILE, 0).y) * C.panMaxTiles;

export class CameraController {
  zoom: number;
  private focus: Vec2;
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
    this.zoom = this.userZoom || this.fit();
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
      if (e.deltaY !== 0) this.setZoom(stepZoom(this.zoom, e.deltaY < 0 ? 1 : -1, C.zoomLevels));
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

  setZoom(z: number): void {
    this.userZoom = z;
    this.zoom = z;
    this.apply();
    this.scene.game.events.emit('camera:zoom', z);
  }

  /** Re-pick the zoom after the window size changes (unless the player chose one). */
  onResize(): void {
    if (!this.userZoom) this.zoom = this.fit();
    this.apply();
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
    this.focus = {
      x: approach(this.focus.x, desired.x, C.followRate, dtSeconds),
      y: approach(this.focus.y, desired.y, C.followRate, dtSeconds),
    };
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
