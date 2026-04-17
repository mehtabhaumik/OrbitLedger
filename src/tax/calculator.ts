export type TaxCalculationInput = {
  itemPrice: number;
  quantity: number;
  taxRate: number;
  precision?: number;
};

export type TaxCalculationResult = {
  taxableAmount: number;
  taxAmount: number;
  total: number;
};

const DEFAULT_MONEY_PRECISION = 2;

export function calculateItemTaxTotal(input: TaxCalculationInput): TaxCalculationResult {
  const precision = input.precision ?? DEFAULT_MONEY_PRECISION;
  assertValidPrecision(precision);

  assertFiniteNumber(input.itemPrice, 'Item price');
  assertFiniteNumber(input.quantity, 'Quantity');
  assertFiniteNumber(input.taxRate, 'Tax rate');

  if (input.itemPrice < 0) {
    throw new Error('Item price cannot be negative.');
  }

  if (input.quantity <= 0) {
    throw new Error('Quantity must be greater than zero.');
  }

  if (input.taxRate < 0) {
    throw new Error('Tax rate cannot be negative.');
  }

  const taxableAmount = roundCurrency(input.itemPrice * input.quantity, precision);
  const taxAmount = roundCurrency(taxableAmount * (input.taxRate / 100), precision);

  return {
    taxableAmount,
    taxAmount,
    total: roundCurrency(taxableAmount + taxAmount, precision),
  };
}

export function calculateTaxAmount(
  taxableAmount: number,
  taxRate: number,
  precision = DEFAULT_MONEY_PRECISION
): number {
  assertValidPrecision(precision);
  assertFiniteNumber(taxableAmount, 'Taxable amount');
  assertFiniteNumber(taxRate, 'Tax rate');

  if (taxableAmount < 0) {
    throw new Error('Taxable amount cannot be negative.');
  }

  if (taxRate < 0) {
    throw new Error('Tax rate cannot be negative.');
  }

  return roundCurrency(taxableAmount * (taxRate / 100), precision);
}

export function roundCurrency(value: number, precision = DEFAULT_MONEY_PRECISION): number {
  assertFiniteNumber(value, 'Amount');
  assertValidPrecision(precision);
  const multiplier = 10 ** precision;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

function assertFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a valid number.`);
  }
}

function assertValidPrecision(precision: number): void {
  if (!Number.isInteger(precision) || precision < 0 || precision > 6) {
    throw new Error('Precision must be an integer between 0 and 6.');
  }
}
