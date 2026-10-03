import { clamp, lerp, rng, smoothstep } from './math';

/**
 * The bottleneck, as a crowd simulation rather than an illustration of one.
 *
 * Points enter a channel on the left and want to travel right at a set speed.
 * The channel narrows to a throat. Nothing scripts the jam: it forms because
 * points keep each other at a fixed spacing, the throat only admits a couple
 * abreast, and the ones behind keep arriving. Open the throat and the same
 * rules empty the queue. That is why the readouts beside it are live figures
 * off the simulation and not numbers typed into a caption.
 *
 * Integration is position-based: move every point, then push apart any pair
 * closer than the spacing, then clamp to the walls, then derive velocity from
 * how far each point actually went. Force-based separation is stiff and
 * explodes under the pressure of a queue; this stays calm at any density.
 */
export class FlowSim {
  readonly n: number;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  private readonly ox: Float32Array;
  private readonly oy: Float32Array;
  /** Display radius per body, px. Collision uses the uniform spacing instead. */
  readonly r: Float32Array;
  readonly active: Uint8Array;
  /** Set when a body re-enters at the inlet, so the renderer can cut rather than tween across. */
  readonly fresh: Uint8Array;

  private readonly free: Int32Array;
  private freeCount = 0;
  /** Distance to the nearest body ahead in the same lane, px. */
  private readonly gap: Float32Array;
  /** Each body's own cruising pace, as a multiple of the flow's speed. */
  private readonly pace: Float32Array;

  /* ---- Geometry, set by `layout` ---- */
  W = 1;
  H = 1;
  /** Channel centre line. */
  yc = 0;
  /** Half-height of the channel's wide section. */
  hw = 0;
  /** Throat position and the lengths of the funnel either side of it. */
  xt = 0;
  lin = 0;
  lout = 0;
  /** Throat half-height when shut. */
  htClosed = 0;
  /** Body spacing, px. */
  sp = 7;
  top = 0;
  bottom = 0;
  /** Base travel speed, px/s. */
  v0 = 120;

  /* ---- Live parameters, set per frame by the flow shots ---- */
  openTarget = 0;
  /** Sprung, so the walls overshoot and ring as the throat gives way. */
  open = 0;
  private openV = 0;
  widenTarget = 0;
  widen = 0;
  speedTarget = 1;
  speedMul = 1;
  /** Holds the walnut point at the front of the queue until the throat opens. */
  heroGate = true;

  pointer = { x: -1e4, y: -1e4, on: false, radius: 56 };

  /* ---- Readouts ---- */
  queue = 0;
  throughput = 0;
  private crossings = 0;

  private emitAcc = 0;
  private time = 0;
  private readonly random: () => number;

  /* ---- Neighbour grid ---- */
  private gw = 1;
  private gh = 1;
  private head: Int32Array = new Int32Array(1);
  private readonly next: Int32Array;

  constructor(n: number, seed = 11) {
    this.n = n;
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.ox = new Float32Array(n);
    this.oy = new Float32Array(n);
    this.r = new Float32Array(n);
    this.active = new Uint8Array(n);
    this.fresh = new Uint8Array(n);
    this.free = new Int32Array(n);
    this.gap = new Float32Array(n);
    this.pace = new Float32Array(n);
    this.next = new Int32Array(n);
    this.random = rng(seed);
    for (let i = 0; i < n; i += 1) {
      this.r[i] = 0.8 + this.random() * 0.7;
      this.pace[i] = 0.72 + this.random() * 0.6;
    }
  }

  /** Fits the channel to the frame. `band` is the vertical space it may use. */
  layout(W: number, H: number, band: { top: number; bottom: number }, portrait: boolean) {
    this.W = W;
    this.H = H;
    this.top = band.top;
    this.bottom = band.bottom;
    this.yc = (band.top + band.bottom) / 2;
    this.sp = clamp(Math.sqrt((W * H) / this.n) * 0.22, 3.2, 7.5);
    this.hw = Math.min((band.bottom - band.top) * 0.34, portrait ? W * 0.3 : W * 0.11);
    this.xt = W * (portrait ? 0.6 : 0.6);
    this.lin = W * (portrait ? 0.34 : 0.28);
    this.lout = W * 0.08;
    this.htClosed = this.sp * 1.3;
    this.v0 = W * (portrait ? 0.14 : 0.075);

    this.gw = Math.ceil((W + 80) / this.sp) + 2;
    this.gh = Math.ceil((H + 80) / this.sp) + 2;
    this.head = new Int32Array(this.gw * this.gh);
  }

