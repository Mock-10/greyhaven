// Loads the art pack, registers frames and the pixel font, then opens the world (and the title on top).

import Phaser from 'phaser';
import { BG_DAY, PAL } from '../config/constants';
import { queueAtlases, registerAtlases } from '../assets/atlasLoader';
import { registerPixelFont } from '../ui/bitmapFont';
import type { Params } from '../debug/params';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload(): void {
    this.cameras.main.setBackgroundColor(BG_DAY);
    const { width, height } = this.scale;
    const z = Math.max(1, Math.floor(Math.min(width / 640, height / 360)));
    const w = 120 * z;
    const h = 4 * z;
    const x = Math.round((width - w) / 2);
    const y = Math.round(height / 2);
    const frame = this.add.rectangle(x - z, y - z, w + 2 * z, h + 2 * z, PAL.plate).setOrigin(0, 0);
    const bar = this.add.rectangle(x, y, 0, h, PAL.white4).setOrigin(0, 0);
    this.load.on(Phaser.Loader.Events.PROGRESS, (v: number) => (bar.width = Math.round(w * v)));
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      frame.destroy();
      bar.destroy();
    });
    queueAtlases(this.load);
  }

  create(): void {
    registerAtlases(this.textures);
    registerPixelFont(this);
    const params = this.registry.get('params') as Params;
    this.scene.start('world', params);
    if (params.scene === 'title') this.scene.launch('title');
    else this.scene.launch('hud', params);
  }
}
