'use client';

import { getOrbitLedgerPaidPlan, type OrbitLedgerPaidPlanId } from '@orbit-ledger/core';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';

import { getWebAuth, getWebFirebaseProjectId, getWebFirestore } from './firebase';
import {
  parseWebServerSubscriptionEntitlement,
  type WebPlanChangeKind,
  type WebStoredSubscriptionStatus,
} from './web-monetization';

export type WebSubscriptionBillingFields = {
  receiptNumber: string | null;
  receiptStatus: string | null;
  taxInvoiceNumber: string | null;
  taxInvoiceStatus: string | null;
  taxCountry: string | null;
  taxLabel: string | null;
  taxRegistrationLabel: string | null;
  taxRegistrationNumber: string | null;
  taxDocumentLabel: string | null;
  receiptLabel: string | null;
  taxTreatment: string | null;
  taxCalculationStatus: string | null;
  taxComplianceReviewStatus: string | null;
  taxComplianceMessage: string | null;
  taxComplianceBasis: string | null;
  taxRegistrationRequired: boolean | null;
  taxRegistrationPresent: boolean | null;
  taxInclusivePricing: boolean | null;
  amountDisplay: string | null;
  amountMinor: number | null;
  subtotalMinor: number | null;
  taxMinor: number | null;
  totalMinor: number | null;
  currency: string | null;
  buyerBusinessName: string | null;
  buyerLegalName: string | null;
  buyerEmail: string | null;
  buyerCountry: string | null;
  buyerState: string | null;
  sellerBrand: string | null;
  issuedAt: string | null;
  createdAt: string | null;
  billingEmailStatus: string | null;
  billingEmailDeliveryStatus: string | null;
  billingEmailProviderStatus: string | null;
  billingEmailRecipient: string | null;
  billingEmailRequestedAt: string | null;
  billingEmailSentAt: string | null;
  billingEmailRequestId: string | null;
  billingEmailAdminQueueId: string | null;
  billingEmailAdminReviewStatus: string | null;
  billingEmailResendCount: number | null;
  billingEmailLastResendAt: string | null;
  billingEmailLastError: string | null;
  billingRecoveryStatus: string | null;
  billingRecoveredAt: string | null;
};

export type WebSubscriptionPurchaseEvent = WebSubscriptionBillingFields & {
  id: string;
  planId: string;
  status: string;
  provider: string;
  checkoutIntentId: string | null;
  transactionId: string | null;
  providerReference: string | null;
  receivedAt: string | null;
};

export type WebSubscriptionEntitlementAuditItem = WebSubscriptionBillingFields & {
  id: string;
  action: string;
  planId: string;
  status: string;
  provider: string;
  transactionId: string | null;
  validUntil: string | null;
  receivedAt: string | null;
};

export type WebSubscriptionCheckoutRecord = WebSubscriptionBillingFields & {
  id: string;
  planId: string;
  status: string;
  provider: string;
  checkoutIntentId: string | null;
  transactionId: string | null;
  providerReference: string | null;
  updatedAt: string | null;
};

export type WebSubscriptionPurchaseReview = {
  checkouts: WebSubscriptionCheckoutRecord[];
  events: WebSubscriptionPurchaseEvent[];
  auditItems: WebSubscriptionEntitlementAuditItem[];
};

export type WebSubscriptionRenewalChange = {
  id: string;
  workspaceId: string;
  requestedBy: string;
  currentPlanId: OrbitLedgerPaidPlanId;
  targetPlanId: OrbitLedgerPaidPlanId;
  currentPlanLabel: string;
  targetPlanLabel: string;
  changeKind: Extract<WebPlanChangeKind, 'downgrade' | 'billing_change'>;
  status: 'queued' | 'cancelled' | 'applied' | 'rejected';
  reviewStatus: 'needs_review' | 'ready_for_review' | 'processing' | 'completed' | 'cancelled' | 'rejected';
  serverSyncStatus: 'queued' | 'ready_for_admin_review' | 'processing' | 'completed' | 'cancelled' | 'rejected';
  requestedAt: string | null;
  applyAfter: string | null;
  adminQueueId: string | null;
  providerPortalStatus: 'pending_provider_connection';
  providerActionRequired: boolean;
  lastReviewNote: string | null;
};

export type WebSubscriptionRenewalAuditItem = {
  id: string;
  action: string;
  status: string;
  reviewStatus: string;
  serverSyncStatus: string;
  currentPlanLabel: string | null;
  targetPlanLabel: string | null;
  resolvedBy: string | null;
  providerReference: string | null;
  note: string | null;
  createdAt: string | null;
};

