'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { getDeviceTier, type DeviceTier } from '@/lib/webgl/capabilities';

/* The Stage touches window, canvas and WebGL directly, so it must never be
   prerendered. Per the Next 16 lazy-loading guide, ssr:false only works
   inside a Client Component — which is why this wrapper exists. */
const Stage = dynamic(() => import('./Stage'), {
  ssr: false,
  loading: () => null,
});

/**
 * Decides whether the live WebGL background runs at all.
 *
 * The tier probe can only run in the browser, so the first client render
 * matches the server (nothing) and the Stage fades in afterwards over the
 * static .backdrop plate. That ordering is deliberate: the page is never
 * blank waiting on WebGL, and a device that reports tier 'none' simply
 * keeps the CSS backdrop forever.
 */
export default function StageMount() {
  const [tier, setTier] = useState<DeviceTier>('none');

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const evaluate = () => setTier(getDeviceTier());

    evaluate();

    // Respond live if the user flips the OS setting while the page is open.
    media.addEventListener('change', evaluate);
    return () => media.removeEventListener('change', evaluate);
  }, []);

  if (tier === 'none') return null;

  return <Stage tier={tier} />;
}
