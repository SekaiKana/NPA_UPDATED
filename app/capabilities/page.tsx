'use client';

import { useLang } from '@/components/LangContext';
import Reveal from '@/components/motion/Reveal';
import FloatingText from '@/components/motion/FloatingText';
import DisplayReveal from '@/components/motion/DisplayReveal';
import IndexRow from '@/components/ui/IndexRow';
import Caliper from '@/components/capabilities/Caliper';
import shell from '../page-shell.module.css';
import styles from './capabilities.module.css';

const CAPABILITIES = ['1', '2', '3', '4', '5', '6'] as const;

export default function CapabilitiesPage() {
  const { t } = useLang();

  return (
    <>
      <header className={`shell ${shell.masthead}`}>
        <div className={shell.mastheadInner}>
          <div className={shell.mastLead}>
            <Reveal>
              <span className="label">{t('cap.label')}</span>
            </Reveal>
            <DisplayReveal as="h1" className={`display d-lg ${shell.title}`}>
              {t('cap.title')}
            </DisplayReveal>
          </div>
          <Reveal delay={0.12} className={shell.lead}>
            <FloatingText className="body" text={t('cap.desc')} />
          </Reveal>
        </div>
      </header>

      <section className={`shell ${shell.sectionTight}`}>
        {/* The caliper renders the list's own container, so it can measure the
            rows inside it without being handed a ref to a parent that React
            has not attached yet. */}
        <Caliper
          total={CAPABILITIES.length}
          className={styles.index}
          /* The titles change with the language and the rows change height with
             them, so the instrument has to re-measure. It cannot detect that
             itself — see the prop's own note. */
          revision={CAPABILITIES.map((n) => t(`cap.${n}.title`)).join('|')}
        >
          <Reveal stagger={0.07}>
            {CAPABILITIES.map((n, i) => (
              <IndexRow
                key={n}
                index={String(i + 1).padStart(3, '0')}
                title={t(`cap.${n}.title`)}
                body={t(`cap.${n}.desc`)}
              />
            ))}
          </Reveal>
        </Caliper>
      </section>
    </>
  );
}
