'use client';

import { getWebAuth, getWebFirebaseProjectId } from './firebase';

export type RazorpayCheckoutResult = {
  checkoutId: string;
  checkoutUrl: string;
  reference: string;
};

type CreateRazorpayCheckoutInput = {
  workspaceId: string;
  invoiceId: string;
  callbackUrl: string;
};

type CreateRazorpayCheckoutResponse =
  | {
      ok: true;
      checkoutId: string;
      checkoutUrl: string;
      reference: string;
    }
  | {
      ok: false;
      error: string;
      message?: string;
    };

export async function createRazorpayCheckoutLink(
  input: CreateRazorpayCheckoutInput
): Promise<RazorpayCheckoutResult> {
  const user = getWebAuth().currentUser;
  if (!user) {
    throw new Error('Sign in again before creating a checkout link.');
  }

  const token = await user.getIdToken();
  const response = await fetch(getCreateRazorpayCheckoutUrl(), {
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
  }))) as CreateRazorpayCheckoutResponse;

  if (!response.ok || !result.ok) {
    if (!result.ok && result.error === 'provider_not_connected') {
      throw new Error('Razorpay is not connected yet. Use UPI or manual payment details for now.');
    }
    throw new Error(!result.ok && result.message ? result.message : 'Checkout link could not be created.');
  }

  return {
    checkoutId: result.checkoutId,
    checkoutUrl: result.checkoutUrl,
    reference: result.reference,
  };
}

function getCreateRazorpayCheckoutUrl() {
  const projectId = getWebFirebaseProjectId();
  return `https://asia-south1-${projectId}.cloudfunctions.net/createRazorpayCheckout`;
}
