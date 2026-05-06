import { describe, expect, it } from 'vitest';

import {
  ORBIT_LEDGER_SETTINGS_QA_CHECKS,
  getLaunchBlockingSettingsQaChecks,
  getSettingsQaReadiness,
} from './settingsQa';

describe('settings QA readiness', () => {
  it('covers the launch-critical settings QA moments', () => {
    const ids = ORBIT_LEDGER_SETTINGS_QA_CHECKS.map((check) => check.id);

    expect(ids).toEqual(
      expect.arrayContaining([
        'user-settings-save-and-refresh',
        'workspace-settings-save-and-refresh',
        'logout-login-reload',
        'workspace-switch-no-stale-save',
        'settings-parity-covered',
        'settings-mobile-tablet-layout',
        'setting-applied-feedback',
        'settings-launch-copy-and-navigation',
        'settings-launch-session-recovery',
      ])
    );
  });

  it('keeps launch-blocking checks explicit and useful', () => {
    const launchBlocking = getLaunchBlockingSettingsQaChecks();

    expect(launchBlocking.length).toBeGreaterThanOrEqual(5);
    for (const check of launchBlocking) {
      expect(check.label.trim().length).toBeGreaterThan(8);
      expect(check.expected.trim().length).toBeGreaterThan(20);
    }
  });

  it('reports settings readiness from parity state', () => {
    expect(getSettingsQaReadiness()).toMatchObject({
      unplannedParityGapCount: 0,
      readyForNextPhase: true,
    });
  });
});
