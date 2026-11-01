# Measuring Performance

> A frame's work is measured in microseconds, and at that scale a careless
> benchmark can distort the result more than the code it measures. Timing
> two approaches in one process, running TypeScript through a loader, or
> measuring a reactive library that never reacted have each produced
> wrong answers in this book's benchmarks. This appendix shows each of those
> failures, and the rule that prevents it, so you can measure your own
> code without fooling yourself.

**Related:** [Why Performance Matters](../chapters/23-why-performance-matters.md) ·
[Hot Paths](../chapters/24-hot-paths.md) ·
[Measurements](c-measurements.md) ·
[Why Views Poll](../chapters/10-why-views-poll.md)

[Chapter 24](../chapters/24-hot-paths.md) says what to avoid on a hot
path, and [Appendix C](c-measurements.md) gives the measured performance
costs. This appendix explains how those figures were measured, and how to
measure your own.

::: info About the figures
The timings here are examples from one machine, chosen to show how a
flawed method distorts a result. In each, the difference between the two
numbers matters, not the numbers themselves. For the performance costs
themselves, see [Appendix C](c-measurements.md).
:::

## The Benchmarking Rules at a Glance

| Rule | Why |
| --- | --- |
| [One approach per process](#one-approach-per-process) | Approaches timed side by side distort each other's timings |
| [Bundle to plain JavaScript first](#bundle-first) | A TypeScript loader adds its own noise to the timings |
| [Warm up, time in batches, repeat across processes](#warm-up-batch-and-repeat) | One run of one process is not a measurement |
| [Check that the code under test does its work](#check-that-the-work-happens) | A reactive system that never reacts looks instant |
| [Measure allocation without a collection in the way](#measuring-allocation) | A garbage collection partway through hides what was allocated |
| [Vary one thing at a time](#vary-one-thing-at-a-time) | Dividing by the wrong unit hides part of the time |
| [Read profiles with inlining in mind](#read-profiles-with-inlining-in-mind) | Inlining puts almost every sample on the outermost function |
| [Measure the whole frame, and say what is left out](#measure-the-whole-frame) | Work moved somewhere else still takes time |

## One Approach per Process

V8, the JavaScript engine in Chrome and Node.js, shares the type
information that it collects about the code across everything in a
process. Its inline caches and its
decisions about what to optimise are shared too. So when two approaches
are timed side by side, whichever runs first shapes how the others are
compiled. A benchmark suite that declares several cases in one file, as
`vitest bench` suites do, has this problem by default.

In this book's benchmarks, the same two approaches produced these
numbers, for 1000 Pixi containers at rest, with three dynamic properties
each:

| | In one Vitest process | One approach per process, bundled |
| --- | --- | --- |
| JSX runtime (an earlier version) | 26.5-29.2 µs | 9.75-10.11 µs |
| Hand-written refresh methods | 10.9-11.6 µs | 5.55-5.70 µs |
| Ratio | 2.3-2.7x | about 1.8x |

The numbers from one process also showed `refreshView` taking time for
each container, which it doesn't. They made a faster version of its loop
look slower, and an idea was rejected on that evidence.

So run each approach in a fresh process. A small driver script that
starts one Node process per case and collects the results is enough.

::: info In this book
[`packages/internal/benchmarks/run.ts`](https://github.com/yortus/mvt-games/blob/main/packages/internal/benchmarks/run.ts)
is that driver. It runs each case in its own process.
:::

## Bundle First

Running TypeScript through a loader such as `tsx` puts the loader's own
work into the timings. Under `tsx`, 12 identical runs of one case ranged
from 8.2 to 18.0 µs, and the loader took about 40% of the samples in a CPU
profile. Bundled to plain JavaScript with esbuild, 8 runs ranged from 7.80
to 8.05 µs.

So bundle the code under test to plain JavaScript, then time and profile
that. The driver may still run under `tsx`, because it doesn't time
anything itself.

```sh
npx esbuild bench.ts --bundle --platform=node --format=esm --outfile=bench.mjs
node bench.mjs
```

## Warm Up, Batch and Repeat

A single timing mostly measures whatever else the machine and the engine
were doing at that moment. The book's benchmarks follow four steps.

1. **Warm up.** Run at least 1000 frames and 300 ms without timing them,
   so that the code under test is optimised before timing starts. A frame
   so slow that warming up would take more than 2 s stops at 100 frames
   instead. A frame that slow loops over tens of thousands of objects, so
   its code is optimised within the first few frames, and a thousand would
   take tens of seconds.
2. **Time in batches.** Time batches of many frames rather than single
   frames, because a frame of a few microseconds is close to the timer's
   resolution. Each batch here lasts about 30 ms, however long a frame
   takes.
3. **Report the median batch,** not the mean. Garbage collection and other
   interruptions make outliers, which drag a mean upwards.
4. **Repeat across processes.** Run each case in several fresh processes,
   and report the median with the range. Here, each case runs twice, and a
   third time only when the two disagree by more than 5%. That's also the
   point at which the tables mark a result as noisy.

Expect about 5-10% of noise between identical processes. Two approaches
whose ranges overlap aren't measurably different. When a comparison
depends on a small difference, first run two identical builds side by
side. If they differ by as much, the comparison doesn't tell you
anything.

## Check That the Work Happens

A benchmark is only as good as its evidence that the code under test did
its work. Here are two ways that went wrong while measuring Solid's
signals.

- **The wrong build.** Under Node, `solid-js` resolves to its server
  build, in which effects never run. Signals then look almost instant. Import
  the browser build (`solid-js/dist/solid.js`) by its path, or alias it in
  the bundler.
- **Deferred work.** Inside the body of Solid's `createRoot`, every effect
  is deferred until the body returns. Frames timed there didn't run any
  effects across 18,000 frames, and reported signals taking well under
  half their real time. Build inside the root, but time outside it.

The same goes for any variant built by patching code: check that the
patch applied. A patch that silently failed to match once produced a 10%
"difference" between two identical bundles.

So check that the work happened. Count the effects that ran, or
read back a value the work should have written, and fail the run if it
didn't. The Solid cases here write a signal and check that its effect ran
before they time anything.

## Measuring Allocation

The bytes a frame allocates show how much garbage it leaves for the
collector, the subject of the [hot path](../chapters/24-hot-paths.md)
rules. Node reports the heap's size
(`process.memoryUsage().heapUsed`), but not a running total of the bytes
allocated. So the measurement works by making sure that the engine
doesn't collect any garbage while it runs.

1. Start Node with `--expose-gc` and a large young generation
   (`--max-semi-space-size=128`).
2. Force a full collection, then note the heap's size.
3. Run 10,000 frames, and note the heap's size again. Without a
   collection in between, the growth is exactly what the frames
   allocated. Keep the window the same length however long a frame
   takes. A game doesn't
   allocate the same in every frame, and windows sized to half a second
   reported 2.5 times as much for one demo.
4. Watch for collections with a `PerformanceObserver` for `gc` entries. If
   one ran, throw the window away, and try again with fewer frames.
5. Subtract the same measurement of an empty frame, which gives the
   measurement's own allocation.

Two checks keep it honest.

- **A deliberately wasteful case.** One view builds a template string and
  an `array.map()` result every frame. If the measurement doesn't report
  any allocation for it, the measurement is broken.
- **The benchmark's own variables.** A module-level `let` that holds a
  fractional number allocates a new number object on the heap at every
  `+=`. A benchmark that adds its results to such a variable reports that
  allocation against every case. Keep results in a `Float64Array`, which
  stores numbers in place.

To count garbage collections over time, count the `gc` entries and their
durations over a fixed number of frames, with Node's default heap
settings. To measure the memory that items keep alive, force a collection
before and after building many of them, and keep a reference to them.

## Vary One Thing at a Time

A frame's time usually has more than one part: something for each
container, and something for each dynamic property within each container.
Dividing the frame's time by one of them hides the other. An early result
here reported "nanoseconds per property" this way. Varying the dynamic
properties per container apart from the number of containers showed the
real shape. Each container takes a fixed time, plus a nanosecond or two
for each dynamic property. A static property, set once when the container
is built, doesn't take any time per frame.

So vary one thing at a time, such as the number of containers, the
dynamic properties per container, or the share changed per frame. Hold
the others fixed, and only then choose the unit to report.

## Read Profiles With Inlining in Mind

V8 inlines small functions into the functions that call them. With
inlining on, almost all the samples in a CPU profile land on the outermost
function of the frame. So the profile doesn't show where the time goes
inside it.

```sh
node --cpu-prof --cpu-prof-interval 25 bench.mjs
node --cpu-prof --max-inlined-bytecode-size=0 bench.mjs
```

The second form turns inlining off. That puts each sample back on its own
function, but slows everything down.

So use a profile taken with inlining off for relative shares only, never
for absolute times. `--trace-deopt` shows whether anything is
deoptimised after the warm-up.

## Measure the Whole Frame

Time everything a frame does to keep the view in step with the model: the
model's changes and the refresh, not the refresh alone. Signals and events
do their work when the model changes, so timing only the view's side makes
them look instant.

Say plainly what the measurement leaves out. The measurements in this
book leave out rendering, which means Pixi's transform updates and draw
calls. When values change, rendering is likely to take longer than
anything that was measured.

::: info In this book
The [benchmarks' README](https://github.com/yortus/mvt-games/blob/main/packages/internal/benchmarks/README.md)
says how to run the book's benchmarks, describes each suite, and
explains how the saved results become the tables in
[Appendix C](c-measurements.md).
:::

## Further Reading

- Andy Georges, Dries Buytaert and Lieven Eeckhout, "Statistically
  Rigorous Java Performance Evaluation", OOPSLA (2007). Why one run in one
  virtual machine isn't a measurement, and how to repeat runs across fresh
  processes and report the result.
- Tomas Kalibera and Richard Jones, "Rigorous Benchmarking in Reasonable
  Time", ISMM (2013). How many runs, at which levels, a reliable
  comparison needs.
- Vyacheslav Egorov,
  ["Microbenchmarks fairy tale"](https://mrale.ph/blog/2012/12/15/microbenchmarks-fairy-tale.html)
  (2012). How a JavaScript engine's optimiser can make a microbenchmark
  measure something other than what you meant, from one of V8's
  engineers.
- Andrey Akinshin, *Pro .NET Benchmarking* (2019). A thorough book on
  benchmarking methods, warm-up, noise and statistics. Most of it applies
  to any language with a just-in-time compiler.
