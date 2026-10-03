'use client';

import { useRef, type ReactNode } from 'react';
import { gsap, EASE } from '@/lib/motion/gsap';
import { whenUncovered } from '@/lib/motion/curtain';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

interface RevealProps {
  children: ReactNode;
  /** Delay before the reveal starts, in seconds. */
  delay?: number;
  /** Travel distance on the way in, px. */
  y?: number;
  /** Stagger direct children instead of moving the wrapper as one block. */
  stagger?: number;
  className?: string;
}

/**
 * The site's default scroll reveal.
 *
 * One-way by design: things do not re-hide when scrolled back past. Content
 * that flickers in and out as you scroll reads as a gimmick and makes a page
 * impossible to re-read.
 *
 * Hidden initially by the `[data-reveal]` rule in CSS rather than by inline
 * style, so reduced-motion users get visible content on first paint without
 * this component needing to run at all.
 */
export default function Reveal({
  children,
  delay = 0,
  y = 26,
  stagger,
  className = '',
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useIsomorphicLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (reduced) {
      node.dataset.reveal = 'shown';
      /* The first pass after hydration always runs with motion on, because
         the media query reads false until the client takes over. That pass
         hid the staggered children, and reverting a scroll-triggered tween
         that never started leaves them at its start values: opacity 0 and 26px
         low. The whole datasheet and the studio principles were invisible to
         anyone who had asked for reduced motion. Clear it explicitly. */
      gsap.set(stagger ? Array.from(node.children) : node, { clearProps: 'opacity,transform' });
      return;
    }

    /* Held until nothing is covering the page, like DisplayReveal. */
    const held: { ctx?: gsap.Context } = {};
    const cancel = whenUncovered(() => {
      held.ctx = gsap.context(() => {
        const targets = stagger ? Array.from(node.children) : [node];

        gsap.set(targets, { opacity: 0, y });
        // Hand opacity control to GSAP; without this the CSS rule and the
        // tween both try to own it and the element stays invisible.
        node.dataset.reveal = 'shown';
        if (stagger) gsap.set(node, { opacity: 1 });

        gsap.to(targets, {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: EASE,
          delay,
          stagger: stagger ?? 0,
          scrollTrigger: { trigger: node, start: 'top 88%', once: true },
        });
      }, node);
    });

    return () => {
      cancel();
      held.ctx?.revert();
    };
  }, [reduced, delay, y, stagger]);

  return (
    <div ref={ref} data-reveal="" className={className}>
      {children}
    </div>
  );
}
