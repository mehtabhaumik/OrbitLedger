import { describe, expect, it } from 'vitest';

import {
  DAILY_ACTION_CENTER_SURFACES,
  buildDailyActionCenter,
} from './dailyActionCenter';

describe('daily action center blueprint', () => {
  it('prioritizes payment review before collection work', () => {
    const center = buildDailyActionCenter({
      businessName: 'Rudraix PVT',
      collections: {
        amountDue: 42000,
        customerCount: 3,
      },
      payments: {
        pendingVerificationCount: 2,
      },
    });

    expect(center.title).toBe('Rudraix PVT today');
    expect(center.topAction.id).toBe('payments');
    expect(center.topAction.action.target).toBe('open_payment_review');
    expect(center.topAction.action.detailDialog).toBe('payment_review_list');
    expect(center.summary).toContain('urgent');
  });

  it('turns unpaid invoice totals into an invoice action', () => {
    const center = buildDailyActionCenter({
      currency: 'INR',
      invoices: {
        amountDue: 1770,
        invoiceCount: 1,
        overdueCount: 0,
      },
    });

    expect(center.topAction.id).toBe('invoices');
    expect(center.topAction.title).toBe('Unpaid invoices');
    expect(center.topAction.value).toBe('₹1,770');
    expect(center.topAction.action.detailDialog).toBe('unpaid_invoice_list');
  });

  it('marks overdue invoices as urgent', () => {
    const center = buildDailyActionCenter({
      invoices: {
        amountDue: 9100,
        invoiceCount: 2,
        overdueCount: 2,
      },
    });

    expect(center.topAction.id).toBe('invoices');
    expect(center.topAction.priority).toBe('critical');
    expect(center.topAction.tone).toBe('danger');
  });

  it('keeps stock, backup, business trend, and closing as actionable signals', () => {
    const center = buildDailyActionCenter({
      backup: {
        ageHours: 72,
        status: 'old',
      },
      businessTrend: {
        currentWeekAmount: 7000,
        previousWeekAmount: 10000,
      },
      closing: {
        completedToday: false,
        openItemCount: 3,
      },
      inventory: {
        lowStockCount: 4,
        outOfStockCount: 1,
      },
    });

    expect(center.items.map((item) => item.id)).toEqual([
      'inventory',
      'backup',
      'business_health',
      'daily_closing',
    ]);
    expect(center.items.every((item) => item.action.detailDialog)).toBe(true);
  });

  it('returns a calm empty state when nothing needs attention', () => {
    const center = buildDailyActionCenter({});

    expect(center.emptyState).toBe(true);
    expect(center.topAction.title).toBe('Ready for today');
    expect(center.topAction.tone).toBe('success');
  });

  it('defines all daily action surfaces for mobile and web parity', () => {
    expect(DAILY_ACTION_CENTER_SURFACES.map((surface) => surface.area)).toEqual([
      'collections',
      'invoices',
      'inventory',
      'payments',
      'backup',
      'business_health',
      'daily_closing',
    ]);
    expect(
      DAILY_ACTION_CENTER_SURFACES.every(
        (surface) => surface.promise && surface.requiredData.length > 0 && surface.actionTarget
      )
    ).toBe(true);
  });
});
