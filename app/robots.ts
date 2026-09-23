import type { MetadataRoute } from 'next';

const SITE = 'https://www.npanalytica.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // The contact handler is POST-only and has nothing to index.
      disallow: ['/api/'],
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
