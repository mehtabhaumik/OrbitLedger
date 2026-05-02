import { describe, expect, it } from 'vitest';

import {
  WEB_WORKSPACE_BACKUP_MAX_RECORDS,
  WEB_WORKSPACE_BACKUP_VERSION,
  parseWorkspaceBackup,
  summarizeWorkspaceBackup,
  validateWorkspaceBackupOwner,
  type WebWorkspaceBackup,
} from './workspace-backup';

function makeBackup(overrides: Partial<WebWorkspaceBackup> = {}): WebWorkspaceBackup {
  return {
    backup_format_version: WEB_WORKSPACE_BACKUP_VERSION,
    exported_at: '2026-01-01T00:00:00.000Z',
    workspace: {
      profile: {
        business_name: 'Orbit Test Store',
        owner_uid: 'owner-1',
      },
    },
    entities: {
      customers: [],
      transactions: [],
      products: [],
      invoices: [],
      invoice_items: [],
      payment_allocations: [],
      payment_reversals: [],
    },
    notes: {
      browser_lock_included: false,
    },
    ...overrides,
  };
}

describe('workspace backup parsing', () => {
  it('rejects corrupted JSON', () => {
    expect(() => parseWorkspaceBackup('{not-json')).toThrow('not valid JSON');
  });

  it('rejects backups from a different owner', () => {
    const backup = makeBackup();

    expect(() => validateWorkspaceBackupOwner(backup, 'owner-2')).toThrow(
      'different account'
    );
  });

  it('rejects very large backups before restore', () => {
    const backup = makeBackup({
      entities: {
        customers: Array.from({ length: WEB_WORKSPACE_BACKUP_MAX_RECORDS + 1 }, (_, index) => ({
          id: `customer-${index}`,
        })),
        transactions: [],
        products: [],
        invoices: [],
        invoice_items: [],
        payment_allocations: [],
        payment_reversals: [],
      },
    });

    expect(() => parseWorkspaceBackup(JSON.stringify(backup))).toThrow('too large');
  });

  it('summarizes backup confidence details for preview', () => {
    const backup = makeBackup({
      entities: {
        customers: [{ id: 'customer-1' }],
        transactions: [{ id: 'transaction-1' }, { id: 'transaction-2' }],
        products: [],
        invoices: [],
        invoice_items: [],
        payment_allocations: [],
        payment_reversals: [],
      },
    });

    expect(summarizeWorkspaceBackup(backup)).toMatchObject({
      businessName: 'Orbit Test Store',
      totalRecords: 3,
      counts: {
        customers: 1,
        transactions: 2,
      },
      browserLockIncluded: false,
    });
  });
});
