'use client';

import { useLang } from '@/components/LangContext';
import { TransitionLink } from '@/components/motion/PageTransition';
import Reveal from '@/components/motion/Reveal';
import DisplayReveal from '@/components/motion/DisplayReveal';
import Magnetic from '@/components/motion/Magnetic';
import IndexRow from '@/components/ui/IndexRow';
import shell from './page-shell.module.css';
import styles from './status.module.css';

/**
 * 404.
 *
 * Built out of the same masthead and index row as every other route rather
 * than as a bare apology, so a wrong URL lands somewhere that still looks like
 * the site and offers the whole index as the way out.
 */

const INDEX = [
  { href: '/capabilities', key: 'nav.capabilities' },
  { href: '/studio', key: 'nav.studio' },
  { href: '/contact', key: 'nav.contact' },
];

export default function NotFound() {
  const { t } = useLang();

  return (
    <>
      <header className={`shell ${shell.masthead}`}>
        <div className={shell.mastheadInner}>
          <div className={shell.mastLead}>
            <Reveal>
              <span className="label label-accent">{t('nf.label')}</span>
            </Reveal>
            <DisplayReveal as="h1" className={`display d-lg ${shell.title}`}>
              {t('nf.title')}
            </DisplayReveal>
          </div>
          <Reveal delay={0.12} className={shell.lead}>
            <p className="body">{t('nf.desc')}</p>
            <Magnetic>
              <TransitionLink href="/" className={styles.action} data-cursor="expand">
                <span className="link-u">{t('nf.home')}</span>
                <span aria-hidden="true"> &#8594;</span>
              </TransitionLink>
            </Magnetic>
          </Reveal>
        </div>
      </header>

      <section className={`shell ${shell.sectionTight}`}>
        <div className={styles.index}>
          {INDEX.map((item, i) => (
            <TransitionLink key={item.href} href={item.href} className={styles.indexLink}>
              <IndexRow index={String(i + 1).padStart(3, '0')} title={t(item.key)} />
            </TransitionLink>
          ))}
        </div>
      </section>
    </>
  );
}
