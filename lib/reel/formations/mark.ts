import { label } from '../draw';
import { lerp, progress, rng, TAU } from '../math';
import type { Formation, Layout, Targets } from '../types';
import { sortKey } from './shared';

/**
 * Shot 6: and yours.
 *
 * Everything condenses into the wordmark: "NPA" set in the site's own
 * Garamond, rasterised, and sampled on a regular grid so it prints as a
 * dot-matrix. Dot size follows local coverage, a halftone, which is what keeps
 * the serifs and the thin strokes from breaking up at this pitch.
 *
 * The walnut point, which has been the one constant through every shot, lands
 * last as the full stop. Neural Point: it was the point all along.
 */
export class MarkFormation implements Formation {
  readonly kind = 'shape' as const;
  readonly stiffness = 115;
  readonly damping = 0.58;

  private L!: Layout;
  private tx = new Float32Array(0);
  private ty = new Float32Array(0);
  private tr = new Float32Array(0);
  private ring = new Uint8Array(0);
  private phase = new Float32Array(0);
  private box = { x: 0, y: 0, w: 0, h: 0 };
  private stop = { x: 0, y: 0, r: 3.5 };
  private centre = { x: 0, y: 0, rx: 0, ry: 0 };

  layout(L: Layout) {
    this.L = L;
    const { W, H, N, portrait } = L;
    const random = rng(97);
    const text = 'NPA';

    const canvas = document.createElement('canvas');
    const c = canvas.getContext('2d', { willReadFrequently: true });

    const cx = W / 2;
    const cy = portrait ? H * 0.34 : H * 0.4;
    this.centre = { x: cx, y: cy, rx: W * 0.44, ry: H * 0.34 };

    type Slot = { x: number; y: number; r: number; ring: boolean };
    const slots: Slot[] = [];

    if (c) {
      const family = L.theme.display;
      c.font = `500 200px ${family}`;
      const per200 = c.measureText(text).width || 300;
      const targetW = portrait ? W * 0.72 : Math.min(W * 0.44, H * 0.95);
      const fs = (200 * targetW) / per200;
      c.font = `500 ${fs}px ${family}`;
      const m = c.measureText(text);
      const asc = m.actualBoundingBoxAscent || fs * 0.66;
      const desc = m.actualBoundingBoxDescent || 0;
      const tw = m.width;
      const margin = Math.ceil(fs * 0.08);
      canvas.width = Math.ceil(tw + margin * 2);
      canvas.height = Math.ceil(asc + desc + margin * 2);
      c.font = `500 ${fs}px ${family}`;
      c.fillStyle = '#000';
      c.textBaseline = 'alphabetic';
      c.fillText(text, margin, margin + asc);
      const img = c.getImageData(0, 0, canvas.width, canvas.height).data;
      const cw = canvas.width;
      const alphaAt = (x: number, y: number) => {
        const xi = Math.max(0, Math.min(cw - 1, Math.round(x)));
        const yi = Math.max(0, Math.min(canvas.height - 1, Math.round(y)));
        return img[(yi * cw + xi) * 4 + 3] / 255;
      };

      let area = 0;
      for (let k = 3; k < img.length; k += 4) if (img[k] > 127) area += 1;
      const budget = Math.floor((N - 1) * 0.74);
      let sp = Math.sqrt(area / Math.max(1, budget));

      // The walnut full stop, sat on the baseline after the A.
      const stopR = Math.max(3.2, sp * 0.95);
      const gapToStop = sp * 1.1;
      const fullW = tw + gapToStop + stopR * 2;
      const ox = cx - fullW / 2 - margin;
      const oy = cy - (asc - desc) / 2 - margin - asc * 0.04;
      this.stop = { x: ox + margin + tw + gapToStop + stopR, y: oy + margin + asc - stopR, r: stopR };
      this.box = { x: ox + margin, y: oy + margin, w: fullW, h: asc + desc };

      for (let attempt = 0; attempt < 4; attempt += 1) {
        slots.length = 0;
        for (let y = sp / 2; y < canvas.height; y += sp) {
          for (let x = sp / 2; x < cw; x += sp) {
            if (alphaAt(x, y) < 0.5) continue;
            // Halftone: coverage in the dot's own cell sets its size.
            const h = sp * 0.35;
            const cov =
              (alphaAt(x - h, y - h) + alphaAt(x + h, y - h) +
                alphaAt(x - h, y + h) + alphaAt(x + h, y + h) + alphaAt(x, y) * 2) / 6;
            slots.push({ x: ox + x, y: oy + y, r: lerp(0.6, 1.3, cov), ring: false });
          }
        }
        if (slots.length <= budget * 1.04) break;
        sp *= Math.sqrt(slots.length / budget);
      }
      if (slots.length > N - 1) slots.length = N - 1;
    }

    // The rest drift on a wide, slow orbit around the mark.
    while (slots.length < N - 1) {
      const a = random() * TAU;
      const k = 0.78 + random() * 0.45;
      slots.push({
        x: cx + Math.cos(a) * this.centre.rx * k,
        y: cy + Math.sin(a) * this.centre.ry * k,
        r: 0.7,
        ring: true,
      });
    }
    slots.sort((p, q) => sortKey(p.x, p.y, portrait) - sortKey(q.x, q.y, portrait));

    this.tx = new Float32Array(N);
    this.ty = new Float32Array(N);
    this.tr = new Float32Array(N);
    this.ring = new Uint8Array(N);
    this.phase = new Float32Array(N);
    slots.forEach((slot, k) => {
      const i = k + 1;
      this.tx[i] = slot.x;
      this.ty[i] = slot.y;
      this.tr[i] = slot.r;
      this.ring[i] = slot.ring ? 1 : 0;
      this.phase[i] = random() * TAU;
    });
  }

