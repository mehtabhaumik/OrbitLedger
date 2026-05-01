import { Platform } from 'react-native';
import {
  endConnection,
  fetchProducts,
  finishTransaction,
  getActiveSubscriptions,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  restorePurchases,
  type ActiveSubscription,
  type Product,
  type ProductSubscription,
  type Purchase,
} from 'expo-iap';

import { getDatabase } from '../database/client';
import {
  COUNTRY_PACK_PRODUCT_CATALOG,
  COUNTRY_PACK_STORE_PRODUCT_IDS,
  PRO_PLAN_CATALOG,
  PRO_SUBSCRIPTION_PRODUCT_IDS,
  getCountryPackByProductId,
  getCountryPackProduct,
  getProPlan,
  getProPlanByProductId,
} from './products';
import { getSubscriptionStatus, saveSubscriptionStatus } from './subscription';
import type {
  BillingProductId,
  CountryPackEntitlement,
  CountryPackProductId,
  SubscriptionPlanId,
  SubscriptionProductId,
  SubscriptionStatus,
} from './types';

type PreferenceRow = {
  value: string;
};

export type StoreProductDetails = {
  productId: BillingProductId;
  title: string;
  description: string;
  displayPrice: string;
  type: 'subs' | 'in-app';
};

export type BillingProductDetails = {
  subscriptions: StoreProductDetails[];
  countryPacks: StoreProductDetails[];
};

export type BillingRefreshResult = {
  available: boolean;
  message: string;
  subscriptionStatus: SubscriptionStatus;
  countryPackEntitlements: CountryPackEntitlement[];
};

export type BillingPurchaseResult =
  | {
      status: 'started';
      message: string;
      subscriptionStatus?: SubscriptionStatus;
      countryPackEntitlements?: CountryPackEntitlement[];
    }
  | {
      status: 'pending';
      message: string;
      subscriptionStatus?: SubscriptionStatus;
      countryPackEntitlements?: CountryPackEntitlement[];
    }
  | {
      status: 'completed';
      message: string;
      subscriptionStatus?: SubscriptionStatus;
      countryPackEntitlements?: CountryPackEntitlement[];
    };

const COUNTRY_PACK_ENTITLEMENTS_KEY = 'monetization_country_pack_entitlements';
const BILLING_LAST_REFRESH_KEY = 'monetization_billing_last_refresh';

let connectionPromise: Promise<boolean> | null = null;
let listenersAttached = false;

export async function initializeBilling(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  if (!connectionPromise) {
    connectionPromise = initConnection()
      .then(() => {
        attachBillingListeners();
        return true;
      })
      .catch((error) => {
        console.warn('[billing] Store billing connection failed', error);
        connectionPromise = null;
        return false;
      });
  }

  return connectionPromise;
}

export async function shutdownBilling(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  try {
    await endConnection();
  } catch (error) {
    console.warn('[billing] Store billing shutdown failed', error);
  } finally {
    connectionPromise = null;
  }
}

export async function refreshBillingEntitlements(): Promise<BillingRefreshResult> {
  const currentStatus = await getSubscriptionStatus();
  const currentCountryPacks = await getCountryPackEntitlements();
  const available = await initializeBilling();

  if (!available) {
    return {
      available: false,
      message: 'Store billing is not available in this runtime. A production or development build is required.',
      subscriptionStatus: currentStatus,
      countryPackEntitlements: currentCountryPacks,
    };
  }

  try {
    const [activeSubscriptions, availablePurchases] = await Promise.all([
      getActiveSubscriptions(PRO_SUBSCRIPTION_PRODUCT_IDS),
      getAvailablePurchases({
        includeSuspendedAndroid: false,
        onlyIncludeActiveItemsIOS: true,
      }),
    ]);

    const subscriptionStatus = await applyActiveSubscriptionEntitlement(activeSubscriptions);
    const countryPackEntitlements = await applyCountryPackEntitlements(
      availablePurchases,
      'restore_cache'
    );
    await setPreference(BILLING_LAST_REFRESH_KEY, new Date().toISOString());

    return {
      available: true,
      message: 'Store purchases and entitlements were refreshed.',
      subscriptionStatus,
      countryPackEntitlements,
    };
  } catch (error) {
    console.warn('[billing] Entitlement refresh failed', error);
    return {
      available: true,
      message: 'Store access could not be refreshed. Your current access was kept.',
      subscriptionStatus: currentStatus,
      countryPackEntitlements: currentCountryPacks,
    };
  }
}

