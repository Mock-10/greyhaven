import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { BALANCE_POLICE } from '../src/config/balancePolice';
import { TILE } from '../src/config/constants';
import { Rng } from '../src/core/rng';
import {
  callChance,
  callSeconds,
  cameraSees,
  cameraSystem,
  cutCameras,
  daylight,
  emptyHeat,
  guardDisable,
  identifies,
  knownFace,
  knownFaceUntil,
  pruneHeat,
  recordCrime,
  restoreCameras,
  sighted,
  tickCameras,
  watchesMask,
  wipeFootage,
} from '../src/systems/identify';
import {
  book,
  bribeJudge,
  bribeOnScene,
  canSurrender,
  hireLawyer,
  judgeOffered,
  lawyerOffered,
  onScenePrice,
  releaseAt,
  sentence,
} from '../src/systems/jail';
import {
  changedOutfit,
  changedVehicle,
  crushedHotCar,
  emptyChase,
  enteredOwnedProperty,
  escalate,
  killedOfficer,
  planResponse,
  policeShoot,
  policeSighting,
  putOnHighVis,
  reinforcements,
  roadblockChancePerMinute,
  shotAtPolice,
  stoleCruiser,
  tickChaos,
} from '../src/systems/response';
import { addStars, emptyWanted, escapeSecondsFor } from '../src/systems/wanted';

const DAY = 24 * 60;
const O = { x: 0, y: 0 };
const bare = { masked: false, uniform: false };
const masked = { masked: true, uniform: false };
const uniform = { masked: false, uniform: true };

describe('identification (docs/05, docs/04)', () => {
  it('cameras and police identify a bare face; masks hide it; witnesses never put a face to it', () => {
    expect(identifies('camera', bare)).toBe(true);
    expect(identifies('police', bare)).toBe(true);
    expect(identifies('witness', bare)).toBe(false);
    for (const by of ['camera', 'police', 'witness'] as const) expect(identifies(by, masked)).toBe(false);
  });

  it('a work uniform identifies 100% of the time, even under a mask', () => {
    for (const by of ['camera', 'police', 'witness'] as const) {
      expect(identifies(by, uniform)).toBe(true);
      expect(identifies(by, { masked: true, uniform: true })).toBe(true);
    }
  });

  it('makes the player a known face for 2 in-game days after the last identification', () => {
    const h = emptyHeat();
    expect(knownFace(h, 0)).toBe(false);
    expect(sighted(h, 'police', bare, 100)).toBe(true);
    expect(knownFaceUntil(h, 100)).toBe(100 + 2 * DAY);
    expect(knownFace(h, 100 + 2 * DAY - 1)).toBe(true);
    expect(knownFace(h, 100 + 2 * DAY)).toBe(false);
    // a fresh sighting refreshes, one record per source
    sighted(h, 'police', bare, 500);
    expect(h.ids).toHaveLength(1);
    expect(knownFaceUntil(h, 600)).toBe(500 + 2 * DAY);
    pruneHeat(h, 500 + 2 * DAY);
    expect(h.ids).toHaveLength(0);
  });

  it('wiping a DVR erases that building only, even for an unmasked face', () => {
    const h = emptyHeat();
    sighted(h, 'camera', bare, 10, 'store_a');
    sighted(h, 'camera', bare, 20, 'store_b');
    expect(wipeFootage(h, 'store_a')).toBe(true);
    expect(knownFace(h, 30)).toBe(true); // store_b still has the footage
    expect(wipeFootage(h, 'store_b')).toBe(true);
    expect(knownFace(h, 30)).toBe(false);
    expect(wipeFootage(h, 'store_b')).toBe(false);
    // a police sighting can't be wiped
    sighted(h, 'police', bare, 40);
    wipeFootage(h, 'store_a');
    expect(knownFace(h, 50)).toBe(true);
  });
});

