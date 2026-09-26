# Proposal: expand the performance documentation

> Performance claims in the docs are qualitative, and the one benchmark they
> cite has a measurement flaw. This proposal records a set of per-frame
> measurements taken with a sound method, explains that method and the pitfalls
> it avoids, checks the existing docs' claims against the results, and proposes
> the docs changes that should follow.

**Status:** implemented (2026-09-25), and superseded as the place to find
numbers. Re-running the harness found a flaw in the original push measurement
(section 4.6): every push number first recorded here was too low, by up to
about 2.6x. The tables below are from the corrected re-run of 2026-09-24.

Since then the benchmarks have been consolidated into
[`benchmarks/`](../../benchmarks/README.md), one suite per topic, run with
`npm run bench`. The harness in this proposal is the `reactivity` suite. The
old `benchmarks/*.bench.ts` suites, their investigation page and the
`scripts/bench-*.ts` drivers are deleted, and the docs moved to a
"Performance" group: [Hot Paths](../../docs/building-with-mvt/performance/hot-paths.md),
[Performance Measurements](../../docs/building-with-mvt/performance/measurements.md)
(generated tables for every suite) and
[Benchmarking Methods](../../docs/building-with-mvt/performance/benchmarking-methods.md)
(what this proposal called `measuring-performance.md`). Cite those pages, not
the tables here.

**Written:** 2026-09-24.

**Related:** [`docs/building-with-mvt/reacting-to-changes/why-polling.md`](../../docs/building-with-mvt/reacting-to-changes/why-polling.md),
[`docs/building-with-mvt/performance/hot-paths.md`](../../docs/building-with-mvt/performance/hot-paths.md),
[`benchmarks/`](../../benchmarks/README.md),
[the `<List>` proposal](./004-list-proposal.md) section 7.1.

---

## 1. Summary

Three questions were measured, each on 1000 view elements:

1. **What does a polled binding cost?** Using this repo's JSX runtime
   (`src/pixi-jsx/`), and using hand-written refresh methods, which is what a
   compiler such as Solid's would emit.
2. **How does polling compare with push-based reactivity** (Solid's signals and
   render effects) as the share of values changing per frame varies?
3. **Where does the runtime's time go?** Using CPU profiles.

Headline findings:

| Finding | Evidence |
| --- | --- |
| Polling costs about 4-9 ns per element per frame, plus Pixi's own work when a value changes | Section 5.2 |
| This JSX runtime costs 18-55% more than hand-written methods: 1-3 ns per element, which is the getter calls themselves | Sections 5.1, 5.2 |
| A static prop costs nothing per frame; each getter costs about 1.4-1.8 ns in the runtime and 0.65-0.8 ns hand-written | Section 5.2 |
| Push wins by 40-90x when nothing changes and by 4-7x at 1% change, and loses by 10-14x when everything changes | Section 5.3 |
| The crossover is at about 4-6% of values changing per frame | Section 5.3 |
| Push timed inside Solid's `createRoot` ran no effects at all, and looked up to 2.6x cheaper than it is | Section 4.6 |
| Designs benchmarked side by side in one Vitest process gave ratios and overheads (2.3-2.7x, a phantom 5.6 ns per element) that separate bundled processes did not reproduce (1.8x, 0.5 ns) | Section 4.1 |

The findings mostly **support** what `why-polling.md` says, and give it
numbers it currently lacks. They also show that the benchmark it cites, and the
investigation built on it, used a method that cannot be trusted for
comparisons (section 4.1).

**What this proposal asks for** (section 7):

- A new page on measuring performance, covering the method and its pitfalls.
- A "what things cost" section in `hot-paths.md`.
- Measured numbers in `why-polling.md`, in place of its qualitative cost claims.
- The existing reactivity benchmarks reworked to run one design per process,
  and the investigation re-run.

