import type { Metadata } from 'next';

/**
 * The page itself is a client component, so it cannot export metadata. This
 * segment layout carries it instead — it renders nothing of its own and exists
 * purely so /studio gets its own title, description and canonical rather than
 * inheriting the homepage's from the root layout.
 */
export const metadata: Metadata = {
  title: 'Studio | Neural Point Analytica',
  description:
    'The team, the principles and the commitments behind Neural Point Analytica, a software engineering studio in Tokyo.',
  alternates: { canonical: '/studio' },
  openGraph: {
    title: 'Studio | Neural Point Analytica',
    description:
      'The team, the principles and the commitments behind Neural Point Analytica, a software engineering studio in Tokyo.',
    url: '/studio',
    siteName: 'Neural Point Analytica',
    locale: 'en_US',
    type: 'website',
  },
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
