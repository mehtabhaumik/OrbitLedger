'use client';

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

import { getWebFirestore } from './firebase';

export type WorkspaceCustomer = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  openingBalance: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  balance: number;
};

export type WorkspaceTransaction = {
  id: string;
  customerId: string;
  customerName: string;
  type: 'credit' | 'payment';
  amount: number;
  note: string | null;
  effectiveDate: string;
  createdAt: string;
};

export type WorkspaceInvoice = {
  id: string;
  customerId: string | null;
  invoiceNumber: string;
  issueDate: string;
  totalAmount: number;
  status: string;
};

export type CreateWorkspaceCustomerInput = {
  name: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  openingBalance?: number;
};

export type CreateWorkspaceTransactionInput = {
  customerId: string;
  type: 'credit' | 'payment';
  amount: number;
  note?: string | null;
  effectiveDate?: string;
};

export async function listWorkspaceCustomers(workspaceId: string): Promise<WorkspaceCustomer[]> {
  const firestore = getWebFirestore();
  const [customerSnapshot, transactionSnapshot] = await Promise.all([
    getDocs(collection(firestore, 'workspaces', workspaceId, 'customers')),
    getDocs(collection(firestore, 'workspaces', workspaceId, 'transactions')),
  ]);

  const balanceDeltas = new Map<string, number>();
  for (const entry of transactionSnapshot.docs) {
    const data = entry.data() as { customer_id?: string; type?: 'credit' | 'payment'; amount?: number };
    if (!data.customer_id || typeof data.amount !== 'number') {
      continue;
    }

    const delta = data.type === 'credit' ? data.amount : -data.amount;
    balanceDeltas.set(data.customer_id, (balanceDeltas.get(data.customer_id) ?? 0) + delta);
  }

  return customerSnapshot.docs
    .map((entry) => mapCustomer(entry, balanceDeltas))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function createWorkspaceCustomer(
  workspaceId: string,
  input: CreateWorkspaceCustomerInput
): Promise<WorkspaceCustomer> {
  const now = new Date().toISOString();
  const payload = {
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    address: input.address?.trim() || null,
    notes: input.notes?.trim() || null,
    opening_balance: Number.isFinite(input.openingBalance) ? Number(input.openingBalance) : 0,
    is_archived: false,
    created_at: now,
    updated_at: now,
    last_modified: now,
    sync_status: 'synced',
    server_revision: 1,
  };

  const ref = await addDoc(collection(getWebFirestore(), 'workspaces', workspaceId, 'customers'), payload);
  return {
    id: ref.id,
    name: payload.name,
    phone: payload.phone,
    address: payload.address,
    notes: payload.notes,
    openingBalance: payload.opening_balance,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
    balance: payload.opening_balance,
  };
}

export async function listWorkspaceTransactions(
  workspaceId: string
): Promise<WorkspaceTransaction[]> {
  const firestore = getWebFirestore();
  const [customerSnapshot, transactionSnapshot] = await Promise.all([
    getDocs(collection(firestore, 'workspaces', workspaceId, 'customers')),
    getDocs(collection(firestore, 'workspaces', workspaceId, 'transactions')),
  ]);

  const customerNames = new Map<string, string>();
  for (const entry of customerSnapshot.docs) {
    const data = entry.data() as { name?: string };
    customerNames.set(entry.id, data.name ?? 'Customer');
  }

  return transactionSnapshot.docs
    .map((entry) => {
      const data = entry.data() as {
        customer_id?: string;
        type?: 'credit' | 'payment';
        amount?: number;
        note?: string | null;
        effective_date?: string;
        created_at?: string;
      };
      return {
        id: entry.id,
        customerId: data.customer_id ?? '',
        customerName: customerNames.get(data.customer_id ?? '') ?? 'Customer',
        type: data.type ?? 'payment',
        amount: data.amount ?? 0,
        note: data.note ?? null,
        effectiveDate: data.effective_date ?? '',
        createdAt: data.created_at ?? '',
      } satisfies WorkspaceTransaction;
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function createWorkspaceTransaction(
  workspaceId: string,
  input: CreateWorkspaceTransactionInput
): Promise<WorkspaceTransaction> {
  const firestore = getWebFirestore();
  const customerRef = doc(firestore, 'workspaces', workspaceId, 'customers', input.customerId);
  const customerSnapshot = await getDoc(customerRef);
  if (!customerSnapshot.exists()) {
    throw new Error('Choose a valid customer before saving the transaction.');
  }

  const customerName = String(customerSnapshot.data().name ?? 'Customer');
  const now = new Date().toISOString();
  const payload = {
    customer_id: input.customerId,
    type: input.type,
    amount: input.amount,
    note: input.note?.trim() || null,
    effective_date: input.effectiveDate ?? now.slice(0, 10),
    created_at: now,
    last_modified: now,
    sync_status: 'synced',
    server_revision: 1,
  };

  const ref = await addDoc(collection(firestore, 'workspaces', workspaceId, 'transactions'), payload);
  return {
    id: ref.id,
    customerId: input.customerId,
    customerName,
    type: input.type,
    amount: input.amount,
    note: payload.note,
    effectiveDate: payload.effective_date,
    createdAt: now,
  };
}

export async function listWorkspaceInvoices(workspaceId: string): Promise<WorkspaceInvoice[]> {
  const snapshot = await getDocs(collection(getWebFirestore(), 'workspaces', workspaceId, 'invoices'));
  return snapshot.docs
    .map((entry) => {
      const data = entry.data() as {
        customer_id?: string | null;
        invoice_number?: string;
        issue_date?: string;
        total_amount?: number;
        status?: string;
      };

      return {
        id: entry.id,
        customerId: data.customer_id ?? null,
        invoiceNumber: data.invoice_number ?? entry.id.slice(0, 8).toUpperCase(),
        issueDate: data.issue_date ?? '',
        totalAmount: data.total_amount ?? 0,
        status: data.status ?? 'draft',
      } satisfies WorkspaceInvoice;
    })
    .sort((left, right) => right.issueDate.localeCompare(left.issueDate));
}

export async function createDraftWorkspaceInvoice(workspaceId: string): Promise<WorkspaceInvoice> {
  const now = new Date().toISOString();
  const payload = {
    customer_id: null,
    invoice_number: `WEB-${Math.floor(Date.now() / 1000).toString().slice(-6)}`,
    issue_date: now.slice(0, 10),
    due_date: null,
    subtotal: 0,
    tax_amount: 0,
    total_amount: 0,
    status: 'draft',
    notes: null,
    created_at: now,
    last_modified: now,
    sync_status: 'synced',
    server_revision: 1,
  };

  const ref = await addDoc(collection(getWebFirestore(), 'workspaces', workspaceId, 'invoices'), payload);
  return {
    id: ref.id,
    customerId: null,
    invoiceNumber: payload.invoice_number,
    issueDate: payload.issue_date,
    totalAmount: 0,
    status: 'draft',
  };
}

function mapCustomer(
  entry: QueryDocumentSnapshot,
  balanceDeltas: Map<string, number>
): WorkspaceCustomer {
  const data = entry.data() as {
    name?: string;
    phone?: string | null;
    address?: string | null;
    notes?: string | null;
    opening_balance?: number;
    is_archived?: boolean;
    created_at?: string;
    updated_at?: string;
  };

  const openingBalance = data.opening_balance ?? 0;
  return {
    id: entry.id,
    name: data.name ?? 'Unnamed customer',
    phone: data.phone ?? null,
    address: data.address ?? null,
    notes: data.notes ?? null,
    openingBalance,
    isArchived: Boolean(data.is_archived),
    createdAt: data.created_at ?? '',
    updatedAt: data.updated_at ?? data.created_at ?? '',
    balance: openingBalance + (balanceDeltas.get(entry.id) ?? 0),
  };
}
