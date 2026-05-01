'use client';

import {
  buildCustomerHealthScore,
  deriveInvoicePaymentStatus,
  doesPaymentClearInvoice,
  legacyStatusForInvoiceLifecycle,
  normalizePaymentClearanceStatus,
  normalizePaymentInstrumentAttachments,
  normalizePaymentMode,
  normalizePaymentModeDetails,
  normalizeInvoiceDocumentState,
  normalizeInvoicePaymentStatus,
  validatePaymentModeDetails,
  type PaymentClearanceStatus,
  type PaymentInstrumentAttachment,
  type InvoiceDocumentState,
  type InvoicePaymentStatus,
  type PaymentAllocationStrategy,
  type CustomerHealthScore,
  type PaymentMode,
  type PaymentModeDetails,
} from '@orbit-ledger/core';
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
  health: CustomerHealthScore;
};

export type WorkspaceTransaction = {
  id: string;
  customerId: string;
  customerName: string;
  type: 'credit' | 'payment';
  amount: number;
  note: string | null;
  paymentMode: PaymentMode | null;
  paymentDetails: PaymentModeDetails | null;
  paymentClearanceStatus: PaymentClearanceStatus | null;
  paymentAttachments: PaymentInstrumentAttachment[];
  effectiveDate: string;
  createdAt: string;
};

export type WorkspaceInvoice = {
  id: string;
  customerId: string | null;
  customerName: string | null;
  invoiceNumber: string;
  issueDate: string;
  totalAmount: number;
  paidAmount: number;
  status: string;
  documentState: InvoiceDocumentState;
  paymentStatus: InvoicePaymentStatus;
  versionNumber: number;
  serverRevision?: number;
  versions?: WorkspaceInvoiceVersion[];
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
  subtotal: number;
  taxAmount: number;
  notes: string | null;
  items: WorkspaceInvoiceItem[];
  latestVersionId: string | null;
  latestSnapshotHash: string | null;
};

export type WorkspaceInvoiceVersion = {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  versionNumber: number;
  createdAt: string;
  reason: string;
  customerId: string | null;
  customerName: string | null;
  issueDate: string;
  dueDate: string | null;
  documentState: InvoiceDocumentState;
  paymentStatus: InvoicePaymentStatus;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes: string | null;
  snapshotHash: string;
  items: WorkspaceInvoiceItem[];
};

export type WorkspacePaymentAllocation = {
  id: string;
  transactionId: string;
  invoiceId: string;
  customerId: string;
  amount: number;
  createdAt: string;
};

export type WorkspaceInvoicePaymentAllocation = WorkspacePaymentAllocation & {
  transactionEffectiveDate: string;
  transactionNote: string | null;
  paymentMode: PaymentMode | null;
  paymentDetails: PaymentModeDetails | null;
  paymentClearanceStatus: PaymentClearanceStatus | null;
  paymentAttachments: PaymentInstrumentAttachment[];
};

export type CreateWorkspaceInvoicePaymentInput = {
  amount: number;
  effectiveDate?: string;
  note?: string | null;
  paymentMode?: PaymentMode | null;
  paymentDetails?: PaymentModeDetails | null;
  paymentClearanceStatus?: PaymentClearanceStatus | null;
  paymentAttachments?: PaymentInstrumentAttachment[];
};

export type UpdateWorkspacePaymentClearanceInput = {
  clearanceStatus: PaymentClearanceStatus;
};

export type SaveWorkspaceInvoiceInput = {
  customerId: string | null;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  documentState?: InvoiceDocumentState;
  paymentStatus?: InvoicePaymentStatus;
  revisionReason?: string | null;
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
  paymentMode?: PaymentMode | null;
  paymentDetails?: PaymentModeDetails | null;
  paymentClearanceStatus?: PaymentClearanceStatus | null;
  paymentAttachments?: PaymentInstrumentAttachment[];
  allocationStrategy?: PaymentAllocationStrategy;
  invoiceId?: string | null;
};

const CUSTOMER_LIST_LIMIT = 100;
const TRANSACTION_LIST_LIMIT = 150;
const INVOICE_LIST_LIMIT = 100;
const FIRESTORE_IN_QUERY_LIMIT = 10;

export async function listWorkspaceCustomers(workspaceId: string): Promise<WorkspaceCustomer[]> {
  const firestore = getWebFirestore();
  const [customerSnapshot, transactionSnapshot] = await Promise.all([
    getDocs(
      query(
        collection(firestore, 'workspaces', workspaceId, 'customers'),
        orderBy('updated_at', 'desc'),
        limitQuery(CUSTOMER_LIST_LIMIT)
      )
    ),
    getDocs(
      query(
        collection(firestore, 'workspaces', workspaceId, 'transactions'),
        orderBy('created_at', 'desc'),
        limitQuery(TRANSACTION_LIST_LIMIT)
      )
    ),
  ]);
  const healthStats = buildCustomerHealthStats(transactionSnapshot.docs);

  return customerSnapshot.docs
    .map((entry) => mapCustomer(entry, undefined, healthStats.get(entry.id)))
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
  const healthStats = buildCustomerHealthStats(transactionSnapshot.docs);
  for (const entry of transactionSnapshot.docs) {
    const data = entry.data() as {
      type?: 'credit' | 'payment';
      amount?: number;
      payment_clearance_status?: string | null;
    };
    if (typeof data.amount !== 'number') {
      continue;
    }
    const paymentCountsTowardBalance =
      data.type !== 'payment' ||
      !data.payment_clearance_status ||
      doesPaymentClearInvoice(data.payment_clearance_status);
    balanceDeltas.set(
      customerId,
      (balanceDeltas.get(customerId) ?? 0) +
        (data.type === 'credit' ? data.amount : paymentCountsTowardBalance ? -data.amount : 0)
    );
  }

  return mapCustomer(customerSnapshot, balanceDeltas, healthStats.get(customerId));
}

