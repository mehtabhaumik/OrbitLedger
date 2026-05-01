import { describe, expect, it } from 'vitest';

import type { DailyClosingReport, DailyClosingRitualInput } from './types';
import { buildDailyClosingRitualSummary } from './ritualModel';

const baseReport: DailyClosingReport = {
  schemaVersion: 1,
  reportDate: '2026-04-27',
  generatedAt: '2026-04-27T18:00:00.000Z',
  business: {
    businessName: 'Orbit Ledger Demo',
    currency: 'INR',
    countryCode: 'IN',
    stateCode: 'GJ',
  },
  totals: {
    openingReceivable: 1000,
    closingReceivable: 1500,
    creditGiven: 900,
    paymentReceived: 400,
    netLedgerMovement: 500,
    transactionCount: 2,
    invoiceSales: 1200,
    invoiceTax: 216,
    invoiceCount: 1,
    newCustomers: 1,
    remindersSent: 1,
    promisesDue: 1,
    promisesFulfilled: 0,
    promisesMissed: 0,
    lowStockProducts: 0,
    outstandingCustomersAtClose: 2,
  },
  ledgerEntries: [],
  invoices: [],
  topOutstandingCustomers: [],
  lowStockProducts: [],
};

const confirmedInput: DailyClosingRitualInput = {
  countedCash: 400,
  confirmations: {
    cash_collected: true,
    payments_recorded: true,
    credit_recorded: true,
    stock_checked: true,
    followups_ready: true,
  },
};

describe('daily closing ritual', () => {
  it('creates a complete summary without mismatch when cash matches payments', () => {
    const summary = buildDailyClosingRitualSummary(
      baseReport,
      confirmedInput,
      '2026-04-27T18:30:00.000Z'
    );

    expect(summary.mismatch).toMatchObject({
      hasMismatch: false,
      expectedCash: 400,
      countedCash: 400,
      difference: 0,
    });
    expect(summary.nextDayActions[0]).toMatchObject({
      id: 'follow_up_promises',
      target: 'get_paid',
    });
  });

  it('flags cash mismatches and keeps the owner note', () => {
    const summary = buildDailyClosingRitualSummary(baseReport, {
      ...confirmedInput,
      countedCash: 350,
      mismatchNote: 'Bank transfer not entered yet.',
    });

    expect(summary.mismatch).toMatchObject({
      hasMismatch: true,
      difference: -50,
      note: 'Bank transfer not entered yet.',
    });
    expect(summary.nextDayActions[0]).toMatchObject({
      id: 'fix_cash_mismatch',
      tone: 'danger',
    });
  });
});
