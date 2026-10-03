import { roundRectPath, strokeDrawn } from '../draw';
import {
  bezierPoint,
  clamp,
  easeInOutCubic,
  easeOutCubic,
  lerp,
  progress,
  rng,
  springOut,
  TAU,
} from '../math';
import type { Formation, Layout, Rect, Targets } from '../types';
import { sortKey } from './shared';

/* Slot kinds. Most sit still once built; the chart's parts track the data. */
const FIXED = 0;
const SERIES = 1;
const STIPPLE = 2;
const BAR = 3;

interface Part {
  start: number;
  end: number;
}

interface Slot {
  kind: number;
  part: number;
  /** 0..1 order within its part, so a row builds left to right. */
  stag: number;
  x: number;
  y: number;
  r: number;
  a: number;
  c: number;
  /** SERIES: point index. STIPPLE: x fraction. BAR: bar index. */
  i: number;
  /** STIPPLE: depth below the curve, 0..1. BAR: row. */
  j: number;
}

const scratch = { x: 0, y: 0 };

/**
 * Shot 3: then build it, exactly.
 *
 * An internal tool assembling itself out of the reel's points: the window is
 * drawn on, then a sidebar, a header, three figures, a chart, a bar panel and a
 * table condense out of a cloud of loose points, each in its own window of the
 * scroll. Text is set as skeleton rows of points, which keeps the interface
 * about structure rather than about any number anyone could mistake for a
 * claim.
 *
 * Then a cursor comes in, picks another range on the chart, and the data
 * reflows on a spring. It is the one moment in the reel that shows software
 * doing something rather than being built.
 */
export class InterfaceFormation implements Formation {
  readonly kind = 'shape' as const;
  readonly stiffness = 150;
  readonly damping = 0.7;

  private L!: Layout;
  private win: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private tb = 24;
  private sbw = 0;
  private cards: Rect[] = [];
  private chart: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private plot = { x0: 0, x1: 0, y0: 0, y1: 0 };
  private bars: Rect | null = null;
  private barGeom = { count: 8, x0: 0, pitch: 0, base: 0, rows: 0, sp: 4 };
  private tableTop = 0;
  private segments: Rect[] = [];
  private heroHome = { x: 0, y: 0 };
  private heroIndex = 0;

  private seriesA: number[] = [];
  private seriesB: number[] = [];
  private barA: number[] = [];
  private barB: number[] = [];

  private parts: Part[] = [];
  private slots: Slot[] = [];
  private cloudX = new Float32Array(0);
  private cloudY = new Float32Array(0);
  private phase = new Float32Array(0);

  layout(L: Layout) {
    this.L = L;
    const { W, H, N, portrait, pad } = L;

    /* ---- The window ---- */
    if (portrait) {
      const ww = W - pad * 2;
      const wh = Math.min(L.band.bottom - H * 0.1, ww * 1.05);
      this.win = { x: pad, y: H * 0.1, w: ww, h: wh };
    } else {
      const wh = H * 0.74;
      const ww = Math.min(W * 0.53, wh * 1.52);
      this.win = { x: W - pad * 2 - ww, y: H * 0.13, w: ww, h: wh };
    }
    const { x: wx, y: wy, w: ww, h: wh } = this.win;
    this.tb = clamp(wh * 0.07, 18, 30);
    this.sbw = portrait ? 0 : ww * 0.2;

    // Fit the dot pitch to the budget: a denser interface on a bigger frame.
    const budget = (N - 1) * 0.8;
    let sp = clamp(Math.min(ww, wh) / 95, 3.4, 6.5);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      this.build(sp);
      if (this.slots.length <= budget) break;
      sp *= Math.sqrt(this.slots.length / budget) * 1.02;
    }

    /* ---- Where unbuilt points wait: a loose cloud in the middle of the window ---- */
    const random = rng(53);
    const gauss = () => (random() + random() + random() - 1.5) / 1.5;
    const cloudCx = wx + ww * 0.55;
    const cloudCy = wy + wh * 0.5;

