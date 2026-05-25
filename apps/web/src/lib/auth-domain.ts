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
  const normalizedHostname = hostname?.trim().toLowerCase();
  if (
    normalizedHostname &&
    ORBIT_LEDGER_CUSTOM_AUTH_DOMAINS.some((domain) => domain === normalizedHostname)
  ) {
    return normalizedHostname;
  }

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
