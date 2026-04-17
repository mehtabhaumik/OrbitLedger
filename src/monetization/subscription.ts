import { z } from 'zod';

import { getDatabase } from '../database/client';
import type {
  FreeTierFeature,
  ProTierFeature,
  SaveSubscriptionStatusInput,
  StoredSubscriptionStatus,
  SubscriptionFeature,
  SubscriptionFeatureAccess,
  SubscriptionPlanId,
  SubscriptionStatus,
  SubscriptionTier,
  SubscriptionTierDefinition,
} from './types';
import {
  CURRENT_SUBSCRIPTION_STATUS_VERSION,
  SUBSCRIPTION_STATUS_KEY,
} from './types';

type SubscriptionPreferenceRow = {
  value: string;
};

const freeTierFeatures: FreeTierFeature[] = [
  'business_setup',
  'dashboard',
  'customer_management',
  'ledger_transactions',
  'basic_statements',
  'pdf_export',
  'backup_export',
  'backup_restore',
  'pin_lock',
];

const proTierFeatures: ProTierFeature[] = [
  'advanced_pdf_styling',
  'custom_document_branding',
  'advanced_statement_templates',
  'tax_ready_documents',
  'bulk_document_export',
  'multi_business_profiles',
  'advanced_insights',
];

export const SUBSCRIPTION_TIER_DEFINITIONS: Record<
  SubscriptionTier,
  SubscriptionTierDefinition
> = {
  free: {
    tier: 'free',
    label: 'Free',
    description: 'Full offline ledger tools for daily customer dues and payments.',
    includedFeatures: freeTierFeatures,
  },
  pro: {
    tier: 'pro',
    label: 'Pro',
    description: 'Premium document polish while keeping the core offline ledger available.',
    includedFeatures: [...freeTierFeatures, ...proTierFeatures],
  },
};

const featureRequiredTier: Record<SubscriptionFeature, SubscriptionTier> = {
  business_setup: 'free',
  dashboard: 'free',
  customer_management: 'free',
  ledger_transactions: 'free',
  basic_statements: 'free',
  pdf_export: 'free',
  backup_export: 'free',
  backup_restore: 'free',
  pin_lock: 'free',
  advanced_pdf_styling: 'pro',
  custom_document_branding: 'pro',
  advanced_statement_templates: 'pro',
  tax_ready_documents: 'pro',
  bulk_document_export: 'pro',
  multi_business_profiles: 'pro',
  advanced_insights: 'pro',
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
    .enum(['com.bhaumikmehta.orbitledger.pro.monthly', 'com.bhaumikmehta.orbitledger.pro.yearly'])
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

export function resolveSubscriptionFeatureAccess(
  status: SubscriptionStatus,
  feature: SubscriptionFeature
): SubscriptionFeatureAccess {
  const requiredTier = featureRequiredTier[feature];
  const allowed = requiredTier === 'free' || status.isPro;

  return {
    feature,
    allowed,
    currentTier: status.tier,
    requiredTier,
    message: allowed
      ? null
      : 'This document enhancement is available with Orbit Ledger Pro. Your daily offline ledger tools remain available.',
  };
}

export function isPremiumSubscriptionFeature(feature: SubscriptionFeature): boolean {
  return featureRequiredTier[feature] === 'pro';
}

export function getSubscriptionTierDefinition(
  tier: SubscriptionTier
): SubscriptionTierDefinition {
  return SUBSCRIPTION_TIER_DEFINITIONS[tier];
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