export async function restoreStorePurchases(): Promise<BillingRefreshResult> {
  const available = await initializeBilling();
  if (!available) {
    const status = await getSubscriptionStatus();
    return {
      available: false,
      message: 'Store restore is only available in a native app build.',
      subscriptionStatus: status,
      countryPackEntitlements: await getCountryPackEntitlements(),
    };
  }

  try {
    await restorePurchases();
  } catch (error) {
    console.warn('[billing] Native restore call failed; querying purchases anyway', error);
  }

  return refreshBillingEntitlements();
}

export async function loadBillingProductDetails(): Promise<BillingProductDetails> {
  const available = await initializeBilling();
  if (!available) {
    return {
      subscriptions: PRO_PLAN_CATALOG.map((plan) => ({
        productId: plan.productId,
        title: plan.title,
        description: plan.helper,
        displayPrice: plan.price,
        type: 'subs',
      })),
      countryPacks: COUNTRY_PACK_PRODUCT_CATALOG.map((product) => ({
        productId: product.productId,
        title: product.title,
        description: product.helper,
        displayPrice: product.fallbackPrice,
        type: 'in-app',
      })),
    };
  }

  try {
    const [subscriptions, countryPacks] = await Promise.all([
      fetchProducts({ skus: PRO_SUBSCRIPTION_PRODUCT_IDS, type: 'subs' }),
      fetchProducts({ skus: COUNTRY_PACK_STORE_PRODUCT_IDS, type: 'in-app' }),
    ]);

    return {
      subscriptions: normalizeStoreProducts(subscriptions, 'subs'),
      countryPacks: normalizeStoreProducts(countryPacks, 'in-app'),
    };
  } catch (error) {
    console.warn('[billing] Product detail query failed', error);
    return {
      subscriptions: [],
      countryPacks: [],
    };
  }
}

export async function purchaseProPlan(
  planId: SubscriptionPlanId
): Promise<BillingPurchaseResult> {
  const plan = getProPlan(planId);
  const available = await initializeBilling();

  if (!available) {
    throw new Error('Store billing is not available in this runtime.');
  }

  const subscriptionProduct = await getStoreSubscription(plan.productId);
  const offerToken = getAndroidSubscriptionOfferToken(subscriptionProduct);

  const result = await requestPurchase({
    type: 'subs',
    request: {
      apple: {
        sku: plan.productId,
      },
      google: {
        skus: [plan.productId],
        subscriptionOffers: offerToken
          ? [
              {
                sku: plan.productId,
                offerToken,
              },
            ]
          : undefined,
      },
    },
  });

  return handlePurchaseRequestResult(result);
}

export async function purchaseCountryPack(
  countryCode: string
): Promise<BillingPurchaseResult> {
  const product = getCountryPackProduct(countryCode);
  if (!product) {
    throw new Error(`No country pack product is configured for ${countryCode}.`);
  }
  if (product.availability === 'upcoming') {
    throw new Error(`${product.title} is coming soon.`);
  }

  const available = await initializeBilling();
  if (!available) {
    throw new Error('Store billing is not available in this runtime.');
  }

  await assertStoreProductAvailable(product.productId, 'in-app');

  const result = await requestPurchase({
    type: 'in-app',
    request: {
      apple: {
        sku: product.productId,
      },
      google: {
        skus: [product.productId],
      },
    },
  });

  return handlePurchaseRequestResult(result);
}

export async function getCountryPackEntitlements(): Promise<CountryPackEntitlement[]> {
  const raw = await getPreference(COUNTRY_PACK_ENTITLEMENTS_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as CountryPackEntitlement[];
    return parsed.filter(isValidCountryPackEntitlement);
  } catch {
    return [];
  }
}

export async function hasCountryPackEntitlement(countryCode: string): Promise<boolean> {
  const normalizedCountryCode = countryCode.trim().toUpperCase();
  const entitlements = await getCountryPackEntitlements();
  return entitlements.some((entitlement) => entitlement.countryCode === normalizedCountryCode);
}

export async function getBillingLastRefreshAt(): Promise<string | null> {
  return getPreference(BILLING_LAST_REFRESH_KEY);
}

function attachBillingListeners(): void {
  if (listenersAttached) {
    return;
  }

  purchaseUpdatedListener((purchase) => {
    void processStorePurchase(purchase, 'purchase_cache').catch((error) => {
      console.warn('[billing] Purchase update could not be processed', error);
    });
  });

  purchaseErrorListener((error) => {
    if (isUserCancellation(error)) {
      console.info('[billing] Purchase cancelled by user');
      return;
    }
    console.warn('[billing] Purchase failed', error);
  });

  listenersAttached = true;
}

