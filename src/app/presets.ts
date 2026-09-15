import type { SeedKind } from '../engine/FlockEngine';
import { DEFAULT_PARAMS, type FlockParams } from '../engine/params';

export interface SeedSelection {
  kind: SeedKind;
  paletteId: string;
  imageId: string | null;
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  params: Partial<FlockParams>;
  seed: SeedSelection;
}

export const PRESETS: Preset[] = [
  {
    id: 'liquid',
    name: 'Liquid',
    description: 'Warm film tones melting into slow, glossy currents.',
    params: {
      colorSpace: 'oklab',
      cellSize: 3,
      separation: 1.0,
      alignment: 1.8,
      cohesion: 2.2,
      paletteLock: 1.2,
      maxSpeed: 2.2,
      maxForce: 0.04,
      noise: 0.2,
      renderStyle: 'smooth',
    },
    seed: { kind: 'gradient', paletteId: 'dusk', imageId: null },
  },
  {
    id: 'tribes',
    name: 'Tribes',
    description: 'Cells only follow similar colors, so rival color tribes form and fight for territory.',
    params: {
      colorSpace: 'oklab',
      cellSize: 5,
      tolerance: 0.22,
      separation: 1.2,
      alignment: 1.5,
      cohesion: 2.0,
      noise: 0.6,
      maxSpeed: 2.5,
      maxForce: 0.04,
    },
    seed: { kind: 'random', paletteId: 'saturated', imageId: null },
  },
  {
    id: 'prism',
    name: 'Prism',
    description: 'Hue wraps around the color wheel, so rainbows cycle forever.',
    params: {
      colorSpace: 'hsv',
      cellSize: 4,
      alignment: 2.2,
      cohesion: 1.4,
      separation: 1.2,
      maxSpeed: 4,
      maxForce: 0.05,
      edgeWrap: true,
    },
    seed: { kind: 'gradient', paletteId: 'spectrum', imageId: null },
  },
  {
    id: 'mosaic',
    name: 'Mosaic',
    description: 'Big rounded tiles shuffling through a saturated palette.',
    params: {
      colorSpace: 'oklab',
      cellSize: 28,
      gap: 0.14,
      roundness: 0.3,
      paletteLock: 0.8,
      maxSpeed: 5,
      maxForce: 0.12,
      speed: 1.5,
    },
    seed: { kind: 'palette', paletteId: 'saturated', imageId: null },
  },
  {
    id: 'static',
    name: 'Static',
    description: 'Color walls wrap instead of bounce — glitchy, electric interference.',
    params: {
      colorSpace: 'rgb',
      walls: 'wrap',
      cellSize: 3,
      maxSpeed: 6,
      maxForce: 0.08,
      alignment: 2.5,
    },
    seed: { kind: 'random', paletteId: 'neon-night', imageId: null },
  },
  {
    id: 'classic',
    name: '2016',
    description: 'The original Processing sketch: RGB, 8px squares, random start.',
    params: { ...DEFAULT_PARAMS },
    seed: { kind: 'random', paletteId: 'golden-hour', imageId: null },
  },
];

export const IMAGE_PRESETS: Preset[] = [
  {
    id: 'breathing',
    name: 'Breathing Photo',
    description: 'The photo shimmers and drifts but keeps pulling itself back together.',
    params: {
      colorSpace: 'oklab',
      cellSize: 6,
      anchor: 2.2,
      noise: 1.2,
      separation: 1.5,
      alignment: 1.2,
      cohesion: 1.2,
      maxSpeed: 3,
      maxForce: 0.05,
    },
    seed: { kind: 'image', paletteId: 'golden-hour', imageId: null },
  },
  {
    id: 'melt',
    name: 'Melt',
    description: 'A faint memory of the photo, slowly dissolving into flowing color.',
    params: {
      colorSpace: 'oklab',
      cellSize: 3,
      anchor: 0.35,
      maxSpeed: 2.5,
      maxForce: 0.04,
      renderStyle: 'smooth',
    },
    seed: { kind: 'image', paletteId: 'golden-hour', imageId: null },
  },
];
