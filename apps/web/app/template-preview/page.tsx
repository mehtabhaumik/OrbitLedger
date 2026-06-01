import type { Metadata } from 'next';
import { Suspense } from 'react';

import { TemplatePreviewSearchClient } from '../(workspace)/templates/preview/template-preview-client';

export const metadata: Metadata = {
  title: 'Invoice Template Preview',
  description:
    'Preview Orbit Ledger invoice templates with sample data only. Free and Pro layouts can be reviewed before sign-up.',
  alternates: {
    canonical: '/template-preview',
  },
  openGraph: {
    title: 'Orbit Ledger Invoice Template Preview',
    description:
      'Preview Orbit Ledger invoice templates with sample data only. Free and Pro layouts can be reviewed before sign-up.',
    url: '/template-preview',
    siteName: 'Orbit Ledger',
    images: [
      {
        url: '/icons/icon-512.png',
        width: 512,
        height: 512,
        alt: 'Orbit Ledger',
      },
    ],
    locale: 'en_IN',
    type: 'website',
  },
  robots: {
    follow: true,
    index: true,
  },
  twitter: {
    card: 'summary',
    title: 'Orbit Ledger Invoice Template Preview',
    description:
      'Preview Orbit Ledger invoice templates with sample data only. Free and Pro layouts can be reviewed before sign-up.',
    images: ['/icons/icon-512.png'],
  },
};

export default function PublicTemplatePreviewPage() {
  return (
    <Suspense fallback={<main className="ol-template-preview-page">Loading template preview...</main>}>
      <TemplatePreviewSearchClient backHref="/#templates" backLabel="Back to landing page" previewMode="public" />
    </Suspense>
  );
}
