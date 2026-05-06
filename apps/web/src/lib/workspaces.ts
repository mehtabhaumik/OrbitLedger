'use client';

import type { OrbitWorkspaceSummary } from '@orbit-ledger/contracts';
import { normalizeManualPaymentInstructionDetails, type ManualPaymentInstructionDetails } from '@orbit-ledger/core';
import {
  addDoc,
  collection,
  count,
  doc,
  type FieldValue,
  getAggregateFromServer,
  getDoc,
  getDocs,
  limit as limitQuery,
  query,
  runTransaction,
  serverTimestamp,
  sum,
  Timestamp,
  where,
} from 'firebase/firestore';

import { getWebFirestore } from './firebase';
import { buildAuditProtectedSettingsChanges } from './audit-protected-settings';
import { buildPaymentInstructionAuditChanges } from './payment-settings-hardening';

export type WorkspaceProfileInput = {
  businessName: string;
  legalName?: string | null;
  ownerName: string;
  contactPerson?: string | null;
  businessType?: string | null;
  phone: string;
  whatsapp?: string | null;
  email: string;
  website?: string | null;
  address: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  town?: string | null;
  postalCode?: string | null;
  gstin?: string | null;
  pan?: string | null;
  taxNumber?: string | null;
  registrationNumber?: string | null;
  placeOfSupply?: string | null;
  defaultTaxTreatment?: string | null;
  defaultPaymentTerms?: string | null;
  defaultDueDays?: number | null;
  defaultTaxRate?: number | null;
  defaultInvoiceTemplate?: string | null;
  defaultStatementTemplate?: string | null;
  defaultInvoiceNotes?: string | null;
  defaultRecurringEmailSubject?: string | null;
  defaultRecurringEmailBody?: string | null;
  defaultRecurringEmailIncludePaymentLink?: boolean | null;
  defaultRecurringEmailAttachPdf?: boolean | null;
  defaultRecurringEmailCurrentMonthOnly?: boolean | null;
  defaultRecurringEmailSendDayBehavior?: 'same_day' | 'custom_day' | null;
  defaultRecurringEmailDay?: number | null;
  documentFilenameFormat?: string | null;
  documentFooterPreference?: string | null;
  documentBrandHeaderColor?: string | null;
  documentBrandBackgroundColor?: string | null;
  documentBrandFontColor?: string | null;
  reminderStyle?: string | null;
  overdueAlertTiming?: string | null;
  followUpCadenceDays?: number | null;
  paymentNoticeTone?: string | null;
  urgentPaymentStampDefault?: boolean | null;
  backupReminderFrequency?: string | null;
  whatsappReminderTemplate?: string | null;
  emailReminderTemplate?: string | null;
  paymentThankYouTemplate?: string | null;
  bouncedPaymentTemplate?: string | null;
  defaultLanguage?: string | null;
  currency: string;
  countryCode: string;
  stateCode: string;
  logoUri?: string | null;
  documentWatermarkType?: 'none' | 'text' | 'logo' | 'image' | null;
  documentWatermarkText?: string | null;
  documentWatermarkImageUri?: string | null;
  documentWatermarkOpacity?: number | null;
  authorizedPersonName?: string | null;
  authorizedPersonTitle?: string | null;
  signatureUri?: string | null;
  paymentInstructions?: ManualPaymentInstructionDetails | null;
};

export type PaymentSettingsAuditInput = {
  actorUid: string;
  actorEmail?: string | null;
  reason?: string | null;
};

export type WorkspaceSettingsAuditInput = {
  actorUid: string;
  actorEmail?: string | null;
  reason?: string | null;
};

