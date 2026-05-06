export type WebAuthSession = {
  userId: string;
  startedAt: number;
  lastActiveAt: number;
};

export type WebAuthSessionExpiryReason = 'idle_timeout' | 'absolute_timeout';

export const WEB_AUTH_SESSION_STORAGE_KEY = 'orbit-ledger:web-auth-session:v1';
export const WEB_AUTH_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
export const WEB_AUTH_ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60 * 1000;

export function createOrResumeWebAuthSession(
  existing: WebAuthSession | null,
  userId: string,
  now = Date.now()
): WebAuthSession {
  if (existing?.userId === userId) {
    return {
      ...existing,
      lastActiveAt: now,
    };
  }

  return {
    userId,
    startedAt: now,
    lastActiveAt: now,
  };
}

export function refreshWebAuthSessionActivity(session: WebAuthSession, now = Date.now()): WebAuthSession {
  return {
    ...session,
    lastActiveAt: now,
  };
}

export function getWebAuthSessionExpiryReason(
  session: WebAuthSession,
  now = Date.now(),
  idleTimeoutMs = WEB_AUTH_IDLE_TIMEOUT_MS,
  absoluteTimeoutMs = WEB_AUTH_ABSOLUTE_TIMEOUT_MS
): WebAuthSessionExpiryReason | null {
  if (now - session.startedAt >= absoluteTimeoutMs) {
    return 'absolute_timeout';
  }
  if (now - session.lastActiveAt >= idleTimeoutMs) {
    return 'idle_timeout';
  }
  return null;
}

export function parseStoredWebAuthSession(value: string | null): WebAuthSession | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<WebAuthSession>;
    if (
      typeof parsed.userId !== 'string' ||
      typeof parsed.startedAt !== 'number' ||
      typeof parsed.lastActiveAt !== 'number' ||
      !Number.isFinite(parsed.startedAt) ||
      !Number.isFinite(parsed.lastActiveAt)
    ) {
      return null;
    }
    return {
      userId: parsed.userId,
      startedAt: parsed.startedAt,
      lastActiveAt: parsed.lastActiveAt,
    };
  } catch {
    return null;
  }
}

export function getWebAuthSessionExpiryMessage(reason: WebAuthSessionExpiryReason) {
  return reason === 'absolute_timeout'
    ? 'Your secure session ended. Sign in again to continue.'
    : 'Your session timed out after no activity. Sign in again to continue.';
}
