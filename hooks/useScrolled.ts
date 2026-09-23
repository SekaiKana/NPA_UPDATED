'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * True once the page has scrolled past `threshold`.
 *
 * An external store rather than an effect writing state: scroll position lives
 * outside React, and subscribing to it directly means no render happens until
 * the boolean actually flips — not on every scroll event.
 */
export function useScrolled(threshold = 40): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    window.addEventListener('scroll', onChange, { passive: true });
    return () => window.removeEventListener('scroll', onChange);
  }, []);

  const getSnapshot = useCallback(
    () => (typeof window === 'undefined' ? false : window.scrollY > threshold),
    [threshold]
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
