import { timingSafeEqual } from 'node:crypto';

import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';

admin.initializeApp();

const providerWebhookSecret = defineSecret('ORBIT_LEDGER_PROVIDER_WEBHOOK_SECRET');
const razorpayKeyId = defineSecret('RAZORPAY_KEY_ID');
const razorpayKeySecret = defineSecret('RAZORPAY_KEY_SECRET');

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

const db = admin.firestore();

export function normalizeProviderWebhookPayload(body: unknown): ProviderWebhookPayload {
  return normalizePayload(body);
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

export const providerWebhook = onRequest(
  {
    region: 'asia-south1',
    cors: false,
    maxInstances: 20,
    secrets: [providerWebhookSecret],
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
}) {
  const expectedSecret = getExpectedWebhookSecret();
  if (!expectedSecret) {
    return process.env.FUNCTIONS_EMULATOR === 'true';
  }

  const providedSecret = getProvidedWebhookSecret(request);
  return Boolean(providedSecret) && secureEquals(providedSecret, expectedSecret);
}

function getExpectedWebhookSecret(): string {
  try {
    return providerWebhookSecret.value().trim();
  } catch {
    return process.env.ORBIT_LEDGER_PROVIDER_WEBHOOK_SECRET?.trim() ?? '';
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

async function verifyRequestUserId(request: { header(name: string): string | undefined }): Promise<string | null> {
  const authorization = request.header('authorization') ?? '';
  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  try {
    const token = authorization.slice(7).trim();
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken.uid;
  } catch {
    return null;
  }
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

function getSecretValue(secret: ReturnType<typeof defineSecret>, fallbackName: string): string {
  try {
    return secret.value().trim();
  } catch {
    return process.env[fallbackName]?.trim() ?? '';
  }
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