type FirestoreWorkspaceDoc = {
  business_name: string;
  legal_name?: string | null;
  owner_name: string;
  contact_person?: string | null;
  business_type?: string | null;
  phone: string;
  whatsapp?: string | null;
  email: string;
  website?: string | null;
  address: string;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  town?: string | null;
  postal_code?: string | null;
  gstin?: string | null;
  pan?: string | null;
  tax_number?: string | null;
  registration_number?: string | null;
  place_of_supply?: string | null;
  default_tax_treatment?: string | null;
  default_payment_terms?: string | null;
  default_due_days?: number | null;
  default_tax_rate?: number | null;
  default_invoice_template?: string | null;
  default_statement_template?: string | null;
  default_invoice_notes?: string | null;
  default_recurring_email_subject?: string | null;
  default_recurring_email_body?: string | null;
  default_recurring_email_include_payment_link?: boolean | null;
  default_recurring_email_attach_pdf?: boolean | null;
  default_recurring_email_current_month_only?: boolean | null;
  default_recurring_email_send_day_behavior?: 'same_day' | 'custom_day' | null;
  default_recurring_email_day?: number | null;
  document_filename_format?: string | null;
  document_footer_preference?: string | null;
  document_brand_header_color?: string | null;
  document_brand_background_color?: string | null;
  document_brand_font_color?: string | null;
  reminder_style?: string | null;
  overdue_alert_timing?: string | null;
  follow_up_cadence_days?: number | null;
  payment_notice_tone?: string | null;
  urgent_payment_stamp_default?: boolean | null;
  backup_reminder_frequency?: string | null;
  whatsapp_reminder_template?: string | null;
  email_reminder_template?: string | null;
  payment_thank_you_template?: string | null;
  bounced_payment_template?: string | null;
  default_language?: string | null;
  currency: string;
  country_code: string;
  state_code: string;
  logo_uri?: string | null;
  document_watermark_type?: 'none' | 'text' | 'logo' | 'image' | null;
  document_watermark_text?: string | null;
  document_watermark_image_uri?: string | null;
  document_watermark_opacity?: number | null;
  authorized_person_name?: string | null;
  authorized_person_title?: string | null;
  signature_uri?: string | null;
  payment_upi_id?: string | null;
  payment_page_url?: string | null;
  payment_note?: string | null;
  payment_bank_account_name?: string | null;
  payment_bank_name?: string | null;
  payment_bank_account_number?: string | null;
  payment_bank_ifsc?: string | null;
  payment_bank_branch?: string | null;
  payment_bank_routing_number?: string | null;
  payment_bank_sort_code?: string | null;
  payment_bank_iban?: string | null;
  payment_bank_swift?: string | null;
  owner_uid: string;
  owner_email?: string | null;
  data_state: 'profile_only' | 'full_dataset';
  created_at?: Timestamp | string | FieldValue;
  updated_at?: Timestamp | string | FieldValue;
  server_revision?: number;
};

