'use client';

import type {
  FounderSafeDiagnosticSummary,
  FounderSafeSupportKind,
  OfficeSupportCaseStatus,
} from '@orbit-ledger/core';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  type DocumentData,
} from 'firebase/firestore';

import { getWebAuth, getWebFirebaseProjectId, getWebFirestore } from './firebase';

export type CreateWebSupportDiagnosticConsentInput = {
  workspaceId: string;
  supportKind: FounderSafeSupportKind;
  supportCaseId?: string | null;
  sanitizedMessage: string;
  diagnosticSummary: FounderSafeDiagnosticSummary;
  privateDataWarnings: string[];
};

export type CreateWebSupportDiagnosticConsentResult = {
  consentId: string;
  expiresAt: string;
  message: string;
};

export type SubmitWebSupportRequestInput = {
  workspaceId: string;
  supportKind: FounderSafeSupportKind;
  supportCaseId?: string | null;
  consentId?: string | null;
  includeDiagnostics: boolean;
  sanitizedMessage: string;
  diagnosticSummary?: FounderSafeDiagnosticSummary | null;
  privateDataWarnings: string[];
};

export type SubmitWebSupportRequestResult = {
  supportCaseId: string;
  ticketId: string;
  consentId: string | null;
  created: boolean;
  message: string;
};

export type RevokeWebSupportDiagnosticConsentResult = {
  consentId: string;
  status: 'revoked' | 'expired' | 'active';
  message: string;
};

export type WebSupportCaseCustomerStatus = {
  id: string;
  supportCaseId: string;
  status: OfficeSupportCaseStatus;
  label: string;
  followUp: string;
  updatedAt: string | null;
};

export async function loadWebSupportCaseCustomerStatuses(
  workspaceId: string
): Promise<WebSupportCaseCustomerStatus[]> {
  const firestore = getWebFirestore();
  const snapshot = await getDocs(
    query(
      collection(firestore, 'workspaces', workspaceId, 'support_cases'),
      orderBy('updated_at', 'desc'),
      limit(20)
    )
  );

  return snapshot.docs.map((doc) => parseWebSupportCaseCustomerStatus(doc.id, doc.data()));
}

export function parseWebSupportCaseCustomerStatus(
  id: string,
  data: DocumentData
): WebSupportCaseCustomerStatus {
  const status = supportCaseStatus(data.status);
  const supportCaseId = stringValue(data.support_case_id) || stringValue(data.supportCaseId) || id;
  return {
    id,
    supportCaseId,
    status,
    label: supportCaseCustomerStatusLabel(status),
    followUp: supportCaseCustomerFollowUp(status),
    updatedAt: nullableString(data.updated_at ?? data.updatedAt),
  };
}

export function supportCaseCustomerStatusLabel(status: OfficeSupportCaseStatus) {
  if (status === 'resolved') {
    return 'Resolved';
  }
  if (status === 'reopened') {
    return 'Reopened';
  }
  if (status === 'waiting_on_customer') {
    return 'Waiting for your reply';
  }
  return 'In review';
}

export function supportCaseCustomerFollowUp(status: OfficeSupportCaseStatus) {
  if (status === 'resolved') {
    return 'This case is marked resolved. Reply with the case number if the issue returns.';
  }
  if (status === 'reopened') {
    return 'This case is back in review. We will continue from the same case number.';
  }
  if (status === 'waiting_on_customer') {
    return 'Support needs one more detail from you. Send a reply with this case number.';
  }
  return 'Support is reviewing this case. Keep the case number when sending any follow-up.';
}

export async function createWebSupportDiagnosticConsent(
  input: CreateWebSupportDiagnosticConsentInput
): Promise<CreateWebSupportDiagnosticConsentResult> {
  const user = getWebAuth().currentUser;
  if (!user) {
    throw new Error('Sign in again before approving support review.');
  }

  const token = await user.getIdToken();
  const response = await fetch(getCreateSupportDiagnosticConsentUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      supportKind: input.supportKind,
      supportCaseId: input.supportCaseId,
      sanitizedMessage: input.sanitizedMessage,
      safeFields: input.diagnosticSummary.safeFields,
      redactedFields: input.diagnosticSummary.redactedFields,
      privateDataWarnings: input.privateDataWarnings,
    }),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'support_consent_failed',
  }))) as
    | {
        ok: true;
        consentId: string;
        expiresAt: string;
        message?: string | null;
      }
    | {
        ok: false;
        error: string;
        message?: string | null;
      };

  if (!result.ok) {
    throw new Error(result.message ?? supportConsentErrorMessage(result.error));
  }

  return {
    consentId: result.consentId,
    expiresAt: result.expiresAt,
    message: result.message ?? 'Support review approval saved.',
  };
}

