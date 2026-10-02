# Demos Screen for Every Renderer

| Field    | Value      |
| -------- | ---------- |
| Priority | medium     |
| Created  | 2026-09-30 |
| Updated  | 2026-09-30 |

## Description

The demos gallery (`site/demos/index.html`, run by `site/src/demos/main.ts`) only
knows Pixi. A `DemoEntry` starts on a Pixi `Container`, with a host that
gives it Pixi's `Renderer` and `Ticker` (`site/src/demos/demo-entry.ts`); the
runner makes a Pixi `Application` for each launch; and thumbnails are drawn
into a Pixi `RenderTexture`. So "Boids in 3D", drawn with three.js
(`site/src/demos/boids-3d/`), cannot be a card: it is a page of its own, linked
from the gallery's subtitle. Any later demo on three.js or the DOM would be
the same.

Rework the gallery so every demo is a card, whatever it renders with, and
build the gallery itself with HTML JSX (`@mvtjs/html/jsx`, from 022's step 10),
the MVT way: a gallery model, and an HTML view of it.

### What to design

- **A renderer-neutral `DemoEntry`.** What a demo needs from the runner is
  somewhere to draw and a loop to be driven by. For example, `start({ host })`
  with a host that gives an element to mount into and the frame's time, and a
  session that owns its renderer (a Pixi `Application`, a three.js
  `WebGLRenderer`, or none, for the DOM) and drives its own scene passes.
  Or keep one host per renderer behind a small interface. Decide which reads
  better in a demo's entry, and keeps a demo's own code free of the gallery.
- **Thumbnails for every renderer.** Today a thumbnail starts the demo
  headless, advances it `thumbnailAdvanceMs`, and renders one frame to a
  texture. Per renderer: Pixi as now; three.js by rendering one frame to its
  canvas and reading it back (`toDataURL`, with a renderer made for it, or a
  render target); the DOM has no drawing to read back, so a static image the
  demo supplies, or a live, scaled-down, non-interactive copy. Also consider
  a static image for every demo, generated at build time, so the gallery
  starts nothing on load.
- **Launching.** The runner shows the demo full-size in the page, as now,
  and tears it down on exit, for every renderer.
- **The gallery view in HTML JSX.** Cards, the info panel and the runner's
  chrome, with `<List>` over the model's demos, in place of `main.ts`'s
  hand-written DOM code. It is also the first real app screen built with the
  HTML JSX runtime, so note what it shows about the runtime.
- **Boids in 3D becomes a card.** Its page, and the subtitle's link, go.

## Acceptance Criteria

- [ ] A `DemoEntry` that works for Pixi, three.js and DOM demos
- [ ] Thumbnails, and launching, for demos on every renderer
- [ ] The gallery built with `@mvtjs/html/jsx`, from a gallery model
- [ ] Boids in 3D in the gallery as a card, and its separate page removed
- [ ] Findings about the HTML JSX runtime, from building a real screen with
      it, recorded in its design notes or a task

## Progress Log

- 2026-09-30: Created, from review of 022's merge (step 9, the three.js
  demo), which had to be a separate page because the gallery only knows
  Pixi. Depends on the HTML JSX runtime (022's step 10).
