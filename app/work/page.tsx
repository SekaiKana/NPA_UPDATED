'use client';

import { useLang } from '@/components/LangContext';
import { TransitionLink } from '@/components/motion/PageTransition';
import Reveal from '@/components/motion/Reveal';
import DisplayReveal from '@/components/motion/DisplayReveal';
import Decode from '@/components/motion/Decode';
import Drift from '@/components/motion/Drift';
import Magnetic from '@/components/motion/Magnetic';
import shell from '../page-shell.module.css';
import styles from './work.module.css';

/**
 * Work — held back.
 *
 * The route is kept rather than removed so nothing 404s: it is linked from
 * nowhere on the site now, but /case-studies still redirects here (see
 * next.config.ts) and any inbound link from the previous site lands here too.
 * The index and its content module are left in place for when real case
 * studies are ready; this page is the only thing that needs reverting.
 */
export default function WorkPage() {
  const { t } = useLang();

  return (
    <header className={`shell ${shell.masthead}`}>
      <div className={shell.mastheadInner}>
        <Drift className={shell.mastLead} depth={0.12} fade={0.4}>
          <Reveal>
            <Decode className="label label-accent" text={t('work.soon.label')} />
          </Reveal>
          <DisplayReveal as="h1" className={`display d-lg ${shell.title}`}>
            {t('work.soon.title')}
          </DisplayReveal>
        </Drift>
        <Reveal delay={0.12} className={shell.lead}>
          <p className="body">{t('work.soon.desc')}</p>
          <Magnetic>
            <TransitionLink href="/contact" className={styles.soonLink} data-cursor="expand">
              <span className="link-u">{t('work.soon.cta')}</span>
              <span aria-hidden="true"> &#8594;</span>
            </TransitionLink>
          </Magnetic>
        </Reveal>
      </div>
    </header>
  );
}