export type QueueSubscriptionRenewalChangeInput = {
  userId: string;
  workspaceId: string;
  currentPlanId: OrbitLedgerPaidPlanId;
  targetPlanId: OrbitLedgerPaidPlanId;
  changeKind: Extract<WebPlanChangeKind, 'downgrade' | 'billing_change'>;
  applyAfter: string | null;
};

type ManageSubscriptionRenewalChangeResponse =
  | {
      ok: true;
      action: 'queued' | 'cancelled';
      renewalChangeId: string;
      provider?: string;
      providerPortalStatus?: string;
      message?: string;
    }
  | {
      ok: false;
      error: string;
      renewalChangeId?: string;
      message?: string;
    };

export async function loadServerSubscriptionEntitlement(
  userId: string,
  workspaceId: string
): Promise<WebStoredSubscriptionStatus | null> {
  const snapshot = await getDoc(
    doc(getWebFirestore(), 'users', userId, 'subscription_entitlements', workspaceId)
  );
  if (!snapshot.exists()) {
    return null;
  }

  return parseWebServerSubscriptionEntitlement(snapshot.data());
}

export async function loadSubscriptionPurchaseReview(
  userId: string,
  workspaceId: string
): Promise<WebSubscriptionPurchaseReview> {
  const firestore = getWebFirestore();
  const [checkoutSnapshot, eventSnapshot, auditSnapshot] = await Promise.all([
    getDocs(
      query(
        collection(firestore, 'workspaces', workspaceId, 'subscription_checkouts'),
        orderBy('last_modified', 'desc'),
        limit(8)
      )
    ),
    getDocs(
      query(
        collection(firestore, 'workspaces', workspaceId, 'subscription_events'),
        orderBy('received_at', 'desc'),
        limit(8)
      )
    ),
    getDocs(
      query(
        collection(firestore, 'users', userId, 'subscription_entitlement_audit'),
        where('workspace_id', '==', workspaceId),
        limit(20)
      )
    ),
  ]);

  return {
    checkouts: checkoutSnapshot.docs.map((item) => parseCheckoutRecord(item.id, item.data())),
    events: eventSnapshot.docs.map((item) => parsePurchaseEvent(item.id, item.data())),
    auditItems: auditSnapshot.docs
      .map((item) => parseAuditItem(item.id, item.data()))
      .sort((left, right) => compareDescending(left.receivedAt, right.receivedAt))
      .slice(0, 8),
  };
}

export async function loadSubscriptionRenewalChanges(workspaceId: string): Promise<WebSubscriptionRenewalChange[]> {
  const snapshot = await getDocs(
    query(
      collection(getWebFirestore(), 'workspaces', workspaceId, 'subscription_renewal_changes'),
      orderBy('requested_at', 'desc'),
      limit(12)
    )
  );

  return snapshot.docs.map((item) => parseRenewalChange(item.id, item.data()));
}

export async function loadSubscriptionRenewalAudit(workspaceId: string): Promise<WebSubscriptionRenewalAuditItem[]> {
  const snapshot = await getDocs(
    query(
      collection(getWebFirestore(), 'workspaces', workspaceId, 'subscription_renewal_audit'),
      orderBy('created_at', 'desc'),
      limit(12)
    )
  );

  return snapshot.docs.map((item) => parseRenewalAuditItem(item.id, item.data()));
}

export async function queueSubscriptionRenewalChange(
  input: QueueSubscriptionRenewalChangeInput
): Promise<WebSubscriptionRenewalChange> {
  const result = await manageSubscriptionRenewalChange({
    action: 'queue',
    workspaceId: input.workspaceId,
    targetPlanId: input.targetPlanId,
    applyAfter: input.applyAfter,
  });
  const changes = await loadSubscriptionRenewalChanges(input.workspaceId);
  const queued = changes.find((item) => item.id === result.renewalChangeId);
  if (!queued) {
    throw new Error('Renewal change was saved but could not be loaded.');
  }
  return queued;
}

export async function cancelSubscriptionRenewalChange(
  workspaceId: string,
  renewalChangeId: string
): Promise<void> {
  await manageSubscriptionRenewalChange({
    action: 'cancel',
    workspaceId,
    renewalChangeId,
  });
}

function parseCheckoutRecord(id: string, data: Record<string, unknown>): WebSubscriptionCheckoutRecord {
  return {
    id,
    planId: stringValue(data.planId) ?? stringValue(data.plan_id) ?? 'Plan',
    status: stringValue(data.provider_status) ?? stringValue(data.status) ?? 'recorded',
    provider: providerLabel(stringValue(data.provider)),
    checkoutIntentId: stringValue(data.checkoutIntentId) ?? stringValue(data.checkout_intent_id),
    transactionId: stringValue(data.transactionId) ?? stringValue(data.transaction_id),
    providerReference: stringValue(data.providerReference) ?? stringValue(data.provider_reference) ?? stringValue(data.reference),
    updatedAt: stringValue(data.last_modified) ?? stringValue(data.created_at),
    ...parseBillingFields(data),
  };
}

