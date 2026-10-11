// Road routing for the police cruiser (milestone 4): the roads as a graph joined at their crossings, and the
// shortest route between two points on them. Built from the traffic lanes (one per road is enough). Pure code.

import { makePath, nearestOn, pointAt, type Path } from './paths';

interface RoadLine {
  road: string;
  path: Path;
  /** Distances along the line of its crossings: crossing index and s. */
  nodes: { key: string; s: number }[];
}

export interface RoadGraph {
  lines: RoadLine[];
}

export function buildRoads(
  lanes: readonly { road: string; p: [number, number][] }[],
  crossings: readonly { x: number; y: number }[],
): RoadGraph {
  const seen = new Set<string>();
  const lines: RoadLine[] = [];
  for (const l of lanes) {
    if (seen.has(l.road)) continue;
    seen.add(l.road);
    const path = makePath(l.p);
    const nodes = crossings
      .map((c, k) => ({ key: `c${k}`, n: nearestOn(path, c.x, c.y) }))
      .filter((q) => q.n.d < 48)
      .map((q) => ({ key: q.key, s: q.n.s }));
    nodes.push({ key: `${l.road}:a`, s: 0 }, { key: `${l.road}:b`, s: path.len });
    nodes.sort((a, b) => a.s - b.s);
    lines.push({ road: l.road, path, nodes });
  }
  return { lines };
}

/** The nearest point on any road. */
export function onRoad(g: RoadGraph, x: number, y: number): { line: number; s: number; d: number } {
  let best = { line: 0, s: 0, d: Infinity };
  g.lines.forEach((l, i) => {
    const n = nearestOn(l.path, x, y);
    if (n.d < best.d) best = { line: i, s: n.s, d: n.d };
  });
  return best;
}

function sample(l: RoadLine, s0: number, s1: number, step: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const n = Math.max(1, Math.ceil(Math.abs(s1 - s0) / step));
  for (let k = 1; k <= n; k++) {
    const p = pointAt(l.path, s0 + ((s1 - s0) * k) / n);
    out.push({ x: p.x, y: p.y });
  }
  return out;
}

/**
 * The shortest route along the roads from one point to another, as waypoints every `step` units, ending at the
 * road point nearest the destination.
 */
export function route(
  g: RoadGraph,
  from: { x: number; y: number },
  to: { x: number; y: number },
  step = 24,
): { x: number; y: number }[] {
  const a = onRoad(g, from.x, from.y);
  const b = onRoad(g, to.x, to.y);
  if (a.line === b.line) return sample(g.lines[a.line] as RoadLine, a.s, b.s, step);
  // Dijkstra over crossing nodes; edges run along each line between neighbouring nodes
  type Edge = { to: string; line: number; s0: number; s1: number };
  const adj = new Map<string, Edge[]>();
  const add = (k: string, e: Edge) => adj.set(k, [...(adj.get(k) ?? []), e]);
  g.lines.forEach((l, i) => {
    for (let k = 1; k < l.nodes.length; k++) {
      const p = l.nodes[k - 1] as { key: string; s: number };
      const q = l.nodes[k] as { key: string; s: number };
      add(p.key, { to: q.key, line: i, s0: p.s, s1: q.s });
      add(q.key, { to: p.key, line: i, s0: q.s, s1: p.s });
    }
  });
  // the start joins its line's neighbouring nodes, the goal likewise
  const la = g.lines[a.line] as RoadLine;
  const lb = g.lines[b.line] as RoadLine;
  for (const n of la.nodes) add('START', { to: n.key, line: a.line, s0: a.s, s1: n.s });
  for (const n of lb.nodes) add(n.key, { to: 'GOAL', line: b.line, s0: n.s, s1: b.s });
  const dist = new Map<string, number>([['START', 0]]);
  const prev = new Map<string, { from: string; e: Edge }>();
  const open = new Set<string>(['START']);
  while (open.size) {
    let u = '';
    let best = Infinity;
    for (const k of open)
      if ((dist.get(k) ?? Infinity) < best) {
        best = dist.get(k) as number;
        u = k;
      }
    open.delete(u);
    if (u === 'GOAL') break;
    for (const e of adj.get(u) ?? []) {
      const d = best + Math.abs(e.s1 - e.s0) + 1;
      if (d < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, d);
        prev.set(e.to, { from: u, e });
        open.add(e.to);
      }
    }
  }
  const edges: Edge[] = [];
  for (let k = 'GOAL'; prev.has(k); k = (prev.get(k) as { from: string }).from) edges.unshift(prev.get(k)!.e);
  const out: { x: number; y: number }[] = [];
  for (const e of edges) out.push(...sample(g.lines[e.line] as RoadLine, e.s0, e.s1, step));
  return out;
}
