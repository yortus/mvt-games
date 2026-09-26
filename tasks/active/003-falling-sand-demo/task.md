# Falling Sand Demo

| Field    | Value      |
| -------- | ---------- |
| Priority | high       |
| Created  | 2026-09-25 |
| Updated  | 2026-09-25 |

## Description

A clean-room falling-sand demo in `src/demos/falling-sand/`. It has two jobs:

- **Stress the MVT game loop.** Every grain is its own item in the model and
  its own sprite in the view, so the whole grain count goes through the
  per-container refresh path every frame. A settled grain still costs a refresh
  and three property writes per frame, so view cost grows with the total
  number of grains, while the simulation only pays for the grains that are
  moving. A deep settled pile makes the gap between the two easy to see.
- **Show JSX Pixi views in MVT**, using `pixi-jsx` and `<List>`.

The behaviour reference is the working simulation in the sibling
`mvt-workshop` repo (branch `origin/solutions-and-extras`,
`src/examples/falling-sand/`). It was studied for behaviour only; no source is
copied. Differences from it are deliberate and listed below.

### Scope decisions (agreed 2026-09-25)

- Pixi only: no tweakpane, storybook or HTML widgets.
- Gestures and controls:
  - tap, hold and drag in the tank to pour the selected tool
  - a tool palette: sand, water, wall, erase
  - a Flip button: the tank rotates 180 degrees over 500 ms, then the grains
    fall again
  - a Reset button: restores the starting scene
- No ambient pouring (no emitter), no preset-amount buttons, no sleep toggle,
  no gravity/sim-rate sliders.
- A stats panel: grain count, moving count, and a small perfmon
  (FPS, CPU ms per frame, GPU ms per frame). The perf probe and its view go in
  `src/common/` so other demos and games can reuse them.
- Sand sinks through water (swaps places with water below it).
- `pixi-jsx` gains `onPointerMove`, `onGlobalPointerMove`,
  `onPointerUpOutside`, `hitArea` and `cursor` props.

### Simulation (domain units only)

- Grid of `cols` x `rows` cells, row increasing downward. One grain per cell.
  Occupancy grid (`Int32Array`) for constant-time neighbour queries.
- Grain kinds: `'sand' | 'water' | 'wall'`. Tool kinds add `'erase'`.
- Fixed timestep: 60 steps per second, at most 4 steps per frame; the
  accumulator drops leftover time after a stall.
- Only moving grains are visited each step. A grain that fails to move for a
  couple of steps goes to sleep; when a cell empties, the grains that could now
  move into it (above, above-left, above-right, left, right) wake up.
- Rules:
  - sand: fall; else slide diagonally down (random side when both are free);
    sinks through water by swapping with it
  - water: fall; else diagonal; else flow sideways, possibly several cells, to
    find its level
  - wall: never moves, never wakes
- Gravity: a falling grain gains speed each step and may drop several cells,
  checking every cell so it never passes through anything. Landing spends the
  speed.
- The scan alternates direction each step to cancel sideways bias.
- Seeded PRNG so tests, thumbnails and benchmarks are reproducible.
- Pouring is model state (`startPour`/`movePour`/`endPour`) applied inside the
  sim step, so the pour rate does not depend on frame rate. Sand and water
  spray a few grains per step around the pour point; wall and erase stamp a
  disc along the path between pointer samples so fast drags leave no gaps.
- Flip is model state: while flipping, the sim pauses and the tank angle runs
  from 0 to pi over 500 ms; at the end every grain moves to
  `(cols-1-col, rows-1-row)`, the angle resets to 0 and every non-wall grain
  wakes.
- Reset rebuilds the starting scene (sand heap, wall ledges, a pool of water).

### View

- One shared white texture, one sprite per grain, projected with
  `<List items={model.grains}>` over a `SlotList`. `x`, `y` and `tint` are
  getters, polled every frame. An empty slot hides and skips its subtree.
