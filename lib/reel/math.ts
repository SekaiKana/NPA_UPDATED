/**
 * The small numeric toolkit the reel is animated with.
 *
 * Everything here is a pure function of its inputs. That is the property the
 * whole reel leans on: a shot's picture is computed from the playhead rather
 * than accumulated frame by frame, so scrubbing backwards is just asking the
 * same question with a smaller number, and there is no state to unwind.
 */

export const TAU = Math.PI * 2;

export const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Where `v` sits between `a` and `b`, clamped to 0..1. */
export const progress = (a: number, b: number, v: number) => clamp((v - a) / (b - a));

export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** The reel's version of the site's `power4.out`: arrives fast, settles long. */
export const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

/**
 * The step response of a damped spring, as a function of normalised time.
 *
 * Used wherever a pure function of the playhead needs to overshoot and ring
 * back the way the site's physical springs do. A bezier can only overshoot
 * once; this crosses the target and returns, which is what makes a flag
 * popping up or a chart reflowing read as having mass. At t = 1 it has
 * settled to within a fraction of a percent.
 */
export function springOut(t: number, zeta = 0.42, cycles = 1.6): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const omega = cycles * TAU;
  const wd = omega * Math.sqrt(1 - zeta * zeta);
  const decay = Math.exp(-zeta * omega * t);
  return 1 - decay * (Math.cos(wd * t) + ((zeta * omega) / wd) * Math.sin(wd * t));
}

/** Deterministic PRNG, so the architecture looks the same on every visit. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A point on a cubic bezier, written into `out` to keep the frame loop allocation-free. */
export function bezierPoint(
  x0: number, y0: number, x1: number, y1: number,
  x2: number, y2: number, x3: number, y3: number,
  t: number, out: { x: number; y: number }
) {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  out.x = a * x0 + b * x1 + c * x2 + d * x3;
  out.y = a * y0 + b * y1 + c * y2 + d * y3;
  return out;
}

/** Two-digit and four-digit readouts, in the tabular register of the labels. */
export const pad = (n: number, width = 2) => String(Math.max(0, Math.round(n))).padStart(width, '0');
