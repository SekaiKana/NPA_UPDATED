'use client';

import { useEffect, useRef } from 'react';
import { registerHeroField } from '@/lib/webgl/glassStore';
import styles from './HeroField.module.css';

/**
 * Declares that this page wants the 3D hero, and reserves its space.
 *
 * Mounting this is what switches the cluster on in the shared canvas: a page
 * opts in by rendering it, rather than the Stage sniffing the pathname.
 *
 * It draws nothing itself. There used to be a still SVG stand-in here for the
 * case where WebGL is unavailable, and it was a bug rather than a fallback:
 * `glassEnabled` starts false, so the stand-in was in the server HTML and
 * every visitor saw a brown blob on first paint, which then vanished once the
 * canvas came up. A fallback that is wrong far more often than it is right is
 * worse than none, and the hero still has its headline and the page's ground
 * behind it.
 */
export default function HeroField() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    return registerHeroField(ref.current);
  }, []);

  return (
    <div ref={ref} className={styles.field} aria-hidden="true" />
  );
}
