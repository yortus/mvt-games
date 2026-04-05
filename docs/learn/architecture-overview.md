# Architecture Overview

> The MVT frame loop in one diagram: the ticker advances models, views read
> the settled state and update the presentation, then the renderer draws.
> Every frame, every time, in that order.

**Previous:** [What is MVT?](what-is-mvt.md) · **Next:** [Models](models.md)

---

## The Big Picture

Each frame, the ticker runs three steps in strict order:

```mermaid
flowchart TB
    T["Ticker (frame loop)"] -- "1. deltaMs" --> M["Models\nadvance state"]
    M -- "2. deltaMs" --> V["Views\nadvance presentation state\nupdate scene graph"]
    V -- "3. presentation" --> R["Renderer\ndraws frame"]
```

1. **Update models** - the ticker passes `deltaMs` to models. Models advance
   their domain state by the elapsed time.
2. **Update and refresh views** - the ticker calls `view.update(deltaMs)`
   on views that have presentation state, then views read settled
   state and update the scene graph in `refresh()`.
3. **Render** - the renderer draws the frame.

Models always settle before views read them. Views never see a half-updated
world.

Some views maintain their own presentation state for cosmetic transitions
that the model doesn't track (e.g. a death-flash overlay, a smoothed
score counter). These views have an `update(deltaMs)` method - the same
time-advancement concept that models use. Most views are pure projections
and have no `update()` method.

In practice, models and views each form **hierarchies** - a root model
composes child models, and a root view composes child views. The ticker only
talks to the root; each root delegates to its children. The frame sequence
is the same regardless of tree depth.

## Component Summary

| Component        | Owns                                        | Receives                          | Produces                                              | Must not                                     |
| ---------------- | ------------------------------------------- | --------------------------------- | ----------------------------------------------------- | -------------------------------------------- |
| **Model**        | State, domain logic, time-based transitions | `deltaMs` via `update()`          | Readable state (properties, accessors)                | Know about views, use wall-clock time        |
| **View**         | Presentation layer (+ occasional presentation state) | State via `bindings.get*()`; `deltaMs` via `update()` for views with state | Presentational output, user-input events via `bindings.on*()` | Hold domain state, run autonomous animations |
| **Ticker**       | Frame loop, timing                          | `requestAnimationFrame` callbacks | `deltaMs` for models and views, `refresh` calls for views | Contain domain logic or rendering code |

## The Frame Loop

Every frame follows exactly the same sequence:

```mermaid
sequenceDiagram
    participant RAF as requestAnimationFrame
    participant Ticker
    participant Model
    participant View
    participant Renderer

    RAF->>Ticker: frame callback (timestamp)
    Ticker->>Ticker: compute deltaMs
    Ticker->>Model: update(deltaMs)
    Model->>Model: advance domain state
    Ticker->>View: update(deltaMs)
    View->>View: advance presentation state (if any)
    Ticker->>View: refresh()
    View->>View: read state, update presentation
    Ticker->>Renderer: draw frame
```

The ticker computes `deltaMs` from the timestamp difference between frames,
caps it to a maximum (preventing spiral-of-death when the tab was
backgrounded), and passes it to models. Once models have settled, views with
presentation state advance it via `update(deltaMs)`, then all views refresh.
Then the renderer draws.

This is a **pull-based** architecture. Views pull the latest state from models
each frame, rather than models pushing changes to views via events. The
benefits: no subscriptions, no event wiring, no risk of stale or
double-handled notifications.

## Key Constraints at a Glance

These rules ensure the three layers stay cleanly separated. Each is explained
in depth on its own page:

- **Models own time.** All state advances through `update(deltaMs)`. No
  `setTimeout`, no `Date.now()`, no auto-playing animations.
  ([Models](models.md))

- **Views hold no domain state.** They read current state and update the
  presentation. Views may hold cosmetic presentation state for transitions
  the model doesn't track (see
  [Presentation State](../guide/presentation-state.md)).
  ([Views](views.md))

- **The ticker orchestrates, nothing more.** It drives the frame loop but
  contains no domain logic or rendering code.
  ([The Ticker](ticker.md))

- **Bindings bridge views to models.** `get*()` reads state, `on*()` relays
  user input. Reusable views typically access state through bindings rather
  than importing models directly.
  ([Bindings](bindings.md))

- **Hot paths stay lean.** `update()` and `refresh()` run every frame. Avoid
  per-tick heap allocations.
  ([Hot Paths](../guide/hot-paths.md))

---

**Next:** [Models](models.md)
