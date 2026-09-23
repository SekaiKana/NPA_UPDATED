'use client';

import { useEffect, useRef } from 'react';
import { registerHeroField } from '@/lib/webgl/glassStore';
import styles from './HeroField.module.css';

/**
 * Widths that do not get the cluster at all.
 *
 * On a phone the hero is a headline in a short viewport and the cluster has
 * nowhere to sit that is not on top of it — it was already needing a scrim
 * painted under the type to stay readable, which is the tell that it had
 * stopped being the picture and started being in the way. It also happens to
 * be the most expensive thing on the page on the hardware least able to afford
 * it: a physics step, a shadow map and a second render pass per frame, for an
 * image nobody has room to look at.
 *
 * A width rather than a pointer test, because this is about how much room the
 * hero has, not about whether there is a cursor to push the spheres around
 * with. A narrow desktop window is in the same position as a phone here.
 */
const NO_HERO = '(max-width: 720px)';

/**
 * Declares that this page wants the 3D hero, and reserves its space.
 *
 * Mounting this is what switches the cluster on in the shared canvas: a page
 * opts in by rendering it, rather than the Stage sniffing the pathname.
 * Unregistering is the whole off-switch — with no hero field the Stage renders
 * no hero scene, and `HeroClump` unmounts along with its bodies and its
 * shadow-casting lights.
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

  /* The query is read here rather than through `useMediaQuery`, which reports
     false for the server and for the hydrating render. That is the right
     default for a hook that gates an enhancement, and the wrong one here: it
     would register the field, mount the cluster and build its physics world,
     then tear the whole thing down a render later. Inside an effect there is
     no server to disagree with, so the first answer is already the true one. */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const mq = window.matchMedia(NO_HERO);
    let unregister: (() => void) | undefined;

    const sync = () => {
      if (mq.matches) {
        unregister?.();
        unregister = undefined;
      } else {
        unregister ??= registerHeroField(el);
      }
    };

    sync();
    mq.addEventListener('change', sync);

    return () => {
      mq.removeEventListener('change', sync);
      unregister?.();
    };
  }, []);

  return (
    <div ref={ref} className={styles.field} aria-hidden="true" />
  );
}
