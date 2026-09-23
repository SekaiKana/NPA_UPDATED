import type { Metadata } from 'next';

/**
 * The page itself is a client component, so it cannot export metadata. This
 * segment layout carries it instead — it renders nothing of its own and exists
 * purely so /work gets its own title, description and canonical rather than
 * inheriting the homepage's from the root layout.
 */
export const metadata: Metadata = {
  title: 'Work — in preparation | Neural Point Analytica',
  description:
    'Case studies from Neural Point Analytica are being written up. Ask us directly about what we have built.',
  alternates: { canonical: '/work' },
  /* Resolves rather than 404s, but there is nothing here to index yet. */
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Work — in preparation | Neural Point Analytica',
    description:
      'Case studies from Neural Point Analytica are being written up. Ask us directly about what we have built.',
    url: '/work',
    siteName: 'Neural Point Analytica',
    locale: 'en_US',
    type: 'website',
  },
};

export default function WorkLayout({ children }: { children: React.ReactNode }) {
  return children;
}
