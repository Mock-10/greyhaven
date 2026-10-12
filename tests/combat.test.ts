import { describe, expect, it } from 'vitest';
import { BALANCE_COMBAT } from '../src/config/balanceCombat';
import { TILE } from '../src/config/constants';
import { Rng } from '../src/core/rng';
import { DEALER_STOCK, WEAPONS, type WeaponId } from '../src/data/weapons';
import {
  armorShare,
  blast,
  buyAmmo,
  buyArmor,
  buyWeapon,
  createCombat,
  cycleWeapon,
  drawnWeapon,
  fire,
  giveWeapon,
  hudWeapon,
  hurt,
  moveFactor,
  normalizeCombat,
  pickUp,
  policeMayShoot,
  policeShot,
  policeWeapon,
  reload,
  reportCombat,
  revive,
  rollDrop,
  rollTrunkWeapon,
  seizeUnregistered,
  selectSlot,
  setRaised,
  canIntimidate,
  swingHit,
  tickCombat,
  traceShot,
  visibleWeapon,
  type CombatState,
} from '../src/systems/combat';
import { emptyWanted } from '../src/systems/wanted';

const rich = () => ({ clean: 100_000, dirty: 100_000 });

function armed(id: WeaponId, rounds = 100): CombatState {
  const c = createCombat();
  const r = giveWeapon(c, id, false, rounds, false);
  if (r.ok) selectSlot(c, r.slot);
  return c;
}

/** Run the fixed-step tick for `seconds`. */
function run(c: CombatState, v: { health: number; armor: number }, seconds: number, dt = 1 / 30): void {
  for (let t = 0; t < seconds; t += dt) tickCombat(c, v, dt);
}

describe('weapon catalogue (docs/07)', () => {
  it('has the docs/07 prices, damage and ammo packs', () => {
    const W = BALANCE_COMBAT.weapons;
    expect(W.pistol.price).toBe(600);
    expect(W.grenade_launcher.price).toBe(25_000);
    expect(W.lmg.price).toBe(18_000);
    expect(W.shotgun.damage * W.shotgun.pellets).toBe(64);
    expect(W.hunting_rifle.damage).toBe(70);
    expect(BALANCE_COMBAT.ammo['9mm']).toMatchObject({ price: 30, pack: 24 });
    expect(BALANCE_COMBAT.ammo.belt).toMatchObject({ price: 300, pack: 100 });
    expect(BALANCE_COMBAT.ammo.grenade).toMatchObject({ price: 400, pack: 1 });
  });

  it('gives every firearm its ammo type, with the SMG sharing 9mm with the pistol', () => {
    expect(WEAPONS.smg.ammo).toBe(WEAPONS.pistol.ammo);
    expect(WEAPONS.bat.ammo).toBeNull();
    for (const id of DEALER_STOCK) {
      const s = BALANCE_COMBAT.weapons[id];
      if (WEAPONS[id].ammo) expect(s.clip).toBeGreaterThan(0);
      else expect(s.clip).toBe(0);
    }
  });
});

describe('health and armor (docs/07)', () => {
  it('lets armor absorb 50 damage and then break', () => {
    const v = { health: 100, armor: 50 };
    expect(hurt(v, null, 30)).toEqual({ armor: 30, health: 0, down: false });
    expect(hurt(v, null, 30)).toEqual({ armor: 20, health: 10, down: false });
    expect(v).toEqual({ health: 90, armor: 0 });
    expect(armorShare(v)).toBe(0);
    expect(hurt(v, null, 200)).toEqual({ armor: 0, health: 90, down: true });
  });

  it('regenerates to 50 after 10 s out of combat, and no further', () => {
    const c = createCombat();
    const v = { health: 20, armor: 0 };
    hurt(v, c, 0);
    run(c, v, 9.5);
    expect(v.health).toBe(20);
    run(c, v, 10);
    expect(v.health).toBeGreaterThan(25);
    run(c, v, 60);
    expect(v.health).toBe(50);
    v.health = 80;
    run(c, v, 20);
    expect(v.health).toBe(80);
  });

  it('restarts the calm timer when hurt or firing', () => {
    const c = armed('pistol');
    const v = { health: 30, armor: 0 };
    hurt(v, c, 0);
    run(c, v, 9);
    fire(c, new Rng(1), 0, false);
    run(c, v, 9);
    expect(v.health).toBe(30);
  });

  it('wakes in hospital at full health with weapons kept', () => {
    const c = armed('pistol');
    const v = { health: 0, armor: 0 };
    revive(v, c);
    expect(v.health).toBe(100);
    expect(drawnWeapon(c)?.id).toBe('pistol');
  });
});

