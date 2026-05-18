import { createHmac, timingSafeEqual } from 'node:crypto';

import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

admin.initializeApp();

const providerWebhookSecret = defineSecret('ORBIT_LEDGER_PROVIDER_WEBHOOK_SECRET');
const monetizationWebhookSecret = defineSecret('ORBIT_LEDGER_MONETIZATION_WEBHOOK_SECRET');
const razorpayKeyId = defineSecret('RAZORPAY_KEY_ID');
const razorpayKeySecret = defineSecret('RAZORPAY_KEY_SECRET');
const razorpayWebhookSecret = defineSecret('RAZORPAY_WEBHOOK_SECRET');
const resendApiKey = defineSecret('RESEND_API_KEY');

type ProviderSource = 'upi' | 'payment_page' | 'bank_transfer' | 'card' | 'wallet' | 'other';
type ProviderPaymentStatus = 'succeeded' | 'pending' | 'failed' | 'refunded';

type ProviderWebhookPayload = {
  provider?: string | null;
  workspaceId?: string | null;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  customerId?: string | null;
  source?: ProviderSource;
  status?: string | null;
  amount?: number | string;
  currency?: string | null;
  reference?: string | null;
  providerPaymentId?: string | null;
  payerName?: string | null;
  payerContact?: string | null;
  paidAt?: string | null;
  rawPayload?: Record<string, unknown>;
};

type MonetizationPlanId =
  | 'plus_monthly'
  | 'plus_yearly'
  | 'pro_monthly'
  | 'pro_yearly'
  | 'office_monthly'
  | 'office_yearly';
type MonetizationCheckoutProvider = 'manual_provider_pending' | 'razorpay' | 'stripe' | 'apple' | 'google';
type MonetizationWebhookStatus = 'confirmed' | 'pending' | 'failed' | 'cancelled';
type MonetizationCurrencyCode = 'INR' | 'USD' | 'CAD' | 'AUD' | 'GBP';
type MonetizationPricingCountryCode = 'IN' | 'US' | 'CA' | 'AU' | 'GB';

type MonetizationWebhookPayload = {
  provider?: MonetizationCheckoutProvider | string | null;
  userId?: string | null;
  workspaceId?: string | null;
  checkoutIntentId?: string | null;
  planId?: MonetizationPlanId | string | null;
  status?: MonetizationWebhookStatus | string | null;
  transactionId?: string | null;
  providerReference?: string | null;
  paidAt?: string | null;
  rawPayload?: Record<string, unknown>;
};

type SubscriptionCheckoutPricing = {
  pricingCountry: MonetizationPricingCountryCode;
  currency: MonetizationCurrencyCode;
  amountMinor: number;
  amountDisplay: string;
  checkoutProvider: MonetizationCheckoutProvider;
  providerPriceId: string;
  providerPriceStatus: 'pending_provider_connection' | 'active';
};
type SubscriptionBillingMetadata = ReturnType<typeof buildSubscriptionBillingMetadata>;
type SubscriptionTaxProfile = {
  taxLabel: string;
  registrationLabel: string;
  receiptLabel: string;
  taxDocumentLabel: string;
  registrationRequired: boolean;
  taxTreatment: string;
  complianceBasis: string;
};
type SubscriptionBillingDocumentAction = 'queue_email' | 'recover_document';
type BillingEmailDeliveryStatus = 'queued' | 'pending_provider_connection' | 'sent' | 'failed';
type OfficeInvitationEmailDeliveryStatus = BillingEmailDeliveryStatus;
type OfficeAssignableRole = 'admin' | 'manager' | 'staff' | 'accountant' | 'viewer';
type OfficeMemberStatus = 'active' | 'invited' | 'suspended' | 'removed';
type OfficeMemberAccessAction = 'change_role' | 'suspend' | 'restore' | 'remove';
type OfficeOwnershipTransferStatus = 'pending' | 'approved' | 'cancelled' | 'expired';
type OfficeOwnershipTransferResolutionAction = 'approve' | 'cancel';
type OfficeOwnershipTransferNotificationStatus = BillingEmailDeliveryStatus;
type OfficeAccessRequestStatus =
  | 'submitted'
  | 'needs_review'
  | 'reviewing'
  | 'approved'
  | 'rejected'
  | 'granted'
  | 'cancelled';
type OfficeAccessReviewAction = 'mark_reviewing' | 'approve' | 'reject' | 'grant_access';
type SupportConsentStatus = 'active' | 'revoked' | 'expired';
type SupportCaseStatus = 'open' | 'waiting_on_customer' | 'resolved' | 'reopened';
type SupportCaseAction = 'add_note' | 'resolve' | 'reopen';
type SupportCaseEmailDeliveryStatus = 'queued' | 'pending_provider_connection' | 'sent' | 'failed';
type BillingEmailDeliveryResult = {
  status: BillingEmailDeliveryStatus;
  providerMessageId: string | null;
  sentAt: string | null;
  failureReason: string | null;
};
type ResendEmailPayload = {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
};
type OfficeInvitationCapacityDecision = {
  allowed: boolean;
  reason: 'available' | 'seat_limit_reached' | 'existing_member' | 'pending_invitation';
  seatLimit: number;
  usedSeats: number;
  remainingSeats: number;
  message: string;
};

const monetizationPlanCatalog: Record<
  MonetizationPlanId,
  { tier: 'plus' | 'pro' | 'office'; productId: string; entitlementDays: number }
> = {
  plus_monthly: { tier: 'plus', productId: 'com.rudraix.orbitledger.plus.monthly', entitlementDays: 31 },
  plus_yearly: { tier: 'plus', productId: 'com.rudraix.orbitledger.plus.yearly', entitlementDays: 365 },
  pro_monthly: { tier: 'pro', productId: 'com.rudraix.orbitledger.pro.monthly', entitlementDays: 31 },
  pro_yearly: { tier: 'pro', productId: 'com.rudraix.orbitledger.pro.yearly', entitlementDays: 365 },
  office_monthly: { tier: 'office', productId: 'com.rudraix.orbitledger.office.monthly', entitlementDays: 31 },
  office_yearly: { tier: 'office', productId: 'com.rudraix.orbitledger.office.yearly', entitlementDays: 365 },
};

type MonetizationPlanChangeKind = 'new_purchase' | 'current_plan' | 'upgrade' | 'downgrade' | 'billing_change';
type SubscriptionRenewalChangeKind = Extract<MonetizationPlanChangeKind, 'downgrade' | 'billing_change'>;

const monetizationPlanRank: Record<'free' | 'plus' | 'pro' | 'office', number> = {
  free: 0,
  plus: 10,
  pro: 20,
  office: 30,
};
const officeIncludedSeatLimit = 5;

const monetizationCountryCheckoutProvider: Record<MonetizationPricingCountryCode, MonetizationCheckoutProvider> = {
  IN: 'razorpay',
  US: 'razorpay',
  CA: 'razorpay',
  AU: 'razorpay',
  GB: 'razorpay',
};

const monetizationCountryPricing: Record<
  MonetizationPricingCountryCode,
  { currency: MonetizationCurrencyCode; amounts: Record<MonetizationPlanId, number> }
> = {
  IN: {
    currency: 'INR',
    amounts: {
      plus_monthly: 9900,
      plus_yearly: 99900,
      pro_monthly: 19900,
      pro_yearly: 199900,
      office_monthly: 49900,
      office_yearly: 499900,
    },
  },
  US: {
    currency: 'USD',
    amounts: {
      plus_monthly: 499,
      plus_yearly: 4999,
      pro_monthly: 999,
      pro_yearly: 9999,
      office_monthly: 2499,
      office_yearly: 24999,
    },
  },
  CA: {
    currency: 'CAD',
    amounts: {
      plus_monthly: 699,
      plus_yearly: 6999,
      pro_monthly: 1299,
      pro_yearly: 12999,
      office_monthly: 3299,
      office_yearly: 32999,
    },
  },
  AU: {
    currency: 'AUD',
    amounts: {
      plus_monthly: 799,
      plus_yearly: 7999,
      pro_monthly: 1499,
      pro_yearly: 14999,
      office_monthly: 3999,
      office_yearly: 39999,
    },
  },
  GB: {
    currency: 'GBP',
    amounts: {
      plus_monthly: 399,
      plus_yearly: 3999,
      pro_monthly: 799,
      pro_yearly: 7999,
      office_monthly: 1999,
      office_yearly: 19999,
    },
  },
};

const db = admin.firestore();

export function normalizeProviderWebhookPayload(body: unknown): ProviderWebhookPayload {
  return normalizePayload(body);
}

export function normalizeMonetizationWebhookPayload(body: unknown): MonetizationWebhookPayload {
  const payload = asRecord(body);
  if (!payload) {
    return {};
  }

  if (clean(stringValue(payload.event))?.startsWith('payment.')) {
    const entity = asRecord(asRecord(asRecord(payload.payload)?.payment)?.entity);
    const notes = normalizeMetadata(asRecord(entity?.notes));
    return {
      provider: 'razorpay',
      userId: metadataValue(notes, 'orbit_user_id', 'userId'),
      workspaceId: metadataValue(notes, 'orbit_workspace_id', 'workspaceId'),
      checkoutIntentId: metadataValue(notes, 'orbit_checkout_intent_id', 'checkoutIntentId'),
      planId: metadataValue(notes, 'orbit_plan_id', 'planId'),
      status: normalizeMonetizationStatus(clean(stringValue(entity?.status)) ?? clean(stringValue(payload.event))),
      transactionId: clean(stringValue(entity?.id)),
      providerReference: clean(stringValue(entity?.order_id)) ?? clean(stringValue(entity?.id)),
      paidAt: epochSecondsToIso(numberLike(entity?.created_at)),
      rawPayload: payload,
    };
  }

  return {
    provider: clean(stringValue(payload.provider)) ?? 'manual_provider_pending',
    userId: clean(stringValue(payload.userId)),
    workspaceId: clean(stringValue(payload.workspaceId)),
    checkoutIntentId: clean(stringValue(payload.checkoutIntentId)),
    planId: clean(stringValue(payload.planId)),
    status: normalizeMonetizationStatus(clean(stringValue(payload.status))),
    transactionId: clean(stringValue(payload.transactionId)),
    providerReference: clean(stringValue(payload.providerReference)),
    paidAt: clean(stringValue(payload.paidAt)),
    rawPayload: payload,
  };
}

export function validateMonetizationWebhookPayload(payload: MonetizationWebhookPayload): string | null {
  if (!clean(payload.userId)) {
    return 'user_required';
  }
  if (!clean(payload.workspaceId)) {
    return 'workspace_required';
  }
  if (!clean(payload.checkoutIntentId)) {
    return 'checkout_required';
  }
  if (!isMonetizationPlanId(payload.planId)) {
    return 'plan_required';
  }
  if (!isMonetizationWebhookStatus(payload.status)) {
    return 'status_required';
  }
  if (payload.status === 'confirmed' && !clean(payload.transactionId) && !clean(payload.providerReference)) {
    return 'transaction_required';
  }
  return null;
}

export function buildSubscriptionEntitlementRecord(payload: MonetizationWebhookPayload, now = new Date()) {
  if (!isMonetizationPlanId(payload.planId)) {
    throw new Error('plan_required');
  }
  const plan = monetizationPlanCatalog[payload.planId];
  const timestamp = now.toISOString();
  return {
    version: 1,
    tier: plan.tier,
    plan_id: payload.planId,
    product_id: plan.productId,
    source: 'provider_webhook',
    checkout_intent_id: clean(payload.checkoutIntentId),
    transaction_id: clean(payload.transactionId),
    provider: normalizeMonetizationProvider(payload.provider),
    provider_reference: clean(payload.providerReference),
    updated_at: timestamp,
    valid_until: new Date(now.getTime() + plan.entitlementDays * 86_400_000).toISOString(),
  };
}

export function buildSubscriptionEntitlementAuditRecord(
  payload: MonetizationWebhookPayload,
  eventId: string,
  now = new Date(),
  billingMetadata?: SubscriptionBillingMetadata | null
) {
  if (!isMonetizationPlanId(payload.planId)) {
    throw new Error('plan_required');
  }
  const entitlement = buildSubscriptionEntitlementRecord(payload, now);
  return {
    version: 1,
    event_id: eventId,
    action: payload.status === 'confirmed' ? 'entitlement_confirmed' : 'entitlement_event_recorded',
    status: payload.status,
    tier: entitlement.tier,
    plan_id: entitlement.plan_id,
    product_id: entitlement.product_id,
    checkout_intent_id: entitlement.checkout_intent_id,
    transaction_id: entitlement.transaction_id,
    provider: entitlement.provider,
    provider_reference: entitlement.provider_reference,
    ...(billingMetadata ?? {}),
    valid_until: entitlement.valid_until,
    received_at: payload.paidAt ?? now.toISOString(),
    created_at: now.toISOString(),
  };
}

