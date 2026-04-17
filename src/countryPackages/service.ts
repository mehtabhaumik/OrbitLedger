import {
  getCountryPackage,
  getCountryPackageLastCheckedAt,
  installCountryPackage,
  saveCountryPackageLastCheckedAt,
  type CountryPackageLookup,
  type CountryPackageWithComponents,
  type DocumentTemplateType,
  type InstallCountryPackageInput,
} from '../database';
import { compareTaxPackVersions } from '../tax/taxPackService';
import { describeRemoteUpdateError } from '../updates/remoteUpdateConfig';
import { remoteCountryPackageUpdateProvider } from './remoteCountryPackageProvider';

export type CountryPackageUpdateCandidate = {
  packageVersion: string;
  taxPackVersion?: string | null;
  complianceConfigVersion?: string | null;
  templateVersions?: Partial<Record<DocumentTemplateType, string>>;
  lastUpdated?: string;
  payloadUrl?: string;
  checksum?: string | null;
  signature?: string | null;
};

export type CountryPackageUpdateProvider = {
  checkLatestVersion: (
    lookup: CountryPackageLookup,
    currentPackage: CountryPackageWithComponents | null
  ) => Promise<CountryPackageUpdateCandidate | null>;
  fetchCountryPackage?: (
    lookup: CountryPackageLookup,
    candidate: CountryPackageUpdateCandidate
  ) => Promise<InstallCountryPackageInput | null>;
};

export type CountryPackageComponentUpdateState = {
  taxPack: boolean;
  templates: Partial<Record<DocumentTemplateType, boolean>>;
  complianceConfig: boolean;
};

export type CountryPackageUpdateCheckResult = {
  lookup: CountryPackageLookup;
  candidate: CountryPackageUpdateCandidate | null;
  checkedAt: string;
  currentVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
  shouldNotifyUser: boolean;
  componentUpdates: CountryPackageComponentUpdateState;
  lastCheckedAt: string | null;
  message: string;
};

export type CountryPackageUpdateResult = {
  status: 'installed' | 'fallback' | 'missing';
  countryPackage: CountryPackageWithComponents | null;
  message: string;
};

export const productionCountryPackageUpdateProvider: CountryPackageUpdateProvider =
  remoteCountryPackageUpdateProvider;

export async function loadInstalledCountryPackage(
  lookup: CountryPackageLookup
): Promise<CountryPackageWithComponents | null> {
  return getCountryPackage(lookup);
}

export async function installCountryBusinessLogicBundle(
  input: InstallCountryPackageInput
): Promise<CountryPackageWithComponents> {
  return installCountryPackage(input);
}

export async function checkCountryPackageUpdates(
  lookup: CountryPackageLookup,
  provider: CountryPackageUpdateProvider = productionCountryPackageUpdateProvider
): Promise<CountryPackageUpdateCheckResult> {
  const currentPackage = await loadInstalledCountryPackage(lookup);
  const [lastCheckedAt, candidate] = await Promise.all([
    getCountryPackageLastCheckedAt(lookup),
    provider.checkLatestVersion(lookup, currentPackage),
  ]);
  const checkedAt = await saveCountryPackageLastCheckedAt(lookup);
  const componentUpdates = detectComponentUpdates(currentPackage, candidate);
  const updateAvailable =
    Boolean(candidate) &&
    (comparePackageVersions(candidate?.packageVersion ?? '', currentPackage?.version ?? '') > 0 ||
      componentUpdates.taxPack ||
      componentUpdates.complianceConfig ||
      Object.values(componentUpdates.templates).some(Boolean));

  return {
    lookup,
    candidate,
    checkedAt,
    currentVersion: currentPackage?.version ?? null,
    latestVersion: candidate?.packageVersion ?? null,
    updateAvailable,
    shouldNotifyUser: updateAvailable,
    componentUpdates,
    lastCheckedAt,
    message: updateAvailable
      ? 'A country package update is available from the online update provider.'
      : 'The online country package provider has no newer version for this region.',
  };
}

export async function manualCheckCountryPackageUpdates(
  lookup: CountryPackageLookup,
  provider: CountryPackageUpdateProvider = productionCountryPackageUpdateProvider
): Promise<CountryPackageUpdateCheckResult> {
  return checkCountryPackageUpdates(lookup, provider);
}

export async function applyCountryPackageUpdateFromProvider(
  lookup: CountryPackageLookup,
  candidate: CountryPackageUpdateCandidate,
  provider: CountryPackageUpdateProvider = productionCountryPackageUpdateProvider
): Promise<CountryPackageUpdateResult> {
  const fallback = await loadInstalledCountryPackage(lookup);

  if (!provider.fetchCountryPackage) {
    return {
      status: fallback ? 'fallback' : 'missing',
      countryPackage: fallback,
      message:
        'This country package provider cannot fetch package data. Using the current local package.',
    };
  }

  try {
    const update = await provider.fetchCountryPackage(lookup, candidate);
    if (!update) {
      throw new Error('No country package returned by update provider.');
    }

    const installed = await installCountryBusinessLogicBundle({
      ...update,
      source: update.source ?? 'remote',
    });

    return {
      status: 'installed',
      countryPackage: installed,
      message: 'Country package update installed locally.',
    };
  } catch (error) {
    console.warn('Country package update failed; keeping current local package.', error);
    const failureReason = describeRemoteUpdateError(error);
    return {
      status: fallback ? 'fallback' : 'missing',
      countryPackage: fallback,
      message: fallback
        ? `${failureReason} Using the previous local package.`
        : `${failureReason} No local package is available.`,
    };
  }
}

function detectComponentUpdates(
  currentPackage: CountryPackageWithComponents | null,
  candidate: CountryPackageUpdateCandidate | null
): CountryPackageComponentUpdateState {
  const templateUpdates: Partial<Record<DocumentTemplateType, boolean>> = {};

  for (const [templateType, candidateVersion] of Object.entries(candidate?.templateVersions ?? {})) {
    const typedTemplateType = templateType as DocumentTemplateType;
    const currentTemplateVersion =
      currentPackage?.templates.find((template) => template.templateType === typedTemplateType)
        ?.version ?? '';
    templateUpdates[typedTemplateType] =
      comparePackageVersions(candidateVersion ?? '', currentTemplateVersion) > 0;
  }

  return {
    taxPack:
      comparePackageVersions(candidate?.taxPackVersion ?? '', currentPackage?.taxPack.version ?? '') >
      0,
    templates: templateUpdates,
    complianceConfig:
      comparePackageVersions(
        candidate?.complianceConfigVersion ?? '',
        currentPackage?.complianceConfig.version ?? ''
      ) > 0,
  };
}

function comparePackageVersions(nextVersion: string, currentVersion: string): number {
  if (!nextVersion.trim()) {
    return 0;
  }

  return compareTaxPackVersions(nextVersion, currentVersion);
}
