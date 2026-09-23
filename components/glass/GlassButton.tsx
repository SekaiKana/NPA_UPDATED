'use client';

import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { useGlassPanel, type GlassPanelOptions } from './useGlassPanel';

type GlassButtonProps = GlassPanelOptions &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'style'> & {
    children: ReactNode;
  };

/**
 * Glass in its interactive form — an anchor, because every call to action on
 * this site is a `mailto:` link rather than a form submit. Defaults to a pill,
 * whose radius the shader derives from height so it stays a true capsule at
 * any size.
 */
export default function GlassButton({
  children,
  shape = 'pill',
  radius,
  tint = 0.7,
  className = '',
  ...rest
}: GlassButtonProps) {
  const glass = useGlassPanel<HTMLAnchorElement>({ shape, radius, tint });

  return (
    <a {...glass} className={`glass-card glass-button ${className}`} {...rest}>
      {children}
    </a>
  );
}
