'use client';

import type { ReactNode } from 'react';
import Reveal from '@/components/motion/Reveal';
import DisplayReveal from '@/components/motion/DisplayReveal';
import styles from './SectionHead.module.css';

/**
 * The label-plus-display pairing that opens every section.
 *
 * Keeping it in one component is what holds the 12:1 size relationship between
 * the monospace label and the serif heading consistent across every page —
 * that ratio is the core of the editorial system and is easy to erode by hand.
 */
export default function SectionHead({
  label,
  title,
  aside,
  size = 'd-md',
}: {
  label: string;
  title: ReactNode;
  aside?: ReactNode;
  size?: 'd-lg' | 'd-md';
}) {
  return (
    <div className={styles.head}>
      <div className={styles.lead}>
        <Reveal>
          <span className="label">{label}</span>
        </Reveal>
        <DisplayReveal as="h2" className={`display ${size} ${styles.title}`}>
          {title}
        </DisplayReveal>
      </div>
      {aside ? <div className={styles.aside}>{aside}</div> : null}
    </div>
  );
}
