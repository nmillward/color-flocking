import { useState } from 'react';
import type { EngineStats, SeedKind } from '../engine/FlockEngine';
import { PALETTES, type FlockParams } from '../engine/params';
import { Section, Segmented, Slider, Toggle, trimNumber } from './controls';
import { CloseIcon, ShuffleIcon } from './icons';
import { IMAGES, findImage } from './images';
import type { Preset, SeedSelection } from './presets';

type Tab = 'presets' | 'flock' | 'color' | 'grid';

interface Props {
  params: FlockParams;
  onParams: (patch: Partial<FlockParams>) => void;
  seed: SeedSelection;
  onSeed: (seed: SeedSelection, transition: boolean) => void;
  onReseed: () => void;
  presets: Preset[];
  activePresetId: string | null;
  onPreset: (preset: Preset) => void;
  onSurprise: () => void;
  stats: EngineStats | null;
  onClose: () => void;
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'presets', label: 'Presets' },
  { id: 'flock', label: 'Flock' },
  { id: 'color', label: 'Color' },
  { id: 'grid', label: 'Grid' },
];

export function ControlPanel(props: Props) {
  const [tab, setTab] = useState<Tab>('presets');

  return (
    <aside className="panel" aria-label="Controls">
      <header className="panel-header">
        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? 'is-active' : ''}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" className="icon-btn" aria-label="Close controls" onClick={props.onClose}>
          <CloseIcon />
        </button>
      </header>

      <div className="panel-body">
        {tab === 'presets' && <PresetsTab {...props} />}
        {tab === 'flock' && <FlockTab {...props} />}
        {tab === 'color' && <ColorTab {...props} />}
        {tab === 'grid' && <GridTab {...props} />}
      </div>

      {props.stats && (
        <footer className="panel-footer">
          {props.stats.cols}×{props.stats.rows} · {props.stats.cells.toLocaleString()} cells ·{' '}
          {props.stats.fps ? `${props.stats.fps} fps` : 'paused'}
        </footer>
      )}
    </aside>
  );
}

function PresetsTab({ presets, activePresetId, onPreset, onSurprise }: Props) {
  return (
    <>
      <div className="preset-list">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`preset${p.id === activePresetId ? ' is-active' : ''}`}
            onClick={() => onPreset(p)}
          >
            <span className="preset-name">{p.name}</span>
            <span className="preset-desc">{p.description}</span>
          </button>
        ))}
      </div>
      <button type="button" className="wide-btn" onClick={onSurprise}>
        <ShuffleIcon /> Surprise me
      </button>
    </>
  );
}

