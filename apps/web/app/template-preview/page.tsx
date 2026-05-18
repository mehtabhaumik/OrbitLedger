import type { Metadata } from 'next';
import { Suspense } from 'react';

import { TemplatePreviewSearchClient } from '../(workspace)/templates/preview/template-preview-client';

export const metadata: Metadata = {
  title: 'Invoice Template Preview | Orbit Ledger',
  description:
    'Preview Orbit Ledger invoice templates with sample data only. Free and Pro layouts can be reviewed before sign-up.',
  robots: {
    follow: true,
    index: true,
  },
};

export default function PublicTemplatePreviewPage() {
  return (
    <Suspense fallback={<main className="ol-template-preview-page">Loading template preview...</main>}>
      <TemplatePreviewSearchClient backHref="/#templates" backLabel="Back to landing page" previewMode="public" />
    </Suspense>
  );
}
