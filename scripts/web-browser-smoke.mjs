#!/usr/bin/env node

import { chromium } from '@playwright/test';

const args = new Set(process.argv.slice(2));
const baseUrl = (process.env.ORBIT_LEDGER_WEB_SMOKE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const ownerEmail = process.env.ORBIT_LEDGER_QA_EMAIL?.trim() || '';
const ownerPassword = process.env.ORBIT_LEDGER_QA_PASSWORD?.trim() || '';
const viewerEmail = process.env.ORBIT_LEDGER_QA_VIEWER_EMAIL?.trim() || '';
const viewerPassword = process.env.ORBIT_LEDGER_QA_VIEWER_PASSWORD?.trim() || '';
const shouldRunAuthenticated = args.has('--authenticated') || Boolean(ownerEmail && ownerPassword);

const results = [];

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    await runUnauthenticatedSmoke(browser);

    if (shouldRunAuthenticated) {
      if (!ownerEmail || !ownerPassword) {
        throw new Error('Authenticated smoke requires ORBIT_LEDGER_QA_EMAIL and ORBIT_LEDGER_QA_PASSWORD.');
      }
      await runOwnerSmoke(browser);
      if (viewerEmail && viewerPassword) {
        await runViewerOfficeLockSmoke(browser);
      }
    }
  } finally {
    await browser.close();
  }

  for (const result of results) {
    console.log(`PASS: ${result}`);
  }
}

async function runUnauthenticatedSmoke(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = collectBlockingBrowserErrors(page);

  try {
    await open(page, '/login/');
    await expectVisibleText(page, 'Sign in to your workspace', 'login panel');
    await expectVisibleText(page, 'Continue with Google', 'Google sign-in button');

    await page.fill('input[type="email"]', 'not-a-real-user@example.invalid');
    await page.fill('input[type="password"]', 'bad-password-12345');
    await page.locator('form button[type="submit"]').click();
    await expectVisibleText(page, 'The email or password is not correct.', 'friendly invalid login error');

    await open(page, '/dashboard/');
    await page.waitForURL(/\/login\/?$/, { timeout: 15000 });
    await expectVisibleText(page, 'Sign in to your workspace', 'dashboard redirects anonymous users');

    await open(page, '/office-operations/');
    await page.waitForURL(/\/login\/?$/, { timeout: 15000 });
    await expectVisibleText(page, 'Sign in to your workspace', 'Office operations redirects anonymous users');

    assertNoBlockingErrors(errors);
    results.push('unauthenticated login, invalid credential, dashboard redirect, and Office redirect smoke');
  } finally {
    await context.close();
  }
}

async function runOwnerSmoke(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = collectBlockingBrowserErrors(page);

  try {
    await signIn(page, ownerEmail, ownerPassword);
    await page.waitForURL(/\/dashboard\/?$/, { timeout: 25000 });
    await expectVisibleText(page, 'Orbit Ledger QA Workspace', 'seeded workspace selector or dashboard');

    await open(page, '/invoices/');
    await expectVisibleText(page, 'QA-WEB-1001', 'seeded invoice list row');
    await expectVisibleText(page, 'Auto email', 'auto email visibility badge or section');

    await open(page, '/invoices/detail?invoiceId=qa_invoice_monthly');
    await expectVisibleText(page, 'QA-WEB-1001', 'seeded invoice detail');
    await expectVisibleText(page, 'Payment allocation', 'invoice payment allocation panel');
    await expectVisibleText(page, 'View / print', 'invoice view and print action');

    await open(page, '/payments/');
    await expectVisibleText(page, 'Payment Activity Timeline', 'payments timeline');
    await expectVisibleText(page, 'Manual payment recorded', 'seeded payment activity');

    await open(page, '/customers/detail?customerId=qa_customer_sonali');
    await expectVisibleText(page, 'Sonali Traders', 'seeded customer detail');
    await expectVisibleText(page, 'Customer Trust Memory', 'customer trust memory surface');

    await open(page, '/office-operations/');
    await expectVisibleText(page, 'Office operations', 'owner Office operations access');

    assertNoBlockingErrors(errors);
    results.push('authenticated owner dashboard, invoice, payment allocation, payment timeline, customer, and Office smoke');
  } finally {
    await context.close();
  }
}

async function runViewerOfficeLockSmoke(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = collectBlockingBrowserErrors(page);

  try {
    await signIn(page, viewerEmail, viewerPassword);
    await page.waitForURL(/\/dashboard\/?$/, { timeout: 25000 });
    await open(page, '/settings/');
    await expectVisibleText(page, 'Settings access locked', 'viewer settings lock');
    await open(page, '/office-operations/');
    await expectVisibleText(page, 'Operations access locked', 'viewer Office operations lock');

    assertNoBlockingErrors(errors);
    results.push('viewer Office route locks');
  } finally {
    await context.close();
  }
}

async function signIn(page, email, password) {
  await open(page, '/login/');
  await expectVisibleText(page, 'Sign in to your workspace', 'login panel before seeded sign-in');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.locator('form button[type="submit"]').click();
}

async function open(page, path) {
  const response = await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded' });
  if (!response || response.status() >= 500) {
    throw new Error(`Route ${path} failed with HTTP ${response?.status() ?? 'no response'}.`);
  }
}

async function expectVisibleText(page, text, label) {
  const deadline = Date.now() + 20000;
  const locator = page.getByText(text, { exact: false });
  while (Date.now() < deadline) {
    const count = await locator.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      if (await locator.nth(index).isVisible().catch(() => false)) {
        return;
      }
    }
    await page.waitForTimeout(250);
  }

  const body = (await page.locator('body').innerText({ timeout: 3000 }).catch(() => '')).replace(/\s+/g, ' ').slice(0, 700);
  throw new Error(`Missing ${label}: expected visible text "${text}". Body: ${body}`);
}

function collectBlockingBrowserErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') {
      return;
    }
    const text = message.text();
    if (
      text.includes('400') ||
      text.includes('auth/invalid-credential') ||
      text.includes('The email or password is not correct')
    ) {
      return;
    }
    errors.push(text);
  });
  return errors;
}

function assertNoBlockingErrors(errors) {
  const blocking = errors.filter((error) => !error.includes('Failed to load resource: the server responded with a status of 400'));
  if (blocking.length) {
    throw new Error(`Browser console/page errors detected:\n${blocking.slice(-5).join('\n')}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
