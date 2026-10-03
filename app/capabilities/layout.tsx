import type { Metadata } from 'next';

/**
 * The page itself is a client component, so it cannot export metadata. This
 * segment layout carries it instead — it renders nothing of its own and exists
 * purely so /capabilities gets its own title, description and canonical rather than
 * inheriting the homepage's from the root layout.
 */
export const metadata: Metadata = {
  title: 'What we do | Neural Point Analytica',
  description:
    'The kinds of software we build: web platforms, AI and RAG systems, internal tools, data pipelines, analytics, prototypes and interactive 3D sites.',
  alternates: { canonical: '/capabilities' },
  openGraph: {
    title: 'What we do | Neural Point Analytica',
    description:
      'The kinds of software we build: web platforms, AI and RAG systems, internal tools, data pipelines, analytics, prototypes and interactive 3D sites.',
    url: '/capabilities',
    siteName: 'Neural Point Analytica',
    locale: 'en_US',
    type: 'website',
  },
};

export default function CapabilitiesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
