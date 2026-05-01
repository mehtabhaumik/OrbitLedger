'use client';

import {
  addDoc,
  collection,
  doc,
  documentId,
  type Firestore,
  getDoc,
  getDocs,
  increment,
  limit as limitQuery,
  orderBy,
  query,
  type QueryDocumentSnapshot,
  updateDoc,
  where,
  writeBatch,
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

export type WorkspaceInvoiceItem = {
  id: string;
  invoiceId: string;
  productId: string | null;
  name: string;
  description: string | null;
  quantity: number;
  price: number;
  taxRate: number;
  total: number;
};

export type WorkspaceInvoiceDetail = WorkspaceInvoice & {
  dueDate: string | null;
  notes: string | null;
  items: WorkspaceInvoiceItem[];
};

export type SaveWorkspaceInvoiceInput = {
  customerId: string | null;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  status: string;
  notes: string | null;
  items: Array<{
    id?: string;
    name: string;
    description?: string | null;
    quantity: number;
    price: number;
    taxRate: number;
  }>;
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

const CUSTOMER_LIST_LIMIT = 100;
const TRANSACTION_LIST_LIMIT = 150;
const INVOICE_LIST_LIMIT = 100;
const FIRESTORE_IN_QUERY_LIMIT = 10;

export async function listWorkspaceCustomers(workspaceId: string): Promise<WorkspaceCustomer[]> {
  const customerSnapshot = await getDocs(
    query(
      collection(getWebFirestore(), 'workspaces', workspaceId, 'customers'),
      orderBy('updated_at', 'desc'),
      limitQuery(CUSTOMER_LIST_LIMIT)
    )
  );

  return customerSnapshot.docs
    .map((entry) => mapCustomer(entry))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function getWorkspaceCustomer(
  workspaceId: string,
  customerId: string
): Promise<WorkspaceCustomer | null> {
  const firestore = getWebFirestore();
  const customerRef = doc(firestore, 'workspaces', workspaceId, 'customers', customerId);
  const [customerSnapshot, transactionSnapshot] = await Promise.all([
    getDoc(customerRef),
    getDocs(
      query(
        collection(firestore, 'workspaces', workspaceId, 'transactions'),
        where('customer_id', '==', customerId)
      )
    ),
  ]);

  if (!customerSnapshot.exists()) {
    return null;
  }

  const balanceDeltas = new Map<string, number>();
  for (const entry of transactionSnapshot.docs) {
    const data = entry.data() as { type?: 'credit' | 'payment'; amount?: number };
    if (typeof data.amount !== 'number') {
      continue;
    }
    balanceDeltas.set(
      customerId,
      (balanceDeltas.get(customerId) ?? 0) + (data.type === 'credit' ? data.amount : -data.amount)
    );
  }

  return mapCustomer(customerSnapshot, balanceDeltas);
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
    current_balance: Number.isFinite(input.openingBalance) ? Number(input.openingBalance) : 0,
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
  const transactionSnapshot = await getDocs(
    query(
      collection(firestore, 'workspaces', workspaceId, 'transactions'),
      orderBy('created_at', 'desc'),
      limitQuery(TRANSACTION_LIST_LIMIT)
    )
  );
  const customerNames = await loadCustomerNamesForTransactions(firestore, workspaceId, transactionSnapshot.docs);

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
    });
}

export async function listWorkspaceCustomerTransactions(
  workspaceId: string,
  customerId: string
): Promise<WorkspaceTransaction[]> {
  const firestore = getWebFirestore();
  const customer = await getWorkspaceCustomer(workspaceId, customerId);
  if (!customer) {
    return [];
  }

  const transactionSnapshot = await getDocs(
    query(
      collection(firestore, 'workspaces', workspaceId, 'transactions'),
      where('customer_id', '==', customerId),
      orderBy('created_at', 'desc'),
      limitQuery(TRANSACTION_LIST_LIMIT)
    )
  );

  return transactionSnapshot.docs.map((entry) => {
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
      customerId: data.customer_id ?? customerId,
      customerName: customer.name,
      type: data.type ?? 'payment',
      amount: data.amount ?? 0,
      note: data.note ?? null,
      effectiveDate: data.effective_date ?? '',
      createdAt: data.created_at ?? '',
    } satisfies WorkspaceTransaction;
  });
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

  const transactionRef = doc(collection(firestore, 'workspaces', workspaceId, 'transactions'));
  const delta = input.type === 'credit' ? input.amount : -input.amount;
  const batch = writeBatch(firestore);
  batch.set(transactionRef, payload);
  batch.update(customerRef, {
    current_balance: increment(delta),
    updated_at: now,
    last_modified: now,
  });
  await batch.commit();
  return {
    id: transactionRef.id,
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
  const snapshot = await getDocs(
    query(
      collection(getWebFirestore(), 'workspaces', workspaceId, 'invoices'),
      orderBy('issue_date', 'desc'),
      limitQuery(INVOICE_LIST_LIMIT)
    )
  );
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
    });
}

