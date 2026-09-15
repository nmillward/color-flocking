import { Program, createTarget, deleteTarget, detectFloatFormat, type FloatFormat, type Target } from './gl';
import { CONVERT_FRAG, INIT_FRAG, RENDER_FRAG, RESAMPLE_FRAG, SEED_FRAG, SIM_FRAG, VERT } from './shaders';
import { DEFAULT_PARAMS, PALETTES, hexToRgb, srgbToSpace, type ColorSpace, type FlockParams } from './params';

export type SeedKind = 'random' | 'grayscale' | 'palette' | 'gradient' | 'image';
export type SeedImage = HTMLImageElement | HTMLCanvasElement;

export interface SeedSpec {
  kind: SeedKind;
  palette?: string[];
  image?: SeedImage;
}

export interface EngineStats {
  fps: number;
  cols: number;
  rows: number;
  cells: number;
  precision: string;
}

interface StatePair {
  color: Target;
  vel: Target;
  mrt: WebGLFramebuffer;
}

type ProgramName = 'sim' | 'seed' | 'init' | 'render' | 'resample' | 'convert';

const SPACE: Record<ColorSpace, number> = { rgb: 0, oklab: 1, hsv: 2 };
const WALL = { bounce: 0, wrap: 1, clamp: 2 } as const;
const SHAPE = { cross: 0, square: 1, circle: 2 } as const;
const SEED_MODE: Record<SeedKind, number> = { random: 0, grayscale: 1, palette: 2, gradient: 3, image: 4 };
const MIN_GRID = 4;
const BG: [number, number, number] = [0.043, 0.043, 0.047];

const randomSeed = () => (Math.random() * 0xffffffff) >>> 0;

/**
 * GPU color-flocking simulation. Framework-agnostic: give it a canvas and it runs.
 * Each grid cell's color is a "boid" moving through color space, steered by its grid neighbors.
 */
export class FlockEngine {
  readonly canvas: HTMLCanvasElement;
  onStats?: (stats: EngineStats) => void;

  private gl: WebGL2RenderingContext;
  private fmt!: FloatFormat;
  private programs!: Record<ProgramName, Program>;
  private vao!: WebGLVertexArrayObject;
  private dummyTex!: WebGLTexture;
  private imageTex: WebGLTexture | null = null;
  private imageSize: [number, number] = [1, 1];

  private pairs: StatePair[] = [];
  private readIdx = 0;
  private anchor: Target | null = null;

  private params: FlockParams;
  private seedSpec: SeedSpec = { kind: 'random' };
  private seedValue = randomSeed();
  private paletteEnc = new Float32Array(24);
  private paletteCount = 0;

  private cols = 0;
  private rows = 0;
  private width = 0;
  private height = 0;
  private cellPx = 1;
  private offX = 0;
  private offY = 0;

  private playing = true;
  private inView = true;
  private destroyed = false;
  private lost = false;
  private dirty = true;
  private raf = 0;
  private lastT = 0;
  private accum = 0;
  private frame = 0;
  private fps = 60;
  private lastStats = 0;
  private boost = { start: 0, duration: 0, peak: 0 };
  private resizeObserver: ResizeObserver;

  static isSupported(): boolean {
    try {
      return !!document.createElement('canvas').getContext('webgl2');
    } catch {
      return false;
    }
  }

  constructor(canvas: HTMLCanvasElement, params: Partial<FlockParams> = {}, seed?: SeedSpec) {
    this.canvas = canvas;
    this.params = { ...DEFAULT_PARAMS, ...params };
    if (seed) this.seedSpec = seed;
    this.updatePalette();

    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 is not available on this device.');
    this.gl = gl;
    this.initGL();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored);
    document.addEventListener('visibilitychange', this.handleVisibility);

