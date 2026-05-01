import type {
  WorkspaceCustomer,
  WorkspaceInvoice,
  WorkspaceTransaction,
} from './workspace-data';

export type DateRangeFilter = {
  from: string;
  to: string;
};

export type CustomerBalanceFilter = 'all' | 'outstanding' | 'advance' | 'settled';
export type TransactionTypeFilter = 'all' | 'payment' | 'credit';

export type InvoiceFilterSet = {
  customerIds: string[];
  documentStates: string[];
  paymentStatuses: string[];
};

export type CsvCell = string | number | boolean | null | undefined;

export type CustomerImportRow = {
  rowNumber: number;
  name: string;
  phone: string | null;
  address: string | null;
  openingBalance: number;
};

export function filterWorkspaceCustomers(
  customers: WorkspaceCustomer[],
  options: {
    query: string;
    balanceFilter: CustomerBalanceFilter;
  }
) {
  const query = options.query.trim().toLowerCase();

  return customers.filter((customer) => {
    const matchesSearch =
      !query ||
      customer.name.toLowerCase().includes(query) ||
      (customer.phone ?? '').toLowerCase().includes(query) ||
      (customer.address ?? '').toLowerCase().includes(query);
    const matchesBalance =
      options.balanceFilter === 'all' ||
      (options.balanceFilter === 'outstanding' && customer.balance > 0) ||
      (options.balanceFilter === 'advance' && customer.balance < 0) ||
      (options.balanceFilter === 'settled' && customer.balance === 0);

    return matchesSearch && matchesBalance;
  });
}

export function filterWorkspaceTransactions(
  transactions: WorkspaceTransaction[],
  options: {
    query: string;
    typeFilter: TransactionTypeFilter;
    range: DateRangeFilter;
  }
) {
  const query = options.query.trim().toLowerCase();

  return transactions.filter((transaction) => {
    const matchesSearch =
      !query ||
      transaction.customerName.toLowerCase().includes(query) ||
      (transaction.note ?? '').toLowerCase().includes(query);
    const matchesType = options.typeFilter === 'all' || transaction.type === options.typeFilter;
    const matchesRange = isDateWithinRange(transaction.effectiveDate, options.range);

    return matchesSearch && matchesType && matchesRange;
  });
}

export function filterWorkspaceInvoices(
  invoices: WorkspaceInvoice[],
  options: {
    query: string;
    filters: InvoiceFilterSet;
    range: DateRangeFilter;
  }
) {
  const query = options.query.trim().toLowerCase();

  return invoices.filter((invoice) => {
    const matchesSearch =
      !query ||
      invoice.invoiceNumber.toLowerCase().includes(query) ||
      (invoice.customerName ?? '').toLowerCase().includes(query);
    const matchesCustomer =
      !options.filters.customerIds.length ||
      (invoice.customerId ? options.filters.customerIds.includes(invoice.customerId) : false);
    const matchesDocumentState =
      !options.filters.documentStates.length ||
      options.filters.documentStates.includes(invoice.documentState);
    const matchesPaymentStatus =
      !options.filters.paymentStatuses.length ||
      options.filters.paymentStatuses.includes(invoice.paymentStatus);
    const matchesRange = isDateWithinRange(invoice.issueDate, options.range);

    return matchesSearch && matchesCustomer && matchesDocumentState && matchesPaymentStatus && matchesRange;
  });
}

export function isDateWithinRange(value: string, range: DateRangeFilter) {
  if (!value) {
    return !range.from && !range.to;
  }

  if (range.from && value < range.from) {
    return false;
  }

  if (range.to && value > range.to) {
    return false;
  }

  return true;
}

export function pickSelectedRows<T extends { id: string }>(rows: T[], selectedIds: ReadonlySet<string>) {
  if (!selectedIds.size) {
    return rows;
  }

  return rows.filter((row) => selectedIds.has(row.id));
}

