# Proposal: Falling sand as an implementation lab

> The falling-sand demo can now run with other implementations of its model
> and its view, chosen in the page's URL. The model stores grains as a record
> per grain, as a typed array per field, or in a SolidJS store, behind one
> interface. The view draws them as a sprite per grain or as a pixel per
> cell: polled every frame, MVT's way, or, for a store, pushed changes by
> SolidJS effects. A third choice sizes the tank up to 246,240 cells. Each is
> fixed for the demo's life; changing one reloads the page. This proposal
> records what was built, what it measured, and three findings that matter
> beyond the demo.

**Status:** implemented, and archived 2026-09-27. The three model variants,
the polled and SolidJS views, the tank sizes and the benchmark are built.
The follow-ups in sections 6.1 and 8 are tracked in
[017](../tasks/backlog/017-misc-loose-ends.md).

**Written:** 2026-09-27. Measured on an Intel Core Ultra 9 185H: headless in
Node.js 22.11 through `npm run bench -- falling-sand-scaling`, and in Chrome
against the Vite dev server, driven through the DevTools protocol.

**Related:** [`src/demos/falling-sand/`](../../src/demos/falling-sand/README.md),
[012 - Performance findings from the falling-sand demo](../proposals/012-falling-sand-performance-findings.md),
[013 - Does the MVT architecture limit game performance?](../proposals/013-mvt-performance-ceiling.md)
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
| 4 | What the variants cost | Measured. At about 115,000 grains in Chrome: 18.3 ms settled with objects and sprites, 3.0 ms with arrays and pixels. The pixel view is 20-35x cheaper to refresh than sprites at scale. The typed-array model is only 1.1-1.6x faster than objects headless (1.9x beside the sprite view's heap): the rules, not the layout, are the model's cost | 4, 5 |
| 6.1 | Object literals with getters are slow in V8 | Found. Dictionary mode, no inlining through them. Fixed in `Grains` (3x on the pixel view); the rest of the repo has the same pattern | 6.1 |
| 6.2 | Swapping implementations in a running page | Found. Call sites that have seen both implementations stop inlining, so an in-page A/B favours whichever ran first. Why the choice is now fixed per page | 6.2 |
| 6.3 | 013's estimate for a flat view (1.5-4 ns per grain) | Nearly reached through the shared interface: 4.5 ns per grain with arrays at 200,000 grains in the benchmark, 6.4 with objects. The calls through `Grains` are most of it | 6.3 |
| 7 | A SolidJS store model, with pixi-solid views | Built, as a Solid developer would write it. Settled, it costs about 4 µs a frame at any grain count, against 90 µs to 2.8 ms polled at 20,000 grains. Moving, it is about 190x slower than arrays: the store's own reads and writes, about 11.5 µs per moving grain. Pushing beats polling only while under about 0.15% (pixels) to 5% (sprites) of grains change per frame | 7 |
| 8 | Next experiments | Proposed | 8 |

---

## 2. The model axis

### 2.1 One interface, three implementations

`DemoModel`, the demo's top-level model, owns the tank's fixed timestep,
pouring, the flip and saving. By convention every demo now has a top-level
`DemoModel`, and this one sets the standard. It steps a `GrainGrid`, which
has three implementations, in `models/grain-grid/` (the third, `store`, is
section 7's):

| Storage | File | Layout |
| --- | --- | --- |
| `objects` | `object-grain-grid.ts` | The original grid: a record per grain (`col`, `row`, `kind`, `fallSpeed`, ...), a pool of them allocated up front, the moving grains as an array of records |
| `arrays` | `array-grain-grid.ts` | One typed array per field, indexed by grain id (`Int32Array` columns and rows, `Uint8Array` kinds, `Float64Array` fall speeds, ...), the moving grains as an `Int32Array` of ids |
| `store` | `store-grain-grid.ts` | A SolidJS store holding records per grain and the board of cells, read and written through the store, so reads are tracked |

The rules are the same line for line; only how the state is held differs,
so the experiment varies one thing. The tests run every grid test against
all three, and check that they produce identical snapshots after 300 busy steps
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

Chrome, Vite dev server, one variant per page load, chosen in the URL
(sections 3.1, 6.2), each tank poured to about 115,000-120,000 grains in the
large tank, about 3,900 of them still trickling off the ledges. CPU is
main-thread task time per frame, from `Performance.getMetrics`, so it
includes Pixi's render. Flipping is the mean over three windows of 1.5 s,
starting 0.7 s after each flip. Measured on the code as merged with `main`.

| Model, view | Settled: CPU / fps | Flipping: CPU / fps | JS heap |
| --- | --- | --- | --- |
| objects, sprites | 18.3 ms / 55 | 59 ms / 18 | 240 MB |
| arrays, sprites | 16.8 ms / 60 | 44 ms / 23 | 224 MB |
| objects, pixels | 3.6 ms / 60 | 11 ms / 60 | 23 MB |
| arrays, pixels | 3.0 ms / 60 | 9 ms / 60 | 9 MB |

- **At rest, the view is the cost.** Pixels are 5-6x cheaper than sprites;
  the model's layout makes little difference to a sleeping tank.
- **Moving, both matter.** Arrays cut the flipping frame by 1.3x under
  sprites and 1.2x under pixels. Together, 6.5x.
- **Memory follows the view.** About 1.8 KB per grain for the sprite view.
  The objects grid preallocates a record per cell, about 14 MB at 246,240
  cells (the objects-pixels heap, less the arrays-pixels one).

An earlier run, before the merge and with the choice made by switches in a
running page, read higher for flipping (83 ms for objects and sprites) and
for the pixel views' heaps (81 and 65 MB). Those pages had first built the
default sprite view, which stayed alive after the switch.

## 5. Headless

`npm run bench -- falling-sand-scaling`, one variant per process, three
processes per case, no rendering. Up to 20,000 grains in the small tank,
above that in the large one. Full tables in
[`falling-sand-scaling.md`](../../benchmarks/results/falling-sand-scaling.md).

Total µs per frame (model, update pass and refresh pass):

| Grains | Settled: objects, sprites | Settled: arrays, pixels | Flipping: objects, sprites | Flipping: arrays, sprites | Flipping: objects, pixels | Flipping: arrays, pixels |
| --- | --- | --- | --- | --- | --- | --- |
| 10,000 | 747 | 49 | 1,670 | 1,600 | 816 | 756 |
| 50,000 | 7,780 | 337 | 14,800 | 13,400 | 4,830 | 3,820 |
| 200,000 | 30,900 | 893 | 45,400 | 35,700 | 9,600 | 5,780 |

The model alone, flipping (µs per frame; 63,000 grains moving at 200,000):

| Grains | objects (with sprites) | arrays (with sprites) | objects (with pixels) | arrays (with pixels) |
| --- | --- | --- | --- | --- |
| 10,000 | 780 | 686 | 746 | 690 |
| 50,000 | 5,880 | 4,410 | 4,410 | 3,510 |
| 200,000 | 11,700 | 6,170 | 7,940 | 4,860 |

- **The view is where scale bites.** Settled, the sprite view's refresh
  costs 47 ns per grain at 1,000 grains and 155 at 200,000; the pixel view's
  4.4-8 ns, falling as the grain count grows. At 200,000 grains, 31 ms
  against under 1 ms.
- **The model's layout helps less than hoped.** Beside the pixel view,
  arrays are about 1.1x faster than objects up to 20,000 grains, 1.26x at
  50,000 and 1.6x at 200,000. The simulation's cost is mostly its rules:
  unpredictable branches and neighbour scans, which 013 section 4.2
  predicted would cost the same in any layout. The hypothesis that typed
  arrays would be "much faster at scale" does not hold for the model on its
  own; see section 8 for an algorithm change that might.
- **The objects model suffers from the sprite view's heap.** Beside 200,000
  sprites the objects model costs 11.7 ms, against 7.9 ms beside the pixel
  view; the arrays model 6.2 against 4.9. Records scattered through a large
  heap, among the sprites and their closures, lose more to cache misses and
  garbage collection than a few flat arrays do. So the layout gain is
  largest exactly where the object-heavy view is (1.9x at 200,000 grains),
  which is why the browser figures in section 4, where the heap is largest,
  show more.
- **Together**, arrays and pixels are 35x cheaper than objects and sprites
  at 200,000 settled grains, and 8x while flipping, when the model
  dominates.

These figures are from the suite's third run, on the code as merged with
`main`. The earlier runs gave the same picture within noise.

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

Where an accessor is needed, adding it with `Object.defineProperty` to an
object literal without one keeps the object fast (`%HasFastProperties` is
true). The store grid does this for its tracked `length` (7.1).

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

## 7. The SolidJS variant

### 7.1 What was built

- **A store model** (`models/grain-grid/store-grain-grid.ts`), written as a
  SolidJS developer would write it: the grains and the board of cells in
  one `createStore`, read through the store and written with its path
  setter, bulk changes (a half turn) with `produce`. Only the simulation's
  own bookkeeping, which nothing presents, stays in plain arrays: the order
  it visits moving grains in, and the free ids. Both are part of the rules,
  and keep the three storages identical, step for step (tested).
- **Tracked reads through the same interface.** The store's `Grains` reads
  through the store, so a Solid effect that calls `grains.colOf(id)`
  subscribes to that grain. `length` is a tracked accessor, added with
  `defineProperty` so the object stays in fast mode (6.1). `at(id)` does not
  read the id bound, so that effects checking one grain do not all re-run
  whenever the highest id changes.
- **SolidJS views** (`views/solid-grain-sprites-view.ts`,
  `views/solid-grain-pixels-view.ts`). Sprites: pixi-solid, an `<Index>`
  over the grain ids, a `<Sprite>` per grain with getter props. Pixels: an
  effect per grain id that erases the grain's old pixel and writes its new
  one, the texture uploaded in the refresh pass only on frames when a pixel
  changed. Each is built in its own Solid root, inside an ordinary Pixi
  container, and disposed with it. The tests check both draw exactly what
  the polled views draw, frame by frame, through pouring and a flip.
- **Views follow the model.** A store gets the Solid views, the other
  storages the polled ones: a store is only worth having if something
  subscribes to it, and the Solid views only update from tracked reads. The
  benchmark adds one diagnostic the demo does not offer, a store drawn by
  the polled views, to measure the store alone.
- **One batch per frame.** `GrainGrid` gained `batch(edits)`; `DemoModel`
  makes each update's changes inside it. For a store it is Solid's `batch`,
  so effects run once, after the whole step. For the others it just calls
  `edits`.
- **No JSX compiler.** The Solid views call pixi-solid's components as
  Solid's compiler would compile JSX: `createComponent(Sprite, { get x()
  { ... } })` for `<Sprite x={...} />`. The runtime cost is the same, and the
  build is unchanged.
- **Tooling.** Vitest and the benchmark bundler both load Solid's browser
  build (Node would pick its server build, where effects never run), and
  one copy of it for pixi-solid and our code alike: a test alias in
  `vite.config.ts`, and a small esbuild plugin in the benchmark driver.

### 7.2 Where the effects run

The model makes its changes in one Solid batch, so the Solid views' effects
run at the end of `update()`, inside the model's update, not in the refresh
pass. With a store, the model is in effect pushing to its views: a reactive
architecture, which is what this variant exists to compare with MVT's
polling. It keeps MVT's guarantee that no view sees a half-updated world,
since the batch ends only after the whole step. In the benchmark, the
effects' cost shows in the model column.

### 7.3 What it costs

Headless, total µs per frame; the store at up to 20,000 grains, since it
steps too slowly to fill larger tanks in reasonable time:

| Grains | Scenario | arrays, pixels | objects, sprites | store, Solid pixels | store, Solid sprites | store, polled pixels |
| --- | --- | --- | --- | --- | --- | --- |
| 1,000 | settled | 8.7 | 48 | 4.5 | 4.2 | 1,340 |
| 20,000 | settled | 90 | 2,810 | 4.4 | 3.9 | 27,900 |
| 1,000 | flipping | 57 | 91 | 6,220 | 6,410 | 7,500 |
| 20,000 | flipping | 979 | 4,510 | 185,000 | 213,000 | 177,000 |

The store's rows measure fewer frames (two flip cycles, against ten), so
their average count of moving grains differs a little from the others'
(12,900 against 14,300 at 20,000 grains). That is the measurement window,
not the simulation, which the tests show to be identical.

- **At rest, pushing wins by orders of magnitude.** A settled store with
  Solid views costs about 4 µs a frame at any grain count: nothing is
  polled, and no effect runs. The polled views pay for every grain every
  frame: 90 µs for arrays and pixels at 20,000 grains, 2.8 ms for objects
  and sprites.
- **Moving, the store is the cost.** With the polled views, so no effects
  run, the store model takes about 11.5 µs per moving grain, against about
  61 ns for arrays: roughly 190x. The effects add about 3-4 µs per changed
  grain on top (the difference between the Solid and the polled-store
  rows).
- **Polling a store is slow too.** A polled view reading through the store
  costs 1,400-1,650 ns per grain per frame, against 5 ns (pixels) and 143 ns
  (sprites) for arrays.
- **In the browser**, with Vite's development build of Solid: at about
  5,000 grains a settled store holds 60 fps, and a flip drops it to about
  6 fps. Pouring into the large tank (about 32,000 grains) costs about
  90 ms a frame with Solid pixels and 210 ms with Solid sprites, and the
  Solid sprite view's heap is about 357 MB, about 11 KB per grain, several
  times the polled sprite view's.

### 7.4 Why the store is slow

Timed in isolation, in Vitest with Solid's production build: a read through
the store costs about 300-360 ns, against 1.9 ns for a plain array; a path
write `setState('cells', i, value)` about 250 ns, and a merge
`setState('grains', id, { col, row })` about 1 µs. The rules make roughly
40 store operations per moving grain, which accounts for the 11.5 µs.
Solid's store proxy appears to look each property up with
`getOwnPropertyDescriptor` on every untracked read, which is likely most of
the read cost; this was read from its source, not profiled. Setting a store
value to `undefined` deletes the key, leaving holes in the board; that
turned out not to matter (reads after deletes were slightly faster).

A Solid developer who knew this could read the raw state in the
simulation's hot loop (`unwrap`) and keep the store for what views read.
That would be a fourth variant, not the idiomatic one measured here.

### 7.5 The crossover

Pushing a change through a Solid effect costs about 3 µs; polling costs
about 5 ns a grain for the pixel view and 143 ns for the sprite view. So,
leaving the store's own slowness aside, pushing wins while fewer than about
0.15% of grains change per frame against the pixel view, and about 5%
against the sprite view. The sprite figure agrees with 013 section 5's
estimate of 4-10%. A settled tank is far below both; a flipping one, with
90% of grains moving, far above.

### 7.6 pixi-solid at scale

pixi-solid binds a container's children with one effect. Whenever the
children change, it re-adds every child with `addChildAt(child, i)`, and
checks each previous child against the new list with `includes`: both O(n)
per child, O(n²) per change. Settled or flipping, the grain list does not
change and this costs nothing; while pouring, the list grows most frames.
At about 32,000 sprites, pouring was about 120 ms a frame slower with Solid
sprites than with Solid pixels, and the reconciliation is likely much of
that, though the sprites' own effects contribute too. That is how
pixi-solid is meant to be used, so it is measured as it is, not worked
around.

## 8. Next experiments

| Experiment | What it settles | Effort |
| --- | --- | --- |
| Audit per-item models for getter literals (6.1), and measure the sprite view with plain-field models | How much of the "faithful" refresh cost is dictionary-mode objects rather than the design | Small |
| A store variant that reads raw state (`unwrap`) in the simulation's hot loop | How much of the store's cost an expert Solid developer would avoid, and what is left for the notifications | Small |
| A change feed in the model interface (ids changed in the last update), used by the polled pixel view | Change-driven updates without a reactive library, on the same model | Medium |
| A bulk-read or read-only-arrays path in `Grains` for the pixel view | Whether the rest of 013's 1.5-4 ns per grain is reachable, and what it costs the interface | Small |
| An arrays grid that scans cells, not a moving list | 013's "chunked scan" estimate of 5-20 ns per active cell; a new algorithm, not a new layout | Medium |
| An instanced-mesh grain view from a `Float32Array` | The per-entity flat view 013 described, for cases a texture does not fit | Medium |

## 9. Open questions

None outstanding.

Settled 2026-09-27:

- The view follows the model: a store gets the Solid views, the others the
  polled views (7.1). A store with polled views is a benchmark diagnostic
  only.
- `save()`/`load()` stay on `DemoModel`. The tests use them to prove the
  three storages equivalent.
- `notes/README.md` lists 018-020.
- No Solid compiler (7.1).
