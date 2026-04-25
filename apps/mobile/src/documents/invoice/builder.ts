import { renderStructuredDocument } from '../render';
import type { InvoiceDocumentData, InvoiceDocumentInput, StructuredDocument } from '../types';
import { buildInvoiceDocumentLayout } from './layout';
import { prepareInvoiceDocumentData } from './prepare';

export function buildInvoiceDocument(input: InvoiceDocumentInput): StructuredDocument<InvoiceDocumentData> {
  const data = prepareInvoiceDocumentData(input);
  const layout = buildInvoiceDocumentLayout(data, input.documentOptions?.documentTemplate);

  return renderStructuredDocument(data, layout);
}
