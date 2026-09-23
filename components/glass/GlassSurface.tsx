'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { useGlassPanel, type GlassPanelOptions } from './useGlassPanel';

type GlassSurfaceProps = GlassPanelOptions &
  Omit<HTMLAttributes<HTMLDivElement>, 'style'> & {
    children: ReactNode;
  };

/**
 * A glass panel. Always a real DOM element in normal document flow — that is
 * what keeps the layout responsive and the content accessible; the WebGL
 * layer only follows the rect this element reports.
 */
export default function GlassSurface({
  children,
  shape,
  radius,
  tint,
  className = '',
  ...rest
}: GlassSurfaceProps) {
  const glass = useGlassPanel<HTMLDivElement>({ shape, radius, tint });

  return (
    <div {...glass} className={`glass-card ${className}`} {...rest}>
      {children}
    </div>
  );
}
