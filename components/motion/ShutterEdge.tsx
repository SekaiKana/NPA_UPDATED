'use client';

/* The timeline writes the band's clip-path and the lips' transforms directly. */

'use no memo';

import { useRef } from 'react';
import { gsap, EASE_IO } from '@/lib/motion/gsap';
import { isCovered } from '@/lib/motion/curtain';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import styles from './ShutterEdge.module.css';

const COLUMNS = 5;
/** Seconds one column takes to rise, and the beat between neighbours. The
    page cut's shutters run 0.55 and 0.04; these are a little longer, since
    they cover less ground and have to be read on a moving page. */
const TRAVEL = 0.8;
const STAGGER = 0.085;
/** How far below its true top the band waits: this share of the screen, at most. */
const DEPTH = 0.3;
const DEPTH_MAX = 280;
/** It rises once the waiting edge is this far up the screen. */
const TRIGGER = 0.86;

/**
 * The page cut, played again as an ink band arrives.
 *
 * A route change covers the screen with five ink shutters rising left to
 * right. An ink band arriving on the page makes the same move: it waits with
 * its top edge lowered, and once that edge is well up the screen the band
 * rises to its true height in five columns, each a beat behind the one to its
 * left and each carrying the walnut leading edge, on the page cut's own
 * curve. The steps never reach the band's first line of type, so nothing is
 * shown cut in half.
 *
 * It plays on its own clock rather than being scrubbed by the scroll. Scrubbed,
 * the columns rose over the few hundred pixels between the band entering and
 * sitting two fifths of the way up, which at any ordinary speed is a fraction
 * of a second at the very bottom of the screen: all anyone saw was a jagged
 * edge that was gone before the band was worth looking at. It re-arms once the
 * band has gone back below the screen, and whenever a route change covers the
 * page, so it plays each time the band arrives.
 *
 * Mount it as the first child of the band, which must be positioned. The band
 * is clipped rather than covered: whatever shows through the steps is the page
 * itself, never a painted imitation of it, so it cannot disagree with the
 * gradient and grain of the ground behind.
 */
export default function ShutterEdge() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useIsomorphicLayoutEffect(() => {
    const edge = ref.current;
    const band = edge?.parentElement;
    if (!edge || !band || reduced) return;
    const lips = Array.from(edge.children) as HTMLElement[];

    /* Per column: 1 waiting at full depth, 0 level with the band's top. */
    const cols = lips.map(() => ({ v: 1 }));
    let depth = 0;
    let armed = true;
    let tl: gsap.core.Timeline | null = null;

    /* Looked up each time rather than once: the footer outlives the page, and
       what it opens with changes by route. */
    const room = () => {
      const first = band.querySelector<HTMLElement>('.label, h2, h3, p, a, nav');
      if (!first) return 200;
      return first.getBoundingClientRect().top - band.getBoundingClientRect().top - 12;
    };
    const measure = () =>
      Math.round(Math.max(0, Math.min(window.innerHeight * DEPTH, DEPTH_MAX, room())));

    const draw = () => {
      if (cols.every((c) => c.v <= 0)) {
        band.style.clipPath = '';
        return;
      }
      const points: string[] = [];
      cols.forEach((c, i) => {
        const drop = depth * c.v;
        points.push(`${(i * 100) / COLUMNS}% ${drop}px`, `${((i + 1) * 100) / COLUMNS}% ${drop}px`);
        lips[i].style.transform = `translate3d(0, ${drop}px, 0)`;
      });
      points.push('100% 100%', '0% 100%');
      band.style.clipPath = `polygon(${points.join(', ')})`;
    };

    /* Waiting: every column down, the walnut edges showing. */
    const arm = () => {
      tl?.kill();
      tl = null;
      armed = true;
      depth = measure();
      cols.forEach((c) => {
        c.v = 1;
      });
      edge.style.opacity = '1';
      draw();
    };

    const play = () => {
      armed = false;
      tl = gsap
        .timeline()
        .to(cols, { v: 0, duration: TRAVEL, ease: EASE_IO, stagger: STAGGER, onUpdate: draw })
        // The edges belong to the moving shutter, not to the band at rest.
        .to(edge, { opacity: 0, duration: 0.45, ease: 'power2.out' }, '-=0.12')
        .call(draw);
    };

    const tick = () => {
      if (isCovered()) {
        /* A route change has the page covered: wait again, so the band rises
           for the new page as well if it arrives on screen. */
        if (!armed) arm();
        return;
      }
      if (!armed) return;
      const next = measure();
      if (next !== depth) {
        depth = next;
        draw();
      }
      const vh = window.innerHeight;
      const top = band.getBoundingClientRect().top;
      /* Or at the foot of the page, if the band cannot get that high. */
      const maxScroll = document.documentElement.scrollHeight - vh;
      const topAtEnd = top + window.scrollY - maxScroll;
      if (top + depth <= vh * TRIGGER || top <= topAtEnd + 2) play();
    };

    let running = false;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        if (!running) {
          running = true;
          gsap.ticker.add(tick);
        }
        tick();
        return;
      }
      if (running) {
        running = false;
        gsap.ticker.remove(tick);
      }
      // Gone back below the screen: wait there, ready before it next shows.
      if (entry.boundingClientRect.top > 0) arm();
    });

    arm();
    io.observe(band);

    return () => {
      io.disconnect();
      if (running) gsap.ticker.remove(tick);
      tl?.kill();
      band.style.clipPath = '';
      edge.style.opacity = '';
    };
  }, [reduced]);

  return (
    <div ref={ref} className={styles.edge} aria-hidden="true">
      {Array.from({ length: COLUMNS }, (_, i) => (
        <span
          key={i}
          className={styles.lip}
          style={{ left: `${(i * 100) / COLUMNS}%`, width: `${100 / COLUMNS}%` }}
        />
      ))}
    </div>
  );
}
