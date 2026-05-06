export type MistakeRecoveryArea =
  | 'payments'
  | 'invoices'
  | 'customer_ledger'
  | 'customers'
  | 'inventory'
  | 'documents'
  | 'settings'
  | 'backup_restore';

export type MistakeRecoverySignalKind =
  | 'payment_amount_wrong'
  | 'payment_applied_wrong_invoice'
  | 'payment_bounced_or_refunded'
  | 'invoice_draft_wrong'
  | 'saved_invoice_wrong'
  | 'sent_invoice_wrong_version'
  | 'customer_balance_wrong'
  | 'duplicate_customer'
  | 'stock_count_wrong'
  | 'wrong_document_shared'
  | 'sensitive_setting_changed'
  | 'restore_needs_rollback';

export type MistakeRecoveryTone = 'success' | 'primary' | 'warning' | 'danger' | 'neutral';

export type MistakeRecoveryRisk = 'low' | 'review' | 'protected' | 'blocked';

export type MistakeRecoveryActionTarget =
  | 'edit_draft'
  | 'create_invoice_revision'
  | 'restore_invoice_version'
  | 'cancel_invoice'
  | 'correct_payment'
  | 'move_payment'
  | 'reverse_payment'
  | 'add_ledger_correction'
  | 'merge_customer'
  | 'mark_customer_inactive'
  | 'adjust_stock'
  | 'send_corrected_document'
  | 'review_setting_audit'
  | 'open_restore_review';

export type MistakeRecoverySignal = {
  id: string;
  area: MistakeRecoveryArea;
  kind: MistakeRecoverySignalKind;
  title?: string | null;
  detail?: string | null;
  amount?: number | null;
  hasFinalRecord?: boolean | null;
  hasCustomerSeenDocument?: boolean | null;
  hasPaymentAllocation?: boolean | null;
  hasAuditImpact?: boolean | null;
  canEditDirectly?: boolean | null;
  occurredAt?: string | null;
};

export type MistakeRecoveryAction = {
  id: string;
  area: MistakeRecoveryArea;
  title: string;
  message: string;
  primaryAction: string;
  target: MistakeRecoveryActionTarget;
  risk: MistakeRecoveryRisk;
  tone: MistakeRecoveryTone;
  requiresReason: boolean;
  preservesHistory: boolean;
  guardrails: string[];
};

export type MistakeRecoveryOutput = {
  title: string;
  summary: string;
  actions: MistakeRecoveryAction[];
  guardrails: string[];
  emptyState: boolean;
};

export type MistakeRecoverySurfaceBlueprint = {
  area: MistakeRecoveryArea;
  label: string;
  userPromise: string;
  requiredData: string[];
};

export const MISTAKE_RECOVERY_SURFACES: MistakeRecoverySurfaceBlueprint[] = [
  surface('payments', 'Payment correction', 'Fix payment mistakes without losing the original payment history.', [
    'payment record',
    'allocation state',
    'clearance state',
    'reversal history',
  ]),
  surface('invoices', 'Invoice correction', 'Edit drafts freely, but correct saved invoices through versions and cancellation.', [
    'document state',
    'latest version',
    'sent/downloaded state',
    'payment allocation state',
  ]),
  surface('customer_ledger', 'Ledger correction', 'Correct balances through visible entries, not hidden overwrites.', [
    'customer balance',
    'original entry',
    'correction reason',
  ]),
  surface('customers', 'Customer cleanup', 'Merge or deactivate customers without breaking invoices and history.', [
    'duplicate markers',
    'linked invoices',
    'linked payments',
  ]),
  surface('inventory', 'Stock correction', 'Fix stock counts with a clear adjustment reason.', [
    'current quantity',
    'new quantity',
    'stock movement history',
  ]),
  surface('documents', 'Document recovery', 'Show what was sent and help send the corrected document clearly.', [
    'document version',
    'recipient',
    'sent time',
  ]),
  surface('settings', 'Settings correction', 'Protect money, tax, bank, and numbering settings with audit history.', [
    'previous value',
    'new value',
    'actor',
    'reason',
  ]),
  surface('backup_restore', 'Restore recovery', 'Review restore results and rollback options without hiding what changed.', [
    'restore preview',
    'restore result',
    'rollback copy',
  ]),
];

