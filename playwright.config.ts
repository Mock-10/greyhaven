import { defineConfig, devices } from '@playwright/test';

// Smoke test against the production build (base /greyhaven/), so broken asset paths fail here
// before they reach GitHub Pages.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173/greyhaven/',
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173/greyhaven/',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
