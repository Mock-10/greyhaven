// Screenshots of the animation and effects pass (docs/13 "Effects", docs/11 "UI animation"): each scenario
// opens the game, runs a few steps (keys held, cheats, waits) and takes screenshots mid-action, so effects
// that only exist for a moment (dust, skids, a panel unfolding) are caught.
// Usage: npm run build && node tools/fx_shots.ts [scenario ...]

import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:4173/greyhaven/';

type Step =
  | { down: string }
  | { up: string }
  | { press: string }
  | { wait: number }
  | { shot: string }
  | { cheat: string[] }
  | { eval: string };

interface Scenario {
  name: string;
  query: string;
  width?: number;
  height?: number;
  steps: Step[];
}

const SCENARIOS: Scenario[] = [
  {
    name: 'sprint_dust',
    query: '?scene=world&zoom=3&time=11:00&x=700&y=1110',
    steps: [
      { wait: 400 },
      { down: 'Shift' },
      { down: 'KeyS' },
      { wait: 900 },
      { shot: 'sprint_dust' },
      { up: 'KeyS' },
      { up: 'Shift' },
    ],
  },
  {
    name: 'drive_skid',
    query: '?scene=world&zoom=2&time=11:00&x=700&y=652',
    steps: [
      { cheat: ['car sedan_teal 744 652 0'] },
      { down: 'KeyF' },
      { wait: 150 },
      { up: 'KeyF' },
      { wait: 300 },
      { shot: 'exhaust_idle' },
      { down: 'KeyW' },
      { wait: 2000 },
      { up: 'KeyW' },
      { down: 'KeyS' },
      { wait: 250 },
      { shot: 'brake_skid' },
      { up: 'KeyS' },
    ],
  },
  {
    name: 'rain',
    query: '?scene=world&zoom=2&time=21:00&x=860&y=1110&rain=1',
    steps: [{ wait: 1500 }, { shot: 'rain_night' }],
  },
  {
    name: 'rain_day',
    query: '?scene=world&zoom=3&time=15:00&x=300&y=420&rain=1',
    steps: [{ wait: 1500 }, { shot: 'rain_day_3x' }],
  },
  {
    name: 'hud',
    query: '?scene=world&zoom=3&time=11:00&x=700&y=1110',
    steps: [
      { wait: 600 },
      { cheat: ['cash 640', 'stars 2'] },
      { wait: 120 },
      { shot: 'hud_cash_stars' },
      { wait: 900 },
      { shot: 'hud_cash_after' },
    ],
  },
  {
    name: 'phone',
    query: '?scene=world&zoom=3&time=11:00&x=700&y=1110',
    steps: [
      { wait: 600 },
      { press: 'KeyP' },
      { wait: 40 },
      { shot: 'phone_opening' },
      { wait: 700 },
      { shot: 'phone_open' },
    ],
  },
  {
    name: 'atm',
    query: '?scene=world&zoom=3&x=300&y=318',
    steps: [
      { down: 'KeyW' },
      { wait: 120 },
      { up: 'KeyW' },
      { wait: 300 },
      { press: 'KeyE' },
      { wait: 700 },
      { shot: 'atm_typing' },
    ],
  },
  {
    name: 'idle',
    query: '?scene=world&zoom=4&time=11:00&x=700&y=1110',
    steps: [{ wait: 2500 }, { shot: 'idle_breathe' }],
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
  mkdirSync('shots/fx', { recursive: true });
  const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
    stdio: 'ignore',
    detached: true,
  });
  try {
    await waitForServer(BASE, 30_000);
    const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
    for (const s of SCENARIOS.filter((s) => only.length === 0 || only.includes(s.name))) {
      const page = await browser.newPage({ viewport: { width: s.width ?? 1280, height: s.height ?? 720 } });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) =>
        m.type() === 'error' ? errors.push(m.text()) : m.text().startsWith('{') && console.log(m.text()),
      );
      await page.goto(BASE + s.query);
      await page.waitForFunction(() => window.__DL__?.ready === true, null, { timeout: 30_000 });
      for (const st of s.steps) {
        if ('down' in st) await page.keyboard.down(st.down);
        else if ('up' in st) await page.keyboard.up(st.up);
        else if ('press' in st) await page.keyboard.press(st.press);
        else if ('wait' in st) await page.waitForTimeout(st.wait);
        else if ('eval' in st) await page.evaluate(st.eval);
        else if ('cheat' in st) {
          await page.keyboard.press('Control+Shift+F1');
          for (const line of st.cheat) {
            await page.keyboard.type(line);
            await page.keyboard.press('Enter');
          }
          await page.keyboard.press('Escape');
        } else if ('shot' in st) {
          await page.screenshot({ path: `shots/fx/${st.shot}.png` });
          console.log(`${s.name}: ${st.shot}`, errors.length ? `ERRORS: ${errors.join(' | ')}` : '');
        }
      }
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
