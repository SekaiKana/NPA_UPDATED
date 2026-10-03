import type { Metadata } from 'next';
import { EB_Garamond, Nunito } from 'next/font/google';
import './globals.css';
import Providers from '@/components/Providers';
import Backdrop from '@/components/Backdrop';
import Navigation from '@/components/chrome/Navigation';
import Footer from '@/components/chrome/Footer';
import Cursor from '@/components/chrome/Cursor';
import Preloader from '@/components/intro/Preloader';

/* Display. EB Garamond is an oldstyle, not a Didone: low stroke contrast,
   small aperture, a true italic with its own skeleton. It has no `opsz` axis,
   so size is handled entirely through weight and tracking — large settings
   take 500 and a hair of negative tracking, small ones take 600 so the
   hairlines do not disappear. The italic is loaded because the accent
   treatment on display type depends on it. */
const garamond = EB_Garamond({
  variable: '--font-garamond',
  subsets: ['latin', 'latin-ext'],
  style: ['normal', 'italic'],
  display: 'swap',
});

/* Body, UI and labels. Nunito is a rounded terminal sans, softer than the
   rest of the system by nature, so body copy is set a touch tighter than its
   defaults. Its large x-height holds up at the small sizes the labels and
   meta rows use, where it is set in bold capitals and tracked wide; those
   were a monospace until the client asked for it to go (Sept 2026). */
const nunito = Nunito({
  variable: '--font-nunito',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://www.npanalytica.com'),
  title: 'Custom Software, AI and Data Engineering in Tokyo | Neural Point Analytica (NPA)',
  description:
    'A small software studio in Tokyo. We build web platforms, AI and RAG systems, data pipelines, analytics, internal tools and 3D sites, starting from what each problem actually needs.',
  keywords: [
    'custom software',
    'software development Tokyo',
    'AI development',
    'RAG',
    'data pipelines',
    'internal tools',
    'web platforms',
    'B2B',
  ],
  alternates: { canonical: '/' },
  icons: { icon: '/NPA-transparent.png', apple: '/NPA-transparent.png' },
  openGraph: {
    title: 'Neural Point Analytica',
    description:
      "A small team of engineers in Tokyo. Whatever the software problem, we'll work out what it needs and build it.",
    url: 'https://www.npanalytica.com',
    siteName: 'Neural Point Analytica',
    locale: 'en_US',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${garamond.variable} ${nunito.variable}`}
    >
      <body>
        <Providers>
          <Preloader />
          <Cursor />
          <Backdrop />
          <Navigation />
          <main className="page">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
