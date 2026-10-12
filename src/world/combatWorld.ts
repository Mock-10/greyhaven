// Combat in the street (docs/07, Phase 4): the player's shots and swings, what they hit, people going down with
// blood marks and pools that fade (user 2026-10-11), the police shooting back from 2★, dropped weapons to pick up.
// The rules live in systems/combat.ts; this draws them and keeps the street's people and police in step.

import Phaser from 'phaser';
import { BALANCE } from '../config/balance';
import { DIRS, TILE } from '../config/constants';
import type { Rng } from '../core/rng';
import { FX_TEXTURE } from '../fx/fxAssets';
import { facingFromWorld, worldToScreen } from '../iso/projection';
import iconsJson from '../../art/ui_icons.json';
import {
  blast,
  fire,
  hurt,
  policeMayShoot,
  policeShot,
  policeWeapon,
  reportCombat,
  rollDrop,
  swingHit,
  traceShot,
  type Box,
  type CombatState,
  type Drop,
  type FireResult,
  type Target,
  type Vitals,
} from '../systems/combat';
import { canSee, type WantedState } from '../systems/wanted';
import { WEAPONS } from '../data/weapons';

export interface CombatPed {
  id: number;
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Sprite;
}

export interface CombatCop {
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Sprite;
}

export interface CombatHost {
  layer: Phaser.GameObjects.Layer;
  groundLayer: Phaser.GameObjects.Layer;
  rng: Rng;
  place(sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image, x: number, y: number, r: number): void;
  player(): { x: number; y: number };
  vitals(): Vitals;
  combat(): CombatState;
  wanted(): WantedState;
  /** People on the street (not inside), and taking one away when they go down. */
  peds(): CombatPed[];
  removePed(id: number): void;
  /** Police officers on foot, and taking one away when they go down. */
  cops(): CombatCop[];
  removeCop(sprite: Phaser.GameObjects.Sprite): void;
  /** Buildings and cars as ground boxes: they stop bullets and sight. */
  blockers(): Box[];
  buildings: readonly Box[];
  /** A loud crime anyone around can see or hear (docs/05 witnesses). */
  crime(stars: number, at: { x: number; y: number }, hearTiles: number): void;
  toast(who: string, text: string): void;
  playerDown(): void;
  addUsable(id: string, x: number, y: number, label: string): void;
  removeUsable(id: string): void;
  /** The player's hands: swing or stab once. */
  playAction(action: 'swing' | 'stab'): void;
}

interface Body {
  sprite: Phaser.GameObjects.Sprite;
  pool: Phaser.GameObjects.Image;
  t: number;
}

interface LyingDrop {
  id: string;
  x: number;
  y: number;
  drop: Drop;
  sprite: Phaser.GameObjects.Image;
}

interface Flash {
  obj: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
  t: number;
  life: number;
}

const W = () => BALANCE.combatWorld;

export class CombatWorld {
  private hp = new Map<string, number>();
  private bodies: Body[] = [];
  private drops: LyingDrop[] = [];
  private flashes: Flash[] = [];
  private decals: { img: Phaser.GameObjects.Image; t: number }[] = [];
  private copCooldown = new Map<Phaser.GameObjects.Sprite, number>();
  private dropSeq = 0;
  /** The player opened fire during this chase: police shoot back even at 1★ (docs/07). */
  shotFirst = false;
  private wasHeld = false;

  constructor(
    private scene: Phaser.Scene,
    private host: CombatHost,
  ) {
    // weapon pictures for the drops on the ground, from the UI icon sheet
    const tex = scene.textures.get('ui_icons');
    const frames = (
      iconsJson as unknown as { frames: Record<string, { x: number; y: number; w: number; h: number }> }
    ).frames;
    for (const [name, f] of Object.entries(frames))
      if (name.startsWith('weapon/') && !tex.has(name)) tex.add(name, 0, f.x, f.y, f.w, f.h);
  }

