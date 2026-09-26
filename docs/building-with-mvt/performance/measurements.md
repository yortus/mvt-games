# Performance Measurements

> MVT cost measurements: keeping Pixi containers in step with a
> model, reacting to changes, building and reusing containers, the scene
> passes, each hot path rule, memory and garbage collection, and the games
> and demos themselves. The tables come straight from this repo's
> [benchmark suites](https://github.com/yortus/mvt-games/tree/main/benchmarks), and each section says what the
> numbers mean.

**Related:** [Why Performance Matters](why-performance-matters.md) · [Hot Paths](hot-paths.md) · [Benchmarking Methods](benchmarking-methods.md) ·
[Reactivity: Why MVT Uses Polling](../reacting-to-changes/why-polling.md)

---

## What Is Measured

Most benchmarks here time one **frame**: the model changes, then the view
catches up. Nothing is drawn, so rendering is not included in any number.

- **Pixi container**: one `Container`, whose properties (`x`, `y`, `alpha`)
  follow one model record, a plain object such as `{ x, y, alpha }`. Most
  benchmarks use 1000 of them.
- **Dynamic and static properties**: properties on each Pixi container, such
  as `x` and `alpha`. A dynamic property is updated every frame to reflect a
  value in the model, so it can change. A static property is assigned once
  when the scene is built, and never updated from the model after that. "3
  dynamic" means `x`, `y` and `alpha` are all dynamic; "1 dynamic, 2 static"
  means only `x` is.
- **Changed per frame**: the share of containers that change in a given frame.
  A container that changes gets a new value in every one of its dynamic
  properties, so this is also the share of dynamic properties that change. 0%
  is a scene at rest; 100% means every container changes every frame.

The ways of keeping the containers in step with the model:

| Approach | How the view learns about a change |
| --- | --- |
| MVT (hand-written) | Each container's `onRefresh` method reads the model and assigns its properties, run by `refreshScene` every frame. This is polling, as the rest of these docs describe it |
| MVT (JSX) | The same polling, but built with this repo's JSX runtime (`src/pixi-jsx/`), where each dynamic property is given as a function that reads the model |
| Events | The model calls a listener for each record it changes, and the listener assigns the properties |
| Solid signals | The model's values are [Solid](https://www.solidjs.com/) signals, with one effect per container that assigns its properties when they change |
| Model only, no view | Just the model's changes, to show how much of a frame they are |

Each cell is the median of three runs, each in its own Node process, rounded
to 3 significant figures. Where the runs disagreed by more than 5% either way,
the cell also shows half the spread between the fastest and slowest run, as a
share of the median: `3.8 ±40%` marks a noisy result. A cell without "±" had
runs within 5% of each other. Every run's numbers are in the
[saved results](https://github.com/yortus/mvt-games/tree/main/benchmarks/results).
Times are in microseconds (µs); a frame at 60 frames per second lasts
16,667 µs.

<!--@include: ../../../benchmarks/results/reactivity.md#environment-->

::: info About the figures
Every figure on this page comes from the one machine above, in Node.js's V8
engine, with nothing drawn. Absolute times will differ on other hardware, in
browsers, and in other engines. The ratios between approaches, and the
patterns (what grows with scene size, what allocates), are what generally carry over.
Re-run the benchmarks on your own machine to get your own numbers; see
[Benchmarking Methods](benchmarking-methods.md#running-the-repo-s-benchmarks).
:::


## The Short Version

- **Polling 1000 Pixi containers costs 5-15 µs per frame** and leaves no
  garbage, however much changes.
- **Signals are cheaper when little changes, and dearer when a lot
  does.** They win when fewer than about 4-10% of containers change per frame, cost
  7-13x as much when everything changes, and leave garbage on every change.
- **Scene size matters more than it looks.** Past a few thousand containers
  the cost per container climbs; 100,000 containers at rest cost about 3.7 ms
  per frame. Skipping inactive subtrees with `SKIP_DESCENDANTS` is the remedy.
- **Four hot path rules matter a lot, two not at all (in V8).** Strings built
  per game object, `Object.values()`, array methods and recomputing unchanged values
  cost several to tens of times more, and the first three leave kilobytes of
  garbage per frame. `for...of` and returned tuples cost nothing extra.
- **This repo's games take 5-12 µs per frame** before drawing.

## Keeping Containers in Step

1000 Pixi containers, each following one model record, as the share changed
per frame goes from nothing to everything.

<!--@include: ../../../benchmarks/results/reactivity.md#three-dynamic-->

<!--@include: ../../../benchmarks/results/reactivity.md#one-dynamic-->

- **Polling costs about 5-9 µs per frame for 1000 containers at rest**, about
  0.05% of a frame. It rises to 10-15 µs when everything changes, mostly
  because Pixi's setters then have real work to do.
- **Signals cost almost nothing at rest, and about 130 ns per changed
  container (55 ns with 1 dynamic property).** They are cheaper than polling
  until about 4-6% of containers change per frame with 3 dynamic properties,
  or 9-11% with 1. Past that they cost more, and when everything changes they
  cost 7-13x as much.
- **Events are the cheapest here however many containers change**, because the model
  only notifies about what changed and nothing is scanned. That is a timing,
  not a recommendation: [Events and Signals](../reacting-to-changes/events-and-signals.md)
  covers what events cost in design, and at 1000 containers the difference
  from polling is a few microseconds per frame.
- **The JSX runtime costs 1.2-1.7x as much as hand-written refresh methods**: about 1 ns
  more per dynamic property. A static property costs nothing per frame, so in
  JSX, pass values that never change as plain values rather than getters.
- **The model's own changes are small**: at most 1.4 µs per frame, even with
  every record changed each frame.

## Scaling

The same scene, with 3 dynamic properties per container, from 100 to 100,000
containers. These tables divide each frame's time by the number of
containers, so a flat column means the cost grows in proportion.

<!--@include: ../../../benchmarks/results/scaling.md#unchanged-->

<!--@include: ../../../benchmarks/results/scaling.md#all-changed-->

- **The cost per container is flat up to about 1,000 containers, then climbs.**
  Polling a scene at rest costs about 5 ns per container at 1,000, 12 ns at
  10,000, and 37 ns at 100,000: past a few thousand containers, the scene no
  longer fits in the CPU's caches. Do not multiply a small scene's numbers up
  to a large one.
- **At 100,000 containers, polling a scene at rest takes about 3.7 ms per frame**
  with hand-written refresh methods, and 4.8 ms with the JSX runtime: roughly a quarter
  of a 60fps frame, before anything is drawn. Scenes that large are where
  [skipping inactive subtrees](#the-scene-passes) pays.
- **Signals slow down at scale too.** With everything changed each frame, each container
  costs 130 ns at 1,000 containers and 350 ns at 100,000, which is 35 ms per
  frame: more than two frames' worth.

<!--@include: ../../../benchmarks/results/scaling.md#frame-time-->

## Occasional Changes and Derived Values

1000 Pixi containers again. In the first table, each follows a value that
changes only occasionally, such as a level or a score, and updates two
properties when it does. Polling here means [change detection](../reacting-to-changes/change-detection.md):
comparing with last frame's value, either by hand or with the `watch()` helper.

<!--@include: ../../../benchmarks/results/change-detection.md#discrete-->

In the second, each container shows a value computed from 8 model values,
such as a total. Polling either recomputes it every frame, or uses `watch()`
on all 8 values and recomputes only when one changed. Signals use a
`createMemo`.

<!--@include: ../../../benchmarks/results/change-detection.md#derived-->

- **`watch()` costs about 8 ns per watched value per frame**, over three times
  as much as comparing by hand. It allocates nothing (see
  [Memory](#memory-and-garbage-collection)), so the cost is in the calls. The
  likely cause, not yet confirmed with a profile, is that every watcher calls
  its getters from the same line of `poll()`, which the engine cannot inline
  when it sees thousands of different getters there. At game scale this is
  still small: 1000 watched values cost about 12 µs per frame.
- **Recomputing a cheap derived value every frame is cheaper than detecting
  whether it needs recomputing.** Summing 8 numbers costs less than checking 8
  numbers for changes. Change detection pays when the work it skips is
  expensive, such as rebuilding text or restructuring the scene, not when the
  work is a little arithmetic.
- **A memo per container is expensive when its inputs change often.** With
  every input changed each frame, Solid's memos cost about 295 ns per container per
  frame, against about 13 ns to recompute by polling.

## Building, Destroying and Reusing Containers

The first table is the whole life of one Pixi container with 3 dynamic properties:
building it and its model record, bringing it up to date once, and destroying
it. A bare `new Container()` and `destroy()` is included for scale.

<!--@include: ../../../benchmarks/results/construction.md#build-->

The second is a pool of short-lived items, such as bullets, held in a
[`SlotList`](https://github.com/yortus/mvt-games/tree/main/src/common/slot-list).
About 500 are alive at once. Either
`<List>` shows the slots, building one container per slot and reusing it for
every later item, or a hand-written view builds a container for each new item
and destroys it when the item goes.

<!--@include: ../../../benchmarks/results/construction.md#pool-->

- **A container costs about 0.1-0.5 µs over its life**, most of it Pixi's own
  `Container`. The JSX runtime and signals cost about 3x a bare container.
  Building a few containers per frame is cheap; building hundreds is not.
- **Reusing containers makes a pool's cost independent of how fast items come
  and go.** With `<List>`, the frame costs about 14 µs whether 5 or 50 items
  appear per frame. Building and destroying costs 20 µs at 5 per frame and
  91 µs at 50, and it allocates far more (see [Memory](#memory-and-garbage-collection)).

## The Scene Passes

What `refreshScene` itself costs, apart from the work the `onRefresh` methods
do: each one here does almost nothing. It is compared with a plain recursive
walk over the tree, which calls every `onRefresh` it finds, and with Pixi's own
`onRender` callbacks. The last scenario has 100 groups of 100 containers, 90 of
the groups inactive, either only hidden or returning `SKIP_DESCENDANTS` from
their own `onRefresh`.

<!--@include: ../../../benchmarks/results/scene-passes.md#passes-->

- **`refreshScene` visits only the containers that have an `onRefresh`.** In
  a large scene where few containers have one, it is hundreds of times faster
  than walking the tree: 0.6 µs against 200 µs for 200 `onRefresh` methods
  among 20,000 containers.
- **Replacing many containers that have an `onRefresh` every frame is its
  worst case.** The pass caches which containers have one, and 100
  replacements per frame make it rebuild that cache every frame: 91 µs,
  against 36 µs for a plain walk. The
  [`src/pixi-mvt/` README](https://github.com/yortus/mvt-games/blob/main/src/pixi-mvt/README.md)
  explains why this is accepted.
- **It costs about 1.5 ns more per call than Pixi's `onRender`**, which is what
  checking for removed containers mid-pass costs.
- **Skipping inactive subtrees pays at scale.** Returning `SKIP_DESCENDANTS`
  from 90 inactive groups cut the frame from 126 µs to 9 µs. Hiding a
  container with `visible = false` does not stop its `onRefresh` methods from
  running.
- **Importing the plugin costs a tree that never uses it about 8 ns per added
  and removed container**, for tracking changes to the tree.

## The Hot Path Rules

Each rule on the [Hot Paths](hot-paths.md) page, written two ways that compute
the same result: the pattern the rule warns against, and the one it
recommends. The work is typical of a game's frame, over 1000 game objects (plain
objects with a position, a velocity and a few stats).

<!--@include: ../../../benchmarks/results/hot-path-rules.md#time-->

<!--@include: ../../../benchmarks/results/hot-path-rules.md#allocation-->

- **Four rules clearly matter.** `Object.values()` per game object is 44x slower
  than reading the properties and leaves 80 KB of garbage per frame. A
  template-string key is 16x slower (48 KB), `.filter().map()` 4x (24 KB), and
  recomputing an unchanged sum 20x, though that last one costs only 0.4 µs.
- **Two make no difference in V8.** A `for...of` loop over an array runs as
  fast as an index loop and allocates nothing. A function returning a
  `[col, row]` tuple allocates nothing either: once it is inlined, the engine
  never builds the array.
- **Two matter a little.** A `Map` with numeric keys is 2.4x slower than an
  array but leaves no garbage. A closure created per frame costs 56 bytes and
  no measurable time.
- **Pixi's `Text` already skips unchanged text.** Setting the same string
  every frame costs about 7 ns per label, and V8 reuses the strings of small
  numbers, so it allocates nothing. Checking for a change first is still about
  4x cheaper.

## Memory and Garbage Collection

Garbage is memory a frame allocates and then drops. The engine reclaims it by
pausing to collect it, and a game that allocates every frame collects often.
These tables show the bytes each frame allocates, how often the engine
collected over one simulated minute, and how much memory each container keeps
alive. "MVT (hand-written, wasteful)" is the hand-written approach, plus
building a string and an array every frame, as the hot path rules warn
against. It is there to show that the measurement sees allocation when it
happens.

<!--@include: ../../../benchmarks/results/memory.md#allocation-->

<!--@include: ../../../benchmarks/results/memory.md#allocation-discrete-->

<!--@include: ../../../benchmarks/results/memory.md#allocation-pool-->

<!--@include: ../../../benchmarks/results/memory.md#gc-->

<!--@include: ../../../benchmarks/results/memory.md#gc-pool-->

<!--@include: ../../../benchmarks/results/memory.md#retained-->

- **Polling allocates next to nothing.** Hand-written refresh methods and `watch()`
  allocate nothing per frame, and the JSX runtime a constant 8 bytes per
  frame, however much changes. Over a simulated minute with everything
  changed each frame, the engine never needed to collect.
- **Signals allocate on every change.** Solid's effects left about 380 bytes
  of garbage per changed container per frame, and 64 bytes per frame even at
  rest. With everything changed each frame, that is 167 collections a minute, about
  24 ms of pauses: four times the garbage of the deliberately wasteful refresh methods.
- **Events allocate nothing** in this benchmark, because each record's
  listener is created once and called with the record.
- **Reusing containers avoids most of a pool's garbage.** With `<List>` over a
  `SlotList`, the only allocation is the new model records (5.6 KB per frame at
  50 new items). Building and destroying a container per item allocates about
  60 KB per frame, and collects about three times as often.
- **A Pixi container is already about 710 bytes.** Following a model record
  with a hand-written refresh method or an event listener adds about 170 bytes,
  including the record itself; the JSX runtime adds about 420, and signals
  and an effect about 1,800.

## The Games and Demos

This repo's games and demos as they ship, each started through its entry and
run under Node with nothing drawn. The games are driven by a fixed pattern of
simulated input: directions changing every half second and buttons pressed
every second or so. The demos run unattended, as they do before anyone touches
them. Each frame is what [the game loop](../the-game-loop.md) runs: the
session's update (its model, then `updateScene` over its view), then
`refreshScene`. The first 10 seconds are a warm-up, and times are averaged over
the minute after.

<!--@include: ../../../benchmarks/results/games-and-demos.md#time-->

- **Each game takes 5-12 µs per frame**, well under 0.1% of a 60fps frame,
  before drawing. Drawing is not measured here, but is likely to cost far
  more.
- **`refreshScene` takes the larger share in most games**, since that is
  where the views read the model and set their properties. The updates take
  1-6 µs; in Galaga and Pac-Man, with more going on in their models, they
  take as long as the refresh or longer.
- **Two demos cost far more than any game, for different reasons.** Falling
  sand has a sprite per grain, about 3,800 containers once its opening scene
  settles, and its refresh takes about 190 µs, about 50 ns per container with
  nothing moving. How that grows with the number of grains is in the
  [`falling-sand-scaling` results](https://github.com/yortus/mvt-games/blob/main/benchmarks/results/falling-sand-scaling.md):
  about 2.6 ms at 20,000 grains. Boids takes about 1 ms, almost all of it in
  its model, which compares every pair of its 200 boids each frame.
- **The games allocate a little every frame**, from tens of bytes to about
  2.7 KB. The hot path rules aim for none, and the allocation benchmark is a
  way to find where it comes from. At these rates the engine collects at most
  three times a minute, for under a millisecond in total.
- **Boids allocates about 360 KB per frame**, and the engine collects 88 times
  a minute, for about 30 ms in total. Its model allocates nothing per frame;
  its view redraws all 200 boids into a Pixi `Graphics` every frame, and Pixi
  builds new shape data each time.

<!--@include: ../../../benchmarks/results/games-and-demos.md#allocation-->

<!--@include: ../../../benchmarks/results/games-and-demos.md#gc-->

## What Is Not Measured

- **Rendering.** Nothing is drawn, so Pixi's transform updates and draw calls
  are not in any number. When values change, rendering is likely to cost more
  than anything measured here.
- **Browsers.** Everything is V8 under Node on one machine. Other engines, and
  the same engine in a browser, may differ; ratios travel better than absolute
  times.
- **Textures and text.** The games and demos run with every texture replaced
  by a 1x1 white texture, because loading a spritesheet needs a browser, and
  with text widths estimated from the font size, because measuring text needs
  a canvas.

To re-run any of this, see
[Benchmarking Methods - Running the Repo's Benchmarks](benchmarking-methods.md#running-the-repo-s-benchmarks).