export async function getWorkspaceInvoiceDetail(
  workspaceId: string,
  invoiceId: string
): Promise<WorkspaceInvoiceDetail | null> {
  const firestore = getWebFirestore();
  const [invoiceSnapshot, itemSnapshot] = await Promise.all([
    getDoc(doc(firestore, 'workspaces', workspaceId, 'invoices', invoiceId)),
    getDocs(
      query(
        collection(firestore, 'workspaces', workspaceId, 'invoice_items'),
        where('invoice_id', '==', invoiceId)
      )
    ),
  ]);

  if (!invoiceSnapshot.exists()) {
    return null;
  }

  const data = invoiceSnapshot.data() as {
    customer_id?: string | null;
    invoice_number?: string;
    issue_date?: string;
    due_date?: string | null;
    total_amount?: number;
    status?: string;
    notes?: string | null;
  };

  return {
    id: invoiceSnapshot.id,
    customerId: data.customer_id ?? null,
    invoiceNumber: data.invoice_number ?? invoiceSnapshot.id.slice(0, 8).toUpperCase(),
    issueDate: data.issue_date ?? '',
    dueDate: data.due_date ?? null,
    totalAmount: data.total_amount ?? 0,
    status: data.status ?? 'draft',
    notes: data.notes ?? null,
    items: itemSnapshot.docs.map(mapInvoiceItem).sort((left, right) => left.name.localeCompare(right.name)),
  };
}

