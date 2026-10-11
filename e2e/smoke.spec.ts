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

test('boots, starts from the title and moves the walker', async ({ page }) => {
  const problems = await boot(page, '?seed=1');
  expect(await page.evaluate(() => window.__DL__.started)).toBe(false);
  await page.mouse.click(640, 360);
  await page.waitForFunction(() => window.__DL__.started === true);

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
  await page.keyboard.press('KeyE');
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
    for (let n = 0; n < 12; n++) {
      const sample = () =>
        page.evaluate(() => {
          const g = window.__DL__.minigameState as { needle: number; zone: number; done: boolean } | null;
          return { t: performance.now(), needle: g?.needle ?? 0, zone: g?.zone ?? 0, done: g?.done ?? true };
        });
      const a = await sample();
      await page.waitForTimeout(400);
      const b = await sample();
      if (b.done || (await page.evaluate(() => window.__DL__.minigame)) !== 'lockpick') break;
      const rate = ((((b.needle - a.needle) % 360) + 360) % 360) / (b.t - a.t);
      const ahead = (((b.zone - b.needle) % 360) + 360) % 360;
      await page.waitForTimeout(Math.max(0, ahead / rate - 60));
      await page.keyboard.press('Space');
      await page.waitForTimeout(500);
    }
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
