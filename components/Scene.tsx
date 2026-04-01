'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/* ============================================================
   GLSL: 3D Simplex Noise (Ashima Arts)
   ============================================================ */
const simplexNoise = `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3  ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
`;

/* ============================================================
   VERTEX SHADER — noise displacement + CPU-driven lateral offset
   Mouse interaction is handled entirely on the CPU.
   The shader only applies the pre-computed aOffset attribute.
   ============================================================ */
const vertexShader = `
  ${simplexNoise}

  uniform float uTime;

  attribute float aSize;
  attribute float aRandom;
  attribute vec2  aOffset; // CPU-computed repulsion offset (xy)

  varying float vAlpha;
  varying float vElevation;
  varying float vCenterFade;
  varying float vOffsetMag;

  void main() {
    vec3 pos = position;

    // Apply CPU-side mouse repulsion offset (lateral only)
    pos.xy += aOffset;

    // --- Layered simplex noise for slow, organic motion ---
    // Noise is sampled at ORIGINAL position so the base pattern is stable
    float n1 = snoise(vec3(position.x * 0.12, position.y * 0.10, uTime * 0.06)) * 2.0;
    float n2 = snoise(vec3(position.x * 0.25 + 4.0, position.y * 0.22 + 7.0, uTime * 0.09)) * 0.8;
    float n3 = snoise(vec3(position.x * 0.55 + 12.0, position.y * 0.50 + 3.0, uTime * 0.14)) * 0.3;
    float drift = snoise(vec3(position.xy * 0.3, uTime * 0.05 + aRandom * 100.0)) * 0.6;

    float elevation = n1 + n2 + n3 + drift;

    // --- Center clear zone ---
    float centerDist = length(position.xy) / 10.0;
    float centerMask = smoothstep(0.0, 0.3, centerDist);
    elevation *= mix(0.3, 1.0, centerMask);

    pos.z = elevation;

    // --- Offset magnitude for glow effect ---
    float offsetMag = length(aOffset);
    vOffsetMag = smoothstep(0.0, 1.0, offsetMag);

    // --- Alpha ---
    float baseAlpha = 0.45 + smoothstep(0.3, 2.0, abs(elevation)) * 0.35;
    float centerFade = mix(0.35, 1.0, smoothstep(0.0, 0.4, centerDist));
    vAlpha = baseAlpha * centerFade;
    vElevation = elevation;
    vCenterFade = centerFade;

    // Point size
    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * (35.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
  }
`;

/* ============================================================
   FRAGMENT SHADER — copper & embers + displacement glow
   ============================================================ */
const fragmentShader = `
  varying float vAlpha;
  varying float vElevation;
  varying float vCenterFade;
  varying float vOffsetMag;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float softness = 1.0 - smoothstep(0.05, 0.5, d);

    // Copper & Embers palette
    vec3 espresso    = vec3(0.12, 0.06, 0.03);
    vec3 copper      = vec3(0.72, 0.45, 0.20);
    vec3 brightAmber = vec3(0.85, 0.47, 0.21);
    vec3 hotGlow     = vec3(1.0, 0.65, 0.30);

    float peakFactor = smoothstep(0.4, 2.0, abs(vElevation));
    float midFactor  = smoothstep(-0.1, 0.8, abs(vElevation)) * 0.6;

    vec3 color = espresso;
    color = mix(color, copper, midFactor);
    color = mix(color, brightAmber, peakFactor * 0.5);

    // Displaced particles glow hotter (wake effect)
    color = mix(color, hotGlow, vOffsetMag * 0.45);

    float alpha = vAlpha * softness;
    alpha += vOffsetMag * 0.12 * softness;

    gl_FragColor = vec4(color, alpha);
  }
`;

/* ============================================================
   REACT COMPONENT — CPU-side repulsion physics
   ============================================================ */
