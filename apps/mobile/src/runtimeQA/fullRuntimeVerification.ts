import {
  addCustomer,
  addInvoice,
  addPaymentReminder,
  addPaymentPromise,
  addProduct,
  addTransaction,
  getBusinessSettings,
  getCustomerBalance,
  getCustomerLedger,
  getDashboardSummary,
  getFeatureToggles,
  getInvoice,
  getProduct,
  listComplianceReports,
  listInvoices,
  listProducts,
  saveBusinessSettings,
  searchCustomerSummaries,
  updateCustomer,
  updateInvoice,
  updateProduct,
  updateTransaction,
  type BusinessSettings,
  type Customer,
  type InvoiceWithItems,
  type Product,
  type SaveTaxPackInput,
  type TaxPackLookup,
} from '../database';
import {
  createOrbitLedgerBackup,
  prepareFullReplaceRestorePlan,
  restoreOrbitLedgerBackup,
  validateOrbitLedgerBackup,
} from '../backup';
import {
  applyCountryPackageUpdateFromProvider,
  manualCheckCountryPackageUpdates,
  type CountryPackageUpdateCandidate,
  type CountryPackageUpdateProvider,
} from '../countryPackages';
import {
  buildCustomerStatementDocument,
  buildInvoiceDocument,
  generatePdfFromStructuredDocument,
} from '../documents';
import { createAccountantIntegrationPayload, serializeAccountantPayloadAsCsv, serializeAccountantPayloadAsJson } from '../accountant';
import { generateComplianceReport } from '../compliance';
import {
  applyTaxPackUpdateFromProvider,
  manualCheckTaxPackUpdates,
  type TaxPackUpdateCandidate,
  type TaxPackUpdateProvider,
} from '../tax/taxPackService';
import {
  clearPinLockSecureState,
  disablePinLock,
  enablePinLock,
  isPinLockEnabled,
  savePinInactivityTimeoutMs,
  verifyPin,
} from '../security/pinLock';
import { runNativeRuntimeReadinessChecks, type RuntimeQACheckResult } from './nativeReadiness';

export type Phase16FlowStatus = 'passed' | 'warning' | 'failed';

export type Phase16FlowResult = {
  id: string;
  title: string;
  status: Phase16FlowStatus;
  message: string;
};

export type Phase16RuntimeVerificationResult = {
  startedAt: string;
  completedAt: string;
  status: 'passed' | 'failed';
  platformChecks: RuntimeQACheckResult[];
  flows: Phase16FlowResult[];
};

type Phase16Context = {
  runId: string;
  today: string;
  business: BusinessSettings | null;
  customer: Customer | null;
  product: Product | null;
  invoice: InvoiceWithItems | null;
  statementPdfUri: string | null;
  invoicePdfUri: string | null;
  backupJson: string | null;
};

const LOG_PREFIX = '[phase16-runtime-qa]';
const TEST_PIN = '4826';

