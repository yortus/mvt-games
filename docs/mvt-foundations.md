# MVT Foundations — Proven Patterns Behind the Architecture

MVT is not a novel invention. It assembles a small set of well-established,
battle-tested architectural patterns into a single coherent framework for
frame-based interactive applications. Every piece has decades of proven use in
game engines, UI frameworks, and software engineering at large. MVT's
contribution is combining them into a consistent, easy-to-learn architecture
suited to TypeScript canvas applications.

This document maps each MVT concept to its roots and explains why the
combination works.

> **Related:** [MVT Architecture Guide](mvt-guide.md) for usage and rules
> · [TypeScript Style Guide](style-guide.md) for coding conventions
> · [Documentation Hub](README.md) for glossary and orientation

---

## Table of Contents

- [The Patterns Behind MVT](#the-patterns-behind-mvt)
  - [The Game Loop (Ticker)](#the-game-loop-ticker)
  - [Deterministic Simulation (Models)](#deterministic-simulation-models)
  - [Passive View (Bindings)](#passive-view-bindings)
  - [Stateless Rendering (Views)](#stateless-rendering-views)
  - [Dirty Checking (Watch)](#dirty-checking-watch)
  - [Hierarchical Composition](#hierarchical-composition)
- [Why These Patterns Fit Together](#why-these-patterns-fit-together)
- [Further Reading](#further-reading)

---

## The Patterns Behind MVT

### The Game Loop (Ticker)

**MVT concept:** The Ticker calls `model.update(deltaMs)` → `view.refresh()` →
renderer draws, once per frame, continuously.

**Established pattern:** The **Game Loop** — a fixed-structure frame loop that
drives simulation and rendering in lockstep. Described in Robert Nystrom's
*Game Programming Patterns* (2014) as a core architectural pattern, and
standard practice in every major game engine:

| Engine | Equivalent |
|--------|-----------|
| Unity | `MonoBehaviour.Update(deltaTime)` |
| Unreal | `AActor::Tick(DeltaSeconds)` |
| Godot | `Node._process(delta)` |

**Why it's proven:** The game loop has been the backbone of interactive
applications since the earliest video games. It provides predictable frame
pacing, a clear place for each concern (simulate, then render), and a single
point of control for time flow (pause, slow-motion, fast-forward). In a canvas
application where entities move every frame, a continuous loop is the natural
fit — every frame reads current state and renders directly.

### Deterministic Simulation (Models)

**MVT concept:** Models advance state exclusively through `update(deltaMs)`.
No `setTimeout`, no `Date.now()`, no auto-playing animations. Time only enters
through the ticker's `deltaMs` parameter.

**Established pattern:** The **Update Method** pattern (Nystrom, 2014) and
**deterministic simulation** — a foundational technique in game engineering
where identical inputs always produce identical outputs.

**Why it's proven:** Deterministic simulation is the basis for:

- **Replay systems** — record inputs and `deltaMs` values, replay them to
  reproduce exact state sequences (used in every competitive game).
- **Lockstep networking** — synchronise multiplayer state by sharing only
  inputs, not full state (standard since *Age of Empires*, 1997).
- **Time manipulation** — pause, slow-motion, fast-forward, and frame-stepping
  all work by controlling what `deltaMs` the ticker provides. The model doesn't
  know or care.
- **Testing** — feed a known sequence of `update()` calls, assert exact state.
  No timing uncertainty, no flaky tests.

### Passive View (Bindings)

**MVT concept:** Views receive a `bindings` object at construction.
`get*()` methods read state; `on*()` methods relay user input. Views never
import or reference models directly.

**Established pattern:** The **Passive View** variant of Model-View-Presenter
(Martin Fowler, 2006) and the **ViewModel** concept from MVVM (John Gossman,
2005). In both patterns, the view has zero knowledge of the model — it
interacts only through an intermediary interface that exposes exactly the data
and actions the view needs.

**Why it's proven:** Passive View and MVVM are the standard decoupling patterns
for UI architecture across platforms — WPF, Android (Jetpack), iOS (SwiftUI),
and web frameworks all use variations. The benefits are well-documented:

- **Substitutability** — swap the real model for a mock; the view doesn't know
  the difference. Enables isolated view testing.
- **Explicit surface area** — the bindings type is a complete manifest of every
  dependency the view has. No hidden coupling.
- **Independent development** — model and view can evolve separately as long as
  the bindings contract is maintained.

If you've used React, this will feel familiar — a component that receives data
via props and reports input via callback props is the same structural idea.

### Stateless Rendering (Views)

**MVT concept:** A view's `refresh()` function reads current state from
bindings and updates the scene graph to match. No domain state, no memory of
previous frames, no autonomous behaviour.

**Established pattern:** **UI as a function of state** — the core insight
behind React (2013), Elm (2012), and immediate-mode GUI libraries like Dear
ImGui (2014). The view is a pure transformation: `state → visual output`.

**Why it's proven:** Stateless rendering eliminates an entire category of bugs
— stale state, inconsistent UI, missed update notifications, event ordering
problems. When the view always reads current state and produces corresponding
output, the display is guaranteed to be consistent with the model after every
frame.

**How MVT applies it:** Views update a persistent scene graph in `refresh()`.
The scene graph is retained (not rebuilt) for performance, but the *logic* is
stateless — `refresh()` is idempotent, and calling it twice with the same
model state produces the same visual.

### Dirty Checking (Watch)

**MVT concept:** The `Watch<T>` helper polls a binding every frame and reports
whether the value changed. Views use it to skip expensive scene-graph rebuilds
when infrequently-changing values haven't moved.

**Established pattern:** **Dirty checking** — polling for changes rather than
relying on push notifications. The most prominent example is Angular 1's
digest cycle (2010), which checked all watched expressions every cycle and
updated the DOM only for those that changed.

**Why it's proven:** Dirty checking trades a small per-frame polling cost for
architectural simplicity — no observer subscriptions to manage, no event
listener cleanup, no risk of forgotten unsubscriptions or stale closures. In a
frame-loop context where `refresh()` already runs every tick, the polling cost
is near zero because you're already executing code every frame. (React's
`React.memo` and `useMemo` serve the same purpose — skip work when inputs are
unchanged.)

### Hierarchical Composition

**MVT concept:** Models compose into trees (parent delegates `update()` to
children). Views compose into trees (parent creates child views, each with own
bindings). The hierarchies mirror each other.

**Established pattern:** The **Composite** pattern (Gamma et al., *Design
Patterns*, 1994) — treating individual objects and compositions uniformly
through a shared interface. Every UI framework uses this: React's component
tree, the browser DOM, Unity's `GameObject` hierarchy, and Pixi.js's own
`Container` parent–child structure.

**Why it's proven:** Hierarchical composition allows complex systems to be built
from small, independently testable units. Add a new feature as a new
model/view pair without touching existing ones. The pattern scales from a
single entity to arbitrarily complex applications.

---

## Why These Patterns Fit Together

These aren't arbitrary choices — each pattern enables and reinforces the others:

```mermaid
flowchart TD
    GL["Game Loop (Ticker)"]
    DS["Deterministic Simulation (Models)"]
    SR["Stateless Rendering (Views)"]
    PV["Passive View (Bindings)"]
    DC["Dirty Checking (Watch)"]
    HC["Hierarchical Composition"]

    GL -- "provides deltaMs" --> DS
    GL -- "calls refresh()" --> SR
    DS -- "single source of truth" --> SR
    SR -- "reads through" --> PV
    PV -- "enables isolated testing" --> DS
    PV -- "enables isolated testing" --> SR
    DC -- "optimises" --> SR
    HC -- "scales" --> DS
    HC -- "scales" --> SR
```

The game loop requires models to be deterministic — if models used their own
timers, the ticker couldn't pause or control time.

Deterministic models provide a single source of truth, which makes stateless
views viable — there's no stale cache to invalidate, just read current state
every frame.

Because every view reads from the same post-`update()` snapshot, multiple views
can project from the same model data and stay perfectly in sync without any
coordination code between them.

Stateless views need explicit bindings so they don't create hidden dependencies
on specific model implementations. Explicit bindings enable testing both sides
in isolation — mock the bindings to test views, call `update()` directly to
test models.

Dirty checking slots cleanly into the frame-loop lifecycle since `refresh()`
runs every tick anyway.

Hierarchical composition lets each of these patterns scale from one model/view
to dozens without changing the architecture.

The result is a small set of rules that reinforce each other rather than
conflicting. Learn one, and the next follows naturally.

---

## Further Reading

- Robert Nystrom, *Game Programming Patterns* (2014) — **Game Loop** and
  **Update Method** chapters. The definitive reference for the Ticker and Model
  `update()` patterns. Freely available at gameprogrammingpatterns.com.
- Martin Fowler, "Passive View" (2006) — the decoupling pattern behind
  MVT's bindings. Part of Fowler's catalogue of UI architectural patterns.
- John Gossman, "Introduction to Model/View/ViewModel" (2005) — the ViewModel
  concept, structurally identical to MVT's bindings object.
- Gamma, Helm, Johnson, Vlissides, *Design Patterns* (1994) — the Composite
  pattern used by both model and view hierarchies.
- Evan Czaplicki, "Elm Architecture" (2012) — Model → update → view as a
  functional loop. MVT is a continuous-time, imperative-rendering adaptation
  of the same idea.
