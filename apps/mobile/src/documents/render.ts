import type { DocumentData, DocumentLayout, StructuredDocument } from './types';

export function renderStructuredDocument<TData extends DocumentData>(
  data: TData,
  layout: DocumentLayout
): StructuredDocument<TData> {
  return {
    id: layout.id,
    kind: layout.kind,
    renderTarget: 'structured',
    title: layout.title,
    version: layout.version,
    data,
    layout,
  };
}