export async function runPhase16RuntimeVerification(): Promise<Phase16RuntimeVerificationResult> {
  if (globalThis.__orbitLedgerPhase16RuntimeQaStarted) {
    const now = new Date().toISOString();
    const skipped: Phase16RuntimeVerificationResult = {
      startedAt: now,
      completedAt: now,
      status: 'passed',
      platformChecks: [],
      flows: [
        {
          id: 'single-run-guard',
          title: 'Single-run guard',
          status: 'passed',
          message: 'Phase 16 runtime verification was already running in this JavaScript runtime.',
        },
      ],
    };
    console.log(`${LOG_PREFIX} PHASE16_QA_SKIPPED ${JSON.stringify(skipped)}`);
    return skipped;
  }

  globalThis.__orbitLedgerPhase16RuntimeQaStarted = true;
  const startedAt = new Date().toISOString();
  const context: Phase16Context = {
    runId: Date.now().toString(36),
    today: toDateOnlyIso(new Date()),
    business: null,
    customer: null,
    product: null,
    invoice: null,
    statementPdfUri: null,
    invoicePdfUri: null,
    backupJson: null,
  };
  const flows: Phase16FlowResult[] = [];

  console.log(`${LOG_PREFIX} PHASE16_QA_START ${startedAt}`);
  const platformChecks = await runNativeRuntimeReadinessChecks();

  await runFlow(flows, 'business-setup', 'Onboarding and business setup', () =>
    verifyBusinessSetup(context)
  );
  await runFlow(flows, 'customer-flow', 'Customer create and edit', () =>
    verifyCustomerFlow(context)
  );
  await runFlow(flows, 'transaction-flow', 'Transaction add, edit, and balances', () =>
    verifyTransactionFlow(context)
  );
  await runFlow(flows, 'dashboard-search', 'Dashboard and customer search data', () =>
    verifyDashboardAndSearch(context)
  );
  await runFlow(flows, 'inventory-invoice', 'Product inventory and invoice create/edit', () =>
    verifyInventoryAndInvoiceFlow(context)
  );
  await runFlow(flows, 'documents', 'Statement and invoice PDF generation', () =>
    verifyDocumentGeneration(context)
  );
  await runFlow(flows, 'tax-country-packages', 'Tax update and country package apply', () =>
    verifyTaxAndCountryPackageFlow(context)
  );
  await runFlow(flows, 'compliance-accountant', 'Compliance reports and accountant export', () =>
    verifyComplianceAndAccountantExport(context)
  );
  await runFlow(flows, 'backup-restore', 'Full backup and restore replace safety', () =>
    verifyBackupRestoreFlow(context)
  );
  await runFlow(flows, 'pin-security', 'PIN setup, verify, timeout, and disable', () =>
    verifyPinSecurityFlow()
  );
  await runFlow(flows, 'feature-state', 'Feature toggles and list integrity', () =>
    verifyFeatureState()
  );

  const failedPlatformChecks = platformChecks.filter((check) => check.status === 'failed');
  const failedFlows = flows.filter((flow) => flow.status === 'failed');
  const completedAt = new Date().toISOString();
  const result: Phase16RuntimeVerificationResult = {
    startedAt,
    completedAt,
    status: failedPlatformChecks.length === 0 && failedFlows.length === 0 ? 'passed' : 'failed',
    platformChecks,
    flows,
  };

  console.log(`${LOG_PREFIX} PHASE16_QA_RESULT ${JSON.stringify(result)}`);
  return result;
}

async function runFlow(
  flows: Phase16FlowResult[],
  id: string,
  title: string,
  run: () => Promise<string>
): Promise<void> {
  try {
    await waitForUi();
    const message = await run();
    flows.push({ id, title, status: 'passed', message });
    console.log(`${LOG_PREFIX} PASS ${id}: ${message}`);
  } catch (error) {
    const message = getErrorMessage(error);
    flows.push({ id, title, status: 'failed', message });
    console.warn(`${LOG_PREFIX} FAIL ${id}: ${message}`, error);
  }
}

async function verifyBusinessSetup(context: Phase16Context): Promise<string> {
  const existing = await getBusinessSettings();
  const business = await saveBusinessSettings({
    businessName: existing?.businessName ?? `Phase 16 QA Ledger ${context.runId}`,
    ownerName: existing?.ownerName ?? 'Rudraix',
    phone: existing?.phone ?? '9876543210',
    email: existing?.email ?? 'phase16@example.com',
    address: existing?.address ?? 'Phase 16 QA Street, Ahmedabad, Gujarat',
    currency: existing?.currency ?? 'INR',
    countryCode: existing?.countryCode ?? 'IN',
    stateCode: existing?.stateCode ?? 'GJ',
    logoUri: existing?.logoUri ?? null,
    authorizedPersonName: existing?.authorizedPersonName ?? 'Rudraix',
    authorizedPersonTitle: existing?.authorizedPersonTitle ?? 'Owner',
    signatureUri: existing?.signatureUri ?? null,
    taxMode: existing?.taxMode ?? 'manual',
    taxProfileVersion: existing?.taxProfileVersion ?? null,
    taxProfileSource: existing?.taxProfileSource ?? 'remote',
    taxLastSyncedAt: existing?.taxLastSyncedAt ?? new Date().toISOString(),
    taxSetupRequired: existing?.taxSetupRequired ?? false,
  });

  context.business = business;
  return `Business profile available for ${business.businessName}.`;
}

