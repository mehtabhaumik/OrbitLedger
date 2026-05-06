'use client';

import type {
  OrbitLedgerCheckoutProvider,
  OrbitLedgerCurrencyCode,
  OrbitLedgerPaidPlanId,
  OrbitLedgerPricingCountryCode,
  OrbitLedgerProviderPriceStatus,
} from '@orbit-ledger/core';

import { getWebAuth, getWebFirebaseProjectId } from './firebase';
import type { WebCheckoutIntent } from './web-monetization';

export type SubscriptionCheckoutResult = {
  provider: OrbitLedgerCheckoutProvider;
  checkoutUrl: string | null;
  checkoutId: string | null;
  reference: string | null;
  amountMinor: number | null;
  amountDisplay: string | null;
  currency: OrbitLedgerCurrencyCode | null;
  pricingCountry: OrbitLedgerPricingCountryCode | null;
  providerPriceId: string | null;
  providerPriceStatus: OrbitLedgerProviderPriceStatus | null;
  message: string | null;
};

export type BillingPortalSessionResult = {
  provider: WebCheckoutIntent['provider'];
  portalSessionId: string | null;
  portalUrl: string | null;
  message: string | null;
};

export type BillingDocumentActionResult = {
  action: 'queue_email' | 'recover_document';
  checkoutIntentId: string;
  requestId: string | null;
  receiptNumber: string | null;
  taxInvoiceNumber: string | null;
  receiptStatus: string | null;
  deliveryStatus: string | null;
  recipientEmail: string | null;
  message: string | null;
};

type CreateSubscriptionCheckoutInput = {
  workspaceId: string;
  checkoutIntentId: string;
  planId: OrbitLedgerPaidPlanId;
  callbackUrl: string;
};

type CreateBillingPortalSessionInput = {
  workspaceId: string;
  callbackUrl: string;
};

type ManageBillingDocumentInput =
  | {
      action: 'queue_email';
      workspaceId: string;
      checkoutIntentId: string;
      recipientEmail?: string | null;
    }
  | {
      action: 'recover_document';
      workspaceId: string;
      checkoutIntentId: string;
    };

type CreateSubscriptionCheckoutResponse =
  | {
      ok: true;
      provider: WebCheckoutIntent['provider'];
      checkoutId: string;
      checkoutUrl: string;
      reference: string;
      amountMinor?: number;
      amountDisplay?: string;
      currency?: OrbitLedgerCurrencyCode;
      pricingCountry?: OrbitLedgerPricingCountryCode;
      providerPriceId?: string;
      providerPriceStatus?: OrbitLedgerProviderPriceStatus;
      message?: string;
    }
  | {
      ok: false;
      error: string;
      provider?: WebCheckoutIntent['provider'];
      checkoutId?: string | null;
      reference?: string | null;
      amountMinor?: number | null;
      amountDisplay?: string | null;
      currency?: OrbitLedgerCurrencyCode | null;
      pricingCountry?: OrbitLedgerPricingCountryCode | null;
      providerPriceId?: string | null;
      providerPriceStatus?: OrbitLedgerProviderPriceStatus | null;
      message?: string;
    };

type CreateBillingPortalSessionResponse =
  | {
      ok: true;
      provider: WebCheckoutIntent['provider'];
      portalSessionId: string;
      portalUrl: string;
      message?: string;
    }
  | {
      ok: false;
      error: string;
      provider?: WebCheckoutIntent['provider'];
      portalSessionId?: string | null;
      portalUrl?: string | null;
      message?: string;
    };

type ManageBillingDocumentResponse =
  | {
      ok: true;
      action: 'queue_email' | 'recover_document';
      checkoutIntentId: string;
      requestId?: string | null;
      receiptNumber?: string | null;
      taxInvoiceNumber?: string | null;
      receiptStatus?: string | null;
      status?: string | null;
      recipientEmail?: string | null;
      message?: string;
    }
  | {
      ok: false;
      error: string;
      message?: string;
    };