  /** 1 inside the narrow part of the funnel, easing to 0 in the open channel. */
  throatness(x: number): number {
    return x < this.xt
      ? smoothstep(this.xt - this.lin, this.xt, x)
      : 1 - smoothstep(this.xt, this.xt + this.lout, x);
  }

  /** The widest the channel can get once its walls are gone. */
  private get hwWide(): number {
    return (this.bottom - this.top) / 2 - this.sp;
  }

  /** Current wall half-height at x. */
  halfWidth(x: number): number {
    const hwE = lerp(this.hw, this.hwWide, this.widen);
    // `open` is sprung and may run past 1, bowing the walls outward briefly.
    const htE = lerp(this.htClosed, hwE, this.open);
    return hwE - (hwE - htE) * this.throatness(x);
  }

  private release(i: number) {
    this.active[i] = 0;
    this.free[this.freeCount] = i;
    this.freeCount += 1;
  }

  private spawn() {
    if (this.freeCount === 0) return;
    this.freeCount -= 1;
    const i = this.free[this.freeCount];
    const h = this.halfWidth(0) - this.sp;
    this.x[i] = -this.sp * (1 + this.random() * 3);
    this.y[i] = this.yc + (this.random() * 2 - 1) * h;
    this.vx[i] = this.v0 * this.speedMul * (0.85 + this.random() * 0.3);
    this.vy[i] = 0;
    this.active[i] = 1;
    this.fresh[i] = 1;
  }

  /**
   * Places the bodies in a believable state rather than simulating one into
   * being: the reel arrives on screen mid-story, with the queue already long.
   */
  init(state: 'jam' | 'open') {
    const { n, sp } = this;
    this.freeCount = 0;
    for (let i = n - 1; i >= 0; i -= 1) this.release(i);
    this.emitAcc = 0;
    this.throughput = 0;
    this.queue = 0;

    /* The free list was filled from the top index down, so popping it hands
       out bodies in index order: body 0, the walnut one, is placed first. */
    const take = (x: number, y: number, speed: number) => {
      if (this.freeCount === 0) return;
      this.freeCount -= 1;
      const i = this.free[this.freeCount];
      this.active[i] = 1;
      this.x[i] = x;
      this.y[i] = y;
      this.vx[i] = speed;
      this.vy[i] = 0;
    };

    if (state === 'open') {
      /* A free-flowing channel, for stills. The throat is open; how wide the
         channel is and how fast it runs are whatever the caller configured,
         so a still can show the moment it asks for. */
      this.openTarget = this.open = 1;
      this.widen = this.widenTarget;
      this.speedMul = this.speedTarget;
      this.openV = 0;
      const count = Math.floor(n * 0.55);
      for (let k = 0; k < count; k += 1) {
        const x = this.random() * this.W;
        const h = this.halfWidth(x) - sp * 0.6;
        take(x, this.yc + (this.random() * 2 - 1) * h, this.v0 * this.speedMul);
      }
    } else {
      this.openTarget = this.open = 0;
      this.widenTarget = this.widen = 0;
      this.speedTarget = this.speedMul = 1;
      this.openV = 0;

      // The walnut point, first in line.
      take(this.xt - sp * 1.8, this.yc, 0);

      // The queue: a hex packing poured into the funnel from the throat back.
      const hx = sp * 0.97;
      const hy = sp * 0.86;
      const queued = Math.floor(n * 0.58);
      let placed = 0;
      let col = 0;
      let backOfQueue = this.xt;
      for (let x = this.xt - sp * 2.9; x > -sp && placed < queued; x -= hx, col += 1) {
        const h = this.halfWidth(x) - sp * 0.55;
        const offset = col % 2 ? hy / 2 : 0;
        for (let y = this.yc - h + offset; y <= this.yc + h && placed < queued; y += hy) {
          take(x + (this.random() - 0.5) * sp * 0.2, y, 0);
          placed += 1;
        }
        backOfQueue = x;
      }

      // Arrivals still on their way to the back of it.
      const arriving = Math.floor(n * 0.16);
      for (let k = 0; k < arriving; k += 1) {
        const x = this.random() * Math.max(0, backOfQueue - sp * 4);
        const h = this.halfWidth(x) - sp;
        take(x, this.yc + (this.random() * 2 - 1) * h, this.v0);
      }

      // The trickle that gets through.
      const through = Math.floor(n * 0.02);
      for (let k = 0; k < through; k += 1) {
        const x = this.xt + sp * 2 + this.random() * (this.W - this.xt);
        const h = Math.min(this.halfWidth(x), sp * 3);
        take(x, this.yc + (this.random() * 2 - 1) * h, this.v0 * 0.6);
      }
    }

    for (let i = 0; i < n; i += 1) {
      this.ox[i] = this.x[i];
      this.oy[i] = this.y[i];
    }
    // Let the packing settle into the walls before anyone sees it.
    for (let k = 0; k < 24; k += 1) this.step(1 / 60);
    this.fresh.fill(0);
  }

