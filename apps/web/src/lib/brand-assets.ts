export const ORBIT_LEDGER_LOGO_ASSETS = {
  primary: '/branding/orbit-ledger-logo-primary.png',
  inverse: '/branding/orbit-ledger-logo-inverse.png',
  accent: '/branding/orbit-ledger-logo-accent.png',
} as const;

export const ORBIT_LEDGER_MARK_ASSETS = {
  primary: '/branding/orbit-ledger-mark-primary.png',
  inverse: '/branding/orbit-ledger-mark-inverse.png',
  accent: '/branding/orbit-ledger-mark-accent.png',
} as const;

export type OrbitLedgerLogoVariant = keyof typeof ORBIT_LEDGER_LOGO_ASSETS;
export type OrbitLedgerMarkVariant = keyof typeof ORBIT_LEDGER_MARK_ASSETS;