describe('cameras (docs/04 store layout)', () => {
  // a camera at the origin looking along +x
  const cam = { x: 0, y: 0, facing: 0 };
  const ahead = { x: 3 * TILE, y: 0 };

  it('sees inside its cone and range, not behind it or through walls', () => {
    expect(cameraSees(cam, ahead)).toBe(true);
    expect(cameraSees(cam, { x: -3 * TILE, y: 0 })).toBe(false);
    expect(cameraSees(cam, { x: 0, y: 3 * TILE })).toBe(false); // 90° off a 90° cone
    expect(cameraSees(cam, { x: (BALANCE_POLICE.camera.rangeTiles + 1) * TILE, y: 0 })).toBe(false);
    expect(cameraSees(cam, ahead, [[TILE, -10, TILE + 8, 10]])).toBe(false);
  });

  it('files the footage under the building when an unmasked face is recorded', () => {
    const sys = cameraSystem('store_a', [cam]);
    const h = emptyHeat();
    expect(recordCrime(sys, h, ahead, masked, 0)).toEqual({ recorded: true, identified: false });
    expect(knownFace(h, 1)).toBe(false);
    expect(recordCrime(sys, h, ahead, bare, 0)).toEqual({ recorded: true, identified: true });
    expect(h.ids[0]!.source).toBe('camera:store_a');
  });

  it('records nothing once cut (rest of the robbery) or during the guard perk (60 s)', () => {
    const sys = cameraSystem('store_a', [cam]);
    const h = emptyHeat();
    guardDisable(sys);
    expect(recordCrime(sys, h, ahead, bare, 0).recorded).toBe(false);
    tickCameras(sys, BALANCE_POLICE.camera.guardDisableSeconds - 1);
    expect(recordCrime(sys, h, ahead, bare, 0).recorded).toBe(false);
    tickCameras(sys, 2);
    expect(recordCrime(sys, h, ahead, bare, 0).recorded).toBe(true);
    cutCameras(sys);
    tickCameras(sys, 9999);
    expect(recordCrime(sys, emptyHeat(), ahead, bare, 0).recorded).toBe(false);
    restoreCameras(sys);
    expect(recordCrime(sys, emptyHeat(), ahead, bare, 0).recorded).toBe(true);
  });
});

describe('witness modifiers (docs/05, docs/03)', () => {
  const none = { knownFace: false, watchingMask: false, postalUniform: false };

  it('a known face is called in 30% faster; the postal uniform makes it 30% slower', () => {
    expect(callSeconds(10, none)).toBe(10);
    expect(callSeconds(10, { ...none, knownFace: true })).toBeCloseTo(7);
    expect(callSeconds(10, { ...none, postalUniform: true })).toBeCloseTo(13);
  });

  it('a mask in daylight draws eyes within 5 tiles and adds 25% to the call chance', () => {
    const noon = 12 * 60;
    const midnight = 0;
    expect(daylight(noon)).toBe(true);
    expect(daylight(midnight)).toBe(false);
    expect(watchesMask(true, noon, 4)).toBe(true);
    expect(watchesMask(true, noon, 6)).toBe(false);
    expect(watchesMask(true, midnight, 4)).toBe(false);
    expect(watchesMask(false, noon, 1)).toBe(false);
    expect(callChance(0.6, { ...none, watchingMask: true })).toBeCloseTo(0.75);
    expect(callChance(1, { ...none, watchingMask: true })).toBe(1);
  });
});

