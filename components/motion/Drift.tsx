'use client';

import { useRef, type ReactNode } from 'react';
import { gsap } from '@/lib/motion/gsap';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

/**
 * A layer that falls behind as its section scrolls away.
 *
 * While the section leaves the top of the screen, whatever this wraps sinks a
 * fraction of the section's height against it and fades, so the page reads
 * as layered rather than as one sheet sliding past: the headline hangs back a
 * moment behind the page carrying it off. Scrubbed on the section's own exit
 * and nothing else, so it is still until the visitor scrolls and exactly
 * reversible when they scroll back.
 *
 * The section is the nearest enclosing `section` or `header`.
 */
export default function Drift({
  children,
  className = '',
  depth = 0.15,
  fade = 0.5,
}: {
  children: ReactNode;
  className?: string;
  /** How far it falls behind by the time the section has gone, as a fraction of the section's height. */
  depth?: number;
  /** How much of its opacity it loses on the way out, 0..1. */
  fade?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    const section = el.closest<HTMLElement>('section, header') ?? el;

    const ctx = gsap.context(() => {
      gsap.to(el, {
        y: () => section.offsetHeight * depth,
        opacity: 1 - fade,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
          invalidateOnRefresh: true,
        },
      });
    }, el);
    return () => ctx.revert();
  }, [reduced, depth, fade]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
