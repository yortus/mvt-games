# 012 - Performance findings from the falling-sand demo

> Building the falling-sand demo (`src/demos/falling-sand/`) turned up four
> things worth acting on outside the demo: a change to the pixi-mvt pass loop
> that makes mixed scenes 30-35% cheaper to refresh, a gap in what the
> `scaling` benchmark represents, a Pixi rendering cost the docs do not
> mention, and a GPU timing figure that cannot be trusted on this repo's main
> development machine. This proposal records the evidence for each and what
> should follow. None of it is implemented.

**Status:** section 2 implemented (2026-09-28), in the generic scene-pass
core that [022](./022-renderer-agnostic-jsx.md) phase 2 made of pixi-mvt's
walk; see 2.4. Sections 3-5 are still proposed. Measured 2026-09-25; written
2026-09-26.

**Related:** [`src/mvt-utils/scene-passes.ts`](../../packages/utils/src/scene-passes.ts)
(the walk, since 022 phase 2),
[`packages/benchmarks/`](../../packages/benchmarks/README.md),
[Performance Measurements](../../packages/docs/building-with-mvt/performance/measurements.md),
[Hot Paths](../../packages/docs/building-with-mvt/performance/hot-paths.md),
[`src/pixi-mvt/frame-stats.ts`](../../packages/pixi/src/frame-stats.ts),
[010 - Performance docs proposal](../archive/010-performance-docs-proposal.md).

---

## 1. Summary

| # | Item | Recommendation | Evidence |
| --- | --- | --- | --- |
| 2 | Cache each container's method in the pass loop's memoised list | Implement | Prototyped and measured; one test needs the design in section 2.3 |
| 3 | Add a mixed-scene variant to the `scaling` benchmark, and caveat its numbers | Implement | Measured; the gap to a real scene is fully accounted for |
| 4 | Document that text and graphics changes rebuild a Pixi render group | Implement | Measured in a browser profile |
| 5 | The perfmon's GPU row on NVIDIA laptop GPUs | Decide: drop it, or mark it indicative | Measured; the figure reflects the machine more than the scene |

Section 5 also records three hypotheses that were tested and ruled out, so
they are not investigated again.

### How these were measured

Unless a section says otherwise:

- **Refresh cost** was measured with the harness's `timeFrames`, one variant
  per process, bundled with esbuild exactly as the benchmark driver does (see
  [Benchmarking Methods](../../packages/docs/building-with-mvt/performance/benchmarking-methods.md)).
  Figures are nanoseconds per item, median of 3 to 12 processes, on an Intel
  Core Ultra 9 185H.
- **GPU timings** were taken in Chrome with WebGL timer queries
  (`EXT_disjoint_timer_query_webgl2`), driven by Playwright. The window was
  headed but placed off-screen, with Chrome's occlusion throttling disabled
  (`--disable-backgrounding-occluded-windows`,
  `--disable-features=CalculateNativeWinOcclusion`), so it rendered at a real
  60fps with a real compositor. `--use-angle=d3d11` selected the RTX 4070;
  adding `--force_low_power_gpu` selected the integrated Intel Arc.

The driver scripts were throwaway and are not in the repo; each section
describes its setup well enough to rebuild.

---

## 2. Cache methods in the pass loop

### 2.1 The problem

`invokeSubtreeMethods` in `scene-passes.ts` is one loop that every container
in the app goes through. For each one it reads `target.parent` and calls the
`onRefresh` (or `onUpdate`) accessor, then calls the method it returns.

V8 optimises a property read by remembering the object shapes it has seen
there. With up to four shapes it stays fast; past four (V8's default
`--max-valid-polymorphic-map-count`) the read becomes a slow generic lookup,
and V8 stops inlining the called methods into the loop. A scene of identical
containers keeps the loop fast. Any real scene mixes containers, sprites,
graphics and text, and does not.

The evidence, from `--trace-turbo-inlining` on 1,000-item scenes:

