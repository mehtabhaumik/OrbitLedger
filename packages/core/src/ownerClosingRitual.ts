export type OwnerClosingRitualStepId =
  | 'cash'
  | 'payments'
  | 'credit'
  | 'stock'
  | 'follow_up'
  | 'review';

export type OwnerClosingRitualTone = 'success' | 'primary' | 'warning' | 'danger' | 'neutral';

export type OwnerClosingRitualActionTarget =
  | 'count_cash'
  | 'review_payments'
  | 'review_credit'
  | 'review_stock'
  | 'plan_follow_up'
  | 'save_closing';

export type OwnerClosingRitualStep = {
  id: OwnerClosingRitualStepId;
  title: string;
  prompt: string;
  value: string;
  helper: string;
  tone: OwnerClosingRitualTone;
  completed: boolean;
  action: {
    label: string;
    target: OwnerClosingRitualActionTarget;
  };
};

export type OwnerClosingRitualFlagId =
  | 'cash_mismatch'
  | 'payments_pending'
  | 'credit_pending_review'
  | 'stock_attention'
  | 'follow_up_needed';

export type OwnerClosingRitualFlag = {
  id: OwnerClosingRitualFlagId;
  title: string;
  message: string;
  tone: OwnerClosingRitualTone;
  actionLabel: string;
  target: OwnerClosingRitualActionTarget;
};

export type OwnerClosingTomorrowActionId =
  | 'collect_customers'
  | 'verify_payments'
  | 'review_stock'
  | 'send_reminders'
  | 'open_business';

export type OwnerClosingTomorrowAction = {
  id: OwnerClosingTomorrowActionId;
  title: string;
  message: string;
  tone: OwnerClosingRitualTone;
  target: OwnerClosingRitualActionTarget | 'open_collections';
};

export type OwnerClosingLedgerSignal = {
  cashCollected?: number | null;
  paymentsRecordedAmount?: number | null;
  paymentCount?: number | null;
  creditGivenAmount?: number | null;
  creditCount?: number | null;
};

export type OwnerClosingCashSignal = {
  expectedCash?: number | null;
  countedCash?: number | null;
  cashConfirmed?: boolean | null;
};

export type OwnerClosingPaymentSignal = {
  pendingVerificationCount?: number | null;
  pendingClearanceCount?: number | null;
  paymentsReviewed?: boolean | null;
};

export type OwnerClosingCreditSignal = {
  unreviewedCreditCount?: number | null;
  creditReviewed?: boolean | null;
};

export type OwnerClosingStockSignal = {
  movementCount?: number | null;
  lowStockCount?: number | null;
  mismatchCount?: number | null;
  stockReviewed?: boolean | null;
};

export type OwnerClosingFollowUpSignal = {
  customersDueTomorrow?: number | null;
  overdueCustomers?: number | null;
  promisesDueTomorrow?: number | null;
  followUpsPlanned?: boolean | null;
};

export type OwnerClosingRitualInput = {
  businessName?: string | null;
  date?: string | null;
  currency?: string | null;
  ledger?: OwnerClosingLedgerSignal | null;
  cash?: OwnerClosingCashSignal | null;
  payments?: OwnerClosingPaymentSignal | null;
  credit?: OwnerClosingCreditSignal | null;
  stock?: OwnerClosingStockSignal | null;
  followUp?: OwnerClosingFollowUpSignal | null;
};

export type OwnerClosingRitualOutput = {
  title: string;
  summary: string;
  steps: OwnerClosingRitualStep[];
  flags: OwnerClosingRitualFlag[];
  tomorrowActions: OwnerClosingTomorrowAction[];
  completion: {
    completed: number;
    total: number;
    readyToClose: boolean;
  };
  emptyState: boolean;
};

export type OwnerClosingRitualSurfaceBlueprint = {
  area: OwnerClosingRitualStepId;
  label: string;
  userPromise: string;
  requiredData: string[];
  actionTarget: OwnerClosingRitualActionTarget;
};

