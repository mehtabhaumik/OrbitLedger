export type LocalBusinessPackLookup = {
  countryCode?: string | null;
  regionCode?: string | null;
};

export type LocalReminderTone = 'polite' | 'firm' | 'final';

export type LocalBusinessPack = {
  marketCode: 'IN' | 'US' | 'GB' | 'GENERIC';
  countryCode: string;
  regionCode: string;
  marketName: string;
  packageName: string;
  locale?: string;
  currencyCode: string;
  phone: {
    dialCode: string;
    nationalLength: number;
    example: string;
    formatNational: (digits: string) => string;
  };
  labels: {
    taxName: string;
    taxId: string;
    taxSummary: string;
    businessId: string;
    payment: string;
  };
  documents: {
    invoiceTitle: string;
    statementTitle: string;
    buyerLabel: string;
    invoiceDetailsLabel: string;
    itemTableLabel: string;
    statementActivityLabel: string;
    statementSummaryLabel: string;
  };
  reminders: {
    toneDescriptions: Record<LocalReminderTone, string>;
    politeAction: string;
    firmAction: string;
    finalAction: string;
    signOff: string;
  };
  rhythms: {
    dailyCloseLabel: string;
    collectionWindow: string;
    seasonalNotes: string[];
  };
  compliance: {
    summaryLabel: string;
    disclaimer: string;
  };
};

const genericPhone = {
  dialCode: '+',
  nationalLength: 10,
  example: '+00 00000 00000',
  formatNational(digits: string) {
    return `${digits.slice(0, 5)} ${digits.slice(5)}`.trim();
  },
};

const localBusinessPacks: Record<LocalBusinessPack['marketCode'], LocalBusinessPack> = {
  IN: {
    marketCode: 'IN',
    countryCode: 'IN',
    regionCode: '',
    marketName: 'India',
    packageName: 'India Business Pack',
    locale: 'en-IN',
    currencyCode: 'INR',
    phone: {
      dialCode: '+91',
      nationalLength: 10,
      example: '+91 98765 43210',
      formatNational(digits) {
        return `${digits.slice(0, 5)} ${digits.slice(5)}`;
      },
    },
    labels: {
      taxName: 'GST',
      taxId: 'GSTIN',
      taxSummary: 'GST summary',
      businessId: 'GSTIN',
      payment: 'payment',
    },
    documents: {
      invoiceTitle: 'Tax Invoice',
      statementTitle: 'Statement of Account',
      buyerLabel: 'Buyer Details',
      invoiceDetailsLabel: 'Invoice Details',
      itemTableLabel: 'Taxable Items / Services',
      statementActivityLabel: 'Ledger Activity',
      statementSummaryLabel: 'Account Summary',
    },
    reminders: {
      toneDescriptions: {
        polite: 'Warm follow-up for regular customers.',
        firm: 'Clear payment request for overdue dues.',
        final: 'Strong but respectful final reminder.',
      },
      politeAction: 'Please share the payment when convenient.',
      firmAction: 'Please arrange the payment at the earliest or share an update.',
      finalAction: 'Please clear this amount as soon as possible so the account can stay updated.',
      signOff: 'Thank you',
    },
    rhythms: {
      dailyCloseLabel: 'Daily closing',
      collectionWindow: 'Morning follow-ups and evening closing',
      seasonalNotes: [
        'Review collections before month-end.',
        'Keep festival-season dues visible before stock buying picks up.',
      ],
    },
    compliance: {
      summaryLabel: 'Starter GST summary',
      disclaimer:
        'Starter GST labels and summaries only. Confirm filing and invoice requirements with a qualified professional.',
    },
  },
  US: {
    marketCode: 'US',
    countryCode: 'US',
    regionCode: '',
    marketName: 'United States',
    packageName: 'United States Business Pack',
    locale: 'en-US',
    currencyCode: 'USD',
    phone: {
      dialCode: '+1',
      nationalLength: 10,
      example: '+1 415 555 0123',
      formatNational(digits) {
        return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
      },
    },
    labels: {
      taxName: 'Sales tax',
      taxId: 'Seller permit',
      taxSummary: 'Sales tax summary',
      businessId: 'Business ID',
      payment: 'payment',
    },
    documents: {
      invoiceTitle: 'Sales Invoice',
      statementTitle: 'Statement of Account',
      buyerLabel: 'Bill To',
      invoiceDetailsLabel: 'Invoice Details',
      itemTableLabel: 'Items / Services',
      statementActivityLabel: 'Account Activity',
      statementSummaryLabel: 'Account Summary',
    },
    reminders: {
      toneDescriptions: {
        polite: 'Friendly follow-up for regular customers.',
        firm: 'Clear request when payment needs attention.',
        final: 'Strong but professional final reminder.',
      },
      politeAction: 'Please send the payment when convenient.',
      firmAction: 'Please arrange payment at your earliest convenience or send an update.',
      finalAction: 'Please clear this balance as soon as possible so the account can stay current.',
      signOff: 'Thank you',
    },
    rhythms: {
      dailyCloseLabel: 'Daily close',
      collectionWindow: 'Start-of-day collections and end-of-day review',
      seasonalNotes: ['Review unpaid balances before month-end reporting.'],
    },
    compliance: {
      summaryLabel: 'Starter sales tax summary',
      disclaimer:
        'Starter sales tax labels and summaries only. Confirm reporting requirements with a qualified professional.',
    },
  },
  GB: {
    marketCode: 'GB',
    countryCode: 'GB',
    regionCode: '',
    marketName: 'United Kingdom',
    packageName: 'United Kingdom Business Pack',
    locale: 'en-GB',
    currencyCode: 'GBP',
    phone: {
      dialCode: '+44',
      nationalLength: 10,
      example: '+44 7400 123456',
      formatNational(digits) {
        return `${digits.slice(0, 4)} ${digits.slice(4)}`;
      },
    },
    labels: {
      taxName: 'VAT',
      taxId: 'VAT reg no.',
      taxSummary: 'VAT summary',
      businessId: 'Business ID',
      payment: 'payment',
    },
    documents: {
      invoiceTitle: 'VAT Invoice',
      statementTitle: 'Statement of Account',
      buyerLabel: 'Bill To',
      invoiceDetailsLabel: 'VAT Invoice Details',
      itemTableLabel: 'Items / Services',
      statementActivityLabel: 'Account Activity',
      statementSummaryLabel: 'Account Summary',
    },
    reminders: {
      toneDescriptions: {
        polite: 'Friendly follow-up for regular customers.',
        firm: 'Clear request when payment needs attention.',
        final: 'Strong but professional final reminder.',
      },
      politeAction: 'Please send the payment when convenient.',
      firmAction: 'Please arrange payment at your earliest convenience or send an update.',
      finalAction: 'Please clear this balance as soon as possible so the account can stay current.',
      signOff: 'Thank you',
    },
    rhythms: {
      dailyCloseLabel: 'Daily close',
      collectionWindow: 'Start-of-day collections and end-of-day review',
      seasonalNotes: ['Review unpaid balances before month-end reporting.'],
    },
    compliance: {
      summaryLabel: 'Starter VAT summary',
      disclaimer:
        'Starter VAT labels and summaries only. Confirm reporting requirements with a qualified professional.',
    },
  },
  GENERIC: {
    marketCode: 'GENERIC',
    countryCode: 'GENERIC',
    regionCode: '',
    marketName: 'General',
    packageName: 'General Business Pack',
    currencyCode: 'USD',
    phone: genericPhone,
    labels: {
      taxName: 'Tax',
      taxId: 'Tax ID',
      taxSummary: 'Tax summary',
      businessId: 'Business ID',
      payment: 'payment',
    },
    documents: {
      invoiceTitle: 'Invoice',
      statementTitle: 'Statement of Account',
      buyerLabel: 'Bill To',
      invoiceDetailsLabel: 'Invoice Details',
      itemTableLabel: 'Items / Services',
      statementActivityLabel: 'Account Activity',
      statementSummaryLabel: 'Account Summary',
    },
    reminders: {
      toneDescriptions: {
        polite: 'Friendly follow-up for regular customers.',
        firm: 'Clear request when payment needs attention.',
        final: 'Strong but professional final reminder.',
      },
      politeAction: 'Please send the payment when convenient.',
      firmAction: 'Please arrange the payment at the earliest or share an update.',
      finalAction: 'Please clear this amount as soon as possible so the account can stay updated.',
      signOff: 'Thank you',
    },
    rhythms: {
      dailyCloseLabel: 'Daily close',
      collectionWindow: 'Daily collections and end-of-day review',
      seasonalNotes: ['Review unpaid balances before month-end.'],
    },
    compliance: {
      summaryLabel: 'Starter tax summary',
      disclaimer:
        'Starter tax labels and summaries only. Confirm local requirements with a qualified professional.',
    },
  },
};