**Correction (2026-09-24).** This proposal first reported push winning by
10-70x at 1% change or less, losing by only 3.9-5.6x at 100%, and a crossover
at 11-16%. Those push numbers came from a harness that timed its frames inside
Solid's `createRoot`, where effects are deferred until the root returns, so no
effect ran while timing. The pull numbers were unaffected and reproduced within
noise. See section 4.6.

---

## 2. Motivation

**The docs make performance claims without numbers.** `why-polling.md` says
polling's idle cost is "a negligible part of the frame budget" at "game-typical
scale", that signals are "wasteful" for continuous state, and that per-frame
comparison cost "grows linearly" at extreme scale. All plausible, none
quantified. `hot-paths.md` gives allocation guidance with no costs attached.

**The one cited benchmark is methodologically unsound.** `why-polling.md` ends
with an empirical note pointing at `benchmarks/reactivity-simple.bench.ts`.
That suite, like `reactivity-detailed.bench.ts`, runs its designs side by side
in one Vitest process. Section 4.1 shows that this setup, during this work,
produced ratios of 2.3-2.7x where separate processes gave 1.8x, and a cost that
does not exist. The direction of its conclusions agrees with the measurements here, but
its numbers should not be relied on.

**Its supporting references are also stale.** The investigation says to run
the suite with `npm run bench`, which now runs `scripts/bench-scene-passes.ts`
instead. It names `reactivity.bench.ts`, which no longer exists (the closest
file is `reactivity-detailed.bench.ts`), and the suite header points at
`docs/reactivity-guide/comparison.md`, which no longer exists.

**Nothing documents how to measure.** The only guidance is a comment in
`scripts/bench-scene-passes.ts`, which is exactly the lesson section 4.1
relearned the hard way.

---

## 3. Method

### 3.1 Environment

