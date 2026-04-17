import { renderStructuredDocument } from '../render';
import type { CustomerStatementData, CustomerStatementInput, StructuredDocument } from '../types';
import { buildCustomerStatementLayout } from './layout';
import { prepareCustomerStatementData } from './prepare';

export function buildCustomerStatementDocument(
  input: CustomerStatementInput
): StructuredDocument<CustomerStatementData> {
  const data = prepareCustomerStatementData(input);
  const layout = buildCustomerStatementLayout(data, input.documentOptions?.documentTemplate);

  return renderStructuredDocument(data, layout);
}
