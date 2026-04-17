import type { CountryPackProductId, SubscriptionPlanId, SubscriptionProductId } from './types';

export type ProPlanCatalogItem = {
  id: SubscriptionPlanId;
  productId: SubscriptionProductId;
  title: string;
  price: string;
  cadence: string;
  helper: string;
  entitlementDays: number;
  isBestValue: boolean;
};

export const PRO_PLAN_CATALOG: ProPlanCatalogItem[] = [
  {
    id: 'pro_monthly',
    productId: 'com.rudraix.orbitledger.pro.monthly',
    title: 'Monthly',
    price: 'INR 199',
    cadence: 'per month',
    helper: 'Flexible Pro access for businesses that share documents regularly.',
    entitlementDays: 30,
    isBestValue: false,
  },
  {
    id: 'pro_yearly',
    productId: 'com.rudraix.orbitledger.pro.yearly',
    title: 'Yearly',
    price: 'INR 1,999',
    cadence: 'per year',
    helper: 'Best value for businesses that rely on Orbit Ledger every week.',
    entitlementDays: 365,
    isBestValue: true,
  },
];

export type CountryPackCatalogItem = {
  countryCode: 'US' | 'GB';
  productId: CountryPackProductId;
  title: string;
  fallbackPrice: string;
  helper: string;
};

export const COUNTRY_PACK_PRODUCT_CATALOG: CountryPackCatalogItem[] = [
  {
    countryCode: 'US',
    productId: 'com.rudraix.orbitledger.countrypack.us',
    title: 'United States Country Pack',
    fallbackPrice: 'USD 9.99',
    helper: 'Sales-tax-ready templates, country package logic, and reports for US businesses.',
  },
  {
    countryCode: 'GB',
    productId: 'com.rudraix.orbitledger.countrypack.uk',
    title: 'United Kingdom Country Pack',
    fallbackPrice: 'GBP 9.99',
    helper: 'VAT-ready templates, tax pack labels, and compliance summaries for UK businesses.',
  },
];

export const PRO_SUBSCRIPTION_PRODUCT_IDS = PRO_PLAN_CATALOG.map((plan) => plan.productId);

export const COUNTRY_PACK_STORE_PRODUCT_IDS = COUNTRY_PACK_PRODUCT_CATALOG.map(
  (product) => product.productId
);

export function getProPlan(planId: SubscriptionPlanId): ProPlanCatalogItem {
  const plan = PRO_PLAN_CATALOG.find((catalogPlan) => catalogPlan.id === planId);
  if (!plan) {
    throw new Error(`Unknown Pro plan: ${planId}`);
  }

  return plan;
}

export function getProPlanByProductId(
  productId: string
): ProPlanCatalogItem | null {
  return PRO_PLAN_CATALOG.find((plan) => plan.productId === productId) ?? null;
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
