// GLSL shaders. Every simulation texel is one grid cell.
// Color spaces (uSpace): 0 = RGB, 1 = OKLab, 2 = HSV. All are stored normalized to [0, 1]^3.
import { AB_RANGE } from './params';

const COMMON = /* glsl */ `
precision highp float;
precision highp int;
precision highp sampler2D;

const float AB_RANGE = ${AB_RANGE.toFixed(4)};

vec3 srgbToLinear(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}

vec3 linearToSrgb(vec3 c) {
  c = max(c, vec3(0.0));
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

vec3 linearToOklab(vec3 c) {
  float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
  float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
  float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
  l = pow(max(l, 0.0), 1.0 / 3.0);
  m = pow(max(m, 0.0), 1.0 / 3.0);
  s = pow(max(s, 0.0), 1.0 / 3.0);
  return vec3(
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  );
}

vec3 oklabToLinear(vec3 c) {
  float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  l = l * l * l;
  m = m * m * m;
  s = s * s * s;
  return vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}

vec3 rgbToHsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsvToRgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}

vec3 encodeSpace(vec3 srgb, int space) {
  srgb = clamp(srgb, 0.0, 1.0);
  if (space == 1) {
    vec3 lab = linearToOklab(srgbToLinear(srgb));
    return vec3(lab.x, lab.y / (2.0 * AB_RANGE) + 0.5, lab.z / (2.0 * AB_RANGE) + 0.5);
  }
  if (space == 2) return rgbToHsv(srgb);
  return srgb;
}

bool inGamut(vec3 lin) {
  return all(greaterThanEqual(lin, vec3(-0.0005))) && all(lessThanEqual(lin, vec3(1.0005)));
}

// Out-of-gamut OKLab colors keep their lightness and hue; chroma shrinks until displayable.
vec3 oklabToSrgbGamut(vec3 lab) {
  lab.x = clamp(lab.x, 0.0, 1.0);
  vec3 lin = oklabToLinear(lab);
  if (!inGamut(lin)) {
    float lo = 0.0;
    float hi = 1.0;
    for (int i = 0; i < 7; i++) {
      float mid = 0.5 * (lo + hi);
      if (inGamut(oklabToLinear(vec3(lab.x, lab.yz * mid)))) lo = mid; else hi = mid;
    }
    lin = oklabToLinear(vec3(lab.x, lab.yz * lo));
  }
  return clamp(linearToSrgb(lin), 0.0, 1.0);
}

vec3 decodeSpace(vec3 p, int space) {
  if (space == 1) {
    return oklabToSrgbGamut(vec3(p.x, (p.y - 0.5) * 2.0 * AB_RANGE, (p.z - 0.5) * 2.0 * AB_RANGE));
  }
  if (space == 2) return hsvToRgb(vec3(fract(p.x), clamp(p.yz, 0.0, 1.0)));
  return clamp(p, 0.0, 1.0);
}

uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}

vec3 rand3(ivec2 p, uint s) {
  return vec3(pcg3d(uvec3(uvec2(p), s))) / 4294967295.0;
}

// Center of grid cell p in canvas pixels. On hex grids, odd rows shift right by half a cell.
vec2 cellCenterPx(ivec2 p, vec2 cell, vec2 offset, int hex) {
  float shift = (hex == 1 && (p.y & 1) == 1) ? 0.5 : 0.0;
  return offset + (vec2(p) + vec2(0.5 + shift, 0.5)) * cell;
}
`;

