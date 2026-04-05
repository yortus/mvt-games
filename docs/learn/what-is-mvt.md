# What is MVT?

> MVT (Model-View-Ticker) is an architecture for canvas and game applications
> that separates state from presentation, giving you deterministic models you
> can unit test, stateless views you can swap, and frame-consistent rendering
> across the board.

**Next:** [Architecture Overview](architecture-overview.md)

---

## The Problem

Canvas and game applications are hard to structure well. State, rendering, and
timing tend to tangle together into code that is difficult to test, debug, or
extend.

Consider a simple game entity that moves across the screen. Without
architecture, the movement logic, the sprite positioning, the animation timing,
and the input handling all live in the same place. A bug in movement logic
requires understanding the rendering code to diagnose. Adding a second view of
the same data (e.g. a minimap) means duplicating state-reading logic. Testing
the movement means setting up a full rendering context.

These problems get worse as the application grows. More entities, more
interactions, more visual effects - each one adds to the tangle.

## The Solution

MVT solves this by splitting the application into three layers with strict
contracts between them:

| Layer      | Responsibility              | One-sentence rule                          |
| ---------- | --------------------------- | ------------------------------------------ |
| **Model**  | State and domain logic      | Owns all state; advances only via `update(deltaMs)` |
| **View**   | Presentation and rendering  | Reads state, updates presentation; holds no state of its own |
| **Ticker** | Frame loop and timing       | Calls `update()` then `refresh()` then renders, every frame |

Each layer has a clear job and a clear boundary. Models don't know views exist.
Views don't decide what happens next. The ticker orchestrates them without
containing any domain logic or rendering code.

## What You Get

Keeping the three layers separate produces concrete, practical benefits:

- **Deterministic models you can test.** Call `update(16)` three times, assert
  the state. No rendering context required, no timing uncertainty, no flaky
  tests.
- **Stateless views you can swap.** The same model can drive a Pixi.js canvas,
  a terminal renderer, or a test harness. Views are interchangeable because
  they only read state - they don't own any.
- **Time control.** Pause, slow-motion, fast-forward, frame-stepping, and
  replay all work by controlling what `deltaMs` the ticker provides. Models
  don't know or care.
- **Frame-consistent multi-view rendering.** Multiple views can project from
  the same model state and are guaranteed to be in sync. The ticker updates
  all models before any view refreshes, so no view sees a half-updated world.
- **Scalability.** Add new features as new models/views without touching
  existing ones. Models and views compose hierarchically.
- **Debuggability.** No hidden timers or async state mutations to chase.
  Step through frames one at a time and inspect the model at each point.

## How MVT Relates to Patterns You Know

If you have experience with UI architectures, MVT will feel familiar. It
assembles proven ideas into a framework suited to frame-based applications:

| Pattern you know  | MVT equivalent                                            |
| ----------------- | --------------------------------------------------------- |
| MVC Model         | **Model** - owns state and domain logic                   |
| MVC Controller    | **Ticker** - orchestrates the frame loop                  |
| MVVM ViewModel    | **View model** - owns presentation state (when extracted from a view) |
| MVVM Bindings     | **Bindings** - the `get*()`/`on*()` contract between view and model |
| Passive View      | **View** - reads state through bindings, holds nothing    |
| React state       | **Model** - single source of truth for domain state       |
| React component   | **View** - renders based on current state                 |
| Game loop          | **Ticker** - `update()` then `render()` each frame        |
| `requestAnimationFrame` | What the ticker uses internally to drive the loop   |

The key difference from typical UI architectures is that MVT is designed for
continuous animation. There is no event-driven re-render; instead, the ticker
drives a steady frame loop where models advance and views refresh every frame.

## What This Project Is

This repository explores and illustrates MVT by building classic arcade games -
Asteroids, Pac-Man, Dig Dug, Galaga, and more. Each game is a self-contained
module with its own models, views, and data. The games are the proof; the docs
are the explanation.

A **Cabinet** manages game selection and delegates to the active game session,
much like an arcade cabinet switching between games.

---

**Next:** [Architecture Overview](architecture-overview.md)
