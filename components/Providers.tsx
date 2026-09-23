'use client';

import type { ReactNode } from 'react';
import { LangProvider } from './LangContext';
import SmoothScroll from './motion/SmoothScroll';
import PageTransition from './motion/PageTransition';

/**
 * Client-side providers, ordered by dependency.
 *
 * SmoothScroll sits above PageTransition because the transition needs to stop
 * and start the scroll instance; both sit above the page so a route change can
 * reset scroll before the new page paints.
 */
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <LangProvider>
      <SmoothScroll>
        <PageTransition>{children}</PageTransition>
      </SmoothScroll>
    </LangProvider>
  );
}
