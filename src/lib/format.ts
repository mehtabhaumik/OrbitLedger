type CurrencyFormatOptions = {
  locale?: string;
  signDisplay?: 'auto' | 'never' | 'always';
  currencyDisplay?: 'symbol' | 'narrowSymbol' | 'code' | 'name';
};

export function formatCurrency(
  amount: number,
  currency: string,
  options: CurrencyFormatOptions = {}
): string {
  const normalizedCurrency = normalizeCurrencyCode(currency);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const sign = getCurrencySign(safeAmount, options.signDisplay ?? 'auto');
  const currencyDisplay = getCurrencyDisplay(
    normalizedCurrency,
    options.locale,
    options.currencyDisplay ?? 'narrowSymbol'
  );
  const value = formatMoneyNumber(Math.abs(safeAmount), options.locale);

  return `${sign}${currencyDisplay} ${value}`;
}

export function formatSignedCurrency(
  amount: number,
  currency: string,
  type: 'credit' | 'payment',
  options: Omit<CurrencyFormatOptions, 'signDisplay'> = {}
): string {
  const sign = type === 'credit' ? '+ ' : '- ';

  return `${sign}${formatCurrency(Math.abs(amount), currency, {
    ...options,
    signDisplay: 'never',
  })}`;
}

function normalizeCurrencyCode(currency: string): string {
  const normalizedCurrency = currency.trim().toUpperCase();

  return /^[A-Z]{3}$/.test(normalizedCurrency) ? normalizedCurrency : 'INR';
}

function getCurrencySign(amount: number, signDisplay: CurrencyFormatOptions['signDisplay']): string {
  if (signDisplay === 'never' || amount === 0) {
    return '';
  }

  if (amount < 0) {
    return '- ';
  }

  return signDisplay === 'always' ? '+ ' : '';
}

function getCurrencyDisplay(
  currency: string,
  locale?: string,
  currencyDisplay: NonNullable<CurrencyFormatOptions['currencyDisplay']> = 'narrowSymbol'
): string {
  try {
    const currencyPart = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value;

    return currencyPart?.trim() || currency;
  } catch {
    return currency;
  }
}

function formatMoneyNumber(amount: number, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    const [whole, decimals] = amount.toFixed(2).split('.');
    return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${decimals}`;
  }
}

export function formatTransactionType(type: 'credit' | 'payment'): string {
  return type === 'credit' ? 'Credit given' : 'Payment received';
}

export function formatShortDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
  });
}
