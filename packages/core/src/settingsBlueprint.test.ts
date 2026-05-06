import { describe, expect, it } from 'vitest';

import {
  ORBIT_LEDGER_SETTINGS_BLUEPRINT,
  SETTINGS_SAVE_BEHAVIOR_RULES,
  SETTINGS_STORAGE_RULES,
  SETTINGS_SURFACE_LABELS,
  getAuditProtectedSettings,
  getAutoSavedSettings,
  getSettingsBlueprintByStorage,
  getSettingsBlueprintBySurface,
  type SettingsStorageScope,
  type SettingsSurface,
} from './settingsBlueprint';

describe('Orbit Ledger settings blueprint', () => {
  it('keeps setting ids unique and documents every rule', () => {
    const ids = ORBIT_LEDGER_SETTINGS_BLUEPRINT.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const item of ORBIT_LEDGER_SETTINGS_BLUEPRINT) {
      expect(item.label.trim().length).toBeGreaterThan(3);
      expect(item.reason.trim().length).toBeGreaterThan(10);
      expect(item.userBenefit.trim().length).toBeGreaterThan(10);
      expect(item.implementationNote.trim().length).toBeGreaterThan(10);
      expect(SETTINGS_SURFACE_LABELS[item.surface]).toBeTruthy();
      expect(SETTINGS_STORAGE_RULES[item.storage]).toBeTruthy();
      expect(SETTINGS_SAVE_BEHAVIOR_RULES[item.saveBehavior]).toBeTruthy();
    }
  });

  it('covers every planned settings hub section', () => {
    for (const surface of Object.keys(SETTINGS_SURFACE_LABELS) as SettingsSurface[]) {
      expect(getSettingsBlueprintBySurface(surface).length).toBeGreaterThan(0);
    }
  });

  it('separates user, workspace, device, and audit protected storage', () => {
    for (const storage of Object.keys(SETTINGS_STORAGE_RULES) as SettingsStorageScope[]) {
      expect(getSettingsBlueprintByStorage(storage).length).toBeGreaterThan(0);
    }
  });

  it('marks safe preferences as auto-save while protecting money-impacting settings', () => {
    const autoIds = getAutoSavedSettings().map((item) => item.id);
    const auditIds = getAuditProtectedSettings().map((item) => item.id);

    expect(autoIds).toEqual(
      expect.arrayContaining([
        'watermark-opacity',
        'table-density',
        'default-dashboard-view',
        'default-invoice-template',
      ])
    );

    expect(auditIds).toEqual(
      expect.arrayContaining([
        'company-legal-name',
        'company-tax-ids',
        'invoice-numbering',
        'payment-terms',
        'manual-payment-instructions',
      ])
    );
  });

  it('keeps device-only security and motion preferences out of workspace sync', () => {
    const deviceOnlyIds = getSettingsBlueprintByStorage('device_local').map((item) => item.id);

    expect(deviceOnlyIds).toEqual(
      expect.arrayContaining([
        'app-lock-timeout',
        'reduced-motion',
      ])
    );
  });
});
