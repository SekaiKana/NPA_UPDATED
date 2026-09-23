import type { MetadataRoute } from 'next';

const SITE = 'https://www.npanalytica.com';

/**
 * Sitemap.
 *
 * /work is deliberately absent while it is a coming-soon placeholder: the
 * route still resolves so nothing 404s, but there is nothing there worth
 * indexing yet.
 *
 * Only the five real routes. The old /services, /case-studies and /about paths
 * are 308s (see next.config.ts) and deliberately absent — listing a redirect in
 * a sitemap asks a crawler to index a URL that does not serve content.
 *
 * `lastModified` is the build time, which for a statically exported site is the
 * honest answer: the content changed when the site was last deployed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    { url: SITE, lastModified, changeFrequency: 'monthly', priority: 1 },
    { url: `${SITE}/capabilities`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE}/studio`, lastModified, changeFrequency: 'yearly', priority: 0.6 },
    { url: `${SITE}/contact`, lastModified, changeFrequency: 'yearly', priority: 0.7 },
  ];
}
