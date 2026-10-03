import type { FlowSim } from './flow';

/** Colours and faces, read off the live page so the canvas can never disagree with the CSS. */
export interface ReelTheme {
  ink: string;
  ink3: string;
  accent: string;
  /** Resolved font-family strings. next/font hashes the names, so these come from computed style. */
  label: string;
  display: string;
}

/** Every word the canvas draws, in the visitor's language. */
export interface ReelCopy {
  queue: string;
  throughput: string;
  bottleneck: string;
  layers: string[];
  /** The counter's unit, as in "WEEK / 02". */
  week: string;
  /** One week's name under the timeline, with `{n}` for its number. */
  weekOf: string;
  deploy: string;
  mvp: string;
}

/** One target per point, per formation. Structure of arrays, so the frame loop stays in typed memory. */
export interface Targets {
  x: Float32Array;
  y: Float32Array;
  /** Radius, CSS px. */
  r: Float32Array;
  /** Opacity, 0..1. */
  a: Float32Array;
  /** 0 ink, 1 walnut. Interpolated, so a point can warm on its way somewhere. */
  c: Float32Array;
}

export function makeTargets(n: number): Targets {
  return {
    x: new Float32Array(n),
    y: new Float32Array(n),
    r: new Float32Array(n),
    a: new Float32Array(n),
    c: new Float32Array(n),
  };
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What a formation is told about the frame it is composing into. */
export interface Layout {
  W: number;
  H: number;
  /** Points available, including the walnut one at index 0. */
  N: number;
  portrait: boolean;
  /** Frame padding, px. */
  pad: number;
  /** The corner the caption occupies. Compositions keep out of it. */
  caption: Rect;
  /** The vertical band the art may use without meeting the caption. */
  band: { top: number; bottom: number };
  theme: ReelTheme;
  copy: ReelCopy;
  /** The one physical simulation, shared by both flow shots. */
  sim: FlowSim;
}

/**
 * A shot's picture.
 *
 * `targets` says where every point wants to be; the engine owns getting them
 * there, on springs. `overlay` draws the vector annotation that goes with the
 * points, in two passes: under them (structure) and over them (things that
 * must stay legible, like a cursor).
 */
export interface Formation {
  kind: 'flow' | 'shape';
  /** Spring stiffness and damping ratio the points settle with in this shot. */
  stiffness: number;
  damping: number;
  layout(L: Layout): void;
  targets(s: number, t: number, out: Targets): void;
  overlay(g: CanvasRenderingContext2D, s: number, t: number, layer: 0 | 1, vis: number): void;
  /** Flow shots set the simulation's parameters from their own local progress. */
  configure?(sim: FlowSim, s: number): void;
}
