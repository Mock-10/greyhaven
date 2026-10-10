// "Click to start" title (docs/15 Phase 0; docs/14: browsers only unlock audio after a click).
// Drawn over the live world, which waits underneath.

import Phaser from 'phaser';
import { PAL } from '../config/constants';
import { pixelText } from '../ui/bitmapFont';
import { textWidth } from '../ui/pixelFont';
import type { WorldScene } from './WorldScene';
import type { Params } from '../debug/params';

export class TitleScene extends Phaser.Scene {
  private items: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('title');
  }

  create(): void {
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this),
    );
    this.input.once('pointerdown', () => this.start());
    this.input.keyboard?.once('keydown-ENTER', () => this.start());
  }

  private layout(): void {
    for (const o of this.items) o.destroy();
    this.items = [];
    const { width, height } = this.scale;
    const z = Math.max(1, Math.floor(Math.min(width / 640, height / 360)));
    const dim = this.add.rectangle(0, 0, width, height, PAL.night0, 0.55).setOrigin(0, 0);
    const center = (text: string, scale: number, y: number, color: number) => {
      const w = textWidth(text, scale);
      return pixelText(this, Math.round((width - w) / 2), Math.round(y), text, color, scale);
    };
    const titleScale = 8 * z;
    const cy = height / 2;
    const plateW = textWidth('DOUBLE LIFE', titleScale) + 24 * z;
    const plateH = 5 * titleScale + 52 * z;
    const plate = this.add
      .rectangle(
        Math.round((width - plateW) / 2),
        Math.round(cy - plateH / 2 - 8 * z),
        plateW,
        plateH,
        PAL.plate,
        0.9,
      )
      .setOrigin(0, 0)
      .setStrokeStyle(z, PAL.lav4);
    const title = center('DOUBLE LIFE', titleScale, cy - plateH / 2 - 8 * z + 10 * z, PAL.cream);
    const sub = center('GREYHAVEN', 2 * z, cy - plateH / 2 + 5 * titleScale + 8 * z, PAL.lavlt5);
    const click = center('CLICK TO START', 2 * z, cy + plateH / 2 + 6 * z, PAL.white4);
    const note = center('PHASE 1 - MILESTONE 1', z, height - 12 * z, PAL.lav5);
    this.tweens.add({ targets: click, alpha: 0.25, duration: 600, yoyo: true, repeat: -1, ease: 'Stepped' });
    this.items.push(dim, plate, title, sub, click, note);
  }

  private start(): void {
    // The first click lets the browser start audio; Phaser unlocks its sound manager on it.
    const world = this.scene.get('world') as WorldScene;
    world.startPlay();
    const params = this.registry.get('params') as Params;
    this.scene.launch('hud', params);
    this.scene.stop();
  }
}
