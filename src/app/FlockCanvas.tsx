import { useEffect, useRef } from 'react';
import { FlockEngine, type EngineStats, type SeedSpec } from '../engine/FlockEngine';
import type { FlockParams } from '../engine/params';

interface Props {
  initialParams: FlockParams;
  initialSeed: SeedSpec;
  onReady: (engine: FlockEngine) => void;
  onError: (message: string) => void;
  onStats: (stats: EngineStats) => void;
}

/** Owns the <canvas> and the engine's lifetime. Settings flow in through the engine instance. */
export function FlockCanvas({ initialParams, initialSeed, onReady, onError, onStats }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    let engine: FlockEngine;
    try {
      engine = new FlockEngine(canvas, initialParams, initialSeed);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
      return;
    }
    engine.onStats = onStats;
    const observer = new IntersectionObserver(([entry]) => engine.setInView(entry.isIntersecting));
    observer.observe(canvas);
    onReady(engine);
    return () => {
      observer.disconnect();
      engine.destroy();
    };
    // The engine is created once; later changes are pushed via the instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} className="flock-canvas" aria-label="Color flocking animation" />;
}
