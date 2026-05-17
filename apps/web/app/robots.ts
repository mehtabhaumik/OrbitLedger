import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_ORBIT_LEDGER_SITE_URL ?? 'https://orbit-ledger-f41c2.web.app';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      allow: ['/', '/template-preview'],
      disallow: [
        '/backup',
        '/customers',
        '/dashboard',
        '/documents',
        '/invoices',
        '/market',
        '/office-operations',
        '/payments',
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