export async function createWorkspaceCustomer(
  workspaceId: string,
  input: CreateWorkspaceCustomerInput
): Promise<WorkspaceCustomer> {
  const now = new Date().toISOString();
  const name = input.name.trim();
  const phone = input.phone?.trim() || null;
  await assertWorkspaceCustomerIsUnique(workspaceId, name, phone);
  const payload = {
    name,
    name_key: normalizeCustomerNameKey(name),
    phone,
    phone_key: normalizeCustomerPhoneKey(phone),
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
    health: buildCustomerHealthScore({ balance: payload.opening_balance, latestActivityAt: now }),
  };
}

async function assertWorkspaceCustomerIsUnique(
  workspaceId: string,
  name: string,
  phone: string | null
): Promise<void> {
  const firestore = getWebFirestore();
  const customers = collection(firestore, 'workspaces', workspaceId, 'customers');
  const phoneKey = normalizeCustomerPhoneKey(phone);
  const nameKey = normalizeCustomerNameKey(name);
  const snapshots = await Promise.all([
    getDocs(query(customers, where('name', '==', name), limitQuery(10))),
    phone ? getDocs(query(customers, where('phone', '==', phone), limitQuery(10))) : Promise.resolve(null),
  ]);

  for (const entry of snapshots.flatMap((snapshot) => snapshot?.docs ?? [])) {
    const data = entry.data() as {
      name?: string;
      name_key?: string;
      phone?: string | null;
      phone_key?: string | null;
      is_archived?: boolean;
    };
    if (data.is_archived) {
      continue;
    }

    const existingNameKey = data.name_key ?? normalizeCustomerNameKey(data.name ?? '');
    const existingPhoneKey = data.phone_key ?? normalizeCustomerPhoneKey(data.phone ?? null);
    if (existingNameKey === nameKey && existingPhoneKey === phoneKey) {
      throw new Error('This customer already exists with the same name and phone.');
    }
  }
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
        payment_mode?: string | null;
        payment_details?: PaymentModeDetails | null;
        payment_details_json?: string | null;
        payment_clearance_status?: string | null;
        payment_attachments?: PaymentInstrumentAttachment[] | null;
        payment_attachments_json?: string | null;
        effective_date?: string;
        created_at?: string;
      };
      const paymentDetails = normalizeStoredPaymentDetails(data);
      const paymentMode = data.payment_mode ? normalizePaymentMode(data.payment_mode) : null;
      return {
        id: entry.id,
        customerId: data.customer_id ?? '',
        customerName: customerNames.get(data.customer_id ?? '') ?? 'Customer',
        type: data.type ?? 'payment',
        amount: data.amount ?? 0,
        note: data.note ?? null,
        paymentMode,
        paymentDetails,
        paymentClearanceStatus: data.payment_clearance_status
          ? normalizePaymentClearanceStatus(data.payment_clearance_status, paymentMode, paymentDetails)
          : null,
        paymentAttachments: normalizeStoredPaymentAttachments(data),
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
      payment_mode?: string | null;
      payment_details?: PaymentModeDetails | null;
      payment_details_json?: string | null;
      payment_clearance_status?: string | null;
      payment_attachments?: PaymentInstrumentAttachment[] | null;
      payment_attachments_json?: string | null;
      effective_date?: string;
      created_at?: string;
    };
    const paymentDetails = normalizeStoredPaymentDetails(data);
    const paymentMode = data.payment_mode ? normalizePaymentMode(data.payment_mode) : null;
    return {
      id: entry.id,
      customerId: data.customer_id ?? customerId,
      customerName: customer.name,
      type: data.type ?? 'payment',
      amount: data.amount ?? 0,
      note: data.note ?? null,
      paymentMode,
      paymentDetails,
      paymentClearanceStatus: data.payment_clearance_status
        ? normalizePaymentClearanceStatus(data.payment_clearance_status, paymentMode, paymentDetails)
        : null,
      paymentAttachments: normalizeStoredPaymentAttachments(data),
      effectiveDate: data.effective_date ?? '',
      createdAt: data.created_at ?? '',
    } satisfies WorkspaceTransaction;
  });
}

export async function createWorkspaceTransaction(
  workspaceId: string,
  input: CreateWorkspaceTransactionInput
): Promise<WorkspaceTransaction> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('Enter a valid amount before saving.');
  }
  const firestore = getWebFirestore();
  const customerRef = doc(firestore, 'workspaces', workspaceId, 'customers', input.customerId);
  const customerSnapshot = await getDoc(customerRef);
  if (!customerSnapshot.exists()) {
    throw new Error('Choose a valid customer before saving the transaction.');
  }

  const customerName = String(customerSnapshot.data().name ?? 'Customer');
  const now = new Date().toISOString();
  const paymentMode = input.type === 'payment' ? normalizePaymentMode(input.paymentMode) : null;
  const paymentDetails =
    input.type === 'payment' ? normalizePaymentModeDetails(input.paymentDetails) : null;
  const paymentModeError =
    input.type === 'payment' && paymentMode && paymentDetails
      ? validatePaymentModeDetails(paymentMode, paymentDetails)
      : null;
  if (paymentModeError) {
    throw new Error(paymentModeError);
  }
  const paymentClearanceStatus =
    input.type === 'payment'
      ? normalizePaymentClearanceStatus(input.paymentClearanceStatus, paymentMode, paymentDetails)
      : null;
  const paymentAttachments =
    input.type === 'payment' ? normalizePaymentInstrumentAttachments(input.paymentAttachments) : [];
  const payload = {
    customer_id: input.customerId,
    type: input.type,
    amount: input.amount,
    note: input.note?.trim() || null,
    payment_mode: paymentMode,
    payment_details: paymentDetails,
    payment_details_json: serializePaymentDetails(paymentDetails),
    payment_clearance_status: paymentClearanceStatus,
    payment_attachments: paymentAttachments,
    payment_attachments_json: serializePaymentAttachments(paymentAttachments),
    effective_date: input.effectiveDate ?? now.slice(0, 10),
    created_at: now,
    last_modified: now,
    sync_status: 'synced',
    server_revision: 1,
  };

  const transactionRef = doc(collection(firestore, 'workspaces', workspaceId, 'transactions'));
  const allocationPlan =
    input.type === 'payment'
      ? await buildPaymentAllocationPlan(firestore, workspaceId, {
          customerId: input.customerId,
          amount: input.amount,
          strategy: input.allocationStrategy ?? 'ledger_only',
          invoiceId: input.invoiceId ?? null,
          transactionId: transactionRef.id,
          createdAt: now,
          clearanceStatus: paymentClearanceStatus,
        })
      : [];
  const delta =
    input.type === 'credit'
      ? input.amount
      : doesPaymentClearInvoice(paymentClearanceStatus)
        ? -input.amount
        : 0;
  const batch = writeBatch(firestore);
  batch.set(transactionRef, payload);
  batch.update(customerRef, {
    current_balance: increment(delta),
    updated_at: now,
    last_modified: now,
  });
  for (const allocation of allocationPlan) {
    batch.set(doc(firestore, 'workspaces', workspaceId, 'payment_allocations', allocation.id), {
      transaction_id: allocation.transactionId,
      invoice_id: allocation.invoiceId,
      customer_id: allocation.customerId,
      amount: allocation.amount,
      created_at: allocation.createdAt,
      last_modified: now,
      sync_status: 'synced',
      server_revision: 1,
    });
    batch.update(doc(firestore, 'workspaces', workspaceId, 'invoices', allocation.invoiceId), {
      paid_amount: allocation.nextPaidAmount,
      payment_status: allocation.nextPaymentStatus,
      status: legacyStatusForInvoiceLifecycle(allocation.documentState, allocation.nextPaymentStatus),
      last_modified: now,
      server_revision: increment(1),
    });
  }
  await batch.commit();
  return {
    id: transactionRef.id,
    customerId: input.customerId,
    customerName,
    type: input.type,
    amount: input.amount,
    note: payload.note,
    paymentMode,
    paymentDetails,
    paymentClearanceStatus,
    paymentAttachments,
    effectiveDate: payload.effective_date,
    createdAt: now,
  };
}

