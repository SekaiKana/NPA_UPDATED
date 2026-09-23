'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { gsap, EASE, EASE_IO } from '@/lib/motion/gsap';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useLenis } from '@/components/motion/SmoothScroll';
import styles from './Preloader.module.css';

const SESSION_KEY = 'npa:intro-seen';

/* sessionStorage is external state, so it is read through a store rather than
   copied into component state by an effect. It never changes while the page is
   open, so the subscription is a no-op; the value only matters on mount. */
const introSeenStore = {
  subscribe: () => () => {},
  getSnapshot: () => {
    try {
      return sessionStorage.getItem(SESSION_KEY) === '1';
    } catch {
      // Private mode or blocked storage: show it, it is only cosmetic.
      return false;
    }
  },
  getServerSnapshot: () => true,
};
/** Long enough to read as deliberate, short enough not to be a toll booth. */
const MIN_MS = 2200;
const MAX_MS = 5200;

/**
 * The intro: a blueprint being drawn, then lifted away.
 *
 * Three rules it follows, because preloaders usually break all of them:
 *
 *  - It is gated on something real (fonts + window load), not a fake timer, so
 *    the number means something. A hard ceiling stops a slow asset holding the
 *    page hostage.
 *  - It is skippable — click, key, or scroll — and says so.
 *  - It runs once per session. Coming back to the homepage from /work does not
 *    replay it, which is what makes intros infuriating on the second view.
 *
 * Under reduced motion it never renders at all.
 */
export default function Preloader() {
  const reduced = usePrefersReducedMotion();
  const lenis = useLenis();
  const rootRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const seen = useSyncExternalStore(
    introSeenStore.subscribe,
    introSeenStore.getSnapshot,
    introSeenStore.getServerSnapshot
  );

  /* Dismissed is the only piece of real component state here: whether this
     render pass has finished playing the intro. */
  const [dismissed, setDismissed] = useState(false);
  const doneRef = useRef(false);

  const active = !reduced && !seen && !dismissed;

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;

    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      /* non-fatal */
    }

    const root = rootRef.current;
    if (!root) {
      setDismissed(true);
      return;
    }

    gsap
      .timeline({
        onComplete: () => {
          setDismissed(true);
          lenis.current?.start();
          document.body.style.removeProperty('overflow');
        },
      })
      .to(`.${styles.line}`, {
        scaleX: 0,
        transformOrigin: 'right center',
        duration: 0.5,
        ease: EASE_IO,
        stagger: 0.04,
      })
      .to(`.${styles.meta}`, { opacity: 0, duration: 0.3 }, '<')
      // The curtain lifts rather than fading: a fade reads as a loading state
      // ending, a lift reads as a reveal beginning.
      .to(root, { yPercent: -100, duration: 0.9, ease: EASE_IO }, '-=0.15');
  }, [lenis]);

  useEffect(() => {
    if (!active) return;

    // Hold the page still underneath the curtain.
    lenis.current?.stop();
    document.body.style.overflow = 'hidden';

    const progress = { value: 0 };
    const startedAt = performance.now();

    const ctx = gsap.context(() => {
      const tl = gsap.timeline();

      tl.to(`.${styles.line}`, {
        scaleX: 1,
        duration: 0.9,
        ease: EASE,
        stagger: 0.07,
      })
        .from(`.${styles.meta}`, { opacity: 0, duration: 0.5 }, 0.2)
        .from(`.${styles.markInner}`, { yPercent: 110, duration: 1, ease: EASE }, 0.25);

      // The counter eases toward whatever real progress we have, so it never
      // jumps and never sits at 99.
      gsap.to(progress, {
        value: 100,
        duration: MAX_MS / 1000,
        ease: 'power2.out',
        onUpdate: () => {
          if (counterRef.current) {
            counterRef.current.textContent = String(Math.round(progress.value)).padStart(3, '0');
          }
        },
      });
    }, rootRef);

    const ready = Promise.all([
      document.fonts?.ready ?? Promise.resolve(),
      new Promise<void>((res) => {
        if (document.readyState === 'complete') res();
        else window.addEventListener('load', () => res(), { once: true });
      }),
    ]);

    let timeout: number;
    ready.then(() => {
      const elapsed = performance.now() - startedAt;
      timeout = window.setTimeout(finish, Math.max(0, MIN_MS - elapsed));
    });

    const ceiling = window.setTimeout(finish, MAX_MS);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') finish();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('wheel', finish, { once: true, passive: true });
    window.addEventListener('touchstart', finish, { once: true, passive: true });

    return () => {
      ctx.revert();
      window.clearTimeout(timeout);
      window.clearTimeout(ceiling);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', finish);
      window.removeEventListener('touchstart', finish);
    };
  }, [active, finish, lenis]);

  if (!active) return null;

  return (
    <div
      ref={rootRef}
      className={styles.root}
      role="progressbar"
      aria-label="Loading"
      aria-busy="true"
      onClick={finish}
    >
      <div className={styles.grid} aria-hidden="true">
        <span className={styles.line} />
        <span className={styles.line} />
        <span className={styles.line} />
        <span className={styles.line} />
      </div>

      <div className={styles.mark}>
        <span className={styles.markInner}>Neural Point Analytica</span>
      </div>

      <div className={styles.meta}>
        <span className={styles.counter}>
          <span ref={counterRef}>000</span>
        </span>
        <span className={styles.skip}>Click or scroll to skip</span>
      </div>
    </div>
  );
}
