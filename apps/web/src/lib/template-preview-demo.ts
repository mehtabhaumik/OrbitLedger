import { buildCustomerHealthScore } from '@orbit-ledger/core';
import type { OrbitWorkspaceSummary } from '@orbit-ledger/contracts';

import type { WorkspaceCustomer, WorkspaceInvoiceDetail } from './workspace-data';
import {
  buildInvoiceWebDocument,
  getWebDocumentTemplate,
  getWebDocumentTemplates,
  type WebDocumentTemplate,
} from './web-documents';
import {
  getDefaultWebSubscriptionStatus,
  getWebProBrandTheme,
  getWebProSubscriptionStatus,
  type WebProBrandTheme,
} from './web-monetization';

export type TemplatePreviewBrandOptions = {
  proTheme?: WebProBrandTheme | null;
  watermarkText?: string | null;
  watermarkImageUrl?: string | null;
  useLogoWatermark?: boolean;
  watermarkOpacity?: number | null;
  includeLogo?: boolean;
  includeSignature?: boolean;
};

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

export const templatePreviewWorkspace: OrbitWorkspaceSummary = {
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
  createdAt: '2026-05-02T00:00:00.000Z',
  updatedAt: '2026-05-02T00:00:00.000Z',
  serverRevision: 1,
  dataState: 'profile_only',
};

export const templatePreviewCustomer: WorkspaceCustomer = {
  id: 'sample-preview-customer',
  name: 'Aarav Sample Stores',
  legalName: 'Aarav Sample Stores',
  customerType: 'business',
  contactPerson: 'Aarav Shah',
  phone: '+91 91111 11111',
  whatsapp: '+91 91111 11111',
  email: 'accounts@example.invalid',
  address: 'Sample Market Road, Navrangpura, Ahmedabad',
  billingAddress: 'Sample Market Road, Navrangpura, Ahmedabad',
  shippingAddress: 'Sample Market Road, Navrangpura, Ahmedabad',
  city: 'Ahmedabad',
  town: 'Navrangpura',
  stateCode: 'GJ',
  countryCode: 'IN',
  postalCode: '380009',
  gstin: '24SAMPLE1234F1Z5',
  pan: 'SAMPL1234F',
  taxNumber: null,
  registrationNumber: 'SAMPLE-REG-1024',
  placeOfSupply: 'Gujarat',
  defaultTaxTreatment: 'Taxable',
  notes: 'Sample customer for template preview only.',
  openingBalance: 0,
  creditLimit: 50000,
  paymentTerms: 'Net 7',
  preferredPaymentMode: 'UPI',
  preferredInvoiceTemplate: null,
  preferredLanguage: 'English',
  tags: ['sample', 'preview'],
  isArchived: false,
  createdAt: '2026-05-02T00:00:00.000Z',
  updatedAt: '2026-05-02T00:00:00.000Z',
  balance: 5375,
  health: buildCustomerHealthScore({ balance: 5375, totalCredit: 5375, totalPayment: 0 }),
};

export const templatePreviewInvoice: WorkspaceInvoiceDetail = {
  id: 'sample-preview-invoice',
  customerId: templatePreviewCustomer.id,
  customerName: templatePreviewCustomer.name,
  invoiceNumber: 'INV-SAMPLE-1024',
  issueDate: '2026-05-02',
  dueDate: '2026-05-09',
  subtotal: 4555,
  taxAmount: 819.9,
  totalAmount: 5374.9,
  paidAmount: 0,
  status: 'created',
  documentState: 'created',
  paymentStatus: 'unpaid',
  versionNumber: 1,
  latestVersionId: 'sample-preview-version',
  latestSnapshotHash: 'sample-preview-hash',
  isArchived: false,
  serverRevision: 1,
  notes: 'This is sample text for preview only. Replace it with real invoice notes in your workspace.',
  versions: [],
  items: [
    {
      id: 'sample-item-1',
      invoiceId: 'sample-preview-invoice',
      productId: null,
      name: 'Printer Maintenance',
      description: 'Preventive service and roller cleaning',
      quantity: 1,
      price: 1850,
      taxRate: 18,
      total: 2183,
    },
    {
      id: 'sample-item-2',
      invoiceId: 'sample-preview-invoice',
      productId: null,
      name: 'Thermal Paper Rolls',
      description: 'Box of sample billing paper rolls',
      quantity: 3,
      price: 625,
      taxRate: 18,
      total: 2212.5,
    },
    {
      id: 'sample-item-3',
      invoiceId: 'sample-preview-invoice',
      productId: null,
      name: 'On-site Setup',
      description: 'Sample installation support',
      quantity: 1,
      price: 830,
      taxRate: 18,
      total: 979.4,
    },
  ],
};

