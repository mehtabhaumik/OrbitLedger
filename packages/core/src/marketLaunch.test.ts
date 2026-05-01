import { describe, expect, it } from 'vitest';

import {
  ORBIT_LEDGER_APP_STORE_COPY,
  ORBIT_LEDGER_LAUNCH_TRUST_CHECKS,
  ORBIT_LEDGER_POSITIONING,
  ORBIT_LEDGER_SCREENSHOT_STORIES,
} from './marketLaunch';

describe('market launch positioning', () => {
  it('keeps the core promise focused on daily money control', () => {
    expect(ORBIT_LEDGER_POSITIONING.promise).toContain('Collect faster');
    expect(ORBIT_LEDGER_POSITIONING.promise).toContain('who owes what');
  });

  it('keeps launch copy clear of vague accounting-suite positioning', () => {
    const launchCopy = [
      ORBIT_LEDGER_POSITIONING.promise,
      ORBIT_LEDGER_POSITIONING.shortDescription,
      ORBIT_LEDGER_APP_STORE_COPY.short,
      ORBIT_LEDGER_APP_STORE_COPY.full,
      ...ORBIT_LEDGER_SCREENSHOT_STORIES,
      ...ORBIT_LEDGER_LAUNCH_TRUST_CHECKS,
    ].join(' ');

    expect(launchCopy.toLowerCase()).not.toContain('erp');
    expect(launchCopy.toLowerCase()).not.toContain('accounting suite');
    expect(ORBIT_LEDGER_SCREENSHOT_STORIES.length).toBeGreaterThanOrEqual(6);
    expect(ORBIT_LEDGER_LAUNCH_TRUST_CHECKS.length).toBeGreaterThanOrEqual(6);
  });
});
