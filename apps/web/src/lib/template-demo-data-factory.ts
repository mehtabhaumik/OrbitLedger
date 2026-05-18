import { buildCustomerHealthScore } from '@orbit-ledger/core';
import type { OrbitWorkspaceSummary } from '@orbit-ledger/contracts';

import type { WorkspaceCustomer, WorkspaceInvoiceDetail, WorkspaceProduct } from './workspace-data';

export type TemplateDemoMode = 'public' | 'authenticated' | 'office';

export type TemplateDemoDataSource = 'public_sample' | 'workspace_sample' | 'office_workspace_sample';

export type TemplateDemoDataInput = {
  mode?: TemplateDemoMode;
  templateKey?: string | null;
  workspace?: OrbitWorkspaceSummary | null;
  officeWorkspace?: OrbitWorkspaceSummary | null;
  customers?: WorkspaceCustomer[] | null;
  products?: WorkspaceProduct[] | null;
};

export type TemplateDemoData = {
  mode: TemplateDemoMode;
  source: TemplateDemoDataSource;
  templateKey: string | null;
  workspace: OrbitWorkspaceSummary;
  customer: WorkspaceCustomer;
  invoice: WorkspaceInvoiceDetail;
  customerSource: 'sample' | 'workspace';
  itemSource: 'sample' | 'inventory';
  isPublicSafe: boolean;
};

const demoIssuedAt = '2026-05-02T00:00:00.000Z';

const sampleLogoUri = svgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
    <rect width="160" height="160" rx="34" fill="#145C52"/>
    <path d="M43 82c12-30 55-38 76-12" fill="none" stroke="#E5F1ED" stroke-width="12" stroke-linecap="round"/>
    <path d="M44 91c19 30 64 27 78-4" fill="none" stroke="#9ED8C6" stroke-width="12" stroke-linecap="round"/>
    <circle cx="80" cy="80" r="18" fill="#FFFFFF"/>
    <text x="80" y="132" text-anchor="middle" font-family="Arial" font-size="18" font-weight="800" fill="#FFFFFF">DEMO</text>
  </svg>
`);

const sampleSignatureUri = svgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" width="360" height="120" viewBox="0 0 360 120">
    <rect width="360" height="120" fill="white"/>
    <path d="M24 78c38-42 52-42 44-6-5 24 47-31 42-4-4 21 50-24 58-5 7 15 41-10 58-7 18 4 30 4 74-20" fill="none" stroke="#145C52" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
`);

export const templateDemoFallbackWorkspace: OrbitWorkspaceSummary = {
  workspaceId: 'sample-preview-workspace',
  businessName: 'Orbit Demo Services Pvt Ltd',
  ownerName: 'Sample Owner',
  phone: '+91 90000 00000',
  email: 'billing@example.invalid',
  address: 'Demo Business Park, Ellisbridge, Ahmedabad',
  currency: 'INR',
  countryCode: 'IN',
  stateCode: 'GJ',
  logoUri: sampleLogoUri,
  authorizedPersonName: 'Sample Owner',
  authorizedPersonTitle: 'Director',
  signatureUri: sampleSignatureUri,
  paymentInstructions: {},
  createdAt: demoIssuedAt,
  updatedAt: demoIssuedAt,
  serverRevision: 1,
  dataState: 'profile_only',
};

type DemoCustomerSeed = {
  id: string;
  name: string;
  legalName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  town: string;
  postalCode: string;
  gstin: string;
  pan: string;
  registrationNumber: string;
  tags: string[];
};

type DemoLineSeed = {
  name: string;
  description: string;
  quantity: number;
  price: number;
  taxRate: number;
};

