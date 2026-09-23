import type { Metadata } from 'next';

/**
 * The page itself is a client component, so it cannot export metadata. This
 * segment layout carries it instead — it renders nothing of its own and exists
 * purely so /capabilities gets its own title, description and canonical rather than
 * inheriting the homepage's from the root layout.
 */
export const metadata: Metadata = {
  title: 'Capabilities | Neural Point Analytica',
  description:
    'What we build: custom B2B platforms, AI and RAG integrations, internal tooling, data infrastructure and production-ready MVPs.',
  alternates: { canonical: '/capabilities' },
  openGraph: {
    title: 'Capabilities | Neural Point Analytica',
    description:
      'What we build: custom B2B platforms, AI and RAG integrations, internal tooling, data infrastructure and production-ready MVPs.',
    url: '/capabilities',
    siteName: 'Neural Point Analytica',
    locale: 'en_US',
    type: 'website',
  },
};

export default function CapabilitiesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
