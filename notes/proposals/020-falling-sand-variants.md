# Proposal: Falling sand as an implementation lab

> The falling-sand demo can now run with other implementations of its model
> and its view, chosen in the page's URL. The model stores grains either as a record
> per grain or as a typed array per field, behind one interface. The view
> draws them either as a sprite per grain or as a pixel per cell. A third
> choice sizes the tank up to 246,240 cells. Each is fixed for the demo's
> life; changing one reloads the page. This proposal records what was
> built, what it measured, two V8 findings that matter beyond the demo, and
> how a SolidJS / pixi-solid view would fit, which is designed for but not
> built.

**Status:** implemented in part. The two model variants, the two view
variants, the tank sizes and the benchmark are built, on the `sand-variants`
branch. The pixi-solid variant is proposed only (section 7).

**Written:** 2026-09-27. Measured on an Intel Core Ultra 9 185H: headless in
Node.js 22.11 through `npm run bench -- falling-sand-scaling`, and in Chrome
against the Vite dev server, driven through the DevTools protocol.

**Related:** [`src/demos/falling-sand/`](../../src/demos/falling-sand/README.md),
[012 - Performance findings from the falling-sand demo](./012-falling-sand-performance-findings.md),
[013 - Does the MVT architecture limit game performance?](./013-mvt-performance-ceiling.md)
(section 8 proposed this experiment),
[`benchmarks/results/falling-sand-scaling.md`](../../benchmarks/results/falling-sand-scaling.md),
[`benchmarks/results/reactivity.md`](../../benchmarks/results/reactivity.md).

---

## 1. Summary

