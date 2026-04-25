import {
  getActiveTaxPack,
  getTaxPackLastCheckedAt,
  listTaxPacks,
  saveTaxPack,
  saveTaxPackLastCheckedAt,
  type SaveTaxPackInput,
  type TaxPack,
  type TaxPackLookup,
} from '../database';
import { describeRemoteUpdateError } from '../updates/remoteUpdateConfig';
import { remoteTaxPackUpdateProvider } from './remoteTaxPackProvider';
import { assertValidTaxPack } from './taxPackValidator';

export type TaxPackLoadResult = {
  taxPack: TaxPack | null;
  source: 'active' | 'fallback' | 'missing';
};

export type TaxPackUpdateResult = {
  status: 'saved' | 'fallback' | 'missing';
  taxPack: TaxPack | null;
  message: string;
};

export type TaxPackUpdateCandidate = {
  version: string;
  lastUpdated?: string;
  payloadUrl?: string;
  checksum?: string | null;
  signature?: string | null;
};

export type TaxPackUpdateProvider = {
  checkLatestVersion: (lookup: TaxPackLookup) => Promise<TaxPackUpdateCandidate | null>;
  fetchTaxPack?: (
    lookup: TaxPackLookup,
    candidate: TaxPackUpdateCandidate
  ) => Promise<SaveTaxPackInput | null>;
};

export type TaxPackUpdateCheckResult = {
  lookup: TaxPackLookup;
  candidate: TaxPackUpdateCandidate | null;
  checkedAt: string;
  currentVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
  shouldPromptUser: boolean;
  lastCheckedAt: string | null;
  message: string;
};

export const productionTaxPackUpdateProvider: TaxPackUpdateProvider = remoteTaxPackUpdateProvider;

export async function loadTaxPack(lookup: TaxPackLookup): Promise<TaxPackLoadResult> {
  const activePack = await getActiveTaxPack(lookup);
  if (activePack) {
    return {
      taxPack: activePack,
      source: 'active',
    };
  }

  const fallbackPack = await loadLastValidTaxPack(lookup);
  return {
    taxPack: fallbackPack,
    source: fallbackPack ? 'fallback' : 'missing',
  };
}

export async function saveValidatedTaxPack(input: SaveTaxPackInput): Promise<TaxPack> {
  assertValidTaxPack(input);
  return saveTaxPack(input);
}

export async function checkTaxPackUpdates(
  lookup: TaxPackLookup,
  provider: TaxPackUpdateProvider = productionTaxPackUpdateProvider
): Promise<TaxPackUpdateCheckResult> {
  const [loadedPack, previousCheckedAt, candidate] = await Promise.all([
    loadTaxPack(lookup),
    getTaxPackLastCheckedAt(lookup),
    provider.checkLatestVersion(lookup),
  ]);
  const checkedAt = await saveTaxPackLastCheckedAt(lookup);
  const currentVersion = loadedPack.taxPack?.version ?? null;
  const latestVersion = candidate?.version ?? null;
  const updateAvailable =
    Boolean(candidate?.version) &&
    compareTaxPackVersions(candidate?.version ?? '', currentVersion ?? '') > 0;

  return {
    lookup,
    candidate,
    checkedAt,
    currentVersion,
    latestVersion,
    updateAvailable,
    shouldPromptUser: updateAvailable,
    lastCheckedAt: previousCheckedAt,
    message: updateAvailable
      ? 'A newer tax pack is available from the online update provider.'
      : 'The online tax pack provider has no newer version for this region and tax type.',
  };
}

export async function manualCheckTaxPackUpdates(
  lookup: TaxPackLookup,
  provider: TaxPackUpdateProvider = productionTaxPackUpdateProvider
): Promise<TaxPackUpdateCheckResult> {
  return checkTaxPackUpdates(lookup, provider);
}

export async function applyTaxPackUpdateFromProvider(
  lookup: TaxPackLookup,
  candidate: TaxPackUpdateCandidate,
  provider: TaxPackUpdateProvider = productionTaxPackUpdateProvider
): Promise<TaxPackUpdateResult> {
  const fallback = await loadTaxPack(lookup);

  if (!provider.fetchTaxPack) {
    return {
      status: fallback.taxPack ? 'fallback' : 'missing',
      taxPack: fallback.taxPack,
      message: 'This tax pack provider cannot fetch package data. Using the last valid local tax pack.',
    };
  }

  try {
    const update = await provider.fetchTaxPack(lookup, candidate);
    if (!update) {
      throw new Error('No tax pack returned by update provider.');
    }

    const saved = await saveValidatedTaxPack({
      ...update,
      isActive: true,
      source: update.source ?? 'remote',
    });

    return {
      status: 'saved',
      taxPack: saved,
      message: 'Tax pack update saved locally.',
    };
  } catch (error) {
    console.warn('Tax pack update failed; keeping current local tax pack.', error);
    const failureReason = describeRemoteUpdateError(error);
    return {
      status: fallback.taxPack ? 'fallback' : 'missing',
      taxPack: fallback.taxPack,
      message: fallback.taxPack
        ? `${failureReason} Using the last valid local tax pack.`
        : `${failureReason} No local fallback is available.`,
    };
  }
}

export function compareTaxPackVersions(nextVersion: string, currentVersion: string): number {
  const nextParts = splitVersion(nextVersion);
  const currentParts = splitVersion(currentVersion);
  const maxLength = Math.max(nextParts.length, currentParts.length);
  const hasNumericVersionParts = nextParts.length > 0 || currentParts.length > 0;

  for (let index = 0; index < maxLength; index += 1) {
    const nextPart = nextParts[index] ?? 0;
    const currentPart = currentParts[index] ?? 0;

    if (nextPart > currentPart) {
      return 1;
    }

    if (nextPart < currentPart) {
      return -1;
    }
  }

  return hasNumericVersionParts ? 0 : nextVersion.localeCompare(currentVersion);
}

async function loadLastValidTaxPack(lookup: TaxPackLookup): Promise<TaxPack | null> {
  const packs = await listTaxPacks(lookup);

  return packs[0] ?? null;
}

function splitVersion(version: string): number[] {
  const matches = version.match(/\d+/g);
  return matches?.map((part) => Number(part)).filter((part) => Number.isFinite(part)) ?? [];
}
