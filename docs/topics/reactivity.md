# Reactivity: Why MVT Uses Polling

> In a tick-based game loop, the model updates before the view reads. The
> simplest and most robust way for views to react is to poll: read current
> state, compare to previous state, act on differences.

**Related:** [Change Detection](change-detection.md) -
[Events and Signals](events-and-signals.md) -
[The Game Loop](../learn/game-loop.md) -
[Hot Paths](hot-paths.md)

---

> **A note on "polling."** In I/O and networking contexts, "polling" implies
> busy-waiting and is considered wasteful. In a tick-based game loop the
> meaning is different: the view reads current state at the natural
> synchronization point that already runs every frame. There is no busy-wait -
> the frame callback would run regardless.

## The Reactivity Problem

When model state changes, the view needs to know. *Reactivity* is the general
term for the mechanism that connects the two. There are three broad strategies:

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

Polling treats all readable state uniformly. Any getter can be watched. This
effectively turns change detection into *consumer-defined events* - the view
chooses what constitutes a meaningful change without the model declaring
anything. See
[Change Detection - Consumer-Defined Events](change-detection.md#change-detection-as-consumer-defined-events)
for the full pattern.

### Continuous state is just a read

Positions, velocities, animation progress - continuous state that changes
every frame. In a polling system, continuous values are read directly with no
reactive overhead:

```ts
// No watcher needed - just read it.
sprite.x = model.col * TILE_SIZE;
```

With signals, continuous values must still be wrapped in signals for effects
to work - but the dependency tracking overhead is pure waste when the consumer
reads the value every frame anyway. Events are even less suited: emitting 60
times per second per value creates dispatch overhead for no benefit.

## Three Categories of State

Not all state behaves the same way. Recognising the category helps you choose
the right reading strategy:

| Category | Changes... | Examples | Strategy |
|----------|-----------|----------|----------|
| **Continuous** | Most frames | position, velocity, animation progress | Read directly - no change detection needed |
| **Discrete** | Occasionally | score, phase, lives, wave number | `watch()` for change detection |
| **Static** | Never at runtime | tile size, grid dimensions, screen size | Import from data module or pass as parameter |

Continuous state is read every frame with no overhead. Static state is resolved
at construction time. The interesting category is discrete state - values that
change infrequently but may trigger expensive view work (rebuilding text,
restructuring the scene). Polling these with `===` comparison is cheap, and
skipping the expensive work when nothing changed is valuable.

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

    // Continuous state - just read directly
    sprite.x = model.col * TILE_SIZE;
    sprite.y = model.row * TILE_SIZE;
}
```

This gives the best of both worlds: cheap change detection for discrete
state, zero overhead for continuous state.

## Limitations and Tradeoffs

**Idle cost.** Polling is not free. Every watcher getter runs every frame, even when nothing changed. At game-typical scale (up to hundreds of watched values), the cost is a negligible part of the frame budget. But it is a fixed cost per tick,
unlike events and signals which have zero cost when idle. Conversely for
continuously-changing values, polling is cheaper than events or signals.

**Derived state.** Derived state must be computed in the model or in getter expressions. There is no equivalent of `createMemo` that automatically caches and invalidates.
In practice, model-layer derivation is straightforward and keeps complexity
where it belongs - in the model.

**Transient state.** If a value changes and reverts within a single
`update()` call, polling never sees the change. For example, a model that
sets a flag, performs work, then clears the flag - the view's next `refresh()`
sees only the cleared state. If the transient change matters to the view, the
model must persist it for at least one frame (e.g. a `lastEvent` property) or
a complementary mechanism like a message queue can be used.

**Scaling to very large entity counts.** At typical game scale, watched
getters are fast. At extreme scale (thousands of entities, each with many
watched properties), the per-frame comparison cost grows linearly. In such
cases, consider watching aggregate values (e.g. a collection version counter)
rather than individual properties, or narrowing which entities are actively
watched.

## Hybrid Approaches

Polling handles the vast majority of view-update needs in a game loop. For
cross-cutting concerns that are not view-correctness-critical - audio cues,
analytics, achievement tracking - events can complement polling naturally.

The key constraint: **views should not depend on events for correctness.** If a
view needs state to render correctly, it should read that state through
bindings. Events are appropriate for fire-and-forget side effects where missing
a notification is not a rendering bug.

```ts
// Audio reacts to events - missing one is a minor glitch, not a visual bug.
audioManager.on('enemy-destroyed', () => playSound('boom'));

// The view reads state through bindings - always correct, every frame.
function refresh(): void {
    sprite.x = bindings.getX() * TILE_SIZE;
}
```

This keeps models simple (events are optional, not required), views reliable
(polling for correctness), and side-effect systems loosely coupled (events for
notification).

For a detailed look at the tradeoffs of events and signals in game contexts,
see [Events and Signals](events-and-signals.md).

## Summary

| Concern | Polling | Events | Signals |
|---------|---------|--------|---------|
| "When to re-evaluate?" | Already answered - every frame | Source decides | Runtime decides |
| Model complexity | Plain getters | Must emit events | Must wrap in signals |
| Consistency | Free (update-then-read) | Requires emit-after-mutation discipline | Requires batching and scheduling |
| Cleanup | None | Manual `off()` per subscription | Manual `dispose()` per scope |
| Continuous state | Direct read, zero overhead | Wasteful (60 emits/sec) | Wasteful (60 signal writes/sec) |
| Consumer flexibility | Watch any getter | Limited to declared events | Limited to signal-wrapped values |

In a frame-based game loop, polling is the simplest approach that works
correctly by default.

> **Empirical note:** the project includes benchmarks comparing watchers,
> signals, and events for a typical game-entity workload. Results confirm
> that watcher overhead is negligible at game-typical scale. See
> `benchmarks/reactivity-simple.bench.ts` for the benchmark source.

---

**Next:** [Change Detection](change-detection.md) - the `watch()` helper and
practical patterns for poll-based reactivity.
