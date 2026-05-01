import { getLocalBusinessPack } from '@orbit-ledger/core';

import type { CountryPackageLookup, InstallCountryPackageInput } from '../database';
import {
  buildBundledTaxPack,
  inferTaxTypeForCountry,
  LOCAL_TAX_CATALOG_UPDATED_AT,
  LOCAL_TAX_CATALOG_VERSION,
  normalizeCatalogCode,
} from '../tax/localTaxPackProvider';
import { getBuiltInDocumentTemplate } from '../documents';
import type {
  CountryPackageUpdateCandidate,
  CountryPackageUpdateProvider,
} from './service';

const LOCAL_COUNTRY_PACKAGE_VERSION = '2026.04.1';
const LOCAL_TEMPLATE_VERSION = '2026.04.1';
const LOCAL_COMPLIANCE_VERSION = '2026.04.1';

export const bundledCountryPackageUpdateProvider: CountryPackageUpdateProvider = {
  async checkLatestVersion(lookup) {
    return buildBundledCountryPackageCandidate(lookup);
  },
  async fetchCountryPackage(lookup, candidate) {
    return buildBundledCountryPackage(lookup, candidate);
  },
};

export function buildBundledCountryPackageCandidate(
  lookup: CountryPackageLookup
): CountryPackageUpdateCandidate {
  return {
    packageVersion: LOCAL_COUNTRY_PACKAGE_VERSION,
    taxPackVersion: LOCAL_TAX_CATALOG_VERSION,
    complianceConfigVersion: LOCAL_COMPLIANCE_VERSION,
    templateVersions: {
      invoice: LOCAL_TEMPLATE_VERSION,
      statement: LOCAL_TEMPLATE_VERSION,
    },
    lastUpdated: LOCAL_TAX_CATALOG_UPDATED_AT,
  };
}

export function buildBundledCountryPackage(
  lookup: CountryPackageLookup,
  candidate: CountryPackageUpdateCandidate = buildBundledCountryPackageCandidate(lookup)
): InstallCountryPackageInput {
  const countryCode = normalizeCatalogCode(lookup.countryCode);
  const regionCode = normalizeCatalogCode(lookup.regionCode ?? '');
  const localPack = getLocalBusinessPack({ countryCode, regionCode });
  const taxType = inferTaxTypeForCountry(countryCode);
  const invoiceTemplate = getBuiltInDocumentTemplate(getInvoiceTemplateKey(countryCode));
  const statementTemplate = getBuiltInDocumentTemplate(getStatementTemplateKey(countryCode));

  return {
    countryCode,
    regionCode,
    packageName: localPack.packageName,
    version: candidate.packageVersion,
    source: 'remote',
    taxPack: buildBundledTaxPack(
      {
        countryCode,
        regionCode,
        taxType,
      },
      {
        version: candidate.taxPackVersion ?? LOCAL_TAX_CATALOG_VERSION,
        lastUpdated: candidate.lastUpdated ?? LOCAL_TAX_CATALOG_UPDATED_AT,
      }
    ),
    templates: [
      {
        countryCode,
        templateType: 'invoice',
        version: candidate.templateVersions?.invoice ?? LOCAL_TEMPLATE_VERSION,
        templateConfigJson:
          invoiceTemplate?.config ?? fallbackInvoiceTemplate(countryCode, taxType, localPack),
      },
      {
        countryCode,
        templateType: 'statement',
        version: candidate.templateVersions?.statement ?? LOCAL_TEMPLATE_VERSION,
        templateConfigJson: statementTemplate?.config ?? fallbackStatementTemplate(countryCode, localPack),
      },
    ],
    complianceConfig: {
      countryCode,
      regionCode,
      version: candidate.complianceConfigVersion ?? LOCAL_COMPLIANCE_VERSION,
      lastUpdated: candidate.lastUpdated ?? LOCAL_TAX_CATALOG_UPDATED_AT,
      source: 'remote',
      isActive: true,
      configJson: {
        provider: 'orbit_ledger_bundled_country_package',
        countryCode,
        regionCode,
        reportTypes: ['tax_summary', 'sales_summary', 'dues_summary'],
        taxLabel: localPack.labels.taxName,
        taxIdLabel: localPack.labels.taxId,
        marketName: localPack.marketName,
        documentLabels: localPack.documents,
        reminderToneDescriptions: localPack.reminders.toneDescriptions,
        localRhythms: localPack.rhythms,
        numberFormat: {
          currencyPosition: 'prefix',
          useGrouping: true,
          locale: localPack.locale,
        },
        legalDisclaimer: localPack.compliance.disclaimer,
      },
    },
  };
}

