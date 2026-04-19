# Views

> A view reads current state and writes presentation output. It holds no
> domain state, runs no autonomous behaviour, and can be replaced without
> affecting the simulation.

**Related:** [Architecture Overview](index.md) -
[Models](models.md) -
[Bindings](bindings.md) -
[Rules](rules.md)

---

## Definition

A view is part of the presentation layer. Each frame, it reads from current model
state and updates its output to match - a canvas scene graph, a DOM tree,
an audio mix, a debug panel. Views are **domain-stateless projections**: they
don't track domain history, and they don't decide what happens next.

Views *do* hold a retained output structure - the scene graph - and may hold
[presentation state](#presentation-state) for cosmetic transitions. "Stateless"
always refers to domain state in MVT.

## The `refresh()` Contract

A view exposes a refresh mechanism that the ticker triggers once per frame,
after all models have updated:

```
view.refresh()
```

The contract:

- **Reactive.** All state values must be re-read in `refresh()`, never cached
  at construction time. Values may change between frames.
- **Idempotent.** Calling `refresh()` twice with the same model state
  produces the same output.
- **No side effects.** `refresh()` reads state and writes to the presentation
  layer. It does not mutate models, emit domain events, or trigger state
  transitions.

## Immediate-Mode Data Flow, Retained-Mode Output

The `refresh()` contract is an **immediate-mode data flow** pattern: the view
re-reads all state and writes output every frame, as if rendering from
scratch. There are no subscriptions, no change notifications, no event-driven
partial updates - just a fresh read of current state each frame.

But views typically write to a **retained output** - a scene graph, a DOM
tree, or another persistent structure. Display objects are constructed once
at view creation time and mutated in `refresh()`, not recreated every frame.

This hybrid gives two benefits simultaneously:

- **Immediate-mode correctness.** No stale state, no subscription bugs, no
  missed updates. The output is guaranteed to match current model state after
  every `refresh()`.
- **Retained-mode efficiency.** No per-frame allocation of display objects.
  The output structure persists across frames, and only changed properties
  are written.

The retained output is effectively a cache of the last `refresh()` call.
Like any cache, its correctness depends on `refresh()` being comprehensive:
if a new model field is added but `refresh()` doesn't read it, the output
will show stale values for that field. The idempotency and reactivity
constraints above guard against this - they require `refresh()` to re-read
*all* state every frame.

When discrete state changes rarely but triggers expensive work (rebuilding a
grid, recreating child views), change detection lets `refresh()` skip
unchanged work - a standard retained-mode optimisation that slots naturally
into the frame-loop lifecycle.

## What Belongs in a View

Views describe *how things look* (or sound, or are represented). They
transform domain state into presentation:

- Domain position to pixel coordinates
- Named state to texture/colour/animation frame
- Count to laid-out display elements
- Named event to sound playback

## What Does NOT Belong in a View

| Forbidden | Why |
|---|---|
| Domain state | State belongs in models |
| Domain logic | Logic belongs in models |
| Wall-clock timers | Time flows through models and the ticker, not views |
| Autonomous animations | Animations must be driven by state read in `refresh()` |
| State mutations | Views read; they don't write back to models in `refresh()` |

A good test: if you deleted the view and wrote a new one from scratch using
the same state, would the simulation still work correctly? If yes, the view
is properly domain-stateless.

## Presentation State

Most views are pure projections - they read state in `refresh()` and write
output. No internal state needed.

Occasionally a view needs its own state for a cosmetic transition that the
model has no reason to track. A model is a domain simulation - it determines
outcomes. A 200ms death-flash overlay or a smoothed score counter doesn't
affect what happens next in the simulation, but it does need a timer that
advances with time.

A view with presentation state gains an `update(deltaMs)` method - the same
time-advancement concept used by models:

```
ticker frame:
    model.update(deltaMs)      -- domain state advances
    view.update(deltaMs)       -- presentation state advances
    view.refresh()             -- reads both, writes output
```

Key constraint: presentation state must not affect domain outcomes. If it
does, it belongs in the model.

When presentation logic grows complex enough to warrant separate testing,
extract it into a **view model** - a plain object with `update(deltaMs)` and
readable state, owned by the view, independently testable.

## Three Access Patterns

Views access state through one or more of these patterns:

| Pattern | When | Why |
|---|---|---|
| Bindings object | Reusable leaf views | Decoupled from any specific model shape |
| Direct model access | Top-level, application-specific views | No reuse scenario; bindings add verbosity without benefit |
| Ambient constants | Static configuration (tile size, screen dimensions) | Never changes at runtime; not reactive state |

See [Bindings](bindings.md) for the bridging pattern.

## Composition

Views compose into trees. The ticker calls `refresh()` (and `update()` if
presentation state exists) on the top-level view, which delegates to its
children. The view tree does not need to mirror the model tree; domain
structure and presentation needs are different concerns.