export function getTemplatePreviewTemplates() {
  return getWebDocumentTemplates(templatePreviewWorkspace, 'invoice');
}

export function getTemplatePreviewTemplate(templateKey: string | null | undefined): WebDocumentTemplate {
  return getWebDocumentTemplate(templatePreviewWorkspace, 'invoice', templateKey, true);
}

export function buildTemplatePreviewDocument(
  templateKey: string | null | undefined,
  options: TemplatePreviewBrandOptions = {}
) {
  const template = getTemplatePreviewTemplate(templateKey);
  const subscription = template.tier === 'pro' ? getWebProSubscriptionStatus() : getDefaultWebSubscriptionStatus();
  const workspace = {
    ...templatePreviewWorkspace,
    logoUri: options.includeLogo === false ? null : templatePreviewWorkspace.logoUri,
    signatureUri: options.includeSignature === false ? null : templatePreviewWorkspace.signatureUri,
  };
  return buildInvoiceWebDocument({
    workspace,
    customer: templatePreviewCustomer,
    invoice: templatePreviewInvoice,
    subscription,
    templateKey: template.key,
    proTheme: options.proTheme ?? getWebProBrandTheme(),
    brandWatermarkText: options.watermarkText ?? 'Demo',
    brandWatermarkImageUrl: options.watermarkImageUrl ?? (options.useLogoWatermark ? templatePreviewWorkspace.logoUri : null),
    brandWatermarkOpacity: options.watermarkOpacity ?? 0.08,
    urgentPaymentRequired: template.key.includes('PAYMENT'),
    paymentLink: {
      label: 'Sample payment link',
      instruction: 'Demo only. Real payment links are created from your invoice.',
      url: 'https://example.invalid/pay/INV-SAMPLE-1024',
      reference: 'INV-SAMPLE-1024',
      provider: 'payment_page',
    },
    manualPaymentInstructions: ['UPI: sample@bank', 'Bank: Orbit Demo Bank', 'Reference: INV-SAMPLE-1024'],
  });
}

export function protectTemplatePreviewHtml(html: string) {
  const guardStyle = `
    <style>
      .sample-preview-ribbon{position:fixed;z-index:9999;top:18px;left:50%;transform:translateX(-50%);background:#172033;color:#fff;border:1px solid rgba(255,255,255,.28);border-radius:999px;padding:10px 18px;font:800 12px/1.2 Inter,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;box-shadow:0 16px 36px rgba(15,23,42,.22)}
      .sample-preview-watermark{position:fixed;inset:0;z-index:9998;pointer-events:none;display:grid;place-items:center;color:rgba(47,99,183,.12);font:900 76px/1 Inter,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;transform:rotate(-18deg)}
      @media print{
        body>*{display:none!important}
        body::before{content:"Sample preview only. Printing is disabled.";display:grid!important;place-items:center;min-height:100vh;color:#172033;font:800 22px/1.4 Arial,sans-serif;text-align:center;padding:32px}
        @page{size:A4;margin:18mm}
      }
    </style>
    <script>
      (() => {
        const block = (event) => {
          if (event) event.preventDefault();
          document.body.dataset.printBlocked = "true";
          return false;
        };
        window.print = block;
        window.addEventListener("beforeprint", block);
        window.addEventListener("keydown", (event) => {
          const key = String(event.key || "").toLowerCase();
          if ((event.metaKey || event.ctrlKey) && key === "p") block(event);
        });
      })();
    </script>
  `;
  const ribbon = '<div class="sample-preview-ribbon">Sample preview - not printable</div><div class="sample-preview-watermark">Sample</div>';
  return html.replace('</head>', `${guardStyle}</head>`).replace(/<body([^>]*)>/, `<body$1>${ribbon}`);
}

function svgDataUri(svg: string) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg.trim())}`;
}
