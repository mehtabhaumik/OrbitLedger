import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '../database';
import { measurePerformance } from '../performance';
import {
  mapAppSecurity,
  mapBusinessSettings,
  mapComplianceConfig,
  mapComplianceReport,
  mapCountryPackage,
  mapCustomer,
  mapCustomerTimelineNote,
  mapDocumentTemplate,
  mapInvoice,
  mapInvoiceItem,
  mapPaymentReminder,
  mapPaymentPromise,
  mapProduct,
  mapTaxPack,
  mapTaxProfile,
  mapTransaction,
} from '../database/mappers';
import { APP_SECURITY_ID, BUSINESS_SETTINGS_ID } from '../database/schema';
import type {
  AppSecurity,
  AppSecurityRow,
  AppPreferenceRow,
  BusinessSettings,
  BusinessSettingsRow,
  ComplianceConfig,
  ComplianceConfigRow,
  ComplianceReport,
  ComplianceReportRow,
  CountryPackage,
  CountryPackageRow,
  CountryPackageTemplate,
  CountryPackageTemplateRow,
  Customer,
  CustomerRow,
  CustomerTimelineNote,
  CustomerTimelineNoteRow,
  DocumentTemplate,
  DocumentTemplateRow,
  Invoice,
  InvoiceItem,
  InvoiceItemRow,
  InvoiceRow,
  LedgerTransaction,
  LedgerTransactionRow,
  PaymentReminder,
  PaymentReminderRow,
  PaymentPromise,
  PaymentPromiseRow,
  Product,
  ProductRow,
  TaxPack,
  TaxPackRow,
  TaxProfile,
  TaxProfileRow,
} from '../database/types';
import {
  getGeneratedDocumentHistory,
  replaceGeneratedDocumentHistory,
} from '../documents';
import { BackupRestoreError, BackupValidationError } from './errors';
import { buildBackupMetadata, serializeOrbitLedgerBackup } from './format';
import { prepareFullReplaceRestorePlan } from './restorePlan';
import type {
  BackupAppPreference,
  BackupRecordCounts,
  CreateBackupResult,
  OrbitLedgerBackup,
  RestoreBackupPlan,
  RestoreBackupSummary,
} from './types';
import { clearPinLockSecureState } from '../security/pinLock';
import { validateOrbitLedgerBackup } from './validation';

type DatabaseWriter = Pick<SQLiteDatabase, 'execAsync' | 'runAsync'>;

type RestoreSnapshot = {
  businessSettingsSignature: string;
  customersSignature: string;
  transactionsSignature: string;
  paymentRemindersSignature: string;
  paymentPromisesSignature: string;
  taxProfilesSignature: string;
  taxPacksSignature: string;
  documentTemplatesSignature: string;
  complianceConfigsSignature: string;
  countryPackagesSignature: string;
  countryPackageTemplatesSignature: string;
  complianceReportsSignature: string;
  productsSignature: string;
  invoicesSignature: string;
  invoiceItemsSignature: string;
  appPreferencesSignature: string;
  appSecuritySignature: string;
};

type SnapshotRow = {
  signature: string | null;
};

export async function createOrbitLedgerBackup(): Promise<CreateBackupResult> {
  const backup = validateOrbitLedgerBackup(await extractOrbitLedgerBackup());
  const json = serializeOrbitLedgerBackup(backup);

  return {
    backup,
    json,
    fileName: backup.metadata.fileName,
  };
}

export async function extractOrbitLedgerBackup(): Promise<OrbitLedgerBackup> {
  const db = await getDatabase();
  const [
    businessSettings,
    customers,
    customerTimelineNotes,
    transactions,
    paymentReminders,
    paymentPromises,
    taxProfiles,
    taxPacks,
    documentTemplates,
    complianceConfigs,
    countryPackages,
    countryPackageTemplates,
    complianceReports,
    products,
    invoices,
    invoiceItems,
    appPreferences,
    appSecurity,
  ] = await Promise.all([
    readBusinessSettings(db),
    readCustomers(db),
    readCustomerTimelineNotes(db),
    readTransactions(db),
    readPaymentReminders(db),
    readPaymentPromises(db),
    readTaxProfiles(db),
    readTaxPacks(db),
    readDocumentTemplates(db),
    readComplianceConfigs(db),
    readCountryPackages(db),
    readCountryPackageTemplates(db),
    readComplianceReports(db),
    readProducts(db),
    readInvoices(db),
    readInvoiceItems(db),
    readAppPreferences(db),
    readAppSecurity(db),
  ]);
  const documentHistory = getGeneratedDocumentHistory();
  const recordCounts = buildRecordCounts({
    customers,
    transactions,
    paymentReminders,
    paymentPromises,
    taxProfiles,
    taxPacks,
    documentTemplates,
    complianceConfigs,
    countryPackages,
    countryPackageTemplates,
    complianceReports,
    products,
    invoices,
    invoiceItems,
    appPreferences,
    documentHistory,
  });

  return {
    metadata: buildBackupMetadata(businessSettings?.businessName ?? null, undefined, recordCounts),
    data: {
      businessSettings,
      customers,
      transactions,
      paymentReminders,
      paymentPromises,
      taxProfiles,
      taxPacks,
      documentTemplates,
      complianceConfigs,
      countryPackages,
      countryPackageTemplates,
      complianceReports,
      products,
      invoices,
      invoiceItems,
      appPreferences,
      documentHistory,
      appSecurity,
      extensions: {
        customerTimelineNotes,
      },
    },
  };
}

