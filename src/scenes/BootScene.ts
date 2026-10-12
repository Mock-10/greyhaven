// Loads the art pack, registers frames and the pixel font, then opens the world (and the title on top).

import Phaser from 'phaser';
import { BG_DAY, PAL } from '../config/constants';
import { queueAtlases, registerAtlases } from '../assets/atlasLoader';
import { registerPixelFont } from '../ui/bitmapFont';
import { setIconSheet } from '../ui/icons';
import uiIconsPng from '../../art/ui_icons.png';
import type { Params } from '../debug/params';
import { queueFx, registerFx } from '../fx/fxAssets';
import { queuePlayerActions } from '../anim/playerActions';

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
    this.load.image('ui_icons', uiIconsPng);
    queueFx(this.load);
    queuePlayerActions(this.load);
  }

  create(): void {
    registerAtlases(this.textures);
    registerFx(this.textures);
    registerPixelFont(this);
    // the UI draws into pixel buffers: hand it the icon sheet's pixels once
    const img = this.textures.get('ui_icons').getSourceImage() as HTMLImageElement;
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0);
      setIconSheet(img.width, ctx.getImageData(0, 0, img.width, img.height).data);
    }
    const params = this.registry.get('params') as Params;
    this.scene.start('world', params);
    if (params.scene === 'title') this.scene.launch('title');
    else this.scene.launch('hud', params);
  }
}