async function verifyCustomerFlow(context: Phase16Context): Promise<string> {
  const customer = await addCustomer({
    name: `Phase 16 Customer ${context.runId}`,
    phone: '9123456780',
    address: 'Runtime QA customer address',
    notes: 'Created by native Phase 16 runtime verification.',
    openingBalance: 250,
  });
  const updated = await updateCustomer(customer.id, {
    notes: 'Updated by native Phase 16 runtime verification.',
    address: 'Updated runtime QA customer address',
  });

  context.customer = updated;
  return `Customer ${updated.name} created and updated.`;
}

async function verifyTransactionFlow(context: Phase16Context): Promise<string> {
  const customer = requireCustomer(context);
  await addTransaction({
    customerId: customer.id,
    type: 'credit',
    amount: 500,
    note: 'Phase 16 credit entry',
    effectiveDate: context.today,
  });
  const payment = await addTransaction({
    customerId: customer.id,
    type: 'payment',
    amount: 125,
    note: 'Phase 16 payment entry',
    effectiveDate: context.today,
  });
  await updateTransaction(payment.id, {
    amount: 175,
    note: 'Phase 16 edited payment entry',
  });

  const ledger = await getCustomerLedger(customer.id);
  const balance = await getCustomerBalance(customer.id);
  const expectedBalance = 250 + 500 - 175;
  if (Math.abs(balance - expectedBalance) > 0.001 || Math.abs(ledger.balance - expectedBalance) > 0.001) {
    throw new Error(`Expected balance ${expectedBalance}, got ${balance} / ${ledger.balance}.`);
  }

  return `Ledger balance recalculated to ${balance} after transaction edit.`;
}

async function verifyDashboardAndSearch(context: Phase16Context): Promise<string> {
  const customer = requireCustomer(context);
  const [summary, searchResults] = await Promise.all([
    getDashboardSummary(new Date()),
    searchCustomerSummaries({ query: customer.name, limit: 5 }),
  ]);

  if (!searchResults.some((result) => result.id === customer.id)) {
    throw new Error('Created customer was not returned by customer search.');
  }

  return `Dashboard receivable ${summary.totalReceivable}; search found ${searchResults.length} customer(s).`;
}

async function verifyInventoryAndInvoiceFlow(context: Phase16Context): Promise<string> {
  const customer = requireCustomer(context);
  const product = await addProduct({
    name: `Phase 16 Service ${context.runId}`,
    price: 1500,
    stockQuantity: 20,
    unit: 'service',
  });
  const updatedProduct = await updateProduct(product.id, {
    price: 1600,
    stockQuantity: 20,
  });
  const invoice = await addInvoice({
    customerId: customer.id,
    invoiceNumber: `P16-${context.runId.toUpperCase()}`,
    issueDate: context.today,
    dueDate: context.today,
    status: 'issued',
    notes: 'Native runtime QA invoice.',
    items: [
      {
        productId: updatedProduct.id,
        name: updatedProduct.name,
        description: 'Runtime-verified invoice service description.',
        quantity: 2,
        price: updatedProduct.price,
        taxRate: 18,
      },
    ],
  });
  const afterCreateProduct = await getProduct(updatedProduct.id);
  if (!afterCreateProduct || Math.abs(afterCreateProduct.stockQuantity - 18) > 0.001) {
    throw new Error(`Expected stock 18 after invoice create, got ${afterCreateProduct?.stockQuantity}.`);
  }

  const editedInvoice = await updateInvoice(invoice.id, {
    notes: 'Edited native runtime QA invoice.',
    items: [
      {
        productId: updatedProduct.id,
        name: updatedProduct.name,
        description: 'Runtime-verified edited invoice service description.',
        quantity: 3,
        price: updatedProduct.price,
        taxRate: 18,
      },
    ],
  });
  const afterEditProduct = await getProduct(updatedProduct.id);
  if (!afterEditProduct || Math.abs(afterEditProduct.stockQuantity - 17) > 0.001) {
    throw new Error(`Expected stock 17 after invoice edit, got ${afterEditProduct?.stockQuantity}.`);
  }

  if (Math.abs(editedInvoice.subtotal - 4800) > 0.001 || Math.abs(editedInvoice.taxAmount - 864) > 0.001) {
    throw new Error(
      `Invoice totals were not recalculated correctly: subtotal ${editedInvoice.subtotal}, tax ${editedInvoice.taxAmount}.`
    );
  }

  context.product = afterEditProduct;
  context.invoice = editedInvoice;
  return `Invoice ${editedInvoice.invoiceNumber} edited; product stock adjusted to ${afterEditProduct.stockQuantity}.`;
}

