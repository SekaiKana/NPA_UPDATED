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
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import styles from './PageTransition.module.css';

interface TransitionApi {
  navigate: (href: string) => void;
}

const TransitionContext = createContext<TransitionApi>({ navigate: () => {} });

export function useTransitionNav() {
  return useContext(TransitionContext);
}

/**
 * Route transitions via a driven curtain.
 *
 * App Router unmounts the outgoing page as soon as navigation starts, so the
 * usual AnimatePresence exit-animation pattern has nothing left to animate.
 * Instead this takes control of the timing directly: cover the viewport, then
 * push, then uncover once the new pathname has landed.
 *
 * The curtain carries the wordmark so the transition reads as a deliberate
 * cut rather than as a loading state.
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const reduced = usePrefersReducedMotion();

  const curtainRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<string | null>(null);
  const coveredRef = useRef(false);

  const uncover = useCallback(() => {
    const curtain = curtainRef.current;
    if (!curtain || !coveredRef.current) return;
    coveredRef.current = false;

    gsap.to(curtain, {
      yPercent: -100,
      duration: 0.75,
      ease: EASE_IO,
      onComplete: () => {
        gsap.set(curtain, { yPercent: 100, visibility: 'hidden' });
      },
    });
  }, []);

  /* When the pathname actually changes, the new page is mounted — lift. */
  useEffect(() => {
    if (pendingRef.current && pendingRef.current === pathname) {
      pendingRef.current = null;
      // One frame so the incoming page has painted behind the curtain.
      const id = requestAnimationFrame(() => requestAnimationFrame(uncover));
      return () => cancelAnimationFrame(id);
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
      router.prefetch(href);

      /* The push must happen exactly once, whichever trigger below gets there
         first. */
      let pushed = false;
      const push = () => {
        if (pushed) return;
        pushed = true;
        router.push(href);
      };

      const COVER = 0.62;

      gsap.set(curtain, { visibility: 'visible', yPercent: 100 });
      gsap.to(curtain, {
        yPercent: 0,
        duration: COVER,
        ease: EASE_IO,
        onComplete: push,
      });

      /* GSAP is driven by requestAnimationFrame, which browsers pause in a
         backgrounded tab and throttle hard under load. Hanging the navigation
         off `onComplete` alone therefore drops it outright when the tween
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
    [pathname, reduced, router, uncover]
  );

  return (
    <TransitionContext.Provider value={{ navigate }}>
      {children}
      <div ref={curtainRef} className={styles.curtain} aria-hidden="true">
        <span className={styles.curtainMark}>NPA</span>
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
