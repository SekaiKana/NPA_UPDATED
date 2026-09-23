'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * True while an inverted (ink-ground) section sits under the navigation bar.
 *
 * The bar is fixed and picks up a bone ground once the page scrolls, which
 * looks wrong the moment it passes over a dark band — a pale strip floating on
 * black. Rather than guessing from scroll position, this watches the actual
 * `.invert` sections and flips when one crosses the bar.
 *
 * The observer's root margin is a zero-height band at the bar's own height, so
 * "intersecting" means precisely "underneath the navigation".
 */
export function useInvertedNav(navHeight = 72): boolean {
  const [inverted, setInverted] = useState(false);
  // Re-scan on every route: which sections exist changes per page.
  const pathname = usePathname();

  useEffect(() => {
    const sections = document.querySelectorAll('.invert');

    if (sections.length === 0) {
      /* Deferred rather than a synchronous setState: this only runs when
         arriving on a page with no ink sections, and doing it in the effect
         body would cascade a second render for every visitor on every route. */
      queueMicrotask(() => setInverted(false));
      return;
    }

    const active = new Set<Element>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) active.add(entry.target);
          else active.delete(entry.target);
        }
        setInverted(active.size > 0);
      },
      {
        // Collapse the viewport to a sliver at the bar's vertical centre.
        rootMargin: `-${Math.round(navHeight / 2)}px 0px -${
          Math.max(0, window.innerHeight - Math.round(navHeight / 2) - 1)
        }px 0px`,
        threshold: 0,
      }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [navHeight, pathname]);

  return inverted;
}
