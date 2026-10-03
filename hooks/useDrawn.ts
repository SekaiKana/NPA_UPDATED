'use client';

import { useRef } from 'react';
import { whenUncovered } from '@/lib/motion/curtain';
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/**
 * Marks an element `data-draw="pending"` until it scrolls into view, then
 * `"done"`. The stylesheet does the drawing: a rule at scaleX(0) while
 * pending, transitioning to full width when done, so the page's hairlines
 * are ruled in as it is read, like a drawing being set out.
 *
 * Pending is only ever set from here, so with no JavaScript every rule is
 * simply there. It is set in a layout effect, before the first paint the
 * hydrated page gets, so a rule never shows and then vanishes to be drawn.
 */
export function useDrawn<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const reduced = usePrefersReducedMotion();

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced) {
      el.dataset.draw = 'done';
      return;
    }

    el.dataset.draw = 'pending';
    let cancel = () => {};
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        cancel = whenUncovered(() => {
          el.dataset.draw = 'done';
        });
      },
      { rootMargin: '0px 0px -8% 0px' }
    );
    io.observe(el);

    return () => {
      io.disconnect();
      cancel();
      el.dataset.draw = 'done';
    };
  }, [reduced]);

  return ref;
}
