import { expect, test as setup } from '@playwright/test';

import { AUTH_STATE_PATH, emulatorCredentials } from './routes';

/**
 * Signs in once and saves the session for every authenticated spec to reuse.
 *
 * Signing in per test previously timed out: ~57 logins against one emulator
 * contend badly, and each was paying the full auth round trip before the page
 * under test even loaded. Firebase keeps its token in IndexedDB rather than
 * cookies or localStorage, so the state is saved with `indexedDB: true` -
 * without that flag the restored context is anonymous.
 */
setup('authenticate', async ({ page }) => {
  const { email, password } = emulatorCredentials();

  await page.goto('/login/', { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.locator('form button[type="submit"]').click();

  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 60_000 });

  // Confirm the workspace actually resolved before saving. A session captured
  // mid-bootstrap would restore into a loading state on every screen.
  await expect(page.locator('body')).toContainText(/workspace|dashboard|home/i, { timeout: 30_000 });

  await page.context().storageState({ path: AUTH_STATE_PATH, indexedDB: true });
});
