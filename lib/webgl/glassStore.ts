/**
 * Registry linking DOM glass panels to their WebGL counterparts.
 *
 * A module-level store rather than React context on purpose: the Stage lives
 * inside an R3F <Canvas>, which is a separate reconciler root, so context from
 * the DOM tree does not reach it. A plain store crosses that boundary without
 * a context bridge.
 *
 * Rects are read imperatively inside the render loop rather than pushed
 * through React state — they change on every scroll frame, and re-rendering
 * the tree at 60fps to move a quad would be absurd.
 */

export type GlassShape = 'rounded' | 'pill' | 'circle';

export interface GlassSurfaceEntry {
  id: number;
  element: HTMLElement;
  radius: number;
  shape: GlassShape;
  /** 0–1. How much the panel milks over what it refracts. */
  tint: number;
  /** Live rect in CSS pixels, refreshed each frame by GlassLayer. */
  rect: DOMRect | null;
  /**
   * Nearest ancestor whose inline opacity is animating this panel in, if any.
   * Resolved once at registration; read per frame off `.style.opacity`, which
   * is a plain property lookup and forces no style recalculation.
   */
  revealDriver: HTMLElement | null;
}

type Listener = () => void;

let nextId = 1;
const surfaces = new Map<number, GlassSurfaceEntry>();
const listeners = new Set<Listener>();

/** Bumped only when the *set* of surfaces changes, never when rects move. */
let version = 0;

function emit() {
  version += 1;
  for (const listener of listeners) listener();
}

export function registerGlassSurface(
  element: HTMLElement,
  options: { radius: number; shape: GlassShape; tint: number }
): () => void {
  const id = nextId++;
  surfaces.set(id, {
    id,
    element,
    rect: null,
    revealDriver: element.closest<HTMLElement>('[data-reveal]'),
    ...options,
  });
  emit();

  return () => {
    surfaces.delete(id);
    emit();
  };
}

export function subscribeGlass(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getGlassVersion(): number {
  return version;
}

/** Live view of the registry. Not a copy — the render loop mutates `rect`. */
export function getGlassSurfaces(): GlassSurfaceEntry[] {
  return Array.from(surfaces.values());
}

/* ---------------------------------------------------------------------------
 * Whether the WebGL glass layer is actually live.
 *
 * GlassSurface needs this to choose its treatment: with WebGL behind it the
 * panel drops backdrop-filter and goes flat-translucent so the refraction
 * underneath shows through; without it, backdrop-filter does the work. Doing
 * both would blur the refraction and pay for it twice.
 * ------------------------------------------------------------------------ */

let glassEnabled = false;
const glassEnabledListeners = new Set<Listener>();

export function setGlassEnabled(enabled: boolean) {
  if (glassEnabled === enabled) return;
  glassEnabled = enabled;
  for (const listener of glassEnabledListeners) listener();
}

export function subscribeGlassEnabled(listener: Listener): () => void {
  glassEnabledListeners.add(listener);
  return () => glassEnabledListeners.delete(listener);
}

export function isGlassEnabled(): boolean {
  return glassEnabled;
}

/* ---------------------------------------------------------------------------
 * The hero schematic.
 *
 * A page declares that it wants the 3D hero by mounting <HeroField/>, which
 * registers the DOM element the scene should centre itself on. Same principle
 * as the glass panels: layout stays in CSS, WebGL follows.
 * ------------------------------------------------------------------------ */

let heroElement: HTMLElement | null = null;
const heroListeners = new Set<Listener>();
let heroVersion = 0;

function emitHero() {
  heroVersion += 1;
  for (const listener of heroListeners) listener();
}

export function registerHeroField(element: HTMLElement): () => void {
  heroElement = element;
  emitHero();
  return () => {
    if (heroElement === element) heroElement = null;
    emitHero();
  };
}

export function subscribeHeroField(listener: Listener): () => void {
  heroListeners.add(listener);
  return () => heroListeners.delete(listener);
}

export function getHeroFieldVersion(): number {
  return heroVersion;
}

export function getHeroFieldElement(): HTMLElement | null {
  return heroElement;
}