export async function listWorkspaceInvoices(workspaceId: string): Promise<WorkspaceInvoice[]> {
  const firestore = getWebFirestore();
  const snapshot = await getDocs(
    query(
      collection(firestore, 'workspaces', workspaceId, 'invoices'),
      orderBy('issue_date', 'desc'),
      limitQuery(INVOICE_LIST_LIMIT)
    )
  );
  const invoices = snapshot.docs.map(mapWorkspaceInvoice);
  const [customerNames, versionsByInvoice] = await Promise.all([
    loadCustomerNamesForInvoices(firestore, workspaceId, invoices),
    loadInvoiceVersionsForInvoices(firestore, workspaceId, invoices.map((invoice) => invoice.id)),
  ]);

  return invoices.map((invoice) => ({
    ...invoice,
    customerName: invoice.customerId ? customerNames.get(invoice.customerId) ?? 'Customer' : null,
    versions: versionsByInvoice.get(invoice.id) ?? [],
  }));
}

export async function listWorkspaceInvoicesForCustomer(
  workspaceId: string,
  customerId: string
): Promise<WorkspaceInvoice[]> {
  const firestore = getWebFirestore();
  const snapshot = await getDocs(
    query(
      collection(firestore, 'workspaces', workspaceId, 'invoices'),
      where('customer_id', '==', customerId),
      orderBy('issue_date', 'asc'),
      limitQuery(INVOICE_LIST_LIMIT)
    )
  );
  const invoices = snapshot.docs.map(mapWorkspaceInvoice);
  return invoices.map((invoice) => ({
    ...invoice,
    customerName: invoice.customerName ?? null,
  }));
}

