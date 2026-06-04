import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_ORBIT_LEDGER_SITE_URL ?? 'https://orbitledger.rudraix.com';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      allow: ['/', '/template-preview', '/privacy', '/terms', '/refunds', '/contact'],
      disallow: [
        '/__',
        '/api',
        '/backup',
        '/backoffice',
        '/customers',
        '/dashboard',
        '/documents',
        '/invoices',
        '/login',
        '/market',
        '/office-operations',
        '/pay',
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