export const MISTAKE_RECOVERY_GUARDRAILS = [
  'Never silently overwrite money history.',
  'Drafts can be edited directly; saved documents use versions, cancellation, or correction notes.',
  'Payment amount changes should create a correction or reversal when reports or allocations are affected.',
  'Customer-facing documents should keep the exact version that was sent.',
  'Sensitive settings need confirmation, reason, and audit history.',
  'Restore recovery should show what changed before another restore or rollback action.',
];

export function buildMistakeRecoveryMode(input: {
  businessName?: string | null;
  signals?: MistakeRecoverySignal[] | null;
}): MistakeRecoveryOutput {
  const actions = (input.signals ?? []).map(signalToAction).sort(sortActions);

  return {
    title: `${input.businessName?.trim() || 'Business'} mistake recovery`,
    summary: buildSummary(actions),
    actions,
    guardrails: MISTAKE_RECOVERY_GUARDRAILS,
    emptyState: actions.length === 0,
  };
}

function signalToAction(signal: MistakeRecoverySignal): MistakeRecoveryAction {
  switch (signal.kind) {
    case 'payment_amount_wrong':
      return action(signal, {
        title: 'Correct payment amount',
        message: signal.hasPaymentAllocation
          ? 'This payment affects balances or invoices. Add a correction so history stays clear.'
          : 'Correct the payment details and keep the change reason with the record.',
        primaryAction: signal.hasPaymentAllocation ? 'Add correction' : 'Correct payment',
        target: signal.hasPaymentAllocation ? 'reverse_payment' : 'correct_payment',
        risk: signal.hasPaymentAllocation ? 'protected' : 'review',
        tone: signal.hasPaymentAllocation ? 'warning' : 'primary',
        requiresReason: true,
        preservesHistory: true,
        guardrails: ['Keep the original payment visible.', 'Recalculate invoice and customer balances after correction.'],
      });
    case 'payment_applied_wrong_invoice':
      return action(signal, {
        title: 'Move payment allocation',
        message: 'Move or split the payment instead of deleting the original record.',
        primaryAction: 'Move payment',
        target: 'move_payment',
        risk: 'protected',
        tone: 'warning',
        requiresReason: true,
        preservesHistory: true,
        guardrails: ['Keep the original payment.', 'Update old and new invoice payment states together.'],
      });
    case 'payment_bounced_or_refunded':
      return action(signal, {
        title: 'Reverse payment',
        message: 'Create a reversal so customer balance, invoice status, and reports stay correct.',
        primaryAction: 'Create reversal',
        target: 'reverse_payment',
        risk: 'protected',
        tone: 'danger',
        requiresReason: true,
        preservesHistory: true,
        guardrails: ['Do not delete the received payment.', 'Store bounce or refund evidence when available.'],
      });
    case 'invoice_draft_wrong':
      return action(signal, {
        title: 'Edit draft invoice',
        message: 'Draft invoices can be changed before they become official.',
        primaryAction: 'Edit draft',
        target: 'edit_draft',
        risk: 'low',
        tone: 'success',
        requiresReason: false,
        preservesHistory: false,
        guardrails: ['Do not show draft wording in generated customer documents.'],
      });
    case 'saved_invoice_wrong':
      return action(signal, {
        title: 'Create corrected invoice version',
        message: 'Saved invoices should be corrected with a new version, not overwritten.',
        primaryAction: 'Create revision',
        target: 'create_invoice_revision',
        risk: 'protected',
        tone: 'warning',
        requiresReason: true,
        preservesHistory: true,
        guardrails: ['Only the latest version can be edited.', 'Previous versions stay view-only.'],
      });
    case 'sent_invoice_wrong_version':
      return action(signal, {
        title: 'Send corrected invoice',
        message: 'Keep the version that was sent, then send a corrected version with a clear note.',
        primaryAction: 'Send corrected copy',
        target: 'send_corrected_document',
        risk: 'protected',
        tone: 'danger',
        requiresReason: true,
        preservesHistory: true,
        guardrails: ['Show which version was sent.', 'Mark the corrected version clearly in history.'],
      });
    case 'customer_balance_wrong':
      return action(signal, {
        title: 'Add balance correction',
        message: 'Use a visible correction entry so the balance can be trusted later.',
        primaryAction: 'Add correction',
        target: 'add_ledger_correction',
        risk: 'review',
        tone: 'warning',
        requiresReason: true,
        preservesHistory: true,
        guardrails: ['Do not edit old money entries silently.', 'Show the correction in customer memory.'],
      });
    case 'duplicate_customer':
      return action(signal, {
        title: 'Review duplicate customer',
        message: 'Merge carefully or mark one customer inactive after checking linked invoices and payments.',
        primaryAction: 'Review cleanup',
        target: signal.hasFinalRecord ? 'merge_customer' : 'mark_customer_inactive',
        risk: signal.hasFinalRecord ? 'protected' : 'review',
        tone: 'warning',
        requiresReason: true,
        preservesHistory: true,
        guardrails: ['Do not lose invoices, payments, promises, or notes.', 'Keep a cleanup note on the customer record.'],
      });
    case 'stock_count_wrong':
      return action(signal, {
        title: 'Adjust stock count',
        message: 'Add a stock adjustment with the reason for the new count.',
        primaryAction: 'Adjust stock',
        target: 'adjust_stock',
        risk: 'review',
        tone: 'primary',
        requiresReason: true,
        preservesHistory: true,
        guardrails: ['Keep the previous count visible.', 'Use a reason such as damage, return, count correction, or purchase update.'],
      });
    case 'wrong_document_shared':
      return action(signal, {
        title: 'Recover shared document',
        message: 'Send the corrected document and keep the original shared copy in history.',
        primaryAction: 'Send corrected document',
        target: 'send_corrected_document',
        risk: 'protected',
        tone: 'warning',
        requiresReason: true,
        preservesHistory: true,
        guardrails: ['Do not remove the proof of what was shared.', 'Show recipient, time, and version.'],
      });
    case 'sensitive_setting_changed':
      return action(signal, {
        title: 'Review protected setting',
        message: 'This setting can affect money, tax, payments, security, or restore safety.',
        primaryAction: 'Review audit',
        target: 'review_setting_audit',
        risk: 'protected',
        tone: 'warning',
        requiresReason: true,
        preservesHistory: true,
        guardrails: ['Show previous and new value safely.', 'Mask sensitive bank or security details where needed.'],
      });
    case 'restore_needs_rollback':
      return action(signal, {
        title: 'Review restore result',
        message: 'Check what changed before restoring again or using a rollback copy.',
        primaryAction: 'Open restore review',
        target: 'open_restore_review',
        risk: 'blocked',
        tone: 'danger',
        requiresReason: true,
        preservesHistory: true,
        guardrails: ['Never start a second restore without preview.', 'Keep the restore result and rollback option visible.'],
      });
  }
}

