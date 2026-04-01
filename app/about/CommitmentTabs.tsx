'use client';

import { useState } from 'react';
import styles from './about.module.css';
import { useLang } from '@/components/LangContext';

export default function CommitmentTabs() {
  const [activeIndex, setActiveIndex] = useState(0);
  const { t } = useLang();

  const tabs = [
    {
      labelKey: 'about.commitment.tab1.label',
      contentKey: 'about.commitment.tab1.content',
    },
    {
      labelKey: 'about.commitment.tab2.label',
      contentKey: 'about.commitment.tab2.content',
    },
    {
      labelKey: 'about.commitment.tab3.label',
      contentKey: 'about.commitment.tab3.content',
    },
    {
      labelKey: 'about.commitment.tab4.label',
      contentKey: 'about.commitment.tab4.content',
    },
  ];

  return (
    <section className={styles.commitment}>
      <h2 className={styles.commitmentTitle}>
        {t('about.commitment.title')}
      </h2>

      <div className={styles.commitmentGrid}>
        {/* Left: Vertical tab menu */}
        <nav className={styles.tabNav}>
          {tabs.map((tab, i) => (
            <button
              key={tab.labelKey}
              className={`${styles.tabButton} ${i === activeIndex ? styles.tabButtonActive : ''
                }`}
              onClick={() => setActiveIndex(i)}
            >
              <span className={styles.tabDot} />
              <span className={styles.tabLabel}>{t(tab.labelKey)}</span>
            </button>
          ))}
        </nav>

        {/* Right: Content area */}
        <div className={styles.tabContent}>
          <p key={activeIndex} className={styles.tabText}>
            {t(tabs[activeIndex].contentKey)}
          </p>
        </div>
      </div>
    </section>
  );
}
