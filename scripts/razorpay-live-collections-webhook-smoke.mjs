#!/usr/bin/env node

import { createHmac } from 'node:crypto';

const projectId = process.env.ORBIT_LEDGER_FIREBASE_PROJECT_ID || 'orbit-ledger-f41c2';
const region = process.env.ORBIT_LEDGER_FUNCTION_REGION || 'asia-south1';
const webhookUrl =
  process.env.ORBIT_LEDGER_LIVE_COLLECTIONS_WEBHOOK_URL ||
  `https://${region}-${projectId}.cloudfunctions.net/razorpayLiveCollectionsWebhook`;
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim() ?? '';

async function main() {
  if (!webhookSecret || ['not_configured', 'placeholder', 'todo'].includes(webhookSecret.toLowerCase())) {
    throw new Error(
      [
        'RAZORPAY_WEBHOOK_SECRET must be provided locally to sign the Live Collections smoke payload.',
        'Use the same test webhook secret that is stored in Firebase Secret Manager.',
      ].join('\n')
    );
  }

  console.log(`Live Collections webhook smoke target: ${webhookUrl}`);
  await assertMethodGuard();
  await assertUnsignedRequestRejected();
  await assertSignedPayloadAcceptedToWorkspaceBoundary();
}

async function assertMethodGuard() {
  const response = await fetch(webhookUrl, { method: 'GET' });
  const body = await safeJson(response);
  if (response.status !== 405 || body?.error !== 'method_not_allowed') {
    throw new Error(`Expected GET 405 method_not_allowed, got ${response.status} ${JSON.stringify(body)}`);
  }
  console.log('PASS: Live Collections webhook rejects wrong methods.');
}

async function assertUnsignedRequestRejected() {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildCapturePayload()),
  });
  const body = await safeJson(response);
  if (response.status !== 401 || body?.error !== 'unauthorized') {
    throw new Error(`Expected unsigned POST 401 unauthorized, got ${response.status} ${JSON.stringify(body)}`);
  }
  console.log('PASS: Live Collections webhook rejects unsigned calls.');
}

async function assertSignedPayloadAcceptedToWorkspaceBoundary() {
  const payload = buildCapturePayload();
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
  if (response.status !== 404 || body?.error !== 'workspace_not_found' || !body?.eventId) {
    throw new Error(`Expected signed payload to pass verification and stop at missing workspace, got ${response.status} ${JSON.stringify(body)}`);
  }
  console.log('PASS: signed Live Collections webhook passed signature/payload validation and stopped before ledger writes.');
}

function buildCapturePayload() {
  const suffix = Date.now().toString(36);
  return {
    id: `evt_live_smoke_${suffix}`,
    entity: 'event',
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: `pay_live_smoke_${suffix}`,
          amount: 177000,
          currency: 'INR',
          status: 'captured',
          order_id: `order_live_smoke_${suffix}`,
          method: 'upi',
          created_at: Math.floor(Date.now() / 1000),
          notes: {
            orbit_workspace_id: `missing_live_collections_smoke_${suffix}`,
            orbit_invoice_id: `invoice_live_smoke_${suffix}`,
            orbit_invoice_version_id: `version_live_smoke_${suffix}`,
            orbit_invoice_number: `LIVE-SMOKE-${suffix.toUpperCase()}`,
            orbit_customer_id: `customer_live_smoke_${suffix}`,
          },
        },
      },
    },
  };
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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
