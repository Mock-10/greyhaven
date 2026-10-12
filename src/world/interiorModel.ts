// What an interior is in game terms, built from its export (art/interiors/<id>.json) and its definition
// (data/interiors.ts): collision, doors and their rules, NPCs on duty, and the spots E can be used on.
// Pure code (no Phaser), so it can be tested; world/interiorView.ts draws it.

import type { Action, DoorRule, Hours, InteriorDef } from '../data/interiors';
import { isOpen } from '../data/interiors';
import type { Line, Partition } from '../systems/sight';
import type { Solid } from '../systems/movement';

export interface InteriorItem {
  frame: string;
  kind: string;
  x: number;
  y: number;
  wz: number;
  zBias: number;
  ang: number;
  shadow?: { kind: 'box'; hx: number; hy: number; h: number } | { kind: 'blob'; r: number };
  prompt?: string;
  valuable?: boolean;
  door?: { axis: 'x' | 'y'; pos: number; g0: number; g1: number };
}

export interface InteriorJson {
  id: string;
  W: number;
  D: number;
  wallH: number;
  wallT: number;
  partH: number;
  partitions: Partition[];
  stubGaps: [string, number, number][];
  segments: { frame: string; x: number; y: number; axis: 'x' | 'y'; pos: number }[];
  items: InteriorItem[];
  npcs: { costume: string; dir: number; walk: number; x: number; y: number; zBias: number }[];
  frames: Record<string, { x: number; y: number; w: number; h: number; anchor: [number, number] }>;
}

export interface DoorRuntime {
  /** Index into json.items. */
  item: number;
  rule: DoorRule;
  open: boolean;
  /** The gap the leaf fills, as a sight line. */
  line: Line;
}

/** Whether a door can be opened now, and the prompt to show. Locked doors show their label in red. */
export function doorAccess(
  rule: DoorRule,
  ctx: { minuteOfDay: number; keyCard: boolean },
): { usable: boolean; label: string } {
  switch (rule.kind) {
    case 'open':
      return { usable: true, label: '' };
    case 'locked':
      return { usable: false, label: rule.label };
    case 'keycard':
      return ctx.keyCard ? { usable: true, label: '' } : { usable: false, label: 'KEY CARD NEEDED' };
    case 'staffHours':
      return isOpen({ from: rule.from, to: rule.to }, ctx.minuteOfDay)
        ? { usable: true, label: '' }
        : { usable: false, label: rule.closedLabel };
  }
}

/** Doors start closed; plain 'open' doors (no lock at all) start open, like an office door left ajar. */
export function createDoors(json: InteriorJson, def: InteriorDef): DoorRuntime[] {
  const out: DoorRuntime[] = [];
  let k = 0;
  json.items.forEach((it, i) => {
    if (!it.door) return;
    const rule = def.doors[k++] ?? { kind: 'open' };
    out.push({
      item: i,
      rule,
      open: rule.kind === 'open',
      line: { axis: it.door.axis, pos: it.door.pos, a0: it.door.g0, a1: it.door.g1 },
    });
  });
  return out;
}

export function npcOnDuty(hours: Hours | null, minuteOfDay: number): boolean {
  return hours !== null && isOpen(hours, minuteOfDay);
}

/** Box for a wall piece along `axis` at `pos` from a0 to a1, `t` thick. */
function wallBox(axis: 'x' | 'y', pos: number, a0: number, a1: number, t: number): Solid {
  const c = (a0 + a1) / 2;
  const half = (a1 - a0) / 2;
  return axis === 'x'
    ? { kind: 'box', x: c, y: pos, hx: half, hy: t / 2, r: 0 }
    : { kind: 'box', x: pos, y: c, hx: t / 2, hy: half, r: 0 };
}

/**
 * Collision for the room: partition walls minus their gaps, closed doors, furniture footprints and the NPCs
 * on duty. The room's outer walls are its bounds (CollisionRules.mapW / mapH = W / D).
 */
export function interiorSolids(
  json: InteriorJson,
  doors: readonly DoorRuntime[],
  npcsPresent: readonly boolean[],
  npcRadius: number,
): Solid[] {
  const out: Solid[] = [];
  for (const p of json.partitions) {
    let cur = p.a0;
    for (const [g0, g1] of [...p.gaps].sort((a, b) => a[0] - b[0])) {
      if (g0 > cur) out.push(wallBox(p.axis, p.pos, cur, g0, json.wallT));
      cur = Math.max(cur, g1);
    }
    if (cur < p.a1) out.push(wallBox(p.axis, p.pos, cur, p.a1, json.wallT));
  }
  for (const d of doors)
    if (!d.open) out.push(wallBox(d.line.axis, d.line.pos, d.line.a0, d.line.a1, json.wallT));
  for (const it of json.items) {
    if (!it.shadow || it.wz > 0 || it.door) continue;
    if (it.shadow.kind === 'box')
      out.push({ kind: 'box', x: it.x, y: it.y, hx: it.shadow.hx, hy: it.shadow.hy, r: 0 });
    else
      out.push({ kind: 'circle', x: it.x, y: it.y, hx: 0, hy: 0, r: it.shadow.r, small: it.shadow.r <= 6 });
  }
  json.npcs.forEach((n, i) => {
    if (npcsPresent[i]) out.push({ kind: 'circle', x: n.x, y: n.y, hx: 0, hy: 0, r: npcRadius });
  });
  return out;
}

/** Something E can be used on inside: an object with an action, a door leaf, or the way out. */
export type UseSpot =
  | { id: string; kind: 'action'; x: number; y: number; item: number; label: string; action: Action }
  | { id: string; kind: 'door'; x: number; y: number; door: number }
  | { id: string; kind: 'exit'; x: number; y: number };

export function useSpots(json: InteriorJson, def: InteriorDef, doors: readonly DoorRuntime[]): UseSpot[] {
  const out: UseSpot[] = [];
  json.items.forEach((it, i) => {
    if (it.door || !it.prompt) return;
    const a = def.actions[it.prompt];
    if (!a) return;
    out.push({
      id: `${json.id}:${i}`,
      kind: 'action',
      x: it.x,
      y: it.y,
      item: i,
      label: a.label,
      action: a.action,
    });
    (def.extra?.[it.prompt] ?? []).forEach((e, k) =>
      out.push({
        id: `${json.id}:${i}:${k}`,
        kind: 'action',
        x: it.x,
        y: it.y,
        item: i,
        label: e.label,
        action: e.action,
      }),
    );
  });
  doors.forEach((d, k) => {
    const it = json.items[d.item] as InteriorItem;
    out.push({ id: `${json.id}:door${k}`, kind: 'door', x: it.x, y: it.y, door: k });
  });
  if (def.entrance) out.push({ id: `${json.id}:exit`, kind: 'exit', x: def.entrance.x, y: def.entrance.y });
  return out;
}

/** The prompt for a door leaf right now. */
export function doorPrompt(
  d: DoorRuntime,
  ctx: { minuteOfDay: number; keyCard: boolean },
): {
  label: string;
  blocked: boolean;
} {
  if (d.open) return { label: 'CLOSE DOOR', blocked: false };
  const a = doorAccess(d.rule, ctx);
  return a.usable ? { label: 'OPEN DOOR', blocked: false } : { label: a.label, blocked: true };
}