| Scene | What V8 inlined into `invokeSubtreeMethods` |
| --- | --- |
| 1,000 identical JSX containers (the `scaling` benchmark's scene) | The `onRefresh` accessor, the generated refresh method, all three getters, and Pixi's `x`, `y` and `alpha` setters |
| The same items through `<List>` | The `onRefresh` accessor only |
| The falling-sand tank's scene (sprites plus a few differently shaped containers) | Nothing |

Raising the limit with `--max-valid-polymorphic-map-count=16` brought the tank
from about 47 to 33 ns per item at 1,000 items, the same as the tank's grains
without the other shapes. The loop's own reads are the cost.

A contributing factor, inferred but not measured: the mixin writes
`_mvtHasRefresh`, `_mvtRefresh` and the method backing fields onto containers
at runtime, which gives containers extra shapes as those fields are added.

### 2.2 The prototype

Collect each container's method alongside the container when the memoised
list is built, and call it from the list:

- `SubtreeInfo` gains `methods`, filled in `collectSubtreeMethods` next to
  `list`.
- The loop calls `methods[i](deltaMs)` instead of reading the accessor. It
  still reads `target.parent` for the detached-mid-pass check.

Assigning a method already invalidates the memoised lists above the container,
so the cached methods are rebuilt whenever one changes between passes.

Measured, nanoseconds per item:

| Scene | 1,000, now | 1,000, prototype | 10,000, now | 10,000, prototype |
| --- | --- | --- | --- | --- |
| Identical JSX containers (`scaling` scene) | 8.3 | 8.3 | 14.5 | 14.5 |
| The same, plus 8 differently shaped containers | 20.5 | 12.3 | 23.6 | 15.8 |
| Falling-sand tank | 44.5 | 35 | 67 | 48 |
| Whole falling-sand view (tank and toolbar) | 51.6 | 37 | 83.5 | 53 |

No change where the loop was already fast, and 30-40% off where it was not.

### 2.3 The blocker, and a design for it

The prototype fails one test in `scene-passes.test.ts`: "skips a container
whose method is cleared earlier in the same pass". A method cleared by an
earlier container's method must not run later in the same pass, and the cached
array still holds it.

Proposed design: a module-level counter that the mixin's `onUpdate` and
`onRefresh` setters increment. The loop records it on entry and, if it has
changed, reads the method live (`target.onRefresh`) for the rest of that pass.
Steady frames pay one extra read of a single shared object per container;
frames on which methods are assigned mid-pass (a `<List>` building slots, for
example) take the slower live path, as today.

### 2.4 Next steps

1. ~~Implement the counter and the cached methods; the failing test is the
   acceptance test.~~ Done (2026-09-28), as designed in 2.3: the memoised
   list carries each node's method, and a count of method assignments sends
   the rest of a scene pass back to live reads once any method changes
   during it. The acceptance test passes. Measured against the old walk, as
   an A/B of the repo's suites (a worktree at the old code, six processes
   per side per case, in the order new, old, old, new):
   - **The falling-sand demo (`objects-sprites`) refreshes 4-27% faster** at
     every size from 1,000 to 200,000 grains, about 20% on average: 23.1
     against 30.3 ms settled at 200,000 grains, 24.1 against 33.2 ms
     flipping. The model's own time is unchanged. The prediction held.
   - **A uniform scene pays for it:** the `scene-passes` suite's `dense`
     scene (2,000 identical containers, every one with a method) is 16%
     slower, about 0.4 ns per container, since there was no megamorphic read
     to save, and `sparse` 11% (0.06 us a frame). So is `churn` (the walk
     rebuilt every frame), by 16%, from building the method array on each
     rebuild. The `scaling` suite, uniform but with bindings, came out level
     (0.98x, against 1.02x for its hand-written control).
   - **The demo's update scene pass is 1-5 us a frame slower**, in noisy
     measurements (spreads up to 160%), against milliseconds saved in
     refresh. Real scenes are mixed and rarely rebuilt, so the trade was
     taken.
   - **Found on the way:** reading a node's method through a small shared
     helper, rather than inline, stopped V8 inlining the accessor, and made
     `churn` another 25% slower. The reads are inline again.
2. Re-run the `scene-passes`, `scaling` and `falling-sand-scaling` suites and
   update the saved results.
3. Consider whether the mixin should give every container its `_mvt*` fields
   at construction, so they never change shape at runtime.

---

## 3. The `scaling` benchmark's scene is a best case

### 3.1 The gap

