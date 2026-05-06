import { describe, expect, it } from 'vitest';

import { ORBIT_LEDGER_SETTINGS_BLUEPRINT } from './settingsBlueprint';
import { ORBIT_LEDGER_SETTINGS_PARITY, getSettingsParityGaps } from './settingsParity';

describe('settings hub mobile and web parity', () => {
  it('tracks every setting blueprint item in the parity registry', () => {
    const blueprintIds = ORBIT_LEDGER_SETTINGS_BLUEPRINT.map((item) => item.id).sort();
    const parityIds = ORBIT_LEDGER_SETTINGS_PARITY.map((item) => item.settingId).sort();

    expect(parityIds).toEqual(blueprintIds);
  });

  it('keeps all both-platform settings covered by mobile and web evidence', () => {
    const bothPlatformItems = ORBIT_LEDGER_SETTINGS_PARITY.filter(
      (item) => item.expectedPlatform === 'both'
    );

    expect(bothPlatformItems.length).toBeGreaterThan(10);
    for (const item of bothPlatformItems) {
      expect(item.mobile).toBe('shared');
      expect(item.web).toBe('shared');
      expect(item.mobileEvidence.trim().length).toBeGreaterThan(20);
      expect(item.webEvidence.trim().length).toBeGreaterThan(20);
    }
  });

  it('keeps platform-specific settings out of false parity requirements', () => {
    const webOnly = ORBIT_LEDGER_SETTINGS_PARITY.find(
      (item) => item.settingId === 'payment-provider-credentials'
    );

    expect(webOnly?.expectedPlatform).toBe('web');
    expect(webOnly?.mobile).toBe('platform_specific');
    expect(webOnly?.web).toBe('shared');
  });

  it('has no unplanned settings parity gaps for launch settings', () => {
    expect(getSettingsParityGaps()).toEqual([]);
  });
});