- Per-grain colour variation derived from the slot index (stable for a
  grain's life under `SlotList`), presentation only.
- The tank container rotates by the model's flip angle about its centre.
- Tank hit area relays pointer input as cell coordinates. A brush ring follows
  the pointer (cosmetic view state).
- Toolbar: palette swatches with the selected one highlighted, Flip, Reset,
  stats panel.

### Expected cost shape (the point of the stress test)

| Cost                     | Scales with       |
| ------------------------ | ----------------- |
| Simulation `update()`    | moving grains     |
| Refresh pass (bindings)  | **total grains**  |
| Render traversal         | total grains      |
| Draw calls               | roughly constant (one texture, batched) |

The expected wall is CPU (per-container refresh and scene traversal), not
GPU.

### Stretch ideas (not in scope)

- Fire and smoke (discrete reactions between materials)
- Smooth motion between cells (makes every grain change every frame)
- Drains that remove grains, to sustain churn
- Moving settled grains out of the live scene into a baked texture, to show
  what it takes to make polling cost scale with moving grains

## Acceptance Criteria

- [x] `pixi-jsx` supports the new pointer props, `hitArea` and `cursor`
- [x] Frame stats probe and perfmon view in `src/common/`
- [x] Demo runner passes the renderer and ticker to demo sessions
- [x] Grain field and sand model with unit tests
- [x] Tank view with pouring, brush ring and flip rotation
- [x] Toolbar with palette, Flip, Reset and stats panel
- [x] Demo registered in the gallery with a README
- [x] `npm run build`, `npm run lint` and `npm test` pass
- [x] **Before wrapping up the session:** add a headless benchmark case for
      the demo (see `benchmarks/README.md`, "Adding a suite")

## Progress Log

- 2026-09-25: Studied the plan doc and the workshop implementation, agreed
  scope. Plan doc (`docs/temp/falling-sand-plan.md`) deleted at the user's
  request; its useful content is captured above.
- 2026-09-25: Built the demo. `pixi-jsx` gained `onPointerMove`,
  `onGlobalPointerMove`, `onPointerUpOutside`, `onPointerCancel`, `hitArea`
  and `cursor`. `src/common/` gained `createFrameStats` (FPS, CPU ms, GPU ms
  via `EXT_disjoint_timer_query_webgl2`) and `createPerfmonView`.
  `DemoEntry.start` takes an optional `DemoHost` (renderer, ticker).
  Deviations from the plan above: the grain pool is the field's own
  id-indexed pool (no per-insert allocation), not `SlotList`; the model has a
  `scene: 'starting' | 'empty'` option for tests and benchmarks. Driven in
  headless Chrome: pouring, walls, flip and reset all work; about 7k grains
  with ~50-250 moving ran at 60fps, CPU ~4-5 ms per frame (SwiftShader).
  Remaining: the benchmark case.
- 2026-09-25: Feedback round. Demo runner renders at displayed scale x DPR
  (crisp text in every demo). Pour rate roughly doubled (24 grains/step,
  poured grains start falling at 3 cells/step). Clear button and
  `SandModel.clear()`. Water now flows sideways only when driven (a drop in
  sight within 32 cells, or a grain pressing from above) and wakes on those
  events, so pools settle level and the tank reaches 0 moving. `tankAngle`
  replaced by `flipProgress` (0..1, linear); the view eases it into an angle.
  Perf at 10k grains: Pixi rebuilt the whole scene's batches every frame
  because toolbar text changed (fixed: tank is its own render group, `isRenderGroup`
  JSX prop added); `tint` now a watched JSX prop (Pixi parses colour on every
  write); counts use a cached `Intl.NumberFormat`. Browser profile at rest went
  from ~8 ms busy (render ~6, refresh ~2) to ~3.5 ms (refresh ~2.3 under the
  profiler in dev mode, ~0.9 bundled in Node; render ~0.5).
  Open question: the refresh pass is still ~7x the `scaling` benchmark's
  per-container cost; suspects are `<List>`'s per-slot presence check and
  accessor indirection. Worth a benchmark case of its own.
- 2026-09-25: Benchmark suite `falling-sand` added (not yet run with
  `--save`). Binding reads per frame: `bindingReadCounter` in `#pixi-jsx`
  (off by default, sampled one frame per window by `createFrameStats`), shown
  as `Rds` in the perfmon. `<List>` now writes a slot's `visible` only
  when presence changes (fixes per-frame flip-flop of item views hidden by
  their own `visible` binding, and keeps the counter free).
  Deep dive on the refresh pass vs the `scaling` benchmark, per grain at
  1,000 / 10,000: benchmark scene 8.7 / 15.3 ns; tank 46.9 / 78 ns.
  Accounted for by: megamorphic inline caches in the shared pass loop
  (~+14 ns; mixed scenes lose V8 inlining, which the uniform benchmark scene
  keeps), `<List>` per-slot indirection (~+9 ns), per-grain work the
  benchmark does not do (colour lookup, pool presence check, watched tint;
  ~+10 ns), and ~2x memory per item (2.5 KB vs 1.2 KB) at 10,000.
  Prototype (reverted, proposed): cache methods in pixi-mvt's memoised list,
  -30 to -35% on mixed scenes, no change on uniform ones.
- 2026-09-25: GPU spike while grains move (reported ~7-10 ms, even at a few
  hundred grains after Clear). Reproduced in headed Chrome on this machine's
  RTX 4070 at ~2.3 ms/frame while falling after filling to ~20k then
  clearing. Cause: thousands of hidden `<List>` slots (the high-water mark)
  inside the tank's render group, on frames where its sprites move. The WebGL
  call stream is identical either way, so the cost is below Pixi (Chrome GPU
  process / ANGLE); not text uploads (ruled out by hiding all toolbar text).
  Detaching hidden slots: 0.56 ms; no render group: 0.66-0.73 ms; hidden
  slots moved outside the group: 0.54 ms. Open decision: let `<List>` detach
  slots past `length` (changes its never-detach contract), or drop the tank
  render group and avoid per-frame text rebuilds another way.
  Binding read counter tidied: `countBindingReads(run)` helper, documented
  scope, Switch test. Abbreviation for the monitor row still to decide.
- 2026-09-25: Monitor row renamed `BPF` (bindings per frame). `<List>` now
  detaches slots past `length` (kept, reattached on regrowth, destroyed with
  the list); holes are still hidden. After a 20k fill and clear to 180
  grains, the refresh pass went from ~970 to ~10 µs/frame; `construction`
  pool benchmark within noise. Proposals 004 (4.4, open question 2) and 006
  updated. GPU spike: NOT fixed by this. Within-session A/B controls showed
  the NVIDIA laptop GPU's timer readings swing 1.0-2.8 ms with no change at
  all (low power states, P5 at ~450-700 MHz), so earlier single-run
  conclusions (hidden slots, render group, fresh batcher) were noise. What
  held across runs: readings are higher after a large fill (e.g. 3.1 vs
  0.31 ms), on NVIDIA only (Intel Arc flat ~0.4 ms), with identical WebGL
  call streams. Cause below Pixi; unresolved.
- 2026-09-25: GPU figure explained. The probe's timer query spans the whole
  render on the GPU's clock; on NVIDIA (measured) that span includes CPU time
  whenever the command stream is flushed mid-render: 2 ms of CPU work inside
  a flushed query read as 2.2 ms of "GPU" for 0.02 ms of real work (Intel Arc:
  0.28). Same demo frames while grains fall: RTX 4070 ~2.2 ms, Intel Arc
  0.3-0.5 ms, so the NVIDIA figure is an artifact, not GPU load. Fixes: report
  the median per window (was the mean, dominated by inflated frames), check
  the disjoint flag once per collection and drop everything in flight when
  set (was per query, so most invalid results were kept), document gpuMs as
  an upper bound. Rest readings now steady (0.2-0.3 ms); NVIDIA still reads
  ~2 ms while sprites move. Unit tests with a fake WebGL 2 context.
- 2026-09-25: Compared with mvt-workshop's performance monitor. Same
  technique (TIME_ELAPSED query), spanning the whole tick (ticker priority
  100 to -100) rather than Pixi's render; shows the latest single frame plus
  a 1000-frame bar graph; same per-query disjoint bug. Transplanted into this
  demo and interleaved frame by frame with ours: identical distributions
  (rest p50 0.15 ms; moving p50 2.0 ms, p10 0.14). So the method is not why
  it looks better. NVIDIA readings for the same scene vary by session (moving
  p50 0.17 in one, 2.0 in another), not explained by clock state alone, and
  rise with other contexts' GPU work (0.17 -> 0.43 ms with a busy background
  canvas). A like-for-like comparison would need the workshop's falling-sand
  story (branch solutions-and-extras) run on this machine.