  private targets(): Target[] {
    const r = W().hitRadius;
    return [
      ...this.host.peds().map((p) => ({ id: `ped:${p.id}`, x: p.x, y: p.y, r })),
      ...this.host.cops().map((c, k) => ({ id: `cop:${k}`, x: c.x, y: c.y, r })),
    ];
  }

  /** Left mouse while the game runs: shoot, swing or click empty. `angle` is the aim in the world ground plane. */
  trigger(angle: number, down: boolean): FireResult | null {
    const held = down && this.wasHeld;
    this.wasHeld = down;
    if (!down) return null;
    const c = this.host.combat();
    const r = fire(c, this.host.rng, angle, held);
    const p = this.host.player();
    const blockers = this.host.blockers();
    if (r.kind === 'swing') {
      this.host.playAction(r.weapon === 'knife' ? 'stab' : 'swing');
      const hit = swingHit(p, angle, r, this.targets(), blockers);
      if (hit) this.damage(hit, r.damage, angle);
      // a fight anyone sees is a crime (docs/05)
      if (hit) this.host.crime(BALANCE.combat.stars.fight, p, 0);
    } else if (r.kind === 'shot') {
      const muzzle = this.muzzle(p, angle);
      let hitPerson = false;
      for (const a of r.shot.angles) {
        const t = traceShot(p, a, r.shot.range, this.targets(), blockers);
        this.tracer(muzzle, t.at);
        if (t.hit) {
          hitPerson ||= t.hit.startsWith('ped:');
          this.damage(t.hit, r.shot.damage, a);
        } else if (t.blocked) this.spark(t.at);
        if (r.explosive) for (const b of blast(t.at, this.targets())) this.damage(b.id, b.damage, a);
        if (r.explosive) this.explosion(t.at);
      }
      this.flash(p, angle);
      // gunfire carries: everyone who hears it calls it in; the police shoot back from now on
      if (!r.silent) {
        // shots fired are a disturbance (1★, assumed); hitting someone is a shooting (docs/05: 3★)
        const S = BALANCE.combat.stars;
        this.host.crime(hitPerson ? S.shootCivilian : S.fight, p, W().gunfireHearTiles);
        this.shotFirst = true;
      }
    }
    return r;
  }

  /** Where the barrel is, in world units (the hands are about chest high; the projection handles the height). */
  private muzzle(p: { x: number; y: number }, angle: number): { x: number; y: number } {
    return { x: p.x + Math.cos(angle) * W().muzzleReach, y: p.y + Math.sin(angle) * W().muzzleReach };
  }

  private damage(id: string, amount: number, angle: number): void {
    const [kind, key] = id.split(':') as [string, string];
    const left = (this.hp.get(id) ?? (kind === 'cop' ? W().copHealth : W().pedHealth)) - amount;
    this.hp.set(id, left);
    const w = this.host.wanted();
    if (kind === 'ped') {
      const ped = this.host.peds().find((q) => String(q.id) === key);
      if (!ped) return;
      this.bloodDrop(ped.x + Math.cos(angle) * 6, ped.y + Math.sin(angle) * 6);
      if (left <= 0) {
        this.down(ped.sprite, ped.x, ped.y, angle);
        this.host.removePed(ped.id);
        this.hp.delete(id);
      }
    } else {
      const cop = this.host.cops()[Number(key)];
      if (!cop) return;
      this.bloodDrop(cop.x + Math.cos(angle) * 6, cop.y + Math.sin(angle) * 6);
      reportCombat(w, left <= 0 ? 'killPolice' : 'shootPolice', this.host.player());
      if (left <= 0) {
        this.down(cop.sprite, cop.x, cop.y, angle);
        this.leaveDrop(cop.x, cop.y, rollDrop(policeWeapon(Math.max(1, w.stars)), this.host.rng));
        this.host.removeCop(cop.sprite);
        this.hp.delete(id);
      }
    }
  }

