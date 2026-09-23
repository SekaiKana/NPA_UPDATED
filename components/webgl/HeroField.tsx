'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import {
  isGlassEnabled,
  registerHeroField,
  subscribeGlassEnabled,
} from '@/lib/webgl/glassStore';
import styles from './HeroField.module.css';

/**
 * Declares that this page wants the 3D hero, and reserves its space.
 *
 * Mounting this is what switches the blob on in the shared canvas: a page
 * opts in by rendering it, rather than the Stage sniffing the pathname. When
 * WebGL is unavailable it draws a still silhouette of the same form instead,
 * so the hero composition never collapses to an empty hole.
 */
export default function HeroField() {
  const ref = useRef<HTMLDivElement>(null);

  const webgl = useSyncExternalStore(
    subscribeGlassEnabled,
    isGlassEnabled,
    () => false
  );

  useEffect(() => {
    if (!ref.current) return;
    return registerHeroField(ref.current);
  }, []);

  return (
    <div ref={ref} className={styles.field} aria-hidden="true">
      {!webgl && (
        /* Still stand-in: the blob's silhouette at rest, filled with the same
           warm-to-cool rim ramp the lit material resolves into. */
        <svg className={styles.fallback} viewBox="0 0 400 400" fill="none">
          <defs>
            <radialGradient id="npa-blob-still" cx="38%" cy="32%" r="78%">
              <stop offset="0%" stopColor="#e0b183" />
              <stop offset="52%" stopColor="#a8754a" />
              <stop offset="100%" stopColor="#2f2a26" />
            </radialGradient>
          </defs>
          <path
            fill="url(#npa-blob-still)"
            d="M200 44c46 0 74 26 100 52s56 50 56 100-34 76-66 102-58 58-96 58-72-30-104-56-52-52-52-102 28-76 58-102S154 44 200 44Z"
          />
        </svg>
      )}
    </div>
  );
}
