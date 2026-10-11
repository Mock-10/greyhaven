// Ground material table for tests, read straight from art/ground.json (no Phaser needed).
import groundJson from '../art/ground.json';
import type { GroundMaterial } from '../src/iso/vectorGround';

export function groundMaterials(): (GroundMaterial | undefined)[] {
  const ramps = groundJson.ramps as Record<string, number[][]>;
  const out: (GroundMaterial | undefined)[] = [];
  for (const m of groundJson.materials)
    out[m.id] = {
      name: m.name,
      id: m.id,
      height: m.height,
      side: ramps[m.side]!,
      left: m.left,
      right: m.right,
    };
  return out;
}

export function materialIdOf(name: string): number {
  const m = groundJson.materials.find((x) => x.name === name);
  if (!m) throw new Error(name);
  return m.id;
}
