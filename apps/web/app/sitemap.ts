import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_ORBIT_LEDGER_SITE_URL ?? 'https://orbitledger.rudraix.com';

export const dynamic = 'force-static';

const publicPages = [
  {
    changeFrequency: 'weekly',
    path: '',
    priority: 1,
  },
  {
    changeFrequency: 'monthly',
    path: '/template-preview',
    priority: 0.7,
  },
  {
    changeFrequency: 'monthly',
    path: '/privacy',
    priority: 0.8,
  },
  {
    changeFrequency: 'monthly',
    path: '/terms',
    priority: 0.8,
  },
  {
    changeFrequency: 'monthly',
    path: '/refunds',
    priority: 0.7,
  },
  {
    changeFrequency: 'monthly',
    path: '/contact',
    priority: 0.8,
  },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return publicPages.map((page) => ({
    changeFrequency: page.changeFrequency,
    lastModified,
    priority: page.priority,
    url: `${siteUrl}${page.path}`,
  }));
}
