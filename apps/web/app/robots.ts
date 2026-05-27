import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_ORBIT_LEDGER_SITE_URL ?? 'https://orbitledger.rudraix.com';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      allow: ['/', '/template-preview'],
      disallow: [
        '/backup',
        '/backoffice',
        '/customers',
        '/dashboard',
        '/documents',
        '/invoices',
        '/market',
        '/office-operations',
        '/payments',
        '/platform-admin',
        '/products',
        '/reports',
        '/settings',
        '/support',
        '/team',
        '/transactions',
      ],
      userAgent: '*',
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
