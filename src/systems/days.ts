// The calendar's fixed moments (docs/00 daily and weekly loops), run for every stretch of in-game time that
// passes, including sleep and jail skips: Monday 06:00 rent and the clean-record bonus, daily late fees and
// eviction, the 10:00 close of clock-in (missed shifts), and the Sunday evening rent reminder.
// Pure: it changes the state it's given and returns the phone messages to show.

import { BALANCE } from '../config/balance';
import { checkMissed, closeWeek, type CareerState } from './career';
import { MINUTES_PER_DAY } from './clock';
import { credit, rentDaily, rentDue, type Finance, type Money, type RentEvent } from './finance';

export interface DayMessage {
  who: string;
  text: string;
}

export interface CalendarState {
  money: Money;
  finance: Finance;
  career: CareerState;
}

/** Minute of the day for the Sunday rent reminder. */
const REMINDER_MINUTE = 20 * 60;

function rentText(e: RentEvent): DayMessage {
  const R = BALANCE.rent;
  switch (e.kind) {
    case 'paid':
      return { who: 'BANK', text: e.amount > 0 ? `RENT PAID: $${e.amount}.` : 'LATE RENT PAID. ALL SQUARE.' };
    case 'missed':
      return { who: 'LANDLORD', text: `RENT IS LATE: $${e.owed} OWED. +$${R.lateFeePerDay} A DAY.` };
    case 'late':
      return { who: 'LANDLORD', text: `YOU OWE $${e.owed}. EVICTION IN ${e.daysLeft} DAYS.` };
    case 'evicted':
      return { who: 'LANDLORD', text: "EVICTED. YOUR THINGS ARE IN CITY STORAGE. TRY ST. BRINE'S SHELTER." };
  }
}

/** 06:00 every day; on Mondays rent falls due and the week closes first. */
function morning(st: CalendarState, at: number, monday: boolean, out: DayMessage[]): void {
  if (monday) {
    const bonus = closeWeek(st.career);
    if (bonus > 0) {
      credit(st.money, st.finance, at, 'CLEAN-RECORD BONUS', bonus);
      out.push({ who: 'PAYROLL', text: `CLEAN-RECORD BONUS: +$${bonus} TO THE BANK.` });
    }
    const due = rentDue(st.money, st.finance, at);
    const daily = rentDaily(st.money, st.finance, at, true);
    const e = daily ?? due;
    if (e) out.push(rentText(e));
    return;
  }
  const e = rentDaily(st.money, st.finance, at, false);
  if (e) out.push(rentText(e));
}

/** Run every fixed moment in (from, to]. */
export function runCalendar(st: CalendarState, from: number, to: number): DayMessage[] {
  const out: DayMessage[] = [];
  if (!(to > from)) return out;
  const R = BALANCE.rent;
  const C = BALANCE.careers;
  const first = Math.floor(from / MINUTES_PER_DAY);
  const last = Math.floor(to / MINUTES_PER_DAY);
  const inside = (t: number) => t > from && t <= to;
  for (let d = first; d <= last; d++) {
    const base = d * MINUTES_PER_DAY;
    const weekday = d % 7;
    const moments: [number, () => void][] = [
      [base + R.dueMinute, () => morning(st, base + R.dueMinute, weekday === R.dueWeekday, out)],
      [
        base + C.clockInUntil,
        () => {
          if (checkMissed(st.career, d + 1))
            out.push({
              who: 'HR',
              text: `MISSED SHIFT: -${C.missedXp} XP. HR CAN COVER IT FOR $${C.hrCoverShift} (PHONE).`,
            });
        },
      ],
      [
        base + REMINDER_MINUTE,
        () => {
          if (weekday === (R.dueWeekday + 6) % 7 && !st.finance.rent.evicted) {
            const due = R.weekly + st.finance.rent.owed;
            out.push({ who: 'LANDLORD', text: `RENT $${due} DUE MONDAY 06:00. BANK HAS $${st.money.bank}.` });
          }
        },
      ],
    ];
    moments.sort((a, b) => a[0] - b[0]);
    for (const [t, run] of moments) if (inside(t)) run();
  }
  return out;
}
