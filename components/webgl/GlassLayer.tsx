'use client';

// Ref mutation inside useFrame — must not be memoised by the React Compiler.
'use no memo';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import {
  getGlassSurfaces,
  getGlassVersion,
  subscribeGlass,
  type GlassSurfaceEntry,
} from '@/lib/webgl/glassStore';
import {
  GLASS_DEFAULTS,
  glassFragmentShader,
  glassVertexShader,
} from '@/lib/webgl/glass/refraction';

const SHAPE_INDEX = { rounded: 0, pill: 1, circle: 2 } as const;

/**
 * Draws one refracting quad per registered DOM glass panel.
 *
 * DOM owns layout; this layer only follows. Each frame every panel's
 * bounding rect is read and its quad is moved to match, so the panels stay in
 * normal CSS flow, stay responsive, and nothing is positioned in 3D by hand.
 *
 * The orthographic camera's frustum is the canvas size in CSS pixels, so one
 * world unit is one CSS pixel and rect values map across directly.
 */
export default function GlassLayer({ background }: { background: THREE.Texture }) {
  const { size, gl } = useThree();

  // Re-renders only when panels are added or removed — never on scroll.
  const version = useSyncExternalStore(subscribeGlass, getGlassVersion, () => 0);
  const surfaces = useMemo<GlassSurfaceEntry[]>(
    () => getGlassSurfaces(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version]
  );

  const meshRefs = useRef<Map<number, THREE.Mesh>>(new Map());

  const materials = useMemo(() => {
    const map = new Map<number, THREE.ShaderMaterial>();
    for (const surface of surfaces) {
      map.set(
        surface.id,
        new THREE.ShaderMaterial({
          vertexShader: glassVertexShader,
          fragmentShader: glassFragmentShader,
          transparent: true,
          depthTest: false,
          depthWrite: false,
          uniforms: {
            uBackground: { value: background },
            uResolution: { value: new THREE.Vector2(1, 1) },
            uPanelSize: { value: new THREE.Vector2(1, 1) },
            uRadius: { value: surface.radius },
            uShape: { value: SHAPE_INDEX[surface.shape] },
            uTint: { value: surface.tint },
            uTintColor: { value: new THREE.Color('#ffffff') },
            uOpacity: { value: 1 },
            uEdgeIntensity: { value: GLASS_DEFAULTS.edgeIntensity },
            uRimIntensity: { value: GLASS_DEFAULTS.rimIntensity },
            uBaseIntensity: { value: GLASS_DEFAULTS.baseIntensity },
            uEdgeDistance: { value: GLASS_DEFAULTS.edgeDistance },
            uRimDistance: { value: GLASS_DEFAULTS.rimDistance },
            uBaseDistance: { value: GLASS_DEFAULTS.baseDistance },
            uCornerBoost: { value: GLASS_DEFAULTS.cornerBoost },
            uRipple: { value: GLASS_DEFAULTS.ripple },
            uDispersion: { value: GLASS_DEFAULTS.dispersion },
          },
        })
      );
    }
    return map;
  }, [surfaces, background]);

  useEffect(() => {
    const current = materials;
    return () => {
      for (const material of current.values()) material.dispose();
    };
  }, [materials]);

  /* Priority 0 runs before the priority-1 composite pass that actually draws,
     so quads are in position by the time the frame is rendered. */
  useFrame(() => {
    const buffer = gl.getDrawingBufferSize(new THREE.Vector2());
    const halfW = size.width / 2;
    const halfH = size.height / 2;

    for (const surface of surfaces) {
      const mesh = meshRefs.current.get(surface.id);
      const material = materials.get(surface.id);
      if (!mesh || !material) continue;

      const rect = surface.element.getBoundingClientRect();
      surface.rect = rect;

      // Skip panels scrolled off screen — no point refracting for nobody.
      const offscreen = rect.bottom < 0 || rect.top > size.height;
      mesh.visible = !offscreen && rect.width > 0 && rect.height > 0;
      if (!mesh.visible) continue;

      // DOM origin is top-left and y grows downward; the camera's is centred
      // with y growing upward.
      mesh.position.set(
        rect.left + rect.width / 2 - halfW,
        -(rect.top + rect.height / 2 - halfH),
        0
      );
      mesh.scale.set(rect.width, rect.height, 1);

      /* Inline style read — no getComputedStyle, so no forced layout. */
      const reveal = surface.revealDriver;
      const revealOpacity = reveal?.style.opacity;
      material.uniforms.uOpacity.value =
        revealOpacity === undefined || revealOpacity === ''
          ? 1
          : Number(revealOpacity);

      material.uniforms.uResolution.value.copy(buffer);
      material.uniforms.uPanelSize.value.set(rect.width, rect.height);

      // A pill's radius is always half its height, whatever CSS claims.
      material.uniforms.uRadius.value =
        surface.shape === 'pill' ? rect.height / 2 : surface.radius;
    }
  }, 0);

  return (
    <group renderOrder={1}>
      {surfaces.map((surface) => (
        <mesh
          key={surface.id}
          ref={(node) => {
            if (node) meshRefs.current.set(surface.id, node);
            else meshRefs.current.delete(surface.id);
          }}
          material={materials.get(surface.id)}
          renderOrder={1}
          visible={false}
        >
          <planeGeometry args={[1, 1]} />
        </mesh>
      ))}
    </group>
  );
}
