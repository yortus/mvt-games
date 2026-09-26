# 013 - Does the MVT architecture limit game performance?

> MVT is a language- and runtime-agnostic game programming *architecture*.
> This repo also contains one *implementation* of it: TypeScript on V8, with
> Pixi.js, a JSX runtime and an object per game object. To what extent, if
> any, does the MVT *architecture* block or tax game performance, at game and
> scene complexities all the way up to AAA scale?

**Status:** analysis. An estimate, not a measurement, except where marked.
Written 2026-09-26.

**Related:** [MVT Architecture](../docs/architecture/index.md),
[Architecture Rules](../docs/architecture/rules.md),
[012 - Performance findings from the falling-sand demo](./012-falling-sand-performance-findings.md),
[Performance Measurements](../docs/building-with-mvt/performance/measurements.md).

---

## 1. Short answer

The architecture does not block high performance. It imposes one inherent
cost: every frame, views re-read all the state they present, whether or not it
changed. Done with data laid out for it, that cost is about 1 ns per presented
item on one core, limited by memory bandwidth, or 1-2 ms per million items. It
can be spread across cores and skipped for hidden parts of a scene. Production
engines pay a similar per-frame copy between their simulation and their
renderer.

Nearly all the cost measured in this repo comes from the implementation, not
the architecture. For the falling-sand demo's view, at 10,000 grains:

| Step | Refresh cost per grain | Factor |
| --- | --- | --- |
| This repo today (TypeScript, V8, Pixi, an object per grain) | 78 ns (measured) | |
| Same design in C, C++ or Rust | about 15 ns (estimated) | about 5x from the language and runtime |
| Compiled, with the view's data in flat arrays and one instanced draw | about 0.6 ns (estimated) | about 25x from the data layout |
| TypeScript with that same flat layout | about 1.5-4 ns (estimated) | recovers about 95% of the gap |

So the largest gain available is a data layout change that TypeScript can
make too.

---

## 2. Where the numbers come from

| Kind | Source | Confidence |
| --- | --- | --- |
| Measured | This repo's benchmarks and profiles of the falling-sand demo, recorded in [012](./012-falling-sand-performance-findings.md): Intel Core Ultra 9 185H, headless V8 for the refresh pass, Chrome profiles for rendering | High, at 1,000-20,000 grains |
| Estimated | An analysis by an AI agent, given those measurements and asked to estimate compiled ports from runtime characteristics. Not verified by building anything | Stated per figure below; mostly low to medium |
| Reasoned | This proposal's reading of the architecture spec, and section 6 on AAA scale | Unmeasured |

Treat every estimated figure as a hypothesis to test. Section 8 lists the
measurements that would test the most important ones.

---

## 3. What the architecture requires, and what it does not

From [Architecture Rules](../docs/architecture/rules.md) and
[Views](../docs/architecture/views.md):

| MVT requires | Performance consequence |
| --- | --- |
| Models advance only through `update(deltaMs)`; no wall-clock time | None. It suits fixed timesteps, replays and rollback |
| `refresh()` runs once per frame, after every model has updated (V-refresh) | A fixed order within a frame; see section 6 on threads |
| Views re-read the state they present every frame, never caching it (V-reactive) | **The one inherent cost:** O(presented state) per frame, not O(changed state) |
| `refresh()` does not mutate models (V-readonly) | Makes the refresh pass safe to run in parallel |

| MVT does not require | This repo chose it |
| --- | --- |
| One view object per game object | Yes: one Pixi sprite per grain |
| View trees that mirror model trees (V-tree says they need not) | Largely |
| A scene graph, or any particular output (V-output) | Yes: Pixi's scene graph |
| Reading state through a function call per property | Yes: a getter per JSX prop, polled through generated closures |
| A particular language or runtime | TypeScript on V8 |

One view can legitimately present a million grains by reading the model's
arrays and writing an instance buffer. That view is as much MVT as a sprite per
grain.

---

## 4. The estimate

### 4.1 Frame time

Milliseconds per frame, all grains settled / about 75% moving. "Faithful" keeps
this repo's design (an object per grain, refreshed through an indirect call);
"flat" keeps the MVT split but stores view state in contiguous arrays and draws
with one instanced call. 100k and 1M grains need a larger grid than the
demo's.

