import { z } from 'zod';

import { APP_SECURITY_ID, BUSINESS_SETTINGS_ID } from '../database/schema';
import { BackupValidationError } from './errors';
import type { OrbitLedgerBackup } from './types';
import { ORBIT_LEDGER_BACKUP_APP_NAME, ORBIT_LEDGER_BACKUP_FORMAT_VERSION } from './types';
import {
  assertSupportedBackupFormatVersion,
  getBackupFormatVersion,
} from './version';

const nonEmptyString = z.string().trim().min(1);
const nullableString = z.string().nullable();
const optionalNullableString = z.string().nullable().optional();
const syncStatusSchema = z.enum(['pending', 'synced', 'conflict']);
const syncMetadataSchema = z.object({
  syncId: z.string(),
  lastModified: z.string(),
  syncStatus: syncStatusSchema,
});
const documentTemplateTypeSchema = z.enum(['invoice', 'statement']);
const complianceReportTypeSchema = z.enum(['tax_summary', 'sales_summary', 'dues_summary']);

const businessSettingsSchema = syncMetadataSchema.extend({
  id: z.literal(BUSINESS_SETTINGS_ID),
  businessName: nonEmptyString,
  ownerName: nonEmptyString,
  phone: nonEmptyString,
  email: nonEmptyString,
  address: nonEmptyString,
  currency: nonEmptyString,
  countryCode: nonEmptyString,
  stateCode: nonEmptyString,
  logoUri: nullableString,
  authorizedPersonName: nonEmptyString,
  authorizedPersonTitle: nonEmptyString,
  signatureUri: nullableString,
  taxMode: z.enum(['not_configured', 'manual', 'exempt']),
  taxProfileVersion: nullableString,
  taxProfileSource: z.enum(['none', 'local', 'remote']),
  taxLastSyncedAt: nullableString,
  taxSetupRequired: z.boolean(),
  createdAt: nonEmptyString,
  updatedAt: nonEmptyString,
});

const customerSchema = syncMetadataSchema.extend({
  id: nonEmptyString,
  name: nonEmptyString,
  phone: nullableString,
  address: nullableString,
  notes: nullableString,
  openingBalance: z.number().finite(),
  isArchived: z.boolean(),
  createdAt: nonEmptyString,
  updatedAt: nonEmptyString,
});

const transactionSchema = syncMetadataSchema.extend({
  id: nonEmptyString,
  customerId: nonEmptyString,
  type: z.enum(['credit', 'payment']),
  amount: z.number().positive(),
  note: nullableString,
  effectiveDate: nonEmptyString,
  createdAt: nonEmptyString,
});

const taxProfileSchema = syncMetadataSchema.extend({
  id: nonEmptyString,
  countryCode: nonEmptyString,
  stateCode: z.string(),
  taxType: nonEmptyString,
  taxRulesJson: nonEmptyString,
  version: nonEmptyString,
  lastUpdated: nonEmptyString,
  source: z.enum(['manual', 'remote', 'seed']),
});

const taxPackSchema = z.object({
  id: nonEmptyString,
  countryCode: nonEmptyString,
  regionCode: z.string(),
  taxType: nonEmptyString,
  rulesJson: nonEmptyString,
  version: nonEmptyString,
  lastUpdated: nonEmptyString,
  source: z.enum(['remote', 'manual']),
  isActive: z.boolean(),
});

const documentTemplateSchema = z.object({
  id: nonEmptyString,
  countryCode: nonEmptyString,
  templateType: documentTemplateTypeSchema,
  templateConfigJson: nonEmptyString,
  version: nonEmptyString,
});

const complianceConfigSchema = z.object({
  id: nonEmptyString,
  countryCode: nonEmptyString,
  regionCode: z.string(),
  configJson: nonEmptyString,
  version: nonEmptyString,
  lastUpdated: nonEmptyString,
  source: z.enum(['remote', 'manual']),
  isActive: z.boolean(),
});

