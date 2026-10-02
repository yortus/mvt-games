# Falling Sand

An aquarium of sand, water and walls. Tap, hold and drag in the tank to pour
the selected material, draw walls or erase. Flip turns the tank upside down;
Reset restores the opening scene.

It is also a stress test for the MVT game loop, and a lab for comparing
implementations of it. It runs with one of three implementations of its
model (a record per grain, a typed array per field, or a SolidJS store), one
of two views of its grains (a sprite per grain, or a pixel per cell), and one
of three tank sizes, up to 246,240 cells, all fixed for the demo's life and
chosen in the page's URL
(`/demos/?storage=arrays&view=pixels&tank=large#falling-sand`). A store is
drawn by SolidJS versions of the views, which are pushed changes rather than
polling; the others are polled, as MVT views are. The switches
under the buttons show the running choice; pressing one reloads the page with
another. The panel under the tank shows the grain count,
how many grains are moving, and frame timing: frames per second, CPU and GPU
milliseconds per frame, and `RPF`, the reads of the model the view makes per
frame (the pixel view counts its own reads the way the JSX runtime counts the
sprite view's, so the two compare). Below those, `MPF` is the update and
refresh methods the scene passes call per frame, and `WPF` and `NPF` are the
memoised walks they rebuild per frame and the nodes they visit doing it: the
scene's churn, zero while the tank's grains stay put.
`npm run bench -- falling-sand-scaling` measures every combination headless,
from 1,000 to 200,000 grains; the demo as it ships is in the
`games-and-demos` suite.

## What it shows

**The simulation pays for moving grains; the refresh scene pass pays for all
of them.** A grain that cannot move for a couple of steps falls asleep, and the
simulation stops visiting it until a neighbouring cell empties. A settled
pile of thousands of grains costs the model almost nothing. The view is
different. With the sprite view, each grain's sprite has three bindings:

```tsx
<List items={readGrains}>
    {(_item, id) => (
        <sprite
            texture={Texture.WHITE}
            width={1}
            height={1}
            x={() => grains.colOf(id)}
            y={() => grains.rowOf(id)}
            tint={() => pickGrainTint(grains.kindOf(id), id)}
        />
    )}
</List>
```

The refresh scene pass runs them for every grain, every frame, asleep or not. Pour
until the tank is deep, then compare the grain count with the moving count
and watch the CPU time follow the first. Flip the tank to wake every grain at
once.

All the sprites share one texture and differ only by tint, so Pixi draws the
whole tank in a few batches. The limit you reach is CPU time, not GPU time.

**One model interface, three implementations.** The tank stores its grains
one of three ways, chosen by `storage` when it is created:

- **Objects**: a record per grain, as most JavaScript code would write it
  ([`object-grain-grid.ts`](./models/grain-grid/object-grain-grid.ts)).
- **Arrays**: one typed array per field, indexed by grain id, as an
  entity-component system would lay it out
  ([`array-grain-grid.ts`](./models/grain-grid/array-grain-grid.ts)).
- **Store**: a SolidJS `createStore`, as a Solid developer would write it,
  with the grains and the board of cells in the store, read through it and
  written with its setter ([`store-grain-grid.ts`](./models/grain-grid/store-grain-grid.ts)).

All three follow the same rules, line for line, and behave identically, step
for step: the tests drive one of each the same way and compare their
`save()` snapshots. All serve the same `Grains` interface, which reads a
grain's fields by its id (`grains.colOf(id)`) rather than through an object
per grain, so that the arrays can serve reads without creating objects.
Nothing that reads the model can tell them apart, except by timing them, and
except that the store's reads are tracked: a SolidJS effect that reads a
grain through `Grains` subscribes to it.

**Two views of the same grains, polled or pushed.** The grains are drawn as
a sprite per grain, or as one texture with a pixel per cell, chosen when the
view is built. The objects and arrays models get MVT views, which read every
grain every frame ([`grain-sprites-view.tsx`](./views/grain-sprites-view.tsx),
[`grain-pixels-view.ts`](./views/grain-pixels-view.ts)). A store gets SolidJS
views, whose effects re-run only for the grains that changed
([`solid-grain-sprites-view.ts`](./views/solid-grain-sprites-view.ts), with
pixi-solid, and [`solid-grain-pixels-view.ts`](./views/solid-grain-pixels-view.ts)).
The choice of view is the view's, not the model's: `DemoView` takes it as a
binding, and picks the Solid views for a store.

The pixi-solid view is written without Solid's JSX compiler, as exactly the
calls the compiler makes from the JSX a Solid developer would write:
`createComponent(Sprite, { get x() { ... } })` for `<Sprite x={...} />`.
Its doc comment shows that JSX, and the code was checked against the
compiler's output. So it runs exactly as the JSX would, and the repo needs
neither Solid's compiler nor the Babel toolchain it runs on.

**Pushing moves view work into the model's update.** The model makes each
frame's changes in one Solid `batch`, so the Solid views' effects run once,
at the end of `update()`, and never see a half-stepped tank. That is when
they run, though: inside the model's update, not in the refresh scene pass. With a
store, the model is in effect pushing to its views, which is the reactive
architecture this variant exists to compare with MVT's polling.

**Why the choice needs a new page.** V8 inlines a call only while the call
site has seen one function there. If a page switched implementations while
running, the views' calls through `Grains` would have seen both
implementations' functions and stop being inlined, and whichever ran second
would look slower than it is. Measured that way, arrays with sprites came out
slower than objects with sprites; each in a fresh page, it is faster. So the
choice is fixed for the demo's life, and read from the URL
([`variants.ts`](./variants.ts)).

**What the variants cost.** In Chrome, with about 115,000 grains in the
large tank, one variant per page load:

| Model, view | CPU per frame, settled | CPU per frame, grains falling after a flip | JS heap |
| --- | --- | --- | --- |
| objects, sprites | 18.3 ms | about 59 ms | 240 MB |
| arrays, sprites | 16.8 ms | about 44 ms | 224 MB |
| objects, pixels | 3.6 ms | about 11 ms | 23 MB |
| arrays, pixels | 3.0 ms | about 9 ms | 9 MB |

Settled, the view is nearly all the cost, and the model's layout hardly
matters. With grains falling, the model's layout matters too, though less
than the view: headless, typed arrays make the model 1.1-1.6x faster, and
1.9x beside the sprite view's large heap. The headless suite breaks each
frame down into model and refresh.

**What the store costs.** Headless, at 20,000 grains:

| Model, view | Settled, per frame | Flipping, per frame |
| --- | --- | --- |
| objects, sprites (polled) | 1.9 ms | 3.3 ms |
| arrays, pixels (polled) | 90 µs | 1.0 ms |
| store, Solid pixels (pushed) | 4 µs | 185 ms |
| store, Solid sprites (pushed) | 4 µs | 213 ms |

At rest, pushing wins by orders of magnitude: nothing is polled and no
effect runs, whatever the grain count. Moving, the store loses by about as
much, and not because of the pushing: the store's own reads and writes cost
about 300 ns to 1 µs each, against a couple of nanoseconds for a plain
array, and the rules make about 40 of them per moving grain. Solid's
effects add a few microseconds per changed grain on top. Leaving the store
aside, a pushed change costs about 3 µs against a few nanoseconds (pixels)
or about 90 ns (sprites) to poll a grain, so pushing wins only while fewer
than about 0.15% or 3% of grains change per frame. See
[020](../../../notes/archive/020-falling-sand-variants.md), section 7.

**`Grains.length` is a field, not a getter.** V8 keeps an object literal
that has a getter in slow dictionary mode, and cannot inline calls through
it. With `get length()` on `Grains`, as the grid first had it, every
`grains.at(id)` and `grains.colOf(id)` in the views was an uninlined lookup:
the pixel view's loop cost about 24 ns per grain, timed on its own; with a
plain field, about 8, and 4.5 in the benchmark.

**Three things that cost more than the bindings did.** Measured with 10,000
grains, before each fix:

- **Text beside the grains rebuilt their batches.** Pixi rebuilds a render
  group's draw batches whenever text or graphics in it change, and the
  moving count changes most frames. With everything in one group, that
  rebuilt all 10,000 sprites' batches every frame: about 5 ms. The tank is
  now its own render group (`isRenderGroup`), and Pixi's render at rest
  dropped to about 0.5 ms.
- **`tint` parsed its colour on every write.** Pixi's setter does, even for
  an unchanged value, so the JSX runtime now writes `tint` only when it
  changes, as it does `text` and `texture`. The refresh scene pass dropped from
  about 2.2 ms to 0.9 ms.
- **`toLocaleString` built a number formatter on every call**, tens of
  microseconds each time. The counts now share one `Intl.NumberFormat`.

**An index-addressed list with a pool behind it.** Each grid allocates its
storage up front, one grain's worth per cell, and hands out ids from a free
list. `grains` is shaped like a read-only array indexed by id, which `<List>`
projects directly: a grain keeps its id, and so its sprite, for its whole
life, and a removed grain's slot hides and skips its bindings. Adding and
removing grains allocates nothing. When the highest ids free up (after Clear,
say), `<List>` detaches their now-unused slots, so a tank that once held
20,000 grains does not keep paying to refresh them.

**A fixed timestep.** The model advances in steps of 1/60 s, however often
`update()` is called, and runs at most four steps per update so a stalled
frame does not snowball. Pouring happens inside the step too, so the amount
poured does not depend on the frame rate. A seeded random number generator
makes every run repeatable, which the tests rely on.

**Input in domain units.** The tank converts pointer positions to cells,
through the tank's rotation, before calling `startPour`, `movePour` and
`endPour`. The model never sees a pixel.

**The flip is split between model and view.** The model owns what the flip
means: a phase, and progress from 0 to 1 over half a second, during which the
grains hold still. When it completes, the model moves every grain to the
opposite cell. The view owns how it looks: it turns the progress into an
eased angle, and shrinks the tank as it turns so its corners stay inside its
upright outline. The flip's last frame shows the tank all but upside down,
and the next shows the grains upside down in an upright tank, so the picture
does not jump.

## Rules

- **Sand** falls, slides diagonally down off anything below it, and sinks
  through water by swapping places with it.
- **Water** falls, slides diagonally, and flows sideways up to four cells per
  step, keeping its direction until blocked, so a surface levels out.
- **Walls** never move and are never visited.
- Falling grains speed up each step, checking every cell they pass so they
  never go through anything.

## Files

| File | Purpose |
|------|---------|
| [`falling-sand-entry.ts`](./falling-sand-entry.ts) | Demo entry point: builds the model and view with the variants in the URL, and reloads the page when a switch asks for others |
| [`variants.ts`](./variants.ts) | The storage, grains view and tank size, read from and written to a URL's query string |
| **`models/`** | |
| [`demo-model.ts`](./models/demo-model.ts) | The demo's top-level model, `DemoModel`: the tank's fixed timestep, pouring, tools, flip, reset, and snapshots of the whole tank |
| **`models/grain-grid/`** | |
| [`grain-grid.ts`](./models/grain-grid/grain-grid.ts) | The grid's interface, `Grains`, and snapshots. Not a model: it has no notion of time, and `DemoModel` steps it. One `step()` is one tick |
| [`object-grain-grid.ts`](./models/grain-grid/object-grain-grid.ts) | The grid, with a record per grain |
| [`array-grain-grid.ts`](./models/grain-grid/array-grain-grid.ts) | The grid, with a typed array per field |
| [`store-grain-grid.ts`](./models/grain-grid/store-grain-grid.ts) | The grid, in a SolidJS store, with tracked reads |
| [`starting-scene.ts`](./models/starting-scene.ts) | The opening scene |
| [`random.ts`](./models/random.ts) | Seeded random numbers, with a state that can be saved |
| [`model-constants.ts`](./models/model-constants.ts) | The tank sizes in cells, the timestep, pouring and flipping, and the rules grains move by |
| **`views/`** | |
| [`demo-view.tsx`](./views/demo-view.tsx) | The whole demo: tank above, toolbar below |
| [`tank-view.tsx`](./views/tank-view.tsx) | Glass, pointer input, brush ring and flip rotation, and the chosen grain view |
| [`grain-sprites-view.tsx`](./views/grain-sprites-view.tsx) | The grains as a sprite per grain |
| [`grain-pixels-view.ts`](./views/grain-pixels-view.ts) | The grains as a pixel per cell in one texture |
| [`solid-grain-sprites-view.ts`](./views/solid-grain-sprites-view.ts) | The grains as a sprite per grain, with pixi-solid, updated by SolidJS effects |
| [`solid-grain-pixels-view.ts`](./views/solid-grain-pixels-view.ts) | The grains as a pixel per cell, each grain's pixel redrawn by a SolidJS effect when it changes |
| [`toolbar-view.tsx`](./views/toolbar-view.tsx) | Tool palette, Flip, Reset, Clear, the variant switches, counts and frame timing |
| [`grain-colors.ts`](./views/grain-colors.ts) | Colours by kind, with a stable shade per grain, as tints and as pixels |
| [`view-constants.ts`](./views/view-constants.ts) | Sizes and positions in pixels |

The frame timing comes from `createFrameStats` and `createPerfmonView` in
[`src/common/`](../../common/index.ts), which any demo or game can use.
