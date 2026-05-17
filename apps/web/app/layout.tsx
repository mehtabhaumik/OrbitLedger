import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

import { WebAppProviders } from '@/providers/web-app-providers';

const siteUrl = process.env.NEXT_PUBLIC_ORBIT_LEDGER_SITE_URL ?? 'https://orbit-ledger-f41c2.web.app';
const landingDescription =
  'Orbit Ledger helps small businesses track receivables, invoices, payments, reminders, and daily review from one calm web workspace.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Orbit Ledger | Collect Faster And Close Each Day With Confidence',
    template: '%s | Orbit Ledger',
  },
  description: landingDescription,
  applicationName: 'Orbit Ledger',
  authors: [{ name: 'Rudraix' }],
  creator: 'Rudraix',
  publisher: 'Rudraix',
  alternates: {
    canonical: '/',
  },
  keywords: [
    'Orbit Ledger',
    'small business ledger',
    'invoice software',
    'receivables',
    'payment reminders',
    'GST invoice',
    'business dashboard',
    'customer ledger',
  ],
  openGraph: {
    title: 'Orbit Ledger',
    description: landingDescription,
    url: '/',
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
    googleBot: {
      follow: true,
      index: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
    index: true,
  },
  twitter: {
    card: 'summary',
    title: 'Orbit Ledger',
    description: landingDescription,
    images: ['/icons/icon-512.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icons/favicon-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/icons/favicon-16.png', type: 'image/png', sizes: '16x16' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: ['/favicon.ico'],
  },
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Orbit Ledger',
  },
  formatDetection: {
    address: false,
    email: false,
    telephone: false,
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
