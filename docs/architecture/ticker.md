# The Ticker

> The ticker drives the frame loop. It computes elapsed time, advances models,
> refreshes views, and triggers rendering - in that order, every frame. It
> contains no domain logic and no rendering code.

**Related:** [Architecture Overview](index.md) -
[Models](models.md) -
[Views](views.md) -
[Rules](rules.md)

---

## Definition

The ticker is the orchestrator. It owns the frame loop and ensures every
frame follows the same strict sequence. It is the single point of control
for time flow in the application.

## The Frame Sequence

Each frame proceeds in strict order:

```
1. Receive frame callback (e.g. from display refresh)
2. Compute `deltaMs` = time since last frame
3. Cap `deltaMs` to a safe maximum
4. Call the top-level model's `update(deltaMs)`
   - it delegates to child models
   - all domain state settles
5. [only if presentation state exists] Call the top-level view's `update(deltaMs)`
   - presentation state advances
6. Call the top-level view's `refresh()`
   - views read state, write output
7. Renderer draws the frame
```

Normally in a running application, this sequence is fixed. Steps are not
interleaved or skipped. However, the architecture supports flexibility:
models and views can run at different update frequencies (e.g. physics at
120 Hz, rendering at 60 Hz), and rendering can be skipped entirely for
headless testing.

## Why This Order Matters

- **Models settle first.** When views read state, every model has finished
  updating. No view sees a half-updated world.
- **Multiple views stay in sync.** Two views reading the same model value
  always see the same result, because all models finished before any view
  refreshed.
- **No feedback loops.** Views don't mutate models during refresh. User input
  is relayed through `on*()` bindings and processed on the next update cycle.
  Data flows one direction within each frame.

## Time Ownership

The ticker is the sole source of `deltaMs`. This enables:

- **Pause.** Stop calling `update()` but continue rendering (to show a pause
  overlay).
- **Slow motion.** Multiply `deltaMs` by 0.5 before passing to models.
- **Fast forward.** Multiply `deltaMs` by 2.
- **Frame stepping.** Call `update()` once with a fixed delta on user command.
- **Replay.** Record the `deltaMs` sequence and replay it to reproduce exact
  state.

Models don't know or care. They only ever see the `deltaMs` value they
receive.

## The Delta Cap

When a frame gap grows large - after the application loses focus, during a
loading stall, or on a slow device - passing the full elapsed time as
`deltaMs` can overwhelm models. Not all models handle large jumps
gracefully: physics simulations may tunnel through walls, timers may skip
stages, and fixed-step logic may produce incorrect results.

The ticker caps `deltaMs` to a safe maximum (e.g. 100ms). Don't assume
models can handle arbitrary time jumps - design the cap around the most
sensitive model in the application.

## Hot Paths

Because `update()` and `refresh()` execute every frame, they are hot paths.
Code inside these calls should minimise per-frame allocations, prefer
index-based loops over iterators, and cache derived values that don't change
every frame. The cost budget is the frame interval (e.g. ~16ms at 60 fps),
shared across all models and views.

## Composition

In practice, models and views each form hierarchies. The ticker only calls
`update()` on the top-level model and `refresh()` on the top-level view. Each of these
delegates to its children. The top-level frame sequence is the same regardless of tree
depth.
