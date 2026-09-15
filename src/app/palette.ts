import { srgbToSpace } from '../engine/params';

type Rgb = [number, number, number];

/**
 * Pull the dominant colors out of a photo, ordered dark → light, so the palette-lock force can
 * keep a dissolving image inside its own color world.
 * Clusters in OKLab (perceptual), which groups colors the way the eye does.
 */
export function extractPalette(image: HTMLImageElement, count = 6): string[] {
  const size = 48;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(image, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const rgb: Rgb[] = [];
  const lab: Rgb[] = [];
  for (let i = 0; i < data.length; i += 4) {
    const c: Rgb = [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255];
    rgb.push(c);
    lab.push(srgbToSpace(c, 'oklab'));
  }

  // Seed clusters greedily with the points furthest from those already chosen (k-means++ style).
  const centers: Rgb[] = [lab[Math.floor(lab.length / 2)]];
  while (centers.length < count) {
    let bestIdx = 0;
    let bestDist = -1;
    for (let i = 0; i < lab.length; i += 3) {
      const d = Math.min(...centers.map((c) => dist2(c, lab[i])));
      if (d > bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    centers.push(lab[bestIdx]);
  }

  const assign = new Array<number>(lab.length).fill(0);
  for (let iter = 0; iter < 10; iter++) {
    for (let i = 0; i < lab.length; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let k = 0; k < centers.length; k++) {
        const d = dist2(centers[k], lab[i]);
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      }
      assign[i] = best;
    }
    const sums = centers.map(() => [0, 0, 0, 0]);
    lab.forEach((p, i) => {
      const s = sums[assign[i]];
      s[0] += p[0];
      s[1] += p[1];
      s[2] += p[2];
      s[3]++;
    });
    sums.forEach((s, k) => {
      if (s[3] > 0) centers[k] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
    });
  }

  // Average each cluster's sRGB values, drop empty clusters, order dark → light.
  const sums = centers.map(() => [0, 0, 0, 0]);
  rgb.forEach((c, i) => {
    const s = sums[assign[i]];
    s[0] += c[0];
    s[1] += c[1];
    s[2] += c[2];
    s[3]++;
  });

  return sums
    .filter((s) => s[3] > 0)
    .map((s) => [s[0] / s[3], s[1] / s[3], s[2] / s[3]] as Rgb)
    .sort((a, b) => srgbToSpace(a, 'oklab')[0] - srgbToSpace(b, 'oklab')[0])
    .map(toHex);
}

const dist2 = (a: Rgb, b: Rgb) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

const toHex = (c: Rgb) =>
  '#' + c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');
