'use client';

import { useState } from 'react';
import { useLang } from '@/components/LangContext';
import Reveal from '@/components/motion/Reveal';
import DisplayReveal from '@/components/motion/DisplayReveal';
import styles from './Commitment.module.css';
import fx from '@/components/ui/rowFx.module.css';

const STEPS = ['1', '2', '3', '4'] as const;

/**
 * The four commitment statements, as an expanding stepped list.
 *
 * Replaces the old tab strip. Tabs hide three quarters of the content behind
 * an interaction and read as an app control; a stepped list keeps the whole
 * sequence visible as a numbered progression, which is both more on-register
 * and better for anyone who just wants to read the page top to bottom.
 */
export default function Commitment() {
  const { t } = useLang();
  const [open, setOpen] = useState(0);

  return (
    <section className={`${styles.section} invert`}>
      <div className="shell">
        <Reveal>
          <span className="label label-accent">{t('studio.commitment.label')}</span>
        </Reveal>
        <DisplayReveal as="h2" className={`display d-md ${styles.title}`}>
          {t('studio.commitment.title')}
        </DisplayReveal>

        <Reveal className={styles.steps} stagger={0.06}>
          {STEPS.map((n, i) => {
            const isOpen = open === i;
            return (
              <div
                key={n}
                className={`${styles.step} ${fx.row} ${
                  /* The open step stays lit without the cursor on it. Its own
                     state is the same state hovering produces, so it is set
                     through the shared flag rather than restyled here. */
                  isOpen ? `${styles.stepOpen} ${fx.rowOn}` : ''
                }`}
              >
                <button
                  type="button"
                  className={`${styles.stepHead} ${fx.hit}`}
                  onClick={() => setOpen(i)}
                  aria-expanded={isOpen}
                  aria-controls={`commit-${n}`}
                >
                  <span className={`${styles.plate} ${fx.plate}`} aria-hidden="true" />
                  <span className={`${styles.stepIndex} ${fx.index}`}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className={`display d-sm ${styles.stepLabel} ${fx.title}`}>
                    {t(`studio.c${n}.label`)}
                  </span>
                  <span className={`${styles.stepMark} ${fx.mark}`} aria-hidden="true" />
                </button>
                <div
                  id={`commit-${n}`}
                  className={styles.stepBody}
                  /* Height is animated in CSS via grid-template-rows, which
                     unlike max-height needs no magic number and stays correct
                     when the copy reflows or the language changes. */
                  data-open={isOpen ? 'true' : 'false'}
                >
                  <div className={styles.stepBodyInner}>
                    <p>{t(`studio.c${n}.body`)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
