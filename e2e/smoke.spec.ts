// Smoke test against the production build (base /greyhaven/): the game boots, the title starts the
// game, the walker moves, it sorts in front of and behind a building, and nothing is fetched from
// another origin.

import { expect, test, type Page } from '@playwright/test';

async function boot(page: Page, query: string): Promise<string[]> {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`);
  });
  page.on('request', (r) => {
    const url = r.url();
    const local = url.startsWith('http://localhost:4173/') || url.startsWith('blob:http://localhost:4173/');
    if (!local && !url.startsWith('data:')) problems.push(`external request: ${r.url()}`);
  });
  page.on('requestfailed', (r) => problems.push(`failed: ${r.url()}`));
  await page.goto(query);
  await page.waitForFunction(() => window.__DL__?.ready === true, null, { timeout: 30_000 });
  return problems;
}

/** Type a line into the cheat console (Ctrl + Shift + F1) and close it. */
async function cheat(page: Page, line: string): Promise<void> {
  await page.keyboard.press('Control+Shift+F1');
  // one input event, not a key per letter: typing took seconds on CI while the world ran on
  await page.keyboard.insertText(line);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
}

/**
 * Play an open lockpick panel like a player watching the needle: press Space as it crosses into the good zone.
 * Polling the needle doesn't depend on the frame rate (slow CI frames made timed predictions miss).
 */
async function playLockpick(page: Page): Promise<void> {
  const t0 = Date.now();
  while (Date.now() - t0 < 40_000) {
    const g = await page.evaluate(() => {
      const m = window.__DL__.minigameState as {
        needle: number;
        zone: number;
        good: number;
        passed: number;
        done: boolean;
      } | null;
      if (window.__DL__.minigame !== 'lockpick' || !m) return null;
      return { needle: m.needle, zone: m.zone, good: m.good, passed: m.passed, done: m.done };
    });
    if (!g || g.done) break;
    const off = ((((g.needle - g.zone) % 360) + 540) % 360) - 180;
    if (off >= -g.good / 2 + 4 && off <= 0) {
      await page.keyboard.press('Space');
      await page
        .waitForFunction(
          (passed) => {
            const m = window.__DL__.minigameState as { passed: number; done: boolean } | null;
            return !m || m.done || m.passed !== passed || window.__DL__.minigame !== 'lockpick';
          },
          g.passed,
          { timeout: 3_000 },
        )
        .catch(() => undefined);
    } else await page.waitForTimeout(10);
  }
}

test('boots, starts from the title and moves the walker', async ({ page }) => {
  const problems = await boot(page, '?seed=1');
  expect(await page.evaluate(() => window.__DL__.started)).toBe(false);
  await page.mouse.click(640, 360);
  // a new game opens the character creator (docs/11): type a name, pick a hair style, start the day
  await page.waitForFunction(() => window.__DL__.minigame === 'creator');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('Robin');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => window.__DL__.creator)).toMatchObject({ name: 'ROBIN', style: 'long' });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__DL__.started === true);
  expect(await page.evaluate(() => window.__DL__.look)).toMatchObject({ name: 'ROBIN', style: 'long' });

  const before = await page.evaluate(() => window.__DL__.walker);
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(700);
  await page.keyboard.up('KeyS');
  const after = await page.evaluate(() => window.__DL__.walker);
  expect(before).not.toBeNull();
  // S walks down the screen: both world coordinates grow.
  expect(after!.x).toBeGreaterThan(before!.x + 5);
  expect(after!.y).toBeGreaterThan(before!.y + 5);
  expect(after!.dir).toBe('S');

  // Integer zoom only.
  expect(Number.isInteger(await page.evaluate(() => window.__DL__.zoom))).toBe(true);
  expect(problems).toEqual([]);
});

test('sorts the player behind and in front of Pellridge Tower', async ({ page }) => {
  await boot(page, '?scene=world&zoom=3&x=150&y=200');
  const tower = await page.evaluate(() => window.__DL__.depthOf('bld/pellridge_tower'));
  const behind = await page.evaluate(() => window.__DL__.walker!.depth);
  expect(behind).toBeLessThan(tower!);
  // The tower fades so the walker stays visible behind it.
  await page.waitForFunction(() => (window.__DL__.alphaOf('bld/pellridge_tower') ?? 1) < 0.5);

  await page.goto('?scene=world&zoom=3&x=345&y=250');
  await page.waitForFunction(() => window.__DL__?.ready === true);
  const front = await page.evaluate(() => window.__DL__.walker!.depth);
  expect(front).toBeGreaterThan(tower!);
  expect(await page.evaluate(() => window.__DL__.alphaOf('bld/pellridge_tower'))).toBe(1);
});

test('the reference view renders the whole test map at 1x', async ({ page }) => {
  await page.setViewportSize({ width: 1900, height: 1280 });
  const problems = await boot(page, '?scene=reference');
  expect(await page.evaluate(() => window.__DL__.zoom)).toBe(1);
  expect(problems).toEqual([]);
});

test('zooms with Ctrl + wheel in whole steps and pans with the middle mouse', async ({ page }) => {
  await boot(page, '?scene=world&zoom=2');
  await page.mouse.move(640, 360);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -100);
  await page.keyboard.up('Control');
  await page.waitForFunction(() => window.__DL__.zoom === 3);

  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(540, 360, { steps: 5 });
  await page.mouse.up({ button: 'middle' });
  const pan = await page.evaluate(() => window.__DL__.pan);
  // Dragging left by 100 device px at 3x moves the view right by about 33 art px.
  expect(pan.x).toBeGreaterThan(25);
  expect(Math.abs(pan.y)).toBeLessThan(5);

  await page.keyboard.press('KeyC');
  await page.waitForFunction(() => window.__DL__.pan.x === 0 && window.__DL__.pan.y === 0);
});

test('targets the ATM in range and the clock runs', async ({ page }) => {
  const problems = await boot(page, '?scene=world&zoom=3&x=300&y=318');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(150);
  await page.keyboard.up('KeyW');
  await page.waitForFunction(() => window.__DL__.target === 'atm_plaza');
  const t0 = await page.evaluate(() => window.__DL__.minutes);
  await page.waitForTimeout(1500);
  const t1 = await page.evaluate(() => window.__DL__.minutes);
  // 20-minute day: 1.2 in-game minutes per real second
  expect(t1 - t0).toBeGreaterThan(0.8);
  expect(t1 - t0).toBeLessThan(3);
  expect(problems).toEqual([]);
});

test('night falls: renders at 23:30 without errors', async ({ page }) => {
  const problems = await boot(page, '?scene=world&zoom=2&time=23:30');
  expect(await page.evaluate(() => Math.floor(window.__DL__.minutes))).toBe(23 * 60 + 30);
  expect(problems).toEqual([]);
});

test('walks into the corner store and back out to the street', async ({ page }) => {
  const problems = await boot(page, '?scene=world&zoom=3&time=10:00&x=873&y=545');
  await page.keyboard.down('KeyW');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(150);
  await page.keyboard.up('KeyW');
  await page.keyboard.up('KeyD');
  await page.waitForFunction(() => window.__DL__.target === 'door:store');
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__DL__.area === 'store', null, { timeout: 15_000 });
  await page.waitForFunction(() => window.__DL__.target === 'store:exit');
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__DL__.area === 'street', null, { timeout: 15_000 });
  expect(problems).toEqual([]);
});

test('keeps closed buildings closed: the tower before 08:00', async ({ page }) => {
  await boot(page, '?scene=world&zoom=3&time=07:00&x=237&y=300');
  await page.keyboard.down('KeyW');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(150);
  await page.keyboard.up('KeyW');
  await page.keyboard.up('KeyD');
  await page.waitForFunction(() => window.__DL__.target === 'door:tower_lobby');
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__DL__.area)).toBe('street');
});

test('clocks in with Ms. Hollis on floor 4', async ({ page }) => {
  const problems = await boot(page, '?scene=world&zoom=3&area=office_floor&time=08:10&x=206&y=151');
  for (let k = 0; k < 6; k++) {
    if ((await page.evaluate(() => window.__DL__.target)) === 'office_floor:41') break;
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
  }
  expect(await page.evaluate(() => window.__DL__.tasksLeft)).toBe(-1);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__DL__.tasksLeft === 3);
  expect(problems).toEqual([]);
});

test('carjack: picks a parked car, hotwires it and drives off', async ({ page }) => {
  test.setTimeout(240_000);
  const problems = await boot(page, '?scene=world&zoom=3&time=16:00&x=841&y=184');
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(150);
  await page.keyboard.up('KeyA');
  await page.waitForFunction(() => window.__DL__.target?.startsWith('car:'));
  const id = await page.evaluate(() => (window.__DL__.target as string).slice(4));
  // the lockpick: press space as the needle reaches the zone, like a player would (retry if the pick slips)
  for (let attempt = 0; attempt < 6; attempt++) {
    await page.keyboard.press('KeyE');
    await page.waitForFunction(() => window.__DL__.minigame === 'lockpick', null, { timeout: 10_000 });
    await playLockpick(page);
    await page.waitForFunction(() => window.__DL__.minigame === null, null, { timeout: 20_000 });
    await page.waitForTimeout(800);
    if (await page.evaluate((cid) => !window.__DL__.cars.find((c) => c.id === cid)?.locked, id)) break;
  }
  expect(await page.evaluate((cid) => window.__DL__.cars.find((c) => c.id === cid)?.locked, id)).toBe(false);
  // the hotwire: join each wire to its colour
  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => window.__DL__.minigame === 'hotwire', null, { timeout: 10_000 });
  const wires = await page.evaluate(() => window.__DL__.minigameState as { left: string[]; right: string[] });
  for (let k = 0; k < wires.left.length; k++) {
    await page.keyboard.press(String(k + 1));
    await page.waitForTimeout(150);
    await page.keyboard.press(`Key${'ASDF'[wires.right.indexOf(wires.left[k] as string)]}`);
    await page.waitForTimeout(150);
  }
  await page.waitForFunction((cid) => window.__DL__.driving === cid, id, { timeout: 20_000 });
  await page.waitForTimeout(500);
  await page.keyboard.down('KeyW');
  await page.waitForFunction((cid) => (window.__DL__.cars.find((c) => c.id === cid)?.speed ?? 0) > 60, id, {
    timeout: 20_000,
  });
  await page.keyboard.up('KeyW');
  expect(problems).toEqual([]);
});

test("sells a stolen car in Marlo's dotted spot: he walks out and pays", async ({ page }) => {
  test.setTimeout(150_000);
  const problems = await boot(page, '?scene=world&zoom=3&time=16:00&x=1580&y=1045');
  // the cheat console (Ctrl + Shift + F1) puts a stolen sedan in the spot
  await page.keyboard.press('Control+Shift+F1');
  await page.keyboard.type('car sedan_lav 1611 1013 0');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__DL__.cars.some((c) => c.id.startsWith('cheat')));
  for (let k = 0; k < 6; k++) {
    if ((await page.evaluate(() => window.__DL__.target)) === 'zone:marlo_spot') break;
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
  }
  expect(await page.evaluate(() => window.__DL__.target)).toBe('zone:marlo_spot');
  const dirty = await page.evaluate(() => window.__DL__.dirty);
  await page.keyboard.press('KeyE');
  // Marlo's walk is a scene tween, so it runs on Phaser's smoothed clock, which crawls when headless Chromium
  // drops to a few frames a second on the bigger map: give him time.
  await page.waitForFunction((d) => window.__DL__.dirty > d, dirty, { timeout: 75_000 });
  expect(await page.evaluate(() => window.__DL__.cars.some((c) => c.id.startsWith('cheat')))).toBe(false);
  expect(problems).toEqual([]);
});

test('saves at home and loads the save back (docs/12)', async ({ page }) => {
  test.setTimeout(120_000);
  const problems = await boot(page, '?scene=world&zoom=3&area=apartment&time=21:00');
  await page.waitForFunction(() => window.__DL__.area === 'apartment');
  // Esc opens the pause menu; SAVE GAME is the second row, then slot 1
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__DL__.minigame === 'menu');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  await page.keyboard.press('Escape'); // back to the main menu
  await page.keyboard.press('Escape'); // resume
  await page.waitForFunction(() => window.__DL__.minigame === null);
  // spend the money with the cheat console, then load the save: the money comes back
  await page.keyboard.press('Control+Shift+F1');
  await page.keyboard.type('cash 5');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__DL__.clean === 5);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__DL__.minigame === 'menu');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter'); // LOAD GAME
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter'); // slot 1
  await page.waitForFunction(() => window.__DL__.clean === 250 && window.__DL__.area === 'apartment', null, {
    timeout: 30_000,
  });
  expect(problems).toEqual([]);
});

test('police: the cruiser comes from Precinct 1, an officer busts the player, a first offense costs the fine', async ({
  page,
}) => {
  test.setTimeout(180_000);
  // stand on Pewter Street's sidewalk a little north of the precinct, in plain view
  const problems = await boot(page, '?scene=world&zoom=2&time=12:00&x=560&y=1240');
  await page.keyboard.press('Control+Shift+F1');
  await page.keyboard.type('stars 1');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__DL__.stars === 1);
  // the officers get out, run up and bust the player (no surrender: the full fine)
  await page.waitForFunction(() => window.__DL__.minigame === 'arrest', null, { timeout: 120_000 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__DL__.minigame === null);
  expect(await page.evaluate(() => window.__DL__.stars)).toBe(0);
  expect(await page.evaluate(() => window.__DL__.clean)).toBe(250 - 200);
  expect(problems).toEqual([]);
});

test('the ATM: pay carried cash into the bank and take some out (docs/02)', async ({ page }) => {
  test.setTimeout(120_000);
  const problems = await boot(page, '?scene=world&zoom=3&x=300&y=318');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(150);
  await page.keyboard.up('KeyW');
  await page.waitForFunction(() => window.__DL__.target === 'atm_plaza');
  await page.waitForTimeout(400);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__DL__.minigame === 'atm');
  await page.waitForTimeout(400);
  // DEPOSIT ALL CLEAN CASH is the fifth row
  await page.keyboard.press('5');
  await page.waitForFunction(() => window.__DL__.bank === 250 && window.__DL__.clean === 0);
  // WITHDRAW $100 is the third
  await page.keyboard.press('3');
  await page.waitForFunction(() => window.__DL__.bank === 150 && window.__DL__.clean === 100);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__DL__.minigame === null);
  expect(problems).toEqual([]);
});

test('the phone (P): the bank app shows the balance and the statement', async ({ page }) => {
  test.setTimeout(120_000);
  const problems = await boot(page, '?scene=world&zoom=2&time=10:00');
  await cheat(page, 'bank 640');
  await page.keyboard.press('KeyP');
  await page.waitForFunction(() => window.__DL__.minigame === 'phone');
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__DL__.listPage?.title)).toBe('PHONE');
  await page.keyboard.press('2'); // BANK
  await page.waitForFunction(() => window.__DL__.listPage?.title === 'BANK');
  expect(await page.evaluate(() => window.__DL__.listPage?.lines?.[0])).toBe('BANK $640');
  await page.keyboard.press('Escape'); // back to the front page
  await page.waitForFunction(() => window.__DL__.listPage?.title === 'PHONE');
  await page.keyboard.press('KeyP'); // P closes it
  await page.waitForFunction(() => window.__DL__.minigame === null);
  expect(problems).toEqual([]);
});

test('trunk looting: pick the trunk lock, grab the glinting items, dirty cash in hand', async ({ page }) => {
  test.setTimeout(240_000);
  // the sedan at the store lot's west end faces +y; stand behind its rear bumper. 04:00: the street is empty, so
  // no witness calls the police in the middle of the test
  const problems = await boot(page, '?scene=world&zoom=3&time=04:00&x=797&y=132');
  await cheat(page, 'item lockpicks 10');
  for (let k = 0; k < 6; k++) {
    if ((await page.evaluate(() => window.__DL__.target))?.startsWith('trunk:')) break;
    await page.keyboard.press('Tab');
    await page.waitForTimeout(150);
  }
  const target = await page.evaluate(() => window.__DL__.target as string);
  expect(target.startsWith('trunk:')).toBe(true);
  const id = target.slice(6);
  for (let attempt = 0; attempt < 6; attempt++) {
    await page.keyboard.press('KeyE');
    await page.waitForFunction(() => ['lockpick', 'search'].includes(window.__DL__.minigame ?? ''), null, {
      timeout: 10_000,
    });
    if ((await page.evaluate(() => window.__DL__.minigame)) === 'lockpick') await playLockpick(page);
    // after a picked lock the search panel opens a moment later; a slipped pick leaves no panel
    const opened = await page
      .waitForFunction(() => window.__DL__.minigame === 'search', null, { timeout: 8_000 })
      .then(() => true)
      .catch(() => false);
    if (opened) break;
    await page.waitForFunction(() => window.__DL__.minigame === null, null, { timeout: 20_000 });
    await page.waitForTimeout(800);
  }
  await page.waitForFunction(
    () => window.__DL__.minigame === 'search' && (window.__DL__.minigameState as { cells?: unknown })?.cells,
    null,
    { timeout: 10_000 },
  );
  expect(await page.evaluate(() => window.__DL__.inventory.lockpicks)).toBeLessThan(10);
  // grab the valuables with the keyboard, the money first (the timer is short and headless frames are slow): move the
  // cursor onto each and press Space
  const cells = await page.evaluate(() => {
    const cs = (window.__DL__.minigameState as { cells: { item: { kind: string } | null }[] }).cells;
    const money = (k: string) => k === 'cash' || k === 'wallet';
    return cs
      .map((c, i) => ({ i, kind: c.item?.kind ?? 'junk' }))
      .filter((c) => c.kind !== 'junk')
      .sort((a, b) => Number(money(b.kind)) - Number(money(a.kind)))
      .map((c) => c.i);
  });
  for (const cell of cells) {
    for (let k = 0; k < 12; k++) {
      const g = await page.evaluate(
        () => window.__DL__.minigameState as { cursor: number; cols: number; done: boolean } | null,
      );
      if (!g || g.done || g.cursor === cell) break;
      const sameRow = Math.floor(g.cursor / g.cols) === Math.floor(cell / g.cols);
      await page.keyboard.press(sameRow ? 'ArrowRight' : 'ArrowDown');
    }
    await page.keyboard.press('Space');
  }
  await page.waitForFunction(() => window.__DL__.minigame === null, null, { timeout: 20_000 });
  await page.waitForFunction((cid) => window.__DL__.cars.find((c) => c.id === cid)?.looted === true, id);
  expect(await page.evaluate(() => window.__DL__.dirty)).toBeGreaterThanOrEqual(20);
  // a looted car stays looted: the trunk prompt is gone
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__DL__.target?.startsWith('trunk:') ?? false)).toBe(false);
  expect(problems).toEqual([]);
});

test('unpaid rent ends in eviction: the apartment refuses you, the shelter lets you sleep', async ({
  page,
}) => {
  test.setTimeout(120_000);
  // St. Brine's Mission is the chapel on Pewter Street, next to the precinct
  const problems = await boot(page, '?scene=world&zoom=3&time=10:00&x=545&y=1342');
  // three weeks pass with nothing in the bank: rent is missed on day 8, eviction comes 14 days later
  await cheat(page, 'day 23');
  await page.waitForFunction(() => window.__DL__.evicted === true);
  for (let k = 0; k < 6; k++) {
    if ((await page.evaluate(() => window.__DL__.target)) === 'zone:shelter') break;
    await page.keyboard.press('Tab');
    await page.waitForTimeout(150);
  }
  expect(await page.evaluate(() => window.__DL__.target)).toBe('zone:shelter');
  const before = await page.evaluate(() => window.__DL__.minutes);
  await page.waitForTimeout(400);
  await page.keyboard.press('KeyE');
  await page.waitForFunction((t) => window.__DL__.minutes > t + 60, before, { timeout: 15_000 });
  expect(Math.floor((await page.evaluate(() => window.__DL__.minutes)) % 1440)).toBe(6 * 60);
  expect(problems).toEqual([]);
});

test('the clothing store: buy an outfit, it goes on, and the booth changes back (milestone 6b)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const problems = await boot(page, '?scene=world&zoom=3&area=clothing&time=11:00');
  await cheat(page, 'cash 500');
  await cheat(page, 'tp 196 80');
  await page.waitForFunction(() => window.__DL__.target?.startsWith('clothing:'));
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__DL__.minigame === 'clothing');
  await page.waitForTimeout(400);
  // GREY HOODIE ($60) is the first row
  await page.keyboard.press('1');
  await page.waitForFunction(
    () => window.__DL__.look?.outfit === 'grey_hoodie' && window.__DL__.clean === 440,
  );
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__DL__.minigame === null);
  // the fitting booth: the wardrobe lists the starting three plus the hoodie; the first is the teal jacket
  await cheat(page, 'tp 34 30');
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__DL__.minigame === 'wardrobe');
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__DL__.listPage?.rows.length)).toBe(4);
  await page.keyboard.press('1');
  await page.waitForFunction(() => window.__DL__.look?.outfit === 'teal_jacket');
  await page.keyboard.press('Escape');
  expect(problems).toEqual([]);
});

test('the used-car lot: buy a beater, it waits keyed in the pickup bay and drives off clean (docs/08)', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const problems = await boot(page, '?scene=world&zoom=2&area=dealer&time=11:00');
  await cheat(page, 'bank 6000');
  await cheat(page, 'tp 72 64');
  await page.waitForFunction(() => window.__DL__.target?.startsWith('dealer:'));
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__DL__.minigame === 'dealer');
  await page.waitForTimeout(400);
  await page.keyboard.press('1');
  await page.waitForFunction(() => window.__DL__.bank === 4500);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__DL__.minigame === null);
  const car = await page.evaluate(() => window.__DL__.cars.find((c) => c.owned));
  expect(car).toMatchObject({ model: 'beater_khaki', locked: false, running: true, fuel: 30 });
  // out of the cabin, round to the bay, in and away through the gap in the pennants
  await cheat(page, 'tp 104 112');
  await page.waitForFunction(() => window.__DL__.target === 'dealer:exit');
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__DL__.area === 'street', null, { timeout: 15_000 });
  await cheat(page, `tp ${car!.x + 30} ${car!.y}`);
  await page.waitForFunction((id) => window.__DL__.target === `car:${id}`, car!.id);
  await page.keyboard.press('KeyF');
  await page.waitForFunction((id) => window.__DL__.driving === id, car!.id);
  await page.keyboard.down('KeyW');
  await page.waitForFunction((y) => (window.__DL__.cars.find((c) => c.owned)?.y ?? 0) > y + 120, car!.y, {
    timeout: 60_000,
  });
  await page.keyboard.up('KeyW');
  expect(await page.evaluate(() => window.__DL__.stars)).toBe(0);
  expect(problems).toEqual([]);
});

test('the garage: the locker hands out coveralls, a mechanic shift runs its tasks and pays (milestone 7)', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const problems = await boot(page, '?scene=world&zoom=2&area=garage&time=08:05');
  await cheat(page, 'job mechanic');
  const use = async (x: number, y: number, target: string) => {
    await cheat(page, `tp ${x} ${y}`);
    await page.waitForFunction((t) => window.__DL__.target === t, target);
    await page.keyboard.press('KeyE');
  };
  // no clocking in out of uniform
  await use(22, 14, 'garage:0');
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__DL__.tasksLeft)).toBe(-1);
  await use(14, 132, 'garage:11');
  await page.waitForFunction(() => window.__DL__.minigame === 'locker');
  await page.waitForTimeout(400);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__DL__.look?.outfit === 'coveralls');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__DL__.minigame === null);
  await use(22, 14, 'garage:0');
  await page.waitForFunction(() => window.__DL__.tasksLeft === 3);
  // three tasks: each opens its own panel; the test hands in a grade the way the panel would
  for (const [x, y, id, kind] of [
    [226, 100, 'garage:33', 'diagnose'],
    [176, 112, 'garage:31', 'boltTorque'],
    [270, 70, 'garage:44', 'respray'],
  ] as const) {
    await use(x, y, id);
    await page.waitForFunction((k) => window.__DL__.minigame === k, kind);
    await page.evaluate(() => {
      const g = window.__DL__.minigameState as { done: boolean; grade: string };
      g.done = true;
      g.grade = 'good';
    });
    await page.waitForFunction(() => window.__DL__.minigame === null, null, { timeout: 15_000 });
    await page.waitForFunction((k) => window.__DL__.shiftDone.includes(k), kind);
  }
  // the hook catches up with the shift on the next frame
  await page.waitForFunction(() => window.__DL__.shiftDone.length === 3);
  expect(await page.evaluate(() => window.__DL__.shiftDone)).toEqual(['diagnose', 'boltTorque', 'respray']);
  await use(22, 14, 'garage:0');
  await page.waitForFunction(() => window.__DL__.bank > 0);
  expect(await page.evaluate(() => window.__DL__.objective)).toBe(
    'CHANGE OUT OF YOUR UNIFORM: A LOCKER OR YOUR WARDROBE',
  );
  expect(problems).toEqual([]);
});

test("weekend gig: three cars at Squeaky's car wash pay to the bank (milestone 8)", async ({ page }) => {
  test.setTimeout(150_000);
  const problems = await boot(page, '?scene=world&zoom=3&time=10:00');
  // day 6 is a Saturday; the wash apron's spot is in front of the pay office
  await cheat(page, 'day 6');
  await cheat(page, 'tp 994 1735');
  await page.waitForFunction(() => window.__DL__.target === 'gig:carWash');
  const bank0 = await page.evaluate(() => window.__DL__.bank);
  for (let car = 0; car < 3; car++) {
    await page.waitForTimeout(400);
    await page.keyboard.press('KeyE');
    await page.waitForFunction(() => window.__DL__.minigame === 'carWash');
    await page.waitForTimeout(500);
    // scrub a moment, then call the car done (Enter)
    await page.keyboard.down('Space');
    await page.waitForTimeout(600);
    await page.keyboard.up('Space');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__DL__.minigame === null, null, { timeout: 10_000 });
  }
  // 60% of a rank-1 office shift ($180), plus any tips in cash
  await page.waitForFunction((b) => window.__DL__.bank >= b + 108, bank0);
  expect(problems).toEqual([]);
});

test('store robbery: press the clerk, grab the till, walk out wanted (Phase 3)', async ({ page }) => {
  test.setTimeout(150_000);
  const problems = await boot(page, '?scene=world&zoom=3&area=store&time=12:00');
  await cheat(page, 'tp 205 150');
  for (let k = 0; k < 8; k++) {
    if ((await page.evaluate(() => window.__DL__.target)) === 'store:25:0') break;
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
  }
  expect(await page.evaluate(() => window.__DL__.target)).toBe('store:25:0');
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__DL__.minigame === 'intimidate');
  // keep the clerk's nerve in the band: press below the middle of it, ease off above
  let down = false;
  for (let i = 0; i < 600; i++) {
    const g = await page.evaluate(() => {
      const m = window.__DL__.minigameState as {
        nerve: number;
        band: [number, number];
        done: boolean;
      } | null;
      return window.__DL__.minigame === 'intimidate' && m ? { n: m.nerve, b: m.band, done: m.done } : null;
    });
    if (!g || g.done) break;
    const want = g.n < (g.b[0] + g.b[1]) / 2;
    if (want !== down) {
      if (want) await page.keyboard.down('Space');
      else await page.keyboard.up('Space');
      down = want;
    }
    await page.waitForTimeout(20);
  }
  if (down) await page.keyboard.up('Space');
  await page.waitForFunction(() => window.__DL__.minigame === null, null, { timeout: 10_000 });
  await page.waitForFunction(() => window.__DL__.dirty > 0);
  expect(await page.evaluate(() => window.__DL__.robbing)).toBe(true);
  await cheat(page, 'tp 170 205');
  await page.waitForFunction(() => window.__DL__.target === 'store:exit');
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__DL__.area === 'street');
  await page.waitForFunction(() => window.__DL__.stars >= 2);
  expect(await page.evaluate(() => window.__DL__.robbing)).toBe(false);
  expect(problems).toEqual([]);
});

test('ATM hack: repeat the arrows, the cassette pays dirty and earns reputation (Phase 3)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const problems = await boot(page, '?scene=world&zoom=3&x=300&y=318&time=03:00');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(150);
  await page.keyboard.up('KeyW');
  await page.waitForFunction(() => window.__DL__.target === 'atm_plaza');
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => window.__DL__.target === 'rob:atm_plaza');
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__DL__.minigame === 'atmHack');
  const KEY = { up: 'KeyW', right: 'KeyD', down: 'KeyS', left: 'KeyA' } as const;
  for (let i = 0; i < 400; i++) {
    const g = await page.evaluate(() => {
      const m = window.__DL__.minigameState as {
        sequence: ('up' | 'right' | 'down' | 'left')[];
        entered: number;
        showT: number | null;
        done: boolean;
      } | null;
      return window.__DL__.minigame === 'atmHack' && m
        ? { next: m.sequence[m.entered]!, typing: m.showT === null, done: m.done }
        : null;
    });
    if (!g || g.done) break;
    if (g.typing) await page.keyboard.press(KEY[g.next]);
    await page.waitForTimeout(40);
  }
  await page.waitForFunction(() => window.__DL__.minigame === null, null, { timeout: 10_000 });
  await page.waitForFunction(() => window.__DL__.dirty >= 800 * 0.5);
  await page.waitForFunction(() => (window.__DL__.rep ?? 0) > 0 || window.__DL__.stars > 0);
  expect(problems).toEqual([]);
});

test('house burglary: pick a Linden Avenue door, search the living room, leave with goods (Phase 3)', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const problems = await boot(page, '?scene=world&zoom=3&time=11:00&x=63&y=2342');
  await cheat(page, 'item lockpicks 10');
  for (let k = 0; k < 6; k++) {
    if ((await page.evaluate(() => window.__DL__.target)) === 'house:drop_2') break;
    await page.keyboard.press('Tab');
    await page.waitForTimeout(150);
  }
  expect(await page.evaluate(() => window.__DL__.target)).toBe('house:drop_2');
  for (let attempt = 0; attempt < 6; attempt++) {
    await page.keyboard.press('KeyE');
    await page.waitForFunction(() => window.__DL__.minigame === 'lockpick', null, { timeout: 10_000 });
    await playLockpick(page);
    const inside = await page
      .waitForFunction(() => window.__DL__.area.startsWith('house_'), null, { timeout: 6_000 })
      .then(() => true)
      .catch(() => false);
    if (inside) break;
    await page.waitForFunction(() => window.__DL__.minigame === null, null, { timeout: 20_000 });
    await page.waitForTimeout(800);
  }
  const area = await page.evaluate(() => window.__DL__.area);
  // stand in front of the living room's TV (each layout's first search)
  const tv: Record<string, string> = {
    house_bungalow: 'tp 124 144',
    house_family: 'tp 214 124',
    house_townhouse: 'tp 130 140',
  };
  await page.waitForTimeout(600);
  await cheat(page, tv[area]!);
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__DL__.minigame === 'search', null, { timeout: 10_000 });
  await page.waitForFunction(() => (window.__DL__.minigameState as { cells?: unknown })?.cells);
  const cells = await page.evaluate(() =>
    (window.__DL__.minigameState as { cells: { item: { kind: string } | null }[] }).cells
      .map((c, i) => ({ i, kind: c.item?.kind ?? 'junk' }))
      .filter((c) => c.kind !== 'junk')
      .map((c) => c.i),
  );
  for (const cell of cells) {
    for (let k = 0; k < 12; k++) {
      const g = await page.evaluate(
        () => window.__DL__.minigameState as { cursor: number; cols: number; done: boolean } | null,
      );
      if (!g || g.done || g.cursor === cell) break;
      const sameRow = Math.floor(g.cursor / g.cols) === Math.floor(cell / g.cols);
      await page.keyboard.press(sameRow ? 'ArrowRight' : 'ArrowDown');
    }
    await page.keyboard.press('Space');
  }
  await page.waitForFunction(() => window.__DL__.minigame === null, null, { timeout: 20_000 });
  const entrance: Record<string, string> = {
    house_bungalow: 'tp 211 176',
    house_family: 'tp 261 208',
    house_townhouse: 'tp 71 208',
  };
  await cheat(page, entrance[area]!);
  await page.waitForFunction((a) => window.__DL__.target === `${a}:exit`, area);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__DL__.area === 'street');
  await page.waitForFunction(() => (window.__DL__.goods ?? 0) > 0 || window.__DL__.dirty > 0);
  expect(problems).toEqual([]);
});

test('the arms dealer sells a pistol; it draws, aims and fires (Phase 4)', async ({ page }) => {
  test.setTimeout(120_000);
  const problems = await boot(page, '?scene=world&zoom=3&time=20:00&x=1705&y=440');
  await cheat(page, 'dirty 1000');
  await page.waitForFunction(() => window.__DL__.target === 'zone:arms_dealer');
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__DL__.minigame === 'arms');
  await page.waitForTimeout(400);
  // PISTOL is the third row
  await page.keyboard.press('3');
  await page.waitForFunction(() => window.__DL__.dirty === 1000 - 600);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__DL__.minigame === null);
  await page.waitForTimeout(400);
  await page.keyboard.press('Digit2');
  await page.waitForFunction(() => window.__DL__.weapon?.label === 'PISTOL');
  const clip0 = Number((await page.evaluate(() => window.__DL__.weapon!.ammo)).split('/')[0]);
  await page.mouse.move(800, 250);
  await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(300);
  await page.mouse.down({ button: 'left' });
  await page.waitForTimeout(120);
  await page.mouse.up({ button: 'left' });
  await page.mouse.up({ button: 'right' });
  await page.waitForFunction((c) => Number(window.__DL__.weapon!.ammo.split('/')[0]) === c - 1, clip0);
  expect(problems).toEqual([]);
});

test('Torque & Sons: a hot car stopped in the bay gets a respray that clears it (Phase 4)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const problems = await boot(page, '?scene=world&zoom=3&time=10:00&x=828&y=1830');
  await cheat(page, 'bank 9000');
  await cheat(page, 'car pickup_sage 828 1791 2');
  await page.waitForFunction(() => window.__DL__.target === 'car:cheat0');
  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => window.__DL__.target === 'zone:garage_service', null, { timeout: 15_000 });
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__DL__.minigame === 'service');
  await page.waitForTimeout(400);
  // RESPRAY is the seventh row (repair, five upgrades, respray)
  await page.keyboard.press('7');
  await page.waitForFunction(() => window.__DL__.bank === 9000 - 400);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__DL__.minigame === null);
  const car = await page.evaluate(() => window.__DL__.cars.find((c) => c.id === 'cheat0'));
  expect(car).toMatchObject({ hot: false });
  expect(car!.model).toMatch(/^pickup_/);
  expect(car!.model).not.toBe('pickup_sage');
  expect(problems).toEqual([]);
});

test('pulling a driver out of a stopped traffic car: yours to drive, the driver calls it in (docs/08)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const problems = await boot(page, '?scene=world&zoom=3&time=12:00');
  // a car waiting at a red light can move off while the teleport is typed: try again with another one
  let ready = false;
  for (let tries = 0; tries < 8 && !ready; tries++) {
    const pos = await page.waitForFunction(
      () => {
        const t = (window.__DL__.traffic ?? []).find((c) => c.speed < 2);
        return t ? { x: t.x + Math.sin(t.heading) * 26, y: t.y - Math.cos(t.heading) * 26 } : null;
      },
      null,
      { timeout: 60_000, polling: 100 },
    );
    const p = (await pos.jsonValue())!;
    await cheat(page, `tp ${Math.round(p.x)} ${Math.round(p.y)}`);
    ready = await page
      .waitForFunction(() => window.__DL__.target?.startsWith('jack:'), null, { timeout: 3000 })
      .then(() => true)
      .catch(() => false);
  }
  expect(ready).toBe(true);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__DL__.driving?.startsWith('jacked'));
  await page.waitForFunction(() => window.__DL__.stars > 0, null, { timeout: 40_000 });
  expect(problems).toEqual([]);
});

test('a house on Linden Avenue: buy it, go down to the basement, build the stash room, stash dirty cash (Phase 5)', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const problems = await boot(page, '?scene=world&zoom=3&time=11:00&x=176&y=2372');
  await cheat(page, 'bank 20000');
  await page.waitForFunction(() => window.__DL__.target === 'sale:linden4');
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__DL__.minigame === 'sale');
  await page.waitForTimeout(400);
  await page.keyboard.press('1');
  await page.waitForFunction(() => window.__DL__.bank === 20000 - 12000);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__DL__.minigame === null);
  await cheat(page, 'tp 196 2345');
  await page.waitForFunction(() => window.__DL__.target === 'home:linden4');
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__DL__.area === 'home_small', null, { timeout: 15_000 });
  // down the stairs from the bedroom
  await cheat(page, 'tp 30 82');
  await page.waitForFunction(() => window.__DL__.target?.startsWith('home_small:'));
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__DL__.area === 'hideout', null, { timeout: 15_000 });
  await cheat(page, 'tp 176 146');
  await page.waitForFunction(() => window.__DL__.target?.startsWith('hideout:'));
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__DL__.minigame === 'plans');
  await page.waitForTimeout(400);
  await page.keyboard.press('1');
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__DL__.minigame === null);
  await page.waitForFunction(() => window.__DL__.homes?.[0]?.addons.includes('stashRoom'));
  // the stash room's door is open now; its safe is the stash
  await cheat(page, 'dirty 900');
  await cheat(page, 'tp 30 66');
  await page.waitForFunction(() => window.__DL__.target?.startsWith('hideout:'));
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__DL__.minigame === 'stash');
  await page.waitForTimeout(400);
  await page.keyboard.press('1');
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__DL__.minigame === null);
  await page.waitForFunction(() => window.__DL__.homes?.[0]?.dirty === 900);
  expect(await page.evaluate(() => window.__DL__.dirty)).toBe(0);
  expect(problems).toEqual([]);
});

test('the counterfeit press: build it, restock it, two days later count the fake notes for a bonus (Phase 5)', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const problems = await boot(page, '?scene=world&zoom=3&time=11:00&x=574&y=2372');
  await cheat(page, 'bank 80000');
  await cheat(page, 'rep 100000');
  await cheat(page, 'dirty 1000');
  await page.waitForFunction(() => window.__DL__.target === 'sale:linden10');
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__DL__.minigame === 'sale');
  await page.waitForTimeout(400);
  await page.keyboard.press('1');
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__DL__.minigame === null);
  await cheat(page, 'tp 593 2345');
  await page.waitForFunction(() => window.__DL__.target === 'home:linden10');
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__DL__.area === 'home_family', null, { timeout: 15_000 });
  await cheat(page, 'tp 30 90');
  await page.waitForFunction(() => window.__DL__.target?.startsWith('home_family:'));
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__DL__.area === 'hideout', null, { timeout: 15_000 });
  // the plans: the press is the fourth row
  await cheat(page, 'tp 176 146');
  await page.waitForFunction(() => window.__DL__.target?.startsWith('hideout:'));
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__DL__.minigame === 'plans');
  await page.waitForTimeout(400);
  await page.keyboard.press('4');
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__DL__.homes?.[0]?.addons.includes('press'));
  await page.waitForTimeout(600);
  // restock with the carried dirty cash
  await cheat(page, 'tp 132 80');
  await page.waitForFunction(() => window.__DL__.target?.startsWith('hideout:'));
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__DL__.minigame === 'press');
  await page.waitForTimeout(400);
  await page.keyboard.press('1');
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__DL__.homes?.[0]?.ops.press?.running === true);
  expect(await page.evaluate(() => window.__DL__.dirty)).toBe(0);
  // two days on, collect: the money count first
  await cheat(page, 'day 3');
  await page.waitForFunction(() => (window.__DL__.homes?.[0]?.ops.press?.ready ?? 0) > 0);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__DL__.minigame === 'press');
  await page.waitForTimeout(400);
  await page.keyboard.press('1');
  await page.waitForFunction(() => window.__DL__.minigame === 'moneyCount');
  await page.waitForTimeout(400);
  for (let b = 0; b < 3; b++) {
    for (let k = 0; k < 10; k++) await page.keyboard.press('Space');
    await page.keyboard.press('KeyB');
  }
  await page.waitForFunction(() => window.__DL__.minigame === null, null, { timeout: 20_000 });
  await page.waitForFunction(() => window.__DL__.dirty > 2600);
  expect(problems).toEqual([]);
});
