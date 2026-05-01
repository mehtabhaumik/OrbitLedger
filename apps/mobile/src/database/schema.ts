import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'orbit-ledger.db';
export const BUSINESS_SETTINGS_ID = 'primary';
export const APP_SECURITY_ID = 'primary';
export const DOCUMENT_TAX_NOTICE_ACKNOWLEDGED_KEY = 'document_tax_notice_acknowledged';

export async function initializeSchema(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS business_settings (
      id TEXT PRIMARY KEY,
      business_name TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      address TEXT NOT NULL,
      currency TEXT NOT NULL,
      country_code TEXT NOT NULL,
      state_code TEXT NOT NULL,
      logo_uri TEXT,
      authorized_person_name TEXT NOT NULL,
      authorized_person_title TEXT NOT NULL,
      signature_uri TEXT,
      tax_mode TEXT NOT NULL DEFAULT 'not_configured'
        CHECK (tax_mode IN ('not_configured', 'manual', 'exempt')),
      tax_profile_version TEXT,
      tax_profile_source TEXT NOT NULL DEFAULT 'none'
        CHECK (tax_profile_source IN ('none', 'local', 'remote')),
      tax_last_synced_at TEXT,
      tax_setup_required INTEGER NOT NULL DEFAULT 1
        CHECK (tax_setup_required IN (0, 1)),
      storage_mode TEXT NOT NULL DEFAULT 'local_only'
        CHECK (storage_mode IN ('local_only', 'synced')),
      workspace_id TEXT,
      sync_enabled INTEGER NOT NULL DEFAULT 0
        CHECK (sync_enabled IN (0, 1)),
      last_synced_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_id TEXT NOT NULL DEFAULT '',
      last_modified TEXT NOT NULL DEFAULT '',
      sync_status TEXT NOT NULL DEFAULT 'pending',
      server_revision INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      notes TEXT,
      opening_balance REAL NOT NULL DEFAULT 0,
      is_archived INTEGER NOT NULL DEFAULT 0
        CHECK (is_archived IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_id TEXT NOT NULL DEFAULT '',
      last_modified TEXT NOT NULL DEFAULT '',
      sync_status TEXT NOT NULL DEFAULT 'pending',
      server_revision INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('credit', 'payment')),
      amount REAL NOT NULL CHECK (amount > 0),
      note TEXT,
      effective_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      sync_id TEXT NOT NULL DEFAULT '',
      last_modified TEXT NOT NULL DEFAULT '',
      sync_status TEXT NOT NULL DEFAULT 'pending',
      server_revision INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS payment_reminders (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      tone TEXT NOT NULL CHECK (tone IN ('polite', 'firm', 'final')),
      message TEXT NOT NULL,
      balance_at_send REAL NOT NULL DEFAULT 0,
      shared_via TEXT NOT NULL DEFAULT 'system_share_sheet',
      created_at TEXT NOT NULL,
      sync_id TEXT NOT NULL DEFAULT '',
      last_modified TEXT NOT NULL DEFAULT '',
      sync_status TEXT NOT NULL DEFAULT 'pending',
      server_revision INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payment_promises (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      promised_amount REAL NOT NULL CHECK (promised_amount > 0),
      promised_date TEXT NOT NULL,
      note TEXT,
      status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'fulfilled', 'missed', 'cancelled')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_id TEXT NOT NULL DEFAULT '',
      last_modified TEXT NOT NULL DEFAULT '',
      sync_status TEXT NOT NULL DEFAULT 'pending',
      server_revision INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS customer_timeline_notes (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'note'
        CHECK (kind IN ('note', 'dispute')),
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_id TEXT NOT NULL DEFAULT '',
      last_modified TEXT NOT NULL DEFAULT '',
      sync_status TEXT NOT NULL DEFAULT 'pending',
      server_revision INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
    );

	    CREATE TABLE IF NOT EXISTS tax_profiles (
	      id TEXT PRIMARY KEY,
	      country_code TEXT NOT NULL,
      state_code TEXT NOT NULL DEFAULT '',
      tax_type TEXT NOT NULL,
      tax_rules_json TEXT NOT NULL,
      version TEXT NOT NULL,
      last_updated TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual'
        CHECK (source IN ('manual', 'remote', 'seed')),
      sync_id TEXT NOT NULL DEFAULT '',
      last_modified TEXT NOT NULL DEFAULT '',
      sync_status TEXT NOT NULL DEFAULT 'pending',
      server_revision INTEGER NOT NULL DEFAULT 0,
	      UNIQUE (country_code, state_code, tax_type)
	    );

	    CREATE TABLE IF NOT EXISTS tax_packs (
	      id TEXT PRIMARY KEY,
	      country_code TEXT NOT NULL,
	      region_code TEXT NOT NULL DEFAULT '',
	      tax_type TEXT NOT NULL,
	      rules_json TEXT NOT NULL,
	      version TEXT NOT NULL,
	      last_updated TEXT NOT NULL,
	      source TEXT NOT NULL DEFAULT 'manual'
	        CHECK (source IN ('remote', 'manual')),
	      is_active INTEGER NOT NULL DEFAULT 1
	        CHECK (is_active IN (0, 1)),
	      UNIQUE (country_code, region_code, tax_type, version)
	    );

	    CREATE TABLE IF NOT EXISTS document_templates (
	      id TEXT PRIMARY KEY,
	      country_code TEXT NOT NULL,
	      template_type TEXT NOT NULL
	        CHECK (template_type IN ('invoice', 'statement')),
	      template_config_json TEXT NOT NULL,
	      version TEXT NOT NULL,
	      UNIQUE (country_code, template_type, version)
	    );

	    CREATE TABLE IF NOT EXISTS compliance_configs (
	      id TEXT PRIMARY KEY,
	      country_code TEXT NOT NULL,
	      region_code TEXT NOT NULL DEFAULT '',
	      config_json TEXT NOT NULL,
	      version TEXT NOT NULL,
	      last_updated TEXT NOT NULL,
	      source TEXT NOT NULL DEFAULT 'manual'
	        CHECK (source IN ('remote', 'manual')),
	      is_active INTEGER NOT NULL DEFAULT 1
	        CHECK (is_active IN (0, 1)),
	      UNIQUE (country_code, region_code, version)
	    );

	    CREATE TABLE IF NOT EXISTS country_packages (
	      id TEXT PRIMARY KEY,
	      country_code TEXT NOT NULL,
	      region_code TEXT NOT NULL DEFAULT '',
	      package_name TEXT NOT NULL,
	      version TEXT NOT NULL,
	      tax_pack_id TEXT NOT NULL,
	      compliance_config_id TEXT NOT NULL,
	      installed_at TEXT NOT NULL,
	      source TEXT NOT NULL DEFAULT 'manual'
	        CHECK (source IN ('remote', 'manual')),
	      is_active INTEGER NOT NULL DEFAULT 1
	        CHECK (is_active IN (0, 1)),
	      UNIQUE (country_code, region_code, version),
	      FOREIGN KEY (tax_pack_id) REFERENCES tax_packs(id)
	        ON UPDATE CASCADE
	        ON DELETE RESTRICT,
	      FOREIGN KEY (compliance_config_id) REFERENCES compliance_configs(id)
	        ON UPDATE CASCADE
	        ON DELETE RESTRICT
	    );

	    CREATE TABLE IF NOT EXISTS country_package_templates (
	      country_package_id TEXT NOT NULL,
	      document_template_id TEXT NOT NULL,
	      template_type TEXT NOT NULL
	        CHECK (template_type IN ('invoice', 'statement')),
	      PRIMARY KEY (country_package_id, template_type),
	      FOREIGN KEY (country_package_id) REFERENCES country_packages(id)
	        ON UPDATE CASCADE
	        ON DELETE CASCADE,
	      FOREIGN KEY (document_template_id) REFERENCES document_templates(id)
	        ON UPDATE CASCADE
	        ON DELETE RESTRICT
	    );

	    CREATE TABLE IF NOT EXISTS compliance_reports (
	      id TEXT PRIMARY KEY,
	      country_code TEXT NOT NULL,
	      report_type TEXT NOT NULL
	        CHECK (report_type IN ('tax_summary', 'sales_summary', 'dues_summary')),
	      generated_at TEXT NOT NULL,
	      report_data_json TEXT NOT NULL
	    );

	    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0 CHECK (price >= 0),
      stock_quantity REAL NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
      unit TEXT NOT NULL,
      created_at TEXT NOT NULL,
      sync_id TEXT NOT NULL DEFAULT '',
      last_modified TEXT NOT NULL DEFAULT '',
      sync_status TEXT NOT NULL DEFAULT 'pending',
      server_revision INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      invoice_number TEXT NOT NULL,
      issue_date TEXT NOT NULL,
      due_date TEXT,
      subtotal REAL NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
      tax_amount REAL NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
      total_amount REAL NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
      paid_amount REAL NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'issued', 'paid', 'overdue', 'cancelled')),
      document_state TEXT NOT NULL DEFAULT 'draft'
        CHECK (document_state IN ('draft', 'created', 'revised', 'cancelled')),
      payment_status TEXT NOT NULL DEFAULT 'unpaid'
        CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid', 'overdue')),
      version_number INTEGER NOT NULL DEFAULT 0,
      latest_version_id TEXT,
      latest_snapshot_hash TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      sync_id TEXT NOT NULL DEFAULT '',
      last_modified TEXT NOT NULL DEFAULT '',
      sync_status TEXT NOT NULL DEFAULT 'pending',
      server_revision INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      product_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      quantity REAL NOT NULL CHECK (quantity > 0),
      price REAL NOT NULL CHECK (price >= 0),
      tax_rate REAL NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),
      total REAL NOT NULL DEFAULT 0 CHECK (total >= 0),
      sync_id TEXT NOT NULL DEFAULT '',
      last_modified TEXT NOT NULL DEFAULT '',
      sync_status TEXT NOT NULL DEFAULT 'pending',
      server_revision INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS invoice_versions (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      invoice_number TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL,
      customer_id TEXT,
      issue_date TEXT NOT NULL,
      due_date TEXT,
      document_state TEXT NOT NULL
        CHECK (document_state IN ('created', 'revised', 'cancelled')),
      payment_status TEXT NOT NULL
        CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid', 'overdue')),
      subtotal REAL NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
      tax_amount REAL NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
      total_amount REAL NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
      notes TEXT,
      snapshot_hash TEXT NOT NULL,
      items_json TEXT NOT NULL,
      sync_id TEXT NOT NULL DEFAULT '',
      last_modified TEXT NOT NULL DEFAULT '',
      sync_status TEXT NOT NULL DEFAULT 'pending',
      server_revision INTEGER NOT NULL DEFAULT 0,
      UNIQUE (invoice_id, version_number),
      FOREIGN KEY (invoice_id) REFERENCES invoices(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payment_allocations (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      invoice_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      amount REAL NOT NULL CHECK (amount > 0),
      created_at TEXT NOT NULL,
      sync_id TEXT NOT NULL DEFAULT '',
      last_modified TEXT NOT NULL DEFAULT '',
      sync_status TEXT NOT NULL DEFAULT 'pending',
      server_revision INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS app_security (
      id TEXT PRIMARY KEY,
      pin_enabled INTEGER NOT NULL DEFAULT 0
        CHECK (pin_enabled IN (0, 1)),
      pin_hash TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_preferences (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_conflicts (
      id TEXT PRIMARY KEY,
      entity_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      workspace_id TEXT,
      reason TEXT NOT NULL,
      local_last_modified TEXT,
      remote_last_modified TEXT,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_customers_active_name
      ON customers(is_archived, name COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_customers_phone
      ON customers(phone);
    CREATE INDEX IF NOT EXISTS idx_customers_notes
      ON customers(notes COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_customers_active_updated
      ON customers(is_archived, updated_at DESC, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_transactions_customer_effective
      ON transactions(customer_id, effective_date DESC, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_transactions_customer_created
      ON transactions(customer_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_transactions_customer_type_effective
      ON transactions(customer_id, type, effective_date DESC);
    CREATE INDEX IF NOT EXISTS idx_transactions_created_at
      ON transactions(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_transactions_type
      ON transactions(type);
    CREATE INDEX IF NOT EXISTS idx_transactions_type_created
      ON transactions(type, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_payment_reminders_customer_created
      ON payment_reminders(customer_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_payment_reminders_created
      ON payment_reminders(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_payment_promises_customer_date
      ON payment_promises(customer_id, promised_date ASC, status);
    CREATE INDEX IF NOT EXISTS idx_payment_promises_status_date
      ON payment_promises(status, promised_date ASC);
    CREATE INDEX IF NOT EXISTS idx_customer_timeline_notes_customer_created
      ON customer_timeline_notes(customer_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tax_profiles_region_type
      ON tax_profiles(country_code, state_code, tax_type);
	    CREATE INDEX IF NOT EXISTS idx_tax_profiles_last_updated
	      ON tax_profiles(last_updated DESC);
	    CREATE INDEX IF NOT EXISTS idx_tax_packs_lookup_active
	      ON tax_packs(country_code, region_code, tax_type, is_active, last_updated DESC);
	    CREATE INDEX IF NOT EXISTS idx_tax_packs_active_version
	      ON tax_packs(country_code, region_code, is_active, version DESC);
	    CREATE INDEX IF NOT EXISTS idx_tax_packs_last_updated
	      ON tax_packs(last_updated DESC);
	    CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_packs_active_unique
	      ON tax_packs(country_code, region_code, tax_type)
	      WHERE is_active = 1;
	    CREATE INDEX IF NOT EXISTS idx_document_templates_lookup
	      ON document_templates(country_code, template_type, version DESC);
	    CREATE INDEX IF NOT EXISTS idx_document_templates_type_country
	      ON document_templates(template_type, country_code, version DESC);
	    CREATE INDEX IF NOT EXISTS idx_compliance_configs_lookup_active
	      ON compliance_configs(country_code, region_code, is_active, last_updated DESC);
	    CREATE UNIQUE INDEX IF NOT EXISTS idx_compliance_configs_active_unique
	      ON compliance_configs(country_code, region_code)
	      WHERE is_active = 1;
	    CREATE INDEX IF NOT EXISTS idx_country_packages_lookup_active
	      ON country_packages(country_code, region_code, is_active, installed_at DESC);
	    CREATE INDEX IF NOT EXISTS idx_country_packages_active_version
	      ON country_packages(country_code, region_code, is_active, version DESC);
	    CREATE UNIQUE INDEX IF NOT EXISTS idx_country_packages_active_unique
	      ON country_packages(country_code, region_code)
	      WHERE is_active = 1;
	    CREATE INDEX IF NOT EXISTS idx_country_packages_tax_pack
	      ON country_packages(tax_pack_id);
	    CREATE INDEX IF NOT EXISTS idx_country_packages_compliance_config
	      ON country_packages(compliance_config_id);
	    CREATE INDEX IF NOT EXISTS idx_country_package_templates_template
	      ON country_package_templates(document_template_id);
	    CREATE INDEX IF NOT EXISTS idx_compliance_reports_lookup
	      ON compliance_reports(country_code, report_type, generated_at DESC);
	    CREATE INDEX IF NOT EXISTS idx_compliance_reports_generated_at
	      ON compliance_reports(generated_at DESC);
	    CREATE INDEX IF NOT EXISTS idx_products_name
      ON products(name COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_products_unit
      ON products(unit COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_products_stock
      ON products(stock_quantity ASC, name COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_products_created_at
      ON products(created_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_invoice_number
      ON invoices(invoice_number COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_invoices_customer_issue
      ON invoices(customer_id, issue_date DESC, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_invoices_status
      ON invoices(status);
    CREATE INDEX IF NOT EXISTS idx_invoices_issue_created
      ON invoices(issue_date DESC, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_invoices_status_issue
      ON invoices(status, issue_date DESC, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_invoices_customer_status_issue
      ON invoices(customer_id, status, issue_date DESC, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_invoices_document_state
      ON invoices(document_state, issue_date DESC, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_invoices_payment_status
      ON invoices(payment_status, issue_date DESC, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice
      ON invoice_items(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_product
      ON invoice_items(invoice_id, product_id);
    CREATE INDEX IF NOT EXISTS idx_app_preferences_updated_at
      ON app_preferences(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sync_conflicts_workspace
      ON sync_conflicts(workspace_id, resolved_at, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_invoice_versions_invoice
      ON invoice_versions(invoice_id, version_number DESC);
    CREATE INDEX IF NOT EXISTS idx_payment_allocations_invoice
      ON payment_allocations(invoice_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_payment_allocations_transaction
      ON payment_allocations(transaction_id);
  `);

  await ensureColumn(db, 'invoices', 'paid_amount', 'REAL NOT NULL DEFAULT 0 CHECK (paid_amount >= 0)');
  await ensureColumn(
    db,
    'invoices',
    'document_state',
    "TEXT NOT NULL DEFAULT 'draft' CHECK (document_state IN ('draft', 'created', 'revised', 'cancelled'))"
  );
  await ensureColumn(
    db,
    'invoices',
    'payment_status',
    "TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid', 'overdue'))"
  );
  await ensureColumn(db, 'invoices', 'version_number', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'invoices', 'latest_version_id', 'TEXT');
  await ensureColumn(db, 'invoices', 'latest_snapshot_hash', 'TEXT');
  await ensureColumn(db, 'invoice_items', 'product_id', 'TEXT');
  await ensureColumn(db, 'invoice_items', 'description', 'TEXT');
  await ensureColumn(
    db,
    'business_settings',
    'storage_mode',
    "TEXT NOT NULL DEFAULT 'local_only' CHECK (storage_mode IN ('local_only', 'synced'))"
  );
  await ensureColumn(db, 'business_settings', 'workspace_id', 'TEXT');
  await ensureColumn(
    db,
    'business_settings',
    'sync_enabled',
    "INTEGER NOT NULL DEFAULT 0 CHECK (sync_enabled IN (0, 1))"
  );
  await ensureColumn(db, 'business_settings', 'last_synced_at', 'TEXT');
  await db.execAsync(`
    UPDATE business_settings
    SET
      storage_mode = CASE
        WHEN storage_mode IS NULL OR storage_mode = '' THEN 'local_only'
        ELSE storage_mode
      END,
      sync_enabled = CASE
        WHEN workspace_id IS NOT NULL AND workspace_id != '' THEN 1
        ELSE sync_enabled
      END,
      last_synced_at = CASE
        WHEN last_synced_at IS NULL AND workspace_id IS NOT NULL AND workspace_id != '' THEN updated_at
        ELSE last_synced_at
      END;
  `);
  await ensureSyncMetadataColumns(db);
  await db.execAsync(`
    UPDATE invoices
    SET document_state = CASE
        WHEN status = 'draft' THEN 'draft'
        WHEN status = 'cancelled' THEN 'cancelled'
        WHEN document_state IS NULL OR document_state = '' THEN 'created'
        ELSE document_state
      END,
      payment_status = CASE
        WHEN status = 'paid' THEN 'paid'
        WHEN status = 'overdue' THEN 'overdue'
        WHEN payment_status IS NULL OR payment_status = '' THEN 'unpaid'
        ELSE payment_status
      END;
  `);
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_invoice_items_product
      ON invoice_items(product_id);
    CREATE INDEX IF NOT EXISTS idx_business_settings_sync_status
      ON business_settings(sync_status, last_modified);
    CREATE INDEX IF NOT EXISTS idx_business_settings_workspace
      ON business_settings(storage_mode, workspace_id, sync_enabled);
    CREATE INDEX IF NOT EXISTS idx_customers_sync_status
      ON customers(sync_status, last_modified);
    CREATE INDEX IF NOT EXISTS idx_transactions_sync_status
      ON transactions(sync_status, last_modified);
    CREATE INDEX IF NOT EXISTS idx_payment_reminders_sync_status
      ON payment_reminders(sync_status, last_modified);
    CREATE INDEX IF NOT EXISTS idx_payment_promises_sync_status
      ON payment_promises(sync_status, last_modified);
    CREATE INDEX IF NOT EXISTS idx_tax_profiles_sync_status
      ON tax_profiles(sync_status, last_modified);
    CREATE INDEX IF NOT EXISTS idx_products_sync_status
      ON products(sync_status, last_modified);
    CREATE INDEX IF NOT EXISTS idx_invoices_sync_status
      ON invoices(sync_status, last_modified);
    CREATE INDEX IF NOT EXISTS idx_invoice_items_sync_status
      ON invoice_items(sync_status, last_modified);
    CREATE INDEX IF NOT EXISTS idx_invoice_versions_sync_status
      ON invoice_versions(sync_status, last_modified);
    CREATE INDEX IF NOT EXISTS idx_payment_allocations_sync_status
      ON payment_allocations(sync_status, last_modified);
  `);
}

async function ensureColumn(
  db: SQLiteDatabase,
  tableName: string,
  columnName: string,
  definition: string
): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName})`);
  if (columns.some((column) => column.name === columnName)) {
    return;
  }

  await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
}

async function ensureSyncMetadataColumns(db: SQLiteDatabase): Promise<void> {
  const syncTables = [
    { name: 'business_settings', modifiedAtExpression: 'updated_at' },
    { name: 'customers', modifiedAtExpression: 'updated_at' },
    { name: 'transactions', modifiedAtExpression: 'created_at' },
    { name: 'payment_reminders', modifiedAtExpression: 'created_at' },
    { name: 'payment_promises', modifiedAtExpression: 'updated_at' },
    { name: 'tax_profiles', modifiedAtExpression: 'last_updated' },
    { name: 'products', modifiedAtExpression: 'created_at' },
    { name: 'invoices', modifiedAtExpression: 'created_at' },
    { name: 'invoice_items', modifiedAtExpression: "datetime('now')" },
    { name: 'invoice_versions', modifiedAtExpression: 'created_at' },
    { name: 'payment_allocations', modifiedAtExpression: 'created_at' },
  ];

  for (const table of syncTables) {
    await ensureColumn(db, table.name, 'sync_id', "TEXT NOT NULL DEFAULT ''");
    await ensureColumn(db, table.name, 'last_modified', "TEXT NOT NULL DEFAULT ''");
    await ensureColumn(db, table.name, 'sync_status', "TEXT NOT NULL DEFAULT 'pending'");
    await ensureColumn(db, table.name, 'server_revision', 'INTEGER NOT NULL DEFAULT 0');
    await db.execAsync(`
      UPDATE ${table.name}
      SET
        sync_id = CASE WHEN sync_id = '' THEN id ELSE sync_id END,
        last_modified = CASE
          WHEN last_modified = '' THEN COALESCE(${table.modifiedAtExpression}, datetime('now'))
          ELSE last_modified
        END,
        sync_status = CASE WHEN sync_status = '' THEN 'pending' ELSE sync_status END,
        server_revision = COALESCE(server_revision, 0);
    `);
  }
}