export async function listWorkspacesForUser(userId: string): Promise<OrbitWorkspaceSummary[]> {
  const snapshot = await getDocs(
    query(collection(getWebFirestore(), 'workspaces'), where('owner_uid', '==', userId), limitQuery(10))
  );

  return snapshot.docs
    .map((entry) => mapWorkspace(entry.id, entry.data() as FirestoreWorkspaceDoc))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function createWorkspace(
  ownerId: string,
  ownerEmail: string | null,
  input: WorkspaceProfileInput
): Promise<OrbitWorkspaceSummary> {
  const createdIso = new Date().toISOString();
  const payload: FirestoreWorkspaceDoc = {
    business_name: input.businessName.trim(),
    ...workspaceProfileOptionalPayload(input),
    owner_name: input.ownerName.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    address: input.address.trim(),
    currency: input.currency.trim().toUpperCase(),
    country_code: input.countryCode.trim().toUpperCase(),
    state_code: input.stateCode.trim().toUpperCase(),
    logo_uri: input.logoUri ?? null,
    document_watermark_type: input.documentWatermarkType ?? 'none',
    document_watermark_text: input.documentWatermarkText ?? null,
    document_watermark_image_uri: input.documentWatermarkImageUri ?? null,
    document_watermark_opacity: normalizeWatermarkOpacity(input.documentWatermarkOpacity),
    authorized_person_name: input.authorizedPersonName?.trim() ?? '',
    authorized_person_title: input.authorizedPersonTitle?.trim() ?? '',
    signature_uri: input.signatureUri ?? null,
    ...paymentInstructionPayload(input.paymentInstructions),
    owner_uid: ownerId,
    owner_email: ownerEmail,
    data_state: 'profile_only',
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
    server_revision: 1,
  };

  const ref = await addDoc(collection(getWebFirestore(), 'workspaces'), payload);
  // Avoid a second immediate round trip after write to keep workspace creation responsive.
  return mapWorkspace(ref.id, {
    ...payload,
    created_at: createdIso,
    updated_at: createdIso,
  });
}

export async function updateWorkspaceProfile(
  workspaceId: string,
  expectedRevision: number,
  input: WorkspaceProfileInput
): Promise<OrbitWorkspaceSummary> {
  const firestore = getWebFirestore();
  const workspaceRef = doc(firestore, 'workspaces', workspaceId);

  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(workspaceRef);
    const current = snapshot.data() as FirestoreWorkspaceDoc | undefined;
    const currentRevision = current?.server_revision ?? 0;

    if (currentRevision !== expectedRevision) {
      throw new Error('Workspace was changed elsewhere. Refresh before saving again.');
    }

    transaction.update(workspaceRef, {
      business_name: input.businessName.trim(),
      ...workspaceProfileOptionalPayload(input),
      owner_name: input.ownerName.trim(),
      phone: input.phone.trim(),
      email: input.email.trim(),
      address: input.address.trim(),
      currency: input.currency.trim().toUpperCase(),
      country_code: input.countryCode.trim().toUpperCase(),
      state_code: input.stateCode.trim().toUpperCase(),
      logo_uri: input.logoUri ?? null,
      document_watermark_type: input.documentWatermarkType ?? 'none',
      document_watermark_text: input.documentWatermarkText ?? null,
      document_watermark_image_uri: input.documentWatermarkImageUri ?? null,
      document_watermark_opacity: normalizeWatermarkOpacity(input.documentWatermarkOpacity),
      authorized_person_name: input.authorizedPersonName?.trim() ?? '',
      authorized_person_title: input.authorizedPersonTitle?.trim() ?? '',
      signature_uri: input.signatureUri ?? null,
      ...paymentInstructionPayload(input.paymentInstructions),
      updated_at: serverTimestamp(),
      server_revision: currentRevision + 1,
    });
  });

  const next = await getDoc(workspaceRef);
  return mapWorkspace(next.id, next.data() as FirestoreWorkspaceDoc);
}

export async function updateWorkspaceProfileAudited(
  workspaceId: string,
  expectedRevision: number,
  input: WorkspaceProfileInput,
  audit: WorkspaceSettingsAuditInput
): Promise<OrbitWorkspaceSummary> {
  const firestore = getWebFirestore();
  const workspaceRef = doc(firestore, 'workspaces', workspaceId);

  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(workspaceRef);
    const current = snapshot.data() as FirestoreWorkspaceDoc | undefined;
    const currentRevision = current?.server_revision ?? 0;

    if (!current) {
      throw new Error('Workspace could not be found.');
    }
    if (currentRevision !== expectedRevision) {
      throw new Error('Workspace was changed elsewhere. Refresh before saving again.');
    }

    const changes = buildAuditProtectedSettingsChanges(workspaceAuditSourceFromDoc(current), input);
    const nextRevision = currentRevision + 1;

    transaction.update(workspaceRef, {
      business_name: input.businessName.trim(),
      ...workspaceProfileOptionalPayload(input),
      owner_name: input.ownerName.trim(),
      phone: input.phone.trim(),
      email: input.email.trim(),
      address: input.address.trim(),
      currency: input.currency.trim().toUpperCase(),
      country_code: input.countryCode.trim().toUpperCase(),
      state_code: input.stateCode.trim().toUpperCase(),
      logo_uri: input.logoUri ?? null,
      document_watermark_type: input.documentWatermarkType ?? 'none',
      document_watermark_text: input.documentWatermarkText ?? null,
      document_watermark_image_uri: input.documentWatermarkImageUri ?? null,
      document_watermark_opacity: normalizeWatermarkOpacity(input.documentWatermarkOpacity),
      authorized_person_name: input.authorizedPersonName?.trim() ?? '',
      authorized_person_title: input.authorizedPersonTitle?.trim() ?? '',
      signature_uri: input.signatureUri ?? null,
      ...paymentInstructionPayload(input.paymentInstructions),
      updated_at: serverTimestamp(),
      server_revision: nextRevision,
    });

    if (changes.length) {
      const auditRef = doc(collection(firestore, 'workspaces', workspaceId, 'settings_audit'));
      transaction.set(auditRef, {
        workspace_id: workspaceId,
        scope: 'company_settings',
        setting_group: 'audit_protected_settings',
        action: 'updated',
        actor_uid: audit.actorUid,
        actor_email: audit.actorEmail ?? null,
        reason: audit.reason?.trim() || 'Protected settings updated',
        changed_fields: changes.map((change) => change.label),
        changes: changes.map((change) => ({
          field: change.field,
          label: change.label,
          previous_value: change.maskedPreviousValue,
          next_value: change.maskedNextValue,
        })),
        server_revision_before: currentRevision,
        server_revision_after: nextRevision,
        created_at: serverTimestamp(),
      });
    }
  });

  const next = await getDoc(workspaceRef);
  return mapWorkspace(next.id, next.data() as FirestoreWorkspaceDoc);
}