| | |
| --- | --- |
| Machine | Intel Core Ultra 9 185H, Windows 11 Home |
| Runtime | Node.js v22.11.0 (V8) |
| Libraries | pixi.js 8.16.0, solid-js 1.9.11 (the repo's own, browser build `dist/solid.js`); the first, flawed run used a scratch install of 1.9.15 |
| Bundler | esbuild 0.27.3 |

Only V8 under Node was measured. Browsers were not, and nor were other engines
(section 8).

### 3.2 Harness

The harness was first committed as `scripts/bench-reactivity.ts`, which
bundled `scripts/bench-reactivity-arm.ts` with esbuild and ran it under plain
Node (Appendix A). It is now the `reactivity` suite in
[`benchmarks/`](../../benchmarks/README.md). Each run measures one
**configuration**, a combination of:

- **Design**, how the view is kept in sync with the model:
  - `mutate-only`: the model writes alone, with no view. Shows the model's
    share of the cost.
  - `pull-runtime`: elements built with this repo's `jsx()`, refreshed by
    `refreshScene`. The runtime version measured is the cached-factory design
    described in section 5.1.
  - `pull-compiled`: hand-written `onRefresh` methods that read model fields
    directly, refreshed by `refreshScene`. This is what a compiler would emit.
  - `push-solid`: model fields are Solid signals, and each element has one
    `createRenderEffect` reading its signals, which mirrors how Solid's compiler
    groups an element's dynamic attributes. Each frame's writes are wrapped in
    `batch`. The signals and effects are built inside a `createRoot` and timed
    outside it (section 4.6); a guard fails the run if an effect does not run.
- **Shape**, the props on each element:
  - `all-dynamic`: `x`, `y` and `alpha` are all getters.
  - `one-dynamic`: `x` is a getter; `y` and `alpha` are static.
- **Change rate**: 0, 1, 10, 50 or 100% of the 1000 elements have all three of
  their model values changed each frame (`x` and `y` increment, `alpha`
  alternates between 1 and 0.5).

Each run warms up for 3000 frames, then times 15 batches of 1000 frames and
takes the median batch. **Each configuration runs in its own process, three
times**; results report the median of the three, with the range.

**What a frame's time includes:** the model writes plus whatever keeps the view
in sync. For the pull designs, that is the writes plus `refreshScene`. For
push, it is the signal writes, which is where push does its work.

**What it excludes:** rendering (Pixi's transform updates and batching, which
are the same in every design), construction cost, memory, and garbage
collection outside the timed window.

### 3.3 Profiling

CPU profiles used `node --cpu-prof --cpu-prof-interval 25` on the bundled
harness, summarised as self time per function. Because V8 inlines the pass, the
methods and the getters into one another, attribution also used
`--max-inlined-bytecode-size=0`. That slows everything down, so only relative
shares are meaningful. Deoptimisations were counted with `--trace-deopt`.

---

## 4. Measurement pitfalls

Each of these produced a wrong conclusion during this work before it was
caught. They are what the proposed "Measuring performance" page should teach.

### 4.1 Several designs in one process

V8's inline caches and optimisation decisions are shared across code in a
process. Designs timed side by side share them, and whichever runs first
shapes how the rest are compiled. `scripts/bench-scene-passes.ts` already
warns that the first arm "wins by more than 2x whichever order they are written
in".

Measured here, the same designs (the previous JSX runtime design from section
5.1, and hand-written methods; 1000 elements, 3 getters, no change) gave:

| | In one Vitest process | One design per process, bundled |
| --- | --- | --- |
| Previous JSX runtime | 26.5-29.2 µs | 9.75-10.11 µs |
| Hand-written methods | 10.9-11.6 µs | 5.55-5.70 µs |
| Ratio | 2.3-2.7x | about 1.8x |
| Scene pass overhead over a plain loop | about 5.6 ns per element | about 0.5 ns per element |

The in-process setup also made a refresh-only copy of the pass loop measure
slower than the shared one (14.7 against 9.9 µs), which led to rejecting an
idea on false evidence. It also suggested that static props saved nothing,
which the per-process numbers contradict (section 5.2).

**A confound.** The Vitest runs differ from the per-process runs in two ways at
once: designs shared a process, and the code ran unbundled under Vitest's
transform, which alone roughly doubles absolute times. These measurements
cannot say how much of the distorted *ratios* each cause contributed. The
evidence that sharing a process distorts comparisons on its own is the
existing harness's comment above, from earlier work on the scene passes.
Avoiding both is cheap, so the rule does not depend on untangling them.

**Rule:** one design per process, always.

### 4.2 Running TypeScript through a loader

Under `tsx`, 12 identical runs of one configuration ranged from 8.2 to 18.0 µs.
`tsx` moves module loading into a worker thread, and its activity shows up in
the timings and in profiles, where it accounted for about 40% of samples.
Bundled to plain JavaScript with esbuild, 8 runs ranged from 7.80 to 8.05 µs.

**Rule:** bundle first, then run and profile plain JavaScript.

### 4.3 Solid resolving to its server build

Under Node, `solid-js` resolves to its server build, in which effects never
run. Push then looks free. The existing investigation found this too, and
`vite.config.ts` aliases the browser build for tests. The harness imports
`dist/solid.js` by path.

**Rule:** check that the reactive system under test actually reacts.

### 4.4 Dividing by the wrong unit

An early result was reported as "ns per binding" by dividing a frame's time by
the number of bindings. The per-process numbers show the cost has a per-element
part and a per-binding part (section 5.2). Dividing by one unit hid the other.

**Rule:** vary one dimension at a time (bindings per element, element count)
before choosing the unit.

### 4.5 Reading profiles without accounting for inlining

With inlining on, almost all samples land on the outermost frame function, so
a profile says little about where time goes inside it. Disabling inlining
restores attribution at the cost of absolute speed.

**Rule:** use inlining-off profiles for relative shares only.

### 4.6 Timing push inside `createRoot`

Found when re-running the harness after committing it. The original harness
built its signals and effects inside `createRoot` and ran the timed frames in
the same callback. Inside a root's body, Solid defers every effect until the
body returns, and a `batch` there does not flush them. So no effect ran in any
timed frame: an instrumented copy counted zero effect runs across 18,000
frames. After the first frame every effect was already marked stale, so each
later write only compared values and walked its list of observers.

| Push, 1000 elements, 3 signals each, 100% change | Per frame |
| --- | --- |
| Timed inside `createRoot` (original harness) | 52-57 µs |
| Timed outside it, effects running | 136-148 µs |

The pull designs do not involve Solid and were unaffected.

**Rule:** assert that the work happened. The committed harness writes a signal
and checks that its effect ran before timing, and fails the run otherwise.

---

## 5. Findings

### 5.1 The runtime's refresh code, and where its time goes

The runtime generates a refresh method for each element from cached generated
code. Two designs were compared, on 1000 elements with three getters, no
change, one design per process, bundled, with 3-4 runs each:

| Design | Per frame |
| --- | --- |
| Previous: each method calls a shared generated function, which calls getters through an array | 9.75-10.11 µs |
| **Current: a cached generated factory returns each element's method, which calls its captured getters directly** | 7.78-7.83 µs |
| Hand-written methods, through `refreshScene` | 5.55-5.70 µs |
| Hand-written methods, plain loop without `refreshScene` | 5.15-5.23 µs |

- The factory design is 21% faster and halves the gap to hand-written methods,
  from about 4.3 to about 2.2 ns per element. It is now in `jsx-runtime.ts`.
- `refreshScene` costs about 0.5 ns per element over a plain loop.
- No deoptimisations occur after warm-up.

With inlining disabled, the profiles attribute:

| Share of samples | JSX runtime | Hand-written |
| --- | --- | --- |
| The element's method | 24.0% | 27.5% |
| The three getters (`() => m.x` and so on) | 20.6% | none |
| The pass (`invokeSubtreeMethods`, `refreshScene`, the `onRefresh` accessor) | 17.3% plus accessor | 27.6% |
| Pixi's setters (`x`, `y`, `alpha`) | most of the rest | most of the rest |

The runtime's remaining cost over hand-written methods is the getter calls. A
runtime cannot remove them, because getters are all it receives.

### 5.2 Polling: this runtime against hand-written methods

Median µs per frame for 1000 elements, with the range over three processes.
1% change is omitted from this table; it is within noise of 0% (full results
in Appendix B). A first run of the same designs, before the harness was
committed, agreed with these to within about 5-12%.

| Props per element | Change | Runtime | Hand-written | Ratio | Gap per element |
| --- | --- | --- | --- | --- | --- |
| 3 getters | 0% | 8.81 [8.40-9.03] | 5.87 [5.38-6.36] | 1.50 | 2.9 ns |
| 3 getters | 10% | 9.39 [9.36-9.71] | 6.13 [6.11-6.18] | 1.53 | 3.3 ns |
| 3 getters | 50% | 11.20 [10.56-11.84] | 8.45 [8.13-8.57] | 1.33 | 2.8 ns |
| 3 getters | 100% | 13.41 [13.31-13.53] | 10.19 [10.16-10.37] | 1.32 | 3.2 ns |
| 1 getter, 2 static | 0% | 5.20 [5.07-5.35] | 4.25 [4.18-4.25] | 1.22 | 1.0 ns |
| 1 getter, 2 static | 10% | 5.51 [5.28-5.54] | 4.52 [4.50-4.84] | 1.22 | 1.0 ns |
| 1 getter, 2 static | 50% | 6.76 [6.48-6.76] | 5.66 [5.46-5.97] | 1.19 | 1.1 ns |
| 1 getter, 2 static | 100% | 8.05 [7.92-8.10] | 6.84 [6.77-6.93] | 1.18 | 1.2 ns |

- **Polling costs about 4-9 ns per element per frame** when nothing changes,
  depending on how many getters an element has.
- **Static props cost nothing per frame.** Each getter adds about 1.8 ns in the
  runtime and 0.8 ns hand-written (1.4 and 0.65 ns in the first run). Making
  two of three props static cut the runtime's frame time by about 40%.
- **Changes cost extra, the same in both.** From 0% to 100% change, polling
  costs rise about 50-75%, mostly Pixi's setters doing real work (they return
  early when a value is unchanged). The model's own writes are negligible:
  `mutate-only` costs at most 1.4 µs at 100%.
