import { describe, expect, it } from 'vitest';
import { CONTACTS } from '../src/data/reputation';
import {
  arrested,
  completeCrime,
  contactsFor,
  createCrime,
  disableCameras,
  filmed,
  freshFootage,
  hasService,
  identifiedBy,
  isKnownFace,
  markIdentified,
  repFor,
  restocked,
  starsCleared,
  tierFor,
  tierProgress,
  wipeFootage,
} from '../src/systems/reputation';

describe('criminal reputation (docs/04)', () => {
  it('earns payout ÷ 6 plus 20 per crime', () => {
    expect(repFor(0)).toBe(20);
    expect(repFor(600)).toBe(120);
    expect(repFor(-50)).toBe(20);
  });

  it('reaches the tiers at 400 / 1,800 / 5,000 / 11,000', () => {
    expect(tierFor(0)).toBe(0);
    expect(tierFor(399)).toBe(0);
    expect(tierFor(400)).toBe(1);
    expect(tierFor(1800)).toBe(2);
    expect(tierFor(4999)).toBe(2);
    expect(tierFor(5000)).toBe(3);
    expect(tierFor(11000)).toBe(4);
    expect(tierFor(99999)).toBe(4);
  });

  it('reports progress to the next tier', () => {
    expect(tierProgress(200)).toEqual({ tier: 0, next: 400, share: 0.5 });
    expect(tierProgress(11000)).toEqual({ tier: 4, next: null, share: 1 });
  });

  it('pays at once when not wanted, and opens contacts and services on a tier-up', () => {
    const c = createCrime();
    expect(c.contacts).toEqual(['dez', 'marlo', 'fence', 'dealer']);
    const r = completeCrime(c, 2280, false); // 380 + 20 = 400
    expect(r).toMatchObject({ gained: 400, tierBefore: 0, tierAfter: 1, newContacts: ['supplier'] });
    expect(r?.messages).toHaveLength(1);
    expect(c.rep).toBe(400);
    expect(hasService(c.rep, 'proLockpicks')).toBe(true);
    expect(hasService(c.rep, 'atmDrill')).toBe(false);
    expect(hasService(c.rep, 'fence')).toBe(true);
  });

  it('holds reputation while wanted: +25% on escape, nothing on arrest', () => {
    const c = createCrime();
    expect(completeCrime(c, 600, true)).toBeNull();
    expect(c.rep).toBe(0);
    const r = starsCleared(c);
    expect(r?.gained).toBe(150); // 120 × 1.25
    expect(c.rep).toBe(150);
    expect(starsCleared(c)).toBeNull();

    completeCrime(c, 600, true);
    expect(arrested(c)).toBe(120);
    expect(c.pending).toEqual([]);
    expect(c.rep).toBe(150);
  });

  it('sends one message per tier crossed in one award', () => {
    const c = createCrime();
    const r = completeCrime(c, 12000, false); // 2020: past Hustler and Known
    expect(r?.tierAfter).toBe(2);
    expect(r?.messages).toHaveLength(2);
    expect(r?.newContacts).toEqual(['supplier', 'gangContact']);
    expect(c.contacts).toHaveLength(CONTACTS.length);
  });

  it('lists contacts by tier', () => {
    expect(contactsFor(0)).not.toContain('gangContact');
    expect(contactsFor(2)).toContain('gangContact');
  });
});

describe('identification (docs/05)', () => {
  it('is a known face for 2 in-game days', () => {
    const c = createCrime();
    markIdentified(c, 1000);
    expect(isKnownFace(c, 1000 + 2 * 24 * 60 - 1)).toBe(true);
    expect(isKnownFace(c, 1000 + 2 * 24 * 60)).toBe(false);
  });

  it('puts an unmasked face on tape, which a wipe erases', () => {
    const f = freshFootage();
    filmed(f, true);
    expect(identifiedBy(f, false)).toBe(false);
    filmed(f, false);
    expect(identifiedBy(f, false)).toBe(true);
    wipeFootage(f);
    expect(identifiedBy(f, false)).toBe(false);
  });

  it('stops taping once the cameras are disabled', () => {
    const f = freshFootage();
    disableCameras(f);
    filmed(f, false);
    expect(identifiedBy(f, false)).toBe(false);
  });

  it('always identifies the work uniform (docs/04)', () => {
    expect(identifiedBy(freshFootage(), true)).toBe(true);
    expect(identifiedBy(null, true)).toBe(true);
  });

  it('knows when a place has restocked', () => {
    expect(restocked(null, 100, 60)).toBe(true);
    expect(restocked(50, 100, 60)).toBe(false);
    expect(restocked(40, 100, 60)).toBe(true);
  });
});
