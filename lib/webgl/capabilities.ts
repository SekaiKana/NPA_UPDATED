/**
 * Device capability probing for the WebGL Stage.
 *
 * Everything here is browser-only and must be called from an effect — the
 * server has no answers and guessing produces a hydration mismatch.
 */

export type DeviceTier = 'none' | 'low' | 'high';

/**
 * One-shot WebGL2 probe. Creates a throwaway context and immediately
 * releases it via WEBGL_lose_context, so probing never counts against the
 * browser's per-page context budget.
 */
export function supportsWebGL2(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Classify the device.
 *
 *   'none' — render nothing but the static CSS backdrop.
 *   'low'  — mount the Stage, but at reduced pixel density and mote count,
 *            with glass falling back to CSS backdrop-filter.
 *   'high' — the full treatment.
 *
 * Reduced motion outranks everything: a user who asked for stillness gets
 * the static plate regardless of how fast their machine is.
 */
export function getDeviceTier(): DeviceTier {
  if (typeof window === 'undefined') return 'none';
  if (prefersReducedMotion()) return 'none';
  if (!supportsWebGL2()) return 'none';

  const cores = navigator.hardwareConcurrency ?? 4;
  // Non-standard but widely supported on the Chromium devices that matter here.
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const narrow = window.innerWidth < 768;

  if (cores <= 4 || memory <= 4) return 'low';
  if (coarsePointer || narrow) return 'low';

  return 'high';
}

/** Renderer settings derived from the tier. */
export function tierSettings(tier: DeviceTier) {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
  switch (tier) {
    case 'high':
      /* A floor of 1.5, not just a ceiling. On a 1x display the old
         `min(dpr, 1.75)` resolved to exactly 1, so the canvas rendered one
         sample per CSS pixel — MSAA alone cannot keep a white silhouette
         against a near-black ground from looking hard-edged at that density.
         Rendering above the display and letting the browser downsample is
         supersampling, and it is what actually softens the contour. */
      return {
        pixelDensity: Math.max(1.5, Math.min(dpr, 1.75)),
        motes: 25_000,
        glassWebGL: true,
      };
    case 'low':
      return { pixelDensity: Math.min(dpr, 1), motes: 8_000, glassWebGL: false };
    default:
      return { pixelDensity: 1, motes: 0, glassWebGL: false };
  }
}
