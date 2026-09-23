'use client';

/* Instance matrices are written directly every frame. */

'use no memo';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * A one-off spray of balls, fired when the page is scrolled past a threshold.
 *
 * Not an ambient loop. Nothing exists until the visitor reaches `triggerAt`,
 * at which point the whole set is released from the left edge in a few quick
 * waves, arcs across under gravity, and is done. After the last ball leaves
 * the frame nothing spawns again.
 *
 * `repeat` is on by default, so scrolling back above the threshold re-arms it
 * and coming down again fires a fresh burst — a moment that can only ever
 * happen once per session tends to be missed entirely. Pass `repeat={false}`
 * for strictly one-time.
 *
 * Every ball varies: radius, launch height, speed, arc, spin and lifetime are
 * all randomised per shot, and the waves are unevenly spaced, so no two
 * bursts trace the same pattern.
 *
 * The balls are real objects in the hero's 3D scene: they spawn across a
 * depth range, travel through it, and are lit and shadowed by the same rig as
 * the cluster, so the burst belongs to the same world rather than sitting on
 * top of it.
 *
 * One InstancedMesh, so the whole burst is a single draw call.
 */

export interface ParticleSprayProps {
  /** Balls per burst. Each is an instance, not a draw call. */
  count?: number;
  /** Scroll progress (0–1 of the scrollable range) that fires the burst. */
  triggerAt?: number;
  /** Re-arm when the visitor scrolls back above the threshold. */
  repeat?: boolean;
  /** Smallest and largest ball radius, in world units. */
  sizeRange?: [number, number];
  /**
   * Seconds over which the burst is released.
   *
   * This, not the ball speed, is what sets how long the whole thing lasts. A
   * ball is culled the moment it leaves the frame, so at a lively pace it is
   * gone in well under ten seconds however long it is allowed to live —
   * stretching the effect by slowing the balls just makes them crawl. Keeping
   * them quick and feeding them in over a long window gives a burst that runs
   * for roughly half a minute while every individual ball still moves.
   */
  releaseWindow?: number;
  /** Downward acceleration, world units per second squared. */
  gravity?: number;
  /** Base horizontal launch speed, before per-ball variation. */
  speed?: number;
  colour?: string;
  /** Off on weaker hardware, where the shadow pass is not worth it. */
  castShadow?: boolean;
}

interface Ball {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  radius: number;
  spin: number;
  /** Seconds until this one launches, measured from the burst starting. */
  delay: number;
  life: number;
  ttl: number;
  active: boolean;
}

