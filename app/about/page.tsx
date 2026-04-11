'use client';

import Image from "next/image";
import styles from "../subpage.module.css";
import aboutStyles from "./about.module.css";
import CommitmentTabs from "./CommitmentTabs";
import { useLang } from "@/components/LangContext";

export default function About() {
  const { t } = useLang();

  const teamMembers = [
    {
      image: "/IMG_Sekai.jpeg",
      name: "Sekai Kanamori",
      titleKey: "about.team.member1.title",
      bioKey: "about.team.member1.bio",
    },
    {
      image: "/IMG_Ryo.png",
      name: "Ryo Kitano",
      titleKey: "about.team.member2.title",
      bioKey: "about.team.member2.bio",
    },
    {
      image: "/IMG_Kosei.jpg",
      name: "Kosei Nakamura",
      titleKey: "about.team.member3.title",
      bioKey: "about.team.member3.bio",
    },
    {
      image: "/IMG_Rentaroo.jpg",
      name: "Rentaro Sato",
      titleKey: "about.team.member4.title",
      bioKey: "about.team.member4.bio",
    },
  ];

  return (
    <>
      {/* ===== EXISTING HERO ===== */}
      <div className={styles.pageShell}>
        <p className={styles.pageLabel}>{t('about.label')}</p>
        <h1 className={styles.pageTitle}>{t('about.title')}</h1>
        <p className={styles.pageDesc}>
          {t('about.desc')}
        </p>

        <div className={styles.pageCardGrid}>
          <div className={`glass-card ${styles.pageCard}`}>
            <h3 className={styles.pageCardTitle}>{t('about.card1.title')}</h3>
            <p className={styles.pageCardDesc}>
              {t('about.card1.desc')}
            </p>
          </div>
          <div className={`glass-card ${styles.pageCard}`}>
            <h3 className={styles.pageCardTitle}>{t('about.card2.title')}</h3>
            <p className={styles.pageCardDesc}>
              {t('about.card2.desc')}
            </p>
          </div>
          <div className={`glass-card ${styles.pageCard}`}>
            <h3 className={styles.pageCardTitle}>{t('about.card3.title')}</h3>
            <p className={styles.pageCardDesc}>
              {t('about.card3.desc')}
            </p>
          </div>
        </div>
      </div>

      <hr className="section-divider" />

      {/* ===== COMMITMENT TABS ===== */}
      <CommitmentTabs />

      <hr className="section-divider" />

      {/* ===== TEAM GRID ===== */}
      <section className={aboutStyles.team}>
        <h2 className={aboutStyles.teamTitle}>{t('about.team.sectionTitle')}</h2>

        <div className={aboutStyles.teamGrid}>
          {teamMembers.map((member) => (
            <div
              key={member.name}
              className={`glass-card ${aboutStyles.memberCard}`}
            >
              <div className={aboutStyles.memberImageWrap}>
                <Image
                  src={member.image}
                  alt={member.name}
                  width={280}
                  height={280}
                  className={aboutStyles.memberImage}
                />
              </div>
              <h3 className={aboutStyles.memberName}>{member.name}</h3>
              <p className={aboutStyles.memberTitle}>{t(member.titleKey)}</p>
              <p className={aboutStyles.memberBio}>{t(member.bioKey)}</p>
            </div>
          ))}
        </div>
      </section>

      <hr className="section-divider" />

      {/* ===== CTA ===== */}
      <section className={aboutStyles.cta}>
        <h2 className={aboutStyles.ctaTitle}>{t('about.cta.title')}</h2>
        <a
          href="mailto:rentaro.sato@npanalytica.com"
          className={aboutStyles.ctaButton}
        >
          {t('about.cta.btn')} <span className="arrow">→</span>
        </a>
      </section>
    </>
  );
}
