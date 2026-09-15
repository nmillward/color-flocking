# Color Flocking

Colors that flock like birds. A grid of cells never moves — instead each cell's **color** is a boid
flying through color space, steered by its neighbors on the grid.

**Live: https://nmillward.github.io/color-flocking/**

A modern reimagining of a 2016 Processing sketch
([nmillward/processing_sketches](https://github.com/nmillward/processing_sketches/tree/master/color_flocking)),
rebuilt to run on the GPU with interactive controls, photo seeding and image export.

## How it works

Craig Reynolds' three flocking rules (separation, alignment, cohesion) are applied to color instead
of position, plus three additions that make it hold together visually:

| Force | What it does |
|---|---|
| Separation | Steer away from neighbors' colors — keeps variety |
| Alignment | Match neighbors' color velocity — creates traveling waves |
| Cohesion | Steer toward neighbors' average color — blends and blurs |
| **Anchor** | A spring back toward each cell's starting color — lets a photo shimmer without dissolving |
| **Palette lock** | Treats a palette's gradient as a rail: colors glide along it but can't leave it |
| **Noise** | Small random kicks so the system never settles |

Every cell updates in parallel in a WebGL2 fragment shader (ping-pong float textures), so the grid
scales from chunky 64px cells to roughly one cell per pixel.

## Controls

Hover to reveal the toolbar and control panel. Keyboard: `space` pause, `→` step, `R` new start,
`X` surprise, `S` save PNG, `C` controls, `F` fullscreen.

## Development

```bash
npm install
npm run dev
```

`npm run build` type-checks and bundles; pushing to `main` deploys to GitHub Pages.

In dev, `window.tuning.board([{ name, seed, params }], steps)` renders a labeled contact sheet of
variants with a motion score — how presets were tuned.

## Layout

- `src/engine/` — framework-agnostic simulation (WebGL2 + shaders), reusable outside this app
- `src/app/` — React UI: canvas, control panel, presets, palette extraction
- `public/images/` — stock photos

## Credits

Photos from [Unsplash](https://unsplash.com), used under the Unsplash License. Each photo credits its
photographer in the app.
