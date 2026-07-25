import { addWorkspacePaymentReminder, type WorkspacePaymentReminderTone } from './workspace-data';

/**
 * Bulk payment-reminder logging.
 *
 * The app has no automated reminder dispatch - reminders are recorded and the
 * message is sent by hand (WhatsApp, etc.). This records a reminder entry for
 * each selected customer with an outstanding balance, so a round of follow-ups
 * is logged in one action instead of opening each customer. It never sends
 * anything outward.
 */

export type BulkReminderCustomer = {
  id: string;
  name: string;
  balance: number;
};

export type BulkReminderResult = {
  logged: string[];
  failed: Array<{ id: string; error: string }>;
  skipped: string[];
};

/** Only customers who actually owe money get a reminder logged. */
export function isEligibleForReminder(balance: number): boolean {
  return Number.isFinite(balance) && balance > 0;
}

/**
 * Default reminder text for a logged follow-up. Kept plain and factual - it is
 * a record of intent, and the operator edits/sends the real message manually.
 */
export function defaultReminderMessage(customer: BulkReminderCustomer, currency: string): string {
  const amount = new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(
    customer.balance
  );
  return `Payment reminder logged for ${customer.name}. Outstanding balance ${amount}.`;
}

export async function bulkLogCustomerReminders(
  workspaceId: string,
  customers: BulkReminderCustomer[],
  options: { tone: WorkspacePaymentReminderTone; currency: string }
): Promise<BulkReminderResult> {
  const result: BulkReminderResult = { logged: [], failed: [], skipped: [] };

  for (const customer of customers) {
    if (!isEligibleForReminder(customer.balance)) {
      result.skipped.push(customer.id);
      continue;
    }
    try {
      await addWorkspacePaymentReminder(workspaceId, {
        customerId: customer.id,
        tone: options.tone,
        message: defaultReminderMessage(customer, options.currency),
        balanceAtSend: customer.balance,
        sharedVia: 'bulk_log',
      });
      result.logged.push(customer.id);
    } catch (error) {
      result.failed.push({ id: customer.id, error: error instanceof Error ? error.message : 'Unknown error.' });
    }
  }

  return result;
}
