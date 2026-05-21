'use client';

import type { OrbitLedgerPaidPlanId } from '@orbit-ledger/core';

import { getWebAuth, getWebFirebaseProjectId } from './firebase';
import type { WebPlatformAdminOffer, WebPlatformAdminOfferPlanPrice } from './platform-admin';
import type { WebPlanCatalogItem } from './web-monetization';

export type WebEligiblePlatformOffersResponse = {
  generatedAt: string;
  offers: WebPlatformAdminOffer[];
};

export type WebPlanOfferResolution = {
  offer: WebPlatformAdminOffer;
  price: WebPlatformAdminOfferPlanPrice;
};

export async function loadEligiblePlatformOffers(input: {
  workspaceId?: string | null;
}): Promise<WebEligiblePlatformOffersResponse> {
  const user = getWebAuth().currentUser;
  if (!user) {
    return { generatedAt: new Date().toISOString(), offers: [] };
  }

  const token = await user.getIdToken();
  const response = await fetch(getEligiblePlatformOffersUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ workspaceId: input.workspaceId ?? null }),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'eligible_offers_failed',
  }))) as
    | {
        ok: true;
        generatedAt: string;
        offers?: WebPlatformAdminOffer[];
      }
    | {
        ok: false;
        error: string;
      };

  if (!result.ok) {
    return { generatedAt: new Date().toISOString(), offers: [] };
  }

  return {
    generatedAt: result.generatedAt,
    offers: result.offers ?? [],
  };
}

export function resolveWebPlanOffer(
  plan: Pick<WebPlanCatalogItem, 'id' | 'amountMinor'>,
  offers: WebPlatformAdminOffer[]
): WebPlanOfferResolution | null {
  const eligible = offers
    .flatMap((offer) =>
      (offer.planPrices ?? [])
        .filter((price) => price.planId === plan.id && price.offerAmountMinor < plan.amountMinor)
        .map((price) => ({ offer, price }))
    )
    .sort((left, right) => left.price.offerAmountMinor - right.price.offerAmountMinor);

  return eligible[0] ?? null;
}

export function summarizeActivePlatformOffer(offers: WebPlatformAdminOffer[]): WebPlatformAdminOffer | null {
  return offers.find((offer) => offer.status === 'active') ?? null;
}

export function offerTargetPlanIds(offer: WebPlatformAdminOffer): OrbitLedgerPaidPlanId[] {
  return offer.targetPlanIds.filter((planId): planId is OrbitLedgerPaidPlanId =>
    ['plus_monthly', 'plus_yearly', 'pro_monthly', 'pro_yearly', 'office_monthly', 'office_yearly'].includes(planId)
  );
}

function getEligiblePlatformOffersUrl() {
  const projectId = getWebFirebaseProjectId();
  return `https://asia-south1-${projectId}.cloudfunctions.net/getEligiblePlatformOffers`;
}
