// Screen-space overlay: control hints, and the F3 debug readout (docs/14). The real HUD (docs/11)
// arrives in Phase 1.

import Phaser from 'phaser';
import { PAL } from '../config/constants';
import { pixelText } from '../ui/bitmapFont';
import { textWidth } from '../ui/pixelFont';
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

const HINTS =
  'WASD MOVE  SHIFT SPRINT  MIDDLE-DRAG OR SCREEN EDGE PAN  CTRL+WHEEL ZOOM  C RECENTER  F3 DEBUG';

export class UIScene extends Phaser.Scene {
  private hintPlate!: Phaser.GameObjects.Rectangle;
  private hint!: Phaser.GameObjects.BitmapText;
  private debugText!: Phaser.GameObjects.BitmapText;
  private debugPlate!: Phaser.GameObjects.Rectangle;
  private z = 1;
  private hidden = false;

  constructor() {
    super('ui');
  }

  create(params: Params): void {
    this.hintPlate = this.add.rectangle(0, 0, 1, 1, PAL.plate, 0.85).setOrigin(0, 0);
    this.hint = pixelText(this, 0, 0, HINTS, PAL.white4);
    this.debugPlate = this.add.rectangle(0, 0, 1, 1, PAL.plate, 0.85).setOrigin(0, 0).setVisible(false);
    this.debugText = pixelText(this, 0, 0, '', PAL.cream).setVisible(false);
    this.hidden = params.scene === 'reference';
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    const ev = this.game.events;
    const onOverlay = (on: boolean) => {
      this.debugText.setVisible(on);
      this.debugPlate.setVisible(on);
    };
    const onStats = (s: Stats) => this.showStats(s);
    ev.on('debug:overlay', onOverlay);
    ev.on('debug:stats', onStats);
    onOverlay(params.debug);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      ev.off('debug:overlay', onOverlay);
      ev.off('debug:stats', onStats);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
  }

  private layout(): void {
    const { width, height } = this.scale;
    this.z = Math.max(1, Math.floor(Math.min(width / 640, height / 360)));
    const z = this.z;
    let scale = z;
    // Fall back to a smaller scale when the hint line would not fit.
    while (scale > 1 && textWidth(HINTS, scale) + 12 * z > width) scale--;
    this.hint.setFontSize(5 * scale).setPosition(6 * z, height - 6 * z - 5 * scale);
    this.hintPlate
      .setPosition(6 * z - 3 * z, height - 6 * z - 5 * scale - 3 * z)
      .setSize(textWidth(HINTS, scale) + 6 * z, 5 * scale + 6 * z)
      .setVisible(!this.hidden);
    this.hint.setVisible(!this.hidden);
    this.debugText.setFontSize(5 * z).setPosition(6 * z, 6 * z);
  }

  private showStats(s: Stats): void {
    if (!this.debugText.visible) return;
    const z = this.z;
    const lines = [
      `FPS ${Math.round(s.fps)}`,
      `ZOOM ${s.zoom}X`,
      `WORLD ${s.x.toFixed(1)} ${s.y.toFixed(1)}`,
      `TILE ${s.i} ${s.j}`,
      `DEPTH ${s.depth.toFixed(2)}`,
      `PAN ${Math.round(s.pan.x)} ${Math.round(s.pan.y)}`,
      `CHUNKS ${s.chunks}`,
    ];
    this.debugText.setText(lines.join('\n'));
    const b = this.debugText.getTextBounds().global;
    this.debugPlate
      .setPosition(3 * z, 3 * z)
      .setSize(Math.ceil(b.width) + 6 * z, Math.ceil(b.height) + 6 * z);
  }
}
