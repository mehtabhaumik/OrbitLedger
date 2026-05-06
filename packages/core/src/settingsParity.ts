import {
  ORBIT_LEDGER_SETTINGS_BLUEPRINT,
  type SettingsBlueprintItem,
  type SettingsPlatform,
} from './settingsBlueprint';

export type SettingsParityStatus = 'shared' | 'platform_specific' | 'planned';

export type SettingsParityCoverage = {
  settingId: string;
  label: string;
  expectedPlatform: SettingsPlatform;
  mobile: SettingsParityStatus;
  web: SettingsParityStatus;
  mobileEvidence: string;
  webEvidence: string;
};

const MOBILE_SETTINGS_EVIDENCE: Record<string, string> = {
  'default-dashboard-view': 'Mobile stores personal preferences with the shared user settings contract.',
  'default-date-range': 'Mobile stores report date preferences with the shared user settings contract.',
  'default-customer-filter': 'Mobile stores customer list preferences with the shared user settings contract.',
  'default-invoice-status-filter': 'Mobile stores invoice filter preferences with the shared user settings contract.',
  'balance-privacy-mode': 'Mobile stores balance privacy with the shared user settings contract.',
  'larger-text': 'Mobile stores larger text preference with the shared user settings contract.',
  'reduced-motion': 'Mobile can keep reduced motion as a device-local preference.',
  'default-export-format': 'Mobile stores default export format with the shared user settings contract.',
  'company-display-name': 'Mobile edits business display name in Business Profile.',
  'company-legal-name': 'Mobile uses tax setup/business profile as the legal identity surface.',
  'company-contact-details': 'Mobile edits owner, phone, and email in Business Profile.',
  'company-address': 'Mobile edits structured India address fields in Business Profile.',
  'company-tax-ids': 'Mobile edits country tax details in Tax Setup.',
  'invoice-numbering': 'Mobile invoice numbering is created through invoice services.',
  'default-invoice-template': 'Mobile uses the shared document template catalog and saved preferred invoice template.',
  'default-statement-template': 'Mobile uses the shared document template catalog and saved preferred statement template.',
  'brand-colors': 'Mobile Pro document theme controls exist in Business Profile.',
  'logo-signature-watermark': 'Mobile stores logo and signature assets; watermark support stays document-template controlled.',
  'watermark-opacity': 'Mobile can store visual document preference with the shared settings contract.',
  'default-invoice-notes': 'Mobile invoice creation supports notes used by generated documents.',
  'pdf-footer-preference': 'Mobile document generation enforces shared Free/Pro footer rules.',
  'filename-format': 'Mobile document generators use shared document naming rules.',
  'payment-terms': 'Mobile invoices use due-date/payment-term behavior.',
  'default-due-days': 'Mobile invoice creation can apply shared due-day defaults.',
  'default-tax-rate': 'Mobile tax setup and invoice tax resolver control tax defaults.',
  'manual-payment-instructions': 'Mobile saves manual payment instructions for invoices and reminders.',
  'app-lock-timeout': 'Mobile stores PIN timeout locally on device.',
  'backup-reminder-frequency': 'Mobile can store backup reminder frequency with the shared user settings contract.',
  'restore-confirmation-rules': 'Mobile backup restore uses review and confirmation before restore.',
  'reminder-style': 'Mobile can store reminder style with the shared user settings contract.',
  'overdue-alert-timing': 'Mobile can store overdue alert timing with the shared user settings contract.',
  'message-templates': 'Mobile reminder surfaces use shared message wording patterns.',
  'urgent-payment-stamp-default': 'Mobile document generation supports urgent payment stamp behavior.',
};