function parsePurchaseEvent(id: string, data: Record<string, unknown>): WebSubscriptionPurchaseEvent {
  return {
    id,
    planId: stringValue(data.planId) ?? stringValue(data.plan_id) ?? 'Plan',
    status: stringValue(data.status) ?? 'recorded',
    provider: providerLabel(stringValue(data.provider)),
    checkoutIntentId: stringValue(data.checkoutIntentId) ?? stringValue(data.checkout_intent_id),
    transactionId: stringValue(data.transactionId) ?? stringValue(data.transaction_id),
    providerReference: stringValue(data.providerReference) ?? stringValue(data.provider_reference),
    receivedAt: stringValue(data.received_at),
    ...parseBillingFields(data),
  };
}

function parseAuditItem(id: string, data: Record<string, unknown>): WebSubscriptionEntitlementAuditItem {
  return {
    id,
    action: stringValue(data.action) ?? 'entitlement_event_recorded',
    planId: stringValue(data.plan_id) ?? 'Plan',
    status: stringValue(data.status) ?? 'recorded',
    provider: providerLabel(stringValue(data.provider)),
    transactionId: stringValue(data.transaction_id),
    validUntil: stringValue(data.valid_until),
    receivedAt: stringValue(data.received_at) ?? stringValue(data.created_at),
    ...parseBillingFields(data),
  };
}

function parseBillingFields(data: Record<string, unknown>): WebSubscriptionBillingFields {
  return {
    receiptNumber: stringValue(data.receipt_number),
    receiptStatus: stringValue(data.receipt_status),
    taxInvoiceNumber: stringValue(data.tax_invoice_number),
    taxInvoiceStatus: stringValue(data.tax_invoice_status),
    taxCountry: stringValue(data.tax_country),
    taxLabel: stringValue(data.tax_label),
    taxRegistrationLabel: stringValue(data.tax_registration_label),
    taxRegistrationNumber: stringValue(data.tax_registration_number),
    taxDocumentLabel: stringValue(data.tax_document_label),
    receiptLabel: stringValue(data.receipt_label),
    taxTreatment: stringValue(data.tax_treatment),
    taxCalculationStatus: stringValue(data.tax_calculation_status),
    taxComplianceReviewStatus: stringValue(data.tax_compliance_review_status),
    taxComplianceMessage: stringValue(data.tax_compliance_message),
    taxComplianceBasis: stringValue(data.tax_compliance_basis),
    taxRegistrationRequired: booleanValue(data.tax_registration_required),
    taxRegistrationPresent: booleanValue(data.tax_registration_present),
    taxInclusivePricing: booleanValue(data.tax_inclusive_pricing),
    amountDisplay: stringValue(data.amount_display),
    amountMinor: numberValue(data.amount_minor),
    subtotalMinor: numberValue(data.subtotal_minor),
    taxMinor: numberValue(data.tax_minor),
    totalMinor: numberValue(data.total_minor),
    currency: stringValue(data.currency),
    buyerBusinessName: stringValue(data.buyer_business_name),
    buyerLegalName: stringValue(data.buyer_legal_name),
    buyerEmail: stringValue(data.buyer_email),
    buyerCountry: stringValue(data.buyer_country),
    buyerState: stringValue(data.buyer_state),
    sellerBrand: stringValue(data.seller_brand),
    issuedAt: stringValue(data.issued_at),
    createdAt: stringValue(data.created_at),
    billingEmailStatus: stringValue(data.billing_email_status),
    billingEmailDeliveryStatus: stringValue(data.billing_email_delivery_status),
    billingEmailProviderStatus: stringValue(data.billing_email_provider_status),
    billingEmailRecipient: stringValue(data.billing_email_recipient),
    billingEmailRequestedAt: stringValue(data.billing_email_requested_at),
    billingEmailSentAt: stringValue(data.billing_email_sent_at),
    billingEmailRequestId: stringValue(data.billing_email_request_id),
    billingEmailAdminQueueId: stringValue(data.billing_email_admin_queue_id),
    billingEmailAdminReviewStatus: stringValue(data.billing_email_admin_review_status),
    billingEmailResendCount: numberValue(data.billing_email_resend_count),
    billingEmailLastResendAt: stringValue(data.billing_email_last_resend_at),
    billingEmailLastError: stringValue(data.billing_email_last_error),
    billingRecoveryStatus: stringValue(data.billing_recovery_status),
    billingRecoveredAt: stringValue(data.billing_recovered_at),
  };
}

