# Skill: Writing MVT Models

> Self-contained instructions for writing a correct MVT model in this
> project. Load this file before writing or modifying model code.

---

## File Structure

**[project convention]** Each model file follows this internal ordering:

```ts
// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

// Public interface - this is the contract consumers depend on

// ---------------------------------------------------------------------------
// Options (if needed)
// ---------------------------------------------------------------------------

// Options type for the factory function

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

// createXxx() factory function implementation

// ---------------------------------------------------------------------------
// Internals (if needed)
// ---------------------------------------------------------------------------

// Internal types, constants, and helpers used only inside this file
```

Exports (types, interfaces, factory functions) go above all internals.
Main types before helper types they compose.

## The `update(deltaMs)` Contract

**[MVT requirement]** Every model exposes an `update(deltaMs: number)` method.
The ticker calls it once per frame. This is the **sole mechanism** by which
time flows into a model.

The contract guarantees:
- **Determinism** - same sequence of `update()` calls produces the same state.
- **Ticker control** - pause, slow-motion, fast-forward, and single-step all
  work because models only see `deltaMs`.
- **Consistent snapshots** - model state is stable between `update()` and
  view `refresh()`.

### Forbidden Time Mechanisms

**[MVT requirement]** Models must never use:

| Forbidden                          | Why                                              |
| ---------------------------------- | ------------------------------------------------ |
| `setTimeout` / `setInterval`       | Fires on wall-clock time, not model time         |
| `requestAnimationFrame`            | Bypasses the ticker's `deltaMs` pipeline         |
| Auto-playing GSAP tweens           | GSAP's global ticker advances them independently |
| `Date.now()` / `performance.now()` | Wall-clock reads create non-determinism          |

Any mechanism that advances state exclusively through `update(deltaMs)` is
valid.

## GSAP Timeline Recipe

**[project convention]** This project uses GSAP paused timelines as a
convenient way to express timed sequences. This is not an MVT
requirement - other codebases could use plain arithmetic, a different
tweening library, or any approach that keeps time under ticker control.

### Step 1 - Create once at construction time

```ts
const timeline = gsap.timeline({
    paused: true,              // detach from GSAP's global ticker
    autoRemoveChildren: true,  // clean up completed tweens automatically
});
```

### Step 2 - Append tweens as transitions are scheduled

```ts
function scheduleMove(targetX: number, targetY: number): void {
    const t = timeline.time();
    timeline.to(state, { x: targetX, y: targetY, duration: 0.3, ease: 'none' }, t);
    timeline.set(state, { moving: false }, t + 0.3);
}
```

### Step 3 - Advance in `update()`

```ts
update(deltaMs) {
    const deltaSec = deltaMs / 1000;
    timeline.time(timeline.time() + deltaSec);
}
```

### GSAP Gotchas

- Always use `autoRemoveChildren: true` with explicit tween positioning.
- Prefer `timeline.set()` over `onComplete` for state transitions.
- Guard against zero-duration tweens. When `duration = distance / speed` can
  produce zero, floor with `|| 0.001`.

## Advance-then-Orchestrate Pattern

**[project convention]** When a model uses GSAP timelines, structure
`update()` in two phases:

1. **Advance** - unconditionally advance every timeline and child model.
2. **Orchestrate** - check current state and trigger new sequences as needed.

```ts
update(deltaMs) {
    const dt = 0.001 * deltaMs;
    moveTimeline.time(moveTimeline.time() + dt);
    attackTimeline.time(attackTimeline.time() + dt);

    // Orchestration: trigger next sequence when idle
    if (!state.moving) scheduleMove();
}
```

`update()` must not contain detailed sequencing logic (manual timer arithmetic,
multi-step state machines). That work belongs in `schedule*()` helpers that
build timeline sequences declaratively.

## Time Leap Safety

Models differ in whether they tolerate large `update()` calls:

- **Leap-safe** - purely arithmetic models (e.g. countdown timers). Any
  `update()` size produces correct results.
- **Not leap-safe** - models with orchestration guards, GSAP timeline
  callbacks, or phase transitions. These need small incremental steps.