- **The gap is small in absolute terms.** At 10,000 elements with three
  getters, the runtime costs about 30 µs more per frame than hand-written
  methods: about 0.2% of a 16.7 ms frame.

### 5.3 Polling against push

| Props per element | Change | Pull, runtime | Pull, hand-written | Push (Solid) |
| --- | --- | --- | --- | --- |
| 3 getters | 0% | 8.81 | 5.87 | **0.10** |
| 3 getters | 1% | 8.88 | 5.74 | **1.30** |
| 3 getters | 10% | 9.39 | **6.13** | 13.53 |
| 3 getters | 50% | 11.20 | **8.45** | 67.18 |
| 3 getters | 100% | 13.41 | **10.19** | 137.84 |
| 1 getter, 2 static | 0% | 5.20 | 4.25 | **0.10** |
| 1 getter, 2 static | 1% | 5.30 | 4.25 | **0.88** |
| 1 getter, 2 static | 10% | 5.51 | **4.52** | 7.98 |
| 1 getter, 2 static | 50% | 6.76 | **5.66** | 43.11 |
| 1 getter, 2 static | 100% | 8.05 | **6.84** | 87.04 |

- **Polling costs roughly the same whatever changes.** Push costs about 138 ns
  per changed element when its effect reads three signals, about 87 ns when it
  reads one (all three are written either way), and almost nothing otherwise.
