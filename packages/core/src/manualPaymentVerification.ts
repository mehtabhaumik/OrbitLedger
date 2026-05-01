import type { PaymentAllocationStrategy } from './invoiceLifecycle';
import {
  doesPaymentAwaitClearance,
  doesPaymentClearInvoice,
  getPaymentClearanceStatusLabel,
  type PaymentClearanceStatus,
} from './paymentModes';

export type ManualPaymentVerificationPlan = {
  statusLabel: string;
  actionLabel: string;
  invoiceEffect: string;
  customerBalanceEffect: string;
  successMessage: string;
  requiresFollowUp: boolean;
};

export function getManualPaymentVerificationPlan(input: {
  clearanceStatus?: PaymentClearanceStatus | string | null;
  allocationStrategy?: PaymentAllocationStrategy | string | null;
}): ManualPaymentVerificationPlan {
  const status = input.clearanceStatus ?? 'cleared';
  const isMatchedToInvoice = input.allocationStrategy === 'oldest_invoice' || input.allocationStrategy === 'selected_invoice';
  const target = isMatchedToInvoice ? 'matched invoice' : 'customer ledger';

  if (doesPaymentClearInvoice(status)) {
    return {
      statusLabel: 'Verified',
      actionLabel: isMatchedToInvoice ? 'Record verified payment' : 'Record verified ledger payment',
      invoiceEffect: isMatchedToInvoice
        ? 'This payment applies to the matched invoice now.'
        : 'This payment reduces the customer balance now.',
      customerBalanceEffect: 'Customer balance reduces immediately.',
      successMessage: isMatchedToInvoice
        ? 'Verified payment recorded and applied to the invoice.'
        : 'Verified payment recorded on the customer ledger.',
      requiresFollowUp: false,
    };
  }

  if (doesPaymentAwaitClearance(status)) {
    return {
      statusLabel: getPaymentClearanceStatusLabel(status),
      actionLabel: isMatchedToInvoice ? 'Record pending payment' : 'Record pending ledger payment',
      invoiceEffect: isMatchedToInvoice
        ? 'The matched invoice stays pending until this payment clears.'
        : 'This stays on the customer ledger for follow-up.',
      customerBalanceEffect: 'Customer balance does not reduce until the payment is marked cleared.',
      successMessage: `Payment recorded for verification on the ${target}.`,
      requiresFollowUp: true,
    };
  }

  return {
    statusLabel: getPaymentClearanceStatusLabel(status),
    actionLabel: 'Record payment note',
    invoiceEffect: isMatchedToInvoice
      ? 'This does not reduce the invoice amount.'
      : 'This does not reduce the customer balance.',
    customerBalanceEffect: 'No balance change is applied.',
    successMessage: `Payment note recorded as ${getPaymentClearanceStatusLabel(status).toLowerCase()}.`,
    requiresFollowUp: false,
  };
}
