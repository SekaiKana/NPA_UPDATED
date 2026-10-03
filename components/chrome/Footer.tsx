'use client';

import { usePathname } from 'next/navigation';
import { useLang } from '@/components/LangContext';
import { TransitionLink } from '@/components/motion/PageTransition';
import Magnetic from '@/components/motion/Magnetic';
import DisplayReveal from '@/components/motion/DisplayReveal';
import Decode from '@/components/motion/Decode';
import ShutterEdge from '@/components/motion/ShutterEdge';
import Image from 'next/image';
import styles from './Footer.module.css';

const EMAIL = 'sekai.kanamori@npanalytica.com';

const INDEX = [
  { href: '/capabilities', key: 'nav.capabilities' },
  { href: '/studio', key: 'nav.studio' },
  { href: '/contact', key: 'nav.contact' },
];

/**
 * Site footer, doubling as the closing call to action.
 *
 * The big prompt is suppressed on /contact — asking someone to get in touch on
 * the page where they are already getting in touch is noise.
 */
export default function Footer() {
  const { t } = useLang();
  const pathname = usePathname();
  const showCta = pathname !== '/contact';

  return (
    <footer className={`${styles.footer} invert`}>
      {/* The ink rises into the page in five columns, the way a route change
          covers it, and draws level before the first line of type. */}
      <ShutterEdge />
      {showCta && (
        <section className={styles.cta}>
          <div className="shell">
            <Decode key={`cta-label-${pathname}`} className="label label-accent" text={t('cta.label')} />
            <DisplayReveal key={`cta-title-${pathname}`} as="h2" className={`display d-lg ${styles.ctaTitle}`}>
              {t('cta.title')}
            </DisplayReveal>
            <Magnetic>
              <TransitionLink href="/contact" className={styles.ctaLink} data-cursor="expand">
                <span>{t('cta.button')}</span>
                <span aria-hidden="true" className={styles.ctaArrow}>&#8594;</span>
              </TransitionLink>
            </Magnetic>
          </div>
        </section>
      )}

      <div className="shell">
        <div className={styles.grid}>
          <div className={styles.brand}>
            {/* The light artwork, not the dark one filtered: see
                Footer.module.css. The footer paints an opaque ink ground and
                the shared canvas sits behind the page, so nothing WebGL can
                reach this mark. */}
            <Image
              src="/NPA-White.png"
              alt=""
              width={44}
              height={44}
              className={styles.brandMark}
            />
            <span className={styles.brandName}>Neural Point Analytica</span>
            <span className="meta">{t('footer.located')}</span>
          </div>

          <nav className={styles.col} aria-label="Footer">
            <Decode key={`nav-${pathname}`} className="label" text={t('footer.nav')} />
            <ul className={styles.list}>
              {INDEX.map((item) => (
                <li key={item.href}>
                  <TransitionLink href={item.href} className="link-u">
                    {t(item.key)}
                  </TransitionLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className={styles.col}>
            <Decode key={`contact-${pathname}`} className="label" text={t('footer.contact')} />
            <a href={`mailto:${EMAIL}`} className={`${styles.email} link-u`}>
              {EMAIL}
            </a>
          </div>
        </div>

        <div className={styles.base}>
          <span className="meta">{t('footer.copy')}</span>
          {/* The studio's position, read off like an instrument settling. */}
          <Decode key={`coords-${pathname}`} className="meta" text={'35.6762° N, 139.6503° E'} />
        </div>
      </div>
    </footer>
  );
}