The `scaling` suite's saved results put 10,000 JSX containers with three
changing props at about 13 ns per container at rest. The falling-sand tank's
refresh pass cost 78-92 ns per grain at 10,000 grains, 6-7 times as much. The
gap was taken apart one change at a time, from the benchmark's scene to the
demo's:

| Step | 1,000 | 10,000 |
| --- | --- | --- |
| Benchmark scene: containers, 3 getters each, reading flat objects | 8.7 | 15.3 |
| The same, plus 8 differently shaped containers in the pass | 21.1 | 24.4 |
| Containers, getters index an array directly (no `<List>`) | 11.8 | 15.4 |
| Containers through `<List>` | 21.1 | 27.9 |
| Sprites through `<List>` | 22.7 | 42.6 |
| Sprites with the grain's position and a constant `tint` | 22.6 | 44.2 |
| ... with the grain's real colour lookup | 27.6 | 53.2 |
| ... over the real grain pool instead of an array | 32.6 | 54.9 |
| The real tank view | 46.7 | 67.0 |
| The whole falling-sand view | 46.9 | 78.0 |

At 1,000 items (everything in cache), per item:

| Cause | Cost | How it was confirmed |
| --- | --- | --- |
| A mixed scene defeats V8's optimisation of the pass loop | about +14 ns | Raising V8's shape limit removes it; section 2.1 |
| `<List>`'s per-slot wrapper and accessor | about +9 ns | `<List>` against direct array indexing |
| Per-grain work the benchmark does not do: colour lookup, the pool's presence check, comparing the watched `tint` | about +10 ns | The rows above |

At 10,000 items, memory adds to that. A tank grain costs about 2.5 KB of heap
against 1.2 KB for a benchmark container (sprite, slot wrapper, closures), and
the extra cache misses take the per-item cost from 47 to 78 ns, where the
benchmark scene goes from 9 to 15.

### 3.2 Proposal

1. Add a mixed-scene variant to the `scaling` suite: the same containers,
   with a handful of differently shaped refreshing containers in the same pass
   (8 was enough to make the loop generic). Report it next to the uniform
   figures.
2. In the "Scaling" section of
   [Performance Measurements](../../packages/docs/building-with-mvt/performance/measurements.md),
   say that the uniform figures are a best case, and that a scene of mixed
   container types costs about twice as much per container until section 2
   lands.

---

## 4. Text and graphics changes rebuild a Pixi render group

### 4.1 What happens

Pixi 8 turns each render group into a list of draw instructions and reuses it
from frame to frame. Moving a sprite updates only that sprite's data. But some
changes make Pixi rebuild the whole group's list: adding or removing a child,
changing `visible` or blend mode, and any change to a `Text`'s text or a
`Graphics`' drawing (`CanvasTextPipe.validateRenderable` and
`GraphicsPipe.validateRenderable` report the change). Rebuilding means
collecting every object in the group and repacking every sprite's vertex data.

By default the whole stage is one render group. In the falling-sand demo, the
count of moving grains is text that changes most frames, and the perfmon
updates its text and graphs four times a second. Each change rebuilt the
batches for all 10,000 grain sprites.

Measured in a Chrome CPU profile at about 10,000 grains, at rest:

| | Pixi's render | Refresh pass |
| --- | --- | --- |
| Everything in the stage's one render group | about 6 ms per frame | about 2 ms |
| The tank made its own render group (`isRenderGroup`) | about 0.5 ms per frame | about 2 ms |

A trap on the group's `structureDidChange` flag confirmed the cause: a rebuild
on 113 of 120 frames, every one from `validateRenderables`.

A render group's own transform is also applied to the whole group at once, so
moving, rotating or scaling it does not recompute each child's transform. The
cost: each group breaks batching at its boundary, so many small groups are
worse than none.

### 4.2 Proposal

The benchmarks render nothing, so this does not show up in any table. Document
it in two places:

1. [Hot Paths](../../packages/docs/building-with-mvt/performance/hot-paths.md), in the
   "Text updates in `refresh()`" example: a text change costs more than its
   own redraw, because it rebuilds its render group. Keep a large, stable
   part of the scene in its own render group, apart from text and graphics
   that change often.
2. [Performance Measurements](../../packages/docs/building-with-mvt/performance/measurements.md),
   "What Is Not Measured": rendering is excluded, and this is an example of a
   rendering cost larger than anything the tables measure.

