export type SettingsStorageScope =
  | 'user_cloud'
  | 'workspace_cloud'
  | 'device_local'
  | 'audit_protected';

export type SettingsSaveBehavior = 'auto' | 'manual' | 'confirm' | 'audit';

export type SettingsSurface =
  | 'my_settings'
  | 'company_settings'
  | 'invoice_documents'
  | 'payment_settings'
  | 'security'
  | 'backup_data'
  | 'notifications_reminders';

export type SettingsPlatform = 'mobile' | 'web' | 'both';

export type SettingsBlueprintItem = {
  id: string;
  label: string;
  surface: SettingsSurface;
  storage: SettingsStorageScope;
  saveBehavior: SettingsSaveBehavior;
  platform: SettingsPlatform;
  reason: string;
  userBenefit: string;
  implementationNote: string;
};

export const SETTINGS_SURFACE_LABELS: Record<SettingsSurface, string> = {
  my_settings: 'My Settings',
  company_settings: 'Company Settings',
  invoice_documents: 'Invoice & Document Settings',
  payment_settings: 'Payment Settings',
  security: 'Security',
  backup_data: 'Backup & Data',
  notifications_reminders: 'Notifications & Reminders',
};

export const SETTINGS_STORAGE_RULES: Record<SettingsStorageScope, string> = {
  user_cloud:
    'Per-user preference synced through the account. It should follow the signed-in user and not change the shared business setup for teammates.',
  workspace_cloud:
    'Shared company/workspace setting synced for everyone who uses the business. It changes official document or business behavior.',
  device_local:
    'Device/browser-only setting. It should not be restored into another device or treated as cloud security.',
  audit_protected:
    'Money, tax, identity, or security-sensitive setting. Changes must keep history, actor, timestamp, previous value, and reason when implemented.',
};

export const SETTINGS_SAVE_BEHAVIOR_RULES: Record<SettingsSaveBehavior, string> = {
  auto: 'Safe to save quietly with a small saving/saved indicator and no noisy toast.',
  manual: 'User should intentionally save the section because the setting affects official output or shared workflow.',
  confirm: 'User should confirm because the change may surprise customers, staff, or future documents.',
  audit: 'User should confirm and the app should write an audit entry before the change is considered complete.',
};

