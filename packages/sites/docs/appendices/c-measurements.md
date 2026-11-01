# Measurements

> This appendix shows MVT's performance cost, as the book's benchmarks
> measure it. Polling a thousand Pixi containers takes a few microseconds
> a frame, and hand-written refresh methods don't leave any garbage.
> Signals beat polling only when very little changes, and the time that
> polling takes grows with the size of the scene. Each figure comes with
> an explanation of what it means, and the rest of the book quotes the
> short version below.

**Related:** [Why Performance Matters](../chapters/23-why-performance-matters.md) ·
[Hot Paths](../chapters/24-hot-paths.md) ·
[Measuring Performance](d-measuring-performance.md) ·
[Why Views Poll](../chapters/10-why-views-poll.md)

## The Short Version

- **Polling 1000 Pixi containers takes about 4-13 µs per frame when the
  scene is at rest,** under 0.1% of a 60 fps frame. It rises to 7-19 µs
  when every container changes. Hand-written refresh methods don't leave
  any garbage, however much changes, and the JSX runtime leaves 8 bytes a
  frame when any value changes.
- **The JSX runtime takes 1.8-2.7x as long as hand-written refresh
  methods.** That's about 5-9 ns more per container.
- **Signals are faster when a few values change, and slower when many
  do.** They win when fewer than about 2-9% of containers change per
  frame. When every container changes, they take 8-25x as long as
  polling, and their garbage made the engine collect 271 times a minute,
  where polling didn't need any collections.
- **Scene size matters more than it looks.** Past about 1,000
  containers, each one takes longer to poll. At 100,000 containers, each
  takes about 7.5 times as long as at 1,000, and polling the scene at rest
  takes about
  3.7 ms a frame, over a fifth of a 60 fps frame. Skipping inactive parts
  of the tree with `SKIP_DESCENDANTS` cut one such frame from 117 µs to
  9 µs.
- **Four of the patterns that the hot path rules warn against are much
  slower, and two don't make any difference in V8.** Over 1000 game
  objects, `Object.values()` is about 30 times slower than reading the
  properties, and leaves 80 KB of garbage a frame. A template-string key
  is about 12 times slower (48 KB), and `.filter().map()` about 4 times
  (24 KB). Summing 1000 numbers every frame is about 18 times slower than
  keeping the sum until a version number says one changed, though the
  summing takes under half a microsecond. That's one check in place of a
  thousand additions. Checking each of a few numbers for a change takes
  longer than adding them up again. A `Map` with number keys is 1.3 times
  slower than an array, and a closure made each frame leaves 56 bytes.
  `for...of` and a returned tuple don't take any extra time or memory.
- **The Arcade's games take 4-10 µs per frame** before drawing, well
  under 0.1% of a frame, and allocate from tens of bytes to about 1 KB a
  frame.

## The Benchmark Setup

Most of these benchmarks time one **frame**: the model changes, then the
view catches up. The benchmarks don't draw anything, so the figures never
include rendering.

- **A Pixi container** is one `Container`, whose properties (`x`, `y` and
  `alpha`) follow one model record, a plain object such as `{ x, y, alpha }`.
  Most benchmarks use 1000 of them.
- **Dynamic and static properties** are properties of each container. A
  dynamic property is updated every frame from a value in the model, so it
  can change. A static property is set once, when the scene is built, and
  never updated after that. "3 dynamic" means `x`, `y` and `alpha` are all
  dynamic, and "1 dynamic, 2 static" means only `x` is.
- **Changed per frame** is the share of containers that change in a frame.
  A container that changes gets a new value in every dynamic property, so
  this is also the share of dynamic properties that change. 0% is a scene at
  rest, and 100% means every container changes every frame.

These are the ways of keeping the containers in step with the model:

| Approach | How a change reaches the view |
| --- | --- |
| MVT (hand-written) | Each container's refresh method reads the model and sets its properties. `refreshView` calls them all, every frame. This is polling, as [Chapter 10](../chapters/10-why-views-poll.md) describes it |
| MVT (JSX) | The same polling, built with the JSX runtime from `@mvtjs/pixi`. Each dynamic property is passed as a getter that reads the model |
| Events | The model calls a listener for each record it changes, and the listener sets the properties |
| Solid signals | The model's values are [Solid](https://www.solidjs.com/) signals, with one effect per container that sets its properties when they change |
| Model only, without a view | Just the model's own changes, to show how much of a frame they take |