| Grains | TypeScript today | Compiled, faithful | Compiled, flat | TypeScript, flat |
| --- | --- | --- | --- | --- |
| 1,000 | 0.1 / 0.6 | under 0.05 / 0.1-0.15 | about 0.01 / 0.05-0.1 | 0.02 / 0.15 |
| 10,000 | 1.3 / 5.6 | 0.15-0.3 / 0.7-1.3 | 0.05 / 0.4-0.8 | 0.1 / 1-1.5 |
| 100,000 | 20-30 / 75-100 | 3-6 / 10-20 | 0.3-0.8 / 4-8 | 0.5-1 / 9-13 |
| 1,000,000 | 250+, likely out of memory | 35-70 / 100-200 | 2-6 / 40-80 | 4-8 / 90-130 |
| Runs out of a 60fps frame at | about 60-90k / 20-30k | about 300-500k / 80-150k | about 3-8M / 150-350k | about 2-4M / 100-150k |

Confidence: the TypeScript figures at 1,000 and 10,000 grains are measured
(the 10,000 "moving" figure combines headless and in-browser measurements,
so read it as indicative). TypeScript beyond 20,000 grains is extrapolated
(low to medium). The flat designs' refresh figures rest on general knowledge of
streaming loops (medium). The faithful compiled port and all compiled render
figures are low to medium.

### 4.2 By part of the frame

| Part | TypeScript today | Compiled | Why |
| --- | --- | --- | --- |
| Model step | 110-160 ns per moving grain (measured) | 40-100 ns | Unpredictable branches and neighbour scans cost the same in any language; V8 already compiles this code well. Only a different algorithm, such as a chunked scan of the grid, changes much (about 5-20 ns per active cell) |
| Update pass | A few µs | A few µs | Almost nothing has presentation state |
| Refresh pass, faithful | 47 / 78 / 145 ns per grain at 1k / 10k / 20k (measured) | 6-12 ns in cache, 25-50 ns beyond it | Five to seven indirect calls per grain, each well predicted. The native port drops V8's type checks, and each grain's view shrinks from about 2.5 KB to 300-600 bytes, so it stays in cache several times longer |
| Refresh pass, flat | not built | 0.3-1 ns per grain; 1-2 ms at 1M, memory-bandwidth bound | Reads 5-8 bytes and writes 8-12 bytes per grain, in order, vectorisable |
| Render, CPU side | 0.5 ms at rest, about 380 ns per changed sprite (measured) | faithful: 15-40 ns per changed sprite (low confidence); flat: one draw call plus the upload | At 1M grains the upload is 8-12 MB per frame |
| GPU | Negligible | Negligible until about 1M grains | Tiny quads waste GPU shading work; beyond a few million grains, drawing the grid as a texture costs per pixel instead of per grain |
| Memory | About 2.5 KB per grain; about 2.5 GB at 1M, near V8's heap limit | Flat: 20-30 bytes per grain | Steady-state allocation is already zero, so garbage collection is not a per-frame cost here; heap size is |

### 4.3 What the language contributes, and what the design contributes

At 10,000 settled grains the view costs 78 ns per grain today:

- **About 5x comes from the language and runtime.** V8's shape checks and
  closures, and the size of a JavaScript object per grain, take it to about 15
  ns in a compiled faithful port.
- **About 25x comes from the design.** Dropping the object per grain, the
  closure per prop and the general-purpose scene graph takes it to about 0.6 ns.
- **TypeScript can take most of the second step.** A flat-array view in
  TypeScript runs at an estimated 1.5-4 ns per grain. The remaining gap is
  vectorisation and bounds checks, small in absolute terms. It needs a custom
  instanced mesh fed from a `Float32Array`: Pixi 8's `ParticleContainer`
  still keeps an object per particle (an estimated 5-15 ns).

With most grains moving, the model dominates every design, and the language
matters less (1.5-3x).

---

## 5. The inherent cost, and how large it can get

MVT's views re-read everything they present, every frame. The alternative is
change-driven updates: pay only for what changed, plus a notification cost per
change. This repo's benchmarks measured that trade in TypeScript: signals win
when fewer than about 4-10% of containers change per frame, and cost 7-13
times as much when everything changes (see
[Performance Measurements](../docs/building-with-mvt/performance/measurements.md)).
With flat data the polling side gets much cheaper, about 1 ns per item, while a
change notification still costs several nanoseconds or more, so the point where
change-driven updates win moves lower still.

How large the cost gets (reasoned from the estimate):

| Presented items | Re-read cost per frame, flat data | Share of a 16.7 ms frame |
| --- | --- | --- |
| 10,000 | about 0.01 ms | negligible |
| 100,000 | 0.1-0.3 ms | about 1-2% |
| 1,000,000 | 1-2 ms on one core; less split across cores | about 6-12% on one core |

Three things keep it bounded without leaving the architecture:

