import type { OrbitWorkspaceSummary } from '@orbit-ledger/contracts';

const EMPTY_VALUES = new Set(['', '-', 'not saved', 'optional for now']);

export function formatWorkspaceRegisteredAddress(workspace: OrbitWorkspaceSummary): string | null {
  if (!workspace.addressLine1?.trim() && !workspace.addressLine2?.trim()) {
    return null;
  }

  const parts = compactAddressParts([
    workspace.addressLine1,
    workspace.addressLine2,
    workspace.town,
    workspace.city,
    workspace.stateCode,
    workspace.postalCode,
    workspace.countryCode,
  ]);

  return parts.length ? parts.join(', ') : null;
}

export function formatWorkspaceCompanyAddress(workspace: OrbitWorkspaceSummary): string {
  const parts = compactAddressParts([
    workspace.address,
    workspace.town,
    workspace.city,
    workspace.stateCode,
    workspace.postalCode,
    workspace.countryCode,
  ]);

  return parts.length ? parts.join(', ') : 'Address not saved';
}

export function formatWorkspaceDocumentAddress(workspace: OrbitWorkspaceSummary): string {
  return formatWorkspaceRegisteredAddress(workspace) ?? formatWorkspaceCompanyAddress(workspace);
}

export function compactAddressParts(parts: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();

  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .filter((part) => !EMPTY_VALUES.has(part.toLowerCase()))
    .filter((part) => {
      const key = part.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}
