'use client';

import { useEffect, useRef, useSyncExternalStore, type CSSProperties } from 'react';
import {
  isGlassEnabled,
  registerGlassSurface,
  subscribeGlassEnabled,
  type GlassShape,
} from '@/lib/webgl/glassStore';
import { WEBGL_GLASS_TINT } from '@/lib/webgl/glass/refraction';

export interface GlassPanelOptions {
  shape?: GlassShape;
  /** Corner radius in px. Ignored for pills, which are always half-height. */
  radius?: number;
  /**
   * 0–1. Opacity of the white plate the copy sits on. This is the legibility
   * control: body text measures against this, never against refraction alone.
   */
  tint?: number;
}

/**
 * Shared behaviour for every glass panel.
 *
 * Returns props to spread onto the element. When the WebGL Stage is live the
 * element also registers itself so GlassLayer can draw real refraction behind
 * it; otherwise it falls back to `backdrop-filter`, which refracts nothing but
 * still reads as glass.
 */
export function useGlassPanel<T extends HTMLElement>({
  shape = 'rounded',
  radius = 20,
  tint = 0.62,
}: GlassPanelOptions = {}) {
  const ref = useRef<T>(null);

  const webglGlass = useSyncExternalStore(
    subscribeGlassEnabled,
    isGlassEnabled,
    () => false
  );

  useEffect(() => {
    if (!webglGlass || !ref.current) return;
    /* The WebGL quad stays near-clear and contributes refraction, dispersion
       and rim light only; the white plate above it does all the milking.
       Tinting in both places would compound into opacity. */
    return registerGlassSurface(ref.current, {
      radius,
      shape,
      tint: WEBGL_GLASS_TINT,
    });
  }, [webglGlass, radius, shape]);

  return {
    ref,
    'data-glass': webglGlass ? 'webgl' : 'css',
    style: {
      borderRadius: shape === 'pill' ? 999 : radius,
      '--glass-milk': tint,
    } as CSSProperties,
  };
}
