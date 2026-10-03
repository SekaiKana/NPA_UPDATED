import { label, trackedWidth } from '../draw';
import { bezierPoint, clamp, easeInOutSine, progress, rng, TAU } from '../math';
import type { Formation, Layout, Targets } from '../types';
import { sortKey } from './shared';

interface GraphNode {
  x: number;
  y: number;
  layer: number;
  /** Distance along the walnut route at which this node is reached, or -1. */
  onRoute: number;
}

interface GraphEdge {
  a: number;
  b: number;
  p: number[];
  len: number;
  /** Cumulative arc length at 16 samples, for constant-speed travel. */
  arc: Float32Array;
}

interface Path {
  edges: number[];
  len: number;
  phase: number;
}

const ROLE_EDGE = 0;
const ROLE_NODE = 1;
const ROLE_SIGNAL = 2;
const ROLE_DUST = 3;

const SAMPLES = 16;
const scratch = { x: 0, y: 0 };

/**
 * Shot 2: the system that breaks it.
 *
 * Five layers, from the data a business already has to the interfaces its
 * people will use, joined as a signal-flow diagram. The edges are not lines:
 * they are the same points as everything else in the reel, spaced along each
 * curve and travelling it, so the drawing is visibly carrying something.
 *
 * The walnut point is routed through it by the scroll. Nodes it has passed
 * through take its colour, so by the end of the shot the path a request
 * takes through the architecture is drawn on it.
 */
export class NetworkFormation implements Formation {
  readonly kind = 'shape' as const;
  readonly stiffness = 95;
  readonly damping = 0.74;

  private L!: Layout;
  private nodes: GraphNode[] = [];
  private edges: GraphEdge[] = [];
  private route: Path = { edges: [], len: 0, phase: 0 };
  private signals: Path[] = [];
  private layerAnchors: { x: number; y: number }[] = [];
  private ringR = 8;

  private role = new Uint8Array(0);
  private ref = new Int32Array(0);
  private u0 = new Float32Array(0);
  private hx = new Float32Array(0);
  private hy = new Float32Array(0);

  layout(L: Layout) {
    this.L = L;
    const { W, H, N, portrait, pad } = L;
    const random = rng(29);

    const x0 = portrait ? pad * 1.6 : W * 0.45;
    const x1 = portrait ? W - pad * 1.6 : W - pad * 2.4;
    const y0 = portrait ? H * 0.15 : H * 0.22;
    const y1 = portrait ? L.band.bottom - 12 : H * 0.84;
    const counts = [6, 4, 5, 3, 4];
    this.ringR = Math.max(5, Math.min(9, Math.min(W, H) * 0.011));

    /* ---- Nodes ---- */
    this.nodes = [];
    this.layerAnchors = [];
    counts.forEach((count, k) => {
      const main = portrait ? y0 + ((y1 - y0) * k) / 4 : x0 + ((x1 - x0) * k) / 4;
      const c0 = portrait ? x0 : y0;
      const c1 = portrait ? x1 : y1;
      const gap = (c1 - c0) / count;
      for (let j = 0; j < count; j += 1) {
        const cross = c0 + gap * (j + 0.5) + (random() - 0.5) * gap * 0.24;
        this.nodes.push(
          portrait
            ? { x: cross, y: main, layer: k, onRoute: -1 }
            : { x: main, y: cross, layer: k, onRoute: -1 }
        );
      }
      this.layerAnchors.push(portrait ? { x: x0, y: main } : { x: main, y: y0 });
    });

    /* ---- Edges: each node feeds its nearest one or two in the next layer ---- */
    const cross = (n: GraphNode) => (portrait ? n.x : n.y);
    const inLayer = (k: number) =>
      this.nodes.map((n, i) => ({ n, i })).filter((e) => e.n.layer === k);
    const pairs = new Set<string>();
    const link = (a: number, b: number) => pairs.add(`${a}>${b}`);

    for (let k = 0; k < 4; k += 1) {
      const here = inLayer(k);
      const there = inLayer(k + 1);
      for (const { n, i } of here) {
        const ranked = [...there].sort(
          (p, q) => Math.abs(cross(p.n) - cross(n)) - Math.abs(cross(q.n) - cross(n))
        );
        link(i, ranked[0].i);
        if (ranked[1] && random() < 0.55) link(i, ranked[1].i);
      }
      for (const { n, i } of there) {
        const fed = [...pairs].some((p) => p.endsWith(`>${i}`));
        if (!fed) {
          const nearest = [...here].sort(
            (p, q) => Math.abs(cross(p.n) - cross(n)) - Math.abs(cross(q.n) - cross(n))
          )[0];
          link(nearest.i, i);
        }
      }
    }

    this.edges = [...pairs].map((key) => {
      const [a, b] = key.split('>').map(Number);
      const A = this.nodes[a];
      const B = this.nodes[b];
      const p = portrait
        ? [A.x, A.y, A.x, A.y + (B.y - A.y) * 0.5, B.x, B.y - (B.y - A.y) * 0.5, B.x, B.y]
        : [A.x, A.y, A.x + (B.x - A.x) * 0.5, A.y, B.x - (B.x - A.x) * 0.5, B.y, B.x, B.y];
      const arc = new Float32Array(SAMPLES + 1);
      let len = 0;
      let px = p[0];
      let py = p[1];
      for (let s = 1; s <= SAMPLES; s += 1) {
        bezierPoint(p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], s / SAMPLES, scratch);
        len += Math.hypot(scratch.x - px, scratch.y - py);
        arc[s] = len;
        px = scratch.x;
        py = scratch.y;
      }
      return { a, b, p, len, arc };
    });

