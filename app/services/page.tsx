'use client';

import styles from "../subpage.module.css";
import { useLang } from "@/components/LangContext";

export default function Services() {
  const { t } = useLang();

  const services = [
    {
      titleKey: "services.card1.title",
      descKey: "services.card1.desc",
    },
    {
      titleKey: "services.card2.title",
      descKey: "services.card2.desc",
    },
    {
      titleKey: "services.card3.title",
      descKey: "services.card3.desc",
    },
    {
      titleKey: "services.card4.title",
      descKey: "services.card4.desc",
    },
    {
      titleKey: "services.card5.title",
      descKey: "services.card5.desc",
    },
    {
      titleKey: "services.card6.title",
      descKey: "services.card6.desc",
    },
  ];

  return (
    <div className={styles.pageShell}>
      <p className={styles.pageLabel}>{t('services.label')}</p>
      <h1 className={styles.pageTitle}>{t('services.title')}</h1>
      <p className={styles.pageDesc}>
        {t('services.desc')}
      </p>

      <div className={styles.pageCardGrid}>
        {services.map((s, i) => (
          <div key={i} className={`glass-card ${styles.pageCard}`}>
            <h3 className={styles.pageCardTitle}>{t(s.titleKey)}</h3>
            <p className={styles.pageCardDesc}>{t(s.descKey)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
