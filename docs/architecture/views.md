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
an audio mix, a debug panel. Views are **stateless projections**: they don't
track what happened before, and they don't decide what happens next.

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
is properly stateless.

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