export const VERT = /* glsl */ `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

/** One flocking step for every cell at once. Writes new color + velocity (MRT). */
export const SIM_FRAG = /* glsl */ `#version 300 es
${COMMON}
uniform sampler2D uColor;
uniform sampler2D uVel;
uniform sampler2D uAnchor;
uniform ivec2 uGrid;
uniform int uRadius;
uniform int uShape;     // 0 cross, 1 square, 2 circle
uniform int uEdgeWrap;
uniform int uHex;
uniform float uSep;
uniform float uAlign;
uniform float uCoh;
uniform float uAnchorW;
uniform float uNoise;
uniform float uMaxSpeed;
uniform float uMaxForce;
uniform float uTol;
uniform int uSpace;
uniform int uWall;      // 0 bounce, 1 wrap, 2 clamp
uniform uint uFrame;
uniform vec3 uPal[8];   // palette, already encoded in the active color space
uniform int uPalCount;
uniform float uPalLock;

layout(location = 0) out vec4 oColor;
layout(location = 1) out vec4 oVel;

vec3 limitLen(vec3 v, float m) {
  float l = length(v);
  return l > m ? v * (m / l) : v;
}

vec3 safeNorm(vec3 v) {
  float l = length(v);
  return l > 1e-9 ? v / l : vec3(0.0);
}

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec3 c = texelFetch(uColor, p, 0).rgb;
  vec3 v = texelFetch(uVel, p, 0).rgb;

  // Channels that wrap around (hue always does in HSV; everything does in wrap mode).
  vec3 wrapMask = uWall == 1 ? vec3(1.0) : (uSpace == 2 ? vec3(1.0, 0.0, 0.0) : vec3(0.0));

  vec3 sumV = vec3(0.0);
  vec3 sumD = vec3(0.0);
  vec3 sumS = vec3(0.0);
  float wSum = 0.0;
  float tolHi = uTol * 1.35 + 0.001;
  int r = uRadius;
  int q1 = p.x - (p.y - (p.y & 1)) / 2; // axial column, for hex distances

  for (int dy = -r; dy <= r; dy++) {
    for (int dx = -r; dx <= r; dx++) {
      if (dx == 0 && dy == 0) continue;
      float gridDist;
      if (uHex == 1) {
        int y2 = p.y + dy;
        int dq = (p.x + dx - (y2 - (y2 & 1)) / 2) - q1;
        int hexDist = (abs(dq) + abs(dy) + abs(dq + dy)) / 2;
        if (hexDist > r) continue;
        gridDist = float(hexDist);
      } else {
        if (uShape == 0 && abs(dx) + abs(dy) > r) continue;
        if (uShape == 2 && dx * dx + dy * dy > r * r + 1) continue;
        gridDist = length(vec2(dx, dy));
      }

      ivec2 q = p + ivec2(dx, dy);
      if (uEdgeWrap == 1) {
        q = (q + uGrid) % uGrid;
      } else if (q.x < 0 || q.y < 0 || q.x >= uGrid.x || q.y >= uGrid.y) {
        continue;
      }

      vec3 cj = texelFetch(uColor, q, 0).rgb;
      vec3 vj = texelFetch(uVel, q, 0).rgb;
      vec3 d = cj - c;
      d -= floor(d + 0.5) * wrapMask;
      float dist = length(d);

      // Tolerance: ignore neighbors whose color is too different.
      float w = uTol >= 0.999 ? 1.0 : 1.0 - smoothstep(uTol, tolHi, dist);
      w /= gridDist;

      sumV += vj * w;
      sumD += d * w;
      sumS -= safeNorm(d) * w;
      wSum += w;
    }
  }

  vec3 acc = vec3(0.0);
  if (wSum > 1e-4) {
    // Reynolds steering: desired - velocity, capped at max force.
    acc += limitLen(safeNorm(sumV) * uMaxSpeed - v, uMaxForce) * uAlign;
    acc += limitLen(safeNorm(sumD) * uMaxSpeed - v, uMaxForce) * uCoh;
    acc += limitLen(safeNorm(sumS) * uMaxSpeed - v, uMaxForce) * uSep;
  }

  // Anchor: a spring back toward the cell's starting color. It pulls without braking, so an
  // image shimmers and breathes around itself instead of freezing in place.
  if (uAnchorW > 0.0) {
    vec3 d = texelFetch(uAnchor, p, 0).rgb - c;
    d -= floor(d + 0.5) * wrapMask;
    acc += limitLen(d * (uMaxForce / 0.05), uMaxForce) * uAnchorW;
  }

  // Palette lock: the palette's gradient (a polyline in color space) acts like a rail.
  // Colors are pulled onto it and lose sideways drift, but keep gliding along it.
  if (uPalLock > 0.0 && uPalCount > 1) {
    vec3 toRail = vec3(0.0);
    vec3 tangent = vec3(0.0);
    float bestD = 1e9;
    for (int i = 0; i < 7; i++) {
      if (i >= uPalCount - 1) break;
      vec3 a = uPal[i];
      vec3 ab = uPal[i + 1] - a;
      float t = clamp(dot(c - a, ab) / max(dot(ab, ab), 1e-8), 0.0, 1.0);
      vec3 dq = a + ab * t - c;
      dq -= floor(dq + 0.5) * wrapMask;
      float d2 = dot(dq, dq);
      if (d2 < bestD) { bestD = d2; toRail = dq; tangent = safeNorm(ab); }
    }
    vec3 along = dot(v, tangent) * tangent;
    vec3 desired = along + safeNorm(toRail) * uMaxSpeed * min(1.0, sqrt(bestD) / 0.05);
    acc += limitLen(desired - v, uMaxForce) * uPalLock;
  }

  if (uNoise > 0.0) {
    acc += (rand3(p, uFrame) * 2.0 - 1.0) * uMaxForce * uNoise;
  }

  v = limitLen(v + acc, uMaxSpeed);
  c += v;

  for (int i = 0; i < 3; i++) {
    if (wrapMask[i] > 0.5) {
      c[i] = fract(c[i]);
    } else if (uWall == 0) {
      if (c[i] < 0.0) { c[i] = -c[i]; v[i] = abs(v[i]); }
      else if (c[i] > 1.0) { c[i] = 2.0 - c[i]; v[i] = -abs(v[i]); }
    } else if (c[i] < 0.0 || c[i] > 1.0) {
      c[i] = clamp(c[i], 0.0, 1.0);
      v[i] = 0.0;
    }
  }

  oColor = vec4(c, 1.0);
  oVel = vec4(v, 1.0);
}
`;

/** Generates the starting ("anchor") colors, encoded in the active color space. */
export const SEED_FRAG = /* glsl */ `#version 300 es
${COMMON}
uniform int uMode;       // 0 random, 1 grayscale, 2 palette, 3 gradient, 4 image
uniform uint uSeed;
uniform ivec2 uGrid;
uniform int uSpace;
uniform vec3 uPalette[8];
uniform int uPaletteSize;
uniform sampler2D uImage;
uniform vec2 uImageSize;
uniform vec2 uCell;
uniform vec2 uOffset;
uniform vec2 uCanvas;
uniform int uHex;
out vec4 oColor;

