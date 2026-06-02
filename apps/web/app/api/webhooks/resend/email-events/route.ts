import type { NextRequest } from 'next/server';

const defaultEmailEventsWebhookTarget =
  'https://asia-south1-orbit-ledger-f41c2.cloudfunctions.net/receiveSupportInboundEmail';

function getEmailEventsWebhookTarget() {
  return process.env.ORBIT_LEDGER_RESEND_EMAIL_EVENTS_WEBHOOK_TARGET?.trim() || defaultEmailEventsWebhookTarget;
}

function passthroughHeader(request: NextRequest, name: string) {
  const value = request.headers.get(name);
  return value ? { [name]: value } : {};
}

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const upstream = await fetch(getEmailEventsWebhookTarget(), {
    body: payload,
    headers: {
      'Content-Type': request.headers.get('content-type') ?? 'application/json',
      ...passthroughHeader(request, 'svix-id'),
      ...passthroughHeader(request, 'svix-timestamp'),
      ...passthroughHeader(request, 'svix-signature'),
    },
    method: 'POST',
  });

  return new Response(await upstream.text(), {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json; charset=utf-8',
    },
    status: upstream.status,
  });
}

export function GET() {
  return Response.json(
    {
      ok: false,
      error: 'method_not_allowed',
    },
    {
      headers: {
        Allow: 'POST',
        'Cache-Control': 'no-store',
      },
      status: 405,
    }
  );
}
