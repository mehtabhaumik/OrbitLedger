import { expect, test } from '@playwright/test';

import { AUTH_STATE_PATH, backofficeRoutes, FROZEN_CLOCK, stabilize, workspaceRoutes } from './routes';

// Reuses the session captured by auth.setup.ts instead of signing in per test.
test.use({ storageState: AUTH_STATE_PATH });

// Must be installed before navigation, so the app never observes a live clock.
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: FROZEN_CLOCK });
});

for (const route of [...workspaceRoutes, ...backofficeRoutes]) {
  test(`auth: ${route.name}`, async ({ page }) => {
    const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), `${route.path} should not error`).toBeLessThan(400);

    // Guard against silently screenshotting a redirect to login, which would
    // bake a useless baseline for every protected route.
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });

    await stabilize(page);
    await expect(page).toHaveScreenshot(`${route.name}.png`, { fullPage: true });
  });
}