    // Leftovers settle around the outside of the window as dust.
    while (this.slots.length < N - 1) {
      let x = 0;
      let y = 0;
      for (let guard = 0; guard < 12; guard += 1) {
        x = random() * W;
        y = L.band.top + random() * (H * 0.9 - L.band.top);
        const inside = x > wx - 20 && x < wx + ww + 20 && y > wy - 20 && y < wy + wh + 20;
        const inCaption =
          x < L.caption.x + L.caption.w && y > L.caption.y - 20;
        if (!inside && !inCaption) break;
      }
      this.slots.push({ kind: FIXED, part: this.parts.length - 1, stag: random(), x, y, r: 0.75, a: 0.13, c: 0, i: 0, j: 0 });
    }
    this.slots.length = N - 1;
    this.slots.sort((p, q) => sortKey(p.x, p.y, portrait) - sortKey(q.x, q.y, portrait));

    this.cloudX = new Float32Array(N);
    this.cloudY = new Float32Array(N);
    this.phase = new Float32Array(N);
    for (let k = 0; k < N; k += 1) {
      this.cloudX[k] = cloudCx + gauss() * ww * 0.3;
      this.cloudY[k] = cloudCy + gauss() * wh * 0.28;
      this.phase[k] = random() * TAU;
    }
  }

  /** Lays out every element at dot pitch `sp`. */
  private build(sp: number) {
    const { portrait } = this.L;
    const random = rng(41);
    const { x: wx, y: wy, w: ww, h: wh } = this.win;
    const tb = this.tb;
    const sbw = this.sbw;
    const ip = clamp(ww * 0.035, 10, 24);
    const cx = wx + sbw + ip;
    const cy = wy + tb + ip;
    const cw = ww - sbw - ip * 2;
    const ch = wh - tb - ip * 2;

    this.parts = [];
    this.slots = [];
    const part = (start: number, end: number) => {
      this.parts.push({ start, end });
      return this.parts.length - 1;
    };
    const row = (
      p: number, x: number, y: number, len: number,
      r = 1, a = 0.6, c = 0, stag0 = 0, stagSpan = 1
    ) => {
      const count = Math.max(1, Math.floor(len / sp));
      for (let k = 0; k < count; k += 1) {
        this.slots.push({
          kind: FIXED, part: p, stag: stag0 + (k / count) * stagSpan,
          x: x + k * sp, y, r, a, c, i: 0, j: 0,
        });
      }
    };

    /* ---- Sidebar ---- */
    const pSide = part(0.08, 0.27);
    if (!portrait) {
      for (let k = 0; k < 6; k += 1) {
        const y = cy + ch * 0.02 + k * ch * 0.085;
        const active = k === 1;
        const c = active ? 1 : 0;
        const a = active ? 0.95 : 0.55;
        const x0 = wx + ip;
        for (let q = 0; q < 4; q += 1) {
          this.slots.push({
            kind: FIXED, part: pSide, stag: k / 6,
            x: x0 + (q % 2) * sp, y: y + Math.floor(q / 2) * sp, r: 1, a, c, i: 0, j: 0,
          });
        }
        if (active) this.heroHome = { x: x0 + sp * 0.5, y: y + sp * 0.5 };
        const len = (sbw - ip * 2 - sp * 3.2) * (0.45 + random() * 0.45);
        row(pSide, x0 + sp * 3.2, y + sp * 0.5, len, 1, a, c, k / 6, 1 / 6);
      }
    }

    /* ---- Header ---- */
    const pHead = part(0.12, 0.27);
    const hy = cy + ch * 0.03;
    row(pHead, cx, hy, cw * 0.26, 1.35, 0.9);
    if (portrait) this.heroHome = { x: cx, y: hy - sp * 2.2 };
    const pill = cw * 0.08;
    row(pHead, cx + cw - pill * 2 - sp * 3, hy, pill, 1, 0.5, 0, 0.5, 0.5);
    row(pHead, cx + cw - pill, hy, pill, 1, 0.5, 0, 0.7, 0.3);

    /* ---- Figures ---- */
    const pCards = part(0.2, 0.42);
    const cardCount = portrait ? 2 : 3;
    const gap = ip * 0.8;
    const kw = (cw - gap * (cardCount - 1)) / cardCount;
    const ky = cy + ch * 0.12;
    const kh = ch * 0.2;
    this.cards = [];
    for (let q = 0; q < cardCount; q += 1) {
      const x = cx + q * (kw + gap);
      this.cards.push({ x, y: ky, w: kw, h: kh });
      const s0 = q / cardCount;
      row(pCards, x + ip * 0.6, ky + kh * 0.28, kw * 0.34, 1, 0.55, 0, s0, 0.15);
      row(pCards, x + ip * 0.6, ky + kh * 0.58, kw * 0.22, 1.55, 0.9, 0, s0 + 0.05, 0.15);
      // A sparkline: a short random walk, drawn in points.
      const n = 14;
      let v = 0.5;
      for (let k = 0; k < n; k += 1) {
        v = clamp(v + (random() - 0.45) * 0.35, 0.1, 0.9);
        this.slots.push({
          kind: FIXED, part: pCards, stag: s0 + 0.1 + (k / n) * 0.2,
          x: x + kw * 0.52 + (k / (n - 1)) * kw * 0.4,
          y: ky + kh * (0.8 - v * 0.5), r: 1.05, a: 0.85, c: 0, i: 0, j: 0,
        });
      }
    }

    /* ---- The chart ---- */
    this.chart = { x: cx, y: cy + ch * 0.37, w: portrait ? cw : cw * 0.63, h: ch * 0.42 };
    const C = this.chart;
    this.plot = {
      x0: C.x + C.w * 0.07,
      x1: C.x + C.w * 0.95,
      y0: C.y + C.h * 0.22,
      y1: C.y + C.h * 0.84,
    };
    const P = this.plot;
    const pChartHead = part(0.34, 0.46);
    row(pChartHead, C.x + ip * 0.6, C.y + ip * 0.9, C.w * 0.2, 1, 0.6);

    const segW = Math.max(18, C.w * 0.07);
    this.segments = [0, 1, 2].map((k) => ({
      x: C.x + C.w - ip * 0.6 - (3 - k) * (segW + 3),
      y: C.y + ip * 0.9 - 7,
      w: segW,
      h: 14,
    }));

    const M = Math.round(clamp((P.x1 - P.x0) / (sp * 1.55), 24, 72));
    this.seriesA = [];
    this.seriesB = [];
    for (let k = 0; k < M; k += 1) {
      const u = k / (M - 1);
      this.seriesA.push(
        clamp(0.42 + 0.2 * Math.sin(u * 7.1 + 0.4) + 0.1 * Math.sin(u * 17 + 1.3) + u * 0.16, 0.06, 0.96)
      );
      this.seriesB.push(
        clamp(0.5 + 0.26 * Math.sin(u * 5.2 + 2.2) + 0.08 * Math.sin(u * 21) + (1 - u) * 0.08, 0.06, 0.96)
      );
    }
    this.heroIndex = Math.round((M - 1) * 0.68);

    const pSeries = part(0.36, 0.57);
    for (let k = 0; k < M; k += 1) {
      if (k === this.heroIndex) continue;
      this.slots.push({
        kind: SERIES, part: pSeries, stag: k / M,
        x: P.x0 + ((P.x1 - P.x0) * k) / (M - 1), y: 0, r: 1.2, a: 0.95, c: 0, i: k, j: 0,
      });
    }

    // Stippled fill under the line, hung from the curve so it reflows with it.
    const pStipple = part(0.44, 0.63);
    const pitch = sp * 1.45;
    const cols = Math.floor((P.x1 - P.x0) / pitch);
    const rows = Math.floor((P.y1 - P.y0) / pitch);
    for (let a = 0; a <= cols; a += 1) {
      for (let b = 1; b <= rows; b += 1) {
        if (random() > 0.5) continue;
        const fx = a / cols;
        this.slots.push({
          kind: STIPPLE, part: pStipple, stag: fx,
          x: P.x0 + fx * (P.x1 - P.x0), y: 0, r: 0.8, a: 0.3, c: 0,
          i: fx, j: b / (rows + 0.5),
        });
      }
    }

    /* ---- Bars ---- */
    this.bars = null;
    if (!portrait) {
      const B = { x: cx + cw * 0.66, y: C.y, w: cw * 0.34, h: C.h };
      this.bars = B;
      const count = 8;
      const pitchX = (B.w - ip * 1.2) / count;
      const base = B.y + B.h * 0.86;
      const rowsB = Math.floor((B.h * 0.6) / sp);
      this.barGeom = { count, x0: B.x + ip * 0.6, pitch: pitchX, base, rows: rowsB, sp };
      this.barA = Array.from({ length: count }, (_, k) => 0.35 + 0.55 * Math.abs(Math.sin(k * 1.3 + 0.5)));
      this.barB = Array.from({ length: count }, (_, k) => 0.3 + 0.6 * Math.abs(Math.cos(k * 0.9 + 0.2)));
      const pBarHead = part(0.36, 0.48);
      row(pBarHead, B.x + ip * 0.6, B.y + ip * 0.9, B.w * 0.3, 1, 0.6);
      const pBars = part(0.48, 0.67);
      for (let b = 0; b < count; b += 1) {
        for (let k = 0; k < rowsB; k += 1) {
          for (let col = 0; col < 2; col += 1) {
            this.slots.push({
              kind: BAR, part: pBars, stag: (b / count) * 0.6 + (k / rowsB) * 0.4,
              x: this.barGeom.x0 + pitchX * (b + 0.5) + (col - 0.5) * sp,
              y: 0, r: 1, a: 0.85, c: 0, i: b, j: k,
            });
          }
        }
      }
    }

    /* ---- Table ---- */
    const pTable = part(0.56, 0.73);
    this.tableTop = cy + ch * 0.86;
    const tableRows = portrait ? 2 : 3;
    for (let k = 0; k < tableRows; k += 1) {
      const y = this.tableTop + k * ch * 0.055;
      row(pTable, cx, y, cw * 0.2, 1, 0.5, 0, k / tableRows, 0.1);
      row(pTable, cx + cw * 0.32, y, cw * (0.2 + random() * 0.14), 1, 0.45, 0, k / tableRows + 0.05, 0.1);
      row(pTable, cx + cw * 0.8, y, cw * 0.12, 1, 0.5, 0, k / tableRows + 0.1, 0.1);
    }

    // The part leftovers belong to: they drift out to the margins as it builds.
    part(0.3, 0.7);
  }

  /** The chart's value at point k, after the click has reflowed it. */
  private reflow(s: number) {
    return springOut(progress(0.79, 0.95, s), 0.45, 1.5);
  }

  private seriesY(k: number, q: number) {
    const v = lerp(this.seriesA[k], this.seriesB[k], q);
    return this.plot.y1 - v * (this.plot.y1 - this.plot.y0);
  }

  /** The curve at an arbitrary x fraction, for hanging the stipple off it. */
  private curveAt(fx: number, q: number) {
    const M = this.seriesA.length;
    const f = fx * (M - 1);
    const k = Math.min(M - 2, Math.floor(f));
    return lerp(this.seriesY(k, q), this.seriesY(k + 1, q), f - k);
  }

  targets(s: number, t: number, out: Targets) {
    const { N } = this.L;
    const q = this.reflow(s);
    const g = this.barGeom;

    for (let n = 1; n < N; n += 1) {
      const slot = this.slots[n - 1];
      const p = this.parts[slot.part];
      const span = p.end - p.start;
      const b = progress(p.start + slot.stag * span * 0.55, p.start + slot.stag * span * 0.55 + span * 0.45, s);

      const fx = slot.x;
      let fy = slot.y;
      let alpha = slot.a;
      switch (slot.kind) {
        case SERIES:
          fy = this.seriesY(slot.i, q);
          break;
        case STIPPLE: {
          const top = this.curveAt(slot.i, q);
          fy = top + slot.j * (this.plot.y1 - top);
          break;
        }
        case BAR: {
          const h = lerp(this.barA[slot.i], this.barB[slot.i], q) * g.rows;
          fy = g.base - Math.min(slot.j, h) * g.sp;
          // Rows above the bar's current height fold into its top, out of sight.
          if (slot.j > h) alpha = 0;
          break;
        }
      }

      const ph = this.phase[n];
      const cxn = this.cloudX[n] + Math.sin(t * 0.5 + ph) * 10;
      const cyn = this.cloudY[n] + Math.cos(t * 0.41 + ph) * 8;
      const e = easeOutCubic(b);
      out.x[n] = lerp(cxn, fx, e);
      out.y[n] = lerp(cyn, fy, e);
      out.r[n] = lerp(0.8, slot.r, b);
      out.a[n] = lerp(0.28, alpha, b);
      out.c[n] = slot.c * b;
    }

    /* The walnut point lands on the sidebar first, the interface builds around
       it, and then it moves to the chart as the figure being looked at. */
    const hx = this.plot.x0 + ((this.plot.x1 - this.plot.x0) * this.heroIndex) / (this.seriesA.length - 1);
    const hy = this.seriesY(this.heroIndex, q);
    const m = easeInOutCubic(progress(0.5, 0.6, s));
    out.x[0] = lerp(this.heroHome.x, hx, m);
    out.y[0] = lerp(this.heroHome.y, hy, m);
    out.r[0] = 3.3;
    out.a[0] = 1;
    out.c[0] = 1;
  }

  overlay(g: CanvasRenderingContext2D, s: number, _t: number, layer: 0 | 1, vis: number) {
    const { theme } = this.L;
    const { x: wx, y: wy, w: ww, h: wh } = this.win;

    if (layer === 0) {
      g.lineWidth = 1;
      g.strokeStyle = theme.ink;

      // The window, drawn on.
      g.globalAlpha = vis * 0.7;
      g.beginPath();
      roundRectPath(g, wx, wy, ww, wh, 10);
      strokeDrawn(g, 2 * (ww + wh), progress(0, 0.14, s));

      g.globalAlpha = vis * 0.4;
      g.beginPath();
      g.moveTo(wx, wy + this.tb);
      g.lineTo(wx + ww, wy + this.tb);
      strokeDrawn(g, ww, progress(0.06, 0.16, s));
      if (this.sbw > 0) {
        g.beginPath();
        g.moveTo(wx + this.sbw, wy + this.tb);
        g.lineTo(wx + this.sbw, wy + wh);
        strokeDrawn(g, wh - this.tb, progress(0.08, 0.18, s));
      }

      // Window controls, popping in on the site's spring.
      g.globalAlpha = vis * 0.55;
      for (let k = 0; k < 3; k += 1) {
        const pop = springOut(progress(0.1 + k * 0.02, 0.2 + k * 0.02, s));
        if (pop <= 0) continue;
        g.beginPath();
        g.arc(wx + 14 + k * 11, wy + this.tb / 2, 3 * pop, 0, TAU);
        g.stroke();
      }

      // Panels.
      g.globalAlpha = vis * 0.4;
      this.cards.forEach((c, k) => {
        g.beginPath();
        roundRectPath(g, c.x, c.y, c.w, c.h, 6);
        strokeDrawn(g, 2 * (c.w + c.h), progress(0.16 + k * 0.03, 0.3 + k * 0.03, s));
      });
      const C = this.chart;
      g.beginPath();
      roundRectPath(g, C.x, C.y, C.w, C.h, 6);
      strokeDrawn(g, 2 * (C.w + C.h), progress(0.3, 0.42, s));
      if (this.bars) {
        const B = this.bars;
        g.beginPath();
        roundRectPath(g, B.x, B.y, B.w, B.h, 6);
        strokeDrawn(g, 2 * (B.w + B.h), progress(0.34, 0.46, s));
      }

      // Axes and a faint grid.
      const P = this.plot;
      g.globalAlpha = vis * 0.55;
      g.beginPath();
      g.moveTo(P.x0, P.y1);
      g.lineTo(P.x1, P.y1);
      strokeDrawn(g, P.x1 - P.x0, progress(0.34, 0.44, s));
      g.beginPath();
      g.moveTo(P.x0, P.y1);
      g.lineTo(P.x0, P.y0);
      strokeDrawn(g, P.y1 - P.y0, progress(0.36, 0.44, s));
      g.globalAlpha = vis * 0.14 * progress(0.38, 0.46, s);
      g.setLineDash([2, 4]);
      g.beginPath();
      for (let k = 1; k <= 3; k += 1) {
        const y = P.y1 - ((P.y1 - P.y0) * k) / 4;
        g.moveTo(P.x0, y);
        g.lineTo(P.x1, y);
      }
      g.stroke();
      g.setLineDash([]);

      // The range control: which segment is on changes with the click.
      const segIn = progress(0.36, 0.44, s);
      const selected = s < 0.79 ? 0 : 2;
      this.segments.forEach((r, k) => {
        g.globalAlpha = vis * segIn * (k === selected ? 0.85 : 0.4);
        g.beginPath();
        roundRectPath(g, r.x, r.y, r.w, r.h, 3);
        if (k === selected) {
          g.fillStyle = theme.ink;
          g.fill();
        } else {
          g.stroke();
        }
      });

      if (this.tableTop > 0) {
        g.globalAlpha = vis * 0.3;
        g.beginPath();
        const y = this.tableTop - 10;
        g.moveTo(wx + this.sbw + 12, y);
        g.lineTo(wx + ww - 12, y);
        strokeDrawn(g, ww - this.sbw - 24, progress(0.56, 0.64, s));
      }
      g.globalAlpha = 1;
      return;
    }

    /* ---- Over the points ---- */
    const q = this.reflow(s);
    const hx = this.plot.x0 + ((this.plot.x1 - this.plot.x0) * this.heroIndex) / (this.seriesA.length - 1);
    const hy = this.seriesY(this.heroIndex, q);

    // Crosshair and readout on the point being looked at.
    const tip = vis * progress(0.58, 0.64, s);
    if (tip > 0.01) {
      g.globalAlpha = tip * 0.4;
      g.strokeStyle = theme.ink;
      g.lineWidth = 1;
      g.setLineDash([2, 3]);
      g.beginPath();
      g.moveTo(hx, hy + 6);
      g.lineTo(hx, this.plot.y1);
      g.stroke();
      g.setLineDash([]);

      const tw = Math.max(64, this.chart.w * 0.16);
      const th = 30;
      const tx = Math.min(hx + 12, this.chart.x + this.chart.w - tw - 6);
      const ty = hy - th - 12;
      g.globalAlpha = tip * 0.92;
      g.fillStyle = '#e2dfd9';
      g.beginPath();
      roundRectPath(g, tx, ty, tw, th, 4);
      g.fill();
      g.globalAlpha = tip * 0.5;
      g.stroke();
      g.globalAlpha = tip * 0.6;
      g.lineWidth = 2;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(tx + 8, ty + 11);
      g.lineTo(tx + tw * 0.55, ty + 11);
      g.stroke();
      g.globalAlpha = tip * 0.3;
      g.beginPath();
      g.moveTo(tx + 8, ty + 20);
      g.lineTo(tx + tw * 0.75, ty + 20);
      g.stroke();
      g.lineWidth = 1;
      g.lineCap = 'butt';
    }

    // The cursor: in, across to the third range, a press, and out of the way.
    const cursorIn = vis * progress(0.66, 0.7, s);
    if (cursorIn > 0.01) {
      const seg = this.segments[2];
      const ex = seg.x + seg.w * 0.5;
      const ey = seg.y + seg.h * 0.6;
      const sx = wx + ww * 0.78;
      const sy = wy + wh + 24;
      const travel = easeInOutCubic(progress(0.68, 0.78, s));
      bezierPoint(sx, sy, sx - ww * 0.1, sy - wh * 0.4, ex + 40, ey + 60, ex, ey, travel, scratch);
      let cx = scratch.x;
      let cy = scratch.y;
      const after = easeInOutCubic(progress(0.86, 1, s));
      cx += after * 26;
      cy += after * 34;

      // The click: a ring spreading from the press.
      const ring = progress(0.785, 0.87, s);
      if (ring > 0 && ring < 1) {
        g.globalAlpha = vis * (1 - ring) * 0.8;
        g.strokeStyle = theme.accent;
        g.lineWidth = 1;
        g.beginPath();
        g.arc(ex, ey, 4 + ring * 26, 0, TAU);
        g.stroke();
      }

      const press = 1 - 0.18 * Math.sin(Math.PI * progress(0.775, 0.8, s));
      g.save();
      g.translate(cx, cy);
      g.scale(press, press);
      g.globalAlpha = cursorIn;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, 15);
      g.lineTo(4, 11.4);
      g.lineTo(7, 17.6);
      g.lineTo(9.4, 16.6);
      g.lineTo(6.5, 10.6);
      g.lineTo(11.4, 10.6);
      g.closePath();
      g.fillStyle = theme.ink;
      g.fill();
      g.strokeStyle = '#e2dfd9';
      g.lineWidth = 1;
      g.stroke();
      g.restore();
    }
    g.globalAlpha = 1;
  }
}
