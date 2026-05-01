import { z } from 'zod';

import { getDatabase } from '../database/client';
import type {
  SaveSubscriptionStatusInput,
  StoredSubscriptionStatus,
  SubscriptionFeature,
  SubscriptionFeatureAccess,
  SubscriptionPlanId,
  SubscriptionStatus,
} from './types';
import {
  CURRENT_SUBSCRIPTION_STATUS_VERSION,
  SUBSCRIPTION_STATUS_KEY,
} from './types';
export {
  getSubscriptionTierDefinition,
  isPremiumSubscriptionFeature,
  resolveSubscriptionFeatureAccess,
  SUBSCRIPTION_TIER_DEFINITIONS,
} from './subscriptionRules';
import {
  resolveSubscriptionFeatureAccess,
  SUBSCRIPTION_TIER_DEFINITIONS,
} from './subscriptionRules';

type SubscriptionPreferenceRow = {
  value: string;
};

const storedSubscriptionSchema = z.object({
  version: z.literal(CURRENT_SUBSCRIPTION_STATUS_VERSION),
  tier: z.enum(['free', 'pro']),
  source: z
    .enum(['local_default', 'manual', 'purchase_cache', 'restore_cache', 'development'])
    .default('manual'),
  updatedAt: z.string().nullable().default(null),
  validUntil: z.string().nullable().default(null),
  planId: z.enum(['pro_monthly', 'pro_yearly']).nullable().optional().default(null),
  productId: z
    .enum(['com.rudraix.orbitledger.pro.monthly', 'com.rudraix.orbitledger.pro.yearly'])
    .nullable()
    .optional()
    .default(null),
});

export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  try {
    const rawStatus = await readSubscriptionStatus();
    if (!rawStatus) {
      return hydrateSubscriptionStatus(createDefaultStoredStatus());
    }

    const parsedStatus = storedSubscriptionSchema.safeParse(JSON.parse(rawStatus));
    if (!parsedStatus.success) {
      console.warn('[monetization] Stored subscription status is invalid', parsedStatus.error);
      return hydrateSubscriptionStatus(createDefaultStoredStatus());
    }

    return hydrateSubscriptionStatus(parsedStatus.data);
  } catch (error) {
    console.warn('[monetization] Could not load subscription status', error);
    return hydrateSubscriptionStatus(createDefaultStoredStatus());
  }
}

export async function saveSubscriptionStatus(
  input: SaveSubscriptionStatusInput
): Promise<SubscriptionStatus> {
  try {
    const storedStatus: StoredSubscriptionStatus = {
      version: CURRENT_SUBSCRIPTION_STATUS_VERSION,
      tier: input.tier,
      source: input.source ?? 'manual',
      updatedAt: new Date().toISOString(),
      validUntil: input.validUntil ?? null,
      planId: input.planId ?? null,
      productId: input.productId ?? null,
    };

    await writeSubscriptionStatus(storedStatus);
    return hydrateSubscriptionStatus(storedStatus);
  } catch (error) {
    console.warn('[monetization] Could not save subscription status', error);
    throw error;
  }
}

export async function resetSubscriptionStatus(): Promise<SubscriptionStatus> {
  try {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM app_preferences WHERE key = ?', SUBSCRIPTION_STATUS_KEY);
    return hydrateSubscriptionStatus(createDefaultStoredStatus());
  } catch (error) {
    console.warn('[monetization] Could not reset subscription status', error);
    throw error;
  }
}

export async function isProSubscriptionActive(): Promise<boolean> {
  const status = await getSubscriptionStatus();
  return status.isPro;
}

export async function getSubscriptionFeatureAccess(
  feature: SubscriptionFeature
): Promise<SubscriptionFeatureAccess> {
  const status = await getSubscriptionStatus();
  return resolveSubscriptionFeatureAccess(status, feature);
}

export async function canUseSubscriptionFeature(
  feature: SubscriptionFeature
): Promise<boolean> {
  const access = await getSubscriptionFeatureAccess(feature);
  return access.allowed;
}

async function readSubscriptionStatus(): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<SubscriptionPreferenceRow>(
    'SELECT value FROM app_preferences WHERE key = ? LIMIT 1',
    SUBSCRIPTION_STATUS_KEY
  );
  return row?.value ?? null;
}

async function writeSubscriptionStatus(status: StoredSubscriptionStatus): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO app_preferences (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at`,
    SUBSCRIPTION_STATUS_KEY,
    JSON.stringify(status),
    new Date().toISOString()
  );
}

function createDefaultStoredStatus(): StoredSubscriptionStatus {
  return {
    version: CURRENT_SUBSCRIPTION_STATUS_VERSION,
    tier: 'free',
    source: 'local_default',
    updatedAt: null,
    validUntil: null,
    planId: null,
    productId: null,
  };
}

function hydrateSubscriptionStatus(
  status: StoredSubscriptionStatus
): SubscriptionStatus {
  const effectiveTier =
    status.tier === 'pro' && isExpired(status.validUntil) ? 'free' : status.tier;
  const definition = SUBSCRIPTION_TIER_DEFINITIONS[effectiveTier];

  return {
    ...status,
    tier: effectiveTier,
    isPro: effectiveTier === 'pro',
    tierLabel: definition.label,
    includedFeatures: definition.includedFeatures,
  };
}

function isExpired(validUntil: string | null): boolean {
  if (!validUntil) {
    return false;
  }

  const expiration = new Date(validUntil);
  return Number.isNaN(expiration.getTime()) || expiration.getTime() <= Date.now();
}
