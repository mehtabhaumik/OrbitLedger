import type { SQLiteDatabase } from 'expo-sqlite';
import {
  buildCustomerHealthScore,
  deriveInvoicePaymentStatus,
  legacyStatusForInvoiceLifecycle,
  normalizePaymentMode,
  normalizePaymentModeDetails,
  normalizeInvoiceDocumentState,
  normalizeInvoicePaymentStatus,
  validatePaymentModeDetails,
  type InvoiceDocumentState,
  type InvoicePaymentStatus,
  type PaymentAllocationStrategy,
  type PaymentMode,
  type PaymentModeDetails,
} from '@orbit-ledger/core';

import { calculateLedgerBalance } from './balance';
import { getDatabase } from './client';
import { buildCustomerPaymentInsight } from './customerInsights';
import { throwDatabaseError } from './errors';
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
  mapInvoiceVersion,
  mapPaymentAllocation,
  mapPaymentReminder,
  mapPaymentPromise,
  mapPaymentPromiseWithCustomer,
  mapProduct,
  mapRecentTransaction,
  mapTaxPack,
  mapTaxProfile,
  mapTransaction,
} from './mappers';
import {
  APP_SECURITY_ID,
  BUSINESS_SETTINGS_ID,
  DOCUMENT_TAX_NOTICE_ACKNOWLEDGED_KEY,
} from './schema';
import {
  assertPositiveAmount,
  cleanText,
  createEntityId,
  escapeLikeQuery,
  localDayBounds,
  requiredText,
  toDateOnlyIso,
} from './utils';
import { calculateItemTaxTotal, roundCurrency } from '../tax/calculator';
import { mapInvoiceItemToTaxEngineInput } from '../mapping';
import { measurePerformance } from '../performance';
import type {
  AddCustomerInput,
  AddCustomerTimelineNoteInput,
  AddInvoiceInput,
  AddPaymentReminderInput,
  AddPaymentPromiseInput,
  AddProductInput,
  AddTransactionInput,
  AppFeatureToggles,
  AppSecurity,
  AppSecurityRow,
  AppPreferenceRow,
  BusinessSettings,
  BusinessSettingsRow,
  ComplianceConfig,
  ComplianceConfigLookup,
  ComplianceConfigRow,
  ComplianceReport,
  ComplianceReportRow,
  ComplianceReportType,
  CountryPackageLookup,
  CountryPackageRow,
  CountryPackageSource,
  CountryPackageWithComponents,
  Customer,
  CustomerLedger,
  CustomerRow,
  CustomerTimelineNote,
  CustomerTimelineNoteRow,
  CustomerSummary,
  CustomerSummaryFilter,
  CollectionCustomer,
  DocumentTemplate,
  DocumentTemplateLookup,
  DocumentTemplateRow,
  DocumentTemplateType,
  DashboardSummary,
  Invoice,
  InstallCountryPackageInput,
  InvoicePaymentAllocation,
  InvoiceItemRow,
  InvoiceListOptions,
  InvoiceRow,
  InvoiceStatus,
  InvoiceVersion,
  InvoiceVersionRow,
  InvoiceWithItems,
  LedgerTransaction,
  LedgerTransactionRow,
  ListComplianceReportsOptions,
  PaymentReminder,
  PaymentReminderRow,
  PaymentPromiseWithCustomer,
  PaymentPromiseWithCustomerRow,
  PaymentPromise,
  PaymentPromiseRow,
  PaymentPromiseStatus,
  PaymentAllocationRow,
  Product,
  ProductListOptions,
  ProductRow,
  RecentTransaction,
  RecentTransactionRow,
  ReportsSummary,
  SaveBusinessSettingsInput,
  SaveComplianceConfigInput,
  SaveComplianceReportInput,
  SaveDocumentTemplateInput,
  SaveTaxPackInput,
  SaveTaxProfileInput,
  SearchCustomerSummariesOptions,
  StoredTaxProfileSource,
  TaxProfile,
  TaxProfileLookup,
  TaxProfileRow,
  TaxPack,
  TaxPackLookup,
  TaxPackRow,
  TaxPackSource,
  TopDueCustomer,
  TopReportCustomer,
  UpdateCustomerInput,
  UpdateInvoiceInput,
  UpdatePaymentPromiseInput,
  UpdateProductInput,
  UpdateTransactionInput,
} from './types';

const FEATURE_TOGGLES_KEY = 'feature_toggles';
const TAX_PACK_LAST_CHECK_PREFIX = 'tax_pack_last_check';
const COUNTRY_PACKAGE_LAST_CHECK_PREFIX = 'country_package_last_check';

const DEFAULT_FEATURE_TOGGLES: AppFeatureToggles = {
  invoices: true,
  inventory: true,
  tax: true,
};

type BalanceRow = {
  balance: number | null;
};

class DuplicateCustomerError extends Error {
  constructor() {
    super('This customer already exists with the same name and phone.');
    this.name = 'DuplicateCustomerError';
  }
}

type DashboardSummaryRow = {
  total_receivable: number | null;
  customers_with_outstanding_balance: number | null;
  today_entries: number | null;
  recent_payments_received: number | null;
  follow_up_customer_count: number | null;
  recent_activity_count: number | null;
  previous_activity_count: number | null;
};

type CustomerSummaryRow = CustomerRow & {
  balance: number;
  latest_activity_at: string;
  oldest_credit_at: string | null;
  last_payment_at: string | null;
  total_credit: number | null;
  total_payment: number | null;
  payment_count: number | null;
};

type TopDueCustomerRow = CustomerSummaryRow & {
  last_payment_at: string | null;
  last_reminder_at: string | null;
};

type CollectionCustomerRow = TopDueCustomerRow & {
  oldest_credit_at: string | null;
};

type ReportsSummaryRow = {
  total_sales: number | null;
  total_credit: number | null;
  invoice_count: number | null;
  credit_entry_count: number | null;
  current_sales: number | null;
  previous_sales: number | null;
  current_credit: number | null;
  previous_credit: number | null;
};

type TopReportCustomerRow = {
  id: string;
  name: string;
  total_sales: number | null;
  total_credit: number | null;
  balance: number | null;
  latest_activity_at: string | null;
};

type PreparedInvoiceItem = {
  id: string;
  productId: string | null;
  name: string;
  description: string | null;
  quantity: number;
  price: number;
  taxRate: number;
  taxableAmount: number;
  taxAmount: number;
  total: number;
};

type PreparedInvoiceTotals = {
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  items: PreparedInvoiceItem[];
};

const invoiceStatuses: InvoiceStatus[] = ['draft', 'issued', 'paid', 'overdue', 'cancelled'];
const invoicePaymentStatuses: InvoicePaymentStatus[] = ['unpaid', 'partially_paid', 'paid', 'overdue'];
const transactionTypes = ['credit', 'payment'] as const;
const paymentPromiseStatuses: PaymentPromiseStatus[] = ['open', 'fulfilled', 'missed', 'cancelled'];
const taxProfileSources: StoredTaxProfileSource[] = ['manual', 'remote', 'seed'];
const taxPackSources: TaxPackSource[] = ['manual', 'remote'];
const countryPackageSources: CountryPackageSource[] = ['manual', 'remote'];
const documentTemplateTypes: DocumentTemplateType[] = ['invoice', 'statement'];
const complianceReportTypes: ComplianceReportType[] = [
  'tax_summary',
  'sales_summary',
  'dues_summary',
];

