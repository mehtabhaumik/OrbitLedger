import {
  getWorkspaceInvoiceDetail,
  saveWorkspaceInvoiceDetail,
  type SaveWorkspaceInvoiceInput,
  type WorkspaceInvoiceDetail,
} from './workspace-data';

/**
 * Bulk invoice status changes.
 *
 * There is no lightweight "set payment status" write - status persists through
 * saveWorkspaceInvoiceDetail, which rebuilds the whole invoice (items, totals,
 * versioning, audit). The list only holds summaries, so each invoice is loaded
 * in full, its status flipped, and re-saved through the exact same pipeline the
 * detail screen uses. This keeps bulk changes identical to single-row edits
 * rather than poking Firestore fields directly.
 */

export type BulkStatusResult = {
  succeeded: string[];
  failed: Array<{ id: string; error: string }>;
  skipped: string[];
};

/**
 * Rebuilds the save input from a loaded detail, overriding only the payment
 * status. Pure so it can be unit-tested without Firestore. Everything else is
 * carried through unchanged, so a re-save is a no-op except for the status.
 */
export function invoiceDetailToPaidInput(detail: WorkspaceInvoiceDetail): SaveWorkspaceInvoiceInput {
  return {
    customerId: detail.customerId ?? null,
    invoiceNumber: detail.invoiceNumber,
    issueDate: detail.issueDate,
    dueDate: detail.dueDate,
    documentState: detail.documentState,
    paymentStatus: 'paid',
    paymentStatusReason: null,
    revisionReason: 'Marked paid in bulk',
    notes: detail.notes,
    items: detail.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      price: item.price,
      taxRate: item.taxRate,
    })),
  };
}

/** Statuses that should not be bulk-marked paid. */
export function isEligibleForBulkPaid(paymentStatus: string, documentState: string): boolean {
  return paymentStatus !== 'paid' && documentState !== 'cancelled';
}

/**
 * Marks each invoice paid, one at a time so a single failure does not abort the
 * rest. The caller is expected to have already confirmed and to already know
 * which ids are eligible.
 */
export async function bulkMarkInvoicesPaid(
  workspaceId: string,
  invoiceIds: string[]
): Promise<BulkStatusResult> {
  const result: BulkStatusResult = { succeeded: [], failed: [], skipped: [] };

  for (const invoiceId of invoiceIds) {
    try {
      const detail = await getWorkspaceInvoiceDetail(workspaceId, invoiceId);
      if (!detail) {
        result.failed.push({ id: invoiceId, error: 'Invoice could not be loaded.' });
        continue;
      }
      if (!isEligibleForBulkPaid(detail.paymentStatus, detail.documentState)) {
        result.skipped.push(invoiceId);
        continue;
      }
      await saveWorkspaceInvoiceDetail(workspaceId, invoiceId, invoiceDetailToPaidInput(detail));
      result.succeeded.push(invoiceId);
    } catch (error) {
      result.failed.push({ id: invoiceId, error: error instanceof Error ? error.message : 'Unknown error.' });
    }
  }

  return result;
}
