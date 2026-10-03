'use client';

/**
 * Whether something is covering the page: the intro on a first visit, or the
 * shutters of a route change.
 *
 * Both used to cover a page that was already playing its opening. The hero's
 * headline rose, the masthead of a new route rose, the labels decoded, all
 * behind an opaque panel, so by the time the panel lifted there was nothing
 * left to see arrive. Anything that animates in on arrival asks here first and
 * waits for the lift, which turns the cover and the page into one move: the
 * curtain goes up and the page comes in behind it.
 *
 * A plain module store rather than context, for the same reason as the WebGL
 * registries: it is read from effects all over the tree, and nothing about it
 * should ever cause a render.
 */

type Listener = () => void;

const STORAGE_KEY = 'npa:intro-seen';

/* The intro decides whether to play only after hydration, which is after the
   hero has already started its reveal. So the store works the answer out for
   itself, from the same two facts, the moment the module first runs. */
function introWillPlay(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  try {
    return sessionStorage.getItem(STORAGE_KEY) !== '1';
  } catch {
    // Storage blocked: the intro shows in that case too.
    return true;
  }
}

let covered = introWillPlay();
const waiting = new Set<Listener>();

/* Never strand a page behind a curtain that has gone away without saying so.
   The intro's own ceiling is a little over five seconds. */
let failsafe = 0;
function armFailsafe(ms: number) {
  if (typeof window === 'undefined') return;
  window.clearTimeout(failsafe);
  failsafe = window.setTimeout(() => setCovered(false), ms);
}
if (covered) armFailsafe(7500);

export function isCovered(): boolean {
  return covered;
}

export function setCovered(next: boolean) {
  if (next) armFailsafe(4500);
  else if (typeof window !== 'undefined') window.clearTimeout(failsafe);
  if (covered === next) return;
  covered = next;
  if (!next) {
    const run = Array.from(waiting);
    waiting.clear();
    for (const fn of run) fn();
  }
}

/**
 * Runs `fn` now if nothing is covering the page, otherwise the moment the
 * cover starts to lift. Returns a cancel for effect cleanups.
 */
export function whenUncovered(fn: Listener): () => void {
  if (!covered) {
    fn();
    return () => {};
  }
  waiting.add(fn);
  return () => {
    waiting.delete(fn);
  };
}
