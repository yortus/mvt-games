# Change Detection

> Poll every frame, rebuild only on change. The Watch pattern provides
> efficient reactivity for view bindings that change rarely but trigger
> expensive work.

**Related:** [Reactivity: Why Polling](why-polling.md) -
[Events and Signals](events-and-signals.md) -
[Bindings (Learn)](../presenting-the-world/bindings.md) -
[Bindings in Depth](../presenting-the-world/bindings-in-depth.md) -
[Hot Paths](../performance/hot-paths.md) -
[Sound and Music](../presenting-the-world/sound.md)

---

*Assumes familiarity with [Bindings](../presenting-the-world/bindings.md) and [Views](../presenting-the-world/views.md).*

> **Terminology note:** We use "change detection" in its literal sense -
> comparing a current value against a previous value. This is distinct from
> the framework-specific meanings: Angular's zone-based change detection
> cycle, or React's virtual DOM reconciliation. The underlying idea - skip
> work when nothing changed - is the same, but the mechanism here is
> explicit per-value comparison, not framework-managed tree diffing.

## The Problem

Re-evaluating every binding every frame is correct but not always efficient.
Some bindings represent continuous state that changes every frame (the
positions of moving objects), while others represent discrete state that changes rarely
(dimensions, configuration, game phase). For discrete changes that trigger
expensive work - rebuilding a grid, tearing down and recreating child views -
running that work every frame wastes resources.

## Manual Previous-Value Tracking

The simplest approach is tracking the previous value yourself:

```ts
let prevScore = -1;

function refresh(): void {
    const score = bindings.score();
    if (score !== prevScore) {
        prevScore = score;
        label.text = String(score);
    }
}
```

This works well for one or two values. For views with many watched bindings,
it becomes repetitive.

## The `watch()` Helper

This project provides a `watch()` factory that wraps multiple getters and
tracks changes with `===` comparison. On each `poll()` call, every getter is
re-evaluated and the result reports which values changed:

```ts
const watcher = watch({
    rows: bindings.rows,
    cols: bindings.cols,
    phase: bindings.phase,
});

function refresh(): void {
    const w = watcher.poll();
    if (w.rows.changed || w.cols.changed) {
        rebuildGrid(w.rows.value, w.cols.value);
    }
    if (w.phase.changed) {
        rebuildOverlay(w.phase.value);
    }
}
```

Each property on the poll result provides:

| Property    | Type             | Description                                       |
| ----------- | ---------------- | ------------------------------------------------- |
| `changed`   | `boolean`        | Whether the value differs from last poll          |
| `value`     | `T`              | The most recent value                             |
| `previous`  | `T \| undefined` | The value from the prior poll                     |
| `increased` | `boolean`        | For a number, whether it changed to a greater one |
| `decreased` | `boolean`        | For a number, whether it changed to a lesser one  |

When a getter returns a number, its property also has `increased` and
`decreased`. They compare `value` with `previous`, so both are false when
nothing changed. Both are also false on the first poll, because there is no
previous value yet. The property of a getter that returns anything else
has neither, and reading one is a type error.

All getters are polled unconditionally on every call - no short-circuit
evaluation that might skip a poll and miss a change.

Note: `watch()` is a helper specific to this project, not an MVT
architectural requirement. The underlying concept - polling for changes and
acting only when values differ - can be implemented in whatever way suits your
codebase.

### First-poll behaviour

On the first `poll()` call, every watched value reports `changed: true`
(because the previous value starts as `undefined`). This means any
change-guarded setup work runs automatically on the first frame without
special initialization code. If your setup logic is expensive and should run
exactly once at construction time instead, perform that work before the first
`refresh()` rather than relying on the first poll.

When a view should react only to changes that happen after it is made,
poll once as it is made. The first `refresh()` then sees no change. Views
that play sound need this. For example, a game that is already over when
its view is made should not play the game-over tune.

```ts
const watcher = watch({ isAlive: bindings.isAlive });
// The first refresh hears only what changes after the view is made
watcher.poll();
```

