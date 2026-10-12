// The Saltgate Union at your door (docs/04 "Rivals (light)", Phase 5 M17): the rivals of a hit under way
// (systems/rivals.ts), standing in a loose group on the front path of the home they came for, facing the player.
// Combat (world/combatWorld.ts) shoots them and has them shoot back.

import type Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import type { Rng } from '../core/rng';
import { characterFrame } from '../assets/sprites';
import type { HomeId } from '../data/property';
import type { WeaponId } from '../data/weapons';
import { facingFromWorld } from '../iso/projection';
import type { Hit } from '../systems/rivals';
import type { CombatRival } from './combatWorld';

export interface RivalHost {
  layer: Phaser.GameObjects.Layer;
  rng: Rng;
  place(sprite: Phaser.GameObjects.Sprite, x: number, y: number, r: number): void;
  /** The front door of a home (where the hit gathers), or null. */
  doorOf(home: HomeId): { x: number; y: number } | null;
}

export interface Rival extends CombatRival {
  home: HomeId;
}

/** Rivals carry pistols and SMGs (docs/04). */
const ARMS: readonly WeaponId[] = ['pistol', 'pistol', 'smg'];

export class RivalCrew {
  members: Rival[] = [];

  constructor(
    private scene: Phaser.Scene,
    private host: RivalHost,
  ) {}

  /** Match the people on the street to the hits under way: new hits gather, finished ones leave. */
  sync(hits: readonly Hit[]): void {
    for (const r of [...this.members])
      if (!hits.some((h) => h.home === r.home)) {
        r.sprite.destroy();
        this.members = this.members.filter((q) => q !== r);
      }
    for (const hit of hits) {
      const here = this.members.filter((r) => r.home === hit.home).length;
      const door = this.host.doorOf(hit.home);
      if (!door) continue;
      const S = BALANCE.property.rivals.spread;
      for (let k = here; k < hit.left; k++) {
        const x = door.x + this.host.rng.range(-S, S);
        const y = door.y + 18 + this.host.rng.range(0, S);
        const f = characterFrame('rival', 'idle', 2);
        const sprite = this.scene.add.sprite(0, 0, f.atlas, f.frame);
        this.host.layer.add(sprite);
        this.members.push({ x, y, sprite, weapon: this.host.rng.pick(ARMS), home: hit.home });
      }
    }
  }

  /** Each frame: face the player and stand in place. */
  update(player: { x: number; y: number }, visible: boolean): void {
    for (const r of this.members) {
      const dir = facingFromWorld(player.x - r.x, player.y - r.y);
      const f = characterFrame('rival', 'idle', dir);
      if (r.sprite.frame.name !== f.frame) r.sprite.setFrame(f.frame);
      this.host.place(r.sprite, r.x, r.y, BALANCE.walker.radius);
      r.sprite.setVisible(visible);
    }
  }

  /** One went down (combat draws the body): off the list. Returns the home they came for. */
  down(sprite: Phaser.GameObjects.Sprite): HomeId | null {
    const r = this.members.find((q) => q.sprite === sprite);
    if (!r) return null;
    r.sprite.destroy();
    this.members = this.members.filter((q) => q !== r);
    return r.home;
  }

  destroy(): void {
    for (const r of this.members) r.sprite.destroy();
    this.members = [];
  }
}
