// Number formatting for the HUD.

/** Whole dollars with thousands separators, as in the mockups ($1,240). */
export function money(n: number): string {
  return Math.floor(n).toLocaleString('en-US');
}
