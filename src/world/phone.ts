// The phone (docs/11: "the main hub for the systems"), the ATM and the bag, as list pages (ui/listPanel.ts).
// Phase 2 first pass: messages, bank (balance, rent, statement), the job board, and contacts (HR bribes, the
// landlord, Dez, Marlo). Map, crew and properties arrive with their systems. Actions change the game state
// directly; the pages are rebuilt after each one, so balances stay current.

import { BALANCE } from '../config/balance';
import type { GameState } from '../core/store';
import { JOBS, type JobId } from '../data/jobs';
import { coverShift, coverable, frozen, rankTitle, xpNeeded } from '../systems/career';
import { calendar, formatClock } from '../systems/clock';
import { debit, deposit, moveBackIn, moveInCost, payOwed, withdraw } from '../systems/finance';
import { useFirstAid, type Wallet } from '../systems/shop';
import type { ListPage, ListRow } from '../ui/listPanel';

export interface PhoneCtx {
  state: GameState;
  /** Wallet view (health lives on the player). */
  wallet: Wallet;
}

/** Senders whose messages are kept in the phone (people and services, not prompts like CAR or LOCKPICK). */
export const PHONE_SENDERS = new Set([
  'MS. HOLLIS',
  'DEZ',
  'MARLO',
  'LANDLORD',
  'BANK',
  'HR',
  'PAYROLL',
  'SHELTER',
]);