export async function updateWorkspacePaymentInstructionsAudited(
  workspaceId: string,
  expectedRevision: number,
  input: WorkspaceProfileInput,
  audit: PaymentSettingsAuditInput
): Promise<OrbitWorkspaceSummary> {
  const firestore = getWebFirestore();
  const workspaceRef = doc(firestore, 'workspaces', workspaceId);

  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(workspaceRef);
    const current = snapshot.data() as FirestoreWorkspaceDoc | undefined;
    const currentRevision = current?.server_revision ?? 0;

    if (!current) {
      throw new Error('Workspace could not be found.');
    }
    if (currentRevision !== expectedRevision) {
      throw new Error('Workspace was changed elsewhere. Refresh before saving again.');
    }

    const changes = buildPaymentInstructionAuditChanges(
      paymentInstructionsFromWorkspaceDoc(current),
      input.paymentInstructions
    );
    const nextRevision = currentRevision + 1;

    transaction.update(workspaceRef, {
      business_name: input.businessName.trim(),
      ...workspaceProfileOptionalPayload(input),
      owner_name: input.ownerName.trim(),
      phone: input.phone.trim(),
      email: input.email.trim(),
      address: input.address.trim(),
      currency: input.currency.trim().toUpperCase(),
      country_code: input.countryCode.trim().toUpperCase(),
      state_code: input.stateCode.trim().toUpperCase(),
      logo_uri: input.logoUri ?? null,
      document_watermark_type: input.documentWatermarkType ?? 'none',
      document_watermark_text: input.documentWatermarkText ?? null,
      document_watermark_image_uri: input.documentWatermarkImageUri ?? null,
      document_watermark_opacity: normalizeWatermarkOpacity(input.documentWatermarkOpacity),
      authorized_person_name: input.authorizedPersonName?.trim() ?? '',
      authorized_person_title: input.authorizedPersonTitle?.trim() ?? '',
      signature_uri: input.signatureUri ?? null,
      ...paymentInstructionPayload(input.paymentInstructions),
      updated_at: serverTimestamp(),
      server_revision: nextRevision,
    });

    if (changes.length) {
      const auditRef = doc(collection(firestore, 'workspaces', workspaceId, 'settings_audit'));
      transaction.set(auditRef, {
        workspace_id: workspaceId,
        scope: 'payment_settings',
        setting_group: 'manual_payment_instructions',
        action: 'updated',
        actor_uid: audit.actorUid,
        actor_email: audit.actorEmail ?? null,
        reason: audit.reason?.trim() || 'Payment details updated',
        changed_fields: changes.map((change) => change.label),
        changes: changes.map((change) => ({
          field: change.field,
          label: change.label,
          previous_value: change.maskedPreviousValue,
          next_value: change.maskedNextValue,
        })),
        server_revision_before: currentRevision,
        server_revision_after: nextRevision,
        created_at: serverTimestamp(),
      });
    }
  });

  const next = await getDoc(workspaceRef);
  return mapWorkspace(next.id, next.data() as FirestoreWorkspaceDoc);
}

type DashboardSnapshot = {
  receivableTotal: number;
  customerCount: number;
  invoiceCount: number;
  recentPayments: number;
};