    /* ---- Routes: the walnut point's, through the middle, and a few signals ---- */
    const centre = portrait ? (x0 + x1) / 2 : (y0 + y1) / 2;
    const walk = (start: number, pick: (options: number[]) => number): Path => {
      const edges: number[] = [];
      let at = start;
      let len = 0;
      for (let guard = 0; guard < 6; guard += 1) {
        const options = this.edges.map((e, i) => (e.a === at ? i : -1)).filter((i) => i >= 0);
        if (options.length === 0) break;
        const e = pick(options);
        edges.push(e);
        len += this.edges[e].len;
        at = this.edges[e].b;
      }
      return { edges, len, phase: random() };
    };

    const firstLayer = inLayer(0);
    const startNode = [...firstLayer].sort(
      (p, q) => Math.abs(cross(p.n) - centre) - Math.abs(cross(q.n) - centre)
    )[0].i;
    this.route = walk(startNode, (options) =>
      options.sort(
        (p, q) =>
          Math.abs(cross(this.nodes[this.edges[p].b]) - centre) -
          Math.abs(cross(this.nodes[this.edges[q].b]) - centre)
      )[0]
    );
    for (const n of this.nodes) n.onRoute = -1;
    this.nodes[startNode].onRoute = 0;
    let acc = 0;
    for (const e of this.route.edges) {
      acc += this.edges[e].len;
      this.nodes[this.edges[e].b].onRoute = acc;
    }

    this.signals = Array.from({ length: 6 }, () => {
      const start = firstLayer[Math.floor(random() * firstLayer.length)].i;
      return walk(start, (options) => options[Math.floor(random() * options.length)]);
    });

    /* ---- Slots ---- */
    type Slot = { role: number; ref: number; u0: number; x: number; y: number };
    const slots: Slot[] = [];
    const nodeOrbit = 5;
    const dustCount = Math.floor(N * 0.1);
    const fixed = this.nodes.length * nodeOrbit + this.signals.length + dustCount;
    const edgeBudget = Math.max(0, N - 1 - fixed);
    const totalLen = this.edges.reduce((sum, e) => sum + e.len, 0);
    const spacing = Math.max(4.2, totalLen / Math.max(1, edgeBudget));

