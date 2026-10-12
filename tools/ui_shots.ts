// UI screenshots (UI redesign 2026-10-12): opens each panel the way a player would and saves PNGs to shots/ui/.
// Usage: npm run build && node tools/ui_shots.ts [name ...]   (starts and stops its own preview server)

import { chromium, type Page } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:4174/greyhaven/';

async function cheat(page: Page, lines: string[]): Promise<void> {
  await page.keyboard.press('Control+Shift+F1');
  for (const l of lines) {
    await page.keyboard.type(l);
    await page.keyboard.press('Enter');
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

async function tabTo(page: Page, prefix: string): Promise<void> {
  for (let k = 0; k < 8; k++) {
    if ((await page.evaluate(() => window.__DL__.target))?.startsWith(prefix)) return;
    await page.keyboard.press('Tab');
    await page.waitForTimeout(150);
  }
}

const ITEMS = [
  'item firstaid 2',
  'item lockpicks 7',
  'item fuelcans 1',
  'item repairkits 1',
  'item toolbox 1',
  'bank 640',
  'cash 250',
];

const SHOTS: Record<string, { query: string; run: (p: Page) => Promise<void> }> = {
  hud_message: {
    query: '?scene=world&zoom=2&time=17:29&x=860&y=1100',
    run: async (p) => {
      await p.waitForFunction(() => window.__DL__.minutes % 1440 > 17 * 60 + 30.2, null, { timeout: 30_000 });
      await p.waitForTimeout(300);
    },
  },
  phone_home: {
    query: '?scene=world&zoom=2&time=11:00&x=300&y=318',
    run: async (p) => {
      await cheat(p, ITEMS);
      await p.keyboard.press('KeyP');
      await p.waitForFunction(() => window.__DL__.minigame === 'phone');
    },
  },
  phone_messages: {
    query: '?scene=world&zoom=2&time=17:29&x=300&y=318',
    run: async (p) => {
      await p.waitForFunction(() => window.__DL__.minutes % 1440 > 17 * 60 + 31, null, { timeout: 30_000 });
      await cheat(p, ['day 8']);
      await p.waitForTimeout(800);
      await p.keyboard.press('KeyP');
      await p.waitForFunction(() => window.__DL__.minigame === 'phone');
      await p.waitForTimeout(400);
      await p.keyboard.press('Enter');
    },
  },
  phone_bank: {
    query: '?scene=world&zoom=2&time=11:00&x=300&y=318',
    run: async (p) => {
      await cheat(p, ITEMS);
      await p.keyboard.press('KeyP');
      await p.waitForFunction(() => window.__DL__.minigame === 'phone');
      await p.waitForTimeout(400);
      await p.keyboard.press('ArrowRight');
      await p.keyboard.press('Enter');
    },
  },
  phone_contacts: {
    query: '?scene=world&zoom=2&time=11:00&x=300&y=318',
    run: async (p) => {
      await p.keyboard.press('KeyP');
      await p.waitForFunction(() => window.__DL__.minigame === 'phone');
      await p.waitForTimeout(400);
      await p.keyboard.press('4');
    },
  },
  phone_jobs: {
    query: '?scene=world&zoom=2&time=11:00&x=300&y=318',
    run: async (p) => {
      await p.keyboard.press('KeyP');
      await p.waitForFunction(() => window.__DL__.minigame === 'phone');
      await p.waitForTimeout(400);
      await p.keyboard.press('3');
    },
  },
  bag: {
    query: '?scene=world&zoom=2&time=11:00&x=300&y=318',
    run: async (p) => {
      await cheat(p, ITEMS);
      await p.keyboard.press('KeyI');
      await p.waitForFunction(() => window.__DL__.minigame === 'bag');
    },
  },
  atm: {
    query: '?scene=world&zoom=3&time=11:00&x=300&y=318',
    run: async (p) => {
      await cheat(p, ['bank 640']);
      await p.keyboard.down('KeyW');
      await p.waitForTimeout(120);
      await p.keyboard.up('KeyW');
      await tabTo(p, 'atm');
      await p.keyboard.press('KeyE');
      await p.waitForFunction(() => window.__DL__.minigame === 'atm');
    },
  },
  shop: {
    query: '?scene=world&zoom=3&area=store&time=10:00',
    run: async (p) => {
      // walk toward the counter until it's in reach, then use it
      for (const k of ['KeyD', 'KeyD', 'KeyS']) {
        await p.keyboard.down(k);
        await p.waitForTimeout(600);
        await p.keyboard.up(k);
      }
      for (let k = 0; k < 16; k++) {
        const t = await p.evaluate(() => window.__DL__.target ?? '');
        if (t && t !== 'store:exit') {
          await p.keyboard.press('KeyE');
          await p.waitForTimeout(500);
          if ((await p.evaluate(() => window.__DL__.minigame)) === 'shop') break;
          await p.keyboard.press('Tab');
        } else {
          await p.keyboard.down('KeyW');
          await p.waitForTimeout(120);
          await p.keyboard.up('KeyW');
        }
        await p.waitForTimeout(150);
      }
    },
  },
  lockpick: {
    query: '?scene=world&zoom=3&time=04:00&x=841&y=184',
    run: async (p) => {
      await cheat(p, ['item lockpicks 7']);
      await p.keyboard.down('KeyA');
      await p.waitForTimeout(150);
      await p.keyboard.up('KeyA');
      await tabTo(p, 'car:');
      await p.keyboard.press('KeyE');
      await p.waitForFunction(() => window.__DL__.minigame === 'lockpick');
      await p.waitForTimeout(500);
    },
  },
  menu: {
    query: '?scene=world&zoom=3&area=apartment&time=21:00',
    run: async (p) => {
      await p.keyboard.press('Escape');
      await p.waitForFunction(() => window.__DL__.minigame === 'menu');
      await p.waitForTimeout(600);
    },
  },
  driving: {
    query: '?scene=world&zoom=3&time=16:00&x=841&y=184',
    run: async (p) => {
      await cheat(p, ['car sedan_lav 870 150 0']);
      await p.waitForTimeout(500);
      await p.keyboard.press('KeyF');
      await p.waitForFunction(() => window.__DL__.driving !== null, null, { timeout: 10_000 });
      await p.keyboard.down('KeyW');
      await p.waitForTimeout(900);
      await p.keyboard.up('KeyW');
    },
  },
};

async function main(): Promise<void> {
  const only = process.argv.slice(2);
  mkdirSync('shots/ui', { recursive: true });
  const server = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], {
    stdio: 'ignore',
    detached: true,
  });
  try {
    for (let t = 0; t < 120; t++) {
      try {
        if ((await fetch(BASE)).ok) break;
      } catch {
        // not up yet
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
    for (const [name, s] of Object.entries(SHOTS)) {
      if (only.length && !only.includes(name)) continue;
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(BASE + s.query);
      await page.waitForFunction(() => window.__DL__?.ready === true, null, { timeout: 30_000 });
      await page.waitForTimeout(500);
      try {
        await s.run(page);
      } catch (e) {
        errors.push(String(e));
      }
      await page.waitForTimeout(500);
      await page.screenshot({ path: `shots/ui/${name}.png` });
      console.log(name, errors.length ? `ERRORS: ${errors.join(' | ')}` : 'ok');
      await page.close();
    }
    await browser.close();
  } finally {
    if (server.pid) process.kill(-server.pid, 'SIGTERM');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
