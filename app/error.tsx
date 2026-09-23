'use client';

import { useEffect } from 'react';
import { useLang } from '@/components/LangContext';
import Reveal from '@/components/motion/Reveal';
import DisplayReveal from '@/components/motion/DisplayReveal';
import Magnetic from '@/components/motion/Magnetic';
import shell from './page-shell.module.css';
import styles from './status.module.css';

const EMAIL = 'sekai.kanamori@npanalytica.com';

/**
 * Route-level error boundary.
 *
 * Catches a render or data failure in any route segment and offers `reset`,
 * which re-renders the segment without a full page load — worth trying first,
 * since a transient failure clears without losing scroll position or the
 * language preference.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useLang();

  useEffect(() => {
    // The digest is the only handle on the server-side stack, which is
    // deliberately not sent to the browser.
    console.error('[route error]', error.digest ?? '(no digest)', error);
  }, [error]);

  return (
    <header className={`shell ${shell.masthead}`}>
      <div className={shell.mastheadInner}>
        <div className={shell.mastLead}>
          <Reveal>
            <span className="label label-accent">{t('err.label')}</span>
          </Reveal>
          <DisplayReveal as="h1" className={`display d-lg ${shell.title}`}>
            {t('err.title')}
          </DisplayReveal>
        </div>
        <Reveal delay={0.12} className={shell.lead}>
          <p className="body">{t('err.desc')}</p>
          <div className={styles.actions}>
            <Magnetic>
              <button type="button" onClick={reset} className={styles.action} data-cursor="expand">
                <span className="link-u">{t('err.retry')}</span>
                <span aria-hidden="true"> &#8594;</span>
              </button>
            </Magnetic>
            <a href={`mailto:${EMAIL}`} className={`${styles.action} link-u`}>
              {EMAIL}
            </a>
          </div>
          {error.digest && (
            <span className={`meta ${styles.digest}`}>REF {error.digest}</span>
          )}
        </Reveal>
      </div>
    </header>
  );
}
