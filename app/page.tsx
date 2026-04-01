'use client';

import styles from "./page.module.css";
import Footer from "@/components/Footer";
import { useLang } from "@/components/LangContext";

export default function Home() {
  const { t } = useLang();

  return (
    <>
      {/* ===== HERO ===== */}
      <section className={styles.hero} id="hero">
        <div className={`${styles.heroContent} animate-in`}>
          <h1 className={styles.heroTitle}>
            {t('home.hero.title1')}
            <span className={styles.heroTitleAccent}>{t('home.hero.title2')}</span>
          </h1>
          <p className={`${styles.heroSub} animate-in animate-in-delay-2`}>
            {t('home.hero.sub')}
          </p>
          <a href="mailto:rentaro.sato@npanalytica.com" className={`${styles.heroCta} animate-in animate-in-delay-3`}>
            {t('home.hero.cta')}<span className="arrow">→</span>
          </a>
        </div>
        <div className={styles.scrollIndicator}>
          <span>Scroll</span>
          <div className={styles.scrollLine} />
        </div>
      </section>

      {/* ===== SERVICES ===== */}
      <section className={styles.services} id="services">
        <div className={styles.servicesHeader}>
          <p className="section-label">{t('home.services.label')}</p>
          <h2 className="heading-lg">{t('home.services.title')}</h2>
        </div>

        <div className={styles.servicesGrid}>
          <div className={`glass-card ${styles.serviceCard}`}>
            <span className={styles.serviceIcon}>⬡</span>
            <span className={styles.serviceNumber}>01</span>
            <h3 className={styles.serviceTitle}>{t('home.services.card1.title')}</h3>
            <p className={styles.serviceDesc}>
              {t('home.services.card1.body')}
            </p>
          </div>

          <div className={`glass-card ${styles.serviceCard}`}>
            <span className={styles.serviceIcon}>⬢</span>
            <span className={styles.serviceNumber}>02</span>
            <h3 className={styles.serviceTitle}>{t('home.services.card2.title')}</h3>
            <p className={styles.serviceDesc}>
              {t('home.services.card2.body')}
            </p>
          </div>

          <div className={`glass-card ${styles.serviceCard}`}>
            <span className={styles.serviceIcon}>◇</span>
            <span className={styles.serviceNumber}>03</span>
            <h3 className={styles.serviceTitle}>{t('home.services.card3.title')}</h3>
            <p className={styles.serviceDesc}>
              {t('home.services.card3.body')}
            </p>
          </div>
        </div>
      </section>

      <hr className="section-divider" />

      {/* ===== VIBE SECTION ===== */}
      <section className={styles.vibe} id="vibe">
        <div className={styles.vibeInner}>
          <div className={styles.vibeContent}>
            <p className="section-label">{t('home.vibe.label')}</p>
            <h2 className={styles.vibeTitle}>
              {t('home.vibe.title')}
            </h2>
            <p className={styles.vibeText}>
              {t('home.vibe.p1')}
            </p>
            <p className={styles.vibeText}>
              {t('home.vibe.p2')}
            </p>

            <div className={styles.vibeStats}>
              <div className={styles.stat}>
                <div className={styles.statNumber}>14</div>
                <div className={styles.statLabel}>{t('home.vibe.stat1')}</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statNumber}>100%</div>
                <div className={styles.statLabel}>{t('home.vibe.stat2')}</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statNumber}>0</div>
                <div className={styles.statLabel}>{t('home.vibe.stat3')}</div>
              </div>
            </div>
          </div>

          <div className={styles.vibeVisual}>
            <div className={`glass-card ${styles.codeBlock}`}>
              <span className={styles.codeLine}>
                <span className={styles.codeComment}>{"// build.config.ts"}</span>
              </span>
              <span className={styles.codeLine}>
                <span className={styles.codeKeyword}>export const</span>{" "}
                project = {"{"}
              </span>
              <span className={styles.codeLine}>
                {"  "}type:{" "}
                <span className={styles.codeString}>&quot;any_business_need&quot;</span>,
              </span>
              <span className={styles.codeLine}>
                {"  "}speed:{" "}
                <span className={styles.codeString}>&quot;accelerated&quot;</span>,
              </span>
              <span className={styles.codeLine}>
                {"  "}quality:{" "}
                <span className={styles.codeString}>&quot;production-ready&quot;</span>,
              </span>
              <span className={styles.codeLine}>
                {"  "}limitations:{" "}
                <span className={styles.codeKeyword}>false</span>,
              </span>
              <span className={styles.codeLine}>{"}"}</span>
            </div>
          </div>
        </div>
      </section>

      <hr className="section-divider" />

      {/* ===== FOOTER ===== */}
      <Footer />
    </>
  );
}