export default function Scene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseNDC = useRef(new THREE.Vector2(-999, -999));
  const cursorOnPlane = useRef(false);
  const cursorLocal = useRef(new THREE.Vector3(0, 0, 0));
  const cursorSmoothed = useRef(new THREE.Vector3(0, 0, 0));

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const isMobile = window.innerWidth < 768;
    const dpr = Math.min(window.devicePixelRatio, 1.5);

    // --- Scene, Camera (LOCKED), Renderer ---
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 150);
    camera.position.set(0, -4, 14);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // --- Particle data ---
    const PARTICLE_COUNT = isMobile ? 8000 : 25000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);
    const randoms = new Float32Array(PARTICLE_COUNT);
    const offsets = new Float32Array(PARTICLE_COUNT * 2); // xy repulsion offsets

    const spreadX = 22;
    const spreadY = 16;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * spreadX;
      positions[i * 3 + 1] = (Math.random() - 0.5) * spreadY;
      positions[i * 3 + 2] = 0;
      sizes[i] = Math.random() * 1.5 + 0.5;
      randoms[i] = Math.random();
      offsets[i * 2] = 0;
      offsets[i * 2 + 1] = 0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(randoms, 1));

    const offsetAttr = new THREE.BufferAttribute(offsets, 2);
    offsetAttr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aOffset', offsetAttr);

    const uniforms = {
      uTime: { value: 0 },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    points.rotation.x = -0.4;
    scene.add(points);

    // --- Invisible raycast plane (same tilt as particles) ---
    const rayPlaneGeo = new THREE.PlaneGeometry(spreadX * 1.5, spreadY * 1.5);
    const rayPlaneMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
    const rayPlane = new THREE.Mesh(rayPlaneGeo, rayPlaneMat);
    rayPlane.rotation.x = -0.4;
    scene.add(rayPlane);

    const raycaster = new THREE.Raycaster();

    // --- Physics constants ---
    const REPULSE_RADIUS = 1.8;
    const REPULSE_RADIUS_SQ = REPULSE_RADIUS * REPULSE_RADIUS;
    const REPULSE_STRENGTH = 0.025;
    const MAX_OFFSET = 0.3;
    const MAX_OFFSET_SQ = MAX_OFFSET * MAX_OFFSET;
    const SPRING_BACK = 0.06; // lerp factor per frame toward zero

    // --- Input handlers (NDC only, no camera/mesh movement) ---
    const onMouseMove = (e: MouseEvent) => {
      mouseNDC.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseNDC.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        mouseNDC.current.x = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
        mouseNDC.current.y = -(e.touches[0].clientY / window.innerHeight) * 2 + 1;
      }
    };
    const onMouseLeave = () => {
      mouseNDC.current.set(-999, -999);
      cursorOnPlane.current = false;
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('mouseleave', onMouseLeave, { passive: true });

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    // --- Animation loop ---
    let frameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      uniforms.uTime.value = t;

      // --- Raycast cursor to particle plane ---
      if (mouseNDC.current.x > -10) {
        raycaster.setFromCamera(mouseNDC.current, camera);
        const hits = raycaster.intersectObject(rayPlane);
        if (hits.length > 0) {
          const localPt = points.worldToLocal(hits[0].point.clone());
          cursorLocal.current.copy(localPt);
          cursorOnPlane.current = true;
        } else {
          cursorOnPlane.current = false;
        }
      } else {
        cursorOnPlane.current = false;
      }

      // Smooth the cursor for fluid feel
      if (cursorOnPlane.current) {
        cursorSmoothed.current.lerp(cursorLocal.current, 0.15);
      }

      const cx = cursorSmoothed.current.x;
      const cy = cursorSmoothed.current.y;
      const isActive = cursorOnPlane.current;

      // --- Per-particle repulsion physics ---
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i2 = i * 2;
        const i3 = i * 3;

        let ox = offsets[i2];
        let oy = offsets[i2 + 1];

        if (isActive) {
          // Current particle position (original + current offset)
          const px = positions[i3] + ox;
          const py = positions[i3 + 1] + oy;

          // Vector FROM cursor TO particle
          const dx = px - cx;
          const dy = py - cy;
          const distSq = dx * dx + dy * dy;

          if (distSq < REPULSE_RADIUS_SQ && distSq > 0.001) {
            const dist = Math.sqrt(distSq);

            // Smoothstep falloff: strongest at center, zero at edge
            const t2 = 1.0 - dist / REPULSE_RADIUS;
            const smooth = t2 * t2 * (3.0 - 2.0 * t2);
            const force = smooth * REPULSE_STRENGTH;

            // Push AWAY from cursor
            ox += (dx / dist) * force;
            oy += (dy / dist) * force;
          }
        }

        // Clamp to max displacement
        const offDistSq = ox * ox + oy * oy;
        if (offDistSq > MAX_OFFSET_SQ) {
          const scale = MAX_OFFSET / Math.sqrt(offDistSq);
          ox *= scale;
          oy *= scale;
        }

        // Spring back toward zero (elastic return to noise pattern)
        ox *= (1.0 - SPRING_BACK);
        oy *= (1.0 - SPRING_BACK);

        offsets[i2] = ox;
        offsets[i2 + 1] = oy;
      }

      // Upload updated offsets to GPU
      offsetAttr.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      rayPlaneGeo.dispose();
      rayPlaneMat.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    />
  );
}
