import { label, tick, trackedWidth } from '../draw';
import { clamp, pad, smoothstep } from '../math';
import type { Formation, Layout, Targets } from '../types';
import type { FlowSim } from '../flow';

/**
 * Shots 1 and 5: the channel, jammed and then released.
 *
 * Both are views of the same simulation, so the queue a visitor watched build
 * up in the first shot is the queue they break open in the fifth. The points
 * follow the simulated bodies exactly; this formation only draws the walls and
 * the instruments around them.
 */
export class FlowFormation implements Formation {
  readonly kind = 'flow' as const;
  readonly stiffness = 520;
  readonly damping = 1;
  private L!: Layout;

  constructor(private readonly mode: 'jam' | 'release') {}

  layout(L: Layout) {
    this.L = L;
  }

  configure(sim: FlowSim, s: number) {
    if (this.mode === 'jam') {
      sim.openTarget = 0;
      sim.widenTarget = 0;
      sim.speedTarget = 1;
      sim.heroGate = true;
      return;
    }
    /* The release is under the visitor's thumb: the throat gives way across
       the first third of the shot, the pace picks up hard behind it, and once
       the queue has drained the walls themselves go. The top speed is high on
       purpose. A visitor spends two or three seconds in this shot, and a
       thousand-body queue released at the jam's own pace was still leaving
       the frame long after they had scrolled on. */
    sim.openTarget = smoothstep(0.06, 0.34, s);
    sim.speedTarget = 1 + 2.6 * smoothstep(0.08, 0.46, s);
    sim.widenTarget = smoothstep(0.5, 0.84, s);
    sim.heroGate = true;
  }

  targets(_s: number, _t: number, out: Targets) {
    const { sim, W, N } = this.L;
    for (let i = 0; i < N; i += 1) {
      out.c[i] = 0;
      out.r[i] = sim.r[i];
      if (!sim.active[i]) {
        out.x[i] = -24;
        out.y[i] = sim.yc;
        out.a[i] = 0;
        continue;
      }
      out.x[i] = sim.x[i];
      out.y[i] = sim.y[i];
      // Enter and leave through soft edges rather than popping at the frame.
      out.a[i] = 0.86 * clamp((sim.x[i] + 6) / 48) * clamp((W + 10 - sim.x[i]) / 48);
    }
    out.c[0] = 1;
    out.r[0] = 3.3;
    out.a[0] = sim.active[0] ? 1 : 0;
  }

