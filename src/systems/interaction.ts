// Which usable objects the player can reach and which one E would use (docs/11 "Interaction prompts"):
// everything within 1.5 tiles shows the idle gold rim; the targeted one (nearest in the facing direction)
// shows the hover rim and the prompt. Tab cycles through the ones in range.

export interface Candidate {
  id: string;
  x: number;
  y: number;
}

export interface Targeting {
  inRange: string[];
  target: string | null;
}

/** Score: closer is better, and in front of the player is better than behind. Lower wins. */
function score(
  c: Candidate,
  px: number,
  py: number,
  fx: number,
  fy: number,
  range: number,
  facingWeight: number,
): number {
  const dx = c.x - px;
  const dy = c.y - py;
  const d = Math.hypot(dx, dy);
  const facing = d > 0 ? (dx * fx + dy * fy) / d : 1; // 1 = straight ahead, -1 = behind
  return d / range - facingWeight * facing;
}

/**
 * Candidates in range, sorted best first, and the target. `cycle` (from Tab presses) picks the n-th best
 * instead of the best, wrapping around.
 */
export function selectTarget(
  candidates: readonly Candidate[],
  px: number,
  py: number,
  facing: { x: number; y: number },
  range: number,
  facingWeight: number,
  cycle = 0,
): Targeting {
  const near = candidates
    .filter((c) => Math.hypot(c.x - px, c.y - py) <= range)
    .map((c) => ({ c, s: score(c, px, py, facing.x, facing.y, range, facingWeight) }))
    .sort((a, b) => a.s - b.s)
    .map((e) => e.c.id);
  if (near.length === 0) return { inRange: [], target: null };
  return { inRange: near, target: near[((cycle % near.length) + near.length) % near.length] as string };
}