export const OWNER_CLOSING_RITUAL_SURFACES: OwnerClosingRitualSurfaceBlueprint[] = [
  surface('cash', 'Cash check', 'Confirm today’s cash matches the money recorded.', [
    'expected cash',
    'cash counted',
    'cash confirmation',
  ], 'count_cash'),
  surface('payments', 'Payment review', 'Confirm payments are recorded and waiting items are visible.', [
    'payments recorded',
    'pending verification',
    'pending clearance',
  ], 'review_payments'),
  surface('credit', 'Credit review', 'Confirm new credit given today is intentional.', [
    'credit amount',
    'credit entry count',
    'unreviewed credit count',
  ], 'review_credit'),
  surface('stock', 'Stock review', 'Confirm stock movement or risk before closing the day.', [
    'stock movement count',
    'low-stock count',
    'stock mismatch count',
  ], 'review_stock'),
  surface('follow_up', 'Tomorrow plan', 'Prepare tomorrow’s collection and follow-up list.', [
    'customers due tomorrow',
    'overdue customers',
    'promises due tomorrow',
  ], 'plan_follow_up'),
  surface('review', 'Closing summary', 'Save a calm day-end summary and next-day action list.', [
    'completed checks',
    'open flags',
    'tomorrow actions',
  ], 'save_closing'),
];

export function buildOwnerClosingRitual(input: OwnerClosingRitualInput): OwnerClosingRitualOutput {
  const currency = normalizeCurrency(input.currency);
  const steps = buildSteps(input, currency);
  const flags = buildFlags(input, currency);
  const tomorrowActions = buildTomorrowActions(input, flags);
  const completed = steps.filter((step) => step.completed).length;
  const checksReady = steps.filter((step) => step.id !== 'review').every((step) => step.completed);
  const readyToClose = checksReady && flags.length === 0;

  return {
    title: buildTitle(input.businessName, input.date),
    summary: buildSummary(readyToClose, flags, tomorrowActions),
    steps,
    flags,
    tomorrowActions,
    completion: {
      completed,
      total: steps.length,
      readyToClose,
    },
    emptyState: isEmptyInput(input),
  };
}

function buildSteps(input: OwnerClosingRitualInput, currency: string): OwnerClosingRitualStep[] {
  const ledger = input.ledger ?? {};
  const cash = input.cash ?? {};
  const payments = input.payments ?? {};
  const credit = input.credit ?? {};
  const stock = input.stock ?? {};
  const followUp = input.followUp ?? {};
  const cashMismatch = cashMismatchAmount(cash);
  const pendingPayments = count(payments.pendingVerificationCount) + count(payments.pendingClearanceCount);
  const unreviewedCredit = count(credit.unreviewedCreditCount);
  const stockAttention = count(stock.lowStockCount) + count(stock.mismatchCount);
  const followUpCount =
    count(followUp.customersDueTomorrow) + count(followUp.overdueCustomers) + count(followUp.promisesDueTomorrow);

  return [
    step({
      id: 'cash',
      title: 'Cash check',
      prompt: 'Confirm the cash collected today.',
      value: formatMoney(amount(cash.countedCash ?? ledger.cashCollected), currency),
      helper:
        cashMismatch > 0
          ? `${formatMoney(cashMismatch, currency)} difference needs review.`
          : 'Cash is ready for closing.',
      tone: cashMismatch > 0 ? 'danger' : cash.cashConfirmed ? 'success' : 'primary',
      completed: Boolean(cash.cashConfirmed) && cashMismatch === 0,
      actionLabel: 'Check cash',
      target: 'count_cash',
    }),
    step({
      id: 'payments',
      title: 'Payments recorded',
      prompt: 'Review payments collected today.',
      value: formatMoney(amount(ledger.paymentsRecordedAmount), currency),
      helper:
        pendingPayments > 0
          ? `${pendingPayments} payment${plural(pendingPayments)} still need review.`
          : `${count(ledger.paymentCount)} payment${plural(count(ledger.paymentCount))} recorded today.`,
      tone: pendingPayments > 0 ? 'warning' : payments.paymentsReviewed ? 'success' : 'primary',
      completed: Boolean(payments.paymentsReviewed) && pendingPayments === 0,
      actionLabel: 'Review payments',
      target: 'review_payments',
    }),
    step({
      id: 'credit',
      title: 'Credit given',
      prompt: 'Confirm new credit given today.',
      value: formatMoney(amount(ledger.creditGivenAmount), currency),
      helper:
        unreviewedCredit > 0
          ? `${unreviewedCredit} credit entr${unreviewedCredit === 1 ? 'y' : 'ies'} need confirmation.`
          : `${count(ledger.creditCount)} credit entr${plural(count(ledger.creditCount), 'y', 'ies')} reviewed.`,
      tone: unreviewedCredit > 0 ? 'warning' : credit.creditReviewed ? 'success' : 'primary',
      completed: Boolean(credit.creditReviewed) && unreviewedCredit === 0,
      actionLabel: 'Review credit',
      target: 'review_credit',
    }),
    step({
      id: 'stock',
      title: 'Stock check',
      prompt: 'Review stock movement and low-stock risk.',
      value: String(count(stock.movementCount)),
      helper:
        stockAttention > 0
          ? `${stockAttention} stock item${plural(stockAttention)} need attention.`
          : 'No stock issue is waiting.',
      tone: stockAttention > 0 ? 'warning' : stock.stockReviewed ? 'success' : 'neutral',
      completed: Boolean(stock.stockReviewed) && stockAttention === 0,
      actionLabel: 'Review stock',
      target: 'review_stock',
    }),
    step({
      id: 'follow_up',
      title: 'Tomorrow plan',
      prompt: 'Prepare who to contact next.',
      value: String(followUpCount),
      helper:
        followUpCount > 0
          ? `${followUpCount} follow-up${plural(followUpCount)} should be ready for tomorrow.`
          : 'No follow-up is waiting for tomorrow.',
      tone: followUpCount > 0 ? 'primary' : followUp.followUpsPlanned ? 'success' : 'neutral',
      completed: Boolean(followUp.followUpsPlanned),
      actionLabel: 'Plan follow-up',
      target: 'plan_follow_up',
    }),
    step({
      id: 'review',
      title: 'Save closing',
      prompt: 'Save today’s closing summary.',
      value: '',
      helper: 'Save the closing once checks and flags are reviewed.',
      tone: 'primary',
      completed: false,
      actionLabel: 'Save closing',
      target: 'save_closing',
    }),
  ];
}