describe('loadout and switching', () => {
  it('holds 1 melee, 2 firearms and 1 heavy weapon', () => {
    const c = createCombat();
    expect(giveWeapon(c, 'bat', false, 0, false).ok).toBe(true);
    expect(giveWeapon(c, 'knife', false, 0, false)).toEqual({ ok: false, why: 'full' });
    expect(giveWeapon(c, 'pistol', false, 0, false).ok).toBe(true);
    expect(giveWeapon(c, 'shotgun', false, 0, false).ok).toBe(true);
    expect(giveWeapon(c, 'smg', false, 0, false)).toEqual({ ok: false, why: 'full' });
    expect(giveWeapon(c, 'lmg', false, 0, false).ok).toBe(true);
    expect(c.slots.map((w) => w?.id)).toEqual(['bat', 'pistol', 'shotgun', 'lmg']);
  });

  it('switches with keys 1–4 and the wheel, holstering on the same key', () => {
    const c = createCombat();
    giveWeapon(c, 'bat', false, 0, false);
    giveWeapon(c, 'lmg', false, 0, false);
    selectSlot(c, 3);
    expect(drawnWeapon(c)?.id).toBe('lmg');
    selectSlot(c, 3);
    expect(c.drawn).toBe(-1);
    selectSlot(c, 1); // empty firearm slot: holstered
    expect(c.drawn).toBe(-1);
    cycleWeapon(c, 1);
    expect(drawnWeapon(c)?.id).toBe('bat');
    cycleWeapon(c, 1);
    expect(drawnWeapon(c)?.id).toBe('lmg');
    cycleWeapon(c, 1);
    expect(c.drawn).toBe(-1);
    cycleWeapon(c, -1);
    expect(drawnWeapon(c)?.id).toBe('lmg');
  });

  it('slows the player only while the LMG is drawn', () => {
    const c = armed('lmg');
    expect(moveFactor(c)).toBe(BALANCE_COMBAT.lmgMoveFactor);
    selectSlot(c, -1);
    expect(moveFactor(c)).toBe(1);
  });

  it('counts a holstered pistol as concealed, a carried shotgun as visible', () => {
    const c = armed('pistol');
    expect(visibleWeapon(c)).toBe(true);
    selectSlot(c, -1);
    expect(visibleWeapon(c)).toBe(false);
    giveWeapon(c, 'shotgun', false, 0, false);
    expect(visibleWeapon(c)).toBe(true);
  });

  it('intimidates only with a weapon raised', () => {
    const c = createCombat();
    setRaised(c, true);
    expect(canIntimidate(c)).toBe(false);
    giveWeapon(c, 'knife', false, 0, false);
    selectSlot(c, 0);
    expect(canIntimidate(c)).toBe(false);
    setRaised(c, true);
    expect(canIntimidate(c)).toBe(true);
  });
});

