import { describe, expect, it } from 'vitest';
import apartment from '../art/interiors/apartment.json';
import bar from '../art/interiors/bar.json';
import clothing from '../art/interiors/clothing.json';
import dealer from '../art/interiors/dealer.json';
import depot from '../art/interiors/depot.json';
import garage from '../art/interiors/garage.json';
import hardware from '../art/interiors/hardware.json';
import office from '../art/interiors/office_floor.json';
import trailer from '../art/interiors/site_trailer.json';
import store from '../art/interiors/store.json';
import lobby from '../art/interiors/tower_lobby.json';
import bungalow from '../art/interiors/house_bungalow.json';
import family from '../art/interiors/house_family.json';
import townhouse from '../art/interiors/house_townhouse.json';
import pawn from '../art/interiors/pawn.json';
import precinct from '../art/interiors/precinct.json';
import homeSmall from '../art/interiors/home_small.json';
import homeFamily from '../art/interiors/home_family.json';
import hideout from '../art/interiors/hideout.json';
import { LAYOUTS } from '../src/data/burglary';
import { INTERIORS, interiorForDoor } from '../src/data/interiors';
import { collides } from '../src/systems/movement';
import {
  createDoors,
  doorAccess,
  doorPrompt,
  interiorSolids,
  npcOnDuty,
  useSpots,
  withAddons,
  type InteriorJson,
} from '../src/world/interiorModel';

const J = {
  apartment,
  bar,
  office_floor: office,
  store,
  tower_lobby: lobby,
  hardware,
  clothing,
  dealer,
  garage,
  depot,
  site_trailer: trailer,
  house_bungalow: bungalow,
  house_family: family,
  house_townhouse: townhouse,
  pawn,
  precinct,
  home_small: homeSmall,
  home_family: homeFamily,
  hideout,
} as unknown as Record<string, InteriorJson>;
const rules = (j: InteriorJson) => ({ radius: 6, mapW: j.W, mapH: j.D, smallScale: 0.6, smallSlack: 2 });