function buildFlags(input: OwnerClosingRitualInput, currency: string): OwnerClosingRitualFlag[] {
  const cashMismatch = cashMismatchAmount(input.cash);
  const pendingPayments = count(input.payments?.pendingVerificationCount) + count(input.payments?.pendingClearanceCount);
  const unreviewedCredit = count(input.credit?.unreviewedCreditCount);
  const stockMismatch = count(input.stock?.mismatchCount);
  const lowStock = count(input.stock?.lowStockCount);
  const followUps =
    count(input.followUp?.customersDueTomorrow) +
    count(input.followUp?.overdueCustomers) +
    count(input.followUp?.promisesDueTomorrow);

  return [
    cashMismatch > 0
      ? flag(
          'cash_mismatch',
          'Cash difference',
          `${formatMoney(cashMismatch, currency)} does not match today’s expected cash.`,
          'danger',
          'Check cash',
          'count_cash'
        )
      : null,
    pendingPayments > 0
      ? flag(
          'payments_pending',
          'Payments need review',
          `${pendingPayments} payment${plural(pendingPayments)} should be checked before closing.`,
          'warning',
          'Review payments',
          'review_payments'
        )
      : null,
    unreviewedCredit > 0
      ? flag(
          'credit_pending_review',
          'Credit needs confirmation',
          `${unreviewedCredit} credit entr${unreviewedCredit === 1 ? 'y' : 'ies'} should be confirmed.`,
          'warning',
          'Review credit',
          'review_credit'
        )
      : null,
    stockMismatch + lowStock > 0
      ? flag(
          'stock_attention',
          'Stock needs attention',
          `${stockMismatch + lowStock} stock item${plural(stockMismatch + lowStock)} should be reviewed.`,
          stockMismatch > 0 ? 'danger' : 'warning',
          'Review stock',
          'review_stock'
        )
      : null,
    followUps > 0
      ? flag(
          'follow_up_needed',
          'Tomorrow follow-up',
          `${followUps} customer follow-up${plural(followUps)} should be ready for tomorrow.`,
          'primary',
          'Plan follow-up',
          'plan_follow_up'
        )
      : null,
  ].filter(isFlag);
}

