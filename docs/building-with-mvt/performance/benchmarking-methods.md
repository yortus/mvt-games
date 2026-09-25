# Benchmarking Methods

> How to benchmark MVT code without fooling yourself, and how to run this
> repo's benchmarks. Per-frame costs in a game loop are measured in
> microseconds, and at that scale the benchmark itself can distort the result
> more than the code under test does.

**Related:** [Why Performance Matters](why-performance-matters.md) · [Performance Measurements](measurements.md) · [Hot Paths](hot-paths.md) ·
[Reactivity: Why MVT Uses Polling](../reacting-to-changes/why-polling.md)

---

::: info About the figures
The timings on this page are examples from one 2025 machine, chosen to show
how flawed methods can distort a result. What matters in each is the difference between the two numbers, not the numbers themselves.
:::

*[Hot Paths](hot-paths.md) says what to avoid, and [Performance
Measurements](measurements.md) says what things cost. This page says how those
costs were measured, and how to measure your own.*

## The Rules at a Glance

| Rule | Why |
| --- | --- |
| [One approach per process](#one-approach-per-process) | Approaches timed side by side distort each other's timings |
| [Bundle to plain JavaScript first](#bundle-first) | A TypeScript loader adds its own noise to the timings |
| [Warm up, time in batches, repeat across processes](#warm-up-batch-and-repeat) | One run of one process is not a measurement |
| [Check that the code under test does its work](#check-that-the-work-happens) | A reactive system that never reacts looks free |
| [Measure allocation without a collection in the way](#measuring-allocation) | A garbage collection mid-measurement hides what was allocated |
| [Vary one thing at a time](#vary-one-thing-at-a-time) | Dividing by the wrong unit hides part of the cost |
| [Read profiles with inlining in mind](#read-profiles-with-inlining-in-mind) | Inlining puts almost every sample on the outermost function |
| [Measure the whole frame, and say what is excluded](#measure-the-whole-frame) | A cost moved elsewhere is still a cost |

## One Approach per Process

V8 shares inline caches and optimisation decisions across all the code in a
process. When two approaches are timed side by side, whichever runs first
shapes how the others are compiled. A benchmark suite that declares several
cases in one file, as `vitest bench` suites do, has this problem by default.

In this repo, the same two approaches gave these numbers (1000 Pixi containers,
each with three dynamic properties, nothing changed):

| | In one Vitest process | One approach per process, bundled |
| --- | --- | --- |
| JSX runtime (an earlier version) | 26.5-29.2 µs | 9.75-10.11 µs |
| Hand-written `onRefresh` methods | 10.9-11.6 µs | 5.55-5.70 µs |
| Ratio | 2.3-2.7x | about 1.8x |

The in-process numbers also showed a per-container overhead for the scene pass
that does not exist, and made a faster version of the pass loop look slower.
An idea was rejected on that evidence.

**Rule:** run each approach in a fresh process. A small driver script that
starts one Node process per case and collects the results is enough; that is
what [`benchmarks/run.ts`](https://github.com/yortus/mvt-games/blob/main/benchmarks/run.ts) does.

## Bundle First

Running TypeScript through a loader such as `tsx` puts the loader's own work
in the timings. Under `tsx`, 12 identical runs of one case ranged from 8.2 to
18.0 µs, and the loader accounted for about 40% of the samples in a CPU
profile. Bundled to plain JavaScript with esbuild, 8 runs ranged from 7.80 to
8.05 µs.

**Rule:** bundle the code under test to plain JavaScript, then time and
profile that. The driver may still run under `tsx`, because it does no timing
itself.

```sh
npx esbuild bench.ts --bundle --platform=node --format=esm --outfile=bench.mjs
node bench.mjs
```

## Warm Up, Batch and Repeat

A single timing is dominated by whatever else the machine and the engine were
doing at that moment. The pattern used in this repo:

1. **Warm up.** Run at least 1000 frames and 300 ms untimed, so the code under
   test is optimised before timing starts.
2. **Time in batches.** Time batches of many frames rather than single frames,
   because a frame of a few microseconds is close to the timer's resolution.
   Each batch here lasts about 30 ms, however long a frame takes.
3. **Report the median batch**, not the mean. Garbage collection and other
   interruptions produce outliers that drag a mean upwards.
4. **Repeat across processes.** Run each case in several fresh processes and
   report the median with the range.

Expect noise of about 5-10% between identical processes. Two
approaches whose ranges overlap are not measurably different. When a
comparison depends on a small difference, check it by running two identical
builds side by side first: if they differ by as much, the comparison means
nothing.

## Check That the Work Happens

A benchmark is only as good as its evidence that the code under test did what
it claims. Two ways this went wrong while measuring Solid's signals:

- **The wrong build.** Under Node, `solid-js` resolves to its server build, in
  which effects never run. Signals then look almost free. Import the browser
  build (`solid-js/dist/solid.js`) by path, or alias it in the bundler.
- **Deferred work.** Inside the body of Solid's `createRoot`, every effect is
  deferred until the body returns. Frames timed there ran zero effects across
  18,000 frames, and reported signals costing well under half their real cost.
  Build inside the root, but time outside it.

The same applies to any variant built by patching code: check that the patch
applied. A patched build that silently matched nothing once produced a 10%
"difference" between two identical bundles.

**Rule:** assert that the work happened. Count effect runs, or read back a
value the work should have written, and fail the run if it did not. The Solid
cases here write a signal and check that its effect ran before timing
anything.

## Measuring Allocation

Allocation per frame shows how much garbage a frame leaves for the collector,
which is what the [hot path](hot-paths.md) rules are about. Node exposes
the heap's size (`process.memoryUsage().heapUsed`) but no running total of
bytes allocated, so the measurement works by making sure nothing is collected
while it watches:

1. Start Node with `--expose-gc` and a large young generation
   (`--max-semi-space-size=128`).
2. Force a full collection, then note the heap size.
3. Run a few thousand frames, and note the heap size again. With no collection
   in between, the growth is exactly what the frames allocated.
4. Watch for collections with a `PerformanceObserver` for `gc` entries. If one
   ran, the window is thrown away and retried with fewer frames.
5. Subtract the same measurement of an empty frame, which is the measurement's
   own cost.

Two checks keep it honest:

- **A deliberately wasteful case.** One view builds a template string and an
  `array.map()` result every frame. If the measurement reports zero for it,
  the measurement is broken.
- **The benchmark's own variables.** A module-level `let` holding a
  non-integer number allocates a new heap number on every `+=`. A benchmark
  that adds its results to such a variable reports that allocation against
  every case. Keep results in a `Float64Array`, which stores numbers in place.

For garbage collection over time, count the `gc` entries and their durations
over a fixed number of frames with Node's default heap settings. For memory
kept alive, force a collection before and after building many items and keep
a reference to them.

## Vary One Thing at a Time

A frame's cost usually has more than one part: something per container, and
something per dynamic property within each container. Dividing the frame time
by one of them hides the other. An early result here reported "nanoseconds
per property" this way. Varying the dynamic properties per container
separately from the number of containers showed that each container costs a
fixed amount, plus about 1-2 ns for each dynamic property (a static property,
set once at construction, costs nothing per frame).

**Rule:** vary one thing (the number of containers, the dynamic properties
per container, the share changed per frame) while holding the others fixed,
and only then choose the unit to report.

## Read Profiles With Inlining in Mind

V8 inlines small functions into their callers. With inlining on, almost all
samples in a CPU profile land on the outermost function of the frame, so the
profile says little about where time goes inside it.

```sh
node --cpu-prof --cpu-prof-interval 25 bench.mjs
node --cpu-prof --max-inlined-bytecode-size=0 bench.mjs
```

The second form disables inlining, which restores per-function attribution
but slows everything down.

**Rule:** use profiles taken with inlining disabled for relative shares only,
never for absolute costs. `--trace-deopt` confirms whether anything is
deoptimised after warm-up.

## Measure the Whole Frame

Time everything a frame does to keep the view in step with the model: the
model's changes plus the refresh, not just the refresh. Signals and events do
their work when the model changes, so timing only the view side makes them
look free.

State plainly what the measurement excludes. The measurements in this repo
exclude rendering (Pixi's transform updates and draw calls), which is likely
to be larger than anything measured when values change.

## Running the Repo's Benchmarks

The benchmarks live in the repo's
[`benchmarks/`](https://github.com/yortus/mvt-games/tree/main/benchmarks) directory, one suite per topic. Each suite's cases
run under plain Node, each in its own process, three processes per case by
default.

```sh
npm run bench                                    # list the suites
npm run bench -- reactivity                      # run one suite
npm run bench -- reactivity approach=solid       # only the matching cases
npm run bench -- reactivity --runs=5             # more processes per case
npm run bench -- all --save                      # every suite, saving the results
```

`--save` writes `benchmarks/results/<suite>.json` (every run's numbers, and
the machine and versions they were measured on) and `<suite>.md` (the tables).
[Performance Measurements](measurements.md) includes those tables directly, so
re-running with `--save` updates the page. The suites are described in
[`benchmarks/README.md`](https://github.com/yortus/mvt-games/blob/main/benchmarks/README.md).
