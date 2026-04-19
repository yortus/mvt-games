# MVT Architecture

> MVT (Model-View-Ticker) is an architecture for frame-based interactive
> applications that separates domain state from presentation by routing all
> time through a deterministic update loop.

**Related:** [Building with MVT](../building-with-mvt/quickstart.md) -
[Architecture Rules](rules.md)

---

## How This Section Relates to the Rest of the Docs

This Architecture section describes MVT as a transferable pattern. It uses
pseudocode and is independent of any language, renderer, or framework.

The [Building with MVT](../building-with-mvt/quickstart.md) section teaches the
architecture through this project's TypeScript + Pixi.js implementation.
The [Reference](../reference/architecture-rules.md) section includes both
universal MVT rules and repo-specific conventions.

## The Problem

Frame-based applications (games, simulations, creative tools) tend to mix
state, rendering, and timing into a single loop body. The result:

- State mutations scattered across rendering code - hard to test, hard to
  reason about.
- Hidden timers and callbacks mutating state outside the frame loop - bugs
  that depend on frame rate, tab visibility, or execution order.
- Presentation logic entangled with domain logic - can't swap renderers,
  can't run headless, can't unit test without a display context.

## The Solution

Split the application into three layers with strict contracts:

| Layer      | Responsibility             | Contract                                          |
| ---------- | -------------------------- | ------------------------------------------------- |
| **Model**  | State and domain logic     | Advances only via `update(deltaMs)`               |
| **View**   | Presentation               | Reads state, writes output; holds no domain state |
| **Ticker** | Frame loop                 | Calls update, then refresh, then render - every frame |

Each layer has one job. Models don't know views exist. Views don't decide
what happens next. The ticker orchestrates without containing domain logic
or rendering code.

## The Frame Sequence

Every frame follows the same strict order:

```
1. Ticker computes `deltaMs` from elapsed time
2. Ticker calls the top-level model's `update(deltaMs)` - it delegates to
   child models; all domain state settles
3. Ticker calls the top-level view's `refresh()` - views re-read settled
   state, write to output
4. Renderer draws the frame
```

Less commmonly, some views may have cosmetic [presentation state](views.md#presentation-state). In this case the top-level view gains an `update(deltaMs)` method, and the ticker loop gains an extra step to call it between steps 2 and 3.

Models always settle before views read them. Views never see a half-updated
world. Data flows one direction within each frame: models produce state,
views consume it.

## What You Get

- **Deterministic models.** Same sequence of `update(deltaMs)` calls always
  produces the same state. Unit test without a display context.
- **Swappable views.** Same model can drive a canvas, a terminal, or a test
  harness. Views are interchangeable because they hold no domain state.
- **Time control.** Pause, slow-motion, fast-forward, frame-step, and replay
  all work by controlling what `deltaMs` the ticker provides.
- **Frame consistency.** All models settle before any view refreshes. Multiple
  views projecting the same model data stay perfectly in sync.
- **Scalable composition.** Models compose into trees. Views compose into
  trees. The two hierarchies are decoupled through bindings and need not
  mirror each other.

## How MVT Relates to Patterns You Know

If you have experience with UI architectures, MVT will feel familiar. It
assembles proven ideas into a framework suited to frame-based applications:

| Pattern you know  | MVT equivalent                                            |
| ----------------- | --------------------------------------------------------- |
| MVC Model         | **Model** - owns state and domain logic                   |
| MVC Controller    | **Ticker** - orchestrates the frame loop                  |
| MVVM Bindings     | **Bindings** - the `get*()`/`on*()` contract between view and model |
| Passive View      | **View** - reads state through bindings, holds no domain state |
| Immediate mode    | **View data flow** - `refresh()` re-reads all state every frame |
| Retained mode     | **View output** - scene graph built once, mutated per frame |
| React state       | **Model** - single source of truth for domain state       |
| React component   | **View** - renders based on current state                 |
| Game loop          | **Ticker** - `update()` then `render()` each frame        |

The key difference from typical UI architectures is that MVT is designed for
continuous animation. There is no event-driven re-render; instead, the ticker
drives a steady frame loop where models advance and views refresh every frame.

## Go Deeper

| Page | What it covers |
|---|---|
| [Models](models.md) | The `update(deltaMs)` contract, domain-level state, what doesn't belong |
| [Views](views.md) | Domain-statelessness, `refresh()`, immediate/retained hybrid, the presentation state boundary |
| [Bindings](bindings.md) | The bridging concept, `get*()`/`on*()`, why not pass the model |
| [The Ticker](ticker.md) | Frame sequence, time ownership, determinism |
| [Rules](rules.md) | Universal MVT constraints |
| [Heritage](heritage.md) | The established patterns MVT assembles |