function parseRenewalChange(id: string, data: Record<string, unknown>): WebSubscriptionRenewalChange {
  const currentPlanId = paidPlanId(data.current_plan_id) ?? 'plus_monthly';
  const targetPlanId = paidPlanId(data.target_plan_id) ?? 'plus_yearly';
  const changeKind = data.change_kind === 'downgrade' ? 'downgrade' : 'billing_change';
  const status =
    data.status === 'cancelled' || data.status === 'applied' || data.status === 'rejected' ? data.status : 'queued';
  const reviewStatus = renewalReviewStatus(data.review_status);
  const serverSyncStatus = renewalServerSyncStatus(data.server_sync_status);
  const currentPlan = getOrbitLedgerPaidPlan(currentPlanId);
  const targetPlan = getOrbitLedgerPaidPlan(targetPlanId);

  return {
    id,
    workspaceId: stringValue(data.workspace_id) ?? '',
    requestedBy: stringValue(data.requested_by) ?? '',
    currentPlanId,
    targetPlanId,
    currentPlanLabel: stringValue(data.current_plan_label) ?? currentPlan.label,
    targetPlanLabel: stringValue(data.target_plan_label) ?? targetPlan.label,
    changeKind,
    status,
    reviewStatus,
    serverSyncStatus,
    requestedAt: stringValue(data.requested_at),
    applyAfter: stringValue(data.apply_after),
    adminQueueId: stringValue(data.admin_queue_id),
    providerPortalStatus: 'pending_provider_connection',
    providerActionRequired: data.provider_action_required === true,
    lastReviewNote: stringValue(data.last_review_note),
  };
}

function parseRenewalAuditItem(id: string, data: Record<string, unknown>): WebSubscriptionRenewalAuditItem {
  return {
    id,
    action: stringValue(data.action) ?? 'recorded',
    status: stringValue(data.status) ?? 'recorded',
    reviewStatus: stringValue(data.review_status) ?? 'recorded',
    serverSyncStatus: stringValue(data.server_sync_status) ?? 'recorded',
    currentPlanLabel: stringValue(data.current_plan_label),
    targetPlanLabel: stringValue(data.target_plan_label),
    resolvedBy: stringValue(data.resolved_by),
    providerReference: stringValue(data.provider_reference),
    note: stringValue(data.note),
    createdAt: stringValue(data.created_at),
  };
}

function renewalReviewStatus(value: unknown): WebSubscriptionRenewalChange['reviewStatus'] {
  if (
    value === 'needs_review' ||
    value === 'ready_for_review' ||
    value === 'processing' ||
    value === 'completed' ||
    value === 'cancelled' ||
    value === 'rejected'
  ) {
    return value;
  }
  return 'needs_review';
}

function renewalServerSyncStatus(value: unknown): WebSubscriptionRenewalChange['serverSyncStatus'] {
  if (
    value === 'queued' ||
    value === 'ready_for_admin_review' ||
    value === 'processing' ||
    value === 'completed' ||
    value === 'cancelled' ||
    value === 'rejected'
  ) {
    return value;
  }
  return 'queued';
}

function paidPlanId(value: unknown): OrbitLedgerPaidPlanId | null {
  const normalized = stringValue(value);
  if (
    normalized === 'plus_monthly' ||
    normalized === 'plus_yearly' ||
    normalized === 'pro_monthly' ||
    normalized === 'pro_yearly' ||
    normalized === 'office_monthly' ||
    normalized === 'office_yearly'
  ) {
    return normalized;
  }
  return null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function booleanValue(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function providerLabel(value: string | null): string {
  if (!value || value === 'manual_provider_pending') {
    return 'Pending setup';
  }
  return value
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

function compareDescending(left: string | null, right: string | null): number {
  return Date.parse(right ?? '') - Date.parse(left ?? '');
}

async function manageSubscriptionRenewalChange(
  input:
    | { action: 'queue'; workspaceId: string; targetPlanId: OrbitLedgerPaidPlanId; applyAfter: string | null }
    | { action: 'cancel'; workspaceId: string; renewalChangeId: string }
): Promise<Extract<ManageSubscriptionRenewalChangeResponse, { ok: true }>> {
  const user = getWebAuth().currentUser;
  if (!user) {
    throw new Error('Sign in again before changing billing settings.');
  }

  const token = await user.getIdToken();
  const response = await fetch(getManageSubscriptionRenewalChangeUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'renewal_change_failed',
  }))) as ManageSubscriptionRenewalChangeResponse;

  if (result.ok) {
    return result;
  }

  throw new Error(result.message ?? 'Renewal change could not be saved.');
}

function getManageSubscriptionRenewalChangeUrl() {
  const projectId = getWebFirebaseProjectId();
  return `https://asia-south1-${projectId}.cloudfunctions.net/manageSubscriptionRenewalChange`;
}