describe('firing and reloading', () => {
  it('spends a round per shot and respects the rate of fire', () => {
    const c = armed('pistol', 36);
    const rng = new Rng(3);
    expect(drawnWeapon(c)?.clip).toBe(12);
    expect(fire(c, rng, 0, false).kind).toBe('shot');
    expect(fire(c, rng, 0, false)).toEqual({ kind: 'none', why: 'cooldown' });
    expect(drawnWeapon(c)?.clip).toBe(11);
    expect(hudWeapon(c)).toEqual({ label: 'PISTOL', ammo: '11/24', type: '9MM' });
  });

  it('fires automatics while held, semi-automatics once per click', () => {
    const p = armed('pistol');
    const s = armed('smg');
    const v = { health: 100, armor: 0 };
    fire(p, new Rng(1), 0, false);
    fire(s, new Rng(1), 0, false);
    run(p, v, 1);
    run(s, v, 1);
    expect(fire(p, new Rng(1), 0, true)).toEqual({ kind: 'none', why: 'held' });
    expect(fire(s, new Rng(1), 0, true).kind).toBe('shot');
  });

  it('fires 8 pellets from the shotgun, tighter when raised', () => {
    const c = armed('shotgun');
    const r = fire(c, new Rng(9), 1, false);
    if (r.kind !== 'shot') throw new Error(r.kind);
    expect(r.shot.angles).toHaveLength(8);
    expect(r.shot.damage).toBe(8);
    const spreadOf = (raised: boolean) => {
      const k = armed('hunting_rifle');
      setRaised(k, raised);
      let worst = 0;
      const rng = new Rng(5);
      for (let n = 0; n < 40; n++) {
        k.cooldown = 0;
        k.reloading = 0;
        const f = fire(k, rng, 0, false);
        if (f.kind === 'shot') worst = Math.max(worst, Math.abs(f.shot.angles[0] as number));
        drawnWeapon(k)!.clip = 5;
      }
      return worst;
    };
    expect(spreadOf(true)).toBeLessThan(spreadOf(false));
  });

  it('reloads from the shared reserve when the clip runs dry', () => {
    const c = armed('revolver', 8);
    const v = { health: 100, armor: 0 };
    const rng = new Rng(2);
    for (let k = 0; k < 6; k++) {
      c.cooldown = 0;
      fire(c, rng, 0, false);
    }
    expect(drawnWeapon(c)?.clip).toBe(0);
    expect(c.reloading).toBeGreaterThan(0); // the last shot started a reload
    expect(fire(c, rng, 0, false)).toEqual({ kind: 'none', why: 'reloading' });
    run(c, v, 3);
    expect(drawnWeapon(c)?.clip).toBe(2);
    expect(c.ammo['357']).toBe(0);
    for (let k = 0; k < 2; k++) {
      c.cooldown = 0;
      fire(c, rng, 0, false);
    }
    c.cooldown = 0;
    expect(fire(c, rng, 0, false)).toEqual({ kind: 'empty', reloading: false });
    expect(reload(c)).toBe(false);
  });

  it('swings melee weapons and fists silently, with no ammo', () => {
    const c = createCombat();
    const r = fire(c, new Rng(1), 0, false);
    expect(r).toMatchObject({
      kind: 'swing',
      weapon: null,
      damage: BALANCE_COMBAT.fists.damage,
      silent: true,
    });
    const b = armed('bat');
    expect(fire(b, new Rng(1), 0, false)).toMatchObject({ kind: 'swing', weapon: 'bat', damage: 25 });
    expect(hudWeapon(b)).toEqual({ label: 'BAT', ammo: '-/-', type: 'MELEE' });
  });

  it('gives police the star-level weapon with a wider spread', () => {
    expect(policeShot(2, new Rng(1), 0).damage).toBe(20);
    expect(policeShot(3, new Rng(1), 0).angles).toHaveLength(8);
    expect(policeShot(5, new Rng(1), 0).damage).toBe(28);
  });
});

