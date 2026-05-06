import { getPaymentProviderPlan, getPaymentProviderReadiness } from '@orbit-ledger/core';
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  limit,
  query,
  updateDoc,
} from 'firebase/firestore';

import { getFirebaseApp } from '../cloud/firebase';

export type MobilePaymentProviderEvent = {
  id: string;
  source: string;
  status: string;
  applyStatus: string;
  applied: boolean;
  reversed: boolean;
  amount: number;
  currency: string;
  reference: string | null;
  providerPaymentId: string | null;
  invoiceId: string | null;
  customerId: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
};

export function getMobilePaymentProviderPlan() {
  return getPaymentProviderPlan(process.env.EXPO_PUBLIC_ORBIT_LEDGER_PAYMENT_PROVIDER_MODE);
}

export function getMobilePaymentProviderReadiness(input: {
  paymentPageUrl?: string | null;
  projectId?: string | null;
}) {
  const projectId = input.projectId?.trim() || 'orbit-ledger-f41c2';
  return getPaymentProviderReadiness({
    mode: process.env.EXPO_PUBLIC_ORBIT_LEDGER_PAYMENT_PROVIDER_MODE,
    paymentPageUrl: input.paymentPageUrl,
    webhookUrl: `https://asia-south1-${projectId}.cloudfunctions.net/providerWebhook`,
  });
}

export async function listMobilePaymentProviderEvents(
  workspaceId: string
): Promise<MobilePaymentProviderEvent[]> {
  const snapshot = await getDocs(
    query(
      collection(getFirestore(getFirebaseApp()), 'workspaces', workspaceId, 'payment_provider_events'),
      limit(50)
    )
  );
  return snapshot.docs.map(mapProviderEvent).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function markMobilePaymentProviderEventReviewed(
  workspaceId: string,
  eventId: string,
  reviewNote?: string | null
): Promise<void> {
  const now = new Date().toISOString();
  await updateDoc(
    doc(getFirestore(getFirebaseApp()), 'workspaces', workspaceId, 'payment_provider_events', eventId),
    {
      apply_status: 'reviewed',
      reviewed_at: now,
      review_note: reviewNote?.trim() || null,
      last_modified: now,
    }
  );
}

export async function reverseMobilePaymentProviderEvent(
  workspaceId: string,
  eventId: string,
  reversalNote?: string | null
): Promise<void> {
  const now = new Date().toISOString();
  await updateDoc(
    doc(getFirestore(getFirebaseApp()), 'workspaces', workspaceId, 'payment_provider_events', eventId),
    {
      apply_status: 'reversed',
      reversed: true,
      reversed_at: now,
      reversal_note: reversalNote?.trim() || 'Reversed from mobile event review.',
      reviewed_at: now,
      review_note: reversalNote?.trim() || 'Reversed from mobile event review.',
      last_modified: now,
    }
  );
}

export function formatMobileProviderEventStatus(event: MobilePaymentProviderEvent): string {
  if (event.reversed) {
    return 'Reversed';
  }
  if (event.applied) {
    return 'Applied';
  }
  if (event.applyStatus === 'reviewed') {
    return 'Reviewed';
  }
  if (event.status === 'succeeded') {
    return 'Needs review';
  }
  if (event.status === 'refunded') {
    return 'Refunded';
  }
  if (event.status === 'failed') {
    return 'Failed';
  }
  return 'Pending';
}

export function mobileProviderLabel(source: string): string {
  switch (source) {
    case 'upi':
      return 'UPI';
    case 'payment_page':
      return 'Payment page';
    case 'bank_transfer':
      return 'Bank transfer';
    case 'card':
      return 'Card';
    case 'wallet':
      return 'Wallet';
    default:
      return 'Provider';
  }
}

function mapProviderEvent(entry: { id: string; data(): Record<string, unknown> }): MobilePaymentProviderEvent {
  const data = entry.data();
  return {
    id: entry.id,
    source: stringValue(data.source, 'other'),
    status: stringValue(data.status, 'pending'),
    applyStatus: stringValue(data.apply_status, 'needs_review'),
    applied: Boolean(data.applied),
    reversed: Boolean(data.reversed),
    amount: numberValue(data.amount),
    currency: stringValue(data.currency, 'INR').toUpperCase(),
    reference: nullableString(data.reference),
    providerPaymentId: nullableString(data.provider_payment_id),
    invoiceId: nullableString(data.invoice_id),
    customerId: nullableString(data.customer_id),
    reviewedAt: nullableString(data.reviewed_at),
    reviewNote: nullableString(data.review_note),
    createdAt: stringValue(data.created_at, ''),
  };
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