export function buildSubscriptionBillingMetadata(input: {
  workspaceId: string;
  userId: string;
  planId: MonetizationPlanId;
  checkoutIntentId: string;
  pricing: SubscriptionCheckoutPricing;
  workspace?: FirebaseFirestore.DocumentData | null;
  status?: 'pending' | 'confirmed' | 'failed' | 'blocked' | 'cancelled';
  provider?: string | null;
  transactionId?: string | null;
  providerReference?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const datePart = now.toISOString().slice(0, 7).replace('-', '');
  const checkoutSuffix = normalizeId(input.checkoutIntentId).slice(-8).toUpperCase();
  const workspace = input.workspace ?? {};
  const taxProfile = getSubscriptionTaxProfile(input.pricing.pricingCountry);
  const buyerTaxNumber =
    input.pricing.pricingCountry === 'IN'
      ? clean(stringValue(workspace.gstin)) ??
        clean(stringValue(workspace.pan)) ??
        clean(stringValue(workspace.tax_number)) ??
        clean(stringValue(workspace.tax_registration_number))
      : clean(stringValue(workspace.tax_number)) ?? clean(stringValue(workspace.tax_registration_number));
  const taxReview = getSubscriptionTaxComplianceReview({
    status: input.status ?? 'pending',
    taxProfile,
    buyerTaxNumber,
    pricingCountry: input.pricing.pricingCountry,
  });

  return {
    billing_document_version: 1,
    billing_status: input.status ?? 'pending',
    receipt_id: normalizeId(`receipt_${input.checkoutIntentId}`),
    receipt_number: `OL-${datePart}-${checkoutSuffix}`,
    receipt_status: input.status === 'confirmed' ? 'ready' : 'pending',
    tax_invoice_id: normalizeId(`tax_invoice_${input.checkoutIntentId}`),
    tax_invoice_number: `OL-TAX-${datePart}-${checkoutSuffix}`,
    tax_invoice_status: input.status === 'confirmed' ? 'metadata_ready' : 'pending_confirmation',
    tax_country: input.pricing.pricingCountry,
    tax_label: taxProfile.taxLabel,
    tax_registration_label: taxProfile.registrationLabel,
    tax_registration_number: buyerTaxNumber,
    tax_document_label: taxProfile.taxDocumentLabel,
    receipt_label: taxProfile.receiptLabel,
    tax_treatment: taxProfile.taxTreatment,
    tax_calculation_status: taxReview.calculationStatus,
    tax_compliance_review_status: taxReview.status,
    tax_compliance_message: taxReview.message,
    tax_compliance_basis: taxProfile.complianceBasis,
    tax_profile_version: 1,
    tax_registration_required: taxProfile.registrationRequired,
    tax_registration_present: Boolean(buyerTaxNumber),
    tax_inclusive_pricing: false,
    subtotal_minor: input.pricing.amountMinor,
    tax_minor: 0,
    total_minor: input.pricing.amountMinor,
    amount_minor: input.pricing.amountMinor,
    amount_display: input.pricing.amountDisplay,
    currency: input.pricing.currency,
    pricing_country: input.pricing.pricingCountry,
    checkout_provider: input.pricing.checkoutProvider,
    provider_price_id: input.pricing.providerPriceId,
    provider_price_status: input.pricing.providerPriceStatus,
    provider: clean(input.provider) ?? input.pricing.checkoutProvider,
    transaction_id: clean(input.transactionId),
    provider_reference: clean(input.providerReference),
    seller_name: 'Rudraix',
    seller_brand: 'Orbit Ledger by Rudraix',
    seller_country: 'IN',
    buyer_workspace_id: input.workspaceId,
    buyer_user_id: input.userId,
    buyer_business_name: clean(stringValue(workspace.business_name)) ?? clean(stringValue(workspace.buyer_business_name)),
    buyer_legal_name: clean(stringValue(workspace.legal_name)) ?? clean(stringValue(workspace.buyer_legal_name)),
    buyer_email:
      clean(stringValue(workspace.email)) ??
      clean(stringValue(workspace.owner_email)) ??
      clean(stringValue(workspace.buyer_email)),
    buyer_country: clean(stringValue(workspace.country_code)) ?? clean(stringValue(workspace.buyer_country)) ?? input.pricing.pricingCountry,
    buyer_state: clean(stringValue(workspace.state_code)) ?? clean(stringValue(workspace.buyer_state)),
    buyer_registration_number:
      clean(stringValue(workspace.registration_number)) ?? clean(stringValue(workspace.buyer_registration_number)),
    issued_at: input.status === 'confirmed' ? now.toISOString() : null,
    created_at: now.toISOString(),
  };
}

export function buildSubscriptionBillingEmailRequestRecord(input: {
  workspaceId: string;
  userId: string;
  checkoutIntentId: string;
  planId: MonetizationPlanId;
  receiptNumber: string | null;
  taxInvoiceNumber: string | null;
  recipientEmail: string;
  requestedBy: string;
  buyerBusinessName?: string | null;
  amountDisplay?: string | null;
  adminQueueId?: string | null;
  resendCount?: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return {
    version: 1,
    request_type: 'billing_receipt_email',
    status: 'queued',
    delivery_status: 'queued',
    delivery_channel: 'email',
    email_provider_status: 'pending_connection',
    workspace_id: input.workspaceId,
    user_id: input.userId,
    checkout_intent_id: input.checkoutIntentId,
    plan_id: input.planId,
    receipt_number: input.receiptNumber,
    tax_invoice_number: input.taxInvoiceNumber,
    buyer_business_name: clean(input.buyerBusinessName),
    amount_display: clean(input.amountDisplay),
    admin_queue_id: clean(input.adminQueueId),
    admin_review_status: 'needs_review',
    resend_count: Math.max(0, Math.floor(input.resendCount ?? 0)),
    last_resend_at: input.resendCount && input.resendCount > 1 ? now.toISOString() : null,
    recipient_email: input.recipientEmail,
    requested_by: input.requestedBy,
    requested_at: now.toISOString(),
    updated_at: now.toISOString(),
    sent_at: null,
    failure_reason: null,
  };
}

export function buildSubscriptionBillingEmailAdminQueueRecord(input: {
  workspaceId: string;
  userId: string;
  checkoutIntentId: string;
  requestId: string;
  planId: MonetizationPlanId;
  receiptNumber: string | null;
  recipientEmail: string;
  deliveryStatus: BillingEmailDeliveryStatus;
  resendCount?: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const needsReview = input.deliveryStatus !== 'sent';
  return {
    version: 1,
    queue_type: 'billing_receipt_email',
    workspace_id: input.workspaceId,
    user_id: input.userId,
    checkout_intent_id: input.checkoutIntentId,
    request_id: input.requestId,
    plan_id: input.planId,
    receipt_number: input.receiptNumber,
    recipient_email: input.recipientEmail,
    resend_count: Math.max(0, Math.floor(input.resendCount ?? 0)),
    status: needsReview ? 'open' : 'completed',
    review_status: needsReview ? 'needs_review' : 'completed',
    provider_sync_status:
      input.deliveryStatus === 'sent'
        ? 'completed'
        : input.deliveryStatus === 'failed'
          ? 'failed'
          : 'pending_provider_connection',
    delivery_status: input.deliveryStatus,
    provider_action_required: input.deliveryStatus !== 'sent',
    note:
      input.deliveryStatus === 'sent'
        ? 'Billing receipt email sent.'
        : input.deliveryStatus === 'failed'
          ? 'Billing receipt email failed and needs review.'
          : 'Billing receipt email is queued until email delivery is connected.',
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

export function buildSubscriptionBillingEmailDeliveryUpdate(input: {
  status: BillingEmailDeliveryStatus;
  providerMessageId?: string | null;
  sentAt?: string | null;
  failureReason?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  return {
    status: input.status === 'sent' ? 'sent' : input.status,
    delivery_status: input.status,
    email_provider_status:
      input.status === 'sent'
        ? 'sent'
        : input.status === 'failed'
          ? 'failed'
          : input.status === 'pending_provider_connection'
            ? 'pending_connection'
            : 'queued',
    provider_message_id: clean(input.providerMessageId),
    sent_at: input.status === 'sent' ? input.sentAt ?? timestamp : null,
    failure_reason: input.failureReason ?? null,
    updated_at: timestamp,
  };
}

export function buildOfficeAccessRequestAdminQueueRecord(input: {
  workspaceId: string;
  requestId: string;
  requesterUid: string;
  requesterName: string;
  requesterEmail: string;
  businessName?: string | null;
  requestedPlanId: Extract<MonetizationPlanId, 'office_monthly' | 'office_yearly'>;
  status?: OfficeAccessRequestStatus;
  note?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const status = normalizeOfficeAccessRequestStatus(input.status);
  return {
    version: 1,
    kind: 'office_access_request',
    workspace_id: input.workspaceId,
    request_id: input.requestId,
    requester_uid: input.requesterUid,
    requester_name: input.requesterName,
    requester_email: input.requesterEmail,
    business_name: clean(input.businessName),
    requested_plan_id: input.requestedPlanId,
    status,
    review_status: officeAccessReviewStatus(status),
    action_label: officeAccessActionLabel(status),
    note: clean(input.note),
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

export function buildOfficeAccessRequestAuditRecord(input: {
  workspaceId: string;
  requestId: string;
  adminQueueId?: string | null;
  actorUid: string;
  action: OfficeAccessReviewAction;
  targetUid: string;
  targetEmail: string;
  previousStatus: OfficeAccessRequestStatus;
  nextStatus: OfficeAccessRequestStatus;
  note?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return {
    version: 1,
    workspace_id: input.workspaceId,
    request_id: input.requestId,
    admin_queue_id: clean(input.adminQueueId),
    actor_uid: input.actorUid,
    action: input.action === 'grant_access' ? 'member_accepted' : input.action === 'reject' ? 'invitation_revoked' : 'internal_access_reviewed',
    target_uid: input.targetUid,
    target_email: input.targetEmail,
    previous_role: null,
    next_role: input.action === 'grant_access' ? 'owner' : null,
    previous_status: input.previousStatus,
    next_status: input.nextStatus,
    reason: clean(input.note),
    created_at: now.toISOString(),
  };
}

export function buildOfficeSupportReviewAuditRecord(input: {
  workspaceId: string;
  actorUid: string;
  actorEmail?: string | null;
  reason?: string | null;
  supportCaseId?: string | null;
  customerApprovedDiagnosticAccess?: boolean;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const reason = clean(input.reason) ?? 'Internal support review recorded.';
  const supportCaseId = clean(input.supportCaseId);
  const diagnosticAccess = Boolean(input.customerApprovedDiagnosticAccess);
  return {
    version: 1,
    workspace_id: input.workspaceId,
    actor_uid: input.actorUid,
    actor_email: clean(input.actorEmail),
    actor_role: 'internal_support_reviewer',
    action: 'internal_access_reviewed',
    target_uid: null,
    target_email: null,
    previous_role: null,
    next_role: null,
    previous_status: null,
    next_status: null,
    support_case_id: supportCaseId,
    customer_approved_diagnostic_access: diagnosticAccess,
    impersonation_allowed: false,
    reason: buildOfficeSupportReviewAuditReason(reason, supportCaseId, diagnosticAccess),
    created_at: now.toISOString(),
  };
}

export function buildSupportDiagnosticConsentRecord(input: {
  workspaceId: string;
  userId: string;
  userEmail?: string | null;
  supportKind?: string | null;
  supportCaseId?: string | null;
  sanitizedMessage?: string | null;
  safeFields?: Record<string, unknown> | null;
  redactedFields?: unknown[] | null;
  privateDataWarnings?: unknown[] | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  const safeFields = sanitizeDiagnosticSafeFields(input.safeFields);
  const redactedFields = sanitizeStringList(input.redactedFields);
  return {
    version: 1,
    workspace_id: input.workspaceId,
    user_id: input.userId,
    user_email: clean(input.userEmail),
    support_kind: clean(input.supportKind) ?? 'general_feedback',
    support_case_id: clean(input.supportCaseId),
    status: 'active' as SupportConsentStatus,
    sanitized_message: clean(input.sanitizedMessage) ?? 'Support review consent approved.',
    diagnostic_safe_fields: safeFields,
    approved_fields: Object.keys(safeFields),
    redacted_fields: redactedFields,
    private_data_warnings: sanitizeStringList(input.privateDataWarnings),
    expires_at: new Date(now.getTime() + 7 * 86_400_000).toISOString(),
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export function buildSupportDiagnosticConsentStatusUpdate(input: {
  status: SupportConsentStatus;
  actorUid: string;
  reason?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  return {
    status: input.status,
    revoked_by: input.status === 'revoked' ? input.actorUid : null,
    revoked_at: input.status === 'revoked' ? timestamp : null,
    expired_at: input.status === 'expired' ? timestamp : null,
    status_reason: clean(input.reason) ?? supportConsentStatusReason(input.status),
    updated_at: timestamp,
  };
}

export function buildSupportCaseRecord(input: {
  workspaceId: string;
  supportCaseId: string;
  action: SupportCaseAction;
  status: SupportCaseStatus;
  previousStatus?: SupportCaseStatus | null;
  note: string;
  actorUid: string;
  actorEmail?: string | null;
  noteCount?: number | null;
  createdAt?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  const currentCount = Math.max(0, Number(input.noteCount ?? 0));
  return {
    version: 1,
    workspace_id: input.workspaceId,
    support_case_id: input.supportCaseId,
    status: input.status,
    previous_status: input.previousStatus ?? null,
    latest_action: input.action,
    latest_note: clean(input.note),
    latest_note_at: timestamp,
    latest_note_by: input.actorUid,
    latest_note_by_email: clean(input.actorEmail),
    resolved_at: input.status === 'resolved' ? timestamp : null,
    reopened_at: input.status === 'reopened' ? timestamp : null,
    note_count: currentCount + 1,
    updated_at: timestamp,
    created_at: clean(input.createdAt) ?? timestamp,
  };
}

export function buildSupportCaseEmailRequestRecord(input: {
  workspaceId: string;
  supportCaseId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  queuedBy: string;
  queuedByEmail?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  return {
    version: 1,
    workspace_id: input.workspaceId,
    support_case_id: input.supportCaseId,
    recipient_email: clean(input.recipientEmail),
    subject: clean(input.subject),
    body: clean(input.body),
    provider: 'resend',
    delivery_status: 'queued' as SupportCaseEmailDeliveryStatus,
    provider_message_id: null,
    failure_reason: null,
    queued_by: input.queuedBy,
    queued_by_email: clean(input.queuedByEmail),
    queued_at: timestamp,
    sent_at: null,
    updated_at: timestamp,
    created_at: timestamp,
  };
}

export function buildSupportCaseEmailDeliveryUpdate(input: {
  status: SupportCaseEmailDeliveryStatus;
  providerMessageId?: string | null;
  sentAt?: string | null;
  failureReason?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  return {
    delivery_status: input.status,
    email_provider_status:
      input.status === 'sent'
        ? 'sent'
        : input.status === 'failed'
          ? 'failed'
          : input.status === 'pending_provider_connection'
            ? 'pending_connection'
            : 'queued',
    provider_message_id: clean(input.providerMessageId),
    sent_at: input.status === 'sent' ? input.sentAt ?? timestamp : null,
    failure_reason: clean(input.failureReason),
    updated_at: timestamp,
  };
}

export function buildOfficeOwnerMemberRecord(input: {
  workspaceId: string;
  ownerUid: string;
  ownerEmail: string;
  ownerName: string;
  invitedBy: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  return {
    uid: input.ownerUid,
    workspace_id: input.workspaceId,
    role: 'owner',
    status: 'active',
    email: clean(input.ownerEmail),
    display_name: clean(input.ownerName),
    invited_by: input.invitedBy,
    invited_at: timestamp,
    accepted_at: timestamp,
    suspended_at: null,
    removed_at: null,
    last_seen_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export function buildOfficeInvitationRecord(input: {
  workspaceId: string;
  email: string;
  role: OfficeAssignableRole;
  invitedBy: string;
  invitedByName?: string | null;
  message?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  return {
    email: input.email.trim().toLowerCase(),
    role: input.role,
    status: 'pending',
    workspace_id: input.workspaceId,
    invited_by: input.invitedBy,
    invited_by_name: clean(input.invitedByName),
    message: clean(input.message),
    expires_at: new Date(now.getTime() + 14 * 86_400_000).toISOString(),
    accepted_by: null,
    accepted_at: null,
    revoked_by: null,
    revoked_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export function buildOfficeInvitedMemberRecord(input: {
  workspaceId: string;
  memberUid: string;
  memberEmail: string;
  memberName?: string | null;
  role: 'admin' | 'manager' | 'staff' | 'accountant' | 'viewer';
  invitedBy: string;
  invitedAt?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  return {
    uid: input.memberUid,
    workspace_id: input.workspaceId,
    role: input.role,
    status: 'active',
    email: clean(input.memberEmail),
    display_name: clean(input.memberName) ?? clean(input.memberEmail),
    invited_by: input.invitedBy,
    invited_at: clean(input.invitedAt) ?? timestamp,
    accepted_at: timestamp,
    suspended_at: null,
    removed_at: null,
    last_seen_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export function buildOfficeInvitationCreatedAuditRecord(input: {
  workspaceId: string;
  invitationId: string;
  actorUid: string;
  actorRole: 'owner' | 'admin';
  targetEmail: string;
  role: OfficeAssignableRole;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return {
    version: 1,
    workspace_id: input.workspaceId,
    invitation_id: input.invitationId,
    actor_uid: input.actorUid,
    actor_role: input.actorRole,
    action: 'member_invited',
    target_uid: null,
    target_email: clean(input.targetEmail),
    previous_role: null,
    next_role: input.role,
    previous_status: null,
    next_status: 'pending',
    reason: 'Office invitation created.',
    created_at: now.toISOString(),
  };
}

export function buildOfficeInvitationRevokedAuditRecord(input: {
  workspaceId: string;
  invitationId: string;
  actorUid: string;
  actorRole: 'owner' | 'admin';
  targetEmail: string;
  role: OfficeAssignableRole;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return {
    version: 1,
    workspace_id: input.workspaceId,
    invitation_id: input.invitationId,
    actor_uid: input.actorUid,
    actor_role: input.actorRole,
    action: 'invitation_revoked',
    target_uid: null,
    target_email: clean(input.targetEmail),
    previous_role: input.role,
    next_role: null,
    previous_status: 'pending',
    next_status: 'revoked',
    reason: 'Office invitation revoked.',
    created_at: now.toISOString(),
  };
}

export function buildOfficeInvitationDeliveryAuditRecord(input: {
  workspaceId: string;
  invitationId: string;
  actorUid: string;
  actorRole: 'owner' | 'admin';
  targetEmail: string;
  role: OfficeAssignableRole;
  deliveryStatus: OfficeInvitationEmailDeliveryStatus;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const reason =
    input.deliveryStatus === 'sent'
      ? 'Invitation email sent.'
      : input.deliveryStatus === 'pending_provider_connection'
        ? 'Invitation email is ready; email delivery is not connected yet.'
        : input.deliveryStatus === 'failed'
          ? 'Invitation email failed.'
          : 'Invitation email queued.';
  return {
    version: 1,
    workspace_id: input.workspaceId,
    invitation_id: input.invitationId,
    actor_uid: input.actorUid,
    actor_role: input.actorRole,
    action: 'invitation_email_sent',
    target_uid: null,
    target_email: clean(input.targetEmail),
    previous_role: null,
    next_role: input.role,
    previous_status: 'pending',
    next_status: input.deliveryStatus,
    reason,
    created_at: now.toISOString(),
  };
}

export function buildOfficeInvitationAcceptanceAuditRecord(input: {
  workspaceId: string;
  invitationId: string;
  actorUid: string;
  actorEmail: string;
  invitedBy: string;
  role: 'admin' | 'manager' | 'staff' | 'accountant' | 'viewer';
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return {
    version: 1,
    workspace_id: input.workspaceId,
    invitation_id: input.invitationId,
    actor_uid: input.actorUid,
    actor_role: input.role,
    action: 'member_accepted',
    target_uid: input.actorUid,
    target_email: clean(input.actorEmail),
    previous_role: null,
    next_role: input.role,
    previous_status: 'pending',
    next_status: 'active',
    invited_by: input.invitedBy,
    reason: 'Office invitation accepted by invited user.',
    created_at: now.toISOString(),
  };
}

export function buildOfficeInvitationEmailDeliveryUpdate(input: {
  status: OfficeInvitationEmailDeliveryStatus;
  inviteUrl: string;
  providerMessageId?: string | null;
  sentAt?: string | null;
  failureReason?: string | null;
  resendCount?: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  const resendCount = Math.max(0, Math.floor(input.resendCount ?? 0));
  return {
    delivery_status: input.status,
    email_provider_status:
      input.status === 'sent'
        ? 'sent'
        : input.status === 'failed'
          ? 'failed'
          : input.status === 'pending_provider_connection'
            ? 'pending_connection'
            : 'queued',
    provider_message_id: clean(input.providerMessageId),
    sent_at: input.status === 'sent' ? input.sentAt ?? timestamp : null,
    failure_reason: clean(input.failureReason),
    resend_count: resendCount,
    last_resend_at: resendCount > 1 ? timestamp : null,
    invite_url: input.inviteUrl,
    updated_at: timestamp,
  };
}

export function buildOfficeMemberAccessAuditRecord(input: {
  workspaceId: string;
  actorUid: string;
  actorRole: 'owner' | 'admin';
  targetUid: string;
  targetEmail?: string | null;
  action: 'member_role_changed' | 'member_suspended' | 'member_restored' | 'member_removed';
  previousRole?: OfficeAssignableRole | null;
  nextRole?: OfficeAssignableRole | null;
  previousStatus?: OfficeMemberStatus | null;
  nextStatus?: OfficeMemberStatus | null;
  reason?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return {
    version: 1,
    workspace_id: input.workspaceId,
    actor_uid: input.actorUid,
    actor_role: input.actorRole,
    action: input.action,
    target_uid: input.targetUid,
    target_email: clean(input.targetEmail),
    previous_role: input.previousRole ?? null,
    next_role: input.nextRole ?? null,
    previous_status: input.previousStatus ?? null,
    next_status: input.nextStatus ?? null,
    reason: clean(input.reason) ?? officeMemberAccessAuditReason(input.action),
    created_at: now.toISOString(),
  };
}

export function buildOfficeOwnershipTransferRecord(input: {
  workspaceId: string;
  requestedBy: string;
  requestedByEmail?: string | null;
  targetUid: string;
  targetEmail?: string | null;
  targetName?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  return {
    version: 1,
    workspace_id: input.workspaceId,
    status: 'pending',
    requested_by: input.requestedBy,
    requested_by_email: clean(input.requestedByEmail),
    target_uid: input.targetUid,
    target_email: clean(input.targetEmail),
    target_name: clean(input.targetName),
    requested_at: timestamp,
    approved_by: null,
    approved_at: null,
    cancelled_by: null,
    cancelled_at: null,
    expires_at: new Date(now.getTime() + 7 * 86_400_000).toISOString(),
    notification_status: 'queued',
    notification_provider_status: 'queued',
    notification_provider_message_id: null,
    notification_sent_at: null,
    notification_failure_reason: null,
    notification_resend_count: 0,
    notification_last_resend_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export function buildOfficeOwnershipTransferAuditRecord(input: {
  workspaceId: string;
  transferId: string;
  actorUid: string;
  actorRole: 'owner' | OfficeAssignableRole | 'internal_support_reviewer';
  action:
    | 'ownership_transfer_requested'
    | 'ownership_transferred'
    | 'ownership_transfer_cancelled'
    | 'ownership_transfer_expired'
    | 'ownership_transfer_notification_sent';
  targetUid: string;
  targetEmail?: string | null;
  previousRole?: 'owner' | OfficeAssignableRole | null;
  nextRole?: 'owner' | OfficeAssignableRole | null;
  reason?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return {
    version: 1,
    workspace_id: input.workspaceId,
    ownership_transfer_id: input.transferId,
    actor_uid: input.actorUid,
    actor_role: input.actorRole,
    action: input.action,
    target_uid: input.targetUid,
    target_email: clean(input.targetEmail),
    previous_role: input.previousRole ?? null,
    next_role: input.nextRole ?? null,
    previous_status: null,
    next_status: null,
    reason: clean(input.reason) ?? officeOwnershipTransferAuditReason(input.action),
    created_at: now.toISOString(),
  };
}

export function buildOfficeOwnershipTransferNotificationUpdate(input: {
  status: OfficeOwnershipTransferNotificationStatus;
  providerMessageId?: string | null;
  sentAt?: string | null;
  failureReason?: string | null;
  resendCount?: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  const resendCount = Math.max(0, Math.floor(input.resendCount ?? 0));
  return {
    notification_status: input.status,
    notification_provider_status:
      input.status === 'sent'
        ? 'sent'
        : input.status === 'failed'
          ? 'failed'
          : input.status === 'pending_provider_connection'
            ? 'pending_connection'
            : 'queued',
    notification_provider_message_id: clean(input.providerMessageId),
    notification_sent_at: input.status === 'sent' ? input.sentAt ?? timestamp : null,
    notification_failure_reason: clean(input.failureReason),
    notification_resend_count: resendCount,
    notification_last_resend_at: resendCount > 1 ? timestamp : null,
    updated_at: timestamp,
  };
}

function resolveOfficeAccessReviewPlan(input: {
  action: OfficeAccessReviewAction;
  currentStatus: OfficeAccessRequestStatus;
}) {
  const finalStatus = ['granted', 'rejected', 'cancelled'].includes(input.currentStatus);
  if (finalStatus) {
    return {
      canApply: false,
      nextStatus: input.currentStatus,
      shouldGrantEntitlement: false,
      message: 'Office access request is already finalized.',
    };
  }

  if (input.action === 'mark_reviewing') {
    return {
      canApply: true,
      nextStatus: 'reviewing' as const,
      shouldGrantEntitlement: false,
      message: 'Office request marked for active review.',
    };
  }

  if (input.action === 'approve') {
    return {
      canApply: true,
      nextStatus: 'approved' as const,
      shouldGrantEntitlement: false,
      message: 'Office request approved.',
    };
  }

  if (input.action === 'reject') {
    return {
      canApply: true,
      nextStatus: 'rejected' as const,
      shouldGrantEntitlement: false,
      message: 'Office request rejected.',
    };
  }

  if (input.currentStatus !== 'approved') {
    return {
      canApply: false,
      nextStatus: input.currentStatus,
      shouldGrantEntitlement: false,
      message: 'Approve the Office request before granting access.',
    };
  }

  return {
    canApply: true,
    nextStatus: 'granted' as const,
    shouldGrantEntitlement: true,
    message: 'Office access granted.',
  };
}

export function resolveMonetizationPlanChange(
  currentPlanId: unknown,
  targetPlanId: MonetizationPlanId
): { kind: MonetizationPlanChangeKind; canApply: boolean; reason: string | null } {
  const normalizedCurrentPlanId = clean(stringValue(currentPlanId));
  if (!normalizedCurrentPlanId || !isMonetizationPlanId(normalizedCurrentPlanId)) {
    return { kind: 'new_purchase', canApply: true, reason: null };
  }

  if (normalizedCurrentPlanId === targetPlanId) {
    return { kind: 'current_plan', canApply: false, reason: 'current_plan' };
  }

  const currentTier = monetizationPlanCatalog[normalizedCurrentPlanId].tier;
  const targetTier = monetizationPlanCatalog[targetPlanId].tier;
  const currentRank = monetizationPlanRank[currentTier];
  const targetRank = monetizationPlanRank[targetTier];

  if (targetRank > currentRank) {
    return { kind: 'upgrade', canApply: true, reason: null };
  }

  if (targetRank < currentRank) {
    return { kind: 'downgrade', canApply: false, reason: 'downgrade_blocked' };
  }

  return { kind: 'billing_change', canApply: false, reason: 'billing_change_at_renewal' };
}

export function buildSubscriptionRenewalChangeRecord(input: {
  workspaceId: string;
  userId: string;
  currentPlanId: MonetizationPlanId;
  targetPlanId: MonetizationPlanId;
  changeKind: SubscriptionRenewalChangeKind;
  applyAfter?: string | null;
  adminQueueId?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  const adminQueueId = clean(input.adminQueueId) ?? normalizeId(`admin_renewal_${input.workspaceId}_${input.currentPlanId}_to_${input.targetPlanId}`);
  return {
    version: 1,
    workspace_id: input.workspaceId,
    requested_by: input.userId,
    current_plan_id: input.currentPlanId,
    target_plan_id: input.targetPlanId,
    current_plan_label: monetizationPlanLabel(input.currentPlanId),
    target_plan_label: monetizationPlanLabel(input.targetPlanId),
    change_kind: input.changeKind,
    status: 'queued',
    requested_at: timestamp,
    apply_after: clean(input.applyAfter) ?? null,
    provider: 'manual_provider_pending',
    provider_portal_status: 'pending_provider_connection',
    server_sync_status: 'queued',
    review_status: 'needs_review',
    admin_queue_id: adminQueueId,
    provider_action_required: true,
    last_review_note: 'Queued for renewal processing.',
    updated_at: timestamp,
  };
}

export function buildSubscriptionRenewalAdminQueueRecord(input: {
  workspaceId: string;
  userId: string;
  renewalChangeId: string;
  currentPlanId: MonetizationPlanId;
  targetPlanId: MonetizationPlanId;
  changeKind: SubscriptionRenewalChangeKind;
  applyAfter?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  return {
    version: 1,
    queue_type: 'subscription_renewal_change',
    workspace_id: input.workspaceId,
    user_id: input.userId,
    renewal_change_id: input.renewalChangeId,
    current_plan_id: input.currentPlanId,
    target_plan_id: input.targetPlanId,
    current_plan_label: monetizationPlanLabel(input.currentPlanId),
    target_plan_label: monetizationPlanLabel(input.targetPlanId),
    change_kind: input.changeKind,
    status: 'open',
    review_status: 'needs_review',
    provider: 'manual_provider_pending',
    provider_sync_status: 'pending_provider_connection',
    priority: 'normal',
    apply_after: clean(input.applyAfter) ?? null,
    created_at: timestamp,
    updated_at: timestamp,
    note: 'Review this renewal change when billing provider management is connected.',
  };
}

export function buildSubscriptionRenewalAuditRecord(input: {
  workspaceId: string;
  userId?: string | null;
  renewalChangeId: string;
  adminQueueId?: string | null;
  action: 'queued' | 'cancelled' | 'ready_for_review' | 'mark_processing' | 'complete' | 'reject';
  status: string;
  reviewStatus: string;
  serverSyncStatus: string;
  currentPlanId?: MonetizationPlanId | null;
  targetPlanId?: MonetizationPlanId | null;
  resolvedBy?: string | null;
  providerReference?: string | null;
  note?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  return {
    version: 1,
    workspace_id: input.workspaceId,
    user_id: clean(input.userId),
    renewal_change_id: input.renewalChangeId,
    admin_queue_id: clean(input.adminQueueId),
    action: input.action,
    status: input.status,
    review_status: input.reviewStatus,
    server_sync_status: input.serverSyncStatus,
    current_plan_id: input.currentPlanId ?? null,
    target_plan_id: input.targetPlanId ?? null,
    current_plan_label: input.currentPlanId ? monetizationPlanLabel(input.currentPlanId) : null,
    target_plan_label: input.targetPlanId ? monetizationPlanLabel(input.targetPlanId) : null,
    resolved_by: clean(input.resolvedBy),
    provider_reference: clean(input.providerReference),
    note: clean(input.note),
    created_at: timestamp,
  };
}

export function buildBillingPortalSessionRecord(input: {
  workspaceId: string;
  userId: string;
  currentPlanId?: MonetizationPlanId | null;
  callbackUrl?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  return {
    version: 1,
    workspace_id: input.workspaceId,
    user_id: input.userId,
    current_plan_id: input.currentPlanId ?? null,
    callback_url: normalizeHttpsUrl(input.callbackUrl),
    provider: 'manual_provider_pending',
    provider_status: 'provider_not_connected',
    portal_url: null,
    created_at: timestamp,
    last_modified: timestamp,
  };
}

export function verifyRazorpayWebhookSignature(
  rawBody: Buffer | string,
  providedSignature?: string | null,
  webhookSecret?: string | null
): boolean {
  const signature = clean(providedSignature);
  const secret = clean(webhookSecret);
  if (!signature || !secret || !isConfiguredCredential(secret)) {
    return false;
  }

  const expectedSignature = createHmac('sha256', secret).update(rawBody).digest('hex');
  return secureEquals(signature, expectedSignature);
}

type RazorpayCheckoutPayloadInput = {
  workspaceId: string;
  businessName: string;
  invoiceId: string;
  invoiceNumber: string;
  customerId?: string | null;
  customerName?: string | null;
  amount: number;
  currency: string;
  reference: string;
  callbackUrl?: string | null;
};

type RazorpayCheckoutPayload = {
  amount: number;
  currency: string;
  accept_partial: boolean;
  description: string;
  reference_id: string;
  customer?: {
    name: string;
  };
  notify: {
    sms: boolean;
    email: boolean;
  };
  reminder_enable: boolean;
  callback_url?: string;
  callback_method?: 'get';
  notes: Record<string, string>;
};

export function buildRazorpayCheckoutPayload(input: RazorpayCheckoutPayloadInput): RazorpayCheckoutPayload {
  const amount = Math.max(Number.isFinite(input.amount) ? input.amount : 0, 0);
  const callbackUrl = normalizeHttpsUrl(input.callbackUrl);

  return {
    amount: Math.round(amount * 100),
    currency: normalizeCurrency(input.currency),
    accept_partial: false,
    description: `${clean(input.businessName) ?? 'Orbit Ledger'} invoice ${input.invoiceNumber}`,
    reference_id: trimProviderReference(input.reference),
    customer: clean(input.customerName) ? { name: clean(input.customerName) as string } : undefined,
    notify: {
      sms: false,
      email: false,
    },
    reminder_enable: true,
    ...(callbackUrl ? { callback_url: callbackUrl, callback_method: 'get' as const } : {}),
    notes: {
      orbit_workspace_id: trimProviderNote(input.workspaceId),
      orbit_invoice_id: trimProviderNote(input.invoiceId),
      orbit_invoice_number: trimProviderNote(input.invoiceNumber),
      ...(clean(input.customerId) ? { orbit_customer_id: trimProviderNote(input.customerId as string) } : {}),
      ...(clean(input.customerName) ? { orbit_customer_name: trimProviderNote(input.customerName as string) } : {}),
    },
  };
}

export const createRazorpayCheckout = onRequest(
  {
    region: 'asia-south1',
    cors: true,
    maxInstances: 10,
    secrets: [razorpayKeyId, razorpayKeySecret],
  },
  async (request, response) => {
    response.set('Cache-Control', 'no-store');
    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }
    if (request.method !== 'POST') {
      response.set('Allow', 'POST').status(405).json({ ok: false, error: 'method_not_allowed' });
      return;
    }

    const userId = await verifyRequestUserId(request);
    if (!userId) {
      response.status(401).json({ ok: false, error: 'unauthorized' });
      return;
    }

    const body = asRecord(request.body);
    const workspaceId = clean(stringValue(body?.workspaceId));
    const invoiceId = clean(stringValue(body?.invoiceId));
    const callbackUrl = clean(stringValue(body?.callbackUrl));
    if (!workspaceId || !invoiceId) {
      response.status(400).json({ ok: false, error: 'invoice_required' });
      return;
    }

    try {
      const context = await loadCheckoutContext(userId, workspaceId, invoiceId);
      if (!context.ok) {
        response.status(context.status).json({ ok: false, error: context.error });
        return;
      }

      const { workspace, invoice, customer } = context;
      const totalAmount = money(invoice.total_amount);
      const paidAmount = money(invoice.paid_amount);
      const amountDue = roundMoney(Math.max(totalAmount - paidAmount, 0));
      if (amountDue <= 0) {
        response.status(400).json({ ok: false, error: 'invoice_already_paid' });
        return;
      }

      const keyId = getSecretValue(razorpayKeyId, 'RAZORPAY_KEY_ID');
      const keySecret = getSecretValue(razorpayKeySecret, 'RAZORPAY_KEY_SECRET');
      if (!isConfiguredCredential(keyId) || !isConfiguredCredential(keySecret)) {
        response.status(503).json({
          ok: false,
          error: 'provider_not_connected',
          message: 'Razorpay is not connected yet.',
        });
        return;
      }

      const now = new Date().toISOString();
      const invoiceNumber = clean(stringValue(invoice.invoice_number)) ?? invoiceId.slice(0, 8).toUpperCase();
      const reference = buildCheckoutReference(invoiceNumber, money(invoice.version_number), now);
      const checkoutPayload = buildRazorpayCheckoutPayload({
        workspaceId,
        businessName: clean(stringValue(workspace.business_name)) ?? 'Orbit Ledger',
        invoiceId,
        invoiceNumber,
        customerId: clean(stringValue(invoice.customer_id)),
        customerName: clean(stringValue(customer?.name)) ?? clean(stringValue(invoice.customer_name)),
        amount: amountDue,
        currency: clean(stringValue(workspace.currency)) ?? 'INR',
        reference,
        callbackUrl,
      });

      const providerCheckout = await createRazorpayPaymentLink(checkoutPayload, keyId, keySecret);
      const checkoutId = clean(stringValue(providerCheckout.id)) ?? normalizeId(`razorpay_${invoiceId}_${Date.now()}`);
      const checkoutUrl = clean(stringValue(providerCheckout.short_url));
      if (!checkoutUrl) {
        throw new Error('Razorpay did not return a checkout URL.');
      }

      await Promise.all([
        db.collection('workspaces').doc(workspaceId).collection('payment_checkouts').doc(checkoutId).set(
          {
            provider: 'razorpay',
            provider_checkout_id: checkoutId,
            provider_checkout_url: checkoutUrl,
            provider_status: clean(stringValue(providerCheckout.status)) ?? 'created',
            invoice_id: invoiceId,
            invoice_number: invoiceNumber,
            customer_id: clean(stringValue(invoice.customer_id)),
            amount: amountDue,
            currency: checkoutPayload.currency,
            reference,
            created_at: now,
            last_modified: now,
          },
          { merge: true }
        ),
        db.collection('workspaces').doc(workspaceId).collection('invoices').doc(invoiceId).set(
          {
            provider_checkout_url: checkoutUrl,
            provider_checkout_id: checkoutId,
            provider_checkout_reference: reference,
            last_modified: now,
            server_revision: admin.firestore.FieldValue.increment(1),
          },
          { merge: true }
        ),
      ]);

      response.status(200).json({
        ok: true,
        provider: 'razorpay',
        checkoutId,
        checkoutUrl,
        reference,
      });
    } catch (error) {
      logger.error('createRazorpayCheckout failed', { workspaceId, invoiceId, error });
      response.status(500).json({ ok: false, error: 'checkout_failed' });
    }
  }
);

export const createSubscriptionCheckout = onRequest(
  {
    region: 'asia-south1',
    cors: true,
    maxInstances: 10,
  },
  async (request, response) => {
    response.set('Cache-Control', 'no-store');
    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }
    if (request.method !== 'POST') {
      response.set('Allow', 'POST').status(405).json({ ok: false, error: 'method_not_allowed' });
      return;
    }

    const userId = await verifyRequestUserId(request);
    if (!userId) {
      response.status(401).json({ ok: false, error: 'unauthorized' });
      return;
    }

    const body = asRecord(request.body);
    const workspaceId = clean(stringValue(body?.workspaceId));
    const checkoutIntentId = clean(stringValue(body?.checkoutIntentId));
    const planId = clean(stringValue(body?.planId));
    const callbackUrl = normalizeHttpsUrl(clean(stringValue(body?.callbackUrl)));
    if (!workspaceId || !checkoutIntentId || !isMonetizationPlanId(planId)) {
      response.status(400).json({ ok: false, error: 'checkout_required' });
      return;
    }

    try {
      const workspace = await loadWorkspaceForUser(userId, workspaceId);
      if (!workspace.ok) {
        response.status(workspace.status).json({ ok: false, error: workspace.error });
        return;
      }

      const entitlementSnapshot = await db
        .collection('users')
        .doc(userId)
        .collection('subscription_entitlements')
        .doc(workspaceId)
        .get();
      const planChange = resolveMonetizationPlanChange(entitlementSnapshot.data()?.plan_id, planId);
      if (!planChange.canApply) {
        const now = new Date().toISOString();
        const checkoutPricing = resolveSubscriptionCheckoutPricing(
          planId,
          clean(stringValue(workspace.workspace.country_code)),
          clean(stringValue(workspace.workspace.currency))
        );
        const billingMetadata = buildSubscriptionBillingMetadata({
          workspaceId,
          userId,
          planId,
          checkoutIntentId,
          pricing: checkoutPricing,
          workspace: workspace.workspace,
          status: 'blocked',
          provider: 'manual_provider_pending',
          now: new Date(now),
        });
        await db.collection('workspaces').doc(workspaceId).collection('subscription_checkouts').doc(checkoutIntentId).set(
          {
            ...billingMetadata,
            provider: 'manual_provider_pending',
            provider_status: 'blocked_plan_change',
            checkout_intent_id: checkoutIntentId,
            user_id: userId,
            workspace_id: workspaceId,
            plan_id: planId,
            product_id: monetizationPlanCatalog[planId].productId,
            tier: monetizationPlanCatalog[planId].tier,
            pricing_country: checkoutPricing.pricingCountry,
            currency: checkoutPricing.currency,
            amount_minor: checkoutPricing.amountMinor,
            amount_display: checkoutPricing.amountDisplay,
            checkout_provider: checkoutPricing.checkoutProvider,
            provider_price_id: checkoutPricing.providerPriceId,
            provider_price_status: checkoutPricing.providerPriceStatus,
            plan_change_kind: planChange.kind,
            failure_reason: planChange.reason,
            last_modified: now,
          },
          { merge: true }
        );
        response.status(409).json({
          ok: false,
          error: planChange.reason ?? 'plan_change_blocked',
          planChange: planChange.kind,
          message:
            planChange.kind === 'current_plan'
              ? 'This plan is already active.'
              : 'Plan reductions and billing-cycle changes are handled at renewal.',
        });
        return;
      }

      const now = new Date().toISOString();
      const checkoutPricing = resolveSubscriptionCheckoutPricing(
        planId,
        clean(stringValue(workspace.workspace.country_code)),
        clean(stringValue(workspace.workspace.currency))
      );
      const reference = trimProviderReference(`SUB-${planId}-${checkoutIntentId.slice(-8)}-${Date.now().toString(36)}`);
      const billingMetadata = buildSubscriptionBillingMetadata({
        workspaceId,
        userId,
        planId,
        checkoutIntentId,
        pricing: checkoutPricing,
        workspace: workspace.workspace,
        status: 'pending',
        provider: checkoutPricing.checkoutProvider,
        providerReference: reference,
        now: new Date(now),
      });
      await db.collection('workspaces').doc(workspaceId).collection('subscription_checkouts').doc(checkoutIntentId).set(
        {
          ...billingMetadata,
          provider: checkoutPricing.checkoutProvider,
          provider_status: 'provider_not_connected',
          checkout_intent_id: checkoutIntentId,
          user_id: userId,
          workspace_id: workspaceId,
          plan_id: planId,
          product_id: monetizationPlanCatalog[planId].productId,
          tier: monetizationPlanCatalog[planId].tier,
          pricing_country: checkoutPricing.pricingCountry,
          currency: checkoutPricing.currency,
          amount_minor: checkoutPricing.amountMinor,
          amount_display: checkoutPricing.amountDisplay,
          checkout_provider: checkoutPricing.checkoutProvider,
          provider_price_id: checkoutPricing.providerPriceId,
          provider_price_status: checkoutPricing.providerPriceStatus,
          plan_change_kind: planChange.kind,
          reference,
          callback_url: callbackUrl,
          created_at: now,
          last_modified: now,
        },
        { merge: true }
      );

      response.status(503).json({
        ok: false,
        error: 'provider_not_connected',
        provider: checkoutPricing.checkoutProvider,
        checkoutId: checkoutIntentId,
        reference,
        amountMinor: checkoutPricing.amountMinor,
        amountDisplay: checkoutPricing.amountDisplay,
        currency: checkoutPricing.currency,
        pricingCountry: checkoutPricing.pricingCountry,
        providerPriceId: checkoutPricing.providerPriceId,
        providerPriceStatus: checkoutPricing.providerPriceStatus,
        message: 'Payment provider checkout is not connected yet.',
      });
    } catch (error) {
      logger.error('createSubscriptionCheckout failed', { workspaceId, checkoutIntentId, planId, error });
      if (workspaceId && checkoutIntentId && isMonetizationPlanId(planId)) {
        try {
          const now = new Date().toISOString();
          const eventId = normalizeId(`subscription_checkout_failed_${checkoutIntentId}_${Date.now()}`);
          const checkoutPricing = resolveSubscriptionCheckoutPricing(planId);
          const billingMetadata = buildSubscriptionBillingMetadata({
            workspaceId,
            userId,
            planId,
            checkoutIntentId,
            pricing: checkoutPricing,
            status: 'failed',
            provider: 'manual_provider_pending',
            now: new Date(now),
          });
          await Promise.all([
            db.collection('workspaces').doc(workspaceId).collection('subscription_checkouts').doc(checkoutIntentId).set(
              {
                ...billingMetadata,
                provider: 'manual_provider_pending',
                provider_status: 'failed',
                checkout_intent_id: checkoutIntentId,
                user_id: userId,
                workspace_id: workspaceId,
                plan_id: planId,
                product_id: monetizationPlanCatalog[planId].productId,
                tier: monetizationPlanCatalog[planId].tier,
                failure_reason: 'checkout_failed',
                last_modified: now,
              },
              { merge: true }
            ),
            db.collection('workspaces').doc(workspaceId).collection('subscription_events').doc(eventId).set(
              {
                ...billingMetadata,
                provider: 'manual_provider_pending',
                status: 'failed',
                userId,
                workspaceId,
                checkoutIntentId,
                planId,
                failure_reason: 'checkout_failed',
                received_at: now,
              },
              { merge: true }
            ),
          ]);
        } catch (writeError) {
          logger.error('subscription checkout failure record could not be saved', {
            workspaceId,
            checkoutIntentId,
            writeError,
          });
        }
      }
      response.status(500).json({ ok: false, error: 'checkout_failed' });
    }
  }
);

export const monetizationWebhook = onRequest(
  {
    region: 'asia-south1',
    cors: true,
    maxInstances: 10,
    secrets: [monetizationWebhookSecret],
  },
  async (request, response) => {
    response.set('Cache-Control', 'no-store');
    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }
    if (request.method !== 'POST') {
      response.set('Allow', 'POST').status(405).json({ ok: false, error: 'method_not_allowed' });
      return;
    }
    if (!isAuthorizedMonetizationWebhook(request)) {
      response.status(401).json({ ok: false, error: 'unauthorized' });
      return;
    }

    const payload = normalizeMonetizationWebhookPayload(request.body);
    const validationError = validateMonetizationWebhookPayload(payload);
    if (validationError) {
      response.status(400).json({ ok: false, error: validationError });
      return;
    }

    const userId = clean(payload.userId) as string;
    const workspaceId = clean(payload.workspaceId) as string;
    const checkoutIntentId = clean(payload.checkoutIntentId) as string;
    const planId = payload.planId as MonetizationPlanId;
    const status = payload.status as MonetizationWebhookStatus;
    const now = new Date();
    const timestamp = now.toISOString();

    try {
      const checkoutRef = db
        .collection('workspaces')
        .doc(workspaceId)
        .collection('subscription_checkouts')
        .doc(checkoutIntentId);
      const eventId = normalizeId(
        `${normalizeMonetizationProvider(payload.provider)}_${payload.transactionId ?? payload.providerReference ?? checkoutIntentId}`
      );
      const eventRef = db.collection('workspaces').doc(workspaceId).collection('subscription_events').doc(eventId);
      const entitlementRef = db.collection('users').doc(userId).collection('subscription_entitlements').doc(workspaceId);
      const auditRef = db.collection('users').doc(userId).collection('subscription_entitlement_audit').doc(eventId);
      let entitlementApplied = false;

      await db.runTransaction(async (transaction) => {
        const checkoutSnapshot = await transaction.get(checkoutRef);
        const checkoutRecord = checkoutSnapshot.data() ?? {};
        const checkoutPricing = resolveSubscriptionCheckoutPricingFromRecord(planId, checkoutRecord);
        const billingMetadata = buildSubscriptionBillingMetadata({
          workspaceId,
          userId,
          planId,
          checkoutIntentId,
          pricing: checkoutPricing,
          workspace: checkoutRecord,
          status: status === 'confirmed' ? 'confirmed' : status,
          provider: normalizeMonetizationProvider(payload.provider),
          transactionId: clean(payload.transactionId),
          providerReference: clean(payload.providerReference),
          now,
        });
        const entitlementSnapshot = await transaction.get(entitlementRef);
        const planChange = resolveMonetizationPlanChange(entitlementSnapshot.data()?.plan_id, planId);
        const shouldApplyEntitlement = status === 'confirmed' && planChange.canApply;
        entitlementApplied = shouldApplyEntitlement;

        transaction.set(
          checkoutRef,
          {
            ...billingMetadata,
            checkout_intent_id: checkoutIntentId,
            user_id: userId,
            workspace_id: workspaceId,
            plan_id: planId,
            product_id: monetizationPlanCatalog[planId].productId,
            tier: monetizationPlanCatalog[planId].tier,
            provider: normalizeMonetizationProvider(payload.provider),
            provider_status: status,
            provider_reference: clean(payload.providerReference),
            transaction_id: clean(payload.transactionId),
            confirmed_at: status === 'confirmed' ? payload.paidAt ?? timestamp : null,
            plan_change_kind: planChange.kind,
            entitlement_apply_status:
              status === 'confirmed' ? (shouldApplyEntitlement ? 'applied' : 'blocked') : 'not_applicable',
            entitlement_block_reason: shouldApplyEntitlement ? null : planChange.reason,
            last_modified: timestamp,
          },
          { merge: true }
        );
        transaction.set(
          eventRef,
          {
            ...payload,
            ...billingMetadata,
            provider: normalizeMonetizationProvider(payload.provider),
            status,
            plan_change_kind: planChange.kind,
            entitlement_apply_status:
              status === 'confirmed' ? (shouldApplyEntitlement ? 'applied' : 'blocked') : 'not_applicable',
            entitlement_block_reason: shouldApplyEntitlement ? null : planChange.reason,
            received_at: timestamp,
          },
          { merge: true }
        );

        if (shouldApplyEntitlement) {
          transaction.set(
            entitlementRef,
            buildSubscriptionEntitlementRecord(payload, now),
            { merge: true }
          );
          transaction.set(
            auditRef,
            {
              ...buildSubscriptionEntitlementAuditRecord(payload, eventId, now),
              ...billingMetadata,
              workspace_id: workspaceId,
            },
            { merge: true }
          );
        } else if (status === 'confirmed') {
          transaction.set(
            auditRef,
            {
              ...billingMetadata,
              version: 1,
              event_id: eventId,
              action: 'entitlement_change_blocked',
              status: 'blocked',
              plan_id: planId,
              tier: monetizationPlanCatalog[planId].tier,
              product_id: monetizationPlanCatalog[planId].productId,
              checkout_intent_id: checkoutIntentId,
              transaction_id: clean(payload.transactionId),
              provider: normalizeMonetizationProvider(payload.provider),
              provider_reference: clean(payload.providerReference),
              workspace_id: workspaceId,
              reason: planChange.reason,
              received_at: payload.paidAt ?? timestamp,
              created_at: timestamp,
            },
            { merge: true }
          );
        }
      });

      response.status(200).json({ ok: true, applied: entitlementApplied });
    } catch (error) {
      logger.error('monetizationWebhook failed', { workspaceId, checkoutIntentId, error });
      response.status(500).json({ ok: false, error: 'webhook_failed' });
    }
  }
);

export const createBillingPortalSession = onRequest(
  {
    region: 'asia-south1',
    cors: true,
    maxInstances: 10,
  },
  async (request, response) => {
    response.set('Cache-Control', 'no-store');
    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }
    if (request.method !== 'POST') {
      response.set('Allow', 'POST').status(405).json({ ok: false, error: 'method_not_allowed' });
      return;
    }

    const userId = await verifyRequestUserId(request);
    if (!userId) {
      response.status(401).json({ ok: false, error: 'unauthorized' });
      return;
    }

    const body = asRecord(request.body);
    const workspaceId = clean(stringValue(body?.workspaceId));
    const callbackUrl = clean(stringValue(body?.callbackUrl));
    if (!workspaceId) {
      response.status(400).json({ ok: false, error: 'workspace_required' });
      return;
    }

    try {
      const workspace = await loadWorkspaceForUser(userId, workspaceId);
      if (!workspace.ok) {
        response.status(workspace.status).json({ ok: false, error: workspace.error });
        return;
      }

      const entitlementSnapshot = await db
        .collection('users')
        .doc(userId)
        .collection('subscription_entitlements')
        .doc(workspaceId)
        .get();
      const currentPlanId = entitlementSnapshot.data()?.plan_id;
      const portalSessionId = normalizeId(`billing_portal_${userId}_${Date.now()}`);
      await db
        .collection('workspaces')
        .doc(workspaceId)
        .collection('subscription_billing_portal_sessions')
        .doc(portalSessionId)
        .set(
          buildBillingPortalSessionRecord({
            workspaceId,
            userId,
            currentPlanId: isMonetizationPlanId(currentPlanId) ? currentPlanId : null,
            callbackUrl,
          }),
          { merge: true }
        );

      response.status(503).json({
        ok: false,
        error: 'provider_not_connected',
        provider: 'manual_provider_pending',
        portalSessionId,
        portalUrl: null,
        message: 'Billing portal will be available after the payment provider is connected.',
      });
    } catch (error) {
      logger.error('createBillingPortalSession failed', { workspaceId, error });
      response.status(500).json({ ok: false, error: 'billing_portal_failed' });
    }
  }
);

export const manageSubscriptionBillingDocument = onRequest(
  {
    region: 'asia-south1',
    cors: true,
    maxInstances: 10,
  },
  async (request, response) => {
    response.set('Cache-Control', 'no-store');
    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }
    if (request.method !== 'POST') {
      response.set('Allow', 'POST').status(405).json({ ok: false, error: 'method_not_allowed' });
      return;
    }

    const userId = await verifyRequestUserId(request);
    if (!userId) {
      response.status(401).json({ ok: false, error: 'unauthorized' });
      return;
    }

    const body = asRecord(request.body);
    const action = clean(stringValue(body?.action)) as SubscriptionBillingDocumentAction | null;
    const workspaceId = clean(stringValue(body?.workspaceId));
    const checkoutIntentId = clean(stringValue(body?.checkoutIntentId));
    const recipientEmail = clean(stringValue(body?.recipientEmail));
    if (!workspaceId || !checkoutIntentId || (action !== 'queue_email' && action !== 'recover_document')) {
      response.status(400).json({ ok: false, error: 'billing_document_required' });
      return;
    }

    try {
      const workspace = await loadWorkspaceForUser(userId, workspaceId);
      if (!workspace.ok) {
        response.status(workspace.status).json({ ok: false, error: workspace.error });
        return;
      }

      const checkoutRef = db
        .collection('workspaces')
        .doc(workspaceId)
        .collection('subscription_checkouts')
        .doc(checkoutIntentId);
      const checkoutSnapshot = await checkoutRef.get();
      if (!checkoutSnapshot.exists) {
        response.status(404).json({ ok: false, error: 'billing_document_not_found' });
        return;
      }

      const checkoutRecord = checkoutSnapshot.data() ?? {};
      const planId = clean(stringValue(checkoutRecord.plan_id));
      if (!isMonetizationPlanId(planId)) {
        response.status(409).json({ ok: false, error: 'billing_document_invalid' });
        return;
      }

      const now = new Date();
      const timestamp = now.toISOString();
      const checkoutPricing = resolveSubscriptionCheckoutPricingFromRecord(planId, checkoutRecord);
      const documentStatus = billingDocumentStatusFromCheckout(checkoutRecord);
      const billingMetadata = buildSubscriptionBillingMetadata({
        workspaceId,
        userId,
        planId,
        checkoutIntentId,
        pricing: checkoutPricing,
        workspace: { ...workspace.workspace, ...checkoutRecord },
        status: documentStatus,
        provider: clean(stringValue(checkoutRecord.provider)),
        transactionId: clean(stringValue(checkoutRecord.transaction_id)),
        providerReference: clean(stringValue(checkoutRecord.provider_reference)) ?? clean(stringValue(checkoutRecord.reference)),
        now,
      });

      if (action === 'recover_document') {
        await checkoutRef.set(
          {
            ...billingMetadata,
            billing_recovery_status: 'completed',
            billing_recovered_at: timestamp,
            billing_recovered_by: userId,
            last_modified: timestamp,
          },
          { merge: true }
        );
        response.status(200).json({
          ok: true,
          action,
          checkoutIntentId,
          receiptNumber: billingMetadata.receipt_number,
          taxInvoiceNumber: billingMetadata.tax_invoice_number,
          receiptStatus: billingMetadata.receipt_status,
          message: 'Billing document recovered.',
        });
        return;
      }

      const finalRecipient =
        recipientEmail ??
        clean(stringValue(checkoutRecord.buyer_email)) ??
        clean(stringValue(workspace.workspace.email)) ??
        clean(stringValue(workspace.workspace.owner_email));
      if (!finalRecipient || !isValidEmailAddress(finalRecipient)) {
        response.status(400).json({
          ok: false,
          error: 'recipient_required',
          message: 'Add a billing email before sending the receipt.',
        });
        return;
      }

      const requestId = normalizeId(`billing_receipt_email_${checkoutIntentId}_${Date.now()}`);
      const adminQueueId = normalizeId(`admin_billing_receipt_email_${checkoutIntentId}`);
      const resendCount = numberValue(checkoutRecord.billing_email_resend_count, 0) + 1;
      const requestRecord = buildSubscriptionBillingEmailRequestRecord({
        workspaceId,
        userId,
        checkoutIntentId,
        planId,
        receiptNumber: clean(stringValue(checkoutRecord.receipt_number)) ?? billingMetadata.receipt_number,
        taxInvoiceNumber: clean(stringValue(checkoutRecord.tax_invoice_number)) ?? billingMetadata.tax_invoice_number,
        recipientEmail: finalRecipient,
        requestedBy: userId,
        buyerBusinessName: clean(stringValue(checkoutRecord.buyer_business_name)) ?? clean(stringValue(workspace.workspace.business_name)),
        amountDisplay: clean(stringValue(checkoutRecord.amount_display)) ?? billingMetadata.amount_display,
        adminQueueId,
        resendCount,
        now,
      });
      const deliveryResult = await deliverSubscriptionBillingEmailRequest({
        ...requestRecord,
      });
      const deliveryUpdate = buildSubscriptionBillingEmailDeliveryUpdate({
        status: deliveryResult.status,
        providerMessageId: deliveryResult.providerMessageId,
        sentAt: deliveryResult.sentAt,
        failureReason: deliveryResult.failureReason,
        now,
      });

      await Promise.all([
        db
          .collection('workspaces')
          .doc(workspaceId)
          .collection('subscription_billing_email_requests')
          .doc(requestId)
          .set({ ...requestRecord, ...deliveryUpdate }, { merge: true }),
        db
          .collection('workspaces')
          .doc(workspaceId)
          .collection('subscription_admin_queue')
          .doc(adminQueueId)
          .set(
            buildSubscriptionBillingEmailAdminQueueRecord({
              workspaceId,
              userId,
              checkoutIntentId,
              requestId,
              planId,
              receiptNumber: requestRecord.receipt_number,
              recipientEmail: finalRecipient,
              deliveryStatus: deliveryResult.status,
              resendCount,
              now,
            }),
            { merge: true }
          ),
        checkoutRef.set(
          {
            billing_email_status: deliveryUpdate.status,
            billing_email_delivery_status: deliveryUpdate.delivery_status,
            billing_email_provider_status: deliveryUpdate.email_provider_status,
            billing_email_recipient: finalRecipient,
            billing_email_request_id: requestId,
            billing_email_admin_queue_id: adminQueueId,
            billing_email_admin_review_status: deliveryResult.status === 'sent' ? 'completed' : 'needs_review',
            billing_email_resend_count: resendCount,
            billing_email_last_resend_at: resendCount > 1 ? timestamp : null,
            billing_email_requested_at: timestamp,
            billing_email_requested_by: userId,
            billing_email_sent_at: deliveryUpdate.sent_at,
            billing_email_provider_message_id: deliveryUpdate.provider_message_id,
            billing_email_last_error: deliveryUpdate.failure_reason,
            last_modified: timestamp,
          },
          { merge: true }
        ),
      ]);

      response.status(200).json({
        ok: true,
        action,
        checkoutIntentId,
        requestId,
        status: deliveryResult.status,
        recipientEmail: finalRecipient,
        message:
          deliveryResult.status === 'sent'
            ? 'Receipt email sent.'
            : deliveryResult.status === 'pending_provider_connection'
              ? 'Receipt email is queued and will send after email delivery is connected.'
              : deliveryResult.status === 'failed'
                ? 'Receipt email could not be sent.'
                : 'Receipt email queued.',
      });
    } catch (error) {
      logger.error('manageSubscriptionBillingDocument failed', { workspaceId, checkoutIntentId, action, error });
      response.status(500).json({ ok: false, error: 'billing_document_action_failed' });
    }
  }
);

export const syncSubscriptionBillingEmailDelivery = onRequest(
  {
    region: 'asia-south1',
    cors: true,
    maxInstances: 10,
    secrets: [monetizationWebhookSecret],
  },
  async (request, response) => {
    response.set('Cache-Control', 'no-store');
    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }
    if (request.method !== 'POST') {
      response.set('Allow', 'POST').status(405).json({ ok: false, error: 'method_not_allowed' });
      return;
    }
    if (!isAuthorizedMonetizationWebhook(request)) {
      response.status(401).json({ ok: false, error: 'unauthorized' });
      return;
    }

    const body = asRecord(request.body);
    const workspaceId = clean(stringValue(body?.workspaceId));
    const requestId = clean(stringValue(body?.requestId));
    const checkoutIntentId = clean(stringValue(body?.checkoutIntentId));
    const status = normalizeBillingEmailDeliveryStatus(clean(stringValue(body?.status)));
    const providerMessageId = clean(stringValue(body?.providerMessageId));
    const sentAt = clean(stringValue(body?.sentAt));
    const failureReason = clean(stringValue(body?.failureReason));

    if (!workspaceId || !requestId || !checkoutIntentId || !status) {
      response.status(400).json({ ok: false, error: 'delivery_sync_required' });
      return;
    }

    try {
      const now = new Date();
      const update = buildSubscriptionBillingEmailDeliveryUpdate({
        status,
        providerMessageId,
        sentAt,
        failureReason,
        now,
      });
      const requestRef = db
        .collection('workspaces')
        .doc(workspaceId)
        .collection('subscription_billing_email_requests')
        .doc(requestId);
      const requestSnapshot = await requestRef.get();
      const requestRecord = requestSnapshot.data() ?? {};
      const adminQueueId =
        clean(stringValue(requestRecord.admin_queue_id)) ?? normalizeId(`admin_billing_receipt_email_${checkoutIntentId}`);
      const adminReviewStatus = status === 'sent' ? 'completed' : 'needs_review';
      await Promise.all([
        requestRef.set({ ...update, admin_review_status: adminReviewStatus }, { merge: true }),
        db
          .collection('workspaces')
          .doc(workspaceId)
          .collection('subscription_admin_queue')
          .doc(adminQueueId)
          .set(
            {
              status: status === 'sent' ? 'completed' : 'open',
              review_status: adminReviewStatus,
              provider_sync_status:
                status === 'sent' ? 'completed' : status === 'failed' ? 'failed' : 'pending_provider_connection',
              delivery_status: status,
              provider_action_required: status !== 'sent',
              provider_message_id: update.provider_message_id,
              note:
                status === 'sent'
                  ? 'Billing receipt email delivery confirmed.'
                  : status === 'failed'
                    ? update.failure_reason ?? 'Billing receipt email failed.'
                    : 'Billing receipt email is waiting for delivery connection.',
              updated_at: update.updated_at,
            },
            { merge: true }
          ),
        db
          .collection('workspaces')
          .doc(workspaceId)
          .collection('subscription_checkouts')
          .doc(checkoutIntentId)
          .set(
            {
              billing_email_status: update.status,
              billing_email_delivery_status: update.delivery_status,
              billing_email_provider_status: update.email_provider_status,
              billing_email_admin_queue_id: adminQueueId,
              billing_email_admin_review_status: adminReviewStatus,
              billing_email_sent_at: update.sent_at,
              billing_email_provider_message_id: update.provider_message_id,
              billing_email_last_error: update.failure_reason,
              last_modified: update.updated_at,
            },
            { merge: true }
          ),
      ]);
      response.status(200).json({ ok: true, status, requestId, checkoutIntentId });
    } catch (error) {
      logger.error('syncSubscriptionBillingEmailDelivery failed', { workspaceId, requestId, checkoutIntentId, error });
      response.status(500).json({ ok: false, error: 'delivery_sync_failed' });
    }
  }
);

export const processSubscriptionBillingEmailQueue = onSchedule(
  {
    region: 'asia-south1',
    schedule: 'every 15 minutes',
    timeZone: 'Asia/Kolkata',
    secrets: [resendApiKey],
  },
  async () => {
    const snapshot = await db
      .collectionGroup('subscription_billing_email_requests')
      .where('delivery_status', 'in', ['queued', 'pending_provider_connection'])
      .limit(20)
      .get();

    for (const requestSnapshot of snapshot.docs) {
      const workspaceRef = requestSnapshot.ref.parent.parent;
      if (!workspaceRef) {
        continue;
      }
      const request = requestSnapshot.data();
      const checkoutIntentId = clean(stringValue(request.checkout_intent_id));
      if (!checkoutIntentId) {
        continue;
      }
      const result = await deliverSubscriptionBillingEmailRequest(request);
      const update = buildSubscriptionBillingEmailDeliveryUpdate({
        status: result.status,
        providerMessageId: result.providerMessageId,
        sentAt: result.sentAt,
        failureReason: result.failureReason,
      });
      const adminQueueId =
        clean(stringValue(request.admin_queue_id)) ?? normalizeId(`admin_billing_receipt_email_${checkoutIntentId}`);
      const adminReviewStatus = result.status === 'sent' ? 'completed' : 'needs_review';
      await Promise.all([
        requestSnapshot.ref.set({ ...update, admin_review_status: adminReviewStatus }, { merge: true }),
        workspaceRef.collection('subscription_admin_queue').doc(adminQueueId).set(
          {
            status: result.status === 'sent' ? 'completed' : 'open',
            review_status: adminReviewStatus,
            provider_sync_status:
              result.status === 'sent'
                ? 'completed'
                : result.status === 'failed'
                  ? 'failed'
                  : 'pending_provider_connection',
            delivery_status: result.status,
            provider_action_required: result.status !== 'sent',
            provider_message_id: update.provider_message_id,
            note:
              result.status === 'sent'
                ? 'Billing receipt email sent by queue processor.'
                : result.status === 'failed'
                  ? update.failure_reason ?? 'Billing receipt email failed.'
                  : 'Billing receipt email is waiting for delivery connection.',
            updated_at: update.updated_at,
          },
          { merge: true }
        ),
        workspaceRef.collection('subscription_checkouts').doc(checkoutIntentId).set(
          {
            billing_email_status: update.status,
            billing_email_delivery_status: update.delivery_status,
            billing_email_provider_status: update.email_provider_status,
            billing_email_admin_queue_id: adminQueueId,
            billing_email_admin_review_status: adminReviewStatus,
            billing_email_sent_at: update.sent_at,
            billing_email_provider_message_id: update.provider_message_id,
            billing_email_last_error: update.failure_reason,
            last_modified: update.updated_at,
          },
          { merge: true }
        ),
      ]);
    }
  }
);

export const processRecurringInvoiceEmailQueue = onSchedule(
  {
    region: 'asia-south1',
    schedule: 'every 15 minutes',
    timeZone: 'Asia/Kolkata',
    maxInstances: 1,
    secrets: [resendApiKey],
  },
  async () => {
    const today = new Date().toISOString().slice(0, 10);
    const snapshot = await db
      .collectionGroup('email_queue')
      .where('status', 'in', ['ready', 'scheduled', 'pending_provider_connection'])
      .limit(50)
      .get();

    for (const queueSnapshot of snapshot.docs) {
      const workspaceRef = queueSnapshot.ref.parent.parent;
      if (!workspaceRef) {
        continue;
      }
      const request = queueSnapshot.data();
      if (clean(stringValue(request.kind)) !== 'recurring_invoice') {
        continue;
      }
      const scheduledFor = clean(stringValue(request.scheduled_for));
      if (scheduledFor && scheduledFor > today) {
        continue;
      }

      const invoiceId = clean(stringValue(request.invoice_id));
      if (!invoiceId) {
        await queueSnapshot.ref.set({
          status: 'failed',
          delivery_status: 'failed',
          failure_reason: 'invoice_required',
          updated_at: new Date().toISOString(),
        }, { merge: true });
        continue;
      }

      const invoiceRef = workspaceRef.collection('invoices').doc(invoiceId);
      const invoiceSnapshot = await invoiceRef.get();
      if (!invoiceSnapshot.exists) {
        await queueSnapshot.ref.set({
          status: 'failed',
          delivery_status: 'failed',
          failure_reason: 'invoice_not_found',
          updated_at: new Date().toISOString(),
        }, { merge: true });
        continue;
      }

      const invoice = invoiceSnapshot.data() ?? {};
      if (clean(stringValue(invoice.document_state ?? invoice.status)) === 'cancelled') {
        await queueSnapshot.ref.set({
          status: 'failed',
          delivery_status: 'failed',
          failure_reason: 'invoice_cancelled',
          updated_at: new Date().toISOString(),
        }, { merge: true });
        continue;
      }

      const versionId = await ensureRecurringInvoiceSavedVersion(workspaceRef, invoiceRef, invoiceSnapshot.id, invoice);
      const delivery = await deliverRecurringInvoiceEmailRequest({
        workspaceId: workspaceRef.id,
        invoiceId,
        invoice,
        queue: request,
      });
      const now = new Date();
      const sentAt = delivery.sentAt ?? now.toISOString();
      const queuePatch = {
        status: delivery.status === 'sent' ? 'sent' : delivery.status,
        delivery_status: delivery.status,
        email_provider_status:
          delivery.status === 'sent'
            ? 'sent'
            : delivery.status === 'failed'
              ? 'failed'
              : 'pending_connection',
        provider_message_id: delivery.providerMessageId,
        sent_at: delivery.status === 'sent' ? sentAt : null,
        failure_reason: delivery.failureReason,
        updated_at: now.toISOString(),
      };
      const invoicePatch = {
        has_auto_email_history: delivery.status === 'sent' ? true : Boolean(invoice.has_auto_email_history),
        latest_auto_email_status: delivery.status,
        latest_auto_email_sent_at: delivery.status === 'sent' ? sentAt : clean(stringValue(invoice.latest_auto_email_sent_at)),
        latest_auto_email_version_id: versionId,
        auto_email_recipient: clean(stringValue(request.recipient_email)),
        auto_email_queue_id: queueSnapshot.id,
        last_modified: now.toISOString(),
      };
      const versionPatch = {
        auto_email_sent_at: delivery.status === 'sent' ? sentAt : null,
        auto_email_scheduled_for: clean(stringValue(request.scheduled_for)),
        auto_email_recipient: clean(stringValue(request.recipient_email)),
        auto_email_queue_id: queueSnapshot.id,
        auto_email_status: delivery.status,
        auto_email_used_version_id: versionId,
        updated_at: now.toISOString(),
      };
      await Promise.all([
        queueSnapshot.ref.set(queuePatch, { merge: true }),
        invoiceRef.set(invoicePatch, { merge: true }),
        versionId
          ? workspaceRef.collection('invoice_versions').doc(versionId).set(versionPatch, { merge: true })
          : Promise.resolve(),
      ]);
    }
  }
);

export const manageSubscriptionRenewalChange = onRequest(
  {
    region: 'asia-south1',
    cors: true,
    maxInstances: 10,
  },
  async (request, response) => {
    response.set('Cache-Control', 'no-store');
    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }
    if (request.method !== 'POST') {
      response.set('Allow', 'POST').status(405).json({ ok: false, error: 'method_not_allowed' });
      return;
    }

    const userId = await verifyRequestUserId(request);
    if (!userId) {
      response.status(401).json({ ok: false, error: 'unauthorized' });
      return;
    }

    const body = asRecord(request.body);
    const action = clean(stringValue(body?.action));
    const workspaceId = clean(stringValue(body?.workspaceId));
    if (!workspaceId || (action !== 'queue' && action !== 'cancel')) {
      response.status(400).json({ ok: false, error: 'renewal_change_required' });
      return;
    }

    try {
      const workspace = await loadWorkspaceForUser(userId, workspaceId);
      if (!workspace.ok) {
        response.status(workspace.status).json({ ok: false, error: workspace.error });
        return;
      }

      const renewalCollection = db.collection('workspaces').doc(workspaceId).collection('subscription_renewal_changes');
      if (action === 'cancel') {
        const renewalChangeId = clean(stringValue(body?.renewalChangeId));
        if (!renewalChangeId) {
          response.status(400).json({ ok: false, error: 'renewal_change_required' });
          return;
        }
        const renewalRef = renewalCollection.doc(renewalChangeId);
        const renewalSnapshot = await renewalRef.get();
        if (!renewalSnapshot.exists) {
          response.status(404).json({ ok: false, error: 'renewal_change_not_found' });
          return;
        }
        const now = new Date();
        const timestamp = now.toISOString();
        const renewal = renewalSnapshot.data() ?? {};
        const adminQueueId = clean(stringValue(renewal.admin_queue_id));
        const currentPlanId = clean(stringValue(renewal.current_plan_id));
        const targetPlanId = clean(stringValue(renewal.target_plan_id));
        const auditId = normalizeId(`renewal_audit_${renewalChangeId}_cancelled_${Date.now()}`);
        const writes: Promise<unknown>[] = [
          renewalRef.set(
            {
              status: 'cancelled',
              cancelled_by: userId,
              cancelled_at: timestamp,
              server_sync_status: 'cancelled',
              review_status: 'cancelled',
              last_review_note: 'Renewal change cancelled by workspace owner.',
              updated_at: timestamp,
            },
            { merge: true }
          ),
          db
            .collection('workspaces')
            .doc(workspaceId)
            .collection('subscription_renewal_audit')
            .doc(auditId)
            .set(
              buildSubscriptionRenewalAuditRecord({
                workspaceId,
                userId,
                renewalChangeId,
                adminQueueId,
                action: 'cancelled',
                status: 'cancelled',
                reviewStatus: 'cancelled',
                serverSyncStatus: 'cancelled',
                currentPlanId: isMonetizationPlanId(currentPlanId) ? currentPlanId : null,
                targetPlanId: isMonetizationPlanId(targetPlanId) ? targetPlanId : null,
                resolvedBy: userId,
                note: 'Renewal change cancelled by workspace owner.',
                now,
              }),
              { merge: true }
            ),
        ];
        if (adminQueueId) {
          writes.push(
            db
              .collection('workspaces')
              .doc(workspaceId)
              .collection('subscription_admin_queue')
              .doc(adminQueueId)
              .set(
              {
                status: 'cancelled',
                review_status: 'cancelled',
                provider_sync_status: 'cancelled',
                cancelled_by: userId,
                cancelled_at: timestamp,
                updated_at: timestamp,
                note: 'Renewal change cancelled by workspace owner.',
              },
              { merge: true }
              )
          );
        }
        await Promise.all(writes);
        response.status(200).json({
          ok: true,
          action: 'cancelled',
          renewalChangeId,
          message: 'Renewal change cancelled.',
        });
        return;
      }

      const targetPlanId = clean(stringValue(body?.targetPlanId));
      if (!isMonetizationPlanId(targetPlanId)) {
        response.status(400).json({ ok: false, error: 'plan_required' });
        return;
      }

      const entitlementSnapshot = await db
        .collection('users')
        .doc(userId)
        .collection('subscription_entitlements')
        .doc(workspaceId)
        .get();
      const currentPlanId = entitlementSnapshot.data()?.plan_id;
      if (!isMonetizationPlanId(currentPlanId)) {
        response.status(409).json({
          ok: false,
          error: 'active_plan_required',
          message: 'A confirmed paid plan is required before a renewal change can be queued.',
        });
        return;
      }

      const planChange = resolveMonetizationPlanChange(currentPlanId, targetPlanId);
      if (planChange.kind !== 'downgrade' && planChange.kind !== 'billing_change') {
        response.status(409).json({
          ok: false,
          error: planChange.reason ?? 'use_checkout',
          planChange: planChange.kind,
          message:
            planChange.kind === 'upgrade'
              ? 'Use checkout for upgrades.'
              : 'This renewal change is not available for the selected plan.',
        });
        return;
      }

      const activeChanges = await renewalCollection.where('status', '==', 'queued').limit(5).get();
      const existingActive = activeChanges.docs[0];
      const renewalChangeId = normalizeId(`renewal_${currentPlanId}_to_${targetPlanId}`);
      if (existingActive && existingActive.id !== renewalChangeId) {
        response.status(409).json({
          ok: false,
          error: 'active_renewal_change_exists',
          renewalChangeId: existingActive.id,
          message: 'Cancel the current renewal change before choosing a different one.',
        });
        return;
      }

      const applyAfter = clean(stringValue(body?.applyAfter)) ?? clean(stringValue(entitlementSnapshot.data()?.valid_until));
      const adminQueueId = normalizeId(`admin_${renewalChangeId}`);
      await Promise.all([
        renewalCollection.doc(renewalChangeId).set(
          buildSubscriptionRenewalChangeRecord({
            workspaceId,
            userId,
            currentPlanId,
            targetPlanId,
            changeKind: planChange.kind,
            applyAfter,
            adminQueueId,
          }),
          { merge: true }
        ),
        db
          .collection('workspaces')
          .doc(workspaceId)
          .collection('subscription_admin_queue')
          .doc(adminQueueId)
          .set(
            buildSubscriptionRenewalAdminQueueRecord({
              workspaceId,
              userId,
              renewalChangeId,
              currentPlanId,
              targetPlanId,
              changeKind: planChange.kind,
              applyAfter,
            }),
            { merge: true }
          ),
        db
          .collection('workspaces')
          .doc(workspaceId)
          .collection('subscription_renewal_audit')
          .doc(normalizeId(`renewal_audit_${renewalChangeId}_queued_${Date.now()}`))
          .set(
            buildSubscriptionRenewalAuditRecord({
              workspaceId,
              userId,
              renewalChangeId,
              adminQueueId,
              action: 'queued',
              status: 'queued',
              reviewStatus: 'needs_review',
              serverSyncStatus: 'queued',
              currentPlanId,
              targetPlanId,
              resolvedBy: userId,
              note: 'Renewal change queued by workspace owner.',
            }),
            { merge: true }
          ),
      ]);
      response.status(200).json({
        ok: true,
        action: 'queued',
        renewalChangeId,
        provider: 'manual_provider_pending',
        providerPortalStatus: 'pending_provider_connection',
        message: 'Renewal change queued. Current access stays active until renewal.',
      });
    } catch (error) {
      logger.error('manageSubscriptionRenewalChange failed', { workspaceId, action, error });
      response.status(500).json({ ok: false, error: 'renewal_change_failed' });
    }
  }
);

export const resolveSubscriptionRenewalChange = onRequest(
  {
    region: 'asia-south1',
    cors: true,
    maxInstances: 10,
    secrets: [monetizationWebhookSecret],
  },
  async (request, response) => {
    response.set('Cache-Control', 'no-store');
    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }
    if (request.method !== 'POST') {
      response.set('Allow', 'POST').status(405).json({ ok: false, error: 'method_not_allowed' });
      return;
    }
    if (!isAuthorizedMonetizationWebhook(request)) {
      response.status(401).json({ ok: false, error: 'unauthorized' });
      return;
    }

    const body = asRecord(request.body);
    const action = clean(stringValue(body?.action));
    const workspaceId = clean(stringValue(body?.workspaceId));
    const renewalChangeId = clean(stringValue(body?.renewalChangeId));
    const note = clean(stringValue(body?.note));
    const resolvedBy = clean(stringValue(body?.resolvedBy)) ?? 'admin';
    const providerReference = clean(stringValue(body?.providerReference));

    if (!workspaceId || !renewalChangeId || (action !== 'mark_processing' && action !== 'complete' && action !== 'reject')) {
      response.status(400).json({ ok: false, error: 'resolution_required' });
      return;
    }

    try {
      const now = new Date();
      const timestamp = now.toISOString();
      const workspaceRef = db.collection('workspaces').doc(workspaceId);
      const renewalRef = workspaceRef.collection('subscription_renewal_changes').doc(renewalChangeId);
      const auditId = normalizeId(`renewal_audit_${renewalChangeId}_${action}_${Date.now()}`);
      let responseAction = action;

      await db.runTransaction(async (transaction) => {
        const renewalSnapshot = await transaction.get(renewalRef);
        if (!renewalSnapshot.exists) {
          throw new Error('renewal_change_not_found');
        }

        const renewal = renewalSnapshot.data() ?? {};
        const currentStatus = clean(stringValue(renewal.status)) ?? 'queued';
        if (currentStatus === 'cancelled' || currentStatus === 'applied' || currentStatus === 'rejected') {
          throw new Error('renewal_change_finalized');
        }

        const userId = clean(stringValue(renewal.requested_by));
        const adminQueueId = clean(stringValue(renewal.admin_queue_id)) ?? normalizeId(`admin_${renewalChangeId}`);
        const currentPlanId = clean(stringValue(renewal.current_plan_id));
        const targetPlanId = clean(stringValue(renewal.target_plan_id));
        if (!userId || !isMonetizationPlanId(targetPlanId)) {
          throw new Error('renewal_change_invalid');
        }

        const normalizedCurrentPlanId = isMonetizationPlanId(currentPlanId) ? currentPlanId : null;
        const adminQueueRef = workspaceRef.collection('subscription_admin_queue').doc(adminQueueId);
        const auditRef = workspaceRef.collection('subscription_renewal_audit').doc(auditId);

        if (action === 'mark_processing') {
          transaction.set(
            renewalRef,
            {
              server_sync_status: 'processing',
              review_status: 'processing',
              processing_started_at: timestamp,
              processed_by: resolvedBy,
              provider_reference: providerReference ?? null,
              last_review_note: note ?? 'Renewal change is being processed.',
              updated_at: timestamp,
            },
            { merge: true }
          );
          transaction.set(
            adminQueueRef,
            {
              status: 'processing',
              review_status: 'processing',
              provider_sync_status: 'processing',
              processed_by: resolvedBy,
              provider_reference: providerReference ?? null,
              updated_at: timestamp,
              note: note ?? 'Renewal change is being processed.',
            },
            { merge: true }
          );
          transaction.set(
            auditRef,
            buildSubscriptionRenewalAuditRecord({
              workspaceId,
              userId,
              renewalChangeId,
              adminQueueId,
              action,
              status: currentStatus,
              reviewStatus: 'processing',
              serverSyncStatus: 'processing',
              currentPlanId: normalizedCurrentPlanId,
              targetPlanId,
              resolvedBy,
              providerReference,
              note: note ?? 'Renewal change is being processed.',
              now,
            }),
            { merge: true }
          );
          return;
        }

        if (action === 'reject') {
          transaction.set(
            renewalRef,
            {
              status: 'rejected',
              server_sync_status: 'rejected',
              review_status: 'rejected',
              rejected_by: resolvedBy,
              rejected_at: timestamp,
              provider_reference: providerReference ?? null,
              last_review_note: note ?? 'Renewal change rejected after review.',
              updated_at: timestamp,
            },
            { merge: true }
          );
          transaction.set(
            adminQueueRef,
            {
              status: 'rejected',
              review_status: 'rejected',
              provider_sync_status: 'rejected',
              rejected_by: resolvedBy,
              rejected_at: timestamp,
              provider_reference: providerReference ?? null,
              updated_at: timestamp,
              note: note ?? 'Renewal change rejected after review.',
            },
            { merge: true }
          );
          transaction.set(
            auditRef,
            buildSubscriptionRenewalAuditRecord({
              workspaceId,
              userId,
              renewalChangeId,
              adminQueueId,
              action,
              status: 'rejected',
              reviewStatus: 'rejected',
              serverSyncStatus: 'rejected',
              currentPlanId: normalizedCurrentPlanId,
              targetPlanId,
              resolvedBy,
              providerReference,
              note: note ?? 'Renewal change rejected after review.',
              now,
            }),
            { merge: true }
          );
          responseAction = 'reject';
          return;
        }

        const entitlementPayload: MonetizationWebhookPayload = {
          provider: 'manual_provider_pending',
          userId,
          workspaceId,
          checkoutIntentId: renewalChangeId,
          planId: targetPlanId,
          status: 'confirmed',
          transactionId: providerReference ?? `admin_${renewalChangeId}`,
          providerReference,
          paidAt: timestamp,
        };
        const entitlementRef = db.collection('users').doc(userId).collection('subscription_entitlements').doc(workspaceId);
        const entitlementAuditId = normalizeId(`renewal_applied_${renewalChangeId}`);
        const entitlementAuditRef = db
          .collection('users')
          .doc(userId)
          .collection('subscription_entitlement_audit')
          .doc(entitlementAuditId);

        transaction.set(
          entitlementRef,
          {
            ...buildSubscriptionEntitlementRecord(entitlementPayload, now),
            source: 'admin_renewal_resolution',
          },
          { merge: true }
        );
        transaction.set(
          entitlementAuditRef,
          {
            ...buildSubscriptionEntitlementAuditRecord(entitlementPayload, entitlementAuditId, now),
            action: 'renewal_change_applied',
            workspace_id: workspaceId,
            renewal_change_id: renewalChangeId,
            note: note ?? 'Renewal change completed after admin review.',
          },
          { merge: true }
        );
        transaction.set(
          renewalRef,
          {
            status: 'applied',
            server_sync_status: 'completed',
            review_status: 'completed',
            completed_by: resolvedBy,
            completed_at: timestamp,
            provider_reference: providerReference ?? null,
            last_review_note: note ?? 'Renewal change completed after admin review.',
            updated_at: timestamp,
          },
          { merge: true }
        );
        transaction.set(
          adminQueueRef,
          {
            status: 'completed',
            review_status: 'completed',
            provider_sync_status: 'completed',
            completed_by: resolvedBy,
            completed_at: timestamp,
            provider_reference: providerReference ?? null,
            updated_at: timestamp,
            note: note ?? 'Renewal change completed after admin review.',
          },
          { merge: true }
        );
        transaction.set(
          auditRef,
          buildSubscriptionRenewalAuditRecord({
            workspaceId,
            userId,
            renewalChangeId,
            adminQueueId,
            action,
            status: 'applied',
            reviewStatus: 'completed',
            serverSyncStatus: 'completed',
            currentPlanId: normalizedCurrentPlanId,
            targetPlanId,
            resolvedBy,
            providerReference,
            note: note ?? 'Renewal change completed after admin review.',
            now,
          }),
          { merge: true }
        );
        responseAction = 'complete';
      });

      response.status(200).json({
        ok: true,
        action: responseAction,
        renewalChangeId,
        message: 'Renewal change resolution recorded.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'resolution_failed';
      if (message === 'renewal_change_not_found') {
        response.status(404).json({ ok: false, error: message });
        return;
      }
      if (message === 'renewal_change_finalized') {
        response.status(409).json({ ok: false, error: message });
        return;
      }
      logger.error('resolveSubscriptionRenewalChange failed', { workspaceId, renewalChangeId, action, error });
      response.status(500).json({ ok: false, error: 'resolution_failed' });
    }
  }
);

export const reviewSubscriptionRenewalQueue = onSchedule(
  {
    region: 'asia-south1',
    schedule: 'every day 03:35',
    timeZone: 'Asia/Kolkata',
    maxInstances: 1,
  },
  async () => {
    const now = new Date().toISOString();
    const dueChanges = await db
      .collectionGroup('subscription_renewal_changes')
      .where('status', '==', 'queued')
      .where('apply_after', '<=', now)
      .limit(100)
      .get();

    for (const changeSnapshot of dueChanges.docs) {
      const workspaceRef = changeSnapshot.ref.parent.parent;
      if (!workspaceRef) {
        continue;
      }
      const workspaceId = workspaceRef.id;
      const change = changeSnapshot.data();
      const adminQueueId = clean(stringValue(change.admin_queue_id)) ?? normalizeId(`admin_${changeSnapshot.id}`);
      const userId = clean(stringValue(change.requested_by));
      const currentPlanId = clean(stringValue(change.current_plan_id));
      const targetPlanId = clean(stringValue(change.target_plan_id));
      await Promise.all([
        changeSnapshot.ref.set(
          {
            server_sync_status: 'ready_for_admin_review',
            review_status: 'ready_for_review',
            last_review_note: 'Renewal date reached. Review this change before provider processing.',
            reviewed_at: now,
            updated_at: now,
          },
          { merge: true }
        ),
        workspaceRef.collection('subscription_renewal_audit').doc(normalizeId(`renewal_audit_${changeSnapshot.id}_ready_${Date.now()}`)).set(
          buildSubscriptionRenewalAuditRecord({
            workspaceId,
            userId,
            renewalChangeId: changeSnapshot.id,
            adminQueueId,
            action: 'ready_for_review',
            status: 'queued',
            reviewStatus: 'ready_for_review',
            serverSyncStatus: 'ready_for_admin_review',
            currentPlanId: isMonetizationPlanId(currentPlanId) ? currentPlanId : null,
            targetPlanId: isMonetizationPlanId(targetPlanId) ? targetPlanId : null,
            note: 'Renewal date reached. Review this change before provider processing.',
            now: new Date(now),
          }),
          { merge: true }
        ),
        workspaceRef.collection('subscription_admin_queue').doc(adminQueueId).set(
          {
            queue_type: 'subscription_renewal_change',
            workspace_id: workspaceId,
            renewal_change_id: changeSnapshot.id,
            status: 'ready',
            review_status: 'ready_for_review',
            provider_sync_status: 'ready_for_admin_review',
            priority: 'normal',
            updated_at: now,
            note: 'Renewal date reached. Review this change before provider processing.',
          },
          { merge: true }
        ),
      ]);
    }
  }
);

export const processRecurringInvoices = onSchedule(
  {
    region: 'asia-south1',
    schedule: 'every day 02:15',
    timeZone: 'Asia/Kolkata',
    maxInstances: 1,
  },
  async () => {
    const today = new Date().toISOString().slice(0, 10);
    const dueRules = await db
      .collectionGroup('recurring_invoice_rules')
      .where('status', '==', 'active')
      .where('next_run_date', '<=', today)
      .limit(200)
      .get();

    for (const ruleSnapshot of dueRules.docs) {
      const workspaceRef = ruleSnapshot.ref.parent.parent;
      if (!workspaceRef) {
        continue;
      }
      const workspaceId = workspaceRef.id;
      const workspaceSnapshot = await workspaceRef.get();
      const workspaceName = clean(stringValue(workspaceSnapshot.data()?.business_name)) ?? 'Orbit Ledger';
      await processRecurringInvoiceRule(workspaceId, workspaceName, ruleSnapshot, today);
    }
  }
);

export const resolveOfficeAccessRequest = onRequest(
  {
    region: 'asia-south1',
    cors: true,
    maxInstances: 10,
  },
  async (request, response) => {
    response.set('Cache-Control', 'no-store');
    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }
    if (request.method !== 'POST') {
      response.set('Allow', 'POST').status(405).json({ ok: false, error: 'method_not_allowed' });
      return;
    }

    const adminUser = await verifyRequestUser(request);
    if (!adminUser || !isAuthorizedInternalAdminEmail(adminUser.email)) {
      response.status(403).json({ ok: false, error: 'internal_admin_required' });
      return;
    }

    const body = asRecord(request.body);
    const workspaceId = clean(stringValue(body?.workspaceId));
    const requestId = clean(stringValue(body?.requestId));
    const action = normalizeOfficeAccessReviewAction(clean(stringValue(body?.action)));
    const note = clean(stringValue(body?.note));

    if (!workspaceId || !requestId || !action) {
      response.status(400).json({ ok: false, error: 'office_review_required' });
      return;
    }

    try {
      const now = new Date();
      const timestamp = now.toISOString();
      const workspaceRef = db.collection('workspaces').doc(workspaceId);
      const requestRef = workspaceRef.collection('office_access_requests').doc(requestId);
      let nextStatus: OfficeAccessRequestStatus = 'needs_review';
      let adminMessage = 'Office access request updated.';
      let grantedEntitlement = false;

      await db.runTransaction(async (transaction) => {
        const [workspaceSnapshot, requestSnapshot] = await Promise.all([
          transaction.get(workspaceRef),
          transaction.get(requestRef),
        ]);

        if (!workspaceSnapshot.exists) {
          throw new Error('workspace_not_found');
        }
        if (!requestSnapshot.exists) {
          throw new Error('office_request_not_found');
        }

        const requestRecord = requestSnapshot.data() ?? {};
        const currentStatus = normalizeOfficeAccessRequestStatus(clean(stringValue(requestRecord.status)));
        const plan = resolveOfficeAccessReviewPlan({ action, currentStatus });
        if (!plan.canApply) {
          throw new Error(plan.message);
        }

        const requesterUid = clean(stringValue(requestRecord.requester_uid)) ?? clean(stringValue(requestRecord.requesterUid));
        const requesterEmail = clean(stringValue(requestRecord.requester_email)) ?? clean(stringValue(requestRecord.requesterEmail));
        const requesterName =
          clean(stringValue(requestRecord.requester_name)) ??
          clean(stringValue(requestRecord.requesterName)) ??
          requesterEmail ??
          'Office owner';
        const requestedPlanId = normalizeOfficeRequestedPlanId(
          clean(stringValue(requestRecord.requested_plan_id)) ?? clean(stringValue(requestRecord.requestedPlanId))
        );
        const adminQueueId =
          clean(stringValue(requestRecord.admin_queue_id)) ??
          clean(stringValue(requestRecord.adminQueueId)) ??
          normalizeId(`office_admin_${requestId}`);

        if (!requesterUid || !requesterEmail) {
          throw new Error('office_request_invalid');
        }

        nextStatus = plan.nextStatus;
        adminMessage = plan.message;
        grantedEntitlement = plan.shouldGrantEntitlement;

        const requestPatch = {
          status: nextStatus,
          reviewed_by: action === 'mark_reviewing' || action === 'approve' ? adminUser.uid : clean(stringValue(requestRecord.reviewed_by)),
          reviewed_at: action === 'mark_reviewing' || action === 'approve' ? timestamp : clean(stringValue(requestRecord.reviewed_at)),
          granted_by: action === 'grant_access' ? adminUser.uid : clean(stringValue(requestRecord.granted_by)),
          granted_at: action === 'grant_access' ? timestamp : clean(stringValue(requestRecord.granted_at)),
          rejected_by: action === 'reject' ? adminUser.uid : clean(stringValue(requestRecord.rejected_by)),
          rejected_at: action === 'reject' ? timestamp : clean(stringValue(requestRecord.rejected_at)),
          last_review_note: note ?? null,
          updated_at: timestamp,
        };
        const queueRef = workspaceRef.collection('office_access_admin_queue').doc(adminQueueId);
        const auditRef = workspaceRef
          .collection('office_access_audit')
          .doc(normalizeId(`office_access_${requestId}_${action}_${Date.now()}`));

        transaction.set(requestRef, requestPatch, { merge: true });
        transaction.set(
          queueRef,
          {
            ...buildOfficeAccessRequestAdminQueueRecord({
              workspaceId,
              requestId,
              requesterUid,
              requesterName,
              requesterEmail,
              businessName:
                clean(stringValue(requestRecord.business_name)) ??
                clean(stringValue(requestRecord.businessName)) ??
                clean(stringValue(workspaceSnapshot.data()?.business_name)),
              requestedPlanId,
              status: nextStatus,
              note,
              now,
            }),
            id: adminQueueId,
            updated_at: timestamp,
          },
          { merge: true }
        );
        transaction.set(
          auditRef,
          buildOfficeAccessRequestAuditRecord({
            workspaceId,
            requestId,
            adminQueueId,
            actorUid: adminUser.uid,
            action,
            targetUid: requesterUid,
            targetEmail: requesterEmail,
            previousStatus: currentStatus,
            nextStatus,
            note,
            now,
          }),
          { merge: true }
        );

        if (plan.shouldGrantEntitlement) {
          const entitlementPayload: MonetizationWebhookPayload = {
            provider: 'manual_provider_pending',
            userId: requesterUid,
            workspaceId,
            checkoutIntentId: requestId,
            planId: requestedPlanId,
            status: 'confirmed',
            transactionId: `office_grant_${requestId}`,
            providerReference: `office_grant_${requestId}`,
            paidAt: timestamp,
          };
          const entitlementRef = db.collection('users').doc(requesterUid).collection('subscription_entitlements').doc(workspaceId);
          const entitlementAuditRef = db
            .collection('users')
            .doc(requesterUid)
            .collection('subscription_entitlement_audit')
            .doc(normalizeId(`office_grant_${requestId}`));
          const memberRef = workspaceRef.collection('office_members').doc(requesterUid);

          transaction.set(
            entitlementRef,
            {
              ...buildSubscriptionEntitlementRecord(entitlementPayload, now),
              source: 'office_invitation_admin_grant',
            },
            { merge: true }
          );
          transaction.set(
            entitlementAuditRef,
            {
              ...buildSubscriptionEntitlementAuditRecord(entitlementPayload, normalizeId(`office_grant_${requestId}`), now),
              action: 'office_access_granted',
              workspace_id: workspaceId,
              office_access_request_id: requestId,
              note: note ?? 'Office access granted after internal review.',
            },
            { merge: true }
          );
          transaction.set(
            memberRef,
            buildOfficeOwnerMemberRecord({
              workspaceId,
              ownerUid: requesterUid,
              ownerEmail: requesterEmail,
              ownerName: requesterName,
              invitedBy: adminUser.uid,
              now,
            }),
            { merge: true }
          );
        }
      });

      response.status(200).json({
        ok: true,
        action,
        requestId,
        status: nextStatus,
        grantedEntitlement,
        message: adminMessage,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'office_review_failed';
      if (message === 'workspace_not_found' || message === 'office_request_not_found') {
        response.status(404).json({ ok: false, error: message });
        return;
      }
      if (message === 'office_request_invalid' || message === 'Approve the Office request before granting access.') {
        response.status(409).json({ ok: false, error: 'office_request_not_ready', message });
        return;
      }
      if (message === 'Office access request is already finalized.') {
        response.status(409).json({ ok: false, error: 'office_request_finalized', message });
        return;
      }
      logger.error('resolveOfficeAccessRequest failed', { workspaceId, requestId, action, error });
      response.status(500).json({ ok: false, error: 'office_review_failed' });
    }
  }
);

export const recordOfficeSupportReview = onRequest(
  {
    region: 'asia-south1',
    cors: true,
    maxInstances: 10,
  },
  async (request, response) => {
    response.set('Cache-Control', 'no-store');
    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }
    if (request.method !== 'POST') {
      response.set('Allow', 'POST').status(405).json({ ok: false, error: 'method_not_allowed' });
      return;
    }

    const adminUser = await verifyRequestUser(request);
    if (!adminUser || !isAuthorizedInternalAdminEmail(adminUser.email)) {
      response.status(403).json({ ok: false, error: 'internal_admin_required' });
      return;
    }

    const body = asRecord(request.body);
    const workspaceId = clean(stringValue(body?.workspaceId));
    const reason = clean(stringValue(body?.reason));
    const supportCaseId = clean(stringValue(body?.supportCaseId));
    const customerApprovedDiagnosticAccess = body?.customerApprovedDiagnosticAccess === true;

    if (!workspaceId || !reason) {
      response.status(400).json({ ok: false, error: 'support_review_required' });
      return;
    }

    try {
      const workspaceRef = db.collection('workspaces').doc(workspaceId);
      const workspaceSnapshot = await workspaceRef.get();
      if (!workspaceSnapshot.exists) {
        response.status(404).json({ ok: false, error: 'workspace_not_found' });
        return;
      }

      const now = new Date();
      const auditRef = workspaceRef
        .collection('office_access_audit')
        .doc(normalizeId(`support_review_${adminUser.uid}_${Date.now()}`));

      await auditRef.set(buildOfficeSupportReviewAuditRecord({
        workspaceId,
        actorUid: adminUser.uid,
        actorEmail: adminUser.email,
        reason,
        supportCaseId,
        customerApprovedDiagnosticAccess,
        now,
      }));

      response.status(200).json({
        ok: true,
        reviewId: auditRef.id,
        message: customerApprovedDiagnosticAccess
          ? 'Support review recorded with approved diagnostic context.'
          : 'Support review recorded without customer data access.',
      });
    } catch (error) {
      logger.error('recordOfficeSupportReview failed', { workspaceId, supportCaseId, error });
      response.status(500).json({ ok: false, error: 'support_review_failed' });
    }
  }
);

export const recordSupportCaseAdminAction = onRequest(
  {
    region: 'asia-south1',
    cors: true,
    maxInstances: 10,
  },
  async (request, response) => {
    response.set('Cache-Control', 'no-store');
    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }
    if (request.method !== 'POST') {
      response.set('Allow', 'POST').status(405).json({ ok: false, error: 'method_not_allowed' });
      return;
    }

    const adminUser = await verifyRequestUser(request);
    if (!adminUser || !isAuthorizedInternalAdminEmail(adminUser.email)) {
      response.status(403).json({ ok: false, error: 'internal_admin_required' });
      return;
    }

    const body = asRecord(request.body);
    const workspaceId = clean(stringValue(body?.workspaceId));
    const supportCaseId = clean(stringValue(body?.supportCaseId));
    const action = normalizeSupportCaseAction(clean(stringValue(body?.action)));
    const note = clean(stringValue(body?.note));

    if (!workspaceId || !supportCaseId || !note) {
      response.status(400).json({ ok: false, error: 'support_case_update_required' });
      return;
    }

    try {
      const workspaceRef = db.collection('workspaces').doc(workspaceId);
      const caseRef = workspaceRef.collection('support_cases').doc(normalizeId(supportCaseId));
      const now = new Date();
      const auditRef = workspaceRef
        .collection('office_access_audit')
        .doc(normalizeId(`support_case_${action}_${supportCaseId}_${adminUser.uid}_${Date.now()}`));
      let nextStatus: SupportCaseStatus = 'open';

      await db.runTransaction(async (transaction) => {
        const [workspaceSnapshot, caseSnapshot] = await Promise.all([
          transaction.get(workspaceRef),
          transaction.get(caseRef),
        ]);
        if (!workspaceSnapshot.exists) {
          throw new Error('workspace_not_found');
        }

        const currentCase = caseSnapshot.exists ? caseSnapshot.data() ?? {} : {};
        const previousStatus = normalizeSupportCaseStatus(clean(stringValue(currentCase.status)));
        nextStatus = supportCaseStatusForAction(action);
        const latestNote = note.slice(0, 500);

        transaction.set(
          caseRef,
          buildSupportCaseRecord({
            workspaceId,
            supportCaseId,
            action,
            status: nextStatus,
            previousStatus,
            note: latestNote,
            actorUid: adminUser.uid,
            actorEmail: adminUser.email,
            noteCount: numberValue(currentCase.note_count),
            createdAt: clean(stringValue(currentCase.created_at)),
            now,
          }),
          { merge: true }
        );
        transaction.set(auditRef, {
          version: 1,
          workspace_id: workspaceId,
          actor_uid: adminUser.uid,
          actor_email: clean(adminUser.email),
          actor_role: 'internal_support_reviewer',
          action: 'internal_access_reviewed',
          target_uid: null,
          target_email: null,
          previous_role: null,
          next_role: null,
          previous_status: previousStatus,
          next_status: nextStatus,
          support_consent_id: null,
          support_case_id: supportCaseId,
          customer_approved_diagnostic_access: false,
          impersonation_allowed: false,
          reason: supportCaseAuditReason(action, latestNote),
          created_at: now.toISOString(),
        });
      });

      response.status(200).json({
        ok: true,
        supportCaseId,
        caseRecordId: caseRef.id,
        status: nextStatus,
        auditId: auditRef.id,
        message: supportCaseMessageForStatus(nextStatus, action),
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'workspace_not_found') {
        response.status(404).json({ ok: false, error: 'workspace_not_found' });
        return;
      }
      logger.error('recordSupportCaseAdminAction failed', { workspaceId, supportCaseId, action, error });
      response.status(500).json({ ok: false, error: 'support_case_update_failed' });
    }
  }
);

export const queueSupportCaseFollowUpEmail = onRequest(
  {
    region: 'asia-south1',
    cors: true,
    maxInstances: 10,
    secrets: [resendApiKey],
  },
  async (request, response) => {
    response.set('Cache-Control', 'no-store');
    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }
    if (request.method !== 'POST') {
      response.set('Allow', 'POST').status(405).json({ ok: false, error: 'method_not_allowed' });
      return;
    }

    const adminUser = await verifyRequestUser(request);
    if (!adminUser || !isAuthorizedInternalAdminEmail(adminUser.email)) {
      response.status(403).json({ ok: false, error: 'internal_admin_required' });
      return;
    }

    const body = asRecord(request.body);
    const workspaceId = clean(stringValue(body?.workspaceId));
    const supportCaseId = clean(stringValue(body?.supportCaseId));
    const recipientEmail = clean(stringValue(body?.recipientEmail));
    const subject = clean(stringValue(body?.subject));
    const emailBody = clean(stringValue(body?.body));

    if (!workspaceId || !supportCaseId || !recipientEmail || !subject || !emailBody || !isValidEmailAddress(recipientEmail)) {
      response.status(400).json({ ok: false, error: 'support_case_email_required' });
      return;
    }

    try {
      const workspaceRef = db.collection('workspaces').doc(workspaceId);
      const workspaceSnapshot = await workspaceRef.get();
      if (!workspaceSnapshot.exists) {
        response.status(404).json({ ok: false, error: 'workspace_not_found' });
        return;
      }

      const now = new Date();
      const emailRef = workspaceRef
        .collection('support_case_email_requests')
        .doc(normalizeId(`support_case_email_${supportCaseId}_${adminUser.uid}_${Date.now()}`));
      const auditRef = workspaceRef
        .collection('office_access_audit')
        .doc(normalizeId(`support_case_email_${supportCaseId}_${adminUser.uid}_${Date.now()}`));

      const emailRequestRecord = buildSupportCaseEmailRequestRecord({
        workspaceId,
        supportCaseId,
        recipientEmail,
        subject,
        body: emailBody,
        queuedBy: adminUser.uid,
        queuedByEmail: adminUser.email,
        now,
      });
      const delivery = await deliverSupportCaseEmailRequest(emailRequestRecord);
      const emailDeliveryUpdate = buildSupportCaseEmailDeliveryUpdate({
        status: delivery.status,
        providerMessageId: delivery.providerMessageId,
        sentAt: delivery.sentAt,
        failureReason: delivery.failureReason,
        now,
      });

      await db.runTransaction(async (transaction) => {
        transaction.set(emailRef, { ...emailRequestRecord, ...emailDeliveryUpdate });
        transaction.set(auditRef, {
          version: 1,
          workspace_id: workspaceId,
          actor_uid: adminUser.uid,
          actor_email: clean(adminUser.email),
          actor_role: 'internal_support_reviewer',
          action: 'internal_access_reviewed',
          target_uid: null,
          target_email: recipientEmail,
          previous_role: null,
          next_role: null,
          previous_status: null,
          next_status: null,
          support_consent_id: null,
          support_case_id: supportCaseId,
          customer_approved_diagnostic_access: false,
          impersonation_allowed: false,
          reason:
            delivery.status === 'sent'
              ? 'Support case follow-up email sent.'
              : delivery.status === 'pending_provider_connection'
                ? 'Support case follow-up email is ready; email delivery is not connected yet.'
                : 'Support case follow-up email could not be sent.',
          created_at: now.toISOString(),
        });
      });

      response.status(200).json({
        ok: true,
        requestId: emailRef.id,
        deliveryStatus: delivery.status,
        sentAt: delivery.sentAt,
        message:
          delivery.status === 'sent'
            ? 'Support follow-up email sent.'
            : delivery.status === 'pending_provider_connection'
              ? 'Support follow-up email is ready. Email delivery is not connected yet.'
              : 'Support follow-up email could not be sent.',
      });
    } catch (error) {
      logger.error('queueSupportCaseFollowUpEmail failed', { workspaceId, supportCaseId, error });
      response.status(500).json({ ok: false, error: 'support_case_email_failed' });
    }
  }
);

export const createSupportDiagnosticConsent = onRequest(
  {
    region: 'asia-south1',
    cors: true,
    maxInstances: 20,
  },
  async (request, response) => {
    response.set('Cache-Control', 'no-store');
    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }
    if (request.method !== 'POST') {
      response.set('Allow', 'POST').status(405).json({ ok: false, error: 'method_not_allowed' });
      return;
    }

    const user = await verifyRequestUser(request);
    if (!user?.uid) {
      response.status(401).json({ ok: false, error: 'sign_in_required' });
      return;
    }

    const body = asRecord(request.body);
    const workspaceId = clean(stringValue(body?.workspaceId));
    const supportKind = clean(stringValue(body?.supportKind));
    const supportCaseId = clean(stringValue(body?.supportCaseId));
    const sanitizedMessage = clean(stringValue(body?.sanitizedMessage));
    const safeFields = asRecord(body?.safeFields);
    const redactedFields = Array.isArray(body?.redactedFields) ? body.redactedFields : [];
    const privateDataWarnings = Array.isArray(body?.privateDataWarnings) ? body.privateDataWarnings : [];

    if (!workspaceId || !sanitizedMessage || !safeFields) {
      response.status(400).json({ ok: false, error: 'support_consent_required' });
      return;
    }

    try {
      const workspaceRef = db.collection('workspaces').doc(workspaceId);
      const workspaceSnapshot = await workspaceRef.get();
      if (!workspaceSnapshot.exists) {
        response.status(404).json({ ok: false, error: 'workspace_not_found' });
        return;
      }

      const workspace = workspaceSnapshot.data() ?? {};
      const memberSnapshot = await workspaceRef.collection('office_members').doc(user.uid).get();
      const member = memberSnapshot.exists ? memberSnapshot.data() ?? {} : null;
      const ownsWorkspace = clean(stringValue(workspace.owner_uid)) === user.uid;
      const isOfficeApprover =
        clean(stringValue(member?.status)) === 'active' &&
        (clean(stringValue(member?.role)) === 'owner' || clean(stringValue(member?.role)) === 'admin');

      if (!ownsWorkspace && !isOfficeApprover) {
        response.status(403).json({ ok: false, error: 'support_consent_forbidden' });
        return;
      }

      const now = new Date();
      const consentRef = workspaceRef
        .collection('support_diagnostic_consents')
        .doc(normalizeId(`support_consent_${user.uid}_${Date.now()}`));
      const auditRef = workspaceRef
        .collection('office_access_audit')
        .doc(normalizeId(`support_consent_${user.uid}_${Date.now()}`));
      const consentRecord = buildSupportDiagnosticConsentRecord({
        workspaceId,
        userId: user.uid,
        userEmail: user.email,
        supportKind,
        supportCaseId,
        sanitizedMessage,
        safeFields,
        redactedFields,
        privateDataWarnings,
        now,
      });

      await db.runTransaction(async (transaction) => {
        transaction.set(consentRef, consentRecord);
        transaction.set(auditRef, {
          version: 1,
          workspace_id: workspaceId,
          actor_uid: user.uid,
          actor_email: clean(user.email),
          actor_role: ownsWorkspace ? 'owner' : clean(stringValue(member?.role)),
          action: 'internal_access_reviewed',
          target_uid: null,
          target_email: null,
          previous_role: null,
          next_role: null,
          previous_status: null,
          next_status: null,
          support_consent_id: consentRef.id,
          support_case_id: consentRecord.support_case_id,
          customer_approved_diagnostic_access: true,
          impersonation_allowed: false,
          reason: 'Customer approved a safe diagnostic review pack. Impersonation remains blocked.',
          created_at: now.toISOString(),
        });
      });

      response.status(200).json({
        ok: true,
        consentId: consentRef.id,
        expiresAt: consentRecord.expires_at,
        message: 'Support review approval saved.',
      });
    } catch (error) {
      logger.error('createSupportDiagnosticConsent failed', { workspaceId, error });
      response.status(500).json({ ok: false, error: 'support_consent_failed' });
    }
  }
);

export const revokeSupportDiagnosticConsent = onRequest(
  {
    region: 'asia-south1',
    cors: true,
    maxInstances: 20,
  },
  async (request, response) => {
    response.set('Cache-Control', 'no-store');
    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }
    if (request.method !== 'POST') {
      response.set('Allow', 'POST').status(405).json({ ok: false, error: 'method_not_allowed' });
      return;
    }

    const user = await verifyRequestUser(request);
    if (!user?.uid) {
      response.status(401).json({ ok: false, error: 'sign_in_required' });
      return;
    }

    const body = asRecord(request.body);
    const workspaceId = clean(stringValue(body?.workspaceId));
    const consentId = clean(stringValue(body?.consentId));
    const reason = clean(stringValue(body?.reason));

    if (!workspaceId || !consentId) {
      response.status(400).json({ ok: false, error: 'support_consent_revoke_required' });
      return;
    }

    try {
      const workspaceRef = db.collection('workspaces').doc(workspaceId);
      const consentRef = workspaceRef.collection('support_diagnostic_consents').doc(consentId);
      const now = new Date();
      const nextStatus = { value: 'active' as SupportConsentStatus };

      await db.runTransaction(async (transaction) => {
        const [workspaceSnapshot, consentSnapshot, memberSnapshot] = await Promise.all([
          transaction.get(workspaceRef),
          transaction.get(consentRef),
          transaction.get(workspaceRef.collection('office_members').doc(user.uid)),
        ]);

        if (!workspaceSnapshot.exists) {
          throw new Error('workspace_not_found');
        }
        if (!consentSnapshot.exists) {
          throw new Error('support_consent_not_found');
        }

        const workspace = workspaceSnapshot.data() ?? {};
        const consent = consentSnapshot.data() ?? {};
        const member = memberSnapshot.exists ? memberSnapshot.data() ?? {} : null;
        const ownsWorkspace = clean(stringValue(workspace.owner_uid)) === user.uid;
        const isOfficeAdmin =
          clean(stringValue(member?.status)) === 'active' &&
          (clean(stringValue(member?.role)) === 'owner' || clean(stringValue(member?.role)) === 'admin');
        const createdByUser = clean(stringValue(consent.user_id)) === user.uid;

        if (!ownsWorkspace && !isOfficeAdmin && !createdByUser) {
          throw new Error('support_consent_forbidden');
        }

        const currentStatus = normalizeSupportConsentStatus(clean(stringValue(consent.status)));
        if (currentStatus !== 'active') {
          nextStatus.value = currentStatus;
          return;
        }

        const expiresAt = clean(stringValue(consent.expires_at));
        nextStatus.value = expiresAt && Date.parse(expiresAt) <= now.getTime() ? 'expired' : 'revoked';
        transaction.set(
          consentRef,
          buildSupportDiagnosticConsentStatusUpdate({
            status: nextStatus.value,
            actorUid: user.uid,
            reason: reason ?? (nextStatus.value === 'expired' ? 'Support review approval expired before revocation.' : 'Support review approval revoked by user.'),
            now,
          }),
          { merge: true }
        );
        transaction.set(
          workspaceRef.collection('office_access_audit').doc(normalizeId(`support_consent_${nextStatus.value}_${consentId}_${Date.now()}`)),
          {
            version: 1,
            workspace_id: workspaceId,
            actor_uid: user.uid,
            actor_email: clean(user.email),
            actor_role: ownsWorkspace ? 'owner' : createdByUser ? 'support_consent_owner' : clean(stringValue(member?.role)),
            action: 'internal_access_reviewed',
            target_uid: null,
            target_email: null,
            previous_role: null,
            next_role: null,
            previous_status: 'active',
            next_status: nextStatus.value,
            support_consent_id: consentId,
            support_case_id: clean(stringValue(consent.support_case_id)),
            customer_approved_diagnostic_access: false,
            impersonation_allowed: false,
            reason: nextStatus.value === 'expired'
              ? 'Support diagnostic approval expired. Internal support review access is no longer active.'
              : 'Support diagnostic approval revoked. Internal support review access is no longer active.',
            created_at: now.toISOString(),
          }
        );
      });

      response.status(200).json({
        ok: true,
        consentId,
        status: nextStatus.value,
        message: nextStatus.value === 'expired' ? 'Support review approval has expired.' : 'Support review approval revoked.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'support_consent_revoke_failed';
      if (message === 'workspace_not_found' || message === 'support_consent_not_found') {
        response.status(404).json({ ok: false, error: message });
        return;
      }
      if (message === 'support_consent_forbidden') {
        response.status(403).json({ ok: false, error: message });
        return;
      }
      logger.error('revokeSupportDiagnosticConsent failed', { workspaceId, consentId, error });
      response.status(500).json({ ok: false, error: 'support_consent_revoke_failed' });
    }
  }
);

export const expireSupportDiagnosticConsents = onSchedule(
  {
    region: 'asia-south1',
    schedule: 'every 6 hours',
    timeZone: 'Asia/Kolkata',
  },
  async () => {
    const now = new Date();
    const snapshots = await db.collectionGroup('support_diagnostic_consents')
      .where('status', '==', 'active')
      .where('expires_at', '<=', now.toISOString())
      .limit(100)
      .get();

    if (snapshots.empty) {
      return;
    }

    const batch = db.batch();
    snapshots.docs.forEach((snapshot) => {
      const consent = snapshot.data() ?? {};
      const workspaceRef = snapshot.ref.parent.parent;
      if (!workspaceRef) {
        return;
      }
      const workspaceId = clean(stringValue(consent.workspace_id)) ?? workspaceRef.id;
      batch.set(
        snapshot.ref,
        buildSupportDiagnosticConsentStatusUpdate({
          status: 'expired',
          actorUid: 'system',
          reason: 'Support review approval expired automatically.',
          now,
        }),
        { merge: true }
      );
      batch.set(
        workspaceRef.collection('office_access_audit').doc(normalizeId(`support_consent_expired_${snapshot.id}_${Date.now()}`)),
        {
          version: 1,
          workspace_id: workspaceId,
          actor_uid: 'system',
          actor_email: null,
          actor_role: 'internal_support_reviewer',
          action: 'internal_access_reviewed',
          target_uid: null,
          target_email: null,
          previous_role: null,
          next_role: null,
          previous_status: 'active',
          next_status: 'expired',
          support_consent_id: snapshot.id,
          support_case_id: clean(stringValue(consent.support_case_id)),
          customer_approved_diagnostic_access: false,
          impersonation_allowed: false,
          reason: 'Support diagnostic approval expired automatically.',
          created_at: now.toISOString(),
        }
      );
    });

    await batch.commit();
  }
);

export const acceptOfficeInvitation = onRequest(
  {
    region: 'asia-south1',
    cors: true,
    maxInstances: 20,
  },
  async (request, response) => {
    response.set('Cache-Control', 'no-store');
    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }
    if (request.method !== 'POST') {
      response.set('Allow', 'POST').status(405).json({ ok: false, error: 'method_not_allowed' });
      return;
    }

    const user = await verifyRequestUser(request);
    if (!user?.uid || !user.email) {
      response.status(401).json({ ok: false, error: 'sign_in_required' });
      return;
    }

    const body = asRecord(request.body);
    const workspaceId = clean(stringValue(body?.workspaceId));
    const invitationId = clean(stringValue(body?.invitationId));

    if (!workspaceId || !invitationId) {
      response.status(400).json({ ok: false, error: 'invitation_required' });
      return;
    }

    try {
      const now = new Date();
      const timestamp = now.toISOString();
      const normalizedEmail = user.email.trim().toLowerCase();
      const workspaceRef = db.collection('workspaces').doc(workspaceId);
      const invitationRef = workspaceRef.collection('office_invitations').doc(invitationId);
      const memberRef = workspaceRef.collection('office_members').doc(user.uid);
      let role: 'admin' | 'manager' | 'staff' | 'accountant' | 'viewer' = 'viewer';
      let message = 'Office invitation accepted.';

      await db.runTransaction(async (transaction) => {
        const [workspaceSnapshot, invitationSnapshot, memberSnapshot] = await Promise.all([
          transaction.get(workspaceRef),
          transaction.get(invitationRef),
          transaction.get(memberRef),
        ]);

        if (!workspaceSnapshot.exists) {
          throw new Error('workspace_not_found');
        }
        if (!invitationSnapshot.exists) {
          throw new Error('invitation_not_found');
        }

        const invitation = invitationSnapshot.data() ?? {};
        const invitationEmail = clean(stringValue(invitation.email))?.toLowerCase();
        const invitationStatus = clean(stringValue(invitation.status)) ?? 'pending';
        const invitationRole = normalizeAssignableOfficeRole(clean(stringValue(invitation.role)));
        const invitedBy = clean(stringValue(invitation.invited_by)) ?? clean(stringValue(invitation.invitedBy)) ?? '';

        if (!invitationEmail || invitationEmail !== normalizedEmail) {
          throw new Error('invitation_email_mismatch');
        }
        if (!invitationRole) {
          throw new Error('invitation_invalid_role');
        }
        role = invitationRole;

        if (invitationStatus === 'accepted' && clean(stringValue(invitation.accepted_by)) === user.uid) {
          if (!memberSnapshot.exists || memberSnapshot.data()?.status !== 'active') {
            transaction.set(
              memberRef,
              buildOfficeInvitedMemberRecord({
                workspaceId,
                memberUid: user.uid,
                memberEmail: normalizedEmail,
                memberName: clean(stringValue(body?.displayName)),
                role,
                invitedBy,
                invitedAt: clean(stringValue(invitation.created_at)),
                now,
              }),
              { merge: true }
            );
          }
          message = 'Office invitation was already accepted.';
          return;
        }

        if (invitationStatus !== 'pending') {
          throw new Error(`invitation_${invitationStatus}`);
        }

        const expiresAt = clean(stringValue(invitation.expires_at));
        if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
          transaction.set(invitationRef, {
            status: 'expired',
            updated_at: timestamp,
          }, { merge: true });
          throw new Error('invitation_expired');
        }

        transaction.set(
          memberRef,
          buildOfficeInvitedMemberRecord({
            workspaceId,
            memberUid: user.uid,
            memberEmail: normalizedEmail,
            memberName: clean(stringValue(body?.displayName)),
            role,
            invitedBy,
            invitedAt: clean(stringValue(invitation.created_at)),
            now,
          }),
          { merge: true }
        );
        transaction.set(
          invitationRef,
          {
            status: 'accepted',
            accepted_by: user.uid,
            accepted_at: timestamp,
            updated_at: timestamp,
          },
          { merge: true }
        );
        transaction.set(
          workspaceRef.collection('office_access_audit').doc(normalizeId(`office_invite_accept_${invitationId}_${user.uid}`)),
          buildOfficeInvitationAcceptanceAuditRecord({
            workspaceId,
            invitationId,
            actorUid: user.uid,
            actorEmail: normalizedEmail,
            invitedBy,
            role,
            now,
          }),
          { merge: true }
        );
      });

      response.status(200).json({
        ok: true,
        workspaceId,
        invitationId,
        role,
        message,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'invitation_accept_failed';
      if (message === 'workspace_not_found' || message === 'invitation_not_found') {
        response.status(404).json({ ok: false, error: message });
        return;
      }
      if (message === 'invitation_email_mismatch') {
        response.status(403).json({
          ok: false,
          error: 'invitation_email_mismatch',
          message: 'Sign in with the email address that received this invitation.',
        });
        return;
      }
      if (message === 'invitation_invalid_role') {
        response.status(409).json({ ok: false, error: message });
        return;
      }
      if (message.startsWith('invitation_')) {
        response.status(409).json({ ok: false, error: message });
        return;
      }
      logger.error('acceptOfficeInvitation failed', { workspaceId, invitationId, error });
      response.status(500).json({ ok: false, error: 'invitation_accept_failed' });
    }
  }
);

export const createOfficeInvitation = onRequest(
  {
    region: 'asia-south1',
    cors: true,
    maxInstances: 20,
  },
  async (request, response) => {
    response.set('Cache-Control', 'no-store');
    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }
    if (request.method !== 'POST') {
      response.set('Allow', 'POST').status(405).json({ ok: false, error: 'method_not_allowed' });
      return;
    }

    const actor = await verifyRequestUser(request);
    if (!actor?.uid) {
      response.status(401).json({ ok: false, error: 'sign_in_required' });
      return;
    }

    const body = asRecord(request.body);
    const workspaceId = clean(stringValue(body?.workspaceId));
    const email = clean(stringValue(body?.email))?.toLowerCase();
    const role = normalizeAssignableOfficeRole(clean(stringValue(body?.role)));
    const message = clean(stringValue(body?.message));
    const actorName = clean(stringValue(body?.actorName));

    if (!workspaceId || !email || !role || !isValidEmailAddress(email)) {
      response.status(400).json({ ok: false, error: 'invitation_create_required' });
      return;
    }

    try {
      const now = new Date();
      const workspaceRef = db.collection('workspaces').doc(workspaceId);
      const invitationRef = workspaceRef.collection('office_invitations').doc();
      const auditRef = workspaceRef
        .collection('office_access_audit')
        .doc(normalizeId(`office_invite_create_${invitationRef.id}_${actor.uid}_${Date.now()}`));
      let actorRole: 'owner' | 'admin' = 'owner';

      await db.runTransaction(async (transaction) => {
        const [workspaceSnapshot, memberSnapshot, membersSnapshot, invitationsSnapshot] = await Promise.all([
          transaction.get(workspaceRef),
          transaction.get(workspaceRef.collection('office_members').doc(actor.uid)),
          transaction.get(workspaceRef.collection('office_members')),
          transaction.get(workspaceRef.collection('office_invitations')),
        ]);

        if (!workspaceSnapshot.exists) {
          throw new Error('workspace_not_found');
        }

        const workspace = workspaceSnapshot.data() ?? {};
        const authorization = getOfficeInvitationActionAuthorization({
          actorUid: actor.uid,
          workspace,
          member: memberSnapshot.data(),
          targetRole: role,
        });
        if (!authorization.allowed || !authorization.role) {
          throw new Error('team_admin_required');
        }
        actorRole = authorization.role;

        const capacity = getOfficeInvitationCapacityDecisionFromDocs({
          members: membersSnapshot.docs.map((entry) => entry.data()),
          invitations: invitationsSnapshot.docs.map((entry) => entry.data()),
          targetEmail: email,
        });
        if (!capacity.allowed) {
          throw new Error(capacity.reason);
        }

        transaction.set(invitationRef, buildOfficeInvitationRecord({
          workspaceId,
          email,
          role,
          invitedBy: actor.uid,
          invitedByName: actorName ?? actor.email,
          message,
          now,
        }));
        transaction.set(auditRef, buildOfficeInvitationCreatedAuditRecord({
          workspaceId,
          invitationId: invitationRef.id,
          actorUid: actor.uid,
          actorRole,
          targetEmail: email,
          role,
          now,
        }));
      });

      response.status(200).json({
        ok: true,
        workspaceId,
        invitationId: invitationRef.id,
        message: 'Team invitation created.',
      });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'invitation_create_failed';
      if (messageText === 'workspace_not_found') {
        response.status(404).json({ ok: false, error: messageText });
        return;
      }
      if (messageText === 'team_admin_required') {
        response.status(403).json({ ok: false, error: messageText });
        return;
      }
      if (
        messageText === 'seat_limit_reached' ||
        messageText === 'existing_member' ||
        messageText === 'pending_invitation'
      ) {
        response.status(409).json({
          ok: false,
          error: messageText,
          message: officeInvitationCapacityErrorMessage(messageText),
        });
        return;
      }
      logger.error('createOfficeInvitation failed', { workspaceId, role, error });
      response.status(500).json({ ok: false, error: 'invitation_create_failed' });
    }
  }
);

export const revokeOfficeInvitation = onRequest(
  {
    region: 'asia-south1',
    cors: true,
    maxInstances: 20,
  },
  async (request, response) => {
    response.set('Cache-Control', 'no-store');
    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }
    if (request.method !== 'POST') {
      response.set('Allow', 'POST').status(405).json({ ok: false, error: 'method_not_allowed' });
      return;
    }

    const actor = await verifyRequestUser(request);
    if (!actor?.uid) {
      response.status(401).json({ ok: false, error: 'sign_in_required' });
      return;
    }

    const body = asRecord(request.body);
    const workspaceId = clean(stringValue(body?.workspaceId));
    const invitationId = clean(stringValue(body?.invitationId));
    if (!workspaceId || !invitationId) {
      response.status(400).json({ ok: false, error: 'invitation_required' });
      return;
    }

    try {
      const now = new Date();
      const timestamp = now.toISOString();
      const workspaceRef = db.collection('workspaces').doc(workspaceId);
      const invitationRef = workspaceRef.collection('office_invitations').doc(invitationId);
      let targetEmail = '';

      await db.runTransaction(async (transaction) => {
        const [workspaceSnapshot, invitationSnapshot, memberSnapshot] = await Promise.all([
          transaction.get(workspaceRef),
          transaction.get(invitationRef),
          transaction.get(workspaceRef.collection('office_members').doc(actor.uid)),
        ]);

        if (!workspaceSnapshot.exists) {
          throw new Error('workspace_not_found');
        }
        if (!invitationSnapshot.exists) {
          throw new Error('invitation_not_found');
        }

        const invitation = invitationSnapshot.data() ?? {};
        const role = normalizeAssignableOfficeRole(clean(stringValue(invitation.role)));
        if (!role) {
          throw new Error('invitation_invalid_role');
        }
        const status = clean(stringValue(invitation.status)) ?? 'pending';
        if (status !== 'pending') {
          throw new Error(`invitation_${status}`);
        }

        const workspace = workspaceSnapshot.data() ?? {};
        const authorization = getOfficeInvitationActionAuthorization({
          actorUid: actor.uid,
          workspace,
          member: memberSnapshot.data(),
          targetRole: role,
        });
        if (!authorization.allowed || !authorization.role) {
          throw new Error('team_admin_required');
        }

        targetEmail = clean(stringValue(invitation.email)) ?? '';
        transaction.set(invitationRef, {
          status: 'revoked',
          revoked_by: actor.uid,
          revoked_at: timestamp,
          updated_at: timestamp,
        }, { merge: true });
        transaction.set(
          workspaceRef.collection('office_access_audit').doc(normalizeId(`office_invite_revoke_${invitationId}_${actor.uid}_${Date.now()}`)),
          buildOfficeInvitationRevokedAuditRecord({
            workspaceId,
            invitationId,
            actorUid: actor.uid,
            actorRole: authorization.role,
            targetEmail,
            role,
            now,
          }),
          { merge: true }
        );
      });

      response.status(200).json({
        ok: true,
        workspaceId,
        invitationId,
        targetEmail,
        message: 'Invitation revoked.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'invitation_revoke_failed';
      if (message === 'workspace_not_found' || message === 'invitation_not_found') {
        response.status(404).json({ ok: false, error: message });
        return;
      }
      if (message === 'team_admin_required') {
        response.status(403).json({ ok: false, error: message });
        return;
      }
      if (message === 'invitation_invalid_role' || message.startsWith('invitation_')) {
        response.status(409).json({ ok: false, error: message });
        return;
      }
      logger.error('revokeOfficeInvitation failed', { workspaceId, invitationId, error });
      response.status(500).json({ ok: false, error: 'invitation_revoke_failed' });
    }
  }
);

export const sendOfficeInvitationEmail = onRequest(
  {
    region: 'asia-south1',
    cors: true,
    maxInstances: 20,
    secrets: [resendApiKey],
  },
  async (request, response) => {
    response.set('Cache-Control', 'no-store');
    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }
    if (request.method !== 'POST') {
      response.set('Allow', 'POST').status(405).json({ ok: false, error: 'method_not_allowed' });
      return;
    }

    const actor = await verifyRequestUser(request);
    if (!actor?.uid) {
      response.status(401).json({ ok: false, error: 'sign_in_required' });
      return;
    }

    const body = asRecord(request.body);
    const workspaceId = clean(stringValue(body?.workspaceId));
    const invitationId = clean(stringValue(body?.invitationId));
    const origin = clean(stringValue(body?.origin));

    if (!workspaceId || !invitationId || !origin) {
      response.status(400).json({ ok: false, error: 'invitation_delivery_required' });
      return;
    }

    try {
      const workspaceRef = db.collection('workspaces').doc(workspaceId);
      const invitationRef = workspaceRef.collection('office_invitations').doc(invitationId);
      const [workspaceSnapshot, invitationSnapshot] = await Promise.all([
        workspaceRef.get(),
        invitationRef.get(),
      ]);

      if (!workspaceSnapshot.exists) {
        response.status(404).json({ ok: false, error: 'workspace_not_found' });
        return;
      }
      if (!invitationSnapshot.exists) {
        response.status(404).json({ ok: false, error: 'invitation_not_found' });
        return;
      }

      const workspace = workspaceSnapshot.data() ?? {};
      const invitation = invitationSnapshot.data() ?? {};
      const invitationRole = normalizeAssignableOfficeRole(clean(stringValue(invitation.role)));
      if (!invitationRole) {
        response.status(409).json({ ok: false, error: 'invitation_invalid_role' });
        return;
      }
      const authorization = await getOfficeInvitationDeliveryAuthorization(workspaceId, actor.uid, workspace, invitationRole);
      if (!authorization.allowed) {
        response.status(403).json({ ok: false, error: 'team_admin_required' });
        return;
      }

      const status = clean(stringValue(invitation.status)) ?? 'pending';
      if (status !== 'pending') {
        response.status(409).json({ ok: false, error: `invitation_${status}` });
        return;
      }

      const expiresAt = clean(stringValue(invitation.expires_at));
      if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
        await invitationRef.set({
          status: 'expired',
          updated_at: new Date().toISOString(),
        }, { merge: true });
        response.status(409).json({ ok: false, error: 'invitation_expired' });
        return;
      }
      if (!expiresAt) {
        await invitationRef.set({
          expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
          updated_at: new Date().toISOString(),
        }, { merge: true });
      }

      const inviteUrl = buildOfficeInvitationUrl(origin, workspaceId, invitationId);
      const delivery = await deliverOfficeInvitationEmail({
        invitation,
        workspace,
        inviteUrl,
      });
      const resendCount = numberValue(invitation.resend_count, 0) + 1;
      const now = new Date();
      const update = buildOfficeInvitationEmailDeliveryUpdate({
        status: delivery.status,
        inviteUrl,
        providerMessageId: delivery.providerMessageId,
        sentAt: delivery.sentAt,
        failureReason: delivery.failureReason,
        resendCount,
        now,
      });

      await invitationRef.set(update, { merge: true });
      await workspaceRef.collection('office_access_audit').doc(normalizeId(`office_invite_delivery_${invitationId}_${actor.uid}_${Date.now()}`)).set(
        buildOfficeInvitationDeliveryAuditRecord({
          workspaceId,
          invitationId,
          actorUid: actor.uid,
          actorRole: authorization.role ?? 'owner',
          targetEmail: clean(stringValue(invitation.email)) ?? '',
          role: invitationRole,
          deliveryStatus: delivery.status,
          now,
        }),
        { merge: true }
      );

      response.status(200).json({
        ok: true,
        workspaceId,
        invitationId,
        deliveryStatus: delivery.status,
        sentAt: delivery.sentAt,
        inviteUrl,
        message:
          delivery.status === 'sent'
            ? 'Invitation email sent.'
            : delivery.status === 'pending_provider_connection'
              ? 'Invitation email is ready. Email delivery is not connected yet.'
              : 'Invitation email could not be sent.',
      });
    } catch (error) {
      logger.error('sendOfficeInvitationEmail failed', { workspaceId, invitationId, error });
      response.status(500).json({ ok: false, error: 'invitation_delivery_failed' });
    }
  }
);

export const updateOfficeMemberAccess = onRequest(
  {
    region: 'asia-south1',
    cors: true,
    maxInstances: 20,
  },
  async (request, response) => {
    response.set('Cache-Control', 'no-store');
    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }
    if (request.method !== 'POST') {
      response.set('Allow', 'POST').status(405).json({ ok: false, error: 'method_not_allowed' });
      return;
    }

    const actor = await verifyRequestUser(request);
    if (!actor?.uid) {
      response.status(401).json({ ok: false, error: 'sign_in_required' });
      return;
    }

    const body = asRecord(request.body);
    const workspaceId = clean(stringValue(body?.workspaceId));
    const memberId = clean(stringValue(body?.memberId));
    const action = normalizeOfficeMemberAccessAction(clean(stringValue(body?.action)));
    const nextRole = normalizeAssignableOfficeRole(clean(stringValue(body?.nextRole)));

    if (!workspaceId || !memberId || !action) {
      response.status(400).json({ ok: false, error: 'member_action_required' });
      return;
    }
    if (action === 'change_role' && !nextRole) {
      response.status(400).json({ ok: false, error: 'role_required' });
      return;
    }

    try {
      const now = new Date();
      const timestamp = now.toISOString();
      const workspaceRef = db.collection('workspaces').doc(workspaceId);
      const memberRef = workspaceRef.collection('office_members').doc(memberId);
      let message = 'Team access updated.';

      await db.runTransaction(async (transaction) => {
        const [workspaceSnapshot, actorMemberSnapshot, targetMemberSnapshot] = await Promise.all([
          transaction.get(workspaceRef),
          transaction.get(workspaceRef.collection('office_members').doc(actor.uid)),
          transaction.get(memberRef),
        ]);

        if (!workspaceSnapshot.exists) {
          throw new Error('workspace_not_found');
        }
        if (!targetMemberSnapshot.exists) {
          throw new Error('member_not_found');
        }
        if (actor.uid === memberId) {
          throw new Error('self_member_locked');
        }

        const workspace = workspaceSnapshot.data() ?? {};
        const targetMember = targetMemberSnapshot.data() ?? {};
        const previousRole = normalizeAssignableOfficeRole(clean(stringValue(targetMember.role)));
        const targetRole = clean(stringValue(targetMember.role));
        const previousStatus = normalizeOfficeMemberStatus(clean(stringValue(targetMember.status)));
        const targetEmail = clean(stringValue(targetMember.email)) ?? clean(stringValue(targetMember.display_name));

        if (targetRole === 'owner') {
          throw new Error('owner_member_locked');
        }
        if (!previousRole || !previousStatus) {
          throw new Error('member_invalid');
        }

        const authorization = getOfficeMemberAccessAuthorization({
          actorUid: actor.uid,
          workspace,
          member: actorMemberSnapshot.data(),
          targetRole: previousRole,
          nextRole: action === 'change_role' ? nextRole : null,
        });
        if (!authorization.allowed || !authorization.role) {
          throw new Error('team_admin_required');
        }

        if (previousStatus === 'removed') {
          throw new Error(action === 'remove' ? 'member_already_removed' : 'member_removed');
        }

        let update: Record<string, unknown> = { updated_at: timestamp };
        let auditAction: 'member_role_changed' | 'member_suspended' | 'member_restored' | 'member_removed';
        let auditPreviousRole: OfficeAssignableRole | null = previousRole;
        let auditNextRole: OfficeAssignableRole | null = previousRole;
        let auditPreviousStatus: OfficeMemberStatus | null = previousStatus;
        let auditNextStatus: OfficeMemberStatus | null = previousStatus;

        if (action === 'change_role') {
          if (!nextRole) {
            throw new Error('role_required');
          }
          if (previousStatus !== 'active') {
            throw new Error('member_inactive');
          }
          if (previousRole === nextRole) {
            throw new Error('role_unchanged');
          }
          auditAction = 'member_role_changed';
          auditNextRole = nextRole;
          update = { ...update, role: nextRole };
          message = 'Team role updated.';
        } else if (action === 'suspend') {
          if (previousStatus === 'suspended') {
            throw new Error('member_already_suspended');
          }
          auditAction = 'member_suspended';
          auditNextStatus = 'suspended';
          update = {
            ...update,
            status: 'suspended',
            suspended_at: timestamp,
            removed_at: null,
          };
          message = 'Member access suspended.';
        } else if (action === 'restore') {
          if (previousStatus === 'active') {
            throw new Error('member_already_active');
          }
          if (previousStatus !== 'suspended') {
            throw new Error('member_not_suspended');
          }
          auditAction = 'member_restored';
          auditNextStatus = 'active';
          update = {
            ...update,
            status: 'active',
            suspended_at: null,
            removed_at: null,
          };
          message = 'Member access restored.';
        } else {
          auditAction = 'member_removed';
          auditNextStatus = 'removed';
          update = {
            ...update,
            status: 'removed',
            suspended_at: null,
            removed_at: timestamp,
          };
          message = 'Member access removed.';
        }

        transaction.set(memberRef, update, { merge: true });
        transaction.set(
          workspaceRef.collection('office_access_audit').doc(normalizeId(`office_member_access_${memberId}_${actor.uid}_${Date.now()}`)),
          buildOfficeMemberAccessAuditRecord({
            workspaceId,
            actorUid: actor.uid,
            actorRole: authorization.role,
            targetUid: memberId,
            targetEmail,
            action: auditAction,
            previousRole: auditPreviousRole,
            nextRole: auditNextRole,
            previousStatus: auditPreviousStatus,
            nextStatus: auditNextStatus,
            now,
          }),
          { merge: true }
        );
      });

      response.status(200).json({
        ok: true,
        workspaceId,
        memberId,
        message,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'member_access_update_failed';
      if (message === 'workspace_not_found' || message === 'member_not_found') {
        response.status(404).json({ ok: false, error: message });
        return;
      }
      if (
        message === 'team_admin_required' ||
        message === 'owner_member_locked' ||
        message === 'self_member_locked'
      ) {
        response.status(403).json({ ok: false, error: message });
        return;
      }
      if (
        message === 'member_invalid' ||
        message === 'member_removed' ||
        message === 'member_inactive' ||
        message === 'member_not_suspended' ||
        message === 'member_already_active' ||
        message === 'member_already_suspended' ||
        message === 'member_already_removed' ||
        message === 'role_unchanged' ||
        message === 'role_required'
      ) {
        response.status(409).json({ ok: false, error: message });
        return;
      }
      logger.error('updateOfficeMemberAccess failed', { workspaceId, memberId, error });
      response.status(500).json({ ok: false, error: 'member_access_update_failed' });
    }
  }
);

export const requestOfficeOwnershipTransfer = onRequest(
  {
    region: 'asia-south1',
    cors: true,
    maxInstances: 10,
    secrets: [resendApiKey],
  },
  async (request, response) => {
    response.set('Cache-Control', 'no-store');
    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }
    if (request.method !== 'POST') {
      response.set('Allow', 'POST').status(405).json({ ok: false, error: 'method_not_allowed' });
      return;
    }

    const actor = await verifyRequestUser(request);
    if (!actor?.uid) {
      response.status(401).json({ ok: false, error: 'sign_in_required' });
      return;
    }

    const body = asRecord(request.body);
    const workspaceId = clean(stringValue(body?.workspaceId));
    const targetUid = clean(stringValue(body?.targetUid));
    if (!workspaceId || !targetUid) {
      response.status(400).json({ ok: false, error: 'ownership_transfer_required' });
      return;
    }

    try {
      const now = new Date();
      const workspaceRef = db.collection('workspaces').doc(workspaceId);
      const transferRef = workspaceRef.collection('office_ownership_transfers').doc();
      let targetEmail: string | null = null;
      let transferRecordForEmail: FirebaseFirestore.DocumentData | null = null;
      let workspaceRecordForEmail: FirebaseFirestore.DocumentData | null = null;

      await db.runTransaction(async (transaction) => {
        const [workspaceSnapshot, targetMemberSnapshot, pendingTransferSnapshot] = await Promise.all([
          transaction.get(workspaceRef),
          transaction.get(workspaceRef.collection('office_members').doc(targetUid)),
          transaction.get(workspaceRef.collection('office_ownership_transfers').where('status', '==', 'pending')),
        ]);

        if (!workspaceSnapshot.exists) {
          throw new Error('workspace_not_found');
        }
        const workspace = workspaceSnapshot.data() ?? {};
        if (clean(stringValue(workspace.owner_uid)) !== actor.uid) {
          throw new Error('owner_required');
        }
        if (actor.uid === targetUid) {
          throw new Error('self_transfer_locked');
        }
        if (!targetMemberSnapshot.exists) {
          throw new Error('member_not_found');
        }
        if (!pendingTransferSnapshot.empty) {
          throw new Error('ownership_transfer_pending');
        }

        const targetMember = targetMemberSnapshot.data() ?? {};
        const targetRole = clean(stringValue(targetMember.role));
        const targetStatus = normalizeOfficeMemberStatus(clean(stringValue(targetMember.status)));
        if (targetRole === 'owner') {
          throw new Error('target_already_owner');
        }
        if (!targetStatus || targetStatus !== 'active') {
          throw new Error('target_member_inactive');
        }

        targetEmail = clean(stringValue(targetMember.email));
        const targetName = clean(stringValue(targetMember.display_name));
        const transferRecord = buildOfficeOwnershipTransferRecord({
          workspaceId,
          requestedBy: actor.uid,
          requestedByEmail: actor.email,
          targetUid,
          targetEmail,
          targetName,
          now,
        });
        transferRecordForEmail = transferRecord;
        workspaceRecordForEmail = workspace;
        transaction.set(transferRef, transferRecord);
        transaction.set(
          workspaceRef.collection('office_access_audit').doc(normalizeId(`office_owner_transfer_request_${transferRef.id}_${actor.uid}_${Date.now()}`)),
          buildOfficeOwnershipTransferAuditRecord({
            workspaceId,
            transferId: transferRef.id,
            actorUid: actor.uid,
            actorRole: 'owner',
            action: 'ownership_transfer_requested',
            targetUid,
            targetEmail,
            previousRole: targetRole === 'admin' || targetRole === 'manager' || targetRole === 'staff' || targetRole === 'accountant' || targetRole === 'viewer'
              ? targetRole
              : null,
            nextRole: 'owner',
            now,
          }),
          { merge: true }
        );
      });

      if (transferRecordForEmail && workspaceRecordForEmail) {
        const delivery = await deliverOfficeOwnershipTransferEmail({
          transfer: transferRecordForEmail,
          workspace: workspaceRecordForEmail,
        });
        const deliveryNow = new Date();
        await transferRef.set(
          buildOfficeOwnershipTransferNotificationUpdate({
            status: delivery.status,
            providerMessageId: delivery.providerMessageId,
            sentAt: delivery.sentAt,
            failureReason: delivery.failureReason,
            resendCount: 1,
            now: deliveryNow,
          }),
          { merge: true }
        );
        await workspaceRef.collection('office_access_audit').doc(normalizeId(`office_owner_transfer_notify_${transferRef.id}_${actor.uid}_${Date.now()}`)).set(
          buildOfficeOwnershipTransferAuditRecord({
            workspaceId,
            transferId: transferRef.id,
            actorUid: actor.uid,
            actorRole: 'owner',
            action: 'ownership_transfer_notification_sent',
            targetUid,
            targetEmail,
            reason:
              delivery.status === 'sent'
                ? 'Ownership transfer approval email sent.'
                : delivery.status === 'pending_provider_connection'
                  ? 'Ownership transfer approval email is ready; email delivery is not connected yet.'
                  : 'Ownership transfer approval email could not be sent.',
            now: deliveryNow,
          }),
          { merge: true }
        );
      }

      response.status(200).json({
        ok: true,
        workspaceId,
        transferId: transferRef.id,
        targetUid,
        targetEmail,
        message: 'Ownership transfer requested.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ownership_transfer_request_failed';
      if (message === 'workspace_not_found' || message === 'member_not_found') {
        response.status(404).json({ ok: false, error: message });
        return;
      }
      if (message === 'owner_required' || message === 'self_transfer_locked') {
        response.status(403).json({ ok: false, error: message });
        return;
      }
      if (
        message === 'ownership_transfer_pending' ||
        message === 'target_already_owner' ||
        message === 'target_member_inactive'
      ) {
        response.status(409).json({ ok: false, error: message });
        return;
      }
      logger.error('requestOfficeOwnershipTransfer failed', { workspaceId, targetUid, error });
      response.status(500).json({ ok: false, error: 'ownership_transfer_request_failed' });
    }
  }
);

export const resendOfficeOwnershipTransferNotification = onRequest(
  {
    region: 'asia-south1',
    cors: true,
    maxInstances: 10,
    secrets: [resendApiKey],
  },
  async (request, response) => {
    response.set('Cache-Control', 'no-store');
    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }
    if (request.method !== 'POST') {
      response.set('Allow', 'POST').status(405).json({ ok: false, error: 'method_not_allowed' });
      return;
    }

    const actor = await verifyRequestUser(request);
    if (!actor?.uid) {
      response.status(401).json({ ok: false, error: 'sign_in_required' });
      return;
    }

    const body = asRecord(request.body);
    const workspaceId = clean(stringValue(body?.workspaceId));
    const transferId = clean(stringValue(body?.transferId));
    if (!workspaceId || !transferId) {
      response.status(400).json({ ok: false, error: 'ownership_transfer_notification_required' });
      return;
    }

    try {
      const workspaceRef = db.collection('workspaces').doc(workspaceId);
      const transferRef = workspaceRef.collection('office_ownership_transfers').doc(transferId);
      const [workspaceSnapshot, transferSnapshot, actorMemberSnapshot] = await Promise.all([
        workspaceRef.get(),
        transferRef.get(),
        workspaceRef.collection('office_members').doc(actor.uid).get(),
      ]);

      if (!workspaceSnapshot.exists) {
        response.status(404).json({ ok: false, error: 'workspace_not_found' });
        return;
      }
      if (!transferSnapshot.exists) {
        response.status(404).json({ ok: false, error: 'ownership_transfer_not_found' });
        return;
      }

      const workspace = workspaceSnapshot.data() ?? {};
      const transfer = transferSnapshot.data() ?? {};
      const currentOwnerUid = clean(stringValue(workspace.owner_uid));
      const targetUid = clean(stringValue(transfer.target_uid));
      const targetEmail = clean(stringValue(transfer.target_email));
      const transferStatus = normalizeOfficeOwnershipTransferStatus(clean(stringValue(transfer.status)));
      const expiresAt = clean(stringValue(transfer.expires_at));
      if (!currentOwnerUid || !targetUid || !transferStatus) {
        response.status(409).json({ ok: false, error: 'ownership_transfer_invalid' });
        return;
      }
      if (transferStatus !== 'pending') {
        response.status(409).json({ ok: false, error: `ownership_transfer_${transferStatus}` });
        return;
      }
      if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
        const now = new Date();
        await transferRef.set({
          status: 'expired',
          updated_at: now.toISOString(),
        }, { merge: true });
        await workspaceRef.collection('office_access_audit').doc(normalizeId(`office_owner_transfer_expired_${transferId}_${Date.now()}`)).set(
          buildOfficeOwnershipTransferAuditRecord({
            workspaceId,
            transferId,
            actorUid: actor.uid,
            actorRole: actor.uid === currentOwnerUid ? 'owner' : 'admin',
            action: 'ownership_transfer_expired',
            targetUid,
            targetEmail,
            reason: 'Ownership transfer expired before reminder could be sent.',
            now,
          }),
          { merge: true }
        );
        response.status(409).json({ ok: false, error: 'ownership_transfer_expired' });
        return;
      }
      if (actor.uid !== currentOwnerUid && actor.uid !== targetUid) {
        response.status(403).json({ ok: false, error: 'ownership_transfer_notification_forbidden' });
        return;
      }
      const actorMemberRole = normalizeAssignableOfficeRole(clean(stringValue(actorMemberSnapshot.data()?.role)));
      const actorRole: 'owner' | OfficeAssignableRole = actor.uid === currentOwnerUid ? 'owner' : actorMemberRole ?? 'viewer';

      const resendCount = numberValue(transfer.notification_resend_count, 0) + 1;
      const delivery = await deliverOfficeOwnershipTransferEmail({ transfer, workspace });
      const now = new Date();
      await transferRef.set(
        buildOfficeOwnershipTransferNotificationUpdate({
          status: delivery.status,
          providerMessageId: delivery.providerMessageId,
          sentAt: delivery.sentAt,
          failureReason: delivery.failureReason,
          resendCount,
          now,
        }),
        { merge: true }
      );
      await workspaceRef.collection('office_access_audit').doc(normalizeId(`office_owner_transfer_notify_${transferId}_${actor.uid}_${Date.now()}`)).set(
        buildOfficeOwnershipTransferAuditRecord({
          workspaceId,
          transferId,
          actorUid: actor.uid,
          actorRole,
          action: 'ownership_transfer_notification_sent',
          targetUid,
          targetEmail,
          reason:
            delivery.status === 'sent'
              ? 'Ownership transfer approval reminder sent.'
              : delivery.status === 'pending_provider_connection'
                ? 'Ownership transfer approval reminder is ready; email delivery is not connected yet.'
                : 'Ownership transfer approval reminder could not be sent.',
          now,
        }),
        { merge: true }
      );

      response.status(200).json({
        ok: true,
        workspaceId,
        transferId,
        deliveryStatus: delivery.status,
        sentAt: delivery.sentAt,
        message:
          delivery.status === 'sent'
            ? 'Ownership approval reminder sent.'
            : delivery.status === 'pending_provider_connection'
              ? 'Ownership approval reminder is ready.'
              : 'Ownership approval reminder could not be sent.',
      });
    } catch (error) {
      logger.error('resendOfficeOwnershipTransferNotification failed', { workspaceId, transferId, error });
      response.status(500).json({ ok: false, error: 'ownership_transfer_notification_failed' });
    }
  }
);

export const resolveOfficeOwnershipTransfer = onRequest(
  {
    region: 'asia-south1',
    cors: true,
    maxInstances: 10,
  },
  async (request, response) => {
    response.set('Cache-Control', 'no-store');
    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }
    if (request.method !== 'POST') {
      response.set('Allow', 'POST').status(405).json({ ok: false, error: 'method_not_allowed' });
      return;
    }

    const actor = await verifyRequestUser(request);
    if (!actor?.uid) {
      response.status(401).json({ ok: false, error: 'sign_in_required' });
      return;
    }

    const body = asRecord(request.body);
    const workspaceId = clean(stringValue(body?.workspaceId));
    const transferId = clean(stringValue(body?.transferId));
    const action = normalizeOfficeOwnershipTransferResolutionAction(clean(stringValue(body?.action)));
    if (!workspaceId || !transferId || !action) {
      response.status(400).json({ ok: false, error: 'ownership_transfer_resolution_required' });
      return;
    }

    try {
      const now = new Date();
      const timestamp = now.toISOString();
      const workspaceRef = db.collection('workspaces').doc(workspaceId);
      const transferRef = workspaceRef.collection('office_ownership_transfers').doc(transferId);
      let message = action === 'approve' ? 'Ownership transfer approved.' : 'Ownership transfer cancelled.';

      await db.runTransaction(async (transaction) => {
        const [workspaceSnapshot, transferSnapshot] = await Promise.all([
          transaction.get(workspaceRef),
          transaction.get(transferRef),
        ]);

        if (!workspaceSnapshot.exists) {
          throw new Error('workspace_not_found');
        }
        if (!transferSnapshot.exists) {
          throw new Error('ownership_transfer_not_found');
        }

        const workspace = workspaceSnapshot.data() ?? {};
        const transfer = transferSnapshot.data() ?? {};
        const currentOwnerUid = clean(stringValue(workspace.owner_uid));
        const requestedBy = clean(stringValue(transfer.requested_by));
        const targetUid = clean(stringValue(transfer.target_uid));
        const targetEmail = clean(stringValue(transfer.target_email));
        const transferStatus = normalizeOfficeOwnershipTransferStatus(clean(stringValue(transfer.status)));
        const expiresAt = clean(stringValue(transfer.expires_at));

        if (!currentOwnerUid || !requestedBy || !targetUid || !transferStatus) {
          throw new Error('ownership_transfer_invalid');
        }
        if (transferStatus !== 'pending') {
          throw new Error(`ownership_transfer_${transferStatus}`);
        }
        if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
          transaction.set(transferRef, {
            status: 'expired',
            updated_at: timestamp,
          }, { merge: true });
          transaction.set(
            workspaceRef.collection('office_access_audit').doc(normalizeId(`office_owner_transfer_expired_${transferId}_${Date.now()}`)),
            buildOfficeOwnershipTransferAuditRecord({
              workspaceId,
              transferId,
              actorUid: actor.uid,
              actorRole: actor.uid === currentOwnerUid ? 'owner' : 'admin',
              action: 'ownership_transfer_expired',
              targetUid,
              targetEmail,
              reason: 'Ownership transfer expired before approval.',
              now,
            }),
            { merge: true }
          );
          throw new Error('ownership_transfer_expired');
        }

        if (action === 'cancel') {
          if (actor.uid !== currentOwnerUid && actor.uid !== targetUid) {
            throw new Error('ownership_transfer_cancel_forbidden');
          }
          transaction.set(transferRef, {
            status: 'cancelled',
            cancelled_by: actor.uid,
            cancelled_at: timestamp,
            updated_at: timestamp,
          }, { merge: true });
          transaction.set(
            workspaceRef.collection('office_access_audit').doc(normalizeId(`office_owner_transfer_cancel_${transferId}_${actor.uid}_${Date.now()}`)),
            buildOfficeOwnershipTransferAuditRecord({
              workspaceId,
              transferId,
              actorUid: actor.uid,
              actorRole: actor.uid === currentOwnerUid ? 'owner' : 'admin',
              action: 'ownership_transfer_cancelled',
              targetUid,
              targetEmail,
              nextRole: null,
              now,
            }),
            { merge: true }
          );
          return;
        }

        if (actor.uid !== targetUid) {
          throw new Error('ownership_transfer_target_required');
        }

        const [targetMemberSnapshot, ownerMemberSnapshot] = await Promise.all([
          transaction.get(workspaceRef.collection('office_members').doc(targetUid)),
          transaction.get(workspaceRef.collection('office_members').doc(currentOwnerUid)),
        ]);
        if (!targetMemberSnapshot.exists) {
          throw new Error('member_not_found');
        }
        const targetMember = targetMemberSnapshot.data() ?? {};
        const targetRole = normalizeAssignableOfficeRole(clean(stringValue(targetMember.role)));
        const targetStatus = normalizeOfficeMemberStatus(clean(stringValue(targetMember.status)));
        if (!targetRole || targetStatus !== 'active') {
          throw new Error('target_member_inactive');
        }

        transaction.set(workspaceRef, {
          owner_uid: targetUid,
          updated_at: timestamp,
        }, { merge: true });
        transaction.set(workspaceRef.collection('office_members').doc(targetUid), {
          role: 'owner',
          status: 'active',
          suspended_at: null,
          removed_at: null,
          updated_at: timestamp,
        }, { merge: true });
        if (ownerMemberSnapshot.exists) {
          transaction.set(workspaceRef.collection('office_members').doc(currentOwnerUid), {
            role: 'admin',
            status: 'active',
            suspended_at: null,
            removed_at: null,
            updated_at: timestamp,
          }, { merge: true });
        }
        transaction.set(transferRef, {
          status: 'approved',
          approved_by: actor.uid,
          approved_at: timestamp,
          updated_at: timestamp,
        }, { merge: true });
        transaction.set(
          workspaceRef.collection('office_access_audit').doc(normalizeId(`office_owner_transfer_approve_${transferId}_${actor.uid}_${Date.now()}`)),
          buildOfficeOwnershipTransferAuditRecord({
            workspaceId,
            transferId,
            actorUid: actor.uid,
            actorRole: 'owner',
            action: 'ownership_transferred',
            targetUid,
            targetEmail,
            previousRole: targetRole,
            nextRole: 'owner',
            now,
          }),
          { merge: true }
        );
      });

      response.status(200).json({
        ok: true,
        workspaceId,
        transferId,
        action,
        message,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ownership_transfer_resolution_failed';
      if (message === 'workspace_not_found' || message === 'ownership_transfer_not_found' || message === 'member_not_found') {
        response.status(404).json({ ok: false, error: message });
        return;
      }
      if (
        message === 'ownership_transfer_cancel_forbidden' ||
        message === 'ownership_transfer_target_required'
      ) {
        response.status(403).json({ ok: false, error: message });
        return;
      }
      if (
        message === 'ownership_transfer_invalid' ||
        message === 'ownership_transfer_expired' ||
        message === 'ownership_transfer_approved' ||
        message === 'ownership_transfer_cancelled' ||
        message === 'target_member_inactive'
      ) {
        response.status(409).json({ ok: false, error: message });
        return;
      }
      logger.error('resolveOfficeOwnershipTransfer failed', { workspaceId, transferId, action, error });
      response.status(500).json({ ok: false, error: 'ownership_transfer_resolution_failed' });
    }
  }
);

export const expireOfficeOwnershipTransfers = onSchedule(
  {
    region: 'asia-south1',
    schedule: 'every 6 hours',
    timeZone: 'Asia/Kolkata',
    maxInstances: 1,
  },
  async () => {
    const now = new Date();
    const timestamp = now.toISOString();
    const snapshot = await db
      .collectionGroup('office_ownership_transfers')
      .where('status', '==', 'pending')
      .limit(100)
      .get();

    if (snapshot.empty) {
      return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((transferSnapshot) => {
      const transfer = transferSnapshot.data() ?? {};
      const expiresAt = clean(stringValue(transfer.expires_at));
      if (!expiresAt || Date.parse(expiresAt) > Date.now()) {
        return;
      }
      const workspaceRef = transferSnapshot.ref.parent.parent;
      if (!workspaceRef) {
        return;
      }
      const workspaceId = clean(stringValue(transfer.workspace_id)) ?? workspaceRef.id;
      const transferId = transferSnapshot.id;
      const targetUid = clean(stringValue(transfer.target_uid)) ?? '';
      const targetEmail = clean(stringValue(transfer.target_email));
      batch.set(transferSnapshot.ref, {
        status: 'expired',
        updated_at: timestamp,
      }, { merge: true });
      batch.set(
        workspaceRef.collection('office_access_audit').doc(normalizeId(`office_owner_transfer_expired_${transferId}_${Date.now()}`)),
        buildOfficeOwnershipTransferAuditRecord({
          workspaceId,
          transferId,
          actorUid: 'system',
          actorRole: 'internal_support_reviewer',
          action: 'ownership_transfer_expired',
          targetUid,
          targetEmail,
          reason: 'Ownership transfer expired automatically.',
          now,
        }),
        { merge: true }
      );
    });

    await batch.commit();
  }
);

export const providerWebhook = onRequest(
  {
    region: 'asia-south1',
    cors: false,
    maxInstances: 20,
    secrets: [providerWebhookSecret, razorpayWebhookSecret],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.set('Allow', 'POST').status(405).json({ ok: false, error: 'method_not_allowed' });
      return;
    }

    if (!isAuthorizedWebhook(request)) {
      response.status(401).json({ ok: false, error: 'unauthorized' });
      return;
    }

    const payload = normalizePayload(request.body);
    const validationError = validatePayload(payload);
    if (validationError) {
      response.status(400).json({ ok: false, error: validationError });
      return;
    }

    const normalizedPayload = { ...payload, workspaceId: payload.workspaceId as string };
    const workspaceId = normalizedPayload.workspaceId;
    const eventId = buildProviderEventId(normalizedPayload);
    const now = new Date().toISOString();
    const eventRef = db
      .collection('workspaces')
      .doc(workspaceId)
      .collection('payment_provider_events')
      .doc(eventId);

    const existingEvent = await eventRef.get();
    const status = normalizeProviderStatus(normalizedPayload.status);
    if (existingEvent.exists && existingEvent.get('applied') === true && status !== 'refunded') {
      response.status(200).json({ ok: true, duplicate: true, eventId });
      return;
    }

    try {
      const result = await applyProviderEvent(workspaceId, eventId, normalizedPayload, now);
      response.status(result.applied ? 200 : 202).json({ ok: true, eventId, ...result });
    } catch (error) {
      logger.error('providerWebhook failed', { eventId, workspaceId, error });
      await eventRef.set(
        {
          source: payload.source ?? 'other',
          status: normalizeProviderStatus(payload.status),
          amount: normalizeAmount(payload.amount),
          currency: normalizeCurrency(payload.currency),
          reference: clean(payload.reference),
          provider_payment_id: clean(payload.providerPaymentId),
          error: error instanceof Error ? error.message : 'Webhook could not be applied.',
          applied: false,
          created_at: now,
          last_modified: now,
          raw_payload: compactPayload(payload),
        },
        { merge: true }
      );
      response.status(500).json({ ok: false, eventId, error: 'apply_failed' });
    }
  }
);

async function applyProviderEvent(
  workspaceId: string,
  eventId: string,
  payload: Required<Pick<ProviderWebhookPayload, 'workspaceId'>> & ProviderWebhookPayload,
  now: string
) {
  const workspaceRef = db.collection('workspaces').doc(workspaceId);
  const eventRef = workspaceRef.collection('payment_provider_events').doc(eventId);
  const status = normalizeProviderStatus(payload.status);
  const amount = normalizeAmount(payload.amount);
  const currency = normalizeCurrency(payload.currency);
  const source = payload.source ?? 'other';

  return db.runTransaction(async (transaction) => {
    const workspaceSnapshot = await transaction.get(workspaceRef);
    if (!workspaceSnapshot.exists) {
      throw new Error('Workspace was not found.');
    }

    const existingEvent = await transaction.get(eventRef);
    if (status === 'refunded') {
      return applyProviderRefundInTransaction(transaction, workspaceRef, eventRef, existingEvent, {
        eventId,
        payload,
        amount,
        currency,
        now,
      });
    }

    if (existingEvent.exists && existingEvent.get('applied') === true) {
      return { applied: true, duplicate: true };
    }

    const invoiceSnapshot = await findInvoiceSnapshot(transaction, workspaceRef, payload);
    if (!invoiceSnapshot) {
      transaction.set(
        eventRef,
        buildEventPayload(payload, {
          applied: false,
          applyStatus: 'needs_review',
          amount,
          currency,
          now,
        }),
        { merge: true }
      );
      return { applied: false, applyStatus: 'needs_review' };
    }

    const invoice = invoiceSnapshot.data() ?? {};
    const invoiceId = invoiceSnapshot.id;
    const customerId = clean(payload.customerId) ?? clean(String(invoice.customer_id ?? ''));
    if (!customerId) {
      transaction.set(
        eventRef,
        buildEventPayload(payload, {
          applied: false,
          applyStatus: 'missing_customer',
          amount,
          currency,
          invoiceId,
          now,
        }),
        { merge: true }
      );
      return { applied: false, applyStatus: 'missing_customer', invoiceId };
    }

    if (status !== 'succeeded') {
      transaction.set(
        eventRef,
        buildEventPayload(payload, {
          applied: false,
          applyStatus: status,
          amount,
          currency,
          invoiceId,
          customerId,
          now,
        }),
        { merge: true }
      );
      return { applied: false, applyStatus: status, invoiceId, customerId };
    }

    const totalAmount = money(invoice.total_amount);
    const paidAmount = money(invoice.paid_amount);
    const dueAmount = roundMoney(Math.max(totalAmount - paidAmount, 0));
    if (dueAmount <= 0) {
      transaction.set(
        eventRef,
        buildEventPayload(payload, {
          applied: false,
          applyStatus: 'already_paid',
          amount,
          currency,
          invoiceId,
          customerId,
          now,
        }),
        { merge: true }
      );
      return { applied: false, applyStatus: 'already_paid', invoiceId, customerId };
    }

    const transactionRef = workspaceRef.collection('transactions').doc(`txn_${eventId}`);
    const allocationRef = workspaceRef.collection('payment_allocations').doc(`pal_${eventId}`);
    const allocationAmount = roundMoney(Math.min(amount, dueAmount));
    const nextPaidAmount = roundMoney(paidAmount + allocationAmount);
    const nextPaymentStatus = nextPaidAmount >= totalAmount ? 'paid' : 'partially_paid';
    const documentState = String(invoice.document_state ?? invoice.status ?? 'created');
    const nextLegacyStatus =
      documentState === 'cancelled' ? 'cancelled' : nextPaymentStatus === 'paid' ? 'paid' : 'issued';
    const effectiveDate = clean(payload.paidAt)?.slice(0, 10) ?? now.slice(0, 10);

    transaction.set(transactionRef, {
      customer_id: customerId,
      type: 'payment',
      amount,
      note: buildPaymentNote(payload, invoice.invoice_number),
      payment_mode: paymentModeForSource(source),
      payment_details: buildPaymentDetails(payload),
      payment_details_json: JSON.stringify(buildPaymentDetails(payload)),
      payment_clearance_status: 'cleared',
      payment_attachments: [],
      payment_attachments_json: null,
      effective_date: effectiveDate,
      created_at: now,
      last_modified: now,
      sync_status: 'synced',
      server_revision: 1,
      provider_event_id: eventId,
    });

    transaction.set(allocationRef, {
      transaction_id: transactionRef.id,
      invoice_id: invoiceId,
      customer_id: customerId,
      amount: allocationAmount,
      created_at: now,
      last_modified: now,
      sync_status: 'synced',
      server_revision: 1,
      provider_event_id: eventId,
    });

    transaction.update(workspaceRef.collection('invoices').doc(invoiceId), {
      paid_amount: nextPaidAmount,
      payment_status: nextPaymentStatus,
      status: nextLegacyStatus,
      last_modified: now,
      server_revision: admin.firestore.FieldValue.increment(1),
    });

    transaction.update(workspaceRef.collection('customers').doc(customerId), {
      current_balance: admin.firestore.FieldValue.increment(-amount),
      updated_at: now,
      last_modified: now,
      server_revision: admin.firestore.FieldValue.increment(1),
    });

    transaction.set(
      eventRef,
      buildEventPayload(payload, {
        applied: true,
        applyStatus: amount > dueAmount ? 'overpaid_applied' : 'applied',
        amount,
        currency,
        invoiceId,
        customerId,
        transactionId: transactionRef.id,
        allocationId: allocationRef.id,
        allocationAmount,
        now,
      }),
      { merge: true }
    );

    return {
      applied: true,
      applyStatus: amount > dueAmount ? 'overpaid_applied' : 'applied',
      invoiceId,
      customerId,
      transactionId: transactionRef.id,
      allocationAmount,
    };
  });
}

async function applyProviderRefundInTransaction(
  transaction: FirebaseFirestore.Transaction,
  workspaceRef: FirebaseFirestore.DocumentReference,
  eventRef: FirebaseFirestore.DocumentReference,
  existingEvent: FirebaseFirestore.DocumentSnapshot,
  input: {
    eventId: string;
    payload: ProviderWebhookPayload;
    amount: number;
    currency: string;
    now: string;
  }
) {
  if (!existingEvent.exists || existingEvent.get('applied') !== true) {
    transaction.set(
      eventRef,
      buildEventPayload(input.payload, {
        applied: false,
        applyStatus: 'refund_needs_review',
        amount: input.amount,
        currency: input.currency,
        now: input.now,
      }),
      { merge: true }
    );
    return { applied: false, applyStatus: 'refund_needs_review' };
  }

  if (existingEvent.get('reversed') === true) {
    return { applied: true, duplicate: true, applyStatus: 'already_reversed' };
  }

  const invoiceId = clean(existingEvent.get('invoice_id'));
  const customerId = clean(existingEvent.get('customer_id'));
  const originalAmount = money(existingEvent.get('amount'));
  const originalAllocationAmount = money(existingEvent.get('allocation_amount'));
  if (!invoiceId || !customerId || originalAmount <= 0) {
    transaction.set(
      eventRef,
      {
        status: 'refunded',
        apply_status: 'refund_needs_review',
        refund_error: 'Original payment is missing invoice or customer details.',
        last_modified: input.now,
        raw_refund_payload: compactPayload(input.payload),
      },
      { merge: true }
    );
    return { applied: false, applyStatus: 'refund_needs_review' };
  }

  const reversalRef = workspaceRef.collection('payment_reversals').doc(`rev_${input.eventId}`);
  const invoiceRef = workspaceRef.collection('invoices').doc(invoiceId);
  const reversalTransactionRef = workspaceRef.collection('transactions').doc(`txn_rev_${input.eventId}`);
  const [reversalSnapshot, invoiceSnapshot] = await Promise.all([
    transaction.get(reversalRef),
    transaction.get(invoiceRef),
  ]);

  if (reversalSnapshot.exists) {
    return { applied: true, duplicate: true, applyStatus: 'already_reversed' };
  }
  if (!invoiceSnapshot.exists) {
    transaction.set(
      eventRef,
      {
        status: 'refunded',
        apply_status: 'refund_needs_review',
        refund_error: 'Invoice for the original payment was not found.',
        last_modified: input.now,
        raw_refund_payload: compactPayload(input.payload),
      },
      { merge: true }
    );
    return { applied: false, applyStatus: 'refund_needs_review', invoiceId, customerId };
  }

  const invoice = invoiceSnapshot.data() ?? {};
  const refundAmount = roundMoney(Math.min(input.amount, originalAmount));
  const reversalAllocationAmount = roundMoney(Math.min(refundAmount, originalAllocationAmount));
  const totalAmount = money(invoice.total_amount);
  const paidAmount = money(invoice.paid_amount);
  const nextPaidAmount = roundMoney(Math.max(paidAmount - reversalAllocationAmount, 0));
  const nextPaymentStatus = deriveProviderInvoicePaymentStatus({
    totalAmount,
    paidAmount: nextPaidAmount,
    dueDate: clean(String(invoice.due_date ?? '')),
    now: input.now,
  });
  const documentState = String(invoice.document_state ?? invoice.status ?? 'created');
  const nextLegacyStatus =
    documentState === 'cancelled' ? 'cancelled' : nextPaymentStatus === 'paid' ? 'paid' : nextPaymentStatus === 'overdue' ? 'overdue' : 'issued';

  transaction.set(reversalTransactionRef, {
    customer_id: customerId,
    type: 'credit',
    amount: refundAmount,
    note: buildRefundNote(input.payload, existingEvent.get('reference')),
    payment_mode: null,
    payment_details: null,
    payment_details_json: null,
    payment_clearance_status: null,
    payment_attachments: [],
    payment_attachments_json: null,
    effective_date: input.now.slice(0, 10),
    created_at: input.now,
    last_modified: input.now,
    sync_status: 'synced',
    server_revision: 1,
    provider_event_id: input.eventId,
    reversal_of_transaction_id: clean(existingEvent.get('transaction_id')),
  });

  transaction.set(reversalRef, {
    provider_event_id: input.eventId,
    original_transaction_id: clean(existingEvent.get('transaction_id')),
    reversal_transaction_id: reversalTransactionRef.id,
    invoice_id: invoiceId,
    customer_id: customerId,
    amount: refundAmount,
    allocation_amount: reversalAllocationAmount,
    reason: 'Provider refund',
    created_at: input.now,
    last_modified: input.now,
    source: input.payload.source ?? 'other',
    reference: clean(input.payload.reference) ?? clean(input.payload.providerPaymentId),
    raw_payload: compactPayload(input.payload),
  });

  transaction.update(invoiceRef, {
    paid_amount: nextPaidAmount,
    payment_status: nextPaymentStatus,
    status: nextLegacyStatus,
    last_modified: input.now,
    server_revision: admin.firestore.FieldValue.increment(1),
  });

  transaction.update(workspaceRef.collection('customers').doc(customerId), {
    current_balance: admin.firestore.FieldValue.increment(refundAmount),
    updated_at: input.now,
    last_modified: input.now,
    server_revision: admin.firestore.FieldValue.increment(1),
  });

  transaction.set(
    eventRef,
    {
      status: 'refunded',
      apply_status: 'reversed',
      reversed: true,
      reversed_at: input.now,
      reversal_id: reversalRef.id,
      reversal_transaction_id: reversalTransactionRef.id,
      refunded_amount: refundAmount,
      raw_refund_payload: compactPayload(input.payload),
      last_modified: input.now,
    },
    { merge: true }
  );

  return {
    applied: true,
    applyStatus: 'reversed',
    invoiceId,
    customerId,
    reversalId: reversalRef.id,
    reversalTransactionId: reversalTransactionRef.id,
    refundAmount,
  };
}

async function findInvoiceSnapshot(
  transaction: FirebaseFirestore.Transaction,
  workspaceRef: FirebaseFirestore.DocumentReference,
  payload: ProviderWebhookPayload
) {
  const invoiceId = clean(payload.invoiceId);
  if (invoiceId) {
    const snapshot = await transaction.get(workspaceRef.collection('invoices').doc(invoiceId));
    return snapshot.exists ? snapshot : null;
  }

  const invoiceNumber = clean(payload.invoiceNumber) ?? invoiceNumberFromReference(payload.reference);
  if (!invoiceNumber) {
    return null;
  }

  const query = workspaceRef.collection('invoices').where('invoice_number', '==', invoiceNumber).limit(1);
  const snapshot = await transaction.get(query);
  return snapshot.docs[0] ?? null;
}

function buildEventPayload(
  payload: ProviderWebhookPayload,
  input: {
    applied: boolean;
    applyStatus: string;
    amount: number;
    currency: string;
    now: string;
    invoiceId?: string;
    customerId?: string;
    transactionId?: string;
    allocationId?: string;
    allocationAmount?: number;
  }
) {
  return {
    provider: clean(payload.provider) ?? 'orbit',
    source: payload.source ?? 'other',
    status: normalizeProviderStatus(payload.status),
    amount: input.amount,
    currency: input.currency,
    reference: clean(payload.reference),
    provider_payment_id: clean(payload.providerPaymentId),
    payer_name: clean(payload.payerName),
    payer_contact: clean(payload.payerContact),
    invoice_id: input.invoiceId ?? null,
    customer_id: input.customerId ?? null,
    transaction_id: input.transactionId ?? null,
    allocation_id: input.allocationId ?? null,
    allocation_amount: input.allocationAmount ?? 0,
    apply_status: input.applyStatus,
    applied: input.applied,
    created_at: input.now,
    last_modified: input.now,
    raw_payload: payload.rawPayload ?? compactPayload(payload),
  };
}

function isAuthorizedWebhook(request: {
  header(name: string): string | undefined;
  rawBody?: Buffer;
}) {
  const razorpaySignature = request.header('x-razorpay-signature');
  if (razorpaySignature) {
    return verifyRazorpayWebhookSignature(
      request.rawBody ?? Buffer.from(''),
      razorpaySignature,
      getSecretValue(razorpayWebhookSecret, 'RAZORPAY_WEBHOOK_SECRET')
    );
  }

  const expectedSecret = getExpectedWebhookSecret();
  if (!expectedSecret) {
    return process.env.FUNCTIONS_EMULATOR === 'true';
  }

  const providedSecret = getProvidedWebhookSecret(request);
  return Boolean(providedSecret) && secureEquals(providedSecret, expectedSecret);
}

function isAuthorizedMonetizationWebhook(request: { header(name: string): string | undefined }) {
  const expectedSecret = getExpectedMonetizationWebhookSecret();
  if (!expectedSecret) {
    return process.env.FUNCTIONS_EMULATOR === 'true';
  }

  const providedSecret = getProvidedWebhookSecret(request);
  return Boolean(providedSecret) && secureEquals(providedSecret, expectedSecret);
}

function isAuthorizedInternalAdminEmail(email: string | null): boolean {
  const allowlist = (process.env.ORBIT_LEDGER_INTERNAL_ADMIN_EMAILS ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (!email || !allowlist.length) {
    return process.env.FUNCTIONS_EMULATOR === 'true';
  }
  return allowlist.includes(email.trim().toLowerCase());
}

function getExpectedWebhookSecret(): string {
  try {
    return providerWebhookSecret.value().trim();
  } catch {
    return process.env.ORBIT_LEDGER_PROVIDER_WEBHOOK_SECRET?.trim() ?? '';
  }
}

function getExpectedMonetizationWebhookSecret(): string {
  try {
    return monetizationWebhookSecret.value().trim();
  } catch {
    return process.env.ORBIT_LEDGER_MONETIZATION_WEBHOOK_SECRET?.trim() ?? '';
  }
}

function getProvidedWebhookSecret(request: { header(name: string): string | undefined }): string {
  const authorization = request.header('authorization') ?? '';
  if (authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim();
  }
  return (request.header('x-orbit-ledger-webhook-secret') ?? request.header('x-webhook-secret') ?? '').trim();
}

function secureEquals(providedSecret: string, expectedSecret: string): boolean {
  const provided = Buffer.from(providedSecret);
  const expected = Buffer.from(expectedSecret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

function normalizePayload(body: unknown): ProviderWebhookPayload {
  const payload = asRecord(body);
  if (!payload) {
    return {};
  }
  if (isRazorpayPayload(payload)) {
    return normalizeRazorpayPayload(payload);
  }
  if (isCashfreePayload(payload)) {
    return normalizeCashfreePayload(payload);
  }
  if (isStripePayload(payload)) {
    return normalizeStripePayload(payload);
  }
  return { ...(payload as ProviderWebhookPayload), rawPayload: payload };
}

function validatePayload(payload: ProviderWebhookPayload): string | null {
  if (!clean(payload.workspaceId)) {
    return 'workspace_required';
  }
  if (normalizeAmount(payload.amount) <= 0) {
    return 'amount_required';
  }
  if (!clean(payload.providerPaymentId) && !clean(payload.reference)) {
    return 'reference_required';
  }
  return null;
}

function buildProviderEventId(payload: ProviderWebhookPayload): string {
  return normalizeId([
    payload.provider ?? payload.source ?? 'provider',
    payload.providerPaymentId ?? payload.reference ?? Date.now(),
  ].join('_'));
}

function normalizeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || `evt-${Date.now()}`;
}

function normalizeOfficeAccessReviewAction(value: string | null): OfficeAccessReviewAction | null {
  if (value === 'mark_reviewing' || value === 'approve' || value === 'reject' || value === 'grant_access') {
    return value;
  }
  return null;
}

function normalizeOfficeAccessRequestStatus(value: string | null | undefined): OfficeAccessRequestStatus {
  if (
    value === 'submitted' ||
    value === 'needs_review' ||
    value === 'reviewing' ||
    value === 'approved' ||
    value === 'rejected' ||
    value === 'granted' ||
    value === 'cancelled'
  ) {
    return value;
  }
  return 'needs_review';
}

function normalizeOfficeRequestedPlanId(value: string | null | undefined): Extract<MonetizationPlanId, 'office_monthly' | 'office_yearly'> {
  return value === 'office_monthly' ? 'office_monthly' : 'office_yearly';
}

function normalizeAssignableOfficeRole(value: string | null | undefined): 'admin' | 'manager' | 'staff' | 'accountant' | 'viewer' | null {
  if (value === 'admin' || value === 'manager' || value === 'staff' || value === 'accountant' || value === 'viewer') {
    return value;
  }
  return null;
}

function normalizeOfficeMemberStatus(value: string | null | undefined): OfficeMemberStatus | null {
  if (value === 'active' || value === 'invited' || value === 'suspended' || value === 'removed') {
    return value;
  }
  return null;
}

function normalizeOfficeMemberAccessAction(value: string | null | undefined): OfficeMemberAccessAction | null {
  if (value === 'change_role' || value === 'suspend' || value === 'restore' || value === 'remove') {
    return value;
  }
  return null;
}

function normalizeOfficeOwnershipTransferStatus(value: string | null | undefined): OfficeOwnershipTransferStatus | null {
  if (value === 'pending' || value === 'approved' || value === 'cancelled' || value === 'expired') {
    return value;
  }
  return null;
}

function normalizeOfficeOwnershipTransferResolutionAction(value: string | null | undefined): OfficeOwnershipTransferResolutionAction | null {
  if (value === 'approve' || value === 'cancel') {
    return value;
  }
  return null;
}

function officeMemberAccessAuditReason(action: 'member_role_changed' | 'member_suspended' | 'member_restored' | 'member_removed') {
  if (action === 'member_role_changed') {
    return 'Office member role changed.';
  }
  if (action === 'member_suspended') {
    return 'Office member access suspended.';
  }
  if (action === 'member_restored') {
    return 'Office member access restored.';
  }
  return 'Office member access removed.';
}

function officeOwnershipTransferAuditReason(
  action:
    | 'ownership_transfer_requested'
    | 'ownership_transferred'
    | 'ownership_transfer_cancelled'
    | 'ownership_transfer_expired'
    | 'ownership_transfer_notification_sent'
) {
  if (action === 'ownership_transfer_requested') {
    return 'Ownership transfer requested.';
  }
  if (action === 'ownership_transferred') {
    return 'Workspace ownership transferred.';
  }
  if (action === 'ownership_transfer_expired') {
    return 'Ownership transfer expired.';
  }
  if (action === 'ownership_transfer_notification_sent') {
    return 'Ownership transfer notification updated.';
  }
  return 'Ownership transfer cancelled.';
}

function officeAccessReviewStatus(status: OfficeAccessRequestStatus) {
  if (status === 'reviewing') {
    return 'reviewing';
  }
  if (status === 'approved') {
    return 'approved';
  }
  if (status === 'granted') {
    return 'completed';
  }
  if (status === 'rejected' || status === 'cancelled') {
    return 'rejected';
  }
  return 'needs_review';
}

function officeAccessActionLabel(status: OfficeAccessRequestStatus) {
  if (status === 'approved') {
    return 'Grant Office access';
  }
  if (status === 'granted') {
    return 'Access granted';
  }
  if (status === 'reviewing') {
    return 'Continue review';
  }
  if (status === 'rejected') {
    return 'Request rejected';
  }
  return 'Review request';
}

function buildOfficeSupportReviewAuditReason(reason: string, supportCaseId: string | null, diagnosticAccess: boolean) {
  return [
    `Support review: ${reason}`,
    supportCaseId ? `Case ${supportCaseId}` : null,
    diagnosticAccess ? 'Customer-approved diagnostics allowed' : 'No customer data access approved',
    'Impersonation blocked; no member session started',
  ].filter(Boolean).join(' · ');
}

function normalizeSupportConsentStatus(value: string | null | undefined): SupportConsentStatus {
  if (value === 'revoked' || value === 'expired') {
    return value;
  }
  return 'active';
}

function normalizeSupportCaseStatus(value: string | null | undefined): SupportCaseStatus {
  if (value === 'waiting_on_customer' || value === 'resolved' || value === 'reopened') {
    return value;
  }
  return 'open';
}

function normalizeSupportCaseAction(value: string | null | undefined): SupportCaseAction {
  if (value === 'resolve' || value === 'reopen') {
    return value;
  }
  return 'add_note';
}

function supportCaseStatusForAction(action: SupportCaseAction): SupportCaseStatus {
  if (action === 'resolve') {
    return 'resolved';
  }
  if (action === 'reopen') {
    return 'reopened';
  }
  return 'open';
}

function supportCaseAuditReason(action: SupportCaseAction, note: string) {
  const prefix = action === 'resolve'
    ? 'Support case resolved'
    : action === 'reopen'
      ? 'Support case reopened'
      : 'Support case note added';
  return `${prefix}: ${note}`;
}

function supportCaseMessageForStatus(status: SupportCaseStatus, action: SupportCaseAction) {
  if (status === 'resolved') {
    return 'Support case marked resolved.';
  }
  if (status === 'reopened') {
    return 'Support case reopened.';
  }
  return action === 'add_note' ? 'Support note saved.' : 'Support case updated.';
}

function supportConsentStatusReason(status: SupportConsentStatus) {
  if (status === 'revoked') {
    return 'Support review approval revoked.';
  }
  if (status === 'expired') {
    return 'Support review approval expired.';
  }
  return 'Support review approval active.';
}

function sanitizeDiagnosticSafeFields(value: Record<string, unknown> | null | undefined): Record<string, string | number | boolean | string[]> {
  if (!value) {
    return {};
  }

  const output: Record<string, string | number | boolean | string[]> = {};
  for (const [key, rawValue] of Object.entries(value).slice(0, 24)) {
    const safeKey = normalizeId(key).replace(/-/g, '_').slice(0, 48);
    if (!safeKey) {
      continue;
    }
    if (typeof rawValue === 'string') {
      const text = clean(rawValue);
      if (text) {
        output[safeKey] = text.slice(0, 240);
      }
    } else if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
      output[safeKey] = rawValue;
    } else if (typeof rawValue === 'boolean') {
      output[safeKey] = rawValue;
    } else if (Array.isArray(rawValue)) {
      const list = sanitizeStringList(rawValue).slice(0, 12);
      if (list.length) {
        output[safeKey] = list;
      }
    }
  }

  return output;
}

function sanitizeStringList(value: unknown[] | null | undefined) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => clean(stringValue(item)))
    .filter((item): item is string => Boolean(item))
    .map((item) => item.slice(0, 120))
    .slice(0, 24);
}

function normalizeProviderStatus(status?: string | null): ProviderPaymentStatus {
  const normalized = (status ?? '').trim().toLowerCase();
  if (['paid', 'captured', 'settled', 'success', 'succeeded'].includes(normalized)) {
    return 'succeeded';
  }
  if (['pending', 'authorized', 'processing'].includes(normalized)) {
    return 'pending';
  }
  if (['refunded', 'refund'].includes(normalized)) {
    return 'refunded';
  }
  return 'failed';
}

function normalizeMonetizationStatus(status?: string | null): MonetizationWebhookStatus | null {
  const normalized = (status ?? '').trim().toLowerCase();
  if (['paid', 'captured', 'settled', 'success', 'succeeded', 'confirmed', 'payment.captured'].includes(normalized)) {
    return 'confirmed';
  }
  if (['pending', 'authorized', 'processing', 'created'].includes(normalized)) {
    return 'pending';
  }
  if (['cancelled', 'canceled'].includes(normalized)) {
    return 'cancelled';
  }
  if (['failed', 'error', 'errored'].includes(normalized)) {
    return 'failed';
  }
  return null;
}

function normalizeMonetizationProvider(value?: string | null): MonetizationCheckoutProvider {
  const normalized = (value ?? '').trim().toLowerCase();
  if (
    normalized === 'razorpay' ||
    normalized === 'stripe' ||
    normalized === 'apple' ||
    normalized === 'google' ||
    normalized === 'manual_provider_pending'
  ) {
    return normalized;
  }
  return 'manual_provider_pending';
}

function isMonetizationPlanId(value: unknown): value is MonetizationPlanId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(monetizationPlanCatalog, value);
}

function isMonetizationWebhookStatus(value: unknown): value is MonetizationWebhookStatus {
  return value === 'confirmed' || value === 'pending' || value === 'failed' || value === 'cancelled';
}

function monetizationPlanLabel(planId: MonetizationPlanId): string {
  return planId
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

export function resolveSubscriptionCheckoutPricing(
  planId: MonetizationPlanId,
  countryCode?: string | null,
  currency?: string | null
): SubscriptionCheckoutPricing {
  const pricingCountry = resolveMonetizationPricingCountry(countryCode, currency);
  const countryPricing = monetizationCountryPricing[pricingCountry];
  const checkoutProvider = monetizationCountryCheckoutProvider[pricingCountry];
  const amountMinor = countryPricing.amounts[planId];
  return {
    pricingCountry,
    currency: countryPricing.currency,
    amountMinor,
    amountDisplay: formatMonetizationPrice(countryPricing.currency, amountMinor),
    checkoutProvider,
    providerPriceId: `orbit_${checkoutProvider}_${pricingCountry.toLowerCase()}_${planId}`,
    providerPriceStatus: 'pending_provider_connection' as const,
  };
}

export function resolveSubscriptionCheckoutPricingFromRecord(
  planId: MonetizationPlanId,
  record?: FirebaseFirestore.DocumentData | Record<string, unknown> | null
): SubscriptionCheckoutPricing {
  const fallback = resolveSubscriptionCheckoutPricing(
    planId,
    clean(stringValue(record?.pricing_country)) ?? clean(stringValue(record?.buyer_country)),
    clean(stringValue(record?.currency))
  );
  const pricingCountry = resolveMonetizationPricingCountry(
    clean(stringValue(record?.pricing_country)) ?? fallback.pricingCountry,
    clean(stringValue(record?.currency)) ?? fallback.currency
  );
  const currency = isMonetizationCurrencyCode(record?.currency) ? record.currency : fallback.currency;
  const checkoutProvider = isMonetizationCheckoutProvider(record?.checkout_provider)
    ? record.checkout_provider
    : fallback.checkoutProvider;
  const amountMinor = Number.isFinite(Number(record?.amount_minor))
    ? Number(record?.amount_minor)
    : fallback.amountMinor;

  return {
    pricingCountry,
    currency,
    amountMinor,
    amountDisplay: clean(stringValue(record?.amount_display)) ?? formatMonetizationPrice(currency, amountMinor),
    checkoutProvider,
    providerPriceId:
      clean(stringValue(record?.provider_price_id)) ??
      `orbit_${checkoutProvider}_${pricingCountry.toLowerCase()}_${planId}`,
    providerPriceStatus: record?.provider_price_status === 'active' ? 'active' : 'pending_provider_connection',
  };
}

function resolveMonetizationPricingCountry(countryCode?: string | null, currency?: string | null): MonetizationPricingCountryCode {
  const normalizedCountry = clean(countryCode)?.toUpperCase();
  if (normalizedCountry && Object.prototype.hasOwnProperty.call(monetizationCountryPricing, normalizedCountry)) {
    return normalizedCountry as MonetizationPricingCountryCode;
  }

  const normalizedCurrency = clean(currency)?.toUpperCase();
  const countryForCurrency = (Object.keys(monetizationCountryPricing) as MonetizationPricingCountryCode[]).find(
    (country) => monetizationCountryPricing[country].currency === normalizedCurrency
  );
  return countryForCurrency ?? 'US';
}

function isMonetizationCurrencyCode(value: unknown): value is MonetizationCurrencyCode {
  return value === 'INR' || value === 'USD' || value === 'CAD' || value === 'AUD' || value === 'GBP';
}

function isMonetizationCheckoutProvider(value: unknown): value is MonetizationCheckoutProvider {
  return (
    value === 'manual_provider_pending' ||
    value === 'razorpay' ||
    value === 'stripe' ||
    value === 'apple' ||
    value === 'google'
  );
}

function formatMonetizationPrice(currencyCode: MonetizationCurrencyCode, amountMinor: number): string {
  const amount = amountMinor / 100;
  return new Intl.NumberFormat('en', {
    currency: currencyCode,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    style: 'currency',
  }).format(amount);
}

function getSubscriptionTaxProfile(countryCode: MonetizationPricingCountryCode): SubscriptionTaxProfile {
  if (countryCode === 'IN') {
    return {
      taxLabel: 'GST',
      registrationLabel: 'GSTIN / PAN',
      receiptLabel: 'Receipt',
      taxDocumentLabel: 'GST tax invoice',
      registrationRequired: true,
      taxTreatment: 'india_gst_provider_review',
      complianceBasis: 'india_gst',
    };
  }
  if (countryCode === 'GB') {
    return {
      taxLabel: 'VAT',
      registrationLabel: 'VAT number',
      receiptLabel: 'Receipt',
      taxDocumentLabel: 'VAT invoice',
      registrationRequired: true,
      taxTreatment: 'uk_vat_provider_review',
      complianceBasis: 'uk_vat',
    };
  }
  if (countryCode === 'CA') {
    return {
      taxLabel: 'GST/HST',
      registrationLabel: 'Business number',
      receiptLabel: 'Receipt',
      taxDocumentLabel: 'GST/HST receipt',
      registrationRequired: true,
      taxTreatment: 'canada_gst_hst_provider_review',
      complianceBasis: 'canada_gst_hst',
    };
  }
  if (countryCode === 'AU') {
    return {
      taxLabel: 'GST',
      registrationLabel: 'ABN',
      receiptLabel: 'Receipt',
      taxDocumentLabel: 'Tax invoice',
      registrationRequired: true,
      taxTreatment: 'australia_gst_provider_review',
      complianceBasis: 'australia_gst',
    };
  }
  return {
    taxLabel: 'Sales tax',
    registrationLabel: 'Tax ID',
    receiptLabel: 'Receipt',
    taxDocumentLabel: 'Receipt',
    registrationRequired: false,
    taxTreatment: 'us_sales_tax_state_review',
    complianceBasis: 'us_state_sales_tax',
  };
}

function getSubscriptionTaxComplianceReview(input: {
  status: 'pending' | 'confirmed' | 'failed' | 'blocked' | 'cancelled';
  taxProfile: SubscriptionTaxProfile;
  buyerTaxNumber: string | null;
  pricingCountry: MonetizationPricingCountryCode;
}): { status: string; message: string; calculationStatus: string } {
  if (input.status !== 'confirmed') {
    return {
      status: 'pending_payment_confirmation',
      message: 'Tax document review starts after payment is confirmed.',
      calculationStatus: 'pending_confirmation',
    };
  }

  if (input.pricingCountry === 'US') {
    return {
      status: 'country_tax_review_required',
      message: 'Sales tax can vary by state. Review provider tax details before filing.',
      calculationStatus: 'provider_review_required',
    };
  }

  if (input.taxProfile.registrationRequired && !input.buyerTaxNumber) {
    return {
      status: 'business_tax_id_missing',
      message: `Add ${input.taxProfile.registrationLabel} when it is needed for business tax records.`,
      calculationStatus: 'provider_review_required',
    };
  }

  return {
    status: 'ready_for_review',
    message: `${input.taxProfile.taxDocumentLabel} metadata is ready for review. Confirm final tax treatment with the payment provider record.`,
    calculationStatus: 'provider_review_required',
  };
}

function normalizeAmount(value?: number | string | null): number {
  const amount = typeof value === 'string' ? Number(value) : Number(value ?? 0);
  return Number.isFinite(amount) ? roundMoney(amount) : 0;
}

function normalizeCurrency(value?: string | null): string {
  return clean(value)?.toUpperCase() ?? 'INR';
}

function billingDocumentStatusFromCheckout(record: FirebaseFirestore.DocumentData): 'pending' | 'confirmed' | 'failed' | 'blocked' | 'cancelled' {
  const status = clean(stringValue(record.provider_status)) ?? clean(stringValue(record.status));
  if (status === 'confirmed') {
    return 'confirmed';
  }
  if (status === 'failed') {
    return 'failed';
  }
  if (status === 'blocked' || status === 'blocked_plan_change') {
    return 'blocked';
  }
  if (status === 'cancelled' || status === 'canceled') {
    return 'cancelled';
  }
  return 'pending';
}

function normalizeBillingEmailDeliveryStatus(value: string | null): BillingEmailDeliveryStatus | null {
  if (value === 'queued' || value === 'pending_provider_connection' || value === 'sent' || value === 'failed') {
    return value;
  }
  if (value === 'delivered') {
    return 'sent';
  }
  if (value === 'pending_connection') {
    return 'pending_provider_connection';
  }
  return null;
}

async function deliverSubscriptionBillingEmailRequest(
  request: FirebaseFirestore.DocumentData
): Promise<BillingEmailDeliveryResult> {
  const recipientEmail = clean(stringValue(request.recipient_email));
  if (!recipientEmail || !isValidEmailAddress(recipientEmail)) {
    return {
      status: 'failed',
      providerMessageId: null,
      sentAt: null,
      failureReason: 'recipient_required',
    };
  }

  const apiKey = getSecretValue(resendApiKey, 'RESEND_API_KEY');
  if (!isConfiguredCredential(apiKey)) {
    return {
      status: 'pending_provider_connection',
      providerMessageId: null,
      sentAt: null,
      failureReason: null,
    };
  }

  return sendResendEmail({
    apiKey,
    payload: buildResendEmailPayload({
        from: getBillingEmailFromAddress(),
        to: [recipientEmail],
        subject: buildBillingReceiptEmailSubject(request),
        html: buildBillingReceiptEmailHtml(request),
        text: buildBillingReceiptEmailText(request),
    }),
  });
}

async function getOfficeInvitationDeliveryAuthorization(
  workspaceId: string,
  actorUid: string,
  workspace: FirebaseFirestore.DocumentData,
  targetRole: OfficeAssignableRole
): Promise<{ allowed: boolean; role: 'owner' | 'admin' | null }> {
  const memberSnapshot = await db.collection('workspaces').doc(workspaceId).collection('office_members').doc(actorUid).get();
  return getOfficeInvitationActionAuthorization({
    actorUid,
    workspace,
    member: memberSnapshot.data(),
    targetRole,
  });
}

function getOfficeInvitationActionAuthorization(input: {
  actorUid: string;
  workspace: FirebaseFirestore.DocumentData;
  member?: FirebaseFirestore.DocumentData;
  targetRole: OfficeAssignableRole;
}): { allowed: boolean; role: 'owner' | 'admin' | null } {
  if (clean(stringValue(input.workspace.owner_uid)) === input.actorUid) {
    return { allowed: true, role: 'owner' };
  }
  if (
    input.member?.status === 'active' &&
    input.member.role === 'admin' &&
    input.targetRole !== 'admin'
  ) {
    return { allowed: true, role: 'admin' };
  }
  return { allowed: false, role: null };
}

function getOfficeMemberAccessAuthorization(input: {
  actorUid: string;
  workspace: FirebaseFirestore.DocumentData;
  member?: FirebaseFirestore.DocumentData;
  targetRole: OfficeAssignableRole;
  nextRole?: OfficeAssignableRole | null;
}): { allowed: boolean; role: 'owner' | 'admin' | null } {
  if (clean(stringValue(input.workspace.owner_uid)) === input.actorUid) {
    return { allowed: true, role: 'owner' };
  }
  if (input.member?.status !== 'active' || input.member.role !== 'admin') {
    return { allowed: false, role: null };
  }
  if (input.targetRole === 'admin' || input.nextRole === 'admin') {
    return { allowed: false, role: null };
  }
  return { allowed: true, role: 'admin' };
}

function getOfficeInvitationCapacityDecisionFromDocs(input: {
  members: FirebaseFirestore.DocumentData[];
  invitations: FirebaseFirestore.DocumentData[];
  targetEmail: string;
}): OfficeInvitationCapacityDecision {
  const targetEmail = input.targetEmail.trim().toLowerCase();
  const activeMembers = input.members.filter((member) => member.status === 'active').length;
  const suspendedMembers = input.members.filter((member) => member.status === 'suspended').length;
  const pendingInvitations = input.invitations.filter((invitation) => invitation.status === 'pending').length;
  const usedSeats = activeMembers + suspendedMembers + pendingInvitations;
  const remainingSeats = Math.max(0, officeIncludedSeatLimit - usedSeats);
  const existingMember = input.members.some((member) => {
    const email = clean(stringValue(member.email))?.toLowerCase();
    return member.status !== 'removed' && email === targetEmail;
  });
  const pendingInvitation = input.invitations.some((invitation) => {
    const email = clean(stringValue(invitation.email))?.toLowerCase();
    return invitation.status === 'pending' && email === targetEmail;
  });

  if (existingMember) {
    return {
      allowed: false,
      reason: 'existing_member',
      seatLimit: officeIncludedSeatLimit,
      usedSeats,
      remainingSeats,
      message: officeInvitationCapacityErrorMessage('existing_member'),
    };
  }
  if (pendingInvitation) {
    return {
      allowed: false,
      reason: 'pending_invitation',
      seatLimit: officeIncludedSeatLimit,
      usedSeats,
      remainingSeats,
      message: officeInvitationCapacityErrorMessage('pending_invitation'),
    };
  }
  if (remainingSeats <= 0) {
    return {
      allowed: false,
      reason: 'seat_limit_reached',
      seatLimit: officeIncludedSeatLimit,
      usedSeats,
      remainingSeats,
      message: officeInvitationCapacityErrorMessage('seat_limit_reached'),
    };
  }
  return {
    allowed: true,
    reason: 'available',
    seatLimit: officeIncludedSeatLimit,
    usedSeats,
    remainingSeats,
    message: `${remainingSeats} Office ${remainingSeats === 1 ? 'seat is' : 'seats are'} available.`,
  };
}

function officeInvitationCapacityErrorMessage(reason: OfficeInvitationCapacityDecision['reason']) {
  if (reason === 'existing_member') {
    return 'This email already belongs to an Office member in this workspace.';
  }
  if (reason === 'pending_invitation') {
    return 'This email already has a pending Office invitation.';
  }
  if (reason === 'seat_limit_reached') {
    return 'Office seats are full. Remove or suspend an unused invitation before inviting another teammate.';
  }
  return 'Team invitation can be created.';
}

async function deliverOfficeInvitationEmail(input: {
  invitation: FirebaseFirestore.DocumentData;
  workspace: FirebaseFirestore.DocumentData;
  inviteUrl: string;
}): Promise<BillingEmailDeliveryResult> {
  const recipientEmail = clean(stringValue(input.invitation.email));
  if (!recipientEmail || !isValidEmailAddress(recipientEmail)) {
    return {
      status: 'failed',
      providerMessageId: null,
      sentAt: null,
      failureReason: 'recipient_required',
    };
  }

  const apiKey = getSecretValue(resendApiKey, 'RESEND_API_KEY');
  if (!isConfiguredCredential(apiKey)) {
    return {
      status: 'pending_provider_connection',
      providerMessageId: null,
      sentAt: null,
      failureReason: null,
    };
  }

  return sendResendEmail({
    apiKey,
    payload: buildResendEmailPayload({
        from: getOfficeInvitationFromAddress(),
        to: [recipientEmail],
        subject: buildOfficeInvitationEmailSubject(input.invitation, input.workspace),
        html: buildOfficeInvitationEmailHtml(input.invitation, input.workspace, input.inviteUrl),
        text: buildOfficeInvitationEmailText(input.invitation, input.workspace, input.inviteUrl),
    }),
  });
}

async function deliverOfficeOwnershipTransferEmail(input: {
  transfer: FirebaseFirestore.DocumentData;
  workspace: FirebaseFirestore.DocumentData;
}): Promise<BillingEmailDeliveryResult> {
  const recipientEmail = clean(stringValue(input.transfer.target_email));
  if (!recipientEmail || !isValidEmailAddress(recipientEmail)) {
    return {
      status: 'failed',
      providerMessageId: null,
      sentAt: null,
      failureReason: 'recipient_required',
    };
  }

  const apiKey = getSecretValue(resendApiKey, 'RESEND_API_KEY');
  if (!isConfiguredCredential(apiKey)) {
    return {
      status: 'pending_provider_connection',
      providerMessageId: null,
      sentAt: null,
      failureReason: null,
    };
  }

  return sendResendEmail({
    apiKey,
    payload: buildResendEmailPayload({
        from: getOfficeInvitationFromAddress(),
        to: [recipientEmail],
        subject: buildOfficeOwnershipTransferEmailSubject(input.transfer, input.workspace),
        html: buildOfficeOwnershipTransferEmailHtml(input.transfer, input.workspace),
        text: buildOfficeOwnershipTransferEmailText(input.transfer, input.workspace),
    }),
  });
}

async function deliverSupportCaseEmailRequest(
  request: FirebaseFirestore.DocumentData
): Promise<BillingEmailDeliveryResult> {
  const recipientEmail = clean(stringValue(request.recipient_email));
  const subject = clean(stringValue(request.subject));
  const body = clean(stringValue(request.body));
  if (!recipientEmail || !isValidEmailAddress(recipientEmail) || !subject || !body) {
    return {
      status: 'failed',
      providerMessageId: null,
      sentAt: null,
      failureReason: 'support_email_required',
    };
  }

  const apiKey = getSecretValue(resendApiKey, 'RESEND_API_KEY');
  if (!isConfiguredCredential(apiKey)) {
    return {
      status: 'pending_provider_connection',
      providerMessageId: null,
      sentAt: null,
      failureReason: null,
    };
  }

  return sendResendEmail({
    apiKey,
    payload: buildResendEmailPayload({
      from: getSupportEmailFromAddress(),
      to: [recipientEmail],
      subject,
      html: buildSupportCaseEmailHtml(body),
      text: body,
    }),
  });
}

async function deliverRecurringInvoiceEmailRequest(input: {
  workspaceId: string;
  invoiceId: string;
  invoice: FirebaseFirestore.DocumentData;
  queue: FirebaseFirestore.DocumentData;
}): Promise<BillingEmailDeliveryResult> {
  const recipientEmail = clean(stringValue(input.queue.recipient_email));
  const subject = clean(stringValue(input.queue.subject)) ?? `Invoice ${clean(stringValue(input.invoice.invoice_number)) ?? input.invoiceId}`;
  const body = clean(stringValue(input.queue.body)) ?? 'Your invoice is ready.';
  if (!recipientEmail || !isValidEmailAddress(recipientEmail)) {
    return {
      status: 'failed',
      providerMessageId: null,
      sentAt: null,
      failureReason: 'recipient_required',
    };
  }

  const apiKey = getSecretValue(resendApiKey, 'RESEND_API_KEY');
  if (!isConfiguredCredential(apiKey)) {
    return {
      status: 'pending_provider_connection',
      providerMessageId: null,
      sentAt: null,
      failureReason: null,
    };
  }

  const paymentLink = Boolean(input.queue.include_payment_link)
    ? buildRecurringInvoicePaymentLink(input.workspaceId, input.invoiceId, input.invoice)
    : null;
  const renderedBody = renderRecurringInvoiceEmailBodyForDelivery(body, paymentLink);
  return sendResendEmail({
    apiKey,
    payload: buildResendEmailPayload({
      from: getOrbitLedgerFromAddress(),
      to: [recipientEmail],
      subject,
      html: buildRecurringInvoiceEmailHtml(renderedBody, input.invoice),
      text: renderedBody,
    }),
  });
}

async function ensureRecurringInvoiceSavedVersion(
  workspaceRef: FirebaseFirestore.DocumentReference,
  invoiceRef: FirebaseFirestore.DocumentReference,
  invoiceId: string,
  invoice: FirebaseFirestore.DocumentData
): Promise<string | null> {
  const existingVersionId = clean(stringValue(invoice.latest_version_id));
  if (existingVersionId) {
    return existingVersionId;
  }

  const now = new Date().toISOString();
  const itemSnapshot = await workspaceRef.collection('invoice_items').where('invoice_id', '==', invoiceId).get();
  const items = itemSnapshot.docs.map((entry) => {
    const item = entry.data();
    return {
      id: entry.id,
      invoiceId,
      productId: clean(stringValue(item.product_id)),
      name: clean(stringValue(item.name)) ?? 'Item',
      description: clean(stringValue(item.description)),
      quantity: numberValue(item.quantity, 0),
      price: numberValue(item.price, 0),
      taxRate: numberValue(item.tax_rate, 0),
      total: numberValue(item.total, 0),
    };
  });
  const snapshotHash = functionStableBase36Hash(JSON.stringify({
    customer_id: clean(stringValue(invoice.customer_id)),
    invoice_number: clean(stringValue(invoice.invoice_number)),
    issue_date: clean(stringValue(invoice.issue_date)),
    due_date: clean(stringValue(invoice.due_date)),
    subtotal: numberValue(invoice.subtotal, 0),
    tax_amount: numberValue(invoice.tax_amount, 0),
    total_amount: numberValue(invoice.total_amount, 0),
    notes: clean(stringValue(invoice.notes)),
    items,
  }));
  const versionRef = workspaceRef.collection('invoice_versions').doc();
  const versionNumber = Math.max(1, Math.floor(numberValue(invoice.version_number, 0)) || 1);
  await db.runTransaction(async (transaction) => {
    const freshInvoice = await transaction.get(invoiceRef);
    const freshData = freshInvoice.data() ?? {};
    const freshVersionId = clean(stringValue(freshData.latest_version_id));
    if (freshVersionId) {
      return;
    }
    transaction.set(versionRef, {
      invoice_id: invoiceId,
      invoice_number: clean(stringValue(invoice.invoice_number)) ?? invoiceId,
      invoice_number_key: functionInvoiceNumberKey(clean(stringValue(invoice.invoice_number)) ?? invoiceId),
      version_number: versionNumber,
      reason: 'First saved recurring invoice',
      created_at: now,
      customer_id: clean(stringValue(invoice.customer_id)),
      customer_name: clean(stringValue(invoice.customer_name)),
      issue_date: clean(stringValue(invoice.issue_date)) ?? now.slice(0, 10),
      billing_month: clean(stringValue(invoice.billing_month)) ?? clean(stringValue(invoice.issue_date))?.slice(0, 7),
      due_date: clean(stringValue(invoice.due_date)),
      document_state: 'created',
      payment_status: clean(stringValue(invoice.payment_status)) ?? 'unpaid',
      payment_status_reason: clean(stringValue(invoice.payment_status_reason)),
      auto_email_sent_at: null,
      auto_email_scheduled_for: clean(stringValue(invoice.auto_email_scheduled_for)),
      auto_email_recipient: clean(stringValue(invoice.auto_email_recipient)),
      auto_email_queue_id: clean(stringValue(invoice.auto_email_queue_id)),
      auto_email_status: clean(stringValue(invoice.latest_auto_email_status)) ?? 'scheduled',
      auto_email_used_version_id: null,
      subtotal: numberValue(invoice.subtotal, 0),
      tax_amount: numberValue(invoice.tax_amount, 0),
      total_amount: numberValue(invoice.total_amount, 0),
      paid_amount: numberValue(invoice.paid_amount, 0),
      notes: clean(stringValue(invoice.notes)),
      snapshot_hash: snapshotHash,
      items,
      pdf_file_name: null,
      csv_file_name: null,
      sync_status: 'synced',
      server_revision: 1,
    });
    transaction.set(invoiceRef, {
      status: 'created',
      document_state: 'created',
      version_number: versionNumber,
      latest_version_id: versionRef.id,
      latest_snapshot_hash: snapshotHash,
      last_modified: now,
      server_revision: admin.firestore.FieldValue.increment(1),
    }, { merge: true });
  });
  const latestSnapshot = await invoiceRef.get();
  return clean(stringValue(latestSnapshot.data()?.latest_version_id)) ?? versionRef.id;
}

export function buildResendEmailPayload(input: {
  from?: string | null;
  to: string[];
  subject: string;
  html: string;
  text: string;
}): ResendEmailPayload {
  return {
    from: clean(input.from) ?? getOrbitLedgerFromAddress(),
    to: input.to.map((email) => email.trim()).filter(isValidEmailAddress),
    subject: input.subject,
    html: input.html,
    text: input.text,
  };
}

async function sendResendEmail(input: {
  apiKey: string;
  payload: ResendEmailPayload;
}): Promise<BillingEmailDeliveryResult> {
  if (!input.payload.to.length) {
    return {
      status: 'failed',
      providerMessageId: null,
      sentAt: null,
      failureReason: 'recipient_required',
    };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input.payload),
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      return {
        status: 'failed',
        providerMessageId: clean(stringValue(payload.id)),
        sentAt: null,
        failureReason: clean(stringValue(payload.message)) ?? `email_failed_${response.status}`,
      };
    }
    return {
      status: 'sent',
      providerMessageId: clean(stringValue(payload.id)),
      sentAt: new Date().toISOString(),
      failureReason: null,
    };
  } catch (error) {
    return {
      status: 'failed',
      providerMessageId: null,
      sentAt: null,
      failureReason: error instanceof Error ? error.message : 'email_failed',
    };
  }
}

function getOrbitLedgerFromAddress() {
  return process.env.ORBIT_LEDGER_FROM_EMAIL?.trim() || 'Orbit Ledger <no-reply@orbitledger.rudraix.com>';
}

function buildRecurringInvoicePaymentLink(
  workspaceId: string,
  invoiceId: string,
  invoice: FirebaseFirestore.DocumentData
) {
  const explicitPaymentPage = normalizeHttpsUrlForFunction(process.env.ORBIT_LEDGER_PAYMENT_PAGE_URL);
  const url = new URL(explicitPaymentPage ?? `${getOrbitLedgerWebAppUrl()}/pay`);
  url.searchParams.set('workspaceId', workspaceId);
  url.searchParams.set('invoiceId', invoiceId);
  const invoiceNumber = clean(stringValue(invoice.invoice_number));
  const totalAmount = numberValue(invoice.total_amount, 0);
  if (invoiceNumber) {
    url.searchParams.set('invoice', invoiceNumber);
    url.searchParams.set('reference', `INV-${invoiceNumber.replace(/\s+/g, '-')}`);
  }
  if (totalAmount > 0) {
    url.searchParams.set('amount', totalAmount.toFixed(2));
  }
  url.searchParams.set('currency', clean(stringValue(invoice.currency)) ?? 'INR');
  return url.toString();
}

function renderRecurringInvoiceEmailBodyForDelivery(body: string, paymentLink: string | null) {
  if (!paymentLink) {
    return body
      .replaceAll('{{paymentLink}}', '')
      .replaceAll('Payment link will be added before sending.', '')
      .trim();
  }
  return body
    .replaceAll('{{paymentLink}}', paymentLink)
    .replaceAll('Payment link will be added before sending.', paymentLink)
    .trim();
}

function normalizeHttpsUrlForFunction(value?: string | null): string | null {
  const cleaned = clean(value);
  if (!cleaned) {
    return null;
  }
  try {
    const url = new URL(cleaned);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function getOfficeInvitationFromAddress() {
  return process.env.ORBIT_LEDGER_OFFICE_FROM_EMAIL?.trim() || getOrbitLedgerFromAddress();
}

function getSupportEmailFromAddress() {
  return process.env.ORBIT_LEDGER_SUPPORT_FROM_EMAIL?.trim() || getOrbitLedgerFromAddress();
}

function getOrbitLedgerWebAppUrl() {
  return process.env.ORBIT_LEDGER_WEB_APP_URL?.trim() || 'https://orbit-ledger-f41c2.web.app';
}

function buildOfficeInvitationUrl(origin: string, workspaceId: string, invitationId: string) {
  const safeOrigin = /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(origin) || /^http:\/\/localhost(?::\d+)?$/i.test(origin)
    ? origin
    : 'https://orbit-ledger-f41c2.web.app';
  const url = new URL('/team/invite', safeOrigin);
  url.searchParams.set('workspaceId', workspaceId);
  url.searchParams.set('invitationId', invitationId);
  return url.toString();
}

function buildOfficeInvitationEmailSubject(
  invitation: FirebaseFirestore.DocumentData,
  workspace: FirebaseFirestore.DocumentData
) {
  const businessName = clean(stringValue(workspace.business_name)) ?? 'an Orbit Ledger workspace';
  return `You are invited to ${businessName} on Orbit Ledger`;
}

function buildOfficeInvitationEmailText(
  invitation: FirebaseFirestore.DocumentData,
  workspace: FirebaseFirestore.DocumentData,
  inviteUrl: string
) {
  const businessName = clean(stringValue(workspace.business_name)) ?? 'this workspace';
  const role = clean(stringValue(invitation.role)) ?? 'team member';
  const invitedByName = clean(stringValue(invitation.invited_by_name));
  const expiresAt = clean(stringValue(invitation.expires_at));
  return [
    `Hello,`,
    ``,
    `${invitedByName ?? 'A workspace admin'} invited you to join ${businessName} on Orbit Ledger as ${role}.`,
    `Accept invitation: ${inviteUrl}`,
    expiresAt ? `This invitation expires on ${expiresAt.slice(0, 10)}.` : null,
    ``,
    `Only accept this invitation if you recognize this business.`,
    ``,
    `Orbit Ledger by Rudraix`,
  ].filter((line) => line !== null).join('\n');
}

function buildOfficeInvitationEmailHtml(
  invitation: FirebaseFirestore.DocumentData,
  workspace: FirebaseFirestore.DocumentData,
  inviteUrl: string
) {
  const businessName = escapeHtml(clean(stringValue(workspace.business_name)) ?? 'this workspace');
  const role = escapeHtml(clean(stringValue(invitation.role)) ?? 'team member');
  const invitedByName = escapeHtml(clean(stringValue(invitation.invited_by_name)) ?? 'A workspace admin');
  const expiresAt = escapeHtml(clean(stringValue(invitation.expires_at))?.slice(0, 10) ?? 'the expiry date shown in Orbit Ledger');
  const safeInviteUrl = escapeHtml(inviteUrl);
  return `<!doctype html>
<html>
<body style="margin:0;background:#f4f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#182233">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:28px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #d8e2ef;border-radius:18px;padding:28px">
          <tr>
            <td>
              <h1 style="margin:0 0 8px;font-size:24px;line-height:1.2">Join ${businessName}</h1>
              <p style="margin:0 0 20px;color:#607087;font-size:15px;line-height:1.5">${invitedByName} invited you to Orbit Ledger as <strong>${role}</strong>.</p>
              <a href="${safeInviteUrl}" style="display:inline-block;background:#2f83f7;color:#ffffff;text-decoration:none;border-radius:12px;padding:12px 18px;font-weight:700">Accept invitation</a>
              <p style="margin:18px 0 0;color:#607087;font-size:14px;line-height:1.5">This invitation expires on ${expiresAt}. Only accept it if you recognize this business.</p>
              <p style="margin:24px 0 0;color:#8a98aa;font-size:12px">Orbit Ledger by Rudraix</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildOfficeOwnershipTransferEmailSubject(
  transfer: FirebaseFirestore.DocumentData,
  workspace: FirebaseFirestore.DocumentData
) {
  const businessName = clean(stringValue(workspace.business_name)) ?? 'an Orbit Ledger workspace';
  return `Ownership transfer approval needed for ${businessName}`;
}

function buildOfficeOwnershipTransferEmailText(
  transfer: FirebaseFirestore.DocumentData,
  workspace: FirebaseFirestore.DocumentData
) {
  const businessName = clean(stringValue(workspace.business_name)) ?? 'this workspace';
  const requestedByEmail = clean(stringValue(transfer.requested_by_email)) ?? 'the current owner';
  const expiresAt = clean(stringValue(transfer.expires_at));
  return [
    `Hello,`,
    ``,
    `${requestedByEmail} requested to transfer ownership of ${businessName} to you in Orbit Ledger.`,
    `Review ownership transfer: ${getOrbitLedgerWebAppUrl()}/team`,
    expiresAt ? `This request expires on ${expiresAt.slice(0, 10)}.` : null,
    ``,
    `Only approve this transfer if you are ready to become responsible for this workspace.`,
    ``,
    `Orbit Ledger by Rudraix`,
  ].filter((line) => line !== null).join('\n');
}

function buildOfficeOwnershipTransferEmailHtml(
  transfer: FirebaseFirestore.DocumentData,
  workspace: FirebaseFirestore.DocumentData
) {
  const businessName = escapeHtml(clean(stringValue(workspace.business_name)) ?? 'this workspace');
  const requestedByEmail = escapeHtml(clean(stringValue(transfer.requested_by_email)) ?? 'the current owner');
  const expiresAt = escapeHtml(clean(stringValue(transfer.expires_at))?.slice(0, 10) ?? 'the expiry date shown in Orbit Ledger');
  const teamUrl = escapeHtml(`${getOrbitLedgerWebAppUrl()}/team`);
  return `<!doctype html>
<html>
<body style="margin:0;background:#f4f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#182233">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:28px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #d8e2ef;border-radius:18px;padding:28px">
          <tr>
            <td>
              <h1 style="margin:0 0 8px;font-size:24px;line-height:1.2">Ownership transfer approval needed</h1>
              <p style="margin:0 0 20px;color:#607087;font-size:15px;line-height:1.5">${requestedByEmail} requested to transfer ownership of <strong>${businessName}</strong> to you.</p>
              <a href="${teamUrl}" style="display:inline-block;background:#2f83f7;color:#ffffff;text-decoration:none;border-radius:12px;padding:12px 18px;font-weight:700">Review transfer</a>
              <p style="margin:18px 0 0;color:#607087;font-size:14px;line-height:1.5">This request expires on ${expiresAt}. Only approve it if you are ready to become responsible for this workspace.</p>
              <p style="margin:24px 0 0;color:#8a98aa;font-size:12px">Orbit Ledger by Rudraix</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function getBillingEmailFromAddress() {
  return process.env.ORBIT_LEDGER_BILLING_FROM_EMAIL?.trim() || getOrbitLedgerFromAddress();
}

function buildBillingReceiptEmailSubject(request: FirebaseFirestore.DocumentData) {
  return `Your Orbit Ledger receipt ${clean(stringValue(request.receipt_number)) ?? ''}`.trim();
}

function buildBillingReceiptEmailText(request: FirebaseFirestore.DocumentData) {
  const receiptNumber = clean(stringValue(request.receipt_number)) ?? 'your receipt';
  const taxInvoiceNumber = clean(stringValue(request.tax_invoice_number));
  const amount = clean(stringValue(request.amount_display));
  return [
    `Hello,`,
    ``,
    `Your Orbit Ledger billing document is ready.`,
    `Receipt: ${receiptNumber}`,
    taxInvoiceNumber ? `Tax invoice: ${taxInvoiceNumber}` : null,
    amount ? `Amount: ${amount}` : null,
    ``,
    `Thank you,`,
    `Orbit Ledger by Rudraix`,
  ].filter((line) => line !== null).join('\n');
}

function buildBillingReceiptEmailHtml(request: FirebaseFirestore.DocumentData) {
  const receiptNumber = escapeHtml(clean(stringValue(request.receipt_number)) ?? 'your receipt');
  const taxInvoiceNumber = escapeHtml(clean(stringValue(request.tax_invoice_number)) ?? 'Not available');
  const amount = escapeHtml(clean(stringValue(request.amount_display)) ?? 'Not available');
  const businessName = escapeHtml(clean(stringValue(request.buyer_business_name)) ?? 'there');
  return `<!doctype html>
<html>
<body style="margin:0;background:#f4f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#182233">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:28px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #d8e2ef;border-radius:18px;padding:28px">
          <tr>
            <td>
              <h1 style="margin:0 0 8px;font-size:24px;line-height:1.2">Orbit Ledger receipt</h1>
              <p style="margin:0 0 20px;color:#607087;font-size:15px;line-height:1.5">Hello ${businessName}, your billing document is ready.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
                <tr><td style="padding:12px;border-top:1px solid #e6edf6;color:#607087">Receipt</td><td style="padding:12px;border-top:1px solid #e6edf6;text-align:right;font-weight:700">${receiptNumber}</td></tr>
                <tr><td style="padding:12px;border-top:1px solid #e6edf6;color:#607087">Tax invoice</td><td style="padding:12px;border-top:1px solid #e6edf6;text-align:right;font-weight:700">${taxInvoiceNumber}</td></tr>
                <tr><td style="padding:12px;border-top:1px solid #e6edf6;border-bottom:1px solid #e6edf6;color:#607087">Amount</td><td style="padding:12px;border-top:1px solid #e6edf6;border-bottom:1px solid #e6edf6;text-align:right;font-weight:700">${amount}</td></tr>
              </table>
              <p style="margin:22px 0 0;color:#7b8ba3;font-size:12px">Generated using Orbit Ledger by Rudraix.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildSupportCaseEmailHtml(body: string) {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p style="margin:0 0 14px;color:#41516a;font-size:15px;line-height:1.55">${escapeHtml(paragraph).replaceAll('\n', '<br>')}</p>`)
    .join('');
  return `<!doctype html>
<html>
<body style="margin:0;background:#f4f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#182233">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:28px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #d8e2ef;border-radius:18px;padding:28px">
          <tr>
            <td>
              <h1 style="margin:0 0 14px;font-size:22px;line-height:1.2">Orbit Ledger support</h1>
              ${paragraphs || '<p style="margin:0 0 14px;color:#41516a;font-size:15px;line-height:1.55">Support follow-up from Orbit Ledger.</p>'}
              <p style="margin:24px 0 0;color:#8a98aa;font-size:12px">Orbit Ledger by Rudraix</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildRecurringInvoiceEmailHtml(body: string, invoice: FirebaseFirestore.DocumentData) {
  const invoiceNumber = escapeHtml(clean(stringValue(invoice.invoice_number)) ?? 'invoice');
  const totalAmount = numberValue(invoice.total_amount, 0);
  const currency = escapeHtml(clean(stringValue(invoice.currency)) ?? 'INR');
  const paragraphs = body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p style="margin:0 0 14px;color:#41516a;font-size:15px;line-height:1.55">${escapeHtml(paragraph).replaceAll('\n', '<br>')}</p>`)
    .join('');
  return `<!doctype html>
<html>
<body style="margin:0;background:#f4f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#182233">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:28px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #d8e2ef;border-radius:18px;padding:28px">
          <tr>
            <td>
              <h1 style="margin:0 0 8px;font-size:22px;line-height:1.2">Invoice ${invoiceNumber}</h1>
              <p style="margin:0 0 20px;color:#607087;font-size:14px;line-height:1.5">Amount due: ${currency} ${escapeHtml(totalAmount.toFixed(2))}</p>
              ${paragraphs || '<p style="margin:0 0 14px;color:#41516a;font-size:15px;line-height:1.55">Your invoice is ready.</p>'}
              <p style="margin:24px 0 0;color:#8a98aa;font-size:12px">Orbit Ledger by Rudraix</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function isValidEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function clean(value?: string | null): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function money(value: unknown): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? roundMoney(amount) : 0;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function invoiceNumberFromReference(reference?: string | null): string | null {
  const cleaned = clean(reference);
  if (!cleaned) {
    return null;
  }
  return cleaned.replace(/^INV[-_\s]*/i, '').trim() || null;
}

function paymentModeForSource(source: ProviderSource): string {
  switch (source) {
    case 'upi':
      return 'upi';
    case 'bank_transfer':
      return 'bank_transfer';
    case 'card':
      return 'card';
    case 'wallet':
    case 'payment_page':
      return 'wallet';
    case 'other':
    default:
      return 'other';
  }
}

function buildPaymentDetails(payload: ProviderWebhookPayload) {
  return {
    referenceNumber: clean(payload.reference) ?? clean(payload.providerPaymentId),
    provider: clean(payload.provider) ?? clean(payload.source) ?? 'provider',
    upiId: payload.source === 'upi' ? clean(payload.payerContact) : null,
    note: clean(payload.payerName),
  };
}

function buildPaymentNote(payload: ProviderWebhookPayload, invoiceNumber: unknown): string {
  const invoice = typeof invoiceNumber === 'string' ? invoiceNumber : clean(payload.invoiceNumber) ?? 'invoice';
  const reference = clean(payload.reference) ?? clean(payload.providerPaymentId);
  return reference ? `Provider payment ${reference} for invoice ${invoice}` : `Provider payment for invoice ${invoice}`;
}

function buildRefundNote(payload: ProviderWebhookPayload, originalReference: unknown): string {
  const reference = clean(payload.reference) ?? clean(payload.providerPaymentId) ?? clean(String(originalReference ?? ''));
  return reference ? `Payment refund or reversal for ${reference}` : 'Payment refund or reversal';
}

function deriveProviderInvoicePaymentStatus(input: {
  totalAmount: number;
  paidAmount: number;
  dueDate: string | null;
  now: string;
}): 'unpaid' | 'partially_paid' | 'paid' | 'overdue' {
  if (input.totalAmount > 0 && input.paidAmount >= input.totalAmount) {
    return 'paid';
  }
  if (input.paidAmount > 0) {
    return 'partially_paid';
  }
  if (input.dueDate && input.dueDate < input.now.slice(0, 10)) {
    return 'overdue';
  }
  return 'unpaid';
}

function compactPayload(payload: ProviderWebhookPayload): Record<string, unknown> {
  return Object.fromEntries(Object.entries(payload).filter(([key, value]) => key !== 'rawPayload' && value !== undefined));
}

function isRazorpayPayload(payload: Record<string, unknown>): boolean {
  return clean(stringValue(payload.event))?.includes('.') === true && asRecord(payload.payload) !== null;
}

function normalizeRazorpayPayload(payload: Record<string, unknown>): ProviderWebhookPayload {
  const eventName = clean(stringValue(payload.event)) ?? '';
  const payment = asRecord(asRecord(asRecord(payload.payload)?.payment)?.entity);
  const refund = asRecord(asRecord(asRecord(payload.payload)?.refund)?.entity);
  const entity = refund ?? payment ?? {};
  const notes = normalizeMetadata(asRecord(entity.notes));
  const paymentId = clean(stringValue(refund?.payment_id)) ?? clean(stringValue(payment?.id)) ?? clean(stringValue(entity.id));
  const amount = normalizeMinorUnitAmount(numberLike(refund?.amount ?? payment?.amount ?? entity.amount));

  return {
    provider: 'razorpay',
    workspaceId: metadataValue(notes, 'workspaceId', 'workspace_id', 'orbit_workspace_id'),
    invoiceId: metadataValue(notes, 'invoiceId', 'invoice_id', 'orbit_invoice_id'),
    invoiceNumber: metadataValue(notes, 'invoiceNumber', 'invoice_number', 'orbit_invoice_number'),
    customerId: metadataValue(notes, 'customerId', 'customer_id', 'orbit_customer_id'),
    source: razorpaySource(clean(stringValue(payment?.method)) ?? clean(stringValue(entity.method))),
    status: razorpayStatus(eventName, clean(stringValue(entity.status))),
    amount,
    currency: clean(stringValue(entity.currency)) ?? 'INR',
    reference: clean(stringValue(refund?.id)) ?? clean(stringValue(entity.order_id)) ?? clean(stringValue(entity.id)),
    providerPaymentId: paymentId,
    payerName: metadataValue(notes, 'payerName', 'customer_name', 'name') ?? clean(stringValue(entity.email)),
    payerContact: clean(stringValue(entity.contact)) ?? clean(stringValue(entity.vpa)),
    paidAt: epochSecondsToIso(numberLike(entity.created_at)),
    rawPayload: payload,
  };
}

function razorpaySource(method: string | null): ProviderSource {
  switch (method) {
    case 'upi':
      return 'upi';
    case 'netbanking':
      return 'bank_transfer';
    case 'card':
      return 'card';
    case 'wallet':
      return 'wallet';
    default:
      return 'payment_page';
  }
}

function razorpayStatus(eventName: string, entityStatus: string | null): ProviderPaymentStatus {
  if (eventName.startsWith('refund.')) {
    return 'refunded';
  }
  if (eventName === 'payment.captured' || entityStatus === 'captured') {
    return 'succeeded';
  }
  if (eventName === 'payment.authorized' || entityStatus === 'authorized') {
    return 'pending';
  }
  return 'failed';
}

function isCashfreePayload(payload: Record<string, unknown>): boolean {
  const data = asRecord(payload.data);
  return clean(stringValue(payload.type))?.includes('_WEBHOOK') === true && Boolean(asRecord(data?.payment));
}

function normalizeCashfreePayload(payload: Record<string, unknown>): ProviderWebhookPayload {
  const data = asRecord(payload.data) ?? {};
  const order = asRecord(data.order) ?? {};
  const payment = asRecord(data.payment) ?? {};
  const customer = asRecord(data.customer_details) ?? {};
  const gateway = asRecord(data.payment_gateway_details) ?? {};
  const tags = normalizeMetadata(asRecord(order.order_tags));
  const type = clean(stringValue(payload.type)) ?? '';
  const paymentStatus = clean(stringValue(payment.payment_status));
  const providerPaymentId =
    clean(stringValue(payment.cf_payment_id)) ??
    clean(stringValue(gateway.gateway_payment_id)) ??
    clean(stringValue(order.order_id));

  return {
    provider: 'cashfree',
    workspaceId: metadataValue(tags, 'workspaceId', 'workspace_id', 'orbit_workspace_id'),
    invoiceId: metadataValue(tags, 'invoiceId', 'invoice_id', 'orbit_invoice_id'),
    invoiceNumber: metadataValue(tags, 'invoiceNumber', 'invoice_number', 'orbit_invoice_number') ?? clean(stringValue(order.order_id)),
    customerId: metadataValue(tags, 'customerId', 'customer_id', 'orbit_customer_id') ?? clean(stringValue(customer.customer_id)),
    source: cashfreeSource(clean(stringValue(payment.payment_group))),
    status: cashfreeStatus(type, paymentStatus),
    amount: normalizeAmount(numberLike(payment.payment_amount ?? order.order_amount)),
    currency: clean(stringValue(payment.payment_currency)) ?? clean(stringValue(order.order_currency)) ?? 'INR',
    reference: clean(stringValue(order.order_id)) ?? clean(stringValue(payment.bank_reference)) ?? providerPaymentId,
    providerPaymentId,
    payerName: clean(stringValue(customer.customer_name)),
    payerContact: clean(stringValue(customer.customer_phone)) ?? clean(stringValue(customer.customer_email)),
    paidAt: clean(stringValue(payment.payment_time)) ?? clean(stringValue(payload.event_time)),
    rawPayload: payload,
  };
}

function cashfreeSource(paymentGroup: string | null): ProviderSource {
  if (paymentGroup?.includes('upi')) {
    return 'upi';
  }
  if (paymentGroup?.includes('card')) {
    return 'card';
  }
  if (paymentGroup?.includes('wallet')) {
    return 'wallet';
  }
  if (paymentGroup?.includes('bank')) {
    return 'bank_transfer';
  }
  return 'payment_page';
}

function cashfreeStatus(eventType: string, paymentStatus: string | null): ProviderPaymentStatus {
  if (eventType.includes('REFUND') || paymentStatus === 'REFUNDED') {
    return 'refunded';
  }
  if (eventType.includes('SUCCESS') || paymentStatus === 'SUCCESS') {
    return 'succeeded';
  }
  if (paymentStatus === 'PENDING') {
    return 'pending';
  }
  return 'failed';
}

function isStripePayload(payload: Record<string, unknown>): boolean {
  return clean(stringValue(payload.type))?.includes('.') === true && asRecord(asRecord(payload.data)?.object) !== null;
}

function normalizeStripePayload(payload: Record<string, unknown>): ProviderWebhookPayload {
  const type = clean(stringValue(payload.type)) ?? '';
  const object = asRecord(asRecord(payload.data)?.object) ?? {};
  const metadata = normalizeMetadata(asRecord(object.metadata));
  const providerPaymentId =
    clean(stringValue(object.payment_intent)) ??
    clean(stringValue(object.id)) ??
    clean(stringValue(object.charge));
  const amount =
    normalizeMinorUnitAmount(numberLike(object.amount_received ?? object.amount_paid ?? object.amount ?? object.amount_refunded));

  return {
    provider: 'stripe',
    workspaceId: metadataValue(metadata, 'workspaceId', 'workspace_id', 'orbit_workspace_id'),
    invoiceId: metadataValue(metadata, 'invoiceId', 'invoice_id', 'orbit_invoice_id'),
    invoiceNumber: metadataValue(metadata, 'invoiceNumber', 'invoice_number', 'orbit_invoice_number'),
    customerId: metadataValue(metadata, 'customerId', 'customer_id', 'orbit_customer_id'),
    source: 'card',
    status: stripeStatus(type, clean(stringValue(object.status))),
    amount,
    currency: clean(stringValue(object.currency))?.toUpperCase() ?? 'USD',
    reference: clean(stringValue(object.id)) ?? providerPaymentId,
    providerPaymentId,
    payerName: clean(stringValue(object.receipt_email)) ?? metadataValue(metadata, 'payerName', 'customer_name', 'name'),
    payerContact: clean(stringValue(object.receipt_email)),
    paidAt: epochSecondsToIso(numberLike(object.created)) ?? clean(stringValue(payload.created)),
    rawPayload: payload,
  };
}

function stripeStatus(eventType: string, objectStatus: string | null): ProviderPaymentStatus {
  if (eventType.includes('refund') || eventType === 'charge.refunded') {
    return 'refunded';
  }
  if (eventType === 'payment_intent.succeeded' || eventType === 'charge.succeeded' || objectStatus === 'succeeded') {
    return 'succeeded';
  }
  if (objectStatus === 'processing' || objectStatus === 'requires_capture') {
    return 'pending';
  }
  return 'failed';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function stringValue(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}

function numberLike(value: unknown): number | string | null {
  return typeof value === 'number' || typeof value === 'string' ? value : null;
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeMinorUnitAmount(value: number | string | null): number {
  return roundMoney(normalizeAmount(value) / 100);
}

function normalizeMetadata(metadata: Record<string, unknown> | null): Record<string, string> {
  if (!metadata) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(metadata)
      .map(([key, value]) => [key, stringValue(value)])
      .filter((entry): entry is [string, string] => Boolean(entry[1]))
  );
}

function metadataValue(metadata: Record<string, string>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = clean(metadata[key]);
    if (value) {
      return value;
    }
  }
  return null;
}

async function verifyRequestUser(request: { header(name: string): string | undefined }): Promise<{ uid: string; email: string | null } | null> {
  const authorization = request.header('authorization') ?? '';
  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  try {
    const token = authorization.slice(7).trim();
    const decodedToken = await admin.auth().verifyIdToken(token);
    return {
      uid: decodedToken.uid,
      email: typeof decodedToken.email === 'string' ? decodedToken.email : null,
    };
  } catch {
    return null;
  }
}

async function verifyRequestUserId(request: { header(name: string): string | undefined }): Promise<string | null> {
  const user = await verifyRequestUser(request);
  return user?.uid ?? null;
}

async function loadCheckoutContext(userId: string, workspaceId: string, invoiceId: string): Promise<
  | {
      ok: true;
      workspace: FirebaseFirestore.DocumentData;
      invoice: FirebaseFirestore.DocumentData;
      customer: FirebaseFirestore.DocumentData | null;
    }
  | { ok: false; status: number; error: string }
> {
  const workspaceRef = db.collection('workspaces').doc(workspaceId);
  const invoiceRef = workspaceRef.collection('invoices').doc(invoiceId);
  const [workspaceSnapshot, invoiceSnapshot] = await Promise.all([workspaceRef.get(), invoiceRef.get()]);

  if (!workspaceSnapshot.exists) {
    return { ok: false, status: 404, error: 'workspace_not_found' };
  }
  const workspace = workspaceSnapshot.data() ?? {};
  if (workspace.owner_uid !== userId) {
    return { ok: false, status: 403, error: 'workspace_forbidden' };
  }
  if (!invoiceSnapshot.exists) {
    return { ok: false, status: 404, error: 'invoice_not_found' };
  }

  const invoice = invoiceSnapshot.data() ?? {};
  const customerId = clean(stringValue(invoice.customer_id));
  const customerSnapshot = customerId ? await workspaceRef.collection('customers').doc(customerId).get() : null;

  return {
    ok: true,
    workspace,
    invoice,
    customer: customerSnapshot?.exists ? customerSnapshot.data() ?? null : null,
  };
}

async function loadWorkspaceForUser(
  userId: string,
  workspaceId: string
): Promise<{ ok: true; workspace: FirebaseFirestore.DocumentData } | { ok: false; status: number; error: string }> {
  const workspaceSnapshot = await db.collection('workspaces').doc(workspaceId).get();

  if (!workspaceSnapshot.exists) {
    return { ok: false, status: 404, error: 'workspace_not_found' };
  }
  const workspace = workspaceSnapshot.data() ?? {};
  if (workspace.owner_uid !== userId) {
    return { ok: false, status: 403, error: 'workspace_forbidden' };
  }
  return { ok: true, workspace };
}

function getSecretValue(secret: ReturnType<typeof defineSecret>, fallbackName: string): string {
  try {
    return secret.value().trim();
  } catch {
    return process.env[fallbackName]?.trim() ?? '';
  }
}

async function processRecurringInvoiceRule(
  workspaceId: string,
  workspaceName: string,
  ruleSnapshot: admin.firestore.QueryDocumentSnapshot,
  today: string
) {
  const rule = normalizeRecurringInvoiceRule(ruleSnapshot);
  const runDates = getDueRecurringRunDatesForFunction(rule, today);
  if (!runDates.length) {
    return;
  }

  let latestCreatedInvoiceId = rule.lastCreatedInvoiceId;
  let latestCreatedRunDate = rule.lastCreatedRunDate;
  for (const runDate of runDates) {
    const emailDate = rule.emailEnabled
      ? rule.nextEmailDate ?? getMonthlyDateForDayForFunction(runDate.slice(0, 7), rule.emailDay ?? rule.invoiceDay)
      : null;
    const invoiceDate = emailDate
      ? getMonthlyDateForDayForFunction(emailDate.slice(0, 7), rule.invoiceDay)
      : runDate;
    const invoice = await createScheduledRecurringInvoice(workspaceId, workspaceName, rule, invoiceDate, today, emailDate, runDate);
    if (invoice) {
      latestCreatedInvoiceId = invoice.invoiceId;
      latestCreatedRunDate = invoiceDate;
    }
  }

  const lastEmailDate = rule.emailEnabled
    ? rule.nextEmailDate ?? getMonthlyDateForDayForFunction((runDates[runDates.length - 1] ?? rule.nextRunDate).slice(0, 7), rule.emailDay ?? rule.invoiceDay)
    : null;
  const nextEmailDate = lastEmailDate ? getNextRecurringRunDateAfterForFunction(lastEmailDate, rule.emailDay ?? rule.invoiceDay) : null;
  const nextRunDate = nextEmailDate
    ? subtractDaysForFunction(nextEmailDate, 3)
    : getNextRecurringRunDateAfterForFunction(runDates[runDates.length - 1] ?? rule.nextRunDate, rule.invoiceDay);
  await ruleSnapshot.ref.set(
    {
      next_run_date: rule.endDate && nextRunDate > rule.endDate ? rule.endDate : nextRunDate,
      next_email_date: nextEmailDate,
      last_created_invoice_id: latestCreatedInvoiceId,
      last_created_run_date: latestCreatedRunDate,
      last_modified: new Date().toISOString(),
      server_revision: admin.firestore.FieldValue.increment(1),
    },
    { merge: true }
  );
}

type ScheduledRecurringInvoiceRule = {
  id: string;
  name: string;
  customerId: string;
  customerName: string | null;
  startDate: string;
  endDate: string | null;
  invoiceDay: number;
  nextRunDate: string;
  dueDays: number;
  invoiceNumberPrefix: string;
  notes: string | null;
  emailEnabled: boolean;
  emailRecipient: string | null;
  emailDay: number | null;
  emailSubject: string | null;
  emailBody: string | null;
  emailIncludePaymentLink: boolean;
  emailAttachPdf: boolean;
  emailCurrentMonthOnly: boolean;
  emailAutomationApproved: boolean;
  emailApprovalRequired: boolean;
  nextEmailDate: string | null;
  items: Array<{
    productId: string | null;
    name: string;
    description: string | null;
    quantity: number;
    price: number;
    taxRate: number;
    total: number;
  }>;
  lastCreatedInvoiceId: string | null;
  lastCreatedRunDate: string | null;
};

function normalizeRecurringInvoiceRule(
  snapshot: admin.firestore.QueryDocumentSnapshot
): ScheduledRecurringInvoiceRule {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    name: clean(stringValue(data.name)) ?? 'Monthly service invoice',
    customerId: clean(stringValue(data.customer_id)) ?? '',
    customerName: clean(stringValue(data.customer_name)),
    startDate: clean(stringValue(data.start_date)) ?? '',
    endDate: clean(stringValue(data.end_date)),
    invoiceDay: clampMonthlyDay(numberValue(data.invoice_day, 1)),
    nextRunDate: clean(stringValue(data.next_run_date)) ?? clean(stringValue(data.start_date)) ?? '',
    dueDays: Math.max(0, Math.floor(numberValue(data.due_days, 7))),
    invoiceNumberPrefix: clean(stringValue(data.invoice_number_prefix)) ?? 'AUTO',
    notes: clean(stringValue(data.notes)),
    emailEnabled: Boolean(data.email_enabled),
    emailRecipient: clean(stringValue(data.email_recipient)),
    emailDay: data.email_day ? clampMonthlyDay(numberValue(data.email_day, 1)) : null,
    emailSubject: clean(stringValue(data.email_subject)),
    emailBody: clean(stringValue(data.email_body)),
    emailIncludePaymentLink: data.email_include_payment_link !== false,
    emailAttachPdf: data.email_attach_pdf !== false,
    emailCurrentMonthOnly: data.email_current_month_only !== false,
    emailAutomationApproved: Boolean(data.email_automation_approved),
    emailApprovalRequired: data.email_approval_required !== false,
    nextEmailDate: clean(stringValue(data.next_email_date)),
    items: Array.isArray(data.items)
      ? data.items.map((item) => normalizeScheduledRecurringItem(asRecord(item))).filter((item) => item.name)
      : [],
    lastCreatedInvoiceId: clean(stringValue(data.last_created_invoice_id)),
    lastCreatedRunDate: clean(stringValue(data.last_created_run_date)),
  };
}

function normalizeScheduledRecurringItem(item: Record<string, unknown> | null) {
  const quantity = numberValue(item?.quantity, 0);
  const price = numberValue(item?.price, 0);
  const taxRate = numberValue(item?.taxRate, 0);
  const taxable = quantity * price;
  return {
    productId: clean(stringValue(item?.productId)),
    name: clean(stringValue(item?.name)) ?? '',
    description: clean(stringValue(item?.description)),
    quantity,
    price,
    taxRate,
    total: roundMoney(taxable + taxable * (taxRate / 100)),
  };
}

type FunctionInvoiceNumberResult = {
  invoiceNumber: string;
  companyCode: string;
  yearCode: string;
  fiscalYear: string;
  sequenceNumber: number;
  countryCode: string;
  separator: '/' | '-';
  formatStyle: 'smart_company_fy_sequence' | 'custom_prefix_year_sequence';
};

async function reserveFunctionInvoiceNumber(
  workspaceId: string,
  fallbackWorkspaceName: string,
  issueDate: string,
  customPrefix?: string | null
): Promise<FunctionInvoiceNumberResult> {
  const workspaceRef = db.collection('workspaces').doc(workspaceId);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(workspaceRef);
    const data = snapshot.exists ? snapshot.data() ?? {} : {};
    const sequenceNumber = normalizeFunctionInvoiceSequence(
      numberValue(data.invoice_number_next_sequence, numberValue(data.invoice_number_sequence, 1))
    );
    const invoiceNumber = buildFunctionSmartInvoiceNumber({
      businessName: clean(stringValue(data.business_name)) ?? fallbackWorkspaceName,
      workspaceId,
      issueDate,
      sequenceNumber,
      countryCode: clean(stringValue(data.country_code)) ?? 'IN',
      customPrefix: normalizeFunctionInvoicePrefix(customPrefix) ?? normalizeFunctionInvoicePrefix(clean(stringValue(data.invoice_number_prefix))),
      separator: clean(stringValue(data.invoice_number_separator)) === '-' ? '-' : '/',
      sequencePadding: numberValue(data.invoice_number_padding, 4),
    });

    transaction.set(workspaceRef, {
      invoice_number_next_sequence: sequenceNumber + 1,
      invoice_number_last_value: invoiceNumber.invoiceNumber,
      invoice_number_last_sequence: sequenceNumber,
      invoice_number_last_issued_at: new Date().toISOString(),
      invoice_number_scheme: invoiceNumber.formatStyle,
    }, { merge: true });

    return invoiceNumber;
  });
}

function functionInvoiceNumberMetadata(invoiceNumber: FunctionInvoiceNumberResult) {
  return {
    invoice_number_key: functionInvoiceNumberKey(invoiceNumber.invoiceNumber),
    invoice_number_scheme: invoiceNumber.formatStyle,
    invoice_number_company_code: invoiceNumber.companyCode,
    invoice_number_year_code: invoiceNumber.yearCode,
    invoice_number_fiscal_year: invoiceNumber.fiscalYear,
    invoice_number_sequence: invoiceNumber.sequenceNumber,
    invoice_number_country_code: invoiceNumber.countryCode,
    invoice_number_separator: invoiceNumber.separator,
  };
}

function functionInvoiceNumberKey(invoiceNumber: string | null | undefined) {
  return (invoiceNumber ?? '').trim().toUpperCase().replace(/\s+/g, '');
}

function buildFunctionSmartInvoiceNumber(input: {
  businessName: string;
  workspaceId: string;
  issueDate: string;
  sequenceNumber: number;
  countryCode: string;
  customPrefix?: string | null;
  separator: '/' | '-';
  sequencePadding: number;
}): FunctionInvoiceNumberResult {
  const countryCode = input.countryCode.trim().toUpperCase() === 'UK' ? 'GB' : input.countryCode.trim().toUpperCase();
  const yearBasis = countryCode === 'IN' || countryCode === 'GB' || countryCode === 'AU'
    ? 'financial_year_start'
    : 'calendar_year';
  const financialYearStartMonth = countryCode === 'AU' ? 7 : countryCode === 'US' || countryCode === 'CA' ? 1 : 4;
  const yearInfo = buildFunctionInvoiceYearInfo(input.issueDate, yearBasis, financialYearStartMonth);
  const sequenceNumber = normalizeFunctionInvoiceSequence(input.sequenceNumber);
  const sequenceCode = String(sequenceNumber).padStart(Math.min(8, Math.max(3, Math.floor(input.sequencePadding || 4))), '0');
  const companyCode = input.customPrefix ?? buildFunctionCompanyInvoiceCode(input.businessName, input.workspaceId);
  const maxLength = countryCode === 'IN' ? 16 : 24;
  let invoiceNumber = [companyCode, yearInfo.yearCode, sequenceCode].join(input.separator);

  if (invoiceNumber.length > maxLength) {
    const allowedPrefixLength = Math.max(2, maxLength - yearInfo.yearCode.length - sequenceCode.length - 2);
    invoiceNumber = [companyCode.slice(0, allowedPrefixLength), yearInfo.yearCode, sequenceCode].join(input.separator);
  }

  return {
    invoiceNumber,
    companyCode,
    yearCode: yearInfo.yearCode,
    fiscalYear: yearInfo.fiscalYear,
    sequenceNumber,
    countryCode,
    separator: input.separator,
    formatStyle: input.customPrefix ? 'custom_prefix_year_sequence' : 'smart_company_fy_sequence',
  };
}

function buildFunctionCompanyInvoiceCode(businessName: string, workspaceId: string): string {
  const words = businessName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .match(/[A-Z0-9]+/g) ?? [];
  const compactName = words.join('');
  const letters = words.length >= 2 ? words.map((word) => word[0]).join('').slice(0, 3) : compactName.slice(0, 3);
  const hash = functionStableBase36Hash(`${workspaceId}:${compactName || businessName}`).slice(0, 2);
  return `${letters || 'INV'}${hash}`.slice(0, 5);
}

function normalizeFunctionInvoicePrefix(value?: string | null): string | null {
  const cleaned = value?.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return !cleaned || cleaned === 'AUTO' ? null : cleaned;
}

function normalizeFunctionInvoiceSequence(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 1 ? Math.floor(numberValue) : 1;
}

function buildFunctionInvoiceYearInfo(
  issueDate: string,
  yearBasis: 'financial_year_start' | 'calendar_year',
  financialYearStartMonth: number
) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(issueDate);
  const date = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : new Date();
  const calendarYear = date.getUTCFullYear();
  const financialYearStart = date.getUTCMonth() + 1 >= financialYearStartMonth ? calendarYear : calendarYear - 1;
  const basisYear = yearBasis === 'financial_year_start' ? financialYearStart : calendarYear;
  return {
    yearCode: String(basisYear % 100).padStart(2, '0'),
    fiscalYear: yearBasis === 'financial_year_start' ? `${financialYearStart}-${financialYearStart + 1}` : `${calendarYear}`,
  };
}

function functionStableBase36Hash(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(2, '0');
}

async function createScheduledRecurringInvoice(
  workspaceId: string,
  workspaceName: string,
  rule: ScheduledRecurringInvoiceRule,
  runDate: string,
  today: string,
  scheduledEmailDate: string | null = null,
  preparationDate: string = today
): Promise<{ invoiceId: string } | null> {
  if (!rule.customerId || !rule.items.length) {
    logger.warn('Recurring invoice rule is missing customer or items', { workspaceId, ruleId: rule.id });
    return null;
  }

  const billingMonth = runDate.slice(0, 7);
  const existingForMonth = await db.collection('workspaces').doc(workspaceId).collection('invoices')
    .where('customer_id', '==', rule.customerId)
    .where('billing_month', '==', billingMonth)
    .limit(25)
    .get();
  const activeExisting = existingForMonth.docs.filter((entry) => {
    const data = entry.data();
    return clean(stringValue(data.document_state ?? data.status)) !== 'cancelled';
  });
  if (activeExisting.some((entry) => Boolean(entry.data().use_for_monthly_auto_email))) {
    return null;
  }
  const daysUntilEmail = scheduledEmailDate ? daysBetweenForFunction(today, scheduledEmailDate) : 0;
  if (activeExisting.length && daysUntilEmail > 1) {
    return null;
  }

  const invoiceId = normalizeId(`recurring-${rule.id}-${runDate}`);
  const invoiceRef = db.collection('workspaces').doc(workspaceId).collection('invoices').doc(invoiceId);
  if ((await invoiceRef.get()).exists) {
    return null;
  }

  const now = new Date().toISOString();
  const subtotal = roundMoney(rule.items.reduce((sum, item) => sum + item.quantity * item.price, 0));
  const taxAmount = roundMoney(rule.items.reduce((sum, item) => sum + item.quantity * item.price * (item.taxRate / 100), 0));
  const totalAmount = roundMoney(subtotal + taxAmount);
  const invoiceNumber = await reserveFunctionInvoiceNumber(
    workspaceId,
    workspaceName,
    runDate,
    rule.invoiceNumberPrefix
  );
  const batch = db.batch();
  batch.set(invoiceRef, {
    customer_id: rule.customerId,
    customer_name: rule.customerName,
    invoice_number: invoiceNumber.invoiceNumber,
    ...functionInvoiceNumberMetadata(invoiceNumber),
    issue_date: runDate,
    billing_month: billingMonth,
    due_date: addDaysForFunction(runDate, rule.dueDays),
    subtotal,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    paid_amount: 0,
    status: 'draft',
    document_state: 'draft',
    payment_status: 'unpaid',
    payment_status_reason: null,
    version_number: 0,
    latest_version_id: null,
    latest_snapshot_hash: null,
    is_archived: false,
    notes: rule.notes,
    use_for_monthly_auto_email: true,
    recurring_rule_id: rule.id,
    recurring_rule_name: rule.name,
    recurring_run_date: runDate,
    auto_email_prepared_at: now,
    auto_email_preparation_date: preparationDate,
    auto_email_scheduled_for: rule.emailEnabled ? scheduledEmailDate ?? getMonthlyDateForDayForFunction(billingMonth, rule.emailDay ?? rule.invoiceDay) : null,
    has_auto_email_history: false,
    latest_auto_email_status: rule.emailEnabled ? 'scheduled' : null,
    latest_auto_email_sent_at: null,
    latest_auto_email_version_id: null,
    created_at: now,
    last_modified: now,
    sync_status: 'synced',
    server_revision: 1,
  });

  rule.items.forEach((item, index) => {
    batch.set(db.collection('workspaces').doc(workspaceId).collection('invoice_items').doc(`${invoiceId}-${index + 1}`), {
      invoice_id: invoiceId,
      product_id: item.productId,
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      price: item.price,
      tax_rate: item.taxRate,
      total: item.total,
      last_modified: now,
      sync_status: 'synced',
      server_revision: 1,
    });
  });

  const isCurrentMonthRun = runDate.slice(0, 7) === today.slice(0, 7);
  if (
    rule.emailEnabled &&
    rule.emailAutomationApproved &&
    !rule.emailApprovalRequired &&
    rule.emailRecipient &&
    (!rule.emailCurrentMonthOnly || isCurrentMonthRun)
  ) {
    const emailDate = scheduledEmailDate ?? getMonthlyDateForDayForFunction(billingMonth, rule.emailDay ?? rule.invoiceDay);
    batch.set(db.collection('workspaces').doc(workspaceId).collection('email_queue').doc(`${invoiceId}-recurring-invoice`), {
      kind: 'recurring_invoice',
      provider: 'resend',
      status: emailDate <= today ? 'ready' : 'scheduled',
      scheduled_for: emailDate,
      recipient_email: rule.emailRecipient,
      subject: renderRecurringEmailTextForFunction(rule.emailSubject ?? defaultRecurringEmailSubjectForFunction(), rule, invoiceNumber.invoiceNumber, runDate, workspaceName),
      body: renderRecurringEmailTextForFunction(rule.emailBody ?? defaultRecurringEmailBodyForFunction(), rule, invoiceNumber.invoiceNumber, runDate, workspaceName),
      invoice_id: invoiceId,
      invoice_number: invoiceNumber.invoiceNumber,
      customer_id: rule.customerId,
      recurring_rule_id: rule.id,
      include_payment_link: rule.emailIncludePaymentLink,
      attachment: rule.emailAttachPdf ? 'invoice_pdf' : null,
      created_at: now,
      last_modified: now,
      sync_status: 'queued',
      server_revision: 1,
    });
  }

  await batch.commit();
  return { invoiceId };
}

function getDueRecurringRunDatesForFunction(rule: ScheduledRecurringInvoiceRule, today: string): string[] {
  const dates: string[] = [];
  let cursor = rule.nextRunDate || getFirstRecurringRunDateForFunction(rule.startDate, rule.invoiceDay);
  let guard = 0;
  while (cursor <= today && (!rule.endDate || cursor <= rule.endDate) && guard < 24) {
    dates.push(cursor);
    cursor = getNextRecurringRunDateAfterForFunction(cursor, rule.invoiceDay);
    guard += 1;
  }
  return dates;
}

function getFirstRecurringRunDateForFunction(startDate: string, day: number): string {
  const month = startDate.slice(0, 7);
  const candidate = getMonthlyDateForDayForFunction(month, day);
  return candidate >= startDate ? candidate : getMonthlyDateForDayForFunction(nextMonthForFunction(month), day);
}

function getNextRecurringRunDateAfterForFunction(date: string, day: number): string {
  return getMonthlyDateForDayForFunction(nextMonthForFunction(date.slice(0, 7)), day);
}

function getMonthlyDateForDayForFunction(month: string, day: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const clampedDay = Math.min(clampMonthlyDay(day), new Date(Date.UTC(year, monthNumber, 0)).getUTCDate());
  return `${month}-${String(clampedDay).padStart(2, '0')}`;
}

function nextMonthForFunction(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 7);
}

function addDaysForFunction(date: string, days: number): string | null {
  const timestamp = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)) {
    return null;
  }
  const next = new Date(timestamp);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function subtractDaysForFunction(date: string, days: number): string {
  const timestamp = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)) {
    return date;
  }
  const next = new Date(timestamp);
  next.setUTCDate(next.getUTCDate() - days);
  return next.toISOString().slice(0, 10);
}

function daysBetweenForFunction(from: string, to: string): number {
  const fromTime = Date.parse(`${from}T00:00:00.000Z`);
  const toTime = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime)) {
    return 0;
  }
  return Math.ceil((toTime - fromTime) / 86_400_000);
}

function clampMonthlyDay(value: number): number {
  return Math.min(Math.max(Math.floor(Number.isFinite(value) ? value : 1), 1), 31);
}

function defaultRecurringEmailSubjectForFunction(): string {
  return 'Invoice {{invoiceNumber}} from {{businessName}}';
}

function defaultRecurringEmailBodyForFunction(): string {
  return 'Hello {{customerName}},\n\nYour monthly invoice {{invoiceNumber}} is attached.\n\nYou can pay here:\n{{paymentLink}}\n\nThank you,\n{{businessName}}';
}

function renderRecurringEmailTextForFunction(
  template: string,
  rule: ScheduledRecurringInvoiceRule,
  invoiceNumber: string,
  runDate: string,
  workspaceName: string
): string {
  return template
    .replaceAll('{{customerName}}', rule.customerName ?? 'Customer')
    .replaceAll('{{invoiceNumber}}', invoiceNumber)
    .replaceAll('{{invoiceDate}}', runDate)
    .replaceAll('{{dueDate}}', addDaysForFunction(runDate, rule.dueDays) ?? runDate)
    .replaceAll('{{amountDue}}', '')
    .replaceAll('{{paymentLink}}', rule.emailIncludePaymentLink ? 'Payment link will be added before sending.' : '')
    .replaceAll('{{businessPhone}}', '')
    .replaceAll('{{businessEmail}}', '')
    .replaceAll('{{businessName}}', workspaceName);
}

function isConfiguredCredential(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return Boolean(normalized) && !['not_configured', 'not-configured', 'placeholder', 'todo'].includes(normalized);
}

async function createRazorpayPaymentLink(
  payload: RazorpayCheckoutPayload,
  keyId: string,
  keySecret: string
): Promise<Record<string, unknown>> {
  const authorization = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const providerResponse = await fetch('https://api.razorpay.com/v1/payment_links/', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authorization}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const responseText = await providerResponse.text();
  const parsed = parseJsonObject(responseText);
  if (!providerResponse.ok) {
    logger.error('Razorpay payment link creation failed', {
      status: providerResponse.status,
      body: parsed ?? responseText.slice(0, 500),
    });
    throw new Error('Razorpay checkout could not be created.');
  }
  if (!parsed) {
    throw new Error('Razorpay returned an invalid response.');
  }
  return parsed;
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  try {
    return asRecord(JSON.parse(value));
  } catch {
    return null;
  }
}

function buildCheckoutReference(invoiceNumber: string, versionNumber: number, now: string): string {
  const suffix = new Date(now).getTime().toString(36).toUpperCase();
  return trimProviderReference(`INV-${invoiceNumber}-V${Math.max(versionNumber, 1)}-${suffix}`);
}

function trimProviderReference(value: string): string {
  const normalized = value.trim().replace(/\s+/g, '-');
  return (normalized || `INV-${Date.now()}`).slice(0, 40);
}

function trimProviderNote(value: string): string {
  return value.trim().slice(0, 255);
}

function normalizeHttpsUrl(value?: string | null): string | null {
  const normalized = clean(value);
  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function epochSecondsToIso(value: number | string | null): string | undefined {
  const seconds = Number(value ?? 0);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : undefined;
}
