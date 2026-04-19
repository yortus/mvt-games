# Reactivity: Why MVT Uses Polling

> In a tick-based game loop, the model updates before the view reads. The
> simplest and most robust way for views to react is to poll: read current
> state, compare to previous state, act on differences.

**Related:** [Change Detection](change-detection.md) -
[Events and Signals](events-and-signals.md) -
[The Game Loop](../learn/game-loop.md) -
[Hot Paths](hot-paths.md)

---

## The Change-Detection Problem

When model state changes, the view needs to know. Reactivity is the mechanism
that connects the two. There are three broad strategies:

| Strategy | Who initiates? | Example |
|----------|---------------|---------|
| **Events** (push) | The model emits | DOM `addEventListener`, Node.js `EventEmitter` |
| **Signals** (push-pull) | The runtime tracks dependencies | SolidJS `createSignal`, Angular signals |
| **Polling** (pull) | The view checks each frame | Game-loop `refresh()`, React virtual DOM diffing |

All three work. The question is which fits the constraints of a frame-based
game loop.

## The Game Loop Already Answers "When?"

The central question any reactivity system must answer is: *when should
dependent code re-evaluate?*

- In a **UI app**, there is no natural answer - the user might click a button,
  a network response might arrive, a timer might fire. Push-based systems
  (events, signals) answer the question by notifying dependents when something
  changes.
- In a **tick-based game**, the answer is already decided: *every frame*. The
  ticker calls `model.update(deltaMs)`, then `view.refresh()`. Every frame, the
  view has the opportunity to read the model's current state.

Because the view already runs every frame, the question shifts from "when
should I check?" to "what changed since last frame?" That is a change-detection
problem, and polling solves it with minimal machinery.

## Why Polling Fits

### Models stay simple

Models are plain objects with getters. They do not need to emit events, wrap
values in signals, or know that anyone is observing them. This keeps models
focused on simulation logic and easy to test.

```ts
// The model has no idea it is being watched.
// No emitter, no signals, no reactive runtime.
function createScoreModel() {
    let score = 0;
    return {
        get score() { return score; },
        addPoints(n: number) { score += n; },
    };
}
```

### Consistency is free

In a tick-based loop, `model.update()` finishes before `view.refresh()` runs.
Every getter the view calls reads fully-settled, post-update state. There is no
risk of seeing a half-updated model - no glitches, no need for batching, no
scheduler.

Push-based systems must work harder for the same guarantee. Events can fire
mid-mutation (see [Events and Signals - Sync Events](events-and-signals.md#challenge-sync-events-and-inconsistent-state)).
Signals need a scheduler and batching semantics to avoid glitch states.

### No subscriptions, no leaks

Poll-based views have no subscriptions to manage. When a view is removed from
the scene graph, its `refresh()` stops being called. The watcher and its
closure become unreachable and are garbage-collected. There is nothing to
dispose.

Events and signals both require explicit cleanup - `off()` or `dispose()` -
at every lifecycle boundary. Forgetting cleanup is a silent leak: the handler
or effect keeps running on a detached view, consuming resources with no
visible symptom.

### Consumer-defined reactions

The view decides what to watch. If a view cares about phase transitions, it
watches the phase getter. If another view cares about score thresholds, it
watches the score getter. The model does not need to anticipate these needs.

With events, the model must pre-declare every event of interest. A new view
that needs a new reaction requires changing the model. With signals, the model
must wrap values in signal containers - values not wrapped are invisible to
effects.

Polling treats all readable state uniformly. Any getter can be watched.

### Per-tick state is just a read

Positions, velocities, animation progress - these change every frame. In a
polling system, per-tick values are read directly with no reactive overhead:

```ts
// No watcher needed - just read it.
sprite.x = model.col * TILE_SIZE;
```

With signals, per-tick values must still be wrapped in signals for effects to
work - but the dependency tracking overhead is pure waste when the consumer
reads the value every frame anyway. Events are even less suited: emitting 60
times per second per value creates dispatch overhead for no benefit.

## The Hybrid Pattern

Not all state changes every frame. Scores, phases, lives - these change
infrequently but may trigger expensive view work (rebuilding text, restructuring the scene). Polling these values with `===` comparison is
cheap, and skipping the expensive work when nothing changed is valuable.

The `watch()` helper encapsulates this:

```ts
const watcher = watch({
    phase: () => model.phase,
    score: () => model.score,
});

function refresh(): void {
    const w = watcher.poll();

    if (w.phase.changed) rebuildAppearance(w.phase.value);
    if (w.score.changed) scoreLabel.text = String(w.score.value);

    // Per-tick values - just read directly
    sprite.x = model.col * TILE_SIZE;
    sprite.y = model.row * TILE_SIZE;
}
```

This gives the best of both worlds: cheap change detection for infrequent
state, zero overhead for per-frame state.

## Tradeoffs

Polling is not free. Every watcher getter runs every frame, even when nothing
changed. At game-typical scale (10-50 watched values), the cost is negligible -
well under 1% of the 16.6ms frame budget. But it is a fixed cost per tick,
unlike events and signals which have zero cost when idle.

Derived state must be computed in the model or in getter expressions. There is
no equivalent of `createMemo` that automatically caches and invalidates.
In practice, model-layer derivation is straightforward and keeps complexity
where it belongs - in the model.

For a detailed look at the tradeoffs of events and signals in game contexts,
see [Events and Signals](events-and-signals.md).

## Summary

| Concern | Polling | Events | Signals |
|---------|---------|--------|---------|
| "When to re-evaluate?" | Already answered - every frame | Source decides | Runtime decides |
| Model complexity | Plain getters | Must emit events | Must wrap in signals |
| Consistency | Free (update-then-read) | Requires emit-after-mutation discipline | Requires batching and scheduling |
| Cleanup | None | Manual `off()` per subscription | Manual `dispose()` per scope |
| Per-tick values | Direct read, zero overhead | Wasteful (60 emits/sec) | Wasteful (60 signal writes/sec) |
| Consumer flexibility | Watch any getter | Limited to declared events | Limited to signal-wrapped values |

In a frame-based game loop, polling is the simplest approach that works
correctly by default.

---

**Next:** [Change Detection](change-detection.md) - the `watch()` helper and
practical patterns for poll-based reactivity.