export async function loadWorkspaceDashboardSnapshot(workspaceId: string): Promise<DashboardSnapshot> {
  const firestore = getWebFirestore();
  const customersRef = collection(firestore, 'workspaces', workspaceId, 'customers');
  const invoicesRef = collection(firestore, 'workspaces', workspaceId, 'invoices');
  const transactionsRef = collection(firestore, 'workspaces', workspaceId, 'transactions');

  try {
    const [customersAggregate, invoicesAggregate, paymentAggregate] = await Promise.all([
      getAggregateFromServer(customersRef, {
        customerCount: count(),
        receivableTotal: sum('current_balance'),
      }),
      getAggregateFromServer(invoicesRef, {
        invoiceCount: count(),
      }),
      getAggregateFromServer(query(transactionsRef, where('type', '==', 'payment')), {
        total: sum('amount'),
      }),
    ]);

    const customerData = customersAggregate.data();
    const invoiceData = invoicesAggregate.data();
    const paymentData = paymentAggregate.data();
    const snapshot = {
      receivableTotal: safeAggregateNumber(customerData.receivableTotal),
      customerCount: safeAggregateNumber(customerData.customerCount),
      invoiceCount: safeAggregateNumber(invoiceData.invoiceCount),
      recentPayments: safeAggregateNumber(paymentData.total),
    };

    if (
      snapshot.receivableTotal === 0 &&
      snapshot.customerCount === 0 &&
      snapshot.invoiceCount === 0 &&
      snapshot.recentPayments === 0
    ) {
      return loadDashboardFallbackSnapshot(customersRef, invoicesRef, transactionsRef);
    }

    return snapshot;
  } catch {
    return loadDashboardFallbackSnapshot(customersRef, invoicesRef, transactionsRef);
  }
}

async function loadDashboardFallbackSnapshot(
  customersRef: ReturnType<typeof collection>,
  invoicesRef: ReturnType<typeof collection>,
  transactionsRef: ReturnType<typeof collection>
): Promise<DashboardSnapshot> {
  const [customersSnapshot, invoicesSnapshot, paymentsSnapshot] = await Promise.all([
    getDocs(query(customersRef, limitQuery(500))),
    getDocs(query(invoicesRef, limitQuery(500))),
    getDocs(query(transactionsRef, where('type', '==', 'payment'), limitQuery(500))),
  ]);

  return {
    receivableTotal: customersSnapshot.docs.reduce((total, entry) => {
      const data = entry.data() as { current_balance?: number; opening_balance?: number; balance?: number };
      const balance =
        typeof data.current_balance === 'number'
          ? data.current_balance
          : typeof data.balance === 'number'
            ? data.balance
            : typeof data.opening_balance === 'number'
              ? data.opening_balance
              : 0;
      return total + balance;
    }, 0),
    customerCount: customersSnapshot.size,
    invoiceCount: invoicesSnapshot.size,
    recentPayments: paymentsSnapshot.docs.reduce((total, entry) => {
      const data = entry.data() as { amount?: number };
      return total + (typeof data.amount === 'number' ? data.amount : 0);
    }, 0),
  };
}

function safeAggregateNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function mapWorkspace(id: string, data: FirestoreWorkspaceDoc): OrbitWorkspaceSummary {
  return {
    workspaceId: id,
    businessName: data.business_name ?? '',
    legalName: data.legal_name ?? null,
    ownerName: data.owner_name ?? '',
    contactPerson: data.contact_person ?? null,
    businessType: data.business_type ?? null,
    phone: data.phone ?? '',
    whatsapp: data.whatsapp ?? null,
    email: data.email ?? '',
    website: data.website ?? null,
    address: data.address ?? '',
    addressLine1: data.address_line_1 ?? null,
    addressLine2: data.address_line_2 ?? null,
    city: data.city ?? null,
    town: data.town ?? null,
    postalCode: data.postal_code ?? null,
    gstin: data.gstin ?? null,
    pan: data.pan ?? null,
    taxNumber: data.tax_number ?? null,
    registrationNumber: data.registration_number ?? null,
    placeOfSupply: data.place_of_supply ?? null,
    defaultTaxTreatment: data.default_tax_treatment ?? null,
    defaultPaymentTerms: data.default_payment_terms ?? null,
    defaultDueDays: typeof data.default_due_days === 'number' ? data.default_due_days : null,
    defaultTaxRate: typeof data.default_tax_rate === 'number' ? data.default_tax_rate : null,
    defaultInvoiceTemplate: data.default_invoice_template ?? null,
    defaultStatementTemplate: data.default_statement_template ?? null,
    defaultInvoiceNotes: data.default_invoice_notes ?? null,
    defaultRecurringEmailSubject: data.default_recurring_email_subject ?? null,
    defaultRecurringEmailBody: data.default_recurring_email_body ?? null,
    defaultRecurringEmailIncludePaymentLink:
      typeof data.default_recurring_email_include_payment_link === 'boolean'
        ? data.default_recurring_email_include_payment_link
        : null,
    defaultRecurringEmailAttachPdf:
      typeof data.default_recurring_email_attach_pdf === 'boolean'
        ? data.default_recurring_email_attach_pdf
        : null,
    defaultRecurringEmailCurrentMonthOnly:
      typeof data.default_recurring_email_current_month_only === 'boolean'
        ? data.default_recurring_email_current_month_only
        : null,
    defaultRecurringEmailSendDayBehavior:
      data.default_recurring_email_send_day_behavior === 'custom_day'
        ? 'custom_day'
        : data.default_recurring_email_send_day_behavior === 'same_day'
          ? 'same_day'
          : null,
    defaultRecurringEmailDay:
      typeof data.default_recurring_email_day === 'number'
        ? Math.min(31, Math.max(1, Math.floor(data.default_recurring_email_day)))
        : null,
    documentFilenameFormat: data.document_filename_format ?? null,
    documentFooterPreference: data.document_footer_preference ?? null,
    documentBrandHeaderColor: data.document_brand_header_color ?? null,
    documentBrandBackgroundColor: data.document_brand_background_color ?? null,
    documentBrandFontColor: data.document_brand_font_color ?? null,
    reminderStyle: data.reminder_style ?? null,
    overdueAlertTiming: data.overdue_alert_timing ?? null,
    followUpCadenceDays: typeof data.follow_up_cadence_days === 'number' ? data.follow_up_cadence_days : null,
    paymentNoticeTone: data.payment_notice_tone ?? null,
    urgentPaymentStampDefault: typeof data.urgent_payment_stamp_default === 'boolean' ? data.urgent_payment_stamp_default : null,
    backupReminderFrequency: data.backup_reminder_frequency ?? null,
    whatsappReminderTemplate: data.whatsapp_reminder_template ?? null,
    emailReminderTemplate: data.email_reminder_template ?? null,
    paymentThankYouTemplate: data.payment_thank_you_template ?? null,
    bouncedPaymentTemplate: data.bounced_payment_template ?? null,
    defaultLanguage: data.default_language ?? null,
    currency: data.currency ?? 'INR',
    countryCode: data.country_code ?? 'IN',
    stateCode: data.state_code ?? '',
    logoUri: data.logo_uri ?? null,
    documentWatermarkType: data.document_watermark_type ?? 'none',
    documentWatermarkText: data.document_watermark_text ?? null,
    documentWatermarkImageUri: data.document_watermark_image_uri ?? null,
    documentWatermarkOpacity: typeof data.document_watermark_opacity === 'number' ? data.document_watermark_opacity : null,
    authorizedPersonName: data.authorized_person_name ?? '',
    authorizedPersonTitle: data.authorized_person_title ?? '',
    signatureUri: data.signature_uri ?? null,
    paymentInstructions: normalizeManualPaymentInstructionDetails({
      upiId: data.payment_upi_id,
      paymentPageUrl: data.payment_page_url,
      paymentNote: data.payment_note,
      bankAccountName: data.payment_bank_account_name,
      bankName: data.payment_bank_name,
      bankAccountNumber: data.payment_bank_account_number,
      bankIfsc: data.payment_bank_ifsc,
      bankBranch: data.payment_bank_branch,
      bankRoutingNumber: data.payment_bank_routing_number,
      bankSortCode: data.payment_bank_sort_code,
      bankIban: data.payment_bank_iban,
      bankSwift: data.payment_bank_swift,
    }),
    createdAt: toIsoString(data.created_at),
    updatedAt: toIsoString(data.updated_at),
    serverRevision: data.server_revision ?? 0,
    dataState: data.data_state ?? 'profile_only',
  };
}

