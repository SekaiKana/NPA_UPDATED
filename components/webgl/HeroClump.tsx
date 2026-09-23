'use client';

/* Physics writes instance matrices every frame; none of it is React's. */

'use no memo';

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Physics, useSphere } from '@react-three/cannon';
import * as THREE from 'three';
import {
  getHeroFieldElement,
  getHeroFieldVersion,
  subscribeHeroField,
} from '@/lib/webgl/glassStore';

/**
 * The hero centrepiece: a loose cluster of physics spheres.
 *
 * Built like the pmndrs object-clump. Every member is a real rigid body with
 * no world gravity; what holds the cluster together is a force on each body
 * toward a shared centre, which behaves like a soft tether rather than a rigid
 * joint. A few of the spheres carry a letter printed on their surface. Those
 * are spheres in every other respect — same radius distribution, same
 * collision shape, same material settings — so the cluster stays one
 * population of objects rather than a mix of shapes.
 *
 * The cursor drives it two ways: a kinematic sphere tracks the pointer and
 * physically shoulders the cluster aside, and while the pointer is held down
 * every body is pulled toward it. Letting go simply removes that pull, so the
 * overshoot on the way back is the solver's, not an easing curve.
 *
 * The plain spheres share one InstancedMesh with per-instance scale. The
 * lettered ones are individual meshes only because an InstancedMesh has a
 * single material and therefore a single texture.
 */

export interface ClumpColors {
  /** Sphere colour. */
  body: string;
  /** Warm key. */
  key: string;
  /** Cool counter-rim. */
  rim: string;
  /** The ground the cluster sits against. */
  ground: string;
  /** The printed letters. Multiplied over the body colour, so it reads as ink. */
  ink: string;
}

export interface HeroClumpProps {
  /** Total spheres. Fewer means each is larger, since the cluster is sized to
      fill its slot regardless of how many make it up. */
  count?: number;
  /** One letter per sphere, printed on that many spheres. */
  text?: string;
  colors?: Partial<ClumpColors>;
  /** Force pulling each body to the shared centre. Higher is tighter. */
  cohesion?: number;
  /** Extra pull toward the pointer while it is held down. */
  grabStrength?: number;
  /** Weak pull toward the pointer when it is merely moving. */
  idleAttraction?: number;
  /** Hard ceiling on body speed, in world units per second. */
  maxSpeed?: number;
  /** Relative sphere sizes within the cluster; absolute scale comes from `fill`. */
  sizeRange?: [number, number];
  /** How much of the hero's slot the packed cluster should occupy, 0–1. */
  fill?: number;
  /** Fewer bodies and no shadow casting. */
  lowPower?: boolean;
}

const DEFAULT_COLORS: ClumpColors = {
  /* True white. Form comes from the falloff between the lit and unlit sides,
     not from tinting the albedo down. */
  body: '#ffffff',
  /* Pure white. Every light and every environment panel is neutral now: a
     white surface has no colour of its own to assert, so it shows whatever
     tint the lighting carries, and even a barely-warm key stained it cream. */
  key: '#ffffff',
  /* Neutral, not the old teal. A coloured rim light on a white sphere is
     immediately visible as a cast. */
  rim: '#ffffff',
  /* Lifted off black. Every silhouette is a step from the sphere's value
     to this one, so raising it lowers the contrast at every edge at once. */
  ground: '#1b1815',
  /* Near-black. The map multiplies, so this lands as dark grey ink on the
     white surface. */
  ink: '#1c1c1c',
};

/* -------------------------------------------------------------------------
 * Shared simulation state
 *
 * Module level rather than context: every body reads the same few values each
 * frame, and threading them through props would re-render the tree for
 * something React never needs to see.
 * ---------------------------------------------------------------------- */

/** Where the cluster is pulled. */
const centreTarget = new THREE.Vector3();
/** The raw pointer, in world units on the cluster's plane. */
const pointerTarget = new THREE.Vector3();
/** The eased pointer the physics actually chases. */
const pointerSmooth = new THREE.Vector3();
const pointerState = { down: false, active: false };
/* `presence` is a continuous 0..1 of how much the hero is on screen, not a
   boolean. The cluster used to be switched off with `mesh.visible = false`
   the instant the hero's rect left a threshold, which is exactly the abrupt
   vanish it looked like — nothing to do with frame rate. It now drives an
   opacity fade while the bodies keep simulating, so the cluster is still
   being pulled home by its tether on the way out. */
const clumpState = {
  presence: 1,
  /* Set when the hero's slot jumps further in one frame than scrolling could
     plausibly move it — a scrollbar drag, a keyboard End, an anchor jump. The
     bodies are simulated, so they physically cannot follow that; left alone
     they stay at the screen position they already had and hang there over
     whatever section is now on screen while they fade. Translating every body
     by the same delta keeps the cluster glued to its slot and preserves its
     arrangement and momentum exactly. */
  shift: new THREE.Vector3(),
};

