import type {
  CountryPackageLookup,
  DocumentTemplateType,
  InstallCountryPackageInput,
} from '../database';
import {
  assertIsoDateLike,
  assertJsonObjectOrString,
  assertOptionalString,
  assertRemoteContractVersion,
  assertRemotePayloadTrustMetadata,
  assertString,
  fetchRemoteJson,
  fetchVerifiedRemoteJson,
  getCountryPackageManifestUrl,
  isRecord,
  normalizeRemoteCode,
  resolveRemotePayloadUrl,
} from '../updates/remoteUpdateConfig';
import { assertValidTaxPack } from '../tax/taxPackValidator';
import type {
  CountryPackageUpdateCandidate,
  CountryPackageUpdateProvider,
} from './service';

type RemoteCountryPackageManifestEntry = CountryPackageUpdateCandidate & {
  countryCode: string;
  regionCode: string;
};

type RemoteCountryPackageManifest = {
  packages: RemoteCountryPackageManifestEntry[];
};

const documentTemplateTypes: DocumentTemplateType[] = ['invoice', 'statement'];

export const remoteCountryPackageUpdateProvider: CountryPackageUpdateProvider = {
  async checkLatestVersion(lookup) {
    const manifestUrl = getCountryPackageManifestUrl();
    const manifest = await fetchRemoteCountryPackageManifest(manifestUrl);
    const entry = findCountryPackageManifestEntry(manifest.packages, lookup);

    return entry
      ? {
          packageVersion: entry.packageVersion,
          taxPackVersion: entry.taxPackVersion ?? null,
          complianceConfigVersion: entry.complianceConfigVersion ?? null,
          templateVersions: entry.templateVersions,
          lastUpdated: entry.lastUpdated,
          payloadUrl: entry.payloadUrl
            ? resolveRemotePayloadUrl(entry.payloadUrl, manifestUrl)
            : undefined,
          checksum: entry.checksum,
          signature: entry.signature ?? null,
        }
      : null;
  },
  async fetchCountryPackage(lookup, candidate) {
    if (!candidate.payloadUrl) {
      throw new Error('Remote country package candidate does not include a payload URL.');
    }

    if (!candidate.checksum) {
      throw new Error('Remote country package candidate does not include a checksum.');
    }

    const payload = await fetchVerifiedRemoteJson<unknown>(
      candidate.payloadUrl,
      {
        checksum: candidate.checksum,
        signature: candidate.signature ?? null,
      },
      'Remote country package payload'
    );
    return parseRemoteCountryPackagePayload(payload, lookup, candidate);
  },
};

async function fetchRemoteCountryPackageManifest(
  manifestUrl: string
): Promise<RemoteCountryPackageManifest> {
  const payload = await fetchRemoteJson<unknown>(manifestUrl);
  assertRemoteContractVersion(payload);

  if (!isRecord(payload) || !Array.isArray(payload.packages)) {
    throw new Error('Remote country package manifest must include packages array.');
  }

  return {
    packages: payload.packages.map(parseRemoteCountryPackageManifestEntry),
  };
}

function parseRemoteCountryPackageManifestEntry(
  value: unknown
): RemoteCountryPackageManifestEntry {
  if (!isRecord(value)) {
    throw new Error('Country package manifest entry must be an object.');
  }

  const trust = assertRemotePayloadTrustMetadata(value, 'packages');

  return {
    countryCode: normalizeRemoteCode(assertString(value.countryCode, 'packages.countryCode')),
    regionCode: normalizeRemoteCode(
      assertOptionalString(value.regionCode, 'packages.regionCode') ?? ''
    ),
    packageVersion: assertString(value.packageVersion, 'packages.packageVersion'),
    taxPackVersion: assertOptionalString(value.taxPackVersion, 'packages.taxPackVersion'),
    complianceConfigVersion: assertOptionalString(
      value.complianceConfigVersion,
      'packages.complianceConfigVersion'
    ),
    templateVersions: parseTemplateVersions(value.templateVersions),
    lastUpdated: assertIsoDateLike(value.lastUpdated, 'packages.lastUpdated'),
    payloadUrl: assertString(value.payloadUrl, 'packages.payloadUrl'),
    checksum: trust.checksum,
    signature: trust.signature,
  };
}

function findCountryPackageManifestEntry(
  entries: RemoteCountryPackageManifestEntry[],
  lookup: CountryPackageLookup
): RemoteCountryPackageManifestEntry | null {
  const countryCode = normalizeRemoteCode(lookup.countryCode);
  const regionCode = normalizeRemoteCode(lookup.regionCode ?? '');

  return (
    entries.find(
      (entry) => entry.countryCode === countryCode && entry.regionCode === regionCode
    ) ??
    entries.find((entry) => entry.countryCode === countryCode && entry.regionCode === '') ??
    null
  );
}

