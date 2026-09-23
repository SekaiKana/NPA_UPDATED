/**
 * Liquid-glass refraction shader.
 *
 * The SDF shapes, the three-band intensity model (base / edge / rim, each an
 * exponential falloff from the panel edge), the corner boost and the ripple
 * term are adapted from liquid-glass-js by Armagan Amcalar (MIT).
 * https://github.com/dashersw/liquid-glass-js
 *
 * Two deliberate departures from the original:
 *
 *  1. It sampled a static `html2canvas` snapshot of the page in page
 *     coordinates, with scroll offsets threaded through as uniforms. We sample
 *     the live gradient render target in *screen* space via gl_FragCoord, so
 *     the panel refracts what is genuinely behind it, this frame, and all the
 *     page/scroll coordinate juggling disappears.
 *  2. Its 13x13 Gaussian (169 taps per pixel) is replaced by a 5-tap cross and
 *     chromatic aberration. The source is an already-blurred low-frequency
 *     field, so the big kernel bought nothing; splitting the sample offset per
 *     channel buys the one thing CSS backdrop-filter genuinely cannot do.
 */

export const glassVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const glassFragmentShader = /* glsl */ `
  precision mediump float;

  uniform sampler2D uBackground;
  uniform vec2  uResolution;    // canvas size, device px
  uniform vec2  uPanelSize;     // panel size, CSS px
  uniform float uRadius;        // corner radius, CSS px
  uniform float uShape;         // 0 rounded, 1 pill, 2 circle
  uniform float uTint;
  uniform vec3  uTintColor;
  uniform float uEdgeIntensity;
  uniform float uRimIntensity;
  uniform float uBaseIntensity;
  uniform float uEdgeDistance;
  uniform float uRimDistance;
  uniform float uBaseDistance;
  uniform float uCornerBoost;
  uniform float uRipple;
  uniform float uDispersion;
  uniform float uOpacity;

  varying vec2 vUv;

  // Signed distance to a rounded rectangle. Negative inside.
  float roundedRectDistance(vec2 coord, vec2 size, float radius) {
    vec2 center = size * 0.5;
    vec2 pixelCoord = coord * size;
    vec2 toCorner = abs(pixelCoord - center) - (center - radius);
    float outsideCorner = length(max(toCorner, 0.0));
    float insideCorner = min(max(toCorner.x, toCorner.y), 0.0);
    return outsideCorner + insideCorner - radius;
  }

  float circleDistance(vec2 coord, vec2 size) {
    vec2 pixelCoord = coord * size;
    vec2 centerPixel = size * 0.5;
    return length(pixelCoord - centerPixel) - min(size.x, size.y) * 0.5;
  }

  // Capsule: a segment with a radius.
  float pillDistance(vec2 coord, vec2 size, float radius) {
    vec2 center = size * 0.5;
    vec2 pixelCoord = coord * size;
    vec2 a = vec2(radius, center.y);
    vec2 b = vec2(size.x - radius, center.y);
    vec2 axis = b - a;
    float len2 = dot(axis, axis);
    if (len2 <= 0.0) return length(pixelCoord - center) - radius;
    float t = clamp(dot(pixelCoord - a, axis) / len2, 0.0, 1.0);
    return length(pixelCoord - (a + t * axis)) - radius;
  }

  void main() {
    vec2 coord = vUv;
    vec2 size = uPanelSize;

    float dist;
    vec2 shapeNormal;

    if (uShape > 1.5) {
      dist = -circleDistance(coord, size);
      shapeNormal = normalize(coord - vec2(0.5) + 1e-6);
    } else if (uShape > 0.5) {
      dist = -pillDistance(coord, size, uRadius);
      vec2 pixelCoord = coord * size;
      vec2 a = vec2(uRadius, size.y * 0.5);
      vec2 b = vec2(size.x - uRadius, size.y * 0.5);
      vec2 axis = b - a;
      float len2 = max(dot(axis, axis), 1e-6);
      float t = clamp(dot(pixelCoord - a, axis) / len2, 0.0, 1.0);
      vec2 dir = pixelCoord - (a + t * axis);
      shapeNormal = length(dir) > 0.0 ? normalize(dir) : vec2(0.0, 1.0);
    } else {
      dist = -roundedRectDistance(coord, size, uRadius);
      shapeNormal = normalize(coord - vec2(0.5) + 1e-6);
    }

    // Outside the shape: fully transparent, so the rounded corners are real
    // cut-outs rather than a square of near-invisible pixels.
    float coverage = smoothstep(-1.0, 1.0, dist);
    if (coverage <= 0.001) discard;

    float d = max(dist, 0.0);

    // Three exponential bands. Rim is tightest, base is broadest; together
    // they read as glass thickening toward its edge.
    float base = 1.0 - exp(-d * uBaseDistance);
    float edge = exp(-d * uEdgeDistance);
    float rim  = exp(-d * uRimDistance);

    vec2 refraction = shapeNormal * (base * uBaseIntensity
                                   + edge * uEdgeIntensity
                                   + rim  * uRimIntensity);

    // Corners bend light hardest — where the surface curves in two axes.
    vec2 fromCenter = abs(coord - 0.5) * 2.0;
    float cornerNear = min(fromCenter.x, fromCenter.y);
    refraction += shapeNormal * exp(-(1.0 - cornerNear) * 6.0) * uCornerBoost;

    // A standing wave along the rim, tangent to the surface.
    vec2 tangent = vec2(-shapeNormal.y, shapeNormal.x);
    refraction += tangent * sin(d * 0.35) * uRipple * rim;

    // Sample the live field in screen space: exactly what sits behind this
    // pixel, offset by however much the glass bends it.
    vec2 screenUv = gl_FragCoord.xy / uResolution;

    // Split the offset per channel. Longer wavelengths bend less, so red
    // trails blue — the giveaway that this is real refraction, not a blur.
    float disp = uDispersion;
    vec3 refracted;
    refracted.r = texture2D(uBackground, screenUv + refraction * (1.0 + disp)).r;
    refracted.g = texture2D(uBackground, screenUv + refraction).g;
    refracted.b = texture2D(uBackground, screenUv + refraction * (1.0 - disp)).b;

    // Cheap 5-tap cross softens the sampled field without a 169-tap kernel.
    vec2 texel = 1.5 / uResolution;
    vec3 blur = refracted;
    blur += texture2D(uBackground, screenUv + refraction + vec2( texel.x, 0.0)).rgb;
    blur += texture2D(uBackground, screenUv + refraction + vec2(-texel.x, 0.0)).rgb;
    blur += texture2D(uBackground, screenUv + refraction + vec2(0.0,  texel.y)).rgb;
    blur += texture2D(uBackground, screenUv + refraction + vec2(0.0, -texel.y)).rgb;
    blur /= 5.0;

    vec3 color = mix(blur, uTintColor, uTint);

    // Rim light: a bright hairline catching along the top edge, which is what
    // sells a surface as glass rather than as frosted plastic.
    float rimLight = rim * 0.55 * smoothstep(0.0, 0.6, 1.0 - coord.y);
    color += vec3(rimLight);

    gl_FragColor = vec4(color, coverage * uOpacity);
  }
`;

/**
 * The WebGL quad's own tint stays minimal — the DOM plate above it provides
 * legibility. Tinting in both places compounds into opacity and kills the
 * refraction that is the entire point of the layer.
 */
export const WEBGL_GLASS_TINT = 0.06;

/** Tuned for porcelain: restrained bend, visible dispersion, bright rim. */
export const GLASS_DEFAULTS = {
  edgeIntensity: 0.014,
  rimIntensity: 0.05,
  baseIntensity: 0.006,
  edgeDistance: 0.12,
  rimDistance: 0.55,
  baseDistance: 0.06,
  cornerBoost: 0.02,
  ripple: 0.006,
  dispersion: 0.22,
};