describe('police response (docs/05 table)', () => {
  it('sends the right units for each star level', () => {
    const rng = new Rng(7);
    const r1 = planResponse(1, rng);
    expect(r1).toMatchObject({ cruisers: 1, chase: false, weapon: 'pistol', roadblocks: 0, helicopters: 0 });
    for (let k = 0; k < 20; k++) {
      const r2 = planResponse(2, rng);
      expect(r2.cruisers).toBeGreaterThanOrEqual(2);
      expect(r2.cruisers).toBeLessThanOrEqual(3);
      expect(r2.chase).toBe(true);
      const r3 = planResponse(3, rng);
      expect(r3.cruisers).toBeGreaterThanOrEqual(4);
      expect(r3.cruisers).toBeLessThanOrEqual(5);
    }
    expect(planResponse(3, rng)).toMatchObject({ weapon: 'shotgun', spikeStrips: true });
    expect(planResponse(3, rng).roadblocks).toBeGreaterThan(0);
    expect(planResponse(4, rng)).toMatchObject({ weapon: 'rifle', helicopters: 1 });
    expect(planResponse(4, rng).swatVans).toBeGreaterThan(0);
    const r5 = planResponse(5, rng);
    expect(r5.helicopters).toBe(2);
    expect(r5.armored).toBeGreaterThan(0);
    expect(planResponse(0, rng).cruisers).toBe(0);
  });

  it('sends fewer, slower police in the hood', () => {
    const r = planResponse(1, new Rng(1), { hood: true });
    expect(r.cruisers).toBe(1); // never below one
    const a = planResponse(3, new Rng(3));
    const b = planResponse(3, new Rng(3), { hood: true });
    expect(b.cruisers).toBe(a.cruisers - BALANCE_POLICE.hood.cruiserCut);
    expect(b.dispatchSeconds).toBe(a.dispatchSeconds * BALANCE_POLICE.hood.dispatchFactor);
  });

  it('stacks: going up never recalls units, and reinforcements are the difference', () => {
    const rng = new Rng(11);
    const p2 = planResponse(2, rng);
    const p4 = escalate(p2, 4, rng);
    expect(p4.cruisers).toBeGreaterThanOrEqual(p2.cruisers);
    expect(p4.stars).toBe(4);
    expect(escalate(p4, 3, rng)).toBe(p4);
    const add = reinforcements(p2, p4);
    expect(add.helicopters).toBe(1);
    expect(add.cruisers).toBe(p4.cruisers - p2.cruisers);
  });

  it('police only shoot at 2★ and above, or after the player shot first (docs/07)', () => {
    expect(policeShoot(1, false)).toBe(false);
    expect(policeShoot(1, true)).toBe(true);
    expect(policeShoot(2, false)).toBe(true);
    expect(policeShoot(0, true)).toBe(false);
  });

  it('puts up roadblocks from 3★, or from 2★ on a smuggling run (docs/04)', () => {
    expect(roadblockChancePerMinute(2, false)).toBe(0);
    expect(roadblockChancePerMinute(2, true)).toBe(BALANCE_POLICE.roadblockChancePerMinute);
    expect(roadblockChancePerMinute(3, false)).toBe(BALANCE_POLICE.roadblockChancePerMinute);
    expect(roadblockChancePerMinute(0, true)).toBe(0);
  });
});

describe('star escalations (docs/07, docs/08, docs/05)', () => {
  it('shooting at police means at least 3★, killing one at least 4★', () => {
    const w = emptyWanted();
    addStars(w, 1, O);
    expect(shotAtPolice(w, O)).toBe(true);
    expect(w.stars).toBe(3);
    expect(shotAtPolice(w, O)).toBe(false);
    expect(killedOfficer(w, O)).toBe(true);
    expect(w.stars).toBe(4);
    stoleCruiser(w, O);
    expect(w.stars).toBe(5);
  });

  it('a known face with a visible weapon gets +1★ on sight, once per chase', () => {
    const h = emptyHeat();
    const chase = emptyChase();
    const w = emptyWanted();
    expect(policeSighting(chase, w, h, 0, true, O)).toBe(false); // not on file
    sighted(h, 'police', bare, 0);
    expect(policeSighting(chase, w, h, 10, false, O)).toBe(false); // no weapon showing
    expect(policeSighting(chase, w, h, 10, true, O)).toBe(true);
    expect(w.stars).toBe(1);
    expect(policeSighting(chase, w, h, 20, true, O)).toBe(false);
  });

  it('sustained 4★ in police sight becomes 5★', () => {
    const chase = emptyChase();
    const w = emptyWanted();
    addStars(w, 4, O);
    w.seen = false;
    expect(tickChaos(chase, w, 1000)).toBe(false); // out of sight doesn't count
    w.seen = true;
    let up = false;
    for (let t = 0; t <= BALANCE_POLICE.chaosSecondsTo5 && !up; t++) up = tickChaos(chase, w, 1);
    expect(up).toBe(true);
    expect(w.stars).toBe(5);
  });
});

