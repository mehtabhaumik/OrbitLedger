#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const projectId = process.env.ORBIT_LEDGER_FIREBASE_PROJECT_ID || 'orbit-ledger-f41c2';
const accessToken = process.env.ORBIT_LEDGER_FIRESTORE_ADMIN_ACCESS_TOKEN?.trim() || '';
const args = parseArgs(process.argv.slice(2));
const proofFile = args.proofFile || process.env.ORBIT_LEDGER_RAZORPAY_SANDBOX_PROOF_FILE || '';

async function main() {
  if (!accessToken) {
    throw new Error('ORBIT_LEDGER_FIRESTORE_ADMIN_ACCESS_TOKEN is required to verify sandbox payment proof.');
  }
  if (!proofFile) {
    throw new Error('Provide --proof-file=/path/to/proof.json created by the checkout smoke with --keep.');
  }

  const proof = await readProofFile(proofFile);
  validateProof(proof);

  const [
    invoice,
    customer,
    checkout,
    events,
    transactions,
    allocations,
    notifications,
    receipts,
    audits,
    followUps,
  ] = await Promise.all([
    readDocument(`workspaces/${proof.workspaceId}/invoices/${proof.invoiceId}`),
    readDocument(`workspaces/${proof.workspaceId}/customers/${proof.customerId}`),
    readDocument(`workspaces/${proof.workspaceId}/payment_checkouts/${proof.checkoutId}`),
    queryDocuments(`workspaces/${proof.workspaceId}/live_payment_events`, 'invoice_id', proof.invoiceId),
    queryDocuments(`workspaces/${proof.workspaceId}/transactions`, 'invoice_id', proof.invoiceId),
    queryDocuments(`workspaces/${proof.workspaceId}/payment_allocations`, 'invoice_id', proof.invoiceId),
    queryDocuments(`workspaces/${proof.workspaceId}/live_payment_notifications`, 'invoice_id', proof.invoiceId),
    queryDocuments(`workspaces/${proof.workspaceId}/live_payment_receipts`, 'invoice_id', proof.invoiceId),
    queryDocuments(`workspaces/${proof.workspaceId}/live_payment_audit`, 'invoice_id', proof.invoiceId),
    queryDocuments(`workspaces/${proof.workspaceId}/live_follow_up_automation`, 'invoice_id', proof.invoiceId),
  ]);

  const result = buildProofResult({
    proof,
    invoice,
    customer,
    checkout,
    events,
    transactions,
    allocations,
    notifications,
    receipts,
    audits,
    followUps,
  });

  console.log(JSON.stringify(result, null, 2));
  if (result.blockers.length > 0) {
    throw new Error(`Sandbox payment proof failed: ${result.blockers.join('; ')}`);
  }

  console.log('PASS: Razorpay sandbox payment proof is complete.');
}

function buildProofResult(input) {
  const invoice = input.invoice.fields;
  const customer = input.customer.fields;
  const checkout = input.checkout.fields;
  const paidAmount = numberValue(invoice.paid_amount);
  const totalAmount = numberValue(invoice.total_amount);
  const customerBalance = numberValue(customer.current_balance);
  const blockers = [];

  if (checkout.provider !== 'razorpay') {
    blockers.push('Checkout provider is not Razorpay.');
  }
  if (checkout.provider_status !== 'captured') {
    blockers.push('Payment checkout is not captured.');
  }
  if (!['paid', 'partially_paid'].includes(String(invoice.payment_status ?? ''))) {
    blockers.push('Invoice payment status was not derived to paid or partially paid.');
  }
  if (paidAmount <= 0 || paidAmount > totalAmount) {
    blockers.push('Invoice paid amount is not valid after sandbox payment.');
  }
  if (customerBalance >= input.proof.amount) {
    blockers.push('Customer balance did not reduce after sandbox payment.');
  }
  if (!input.events.some((entry) => entry.fields.processing_status === 'reconciled')) {
    blockers.push('No reconciled live payment event found.');
  }
  if (input.transactions.length !== 1) {
    blockers.push(`Expected exactly one transaction, found ${input.transactions.length}.`);
  }
  if (input.allocations.length !== 1) {
    blockers.push(`Expected exactly one allocation, found ${input.allocations.length}.`);
  }
  if (!input.notifications.some((entry) => entry.fields.kind === 'payment_received')) {
    blockers.push('Payment received notification was not created.');
  }
  if (input.receipts.length < 1) {
    blockers.push('Payment receipt was not created.');
  }
  if (!input.audits.some((entry) => entry.fields.action === 'payment_applied')) {
    blockers.push('Payment applied audit entry was not created.');
  }
  if (input.followUps.length < 1) {
    blockers.push('Follow-up automation stop/update record was not created.');
  }

  return {
    ok: blockers.length === 0,
    checkedAt: new Date().toISOString(),
    projectId,
    workspaceId: input.proof.workspaceId,
    invoiceId: input.proof.invoiceId,
    checkoutId: input.proof.checkoutId,
    invoicePaymentStatus: invoice.payment_status ?? null,
    paidAmount,
    totalAmount,
    customerBalance,
    counts: {
      events: input.events.length,
      transactions: input.transactions.length,
      allocations: input.allocations.length,
      notifications: input.notifications.length,
      receipts: input.receipts.length,
      audits: input.audits.length,
      followUps: input.followUps.length,
    },
    blockers,
  };
}

