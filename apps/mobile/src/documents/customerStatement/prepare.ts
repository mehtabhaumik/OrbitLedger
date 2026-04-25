import type { LedgerTransaction } from '../../database';
import { formatCurrency } from '../../lib/format';
import { parseDocumentTemplateConfig } from '../templates';
import type {
  CustomerStatementData,
  CustomerStatementInput,
  DocumentDateRange,
  DocumentImageAsset,
  DocumentMoney,
  DocumentTemplateRuntime,
  StatementTransactionRow,
} from '../types';

export function prepareCustomerStatementData(input: CustomerStatementInput): CustomerStatementData {
  const currency = input.businessProfile.currency;
  const includeCustomBranding = input.documentOptions?.includeCustomBranding ?? false;
  const pdfStyle = input.documentOptions?.pdfStyle ?? 'basic';
  const proTheme = pdfStyle === 'advanced' ? input.documentOptions?.proTheme ?? null : null;
  const templateConfig = parseDocumentTemplateConfig(input.documentOptions?.documentTemplate);
  const locale = templateConfig?.numberFormat?.locale ?? input.locale;
  const currencyDisplay = templateConfig?.numberFormat?.currencyDisplay;
  const template = buildTemplateRuntime(templateConfig, input.businessProfile.countryCode, pdfStyle);
  const statementDate = normalizeDate(input.statementDate ?? new Date().toISOString());
  const sortedTransactions = sortTransactions(input.transactions);
  const dateRange = resolveDateRange(sortedTransactions, input.dateRange, statementDate);
  const openingBalance = calculateOpeningBalance(
    input.customer.openingBalance,
    sortedTransactions,
    dateRange.from
  );
  const statementTransactions = sortedTransactions.filter((transaction) =>
    isWithinDateRange(transaction.effectiveDate, dateRange)
  );

  let runningBalance = openingBalance;
  let totalCredit = 0;
  let totalPayment = 0;

  const rows: StatementTransactionRow[] = statementTransactions.map((transaction) => {
    if (transaction.type === 'credit') {
      totalCredit += transaction.amount;
      runningBalance += transaction.amount;
    } else {
      totalPayment += transaction.amount;
      runningBalance -= transaction.amount;
    }

    return {
      transactionId: transaction.id,
      date: normalizeDate(transaction.effectiveDate),
      description: transaction.note?.trim() || defaultTransactionDescription(transaction.type),
      type: transaction.type,
      credit:
        transaction.type === 'credit'
          ? money(transaction.amount, currency, locale, currencyDisplay)
          : null,
      payment:
        transaction.type === 'payment'
          ? money(transaction.amount, currency, locale, currencyDisplay)
          : null,
      runningBalance: money(runningBalance, currency, locale, currencyDisplay),
    };
  });

  return {
    kind: 'customer_statement',
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
      taxRegistrationNumber: null,
    },
    customerIdentity: {
      customerId: input.customer.id,
      name: input.customer.name,
      phone: input.customer.phone,
      address: input.customer.address,
      notes: input.customer.notes,
    },
    metadata: {
      statementDate,
      dateRange,
      currency,
    },
    transactions: rows,
    summary: {
      openingBalance: money(openingBalance, currency, locale, currencyDisplay),
      totalCredit: money(totalCredit, currency, locale, currencyDisplay),
      totalPayment: money(totalPayment, currency, locale, currencyDisplay),
      finalBalance: money(runningBalance, currency, locale, currencyDisplay),
      amountDue: money(Math.abs(runningBalance), currency, locale, currencyDisplay),
      dueMessage: describeStatementBalance(runningBalance, input.customer.name, currency, locale, currencyDisplay),
      lastTransactionDate: rows[rows.length - 1]?.date ?? null,
    },
    taxPlaceholder: {
      taxSection: {
        status: 'not_configured',
        message:
          'Customer statements summarize ledger dues and payments. Invoice tax totals are handled in invoice documents and compliance reports.',
      },
      taxBreakdown: {
        rows: [],
        message: 'Country and region tax breakdown rows are available in invoice and compliance summaries when local tax data is configured.',
      },
      taxRegistrationNumber: null,
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
      customerId: input.customer.id,
      transactionIds: rows.map((row) => row.transactionId),
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
  const templateKey = readString(metadata.templateKey) ?? defaultStatementTemplateKey(countryCode, pdfStyle);
  const label = readString(metadata.templateLabel) ?? defaultStatementTemplateLabel(countryCode, pdfStyle);
  const visualStyle = readString(metadata.visualStyle) ?? (pdfStyle === 'advanced' ? 'account_letterhead' : 'balance_forward');
  const tier = readString(metadata.templateTier) === 'pro' || pdfStyle === 'advanced' ? 'pro' : 'free';

  return {
    key: templateKey as DocumentTemplateRuntime['key'],
    label,
    tier,
    visualStyle: visualStyle as DocumentTemplateRuntime['visualStyle'],
    description: readString(metadata.description) ?? label,
  };
}

function describeStatementBalance(
  balance: number,
  customerName: string,
  currency: string,
  locale: string | undefined,
  currencyDisplay: 'symbol' | 'narrowSymbol' | 'code' | 'name' | undefined
): string {
  const formatted = money(Math.abs(balance), currency, locale, currencyDisplay).formatted;
  if (balance > 0) {
    return `${customerName} owes you ${formatted}.`;
  }
  if (balance < 0) {
    return `You owe ${customerName} ${formatted}.`;
  }
  return 'This account is settled for the selected statement period.';
}

function defaultStatementTemplateKey(countryCode: string, pdfStyle: string): string {
  const normalized = countryCode.trim().toUpperCase();
  if (normalized === 'IN') {
    return pdfStyle === 'advanced' ? 'IN_STATEMENT_LETTERHEAD_PRO' : 'IN_STATEMENT_STANDARD_FREE';
  }
  if (normalized === 'US') {
    return pdfStyle === 'advanced' ? 'US_STATEMENT_LETTERHEAD_PRO' : 'US_STATEMENT_STANDARD_FREE';
  }
  if (normalized === 'GB') {
    return pdfStyle === 'advanced' ? 'UK_STATEMENT_LETTERHEAD_PRO' : 'UK_STATEMENT_STANDARD_FREE';
  }
  return pdfStyle === 'advanced' ? 'GENERIC_STATEMENT_LETTERHEAD_PRO' : 'GENERIC_STATEMENT_STANDARD_FREE';
}

function defaultStatementTemplateLabel(countryCode: string, pdfStyle: string): string {
  const normalized = countryCode.trim().toUpperCase();
  if (normalized === 'IN') {
    return pdfStyle === 'advanced' ? 'India Statement Letterhead' : 'India Statement Standard';
  }
  if (normalized === 'US') {
    return pdfStyle === 'advanced' ? 'US Statement Letterhead' : 'US Statement Standard';
  }
  if (normalized === 'GB') {
    return pdfStyle === 'advanced' ? 'UK Statement Letterhead' : 'UK Statement Standard';
  }
  return pdfStyle === 'advanced' ? 'Statement Letterhead' : 'Statement Standard';
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function calculateOpeningBalance(
  customerOpeningBalance: number,
  sortedTransactions: LedgerTransaction[],
  rangeStart: string
): number {
  return sortedTransactions.reduce((balance, transaction) => {
    if (normalizeDate(transaction.effectiveDate) >= rangeStart) {
      return balance;
    }

    return balance + (transaction.type === 'credit' ? transaction.amount : -transaction.amount);
  }, customerOpeningBalance);
}

function sortTransactions(transactions: LedgerTransaction[]): LedgerTransaction[] {
  return [...transactions].sort((first, second) => {
    const dateComparison = normalizeDate(first.effectiveDate).localeCompare(
      normalizeDate(second.effectiveDate)
    );

    if (dateComparison !== 0) {
      return dateComparison;
    }

    return first.createdAt.localeCompare(second.createdAt);
  });
}

function resolveDateRange(
  sortedTransactions: LedgerTransaction[],
  requestedRange: Partial<DocumentDateRange> | undefined,
  statementDate: string
): DocumentDateRange {
  const firstTransactionDate = sortedTransactions[0]?.effectiveDate;
  const lastTransactionDate = sortedTransactions[sortedTransactions.length - 1]?.effectiveDate;
  const from = normalizeDate(requestedRange?.from ?? firstTransactionDate ?? statementDate);
  const to = normalizeDate(requestedRange?.to ?? lastTransactionDate ?? statementDate);

  return from <= to ? { from, to } : { from: to, to: from };
}

function isWithinDateRange(value: string, dateRange: DocumentDateRange): boolean {
  const normalizedValue = normalizeDate(value);
  return normalizedValue >= dateRange.from && normalizedValue <= dateRange.to;
}

function defaultTransactionDescription(type: LedgerTransaction['type']): string {
  return type === 'credit' ? 'Credit entry' : 'Payment received';
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

function normalizeDate(value: string): string {
  return value.slice(0, 10);
}
