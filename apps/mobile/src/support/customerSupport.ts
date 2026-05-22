import type { FounderSafeDiagnosticSummary, FounderSafeSupportKind } from '@orbit-ledger/core';
import { Linking, Share } from 'react-native';

import { getCloudAuth } from '../cloud/auth';
import { getFirebaseApp } from '../cloud/firebase';
import { getSyncOverview } from '../sync/service';

const FALLBACK_SUPPORT_EMAIL = 'support@rudraix.com';

export type MobileSupportSubmissionInput = {
  supportKind: FounderSafeSupportKind;
  supportCaseId?: string | null;
  includeDiagnostics: boolean;
  sanitizedMessage: string;
  diagnosticSummary?: FounderSafeDiagnosticSummary | null;
  privateDataWarnings: string[];
};

export type MobileSupportSubmissionResult =
  | {
      mode: 'ticket';
      supportCaseId: string;
      ticketId: string;
      message: string;
    }
  | {
      mode: 'fallback_mail' | 'fallback_share';
      message: string;
    };

export async function submitMobileSupportRequest(
  input: MobileSupportSubmissionInput
): Promise<MobileSupportSubmissionResult> {
  const user = getCloudAuth().currentUser;
  const overview = await getSyncOverview().catch(() => null);

  if (user && overview?.workspaceId) {
    const token = await user.getIdToken();
    const projectId = getFirebaseApp().options.projectId?.trim() || 'orbit-ledger-f41c2';
    const response = await fetch(
      `https://asia-south1-${projectId}.cloudfunctions.net/submitFounderSafeSupportRequest`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspaceId: overview.workspaceId,
          supportKind: input.supportKind,
          supportCaseId: input.supportCaseId,
          includeDiagnostics: input.includeDiagnostics,
          sanitizedMessage: input.sanitizedMessage,
          safeFields: input.includeDiagnostics ? input.diagnosticSummary?.safeFields ?? null : null,
          redactedFields: input.includeDiagnostics ? input.diagnosticSummary?.redactedFields ?? [] : [],
          privateDataWarnings: input.privateDataWarnings,
        }),
      }
    );
    const result = (await response.json().catch(() => ({
      ok: false,
      error: 'support_request_failed',
    }))) as
      | {
          ok: true;
          supportCaseId: string;
          ticketId: string;
          message?: string | null;
        }
      | {
          ok: false;
          error: string;
          message?: string | null;
        };

    if (result.ok) {
      return {
        mode: 'ticket',
        supportCaseId: result.supportCaseId,
        ticketId: result.ticketId,
        message: result.message ?? `Support request saved. Case number ${result.supportCaseId}.`,
      };
    }

    throw new Error(result.message ?? 'Support request could not be saved inside Orbit Ledger.');
  }

  const fallbackMessage = buildFallbackSupportMessage(input);
  const subject = encodeURIComponent('Orbit Ledger support request');
  const body = encodeURIComponent(fallbackMessage);
  const mailUrl = `mailto:${FALLBACK_SUPPORT_EMAIL}?subject=${subject}&body=${body}`;

  try {
    const canOpenMail = await Linking.canOpenURL(mailUrl);
    if (canOpenMail) {
      await Linking.openURL(mailUrl);
      return {
        mode: 'fallback_mail',
        message: 'Support request is ready in your mail app. Sign in with a synced workspace to save cases inside Orbit Ledger.',
      };
    }

    await Share.share({
      title: 'Orbit Ledger support request',
      message: fallbackMessage,
    });
    return {
      mode: 'fallback_share',
      message: 'Support request is ready in your sharing app. Sign in with a synced workspace to save cases inside Orbit Ledger.',
    };
  } catch (error) {
    console.warn('[mobile-support] Could not submit support request', error);
    throw new Error('Support request could not be sent from this device.');
  }
}

function buildFallbackSupportMessage(input: MobileSupportSubmissionInput) {
  const lines = [
    'Hello Orbit Ledger team,',
    '',
    input.sanitizedMessage,
  ];

  if (input.supportCaseId?.trim()) {
    lines.push('', `Support case: ${input.supportCaseId.trim()}`);
  }

  if (input.includeDiagnostics && input.diagnosticSummary) {
    lines.push('', 'Safe diagnostic summary:');
    for (const [label, value] of Object.entries(input.diagnosticSummary.safeFields)) {
      lines.push(`- ${formatDiagnosticLabel(label)}: ${Array.isArray(value) ? value.join(', ') : String(value)}`);
    }
    lines.push('', input.diagnosticSummary.privacyNote);
  }

  lines.push('', 'No customer records, invoices, payment proof, backups, or private keys are attached automatically.');
  return lines.join('\n');
}

function formatDiagnosticLabel(value: string) {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (letter) => letter.toUpperCase())
    .trim();
}