export async function createSubscriptionCheckout(
  input: CreateSubscriptionCheckoutInput
): Promise<SubscriptionCheckoutResult> {
  const user = getWebAuth().currentUser;
  if (!user) {
    throw new Error('Sign in again before starting checkout.');
  }

  const token = await user.getIdToken();
  const response = await fetch(getCreateSubscriptionCheckoutUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'checkout_failed',
  }))) as CreateSubscriptionCheckoutResponse;

  if (result.ok) {
    return {
      provider: result.provider,
      checkoutUrl: result.checkoutUrl,
      checkoutId: result.checkoutId,
      reference: result.reference,
      amountMinor: result.amountMinor ?? null,
      amountDisplay: result.amountDisplay ?? null,
      currency: result.currency ?? null,
      pricingCountry: result.pricingCountry ?? null,
      providerPriceId: result.providerPriceId ?? null,
      providerPriceStatus: result.providerPriceStatus ?? null,
      message: result.message ?? null,
    };
  }

  if (result.error === 'provider_not_connected') {
    return {
      provider: result.provider ?? 'manual_provider_pending',
      checkoutUrl: null,
      checkoutId: result.checkoutId ?? null,
      reference: result.reference ?? null,
      amountMinor: result.amountMinor ?? null,
      amountDisplay: result.amountDisplay ?? null,
      currency: result.currency ?? null,
      pricingCountry: result.pricingCountry ?? null,
      providerPriceId: result.providerPriceId ?? null,
      providerPriceStatus: result.providerPriceStatus ?? null,
      message: result.message ?? 'Payment checkout is not connected yet.',
    };
  }

  throw new Error(result.message ?? 'Checkout could not be prepared.');
}

export async function createBillingPortalSession(
  input: CreateBillingPortalSessionInput
): Promise<BillingPortalSessionResult> {
  const user = getWebAuth().currentUser;
  if (!user) {
    throw new Error('Sign in again before opening billing management.');
  }

  const token = await user.getIdToken();
  const response = await fetch(getCreateBillingPortalSessionUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'billing_portal_failed',
  }))) as CreateBillingPortalSessionResponse;

  if (result.ok) {
    return {
      provider: result.provider,
      portalSessionId: result.portalSessionId,
      portalUrl: result.portalUrl,
      message: result.message ?? null,
    };
  }

  if (result.error === 'provider_not_connected') {
    return {
      provider: result.provider ?? 'manual_provider_pending',
      portalSessionId: result.portalSessionId ?? null,
      portalUrl: result.portalUrl ?? null,
      message: result.message ?? 'Billing portal is not connected yet.',
    };
  }

  throw new Error(result.message ?? 'Billing management could not be opened.');
}

export async function manageSubscriptionBillingDocument(
  input: ManageBillingDocumentInput
): Promise<BillingDocumentActionResult> {
  const user = getWebAuth().currentUser;
  if (!user) {
    throw new Error('Sign in again before managing billing documents.');
  }

  const token = await user.getIdToken();
  const response = await fetch(getManageSubscriptionBillingDocumentUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'billing_document_action_failed',
  }))) as ManageBillingDocumentResponse;

  if (!result.ok) {
    throw new Error(result.message ?? billingDocumentErrorMessage(result.error));
  }

  return {
    action: result.action,
    checkoutIntentId: result.checkoutIntentId,
    requestId: result.requestId ?? null,
    receiptNumber: result.receiptNumber ?? null,
    taxInvoiceNumber: result.taxInvoiceNumber ?? null,
    receiptStatus: result.receiptStatus ?? null,
    deliveryStatus: result.status ?? null,
    recipientEmail: result.recipientEmail ?? null,
    message: result.message ?? null,
  };
}

function getCreateSubscriptionCheckoutUrl() {
  const projectId = getWebFirebaseProjectId();
  return `https://asia-south1-${projectId}.cloudfunctions.net/createSubscriptionCheckout`;
}

function getCreateBillingPortalSessionUrl() {
  const projectId = getWebFirebaseProjectId();
  return `https://asia-south1-${projectId}.cloudfunctions.net/createBillingPortalSession`;
}

function getManageSubscriptionBillingDocumentUrl() {
  const projectId = getWebFirebaseProjectId();
  return `https://asia-south1-${projectId}.cloudfunctions.net/manageSubscriptionBillingDocument`;
}

function billingDocumentErrorMessage(error: string) {
  if (error === 'recipient_required') {
    return 'Add a billing email before sending the receipt.';
  }
  if (error === 'billing_document_not_found') {
    return 'Billing document could not be found.';
  }
  return 'Billing document action could not be completed.';
}
