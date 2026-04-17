import type {
  BusinessSettings,
  ComplianceReportType,
  Customer,
  InvoiceItem,
  InvoiceWithItems,
  LedgerTransaction,
  TransactionType,
} from '../database';
import type { ComplianceDateRange, ComplianceReportMetadata } from '../compliance/types';
import type { ComplianceRuleContext } from '../compliance/types';
import type { TaxCalculationInput } from '../tax';

export type { ComplianceDateRange } from '../compliance/types';

export type TaxEngineTransactionInput = {
  source: 'transaction';
  transactionId: string;
  customerId: string;
  transactionType: TransactionType;
  effectiveDate: string;
  taxableAmount: number;
  paymentAmount: number;
  note: string | null;
};

export type TaxEngineInvoiceItemInput = TaxCalculationInput & {
  source: 'invoice_item';
  invoiceId: string;
  invoiceItemId: string;
  productId: string | null;
  itemName: string;
};

export type DocumentTemplateDataContext = {
  templateType: 'invoice' | 'statement';
  countryCode: string;
  regionCode: string;
  currency: string;
  sourceKind: 'invoice' | 'statement';
  sourceId: string;
  customerId: string | null;
  taxMode: BusinessSettings['taxMode'];
  taxProfileVersion: string | null;
  metadata: Record<string, unknown>;
};

export type ComplianceMetadataInput = {
  businessSettings: BusinessSettings;
  reportType: ComplianceReportType;
  generatedAt: string;
  dateRange?: ComplianceDateRange;
  complianceContext?: ComplianceRuleContext;
};

export type ComplianceInvoiceTotalsInput = {
  invoice_count: number | null;
  subtotal: number | null;
  tax_amount: number | null;
  total_amount: number | null;
};

export type ComplianceTaxRateInput = {
  tax_rate: number;
  item_count: number | null;
  taxable_amount: number | null;
  tax_amount: number | null;
  total_amount: number | null;
};

export type ComplianceSalesStatusInput = {
  status: string;
  invoice_count: number | null;
  subtotal: number | null;
  tax_amount: number | null;
  total_amount: number | null;
};

export type ComplianceDuesTotalsInput = {
  active_customers: number | null;
  archived_customers: number | null;
  customers_with_dues: number | null;
  customers_with_advance: number | null;
  total_receivable: number | null;
  total_advance: number | null;
  net_balance: number | null;
};

export type ComplianceOutstandingCustomerInput = {
  customer_id: string;
  name: string;
  phone: string | null;
  balance: number | null;
  latest_activity_at: string | null;
};

export type InvoiceTemplateContextInput = {
  businessSettings: BusinessSettings;
  invoice: InvoiceWithItems;
  customer?: Customer | null;
};

export type StatementTemplateContextInput = {
  businessSettings: BusinessSettings;
  customer: Customer;
  transactions: LedgerTransaction[];
};

export type InvoiceItemTaxInputSource = Pick<
  InvoiceItem,
  'id' | 'invoiceId' | 'productId' | 'name' | 'description' | 'quantity' | 'price' | 'taxRate'
>;

export type ComplianceMetadata = ComplianceReportMetadata;
