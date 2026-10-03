import { resetGlyphCache } from './draw';
import { FlowSim } from './flow';
import { FlowFormation } from './formations/flow';
import { InterfaceFormation } from './formations/interface';
import { MarkFormation } from './formations/mark';
import { NetworkFormation } from './formations/network';
import { sortKey } from './formations/shared';
import { TimelineFormation } from './formations/timeline';
import { clamp, easeInOutCubic, easeInOutSine, lerp, rng, TAU } from './math';
import { activeShot, CUT_SECONDS, localProgress, type Located } from './shots';
import type { Formation, Layout, ReelCopy, ReelTheme, Targets } from './types';
import { makeTargets } from './types';

/** How staggered a cut is across the frame: 0 moves every point at once, 1 strictly one after another. */
const SPREAD = 0.55;
/**
 * Exposure for the motion blur, seconds. Points are drawn as streaks this long.
 * Short on purpose: long enough that a point in flight reads as moving, short
 * enough that a fast flow still reads as points and not as hatching.
 */
const SHUTTER = 0.014;
/** Longest streak drawn, px, however fast a point is going. */
const STREAK_MAX = 9;
/** How much a point grows at the top of its flight, as if lifting off the page. */
const LIFT = 0.35;
/**
 * How much a point thins out at the top of its flight. Moving things read
 * lighter than still ones, and a whole population crossing the frame at full
 * strength massed into a dark cloud mid-cut.
 */
const THIN = 0.38;
/** How far a point's path may bow sideways in a cut, as a fraction of the distance travelled. */
const BOW = 0.36;
/** The radii points are batched into for drawing. */
const WIDTHS = [0.65, 0.85, 1.05, 1.3, 1.65, 2.2];
const ALPHAS = 8;
const BUCKETS = 2 * ALPHAS * WIDTHS.length;

export interface EngineOptions {
  particles: number;
  theme: ReelTheme;
  copy: ReelCopy;
}

/**
 * The reel's renderer: one population of points, six formations, and the
 * cuts between them.
 *
 * Each frame the formations say where every point wants to be; the engine
 * blends between the outgoing and incoming shot during a cut, staggered by
 * each point's position so the change sweeps across the frame behind a
 * scanline, and then moves the points there on springs. Because the targets
 * are pure functions of the playhead and the springs are the only state,
 * scrubbing backwards just runs the same machinery towards earlier targets.
 *
 * Drawn with the 2D canvas, not WebGL. The site's WebGL lives in one shared
 * context behind the page, and a second one for a section would break that
 * rule; this also keeps the points registered to the captions and the
 * scrubber to the pixel, since they are drawn in the same frame as the DOM
 * they sit under rather than in a canvas that follows it a frame behind.
 */
export class ReelEngine {
  readonly N: number;
  readonly sim: FlowSim;
  playhead = 0;

  private readonly canvas: HTMLCanvasElement;
  private readonly g: CanvasRenderingContext2D;
  private W = 1;
  private H = 1;
  private dpr = 1;
  private theme: ReelTheme;
  private copy: ReelCopy;
  private layoutInfo!: Layout;
  private ready = false;

  private readonly formations: Formation[];
  private readonly A: Targets;
  private readonly B: Targets;

  private readonly px: Float32Array;
  private readonly py: Float32Array;
  private readonly vx: Float32Array;
  private readonly vy: Float32Array;
  private readonly pr: Float32Array;
  private readonly pa: Float32Array;
  private readonly pc: Float32Array;

  /*
   * Which target each point answers to.
   *
   * Drawn formations index their slots by position, left to right; the flow
   * simulation indexes its bodies by nothing in particular. `slot[i]` is the
   * slot point i takes in every drawn shot and `body[i]` the body it rides in
   * the flow shots. They are re-paired by rank at each cut between the two
   * kinds, so the jam's leftmost points become the diagram's leftmost points
   * rather than scattering across it. Index 0, the walnut point, is always
   * slot 0 and body 0.
   */
  private readonly slot: Int32Array;
  private readonly body: Int32Array;
  private readonly rank: Int32Array;

  /* Per point, per cut: when it sets off, and how far its path bows. */
  private readonly delay: Float32Array;
  private readonly arc: Float32Array;
  private readonly jitter: Float32Array;
  private cutKey = -1;

  /** The shot on screen when no cut is playing. */
  private current = 0;
  /** The cut playing, if any. `m` runs on time, forwards or back. */
  private cut: { from: number; to: number; m: number } | null = null;

