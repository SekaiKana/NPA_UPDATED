'use client';

import { useLang } from '@/components/LangContext';
import Reveal from '@/components/motion/Reveal';
import FloatingText from '@/components/motion/FloatingText';
import FogReveal from '@/components/ui/FogReveal';
import DisplayReveal from '@/components/motion/DisplayReveal';
import SectionHead from '@/components/ui/SectionHead';
import IndexRow from '@/components/ui/IndexRow';
import Caliper from '@/components/ui/Caliper';
import Commitment from '@/components/studio/Commitment';
import shell from '../page-shell.module.css';
import styles from './studio.module.css';

const PRINCIPLES = ['1', '2', '3'] as const;

const TEAM = [
  { name: 'Sekai Kanamori', key: 'm1' },
  { name: 'Ryo Kitano', key: 'm2' },
  { name: 'Kosei Nakamura', key: 'm3' },
  { name: 'Rentaro Sato', key: 'm4' },
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
            {/* The haze the cursor wipes clear. Inside the reveal, so the
                paragraph is what it blurs. */}
            <FogReveal>
              <FloatingText className="body" text={t('studio.desc')} />
            </FogReveal>
          </Reveal>
        </div>
      </header>

      {/* ---------- PRINCIPLES ---------- */}
      <section className={`shell ${shell.sectionTight}`}>
        <Reveal>
          <span className="label">{t('studio.principles.label')}</span>
        </Reveal>
        {/* The same instrument the capabilities index carries, so a numbered
            list behaves the same way wherever it appears on the site. */}
        <Caliper
          total={PRINCIPLES.length}
          className={styles.principles}
          revision={PRINCIPLES.map((n) => t(`studio.p${n}.title`)).join('|')}
        >
          <Reveal stagger={0.07}>
            {PRINCIPLES.map((n, i) => (
              <IndexRow
                key={n}
                index={String(i + 1)}
                title={t(`studio.p${n}.title`)}
                body={t(`studio.p${n}.desc`)}
              />
            ))}
          </Reveal>
        </Caliper>
      </section>

      {/* ---------- COMMITMENT ---------- */}
      <Commitment />

      {/* ---------- TEAM ---------- */}
      <section className={`shell ${shell.section}`}>
        <SectionHead label={t('studio.team.label')} title={t('studio.team.title')} />

        <div className={styles.team}>
          {TEAM.map((member, i) => (
            <Reveal key={member.name} delay={i * 0.06} className={styles.member}>
              {/* The index used to sit on the portrait. With the photographs
                  gone it heads the entry, which is where the rest of the site
                  puts a number anyway. */}
              <span className={styles.memberIndex}>{String(i + 1)}</span>
              <h3 className={`display d-sm ${styles.memberName}`}>{member.name}</h3>
              <p className={styles.memberRole}>{t(`studio.${member.key}.title`)}</p>
              <p className={styles.memberBio}>{t(`studio.${member.key}.bio`)}</p>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