/* The running total, not the last jump on its own. A group that was hidden
   when a jump happened never got to consume it, and with a single-jump vector
   a second jump overwrote the first — so coming back from a fast scroll the
   cluster applied one arbitrary hop out of several and stranded itself
   somewhere off its slot. Each group now remembers the total it has already
   applied and moves by the difference, which is correct however many jumps it
   slept through and whatever order the frame callbacks run in. */

/** Slot movement in one frame that counts as a jump, as a fraction of the
    viewport's height in world units. A scroll cannot move the page most of a
    screen between two frames; a scrollbar drag or an anchor jump can. The old
    fixed 1.2 units was about 15% of a screen, so an ordinary fast flick of the
    wheel tripped it and the cluster teleported instead of trailing. */
const JUMP_FRACTION = 0.7;

/** Previous frame's centre, for detecting that jump. */
const lastCentre = new THREE.Vector3();
let lastCentreValid = false;

/** Written by the component each render, read by every body's frame loop. */
/* Accelerations now, not forces — see the mass multiply in the frame loop.
   The values are the previous force constants divided through by a typical
   body mass, so the cluster feels exactly as it did before. */
const tuning = {
  /* Softer tether. A stiff one reels the cluster home on a short, heavy arc;
     slackening it lets the spheres drift back, which is most of what reads as
     lightness. */
  cohesion: 10.5,
  grabStrength: 10,
  idleAttraction: 1.1,
  /* Raised in step with the lower damping, or the ceiling would clip exactly
     the loose drift the damping change exists to allow. */
  maxSpeed: 3.2,
};

/**
 * A colour that will *display* as the CSS hex it was given.
 *
 * The Stage's canvas runs `linear` with no output encoding, to match what
 * ShaderGradient expects. That means whatever a material holds is written
 * to the screen unchanged — but `new THREE.Color('#c9a37a')` converts sRGB to
 * linear working space first, so it then displays markedly darker and more
 * saturated than the same hex does in CSS. Declaring the components as
 * already-linear skips that conversion, which is what makes the spheres land
 * on the same tan as the hero's accent text rather than an apricot near it.
 */
function cssColor(hex: string): THREE.Color {
  const n = parseInt(hex.replace('#', ''), 16);
  return new THREE.Color().setRGB(
    ((n >> 16) & 255) / 255,
    ((n >> 8) & 255) / 255,
    (n & 255) / 255,
    THREE.LinearSRGBColorSpace
  );
}

const forceScratch = new THREE.Vector3();
const pullScratch = new THREE.Vector3();

/**
 * The tether. Distance is clamped before it scales the force, so a body that
 * ends up far from the cluster is pulled back gently rather than slingshotted
 * through the middle of it.
 */
function tetherForce(pos: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  out.subVectors(centreTarget, pos);
  const spread = out.length();
  /* Linear while the body is anywhere near home, then continuing to grow at a
     reduced rate rather than flattening off. A hard clamp meant a body left
     far behind by a fast scroll was pulled no harder than one already in the
     cluster, so it crept home over several seconds — long enough that it had
     faded out before it arrived, which is the 'it just vanishes' part. The
     reduced slope past the knee is what keeps it from slingshotting through
     the middle instead. */
  const pull = spread <= 3 ? spread : 3 + (spread - 3) * 0.55;
  out.normalize().multiplyScalar(tuning.cohesion * pull);

  if (pointerState.active) {
    const gain = pointerState.down ? tuning.grabStrength : tuning.idleAttraction;
    if (gain > 0) {
      pullScratch.subVectors(pointerSmooth, pos);
      const reach = pullScratch.length();
      pullScratch.normalize().multiplyScalar(gain * Math.min(reach, 4));
      out.add(pullScratch);
    }
  }
  return out;
}

/** Shared body settings, so lettered and plain spheres behave identically. */
const BODY_DAMPING = {
  /* High on both axes, but eased off. Damping is what the eye reads as mass:
     heavy damping is a body moving through something thick, and it was the
     main reason the cluster felt leaden. Lowered far enough to let the
     spheres coast and keep turning after a nudge, not so far that the swarm
     rings forever. */
  linearDamping: 0.92,
  angularDamping: 0.78,
};

/* Wider than the old spawn, in step with the larger spheres: born too close
   together they start deeply interpenetrating and the solver shoves them apart
   in one violent frame. */
const spawn = (): [number, number, number] => [
  (Math.random() - 0.5) * 3.4,
  (Math.random() - 0.5) * 3.4,
  (Math.random() - 0.5) * 3.4,
];

/** Minimum time the cluster takes to fade out or in, in seconds. */
const FADE_SECONDS = 0.55;

/** How far a body may drift from the centre before it is put back.
    Far wider than it was. At 6 units — under a screen height — a quick scroll
    put most of the cluster past it at once, and every one of those bodies was
    then dropped at a random point near the centre with its velocity zeroed.
    That is a scramble, not a drift, and it is the vanish the cluster showed on
    a fast flick. Trailing that far behind is now ordinary and is handled by
    the tether above; this is back to being what it is described as, a net for
    a solver blow-up. */
const ESCAPE_RADIUS = 20;

/** Mass from volume, so big spheres throw their weight about and small ones skitter. */
const massFor = (radius: number) => radius ** 3 * 18;

