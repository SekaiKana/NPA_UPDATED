import type { Metadata } from 'next';

/**
 * The page itself is a client component, so it cannot export metadata. This
 * segment layout carries it instead — it renders nothing of its own and exists
 * purely so /contact gets its own title, description and canonical rather than
 * inheriting the homepage's from the root layout.
 */
export const metadata: Metadata = {
  title: 'Contact | Neural Point Analytica',
  description:
    'Tell us what you are working on. We reply within one business day.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'Contact | Neural Point Analytica',
    description:
      'Tell us what you are working on. We reply within one business day.',
    url: '/contact',
    siteName: 'Neural Point Analytica',
    locale: 'en_US',
    type: 'website',
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
