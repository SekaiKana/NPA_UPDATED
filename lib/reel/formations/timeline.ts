import { label } from '../draw';
import { clamp, easeOutCubic, lerp, pad, progress, rng, smoothstep, springOut, TAU } from '../math';
import type { Formation, Layout, Targets } from '../types';
import { sortKey } from './shared';

const WEEKS = 2;
const DAYS = WEEKS * 7;
const DEPLOY_DAYS = [7, 14];

/**
 * Shot 4: a two week sprint to MVP.
 *
 * A timeline of two weeks, ticked by the day, with a walnut playhead the
 * visitor drives by scrolling. The points waiting to become software hang as
 * a haze over the days still to come; as the playhead crosses each day, that
 * day's share condenses out of the haze into a column, bottom up, so the
 * sprint reads as work being laid down rather than as a bar chart animating.
 * At the end of each week a deploy flag goes up, because that is when one
 * does, and the week counter rolls over with it.
 *
 * Counted in weeks, not days: the site states the sprint as two weeks, and a
 * large 14 in the corner of the frame said it the other way.
 */
export class TimelineFormation implements Formation {
  readonly kind = 'shape' as const;
  readonly stiffness = 130;
  readonly damping = 0.66;

  private L!: Layout;
  private x0 = 0;
  private x1 = 0;
  private axisY = 0;
  private colTop = 0;
  private dayW = 0;
  private g = 5;

  /* Per slot. Day -1 marks a slot that is not part of any column. */
  private day = new Int16Array(0);
  private threshold = new Float32Array(0);
  private fx = new Float32Array(0);
  private fy = new Float32Array(0);
  private su = new Float32Array(0);
  private sv = new Float32Array(0);
  private phase = new Float32Array(0);

  layout(L: Layout) {
    this.L = L;
    const { W, H, N, portrait, pad: P } = L;
    const random = rng(71);

    this.x0 = portrait ? P * 1.2 : P * 2;
    this.x1 = W - (portrait ? P * 1.2 : P * 2);
    this.axisY = portrait ? L.band.bottom - 30 : H * 0.6;
    this.colTop = portrait ? H * 0.25 : H * 0.18;
    this.dayW = (this.x1 - this.x0) / DAYS;

    // A gentle build over the fortnight, with the unevenness real days have.
    const heights = Array.from({ length: DAYS }, (_, d) =>
      clamp(0.36 + 0.46 * (d / (DAYS - 1)) + (random() - 0.5) * 0.34, 0.26, 1)
    );
    const sumH = heights.reduce((a, b) => a + b, 0);
    const colH = this.axisY - 10 - this.colTop;
    const budget = Math.floor((N - 1) * 0.74);

    let cols = portrait ? 2 : this.dayW > 64 ? 4 : 3;
    let g = Math.max(3.4, (cols * sumH * colH) / budget);
    if (cols * g > this.dayW * 0.72) {
      cols = Math.max(2, Math.floor((this.dayW * 0.72) / g));
      g = Math.max(3.4, (cols * sumH * colH) / budget);
    }
    this.g = g;

    type Slot = { day: number; th: number; x: number; y: number };
    const slots: Slot[] = [];
    heights.forEach((h, d) => {
      const rows = Math.max(2, Math.floor((h * colH) / g));
      for (let k = 0; k < rows; k += 1) {
        for (let c = 0; c < cols; c += 1) {
          slots.push({
            day: d,
            // Bottom row first, laid down across most of the day.
            th: d + (k / rows) * 0.9,
            x: this.x0 + (d + 0.5) * this.dayW + (c - (cols - 1) / 2) * g,
            y: this.axisY - 9 - k * g,
          });
        }
      }
    });
    if (slots.length > N - 1) slots.length = N - 1;
    while (slots.length < N - 1) {
      slots.push({
        day: -1,
        th: 0,
        x: random() * W,
        y: L.band.top + random() * (L.band.bottom - L.band.top),
      });
    }
    slots.sort((p, q) => sortKey(p.x, p.y, portrait) - sortKey(q.x, q.y, portrait));

    this.day = new Int16Array(N);
    this.threshold = new Float32Array(N);
    this.fx = new Float32Array(N);
    this.fy = new Float32Array(N);
    this.su = new Float32Array(N);
    this.sv = new Float32Array(N);
    this.phase = new Float32Array(N);
    slots.forEach((slot, k) => {
      const i = k + 1;
      this.day[i] = slot.day;
      this.threshold[i] = slot.th;
      this.fx[i] = slot.x;
      this.fy[i] = slot.y;
      this.su[i] = random();
      this.sv[i] = random();
      this.phase[i] = random() * TAU;
    });
  }

