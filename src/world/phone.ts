// The phone (docs/11: "the main hub for the systems"), the ATM and the bag, as list pages (ui/listPanel.ts).
// Phase 2 first pass: messages, bank (balance, rent, statement), the job board, and contacts (HR bribes, the
// landlord, Dez, Marlo). UI redesign (2026-10-12): every page shows pictures (apps, portraits, items); the phone's
// home screen and the bag are grids of picture tiles. Map, crew and properties arrive with their systems. Actions change the game state
// directly; the pages are rebuilt after each one, so balances stay current.

import { BALANCE } from '../config/balance';
import type { GameState } from '../core/store';
import { JOBS, type JobId } from '../data/jobs';
import { GIGS, GIG_IDS, type GigId } from '../data/oddJobs';
import { BALANCE_ODD } from '../config/balanceOdd';
import { coverShift, coverable, frozen, rankTitle, xpNeeded } from '../systems/career';
import { calendar, formatClock } from '../systems/clock';
import { canStartGig } from '../systems/oddJobs';
import { onboardEvent } from '../systems/onboarding';
import { bribeOnScene, onScenePrice } from '../systems/jail';
import { tierFor, tierProgress } from '../systems/reputation';
import type { ChaseState } from '../systems/response';
import { CONTACTS, TIER_NAMES, type ContactId } from '../data/reputation';
import { debit, deposit, moveBackIn, moveInCost, payOwed, withdraw } from '../systems/finance';
import { useFirstAid, type Wallet } from '../systems/shop';
import { SENDER_ICON } from '../data/senders';
import { wrapPx } from '../ui/hudDraw';
import type { IconName } from '../ui/icons';
import type { ListPage, ListRow } from '../ui/listPanel';

