# Change Detection

> Poll every frame, rebuild only on change. The Watch pattern provides
> efficient reactivity for view bindings that change rarely but trigger
> expensive work.

**Related:** [Reactivity: Why Polling](reactivity.md) -
[Events and Signals](events-and-signals.md) -
[Bindings (Learn)](../learn/bindings.md) -
[Bindings in Depth](bindings-in-depth.md) -
[Hot Paths](hot-paths.md)

---

*Assumes familiarity with [Bindings](../learn/bindings.md) and [Views](../learn/views.md).*

> **Terminology note:** We use "change detection" in its literal sense -
> comparing a current value against a previous value. This is distinct from
> the framework-specific meanings: Angular's zone-based change detection
> cycle, or React's virtual DOM reconciliation. The underlying idea - skip
> work when nothing changed - is the same, but the mechanism here is
> explicit per-value comparison, not framework-managed tree diffing.

## The Problem

Re-evaluating every binding every frame is correct but not always efficient.
Some bindings represent continuous state that changes every frame (entity
positions), while others represent discrete state that changes rarely
(dimensions, configuration, game phase). For discrete changes that trigger
expensive work - rebuilding a grid, tearing down and recreating child views -
running that work every frame wastes resources.

## Manual Previous-Value Tracking

The simplest approach is tracking the previous value yourself:

```ts
let prevScore = -1;

function refresh(): void {
    const score = bindings.getScore();
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
    rows: bindings.getRows,
    cols: bindings.getCols,
    phase: bindings.getPhase,
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

| Property   | Type      | Description                              |
| ---------- | --------- | ---------------------------------------- |
| `changed`  | `boolean` | Whether the value differs from last poll |
| `value`    | `T`       | The most recent value                    |
| `previous` | `T`       | The value from the prior poll            |

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
| Continuous state (entity x/y)                                 | Read binding directly - change detection adds overhead for no gain |
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
    phase: bindings.getGamePhase,
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

For the basics of bindings, see [Bindings (Learn)](../learn/bindings.md).
For hot-path considerations, see [Hot Paths](hot-paths.md).
