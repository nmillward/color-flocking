// Dev-only helpers for tuning presets from the browser console.
// Usage: await tuning.board([{ name, seed, params }], steps)
// Renders a 2×2 contact sheet over the page, labeled with a motion score (mean color change per 60 steps).
import type { FlockEngine, SeedSpec } from '../engine/FlockEngine';
import { DEFAULT_PARAMS, PALETTES, type FlockParams } from '../engine/params';

interface Variant {
  name: string;
  seed: SeedSpec;
  params: Partial<FlockParams>;
}

const engine = () => (window as unknown as { flock: FlockEngine }).flock;

async function capture(scale: number) {
  const bmp = await createImageBitmap(await engine().exportPNG(scale));
  const cv = new OffscreenCanvas(bmp.width, bmp.height);
  const ctx = cv.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0);
  return { bmp, data: ctx.getImageData(0, 0, bmp.width, bmp.height).data };
}

async function board(variants: Variant[], steps = 1500) {
  const f = engine();
  f.pause();
  const shots: { bmp: ImageBitmap; label: string }[] = [];
  for (const v of variants) {
    f.setParams({ ...DEFAULT_PARAMS, ...v.params });
    f.setSeed(v.seed);
    f.step(steps);
    const a = await capture(0.25);
    f.step(60);
    const b = await capture(0.25);
    let diff = 0;
    for (let i = 0; i < a.data.length; i += 4) {
      for (let k = 0; k < 3; k++) diff += Math.abs(a.data[i + k] - b.data[i + k]);
    }
    shots.push({ bmp: b.bmp, label: `${v.name} · ${(diff / ((a.data.length / 4) * 3)).toFixed(1)}` });
  }

  const w = shots[0].bmp.width;
  const h = shots[0].bmp.height;
  const cv = document.createElement('canvas');
  cv.width = w * 2;
  cv.height = h * Math.ceil(shots.length / 2);
  const ctx = cv.getContext('2d')!;
  shots.forEach((s, i) => {
    const x = (i % 2) * w;
    const y = Math.floor(i / 2) * h;
    ctx.drawImage(s.bmp, x, y);
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = '#000b';
    ctx.fillRect(x, y, ctx.measureText(s.label).width + 12, 22);
    ctx.fillStyle = '#fff';
    ctx.fillText(s.label, x + 6, y + 16);
  });

  let img = document.getElementById('tuning-board') as HTMLImageElement | null;
  if (!img) {
    img = document.createElement('img');
    img.id = 'tuning-board';
    img.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;z-index:9999;pointer-events:none;object-fit:contain;background:#000';
    document.body.appendChild(img);
  }
  img.src = cv.toDataURL();
  await img.decode();
  return shots.map((s) => s.label);
}

function clear() {
  document.getElementById('tuning-board')?.remove();
  engine().play();
}

const palette = (id: string) => PALETTES.find((p) => p.id === id)!.colors;

(window as unknown as { tuning: unknown }).tuning = { board, clear, palette };
