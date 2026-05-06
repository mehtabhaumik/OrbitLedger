import {
  getOrbitLedgerPaidPlan,
  getOrbitLedgerPaidPlanByProductId,
  getOrbitLedgerPaidPlansForCountry,
  type OrbitLedgerPaidPlanId,
} from '@orbit-ledger/core';

import type { CountryPackProductId, SubscriptionPlanId, SubscriptionProductId } from './types';

export type ProPlanCatalogItem = {
  id: SubscriptionPlanId;
  tier: 'plus' | 'pro' | 'office';
  productId: SubscriptionProductId;
  title: string;
  price: string;
  cadence: string;
  helper: string;
  entitlementDays: number;
  isBestValue: boolean;
};

export const SUBSCRIPTION_PLAN_CATALOG: ProPlanCatalogItem[] = getOrbitLedgerPaidPlansForCountry('IN').map((plan) => ({
  id: plan.id,
  tier: plan.tier,
  productId: plan.productId,
  title: plan.label,
  price: plan.price.display,
  cadence: plan.billingInterval === 'monthly' ? 'per month' : 'per year',
  helper: plan.helper,
  entitlementDays: plan.entitlementDays,
  isBestValue: plan.isBestValue,
}));

export function getSubscriptionPlanCatalogForCountry(countryCode: string | null | undefined): ProPlanCatalogItem[] {
  return getOrbitLedgerPaidPlansForCountry(countryCode).map((plan) => ({
    id: plan.id,
    tier: plan.tier,
    productId: plan.productId,
    title: plan.label,
    price: plan.price.display,
    cadence: plan.billingInterval === 'monthly' ? 'per month' : 'per year',
    helper: plan.helper,
    entitlementDays: plan.entitlementDays,
    isBestValue: plan.isBestValue,
  }));
}

export const PRO_PLAN_CATALOG: ProPlanCatalogItem[] = SUBSCRIPTION_PLAN_CATALOG.filter(
  (plan) => plan.tier === 'pro'
);

export type CountryPackCatalogItem = {
  countryCode: 'US' | 'GB';
  productId: CountryPackProductId;
  title: string;
  fallbackPrice: string;
  availability: 'upcoming';
  availabilityLabel: string;
  helper: string;
};

export const COUNTRY_PACK_PRODUCT_CATALOG: CountryPackCatalogItem[] = [
  {
    countryCode: 'US',
    productId: 'com.rudraix.orbitledger.countrypack.us',
    title: 'United States Country Pack',
    fallbackPrice: 'Coming soon',
    availability: 'upcoming',
    availabilityLabel: 'Upcoming',
    helper: 'Sales tax labels, document wording, and review summaries for US businesses.',
  },
  {
    countryCode: 'GB',
    productId: 'com.rudraix.orbitledger.countrypack.uk',
    title: 'United Kingdom Country Pack',
    fallbackPrice: 'Coming soon',
    availability: 'upcoming',
    availabilityLabel: 'Upcoming',
    helper: 'VAT labels, document wording, and review summaries for UK businesses.',
  },
];

export const SUBSCRIPTION_PRODUCT_IDS = SUBSCRIPTION_PLAN_CATALOG.map((plan) => plan.productId);

export const PRO_SUBSCRIPTION_PRODUCT_IDS = SUBSCRIPTION_PRODUCT_IDS;

export const COUNTRY_PACK_STORE_PRODUCT_IDS = COUNTRY_PACK_PRODUCT_CATALOG.map(
  (product) => product.productId
);

export function getProPlan(planId: SubscriptionPlanId): ProPlanCatalogItem {
  const plan = SUBSCRIPTION_PLAN_CATALOG.find((catalogPlan) => catalogPlan.id === planId);
  if (!plan) {
    throw new Error(`Unknown Pro plan: ${planId}`);
  }

  return plan;
}

export function getProPlanByProductId(
  productId: string
): ProPlanCatalogItem | null {
  const sharedPlan = getOrbitLedgerPaidPlanByProductId(productId);
  if (!sharedPlan) {
    return null;
  }
  return SUBSCRIPTION_PLAN_CATALOG.find((plan) => plan.id === sharedPlan.id) ?? null;
}

export function getCountryPackProduct(
  countryCode: string
): CountryPackCatalogItem | null {
  const normalizedCountryCode = countryCode.trim().toUpperCase();
  return (
    COUNTRY_PACK_PRODUCT_CATALOG.find((product) => product.countryCode === normalizedCountryCode) ??
    null
  );
}

export function getCountryPackByProductId(
  productId: string
): CountryPackCatalogItem | null {
  return COUNTRY_PACK_PRODUCT_CATALOG.find((product) => product.productId === productId) ?? null;
}

export function calculatePlanValidUntil(
  plan: ProPlanCatalogItem,
  from: Date = new Date()
): string {
  const validUntil = new Date(from);
  validUntil.setDate(validUntil.getDate() + plan.entitlementDays);
  return validUntil.toISOString();
}

export function getSubscriptionPlanTier(planId: SubscriptionPlanId): 'plus' | 'pro' | 'office' {
  return getOrbitLedgerPaidPlan(planId as OrbitLedgerPaidPlanId).tier;
}
