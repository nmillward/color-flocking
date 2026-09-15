# Color Flocking — Project Plan

A modern, interactive reimagining of a 2016 Processing sketch that applied Reynolds' flocking
(separation / alignment / cohesion) to *color* instead of position. Each grid cell stays put;
its color is a "bird" flying through color space, steered by its grid neighbors.

Goal: a statement piece for the portfolio home page — visual first, instant "wow", with a
hover-reveal control panel for people who want to explore, tweak, and export.

---

## 1. Guiding decisions

| Decision | Choice | Why |
|---|---|---|
| Rendering / sim | **WebGL2 GPU compute** (ping-pong float textures) | Every cell updates in parallel. Scales from chunky 64px cells to ~1 cell per pixel (1M+ cells) at 60fps. ~97% browser support. WebGPU can be added later. |
| Update model | **Synchronous** (all cells read last frame, write next) | Required for GPU; removes the original top-left→bottom-right sweep bias. |
| App framework | **Vite + React + TypeScript** | React matches the likely portfolio stack. TypeScript is written/maintained by Claude Code — it catches mistakes before they reach the browser; no need to be fluent in it. |
| Engine packaging | **Framework-agnostic engine** (`src/engine`) + thin React wrapper | The same engine drops into the portfolio (React, Astro, anything) and powers embeds/backgrounds later. |
| UI | **Custom minimal hover panel** (no heavy UI kit) | The visual is the hero; controls fade in on hover/tap and get out of the way. |
| Hosting | **GitHub repo + GitHub Pages** via GitHub Actions | Free, static, no server — everything (incl. image processing) runs in the browser. |
| Dependencies | Kept minimal (React, Vite, TS; no three.js) | Small bundle, fast load on the home page. |

---

## 2. How the simulation works (modernized)

### State (stored in GPU textures, one texel per cell)
- **color** — the cell's position in color space (3 channels)
- **velocity** — how that color is drifting (3 channels)
- **anchor** — the cell's origin color (from the image or seed), used by the anchor force
- *(Phase 3)* **mask** — which cells were drawn on, and how

### Per-step forces (in the simulation shader, for every cell at once)
1. **Separation** — steer away from neighbors' colors
2. **Alignment** — match neighbors' color velocity (this is what creates traveling waves)
3. **Cohesion** — steer toward neighbors' average color (blur/diffusion)
4. **Anchor** *(new)* — steer back toward the origin color; keeps images alive instead of dissolving
5. **Noise / temperature** *(new)* — small random kicks so the system never goes flat

Each force uses Reynolds steering (`desired − velocity`, capped at `maxForce`) exactly like the
original, then velocity is capped at `maxSpeed`.

