import {
  getGeneratedInvoiceDocumentLabel,
  normalizeInvoiceDocumentState,
} from '@orbit-ledger/core';

import { formatCurrency } from '../../lib/format';
import { parseDocumentTemplateConfig } from '../templates';
import type {
  DocumentImageAsset,
  DocumentMoney,
  DocumentTaxBreakdownRow,
  DocumentTemplateRuntime,
  InvoiceDocumentData,
  InvoiceDocumentInput,
  InvoiceItemTableRow,
} from '../types';

type TaxBreakdownMode = NonNullable<NonNullable<InvoiceDocumentInput['documentOptions']>['taxBreakdownMode']>;

export function prepareInvoiceDocumentData(input: InvoiceDocumentInput): InvoiceDocumentData {
  const currency = input.businessProfile.currency;
  const includeCustomBranding = input.documentOptions?.includeCustomBranding ?? false;
  const pdfStyle = input.documentOptions?.pdfStyle ?? 'basic';
  const proTheme = pdfStyle === 'advanced' ? input.documentOptions?.proTheme ?? null : null;
  const customerName = input.customer?.name ?? 'Unlinked customer';
  const templateConfig = parseDocumentTemplateConfig(input.documentOptions?.documentTemplate);
  const locale = templateConfig?.numberFormat?.locale ?? input.locale;
  const currencyDisplay = templateConfig?.numberFormat?.currencyDisplay;
  const taxRegistrationNumber = input.documentOptions?.taxRegistrationNumber ?? null;
  const template = buildTemplateRuntime(templateConfig, input.businessProfile.countryCode, pdfStyle);

  const items: InvoiceItemTableRow[] = input.invoice.items.map((item) => {
    const taxableValue = roundCurrency(item.quantity * item.price);
    const taxAmount = roundCurrency(item.total - taxableValue);
    const taxBreakdownMode = input.documentOptions?.taxBreakdownMode ?? 'generic';
    const splitTax = buildLineTaxSplit(taxAmount, taxBreakdownMode);

    return {
      itemId: item.id,
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      price: money(item.price, currency, locale, currencyDisplay),
      taxRate: `${item.taxRate}%`,
      hsnSac: inferHsnSacFallback(item.name, item.description, taxBreakdownMode),
      taxableValue: money(taxableValue, currency, locale, currencyDisplay),
      taxAmount: money(taxAmount, currency, locale, currencyDisplay),
      cgst: splitTax.cgst === null ? null : money(splitTax.cgst, currency, locale, currencyDisplay),
      sgst: splitTax.sgst === null ? null : money(splitTax.sgst, currency, locale, currencyDisplay),
      igst: splitTax.igst === null ? null : money(splitTax.igst, currency, locale, currencyDisplay),
      total: money(item.total, currency, locale, currencyDisplay),
    };
  });

  const taxBreakdownRows = buildTaxBreakdownRows(
    input.invoice.taxAmount,
    currency,
    locale,
    currencyDisplay,
    input.documentOptions?.taxBreakdownMode ?? 'generic'
  );

  return {
    kind: 'invoice',
    businessIdentity: {
      businessName: input.businessProfile.businessName,
      address: input.businessProfile.address,
      phone: input.businessProfile.phone,
      email: input.businessProfile.email,
      countryCode: input.businessProfile.countryCode,
      stateCode: input.businessProfile.stateCode,
      logo: includeCustomBranding
        ? imageAsset(input.businessProfile.logoUri, `${input.businessProfile.businessName} logo`)
        : null,
      taxRegistrationNumber,
    },
    customerIdentity: {
      customerId: input.customer?.id ?? input.invoice.customerId,
      name: customerName,
      phone: input.customer?.phone ?? null,
      address: input.customer?.address ?? null,
      notes: input.customer?.notes ?? null,
    },
    metadata: {
      invoiceNumber: input.invoice.invoiceNumber,
      issueDate: input.invoice.issueDate,
      dueDate: input.invoice.dueDate,
      currency,
      status: getGeneratedInvoiceDocumentLabel(
        normalizeInvoiceDocumentState(input.invoice.documentState ?? input.invoice.status)
      ),
    },
    items,
    summary: {
      subtotal: money(input.invoice.subtotal, currency, locale, currencyDisplay),
      taxAmount: money(input.invoice.taxAmount, currency, locale, currencyDisplay),
      totalAmount: money(input.invoice.totalAmount, currency, locale, currencyDisplay),
      amountInWords: formatAmountInWords(input.invoice.totalAmount, currency),
    },
    paymentLink: input.documentOptions?.paymentLink ?? null,
    taxPlaceholder: {
      taxSection: {
        status: input.documentOptions?.taxRegistrationNumber || input.invoice.taxAmount > 0
          ? 'configured'
          : 'not_configured',
        message:
          input.documentOptions?.taxSectionMessage ??
          (input.invoice.taxAmount > 0
            ? 'Tax amount is included from the saved local invoice item rates.'
            : 'No tax amount is applied to this invoice.'),
      },
      taxColumnLabel: input.documentOptions?.taxColumnLabel ?? 'Tax',
      taxSummaryLabel: input.documentOptions?.taxSummaryLabel ?? input.documentOptions?.taxColumnLabel ?? 'Tax',
      taxRegistrationLabel: input.documentOptions?.taxRegistrationLabel ?? 'Tax ID',
      placeOfSupply: input.documentOptions?.placeOfSupply ?? input.businessProfile.stateCode,
      taxPointLabel: input.documentOptions?.taxPointLabel,
      taxPointDate: input.documentOptions?.taxPointDate ?? input.invoice.issueDate,
      taxBreakdown: {
        rows: taxBreakdownRows,
        message:
          input.documentOptions?.taxBreakdownMessage ??
          'Detailed country and region tax breakdown rows appear when the selected local template provides them.',
      },
      taxRegistrationNumber,
    },
    footer: {
      authorizedPersonName: input.businessProfile.authorizedPersonName,
      designation: input.businessProfile.authorizedPersonTitle,
      signature: includeCustomBranding
        ? imageAsset(
            input.businessProfile.signatureUri,
            `${input.businessProfile.authorizedPersonName} signature`
          )
        : null,
    },
    rendering: {
      pdfStyle,
      customBrandingIncluded: includeCustomBranding,
      proTheme,
      template,
      gatedPremiumFeatures: input.documentOptions?.gatedPremiumFeatures ?? [],
    },
    source: {
      businessId: input.businessProfile.id,
      customerId: input.invoice.customerId,
      invoiceId: input.invoice.id,
      invoiceItemIds: items.map((item) => item.itemId),
      generatedAt: new Date().toISOString(),
    },
  };
}

