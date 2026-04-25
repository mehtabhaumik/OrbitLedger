import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

import { WebAppProviders } from '@/providers/web-app-providers';

export const metadata: Metadata = {
  title: 'Orbit Ledger',
  description: 'Offline-aware business ledger workspace for invoices, receivables, and reports.',
  applicationName: 'Orbit Ledger',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icons/favicon-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/icons/favicon-16.png', type: 'image/png', sizes: '16x16' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: ['/favicon.ico'],
  },
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
