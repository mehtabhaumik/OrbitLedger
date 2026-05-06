import { describe, expect, it } from 'vitest';

import {
  MISTAKE_RECOVERY_GUARDRAILS,
  MISTAKE_RECOVERY_SURFACES,
  buildMistakeRecoveryMode,
} from './mistakeRecovery';

describe('mistake recovery mode blueprint', () => {
  it('keeps allocated payment fixes as protected history-preserving actions', () => {
    const recovery = buildMistakeRecoveryMode({
      businessName: 'Rudraix PVT',
      signals: [
        {
          id: 'payment-1',
          area: 'payments',
          kind: 'payment_amount_wrong',
          hasPaymentAllocation: true,
        },
      ],
    });

    expect(recovery.title).toBe('Rudraix PVT mistake recovery');
    expect(recovery.summary).toContain('protected correction');
    expect(recovery.actions[0]).toMatchObject({
      primaryAction: 'Add correction',
      target: 'reverse_payment',
      risk: 'protected',
      requiresReason: true,
      preservesHistory: true,
    });
  });

  it('lets drafts be edited directly while saved invoices require revisions', () => {
    const recovery = buildMistakeRecoveryMode({
      signals: [
        {
          id: 'draft-1',
          area: 'invoices',
          kind: 'invoice_draft_wrong',
        },
        {
          id: 'invoice-1',
          area: 'invoices',
          kind: 'saved_invoice_wrong',
        },
      ],
    });

    const draftAction = recovery.actions.find((action) => action.target === 'edit_draft');
    const revisionAction = recovery.actions.find((action) => action.target === 'create_invoice_revision');

    expect(draftAction).toMatchObject({
      risk: 'low',
      requiresReason: false,
      preservesHistory: false,
    });
    expect(revisionAction).toMatchObject({
      risk: 'protected',
      requiresReason: true,
      preservesHistory: true,
    });
  });

  it('prioritizes blocked restore recovery before other correction work', () => {
    const recovery = buildMistakeRecoveryMode({
      signals: [
        {
          id: 'stock-1',
          area: 'inventory',
          kind: 'stock_count_wrong',
        },
        {
          id: 'restore-1',
          area: 'backup_restore',
          kind: 'restore_needs_rollback',
        },
      ],
    });

    expect(recovery.summary).toBe('Review the blocked recovery item before making more changes.');
    expect(recovery.actions[0]).toMatchObject({
      area: 'backup_restore',
      risk: 'blocked',
      target: 'open_restore_review',
    });
  });

  it('keeps customer and ledger cleanup visible instead of deleting history', () => {
    const recovery = buildMistakeRecoveryMode({
      signals: [
        {
          id: 'ledger-1',
          area: 'customer_ledger',
          kind: 'customer_balance_wrong',
        },
        {
          id: 'customer-1',
          area: 'customers',
          kind: 'duplicate_customer',
          hasFinalRecord: true,
        },
      ],
    });

    expect(recovery.actions.map((action) => action.target)).toEqual(expect.arrayContaining([
      'add_ledger_correction',
      'merge_customer',
    ]));
    expect(recovery.actions.every((action) => action.preservesHistory)).toBe(true);
  });

  it('defines recovery surfaces and global guardrails for parity', () => {
    expect(MISTAKE_RECOVERY_SURFACES.map((surface) => surface.area)).toEqual([
      'payments',
      'invoices',
      'customer_ledger',
      'customers',
      'inventory',
      'documents',
      'settings',
      'backup_restore',
    ]);
    expect(MISTAKE_RECOVERY_SURFACES.every((surface) => surface.requiredData.length > 0)).toBe(true);
    expect(MISTAKE_RECOVERY_GUARDRAILS).toContain('Never silently overwrite money history.');
  });
});
