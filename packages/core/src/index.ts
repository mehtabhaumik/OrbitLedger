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
    return 'Available on web and signed-in devices.';
  }

  return 'Available on this device. You can add online access later.';
}

export function getBusinessModeLabel(mode: OrbitBusinessStorageMode): string {
  return mode === 'synced' ? 'Signed-in access' : 'This device';
}

export function getBusinessModeDescription(mode: OrbitBusinessStorageMode): string {
  return mode === 'synced'
    ? 'Use this business on this phone, web, and signed-in devices.'
    : 'Use this business on this phone. You can add web access later.';
}

export function canBootstrapWorkspaceLocally(dataState: OrbitWorkspaceDataState): boolean {
  return dataState === 'profile_only' || dataState === 'full_dataset';
}

export {
  formatPhoneForLocalBusinessPack,
  getLocalBusinessPack,
  getLocalPhoneExample,
  getLocalReminderToneDescriptions,
} from './localBusinessPacks';
export type {
  LocalBusinessPack,
  LocalBusinessPackLookup,
  LocalReminderTone,
} from './localBusinessPacks';

export {
  ORBIT_LEDGER_APP_STORE_COPY,
  ORBIT_LEDGER_LAUNCH_TRUST_CHECKS,
  ORBIT_LEDGER_POSITIONING,
  ORBIT_LEDGER_SCREENSHOT_STORIES,
} from './marketLaunch';

export {
  buildCustomerHealthScore,
} from './customerHealth';
export type {
  CustomerHealthInput,
  CustomerHealthRank,
  CustomerHealthScore,
} from './customerHealth';

export {
  deriveInvoicePaymentStatus,
  getGeneratedInvoiceDocumentLabel,
  getInvoiceDocumentStateLabel,
  getInvoicePaymentStatusLabel,
  INVOICE_DOCUMENT_STATES,
  INVOICE_PAYMENT_STATUSES,
  PAYMENT_ALLOCATION_STRATEGIES,
  legacyStatusForInvoiceLifecycle,
  normalizeInvoiceDocumentState,
  normalizeInvoicePaymentStatus,
} from './invoiceLifecycle';

export {
  getPaymentModeConfig,
  getPaymentModeLabel,
  doesPaymentClearInvoice,
  getPaymentClearanceStatusLabel,
  isInstrumentPaymentMode,
  normalizePaymentClearanceStatus,
  normalizePaymentInstrumentAttachments,
  normalizePaymentMode,
  normalizePaymentModeDetails,
  PAYMENT_MODE_CONFIGS,
  summarizePaymentClearance,
  summarizePaymentMode,
  validatePaymentModeDetails,
} from './paymentModes';
export type {
  PaymentClearanceStatus,
  PaymentInstrumentAttachment,
  PaymentMode,
  PaymentModeConfig,
  PaymentModeDetails,
} from './paymentModes';

export {
  appendPaymentLinkToMessage,
  buildInvoicePaymentLink,
  buildInvoicePaymentReference,
  normalizePaymentPageUrl,
  normalizeUpiId,
} from './paymentLinks';
export type {
  InvoicePaymentLink,
  InvoicePaymentLinkInput,
  PaymentLinkDetails,
} from './paymentLinks';
export {
  buildManualPaymentInstructionLines,
  buildManualPaymentInstructionText,
  getManualPaymentInstructionTemplate,
  normalizeManualPaymentInstructionDetails,
} from './manualPaymentInstructions';
export type {
  ManualPaymentInstructionDetails,
  ManualPaymentInstructionField,
  ManualPaymentInstructionTemplate,
} from './manualPaymentInstructions';
export {
  buildRazorpayNotes,
  buildRazorpayPaymentLinkDraft,
} from './paymentProviderSetup';
export type {
  RazorpayPaymentLinkDraft,
  RazorpayPaymentLinkDraftInput,
} from './paymentProviderSetup';
export {
  getPaymentProviderPlan,
  normalizePaymentProviderMode,
} from './paymentProviders';
export type {
  PaymentProviderMode,
  PaymentProviderPlan,
} from './paymentProviders';
export {
  normalizeProviderReference,
  reconcileProviderPayment,
} from './paymentReconciliation';
export type {
  PaymentProviderReconciliationInput,
  PaymentProviderSource,
  PaymentReconciliationDecision,
  PaymentReconciliationInvoice,
  PaymentReconciliationStatus,
} from './paymentReconciliation';
export type {
  InvoiceDocumentState,
  InvoiceLifecycleInput,
  InvoicePaymentStatus,
  LegacyInvoiceStatus,
  PaymentAllocationStrategy,
} from './invoiceLifecycle';