Do not assume a model is leap-safe unless you know its internals. When writing
a model, document whether it is leap-safe if the answer is not obvious.

For testing non-leap-safe models, use a `stepMs` helper:

```ts
function stepMs(model: { update(deltaMs: number): void }, totalMs: number): void {
    const step = 16;
    let remaining = totalMs;
    while (remaining > 0) {
        const dt = Math.min(step, remaining);
        model.update(dt);
        remaining -= dt;
    }
}
```

## Domain Coordinates, Not Pixels

**[MVT requirement]** Model state must use domain-level terms, not
presentation-specific ones:

| Domain                | Model exposes                                | View computes              |
| --------------------- | -------------------------------------------- | -------------------------- |
| Grid-based game       | Fractional `row` / `col`                     | `x = col * tileSize`      |
| Open arena            | World-unit position (`worldX`, `worldY`)     | Pixel position from scale  |
| Named states          | `phase: 'inflating' \| 'popped'`             | Sprite frame, alpha, scale |

Views compute pixel positions and visual properties from domain coordinates.
Models know nothing about screen size or rendering technology.

## Factory Function Pattern

**[project convention]** Models use factory functions and plain records, not
classes:

```ts
// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

interface TimerModel {
    readonly remainingMs: number;
    readonly isExpired: boolean;
    update(deltaMs: number): void;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

interface TimerModelOptions {
    readonly durationMs: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function createTimerModel(options: TimerModelOptions): TimerModel {
    const { durationMs } = options;
    let remainingMs = durationMs;

    const model: TimerModel = {
        get remainingMs() { return remainingMs; },
        get isExpired() { return remainingMs <= 0; },
        update(deltaMs) {
            if (remainingMs > 0) {
                remainingMs = Math.max(0, remainingMs - deltaMs);
            }
        },
    };

    return model;
}
```

Key points:
- **Interface** is the public contract - exported and referenced by consumers.
- **Options object** makes factories extensible without breaking call sites.
- **Private state** lives in the closure, invisible to consumers.
- **`readonly` properties** signal "read from outside, mutate only from within."
- **Getters** expose computed or private-mutable values.

## What to Export

From a model file, export:
- The model interface (e.g. `TimerModel`)
- The options interface (e.g. `TimerModelOptions`)
- The factory function (e.g. `createTimerModel`)
- Any domain types used in the interface (e.g. `GamePhase`, `TileKind`)

Do not export internal helpers or mutable state types.

Re-export through the directory's barrel file (`index.ts`).

## Forbidden Patterns - Quick Reference

| Pattern                                | Rule   | Fix                                           |
| -------------------------------------- | ------ | --------------------------------------------- |
| `setTimeout` / `setInterval` in model  | M2     | Use `update(deltaMs)` with arithmetic or GSAP |
| Importing a view or view module        | M3     | Models never reference views                  |
| Storing pixel coordinates              | M4     | Use domain units (row/col, world units)       |
| Using `class`                          | Style  | Factory function + plain record               |
| Using `enum` or const-object enum      | Style  | String-literal union                          |
| Using `null`                           | Style  | Use `undefined`                               |
| Using `Type` in type names             | Style  | Use `Kind` (e.g. `TileKind`)                  |
| Using `state` for lifecycle property   | Style  | Use `phase` (e.g. `GamePhase`)                |
| `array.map()` in `update()` hot path   | H2     | Index-based `for` loop                        |
| Template-string keys in `update()`     | H2     | Arithmetic encoding (`r * cols + c`)          |

## Full References

- [Models (Learn)](../learn/models.md) - introduction from scratch
- [Time Management](../guide/time-management.md) - GSAP recipes, advance-then-orchestrate
- [Model Composition](../guide/model-composition.md) - parent-child delegation
- [Architecture Rules](../reference/architecture-rules.md) - all rules (M1-M5)
- [Style Guide](../reference/style-guide.md) - naming, formatting, file structure
- [Hot Paths](../guide/hot-paths.md) - performance rules for `update()`
- [Testing](../guide/testing.md) - testing models, `stepMs` helper