describe('hit tests', () => {
  const wall = [100, -50, 120, 50] as const;

  it('hits the nearest target in range', () => {
    const t = [
      { id: 'far', x: 200, y: 0, r: 8 },
      { id: 'near', x: 60, y: 2, r: 8 },
    ];
    expect(traceShot({ x: 0, y: 0 }, 0, 400, t, []).hit).toBe('near');
    expect(traceShot({ x: 0, y: 0 }, Math.PI, 400, t, []).hit).toBeNull();
    expect(traceShot({ x: 0, y: 0 }, 0, 40, t, []).hit).toBeNull();
  });

  it('stops at buildings and cars', () => {
    const r = traceShot({ x: 0, y: 0 }, 0, 400, [{ id: 'cop', x: 200, y: 0, r: 8 }], [wall]);
    expect(r.hit).toBeNull();
    expect(r.blocked).toBe(true);
    expect(r.at.x).toBeCloseTo(100);
  });

  it('swings at the nearest target within reach and arc', () => {
    const t = [
      { id: 'front', x: 30, y: 0, r: 8 },
      { id: 'behind', x: -20, y: 0, r: 8 },
      { id: 'far', x: 80, y: 0, r: 8 },
    ];
    const swing = { range: 1.3 * TILE, arc: Math.PI / 3 };
    expect(swingHit({ x: 0, y: 0 }, 0, swing, t, [])).toBe('front');
    expect(swingHit({ x: 0, y: 0 }, Math.PI / 2, swing, t, [])).toBeNull();
    expect(swingHit({ x: 0, y: 0 }, 0, swing, t, [[10, -20, 15, 20]])).toBeNull();
  });

  it('falls off the grenade blast from 120 at the centre', () => {
    const R = (BALANCE_COMBAT.weapons.grenade_launcher.blastRadius as number) * TILE;
    const hits = blast({ x: 0, y: 0 }, [
      { id: 'centre', x: 0, y: 0, r: 8 },
      { id: 'edge', x: R + 8, y: 0, r: 8 },
      { id: 'out', x: R * 2, y: 0, r: 8 },
      { id: 'car', x: R / 2, y: 0, r: 0 },
    ]);
    expect(hits).toEqual([
      { id: 'centre', damage: 120 },
      { id: 'edge', damage: 30 },
      { id: 'car', damage: 75 },
    ]);
  });
});

describe('buying (docs/07)', () => {
  it('sells everything at dealers for dirty cash, unregistered', () => {
    const c = createCombat();
    const m = rich();
    expect(buyWeapon(c, m, 'grenade_launcher', 'dealer').ok).toBe(true);
    expect(m.dirty).toBe(75_000);
    expect(m.clean).toBe(100_000);
    expect(c.slots[3]).toEqual({ id: 'grenade_launcher', registered: false, clip: 1 });
    expect(buyWeapon(c, m, 'lmg', 'dealer')).toEqual({ ok: false, text: 'NO FREE HEAVY SLOT' });
    expect(buyWeapon(c, m, 'grenade_launcher', 'dealer').ok).toBe(false);
    expect(buyWeapon(c, { clean: 0, dirty: 50 }, 'bat', 'dealer')).toEqual({
      ok: false,
      text: 'NOT ENOUGH DIRTY CASH',
    });
  });

  it('sells only the pistol and shotgun at the gun store, for clean cash, registered', () => {
    const c = createCombat();
    const m = rich();
    expect(buyWeapon(c, m, 'smg', 'gunstore')).toEqual({ ok: false, text: 'NOT SOLD HERE' });
    expect(buyWeapon(c, m, 'pistol', 'gunstore').ok).toBe(true);
    expect(m.clean).toBe(99_400);
    expect(c.slots[1]?.registered).toBe(true);
    expect(buyAmmo(c, m, '556', 'gunstore').ok).toBe(false);
    expect(buyAmmo(c, m, '9mm', 'gunstore')).toEqual({ ok: true, text: 'BOUGHT 24 9MM' });
    expect(m.clean).toBe(99_370);
  });

  it('caps the ammo a player carries', () => {
    const c = createCombat();
    const m = rich();
    for (let k = 0; k < 6; k++) buyAmmo(c, m, 'grenade', 'dealer');
    expect(c.ammo.grenade).toBe(6);
    expect(buyAmmo(c, m, 'grenade', 'dealer').ok).toBe(false);
    expect(m.dirty).toBe(100_000 - 6 * 400);
  });

  it('sells body armor for $400 dirty, refusing a full vest', () => {
    const v = { health: 100, armor: 10 };
    const m = rich();
    expect(buyArmor(v, m).ok).toBe(true);
    expect(v.armor).toBe(50);
    expect(m.dirty).toBe(99_600);
    expect(buyArmor(v, m).ok).toBe(false);
  });
});