function parseRemoteCountryPackagePayload(
  value: unknown,
  lookup: CountryPackageLookup,
  candidate: CountryPackageUpdateCandidate
): InstallCountryPackageInput {
  assertRemoteContractVersion(value);

  if (!isRecord(value) || !isRecord(value.countryPackage)) {
    throw new Error('Remote country package payload must include countryPackage object.');
  }

  const remotePackage = value.countryPackage;
  const input: InstallCountryPackageInput = {
    countryCode: normalizeRemoteCode(assertString(remotePackage.countryCode, 'countryPackage.countryCode')),
    regionCode: normalizeRemoteCode(
      assertOptionalString(remotePackage.regionCode, 'countryPackage.regionCode') ?? ''
    ),
    packageName: assertString(remotePackage.packageName, 'countryPackage.packageName'),
    version: assertString(remotePackage.version, 'countryPackage.version'),
    source: 'remote',
    taxPack: parseRemoteTaxPack(remotePackage.taxPack),
    templates: parseRemoteTemplates(remotePackage.templates),
    complianceConfig: parseRemoteComplianceConfig(remotePackage.complianceConfig),
  };

  assertCountryPackageMatchesLookup(input, lookup, candidate);
  return input;
}

function parseRemoteTaxPack(value: unknown): InstallCountryPackageInput['taxPack'] {
  if (!isRecord(value)) {
    throw new Error('Remote country package taxPack must be an object.');
  }

  const taxPack: InstallCountryPackageInput['taxPack'] = {
    countryCode: normalizeRemoteCode(assertString(value.countryCode, 'taxPack.countryCode')),
    regionCode: normalizeRemoteCode(assertOptionalString(value.regionCode, 'taxPack.regionCode') ?? ''),
    taxType: normalizeRemoteCode(assertString(value.taxType, 'taxPack.taxType')),
    version: assertString(value.version, 'taxPack.version'),
    lastUpdated: assertIsoDateLike(value.lastUpdated, 'taxPack.lastUpdated'),
    source: 'remote',
    isActive: true,
    rulesJson: assertJsonObjectOrString(value.rulesJson, 'taxPack.rulesJson'),
  };

  assertValidTaxPack(taxPack);
  return taxPack;
}

function parseRemoteTemplates(value: unknown): InstallCountryPackageInput['templates'] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Remote country package templates must be a non-empty array.');
  }

  return value.map((template) => {
    if (!isRecord(template)) {
      throw new Error('Remote document template must be an object.');
    }

    const templateType = assertString(template.templateType, 'template.templateType');
    if (!documentTemplateTypes.includes(templateType as DocumentTemplateType)) {
      throw new Error(`Unsupported document template type: ${templateType}.`);
    }

    if (!isRecord(template.templateConfigJson)) {
      throw new Error('Remote document template config must be an object.');
    }

    return {
      countryCode: normalizeRemoteCode(assertString(template.countryCode, 'template.countryCode')),
      templateType: templateType as DocumentTemplateType,
      version: assertString(template.version, 'template.version'),
      templateConfigJson: template.templateConfigJson,
    };
  });
}

function parseRemoteComplianceConfig(
  value: unknown
): InstallCountryPackageInput['complianceConfig'] {
  if (!isRecord(value)) {
    throw new Error('Remote compliance config must be an object.');
  }

  if (!isRecord(value.configJson)) {
    throw new Error('Remote compliance config JSON must be an object.');
  }

  return {
    countryCode: normalizeRemoteCode(assertString(value.countryCode, 'complianceConfig.countryCode')),
    regionCode: normalizeRemoteCode(
      assertOptionalString(value.regionCode, 'complianceConfig.regionCode') ?? ''
    ),
    version: assertString(value.version, 'complianceConfig.version'),
    lastUpdated: assertIsoDateLike(value.lastUpdated, 'complianceConfig.lastUpdated'),
    source: 'remote',
    isActive: true,
    configJson: value.configJson,
  };
}

function assertCountryPackageMatchesLookup(
  input: InstallCountryPackageInput,
  lookup: CountryPackageLookup,
  candidate: CountryPackageUpdateCandidate
): void {
  const expectedCountryCode = normalizeRemoteCode(lookup.countryCode);
  const expectedRegionCode = normalizeRemoteCode(lookup.regionCode ?? '');

  if (input.countryCode !== expectedCountryCode) {
    throw new Error('Remote country package country does not match the requested country.');
  }

  if (input.regionCode && input.regionCode !== expectedRegionCode) {
    throw new Error('Remote country package region does not match the requested region.');
  }

  if (input.version !== candidate.packageVersion) {
    throw new Error('Remote country package version does not match the update candidate.');
  }

  assertComponentScope(input);
}

function assertComponentScope(input: InstallCountryPackageInput): void {
  if (input.taxPack.countryCode !== input.countryCode) {
    throw new Error('Remote tax pack country must match country package country.');
  }

  if (input.taxPack.regionCode && input.taxPack.regionCode !== input.regionCode) {
    throw new Error('Remote tax pack region must match country package region.');
  }

  for (const template of input.templates) {
    if (template.countryCode !== input.countryCode) {
      throw new Error('Remote template country must match country package country.');
    }
  }

  if (input.complianceConfig.countryCode !== input.countryCode) {
    throw new Error('Remote compliance config country must match country package country.');
  }
}

function parseTemplateVersions(value: unknown): Partial<Record<DocumentTemplateType, string>> {
  if (value === undefined || value === null) {
    return {};
  }

  if (!isRecord(value)) {
    throw new Error('templateVersions must be an object.');
  }

  const versions: Partial<Record<DocumentTemplateType, string>> = {};
  for (const templateType of documentTemplateTypes) {
    const version = value[templateType];
    if (version !== undefined && version !== null) {
      versions[templateType] = assertString(version, `templateVersions.${templateType}`);
    }
  }

  return versions;
}
