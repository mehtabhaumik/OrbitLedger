import { describe, expect, it } from 'vitest';

import {
  createOrResumeWebAuthSession,
  getWebAuthSessionExpiryReason,
  parseStoredWebAuthSession,
  refreshWebAuthSessionActivity,
} from './session-security';

describe('web auth session security', () => {
  it('keeps the original start time when the same user resumes', () => {
    const session = createOrResumeWebAuthSession(
      { userId: 'u1', startedAt: 1000, lastActiveAt: 2000 },
      'u1',
      3000
    );

    expect(session).toEqual({ userId: 'u1', startedAt: 1000, lastActiveAt: 3000 });
  });

  it('starts a new tracked session for a different user', () => {
    expect(createOrResumeWebAuthSession({ userId: 'u1', startedAt: 1000, lastActiveAt: 2000 }, 'u2', 5000)).toEqual({
      userId: 'u2',
      startedAt: 5000,
      lastActiveAt: 5000,
    });
  });

  it('detects idle and absolute session expiry', () => {
    expect(getWebAuthSessionExpiryReason({ userId: 'u1', startedAt: 0, lastActiveAt: 1000 }, 31_000, 10_000, 60_000)).toBe(
      'idle_timeout'
    );
    expect(getWebAuthSessionExpiryReason({ userId: 'u1', startedAt: 0, lastActiveAt: 59_000 }, 60_000, 10_000, 60_000)).toBe(
      'absolute_timeout'
    );
  });

  it('refreshes activity without changing the start time', () => {
    expect(refreshWebAuthSessionActivity({ userId: 'u1', startedAt: 1000, lastActiveAt: 2000 }, 9000)).toEqual({
      userId: 'u1',
      startedAt: 1000,
      lastActiveAt: 9000,
    });
  });

  it('ignores malformed stored sessions', () => {
    expect(parseStoredWebAuthSession('nope')).toBeNull();
    expect(parseStoredWebAuthSession(JSON.stringify({ userId: 'u1', startedAt: 'bad', lastActiveAt: 1 }))).toBeNull();
  });
});
