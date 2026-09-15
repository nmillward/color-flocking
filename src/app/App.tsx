import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlockEngine, type EngineStats, type SeedSpec } from '../engine/FlockEngine';
import { DEFAULT_PARAMS, PALETTES, type FlockParams } from '../engine/params';
import { ControlPanel, PhotoCredit } from './ControlPanel';
import { FlockCanvas } from './FlockCanvas';
import { downloadBlob, loadImage, useIdle } from './hooks';
import { DownloadIcon, ExpandIcon, PauseIcon, PlayIcon, RestartIcon, ShuffleIcon, SlidersIcon, StepIcon } from './icons';
import { IMAGES } from './images';
import { extractPalette } from './palette';
import { IMAGE_PRESETS, PRESETS, type Preset, type SeedSelection } from './presets';
import { surprise } from './surprise';

const HERO = PRESETS[0];

function syncSeedSpec(sel: SeedSelection): SeedSpec {
  const kind = sel.kind === 'image' ? 'gradient' : sel.kind;
  const usesPalette = kind === 'palette' || kind === 'gradient';
  const palette = (PALETTES.find((p) => p.id === sel.paletteId) ?? PALETTES[0]).colors;
  return { kind, palette: usesPalette ? palette : undefined };
}

// A photo's own colors, so palette lock can hold a dissolving image inside its color world.
const photoPalettes = new Map<string, string[]>();

