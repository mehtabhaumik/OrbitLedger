import { formatCurrency, formatShortDate } from '../lib/format';
import type {
  DashboardSummary,
  PaymentPromiseWithCustomer,
  RecentTransaction,
  TopDueCustomer,
} from '../database';

export type PracticalHelperTarget =
  | 'get_paid'
  | 'monthly_review'
  | 'business_health'
  | 'daily_closing'
  | 'customers';

export type PracticalHelperCard = {
  id: string;
  title: string;
  subtitle: string;
  result: string;
  actionLabel: string;
  target: PracticalHelperTarget;
  priority: 'high' | 'medium' | 'low';
  privacyNote: string;
};

export type BuildPracticalHelpersInput = {
  businessName: string;
  currency: string;
  summary: DashboardSummary | null;
  topDueCustomers: TopDueCustomer[];
  recentTransactions: RecentTransaction[];
  promises: PaymentPromiseWithCustomer[];
  date?: Date;
};

const privacyNote = 'Runs on this device. No customer data is sent out.';

export function buildPracticalHelperCards(
  input: BuildPracticalHelpersInput
): PracticalHelperCard[] {
  const today = toDateOnly(input.date ?? new Date());
  const topDue = [...input.topDueCustomers].sort((left, right) => right.balance - left.balance);
  const firstDue = topDue[0] ?? null;
  const dueTodayOrMissed = input.promises.filter(
    (promise) => promise.status === 'missed' || promise.promisedDate <= today
  );
  const unusualEntries = findUnusualEntries(input.recentTransactions, input.currency);

  return [
    buildCollectionMessageHelper(input, firstDue),
    buildCallFirstHelper(input, firstDue, dueTodayOrMissed[0] ?? null),
    buildReceivablesHelper(input),
    buildMonthSummaryHelper(input),
    buildSuspiciousEntryHelper(unusualEntries),
    buildTomorrowPlanHelper(input, firstDue),
  ];
}

export function redactHelperText(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email hidden]')
    .replace(/\b[A-Z0-9._-]{2,}@[A-Z][A-Z0-9._-]{1,}\b/gi, '[payment id hidden]')
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, '[phone hidden]');
}

function buildCollectionMessageHelper(
  input: BuildPracticalHelpersInput,
  firstDue: TopDueCustomer | null
): PracticalHelperCard {
  if (!firstDue) {
    return {
      id: 'collection_message',
      title: 'Prepare a collection message',
      subtitle: 'No overdue customer needs a message right now.',
      result: 'All clear. When a customer has a balance, this helper prepares a polite payment request.',
      actionLabel: 'Open Get Paid',
      target: 'get_paid',
      priority: 'low',
      privacyNote,
    };
  }

  return {
    id: 'collection_message',
    title: 'Prepare a collection message',
    subtitle: `${firstDue.name} has ${formatCurrency(firstDue.balance, input.currency)} pending.`,
    result: `Start with ${firstDue.name}. Share a short payment request and ask them to reply after payment. Mark payment only after you confirm it.`,
    actionLabel: 'Open Get Paid',
    target: 'get_paid',
    priority: 'high',
    privacyNote,
  };
}

function buildCallFirstHelper(
  input: BuildPracticalHelpersInput,
  firstDue: TopDueCustomer | null,
  promise: PaymentPromiseWithCustomer | null
): PracticalHelperCard {
  const targetCustomer = promise
    ? {
        name: promise.customerName,
        balance: promise.currentBalance,
        reason: `Promise was due on ${formatShortDate(promise.promisedDate)}.`,
      }
    : firstDue
      ? {
          name: firstDue.name,
          balance: firstDue.balance,
          reason: firstDue.lastPaymentAt
            ? `Last payment was ${formatShortDate(firstDue.lastPaymentAt)}.`
            : 'No payment is recorded yet.',
        }
      : null;

  return {
    id: 'call_first',
    title: 'Who to call first',
    subtitle: targetCustomer
      ? `${targetCustomer.name} should be first.`
      : 'No call is urgent right now.',
    result: targetCustomer
      ? `${targetCustomer.reason} Current balance is ${formatCurrency(
          targetCustomer.balance,
          input.currency
        )}.`
      : 'Use this when overdue promises or high balances appear.',
    actionLabel: 'Open Get Paid',
    target: 'get_paid',
    priority: targetCustomer ? 'high' : 'low',
    privacyNote,
  };
}

