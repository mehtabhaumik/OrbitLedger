import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_ORBIT_LEDGER_SITE_URL ?? 'https://orbit-ledger-f41c2.web.app';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      changeFrequency: 'weekly',
      lastModified,
      priority: 1,
      url: siteUrl,
    },
    {
      changeFrequency: 'monthly',
      lastModified,
      priority: 0.7,
      url: `${siteUrl}/template-preview`,
    },
    {
      changeFrequency: 'monthly',
      lastModified,
      priority: 0.6,
      url: `${siteUrl}/login`,
    },
  ];
}