    this.edges.forEach((e, ei) => {
      const count = Math.max(2, Math.floor(e.len / spacing));
      for (let j = 0; j < count; j += 1) {
        const u = (j + 0.5) / count;
        this.edgePoint(ei, u, scratch);
        slots.push({ role: ROLE_EDGE, ref: ei, u0: u, x: scratch.x, y: scratch.y });
      }
    });
    this.nodes.forEach((n, ni) => {
      for (let j = 0; j < nodeOrbit; j += 1) {
        slots.push({ role: ROLE_NODE, ref: ni, u0: (j / nodeOrbit) * TAU, x: n.x, y: n.y });
      }
    });
    this.signals.forEach((sig, si) => {
      const n = this.nodes[this.edges[sig.edges[0]].a];
      slots.push({ role: ROLE_SIGNAL, ref: si, u0: sig.phase, x: n.x, y: n.y });
    });
    // Anything left over settles as a faint field of dust behind the diagram.
    while (slots.length < N - 1) {
      const x = random() * W;
      const y = L.band.top + random() * (L.band.bottom - L.band.top);
      slots.push({ role: ROLE_DUST, ref: 0, u0: random() * TAU, x, y });
    }
    slots.length = N - 1;
    slots.sort((p, q) => sortKey(p.x, p.y, portrait) - sortKey(q.x, q.y, portrait));