function FlockTab({ params, onParams, seed }: Props) {
  const hasPalette = seed.kind !== 'random' && seed.kind !== 'grayscale';
  return (
    <>
      <Section title="Forces">
        <Slider label="Separation" hint="Push away from neighbors' colors — keeps variety alive" value={params.separation} min={0} max={4} step={0.05} onChange={(v) => onParams({ separation: v })} />
        <Slider label="Alignment" hint="Match neighbors' direction of color change — creates waves" value={params.alignment} min={0} max={4} step={0.05} onChange={(v) => onParams({ alignment: v })} />
        <Slider label="Cohesion" hint="Move toward neighbors' average color — blends and blurs" value={params.cohesion} min={0} max={4} step={0.05} onChange={(v) => onParams({ cohesion: v })} />
        <Slider label="Anchor" hint="Pull back toward each cell's starting color" value={params.anchor} min={0} max={5} step={0.05} onChange={(v) => onParams({ anchor: v })} />
        <Slider label="Palette lock" hint={hasPalette ? 'Keep colors within the palette (a photo uses its own colors) while patterns keep flowing' : 'Start from a Palette, Flow or Photo to use this'} value={params.paletteLock} min={0} max={4} step={0.05} disabled={!hasPalette} onChange={(v) => onParams({ paletteLock: v })} />
        <Slider label="Noise" hint="Random nudges that keep things from settling" value={params.noise} min={0} max={4} step={0.05} onChange={(v) => onParams({ noise: v })} />
      </Section>
      <Section title="Motion">
        <Slider label="Speed" hint="Simulation steps per frame" value={params.speed} min={0.1} max={6} step={0.05} format={(v) => `${trimNumber(v)}×`} onChange={(v) => onParams({ speed: v })} />
        <Slider label="Max speed" hint="How fast a color can drift" value={params.maxSpeed} min={0.25} max={12} step={0.05} onChange={(v) => onParams({ maxSpeed: v })} />
        <Slider label="Steering" hint="How sharply a color can change direction (max force)" value={params.maxForce} min={0.005} max={0.3} step={0.005} scale="log" onChange={(v) => onParams({ maxForce: v })} />
      </Section>
      <Section title="Neighbors">
        <Segmented
          label="Shape"
          hint={params.grid === 'hex' ? 'Hex grids always use hexagonal neighborhoods' : undefined}
          value={params.neighborhood}
          options={[
            { value: 'cross', label: 'Cross', disabled: params.grid === 'hex' },
            { value: 'square', label: 'Square', disabled: params.grid === 'hex' },
            { value: 'circle', label: 'Circle', disabled: params.grid === 'hex' },
          ]}
          onChange={(v) => onParams({ neighborhood: v })}
        />
        <Segmented
          label="Reach"
          value={params.radius}
          options={[
            { value: 1, label: '1' },
            { value: 2, label: '2' },
            { value: 3, label: '3' },
          ]}
          onChange={(v) => onParams({ radius: v })}
        />
        <Slider
          label="Tolerance"
          hint="Only follow neighbors with similar colors. Lower = rival color tribes."
          value={params.tolerance}
          min={0.02}
          max={1}
          step={0.01}
          format={(v) => (v >= 0.999 ? 'Off' : trimNumber(v))}
          onChange={(v) => onParams({ tolerance: v })}
        />
        <Toggle label="Wrap grid edges" hint="Cells on one edge flock with the opposite edge" value={params.edgeWrap} onChange={(v) => onParams({ edgeWrap: v })} />
      </Section>
    </>
  );
}

function ColorTab({ params, onParams, seed, onSeed, onReseed }: Props) {
  const setKind = (kind: SeedKind) => {
    const imageId = kind === 'image' ? (seed.imageId ?? IMAGES[0]?.id ?? null) : seed.imageId;
    onSeed({ ...seed, kind, imageId }, kind === 'image');
  };

  return (
    <>
      <Section title="Start from">
        <Segmented
          value={seed.kind}
          options={[
            { value: 'random', label: 'Random' },
            { value: 'grayscale', label: 'Mono' },
            { value: 'palette', label: 'Palette' },
            { value: 'gradient', label: 'Flow' },
            { value: 'image', label: 'Photo', disabled: IMAGES.length === 0 },
          ]}
          onChange={setKind}
        />

        {(seed.kind === 'palette' || seed.kind === 'gradient') && (
          <div className="palette-list">
            {PALETTES.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`palette${p.id === seed.paletteId ? ' is-active' : ''}`}
                onClick={() => onSeed({ ...seed, paletteId: p.id }, false)}
                aria-label={p.name}
                title={p.name}
              >
                {p.colors.map((c) => (
                  <span key={c} style={{ background: c }} />
                ))}
              </button>
            ))}
          </div>
        )}

        {seed.kind === 'image' && (
          <div className="image-grid">
            {IMAGES.map((img) => (
              <button
                key={img.id}
                type="button"
                className={`image-thumb${img.id === seed.imageId ? ' is-active' : ''}`}
                onClick={() => onSeed({ ...seed, imageId: img.id }, true)}
                title={`${img.title} — ${img.photographer}`}
              >
                <img src={img.thumb} alt={img.title} loading="lazy" />
              </button>
            ))}
          </div>
        )}
        {seed.kind === 'image' && <PhotoCredit imageId={seed.imageId} />}

        <button type="button" className="wide-btn subtle" onClick={onReseed}>
          New start
        </button>
      </Section>

      <Section title="Color space" note={SPACE_NOTES[params.colorSpace]}>
        <Segmented
          value={params.colorSpace}
          options={[
            { value: 'rgb', label: 'RGB' },
            { value: 'oklab', label: 'OKLab' },
            { value: 'hsv', label: 'HSV' },
          ]}
          onChange={(v) => onParams({ colorSpace: v })}
        />
      </Section>

      <Section title="Color walls" note={WALL_NOTES[params.walls]}>
        <Segmented
          value={params.walls}
          options={[
            { value: 'bounce', label: 'Bounce' },
            { value: 'wrap', label: 'Wrap' },
            { value: 'clamp', label: 'Stick' },
          ]}
          onChange={(v) => onParams({ walls: v })}
        />
      </Section>
    </>
  );
}

