'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import styles from './Navigation.module.css';
import { useLang } from './LangContext';

const navLinks = [
  { href: '/', labelKey: 'nav.home' },
  { href: '/services', labelKey: 'nav.services' },
  { href: '/about', labelKey: 'nav.about' },
  { href: '/case-studies', labelKey: 'nav.caseStudies', disabled: true },
  { href: 'mailto:rentaro.sato@npanalytica.com', labelKey: 'nav.contact' },
];

export default function Navigation() {
  const pathname = usePathname();
  const { lang, setLang, t } = useLang();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const closeMenu = () => setIsMobileMenuOpen(false);

  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        <Link href="/" className={styles.logo} onClick={closeMenu}>
          <Image
            src="/NPA-White.png"
            alt="Neural Point Analytica"
            width={40}
            height={40}
            className={styles.logoIcon}
          />
          <span className={styles.logoText}>Neural Point Analytica</span>
        </Link>

        <div className={styles.links}>
          {navLinks.map((link) =>
            link.disabled ? (
              <span
                key={link.href}
                className={`${styles.link} ${styles.linkDisabled}`}
              >
                {t(link.labelKey)}
              </span>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className={`${styles.link} ${
                  pathname === link.href ? styles.active : ''
                }`}
              >
                {t(link.labelKey)}
              </Link>
            )
          )}
        </div>

        <div className={styles.navRight}>
          <Link href="mailto:rentaro.sato@npanalytica.com" className={styles.cta}>
            {t('nav.cta')}
          </Link>

          <div className={styles.langToggle}>
            <button
              className={`${styles.langOption} ${lang === 'EN' ? styles.langActive : ''}`}
              onClick={() => setLang('EN')}
            >
              EN
            </button>
            <span className={styles.langDivider}>/</span>
            <button
              className={`${styles.langOption} ${lang === 'JP' ? styles.langActive : ''}`}
              onClick={() => setLang('JP')}
            >
              JP
            </button>
          </div>
        </div>

        {/* Hamburger Menu Icon (Mobile Only) */}
        <button
          className={styles.hamburger}
          onClick={() => setIsMobileMenuOpen(true)}
          aria-label="Open menu"
        >
          <span className={styles.hamburgerLine}></span>
          <span className={styles.hamburgerLine}></span>
          <span className={styles.hamburgerLine}></span>
        </button>
      </nav>

      {/* Mobile Menu Overlay */}
      <div className={`${styles.mobileMenuOverlay} ${isMobileMenuOpen ? styles.open : ''}`}>
        <button
          className={styles.closeButton}
          onClick={closeMenu}
          aria-label="Close menu"
        >
          <span className={styles.closeIcon}>&times;</span>
        </button>

        <div className={styles.mobileNavLinks}>
          {navLinks.map((link) =>
            link.disabled ? (
              <span
                key={link.href}
                className={`${styles.mobileLink} ${styles.mobileLinkDisabled}`}
              >
                {t(link.labelKey)}
              </span>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className={`${styles.mobileLink} ${
                  pathname === link.href ? styles.active : ''
                }`}
                onClick={closeMenu}
              >
                {t(link.labelKey)}
              </Link>
            )
          )}
        </div>

        <div className={styles.mobileLangToggle}>
          <button
            className={`${styles.mobileLangOption} ${lang === 'EN' ? styles.langActive : ''}`}
            onClick={() => { setLang('EN'); closeMenu(); }}
          >
            EN
          </button>
          <span className={styles.mobileLangDivider}>/</span>
          <button
            className={`${styles.mobileLangOption} ${lang === 'JP' ? styles.langActive : ''}`}
            onClick={() => { setLang('JP'); closeMenu(); }}
          >
            JP
          </button>
        </div>

        <Link href="mailto:rentaro.sato@npanalytica.com" className={styles.mobileCta} onClick={closeMenu}>
          {t('nav.cta')}
        </Link>
      </div>
    </header>
  );
}