- **Crossover:** push stops winning at about 4-5% of values changing per frame
  against hand-written polling, and about 6% against this runtime.
- **When nothing changes, push is 40-90x cheaper; at 1% change, 4-7x.** This is
  the UI case: most of the screen is idle most of the time.
- **At 10% change, push already costs 1.4-2.2x more; at 100%, 10-14x more.**
  This is the game case: moving entities change every frame.
- **Push also changes the model.** Its fields become signals, so the model is
  no longer plain state. That is a design cost the timings do not show.

### 5.4 Results that needed re-measuring

These were first measured before the pitfalls in section 4 were understood,
with several designs in one Vitest process. On 2026-09-24 the first two were
re-measured one design per process, bundled, five processes each, and 004 is
corrected where they differ.

- **`array.at(i)` against `array[i]`**, cited in 004 section 4.7 as the same
  (0.76 against 0.77 ns per element). In a plain loop reading one field from
  each of 1000 objects, `at(i)` is **slower**: 1.06 [1.06-1.07] against 0.86
  [0.85-0.89] ns per element. Inside `<List>`'s slot method, where it matters,
  the difference is within noise: 1000 slots of one getter each, 10% of items
  moving each frame, gave medians of 17.6-17.7 µs per frame with
  `source.at(index)` against 16.5-17.0 µs with that line patched to
  `source[index]`, with overlapping ranges. That is under about 1 ns per slot.
  The conclusion in 004 stands; the evidence given for it does not.