const WEB_SETTINGS_EVIDENCE: Record<string, string> = {
  'default-dashboard-view': 'Web saves My Settings per user/workspace.',
  'table-density': 'Web saves table density per user/workspace.',
  'rows-per-page': 'Web saves rows per page per user/workspace.',
  'default-date-range': 'Web saves report date range per user/workspace.',
  'default-customer-filter': 'Web saves customer filter per user/workspace.',
  'default-invoice-status-filter': 'Web saves invoice filter per user/workspace.',
  'balance-privacy-mode': 'Web saves balance privacy and applies it through the device settings provider.',
  'larger-text': 'Web saves larger text and applies it through the device settings provider.',
  'reduced-motion': 'Web stores reduced motion in browser/device settings.',
  'default-export-format': 'Web saves default export format per user/workspace.',
  'company-display-name': 'Web edits company display name in Company Settings.',
  'company-legal-name': 'Web protects legal name changes with settings audit.',
  'company-contact-details': 'Web edits phone, email, WhatsApp, website, and contact fields.',
  'company-address': 'Web edits structured India address fields in Company Settings.',
  'company-tax-ids': 'Web protects tax IDs with settings audit.',
  'invoice-numbering': 'Web protects document numbering-sensitive defaults with settings audit.',
  'default-invoice-template': 'Web saves default invoice template from the shared catalog.',
  'default-statement-template': 'Web saves default statement template from the shared catalog.',
  'brand-colors': 'Web saves Pro brand colors for documents.',
  'logo-signature-watermark': 'Web saves logo, signature, and watermark assets.',
  'watermark-opacity': 'Web saves watermark opacity for generated documents.',
  'default-invoice-notes': 'Web saves default invoice notes.',
  'pdf-footer-preference': 'Web saves footer preference while enforcing plan rules.',
  'filename-format': 'Web saves document filename format.',
  'payment-terms': 'Web protects payment terms with settings audit.',
  'default-due-days': 'Web protects due-day defaults with settings audit.',
  'default-tax-rate': 'Web protects tax-rate defaults with settings audit.',
  'manual-payment-instructions': 'Web protects payment instructions with settings audit.',
  'payment-provider-credentials': 'Web owns provider setup because credentials never belong in mobile client storage.',
  'app-lock-timeout': 'Web stores browser lock timeout locally.',
  'backup-reminder-frequency': 'Web saves backup reminder preference.',
  'restore-confirmation-rules': 'Web backup restore requires typed confirmation and rollback preparation.',
  'reminder-style': 'Web saves reminder style.',
  'overdue-alert-timing': 'Web saves overdue alert timing.',
  'message-templates': 'Web saves WhatsApp/email reminder templates.',
  'urgent-payment-stamp-default': 'Web saves urgent payment stamp default.',
};

export const ORBIT_LEDGER_SETTINGS_PARITY: SettingsParityCoverage[] =
  ORBIT_LEDGER_SETTINGS_BLUEPRINT.map(toSettingsParityCoverage);

export function getSettingsParityGaps(
  registry: readonly SettingsParityCoverage[] = ORBIT_LEDGER_SETTINGS_PARITY
) {
  return registry.filter(
    (item) =>
      (item.expectedPlatform === 'both' && (item.mobile === 'planned' || item.web === 'planned')) ||
      (item.expectedPlatform === 'mobile' && item.mobile === 'planned') ||
      (item.expectedPlatform === 'web' && item.web === 'planned')
  );
}

function toSettingsParityCoverage(item: SettingsBlueprintItem): SettingsParityCoverage {
  return {
    settingId: item.id,
    label: item.label,
    expectedPlatform: item.platform,
    mobile:
      item.platform === 'web'
        ? 'platform_specific'
        : MOBILE_SETTINGS_EVIDENCE[item.id]
          ? 'shared'
          : 'planned',
    web:
      item.platform === 'mobile'
        ? 'platform_specific'
        : WEB_SETTINGS_EVIDENCE[item.id]
          ? 'shared'
          : 'planned',
    mobileEvidence:
      item.platform === 'web'
        ? 'Not applicable to mobile.'
        : MOBILE_SETTINGS_EVIDENCE[item.id] ?? 'Mobile implementation evidence is not registered yet.',
    webEvidence:
      item.platform === 'mobile'
        ? 'Not applicable to web.'
        : WEB_SETTINGS_EVIDENCE[item.id] ?? 'Web implementation evidence is not registered yet.',
  };
}
