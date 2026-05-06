import {
  collection,
  doc,
  getDocs,
  getFirestore,
  limit,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import { getFirebaseApp } from '../cloud/firebase';

export type MobileRecurringInvoiceStatus = 'active' | 'cancelled';

export type MobileRecurringInvoiceItem = {
  id: string;
  productId: string | null;
  name: string;
  description: string | null;
  quantity: number;
  price: number;
  taxRate: number;
  total: number;
};

export type MobileRecurringInvoiceRule = {
  id: string;
  name: string;
  customerId: string;
  customerName: string | null;
  startDate: string;
  endDate: string | null;
  invoiceDay: number;
  nextRunDate: string;
  dueDays: number;
  invoiceNumberPrefix: string;
  notes: string | null;
  emailEnabled: boolean;
  emailRecipient: string | null;
  emailDay: number | null;
  emailSubject: string | null;
  emailBody: string | null;
  emailIncludePaymentLink: boolean;
  emailAttachPdf: boolean;
  emailCurrentMonthOnly: boolean;
  emailAutomationApproved: boolean;
  emailAutomationApprovedAt: string | null;
  emailApprovalSummary: string | null;
  emailApprovalRequired: boolean;
  lastSettingsChangedAt: string | null;
  nextEmailDate: string | null;
  status: MobileRecurringInvoiceStatus;
  items: MobileRecurringInvoiceItem[];
  lastCreatedInvoiceId: string | null;
  lastCreatedRunDate: string | null;
  createdAt: string | null;
  lastModified: string | null;
};

export type MobileRecurringEmailQueueItem = {
  id: string;
  status: string;
  scheduledFor: string | null;
  sentAt: string | null;
  recipientEmail: string | null;
  subject: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  customerId: string | null;
  recurringRuleId: string | null;
  includePaymentLink: boolean;
  attachPdf: boolean;
  lastError: string | null;
};

export type SaveMobileRecurringInvoiceRuleInput = {
  name: string;
  customerId: string;
  customerName?: string | null;
  startDate: string;
  endDate?: string | null;
  invoiceDay: number;
  dueDays?: number | null;
  invoiceNumberPrefix?: string | null;
  notes?: string | null;
  emailEnabled?: boolean;
  emailRecipient?: string | null;
  emailDay?: number | null;
  emailSubject?: string | null;
  emailBody?: string | null;
  emailIncludePaymentLink?: boolean;
  emailAttachPdf?: boolean;
  emailCurrentMonthOnly?: boolean;
  approveEmailAutomation?: boolean;
  items: Array<{
    id?: string;
    productId?: string | null;
    name: string;
    description?: string | null;
    quantity: number;
    price: number;
    taxRate: number;
  }>;
};

export async function listMobileRecurringInvoiceRules(
  workspaceId: string
): Promise<MobileRecurringInvoiceRule[]> {
  const snapshot = await getDocs(
    query(collection(getFirestore(getFirebaseApp()), 'workspaces', workspaceId, 'recurring_invoice_rules'), limit(100))
  );
  return snapshot.docs
    .map(mapRecurringRule)
    .sort((left, right) => {
      const leftDate = left.nextEmailDate ?? left.nextRunDate ?? '';
      const rightDate = right.nextEmailDate ?? right.nextRunDate ?? '';
      return leftDate.localeCompare(rightDate);
    });
}

export async function listMobileRecurringEmailQueue(
  workspaceId: string
): Promise<MobileRecurringEmailQueueItem[]> {
  const snapshot = await getDocs(
    query(collection(getFirestore(getFirebaseApp()), 'workspaces', workspaceId, 'email_queue'), limit(100))
  );
  return snapshot.docs
    .filter((entry) => stringValue(entry.data().kind, '') === 'recurring_invoice')
    .map(mapRecurringEmailQueueItem)
    .sort((left, right) => (right.scheduledFor ?? '').localeCompare(left.scheduledFor ?? ''));
}

export async function saveMobileRecurringInvoiceRule(
  workspaceId: string,
  input: SaveMobileRecurringInvoiceRuleInput,
  ruleId?: string
): Promise<MobileRecurringInvoiceRule> {
  const now = new Date().toISOString();
  const payload = buildRecurringRulePayload(input, now);
  const ruleRef = ruleId
    ? doc(getFirestore(getFirebaseApp()), 'workspaces', workspaceId, 'recurring_invoice_rules', ruleId)
    : doc(collection(getFirestore(getFirebaseApp()), 'workspaces', workspaceId, 'recurring_invoice_rules'));

  if (ruleId) {
    await updateDoc(ruleRef, {
      ...payload,
      status: 'active',
      last_modified: now,
    });
  } else {
    await setDoc(ruleRef, {
      ...payload,
      status: 'active',
      created_at: now,
      last_modified: now,
      sync_status: 'synced',
      server_revision: 1,
    });
  }

  return {
    id: ruleRef.id,
    ...mapRecurringRuleData(ruleRef.id, {
      ...payload,
      status: 'active',
      created_at: ruleId ? null : now,
      last_modified: now,
    }),
  };
}

export async function pauseMobileRecurringInvoiceRule(
  workspaceId: string,
  ruleId: string
): Promise<void> {
  await updateDoc(
    doc(getFirestore(getFirebaseApp()), 'workspaces', workspaceId, 'recurring_invoice_rules', ruleId),
    {
      status: 'cancelled',
      last_modified: new Date().toISOString(),
    }
  );
}

export function defaultMobileRecurringEmailSubject(): string {
  return 'Invoice {{invoiceNumber}} from {{businessName}}';
}

export function defaultMobileRecurringEmailBody(): string {
  return [
    'Hello {{customerName}},',
    '',
    'Your monthly invoice {{invoiceNumber}} is attached.',
    '',
    'You can pay here:',
    '{{paymentLink}}',
    '',
    'Thank you,',
    '{{businessName}}',
  ].join('\n');
}

function buildRecurringRulePayload(input: SaveMobileRecurringInvoiceRuleInput, now: string) {
  const name = input.name.trim();
  const customerId = input.customerId.trim();
  const startDate = input.startDate.trim();
  const endDate = input.endDate?.trim() || null;
  const invoiceDay = clampMonthlyDay(input.invoiceDay);
  const dueDays = Math.max(0, Math.floor(Number(input.dueDays ?? 7)));
  const invoiceNumberPrefix = cleanInvoicePrefix(input.invoiceNumberPrefix);
  const items = input.items.map(normalizeRecurringItem).filter((item) => item.name && item.quantity > 0 && item.price >= 0);
  const emailEnabled = Boolean(input.emailEnabled);
  const emailRecipient = input.emailRecipient?.trim() || null;
  const emailDay = input.emailDay ? clampMonthlyDay(input.emailDay) : invoiceDay;
  const emailAutomationApproved = Boolean(input.approveEmailAutomation && emailEnabled);

  if (!name) {
    throw new Error('Add a name for this monthly rule.');
  }
  if (!customerId) {
    throw new Error('Choose the customer for this monthly rule.');
  }
  if (!isValidDateString(startDate)) {
    throw new Error('Choose a valid start date.');
  }
  if (endDate && (!isValidDateString(endDate) || endDate < startDate)) {
    throw new Error('End date must be after the start date.');
  }
  if (!items.length) {
    throw new Error('Add at least one line item for the monthly invoice.');
  }
  if (emailEnabled && !isValidEmail(emailRecipient)) {
    throw new Error('Add a valid recipient email.');
  }

  const firstInvoiceDate = getFirstRecurringRunDate(startDate, invoiceDay);
  const firstEmailDate = emailEnabled ? getFirstRecurringRunDate(startDate, emailDay) : null;
  const firstPreparationDate = firstEmailDate ? subtractDays(firstEmailDate, 3) : firstInvoiceDate;

  return {
    name,
    customer_id: customerId,
    customer_name: input.customerName?.trim() || null,
    start_date: startDate,
    end_date: endDate,
    invoice_day: invoiceDay,
    next_run_date: firstPreparationDate < startDate ? startDate : firstPreparationDate,
    due_days: dueDays,
    invoice_number_prefix: invoiceNumberPrefix,
    notes: input.notes?.trim() || null,
    email_enabled: emailEnabled,
    email_recipient: emailEnabled ? emailRecipient : null,
    email_day: emailEnabled ? emailDay : null,
    next_email_date: firstEmailDate,
    email_subject: emailEnabled ? input.emailSubject?.trim() || defaultMobileRecurringEmailSubject() : null,
    email_body: emailEnabled ? input.emailBody?.trim() || defaultMobileRecurringEmailBody() : null,
    email_include_payment_link: input.emailIncludePaymentLink !== false,
    email_attach_pdf: input.emailAttachPdf !== false,
    email_current_month_only: input.emailCurrentMonthOnly !== false,
    email_automation_approved: emailAutomationApproved,
    email_automation_approved_at: emailAutomationApproved ? now : null,
    email_approval_summary: emailAutomationApproved ? 'Approved automatic monthly invoice email.' : null,
    email_approval_required: emailEnabled && !emailAutomationApproved,
    last_settings_changed_at: now,
    items,
    sync_status: 'synced',
  };
}

function normalizeRecurringItem(
  item: SaveMobileRecurringInvoiceRuleInput['items'][number]
): MobileRecurringInvoiceItem {
  const quantity = finiteNumber(item.quantity);
  const price = finiteNumber(item.price);
  const taxRate = finiteNumber(item.taxRate);
  const taxable = quantity * price;
  return {
    id: item.id?.trim() || `line_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    productId: item.productId?.trim() || null,
    name: item.name.trim(),
    description: item.description?.trim() || null,
    quantity,
    price,
    taxRate,
    total: roundMoney(taxable + taxable * (taxRate / 100)),
  };
}

function mapRecurringRule(entry: { id: string; data(): Record<string, unknown> }): MobileRecurringInvoiceRule {
  return {
    id: entry.id,
    ...mapRecurringRuleData(entry.id, entry.data()),
  };
}

function mapRecurringRuleData(_id: string, data: Record<string, unknown>): Omit<MobileRecurringInvoiceRule, 'id'> {
  return {
    name: stringValue(data.name, 'Monthly invoice'),
    customerId: stringValue(data.customer_id, ''),
    customerName: nullableString(data.customer_name),
    startDate: stringValue(data.start_date, ''),
    endDate: nullableString(data.end_date),
    invoiceDay: numberValue(data.invoice_day, 1),
    nextRunDate: stringValue(data.next_run_date, ''),
    dueDays: numberValue(data.due_days, 7),
    invoiceNumberPrefix: stringValue(data.invoice_number_prefix, 'AUTO'),
    notes: nullableString(data.notes),
    emailEnabled: Boolean(data.email_enabled),
    emailRecipient: nullableString(data.email_recipient),
    emailDay: nullableNumber(data.email_day),
    emailSubject: nullableString(data.email_subject),
    emailBody: nullableString(data.email_body),
    emailIncludePaymentLink: data.email_include_payment_link !== false,
    emailAttachPdf: data.email_attach_pdf !== false,
    emailCurrentMonthOnly: data.email_current_month_only !== false,
    emailAutomationApproved: Boolean(data.email_automation_approved),
    emailAutomationApprovedAt: nullableString(data.email_automation_approved_at),
    emailApprovalSummary: nullableString(data.email_approval_summary),
    emailApprovalRequired: Boolean(data.email_approval_required),
    lastSettingsChangedAt: nullableString(data.last_settings_changed_at),
    nextEmailDate: nullableString(data.next_email_date),
    status: data.status === 'cancelled' ? 'cancelled' : 'active',
    items: Array.isArray(data.items) ? data.items.map((item) => mapRecurringItem(item)).filter(Boolean) : [],
    lastCreatedInvoiceId: nullableString(data.last_created_invoice_id),
    lastCreatedRunDate: nullableString(data.last_created_run_date),
    createdAt: nullableString(data.created_at),
    lastModified: nullableString(data.last_modified),
  };
}

function mapRecurringItem(value: unknown): MobileRecurringInvoiceItem {
  const item = isRecord(value) ? value : {};
  return {
    id: stringValue(item.id, `line_${Math.random().toString(36).slice(2, 8)}`),
    productId: nullableString(item.productId ?? item.product_id),
    name: stringValue(item.name, ''),
    description: nullableString(item.description),
    quantity: numberValue(item.quantity, 0),
    price: numberValue(item.price, 0),
    taxRate: numberValue(item.taxRate ?? item.tax_rate, 0),
    total: numberValue(item.total, 0),
  };
}

function mapRecurringEmailQueueItem(entry: { id: string; data(): Record<string, unknown> }): MobileRecurringEmailQueueItem {
  const data = entry.data();
  return {
    id: entry.id,
    status: stringValue(data.status, 'scheduled'),
    scheduledFor: nullableString(data.scheduled_for),
    sentAt: nullableString(data.sent_at),
    recipientEmail: nullableString(data.recipient_email),
    subject: nullableString(data.subject),
    invoiceId: nullableString(data.invoice_id),
    invoiceNumber: nullableString(data.invoice_number),
    customerId: nullableString(data.customer_id),
    recurringRuleId: nullableString(data.recurring_rule_id),
    includePaymentLink: Boolean(data.include_payment_link),
    attachPdf: data.attachment === 'invoice_pdf',
    lastError: nullableString(data.last_error),
  };
}

function getFirstRecurringRunDate(startDate: string, day: number): string {
  const month = startDate.slice(0, 7);
  const candidate = getMonthlyDateForDay(month, day);
  if (candidate >= startDate) {
    return candidate;
  }
  return getMonthlyDateForDay(addMonths(month, 1), day);
}

function getMonthlyDateForDay(month: string, day: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const maxDay = new Date(year, monthNumber, 0).getDate();
  const clampedDay = Math.min(maxDay, clampMonthlyDay(day));
  return `${year}-${String(monthNumber).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

function addMonths(month: string, count: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + count, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function subtractDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function cleanInvoicePrefix(value?: string | null): string {
  return (value?.trim() || 'AUTO').replace(/[^A-Za-z0-9-]/g, '').slice(0, 12) || 'AUTO';
}

function clampMonthlyDay(value: number): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return Math.min(31, Math.max(1, parsed));
}

function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

function isValidEmail(value: string | null): boolean {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

function roundMoney(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function finiteNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numberValue(value: unknown, fallback: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