- **The refresh-factory cache under churn and on construction**, cited in 004
  section 7.1 (412 to 257 µs per frame, and 1.51 to 1.34 µs per element). Those
  compared the earlier cached *body* design against no cache, and that design
  no longer exists. Re-measured instead for the shipping cached *factory*,
  against the same code with the cache lookup removed, on `jsx('container')`
  elements with three getters:

  | | Cached | Uncached | Saving |
  | --- | --- | --- | --- |
  | Construction, per element (build, first refresh, destroy) | 0.42 [0.42-0.44] µs | 1.35 [1.31-1.37] µs | 69% |
  | 1000 elements, 100 destroyed and rebuilt per frame | 403 [398-405] µs | 511 [509-543] µs | 21% |
  | 1000 elements, no churn | 10.3 [10.1-10.3] µs | 13.2 [13.0-13.4] µs | 22% |

  The cache matters more for construction than first measured, and somewhat
  less under churn. The churn frame is dominated by other work (`addChildAt`
  and `removeChildAt` on a 1000-child array, and the scene pass rebuilding its
  cached lists after each structural change); the cache saves about 1.1 µs per
  rebuilt element. The rebuilds are hand-written for the measurement: the
  shipping `<List>` does not rebuild slots when its items change.
- **Every number in `benchmarks/reactivity-performance-investigation.md`.** Not
  re-measured. That file now warns against citing them, and reworking those
  suites is still open (section 7.4).

The scratch arms for these measurements are not committed, like the
`pass-jsx-old` variant in Appendix A.

---

## 6. How the findings bear on the current docs

| Current claim (`why-polling.md`) | Verdict |
| --- | --- |
| Polling's idle cost is negligible at game-typical scale | **Supported.** About 4-9 µs per frame per 1000 polled elements, about 0.05% of a frame |
| Events and signals cost nothing when idle | **Supported.** Push costs 0.10 µs per frame when nothing changes |
| For continuously changing values, polling is cheaper than signals | **Supported, and quantified.** 10-14x cheaper at 100% change, and already cheaper at 10% |
| Per-frame comparison cost grows linearly at extreme scale | **Supported.** About 4-9 ns per element per frame |
| Its empirical note: benchmarks confirm watcher overhead is negligible | **Direction agrees, method unsound** (section 4.1). Replace with these measurements |

`hot-paths.md` makes no performance claims with numbers. Its allocation
guidance was not measured here, so this proposal neither supports nor
challenges it.

---

## 7. Proposed docs changes

### 7.1 New page: `docs/building-with-mvt/performance/benchmarking-methods.md`

**Done** (2026-09-24), including the lesson of section 4.6.

How to benchmark MVT code without fooling yourself. Contents:

- One design per process, and why (section 4.1, with the before-and-after table
  as the worked example).
- Bundle to plain JavaScript before timing or profiling (section 4.2).
- Warm up, time in batches, report the median and the range, repeat across
  processes.
- Check that push-based libraries actually react under Node (section 4.3).
- Vary one dimension at a time before choosing a unit (section 4.4).
- Profiles: inlining hides attribution; use `--max-inlined-bytecode-size=0`
  for relative shares only (section 4.5).
- Measure the frame as a whole, including model writes, and say what is
  excluded (rendering, construction, memory).

It sits beside `hot-paths.md`, which tells you what to avoid; this page tells
you how to find out.

### 7.2 `hot-paths.md`: add "What things cost"

**Done** (2026-09-24), with the corrected numbers.

A short section with the measured costs, stated with their conditions (1000
elements, V8, Node 22, this machine), and a link to the measuring page:

- A polled element: about 4-9 ns per frame, most of it the setters and the pass.
- Each extra getter: about 0.65-1.8 ns. A static prop: nothing per frame.
- A changed value: the setter's real work, the same whatever keeps the view in
  sync.
- A frame-budget table: 1,000 / 10,000 / 100,000 polled elements as a share of
  16.7 ms.

The section should close with the practical rule the numbers support: at game
scale, allocation and algorithmic choices matter far more than binding
overhead.

### 7.3 `why-polling.md`: numbers in place of adjectives

**Done** (2026-09-24), with the corrected numbers.

- **Limitations and Tradeoffs:** replace "negligible", "linear" and "zero when
  idle" with the section 5.3 numbers, and add the crossover (about 4-6% of values
  changing per frame).
