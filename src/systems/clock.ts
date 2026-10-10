// The in-game clock (docs/01). Time is stored as in-game minutes since 00:00 of day 1, so everything
// measured in in-game time scales with the day-length setting automatically.

import { BALANCE } from '../config/balance';

export const MINUTES_PER_DAY = 24 * 60;
const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

/** In-game minutes that pass per real second for a day length (in real minutes). */
export function gameMinutesPerSecond(dayLengthMinutes: number): number {
  return MINUTES_PER_DAY / (dayLengthMinutes * 60);
}

export function advance(totalMinutes: number, realSeconds: number, dayLengthMinutes: number): number {
  return totalMinutes + realSeconds * gameMinutesPerSecond(dayLengthMinutes);
}

/** Day number (1-based), minute of the day and the weekday name. */
export function calendar(totalMinutes: number): { day: number; minute: number; weekday: string } {
  const day = Math.floor(totalMinutes / MINUTES_PER_DAY) + 1;
  const minute = totalMinutes - (day - 1) * MINUTES_PER_DAY;
  return { day, minute, weekday: WEEKDAYS[(day - 1) % 7] as string };
}

export function formatClock(minuteOfDay: number): string {
  const m = Math.floor(minuteOfDay) % MINUTES_PER_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export type Phase = 'morning' | 'day' | 'evening' | 'night';

/** docs/01: morning 06–10, day 10–18, evening 18–22, night 22–06. */
export function phaseOf(minuteOfDay: number): Phase {
  const h = minuteOfDay / 60;
  if (h >= 6 && h < 10) return 'morning';
  if (h >= 10 && h < 18) return 'day';
  if (h >= 18 && h < 22) return 'evening';
  return 'night';
}

/** 0 at full daylight, 1 at full night, smooth in between (dawn and dusk ramps from balance). */
export function darkness(minuteOfDay: number): number {
  const c = BALANCE.clock;
  const m = ((minuteOfDay % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const smooth = (t: number) => t * t * (3 - 2 * t);
  if (m >= c.dawnEnd && m < c.duskStart) return 0;
  if (m >= c.duskStart && m < c.duskEnd) return smooth((m - c.duskStart) / (c.duskEnd - c.duskStart));
  if (m >= c.dawnStart && m < c.dawnEnd) return 1 - smooth((m - c.dawnStart) / (c.dawnEnd - c.dawnStart));
  return 1;
}

/** The tint to multiply a sprite by at a given darkness: a mix of white and the full-night tint. */
export function tintAt(d: number, night: readonly number[]): number {
  const ch = (k: number) => Math.round(255 * (1 - d + d * (night[k] as number)));
  return (ch(0) << 16) | (ch(1) << 8) | ch(2);
}
