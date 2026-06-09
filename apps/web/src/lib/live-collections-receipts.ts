import type { OrbitWorkspaceSummary } from '@orbit-ledger/contracts';

import {
  getNotificationReminderPreferences,
  renderReminderTemplate,
  type NotificationReminderPreferences,
} from './notification-preferences';
import type { WorkspaceCustomer, WorkspaceInvoiceDetail, WorkspacePaymentProviderEvent } from './workspace-data';
import { buildWorkspaceProfileView } from './workspace-profile-view';

export type LiveCollectionReceiptFollowUpState = 'stop' | 'adjust' | 'continue' | 'review';

export type LiveCollectionReceiptAutomation = {
  eligible: boolean;
  title: string;
  amountLabel: string;
  receiptReference: string;
  receiptMessage: string;
  whatsappMessage: string;
  emailSubject: string;
  followUpState: LiveCollectionReceiptFollowUpState;
  followUpLabel: string;
  followUpHelper: string;
  sourceLabel: string;
  eventId: string | null;
  recordedAt: string | null;
};

export type BuildLiveCollectionReceiptAutomationInput = {
  workspace: Pick<OrbitWorkspaceSummary, 'businessName' | 'email' | 'phone' | 'currency'> &
    Partial<Pick<OrbitWorkspaceSummary, 'legalName' | 'ownerName' | 'entityType' | 'entitySubtype'>>;
  customer: Pick<WorkspaceCustomer, 'name' | 'email' | 'whatsapp'> | null;
  invoice: Pick<WorkspaceInvoiceDetail, 'id' | 'invoiceNumber' | 'totalAmount' | 'paidAmount' | 'paymentStatus'>;
  events?: WorkspacePaymentProviderEvent[];
  preferences?: NotificationReminderPreferences;
};

export function buildLiveCollectionReceiptAutomation(
  input: BuildLiveCollectionReceiptAutomationInput
): LiveCollectionReceiptAutomation {
  const currency = input.workspace.currency || 'INR';
  const customerName = input.customer?.name || 'Customer';
  const dueAmount = money(input.invoice.totalAmount - input.invoice.paidAmount);
  const latestReceiptEvent = findLatestReceiptEvent(input.invoice.id, input.events ?? []);
  const paidByAllocation = input.invoice.paymentStatus === 'paid' && dueAmount <= 0 && input.invoice.paidAmount > 0;
  const eligible = Boolean(latestReceiptEvent || paidByAllocation);
  const amount = latestReceiptEvent?.allocationAmount || latestReceiptEvent?.amount || input.invoice.paidAmount;
  const amountLabel = formatReceiptAmount(amount, currency);
  const preferences = input.preferences ?? getNotificationReminderPreferences(null);
  const profile = buildWorkspaceProfileView({
    workspaceId: 'receipt-workspace',
    address: '',
    countryCode: 'IN',
    stateCode: '',
    ...input.workspace,
    ownerName: input.workspace.ownerName ?? input.workspace.businessName,
    logoUri: null,
    paymentInstructions: {},
    dataState: 'profile_only',
  } as OrbitWorkspaceSummary);
  const receiptMessage = renderReminderTemplate(preferences.paymentThankYouTemplate, {
    businessName: profile.displayName,
    customerName,
    amount: amountLabel,
    reference: input.invoice.invoiceNumber,
  });
  const sourceLabel = latestReceiptEvent
    ? 'Verified online payment'
    : paidByAllocation
      ? 'Saved payment allocation'
      : 'Waiting for verified payment';

  return {
    eligible,
    title: eligible ? 'Receipt ready' : 'Receipt not ready yet',
    amountLabel,
    receiptReference: input.invoice.invoiceNumber,
    receiptMessage: eligible ? receiptMessage : 'A receipt will be available after a verified payment is applied to this invoice.',
    whatsappMessage: eligible
      ? buildReceiptWhatsAppMessage({
          customerName,
          businessName: profile.displayName,
          invoiceNumber: input.invoice.invoiceNumber,
          amountLabel,
          businessPhone: input.workspace.phone,
          businessEmail: input.workspace.email,
        })
      : 'A receipt will be available after a verified payment is applied to this invoice.',
    emailSubject: `Receipt for invoice ${input.invoice.invoiceNumber} from ${profile.displayName}`,
    followUpState: followUpStateForInvoice({
      eligible,
      dueAmount,
      paymentStatus: input.invoice.paymentStatus,
      latestReceiptEvent,
    }),
    followUpLabel: followUpLabelForInvoice({
      eligible,
      dueAmount,
      paymentStatus: input.invoice.paymentStatus,
      latestReceiptEvent,
    }),
    followUpHelper: followUpHelperForInvoice({
      eligible,
      dueAmount,
      paymentStatus: input.invoice.paymentStatus,
      latestReceiptEvent,
    }),
    sourceLabel,
    eventId: latestReceiptEvent?.id ?? null,
    recordedAt: latestReceiptEvent?.lastModified || latestReceiptEvent?.createdAt || null,
  };
}

