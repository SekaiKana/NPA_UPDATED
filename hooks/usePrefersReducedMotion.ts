'use client';

import { useMediaQuery } from './useMediaQuery';

/**
 * Tracks the OS "reduce motion" setting, and keeps tracking it — people do
 * toggle it mid-session, usually because something on the page provoked them.
 *
 * Returns false on the server and on the first client render so markup matches;
 * every consumer treats motion as an enhancement layered on afterwards, never
 * as the thing that makes content visible.
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}
