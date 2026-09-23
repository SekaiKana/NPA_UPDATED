'use client';

import Lenis from 'lenis';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { gsap, ScrollTrigger } from '@/lib/motion/gsap';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

type LenisRef = MutableRefObject<Lenis | null>;

const LenisContext = createContext<LenisRef>({ current: null });

/**
 * Access to the smooth-scroll instance.
 *
 * Returns a stable ref rather than the instance itself, so creating and
 * destroying Lenis never re-renders the tree. Read `.current` at call time —
 * it is null under reduced motion and before the instance exists.
 */
export function useLenis(): LenisRef {
  return useContext(LenisContext);
}

/**
 * Site-wide inertial scrolling, and the single source of truth for scroll
 * position.
 *
 * Lenis and ScrollTrigger both want to own the scroll loop, so they are wired
 * together explicitly: Lenis is driven off GSAP's ticker rather than its own
 * rAF, and every Lenis scroll event updates ScrollTrigger. Two independent rAF
 * loops is what makes GSAP-plus-Lenis setups judder.
 *
 * Under reduced motion no instance is created at all — the browser's own
 * scrolling is exactly what that preference asks for.
 */
export default function SmoothScroll({ children }: { children: ReactNode }) {
  const reduced = usePrefersReducedMotion();
  const lenisRef = useRef<Lenis | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (reduced) return;

    const instance = new Lenis({
      duration: 1.05,
      // Slightly overshooting exponential — the weight that makes scrolling
      // feel like it has mass rather than like a slow animation.
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      touchMultiplier: 1.6,
      wheelMultiplier: 1,
    });

    lenisRef.current = instance;

    const onScroll = () => ScrollTrigger.update();
    instance.on('scroll', onScroll);

    const tick = (time: number) => instance.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      instance.off('scroll', onScroll);
      gsap.ticker.remove(tick);
      instance.destroy();
      lenisRef.current = null;
    };
  }, [reduced]);

  /* On route change, jump to the top before the new page settles and refresh
     every trigger — stale trigger positions from the previous route are the
     classic ScrollTrigger-plus-router bug. */
  useEffect(() => {
    const lenis = lenisRef.current;
    if (lenis) lenis.scrollTo(0, { immediate: true });
    else window.scrollTo(0, 0);

    const id = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  return (
    <LenisContext.Provider value={lenisRef}>{children}</LenisContext.Provider>
  );
}
