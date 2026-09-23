'use client';

import { useEffect, useLayoutEffect } from 'react';

/**
 * `useLayoutEffect` on the client, `useEffect` on the server.
 *
 * Anything that restructures the DOM must use this rather than a plain
 * `useEffect`. React runs passive (`useEffect`) cleanups *after* it has already
 * removed a deleted subtree's nodes, so a GSAP SplitText split or a
 * ScrollTrigger pin-spacer is still in place when React tries to remove the
 * element it remembers — and React throws:
 *
 *   NotFoundError: Failed to execute 'removeChild' on 'Node':
 *   The node to be removed is not a child of this node.
 *
 * Layout-effect cleanups run synchronously *before* the deletion, so the DOM is
 * restored to the shape React expects. This is the same reason GSAP's own
 * `useGSAP()` hook is built on `useLayoutEffect`.
 *
 * The server alias only exists to silence React's warning that
 * `useLayoutEffect` does nothing during SSR; these effects are client-only in
 * practice.
 */
export const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;