/** Split text into lines of at most `max` characters, at spaces. */
export function wrap(textIn: string, max: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of textIn.split(' ')) {
    if (line && line.length + 1 + word.length > max) {
      out.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(line);
  return out;
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const when = (at: number) => {
  const c = calendar(at);
  return `${c.weekday} ${formatClock(c.minute)}`;
};

// ---------------------------------------------------------------- phone

export function phoneRoot(ctx: PhoneCtx): ListPage {
  const st = ctx.state;
  const c = calendar(st.minutes);
  const rentNote = st.finance.rent.evicted ? 'EVICTED' : st.finance.rent.owed > 0 ? 'RENT LATE' : '';
  return {
    title: 'PHONE',
    right: `DAY ${c.day} ${formatClock(c.minute)}`,
    rows: [
      {
        label: 'MESSAGES',
        detail: st.messages.length ? String(st.messages.length) : '',
        act: () => ({ open: () => messagesPage(ctx) }),
      },
      { label: 'BANK', detail: rentNote || money(st.money.bank), act: () => ({ open: () => bankPage(ctx) }) },
      {
        label: 'JOB BOARD',
        detail: JOBS[st.career.current].short,
        act: () => ({ open: () => jobsPage(ctx) }),
      },
      { label: 'CONTACTS', act: () => ({ open: () => contactsPage(ctx) }) },
    ],
  };
}

function messagesPage(ctx: PhoneCtx): ListPage {
  const rows: ListRow[] = ctx.state.messages.map((m) => ({
    label: m.who,
    detail: when(m.at),
    act: () => ({
      open: () => ({ title: m.who, right: when(m.at), lines: wrap(m.text, 38), rows: [] }),
    }),
  }));
  return {
    title: 'MESSAGES',
    lines: rows.length ? undefined : ['NO MESSAGES YET.'],
    rows,
  };
}

export function bankPage(ctx: PhoneCtx): ListPage {
  const st = ctx.state;
  const r = st.finance.rent;
  const lines = [`BANK ${money(st.money.bank)}`, `CARRIED ${money(st.money.clean)} CLEAN`];
  if (r.evicted) lines.push('EVICTED FROM DRIZZLE ROW 4B');
  else if (r.owed > 0) lines.push(`RENT OWED ${money(r.owed)}`);
  else lines.push(`RENT ${money(BALANCE.rent.weekly)} DUE MON 06:00`);
  const rows: ListRow[] = [];
  if (!r.evicted && r.owed > 0)
    rows.push({
      label: 'PAY RENT NOW',
      detail: money(r.owed),
      enabled: st.money.bank >= r.owed,
      act: () => ({
        say: payOwed(st.money, st.finance, st.minutes) ? 'RENT PAID.' : 'NOT ENOUGH IN THE BANK.',
      }),
    });
  if (r.evicted)
    rows.push({
      label: 'MOVE BACK IN',
      detail: money(moveInCost(st.finance)),
      enabled: st.money.bank >= moveInCost(st.finance),
      act: () => ({
        say: moveBackIn(st.money, st.finance, st.minutes)
          ? 'WELCOME BACK. YOUR KEY WORKS AGAIN.'
          : 'NOT ENOUGH IN THE BANK.',
      }),
    });
  rows.push({ label: 'STATEMENT', act: () => ({ open: () => statementPage(ctx) }) });
  return { title: 'BANK', right: 'GREYHAVEN SAVINGS', lines, rows };
}

function statementPage(ctx: PhoneCtx): ListPage {
  const rows: ListRow[] = ctx.state.finance.ledger.map((e) => ({
    label: e.text,
    detail: `${e.amount >= 0 ? '+' : '-'}${money(Math.abs(e.amount))}`,
  }));
  return {
    title: 'STATEMENT',
    lines: rows.length ? undefined : ['NOTHING YET. PAY GOES TO THE BANK.'],
    rows,
  };
}

export function jobsPage(ctx: PhoneCtx): ListPage {
  const st = ctx.state;
  const c = st.career;
  const job = c.jobs[c.current];
  const lines = [`${JOBS[c.current].name}: ${rankTitle(c)}`];
  lines.push(job.rank < 5 ? `XP ${job.xp} / ${xpNeeded(c, job.rank, st.minutes)}` : 'TOP RANK');
  if (frozen(c, st.minutes)) lines.push(`PROMOTION FROZEN UNTIL ${when(c.freezeUntil)}`);
  else if (st.minutes < c.extraUntil) lines.push(`EXTRA WORK UNTIL ${when(c.extraUntil)}`);
  const rows: ListRow[] = (Object.keys(JOBS) as JobId[]).map((id) => {
    const def = JOBS[id];
    const open = def.hiring;
    const mine = id === c.current;
    return {
      label: def.name,
      detail: mine ? 'YOUR JOB' : open ? `RANK ${c.jobs[id].rank}` : 'NOT HIRING YET',
      enabled: open && !mine,
      act: () => {
        if (c.shift) return { say: 'FINISH YOUR SHIFT FIRST.' };
        c.current = id;
        return { say: `YOU NOW WORK AS ${def.ranks[c.jobs[id].rank - 1]}.` };
      },
    };
  });
  return { title: 'JOB BOARD', lines, rows };
}

export function contactsPage(ctx: PhoneCtx): ListPage {
  const st = ctx.state;
  const c = st.career;
  const C = BALANCE.careers;
  const today = calendar(st.minutes).day;
  const missed = coverable(c, today).length;
  const say = (text: string) => () => ({ say: text });
  const bribe = (amount: number, what: string, run: () => boolean) => () => {
    if (st.money.bank < amount) return { say: `HR WANTS ${money(amount)} FROM THE BANK.` };
    if (!run()) return { say: 'NOTHING TO COVER.' };
    debit(st.money, st.finance, st.minutes, what, amount);
    return { say: 'HR: CONSIDER IT HANDLED.' };
  };
  const rows: ListRow[] = [
    {
      label: 'HR: COVER A MISSED SHIFT',
      detail: missed ? `${money(C.hrCoverShift)} (${missed})` : 'NONE',
      enabled: missed > 0,
      act: bribe(C.hrCoverShift, 'HR, COVERED SHIFT', () => coverShift(c, today)),
    },
    {
      label: 'HR: LIFT THE FREEZE',
      detail: frozen(c, st.minutes) ? money(C.hrLiftFreeze) : 'NONE',
      enabled: frozen(c, st.minutes),
      act: bribe(C.hrLiftFreeze, 'HR, FREEZE LIFTED', () => {
        if (!frozen(c, st.minutes)) return false;
        c.freezeUntil = 0;
        return true;
      }),
    },
    {
      label: 'LANDLORD',
      act: say(
        st.finance.rent.evicted
          ? `MOVE BACK IN FOR ${money(moveInCost(st.finance))}. BANK APP.`
          : `RENT ${money(BALANCE.rent.weekly)}, MONDAYS 06:00, FROM YOUR BANK.`,
      ),
    },
    {
      label: 'DEZ',
      act: say(`BACK ROOM OF THE LOW TIDE, 18:00-02:00. ${Math.round(BALANCE.laundering.cut * 100)}% CUT.`),
    },
    { label: 'MARLO', act: say('PARK IN MY DOTTED SPOT AND PRESS E. NO QUESTIONS.') },
  ];
  return { title: 'CONTACTS', rows };
}

// ---------------------------------------------------------------- ATM

export function atmPage(ctx: PhoneCtx): ListPage {
  const st = ctx.state;
  const m = st.money;
  const out = (n: number): ListRow => ({
    label: `WITHDRAW ${money(n)}`,
    enabled: m.bank >= n,
    act: () => ({
      say: withdraw(m, st.finance, st.minutes, n) ? `TOOK OUT ${money(n)}.` : 'NOT ENOUGH IN THE BANK.',
    }),
  });
  return {
    title: 'ATM',
    right: 'GREYHAVEN SAVINGS',
    lines: [`BANK ${money(m.bank)}`, `CARRIED ${money(m.clean)} CLEAN`, "DIRTY CASH CAN'T GO IN THE BANK."],
    rows: [
      ...BALANCE.economy.atmSteps.map(out),
      {
        label: 'DEPOSIT ALL CLEAN CASH',
        detail: money(m.clean),
        enabled: m.clean > 0,
        act: () => {
          const n = deposit(m, st.finance, st.minutes, m.clean);
          return { say: n ? `PAID IN ${money(n)}.` : 'NO CLEAN CASH ON YOU.' };
        },
      },
    ],
  };
}

// ---------------------------------------------------------------- bag

export function bagPage(ctx: PhoneCtx): ListPage {
  const st = ctx.state;
  const inv = st.inventory;
  const rows: ListRow[] = [];
  if (inv.firstAid > 0)
    rows.push({
      label: `FIRST-AID KIT X${inv.firstAid}`,
      detail: 'USE',
      act: () => ({ say: useFirstAid(ctx.wallet).text }),
    });
  if (inv.fuelCans > 0) rows.push({ label: `FUEL CAN X${inv.fuelCans}`, detail: 'AT A CAR' });
  if (inv.repairKits > 0) rows.push({ label: `REPAIR KIT X${inv.repairKits}`, detail: 'AT A CAR' });
  if (inv.lockpicks > 0) rows.push({ label: 'LOCKPICKS', detail: `${inv.lockpicks} USES` });
  if (inv.toolbox > 0) rows.push({ label: 'TOOLBOX', detail: 'HOTWIRE +3S' });
  if (inv.phones > 0) rows.push({ label: `STOLEN PHONE X${inv.phones}`, detail: 'FOR A FENCE' });
  if (inv.watches > 0) rows.push({ label: `WATCH X${inv.watches}`, detail: 'FOR A FENCE' });
  return {
    title: 'BAG',
    right: `${money(st.money.clean)} / ${money(st.money.dirty)}`,
    lines: rows.length ? ['CLEAN / DIRTY CASH ON YOU, TOP RIGHT.'] : ['THE BAG IS EMPTY.'],
    rows,
  };
}
