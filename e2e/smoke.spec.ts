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