float vnoise(vec2 x, uint s) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  vec2 u = f * f * (3.0 - 2.0 * f);
  ivec2 ii = ivec2(i);
  float a = rand3(ii, s).x;
  float b = rand3(ii + ivec2(1, 0), s).x;
  float c = rand3(ii + ivec2(0, 1), s).x;
  float d = rand3(ii + ivec2(1, 1), s).x;
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 x, uint s) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(x, s + uint(i) * 7919u);
    x = x * 2.03 + 17.1;
    a *= 0.5;
  }
  return v / 0.96875;
}

vec3 paletteRamp(float t) {
  int n = max(uPaletteSize, 1);
  float x = clamp(t, 0.0, 1.0) * float(n - 1);
  int i = int(floor(x));
  int j = min(i + 1, n - 1);
  return mix(uPalette[i], uPalette[j], smoothstep(0.0, 1.0, fract(x)));
}

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec2 uv = cellCenterPx(p, uCell, uOffset, uHex) / uCanvas;
  vec3 r = rand3(p, uSeed);
  vec3 col;

  if (uMode == 0) {
    col = r;
  } else if (uMode == 1) {
    col = vec3(r.x);
  } else if (uMode == 2) {
    int n = max(uPaletteSize, 1);
    int i = min(int(r.x * float(n)), n - 1);
    col = uPalette[i] + (r.yzx - 0.5) * 0.06;
  } else if (uMode == 3) {
    float aspect = uCanvas.x / uCanvas.y;
    vec2 q = vec2(uv.x * aspect, uv.y) * 2.2 + 100.0;
    vec3 o = rand3(ivec2(7, 13), uSeed) * 50.0;
    vec2 warp = vec2(fbm(q + o.xy, uSeed), fbm(q + o.yz + 5.2, uSeed + 3u));
    float t = fbm(q + warp * 1.6 + o.zx, uSeed + 11u);
    col = paletteRamp(smoothstep(0.22, 0.78, t));
  } else {
    // Cover-fit the image to the grid, averaging the pixels under each cell via mipmaps.
    float gridAspect = uCanvas.x / uCanvas.y;
    float imgAspect = uImageSize.x / uImageSize.y;
    vec2 iuv = uv;
    vec2 visible = uImageSize;
    if (gridAspect > imgAspect) {
      float k = imgAspect / gridAspect;
      iuv.y = (uv.y - 0.5) * k + 0.5;
      visible.y *= k;
    } else {
      float k = gridAspect / imgAspect;
      iuv.x = (uv.x - 0.5) * k + 0.5;
      visible.x *= k;
    }
    float lod = log2(max(visible.x * uCell.x / uCanvas.x, 1.0));
    col = textureLod(uImage, iuv, lod).rgb;
  }

  oColor = vec4(encodeSpace(col, uSpace), 1.0);
}
`;

/** Copies anchor colors into the live state and gives each cell a small starting velocity. */
export const INIT_FRAG = /* glsl */ `#version 300 es
${COMMON}
uniform sampler2D uAnchor;
uniform uint uSeed;
uniform float uKick;
layout(location = 0) out vec4 oColor;
layout(location = 1) out vec4 oVel;

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  oColor = texelFetch(uAnchor, p, 0);
  vec3 r = rand3(p, uSeed ^ 0x9e3779b9u) * 2.0 - 1.0;
  oVel = vec4(r * uKick, 1.0);
}
`;

/** Nearest-neighbor resample, used when the grid resolution changes. */
export const RESAMPLE_FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform sampler2D uSrc;
uniform ivec2 uSrcSize;
uniform ivec2 uDstSize;
out vec4 oColor;

void main() {
  vec2 uv = gl_FragCoord.xy / vec2(uDstSize);
  ivec2 q = clamp(ivec2(uv * vec2(uSrcSize)), ivec2(0), uSrcSize - 1);
  oColor = texelFetch(uSrc, q, 0);
}
`;