  /** Playhead position, 0..1 of the fortnight. */
  private head(s: number) {
    return progress(0.05, 0.9, s);
  }

  targets(s: number, t: number, out: Targets) {
    const { N } = this.L;
    const q = this.head(s);
    const days = q * DAYS;
    const xp = lerp(this.x0, this.x1, q);
    const colH = this.axisY - this.colTop;

    for (let i = 1; i < N; i += 1) {
      const ph = this.phase[i];
      if (this.day[i] < 0) {
        out.x[i] = this.fx[i] + Math.sin(t * 0.2 + ph) * 6;
        out.y[i] = this.fy[i] + Math.cos(t * 0.23 + ph) * 5;
        out.r[i] = 0.75;
        out.a[i] = 0.14;
        out.c[i] = 0;
        continue;
      }

      /* Unbuilt work hangs as a haze over the day it belongs to, loose enough
         to read as not yet decided, and never behind the playhead: the part
         of today still to do waits just ahead of it. */
      const dayX = this.x0 + (this.day[i] + 0.5) * this.dayW;
      const hx = Math.max(
        dayX + (this.su[i] - 0.5) * this.dayW * 1.7 + Math.sin(t * 0.5 + ph) * 6,
        xp + 8 + this.su[i] * 26
      );
      const hy =
        this.colTop + colH * (0.08 + this.sv[i] * 0.72) + Math.cos(t * 0.6 + ph * 1.7) * 7;
      const b = progress(this.threshold[i], this.threshold[i] + 0.3, days);
      const e = easeOutCubic(b);
      out.x[i] = lerp(hx, this.fx[i], e);
      out.y[i] = lerp(hy, this.fy[i], e);
      out.r[i] = lerp(0.85, 1.15, b);
      out.a[i] = lerp(0.26, 0.9, b);
      out.c[i] = 0;
    }

    out.x[0] = xp;
    out.y[0] = this.colTop - 20;
    out.r[0] = 3.3;
    out.a[0] = 1;
    out.c[0] = 1;
  }

