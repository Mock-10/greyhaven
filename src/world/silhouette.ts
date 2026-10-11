// Silhouette through buildings (2026-10-11 camera rework, like Project Zomboid): where something in front hides
// the player or the car, a flat muted-lavender copy of them shows through. The copy is masked to the pixels of the
// sprites covering them, so the visible parts look normal. WebGL only (bitmap masks); on Canvas it stays off.

import Phaser from 'phaser';
import { BALANCE } from '../config/balance';

export class Silhouette {
  private readonly rt: Phaser.GameObjects.RenderTexture | null;
  private readonly ghost: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Layer) {
    const webgl = scene.game.renderer.type === Phaser.WEBGL;
    const S = BALANCE.render.silhouette;
    this.ghost = scene.add.sprite(0, 0, '__WHITE').setVisible(false).setDepth(-1);
    layer.add(this.ghost);
    this.rt = webgl
      ? scene.make.renderTexture({ x: 0, y: 0, width: S.maskSize, height: S.maskSize }, false)
      : null;
    if (this.rt) this.ghost.setMask(new Phaser.Display.Masks.BitmapMask(scene, this.rt));
  }

  /** Show `target` through the `covering` sprites, or hide the silhouette when nothing covers it. */
  update(target: Phaser.GameObjects.Sprite | null, covering: readonly Phaser.GameObjects.Sprite[]): void {
    const rt = this.rt;
    if (!rt || !target || !target.visible || covering.length === 0) {
      this.ghost.setVisible(false);
      return;
    }
    const S = BALANCE.render.silhouette;
    const g = this.ghost;
    g.setTexture(target.texture.key, target.frame.name);
    g.setPosition(target.x, target.y);
    g.setTintFill(S.colour);
    g.setAlpha(S.alpha);
    g.setVisible(true);
    // the mask: the covering sprites drawn at full strength into a texture around the target
    const x0 = Math.round(target.x - target.displayOriginX - (S.maskSize - target.width) / 2);
    const y0 = Math.round(target.y - target.displayOriginY - (S.maskSize - target.height) / 2);
    rt.setPosition(x0, y0);
    rt.clear();
    for (const c of covering)
      rt.drawFrame(c.texture.key, c.frame.name, c.x - c.displayOriginX - x0, c.y - c.displayOriginY - y0);
  }

  hide(): void {
    this.ghost.setVisible(false);
  }
}