describe('interiors in the game', () => {
  it('every street door with an interior lands on open floor', () => {
    for (const def of Object.values(INTERIORS)) {
      const j = J[def.id]!;
      const doors = createDoors(j, def);
      const solids = interiorSolids(
        j,
        doors,
        j.npcs.map(() => true),
        6,
      );
      if (def.entrance)
        expect(collides(def.entrance.x, def.entrance.y, solids, rules(j)), def.id).toBe(false);
      if (def.elevator)
        expect(collides(def.elevator.x, def.elevator.y, solids, rules(j)), `${def.id} lift`).toBe(false);
    }
    expect(interiorForDoor('chop_shop')).toBeNull();
  });

  it('homes you own: sleep, wardrobe, stash and the basement; the hideout filters its stations (Phase 5)', () => {
    for (const id of ['home_small', 'home_family'] as const) {
      const kinds = useSpots(J[id]!, INTERIORS[id], []).map((u) =>
        u.kind === 'action' ? u.action.kind : u.kind,
      );
      expect(kinds.sort(), id).toEqual(['basement', 'exit', 'sleep', 'stash', 'wardrobe']);
    }
    const bare = withAddons(J.hideout!, []);
    const full = withAddons(J.hideout!, ['stashRoom', 'workbench']);
    const acts = (j: InteriorJson) =>
      useSpots(j, INTERIORS.hideout, []).flatMap((u) => (u.kind === 'action' ? [u.action.kind] : []));
    expect(acts(bare).sort()).toEqual(['plans', 'upstairs']);
    expect(acts(full).sort()).toEqual(['plans', 'stash', 'upstairs', 'workbench']);
    expect(withAddons(J.apartment!, [])).toBe(J.apartment);
  });

  it('burglary houses: a search per room in data/burglary.ts order, the keypad, one owner (Phase 3)', () => {
    for (const layout of ['bungalow', 'family', 'townhouse'] as const) {
      const id = `house_${layout}` as const;
      const spots = useSpots(J[id]!, INTERIORS[id], createDoors(J[id]!, INTERIORS[id]));
      const rooms = spots.flatMap((u) =>
        u.kind === 'action' && u.action.kind === 'burgle' ? [u.action.room] : [],
      );
      expect(rooms.sort(), id).toEqual(LAYOUTS[layout].rooms.map((_, k) => k));
      expect(
        spots.some((u) => u.kind === 'action' && u.action.kind === 'housePanel'),
        id,
      ).toBe(true);
      expect(J[id]!.npcs.length, id).toBe(1);
    }
  });

  it('applies the door rules: locked, key card, staff hours', () => {
    expect(
      doorAccess({ kind: 'locked', label: 'STAFF ONLY' }, { minuteOfDay: 600, keyCard: true }).usable,
    ).toBe(false);
    expect(doorAccess({ kind: 'keycard', minRank: 2 }, { minuteOfDay: 600, keyCard: false })).toEqual({
      usable: false,
      label: 'KEY CARD NEEDED',
    });
    const dez = { kind: 'staffHours', from: 18 * 60, to: 2 * 60, closedLabel: 'STAFF ONLY' } as const;
    expect(doorAccess(dez, { minuteOfDay: 17 * 60, keyCard: false }).usable).toBe(false);
    expect(doorAccess(dez, { minuteOfDay: 23 * 60, keyCard: false }).usable).toBe(true);
    expect(doorAccess(dez, { minuteOfDay: 60, keyCard: false }).usable).toBe(true);
  });

  it("closes Dez's door until he's in, and a closed door blocks the gap", () => {
    const j = J.bar!;
    const doors = createDoors(j, INTERIORS.bar);
    expect(doors).toHaveLength(1);
    expect(doors[0]!.open).toBe(false);
    expect(doorPrompt(doors[0]!, { minuteOfDay: 17 * 60, keyCard: false })).toEqual({
      label: 'STAFF ONLY',
      blocked: true,
    });
    const d = doors[0]!;
    const mid = (d.line.a0 + d.line.a1) / 2;
    const at = d.line.axis === 'x' ? { x: mid, y: d.line.pos } : { x: d.line.pos, y: mid };
    const none = j.npcs.map(() => false);
    expect(collides(at.x, at.y, interiorSolids(j, doors, none, 6), rules(j))).toBe(true);
    d.open = true;
    expect(collides(at.x, at.y, interiorSolids(j, doors, none, 6), rules(j))).toBe(false);
  });

  it('offers the office tasks, clock-in, the elevator and no exit on floor 4', () => {
    const j = J.office_floor!;
    const spots = useSpots(j, INTERIORS.office_floor, createDoors(j, INTERIORS.office_floor));
    const labels = spots.flatMap((s) => (s.kind === 'action' ? [s.label] : []));
    expect(labels).toContain('CLOCK IN');
    expect(labels).toContain('FILE PAPERWORK');
    expect(labels).toContain('DATA ENTRY');
    expect(labels).toContain('ELEVATOR DOWN');
    expect(spots.some((s) => s.kind === 'exit')).toBe(false);
  });

  it('the store: the shop and the robbery at the till, the safe, the CCTV desk and the DVR (Phase 3)', () => {
    const j = J.store!;
    const spots = useSpots(j, INTERIORS.store, createDoors(j, INTERIORS.store));
    const labels = spots.flatMap((s) => (s.kind === 'action' ? [s.label] : []));
    expect(labels.sort()).toEqual([
      'CRACK SAFE',
      'DISABLE CAMERAS',
      'ROB THE REGISTER',
      'SHOP',
      'WIPE FOOTAGE',
    ]);
    // the robbery shares the till's spot
    const at = (l: string) => spots.find((s) => s.kind === 'action' && s.label === l);
    expect(at('ROB THE REGISTER')?.x).toBe(at('SHOP')?.x);
  });

  it('opens the Hedgerow Way shops: hardware stock, clothes, fitting booth, the car desk', () => {
    const labels = (id: 'hardware' | 'clothing' | 'dealer') =>
      useSpots(J[id]!, INTERIORS[id], createDoors(J[id]!, INTERIORS[id]))
        .filter((u) => u.kind === 'action')
        .map((u) => (u.kind === 'action' ? u.action.kind : ''));
    expect(labels('hardware')).toEqual(['shop']);
    expect(labels('clothing').sort()).toEqual(['clothes', 'wardrobe']);
    expect(labels('dealer')).toEqual(['dealer']);
    expect(INTERIORS.hardware.actions.SHOP?.action).toEqual({ kind: 'shop', shop: 'hardware' });
    expect(INTERIORS.apartment.actions['CHANGE OUTFIT']?.action).toEqual({ kind: 'wardrobe' });
    for (const id of ['hardware', 'clothing', 'dealer'] as const) {
      expect(INTERIORS[id].doors.length, id).toBe(J[id]!.items.filter((i) => i.door).length);
      expect(INTERIORS[id].npcs.length, id).toBe(J[id]!.npcs.length);
    }
  });

  it('puts NPCs on duty by the clock', () => {
    expect(npcOnDuty({ from: 18 * 60, to: 2 * 60 }, 19 * 60)).toBe(true);
    expect(npcOnDuty({ from: 18 * 60, to: 2 * 60 }, 12 * 60)).toBe(false);
    expect(npcOnDuty(null, 12 * 60)).toBe(false);
  });
});
