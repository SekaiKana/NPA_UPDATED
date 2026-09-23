'use client';

import Image from 'next/image';
import { useLang } from '@/components/LangContext';
import Reveal from '@/components/motion/Reveal';
import FloatingText from '@/components/motion/FloatingText';
import DisplayReveal from '@/components/motion/DisplayReveal';
import SectionHead from '@/components/ui/SectionHead';
import IndexRow from '@/components/ui/IndexRow';
import Commitment from '@/components/studio/Commitment';
import ContactSheet from '@/components/studio/ContactSheet';
import shell from '../page-shell.module.css';
import styles from './studio.module.css';

const PRINCIPLES = ['1', '2', '3'] as const;

const TEAM = [
  { image: '/IMG_Sekai.jpeg', name: 'Sekai Kanamori', key: 'm1' },
  { image: '/IMG_Ryo.png', name: 'Ryo Kitano', key: 'm2' },
  { image: '/IMG_Kosei.jpg', name: 'Kosei Nakamura', key: 'm3' },
  { image: '/IMG_Rentaroo.jpg', name: 'Rentaro Sato', key: 'm4' },
];

export default function StudioPage() {
  const { t } = useLang();

  return (
    <>
      <header className={`shell ${shell.masthead}`}>
        <div className={shell.mastheadInner}>
          <div className={shell.mastLead}>
            <Reveal>
              <span className="label">{t('studio.label')}</span>
            </Reveal>
            <DisplayReveal as="h1" className={`display d-lg ${shell.title}`}>
              {t('studio.title')}
            </DisplayReveal>
          </div>
          <Reveal delay={0.12} className={shell.lead}>
            <FloatingText className="body" text={t('studio.desc')} />
          </Reveal>
        </div>
      </header>

      {/* ---------- PRINCIPLES ---------- */}
      <section className={`shell ${shell.sectionTight}`}>
        <Reveal>
          <span className="label">{t('studio.principles.label')}</span>
        </Reveal>
        <Reveal className={styles.principles} stagger={0.07}>
          {PRINCIPLES.map((n, i) => (
            <IndexRow
              key={n}
              index={String(i + 1).padStart(3, '0')}
              title={t(`studio.p${n}.title`)}
              body={t(`studio.p${n}.desc`)}
            />
          ))}
        </Reveal>
      </section>

      {/* ---------- COMMITMENT ---------- */}
      <Commitment />

      {/* ---------- TEAM ---------- */}
      <section className={`shell ${shell.section}`}>
        <SectionHead label={t('studio.team.label')} title={t('studio.team.title')} />

        <ContactSheet className={styles.team}>
          {TEAM.map((member, i) => (
            <Reveal key={member.name} delay={i * 0.06} className={styles.member}>
              <div className={styles.portrait}>
                <Image
                  src={member.image}
                  alt={member.name}
                  width={520}
                  height={650}
                  className={styles.portraitImg}
                  sizes="(max-width: 880px) 50vw, 25vw"
                />
                <span className={styles.portraitIndex}>
                  {String(i + 1).padStart(2, '0')}
                </span>
              </div>
              <h3 className={`display d-sm ${styles.memberName}`}>{member.name}</h3>
              <p className={styles.memberRole}>{t(`studio.${member.key}.title`)}</p>
              <p className={styles.memberBio}>{t(`studio.${member.key}.bio`)}</p>
            </Reveal>
          ))}
        </ContactSheet>
      </section>
    </>
  );
}
