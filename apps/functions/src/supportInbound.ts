const SUPPORT_CASE_ID_PATTERN = /(ol-sup-\d{8}-[a-z0-9]{6})/i;
const MESSAGE_ID_PATTERN = /<[^>\s]+>/g;

export type SupportInboundRoute = {
  matchedAddress: string | null;
  supportCaseId: string | null;
  usedBaseInbox: boolean;
};

export function extractMailboxAddress(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) {
    return null;
  }

  const bracketMatch = text.match(/<([^>]+)>/);
  const candidate = (bracketMatch?.[1] ?? text).trim().toLowerCase();
  return isValidMailboxAddress(candidate) ? candidate : null;
}

export function buildSupportReplyToAddress(baseInboxAddress: string, supportCaseId: string): string {
  const normalizedInbox = extractMailboxAddress(baseInboxAddress);
  const normalizedCaseId = normalizeSupportInboundCaseId(supportCaseId);
  if (!normalizedInbox || !normalizedCaseId) {
    return baseInboxAddress;
  }

  const atIndex = normalizedInbox.indexOf('@');
  if (atIndex <= 0) {
    return normalizedInbox;
  }

  const localPart = normalizedInbox.slice(0, atIndex);
  const domain = normalizedInbox.slice(atIndex + 1);
  return `${localPart}+${normalizedCaseId.toLowerCase()}@${domain}`;
}

export function parseSupportInboundRoute(addresses: string[], baseInboxAddress: string): SupportInboundRoute {
  const normalizedBaseInbox = extractMailboxAddress(baseInboxAddress);
  if (!normalizedBaseInbox) {
    return {
      matchedAddress: null,
      supportCaseId: null,
      usedBaseInbox: false,
    };
  }

  const atIndex = normalizedBaseInbox.indexOf('@');
  if (atIndex <= 0) {
    return {
      matchedAddress: null,
      supportCaseId: null,
      usedBaseInbox: false,
    };
  }

  const baseLocalPart = normalizedBaseInbox.slice(0, atIndex);
  const baseDomain = normalizedBaseInbox.slice(atIndex + 1);
  for (const address of addresses) {
    const normalizedAddress = extractMailboxAddress(address);
    if (!normalizedAddress) {
      continue;
    }

    const addressAtIndex = normalizedAddress.indexOf('@');
    if (addressAtIndex <= 0) {
      continue;
    }

    const localPart = normalizedAddress.slice(0, addressAtIndex);
    const domain = normalizedAddress.slice(addressAtIndex + 1);
    if (domain !== baseDomain) {
      continue;
    }
    if (localPart === baseLocalPart) {
      return {
        matchedAddress: normalizedAddress,
        supportCaseId: null,
        usedBaseInbox: true,
      };
    }

    if (!localPart.startsWith(`${baseLocalPart}+`)) {
      continue;
    }

    const suffix = localPart.slice(baseLocalPart.length + 1);
    const supportCaseId = normalizeSupportInboundCaseId(suffix);
    if (!supportCaseId) {
      continue;
    }

    return {
      matchedAddress: normalizedAddress,
      supportCaseId,
      usedBaseInbox: false,
    };
  }

  return {
    matchedAddress: null,
    supportCaseId: null,
    usedBaseInbox: false,
  };
}

export function normalizeSupportInboundCaseId(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) {
    return null;
  }

  const match = text.match(SUPPORT_CASE_ID_PATTERN);
  return match?.[1]?.toUpperCase() ?? null;
}

export function extractSupportInboundHeaderValue(
  headers: Record<string, unknown> | null | undefined,
  name: string
): string | null {
  if (!headers) {
    return null;
  }

  const headerName = name.trim().toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.trim().toLowerCase() !== headerName) {
      continue;
    }
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }
  return null;
}

export function extractSupportInboundMessageReferences(
  headers: Record<string, unknown> | null | undefined
): string[] {
  const values = [
    extractSupportInboundHeaderValue(headers, 'in-reply-to'),
    extractSupportInboundHeaderValue(headers, 'references'),
  ]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.match(MESSAGE_ID_PATTERN) ?? [value]);

  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function buildSupportInboundMessageBody(input: {
  text?: string | null;
  html?: string | null;
}): string {
  const textBody = normalizeSupportInboundBody(input.text);
  if (textBody) {
    return textBody;
  }

  return normalizeSupportInboundBody(stripHtmlTags(input.html)) ?? 'Customer replied by email.';
}

export function inferSupportKindFromInboundEmail(
  subject: string | null | undefined,
  body: string | null | undefined
): string {
  const haystack = `${subject ?? ''}\n${body ?? ''}`.toLowerCase();
  if (matchesAny(haystack, ['restore', 'backup', 'rollback', 'recover data'])) {
    return 'restore_help';
  }
  if (matchesAny(haystack, ['invoice', 'pdf', 'csv', 'tax', 'gst', 'print'])) {
    return 'invoice_issue';
  }
  if (matchesAny(haystack, ['payment', 'charged', 'refund', 'billing', 'plan', 'pricing', 'receipt', 'purchase'])) {
    return 'purchase_help';
  }
  if (matchesAny(haystack, ['sync', 'error', 'bug', 'not loading', 'crash', 'issue'])) {
    return 'sync_issue';
  }
  if (matchesAny(haystack, ['feature', 'suggestion', 'request', 'improvement', 'idea'])) {
    return 'feature_request';
  }
  return 'general_feedback';
}

function normalizeSupportInboundBody(value: string | null | undefined): string | null {
  const text = value
    ?.replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
  if (!text) {
    return null;
  }
  return text.slice(0, 20_000);
}

function stripHtmlTags(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"');
}

function matchesAny(haystack: string, patterns: string[]) {
  return patterns.some((pattern) => haystack.includes(pattern));
}

function isValidMailboxAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
