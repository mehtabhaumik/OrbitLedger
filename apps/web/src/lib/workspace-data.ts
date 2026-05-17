'use client';

import {
  buildInvoiceNumberMigrationPlan,
  buildCustomerHealthScore,
  buildSmartInvoiceNumber,
  deriveInvoicePaymentStatus,
  doesPaymentAwaitClearance,
  doesPaymentClearInvoice,
  legacyStatusForInvoiceLifecycle,
  normalizePaymentClearanceStatus,
  normalizePaymentInstrumentAttachments,
  normalizePaymentMode,
  normalizePaymentModeDetails,
  normalizeInvoiceDocumentState,
  normalizeInvoicePaymentStatus,
  normalizeInvoiceNumberKey,
  normalizeInvoicePrefix,
  validatePaymentModeDetails,
  type PaymentClearanceStatus,
  type PaymentInstrumentAttachment,
  type InvoiceDocumentState,
  type InvoicePaymentStatus,
  type PaymentAllocationStrategy,
  type CustomerHealthScore,
  type PaymentMode,
  type PaymentModeDetails,
  type InvoiceNumberDuplicateGroup,
  type SmartInvoiceNumberResult,
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
  runTransaction,
  setDoc,
  type QueryDocumentSnapshot,
  where,
  writeBatch,
  updateDoc,
} from 'firebase/firestore';

import { getWebFirestore } from './firebase';

export type WorkspaceCustomer = {
  id: string;
  name: string;
  legalName: string | null;
  customerType: 'individual' | 'business' | null;
  contactPerson: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  billingAddress: string | null;
  shippingAddress: string | null;
  city: string | null;
  town?: string | null;
  stateCode: string | null;
  countryCode: string | null;
  postalCode: string | null;
  gstin: string | null;
  pan: string | null;
  taxNumber: string | null;
  registrationNumber: string | null;
  placeOfSupply: string | null;
  defaultTaxTreatment: string | null;
  notes: string | null;
  openingBalance: number;
  creditLimit: number | null;
  paymentTerms: string | null;
  preferredPaymentMode: string | null;
  preferredInvoiceTemplate: string | null;
  preferredLanguage: string | null;
  tags: string[];
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  balance: number;
  health: CustomerHealthScore;
};

export type WorkspaceProduct = {
  id: string;
  name: string;
  price: number;
  stockQuantity: number;
  unit: string;
  createdAt: string;
  lastModified: string;
  serverRevision: number;
};

export type WorkspaceCustomerTimelineNoteKind = 'note' | 'dispute';
export type WorkspacePaymentReminderTone = 'polite' | 'firm' | 'final';
export type WorkspacePaymentPromiseStatus = 'open' | 'fulfilled' | 'missed' | 'cancelled';

