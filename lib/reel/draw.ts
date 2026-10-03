/**
 * Canvas drawing helpers shared by every shot.
 *
 * The reel draws its annotations the way the rest of the site sets its
 * labels: the sans, bold, uppercase, tracked wide. Canvas has no dependable
 * `letterSpacing` across the browsers this site supports, so tracking is done
 * by hand, one glyph at a time, with the advance widths cached per font.
 */

const widthCache = new Map<string, number>();

function glyphWidth(g: CanvasRenderingContext2D, ch: string): number {
  const key = `${g.font}|${ch}`;
  let w = widthCache.get(key);
  if (w === undefined) {
    w = g.measureText(ch).width;
    widthCache.set(key, w);
  }
  return w;
}

/** Width of a string set with manual tracking. */
export function trackedWidth(g: CanvasRenderingContext2D, text: string, tracking: number): number {
  let w = 0;
  for (const ch of text) w += glyphWidth(g, ch) + tracking;
  return Math.max(0, w - tracking);
}

/**
 * Draws a tracked label. `reveal` (0..1) types it on from the left, which is
 * how every annotation in the reel arrives: written, not faded.
 */
export function label(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number,
  align: 'left' | 'right' | 'center' = 'left',
  reveal = 1
): number {
  const total = trackedWidth(g, text, tracking);
  let cx = align === 'left' ? x : align === 'right' ? x - total : x - total / 2;
  const chars = Array.from(text);
  const shown = reveal >= 1 ? chars.length : Math.floor(chars.length * reveal);
  for (let i = 0; i < shown; i += 1) {
    g.fillText(chars[i], cx, y);
    cx += glyphWidth(g, chars[i]) + tracking;
  }
  return total;
}

/** Forgets cached advances. Called when the webfonts land and every width changes. */
export function resetGlyphCache() {
  widthCache.clear();
}

export function roundRectPath(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  g.moveTo(x + rr, y);
  g.lineTo(x + w - rr, y);
  g.arcTo(x + w, y, x + w, y + rr, rr);
  g.lineTo(x + w, y + h - rr);
  g.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  g.lineTo(x + rr, y + h);
  g.arcTo(x, y + h, x, y + h - rr, rr);
  g.lineTo(x, y + rr);
  g.arcTo(x, y, x + rr, y, rr);
  g.closePath();
}

/**
 * Strokes the current path drawn on to `p` of its length.
 *
 * The line-dash trick: a dash as long as the whole path, offset so that only
 * the first `p` of it is inked. It is what makes a frame or an axis appear to
 * be drawn by a pen rather than faded in.
 */
export function strokeDrawn(g: CanvasRenderingContext2D, length: number, p: number) {
  if (p <= 0) return;
  if (p >= 1) {
    g.stroke();
    return;
  }
  g.setLineDash([length * p, length]);
  g.stroke();
  g.setLineDash([]);
}

/** A dimension-line end: the short perpendicular tick a draughtsman puts on each end. */
export function tick(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  horizontal: boolean,
  size: number
) {
  if (horizontal) {
    g.moveTo(x - size, y);
    g.lineTo(x + size, y);
  } else {
    g.moveTo(x, y - size);
    g.lineTo(x, y + size);
  }
}
