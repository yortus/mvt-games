# Testing

> MVT's strict separation makes testing straightforward. Models are
> deterministic - call `update()`, assert state. Views accept mock bindings -
> assert presentational output. Neither depends on the other.

**Related:** [Models (Learn)](../learn/models.md) · [Views (Learn)](../learn/views.md) ·
[Model Composition](model-composition.md)

---

*Assumes familiarity with [Models](../learn/models.md) and [Views](../learn/views.md).*

## Testing Philosophy

Test against **public, specified behaviours** - not internal implementation
details. A model test should call public methods and assert on public
properties. If the model internally uses a GSAP timeline, a state machine, or
a helper function, the test should not know or care about those - only about
the observable result.

This project uses [Vitest](https://vitest.dev/) as its test runner.

## Testing Models

Models are the easiest layer to test. They are self-contained simulations with
no rendering dependencies. The pattern is always the same:

1. Create the model with the desired options.
2. Call `update(deltaMs)` and/or action methods.
3. Assert public state.

### A simple model test

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

No rendering context. No DOM. No real timers. Just function calls and
assertions.

### Helper: stepping through time

Some models (those using GSAP timelines, multi-phase state machines, or
orchestration guards) are not safe to advance with a single large
`update()` call - see [Time Leap Safety](time-management.md#time-leap-safety).
For these models, use a helper that breaks a large time advance into small
increments so inter-tick transitions trigger correctly:

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

Use this when testing models that transition through phases:

```ts
it('transitions from wave-clear to playing', () => {
    const game = createGameModel(options);
    // ... set up conditions for wave clear ...

    stepMs(game, 3200); // advance ~3.2 seconds in small increments

    expect(game.phase).toBe('playing');
});
```

For leap-safe models (pure arithmetic, no orchestration), direct `update()`
calls with any size are fine:

```ts
it('counts down and expires', () => {
    const timer = createTimerModel(3000);
    timer.update(3000); // single leap is fine for this model
    expect(timer.isExpired).toBe(true);
});
```

Do not assume a model is leap-safe. When in doubt, use a helper like `stepMs`.

### Testing helper: factory with defaults

For models with many options, create a test helper that provides sensible
defaults and allows overrides:

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

This keeps individual tests focused on the behaviour under test rather than
repeating construction boilerplate.

## Testing Composed Models

Root models orchestrate child models and handle cross-cutting concerns. Test
both levels:

- **Child model tests** - verify individual behaviour in isolation.
- **Root model tests** - verify orchestration, collisions, scoring, and phase
  transitions.

```ts
describe('GameModel - scoring', () => {
    it('increments score when bullet hits asteroid', () => {
        const game = createGameModel(options);
        // ... arrange bullet and asteroid to collide ...
        game.update(16);
        expect(game.score).toBeGreaterThan(0);
    });
});
```

## Testing Views

Views are harder to unit test in the traditional sense because their output is
a scene graph (or DOM, or audio state) rather than simple values. Two common
approaches:

### Scene graph assertions

Create a view with mock bindings that return controlled values, then assert
properties of the resulting scene graph:

```ts
it('hides container when not visible', () => {
    const view = createEntityView({
        getX: () => 100,
        getY: () => 200,
        isVisible: () => false,
    });

    // Trigger refresh manually (normally called by the renderer)
    (view as any).onRender();

    expect(view.visible).toBe(false);
});
```

Mock bindings make it easy to test edge cases: what happens when the score is
zero? When the entity is off-screen? When a binding returns an extreme value?

### Snapshot testing

Snapshot testing captures the visual appearance of a view
and compares it against a known-good baseline. When the view's appearance changes, the
snapshot diff shows exactly what changed.

The specifics depend on your rendering technology and test setup. The key
principle is the same: construct the view with known bindings, trigger a
refresh, and capture the output.

## What Not to Test

- **Internal implementation details** - do not test private state, closure
  variables, or how a model internally uses GSAP.
- **Framework behaviour** - do not test that Pixi.js renders correctly or that
  GSAP tweens work. Trust the libraries.
- **Trivial accessors** - do not write a test that creates a model and asserts
  the initial value of a property that was passed as an option. Test
  behaviour, not construction.

## Summary

| Layer  | Input                 | Assert on              | Dependencies needed |
| ------ | --------------------- | ---------------------- | ------------------- |
| Model  | `update()`, methods   | Public properties      | None                |
| View   | Mock bindings         | Presentational output  | Rendering library   |
| Root   | `update()`, methods   | Cross-cutting state    | Child models        |
