import { describe, expect, it } from 'vitest';

import { calculateLedgerBalance } from './balance';

describe('calculateLedgerBalance', () => {
  it('adds credits and subtracts payments from opening balance', () => {
    expect(
      calculateLedgerBalance(100, [
        { type: 'credit', amount: 250 },
        { type: 'payment', amount: 80 },
        { type: 'credit', amount: 30 },
      ])
    ).toBe(300);
  });

  it('supports advance balances when payments exceed dues', () => {
    expect(calculateLedgerBalance(0, [{ type: 'payment', amount: 75 }])).toBe(-75);
  });
});
