import type { CustomerStatementData, DocumentLayout, DocumentTemplateConfig } from '../types';
import { applyDocumentTemplate } from '../templates';
import type { DocumentTemplate } from '../../database';

export function buildCustomerStatementLayout(
  data: CustomerStatementData,
  template?: DocumentTemplate | DocumentTemplateConfig | null
): DocumentLayout {
  const layout: DocumentLayout = {
    id: `${data.kind}_${data.source.customerId}_${data.metadata.statementDate}`,
    kind: 'customer_statement',
    title: `Statement - ${data.customerIdentity.name}`,
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
        title: 'Customer',
        data: data.customerIdentity,
      },
      {
        id: 'statement-metadata',
        type: 'section',
        role: 'statement_metadata',
        title: 'Statement Details',
        data: data.metadata,
      },
      {
        id: 'transaction-table',
        type: 'table',
        role: 'transaction_table',
        title: 'Ledger History',
        columns: [
          { key: 'date', label: 'Date', align: 'left' },
          { key: 'description', label: 'Description', align: 'left' },
          { key: 'credit', label: 'Credit', align: 'right' },
          { key: 'payment', label: 'Payment', align: 'right' },
          { key: 'runningBalance', label: 'Running Balance', align: 'right' },
        ],
        rows: data.transactions,
      },
      {
        id: 'summary',
        type: 'section',
        role: 'summary',
        title: 'Summary',
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