export const ORBIT_LEDGER_SETTINGS_BLUEPRINT: SettingsBlueprintItem[] = [
  setting(
    'default-dashboard-view',
    'Default dashboard view',
    'my_settings',
    'user_cloud',
    'auto',
    'both',
    'Controls only how this user starts the day.',
    'Owner sees the most useful first screen without rebuilding the dashboard each visit.',
    'Store per user and workspace so one user can prefer command center while another prefers reports.'
  ),
  setting(
    'table-density',
    'Table density',
    'my_settings',
    'user_cloud',
    'auto',
    'web',
    'Changes scanning comfort but not business data.',
    'Power users can use compact lists; casual users can keep comfortable spacing.',
    'Apply to customers, invoices, payments, products, and reports tables.'
  ),
  setting(
    'rows-per-page',
    'Rows per page',
    'my_settings',
    'user_cloud',
    'auto',
    'web',
    'Changes list size only for the current user.',
    'User stops repeatedly changing pagination on busy lists.',
    'Use sane options such as 25, 50, 100; mobile may ignore this.'
  ),
  setting(
    'default-date-range',
    'Default report date range',
    'my_settings',
    'user_cloud',
    'auto',
    'both',
    'A personal report preference, not business truth.',
    'Reports open to the period the user actually reviews.',
    'Use values like this_month, last_30_days, this_quarter, custom_last_used.'
  ),
  setting(
    'default-customer-filter',
    'Default customer filter',
    'my_settings',
    'user_cloud',
    'auto',
    'both',
    'A list preference that should not affect other users.',
    'Collector can open directly to due or follow-up customers.',
    'Store filter ids, not raw display labels.'
  ),
  setting(
    'default-invoice-status-filter',
    'Default invoice status filter',
    'my_settings',
    'user_cloud',
    'auto',
    'both',
    'A view preference for invoice review.',
    'User can open invoices directly to unpaid, overdue, or created invoices.',
    'Keep document state and payment state separate in the filter object.'
  ),
  setting(
    'balance-privacy-mode',
    'Hide balances on screen',
    'my_settings',
    'user_cloud',
    'auto',
    'both',
    'A personal privacy preference that does not change stored money.',
    'User can open the app in public without exposing amounts.',
    'Mask amounts in dashboards, lists, and quick cards; documents should still show real amounts.'
  ),
  setting(
    'larger-text',
    'Larger text',
    'my_settings',
    'user_cloud',
    'auto',
    'both',
    'Accessibility preference for the user.',
    'App remains comfortable on small phones and tablets.',
    'Do not break fixed controls; pair with responsive layout checks.'
  ),
  setting(
    'reduced-motion',
    'Reduced motion',
    'my_settings',
    'device_local',
    'auto',
    'both',
    'Motion comfort can be device specific and should respect OS settings.',
    'Users sensitive to motion get a calmer app.',
    'Default from OS preference, then let user override on this device.'
  ),
  setting(
    'default-export-format',
    'Default export format',
    'my_settings',
    'user_cloud',
    'auto',
    'both',
    'A personal preference for PDF, CSV, or both.',
    'User stops choosing the same export format repeatedly.',
    'Do not remove explicit export choices from each screen.'
  ),
  setting(
    'company-display-name',
    'Company display name',
    'company_settings',
    'workspace_cloud',
    'manual',
    'both',
    'Shared identity that appears across app screens and exports.',
    'Business name stays consistent everywhere.',
    'Validate as business text; allow numbers and punctuation needed by company names.'
  ),
  setting(
    'company-legal-name',
    'Legal business name',
    'company_settings',
    'audit_protected',
    'audit',
    'both',
    'Legal identity affects official documents and tax records.',
    'User can correct identity without losing history.',
    'Require confirmation and store previous/new value with reason.'
  ),
  setting(
    'company-contact-details',
    'Company contact details',
    'company_settings',
    'workspace_cloud',
    'manual',
    'both',
    'Shared phone, email, WhatsApp, website, and contact person.',
    'Invoices and customer communication show correct contact details.',
    'Validate each field by type and country.'
  ),
  setting(
    'company-address',
    'Company address',
    'company_settings',
    'workspace_cloud',
    'manual',
    'both',
    'Shared address used in documents and reports.',
    'Documents show a complete, structured address.',
    'Country locked to India for now; state and city should come from controlled lists.'
  ),
  setting(
    'company-tax-ids',
    'Company tax IDs',
    'company_settings',
    'audit_protected',
    'audit',
    'both',
    'GSTIN, PAN, VAT, and registration numbers affect compliance documents.',
    'Tax details are trustworthy and recoverable.',
    'Country pack decides labels and validation; keep an audit entry for changes.'
  ),
  setting(
    'invoice-numbering',
    'Invoice numbering',
    'invoice_documents',
    'audit_protected',
    'audit',
    'both',
    'Numbering changes can affect audit, customer references, and tax records.',
    'User can customize format without creating duplicate or confusing invoice numbers.',
    'Check uniqueness before saving. Require reason when changing after invoices exist.'
  ),
  setting(
    'default-invoice-template',
    'Default invoice template',
    'invoice_documents',
    'workspace_cloud',
    'auto',
    'both',
    'Shared document default but low risk when Pro gates are enforced at generation.',
    'Every new invoice starts with the preferred design.',
    'Server/generation logic must reject locked Pro templates for free users.'
  ),
  setting(
    'default-statement-template',
    'Default statement template',
    'invoice_documents',
    'workspace_cloud',
    'auto',
    'both',
    'Shared statement default but low risk when gates are enforced.',
    'Statements stay visually consistent.',
    'Use the shared document template catalog for mobile and web.'
  ),
  setting(
    'brand-colors',
    'Document brand colors',
    'invoice_documents',
    'workspace_cloud',
    'auto',
    'both',
    'Branding changes document appearance without changing money.',
    'Premium documents feel owned by the business.',
    'Persist header, background, line, and text colors with contrast checks.'
  ),
  setting(
    'logo-signature-watermark',
    'Logo, signature, and watermark files',
    'invoice_documents',
    'workspace_cloud',
    'manual',
    'both',
    'Shared assets affect official document presentation.',
    'Documents look professional without repeated uploads.',
    'Store files in workspace storage and references in workspace profile.'
  ),
  setting(
    'watermark-opacity',
    'Watermark opacity',
    'invoice_documents',
    'workspace_cloud',
    'auto',
    'both',
    'Pure visual preference and safe to adjust.',
    'User can make watermark subtle enough for real invoices.',
    'Clamp to a safe range so PDF text remains readable.'
  ),
  setting(
    'default-invoice-notes',
    'Default invoice notes',
    'invoice_documents',
    'workspace_cloud',
    'manual',
    'both',
    'Shared customer-facing wording appears on invoices.',
    'User avoids retyping terms and notes.',
    'Keep plain business language; country packs can suggest defaults.'
  ),
  setting(
    'pdf-footer-preference',
    'PDF footer preference',
    'invoice_documents',
    'workspace_cloud',
    'confirm',
    'both',
    'Footer output changes customer-facing documents and plan visibility.',
    'User knows what branding/footer will appear before sharing.',
    'Plan rules override user choice when free footer is required.'
  ),
  setting(
    'filename-format',
    'Document filename format',
    'invoice_documents',
    'workspace_cloud',
    'auto',
    'both',
    'File naming does not change document data.',
    'Downloads are easy to find and sort.',
    'Default to customer_invoice_date_revision_country without Orbit Ledger prefix.'
  ),
  setting(
    'payment-terms',
    'Default payment terms',
    'payment_settings',
    'audit_protected',
    'audit',
    'both',
    'Terms affect due dates and customer expectations.',
    'User can prove when collection rules changed.',
    'Require confirmation when changing after invoices exist.'
  ),
  setting(
    'default-due-days',
    'Default due days',
    'payment_settings',
    'audit_protected',
    'audit',
    'both',
    'Due days drive overdue status and reminders.',
    'Invoices and follow-ups stay predictable.',
    'Audit because it can affect payment state and aging reports.'
  ),
  setting(
    'default-tax-rate',
    'Default tax rate',
    'invoice_documents',
    'audit_protected',
    'audit',
    'both',
    'Tax rate affects invoice totals.',
    'User can trust totals and tax output.',
    'Prefer country-pack tax resolver; manual defaults need audit.'
  ),
  setting(
    'manual-payment-instructions',
    'Manual payment instructions',
    'payment_settings',
    'audit_protected',
    'audit',
    'both',
    'Bank, UPI, and payment page details affect where customers send money.',
    'Incorrect payment details are easier to detect and correct.',
    'Mask sensitive values in history while keeping enough detail for audit.'
  ),
  setting(
    'payment-provider-credentials',
    'Payment provider credentials',
    'payment_settings',
    'audit_protected',
    'audit',
    'web',
    'Credentials are security-sensitive and may affect real payment capture.',
    'Provider setup is controlled and reviewable.',
    'Store secrets outside client-visible workspace documents.'
  ),
  setting(
    'app-lock-timeout',
    'App lock timeout',
    'security',
    'device_local',
    'confirm',
    'both',
    'Lock behavior protects only the current device/browser.',
    'User can protect the app without confusing it with cloud password security.',
    'Keep PIN/biometric settings local and excluded from cloud sync.'
  ),
  setting(
    'backup-reminder-frequency',
    'Backup reminder frequency',
    'backup_data',
    'user_cloud',
    'auto',
    'both',
    'Reminder cadence is personal and low risk.',
    'User gets backup nudges at a useful pace.',
    'Workspace backup events remain separate from reminder preference.'
  ),
  setting(
    'restore-confirmation-rules',
    'Restore confirmation rules',
    'backup_data',
    'audit_protected',
    'audit',
    'both',
    'Restore affects large amounts of business data.',
    'Dangerous data operations remain intentional.',
    'Keep typed confirmation, rollback metadata, actor, and timestamp.'
  ),
  setting(
    'reminder-style',
    'Reminder style',
    'notifications_reminders',
    'user_cloud',
    'auto',
    'both',
    'Tone preference can vary by user.',
    'Payment reminders sound natural for the business owner.',
    'Options should be human: soft, firm, urgent.'
  ),
  setting(
    'overdue-alert-timing',
    'Overdue alert timing',
    'notifications_reminders',
    'user_cloud',
    'auto',
    'both',
    'Alert timing is a personal workflow preference.',
    'User sees overdue work at the right time of day.',
    'Separate notification preference from invoice due date truth.'
  ),
  setting(
    'message-templates',
    'WhatsApp and email templates',
    'notifications_reminders',
    'workspace_cloud',
    'manual',
    'both',
    'Templates are shared customer-facing business wording.',
    'Team sends consistent, polite messages.',
    'Store variants for invoice, overdue, bounced instrument, urgent request, and thank-you.'
  ),
  setting(
    'urgent-payment-stamp-default',
    'Urgent payment stamp default',
    'notifications_reminders',
    'workspace_cloud',
    'confirm',
    'both',
    'Stamp appears on customer-facing documents and can feel strong.',
    'User can signal urgency intentionally.',
    'Default should be off; per-document override should remain available.'
  ),
];

