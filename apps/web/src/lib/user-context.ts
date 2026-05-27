'use client';

import { getWebAuth, getWebFirebaseProjectId } from './firebase';

export type WebUserContextMode = 'open_workspace' | 'view_as_user' | 'act_as_user';
export type WebUserContextStatus = 'active' | 'ended' | 'expired';

export type WebUserContextSession = {
  sessionId: string;
  status: WebUserContextStatus;
  mode: WebUserContextMode;
  reason: string;
  actorUid: string;
  actorEmail: string | null;
  actorRole: string;
  targetUid: string;
  targetEmail: string | null;
  targetDisplayName: string | null;
  targetWorkspaceId: string;
  targetWorkspaceName: string;
  targetAccessSource: 'owner' | 'member';
  targetOfficeRole: string | null;
  targetIsOwner: boolean;
  readOnly: boolean;
  allowActions: boolean;
  startedAt: string | null;
  expiresAt: string | null;
  endedAt: string | null;
};

type UserContextEnvelope =
  | {
      ok: true;
      session: WebUserContextSession | null;
    }
  | {
      ok: false;
      error: string;
    };

async function fetchUserContextApi<T>(url: string, body: Record<string, unknown>) {
  const user = getWebAuth().currentUser;
  if (!user) {
    throw new Error('Sign in again before opening a user-context session.');
  }

  const token = await user.getIdToken();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return (await response.json().catch(() => ({
    ok: false,
    error: 'user_context_request_failed',
  }))) as T;
}

export async function loadWebUserContextSession(): Promise<WebUserContextSession | null> {
  const result = await fetchUserContextApi<UserContextEnvelope>(getUserContextSessionUrl(), { action: 'get' });
  if (!result.ok) {
    throw new Error(userContextErrorMessage(result.error));
  }
  return result.session;
}

export async function startWebUserContextSession(input: {
  mode: WebUserContextMode;
  reason: string;
  targetUid?: string | null;
  targetEmail?: string | null;
  targetWorkspaceId: string;
}): Promise<WebUserContextSession> {
  const result = await fetchUserContextApi<UserContextEnvelope>(getUserContextSessionUrl(), {
    action: 'start',
    mode: input.mode,
    reason: input.reason,
    targetUid: input.targetUid ?? null,
    targetEmail: input.targetEmail ?? null,
    targetWorkspaceId: input.targetWorkspaceId,
  });
  if (!result.ok || !result.session) {
    throw new Error(userContextErrorMessage(result.ok ? 'user_context_session_missing' : result.error));
  }
  return result.session;
}

export async function endWebUserContextSession(): Promise<void> {
  const result = await fetchUserContextApi<UserContextEnvelope>(getUserContextSessionUrl(), { action: 'end' });
  if (!result.ok) {
    throw new Error(userContextErrorMessage(result.error));
  }
}

function getUserContextSessionUrl() {
  const projectId = getWebFirebaseProjectId();
  return `https://asia-south1-${projectId}.cloudfunctions.net/manageBackofficeUserContextSession`;
}

function userContextErrorMessage(error: string) {
  if (error === 'user_context_reason_required') {
    return 'Add a clear reason with at least 10 characters before starting this debug session.';
  }
  if (error === 'user_context_target_required') {
    return 'Choose a valid target user before starting this debug session.';
  }
  if (error === 'user_context_workspace_required') {
    return 'Choose a workspace before opening the user area.';
  }
  if (error === 'user_context_target_not_found') {
    return 'No matching Orbit Ledger user was found for that target.';
  }
  if (error === 'user_context_workspace_not_found') {
    return 'The selected workspace could not be found.';
  }
  if (error === 'user_context_target_not_in_workspace') {
    return 'That user does not have access to the selected workspace.';
  }
  if (error === 'user_context_action_not_allowed') {
    return 'Your admin role cannot start that kind of user-context session.';
  }
  if (error === 'user_context_rate_limit_exceeded') {
    return 'Too many user-context sessions were started too quickly. Wait a moment and try again.';
  }
  if (error === 'internal_admin_required') {
    return 'This account is not allowed to start user-context debugging.';
  }
  return 'The user-context session could not be started.';
}