const sampleCustomers: DemoCustomerSeed[] = [
  {
    id: 'sample-aarav-stores',
    name: 'Aarav Sample Stores',
    legalName: 'Aarav Sample Stores',
    contactPerson: 'Aarav Shah',
    phone: '+91 91111 11111',
    email: 'accounts@example.invalid',
    address: 'Sample Market Road, Navrangpura, Ahmedabad',
    city: 'Ahmedabad',
    town: 'Navrangpura',
    postalCode: '380009',
    gstin: '24SAMPLE1234F1Z5',
    pan: 'SAMPL1234F',
    registrationNumber: 'SAMPLE-REG-1024',
    tags: ['sample', 'retail'],
  },
  {
    id: 'sample-northline-repair',
    name: 'Northline Repair Co.',
    legalName: 'Northline Repair Company',
    contactPerson: 'Neha Patel',
    phone: '+91 92222 22222',
    email: 'billing-northline@example.invalid',
    address: 'Service Lane, Vastrapur, Ahmedabad',
    city: 'Ahmedabad',
    town: 'Vastrapur',
    postalCode: '380015',
    gstin: '24SAMPLE5678F1Z2',
    pan: 'SERVC5678F',
    registrationNumber: 'SAMPLE-REG-2048',
    tags: ['sample', 'service'],
  },
  {
    id: 'sample-bluepeak-trading',
    name: 'BluePeak Trading',
    legalName: 'BluePeak Trading LLP',
    contactPerson: 'Rohan Mehta',
    phone: '+91 93333 33333',
    email: 'finance-bluepeak@example.invalid',
    address: 'Warehouse Road, Sanand, Ahmedabad',
    city: 'Ahmedabad',
    town: 'Sanand',
    postalCode: '382110',
    gstin: '24SAMPLE9012F1Z7',
    pan: 'TRADE9012F',
    registrationNumber: 'SAMPLE-REG-4096',
    tags: ['sample', 'wholesale'],
  },
  {
    id: 'sample-promptpay-studio',
    name: 'PromptPay Studio',
    legalName: 'PromptPay Studio Pvt Ltd',
    contactPerson: 'Isha Desai',
    phone: '+91 94444 44444',
    email: 'payables-promptpay@example.invalid',
    address: 'Design District, Prahlad Nagar, Ahmedabad',
    city: 'Ahmedabad',
    town: 'Prahlad Nagar',
    postalCode: '380015',
    gstin: '24SAMPLE3456F1Z9',
    pan: 'DESGN3456F',
    registrationNumber: 'SAMPLE-REG-8192',
    tags: ['sample', 'creative'],
  },
];

const sampleLineSets: Record<string, DemoLineSeed[]> = {
  gst: [
    line('Thermal Receipt Printer', 'HSN/SAC-ready product sale', 1, 12850, 18),
    line('Barcode Scanner', 'Retail checkout accessory', 2, 2450, 18),
    line('Installation Support', 'On-site setup and testing', 1, 1500, 18),
  ],
  basic: [
    line('Monthly Ledger Review', 'Basic receivables cleanup', 1, 2600, 18),
    line('Statement Preparation', 'Customer statement pack', 1, 900, 18),
  ],
  service: [
    line('Printer Maintenance', 'Preventive service and roller cleaning', 1, 1850, 18),
    line('Thermal Paper Rolls', 'Box of billing paper rolls', 3, 625, 18),
    line('On-site Setup', 'Installation support', 1, 830, 18),
  ],
  letterhead: [
    line('Business Process Review', 'Monthly operations and billing review', 1, 7200, 18),
    line('Compliance Documentation', 'Tax-ready document preparation', 1, 2800, 18),
  ],
  retail: [
    line('Counter Display Unit', 'Retail counter hardware', 2, 3950, 18),
    line('Inventory Labels', 'Product label rolls', 6, 340, 18),
    line('Stock Setup Service', 'Opening stock configuration', 1, 1750, 18),
  ],
  payment: [
    line('Recurring Service Package', 'Monthly support retainer', 1, 9500, 18),
    line('Priority Follow-up Setup', 'Payment reminder and collection setup', 1, 1800, 18),
  ],
  branded: [
    line('Premium Branding Package', 'Custom invoice identity and setup', 1, 12500, 18),
    line('Document Automation Review', 'Invoice, statement, and reminder review', 1, 4200, 18),
    line('Training Session', 'Team handoff and workflow training', 1, 2600, 18),
  ],
};

export function buildTemplateDemoData(input: TemplateDemoDataInput = {}): TemplateDemoData {
  const mode = input.mode ?? 'public';
  const templateKey = input.templateKey ?? null;
  const workspace = resolveDemoWorkspace(mode, input.workspace, input.officeWorkspace);
  const customer = resolveDemoCustomer(mode, templateKey, input.customers);
  const lines = resolveDemoLines(mode, templateKey, input.products);
  const invoice = buildDemoInvoice(templateKey, customer, lines);

  return {
    mode,
    source: mode === 'office' ? 'office_workspace_sample' : mode === 'authenticated' ? 'workspace_sample' : 'public_sample',
    templateKey,
    workspace,
    customer,
    invoice,
    customerSource: mode !== 'public' && getUsableCustomers(input.customers).length > 0 ? 'workspace' : 'sample',
    itemSource: mode !== 'public' && getUsableProducts(input.products).length > 0 ? 'inventory' : 'sample',
    isPublicSafe: mode === 'public',
  };
}

