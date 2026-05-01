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
    nextDayActions: buildTomorrowActions(report, confirmations, countedCash, difference),
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
  difference: number
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

  if (report.totals.promisesMissed > 0 || report.totals.promisesDue > 0) {
    actions.push({
      id: 'follow_up_promises',
      label: 'Follow up promises',
      helper: `${report.totals.promisesMissed + report.totals.promisesDue} promise${report.totals.promisesMissed + report.totals.promisesDue === 1 ? '' : 's'} need attention.`,
      target: 'get_paid',
      tone: report.totals.promisesMissed > 0 ? 'danger' : 'warning',
    });
  }

  if (report.lowStockProducts.length > 0) {
    actions.push({
      id: 'restock_items',
      label: 'Check low stock',
      helper: `${report.lowStockProducts.length} item${report.lowStockProducts.length === 1 ? '' : 's'} may need restocking.`,
      target: 'products',
      tone: 'warning',
    });
  }

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
      helper: 'Daily closing is complete.',
      target: 'customers',
      tone: 'success',
    });
  }

  return actions.slice(0, 5);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
