// Double Life — entry point. Pixel-perfect setup (CLAUDE.md hard rule 3): the canvas has one pixel per
// device pixel, nothing is smoothed, and the camera zooms by whole numbers only.

import Phaser from 'phaser';
import { BG_DAY } from './config/constants';
import { parseParams } from './debug/params';
import { installHook } from './debug/hooks';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { HudScene } from './scenes/HudScene';
import { WorldScene } from './scenes/WorldScene';
import { MinigameScene } from './scenes/MinigameScene';
import { MenuScene } from './scenes/MenuScene';

const hook = installHook();
const params = parseParams(window.location.search);
const parent = document.getElementById('game') as HTMLElement;

function deviceSize(): { w: number; h: number; cssW: number; cssH: number } {
  const dpr = window.devicePixelRatio || 1;
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  return { w: Math.max(1, Math.floor(cssW * dpr)), h: Math.max(1, Math.floor(cssH * dpr)), cssW, cssH };
}

const size = deviceSize();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent,
  backgroundColor: BG_DAY,
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: { mode: Phaser.Scale.NONE, width: size.w, height: size.h },
  input: { mouse: { preventDefaultWheel: false } },
  disableContextMenu: true,
  scene: [BootScene, WorldScene, TitleScene, HudScene, MinigameScene, MenuScene],
  callbacks: {
    preBoot: (g) => g.registry.set('params', params),
  },
});

/** Keep the canvas at device resolution, shown at CSS size, so every art pixel maps to whole device pixels. */
function fitCanvas(): void {
  const s = deviceSize();
  if (game.scale.width !== s.w || game.scale.height !== s.h) game.scale.resize(s.w, s.h);
  const c = game.canvas;
  if (c) {
    c.style.width = `${s.cssW}px`;
    c.style.height = `${s.cssH}px`;
  }
  game.scale.refresh();
}

game.events.once(Phaser.Core.Events.READY, fitCanvas);
window.addEventListener('resize', fitCanvas);
// devicePixelRatio changes when the window moves to another screen or the browser zoom changes.
matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener?.('change', fitCanvas);

// Pause the simulation while the tab is hidden (docs/14). Phaser's loop sleeps on its own; this keeps
// the fixed-step clock from trying to catch up afterwards.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) game.loop.sleep();
  else game.loop.wake();
});

hook.scene = 'boot';
