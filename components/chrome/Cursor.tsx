'use client';

import { useEffect, useRef } from 'react';
import { gsap } from '@/lib/motion/gsap';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useFinePointer } from '@/hooks/useMediaQuery';
import styles from './Cursor.module.css';

/**
 * Custom cursor: a small filled dot that tracks precisely, plus a hairline
 * ring that trails behind it.
 *
 * The native cursor is never hidden globally — only over the page body, and
 * only on fine pointers. Hiding the system cursor site-wide is the mistake
 * that makes these feel broken: form fields still need an I-beam, and a
 * visitor whose JS half-loads should never be left with no pointer at all.
 *
 * Elements opt into states with `data-cursor="expand"` or `data-cursor="view"`.
 * Over an `.invert` section both parts switch to the light palette so they
 * stay visible on ink.
 */
export default function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const fine = useFinePointer();
  const enabled = fine && !reduced;

  useEffect(() => {
    if (!enabled) return;
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    document.body.classList.add(styles.hideNative);

    // The dot is nearly instant; the ring lags, which is what reads as weight.
    const dotX = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'none' });
    const dotY = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'none' });
    const ringX = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3.out' });
    const ringY = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3.out' });

    let visible = false;
    const onMove = (e: MouseEvent) => {
      if (!visible) {
        visible = true;
        gsap.to([dot, ring], { autoAlpha: 1, duration: 0.3 });
      }
      dotX(e.clientX);
      dotY(e.clientY);
      ringX(e.clientX);
      ringY(e.clientY);

      const el = e.target as HTMLElement | null;

      const target = el?.closest<HTMLElement>('[data-cursor], a, button');
      const state = target?.dataset.cursor ?? (target ? 'expand' : 'default');

      ring.dataset.state = state;
      dot.dataset.state = state;

      /* Light cursor over dark ground. `.invert` is the single marker for an
         ink section anywhere on the site — the navigation bar watches it to
         flip its own treatment, and the hero's WebGL ground is drawn for the
         section carrying it — so keying off the same class is what keeps the
         cursor in step with the background instead of tracking scroll
         position separately and drifting out of sync. Works for the footer
         and any future ink band for free. */
      const onDark = Boolean(el?.closest('.invert'));
      ring.dataset.ground = onDark ? 'dark' : 'light';
      dot.dataset.ground = onDark ? 'dark' : 'light';
    };

    const onLeave = () => {
      visible = false;
      gsap.to([dot, ring], { autoAlpha: 0, duration: 0.25 });
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave);

    return () => {
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      document.body.classList.remove(styles.hideNative);
      gsap.killTweensOf([dot, ring]);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div aria-hidden="true">
      <div ref={ringRef} className={styles.ring} />
      <div ref={dotRef} className={styles.dot} />
    </div>
  );
}
