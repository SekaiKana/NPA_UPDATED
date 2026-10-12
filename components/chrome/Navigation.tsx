'use client';

/* The pill's shape is driven imperatively: the controller writes the mode
   attribute, the glass's size and the indicator's clip directly. */

'use no memo';

import { useEffect, useRef, useState, type FocusEvent, type PointerEvent } from 'react';
import { usePathname } from 'next/navigation';
import { useLang } from '@/components/LangContext';
import { TransitionLink } from '@/components/motion/PageTransition';
import { useLenis } from '@/components/motion/SmoothScroll';
import { Flip, gsap } from '@/lib/motion/gsap';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useInvertedNav } from '@/hooks/useInvertedNav';
import styles from './Navigation.module.css';

const LINKS = [
  { href: '/capabilities', key: 'nav.capabilities' },
  { href: '/studio', key: 'nav.studio' },
  { href: '/contact', key: 'nav.contact' },
];

const EMAIL = 'sekai.kanamori@npanalytica.com';

/** Matches the breakpoint in Navigation.module.css. */
const MOBILE = '(max-width: 880px)';

/** Below this the pill always stays open, so the top of every page reads in full. */
const COMPACT_AFTER = 120;
/** Scroll travel that counts as a change of direction rather than a tremor. */
const JITTER = 8;

/** The open menu's corner radius. Mirrors --open-r in the stylesheet. */
const OPEN_RADIUS = 26;

/* Growing, the island springs past its size and settles; shrinking, it
   stops dead. An overshoot inward carried the call to action over the mark
   and pulled the glass in tighter than its contents. */
const GROW = { duration: 0.7, ease: 'spring' };
const GROW_BIG = { duration: 0.8, ease: 'spring-soft' };
const SHRINK = { duration: 0.55, ease: 'expo.out' };

/** Where the inverted-section probe sits: the pill's centre line, doubled. */
const PROBE = 76;

/**
 * - full: everything, at the top of the page or scrolling back up
 * - compact: the mark and the call to action, while reading down the page
 * - open: the menu, phones and small tablets only
 */
type Mode = 'full' | 'compact' | 'open';

interface Size {
  w: number;
  h: number;
  r: number;
}

/**
 * The navigation: one floating pill, in the manner of a phone's dynamic
 * island, that changes shape rather than swapping panels.
 *
 * Three moving parts, each animated without touching the page's layout:
 * - Mode changes write `data-mode` at once. Whatever is leaving fades first;
 *   the parts that stay are carried to their new places by Flip (transforms),
 *   and whatever arrives fades in after.
 * - The glass behind it all is a separate, empty, contained layer. A
 *   ResizeObserver on the pill springs the glass from its old size to its new
 *   one. Its width and height are what animate: scaling would squash the
 *   rounded ends, and a clip-path would cut away its border and shadow. Being
 *   empty and absolutely placed, it lays out nothing else when it changes.
 * - The hover indicator is one fill behind the links, clipped to the link
 *   under the pointer, so it slides between them instead of jumping.
 */