    this.role = new Uint8Array(N);
    this.ref = new Int32Array(N);
    this.u0 = new Float32Array(N);
    this.hx = new Float32Array(N);
    this.hy = new Float32Array(N);
    slots.forEach((slot, k) => {
      const i = k + 1;
      this.role[i] = slot.role;
      this.ref[i] = slot.ref;
      this.u0[i] = slot.u0;
      this.hx[i] = slot.x;
      this.hy[i] = slot.y;
    });
  }

  /** A point on an edge at arc-length fraction `u`, so travel is constant-speed. */
  private edgePoint(ei: number, u: number, out: { x: number; y: number }) {
    const e = this.edges[ei];
    const target = u * e.len;
    let s = 1;
    while (s < SAMPLES && e.arc[s] < target) s += 1;
    const a0 = e.arc[s - 1];
    const a1 = e.arc[s];
    const f = a1 > a0 ? (target - a0) / (a1 - a0) : 0;
    const p = e.p;
    return bezierPoint(p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], (s - 1 + f) / SAMPLES, out);
  }

  /** A point `d` px along a path of edges. */
  private pathPoint(path: Path, d: number, out: { x: number; y: number }) {
    let rest = clamp(d, 0, path.len);
    for (const ei of path.edges) {
      const len = this.edges[ei].len;
      if (rest <= len) return this.edgePoint(ei, rest / len, out);
      rest -= len;
    }
    const last = path.edges[path.edges.length - 1];
    return this.edgePoint(last, 1, out);
  }

  private routeDistance(s: number) {
    return easeInOutSine(progress(0.1, 0.84, s)) * this.route.len;
  }

  targets(s: number, t: number, out: Targets) {
    const { N } = this.L;
    const edgeSpeed = 18;
    const signalSpeed = 92;
    const gap = 220;

    for (let i = 1; i < N; i += 1) {
      const ref = this.ref[i];
      switch (this.role[i]) {
        case ROLE_EDGE: {
          const e = this.edges[ref];
          this.edgePoint(ref, (this.u0[i] + (t * edgeSpeed) / e.len) % 1, scratch);
          out.x[i] = scratch.x;
          out.y[i] = scratch.y;
          out.r[i] = 0.95;
          out.a[i] = 0.6;
          out.c[i] = 0;
          break;
        }
        case ROLE_NODE: {
          const n = this.nodes[ref];
          const ang = this.u0[i] + t * 0.8 * (ref % 2 ? 1 : -1);
          out.x[i] = n.x + Math.cos(ang) * this.ringR * 0.52;
          out.y[i] = n.y + Math.sin(ang) * this.ringR * 0.52;
          out.r[i] = 1.05;
          out.a[i] = 0.9;
          out.c[i] = 0;
          break;
        }
        case ROLE_SIGNAL: {
          const path = this.signals[ref];
          const cycle = path.len + gap;
          const d = (this.u0[i] * cycle + t * signalSpeed) % cycle;
          this.pathPoint(path, Math.min(d, path.len), scratch);
          out.x[i] = scratch.x;
          out.y[i] = scratch.y;
          out.r[i] = 1.45;
          // Invisible while it waits to set off again, so the jump home is never seen.
          out.a[i] = d > path.len ? 0 : 0.95 * clamp(d / 40) * clamp((path.len - d) / 40);
          out.c[i] = 1;
          break;
        }
        default: {
          const ph = this.u0[i];
          out.x[i] = this.hx[i] + Math.sin(t * 0.21 + ph) * 7;
          out.y[i] = this.hy[i] + Math.cos(t * 0.17 + ph * 1.3) * 5;
          out.r[i] = 0.75;
          out.a[i] = 0.16;
          out.c[i] = 0;
        }
      }
    }

    this.pathPoint(this.route, this.routeDistance(s), scratch);
    out.x[0] = scratch.x;
    out.y[0] = scratch.y;
    out.r[0] = 3.3;
    out.a[0] = 1;
    out.c[0] = 1;
  }

  overlay(g: CanvasRenderingContext2D, s: number, _t: number, layer: 0 | 1, vis: number) {
    const { theme, copy, portrait } = this.L;
    const travelled = this.routeDistance(s);

    if (layer === 0) {
      /* Nodes: a hairline ring with a hub. The ones the route has reached go
         walnut, so the path is recorded on the drawing as it is taken. */
      g.lineWidth = 1;
      for (const n of this.nodes) {
        const reached = n.onRoute >= 0 && travelled >= n.onRoute - 1;
        g.strokeStyle = reached ? theme.accent : theme.ink;
        g.globalAlpha = vis * (reached ? 0.95 : 0.5);
        g.beginPath();
        g.arc(n.x, n.y, this.ringR, 0, TAU);
        g.stroke();
        g.fillStyle = reached ? theme.accent : theme.ink;
        g.beginPath();
        g.arc(n.x, n.y, 1.5, 0, TAU);
        g.fill();
      }

      g.fillStyle = theme.ink3;
      g.globalAlpha = vis;
      if (portrait) {
        g.font = `700 10px ${theme.label}`;
        this.layerAnchors.forEach((p, k) => {
          label(g, (copy.layers[k] ?? '').toUpperCase(), p.x, p.y - this.ringR - 12, 2, 'left');
        });
      } else {
        /* Column heads have to fit their column. On a small frame, the
           storyboard's cards among them, they are set smaller and tighter,
           and if even that overprints its neighbour they are left out: the
           caption names the layers, and five labels run together are worse
           than none. */
        const spacing = this.layerAnchors.length > 1
          ? this.layerAnchors[1].x - this.layerAnchors[0].x
          : Infinity;
        const texts = this.layerAnchors.map((_, k) => (copy.layers[k] ?? '').toUpperCase());
        let size = 10;
        let tracking = 2.2;
        g.font = `700 ${size}px ${theme.label}`;
        let widest = Math.max(...texts.map((tx) => trackedWidth(g, tx, tracking)));
        if (widest > spacing - 8) {
          size = 8;
          tracking = 1;
          g.font = `700 ${size}px ${theme.label}`;
          widest = Math.max(...texts.map((tx) => trackedWidth(g, tx, tracking)));
        }
        if (widest <= spacing - 8) {
          this.layerAnchors.forEach((p, k) => label(g, texts[k], p.x, p.y - 30, tracking, 'center'));
        }
      }
      g.globalAlpha = 1;
      return;
    }

    /* The route so far, inked in behind the walnut point. */
    if (travelled > 1) {
      g.strokeStyle = theme.accent;
      g.lineWidth = 1.4;
      g.globalAlpha = vis * 0.9;
      g.beginPath();
      for (let d = 0; d <= travelled; d += 5) {
        this.pathPoint(this.route, d, scratch);
        if (d === 0) g.moveTo(scratch.x, scratch.y);
        else g.lineTo(scratch.x, scratch.y);
      }
      this.pathPoint(this.route, travelled, scratch);
      g.lineTo(scratch.x, scratch.y);
      g.stroke();
      g.globalAlpha = 1;
    }
  }
}
