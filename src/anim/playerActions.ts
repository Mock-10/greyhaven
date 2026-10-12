// The player's tool and interact animations (docs/11, docs/13): reaching to use a door or an ATM, picking a
// lock, hotwiring, a wrench, an axe, carrying a parcel, the phone, the fuel pump, searching, stamping, typing and
// idle breathing. The sprites are palette-swap frames like the player's walk (art/player_actions.png, from
// art/source/actions.py + pack_actions.py), keyed '<hair style>/<action><k>/<DIR>'.
// The timing below is pure (tested); `paintPlayerActions` repaints the texture in the player's look.

import type Phaser from 'phaser';
import actionsPng from '../../art/player_actions.png';
import actionsJson from '../../art/player_actions.json';
import { FX } from '../config/balanceFx';
import { parseAtlas, type AtlasJson } from '../assets/atlasFormat';
import { setPivot } from '../assets/atlasLoader';
import { MARKERS } from '../assets/playerLook';
import type { Look } from '../data/looks';
import { swapPixels, swapTable } from '../systems/lookSwap';
import { frameAt } from './ease';

export type ActionName =
  | 'use'
  | 'lockpick'
  | 'hotwire'
  | 'wrench'
  | 'chop'
  | 'carry'
  | 'phone'
  | 'pump'
  | 'search'
  | 'stamp'
  | 'type'
  | 'breathe';

interface ActionInfo {
  frames: number;
  fps: number;
  loop: boolean;
  /** Frame order for walking cycles (carry). */
  cycle?: number[];
}

export const ACTIONS = (actionsJson as unknown as { actions: Record<ActionName, ActionInfo> }).actions;
export const ACTIONS_TEXTURE = 'player_actions';
const SOURCE = 'player_actions_src';
const DIRS = ['SE', 'S', 'SW', 'W', 'NW', 'N', 'NE', 'E'] as const;

/** The action a minigame, menu or list shows the player doing while it is open (null: stand as usual). */
export function contextAction(open: string | null): ActionName | null {
  switch (open) {
    case 'lockpick':
      return 'lockpick';
    case 'hotwire':
      return 'hotwire';
    case 'search':
    case 'duffel':
    case 'bag':
      return 'search';
    case 'filing':
      return 'stamp';
    case 'dataEntry':
    case 'atm':
    case 'moneyCount':
      return 'type';
    case 'phone':
    case 'route':
      return 'phone';
    // the M7 job tasks (ui/panelsJobs.ts)
    case 'boltTorque':
    case 'tyreChange':
    case 'chop':
    case 'diagnose':
      return 'wrench';
    case 'respray':
      return 'pump';
    case 'fell':
      return 'chop';
    case 'load':
    case 'doorstep':
      return 'carry';
    case 'stampSign':
      return 'stamp';
    case 'signature':
      return 'type';
    default:
      return null;
  }
}

/** Frame key of an action frame. */
export function actionFrameKey(style: string, action: ActionName, k: number, dir: number): string {
  return `${style}/${action}${k}/${DIRS[((dir % 8) + 8) % 8]}`;
}

/**
 * What the player is doing with their hands: a one-shot (`play`, e.g. the reach when pressing E), a held
 * action (`hold`, e.g. picking a lock while the panel is open) or, after standing still a moment, breathing.
 * Walking always wins; `frame` returns null when the normal walk/idle sprite should show.
 */
export class PlayerActions {
  private oneShot: { action: ActionName; t: number; until: number } | null = null;
  private held: { action: ActionName; t: number } | null = null;
  private still = 0;

  play(action: ActionName, seconds: number = FX.actions.useSeconds): void {
    this.oneShot = { action, t: 0, until: seconds };
  }

  hold(action: ActionName | null): void {
    if (action === null) this.held = null;
    else if (this.held?.action !== action) this.held = { action, t: 0 };
  }

  update(dt: number, moving: boolean): void {
    this.still = moving ? 0 : this.still + dt;
    if (this.oneShot) {
      this.oneShot.t += dt;
      if (this.oneShot.t >= this.oneShot.until || moving) this.oneShot = null;
    }
    if (this.held) this.held.t += dt;
  }

  /** The action and its frame index now, or null for the normal sprite. */
  current(): { action: ActionName; k: number } | null {
    const pick = (action: ActionName, t: number) => {
      const a = ACTIONS[action];
      const i = frameAt(t, a.fps, a.cycle?.length ?? a.frames, a.loop);
      return { action, k: a.cycle ? (a.cycle[i] as number) : i };
    };
    if (this.oneShot) return pick(this.oneShot.action, this.oneShot.t);
    if (this.held) return pick(this.held.action, this.held.t);
    if (this.still >= FX.actions.breatheAfter) return pick('breathe', this.still - FX.actions.breatheAfter);
    return null;
  }

  /** The frame to show for a palette-swapped player of this hair style, or null. */
  frame(style: string, dir: number): string | null {
    const c = this.current();
    return c ? actionFrameKey(style, c.action, c.k, dir) : null;
  }
}

export function queuePlayerActions(load: Phaser.Loader.LoaderPlugin): void {
  load.image(SOURCE, actionsPng);
}

let sourcePixels: { data: Uint8ClampedArray; width: number; height: number } | null = null;

/** Paint the action texture in this look (like assets/playerLook.ts paintPlayer for the walk sprites). */
export function paintPlayerActions(textures: Phaser.Textures.TextureManager, look: Look): void {
  if (!textures.exists(SOURCE)) return;
  if (!sourcePixels) {
    const img = textures.get(SOURCE).getSourceImage() as HTMLImageElement;
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    sourcePixels = {
      data: ctx.getImageData(0, 0, img.width, img.height).data,
      width: img.width,
      height: img.height,
    };
  }
  const src = sourcePixels;
  let tex = textures.exists(ACTIONS_TEXTURE)
    ? (textures.get(ACTIONS_TEXTURE) as Phaser.Textures.CanvasTexture)
    : null;
  if (!tex) {
    tex = textures.createCanvas(ACTIONS_TEXTURE, src.width, src.height);
    if (!tex) return;
    for (const def of parseAtlas(actionsJson as unknown as AtlasJson).values()) {
      const f = tex.add(def.name, 0, def.x, def.y, def.w, def.h);
      if (f) setPivot(f, def.ax, def.ay);
    }
  }
  const img = new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
  swapPixels(img.data, swapTable(look, MARKERS));
  tex.context.putImageData(img, 0, 0);
  tex.refresh();
}
