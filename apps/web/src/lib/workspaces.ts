'use client';

import type { OrbitWorkspaceSummary } from '@orbit-ledger/contracts';
import { normalizeManualPaymentInstructionDetails, type ManualPaymentInstructionDetails } from '@orbit-ledger/core';
import {
  addDoc,
  collection,
  count,
  doc,
  type FieldValue,
  getAggregateFromServer,
  getDoc,
  getDocs,
  limit as limitQuery,
  query,
  runTransaction,
  serverTimestamp,
  sum,
  Timestamp,
  where,
} from 'firebase/firestore';

import { getWebFirestore } from './firebase';

export type WorkspaceProfileInput = {
  businessName: string;
  legalName?: string | null;
  ownerName: string;
  contactPerson?: string | null;
  businessType?: string | null;
  phone: string;
  whatsapp?: string | null;
  email: string;
  website?: string | null;
  address: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  postalCode?: string | null;
  gstin?: string | null;
  pan?: string | null;
  taxNumber?: string | null;
  registrationNumber?: string | null;
  placeOfSupply?: string | null;
  defaultTaxTreatment?: string | null;
  defaultPaymentTerms?: string | null;
  defaultDueDays?: number | null;
  defaultTaxRate?: number | null;
  defaultInvoiceTemplate?: string | null;
  defaultStatementTemplate?: string | null;
  defaultLanguage?: string | null;
  currency: string;
  countryCode: string;
  stateCode: string;
  logoUri?: string | null;
  authorizedPersonName?: string | null;
  authorizedPersonTitle?: string | null;
  signatureUri?: string | null;
  paymentInstructions?: ManualPaymentInstructionDetails | null;
};

type FirestoreWorkspaceDoc = {
  business_name: string;
  legal_name?: string | null;
  owner_name: string;
  contact_person?: string | null;
  business_type?: string | null;
  phone: string;
  whatsapp?: string | null;
  email: string;
  website?: string | null;
  address: string;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  postal_code?: string | null;
  gstin?: string | null;
  pan?: string | null;
  tax_number?: string | null;
  registration_number?: string | null;
  place_of_supply?: string | null;
  default_tax_treatment?: string | null;
  default_payment_terms?: string | null;
  default_due_days?: number | null;
  default_tax_rate?: number | null;
  default_invoice_template?: string | null;
  default_statement_template?: string | null;
  default_language?: string | null;
  currency: string;
  country_code: string;
  state_code: string;
  logo_uri?: string | null;
  authorized_person_name?: string | null;
  authorized_person_title?: string | null;
  signature_uri?: string | null;
  payment_upi_id?: string | null;
  payment_page_url?: string | null;
  payment_note?: string | null;
  payment_bank_account_name?: string | null;
  payment_bank_name?: string | null;
  payment_bank_account_number?: string | null;
  payment_bank_ifsc?: string | null;
  payment_bank_branch?: string | null;
  payment_bank_routing_number?: string | null;
  payment_bank_sort_code?: string | null;
  payment_bank_iban?: string | null;
  payment_bank_swift?: string | null;
  owner_uid: string;
  owner_email?: string | null;
  data_state: 'profile_only' | 'full_dataset';
  created_at?: Timestamp | string | FieldValue;
  updated_at?: Timestamp | string | FieldValue;
  server_revision?: number;
};

