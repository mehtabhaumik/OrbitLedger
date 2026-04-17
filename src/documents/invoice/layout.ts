import type { DocumentLayout, DocumentTemplateConfig, InvoiceDocumentData } from '../types';
import { applyDocumentTemplate } from '../templates';
import type { DocumentTemplate } from '../../database';

export function buildInvoiceDocumentLayout(
  data: InvoiceDocumentData,
  template?: DocumentTemplate | DocumentTemplateConfig | null
): DocumentLayout {
  const layout: DocumentLayout = {
    id: `${data.kind}_${data.source.invoiceId}_${data.metadata.invoiceNumber}`,
    kind: 'invoice',
    title: `Invoice - ${data.metadata.invoiceNumber}`,
    version: 1,
    page: {
      size: 'A4',
      orientation: 'portrait',
      margin: 'standard',
    },
    sections: [
      {
        id: 'business-identity',
        type: 'section',
        role: 'business_identity',
        data: data.businessIdentity,
      },
      {
        id: 'customer-identity',
        type: 'section',
        role: 'customer_identity',
        title: 'Bill To',
        data: data.customerIdentity,
      },
      {
        id: 'invoice-metadata',
        type: 'section',
        role: 'invoice_metadata',
        title: 'Invoice Details',
        data: data.metadata,
      },
      {
        id: 'invoice-items',
        type: 'table',
        role: 'invoice_item_table',
        title: 'Items',
        columns: [
          { key: 'name', label: 'Item', align: 'left' },
          { key: 'quantity', label: 'Qty', align: 'right' },
          { key: 'price', label: 'Price', align: 'right' },
          { key: 'taxRate', label: data.taxPlaceholder.taxColumnLabel ?? 'Tax', align: 'right' },
          { key: 'total', label: 'Total', align: 'right' },
        ],
        rows: data.items,
      },
      {
        id: 'summary',
        type: 'section',
        role: 'invoice_summary',
        title: 'Totals',
        data: data.summary,
      },
      {
        id: 'tax-placeholder',
        type: 'section',
        role: 'tax_placeholder',
        title: 'Tax Details',
        data: data.taxPlaceholder,
      },
      {
        id: 'footer',
        type: 'section',
        role: 'footer',
        data: data.footer,
      },
    ],
  };

  return applyDocumentTemplate(layout, template);
}