export function getSettingsBlueprintBySurface(surface: SettingsSurface): SettingsBlueprintItem[] {
  return ORBIT_LEDGER_SETTINGS_BLUEPRINT.filter((item) => item.surface === surface);
}

export function getSettingsBlueprintByStorage(storage: SettingsStorageScope): SettingsBlueprintItem[] {
  return ORBIT_LEDGER_SETTINGS_BLUEPRINT.filter((item) => item.storage === storage);
}

export function getAutoSavedSettings(): SettingsBlueprintItem[] {
  return ORBIT_LEDGER_SETTINGS_BLUEPRINT.filter((item) => item.saveBehavior === 'auto');
}

export function getAuditProtectedSettings(): SettingsBlueprintItem[] {
  return ORBIT_LEDGER_SETTINGS_BLUEPRINT.filter((item) => item.storage === 'audit_protected');
}

function setting(
  id: string,
  label: string,
  surface: SettingsSurface,
  storage: SettingsStorageScope,
  saveBehavior: SettingsSaveBehavior,
  platform: SettingsPlatform,
  reason: string,
  userBenefit: string,
  implementationNote: string
): SettingsBlueprintItem {
  return {
    id,
    label,
    surface,
    storage,
    saveBehavior,
    platform,
    reason,
    userBenefit,
    implementationNote,
  };
}
