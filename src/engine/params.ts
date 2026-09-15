export type ColorSpace = 'rgb' | 'oklab' | 'hsv';
export type WallMode = 'bounce' | 'wrap' | 'clamp';
export type Neighborhood = 'cross' | 'square' | 'circle';
export type RenderStyle = 'crisp' | 'smooth';

export interface FlockParams {
  // Forces
  separation: number;
  alignment: number;
  cohesion: number;
  /** Pull back toward each cell's starting color. */
  anchor: number;
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
