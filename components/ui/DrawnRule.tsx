'use client';

import type { CSSProperties } from 'react';
import { useDrawn } from '@/hooks/useDrawn';
import styles from './DrawnRule.module.css';

/**
 * A hairline along the top edge of its (positioned) parent that rules itself
 * in when it comes into view. Stands in for a `border-top` where a component
 * cannot draw its own, as on the team entries and the contact columns.
 */
export default function DrawnRule({
  delay = 0,
  strong = false,
}: {
  /** Seconds after it comes into view. */
  delay?: number;
  /** The darker rule, for a line that closes a group rather than divides it. */
  strong?: boolean;
}) {
  const ref = useDrawn<HTMLSpanElement>();
  return (
    <span
      ref={ref}
      aria-hidden="true"
      className={`${styles.rule} ${strong ? styles.strong : ''}`}
      style={{ '--draw-delay': `${delay}s` } as CSSProperties}
    />
  );
}