---

## 5. GPU timing on NVIDIA laptop GPUs

The perfmon (`src/common/perfmon-view.tsx`) shows a GPU time per frame from
`createFrameStats`. On this repo's main development machine it is not a
reliable measure of the scene.

### 5.1 What the timer measures

A WebGL timer query measures time on the GPU's clock between two markers in
the command stream, not the time the GPU spent on the commands between them.
On this machine that includes things other than the scene's GPU work:

**CPU time, when the browser sends the frame's commands in parts.** A tiny
draw, then 2 ms of CPU work, inside one query:

| | RTX 4070 | Intel Arc |
| --- | --- | --- |
| Tiny draw alone | 0.025 ms | 0.10 ms |
| 2 ms of CPU work inside the query | 0.08 ms | 0.10 ms |
| The same, with a `gl.flush()` before the CPU work | **2.23 ms** | 0.28 ms |

**Other GPU work, and the driver's response to it.** The RTX 4070 drives the
display, and about 20 processes hold graphics contexts on it (the desktop
compositor, VS Code, Chrome, Steam, Armoury Crate and others).

- A busy second canvas in the same page raised the demo's readings from 0.17
  to about 0.43 ms.
- A heavy load in a separate Chrome process, switched on and off 8 times:
  just after it started, the demo's median dropped to about 0.13 ms (the GPU
  clocked up); within a couple of seconds it climbed back to 1.5-2.5 ms.
- With nothing changed, the same scene reads anywhere from 0.1 to 2.8 ms
  within one session, and a median of 0.17 ms in one session against 2.0 ms
  in another.

The same falling-grain frames read about 2.2 ms on the RTX 4070 and 0.3-0.5
ms on the much weaker Intel Arc. The NVIDIA figure is not GPU load.

### 5.2 Already done

`createFrameStats` reports the median of each window rather than the mean
(steady readings at rest, 0.2-0.3 ms), handles the disjoint flag per the
extension's spec, and documents the figure as an upper bound. Showing one bar
per frame was tried and reverted. Starting the query at the first draw
instead of at `prerender` helped only slightly (median at rest 0.16 against
0.20 ms) and would mean patching Pixi's WebGL context, so it was not adopted.

### 5.3 Decision needed

No WebGL-only method separates the scene's GPU work from the rest, as far as
this investigation found. Choose one:

1. **Drop the GPU row** from the perfmon, keeping `gpuMs` in `FrameStats` for
   code that wants it.
2. **Keep it, marked indicative**, for example by labelling it `~GPU` and
   saying in the perfmon's doc what it includes.

FPS and CPU are wall-clock measurements and are not affected.

### 5.4 Ruled out

Tested and ruled out, recorded so they are not investigated again. Each
looked like a fix in a single run; within-session comparisons against a
no-change control put all of them inside the 1.0-2.8 ms noise:

| Hypothesis | Test |
| --- | --- |
| Hidden `<List>` slots in a render group slow the GPU | Detaching them (now `<List>`'s behaviour, kept for its CPU benefit) did not lower the reading |
| The tank's render group itself | Toggled on and off in one session: no consistent difference |
| The batcher's buffers stay at their high-water size | Replacing the batcher, and recreating the group, in one session: no consistent difference |
| The perfmon text uploads | Hiding every toolbar text: no change |

The WebGL calls Pixi made were identical in the fast and slow cases, so
whatever varies is below Pixi.

### 5.5 Timing the whole tick instead

A timer query spanning the whole tick (ticker priority 100 to -100), rather
than Pixi's render, was tried in this demo and interleaved frame by frame
with the perfmon's own: the two produced identical distributions (at rest a
median of 0.15 ms, grains moving a median of 2.06 ms). Where the query
starts and ends is not the difference.

---

## 6. Open items

| Item | Section | Status |
| --- | --- | --- |
| Cached methods in the pass loop, with the mid-pass counter | 2.3, 2.4 | Proposed; prototype measured |
| Mixed-scene variant of the `scaling` suite, and its docs caveat | 3.2 | Proposed |
| Render-group rebuild note in Hot Paths and Measurements | 4.2 | Proposed |
| The perfmon's GPU row: drop, or mark indicative | 5.3 | Decision needed |
