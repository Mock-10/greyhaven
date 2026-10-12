// The fence's masks (docs/04 "Fence": balaclava, bandana, hockey-style; docs/05 masks hide the face from cameras and
// police). Prices are in config/balanceCrime.ts. All three share the one masked player sprite for now (art debt).

export type MaskId = 'balaclava' | 'bandana' | 'hockey';

export interface MaskDef {
  id: MaskId;
  name: string;
}

export const MASKS: readonly MaskDef[] = [
  { id: 'bandana', name: 'BANDANA' },
  { id: 'balaclava', name: 'BALACLAVA' },
  { id: 'hockey', name: 'HOCKEY MASK' },
];

export function maskOf(id: string): MaskDef | undefined {
  return MASKS.find((m) => m.id === id);
}