  targets(_s: number, t: number, out: Targets) {
    const { N } = this.L;
    const { x: cx, y: cy } = this.centre;
    for (let i = 1; i < N; i += 1) {
      const ph = this.phase[i];
      if (this.ring[i]) {
        // Orbiting: advance the home angle on the ellipse, very slowly.
        const ang = t * 0.018 * (i % 2 ? 1 : -1);
        const dx = this.tx[i] - cx;
        const dy = this.ty[i] - cy;
        const k = this.centre.rx / this.centre.ry;
        out.x[i] = cx + dx * Math.cos(ang) - dy * Math.sin(ang) * k;
        out.y[i] = cy + dy * Math.cos(ang) + (dx * Math.sin(ang)) / k;
        out.r[i] = 0.7;
        out.a[i] = 0.13;
      } else {
        // The mark breathes, barely: a print, not a screen saver.
        out.x[i] = this.tx[i] + Math.sin(t * 0.8 + ph) * 0.35;
        out.y[i] = this.ty[i] + Math.cos(t * 0.7 + ph) * 0.35;
        out.r[i] = this.tr[i];
        out.a[i] = 0.92;
      }
      out.c[i] = 0;
    }
    out.x[0] = this.stop.x;
    out.y[0] = this.stop.y;
    out.r[0] = this.stop.r;
    out.a[0] = 1;
    out.c[0] = 1;
  }

  overlay(g: CanvasRenderingContext2D, s: number, _t: number, layer: 0 | 1, vis: number) {
    if (layer === 1) return;
    const { theme } = this.L;
    const { x, y, w, h } = this.box;

    /* The name, typed on under the mark. Nothing is drawn round the mark
       itself: it stands on the page the way the rest of the reel does. */
    g.font = `700 10px ${theme.label}`;
    g.fillStyle = theme.ink3;
    g.globalAlpha = vis;
    label(g, 'NEURAL POINT ANALYTICA', x + w / 2, y + h + 44, 2.4, 'center', progress(0.25, 0.6, s));
    g.globalAlpha = 1;
  }
}
