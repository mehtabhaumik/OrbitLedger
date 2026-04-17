import type { SaveTaxPackInput, TaxPackLookup } from '../database';
import {
  assertIsoDateLike,
  assertJsonObjectOrString,
  assertOptionalString,
  assertRemoteContractVersion,
  assertRemotePayloadTrustMetadata,
  assertString,
  fetchRemoteJson,
  fetchVerifiedRemoteJson,
  getTaxPackManifestUrl,
  isRecord,
  normalizeRemoteCode,
  resolveRemotePayloadUrl,
} from '../updates/remoteUpdateConfig';
import type { TaxPackUpdateCandidate, TaxPackUpdateProvider } from './taxPackService';
import { assertValidTaxPack } from './taxPackValidator';

type RemoteTaxPackManifestEntry = TaxPackUpdateCandidate & {
  countryCode: string;
  regionCode: string;
  taxType: string;
};

type RemoteTaxPackManifest = {
  taxPacks: RemoteTaxPackManifestEntry[];
};

export const remoteTaxPackUpdateProvider: TaxPackUpdateProvider = {
  async checkLatestVersion(lookup) {
    const manifestUrl = getTaxPackManifestUrl();
    const manifest = await fetchRemoteTaxPackManifest(manifestUrl);
    const entry = findTaxPackManifestEntry(manifest.taxPacks, lookup);

    return entry
      ? {
          version: entry.version,
          lastUpdated: entry.lastUpdated,
          payloadUrl: entry.payloadUrl
            ? resolveRemotePayloadUrl(entry.payloadUrl, manifestUrl)
            : undefined,
          checksum: entry.checksum,
          signature: entry.signature ?? null,
        }
      : null;
  },
  async fetchTaxPack(lookup, candidate) {
    if (!candidate.payloadUrl) {
      throw new Error('Remote tax pack candidate does not include a payload URL.');
    }

    if (!candidate.checksum) {
      throw new Error('Remote tax pack candidate does not include a checksum.');
    }

    const payload = await fetchVerifiedRemoteJson<unknown>(
      candidate.payloadUrl,
      {
        checksum: candidate.checksum,
        signature: candidate.signature ?? null,
      },
      'Remote tax pack payload'
    );
    return parseRemoteTaxPackPayload(payload, lookup, candidate);
  },
};

async function fetchRemoteTaxPackManifest(manifestUrl: string): Promise<RemoteTaxPackManifest> {
  const payload = await fetchRemoteJson<unknown>(manifestUrl);
  assertRemoteContractVersion(payload);

  if (!isRecord(payload) || !Array.isArray(payload.taxPacks)) {
    throw new Error('Remote tax pack manifest must include taxPacks array.');
  }

  return {
    taxPacks: payload.taxPacks.map(parseRemoteTaxPackManifestEntry),
  };
}

function parseRemoteTaxPackManifestEntry(value: unknown): RemoteTaxPackManifestEntry {
  if (!isRecord(value)) {
    throw new Error('Tax pack manifest entry must be an object.');
  }

  const trust = assertRemotePayloadTrustMetadata(value, 'taxPacks');

  return {
    countryCode: normalizeRemoteCode(assertString(value.countryCode, 'taxPacks.countryCode')),
    regionCode: normalizeRemoteCode(
      assertOptionalString(value.regionCode, 'taxPacks.regionCode') ?? ''
    ),
    taxType: normalizeRemoteCode(assertString(value.taxType, 'taxPacks.taxType')),
    version: assertString(value.version, 'taxPacks.version'),
    lastUpdated: assertIsoDateLike(value.lastUpdated, 'taxPacks.lastUpdated'),
    payloadUrl: assertString(value.payloadUrl, 'taxPacks.payloadUrl'),
    checksum: trust.checksum,
    signature: trust.signature,
  };
}

function findTaxPackManifestEntry(
  entries: RemoteTaxPackManifestEntry[],
  lookup: TaxPackLookup
): RemoteTaxPackManifestEntry | null {
  const countryCode = normalizeRemoteCode(lookup.countryCode);
  const regionCode = normalizeRemoteCode(lookup.regionCode ?? '');
  const taxType = normalizeRemoteCode(lookup.taxType);

  return (
    entries.find(
      (entry) =>
        entry.countryCode === countryCode &&
        entry.regionCode === regionCode &&
        entry.taxType === taxType
    ) ??
    entries.find(
      (entry) =>
        entry.countryCode === countryCode &&
        entry.regionCode === '' &&
        entry.taxType === taxType
    ) ??
    null
  );
}

function parseRemoteTaxPackPayload(
  value: unknown,
  lookup: TaxPackLookup,
  candidate: TaxPackUpdateCandidate
): SaveTaxPackInput {
  assertRemoteContractVersion(value);

  if (!isRecord(value) || !isRecord(value.taxPack)) {
    throw new Error('Remote tax pack payload must include taxPack object.');
  }

  const taxPack = value.taxPack;
  const input: SaveTaxPackInput = {
    countryCode: normalizeRemoteCode(assertString(taxPack.countryCode, 'taxPack.countryCode')),
    regionCode: normalizeRemoteCode(assertOptionalString(taxPack.regionCode, 'taxPack.regionCode') ?? ''),
    taxType: normalizeRemoteCode(assertString(taxPack.taxType, 'taxPack.taxType')),
    rulesJson: assertJsonObjectOrString(taxPack.rulesJson, 'taxPack.rulesJson'),
    version: assertString(taxPack.version, 'taxPack.version'),
    lastUpdated: assertIsoDateLike(taxPack.lastUpdated, 'taxPack.lastUpdated'),
    source: 'remote',
    isActive: true,
  };

  assertTaxPackMatchesLookup(input, lookup, candidate);
  assertValidTaxPack(input);
  return input;
}

function assertTaxPackMatchesLookup(
  input: SaveTaxPackInput,
  lookup: TaxPackLookup,
  candidate: TaxPackUpdateCandidate
): void {
  const expectedCountryCode = normalizeRemoteCode(lookup.countryCode);
  const expectedRegionCode = normalizeRemoteCode(lookup.regionCode ?? '');
  const expectedTaxType = normalizeRemoteCode(lookup.taxType);

  if (input.countryCode !== expectedCountryCode) {
    throw new Error('Remote tax pack country does not match the requested country.');
  }

  if (input.regionCode && input.regionCode !== expectedRegionCode) {
    throw new Error('Remote tax pack region does not match the requested region.');
  }

  if (input.taxType !== expectedTaxType) {
    throw new Error('Remote tax pack tax type does not match the requested tax type.');
  }

  if (input.version !== candidate.version) {
    throw new Error('Remote tax pack payload version does not match the update candidate.');
  }
}