export type WorkspaceCustomerTimelineNote = {
  id: string;
  customerId: string;
  kind: WorkspaceCustomerTimelineNoteKind;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspacePaymentReminder = {
  id: string;
  customerId: string;
  tone: WorkspacePaymentReminderTone;
  message: string;
  balanceAtSend: number;
  sharedVia: string;
  createdAt: string;
};

export type WorkspacePaymentPromise = {
  id: string;
  customerId: string;
  promisedAmount: number;
  promisedDate: string;
  note: string | null;
  status: WorkspacePaymentPromiseStatus;
  createdAt: string;
  updatedAt: string;
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
  dueDate?: string | null;
  billingMonth?: string | null;
  totalAmount: number;
  paidAmount: number;
  status: string;
  documentState: InvoiceDocumentState;
  paymentStatus: InvoicePaymentStatus;
  paymentStatusReason?: string | null;
  useForMonthlyAutoEmail?: boolean;
  recurringRuleId?: string | null;
  autoEmailPreparedAt?: string | null;
  autoEmailScheduledFor?: string | null;
  hasAutoEmailHistory?: boolean;
  latestAutoEmailStatus?: string | null;
  latestAutoEmailSentAt?: string | null;
  latestAutoEmailVersionId?: string | null;
  versionNumber: number;
  serverRevision?: number;
  isArchived: boolean;
  versions?: WorkspaceInvoiceVersion[];
};

export type WorkspaceInvoiceNumberConflictInvoice = {
  id: string;
  invoiceNumber: string;
  issueDate: string | null;
  documentState: string | null;
  versionNumber: number | null;
  totalAmount: number;
};

export type WorkspaceInvoiceNumberConflictGroup = InvoiceNumberDuplicateGroup & {
  invoices: WorkspaceInvoiceNumberConflictInvoice[];
  recommendedKeepInvoiceId: string | null;
};

export type WorkspaceInvoiceNumberAuditItem = {
  id: string;
  actorEmail: string | null;
  reason: string | null;
  changedFields: string[];
  changes: Array<{
    field: string;
    label: string;
    previousValue: string | null;
    nextValue: string | null;
  }>;
  serverRevisionBefore: number | null;
  serverRevisionAfter: number | null;
  createdAt: string;
};

export type WorkspaceInvoiceNumberHealth = {
  totalInvoices: number;
  missingKeyCount: number;
  duplicateGroups: WorkspaceInvoiceNumberConflictGroup[];
  scannedAt: string;
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

export type WorkspaceRecurringInvoiceStatus = 'active' | 'cancelled';

export type WorkspaceRecurringInvoiceItem = {
  id: string;
  productId: string | null;
  name: string;
  description: string | null;
  quantity: number;
  price: number;
  taxRate: number;
  total: number;
};

export type WorkspaceRecurringInvoiceRule = {
  id: string;
  name: string;
  customerId: string;
  customerName: string | null;
  startDate: string;
  endDate: string | null;
  invoiceDay: number;
  nextRunDate: string;
  dueDays: number;
  invoiceNumberPrefix: string;
  notes: string | null;
  emailEnabled: boolean;
  emailRecipient: string | null;
  emailDay: number | null;
  emailSubject: string | null;
  emailBody: string | null;
  emailIncludePaymentLink: boolean;
  emailAttachPdf: boolean;
  emailCurrentMonthOnly: boolean;
  emailAutomationApproved: boolean;
  emailAutomationApprovedAt: string | null;
  emailApprovalSummary: string | null;
  emailApprovalRequired: boolean;
  lastSettingsChangedAt: string | null;
  nextEmailDate: string | null;
  status: WorkspaceRecurringInvoiceStatus;
  items: WorkspaceRecurringInvoiceItem[];
  lastCreatedInvoiceId: string | null;
  lastCreatedRunDate: string | null;
  createdAt: string;
  lastModified: string;
};

export type WorkspaceRecurringEmailQueueStatus =
  | 'scheduled'
  | 'ready'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'cancelled'
  | string;

export type WorkspaceRecurringEmailQueueItem = {
  id: string;
  status: WorkspaceRecurringEmailQueueStatus;
  scheduledFor: string | null;
  sentAt: string | null;
  recipientEmail: string | null;
  subject: string | null;
  body: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  customerId: string | null;
  recurringRuleId: string | null;
  includePaymentLink: boolean;
  attachPdf: boolean;
  lastError: string | null;
  createdAt: string | null;
  lastModified: string | null;
};

export type WorkspaceDashboardData = {
  customers: WorkspaceCustomer[];
  invoices: WorkspaceInvoice[];
  products: WorkspaceProduct[];
  recurringRules: WorkspaceRecurringInvoiceRule[];
  transactions: WorkspaceTransaction[];
};

export type SaveWorkspaceRecurringInvoiceRuleInput = {
  name: string;
  customerId: string;
  startDate: string;
  endDate?: string | null;
  invoiceDay: number;
  dueDays?: number | null;
  invoiceNumberPrefix?: string | null;
  notes?: string | null;
  emailEnabled?: boolean;
  emailRecipient?: string | null;
  emailDay?: number | null;
  emailSubject?: string | null;
  emailBody?: string | null;
  emailIncludePaymentLink?: boolean;
  emailAttachPdf?: boolean;
  emailCurrentMonthOnly?: boolean;
  approveEmailAutomation?: boolean;
  items: Array<{
    id?: string;
    productId?: string | null;
    name: string;
    description?: string | null;
    quantity: number;
    price: number;
    taxRate: number;
  }>;
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
  paymentStatusReason?: string | null;
  autoEmailSentAt?: string | null;
  autoEmailScheduledFor?: string | null;
  autoEmailRecipient?: string | null;
  autoEmailQueueId?: string | null;
  autoEmailStatus?: string | null;
  autoEmailUsedVersionId?: string | null;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
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
  isReversed: boolean;
  reversedAt: string | null;
  reversalReason: string | null;
  reversalTransactionId: string | null;
};

export type WorkspaceManualPaymentReviewItem = {
  transactionId: string;
  customerId: string;
  customerName: string;
  amount: number;
  note: string | null;
  paymentMode: PaymentMode | null;
  paymentDetails: PaymentModeDetails | null;
  paymentClearanceStatus: PaymentClearanceStatus;
  paymentAttachments: PaymentInstrumentAttachment[];
  effectiveDate: string;
  createdAt: string;
  allocationId: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceDueAmount: number | null;
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

export type WorkspacePaymentProviderEvent = {
  id: string;
  source: string;
  status: string;
  applyStatus: string;
  applied: boolean;
  amount: number;
  currency: string;
  reference: string | null;
  providerPaymentId: string | null;
  payerName: string | null;
  payerContact: string | null;
  invoiceId: string | null;
  customerId: string | null;
  transactionId: string | null;
  allocationId: string | null;
  allocationAmount: number;
  reversed: boolean;
  reversedAt: string | null;
  reversalId: string | null;
  reversalTransactionId: string | null;
  refundedAmount: number;
  error: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  lastModified: string;
};

export type ApplyWorkspaceProviderEventInput = {
  invoiceId: string;
  customerId?: string | null;
  note?: string | null;
};

export type ReverseWorkspaceProviderEventInput = {
  invoiceId?: string | null;
  customerId?: string | null;
  note?: string | null;
};

export type UpdateWorkspacePaymentClearanceInput = {
  clearanceStatus: PaymentClearanceStatus;
};

export type ReverseWorkspaceInvoicePaymentInput = {
  note?: string | null;
};

export type SaveWorkspaceInvoiceInput = {
  customerId: string | null;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  documentState?: InvoiceDocumentState;
  paymentStatus?: InvoicePaymentStatus;
  paymentStatusReason?: string | null;
  useForMonthlyAutoEmail?: boolean;
  revisionReason?: string | null;
  notes: string | null;
  items: Array<{
    id?: string;
    productId?: string | null;
    name: string;
    description?: string | null;
    quantity: number;
    price: number;
    taxRate: number;
  }>;
};

export type CreateWorkspaceCustomerInput = {
  name: string;
  legalName?: string | null;
  customerType?: 'individual' | 'business' | null;
  contactPerson?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  billingAddress?: string | null;
  shippingAddress?: string | null;
  city?: string | null;
  town?: string | null;
  stateCode?: string | null;
  countryCode?: string | null;
  postalCode?: string | null;
  gstin?: string | null;
  pan?: string | null;
  taxNumber?: string | null;
  registrationNumber?: string | null;
  placeOfSupply?: string | null;
  defaultTaxTreatment?: string | null;
  notes?: string | null;
  openingBalance?: number;
  creditLimit?: number | null;
  paymentTerms?: string | null;
  preferredPaymentMode?: string | null;
  preferredInvoiceTemplate?: string | null;
  preferredLanguage?: string | null;
  tags?: string[];
};

export type SaveWorkspaceProductInput = {
  name: string;
  price: number;
  stockQuantity: number;
  unit: string;
};

export type AddWorkspaceCustomerTimelineNoteInput = {
  customerId: string;
  kind: WorkspaceCustomerTimelineNoteKind;
  body: string;
};

export type AddWorkspacePaymentReminderInput = {
  customerId: string;
  tone: WorkspacePaymentReminderTone;
  message: string;
  balanceAtSend: number;
  sharedVia?: string;
};

export type AddWorkspacePaymentPromiseInput = {
  customerId: string;
  promisedAmount: number;
  promisedDate: string;
  note?: string | null;
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
const PRODUCT_LIST_LIMIT = 250;
const CUSTOMER_TIMELINE_LIMIT = 30;
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

export async function getWorkspaceDashboardData(workspaceId: string): Promise<WorkspaceDashboardData> {
  const firestore = getWebFirestore();
  const [customerSnapshot, transactionSnapshot, invoiceSnapshot, productSnapshot, recurringRuleSnapshot] = await Promise.all([
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
    getDocs(
      query(
        collection(firestore, 'workspaces', workspaceId, 'invoices'),
        orderBy('issue_date', 'desc'),
        limitQuery(INVOICE_LIST_LIMIT)
      )
    ),
    getDocs(
      query(
        collection(firestore, 'workspaces', workspaceId, 'products'),
        orderBy('name', 'asc'),
        limitQuery(PRODUCT_LIST_LIMIT)
      )
    ),
    getDocs(
      query(
        collection(firestore, 'workspaces', workspaceId, 'recurring_invoice_rules'),
        orderBy('next_run_date', 'asc'),
        limitQuery(100)
      )
    ),
  ]);

  const healthStats = buildCustomerHealthStats(transactionSnapshot.docs);
  const customerNames = new Map<string, string>();
  for (const entry of customerSnapshot.docs) {
    customerNames.set(entry.id, String((entry.data() as { name?: string }).name ?? 'Customer'));
  }

  const invoices = invoiceSnapshot.docs.map(mapWorkspaceInvoice);
  const missingCustomerIds = [
    ...transactionSnapshot.docs.map((entry) => String((entry.data() as { customer_id?: string }).customer_id ?? '')),
    ...invoices.map((invoice) => invoice.customerId ?? ''),
  ].filter((id) => id && !customerNames.has(id));
  const missingCustomerNames = await loadCustomerNamesByIds(firestore, workspaceId, missingCustomerIds);
  for (const [customerId, name] of missingCustomerNames) {
    customerNames.set(customerId, name);
  }

  return {
    customers: customerSnapshot.docs
      .map((entry) => mapCustomer(entry, undefined, healthStats.get(entry.id)))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    invoices: invoices.map((invoice) => ({
      ...invoice,
      customerName: invoice.customerId ? customerNames.get(invoice.customerId) ?? 'Customer' : null,
      versions: undefined,
    })),
    products: productSnapshot.docs.map(mapWorkspaceProduct),
    recurringRules: recurringRuleSnapshot.docs.map(mapWorkspaceRecurringInvoiceRule),
    transactions: transactionSnapshot.docs.map((entry) => {
      const customerId = String((entry.data() as { customer_id?: string }).customer_id ?? '');
      return mapWorkspaceTransaction(entry, customerNames.get(customerId) ?? 'Customer');
    }),
  };
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
      payment_mode?: string | null;
      payment_clearance_status?: string | null;
    };
    if (typeof data.amount !== 'number') {
      continue;
    }
    const paymentCountsTowardBalance =
      data.type !== 'payment' ||
      !data.payment_clearance_status ||
      doesPaymentClearInvoice(data.payment_clearance_status, data.payment_mode);
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
    ...customerProfilePayload(input),
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
    legalName: payload.legal_name,
    customerType: payload.customer_type,
    contactPerson: payload.contact_person,
    phone: payload.phone,
    whatsapp: payload.whatsapp,
    email: payload.email,
    address: payload.address,
    billingAddress: payload.billing_address,
    shippingAddress: payload.shipping_address,
    city: payload.city,
    town: payload.town,
    stateCode: payload.state_code,
    countryCode: payload.country_code,
    postalCode: payload.postal_code,
    gstin: payload.gstin,
    pan: payload.pan,
    taxNumber: payload.tax_number,
    registrationNumber: payload.registration_number,
    placeOfSupply: payload.place_of_supply,
    defaultTaxTreatment: payload.default_tax_treatment,
    notes: payload.notes,
    openingBalance: payload.opening_balance,
    creditLimit: payload.credit_limit,
    paymentTerms: payload.payment_terms,
    preferredPaymentMode: payload.preferred_payment_mode,
    preferredInvoiceTemplate: payload.preferred_invoice_template,
    preferredLanguage: payload.preferred_language,
    tags: payload.tags,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
    balance: payload.opening_balance,
    health: buildCustomerHealthScore({ balance: payload.opening_balance, latestActivityAt: now }),
  };
}

export async function updateWorkspaceCustomer(
  workspaceId: string,
  customerId: string,
  input: CreateWorkspaceCustomerInput
): Promise<WorkspaceCustomer> {
  const firestore = getWebFirestore();
  const customerRef = doc(firestore, 'workspaces', workspaceId, 'customers', customerId);
  const now = new Date().toISOString();
  const name = input.name.trim();
  const phone = input.phone?.trim() || null;
  await updateDoc(customerRef, {
    name,
    name_key: normalizeCustomerNameKey(name),
    phone,
    phone_key: normalizeCustomerPhoneKey(phone),
    ...customerProfilePayload(input),
    updated_at: now,
    last_modified: now,
    server_revision: increment(1),
  });
  const updated = await getWorkspaceCustomer(workspaceId, customerId);
  if (!updated) {
    throw new Error('Customer could not be loaded after saving.');
  }
  return updated;
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

function customerProfilePayload(input: CreateWorkspaceCustomerInput) {
  const customerType =
    input.customerType === 'individual' || input.customerType === 'business' ? input.customerType : null;
  const creditLimit =
    typeof input.creditLimit === 'number' && Number.isFinite(input.creditLimit)
      ? Math.max(0, input.creditLimit)
      : null;

  return {
    legal_name: cleanOptional(input.legalName),
    customer_type: customerType,
    contact_person: cleanOptional(input.contactPerson),
    whatsapp: cleanOptional(input.whatsapp),
    email: cleanOptional(input.email),
    address: cleanOptional(input.address),
    billing_address: cleanOptional(input.billingAddress) ?? cleanOptional(input.address),
    shipping_address: cleanOptional(input.shippingAddress),
    city: cleanOptional(input.city),
    town: cleanOptional(input.town),
    state_code: cleanOptional(input.stateCode)?.toUpperCase() ?? null,
    country_code: cleanOptional(input.countryCode)?.toUpperCase() ?? null,
    postal_code: cleanOptional(input.postalCode),
    gstin: cleanOptional(input.gstin)?.toUpperCase() ?? null,
    pan: cleanOptional(input.pan)?.toUpperCase() ?? null,
    tax_number: cleanOptional(input.taxNumber),
    registration_number: cleanOptional(input.registrationNumber),
    place_of_supply: cleanOptional(input.placeOfSupply),
    default_tax_treatment: cleanOptional(input.defaultTaxTreatment),
    notes: cleanOptional(input.notes),
    credit_limit: creditLimit,
    payment_terms: cleanOptional(input.paymentTerms),
    preferred_payment_mode: cleanOptional(input.preferredPaymentMode),
    preferred_invoice_template: cleanOptional(input.preferredInvoiceTemplate),
    preferred_language: cleanOptional(input.preferredLanguage),
    tags: Array.isArray(input.tags)
      ? input.tags.map((tag) => tag.trim()).filter(Boolean).slice(0, 12)
      : [],
  };
}

export async function listWorkspaceProducts(workspaceId: string): Promise<WorkspaceProduct[]> {
  const snapshot = await getDocs(
    query(
      collection(getWebFirestore(), 'workspaces', workspaceId, 'products'),
      orderBy('name', 'asc'),
      limitQuery(PRODUCT_LIST_LIMIT)
    )
  );
  return snapshot.docs.map(mapWorkspaceProduct);
}

export async function saveWorkspaceProduct(
  workspaceId: string,
  input: SaveWorkspaceProductInput,
  productId?: string
): Promise<WorkspaceProduct> {
  const now = new Date().toISOString();
  const payload = buildProductPayload(input, now);
  const firestore = getWebFirestore();

  if (productId) {
    const productRef = doc(firestore, 'workspaces', workspaceId, 'products', productId);
    await updateDoc(productRef, {
      ...payload,
      last_modified: now,
      server_revision: increment(1),
    });
    const updated = await getDoc(productRef);
    if (!updated.exists()) {
      throw new Error('Product could not be loaded after saving.');
    }
    return mapWorkspaceProduct(updated);
  }

  const ref = await addDoc(collection(firestore, 'workspaces', workspaceId, 'products'), {
    ...payload,
    created_at: now,
    last_modified: now,
    sync_status: 'synced',
    server_revision: 1,
  });
  return {
    id: ref.id,
    name: payload.name,
    price: payload.price,
    stockQuantity: payload.stock_quantity,
    unit: payload.unit,
    createdAt: now,
    lastModified: now,
    serverRevision: 1,
  };
}

function buildProductPayload(input: SaveWorkspaceProductInput, now: string) {
  const name = input.name.trim();
  const unit = input.unit.trim();
  const price = roundMoney(Number(input.price));
  const stockQuantity = roundQuantity(Number(input.stockQuantity));

  if (!name) {
    throw new Error('Add a product name before saving.');
  }
  if (!unit) {
    throw new Error('Add a unit before saving.');
  }
  if (!Number.isFinite(price) || price < 0) {
    throw new Error('Product price must be zero or more.');
  }
  if (!Number.isFinite(stockQuantity) || stockQuantity < 0) {
    throw new Error('Product stock must be zero or more.');
  }

  return {
    name,
    price,
    stock_quantity: stockQuantity,
    unit,
    last_modified: now,
    sync_status: 'synced',
  };
}

export async function listWorkspaceCustomerTimelineNotes(
  workspaceId: string,
  customerId: string
): Promise<WorkspaceCustomerTimelineNote[]> {
  const snapshot = await getDocs(
    query(
      collection(getWebFirestore(), 'workspaces', workspaceId, 'customer_timeline_notes'),
      where('customer_id', '==', customerId),
      limitQuery(CUSTOMER_TIMELINE_LIMIT)
    )
  );
  return snapshot.docs
    .map(mapWorkspaceCustomerTimelineNote)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function addWorkspaceCustomerTimelineNote(
  workspaceId: string,
  input: AddWorkspaceCustomerTimelineNoteInput
): Promise<WorkspaceCustomerTimelineNote> {
  const body = input.body.trim();
  if (!body) {
    throw new Error('Add a note before saving.');
  }
  const now = new Date().toISOString();
  const kind: WorkspaceCustomerTimelineNoteKind = input.kind === 'dispute' ? 'dispute' : 'note';
  const payload = {
    customer_id: input.customerId,
    kind,
    body,
    created_at: now,
    updated_at: now,
    last_modified: now,
    sync_status: 'synced',
    server_revision: 1,
  };
  const ref = await addDoc(
    collection(getWebFirestore(), 'workspaces', workspaceId, 'customer_timeline_notes'),
    payload
  );
  return { id: ref.id, customerId: input.customerId, kind, body, createdAt: now, updatedAt: now };
}

export async function listWorkspacePaymentRemindersForCustomer(
  workspaceId: string,
  customerId: string
): Promise<WorkspacePaymentReminder[]> {
  const snapshot = await getDocs(
    query(
      collection(getWebFirestore(), 'workspaces', workspaceId, 'payment_reminders'),
      where('customer_id', '==', customerId),
      limitQuery(CUSTOMER_TIMELINE_LIMIT)
    )
  );
  return snapshot.docs
    .map(mapWorkspacePaymentReminder)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function addWorkspacePaymentReminder(
  workspaceId: string,
  input: AddWorkspacePaymentReminderInput
): Promise<WorkspacePaymentReminder> {
  const message = input.message.trim();
  if (!message) {
    throw new Error('Add a reminder message before saving.');
  }
  const now = new Date().toISOString();
  const payload = {
    customer_id: input.customerId,
    tone: input.tone,
    message,
    balance_at_send: roundMoney(input.balanceAtSend),
    shared_via: input.sharedVia?.trim() || 'web_review',
    created_at: now,
    last_modified: now,
    sync_status: 'synced',
    server_revision: 1,
  };
  const ref = await addDoc(collection(getWebFirestore(), 'workspaces', workspaceId, 'payment_reminders'), payload);
  return {
    id: ref.id,
    customerId: input.customerId,
    tone: payload.tone,
    message,
    balanceAtSend: payload.balance_at_send,
    sharedVia: payload.shared_via,
    createdAt: now,
  };
}

export async function listWorkspacePaymentPromisesForCustomer(
  workspaceId: string,
  customerId: string
): Promise<WorkspacePaymentPromise[]> {
  const snapshot = await getDocs(
    query(
      collection(getWebFirestore(), 'workspaces', workspaceId, 'payment_promises'),
      where('customer_id', '==', customerId),
      limitQuery(CUSTOMER_TIMELINE_LIMIT)
    )
  );
  return snapshot.docs.map(mapWorkspacePaymentPromise).sort(sortPaymentPromises);
}

export async function listWorkspacePaymentPromises(workspaceId: string): Promise<WorkspacePaymentPromise[]> {
  const snapshot = await getDocs(
    query(
      collection(getWebFirestore(), 'workspaces', workspaceId, 'payment_promises'),
      limitQuery(100)
    )
  );
  return snapshot.docs.map(mapWorkspacePaymentPromise).sort(sortPaymentPromises);
}

export async function addWorkspacePaymentPromise(
  workspaceId: string,
  input: AddWorkspacePaymentPromiseInput
): Promise<WorkspacePaymentPromise> {
  if (!Number.isFinite(input.promisedAmount) || input.promisedAmount <= 0) {
    throw new Error('Promise amount must be more than zero.');
  }
  if (!input.promisedDate.trim()) {
    throw new Error('Choose the promised date.');
  }
  const now = new Date().toISOString();
  const payload = {
    customer_id: input.customerId,
    promised_amount: roundMoney(input.promisedAmount),
    promised_date: input.promisedDate,
    note: input.note?.trim() || null,
    status: 'open',
    created_at: now,
    updated_at: now,
    last_modified: now,
    sync_status: 'synced',
    server_revision: 1,
  };
  const ref = await addDoc(collection(getWebFirestore(), 'workspaces', workspaceId, 'payment_promises'), payload);
  return {
    id: ref.id,
    customerId: input.customerId,
    promisedAmount: payload.promised_amount,
    promisedDate: payload.promised_date,
    note: payload.note,
    status: 'open',
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateWorkspacePaymentPromiseStatus(
  workspaceId: string,
  promiseId: string,
  status: WorkspacePaymentPromiseStatus
): Promise<WorkspacePaymentPromise> {
  if (!['open', 'fulfilled', 'missed', 'cancelled'].includes(status)) {
    throw new Error('Unsupported payment promise status.');
  }
  const firestore = getWebFirestore();
  const promiseRef = doc(firestore, 'workspaces', workspaceId, 'payment_promises', promiseId);
  const now = new Date().toISOString();
  await updateDoc(promiseRef, {
    status,
    updated_at: now,
    last_modified: now,
    server_revision: increment(1),
  });
  const updated = await getDoc(promiseRef);
  if (!updated.exists()) {
    throw new Error('Payment promise could not be loaded after saving.');
  }
  return mapWorkspacePaymentPromise(updated);
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

  return transactionSnapshot.docs.map((entry) => {
    const customerId = String((entry.data() as { customer_id?: string }).customer_id ?? '');
    return mapWorkspaceTransaction(entry, customerNames.get(customerId) ?? 'Customer');
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
          paymentMode,
        })
      : [];
  const delta =
    input.type === 'credit'
      ? input.amount
      : doesPaymentClearInvoice(paymentClearanceStatus, paymentMode)
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

export type ListWorkspaceInvoicesOptions = {
  includeVersions?: boolean;
};

export async function listWorkspaceInvoices(
  workspaceId: string,
  options: ListWorkspaceInvoicesOptions = {}
): Promise<WorkspaceInvoice[]> {
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
    options.includeVersions === false
      ? Promise.resolve(new Map<string, WorkspaceInvoiceVersion[]>())
      : loadInvoiceVersionsForInvoices(firestore, workspaceId, invoices.map((invoice) => invoice.id)),
  ]);

  return invoices.map((invoice) => ({
    ...invoice,
    customerName: invoice.customerId ? customerNames.get(invoice.customerId) ?? 'Customer' : null,
    versions: options.includeVersions === false ? undefined : versionsByInvoice.get(invoice.id) ?? [],
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

export async function listWorkspaceRecurringInvoiceRules(
  workspaceId: string
): Promise<WorkspaceRecurringInvoiceRule[]> {
  const firestore = getWebFirestore();
  const snapshot = await getDocs(
    query(
      collection(firestore, 'workspaces', workspaceId, 'recurring_invoice_rules'),
      orderBy('next_run_date', 'asc'),
      limitQuery(100)
    )
  );
  return snapshot.docs.map(mapWorkspaceRecurringInvoiceRule);
}

export async function listWorkspaceRecurringEmailQueue(
  workspaceId: string,
  recurringRuleId?: string | null
): Promise<WorkspaceRecurringEmailQueueItem[]> {
  const firestore = getWebFirestore();
  const snapshot = await getDocs(
    query(
      collection(firestore, 'workspaces', workspaceId, 'email_queue'),
      orderBy('scheduled_for', 'desc'),
      limitQuery(100)
    )
  );
  return snapshot.docs
    .filter((entry) => (entry.data() as { kind?: string }).kind === 'recurring_invoice')
    .map(mapWorkspaceRecurringEmailQueueItem)
    .filter((item) => !recurringRuleId || item.recurringRuleId === recurringRuleId);
}

export async function saveWorkspaceRecurringInvoiceRule(
  workspaceId: string,
  input: SaveWorkspaceRecurringInvoiceRuleInput,
  ruleId?: string
): Promise<WorkspaceRecurringInvoiceRule> {
  const firestore = getWebFirestore();
  const now = new Date().toISOString();
  const customerSnapshot = await getDoc(doc(firestore, 'workspaces', workspaceId, 'customers', input.customerId));
  if (!customerSnapshot.exists()) {
    throw new Error('Choose a customer before saving the auto-create rule.');
  }

  const cleanRule = buildRecurringInvoiceRulePayload(input, now, customerSnapshot.data().name);
  const ruleRef = ruleId
    ? doc(firestore, 'workspaces', workspaceId, 'recurring_invoice_rules', ruleId)
    : doc(collection(firestore, 'workspaces', workspaceId, 'recurring_invoice_rules'));

  if (ruleId) {
    await updateDoc(ruleRef, {
      ...cleanRule,
      status: 'active',
      last_modified: now,
      server_revision: increment(1),
    });
  } else {
    await setDoc(ruleRef, {
      ...cleanRule,
      status: 'active',
      created_at: now,
      last_modified: now,
      sync_status: 'synced',
      server_revision: 1,
    });
  }

  const updated = await getDoc(ruleRef);
  if (!updated.exists()) {
    throw new Error('Auto-create rule could not be loaded after saving.');
  }
  return mapWorkspaceRecurringInvoiceRule(updated);
}

export async function cancelWorkspaceRecurringInvoiceRule(
  workspaceId: string,
  ruleId: string
): Promise<WorkspaceRecurringInvoiceRule> {
  const firestore = getWebFirestore();
  const ruleRef = doc(firestore, 'workspaces', workspaceId, 'recurring_invoice_rules', ruleId);
  await updateDoc(ruleRef, {
    status: 'cancelled',
    last_modified: new Date().toISOString(),
    server_revision: increment(1),
  });
  const updated = await getDoc(ruleRef);
  if (!updated.exists()) {
    throw new Error('Auto-create rule could not be loaded after cancelling.');
  }
  return mapWorkspaceRecurringInvoiceRule(updated);
}

export async function runDueWorkspaceRecurringInvoices(
  workspaceId: string,
  today = new Date().toISOString().slice(0, 10)
): Promise<WorkspaceInvoice[]> {
  const firestore = getWebFirestore();
  const workspaceSnapshot = await getDoc(doc(firestore, 'workspaces', workspaceId));
  const workspaceName = workspaceSnapshot.exists()
    ? String((workspaceSnapshot.data() as { business_name?: string }).business_name ?? 'Orbit Ledger')
    : 'Orbit Ledger';
  const rules = (await listWorkspaceRecurringInvoiceRules(workspaceId)).filter(
    (rule) => rule.status === 'active' && rule.nextRunDate && rule.nextRunDate <= today
  );
  const createdInvoices: WorkspaceInvoice[] = [];

  for (const rule of rules) {
    const runDates = getDueRecurringRunDates(rule, today);
    if (!runDates.length) {
      continue;
    }

    let latestCreatedInvoiceId: string | null = rule.lastCreatedInvoiceId;
    let latestCreatedRunDate: string | null = rule.lastCreatedRunDate;
    for (const runDate of runDates) {
      const emailDate = rule.emailEnabled
        ? rule.nextEmailDate ?? getMonthlyDateForDay(runDate.slice(0, 7), rule.emailDay ?? rule.invoiceDay)
        : null;
      const invoiceDate = emailDate
        ? getMonthlyDateForDay(emailDate.slice(0, 7), rule.invoiceDay)
        : runDate;
      const invoice = await createInvoiceFromRecurringRule(
        firestore,
        workspaceId,
        rule,
        invoiceDate,
        workspaceName,
        today,
        emailDate,
        runDate
      );
      if (invoice) {
        createdInvoices.push(invoice);
        latestCreatedInvoiceId = invoice.id;
        latestCreatedRunDate = invoiceDate;
      }
    }

    const lastEmailDate = rule.emailEnabled
      ? rule.nextEmailDate ?? getMonthlyDateForDay((runDates[runDates.length - 1] ?? rule.nextRunDate).slice(0, 7), rule.emailDay ?? rule.invoiceDay)
      : null;
    const nextEmailDate = lastEmailDate ? getNextRecurringRunDateAfter(lastEmailDate, rule.emailDay ?? rule.invoiceDay) : null;
    const nextRunDate = nextEmailDate
      ? subtractDays(nextEmailDate, 3)
      : getNextRecurringRunDateAfter(runDates[runDates.length - 1] ?? rule.nextRunDate, rule.invoiceDay);
    await updateDoc(doc(firestore, 'workspaces', workspaceId, 'recurring_invoice_rules', rule.id), {
      next_run_date: rule.endDate && nextRunDate > rule.endDate ? rule.endDate : nextRunDate,
      next_email_date: nextEmailDate,
      last_created_invoice_id: latestCreatedInvoiceId,
      last_created_run_date: latestCreatedRunDate,
      last_modified: new Date().toISOString(),
      server_revision: increment(1),
    });
  }

  return createdInvoices;
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
        is_reversed?: boolean;
        reversed_at?: string | null;
        reversal_reason?: string | null;
        reversal_transaction_id?: string | null;
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
        isReversed: Boolean(data.is_reversed),
        reversedAt: data.reversed_at ?? null,
        reversalReason: data.reversal_reason ?? null,
        reversalTransactionId: data.reversal_transaction_id ?? null,
      };
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function listWorkspaceManualPaymentReviewItems(
  workspaceId: string
): Promise<WorkspaceManualPaymentReviewItem[]> {
  const firestore = getWebFirestore();
  const transactionSnapshot = await getDocs(
    query(
      collection(firestore, 'workspaces', workspaceId, 'transactions'),
      orderBy('created_at', 'desc'),
      limitQuery(TRANSACTION_LIST_LIMIT)
    )
  );
  const transactions = transactionSnapshot.docs
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
      const paymentClearanceStatus = normalizePaymentClearanceStatus(
        data.payment_clearance_status,
        paymentMode,
        paymentDetails
      );
      return {
        id: entry.id,
        type: data.type ?? 'payment',
        customerId: data.customer_id ?? '',
        amount: data.amount ?? 0,
        note: data.note ?? null,
        paymentMode,
        paymentDetails,
        paymentClearanceStatus,
        paymentAttachments: normalizeStoredPaymentAttachments(data),
        effectiveDate: data.effective_date ?? '',
        createdAt: data.created_at ?? '',
      };
    })
    .filter((transaction) => transaction.type === 'payment' && transaction.paymentClearanceStatus !== 'cleared');

  if (!transactions.length) {
    return [];
  }

  const transactionIds = transactions.map((transaction) => transaction.id);
  const [customerNames, allocationSnapshots] = await Promise.all([
    loadCustomerNamesByIds(firestore, workspaceId, transactions.map((transaction) => transaction.customerId)),
    Promise.all(
      chunk(transactionIds, FIRESTORE_IN_QUERY_LIMIT).map((ids) =>
        getDocs(
          query(
            collection(firestore, 'workspaces', workspaceId, 'payment_allocations'),
            where('transaction_id', 'in', ids)
          )
        )
      )
    ),
  ]);
  const allocationsByTransaction = new Map<
    string,
    Array<{ id: string; invoiceId: string; amount: number; createdAt: string }>
  >();
  const invoiceIds: string[] = [];
  for (const allocationEntry of allocationSnapshots.flatMap((snapshot) => snapshot.docs)) {
    const allocation = allocationEntry.data() as {
      transaction_id?: string;
      invoice_id?: string;
      amount?: number;
      created_at?: string;
      is_reversed?: boolean;
    };
    if (!allocation.transaction_id || !allocation.invoice_id || allocation.is_reversed) {
      continue;
    }
    invoiceIds.push(allocation.invoice_id);
    const current = allocationsByTransaction.get(allocation.transaction_id) ?? [];
    current.push({
      id: allocationEntry.id,
      invoiceId: allocation.invoice_id,
      amount: allocation.amount ?? 0,
      createdAt: allocation.created_at ?? '',
    });
    allocationsByTransaction.set(allocation.transaction_id, current);
  }
  const invoicesById = await loadInvoiceSummariesByIds(firestore, workspaceId, invoiceIds);

  return transactions.flatMap<WorkspaceManualPaymentReviewItem>((transaction) => {
    const allocations = allocationsByTransaction.get(transaction.id) ?? [];
    if (!allocations.length) {
      return [
        {
          transactionId: transaction.id,
          customerId: transaction.customerId,
          customerName: customerNames.get(transaction.customerId) ?? 'Customer',
          amount: transaction.amount,
          note: transaction.note,
          paymentMode: transaction.paymentMode,
          paymentDetails: transaction.paymentDetails,
          paymentClearanceStatus: transaction.paymentClearanceStatus,
          paymentAttachments: transaction.paymentAttachments,
          effectiveDate: transaction.effectiveDate,
          createdAt: transaction.createdAt,
          allocationId: null,
          invoiceId: null,
          invoiceNumber: null,
          invoiceDueAmount: null,
        },
      ];
    }

    return allocations.map((allocation) => {
      const invoice = invoicesById.get(allocation.invoiceId);
      return {
        transactionId: transaction.id,
        customerId: transaction.customerId,
        customerName: customerNames.get(transaction.customerId) ?? 'Customer',
        amount: allocation.amount || transaction.amount,
        note: transaction.note,
        paymentMode: transaction.paymentMode,
        paymentDetails: transaction.paymentDetails,
        paymentClearanceStatus: transaction.paymentClearanceStatus,
        paymentAttachments: transaction.paymentAttachments,
        effectiveDate: transaction.effectiveDate,
        createdAt: transaction.createdAt,
        allocationId: allocation.id,
        invoiceId: allocation.invoiceId,
        invoiceNumber: invoice?.invoiceNumber ?? null,
        invoiceDueAmount: invoice ? Math.max(invoice.totalAmount - invoice.paidAmount, 0) : null,
      };
    });
  });
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
    is_reversed?: boolean;
  };
  if (allocation.is_reversed) {
    throw new Error('This payment allocation has already been reversed.');
  }
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
      is_reversed?: boolean;
    };
    if (!data.invoice_id || typeof data.amount !== 'number' || data.is_reversed) {
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
    const previousPaidDelta = doesPaymentClearInvoice(previousStatus, paymentMode) ? data.amount : 0;
    const nextPaidDelta = doesPaymentClearInvoice(nextStatus, paymentMode) ? data.amount : 0;
    const nextPaidAmount = roundMoney(Math.max((invoice.paid_amount ?? 0) - previousPaidDelta + nextPaidDelta, 0));
    const nextPaymentStatus = deriveInvoicePaymentStatus({
      dueDate: invoice.due_date,
      totalAmount: invoice.total_amount,
      paidAmount: nextPaidAmount,
      pendingAmount: doesPaymentAwaitClearance(nextStatus, paymentMode) ? data.amount : 0,
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
      (doesPaymentClearInvoice(previousStatus, paymentMode) ? amount : 0) -
      (doesPaymentClearInvoice(nextStatus, paymentMode) ? amount : 0);
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

export async function reverseWorkspaceInvoicePaymentAllocation(
  workspaceId: string,
  allocationId: string,
  input: ReverseWorkspaceInvoicePaymentInput = {}
): Promise<void> {
  const firestore = getWebFirestore();
  const allocationRef = doc(firestore, 'workspaces', workspaceId, 'payment_allocations', allocationId);
  const allocationSnapshot = await getDoc(allocationRef);
  if (!allocationSnapshot.exists()) {
    throw new Error('Payment allocation could not be found.');
  }

  const allocation = allocationSnapshot.data() as {
    transaction_id?: string;
    invoice_id?: string;
    customer_id?: string;
    amount?: number;
    is_reversed?: boolean;
  };
  if (allocation.is_reversed) {
    throw new Error('This payment has already been reversed.');
  }
  if (!allocation.transaction_id || !allocation.invoice_id || !allocation.customer_id) {
    throw new Error('Payment allocation is missing invoice or customer details.');
  }
  const allocationAmount = roundMoney(allocation.amount ?? 0);
  if (allocationAmount <= 0) {
    throw new Error('Payment allocation has no valid amount.');
  }

  const transactionRef = doc(firestore, 'workspaces', workspaceId, 'transactions', allocation.transaction_id);
  const invoiceRef = doc(firestore, 'workspaces', workspaceId, 'invoices', allocation.invoice_id);
  const [transactionSnapshot, invoiceSnapshot] = await Promise.all([getDoc(transactionRef), getDoc(invoiceRef)]);
  if (!transactionSnapshot.exists()) {
    throw new Error('Payment record could not be found.');
  }
  if (!invoiceSnapshot.exists()) {
    throw new Error('Invoice for this payment could not be found.');
  }

  const transaction = transactionSnapshot.data() as {
    payment_mode?: string | null;
    payment_details?: PaymentModeDetails | null;
    payment_details_json?: string | null;
    payment_clearance_status?: string | null;
  };
  const invoice = invoiceSnapshot.data() as {
    paid_amount?: number;
    total_amount?: number;
    due_date?: string | null;
    status?: string;
    document_state?: string;
  };
  const paymentMode = transaction.payment_mode ? normalizePaymentMode(transaction.payment_mode) : null;
  const paymentDetails = normalizeStoredPaymentDetails(transaction);
  const clearanceStatus = normalizePaymentClearanceStatus(
    transaction.payment_clearance_status,
    paymentMode,
    paymentDetails
  );
  const paidDelta = doesPaymentClearInvoice(clearanceStatus, paymentMode)
    ? roundMoney(Math.min(allocationAmount, invoice.paid_amount ?? 0))
    : 0;
  const balanceDelta = doesPaymentClearInvoice(clearanceStatus, paymentMode) ? allocationAmount : 0;
  const nextPaidAmount = roundMoney(Math.max((invoice.paid_amount ?? 0) - paidDelta, 0));
  const nextPaymentStatus = deriveInvoicePaymentStatus({
    dueDate: invoice.due_date,
    totalAmount: invoice.total_amount,
    paidAmount: nextPaidAmount,
  });
  const documentState = normalizeInvoiceDocumentState(invoice.document_state ?? invoice.status);
  const now = new Date().toISOString();
  const reversalReason = input.note?.trim() || 'Payment reversed by owner correction.';
  const reversalRef = doc(collection(firestore, 'workspaces', workspaceId, 'payment_reversals'));
  const reversalTransactionRef =
    balanceDelta > 0 ? doc(collection(firestore, 'workspaces', workspaceId, 'transactions')) : null;
  const batch = writeBatch(firestore);

  if (reversalTransactionRef) {
    batch.set(reversalTransactionRef, {
      customer_id: allocation.customer_id,
      type: 'credit',
      amount: balanceDelta,
      note: reversalReason,
      payment_mode: null,
      payment_details: null,
      payment_details_json: null,
      payment_clearance_status: null,
      payment_attachments: [],
      payment_attachments_json: null,
      effective_date: now.slice(0, 10),
      created_at: now,
      last_modified: now,
      sync_status: 'synced',
      server_revision: 1,
      reversal_of_transaction_id: allocation.transaction_id,
      reversal_of_allocation_id: allocationId,
    });
  }

  batch.set(reversalRef, {
    original_transaction_id: allocation.transaction_id,
    reversal_transaction_id: reversalTransactionRef?.id ?? null,
    allocation_id: allocationId,
    invoice_id: allocation.invoice_id,
    customer_id: allocation.customer_id,
    amount: allocationAmount,
    allocation_amount: allocationAmount,
    balance_delta: balanceDelta,
    reason: reversalReason,
    created_at: now,
    last_modified: now,
    source: 'manual',
  });
  batch.update(allocationRef, {
    is_reversed: true,
    reversed_at: now,
    reversal_reason: reversalReason,
    reversal_id: reversalRef.id,
    reversal_transaction_id: reversalTransactionRef?.id ?? null,
    last_modified: now,
    server_revision: increment(1),
  });
  batch.update(invoiceRef, {
    paid_amount: nextPaidAmount,
    payment_status: nextPaymentStatus,
    status: legacyStatusForInvoiceLifecycle(documentState, nextPaymentStatus),
    last_modified: now,
    server_revision: increment(1),
  });
  batch.update(transactionRef, {
    has_correction: true,
    last_modified: now,
    server_revision: increment(1),
  });
  if (balanceDelta > 0) {
    batch.update(doc(firestore, 'workspaces', workspaceId, 'customers', allocation.customer_id), {
      current_balance: increment(balanceDelta),
      updated_at: now,
      last_modified: now,
      server_revision: increment(1),
    });
  }

  await batch.commit();
}

export async function updateWorkspaceManualPaymentClearance(
  workspaceId: string,
  transactionId: string,
  input: UpdateWorkspacePaymentClearanceInput
): Promise<void> {
  const firestore = getWebFirestore();
  const transactionRef = doc(firestore, 'workspaces', workspaceId, 'transactions', transactionId);
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
      where('transaction_id', '==', transactionId)
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
      is_reversed?: boolean;
    };
    if (!data.invoice_id || typeof data.amount !== 'number' || data.is_reversed) {
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
    const previousPaidDelta = doesPaymentClearInvoice(previousStatus, paymentMode) ? data.amount : 0;
    const nextPaidDelta = doesPaymentClearInvoice(nextStatus, paymentMode) ? data.amount : 0;
    const nextPaidAmount = roundMoney(Math.max((invoice.paid_amount ?? 0) - previousPaidDelta + nextPaidDelta, 0));
    const nextPaymentStatus = deriveInvoicePaymentStatus({
      dueDate: invoice.due_date,
      totalAmount: invoice.total_amount,
      paidAmount: nextPaidAmount,
      pendingAmount: doesPaymentAwaitClearance(nextStatus, paymentMode) ? data.amount : 0,
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

  const customerId = transaction.customer_id;
  const amount = typeof transaction.amount === 'number' ? transaction.amount : 0;
  if (customerId && amount > 0) {
    const balanceDelta =
      (doesPaymentClearInvoice(previousStatus, paymentMode) ? amount : 0) -
      (doesPaymentClearInvoice(nextStatus, paymentMode) ? amount : 0);
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

export async function listWorkspacePaymentProviderEvents(
  workspaceId: string
): Promise<WorkspacePaymentProviderEvent[]> {
  const firestore = getWebFirestore();
  const snapshot = await getDocs(
    query(
      collection(firestore, 'workspaces', workspaceId, 'payment_provider_events'),
      orderBy('created_at', 'desc'),
      limitQuery(80)
    )
  );

  return snapshot.docs.map(mapWorkspacePaymentProviderEvent);
}

export async function markWorkspaceProviderEventReviewed(
  workspaceId: string,
  eventId: string,
  note?: string | null
): Promise<void> {
  const now = new Date().toISOString();
  await updateDoc(
    doc(getWebFirestore(), 'workspaces', workspaceId, 'payment_provider_events', eventId),
    {
      reviewed_at: now,
      review_note: note?.trim() || null,
      last_modified: now,
    }
  );
}

export async function applyWorkspaceProviderEventToInvoice(
  workspaceId: string,
  eventId: string,
  input: ApplyWorkspaceProviderEventInput
): Promise<void> {
  const firestore = getWebFirestore();
  const eventRef = doc(firestore, 'workspaces', workspaceId, 'payment_provider_events', eventId);
  const eventSnapshot = await getDoc(eventRef);
  if (!eventSnapshot.exists()) {
    throw new Error('Payment event could not be found.');
  }

  const event = mapWorkspacePaymentProviderEvent(eventSnapshot);
  if (event.applied) {
    throw new Error('This payment event is already applied.');
  }
  if (event.status !== 'succeeded') {
    throw new Error('Only successful payment events can be applied to an invoice.');
  }
  if (event.amount <= 0) {
    throw new Error('Payment event has no valid amount.');
  }

  const invoice = await getWorkspaceInvoiceDetail(workspaceId, input.invoiceId);
  if (!invoice) {
    throw new Error('Choose a valid invoice before applying this event.');
  }
  const customerId = input.customerId ?? invoice.customerId;
  if (!customerId) {
    throw new Error('Choose a customer before applying this payment.');
  }

  const transaction = await createWorkspaceTransaction(workspaceId, {
    customerId,
    type: 'payment',
    amount: event.amount,
    effectiveDate: event.createdAt.slice(0, 10),
    note: input.note?.trim() || buildProviderEventPaymentNote(event, invoice.invoiceNumber),
    paymentMode: paymentModeForProviderEvent(event.source),
    paymentDetails: {
      referenceNumber: event.reference ?? event.providerPaymentId,
      provider: providerEventLabel(event.source),
      note: event.payerName,
    },
    paymentClearanceStatus: 'cleared',
    paymentAttachments: [],
    allocationStrategy: 'selected_invoice',
    invoiceId: invoice.id,
  });

  const now = new Date().toISOString();
  await updateDoc(eventRef, {
    applied: true,
    apply_status: 'manual_applied',
    invoice_id: invoice.id,
    customer_id: customerId,
    transaction_id: transaction.id,
    reviewed_at: now,
    review_note: input.note?.trim() || 'Applied by owner review.',
    last_modified: now,
  });
}

export async function reverseWorkspaceProviderEventPayment(
  workspaceId: string,
  eventId: string,
  input: ReverseWorkspaceProviderEventInput = {}
): Promise<void> {
  const firestore = getWebFirestore();
  const eventRef = doc(firestore, 'workspaces', workspaceId, 'payment_provider_events', eventId);
  const eventSnapshot = await getDoc(eventRef);
  if (!eventSnapshot.exists()) {
    throw new Error('Payment event could not be found.');
  }

  const event = mapWorkspacePaymentProviderEvent(eventSnapshot);
  if (event.reversed) {
    throw new Error('This payment event is already reversed.');
  }
  if (!event.applied && event.status !== 'refunded') {
    throw new Error('Only applied payments or refund events can be reversed.');
  }
  if (event.amount <= 0) {
    throw new Error('This event has no valid amount to reverse.');
  }

  const invoiceId = input.invoiceId ?? event.invoiceId;
  if (!invoiceId) {
    throw new Error('Choose an invoice before reversing this payment.');
  }
  const invoice = await getWorkspaceInvoiceDetail(workspaceId, invoiceId);
  if (!invoice) {
    throw new Error('Invoice for this payment event could not be found.');
  }
  const customerId = input.customerId ?? event.customerId ?? invoice.customerId;
  if (!customerId) {
    throw new Error('Choose a customer before reversing this payment.');
  }

  const now = new Date().toISOString();
  const refundAmount = roundMoney(event.amount);
  const reversalAllocationAmount = roundMoney(Math.min(event.allocationAmount || refundAmount, invoice.paidAmount));
  const nextPaidAmount = roundMoney(Math.max(invoice.paidAmount - reversalAllocationAmount, 0));
  const nextPaymentStatus = deriveInvoicePaymentStatus({
    dueDate: invoice.dueDate,
    totalAmount: invoice.totalAmount,
    paidAmount: nextPaidAmount,
  });
  const nextLegacyStatus = legacyStatusForInvoiceLifecycle(invoice.documentState, nextPaymentStatus);
  const reversalId = `rev_${event.id}`;
  const reversalTransactionId = `txn_rev_${event.id}`;
  const batch = writeBatch(firestore);

  batch.set(doc(firestore, 'workspaces', workspaceId, 'transactions', reversalTransactionId), {
    customer_id: customerId,
    type: 'credit',
    amount: refundAmount,
    note: input.note?.trim() || buildProviderEventRefundNote(event),
    payment_mode: null,
    payment_details: null,
    payment_details_json: null,
    payment_clearance_status: null,
    payment_attachments: [],
    payment_attachments_json: null,
    effective_date: now.slice(0, 10),
    created_at: now,
    last_modified: now,
    sync_status: 'synced',
    server_revision: 1,
    provider_event_id: event.id,
    reversal_of_transaction_id: event.transactionId,
  });

  batch.set(doc(firestore, 'workspaces', workspaceId, 'payment_reversals', reversalId), {
    provider_event_id: event.id,
    original_transaction_id: event.transactionId,
    reversal_transaction_id: reversalTransactionId,
    invoice_id: invoice.id,
    customer_id: customerId,
    amount: refundAmount,
    allocation_amount: reversalAllocationAmount,
    reason: input.note?.trim() || 'Payment reversed by owner review.',
    created_at: now,
    last_modified: now,
    source: event.source,
    reference: event.reference ?? event.providerPaymentId,
  });

  batch.update(doc(firestore, 'workspaces', workspaceId, 'invoices', invoice.id), {
    paid_amount: nextPaidAmount,
    payment_status: nextPaymentStatus,
    status: nextLegacyStatus,
    last_modified: now,
    server_revision: increment(1),
  });

  batch.update(doc(firestore, 'workspaces', workspaceId, 'customers', customerId), {
    current_balance: increment(refundAmount),
    updated_at: now,
    last_modified: now,
    server_revision: increment(1),
  });

  batch.update(eventRef, {
    apply_status: 'reversed',
    status: 'refunded',
    applied: true,
    invoice_id: invoice.id,
    customer_id: customerId,
    reversed: true,
    reversed_at: now,
    reversal_id: reversalId,
    reversal_transaction_id: reversalTransactionId,
    refunded_amount: refundAmount,
    reviewed_at: now,
    review_note: input.note?.trim() || 'Payment reversed by owner review.',
    last_modified: now,
  });

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
	    billing_month?: string | null;
	    due_date?: string | null;
    subtotal?: number;
    tax_amount?: number;
    total_amount?: number;
    paid_amount?: number;
    status?: string;
    document_state?: string;
    payment_status?: string;
    payment_status_reason?: string | null;
    version_number?: number;
    is_archived?: boolean;
	    latest_version_id?: string | null;
	    latest_snapshot_hash?: string | null;
	    use_for_monthly_auto_email?: boolean;
	    recurring_rule_id?: string | null;
	    auto_email_prepared_at?: string | null;
	    auto_email_scheduled_for?: string | null;
	    has_auto_email_history?: boolean;
	    latest_auto_email_status?: string | null;
	    latest_auto_email_sent_at?: string | null;
	    latest_auto_email_version_id?: string | null;
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
	    billingMonth: data.billing_month ?? data.issue_date?.slice(0, 7) ?? null,
	    dueDate: data.due_date ?? null,
    subtotal: data.subtotal ?? 0,
    taxAmount: data.tax_amount ?? 0,
    totalAmount: data.total_amount ?? 0,
    paidAmount: data.paid_amount ?? 0,
    status: data.status ?? 'draft',
    documentState,
	    paymentStatus,
	    paymentStatusReason: data.payment_status_reason ?? null,
	    useForMonthlyAutoEmail: Boolean(data.use_for_monthly_auto_email),
	    recurringRuleId: data.recurring_rule_id ?? null,
	    autoEmailPreparedAt: data.auto_email_prepared_at ?? null,
	    autoEmailScheduledFor: data.auto_email_scheduled_for ?? null,
	    hasAutoEmailHistory: Boolean(data.has_auto_email_history),
	    latestAutoEmailStatus: data.latest_auto_email_status ?? null,
	    latestAutoEmailSentAt: data.latest_auto_email_sent_at ?? null,
	    latestAutoEmailVersionId: data.latest_auto_email_version_id ?? null,
	    versionNumber: data.version_number ?? (documentState === 'draft' ? 0 : 1),
    isArchived: Boolean(data.is_archived),
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
    payment_status_reason?: string | null;
    version_number?: number;
    latest_snapshot_hash?: string | null;
    latest_version_id?: string | null;
    paid_amount?: number;
    use_for_monthly_auto_email?: boolean;
    auto_email_prepared_at?: string | null;
    auto_email_scheduled_for?: string | null;
    auto_email_recipient?: string | null;
    auto_email_queue_id?: string | null;
    latest_auto_email_status?: string | null;
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
        productId: item.productId?.trim() || null,
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
  const cleanInvoiceNumber = input.invoiceNumber.trim();
  await assertWorkspaceInvoiceNumberAvailable(firestore, workspaceId, invoiceId, cleanInvoiceNumber);
  if (currentDocumentState !== 'draft' && !input.revisionReason?.trim()) {
    throw new Error('Choose why this invoice is being updated before saving.');
  }
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
    invoiceNumber: cleanInvoiceNumber,
    customerId: input.customerId,
    customerName: customerSnapshot?.exists() ? String(customerSnapshot.data().name ?? 'Customer') : null,
    issueDate: input.issueDate,
    dueDate: input.dueDate || null,
    documentState: nextDocumentState,
    paymentStatus,
    paymentStatusReason: input.paymentStatusReason ?? null,
    subtotal,
    taxAmount,
    totalAmount,
    notes: input.notes?.trim() || null,
      items: cleanItems.map((item) => ({
        id: item.id ?? '',
        invoiceId,
        productId: item.productId ?? null,
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
  const productStockDeltas = buildInvoiceProductStockDeltas(existingItems.docs, cleanItems);
  await assertProductStockCanApply(firestore, workspaceId, productStockDeltas);
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
  const billingMonth = input.issueDate.slice(0, 7);
  const useForMonthlyAutoEmail =
    typeof input.useForMonthlyAutoEmail === 'boolean'
      ? input.useForMonthlyAutoEmail
      : Boolean(current.use_for_monthly_auto_email);
  const scheduledAutoEmailDate = useForMonthlyAutoEmail
    ? String(current.auto_email_scheduled_for ?? current.auto_email_prepared_at ?? '')
    : '';
  const nextAutoEmailStatus = useForMonthlyAutoEmail && scheduledAutoEmailDate
    ? current.latest_auto_email_status ?? 'scheduled'
    : current.latest_auto_email_status ?? null;

  batch.update(invoiceRef, {
    customer_id: input.customerId,
    invoice_number: cleanInvoiceNumber,
    invoice_number_key: normalizeInvoiceNumberKey(cleanInvoiceNumber),
    issue_date: input.issueDate,
    billing_month: billingMonth,
    due_date: input.dueDate || null,
    subtotal,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    paid_amount: current.paid_amount ?? 0,
    status: legacyStatus,
    document_state: finalDocumentState,
    payment_status: paymentStatus,
    payment_status_reason: input.paymentStatusReason ?? null,
    use_for_monthly_auto_email: useForMonthlyAutoEmail,
    latest_auto_email_status: nextAutoEmailStatus,
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
      invoice_number: cleanInvoiceNumber,
      invoice_number_key: normalizeInvoiceNumberKey(cleanInvoiceNumber),
      version_number: nextVersionNumber,
      reason: cleanVersionReason(input.revisionReason, nextVersionNumber),
      created_at: now,
      customer_id: input.customerId,
      customer_name: snapshot.customerName,
      issue_date: input.issueDate,
      billing_month: billingMonth,
      due_date: input.dueDate || null,
      document_state: nextDocumentState,
      payment_status: paymentStatus,
      payment_status_reason: input.paymentStatusReason ?? null,
      auto_email_sent_at: null,
      auto_email_scheduled_for: scheduledAutoEmailDate || null,
      auto_email_recipient: scheduledAutoEmailDate ? current.auto_email_recipient ?? null : null,
      auto_email_queue_id: scheduledAutoEmailDate ? current.auto_email_queue_id ?? null : null,
      auto_email_status: scheduledAutoEmailDate ? nextAutoEmailStatus : null,
      auto_email_used_version_id: null,
      subtotal,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      paid_amount: current.paid_amount ?? 0,
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
        product_id: item.productId ?? null,
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

  for (const [productId, stockDelta] of productStockDeltas.entries()) {
    if (stockDelta === 0) {
      continue;
    }
    batch.update(doc(firestore, 'workspaces', workspaceId, 'products', productId), {
      stock_quantity: increment(stockDelta),
      last_modified: now,
      server_revision: increment(1),
    });
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

async function loadCustomerNamesByIds(
  firestore: Firestore,
  workspaceId: string,
  customerIds: string[]
): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(customerIds.filter(Boolean)));
  if (!uniqueIds.length) {
    return new Map();
  }

  const snapshots = await Promise.all(
    chunk(uniqueIds, FIRESTORE_IN_QUERY_LIMIT).map((ids) =>
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

async function loadInvoiceSummariesByIds(
  firestore: Firestore,
  workspaceId: string,
  invoiceIds: string[]
): Promise<Map<string, { invoiceNumber: string; totalAmount: number; paidAmount: number }>> {
  const uniqueIds = Array.from(new Set(invoiceIds.filter(Boolean)));
  if (!uniqueIds.length) {
    return new Map();
  }

  const snapshots = await Promise.all(
    chunk(uniqueIds, FIRESTORE_IN_QUERY_LIMIT).map((ids) =>
      getDocs(
        query(
          collection(firestore, 'workspaces', workspaceId, 'invoices'),
          where(documentId(), 'in', ids)
        )
      )
    )
  );

  const invoices = new Map<string, { invoiceNumber: string; totalAmount: number; paidAmount: number }>();
  for (const entry of snapshots.flatMap((snapshot) => snapshot.docs)) {
    const data = entry.data() as {
      invoice_number?: string;
      total_amount?: number;
      paid_amount?: number;
    };
    invoices.set(entry.id, {
      invoiceNumber: data.invoice_number ?? 'Invoice',
      totalAmount: data.total_amount ?? 0,
      paidAmount: data.paid_amount ?? 0,
    });
  }
  return invoices;
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
    paymentMode: PaymentMode | null;
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
    const paidDelta = doesPaymentClearInvoice(input.clearanceStatus, input.paymentMode) ? allocatedAmount : 0;
    const nextPaidAmount = roundMoney(invoice.paidAmount + paidDelta);
    const nextPaymentStatus = deriveInvoicePaymentStatus({
      dueDate: invoice.dueDate,
      totalAmount: invoice.totalAmount,
      paidAmount: nextPaidAmount,
      pendingAmount: doesPaymentAwaitClearance(input.clearanceStatus, input.paymentMode) ? allocatedAmount : 0,
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

type WorkspaceInvoiceNumberSource = {
  business_name?: string | null;
  country_code?: string | null;
  invoice_number_next_sequence?: number | null;
  invoice_number_sequence?: number | null;
  invoice_number_separator?: string | null;
  invoice_number_padding?: number | null;
  invoice_number_prefix?: string | null;
};

async function reserveWorkspaceInvoiceNumber(
  firestore: Firestore,
  workspaceId: string,
  issueDate: string,
  customPrefix?: string | null
): Promise<SmartInvoiceNumberResult> {
  const workspaceRef = doc(firestore, 'workspaces', workspaceId);
  return runTransaction(firestore, async (transaction) => {
    const workspaceSnapshot = await transaction.get(workspaceRef);
    const workspaceData = (workspaceSnapshot.exists()
      ? workspaceSnapshot.data()
      : {}) as WorkspaceInvoiceNumberSource;
    const nextSequence = normalizeInvoiceSequence(
      workspaceData.invoice_number_next_sequence ?? workspaceData.invoice_number_sequence
    );
    const invoiceNumber = buildSmartInvoiceNumber({
      businessName: workspaceData.business_name ?? 'Orbit Ledger',
      workspaceId,
      issueDate,
      sequenceNumber: nextSequence,
      countryCode: workspaceData.country_code ?? 'IN',
      settings: {
        customPrefix: normalizeInvoicePrefix(customPrefix) ?? normalizeInvoicePrefix(workspaceData.invoice_number_prefix),
        separator: workspaceData.invoice_number_separator === '-' ? '-' : '/',
        sequencePadding: workspaceData.invoice_number_padding,
      },
    });

    transaction.set(
      workspaceRef,
      {
        invoice_number_next_sequence: nextSequence + 1,
        invoice_number_last_value: invoiceNumber.invoiceNumber,
        invoice_number_last_sequence: nextSequence,
        invoice_number_last_issued_at: new Date().toISOString(),
        invoice_number_scheme: invoiceNumber.formatStyle,
      },
      { merge: true }
    );

    return invoiceNumber;
  });
}

function normalizeInvoiceSequence(value: unknown): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 1) {
    return 1;
  }
  return Math.floor(numberValue);
}

function invoiceNumberMetadata(invoiceNumber: SmartInvoiceNumberResult) {
  return {
    invoice_number_key: normalizeInvoiceNumberKey(invoiceNumber.invoiceNumber),
    invoice_number_scheme: invoiceNumber.formatStyle,
    invoice_number_company_code: invoiceNumber.companyCode,
    invoice_number_year_code: invoiceNumber.yearCode,
    invoice_number_fiscal_year: invoiceNumber.fiscalYear,
    invoice_number_sequence: invoiceNumber.sequenceNumber,
    invoice_number_country_code: invoiceNumber.countryCode,
    invoice_number_separator: invoiceNumber.separator,
  };
}

async function assertWorkspaceInvoiceNumberAvailable(
  firestore: Firestore,
  workspaceId: string,
  invoiceId: string,
  invoiceNumber: string
) {
  const key = normalizeInvoiceNumberKey(invoiceNumber);
  if (!key) {
    throw new Error('Enter an invoice number before saving.');
  }

  const invoicesRef = collection(firestore, 'workspaces', workspaceId, 'invoices');
  const [keyedSnapshot, exactSnapshot] = await Promise.all([
    getDocs(query(invoicesRef, where('invoice_number_key', '==', key), limitQuery(10))),
    getDocs(query(invoicesRef, where('invoice_number', '==', invoiceNumber.trim()), limitQuery(10))),
  ]);
  const candidates = [...keyedSnapshot.docs, ...exactSnapshot.docs];
  const seenIds = new Set(candidates.map((entry) => entry.id));

  if (!candidates.length) {
    const legacySnapshot = await getDocs(query(invoicesRef, limitQuery(500)));
    for (const entry of legacySnapshot.docs) {
      if (!seenIds.has(entry.id)) {
        candidates.push(entry);
        seenIds.add(entry.id);
      }
    }
  }

  const duplicate = candidates.find((entry) => {
    if (entry.id === invoiceId) {
      return false;
    }
    const data = entry.data() as {
      invoice_number?: string | null;
      invoice_number_key?: string | null;
      document_state?: string | null;
      status?: string | null;
    };
    if (normalizeInvoiceDocumentState(data.document_state ?? data.status) === 'cancelled') {
      return false;
    }
    return (data.invoice_number_key ?? normalizeInvoiceNumberKey(data.invoice_number)) === key;
  });

  if (duplicate) {
    throw new Error('This invoice number is already used. Choose a different number before saving.');
  }
}

export async function scanWorkspaceInvoiceNumberHealth(workspaceId: string): Promise<WorkspaceInvoiceNumberHealth> {
  const firestore = getWebFirestore();
  const invoicesSnapshot = await getDocs(collection(firestore, 'workspaces', workspaceId, 'invoices'));
  const invoiceMetaById = new Map<string, WorkspaceInvoiceNumberConflictInvoice>();
  const plan = buildInvoiceNumberMigrationPlan(
    invoicesSnapshot.docs.map((entry) => {
      const data = entry.data() as {
        invoice_number?: string | null;
        invoice_number_key?: string | null;
        issue_date?: string | null;
        document_state?: string | null;
        status?: string | null;
        version_number?: number | null;
        total_amount?: number | null;
        is_archived?: boolean | null;
      };
      invoiceMetaById.set(entry.id, {
        id: entry.id,
        invoiceNumber: data.invoice_number ?? entry.id.slice(0, 8).toUpperCase(),
        issueDate: data.issue_date ?? null,
        documentState: data.document_state ?? data.status ?? null,
        versionNumber: typeof data.version_number === 'number' ? data.version_number : null,
        totalAmount: typeof data.total_amount === 'number' ? data.total_amount : 0,
      });
      return {
        id: entry.id,
        invoiceNumber: data.invoice_number,
        invoiceNumberKey: data.invoice_number_key,
        documentState: data.document_state,
        status: data.status,
        isArchived: data.is_archived,
      };
    })
  );

  return {
    totalInvoices: plan.totalInvoices,
    missingKeyCount: plan.missingKeyInvoiceIds.length,
    duplicateGroups: plan.duplicateGroups.map((group) => {
      const invoices = group.invoiceIds
        .map((invoiceId) => invoiceMetaById.get(invoiceId))
        .filter((invoice): invoice is WorkspaceInvoiceNumberConflictInvoice => Boolean(invoice));
      return {
        ...group,
        invoices,
        recommendedKeepInvoiceId: invoices[0]?.id ?? null,
      };
    }),
    scannedAt: new Date().toISOString(),
  };
}

export async function listWorkspaceInvoiceNumberAuditTrail(
  workspaceId: string
): Promise<WorkspaceInvoiceNumberAuditItem[]> {
  const firestore = getWebFirestore();
  const auditSnapshot = await getDocs(
    query(
      collection(firestore, 'workspaces', workspaceId, 'settings_audit'),
      orderBy('created_at', 'desc'),
      limitQuery(50)
    )
  );

  return auditSnapshot.docs
    .map((entry) => {
      const data = entry.data() as {
        actor_email?: string | null;
        reason?: string | null;
        changed_fields?: unknown;
        changes?: unknown;
        server_revision_before?: number | null;
        server_revision_after?: number | null;
        created_at?: unknown;
      };
      const changes = Array.isArray(data.changes)
        ? data.changes
            .map((change) => {
              const item = change as {
                field?: unknown;
                label?: unknown;
                previous_value?: unknown;
                next_value?: unknown;
              };
              return {
                field: typeof item.field === 'string' ? item.field : '',
                label: typeof item.label === 'string' ? item.label : '',
                previousValue: typeof item.previous_value === 'string' ? item.previous_value : null,
                nextValue: typeof item.next_value === 'string' ? item.next_value : null,
              };
            })
            .filter((change) => change.field || change.label)
        : [];
      return {
        id: entry.id,
        actorEmail: typeof data.actor_email === 'string' ? data.actor_email : null,
        reason: typeof data.reason === 'string' ? data.reason : null,
        changedFields: Array.isArray(data.changed_fields)
          ? data.changed_fields.filter((field): field is string => typeof field === 'string')
          : [],
        changes,
        serverRevisionBefore:
          typeof data.server_revision_before === 'number' ? data.server_revision_before : null,
        serverRevisionAfter:
          typeof data.server_revision_after === 'number' ? data.server_revision_after : null,
        createdAt: toWorkspaceDataIsoString(data.created_at),
      };
    })
    .filter((item) =>
      item.changes.some((change) => change.field.startsWith('invoiceNumber')) ||
      item.changedFields.some((field) => field.toLowerCase().includes('invoice number'))
    )
    .slice(0, 12);
}

export async function backfillWorkspaceInvoiceNumberKeys(workspaceId: string): Promise<WorkspaceInvoiceNumberHealth> {
  const firestore = getWebFirestore();
  const invoicesSnapshot = await getDocs(collection(firestore, 'workspaces', workspaceId, 'invoices'));
  const now = new Date().toISOString();
  const entriesToUpdate = invoicesSnapshot.docs.filter((entry) => {
    const data = entry.data() as {
      invoice_number?: string | null;
      invoice_number_key?: string | null;
    };
    const key = normalizeInvoiceNumberKey(data.invoice_number);
    return key && data.invoice_number_key !== key;
  });

  for (let index = 0; index < entriesToUpdate.length; index += 450) {
    const batch = writeBatch(firestore);
    for (const entry of entriesToUpdate.slice(index, index + 450)) {
      const data = entry.data() as { invoice_number?: string | null };
      batch.update(entry.ref, {
        invoice_number_key: normalizeInvoiceNumberKey(data.invoice_number),
        invoice_number_key_backfilled_at: now,
        server_revision: increment(1),
        last_modified: now,
      });
    }
    await batch.commit();
  }

  return scanWorkspaceInvoiceNumberHealth(workspaceId);
}

function toWorkspaceDataIsoString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    return (value as { toDate(): Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

export async function createDraftWorkspaceInvoice(
  workspaceId: string,
  defaults: { dueDays?: number | null; notes?: string | null; customerId?: string | null } = {}
): Promise<WorkspaceInvoice> {
  const now = new Date().toISOString();
  const issueDate = now.slice(0, 10);
  const customerId = defaults.customerId?.trim() || null;
  const dueDate =
    typeof defaults.dueDays === 'number' && Number.isFinite(defaults.dueDays)
      ? addDays(issueDate, Math.max(0, Math.floor(defaults.dueDays)))
      : null;
  const firestore = getWebFirestore();
  const invoiceNumber = await reserveWorkspaceInvoiceNumber(firestore, workspaceId, issueDate);
  const payload = {
    customer_id: customerId,
    invoice_number: invoiceNumber.invoiceNumber,
    ...invoiceNumberMetadata(invoiceNumber),
    issue_date: issueDate,
    billing_month: issueDate.slice(0, 7),
    due_date: dueDate,
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
    use_for_monthly_auto_email: false,
    recurring_rule_id: null,
    auto_email_prepared_at: null,
    auto_email_scheduled_for: null,
    has_auto_email_history: false,
    latest_auto_email_status: null,
    latest_auto_email_sent_at: null,
    latest_auto_email_version_id: null,
    is_archived: false,
    notes: defaults.notes?.trim() || null,
    created_at: now,
    last_modified: now,
    sync_status: 'synced',
    server_revision: 1,
  };

  const ref = await addDoc(collection(firestore, 'workspaces', workspaceId, 'invoices'), payload);
  return {
    id: ref.id,
    customerId,
    customerName: null,
    invoiceNumber: payload.invoice_number,
    issueDate: payload.issue_date,
    billingMonth: payload.billing_month,
    totalAmount: 0,
    paidAmount: 0,
    status: 'draft',
    documentState: 'draft',
    paymentStatus: 'unpaid',
    useForMonthlyAutoEmail: false,
    recurringRuleId: null,
    autoEmailPreparedAt: null,
    autoEmailScheduledFor: null,
    hasAutoEmailHistory: false,
    latestAutoEmailStatus: null,
    latestAutoEmailSentAt: null,
    latestAutoEmailVersionId: null,
    versionNumber: 0,
    isArchived: false,
    versions: [],
    serverRevision: payload.server_revision,
  };
}

function addDays(date: string, days: number) {
  const timestamp = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)) {
    return null;
  }
  const next = new Date(timestamp);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export async function deleteDraftWorkspaceInvoice(workspaceId: string, invoiceId: string): Promise<void> {
  const firestore = getWebFirestore();
  const invoiceRef = doc(firestore, 'workspaces', workspaceId, 'invoices', invoiceId);
  const [invoiceSnapshot, itemSnapshot, versionSnapshot, allocationSnapshot] = await Promise.all([
    getDoc(invoiceRef),
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
    getDocs(
      query(
        collection(firestore, 'workspaces', workspaceId, 'payment_allocations'),
        where('invoice_id', '==', invoiceId)
      )
    ),
  ]);

  if (!invoiceSnapshot.exists()) {
    throw new Error('Invoice could not be found.');
  }

  const data = invoiceSnapshot.data() as {
    status?: string;
    document_state?: string;
    version_number?: number;
  };
  const documentState = normalizeInvoiceDocumentState(data.document_state ?? data.status);
  if (documentState !== 'draft' || Number(data.version_number ?? 0) > 0 || versionSnapshot.size > 0) {
    throw new Error('Only unsaved draft invoices can be deleted.');
  }
  if (allocationSnapshot.size > 0) {
    throw new Error('This invoice has payment activity. Cancel or archive it instead.');
  }

  const batch = writeBatch(firestore);
  itemSnapshot.docs.forEach((entry) => batch.delete(entry.ref));
  batch.delete(invoiceRef);
  await batch.commit();
}

export async function archiveWorkspaceInvoice(
  workspaceId: string,
  invoiceId: string,
  isArchived: boolean
): Promise<WorkspaceInvoiceDetail> {
  const firestore = getWebFirestore();
  const invoiceRef = doc(firestore, 'workspaces', workspaceId, 'invoices', invoiceId);
  const invoiceSnapshot = await getDoc(invoiceRef);
  if (!invoiceSnapshot.exists()) {
    throw new Error('Invoice could not be found.');
  }

  const data = invoiceSnapshot.data() as {
    status?: string;
    document_state?: string;
  };
  const documentState = normalizeInvoiceDocumentState(data.document_state ?? data.status);
  if (documentState === 'draft') {
    throw new Error('Delete an unsaved draft instead of archiving it.');
  }

  const now = new Date().toISOString();
  await updateDoc(invoiceRef, {
    is_archived: isArchived,
    last_modified: now,
    server_revision: increment(1),
  });

  const updated = await getWorkspaceInvoiceDetail(workspaceId, invoiceId);
  if (!updated) {
    throw new Error('Invoice could not be loaded after updating archive state.');
  }
  return updated;
}

function mapWorkspaceInvoice(entry: QueryDocumentSnapshot): WorkspaceInvoice {
  const data = entry.data() as {
    customer_id?: string | null;
    customer_name?: string | null;
    invoice_number?: string;
    issue_date?: string;
    billing_month?: string | null;
    total_amount?: number;
    paid_amount?: number;
    status?: string;
    document_state?: string;
    payment_status?: string;
    due_date?: string | null;
    version_number?: number;
    is_archived?: boolean;
    use_for_monthly_auto_email?: boolean;
    recurring_rule_id?: string | null;
    auto_email_prepared_at?: string | null;
    auto_email_scheduled_for?: string | null;
    has_auto_email_history?: boolean;
    latest_auto_email_status?: string | null;
    latest_auto_email_sent_at?: string | null;
    latest_auto_email_version_id?: string | null;
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
    dueDate: data.due_date ?? null,
    billingMonth: data.billing_month ?? data.issue_date?.slice(0, 7) ?? null,
    totalAmount: data.total_amount ?? 0,
    paidAmount: data.paid_amount ?? 0,
    status: data.status ?? legacyStatusForInvoiceLifecycle(documentState, paymentStatus),
    documentState,
    paymentStatus,
    useForMonthlyAutoEmail: Boolean(data.use_for_monthly_auto_email),
    recurringRuleId: data.recurring_rule_id ?? null,
    autoEmailPreparedAt: data.auto_email_prepared_at ?? null,
    autoEmailScheduledFor: data.auto_email_scheduled_for ?? null,
    hasAutoEmailHistory: Boolean(data.has_auto_email_history),
    latestAutoEmailStatus: data.latest_auto_email_status ?? null,
    latestAutoEmailSentAt: data.latest_auto_email_sent_at ?? null,
    latestAutoEmailVersionId: data.latest_auto_email_version_id ?? null,
    versionNumber: data.version_number ?? (documentState === 'draft' ? 0 : 1),
    isArchived: Boolean(data.is_archived),
    serverRevision: data.server_revision ?? 1,
  };
}

function mapWorkspaceRecurringInvoiceRule(entry: QueryDocumentSnapshot): WorkspaceRecurringInvoiceRule {
  const data = entry.data() as {
    name?: string;
    customer_id?: string;
    customer_name?: string | null;
    start_date?: string;
    end_date?: string | null;
    invoice_day?: number;
    next_run_date?: string;
    due_days?: number;
    invoice_number_prefix?: string;
    notes?: string | null;
    email_enabled?: boolean;
    email_recipient?: string | null;
    email_day?: number | null;
    email_subject?: string | null;
    email_body?: string | null;
    email_include_payment_link?: boolean;
    email_attach_pdf?: boolean;
    email_current_month_only?: boolean;
    email_automation_approved?: boolean;
    email_automation_approved_at?: string | null;
    email_approval_summary?: string | null;
    email_approval_required?: boolean;
    last_settings_changed_at?: string | null;
    next_email_date?: string | null;
    status?: string;
    items?: WorkspaceRecurringInvoiceItem[];
    last_created_invoice_id?: string | null;
    last_created_run_date?: string | null;
    created_at?: string;
    last_modified?: string;
  };

  return {
    id: entry.id,
    name: data.name ?? 'Monthly service invoice',
    customerId: data.customer_id ?? '',
    customerName: data.customer_name ?? null,
    startDate: data.start_date ?? '',
    endDate: data.end_date ?? null,
    invoiceDay: clampMonthlyDay(data.invoice_day ?? 1),
    nextRunDate: data.next_run_date ?? data.start_date ?? '',
    dueDays: Math.max(0, Math.floor(data.due_days ?? 7)),
    invoiceNumberPrefix: data.invoice_number_prefix ?? 'AUTO',
    notes: data.notes ?? null,
    emailEnabled: Boolean(data.email_enabled),
    emailRecipient: data.email_recipient ?? null,
    emailDay: data.email_day ? clampMonthlyDay(data.email_day) : null,
    emailSubject: data.email_subject ?? null,
    emailBody: data.email_body ?? null,
    emailIncludePaymentLink: data.email_include_payment_link !== false,
    emailAttachPdf: data.email_attach_pdf !== false,
    emailCurrentMonthOnly: data.email_current_month_only !== false,
    emailAutomationApproved: Boolean(data.email_automation_approved),
    emailAutomationApprovedAt: data.email_automation_approved_at ?? null,
    emailApprovalSummary: data.email_approval_summary ?? null,
    emailApprovalRequired: data.email_approval_required !== false,
    lastSettingsChangedAt: data.last_settings_changed_at ?? null,
    nextEmailDate: data.next_email_date ?? null,
    status: data.status === 'cancelled' ? 'cancelled' : 'active',
    items: Array.isArray(data.items) ? data.items.map(normalizeRecurringRuleItem).filter((item) => item.name) : [],
    lastCreatedInvoiceId: data.last_created_invoice_id ?? null,
    lastCreatedRunDate: data.last_created_run_date ?? null,
    createdAt: data.created_at ?? '',
    lastModified: data.last_modified ?? '',
  };
}

function mapWorkspaceRecurringEmailQueueItem(entry: QueryDocumentSnapshot): WorkspaceRecurringEmailQueueItem {
  const data = entry.data() as {
    kind?: string;
    status?: string;
    scheduled_for?: string | null;
    sent_at?: string | null;
    recipient_email?: string | null;
    subject?: string | null;
    body?: string | null;
    invoice_id?: string | null;
    invoice_number?: string | null;
    customer_id?: string | null;
    recurring_rule_id?: string | null;
    include_payment_link?: boolean;
    attachment?: string | null;
    last_error?: string | null;
    created_at?: string | null;
    last_modified?: string | null;
  };

  return {
    id: entry.id,
    status: data.status ?? 'scheduled',
    scheduledFor: data.scheduled_for ?? null,
    sentAt: data.sent_at ?? null,
    recipientEmail: data.recipient_email ?? null,
    subject: data.subject ?? null,
    body: data.body ?? null,
    invoiceId: data.invoice_id ?? null,
    invoiceNumber: data.invoice_number ?? null,
    customerId: data.customer_id ?? null,
    recurringRuleId: data.recurring_rule_id ?? null,
    includePaymentLink: Boolean(data.include_payment_link),
    attachPdf: data.attachment === 'invoice_pdf',
    lastError: data.last_error ?? null,
    createdAt: data.created_at ?? null,
    lastModified: data.last_modified ?? null,
  };
}

function buildRecurringInvoiceRulePayload(
  input: SaveWorkspaceRecurringInvoiceRuleInput,
  now: string,
  customerName: unknown
) {
  const name = input.name.trim();
  const customerId = input.customerId.trim();
  const startDate = input.startDate.trim();
  const invoiceDay = clampMonthlyDay(input.invoiceDay);
  const endDate = input.endDate?.trim() || null;
  const dueDays = Math.max(0, Math.floor(Number(input.dueDays ?? 7)));
  const invoiceNumberPrefix = (input.invoiceNumberPrefix?.trim() || 'AUTO').replace(/[^A-Za-z0-9-]/g, '').slice(0, 12) || 'AUTO';
  const items = input.items.map(normalizeRecurringRuleItem).filter((item) => item.name && item.quantity > 0 && item.price >= 0);
  const emailEnabled = Boolean(input.emailEnabled);
  const emailRecipient = input.emailRecipient?.trim() || null;
  const emailDay = input.emailDay ? clampMonthlyDay(input.emailDay) : invoiceDay;
  const emailSubject = input.emailSubject?.trim() || null;
  const emailBody = input.emailBody?.trim() || null;
  const emailIncludePaymentLink = input.emailIncludePaymentLink !== false;
  const emailAttachPdf = input.emailAttachPdf !== false;
  const emailCurrentMonthOnly = input.emailCurrentMonthOnly !== false;
  const emailAutomationApproved = Boolean(input.approveEmailAutomation && emailEnabled);
  const emailApprovalSummary = emailAutomationApproved
    ? 'Approved automatic monthly invoice email.'
    : null;

  if (!name) {
    throw new Error('Add a name for this auto-create rule.');
  }
  if (!customerId) {
    throw new Error('Choose the customer for this auto-create rule.');
  }
  if (!isValidDateString(startDate)) {
    throw new Error('Choose a valid start date.');
  }
  if (endDate && (!isValidDateString(endDate) || endDate < startDate)) {
    throw new Error('End date must be after the start date.');
  }
  if (!items.length) {
    throw new Error('Add at least one line item for the monthly invoice.');
  }
  if (emailEnabled && !isValidEmail(emailRecipient)) {
    throw new Error('Add a valid recipient email for monthly invoice email.');
  }

  const firstInvoiceDate = getFirstRecurringRunDate(startDate, invoiceDay);
  const firstEmailDate = emailEnabled ? getFirstRecurringRunDate(startDate, emailDay) : null;
  const firstPreparationDate = firstEmailDate ? subtractDays(firstEmailDate, 3) : firstInvoiceDate;

  return {
    name,
    customer_id: customerId,
    customer_name: typeof customerName === 'string' ? customerName : null,
    start_date: startDate,
    end_date: endDate,
    invoice_day: invoiceDay,
    next_run_date: firstPreparationDate < startDate ? startDate : firstPreparationDate,
    due_days: dueDays,
    invoice_number_prefix: invoiceNumberPrefix,
    notes: input.notes?.trim() || null,
    email_enabled: emailEnabled,
    email_recipient: emailEnabled ? emailRecipient : null,
    email_day: emailEnabled ? emailDay : null,
    next_email_date: firstEmailDate,
    email_subject: emailEnabled ? emailSubject || defaultRecurringEmailSubject() : null,
    email_body: emailEnabled ? emailBody || defaultRecurringEmailBody() : null,
    email_include_payment_link: emailIncludePaymentLink,
    email_attach_pdf: emailAttachPdf,
    email_current_month_only: emailCurrentMonthOnly,
    email_automation_approved: emailAutomationApproved,
    email_automation_approved_at: emailAutomationApproved ? now : null,
    email_approval_summary: emailApprovalSummary,
    email_approval_required: emailEnabled && !emailAutomationApproved,
    last_settings_changed_at: now,
    items,
    last_modified: now,
    sync_status: 'synced',
  };
}

function normalizeRecurringRuleItem(
  item: Partial<WorkspaceRecurringInvoiceItem> & {
    productId?: string | null;
    description?: string | null;
    quantity?: number;
    price?: number;
    taxRate?: number;
  }
): WorkspaceRecurringInvoiceItem {
  const quantity = Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 0;
  const price = Number.isFinite(Number(item.price)) ? Number(item.price) : 0;
  const taxRate = Number.isFinite(Number(item.taxRate)) ? Number(item.taxRate) : 0;
  const taxable = quantity * price;
  return {
    id: item.id?.trim() || normalizeId(`line_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    productId: item.productId?.trim() || null,
    name: item.name?.trim() || '',
    description: item.description?.trim() || null,
    quantity,
    price,
    taxRate,
    total: roundMoney(taxable + taxable * (taxRate / 100)),
  };
}

async function createInvoiceFromRecurringRule(
  firestore: Firestore,
  workspaceId: string,
  rule: WorkspaceRecurringInvoiceRule,
  runDate: string,
  workspaceName: string,
  today: string,
  scheduledEmailDate: string | null = null,
  preparationDate: string = today
): Promise<WorkspaceInvoice | null> {
  const billingMonth = runDate.slice(0, 7);
  const existingForMonth = await getDocs(
    query(
      collection(firestore, 'workspaces', workspaceId, 'invoices'),
      where('customer_id', '==', rule.customerId),
      where('billing_month', '==', billingMonth),
      limitQuery(25)
    )
  );
  const activeExisting = existingForMonth.docs.filter((entry) => {
    const data = entry.data() as { document_state?: string; status?: string };
    return normalizeInvoiceDocumentState(data.document_state ?? data.status) !== 'cancelled';
  });
  if (activeExisting.some((entry) => Boolean((entry.data() as { use_for_monthly_auto_email?: boolean }).use_for_monthly_auto_email))) {
    return null;
  }
  const daysUntilEmail = scheduledEmailDate ? daysBetween(today, scheduledEmailDate) : 0;
  if (activeExisting.length && daysUntilEmail > 1) {
    return null;
  }

  const invoiceId = normalizeId(`recurring_${rule.id}_${runDate}`);
  const invoiceRef = doc(firestore, 'workspaces', workspaceId, 'invoices', invoiceId);
  const existing = await getDoc(invoiceRef);
  if (existing.exists()) {
    return null;
  }

  const now = new Date().toISOString();
  const subtotal = roundMoney(rule.items.reduce((total, item) => total + item.quantity * item.price, 0));
  const taxAmount = roundMoney(rule.items.reduce((total, item) => total + item.quantity * item.price * (item.taxRate / 100), 0));
  const totalAmount = roundMoney(subtotal + taxAmount);
  const invoiceNumber = await reserveWorkspaceInvoiceNumber(
    firestore,
    workspaceId,
    runDate,
    rule.invoiceNumberPrefix
  );
  const batch = writeBatch(firestore);
  batch.set(invoiceRef, {
    customer_id: rule.customerId,
    customer_name: rule.customerName,
    invoice_number: invoiceNumber.invoiceNumber,
    ...invoiceNumberMetadata(invoiceNumber),
    issue_date: runDate,
    billing_month: billingMonth,
    due_date: addDays(runDate, rule.dueDays),
    subtotal,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    paid_amount: 0,
    status: 'draft',
    document_state: 'draft',
    payment_status: 'unpaid',
    payment_status_reason: null,
    version_number: 0,
    latest_version_id: null,
    latest_snapshot_hash: null,
    is_archived: false,
    notes: rule.notes,
    use_for_monthly_auto_email: true,
    recurring_rule_id: rule.id,
    recurring_rule_name: rule.name,
    recurring_run_date: runDate,
    auto_email_prepared_at: now,
    auto_email_preparation_date: preparationDate,
    auto_email_scheduled_for: rule.emailEnabled ? scheduledEmailDate ?? getMonthlyDateForDay(billingMonth, rule.emailDay ?? rule.invoiceDay) : null,
    has_auto_email_history: false,
    latest_auto_email_status: rule.emailEnabled ? 'scheduled' : null,
    latest_auto_email_sent_at: null,
    latest_auto_email_version_id: null,
    created_at: now,
    last_modified: now,
    sync_status: 'synced',
    server_revision: 1,
  });

  for (const [index, item] of rule.items.entries()) {
    const itemRef = doc(firestore, 'workspaces', workspaceId, 'invoice_items', `${invoiceId}_${index + 1}`);
    batch.set(itemRef, {
      invoice_id: invoiceId,
      product_id: item.productId,
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      price: item.price,
      tax_rate: item.taxRate,
      total: item.total,
      last_modified: now,
      sync_status: 'synced',
      server_revision: 1,
    });
  }

  const isCurrentMonthRun = runDate.slice(0, 7) === today.slice(0, 7);
  if (
    rule.emailEnabled &&
    rule.emailAutomationApproved &&
    !rule.emailApprovalRequired &&
    rule.emailRecipient &&
    (!rule.emailCurrentMonthOnly || isCurrentMonthRun)
  ) {
    const emailDate = scheduledEmailDate ?? getMonthlyDateForDay(billingMonth, rule.emailDay ?? rule.invoiceDay);
    const queueRef = doc(firestore, 'workspaces', workspaceId, 'email_queue', `${invoiceId}_recurring_invoice`);
    batch.set(queueRef, {
      kind: 'recurring_invoice',
      provider: 'resend',
      status: emailDate <= today ? 'ready' : 'scheduled',
      scheduled_for: emailDate,
      recipient_email: rule.emailRecipient,
      subject: renderRecurringEmailText(rule.emailSubject ?? defaultRecurringEmailSubject(), rule, invoiceNumber.invoiceNumber, runDate, workspaceName),
      body: renderRecurringEmailText(rule.emailBody ?? defaultRecurringEmailBody(), rule, invoiceNumber.invoiceNumber, runDate, workspaceName),
      invoice_id: invoiceId,
      invoice_number: invoiceNumber.invoiceNumber,
      customer_id: rule.customerId,
      recurring_rule_id: rule.id,
      include_payment_link: rule.emailIncludePaymentLink,
      attachment: rule.emailAttachPdf ? 'invoice_pdf' : null,
      created_at: now,
      last_modified: now,
      sync_status: 'queued',
      server_revision: 1,
    });
  }

  await batch.commit();
  return {
    id: invoiceId,
    customerId: rule.customerId,
    customerName: rule.customerName,
    invoiceNumber: invoiceNumber.invoiceNumber,
    issueDate: runDate,
    billingMonth: runDate.slice(0, 7),
    totalAmount,
    paidAmount: 0,
    status: 'draft',
    documentState: 'draft',
    paymentStatus: 'unpaid',
    paymentStatusReason: null,
    useForMonthlyAutoEmail: true,
    recurringRuleId: rule.id,
    autoEmailPreparedAt: now,
    autoEmailScheduledFor: rule.emailEnabled ? scheduledEmailDate ?? getMonthlyDateForDay(billingMonth, rule.emailDay ?? rule.invoiceDay) : null,
    hasAutoEmailHistory: false,
    latestAutoEmailStatus: rule.emailEnabled ? 'scheduled' : null,
    latestAutoEmailSentAt: null,
    latestAutoEmailVersionId: null,
    versionNumber: 0,
    isArchived: false,
    versions: [],
    serverRevision: 1,
  };
}

function getDueRecurringRunDates(rule: WorkspaceRecurringInvoiceRule, today: string): string[] {
  const dates: string[] = [];
  let cursor = rule.nextRunDate || getFirstRecurringRunDate(rule.startDate, rule.invoiceDay);
  let guard = 0;
  while (cursor <= today && (!rule.endDate || cursor <= rule.endDate) && guard < 24) {
    dates.push(cursor);
    cursor = getNextRecurringRunDateAfter(cursor, rule.invoiceDay);
    guard += 1;
  }
  return dates;
}

function getFirstRecurringRunDate(startDate: string, day: number): string {
  const month = startDate.slice(0, 7);
  const candidate = getMonthlyDateForDay(month, day);
  return candidate >= startDate ? candidate : getMonthlyDateForDay(nextMonth(month), day);
}

function getNextRecurringRunDateAfter(date: string, day: number): string {
  return getMonthlyDateForDay(nextMonth(date.slice(0, 7)), day);
}

function subtractDays(date: string, days: number): string {
  const timestamp = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)) {
    return date;
  }
  const next = new Date(timestamp);
  next.setUTCDate(next.getUTCDate() - days);
  return next.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const fromTime = Date.parse(`${from}T00:00:00.000Z`);
  const toTime = Date.parse(`${to}T00:00:00.000Z`);
  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime)) {
    return 0;
  }
  return Math.ceil((toTime - fromTime) / 86_400_000);
}

function getMonthlyDateForDay(month: string, day: number): string {
  const [yearPart, monthPart] = month.split('-').map(Number);
  const clampedDay = Math.min(clampMonthlyDay(day), daysInMonth(yearPart, monthPart));
  return `${month}-${String(clampedDay).padStart(2, '0')}`;
}

function nextMonth(month: string): string {
  const [yearPart, monthPart] = month.split('-').map(Number);
  const next = new Date(Date.UTC(yearPart, monthPart, 1));
  return next.toISOString().slice(0, 7);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function clampMonthlyDay(value: number): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return Math.min(Math.max(parsed, 1), 31);
}

function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

function isValidEmail(value?: string | null): boolean {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

function defaultRecurringEmailSubject(): string {
  return 'Invoice {{invoiceNumber}} from {{businessName}}';
}

function defaultRecurringEmailBody(): string {
  return 'Hello {{customerName}},\n\nYour monthly invoice {{invoiceNumber}} is attached.\n\nYou can pay here:\n{{paymentLink}}\n\nThank you,\n{{businessName}}';
}

function renderRecurringEmailText(
  template: string,
  rule: WorkspaceRecurringInvoiceRule,
  invoiceNumber: string,
  runDate: string,
  workspaceName: string
): string {
  return template
    .replaceAll('{{customerName}}', rule.customerName ?? 'Customer')
    .replaceAll('{{invoiceNumber}}', invoiceNumber)
    .replaceAll('{{invoiceDate}}', runDate)
    .replaceAll('{{dueDate}}', addDays(runDate, rule.dueDays) ?? runDate)
    .replaceAll('{{amountDue}}', '')
    .replaceAll('{{paymentLink}}', rule.emailIncludePaymentLink ? 'Payment link will be added before sending.' : '')
    .replaceAll('{{businessPhone}}', '')
    .replaceAll('{{businessEmail}}', '')
    .replaceAll('{{businessName}}', workspaceName);
}

function normalizeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 120);
}

function mapWorkspacePaymentProviderEvent(entry: {
  id: string;
  data(): Record<string, unknown>;
}): WorkspacePaymentProviderEvent {
  const data = entry.data();
  return {
    id: entry.id,
    source: stringValue(data.source, 'other'),
    status: stringValue(data.status, 'pending'),
    applyStatus: stringValue(data.apply_status, 'needs_review'),
    applied: Boolean(data.applied),
    amount: numberValue(data.amount),
    currency: stringValue(data.currency, 'INR').toUpperCase(),
    reference: nullableString(data.reference),
    providerPaymentId: nullableString(data.provider_payment_id),
    payerName: nullableString(data.payer_name),
    payerContact: nullableString(data.payer_contact),
    invoiceId: nullableString(data.invoice_id),
    customerId: nullableString(data.customer_id),
    transactionId: nullableString(data.transaction_id),
    allocationId: nullableString(data.allocation_id),
    allocationAmount: numberValue(data.allocation_amount),
    reversed: Boolean(data.reversed),
    reversedAt: nullableString(data.reversed_at),
    reversalId: nullableString(data.reversal_id),
    reversalTransactionId: nullableString(data.reversal_transaction_id),
    refundedAmount: numberValue(data.refunded_amount),
    error: nullableString(data.error),
    reviewedAt: nullableString(data.reviewed_at),
    reviewNote: nullableString(data.review_note),
    createdAt: stringValue(data.created_at, ''),
    lastModified: stringValue(data.last_modified, ''),
  };
}

function paymentModeForProviderEvent(source: string): PaymentMode {
  switch (source) {
    case 'upi':
      return 'upi';
    case 'bank_transfer':
      return 'bank_transfer';
    case 'card':
      return 'card';
    case 'wallet':
    case 'payment_page':
      return 'wallet';
    default:
      return 'other';
  }
}

function providerEventLabel(source: string): string {
  switch (source) {
    case 'upi':
      return 'UPI';
    case 'payment_page':
      return 'Payment page';
    case 'bank_transfer':
      return 'Bank transfer';
    case 'card':
      return 'Card';
    case 'wallet':
      return 'Wallet';
    default:
      return 'Provider';
  }
}

function buildProviderEventPaymentNote(event: WorkspacePaymentProviderEvent, invoiceNumber: string): string {
  const reference = event.reference ?? event.providerPaymentId;
  return reference
    ? `Reviewed provider payment ${reference} for invoice ${invoiceNumber}`
    : `Reviewed provider payment for invoice ${invoiceNumber}`;
}

function buildProviderEventRefundNote(event: WorkspacePaymentProviderEvent): string {
  const reference = event.reference ?? event.providerPaymentId;
  return reference ? `Payment refund or reversal for ${reference}` : 'Payment refund or reversal';
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
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
    payment_status_reason?: string | null;
    auto_email_sent_at?: string | null;
    auto_email_scheduled_for?: string | null;
    auto_email_recipient?: string | null;
    auto_email_queue_id?: string | null;
    auto_email_status?: string | null;
    auto_email_used_version_id?: string | null;
    subtotal?: number;
    tax_amount?: number;
    total_amount?: number;
    paid_amount?: number;
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
    paymentStatusReason: data.payment_status_reason ?? null,
    autoEmailSentAt: data.auto_email_sent_at ?? null,
    autoEmailScheduledFor: data.auto_email_scheduled_for ?? null,
    autoEmailRecipient: data.auto_email_recipient ?? null,
    autoEmailQueueId: data.auto_email_queue_id ?? null,
    autoEmailStatus: data.auto_email_status ?? null,
    autoEmailUsedVersionId: data.auto_email_used_version_id ?? null,
    subtotal: data.subtotal ?? 0,
    taxAmount: data.tax_amount ?? 0,
    totalAmount: data.total_amount ?? 0,
    paidAmount:
      typeof data.paid_amount === 'number'
        ? data.paid_amount
        : normalizeInvoicePaymentStatus({
            paymentStatus: data.payment_status,
            dueDate: data.due_date,
            totalAmount: data.total_amount,
          }) === 'paid'
          ? data.total_amount ?? 0
          : 0,
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
    legal_name?: string | null;
    customer_type?: string | null;
    contact_person?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    email?: string | null;
    address?: string | null;
    billing_address?: string | null;
    shipping_address?: string | null;
    city?: string | null;
    town?: string | null;
    state_code?: string | null;
    country_code?: string | null;
    postal_code?: string | null;
    gstin?: string | null;
    pan?: string | null;
    tax_number?: string | null;
    registration_number?: string | null;
    place_of_supply?: string | null;
    default_tax_treatment?: string | null;
    notes?: string | null;
    opening_balance?: number;
    credit_limit?: number | null;
    payment_terms?: string | null;
    preferred_payment_mode?: string | null;
    preferred_invoice_template?: string | null;
    preferred_language?: string | null;
    tags?: string[];
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
    legalName: data.legal_name ?? null,
    customerType:
      data.customer_type === 'individual' || data.customer_type === 'business' ? data.customer_type : null,
    contactPerson: data.contact_person ?? null,
    phone: data.phone ?? null,
    whatsapp: data.whatsapp ?? null,
    email: data.email ?? null,
    address: data.address ?? null,
    billingAddress: data.billing_address ?? data.address ?? null,
    shippingAddress: data.shipping_address ?? null,
    city: data.city ?? null,
    town: data.town ?? null,
    stateCode: data.state_code ?? null,
    countryCode: data.country_code ?? null,
    postalCode: data.postal_code ?? null,
    gstin: data.gstin ?? null,
    pan: data.pan ?? null,
    taxNumber: data.tax_number ?? null,
    registrationNumber: data.registration_number ?? null,
    placeOfSupply: data.place_of_supply ?? null,
    defaultTaxTreatment: data.default_tax_treatment ?? null,
    notes: data.notes ?? null,
    openingBalance,
    creditLimit: typeof data.credit_limit === 'number' ? data.credit_limit : null,
    paymentTerms: data.payment_terms ?? null,
    preferredPaymentMode: data.preferred_payment_mode ?? null,
    preferredInvoiceTemplate: data.preferred_invoice_template ?? null,
    preferredLanguage: data.preferred_language ?? null,
    tags: Array.isArray(data.tags) ? data.tags.filter((tag): tag is string => typeof tag === 'string') : [],
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

function mapWorkspaceProduct(entry: QueryDocumentSnapshot): WorkspaceProduct {
  const data = entry.data() as {
    name?: string;
    price?: number;
    stock_quantity?: number;
    unit?: string;
    created_at?: string;
    last_modified?: string;
    server_revision?: number;
  };
  return {
    id: entry.id,
    name: data.name ?? 'Unnamed product',
    price: data.price ?? 0,
    stockQuantity: data.stock_quantity ?? 0,
    unit: data.unit ?? 'pcs',
    createdAt: data.created_at ?? '',
    lastModified: data.last_modified ?? data.created_at ?? '',
    serverRevision: data.server_revision ?? 1,
  };
}

function mapWorkspaceTransaction(entry: QueryDocumentSnapshot, customerName: string): WorkspaceTransaction {
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
    customerName,
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
  };
}

function mapWorkspaceCustomerTimelineNote(entry: QueryDocumentSnapshot): WorkspaceCustomerTimelineNote {
  const data = entry.data() as {
    customer_id?: string;
    kind?: string;
    body?: string;
    created_at?: string;
    updated_at?: string;
  };
  return {
    id: entry.id,
    customerId: data.customer_id ?? '',
    kind: data.kind === 'dispute' ? 'dispute' : 'note',
    body: data.body ?? '',
    createdAt: data.created_at ?? '',
    updatedAt: data.updated_at ?? data.created_at ?? '',
  };
}

function mapWorkspacePaymentReminder(entry: QueryDocumentSnapshot): WorkspacePaymentReminder {
  const data = entry.data() as {
    customer_id?: string;
    tone?: string;
    message?: string;
    balance_at_send?: number;
    shared_via?: string;
    created_at?: string;
  };
  return {
    id: entry.id,
    customerId: data.customer_id ?? '',
    tone: data.tone === 'firm' || data.tone === 'final' ? data.tone : 'polite',
    message: data.message ?? '',
    balanceAtSend: data.balance_at_send ?? 0,
    sharedVia: data.shared_via ?? 'web_review',
    createdAt: data.created_at ?? '',
  };
}

function mapWorkspacePaymentPromise(entry: QueryDocumentSnapshot): WorkspacePaymentPromise {
  const data = entry.data() as {
    customer_id?: string;
    promised_amount?: number;
    promised_date?: string;
    note?: string | null;
    status?: string;
    created_at?: string;
    updated_at?: string;
  };
  return {
    id: entry.id,
    customerId: data.customer_id ?? '',
    promisedAmount: data.promised_amount ?? 0,
    promisedDate: data.promised_date ?? '',
    note: data.note ?? null,
    status: normalizeWorkspacePaymentPromiseStatus(data.status),
    createdAt: data.created_at ?? '',
    updatedAt: data.updated_at ?? data.created_at ?? '',
  };
}

function normalizeWorkspacePaymentPromiseStatus(value: string | undefined): WorkspacePaymentPromiseStatus {
  return value === 'fulfilled' || value === 'missed' || value === 'cancelled' ? value : 'open';
}

function sortPaymentPromises(left: WorkspacePaymentPromise, right: WorkspacePaymentPromise): number {
  const weight: Record<WorkspacePaymentPromiseStatus, number> = {
    open: 0,
    missed: 1,
    fulfilled: 2,
    cancelled: 3,
  };
  return (
    weight[left.status] - weight[right.status] ||
    left.promisedDate.localeCompare(right.promisedDate) ||
    right.createdAt.localeCompare(left.createdAt)
  );
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
      payment_mode?: string | null;
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
      (!data.payment_clearance_status || doesPaymentClearInvoice(data.payment_clearance_status, data.payment_mode))
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

function buildInvoiceProductStockDeltas(
  existingItems: QueryDocumentSnapshot[],
  cleanItems: Array<{ productId?: string | null; quantity: number }>
): Map<string, number> {
  const deltas = new Map<string, number>();
  for (const entry of existingItems) {
    const data = entry.data() as { product_id?: string | null; quantity?: number };
    const productId = data.product_id;
    if (!productId) {
      continue;
    }
    deltas.set(productId, roundQuantity((deltas.get(productId) ?? 0) + (data.quantity ?? 0)));
  }

  for (const item of cleanItems) {
    const productId = item.productId;
    if (!productId) {
      continue;
    }
    deltas.set(productId, roundQuantity((deltas.get(productId) ?? 0) - item.quantity));
  }

  return deltas;
}

async function assertProductStockCanApply(
  firestore: Firestore,
  workspaceId: string,
  productStockDeltas: Map<string, number>
): Promise<void> {
  const entries = Array.from(productStockDeltas.entries()).filter(([, delta]) => delta !== 0);
  if (!entries.length) {
    return;
  }

  await Promise.all(
    entries.map(async ([productId, delta]) => {
      const productSnapshot = await getDoc(doc(firestore, 'workspaces', workspaceId, 'products', productId));
      if (!productSnapshot.exists()) {
        throw new Error('One selected product could not be found.');
      }
      const data = productSnapshot.data() as { name?: string; stock_quantity?: number };
      const nextStock = roundQuantity((data.stock_quantity ?? 0) + delta);
      if (nextStock < 0) {
        throw new Error(`${data.name ?? 'Product'} does not have enough stock for this invoice.`);
      }
    })
  );
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
  paymentStatusReason?: string | null;
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
    paymentStatusReason: normalizeSnapshotText(input.paymentStatusReason ?? ''),
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

function cleanOptional(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function roundMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function roundQuantity(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 1000) / 1000;
}

function normalizeCustomerNameKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeCustomerPhoneKey(value: string | null): string {
  return (value ?? '').replace(/[^\d+]/g, '');
}