### New dials the original didn't have
- **Color space**: RGB (original feel), OKLab (clean, perceptual blends), HSV (hue wraps → endless rainbow cycling)
- **Color tolerance**: neighbors only count if their color is similar enough → color "tribes" that compete instead of blurring together (the idea the commented-out code was reaching for)
- **Neighborhood**: 4 neighbors, 8 neighbors, or larger radius
- **Color-wall behavior**: bounce (original), wrap, or clamp
- **Grid edges**: closed or wrap-around (a deliberate version of the original's accidental "wormhole" links)

### Cell size (pixelation)
The sim grid is `canvas size ÷ cell size`. Cell size is a live slider (≈1px → 64px).
- The render pass draws each cell as a crisp square (nearest-neighbor), so big cells look like bold pixel art and 1–2px cells look like flowing paint.
- Changing cell size **resamples the current state** into the new grid, so the image re-pixelates smoothly instead of resetting.
- Optional render styles: cell gap (mosaic/tile look), rounded cells, smooth (blended) mode.
- Performance guardrail: minimum cell size adapts to the device (phones get a floor so it stays smooth).

---

## 3. Export — can a design be used elsewhere?

Yes, in several forms (built in Phase 4, PNG earlier):

| Format | How | Notes |
|---|---|---|
| **PNG still** | Re-render the current state to an offscreen canvas at any resolution (e.g. 4K, 5K wallpaper) | Pixel-perfect since cells are crisp squares. Lands in Phase 1. |
| **Video (MP4/WebM)** | Record frames with WebCodecs/MediaRecorder | Great for social posts or video backgrounds. A "loop blend" option can crossfade the end into the start. |
| **Live background (best option for the website)** | Embed the engine itself: `<ColorFlock recipe="..." />` | Tiny, runs live, never repeats, can be dimmed/blurred behind content, pauses offscreen. |
| **Recipe (JSON / share URL)** | All settings + seed + image in a short string | Reproduces the *style* exactly. Note: chaotic systems diverge on different GPUs, so exact frames aren't guaranteed long-term — use PNG/video when you need a fixed result. |
| **Embed snippet** | A standalone `<script>` + recipe for use on other sites | Later phase. |

---

## 4. Phases

### Phase 0 — Setup
- `git init`, new GitHub repo, Vite + React + TypeScript scaffold
- Lint/format config, basic folder structure
- GitHub Actions workflow → GitHub Pages deploy on push to `main`

### Phase 1 — Strong working version (the core)
**Engine**
- WebGL2 context, float texture ping-pong, simulation shader (5 forces), render shader
- Seeds: random RGB, grayscale, palette-constrained, smooth noise gradient
- Image seeding: image → downsampled to grid → initial color + anchor
- Live cell-size changes with state resampling
- Speed (sim steps per frame), pause / play / step / reset / reseed
- Handles resize + high-DPI screens; pauses when offscreen or tab hidden; respects `prefers-reduced-motion`
- Graceful message if WebGL2 isn't available

**Experience**
- Full-bleed canvas; starts immediately on a curated hero preset
- Hover/tap-reveal control panel, auto-hides when idle:
  - **Flock**: separation, alignment, cohesion, anchor, noise, max speed, max force, tolerance
  - **Color**: color space, seed type, palette, wall behavior
  - **Grid**: cell size, gap, neighborhood, edge wrap
  - **Image**: stock image picker (6–8 curated Unsplash photos, bundled + optimized)
  - **Presets** + "Surprise me"
  - **Save PNG**
- Image switching as a *transition*: swapping images changes the anchor, so the flock visibly flows from one picture into the next

### Phase 2 — Tune & polish (iterate together)
- Tune defaults and 6–10 presets until the opening moment is genuinely "wow"
- Mobile/touch pass, performance profiling across devices, adaptive quality
- Motion and visual polish of the panel; keyboard shortcuts
- Shareable URL recipes

### Phase 3 — Drawing lab
Prototype all four modes, switchable, then keep the best:
1. **Pinned** — drawn cells freeze and bleed color outward like dye
2. **Repel** — drawn cells push colors away, leaving a glowing outline
3. **Separate flock** — drawn cells only flock among themselves; never mix with the rest
4. **Paint a target** — the brush sets a color that nearby cells steer toward

Plus: brush size, eraser, clear, typed text (rendered to a mask), and **cursor-as-predator** (scatter colors) as a bonus interaction.

### Phase 4 — Export & embed
- High-res PNG options, video recording with loop blend
- `<ColorFlock />` embeddable component + recipe format, ready for portfolio backgrounds

### Phase 5 — Portfolio integration & future
- Home-page section that expands to full-screen "studio" mode
- User photo uploads (processed locally, never uploaded to a server)
- Optional WebGPU backend, hex grid, audio-reactive mode

---

## 5. Project structure (planned)

```
colorFlocking/
├─ src/
│  ├─ engine/                 # framework-agnostic, reusable anywhere
│  │  ├─ FlockEngine.ts       # public API: start, stop, setParams, seed, exportPNG…
│  │  ├─ gl/                  # WebGL2 helpers (textures, framebuffers, programs)
│  │  ├─ shaders/             # simulate.frag, render.frag, seed/resample shaders
│  │  ├─ params.ts            # all dials, ranges, defaults
│  │  └─ presets.ts
│  ├─ app/                    # React UI
│  │  ├─ ColorFlockCanvas.tsx
│  │  ├─ ControlPanel/
│  │  └─ ImagePicker/
│  └─ main.tsx
├─ public/images/             # optimized Unsplash stock images (+ credits)
├─ .github/workflows/deploy.yml
└─ PLAN.md
```
