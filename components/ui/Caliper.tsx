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
 * Used on the numbered indexes that carry the site's content: two jaws close
 * onto the active row's top and bottom edges, an extension line joins them in
 * the gutter, and a readout gives the row's number against the total.
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

  /* The row the instrument is currently on, so it is not re-tweened to where
     it already is on every frame. */
  const active = useRef(-1);
  /* Whether it has ever actually been placed. `active` alone is not enough:
     the effect can run more than once before anything is painted, and a second
     run that agrees with the first about which row is active would skip the
     move and leave the instrument at its initial height of zero. Invisible on
     these two pages only because both lists start below the fold. */
  const placed = useRef(false);

  /* Read on demand, never cached.
     Three separate bugs here came from holding geometry and trying to work out
     when it had gone stale: measured during the staggered entry, the rows were
     26px high in the wrong place; measured before the web fonts arrived, they
     were barely half their eventual height; measured before a language change,
     they were sized to the wrong script. Every one of those was a missing
     invalidation rather than a wrong calculation.

     So there is nothing to invalidate. The rows are read at the moment the
     instrument needs to know where they are, which is a handful of `offsetTop`
     reads on elements the browser has just laid out anyway, at most once per
     animation frame. `offsetTop` rather than `getBoundingClientRect` because it
     reports the laid-out position and ignores the entry transform. */
  const readRows = useCallback((): { top: number; height: number }[] => {
    if (!wrapEl) return [];
    return Array.from(
      wrapEl.querySelectorAll<HTMLElement>('[data-index-row]')
    ).map((el) => {
      /* Summed up the offset chain, so an element that happens to be
         positioned between a row and the container cannot shift everything. */
      let top = 0;
      let node: HTMLElement | null = el;
      while (node && node !== wrapEl) {
        top += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }
      return { top, height: el.offsetHeight };
    });
  }, [wrapEl]);

  /** Moves the instrument onto a row. Does nothing if it is already there. */
  const goTo = useCallback(
    (index: number, row: { top: number; height: number } | undefined) => {
      const bar = barRef.current;
      if (!bar || !row) return;
      if (active.current === index && placed.current) return;
      active.current = index;

      if (readoutRef.current) {
        readoutRef.current.textContent = String(index + 1);
      }

      /* The first placement is a set, not a tween.
         An instrument that slides in from the top of the list on load is
         announcing itself, which is not what it is for: it should simply
         already be measuring the row you arrive at. Travel is what it does
         between rows, once it is on one. */
      if (!placed.current) {
        placed.current = true;
        gsap.set(bar, { y: row.top, height: row.height });
        return;
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

    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    /* Which row the reading line falls in. Used when there is no pointer over
       the list, which covers touch, keyboard and simply scrolling past. */
    const fromScroll = () => {
      const rows = readRows();
      if (rows.length === 0) return;
      const line =
        window.innerHeight * READING_LINE - wrapEl.getBoundingClientRect().top;

      let best = 0;
      for (let i = 0; i < rows.length; i += 1) {
        if (line >= rows[i].top) best = i;
      }
      goTo(best, rows[best]);
      bar.classList.add(styles.on);
    };

    /* The last place the pointer was, in viewport coordinates.
       Kept because scrolling moves the rows under a stationary cursor without
       firing a single pointer event: the row hover updates itself, being CSS,
       and the instrument would sit on whichever row happened to be under the
       cursor when it last moved. Two different answers to "which row am I on"
       on the same screen is worse than either. */
    let pointerY: number | null = null;

    const fromPointer = (clientY: number) => {
      const rows = readRows();
      const y = clientY - wrapEl.getBoundingClientRect().top;
      const i = rows.findIndex((r) => y >= r.top && y <= r.top + r.height);
      if (i === -1) return false;
      goTo(i, rows[i]);
      bar.classList.add(styles.on);
      return true;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!fine || e.pointerType !== 'mouse') return;
      pointerY = e.clientY;
      fromPointer(e.clientY);
    };

    const onPointerLeave = () => {
      if (!fine) return;
      pointerY = null;
      // Hand it back to the reading line rather than hiding it.
      fromScroll();
    };

    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        /* Still the cursor's answer while it is over the list, just recomputed
           against where the rows have scrolled to. Only once it is elsewhere
           does the reading line take over. */
        if (pointerY !== null && wrapEl.matches(':hover')) {
          if (fromPointer(pointerY)) return;
        }
        fromScroll();
      });
    };

    const onResize = () => {
      // The rows moved, so whatever row it was on has to be re-applied.
      active.current = -1;
      fromScroll();
    };

    /* One more pass after the first paint. The rows are laid out by then
       whatever the entry animation is doing, so this is the placement that is
       guaranteed to be against real geometry. */
    const settle = requestAnimationFrame(() => {
      active.current = -1;
      fromScroll();
    });

    fromScroll();

    wrapEl.addEventListener('pointermove', onPointerMove, { passive: true });
    wrapEl.addEventListener('pointerleave', onPointerLeave, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });

    /* The fonts change every row's height when they land. Nothing is cached,
       so this only has to re-apply the position rather than re-derive it. */
    let live = true;
    document.fonts?.ready.then(() => {
      if (live) onResize();
    });

    return () => {
      live = false;
      cancelAnimationFrame(settle);
      wrapEl.removeEventListener('pointermove', onPointerMove);
      wrapEl.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
    /* `revision` is not read in the body of this effect. Changing it is the
       point: it re-runs everything above, which re-measures. */
  }, [wrapEl, readRows, goTo, revision]);

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
            {String(total)}
          </span>
        </span>
      </div>

      {children}
    </div>
  );
}