| # | Item | Outcome | Section |
| --- | --- | --- | --- |
| 2 | Two models behind one interface, chosen at start-up | Built. Two grids, identical step for step (tested by comparing `save()` snapshots) | 2 |
| 3 | Two views, chosen at start-up | Built. Sprite per grain, or pixel per cell. The choice is the view's, a `DemoView` prop | 3 |
| 3.1 | Fixed for the demo's life, chosen in the URL | Built. A switch reloads the page. Runtime swapping was built first and withdrawn (6.2) | 3.1 |
| 4 | What the variants cost | Measured. At about 115,000 grains in Chrome: 17.5 ms settled with objects and sprites, 2.7 ms with arrays and pixels. The pixel view is 20-35x cheaper to refresh than sprites at scale. The typed-array model is only 1.04-1.4x faster than objects headless (2x beside the sprite view's heap): the rules, not the layout, are the model's cost | 4, 5 |
| 6.1 | Object literals with getters are slow in V8 | Found. Dictionary mode, no inlining through them. Fixed in `Grains` (3x on the pixel view); the rest of the repo has the same pattern | 6.1 |
| 6.2 | Swapping implementations in a running page | Found. Call sites that have seen both implementations stop inlining, so an in-page A/B favours whichever ran first. Why the choice is now fixed per page | 6.2 |
| 6.3 | 013's estimate for a flat view (1.5-4 ns per grain) | Nearly reached through the shared interface: 4.5 ns per grain with arrays at 200,000 grains in the benchmark, 6.4 with objects. The calls through `Grains` are most of it | 6.3 |
| 7 | A pixi-solid view | Feasible, and designed for. Slots into the view axis as a third grain view; needs a signal bridge and a second JSX compiler | 7 |
| 8 | Next experiments | Proposed | 8 |

---

## 2. The model axis

### 2.1 One interface, two implementations

`DemoModel`, the demo's top-level model, owns the tank's fixed timestep,
pouring, the flip and saving. By convention every demo now has a top-level
`DemoModel`, and this one sets the standard. It steps a `GrainGrid`, which
has two implementations, in `models/grain-grid/`:

| Storage | File | Layout |
| --- | --- | --- |
| `objects` | `object-grain-grid.ts` | The original grid: a record per grain (`col`, `row`, `kind`, `fallSpeed`, ...), a pool of them allocated up front, the moving grains as an array of records |
| `arrays` | `array-grain-grid.ts` | One typed array per field, indexed by grain id (`Int32Array` columns and rows, `Uint8Array` kinds, `Float64Array` fall speeds, ...), the moving grains as an `Int32Array` of ids |

The rules are the same line for line; only the data layout differs, so the
experiment varies one thing. The tests run every grid test against both,
and check that the two produce identical snapshots after 300 busy steps
(adds, removes, walls, half turns). `Float64Array` rather than
`Float32Array` for fall speeds is what makes them identical: speeds
accumulate by 0.4 per step, and single precision floors differently.

The storage is an option to `createDemoModel`, fixed when the model is
created.

### 2.2 The interface reads grains by id

The original interface handed out a `Grain` object per id. An arrays grid
could only satisfy that with an object per grain, which is what it exists
to avoid, and `<List>` caches `at(i)` per slot, which rules out a single
reused cursor object. So `Grains` now reads fields by id:

```ts
interface Grains extends IndexedSlots<number> {
    colOf: (id: number) => number;
    rowOf: (id: number) => number;
    kindOf: (id: number) => GrainKind;
}
```

`at(id)` returns the id while a grain holds it, so `<List>` still projects
it directly. The sprite view changed from `grain().col` to
`grains.colOf(id)`.

### 2.3 Saving and loading

`tank.save()` returns plain data: every grain's fields, the moving list in
order, the free-id stack, the scan direction, the random generator's state,
and the pour and flip. `load()` accepts a snapshot from either storage kind.
The tests drive a tank of each storage kind through the same pours and flip
and compare their snapshots, and hand a run from one kind to the other half
way through, ending identical to a run that never changed. The snapshot
also makes the model serialisable, for saved games or replays.

### 2.4 Tank sizes

Three sizes, all drawn 456 x 540 pixels: 152 x 180 cells (27,360), 228 x 270
(61,560) and 456 x 540 (246,240). The brush and the pour rate scale with the
cell size, so each tank fills about as fast for its size. Physics stays in
cells per step, so grains in a finer tank fall more slowly on screen.

## 3. The view axis

`TankView` draws the grains inside a container scaled from cells to pixels,
and builds the grain view chosen by its `grainsView` prop, read once:

| View | File | How |
| --- | --- | --- |
| `sprites` | `grain-sprites-view.tsx` | The original: `<List>` of sprites, three getter props each (`x`, `y`, `tint`) |
| `pixels` | `grain-pixels-view.ts` | One `cols` x `rows` texture. Each frame: clear an `Int32Array` over its bytes, write one pixel per grain, upload |

Both are ordinary MVT views: they read every grain every frame and write
only presentation output. The pixel view uploads the whole texture
every frame (about 1 MB at the largest size), a GPU-side cost the headless
benchmark does not see.

The choice of grain view is the view's, not the model's. An earlier cut kept
it in a model that wrapped the tank, alongside the storage, since both were
switchable at runtime; that was within the rules (a remembered user
setting) but read like a model holding view state, and it went with runtime
switching.

### 3.1 Choosing variants

The storage, the grain view and the tank size are read from the page's URL
when the demo starts (`variants.ts`):
`/demos/?storage=arrays&view=pixels&tank=large#falling-sand`. The toolbar's
switches show the running choice, and pressing one reloads the page with a
new URL; the gallery's runner relaunches the demo from its `#id`. Started
headless (thumbnails, benchmarks), the demo uses the defaults. The switches
are Pixi segmented controls, as 016 kept the demo to Pixi-only UI.

This works the same in an iframe, which a comparison page could use to show
variants side by side, each in its own page.

## 4. In the browser

Chrome, Vite dev server, one variant per page load (section 6.2), about
115,000 grains in the large tank, 3,700 of them still trickling off the
ledges. CPU is main-thread task time per frame, from `Performance.getMetrics`,
so it includes Pixi's render. Flipping is the mean over three windows of
1.5 s, starting 0.7 s after each flip.

| Model, view | Settled: CPU / fps | Flipping: CPU / fps | JS heap |
| --- | --- | --- | --- |
| objects, sprites | 17.5 ms / 57 | 83 ms / 12 | 240 MB |
| arrays, sprites | 18.1 ms / 55 | 50 ms / 20 | 232 MB |
| objects, pixels | 3.8 ms / 60 | 20 ms / 48 | 81 MB |
| arrays, pixels | 2.7 ms / 60 | 9 ms / 60 | 65 MB |

- **At rest, the view is the cost.** Pixels are 4.6x cheaper than sprites;
  the model's layout makes no difference to a sleeping tank.
- **Moving, both matter.** Arrays cut the flipping frame by 1.7x under
  sprites and 2.2x under pixels. Together, 9x.
- **Memory follows the view.** About 1.4 KB per grain for the sprite view.
  The objects grid preallocates a record per cell, about 16 MB at 246,240
  cells.

## 5. Headless

`npm run bench -- falling-sand-scaling`, one variant per process, three
processes per case, no rendering. Up to 20,000 grains in the small tank,
above that in the large one. Full tables in
[`falling-sand-scaling.md`](../../benchmarks/results/falling-sand-scaling.md).

Total µs per frame (model, update pass and refresh pass):

| Grains | Settled: objects, sprites | Settled: arrays, pixels | Flipping: objects, sprites | Flipping: arrays, sprites | Flipping: objects, pixels | Flipping: arrays, pixels |
| --- | --- | --- | --- | --- | --- | --- |
| 10,000 | 768 | 51 | 1,680 | 1,670 | 780 | 703 |
| 50,000 | 7,540 | 231 | 14,000 | 11,500 | 4,400 | 3,780 |
| 200,000 | 31,300 | 915 | 42,200 | 33,700 | 8,070 | 5,590 |

The model alone, flipping (µs per frame; 63,000 grains moving at 200,000):

| Grains | objects (with sprites) | arrays (with sprites) | objects (with pixels) | arrays (with pixels) |
| --- | --- | --- | --- | --- |
| 10,000 | 772 | 713 | 709 | 647 |
| 50,000 | 5,510 | 4,040 | 4,000 | 3,520 |
| 200,000 | 11,600 | 5,680 | 6,630 | 4,680 |

- **The view is where scale bites.** Settled, the sprite view's refresh
  costs 45 ns per grain at 1,000 grains and 156 at 200,000; the pixel view's
  4.5-9 ns, falling as the grain count grows. At 200,000 grains, 31 ms
  against under 1 ms.
- **The model's layout helps less than hoped.** Beside the pixel view,
  arrays are 1.04-1.14x faster than objects up to 20,000 grains and
  1.14-1.4x from 50,000 to 200,000. The simulation's cost is its rules:
  unpredictable branches and neighbour scans, which 013 section 4.2
  predicted would cost the same in any layout. The hypothesis that typed
  arrays would be "much faster at scale" does not hold for the model on its
  own; see section 8 for an algorithm change that might.
- **The objects model suffers from the sprite view's heap.** Beside 200,000
  sprites the objects model costs 11.6 ms, against 6.6 ms beside the pixel
  view; the arrays model 5.7 against 4.7. Records scattered through a large
  heap, among the sprites and their closures, lose more to cache misses and
  garbage collection than a few flat arrays do. So the layout gain is
  largest exactly where the object-heavy view is (2x at 100,000 and 200,000
  grains), which is why the browser figures in section 4, where the heap is
  largest, show more.
- **Together**, arrays and pixels are 34x cheaper than objects and sprites
  at 200,000 settled grains, and 7.5x while flipping, when the model
  dominates.

These figures are from the second run of the suite, after the variants were
fixed per process. The first run filled every tank with arrays and switched
to the measured storage in-process; it gave the same picture, with the
objects model somewhat less penalised beside sprites (1.6x rather than 2x).

## 6. Findings

### 6.1 Object literals with getters are dictionary-mode objects

V8 12.4 (Node 22) creates an object literal that contains a `get` accessor
in dictionary mode (`%HasFastProperties` is false; the same literal without
the getter is fast). Property loads on it are hash lookups, and calls
through its function-valued properties are not inlined.

`Grains` first had `get length()`. A standalone loop calling `at(id)` and
`colOf(id)` through such an object cost 8.4 ns per item; with a plain
`length` field, 1.9 ns. In the demo, the pixel view went from 24.5 to 7.9 ns
per grain at 200,000 grains (arrays) and from 30.3 to 11.2 (objects). Each
grid now keeps `grains.length` as a plain field, updated wherever its
highest id changes.

This is wider than the demo. The repo's style (the model skill, the style
guide's `createCounterModel` example) builds models as object literals with
getters, and the original grid's `grains`, which `<List>` calls `at(i)` on
for every slot every frame, was one. A model read a handful of times a frame
does not care. A per-item model read by a per-item view does: every getter
read is a dictionary lookup and an uninlined call. That is plausibly part of
the 47-145 ns "faithful" refresh cost 012 and 013 measured, and is worth its
own measurement (section 8). The boids fix recorded in the Performance
Measurements docs, where a boid record with getters made the engine box
numbers written to it, is likely the same mechanism.

### 6.2 Swapping implementations defeats inlining at shared call sites

V8's call feedback inlines a call site while it has seen one target. After
a storage switch, the view's `grains.colOf(id)` has seen the objects grid's
function and the arrays grid's function, and stops being inlined. In one
page, measured objects first then arrays, arrays with sprites came out
slower than objects with sprites (72 against 57 ms flipping); in fresh
pages, it is faster (50 against 83 ms).

So runtime switching was right for watching a difference and wrong for
measuring one, and was withdrawn: each variant now runs in its own page, and
the benchmark runs each in its own process, filling the tank with that
variant's own storage. This is a property of a JIT, not of MVT, but it is a
real cost of runtime-polymorphic designs in JavaScript.

### 6.3 The flat view, through an interface

013 estimated a TypeScript flat view at 1.5-4 ns per grain. Through the
shared `Grains` interface, at 200,000 settled grains, the benchmark measures
the pixel view's refresh at 4.5 ns per grain with arrays and 6.4 with
objects: close to the estimate, though not inside it. A standalone loop
over the same calls, timed in isolation, ran slower (about 8 and 11 ns),
but shows where the time goes (arrays, after 6.1):

| Part | ns per grain |
| --- | --- |
| Clearing the texture | 0.1 |
| `at(id)` presence check alone | 2.6 |
| Presence, row and column | 4.4 |
| Presence, kind and colour | 6.3 |
| Scattered writes into the texture, alone | 2-3 |
| The whole loop | 7.9 |

Scattered writes are cheap; the four calls per grain through the interface
are most of the cost. A bulk read in the interface, or read-only access to
the arrays, would test whether the rest of 013's estimate is reachable
(section 8). Either would be a model interface shaped for one layout, which
is the trade this experiment is about.

### 6.4 Smaller

- The original `swapWith` woke the same cell's neighbours twice (the other
  grain has just moved into the cell). Waking is idempotent, so dropping
  the second call changes nothing; it is gone from both grids.