/** Converts stored colors from one color space to another. */
export const CONVERT_FRAG = /* glsl */ `#version 300 es
${COMMON}
uniform sampler2D uSrc;
uniform int uFrom;
uniform int uTo;
out vec4 oColor;

void main() {
  vec3 c = texelFetch(uSrc, ivec2(gl_FragCoord.xy), 0).rgb;
  oColor = vec4(encodeSpace(decodeSpace(c, uFrom), uTo), 1.0);
}
`;

/** Draws the grid: square or hex cells with optional shapes, gaps and rounding, or smooth blending. */
export const RENDER_FRAG = /* glsl */ `#version 300 es
${COMMON}
uniform sampler2D uColor;
uniform ivec2 uGrid;
uniform vec2 uCell;      // cell width, row height (device px)
uniform vec2 uOffset;
uniform int uHex;
uniform int uShapeKind;  // 0 square, 1 circle, 2 diamond, 3 hexagon
uniform float uGap;
uniform float uRound;
uniform int uSmooth;
uniform int uSpace;
uniform vec3 uBg;
out vec4 oColor;

const float HEX_ROW = 0.8660254;

vec3 cellColor(ivec2 c) {
  return decodeSpace(texelFetch(uColor, clamp(c, ivec2(0), uGrid - 1), 0).rgb, uSpace);
}

// Signed distance (px) to a cell shape centered at the origin with half-width e.
float shapeSdf(vec2 p, float e, int kind) {
  if (kind == 1) return length(p) - e;
  if (kind == 2) return (abs(p.x) + abs(p.y) - e) * 0.70710678;
  if (kind == 3) {
    vec2 a = abs(p);
    return max(a.x, a.x * 0.5 + a.y * HEX_ROW) - e;
  }
  vec2 d = abs(p) - vec2(e);
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

void main() {
  vec2 f = gl_FragCoord.xy - uOffset;
  ivec2 cell = ivec2(0);
  vec2 local = vec2(0.0); // px from the cell's center
  vec3 col;

  if (uHex == 1) {
    // The nearest cell center wins, which carves the plane into hexagons.
    float row = floor(f.y / uCell.y);
    float best = 1e20;
    vec3 blend = vec3(0.0);
    float wSum = 0.0;
    for (int j = -1; j <= 1; j++) {
      float ry = row + float(j);
      float shift = mod(ry, 2.0) >= 1.0 ? 0.5 : 0.0;
      float gx = f.x / uCell.x - shift;
      float cx0 = floor(gx);
      float cx1 = cx0 + (fract(gx) < 0.5 ? -1.0 : 1.0);
      for (int i = 0; i < 2; i++) {
        float cx = i == 0 ? cx0 : cx1;
        vec2 dv = f - (vec2(cx, ry) + vec2(0.5 + shift, 0.5)) * uCell;
        vec2 dn = vec2(dv.x, dv.y * uCell.x * HEX_ROW / uCell.y);
        float d2 = dot(dn, dn);
        ivec2 c = ivec2(int(cx), int(ry));
        if (d2 < best) { best = d2; cell = c; local = dv; }
        if (uSmooth == 1) {
          float w = exp(-d2 / (0.12 * uCell.x * uCell.x));
          blend += cellColor(c) * w;
          wSum += w;
        }
      }
    }
    col = uSmooth == 1 ? blend / max(wSum, 1e-6) : cellColor(cell);
  } else {
    vec2 g = f / uCell;
    cell = ivec2(floor(g));
    local = (fract(g) - 0.5) * uCell;
    if (uSmooth == 1) {
      vec2 h = g - 0.5;
      ivec2 i = ivec2(floor(h));
      vec2 t = fract(h);
      t = t * t * (3.0 - 2.0 * t);
      col = mix(
        mix(cellColor(i), cellColor(i + ivec2(1, 0)), t.x),
        mix(cellColor(i + ivec2(0, 1)), cellColor(i + ivec2(1, 1)), t.x),
        t.y
      );
    } else {
      col = cellColor(cell);
    }
  }

  int defaultShape = uHex == 1 ? 3 : 0;
  if (uSmooth == 0 && (uGap > 0.0 || uRound > 0.0 || uShapeKind != defaultShape)) {
    vec2 natural = uHex == 1 ? vec2(uCell.x, uCell.x * HEX_ROW) : vec2(min(uCell.x, uCell.y));
    vec2 p = local * natural / uCell;
    float e = 0.5 * natural.x * (1.0 - uGap);
    float rad = uRound * e * 0.9;
    float d = shapeSdf(p, e - rad, uShapeKind) - rad;
    col = mix(uBg, col, clamp(0.5 - d, 0.0, 1.0));
  }

  oColor = vec4(col, 1.0);
}
`;
