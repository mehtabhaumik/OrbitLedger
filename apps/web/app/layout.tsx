import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

import { WebAppProviders } from '@/providers/web-app-providers';

export const metadata: Metadata = {
  title: 'Orbit Ledger',
  description: 'Offline-aware business ledger workspace for invoices, receivables, and reports.',
  applicationName: 'Orbit Ledger',
};

export const viewport: Viewport = {
  themeColor: '#2f83f7',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <WebAppProviders>{children}</WebAppProviders>
      </body>
    </html>
  );
}
