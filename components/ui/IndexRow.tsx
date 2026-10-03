'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useDrawn } from '@/hooks/useDrawn';
import styles from './IndexRow.module.css';
import fx from './rowFx.module.css';

interface IndexRowProps {
  index: string;
  title: string;
  body?: ReactNode;
  meta?: ReactNode;
  /** Rendered as an interactive row with a trailing arrow. */
  onActivate?: () => void;
  /** Dims the row and marks it as not yet linkable. */
  muted?: boolean;
  mutedNote?: string;
}

/**
 * A numbered index row — the site's main structural unit.
 *
 * Capabilities, work and principles are all the same object: an index number,
 * a display title, supporting copy, and a rule.
 *
 * The hover and focus behaviour lives in `rowFx.module.css` and is shared with
 * every other list on the site. It used to be a GSAP wipe driven from
 * `onMouseEnter`, which is why it did nothing at all for anyone navigating by
 * keyboard: there is no mouse event to hang it on. Expressed as state on the
 * row, both inputs light the same row the same way and neither is written
 * twice.
 */
export default function IndexRow({
  index,
  title,
  body,
  meta,
  onActivate,
  muted = false,
  mutedNote,
}: IndexRowProps) {
  const interactive = Boolean(onActivate) && !muted;
  /* The row's rules are ruled in as it arrives; see IndexRow.module.css.
     Rows that arrive together draw a beat apart, in reading order. */
  const rowRef = useDrawn<HTMLDivElement>();
  const drawDelay = `${Math.min(Math.max(Number(index) - 1, 0), 5) * 0.07}s`;

  const content = (
    <>
      <span className={fx.plate} aria-hidden="true" />
      <span className={`${styles.index} ${fx.index}`}>{index}</span>
      <span className={styles.main}>
        <span className={`display d-sm ${fx.title}`}>{title}</span>
        {body ? <span className={`${styles.body} ${fx.trail}`}>{body}</span> : null}
      </span>
      <span className={styles.meta}>
        {muted && mutedNote ? <span className={styles.note}>{mutedNote}</span> : meta}
        {interactive ? (
          <span className={`${styles.arrow} ${fx.arrow}`} aria-hidden="true">
            &#8594;
          </span>
        ) : null}
      </span>
    </>
  );

  return (
    <div
      ref={rowRef}
      style={{ '--draw-delay': drawDelay } as CSSProperties}
      /* A hook for anything that needs to find the rows of a list without
         reaching into this module's hashed class names. The capabilities
         caliper measures against it. */
      data-index-row=""
      className={`${styles.row} ${muted ? styles.muted : ''} ${
        /* Every row that is not a placeholder responds, including the ones
           that are read rather than clicked — capabilities and the studio
           principles are lists to run your eye down, and highlighting the one
           under the cursor is what they want from this. What separates those
           from a row that goes somewhere is the trailing arrow and the view
           cursor, neither of which they get, so the affordance still only
           appears where there is something to click.

           Muted rows stay inert on purpose: a placeholder that lifted under
           the cursor would be promising a destination it does not have. */
        muted ? '' : fx.row
      }`}
    >
      {interactive ? (
        <button
          type="button"
          className={`${styles.hit} ${fx.hit}`}
          onClick={onActivate}
          data-cursor="view"
        >
          {content}
        </button>
      ) : (
        <div className={styles.hit}>{content}</div>
      )}
    </div>
  );
}
