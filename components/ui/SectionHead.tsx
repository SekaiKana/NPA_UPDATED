'use client';

import type { ReactNode } from 'react';
import Reveal from '@/components/motion/Reveal';
import DisplayReveal from '@/components/motion/DisplayReveal';
import Decode from '@/components/motion/Decode';
import styles from './SectionHead.module.css';

/**
 * The label-plus-display pairing that opens every section.
 *
 * Keeping it in one component is what holds the 12:1 size relationship between
 * the small capitals of the label and the serif heading consistent across
 * every page; that ratio is the core of the editorial system and is easy to
 * erode by hand.
 */
export default function SectionHead({
  label,
  title,
  aside,
  size = 'd-md',
  titleClassName = '',
}: {
  label: string;
  title: ReactNode;
  aside?: ReactNode;
  size?: 'd-lg' | 'd-md';
  /** Extra class for the heading, for a section that needs to set it differently. */
  titleClassName?: string;
}) {
  return (
    <div className={`${styles.head} ${aside ? '' : styles.solo}`}>
      <div className={styles.lead}>
        <Reveal>
          <Decode className="label" text={label} />
        </Reveal>
        <DisplayReveal as="h2" className={`display ${size} ${styles.title} ${titleClassName}`}>
          {title}
        </DisplayReveal>
      </div>
      {aside ? <div className={styles.aside}>{aside}</div> : null}
    </div>
  );
}