    this.resize();
    this.schedule();
  }

  // ---------------------------------------------------------------- public API

  getParams(): FlockParams {
    return { ...this.params };
  }

  setParams(next: Partial<FlockParams>) {
    const prev = this.params;
    this.params = { ...prev, ...next };
    if (next.colorSpace && next.colorSpace !== prev.colorSpace) {
      this.updatePalette();
      if (this.pairs.length) this.convertSpace(prev.colorSpace, next.colorSpace);
    }
    if (next.cellSize !== undefined && next.cellSize !== prev.cellSize) this.resize();
    this.requestDraw();
  }

  /** Change what the grid starts from. With `transition`, the flock flows toward the new source. */
  setSeed(spec: SeedSpec, opts: { transition?: boolean } = {}) {
    this.seedSpec = spec;
    this.updatePalette();
    if (spec.kind === 'image' && spec.image) this.uploadImage(spec.image);
    this.seedValue = randomSeed();
    if (!this.pairs.length) return;
    this.renderAnchor();
    if (opts.transition) {
      this.boost = { start: performance.now(), duration: 6000, peak: 3 };
    } else {
      this.initState();
    }
    this.requestDraw();
  }

  /** Restart from a fresh variation of the current source. */
  reseed() {
    this.seedValue = randomSeed();
    if (!this.pairs.length) return;
    this.renderAnchor();
    this.initState();
    this.requestDraw();
  }

  play() {
    if (this.playing) return;
    this.playing = true;
    this.lastT = 0;
    this.schedule();
  }

  pause() {
    this.playing = false;
  }

  get isPlaying() {
    return this.playing;
  }

  step(count = 1) {
    for (let i = 0; i < count; i++) this.simStep();
    this.requestDraw();
  }

  /** Pause rendering while the canvas is scrolled out of view. */
  setInView(inView: boolean) {
    this.inView = inView;
    if (inView) {
      this.lastT = 0;
      this.schedule();
    }
  }

  /** Render the current frame at `scale`× the canvas resolution and return a PNG. */
  async exportPNG(scale = 2): Promise<Blob> {
    const gl = this.gl;
    const maxSize = Math.min(
      gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
      gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number,
      8192,
    );
    const s = Math.max(
      0.1,
      Math.min(scale, maxSize / this.width, maxSize / this.height, Math.sqrt(40e6 / (this.width * this.height))),
    );
    const w = Math.round(this.width * s);
    const h = Math.round(this.height * s);

    const target = createTarget(gl, w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST);
    this.renderTo(target.fbo, w, h, s);
    const pixels = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    deleteTarget(gl, target);
    this.requestDraw();

    // WebGL rows are bottom-up; flip for the image.
    const flipped = new Uint8ClampedArray(w * h * 4);
    const row = w * 4;
    for (let y = 0; y < h; y++) {
      flipped.set(pixels.subarray((h - 1 - y) * row, (h - y) * row), y * row);
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.putImageData(new ImageData(flipped, w, h), 0, 0);
    return new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png'),
    );
  }

  destroy() {
    this.destroyed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    if (!this.lost) this.releaseGL();
  }

  // ---------------------------------------------------------------- setup

  private initGL() {
    const gl = this.gl;
    const fmt = detectFloatFormat(gl);
    if (!fmt) throw new Error('This device cannot render floating-point textures.');
    this.fmt = fmt;

    this.programs = {
      sim: new Program(gl, VERT, SIM_FRAG, 'sim'),
      seed: new Program(gl, VERT, SEED_FRAG, 'seed'),
      init: new Program(gl, VERT, INIT_FRAG, 'init'),
      render: new Program(gl, VERT, RENDER_FRAG, 'render'),
      resample: new Program(gl, VERT, RESAMPLE_FRAG, 'resample'),
      convert: new Program(gl, VERT, CONVERT_FRAG, 'convert'),
    };

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    this.dummyTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.dummyTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));

    this.imageTex = null;
    this.pairs = [];
    this.anchor = null;
    this.cols = 0;
    this.rows = 0;
    if (this.seedSpec.kind === 'image' && this.seedSpec.image) this.uploadImage(this.seedSpec.image);
  }

  private releaseGL() {
    const gl = this.gl;
    this.pairs.forEach((p) => this.deletePair(p));
    this.pairs = [];
    if (this.anchor) deleteTarget(gl, this.anchor);
    this.anchor = null;
    Object.values(this.programs).forEach((p) => p.destroy());
    gl.deleteTexture(this.dummyTex);
    if (this.imageTex) gl.deleteTexture(this.imageTex);
    this.imageTex = null;
    gl.deleteVertexArray(this.vao);
  }

  private uploadImage(img: SeedImage) {
    const gl = this.gl;
    if (!this.imageTex) this.imageTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.imageTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const w = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
    const h = img instanceof HTMLImageElement ? img.naturalHeight : img.height;
    this.imageSize = [Math.max(1, w), Math.max(1, h)];
  }

  // ---------------------------------------------------------------- sizing

  private resize() {
    if (this.destroyed || this.lost) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    this.width = w;
    this.height = h;

    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    const maxCells = coarse ? 600_000 : 2_400_000;
    const maxTex = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) as number;
    const gridFor = (px: number) => [Math.max(MIN_GRID, Math.ceil(w / px)), Math.max(MIN_GRID, Math.ceil(h / px))];

    let cellPx = Math.max(1, this.params.cellSize * dpr);
    let [cols, rows] = gridFor(cellPx);
    while (cols * rows > maxCells || cols > maxTex || rows > maxTex) {
      cellPx *= 1.05;
      [cols, rows] = gridFor(cellPx);
    }

    this.cellPx = cellPx;
    this.offX = (w - cols * cellPx) / 2;
    this.offY = (h - rows * cellPx) / 2;
    if (cols !== this.cols || rows !== this.rows) this.reallocate(cols, rows);
    this.requestDraw();
  }

  private reallocate(cols: number, rows: number) {
    const gl = this.gl;
    const oldPairs = this.pairs;
    const oldAnchor = this.anchor;
    const oldRead = this.readIdx;

    this.pairs = [this.createPair(cols, rows), this.createPair(cols, rows)];
    this.anchor = this.createFloatTarget(cols, rows);
    this.readIdx = 0;
    this.cols = cols;
    this.rows = rows;

    if (oldPairs.length && oldAnchor) {
      // Keep the current picture: resample it into the new grid.
      const src = oldPairs[oldRead];
      const dst = this.pairs[0];
      this.resample(src.color, dst.color);
      this.resample(src.vel, dst.vel);
      const kind = this.seedSpec.kind;
      if ((kind === 'image' && this.imageTex) || kind === 'gradient') this.renderAnchor();
      else this.resample(oldAnchor, this.anchor);
      oldPairs.forEach((p) => this.deletePair(p));
      deleteTarget(gl, oldAnchor);
    } else {
      this.renderAnchor();
      this.initState();
    }
  }

  private createFloatTarget(w: number, h: number) {
    const gl = this.gl;
    return createTarget(gl, w, h, this.fmt.internalFormat, gl.RGBA, this.fmt.type, gl.NEAREST);
  }

  private createPair(w: number, h: number): StatePair {
    const gl = this.gl;
    const color = this.createFloatTarget(w, h);
    const vel = this.createFloatTarget(w, h);
    const mrt = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, mrt);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color.tex, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, vel.tex, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { color, vel, mrt };
  }

  private deletePair(p: StatePair) {
    deleteTarget(this.gl, p.color);
    deleteTarget(this.gl, p.vel);
    this.gl.deleteFramebuffer(p.mrt);
  }

  // ---------------------------------------------------------------- GPU passes

  private pass(fbo: WebGLFramebuffer | null, w: number, h: number, program: Program, setup: (p: Program) => void) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, w, h);
    program.use();
    setup(program);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private renderAnchor() {
    const spec = this.seedSpec;
    const anchor = this.anchor!;
    const colors = (spec.palette?.length ? spec.palette : PALETTES[0].colors).slice(0, 8);
    const palette = new Float32Array(24);
    colors.forEach((hex, i) => palette.set(hexToRgb(hex), i * 3));
    const useImage = spec.kind === 'image' && !!this.imageTex;
    const mode = spec.kind === 'image' && !useImage ? SEED_MODE.random : SEED_MODE[spec.kind];

    this.pass(anchor.fbo, anchor.w, anchor.h, this.programs.seed, (p) => {
      p.int('uMode', mode);
      p.uint('uSeed', this.seedValue);
      p.ivec2('uGrid', anchor.w, anchor.h);
      p.int('uSpace', SPACE[this.params.colorSpace]);
      p.vec3v('uPalette', palette);
      p.int('uPaletteSize', colors.length);
      p.texture('uImage', 0, useImage ? this.imageTex! : this.dummyTex);
      p.vec2('uImageSize', this.imageSize[0], this.imageSize[1]);
    });
  }

  private initState() {
    const target = this.pairs[1 - this.readIdx];
    this.pass(target.mrt, this.cols, this.rows, this.programs.init, (p) => {
      p.texture('uAnchor', 0, this.anchor!.tex);
      p.uint('uSeed', this.seedValue);
      p.float('uKick', (this.params.maxSpeed / 255) * 0.5);
    });
    this.readIdx = 1 - this.readIdx;
    this.accum = 0;
  }

  private resample(src: Target, dst: Target) {
    this.pass(dst.fbo, dst.w, dst.h, this.programs.resample, (p) => {
      p.texture('uSrc', 0, src.tex);
      p.ivec2('uSrcSize', src.w, src.h);
      p.ivec2('uDstSize', dst.w, dst.h);
    });
  }

  private convertSpace(from: ColorSpace, to: ColorSpace) {
    const gl = this.gl;
    const read = this.pairs[this.readIdx];
    const write = this.pairs[1 - this.readIdx];
    const convertInto = (src: Target, dst: Target) =>
      this.pass(dst.fbo, dst.w, dst.h, this.programs.convert, (p) => {
        p.texture('uSrc', 0, src.tex);
        p.int('uFrom', SPACE[from]);
        p.int('uTo', SPACE[to]);
      });

    convertInto(read.color, write.color);
    gl.bindFramebuffer(gl.FRAMEBUFFER, write.vel.fbo);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.readIdx = 1 - this.readIdx;

    const anchor = this.createFloatTarget(this.cols, this.rows);
    convertInto(this.anchor!, anchor);
    deleteTarget(gl, this.anchor!);
    this.anchor = anchor;
  }

  /** Encode the palette into the active color space for the palette-lock force. */
  private updatePalette() {
    const { kind, palette } = this.seedSpec;
    const colors =
      kind === 'palette' || kind === 'gradient' ? (palette?.length ? palette : PALETTES[0].colors).slice(0, 8) : [];
    this.paletteEnc.fill(0);
    colors.forEach((hex, i) => this.paletteEnc.set(srgbToSpace(hexToRgb(hex), this.params.colorSpace), i * 3));
    this.paletteCount = colors.length;
  }

  private anchorWeight(now: number) {
    const b = this.boost;
    let w = this.params.anchor;
    if (b.duration > 0) {
      const k = (now - b.start) / b.duration;
      if (k >= 1) {
        b.duration = 0;
      } else {
        // Rise quickly, hold, then ease back to the user's anchor value.
        const env = k < 0.12 ? k / 0.12 : k < 0.45 ? 1 : 1 - (k - 0.45) / 0.55;
        const eased = env * env * (3 - 2 * env);
        w = Math.max(w, b.peak * eased);
      }
    }
    return w;
  }

  private simStep() {
    const read = this.pairs[this.readIdx];
    const write = this.pairs[1 - this.readIdx];
    const p = this.params;
    const anchorW = this.anchorWeight(performance.now());

    this.pass(write.mrt, this.cols, this.rows, this.programs.sim, (s) => {
      s.texture('uColor', 0, read.color.tex);
      s.texture('uVel', 1, read.vel.tex);
      s.texture('uAnchor', 2, this.anchor!.tex);
      s.ivec2('uGrid', this.cols, this.rows);
      s.int('uRadius', Math.round(Math.min(3, Math.max(1, p.radius))));
      s.int('uShape', SHAPE[p.neighborhood]);
      s.int('uEdgeWrap', p.edgeWrap ? 1 : 0);
      s.float('uSep', p.separation);
      s.float('uAlign', p.alignment);
      s.float('uCoh', p.cohesion);
      s.float('uAnchorW', anchorW);
      s.float('uNoise', p.noise);
      s.float('uMaxSpeed', p.maxSpeed / 255);
      s.float('uMaxForce', p.maxForce / 255);
      s.float('uTol', p.tolerance);
      s.int('uSpace', SPACE[p.colorSpace]);
      s.int('uWall', WALL[p.walls]);
      s.uint('uFrame', this.frame);
      s.vec3v('uPal', this.paletteEnc);
      s.int('uPalCount', this.paletteCount);
      s.float('uPalLock', p.paletteLock);
    });

    this.readIdx = 1 - this.readIdx;
    this.frame = (this.frame + 1) >>> 0;
  }

  private renderTo(fbo: WebGLFramebuffer | null, w: number, h: number, scale: number) {
    const p = this.params;
    this.pass(fbo, w, h, this.programs.render, (r) => {
      r.texture('uColor', 0, this.pairs[this.readIdx].color.tex);
      r.ivec2('uGrid', this.cols, this.rows);
      r.float('uCellPx', this.cellPx * scale);
      r.vec2('uOffset', this.offX * scale, this.offY * scale);
      r.float('uGap', p.gap);
      r.float('uRound', p.roundness);
      r.int('uSmooth', p.renderStyle === 'smooth' ? 1 : 0);
      r.int('uSpace', SPACE[p.colorSpace]);
      r.vec3('uBg', BG[0], BG[1], BG[2]);
    });
  }

  // ---------------------------------------------------------------- loop

  private requestDraw() {
    this.dirty = true;
    this.schedule();
  }

  private schedule() {
    if (this.raf || this.destroyed || this.lost || !this.inView || document.hidden) return;
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (t: number) => {
    this.raf = 0;
    if (this.destroyed || this.lost || !this.pairs.length) return;

    const dt = this.lastT ? Math.min(t - this.lastT, 100) : 1000 / 60;
    this.lastT = t;
    if (dt > 0) this.fps += (1000 / dt - this.fps) * 0.05;

    if (this.playing) {
      this.accum += this.params.speed * (dt / (1000 / 60));
      const whole = Math.floor(this.accum);
      this.accum -= whole;
      const steps = Math.min(whole, 16);
      for (let i = 0; i < steps; i++) this.simStep();
      if (steps > 0) this.dirty = true;
    }

    if (this.dirty) {
      this.renderTo(null, this.width, this.height, 1);
      this.dirty = false;
    }

    if (this.onStats && t - this.lastStats > 500) {
      this.lastStats = t;
      this.onStats({
        fps: this.playing ? Math.round(this.fps) : 0,
        cols: this.cols,
        rows: this.rows,
        cells: this.cols * this.rows,
        precision: this.fmt.label,
      });
    }

    if (this.playing) this.schedule();
  };

  private handleVisibility = () => {
    if (!document.hidden) {
      this.lastT = 0;
      this.schedule();
    }
  };

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.lost = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  };

  private handleContextRestored = () => {
    this.lost = false;
    this.initGL();
    this.resize();
    this.schedule();
  };
}