function action(
  signal: MistakeRecoverySignal,
  config: Omit<MistakeRecoveryAction, 'id' | 'area'>
): MistakeRecoveryAction {
  return {
    id: `${signal.kind}:${signal.id}`,
    area: signal.area,
    ...config,
  };
}

function sortActions(left: MistakeRecoveryAction, right: MistakeRecoveryAction): number {
  return riskRank(right.risk) - riskRank(left.risk) || areaRank(left.area) - areaRank(right.area) || left.title.localeCompare(right.title);
}

function riskRank(risk: MistakeRecoveryRisk): number {
  if (risk === 'blocked') {
    return 4;
  }
  if (risk === 'protected') {
    return 3;
  }
  if (risk === 'review') {
    return 2;
  }
  return 1;
}

function areaRank(area: MistakeRecoveryArea): number {
  const ranks: Record<MistakeRecoveryArea, number> = {
    backup_restore: 0,
    payments: 1,
    invoices: 2,
    documents: 3,
    customer_ledger: 4,
    customers: 5,
    inventory: 6,
    settings: 7,
  };
  return ranks[area];
}

function buildSummary(actions: MistakeRecoveryAction[]): string {
  if (!actions.length) {
    return 'No recovery work is waiting right now.';
  }
  if (actions.some((action) => action.risk === 'blocked')) {
    return 'Review the blocked recovery item before making more changes.';
  }
  if (actions.some((action) => action.risk === 'protected')) {
    return 'Use protected correction steps so business history stays trustworthy.';
  }
  return 'Review the suggested corrections and keep a clear reason for each change.';
}

function surface(
  area: MistakeRecoveryArea,
  label: string,
  userPromise: string,
  requiredData: string[]
): MistakeRecoverySurfaceBlueprint {
  return {
    area,
    label,
    userPromise,
    requiredData,
  };
}
