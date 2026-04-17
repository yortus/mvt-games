# Models

> A model is a self-contained simulation. It owns domain state and logic,
> advances exclusively through `update(deltaMs)`, and knows nothing about
> how it is displayed.

**Related:** [Architecture Overview](index.md) -
[Views](views.md) -
[Rules](rules.md)

---

## Definition

A model represents the data and rules of the application. It maintains state,
enforces domain constraints, and defines how the application evolves over
time. Models are the single source of truth - everything that matters about
the current state lives in a model.

Think of a model as a headless simulation. It can run without any display,
without any renderer, without any user interface at all. Feed it a sequence
of `update(deltaMs)` calls and it produces a complete state history.

## The `update(deltaMs)` Contract

Every model exposes a single time-advancement method:

```
model.update(deltaMs)
```

The ticker calls this once per frame, passing the elapsed milliseconds since
the last frame. This is the **sole mechanism** by which time enters a model.

The contract guarantees:

- **Determinism.** Same sequence of `update(deltaMs)` calls always produces
  the same state. Identical inputs, identical outputs.
- **Ticker control.** The ticker can pause (stop calling update), slow down
  (halve deltaMs), speed up (double deltaMs), or single-step (call update
  once with a fixed delta). The model neither knows nor cares.
- **Consistent snapshots.** Between the model's `update()` and the view's
  `refresh()`, model state is stable. No background process can mutate it
  mid-frame.

## What Belongs in a Model

Models describe *what is happening* in domain terms. Anything that would
change if you swapped the renderer belongs elsewhere.

| Domain (model) | Presentation (view) |
|---|---|
| Position in domain units (tiles, metres, world-units) | Pixel coordinates, screen offsets |
| Speed in domain units per second | Derived from model position each frame |
| Named states (`'alive'`, `'inflating'`, `'exploding'`) | Textures, colours, particle effects |
| Sequence progress (`stage: 2`, `progress: 0.3`) | Sprite frames, alpha tweens |
| Counts and dimensions (lives, grid size) | Pixel spacing, font sizes |
| Named events (`'pelletEaten'`, `'levelClear'`) | Sound files, volume, panning |

## What Does NOT Belong in a Model

Models must not reach outside themselves for time or presentation:

- **Wall-clock time.** No reading the system clock, no `setTimeout`,
  no `setInterval`. Time flows only through `deltaMs`.
- **Auto-advancing timers.** No mechanism that advances state independently
  of the `update()` call.
- **References to views.** Models are self-contained. They must not import,
  reference, or know about any view.
- **Presentation-level values.** No pixel coordinates, no colours, no texture
  names. Domain-level coordinates and named states only.

## Domain-Level Coordinates

Models must define positions, distances, and velocities in units meaningful
to the domain - not in pixels or any other presentation measure.

| Application style | Natural unit | Examples |
|---|---|---|
| Tile/grid-based | Tiles (fractional) | Pac-Man, Tetris, chess |
| Continuous open-world | Metres or world-units | Platformers, racing |
| Fixed-arena action | Abstract world-units | Asteroids, space shooters |
| Board/card | Slots or indices | Card positions, board squares |

The model defines the world; the view decides how to draw it. Even if the
current view maps 1 world-unit to 1 pixel, that is a view-layer decision.

## Composition

Models compose into trees. The ticker calls `update(deltaMs)` on the
top-level model, which delegates to its children. Cross-model concerns
(collisions, phase transitions) live in the parent, after children have
updated:

```
rootModel.update(deltaMs):
    ship.update(deltaMs)
    for each bullet: bullet.update(deltaMs)
    for each asteroid: asteroid.update(deltaMs)
    checkCollisions()
```

Each child model is independently testable - call its `update()` directly
without the parent.

## Testing

Because models are deterministic, testing is mechanical:

```
create model with known initial state
call update(deltaMs) with specific values
assert state matches expectations
```

No rendering context. No display. No timers. Just function calls and
assertions. Replay an exact frame sequence and get an exact result.