export function buildTemplateDemoDataForTemplates(
  templateKeys: Array<string | null | undefined>,
  input: Omit<TemplateDemoDataInput, 'templateKey'> = {}
) {
  return templateKeys.map((templateKey) => buildTemplateDemoData({ ...input, templateKey }));
}

function resolveDemoWorkspace(
  mode: TemplateDemoMode,
  workspace: OrbitWorkspaceSummary | null | undefined,
  officeWorkspace: OrbitWorkspaceSummary | null | undefined
): OrbitWorkspaceSummary {
  if (mode === 'office' && officeWorkspace) {
    return withPreviewBrandFallbacks(officeWorkspace);
  }
  if (mode === 'authenticated' && workspace) {
    return withPreviewBrandFallbacks(workspace);
  }
  return templateDemoFallbackWorkspace;
}

function withPreviewBrandFallbacks(workspace: OrbitWorkspaceSummary): OrbitWorkspaceSummary {
  return {
    ...templateDemoFallbackWorkspace,
    ...workspace,
    workspaceId: workspace.workspaceId || templateDemoFallbackWorkspace.workspaceId,
    businessName: workspace.businessName || templateDemoFallbackWorkspace.businessName,
    ownerName: workspace.ownerName || templateDemoFallbackWorkspace.ownerName,
    phone: workspace.phone || templateDemoFallbackWorkspace.phone,
    email: workspace.email || templateDemoFallbackWorkspace.email,
    address: workspace.address || templateDemoFallbackWorkspace.address,
    currency: workspace.currency || templateDemoFallbackWorkspace.currency,
    countryCode: workspace.countryCode || templateDemoFallbackWorkspace.countryCode,
    stateCode: workspace.stateCode || templateDemoFallbackWorkspace.stateCode,
    logoUri: workspace.logoUri || templateDemoFallbackWorkspace.logoUri,
    signatureUri: workspace.signatureUri || templateDemoFallbackWorkspace.signatureUri,
  };
}

function resolveDemoCustomer(
  mode: TemplateDemoMode,
  templateKey: string | null,
  customers: WorkspaceCustomer[] | null | undefined
): WorkspaceCustomer {
  const usableCustomers = mode === 'public' ? [] : getUsableCustomers(customers);
  if (usableCustomers.length > 0) {
    return usableCustomers[templateIndex(templateKey, usableCustomers.length)] ?? usableCustomers[0];
  }
  return customerFromSeed(sampleCustomers[templateIndex(templateKey, sampleCustomers.length)] ?? sampleCustomers[0]);
}

function resolveDemoLines(
  mode: TemplateDemoMode,
  templateKey: string | null,
  products: WorkspaceProduct[] | null | undefined
): DemoLineSeed[] {
  const usableProducts = mode === 'public' ? [] : getUsableProducts(products);
  if (usableProducts.length > 0) {
    return usableProducts.slice(0, 4).map((product, index) =>
      line(
        product.name,
        `${product.unit || 'Unit'} sample from saved inventory`,
        index === 0 ? 1 : 2,
        Math.max(1, Number(product.price) || 1),
        18
      )
    );
  }
  const setKey = lineSetKey(templateKey);
  return sampleLineSets[setKey] ?? sampleLineSets.service;
}

function buildDemoInvoice(
  templateKey: string | null,
  customer: WorkspaceCustomer,
  lines: DemoLineSeed[]
): WorkspaceInvoiceDetail {
  const invoiceId = `sample-preview-invoice-${lineSetKey(templateKey)}`;
  const invoiceNumber = invoiceNumberForTemplate(templateKey);
  const items = lines.map((item, index) => {
    const taxable = roundMoney(item.quantity * item.price);
    const taxAmount = roundMoney((taxable * item.taxRate) / 100);
    return {
      id: `${invoiceId}-item-${index + 1}`,
      invoiceId,
      productId: null,
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      price: item.price,
      taxRate: item.taxRate,
      total: roundMoney(taxable + taxAmount),
    };
  });
  const subtotal = roundMoney(lines.reduce((sum, item) => sum + item.quantity * item.price, 0));
  const taxAmount = roundMoney(lines.reduce((sum, item) => sum + (item.quantity * item.price * item.taxRate) / 100, 0));
  const totalAmount = roundMoney(subtotal + taxAmount);

  return {
    id: invoiceId,
    customerId: customer.id,
    customerName: customer.name,
    invoiceNumber,
    issueDate: '2026-05-02',
    dueDate: '2026-05-09',
    billingMonth: '2026-05',
    subtotal,
    taxAmount,
    totalAmount,
    paidAmount: isPaidTemplate(templateKey) ? totalAmount : 0,
    status: 'created',
    documentState: 'created',
    paymentStatus: isPaidTemplate(templateKey) ? 'paid' : 'unpaid',
    paymentStatusReason: isPaidTemplate(templateKey) ? 'Paid in full' : 'Sample amount due',
    versionNumber: 1,
    latestVersionId: `${invoiceId}-version-1`,
    latestSnapshotHash: `${invoiceId}-hash`,
    isArchived: false,
    serverRevision: 1,
    notes: notesForTemplate(templateKey),
    versions: [],
    items,
  };
}