function workspaceProfileOptionalPayload(input: WorkspaceProfileInput) {
  return {
    legal_name: cleanOptional(input.legalName),
    contact_person: cleanOptional(input.contactPerson),
    business_type: cleanOptional(input.businessType),
    whatsapp: cleanOptional(input.whatsapp),
    website: cleanOptional(input.website),
    address_line_1: cleanOptional(input.addressLine1),
    address_line_2: cleanOptional(input.addressLine2),
    city: cleanOptional(input.city),
    town: cleanOptional(input.town),
    postal_code: cleanOptional(input.postalCode),
    gstin: cleanOptional(input.gstin)?.toUpperCase() ?? null,
    pan: cleanOptional(input.pan)?.toUpperCase() ?? null,
    tax_number: cleanOptional(input.taxNumber),
    registration_number: cleanOptional(input.registrationNumber),
    place_of_supply: cleanOptional(input.placeOfSupply),
    default_tax_treatment: cleanOptional(input.defaultTaxTreatment),
    default_payment_terms: cleanOptional(input.defaultPaymentTerms),
    default_due_days:
      typeof input.defaultDueDays === 'number' && Number.isFinite(input.defaultDueDays)
        ? Math.max(0, Math.floor(input.defaultDueDays))
        : null,
    default_tax_rate:
      typeof input.defaultTaxRate === 'number' && Number.isFinite(input.defaultTaxRate)
        ? Math.max(0, input.defaultTaxRate)
        : null,
    default_invoice_template: cleanOptional(input.defaultInvoiceTemplate),
    default_statement_template: cleanOptional(input.defaultStatementTemplate),
    default_invoice_notes: cleanOptional(input.defaultInvoiceNotes),
    default_recurring_email_subject: cleanOptional(input.defaultRecurringEmailSubject),
    default_recurring_email_body: cleanOptional(input.defaultRecurringEmailBody),
    default_recurring_email_include_payment_link:
      input.defaultRecurringEmailIncludePaymentLink === null || input.defaultRecurringEmailIncludePaymentLink === undefined
        ? true
        : Boolean(input.defaultRecurringEmailIncludePaymentLink),
    default_recurring_email_attach_pdf:
      input.defaultRecurringEmailAttachPdf === null || input.defaultRecurringEmailAttachPdf === undefined
        ? true
        : Boolean(input.defaultRecurringEmailAttachPdf),
    default_recurring_email_current_month_only:
      input.defaultRecurringEmailCurrentMonthOnly === null || input.defaultRecurringEmailCurrentMonthOnly === undefined
        ? true
        : Boolean(input.defaultRecurringEmailCurrentMonthOnly),
    default_recurring_email_send_day_behavior: normalizeChoice(
      input.defaultRecurringEmailSendDayBehavior,
      ['same_day', 'custom_day'],
      'same_day'
    ),
    default_recurring_email_day:
      typeof input.defaultRecurringEmailDay === 'number' && Number.isFinite(input.defaultRecurringEmailDay)
        ? Math.min(31, Math.max(1, Math.floor(input.defaultRecurringEmailDay)))
        : null,
    document_filename_format: normalizeDocumentFilenameFormat(input.documentFilenameFormat),
    document_footer_preference: normalizeDocumentFooterPreference(input.documentFooterPreference),
    document_brand_header_color: normalizeHexColor(input.documentBrandHeaderColor),
    document_brand_background_color: normalizeHexColor(input.documentBrandBackgroundColor),
    document_brand_font_color: normalizeHexColor(input.documentBrandFontColor),
    reminder_style: normalizeChoice(input.reminderStyle, ['soft', 'firm', 'urgent'], 'soft'),
    overdue_alert_timing: normalizeChoice(input.overdueAlertTiming, ['same_day', 'one_day_after', 'three_days_after', 'one_week_after'], 'one_day_after'),
    follow_up_cadence_days:
      typeof input.followUpCadenceDays === 'number' && Number.isFinite(input.followUpCadenceDays)
        ? Math.min(90, Math.max(1, Math.floor(input.followUpCadenceDays)))
        : 7,
    payment_notice_tone: normalizeChoice(input.paymentNoticeTone, ['friendly', 'direct', 'urgent'], 'friendly'),
    urgent_payment_stamp_default: Boolean(input.urgentPaymentStampDefault),
    backup_reminder_frequency: normalizeChoice(input.backupReminderFrequency, ['off', 'daily', 'weekly', 'monthly'], 'weekly'),
    whatsapp_reminder_template: cleanOptional(input.whatsappReminderTemplate),
    email_reminder_template: cleanOptional(input.emailReminderTemplate),
    payment_thank_you_template: cleanOptional(input.paymentThankYouTemplate),
    bounced_payment_template: cleanOptional(input.bouncedPaymentTemplate),
    default_language: cleanOptional(input.defaultLanguage),
  };
}