function getInvoiceTemplateKey(countryCode: string) {
  if (countryCode === 'IN') {
    return 'IN_GST_STANDARD_FREE';
  }
  if (countryCode === 'US') {
    return 'US_SALES_STANDARD_FREE';
  }
  if (countryCode === 'GB') {
    return 'UK_VAT_STANDARD_FREE';
  }
  return 'GENERIC_INVOICE_STANDARD_FREE';
}

function getStatementTemplateKey(countryCode: string) {
  if (countryCode === 'IN') {
    return 'IN_STATEMENT_STANDARD_FREE';
  }
  if (countryCode === 'US') {
    return 'US_STATEMENT_STANDARD_FREE';
  }
  if (countryCode === 'GB') {
    return 'UK_STATEMENT_STANDARD_FREE';
  }
  return 'GENERIC_STATEMENT_STANDARD_FREE';
}

function fallbackInvoiceTemplate(
  countryCode: string,
  taxType: string,
  localPack: ReturnType<typeof getLocalBusinessPack>
) {
  return {
    layoutVersion: 2,
    title: localPack.documents.invoiceTitle,
    provider: 'orbit_ledger_bundled_country_package',
    template: 'invoice',
    sectionTitles: {
      customer_identity: localPack.documents.buyerLabel,
      invoice_metadata: localPack.documents.invoiceDetailsLabel,
      invoice_item_table: localPack.documents.itemTableLabel,
      invoice_summary: 'Totals',
      tax_placeholder: 'Tax Details',
    },
    tableColumns: {
      invoice_item_table: [
        { key: 'name', label: 'Item', align: 'left' },
        { key: 'quantity', label: 'Qty', align: 'right' },
        { key: 'price', label: 'Price', align: 'right' },
        { key: 'taxRate', label: localPack.labels.taxName || taxType, align: 'right' },
        { key: 'total', label: 'Total', align: 'right' },
      ],
    },
    taxLabels: {
      taxSectionTitle: 'Tax Details',
      taxColumnLabel: localPack.labels.taxName || taxType,
      taxSummaryLabel: localPack.labels.taxName || taxType,
      taxRegistrationLabel: localPack.labels.taxId,
    },
    numberFormat: {
      locale: localPack.locale ?? (countryCode === 'IN' ? 'en-IN' : undefined),
      currencyDisplay: 'symbol',
    },
    metadata: {
      provider: 'orbit_ledger_bundled_country_package',
    },
  };
}

function fallbackStatementTemplate(
  countryCode: string,
  localPack: ReturnType<typeof getLocalBusinessPack>
) {
  return {
    layoutVersion: 2,
    title: localPack.documents.statementTitle,
    provider: 'orbit_ledger_bundled_country_package',
    template: 'statement',
    sectionTitles: {
      customer_identity: 'Statement For',
      statement_metadata: 'Statement Period',
      transaction_table: localPack.documents.statementActivityLabel,
      summary: localPack.documents.statementSummaryLabel,
      tax_placeholder: localPack.compliance.summaryLabel,
    },
    numberFormat: {
      locale: localPack.locale ?? (countryCode === 'IN' ? 'en-IN' : undefined),
      currencyDisplay: 'symbol',
    },
    metadata: {
      provider: 'orbit_ledger_bundled_country_package',
    },
  };
}