describe('losing the stars (docs/05 speed-ups)', () => {
  it('changing car or clothes unseen cuts 25% of the remaining timer, once each per chase', () => {
    const chase = emptyChase();
    const w = emptyWanted();
    addStars(w, 2, O);
    w.escape = 40;
    w.seen = true;
    expect(changedVehicle(chase, w)).toBe(false); // seen
    w.seen = false;
    expect(changedVehicle(chase, w)).toBe(true);
    expect(w.escape).toBeCloseTo(30);
    expect(changedVehicle(chase, w)).toBe(false);
    expect(changedOutfit(chase, w)).toBe(true);
    expect(w.escape).toBeCloseTo(22.5);
  });

  it('the high-vis disguise and the crusher drop a star once each', () => {
    const chase = emptyChase();
    const w = emptyWanted();
    addStars(w, 3, O);
    expect(putOnHighVis(chase, w)).toBe(true);
    expect(w.stars).toBe(2);
    expect(w.escape).toBeLessThanOrEqual(escapeSecondsFor(2));
    expect(putOnHighVis(chase, w)).toBe(false);
    expect(crushedHotCar(chase, w)).toBe(true);
    expect(w.stars).toBe(1);
    const w2 = emptyWanted();
    addStars(w2, 1, O);
    expect(crushedHotCar(emptyChase(), w2)).toBe(true);
    expect(w2).toEqual(emptyWanted());
  });

  it('an owned property clears 1–2★ if nobody saw the player go in', () => {
    const w = emptyWanted();
    addStars(w, 2, O);
    expect(enteredOwnedProperty(w, true)).toBe(false);
    expect(enteredOwnedProperty(w, false)).toBe(true);
    expect(w.stars).toBe(0);
    addStars(w, 3, O);
    expect(enteredOwnedProperty(w, false)).toBe(false);
  });

  it('the on-scene phone bribe clears 1–3★ for the tier price, once per chase', () => {
    expect([1, 2, 3, 4, 5].map(onScenePrice)).toEqual([300, 800, 2000, null, null]);
    const chase = emptyChase();
    const w = emptyWanted();
    addStars(w, 2, O);
    const money = { dirty: 500 };
    expect(bribeOnScene(chase, w, money).ok).toBe(false);
    money.dirty = 1000;
    expect(bribeOnScene(chase, w, money).ok).toBe(true);
    expect(money.dirty).toBe(200);
    expect(w.stars).toBe(0);
    addStars(w, 1, O);
    money.dirty = 1000;
    expect(bribeOnScene(chase, w, money).ok).toBe(false); // once per chase
    const w4 = emptyWanted();
    addStars(w4, 4, O);
    expect(bribeOnScene(emptyChase(), w4, { dirty: 99999 }).ok).toBe(false);
  });
});