  overlay(g: CanvasRenderingContext2D, s: number, _t: number, layer: 0 | 1, vis: number) {
    const { theme, copy, portrait, W, H, pad: P } = this.L;
    const q = this.head(s);
    const days = q * DAYS;
    const xp = lerp(this.x0, this.x1, q);

    if (layer === 0) {
      g.lineWidth = 1;
      g.strokeStyle = theme.ink;
      g.globalAlpha = vis * 0.55;
      g.beginPath();
      g.moveTo(this.x0 - 6, this.axisY);
      g.lineTo(this.x1 + 6, this.axisY);
      for (let d = 0; d <= DAYS; d += 1) {
        const x = this.x0 + d * this.dayW;
        g.moveTo(x, this.axisY);
        g.lineTo(x, this.axisY + (d % 7 === 0 ? 9 : 5));
      }
      g.stroke();

      /* Each week named under its seven days: done in ink, this one in
         walnut, the one still to come in grey. */
      g.font = `700 ${portrait ? 9 : 10}px ${theme.label}`;
      const thisWeek = Math.min(WEEKS - 1, Math.floor(days / 7));
      for (let w = 0; w < WEEKS; w += 1) {
        g.globalAlpha = vis;
        g.fillStyle = w === thisWeek ? theme.accent : w < thisWeek ? theme.ink : theme.ink3;
        const name = copy.weekOf.replace('{n}', String(w + 1)).toUpperCase();
        label(g, name, this.x0 + (w * 7 + 3.5) * this.dayW, this.axisY + 22, portrait ? 1.6 : 2.2, 'center');
      }

      // Deploy flags, raised at the end of each week on the site's spring.
      g.font = `700 ${portrait ? 9 : 10}px ${theme.label}`;
      DEPLOY_DAYS.forEach((w, k) => {
        /* The last flag has to go up inside the fortnight, not at its edge:
           the playhead stops at day 14, so a flag triggered there would only
           ever get a fraction of the way up. */
        const from = w === DAYS ? w - 0.62 : w - 0.08;
        const pop = springOut(progress(from, from + 0.58, days), 0.4, 1.4);
        if (pop <= 0) return;
        const x = this.x0 + w * this.dayW;
        const top = this.colTop - 34;
        g.strokeStyle = theme.accent;
        g.fillStyle = theme.accent;
        g.globalAlpha = vis;
        g.beginPath();
        g.moveTo(x, this.axisY);
        g.lineTo(x, lerp(this.axisY, top, pop));
        g.stroke();
        g.beginPath();
        g.arc(x, lerp(this.axisY, top, pop), 2.2, 0, TAU);
        g.fill();
        const text =
          w === DAYS
            ? `${copy.deploy.toUpperCase()} ${pad(k + 1)} / ${copy.mvp.toUpperCase()}`
            : `${copy.deploy.toUpperCase()} ${pad(k + 1)}`;
        label(g, text, x - 8, top + 4, portrait ? 1.4 : 2, 'right', clamp(pop * 1.3));
      });
      g.globalAlpha = 1;
      return;
    }

    /* ---- The playhead and the day counter ---- */
    g.strokeStyle = theme.accent;
    g.fillStyle = theme.accent;
    g.lineWidth = 1;
    g.globalAlpha = vis;
    g.beginPath();
    g.moveTo(xp, this.colTop - 20);
    g.lineTo(xp, this.axisY + 6);
    g.stroke();
    g.beginPath();
    g.moveTo(xp - 4, this.axisY + 7);
    g.lineTo(xp + 4, this.axisY + 7);
    g.lineTo(xp, this.axisY + 1);
    g.closePath();
    g.fill();

    const weeks = days / 7;
    const whole = Math.min(WEEKS, Math.floor(weeks) + 1);

    /* On a tall frame there is no free corner for a large counter, so the
       week rides on the playhead instead. */
    if (portrait) {
      g.font = `700 9px ${theme.label}`;
      const text = `${copy.week.toUpperCase()} ${pad(whole)}/${pad(WEEKS)}`;
      const right = xp > W * 0.6;
      label(g, text, xp + (right ? -10 : 10), this.colTop - 17, 1.4, right ? 'right' : 'left');
      g.globalAlpha = 1;
      return;
    }

    /* The counter rolls, like an odometer, over the last half day of the
       week: it lands on 02 just as the first deploy flag goes up. */
    const size = clamp(H * 0.15, 48, 140);
    const roll = whole < WEEKS ? smoothstep(6.45 / 7, 1, weeks - Math.floor(weeks)) : 0;
    const now = pad(whole);
    const next = pad(Math.min(WEEKS, whole + 1));
    const right = W - P * 2;
    const base = H - P * 2.4;

    g.font = `500 ${size}px ${theme.display}`;
    g.textBaseline = 'alphabetic';
    g.textAlign = 'center';
    const cell = g.measureText('0').width * 1.05;
    const lineH = size * 0.95;
    g.fillStyle = theme.ink;
    for (let k = 0; k < 2; k += 1) {
      const cx = right - cell * (1.5 - k);
      const changing = now[k] !== next[k] && roll > 0;
      g.save();
      g.beginPath();
      g.rect(cx - cell, base - size * 0.9, cell * 2, size * 1.12);
      g.clip();
      g.globalAlpha = vis;
      if (changing) {
        g.fillText(now[k], cx, base - roll * lineH);
        g.fillText(next[k], cx, base + (1 - roll) * lineH);
      } else {
        g.fillText(now[k], cx, base);
      }
      g.restore();
    }
    g.textAlign = 'left';

    g.font = `700 10px ${theme.label}`;
    g.fillStyle = theme.ink3;
    g.globalAlpha = vis;
    label(g, `${copy.week.toUpperCase()} / ${pad(WEEKS)}`, right, base - size * 0.92, 2.2, 'right');
    g.globalAlpha = 1;
  }
}