export async function saveBusinessSettings(input: SaveBusinessSettingsInput): Promise<BusinessSettings> {
  try {
    const db = await getDatabase();
    const now = new Date().toISOString();
    const existing = await getBusinessSettings();
    const createdAt = existing?.createdAt ?? now;

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
        sync_status,
        server_revision
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        updated_at = excluded.updated_at,
        sync_id = CASE
          WHEN business_settings.sync_id = '' THEN excluded.sync_id
          ELSE business_settings.sync_id
        END,
        last_modified = excluded.last_modified,
        sync_status = excluded.sync_status,
        server_revision = excluded.server_revision`,
      BUSINESS_SETTINGS_ID,
      requiredText(input.businessName),
      requiredText(input.ownerName),
      requiredText(input.phone),
      requiredText(input.email),
      requiredText(input.address),
      requiredText(input.currency).toUpperCase(),
      requiredText(input.countryCode).toUpperCase(),
      requiredText(input.stateCode).toUpperCase(),
      cleanText(input.logoUri),
      requiredText(input.authorizedPersonName),
      requiredText(input.authorizedPersonTitle),
      cleanText(input.signatureUri),
      input.taxMode ?? existing?.taxMode ?? 'not_configured',
      cleanText(input.taxProfileVersion ?? existing?.taxProfileVersion),
      input.taxProfileSource ?? existing?.taxProfileSource ?? 'none',
      cleanText(input.taxLastSyncedAt ?? existing?.taxLastSyncedAt),
      input.taxSetupRequired ?? existing?.taxSetupRequired ?? true ? 1 : 0,
      input.storageMode ?? existing?.storageMode ?? 'local_only',
      cleanText(input.workspaceId ?? existing?.workspaceId),
      input.syncEnabled ?? existing?.syncEnabled ?? false ? 1 : 0,
      cleanText(input.lastSyncedAt ?? existing?.lastSyncedAt),
      createdAt,
      now,
      existing?.syncId ?? BUSINESS_SETTINGS_ID,
      now,
      'pending',
      input.serverRevision ?? existing?.serverRevision ?? 0
    );

    const saved = await getBusinessSettings();
    if (!saved) {
      throw new Error('Business settings were not saved.');
    }

    return saved;
  } catch (error) {
    return throwDatabaseError('saveBusinessSettings', error);
  }
}

export async function getBusinessSettings(): Promise<BusinessSettings | null> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<BusinessSettingsRow>(
      'SELECT * FROM business_settings WHERE id = ? LIMIT 1',
      BUSINESS_SETTINGS_ID
    );

    return row ? mapBusinessSettings(row) : null;
  } catch (error) {
    return throwDatabaseError('getBusinessSettings', error);
  }
}

export async function saveTaxProfile(input: SaveTaxProfileInput): Promise<TaxProfile> {
  try {
    const db = await getDatabase();
    const countryCode = normalizeRequiredCode(input.countryCode, 'Country code');
    const stateCode = normalizeOptionalCode(input.stateCode);
    const taxType = normalizeRequiredCode(input.taxType, 'Tax type');
    const taxRulesJson = normalizeTaxRulesJson(input.taxRulesJson);
    const version = requiredText(input.version);
    const lastUpdated = cleanText(input.lastUpdated) ?? new Date().toISOString();
    const source = input.source ?? 'manual';
    const id = createEntityId('tax');

    if (!version) {
      throw new Error('Tax profile version is required.');
    }

    if (!taxProfileSources.includes(source)) {
      throw new Error(`Unsupported tax profile source: ${source}`);
    }

    await db.runAsync(
      `INSERT INTO tax_profiles (
        id,
        country_code,
        state_code,
        tax_type,
        tax_rules_json,
        version,
        last_updated,
        source,
        sync_id,
        last_modified,
        sync_status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(country_code, state_code, tax_type) DO UPDATE SET
        tax_rules_json = excluded.tax_rules_json,
        version = excluded.version,
        last_updated = excluded.last_updated,
        source = excluded.source,
        sync_id = CASE
          WHEN tax_profiles.sync_id = '' THEN excluded.sync_id
          ELSE tax_profiles.sync_id
        END,
        last_modified = excluded.last_modified,
        sync_status = excluded.sync_status`,
      id,
      countryCode,
      stateCode,
      taxType,
      taxRulesJson,
      version,
      lastUpdated,
      source,
      id,
      lastUpdated,
      'pending'
    );

    const saved = await getTaxProfile({ countryCode, stateCode, taxType });
    if (!saved) {
      throw new Error('Tax profile was not saved.');
    }

    return saved;
  } catch (error) {
    return throwDatabaseError('saveTaxProfile', error);
  }
}

export async function saveManualTaxProfileOverride(
  input: Omit<SaveTaxProfileInput, 'source'>
): Promise<TaxProfile> {
  return saveTaxProfile({ ...input, source: 'manual' });
}

export async function saveFetchedTaxProfile(input: Omit<SaveTaxProfileInput, 'source'>): Promise<TaxProfile> {
  return saveTaxProfile({ ...input, source: 'remote' });
}

export async function getTaxProfile(lookup: TaxProfileLookup): Promise<TaxProfile | null> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<TaxProfileRow>(
      `SELECT * FROM tax_profiles
       WHERE country_code = ?
         AND state_code = ?
         AND tax_type = ?
       LIMIT 1`,
      normalizeRequiredCode(lookup.countryCode, 'Country code'),
      normalizeOptionalCode(lookup.stateCode),
      normalizeRequiredCode(lookup.taxType, 'Tax type')
    );

    return row ? mapTaxProfile(row) : null;
  } catch (error) {
    return throwDatabaseError('getTaxProfile', error);
  }
}

export async function listTaxProfiles(countryCode?: string, stateCode?: string | null): Promise<TaxProfile[]> {
  try {
    const db = await getDatabase();
    const whereClauses: string[] = [];
    const queryParams: string[] = [];

    if (countryCode !== undefined) {
      whereClauses.push('country_code = ?');
      queryParams.push(normalizeRequiredCode(countryCode, 'Country code'));
    }

    if (stateCode !== undefined) {
      whereClauses.push('state_code = ?');
      queryParams.push(normalizeOptionalCode(stateCode));
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const rows = await db.getAllAsync<TaxProfileRow>(
      `SELECT * FROM tax_profiles
       ${whereSql}
       ORDER BY country_code ASC, state_code ASC, tax_type ASC`,
      ...queryParams
    );

    return rows.map(mapTaxProfile);
  } catch (error) {
    return throwDatabaseError('listTaxProfiles', error);
  }
}

export async function saveTaxPack(input: SaveTaxPackInput): Promise<TaxPack> {
  try {
    const db = await getDatabase();
    const countryCode = normalizeRequiredCode(input.countryCode, 'Country code');
    const regionCode = normalizeOptionalCode(input.regionCode);
    const taxType = normalizeRequiredCode(input.taxType, 'Tax type');
    const rulesJson = normalizeTaxRulesJson(input.rulesJson);
    const version = requiredText(input.version);
    const lastUpdated = cleanText(input.lastUpdated) ?? new Date().toISOString();
    const source = input.source ?? 'manual';
    const isActive = input.isActive ?? true;
    const id = createEntityId('txp');

    if (!version) {
      throw new Error('Tax pack version is required.');
    }

    if (!taxPackSources.includes(source)) {
      throw new Error(`Unsupported tax pack source: ${source}`);
    }

    await db.withTransactionAsync(async () => {
      if (isActive) {
        await db.runAsync(
          `UPDATE tax_packs
           SET is_active = 0
           WHERE country_code = ?
             AND region_code = ?
             AND tax_type = ?`,
          countryCode,
          regionCode,
          taxType
        );
      }

      await db.runAsync(
        `INSERT INTO tax_packs (
          id,
          country_code,
          region_code,
          tax_type,
          rules_json,
          version,
          last_updated,
          source,
          is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(country_code, region_code, tax_type, version) DO UPDATE SET
          rules_json = excluded.rules_json,
          last_updated = excluded.last_updated,
          source = excluded.source,
          is_active = excluded.is_active`,
        id,
        countryCode,
        regionCode,
        taxType,
        rulesJson,
        version,
        lastUpdated,
        source,
        isActive ? 1 : 0
      );
    });

    const saved = await getTaxPackVersion({
      countryCode,
      regionCode,
      taxType,
      version,
    });
    if (!saved) {
      throw new Error('Tax pack was not saved.');
    }

    return saved;
  } catch (error) {
    return throwDatabaseError('saveTaxPack', error);
  }
}

export async function saveDocumentTemplate(
  input: SaveDocumentTemplateInput
): Promise<DocumentTemplate> {
  try {
    const db = await getDatabase();
    const countryCode = normalizeRequiredCode(input.countryCode, 'Country code');
    const templateType = normalizeDocumentTemplateType(input.templateType);
    const templateConfigJson = normalizeDocumentTemplateConfigJson(input.templateConfigJson);
    const version = requiredText(input.version);
    const id = createEntityId('dtp');

    if (!version) {
      throw new Error('Document template version is required.');
    }

    await db.runAsync(
      `INSERT INTO document_templates (
        id,
        country_code,
        template_type,
        template_config_json,
        version
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(country_code, template_type, version) DO UPDATE SET
        template_config_json = excluded.template_config_json`,
      id,
      countryCode,
      templateType,
      templateConfigJson,
      version
    );

    const saved = await getDocumentTemplate({ countryCode, templateType, version });
    if (!saved) {
      throw new Error('Document template was not saved.');
    }

    return saved;
  } catch (error) {
    return throwDatabaseError('saveDocumentTemplate', error);
  }
}

export async function getDocumentTemplate(
  lookup: DocumentTemplateLookup
): Promise<DocumentTemplate | null> {
  try {
    const db = await getDatabase();
    const countryCode = normalizeRequiredCode(lookup.countryCode, 'Country code');
    const regionCode = normalizeOptionalCode(lookup.regionCode);
    const templateType = normalizeDocumentTemplateType(lookup.templateType);

    if (lookup.version !== undefined) {
      const row = await db.getFirstAsync<DocumentTemplateRow>(
        `SELECT * FROM document_templates
         WHERE country_code = ?
           AND template_type = ?
           AND version = ?
         LIMIT 1`,
        countryCode,
        templateType,
        requiredText(lookup.version)
      );

      return row ? mapDocumentTemplate(row) : null;
    }

    const packagedRow = await getActivePackageDocumentTemplateRow(
      db,
      countryCode,
      regionCode,
      templateType
    );
    if (packagedRow) {
      return mapDocumentTemplate(packagedRow);
    }

    const row = await db.getFirstAsync<DocumentTemplateRow>(
      `SELECT * FROM document_templates
       WHERE country_code = ?
         AND template_type = ?
       ORDER BY version DESC
       LIMIT 1`,
      countryCode,
      templateType
    );

    return row ? mapDocumentTemplate(row) : null;
  } catch (error) {
    return throwDatabaseError('getDocumentTemplate', error);
  }
}

export async function listDocumentTemplates(
  lookup?: Partial<DocumentTemplateLookup>
): Promise<DocumentTemplate[]> {
  try {
    const db = await getDatabase();
    const whereClauses: string[] = [];
    const queryParams: string[] = [];

    if (lookup?.countryCode !== undefined) {
      whereClauses.push('country_code = ?');
      queryParams.push(normalizeRequiredCode(lookup.countryCode, 'Country code'));
    }

    if (lookup?.templateType !== undefined) {
      whereClauses.push('template_type = ?');
      queryParams.push(normalizeDocumentTemplateType(lookup.templateType));
    }

    if (lookup?.version !== undefined) {
      whereClauses.push('version = ?');
      queryParams.push(requiredText(lookup.version));
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const rows = await db.getAllAsync<DocumentTemplateRow>(
      `SELECT * FROM document_templates
       ${whereSql}
       ORDER BY country_code ASC, template_type ASC, version DESC`,
      ...queryParams
    );

    return rows.map(mapDocumentTemplate);
  } catch (error) {
    return throwDatabaseError('listDocumentTemplates', error);
  }
}

export async function saveComplianceConfig(
  input: SaveComplianceConfigInput
): Promise<ComplianceConfig> {
  try {
    const db = await getDatabase();
    const saved = await upsertComplianceConfig(db, input);
    return saved;
  } catch (error) {
    return throwDatabaseError('saveComplianceConfig', error);
  }
}

export async function getComplianceConfig(
  lookup: ComplianceConfigLookup
): Promise<ComplianceConfig | null> {
  try {
    const db = await getDatabase();
    const countryCode = normalizeRequiredCode(lookup.countryCode, 'Country code');
    const regionCode = normalizeOptionalCode(lookup.regionCode);

    if (lookup.version !== undefined) {
      const row = await db.getFirstAsync<ComplianceConfigRow>(
        `SELECT * FROM compliance_configs
         WHERE country_code = ?
           AND region_code = ?
           AND version = ?
         LIMIT 1`,
        countryCode,
        regionCode,
        requiredText(lookup.version)
      );

      return row ? mapComplianceConfig(row) : null;
    }

    const row = await db.getFirstAsync<ComplianceConfigRow>(
      `SELECT * FROM compliance_configs
       WHERE country_code = ?
         AND (region_code = ? OR region_code = '')
         AND is_active = 1
       ORDER BY CASE WHEN region_code = ? THEN 0 ELSE 1 END,
         last_updated DESC
       LIMIT 1`,
      countryCode,
      regionCode,
      regionCode
    );

    return row ? mapComplianceConfig(row) : null;
  } catch (error) {
    return throwDatabaseError('getComplianceConfig', error);
  }
}

export async function installCountryPackage(
  input: InstallCountryPackageInput
): Promise<CountryPackageWithComponents> {
  try {
    const db = await getDatabase();
    const countryCode = normalizeRequiredCode(input.countryCode, 'Country code');
    const regionCode = normalizeOptionalCode(input.regionCode);
    const packageName = requiredText(input.packageName);
    const version = requiredText(input.version);
    const source = input.source ?? 'manual';
    const installedAt = new Date().toISOString();

    if (!packageName) {
      throw new Error('Country package name is required.');
    }

    if (!version) {
      throw new Error('Country package version is required.');
    }

    if (!countryPackageSources.includes(source)) {
      throw new Error(`Unsupported country package source: ${source}`);
    }

    validateCountryPackageInput(countryCode, regionCode, input);

    let installedPackageId: string | null = null;

    await db.withTransactionAsync(async () => {
      const taxPack = await upsertTaxPack(db, {
        ...input.taxPack,
        isActive: true,
      });
      const complianceConfig = await upsertComplianceConfig(db, {
        ...input.complianceConfig,
        isActive: true,
      });
      const templates: DocumentTemplate[] = [];

      for (const templateInput of input.templates) {
        templates.push(await upsertDocumentTemplate(db, templateInput));
      }

      await db.runAsync(
        `UPDATE country_packages
         SET is_active = 0
         WHERE country_code = ?
           AND region_code = ?`,
        countryCode,
        regionCode
      );

      await db.runAsync(
        `INSERT INTO country_packages (
          id,
          country_code,
          region_code,
          package_name,
          version,
          tax_pack_id,
          compliance_config_id,
          installed_at,
          source,
          is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        ON CONFLICT(country_code, region_code, version) DO UPDATE SET
          package_name = excluded.package_name,
          tax_pack_id = excluded.tax_pack_id,
          compliance_config_id = excluded.compliance_config_id,
          installed_at = excluded.installed_at,
          source = excluded.source,
          is_active = 1`,
        createEntityId('cpk'),
        countryCode,
        regionCode,
        packageName,
        version,
        taxPack.id,
        complianceConfig.id,
        installedAt,
        source
      );

      const packageRow = await getCountryPackageRow(db, { countryCode, regionCode, version });
      if (!packageRow) {
        throw new Error('Country package was not saved.');
      }

      installedPackageId = packageRow.id;
      await db.runAsync(
        'DELETE FROM country_package_templates WHERE country_package_id = ?',
        packageRow.id
      );

      for (const template of templates) {
        await db.runAsync(
          `INSERT INTO country_package_templates (
            country_package_id,
            document_template_id,
            template_type
          ) VALUES (?, ?, ?)`,
          packageRow.id,
          template.id,
          template.templateType
        );
      }
    });

    if (!installedPackageId) {
      throw new Error('Country package installation did not complete.');
    }

    const installed = await getCountryPackage({ countryCode, regionCode, version });
    if (!installed) {
      throw new Error('Installed country package could not be loaded.');
    }

    return installed;
  } catch (error) {
    return throwDatabaseError('installCountryPackage', error);
  }
}

export async function getCountryPackage(
  lookup: CountryPackageLookup
): Promise<CountryPackageWithComponents | null> {
  try {
    const db = await getDatabase();
    const row = await getCountryPackageRow(db, lookup);

    return row ? hydrateCountryPackage(db, row) : null;
  } catch (error) {
    return throwDatabaseError('getCountryPackage', error);
  }
}

export async function getCountryPackageLastCheckedAt(
  lookup: CountryPackageLookup
): Promise<string | null> {
  try {
    return await getAppPreference(buildCountryPackageLastCheckKey(lookup));
  } catch (error) {
    return throwDatabaseError('getCountryPackageLastCheckedAt', error);
  }
}

export async function saveCountryPackageLastCheckedAt(
  lookup: CountryPackageLookup,
  checkedAt = new Date().toISOString()
): Promise<string> {
  try {
    await setAppPreference(buildCountryPackageLastCheckKey(lookup), checkedAt);
    return checkedAt;
  } catch (error) {
    return throwDatabaseError('saveCountryPackageLastCheckedAt', error);
  }
}

export async function saveComplianceReport(
  input: SaveComplianceReportInput
): Promise<ComplianceReport> {
  try {
    const db = await getDatabase();
    const id = createEntityId('cpr');
    const countryCode = normalizeRequiredCode(input.countryCode, 'Country code');
    const reportType = normalizeComplianceReportType(input.reportType);
    const generatedAt = cleanText(input.generatedAt) ?? new Date().toISOString();
    const reportDataJson = normalizeJsonObject(input.reportDataJson, 'Compliance report data');

    await db.runAsync(
      `INSERT INTO compliance_reports (
        id,
        country_code,
        report_type,
        generated_at,
        report_data_json
      ) VALUES (?, ?, ?, ?, ?)`,
      id,
      countryCode,
      reportType,
      generatedAt,
      reportDataJson
    );

    const saved = await getComplianceReport(id);
    if (!saved) {
      throw new Error('Compliance report was not saved.');
    }

    return saved;
  } catch (error) {
    return throwDatabaseError('saveComplianceReport', error);
  }
}

export async function getComplianceReport(id: string): Promise<ComplianceReport | null> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<ComplianceReportRow>(
      'SELECT * FROM compliance_reports WHERE id = ? LIMIT 1',
      id
    );

    return row ? mapComplianceReport(row) : null;
  } catch (error) {
    return throwDatabaseError('getComplianceReport', error);
  }
}

export async function listComplianceReports(
  options: ListComplianceReportsOptions = {}
): Promise<ComplianceReport[]> {
  try {
    const db = await getDatabase();
    const whereClauses: string[] = [];
    const queryParams: Array<string | number> = [];

    if (options.countryCode !== undefined) {
      whereClauses.push('country_code = ?');
      queryParams.push(normalizeRequiredCode(options.countryCode, 'Country code'));
    }

    if (options.reportType !== undefined) {
      whereClauses.push('report_type = ?');
      queryParams.push(normalizeComplianceReportType(options.reportType));
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const rows = await db.getAllAsync<ComplianceReportRow>(
      `SELECT * FROM compliance_reports
       ${whereSql}
       ORDER BY generated_at DESC
       LIMIT ?`,
      ...queryParams,
      options.limit ?? 20
    );

    return rows.map(mapComplianceReport);
  } catch (error) {
    return throwDatabaseError('listComplianceReports', error);
  }
}

export async function getActiveTaxPack(lookup: TaxPackLookup): Promise<TaxPack | null> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<TaxPackRow>(
      `SELECT * FROM tax_packs
       WHERE country_code = ?
         AND region_code = ?
         AND tax_type = ?
         AND is_active = 1
       ORDER BY last_updated DESC
       LIMIT 1`,
      normalizeRequiredCode(lookup.countryCode, 'Country code'),
      normalizeOptionalCode(lookup.regionCode),
      normalizeRequiredCode(lookup.taxType, 'Tax type')
    );

    return row ? mapTaxPack(row) : null;
  } catch (error) {
    return throwDatabaseError('getActiveTaxPack', error);
  }
}

export async function getTaxPackVersion(
  lookup: TaxPackLookup & { version: string }
): Promise<TaxPack | null> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<TaxPackRow>(
      `SELECT * FROM tax_packs
       WHERE country_code = ?
         AND region_code = ?
         AND tax_type = ?
         AND version = ?
       LIMIT 1`,
      normalizeRequiredCode(lookup.countryCode, 'Country code'),
      normalizeOptionalCode(lookup.regionCode),
      normalizeRequiredCode(lookup.taxType, 'Tax type'),
      requiredText(lookup.version)
    );

    return row ? mapTaxPack(row) : null;
  } catch (error) {
    return throwDatabaseError('getTaxPackVersion', error);
  }
}

export async function listTaxPacks(lookup?: Partial<TaxPackLookup>): Promise<TaxPack[]> {
  try {
    const db = await getDatabase();
    const whereClauses: string[] = [];
    const queryParams: string[] = [];

    if (lookup?.countryCode !== undefined) {
      whereClauses.push('country_code = ?');
      queryParams.push(normalizeRequiredCode(lookup.countryCode, 'Country code'));
    }

    if (lookup?.regionCode !== undefined) {
      whereClauses.push('region_code = ?');
      queryParams.push(normalizeOptionalCode(lookup.regionCode));
    }

    if (lookup?.taxType !== undefined) {
      whereClauses.push('tax_type = ?');
      queryParams.push(normalizeRequiredCode(lookup.taxType, 'Tax type'));
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const rows = await db.getAllAsync<TaxPackRow>(
      `SELECT * FROM tax_packs
       ${whereSql}
       ORDER BY is_active DESC, last_updated DESC, version DESC`,
      ...queryParams
    );

    return rows.map(mapTaxPack);
  } catch (error) {
    return throwDatabaseError('listTaxPacks', error);
  }
}

export async function getTaxPackLastCheckedAt(lookup: TaxPackLookup): Promise<string | null> {
  try {
    return await getAppPreference(buildTaxPackLastCheckKey(lookup));
  } catch (error) {
    return throwDatabaseError('getTaxPackLastCheckedAt', error);
  }
}

export async function saveTaxPackLastCheckedAt(
  lookup: TaxPackLookup,
  checkedAt = new Date().toISOString()
): Promise<string> {
  try {
    await setAppPreference(buildTaxPackLastCheckKey(lookup), checkedAt);
    return checkedAt;
  } catch (error) {
    return throwDatabaseError('saveTaxPackLastCheckedAt', error);
  }
}

export async function getDocumentTaxNoticeAcknowledged(): Promise<boolean> {
  try {
    const value = await getAppPreference(DOCUMENT_TAX_NOTICE_ACKNOWLEDGED_KEY);
    return value === 'true';
  } catch (error) {
    return throwDatabaseError('getDocumentTaxNoticeAcknowledged', error);
  }
}

export async function acknowledgeDocumentTaxNotice(): Promise<void> {
  try {
    await setAppPreference(DOCUMENT_TAX_NOTICE_ACKNOWLEDGED_KEY, 'true');
  } catch (error) {
    return throwDatabaseError('acknowledgeDocumentTaxNotice', error);
  }
}

export async function getAppSecurity(): Promise<AppSecurity> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<AppSecurityRow>(
      'SELECT * FROM app_security WHERE id = ? LIMIT 1',
      APP_SECURITY_ID
    );

    if (row) {
      return mapAppSecurity(row);
    }

    return await saveAppSecurity(false);
  } catch (error) {
    return throwDatabaseError('getAppSecurity', error);
  }
}

export async function saveAppSecurity(pinEnabled: boolean): Promise<AppSecurity> {
  try {
    const db = await getDatabase();
    const now = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO app_security (id, pin_enabled, pin_hash, updated_at)
       VALUES (?, ?, NULL, ?)
       ON CONFLICT(id) DO UPDATE SET
        pin_enabled = excluded.pin_enabled,
        pin_hash = NULL,
        updated_at = excluded.updated_at`,
      APP_SECURITY_ID,
      pinEnabled ? 1 : 0,
      now
    );

    const row = await db.getFirstAsync<AppSecurityRow>(
      'SELECT * FROM app_security WHERE id = ? LIMIT 1',
      APP_SECURITY_ID
    );

    if (!row) {
      throw new Error('App security settings were not saved.');
    }

    return mapAppSecurity(row);
  } catch (error) {
    return throwDatabaseError('saveAppSecurity', error);
  }
}

export async function addProduct(input: AddProductInput): Promise<Product> {
  try {
    const db = await getDatabase();
    const id = createEntityId('prd');
    const now = new Date().toISOString();
    const name = requiredText(input.name);
    const unit = requiredText(input.unit);
    const stockQuantity = input.stockQuantity ?? 0;
    validateProductFields(name, input.price, stockQuantity, unit);

    await db.runAsync(
      `INSERT INTO products (
        id,
        name,
        price,
        stock_quantity,
        unit,
        created_at,
        sync_id,
        last_modified,
        sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      name,
      roundCurrency(input.price),
      roundCurrency(stockQuantity, 3),
      unit,
      now,
      id,
      now,
      'pending'
    );

    const product = await getProduct(id);
    if (!product) {
      throw new Error('Product was not saved.');
    }

    return product;
  } catch (error) {
    return throwDatabaseError('addProduct', error);
  }
}

export async function updateProduct(id: string, input: UpdateProductInput): Promise<Product> {
  try {
    const existing = await getProduct(id);
    if (!existing) {
      throw new Error(`Product not found: ${id}`);
    }

    const name = input.name === undefined ? existing.name : requiredText(input.name);
    const price = input.price ?? existing.price;
    const stockQuantity = input.stockQuantity ?? existing.stockQuantity;
    const unit = input.unit === undefined ? existing.unit : requiredText(input.unit);
    validateProductFields(name, price, stockQuantity, unit);

    const db = await getDatabase();
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE products SET
        name = ?,
        price = ?,
        stock_quantity = ?,
        unit = ?,
        last_modified = ?,
        sync_status = 'pending'
       WHERE id = ?`,
      name,
      roundCurrency(price),
      roundCurrency(stockQuantity, 3),
      unit,
      now,
      id
    );

    const product = await getProduct(id);
    if (!product) {
      throw new Error('Product disappeared after update.');
    }

    return product;
  } catch (error) {
    return throwDatabaseError('updateProduct', error);
  }
}

export async function getProduct(id: string): Promise<Product | null> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<ProductRow>(
      'SELECT * FROM products WHERE id = ? LIMIT 1',
      id
    );

    return row ? mapProduct(row) : null;
  } catch (error) {
    return throwDatabaseError('getProduct', error);
  }
}

export async function listProducts(options: ProductListOptions = {}): Promise<Product[]> {
  try {
    const db = await getDatabase();
    const query = options.query?.trim() ?? '';

    if (!query) {
      const rows = await db.getAllAsync<ProductRow>(
        `SELECT * FROM products
         ORDER BY name COLLATE NOCASE ASC, created_at DESC
         LIMIT ?`,
        options.limit ?? 100
      );
      return rows.map(mapProduct);
    }

    const like = `%${escapeLikeQuery(query)}%`;
    const rows = await db.getAllAsync<ProductRow>(
      `SELECT * FROM products
       WHERE name LIKE ? ESCAPE '\\'
          OR unit LIKE ? ESCAPE '\\'
       ORDER BY name COLLATE NOCASE ASC, created_at DESC
       LIMIT ?`,
      like,
      like,
      options.limit ?? 100
    );

    return rows.map(mapProduct);
  } catch (error) {
    return throwDatabaseError('listProducts', error);
  }
}

export async function deleteProduct(id: string): Promise<void> {
  try {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM products WHERE id = ?', id);
  } catch (error) {
    return throwDatabaseError('deleteProduct', error);
  }
}

export async function addCustomer(input: AddCustomerInput): Promise<Customer> {
  try {
    const db = await getDatabase();
    const id = createEntityId('cus');
    const now = new Date().toISOString();
    const name = requiredText(input.name);
    const phone = cleanText(input.phone);

    await assertCustomerIsUnique(db, name, phone, id);

    await db.runAsync(
      `INSERT INTO customers (
        id,
        name,
        phone,
        address,
        notes,
        opening_balance,
        is_archived,
        created_at,
        updated_at,
        sync_id,
        last_modified,
        sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
      id,
      name,
      phone,
      cleanText(input.address),
      cleanText(input.notes),
      input.openingBalance ?? 0,
      now,
      now,
      id,
      now,
      'pending'
    );

    const customer = await getCustomerById(id);
    if (!customer) {
      throw new Error('Customer was not saved.');
    }

    return customer;
  } catch (error) {
    if (error instanceof DuplicateCustomerError) {
      throw error;
    }
    return throwDatabaseError('addCustomer', error);
  }
}

export async function updateCustomer(id: string, input: UpdateCustomerInput): Promise<Customer> {
  try {
    const existing = await getCustomerById(id);
    if (!existing) {
      throw new Error(`Customer not found: ${id}`);
    }

    const db = await getDatabase();
    const now = new Date().toISOString();
    const name = requiredText(input.name ?? existing.name);
    const phone = input.phone === undefined ? existing.phone : cleanText(input.phone);

    await assertCustomerIsUnique(db, name, phone, id);

    await db.runAsync(
      `UPDATE customers SET
        name = ?,
        phone = ?,
        address = ?,
        notes = ?,
        opening_balance = ?,
        updated_at = ?,
        last_modified = ?,
        sync_status = 'pending'
       WHERE id = ?`,
      name,
      phone,
      input.address === undefined ? existing.address : cleanText(input.address),
      input.notes === undefined ? existing.notes : cleanText(input.notes),
      input.openingBalance ?? existing.openingBalance,
      now,
      now,
      id
    );

    const customer = await getCustomerById(id);
    if (!customer) {
      throw new Error('Customer disappeared after update.');
    }

    return customer;
  } catch (error) {
    if (error instanceof DuplicateCustomerError) {
      throw error;
    }
    return throwDatabaseError('updateCustomer', error);
  }
}

export async function archiveCustomer(id: string): Promise<void> {
  try {
    const db = await getDatabase();
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE customers
       SET is_archived = 1,
        updated_at = ?,
        last_modified = ?,
        sync_status = 'pending'
       WHERE id = ?`,
      now,
      now,
      id
    );
  } catch (error) {
    return throwDatabaseError('archiveCustomer', error);
  }
}

export async function addTransaction(input: AddTransactionInput): Promise<LedgerTransaction> {
  return measurePerformance(
    'transaction_save',
    'Add transaction',
    async () => {
      try {
        assertPositiveAmount(input.amount);

        const customer = await getCustomerById(input.customerId);
        if (!customer || customer.isArchived) {
          throw new Error(`Active customer not found: ${input.customerId}`);
        }

        const db = await getDatabase();
        const id = createEntityId('txn');
        const now = new Date().toISOString();
        const paymentMode = input.type === 'payment' ? normalizePaymentMode(input.paymentMode) : null;
        const paymentDetails =
          input.type === 'payment' ? normalizePaymentModeDetails(input.paymentDetails) : null;
        const paymentModeError =
          input.type === 'payment' && paymentMode && paymentDetails
            ? validatePaymentModeDetails(paymentMode, paymentDetails)
            : null;
        if (paymentModeError) {
          throw new Error(paymentModeError);
        }

        await db.withTransactionAsync(async () => {
          await db.runAsync(
            `INSERT INTO transactions (
              id,
              customer_id,
              type,
              amount,
              note,
              payment_mode,
              payment_details_json,
              effective_date,
              created_at,
              sync_id,
              last_modified,
              sync_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            id,
            input.customerId,
            input.type,
            input.amount,
            cleanText(input.note),
            paymentMode,
            serializePaymentDetails(paymentDetails),
            input.effectiveDate ?? toDateOnlyIso(),
            now,
            id,
            now,
            'pending'
          );

          if (input.type === 'payment') {
            await allocatePaymentToInvoices(db, {
              customerId: input.customerId,
              transactionId: id,
              amount: input.amount,
              strategy: input.allocationStrategy ?? 'ledger_only',
              invoiceId: input.invoiceId ?? null,
              createdAt: now,
            });
          }
        });

        const transaction = await db.getFirstAsync<LedgerTransactionRow>(
          'SELECT * FROM transactions WHERE id = ? LIMIT 1',
          id
        );

        if (!transaction) {
          throw new Error('Transaction was not saved.');
        }

        return mapTransaction(transaction);
      } catch (error) {
        return throwDatabaseError('addTransaction', error);
      }
    },
    { action: 'add', transactionType: input.type }
  );
}

export async function getTransaction(id: string): Promise<LedgerTransaction | null> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<LedgerTransactionRow>(
      'SELECT * FROM transactions WHERE id = ? LIMIT 1',
      id
    );

    return row ? mapTransaction(row) : null;
  } catch (error) {
    return throwDatabaseError('getTransaction', error);
  }
}

export async function updateTransaction(
  id: string,
  input: UpdateTransactionInput
): Promise<LedgerTransaction> {
  return measurePerformance(
    'transaction_save',
    'Update transaction',
    async () => {
      try {
        const existing = await getTransaction(id);
        if (!existing) {
          throw new Error(`Transaction not found: ${id}`);
        }

        const type = input.type ?? existing.type;
        if (!transactionTypes.includes(type)) {
          throw new Error(`Unsupported transaction type: ${type}`);
        }

        const amount = input.amount ?? existing.amount;
        assertPositiveAmount(amount);

        const customer = await getCustomerById(existing.customerId);
        if (!customer) {
          throw new Error(`Customer not found for transaction: ${existing.customerId}`);
        }

        const db = await getDatabase();
        const now = new Date().toISOString();
        const paymentMode =
          type === 'payment'
            ? normalizePaymentMode(input.paymentMode ?? existing.paymentMode)
            : null;
        const paymentDetails =
          type === 'payment'
            ? normalizePaymentModeDetails(input.paymentDetails ?? existing.paymentDetails)
            : null;
        const paymentModeError =
          type === 'payment' && paymentMode && paymentDetails
            ? validatePaymentModeDetails(paymentMode, paymentDetails)
            : null;
        if (paymentModeError) {
          throw new Error(paymentModeError);
        }

        await db.runAsync(
          `UPDATE transactions SET
            type = ?,
            amount = ?,
            note = ?,
            payment_mode = ?,
            payment_details_json = ?,
            effective_date = ?,
            last_modified = ?,
            sync_status = 'pending'
           WHERE id = ?`,
          type,
          amount,
          input.note === undefined ? existing.note : cleanText(input.note),
          paymentMode,
          serializePaymentDetails(paymentDetails),
          input.effectiveDate ?? existing.effectiveDate,
          now,
          id
        );

        const updated = await getTransaction(id);
        if (!updated) {
          throw new Error('Transaction disappeared after update.');
        }

        return updated;
      } catch (error) {
        return throwDatabaseError('updateTransaction', error);
      }
    },
    { action: 'update', transactionId: id }
  );
}

export async function addPaymentReminder(
  input: AddPaymentReminderInput
): Promise<PaymentReminder> {
  try {
    const customer = await getCustomerById(input.customerId);
    if (!customer || customer.isArchived) {
      throw new Error(`Active customer not found: ${input.customerId}`);
    }

    const message = requiredText(input.message);
    const db = await getDatabase();
    const id = createEntityId('rem');
    const now = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO payment_reminders (
        id,
        customer_id,
        tone,
        message,
        balance_at_send,
        shared_via,
        created_at,
        sync_id,
        last_modified,
        sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.customerId,
      input.tone,
      message,
      input.balanceAtSend,
      cleanText(input.sharedVia) ?? 'system_share_sheet',
      now,
      id,
      now,
      'pending'
    );

    const row = await db.getFirstAsync<PaymentReminderRow>(
      'SELECT * FROM payment_reminders WHERE id = ? LIMIT 1',
      id
    );

    if (!row) {
      throw new Error('Payment reminder was not saved.');
    }

    return mapPaymentReminder(row);
  } catch (error) {
    return throwDatabaseError('addPaymentReminder', error);
  }
}

export async function listPaymentRemindersForCustomer(
  customerId: string,
  limit = 10
): Promise<PaymentReminder[]> {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<PaymentReminderRow>(
      `SELECT *
       FROM payment_reminders
       WHERE customer_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      customerId,
      limit
    );

    return rows.map(mapPaymentReminder);
  } catch (error) {
    return throwDatabaseError('listPaymentRemindersForCustomer', error);
  }
}

export async function addCustomerTimelineNote(
  input: AddCustomerTimelineNoteInput
): Promise<CustomerTimelineNote> {
  try {
    const customer = await getCustomerById(input.customerId);
    if (!customer || customer.isArchived) {
      throw new Error(`Active customer not found: ${input.customerId}`);
    }

    const body = requiredText(input.body);
    const db = await getDatabase();
    const id = createEntityId(input.kind === 'dispute' ? 'dis' : 'note');
    const now = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO customer_timeline_notes (
        id,
        customer_id,
        kind,
        body,
        created_at,
        updated_at,
        sync_id,
        last_modified,
        sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.customerId,
      input.kind,
      body,
      now,
      now,
      id,
      now,
      'pending'
    );

    const note = await getCustomerTimelineNote(id);
    if (!note) {
      throw new Error('Customer note was not saved.');
    }

    return note;
  } catch (error) {
    return throwDatabaseError('addCustomerTimelineNote', error);
  }
}

export async function getCustomerTimelineNote(id: string): Promise<CustomerTimelineNote | null> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<CustomerTimelineNoteRow>(
      'SELECT * FROM customer_timeline_notes WHERE id = ? LIMIT 1',
      id
    );

    return row ? mapCustomerTimelineNote(row) : null;
  } catch (error) {
    return throwDatabaseError('getCustomerTimelineNote', error);
  }
}

export async function listCustomerTimelineNotes(
  customerId: string,
  limit = 20
): Promise<CustomerTimelineNote[]> {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<CustomerTimelineNoteRow>(
      `SELECT *
       FROM customer_timeline_notes
       WHERE customer_id = ?
       ORDER BY created_at DESC, id ASC
       LIMIT ?`,
      customerId,
      limit
    );

    return rows.map(mapCustomerTimelineNote);
  } catch (error) {
    return throwDatabaseError('listCustomerTimelineNotes', error);
  }
}

export async function addPaymentPromise(input: AddPaymentPromiseInput): Promise<PaymentPromise> {
  try {
    assertPositiveAmount(input.promisedAmount);

    const customer = await getCustomerById(input.customerId);
    if (!customer || customer.isArchived) {
      throw new Error(`Active customer not found: ${input.customerId}`);
    }

    const db = await getDatabase();
    const id = createEntityId('prm');
    const now = new Date().toISOString();

    await db.runAsync(
      `INSERT INTO payment_promises (
        id,
        customer_id,
        promised_amount,
        promised_date,
        note,
        status,
        created_at,
        updated_at,
        sync_id,
        last_modified,
        sync_status
      ) VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)`,
      id,
      input.customerId,
      input.promisedAmount,
      requiredText(input.promisedDate),
      cleanText(input.note),
      now,
      now,
      id,
      now,
      'pending'
    );

    const promise = await getPaymentPromise(id);
    if (!promise) {
      throw new Error('Payment promise was not saved.');
    }

    return promise;
  } catch (error) {
    return throwDatabaseError('addPaymentPromise', error);
  }
}

export async function getPaymentPromise(id: string): Promise<PaymentPromise | null> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<PaymentPromiseRow>(
      'SELECT * FROM payment_promises WHERE id = ? LIMIT 1',
      id
    );

    return row ? mapPaymentPromise(row) : null;
  } catch (error) {
    return throwDatabaseError('getPaymentPromise', error);
  }
}