/* -------------------------------------------------------------------------
 * The printed letter
 *
 * Drawn to a canvas and used as the colour map. The canvas is 2:1 because
 * that is the aspect a sphere's default UV unwrap has at the equator, so a
 * letter drawn square on the canvas stays square on the surface instead of
 * being stretched around the circumference.
 *
 * It is painted white with dark glyph, and the material keeps its own colour:
 * the map multiplies, so white leaves the body exactly the shade of the plain
 * spheres and the glyph reads as ink printed on it. Baking the body colour
 * into the texture instead would have made the lettered spheres drift out of
 * tone with the rest under this renderer's linear pipeline.
 * ---------------------------------------------------------------------- */

const letterMaterials = new Map<string, THREE.MeshPhysicalMaterial>();

/**
 * The material for one glyph, cached at module scope.
 *
 * Out here for the same reason as the textures: the scroll fade writes
 * `opacity` and `transparent` every frame, and the React Compiler rejects
 * field writes on props and on hook results alike. Fetched through a plain
 * function, the material is an ordinary local and can simply be set.
 */
function getLetterMaterial(
  char: string,
  base: string,
  ink: string,
  envMap: THREE.Texture
): THREE.MeshPhysicalMaterial {
  const cacheKey = `${char}|${base}|${ink}`;
  let material = letterMaterials.get(cacheKey);

  if (!material) {
    /* Physical rather than standard, for the clearcoat below. Nothing else
       about the surface needs it. */
    material = new THREE.MeshPhysicalMaterial({
      color: cssColor(base),
      map: getLetterTexture(char, ink),
      /* Matte satin, not gloss. At 0.14 the highlight collapsed to a pinpoint
         glint that read as cheap plastic; this spreads the same energy over a
         broad soft patch and pulls the environment reflection several mips up
         the PMREM chain, which is what makes it look diffused rather than
         mirrored. */
      roughness: 0.38,
      metalness: 0,
      /* The lightbox does nearly all the work now, so it is turned most of
         the way up and the lamps below come down to match. */
      envMapIntensity: 0.95,
      /* The shine, and the reason the body stays at 0.38. A thin gloss coat
         over a matte base is what a moulded plastic ball actually is, and it
         is the only way to get shine back without giving it up again: drop
         the base roughness instead and the whole surface turns glossy, which
         is the hard pinpoint glint this started out with. The coat reflects
         the broad panels, so what it adds is a wide soft sheen sitting on top
         of a body that is still matte. */
      clearcoat: 0.5,
      clearcoatRoughness: 0.26,
    });
    letterMaterials.set(cacheKey, material);
  }

  if (material.envMap !== envMap) {
    material.envMap = envMap;
    material.needsUpdate = true;
  }
  return material;
}

const letterTextures = new Map<string, THREE.CanvasTexture>();

/**
 * Draws one glyph to a canvas and caches the texture at module scope.
 *
 * Outside React on purpose. The draw pass has to set `needsUpdate` on the
 * texture, and the compiler rejects field writes on anything a hook produced;
 * building it here keeps that mutation on an ordinary local. It also means the
 * texture exists on the first frame rather than arriving a render later, and
 * survives a remount of the Stage. There are only ever a handful, so they are
 * deliberately kept for the life of the page.
 */
function getLetterTexture(char: string, ink: string): THREE.CanvasTexture {
  const cacheKey = `${char}|${ink}`;
  const cached = letterTextures.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;

  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;

  const draw = () => {
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    /* Take the real display face rather than naming it: next/font generates a
       hashed family name, so the only reliable handle is what an element
       already using it computes to. */
    const probe = document.querySelector('.display');
    const family = probe ? getComputedStyle(probe).fontFamily : 'Georgia, serif';

    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    /* ~40% of the canvas height, which lands the glyph across roughly 70
       degrees of the sphere: large enough to read at hero size, small enough
       that the curvature does not bend it out of shape. */
    ctx.font = `700 220px ${family}`;
    /* Printed twice, on opposite sides of the ball. A single glyph sits on one
       face and spends most of its time turned away from the camera as the body
       tumbles; two at 180 degrees means one is almost always readable. */
    ctx.fillText(char, canvas.width * 0.25, canvas.height / 2);
    ctx.fillText(char, canvas.width * 0.75, canvas.height / 2);

    texture.needsUpdate = true;
  };

  draw();
  // Redraw once webfonts land, or the first pass uses the fallback serif.
  document.fonts?.ready.then(draw).catch(() => {});

  letterTextures.set(cacheKey, texture);
  return texture;
}

/* -------------------------------------------------------------------------
 * The spheres
 *
 * One InstancedMesh per letter: an instanced mesh carries a single material
 * and therefore a single texture, so the cluster is split into one group per
 * glyph. Every sphere goes through this same path, which matters for more
 * than tidiness — see the note on reading positions below.
 * ---------------------------------------------------------------------- */