describe('looting and the police (docs/07, docs/05)', () => {
  it('arms police by stars: pistols, then shotguns, then rifles', () => {
    expect([1, 2, 3, 4, 5].map(policeWeapon)).toEqual([
      'pistol',
      'pistol',
      'shotgun',
      'assault_rifle',
      'assault_rifle',
    ]);
  });

  it('lets police shoot only from 2★, or after the player shoots first', () => {
    expect(policeMayShoot(1, false)).toBe(false);
    expect(policeMayShoot(1, true)).toBe(true);
    expect(policeMayShoot(2, false)).toBe(true);
    expect(policeMayShoot(0, true)).toBe(false);
  });

  it('drops the weapon with some ammo; looted weapons are unregistered', () => {
    const d = rollDrop('shotgun', new Rng(4));
    expect(d.weapon).toBe('shotgun');
    expect(d.rounds).toBeGreaterThan(0);
    const c = createCombat();
    expect(pickUp(c, d).text).toBe('PICKED UP SHOTGUN');
    expect(c.slots[1]?.registered).toBe(false);
    const again = pickUp(c, { weapon: 'shotgun', rounds: 10 });
    expect(again.text).toBe('+10 12 GA');
  });

  it('swaps out the drawn weapon when the slots are full', () => {
    const c = createCombat();
    giveWeapon(c, 'pistol', true, 0, false);
    giveWeapon(c, 'revolver', false, 0, false);
    selectSlot(c, 2);
    const r = pickUp(c, { weapon: 'assault_rifle', rounds: 20 });
    expect(r.dropped?.id).toBe('revolver');
    expect(c.slots.map((w) => w?.id)).toEqual([undefined, 'pistol', 'assault_rifle', undefined]);
  });

  it('raises the stars to 3 for shooting at police and 4 for killing one', () => {
    const w = emptyWanted();
    reportCombat(w, 'fight', { x: 0, y: 0 });
    expect(w.stars).toBe(1);
    reportCombat(w, 'shootPolice', { x: 0, y: 0 });
    expect(w.stars).toBe(3);
    reportCombat(w, 'shootPolice', { x: 0, y: 0 });
    expect(w.stars).toBe(3);
    reportCombat(w, 'killPolice', { x: 5, y: 5 });
    expect(w.stars).toBe(4);
    expect(w.lastKnown).toEqual({ x: 5, y: 5 });
    reportCombat(w, 'shootCivilian', { x: 0, y: 0 });
    expect(w.stars).toBe(5);
  });

  it('seizes unregistered weapons in jail, keeping registered ones and ammo', () => {
    const c = createCombat();
    giveWeapon(c, 'pistol', true, 30, false);
    giveWeapon(c, 'smg', false, 30, false);
    selectSlot(c, 2);
    expect(seizeUnregistered(c)).toEqual(['smg']);
    expect(c.slots.map((w) => w?.id)).toEqual([undefined, 'pistol', undefined, undefined]);
    expect(c.drawn).toBe(-1);
    expect(c.ammo['9mm']).toBeGreaterThan(0);
  });

  it('sometimes finds a gun in a trunk', () => {
    const rng = new Rng(11);
    let found = 0;
    for (let k = 0; k < 2000; k++) if (rollTrunkWeapon(rng)) found++;
    expect(found / 2000).toBeGreaterThan(BALANCE_COMBAT.trunkGun.chance * 0.6);
    expect(found / 2000).toBeLessThan(BALANCE_COMBAT.trunkGun.chance * 1.4);
  });
});

describe('saving', () => {
  it('round-trips through JSON and fills in old or bad saves', () => {
    const c = armed('pistol', 40);
    giveWeapon(c, 'bat', false, 0, false);
    const back = normalizeCombat(JSON.parse(JSON.stringify(c)) as CombatState);
    expect(back.slots).toEqual(c.slots);
    expect(back.ammo).toEqual(c.ammo);
    expect(back.drawn).toBe(c.drawn);
    expect(normalizeCombat(undefined)).toEqual(createCombat());
    const bad = normalizeCombat({
      slots: [{ id: 'lmg', registered: false, clip: 5 }, null, null, null],
      ammo: { '9mm': 99_999 },
      drawn: 0,
    });
    expect(bad.slots[0]).toBeNull();
    expect(bad.ammo['9mm']).toBe(BALANCE_COMBAT.ammo['9mm'].max);
    expect(bad.drawn).toBe(-1);
  });
});