export async function saveWorkspaceInvoiceDetail(
  workspaceId: string,
  invoiceId: string,
  input: SaveWorkspaceInvoiceInput
): Promise<WorkspaceInvoiceDetail> {
  const firestore = getWebFirestore();
  const invoiceRef = doc(firestore, 'workspaces', workspaceId, 'invoices', invoiceId);
  const existingItems = await getDocs(
    query(
      collection(firestore, 'workspaces', workspaceId, 'invoice_items'),
      where('invoice_id', '==', invoiceId)
    )
  );
  const now = new Date().toISOString();
  const cleanItems = input.items
    .map((item) => {
      const quantity = Number.isFinite(item.quantity) ? Number(item.quantity) : 0;
      const price = Number.isFinite(item.price) ? Number(item.price) : 0;
      const taxRate = Number.isFinite(item.taxRate) ? Number(item.taxRate) : 0;
      const subtotal = quantity * price;
      const total = subtotal + subtotal * (taxRate / 100);
      return {
        ...item,
        name: item.name.trim(),
        description: item.description?.trim() || null,
        quantity,
        price,
        taxRate,
        total,
      };
    })
    .filter((item) => item.name && item.quantity > 0 && item.price >= 0);
  const subtotal = cleanItems.reduce((total, item) => total + item.quantity * item.price, 0);
  const taxAmount = cleanItems.reduce((total, item) => total + item.quantity * item.price * (item.taxRate / 100), 0);
  const totalAmount = subtotal + taxAmount;
  const batch = writeBatch(firestore);
  const retainedIds = new Set(cleanItems.map((item) => item.id).filter(Boolean));

  batch.update(invoiceRef, {
    customer_id: input.customerId,
    invoice_number: input.invoiceNumber.trim(),
    issue_date: input.issueDate,
    due_date: input.dueDate || null,
    subtotal,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    status: input.status,
    notes: input.notes?.trim() || null,
    last_modified: now,
  });

  for (const entry of existingItems.docs) {
    if (!retainedIds.has(entry.id)) {
      batch.delete(entry.ref);
    }
  }

  for (const item of cleanItems) {
    const itemRef = item.id
      ? doc(firestore, 'workspaces', workspaceId, 'invoice_items', item.id)
      : doc(collection(firestore, 'workspaces', workspaceId, 'invoice_items'));
    batch.set(
      itemRef,
      {
        invoice_id: invoiceId,
        product_id: null,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        price: item.price,
        tax_rate: item.taxRate,
        total: item.total,
        last_modified: now,
        sync_status: 'synced',
        server_revision: 1,
      },
      { merge: true }
    );
  }

  await batch.commit();
  const updated = await getWorkspaceInvoiceDetail(workspaceId, invoiceId);
  if (!updated) {
    throw new Error('Invoice could not be loaded after saving.');
  }
  return updated;
}

async function loadCustomerNamesForTransactions(
  firestore: Firestore,
  workspaceId: string,
  transactions: QueryDocumentSnapshot[]
): Promise<Map<string, string>> {
  const customerIds = Array.from(
    new Set(
      transactions
        .map((entry) => String((entry.data() as { customer_id?: string }).customer_id ?? ''))
        .filter(Boolean)
    )
  );

  if (!customerIds.length) {
    return new Map();
  }

  const snapshots = await Promise.all(
    chunk(customerIds, FIRESTORE_IN_QUERY_LIMIT).map((ids) =>
      getDocs(
        query(
          collection(firestore, 'workspaces', workspaceId, 'customers'),
          where(documentId(), 'in', ids)
        )
      )
    )
  );

  const names = new Map<string, string>();
  for (const entry of snapshots.flatMap((snapshot) => snapshot.docs)) {
    names.set(entry.id, String((entry.data() as { name?: string }).name ?? 'Customer'));
  }
  return names;
}

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
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
  balanceDeltas?: Map<string, number>
): WorkspaceCustomer {
  const data = entry.data() as {
    name?: string;
    phone?: string | null;
    address?: string | null;
    notes?: string | null;
    opening_balance?: number;
    current_balance?: number;
    balance?: number;
    is_archived?: boolean;
    created_at?: string;
    updated_at?: string;
  };

  const openingBalance = data.opening_balance ?? 0;
  const storedBalance =
    typeof data.current_balance === 'number'
      ? data.current_balance
      : typeof data.balance === 'number'
        ? data.balance
        : openingBalance;
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
    balance: balanceDeltas?.has(entry.id) ? openingBalance + (balanceDeltas.get(entry.id) ?? 0) : storedBalance,
  };
}

function mapInvoiceItem(entry: QueryDocumentSnapshot): WorkspaceInvoiceItem {
  const data = entry.data() as {
    invoice_id?: string;
    product_id?: string | null;
    name?: string;
    description?: string | null;
    quantity?: number;
    price?: number;
    tax_rate?: number;
    total?: number;
  };
  return {
    id: entry.id,
    invoiceId: data.invoice_id ?? '',
    productId: data.product_id ?? null,
    name: data.name ?? 'Item',
    description: data.description ?? null,
    quantity: data.quantity ?? 0,
    price: data.price ?? 0,
    taxRate: data.tax_rate ?? 0,
    total: data.total ?? 0,
  };
}