const countryPackageSchema = z.object({
  id: nonEmptyString,
  countryCode: nonEmptyString,
  regionCode: z.string(),
  packageName: nonEmptyString,
  version: nonEmptyString,
  taxPackId: nonEmptyString,
  complianceConfigId: nonEmptyString,
  installedAt: nonEmptyString,
  source: z.enum(['remote', 'manual']),
  isActive: z.boolean(),
});

const countryPackageTemplateSchema = z.object({
  countryPackageId: nonEmptyString,
  documentTemplateId: nonEmptyString,
  templateType: documentTemplateTypeSchema,
});

const complianceReportSchema = z.object({
  id: nonEmptyString,
  countryCode: nonEmptyString,
  reportType: complianceReportTypeSchema,
  generatedAt: nonEmptyString,
  reportDataJson: nonEmptyString,
});

const productSchema = syncMetadataSchema.extend({
  id: nonEmptyString,
  name: nonEmptyString,
  price: z.number().nonnegative(),
  stockQuantity: z.number().nonnegative(),
  unit: nonEmptyString,
  createdAt: nonEmptyString,
});

const invoiceSchema = syncMetadataSchema.extend({
  id: nonEmptyString,
  customerId: optionalNullableString,
  invoiceNumber: nonEmptyString,
  issueDate: nonEmptyString,
  dueDate: nullableString,
  subtotal: z.number().nonnegative(),
  taxAmount: z.number().nonnegative(),
  totalAmount: z.number().nonnegative(),
  status: z.enum(['draft', 'issued', 'paid', 'overdue', 'cancelled']),
  notes: nullableString,
  createdAt: nonEmptyString,
});

const invoiceItemSchema = syncMetadataSchema.extend({
  id: nonEmptyString,
  invoiceId: nonEmptyString,
  productId: optionalNullableString,
  name: nonEmptyString,
  description: optionalNullableString,
  quantity: z.number().positive(),
  price: z.number().nonnegative(),
  taxRate: z.number().nonnegative(),
  total: z.number().nonnegative(),
});

const appPreferenceSchema = z.object({
  key: nonEmptyString,
  value: z.string(),
  updatedAt: nonEmptyString,
});

const appSecuritySchema = z.object({
  id: z.literal(APP_SECURITY_ID),
  pinEnabled: z.boolean(),
  pinHash: nullableString,
  updatedAt: nonEmptyString,
});

const documentHistoryEntrySchema = z.object({
  id: nonEmptyString,
  documentKind: z.enum(['customer_statement', 'invoice']),
  customerName: z.string(),
  statementDate: nonEmptyString,
  fileName: nonEmptyString,
  uri: nonEmptyString,
  numberOfPages: z.number().int().nonnegative(),
  createdAt: nonEmptyString,
});

const recordCountsSchema = z.object({
  customers: z.number().int().nonnegative(),
  transactions: z.number().int().nonnegative(),
  taxProfiles: z.number().int().nonnegative(),
  taxPacks: z.number().int().nonnegative(),
  documentTemplates: z.number().int().nonnegative(),
  complianceConfigs: z.number().int().nonnegative(),
  countryPackages: z.number().int().nonnegative(),
  countryPackageTemplates: z.number().int().nonnegative(),
  complianceReports: z.number().int().nonnegative(),
  products: z.number().int().nonnegative(),
  invoices: z.number().int().nonnegative(),
  invoiceItems: z.number().int().nonnegative(),
  appPreferences: z.number().int().nonnegative(),
  documentHistory: z.number().int().nonnegative(),
});

const backupSchema = z.object({
  metadata: z.object({
    appName: z.literal(ORBIT_LEDGER_BACKUP_APP_NAME),
    backup_format_version: z.literal(ORBIT_LEDGER_BACKUP_FORMAT_VERSION),
    formatVersion: z.literal(ORBIT_LEDGER_BACKUP_FORMAT_VERSION).optional(),
    exportedAt: nonEmptyString,
    fileName: nonEmptyString,
    businessName: z.string().nullable().optional(),
    recordCounts: recordCountsSchema,
  }),
  data: z.object({
    businessSettings: businessSettingsSchema.nullable(),
    customers: z.array(customerSchema),
    transactions: z.array(transactionSchema),
    taxProfiles: z.array(taxProfileSchema),
    taxPacks: z.array(taxPackSchema),
    documentTemplates: z.array(documentTemplateSchema),
    complianceConfigs: z.array(complianceConfigSchema),
    countryPackages: z.array(countryPackageSchema),
    countryPackageTemplates: z.array(countryPackageTemplateSchema),
    complianceReports: z.array(complianceReportSchema),
    products: z.array(productSchema),
    invoices: z.array(invoiceSchema),
    invoiceItems: z.array(invoiceItemSchema),
    appPreferences: z.array(appPreferenceSchema),
    documentHistory: z.array(documentHistoryEntrySchema),
    appSecurity: appSecuritySchema.nullable(),
    extensions: z.record(z.string(), z.unknown()).optional(),
  }),
});