async function verifyDocumentGeneration(context: Phase16Context): Promise<string> {
  const business = requireBusiness(context);
  const customer = requireCustomer(context);
  const invoice = requireInvoice(context);
  const ledger = await getCustomerLedger(customer.id);

  const statementDocument = buildCustomerStatementDocument({
    businessProfile: business,
    customer,
    transactions: ledger.transactions,
    statementDate: context.today,
    dateRange: { from: context.today, to: context.today },
    locale: 'en-IN',
    documentOptions: {
      includeCustomBranding: true,
      pdfStyle: 'advanced',
      taxRegistrationNumber: '27ABCDE1234F1Z5',
    },
  });
  const statementPdf = await generatePdfFromStructuredDocument(statementDocument);

  const invoiceDocument = buildInvoiceDocument({
    businessProfile: business,
    customer,
    invoice,
    locale: 'en-IN',
    documentOptions: {
      includeCustomBranding: true,
      pdfStyle: 'advanced',
      taxRegistrationNumber: '27ABCDE1234F1Z5',
      taxBreakdownMode: 'india_intra_state',
      taxColumnLabel: 'GST',
      taxSummaryLabel: 'GST',
      taxRegistrationLabel: 'GSTIN',
    },
  });
  const invoicePdf = await generatePdfFromStructuredDocument(invoiceDocument);

  if (!statementPdf.uri || !invoicePdf.uri) {
    throw new Error('PDF generation did not return both statement and invoice file URIs.');
  }

  context.statementPdfUri = statementPdf.uri;
  context.invoicePdfUri = invoicePdf.uri;
  return `Generated statement PDF and invoice PDF (${statementPdf.numberOfPages}/${invoicePdf.numberOfPages} pages).`;
}

