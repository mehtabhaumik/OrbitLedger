import { expect, test } from '@playwright/test';

import { AUTH_STATE_PATH, FROZEN_CLOCK, stabilize } from './routes';

/**
 * Layout invariants for the operations three-pane console.
 *
 * These are behavioural, not pixel, checks: the baselines prove what the panes
 * look like, this proves the geometry that makes them look that way. The rail
 * used to run far taller than the ticket list and detail pane, so the grid row
 * took the rail's height and left a large empty region beside the short panes.
 * Capping the rail to the viewport is what bounds the row - if that regresses,
 * the void comes back, and a screenshot diff alone would not say why.
 */

test.use({ storageState: AUTH_STATE_PATH });

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: FROZEN_CLOCK });
});

// Every section that renders the support-console shell.
const SHELL_SECTIONS = ['support-inbox', 'assignments', 'diagnostics-consent', 'audit'];

for (const section of SHELL_SECTIONS) {
  test(`three-pane console geometry: ${section}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/backoffice/operations/${section}/`, { waitUntil: 'domcontentloaded' });
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
    await stabilize(page);

    const rail = page.locator('.ol-support-center-sidebar');
    await expect(rail).toBeVisible();

    const geometry = await rail.evaluate((el) => {
      const style = getComputedStyle(el);
      const shell = el.closest('.ol-support-center-shell');
      const height = (selector: string) => {
        const node = shell?.querySelector(selector);
        return node ? Math.round(node.getBoundingClientRect().height) : null;
      };
      return {
        position: style.position,
        overflowY: style.overflowY,
        railHeight: Math.round(el.getBoundingClientRect().height),
        listHeight: height('.ol-support-center-listpane'),
        detailHeight: height('.ol-support-center-detailpane'),
      };
    });

    // The rail stays put while the working panes scroll.
    expect(geometry.position).toBe('sticky');
    expect(geometry.overflowY).toBe('auto');

    // Bounded to the viewport, so the row can never be dragged taller than one
    // screen no matter how much telemetry the rail accumulates.
    expect(geometry.railHeight).toBeLessThanOrEqual(900);

    // The panes share the row height: that is what removes the void beside a
    // short ticket list. Allowing 1px for sub-pixel rounding.
    expect(geometry.listHeight).not.toBeNull();
    expect(geometry.detailHeight).not.toBeNull();
    expect(Math.abs((geometry.listHeight ?? 0) - (geometry.detailHeight ?? 0))).toBeLessThanOrEqual(1);
  });
}

test('support rail scrolls its own overflow instead of growing the page', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/backoffice/operations/support-inbox/', { waitUntil: 'domcontentloaded' });
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
  await stabilize(page);

  const rail = page.locator('.ol-support-center-sidebar');

  const overflow = await rail.evaluate((el) => ({
    clientHeight: el.clientHeight,
    scrollHeight: el.scrollHeight,
  }));

  // The support inbox rail carries more than a screen of filters and telemetry,
  // so this is the case the cap exists for.
  expect(overflow.scrollHeight).toBeGreaterThan(overflow.clientHeight);

  // And the overflow is genuinely reachable rather than clipped away.
  const scrollTop = await rail.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
    return el.scrollTop;
  });
  expect(scrollTop).toBeGreaterThan(0);
});
