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
  ownerName: string;
  phone: string;
  email: string;
  address: string;
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
  owner_name: string;
  phone: string;
  email: string;
  address: string;
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
    ownerName: data.owner_name ?? '',
    phone: data.phone ?? '',
    email: data.email ?? '',
    address: data.address ?? '',
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

function toIsoString(value: Timestamp | string | FieldValue | undefined): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (typeof value === 'string') {
    return value;
  }

  return new Date().toISOString();
}