export function parseOrbitLedgerBackupJson(json: string): OrbitLedgerBackup {
  try {
    return validateOrbitLedgerBackup(JSON.parse(json));
  } catch (error) {
    if (error instanceof BackupValidationError) {
      throw error;
    }
    throw new BackupValidationError(
      'This file is not a backup file Orbit Ledger can read.',
      error instanceof Error ? error.message : String(error)
    );
  }
}

export function validateOrbitLedgerBackup(value: unknown): OrbitLedgerBackup {
  assertSupportedBackupMetadata(value);
  assertRequiredTopLevelSections(value);

  const result = backupSchema.safeParse(value);
  if (!result.success) {
    throw new BackupValidationError(
      friendlySchemaMessage(result.error.issues[0]?.path),
      result.error.issues
        .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
        .join('; ')
    );
  }

  const backup = result.data as OrbitLedgerBackup;
  validateJsonPayloads(backup);
  validateBackupRelationships(backup);
  validateRecordCounts(backup);
  return backup;
}

function assertSupportedBackupMetadata(value: unknown): void {
  if (!value || typeof value !== 'object') {
    throw new BackupValidationError(
      'This file is not an Orbit Ledger backup.',
      `Expected object root, received ${typeof value}`
    );
  }

  const metadata = (value as { metadata?: unknown }).metadata;
  if (!metadata || typeof metadata !== 'object') {
    throw new BackupValidationError('This backup is missing important file details.');
  }

  const appName = (metadata as { appName?: unknown }).appName;
  if (appName !== ORBIT_LEDGER_BACKUP_APP_NAME) {
    throw new BackupValidationError(
      'This file is not an Orbit Ledger backup.',
      `Unexpected appName: ${String(appName)}`
    );
  }

  const formatVersion = getBackupFormatVersion(metadata);
  assertSupportedBackupFormatVersion(formatVersion);

  if (formatVersion !== null && !('backup_format_version' in metadata)) {
    (metadata as { backup_format_version?: number }).backup_format_version = formatVersion;
  }
}

function assertRequiredTopLevelSections(value: unknown): void {
  const backup = value as { data?: unknown };
  if (!backup.data || typeof backup.data !== 'object') {
    throw new BackupValidationError('This backup is missing ledger data.');
  }

  const data = backup.data as Record<string, unknown>;
  const requiredDataSections = [
    'businessSettings',
    'customers',
    'transactions',
    'taxProfiles',
    'taxPacks',
    'documentTemplates',
    'complianceConfigs',
    'countryPackages',
    'countryPackageTemplates',
    'complianceReports',
    'products',
    'invoices',
    'invoiceItems',
    'appPreferences',
    'documentHistory',
    'appSecurity',
  ];

  for (const key of requiredDataSections) {
    if (!(key in data)) {
      throw new BackupValidationError(
        'This backup is missing ledger data.',
        `Missing data.${key}`
      );
    }
  }

  for (const key of requiredDataSections.filter(
    (section) => section !== 'businessSettings' && section !== 'appSecurity'
  )) {
    if (!Array.isArray(data[key])) {
      throw new BackupValidationError(
        'This backup has records Orbit Ledger cannot read.',
        `data.${key} is not an array`
      );
    }
  }
}