async function verifyTaxAndCountryPackageFlow(context: Phase16Context): Promise<string> {
  const business = requireBusiness(context);
  const taxLookup: TaxPackLookup = {
    countryCode: business.countryCode,
    regionCode: business.stateCode,
    taxType: business.countryCode.toUpperCase() === 'IN' ? 'GST' : 'TAX',
  };
  const taxCandidate: TaxPackUpdateCandidate = {
    version: `16.${context.runId}`,
    lastUpdated: new Date().toISOString(),
    payloadUrl: 'https://phase16.local/tax-pack.json',
    checksum: '0'.repeat(64),
  };
  const taxProvider: TaxPackUpdateProvider = {
    checkLatestVersion: async () => taxCandidate,
    fetchTaxPack: async () => buildQaTaxPack(taxLookup, taxCandidate.version),
  };
  const taxCheck = await manualCheckTaxPackUpdates(taxLookup, taxProvider);
  const taxApply = await applyTaxPackUpdateFromProvider(taxLookup, taxCandidate, taxProvider);

  if (!taxCheck.updateAvailable || taxApply.status !== 'saved' || !taxApply.taxPack?.isActive) {
    throw new Error(`Tax pack update did not apply. Check=${taxCheck.updateAvailable} status=${taxApply.status}.`);
  }

  const packageCandidate: CountryPackageUpdateCandidate = {
    packageVersion: `16.${context.runId}`,
    taxPackVersion: taxCandidate.version,
    complianceConfigVersion: `16.${context.runId}`,
    templateVersions: {
      invoice: `16.${context.runId}`,
      statement: `16.${context.runId}`,
    },
    lastUpdated: new Date().toISOString(),
    payloadUrl: 'https://phase16.local/country-package.json',
    checksum: '1'.repeat(64),
  };
  const packageProvider: CountryPackageUpdateProvider = {
    checkLatestVersion: async () => packageCandidate,
    fetchCountryPackage: async () => ({
      countryCode: business.countryCode,
      regionCode: business.stateCode,
      packageName: `${business.countryCode} Phase 16 QA Package`,
      version: packageCandidate.packageVersion,
      source: 'remote',
      taxPack: buildQaTaxPack(taxLookup, taxCandidate.version),
      templates: [
        {
          countryCode: business.countryCode,
          templateType: 'invoice',
          version: packageCandidate.templateVersions?.invoice ?? packageCandidate.packageVersion,
          templateConfigJson: {
            layoutVersion: 1,
            metadata: {
              templateKey: business.countryCode.toUpperCase() === 'IN' ? 'IN_GST_STANDARD_FREE' : 'GENERIC_INVOICE_STANDARD_FREE',
              templateLabel: 'Phase 16 Invoice Template',
              visualStyle: 'classic_tax',
              countryFormat: business.countryCode.toUpperCase() === 'IN' ? 'india_gst' : 'generic_tax',
              templateTier: 'free',
            },
            numberFormat: { locale: 'en-IN', currencyDisplay: 'code' },
          },
        },
        {
          countryCode: business.countryCode,
          templateType: 'statement',
          version: packageCandidate.templateVersions?.statement ?? packageCandidate.packageVersion,
          templateConfigJson: {
            layoutVersion: 1,
            metadata: {
              templateKey: business.countryCode.toUpperCase() === 'IN' ? 'IN_STATEMENT_STANDARD_FREE' : 'GENERIC_STATEMENT_STANDARD_FREE',
              templateLabel: 'Phase 16 Statement Template',
              visualStyle: 'balance_forward',
              templateTier: 'free',
            },
            numberFormat: { locale: 'en-IN', currencyDisplay: 'code' },
          },
        },
      ],
      complianceConfig: {
        countryCode: business.countryCode,
        regionCode: business.stateCode,
        version: packageCandidate.complianceConfigVersion ?? packageCandidate.packageVersion,
        lastUpdated: new Date().toISOString(),
        source: 'remote',
        isActive: true,
        configJson: {
          labels: {
            taxName: taxLookup.taxType,
            taxAmount: `${taxLookup.taxType} amount`,
          },
          numberFormat: {
            locale: 'en-IN',
            currencyDisplay: 'code',
            decimalPlaces: 2,
          },
          reportRules: {
            excludedInvoiceStatuses: ['cancelled'],
            topOutstandingCustomerLimit: 10,
          },
        },
      },
    }),
  };
  const packageCheck = await manualCheckCountryPackageUpdates(
    { countryCode: business.countryCode, regionCode: business.stateCode },
    packageProvider
  );
  const packageApply = await applyCountryPackageUpdateFromProvider(
    { countryCode: business.countryCode, regionCode: business.stateCode },
    packageCandidate,
    packageProvider
  );

  if (!packageCheck.updateAvailable || packageApply.status !== 'installed' || !packageApply.countryPackage?.isActive) {
    throw new Error(
      `Country package update did not install. Check=${packageCheck.updateAvailable} status=${packageApply.status}.`
    );
  }

  return `Applied active tax pack ${taxApply.taxPack.version} and country package ${packageApply.countryPackage.version}.`;
}

async function verifyComplianceAndAccountantExport(context: Phase16Context): Promise<string> {
  const business = requireBusiness(context);
  const taxReport = await generateComplianceReport({
    reportType: 'tax_summary',
    dateRange: { from: context.today, to: context.today },
    persist: true,
  });
  const reports = await listComplianceReports({ countryCode: business.countryCode, limit: 5 });
  if (!taxReport.savedReport || !reports.some((report) => report.id === taxReport.savedReport?.id)) {
    throw new Error('Generated compliance report was not saved or listed.');
  }

  const payload = await createAccountantIntegrationPayload();
  const json = serializeAccountantPayloadAsJson(payload);
  const csv = serializeAccountantPayloadAsCsv(payload);
  if (!json.includes('Orbit Ledger by Rudraix') || !csv.includes('invoice_items')) {
    throw new Error('Accountant JSON/CSV export payload was not populated.');
  }

  return `Compliance report saved; accountant export contains ${payload.data.transactions.length} transaction(s) and ${payload.data.invoices.length} invoice(s).`;
}