function buildTemplateRuntime(
  templateConfig: ReturnType<typeof parseDocumentTemplateConfig>,
  countryCode: string,
  pdfStyle: 'basic' | 'advanced'
): DocumentTemplateRuntime {
  const metadata = templateConfig?.metadata ?? {};
  const templateKey = readString(metadata.templateKey) ?? defaultInvoiceTemplateKey(countryCode, pdfStyle);
  const label = readString(metadata.templateLabel) ?? defaultInvoiceTemplateLabel(countryCode, pdfStyle);
  const visualStyle = readString(metadata.visualStyle) ?? (pdfStyle === 'advanced' ? 'premium_letterhead' : 'modern_minimal');
  const countryFormat = readString(metadata.countryFormat) ?? defaultCountryFormat(countryCode);
  const tier = readString(metadata.templateTier) === 'pro' || pdfStyle === 'advanced' ? 'pro' : 'free';

  return {
    key: templateKey as DocumentTemplateRuntime['key'],
    label,
    tier,
    visualStyle: visualStyle as DocumentTemplateRuntime['visualStyle'],
    countryFormat: countryFormat as DocumentTemplateRuntime['countryFormat'],
    description: readString(metadata.description) ?? label,
  };
}

function buildLineTaxSplit(
  taxAmount: number,
  mode: TaxBreakdownMode
): { cgst: number | null; sgst: number | null; igst: number | null } {
  if (mode === 'india_inter_state') {
    return { cgst: null, sgst: null, igst: roundCurrency(taxAmount) };
  }

  if (mode === 'india_intra_state') {
    const half = roundCurrency(taxAmount / 2);
    return { cgst: half, sgst: roundCurrency(taxAmount - half), igst: null };
  }

  return { cgst: null, sgst: null, igst: null };
}

function buildTaxBreakdownRows(
  taxAmount: number,
  currency: string,
  locale: string | undefined,
  currencyDisplay: 'symbol' | 'narrowSymbol' | 'code' | 'name' | undefined,
  mode: TaxBreakdownMode
): DocumentTaxBreakdownRow[] {
  const amount = roundCurrency(taxAmount);
  if (amount <= 0) {
    return [];
  }

  if (mode === 'india_intra_state') {
    const cgst = roundCurrency(amount / 2);
    return [
      { label: 'CGST', amount: money(cgst, currency, locale, currencyDisplay) },
      { label: 'SGST', amount: money(roundCurrency(amount - cgst), currency, locale, currencyDisplay) },
    ];
  }

  if (mode === 'india_inter_state') {
    return [{ label: 'IGST', amount: money(amount, currency, locale, currencyDisplay) }];
  }

  if (mode === 'uk_vat') {
    return [{ label: 'VAT', amount: money(amount, currency, locale, currencyDisplay) }];
  }

  if (mode === 'us_sales_tax') {
    return [{ label: 'Sales tax', amount: money(amount, currency, locale, currencyDisplay) }];
  }

  return [{ label: 'Tax', amount: money(amount, currency, locale, currencyDisplay) }];
}

function inferHsnSacFallback(
  itemName: string,
  itemDescription: string | null,
  mode: TaxBreakdownMode
): string {
  if (mode !== 'india_intra_state' && mode !== 'india_inter_state') {
    return '-';
  }

  const combined = `${itemName} ${itemDescription ?? ''}`.toLowerCase();
  return combined.includes('service') || combined.includes('repair') || combined.includes('consult')
    ? 'SAC'
    : 'HSN/SAC';
}

