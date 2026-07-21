import { defineConfig, devices } from '@playwright/test';

// Port 3210, not 3000: other local projects commonly hold 3000, and a dev
// server bound only to IPv6 [::1] is invisible to Chromium, which resolves
// localhost to 127.0.0.1. Run the dev server with `--hostname 127.0.0.1
// --port 3210`.
//
// Addressed as "localhost" rather than the raw IP on purpose: the app shows a
// dev-only Google sign-in notice on 127.0.0.1, which would otherwise be baked
// into the login baseline as permanent noise.
const baseURL = (process.env.ORBIT_LEDGER_VISUAL_URL || 'http://localhost:3210').replace(/\/+$/, '');

/**
 * Visual regression baselines for the reskin.
 *
 * These exist so the globals.css rewrite can be verified screen by screen:
 * every run diffs the rendered UI against committed baselines, so a selector
 * that silently stops matching shows up as a picture instead of a bug report
 * from production.
 */
export default defineConfig({
  testDir: './tests/visual',
  outputDir: './artifacts/visual-results',
  snapshotPathTemplate: './tests/visual/__baselines__/{projectName}/{testFilePath}/{arg}{ext}',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // One retry everywhere. Roughly one run in three still sees a single flaky
  // screen from render timing under parallel load; a real regression fails both
  // attempts, so this absorbs the noise without hiding breakage. Anything that
  // shows up as "flaky" in the report is worth investigating rather than
  // ignoring.
  retries: 1,
  // Two workers, not more. Every worker drives the same Next dev server and the
  // single functions emulator; at 4 the admin-console snapshot calls contended
  // badly enough to blow the per-test timeout, so higher parallelism produced
  // timeouts instead of throughput.
  workers: 2,
  // Generous, because a cold Next dev route compile plus a full-page screenshot
  // of a 3,000-line screen genuinely exceeds the 30s default.
  timeout: 90_000,
  reporter: [['html', { outputFolder: './artifacts/visual-report', open: 'never' }], ['list']],

  expect: {
    // The 5s default is not enough to capture the tallest screens: settings
    // stacked into a 390px viewport is a very long full-page screenshot, and
    // the capture itself was timing out before any comparison happened.
    timeout: 30_000,
    toHaveScreenshot: {
      // Deliberately tight. A full-page screenshot is tall, so a percentage
      // tolerance hides real changes: at 1%, recoloring every primary button on
      // the landing page still passes. Accent-sized changes must fail.
      maxDiffPixels: 120,
      animations: 'disabled',
      scale: 'css',
    },
  },

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [
    // Signs in once; the viewport projects depend on it. Named separately so it
    // never owns a baseline image.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      dependencies: ['setup'],
    },
    {
      name: 'tablet',
      use: { ...devices['Desktop Chrome'], viewport: { width: 834, height: 1112 } },
      dependencies: ['setup'],
    },
    {
      name: 'mobile',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
      dependencies: ['setup'],
    },
  ],
});
