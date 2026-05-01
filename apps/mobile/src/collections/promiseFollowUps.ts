import type { PaymentPromiseStatus, PaymentPromiseWithCustomer } from '../database';
import { formatCurrency, formatShortDate } from '../lib/format';

export type PromiseFollowUpGroupKey = 'overdue' | 'today' | 'tomorrow' | 'later';

export type PromiseFollowUpItem = PaymentPromiseWithCustomer & {
  groupKey: PromiseFollowUpGroupKey;
  helper: string;
  statusLabel: string;
  tone: 'danger' | 'warning' | 'primary';
};

export type PromiseFollowUpGroup = {
  key: PromiseFollowUpGroupKey;
  title: string;
  subtitle: string;
  tone: 'danger' | 'warning' | 'primary';
  items: PromiseFollowUpItem[];
};

export type BuildPromiseFollowUpCalendarInput = {
  promises: PaymentPromiseWithCustomer[];
  date?: Date;
  currency: string;
};

export type PromiseReminderMessageInput = {
  businessName: string;
  currency: string;
  promise: PaymentPromiseWithCustomer;
};

const groupOrder: PromiseFollowUpGroupKey[] = ['overdue', 'today', 'tomorrow', 'later'];

export function buildPromiseFollowUpCalendar(
  input: BuildPromiseFollowUpCalendarInput
): PromiseFollowUpGroup[] {
  const today = toDateOnly(input.date ?? new Date());
  const tomorrow = addDays(today, 1);
  const items = input.promises
    .filter((promise) => promise.status === 'open' || promise.status === 'missed')
    .map((promise) => buildFollowUpItem(promise, today, tomorrow, input.currency))
    .sort((left, right) => {
      const groupDelta = groupOrder.indexOf(left.groupKey) - groupOrder.indexOf(right.groupKey);
      if (groupDelta !== 0) {
        return groupDelta;
      }

      const dateDelta = left.promisedDate.localeCompare(right.promisedDate);
      if (dateDelta !== 0) {
        return dateDelta;
      }

      return right.currentBalance - left.currentBalance;
    });

  return groupOrder
    .map((key) => buildGroup(key, items.filter((item) => item.groupKey === key)))
    .filter((group) => group.items.length > 0);
}

export function buildPromiseFollowUpReminderMessage(
  input: PromiseReminderMessageInput
): string {
  const amount = formatCurrency(input.promise.promisedAmount, input.currency);
  const balance = formatCurrency(Math.max(input.promise.currentBalance, 0), input.currency);
  const promisedDate = formatShortDate(input.promise.promisedDate);
  const hasPassed =
    input.promise.status === 'missed' || input.promise.promisedDate < new Date().toISOString().slice(0, 10);

  return [
    `Hi ${input.promise.customerName},`,
    '',
    hasPassed
      ? `This is a reminder from ${input.businessName}. The promised payment of ${amount} for ${promisedDate} is still pending.`
      : `This is a reminder from ${input.businessName}. Your promised payment of ${amount} is due on ${promisedDate}.`,
    `Current balance is ${balance}.`,
    'Please confirm when the payment will be sent.',
    '',
    `Thank you,\n${input.businessName}`,
  ].join('\n');
}

export function getPromiseFollowUpStatusActions(
  status: PaymentPromiseStatus
): PaymentPromiseStatus[] {
  if (status === 'open') {
    return ['fulfilled', 'missed', 'cancelled'];
  }

  if (status === 'missed') {
    return ['fulfilled', 'cancelled'];
  }

  return [];
}

function buildFollowUpItem(
  promise: PaymentPromiseWithCustomer,
  today: string,
  tomorrow: string,
  currency: string
): PromiseFollowUpItem {
  const groupKey = getGroupKey(promise, today, tomorrow);
  const amount = formatCurrency(promise.promisedAmount, currency);

  return {
    ...promise,
    groupKey,
    helper: `${amount} promised for ${formatShortDate(promise.promisedDate)}.`,
    statusLabel: getStatusLabel(promise.status, groupKey),
    tone: groupKey === 'overdue' ? 'danger' : groupKey === 'today' ? 'warning' : 'primary',
  };
}

function buildGroup(
  key: PromiseFollowUpGroupKey,
  items: PromiseFollowUpItem[]
): PromiseFollowUpGroup {
  if (key === 'overdue') {
    return {
      key,
      title: 'Overdue promises',
      subtitle: 'Call or message these customers first.',
      tone: 'danger',
      items,
    };
  }

  if (key === 'today') {
    return {
      key,
      title: 'Due today',
      subtitle: 'Keep these promises warm before the day ends.',
      tone: 'warning',
      items,
    };
  }

  if (key === 'tomorrow') {
    return {
      key,
      title: 'Tomorrow',
      subtitle: 'Prepare a gentle reminder if needed.',
      tone: 'primary',
      items,
    };
  }

  return {
    key,
    title: 'Later',
    subtitle: 'Upcoming promises to keep on your radar.',
    tone: 'primary',
    items,
  };
}

function getGroupKey(
  promise: PaymentPromiseWithCustomer,
  today: string,
  tomorrow: string
): PromiseFollowUpGroupKey {
  if (promise.status === 'missed' || promise.promisedDate < today) {
    return 'overdue';
  }

  if (promise.promisedDate === today) {
    return 'today';
  }

  if (promise.promisedDate === tomorrow) {
    return 'tomorrow';
  }

  return 'later';
}

function getStatusLabel(status: PaymentPromiseStatus, groupKey: PromiseFollowUpGroupKey): string {
  if (status === 'missed' || groupKey === 'overdue') {
    return 'Missed';
  }

  if (groupKey === 'today') {
    return 'Due today';
  }

  if (groupKey === 'tomorrow') {
    return 'Tomorrow';
  }

  return 'Planned';
}

function addDays(dateOnly: string, days: number): string {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}