function buildTomorrowActions(
  input: OwnerClosingRitualInput,
  flags: OwnerClosingRitualFlag[]
): OwnerClosingTomorrowAction[] {
  const followUp = input.followUp ?? {};
  const payments = input.payments ?? {};
  const stock = input.stock ?? {};
  const actions: OwnerClosingTomorrowAction[] = [];
  const followUps =
    count(followUp.customersDueTomorrow) + count(followUp.overdueCustomers) + count(followUp.promisesDueTomorrow);
  const pendingPayments = count(payments.pendingVerificationCount) + count(payments.pendingClearanceCount);
  const stockAttention = count(stock.lowStockCount) + count(stock.mismatchCount);

  if (followUps > 0) {
    actions.push({
      id: 'collect_customers',
      title: 'Start with collections',
      message: `${followUps} customer follow-up${plural(followUps)} should be handled first.`,
      tone: 'primary',
      target: 'open_collections',
    });
  }
  if (pendingPayments > 0) {
    actions.push({
      id: 'verify_payments',
      title: 'Verify payments',
      message: `${pendingPayments} payment${plural(pendingPayments)} should be checked before balances are trusted.`,
      tone: 'warning',
      target: 'review_payments',
    });
  }
  if (stockAttention > 0) {
    actions.push({
      id: 'review_stock',
      title: 'Review stock',
      message: `${stockAttention} stock item${plural(stockAttention)} may affect sales.`,
      tone: 'warning',
      target: 'review_stock',
    });
  }
  if (actions.length === 0 && flags.length === 0) {
    actions.push({
      id: 'open_business',
      title: 'Open clean tomorrow',
      message: 'No carry-forward issue is waiting from today.',
      tone: 'success',
      target: 'save_closing',
    });
  }
  return actions;
}

function buildSummary(
  readyToClose: boolean,
  flags: OwnerClosingRitualFlag[],
  tomorrowActions: OwnerClosingTomorrowAction[]
): string {
  if (readyToClose) {
    return 'Today is ready to close cleanly.';
  }
  if (flags.length > 0) {
    return `${flags.length} closing item${plural(flags.length)} need${flags.length === 1 ? 's' : ''} review before the day is closed.`;
  }
  if (tomorrowActions.length > 0) {
    return 'Tomorrow’s action list is ready.';
  }
  return 'Review today’s checks, then save the closing summary.';
}

function step(input: {
  id: OwnerClosingRitualStepId;
  title: string;
  prompt: string;
  value: string;
  helper: string;
  tone: OwnerClosingRitualTone;
  completed: boolean;
  actionLabel: string;
  target: OwnerClosingRitualActionTarget;
}): OwnerClosingRitualStep {
  return {
    id: input.id,
    title: input.title,
    prompt: input.prompt,
    value: input.value,
    helper: input.helper,
    tone: input.tone,
    completed: input.completed,
    action: {
      label: input.actionLabel,
      target: input.target,
    },
  };
}

function flag(
  id: OwnerClosingRitualFlagId,
  title: string,
  message: string,
  tone: OwnerClosingRitualTone,
  actionLabel: string,
  target: OwnerClosingRitualActionTarget
): OwnerClosingRitualFlag {
  return {
    id,
    title,
    message,
    tone,
    actionLabel,
    target,
  };
}

function surface(
  area: OwnerClosingRitualStepId,
  label: string,
  userPromise: string,
  requiredData: string[],
  actionTarget: OwnerClosingRitualActionTarget
): OwnerClosingRitualSurfaceBlueprint {
  return {
    area,
    label,
    userPromise,
    requiredData,
    actionTarget,
  };
}

function cashMismatchAmount(signal?: OwnerClosingCashSignal | null): number {
  const expected = signal?.expectedCash;
  const counted = signal?.countedCash;
  if (!Number.isFinite(Number(expected)) || !Number.isFinite(Number(counted))) {
    return 0;
  }
  return roundMoney(Math.abs(Number(expected) - Number(counted)));
}

function buildTitle(businessName?: string | null, date?: string | null): string {
  const day = normalizeDate(date);
  return `${businessName?.trim() || 'Business'} closing · ${day}`;
}

function isEmptyInput(input: OwnerClosingRitualInput): boolean {
  return !input.cash && !input.ledger && !input.payments && !input.credit && !input.stock && !input.followUp;
}

function isFlag(value: OwnerClosingRitualFlag | null): value is OwnerClosingRitualFlag {
  return Boolean(value);
}

function count(value?: number | null): number {
  return Math.max(0, Math.round(Number.isFinite(Number(value)) ? Number(value) : 0));
}

function amount(value?: number | null): number {
  return roundMoney(Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0));
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeDate(value?: string | null): string {
  const text = value?.slice(0, 10);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : new Date().toISOString().slice(0, 10);
}

function normalizeCurrency(value?: string | null): string {
  return value && /^[A-Z]{3}$/.test(value) ? value : 'INR';
}

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat('en-IN', {
    currency,
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(amount(value));
}

function plural(value: number, singular = '', pluralValue = 's'): string {
  return value === 1 ? singular : pluralValue;
}
