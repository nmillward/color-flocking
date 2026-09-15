import type { SeedKind } from '../engine/FlockEngine';
import { DEFAULT_PARAMS, PALETTES, type FlockParams } from '../engine/params';
import type { SeedSelection } from './presets';
import { IMAGES } from './images';

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];
const round = (v: number, step: number) => Math.round(v / step) * step;

/** A random but tasteful combination of settings. */
export function surprise(): { params: FlockParams; seed: SeedSelection } {
  const cellSize = pick([2, 3, 4, 5, 6, 8, 12, 16, 24, 32]);
  const kinds: SeedKind[] = ['random', 'palette', 'gradient', 'gradient'];
  if (IMAGES.length) kinds.push('image', 'image');
  const kind = pick(kinds);

  const params: FlockParams = {
    ...DEFAULT_PARAMS,
    separation: round(rand(0.5, 2.5), 0.1),
    alignment: round(rand(0.8, 2.8), 0.1),
    cohesion: round(rand(0.8, 3), 0.1),
    anchor: kind === 'image' ? round(rand(0.3, 2.5), 0.1) : 0,
    noise: Math.random() < 0.5 ? 0 : round(rand(0.2, 1.5), 0.1),
    maxSpeed: round(rand(1, 6), 0.25),
    maxForce: round(rand(0.01, 0.12), 0.005),
    speed: round(rand(0.8, 2.5), 0.1),
    tolerance: Math.random() < 0.35 ? round(rand(0.12, 0.45), 0.01) : 1,
    radius: pick([1, 1, 2]),
    neighborhood: pick(['square', 'cross', 'circle'] as const),
    edgeWrap: Math.random() < 0.5,
    colorSpace: pick(['rgb', 'oklab', 'oklab', 'hsv'] as const),
    walls: pick(['bounce', 'bounce', 'wrap', 'clamp'] as const),
    cellSize,
    renderStyle: cellSize <= 4 && Math.random() < 0.4 ? 'smooth' : 'crisp',
    gap: cellSize >= 12 && Math.random() < 0.5 ? round(rand(0.05, 0.25), 0.01) : 0,
    roundness: cellSize >= 12 && Math.random() < 0.4 ? round(rand(0.1, 1), 0.05) : 0,
  };

  return {
    params,
    seed: {
      kind,
      paletteId: pick(PALETTES).id,
      imageId: kind === 'image' ? pick(IMAGES).id : null,
    },
  };
}