export async function listWorkspacesForUser(userId: string): Promise<OrbitWorkspaceSummary[]> {
  const snapshot = await getDocs(
    query(collection(getWebFirestore(), 'workspaces'), where('owner_uid', '==', userId), limitQuery(10))
  );

  return snapshot.docs
    .map((entry) => mapWorkspace(entry.id, entry.data() as FirestoreWorkspaceDoc))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function createWorkspace(
  ownerId: string,
  ownerEmail: string | null,
  input: WorkspaceProfileInput
): Promise<OrbitWorkspaceSummary> {
  const createdIso = new Date().toISOString();
  const payload: FirestoreWorkspaceDoc = {
    business_name: input.businessName.trim(),
    ...workspaceProfileOptionalPayload(input),
    owner_name: input.ownerName.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    address: input.address.trim(),
    currency: input.currency.trim().toUpperCase(),
    country_code: input.countryCode.trim().toUpperCase(),
    state_code: input.stateCode.trim().toUpperCase(),
    logo_uri: input.logoUri ?? null,
    authorized_person_name: input.authorizedPersonName?.trim() ?? '',
    authorized_person_title: input.authorizedPersonTitle?.trim() ?? '',
    signature_uri: input.signatureUri ?? null,
    ...paymentInstructionPayload(input.paymentInstructions),
    owner_uid: ownerId,
    owner_email: ownerEmail,
    data_state: 'profile_only',
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    server_revision: 1,
  };

  const ref = await addDoc(collection(getWebFirestore(), 'workspaces'), payload);
  // Avoid a second immediate round trip after write to keep workspace creation responsive.
  return mapWorkspace(ref.id, {
    ...payload,
    created_at: createdIso,
    updated_at: createdIso,
  });
}

export async function updateWorkspaceProfile(
  workspaceId: string,
  expectedRevision: number,
  input: WorkspaceProfileInput
): Promise<OrbitWorkspaceSummary> {
  const firestore = getWebFirestore();
  const workspaceRef = doc(firestore, 'workspaces', workspaceId);

  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(workspaceRef);
    const current = snapshot.data() as FirestoreWorkspaceDoc | undefined;
    const currentRevision = current?.server_revision ?? 0;

    if (currentRevision !== expectedRevision) {
      throw new Error('Workspace was changed elsewhere. Refresh before saving again.');
    }

    transaction.update(workspaceRef, {
      business_name: input.businessName.trim(),
      ...workspaceProfileOptionalPayload(input),
      owner_name: input.ownerName.trim(),
      phone: input.phone.trim(),
      email: input.email.trim(),
      address: input.address.trim(),
      currency: input.currency.trim().toUpperCase(),
      country_code: input.countryCode.trim().toUpperCase(),
      state_code: input.stateCode.trim().toUpperCase(),
      logo_uri: input.logoUri ?? null,
      authorized_person_name: input.authorizedPersonName?.trim() ?? '',
      authorized_person_title: input.authorizedPersonTitle?.trim() ?? '',
      signature_uri: input.signatureUri ?? null,
      ...paymentInstructionPayload(input.paymentInstructions),
      updated_at: serverTimestamp(),
      server_revision: currentRevision + 1,
    });
  });

  const next = await getDoc(workspaceRef);
  return mapWorkspace(next.id, next.data() as FirestoreWorkspaceDoc);
}

type DashboardSnapshot = {
  receivableTotal: number;
  customerCount: number;
  invoiceCount: number;
  recentPayments: number;
};

export async function loadWorkspaceDashboardSnapshot(workspaceId: string): Promise<DashboardSnapshot> {
  const firestore = getWebFirestore();
  const customersRef = collection(firestore, 'workspaces', workspaceId, 'customers');
  const invoicesRef = collection(firestore, 'workspaces', workspaceId, 'invoices');
  const transactionsRef = collection(firestore, 'workspaces', workspaceId, 'transactions');

  const [customersAggregate, invoicesAggregate, paymentAggregate] = await Promise.all([
    getAggregateFromServer(customersRef, {
      customerCount: count(),
      receivableTotal: sum('current_balance'),
    }),
    getAggregateFromServer(invoicesRef, {
      invoiceCount: count(),
    }),
    getAggregateFromServer(query(transactionsRef, where('type', '==', 'payment')), {
      total: sum('amount'),
    }),
  ]);

  const customerData = customersAggregate.data();
  const invoiceData = invoicesAggregate.data();
  const paymentData = paymentAggregate.data();
  const receivableTotal = safeAggregateNumber(customerData.receivableTotal);
  const totalPayments = safeAggregateNumber(paymentData.total);

  return {
    receivableTotal,
    customerCount: safeAggregateNumber(customerData.customerCount),
    invoiceCount: safeAggregateNumber(invoiceData.invoiceCount),
    recentPayments: totalPayments,
  };
}

function safeAggregateNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function mapWorkspace(id: string, data: FirestoreWorkspaceDoc): OrbitWorkspaceSummary {
  return {
    workspaceId: id,
    businessName: data.business_name ?? '',
    legalName: data.legal_name ?? null,
    ownerName: data.owner_name ?? '',
    contactPerson: data.contact_person ?? null,
    businessType: data.business_type ?? null,
    phone: data.phone ?? '',
    whatsapp: data.whatsapp ?? null,
    email: data.email ?? '',
    website: data.website ?? null,
    address: data.address ?? '',
    addressLine1: data.address_line_1 ?? null,
    addressLine2: data.address_line_2 ?? null,
    city: data.city ?? null,
    postalCode: data.postal_code ?? null,
    gstin: data.gstin ?? null,
    pan: data.pan ?? null,
    taxNumber: data.tax_number ?? null,
    registrationNumber: data.registration_number ?? null,
    placeOfSupply: data.place_of_supply ?? null,
    defaultTaxTreatment: data.default_tax_treatment ?? null,
    defaultPaymentTerms: data.default_payment_terms ?? null,
    defaultDueDays: typeof data.default_due_days === 'number' ? data.default_due_days : null,
    defaultTaxRate: typeof data.default_tax_rate === 'number' ? data.default_tax_rate : null,
    defaultInvoiceTemplate: data.default_invoice_template ?? null,
    defaultStatementTemplate: data.default_statement_template ?? null,
    defaultLanguage: data.default_language ?? null,
    currency: data.currency ?? 'INR',
    countryCode: data.country_code ?? 'IN',
    stateCode: data.state_code ?? '',
    logoUri: data.logo_uri ?? null,
    authorizedPersonName: data.authorized_person_name ?? '',
    authorizedPersonTitle: data.authorized_person_title ?? '',
    signatureUri: data.signature_uri ?? null,
    paymentInstructions: normalizeManualPaymentInstructionDetails({
      upiId: data.payment_upi_id,
      paymentPageUrl: data.payment_page_url,
      paymentNote: data.payment_note,
      bankAccountName: data.payment_bank_account_name,
      bankName: data.payment_bank_name,
      bankAccountNumber: data.payment_bank_account_number,
      bankIfsc: data.payment_bank_ifsc,
      bankBranch: data.payment_bank_branch,
      bankRoutingNumber: data.payment_bank_routing_number,
      bankSortCode: data.payment_bank_sort_code,
      bankIban: data.payment_bank_iban,
      bankSwift: data.payment_bank_swift,
    }),
    createdAt: toIsoString(data.created_at),
    updatedAt: toIsoString(data.updated_at),
    serverRevision: data.server_revision ?? 0,
    dataState: data.data_state ?? 'profile_only',
  };
}

function workspaceProfileOptionalPayload(input: WorkspaceProfileInput) {
  return {
    legal_name: cleanOptional(input.legalName),
    contact_person: cleanOptional(input.contactPerson),
    business_type: cleanOptional(input.businessType),
    whatsapp: cleanOptional(input.whatsapp),
    website: cleanOptional(input.website),
    address_line_1: cleanOptional(input.addressLine1),
    address_line_2: cleanOptional(input.addressLine2),
    city: cleanOptional(input.city),
    postal_code: cleanOptional(input.postalCode),
    gstin: cleanOptional(input.gstin)?.toUpperCase() ?? null,
    pan: cleanOptional(input.pan)?.toUpperCase() ?? null,
    tax_number: cleanOptional(input.taxNumber),
    registration_number: cleanOptional(input.registrationNumber),
    place_of_supply: cleanOptional(input.placeOfSupply),
    default_tax_treatment: cleanOptional(input.defaultTaxTreatment),
    default_payment_terms: cleanOptional(input.defaultPaymentTerms),
    default_due_days:
      typeof input.defaultDueDays === 'number' && Number.isFinite(input.defaultDueDays)
        ? Math.max(0, Math.floor(input.defaultDueDays))
        : null,
    default_tax_rate:
      typeof input.defaultTaxRate === 'number' && Number.isFinite(input.defaultTaxRate)
        ? Math.max(0, input.defaultTaxRate)
        : null,
    default_invoice_template: cleanOptional(input.defaultInvoiceTemplate),
    default_statement_template: cleanOptional(input.defaultStatementTemplate),
    default_language: cleanOptional(input.defaultLanguage),
  };
}

function paymentInstructionPayload(details?: ManualPaymentInstructionDetails | null) {
  const normalized = normalizeManualPaymentInstructionDetails(details);
  return {
    payment_upi_id: normalized.upiId,
    payment_page_url: normalized.paymentPageUrl,
    payment_note: normalized.paymentNote,
    payment_bank_account_name: normalized.bankAccountName,
    payment_bank_name: normalized.bankName,
    payment_bank_account_number: normalized.bankAccountNumber,
    payment_bank_ifsc: normalized.bankIfsc,
    payment_bank_branch: normalized.bankBranch,
    payment_bank_routing_number: normalized.bankRoutingNumber,
    payment_bank_sort_code: normalized.bankSortCode,
    payment_bank_iban: normalized.bankIban,
    payment_bank_swift: normalized.bankSwift,
  };
}

function cleanOptional(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toIsoString(value: Timestamp | string | FieldValue | undefined): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (typeof value === 'string') {
    return value;
  }

  return new Date().toISOString();
}