Each cell is the median of two runs, each in its own Node process. Where
the two disagreed by more than 5%, a third run decides. Figures are rounded
to 3 significant figures. Where the runs still disagreed by more than 5%
either way, the cell also shows half the spread between the fastest and
slowest run, as a share of the median. So `3.8 ±40%` marks a noisy result,
and a cell without "±" had runs within 5% of each other. Every run's
numbers are in the
[saved results](https://github.com/yortus/mvt-games/tree/main/packages/internal/benchmarks/results).
Times are in microseconds (µs). A frame at 60 frames per second lasts
16,667 µs.

<!--@include: ../../../internal/benchmarks/results/reactivity.md#environment-->

::: info About the figures
Every figure here comes from the one machine above, in Node.js's V8 engine,
without drawing anything. Absolute times will differ on other hardware, in
browsers, and in other engines. The ratios between approaches usually
carry over, and so do the patterns, such as what grows with the size of
the scene and what allocates. To get your own numbers, run the
benchmarks on your own machine. The
[benchmarks' README](https://github.com/yortus/mvt-games/blob/main/packages/internal/benchmarks/README.md)
says how.
:::

## Keeping Containers in Step

These tables follow 1000 Pixi containers, each keeping in step with one
model record, as the share changed per frame goes from 0% to 100%.

<!--@include: ../../../internal/benchmarks/results/reactivity.md#three-dynamic-->

<!--@include: ../../../internal/benchmarks/results/reactivity.md#one-dynamic-->

- **Polling takes about 4-13 µs per frame for 1000 containers at rest,**
  under 0.1% of a frame. It rises to 7-19 µs when every container
  changes, mostly because Pixi's setters then have real work to do.
- **Signals take very little time at rest, and about 240 ns per changed
  container.** With 1 dynamic property, that's about 100 ns. They're
  faster than polling until about 2-6% of containers change per frame
  with 3 dynamic properties, or 4-9% with 1. Past that they're slower, and
  when every container changes they take 8-25x as long.
- **Events are the fastest here, however many containers change,**
  because the model reports only what changed, and the view doesn't have
  to scan the containers. That is a timing, not a recommendation.
  [Chapter 10](../chapters/10-why-views-poll.md) covers the drawbacks of
  events for a game's design. At 1000 containers, the difference from
  polling is a few microseconds a frame.
- **The JSX runtime takes 1.8-2.7x as long as hand-written refresh
  methods.** That's about 5-9 ns more per container, most of it per
  container rather than per property. Its refresh methods are closures,
  without any generated code, so they work under any Content Security
  Policy. A static property doesn't take any time per frame. So in JSX,
  pass values that never change as plain values rather than getters.
- **The model's own changes are small:** at most 1.2 µs per frame, even
  with every record changed each frame.

## Scaling with Scene Size

These tables grow the same scene, with 3 dynamic properties per
container, from 100 to 100,000 containers. The first two divide each
frame's time by the number of containers, so a flat column means the time
grows in proportion to the scene.

<!--@include: ../../../internal/benchmarks/results/scaling.md#unchanged-->

<!--@include: ../../../internal/benchmarks/results/scaling.md#all-changed-->

- **The time per container is flat up to about 1,000 containers, then
  climbs.** Polling a scene at rest takes about 5 ns per container at
  1,000, 11 ns at 10,000 and 37 ns at 100,000. The likeliest cause is
  that a larger scene no longer fits in the processor's caches. So don't
  multiply a small scene's figures up to a large one.
- **At 100,000 containers, polling a scene at rest takes about 3.7 ms per
  frame** with hand-written refresh methods, and 5.0 ms with the JSX
  runtime. That's a fifth to a third of a 60 fps frame, before anything is
  drawn. In scenes that large,
  [skipping inactive parts of the tree](#the-performance-cost-of-refreshview)
  is worth doing.
- **Signals slow down at scale too.** With every container changed each
  frame, each one takes 239 ns at 1,000 containers and 435 ns at 100,000.
  That's 43.5 ms a frame, more than two and a half frames' worth.

<!--@include: ../../../internal/benchmarks/results/scaling.md#frame-time-->

## Occasional Changes and Derived Values

These tables use 1000 Pixi containers again. In the first, each follows a
value that changes only now and then, such as a level or a score, and
updates two properties when it does. Polling here means
[noticing the change](../chapters/09-noticing-changes.md): comparing with
last frame's value by hand, with `watch()`, or with a reaction made by
`createReaction`.

<!--@include: ../../../internal/benchmarks/results/change-detection.md#discrete-->

In the second, each container shows a value computed from 8 model values,
such as a total. Polling either recomputes it every frame, or uses
`watch()` on all 8 values and recomputes only when one changed, or reads a
computed value made by `createComputed`, which does the same for you.
Signals use a `createMemo`.

<!--@include: ../../../internal/benchmarks/results/change-detection.md#derived-->

- **`watch()` takes about 8 ns per watched value per frame.** A watcher of
  one value takes nearly three times as long as comparing by hand. It
  doesn't allocate anything (see [Memory](#memory-and-garbage-collection)),
  so the time goes on the calls. At game scale this is still small: 1000
  watchers of one value take about 12 µs a frame.
- **A reaction takes about half as long as `watch()`,** about 6 ns per
  frame. On a quiet frame, it only calls its getter and compares the value
  with the last one.
- **A computed value takes a little longer than `watch()` over the same
  values:** 76 µs a frame here, against 67. Each time it's read, it makes
  the same checks as `watch()`, with a little more work around them. It
  guards against a computed value that reads itself, and it gathers the
  values into a record for `compute` when one has changed.
- **Recomputing a quick derived value every frame is faster than checking
  whether it needs recomputing.** Summing 8 numbers takes less time than
  checking 8 numbers for changes. Noticing changes is worth it when the
  work it skips is slow, such as rebuilding text or changing the scene,
  not when the work is a little arithmetic. A sum over many numbers can be
  different: [the hot path patterns](#the-hot-path-rules) sum 1000
  numbers, and checking one version number in place of them all is about
  18 times faster.
- **A memo per container is slow when its inputs change often.** With
  every input changed each frame, Solid's memos take about 630 ns per
  container per frame, against about 12 ns to recompute by polling.

## Building, Destroying and Reusing Containers

The first table is the whole life of one Pixi container with 3 dynamic
properties. That's building it and its model record, bringing it up to
date once, and destroying it. A bare `new Container()` and `destroy()` is
included for scale.

<!--@include: ../../../internal/benchmarks/results/construction.md#build-->

The second is a pool of short-lived items, such as bullets, held in a
[`SlotList`](https://github.com/yortus/mvt-games/tree/main/packages/libraries/utils/src/slot-list).
About 500 are alive at once. Either `<List>` shows the slots, building one
container per slot and reusing it for every later item, or a hand-written
view builds a container for each new item and destroys it when the item
goes.

<!--@include: ../../../internal/benchmarks/results/construction.md#pool-->

- **A container takes about 0.1-0.5 µs over its life,** most of it in
  Pixi's own `Container`. With the JSX runtime or signals, it takes about
  3-4x as long as a bare container. Building a few containers a frame is
  quick. Building hundreds is slow.
- **Reusing containers makes a pool's time per frame the same however fast
  items come and go.** With `<List>`, the frame takes about 16-18 µs
  whether 5 or 50 items appear each frame. Building and destroying takes
  20 µs at 5 a frame and 91 µs at 50, and it allocates far more (see
  [Memory](#memory-and-garbage-collection)).

## The Performance Cost of `refreshView`

This section measures the time that `refreshView` itself takes, apart
from the work that the refresh methods do. Each refresh method here does
very little. `refreshView` is compared with a plain recursive walk over the
tree, which calls every refresh method it finds, and with Pixi's own
`onRender` callbacks. The last scenario has 100 groups of 100 containers,
and 90 of the groups are inactive. Those are either only hidden, or return
`SKIP_DESCENDANTS` from their own refresh method.

<!--@include: ../../../internal/benchmarks/results/refresh-view.md#passes-->

- **`refreshView` visits only the containers that have a refresh
  method.** It keeps a cached list of them, its method list. So in a large
  scene where only a few containers have one, it's hundreds of times faster than
  walking the tree: 0.6 µs against 197 µs, for 200 refresh methods among
  20,000 containers.
- **Its worst case is replacing many containers that have a refresh
  method, every frame.** 100 replacements a frame make `refreshView`
  rebuild its method list every frame, walking the tree to do it. That
  takes 105 µs, against 27 µs for a plain walk. The
  [`@mvtjs/pixi` README](https://github.com/yortus/mvt-games/blob/main/packages/libraries/pixi/src/README.md)
  explains why this is accepted.
- **It takes about 2 ns more per call than Pixi's `onRender`.** Those 2 ns
  go on checking for containers removed during the call.
- **Skipping inactive parts of the tree is worth doing at scale.** Returning
  `SKIP_DESCENDANTS` from 90 inactive groups cut the frame from 117 µs to
  9 µs. Hiding a container with `visible = false` doesn't stop its refresh
  methods from running.
- **Importing `@mvtjs/pixi` adds very little time to a tree that never
  uses it.** Once imported, the library watches for changes to the tree,
  so that it can rebuild its method lists when the tree changes. Even so,
  adding and removing 100 containers a frame took 11.1 µs with it
  imported, against 11.0 µs without, which is close to the noise.

## The Hot Path Rules

These tables measure patterns that the hot path rules in
[Chapter 24](../chapters/24-hot-paths.md) cover. Each pattern is written
two ways that compute the same result: the way a rule warns against, and
the way it recommends. The work is typical of a game's frame, over 1000
game objects. Each object is a plain record with a position, a velocity
and a few stats.

<!--@include: ../../../internal/benchmarks/results/hot-path-rules.md#time-->

<!--@include: ../../../internal/benchmarks/results/hot-path-rules.md#allocation-->

- **Four patterns clearly matter.** `Object.values()` per game object is
  about 30 times slower than reading the properties, and leaves 80 KB of
  garbage per frame. A template-string key is about 12 times slower
  (48 KB), and `.filter().map()` about 4 times (24 KB). Summing 1000
  scores every frame is about 18 times slower than keeping the sum until
  a version number says one changed, though the summing takes under half
  a microsecond. Where each number must be checked on its own, a sum of a
  few numbers is faster to recompute, as
  [Occasional Changes](#occasional-changes-and-derived-values) shows.
- **Two don't make any difference in V8.** A `for...of` loop over an array
  runs as fast as an index loop, and doesn't allocate anything. A function
  that returns a `[col, row]` tuple doesn't allocate anything either.
  Once the function is inlined, the engine never builds the array.
- **Two more matter a little.** A `Map` with number keys is 1.3 times slower
  than an array, but doesn't leave any garbage. A closure made each frame
  leaves 56 bytes, and takes too little time to measure.
- **Pixi's `Text` already skips unchanged text.** Setting the same string
  every frame takes about 7 ns per label. V8 reuses the strings of small
  numbers, so it doesn't allocate anything. Checking for a change first is
  still about 3 times faster.

## Memory and Garbage Collection

Garbage is memory that a frame allocates and then drops. The engine
reclaims it by pausing to collect it, so a game that allocates every frame
collects often. These tables show the bytes each frame allocates, how
often the engine collected over one simulated minute, and how much memory
each container keeps alive.

"MVT (hand-written, wasteful)" is the hand-written approach, plus building
a string and an array every frame, which the hot path rules warn against.
It's there to show that the measurement detects allocation when it
happens.

<!--@include: ../../../internal/benchmarks/results/memory.md#allocation-->

<!--@include: ../../../internal/benchmarks/results/memory.md#allocation-watched-->

<!--@include: ../../../internal/benchmarks/results/memory.md#allocation-discrete-->

<!--@include: ../../../internal/benchmarks/results/memory.md#allocation-pool-->

<!--@include: ../../../internal/benchmarks/results/memory.md#gc-->

<!--@include: ../../../internal/benchmarks/results/memory.md#gc-pool-->

<!--@include: ../../../internal/benchmarks/results/memory.md#retained-->

- **Polling allocates very little.** Hand-written refresh methods and
  `watch()` don't allocate anything per frame. The JSX runtime doesn't
  allocate anything at rest, and allocates 8 bytes a frame when any value
  changes, however many do. Over a simulated minute with every container
  changed each frame, the engine never needed to collect.
- **Signals allocate on every change.** Solid's effects left about 630
  bytes of garbage per changed container per frame, and about 100 bytes a
  frame even at rest. With everything changed each frame, that made 271
  collections a minute, about 37 ms of pauses. That's six times the
  garbage of the deliberately wasteful refresh methods.
- **Events don't allocate anything** in this benchmark, because each record's
  listener is created once, and called with the record.
- **These scenes use whole numbers.** V8 stores a whole number without
  allocating. It may box a fractional number, which means storing it in a
  small object on the heap, when it stores or passes one. Whether it does
  can depend on the code nearby. The JSX runtime avoids boxing in the
  properties it writes only on a change, such as `width`. 1000 sprites with
  a fractional `width` don't allocate anything per frame, changed or not.
- **Reusing containers avoids most of a pool's garbage.** With `<List>`
  over a `SlotList`, the only allocation is the new model records: 5.6 KB a
  frame at 50 new items. Building and destroying a container per item
  allocates about 70 KB a frame, and collects about three times as often.
- **A Pixi container is already about 710 bytes.** Following a model
  record with a hand-written refresh method or an event listener adds about
  170 bytes, the record included. The JSX runtime adds about 480, and
  signals and an effect about 1,800.

## The Arcade's Games and Demos

The Arcade's games and demos, as they ship, run under Node without drawing
anything. The games are driven by a fixed pattern of pretend input:
directions change every half second, and buttons are pressed every second
or so. The demos run unattended, as they do before anyone touches them.
Each frame is what [a tick](../chapters/05-the-tick.md) runs: the models'
update, then `updateView` and `refreshView` on the whole stage. The first
10 seconds are a warm-up, and times are averaged over the minute after.
The games were measured before several of them were redrawn, so their
figures may have moved a little since.

<!--@include: ../../../internal/benchmarks/results/games-and-demos.md#time-->

- **Each game takes 4-10 µs per frame,** well under 0.1% of a 60 fps
  frame, before drawing. Drawing isn't measured here, but it's likely to
  take far longer.
- **`refreshView` takes the larger share in most games,** since that's
  where the views read the model and set their properties. The models take
  0.2-4 µs, and `updateView` under 1 µs. In Galaxy Raiders, with more going
  on in its model, the models take longer than the refresh.
- **Two demos take far longer than any game, for different reasons.** Falling
  sand has a sprite for each grain, about 3,900 containers once its opening
  scene settles. Its refresh takes about 180 µs, about 47 ns per container
  while the grains are still. The
  [`falling-sand-scaling` results](https://github.com/yortus/mvt-games/blob/main/packages/internal/benchmarks/results/falling-sand-scaling.md)
  show how that grows with the number of grains: about 2 ms at 20,000.
  Boids takes about 0.5 ms, almost all of it in its model, which compares
  every pair of its 200 boids each frame.
- **The games allocate a little every frame,** from tens of bytes to about
  1 KB. The hot path rules aim for zero, and the allocation benchmark is a
  way to find where it comes from. At these rates the engine collects at
  most once a minute, for well under a millisecond.

<!--@include: ../../../internal/benchmarks/results/games-and-demos.md#allocation-->

<!--@include: ../../../internal/benchmarks/results/games-and-demos.md#gc-->

## Limits of the Measurements

- **Rendering.** The benchmarks don't draw anything, so the figures never
  include Pixi's transform updates and draw calls. When values change,
  rendering is likely to take longer than anything measured here.
- **Browsers.** Everything is V8 under Node, on one machine. Other
  engines, and the same engine in a browser, may differ. Ratios travel
  better than absolute times.
- **Textures and text.** The games and demos run with every texture
  replaced by a 1x1 white texture, because loading a spritesheet needs a
  browser. Text widths are estimated from the font size, because measuring
  text needs a canvas.

[Appendix D](d-measuring-performance.md) explains how these figures were
measured, and why each step is there.
