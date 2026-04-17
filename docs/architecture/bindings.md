# Bindings

> Bindings are the contract between a view and the world. They decouple views
> from specific model shapes, making views reusable and independently testable.

**Related:** [Architecture Overview](index.md) -
[Views](views.md) -
[Rules](rules.md)

---

## The Problem of Accessing State

A view needs data to render. The simplest approach is to pass a model
directly - but that couples the view to a specific model shape. It doesn't
work if the required state is spread across several models or lives outside
models. The view can't be reused with a different model, and testing requires
constructing a real model instance.

## Benefits of Bindings Indirection

Bindings add one level of indirection: the view declares what it needs, and
the construction site provides it. This has several benefits:

- **Decoupling.** The view doesn't know which model (or models, or mock, or test stub)
   provides the data. Swap implementations freely.
- **Testability.** Pass mock bindings returning fixed values. Assert the view
   renders correctly without constructing a real model.
- **Explicit dependencies.** The bindings type is a complete manifest of
   everything the view needs. No hidden coupling.

## The Pattern

A bindings object is a plain object with two kinds of members:

| Prefix | Purpose | Direction |
|---|---|---|
| `get*()` | Read current state needed to arrange the presentation | Model to view |
| `on*()` | Relay user input received by the view (e.g. taps, drags) | View to model |

Example:

```
EntityViewBindings:
    getX: () -> number
    getY: () -> number
    getVisible: () -> boolean
    onTapped?: (x, y) -> void
```

The view calls `get*()` methods every frame in `refresh()` and calls `on*()`
methods in response to user input.

## `on*()` Bindings and Input Handling

`on*()` methods should be optional. A view that supports tap input
defines `onTapped?()` in its bindings. If the construction site doesn't wire
it, the view silently does nothing on tap - it remains usable in contexts
that don't need that input.

User input relayed through `on*()` may be processed immediately or queued
and processed on the next `update()` call. Prefer delayed processing to
maintain the one-directional data flow within each frame.

## Wiring

The code that constructs a view is responsible for
wiring its bindings - mapping model properties to `get*()` accessors and model methods
to `on*()` handlers. This typically happens in a parent view:

```
createGameView(gameModel):
    createHudView({
        getScore: () -> gameModel.score.value,
        getLives: () -> gameModel.lives,
    })

    createShipView({
        getX: () -> gameModel.ship.x * SCALE,
        getY: () -> gameModel.ship.y * SCALE,
        getVisible: () -> gameModel.ship.isAlive,
    })
```

Each binding is a simple accessor that reads a model property. The view
doesn't know the model exists - it only sees its bindings interface.

## When NOT to Use Bindings

Bindings are a pragmatic choice, not a strict rule. The principle: use bindings
where decoupling provides real value (reuse, testing, substitutability).

Two common exceptions are:

- **The top-level application view.** For this view it is much simpler to pass the top-level model.
This view is application-specific with no reuse potential, and has the largest binding surface.
So the cost vs benefit is in favour of direct model access in this case.

- **Application constants.** Applications typically have ambient constants that never vary at runtime
(e.g. fixed grid dimensions, cell sizes, etc). For views that are specific to the application,
these constants may be imported directly.
