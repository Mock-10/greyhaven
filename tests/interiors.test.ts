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
import { INTERIORS, interiorForDoor } from '../src/data/interiors';
import { collides } from '../src/systems/movement';
import {
  createDoors,
  doorAccess,
  doorPrompt,
  interiorSolids,
  npcOnDuty,
  useSpots,
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

  it('hides the crime prompts in the store and keeps the shop', () => {
    const j = J.store!;
    const spots = useSpots(j, INTERIORS.store, createDoors(j, INTERIORS.store));
    const labels = spots.flatMap((s) => (s.kind === 'action' ? [s.label] : []));
    expect(labels).toEqual(['SHOP']);
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