export async function restoreOrbitLedgerBackup(
  source: string | OrbitLedgerBackup
): Promise<RestoreBackupSummary> {
  return measurePerformance('restore_apply', 'Restore apply', async () => {
    const plan = prepareAuditedRestorePlan(source);
    const db = await getDatabase();
    let beforeRestore: RestoreSnapshot | null = null;
    let previousDocumentHistory: ReturnType<typeof getGeneratedDocumentHistory> | null = null;
    let documentHistoryWasReplaced = false;
    let documentHistoryPreserved = true;

    try {
      beforeRestore = await readRestoreSnapshot(db);
      previousDocumentHistory = getGeneratedDocumentHistory();

      replaceGeneratedDocumentHistory(plan.backup.data.documentHistory);
      documentHistoryWasReplaced = true;
      logRestoreAudit('document_history_restore_complete', plan);

      logRestoreAudit('transaction_start', plan);
      await db.withExclusiveTransactionAsync(async (txn) => {
        const writer = txn as DatabaseWriter;

        await executeFullReplaceRestore(writer, plan);
      });
      logRestoreAudit('transaction_commit', plan);

      if (!plan.backup.data.appSecurity?.pinEnabled) {
        try {
          await clearPinLockSecureState();
          logRestoreAudit('secure_pin_reset_complete', plan);
        } catch (error) {
          console.warn('[backup-restore] PIN secure state could not be reset after restore', error);
          logRestoreAudit('secure_pin_reset_failed', plan, {
            technicalDetails: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return {
        mode: plan.mode,
        restoredAt: new Date().toISOString(),
        businessSettingsRestored: plan.backup.data.businessSettings !== null,
        recordCounts: plan.recordCounts,
        customersRestored: plan.recordCounts.customers,
        transactionsRestored: plan.recordCounts.transactions,
        invoicesRestored: plan.recordCounts.invoices,
        productsRestored: plan.recordCounts.products,
        taxPacksRestored: plan.recordCounts.taxPacks,
        countryPackagesRestored: plan.recordCounts.countryPackages,
        appPreferencesRestored: plan.recordCounts.appPreferences,
        appSecurityRestored: plan.appSecurityToRestore,
      };
    } catch (error) {
      if (previousDocumentHistory && documentHistoryWasReplaced) {
        try {
          replaceGeneratedDocumentHistory(previousDocumentHistory);
          logRestoreAudit('document_history_rollback_complete', plan);
        } catch (historyRollbackError) {
          documentHistoryPreserved = false;
          console.warn(
            '[backup-restore] Document history could not be rolled back after restore failure',
            historyRollbackError
          );
          logRestoreAudit('document_history_rollback_failed', plan, {
            technicalDetails:
              historyRollbackError instanceof Error
                ? historyRollbackError.message
                : String(historyRollbackError),
          });
        }
      }
      const afterRestore = beforeRestore ? await readRestoreSnapshotSafely(db) : null;
      const currentDataPreserved =
        documentHistoryPreserved &&
        didRestorePreserveCurrentData(error, beforeRestore, afterRestore);
      const technicalDetails = error instanceof Error ? error.message : String(error);

      logRestoreAudit('transaction_failed', plan, {
        currentDataPreserved,
        technicalDetails,
      });

      throw new BackupRestoreError(
        currentDataPreserved
          ? 'Restore could not be completed. Your current Orbit Ledger data was kept safe.'
          : 'Restore could not be completed. Please review your Orbit Ledger data before trying again.',
        technicalDetails,
        currentDataPreserved
      );
    }
  });
}

function prepareAuditedRestorePlan(source: string | OrbitLedgerBackup): RestoreBackupPlan {
  try {
    logRestoreAudit('validation_start');
    const plan = prepareFullReplaceRestorePlan(source);
    logRestoreAudit('validation_complete', plan);
    return plan;
  } catch (error) {
    logRestoreAudit('validation_failed', undefined, {
      technicalDetails: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof BackupValidationError) {
      throw error;
    }

    throw new BackupRestoreError(
      'Restore could not start. Your current Orbit Ledger data was not changed.',
      error instanceof Error ? error.message : String(error)
    );
  }
}

async function executeFullReplaceRestore(
  db: DatabaseWriter,
  plan: RestoreBackupPlan
): Promise<void> {
  const backup = plan.backup;

  logRestoreAudit('clear_tables_start', plan);
  await clearRestoredTables(db);
  logRestoreAudit('clear_tables_complete', plan);

  if (backup.data.businessSettings) {
    logRestoreAudit('business_settings_restore_start', plan);
    await upsertBusinessSettings(db, backup.data.businessSettings);
    logRestoreAudit('business_settings_restore_complete', plan);
  }

  logRestoreAudit('customers_restore_start', plan);
  for (const customer of backup.data.customers) {
    await upsertCustomer(db, customer);
  }
  logRestoreAudit('customers_restore_complete', plan);

  logRestoreAudit('customer_timeline_notes_restore_start', plan);
  for (const note of getCustomerTimelineNotesFromBackup(backup)) {
    await upsertCustomerTimelineNote(db, note);
  }
  logRestoreAudit('customer_timeline_notes_restore_complete', plan);

  logRestoreAudit('transactions_restore_start', plan);
  for (const transaction of backup.data.transactions) {
    await upsertTransaction(db, transaction);
  }
  logRestoreAudit('transactions_restore_complete', plan);

  logRestoreAudit('payment_reminders_restore_start', plan);
  for (const reminder of backup.data.paymentReminders) {
    await upsertPaymentReminder(db, reminder);
  }
  logRestoreAudit('payment_reminders_restore_complete', plan);

  logRestoreAudit('payment_promises_restore_start', plan);
  for (const promise of backup.data.paymentPromises) {
    await upsertPaymentPromise(db, promise);
  }
  logRestoreAudit('payment_promises_restore_complete', plan);

  logRestoreAudit('tax_profiles_restore_start', plan);
  for (const taxProfile of backup.data.taxProfiles) {
    await upsertTaxProfile(db, taxProfile);
  }
  logRestoreAudit('tax_profiles_restore_complete', plan);

  logRestoreAudit('tax_packs_restore_start', plan);
  for (const taxPack of backup.data.taxPacks) {
    await upsertTaxPack(db, taxPack);
  }
  logRestoreAudit('tax_packs_restore_complete', plan);

  logRestoreAudit('document_templates_restore_start', plan);
  for (const template of backup.data.documentTemplates) {
    await upsertDocumentTemplate(db, template);
  }
  logRestoreAudit('document_templates_restore_complete', plan);

  logRestoreAudit('compliance_configs_restore_start', plan);
  for (const config of backup.data.complianceConfigs) {
    await upsertComplianceConfig(db, config);
  }
  logRestoreAudit('compliance_configs_restore_complete', plan);

  logRestoreAudit('country_packages_restore_start', plan);
  for (const countryPackage of backup.data.countryPackages) {
    await upsertCountryPackage(db, countryPackage);
  }
  logRestoreAudit('country_packages_restore_complete', plan);

  logRestoreAudit('country_package_templates_restore_start', plan);
  for (const templateLink of backup.data.countryPackageTemplates) {
    await upsertCountryPackageTemplate(db, templateLink);
  }
  logRestoreAudit('country_package_templates_restore_complete', plan);

  logRestoreAudit('compliance_reports_restore_start', plan);
  for (const report of backup.data.complianceReports) {
    await upsertComplianceReport(db, report);
  }
  logRestoreAudit('compliance_reports_restore_complete', plan);

  logRestoreAudit('products_restore_start', plan);
  for (const product of backup.data.products) {
    await upsertProduct(db, product);
  }
  logRestoreAudit('products_restore_complete', plan);

  logRestoreAudit('invoices_restore_start', plan);
  for (const invoice of backup.data.invoices) {
    await upsertInvoice(db, invoice);
  }
  logRestoreAudit('invoices_restore_complete', plan);

  logRestoreAudit('invoice_items_restore_start', plan);
  for (const item of backup.data.invoiceItems) {
    await upsertInvoiceItem(db, item);
  }
  logRestoreAudit('invoice_items_restore_complete', plan);

  logRestoreAudit('app_preferences_restore_start', plan);
  for (const preference of backup.data.appPreferences) {
    await upsertAppPreference(db, preference);
  }
  logRestoreAudit('app_preferences_restore_complete', plan);

  logRestoreAudit('app_security_restore_start', plan);
  await upsertAppSecurity(db, backup.data.appSecurity ?? defaultAppSecurity());
  logRestoreAudit('app_security_restore_complete', plan);
}

async function readBusinessSettings(db: SQLiteDatabase): Promise<BusinessSettings | null> {
  const row = await db.getFirstAsync<BusinessSettingsRow>(
    'SELECT * FROM business_settings WHERE id = ? LIMIT 1',
    BUSINESS_SETTINGS_ID
  );

  return row ? mapBusinessSettings(row) : null;
}

async function readCustomers(db: SQLiteDatabase): Promise<Customer[]> {
  const rows = await db.getAllAsync<CustomerRow>(
    `SELECT * FROM customers
     ORDER BY created_at ASC, name COLLATE NOCASE ASC`
  );

  return rows.map(mapCustomer);
}

async function readCustomerTimelineNotes(db: SQLiteDatabase): Promise<CustomerTimelineNote[]> {
  const rows = await db.getAllAsync<CustomerTimelineNoteRow>(
    `SELECT * FROM customer_timeline_notes
     ORDER BY created_at ASC, id ASC`
  );

  return rows.map(mapCustomerTimelineNote);
}

async function readTransactions(db: SQLiteDatabase): Promise<LedgerTransaction[]> {
  const rows = await db.getAllAsync<LedgerTransactionRow>(
    `SELECT * FROM transactions
     ORDER BY effective_date ASC, created_at ASC`
  );

  return rows.map(mapTransaction);
}

async function readPaymentReminders(db: SQLiteDatabase): Promise<PaymentReminder[]> {
  const rows = await db.getAllAsync<PaymentReminderRow>(
    `SELECT * FROM payment_reminders
     ORDER BY created_at ASC, id ASC`
  );

  return rows.map(mapPaymentReminder);
}

async function readPaymentPromises(db: SQLiteDatabase): Promise<PaymentPromise[]> {
  const rows = await db.getAllAsync<PaymentPromiseRow>(
    `SELECT * FROM payment_promises
     ORDER BY promised_date ASC, created_at ASC, id ASC`
  );

  return rows.map(mapPaymentPromise);
}

async function readTaxProfiles(db: SQLiteDatabase): Promise<TaxProfile[]> {
  const rows = await db.getAllAsync<TaxProfileRow>(
    `SELECT * FROM tax_profiles
     ORDER BY country_code ASC, state_code ASC, tax_type ASC, version ASC`
  );

  return rows.map(mapTaxProfile);
}

async function readTaxPacks(db: SQLiteDatabase): Promise<TaxPack[]> {
  const rows = await db.getAllAsync<TaxPackRow>(
    `SELECT * FROM tax_packs
     ORDER BY country_code ASC, region_code ASC, tax_type ASC, version ASC`
  );

  return rows.map(mapTaxPack);
}

async function readDocumentTemplates(db: SQLiteDatabase): Promise<DocumentTemplate[]> {
  const rows = await db.getAllAsync<DocumentTemplateRow>(
    `SELECT * FROM document_templates
     ORDER BY country_code ASC, template_type ASC, version ASC`
  );

  return rows.map(mapDocumentTemplate);
}

async function readComplianceConfigs(db: SQLiteDatabase): Promise<ComplianceConfig[]> {
  const rows = await db.getAllAsync<ComplianceConfigRow>(
    `SELECT * FROM compliance_configs
     ORDER BY country_code ASC, region_code ASC, version ASC`
  );

  return rows.map(mapComplianceConfig);
}

async function readCountryPackages(db: SQLiteDatabase): Promise<CountryPackage[]> {
  const rows = await db.getAllAsync<CountryPackageRow>(
    `SELECT * FROM country_packages
     ORDER BY country_code ASC, region_code ASC, version ASC`
  );

  return rows.map(mapCountryPackage);
}

async function readCountryPackageTemplates(
  db: SQLiteDatabase
): Promise<CountryPackageTemplate[]> {
  const rows = await db.getAllAsync<CountryPackageTemplateRow>(
    `SELECT * FROM country_package_templates
     ORDER BY country_package_id ASC, template_type ASC`
  );

  return rows.map((row) => ({
    countryPackageId: row.country_package_id,
    documentTemplateId: row.document_template_id,
    templateType: row.template_type,
  }));
}

async function readComplianceReports(db: SQLiteDatabase): Promise<ComplianceReport[]> {
  const rows = await db.getAllAsync<ComplianceReportRow>(
    `SELECT * FROM compliance_reports
     ORDER BY generated_at ASC, id ASC`
  );

  return rows.map(mapComplianceReport);
}

async function readProducts(db: SQLiteDatabase): Promise<Product[]> {
  const rows = await db.getAllAsync<ProductRow>(
    `SELECT * FROM products
     ORDER BY created_at ASC, name COLLATE NOCASE ASC`
  );

  return rows.map(mapProduct);
}

async function readInvoices(db: SQLiteDatabase): Promise<Invoice[]> {
  const rows = await db.getAllAsync<InvoiceRow>(
    `SELECT * FROM invoices
     ORDER BY issue_date ASC, created_at ASC`
  );

  return rows.map(mapInvoice);
}

async function readInvoiceItems(db: SQLiteDatabase): Promise<InvoiceItem[]> {
  const rows = await db.getAllAsync<InvoiceItemRow>(
    `SELECT * FROM invoice_items
     ORDER BY invoice_id ASC, rowid ASC`
  );

  return rows.map(mapInvoiceItem);
}

async function readAppPreferences(db: SQLiteDatabase): Promise<BackupAppPreference[]> {
  const rows = await db.getAllAsync<AppPreferenceRow>(
    `SELECT * FROM app_preferences
     ORDER BY key ASC`
  );

  return rows.map((row) => ({
    key: row.key,
    value: row.value,
    updatedAt: row.updated_at,
  }));
}

async function readAppSecurity(db: SQLiteDatabase): Promise<AppSecurity | null> {
  const row = await db.getFirstAsync<AppSecurityRow>(
    'SELECT * FROM app_security WHERE id = ? LIMIT 1',
    APP_SECURITY_ID
  );

  return row ? mapAppSecurity(row) : null;
}

async function clearRestoredTables(db: DatabaseWriter): Promise<void> {
  await db.execAsync('DELETE FROM country_package_templates;');
  await db.execAsync('DELETE FROM country_packages;');
  await db.execAsync('DELETE FROM invoice_items;');
  await db.execAsync('DELETE FROM invoices;');
  await db.execAsync('DELETE FROM transactions;');
  await db.execAsync('DELETE FROM payment_reminders;');
  await db.execAsync('DELETE FROM payment_promises;');
  await db.execAsync('DELETE FROM customers;');
  await db.execAsync('DELETE FROM products;');
  await db.execAsync('DELETE FROM compliance_reports;');
  await db.execAsync('DELETE FROM document_templates;');
  await db.execAsync('DELETE FROM compliance_configs;');
  await db.execAsync('DELETE FROM tax_packs;');
  await db.execAsync('DELETE FROM tax_profiles;');
  await db.execAsync('DELETE FROM business_settings;');
  await db.execAsync('DELETE FROM app_security;');
  await db.execAsync('DELETE FROM app_preferences;');
}

async function upsertBusinessSettings(db: DatabaseWriter, settings: BusinessSettings): Promise<void> {
  await db.runAsync(
    `INSERT INTO business_settings (
      id,
      business_name,
      owner_name,
      phone,
      email,
      address,
      currency,
      country_code,
      state_code,
      logo_uri,
      authorized_person_name,
      authorized_person_title,
      signature_uri,
      tax_mode,
      tax_profile_version,
      tax_profile_source,
      tax_last_synced_at,
      tax_setup_required,
      storage_mode,
      workspace_id,
      sync_enabled,
      last_synced_at,
      created_at,
      updated_at,
      sync_id,
      last_modified,
      sync_status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      business_name = excluded.business_name,
      owner_name = excluded.owner_name,
      phone = excluded.phone,
      email = excluded.email,
      address = excluded.address,
      currency = excluded.currency,
      country_code = excluded.country_code,
      state_code = excluded.state_code,
      logo_uri = excluded.logo_uri,
      authorized_person_name = excluded.authorized_person_name,
      authorized_person_title = excluded.authorized_person_title,
      signature_uri = excluded.signature_uri,
      tax_mode = excluded.tax_mode,
      tax_profile_version = excluded.tax_profile_version,
      tax_profile_source = excluded.tax_profile_source,
      tax_last_synced_at = excluded.tax_last_synced_at,
      tax_setup_required = excluded.tax_setup_required,
      storage_mode = excluded.storage_mode,
      workspace_id = excluded.workspace_id,
      sync_enabled = excluded.sync_enabled,
      last_synced_at = excluded.last_synced_at,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      sync_id = excluded.sync_id,
      last_modified = excluded.last_modified,
      sync_status = excluded.sync_status`,
    settings.id,
    settings.businessName,
    settings.ownerName,
    settings.phone,
    settings.email,
    settings.address,
    settings.currency,
    settings.countryCode,
    settings.stateCode,
    settings.logoUri,
    settings.authorizedPersonName,
    settings.authorizedPersonTitle,
    settings.signatureUri,
    settings.taxMode,
    settings.taxProfileVersion,
    settings.taxProfileSource,
    settings.taxLastSyncedAt,
    settings.taxSetupRequired ? 1 : 0,
    settings.storageMode,
    settings.workspaceId,
    settings.syncEnabled ? 1 : 0,
    settings.lastSyncedAt,
    settings.createdAt,
    settings.updatedAt,
    settings.syncId,
    settings.lastModified,
    settings.syncStatus
  );
}

async function upsertCustomer(db: DatabaseWriter, customer: Customer): Promise<void> {
  await db.runAsync(
    `INSERT INTO customers (
      id, name, phone, address, notes, opening_balance, is_archived, created_at, updated_at,
      sync_id, last_modified, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      phone = excluded.phone,
      address = excluded.address,
      notes = excluded.notes,
      opening_balance = excluded.opening_balance,
      is_archived = excluded.is_archived,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      sync_id = excluded.sync_id,
      last_modified = excluded.last_modified,
      sync_status = excluded.sync_status`,
    customer.id,
    customer.name,
    customer.phone,
    customer.address,
    customer.notes,
    customer.openingBalance,
    customer.isArchived ? 1 : 0,
    customer.createdAt,
    customer.updatedAt,
    customer.syncId,
    customer.lastModified,
    customer.syncStatus
  );
}

async function upsertCustomerTimelineNote(
  db: DatabaseWriter,
  note: CustomerTimelineNote
): Promise<void> {
  await db.runAsync(
    `INSERT INTO customer_timeline_notes (
      id, customer_id, kind, body, created_at, updated_at,
      sync_id, last_modified, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      customer_id = excluded.customer_id,
      kind = excluded.kind,
      body = excluded.body,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      sync_id = excluded.sync_id,
      last_modified = excluded.last_modified,
      sync_status = excluded.sync_status`,
    note.id,
    note.customerId,
    note.kind,
    note.body,
    note.createdAt,
    note.updatedAt,
    note.syncId,
    note.lastModified,
    note.syncStatus
  );
}

async function upsertTransaction(db: DatabaseWriter, transaction: LedgerTransaction): Promise<void> {
  await db.runAsync(
    `INSERT INTO transactions (
      id, customer_id, type, amount, note, effective_date, created_at,
      sync_id, last_modified, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      customer_id = excluded.customer_id,
      type = excluded.type,
      amount = excluded.amount,
      note = excluded.note,
      effective_date = excluded.effective_date,
      created_at = excluded.created_at,
      sync_id = excluded.sync_id,
      last_modified = excluded.last_modified,
      sync_status = excluded.sync_status`,
    transaction.id,
    transaction.customerId,
    transaction.type,
    transaction.amount,
    transaction.note,
    transaction.effectiveDate,
    transaction.createdAt,
    transaction.syncId,
    transaction.lastModified,
    transaction.syncStatus
  );
}

async function upsertPaymentReminder(
  db: DatabaseWriter,
  reminder: PaymentReminder
): Promise<void> {
  await db.runAsync(
    `INSERT INTO payment_reminders (
      id, customer_id, tone, message, balance_at_send, shared_via, created_at,
      sync_id, last_modified, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      customer_id = excluded.customer_id,
      tone = excluded.tone,
      message = excluded.message,
      balance_at_send = excluded.balance_at_send,
      shared_via = excluded.shared_via,
      created_at = excluded.created_at,
      sync_id = excluded.sync_id,
      last_modified = excluded.last_modified,
      sync_status = excluded.sync_status`,
    reminder.id,
    reminder.customerId,
    reminder.tone,
    reminder.message,
    reminder.balanceAtSend,
    reminder.sharedVia,
    reminder.createdAt,
    reminder.syncId,
    reminder.lastModified,
    reminder.syncStatus
  );
}

async function upsertPaymentPromise(db: DatabaseWriter, promise: PaymentPromise): Promise<void> {
  await db.runAsync(
    `INSERT INTO payment_promises (
      id, customer_id, promised_amount, promised_date, note, status, created_at, updated_at,
      sync_id, last_modified, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      customer_id = excluded.customer_id,
      promised_amount = excluded.promised_amount,
      promised_date = excluded.promised_date,
      note = excluded.note,
      status = excluded.status,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      sync_id = excluded.sync_id,
      last_modified = excluded.last_modified,
      sync_status = excluded.sync_status`,
    promise.id,
    promise.customerId,
    promise.promisedAmount,
    promise.promisedDate,
    promise.note,
    promise.status,
    promise.createdAt,
    promise.updatedAt,
    promise.syncId,
    promise.lastModified,
    promise.syncStatus
  );
}

async function upsertTaxProfile(db: DatabaseWriter, taxProfile: TaxProfile): Promise<void> {
  await db.runAsync(
    `INSERT INTO tax_profiles (
      id, country_code, state_code, tax_type, tax_rules_json, version, last_updated, source,
      sync_id, last_modified, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    taxProfile.id,
    taxProfile.countryCode,
    taxProfile.stateCode,
    taxProfile.taxType,
    taxProfile.taxRulesJson,
    taxProfile.version,
    taxProfile.lastUpdated,
    taxProfile.source,
    taxProfile.syncId,
    taxProfile.lastModified,
    taxProfile.syncStatus
  );
}

async function upsertTaxPack(db: DatabaseWriter, taxPack: TaxPack): Promise<void> {
  await db.runAsync(
    `INSERT INTO tax_packs (
      id, country_code, region_code, tax_type, rules_json, version, last_updated, source, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    taxPack.id,
    taxPack.countryCode,
    taxPack.regionCode,
    taxPack.taxType,
    taxPack.rulesJson,
    taxPack.version,
    taxPack.lastUpdated,
    taxPack.source,
    taxPack.isActive ? 1 : 0
  );
}

async function upsertDocumentTemplate(
  db: DatabaseWriter,
  template: DocumentTemplate
): Promise<void> {
  await db.runAsync(
    `INSERT INTO document_templates (
      id, country_code, template_type, template_config_json, version
    ) VALUES (?, ?, ?, ?, ?)`,
    template.id,
    template.countryCode,
    template.templateType,
    template.templateConfigJson,
    template.version
  );
}

async function upsertComplianceConfig(
  db: DatabaseWriter,
  config: ComplianceConfig
): Promise<void> {
  await db.runAsync(
    `INSERT INTO compliance_configs (
      id, country_code, region_code, config_json, version, last_updated, source, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    config.id,
    config.countryCode,
    config.regionCode,
    config.configJson,
    config.version,
    config.lastUpdated,
    config.source,
    config.isActive ? 1 : 0
  );
}

async function upsertCountryPackage(
  db: DatabaseWriter,
  countryPackage: CountryPackage
): Promise<void> {
  await db.runAsync(
    `INSERT INTO country_packages (
      id, country_code, region_code, package_name, version, tax_pack_id,
      compliance_config_id, installed_at, source, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    countryPackage.id,
    countryPackage.countryCode,
    countryPackage.regionCode,
    countryPackage.packageName,
    countryPackage.version,
    countryPackage.taxPackId,
    countryPackage.complianceConfigId,
    countryPackage.installedAt,
    countryPackage.source,
    countryPackage.isActive ? 1 : 0
  );
}

async function upsertCountryPackageTemplate(
  db: DatabaseWriter,
  templateLink: CountryPackageTemplate
): Promise<void> {
  await db.runAsync(
    `INSERT INTO country_package_templates (
      country_package_id, document_template_id, template_type
    ) VALUES (?, ?, ?)`,
    templateLink.countryPackageId,
    templateLink.documentTemplateId,
    templateLink.templateType
  );
}

async function upsertComplianceReport(
  db: DatabaseWriter,
  report: ComplianceReport
): Promise<void> {
  await db.runAsync(
    `INSERT INTO compliance_reports (
      id, country_code, report_type, generated_at, report_data_json
    ) VALUES (?, ?, ?, ?, ?)`,
    report.id,
    report.countryCode,
    report.reportType,
    report.generatedAt,
    report.reportDataJson
  );
}

async function upsertProduct(db: DatabaseWriter, product: Product): Promise<void> {
  await db.runAsync(
    `INSERT INTO products (
      id, name, price, stock_quantity, unit, created_at, sync_id, last_modified, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    product.id,
    product.name,
    product.price,
    product.stockQuantity,
    product.unit,
    product.createdAt,
    product.syncId,
    product.lastModified,
    product.syncStatus
  );
}

async function upsertInvoice(db: DatabaseWriter, invoice: Invoice): Promise<void> {
  await db.runAsync(
    `INSERT INTO invoices (
      id, customer_id, invoice_number, issue_date, due_date, subtotal, tax_amount,
      total_amount, status, notes, created_at, sync_id, last_modified, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    invoice.id,
    invoice.customerId,
    invoice.invoiceNumber,
    invoice.issueDate,
    invoice.dueDate,
    invoice.subtotal,
    invoice.taxAmount,
    invoice.totalAmount,
    invoice.status,
    invoice.notes,
    invoice.createdAt,
    invoice.syncId,
    invoice.lastModified,
    invoice.syncStatus
  );
}

async function upsertInvoiceItem(db: DatabaseWriter, item: InvoiceItem): Promise<void> {
  await db.runAsync(
    `INSERT INTO invoice_items (
      id, invoice_id, product_id, name, description, quantity, price, tax_rate, total,
      sync_id, last_modified, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    item.id,
    item.invoiceId,
    item.productId,
    item.name,
    item.description,
    item.quantity,
    item.price,
    item.taxRate,
    item.total,
    item.syncId,
    item.lastModified,
    item.syncStatus
  );
}

async function upsertAppPreference(
  db: DatabaseWriter,
  preference: BackupAppPreference
): Promise<void> {
  await db.runAsync(
    `INSERT INTO app_preferences (key, value, updated_at)
     VALUES (?, ?, ?)`,
    preference.key,
    preference.value,
    preference.updatedAt
  );
}

async function upsertAppSecurity(db: DatabaseWriter, security: AppSecurity): Promise<void> {
  await db.runAsync(
    `INSERT INTO app_security (id, pin_enabled, pin_hash, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
      pin_enabled = excluded.pin_enabled,
      pin_hash = excluded.pin_hash,
      updated_at = excluded.updated_at`,
    security.id,
    security.pinEnabled ? 1 : 0,
    security.pinHash,
    security.updatedAt
  );
}

function defaultAppSecurity(): AppSecurity {
  return {
    id: APP_SECURITY_ID,
    pinEnabled: false,
    pinHash: null,
    updatedAt: new Date().toISOString(),
  };
}

function getCustomerTimelineNotesFromBackup(backup: OrbitLedgerBackup): CustomerTimelineNote[] {
  const notes = backup.data.extensions?.customerTimelineNotes;
  if (!Array.isArray(notes)) {
    return [];
  }

  return notes.filter(isCustomerTimelineNote);
}

function isCustomerTimelineNote(value: unknown): value is CustomerTimelineNote {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const note = value as Partial<CustomerTimelineNote>;
  return (
    typeof note.id === 'string' &&
    typeof note.customerId === 'string' &&
    (note.kind === 'note' || note.kind === 'dispute') &&
    typeof note.body === 'string' &&
    typeof note.createdAt === 'string' &&
    typeof note.updatedAt === 'string' &&
    typeof note.syncId === 'string' &&
    typeof note.lastModified === 'string' &&
    typeof note.syncStatus === 'string'
  );
}

function buildRecordCounts(input: {
  customers: Customer[];
  transactions: LedgerTransaction[];
  paymentReminders: PaymentReminder[];
  paymentPromises: PaymentPromise[];
  taxProfiles: TaxProfile[];
  taxPacks: TaxPack[];
  documentTemplates: DocumentTemplate[];
  complianceConfigs: ComplianceConfig[];
  countryPackages: CountryPackage[];
  countryPackageTemplates: CountryPackageTemplate[];
  complianceReports: ComplianceReport[];
  products: Product[];
  invoices: Invoice[];
  invoiceItems: InvoiceItem[];
  appPreferences: BackupAppPreference[];
  documentHistory: unknown[];
}): BackupRecordCounts {
  return {
    customers: input.customers.length,
    transactions: input.transactions.length,
    paymentReminders: input.paymentReminders.length,
    paymentPromises: input.paymentPromises.length,
    taxProfiles: input.taxProfiles.length,
    taxPacks: input.taxPacks.length,
    documentTemplates: input.documentTemplates.length,
    complianceConfigs: input.complianceConfigs.length,
    countryPackages: input.countryPackages.length,
    countryPackageTemplates: input.countryPackageTemplates.length,
    complianceReports: input.complianceReports.length,
    products: input.products.length,
    invoices: input.invoices.length,
    invoiceItems: input.invoiceItems.length,
    appPreferences: input.appPreferences.length,
    documentHistory: input.documentHistory.length,
  };
}

async function readRestoreSnapshot(db: SQLiteDatabase): Promise<RestoreSnapshot> {
  const [
    businessSettingsSignature,
    customersSignature,
    transactionsSignature,
    paymentRemindersSignature,
    paymentPromisesSignature,
    taxProfilesSignature,
    taxPacksSignature,
    documentTemplatesSignature,
    complianceConfigsSignature,
    countryPackagesSignature,
    countryPackageTemplatesSignature,
    complianceReportsSignature,
    productsSignature,
    invoicesSignature,
    invoiceItemsSignature,
    appPreferencesSignature,
    appSecuritySignature,
  ] = await Promise.all([
    readTableSignature(
      db,
      `SELECT COALESCE(group_concat(
        id || ':' || updated_at || ':' || business_name,
        '|'
      ), '') AS signature
      FROM (
        SELECT id, updated_at, business_name
        FROM business_settings
        ORDER BY id
      )`
    ),
    readTableSignature(
      db,
      `SELECT COALESCE(group_concat(
        id || ':' || updated_at || ':' || name || ':' || opening_balance || ':' || is_archived,
        '|'
      ), '') AS signature
      FROM (
        SELECT id, updated_at, name, opening_balance, is_archived
        FROM customers
        ORDER BY id
      )`
    ),
    readTableSignature(
      db,
      `SELECT COALESCE(group_concat(
        id || ':' || customer_id || ':' || type || ':' || amount || ':' || effective_date || ':' || created_at,
        '|'
      ), '') AS signature
      FROM (
        SELECT id, customer_id, type, amount, effective_date, created_at
        FROM transactions
        ORDER BY id
      )`
    ),
    readTableSignature(
      db,
      `SELECT COALESCE(group_concat(
        id || ':' || customer_id || ':' || tone || ':' || balance_at_send || ':' || created_at,
        '|'
      ), '') AS signature
      FROM (
        SELECT id, customer_id, tone, balance_at_send, created_at
        FROM payment_reminders
        ORDER BY id
      )`
    ),
    readTableSignature(
      db,
      `SELECT COALESCE(group_concat(
        id || ':' || customer_id || ':' || promised_amount || ':' || promised_date || ':' || status || ':' || updated_at,
        '|'
      ), '') AS signature
      FROM (
        SELECT id, customer_id, promised_amount, promised_date, status, updated_at
        FROM payment_promises
        ORDER BY id
      )`
    ),
    readTableSignature(
      db,
      `SELECT COALESCE(group_concat(
        id || ':' || country_code || ':' || state_code || ':' || tax_type || ':' || tax_rules_json || ':' || version || ':' || last_updated || ':' || source,
        '|'
      ), '') AS signature
      FROM (
        SELECT id, country_code, state_code, tax_type, tax_rules_json, version, last_updated, source
        FROM tax_profiles
        ORDER BY id
      )`
    ),
    readTableSignature(
      db,
      `SELECT COALESCE(group_concat(
        id || ':' || country_code || ':' || region_code || ':' || tax_type || ':' || rules_json || ':' || version || ':' || last_updated || ':' || source || ':' || is_active,
        '|'
      ), '') AS signature
      FROM (
        SELECT id, country_code, region_code, tax_type, rules_json, version, last_updated, source, is_active
        FROM tax_packs
        ORDER BY id
      )`
    ),
    readTableSignature(
      db,
      `SELECT COALESCE(group_concat(
        id || ':' || country_code || ':' || template_type || ':' || template_config_json || ':' || version,
        '|'
      ), '') AS signature
      FROM (
        SELECT id, country_code, template_type, template_config_json, version
        FROM document_templates
        ORDER BY id
      )`
    ),
    readTableSignature(
      db,
      `SELECT COALESCE(group_concat(
        id || ':' || country_code || ':' || region_code || ':' || config_json || ':' || version || ':' || last_updated || ':' || source || ':' || is_active,
        '|'
      ), '') AS signature
      FROM (
        SELECT id, country_code, region_code, config_json, version, last_updated, source, is_active
        FROM compliance_configs
        ORDER BY id
      )`
    ),
    readTableSignature(
      db,
      `SELECT COALESCE(group_concat(
        id || ':' || country_code || ':' || region_code || ':' || version || ':' || tax_pack_id || ':' || compliance_config_id || ':' || installed_at || ':' || source || ':' || is_active,
        '|'
      ), '') AS signature
      FROM (
        SELECT id, country_code, region_code, version, tax_pack_id, compliance_config_id, installed_at, source, is_active
        FROM country_packages
        ORDER BY id
      )`
    ),
    readTableSignature(
      db,
      `SELECT COALESCE(group_concat(
        country_package_id || ':' || document_template_id || ':' || template_type,
        '|'
      ), '') AS signature
      FROM (
        SELECT country_package_id, document_template_id, template_type
        FROM country_package_templates
        ORDER BY country_package_id, template_type
      )`
    ),
    readTableSignature(
      db,
      `SELECT COALESCE(group_concat(
        id || ':' || country_code || ':' || report_type || ':' || generated_at || ':' || report_data_json,
        '|'
      ), '') AS signature
      FROM (
        SELECT id, country_code, report_type, generated_at, report_data_json
        FROM compliance_reports
        ORDER BY id
      )`
    ),
    readTableSignature(
      db,
      `SELECT COALESCE(group_concat(
        id || ':' || name || ':' || price || ':' || stock_quantity || ':' || unit || ':' || created_at,
        '|'
      ), '') AS signature
      FROM (
        SELECT id, name, price, stock_quantity, unit, created_at
        FROM products
        ORDER BY id
      )`
    ),
    readTableSignature(
      db,
      `SELECT COALESCE(group_concat(
        id || ':' || COALESCE(customer_id, '') || ':' || invoice_number || ':' || issue_date || ':' || COALESCE(due_date, '') || ':' || subtotal || ':' || tax_amount || ':' || total_amount || ':' || status || ':' || created_at,
        '|'
      ), '') AS signature
      FROM (
        SELECT id, customer_id, invoice_number, issue_date, due_date, subtotal, tax_amount, total_amount, status, created_at
        FROM invoices
        ORDER BY id
      )`
    ),
    readTableSignature(
      db,
      `SELECT COALESCE(group_concat(
        id || ':' || invoice_id || ':' || COALESCE(product_id, '') || ':' || name || ':' || COALESCE(description, '') || ':' || quantity || ':' || price || ':' || tax_rate || ':' || total,
        '|'
      ), '') AS signature
      FROM (
        SELECT id, invoice_id, product_id, name, description, quantity, price, tax_rate, total
        FROM invoice_items
        ORDER BY id
      )`
    ),
    readTableSignature(
      db,
      `SELECT COALESCE(group_concat(
        key || ':' || value || ':' || updated_at,
        '|'
      ), '') AS signature
      FROM (
        SELECT key, value, updated_at
        FROM app_preferences
        ORDER BY key
      )`
    ),
    readTableSignature(
      db,
      `SELECT COALESCE(group_concat(
        id || ':' || pin_enabled || ':' || COALESCE(pin_hash, '') || ':' || updated_at,
        '|'
      ), '') AS signature
      FROM (
        SELECT id, pin_enabled, pin_hash, updated_at
        FROM app_security
        ORDER BY id
      )`
    ),
  ]);

  return {
    businessSettingsSignature,
    customersSignature,
    transactionsSignature,
    paymentRemindersSignature,
    paymentPromisesSignature,
    taxProfilesSignature,
    taxPacksSignature,
    documentTemplatesSignature,
    complianceConfigsSignature,
    countryPackagesSignature,
    countryPackageTemplatesSignature,
    complianceReportsSignature,
    productsSignature,
    invoicesSignature,
    invoiceItemsSignature,
    appPreferencesSignature,
    appSecuritySignature,
  };
}

async function readRestoreSnapshotSafely(db: SQLiteDatabase): Promise<RestoreSnapshot | null> {
  try {
    return await readRestoreSnapshot(db);
  } catch (error) {
    console.warn('[backup-restore] Restore snapshot could not be read after failure', error);
    return null;
  }
}

async function readTableSignature(db: SQLiteDatabase, query: string): Promise<string> {
  const row = await db.getFirstAsync<SnapshotRow>(query);
  return row?.signature ?? '';
}

function restoreSnapshotsMatch(before: RestoreSnapshot, after: RestoreSnapshot): boolean {
  return (
    before.businessSettingsSignature === after.businessSettingsSignature &&
    before.customersSignature === after.customersSignature &&
    before.transactionsSignature === after.transactionsSignature &&
    before.paymentRemindersSignature === after.paymentRemindersSignature &&
    before.paymentPromisesSignature === after.paymentPromisesSignature &&
    before.taxProfilesSignature === after.taxProfilesSignature &&
    before.taxPacksSignature === after.taxPacksSignature &&
    before.documentTemplatesSignature === after.documentTemplatesSignature &&
    before.complianceConfigsSignature === after.complianceConfigsSignature &&
    before.countryPackagesSignature === after.countryPackagesSignature &&
    before.countryPackageTemplatesSignature === after.countryPackageTemplatesSignature &&
    before.complianceReportsSignature === after.complianceReportsSignature &&
    before.productsSignature === after.productsSignature &&
    before.invoicesSignature === after.invoicesSignature &&
    before.invoiceItemsSignature === after.invoiceItemsSignature &&
    before.appPreferencesSignature === after.appPreferencesSignature &&
    before.appSecuritySignature === after.appSecuritySignature
  );
}

function didRestorePreserveCurrentData(
  error: unknown,
  beforeRestore: RestoreSnapshot | null,
  afterRestore: RestoreSnapshot | null
): boolean {
  if (error instanceof BackupRestoreError) {
    return error.currentDataPreserved;
  }

  if (!beforeRestore) {
    return true;
  }

  return afterRestore ? restoreSnapshotsMatch(beforeRestore, afterRestore) : false;
}

function logRestoreAudit(
  step: string,
  plan?: RestoreBackupPlan,
  details?: Record<string, unknown>
): void {
  console.info('[backup-restore-audit]', {
    step,
    mode: plan?.mode,
    preparedAt: plan?.preparedAt,
    businessName: plan?.businessName,
    customersToRestore: plan?.customersToRestore,
    transactionsToRestore: plan?.transactionsToRestore,
    appSecurityToRestore: plan?.appSecurityToRestore,
    ...details,
  });
}
