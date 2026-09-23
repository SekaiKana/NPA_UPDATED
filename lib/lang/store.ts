'use client';

export type Lang = 'EN' | 'JP';

const STORAGE_KEY = 'npa:lang';

/**
 * Language preference, as an external store.
 *
 * localStorage is genuinely external state, so it is modelled as a store and
 * read through useSyncExternalStore rather than copied into component state by
 * an effect. That gives a correct server snapshot, keeps every consumer in
 * sync, and means a change in another tab could be wired up later without
 * restructuring anything.
 */

let current: Lang = 'EN';
let hydrated = false;
const listeners = new Set<() => void>();

function read(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'JP' || stored === 'EN' ? stored : 'EN';
  } catch {
    // Private mode or blocked storage — the default is a fine answer.
    return 'EN';
  }
}

export function subscribeLang(listener: () => void): () => void {
  /* First subscription is also when the stored value is pulled in. Doing it
     here rather than at module scope keeps the module import-safe on the
     server, where localStorage does not exist. */
  if (!hydrated) {
    hydrated = true;
    const stored = read();
    if (stored !== current) {
      current = stored;
      queueMicrotask(() => {
        for (const l of listeners) l();
      });
    }
  }

  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLang(): Lang {
  return current;
}

/** The server has no preference to read, so it always renders English. */
export function getServerLang(): Lang {
  return 'EN';
}

export function setLang(next: Lang): void {
  if (current === next) return;
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* non-fatal */
  }
  for (const listener of listeners) listener();
}