async function handlePurchaseRequestResult(
  result: Purchase | Purchase[] | null
): Promise<BillingPurchaseResult> {
  const purchases = Array.isArray(result) ? result : result ? [result] : [];

  if (!purchases.length) {
    return {
      status: 'started',
      message: 'Store purchase flow opened. Entitlement will update when the store confirms payment.',
    };
  }

  const processed = await Promise.all(
    purchases.map((purchase) => processStorePurchase(purchase, 'purchase_cache'))
  );
  const pending = processed.find((entry) => entry.status === 'pending');
  if (pending) {
    return pending;
  }

  const completed = processed.find((entry) => entry.status === 'completed');
  return (
    completed ?? {
      status: 'started',
      message: 'Store purchase flow opened.',
    }
  );
}

async function processStorePurchase(
  purchase: Purchase,
  source: 'purchase_cache' | 'restore_cache'
): Promise<BillingPurchaseResult> {
  if (purchase.purchaseState === 'pending') {
    return {
      status: 'pending',
      message: 'Purchase is pending. Access will unlock automatically after the store confirms payment.',
    };
  }

  if (purchase.purchaseState !== 'purchased') {
    return {
      status: 'started',
      message: 'Purchase is not completed yet.',
    };
  }

  const plan = getProPlanByProductId(purchase.productId);
  if (plan) {
    await finishPurchasedTransaction(purchase);
    const subscriptionStatus = await saveSubscriptionStatus({
      tier: 'pro',
      source,
      validUntil: getPurchaseValidUntil(purchase),
      planId: plan.id,
      productId: plan.productId,
    });
    return {
      status: 'completed',
      message: `${plan.title} Pro is active.`,
      subscriptionStatus,
    };
  }

  const countryPack = getCountryPackByProductId(purchase.productId);
  if (countryPack) {
    await finishPurchasedTransaction(purchase);
    const countryPackEntitlements = await upsertCountryPackEntitlement({
      countryCode: countryPack.countryCode,
      productId: countryPack.productId,
      source,
      purchasedAt: new Date(purchase.transactionDate || Date.now()).toISOString(),
      transactionId: purchase.transactionId ?? purchase.id ?? null,
    });
    return {
      status: 'completed',
      message: `${countryPack.title} is unlocked.`,
      countryPackEntitlements,
    };
  }

  return {
    status: 'started',
    message: 'Store purchase was received for an unknown product.',
  };
}

async function applyActiveSubscriptionEntitlement(
  activeSubscriptions: ActiveSubscription[]
): Promise<SubscriptionStatus> {
  const activeProSubscription = activeSubscriptions.find(
    (subscription) =>
      subscription.isActive &&
      Boolean(getProPlanByProductId(subscription.productId)) &&
      !isSuspendedSubscription(subscription)
  );

  if (activeProSubscription) {
    const plan = getProPlanByProductId(activeProSubscription.productId);
    if (plan) {
      return saveSubscriptionStatus({
        tier: 'pro',
        source: 'restore_cache',
        validUntil: getActiveSubscriptionValidUntil(activeProSubscription),
        planId: plan.id,
        productId: plan.productId,
      });
    }
  }

  const current = await getSubscriptionStatus();
  if (current.source === 'purchase_cache' || current.source === 'restore_cache') {
    return saveSubscriptionStatus({
      tier: 'free',
      source: 'restore_cache',
      validUntil: null,
      planId: null,
      productId: null,
    });
  }

  return current;
}

async function applyCountryPackEntitlements(
  purchases: Purchase[],
  source: 'purchase_cache' | 'restore_cache'
): Promise<CountryPackEntitlement[]> {
  let entitlements = source === 'restore_cache' ? [] : await getCountryPackEntitlements();

  for (const purchase of purchases) {
    if (purchase.purchaseState !== 'purchased') {
      continue;
    }

    const countryPack = getCountryPackByProductId(purchase.productId);
    if (!countryPack) {
      continue;
    }

    await finishPurchasedTransaction(purchase);
    entitlements = mergeCountryPackEntitlement(entitlements, {
      countryCode: countryPack.countryCode,
      productId: countryPack.productId,
      source,
      purchasedAt: new Date(purchase.transactionDate || Date.now()).toISOString(),
      transactionId: purchase.transactionId ?? purchase.id ?? null,
    });
  }

  await setPreference(COUNTRY_PACK_ENTITLEMENTS_KEY, JSON.stringify(entitlements));
  return entitlements;
}

async function upsertCountryPackEntitlement(
  entitlement: CountryPackEntitlement
): Promise<CountryPackEntitlement[]> {
  const current = await getCountryPackEntitlements();
  const next = mergeCountryPackEntitlement(current, entitlement);
  await setPreference(COUNTRY_PACK_ENTITLEMENTS_KEY, JSON.stringify(next));
  return next;
}

