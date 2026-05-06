import { Suspense } from 'react';

import { TemplatePreviewSearchClient } from './template-preview-client';

export default function TemplatePreviewPage() {
  return (
    <Suspense fallback={<main className="ol-template-preview-page">Loading template preview...</main>}>
      <TemplatePreviewSearchClient />
    </Suspense>
  );
}
