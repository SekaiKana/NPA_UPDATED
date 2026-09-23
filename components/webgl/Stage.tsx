'use client';

/* The render loop writes to cameras, materials and render targets directly. */
 
'use no memo';

import { Canvas, createPortal, useFrame, useThree } from '@react-three/fiber';
import { ShaderGradient } from '@shadergradient/react';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { tierSettings, type DeviceTier } from '@/lib/webgl/capabilities';
import {
  getHeroFieldElement,
  getHeroFieldVersion,
  setGlassEnabled,
  subscribeHeroField,
} from '@/lib/webgl/glassStore';
import GlassLayer from './GlassLayer';
import HeroClump from './HeroClump';
import ParticleSpray from './ParticleSpray';

/* ShaderGradientCanvas applies this before mounting the gradient. Since we own
   the Canvas, we do it ourselves. These chunks were removed from three in r152
   and no longer exist on 0.183, so it is inert here — kept only to mirror the
   library's own setup exactly. */
function useShaderChunkPatch() {
  useEffect(() => {
    const chunks = THREE.ShaderChunk as unknown as Record<string, string>;
    chunks.uv2_pars_vertex = '';
    chunks.uv2_vertex = '';
    chunks.uv2_pars_fragment = '';
    chunks.encodings_fragment = '';
  }, []);
}

/**
 * Every WebGL effect on the site, in a single canvas and a single context.
 *
 * A layer only gets its own scene where it genuinely needs a different camera,
 * because a scene with its own camera costs an extra render pass:
 *
 *   1. gradient field → offscreen target, own perspective camera (the gradient
 *      ships a camera rig that would otherwise hijack ours)
 *   2. hero clump     → screen, own perspective camera
 *   3. main scene     → screen, orthographic: background quad and glass
 *      panels, sequenced by renderOrder
 *
 * Glass shares the main scene with the background quad deliberately: both map
 * to pixels under the same orthographic camera, so a private scene for it
 * bought nothing and cost a pass.
 *
 * Glass samples the offscreen field rather than the framebuffer, which is what
 * lets it refract a live animated background with no feedback loop — the thing
 * liquid-glass-js's html2canvas snapshot could never do.
 */
