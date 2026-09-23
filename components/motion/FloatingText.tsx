'use client';

/* The loop writes transforms and custom properties directly. */

'use no memo';

import { useMemo, useRef } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import styles from './FloatingText.module.css';

/**
 * A paragraph whose words drift.
 *
 * Every word gets a slow sine drift on its own phase and its own frequency,
 * so the line never bobs in unison — that synchrony is what makes this sort
 * of effect read as mechanical. The amplitude stays small relative to the
 * line height: enough that the paragraph is visibly alive at rest, not so
 * much that the baseline wanders and the text becomes work to read.
 *
 * The cursor is the payoff. Words near it lift, grow a little and warm toward
 * the accent, then ease back into their drift once it leaves. That is the
 * same proximity-and-spring shape as the hero cluster, so the page's
 * interactions feel like one idea rather than several.
 *
 * Splitting is script-aware: Japanese is not space-delimited, so splitting it
 * on whitespace would yield one enormous token and no effect at all. Text
 * with no meaningful spaces is split per character instead, which is also
 * where CJK line breaking happens anyway.
 */

interface FloatingTextProps {
  text: string;
  className?: string;
  /** Peak drift, in px. Legibility still sets the ceiling here. */
  amplitude?: number;
  /** How close the cursor must be, in px, before a word reacts. Narrow on
      purpose: a wide reach lifts half the sentence at once and the baseline
      goes ragged instead of one word answering. */
  reach?: number;
}

interface Token {
  /** The visible characters. */
  text: string;
  /** Whether a space follows, for correct wrapping and copy-paste. */
  space: boolean;
}

/** Splits into words, or into characters when the script has no spaces. */
function tokenise(text: string): Token[] {
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/);

  /* A space-delimited language gives roughly one token per five or six
     characters. Far fewer than that means the spaces are not word breaks. */
  const spaceDelimited = words.length > trimmed.length / 12;

  if (spaceDelimited) {
    return words.map((w, i) => ({ text: w, space: i < words.length - 1 }));
  }
  return Array.from(trimmed).map((c) => ({ text: c, space: false }));
}

interface TokenState {
  el: HTMLElement;
  phase: number;
  /** Per-word frequencies, so no two share a rhythm. */
  freqY: number;
  freqX: number;
  near: number;
  /** Eased lift toward the cursor, in px. */
  lift: number;
  liftV: number;
}

export default function FloatingText({
  text,
  className = '',
  amplitude = 2.6,
  reach = 76,
}: FloatingTextProps) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLParagraphElement>(null);

  const tokens = useMemo(() => tokenise(text), [text]);

  useIsomorphicLayoutEffect(() => {
    const root = ref.current;
    if (!root || reduced) return;

    const els = Array.from(root.querySelectorAll<HTMLElement>('[data-token]'));
    if (els.length === 0) return;

    const state: TokenState[] = els.map((el, i) => ({
      el,
      phase: (i * 2.399) % (Math.PI * 2),
      freqY: 0.5 + ((i * 37) % 27) / 100,
      freqX: 0.33 + ((i * 53) % 21) / 100,
      near: 0,
      lift: 0,
      liftV: 0,
    }));

    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const pointer = { x: -9999, y: -9999, seen: false };

    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.seen = true;
    };
    const onLeave = () => {
      pointer.seen = false;
    };

    if (fine) {
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerleave', onLeave, { passive: true });
    }

    let running = false;
    let frame = 0;
    let last = performance.now();

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !running) {
          running = true;
          last = performance.now();
          frame = requestAnimationFrame(tick);
        } else if (!entry.isIntersecting && running) {
          running = false;
          cancelAnimationFrame(frame);
        }
      },
      { rootMargin: '15% 0px', threshold: 0 }
    );
    observer.observe(root);

    function tick(now: number) {
      if (!running) return;
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const t = now / 1000;

      for (const s of state) {
        // The idle drift. Two incommensurate frequencies per word.
        const driftY = Math.sin(t * s.freqY + s.phase) * amplitude;
        const driftX = Math.cos(t * s.freqX + s.phase * 1.4) * amplitude * 0.5;

        let targetLift = 0;
        if (fine && pointer.seen) {
          const r = s.el.getBoundingClientRect();
          const dx = r.left + r.width / 2 - pointer.x;
          const dy = r.top + r.height / 2 - pointer.y;
          const dist = Math.hypot(dx, dy);
          if (dist < reach) {
            const strength = (1 - dist / reach) ** 2;
            s.near = strength;
            targetLift = -strength * 5;
          } else {
            s.near = 0;
          }
        }

        // Spring the lift, so it overshoots very slightly on the way in.
        s.liftV += (targetLift - s.lift) * 34 * dt;
        s.liftV *= Math.exp(-9 * dt);
        s.lift += s.liftV * dt;

        const shown = Number(s.el.style.getPropertyValue('--near') || 0);
        const near = shown + (s.near - shown) * (1 - Math.exp(-11 * dt));
        s.el.style.setProperty('--near', near.toFixed(3));

        s.el.style.transform = `translate3d(${(driftX).toFixed(2)}px, ${(
          driftY + s.lift
        ).toFixed(2)}px, 0) scale(${(1 + near * 0.1).toFixed(3)})`;
      }

      frame = requestAnimationFrame(tick);
    }

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
    };
  }, [reduced, amplitude, reach, tokens]);

  return (
    <p ref={ref} className={`${className} ${styles.para}`}>
      {tokens.map((tk, i) => (
        <span key={`${tk.text}-${i}`}>
          <span data-token className={styles.token}>
            {tk.text}
          </span>
          {tk.space ? ' ' : ''}
        </span>
      ))}
    </p>
  );
}
