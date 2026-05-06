import { buildOwnerClosingRitual, type OwnerClosingRitualOutput } from '@orbit-ledger/core';

import type {
  DailyClosingAction,
  DailyClosingConfirmation,
  DailyClosingConfirmationKey,
  DailyClosingReport,
  DailyClosingRitualInput,
  DailyClosingRitualSummary,
} from './types';

const confirmationLabels: Record<DailyClosingConfirmationKey, string> = {
  cash_collected: 'Cash collected is counted',
  payments_recorded: 'Payments are recorded',
  credit_recorded: 'New credit is recorded',
  stock_checked: 'Stock changes are checked',
  followups_ready: 'Tomorrow follow-ups are ready',
};

export function buildDailyClosingRitualSummary(
  report: DailyClosingReport,
  input: DailyClosingRitualInput,
  closedAt = new Date().toISOString()
): DailyClosingRitualSummary {
  const expectedCash = report.totals.paymentReceived;
  const countedCash = input.countedCash;
  const difference = countedCash === null ? 0 : roundMoney(countedCash - expectedCash);
  const confirmations = Object.entries(confirmationLabels).map(([key, label]) => ({
    key: key as DailyClosingConfirmationKey,
    label,
    confirmed: input.confirmations[key as DailyClosingConfirmationKey] ?? false,
  })) satisfies DailyClosingConfirmation[];
  const sharedRitual = buildOwnerClosingRitual({
    businessName: report.business.businessName,
    currency: report.business.currency,
    date: report.reportDate,
    cash: {
      countedCash,
      expectedCash,
      cashConfirmed: input.confirmations.cash_collected,
    },
    credit: {
      creditReviewed: input.confirmations.credit_recorded,
      unreviewedCreditCount: input.confirmations.credit_recorded
        ? 0
        : report.ledgerEntries.filter((entry) => entry.type === 'credit').length,
    },
    followUp: {
      customersDueTomorrow: 0,
      overdueCustomers: report.totals.promisesMissed,
      promisesDueTomorrow: report.totals.promisesDue,
      followUpsPlanned: input.confirmations.followups_ready,
    },
    ledger: {
      cashCollected: report.totals.paymentReceived,
      creditCount: report.ledgerEntries.filter((entry) => entry.type === 'credit').length,
      creditGivenAmount: report.totals.creditGiven,
      paymentCount: report.ledgerEntries.filter((entry) => entry.type === 'payment').length,
      paymentsRecordedAmount: report.totals.paymentReceived,
    },
    payments: {
      paymentsReviewed: input.confirmations.payments_recorded,
    },
    stock: {
      lowStockCount: input.confirmations.stock_checked ? 0 : report.totals.lowStockProducts,
      movementCount: report.lowStockProducts.length,
      stockReviewed: input.confirmations.stock_checked,
    },
  });

  return {
    id: `${report.reportDate}_${Date.parse(closedAt) || Date.now()}`,
    reportDate: report.reportDate,
    closedAt,
    confirmations,
    mismatch: {
      hasMismatch: countedCash !== null && Math.abs(difference) >= 0.01,
      expectedCash,
      countedCash,
      difference,
      note: input.mismatchNote?.trim() || null,
    },
    nextDayActions: buildTomorrowActions(report, confirmations, countedCash, difference, sharedRitual),
    totals: {
      paymentReceived: report.totals.paymentReceived,
      creditGiven: report.totals.creditGiven,
      invoiceSales: report.totals.invoiceSales,
      promisesDue: report.totals.promisesDue,
      promisesMissed: report.totals.promisesMissed,
      lowStockProducts: report.totals.lowStockProducts,
    },
  };
}

function buildTomorrowActions(
  report: DailyClosingReport,
  confirmations: DailyClosingConfirmation[],
  countedCash: number | null,
  difference: number,
  sharedRitual: OwnerClosingRitualOutput
): DailyClosingAction[] {
  const actions: DailyClosingAction[] = [];

  if (countedCash === null) {
    actions.push({
      id: 'count_cash',
      label: 'Count today cash',
      helper: 'Add counted cash before closing the day.',
      target: 'reports',
      tone: 'warning',
    });
  } else if (Math.abs(difference) >= 0.01) {
    actions.push({
      id: 'fix_cash_mismatch',
      label: 'Fix cash mismatch',
      helper: 'Review payment entries against counted cash.',
      target: 'add_payment',
      tone: 'danger',
    });
  }

  sharedRitual.tomorrowActions.forEach((action) => {
    if (action.id === 'collect_customers') {
      actions.push({
        id: 'follow_up_promises',
        label: 'Follow up promises',
        helper: action.message,
        target: 'get_paid',
        tone: action.tone === 'success' ? 'primary' : action.tone,
      });
    }
    if (action.id === 'verify_payments') {
      actions.push({
        id: 'verify_payments',
        label: 'Verify payments',
        helper: action.message,
        target: 'add_payment',
        tone: action.tone === 'neutral' ? 'primary' : action.tone,
      });
    }
    if (action.id === 'review_stock') {
      actions.push({
        id: 'restock_items',
        label: 'Check low stock',
        helper: action.message,
        target: 'products',
        tone: action.tone === 'neutral' ? 'warning' : action.tone,
      });
    }
  });

  const missingConfirmation = confirmations.find((confirmation) => !confirmation.confirmed);
  if (missingConfirmation) {
    actions.push({
      id: 'finish_closing_checks',
      label: 'Finish closing checks',
      helper: missingConfirmation.label,
      target: 'reports',
      tone: 'primary',
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: 'start_fresh',
      label: 'Start tomorrow fresh',
      helper: sharedRitual.tomorrowActions[0]?.message ?? 'Daily closing is complete.',
      target: 'customers',
      tone: 'success',
    });
  }

  return actions.slice(0, 5);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