export async function updatePaymentPromise(
  id: string,
  input: UpdatePaymentPromiseInput
): Promise<PaymentPromise> {
  try {
    const existing = await getPaymentPromise(id);
    if (!existing) {
      throw new Error(`Payment promise not found: ${id}`);
    }

    const status = input.status ?? existing.status;
    if (!paymentPromiseStatuses.includes(status)) {
      throw new Error(`Unsupported payment promise status: ${status}`);
    }

    const amount = input.promisedAmount ?? existing.promisedAmount;
    assertPositiveAmount(amount);

    const db = await getDatabase();
    const now = new Date().toISOString();

    await db.runAsync(
      `UPDATE payment_promises SET
        customer_id = ?,
        promised_amount = ?,
        promised_date = ?,
        note = ?,
        status = ?,
        updated_at = ?,
        last_modified = ?,
        sync_status = 'pending'
       WHERE id = ?`,
      input.customerId ?? existing.customerId,
      amount,
      input.promisedDate ?? existing.promisedDate,
      input.note === undefined ? existing.note : cleanText(input.note),
      status,
      now,
      now,
      id
    );

    const updated = await getPaymentPromise(id);
    if (!updated) {
      throw new Error('Payment promise disappeared after update.');
    }

    return updated;
  } catch (error) {
    return throwDatabaseError('updatePaymentPromise', error);
  }
}

