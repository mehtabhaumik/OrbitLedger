import type {
  OrbitBusinessStorageMode,
  OrbitWorkspaceDataState,
  OrbitWorkspaceLink,
} from '@orbit-ledger/contracts';

export function isSyncedBusinessMode(mode: OrbitBusinessStorageMode): boolean {
  return mode === 'synced';
}

export function isLocalOnlyBusinessMode(mode: OrbitBusinessStorageMode): boolean {
  return mode === 'local_only';
}

export function canUseBusinessOnWeb(link: OrbitWorkspaceLink): boolean {
  return link.storageMode === 'synced' && Boolean(link.workspaceId) && link.syncEnabled;
}

export function describeBusinessAvailability(link: OrbitWorkspaceLink): string {
  if (canUseBusinessOnWeb(link)) {
    return 'Available across signed-in devices.';
  }

  return 'Stored only on this device until sync is enabled.';
}

export function getBusinessModeLabel(mode: OrbitBusinessStorageMode): string {
  return mode === 'synced' ? 'Synced workspace' : 'Local-only business';
}

export function getBusinessModeDescription(mode: OrbitBusinessStorageMode): string {
  return mode === 'synced'
    ? 'This business is linked to a signed-in workspace and can be used across devices.'
    : 'This business stays only on this device until sync is enabled.';
}

export function canBootstrapWorkspaceLocally(dataState: OrbitWorkspaceDataState): boolean {
  return dataState === 'profile_only' || dataState === 'full_dataset';
}