export default function Navigation() {
  const pathname = usePathname();
  const { lang, setLang, t } = useLang();
  const reduced = usePrefersReducedMotion();
  const mobile = useMediaQuery(MOBILE);
  const lenis = useLenis();
  const onDark = useInvertedNav(PROBE);

  const [open, setOpen] = useState(false);
  /** Reading down the page. */
  const [away, setAway] = useState(false);
  /** The pointer or keyboard focus is inside the pill, which keeps it full. */
  const [engaged, setEngaged] = useState(false);

  const pillRef = useRef<HTMLDivElement>(null);
  const glassRef = useRef<HTMLSpanElement>(null);
  const markRef = useRef<HTMLAnchorElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLAnchorElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const appliedRef = useRef<Mode>('full');
  const appliedMobileRef = useRef(false);
  const swapRef = useRef<gsap.core.Timeline | null>(null);
  const reducedRef = useRef(reduced);
  useEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);

  /* Close the menu on a change of route, including browser back and forward,
     and when the window grows out of the menu's layout. Adjusted during
     render: React's pattern for resetting state on a changed input. */
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }
  if (open && !mobile) setOpen(false);

  const mode: Mode = open && mobile ? 'open' : away && !engaged ? 'compact' : 'full';

  /* ---- Hover indicator ---- */
  const placeIndicator = (target: HTMLElement | null, state: 'hover' | 'rest') => {
    const ind = indicatorRef.current;
    const links = linksRef.current;
    if (!ind || !links) return;
    if (!target || links.getClientRects().length === 0) {
      ind.dataset.state = 'off';
      return;
    }
    const left = target.offsetLeft;
    const right = links.clientWidth - (target.offsetLeft + target.offsetWidth);
    const clip = `inset(0px ${right}px 0px ${left}px round 999px)`;
    if (ind.dataset.state !== 'hover' && ind.dataset.state !== 'rest') {
      // Arriving from nothing: appear in place rather than sliding in from
      // wherever it was last.
      ind.style.transition = 'none';
      ind.style.clipPath = clip;
      void ind.offsetWidth;
      ind.style.transition = '';
    } else {
      ind.style.clipPath = clip;
    }
    ind.dataset.state = state;
  };

  const restIndicator = () => {
    const links = linksRef.current;
    const active = links?.querySelector<HTMLElement>('[aria-current="page"]') ?? null;
    placeIndicator(active, 'rest');
  };

  /* ---- Scroll: contract reading down, expand reading back up ---- */
  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;
    const read = () => {
      frame = 0;
      const y = window.scrollY;
      const dy = y - last;
      if (y < COMPACT_AFTER) {
        setAway(false);
        last = y;
      } else if (dy > JITTER) {
        setAway(true);
        last = y;
      } else if (dy < -JITTER) {
        setAway(false);
        last = y;
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  /* ---- The glass follows the pill's size ---- */
  useEffect(() => {
    const pill = pillRef.current;
    const glass = glassRef.current;
    if (!pill || !glass) return;

    let size: Size | null = null;
    let tween: gsap.core.Tween | null = null;

    const settle = () => {
      gsap.set(glass, { clearProps: 'width,height,borderRadius' });
    };

    const ro = new ResizeObserver(() => {
      const opening = appliedRef.current === 'open';
      const next: Size = {
        w: pill.offsetWidth,
        h: pill.offsetHeight,
        r: opening ? OPEN_RADIUS : pill.offsetHeight / 2,
      };
      const prev = size;
      size = next;
      if (!prev || reducedRef.current) {
        tween?.kill();
        settle();
        return;
      }
      if (prev.w === next.w && prev.h === next.h && prev.r === next.r) return;

      // Start from where the glass is now, which mid-spring is not `prev`.
      const from: Size = tween?.isActive()
        ? {
            w: glass.offsetWidth,
            h: glass.offsetHeight,
            r: parseFloat(glass.style.borderRadius) || prev.r,
          }
        : prev;
      tween?.kill();
      const timing =
        next.w < from.w || next.h < from.h ? SHRINK : next.h - from.h > 120 ? GROW_BIG : GROW;
      tween = gsap.fromTo(
        glass,
        { width: from.w, height: from.h, borderRadius: Math.min(from.r, from.h / 2) },
        {
          width: next.w,
          height: next.h,
          borderRadius: Math.min(next.r, next.h / 2),
          ...timing,
          onComplete: settle,
        }
      );
    });
    ro.observe(pill);
    return () => {
      ro.disconnect();
      tween?.kill();
    };
  }, []);

  /* ---- Mode changes ---- */
  useIsomorphicLayoutEffect(() => {
    const pill = pillRef.current;
    if (!pill) return;

    const groups = (m: Mode, mob: boolean): HTMLElement[] =>
      ((mob
        ? m === 'open'
          ? [burgerRef.current, menuRef.current]
          : [burgerRef.current]
        : m === 'compact'
          ? [ctaRef.current]
          : [linksRef.current, langRef.current, ctaRef.current]
      ) as (HTMLElement | null)[]
      ).filter((el): el is HTMLElement => !!el);

    const prev = appliedRef.current;
    const prevMobile = appliedMobileRef.current;
    if (prev === mode && prevMobile === mobile) return;

    swapRef.current?.kill();

    // Crossing the breakpoint, or reduced motion: no choreography.
    if (prevMobile !== mobile || reducedRef.current) {
      const entering = groups(mode, mobile).filter((el) => !groups(prev, prevMobile).includes(el));
      gsap.set([...groups(prev, prevMobile), ...groups(mode, mobile)], {
        clearProps: 'opacity,visibility,transform',
      });
      pill.dataset.mode = mode;
      appliedRef.current = mode;
      appliedMobileRef.current = mobile;
      if (reducedRef.current && prevMobile === mobile && entering.length) {
        gsap.fromTo(entering, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'none' });
      }
      if (mode === 'full') restIndicator();
      return;
    }

    const before = groups(prev, mobile);
    const after = groups(mode, mobile);
    const leaving = before.filter((el) => !after.includes(el));
    const entering = after.filter((el) => !before.includes(el));
    const staying = after.filter((el) => before.includes(el));

    const tl = gsap.timeline();
    swapRef.current = tl;
    if (leaving.length) {
      tl.to(leaving, { autoAlpha: 0, duration: 0.14, ease: 'power1.in' });
    }
    tl.add(() => {
      const movers = [markRef.current, ...staying].filter(
        (el): el is HTMLElement => !!el && el.getClientRects().length > 0
      );
      const state = Flip.getState(movers);
      pill.dataset.mode = mode;
      appliedRef.current = mode;
      if (mode === 'full') restIndicator();
      const shrinking = prev === 'open' || mode === 'compact';
      Flip.from(state, shrinking ? SHRINK : mode === 'open' ? GROW_BIG : GROW);
      // Anything a reversal caught half faded comes back.
      gsap.to(staying, { autoAlpha: 1, duration: 0.2, overwrite: 'auto' });

      const menu = menuRef.current;
      if (menu && entering.includes(menu)) {
        gsap.set(menu, { autoAlpha: 1 });
        gsap.fromTo(
          menu.querySelectorAll('[data-item]'),
          { autoAlpha: 0, y: 14 },
          { autoAlpha: 1, y: 0, duration: 0.55, ease: 'power3.out', stagger: 0.045, delay: 0.16 }
        );
      } else if (entering.length) {
        gsap.fromTo(
          entering,
          { autoAlpha: 0, y: -4 },
          { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power2.out', stagger: 0.03, delay: 0.14 }
        );
      }
    });
  }, [mode, mobile]);

  // The active link changes with the route, and every link's width with the language.
  useIsomorphicLayoutEffect(() => {
    restIndicator();
  }, [pathname, lang]);

  /* ---- The open menu: scroll lock, inert page, Escape ---- */
  useEffect(() => {
    if (!open) return;
    const outside = Array.from(document.querySelectorAll<HTMLElement>('main, footer'));
    outside.forEach((el) => (el.inert = true));
    document.body.style.overflow = 'hidden';
    lenis.current?.stop();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        burgerRef.current?.focus();
        return;
      }
      if (e.key !== 'Tab') return;
      // The page is inert, but Tab would still reach the browser's own
      // controls past the last item; it wraps round the menu instead.
      const pill = pillRef.current;
      if (!pill) return;
      const stops = Array.from(
        pill.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
      ).filter((el) => el.getClientRects().length > 0);
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    const smooth = lenis.current;
    const menu = menuRef.current;
    const burger = burgerRef.current;
    return () => {
      outside.forEach((el) => (el.inert = false));
      document.body.style.removeProperty('overflow');
      smooth?.start();
      window.removeEventListener('keydown', onKey);
      // Focus inside the menu would be stranded once it hides.
      if (menu?.contains(document.activeElement)) burger?.focus();
    };
  }, [open, lenis]);

  /* ---- Engagement: hover, or keyboard focus, keeps the pill full ----
     Keyboard focus only: a link clicked with the mouse keeps focus after the
     route changes, and would otherwise hold the pill open down the next page. */
  const keyboardInside = () => !!pillRef.current?.querySelector(':focus-visible');
  const onPointerEnter = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') setEngaged(true);
  };
  const onPointerLeave = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') setEngaged(keyboardInside());
  };
  const onFocus = (e: FocusEvent) => {
    if ((e.target as HTMLElement).matches(':focus-visible')) setEngaged(true);
  };
  const onBlur = (e: FocusEvent) => {
    if (!pillRef.current?.contains(e.relatedTarget as Node | null)) setEngaged(false);
  };

  const close = () => setOpen(false);

  const langToggle = (ref?: React.Ref<HTMLDivElement>) => (
    <div ref={ref} className={styles.lang} role="group" aria-label={t('nav.language')}>
      {(['EN', 'JP'] as const).map((code, i) => (
        <span key={code} className={styles.langItem}>
          {i > 0 && (
            <span aria-hidden="true" className={styles.langSlash}>
              /
            </span>
          )}
          <button
            type="button"
            className={lang === code ? styles.langOn : styles.langOff}
            onClick={() => setLang(code)}
            aria-pressed={lang === code}
          >
            {code}
          </button>
        </span>
      ))}
    </div>
  );

  return (
    <>
      <div
        className={styles.scrim}
        data-open={open ? '' : undefined}
        onClick={close}
        aria-hidden="true"
      />
      <header className={`${styles.header} ${onDark ? styles.onDark : ''}`}>
        <div
          ref={pillRef}
          className={styles.pill}
          onPointerEnter={onPointerEnter}
          onPointerLeave={onPointerLeave}
          onFocus={onFocus}
          onBlur={onBlur}
        >
          <span ref={glassRef} className={styles.glass} aria-hidden="true" />

          <nav className={styles.bar} aria-label={t('nav.primary')}>
            <TransitionLink
              ref={markRef}
              href="/"
              className={styles.mark}
              data-cursor="expand"
              aria-label="Neural Point Analytica"
            >
              NPA
            </TransitionLink>

            <div
              ref={linksRef}
              className={styles.links}
              onPointerLeave={() => restIndicator()}
            >
              <span ref={indicatorRef} className={styles.indicator} aria-hidden="true" />
              {LINKS.map((link) => (
                <TransitionLink
                  key={link.href}
                  href={link.href}
                  className={`${styles.link} ${pathname === link.href ? styles.active : ''}`}
                  aria-current={pathname === link.href ? 'page' : undefined}
                  onPointerEnter={(e) => placeIndicator(e.currentTarget, 'hover')}
                  onFocus={(e) => placeIndicator(e.currentTarget, 'hover')}
                  onBlur={() => restIndicator()}
                >
                  {t(link.key)}
                </TransitionLink>
              ))}
            </div>

            {langToggle(langRef)}

            <TransitionLink
              ref={ctaRef}
              href="/contact"
              className={styles.cta}
              data-cursor="expand"
            >
              {t('nav.cta')}
            </TransitionLink>

            <button
              ref={burgerRef}
              type="button"
              className={styles.burger}
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="nav-menu"
              aria-label={open ? t('nav.close') : t('nav.menu')}
            >
              <span className={styles.burgerLine} />
              <span className={styles.burgerLine} />
            </button>
          </nav>

          <div ref={menuRef} id="nav-menu" className={styles.menu}>
            <ul className={styles.mLinks}>
              {LINKS.map((link, i) => (
                <li key={link.href} data-item>
                  <TransitionLink
                    href={link.href}
                    className={styles.mLink}
                    aria-current={pathname === link.href ? 'page' : undefined}
                    onClickCapture={close}
                  >
                    <span className={styles.mIndex} aria-hidden="true">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {t(link.key)}
                  </TransitionLink>
                </li>
              ))}
            </ul>

            <div className={styles.mRow} data-item>
              {langToggle()}
              <TransitionLink href="/contact" className={styles.mCta} onClickCapture={close}>
                {t('nav.cta')}
              </TransitionLink>
            </div>

            <div className={styles.mFoot} data-item>
              <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
              <span>{t('footer.located')}</span>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
