export const ORBIT_LEDGER_EMERGENCY_ADMIN_EMAILS = [
  'bvmehta1980@gmail.com',
  'ui.bhaumik@gmail.com',
  'mehtabhaumik.2007@gmail.com',
] as const;

export function normalizePlatformAdminEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase() ?? '';
  return normalized || null;
}

export function getWebPlatformAdminEmailAllowlist(
  rawPlatformAllowlist = process.env.NEXT_PUBLIC_ORBIT_LEDGER_PLATFORM_ADMIN_EMAILS,
  rawFallbackAllowlist = process.env.NEXT_PUBLIC_ORBIT_LEDGER_INTERNAL_ADMIN_EMAILS
): string[] {
  const effectiveAllowlist = rawPlatformAllowlist?.trim() ? rawPlatformAllowlist : rawFallbackAllowlist;
  const configuredEmails = (effectiveAllowlist ?? '')
    .split(',')
    .map((email) => normalizePlatformAdminEmail(email))
    .filter((email): email is string => Boolean(email));

  return Array.from(new Set([...ORBIT_LEDGER_EMERGENCY_ADMIN_EMAILS, ...configuredEmails]));
}

export function getWebOperationsEmailAllowlist(
  rawOperationsAllowlist = process.env.NEXT_PUBLIC_ORBIT_LEDGER_OPERATIONS_EMAILS,
  rawFallbackAllowlist = process.env.NEXT_PUBLIC_ORBIT_LEDGER_INTERNAL_ADMIN_EMAILS
): string[] {
  const effectiveAllowlist = rawOperationsAllowlist?.trim() ? rawOperationsAllowlist : rawFallbackAllowlist;
  const configuredEmails = (effectiveAllowlist ?? '')
    .split(',')
    .map((email) => normalizePlatformAdminEmail(email))
    .filter((email): email is string => Boolean(email));

  return Array.from(new Set(configuredEmails));
}

export function isWebPlatformAdminAllowed(email: string | null | undefined): boolean {
  const normalized = normalizePlatformAdminEmail(email);
  if (!normalized) {
    return false;
  }

  const allowlist = getWebPlatformAdminEmailAllowlist();
  if (!allowlist.length) {
    return process.env.NODE_ENV !== 'production';
  }

  return allowlist.includes(normalized);
}
