import type { Metadata } from 'next';
import { EB_Garamond, Nunito, IBM_Plex_Mono } from 'next/font/google';
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

/* Body and UI. Nunito is a rounded terminal sans — softer than the rest of the
   system by nature, so it is set a touch tighter than its defaults to keep it
   from reading as loose beside the mono labels. Its large x-height means it
   holds up at the small sizes the meta rows use. */
const nunito = Nunito({
  variable: '--font-nunito',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
});

/* Labels, data, annotations — the connective tissue of the whole layout. */
const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://www.npanalytica.com'),
  title: 'Custom B2B Software & AI Development Tokyo | Neural Point Analytica (NPA)',
  description:
    'Rapid, elite software engineering for modern companies. Based in Tokyo, Neural Point Analytica builds custom B2B platforms, AI integrations, and high-performance internal tools.',
  keywords: ['app development', 'B2B', 'custom software', 'AI development', 'RAG', 'Tokyo'],
  alternates: { canonical: '/' },
  icons: { icon: '/NPA-transparent.png', apple: '/NPA-transparent.png' },
  openGraph: {
    title: 'Neural Point Analytica',
    description:
      'We build your business into software. Custom B2B platforms, AI integrations and internal tooling, shipped fast.',
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
      className={`${garamond.variable} ${nunito.variable} ${plexMono.variable}`}
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
