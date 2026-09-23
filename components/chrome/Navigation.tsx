'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useLang } from '@/components/LangContext';
import { TransitionLink, useTransitionNav } from '@/components/motion/PageTransition';
import Magnetic from '@/components/motion/Magnetic';
import { gsap, EASE_IO } from '@/lib/motion/gsap';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useScrolled } from '@/hooks/useScrolled';
import { useInvertedNav } from '@/hooks/useInvertedNav';
import styles from './Navigation.module.css';

const LINKS = [
  { href: '/capabilities', key: 'nav.capabilities' },
  { href: '/studio', key: 'nav.studio' },
  { href: '/contact', key: 'nav.contact' },
];

export default function Navigation() {
  const pathname = usePathname();
  const { lang, setLang, t } = useLang();
  const { navigate } = useTransitionNav();
  const reduced = usePrefersReducedMotion();

  const [open, setOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  /* The bar picks up its rule and ground only once the page has moved, so it
     sits invisibly over the hero and never competes with it. */
  const condensed = useScrolled(40);

  /* Flip to light-on-dark while an ink section is passing under the bar. */
  const onDark = useInvertedNav();

  /* Close the overlay when the route changes — including on browser back and
     forward, which never go through the click handler. Adjusted during render
     rather than in an effect: this is React's documented pattern for resetting
     state on a changed input, and it avoids a second render pass. */
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.removeProperty('overflow');
    };
  }, [open]);

  /* Overlay choreography: the panel wipes down, then the links rise in. */
  useEffect(() => {
    const node = overlayRef.current;
    if (!node || reduced) return;

    const items = node.querySelectorAll(`.${styles.mLinkInner}`);

    if (open) {
      const tl = gsap.timeline();
      tl.set(node, { visibility: 'visible' })
        .fromTo(node, { clipPath: 'inset(0 0 100% 0)' }, {
          clipPath: 'inset(0 0 0% 0)',
          duration: 0.7,
          ease: EASE_IO,
        })
        .fromTo(
          items,
          { yPercent: 110 },
          { yPercent: 0, duration: 0.8, ease: 'power4.out', stagger: 0.06 },
          '-=0.35'
        );
      return () => {
        tl.kill();
      };
    }

    const tl = gsap.timeline();
    tl.to(node, {
      clipPath: 'inset(0 0 100% 0)',
      duration: 0.5,
      ease: EASE_IO,
    }).set(node, { visibility: 'hidden' });
    return () => {
      tl.kill();
    };
  }, [open, reduced]);

  const go = (href: string) => {
    setOpen(false);
    // Let the overlay start closing before the curtain comes up.
    window.setTimeout(() => navigate(href), reduced ? 0 : 160);
  };

  return (
    <>
      <header
        className={`${styles.header} ${condensed ? styles.condensed : ''} ${
          onDark ? styles.onDark : ''
        }`}
      >
        <nav className={styles.bar} aria-label="Primary">
          <TransitionLink href="/" className={styles.mark} data-cursor="expand">
            <span className={styles.markGlyph}>NPA</span>
            <span className={styles.markFull}>Neural Point Analytica</span>
          </TransitionLink>

          <div className={styles.links}>
            {LINKS.map((link) => (
              <TransitionLink
                key={link.href}
                href={link.href}
                className={`${styles.link} link-u ${
                  pathname === link.href ? styles.active : ''
                }`}
              >
                {t(link.key)}
              </TransitionLink>
            ))}
          </div>

          <div className={styles.end}>
            <div className={styles.lang} role="group" aria-label="Language">
              <button
                type="button"
                className={lang === 'EN' ? styles.langOn : styles.langOff}
                onClick={() => setLang('EN')}
                aria-pressed={lang === 'EN'}
              >
                EN
              </button>
              <span aria-hidden="true" className={styles.langSlash}>
                /
              </span>
              <button
                type="button"
                className={lang === 'JP' ? styles.langOn : styles.langOff}
                onClick={() => setLang('JP')}
                aria-pressed={lang === 'JP'}
              >
                JP
              </button>
            </div>

            <Magnetic className={styles.ctaWrap}>
              <TransitionLink href="/contact" className={styles.cta} data-cursor="expand">
                {t('nav.cta')}
              </TransitionLink>
            </Magnetic>

            <button
              type="button"
              className={styles.burger}
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="nav-overlay"
              aria-label={open ? t('nav.close') : t('nav.menu')}
            >
              <span className={`${styles.burgerLine} ${open ? styles.bl1 : ''}`} />
              <span className={`${styles.burgerLine} ${open ? styles.bl2 : ''}`} />
            </button>
          </div>
        </nav>
        <span className={styles.rule} aria-hidden="true" />
      </header>

      <div
        id="nav-overlay"
        ref={overlayRef}
        className={styles.overlay}
        hidden={!open && reduced}
      >
        <div className={styles.overlayInner}>
          <span className="label">{t('footer.nav')}</span>
          <ul className={styles.mLinks}>
            {LINKS.map((link, i) => (
              <li key={link.href} className={styles.mLink}>
                <button
                  type="button"
                  className={styles.mLinkInner}
                  onClick={() => go(link.href)}
                >
                  <span className={styles.mIndex}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {t(link.key)}
                </button>
              </li>
            ))}
          </ul>

          <div className={styles.overlayFoot}>
            <a href="mailto:sekai.kanamori@npanalytica.com" className="link-u">
              sekai.kanamori@npanalytica.com
            </a>
            <span className="meta">{t('footer.located')}</span>
          </div>
        </div>
      </div>
    </>
  );
}
