#!/usr/bin/env node

import { createHmac } from 'node:crypto';

const projectId = process.env.ORBIT_LEDGER_FIREBASE_PROJECT_ID || 'orbit-ledger-f41c2';
const apiKey =
  process.env.ORBIT_LEDGER_FIREBASE_API_KEY ||
  process.env.NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_API_KEY ||
  'AIzaSyDE11IwIDmLsI5bbXl6j5GWHEt5FhLK25w';
const region = process.env.ORBIT_LEDGER_FUNCTION_REGION || 'asia-south1';
const webhookUrl =
  process.env.ORBIT_LEDGER_PROVIDER_WEBHOOK_URL ||
  `https://${region}-${projectId}.cloudfunctions.net/providerWebhook`;
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() ?? '';
const keepSandbox = new Set(process.argv.slice(2)).has('--keep');

const now = Date.now();
const suffix = now.toString(36);
const email = `razorpay-capture-${suffix}@orbitledger.test`;
const password = `Capture-${suffix}-${Math.random().toString(36).slice(2)}!`;
const workspaceId = `sandbox_razorpay_capture_${now}`;
const customerId = `customer_${suffix}`;
const invoiceId = `invoice_${suffix}`;
const invoiceNumber = `CAPTURE-${suffix.toUpperCase()}`;
const providerPaymentId = `pay_capture_${suffix}`;
const providerReference = `order_capture_${suffix}`;
const amount = 1770;

let idToken = null;
let localId = null;

async function main() {
  if (!webhookSecret || ['not_configured', 'placeholder', 'todo'].includes(webhookSecret.toLowerCase())) {
    throw new Error(
      [
        'RAZORPAY_WEBHOOK_SECRET must be provided locally to sign the capture smoke payload.',
        'Use the same test webhook secret that is stored in Firebase Secret Manager.',
      ].join('\n')
    );
  }

  console.log(`Razorpay capture smoke target: ${webhookUrl}`);
  try {
    const signUp = await createSmokeUser();
    idToken = signUp.idToken;
    localId = signUp.localId;
    await createSandboxData();
    await sendSignedCaptureWebhook();
    await verifyInvoicePaid();
  } finally {
    if (!keepSandbox) {
      await cleanupSandbox();
    } else {
      console.log(`Kept sandbox workspace ${workspaceId}`);
    }
  }
}

async function createSmokeUser() {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const body = await safeJson(response);
  if (!response.ok || !body?.idToken || !body?.localId) {
    throw new Error(`Could not create smoke user: ${response.status} ${JSON.stringify(body)}`);
  }
  console.log('PASS: smoke user created.');
  return body;
}

async function createSandboxData() {
  const isoNow = new Date(now).toISOString();
  await writeDocument(`workspaces/${workspaceId}`, {
    owner_uid: localId,
    owner_email: email,
    business_name: 'Orbit Ledger Capture Smoke',
    currency: 'INR',
    country_code: 'IN',
    created_at: isoNow,
    last_modified: isoNow,
  });
  await writeDocument(`workspaces/${workspaceId}/customers/${customerId}`, {
    name: 'Capture Customer',
    phone: '+919999999999',
    current_balance: amount,
    created_at: isoNow,
    updated_at: isoNow,
    last_modified: isoNow,
    server_revision: 1,
  });
  await writeDocument(`workspaces/${workspaceId}/invoices/${invoiceId}`, {
    customer_id: customerId,
    customer_name: 'Capture Customer',
    invoice_number: invoiceNumber,
    issue_date: isoNow.slice(0, 10),
    due_date: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    subtotal: 1500,
    tax_amount: 270,
    total_amount: amount,
    paid_amount: 0,
    status: 'issued',
    document_state: 'created',
    payment_status: 'unpaid',
    version_number: 1,
    created_at: isoNow,
    last_modified: isoNow,
    server_revision: 1,
  });
  console.log(`PASS: sandbox workspace and invoice created (${workspaceId}).`);
}

async function sendSignedCaptureWebhook() {
  const payload = {
    entity: 'event',
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: providerPaymentId,
          amount: amount * 100,
          currency: 'INR',
          status: 'captured',
          order_id: providerReference,
          method: 'upi',
          contact: '+919999999999',
          vpa: 'customer@upi',
          created_at: Math.floor(now / 1000),
          notes: {
            orbit_workspace_id: workspaceId,
            orbit_invoice_id: invoiceId,
            orbit_invoice_number: invoiceNumber,
            orbit_customer_id: customerId,
            customer_name: 'Capture Customer',
          },
        },
      },
    },
  };
  const rawBody = JSON.stringify(payload);
  const signature = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Razorpay-Signature': signature,
    },
    body: rawBody,
  });
  const body = await safeJson(response);
  if (response.status !== 200 || body?.ok !== true || body?.applied !== true) {
    throw new Error(`Capture webhook was not applied: ${response.status} ${JSON.stringify(body)}`);
  }
  console.log('PASS: signed Razorpay capture webhook applied.');
}

async function verifyInvoicePaid() {
  const [invoiceDocument, customerDocument] = await Promise.all([
    readDocument(`workspaces/${workspaceId}/invoices/${invoiceId}`),
    readDocument(`workspaces/${workspaceId}/customers/${customerId}`),
  ]);
  const invoice = fromFirestoreFields(invoiceDocument.fields ?? {});
  const customer = fromFirestoreFields(customerDocument.fields ?? {});
  if (invoice.paid_amount !== amount || invoice.payment_status !== 'paid') {
    throw new Error(`Invoice was not marked paid: ${JSON.stringify(invoice)}`);
  }
  if (customer.current_balance !== 0) {
    throw new Error(`Customer balance was not cleared: ${JSON.stringify(customer)}`);
  }
  console.log('PASS: invoice paid amount/status and customer balance updated.');
}

async function cleanupSandbox() {
  if (idToken) {
    await deleteDocument(`workspaces/${workspaceId}/transactions/txn_razorpay_${providerPaymentId}`);
    await deleteDocument(`workspaces/${workspaceId}/payment_allocations/pal_razorpay_${providerPaymentId}`);
    await deleteDocument(`workspaces/${workspaceId}/payment_provider_events/razorpay_${providerPaymentId}`);
    await deleteDocument(`workspaces/${workspaceId}/invoices/${invoiceId}`);
    await deleteDocument(`workspaces/${workspaceId}/customers/${customerId}`);
    await deleteDocument(`workspaces/${workspaceId}`);
    await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
  }
  console.log('PASS: sandbox cleanup completed.');
}

async function writeDocument(path, data) {
  const response = await fetch(firestoreDocumentUrl(path), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });
  const body = await safeJson(response);
  if (!response.ok) {
    throw new Error(`Could not write ${path}: ${response.status} ${JSON.stringify(body)}`);
  }
}

async function readDocument(path) {
  const response = await fetch(firestoreDocumentUrl(path), {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const body = await safeJson(response);
  if (!response.ok) {
    throw new Error(`Could not read ${path}: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

async function deleteDocument(path) {
  const response = await fetch(firestoreDocumentUrl(path), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (![200, 404].includes(response.status)) {
    const body = await safeJson(response);
    console.warn(`WARN: cleanup could not delete ${path}: ${response.status} ${JSON.stringify(body)}`);
  }
}

function firestoreDocumentUrl(path) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`;
}

function toFirestoreFields(data) {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, toFirestoreValue(value)]));
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }
  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  return { stringValue: String(value) };
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

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await cleanupSandbox().catch(() => undefined);
  process.exit(1);
});