function validateJsonPayloads(backup: OrbitLedgerBackup): void {
  for (const taxProfile of backup.data.taxProfiles) {
    assertJsonObjectString(
      taxProfile.taxRulesJson,
      `Tax profile ${taxProfile.id} has invalid rules JSON.`
    );
  }

  for (const taxPack of backup.data.taxPacks) {
    assertJsonObjectString(taxPack.rulesJson, `Tax pack ${taxPack.id} has invalid rules JSON.`);
  }

  for (const template of backup.data.documentTemplates) {
    assertJsonObjectString(
      template.templateConfigJson,
      `Document template ${template.id} has invalid template JSON.`
    );
  }

  for (const config of backup.data.complianceConfigs) {
    assertJsonObjectString(
      config.configJson,
      `Compliance config ${config.id} has invalid config JSON.`
    );
  }

  for (const report of backup.data.complianceReports) {
    assertJsonObjectString(
      report.reportDataJson,
      `Compliance report ${report.id} has invalid report JSON.`
    );
  }
}

function validateBackupRelationships(backup: OrbitLedgerBackup): void {
  const customerIds = assertUniqueIds(
    backup.data.customers.map((customer) => customer.id),
    'This backup contains repeated customer records.',
    'Duplicate customer id'
  );
  const productIds = assertUniqueIds(
    backup.data.products.map((product) => product.id),
    'This backup contains repeated product records.',
    'Duplicate product id'
  );
  const invoiceIds = assertUniqueIds(
    backup.data.invoices.map((invoice) => invoice.id),
    'This backup contains repeated invoice records.',
    'Duplicate invoice id'
  );
  const taxPackIds = assertUniqueIds(
    backup.data.taxPacks.map((pack) => pack.id),
    'This backup contains repeated tax pack records.',
    'Duplicate tax pack id'
  );
  const documentTemplateIds = assertUniqueIds(
    backup.data.documentTemplates.map((template) => template.id),
    'This backup contains repeated document template records.',
    'Duplicate document template id'
  );
  const complianceConfigIds = assertUniqueIds(
    backup.data.complianceConfigs.map((config) => config.id),
    'This backup contains repeated compliance config records.',
    'Duplicate compliance config id'
  );
  const countryPackageIds = new Set(backup.data.countryPackages.map((item) => item.id));

  assertUniqueIds(
    backup.data.transactions.map((transaction) => transaction.id),
    'This backup contains repeated transaction records.',
    'Duplicate transaction id'
  );
  assertUniqueIds(
    backup.data.taxProfiles.map((profile) => profile.id),
    'This backup contains repeated tax profile records.',
    'Duplicate tax profile id'
  );
  assertUniqueIds(
    backup.data.countryPackages.map((countryPackage) => countryPackage.id),
    'This backup contains repeated country package records.',
    'Duplicate country package id'
  );
  assertUniqueIds(
    backup.data.complianceReports.map((report) => report.id),
    'This backup contains repeated compliance report records.',
    'Duplicate compliance report id'
  );
  assertUniqueIds(
    backup.data.invoiceItems.map((item) => item.id),
    'This backup contains repeated invoice item records.',
    'Duplicate invoice item id'
  );
  assertUniqueIds(
    backup.data.appPreferences.map((preference) => preference.key),
    'This backup contains repeated app preference records.',
    'Duplicate app preference key'
  );
  assertUniqueIds(
    backup.data.documentHistory.map((entry) => entry.id),
    'This backup contains repeated generated document history records.',
    'Duplicate document history id'
  );

  for (const transaction of backup.data.transactions) {
    if (!customerIds.has(transaction.customerId)) {
      throw new BackupValidationError(
        'This backup has entries that do not match any customer.',
        `Transaction ${transaction.id} references missing customer ${transaction.customerId}`
      );
    }
  }

  for (const invoice of backup.data.invoices) {
    if (invoice.customerId && !customerIds.has(invoice.customerId)) {
      throw new BackupValidationError(
        'This backup has invoices that do not match any customer.',
        `Invoice ${invoice.id} references missing customer ${invoice.customerId}`
      );
    }
  }

  for (const item of backup.data.invoiceItems) {
    if (!invoiceIds.has(item.invoiceId)) {
      throw new BackupValidationError(
        'This backup has invoice items that do not match any invoice.',
        `Invoice item ${item.id} references missing invoice ${item.invoiceId}`
      );
    }
    if (item.productId && !productIds.has(item.productId)) {
      throw new BackupValidationError(
        'This backup has invoice items that do not match any product.',
        `Invoice item ${item.id} references missing product ${item.productId}`
      );
    }
  }

  for (const countryPackage of backup.data.countryPackages) {
    if (!taxPackIds.has(countryPackage.taxPackId)) {
      throw new BackupValidationError(
        'This backup has country packages that do not match any tax pack.',
        `Country package ${countryPackage.id} references missing tax pack ${countryPackage.taxPackId}`
      );
    }
    if (!complianceConfigIds.has(countryPackage.complianceConfigId)) {
      throw new BackupValidationError(
        'This backup has country packages that do not match any compliance config.',
        `Country package ${countryPackage.id} references missing compliance config ${countryPackage.complianceConfigId}`
      );
    }
  }

  for (const templateLink of backup.data.countryPackageTemplates) {
    if (!countryPackageIds.has(templateLink.countryPackageId)) {
      throw new BackupValidationError(
        'This backup has country package templates that do not match any country package.',
        `Country package template references missing package ${templateLink.countryPackageId}`
      );
    }
    if (!documentTemplateIds.has(templateLink.documentTemplateId)) {
      throw new BackupValidationError(
        'This backup has country package templates that do not match any document template.',
        `Country package template references missing template ${templateLink.documentTemplateId}`
      );
    }
  }

  assertUniqueCompositeKeys(
    backup.data.taxProfiles.map((profile) => [
      profile.countryCode,
      profile.stateCode,
      profile.taxType,
    ]),
    'This backup contains repeated tax profile records.',
    'Duplicate tax profile lookup'
  );
  assertUniqueCompositeKeys(
    backup.data.taxPacks.map((pack) => [
      pack.countryCode,
      pack.regionCode,
      pack.taxType,
      pack.version,
    ]),
    'This backup contains repeated tax pack records.',
    'Duplicate tax pack lookup'
  );
  assertUniqueCompositeKeys(
    backup.data.taxPacks
      .filter((pack) => pack.isActive)
      .map((pack) => [pack.countryCode, pack.regionCode, pack.taxType]),
    'This backup has more than one active tax pack for the same region.',
    'Duplicate active tax pack lookup'
  );
  assertUniqueCompositeKeys(
    backup.data.documentTemplates.map((template) => [
      template.countryCode,
      template.templateType,
      template.version,
    ]),
    'This backup contains repeated document template records.',
    'Duplicate document template lookup'
  );
  assertUniqueCompositeKeys(
    backup.data.complianceConfigs.map((config) => [
      config.countryCode,
      config.regionCode,
      config.version,
    ]),
    'This backup contains repeated compliance config records.',
    'Duplicate compliance config lookup'
  );
  assertUniqueCompositeKeys(
    backup.data.complianceConfigs
      .filter((config) => config.isActive)
      .map((config) => [config.countryCode, config.regionCode]),
    'This backup has more than one active compliance config for the same region.',
    'Duplicate active compliance config lookup'
  );
  assertUniqueCompositeKeys(
    backup.data.countryPackages.map((countryPackage) => [
      countryPackage.countryCode,
      countryPackage.regionCode,
      countryPackage.version,
    ]),
    'This backup contains repeated country package records.',
    'Duplicate country package lookup'
  );
  assertUniqueCompositeKeys(
    backup.data.countryPackages
      .filter((countryPackage) => countryPackage.isActive)
      .map((countryPackage) => [countryPackage.countryCode, countryPackage.regionCode]),
    'This backup has more than one active country package for the same region.',
    'Duplicate active country package lookup'
  );
  assertUniqueCompositeKeys(
    backup.data.countryPackageTemplates.map((templateLink) => [
      templateLink.countryPackageId,
      templateLink.templateType,
    ]),
    'This backup contains repeated country package template records.',
    'Duplicate country package template lookup'
  );
  assertUniqueCompositeKeys(
    backup.data.invoices.map((invoice) => [invoice.invoiceNumber.toLowerCase()]),
    'This backup contains repeated invoice numbers.',
    'Duplicate invoice number'
  );
}