async function readProofFile(path) {
  const parsed = JSON.parse(await readFile(path, 'utf8'));
  return {
    workspaceId: stringValue(parsed.workspaceId),
    customerId: stringValue(parsed.customerId),
    invoiceId: stringValue(parsed.invoiceId),
    checkoutId: stringValue(parsed.checkoutId),
    checkoutUrl: stringValue(parsed.checkoutUrl),
    amount: numberValue(parsed.amount),
    currency: stringValue(parsed.currency) || 'INR',
  };
}

function validateProof(proof) {
  const missing = ['workspaceId', 'customerId', 'invoiceId', 'checkoutId', 'checkoutUrl'].filter((key) => !proof[key]);
  if (missing.length > 0) {
    throw new Error(`Proof file is missing: ${missing.join(', ')}`);
  }
  if (!proof.checkoutUrl.startsWith('https://')) {
    throw new Error('Proof checkout URL must be HTTPS.');
  }
  if (proof.amount <= 0) {
    throw new Error('Proof amount must be greater than zero.');
  }
}

async function readDocument(path) {
  const response = await fetch(firestoreDocumentUrl(path), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await safeJson(response);
  if (!response.ok) {
    throw new Error(`Could not read ${path}: ${response.status} ${JSON.stringify(body)}`);
  }
  return {
    name: body.name,
    fields: fromFirestoreFields(body.fields ?? {}),
  };
}

async function queryDocuments(parentPath, fieldName, fieldValue) {
  const parentSegments = parentPath.split('/');
  const collectionId = parentSegments.pop();
  const parent = parentSegments.join('/');
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${parent}:runQuery`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId }],
          where: {
            fieldFilter: {
              field: { fieldPath: fieldName },
              op: 'EQUAL',
              value: { stringValue: fieldValue },
            },
          },
          limit: 20,
        },
      }),
    }
  );
  const body = await safeJson(response);
  if (!response.ok) {
    throw new Error(`Could not query ${parentPath}: ${response.status} ${JSON.stringify(body)}`);
  }
  return Array.isArray(body)
    ? body
        .filter((entry) => entry.document)
        .map((entry) => ({
          name: entry.document.name,
          fields: fromFirestoreFields(entry.document.fields ?? {}),
        }))
    : [];
}

function firestoreDocumentUrl(path) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`;
}

function fromFirestoreFields(fields) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, fromFirestoreValue(value)]));
}

function fromFirestoreValue(value) {
  if ('stringValue' in value) {
    return value.stringValue;
  }
  if ('integerValue' in value) {
    return Number(value.integerValue);
  }
  if ('doubleValue' in value) {
    return Number(value.doubleValue);
  }
  if ('booleanValue' in value) {
    return Boolean(value.booleanValue);
  }
  if ('nullValue' in value) {
    return null;
  }
  if ('arrayValue' in value) {
    return (value.arrayValue.values ?? []).map(fromFirestoreValue);
  }
  if ('mapValue' in value) {
    return fromFirestoreFields(value.mapValue.fields ?? {});
  }
  return null;
}

async function safeJson(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function stringValue(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberValue(value) {
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
    if (value.startsWith('--proof-file=')) {
      parsed.proofFile = value.slice('--proof-file='.length).trim();
    }
  }
  return parsed;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
