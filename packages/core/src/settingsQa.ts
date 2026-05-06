import { ORBIT_LEDGER_SETTINGS_PARITY } from './settingsParity';

export type SettingsQaArea =
  | 'persistence'
  | 'refresh'
  | 'sign_in'
  | 'workspace_switch'
  | 'mobile_web_parity'
  | 'responsive'
  | 'user_feedback'
  | 'launch_polish';

export type SettingsQaCheck = {
  id: string;
  area: SettingsQaArea;
  label: string;
  expected: string;
  launchBlocking: boolean;
};

export const ORBIT_LEDGER_SETTINGS_QA_CHECKS: SettingsQaCheck[] = [
  qaCheck(
    'user-settings-save-and-refresh',
    'persistence',
    'My Settings save and survive refresh',
    'Personal settings save per user/workspace and reload without falling back to another workspace.',
    true
  ),
  qaCheck(
    'workspace-settings-save-and-refresh',
    'refresh',
    'Company and document settings survive refresh',
    'Shared workspace settings reload from the workspace profile after a page refresh.',
    true
  ),
  qaCheck(
    'logout-login-reload',
    'sign_in',
    'Settings reload after logout and login',
    'Signed-in users return to the same workspace settings without seeing a stale login-only state.',
    true
  ),
  qaCheck(
    'workspace-switch-no-stale-save',
    'workspace_switch',
    'Workspace switching cannot save stale settings',
    'Changing workspaces resets the user-settings save guard before the new workspace settings load.',
    true
  ),
  qaCheck(
    'settings-parity-covered',
    'mobile_web_parity',
    'Settings parity registry has no unplanned launch gaps',
    'Every both-platform setting has mobile and web evidence, while platform-only settings are clearly marked.',
    true
  ),
  qaCheck(
    'settings-mobile-tablet-layout',
    'responsive',
    'Settings sections remain usable on mobile and tablet widths',
    'Fields wrap without horizontal scrolling, cramped controls, or clipped helper text.',
    true
  ),
  qaCheck(
    'setting-applied-feedback',
    'user_feedback',
    'Users can tell when a setting applied',
    'Safe preferences show loading, saving, saved, or current-device state without noisy toasts.',
    false
  ),
  qaCheck(
    'settings-launch-copy-and-navigation',
    'launch_polish',
    'Settings copy and navigation feel ready for customers',
    'Settings uses plain owner-friendly language, distinct section anchors, and no duplicate destination confusion.',
    true
  ),
  qaCheck(
    'settings-launch-session-recovery',
    'launch_polish',
    'Login never blocks the Settings path forever',
    'If a secure session check is slow, the user can still reach a sign-in path while live sessions continue to redirect.',
    true
  ),
];

export function getLaunchBlockingSettingsQaChecks(
  checks: readonly SettingsQaCheck[] = ORBIT_LEDGER_SETTINGS_QA_CHECKS
) {
  return checks.filter((check) => check.launchBlocking);
}

export function getSettingsQaReadiness() {
  const parityGaps = ORBIT_LEDGER_SETTINGS_PARITY.filter(
    (item) =>
      (item.expectedPlatform === 'both' && (item.mobile === 'planned' || item.web === 'planned')) ||
      (item.expectedPlatform === 'mobile' && item.mobile === 'planned') ||
      (item.expectedPlatform === 'web' && item.web === 'planned')
  );

  return {
    checkCount: ORBIT_LEDGER_SETTINGS_QA_CHECKS.length,
    launchBlockingCheckCount: getLaunchBlockingSettingsQaChecks().length,
    unplannedParityGapCount: parityGaps.length,
    readyForNextPhase: parityGaps.length === 0,
  };
}

function qaCheck(
  id: string,
  area: SettingsQaArea,
  label: string,
  expected: string,
  launchBlocking: boolean
): SettingsQaCheck {
  return {
    id,
    area,
    label,
    expected,
    launchBlocking,
  };
}
