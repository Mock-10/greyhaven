// Screenshot script (docs/14): builds nothing itself; serves dist/ with `vite preview`, opens each
// shot's URL in headless Chromium, waits for the game's ready flag, and saves PNGs to shots/.
// Usage: npm run build && npm run shots [-- name ...]

import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:4173/greyhaven/';

interface Shot {
  name: string;
  query: string;
  /** Cheat-console lines to run first (Ctrl + Shift + F1), e.g. to place a car. */
  cheats?: string[];
  width: number;
  height: number;
  /** Click to start (leaves the title screen). */
  start?: boolean;
  /** Keys to hold, each for the given milliseconds. */
  hold?: [string, number][];
  wait?: number;
}

const SHOTS: Shot[] = [
  { name: 'title', query: '?seed=1', width: 1280, height: 720 },
  { name: 'downtown_2x', query: '?scene=world&seed=1&zoom=2', width: 1280, height: 720 },
  { name: 'downtown_3x_1080p', query: '?scene=world&seed=1', width: 1920, height: 1080 },
  { name: 'downtown_overview', query: '?scene=world&zoom=1&x=768&y=768', width: 2400, height: 1500 },
  { name: 'plaza_3x', query: '?scene=world&zoom=3&x=300&y=420', width: 1920, height: 1080 },
  { name: 'bend_3x', query: '?scene=world&zoom=3&x=1180&y=900', width: 1920, height: 1080 },
  { name: 'drizzle_row_2x', query: '?scene=world&zoom=2&x=700&y=1110', width: 1280, height: 720 },
  { name: 'downtown_dusk', query: '?scene=world&zoom=2&time=19:45&x=860&y=1110', width: 1280, height: 720 },
  { name: 'downtown_night', query: '?scene=world&zoom=2&time=23:30&x=300&y=440', width: 1280, height: 720 },
  {
    name: 'atm_target',
    query: '?scene=world&zoom=3&x=300&y=318',
    width: 1280,
    height: 720,
    hold: [['KeyW', 120]],
  },
  {
    name: 'door_target',
    query: '?scene=world&zoom=3&x=862&y=1100',
    width: 1280,
    height: 720,
    hold: [['KeyW', 120]],
  },
  {
    name: 'walk_sprint',
    query: '?scene=world&zoom=3',
    width: 1280,
    height: 720,
    hold: [['Shift+KeyD', 900]],
    wait: 200,
  },
  { name: 'pump_and_go_2x', query: '?scene=world&zoom=2&time=15:00&x=1640&y=1340', width: 1280, height: 720 },
  {
    name: 'pump_and_go_under_canopy',
    query: '?scene=world&zoom=2&time=15:00&x=1708&y=1440',
    width: 1280,
    height: 720,
    cheats: ['car sedan_teal 1638 1394 0', 'car van_white 1779 1486 4', 'car taxi 1779 1394 0'],
    wait: 1200,
  },
  {
    name: 'pump_and_go_dusk',
    query: '?scene=world&zoom=2&time=20:30&x=1560&y=1340',
    width: 1280,
    height: 720,
  },
  {
    name: 'marlo_spot_3x',
    query: '?scene=world&zoom=3&time=15:00&x=1590&y=1060',
    width: 1280,
    height: 720,
    cheats: ['car taxi 1611 1013 0'],
    wait: 800,
  },
  {
    name: 'drive_lead_1080p',
    query: '?scene=world&time=11:00&x=700&y=652',
    width: 1920,
    height: 1080,
    cheats: ['car sedan_teal 744 652 0'],
    hold: [
      ['KeyF', 120],
      ['KeyW', 2200],
    ],
    wait: 300,
  },
  { name: 'default_view_1080p', query: '?scene=world&time=11:00&x=860&y=1100', width: 1920, height: 1080 },
  { name: 'silhouette_tower', query: '?scene=world&zoom=3&x=150&y=200', width: 1280, height: 720, wait: 900 },
  {
    name: 'cars_side_by_side',
    query: '?scene=world&zoom=3&time=11:00&x=820&y=250',
    width: 1280,
    height: 720,
    cheats: ['car van_white 860 300 1', 'car taxi 905 255 1'],
    wait: 600,
  },
  { name: 'gullsway_2x', query: '?scene=world&zoom=2&time=11:00&x=1980&y=520', width: 1280, height: 720 },
  { name: 'new_nw_2x', query: '?scene=world&zoom=2&time=11:00&x=420&y=330', width: 1280, height: 720 },
  { name: 'new_sw_2x', query: '?scene=world&zoom=2&time=11:00&x=560&y=1360', width: 1280, height: 720 },
  { name: 'new_s_2x', query: '?scene=world&zoom=2&time=11:00&x=1000&y=1340', width: 1280, height: 720 },
  { name: 'new_ne_2x', query: '?scene=world&zoom=2&time=11:00&x=1640&y=420', width: 1280, height: 720 },
  { name: 'new_mid_2x', query: '?scene=world&zoom=2&time=11:00&x=880&y=940', width: 1280, height: 720 },
  { name: 'new_night_2x', query: '?scene=world&zoom=2&time=22:30&x=1640&y=420', width: 1280, height: 720 },
  {
    name: 'entrance_outline',
    query: '?scene=world&zoom=3&time=11:00&x=862&y=1112',
    width: 1280,
    height: 720,
    wait: 900,
  },
  {
    name: 'police_arrive',
    query: '?scene=world&zoom=2&time=12:00&x=560&y=1180',
    width: 1280,
    height: 720,
    cheats: ['stars 1'],
    wait: 3200,
  },
  {
    name: 'police_search',
    query: '?scene=world&zoom=2&time=16:00&x=900&y=1180',
    width: 1280,
    height: 720,
    cheats: ['stars 2'],
    wait: 5000,
  },
  {
    name: 'traffic_day',
    query: '?scene=world&zoom=2&time=08:30&x=700&y=640',
    width: 1280,
    height: 720,
    wait: 4000,
  },
  {
    name: 'traffic_dusk',
    query: '?scene=world&zoom=2&time=19:30&x=1180&y=1180',
    width: 1280,
    height: 720,
    wait: 4000,
  },
  { name: 'reference_1x', query: '?scene=reference', width: 1900, height: 1280 },
  { name: 'depth_behind_tower', query: '?scene=world&zoom=3&x=150&y=200&debug=1', width: 1280, height: 720 },
  { name: 'camera_edge', query: '?scene=world&zoom=2&x=40&y=40', width: 1280, height: 720 },
  // interiors (milestone 2)
  {
    name: 'in_office',
    query: '?scene=world&zoom=3&area=office_floor&time=08:30',
    width: 1920,
    height: 1080,
    wait: 600,
  },
  {
    name: 'in_lobby',
    query: '?scene=world&zoom=3&area=tower_lobby&time=09:00',
    width: 1920,
    height: 1080,
    wait: 600,
  },
  { name: 'in_bar', query: '?scene=world&zoom=3&area=bar&time=20:00', width: 1920, height: 1080, wait: 600 },
  {
    name: 'in_bar_sight_off',
    query: '?scene=world&zoom=3&area=bar&time=20:00&sight=0',
    width: 1920,
    height: 1080,
    wait: 600,
  },
  {
    name: 'in_store',
    query: '?scene=world&zoom=3&area=store&time=10:00',
    width: 1920,
    height: 1080,
    wait: 600,
  },
  {
    name: 'in_apartment',
    query: '?scene=world&zoom=3&area=apartment&time=22:00',
    width: 1920,
    height: 1080,
    wait: 600,
  },
];

