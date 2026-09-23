'use client';

/* The loop writes each word's fog level to its node directly. */

'use no memo';

import { useState, type ReactNode } from 'react';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import styles from './FogReveal.module.css';

/** How far from the cursor a word is still touched by the wipe, px.
    Deliberately smaller than the paragraph is wide: the wipe should be a
    gesture the reader makes across the text, not a single hover that takes the
    whole thing off in one. */
const RADIUS = 130;
/**
 * The inner share of that radius which clears completely rather than partly.
 * Without a plateau, every pass leaves a ring of half-cleared words behind it,
 * and since clearing is permanent those rings never resolve — the paragraph
 * ends up permanently mottled, which reads as a rendering fault rather than as
 * a wipe.
 */
const CORE = 0.55;
/** How fast the wipe takes hold when the cursor first arrives, per second. */
const RATE = 12;

/**
 * Haze over a paragraph that the cursor wipes permanently clear.
 *
 * Local and cursor-following, like a finger on a fogged window: words near the
 * pointer sharpen, and stay sharp. The paragraph is revealed by being swept
 * rather than by being pointed at, so a reader who has uncovered a line does
 * not have to hold the cursor there to keep reading it, and a second visit to
 * the same words costs nothing. The words keep drifting throughout; the fog
 * only ever changes how sharp they are, never whether they are moving.
 *
 * Each word's clarity is monotonic: it only ever increases. That one rule is
 * the whole mechanism, and it is also why nothing here handles the pointer
 * leaving, or closing, or being anywhere in particular when the component
 * mounts. There is no state to wind back, so there is no state to get stuck in
 * — which the two previous versions of this both managed to do.
 *
 * ---- Per word, not a veil ----
 * The obvious build is one blurred panel over the paragraph, and it is wrong:
 * a paragraph's box includes the empty space past the end of every short line,
 * so the panel is visible over blank page and reads as a grey rectangle rather
 * than as text gone soft. Blurring each word puts the effect exactly where
 * there is ink and nowhere else, and the ragged right edge stays ragged.
 *
 * It attaches to `[data-token]`, which is what `FloatingText` splits its words
 * into. Given any other content it does nothing, which is the right failure:
 * no fog is much better than fog that cannot be cleared.
 */
export default function FogReveal({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const reduced = usePrefersReducedMotion();

  useIsomorphicLayoutEffect(() => {
    if (!el || reduced) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const words = Array.from(el.querySelectorAll<HTMLElement>('[data-token]'));
    if (words.length === 0) return;

    /* Word centres in the element's own coordinates, and the size they were
       measured at. Re-read whenever that size changes, which covers the fonts
       landing, the language changing and the column being resized — the three
       things that move words without any pointer event to notice it. */
    let centres: { x: number; y: number }[] = [];
    let measuredAt = -1;

    const measure = () => {
      const box = el.getBoundingClientRect();
      centres = words.map((w) => {
        const r = w.getBoundingClientRect();
        return {
          x: r.left - box.left + r.width / 2,
          y: r.top - box.top + r.height / 2,
        };
      });
      measuredAt = el.offsetHeight;
    };

    /* Eases 0 to 1 as the cursor first arrives, so the wipe takes hold rather
       than stamping a hard disc onto the paragraph. It never goes back down. */
    let open = 0;
    let px = 0;
    let py = 0;

    /** How far each word has been cleared, 0 to 1, and only ever upward. */
    const cleared = new Float32Array(words.length);
    /** Last value written to each word, so a pass that changes nothing writes
        nothing. Most moves are nowhere near most words. */
    const shown = new Float32Array(words.length).fill(-1);

    let raf = 0;
    let running = false;
    let last = 0;

    const paint = () => {
      for (let i = 0; i < words.length; i += 1) {
        // Done with this one, for good: never measured or written again.
        if (cleared[i] >= 0.999) continue;

        const c = centres[i];
        if (!c) continue;

        const d = Math.hypot(c.x - px, c.y - py);
        // Full clarity across the core, then a smoothstep ramp out to the edge.
        const u = Math.min(1, Math.max(0, (RADIUS - d) / (RADIUS * CORE)));
        const clear = open * u * u * (3 - 2 * u);

        // The one rule.
        if (clear <= cleared[i]) continue;
        cleared[i] = clear;

        const fog = Math.round((1 - clear) * 100) / 100;
        if (shown[i] !== fog) {
          shown[i] = fog;
          words[i].style.setProperty('--fog', String(fog));
        }
      }
    };

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      open += (1 - open) * (1 - Math.exp(-RATE * dt));
      paint();

      if (open < 0.998) {
        raf = requestAnimationFrame(tick);
      } else {
        // Fully taken hold. From here, every pass paints straight from `onMove`.
        open = 1;
        paint();
        running = false;
      }
    };

    const start = () => {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };

    /* Tracked on the window with inside/outside derived from the box, so the
       wipe happens over the paragraph and not wherever the mouse happens to
       be. A `pointerenter` would do, but deriving it from a position this
       already has to read means one listener and no enter/leave bookkeeping. */
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;

      const box = el.getBoundingClientRect();
      const inside =
        e.clientX >= box.left &&
        e.clientX <= box.right &&
        e.clientY >= box.top &&
        e.clientY <= box.bottom;
      if (!inside) return;

      if (Math.abs(el.offsetHeight - measuredAt) > 1) measure();
      px = e.clientX - box.left;
      py = e.clientY - box.top;

      /* Painted straight from the event rather than on the next frame. The
         cleared patch is the cursor, not something chasing it, and a wipe that
         lags the hand by a frame feels like a smear. */
      paint();
      if (open < 0.998) start();
    };

    measure();
    paint();
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('resize', measure, { passive: true });

    let live = true;
    document.fonts?.ready.then(() => {
      if (live) measure();
    });

    return () => {
      live = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', measure);
      for (const w of words) w.style.removeProperty('--fog');
    };
  }, [el, reduced]);

  return (
    <div ref={setEl} className={`${styles.fog} ${className}`}>
      {children}
    </div>
  );
}