export interface PhoneCtx {
  state: GameState;
  /** Wallet view (health lives on the player). */
  wallet: Wallet;
  /** This chase's once-only moves (the on-scene bribe), when the world has one. */
  chase?: ChaseState;
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

/** Lines of text that fit beside a page picture on the phone's screen. */
const SCREEN_TEXT_W = 146;

/** Split text into lines no wider than the phone's text column (pixels, body font). */
export function wrap(textIn: string, maxW = SCREEN_TEXT_W): string[] {
  return wrapPx(textIn, maxW);
}

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const when = (at: number) => {
  const c = calendar(at);
  return `${c.weekday} ${formatClock(c.minute)}`;
};

const JOB_ICON: Record<JobId, IconName> = {
  office: 'app/jobs',
  mechanic: 'item/repair_kit',
  lumberjack: 'job/lumber',
  delivery: 'job/delivery',
};

// ---------------------------------------------------------------- phone

export function phoneRoot(ctx: PhoneCtx): ListPage {
  const st = ctx.state;
  const c = calendar(st.minutes);
  const rentAlert = st.finance.rent.evicted || st.finance.rent.owed > 0;
  const unread = st.messages.length;
  return {
    title: 'PHONE',
    right: `DAY ${c.day}`,
    layout: 'grid',
    rows: [
      {
        label: 'MESSAGES',
        icon: 'app/messages',
        badge: unread ? String(Math.min(99, unread)) : undefined,
        sub: unread ? `${unread} MESSAGES` : 'NO MESSAGES',
        act: () => ({ open: () => messagesPage(ctx) }),
      },
      {
        label: 'BANK',
        icon: 'app/bank',
        badge: rentAlert ? '!' : undefined,
        sub: rentAlert
          ? st.finance.rent.evicted
            ? 'EVICTED'
            : 'RENT IS LATE'
          : `BANK ${money(st.money.bank)}`,
        act: () => ({ open: () => bankPage(ctx) }),
      },
      {
        label: 'JOBS',
        icon: 'app/jobs',
        sub: `${JOBS[st.career.current].short}: ${rankTitle(st.career)}`,
        act: () => ({ open: () => jobsPage(ctx) }),
      },
      {
        label: 'CONTACTS',
        icon: 'app/contacts',
        sub: 'HR, LANDLORD, DEZ, MARLO',
        act: () => ({ open: () => contactsPage(ctx) }),
      },
      { label: 'BAG', icon: 'app/bag', sub: 'WHAT YOU CARRY', act: () => ({ open: () => bagPage(ctx) }) },
    ],
  };
}

function messagesPage(ctx: PhoneCtx): ListPage {
  const rows: ListRow[] = ctx.state.messages.map((m) => {
    const pic = SENDER_ICON[m.who] ?? 'app/messages';
    const first = wrap(m.text, 110)[0] ?? '';
    return {
      label: m.who,
      icon: pic,
      sub: first.length < m.text.length ? `${first}...` : first,
      detail: formatClock(calendar(m.at).minute),
      act: () => ({
        open: () => ({ title: m.who, right: when(m.at), icon: pic, lines: wrap(m.text), rows: [] }),
      }),
    };
  });
  return {
    title: 'MESSAGES',
    icon: rows.length ? undefined : 'app/messages',
    lines: rows.length ? undefined : ['NO MESSAGES YET.'],
    rows,
  };
}

export function bankPage(ctx: PhoneCtx): ListPage {
  const st = ctx.state;
  const r = st.finance.rent;
  const lines = [`BANK ${money(st.money.bank)}`, `CASH ${money(st.money.clean)}`];
  if (r.evicted) lines.push('EVICTED (4B)');
  else if (r.owed > 0) lines.push(`RENT OWED ${money(r.owed)}`);
  else lines.push(`RENT ${money(BALANCE.rent.weekly)} ON MON`);
  const rows: ListRow[] = [];
  if (!r.evicted && r.owed > 0)
    rows.push({
      label: 'PAY RENT NOW',
      icon: 'item/cash',
      sub: 'FROM THE BANK',
      detail: money(r.owed),
      enabled: st.money.bank >= r.owed,
      act: () => ({
        say: payOwed(st.money, st.finance, st.minutes) ? 'RENT PAID.' : 'NOT ENOUGH IN THE BANK.',
      }),
    });
  if (r.evicted)
    rows.push({
      label: 'MOVE BACK IN',
      icon: 'app/shelter',
      sub: 'A WEEK + STORAGE',
      detail: money(moveInCost(st.finance)),
      enabled: st.money.bank >= moveInCost(st.finance),
      act: () => ({
        say: moveBackIn(st.money, st.finance, st.minutes)
          ? 'WELCOME BACK. YOUR KEY WORKS.'
          : 'NOT ENOUGH IN THE BANK.',
      }),
    });
  rows.push({
    label: 'STATEMENT',
    icon: 'app/messages',
    sub: `${st.finance.ledger.length} ENTRIES`,
    act: () => ({ open: () => statementPage(ctx) }),
  });
  return { title: 'BANK', icon: 'app/bank', lines, rows };
}

function statementPage(ctx: PhoneCtx): ListPage {
  const rows: ListRow[] = ctx.state.finance.ledger.map((e) => ({
    label: e.text.length > 18 ? `${e.text.slice(0, 17)}.` : e.text,
    detail: `${e.amount >= 0 ? '+' : '-'}${money(Math.abs(e.amount))}`,
  }));
  return {
    title: 'STATEMENT',
    icon: rows.length ? undefined : 'app/bank',
    lines: rows.length ? undefined : wrap('NOTHING YET. PAY GOES TO THE BANK.'),
    rows,
  };
}

export function jobsPage(ctx: PhoneCtx): ListPage {
  const st = ctx.state;
  onboardEvent(st.onboarding, 'jobBoard');
  const c = st.career;
  const job = c.jobs[c.current];
  const lines = [JOBS[c.current].short, rankTitle(c)];
  lines.push(job.rank < 5 ? `XP ${job.xp} / ${xpNeeded(c, job.rank, st.minutes)}` : 'TOP RANK');
  if (frozen(c, st.minutes)) lines.push(`FROZEN TO ${when(c.freezeUntil)}`);
  else if (st.minutes < c.extraUntil) lines.push(`EXTRA WORK TO ${when(c.extraUntil)}`);
  const rows: ListRow[] = (Object.keys(JOBS) as JobId[]).map((id) => {
    const def = JOBS[id];
    const open = def.hiring;
    const mine = id === c.current;
    return {
      label: def.short,
      icon: JOB_ICON[id],
      sub: def.where,
      detail: mine ? 'YOURS' : open ? `RANK ${c.jobs[id].rank}` : 'SOON',
      enabled: open && !mine,
      act: () => {
        if (c.shift) return { say: 'FINISH YOUR SHIFT FIRST.' };
        c.current = id;
        return { say: `YOU NOW WORK AS ${def.ranks[c.jobs[id].rank - 1]}.` };
      },
    };
  });
  // the weekend odd jobs (docs/02): open to everyone, no XP; worked at the place itself
  for (const id of GIG_IDS) rows.push(gigRow(st, id));
  rows.push({
    label: 'PERKS',
    icon: JOB_ICON[c.current],
    sub: JOBS[c.current].short,
    act: () => ({ open: () => perksPage(ctx) }),
  });
  return { title: 'JOB BOARD', icon: JOB_ICON[c.current], lines, rows };
}

const GIG_ICON: Record<GigId, IconName> = { carWash: 'car/sedan_teal', barShift: 'item/cash' };

/** A weekend gig on the job board: its hours, and whether it can be started now. */
function gigRow(st: GameState, id: GigId): ListRow {
  const G = GIGS[id];
  const H = BALANCE_ODD.gigs[id];
  const hours = `SAT-SUN ${formatClock(H.from)}-${formatClock(H.until)}`;
  const r = canStartGig(st.oddJobs, id, st.minutes);
  const onThis = st.oddJobs.gig?.id === id;
  const detail = onThis ? 'ON IT' : r.ok ? 'OPEN' : r.reason === 'alreadyWorked' ? 'DONE' : 'SHUT';
  return {
    label: G.name,
    icon: GIG_ICON[id],
    sub: hours,
    detail,
    act: () => ({ say: r.ok || onThis ? `GO TO ${G.where} AND PRESS E.` : `${G.where}. ${hours}.` }),
  };
}

/** The current job's insider perks (docs/03): earned ones, and the ones whose systems come later. */
export function perksPage(ctx: PhoneCtx): ListPage {
  const c = ctx.state.career;
  const J = JOBS[c.current];
  const rank = c.jobs[c.current].rank;
  const lines: string[] = [];
  for (const p of J.perks) {
    const state = rank < p.rank ? 'LOCKED' : p.live ? 'ON' : 'LATER';
    lines.push(...wrap(`RANK ${p.rank} (${state}): ${p.text}`), '');
  }
  lines.push(...wrap('LATER: COMES WITH ITS PHASE.'));
  return { title: 'PERKS', icon: JOB_ICON[c.current], lines, rows: [] };
}

/** A contact's card: their portrait and what they have to say. */
function card(name: string, pic: IconName, words: string, rows: ListRow[] = []): ListPage {
  return { title: name, icon: pic, lines: wrap(words), rows };
}

export function contactsPage(ctx: PhoneCtx): ListPage {
  const st = ctx.state;
  const c = st.career;
  const C = BALANCE.careers;
  const today = calendar(st.minutes).day;
  const bribe = (amount: number, what: string, run: () => boolean) => () => {
    if (st.money.bank < amount) return { say: `HR WANTS ${money(amount)}.` };
    if (!run()) return { say: 'NOTHING TO COVER.' };
    debit(st.money, st.finance, st.minutes, what, amount);
    return { say: 'HR: CONSIDER IT HANDLED.' };
  };
  const hrPage = (): ListPage => {
    const missed = coverable(c, today).length;
    return card('HR', 'face/hr', 'DISCREET FIXES, PAID FROM YOUR BANK.', [
      {
        label: 'COVER A SHIFT',
        icon: 'app/jobs',
        sub: missed ? `${missed} MISSED` : 'NOTHING MISSED',
        detail: money(C.hrCoverShift),
        enabled: missed > 0,
        act: bribe(C.hrCoverShift, 'HR, COVERED SHIFT', () => coverShift(c, today)),
      },
      {
        label: 'LIFT FREEZE',
        icon: 'app/jobs',
        sub: frozen(c, st.minutes) ? 'PROMOTION FROZEN' : 'NOT FROZEN',
        detail: money(C.hrLiftFreeze),
        enabled: frozen(c, st.minutes),
        act: bribe(C.hrLiftFreeze, 'HR, FREEZE LIFTED', () => {
          if (!frozen(c, st.minutes)) return false;
          c.freezeUntil = 0;
          return true;
        }),
      },
    ]);
  };
  const missed = coverable(c, today).length;
  const rows: ListRow[] = [
    {
      label: 'HR',
      icon: 'face/hr',
      sub: missed || frozen(c, st.minutes) ? 'CAN HELP' : 'ALL IN ORDER',
      act: () => ({ open: hrPage }),
    },
    {
      label: 'LANDLORD',
      icon: 'face/landlord',
      sub: st.finance.rent.evicted ? 'YOU ARE OUT' : 'DRIZZLE ROW 4B',
      act: () => ({
        open: () =>
          card(
            'LANDLORD',
            'face/landlord',
            st.finance.rent.evicted
              ? `MOVE BACK IN FOR ${money(moveInCost(st.finance))}. USE THE BANK APP.`
              : `RENT IS ${money(BALANCE.rent.weekly)}, MONDAYS 06:00, FROM YOUR BANK.`,
          ),
      }),
    },
    {
      label: 'DEZ',
      icon: 'face/dez',
      sub: 'THE LOW TIDE',
      act: () => ({
        open: () =>
          card(
            'DEZ',
            'face/dez',
            `BACK ROOM OF THE LOW TIDE, 18:00-02:00. I TAKE ${Math.round(BALANCE.laundering.cut * 100)}%.`,
          ),
      }),
    },
    {
      label: 'MARLO',
      icon: 'face/marlo',
      sub: 'TOW & SALVAGE',
      act: () => ({
        open: () => card('MARLO', 'face/marlo', 'PARK IN MY DOTTED SPOT AND PRESS E. NO QUESTIONS.'),
      }),
    },
  ];
  // the crime side (Phase 3): a cop on the take while wanted, then the contacts your reputation opened
  if (st.wanted.stars > 0) {
    const price = onScenePrice(st.wanted.stars);
    rows.unshift({
      label: 'A COP ON THE TAKE',
      icon: 'face/cop',
      sub:
        price === null ? 'NOT AT THIS LEVEL' : ctx.chase?.bribe ? 'TRIED ALREADY' : 'MAKES THE CALL GO AWAY',
      detail: price === null ? undefined : money(price),
      enabled: price !== null && !ctx.chase?.bribe,
      act: () => (ctx.chase ? { say: bribeOnScene(ctx.chase, st.wanted, st.money).text } : undefined),
    });
  }
  for (const id of st.crime.contacts) {
    if (id === 'dez' || id === 'marlo') continue;
    const def = CONTACTS.find((q) => q.id === id);
    if (!def) continue;
    rows.push({
      label: def.name,
      icon: CONTACT_ICON[id],
      sub: def.role,
      act: () => ({ open: () => card(def.name, CONTACT_ICON[id], CONTACT_TEXT[id]) }),
    });
  }
  const rp = tierProgress(st.crime.rep);
  const lines = [
    `STREET REP: ${TIER_NAMES[tierFor(st.crime.rep)]}`,
    rp.next === null ? 'TOP OF THE TOWN' : `${st.crime.rep} / ${rp.next}`,
  ];
  return { title: 'CONTACTS', lines, rows };
}

const CONTACT_ICON: Record<ContactId, IconName> = {
  dez: 'face/dez',
  marlo: 'face/marlo',
  fence: 'face/fence',
  dealer: 'face/dealer',
  supplier: 'face/supplier',
  gangContact: 'face/gang',
};

/** What each crime contact says when you open their card (their services arrive over Phase 3 and later). */
const CONTACT_TEXT: Record<ContactId, string> = {
  dez: '',
  marlo: '',
  fence: 'THE PAWN SHOP. I BUY WHAT YOU FIND AND SELL MASKS AND TOOLS. NO RECEIPTS.',
  dealer: 'WEAPONS COME LATER. KEEP YOUR HEAD DOWN UNTIL THEN.',
  supplier: 'PRODUCT, WHEN YOU HAVE SOMEWHERE TO MOVE IT.',
  gangContact: 'WE HEAR THINGS. BRIBES AND INTEL, FOR A PRICE.',
};

// ---------------------------------------------------------------- ATM

export function atmPage(ctx: PhoneCtx): ListPage {
  const st = ctx.state;
  const m = st.money;
  const out = (n: number): ListRow => ({
    label: money(n),
    icon: 'item/cash',
    sub: `TAKE OUT ${money(n)}`,
    enabled: m.bank >= n,
    act: () => ({
      say: withdraw(m, st.finance, st.minutes, n) ? `TOOK OUT ${money(n)}.` : 'NOT ENOUGH IN THE BANK.',
    }),
  });
  return {
    title: 'ATM',
    right: 'GREYHAVEN SAVINGS',
    icon: 'app/bank',
    layout: 'grid',
    lines: [`BANK ${money(m.bank)}`, `CASH ${money(m.clean)}`, "DIRTY CASH CAN'T GO IN."],
    rows: [
      ...BALANCE.economy.atmSteps.map(out),
      {
        label: 'DEPOSIT',
        icon: 'app/bank',
        sub: `PAY IN ALL ${money(m.clean)} CLEAN`,
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
  const n = (k: number) => (k > 1 ? String(k) : undefined);
  if (inv.firstAid > 0)
    rows.push({
      label: 'FIRST AID',
      icon: 'item/first_aid',
      badge: n(inv.firstAid),
      sub: 'ENTER: USE IT, FULL HEALTH',
      act: () => ({ say: useFirstAid(ctx.wallet).text }),
    });
  if (inv.fuelCans > 0)
    rows.push({
      label: 'FUEL CAN',
      icon: 'item/fuel_can',
      badge: n(inv.fuelCans),
      sub: '10 FUEL. USE IT AT A CAR',
    });
  if (inv.repairKits > 0)
    rows.push({
      label: 'REPAIR',
      icon: 'item/repair_kit',
      badge: n(inv.repairKits),
      sub: 'CAR TO 50%. USE IT AT A CAR',
    });
  if (inv.lockpicks > 0)
    rows.push({
      label: 'PICKS',
      icon: 'item/lockpicks',
      badge: String(inv.lockpicks),
      sub: `${inv.lockpicks} USES LEFT`,
    });
  if (inv.toolbox > 0) rows.push({ label: 'TOOLBOX', icon: 'item/toolbox', sub: 'HOTWIRING: +3 SECONDS' });
  if (inv.phones > 0)
    rows.push({ label: 'PHONE', icon: 'item/phone', badge: n(inv.phones), sub: 'STOLEN. FOR A FENCE' });
  if (inv.watches > 0)
    rows.push({ label: 'WATCH', icon: 'item/watch', badge: n(inv.watches), sub: 'STOLEN. FOR A FENCE' });
  return {
    title: 'BAG',
    right: `${money(st.money.clean)} / ${money(st.money.dirty)}`,
    layout: 'grid',
    icon: rows.length ? undefined : 'app/bag',
    lines: rows.length ? undefined : ['THE BAG IS EMPTY.'],
    rows,
  };
}