  /** Someone goes down: they fall where they stood, a pool spreads under them, then they fade (no gore). */
  private down(from: Phaser.GameObjects.Sprite, x: number, y: number, angle: number): void {
    const s = this.scene.add.sprite(0, 0, from.texture.key, from.frame.name);
    s.setAngle(Math.cos(angle) >= 0 ? 90 : -90);
    this.host.layer.add(s);
    this.host.place(s, x, y, 4);
    const pool = this.scene.add.image(0, 0, FX_TEXTURE.fx, 'blood_pool/0');
    this.host.groundLayer.add(pool);
    const sp = worldToScreen(x, y);
    pool.setPosition(Math.round(sp.x), Math.round(sp.y)).setDepth(1e6 - 3);
    this.bodies.push({ sprite: s, pool, t: 0 });
  }

  private leaveDrop(x: number, y: number, drop: Drop): void {
    const id = `drop:${++this.dropSeq}`;
    const sp = worldToScreen(x, y);
    const img = this.scene.add.image(Math.round(sp.x), Math.round(sp.y), 'ui_icons', `weapon/${drop.weapon}`);
    img.setOrigin(0.5, 0.7).setDepth(1e6 - 1);
    this.host.groundLayer.add(img);
    this.drops.push({ id, x, y, drop, sprite: img });
    this.host.addUsable(id, x, y, `TAKE ${WEAPONS[drop.weapon].name}`);
  }

  /** E on a dropped weapon: returns it (and takes it off the ground). */
  take(id: string): Drop | null {
    const d = this.drops.find((q) => q.id === id);
    if (!d) return null;
    d.sprite.destroy();
    this.drops = this.drops.filter((q) => q !== d);
    this.host.removeUsable(id);
    return d.drop;
  }

  /** A weapon swapped out of a full slot is left on the ground. */
  dropAt(x: number, y: number, drop: Drop): void {
    this.leaveDrop(x, y, drop);
  }

  private bloodDrop(x: number, y: number): void {
    const sp = worldToScreen(x, y);
    const img = this.scene.add.image(
      Math.round(sp.x),
      Math.round(sp.y),
      FX_TEXTURE.fx,
      `blood_drop/${this.host.rng.int(0, 2)}`,
    );
    img.setDepth(1e6 - 3);
    this.host.groundLayer.add(img);
    this.decals.push({ img, t: 0 });
  }

  private flash(p: { x: number; y: number }, angle: number): void {
    const m = this.muzzle(p, angle);
    const s = worldToScreen(m.x, m.y, W().handHeight);
    const dir = DIRS[facingFromWorld(Math.cos(angle), Math.sin(angle))] as string;
    const img = this.scene.add.image(
      Math.round(s.x),
      Math.round(s.y),
      FX_TEXTURE.effects,
      `muzzle_flash/${dir}/0`,
    );
    img.setDepth(3e6).setBlendMode(Phaser.BlendModes.ADD);
    this.host.layer.add(img);
    this.flashes.push({ obj: img, t: 0, life: W().flashSeconds });
  }

  private tracer(from: { x: number; y: number }, to: { x: number; y: number }): void {
    const a = worldToScreen(from.x, from.y, W().handHeight);
    const b = worldToScreen(to.x, to.y, W().handHeight);
    const g = this.scene.add.graphics();
    g.lineStyle(1, 0xeee9e8, 0.85);
    g.lineBetween(Math.round(a.x), Math.round(a.y), Math.round(b.x), Math.round(b.y));
    g.setDepth(3e6);
    this.host.layer.add(g);
    this.flashes.push({ obj: g, t: 0, life: W().tracerSeconds });
  }

  private spark(at: { x: number; y: number }): void {
    const s = worldToScreen(at.x, at.y, W().handHeight);
    const img = this.scene.add.image(Math.round(s.x), Math.round(s.y), FX_TEXTURE.effects, 'hit_spark/0');
    img.setDepth(3e6).setBlendMode(Phaser.BlendModes.ADD);
    this.host.layer.add(img);
    this.flashes.push({ obj: img, t: 0, life: W().flashSeconds * 2 });
  }

  private explosion(at: { x: number; y: number }): void {
    const s = worldToScreen(at.x, at.y);
    const img = this.scene.add.image(Math.round(s.x), Math.round(s.y), FX_TEXTURE.effects, 'explosion/2');
    img.setDepth(3e6).setBlendMode(Phaser.BlendModes.ADD);
    this.host.layer.add(img);
    this.flashes.push({ obj: img, t: 0, life: 0.4 });
  }

