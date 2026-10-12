// Layout check (user request, 2026-10-11): no text or icon in any panel or the HUD may overlap another.
import { describe, expect, it } from 'vitest';
import { drawMenu, MENU_PANEL } from '../src/ui/menus';
import { Rng } from '../src/core/rng';
import { SHOP_STOCK } from '../src/data/items';
import {
  DataEntryGame,
  FilingGame,
  HotwireGame,
  DuffelGame,
  MoneyCountGame,
  SearchGame,
  SkillCheckGame,
} from '../src/minigames/logic';
import { rollTrunk } from '../src/systems/loot';
import { createState } from '../src/core/store';
import {
  atmPage,
  bagPage,
  bankPage,
  contactsPage,
  jobsPage,
  phoneRoot,
  type PhoneCtx,
} from '../src/world/phone';
import { drawList, LIST_SIZE, type ListPage, type ListStyle } from '../src/ui/listPanel';
import { arrestEffects } from '../src/systems/career';
import {
  beginAudit,
  createSurface,
  endAudit,
  hintKeys,
  hintKeysWidth,
  objective,
  overlaps,
  toast,
  topLeft,
  topRight,
  stars,
  vehiclePanel,
  type DrawnRect,
  type Surface,
} from '../src/ui/hudDraw';
import {
  PANEL_SIZE,
  drawEntry,
  drawFiling,
  drawHotwire,
  drawLockpick,
  drawDuffel,
  drawMoneyCount,
  drawSearch,
  drawShop,
  type PanelKind,
} from '../src/ui/panels';

const DRIVE_HINTS: [string, string][] = [
  ['W/S', 'DRIVE'],
  ['A/D', 'STEER'],
  ['SPACE', 'BRAKE'],
  ['F', 'EXIT'],
];
const X = 40;
const Y = 30;

function check(kind: PanelKind | 'hud', draw: (s: Surface) => void): DrawnRect[] {
  const s = createSurface(640, 360);
  beginAudit();
  draw(s);
  const rects = endAudit();
  expect(rects.length, `${kind}: nothing recorded`).toBeGreaterThan(3);
  const bad = overlaps(rects).map(([a, b]) => `${a.what} @${a.x},${a.y} overlaps ${b.what} @${b.x},${b.y}`);
  expect(bad, kind).toEqual([]);
  if (kind !== 'hud') {
    const P = PANEL_SIZE[kind];
    for (const r of rects) {
      expect(
        r.x >= X && r.y >= Y && r.x + r.w <= X + P.w && r.y + r.h <= Y + P.h,
        `${kind}: ${r.what} leaves the panel`,
      ).toBe(true);
    }
  }
  return rects;
}

describe('panel layouts never overlap', () => {
  it('filing, in play, after a stamp, and at the end', () => {
    const f = new FilingGame(new Rng(1));
    check('filing', (s) => drawFiling(s, X, Y, f, 'TASK 1/3', null));
    f.file(0);
    check('filing', (s) => drawFiling(s, X, Y, f, 'TASK 1/3', null));
    f.misfiled = 9;
    f.missed = 9;
    f.correct = 9;
    check('filing', (s) => drawFiling(s, X, Y, f, 'TASK 3/3', null));
    while (!f.done) f.file(1);
    check('filing', (s) => drawFiling(s, X, Y, f, 'TASK 3/3', null));
  });

  it('data entry', () => {
    const e = new DataEntryGame(new Rng(2));
    e.errors = 12;
    check('dataEntry', (s) => drawEntry(s, X, Y, e, 'TASK 2/3'));
  });

  it('lockpick, hotwire and money count', () => {
    const l = new SkillCheckGame(new Rng(3), 4);
    l.noise = 1;
    check('lockpick', (s) => drawLockpick(s, X, Y, l, 4, 'NO TOOL'));
    const h = new HotwireGame(new Rng(4));
    h.pickLeft(0);
    h.sparks = 2;
    check('hotwire', (s) => drawHotwire(s, X, Y, h));
    const m = new MoneyCountGame();
    for (let k = 0; k < 10; k++) m.count();
    m.miscounts = 3;
    check('moneyCount', (s) => drawMoneyCount(s, X, Y, m, 'DEZ'));
    const d = new DuffelGame(new Rng(5));
    d.bag(d.stacks.findIndex((q) => q.dyed));
    d.bag(d.stacks.findIndex((q) => !q.dyed));
    check('duffel', (s) => drawDuffel(s, X, Y, d, 'DEZ', 2));
  });

  it('the shop, with every card, a long message and big numbers', () => {
    check('shop', (s) =>
      drawShop(s, X, Y, {
        title: 'OPEN MOST HOURS',
        stock: SHOP_STOCK.store,
        clean: 99999,
        selected: 3,
        message: 'NOT ENOUGH CLEAN CASH',
      }),
    );
  });

  it('the hardware shop', () => {
    check('shop', (s) =>
      drawShop(s, X, Y, {
        title: 'HARDWARE',
        stock: SHOP_STOCK.hardware,
        clean: 10,
        selected: 2,
        message: 'YOU ALREADY HAVE A TOOLBOX',
      }),
    );
  });

  it('the trunk search, in play and at the end', () => {
    const g = new SearchGame(new Rng(6), rollTrunk(new Rng(7)));
    g.grab(g.cells.findIndex((c) => c.item && c.item.kind !== 'junk'));
    check('search', (s) => drawSearch(s, X, Y, g, 'TRUNK', 0.1));
    g.timeLeft = 0;
    g.update(0.1);
    check('search', (s) => drawSearch(s, X, Y, g, 'TRUNK', 2));
  });

  it('the car readout and the driving hints', () => {
    check('hud', (s) => {
      topLeft(s, 6, 6, { ammo: '-/-', label: 'UNARMED', hp: 1, armor: 0 });
      vehiclePanel(s, 6, 46, { fuel: 0.1, health: 0.2, speed: 1 });
      objective(s, 320, 340, "SELL THE CAR AT MARLO'S TOW & SALVAGE");
      hintKeys(s, 634 - hintKeysWidth(DRIVE_HINTS) + 8, 340, DRIVE_HINTS);
    });
  });

  it('the HUD panels with long values', () => {
    check('hud', (s) => {
      topLeft(s, 6, 6, { ammo: '-/-', label: 'UNARMED', hp: 0.5, armor: 0.2 });
      stars(s, 320, 6, 5);
      topRight(s, 634, 6, { day: 'WED', clock: '23:59', clean: '99,999', dirty: '99,999', night: true });
      objective(s, 320, 340, 'DO 3 MORE TASKS: FILING CABINETS OR YOUR DESK');
      toast(s, 634, 308, 'MS. HOLLIS', 'PROMOTED TO ANALYST! +$250 BONUS. HERE IS YOUR KEY CARD.');
      hintKeys(s, 500, 340, [
        ['E', 'USE'],
        ['TAB', 'NEXT'],
      ]);
    });
  });
});