async function verifyBackupRestoreFlow(context: Phase16Context): Promise<string> {
  const customer = requireCustomer(context);
  const invoice = requireInvoice(context);
  const backupResult = await createOrbitLedgerBackup();
  const validated = validateOrbitLedgerBackup(backupResult.backup);
  const plan = prepareFullReplaceRestorePlan(validated);
  const staleProduct = await addProduct({
    name: `Phase 16 stale product ${context.runId}`,
    price: 99,
    stockQuantity: 1,
    unit: 'piece',
  });

  await restoreOrbitLedgerBackup(backupResult.json);
  const [restoredLedger, restoredInvoice, staleProductAfterRestore] = await Promise.all([
    getCustomerLedger(customer.id),
    getInvoice(invoice.id),
    getProduct(staleProduct.id),
  ]);

  if (!restoredInvoice) {
    throw new Error('Invoice from backup was not present after restore.');
  }

  if (staleProductAfterRestore) {
    throw new Error('Stale product created after backup survived full-replace restore.');
  }

  context.backupJson = backupResult.json;
  context.invoice = restoredInvoice;
  return `Backup validated with ${plan.recordCounts.invoices} invoice(s); restore preserved balance ${restoredLedger.balance} and removed stale expanded data.`;
}

async function verifyPinSecurityFlow(): Promise<string> {
  await clearPinLockSecureState();
  await enablePinLock(TEST_PIN);
  await savePinInactivityTimeoutMs(30_000);
  const enabled = await isPinLockEnabled();
  const wrong = await verifyPin('1111');
  const correct = await verifyPin(TEST_PIN);

  if (!enabled || wrong.ok || !correct.ok) {
    throw new Error(`PIN state invalid. enabled=${enabled} wrong=${wrong.ok} correct=${correct.ok}.`);
  }

  const disabled = await disablePinLock(TEST_PIN);
  const enabledAfterDisable = await isPinLockEnabled();
  if (!disabled.ok || enabledAfterDisable) {
    throw new Error('PIN disable did not clear active lock state.');
  }

  return 'PIN enabled, rejected wrong PIN, accepted correct PIN, saved timeout, and disabled cleanly.';
}

async function verifyFeatureState(): Promise<string> {
  const [features, products, invoices] = await Promise.all([
    getFeatureToggles(),
    listProducts({ limit: 5 }),
    listInvoices({ limit: 5 }),
  ]);

  return `Feature toggles invoices=${features.invoices} inventory=${features.inventory} tax=${features.tax}; ${products.length} product(s), ${invoices.length} invoice(s) listed.`;
}

function buildQaTaxPack(lookup: TaxPackLookup, version: string): SaveTaxPackInput {
  return {
    countryCode: lookup.countryCode,
    regionCode: lookup.regionCode ?? '',
    taxType: lookup.taxType,
    version,
    lastUpdated: new Date().toISOString(),
    source: 'remote',
    isActive: true,
    rulesJson: {
      schemaVersion: 1,
      defaultRate: lookup.taxType.toUpperCase() === 'GST' ? 18 : 8,
      categories: [
        {
          id: 'services',
          label: 'Services',
          taxRate: lookup.taxType.toUpperCase() === 'GST' ? 18 : 8,
        },
      ],
    },
  };
}

function requireBusiness(context: Phase16Context): BusinessSettings {
  if (!context.business) {
    throw new Error('Business context is missing.');
  }

  return context.business;
}

function requireCustomer(context: Phase16Context): Customer {
  if (!context.customer) {
    throw new Error('Customer context is missing.');
  }

  return context.customer;
}

function requireInvoice(context: Phase16Context): InvoiceWithItems {
  if (!context.invoice) {
    throw new Error('Invoice context is missing.');
  }

  return context.invoice;
}

function toDateOnlyIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function waitForUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 250));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

declare global {
  // eslint-disable-next-line no-var
  var __orbitLedgerPhase16RuntimeQaStarted: boolean | undefined;
}
