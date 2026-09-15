export type ColorSpace = 'rgb' | 'oklab' | 'hsv';
export type WallMode = 'bounce' | 'wrap' | 'clamp';
export type Neighborhood = 'cross' | 'square' | 'circle';
export type RenderStyle = 'crisp' | 'smooth';
export type GridType = 'square' | 'hex';
export type CellShape = 'square' | 'circle' | 'diamond' | 'hexagon';

export interface FlockParams {
  // Forces
  separation: number;
  alignment: number;
  cohesion: number;
  /** Pull back toward each cell's starting color. */
  anchor: number;
  /** Keep colors near the chosen palette's gradient (palette and flow starts only). */
  paletteLock: number;
  /** Random kicks, as a multiple of max force. */
  noise: number;

  // Motion (maxSpeed / maxForce use the original sketch's 0–255 color units)
  maxSpeed: number;
  maxForce: number;
  /** Simulation steps per frame (at 60fps). */
  speed: number;

  // Neighbors
  /** 0–1 color distance; 1 means every neighbor counts. */
  tolerance: number;
  radius: number;
  neighborhood: Neighborhood;
  edgeWrap: boolean;

  // Color
  colorSpace: ColorSpace;
  walls: WallMode;

  // Grid
  /** Cell size in CSS pixels. */
  cellSize: number;
  /** Square grid (8 neighbors) or hex grid (6 neighbors, offset rows). */
  grid: GridType;
  cellShape: CellShape;
  /** Cell width ÷ height. Above 1 = wide cells, below 1 = tall cells. */
  aspect: number;
  /** Gap between cells as a fraction of the cell. */
  gap: number;
  roundness: number;
  renderStyle: RenderStyle;
}

/** The 2016 Processing sketch, faithfully. */
export const DEFAULT_PARAMS: FlockParams = {
  separation: 1.5,
  alignment: 1.5,
  cohesion: 2.0,
  anchor: 0,
  paletteLock: 0,
  noise: 0,
  maxSpeed: 2,
  maxForce: 0.02,
  speed: 1,
  tolerance: 1,
  radius: 1,
  neighborhood: 'square',
  edgeWrap: false,
  colorSpace: 'rgb',
  walls: 'bounce',
  cellSize: 8,
  grid: 'square',
  cellShape: 'square',
  aspect: 1,
  gap: 0,
  roundness: 0,
  renderStyle: 'crisp',
};

export interface Palette {
  id: string;
  name: string;
  colors: string[];
}

export const PALETTES: Palette[] = [
  { id: 'golden-hour', name: 'Golden Hour', colors: ['#2f4f5a', '#6f8f8a', '#c38d6b', '#e8a87c', '#f2d6b3', '#f6efe6'] },
  { id: 'neon-night', name: 'Neon Night', colors: ['#0b1a2e', '#1f3b73', '#2ec4b6', '#e63946', '#ff7b54', '#ffd166'] },
  { id: 'saturated', name: 'Saturated', colors: ['#003049', '#2a9d8f', '#d62828', '#f77f00', '#fcbf49', '#eae2b7'] },
  { id: 'evergreen', name: 'Evergreen', colors: ['#10261c', '#1b4332', '#40916c', '#95d5b2', '#d8f3dc', '#f9c74f'] },
  { id: 'postcard', name: 'Postcard', colors: ['#1d3557', '#457b9d', '#a8dadc', '#f1faee', '#f4a261', '#e63946'] },
  { id: 'dusk', name: 'Dusk', colors: ['#0d0221', '#261447', '#6b2d5c', '#f0544f', '#ff9e5e', '#ffd8a8'] },
  { id: 'spectrum', name: 'Spectrum', colors: ['#7b2cbf', '#00a6fb', '#3ddc97', '#ffd500', '#ff8500', '#ff0054'] },
  { id: 'silver', name: 'Silver', colors: ['#0a0a0a', '#3a3a3a', '#7a7a7a', '#bdbdbd', '#f2f2f2'] },
];

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** OKLab a/b channels span [-AB_RANGE, AB_RANGE]. Shared with the shaders. */
export const AB_RANGE = 0.22;

/** CPU mirror of the shader's encodeSpace(): sRGB → normalized coordinates in `space`. */
export function srgbToSpace([r, g, b]: [number, number, number], space: ColorSpace): [number, number, number] {
  if (space === 'oklab') {
    const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const [lr, lg, lb] = [lin(r), lin(g), lin(b)];
    const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
    const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
    const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
    const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return [L, A / (2 * AB_RANGE) + 0.5, B / (2 * AB_RANGE) + 0.5];
  }
  if (space === 'hsv') {
    const max = Math.max(r, g, b);
    const d = max - Math.min(r, g, b);
    let h = 0;
    if (d > 0) {
      if (max === r) h = ((g - b) / d + 6) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
    }
    return [h / 6, max > 0 ? d / max : 0, max];
  }
  return [r, g, b];
}