export async function submitWebSupportRequest(
  input: SubmitWebSupportRequestInput
): Promise<SubmitWebSupportRequestResult> {
  const user = getWebAuth().currentUser;
  if (!user) {
    throw new Error('Sign in again before sending this support request.');
  }

  const token = await user.getIdToken();
  const response = await fetch(getSubmitSupportRequestUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      supportKind: input.supportKind,
      supportCaseId: input.supportCaseId,
      consentId: input.consentId,
      includeDiagnostics: input.includeDiagnostics,
      sanitizedMessage: input.sanitizedMessage,
      safeFields: input.includeDiagnostics ? input.diagnosticSummary?.safeFields ?? null : null,
      redactedFields: input.includeDiagnostics ? input.diagnosticSummary?.redactedFields ?? [] : [],
      privateDataWarnings: input.privateDataWarnings,
    }),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'support_request_failed',
  }))) as
    | {
        ok: true;
        supportCaseId: string;
        ticketId: string;
        consentId: string | null;
        created: boolean;
        message?: string | null;
      }
    | {
        ok: false;
        error: string;
        message?: string | null;
      };

  if (!result.ok) {
    throw new Error(result.message ?? supportRequestErrorMessage(result.error));
  }

  return {
    supportCaseId: result.supportCaseId,
    ticketId: result.ticketId,
    consentId: result.consentId,
    created: result.created,
    message: result.message ?? `Support request saved. Case number ${result.supportCaseId}.`,
  };
}

export async function revokeWebSupportDiagnosticConsent(input: {
  workspaceId: string;
  consentId: string;
  reason?: string | null;
}): Promise<RevokeWebSupportDiagnosticConsentResult> {
  const user = getWebAuth().currentUser;
  if (!user) {
    throw new Error('Sign in again before revoking support review.');
  }

  const token = await user.getIdToken();
  const response = await fetch(getRevokeSupportDiagnosticConsentUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const result = (await response.json().catch(() => ({
    ok: false,
    error: 'support_consent_revoke_failed',
  }))) as
    | {
        ok: true;
        consentId: string;
        status: 'revoked' | 'expired' | 'active';
        message?: string | null;
      }
    | {
        ok: false;
        error: string;
        message?: string | null;
      };

  if (!result.ok) {
    throw new Error(result.message ?? supportConsentErrorMessage(result.error));
  }

  return {
    consentId: result.consentId,
    status: result.status,
    message: result.message ?? 'Support review approval updated.',
  };
}

function getCreateSupportDiagnosticConsentUrl() {
  const projectId = getWebFirebaseProjectId();
  return `https://asia-south1-${projectId}.cloudfunctions.net/createSupportDiagnosticConsent`;
}

function getSubmitSupportRequestUrl() {
  const projectId = getWebFirebaseProjectId();
  return `https://asia-south1-${projectId}.cloudfunctions.net/submitFounderSafeSupportRequest`;
}

function getRevokeSupportDiagnosticConsentUrl() {
  const projectId = getWebFirebaseProjectId();
  return `https://asia-south1-${projectId}.cloudfunctions.net/revokeSupportDiagnosticConsent`;
}

function supportCaseStatus(value: unknown): OfficeSupportCaseStatus {
  if (value === 'waiting_on_customer' || value === 'resolved' || value === 'reopened') {
    return value;
  }
  return 'open';
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function nullableString(value: unknown) {
  const text = stringValue(value);
  return text || null;
}

function supportConsentErrorMessage(error: string) {
  if (error === 'support_consent_required') {
    return 'Review the diagnostic pack before approving support access.';
  }
  if (error === 'support_consent_forbidden') {
    return 'Only the workspace owner or Office admin can approve support review.';
  }
  if (error === 'workspace_not_found') {
    return 'This workspace could not be found.';
  }
  if (error === 'support_consent_not_found') {
    return 'This support review approval could not be found.';
  }
  if (error === 'support_consent_revoke_required') {
    return 'Choose a support review approval to revoke.';
  }
  return 'Support review approval could not be saved.';
}

function supportRequestErrorMessage(error: string) {
  if (error === 'support_request_required') {
    return 'Add a short support message before sending this request.';
  }
  if (error === 'support_request_diagnostics_required') {
    return 'Review the diagnostic summary before sending it with this request.';
  }
  if (error === 'support_request_forbidden') {
    return 'Only the workspace owner or Office admin can send this support request.';
  }
  if (error === 'support_case_not_found') {
    return 'That support case could not be found. Check the case number and try again.';
  }
  if (error === 'support_consent_not_found') {
    return 'The saved support review approval could not be found. Approve it again before sending.';
  }
  if (error === 'support_consent_case_mismatch') {
    return 'The saved support review approval belongs to a different case number.';
  }
  if (error === 'support_consent_forbidden') {
    return 'This support review approval is no longer available for your account.';
  }
  return 'Support request could not be saved.';
}
