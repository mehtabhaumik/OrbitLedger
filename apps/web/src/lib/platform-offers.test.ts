import { describe, expect, it } from 'vitest';

import type { WebPlatformAdminOffer } from './platform-admin';
import { resolveWebPlanOffer, summarizeActivePlatformOffer } from './platform-offers';

const activeOffer: WebPlatformAdminOffer = {
  id: 'offer_1',
  label: 'Launch Offer',
  title: 'Launch pricing',
  publicBannerMessage: 'Launch pricing is available.',
  internalNote: null,
  scope: 'sitewide',
  discountType: 'percentage',
  discountValue: 20,
  currency: null,
  targetEmails: [],
  targetUids: [],
  targetWorkspaceIds: [],
  targetPlanIds: ['pro_yearly'],
  targetCountries: [],
  startAt: null,
  expiresAt: '2026-06-21T00:00:00.000Z',
  status: 'active',
  lifetimeConfirmed: false,
  createdAt: null,
  createdByUid: null,
  createdByEmail: null,
  updatedAt: null,
  updatedByUid: null,
  updatedByEmail: null,
  lastReason: null,
  planPrices: [
    {
      planId: 'pro_yearly',
      originalAmountMinor: 199900,
      originalAmountDisplay: '₹1,999',
      offerAmountMinor: 159920,
      offerAmountDisplay: '₹1,599.20',
      currency: 'INR',
    },
  ],
};

describe('platform offer web helpers', () => {
  it('selects the lowest eligible offer price for a plan', () => {
    const betterOffer = {
      ...activeOffer,
      id: 'offer_2',
      label: 'Founder Offer',
      planPrices: [
        {
          planId: 'pro_yearly',
          originalAmountMinor: 199900,
          originalAmountDisplay: '₹1,999',
          offerAmountMinor: 129900,
          offerAmountDisplay: '₹1,299',
          currency: 'INR',
        },
      ],
    };

    expect(resolveWebPlanOffer({ id: 'pro_yearly', amountMinor: 199900 }, [activeOffer, betterOffer])).toMatchObject({
      offer: { id: 'offer_2' },
      price: { offerAmountMinor: 129900 },
    });
  });

  it('ignores offers that do not reduce the plan price', () => {
    expect(
      resolveWebPlanOffer(
        { id: 'pro_yearly', amountMinor: 199900 },
        [
          {
            ...activeOffer,
            planPrices: [{ ...activeOffer.planPrices![0], offerAmountMinor: 199900 }],
          },
        ]
      )
    ).toBeNull();
  });

  it('summarizes the first active offer for dashboard banners', () => {
    expect(summarizeActivePlatformOffer([{ ...activeOffer, status: 'scheduled' }, activeOffer])).toMatchObject({
      id: 'offer_1',
    });
  });

  it('does not apply expired offers to banner or checkout pricing', () => {
    const expiredOffer = {
      ...activeOffer,
      id: 'offer_expired',
      status: 'expired' as const,
      planPrices: [
        {
          ...activeOffer.planPrices![0],
          offerAmountMinor: 109900,
          offerAmountDisplay: '₹1,099',
        },
      ],
    };

    expect(resolveWebPlanOffer({ id: 'pro_yearly', amountMinor: 199900 }, [expiredOffer])).toBeNull();
    expect(summarizeActivePlatformOffer([expiredOffer])).toBeNull();
  });
});