A view in a [`<List>`](../presenting-the-world/collections.md) is a special
case. The list reuses the view for each later item in its slot, so a poll
at construction covers only the slot's first item. When a new item
arrives, the next poll reports each difference from the old item as a
change. [Sound and Music](../presenting-the-world/sound.md#audio-views-in-a-list)
shows how a view in a list can react only to real changes.

### The `Watchable` type restriction

Getters must return a `Watchable` type - `string | number | boolean | null
| undefined`. Objects and arrays are excluded because `===` only checks
reference identity and does not detect mutations within objects or arrays.
Watching an object or array directly is most often a bug, as the likely
intent (detecting internal changes) does not match the actual behaviour
(detecting reference replacement). The `Watchable` restriction prevents such
bugs at the type level.

To watch a collection, derive a primitive:

```ts
// Watch the length, not the array itself.
const watcher = watch({
    enemyCount: () => game.enemies.length,
});
```

If you genuinely need to detect reference replacement of an object (e.g. the
model swaps out an entire sub-model), that is a valid use case - but it
cannot be expressed through `watch()`. Use a manual previous-reference check
instead.

## When to Use Change Detection

| Situation                                                     | Approach                                                          |
| ------------------------------------------------------------- | ----------------------------------------------------------------- |
| Continuous state (a moving object's x/y)                      | Read binding directly - change detection adds overhead for no gain |
| Discrete state, reaction is cheap (text label)                | Compare previous value - skip redundant updates                   |
| Discrete state, reaction is expensive (presentation rebuild)  | Essential - avoid rebuilding 60 times per second                  |

The decision is straightforward: if the cost of detecting changes exceeds the
cost of just doing the work, skip the detection.

## Change Detection as Consumer-Defined Events

Another way to think of change detection is as **consumer-defined events**.
Traditional event systems require the producer to decide what constitutes an
event and emit it. Consumers must subscribe, unsubscribe, and hope the
producer fires at the right granularity.

With change detection, the **consumer** defines what matters by choosing which
bindings to watch and what to do when they change. The model does not need to
know anyone is listening:

```ts
const watcher = watch({
    phase: bindings.gamePhase,
});

function refresh(): void {
    const w = watcher.poll();
    if (w.phase.changed) {
        // This view decided phase transitions matter.
        // The model didn't need an "onPhaseChange" event.
        rebuildOverlay(w.phase.value);
    }
}
```

A second view can watch the same binding and react differently - or ignore it
entirely. No event registration, no coupling to the producer's event API, and
no risk of missing or double-handling an event.

### Counts: Moments That Repeat

A phase reports a change only when it becomes something else. Some moments
are not a change of state at all. A ship that fires twice in a row is still
a ship that is flying. For moments like these, the model keeps a
**count**, and a view watches it rise:

```ts
// In the model: one more each time it happens
shotsFired++;

// In a view: a rise is a shot
const w = watcher.poll();
if (w.shots.increased) sound.play(SHOT);
```

- The **first value is not a rise**. On the first poll `previous` is
  `undefined`, so `increased` is false.
- **Going back to 0** for a new game is not a rise either.
- **Several in one tick** are one rise. When the view needs to know about
  them (how big a rock broke), the model keeps the **last one's details**
  beside the count (`lastBrokenRockSize`).

A count is the model's half of a consumer-defined event. The model says
how many times something has happened, in its own terms. It knows nothing
of who watches. A count is plain state, so it is as easy to test as any
other state.
[Sound and Music](../presenting-the-world/sound.md) relies on counts
throughout.

## Dynamic Child Lists

A common use case is rebuilding a list of child views when the underlying
model collection changes. Watch the collection length to detect additions or
removals:

```ts
const watcher = watch({
    asteroidCount: () => game.asteroids.length,
    bulletCount: () => game.bullets.length,
});

function refresh(): void {
    const w = watcher.poll();
    if (w.asteroidCount.changed) rebuildAsteroidViews();
    if (w.bulletCount.changed) rebuildBulletViews();
}
```

This avoids tearing down and recreating every child view on every frame. Only
when the count actually changes does the rebuild run.

---

For the basics of bindings, see [Bindings (Learn)](../presenting-the-world/bindings.md).
For hot-path considerations, see [Hot Paths](../performance/hot-paths.md).
