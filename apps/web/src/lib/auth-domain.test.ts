import { describe, expect, it } from 'vitest';

import {
  isEmbeddedWebViewUserAgent,
  isOrbitLedgerCustomAuthDomain,
  resolveOrbitLedgerAuthDomain,
} from './auth-domain';

describe('auth domain resolution', () => {
  const firebaseDomain = 'orbit-ledger-f41c2.firebaseapp.com';

  it('uses the current custom app host as auth domain on approved Orbit Ledger domains', () => {
    expect(resolveOrbitLedgerAuthDomain(firebaseDomain, 'orbitledger.rudraix.com')).toBe(
      'orbitledger.rudraix.com'
    );
    expect(resolveOrbitLedgerAuthDomain(firebaseDomain, 'orbitledger.bhaumikmehta.com')).toBe(
      'orbitledger.bhaumikmehta.com'
    );
  });

  it('keeps the configured Firebase domain for localhost and non-custom hosts', () => {
    expect(resolveOrbitLedgerAuthDomain(firebaseDomain, 'localhost')).toBe(firebaseDomain);
    expect(resolveOrbitLedgerAuthDomain(firebaseDomain, 'orbit-ledger-f41c2.web.app')).toBe(
      firebaseDomain
    );
  });

  it('recognizes only approved custom auth domains', () => {
    expect(isOrbitLedgerCustomAuthDomain('orbitledger.rudraix.com')).toBe(true);
    expect(isOrbitLedgerCustomAuthDomain('orbitledger.bhaumikmehta.com')).toBe(true);
    expect(isOrbitLedgerCustomAuthDomain('example.com')).toBe(false);
  });
});

describe('embedded browser detection', () => {
  it('detects Facebook in-app browser user agents', () => {
    expect(isEmbeddedWebViewUserAgent('Mozilla/5.0 [FBAN/FBIOS;FBAV/500.0.0]')).toBe(true);
  });

  it('detects Instagram in-app browser user agents', () => {
    expect(isEmbeddedWebViewUserAgent('Mozilla/5.0 Instagram 330.0.0')).toBe(true);
  });

  it('does not treat normal desktop Chrome as an embedded browser', () => {
    expect(
      isEmbeddedWebViewUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0 Safari/537.36'
      )
    ).toBe(false);
  });
});