function formatAmountInWords(amount: number, currency: string): string {
  const rounded = Math.round((Number.isFinite(amount) ? amount : 0) * 100) / 100;
  const whole = Math.floor(Math.abs(rounded));
  const cents = Math.round((Math.abs(rounded) - whole) * 100);
  const currencyName = currency.trim().toUpperCase() || 'INR';
  const wording = getCurrencyAmountWording(currencyName);
  const words = numberToWords(whole);
  const centsText = cents > 0 ? ` and ${numberToWords(cents)} ${wording.fractionalUnit}` : '';
  return `${words}${centsText} ${wording.majorUnit} only`;
}

function getCurrencyAmountWording(currency: string): {
  majorUnit: string;
  fractionalUnit: string;
} {
  switch (currency) {
    case 'INR':
      return {
        majorUnit: 'Indian Rupees',
        fractionalUnit: 'paise',
      };
    case 'USD':
      return {
        majorUnit: 'US Dollars',
        fractionalUnit: 'cents',
      };
    case 'GBP':
      return {
        majorUnit: 'Pounds Sterling',
        fractionalUnit: 'pence',
      };
    default:
      return {
        majorUnit: currency,
        fractionalUnit: 'cents',
      };
  }
}

function numberToWords(value: number): string {
  if (value === 0) {
    return 'Zero';
  }

  const units = [
    '',
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
    'eleven',
    'twelve',
    'thirteen',
    'fourteen',
    'fifteen',
    'sixteen',
    'seventeen',
    'eighteen',
    'nineteen',
  ];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  function underThousand(input: number): string {
    const hundred = Math.floor(input / 100);
    const rest = input % 100;
    const parts: string[] = [];
    if (hundred) {
      parts.push(`${units[hundred]} hundred`);
    }
    if (rest < 20) {
      if (rest) {
        parts.push(units[rest]);
      }
    } else {
      parts.push(`${tens[Math.floor(rest / 10)]}${rest % 10 ? ` ${units[rest % 10]}` : ''}`);
    }
    return parts.join(' ');
  }

  const scales = [
    { value: 1_000_000_000, label: 'billion' },
    { value: 1_000_000, label: 'million' },
    { value: 1_000, label: 'thousand' },
  ];
  let remaining = value;
  const parts: string[] = [];
  for (const scale of scales) {
    const count = Math.floor(remaining / scale.value);
    if (count) {
      parts.push(`${underThousand(count)} ${scale.label}`);
      remaining %= scale.value;
    }
  }
  if (remaining) {
    parts.push(underThousand(remaining));
  }

  const text = parts.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function defaultInvoiceTemplateKey(countryCode: string, pdfStyle: string | undefined): string {
  const normalized = countryCode.trim().toUpperCase();
  if (normalized === 'IN') {
    return pdfStyle === 'advanced' ? 'IN_GST_LETTERHEAD_PRO' : 'IN_GST_STANDARD_FREE';
  }
  if (normalized === 'US') {
    return pdfStyle === 'advanced' ? 'US_SALES_PRO' : 'US_SALES_STANDARD_FREE';
  }
  if (normalized === 'GB') {
    return pdfStyle === 'advanced' ? 'UK_VAT_LETTERHEAD_PRO' : 'UK_VAT_STANDARD_FREE';
  }
  return pdfStyle === 'advanced' ? 'GENERIC_INVOICE_LETTERHEAD_PRO' : 'GENERIC_INVOICE_STANDARD_FREE';
}

function defaultInvoiceTemplateLabel(countryCode: string, pdfStyle: string | undefined): string {
  const normalized = countryCode.trim().toUpperCase();
  if (normalized === 'IN') {
    return pdfStyle === 'advanced' ? 'India GST Letterhead' : 'India GST Standard';
  }
  if (normalized === 'US') {
    return pdfStyle === 'advanced' ? 'US Sales Pro' : 'US Sales Standard';
  }
  if (normalized === 'GB') {
    return pdfStyle === 'advanced' ? 'UK VAT Letterhead' : 'UK VAT Standard';
  }
  return pdfStyle === 'advanced' ? 'Premium Letterhead' : 'Standard Invoice';
}

function defaultCountryFormat(countryCode: string): string {
  const normalized = countryCode.trim().toUpperCase();
  if (normalized === 'IN') {
    return 'india_gst';
  }
  if (normalized === 'US') {
    return 'us_sales_tax';
  }
  if (normalized === 'GB') {
    return 'uk_vat';
  }
  return 'generic_tax';
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function money(
  amount: number,
  currency: string,
  locale?: string,
  currencyDisplay?: 'symbol' | 'narrowSymbol' | 'code' | 'name'
): DocumentMoney {
  return {
    amount,
    currency,
    formatted: formatCurrency(amount, currency, { locale, currencyDisplay }),
  };
}

function imageAsset(uri: string | null, alt: string): DocumentImageAsset | null {
  return uri ? { uri, alt } : null;
}