- **Skipping what is not presented.** Hidden or culled parts of a scene need no
  refresh (this repo's `SKIP_DESCENDANTS`).
- **Running it in parallel.** `refresh()` only reads models (V-readonly), so
  independent views can refresh on separate threads.
- **Skipping unchanged output.** Change detection inside a view (this repo's
  `watch()`) skips expensive writes, though not the reads.

---

## 6. At AAA scale (reasoned, not measured)

### 6.1 Production engines already have this shape

Large engines commonly keep simulation state apart from what the renderer
reads, and copy the renderer's view of it every frame. Unreal's game thread
updates per-primitive render proxies that its render thread consumes; Bevy's
Extract stage copies data from its main world into a separate render world each
frame. That per-frame copy is the same kind of O(presented state) work as MVT's
refresh pass. MVT's inherent cost is one these engines already accept.

### 6.2 Where the architecture is silent

MVT as specified says nothing about these, which means it neither provides nor
forbids them:

| Concern | Status under MVT |
| --- | --- |
| Multithreading within a frame | Compatible: models may parallelise their own `update()`, and views are read-only during refresh |
| Overlapping frames (render one frame while simulating the next) | Compatible only if views read a snapshot of model state, since V-refresh forbids a view seeing a half-updated world. The snapshot is another copy per frame, the one production engines make |
| Streaming, level of detail, culling | Not addressed; all are presentation or model concerns that fit inside the existing layers |
| GPU-driven simulation (particles, cloth, foliage) | Fits as view-owned presentation state (V-presentation) when it is cosmetic. Gameplay-relevant simulation on the GPU would sit awkwardly, since models must own domain state |

### 6.3 Answer to the thesis

Within the limits of an estimate: the MVT architecture does not block
performance at any scale considered here. Its one inherent tax, re-reading
presented state every frame, is about 1-2 ms per million presented items per
core with flat data, can be split across cores, and matches a copy that
production engines already make. The performance ceilings measured in this
repo belong to the implementation: the language, an object per game object, a
closure per prop, and a general-purpose scene graph. The first costs about 5x;
the rest about 25x, most of which TypeScript can recover.

The open risk is gameplay state that lives on the GPU, which MVT's
model-owns-state rule does not accommodate directly.

---

## 7. Caveats

- **A faithful compiled port could gain only 1.5-2x** once the scene no longer
  fits in cache, if it copies Pixi's separately allocated objects, uses
  reference-counted handles in getters, or fragments its heap. V8's compacting
  collector can give better memory locality than a fragmented native heap.
- **Compiled to WebAssembly for the browser**, indirect calls are checked
  (`call_indirect`), costing about 1.2-2x, and rendering still goes through the
  browser's WebGL or WebGPU validation. A single instanced draw is unaffected.
- **The 10k-to-20k step in the measurements (78 to 145 ns per grain) is one data
  point.** If it comes from TLB misses rather than cache misses, native code
  with large pages gains more than estimated; if it is something Pixi-specific,
  the TypeScript extrapolation to 100k and 1M is off.
- **Headless V8 refresh figures may differ in a browser**, where heap state and
  concurrent garbage collection differ.
- **A 1M-grain grid** makes the occupancy array about 4 MB, beyond L2, raising
  model cost in every design, though neighbour access stays within a row.
- **The compiled render-CPU figures are the least grounded here.** Profiling a
  native sprite batcher would firm them up.

---

## 8. What would test this

| Test | What it settles | Effort |
| --- | --- | --- |
| Measure the TypeScript view at 40-50k grains | Whether the extrapolation to 100k and 1M holds (section 4.1's weakest TypeScript figures) | Small: a larger grid in the `falling-sand-scaling` benchmark suite |
| Prototype a flat-array view in TypeScript: read the model's arrays, write a `Float32Array`, draw one instanced mesh | The central claim that most of the cost is design, not language or architecture (estimated 1.5-4 ns per grain) | Medium: a custom Pixi mesh and shader |
| Implement [012](./012-falling-sand-performance-findings.md) section 2 (cached methods in the pass loop) | How much of the faithful design's cost is recoverable without changing the design | Small to medium; prototype already measured |
| Profile a native sprite batcher, or port the view to Rust or C++ | The compiled estimates in sections 4.1 and 4.2 | Large |

---

## 9. Open items

| Item | Section | Status |
| --- | --- | --- |
| Measure the TypeScript view at 40-50k grains | 8 | Proposed |
| Prototype a flat-array, instanced view of the grains in TypeScript | 8 | Proposed |
| Decide how MVT should treat gameplay-relevant state that lives on the GPU | 6.2 | Open question |
