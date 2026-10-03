'use client';

/* The tweens write each strip's transform directly. */

'use no memo';

import { useRef } from 'react';
import { gsap } from '@/lib/motion/gsap';
import { whenUncovered } from '@/lib/motion/curtain';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import styles from './Odometer.module.css';

/** Digits per strip: four full turns of the wheel. */
const TURNS = 4;
const STRIP = Array.from({ length: TURNS * 10 + 1 }, (_, i) => String(i % 10));

/**
 * A figure that rolls into place like a mechanical counter.
 *
 * The same move as the week counter in the reel, so the datasheet's figures
 * and the reel's read as one instrument. Each column spins through whole turns
 * of the wheel before it lands, the rightmost the most, as on a real counter;
 * a zero spins a full turn and comes back to zero rather than sitting still,
 * because "no technical limits" should not look like nothing happened.
 *
 * Every column keeps a real digit in normal flow, so the figure's width and
 * baseline are exactly what plain text would give and it still aligns with
 * the unit beside it. The rolling strip is drawn over that digit while it
 * moves. Without JavaScript, or with reduced motion, it is just the number.
 */
export default function Odometer({
  value,
  className = '',
}: {
  value: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = usePrefersReducedMotion();
  const digits = Array.from(value);

  useIsomorphicLayoutEffect(() => {
    const root = ref.current;
    if (!root || reduced) return;
    const strips = Array.from(root.querySelectorAll<HTMLElement>('[data-strip]'));
    if (strips.length === 0) return;

    root.dataset.rolling = '';
    gsap.set(strips, { yPercent: 0 });
    let tl: gsap.core.Timeline | null = null;
    let cancel = () => {};

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        cancel = whenUncovered(() => {
          tl = gsap.timeline({
            onComplete: () => {
              delete root.dataset.rolling;
            },
          });
          strips.forEach((strip, i) => {
            const digit = Number(strip.dataset.strip);
            // Rightmost column turns most; every column turns at least once.
            const turns = Math.min(TURNS - 1, 1 + (strips.length - 1 - i));
            const cell = turns * 10 + digit;
            tl!.to(
              strip,
              {
                yPercent: (-100 * cell) / STRIP.length,
                duration: 1.5 + turns * 0.22,
                ease: 'power4.inOut',
              },
              i * 0.08
            );
          });
        });
      },
      { rootMargin: '0px 0px -10% 0px' }
    );
    io.observe(root);

    return () => {
      io.disconnect();
      cancel();
      tl?.kill();
      delete root.dataset.rolling;
      gsap.set(strips, { clearProps: 'transform' });
    };
  }, [value, reduced]);

  return (
    <span ref={ref} className={`${styles.odometer} ${className}`}>
      <span className="sr-only">{value}</span>
      {digits.map((d, i) =>
        /\d/.test(d) ? (
          <span key={i} className={styles.column} aria-hidden="true">
            <span className={styles.digit}>{d}</span>
            <span className={styles.strip} data-strip={d}>
              {STRIP.map((n, k) => (
                <span key={k} className={styles.cell}>
                  {n}
                </span>
              ))}
            </span>
          </span>
        ) : (
          <span key={i} aria-hidden="true">
            {d}
          </span>
        )
      )}
    </span>
  );
}
