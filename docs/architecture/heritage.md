# Heritage

> MVT is not a novel invention. It assembles a small set of battle-tested
> architectural patterns into a coherent framework for frame-based interactive
> applications. Every piece has decades of proven use.

**Related:** [Architecture Overview](index.md) -
[Rules](rules.md)

---

## The Patterns Behind MVT

### The Game Loop (Ticker)

The Ticker is a **Game Loop** - a fixed-structure frame loop that drives
simulation and rendering in lockstep. It is a standard feature in every major game
engine:

| Engine | Equivalent |
|---|---|
| Unity | `MonoBehaviour.Update(deltaTime)` |
| Unreal | `AActor::Tick(DeltaSeconds)` |
| Godot | `Node._process(delta)` |

The game loop has been the backbone of interactive applications since the
earliest video games. It provides predictable frame pacing, a clear place for
each concern (simulate, then render), and a single point of control for time
flow.

### Deterministic Simulation (Models)

Models use the **Update Method** pattern and **deterministic simulation** - a
foundational technique in game engineering where identical inputs always produce
identical outputs. This is the basis for:

- **Testing** - feed known update sequences, assert exact state.
- **Replay systems** - record inputs and deltas, replay to reproduce exact
  state.
- **Lockstep networking** - synchronise multiplayer by sharing inputs only.
- **Time manipulation** - pause, slow-motion, fast-forward by controlling
  delta.

### Stateless Rendering (Views)

**UI as a function of state** - the core insight behind React, Elm, and
immediate-mode GUI libraries like Dear ImGui. The view is a pure
transformation: `state -> presentation`.

Stateless rendering eliminates entire categories of bugs: stale state,
inconsistent UI, distributed coordination errors, missed update notifications,
event ordering problems. The
display is guaranteed to be consistent with the model after every frame.

### Passive View (Bindings)

Bindings implement the **Passive View** variant of Model-View-Presenter and
the **ViewModel** concept from MVVM. The view has zero knowledge of the model
- it interacts only through an intermediary interface.

These are the standard decoupling patterns for UI architecture across
platforms - WPF, Android (Jetpack), iOS (SwiftUI), and web frameworks all use
variations. Benefits:

- **Substitutability** - swap real models for mocks; the view doesn't know.
- **Explicit surface area** - the bindings type is a complete dependency
  manifest.
- **Independent development** - model and view evolve separately as long as
  the bindings contract holds.

### Dirty Checking (Change Detection)

Polling for changes rather than relying on push notifications. The most
prominent example is Angular 1's digest cycle. In a frame-loop context where
`refresh()` already runs every tick, the polling cost is near zero.

### Hierarchical Composition

The **Composite** pattern - treating individual objects and compositions
uniformly through a shared interface. Every UI framework uses this: React's
component tree, the browser DOM, Unity's GameObject hierarchy. Models compose
into trees; views compose into trees; the two hierarchies are decoupled.

## Why These Patterns Fit Together

Each pattern enables and reinforces the others:

- The game loop requires models to be deterministic - if models used their own
  timers, the ticker couldn't control time.
- Deterministic models provide a single source of truth, making stateless
  views viable - just read current state every frame.
- Stateless views have explicit bindings so they don't create hidden
  dependencies on specific models.
- Dirty checking slots cleanly into the frame-loop lifecycle since `refresh()`
  runs every tick anyway.
- Hierarchical composition lets each pattern scale from one model/view to
  dozens without changing the architecture.

The result: a small set of rules that reinforce each other rather than
conflicting.

## Further Reading

- Robert Nystrom, *Game Programming Patterns* (2014) - Game Loop and Update
  Method chapters.
- Martin Fowler, "Passive View" (2006) - the decoupling pattern behind
  bindings.
- John Gossman, "Introduction to Model/View/ViewModel" (2005) - the ViewModel
  concept, structurally identical to bindings.
- Gamma, Helm, Johnson, Vlissides, *Design Patterns* (1994) - the Composite
  pattern.
- Evan Czaplicki, "The Elm Architecture" (2012) - Model, update, view as a
  functional loop.
