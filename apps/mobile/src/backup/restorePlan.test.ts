import { describe, expect, it } from 'vitest';

import { prepareFullReplaceRestorePlan } from './restorePlan';
import {
  ORBIT_LEDGER_BACKUP_APP_NAME,
  ORBIT_LEDGER_BACKUP_FORMAT_VERSION,
  type OrbitLedgerBackup,
} from './types';

function backupWithBusiness(): OrbitLedgerBackup {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    metadata: {
      appName: ORBIT_LEDGER_BACKUP_APP_NAME,
      backup_format_version: ORBIT_LEDGER_BACKUP_FORMAT_VERSION,
      exportedAt: now,
      fileName: 'orbit-ledger-backup.json',
      businessName: 'Orbit Test Store',
      recordCounts: {
        customers: 0,
        transactions: 0,
        paymentReminders: 0,
        paymentPromises: 0,
        taxProfiles: 0,
        taxPacks: 0,
        documentTemplates: 0,
        complianceConfigs: 0,
        countryPackages: 0,
        countryPackageTemplates: 0,
        complianceReports: 0,
        products: 0,
        invoices: 0,
        invoiceItems: 0,
        appPreferences: 0,
        documentHistory: 0,
      },
    },
    data: {
      businessSettings: {
        id: 'primary',
        businessName: 'Orbit Test Store',
        ownerName: 'Owner',
        phone: '+91 98765 43210',
        email: 'owner@example.com',
        address: 'Main Road',
        currency: 'INR',
        countryCode: 'IN',
        stateCode: 'MH',
        logoUri: null,
        authorizedPersonName: 'Owner',
        authorizedPersonTitle: 'Owner',
        signatureUri: null,
        taxMode: 'not_configured',
        taxProfileVersion: null,
        taxProfileSource: 'none',
        taxLastSyncedAt: null,
        taxSetupRequired: false,
        storageMode: 'local_only',
        workspaceId: null,
        syncEnabled: false,
        lastSyncedAt: null,
        createdAt: now,
        updatedAt: now,
        syncId: 'business',
        lastModified: now,
        syncStatus: 'synced',
        serverRevision: 0,
      },
      customers: [],
      transactions: [],
      paymentReminders: [],
      paymentPromises: [],
      taxProfiles: [],
      taxPacks: [],
      documentTemplates: [],
      complianceConfigs: [],
      countryPackages: [],
      countryPackageTemplates: [],
      complianceReports: [],
      products: [],
      invoices: [],
      invoiceItems: [],
      appPreferences: [],
      documentHistory: [],
      appSecurity: null,
    },
  };
}

describe('prepareFullReplaceRestorePlan', () => {
  it('builds restore counts from a validated backup', () => {
    const plan = prepareFullReplaceRestorePlan(backupWithBusiness());
    expect(plan.mode).toBe('replace');
    expect(plan.businessName).toBe('Orbit Test Store');
    expect(plan.customersToRestore).toBe(0);
    expect(plan.appSecurityToRestore).toBe(false);
  });

  it('rejects backups without a business profile', () => {
    const backup = backupWithBusiness();
    backup.data.businessSettings = null;
    expect(() => prepareFullReplaceRestorePlan(backup)).toThrow('business profile');
  });

  it('rejects corrupted backup JSON', () => {
    expect(() => prepareFullReplaceRestorePlan('{not-json')).toThrow('backup file Orbit Ledger can read');
  });

  it('rejects backups that are too large for a safe device restore', () => {
    const backup = backupWithBusiness();
    backup.metadata.recordCounts = {
      ...backup.metadata.recordCounts!,
      customers: 50001,
    };
    backup.data.customers = Array.from({ length: 50001 }, (_, index) => ({
      id: `customer-${index}`,
      name: `Customer ${index}`,
      phone: null,
      address: null,
      notes: null,
      openingBalance: 0,
      isArchived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      syncId: `customer-${index}`,
      lastModified: '2026-01-01T00:00:00.000Z',
      syncStatus: 'synced',
      serverRevision: 0,
    }));

    expect(() => prepareFullReplaceRestorePlan(backup)).toThrow('too large');
  });
});
