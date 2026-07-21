import { expect, test } from '@playwright/test';

import { FROZEN_CLOCK, publicRoutes, stabilize } from './routes';

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: FROZEN_CLOCK });
});

for (const route of publicRoutes) {
  test(`public: ${route.name}`, async ({ page }) => {
    const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), `${route.path} should not error`).toBeLessThan(400);

    await stabilize(page);
    await expect(page).toHaveScreenshot(`${route.name}.png`, { fullPage: true });
  });
}
