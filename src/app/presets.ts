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

// Tuned with src/dev/tuning.ts. Flowing presets use a strong palette lock with a wide, soft
// neighborhood: colors glide along the palette like a rail, giving smooth traveling forms.
const LIQUID_BASE: Partial<FlockParams> = {
  colorSpace: 'oklab',
  renderStyle: 'smooth',
  neighborhood: 'circle',
};

export const PRESETS: Preset[] = [
  {
    id: 'liquid',
    name: 'Liquid',
    description: 'Dusky film tones folding into slow, glowing currents.',
    params: {
      ...LIQUID_BASE,
      cellSize: 3,
      radius: 3,
      separation: 0.8,
      alignment: 2.5,
      cohesion: 1.2,
      paletteLock: 3,
      maxSpeed: 1.2,
      maxForce: 0.012,
      noise: 0.3,
    },
    seed: { kind: 'gradient', paletteId: 'dusk', imageId: null },
  },
  {
    id: 'veins',
    name: 'Veins',
    description: 'Warm color pools split by dark, shifting veins, like marbled paper.',
    params: {
      ...LIQUID_BASE,
      cellSize: 3,
      radius: 2,
      separation: 0.6,
      alignment: 2.5,
      cohesion: 1.5,
      paletteLock: 2.5,
      maxSpeed: 1,
      maxForce: 0.01,
    },
    seed: { kind: 'gradient', paletteId: 'golden-hour', imageId: null },
  },
  {
    id: 'postcard',
    name: 'Postcard',
    description: 'The same currents, pixelated: chunky cells in faded blues and warm reds.',
    params: {
      colorSpace: 'oklab',
      cellSize: 10,
      radius: 2,
      neighborhood: 'circle',
      separation: 0.8,
      alignment: 2.5,
      cohesion: 1.2,
      paletteLock: 2.5,
      maxSpeed: 1.5,
      maxForce: 0.015,
    },
    seed: { kind: 'gradient', paletteId: 'postcard', imageId: null },
  },
  {
    id: 'prism',
    name: 'Prism',
    description: 'Hue wraps around the color wheel, so rainbow contour lines ripple outward.',
    params: {
      colorSpace: 'hsv',
      cellSize: 4,
      radius: 2,
      neighborhood: 'circle',
      separation: 1.0,
      alignment: 2.2,
      cohesion: 1.4,
      anchor: 0.6,
      maxSpeed: 0.8,
      maxForce: 0.012,
      edgeWrap: true,
    },
    seed: { kind: 'gradient', paletteId: 'spectrum', imageId: null },
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
    id: 'mosaic',
    name: 'Mosaic',
    description: 'Big rounded tiles trading colors from a saturated palette.',
    params: {
      colorSpace: 'oklab',
      cellSize: 28,
      gap: 0.14,
      roundness: 0.3,
      paletteLock: 2.5,
      separation: 1.5,
      alignment: 1.5,
      cohesion: 1.0,
      maxSpeed: 2,
      maxForce: 0.03,
    },
    seed: { kind: 'palette', paletteId: 'saturated', imageId: null },
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