describe('arrest, bribes and jail (docs/05, docs/02)', () => {
  it('offers the surrender prompt at 2★ and below, or when cornered', () => {
    expect(canSurrender(1, false)).toBe(true);
    expect(canSurrender(2, false)).toBe(true);
    expect(canSurrender(3, false)).toBe(false);
    expect(canSurrender(5, true)).toBe(true);
    expect(canSurrender(0, true)).toBe(false);
  });

  it('a first offense is a fine; the dirty cash and items stay', () => {
    const rec = { arrests: [] as number[] };
    const s = sentence(rec, 2, 3 * DAY, false);
    expect(s).toMatchObject({ repeat: false, fine: 500, jailDays: 0 });
    expect(lawyerOffered(s)).toBe(false);
    const money = { clean: 1000, dirty: 700 };
    const illegal = { product: 3 };
    const b = book(s, money, rec, illegal, 3 * DAY);
    expect(b).toMatchObject({ paid: 500, seizedCash: 0, jailDays: 0, releaseAt: 3 * DAY + 60 });
    expect(money).toEqual({ clean: 500, dirty: 700 });
    expect(illegal.product).toBe(3);
    expect(rec.arrests).toEqual([3 * DAY]);
  });

  it('a repeat offense jails, fines, and seizes carried dirty cash and illegal items', () => {
    const rec = { arrests: [DAY] };
    const now = 5 * DAY + 600;
    const s = sentence(rec, 3, now, false);
    expect(s).toMatchObject({ repeat: true, fine: 1200, jailDays: 2 });
    const money = { clean: 100, dirty: 4000 };
    const illegal = { product: 2, pistol: 1, ammo: 0 };
    const b = book(s, money, rec, illegal, now);
    expect(b.paid).toBe(100);
    expect(b.seizedCash).toBe(4000);
    expect(b.seizedItems).toEqual({ product: 2, pistol: 1 });
    expect(illegal).toEqual({ product: 0, pistol: 0, ammo: 0 });
    expect(money).toEqual({ clean: 0, dirty: 0 });
    expect(b.releaseAt).toBe(7 * DAY + BALANCE_POLICE.jail.releaseMinute);
  });

  it('surrender takes 30% off the fine and a day off the jail', () => {
    const s = sentence({ arrests: [0] }, 4, DAY, true);
    expect(s.fine).toBe(Math.round(BALANCE.wanted.fines[3]! * 0.7));
    expect(s.jailDays).toBe(BALANCE.wanted.jailDays[3]! - 1);
  });

  it('only counts arrests from the last 14 in-game days', () => {
    expect(sentence({ arrests: [0] }, 1, 14 * DAY, false).repeat).toBe(false);
    expect(sentence({ arrests: [0] }, 1, 14 * DAY - 1, false).repeat).toBe(true);
  });

  it('the lawyer takes a day off for $1,500 clean, from the bank first', () => {
    const s = sentence({ arrests: [0] }, 4, DAY, false);
    const before = s.jailDays;
    const money = { clean: 600, bank: 1000 };
    expect(hireLawyer(s, money).ok).toBe(true);
    expect(money).toEqual({ clean: 100, bank: 0 });
    expect(s.jailDays).toBe(before - 1);
    expect(hireLawyer(s, { clean: 9999, bank: 9999 }).ok).toBe(false); // once
    const poor = sentence({ arrests: [0] }, 4, DAY, false);
    expect(hireLawyer(poor, { clean: 100, bank: 100 }).ok).toBe(false);
  });

  it('the judge turns jail into a fine for $5,000 dirty, Connected tier only; seizure still happens', () => {
    const rec = { arrests: [0] };
    const s = sentence(rec, 5, DAY, false);
    expect(judgeOffered(s, 2)).toBe(false);
    expect(bribeJudge(s, { dirty: 99999 }, 2).ok).toBe(false);
    expect(judgeOffered(s, 3)).toBe(true);
    const money = { clean: 0, dirty: 6000 };
    expect(bribeJudge(s, money, 3).ok).toBe(true);
    expect(s.jailDays).toBe(0);
    const b = book(s, money, rec, {}, DAY);
    expect(b.seizedCash).toBe(1000);
    expect(b.releaseAt).toBe(DAY + BALANCE_POLICE.jail.firstOffenseMinutes);
  });

  it('jail ends at 06:00 after the jail days', () => {
    expect(releaseAt(2 * DAY + 23 * 60, 1)).toBe(3 * DAY + 6 * 60);
    expect(releaseAt(2 * DAY + 60, 3)).toBe(5 * DAY + 6 * 60);
  });
});
