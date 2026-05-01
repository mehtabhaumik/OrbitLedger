#!/usr/bin/env node

const projectId = process.env.ORBIT_LEDGER_FIREBASE_PROJECT_ID || 'orbit-ledger-f41c2';
const apiKey =
  process.env.ORBIT_LEDGER_FIREBASE_API_KEY ||
  process.env.NEXT_PUBLIC_ORBIT_LEDGER_FIREBASE_API_KEY ||
  'AIzaSyDE11IwIDmLsI5bbXl6j5GWHEt5FhLK25w';
const region = process.env.ORBIT_LEDGER_FUNCTION_REGION || 'asia-south1';
const checkoutUrl =
  process.env.ORBIT_LEDGER_RAZORPAY_CHECKOUT_URL ||
  `https://${region}-${projectId}.cloudfunctions.net/createRazorpayCheckout`;
const callbackUrl = process.env.ORBIT_LEDGER_PAYMENT_CALLBACK_URL || `https://${projectId}.web.app/pay/`;
const args = new Set(process.argv.slice(2));
const expectConnected = args.has('--expect-connected');
const keepSandbox = args.has('--keep');

const now = Date.now();
const uidSafeSuffix = now.toString(36);
const email = `razorpay-smoke-${uidSafeSuffix}@orbitledger.test`;
const password = `Smoke-${uidSafeSuffix}-${Math.random().toString(36).slice(2)}!`;
const workspaceId = `sandbox_razorpay_checkout_${now}`;
const customerId = `customer_${uidSafeSuffix}`;
const invoiceId = `invoice_${uidSafeSuffix}`;
const invoiceNumber = `SMOKE-${uidSafeSuffix.toUpperCase()}`;

let idToken = null;
let localId = null;
let checkoutId = null;

async function main() {
  console.log(`Razorpay checkout smoke target: ${checkoutUrl}`);
  await assertMethodGuard();
  await assertUnsignedRequestRejected();

  try {
    const signUp = await createSmokeUser();
    idToken = signUp.idToken;
    localId = signUp.localId;
    await createSandboxData();
    const checkout = await createCheckout();
    await verifyCheckoutResult(checkout);
  } finally {
    if (!keepSandbox) {
      await cleanupSandbox();
    } else {
      console.log(`Kept sandbox workspace ${workspaceId}`);
    }
  }
}

async function assertMethodGuard() {
  const response = await fetch(checkoutUrl, { method: 'GET' });
  const body = await safeJson(response);
  if (response.status !== 405 || body?.error !== 'method_not_allowed') {
    throw new Error(`Expected GET 405 method_not_allowed, got ${response.status} ${JSON.stringify(body)}`);
  }
  console.log('PASS: checkout endpoint rejects wrong methods.');
}

async function assertUnsignedRequestRejected() {
  const response = await fetch(checkoutUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId, invoiceId, callbackUrl }),
  });
  const body = await safeJson(response);
  if (response.status !== 401 || body?.error !== 'unauthorized') {
    throw new Error(`Expected unsigned POST 401 unauthorized, got ${response.status} ${JSON.stringify(body)}`);
  }
  console.log('PASS: checkout endpoint rejects unsigned calls.');
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
  const ownerUid = localId;
  await writeDocument(`workspaces/${workspaceId}`, {
    owner_uid: ownerUid,
    owner_email: email,
    business_name: 'Orbit Ledger Smoke Test',
    currency: 'INR',
    country_code: 'IN',
    created_at: new Date(now).toISOString(),
    last_modified: new Date(now).toISOString(),
  });
  await writeDocument(`workspaces/${workspaceId}/customers/${customerId}`, {
    name: 'Smoke Customer',
    phone: '+919999999999',
    current_balance: 1770,
    created_at: new Date(now).toISOString(),
    updated_at: new Date(now).toISOString(),
    last_modified: new Date(now).toISOString(),
    server_revision: 1,
  });
  await writeDocument(`workspaces/${workspaceId}/invoices/${invoiceId}`, {
    customer_id: customerId,
    customer_name: 'Smoke Customer',
    invoice_number: invoiceNumber,
    issue_date: new Date(now).toISOString().slice(0, 10),
    due_date: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    subtotal: 1500,
    tax_amount: 270,
    total_amount: 1770,
    paid_amount: 0,
    status: 'issued',
    document_state: 'created',
    payment_status: 'unpaid',
    version_number: 1,
    created_at: new Date(now).toISOString(),
    last_modified: new Date(now).toISOString(),
    server_revision: 1,
  });
  console.log(`PASS: sandbox workspace and invoice created (${workspaceId}).`);
}

async function createCheckout() {
  const response = await fetch(checkoutUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ workspaceId, invoiceId, callbackUrl }),
  });
  const body = await safeJson(response);
  console.log(`Checkout response: HTTP ${response.status} ${JSON.stringify(body)}`);
  return { status: response.status, body };
}

async function verifyCheckoutResult(result) {
  if (expectConnected) {
    if (result.status !== 200 || result.body?.ok !== true || !result.body?.checkoutUrl) {
      throw new Error('Expected a live Razorpay checkout link, but checkout creation did not succeed.');
    }
    checkoutId = result.body.checkoutId;
    await readDocument(`workspaces/${workspaceId}/payment_checkouts/${checkoutId}`);
    console.log(`PASS: Razorpay checkout created: ${result.body.checkoutUrl}`);
    return;
  }

  if (result.status === 503 && result.body?.error === 'provider_not_connected') {
    console.log('PASS: Razorpay credentials are not connected yet, and checkout creation failed safely.');
    return;
  }

  if (result.status === 200 && result.body?.ok === true && result.body?.checkoutUrl) {
    checkoutId = result.body.checkoutId;
    await readDocument(`workspaces/${workspaceId}/payment_checkouts/${checkoutId}`);
    console.log(`PASS: Razorpay checkout created: ${result.body.checkoutUrl}`);
    return;
  }

  throw new Error(`Unexpected checkout result: ${result.status} ${JSON.stringify(result.body)}`);
}

async function cleanupSandbox() {
  if (idToken) {
    if (checkoutId) {
      await deleteDocument(`workspaces/${workspaceId}/payment_checkouts/${checkoutId}`);
    }
    await deleteDocument(`workspaces/${workspaceId}/invoices/${invoiceId}`);
    await deleteDocument(`workspaces/${workspaceId}/customers/${customerId}`);
    await deleteDocument(`workspaces/${workspaceId}`);
  }
  if (idToken) {
    await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
  }
  console.log('PASS: sandbox cleanup completed.');
}

async function writeDocument(path, data) {
  const url = firestoreDocumentUrl(path);
  const response = await fetch(url, {
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
