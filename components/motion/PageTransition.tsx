'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { gsap, EASE_IO } from '@/lib/motion/gsap';
import { setCovered } from '@/lib/motion/curtain';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import styles from './PageTransition.module.css';

interface TransitionApi {
  navigate: (href: string) => void;
}

const TransitionContext = createContext<TransitionApi>({ navigate: () => {} });

export function useTransitionNav() {
  return useContext(TransitionContext);
}

/** The shutters the curtain is cut into. */
const PANELS = 5;
/** Each shutter's travel, and the offset between neighbours, seconds. */
const TRAVEL = 0.55;
const STAGGER = 0.04;
/** The whole cover, first shutter starting to last one home. */
const COVER = TRAVEL + STAGGER * (PANELS - 1);
/**
 * The least time the card stays up, measured from the click. A prefetched
 * route lands almost at once, and without a floor the wordmark would be
 * lifted away before it had finished arriving.
 */
const HOLD = 0.85;

/**
 * Route transitions, cut like the reel.
 *
 * App Router unmounts the outgoing page as soon as navigation starts, so the
 * usual AnimatePresence exit-animation pattern has nothing left to animate.
 * Instead this takes control of the timing directly: cover the viewport, then
 * push, then uncover once the new pathname has landed.
 *
 * The cover is five ink shutters rising left to right, each with a walnut
 * leading edge, which is the reel's scanline stated in the page's own
 * material. It carries one card, the same on every route: the NPA wordmark
 * rising into place with a rule drawn under it while the new page loads
 * behind. (It once named the destination and its path; the wordmark alone
 * was preferred.) Uncovering, the card clears first and the shutters carry on
 * upward in the same order, so the cut reads as one continuous pass rather
 * than a door opening and closing.
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const reduced = usePrefersReducedMotion();

  const curtainRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const ruleRef = useRef<HTMLSpanElement>(null);
  const pendingRef = useRef<string | null>(null);
  const coveredRef = useRef(false);
  const startedRef = useRef(0);

  const panels = useCallback(
    () => Array.from(curtainRef.current?.querySelectorAll<HTMLElement>('[data-panel]') ?? []),
    []
  );

  const uncover = useCallback(() => {
    const curtain = curtainRef.current;
    if (!curtain || !coveredRef.current) return;
    coveredRef.current = false;

    const tl = gsap.timeline({
      onComplete: () => {
        gsap.set(curtain, { visibility: 'hidden' });
        gsap.set(panels(), { yPercent: 100 });
      },
    });
    tl.to(titleRef.current, { yPercent: -110, duration: 0.34, ease: 'power3.in' }, 0)
      .to(ruleRef.current, { scaleX: 0, transformOrigin: 'right center', duration: 0.4, ease: EASE_IO }, 0)
      .to(panels(), { yPercent: -100, duration: TRAVEL, ease: EASE_IO, stagger: STAGGER }, 0.12)
      /* The new page's own entrance plays as the shutters clear it, rather
         than having finished behind them. */
      .call(() => setCovered(false), [], 0.2);
  }, [panels]);

  /* When the pathname actually changes, the new page is mounted — lift, once
     the card has had its moment. */
  useEffect(() => {
    if (pendingRef.current && pendingRef.current === pathname) {
      pendingRef.current = null;
      const elapsed = (performance.now() - startedRef.current) / 1000;
      const wait = Math.max(0, HOLD - elapsed) * 1000;
      let raf = 0;
      // Two frames so the incoming page has painted behind the curtain.
      const timer = window.setTimeout(() => {
        raf = requestAnimationFrame(() => requestAnimationFrame(uncover));
      }, wait);
      return () => {
        window.clearTimeout(timer);
        cancelAnimationFrame(raf);
      };
    }
  }, [pathname, uncover]);

  const navigate = useCallback(
    (href: string) => {
      if (href === pathname) return;

      if (reduced) {
        router.push(href);
        return;
      }

      const curtain = curtainRef.current;
      if (!curtain) {
        router.push(href);
        return;
      }

      pendingRef.current = href;
      coveredRef.current = true;
      startedRef.current = performance.now();
      setCovered(true);
      router.prefetch(href);

      /* The push must happen exactly once, whichever trigger below gets there
         first. */
      let pushed = false;
      const push = () => {
        if (pushed) return;
        pushed = true;
        router.push(href);
      };

      gsap.killTweensOf([...panels(), titleRef.current, ruleRef.current]);
      gsap.set(curtain, { visibility: 'visible' });
      gsap.set(titleRef.current, { yPercent: 110 });
      gsap.set(ruleRef.current, { scaleX: 0, transformOrigin: 'left center' });

      gsap
        .timeline()
        .fromTo(
          panels(),
          { yPercent: 100 },
          { yPercent: 0, duration: TRAVEL, ease: EASE_IO, stagger: STAGGER },
          0
        )
        .call(push, [], COVER)
        // The card comes up once the middle shutters are over the centre.
        .to(titleRef.current, { yPercent: 0, duration: 0.8, ease: 'power4.out' }, 0.38)
        .to(ruleRef.current, { scaleX: 1, duration: 0.9, ease: EASE_IO }, 0.46);

      /* GSAP is driven by requestAnimationFrame, which browsers pause in a
         backgrounded tab and throttle hard under load. Hanging the navigation
         off the timeline alone therefore drops it outright when the tween
         stalls: the visitor clicks a link and simply stays put. setTimeout
         keeps firing in a background tab, so it backstops the push. */
      const pushTimer = window.setTimeout(push, COVER * 1000 + 80);

      /* Safety net: if the route never resolves (offline, a 404, a push that
         silently fails), lift anyway rather than stranding the visitor behind
         an opaque panel. */
      window.setTimeout(() => {
        window.clearTimeout(pushTimer);
        if (pendingRef.current === href) {
          pendingRef.current = null;
          uncover();
        }
      }, 3000);
    },
    [pathname, reduced, router, uncover, panels]
  );

  return (
    <TransitionContext.Provider value={{ navigate }}>
      {children}
      <div ref={curtainRef} className={styles.curtain} aria-hidden="true">
        {Array.from({ length: PANELS }, (_, i) => (
          <span
            key={i}
            data-panel=""
            className={styles.panel}
            style={{ left: `${(i * 100) / PANELS}%` }}
          />
        ))}
        <div className={styles.card}>
          <span className={styles.titleMask}>
            <span ref={titleRef} className={styles.title}>
              NPA
            </span>
          </span>
          <span ref={ruleRef} className={styles.rule} />
        </div>
      </div>
    </TransitionContext.Provider>
  );
}

/**
 * Drop-in replacement for next/link that runs the curtain.
 *
 * Still renders a real anchor with a real href, so middle-click, cmd-click,
 * "open in new tab" and crawlers all behave normally — only plain left-clicks
 * are intercepted.
 */
export function TransitionLink({
  href,
  children,
  className,
  ...rest
}: {
  href: string;
  children: ReactNode;
  className?: string;
} & Omit<React.ComponentProps<typeof Link>, 'href'>) {
  const { navigate } = useTransitionNav();

  const isInternal = href.startsWith('/');

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!isInternal) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    navigate(href);
  };

  if (!isInternal) {
    return (
      <a href={href} className={className} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className} onClick={onClick} {...rest}>
      {children}
    </Link>
  );
}