  private readonly order: Int32Array;
  private readonly keys: Int16Array;
  private readonly counts = new Int32Array(BUCKETS);
  private readonly offsets = new Int32Array(BUCKETS);

  private time = 0;
  private pointer = { x: -1e4, y: -1e4, on: false };

  constructor(canvas: HTMLCanvasElement, options: EngineOptions) {
    const g = canvas.getContext('2d');
    if (!g) throw new Error('2D canvas unavailable');
    this.canvas = canvas;
    this.g = g;
    this.N = Math.max(200, Math.floor(options.particles));
    this.theme = options.theme;
    this.copy = options.copy;
    this.sim = new FlowSim(this.N);

    this.formations = [
      new FlowFormation('jam'),
      new NetworkFormation(),
      new InterfaceFormation(),
      new TimelineFormation(),
      new FlowFormation('release'),
      new MarkFormation(),
    ];

    const n = this.N;
    this.A = makeTargets(n);
    this.B = makeTargets(n);
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.pr = new Float32Array(n);
    this.pa = new Float32Array(n);
    this.pc = new Float32Array(n);
    this.slot = new Int32Array(n);
    this.body = new Int32Array(n);
    this.rank = new Int32Array(n);
    this.delay = new Float32Array(n);
    this.arc = new Float32Array(n);
    this.jitter = new Float32Array(n);
    this.order = new Int32Array(n);
    this.keys = new Int16Array(n);

    const random = rng(5);
    for (let i = 0; i < n; i += 1) {
      this.slot[i] = i;
      this.body[i] = i;
      // Each point bows to its own side by its own amount, so a cut reads as a flock, not a tween.
      this.arc[i] = (random() - 0.5) * BOW;
      this.jitter[i] = (random() - 0.5) * 0.08;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Setup                                                               */
  /* ------------------------------------------------------------------ */

  resize(width: number, height: number, dpr: number) {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    const changed = w !== this.W || h !== this.H || dpr !== this.dpr || !this.ready;
    if (!changed) return;
    this.W = w;
    this.H = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.relayout(true);
  }

  setTheme(theme: ReelTheme) {
    this.theme = theme;
    resetGlyphCache();
    if (this.ready) this.relayout(false);
  }

  setCopy(copy: ReelCopy) {
    this.copy = copy;
    if (this.ready) this.relayout(false);
  }

  /** Re-derives every formation from the frame. Only a size change restarts the simulation. */
  relayout(resetSim: boolean) {
    const { W, H } = this;
    const portrait = W / H < 1.05;
    const pad = clamp(Math.min(W, H) * 0.035, 12, 32);
    this.layoutInfo = {
      W,
      H,
      N: this.N,
      portrait,
      pad,
      caption: portrait
        ? { x: pad, y: H * 0.64, w: W - pad * 2, h: H * 0.36 - pad }
        : { x: pad, y: H * 0.6, w: W * 0.4, h: H * 0.4 - pad },
      band: portrait ? { top: H * 0.1, bottom: H * 0.6 } : { top: H * 0.1, bottom: H * 0.58 },
      theme: this.theme,
      copy: this.copy,
      sim: this.sim,
    };

    if (resetSim || !this.ready) {
      this.sim.layout(W, H, this.layoutInfo.band, portrait);
      this.sim.init('jam');
      for (let i = 0; i < this.N; i += 1) {
        this.slot[i] = i;
        this.body[i] = i;
      }
    }
    for (const f of this.formations) f.layout(this.layoutInfo);
    this.cutKey = -1;

    if (resetSim || !this.ready) this.snap();
    this.ready = true;
  }

  /** The index point i reads its target at, in a formation of this kind. */
  private at(f: Formation, i: number) {
    return f.kind === 'flow' ? this.body[i] : this.slot[i];
  }

  /** Puts every point exactly on its current target, with no velocity: no fly-in on first sight. */
  private snap() {
    this.current = activeShot(this.playhead);
    this.cut = null;
    const f = this.formations[this.current];
    f.targets(localProgress(this.current, this.playhead), this.time, this.A);
    for (let i = 0; i < this.N; i += 1) {
      const k = this.at(f, i);
      this.px[i] = this.A.x[k];
      this.py[i] = this.A.y[k];
      this.vx[i] = 0;
      this.vy[i] = 0;
      this.pr[i] = this.A.r[k];
      this.pa[i] = this.A.a[k];
      this.pc[i] = this.A.c[k];
    }
  }

  /** Jumps the playhead without easing, for placing the reel before it is first seen. */
  seek(p: number) {
    this.playhead = clamp(p);
    if (this.ready) this.snap();
  }

  setPointer(x: number, y: number, on: boolean) {
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointer.on = on;
  }

  /* ------------------------------------------------------------------ */
  /* Frame                                                               */
  /* ------------------------------------------------------------------ */

  update(rawDt: number, target: number) {
    if (!this.ready) return;
    const dt = Math.min(Math.max(rawDt, 0), 1 / 30);
    this.time += dt;

    // A light follow on the playhead, so a touch fling or a wheel notch lands softly.
    this.playhead += (clamp(target) - this.playhead) * (1 - Math.exp(-dt * 10));
    if (Math.abs(target - this.playhead) < 1e-5) this.playhead = clamp(target);

    const loc = this.advanceCut(dt);
    const fA = this.formations[loc.from];
    const fB = loc.to >= 0 ? this.formations[loc.to] : null;

    /* The simulation only runs while a flow shot is on screen or in a cut. */
    const flowF = fA.kind === 'flow' ? fA : fB?.kind === 'flow' ? fB : null;
    if (flowF) {
      flowF.configure?.(this.sim, flowF === fA ? loc.sFrom : loc.sTo);
      const p = this.sim.pointer;
      p.on = this.pointer.on;
      p.x = this.pointer.x;
      p.y = this.pointer.y;
      p.radius = clamp(Math.min(this.W, this.H) * 0.06, 34, 64);
      this.sim.step(dt);
    }

    fA.targets(loc.sFrom, this.time, this.A);
    if (fB) {
      fB.targets(loc.sTo, this.time, this.B);
      this.prepareCut(loc.from * 8 + loc.to, fA, fB, loc.m);
    } else {
      this.cutKey = -1;
    }

    this.integrate(dt, loc, fA, fB);
    this.sim.fresh.fill(0);
    this.draw(loc, fA, fB);
  }

  /**
   * Moves the edit along. The playhead says which shot the reel should be
   * on; if that is not the one on screen, a cut towards it starts, and plays
   * on time. Scrolling back across the boundary mid-cut runs the same cut in
   * reverse. A jump several shots away (from the scrubber, or a scrollbar
   * drag) re-aims the cut from whichever side of it is currently showing.
   */
  private advanceCut(dt: number): Located {
    const want = activeShot(this.playhead);
    const step = dt / CUT_SECONDS;
    let c = this.cut;

    if (!c) {
      if (want !== this.current) c = this.cut = { from: this.current, to: want, m: 0 };
    } else if (want === c.to) {
      c.m = Math.min(1, c.m + step);
    } else if (want === c.from) {
      c.m = Math.max(0, c.m - step);
    } else {
      const base = c.m >= 0.5 ? c.to : c.from;
      this.current = base;
      c = this.cut = base === want ? null : { from: base, to: want, m: 0 };
    }

    if (c && c.m >= 1) {
      this.current = c.to;
      c = this.cut = null;
    } else if (c && c.m <= 0 && want === c.from) {
      this.current = c.from;
      c = this.cut = null;
    }

    const p = this.playhead;
    if (!c) {
      return { from: this.current, to: -1, m: 0, sFrom: localProgress(this.current, p), sTo: 0 };
    }
    return {
      from: c.from,
      to: c.to,
      // Eased once here, so the scanline and the points' schedule share one curve.
      m: easeInOutSine(c.m),
      sFrom: localProgress(c.from, p),
      sTo: localProgress(c.to, p),
    };
  }

  /**
   * Set up once per cut: re-pair the two kinds of target if the cut crosses
   * between them, then decide the order points leave in, keyed to where they
   * are headed so the new drawing assembles in the direction the scanline
   * travels.
   */
  private prepareCut(key: number, fA: Formation, fB: Formation, m: number) {
    if (this.cutKey === key) return;
    this.cutKey = key;

    if (fA.kind !== fB.kind) {
      const flowTargets = fA.kind === 'flow' ? this.A : this.B;
      /* Whichever side is on screen is held still and the other is re-dealt
         to match it. Entering a cut from its far end (scrolling back up
         into it) is the reason both directions exist. */
      const onFlowSide = fA.kind === 'flow' ? m < 0.5 : m > 0.5;
      this.pair(flowTargets, onFlowSide);
    }

    const { portrait } = this.layoutInfo;
    const flowFirst = fA.kind === 'flow';
    const src = flowFirst ? this.A : this.B;
    const f = flowFirst ? fA : fB;
    for (let i = 0; i < this.N; i += 1) {
      const k = this.at(f, i);
      const d = portrait ? src.y[k] / this.H : src.x[k] / this.W;
      this.delay[i] = clamp(d + this.jitter[i]);
    }
  }

  /**
   * Ranks the simulated bodies by position and pairs them with the drawn
   * slots of the same rank. `keepFlow` holds each point on the body it is
   * riding and gives it a new slot; otherwise each point keeps its slot and is
   * handed a new body.
   */
  private pair(flow: Targets, keepFlow: boolean) {
    const n = this.N;
    const portrait = this.layoutInfo.portrait;
    const bodies = Array.from({ length: n - 1 }, (_, k) => k + 1);
    bodies.sort(
      (a, b) => sortKey(flow.x[a], flow.y[a], portrait) - sortKey(flow.x[b], flow.y[b], portrait)
    );
    if (keepFlow) {
      bodies.forEach((b, r) => {
        this.rank[b] = r + 1;
      });
      for (let i = 1; i < n; i += 1) this.slot[i] = this.rank[this.body[i]];
    } else {
      for (let i = 1; i < n; i += 1) this.body[i] = bodies[this.slot[i] - 1];
    }
    this.slot[0] = 0;
    this.body[0] = 0;
  }

  private integrate(dt: number, loc: Located, fA: Formation, fB: Formation | null) {
    const { A, B, px, py, vx, vy, sim, pointer, body, slot } = this;
    const m = loc.m;
    const reach = clamp(Math.min(this.W, this.H) * 0.1, 50, 110);
    const flowA = fA.kind === 'flow';
    const flowB = fB?.kind === 'flow';
    const anyShape = !flowA || (fB !== null && !flowB);

    for (let i = 0; i < this.N; i += 1) {
      const ia = flowA ? body[i] : slot[i];
      let tx: number;
      let ty: number;
      let tr: number;
      let ta: number;
      let tc: number;
      let K: number;
      let Z: number;
      let e = 0;

      if (!fB) {
        tx = A.x[ia];
        ty = A.y[ia];
        tr = A.r[ia];
        ta = A.a[ia];
        tc = A.c[ia];
        K = fA.stiffness;
        Z = fA.damping;
      } else {
        const ib = flowB ? body[i] : slot[i];
        const mi = clamp((m - this.delay[i] * SPREAD) / (1 - SPREAD));
        e = easeInOutCubic(mi);
        const ax = A.x[ia];
        const ay = A.y[ia];
        const dx = B.x[ib] - ax;
        const dy = B.y[ib] - ay;
        // In flight the path bows, and the point lifts off the page a little.
        const bump = Math.sin(Math.PI * e);
        tx = ax + dx * e - dy * this.arc[i] * bump;
        ty = ay + dy * e + dx * this.arc[i] * bump;
        tr = lerp(A.r[ia], B.r[ib], e) * (1 + LIFT * bump);
        ta = lerp(A.a[ia], B.a[ib], e) * (1 - THIN * bump);
        tc = lerp(A.c[ia], B.c[ib], e);
        K = lerp(fA.stiffness, fB.stiffness, e);
        Z = lerp(fA.damping, fB.damping, e);
      }

      /* A point wholly in a flow shot is the simulated body: it follows it
         exactly and inherits its velocity, which is also what makes the
         hand-off to a spring at the start of a cut seamless. */
      const followFlow = (flowA && e <= 0) || (flowB && e >= 1);
      if (followFlow) {
        const b = body[i];
        px[i] = tx;
        py[i] = ty;
        if (!sim.active[b]) {
          vx[i] = 0;
          vy[i] = 0;
        } else if (sim.fresh[b]) {
          vx[i] = sim.vx[b];
          vy[i] = sim.vy[b];
        } else {
          /* Smoothed, not copied. Inside the queue a body's velocity is mostly
             the spacing constraint shoving it back and forth a fraction of a
             pixel per step, which is real but is not motion anyone should see:
             drawn as blur, it scribbled across the densest part of the jam.
             Averaging over a few frames keeps the steady drift of the flow and
             drops the shove. */
          vx[i] += (sim.vx[b] - vx[i]) * 0.2;
          vy[i] += (sim.vy[b] - vy[i]) * 0.2;
        }
      } else {
        /* The cursor parts the drawing: targets near it are pushed aside, and
           the springs carry the points there and back. */
        if (pointer.on && anyShape) {
          const ddx = tx - pointer.x;
          const ddy = ty - pointer.y;
          const d2 = ddx * ddx + ddy * ddy;
          if (d2 < reach * reach && d2 > 1e-4) {
            const d = Math.sqrt(d2);
            const f = 1 - d / reach;
            const push = f * f * reach * 0.5;
            tx += (ddx / d) * push;
            ty += (ddy / d) * push;
          }
        }
        const damp = 2 * Z * Math.sqrt(K);
        vx[i] += (K * (tx - px[i]) - damp * vx[i]) * dt;
        vy[i] += (K * (ty - py[i]) - damp * vy[i]) * dt;
        px[i] += vx[i] * dt;
        py[i] += vy[i] * dt;
      }

      this.pr[i] = tr;
      this.pa[i] = ta;
      this.pc[i] = tc;
    }
  }

  /** Where the cut's wipe line is, in px along the direction it sweeps. */
  private scanAt(m: number) {
    const extent = this.layoutInfo.portrait ? this.H : this.W;
    const d = (m - (1 - SPREAD) / 2) / SPREAD;
    return d * extent;
  }

  /* ------------------------------------------------------------------ */
  /* Drawing                                                             */
  /* ------------------------------------------------------------------ */

  private draw(loc: Located, fA: Formation, fB: Formation | null) {
    const g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.W, this.H);
    g.globalAlpha = 1;

    this.overlays(0, loc, fA, fB);
    this.points();
    this.overlays(1, loc, fA, fB);
    this.hero();
    if (fB) this.scanline(loc.m);
  }

  /** Vector layers wipe with the scanline: the old drawing ahead of it, the new one behind. */
  private overlays(layer: 0 | 1, loc: Located, fA: Formation, fB: Formation | null) {
    const g = this.g;
    if (!fB) {
      fA.overlay(g, loc.sFrom, this.time, layer, 1);
      return;
    }
    const portrait = this.layoutInfo.portrait;
    const at = this.scanAt(loc.m);
    const { W, H } = this;

    g.save();
    g.beginPath();
    if (portrait) g.rect(0, at, W, H - at);
    else g.rect(at, 0, W - at, H);
    g.clip();
    fA.overlay(g, loc.sFrom, this.time, layer, 1);
    g.restore();

    g.save();
    g.beginPath();
    if (portrait) g.rect(0, 0, W, at);
    else g.rect(0, 0, at, H);
    g.clip();
    fB.overlay(g, loc.sTo, this.time, layer, 1);
    g.restore();
  }

  /**
   * Every point is a short streak along its own velocity, which is motion
   * blur for free: at rest it is a dot, in flight it smears in the direction
   * it is travelling. Batched by colour, opacity and width, so the whole
   * population is a few dozen strokes.
   */
  private points() {
    const g = this.g;
    const { px, py, vx, vy, pr, pa, pc, keys, order, counts, offsets, W, H } = this;
    const edge = 26;

    counts.fill(0);
    for (let i = 1; i < this.N; i += 1) {
      const x = px[i];
      const y = py[i];
      const fade = Math.min(1, x / edge, (W - x) / edge, y / edge, (H - y) / edge);
      const a = pa[i] * fade;
      if (a < 0.03) {
        keys[i] = -1;
        continue;
      }
      const ci = pc[i] > 0.5 ? 1 : 0;
      const ai = Math.min(ALPHAS - 1, Math.floor(a * ALPHAS));
      const r = pr[i];
      let wi = 0;
      while (wi < WIDTHS.length - 1 && r > (WIDTHS[wi] + WIDTHS[wi + 1]) / 2) wi += 1;
      const key = (ci * ALPHAS + ai) * WIDTHS.length + wi;
      keys[i] = key;
      counts[key] += 1;
    }
    let acc = 0;
    for (let b = 0; b < BUCKETS; b += 1) {
      offsets[b] = acc;
      acc += counts[b];
    }
    for (let i = 1; i < this.N; i += 1) {
      const key = keys[i];
      if (key < 0) continue;
      order[offsets[key]] = i;
      offsets[key] += 1;
    }

    g.lineCap = 'round';
    let start = 0;
    for (let b = 0; b < BUCKETS; b += 1) {
      const count = counts[b];
      if (count === 0) continue;
      const wi = b % WIDTHS.length;
      const ai = Math.floor(b / WIDTHS.length) % ALPHAS;
      const ci = Math.floor(b / (WIDTHS.length * ALPHAS));
      g.strokeStyle = ci ? this.theme.accent : this.theme.ink;
      g.globalAlpha = (ai + 0.6) / ALPHAS;
      g.lineWidth = WIDTHS[wi] * 2;
      g.beginPath();
      for (let k = start; k < start + count; k += 1) {
        const i = order[k];
        let tx = vx[i] * SHUTTER;
        let ty = vy[i] * SHUTTER;
        const len = Math.hypot(tx, ty);
        if (len > STREAK_MAX) {
          tx *= STREAK_MAX / len;
          ty *= STREAK_MAX / len;
        } else if (len < 0.08) {
          tx = 0.08;
          ty = 0;
        }
        g.moveTo(px[i] - tx, py[i] - ty);
        g.lineTo(px[i], py[i]);
      }
      g.stroke();
      start += count;
    }
    g.globalAlpha = 1;
    g.lineCap = 'butt';
  }

  /** The walnut point: the reel's one constant, drawn last and ringed. */
  private hero() {
    const a = this.pa[0];
    if (a < 0.02) return;
    const g = this.g;
    const x = this.px[0];
    const y = this.py[0];
    const r = this.pr[0];

    g.strokeStyle = this.theme.accent;
    g.lineWidth = 1;
    g.globalAlpha = a * 0.32;
    g.beginPath();
    g.arc(x, y, r + 5.5 + Math.sin(this.time * 2.2) * 1.2, 0, TAU);
    g.stroke();

    let tx = this.vx[0] * SHUTTER;
    let ty = this.vy[0] * SHUTTER;
    const len = Math.hypot(tx, ty);
    if (len > STREAK_MAX) {
      tx *= STREAK_MAX / len;
      ty *= STREAK_MAX / len;
    } else if (len < 0.08) {
      tx = 0.08;
      ty = 0;
    }
    g.globalAlpha = a;
    g.lineWidth = r * 2;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x - tx, y - ty);
    g.lineTo(x, y);
    g.stroke();
    g.lineCap = 'butt';
    g.globalAlpha = 1;
  }