function validateRecordCounts(backup: OrbitLedgerBackup): void {
  const counts = backup.metadata.recordCounts;
  if (!counts) {
    throw new BackupValidationError('This backup is missing record counts.');
  }
  const actualCounts = {
    customers: backup.data.customers.length,
    transactions: backup.data.transactions.length,
    taxProfiles: backup.data.taxProfiles.length,
    taxPacks: backup.data.taxPacks.length,
    documentTemplates: backup.data.documentTemplates.length,
    complianceConfigs: backup.data.complianceConfigs.length,
    countryPackages: backup.data.countryPackages.length,
    countryPackageTemplates: backup.data.countryPackageTemplates.length,
    complianceReports: backup.data.complianceReports.length,
    products: backup.data.products.length,
    invoices: backup.data.invoices.length,
    invoiceItems: backup.data.invoiceItems.length,
    appPreferences: backup.data.appPreferences.length,
    documentHistory: backup.data.documentHistory.length,
  };

  for (const [key, actualCount] of Object.entries(actualCounts)) {
    const declaredCount = counts[key as keyof typeof counts];
    if (declaredCount !== actualCount) {
      throw new BackupValidationError(
        'The record counts in this backup do not match its records.',
        `metadata.recordCounts.${key}=${declaredCount}, actual=${actualCount}`
      );
    }
  }
}

