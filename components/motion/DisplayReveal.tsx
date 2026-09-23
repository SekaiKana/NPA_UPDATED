'use client';

import { useRef, type ReactNode } from 'react';
import { gsap, SplitText, EASE } from '@/lib/motion/gsap';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

interface DisplayRevealProps {
  children: ReactNode;
  className?: string;
  /** Seconds before the first line moves. */
  delay?: number;
  /** Run on mount instead of waiting for the element to scroll into view. */
  immediate?: boolean;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'div';
}

/**
 * Line-by-line reveal for display type.
 *
 * Each line is masked by its own overflow-hidden wrapper and rises into place,
 * which is what makes large display headlines feel set rather than faded in.
 * Uses GSAP's SplitText so lines are measured from real layout — a hand-rolled
 * word-wrapping approximation breaks the moment the text reflows.
 *
 * The split is reverted on cleanup, restoring the original DOM so screen
 * readers and text selection are unaffected.
 */
export default function DisplayReveal({
  children,
  className = '',
  delay = 0,
  immediate = false,
  as: Tag = 'div',
}: DisplayRevealProps) {
  const ref = useRef<HTMLElement>(null);
  const reduced = usePrefersReducedMotion();

  useIsomorphicLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (reduced) {
      node.dataset.reveal = 'shown';
      return;
    }

    const ctx = gsap.context(() => {
      const split = new SplitText(node, {
        type: 'lines',
        linesClass: 'split-inner',
        // Each line gets a masking parent, which is what clips the rise.
        mask: 'lines',
      });

      node.dataset.reveal = 'shown';
      gsap.set(node, { opacity: 1 });

      gsap.from(split.lines, {
        yPercent: 118,
        duration: 1.15,
        ease: EASE,
        stagger: 0.085,
        delay,
        ...(immediate
          ? {}
          : { scrollTrigger: { trigger: node, start: 'top 86%', once: true } }),
      });
    }, node);

    /* `ctx.revert()` already reverts any SplitText created inside the context.
       Calling `split.revert()` again afterwards operates on DOM that has
       already been restored, which throws. One revert, not two. */
    return () => ctx.revert();
  }, [reduced, delay, immediate]);

  return (
    <Tag
      ref={ref as React.Ref<HTMLHeadingElement>}
      data-reveal=""
      className={className}
    >
      {children}
    </Tag>
  );
}
