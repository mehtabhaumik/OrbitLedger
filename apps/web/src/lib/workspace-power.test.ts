import { describe, expect, it } from 'vitest';
import { buildCustomerHealthScore } from '@orbit-ledger/core';

import {
  buildCsv,
  filterWorkspaceCustomers,
  filterWorkspaceInvoices,
  filterWorkspaceTransactions,
  makeExportFileName,
  parseCustomerImportCsv,
  pickSelectedRows,
  sumCustomerBalances,
  sumInvoiceTotals,
  sumTransactionAmounts,
  type DateRangeFilter,
} from './workspace-power';
import type {
  WorkspaceCustomer,
  WorkspaceInvoice,
  WorkspaceTransaction,
} from './workspace-data';

const range: DateRangeFilter = { from: '2026-04-01', to: '2026-04-30' };

describe('workspace power helpers', () => {
  it('filters customer cleanup views by search and balance state', () => {
    const customers: WorkspaceCustomer[] = [
      makeCustomer({ id: 'a', name: 'Asha Traders', phone: '+91 98765 43210', balance: 500 }),
      makeCustomer({ id: 'b', name: 'Blue Store', phone: null, balance: -80 }),
      makeCustomer({ id: 'c', name: 'City Mart', phone: null, balance: 0 }),
    ];

    expect(
      filterWorkspaceCustomers(customers, {
        query: 'asha',
        balanceFilter: 'outstanding',
      }).map((customer) => customer.id)
    ).toEqual(['a']);
    expect(sumCustomerBalances(customers)).toMatchObject({
      outstanding: 500,
      outstandingCount: 1,
      advance: 80,
      advanceCount: 1,
      settledCount: 1,
    });
  });

  it('filters transactions by type and date range', () => {
    const transactions: WorkspaceTransaction[] = [
      makeTransaction({ id: 'a', type: 'payment', amount: 120, effectiveDate: '2026-04-12' }),
      makeTransaction({ id: 'b', type: 'credit', amount: 220, effectiveDate: '2026-04-14' }),
      makeTransaction({ id: 'c', type: 'payment', amount: 320, effectiveDate: '2026-05-01' }),
    ];

    const visible = filterWorkspaceTransactions(transactions, {
      query: '',
      typeFilter: 'payment',
      range,
    });

    expect(visible.map((transaction) => transaction.id)).toEqual(['a']);
    expect(sumTransactionAmounts(transactions)).toEqual({ payments: 440, credits: 220 });
  });

  it('filters invoices by payment status and date range', () => {
    const invoices: WorkspaceInvoice[] = [
      makeInvoice({ id: 'a', invoiceNumber: 'INV-1', status: 'paid', paymentStatus: 'paid', issueDate: '2026-04-02', totalAmount: 300 }),
      makeInvoice({ id: 'b', invoiceNumber: 'INV-2', status: 'draft', issueDate: '2026-04-12', totalAmount: 100 }),
      makeInvoice({ id: 'c', invoiceNumber: 'INV-3', status: 'paid', paymentStatus: 'paid', issueDate: '2026-05-02', totalAmount: 500 }),
    ];

    const visible = filterWorkspaceInvoices(invoices, {
      query: 'inv',
      filters: { customerIds: [], documentStates: [], paymentStatuses: ['paid'] },
      range,
    });

    expect(visible.map((invoice) => invoice.id)).toEqual(['a']);
    expect(sumInvoiceTotals(invoices)).toMatchObject({
      total: 900,
      byStatus: {
        paid: 2,
        draft: 1,
      },
    });
  });

  it('uses selected rows for exports when any row is selected', () => {
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

    expect(pickSelectedRows(rows, new Set(['b']))).toEqual([{ id: 'b' }]);
    expect(pickSelectedRows(rows, new Set())).toEqual(rows);
  });

  it('builds clean csv files', () => {
    expect(
      buildCsv(
        ['Name', 'Note'],
        [
          ['Asha Traders', 'Paid today'],
          ['Blue Store', 'Needs, follow up'],
        ]
      )
    ).toBe('Name,Note\nAsha Traders,Paid today\nBlue Store,"Needs, follow up"');
    expect(makeExportFileName(['Orbit Ledger', 'Customer List'])).toBe(
      'orbit-ledger-customer-list.csv'
    );
  });

  it('parses additive customer imports', () => {
    expect(
      parseCustomerImportCsv(
        'Name,Phone,Opening balance,Address\n"Asha, Traders",9876543210,"₹ 1,200",Market Road'
      )
    ).toEqual([
      {
        rowNumber: 2,
        name: 'Asha, Traders',
        phone: '9876543210',
        openingBalance: 1200,
        address: 'Market Road',
      },
    ]);
  });

  it('rejects customer imports without a name column', () => {
    expect(() => parseCustomerImportCsv('Phone\n9876543210')).toThrow('Name column');
  });
});

function makeCustomer(overrides: Partial<WorkspaceCustomer>): WorkspaceCustomer {
  return {
    id: 'customer',
    name: 'Customer',
    phone: null,
    address: null,
    notes: null,
    openingBalance: 0,
    isArchived: false,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    balance: 0,
    health: buildCustomerHealthScore({ balance: overrides.balance ?? 0 }),
    ...overrides,
  };
}

function makeTransaction(overrides: Partial<WorkspaceTransaction>): WorkspaceTransaction {
  return {
    id: 'transaction',
    customerId: 'customer',
    customerName: 'Asha Traders',
    type: 'payment',
    amount: 0,
    note: null,
    paymentMode: null,
    paymentDetails: null,
    effectiveDate: '2026-04-01',
    createdAt: '2026-04-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeInvoice(overrides: Partial<WorkspaceInvoice>): WorkspaceInvoice {
  return {
    id: 'invoice',
    customerId: null,
    customerName: null,
    invoiceNumber: 'INV',
    issueDate: '2026-04-01',
    totalAmount: 0,
    paidAmount: 0,
    status: 'draft',
    documentState: 'draft',
    paymentStatus: 'unpaid',
    versionNumber: 0,
    versions: [],
    ...overrides,
  };
}