- **A new subsection, "When push wins":** state plainly that for UIs that are
  mostly idle, push is much cheaper (40-90x when nothing changes, 4-7x at 1%),
  which is why UI frameworks use it, and why games with continuously moving
  entities do not.
- **The empirical note:** point at the new measurements and the measuring page
  instead of the in-process benchmark.

### 7.4 The benchmarks themselves

- **Done, by replacement** (2026-09-25): rework `benchmarks/*.bench.ts` to run
  one design per process. The old suites are deleted. Their scenarios are
  covered by the `reactivity`, `change-detection` and `memory` suites in
  [`benchmarks/`](../../benchmarks/README.md), which all run one case per
  process, bundled.
- **Done:** commit the section 3.2 harness, first as
  `scripts/bench-reactivity.ts` with an `npm run bench:reactivity` script, and
  since folded into `benchmarks/` as the `reactivity` suite. It aliases the
  repo's own `solid-js` (1.9.11) browser build rather than the scratch copy used
  at first. `esbuild` is now a direct devDependency, at the version Vite
  already installed.
- **Done, by replacement:** `reactivity-performance-investigation.md` is
  deleted rather than re-run. Its questions are answered, with sound numbers,
  on the docs' Performance Measurements page.

### 7.5 What stays out of `docs/`

The JSX-runtime-specific numbers (sections 5.1 and the runtime column of 5.2)
belong in `src/pixi-jsx/` and the `<List>` proposal until the JSX runtime
graduates, consistent with 004 section 9 step 8. The pull-against-push and
per-element costs are general, and belong in `docs/`.

---

## 8. Open questions

1. **Browsers.** Everything here is V8 under Node on one machine. Should the
   docs numbers be re-measured in Chrome, Firefox and Safari before
   publishing, or published with that caveat? Recommend: publish with the
   caveat, and state the ratios rather than implying the absolute numbers
   transfer.
2. **Rendering.** Excluded throughout. When values change, Pixi's render-side
   work is likely larger than anything measured here, and would shrink every
   ratio above. Worth one measurement before the docs claim "at game scale,
   binding overhead does not matter".
3. **Push's construction and memory cost.** A signal per field and an effect
   per element were not measured. They matter for pools and churning lists.
4. **Regression tracking.** Should any of these benchmarks run in CI? Timing
   noise on shared runners makes that hard; recommend not, and treat the
   harness as an on-demand tool.
5. **A change-gate for idle subtrees.** The one case where push beats pull by
   an order of magnitude is a mostly idle subtree (section 5.3). A prop such as
   `<container refreshWhen={() => model.version}>`, returning
   `SKIP_DESCENDANTS` while the value is unchanged, would make an idle subtree
   cost one getter call per frame. Unmeasured. Its risk is the one the old
   reconciling `<List>`'s `version` prop had: a model that forgets to bump its
   version silently freezes the view. Worth trying only if an idle-heavy UI
   appears.
6. **The JSX runtime's remaining per-element cost is the getter calls.** After
   the cached-factory change (section 5.1) the profile attributes the
   remaining ~2 ns per element over hand-written methods to calling getters,
   which a runtime cannot avoid. No further optimisation of the runtime's
   refresh path is expected to pay off.

---

## 9. Implementation steps

1. ~~Commit the harness (7.4, second bullet) and re-run it to confirm the
   tables reproduce on the committed version.~~ Done. Pull reproduced; push did
   not, which exposed section 4.6.
2. ~~Re-measure the section 5.4 results and correct 004 where they differ.~~
   Done.
3. ~~Write `measuring-performance.md` (7.1).~~ Done.
4. ~~Add "What things cost" to `hot-paths.md` (7.2).~~ Done.
5. ~~Update `why-polling.md` (7.3).~~ Done.
6. ~~Rework the existing benchmarks and investigation (7.4).~~ Done, by
   replacing them with the suites in `benchmarks/`.