export default function ParticleSpray({
  count = 30,
  triggerAt = 0.5,
  repeat = true,
  sizeRange = [0.13, 0.46],
  releaseWindow = 18,
  gravity = 0.5,
  speed = 1.6,
  colour = '#c9915f',
  castShadow = true,
}: ParticleSprayProps) {
  const { size: viewport, camera } = useThree();
  const meshRef = useRef<THREE.InstancedMesh>(null);

  /* A true unit sphere, scaled uniformly per instance below. Nothing here
     ever writes a non-uniform scale, so the balls cannot end up stretched
     or flattened. Segment counts are up a little now that they are large
     enough for faceting to show on the silhouette. */
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 24, 16), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  /* Deliberately the same recipe as the cluster: matte, lit by the same
     lights, casting into the same shadow map. Nothing emissive and nothing
     depth-sorted out of the world — these are objects in the scene, not an
     overlay drawn on top of it. */
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(colour),
        roughness: 0.82,
        metalness: 0.02,
      }),
    [colour]
  );
  useEffect(() => () => material.dispose(), [material]);

  /* Held in refs rather than memos. Both are written field by field inside
     the frame loop, which is exactly the mutation the React Compiler refuses
     on a memoised value — a ref is the sanctioned place for state the render
     never reads. */
  const ballsRef = useRef<Ball[]>([]);
  const stateRef = useRef({
    /** Waiting for the threshold. */
    armed: true,
    /** A burst is in flight, including balls still waiting on their delay. */
    firing: false,
    /** Seconds since the burst began. */
    clock: 0,
  });

  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      quat: new THREE.Quaternion(),
      euler: new THREE.Euler(),
      scale: new THREE.Vector3(),
      hidden: new THREE.Vector3(0, 0, 0),
      zero: new THREE.Vector3(0.00001, 0.00001, 0.00001),
    }),
    []
  );

  useFrame((_, rawDelta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const dt = Math.min(rawDelta, 1 / 30);

    if (ballsRef.current.length !== count) {
      ballsRef.current = Array.from({ length: count }, () => ({
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        radius: 0,
        spin: 0,
        delay: 0,
        life: 0,
        ttl: 0,
        active: false,
      }));
    }
    const balls = ballsRef.current;
    const state = stateRef.current;

    /* ---- Where the visitor is on the page ---- */
    const scrollable =
      document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? window.scrollY / scrollable : 0;

    if (state.armed && progress >= triggerAt) {
      state.armed = false;
      state.firing = true;
      state.clock = 0;
      arm();
    } else if (repeat && !state.firing && !state.armed) {
      // A little hysteresis, so hovering exactly on the line cannot stutter.
      if (progress < triggerAt - 0.06) state.armed = true;
    }

    if (!state.firing) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    state.clock += dt;

    /* ---- The frustum at the balls' depth, so the burst reflows with the
       viewport rather than being pinned to one breakpoint ---- */
    const persp = camera as THREE.PerspectiveCamera;
    const distance = persp.position?.z ?? 11;
    const depth = distance + 2;
    const perPixel =
      (2 * depth * Math.tan(((persp.fov ?? 38) * Math.PI) / 360)) /
      viewport.height;
    const halfW = (viewport.width * perPixel) / 2;
    const halfH = (viewport.height * perPixel) / 2;

    let anyAlive = false;

    for (let i = 0; i < balls.length; i += 1) {
      const b = balls[i];

      // Still waiting for its wave.
      if (!b.active && b.delay > 0 && state.clock >= b.delay) {
        b.active = true;
        /* Spread through real depth, not along a plane. The near ones are
           closer to the camera than the cluster's own front face and the far
           ones sit well behind it, so the burst has genuine parallax and the
           perspective does the sorting. */
        b.pos.set(
          -halfW - b.radius * 2,
          -halfH * (0.1 + Math.random() * 0.55),
          2.2 - Math.random() * 7.5
        );
      }

      if (!b.active) {
        if (b.delay > 0) anyAlive = true;
        scratch.matrix.compose(scratch.hidden, scratch.quat, scratch.zero);
        mesh.setMatrixAt(i, scratch.matrix);
        continue;
      }

      b.life += dt;
      b.vel.y -= gravity * dt;
      b.pos.addScaledVector(b.vel, dt);

      const gone =
        b.life >= b.ttl ||
        b.pos.x > halfW + b.radius * 3 ||
        b.pos.y < -halfH - b.radius * 3;

      if (gone) {
        b.active = false;
        b.delay = 0;
        scratch.matrix.compose(scratch.hidden, scratch.quat, scratch.zero);
        mesh.setMatrixAt(i, scratch.matrix);
        continue;
      }

      anyAlive = true;

      /* Scaled in and out rather than faded: an opaque ball that shrinks away
         still sits correctly in the depth buffer, where a transparent one
         would need sorting against everything else in the scene.

         Timed in seconds, not as a fraction of lifetime — at a thirty second
         life a proportional fade would spend four seconds growing. */
      const grow =
        Math.min(1, b.life / 1.1) * Math.min(1, (b.ttl - b.life) / 2.4);
      const s = Math.max(b.radius * grow, 0.00001);

      scratch.euler.set(b.life * b.spin, b.life * b.spin * 0.6, 0);
      scratch.quat.setFromEuler(scratch.euler);
      scratch.scale.setScalar(s);
      scratch.matrix.compose(b.pos, scratch.quat, scratch.scale);
      mesh.setMatrixAt(i, scratch.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;

    // Burst spent. Nothing spawns again until the threshold re-arms it.
    if (!anyAlive) {
      state.firing = false;
      mesh.visible = false;
    }

    /** Assign every ball a fresh, randomised shot. */
    function arm() {
      for (let i = 0; i < balls.length; i += 1) {
        const b = balls[i];
        b.active = false;
        b.life = 0;
        /* Front-loaded but spread: the power biases launches toward the start
           so the burst still opens as a spray rather than a trickle, while the
           tail keeps feeding the frame for the rest of the window. A plain
           square would bunch nearly everything into the first few seconds of a
           window this long. */
        b.delay = 0.0001 + Math.pow(Math.random(), 1.35) * releaseWindow;
        b.radius =
          sizeRange[0] + Math.random() * Math.max(0, sizeRange[1] - sizeRange[0]);
        /* Comfortably longer than a crossing takes, so a ball is retired by
           leaving the frame rather than by timing out mid-flight. The burst's
           overall length comes from `releaseWindow` instead. */
        b.ttl = 13 + Math.random() * 5;
        b.spin = (Math.random() - 0.5) * 3.2;
        /* Smaller balls are thrown harder and flatter, larger ones lob — the
           single biggest thing stopping the burst reading as one object cut
           into pieces. */
        const lightness =
          1 - (b.radius - sizeRange[0]) / Math.max(0.0001, sizeRange[1] - sizeRange[0]);
        b.vel.set(
          speed * (0.62 + Math.random() * 0.7 + lightness * 0.45),
          speed * (0.22 + Math.random() * 0.62 - lightness * 0.16),
          // Real travel through depth, so arcs cross the camera axis too.
          (Math.random() - 0.45) * 1.5
        );
      }
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      castShadow={castShadow}
      receiveShadow
      frustumCulled={false}
      visible={false}
    />
  );
}