async function waitForServer(url: string, ms: number): Promise<void> {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`server did not start at ${url}`);
}

async function main(): Promise<void> {
  const only = process.argv.slice(2);
  mkdirSync('shots', { recursive: true });
  // Own process group, so the whole tree (npx and vite) can be stopped afterwards.
  const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
    stdio: 'ignore',
    detached: true,
  });
  try {
    await waitForServer(BASE, 30_000);
    const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
    for (const s of SHOTS.filter((s) => only.length === 0 || only.includes(s.name))) {
      const page = await browser.newPage({ viewport: { width: s.width, height: s.height } });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      await page.goto(BASE + s.query);
      await page.waitForFunction(() => window.__DL__?.ready === true, null, { timeout: 30_000 });
      if (s.start) await page.mouse.click(s.width / 2, s.height / 2);
      if (s.cheats?.length) {
        await page.keyboard.press('Control+Shift+F1');
        for (const line of s.cheats) {
          await page.keyboard.type(line);
          await page.keyboard.press('Enter');
        }
        await page.keyboard.press('Escape');
      }
      for (const [key, ms] of s.hold ?? []) {
        const parts = key.split('+');
        for (const p of parts) await page.keyboard.down(p);
        await page.waitForTimeout(ms);
        for (const p of parts.reverse()) await page.keyboard.up(p);
      }
      await page.waitForTimeout(s.wait ?? 400);
      await page.screenshot({ path: `shots/${s.name}.png` });
      const info = await page.evaluate(() => ({ zoom: window.__DL__.zoom, walker: window.__DL__.walker }));
      console.log(
        `${s.name}: zoom ${info.zoom}`,
        info.walker ?? '',
        errors.length ? `ERRORS: ${errors.join(' | ')}` : '',
      );
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