function Composite({
  tier,
  glass,
  hero,
}: {
  tier: DeviceTier;
  glass: boolean;
  hero: boolean;
}) {
  const { size, gl, viewport } = useThree();

  const gradientScene = useMemo(() => new THREE.Scene(), []);
  const heroScene = useMemo(() => new THREE.Scene(), []);

  const gradientCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  gradientCameraRef.current ??= new THREE.PerspectiveCamera(45, 1, 0.1, 100);

  const heroCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  heroCameraRef.current ??= (() => {
    const cam = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    cam.position.set(0, 0, 11);
    cam.lookAt(0, 0, 0);
    return cam;
  })();

  // Half-res is plenty: the field is low-frequency colour and the glass blurs
  // it further. This is the single biggest saving on low tier.
  const scale = tier === 'high' ? 0.7 : 0.45;
  const target = useMemo(
    () =>
      new THREE.WebGLRenderTarget(1, 1, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
        stencilBuffer: false,
      }),
    []
  );

  useEffect(() => {
    target.setSize(
      Math.max(1, Math.floor(size.width * scale)),
      Math.max(1, Math.floor(size.height * scale))
    );
  }, [size.width, size.height, scale, target]);

  useEffect(() => () => target.dispose(), [target]);

  /* Composite the field over the bone ground rather than replacing it. Straight
     out of the box the gradient reads as a saturated poster and drags body
     copy under AA. The radial mask holds the centre of the viewport calm —
     exactly where the copy sits — and lets colour pool at the edges. */
  const quadMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uField: { value: target.texture },
          /* Low on purpose. The field is atmosphere, not a picture: pushed any
             higher it stops reading as shadow falling across the ground and
             starts reading as a blurred photograph behind the type. */
          uOpacity: { value: 0.16 },
          uCentreRelief: { value: 0.66 },
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          precision mediump float;
          uniform sampler2D uField;
          uniform float uOpacity;
          uniform float uCentreRelief;
          varying vec2 vUv;

          void main() {
            vec4 field = texture2D(uField, vUv);

            float d = length((vUv - 0.5) * vec2(1.35, 1.0));
            float mask = smoothstep(0.06, 0.74, d);
            mask = mix(1.0 - uCentreRelief, 1.0, mask);

            /* Respect the field's own alpha. The gradient mesh does not fill
               the frame and the target clears to transparent black, so without
               this the uncovered corners composite as a grey smudge instead of
               bare ground. */
            gl_FragColor = vec4(field.rgb, field.a * uOpacity * mask);
          }
        `,
      }),
    [target]
  );

  useEffect(() => () => quadMaterial.dispose(), [quadMaterial]);

  /* Priority 1 disables R3F's automatic render, so this single callback owns
     every pass. */
  useFrame(({ scene, camera }) => {
    const gradientCamera = gradientCameraRef.current;
    const heroCamera = heroCameraRef.current;
    if (!gradientCamera || !heroCamera) return;

    const aspect = size.width / size.height;
    if (gradientCamera.aspect !== aspect) {
      gradientCamera.aspect = aspect;
      gradientCamera.updateProjectionMatrix();
    }
    if (heroCamera.aspect !== aspect) {
      heroCamera.aspect = aspect;
      heroCamera.updateProjectionMatrix();
    }

    gl.setRenderTarget(target);
    gl.render(gradientScene, gradientCamera);
    gl.setRenderTarget(null);

    gl.clear();
    gl.autoClear = false;
    gl.render(scene, camera);
    if (hero) gl.render(heroScene, heroCamera);
    gl.autoClear = true;
  }, 1);

  return (
    <>
      {createPortal(
        <ShaderGradient
          control="props"
          type="waterPlane"
          animate="on"
          /* '3d' lights the field with a plain ambientLight. The 'env' path
             fetches HDR maps from the author's personal GitHub Pages host,
             which is not something to ship on a client site. */
          lightType="3d"
          brightness={1.15}
          grain="off"
          /* Every colour here sits DARKER than --ground on purpose. Lighter
             values wash the bone out toward white and the palette loses the
             material quality that made a mid-tone ground worth choosing;
             darker ones read as shadow falling across paper. */
          color1="#b5b0a5"
          color2="#a8927a"
          color3="#d0cac0"
          uSpeed={0.13}
          uStrength={1.5}
          uDensity={1.1}
          uFrequency={4.2}
          uAmplitude={0}
          positionX={0}
          positionY={0}
          positionZ={0}
          rotationX={50}
          rotationY={0}
          rotationZ={-60}
          cDistance={3.4}
          cPolarAngle={90}
          cAzimuthAngle={180}
          cameraZoom={1}
          reflection={0.1}
        />,
        gradientScene,
        { camera: gradientCameraRef.current }
      )}

      {/* Under an orthographic camera the frustum is sized in pixels, so a
          literal 2x2 plane would be two pixels wide. */}
      <mesh
        renderOrder={-1}
        material={quadMaterial}
        scale={[viewport.width, viewport.height, 1]}
      >
        <planeGeometry args={[1, 1]} />
      </mesh>

      {hero &&
        createPortal(
          <>
            <HeroClump lowPower={tier !== 'high'} />
            {/* Same scene, same lights, same shadow map as the cluster. */}
            {tier === 'high' && <ParticleSpray />}
          </>,
          heroScene,
          { camera: heroCameraRef.current }
        )}

      {glass && <GlassLayer background={target.texture} />}
    </>
  );
}

export default function Stage({ tier }: { tier: DeviceTier }) {
  useShaderChunkPatch();
  const settings = tierSettings(tier);

  const heroVersion = useSyncExternalStore(
    subscribeHeroField,
    getHeroFieldVersion,
    () => 0
  );
  const heroActive = useMemo(
    () => getHeroFieldElement() !== null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [heroVersion]
  );

  /* Pause when the tab is hidden. The stage is fixed and full-viewport, so it
     is always "in view" — tab visibility is the signal that actually means
     nobody is looking. */
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const onChange = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  /* Tell the DOM glass panels which treatment to use. Flipped off on unmount
     so panels never sit transparent waiting on a canvas that isn't there. */
  useEffect(() => {
    setGlassEnabled(settings.glassWebGL);
    return () => setGlassEnabled(false);
  }, [settings.glassWebGL]);

  return (
    <div
      aria-hidden="true"
      data-stage-frameloop={visible ? 'always' : 'never'}
      data-stage-tier={tier}
      data-stage-glass={settings.glassWebGL ? 'on' : 'off'}
      data-stage-hero={heroActive ? 'on' : 'off'}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <Canvas
        dpr={settings.pixelDensity}
        frameloop={visible ? 'always' : 'never'}
        /* The hero clump and the spray cast into a shared shadow map. Only the
           hero scene has shadow casters, so the other passes pay nothing.
           Variance rather than percentage-closer: PCF ignores the light's
           `radius`, so its edges come out hard-cut however large the map is. */
        shadows={tier === 'high' ? 'variance' : false}
        /* linear + flat match what ShaderGradientCanvas configures; its
           material is authored against an untone-mapped pipeline. */
        linear
        flat
        orthographic
        camera={{ position: [0, 0, 1], zoom: 1 }}
        gl={{
          alpha: true,
          antialias: tier === 'high',
          powerPreference: tier === 'high' ? 'high-performance' : 'default',
        }}
        style={{ pointerEvents: 'none' }}
      >
        <Composite tier={tier} glass={settings.glassWebGL} hero={heroActive} />
      </Canvas>
    </div>
  );
}