function paymentInstructionPayload(details?: ManualPaymentInstructionDetails | null) {
  const normalized = normalizeManualPaymentInstructionDetails(details);
  return {
    payment_upi_id: normalized.upiId,
    payment_page_url: normalized.paymentPageUrl,
    payment_note: normalized.paymentNote,
    payment_bank_account_name: normalized.bankAccountName,
    payment_bank_name: normalized.bankName,
    payment_bank_account_number: normalized.bankAccountNumber,
    payment_bank_ifsc: normalized.bankIfsc,
    payment_bank_branch: normalized.bankBranch,
    payment_bank_routing_number: normalized.bankRoutingNumber,
    payment_bank_sort_code: normalized.bankSortCode,
    payment_bank_iban: normalized.bankIban,
    payment_bank_swift: normalized.bankSwift,
  };
}

function paymentInstructionsFromWorkspaceDoc(data: FirestoreWorkspaceDoc): ManualPaymentInstructionDetails {
  return normalizeManualPaymentInstructionDetails({
    upiId: data.payment_upi_id,
    paymentPageUrl: data.payment_page_url,
    paymentNote: data.payment_note,
    bankAccountName: data.payment_bank_account_name,
    bankName: data.payment_bank_name,
    bankAccountNumber: data.payment_bank_account_number,
    bankIfsc: data.payment_bank_ifsc,
    bankBranch: data.payment_bank_branch,
    bankRoutingNumber: data.payment_bank_routing_number,
    bankSortCode: data.payment_bank_sort_code,
    bankIban: data.payment_bank_iban,
    bankSwift: data.payment_bank_swift,
  });
}

function workspaceAuditSourceFromDoc(data: FirestoreWorkspaceDoc) {
  return {
    businessName: data.business_name,
    legalName: data.legal_name,
    gstin: data.gstin,
    pan: data.pan,
    taxNumber: data.tax_number,
    registrationNumber: data.registration_number,
    placeOfSupply: data.place_of_supply,
    stateCode: data.state_code,
    defaultTaxTreatment: data.default_tax_treatment,
    defaultPaymentTerms: data.default_payment_terms,
    defaultDueDays: data.default_due_days,
    defaultTaxRate: data.default_tax_rate,
    defaultInvoiceTemplate: data.default_invoice_template,
    defaultStatementTemplate: data.default_statement_template,
    documentFilenameFormat: data.document_filename_format,
    authorizedPersonName: data.authorized_person_name,
    authorizedPersonTitle: data.authorized_person_title,
    signatureUri: data.signature_uri,
  };
}

function cleanOptional(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeDocumentFilenameFormat(value?: string | null) {
  const normalized = value?.trim();
  return [
    'customer_invoice_date_revision_country',
    'invoice_customer_date',
    'date_customer_invoice',
  ].includes(normalized ?? '')
    ? normalized
    : 'customer_invoice_date_revision_country';
}

function normalizeDocumentFooterPreference(value?: string | null) {
  const normalized = value?.trim();
  return ['auto', 'always_show', 'hide_when_pro'].includes(normalized ?? '') ? normalized : 'auto';
}

function normalizeChoice<T extends string>(value: string | null | undefined, allowed: readonly T[], fallback: T): T {
  const normalized = value?.trim();
  return allowed.includes(normalized as T) ? (normalized as T) : fallback;
}

function normalizeHexColor(value?: string | null) {
  const normalized = value?.trim();
  return normalized && /^#[0-9a-f]{6}$/i.test(normalized) ? normalized.toUpperCase() : null;
}

function normalizeWatermarkOpacity(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return Math.min(0.3, Math.max(0.02, value));
}

function toIsoString(value: Timestamp | string | FieldValue | undefined): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (typeof value === 'string') {
    return value;
  }

  return new Date().toISOString();
}