7. Update `docs/ai-agents/skill-mvt-view.md` and `AGENTS.md` if the hot-path
   rules change as a result. **Open decision.** The `hot-path-rules` suite
   later measured each rule: in V8, `for...of` over an array and returning a
   `[col, row]` tuple cost nothing extra. The Hot Paths page keeps both rules
   and says why, but `AGENTS.md` critical rule 5 still bans `for...of`
   outright. Whether to relax it is a decision for the maintainer.

---

## Appendix A: Harness

First committed as two files, since folded into
[`benchmarks/`](../../benchmarks/README.md) as the `reactivity` suite (measured
file `benchmarks/suites/synced-scene.case.ts`, run with
`npm run bench -- reactivity`):

- `scripts/bench-reactivity-arm.ts` timed one configuration and printed µs per
  frame: `node <bundle>.mjs <design> <shape> <pct>`.
- `scripts/bench-reactivity.ts` bundled the arm with esbuild (aliasing
  `solid-js` to its browser build), ran each configuration in three fresh
  processes, and printed the Appendix B table.

The arm is the harness first used for this proposal, with one change: push is
built inside `createRoot` but timed outside it, and a guard fails the run if an
effect does not run (section 4.6). The original timed inside the root, which
is why its push numbers were wrong.

The section 5.1 comparison used a variant of this harness with a
`pass-jsx-old` design, built from a temporary copy of `jsx-runtime.ts` that
restored the previous shared-function refresh. Neither is committed.

## Appendix B: Full results

From `npm run bench:reactivity` on 2026-09-24. Median µs per frame over three
processes, with the range. 1000 elements.

| Shape | Change | mutate-only | pull-runtime | pull-compiled | push-solid |
| --- | --- | --- | --- | --- | --- |
| all-dynamic | 0% | 0.01 [0.01-0.02] | 8.81 [8.40-9.03] | 5.87 [5.38-6.36] | 0.10 [0.10-0.11] |
| all-dynamic | 1% | 0.02 [0.02-0.02] | 8.88 [8.43-9.56] | 5.74 [5.71-6.11] | 1.30 [1.28-1.44] |
| all-dynamic | 10% | 0.14 [0.14-0.15] | 9.39 [9.36-9.71] | 6.13 [6.11-6.18] | 13.53 [13.49-13.56] |
| all-dynamic | 50% | 0.66 [0.66-0.69] | 11.20 [10.56-11.84] | 8.45 [8.13-8.57] | 67.18 [64.44-69.15] |
| all-dynamic | 100% | 1.41 [1.36-1.44] | 13.41 [13.31-13.53] | 10.19 [10.16-10.37] | 137.84 [136.26-147.90] |
| one-dynamic | 0% | 0.01 [0.01-0.01] | 5.20 [5.07-5.35] | 4.25 [4.18-4.25] | 0.10 [0.10-0.11] |
| one-dynamic | 1% | 0.02 [0.02-0.02] | 5.30 [5.15-5.56] | 4.25 [4.17-4.35] | 0.88 [0.83-0.88] |
| one-dynamic | 10% | 0.14 [0.14-0.14] | 5.51 [5.28-5.54] | 4.52 [4.50-4.84] | 7.98 [7.77-8.15] |
| one-dynamic | 50% | 0.67 [0.65-0.70] | 6.76 [6.48-6.76] | 5.66 [5.46-5.97] | 43.11 [41.54-43.62] |
| one-dynamic | 100% | 1.37 [1.36-1.38] | 8.05 [7.92-8.10] | 6.84 [6.77-6.93] | 87.04 [85.15-87.53] |

The first, flawed run (section 4.6) recorded push at 0.08, 0.55, 5.34, 28.05
and 52.42 µs (all-dynamic) and 0.08, 0.47, 3.80, 20.48 and 40.34 µs
(one-dynamic) for the same change rates. Its pull columns agreed with the
table above to within about 5-12%.