export async function listWorkspaceInvoicePaymentAllocations(
  workspaceId: string,
  invoiceId: string
): Promise<WorkspaceInvoicePaymentAllocation[]> {
  const firestore = getWebFirestore();
  const allocationSnapshot = await getDocs(
    query(
      collection(firestore, 'workspaces', workspaceId, 'payment_allocations'),
      where('invoice_id', '==', invoiceId)
    )
  );
  const transactionIds = allocationSnapshot.docs
    .map((entry) => String((entry.data() as { transaction_id?: string }).transaction_id ?? ''))
    .filter(Boolean);
  const transactions = await loadTransactionsByIds(firestore, workspaceId, transactionIds);

  return allocationSnapshot.docs
    .map((entry) => {
      const data = entry.data() as {
        transaction_id?: string;
        invoice_id?: string;
        customer_id?: string;
        amount?: number;
        created_at?: string;
      };
      const transaction = data.transaction_id ? transactions.get(data.transaction_id) : undefined;
      return {
        id: entry.id,
        transactionId: data.transaction_id ?? '',
        invoiceId: data.invoice_id ?? invoiceId,
        customerId: data.customer_id ?? '',
        amount: data.amount ?? 0,
        createdAt: data.created_at ?? '',
        transactionEffectiveDate: transaction?.effectiveDate ?? data.created_at?.slice(0, 10) ?? '',
        transactionNote: transaction?.note ?? null,
        paymentMode: transaction?.paymentMode ?? null,
        paymentDetails: transaction?.paymentDetails ?? null,
        paymentClearanceStatus: transaction?.paymentClearanceStatus ?? null,
        paymentAttachments: transaction?.paymentAttachments ?? [],
      };
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function createWorkspaceInvoicePayment(
  workspaceId: string,
  invoiceId: string,
  input: CreateWorkspaceInvoicePaymentInput
): Promise<WorkspaceInvoiceDetail> {
  const invoice = await getWorkspaceInvoiceDetail(workspaceId, invoiceId);
  if (!invoice) {
    throw new Error('Invoice could not be found.');
  }
  if (!invoice.customerId) {
    throw new Error('Choose a customer before recording payment for this invoice.');
  }
  const dueAmount = roundMoney(Math.max(invoice.totalAmount - invoice.paidAmount, 0));
  if (dueAmount <= 0) {
    throw new Error('This invoice is already paid.');
  }
  const amount = roundMoney(Math.min(input.amount, dueAmount));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Enter a valid payment amount.');
  }

  await createWorkspaceTransaction(workspaceId, {
    customerId: invoice.customerId,
    type: 'payment',
    amount,
    effectiveDate: input.effectiveDate,
    note: input.note?.trim() || `Payment for invoice ${invoice.invoiceNumber}`,
    paymentMode: input.paymentMode,
    paymentDetails: input.paymentDetails,
    paymentClearanceStatus: input.paymentClearanceStatus,
    paymentAttachments: input.paymentAttachments,
    allocationStrategy: 'selected_invoice',
    invoiceId,
  });

  const updated = await getWorkspaceInvoiceDetail(workspaceId, invoiceId);
  if (!updated) {
    throw new Error('Invoice could not be loaded after payment.');
  }
  return updated;
}

export async function updateWorkspacePaymentClearance(
  workspaceId: string,
  allocationId: string,
  input: UpdateWorkspacePaymentClearanceInput
): Promise<void> {
  const firestore = getWebFirestore();
  const allocationRef = doc(firestore, 'workspaces', workspaceId, 'payment_allocations', allocationId);
  const allocationSnapshot = await getDoc(allocationRef);
  if (!allocationSnapshot.exists()) {
    throw new Error('Payment allocation could not be found.');
  }

  const allocation = allocationSnapshot.data() as {
    transaction_id?: string;
    customer_id?: string;
  };
  if (!allocation.transaction_id) {
    throw new Error('Payment record could not be found.');
  }

  const transactionRef = doc(firestore, 'workspaces', workspaceId, 'transactions', allocation.transaction_id);
  const transactionSnapshot = await getDoc(transactionRef);
  if (!transactionSnapshot.exists()) {
    throw new Error('Payment record could not be found.');
  }
  const transaction = transactionSnapshot.data() as {
    amount?: number;
    customer_id?: string;
    payment_mode?: string | null;
    payment_details?: PaymentModeDetails | null;
    payment_details_json?: string | null;
    payment_clearance_status?: string | null;
  };
  const paymentDetails = normalizeStoredPaymentDetails(transaction);
  const paymentMode = transaction.payment_mode ? normalizePaymentMode(transaction.payment_mode) : null;
  const previousStatus = normalizePaymentClearanceStatus(
    transaction.payment_clearance_status,
    paymentMode,
    paymentDetails
  );
  const nextStatus = normalizePaymentClearanceStatus(input.clearanceStatus, paymentMode, paymentDetails);
  if (previousStatus === nextStatus) {
    return;
  }

  const relatedAllocations = await getDocs(
    query(
      collection(firestore, 'workspaces', workspaceId, 'payment_allocations'),
      where('transaction_id', '==', allocation.transaction_id)
    )
  );
  const now = new Date().toISOString();
  const batch = writeBatch(firestore);
  batch.update(transactionRef, {
    payment_clearance_status: nextStatus,
    last_modified: now,
    server_revision: increment(1),
  });

  for (const related of relatedAllocations.docs) {
    const data = related.data() as {
      invoice_id?: string;
      amount?: number;
    };
    if (!data.invoice_id || typeof data.amount !== 'number') {
      continue;
    }
    const invoiceRef = doc(firestore, 'workspaces', workspaceId, 'invoices', data.invoice_id);
    const invoiceSnapshot = await getDoc(invoiceRef);
    if (!invoiceSnapshot.exists()) {
      continue;
    }
    const invoice = invoiceSnapshot.data() as {
      paid_amount?: number;
      total_amount?: number;
      due_date?: string | null;
      status?: string;
      document_state?: string;
    };
    const previousPaidDelta = doesPaymentClearInvoice(previousStatus) ? data.amount : 0;
    const nextPaidDelta = doesPaymentClearInvoice(nextStatus) ? data.amount : 0;
    const nextPaidAmount = roundMoney(Math.max((invoice.paid_amount ?? 0) - previousPaidDelta + nextPaidDelta, 0));
    const nextPaymentStatus = deriveInvoicePaymentStatus({
      dueDate: invoice.due_date,
      totalAmount: invoice.total_amount,
      paidAmount: nextPaidAmount,
      pendingAmount: doesPaymentClearInvoice(nextStatus) || nextStatus === 'bounced' || nextStatus === 'cancelled' ? 0 : data.amount,
    });
    const documentState = normalizeInvoiceDocumentState(invoice.document_state ?? invoice.status);
    batch.update(invoiceRef, {
      paid_amount: nextPaidAmount,
      payment_status: nextPaymentStatus,
      status: legacyStatusForInvoiceLifecycle(documentState, nextPaymentStatus),
      last_modified: now,
      server_revision: increment(1),
    });
  }

  const customerId = transaction.customer_id ?? allocation.customer_id;
  const amount = typeof transaction.amount === 'number' ? transaction.amount : 0;
  if (customerId && amount > 0) {
    const balanceDelta =
      (doesPaymentClearInvoice(previousStatus) ? amount : 0) -
      (doesPaymentClearInvoice(nextStatus) ? amount : 0);
    if (balanceDelta !== 0) {
      batch.update(doc(firestore, 'workspaces', workspaceId, 'customers', customerId), {
        current_balance: increment(balanceDelta),
        updated_at: now,
        last_modified: now,
      });
    }
  }

  await batch.commit();
}

export async function getWorkspaceInvoiceDetail(
  workspaceId: string,
  invoiceId: string
): Promise<WorkspaceInvoiceDetail | null> {
  const firestore = getWebFirestore();
  const [invoiceSnapshot, itemSnapshot, versionSnapshot] = await Promise.all([
    getDoc(doc(firestore, 'workspaces', workspaceId, 'invoices', invoiceId)),
    getDocs(
      query(
        collection(firestore, 'workspaces', workspaceId, 'invoice_items'),
        where('invoice_id', '==', invoiceId)
      )
    ),
    getDocs(
      query(
        collection(firestore, 'workspaces', workspaceId, 'invoice_versions'),
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
    subtotal?: number;
    tax_amount?: number;
    total_amount?: number;
    paid_amount?: number;
    status?: string;
    document_state?: string;
    payment_status?: string;
    version_number?: number;
    latest_version_id?: string | null;
    latest_snapshot_hash?: string | null;
    notes?: string | null;
    server_revision?: number;
  };
  const documentState = normalizeInvoiceDocumentState(data.document_state ?? data.status);
  const paymentStatus = normalizeInvoicePaymentStatus({
    legacyStatus: data.status,
    paymentStatus: data.payment_status,
    dueDate: data.due_date,
    totalAmount: data.total_amount,
    paidAmount: data.paid_amount,
  });

  return {
    id: invoiceSnapshot.id,
    customerId: data.customer_id ?? null,
    customerName: null,
    invoiceNumber: data.invoice_number ?? invoiceSnapshot.id.slice(0, 8).toUpperCase(),
    issueDate: data.issue_date ?? '',
    dueDate: data.due_date ?? null,
    subtotal: data.subtotal ?? 0,
    taxAmount: data.tax_amount ?? 0,
    totalAmount: data.total_amount ?? 0,
    paidAmount: data.paid_amount ?? 0,
    status: data.status ?? 'draft',
    documentState,
    paymentStatus,
    versionNumber: data.version_number ?? (documentState === 'draft' ? 0 : 1),
    latestVersionId: data.latest_version_id ?? null,
    latestSnapshotHash: data.latest_snapshot_hash ?? null,
    serverRevision: data.server_revision ?? 1,
    notes: data.notes ?? null,
    items: itemSnapshot.docs.map(mapInvoiceItem).sort((left, right) => left.name.localeCompare(right.name)),
    versions: versionSnapshot.docs.map(mapWorkspaceInvoiceVersion).sort((left, right) => right.versionNumber - left.versionNumber),
  };
}

export async function saveWorkspaceInvoiceDetail(
  workspaceId: string,
  invoiceId: string,
  input: SaveWorkspaceInvoiceInput
): Promise<WorkspaceInvoiceDetail> {
  const firestore = getWebFirestore();
  const invoiceRef = doc(firestore, 'workspaces', workspaceId, 'invoices', invoiceId);
  const [invoiceSnapshot, existingItems, customerSnapshot] = await Promise.all([
    getDoc(invoiceRef),
    getDocs(
      query(
        collection(firestore, 'workspaces', workspaceId, 'invoice_items'),
        where('invoice_id', '==', invoiceId)
      )
    ),
    input.customerId ? getDoc(doc(firestore, 'workspaces', workspaceId, 'customers', input.customerId)) : null,
  ]);
  if (!invoiceSnapshot.exists()) {
    throw new Error('Invoice could not be found.');
  }
  const current = invoiceSnapshot.data() as {
    status?: string;
    document_state?: string;
    payment_status?: string;
    version_number?: number;
    latest_snapshot_hash?: string | null;
    latest_version_id?: string | null;
    paid_amount?: number;
  };
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
  const currentDocumentState = normalizeInvoiceDocumentState(current.document_state ?? current.status);
  const requestedPaymentStatus = input.paymentStatus;
  const paymentStatus = requestedPaymentStatus
    ? normalizeInvoicePaymentStatus({ paymentStatus: requestedPaymentStatus })
    : deriveInvoicePaymentStatus({
        legacyStatus: current.status,
        paymentStatus: current.payment_status,
        dueDate: input.dueDate,
        totalAmount,
        paidAmount: current.paid_amount,
      });
  const nextVersionNumber = Math.max(Number(current.version_number ?? 0), 0) + 1;
  const requestedDocumentState = input.documentState;
  const nextDocumentState: InvoiceDocumentState =
    requestedDocumentState === 'cancelled'
      ? 'cancelled'
      : currentDocumentState === 'draft'
      ? 'created'
      : currentDocumentState === 'cancelled'
        ? 'cancelled'
        : nextVersionNumber > 1
          ? 'revised'
          : 'created';
  const snapshot = buildInvoiceSnapshot({
    invoiceId,
    invoiceNumber: input.invoiceNumber.trim(),
    customerId: input.customerId,
    customerName: customerSnapshot?.exists() ? String(customerSnapshot.data().name ?? 'Customer') : null,
    issueDate: input.issueDate,
    dueDate: input.dueDate || null,
    documentState: nextDocumentState,
    paymentStatus,
    subtotal,
    taxAmount,
    totalAmount,
    notes: input.notes?.trim() || null,
    items: cleanItems.map((item) => ({
      id: item.id ?? '',
      invoiceId,
      productId: null,
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      price: item.price,
      taxRate: item.taxRate,
      total: item.total,
    })),
  });
  const snapshotHash = stableStringifyForInvoice(snapshot);
  const hasMeaningfulChange = snapshotHash !== current.latest_snapshot_hash;
  const batch = writeBatch(firestore);
  const retainedIds = new Set(cleanItems.map((item) => item.id).filter(Boolean));
  const versionRef = hasMeaningfulChange
    ? doc(collection(firestore, 'workspaces', workspaceId, 'invoice_versions'))
    : null;
  const finalDocumentState = hasMeaningfulChange
    ? nextDocumentState
    : currentDocumentState === 'draft'
      ? 'created'
      : currentDocumentState;
  const finalVersionNumber = hasMeaningfulChange ? nextVersionNumber : Math.max(Number(current.version_number ?? 0), 1);
  const finalSnapshotHash = hasMeaningfulChange ? snapshotHash : current.latest_snapshot_hash ?? snapshotHash;
  const finalLatestVersionId = versionRef?.id ?? current.latest_version_id ?? null;
  const legacyStatus = legacyStatusForInvoiceLifecycle(finalDocumentState, paymentStatus);

  batch.update(invoiceRef, {
    customer_id: input.customerId,
    invoice_number: input.invoiceNumber.trim(),
    issue_date: input.issueDate,
    due_date: input.dueDate || null,
    subtotal,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    paid_amount: current.paid_amount ?? 0,
    status: legacyStatus,
    document_state: finalDocumentState,
    payment_status: paymentStatus,
    version_number: finalVersionNumber,
    latest_version_id: finalLatestVersionId,
    latest_snapshot_hash: finalSnapshotHash,
    notes: input.notes?.trim() || null,
    server_revision: increment(1),
    last_modified: now,
  });

  if (versionRef) {
    batch.set(versionRef, {
      invoice_id: invoiceId,
      invoice_number: input.invoiceNumber.trim(),
      version_number: nextVersionNumber,
      reason: cleanVersionReason(input.revisionReason, nextVersionNumber),
      created_at: now,
      customer_id: input.customerId,
      customer_name: snapshot.customerName,
      issue_date: input.issueDate,
      due_date: input.dueDate || null,
      document_state: nextDocumentState,
      payment_status: paymentStatus,
      subtotal,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      notes: input.notes?.trim() || null,
      snapshot_hash: snapshotHash,
      items: snapshot.items,
      pdf_file_name: null,
      csv_file_name: null,
      sync_status: 'synced',
      server_revision: 1,
    });
  }

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

async function loadTransactionsByIds(
  firestore: Firestore,
  workspaceId: string,
  transactionIds: string[]
): Promise<Map<string, WorkspaceTransaction>> {
  const uniqueIds = Array.from(new Set(transactionIds.filter(Boolean)));
  if (!uniqueIds.length) {
    return new Map();
  }

  const snapshots = await Promise.all(
    chunk(uniqueIds, FIRESTORE_IN_QUERY_LIMIT).map((ids) =>
      getDocs(
        query(
          collection(firestore, 'workspaces', workspaceId, 'transactions'),
          where(documentId(), 'in', ids)
        )
      )
    )
  );
  const transactions = new Map<string, WorkspaceTransaction>();
  for (const entry of snapshots.flatMap((snapshot) => snapshot.docs)) {
    const data = entry.data() as {
      customer_id?: string;
      type?: 'credit' | 'payment';
      amount?: number;
      note?: string | null;
      payment_mode?: string | null;
      payment_details?: PaymentModeDetails | null;
      payment_details_json?: string | null;
      payment_clearance_status?: string | null;
      payment_attachments?: PaymentInstrumentAttachment[] | null;
      payment_attachments_json?: string | null;
      effective_date?: string;
      created_at?: string;
    };
    const paymentDetails = normalizeStoredPaymentDetails(data);
    const paymentMode = data.payment_mode ? normalizePaymentMode(data.payment_mode) : null;
    transactions.set(entry.id, {
      id: entry.id,
      customerId: data.customer_id ?? '',
      customerName: 'Customer',
      type: data.type ?? 'payment',
      amount: data.amount ?? 0,
      note: data.note ?? null,
      paymentMode,
      paymentDetails,
      paymentClearanceStatus: data.payment_clearance_status
        ? normalizePaymentClearanceStatus(data.payment_clearance_status, paymentMode, paymentDetails)
        : null,
      paymentAttachments: normalizeStoredPaymentAttachments(data),
      effectiveDate: data.effective_date ?? '',
      createdAt: data.created_at ?? '',
    });
  }
  return transactions;
}

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function buildPaymentAllocationPlan(
  firestore: Firestore,
  workspaceId: string,
  input: {
    customerId: string;
    amount: number;
    strategy: PaymentAllocationStrategy;
    invoiceId: string | null;
    transactionId: string;
    createdAt: string;
    clearanceStatus: PaymentClearanceStatus | null;
  }
): Promise<Array<WorkspacePaymentAllocation & {
  nextPaidAmount: number;
  nextPaymentStatus: InvoicePaymentStatus;
  documentState: InvoiceDocumentState;
}>> {
  if (input.strategy === 'ledger_only') {
    return [];
  }

  const invoiceSnapshot = await getDocs(
    query(
      collection(firestore, 'workspaces', workspaceId, 'invoices'),
      where('customer_id', '==', input.customerId)
    )
  );
  const invoices = invoiceSnapshot.docs
    .map((entry) => {
      const data = entry.data() as {
        total_amount?: number;
        paid_amount?: number;
        issue_date?: string;
        due_date?: string | null;
        status?: string;
        document_state?: string;
        payment_status?: string;
      };
      const documentState = normalizeInvoiceDocumentState(data.document_state ?? data.status);
      const paidAmount = data.paid_amount ?? 0;
      const totalAmount = data.total_amount ?? 0;
      return {
        id: entry.id,
        documentState,
        issueDate: data.issue_date ?? '',
        dueDate: data.due_date ?? null,
        totalAmount,
        paidAmount,
        dueAmount: Math.max(totalAmount - paidAmount, 0),
        paymentStatus: normalizeInvoicePaymentStatus({
          legacyStatus: data.status,
          paymentStatus: data.payment_status,
          dueDate: data.due_date,
          totalAmount,
          paidAmount,
        }),
      };
    })
    .filter((invoice) => invoice.documentState !== 'cancelled' && invoice.dueAmount > 0)
    .sort((left, right) => left.issueDate.localeCompare(right.issueDate) || left.id.localeCompare(right.id));

  const targets =
    input.strategy === 'selected_invoice'
      ? invoices.filter((invoice) => invoice.id === input.invoiceId)
      : invoices;

  if (input.strategy === 'selected_invoice' && !targets.length) {
    throw new Error('Choose an unpaid invoice before allocating this payment.');
  }

  let remainingAmount = input.amount;
  const allocations: Array<WorkspacePaymentAllocation & {
    nextPaidAmount: number;
    nextPaymentStatus: InvoicePaymentStatus;
    documentState: InvoiceDocumentState;
  }> = [];
  for (const invoice of targets) {
    if (remainingAmount <= 0) {
      break;
    }

    const allocatedAmount = roundMoney(Math.min(remainingAmount, invoice.dueAmount));
    if (allocatedAmount <= 0) {
      continue;
    }
    const paidDelta = doesPaymentClearInvoice(input.clearanceStatus) ? allocatedAmount : 0;
    const nextPaidAmount = roundMoney(invoice.paidAmount + paidDelta);
    const nextPaymentStatus = deriveInvoicePaymentStatus({
      dueDate: invoice.dueDate,
      totalAmount: invoice.totalAmount,
      paidAmount: nextPaidAmount,
      pendingAmount: doesPaymentClearInvoice(input.clearanceStatus) ? 0 : allocatedAmount,
    });
    allocations.push({
      id: doc(collection(firestore, 'workspaces', workspaceId, 'payment_allocations')).id,
      transactionId: input.transactionId,
      invoiceId: invoice.id,
      customerId: input.customerId,
      amount: allocatedAmount,
      createdAt: input.createdAt,
      nextPaidAmount,
      nextPaymentStatus,
      documentState: invoice.documentState,
    });
    remainingAmount = roundMoney(remainingAmount - allocatedAmount);
  }

  return allocations;
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
    paid_amount: 0,
    status: 'draft',
    document_state: 'draft',
    payment_status: 'unpaid',
    version_number: 0,
    latest_version_id: null,
    latest_snapshot_hash: null,
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
    customerName: null,
    invoiceNumber: payload.invoice_number,
    issueDate: payload.issue_date,
    totalAmount: 0,
    paidAmount: 0,
    status: 'draft',
    documentState: 'draft',
    paymentStatus: 'unpaid',
    versionNumber: 0,
    versions: [],
    serverRevision: payload.server_revision,
  };
}

function mapWorkspaceInvoice(entry: QueryDocumentSnapshot): WorkspaceInvoice {
  const data = entry.data() as {
    customer_id?: string | null;
    customer_name?: string | null;
    invoice_number?: string;
    issue_date?: string;
    total_amount?: number;
    paid_amount?: number;
    status?: string;
    document_state?: string;
    payment_status?: string;
    due_date?: string | null;
    version_number?: number;
    server_revision?: number;
  };
  const documentState = normalizeInvoiceDocumentState(data.document_state ?? data.status);
  const paymentStatus = normalizeInvoicePaymentStatus({
    legacyStatus: data.status,
    paymentStatus: data.payment_status,
    dueDate: data.due_date,
    totalAmount: data.total_amount,
    paidAmount: data.paid_amount,
  });

  return {
    id: entry.id,
    customerId: data.customer_id ?? null,
    customerName: data.customer_name ?? null,
    invoiceNumber: data.invoice_number ?? entry.id.slice(0, 8).toUpperCase(),
    issueDate: data.issue_date ?? '',
    totalAmount: data.total_amount ?? 0,
    paidAmount: data.paid_amount ?? 0,
    status: data.status ?? legacyStatusForInvoiceLifecycle(documentState, paymentStatus),
    documentState,
    paymentStatus,
    versionNumber: data.version_number ?? (documentState === 'draft' ? 0 : 1),
    serverRevision: data.server_revision ?? 1,
  };
}

async function loadCustomerNamesForInvoices(
  firestore: Firestore,
  workspaceId: string,
  invoices: WorkspaceInvoice[]
): Promise<Map<string, string>> {
  const customerIds = Array.from(new Set(invoices.map((invoice) => invoice.customerId).filter(Boolean))) as string[];
  if (!customerIds.length) {
    return new Map();
  }

  const snapshots = await Promise.all(
    chunk(customerIds, FIRESTORE_IN_QUERY_LIMIT).map((ids) =>
      getDocs(query(collection(firestore, 'workspaces', workspaceId, 'customers'), where(documentId(), 'in', ids)))
    )
  );

  const names = new Map<string, string>();
  for (const entry of snapshots.flatMap((snapshot) => snapshot.docs)) {
    names.set(entry.id, String((entry.data() as { name?: string }).name ?? 'Customer'));
  }
  return names;
}

async function loadInvoiceVersionsForInvoices(
  firestore: Firestore,
  workspaceId: string,
  invoiceIds: string[]
): Promise<Map<string, WorkspaceInvoiceVersion[]>> {
  if (!invoiceIds.length) {
    return new Map();
  }

  const snapshots = await Promise.all(
    chunk(invoiceIds, FIRESTORE_IN_QUERY_LIMIT).map((ids) =>
      getDocs(
        query(
          collection(firestore, 'workspaces', workspaceId, 'invoice_versions'),
          where('invoice_id', 'in', ids)
        )
      )
    )
  );
  const versionsByInvoice = new Map<string, WorkspaceInvoiceVersion[]>();
  for (const entry of snapshots.flatMap((snapshot) => snapshot.docs)) {
    const version = mapWorkspaceInvoiceVersion(entry);
    const current = versionsByInvoice.get(version.invoiceId) ?? [];
    current.push(version);
    versionsByInvoice.set(version.invoiceId, current);
  }
  for (const versions of versionsByInvoice.values()) {
    versions.sort((left, right) => right.versionNumber - left.versionNumber);
  }
  return versionsByInvoice;
}

function mapWorkspaceInvoiceVersion(entry: QueryDocumentSnapshot): WorkspaceInvoiceVersion {
  const data = entry.data() as {
    invoice_id?: string;
    invoice_number?: string;
    version_number?: number;
    created_at?: string;
    reason?: string;
    customer_id?: string | null;
    customer_name?: string | null;
    issue_date?: string;
    due_date?: string | null;
    document_state?: string;
    payment_status?: string;
    subtotal?: number;
    tax_amount?: number;
    total_amount?: number;
    notes?: string | null;
    snapshot_hash?: string;
    items?: WorkspaceInvoiceItem[];
  };
  const documentState = normalizeInvoiceDocumentState(data.document_state);
  const paymentStatus = normalizeInvoicePaymentStatus({
    paymentStatus: data.payment_status,
    dueDate: data.due_date,
    totalAmount: data.total_amount,
  });

  return {
    id: entry.id,
    invoiceId: data.invoice_id ?? '',
    invoiceNumber: data.invoice_number ?? entry.id.slice(0, 8).toUpperCase(),
    versionNumber: data.version_number ?? 1,
    createdAt: data.created_at ?? '',
    reason: data.reason ?? 'Invoice updated',
    customerId: data.customer_id ?? null,
    customerName: data.customer_name ?? null,
    issueDate: data.issue_date ?? '',
    dueDate: data.due_date ?? null,
    documentState,
    paymentStatus,
    subtotal: data.subtotal ?? 0,
    taxAmount: data.tax_amount ?? 0,
    totalAmount: data.total_amount ?? 0,
    notes: data.notes ?? null,
    snapshotHash: data.snapshot_hash ?? '',
    items: Array.isArray(data.items) ? data.items : [],
  };
}

function mapCustomer(
  entry: QueryDocumentSnapshot,
  balanceDeltas?: Map<string, number>,
  healthStats?: {
    totalCredit: number;
    totalPayment: number;
    paymentCount: number;
    oldestCreditAt: string | null;
    lastPaymentAt: string | null;
  }
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
  const balance = balanceDeltas?.has(entry.id) ? openingBalance + (balanceDeltas.get(entry.id) ?? 0) : storedBalance;
  const updatedAt = data.updated_at ?? data.created_at ?? '';
  return {
    id: entry.id,
    name: data.name ?? 'Unnamed customer',
    phone: data.phone ?? null,
    address: data.address ?? null,
    notes: data.notes ?? null,
    openingBalance,
    isArchived: Boolean(data.is_archived),
    createdAt: data.created_at ?? '',
    updatedAt,
    balance,
    health: buildCustomerHealthScore({
      balance,
      totalCredit: healthStats?.totalCredit ?? null,
      totalPayment: healthStats?.totalPayment ?? null,
      paymentCount: healthStats?.paymentCount ?? null,
      daysOutstanding: healthStats?.oldestCreditAt ? dayDifference(healthStats.oldestCreditAt) : null,
      lastPaymentAt: healthStats?.lastPaymentAt ?? null,
      latestActivityAt: updatedAt,
    }),
  };
}

function buildCustomerHealthStats(transactions: QueryDocumentSnapshot[]) {
  const stats = new Map<string, {
    totalCredit: number;
    totalPayment: number;
    paymentCount: number;
    oldestCreditAt: string | null;
    lastPaymentAt: string | null;
  }>();
  for (const entry of transactions) {
    const data = entry.data() as {
      customer_id?: string;
      type?: 'credit' | 'payment';
      amount?: number;
      effective_date?: string;
      payment_clearance_status?: string | null;
    };
    const customerId = data.customer_id;
    if (!customerId || typeof data.amount !== 'number') {
      continue;
    }
    const current = stats.get(customerId) ?? {
      totalCredit: 0,
      totalPayment: 0,
      paymentCount: 0,
      oldestCreditAt: null,
      lastPaymentAt: null,
    };
    const date = data.effective_date ?? '';
    if (data.type === 'credit') {
      current.totalCredit += data.amount;
      current.oldestCreditAt =
        !current.oldestCreditAt || (date && date < current.oldestCreditAt) ? date : current.oldestCreditAt;
    } else if (
      data.type === 'payment' &&
      (!data.payment_clearance_status || doesPaymentClearInvoice(data.payment_clearance_status))
    ) {
      current.totalPayment += data.amount;
      current.paymentCount += 1;
      current.lastPaymentAt =
        !current.lastPaymentAt || (date && date > current.lastPaymentAt) ? date : current.lastPaymentAt;
    }
    stats.set(customerId, current);
  }
  return stats;
}

function dayDifference(value: string) {
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return Math.max(0, Math.floor((Date.now() - parsed.getTime()) / (24 * 60 * 60 * 1000)));
}

function normalizeStoredPaymentDetails(data: {
  payment_details?: PaymentModeDetails | null;
  payment_details_json?: string | null;
}): PaymentModeDetails | null {
  if (data.payment_details) {
    return normalizePaymentModeDetails(data.payment_details);
  }

  if (!data.payment_details_json) {
    return null;
  }

  try {
    return normalizePaymentModeDetails(JSON.parse(data.payment_details_json) as PaymentModeDetails);
  } catch {
    return null;
  }
}

function serializePaymentDetails(details: PaymentModeDetails | null): string | null {
  if (!details) {
    return null;
  }

  const compact = Object.fromEntries(
    Object.entries(details).filter(([, value]) => typeof value === 'string' && value.trim())
  );
  return Object.keys(compact).length ? JSON.stringify(compact) : null;
}

function normalizeStoredPaymentAttachments(data: {
  payment_attachments?: PaymentInstrumentAttachment[] | null;
  payment_attachments_json?: string | null;
}): PaymentInstrumentAttachment[] {
  if (data.payment_attachments) {
    return normalizePaymentInstrumentAttachments(data.payment_attachments);
  }

  if (!data.payment_attachments_json) {
    return [];
  }

  try {
    return normalizePaymentInstrumentAttachments(
      JSON.parse(data.payment_attachments_json) as PaymentInstrumentAttachment[]
    );
  } catch {
    return [];
  }
}

function serializePaymentAttachments(attachments: PaymentInstrumentAttachment[]): string | null {
  const normalized = normalizePaymentInstrumentAttachments(attachments);
  return normalized.length ? JSON.stringify(normalized) : null;
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

function cleanVersionReason(value: string | null | undefined, versionNumber: number) {
  const clean = value?.trim();
  if (clean) {
    return clean;
  }

  return versionNumber === 1 ? 'First saved invoice' : 'Invoice updated';
}

function buildInvoiceSnapshot(input: {
  invoiceId: string;
  invoiceNumber: string;
  customerId: string | null;
  customerName: string | null;
  issueDate: string;
  dueDate: string | null;
  documentState: InvoiceDocumentState;
  paymentStatus: InvoicePaymentStatus;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes: string | null;
  items: WorkspaceInvoiceItem[];
}) {
  return {
    invoiceId: input.invoiceId,
    invoiceNumber: normalizeSnapshotText(input.invoiceNumber),
    customerId: input.customerId ?? null,
    customerName: normalizeSnapshotText(input.customerName ?? ''),
    issueDate: input.issueDate,
    dueDate: input.dueDate ?? null,
    documentState: input.documentState,
    paymentStatus: input.paymentStatus,
    subtotal: roundMoney(input.subtotal),
    taxAmount: roundMoney(input.taxAmount),
    totalAmount: roundMoney(input.totalAmount),
    notes: normalizeSnapshotText(input.notes ?? ''),
    items: input.items
      .map((item) => ({
        name: normalizeSnapshotText(item.name),
        description: normalizeSnapshotText(item.description ?? ''),
        quantity: roundMoney(item.quantity),
        price: roundMoney(item.price),
        taxRate: roundMoney(item.taxRate),
        total: roundMoney(item.total),
      }))
      .sort((left, right) => stableStringifyForInvoice(left).localeCompare(stableStringifyForInvoice(right))),
  };
}

function stableStringifyForInvoice(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringifyForInvoice).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringifyForInvoice(entryValue)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function normalizeSnapshotText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function roundMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function normalizeCustomerNameKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeCustomerPhoneKey(value: string | null): string {
  return (value ?? '').replace(/[^\d+]/g, '');
}
