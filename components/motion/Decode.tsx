'use client';

/* The tween writes the visible copy's text directly. */

'use no memo';

import { useRef } from 'react';
import { gsap } from '@/lib/motion/gsap';
import { whenUncovered } from '@/lib/motion/curtain';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const DIGITS = '0123456789';

/**
 * A label that resolves out of noise as it comes into view, the way an
 * instrument's readout settles, rather than fading in.
 *
 * It is the reel's HUD vocabulary applied to the site's small labels, so the
 * small type everywhere behaves like part of the same instrument. Latin text
 * scrambles through capitals and figures; figures alone through figures;
 * Japanese through its own characters, since a Latin scramble resolving into
 * kana looks like an encoding fault.
 *
 * The labels are set in a proportional face, where every scrambled character
 * is a different width, so the label's finished width is held for the length
 * of the scramble. Without that it shivered as it resolved, and anything set
 * after it on the line, or aligned against it, shivered with it.
 *
 * The animated copy is hidden from assistive technology and a stable copy is
 * kept for it, so a screen reader never meets the text half-decoded. Without
 * JavaScript, or with reduced motion, the label is simply the label.
 */
export default function Decode({
  text,
  className = '',
  delay = 0,
}: {
  text: string;
  className?: string;
  /** Seconds after it comes into view. */
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = usePrefersReducedMotion();

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;

    /* Holds the finished label's width, measured from the real text, while
       the scramble runs through characters of other widths. */
    const hold = () => {
      el.textContent = text;
      el.style.display = 'inline-block';
      el.style.whiteSpace = 'nowrap';
      el.style.width = '';
      el.style.width = `${el.getBoundingClientRect().width}px`;
    };
    const release = () => {
      el.style.display = '';
      el.style.whiteSpace = '';
      el.style.width = '';
    };

    // Blank until decoded, holding its line with a no-break space.
    hold();
    el.textContent = ' ';
    let tween: gsap.core.Tween | null = null;
    let cancel = () => {};

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        cancel = whenUncovered(() => {
          /* Measured again at the start: the webfont may have landed since
             the first measurement, and it changes every width. */
          hold();
          el.textContent = ' ';
          const chars = /[A-Za-z]/.test(text) ? LETTERS : /\d/.test(text) ? DIGITS : text;
          tween = gsap.to(el, {
            duration: Math.min(1.3, 0.45 + text.length * 0.028),
            delay,
            ease: 'none',
            scrambleText: { text, chars, speed: 0.6, revealDelay: 0.12 },
            onComplete: release,
          });
        });
      },
      { rootMargin: '0px 0px -6% 0px' }
    );
    io.observe(el);

    return () => {
      io.disconnect();
      cancel();
      tween?.kill();
      release();
      el.textContent = text;
    };
  }, [text, reduced, delay]);

  return (
    <span className={className}>
      <span ref={ref} aria-hidden="true">
        {text}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}
