'use client';

/* The loop writes custom properties to the frames directly. */

'use no memo';

import { useState, type ReactNode } from 'react';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

/** Peak drift of the photograph inside its frame, px. */
const SHIFT = 9;
/** How much the photograph grows while its frame is under the cursor. */
const SCALE = 0.038;
/** Approach rate of the easing, per second. Higher is snappier. */
const RATE = 9;

/**
 * Gives each portrait depth inside its own frame.
 *
 * The photograph drifts a few pixels *against* the cursor while the frame stays
 * put, which is what reading as glass depends on: move the picture with the
 * pointer and it reads as a sticker being dragged; move it against, and the
 * frame becomes a window onto something sitting behind it. Paired with the
 * neighbouring frames receding — which is the page's own stylesheet, next to
 * the grid it applies to — the section behaves like a contact sheet with a
 * loupe over one frame.
 *
 * It is the studio page's counterpart to the caliper on capabilities, and
 * deliberately the opposite mechanic: the caliper is one object travelling
 * between rows, this is depth inside something that never moves.
 *
 * ---- Why custom properties rather than GSAP ----
 * The photograph already carries a CSS `transform`. Writing a second transform
 * to the same node from GSAP does not compose — the inline style simply wins
 * and the other silently stops happening, which is exactly the class of bug
 * that is invisible until someone notices the hover has stopped working. So
 * nothing here writes `transform` at all: the loop sets `--px`, `--py` and
 * `--pscale`, and the stylesheet composes them into the single transform it
 * already owned.
 *
 * The easing is a plain exponential approach rather than a tween, because the
 * target moves every pointer event; starting a fresh tween at that frequency is
 * the usual reason an effect like this feels sluggish.
 */
export default function ContactSheet({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const reduced = usePrefersReducedMotion();

  useIsomorphicLayoutEffect(() => {
    if (!root || reduced) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    /* Each direct child is one member. Read from the DOM rather than from props
       so the markup in the page stays exactly what it was. */
    const frames = Array.from(root.children) as HTMLElement[];
    if (frames.length === 0) return;

    const state = frames.map(() => ({ x: 0, y: 0, s: 0, tx: 0, ty: 0, ts: 0 }));

    let raf = 0;
    let last = performance.now();
    let running = false;

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;

      let moving = false;
      for (let i = 0; i < frames.length; i += 1) {
        const s = state[i];
        const k = 1 - Math.exp(-RATE * dt);
        s.x += (s.tx - s.x) * k;
        s.y += (s.ty - s.y) * k;
        s.s += (s.ts - s.s) * k;

        if (
          Math.abs(s.tx - s.x) > 0.01 ||
          Math.abs(s.ty - s.y) > 0.01 ||
          Math.abs(s.ts - s.s) > 0.0002
        ) {
          moving = true;
        }

        const el = frames[i];
        el.style.setProperty('--px', `${s.x.toFixed(2)}px`);
        el.style.setProperty('--py', `${s.y.toFixed(2)}px`);
        el.style.setProperty('--pscale', (1 + s.s).toFixed(4));
      }

      if (moving) {
        raf = requestAnimationFrame(tick);
      } else {
        running = false;
      }
    };

    const start = () => {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      for (let i = 0; i < frames.length; i += 1) {
        const r = frames[i].getBoundingClientRect();
        const inside =
          e.clientX >= r.left &&
          e.clientX <= r.right &&
          e.clientY >= r.top &&
          e.clientY <= r.bottom;

        if (inside) {
          /* Normalised to -1..1 from the frame's centre, then negated: the
             picture goes the other way from the hand. */
          const nx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
          const ny = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
          state[i].tx = -nx * SHIFT;
          state[i].ty = -ny * SHIFT;
          state[i].ts = SCALE;
        } else {
          state[i].tx = 0;
          state[i].ty = 0;
          state[i].ts = 0;
        }
      }
      start();
    };

    const onLeave = () => {
      for (const s of state) {
        s.tx = 0;
        s.ty = 0;
        s.ts = 0;
      }
      start();
    };

    root.addEventListener('pointermove', onMove, { passive: true });
    root.addEventListener('pointerleave', onLeave, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerleave', onLeave);
      for (const el of frames) {
        el.style.removeProperty('--px');
        el.style.removeProperty('--py');
        el.style.removeProperty('--pscale');
      }
    };
  }, [root, reduced]);

  return (
    <div ref={setRoot} className={className}>
      {children}
    </div>
  );
}