function buildReceivablesHelper(input: BuildPracticalHelpersInput): PracticalHelperCard {
  const summary = input.summary;
  if (!summary) {
    return {
      id: 'receivables_change',
      title: 'Explain receivables',
      subtitle: 'Receivable data is not ready yet.',
      result: 'Open the dashboard once so Orbit Ledger can prepare the current receivable picture.',
      actionLabel: 'Open Business Health',
      target: 'business_health',
      priority: 'medium',
      privacyNote,
    };
  }

  const activityDirection =
    summary.recentActivityCount > summary.previousActivityCount
      ? 'activity increased'
      : summary.recentActivityCount < summary.previousActivityCount
        ? 'activity slowed'
        : 'activity stayed steady';

  return {
    id: 'receivables_change',
    title: 'Explain receivables',
    subtitle: `${formatCurrency(summary.totalReceivable, input.currency)} is currently pending.`,
    result: `${summary.customersWithOutstandingBalance} customers have dues. Recent ${activityDirection}; ${summary.recentPaymentsReceived} payments were recorded recently.`,
    actionLabel: 'Open Business Health',
    target: 'business_health',
    priority: summary.followUpCustomerCount > 0 ? 'high' : 'medium',
    privacyNote,
  };
}

function buildMonthSummaryHelper(input: BuildPracticalHelpersInput): PracticalHelperCard {
  const summary = input.summary;
  const result = summary
    ? `${summary.todayEntries} entries today. ${summary.followUpCustomerCount} customers need follow-up. Open the monthly review for sales, payments, dues, and stock signals.`
    : 'Open the monthly review for sales, payments, dues, and stock signals.';

  return {
    id: 'month_summary',
    title: 'Summarize this month',
    subtitle: 'Prepare a practical month review.',
    result,
    actionLabel: 'Open Monthly Review',
    target: 'monthly_review',
    priority: summary?.followUpCustomerCount ? 'medium' : 'low',
    privacyNote,
  };
}

function buildSuspiciousEntryHelper(entries: string[]): PracticalHelperCard {
  return {
    id: 'suspicious_entries',
    title: 'Spot entries to review',
    subtitle: entries.length ? `${entries.length} entry checks found.` : 'No unusual recent entry found.',
    result: entries.length
      ? entries.slice(0, 2).join(' ')
      : 'Recent entries look normal. This helper checks large amounts and repeated entries.',
    actionLabel: 'Review Reports',
    target: 'business_health',
    priority: entries.length ? 'high' : 'low',
    privacyNote,
  };
}

function buildTomorrowPlanHelper(
  input: BuildPracticalHelpersInput,
  firstDue: TopDueCustomer | null
): PracticalHelperCard {
  const tomorrow = addDays(toDateOnly(input.date ?? new Date()), 1);
  const promisesTomorrow = input.promises.filter((promise) => promise.promisedDate === tomorrow);
  const firstAction = promisesTomorrow[0]
    ? `Follow up ${promisesTomorrow[0].customerName}'s promised payment.`
    : firstDue
      ? `Start with ${firstDue.name}'s pending balance.`
      : 'Check new ledger entries and close the day.';

  return {
    id: 'tomorrow_plan',
    title: "Prepare tomorrow's plan",
    subtitle: promisesTomorrow.length
      ? `${promisesTomorrow.length} promises need attention tomorrow.`
      : 'A simple plan for the next working day.',
    result: `${firstAction} Then review reminders, record confirmed payments, and save a backup after important changes.`,
    actionLabel: 'Open Daily Closing',
    target: 'daily_closing',
    priority: promisesTomorrow.length || firstDue ? 'medium' : 'low',
    privacyNote,
  };
}

function findUnusualEntries(entries: RecentTransaction[], currency: string): string[] {
  if (!entries.length) {
    return [];
  }

  const amounts = entries.map((entry) => entry.amount).sort((a, b) => a - b);
  const median = amounts[Math.floor(amounts.length / 2)] || 0;
  const findings: string[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    if (median > 0 && entry.amount >= median * 3 && entry.amount >= 1000) {
      findings.push(
        `${entry.customerName} has a large ${entry.type} entry of ${formatCurrency(entry.amount, currency)}.`
      );
    }

    const duplicateKey = `${entry.customerId}:${entry.type}:${entry.amount}:${entry.effectiveDate}`;
    if (seen.has(duplicateKey)) {
      findings.push(
        `${entry.customerName} has repeated ${entry.type} entries for ${formatCurrency(
          entry.amount,
          currency
        )} on ${formatShortDate(entry.effectiveDate)}.`
      );
    }
    seen.add(duplicateKey);
  }

  return findings;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(dateOnly: string, days: number): string {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