describe('pause menu (docs/11)', () => {
  it('fits the longest save summaries, a message and the footer without overlaps', () => {
    const s = createSurface(640, 360);
    beginAudit();
    drawMenu(
      s,
      X,
      Y,
      'LOAD',
      'GREYHAVEN',
      ['SLOT 1', 'SLOT 2', 'SLOT 3', 'AUTOSAVE A', 'AUTOSAVE B'].map((label) => ({
        label,
        detail: 'DAY 42 WED 23:59  $99999 / $99999',
        enabled: true,
      })),
      2,
      'SAVES LIVE IN THIS BROWSER ONLY. EXPORT TO BACK UP.',
      'SAVED TO SLOT 3',
    );
    const rects = endAudit();
    expect(overlaps(rects)).toEqual([]);
    for (const r of rects)
      expect(
        r.x >= X && r.y >= Y && r.x + r.w <= X + MENU_PANEL.w && r.y + r.h <= Y + MENU_PANEL.h,
        r.what,
      ).toBe(true);
  });
});

describe('list panels: the phone, the ATM and the bag (docs/11)', () => {
  function checkList(style: ListStyle, page: ListPage, message: string | null = null): void {
    const s = createSurface(640, 360);
    beginAudit();
    drawList(s, style, X, Y, page, 1, 0, message, true);
    const rects = endAudit();
    const bad = overlaps(rects).map(([a, b]) => `${a.what} @${a.x},${a.y} overlaps ${b.what} @${b.x},${b.y}`);
    expect(bad, page.title).toEqual([]);
    const P = LIST_SIZE[style];
    for (const r of rects)
      expect(
        r.x >= X && r.y >= Y && r.x + r.w <= X + P.w && r.y + r.h <= Y + P.h,
        `${page.title}: ${r.what} leaves the panel`,
      ).toBe(true);
  }

  /** A busy game: big balances, rent owed, a frozen promotion, every item in the bag, a long message log. */
  function busy(): PhoneCtx {
    const st = createState(1, 'downtown', { x: 0, y: 0 }, 3 * 1440 + 9 * 60);
    st.money = { clean: 99999, dirty: 99999, bank: 999999 };
    st.finance.rent.owed = 1250;
    st.finance.rent.unpaidSince = 0;
    for (let k = 0; k < 30; k++)
      st.finance.ledger.push({
        at: k * 60,
        text: k % 2 ? 'MOVE IN, DRIZZLE ROW 4B' : 'PAY, DELIVERY',
        amount: k % 2 ? -550 : 99999,
      });
    for (let k = 0; k < 30; k++)
      st.messages.push({ at: k * 90, who: k % 2 ? 'MS. HOLLIS' : 'LANDLORD', text: 'X' });
    Object.assign(st.inventory, {
      fuelCans: 9,
      firstAid: 9,
      repairKits: 9,
      lockpicks: 99,
      toolbox: 1,
      phones: 12,
      watches: 12,
    });
    st.career.missed.push(3);
    arrestEffects(st.career, st.minutes - 60, st.minutes);
    st.player.health = 40;
    return { state: st, wallet: { money: st.money, inventory: st.inventory, health: 40 } };
  }

  it('every page fits, with long values and a message', () => {
    const ctx = busy();
    checkList('phone', phoneRoot(ctx), 'HR: CONSIDER IT HANDLED.');
    checkList('phone', bankPage(ctx), 'NOT ENOUGH IN THE BANK.');
    checkList('phone', jobsPage(ctx), 'FINISH YOUR SHIFT FIRST.');
    checkList('phone', contactsPage(ctx), 'MOVE BACK IN FOR $550. BANK APP.');
    checkList('menu', atmPage(ctx), 'NOT ENOUGH IN THE BANK.');
    checkList('menu', bagPage(ctx), 'FIRST AID +60 HP');
    // and the pages behind the rows
    for (const page of [phoneRoot(ctx), bankPage(ctx)])
      for (const row of page.rows) {
        const a = row.act?.();
        if (a && 'open' in a) checkList('phone', a.open());
      }
  });

  it('an evicted player sees MOVE BACK IN', () => {
    const ctx = busy();
    ctx.state.finance.rent.evicted = true;
    ctx.state.finance.rent.storage = true;
    const bank = bankPage(ctx);
    expect(bank.rows.map((r) => r.label)).toContain('MOVE BACK IN');
    checkList('phone', bank);
  });
});
