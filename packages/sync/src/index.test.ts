import { describe, expect, it } from 'vitest';

import { getSyncStrategy, isAppendSafeSyncEntity } from './index';

describe('sync strategy', () => {
  it('keeps ledger transactions append-safe', () => {
    expect(getSyncStrategy('transactions')).toBe('append_safe');
    expect(isAppendSafeSyncEntity('transactions')).toBe(true);
  });

  it('protects editable business records with revisions', () => {
    expect(getSyncStrategy('customers')).toBe('revision_protected');
    expect(getSyncStrategy('invoices')).toBe('revision_protected');
    expect(isAppendSafeSyncEntity('customers')).toBe(false);
  });
});