function assertJsonObjectString(value: string, message: string): void {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Expected a JSON object.');
    }
  } catch (error) {
    throw new BackupValidationError(
      'This backup contains app setup data Orbit Ledger cannot read.',
      `${message} ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function assertUniqueIds(
  values: string[],
  message: string,
  detailPrefix: string
): Set<string> {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new BackupValidationError(message, `${detailPrefix}: ${value}`);
    }
    seen.add(value);
  }
  return seen;
}

function assertUniqueCompositeKeys(
  values: string[][],
  message: string,
  detailPrefix: string
): void {
  const seen = new Set<string>();
  for (const value of values) {
    const key = value.join('\u001f');
    if (seen.has(key)) {
      throw new BackupValidationError(message, `${detailPrefix}: ${value.join(' / ')}`);
    }
    seen.add(key);
  }
}

function friendlySchemaMessage(path: Array<PropertyKey> | undefined): string {
  const first = String(path?.[0] ?? '');
  const second = String(path?.[1] ?? '');

  if (first === 'metadata') {
    return 'This backup is missing important file details.';
  }
  if (first === 'data' && second === 'businessSettings') {
    return 'This backup is missing business profile details.';
  }
  if (first === 'data' && second === 'customers') {
    return 'This backup has customer records Orbit Ledger cannot read.';
  }
  if (first === 'data' && second === 'transactions') {
    return 'This backup has transaction records Orbit Ledger cannot read.';
  }
  if (first === 'data' && second === 'products') {
    return 'This backup has product records Orbit Ledger cannot read.';
  }
  if (first === 'data' && second === 'invoices') {
    return 'This backup has invoice records Orbit Ledger cannot read.';
  }
  if (first === 'data' && second === 'invoiceItems') {
    return 'This backup has invoice item records Orbit Ledger cannot read.';
  }
  if (
    first === 'data' &&
    [
      'taxProfiles',
      'taxPacks',
      'documentTemplates',
      'complianceConfigs',
      'countryPackages',
      'countryPackageTemplates',
      'complianceReports',
    ].includes(second)
  ) {
    return 'This backup has country, tax, or compliance records Orbit Ledger cannot read.';
  }
  if (first === 'data' && second === 'appPreferences') {
    return 'This backup has app preference records Orbit Ledger cannot read.';
  }
  if (first === 'data' && second === 'documentHistory') {
    return 'This backup has generated document history Orbit Ledger cannot read.';
  }
  if (first === 'data' && second === 'appSecurity') {
    return 'This backup has app lock details Orbit Ledger cannot read.';
  }

  return 'This file is not an Orbit Ledger backup.';
}