export function shouldStopInvoiceFollowUps(automation: Pick<LiveCollectionReceiptAutomation, 'followUpState'>) {
  return automation.followUpState === 'stop';
}

function findLatestReceiptEvent(invoiceId: string, events: WorkspacePaymentProviderEvent[]) {
  return events
    .filter((event) => event.invoiceId === invoiceId)
    .filter((event) => !event.reversed && event.refundedAmount <= 0 && !event.error)
    .filter((event) => event.applied && isReceiptPaymentStatus(event.status))
    .sort((left, right) => (right.lastModified || right.createdAt).localeCompare(left.lastModified || left.createdAt))[0] ?? null;
}

function isReceiptPaymentStatus(value: string | null | undefined) {
  const normalized = (value ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  return normalized === 'succeeded' || normalized === 'captured' || normalized === 'paid' || normalized === 'cleared';
}

function followUpStateForInvoice(input: {
  eligible: boolean;
  dueAmount: number;
  paymentStatus: string;
  latestReceiptEvent: WorkspacePaymentProviderEvent | null;
}): LiveCollectionReceiptFollowUpState {
  if (input.latestReceiptEvent?.applyStatus === 'needs_review') {
    return 'review';
  }
  if (!input.eligible) {
    return 'continue';
  }
  if (input.paymentStatus === 'paid' && input.dueAmount <= 0) {
    return 'stop';
  }
  return 'adjust';
}

function followUpLabelForInvoice(input: {
  eligible: boolean;
  dueAmount: number;
  paymentStatus: string;
  latestReceiptEvent: WorkspacePaymentProviderEvent | null;
}) {
  const state = followUpStateForInvoice(input);
  switch (state) {
    case 'stop':
      return 'Follow-ups stopped';
    case 'adjust':
      return 'Follow-ups adjusted';
    case 'review':
      return 'Review before follow-up';
    case 'continue':
    default:
      return 'Follow-ups continue';
  }
}

function followUpHelperForInvoice(input: {
  eligible: boolean;
  dueAmount: number;
  paymentStatus: string;
  latestReceiptEvent: WorkspacePaymentProviderEvent | null;
}) {
  const state = followUpStateForInvoice(input);
  switch (state) {
    case 'stop':
      return 'This invoice is fully paid from verified allocation. Payment reminders for this invoice should stop.';
    case 'adjust':
      return 'A payment was recorded, but this invoice still has an amount due. Continue follow-up only for the remaining balance.';
    case 'review':
      return 'The latest payment event needs review. Keep follow-ups paused until the payment is reconciled.';
    case 'continue':
    default:
      return 'No verified payment has been applied yet. Existing follow-up rhythm can continue.';
  }
}

function buildReceiptWhatsAppMessage(input: {
  customerName: string;
  businessName: string;
  invoiceNumber: string;
  amountLabel: string;
  businessPhone: string;
  businessEmail: string;
}) {
  const contactLine = [input.businessPhone, input.businessEmail].filter(Boolean).join(' | ');
  return [
    `Hello ${input.customerName},`,
    '',
    `Thank you. We received ${input.amountLabel} for invoice ${input.invoiceNumber}.`,
    '',
    `Receipt recorded by ${input.businessName}.`,
    contactLine ? `Contact: ${contactLine}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatReceiptAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(money(amount));
  } catch {
    return `${currency} ${money(amount).toFixed(2)}`;
  }
}

function money(value: number) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}