  step(rawDt: number) {
    const dt = Math.min(rawDt, 1 / 30);
    if (dt <= 0) return;
    this.time += dt;

    /* The throat is sprung and deliberately underdamped: the walls give way,
       overshoot into a slight bulge, and ring back to straight. */
    const K = 60;
    const Z = 0.34;
    const acc = K * (this.openTarget - this.open) - 2 * Z * Math.sqrt(K) * this.openV;
    this.openV += acc * dt;
    this.open += this.openV * dt;
    this.widen += (this.widenTarget - this.widen) * (1 - Math.exp(-3.2 * dt));
    this.speedMul += (this.speedTarget - this.speedMul) * (1 - Math.exp(-2.4 * dt));

    const v = this.v0 * this.speedMul;
    // Enough substeps that nothing moves more than about half a spacing per step.
    const subs = Math.min(4, Math.max(1, Math.ceil((v * 1.6 * dt) / (this.sp * 0.6))));
    const h = dt / subs;

    this.emitAcc += this.n * 0.03 * this.speedMul * (1 + 1.4 * this.widen) * dt;
    while (this.emitAcc >= 1) {
      this.emitAcc -= 1;
      if (this.freeCount === 0) {
        this.emitAcc = 0;
        break;
      }
      this.spawn();
    }

    for (let k = 0; k < subs; k += 1) this.substep(h, v);

    /* Readouts, smoothed the way an instrument's needle would be. */
    const instant = this.crossings / dt;
    this.crossings = 0;
    this.throughput += (instant - this.throughput) * (1 - Math.exp(-dt / 1.1));

    let q = 0;
    const qFrom = this.xt - this.lin - this.sp * 6;
    for (let i = 0; i < this.n; i += 1) {
      if (!this.active[i]) continue;
      if (this.x[i] > qFrom && this.x[i] < this.xt + this.sp && this.vx[i] < v * 0.35) q += 1;
    }
    this.queue = q;
  }

  /** Files every active body into the neighbour grid at its current position. */
  private bin() {
    const { n, x, y, active, gw, gh, head, next } = this;
    head.fill(-1);
    const inv = 1 / this.sp;
    for (let i = 0; i < n; i += 1) {
      if (!active[i]) continue;
      const cx = Math.min(gw - 1, Math.max(0, Math.floor((x[i] + 40) * inv)));
      const cy = Math.min(gh - 1, Math.max(0, Math.floor((y[i] + 40) * inv)));
      const c = cx + cy * gw;
      next[i] = head[c];
      head[c] = i;
    }
  }

