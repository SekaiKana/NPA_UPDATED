'use client';

import styles from '../app/page.module.css';
import { useLang } from './LangContext';

export default function Footer() {
  const { t } = useLang();

  return (
    <footer className={styles.footer} id="footer">
      <div className={styles.footerInner}>
        <div className={styles.footerBrand}>
          <div className={styles.footerLogo}>
            <img
              src="/NPA-White.png"
              alt="Neural Point Analytica"
              className={styles.footerLogoIcon}
            />
            <span className={styles.footerLogoText}>Neural Point Analytica</span>
          </div>
          <p className={styles.footerTagline}>
            {t('footer.tagline')}
          </p>
        </div>

        <div className={styles.footerLinks}>
          <a href="/services" className={styles.footerLink}>
            {t('footer.services')}
          </a>
          <span className={`${styles.footerLink} ${styles.footerLinkDisabled}`}>
            {t('footer.caseStudies')}
          </span>
          <a href="mailto:rentaro.sato@npanalytica.com" className={styles.footerLink}>
            {t('footer.contact')}
          </a>
        </div>

        <div className={styles.footerRight}>
          <a
            href="mailto:rentaro.sato@npanalytica.com"
            className={styles.footerEmail}
          >
            rentaro.sato@npanalytica.com
          </a>
          <p className={styles.footerCopy}>
            {t('footer.copy')}
          </p>
        </div>
      </div>
    </footer>
  );
}