export function App() {
  const engineRef = useRef<FlockEngine | null>(null);
  const seedToken = useRef(0);
  const [params, setParams] = useState<FlockParams>(() => ({ ...DEFAULT_PARAMS, ...HERO.params }));
  const [seed, setSeed] = useState<SeedSelection>(HERO.seed);
  const [presetId, setPresetId] = useState<string | null>(HERO.id);
  const [playing, setPlaying] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [stats, setStats] = useState<EngineStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const idle = useIdle(2800);
  const uiVisible = !idle || hovering || panelOpen;

  const presets = useMemo(
    () =>
      IMAGES.length
        ? [...PRESETS, ...IMAGE_PRESETS.map((p) => ({ ...p, seed: { ...p.seed, imageId: p.seed.imageId ?? IMAGES[0].id } }))]
        : PRESETS,
    [],
  );

  useEffect(() => {
    engineRef.current?.setParams(params);
  }, [params]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const applySeed = useCallback(async (sel: SeedSelection, transition: boolean) => {
    setSeed(sel);
    const engine = engineRef.current;
    if (!engine) return;
    const token = ++seedToken.current;
    const spec = syncSeedSpec(sel);
    if (sel.kind === 'image') {
      const image = IMAGES.find((i) => i.id === sel.imageId);
      if (!image) return;
      try {
        const img = await loadImage(image.src);
        if (token !== seedToken.current) return; // a newer choice won
        let palette = photoPalettes.get(image.id);
        if (!palette) {
          palette = extractPalette(img);
          photoPalettes.set(image.id, palette);
        }
        engine.setSeed({ kind: 'image', image: img, palette }, { transition });
      } catch {
        setToast('Could not load that photo');
      }
      return;
    }
    engine.setSeed(spec, { transition });
  }, []);

  const updateParams = useCallback((patch: Partial<FlockParams>) => {
    setParams((p) => ({ ...p, ...patch }));
    setPresetId(null);
  }, []);

  const applyPreset = useCallback(
    (preset: Preset) => {
      const next = { ...DEFAULT_PARAMS, ...preset.params };
      engineRef.current?.setParams(next);
      setParams(next);
      setPresetId(preset.id);
      void applySeed(preset.seed, false);
    },
    [applySeed],
  );

  const shuffle = useCallback(() => {
    const { params: next, seed: nextSeed } = surprise();
    engineRef.current?.setParams(next);
    setParams(next);
    setPresetId(null);
    void applySeed(nextSeed, false);
  }, [applySeed]);

  const togglePlay = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.isPlaying) engine.pause();
    else engine.play();
    setPlaying(engine.isPlaying);
  }, []);

  const save = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    try {
      const blob = await engine.exportPNG(2);
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      downloadBlob(blob, `color-flocking-${stamp}.png`);
      setToast('Saved PNG');
    } catch {
      setToast('Export failed');
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'TEXTAREA' || (tag === 'INPUT' && (e.target as HTMLInputElement).type !== 'range')) return;
      switch (e.key) {
        case ' ':
          if (tag === 'BUTTON') return;
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          if (tag === 'INPUT') return;
          engineRef.current?.step();
          break;
        case 'r':
          engineRef.current?.reseed();
          break;
        case 's':
          void save();
          break;
        case 'c':
          setPanelOpen((o) => !o);
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'x':
          shuffle();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, save, shuffle, toggleFullscreen]);

  const onReady = useCallback((engine: FlockEngine) => {
    engineRef.current = engine;
    setPlaying(engine.isPlaying);
    if (import.meta.env.DEV) (window as unknown as { flock: FlockEngine }).flock = engine;
  }, []);

  const initialSeed = useMemo(() => syncSeedSpec(HERO.seed), []);
  const initialParams = useMemo(() => params, []); // eslint-disable-line react-hooks/exhaustive-deps
  const activePreset = presets.find((p) => p.id === presetId);

  return (
    <div className={`app${uiVisible ? '' : ' is-idle'}`}>
      <FlockCanvas
        initialParams={initialParams}
        initialSeed={initialSeed}
        onReady={onReady}
        onError={setError}
        onStats={setStats}
      />

      {error ? (
        <div className="fallback">
          <h1>Color Flocking</h1>
          <p>This piece needs WebGL2, which isn't available in this browser.</p>
          <p className="fallback-detail">{error}</p>
        </div>
      ) : (
        <>
          <div className="wordmark ui-fade">
            <h1>Color Flocking</h1>
            <p>{activePreset ? activePreset.name : 'Custom'}</p>
            {seed.kind === 'image' && <PhotoCredit imageId={seed.imageId} />}
          </div>

          <nav
            className="toolbar ui-fade"
            aria-label="Playback"
            onPointerEnter={() => setHovering(true)}
            onPointerLeave={() => setHovering(false)}
          >
            <button type="button" className="icon-btn" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'} title={playing ? 'Pause (space)' : 'Play (space)'}>
              {playing ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button type="button" className="icon-btn" onClick={() => engineRef.current?.step()} disabled={playing} aria-label="Step one frame" title="Step (→)">
              <StepIcon />
            </button>
            <button type="button" className="icon-btn" onClick={() => engineRef.current?.reseed()} aria-label="New start" title="New start (R)">
              <RestartIcon />
            </button>
            <button type="button" className="icon-btn" onClick={shuffle} aria-label="Surprise me" title="Surprise me (X)">
              <ShuffleIcon />
            </button>
            <span className="toolbar-divider" />
            <button type="button" className="icon-btn" onClick={save} aria-label="Save PNG" title="Save PNG (S)">
              <DownloadIcon />
            </button>
            <button type="button" className="icon-btn" onClick={toggleFullscreen} aria-label="Fullscreen" title="Fullscreen (F)">
              <ExpandIcon />
            </button>
            <button
              type="button"
              className={`icon-btn${panelOpen ? ' is-active' : ''}`}
              onClick={() => setPanelOpen((o) => !o)}
              aria-label="Controls"
              aria-expanded={panelOpen}
              title="Controls (C)"
            >
              <SlidersIcon />
            </button>
          </nav>

          {panelOpen && (
            <div onPointerEnter={() => setHovering(true)} onPointerLeave={() => setHovering(false)}>
              <ControlPanel
                params={params}
                onParams={updateParams}
                seed={seed}
                onSeed={(s, transition) => {
                  setPresetId(null);
                  void applySeed(s, transition);
                }}
                onReseed={() => engineRef.current?.reseed()}
                presets={presets}
                activePresetId={presetId}
                onPreset={applyPreset}
                onSurprise={shuffle}
                stats={stats}
                onClose={() => {
                  setPanelOpen(false);
                  setHovering(false);
                }}
              />
            </div>
          )}

          {toast && (
            <div className="toast" role="status">
              {toast}
            </div>
          )}
        </>
      )}
    </div>
  );
}