  overlay(g: CanvasRenderingContext2D, s: number, t: number, layer: 0 | 1, vis: number) {
    const { sim, W, theme, copy, portrait, pad: P } = this.L;
    const walls = vis * (1 - sim.widen);

    if (layer === 0) {
      if (walls < 0.01) return;
      const step = 8;

      /* The walls. Solid boundaries in a mechanical drawing carry hatching on
         their outer face; so do these, which is the difference between a pair
         of lines and a constraint. */
      g.lineWidth = 1;
      g.strokeStyle = theme.ink;
      g.globalAlpha = 0.62 * walls;
      g.beginPath();
      for (let x = -step; x <= W + step; x += step) {
        const y = sim.yc - sim.halfWidth(x);
        if (x === -step) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      for (let x = -step; x <= W + step; x += step) {
        const y = sim.yc + sim.halfWidth(x);
        if (x === -step) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();

      g.globalAlpha = 0.2 * walls;
      g.beginPath();
      const hatch = 6;
      for (let x = 0; x <= W; x += 9) {
        const yt = sim.yc - sim.halfWidth(x);
        const yb = sim.yc + sim.halfWidth(x);
        g.moveTo(x, yt - 1);
        g.lineTo(x - hatch, yt - 1 - hatch);
        g.moveTo(x, yb + 1);
        g.lineTo(x - hatch, yb + 1 + hatch);
      }
      g.stroke();

      /* The give. As the throat opens a walnut pulse runs out along both walls
         from the point that gave way. */
      if (this.mode === 'release') {
        const u = smoothstep(0.06, 0.5, s);
        if (u > 0 && u < 1) {
          g.strokeStyle = theme.accent;
          g.lineWidth = 1.5;
          g.globalAlpha = walls * (1 - u) * 0.95;
          const reach = u * W * 0.75;
          for (const dir of [-1, 1]) {
            const cx = sim.xt + dir * reach;
            g.beginPath();
            for (let x = cx - 50; x <= cx + 50; x += 5) {
              const yt = sim.yc - sim.halfWidth(x);
              if (x === cx - 50) g.moveTo(x, yt);
              else g.lineTo(x, yt);
            }
            for (let x = cx - 50; x <= cx + 50; x += 5) {
              const yb = sim.yc + sim.halfWidth(x);
              if (x === cx - 50) g.moveTo(x, yb);
              else g.lineTo(x, yb);
            }
            g.stroke();
          }
        }
      }

      /* Direction of travel at the inlet, marching. */
      g.strokeStyle = theme.ink;
      g.lineWidth = 1;
      g.globalAlpha = 0.34 * walls;
      g.beginPath();
      const march = (t * 14) % 10;
      for (let k = 0; k < 3; k += 1) {
        const x = P + k * 10 + march;
        g.moveTo(x, sim.yc - 4);
        g.lineTo(x + 4, sim.yc);
        g.lineTo(x, sim.yc + 4);
      }
      g.stroke();
      g.globalAlpha = 1;
      return;
    }

    /* ---- Over the points: the instruments ---- */
    g.font = `700 10px ${theme.label}`;
    g.textBaseline = 'alphabetic';

    // The throat, dimensioned, and named. It fades as the throat stops being one.
    const annot = vis * (1 - clamp(sim.open * 1.8));
    if (annot > 0.01) {
      const ht = sim.halfWidth(sim.xt);
      g.strokeStyle = theme.accent;
      g.fillStyle = theme.accent;
      g.globalAlpha = annot;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(sim.xt, sim.yc - ht);
      g.lineTo(sim.xt, sim.yc + ht);
      tick(g, sim.xt, sim.yc - ht, true, 4);
      tick(g, sim.xt, sim.yc + ht, true, 4);

      const ly = sim.yc - sim.hw - (portrait ? 22 : 34);
      const lx = sim.xt + (portrait ? 0 : 28);
      g.moveTo(sim.xt, sim.yc - ht - 3);
      g.lineTo(lx, ly + 6);
      if (!portrait) g.lineTo(lx + 124, ly + 6);
      g.stroke();
      label(g, copy.bottleneck.toUpperCase(), portrait ? lx : lx + 2, ly, 2.4, portrait ? 'center' : 'left');
    }

    /* The readouts. Live figures off the simulation, drawn like a panel
       meter: the name in the quiet ink, the value in the strong one. */
    const read = vis * (1 - sim.widen * 0.9);
    if (read > 0.01) {
      const qText = `${copy.queue.toUpperCase()} `;
      const tText = `${copy.throughput.toUpperCase()} `;
      const qVal = pad(sim.queue, 4);
      const tVal = `${pad(sim.throughput, 2)}/S`;
      g.globalAlpha = read;

      if (portrait) {
        const y = sim.yc + sim.hw + 30;
        g.fillStyle = theme.ink3;
        const w = label(g, qText, P, y, 1.6);
        g.fillStyle = theme.ink;
        label(g, qVal, P + w + 4, y, 1.6);
        g.fillStyle = theme.ink;
        const vw = label(g, tVal, W - P, y, 1.6, 'right');
        g.fillStyle = theme.ink3;
        label(g, tText, W - P - vw - 4, y, 1.6, 'right');
      } else {
        const y = sim.yc - sim.hw - 18;
        const qx = sim.xt - sim.lin * 0.8;
        g.fillStyle = theme.ink3;
        const w = label(g, qText, qx, y, 2.2);
        g.fillStyle = theme.ink;
        label(g, qVal, qx + w + 4, y, 2.2);

        // After the throat, but pulled back inside the frame on a narrow one.
        const need = trackedWidth(g, tText, 2.2) + 4 + trackedWidth(g, tVal, 2.2);
        const tx = Math.min(sim.xt + sim.lout + 40, W - P - need);
        g.fillStyle = theme.ink3;
        const w2 = label(g, tText, tx, y, 2.2);
        g.fillStyle = theme.ink;
        label(g, tVal, tx + w2 + 4, y, 2.2);
      }
    }
    g.globalAlpha = 1;
  }
}