- `createRandom` now returns `{ next, state }`, so a tank's random numbers
  can be saved and resumed.

## 7. A SolidJS / pixi-solid variant: feasibility

Not built. The design above was shaped so that it can be.

### 7.1 What pixi-solid is

`pixi-solid` 1.0.0 (peer dependencies `pixi.js >=8.14.3 <9`,
`solid-js >=1.9.10 <2`; both match this repo) wraps each Pixi display object
as a Solid component. Its components construct and return plain Pixi
instances, binding each prop with a `createRenderEffect` (checked in
`dist/components/factories.js`). Only its hooks (`onTick`, `getPixiApp`)
need its application context. So a pixi-solid tree can be built inside a
`createRoot` and added to an existing Pixi container, without its
`<PixiCanvas>`.

### 7.2 Where it slots in

As a third grain view, `GrainsViewKind = 'solid'`, beside the other two in
`TankView`, chosen in the URL like them (`?view=solid`):

```tsx
{props.grainsView === 'solid' && <SolidGrainsHost grains={props.grains} />}
```

`SolidGrainsHost` is an ordinary Pixi container (built with pixi-jsx or by
hand) that creates a Solid root, adds the pixi-solid tree's root object as
its child, and disposes the root when destroyed. It takes the same props as
the other grain views. That is the constraint this design keeps: **a grain
view is a function from `grains: () => Grains` to a Pixi container**, and
what renders inside is its own business. The model axis needs nothing new.