function getUsableCustomers(customers: WorkspaceCustomer[] | null | undefined) {
  return (customers ?? []).filter((customer) => customer && !customer.isArchived && customer.name.trim().length > 0);
}

function getUsableProducts(products: WorkspaceProduct[] | null | undefined) {
  return (products ?? []).filter((product) => product && product.name.trim().length > 0 && Number(product.price) > 0);
}

function customerFromSeed(seed: DemoCustomerSeed): WorkspaceCustomer {
  return {
    id: seed.id,
    name: seed.name,
    legalName: seed.legalName,
    customerType: 'business',
    contactPerson: seed.contactPerson,
    phone: seed.phone,
    whatsapp: seed.phone,
    email: seed.email,
    address: seed.address,
    billingAddress: seed.address,
    shippingAddress: seed.address,
    city: seed.city,
    town: seed.town,
    stateCode: 'GJ',
    countryCode: 'IN',
    postalCode: seed.postalCode,
    gstin: seed.gstin,
    pan: seed.pan,
    taxNumber: null,
    registrationNumber: seed.registrationNumber,
    placeOfSupply: 'Gujarat',
    defaultTaxTreatment: 'Taxable',
    notes: 'Sample customer for template preview only.',
    openingBalance: 0,
    creditLimit: 50000,
    paymentTerms: 'Net 7',
    preferredPaymentMode: 'UPI',
    preferredInvoiceTemplate: null,
    preferredLanguage: 'English',
    tags: seed.tags,
    isArchived: false,
    createdAt: demoIssuedAt,
    updatedAt: demoIssuedAt,
    balance: 5375,
    health: buildCustomerHealthScore({ balance: 5375, totalCredit: 5375, totalPayment: 0 }),
  };
}

function line(name: string, description: string, quantity: number, price: number, taxRate: number): DemoLineSeed {
  return { name, description, quantity, price, taxRate };
}

function lineSetKey(templateKey: string | null | undefined) {
  const key = String(templateKey ?? '').toUpperCase();
  if (key.includes('GST_STANDARD')) return 'gst';
  if (key.includes('CLEAN_BASIC')) return 'basic';
  if (key.includes('SERVICE')) return 'service';
  if (key.includes('LETTERHEAD') || key.includes('MODERN_BUSINESS')) return 'letterhead';
  if (key.includes('RETAIL')) return 'retail';
  if (key.includes('PAYMENT')) return 'payment';
  if (key.includes('BRANDED')) return 'branded';
  if (key.includes('COMPACT')) return 'retail';
  return 'service';
}

function templateIndex(templateKey: string | null | undefined, length: number) {
  if (length <= 1) return 0;
  const key = String(templateKey ?? 'default');
  let sum = 0;
  for (let index = 0; index < key.length; index += 1) {
    sum += key.charCodeAt(index);
  }
  return sum % length;
}

function invoiceNumberForTemplate(templateKey: string | null | undefined) {
  const key = lineSetKey(templateKey);
  const prefix: Record<string, string> = {
    gst: 'GST-SAMPLE-1041',
    basic: 'BASIC-SAMPLE-1024',
    service: 'SVC-SAMPLE-7782',
    letterhead: 'PRO-SAMPLE-2290',
    retail: 'RTL-SAMPLE-3188',
    payment: 'PAY-SAMPLE-3108',
    branded: 'BRAND-SAMPLE-6401',
  };
  return prefix[key] ?? 'INV-SAMPLE-1024';
}

function notesForTemplate(templateKey: string | null | undefined) {
  if (lineSetKey(templateKey) === 'payment') {
    return 'Sample payment-focused preview. Real payment links and instructions are created from saved invoices.';
  }
  return 'Sample preview only. Replace this with real invoice notes in your workspace.';
}

function isPaidTemplate(templateKey: string | null | undefined) {
  const key = String(templateKey ?? '').toUpperCase();
  return key.includes('LETTERHEAD') || key.includes('BRANDED');
}

function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function svgDataUri(svg: string) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg.trim())}`;
}