export function getLocalBusinessPack(lookup: LocalBusinessPackLookup = {}): LocalBusinessPack {
  const marketCode = normalizeMarketCode(lookup.countryCode);
  const pack = localBusinessPacks[marketCode];

  return {
    ...pack,
    regionCode: normalizeRegionCode(lookup.regionCode),
  };
}

export function getLocalReminderToneDescriptions(
  lookup: LocalBusinessPackLookup = {}
): Record<LocalReminderTone, string> {
  return getLocalBusinessPack(lookup).reminders.toneDescriptions;
}

export function getLocalPhoneExample(countryCode: string): string {
  return getLocalBusinessPack({ countryCode }).phone.example;
}

export function formatPhoneForLocalBusinessPack(
  countryCode: string,
  value: string
): string | null {
  const pack = getLocalBusinessPack({ countryCode });
  const dialDigits = sanitizeDigits(pack.phone.dialCode);
  let digits = sanitizeDigits(value);

  if (dialDigits && digits.startsWith(dialDigits)) {
    digits = digits.slice(dialDigits.length);
  }

  if (digits.length > pack.phone.nationalLength) {
    digits = digits.slice(-pack.phone.nationalLength);
  }

  if (digits.length !== pack.phone.nationalLength) {
    return null;
  }

  return `${pack.phone.dialCode} ${pack.phone.formatNational(digits)}`;
}

function normalizeMarketCode(countryCode: LocalBusinessPackLookup['countryCode']): LocalBusinessPack['marketCode'] {
  const normalized = (countryCode ?? '').trim().toUpperCase();
  if (normalized === 'IN' || normalized === 'US' || normalized === 'GB') {
    return normalized;
  }
  if (normalized === 'UK') {
    return 'GB';
  }
  return 'GENERIC';
}

function normalizeRegionCode(regionCode: LocalBusinessPackLookup['regionCode']): string {
  return (regionCode ?? '').trim().toUpperCase();
}

function sanitizeDigits(value: string): string {
  return value.replace(/\D/g, '');
}
