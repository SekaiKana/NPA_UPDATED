'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { gsap } from '@/lib/motion/gsap';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

interface MagneticProps {
  children: ReactNode;
  /** How far outside the element the pull begins, px. */
  radius?: number;
  /** Fraction of the cursor offset the element travels. */
  pull?: number;
  className?: string;
}

/**
 * Pulls its child toward the cursor when the cursor comes near.
 *
 * Only binds on fine pointers: on touch there is no hover state to respond to,
 * and the listener would be dead weight. `quickTo` is used rather than a fresh
 * tween per mousemove — creating tweens at pointer-event frequency is the
 * usual reason magnetic buttons feel sluggish.
 */
export default function Magnetic({
  children,
  radius = 90,
  pull = 0.35,
  className = '',
}: MagneticProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node || reduced) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;

    const xTo = gsap.quickTo(node, 'x', { duration: 0.6, ease: 'power3.out' });
    const yTo = gsap.quickTo(node, 'y', { duration: 0.6, ease: 'power3.out' });

    const onMove = (e: MouseEvent) => {
      const r = node.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;

      // Distance to the element's edge, not its centre — otherwise wide
      // buttons start pulling from absurdly far away.
      const reach = Math.max(r.width, r.height) / 2 + radius;
      if (Math.hypot(dx, dy) < reach) {
        xTo(dx * pull);
        yTo(dy * pull);
      } else {
        xTo(0);
        yTo(0);
      }
    };

    const onLeave = () => {
      xTo(0);
      yTo(0);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseleave', onLeave, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
      gsap.killTweensOf(node);
    };
  }, [radius, pull, reduced]);

  return (
    <span ref={ref} className={className} style={{ display: 'inline-block' }}>
      {children}
    </span>
  );
}