function mergeCountryPackEntitlement(
  current: CountryPackEntitlement[],
  entitlement: CountryPackEntitlement
): CountryPackEntitlement[] {
  const withoutCountry = current.filter(
    (entry) => entry.countryCode !== entitlement.countryCode
  );
  return [...withoutCountry, entitlement].sort((first, second) =>
    first.countryCode.localeCompare(second.countryCode)
  );
}

async function getStoreSubscription(
  productId: SubscriptionProductId
): Promise<ProductSubscription | null> {
  if (Platform.OS !== 'android') {
    return null;
  }

  const products = await fetchProducts({ skus: [productId], type: 'subs' });
  const product = (products ?? []).find((entry) => entry.id === productId);
  return product && product.type === 'subs' ? (product as ProductSubscription) : null;
}

async function assertStoreProductAvailable(
  productId: CountryPackProductId,
  type: 'in-app'
): Promise<void> {
  const products = await fetchProducts({ skus: [productId], type });
  const exists = (products ?? []).some((product) => product.id === productId);
  if (!exists) {
    throw new Error(`Store product ${productId} is not available.`);
  }
}

function normalizeStoreProducts(
  products: Array<Product | ProductSubscription> | null | undefined,
  type: StoreProductDetails['type']
): StoreProductDetails[] {
  return (products ?? [])
    .filter((product): product is Product | ProductSubscription =>
      isBillingProductId(product.id)
    )
    .map((product) => ({
      productId: product.id as BillingProductId,
      title: product.title || product.displayName || product.id,
      description: product.description || fallbackProductDescription(product.id),
      displayPrice: product.displayPrice || fallbackProductPrice(product.id),
      type,
    }));
}

function getAndroidSubscriptionOfferToken(product: ProductSubscription | null): string | undefined {
  if (!product || product.platform !== 'android') {
    return undefined;
  }

  return (
    product.subscriptionOffers?.[0]?.offerTokenAndroid ??
    product.subscriptionOfferDetailsAndroid?.[0]?.offerToken ??
    undefined
  );
}

async function finishPurchasedTransaction(purchase: Purchase): Promise<void> {
  try {
    await finishTransaction({
      purchase,
      isConsumable: false,
    });
  } catch (error) {
    console.warn('[billing] Could not finish purchased transaction', error);
  }
}

function getPurchaseValidUntil(purchase: Purchase): string | null {
  if ('expirationDateIOS' in purchase && purchase.expirationDateIOS) {
    return new Date(purchase.expirationDateIOS).toISOString();
  }
  return null;
}

function getActiveSubscriptionValidUntil(subscription: ActiveSubscription): string | null {
  if (subscription.expirationDateIOS) {
    return new Date(subscription.expirationDateIOS).toISOString();
  }

  return null;
}

function isSuspendedSubscription(subscription: ActiveSubscription): boolean {
  return 'isSuspendedAndroid' in subscription && subscription.isSuspendedAndroid === true;
}

function isUserCancellation(error: { code?: string }): boolean {
  return error.code === 'user-cancelled';
}

function isBillingProductId(value: string): value is BillingProductId {
  return (
    PRO_SUBSCRIPTION_PRODUCT_IDS.includes(value as SubscriptionProductId) ||
    COUNTRY_PACK_STORE_PRODUCT_IDS.includes(value as CountryPackProductId)
  );
}

function fallbackProductDescription(productId: string): string {
  const plan = getProPlanByProductId(productId);
  if (plan) {
    return plan.helper;
  }

  const countryPack = getCountryPackByProductId(productId);
  return countryPack?.helper ?? 'Orbit Ledger product';
}

function fallbackProductPrice(productId: string): string {
  const plan = getProPlanByProductId(productId);
  if (plan) {
    return plan.price;
  }

  const countryPack = getCountryPackByProductId(productId);
  return countryPack?.fallbackPrice ?? '';
}

async function getPreference(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<PreferenceRow>(
    'SELECT value FROM app_preferences WHERE key = ? LIMIT 1',
    key
  );
  return row?.value ?? null;
}

async function setPreference(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO app_preferences (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at`,
    key,
    value,
    new Date().toISOString()
  );
}

function isValidCountryPackEntitlement(value: CountryPackEntitlement): boolean {
  return (
    Boolean(value) &&
    typeof value.countryCode === 'string' &&
    Boolean(getCountryPackByProductId(value.productId)) &&
    (value.source === 'purchase_cache' || value.source === 'restore_cache') &&
    typeof value.purchasedAt === 'string'
  );
}
