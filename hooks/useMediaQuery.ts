'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Subscribes to a media query.
 *
 * Uses useSyncExternalStore rather than an effect that calls setState: a media
 * query is precisely an external store, and this shape gives a correct server
 * snapshot for free instead of rendering once with a guess and correcting it.
 *
 * `matches` is false on the server and during the first client render, so a
 * query that gates an enhancement degrades to "off" rather than flashing.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined') return () => {};
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query]
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  }, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** Fine pointers only — the gate for hover-driven and cursor-driven effects. */
export function useFinePointer(): boolean {
  return useMediaQuery('(pointer: fine)');
}