Swapping the whole demo view for a Solid one would work the same way one
level up, but the grains are the only part that scales, so swapping the
grain layer keeps the comparison to one variable.

### 7.3 Feeding it: polling into signals

Solid updates through signals; the models are read by polling. The
recommended first bridge keeps the models untouched:

- The host's `onRefresh` (a normal MVT refresh step) reads every grain
  through `Grains` and writes per-grain signals inside one `batch()`.
  Solid's equality check drops unchanged values, so only grains that moved
  run their effects.
- Cost: the same O(grains) polling as the pixel view (section 6.3), plus a
  signal write per grain per field, plus an effect per changed property.
  The `reactivity` suite puts Solid at about 43 ns per changed property and
  near zero when nothing changes.
- It is MVT as it stands: the refresh step reads the model and writes
  presentation state, which the signals are. It works with either storage.
- Only the chosen grain view is built, so the Solid runtime does no work
  in the other variants' pages.

Expectation (not measured): at rest, about the pixel view's polling cost
plus the signal writes, with Pixi's per-sprite render cost unchanged, since
pixi-solid still has a sprite per grain. Flipping, worse than the sprite
view: every moving grain pays a signal write and an effect on top of the
sprite.

### 7.4 Feeding it: a change feed, the experiment worth doing next

Polling keeps a Solid view O(grains) per frame, which is the cost Solid
exists to avoid. The alternative that keeps views technology-neutral is a
change feed in the model interface: the ids of the grains that changed in
the last `update()`. Both grids can record it cheaply where they already
touch a grain (`moveTo`, `swapWith`, `add`, `remove`), deduplicated with a
per-id stamp. It is model state, not view knowledge, so it fits MVT. The
bridge then updates only changed grains' signals, O(changed); the pixel
view could use it too, to redraw only changed pixels.

