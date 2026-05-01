import type { LedgerTransaction } from './types';

export function calculateLedgerBalance(
  openingBalance: number,
  transactions: Pick<LedgerTransaction, 'type' | 'amount'>[]
): number {
  return transactions.reduce((balance, transaction) => {
    return balance + (transaction.type === 'credit' ? transaction.amount : -transaction.amount);
  }, openingBalance);
}
