'use client';

/* The tween writes textContent directly. */

'use no memo';

import { useRef } from 'react';
import { gsap, EASE } from '@/lib/motion/gsap';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';

/**
 * Counts a figure up to its value when it scrolls into view.
 *
 * The final value is what React renders, so it is present in the server HTML
 * and correct with JavaScript off, for a crawler, or under reduced motion —
 * the tween only ever overwrites it on the way to the same number. Anything
 * non-numeric (or a plain zero, which has nowhere to count from) is passed
 * straight through.
 */
export default function CountUp({
  value,
  className = '',
}: {
  value: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = usePrefersReducedMotion();

  useIsomorphicLayoutEffect(() => {
    const node = ref.current;
    const target = Number(value);
    if (!node || reduced || !Number.isFinite(target) || target === 0) return;

    const ctx = gsap.context(() => {
      const counter = { n: 0 };
      gsap.to(counter, {
        n: target,
        duration: 1.6,
        ease: EASE,
        scrollTrigger: { trigger: node, start: 'top 90%', once: true },
        onUpdate: () => {
          node.textContent = String(Math.round(counter.n));
        },
        // Guarantee the exact figure regardless of where rounding lands.
        onComplete: () => {
          node.textContent = value;
        },
      });
    }, node);

    return () => {
      ctx.revert();
      node.textContent = value;
    };
  }, [value, reduced]);

  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  );
}
