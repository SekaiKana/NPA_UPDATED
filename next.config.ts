import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactCompiler: true,

  /**
   * Pinned because there is a stray lockfile further up the directory tree
   * (the user's home folder). Without this, Turbopack infers that as the
   * workspace root and warns on every build.
   */
  turbopack: { root: __dirname },

  /**
   * The routes were renamed to studio language (/services → /capabilities,
   * /case-studies → /work, /about → /studio). These are permanent redirects so
   * existing inbound links and any accumulated search ranking carry over to
   * the new URLs rather than dead-ending on a 404.
   */
  async redirects() {
    return [
      { source: '/services', destination: '/capabilities', permanent: true },
      { source: '/case-studies', destination: '/work', permanent: true },
      { source: '/about', destination: '/studio', permanent: true },
      // The old site linked this anchor from the nav on some builds.
      { source: '/about-us', destination: '/studio', permanent: true },
    ];
  },
};

export default nextConfig;