function GridTab({ params, onParams, stats }: Props) {
  const smooth = params.renderStyle === 'smooth';
  return (
    <>
      <Section title="Cells">
        <Slider label="Cell size" value={params.cellSize} min={1} max={64} step={1} scale="log" format={(v) => `${v}px`} onChange={(v) => onParams({ cellSize: v })} />
        <Segmented
          label="Grid"
          hint="Hex grids flock with 6 neighbors instead of 8"
          value={params.grid}
          options={[
            { value: 'square', label: 'Square' },
            { value: 'hex', label: 'Hex' },
          ]}
          onChange={(grid) => {
            let cellShape = params.cellShape;
            if (grid === 'hex' && cellShape === 'square') cellShape = 'hexagon';
            if (grid === 'square' && cellShape === 'hexagon') cellShape = 'square';
            onParams({ grid, cellShape });
          }}
        />
        <Segmented
          label="Shape"
          value={params.cellShape}
          options={[
            { value: 'square', label: 'Square', disabled: smooth },
            { value: 'circle', label: 'Circle', disabled: smooth },
            { value: 'diamond', label: 'Diamond', disabled: smooth },
            { value: 'hexagon', label: 'Hexagon', disabled: smooth },
          ]}
          onChange={(v) => onParams({ cellShape: v })}
        />
        <Slider
          label="Stretch"
          hint="Make cells wide or tall"
          value={params.aspect}
          min={0.2}
          max={5}
          step={0.01}
          scale="log"
          format={formatAspect}
          onChange={(v) => onParams({ aspect: Math.abs(v - 1) < 0.04 ? 1 : v })}
        />
        <Segmented
          label="Style"
          value={params.renderStyle}
          options={[
            { value: 'crisp', label: 'Pixels' },
            { value: 'smooth', label: 'Smooth' },
          ]}
          onChange={(v) => onParams({ renderStyle: v })}
        />
        <Slider label="Gap" value={params.gap} min={0} max={0.5} step={0.01} disabled={smooth} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => onParams({ gap: v })} />
        <Slider label="Roundness" value={params.roundness} min={0} max={1} step={0.01} disabled={smooth} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => onParams({ roundness: v })} />
      </Section>
      {stats && (
        <Section title="Performance">
          <dl className="stats">
            <dt>Grid</dt>
            <dd>
              {stats.cols} × {stats.rows}
            </dd>
            <dt>Cells</dt>
            <dd>{stats.cells.toLocaleString()}</dd>
            <dt>Frame rate</dt>
            <dd>{stats.fps ? `${stats.fps} fps` : 'paused'}</dd>
            <dt>Precision</dt>
            <dd>{stats.precision}</dd>
          </dl>
        </Section>
      )}
    </>
  );
}

export function PhotoCredit({ imageId }: { imageId: string | null }) {
  const img = findImage(imageId);
  if (!img) return null;
  return (
    <p className="photo-credit">
      {img.title} — photo by{' '}
      <a href={img.profile} target="_blank" rel="noreferrer">
        {img.photographer}
      </a>{' '}
      on{' '}
      <a href={img.url} target="_blank" rel="noreferrer">
        Unsplash
      </a>
    </p>
  );
}

function formatAspect(v: number) {
  if (v === 1) return '1:1';
  return v > 1 ? `${v.toFixed(1)}:1` : `1:${(1 / v).toFixed(1)}`;
}

const SPACE_NOTES = {
  rgb: 'The original. Blends can turn muddy, which has its own charm.',
  oklab: 'Perceptual color — clean, luminous blends.',
  hsv: 'Hue wraps around the wheel, so rainbows cycle endlessly.',
};

const WALL_NOTES = {
  bounce: 'Colors ricochet off the edges of color space.',
  wrap: 'Colors pass through one edge and reappear at the other — glitchy.',
  clamp: 'Colors stick to the edges — punchy, saturated.',
};
