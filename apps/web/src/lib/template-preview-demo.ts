import type { WorkspaceCustomer, WorkspaceInvoiceDetail } from './workspace-data';
import {
  buildTemplateDemoData,
  buildTemplateDemoDataForTemplates,
  templateDemoFallbackWorkspace,
  type TemplateDemoData,
  type TemplateDemoDataInput,
} from './template-demo-data-factory';
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
  demoData?: TemplateDemoData | null;
  demoDataInput?: TemplateDemoDataInput | null;
  proTheme?: WebProBrandTheme | null;
  watermarkText?: string | null;
  watermarkImageUrl?: string | null;
  useLogoWatermark?: boolean;
  watermarkOpacity?: number | null;
  includeLogo?: boolean;
  includeSignature?: boolean;
};

const defaultTemplatePreviewData = buildTemplateDemoData({ mode: 'public' });

export const templatePreviewWorkspace = templateDemoFallbackWorkspace;
export const templatePreviewCustomer: WorkspaceCustomer = defaultTemplatePreviewData.customer;
export const templatePreviewInvoice: WorkspaceInvoiceDetail = defaultTemplatePreviewData.invoice;

export function getTemplatePreviewTemplates() {
  return getWebDocumentTemplates(templatePreviewWorkspace, 'invoice');
}

export function getTemplatePreviewTemplate(templateKey: string | null | undefined): WebDocumentTemplate {
  return getWebDocumentTemplate(templatePreviewWorkspace, 'invoice', templateKey, true);
}

export function buildSharedTemplateDemoData(input: TemplateDemoDataInput = {}) {
  return buildTemplateDemoData(input);
}

export function buildSharedTemplateDemoDataForTemplates(
  templateKeys: Array<string | null | undefined>,
  input: Omit<TemplateDemoDataInput, 'templateKey'> = {}
) {
  return buildTemplateDemoDataForTemplates(templateKeys, input);
}

export function buildPublicTemplateDemoData(templateKey?: string | null) {
  return buildTemplateDemoData({ mode: 'public', templateKey });
}

export function buildWorkspaceTemplateDemoData(input: Omit<TemplateDemoDataInput, 'mode'> = {}) {
  return buildTemplateDemoData({ ...input, mode: 'authenticated' });
}

export function buildOfficeTemplateDemoData(input: Omit<TemplateDemoDataInput, 'mode'> = {}) {
  return buildTemplateDemoData({ ...input, mode: 'office' });
}

export function buildTemplatePreviewDocument(
  templateKey: string | null | undefined,
  options: TemplatePreviewBrandOptions = {}
) {
  const template = getTemplatePreviewTemplate(templateKey);
  const demoData =
    options.demoData ??
    buildTemplateDemoData({
      ...(options.demoDataInput ?? {}),
      mode: options.demoDataInput?.mode ?? 'public',
      templateKey: template.key,
    });
  const subscription = template.tier === 'pro' ? getWebProSubscriptionStatus() : getDefaultWebSubscriptionStatus();
  const workspace = {
    ...demoData.workspace,
    logoUri: options.includeLogo === false ? null : demoData.workspace.logoUri,
    signatureUri: options.includeSignature === false ? null : demoData.workspace.signatureUri,
  };
  return buildInvoiceWebDocument({
    workspace,
    customer: demoData.customer,
    invoice: demoData.invoice,
    subscription,
    templateKey: template.key,
    proTheme: options.proTheme ?? getWebProBrandTheme(),
    brandWatermarkText: options.watermarkText ?? 'Demo',
    brandWatermarkImageUrl: options.watermarkImageUrl ?? (options.useLogoWatermark ? demoData.workspace.logoUri : null),
    brandWatermarkOpacity: options.watermarkOpacity ?? 0.08,
    urgentPaymentRequired: template.key.includes('PAYMENT'),
    paymentLink: {
      label: 'Sample payment link',
      instruction: 'Demo only. Real payment links are created from your invoice.',
      url: `https://example.invalid/pay/${encodeURIComponent(demoData.invoice.invoiceNumber)}`,
      reference: demoData.invoice.invoiceNumber,
      provider: 'payment_page',
    },
    manualPaymentInstructions: ['UPI: sample@bank', 'Bank: Orbit Demo Bank', `Reference: ${demoData.invoice.invoiceNumber}`],
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