- 2026-09-25: GPU row now per frame: `FrameStats.gpuFrameAt(i)` /
  `gpuFrameHistoryLength` (last 120 timed frames); the monitor draws one bar
  per frame, scaled to its own peak (floor 1 ms, budget line only when
  reached); the number stays the window median. Other rows unchanged. On the
  RTX 4070 this shows a flat ~0.2 ms line with thin spikes at rest, and a
  sustained ~2-2.5 ms plateau while grains fall.
- 2026-09-25: Per-frame GPU row reverted at the user's request (not an
  improvement). Median and disjoint fixes kept.
- 2026-09-25: Does the GPU figure pick up other GPU work on this machine? Yes.
  The RTX 4070 drives the display (Disp.A On) and ~20 processes hold
  graphics contexts on it (DWM, VS Code, Chrome, Steam, Armoury Crate, ...).
  Directly: the timer measures GPU wall time between two markers, so other
  work scheduled in between counts (a busy canvas in the same page raised
  readings 0.17 -> 0.43 ms). Indirectly and more strongly: the driver's clock
  management reacts to total load. With a heavy WebGL load toggled in a
  separate Chrome process, the demo's falling-frame medians dropped to ~0.13
  ms right after the load started (GPU clocked up) and climbed back to
  1.5-2.5 ms within seconds; with nothing changed they drift 0.1-1.5 ms.
  Conclusion: on this machine's NVIDIA GPU the figure reflects the machine
  and the driver more than the demo. Intel Arc readings stay ~0.3-0.5 ms.
- 2026-09-26: Review renames. `SandModel` -> `DemoModel` and the root view
  -> `DemoView`, matching the games' `GameModel`/`GameView` convention for a
  top-level model and view (and the tsx-pixi demo's `DemoModel`); `TankView`
  and `ToolbarView` each present part of it. `GrainField` -> `GrainGrid` (not
  a model: no `update(deltaMs)`, stepped by the demo model). `layout.ts` ->
  `layout-constants.ts`. Views converted to JSX function components
  (`FooView(props: FooViewProps)`, `getBar` bindings -> `bar` props).
  `grainTint` -> `pickGrainTint`, `grainShade` -> `lookUpShade`,
  `fitRotated` -> `scaleToFitRotated`.