function Spheres({
  count,
  radii,
  material,
  geometry,
  castShadow,
}: {
  count: number;
  radii: number[];
  material: THREE.Material;
  geometry: THREE.BufferGeometry;
  castShadow: boolean;
}) {
  const [ref, api] = useSphere(
    (index) => ({
      args: [radii[index]],
      mass: massFor(radii[index]),
      ...BODY_DAMPING,
      position: spawn(),
      /* Each body starts at its own random orientation. The glyph is a UV map
         in the sphere's own object space, so it is carried by the body's
         quaternion: it points wherever the sphere is facing and keeps turning
         with it as the cluster tumbles, exactly as paint would. Without this
         every sphere is born at identity and the whole cluster stares in the
         same direction. */
      rotation: [
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
      ],
    }),
    useRef<THREE.InstancedMesh>(null),
    [radii]
  );

  /* Cannon composes instance matrices from position and rotation only, so the
     per-instance scale has to be handed to it separately or every sphere
     renders at radius 1. */
  useEffect(() => {
    for (let i = 0; i < count; i += 1) {
      api.at(i).scaleOverride([radii[i], radii[i], radii[i]]);
    }
  }, [api, count, radii]);

  /* Live velocities, so the speed cap below has something to read. Cannon runs
     in a worker, so a subscription is the only way back out. */
  const velocities = useMemo(() => new Float32Array(count * 3), [count]);
  useEffect(() => {
    const unsubscribe = Array.from({ length: count }, (_, i) =>
      api.at(i).velocity.subscribe((v) => {
        velocities[i * 3] = v[0];
        velocities[i * 3 + 1] = v[1];
        velocities[i * 3 + 2] = v[2];
      })
    );
    return () => unsubscribe.forEach((u) => u());
  }, [api, count, velocities]);

  const scratch = useMemo(
    () => ({
      mat: new THREE.Matrix4(),
      pos: new THREE.Vector3(),
      delta: new THREE.Vector3(),
    }),
    []
  );

  /** The running slot displacement this group has already been moved by.
      Seeded from the total as it stands at mount, not from zero: the total is
      module state and outlives any one group, so a group remounted after a
      resize would otherwise read every jump since page load as one it still
      owed and hurl itself across the page on its first frame. */
  const appliedShift = useMemo(() => clumpState.shift.clone(), []);

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;

    /* Carry the cluster with its slot across a jump. Ahead of the visibility
       check below, not behind it: a group that was hidden used to return
       early and never consume the jump at all, so it came back holding a
       position from before the jump and had to fly in from off-screen. */
    if (!appliedShift.equals(clumpState.shift)) {
      scratch.delta.subVectors(clumpState.shift, appliedShift);
      appliedShift.copy(clumpState.shift);
      for (let i = 0; i < count; i += 1) {
        mesh.getMatrixAt(i, scratch.mat);
        scratch.pos.setFromMatrixPosition(scratch.mat).add(scratch.delta);
        api.at(i).position.set(scratch.pos.x, scratch.pos.y, scratch.pos.z);
      }
    }

    /* Hidden once the hero is gone, but still driven. Stopping the forces
       here was the other half of the vanish: the cluster froze wherever the
       fade caught it, so scrolling back up revealed it parked off its slot
       and it had to travel in from there. Left tethered, it spends the time
       off-screen drifting home, and is already settling when it fades in.
       Cannon steps the world either way, so this costs one short loop. */
    mesh.visible = clumpState.presence > 0.01;

    for (let i = 0; i < count; i += 1) {
      /* Read out of the instance matrix, never off a mesh's `.position`.
         Cannon writes `object.matrix` directly and leaves `matrixAutoUpdate`
         off, so `.position` keeps whatever it was initialised to. Computing
         the tether from that gives a force that points the same way no matter
         where the body has actually got to, which does not restore it to the
         cluster — it accelerates it out of the scene. */
      mesh.getMatrixAt(i, scratch.mat);
      scratch.pos.setFromMatrixPosition(scratch.mat);

      /* Containment net. The tether alone should never let a body get this
         far, but a solver blow-up or a tab resuming from the background can
         put one somewhere the restoring force would take seconds to reel in,
         and in the meantime it is visibly sailing off the page. Anything past
         the leash gets put straight back. */
      if (scratch.pos.distanceTo(centreTarget) > ESCAPE_RADIUS) {
        api.at(i).position.set(
          centreTarget.x + (Math.random() - 0.5) * 1.2,
          centreTarget.y + (Math.random() - 0.5) * 1.2,
          (Math.random() - 0.5) * 1.2
        );
        api.at(i).velocity.set(0, 0, 0);
        api.at(i).angularVelocity.set(0, 0, 0);
        continue;
      }

      /* Scaled by the body's own mass, which turns the tether from a force
         into an acceleration. Without this, enlarging the spheres silently
         changes the whole feel: mass goes with the cube of the radius, so a
         50% bigger sphere is nearly three and a half times heavier and the
         same force barely moves it. Multiplying it back out means the cluster
         behaves identically whatever size its members are, and the tuning
         constants below stay meaningful. */
      api
        .at(i)
        .applyForce(
          tetherForce(scratch.pos, forceScratch)
            .multiplyScalar(massFor(radii[i]))
            .toArray(),
          [0, 0, 0]
        );

      /* Speed ceiling. A fast flick of the cursor used to hand the cluster far
         more momentum than the damping could absorb, and it spent the next
         second overcorrecting. */
      const vx = velocities[i * 3];
      const vy = velocities[i * 3 + 1];
      const vz = velocities[i * 3 + 2];
      const speed = Math.hypot(vx, vy, vz);
      /* The ceiling lifts with distance from home. A single flat cap has to
         serve two jobs at once and cannot: low enough that the settled
         cluster is not darty, it is also low enough that a body a screen
         behind it can never catch up before the fade hides it. Near the
         cluster this is exactly the old cap; far from it the body is allowed
         to travel, which is what lets it float back into place rather than
         needing to be teleported there. */
      const ceiling =
        tuning.maxSpeed * (1 + Math.min(scratch.pos.distanceTo(centreTarget) / 3, 3));
      if (speed > ceiling) {
        const k = ceiling / speed;
        api.at(i).velocity.set(vx * k, vy * k, vz * k);
      }
    }
  });

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, count]}
      castShadow={castShadow}
      /* Deliberately NOT receiving. The spheres still cast onto the ground,
         but taking each other's shadows was what put heavy dark patches
         across a surface that should read as bright and reflective. */
      receiveShadow={false}
      frustumCulled={false}
    />
  );
}

