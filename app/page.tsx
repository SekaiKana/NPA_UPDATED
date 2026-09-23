'use client';

import { useLang } from '@/components/LangContext';
import { TransitionLink, useTransitionNav } from '@/components/motion/PageTransition';
import DisplayReveal from '@/components/motion/DisplayReveal';
import Reveal from '@/components/motion/Reveal';
import Magnetic from '@/components/motion/Magnetic';
import HeroField from '@/components/webgl/HeroField';
import SectionHead from '@/components/ui/SectionHead';
import IndexRow from '@/components/ui/IndexRow';
import ScrollStatement from '@/components/home/ScrollStatement';
import CountUp from '@/components/motion/CountUp';
import GlassSurface from '@/components/glass/GlassSurface';
import styles from './home.module.css';

/** The three the homepage leads with; /capabilities carries all six. */
const LEAD_CAPABILITIES = ['1', '2', '3'] as const;

const SPECS = ['1', '2', '3'] as const;

export default function Home() {
  const { t } = useLang();
  const { navigate } = useTransitionNav();

  return (
    <>
      {/* ---------- HERO ---------- */}
      <section className={`${styles.hero} invert invert-stage`} data-hero-stage>
        <HeroField />

        <div className={`shell ${styles.heroInner}`}>
          <h1 className={`display d-xl ${styles.heroTitle}`}>
            <DisplayReveal immediate delay={0.15}>
              {t('home.hero.l1')}
            </DisplayReveal>
            <DisplayReveal immediate delay={0.24}>
              {t('home.hero.l2')}
            </DisplayReveal>
            <DisplayReveal immediate delay={0.33} className={styles.heroAccent}>
              {t('home.hero.l3')}
            </DisplayReveal>
          </h1>

          <div className={styles.heroFoot}>
            <Reveal delay={0.5}>
              <p className="body-lg">{t('home.hero.sub')}</p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ---------- STATEMENT ---------- */}
      <ScrollStatement
        label={t('home.statement.label')}
        body={t('home.statement.body')}
      />

      {/* ---------- CAPABILITIES ---------- */}
      <section className={`shell ${styles.section}`} id="capabilities">
        <SectionHead
          label={t('home.cap.label')}
          title={t('home.cap.title')}
          aside={
            <Magnetic>
              <TransitionLink href="/capabilities" className={styles.asideLink}>
                <span className="link-u">{t('home.cap.link')}</span>
                <span aria-hidden="true"> &#8594;</span>
              </TransitionLink>
            </Magnetic>
          }
        />

        <div className={styles.index}>
          {LEAD_CAPABILITIES.map((n, i) => (
            <IndexRow
              key={n}
              index={String(i + 1).padStart(3, '0')}
              title={t(`cap.${n}.title`)}
              body={t(`cap.${n}.desc`)}
              onActivate={() => navigate('/capabilities')}
            />
          ))}
        </div>
      </section>

      {/* ---------- THE EDGE ---------- */}
      <section className={`shell ${styles.section}`} id="approach">
        <div className={styles.approach}>
          <div className={styles.approachLead}>
            <Reveal>
              <span className="label">{t('home.approach.label')}</span>
            </Reveal>
            <DisplayReveal as="h2" className={`display d-md ${styles.approachTitle}`}>
              {t('home.approach.title')}
            </DisplayReveal>
            <Reveal delay={0.1}>
              <p className="body">{t('home.approach.body')}</p>
            </Reveal>
          </div>

          {/* The three claims as a spec table rather than stat cards — reads
              as a datasheet, which is the register the whole site is in. */}
          {/* The datasheet sits on a glass plate: with WebGL live this is a
              real refraction of the field moving behind the page, not a
              backdrop-filter blur. GlassSurface falls back to the blur on
              its own where WebGL is unavailable. */}
          <GlassSurface className={styles.specPanel} radius={3} tint={0.5}>
            <Reveal className={styles.specs} stagger={0.09}>
              {SPECS.map((n) => (
                <div key={n} className={styles.spec}>
                  <CountUp
                    value={t(`home.spec${n}.value`)}
                    className={styles.specValue}
                  />
                  <span className={styles.specUnit}>{t(`home.spec${n}.unit`)}</span>
                  <span className={styles.specLabel}>{t(`home.spec${n}.label`)}</span>
                </div>
              ))}
            </Reveal>
          </GlassSurface>
        </div>
      </section>
    </>
  );
}
