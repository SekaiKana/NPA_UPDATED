import { clamp } from './math';

/**
 * The running order of the reel, and the one place its timing is decided.
 *
 * Both halves of the reel read this: the canvas engine to know which picture
 * to draw, and the React component to know which caption, shot counter and
 * scrubber segment go with it. Keeping it here is what stops the two drifting
 * apart by a frame at every cut.
 *
 * Weights are relative lengths, so a shot with more to show (the interface
 * assembling, the two weeks) gets more scroll to show it in.
 */
export const SHOTS = [
  { key: 'bottleneck', weight: 1 },
  { key: 'architecture', weight: 1.05 },
  { key: 'build', weight: 1.2 },
  { key: 'ship', weight: 1.2 },
  { key: 'flow', weight: 1 },
  { key: 'yours', weight: 0.8 },
] as const;

export type ShotKey = (typeof SHOTS)[number]['key'];

/**
 * How long a cut plays, seconds.
 *
 * Cuts run on time, not on the scroll. What happens inside a shot is the
 * visitor's to scrub: the throat giving way, the request routed through the
 * architecture, the interface assembling, the fortnight passing. The cut
 * between two shots is the editor's, and plays at the pace it was timed to
 * whether the visitor flicks past the boundary or creeps up to it, so there
 * is no half-made frame to stop on.
 */
export const CUT_SECONDS = 1.25;

/** Where a jump from the scrubber lands: just inside the shot, so it arrives from its start. */
export const LAND = 0.01;

const total = SHOTS.reduce((sum, s) => sum + s.weight, 0);

/** Start and end of every shot on the 0..1 playhead. */
export const RANGES: { start: number; end: number }[] = (() => {
  let acc = 0;
  return SHOTS.map((s) => {
    const start = acc / total;
    acc += s.weight;
    return { start, end: acc / total };
  });
})();

export interface Located {
  /** The shot on screen, or the outgoing one during a cut. */
  from: number;
  /** The incoming shot during a cut, otherwise -1. */
  to: number;
  /** 0..1 through the cut. */
  m: number;
  /** Local progress of each, 0..1. */
  sFrom: number;
  sTo: number;
}

/** How far the playhead is through shot `i`, 0..1. */
export const localProgress = (i: number, p: number) =>
  clamp((p - RANGES[i].start) / (RANGES[i].end - RANGES[i].start));

/** The shot the playhead is in. */
export function activeShot(p: number): number {
  const i = RANGES.findIndex((r) => p < r.end);
  return i === -1 ? RANGES.length - 1 : i;
}