export async function updatePaymentPromiseStatus(
  id: string,
  status: PaymentPromiseStatus
): Promise<PaymentPromise> {
  return updatePaymentPromise(id, { status });
}

export async function listPaymentPromisesForCustomer(
  customerId: string,
  limit = 20
): Promise<PaymentPromise[]> {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<PaymentPromiseRow>(
      `SELECT *
       FROM payment_promises
       WHERE customer_id = ?
       ORDER BY
        CASE status
          WHEN 'open' THEN 0
          WHEN 'missed' THEN 1
          WHEN 'fulfilled' THEN 2
          ELSE 3
        END ASC,
        promised_date ASC,
        created_at DESC
       LIMIT ?`,
      customerId,
      limit
    );

    return rows.map(mapPaymentPromise);
  } catch (error) {
    return throwDatabaseError('listPaymentPromisesForCustomer', error);
  }
}

export async function listOpenPaymentPromisesForCustomer(
  customerId: string,
  limit = 10
): Promise<PaymentPromise[]> {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<PaymentPromiseRow>(
      `SELECT *
       FROM payment_promises
       WHERE customer_id = ?
        AND status = 'open'
       ORDER BY promised_date ASC, created_at ASC
       LIMIT ?`,
      customerId,
      limit
    );

    return rows.map(mapPaymentPromise);
  } catch (error) {
    return throwDatabaseError('listOpenPaymentPromisesForCustomer', error);
  }
}

export async function addInvoice(input: AddInvoiceInput): Promise<InvoiceWithItems> {
  return measurePerformance(
    'invoice_save',
    'Add invoice',
    async () => {
      try {
        const db = await getDatabase();
        const id = createEntityId('inv');
        const now = new Date().toISOString();
        const customerId = cleanText(input.customerId);
        const invoiceNumber = requiredText(input.invoiceNumber);
        const prepared = prepareInvoiceTotals(input, id);

        if (!invoiceNumber) {
          throw new Error('Invoice number is required.');
        }

        if (input.status && !invoiceStatuses.includes(input.status)) {
          throw new Error(`Unsupported invoice status: ${input.status}`);
        }

        if (input.paymentStatus && !invoicePaymentStatuses.includes(input.paymentStatus)) {
          throw new Error(`Unsupported invoice payment status: ${input.paymentStatus}`);
        }

        if (customerId) {
          const customer = await getCustomerById(customerId);
          if (!customer) {
            throw new Error(`Customer not found for invoice: ${customerId}`);
          }
        }

        await db.withTransactionAsync(async () => {
          await applyProductStockReductions(db, prepared.items);
          const paymentStatus = normalizeInvoicePaymentStatus({
            paymentStatus: input.paymentStatus,
            dueDate: cleanText(input.dueDate),
            totalAmount: prepared.totalAmount,
          });
          const documentState: InvoiceDocumentState = input.documentState === 'cancelled' ? 'cancelled' : 'created';
          const legacyStatus = legacyStatusForInvoiceLifecycle(documentState, paymentStatus);
          const versionId = createEntityId('ivn');
          const snapshotHash = buildInvoiceSnapshotHash({
            invoiceNumber,
            customerId,
            issueDate: input.issueDate ?? toDateOnlyIso(),
            dueDate: cleanText(input.dueDate),
            documentState,
            paymentStatus,
            subtotal: prepared.subtotal,
            taxAmount: prepared.taxAmount,
            totalAmount: prepared.totalAmount,
            notes: cleanText(input.notes),
            items: prepared.items,
          });

          await db.runAsync(
            `INSERT INTO invoices (
              id,
              customer_id,
              invoice_number,
              issue_date,
              due_date,
              subtotal,
              tax_amount,
              total_amount,
              paid_amount,
              status,
              document_state,
              payment_status,
              version_number,
              latest_version_id,
              latest_snapshot_hash,
              notes,
              created_at,
              sync_id,
              last_modified,
              sync_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            id,
            customerId,
            invoiceNumber,
            input.issueDate ?? toDateOnlyIso(),
            cleanText(input.dueDate),
            prepared.subtotal,
            prepared.taxAmount,
            prepared.totalAmount,
            0,
            legacyStatus,
            documentState,
            paymentStatus,
            1,
            versionId,
            snapshotHash,
            cleanText(input.notes),
            now,
            id,
            now,
            'pending'
          );
          await insertInvoiceVersion(db, {
            id: versionId,
            invoiceId: id,
            invoiceNumber,
            versionNumber: 1,
            reason: cleanVersionReason(input.revisionReason, 1),
            createdAt: now,
            customerId,
            issueDate: input.issueDate ?? toDateOnlyIso(),
            dueDate: cleanText(input.dueDate),
            documentState,
            paymentStatus,
            subtotal: prepared.subtotal,
            taxAmount: prepared.taxAmount,
            totalAmount: prepared.totalAmount,
            notes: cleanText(input.notes),
            snapshotHash,
            itemsJson: JSON.stringify(prepared.items),
          });

          for (const item of prepared.items) {
            await db.runAsync(
              `INSERT INTO invoice_items (
                id,
                invoice_id,
                product_id,
                name,
                description,
                quantity,
                price,
                tax_rate,
                total,
                sync_id,
                last_modified,
                sync_status
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              item.id,
              id,
              item.productId,
              item.name,
              item.description,
              item.quantity,
              item.price,
              item.taxRate,
              item.total,
              item.id,
              now,
              'pending'
            );
          }
        });

        const invoice = await getInvoice(id);
        if (!invoice) {
          throw new Error('Invoice was not saved.');
        }

        return invoice;
      } catch (error) {
        return throwDatabaseError('addInvoice', error);
      }
    },
    { action: 'add', itemCount: input.items.length }
  );
}

export async function getInvoice(id: string): Promise<InvoiceWithItems | null> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<InvoiceRow>('SELECT * FROM invoices WHERE id = ? LIMIT 1', id);

    if (!row) {
      return null;
    }

    const itemRows = await db.getAllAsync<InvoiceItemRow>(
      `SELECT * FROM invoice_items
       WHERE invoice_id = ?
       ORDER BY rowid ASC`,
      id
    );

    return {
      ...mapInvoice(row),
      items: itemRows.map(mapInvoiceItem),
    };
  } catch (error) {
    return throwDatabaseError('getInvoice', error);
  }
}

