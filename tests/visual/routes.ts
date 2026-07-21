import type { Page } from '@playwright/test';

/** Where auth.setup.ts stores the shared signed-in session. */
export const AUTH_STATE_PATH = 'artifacts/.auth/workspace-owner.json';

/**
 * Instant the browser clock is frozen at, matching SEED_EPOCH in
 * scripts/seed-web-qa-workspace.mjs.
 *
 * Relative timestamps ("Active recently", "due in 7 days") are computed against
 * the current time, so a live clock makes those pixels differ on every run.
 * Freezing both sides to the same instant is what makes them reproducible.
 */
export const FROZEN_CLOCK = new Date('2026-07-15T10:00:00.000Z');

/**
 * Credentials for the seeded emulator workspace.
 *
 * These are emulator-only defaults, matching scripts/seed-web-qa-workspace.mjs.
 * They are not a secret: the Firebase emulator accepts any credentials and
 * holds no real data. Running against a live project instead requires setting
 * both variables explicitly.
 */
export function emulatorCredentials() {
  return {
    email: process.env.ORBIT_LEDGER_QA_EMAIL?.trim() || 'qa.owner@orbit-ledger.test',
    password: process.env.ORBIT_LEDGER_QA_PASSWORD?.trim() || 'emulator-only-password',
  };
}

export type VisualRoute = {
  /** Slug used for the baseline image filename. */
  name: string;
  path: string;
};

/** Routes reachable without signing in. */
export const publicRoutes: VisualRoute[] = [
  { name: 'landing', path: '/' },
  { name: 'login', path: '/login/' },
  { name: 'contact', path: '/contact/' },
  { name: 'privacy', path: '/privacy/' },
  { name: 'terms', path: '/terms/' },
  { name: 'refunds', path: '/refunds/' },
  { name: 'template-preview', path: '/template-preview/' },
];

/** Routes behind workspace auth. These are the screens the reskin changes most. */
export const workspaceRoutes: VisualRoute[] = [
  { name: 'dashboard', path: '/dashboard/' },
  { name: 'invoices', path: '/invoices/' },
  { name: 'invoices-automation', path: '/invoices/automation/' },
  { name: 'customers', path: '/customers/' },
  { name: 'customers-new', path: '/customers/new/' },
  { name: 'transactions', path: '/transactions/' },
  { name: 'payments', path: '/payments/' },
  { name: 'products', path: '/products/' },
  { name: 'reports', path: '/reports/' },
  { name: 'documents', path: '/documents/' },
  { name: 'templates', path: '/templates/' },
  { name: 'team', path: '/team/' },
  { name: 'market', path: '/market/' },
  { name: 'support', path: '/support/' },
  { name: 'backup', path: '/backup/' },
  { name: 'settings', path: '/settings/' },
];

/** Admin and operations consoles. */
export const backofficeRoutes: VisualRoute[] = [
  { name: 'backoffice', path: '/backoffice/' },
  { name: 'backoffice-platform', path: '/backoffice/platform/' },
  { name: 'backoffice-operations', path: '/backoffice/operations/' },
];

/**
 * Freeze everything that would otherwise differ between two runs of the same
 * build: clock-derived copy, spinners, carousels, and caret blink. Without this
 * the baselines fail for reasons that have nothing to do with the reskin.
 */
export async function stabilize(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
      html { scroll-behavior: auto !important; }
    `,
  });

  // Let webfonts settle so text metrics are stable.
  await page.evaluate(() => document.fonts?.ready);

  // Bounded on purpose. Firestore holds a long-lived Listen channel open on
  // every signed-in screen, so "networkidle" never fires there and an unbounded
  // wait hangs until the test times out. This settles genuinely-idle pages fast
  // and gives up quickly on the streaming ones.
  await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => {});

  await waitForWorkspaceReady(page);
}

/**
 * Waits out the workspace bootstrap before a screenshot is taken.
 *
 * Signed-in routes briefly render a "Preparing your workspace" screen while the
 * profile loads. A fixed sleep raced it: roughly a fifth of baselines captured
 * the loader instead of the page, which showed up as ~300k-pixel diffs between
 * two runs of identical code. Waiting on the loader actually leaving is the
 * only version of this that is deterministic.
 */
async function waitForWorkspaceReady(page: Page) {
  const loaders = ['.ol-loading-page', '.ol-brand-orbit-loader', '.ol-auth-loading-card'];

  for (const selector of loaders) {
    await page
      .locator(selector)
      .first()
      .waitFor({ state: 'detached', timeout: 30_000 })
      .catch(() => {
        // Never present on this route, or genuinely persistent. Either way the
        // remaining settle below still applies.
      });
  }

  await waitForAsyncPanelsSettled(page);

  // Fixed settle for list rows and chart values that paint just after the
  // loader clears. Driven by Playwright's own timer, so the frozen page clock
  // does not affect it.
  await page.waitForTimeout(1_200);

  // Stop timer-driven motion before the screenshot. Playwright's
  // `animations: 'disabled'` only freezes CSS animations and transitions; the
  // market page cycles its template showcase from a setInterval, which kept it
  // from ever producing two identical consecutive frames.
  await page.clock.pauseAt(FROZEN_CLOCK).catch(() => {
    // Clock not installed for this context - nothing to pause.
  });
}

/**
 * Waits for panels that fetch their own data after the shell has rendered.
 *
 * The back-office consoles paint their chrome immediately and fill the body
 * once a snapshot call returns. Waiting for a loading *indicator* to disappear
 * does not work: the placeholder copy has not even mounted at the moment the
 * check first runs, so the wait passes instantly and the operations baseline
 * was captured with an entirely empty main area - its diff then measured
 * empty-versus-loaded rather than anything the reskin did.
 *
 * So this waits for the rendered text to stop changing instead, which needs no
 * per-screen knowledge and cannot be invalidated by copy edits.
 */
async function waitForAsyncPanelsSettled(page: Page) {
  // The back-office consoles paint their sidebar and header immediately, then
  // fill the main column once a snapshot Cloud Function returns (~2s idle, more
  // under load). There is no loader element to wait on, and the operations
  // baseline was otherwise captured as an empty shell - its diff would have
  // measured empty-versus-loaded rather than anything the reskin did.
  //
  // The loaded state renders several .ol-panel blocks in the main area; the
  // empty shell renders none. Waiting for a handful to exist is a concrete
  // "content arrived" signal that needs no per-screen copy knowledge. Pages
  // that never render panels (or fewer) simply hit the short timeout and are
  // screenshotted as-is - correct for them, since they have no async body.
  await page
    .locator('main .ol-panel')
    .nth(2)
    .waitFor({ state: 'attached', timeout: 15_000 })
    .catch(() => {});
}
