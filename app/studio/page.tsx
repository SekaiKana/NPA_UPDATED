'use client';

import { useLang } from '@/components/LangContext';
import Reveal from '@/components/motion/Reveal';
import FloatingText from '@/components/motion/FloatingText';
import FogReveal from '@/components/ui/FogReveal';
import LinkedInMark from '@/components/ui/LinkedInMark';
import DisplayReveal from '@/components/motion/DisplayReveal';
import SectionHead from '@/components/ui/SectionHead';
import IndexRow from '@/components/ui/IndexRow';
import Caliper from '@/components/ui/Caliper';
import Commitment from '@/components/studio/Commitment';
import shell from '../page-shell.module.css';
import styles from './studio.module.css';

const PRINCIPLES = ['1', '2', '3'] as const;

/* `linkedin` is optional and Rentaro has none on purpose: no profile was
   given for him, and a guessed URL on a named person is worse than no link. */
const TEAM: { name: string; key: string; linkedin?: string }[] = [
  {
    name: 'Sekai Kanamori',
    key: 'm1',
    // Supplied without a scheme; an href without one is read as a relative path.
    linkedin: 'https://www.linkedin.com/in/sekaimiller',
  },
  { name: 'Ryo Kitano', key: 'm2', linkedin: 'https://www.linkedin.com/in/ryo-kitano/' },
  {
    name: 'Kosei Nakamura',
    key: 'm3',
    linkedin: 'https://www.linkedin.com/in/kosei-nakamura-5a27b935b/',
  },
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
              {member.linkedin ? (
                <a
                  className={styles.memberLink}
                  href={member.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  /* Four entries would otherwise give a screen reader four
                     links all called "LinkedIn" with nothing to tell them
                     apart. The visible label stays short. */
                  aria-label={`${member.name} on LinkedIn`}
                >
                  <LinkedInMark className={styles.memberMark} />
                  <span className="link-u">{t('studio.linkedin')}</span>
                  <span aria-hidden="true"> &#8599;</span>
                </a>
              ) : null}
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
