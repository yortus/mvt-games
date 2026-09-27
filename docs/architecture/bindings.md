# Bindings

> Bindings are the contract between a view and the world. They decouple views
> from specific model shapes, making views reusable and independently testable.
> A bindings object has two kinds of member: *query bindings*, which the view
> reads for state, and *relay bindings*, which the view calls to report user
> input.

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

| Kind | Purpose | Direction |
|---|---|---|
| **Query binding** | Read state needed to arrange the presentation | Model to view |
| **Relay binding** | Report user input received by the view (e.g. taps, drags) | View to model |

Example:

```
BulletViewBindings:
    x: () -> number              -- query
    y: () -> number              -- query
    isVisible: () -> boolean     -- query
    onTapped?: (x, y) -> void    -- relay
```

The view calls its query bindings every frame in `refresh()`, and calls its
relay bindings in response to user input.

How members are named is a convention of each language and codebase, not part
of the pattern. This page names query bindings for what they return and relay
bindings with an `on` prefix. Prefixing query bindings with `get` (e.g. `getX`) is
also common.

One naming principle does follow from the pattern: name a relay binding for
what the user did, not for what it should cause. `onFirePressed` reports an
input; `onShoot` decides what the input means, which is the wiring's job, not
the view's (see
[Relay Bindings and Input Handling](#relay-bindings-and-input-handling)).

## Query Bindings

A query binding is a question the view asks about the state it presents: where
is the bullet, is it visible, what is the score. It never changes anything; it
only returns a value. That is what lets `refresh()` read every query binding
as often as it likes without side effects.

### Changing and Fixed Answers

A query binding can be answered in one of two ways:

- **With a function.** The view calls it whenever it needs the current value,
  which in practice means every `refresh()`. This is how a query binding
  follows state that changes, such as a position.
- **With a fixed value.** The view reads it once, at construction. This suits
  values the view is built around that never change for its lifetime, such as
  a grid size or a button's label.

The view's bindings type declares which answers each query binding accepts.
There are three choices:

| Declared as | Callers pass | For callers | For the view |
|---|---|---|---|
| Function only: `() -> T` | A function. A fixed value must be wrapped: `() -> 42` | Can supply anything, but wrapping fixed values is a little clumsy, and the wiring no longer shows which values are fixed | Must handle a changing value for every query binding, even one that in practice never changes. [Change detection](views.md#immediate-mode-data-flow-retained-mode-output) keeps rarely-changing query bindings cheap, but supporting a change to something structural, such as a grid size, can mean rebuilding |
| Value only: `T` | A fixed value | Cannot supply anything that changes | The simplest: read once at construction |
| Either: `T or () -> T` | Whichever suits | The most convenient, and the wiring shows which values are fixed and which change | Must handle both forms. Wrapping fixed values in functions at construction is simple, but reads them every frame; keeping the distinction lets the view skip per-frame work for fixed values |

A few consequences follow:

- **A query binding declared as a function may change, and the view must treat
  it so.** A view that reads a function once at construction and keeps the
  result breaks [V-reactive](rules.md#view-rules): its bindings promise to
  follow a value that it silently stops following. If the view can only handle
  a fixed value, it must declare the query as value-only, so its bindings
  state what it actually supports.
- **Widening a query binding to "either" does not break callers.** Every call
  site that passed a function, or a fixed value, still passes something the
  view accepts. The view's implementation changes; its callers do not.
  Changing directly between function-only and value-only does break callers.
- **"Either" depends on the language.** It needs a type that is a union of a
  value and a function, and a way to tell them apart at run time. TypeScript
  and dynamically typed languages such as JavaScript, Python and Lua have
  both. Most statically typed languages would need an explicit wrapper type,
  which puts ceremony at every call site and undoes the convenience that is
  the point. There, choose between function-only and value-only for each query
  binding. Even where it works, "either" is ambiguous for a query whose value
  is itself a function.

As a rule of thumb: declare what the view actually supports. Accepting either
form is the most convenient for callers and suits widely reused views, where
the extra work in the view is repaid at many call sites. A value-only query
binding can be widened later without breaking anyone.

## Relay Bindings and Input Handling

A relay binding is always a function: the view calls it when the user does
something, with the details of what happened, such as where a tap landed. The
view only reports the input; what it means is up to whoever wired the relay.

Relay bindings should be optional. A view that supports tap input defines
`onTapped?()` in its bindings. If the construction site doesn't wire it, the
view silently does nothing on tap - it remains usable in contexts that don't
need that input.

User input reported through a relay binding may be processed immediately or
queued and processed on the next `update()` call. Prefer delayed processing
to maintain the one-directional data flow within each frame.

## Wiring

The code that constructs a view is responsible for wiring its bindings -
answering its query bindings from model properties (or fixed values) and
connecting its relay bindings to model methods. This typically happens in a
parent view:

```
createGameView(gameModel):
    createHudView({
        score: () -> gameModel.score.value,
        lives: () -> gameModel.lives,
    })

    createShipView({
        x: () -> gameModel.ship.x * SCALE,
        y: () -> gameModel.ship.y * SCALE,
        isVisible: () -> gameModel.ship.isAlive,
        size: SHIP_SIZE,                         -- a fixed answer
    })
```

Each changing answer is a simple function that reads a model property. The
view doesn't know the model exists - it only sees its bindings interface.

## When NOT to Use Bindings

Bindings are a pragmatic choice, not a strict rule. The principle: use bindings
where decoupling provides real value (reuse, testing, substitutability).

Two common exceptions are:

- **The top-level application view.** For this view it is much simpler to pass the top-level model.
This view is application-specific with no reuse potential, and has the largest binding surface.
So the cost vs benefit is in favour of direct model access in this case.

- **Application constants.** Applications typically have ambient constants that never vary at runtime
(e.g. fixed grid dimensions, cell sizes, etc). For views that are specific to the application,
these constants may be imported directly. A reusable view takes such values
as fixed answers to its query bindings instead, so each construction site decides
them.
