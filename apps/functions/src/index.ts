import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { onRequest } from 'firebase-functions/v2/https';

admin.initializeApp();

type ProviderSource = 'upi' | 'payment_page' | 'bank_transfer' | 'card' | 'wallet' | 'other';
type ProviderPaymentStatus = 'succeeded' | 'pending' | 'failed' | 'refunded';

type ProviderWebhookPayload = {
  workspaceId?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  customerId?: string;
  source?: ProviderSource;
  status?: string;
  amount?: number | string;
  currency?: string;
  reference?: string;
  providerPaymentId?: string;
  payerName?: string;
  payerContact?: string;
  paidAt?: string;
};

const db = admin.firestore();

export const providerWebhook = onRequest(
  {
    region: 'asia-south1',
    cors: false,
    maxInstances: 20,
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
    raw_payload: compactPayload(payload),
  };
}

function isAuthorizedWebhook(request: {
  header(name: string): string | undefined;
  query: Record<string, unknown>;
}) {
  const expectedSecret = process.env.ORBIT_LEDGER_PROVIDER_WEBHOOK_SECRET?.trim();
  if (!expectedSecret) {
    return process.env.FUNCTIONS_EMULATOR === 'true';
  }

  const providedSecret =
    request.header('x-orbit-ledger-webhook-secret') ??
    request.header('x-webhook-secret') ??
    request.query.secret;
  return typeof providedSecret === 'string' && providedSecret === expectedSecret;
}

function normalizePayload(body: unknown): ProviderWebhookPayload {
  return body && typeof body === 'object' ? (body as ProviderWebhookPayload) : {};
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
  return normalizeId([payload.source ?? 'provider', payload.providerPaymentId ?? payload.reference ?? Date.now()].join('_'));
}

function normalizeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || `evt-${Date.now()}`;
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

function normalizeAmount(value?: number | string | null): number {
  const amount = typeof value === 'string' ? Number(value) : Number(value ?? 0);
  return Number.isFinite(amount) ? roundMoney(amount) : 0;
}

function normalizeCurrency(value?: string | null): string {
  return clean(value)?.toUpperCase() ?? 'INR';
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
    provider: clean(payload.source) ?? 'provider',
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
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}