export function sumCustomerBalances(customers: WorkspaceCustomer[]) {
  return customers.reduce(
    (summary, customer) => {
      if (customer.balance > 0) {
        summary.outstanding += customer.balance;
        summary.outstandingCount += 1;
      } else if (customer.balance < 0) {
        summary.advance += Math.abs(customer.balance);
        summary.advanceCount += 1;
      } else {
        summary.settledCount += 1;
      }
      return summary;
    },
    {
      outstanding: 0,
      outstandingCount: 0,
      advance: 0,
      advanceCount: 0,
      settledCount: 0,
    }
  );
}

export function sumTransactionAmounts(transactions: WorkspaceTransaction[]) {
  return transactions.reduce(
    (summary, transaction) => {
      if (transaction.type === 'payment') {
        summary.payments += transaction.amount;
      } else {
        summary.credits += transaction.amount;
      }
      return summary;
    },
    { payments: 0, credits: 0 }
  );
}

export function sumInvoiceTotals(invoices: WorkspaceInvoice[]) {
  return invoices.reduce(
    (summary, invoice) => {
      summary.total += invoice.totalAmount;
      summary.byStatus[invoice.status] = (summary.byStatus[invoice.status] ?? 0) + 1;
      return summary;
    },
    { total: 0, byStatus: {} as Record<string, number> }
  );
}

export function buildCsv(headers: string[], rows: CsvCell[][]) {
  return [headers, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}

export function parseCustomerImportCsv(contents: string): CustomerImportRow[] {
  const rows = parseCsvRows(contents).filter((row) => row.some((cell) => cell.trim()));
  if (rows.length < 2) {
    throw new Error('CSV must include a header row and at least one customer.');
  }

  const headers = rows[0].map((header) => normalizeHeader(header));
  const nameIndex = findHeaderIndex(headers, ['name', 'customer name', 'customer']);
  if (nameIndex < 0) {
    throw new Error('CSV must include a Name column.');
  }

  const phoneIndex = findHeaderIndex(headers, ['phone', 'mobile', 'contact']);
  const addressIndex = findHeaderIndex(headers, ['address']);
  const openingBalanceIndex = findHeaderIndex(headers, [
    'opening balance',
    'balance',
    'starting balance',
  ]);

  return rows.slice(1).map((row, index) => {
    const rowNumber = index + 2;
    const name = (row[nameIndex] ?? '').trim();
    if (!name) {
      throw new Error(`Row ${rowNumber} needs a customer name.`);
    }

    const openingBalanceText =
      openingBalanceIndex >= 0 ? (row[openingBalanceIndex] ?? '').trim() : '';
    const openingBalance = openingBalanceText ? parseCsvAmount(openingBalanceText) : 0;
    if (openingBalance === null) {
      throw new Error(`Row ${rowNumber} has an invalid opening balance.`);
    }

    return {
      rowNumber,
      name,
      phone: phoneIndex >= 0 ? (row[phoneIndex] ?? '').trim() || null : null,
      address: addressIndex >= 0 ? (row[addressIndex] ?? '').trim() || null : null,
      openingBalance,
    };
  });
}

export function makeExportFileName(parts: Array<string | null | undefined>, extension = 'csv') {
  const slug = parts
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return `${slug || 'orbit-ledger-export'}.${extension}`;
}

export function downloadTextFile(fileName: string, contents: string, type = 'text/csv;charset=utf-8') {
  if (typeof document === 'undefined') {
    return;
  }

  const blob = new Blob([contents], { type });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(href);
}

function escapeCsvCell(value: CsvCell) {
  const text = value === null || value === undefined ? '' : String(value);
  if (!/[",\n\r]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function parseCsvRows(contents: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let index = 0; index < contents.length; index += 1) {
    const char = contents[index];
    const nextChar = contents[index + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      currentCell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === ',' && !insideQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);
  rows.push(currentRow);
  return rows;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function findHeaderIndex(headers: string[], candidates: string[]) {
  return headers.findIndex((header) => candidates.includes(header));
}

function parseCsvAmount(value: string) {
  const normalized = value.replace(/[^0-9.-]/g, '');
  if (!normalized || normalized === '-' || normalized === '.') {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
