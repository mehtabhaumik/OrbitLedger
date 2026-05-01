import type { OrbitCloudUser, OrbitWorkspaceSummary } from '@orbit-ledger/contracts';
import { normalizeManualPaymentInstructionDetails } from '@orbit-ledger/core';
import { getFirebaseApp } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  runTransaction,
  setDoc,
  where,
} from 'firebase/firestore';

import { createEntityId, requiredText } from '../database/utils';

export type WorkspaceProfileDraft = {
  businessName: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  currency: string;
  countryCode: string;
  stateCode: string;
  logoUri?: string | null;
  authorizedPersonName: string;
  authorizedPersonTitle: string;
  signatureUri?: string | null;
};

function getWorkspaceCollection() {
  return collection(getFirestore(getFirebaseApp()), 'workspaces');
}

function mapWorkspaceSummary(
  workspaceId: string,
  data: Partial<Record<string, unknown>>
): OrbitWorkspaceSummary {
  return {
    workspaceId,
    businessName: String(data.business_name ?? ''),
    ownerName: String(data.owner_name ?? ''),
    phone: String(data.phone ?? ''),
    email: String(data.email ?? ''),
    address: String(data.address ?? ''),
    currency: String(data.currency ?? 'INR'),
    countryCode: String(data.country_code ?? 'IN'),
    stateCode: String(data.state_code ?? ''),
    logoUri: typeof data.logo_uri === 'string' ? data.logo_uri : null,
    authorizedPersonName: String(data.authorized_person_name ?? ''),
    authorizedPersonTitle: String(data.authorized_person_title ?? ''),
    signatureUri: typeof data.signature_uri === 'string' ? data.signature_uri : null,
    paymentInstructions: normalizeManualPaymentInstructionDetails({
      upiId: stringValue(data.payment_upi_id),
      paymentPageUrl: stringValue(data.payment_page_url),
      paymentNote: stringValue(data.payment_note),
      bankAccountName: stringValue(data.payment_bank_account_name),
      bankName: stringValue(data.payment_bank_name),
      bankAccountNumber: stringValue(data.payment_bank_account_number),
      bankIfsc: stringValue(data.payment_bank_ifsc),
      bankBranch: stringValue(data.payment_bank_branch),
      bankRoutingNumber: stringValue(data.payment_bank_routing_number),
      bankSortCode: stringValue(data.payment_bank_sort_code),
      bankIban: stringValue(data.payment_bank_iban),
      bankSwift: stringValue(data.payment_bank_swift),
    }),
    createdAt: String(data.created_at ?? new Date().toISOString()),
    updatedAt: String(data.updated_at ?? new Date().toISOString()),
    serverRevision:
      typeof data.server_revision === 'number' && Number.isFinite(data.server_revision)
        ? data.server_revision
        : 0,
    dataState: data.data_state === 'full_dataset' ? 'full_dataset' : 'profile_only',
  };
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function serializeProfileDraft(profile: WorkspaceProfileDraft, owner: OrbitCloudUser) {
  const now = new Date().toISOString();

  return {
    business_name: requiredText(profile.businessName),
    owner_name: requiredText(profile.ownerName),
    phone: requiredText(profile.phone),
    email: requiredText(profile.email),
    address: requiredText(profile.address),
    currency: requiredText(profile.currency).toUpperCase(),
    country_code: requiredText(profile.countryCode).toUpperCase(),
    state_code: requiredText(profile.stateCode).toUpperCase(),
    logo_uri: profile.logoUri ?? null,
    authorized_person_name: requiredText(profile.authorizedPersonName),
    authorized_person_title: requiredText(profile.authorizedPersonTitle),
    signature_uri: profile.signatureUri ?? null,
    owner_uid: owner.uid,
    owner_email: owner.email ?? profile.email,
    server_revision: 1,
    data_state: 'profile_only' as const,
    created_at: now,
    updated_at: now,
  };
}

export async function listCloudWorkspacesForUser(userId: string): Promise<OrbitWorkspaceSummary[]> {
  const snapshot = await getDocs(query(getWorkspaceCollection(), where('owner_uid', '==', userId)));
  return snapshot.docs
    .map((entry) => mapWorkspaceSummary(entry.id, entry.data()))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function createCloudWorkspace(
  owner: OrbitCloudUser,
  profile: WorkspaceProfileDraft
): Promise<OrbitWorkspaceSummary> {
  const workspaceId = createEntityId('wrk');
  const payload = serializeProfileDraft(profile, owner);

  await setDoc(doc(getWorkspaceCollection(), workspaceId), payload);
  return mapWorkspaceSummary(workspaceId, payload);
}

export async function updateCloudWorkspaceProfile(
  workspaceId: string,
  profile: WorkspaceProfileDraft,
  expectedServerRevision: number
): Promise<OrbitWorkspaceSummary> {
  const firestore = getFirestore(getFirebaseApp());
  const workspaceRef = doc(getWorkspaceCollection(), workspaceId);

  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(workspaceRef);
    const current = snapshot.data() ?? {};
    const currentRevision =
      typeof current.server_revision === 'number' && Number.isFinite(current.server_revision)
        ? current.server_revision
        : 0;

    if (currentRevision !== expectedServerRevision) {
      throw new Error('Workspace profile changed on another device. Refresh and review before saving again.');
    }

    transaction.update(workspaceRef, {
      business_name: requiredText(profile.businessName),
      owner_name: requiredText(profile.ownerName),
      phone: requiredText(profile.phone),
      email: requiredText(profile.email),
      address: requiredText(profile.address),
      currency: requiredText(profile.currency).toUpperCase(),
      country_code: requiredText(profile.countryCode).toUpperCase(),
      state_code: requiredText(profile.stateCode).toUpperCase(),
      logo_uri: profile.logoUri ?? null,
      authorized_person_name: requiredText(profile.authorizedPersonName),
      authorized_person_title: requiredText(profile.authorizedPersonTitle),
      signature_uri: profile.signatureUri ?? null,
      updated_at: new Date().toISOString(),
      server_revision: currentRevision + 1,
    });
  });

  const snapshot = await getDoc(workspaceRef);
  return mapWorkspaceSummary(snapshot.id, snapshot.data() ?? {});
}

export async function getCloudWorkspace(workspaceId: string): Promise<OrbitWorkspaceSummary | null> {
  const snapshot = await getDoc(doc(getWorkspaceCollection(), workspaceId));
  if (!snapshot.exists()) {
    return null;
  }

  return mapWorkspaceSummary(snapshot.id, snapshot.data());
}
