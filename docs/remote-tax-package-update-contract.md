# Orbit Ledger Remote Tax And Country Package Update Contract

This contract defines the production remote update path for tax packs and country packages.
Bundled local data is only a development seed or emergency fallback source, not the primary
production provider.

## Environment Configuration

Production defaults:

- Tax pack manifest: `https://updates.orbitledger.rudraix.com/v1/tax-packs/manifest.json`
- Country package manifest: `https://updates.orbitledger.rudraix.com/v1/country-packages/manifest.json`

Override for staging:

- `EXPO_PUBLIC_ORBIT_LEDGER_TAX_PACK_MANIFEST_URL`
- `EXPO_PUBLIC_ORBIT_LEDGER_COUNTRY_PACKAGE_MANIFEST_URL`

## Tax Pack Manifest

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-04-15T00:00:00.000Z",
  "taxPacks": [
    {
      "countryCode": "IN",
      "regionCode": "GJ",
      "taxType": "GST",
      "version": "2026.04.2",
      "lastUpdated": "2026-04-15T00:00:00.000Z",
      "payloadUrl": "./IN/GJ/GST/2026.04.2.json",
      "checksum": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "signature": null
    }
  ]
}
```

## Tax Pack Payload

```json
{
  "schemaVersion": 1,
  "taxPack": {
    "countryCode": "IN",
    "regionCode": "GJ",
    "taxType": "GST",
    "version": "2026.04.2",
    "lastUpdated": "2026-04-15T00:00:00.000Z",
    "rulesJson": {
      "provider": "orbit_ledger_remote_tax_pack",
      "rules": [
        {
          "id": "standard",
          "label": "GST standard",
          "rate": 18,
          "keywords": ["standard", "general"],
          "appliesTo": "standard",
          "calculation": "percentage"
        }
      ]
    }
  }
}
```

## Country Package Manifest

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-04-15T00:00:00.000Z",
  "packages": [
    {
      "countryCode": "IN",
      "regionCode": "GJ",
      "packageVersion": "2026.04.2",
      "taxPackVersion": "2026.04.2",
      "complianceConfigVersion": "2026.04.2",
      "templateVersions": {
        "invoice": "2026.04.2",
        "statement": "2026.04.2"
      },
      "lastUpdated": "2026-04-15T00:00:00.000Z",
      "payloadUrl": "./IN/GJ/package-2026.04.2.json",
      "checksum": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "signature": null
    }
  ]
}
```

## Country Package Payload

```json
{
  "schemaVersion": 1,
  "countryPackage": {
    "countryCode": "IN",
    "regionCode": "GJ",
    "packageName": "India Gujarat GST Package",
    "version": "2026.04.2",
    "taxPack": {
      "countryCode": "IN",
      "regionCode": "GJ",
      "taxType": "GST",
      "version": "2026.04.2",
      "lastUpdated": "2026-04-15T00:00:00.000Z",
      "rulesJson": {
        "provider": "orbit_ledger_remote_country_package",
        "rules": []
      }
    },
    "templates": [
      {
        "countryCode": "IN",
        "templateType": "invoice",
        "version": "2026.04.2",
        "templateConfigJson": {
          "layoutVersion": 2,
          "template": "invoice"
        }
      }
    ],
    "complianceConfig": {
      "countryCode": "IN",
      "regionCode": "GJ",
      "version": "2026.04.2",
      "lastUpdated": "2026-04-15T00:00:00.000Z",
      "configJson": {
        "reportTypes": ["tax_summary", "sales_summary", "dues_summary"]
      }
    }
  }
}
```

## Validation Rules

- `schemaVersion` must be `1`.
- Manifest and payload URLs must use HTTPS after relative URLs are resolved.
- Each manifest entry must include a SHA-256 payload checksum as `sha256:<64 hex chars>` or a bare 64-character hex digest.
- Payload checksum is verified against the exact downloaded payload text before JSON parsing or install.
- All country, region, and tax type codes are normalized to uppercase.
- Payload country, region, and version must match the selected manifest candidate.
- Tax pack rules must be a non-empty JSON object.
- Country package payload must include tax pack, at least one document template, and compliance config.
- Template type must be `invoice` or `statement`.
- Component country and region scope must match the package scope.

## Trust Model

- Production update checks use the remote manifest URLs by default.
- Bundled local data is development seed or emergency fallback only and must not be treated as an online update.
- HTTPS is required for manifests and payloads.
- SHA-256 checksums are required and enforced for payload integrity.
- Checksums verify integrity against the trusted manifest response. They do not prove author authenticity by themselves.
- `signature` is reserved for a future cryptographic signing layer. Current production acceptance does not claim signature-backed authenticity yet.

## Failure Behavior

- Remote check failure does not change installed data.
- Remote apply failure keeps the last valid installed tax pack or country package active.
- Checksum mismatch rejects the payload before parsing and keeps the current installed pack active.
- Invalid payload shape, version mismatch, scope mismatch, and apply failures do not corrupt installed data.
- Successfully applied packages are saved locally and remain usable offline.

## QA / Staging Test Path

- Host staging manifests and payload JSON over HTTPS.
- Point the app at those manifests with:
  - `EXPO_PUBLIC_ORBIT_LEDGER_TAX_PACK_MANIFEST_URL`
  - `EXPO_PUBLIC_ORBIT_LEDGER_COUNTRY_PACKAGE_MANIFEST_URL`
- Generate payload checksums from the exact served JSON bytes.
- Test success, no update, manifest fetch failure, payload fetch failure, checksum mismatch, invalid shape, version mismatch, and scope mismatch before production release.
