import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import type { ReactNode } from 'react';
// Tokens first: globals.css is written against the semantic names this file
// defines, and any rule there is expected to be able to override a token
// deliberately during the reskin migration.
import './tokens.css';
import './globals.css';

import { WebAppProviders } from '@/providers/web-app-providers';

/**
 * Fonts are self-hosted through next/font rather than named in a CSS stack.
 *
 * The previous setup listed "Inter" in globals.css but never loaded it, so the
 * app silently rendered in whatever the OS supplied - San Francisco on macOS,
 * Segoe UI on Windows - and typography differed per visitor. next/font also
 * inlines the @font-face with size-adjust metrics, which removes the layout
 * shift a late webfont would otherwise cause.
 */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
});

// Display face for headings. Loaded now so the family is available to the
// reskin, but not preloaded: nothing renders in it yet, and preloading a font
// the first paint never uses just competes for bandwidth on the critical path.
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-grotesk',
  preload: false,
});

const siteUrl = process.env.NEXT_PUBLIC_ORBIT_LEDGER_SITE_URL ?? 'https://orbitledger.rudraix.com';
const landingDescription =
  'Orbit Ledger helps small businesses collect faster, track receivables, manage invoices and payments, follow up on customers, and close each day with confidence.';
const siteName = 'Orbit Ledger';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Orbit Ledger | Collect Faster And Close Each Day With Confidence',
    template: '%s | Orbit Ledger',
  },
  description: landingDescription,
  applicationName: siteName,
  authors: [{ name: 'Rudraix' }],
  creator: 'Rudraix',
  publisher: 'Rudraix',
  category: 'Business software',
  alternates: {
    canonical: '/',
    languages: {
      'en-IN': '/',
    },
  },
  keywords: [
    'Orbit Ledger',
    'daily money control',
    'small business ledger',
    'invoice software',
    'invoice templates',
    'receivables',
    'accounts receivable software',
    'payment reminders',
    'payment follow up',
    'GST invoice',
    'business dashboard',
    'customer ledger',
    'small business payments',
  ],
  openGraph: {
    title: 'Orbit Ledger | Collect Faster And Close Each Day With Confidence',
    description: landingDescription,
    url: '/',
    siteName,
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
    title: 'Orbit Ledger | Small Business Receivables Workspace',
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
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <head>
        {/*
          Stamp data-theme before first paint so a dark-mode user never flashes
          a white screen while React hydrates. Reads the same stored preference
          the device-settings provider owns; 'system' is left to the CSS media
          query. Kept tiny and dependency-free because it blocks the first paint.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('orbit-ledger:web-device-settings:v1');if(!s)return;var t=JSON.parse(s).theme;if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <WebAppProviders>{children}</WebAppProviders>
      </body>
    </html>
  );
}
