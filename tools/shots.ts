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
  { name: 'downtown_overview', query: '?scene=world&zoom=1&x=760&y=700', width: 2400, height: 1500 },
  { name: 'downtown_dusk', query: '?scene=world&zoom=2&time=19:45&x=860&y=1180', width: 1280, height: 720 },
  { name: 'downtown_night', query: '?scene=world&zoom=2&time=23:30&x=860&y=1180', width: 1280, height: 720 },
  {
    name: 'atm_target',
    query: '?scene=world&zoom=3&x=432&y=410',
    width: 1280,
    height: 720,
    hold: [['KeyD', 120]],
  },
  {
    name: 'door_target',
    query: '?scene=world&zoom=3&x=930&y=1095',
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
  { name: 'reference_1x', query: '?scene=reference', width: 1900, height: 1280 },
  { name: 'depth_behind_tower', query: '?scene=world&zoom=3&x=150&y=130&debug=1', width: 1280, height: 720 },
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