/* -------------------------------------------------------------------------
 * The pointer collider
 *
 * Kinematic, so it moves exactly where it is told and is never pushed back by
 * what it hits. Its position is eased rather than set from the raw cursor:
 * teleporting a kinematic body is what turns a quick flick into an explosion.
 * ---------------------------------------------------------------------- */

function Pointer({ radius }: { radius: number }) {
  const [, api] = useSphere(() => ({
    args: [radius],
    type: 'Kinematic',
    position: [0, 0, 40],
  }));

  useFrame((_, rawDelta) => {
    if (!pointerState.active || clumpState.presence < 0.5) {
      // Parked well behind the cluster, where it cannot touch anything.
      api.position.set(0, 0, 40);
      return;
    }
    const dt = Math.min(rawDelta, 1 / 30);
    // Slower easing: the collider itself was part of what felt darty.
    pointerSmooth.lerp(pointerTarget, 1 - Math.exp(-5 * dt));
    api.position.set(pointerSmooth.x, pointerSmooth.y, pointerSmooth.z);
  });

  return null;
}

/* -------------------------------------------------------------------------
 * Placement, pointer tracking and lighting
 * ---------------------------------------------------------------------- */

export default function HeroClump({
  count = 17,
  text = 'NPA',
  colors: colorOverrides,
  cohesion = 10.5,
  grabStrength = 10,
  idleAttraction = 1.1,
  maxSpeed = 3.2,
  sizeRange = [0.62, 1],
  fill = 0.82,
  lowPower = false,
}: HeroClumpProps) {
  const { size, camera, gl } = useThree();

  tuning.cohesion = cohesion;
  tuning.grabStrength = grabStrength;
  tuning.idleAttraction = idleAttraction;
  tuning.maxSpeed = maxSpeed;

  const colors = useMemo(
    () => ({ ...DEFAULT_COLORS, ...colorOverrides }),
    [colorOverrides]
  );

  const heroVersion = useSyncExternalStore(
    subscribeHeroField,
    getHeroFieldVersion,
    () => 0
  );
  const heroEl = useMemo(
    () => getHeroFieldElement(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [heroVersion]
  );
  const stageEl = useMemo(
    () => heroEl?.closest<HTMLElement>('[data-hero-stage]') ?? heroEl,
    [heroEl]
  );

  const bodies = lowPower ? Math.round(count * 0.6) : count;

  /* Relative sizes within the cluster, weighted toward the large end.
     The exponent is the shape of the distribution: above 1 it falls away
     quickly and the cluster becomes a few big spheres packed out with a
     crowd of little ones; below 1 it stays high, so most bodies sit in the
     mid-to-large band and only the tail runs small. Combined with a floor
     well up the range, that raises the average size while keeping a visible
     spread rather than a set of identical balls. */
  const baseRadii = useMemo(
    () =>
      Array.from({ length: bodies }, (_, i) => {
        const t = i / Math.max(1, bodies - 1);
        const base =
          sizeRange[0] + (sizeRange[1] - sizeRange[0]) * Math.pow(1 - t, 0.6);
        return base * (0.88 + Math.random() * 0.24);
      }),
    [bodies, sizeRange]
  );

  /* Fitted to the hero's own slot.
     Radii are baked into the physics shapes at creation, so they cannot be
     re-tuned per frame — but a fixed world size is wrong anyway, because the
     cluster sits beside the headline and the space available for it is the
     slot, not the scene. Solving for the multiplier that makes the *packed*
     cluster fill a set fraction of that slot means it is proportionate at
     every viewport instead of correct at one and crowding the copy at others.

     Packed radius of N spheres is the cube root of their summed volume over a
     packing fraction, so the multiplier falls straight out of it. Quantised,
     because changing radii rebuilds the physics world. */
  const radii = useMemo(() => {
    const rect = heroEl?.getBoundingClientRect();
    if (!rect || rect.width === 0 || size.height === 0) return baseRadii;

    const persp = camera as THREE.PerspectiveCamera;
    const distance = persp.position?.z ?? 11;
    const visibleHeight =
      2 * distance * Math.tan(((persp.fov ?? 38) * Math.PI) / 360);
    const perPixel = visibleHeight / size.height;

    const slotWorld = Math.min(rect.width, rect.height) * perPixel;
    const targetRadius = (slotWorld * fill) / 2;
    /* 0.33, not a textbook sphere-packing figure. These bodies are held by a
       soft tether and push each other apart on contact, so they settle far
       looser than dense packing would predict — measured against the slot,
       0.62 came out about a quarter too large on screen. */
    const packedRadius = Math.cbrt(
      baseRadii.reduce((sum, r) => sum + r ** 3, 0) / 0.33
    );
    if (packedRadius === 0) return baseRadii;

    // 0.05 steps: fine enough to look right, coarse enough not to thrash.
    const k = Math.max(0.05, Math.round((targetRadius / packedRadius) / 0.05) * 0.05);
    return baseRadii.map((r) => r * k);
  }, [baseRadii, heroEl, size.height, camera, fill]);

  /* The cursor collider tracks the cluster's own scale. */
  const scale = useMemo(
    () => radii.reduce((a, r) => a + r, 0) / Math.max(1, radii.length) / 0.45,
    [radii]
  );

  const letters = useMemo(() => text.split('').filter((c) => c.trim()), [text]);

  /* Every sphere carries a glyph, so the cluster is split into one group per
     letter and each group becomes its own InstancedMesh. Radii are dealt out
     round-robin, which keeps the size distribution even across the letters
     rather than giving one of them all the big ones. */
  const groups = useMemo(() => {
    const buckets: number[][] = letters.map(() => []);
    radii.forEach((r, i) => buckets[i % letters.length].push(r));
    return letters.map((char, k) => ({ char, radii: buckets[k] }));
  }, [radii, letters]);

  /* A small studio in a box, pre-filtered into an environment map. This is
     what keeps the unlit side of each sphere showing colour and form instead
     of falling to a flat silhouette, and it costs no fetch: building the rig
     here rather than loading an HDR keeps the page off third-party hosts. */
  const envMap = useMemo(() => {
    const envScene = new THREE.Scene();
    /* A lightbox, not a dark room with lamps in it.
       This background fills every direction the panels do not cover — and at
       a sphere's silhouette the surface normal points sideways, sampling
       exactly those directions. A dark background therefore draws a dark ring
       around every sphere, which is what kept reading as a hard outline. It
       is not a fresnel, an outline pass or ambient occlusion: there are none
       of those in this scene. Lifting the surround is the fix. */
    envScene.background = new THREE.Color('#a5a5a5');

    const panel = (
      hex: string,
      gain: number,
      pos: [number, number, number],
      w: number,
      h: number
    ) => {
      const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
      mat.color.set(hex).multiplyScalar(gain);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      mesh.position.set(pos[0], pos[1], pos[2]);
      mesh.lookAt(0, 0, 0);
      envScene.add(mesh);
    };

    /* Bright and wrapped all the way round. The spheres are lit by this far
       more than by the lamps below, which is what keeps every one of them
       evenly lit instead of modelled into a light side and a dark one. */
    /* Gains are deliberately modest. The canvas runs linear with no tone
       mapping, so there is no shoulder to roll highlights off: push the
       environment hard and the tan clips straight to yellow instead of
       reading as the colour it actually is. Even lighting comes from the
       panels surrounding the subject, not from their brightness. */
    /* The ratio between the brightest panel and the surround is the whole
       game: it is what sets how dark the darkest part of a sphere can get.
       It used to be about 3:1, which is a lit side and a shaded side. Here it
       is closer to 2:1, so the cluster reads as evenly lit and nothing drops
       toward black — the form is carried by a shallow gradient and by the
       silhouette, not by shadow.

       The panels are also larger and nearer. A broad source is the only thing
       that makes a broad highlight; softening cannot be faked with blur on a
       small one. The horizon pair matter most for the contour, sitting level
       with the camera so they light precisely the grazing angles. */
    panel('#ffffff', 1.45, [0, 6, 1], 22, 22); // overhead soft box
    panel('#ffffff', 1.12, [0, 0, 8], 20, 20); // frontal fill, camera side
    panel('#ffffff', 1.05, [-8, 0, 0], 18, 18); // horizon left
    panel('#ffffff', 1.05, [8, 0, 0], 18, 18); // horizon right
    panel('#ebebeb', 0.92, [0, -6.5, 0], 20, 20); // floor bounce

    const pmrem = new THREE.PMREMGenerator(gl);
    /* three caps the blur at 20 samples and anything past ~0.05 asks for
       hundreds, then clips rather than blurring further. The softness comes
       from the panels being large diffuse shapes, not from this number. */
    const rt = pmrem.fromScene(envScene, 0.04);

    envScene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    pmrem.dispose();

    return rt.texture;
  }, [gl]);

  useEffect(() => () => void envMap.dispose(), [envMap]);

  /* Segment count matters at this size: the silhouette is literally the
     polygon outline, and 32 sides reads as faceted on a large sphere. */
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 56, 36), []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  /* One material per letter, identical but for the map, so every sphere in
     the cluster is visibly the same substance. Pulled from a module cache so
     the scroll fade below can write to them. */
  const materials = useMemo(
    () =>
      letters.map((char) =>
        getLetterMaterial(char, colors.body, colors.ink, envMap)
      ),
    [letters, colors.body, colors.ink, envMap]
  );

  const groundMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(colors.ground),
        roughness: 1,
        metalness: 0,
      }),
    [colors.ground]
  );
  useEffect(() => () => groundMaterial.dispose(), [groundMaterial]);

  const groundRef = useRef<THREE.Mesh>(null);
  const keyRef = useRef<THREE.DirectionalLight>(null);

  /* ---- Pointer, in world units on the cluster's plane ---- */
  useEffect(() => {
    const persp = camera as THREE.PerspectiveCamera;

    const toWorld = (clientX: number, clientY: number) => {
      const distance = persp.position?.z ?? 11;
      const visibleHeight =
        2 * distance * Math.tan(((persp.fov ?? 38) * Math.PI) / 360);
      const perPixel = visibleHeight / size.height;
      pointerTarget.set(
        (clientX - size.width / 2) * perPixel,
        -(clientY - size.height / 2) * perPixel,
        0
      );
    };

    const onMove = (e: PointerEvent) => {
      toWorld(e.clientX, e.clientY);
      // First sighting: start the eased pointer where the real one already is.
      if (!pointerState.active) pointerSmooth.copy(pointerTarget);
      pointerState.active = true;
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const rect = heroEl?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const radius = Math.min(rect.width, rect.height) * 0.5;
      if (Math.hypot(e.clientX - cx, e.clientY - cy) > radius) return;

      e.preventDefault();
      document.body.style.userSelect = 'none';
      window.getSelection()?.removeAllRanges();
      pointerState.down = true;
      toWorld(e.clientX, e.clientY);
    };

    const release = () => {
      if (!pointerState.down) return;
      pointerState.down = false;
      document.body.style.userSelect = '';
    };

    const onLeave = () => {
      pointerState.active = false;
      release();
    };

    const onSelectStart = (e: Event) => {
      if (pointerState.down) e.preventDefault();
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', release, { passive: true });
    window.addEventListener('pointercancel', release, { passive: true });
    window.addEventListener('pointerleave', onLeave, { passive: true });
    document.addEventListener('selectstart', onSelectStart);

    return () => {
      document.body.style.userSelect = '';
      pointerState.down = false;
      pointerState.active = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('selectstart', onSelectStart);
    };
  }, [camera, size.width, size.height, heroEl]);

  /* ---- Track the DOM slot, and fit the ground to the hero section ----
     Priority -1 so this runs ahead of the sphere groups' own callbacks.
     React registers child effects before parent ones, so by default those
     groups run first and would consume a detected scroll jump a frame late —
     leaving the cluster drawn at its old screen position for that frame. */
  useFrame((_, rawDelta) => {
    const frameDelta = Math.min(rawDelta, 1 / 30);
    const persp = camera as THREE.PerspectiveCamera;
    const distance = persp.position?.z ?? 11;
    const fov = persp.fov ?? 38;
    const perPixel = (2 * distance * Math.tan((fov * Math.PI) / 360)) / size.height;

    const rect = heroEl?.getBoundingClientRect();
    if (rect) {
      /* Fades across the last 45% of the hero's exit. Derived from the rect
         rather than from a scroll handler, so a dropped frame during a fast
         flick just means a bigger step along the same curve — it can never
         skip a state or land on the wrong side of a threshold. */
      const target = Math.min(
        1,
        Math.max(0, rect.bottom / (size.height * 0.45))
      );
      /* Eased AND rate-limited. The easing alone was the bug: it is
         normalised against delta time, so a scroll that jumps the target
         straight to zero — or a dropped frame that makes `frameDelta` large —
         lets `1 - exp(-6 * dt)` approach 1 and the value lands on the target
         in a single step. That is the hard cut. Capping how much `presence`
         may move per second means the fade always takes at least
         FADE_SECONDS however fast the page is scrolled or how many frames
         were missed getting here. */
      const eased =
        (target - clumpState.presence) * (1 - Math.exp(-6 * frameDelta));
      const limit = (1 / FADE_SECONDS) * frameDelta;
      clumpState.presence +=
        Math.sign(eased) * Math.min(Math.abs(eased), limit);

      /* Transparent only while actually fading, so at full strength the
         spheres stay depth-sorted against each other and pay nothing. */
      const presence = clumpState.presence;
      const fading = presence < 0.995;
      for (const char of letters) {
        const m = getLetterMaterial(char, colors.body, colors.ink, envMap);
        if (m.transparent !== fading) {
          m.transparent = fading;
          m.needsUpdate = true;
        }
        m.opacity = presence;
      }

      const prevX = centreTarget.x;
      const prevY = centreTarget.y;

      centreTarget.set(
        (rect.left + rect.width / 2 - size.width / 2) * perPixel,
        -(rect.top + rect.height / 2 - size.height / 2) * perPixel,
        0
      );

      if (lastCentreValid) {
        const jx = centreTarget.x - prevX;
        const jy = centreTarget.y - prevY;
        /* Measured against the viewport rather than in fixed world units, so
           the same gesture counts the same way on any screen: `perPixel`
           scales with the canvas, and a constant threshold therefore meant
           something different on every one. */
        const jumpLimit = size.height * perPixel * JUMP_FRACTION;
        if (Math.hypot(jx, jy) > jumpLimit) {
          /* Accumulated, not assigned. See the note on `clumpState.shift`. */
          clumpState.shift.x += jx;
          clumpState.shift.y += jy;
        }
      }
      lastCentre.set(prevX, prevY, 0);
      lastCentreValid = true;

      // The key light rides with the cluster so the modelling never drifts.
      if (keyRef.current) {
        keyRef.current.position.set(centreTarget.x + 4, centreTarget.y + 5, 8);
        keyRef.current.target.position.copy(centreTarget);
        keyRef.current.target.updateMatrixWorld();
      }
    }

    const ground = groundRef.current;
    const stageRect = stageEl?.getBoundingClientRect();
    if (ground && stageRect) {
      const depth = distance + 7;
      const perPixelAtDepth =
        (2 * depth * Math.tan((fov * Math.PI) / 360)) / size.height;
      ground.position.x =
        (stageRect.left + stageRect.width / 2 - size.width / 2) * perPixelAtDepth;
      ground.position.y =
        -(stageRect.top + stageRect.height / 2 - size.height / 2) * perPixelAtDepth;
      ground.scale.set(
        stageRect.width * perPixelAtDepth * 1.02,
        stageRect.height * perPixelAtDepth * 1.01,
        1
      );
      ground.visible = stageRect.bottom > 0 && stageRect.top < size.height;
    }
  }, -1);

  return (
    <>
      {/* Fill first, key second. The shadowed side of every sphere is carried
          by the hemisphere and the environment, so it keeps its colour instead
          of dropping to a black silhouette. */}
      {/* Ground colour lifted well off black and ambient roughly doubled:
          together these set how light the shaded side sits, and they are
          the right place to fix it — dropping the key instead would have
          flattened the highlight the surface depends on. */}
      <hemisphereLight args={[colors.key, '#b4b4b4', 0.18]} />
      {/* Flat fill. Its whole job is to put a floor under the darkest pixel on
          the cluster so no part of any sphere approaches black. Eased back a
          little from the fully shadowless pass, so a soft grey returns at the
          contact points and reads as form — without any edge going near
          black, which is what the heavy version got wrong. */}
      <ambientLight intensity={0.1} />

      <directionalLight
        ref={keyRef}
        /* Very low, and lower than it was. A directional light is a point
           source: however wide the panels around it are, its specular lobe is
           the one thing in the scene that can still put a hard bright pip on
           a sphere, and at 0.62 it did. Kept only for the faint directional
           cue and the ground shadow; the modelling is the lightbox's. */
        intensity={0.3}
        color={colors.key}
        castShadow={!lowPower}
        /* Variance shadow maps, so `radius` and `blurSamples` actually blur
           the result. Percentage-closer filtering ignores both and gives the
           hard-cut edge this used to have. */
        shadow-mapSize={[2048, 2048]}
        shadow-radius={9}
        shadow-blurSamples={20}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-bias={-0.0006}
        shadow-normalBias={0.03}
      />
      {/* Counter-rim, neutral: it separates the silhouette from the ground
          without laying a colour cast over a white surface. */}
      {/* Raised. Coming from behind and below, this catches the far edge of
          each sphere so the surface does not fall away to grey just before
          it meets the background — that dip is what reads as a dark
          outline drawn around the silhouette. */}
      <directionalLight position={[-7, -1, -3]} intensity={0.2} color={colors.rim} />

      <mesh ref={groundRef} position={[0, 0, -7]} material={groundMaterial} receiveShadow>
        <planeGeometry args={[1, 1]} />
      </mesh>

      {/* No world gravity: the cluster is held by its own tether, so it floats
          rather than piling up at the bottom of the frame. Restitution is low
          because bouncy contacts were most of the twitch. */}
      <Physics
        gravity={[0, 0, 0]}
        iterations={14}
        broadphase="SAP"
        allowSleep={false}
        defaultContactMaterial={{ restitution: 0.05, friction: 0.35 }}
      >
        {groups.map((group, k) => (
          <Spheres
            key={`${scale}-${group.char}-${group.radii.length}`}
            count={group.radii.length}
            radii={group.radii}
            geometry={geometry}
            material={materials[k]}
            castShadow={!lowPower}
          />
        ))}
        <Pointer radius={scale} />
      </Physics>
    </>
  );
}
