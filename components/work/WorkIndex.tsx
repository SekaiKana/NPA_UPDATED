'use client';

/* The preview follows the pointer via direct transform writes. */
 
'use no memo';

import { useEffect, useRef, useState } from 'react';
import { gsap } from '@/lib/motion/gsap';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useLang } from '@/components/LangContext';
import type { WorkItem } from '@/lib/content/work';
import styles from './WorkIndex.module.css';
import fx from '@/components/ui/rowFx.module.css';

/**
 * The work index: a typographic list with a preview panel that tracks the
 * cursor.
 *
 * Built as a list rather than a card grid deliberately. A grid of thumbnails
 * is only as good as its imagery, and NPA has none yet — a list leads with the
 * writing and stays strong whether an entry has a cover or not. When real
 * covers arrive the preview panel starts showing them with no structural
 * change.
 *
 * Placeholder entries are dimmed, badged, and not clickable, so nothing here
 * can be mistaken for a published case study.
 */
export default function WorkIndex({ items }: { items: WorkItem[] }) {
  const { t } = useLang();
  const reduced = usePrefersReducedMotion();
  const previewRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);

  /* Pointer tracking for the floating preview. Bound once for the whole list
     rather than per row, and only on fine pointers. */
  useEffect(() => {
    const node = previewRef.current;
    if (!node || reduced) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;

    const xTo = gsap.quickTo(node, 'x', { duration: 0.65, ease: 'power3.out' });
    const yTo = gsap.quickTo(node, 'y', { duration: 0.65, ease: 'power3.out' });

    const onMove = (e: MouseEvent) => {
      xTo(e.clientX);
      yTo(e.clientY);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [reduced]);

  useEffect(() => {
    const node = previewRef.current;
    if (!node || reduced) return;
    gsap.to(node, {
      autoAlpha: active === null ? 0 : 1,
      scale: active === null ? 0.92 : 1,
      duration: 0.45,
      ease: 'power3.out',
    });
  }, [active, reduced]);

  const activeItem = active === null ? null : items[active];

  return (
    <div className={styles.wrap}>
      <ol className={styles.list}>
        {items.map((item, i) => (
          <li
            key={item.slug}
            className={`${styles.row} ${fx.row} ${
              item.placeholder ? styles.muted : ''
            }`}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
          >
            <span className={`${styles.plate} ${fx.plate}`} aria-hidden="true" />
            <span className={`${styles.index} ${fx.index}`}>
              {String(i + 1).padStart(3, '0')}
            </span>

            <span className={styles.body}>
              <span className={`display d-sm ${fx.title}`}>{item.title}</span>
              <span className={`${styles.summary} ${fx.trail}`}>{item.summary}</span>
              <span className={styles.scope}>
                {item.scope.map((s) => (
                  <span key={s} className={styles.tag}>
                    {s}
                  </span>
                ))}
              </span>
            </span>

            <span className={styles.meta}>
              <span className={styles.metaRow}>
                <span className={styles.metaKey}>{t('work.sector')}</span>
                <span>{item.sector}</span>
              </span>
              <span className={styles.metaRow}>
                <span className={styles.metaKey}>{t('work.year')}</span>
                <span>{item.year}</span>
              </span>
              {item.placeholder && (
                <span className={styles.badge}>{t('work.placeholder.note')}</span>
              )}
            </span>
          </li>
        ))}
      </ol>

      {/* One preview panel for the whole list, reused as the cursor moves. */}
      <div ref={previewRef} className={styles.preview} aria-hidden="true">
        {activeItem?.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={activeItem.cover} alt="" className={styles.previewImg} />
        ) : (
          /* No cover yet: draw a blueprint plate instead of showing an empty
             box or a broken image. */
          <svg viewBox="0 0 320 200" className={styles.previewPlate} fill="none">
            <rect x="0.5" y="0.5" width="319" height="199" stroke="currentColor" opacity="0.4" />
            <path d="M0 40h320M0 160h320M60 0v200M260 0v200" stroke="currentColor" opacity="0.18" />
            <circle cx="160" cy="100" r="46" stroke="currentColor" opacity="0.5" />
            <circle cx="160" cy="100" r="22" stroke="currentColor" opacity="0.3" />
            <path d="M114 100h92M160 54v92" stroke="currentColor" opacity="0.25" />
          </svg>
        )}
      </div>
    </div>
  );
}