  private substep(dt: number, v: number) {
    const { n, sp, x, y, vx, vy, ox, oy, active, gap } = this;
    const open01 = clamp(this.open);
    const wander = 5 + 70 * this.widen;
    const t = this.time;
    const { gw, gh, head, next } = this;
    const inv = 1 / sp;

    /* ---- Look ahead ----
       Each body finds the nearest one in front of it in its own lane. This is
       what makes a queue behave like one: a body closes up behind the one
       ahead and waits, and when the front of a jam gets moving, the space
       opens back through the queue one body at a time. Without it, opening
       the throat set every body off at once and the whole jam slid away as a
       single rigid wedge, which is not what a released queue looks like. */
    this.bin();
    const lane = sp * 0.85;
    for (let i = 0; i < n; i += 1) {
      if (!active[i]) continue;
      let nearest = 1e6;
      const cx = Math.min(gw - 1, Math.max(0, Math.floor((x[i] + 40) * inv)));
      const cy = Math.min(gh - 1, Math.max(0, Math.floor((y[i] + 40) * inv)));
      for (let oyc = -1; oyc <= 1; oyc += 1) {
        const yy = cy + oyc;
        if (yy < 0 || yy >= gh) continue;
        for (let oxc = 0; oxc <= 3; oxc += 1) {
          const xx = cx + oxc;
          if (xx >= gw) break;
          let j = head[xx + yy * gw];
          while (j !== -1) {
            if (j !== i) {
              const dx = x[j] - x[i];
              if (dx > 0 && dx < nearest && Math.abs(y[j] - y[i]) < lane) nearest = dx;
            }
            j = next[j];
          }
        }
      }
      gap[i] = nearest;
    }

    /* ---- Intent: travel right at speed, as far as the gap ahead allows ----
       Full speed with three spacings of room, standing still when touching.

       Once the throat is open there is a floor under that. Pure car-following
       releases a queue one body at a time, which is accurate and takes the
       best part of twenty seconds, and the release is the payoff of the whole
       reel. Two versions of a floor were tried and both kept the jam's shape:
       a flat one moved it off as a rigid wedge, and one rising along the
       channel still let the fast arrivals behind it pile onto its back as
       quickly as its front left, so the wedge travelled as a standing wave.
       What breaks it up is dispersion: released, every body runs at its own
       pace, the quick ones pull out of the pack and the slow ones fall back,
       and a packed queue comes apart into a stream within a second or two. */
    const surgeFrom = this.xt - this.lin * 1.25;
    const surgeTo = this.xt + this.lout * 2;
    for (let i = 0; i < n; i += 1) {
      if (!active[i]) continue;
      const floor = open01 * (0.55 + 0.45 * smoothstep(surgeFrom, surgeTo, x[i]));
      const room = Math.max(floor, clamp((gap[i] - sp * 1.02) / (sp * 2.2)));
      vx[i] += (v * this.pace[i] * room - vx[i]) * 4 * dt;
      vy[i] += -vy[i] * 1.6 * dt + Math.sin(t * 1.7 + i * 0.61) * wander * dt;

      /* Congestion. Inside the narrow part a body cannot keep its speed, which
         is what a throat does to throughput long before it physically blocks
         anything. It lifts as the throat opens. */
      const th = this.throatness(x[i]);
      const vmax = v * this.pace[i] * (1 - 0.74 * th * th * (1 - open01));
      if (vx[i] > vmax) vx[i] = vmax;

      ox[i] = x[i];
      oy[i] = y[i];
      x[i] += vx[i] * dt;
      y[i] += vy[i] * dt;
    }

    /* ---- Spacing: push apart any pair closer than `sp` ---- */
    this.bin();

    const sp2 = sp * sp;
    for (let i = 0; i < n; i += 1) {
      if (!active[i]) continue;
      const cx = Math.min(gw - 1, Math.max(0, Math.floor((x[i] + 40) * inv)));
      const cy = Math.min(gh - 1, Math.max(0, Math.floor((y[i] + 40) * inv)));
      for (let oyc = -1; oyc <= 1; oyc += 1) {
        const yy = cy + oyc;
        if (yy < 0 || yy >= gh) continue;
        for (let oxc = -1; oxc <= 1; oxc += 1) {
          const xx = cx + oxc;
          if (xx < 0 || xx >= gw) continue;
          let j = head[xx + yy * gw];
          while (j !== -1) {
            if (j > i) {
              const dx = x[j] - x[i];
              const dy = y[j] - y[i];
              const d2 = dx * dx + dy * dy;
              if (d2 < sp2 && d2 > 1e-6) {
                const d = Math.sqrt(d2);
                const corr = ((sp - d) * 0.5) / d;
                x[i] -= dx * corr;
                y[i] -= dy * corr;
                x[j] += dx * corr;
                y[j] += dy * corr;
              }
            }
            j = next[j];
          }
        }
      }
    }

    /* ---- Walls, the cursor, and the walnut point's place in line ---- */
    const p = this.pointer;
    const pr = p.radius;
    const heroHold = this.heroGate && this.open < 0.5;
    for (let i = 0; i < n; i += 1) {
      if (!active[i]) continue;

      if (p.on) {
        const dx = x[i] - p.x;
        const dy = y[i] - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < pr * pr && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          x[i] = p.x + (dx / d) * pr;
          y[i] = p.y + (dy / d) * pr;
        }
      }

      const hh = this.halfWidth(x[i]) - sp * 0.5;
      if (y[i] > this.yc + hh) y[i] = this.yc + hh;
      else if (y[i] < this.yc - hh) y[i] = this.yc - hh;

      if (i === 0 && heroHold && x[0] > this.xt - sp * 1.6) x[0] = this.xt - sp * 1.6;

      // Velocity is whatever actually happened, which is what damps the queue.
      vx[i] = (x[i] - ox[i]) / dt;
      vy[i] = ((y[i] - oy[i]) / dt) * 0.96;

      const xc = this.xt + this.lout * 0.5;
      if (ox[i] < xc && x[i] >= xc) this.crossings += 1;

      if (x[i] > this.W + 16) this.release(i);
    }
  }
}