  /** One step: the police shoot back, bodies fade, flashes and tracers die. */
  update(dt: number, inside: boolean): void {
    const w = this.host.wanted();
    if (w.stars === 0) this.shotFirst = false;
    if (!inside && policeMayShoot(w.stars, this.shotFirst)) this.copsShoot(dt, w);
    const B = W();
    for (const b of this.bodies) {
      b.t += dt;
      const grow = Math.min(3, Math.floor(b.t / B.poolGrowSeconds));
      if (b.pool.frame.name !== `blood_pool/${grow}`) b.pool.setFrame(`blood_pool/${grow}`);
      if (b.t > B.bodySeconds) {
        const a = Math.max(0, 1 - (b.t - B.bodySeconds) / B.fadeSeconds);
        b.sprite.setAlpha(a);
        b.pool.setAlpha(a);
      }
    }
    this.bodies = this.bodies.filter((b) => {
      if (b.t < B.bodySeconds + B.fadeSeconds) return true;
      b.sprite.destroy();
      b.pool.destroy();
      return false;
    });
    for (const d of this.decals) {
      d.t += dt;
      if (d.t > B.bodySeconds) d.img.setAlpha(Math.max(0, 1 - (d.t - B.bodySeconds) / B.fadeSeconds));
    }
    this.decals = this.decals.filter((d) => {
      if (d.t < B.bodySeconds + B.fadeSeconds) return true;
      d.img.destroy();
      return false;
    });
    for (const f of this.flashes) f.t += dt;
    this.flashes = this.flashes.filter((f) => {
      if (f.t < f.life) return true;
      f.obj.destroy();
      return false;
    });
  }

  /** Officers on foot with the player in sight and in range fire every so often (docs/07). */
  private copsShoot(dt: number, w: WantedState): void {
    const p = this.host.player();
    const weapon = policeWeapon(w.stars);
    const range = BALANCE.combat.weapons[weapon].range * TILE;
    const blockers = this.host.blockers();
    for (const c of this.host.cops()) {
      let t = (this.copCooldown.get(c.sprite) ?? this.host.rng.range(0.4, 1.2)) - dt;
      if (t <= 0) {
        const d = Math.hypot(p.x - c.x, p.y - c.y);
        if (d <= range && canSee(c, p, range / TILE, this.host.buildings)) {
          const angle = Math.atan2(p.y - c.y, p.x - c.x);
          const shot = policeShot(w.stars, this.host.rng, angle);
          const me: Target = { id: 'player', x: p.x, y: p.y, r: W().hitRadius };
          const from = this.muzzle(c, angle);
          for (const a of shot.angles) {
            const tr = traceShot(c, a, shot.range, [me], blockers);
            this.tracer(from, tr.at);
            if (tr.hit) {
              this.bloodDrop(p.x, p.y);
              const r = hurt(this.host.vitals(), this.host.combat(), shot.damage * W().copDamageShare);
              if (r.down) {
                this.host.playerDown();
                return;
              }
            } else if (tr.blocked) this.spark(tr.at);
          }
          this.flash(c, angle);
        }
        const [lo, hi] = W().copShootEvery;
        t = this.host.rng.range(lo, hi);
      }
      this.copCooldown.set(c.sprite, t);
    }
  }

  /** Everything off the street (the chase ended in an arrest or a hospital stay, or a load). */
  clear(): void {
    for (const b of this.bodies) {
      b.sprite.destroy();
      b.pool.destroy();
    }
    for (const d of this.drops) {
      d.sprite.destroy();
      this.host.removeUsable(d.id);
    }
    for (const d of this.decals) d.img.destroy();
    for (const f of this.flashes) f.obj.destroy();
    this.bodies = [];
    this.drops = [];
    this.decals = [];
    this.flashes = [];
    this.hp.clear();
    this.shotFirst = false;
  }
}
