'use client';

/* The timeline writes to DOM nodes directly. */

'use no memo';

import { useRef } from 'react';
import { gsap, SplitText } from '@/lib/motion/gsap';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import styles from './ScrollStatement.module.css';

/**
 * The statement band: a large claim that resolves word by word as it is
 * scrolled through.
 *
 * This is the site's one piece of genuinely scroll-*driven* motion rather than
 * scroll-*triggered* — the progress of the reveal is tied to scroll position,
 * so the visitor is doing the revealing. Used exactly once per page; it is a
 * strong effect and repeating it would cheapen it.
 *
 * Deliberately NOT pinned. Pinning reparents this section into a ScrollTrigger
 * `.pin-spacer`, which is a DOM mutation React knows nothing about — on a route
 * change React then fails to remove a node it no longer owns. Scrubbing across
 * the section's own travel reads almost identically and keeps the DOM stable.
 */
export default function ScrollStatement({
  label,
  body,
}: {
  label: string;
  body: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const ruleRef = useRef<HTMLSpanElement>(null);
  const reduced = usePrefersReducedMotion();

  useIsomorphicLayoutEffect(() => {
    const section = sectionRef.current;
    const text = textRef.current;
    if (!section || !text || reduced) return;

    const ctx = gsap.context(() => {
      const split = new SplitText(text, {
        type: 'words',
        wordsClass: styles.word,
      });

      /* Words resolve out of the ground rather than simply fading: a little
         lift and blur on the way in gives the line some depth without
         costing a layout pass. */
      gsap.fromTo(
        split.words,
        { opacity: 0.12, yPercent: 26, filter: 'blur(6px)' },
        {
          opacity: 1,
          yPercent: 0,
          filter: 'blur(0px)',
          ease: 'none',
          stagger: 0.4,
          scrollTrigger: {
            /* Keyed to the TEXT, not the section.
               The section carries ~14rem of padding above the copy, so
               starting from its top edge began the reveal while the words
               themselves were still a screen below the fold — by the time
               they appeared most of the animation had already run. Measuring
               from the paragraph means the reveal starts as the words enter
               and finishes as they settle near the middle. */
            trigger: text,
            start: 'top 82%',
            end: 'center 55%',
            scrub: 0.6,
          },
        }
      );

      if (ruleRef.current) {
        gsap.fromTo(
          ruleRef.current,
          { scaleX: 0 },
          {
            scaleX: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: text,
              start: 'top 82%',
              end: 'center 55%',
              scrub: 0.6,
            },
          }
        );
      }
    }, section);

    // One revert: the context owns the SplitText it created.
    return () => ctx.revert();
  }, [reduced]);

  return (
    <section ref={sectionRef} className={styles.section}>
      <div className={`shell ${styles.inner}`}>
        <span className={`label ${styles.label}`}>{label}</span>
        <p ref={textRef} className={`display d-lg ${styles.text}`}>
          {body}
        </p>
        <span ref={ruleRef} className={styles.rule} aria-hidden="true" />
      </div>
    </section>
  );
}