  /** The cut itself: a walnut hairline sweeping the frame with a faint wash behind it. */
  private scanline(m: number) {
    const at = this.scanAt(m);
    const portrait = this.layoutInfo.portrait;
    const extent = portrait ? this.H : this.W;
    if (at < -40 || at > extent + 40) return;
    const g = this.g;
    const strength = Math.sin(Math.PI * clamp(m));

    const wash = 90;
    const grad = portrait
      ? g.createLinearGradient(0, at - wash, 0, at)
      : g.createLinearGradient(at - wash, 0, at, 0);
    grad.addColorStop(0, 'rgba(107, 68, 35, 0)');
    grad.addColorStop(1, 'rgba(107, 68, 35, 0.07)');
    g.globalAlpha = strength;
    g.fillStyle = grad;
    if (portrait) g.fillRect(0, at - wash, this.W, wash);
    else g.fillRect(at - wash, 0, wash, this.H);

    g.strokeStyle = this.theme.accent;
    g.lineWidth = 1;
    g.globalAlpha = strength * 0.85;
    g.beginPath();
    if (portrait) {
      g.moveTo(0, at);
      g.lineTo(this.W, at);
    } else {
      g.moveTo(at, 0);
      g.lineTo(at, this.H);
    }
    g.stroke();
    g.globalAlpha = 1;
  }

  /* ------------------------------------------------------------------ */
  /* Stills                                                              */
  /* ------------------------------------------------------------------ */

  /**
   * One frame of one shot, fully settled, for the storyboard shown when the
   * visitor has asked for reduced motion.
   */
  still(shot: number, s: number) {
    if (!this.ready) return;
    const f = this.formations[shot];
    if (f.kind === 'flow') {
      f.configure?.(this.sim, s);
      this.sim.init(shot === 0 ? 'jam' : 'open');
      f.configure?.(this.sim, s);
      for (let k = 0; k < 40; k += 1) this.sim.step(1 / 60);
    }
    f.targets(s, 0, this.A);
    for (let i = 0; i < this.N; i += 1) {
      const k = this.at(f, i);
      this.px[i] = this.A.x[k];
      this.py[i] = this.A.y[k];
      this.vx[i] = 0;
      this.vy[i] = 0;
      this.pr[i] = this.A.r[k];
      this.pa[i] = this.A.a[k];
      this.pc[i] = this.A.c[k];
    }
    const loc: Located = { from: shot, to: -1, m: 0, sFrom: s, sTo: 0 };
    this.draw(loc, f, null);
  }
}