export async function updateInvoice(
  id: string,
  input: UpdateInvoiceInput
): Promise<InvoiceWithItems> {
  return measurePerformance(
    'invoice_save',
    'Update invoice',
    async () => {
      try {
        const existing = await getInvoice(id);
        if (!existing) {
          throw new Error(`Invoice not found: ${id}`);
        }

        const customerId = input.customerId === undefined ? existing.customerId : cleanText(input.customerId);
        const invoiceNumber =
          input.invoiceNumber === undefined ? existing.invoiceNumber : requiredText(input.invoiceNumber);
        const status = input.status ?? existing.status;

        if (!invoiceNumber) {
          throw new Error('Invoice number is required.');
        }

        if (!invoiceStatuses.includes(status)) {
          throw new Error(`Unsupported invoice status: ${status}`);
        }

        if (input.paymentStatus && !invoicePaymentStatuses.includes(input.paymentStatus)) {
          throw new Error(`Unsupported invoice payment status: ${input.paymentStatus}`);
        }

        if (customerId) {
          const customer = await getCustomerById(customerId);
          if (!customer) {
            throw new Error(`Customer not found for invoice: ${customerId}`);
          }
        }

        const prepared = prepareInvoiceTotals({ items: input.items }, id);
        const db = await getDatabase();
        const now = new Date().toISOString();
        const issueDate = input.issueDate ?? existing.issueDate;
        const dueDate = input.dueDate === undefined ? existing.dueDate : cleanText(input.dueDate);
        const notes = input.notes === undefined ? existing.notes : cleanText(input.notes);
        const currentDocumentState = normalizeInvoiceDocumentState(existing.documentState ?? existing.status);
        const paymentStatus = input.paymentStatus
          ? normalizeInvoicePaymentStatus({ paymentStatus: input.paymentStatus })
          : deriveInvoicePaymentStatus({
              legacyStatus: existing.status,
              paymentStatus: existing.paymentStatus,
              dueDate,
              totalAmount: prepared.totalAmount,
              paidAmount: existing.paidAmount,
            });
        const nextVersionNumber = Math.max(existing.versionNumber, 0) + 1;
        const nextDocumentState: InvoiceDocumentState =
          input.documentState === 'cancelled'
            ? 'cancelled'
            : currentDocumentState === 'cancelled'
            ? 'cancelled'
            : currentDocumentState === 'draft'
              ? 'created'
              : nextVersionNumber > 1
                ? 'revised'
                : 'created';
        const snapshotHash = buildInvoiceSnapshotHash({
          invoiceNumber,
          customerId,
          issueDate,
          dueDate,
          documentState: nextDocumentState,
          paymentStatus,
          subtotal: prepared.subtotal,
          taxAmount: prepared.taxAmount,
          totalAmount: prepared.totalAmount,
          notes,
          items: prepared.items,
        });
        const hasMeaningfulChange = snapshotHash !== existing.latestSnapshotHash;
        const finalDocumentState = hasMeaningfulChange ? nextDocumentState : currentDocumentState;
        const finalVersionNumber = hasMeaningfulChange ? nextVersionNumber : Math.max(existing.versionNumber, 1);
        const finalSnapshotHash = hasMeaningfulChange ? snapshotHash : existing.latestSnapshotHash ?? snapshotHash;
        const versionId = hasMeaningfulChange ? createEntityId('ivn') : existing.latestVersionId;
        const legacyStatus = legacyStatusForInvoiceLifecycle(finalDocumentState, paymentStatus);

        await db.withTransactionAsync(async () => {
          await restoreProductStockReductions(db, existing.items);
          await applyProductStockReductions(db, prepared.items);

          await db.runAsync(
            `UPDATE invoices
             SET customer_id = ?,
              invoice_number = ?,
              issue_date = ?,
              due_date = ?,
              subtotal = ?,
              tax_amount = ?,
              total_amount = ?,
              paid_amount = ?,
              status = ?,
              document_state = ?,
              payment_status = ?,
              version_number = ?,
              latest_version_id = ?,
              latest_snapshot_hash = ?,
              notes = ?,
              last_modified = ?,
              sync_status = 'pending'
             WHERE id = ?`,
            customerId,
            invoiceNumber,
            issueDate,
            dueDate,
            prepared.subtotal,
            prepared.taxAmount,
            prepared.totalAmount,
            existing.paidAmount,
            legacyStatus,
            finalDocumentState,
            paymentStatus,
            finalVersionNumber,
            versionId,
            finalSnapshotHash,
            notes,
            now,
            id
          );

          if (hasMeaningfulChange && versionId) {
            await insertInvoiceVersion(db, {
              id: versionId,
              invoiceId: id,
              invoiceNumber,
              versionNumber: nextVersionNumber,
              reason: cleanVersionReason(input.revisionReason, nextVersionNumber),
              createdAt: now,
              customerId,
              issueDate,
              dueDate,
              documentState: nextDocumentState,
              paymentStatus,
              subtotal: prepared.subtotal,
              taxAmount: prepared.taxAmount,
              totalAmount: prepared.totalAmount,
              notes,
              snapshotHash,
              itemsJson: JSON.stringify(prepared.items),
            });
          }

          await db.runAsync('DELETE FROM invoice_items WHERE invoice_id = ?', id);

          for (const item of prepared.items) {
            await db.runAsync(
              `INSERT INTO invoice_items (
                id,
                invoice_id,
                product_id,
                name,
                description,
                quantity,
                price,
                tax_rate,
                total,
                sync_id,
                last_modified,
                sync_status
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              item.id,
              id,
              item.productId,
              item.name,
              item.description,
              item.quantity,
              item.price,
              item.taxRate,
              item.total,
              item.id,
              now,
              'pending'
            );
          }
        });

        const invoice = await getInvoice(id);
        if (!invoice) {
          throw new Error(`Invoice disappeared after update: ${id}`);
        }

        return invoice;
      } catch (error) {
        return throwDatabaseError('updateInvoice', error);
      }
    },
    { action: 'update', invoiceId: id, itemCount: input.items.length }
  );
}

export async function listInvoices(options: InvoiceListOptions = {}): Promise<Invoice[]> {
  try {
    const db = await getDatabase();
    const whereClauses: string[] = [];
    const queryParams: Array<string | number> = [];

    if (options.customerId !== undefined) {
      const customerId = cleanText(options.customerId);
      if (customerId) {
        whereClauses.push('customer_id = ?');
        queryParams.push(customerId);
      } else {
        whereClauses.push('customer_id IS NULL');
      }
    }

    if (options.status) {
      whereClauses.push('status = ?');
      queryParams.push(options.status);
    }

    if (options.documentState) {
      whereClauses.push('document_state = ?');
      queryParams.push(options.documentState);
    }

    if (options.paymentStatus) {
      whereClauses.push('payment_status = ?');
      queryParams.push(options.paymentStatus);
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const rows = await db.getAllAsync<InvoiceRow>(
      `SELECT * FROM invoices
       ${whereSql}
       ORDER BY issue_date DESC, created_at DESC
       LIMIT ?`,
      ...queryParams,
      options.limit ?? 50
    );

    return rows.map(mapInvoice);
  } catch (error) {
    return throwDatabaseError('listInvoices', error);
  }
}

export async function listInvoicesForCustomer(customerId: string, limit = 50): Promise<Invoice[]> {
  return listInvoices({ customerId, limit });
}

export async function listInvoiceVersions(invoiceId: string): Promise<InvoiceVersion[]> {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<InvoiceVersionRow>(
      `SELECT *
       FROM invoice_versions
       WHERE invoice_id = ?
       ORDER BY version_number DESC, created_at DESC`,
      invoiceId
    );
    return rows.map(mapInvoiceVersion);
  } catch (error) {
    return throwDatabaseError('listInvoiceVersions', error);
  }
}

export async function listInvoicePaymentAllocations(invoiceId: string): Promise<InvoicePaymentAllocation[]> {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<
      PaymentAllocationRow & {
        transaction_effective_date: string | null;
        transaction_note: string | null;
        transaction_payment_mode: PaymentMode | null;
        transaction_payment_details_json: string | null;
      }
    >(
      `SELECT
        pa.*,
        t.effective_date AS transaction_effective_date,
        t.note AS transaction_note,
        t.payment_mode AS transaction_payment_mode,
        t.payment_details_json AS transaction_payment_details_json
       FROM payment_allocations pa
       LEFT JOIN transactions t ON t.id = pa.transaction_id
       WHERE pa.invoice_id = ?
       ORDER BY pa.created_at DESC`,
      invoiceId
    );

    return rows.map((row) => ({
      ...mapPaymentAllocation(row),
      transactionEffectiveDate: row.transaction_effective_date ?? row.created_at.slice(0, 10),
      transactionNote: row.transaction_note,
      paymentMode: row.transaction_payment_mode ? normalizePaymentMode(row.transaction_payment_mode) : null,
      paymentDetails: parsePaymentDetailsJson(row.transaction_payment_details_json),
    }));
  } catch (error) {
    return throwDatabaseError('listInvoicePaymentAllocations', error);
  }
}

export async function updateInvoiceStatus(
  id: string,
  status: InvoiceStatus
): Promise<InvoiceWithItems> {
  try {
    const existing = await getInvoice(id);
    if (!existing) {
      throw new Error(`Invoice not found: ${id}`);
    }

    return updateInvoice(id, {
      customerId: existing.customerId,
      invoiceNumber: existing.invoiceNumber,
      issueDate: existing.issueDate,
      dueDate: existing.dueDate,
      status,
      documentState: normalizeInvoiceDocumentState(status),
      paymentStatus: normalizeInvoicePaymentStatus({
        legacyStatus: status,
        paymentStatus: existing.paymentStatus,
        dueDate: existing.dueDate,
        totalAmount: existing.totalAmount,
      }),
      revisionReason: status === 'cancelled' ? 'Invoice cancelled' : 'Invoice status updated',
      notes: existing.notes,
      items: existing.items.map((item) => ({
        productId: item.productId,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        price: item.price,
        taxRate: item.taxRate,
      })),
    });
  } catch (error) {
    return throwDatabaseError('updateInvoiceStatus', error);
  }
}

export async function updateInvoicePaymentStatus(
  id: string,
  paymentStatus: InvoicePaymentStatus
): Promise<InvoiceWithItems> {
  const existing = await getInvoice(id);
  if (!existing) {
    throw new Error(`Invoice not found: ${id}`);
  }

  return updateInvoice(id, {
    customerId: existing.customerId,
    invoiceNumber: existing.invoiceNumber,
    issueDate: existing.issueDate,
    dueDate: existing.dueDate,
    notes: existing.notes,
    paymentStatus,
    revisionReason: paymentStatus === 'paid' ? 'Payment marked received' : 'Payment status updated',
    items: existing.items.map((item) => ({
      productId: item.productId,
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      price: item.price,
      taxRate: item.taxRate,
    })),
  });
}

export async function getCustomerLedger(customerId: string): Promise<CustomerLedger> {
  return measurePerformance(
    'customer_ledger_load',
    'Customer ledger load',
    async () => {
      try {
        const customer = await getCustomerById(customerId);
        if (!customer) {
          throw new Error(`Customer not found: ${customerId}`);
        }

        const db = await getDatabase();
        const rows = await db.getAllAsync<LedgerTransactionRow>(
          `SELECT * FROM transactions
           WHERE customer_id = ?
           ORDER BY effective_date DESC, created_at DESC`,
          customerId
        );

        const transactions = rows.map(mapTransaction);
        const balance = calculateLedgerBalance(customer.openingBalance, transactions);

        return {
          customer,
          openingBalance: customer.openingBalance,
          transactions,
          balance,
        };
      } catch (error) {
        return throwDatabaseError('getCustomerLedger', error);
      }
    },
    { customerId }
  );
}

export async function getCustomerBalance(customerId: string): Promise<number> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<BalanceRow>(
      `SELECT
        c.opening_balance
        + COALESCE(SUM(
          CASE
            WHEN t.type = 'credit' THEN t.amount
            WHEN t.type = 'payment' THEN -t.amount
            ELSE 0
          END
        ), 0) AS balance
       FROM customers c
       LEFT JOIN transactions t ON t.customer_id = c.id
       WHERE c.id = ?
       GROUP BY c.id`,
      customerId
    );

    if (!row || row.balance === null) {
      throw new Error(`Customer not found: ${customerId}`);
    }

    return row.balance;
  } catch (error) {
    return throwDatabaseError('getCustomerBalance', error);
  }
}

export async function getDashboardSummary(date = new Date()): Promise<DashboardSummary> {
  return measurePerformance(
    'dashboard_summary_load',
    'Dashboard summary load',
    async () => {
      try {
        const db = await getDatabase();
        const { startIso, endIso } = localDayBounds(date);
        const recentStart = new Date(date);
        recentStart.setDate(recentStart.getDate() - 7);
        const previousStart = new Date(date);
        previousStart.setDate(previousStart.getDate() - 14);
        const followUpCutoff = new Date(date);
        followUpCutoff.setDate(followUpCutoff.getDate() - 30);
        const nowIso = date.toISOString();
        const row = await db.getFirstAsync<DashboardSummaryRow>(
          `WITH balances AS (
            SELECT
              c.id,
              c.opening_balance
                + COALESCE(SUM(
                  CASE
                    WHEN t.type = 'credit' THEN t.amount
                    WHEN t.type = 'payment' THEN -t.amount
                    ELSE 0
                  END
                ), 0) AS balance,
              MAX(CASE WHEN t.type = 'payment' THEN t.created_at ELSE NULL END) AS latest_payment_at
            FROM customers c
            LEFT JOIN transactions t ON t.customer_id = c.id
            WHERE c.is_archived = 0
            GROUP BY c.id
          )
          SELECT
            COALESCE(SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END), 0) AS total_receivable,
            COALESCE(SUM(CASE WHEN balance > 0 THEN 1 ELSE 0 END), 0) AS customers_with_outstanding_balance,
            (
              SELECT COUNT(*)
              FROM transactions
              WHERE created_at >= ? AND created_at < ?
            ) AS today_entries,
            (
              SELECT COALESCE(SUM(amount), 0)
              FROM transactions
              WHERE type = 'payment' AND created_at >= ? AND created_at <= ?
            ) AS recent_payments_received,
            COALESCE(SUM(
              CASE
                WHEN balance > 0
                  AND (latest_payment_at IS NULL OR latest_payment_at < ?)
                THEN 1
                ELSE 0
              END
            ), 0) AS follow_up_customer_count,
            (
              SELECT COUNT(*)
              FROM transactions
              WHERE created_at >= ? AND created_at <= ?
            ) AS recent_activity_count,
            (
              SELECT COUNT(*)
              FROM transactions
              WHERE created_at >= ? AND created_at < ?
            ) AS previous_activity_count
          FROM balances`,
          startIso,
          endIso,
          recentStart.toISOString(),
          nowIso,
          followUpCutoff.toISOString(),
          recentStart.toISOString(),
          nowIso,
          previousStart.toISOString(),
          recentStart.toISOString()
        );

        return {
          totalReceivable: row?.total_receivable ?? 0,
          customersWithOutstandingBalance: row?.customers_with_outstanding_balance ?? 0,
          todayEntries: row?.today_entries ?? 0,
          recentPaymentsReceived: row?.recent_payments_received ?? 0,
          followUpCustomerCount: row?.follow_up_customer_count ?? 0,
          recentActivityCount: row?.recent_activity_count ?? 0,
          previousActivityCount: row?.previous_activity_count ?? 0,
        };
      } catch (error) {
        return throwDatabaseError('getDashboardSummary', error);
      }
    },
    { date: date.toISOString().slice(0, 10) }
  );
}

export async function getTopDueCustomers(limit = 3): Promise<TopDueCustomer[]> {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<TopDueCustomerRow>(
      `WITH summaries AS (
        SELECT
          c.*,
          c.opening_balance
            + COALESCE(SUM(
              CASE
                WHEN t.type = 'credit' THEN t.amount
                WHEN t.type = 'payment' THEN -t.amount
                ELSE 0
              END
          ), 0) AS balance,
          COALESCE(MAX(t.created_at), c.updated_at, c.created_at) AS latest_activity_at,
          MIN(CASE WHEN t.type = 'credit' THEN t.effective_date ELSE NULL END) AS oldest_credit_at,
          MAX(CASE WHEN t.type = 'payment' THEN t.effective_date ELSE NULL END) AS last_payment_at,
          COALESCE(SUM(CASE WHEN t.type = 'credit' THEN t.amount ELSE 0 END), 0) AS total_credit,
          COALESCE(SUM(CASE WHEN t.type = 'payment' THEN t.amount ELSE 0 END), 0) AS total_payment,
          COALESCE(SUM(CASE WHEN t.type = 'payment' THEN 1 ELSE 0 END), 0) AS payment_count,
          (
            SELECT MAX(pr.created_at)
            FROM payment_reminders pr
            WHERE pr.customer_id = c.id
          ) AS last_reminder_at
        FROM customers c
        LEFT JOIN transactions t ON t.customer_id = c.id
        WHERE c.is_archived = 0
        GROUP BY c.id
      )
      SELECT *
      FROM summaries
      WHERE balance > 0
      ORDER BY balance DESC, latest_activity_at DESC, name COLLATE NOCASE ASC
      LIMIT ?`,
      limit
    );

    return rows.map((row) => {
      const customer = mapCustomerSummary(row);
      return {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        balance: customer.balance,
        latestActivityAt: customer.latestActivityAt,
        lastPaymentAt: row.last_payment_at,
        lastReminderAt: row.last_reminder_at,
        insight: customer.insight,
      };
    });
  } catch (error) {
    return throwDatabaseError('getTopDueCustomers', error);
  }
}

export async function getOldestDueCustomers(limit = 5): Promise<CollectionCustomer[]> {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<CollectionCustomerRow>(
      `WITH summaries AS (
        SELECT
          c.*,
          c.opening_balance
            + COALESCE(SUM(
              CASE
                WHEN t.type = 'credit' THEN t.amount
                WHEN t.type = 'payment' THEN -t.amount
                ELSE 0
              END
          ), 0) AS balance,
          COALESCE(MAX(t.created_at), c.updated_at, c.created_at) AS latest_activity_at,
          MIN(CASE WHEN t.type = 'credit' THEN t.effective_date ELSE NULL END) AS oldest_credit_at,
          MAX(CASE WHEN t.type = 'payment' THEN t.effective_date ELSE NULL END) AS last_payment_at,
          COALESCE(SUM(CASE WHEN t.type = 'credit' THEN t.amount ELSE 0 END), 0) AS total_credit,
          COALESCE(SUM(CASE WHEN t.type = 'payment' THEN t.amount ELSE 0 END), 0) AS total_payment,
          COALESCE(SUM(CASE WHEN t.type = 'payment' THEN 1 ELSE 0 END), 0) AS payment_count,
          (
            SELECT MAX(pr.created_at)
            FROM payment_reminders pr
            WHERE pr.customer_id = c.id
          ) AS last_reminder_at
        FROM customers c
        LEFT JOIN transactions t ON t.customer_id = c.id
        WHERE c.is_archived = 0
        GROUP BY c.id
      )
      SELECT *
      FROM summaries
      WHERE balance > 0
      ORDER BY COALESCE(oldest_credit_at, created_at) ASC, balance DESC, name COLLATE NOCASE ASC
      LIMIT ?`,
      limit
    );

    return rows.map(mapCollectionCustomerRow);
  } catch (error) {
    return throwDatabaseError('getOldestDueCustomers', error);
  }
}

export async function getStaleDueCustomers(
  limit = 5,
  cutoffDate = new Date()
): Promise<CollectionCustomer[]> {
  try {
    const db = await getDatabase();
    const cutoff = new Date(cutoffDate);
    cutoff.setDate(cutoff.getDate() - 30);
    const rows = await db.getAllAsync<CollectionCustomerRow>(
      `WITH summaries AS (
        SELECT
          c.*,
          c.opening_balance
            + COALESCE(SUM(
              CASE
                WHEN t.type = 'credit' THEN t.amount
                WHEN t.type = 'payment' THEN -t.amount
                ELSE 0
              END
          ), 0) AS balance,
          COALESCE(MAX(t.created_at), c.updated_at, c.created_at) AS latest_activity_at,
          MIN(CASE WHEN t.type = 'credit' THEN t.effective_date ELSE NULL END) AS oldest_credit_at,
          MAX(CASE WHEN t.type = 'payment' THEN t.effective_date ELSE NULL END) AS last_payment_at,
          COALESCE(SUM(CASE WHEN t.type = 'credit' THEN t.amount ELSE 0 END), 0) AS total_credit,
          COALESCE(SUM(CASE WHEN t.type = 'payment' THEN t.amount ELSE 0 END), 0) AS total_payment,
          COALESCE(SUM(CASE WHEN t.type = 'payment' THEN 1 ELSE 0 END), 0) AS payment_count,
          (
            SELECT MAX(pr.created_at)
            FROM payment_reminders pr
            WHERE pr.customer_id = c.id
          ) AS last_reminder_at
        FROM customers c
        LEFT JOIN transactions t ON t.customer_id = c.id
        WHERE c.is_archived = 0
        GROUP BY c.id
      )
      SELECT *
      FROM summaries
      WHERE balance > 0
        AND (last_payment_at IS NULL OR last_payment_at < ?)
      ORDER BY
        CASE WHEN last_payment_at IS NULL THEN 0 ELSE 1 END ASC,
        COALESCE(last_payment_at, oldest_credit_at, created_at) ASC,
        balance DESC
      LIMIT ?`,
      cutoff.toISOString().slice(0, 10),
      limit
    );

    return rows.map(mapCollectionCustomerRow);
  } catch (error) {
    return throwDatabaseError('getStaleDueCustomers', error);
  }
}

export async function listUpcomingPaymentPromises(
  limit = 5,
  fromDate = new Date()
): Promise<PaymentPromiseWithCustomer[]> {
  try {
    const db = await getDatabase();
    const today = toDateOnlyIso(fromDate);
    const rows = await db.getAllAsync<PaymentPromiseWithCustomerRow>(
      `WITH balances AS (
        SELECT
          c.id,
          c.opening_balance
            + COALESCE(SUM(
              CASE
                WHEN t.type = 'credit' THEN t.amount
                WHEN t.type = 'payment' THEN -t.amount
                ELSE 0
              END
            ), 0) AS current_balance
        FROM customers c
        LEFT JOIN transactions t ON t.customer_id = c.id
        WHERE c.is_archived = 0
        GROUP BY c.id
      )
      SELECT
        pp.*,
        c.name AS customer_name,
        c.phone AS customer_phone,
        COALESCE(b.current_balance, 0) AS current_balance
      FROM payment_promises pp
      INNER JOIN customers c ON c.id = pp.customer_id
      LEFT JOIN balances b ON b.id = pp.customer_id
      WHERE pp.status = 'open'
      ORDER BY
        CASE WHEN pp.promised_date <= ? THEN 0 ELSE 1 END ASC,
        pp.promised_date ASC,
        pp.created_at ASC
      LIMIT ?`,
      today,
      limit
    );

    return rows.map(mapPaymentPromiseWithCustomer);
  } catch (error) {
    return throwDatabaseError('listUpcomingPaymentPromises', error);
  }
}

export async function listPaymentPromiseFollowUps(
  limit = 30,
  fromDate = new Date()
): Promise<PaymentPromiseWithCustomer[]> {
  try {
    const db = await getDatabase();
    const today = toDateOnlyIso(fromDate);
    const rows = await db.getAllAsync<PaymentPromiseWithCustomerRow>(
      `WITH balances AS (
        SELECT
          c.id,
          c.opening_balance
            + COALESCE(SUM(
              CASE
                WHEN t.type = 'credit' THEN t.amount
                WHEN t.type = 'payment' THEN -t.amount
                ELSE 0
              END
            ), 0) AS current_balance
        FROM customers c
        LEFT JOIN transactions t ON t.customer_id = c.id
        WHERE c.is_archived = 0
        GROUP BY c.id
      )
      SELECT
        pp.*,
        c.name AS customer_name,
        c.phone AS customer_phone,
        COALESCE(b.current_balance, 0) AS current_balance
      FROM payment_promises pp
      INNER JOIN customers c ON c.id = pp.customer_id
      LEFT JOIN balances b ON b.id = pp.customer_id
      WHERE pp.status IN ('open', 'missed')
      ORDER BY
        CASE
          WHEN pp.status = 'missed' THEN 0
          WHEN pp.promised_date < ? THEN 1
          WHEN pp.promised_date = ? THEN 2
          ELSE 3
        END ASC,
        pp.promised_date ASC,
        pp.created_at ASC
      LIMIT ?`,
      today,
      today,
      limit
    );

    return rows.map(mapPaymentPromiseWithCustomer);
  } catch (error) {
    return throwDatabaseError('listPaymentPromiseFollowUps', error);
  }
}

function mapCollectionCustomerRow(row: CollectionCustomerRow): CollectionCustomer {
  const customer = mapCustomerSummary(row);
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    balance: customer.balance,
    latestActivityAt: customer.latestActivityAt,
    lastPaymentAt: row.last_payment_at,
    lastReminderAt: row.last_reminder_at,
    insight: customer.insight,
    oldestCreditAt: row.oldest_credit_at,
  };
}

export async function getReportsSummary(date = new Date()): Promise<ReportsSummary> {
  try {
    const db = await getDatabase();
    const recentStart = new Date(date);
    recentStart.setDate(recentStart.getDate() - 7);
    const previousStart = new Date(date);
    previousStart.setDate(previousStart.getDate() - 14);
    const nowIso = date.toISOString();
    const recentStartIso = recentStart.toISOString();
    const previousStartIso = previousStart.toISOString();

    const summaryRow = await db.getFirstAsync<ReportsSummaryRow>(
      `SELECT
        (
          SELECT COALESCE(SUM(total_amount), 0)
          FROM invoices
          WHERE status != 'cancelled'
        ) AS total_sales,
        (
          SELECT COALESCE(SUM(amount), 0)
          FROM transactions
          WHERE type = 'credit'
        ) AS total_credit,
        (
          SELECT COUNT(*)
          FROM invoices
          WHERE status != 'cancelled'
        ) AS invoice_count,
        (
          SELECT COUNT(*)
          FROM transactions
          WHERE type = 'credit'
        ) AS credit_entry_count,
        (
          SELECT COALESCE(SUM(total_amount), 0)
          FROM invoices
          WHERE status != 'cancelled'
            AND created_at >= ?
            AND created_at <= ?
        ) AS current_sales,
        (
          SELECT COALESCE(SUM(total_amount), 0)
          FROM invoices
          WHERE status != 'cancelled'
            AND created_at >= ?
            AND created_at < ?
        ) AS previous_sales,
        (
          SELECT COALESCE(SUM(amount), 0)
          FROM transactions
          WHERE type = 'credit'
            AND created_at >= ?
            AND created_at <= ?
        ) AS current_credit,
        (
          SELECT COALESCE(SUM(amount), 0)
          FROM transactions
          WHERE type = 'credit'
            AND created_at >= ?
            AND created_at < ?
        ) AS previous_credit`,
      recentStartIso,
      nowIso,
      previousStartIso,
      recentStartIso,
      recentStartIso,
      nowIso,
      previousStartIso,
      recentStartIso
    );

    const topRows = await db.getAllAsync<TopReportCustomerRow>(
      `WITH invoice_totals AS (
        SELECT
          customer_id,
          COALESCE(SUM(total_amount), 0) AS total_sales,
          MAX(created_at) AS latest_invoice_at
        FROM invoices
        WHERE customer_id IS NOT NULL
          AND status != 'cancelled'
        GROUP BY customer_id
      ),
      credit_totals AS (
        SELECT
          customer_id,
          COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) AS total_credit,
          COALESCE(SUM(
            CASE
              WHEN type = 'credit' THEN amount
              WHEN type = 'payment' THEN -amount
              ELSE 0
            END
          ), 0) AS transaction_balance,
          MAX(created_at) AS latest_transaction_at
        FROM transactions
        GROUP BY customer_id
      )
      SELECT
        c.id,
        c.name,
        COALESCE(i.total_sales, 0) AS total_sales,
        COALESCE(t.total_credit, 0) AS total_credit,
        c.opening_balance + COALESCE(t.transaction_balance, 0) AS balance,
        COALESCE(t.latest_transaction_at, i.latest_invoice_at, c.updated_at, c.created_at) AS latest_activity_at
      FROM customers c
      LEFT JOIN invoice_totals i ON i.customer_id = c.id
      LEFT JOIN credit_totals t ON t.customer_id = c.id
      WHERE c.is_archived = 0
      ORDER BY (COALESCE(i.total_sales, 0) + COALESCE(t.total_credit, 0)) DESC,
        latest_activity_at DESC,
        c.name COLLATE NOCASE ASC
      LIMIT 5`
    );

    const currentSales = summaryRow?.current_sales ?? 0;
    const previousSales = summaryRow?.previous_sales ?? 0;
    const currentCredit = summaryRow?.current_credit ?? 0;
    const previousCredit = summaryRow?.previous_credit ?? 0;

    return {
      totalSales: summaryRow?.total_sales ?? 0,
      totalCredit: summaryRow?.total_credit ?? 0,
      invoiceCount: summaryRow?.invoice_count ?? 0,
      creditEntryCount: summaryRow?.credit_entry_count ?? 0,
      salesTrend: {
        current: currentSales,
        previous: previousSales,
        change: currentSales - previousSales,
      },
      creditTrend: {
        current: currentCredit,
        previous: previousCredit,
        change: currentCredit - previousCredit,
      },
      topCustomers: topRows.map(mapTopReportCustomer),
    };
  } catch (error) {
    return throwDatabaseError('getReportsSummary', error);
  }
}

export async function searchCustomers(query: string, limit = 50): Promise<Customer[]> {
  return measurePerformance(
    'customer_search',
    'Customer search',
    async () => {
      try {
        const db = await getDatabase();
        const cleaned = query.trim();

        if (!cleaned) {
          const rows = await db.getAllAsync<CustomerRow>(
            `SELECT * FROM customers
             WHERE is_archived = 0
             ORDER BY name COLLATE NOCASE ASC
             LIMIT ?`,
            limit
          );
          return rows.map(mapCustomer);
        }

        const like = `%${escapeLikeQuery(cleaned)}%`;
        const rows = await db.getAllAsync<CustomerRow>(
          `SELECT * FROM customers
           WHERE is_archived = 0
             AND (
              name LIKE ? ESCAPE '\\'
              OR phone LIKE ? ESCAPE '\\'
              OR address LIKE ? ESCAPE '\\'
              OR notes LIKE ? ESCAPE '\\'
             )
           ORDER BY name COLLATE NOCASE ASC
           LIMIT ?`,
          like,
          like,
          like,
          like,
          limit
        );

        return rows.map(mapCustomer);
      } catch (error) {
        return throwDatabaseError('searchCustomers', error);
      }
    },
    { queryLength: query.trim().length, limit }
  );
}

export async function searchCustomerSummaries(
  queryOrOptions: string | SearchCustomerSummariesOptions = '',
  legacyLimit = 50
): Promise<CustomerSummary[]> {
  const options = normalizeCustomerSummarySearchOptions(queryOrOptions, legacyLimit);
  return measurePerformance(
    'customer_search',
    'Customer summary search',
    async () => {
      try {
        const db = await getDatabase();
        const cleaned = options.query.trim();
        const filter = options.filter;
        const whereClauses = [filter === 'archived' ? 'c.is_archived = 1' : 'c.is_archived = 0'];
        const queryParams: Array<string | number> = [];
        const summaryClauses: string[] = [];

        if (cleaned) {
          const like = `%${escapeLikeQuery(cleaned)}%`;
          whereClauses.push(`(
            c.name LIKE ? ESCAPE '\\'
            OR c.phone LIKE ? ESCAPE '\\'
            OR c.address LIKE ? ESCAPE '\\'
            OR c.notes LIKE ? ESCAPE '\\'
          )`);
          queryParams.push(like, like, like, like);
        }

        if (filter === 'outstanding') {
          summaryClauses.push('balance > 0');
        }

        if (filter === 'recent_activity') {
          summaryClauses.push('latest_activity_at >= ?');
          queryParams.push(options.recentSince);
        }

        const summaryFilterClause = summaryClauses.length
          ? `WHERE ${summaryClauses.join(' AND ')}`
          : '';

        const rows = await db.getAllAsync<CustomerSummaryRow>(
          `
          WITH summaries AS (
          SELECT
            c.*,
            c.opening_balance
              + COALESCE(SUM(
                CASE
                  WHEN t.type = 'credit' THEN t.amount
                  WHEN t.type = 'payment' THEN -t.amount
                  ELSE 0
                END
              ), 0) AS balance,
            COALESCE(MAX(t.created_at), c.updated_at, c.created_at) AS latest_activity_at,
            MIN(CASE WHEN t.type = 'credit' THEN t.effective_date ELSE NULL END) AS oldest_credit_at,
            MAX(CASE WHEN t.type = 'payment' THEN t.effective_date ELSE NULL END) AS last_payment_at,
            COALESCE(SUM(CASE WHEN t.type = 'credit' THEN t.amount ELSE 0 END), 0) AS total_credit,
            COALESCE(SUM(CASE WHEN t.type = 'payment' THEN t.amount ELSE 0 END), 0) AS total_payment,
            COALESCE(SUM(CASE WHEN t.type = 'payment' THEN 1 ELSE 0 END), 0) AS payment_count
          FROM customers c
          LEFT JOIN transactions t ON t.customer_id = c.id
          WHERE ${whereClauses.join(' AND ')}
          GROUP BY c.id
          )
          SELECT *
          FROM summaries
          ${summaryFilterClause}
          ORDER BY latest_activity_at DESC, name COLLATE NOCASE ASC
          LIMIT ?
          `,
          ...queryParams,
          options.limit
        );

        return rows.map(mapCustomerSummary);
      } catch (error) {
        return throwDatabaseError('searchCustomerSummaries', error);
      }
    },
    { queryLength: options.query.trim().length, filter: options.filter, limit: options.limit }
  );
}

function normalizeCustomerSummarySearchOptions(
  queryOrOptions: string | SearchCustomerSummariesOptions,
  legacyLimit: number
): Required<SearchCustomerSummariesOptions> {
  if (typeof queryOrOptions === 'string') {
    return {
      query: queryOrOptions,
      limit: legacyLimit,
      filter: 'all',
      recentSince: getRecentActivityCutoffIso(),
    };
  }

  return {
    query: queryOrOptions.query ?? '',
    limit: queryOrOptions.limit ?? legacyLimit,
    filter: queryOrOptions.filter ?? 'all',
    recentSince: queryOrOptions.recentSince ?? getRecentActivityCutoffIso(),
  };
}

function getRecentActivityCutoffIso(): string {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  return cutoff.toISOString();
}

export async function getRecentTransactions(limit = 8): Promise<RecentTransaction[]> {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<RecentTransactionRow>(
      `SELECT
        t.*,
        c.name AS customer_name
       FROM transactions t
       INNER JOIN customers c ON c.id = t.customer_id
       ORDER BY t.created_at DESC
       LIMIT ?`,
      limit
    );

    return rows.map(mapRecentTransaction);
  } catch (error) {
    return throwDatabaseError('getRecentTransactions', error);
  }
}

function buildTaxPackLastCheckKey(lookup: TaxPackLookup): string {
  const countryCode = normalizeRequiredCode(lookup.countryCode, 'Country code');
  const regionCode = normalizeOptionalCode(lookup.regionCode);
  const taxType = normalizeRequiredCode(lookup.taxType, 'Tax type');
  return `${TAX_PACK_LAST_CHECK_PREFIX}:${countryCode}:${regionCode}:${taxType}`;
}

function buildCountryPackageLastCheckKey(lookup: CountryPackageLookup): string {
  const countryCode = normalizeRequiredCode(lookup.countryCode, 'Country code');
  const regionCode = normalizeOptionalCode(lookup.regionCode);
  return `${COUNTRY_PACKAGE_LAST_CHECK_PREFIX}:${countryCode}:${regionCode}`;
}

export async function getFeatureToggles(): Promise<AppFeatureToggles> {
  try {
    const value = await getAppPreference(FEATURE_TOGGLES_KEY);
    return parseFeatureToggles(value);
  } catch (error) {
    return throwDatabaseError('getFeatureToggles', error);
  }
}

export async function saveFeatureToggles(
  input: Partial<AppFeatureToggles>
): Promise<AppFeatureToggles> {
  try {
    const current = await getFeatureToggles();
    const next: AppFeatureToggles = {
      invoices: typeof input.invoices === 'boolean' ? input.invoices : current.invoices,
      inventory: typeof input.inventory === 'boolean' ? input.inventory : current.inventory,
      tax: typeof input.tax === 'boolean' ? input.tax : current.tax,
    };
    const normalizedNext: AppFeatureToggles = {
      ...next,
      inventory: next.invoices ? next.inventory : false,
    };

    await setAppPreference(FEATURE_TOGGLES_KEY, JSON.stringify(normalizedNext));
    return normalizedNext;
  } catch (error) {
    return throwDatabaseError('saveFeatureToggles', error);
  }
}

async function getAppPreference(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<AppPreferenceRow>(
    'SELECT * FROM app_preferences WHERE key = ? LIMIT 1',
    key
  );
  return row?.value ?? null;
}

async function setAppPreference(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO app_preferences (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at`,
    key,
    value,
    new Date().toISOString()
  );
}

function parseFeatureToggles(value: string | null): AppFeatureToggles {
  if (!value) {
    return { ...DEFAULT_FEATURE_TOGGLES };
  }

  try {
    const parsed = JSON.parse(value) as Partial<Record<keyof AppFeatureToggles, unknown>>;

    const toggles = {
      invoices:
        typeof parsed.invoices === 'boolean' ? parsed.invoices : DEFAULT_FEATURE_TOGGLES.invoices,
      inventory:
        typeof parsed.inventory === 'boolean'
          ? parsed.inventory
          : DEFAULT_FEATURE_TOGGLES.inventory,
      tax: typeof parsed.tax === 'boolean' ? parsed.tax : DEFAULT_FEATURE_TOGGLES.tax,
    };

    return {
      ...toggles,
      inventory: toggles.invoices ? toggles.inventory : false,
    };
  } catch {
    return { ...DEFAULT_FEATURE_TOGGLES };
  }
}

async function upsertTaxPack(db: SQLiteDatabase, input: SaveTaxPackInput): Promise<TaxPack> {
  const countryCode = normalizeRequiredCode(input.countryCode, 'Country code');
  const regionCode = normalizeOptionalCode(input.regionCode);
  const taxType = normalizeRequiredCode(input.taxType, 'Tax type');
  const rulesJson = normalizeTaxRulesJson(input.rulesJson);
  const version = requiredText(input.version);
  const lastUpdated = cleanText(input.lastUpdated) ?? new Date().toISOString();
  const source = input.source ?? 'manual';
  const isActive = input.isActive ?? true;

  if (!version) {
    throw new Error('Tax pack version is required.');
  }

  if (!taxPackSources.includes(source)) {
    throw new Error(`Unsupported tax pack source: ${source}`);
  }

  if (isActive) {
    await db.runAsync(
      `UPDATE tax_packs
       SET is_active = 0
       WHERE country_code = ?
         AND region_code = ?
         AND tax_type = ?`,
      countryCode,
      regionCode,
      taxType
    );
  }

  await db.runAsync(
    `INSERT INTO tax_packs (
      id,
      country_code,
      region_code,
      tax_type,
      rules_json,
      version,
      last_updated,
      source,
      is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(country_code, region_code, tax_type, version) DO UPDATE SET
      rules_json = excluded.rules_json,
      last_updated = excluded.last_updated,
      source = excluded.source,
      is_active = excluded.is_active`,
    createEntityId('txp'),
    countryCode,
    regionCode,
    taxType,
    rulesJson,
    version,
    lastUpdated,
    source,
    isActive ? 1 : 0
  );

  const row = await db.getFirstAsync<TaxPackRow>(
    `SELECT * FROM tax_packs
     WHERE country_code = ?
       AND region_code = ?
       AND tax_type = ?
       AND version = ?
     LIMIT 1`,
    countryCode,
    regionCode,
    taxType,
    version
  );

  if (!row) {
    throw new Error('Tax pack was not saved.');
  }

  return mapTaxPack(row);
}

async function upsertDocumentTemplate(
  db: SQLiteDatabase,
  input: SaveDocumentTemplateInput
): Promise<DocumentTemplate> {
  const countryCode = normalizeRequiredCode(input.countryCode, 'Country code');
  const templateType = normalizeDocumentTemplateType(input.templateType);
  const templateConfigJson = normalizeDocumentTemplateConfigJson(input.templateConfigJson);
  const version = requiredText(input.version);

  if (!version) {
    throw new Error('Document template version is required.');
  }

  await db.runAsync(
    `INSERT INTO document_templates (
      id,
      country_code,
      template_type,
      template_config_json,
      version
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(country_code, template_type, version) DO UPDATE SET
      template_config_json = excluded.template_config_json`,
    createEntityId('dtp'),
    countryCode,
    templateType,
    templateConfigJson,
    version
  );

  const row = await db.getFirstAsync<DocumentTemplateRow>(
    `SELECT * FROM document_templates
     WHERE country_code = ?
       AND template_type = ?
       AND version = ?
     LIMIT 1`,
    countryCode,
    templateType,
    version
  );

  if (!row) {
    throw new Error('Document template was not saved.');
  }

  return mapDocumentTemplate(row);
}

async function upsertComplianceConfig(
  db: SQLiteDatabase,
  input: SaveComplianceConfigInput
): Promise<ComplianceConfig> {
  const countryCode = normalizeRequiredCode(input.countryCode, 'Country code');
  const regionCode = normalizeOptionalCode(input.regionCode);
  const configJson = normalizeComplianceConfigJson(input.configJson);
  const version = requiredText(input.version);
  const lastUpdated = cleanText(input.lastUpdated) ?? new Date().toISOString();
  const source = input.source ?? 'manual';
  const isActive = input.isActive ?? true;

  if (!version) {
    throw new Error('Compliance config version is required.');
  }

  if (!countryPackageSources.includes(source)) {
    throw new Error(`Unsupported compliance config source: ${source}`);
  }

  if (isActive) {
    await db.runAsync(
      `UPDATE compliance_configs
       SET is_active = 0
       WHERE country_code = ?
         AND region_code = ?`,
      countryCode,
      regionCode
    );
  }

  await db.runAsync(
    `INSERT INTO compliance_configs (
      id,
      country_code,
      region_code,
      config_json,
      version,
      last_updated,
      source,
      is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(country_code, region_code, version) DO UPDATE SET
      config_json = excluded.config_json,
      last_updated = excluded.last_updated,
      source = excluded.source,
      is_active = excluded.is_active`,
    createEntityId('ccf'),
    countryCode,
    regionCode,
    configJson,
    version,
    lastUpdated,
    source,
    isActive ? 1 : 0
  );

  const row = await db.getFirstAsync<ComplianceConfigRow>(
    `SELECT * FROM compliance_configs
     WHERE country_code = ?
       AND region_code = ?
       AND version = ?
     LIMIT 1`,
    countryCode,
    regionCode,
    version
  );

  if (!row) {
    throw new Error('Compliance config was not saved.');
  }

  return mapComplianceConfig(row);
}

async function getCountryPackageRow(
  db: SQLiteDatabase,
  lookup: CountryPackageLookup
): Promise<CountryPackageRow | null> {
  const countryCode = normalizeRequiredCode(lookup.countryCode, 'Country code');
  const regionCode = normalizeOptionalCode(lookup.regionCode);

  if (lookup.version !== undefined) {
    return db.getFirstAsync<CountryPackageRow>(
      `SELECT * FROM country_packages
       WHERE country_code = ?
         AND region_code = ?
         AND version = ?
       LIMIT 1`,
      countryCode,
      regionCode,
      requiredText(lookup.version)
    );
  }

  return db.getFirstAsync<CountryPackageRow>(
    `SELECT * FROM country_packages
     WHERE country_code = ?
       AND (region_code = ? OR region_code = '')
       AND is_active = 1
     ORDER BY CASE WHEN region_code = ? THEN 0 ELSE 1 END,
       installed_at DESC
     LIMIT 1`,
    countryCode,
    regionCode,
    regionCode
  );
}

async function hydrateCountryPackage(
  db: SQLiteDatabase,
  row: CountryPackageRow
): Promise<CountryPackageWithComponents> {
  const taxPackRow = await db.getFirstAsync<TaxPackRow>(
    'SELECT * FROM tax_packs WHERE id = ? LIMIT 1',
    row.tax_pack_id
  );
  const complianceConfigRow = await db.getFirstAsync<ComplianceConfigRow>(
    'SELECT * FROM compliance_configs WHERE id = ? LIMIT 1',
    row.compliance_config_id
  );
  const templateRows = await db.getAllAsync<DocumentTemplateRow>(
    `SELECT dt.*
     FROM country_package_templates cpt
     INNER JOIN document_templates dt ON dt.id = cpt.document_template_id
     WHERE cpt.country_package_id = ?
     ORDER BY cpt.template_type ASC`,
    row.id
  );

  if (!taxPackRow) {
    throw new Error('Country package tax pack reference is missing.');
  }

  if (!complianceConfigRow) {
    throw new Error('Country package compliance config reference is missing.');
  }

  return {
    ...mapCountryPackage(row),
    taxPack: mapTaxPack(taxPackRow),
    templates: templateRows.map(mapDocumentTemplate),
    complianceConfig: mapComplianceConfig(complianceConfigRow),
  };
}

async function getActivePackageDocumentTemplateRow(
  db: SQLiteDatabase,
  countryCode: string,
  regionCode: string,
  templateType: DocumentTemplateType
): Promise<DocumentTemplateRow | null> {
  return db.getFirstAsync<DocumentTemplateRow>(
    `SELECT dt.*
     FROM country_packages cp
     INNER JOIN country_package_templates cpt ON cpt.country_package_id = cp.id
     INNER JOIN document_templates dt ON dt.id = cpt.document_template_id
     WHERE cp.country_code = ?
       AND (cp.region_code = ? OR cp.region_code = '')
       AND cp.is_active = 1
       AND cpt.template_type = ?
     ORDER BY CASE WHEN cp.region_code = ? THEN 0 ELSE 1 END,
       cp.installed_at DESC
     LIMIT 1`,
    countryCode,
    regionCode,
    templateType,
    regionCode
  );
}

function validateCountryPackageInput(
  countryCode: string,
  regionCode: string,
  input: InstallCountryPackageInput
): void {
  if (!input.templates.length) {
    throw new Error('Country package must include at least one document template.');
  }

  assertCountryPackageComponentScope(
    countryCode,
    regionCode,
    input.taxPack.countryCode,
    input.taxPack.regionCode,
    'Tax pack'
  );
  assertCountryPackageComponentScope(
    countryCode,
    regionCode,
    input.complianceConfig.countryCode,
    input.complianceConfig.regionCode,
    'Compliance config'
  );

  const seenTemplateTypes = new Set<DocumentTemplateType>();
  for (const template of input.templates) {
    const templateCountryCode = normalizeRequiredCode(template.countryCode, 'Template country code');
    if (templateCountryCode !== countryCode) {
      throw new Error('Document template country must match the country package.');
    }

    const templateType = normalizeDocumentTemplateType(template.templateType);
    if (seenTemplateTypes.has(templateType)) {
      throw new Error(`Country package includes more than one ${templateType} template.`);
    }

    seenTemplateTypes.add(templateType);
  }
}

function assertCountryPackageComponentScope(
  packageCountryCode: string,
  packageRegionCode: string,
  componentCountryCode: string,
  componentRegionCode: string | null | undefined,
  componentLabel: string
): void {
  const countryCode = normalizeRequiredCode(componentCountryCode, `${componentLabel} country code`);
  const regionCode = normalizeOptionalCode(componentRegionCode);

  if (countryCode !== packageCountryCode || regionCode !== packageRegionCode) {
    throw new Error(`${componentLabel} scope must match the country package.`);
  }
}

function prepareInvoiceTotals(
  input: { items: AddInvoiceInput['items'] },
  invoiceId: string
): PreparedInvoiceTotals {
  if (!input.items?.length) {
    throw new Error('Invoice must include at least one item.');
  }

  const items = input.items.map((item) => {
    const name = requiredText(item.name);
    if (!name) {
      throw new Error('Invoice item name is required.');
    }

    const id = createEntityId('iit');
    const productId = cleanText(item.productId);
    const description = cleanText(item.description);
    const taxRate = item.taxRate ?? 0;
    if (taxRate > 100) {
      throw new Error('Invoice item tax rate cannot be above 100%.');
    }
    const taxEngineInput = mapInvoiceItemToTaxEngineInput({
      id,
      invoiceId,
      productId,
      name,
      description,
      quantity: item.quantity,
      price: item.price,
      taxRate,
    });
    const calculation = calculateItemTaxTotal(taxEngineInput);

    return {
      id,
      productId,
      name,
      description,
      quantity: item.quantity,
      price: roundCurrency(item.price),
      taxRate,
      taxableAmount: calculation.taxableAmount,
      taxAmount: calculation.taxAmount,
      total: calculation.total,
    };
  });

  const subtotal = roundCurrency(items.reduce((sum, item) => sum + item.taxableAmount, 0));
  const taxAmount = roundCurrency(items.reduce((sum, item) => sum + item.taxAmount, 0));

  return {
    subtotal,
    taxAmount,
    totalAmount: roundCurrency(subtotal + taxAmount),
    items,
  };
}

async function allocatePaymentToInvoices(
  db: SQLiteDatabase,
  input: {
    customerId: string;
    transactionId: string;
    amount: number;
    strategy: PaymentAllocationStrategy;
    invoiceId: string | null;
    createdAt: string;
  }
): Promise<void> {
  if (input.strategy === 'ledger_only') {
    return;
  }

  const rows = await db.getAllAsync<InvoiceRow>(
    `SELECT *
     FROM invoices
     WHERE customer_id = ?
      AND document_state != 'cancelled'
      AND total_amount > paid_amount
     ORDER BY issue_date ASC, created_at ASC`,
    input.customerId
  );
  const targetRows =
    input.strategy === 'selected_invoice'
      ? rows.filter((row) => row.id === input.invoiceId)
      : rows;

  if (input.strategy === 'selected_invoice' && targetRows.length === 0) {
    throw new Error('Choose an unpaid invoice before allocating this payment.');
  }

  let remainingAmount = roundCurrency(input.amount);
  for (const invoice of targetRows) {
    if (remainingAmount <= 0) {
      break;
    }

    const dueAmount = roundCurrency(Math.max(invoice.total_amount - invoice.paid_amount, 0));
    const allocationAmount = roundCurrency(Math.min(remainingAmount, dueAmount));
    if (allocationAmount <= 0) {
      continue;
    }

    const nextPaidAmount = roundCurrency(invoice.paid_amount + allocationAmount);
    const nextPaymentStatus = deriveInvoicePaymentStatus({
      dueDate: invoice.due_date,
      totalAmount: invoice.total_amount,
      paidAmount: nextPaidAmount,
    });
    const documentState = normalizeInvoiceDocumentState(invoice.document_state ?? invoice.status);
    const legacyStatus = legacyStatusForInvoiceLifecycle(documentState, nextPaymentStatus);
    const allocationId = createEntityId('pal');

    await db.runAsync(
      `INSERT INTO payment_allocations (
        id,
        transaction_id,
        invoice_id,
        customer_id,
        amount,
        created_at,
        sync_id,
        last_modified,
        sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      allocationId,
      input.transactionId,
      invoice.id,
      input.customerId,
      allocationAmount,
      input.createdAt,
      allocationId,
      input.createdAt
    );

    await db.runAsync(
      `UPDATE invoices
       SET paid_amount = ?,
        payment_status = ?,
        status = ?,
        last_modified = ?,
        sync_status = 'pending'
       WHERE id = ?`,
      nextPaidAmount,
      nextPaymentStatus,
      legacyStatus,
      input.createdAt,
      invoice.id
    );

    remainingAmount = roundCurrency(remainingAmount - allocationAmount);
  }
}

function serializePaymentDetails(details: PaymentModeDetails | null): string | null {
  if (!details) {
    return null;
  }

  const compact = Object.fromEntries(
    Object.entries(details).filter(([, value]) => typeof value === 'string' && value.trim())
  );
  return Object.keys(compact).length ? JSON.stringify(compact) : null;
}

function parsePaymentDetailsJson(value: string | null): PaymentModeDetails | null {
  if (!value) {
    return null;
  }

  try {
    return normalizePaymentModeDetails(JSON.parse(value) as PaymentModeDetails);
  } catch {
    return null;
  }
}

async function insertInvoiceVersion(
  db: SQLiteDatabase,
  input: {
    id: string;
    invoiceId: string;
    invoiceNumber: string;
    versionNumber: number;
    reason: string;
    createdAt: string;
    customerId: string | null;
    issueDate: string;
    dueDate: string | null;
    documentState: Exclude<InvoiceDocumentState, 'draft'>;
    paymentStatus: InvoicePaymentStatus;
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
    notes: string | null;
    snapshotHash: string;
    itemsJson: string;
  }
): Promise<void> {
  await db.runAsync(
    `INSERT INTO invoice_versions (
      id,
      invoice_id,
      invoice_number,
      version_number,
      reason,
      created_at,
      customer_id,
      issue_date,
      due_date,
      document_state,
      payment_status,
      subtotal,
      tax_amount,
      total_amount,
      notes,
      snapshot_hash,
      items_json,
      sync_id,
      last_modified,
      sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    input.id,
    input.invoiceId,
    input.invoiceNumber,
    input.versionNumber,
    input.reason,
    input.createdAt,
    input.customerId,
    input.issueDate,
    input.dueDate,
    input.documentState,
    input.paymentStatus,
    input.subtotal,
    input.taxAmount,
    input.totalAmount,
    input.notes,
    input.snapshotHash,
    input.itemsJson,
    input.id,
    input.createdAt
  );
}

function cleanVersionReason(value: string | null | undefined, versionNumber: number): string {
  const clean = cleanText(value);
  if (clean) {
    return clean;
  }

  return versionNumber === 1 ? 'First saved invoice' : 'Invoice updated';
}

function buildInvoiceSnapshotHash(input: {
  invoiceNumber: string;
  customerId: string | null;
  issueDate: string;
  dueDate: string | null;
  documentState: InvoiceDocumentState;
  paymentStatus: InvoicePaymentStatus;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes: string | null;
  items: PreparedInvoiceItem[];
}): string {
  return stableStringifyForInvoice({
    invoiceNumber: normalizeSnapshotText(input.invoiceNumber),
    customerId: input.customerId ?? null,
    issueDate: input.issueDate,
    dueDate: input.dueDate ?? null,
    documentState: input.documentState,
    paymentStatus: input.paymentStatus,
    subtotal: roundCurrency(input.subtotal),
    taxAmount: roundCurrency(input.taxAmount),
    totalAmount: roundCurrency(input.totalAmount),
    notes: normalizeSnapshotText(input.notes ?? ''),
    items: input.items
      .map((item) => ({
        name: normalizeSnapshotText(item.name),
        description: normalizeSnapshotText(item.description ?? ''),
        quantity: roundCurrency(item.quantity),
        price: roundCurrency(item.price),
        taxRate: roundCurrency(item.taxRate),
        total: roundCurrency(item.total),
      }))
      .sort((left, right) => stableStringifyForInvoice(left).localeCompare(stableStringifyForInvoice(right))),
  });
}

function stableStringifyForInvoice(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringifyForInvoice).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringifyForInvoice(entryValue)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function normalizeSnapshotText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

async function applyProductStockReductions(
  db: SQLiteDatabase,
  items: PreparedInvoiceItem[]
): Promise<void> {
  const quantitiesByProduct = new Map<string, number>();

  for (const item of items) {
    if (!item.productId) {
      continue;
    }

    quantitiesByProduct.set(
      item.productId,
      roundCurrency((quantitiesByProduct.get(item.productId) ?? 0) + item.quantity, 3)
    );
  }

  for (const [productId, quantity] of quantitiesByProduct.entries()) {
    const product = await db.getFirstAsync<ProductRow>(
      'SELECT * FROM products WHERE id = ? LIMIT 1',
      productId
    );

    if (!product) {
      throw new Error('Selected product could not be found.');
    }

    if (product.stock_quantity < quantity) {
      throw new Error(`Not enough stock for ${product.name}.`);
    }

    const result = await db.runAsync(
      `UPDATE products
       SET stock_quantity = ?,
        last_modified = ?,
        sync_status = 'pending'
       WHERE id = ?
         AND stock_quantity >= ?`,
      roundCurrency(product.stock_quantity - quantity, 3),
      new Date().toISOString(),
      productId,
      quantity
    );

    if (result.changes === 0) {
      throw new Error(`Not enough stock for ${product.name}.`);
    }
  }
}

async function restoreProductStockReductions(
  db: SQLiteDatabase,
  items: Array<{ productId: string | null; quantity: number }>
): Promise<void> {
  const quantitiesByProduct = new Map<string, number>();

  for (const item of items) {
    if (!item.productId) {
      continue;
    }

    quantitiesByProduct.set(
      item.productId,
      roundCurrency((quantitiesByProduct.get(item.productId) ?? 0) + item.quantity, 3)
    );
  }

  for (const [productId, quantity] of quantitiesByProduct.entries()) {
    const result = await db.runAsync(
      `UPDATE products
       SET stock_quantity = stock_quantity + ?,
        last_modified = ?,
        sync_status = 'pending'
       WHERE id = ?`,
      quantity,
      new Date().toISOString(),
      productId
    );

    if (result.changes === 0) {
      throw new Error('Existing invoice product could not be found.');
    }
  }
}

function normalizeRequiredCode(value: string, label: string): string {
  const cleaned = requiredText(value).toUpperCase();
  if (!cleaned) {
    throw new Error(`${label} is required.`);
  }

  return cleaned;
}

function normalizeOptionalCode(value: string | null | undefined): string {
  return cleanText(value)?.toUpperCase() ?? '';
}

function normalizeTaxRulesJson(value: SaveTaxProfileInput['taxRulesJson']): string {
  return normalizeJsonObject(value, 'Tax rules');
}

function normalizeDocumentTemplateType(value: DocumentTemplateType): DocumentTemplateType {
  if (!documentTemplateTypes.includes(value)) {
    throw new Error(`Unsupported document template type: ${value}`);
  }

  return value;
}

function normalizeDocumentTemplateConfigJson(
  value: SaveDocumentTemplateInput['templateConfigJson']
): string {
  return normalizeJsonObject(value, 'Document template config');
}

function normalizeComplianceConfigJson(value: SaveComplianceConfigInput['configJson']): string {
  return normalizeJsonObject(value, 'Compliance config');
}

function normalizeComplianceReportType(value: ComplianceReportType): ComplianceReportType {
  if (!complianceReportTypes.includes(value)) {
    throw new Error(`Unsupported compliance report type: ${value}`);
  }

  return value;
}

function normalizeJsonObject(value: string | Record<string, unknown>, label: string): string {
  const serialized = typeof value === 'string' ? requiredText(value) : JSON.stringify(value);

  if (!serialized) {
    throw new Error(`${label} is required.`);
  }

  try {
    const parsed = JSON.parse(serialized) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${label} must be a JSON object.`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('JSON object')) {
      throw error;
    }

    throw new Error(`${label} must be valid JSON.`);
  }

  return serialized;
}

function validateProductFields(
  name: string,
  price: number,
  stockQuantity: number,
  unit: string
): void {
  if (!name) {
    throw new Error('Product name is required.');
  }

  if (!unit) {
    throw new Error('Product unit is required.');
  }

  if (!Number.isFinite(price) || price < 0) {
    throw new Error('Product price cannot be negative.');
  }

  if (!Number.isFinite(stockQuantity) || stockQuantity < 0) {
    throw new Error('Product stock quantity cannot be negative.');
  }
}

function mapCustomerSummary(row: CustomerSummaryRow): CustomerSummary {
  const insight = buildCustomerPaymentInsight({
    balance: row.balance,
    latestActivityAt: row.latest_activity_at,
    lastPaymentAt: row.last_payment_at,
    oldestDueAt: row.oldest_credit_at,
    paymentCount: row.payment_count ?? 0,
    totalCredit: row.total_credit ?? 0,
    totalPayment: row.total_payment ?? 0,
  });

  return {
    ...mapCustomer(row),
    balance: row.balance,
    latestActivityAt: row.latest_activity_at,
    insight,
    health: buildCustomerHealthScore({
      balance: row.balance,
      daysOutstanding: insight.daysOutstanding,
      latestActivityAt: row.latest_activity_at,
      lastPaymentAt: row.last_payment_at,
      paymentCount: row.payment_count ?? 0,
      totalCredit: row.total_credit ?? 0,
      totalPayment: row.total_payment ?? 0,
    }),
  };
}

function mapTopReportCustomer(row: TopReportCustomerRow): TopReportCustomer {
  return {
    id: row.id,
    name: row.name,
    totalSales: row.total_sales ?? 0,
    totalCredit: row.total_credit ?? 0,
    balance: row.balance ?? 0,
    latestActivityAt: row.latest_activity_at ?? new Date(0).toISOString(),
  };
}

async function getCustomerById(id: string): Promise<Customer | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<CustomerRow>('SELECT * FROM customers WHERE id = ? LIMIT 1', id);
  return row ? mapCustomer(row) : null;
}

async function assertCustomerIsUnique(
  db: SQLiteDatabase,
  name: string,
  phone: string | null,
  currentCustomerId?: string
): Promise<void> {
  const rows = await db.getAllAsync<CustomerRow>(
    `SELECT *
       FROM customers
      WHERE is_archived = 0
        AND id != ?`,
    currentCustomerId ?? ''
  );
  const nameKey = normalizeCustomerNameKey(name);
  const phoneKey = normalizeCustomerPhoneKey(phone);

  const duplicate = rows.some(
    (row) =>
      normalizeCustomerNameKey(row.name) === nameKey &&
      normalizeCustomerPhoneKey(row.phone) === phoneKey
  );
  if (duplicate) {
    throw new DuplicateCustomerError();
  }
}

function normalizeCustomerNameKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeCustomerPhoneKey(value: string | null): string {
  return (value ?? '').replace(/[^\d+]/g, '');
}
