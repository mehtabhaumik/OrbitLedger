export const ORBIT_LEDGER_CUSTOM_AUTH_DOMAINS = [
  'orbitledger.rudraix.com',
  'orbitledger.bhaumikmehta.com',
] as const;

const embeddedWebViewMarkers = [
  'fban',
  'fbav',
  'fb_iab',
  'instagram',
  'line/',
  'linkedinapp',
  'micromessenger',
  'twitter',
  'wv)',
];

export function resolveOrbitLedgerAuthDomain(configuredAuthDomain: string, hostname?: string | null) {
  // App Hosting custom domains do not serve Firebase Auth's /__/auth/handler route.
  // Keep the Firebase-managed authDomain so popup/redirect flows resolve to the
  // built-in handler on *.firebaseapp.com instead of the current app hostname.
  void hostname;
  return configuredAuthDomain;
}

export function isOrbitLedgerCustomAuthDomain(hostname?: string | null) {
  const normalizedHostname = hostname?.trim().toLowerCase();
  return Boolean(
    normalizedHostname &&
      ORBIT_LEDGER_CUSTOM_AUTH_DOMAINS.some((domain) => domain === normalizedHostname)
  );
}

export function isEmbeddedWebViewUserAgent(userAgent?: string | null) {
  const normalizedUserAgent = userAgent?.trim().toLowerCase();
  if (!normalizedUserAgent) {
    return false;
  }

  return embeddedWebViewMarkers.some((marker) => normalizedUserAgent.includes(marker));
}
