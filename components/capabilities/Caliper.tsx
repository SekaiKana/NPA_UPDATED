'use client';

/* The instrument's position and height are written to the node every move. */

'use no memo';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { gsap } from '@/lib/motion/gsap';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import styles from './Caliper.module.css';

/** Where down the viewport a row counts as the one being read, 0..1. */
const READING_LINE = 0.42;

/**
 * A dimension annotation that measures whichever row you are looking at.
 *
 * The capabilities page is a numbered technical index, and this is the
 * instrument you would use on one: two jaws close onto the active row's top and
 * bottom edges, an extension line joins them in the gutter, and a readout gives
 * the row's number against the total.
 *
 * What makes it the page's own rather than a variation on the row hover it sits
 * over is continuity. The row hover is a state each row enters and leaves
 * independently; this is a single object that *travels*, carrying its overshoot
 * from one row to the next. That is a different mechanic, and it is the reason
 * it reads as an instrument rather than as a highlight.
 *
 * It follows the pointer where there is one, and otherwise follows the reading
 * line as the page scrolls. The fallback is not a consolation: on a phone it
 * becomes a position indicator that tells you where you are in the set of six,
 * which is arguably more useful than the desktop behaviour.
 */
export default function Caliper({
  children,
  total,
  revision,
  className = '',
}: {
  children: ReactNode;
  /** Denominator in the readout. The row count, stated by the caller. */
  total: number;
  /**
   * Anything that changes when the rows' content changes.
   *
   * The instrument is sized to the row it is measuring, so it has to be told
   * when the rows change shape. It cannot work that out for itself: its own
   * props do not change when the copy inside a sibling does, and the React
   * Compiler will memoise this element and skip re-rendering it entirely. The
   * visible result is an instrument still drawn to the Japanese line heights
   * after a switch back to English, with the bottom jaw through the middle of
   * the next title.
   */
  revision?: string | number;
  className?: string;
}) {
  const [wrapEl, setWrapEl] = useState<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const reduced = usePrefersReducedMotion();

  /* Row geometry measured once per layout, in the container's own coordinates.
     Offsets inside the container do not change when the page scrolls, so this
     survives every scroll frame untouched and only the container's own position
     has to be read per frame. */
  const rows = useRef<{ top: number; height: number }[]>([]);
  const active = useRef(-1);
  /* The container's own height at the last measurement. A cheap tell that the
     rows have reflowed under us for any reason the props do not describe. */
  const measuredAt = useRef(-1);

  const measure = useCallback(() => {
    if (!wrapEl) return;
    const box = wrapEl.getBoundingClientRect();
    rows.current = Array.from(
      wrapEl.querySelectorAll<HTMLElement>('[data-index-row]')
    ).map((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top - box.top, height: r.height };
    });
    measuredAt.current = box.height;
    // The geometry moved, so whatever row it was on has to be re-applied.
    active.current = -1;
  }, [wrapEl]);

  /** Moves the instrument onto a row. Does nothing if it is already there. */
  const goTo = useCallback(
    (index: number) => {
      const bar = barRef.current;
      const row = rows.current[index];
      if (!bar || !row || active.current === index) return;
      active.current = index;

      if (readoutRef.current) {
        readoutRef.current.textContent = String(index + 1).padStart(3, '0');
      }

      gsap.to(bar, {
        y: row.top,
        height: row.height,
        /* Fired on a change of row, never per frame — the cost of the whole
           instrument is one tween every time you cross a boundary.

           `back.out` rather than an eased slide: a measuring tool snapping onto
           a subject overshoots and settles, and that overshoot is most of what
           makes this feel like an object instead of a moving rectangle. */
        duration: reduced ? 0 : 0.52,
        ease: 'back.out(1.7)',
        overwrite: true,
      });
    },
    [reduced]
  );

  /* ---- Pointer ---- */
  useIsomorphicLayoutEffect(() => {
    if (!wrapEl) return;
    const bar = barRef.current;
    if (!bar) return;

    measure();

    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    /* Which row the reading line falls in. Used when there is no pointer over
       the list, which covers touch, keyboard and simply scrolling past. */
    const fromScroll = () => {
      if (rows.current.length === 0) return;
      const box = wrapEl.getBoundingClientRect();
      /* Self-healing: the container changing height means the rows reflowed,
         whatever caused it — a late image, a font, copy swapped underneath.
         One number compared per frame, against six rects re-read only when it
         actually differs. */
      if (Math.abs(box.height - measuredAt.current) > 1) {
        measure();
        return fromScroll();
      }
      const line = window.innerHeight * READING_LINE - box.top;

      let best = 0;
      for (let i = 0; i < rows.current.length; i += 1) {
        const r = rows.current[i];
        if (line >= r.top) best = i;
      }
      goTo(best);
      bar.classList.add(styles.on);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!fine || e.pointerType !== 'mouse') return;
      const box = wrapEl.getBoundingClientRect();
      if (Math.abs(box.height - measuredAt.current) > 1) measure();
      const y = e.clientY - box.top;
      const i = rows.current.findIndex(
        (r) => y >= r.top && y <= r.top + r.height
      );
      if (i === -1) return;
      goTo(i);
      bar.classList.add(styles.on);
    };

    const onPointerLeave = () => {
      if (!fine) return;
      // Hand it back to the reading line rather than hiding it.
      fromScroll();
    };

    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        /* Only while the pointer is elsewhere. Taking the row back off the
           cursor mid-hover is the one thing that would make this feel broken. */
        if (!wrapEl.matches(':hover')) fromScroll();
      });
    };

    const onResize = () => {
      measure();
      active.current = -1;
      fromScroll();
    };

    fromScroll();

    wrapEl.addEventListener('pointermove', onPointerMove, { passive: true });
    wrapEl.addEventListener('pointerleave', onPointerLeave, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });

    /* The rows arrive with a staggered reveal, so their first measurement is
       taken while they are still offset. One re-measure once the fonts have
       landed catches both that and the metrics changing under a late face. */
    let live = true;
    document.fonts?.ready.then(() => {
      if (live) onResize();
    });

    return () => {
      live = false;
      wrapEl.removeEventListener('pointermove', onPointerMove);
      wrapEl.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
    /* `revision` is not read in the body of this effect. Changing it is the
       point: it re-runs everything above, which re-measures. */
  }, [wrapEl, measure, goTo, revision]);

  return (
    <div ref={setWrapEl} className={`${styles.wrap} ${className}`}>
      <div ref={barRef} className={styles.caliper} aria-hidden="true">
        <span className={`${styles.jaw} ${styles.jawTop}`} />
        <span className={`${styles.jaw} ${styles.jawBottom}`} />
        <span className={styles.stem} />
        <span className={`${styles.tick} ${styles.tickTop}`} />
        <span className={`${styles.tick} ${styles.tickBottom}`} />
        <span className={styles.readout}>
          <span ref={readoutRef}>001</span>
          <span className={styles.readoutTotal}>
            {' / '}
            {String(total).padStart(3, '0')}
          </span>
        </span>
      </div>

      {children}
    </div>
  );
}
