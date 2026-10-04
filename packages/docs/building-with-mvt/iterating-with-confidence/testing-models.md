# Testing Models

> Models are self-contained simulations with no rendering dependencies.
> Create one, call methods, advance time, assert public state. No DOM,
> no canvas, no real timers.

**Related:** [Models (Learn)](../simulating-the-world/models.md) -
[Time Management](../simulating-the-world/time-management.md) -
[Model Composition](../simulating-the-world/model-composition.md) -
[Testing Views](testing-views.md)

---

*Assumes familiarity with [Models](../simulating-the-world/models.md) and
[Time Management](../simulating-the-world/time-management.md).*

## The Pattern

Every model test follows the same structure:

1. Create the model with the desired options.
2. Call `update(deltaMs)` and/or action methods.
3. Assert public state.

```ts
import { describe, it, expect } from 'vitest';

describe('TimerModel', () => {
    it('counts down and expires', () => {
        const timer = createTimerModel(3000);
        expect(timer.remainingMs).toBe(3000);
        expect(timer.isExpired).toBe(false);

        timer.update(1000);
        expect(timer.remainingMs).toBe(2000);

        timer.update(2000);
        expect(timer.remainingMs).toBe(0);
        expect(timer.isExpired).toBe(true);
    });

    it('does not go below zero', () => {
        const timer = createTimerModel(1000);
        timer.update(2000);
        expect(timer.remainingMs).toBe(0);
    });
});
```

No rendering context. No DOM. Just function calls and assertions.

## Advancing Time

### Direct `update()` for leap-safe models

A model is **leap-safe** when its `update()` logic is purely arithmetic -
no phase transitions that depend on passing through intermediate states.
The timer above is leap-safe: subtracting `deltaMs` from a counter
produces the same result regardless of step size.

For leap-safe models, a single large `update()` call is fine:

```ts
timer.update(3000); // single leap
expect(timer.isExpired).toBe(true);
```

### `advanceTime` for everything else

Models with multi-phase state machines, orchestration guards, or internal
timelines are **not** leap-safe. Jumping from t=0 to t=3000 in one call
may skip intermediate transitions entirely. These models need time
advanced in small increments so inter-tick logic triggers correctly.

Additionally, a model may use `async`/`await` internally - for example,
awaiting a spawner or an async initialisation step. Microtasks created by
`await` do not flush automatically in a synchronous loop; they queue
behind the current execution. To keep tests deterministic while still
allowing internal awaits to resolve, flush the microtask queue after each
small time step.

```ts
async function advanceTime(
    model: { update(deltaMs: number): void },
    totalMs: number,
    step = 16,
): Promise<void> {
    let remaining = totalMs;
    while (remaining > 0) {
        const dt = Math.min(step, remaining);
        model.update(dt);
        await Promise.resolve(); // flush microtasks
        remaining -= dt;
    }
}
```

The `await Promise.resolve()` after each `update()` yields to the
microtask queue, allowing any promises inside the model to settle before
the next tick. The test remains deterministic - no real timers, no
`setTimeout`, no non-deterministic scheduling. Microtasks resolve in
insertion order, and each step waits for them before advancing.

::: tip Why not just flush once at the end?
A model might `await` during one tick and check the result on the next.
Flushing only at the end would leave those intermediate awaits unresolved,
causing the model to see stale state during the intervening ticks.
Flushing after every step guarantees each tick sees a fully settled model.
:::

Usage:

```ts
it('transitions from wave-clear to playing', async () => {
    const game = createGameModel(options);
    // ... set up conditions for wave clear ...

    await advanceTime(game, 3200);

    expect(game.phase).toBe('playing');
});
```

For models you know are leap-safe and synchronous, direct `update()`
calls are simpler. When in doubt, use `advanceTime`.

## Factory With Defaults

Models with many options lead to noisy tests when every test repeats the
full construction. Define a local helper that provides sensible defaults
and allows overrides:

```ts
function makeShip(overrides?: Partial<ShipModelOptions>) {
    return createShipModel({
        startX: 200,
        startY: 200,
        rotationSpeed: 5,
        thrust: 200,
        maxSpeed: 250,
        ...overrides,
    });
}

it('respects custom rotation speed', () => {
    const ship = makeShip({ rotationSpeed: 10 });
    ship.setRotationDirection('left');
    ship.update(1000);
    expect(ship.angle).toBeCloseTo(-10);
});
```

Each test expresses only the options relevant to the behaviour under test.
The defaults are invisible noise - present for construction but not for
comprehension.

Define the helper locally in each test file. Shared helpers across test
files tend to drift and become their own maintenance burden.

## Testing Composed Models

Root models orchestrate child models and handle cross-cutting concerns
like collisions, scoring, and phase transitions. Test at both levels:

- **Child model tests** verify individual behaviour in isolation.
- **Root model tests** verify orchestration - that the right things
  happen when children interact.

```ts
describe('GameModel - scoring', () => {
    it('increments score when bullet hits asteroid', async () => {
        const game = createGameModel(options);
        // ... arrange bullet and asteroid to collide ...
        await advanceTime(game, 16);
        expect(game.score).toBeGreaterThan(0);
    });
});
```

Root tests are naturally higher-level. They set up a scenario, advance
time, and assert on the combined result. Avoid reaching into child models
to assert internal state - assert on what the root model exposes publicly.

## What Not to Test

- **Internal implementation details.** Do not test private state, closure
  variables, or how a model internally uses GSAP. If the model switches
  from a timeline to manual arithmetic, tests should not break.
- **Framework behaviour.** Do not test that GSAP tweens interpolate
  correctly. Trust the library.
- **Trivial accessors.** Do not write a test that creates a model and
  asserts the initial value of a property that was passed as an option.
  Test behaviour, not construction.
- **Exact timing of intermediate states.** Prefer asserting that a phase
  transition *has happened* after sufficient time, rather than asserting
  exact millisecond boundaries. Tests pinned to exact timing break when
  durations are tuned.

## Assertion Patterns

| Situation | Assertion |
|---|---|
| Exact value (phase, count, boolean) | `expect(x).toBe(y)` |
| Floating-point position or progress | `expect(x).toBeCloseTo(y)` |
| Directional movement | `expect(x).toBeGreaterThan(prev)` |
| Array/object shape | `expect(x).toEqual([...])` |
| Something happened, not exact value | `toBeGreaterThan(0)`, `not.toBe('idle')` |

Prefer `toBeCloseTo` over `toBe` for any value derived from floating-point
arithmetic. Accumulated `deltaMs` rounding means exact equality is fragile.

## Summary

- Create, act, assert. Models need nothing but their own API.
- Use `advanceTime` for models that are not leap-safe or use internal
  `await`. The microtask flush keeps things deterministic.
- Use factory-with-defaults helpers to reduce construction noise.
- Test composed models at both child and root level.
- Assert on public, specified behaviour. Avoid pinning tests to internal
  details or exact timing boundaries.

---

**Next:** [Testing Views](testing-views.md)