That is where the architectural question of 013 section 5 becomes
measurable in this demo: polling against change-driven updates, on the same
model, at a known fraction of grains changing.

### 7.5 Reconsidered: a Signals model

This section first rejected a third storage kind holding Solid signals, on
three grounds. On reflection, only one of them holds:

- *It ties the model to one view technology's library.* Weak. Solid's
  reactive core is a general reactivity library, like MobX. While
  `update(deltaMs)` stays the model's only source of time, signals are an
  implementation detail behind `Grains`.
- *Every simulation move pays a notification.* True, and exactly the cost
  worth measuring.
- *An object per grain per field.* A real memory cost, which the design
  below avoids.

What does hold is architectural. With a Signals model and a Solid view, a
signal written inside `update()` runs the view's effects then and there:
presentation changes during the model's update, not in a refresh pass, and
the model is in effect pushing to the view. That pairing is a reactive
architecture, not MVT. Measuring it against MVT is the point, and the demo
and its docs should say so.

A design that keeps the comparison like-for-like:

- **The arrays grid, plus notification.** The same typed arrays and rules,
  with one "changed" signal per grain id, bumped wherever the grid moves,
  adds, removes or turns a grain. Signals then differs from Arrays by
  exactly the notification cost.
- **Tracked reads through the same interface.** `colOf(id)` reads the
  grain's signal, then the array. A Solid effect calling it subscribes; an
  MVT view calling it just polls, paying one more call.
- **One signal per grain, made on first use of its id**, not one per field
  per cell: the large tank has 246,240 cells.
- **Each `update()` in one `batch()`**, so effects run once per frame, after
  the whole step, and never see a half-stepped tank.

Whether the view choice should follow the model choice, or the two stay
independent, is open (section 9).

### 7.6 Tooling

**Decided: no Solid compiler for now.** The Solid views call pixi-solid's
components as functions, with hand-written getter props:
`Sprite({ texture, get x() { return grains.colOf(id); } })`. That is what
Solid's compiled JSX produces, so the runtime cost is the same, and the
build is unchanged. If the Solid views grow, the alternative is
`vite-plugin-solid` limited to, say, `*.solid.tsx`, with a matching Solid
plugin in the benchmark's esbuild setup (which already aliases `solid-js`
to its browser build, for the `reactivity` suite).
- **No Solid ticker for time.** pixi-solid's `onTick` would bypass
  `update(deltaMs)`. A Solid view should take cosmetic time from its host's
  `onUpdate`, as every other view here does.

### 7.7 Risks

- Memory: a render effect per sprite prop, on top of a sprite per grain,
  and a signal per grain in a Signals model (or per grain per field in a
  polling bridge). Several hundred bytes per grain more than the sprite
  view, which is already about 1.4 KB.
- pixi-solid 1.0.0 is new. Its per-prop effects and cleanup at 100,000
  instances are untested here.

## 8. Next experiments

| Experiment | What it settles | Effort |
| --- | --- | --- |
| Audit per-item models for getter literals (6.1), and measure the sprite view with plain-field models | How much of the "faithful" refresh cost is dictionary-mode objects rather than the design | Small |
| A bulk-read or read-only-arrays path in `Grains` for the pixel view | Whether 013's 1.5-4 ns per grain is reachable, and what it costs the interface | Small |
| The change feed (7.4), used by the pixel view | Polling against change-driven updates on one model | Medium |
| The pixi-solid grain view (7.2, 7.3), then with the change feed | Solid's cost and benefit against MVT polling, at scale | Medium to large |
| An arrays grid that scans cells, not a moving list | 013's "chunked scan" estimate of 5-20 ns per active cell; a new algorithm, not a new layout | Medium |
| An instanced-mesh grain view from a `Float32Array` | The per-entity flat view 013 described, for cases a texture does not fit | Medium |

## 9. Open questions

- **Should the view choice follow the model choice?** One option: Solid
  versions of the sprite and pixel views whenever the model is Signals.
  The other: independent axes (views Sprites, Pixels, Solid sprites), where
  a Solid view on a non-signal model is fed by polling (7.3). Independent
  axes make every combination measurable: Signals with MVT views isolates
  the notification cost, and Arrays with a Solid view isolates the cost of
  Solid's effects. Following the model changes two things at once.

Settled 2026-09-27:

- `save()`/`load()` stay on `DemoModel`. The tests use them to prove the
  storages equivalent, and a Signals model will need the same proof.
- `notes/README.md` lists 018-020; merge conflicts with the main checkout
  are resolved when merging.
- No Solid compiler for now (7.6).
