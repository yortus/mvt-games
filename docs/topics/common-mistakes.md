# Common Mistakes

> A quick-reference table of mistakes commonly made in MVT codebases, with
> symptoms, causes, and fixes.

**Related:** [Time Management](time-management.md) · [Hot Paths](hot-paths.md) ·
[Bindings in Depth](bindings-in-depth.md)

---

*Assumes familiarity with [Models](../learn/models.md) and [Views](../learn/views.md).*

## Mistake Reference

| # | Mistake | Symptom | Fix |
|---|---------|---------|-----|
| 1 | [Using `setTimeout` in a model](#1-using-settimeout-in-a-model) | Non-deterministic behaviour, tests are flaky | Use paused GSAP timeline or manual timer |
| 2 | [Caching a binding value at construction](#2-caching-a-binding-at-construction) | View shows stale data after model changes | Re-read bindings in `refresh()` |
| 3 | [Pixel coordinates in a model](#3-pixel-coordinates-in-a-model) | Model tied to screen resolution | Use domain units |
| 4 | [Per-tick allocations in `refresh()`](#4-per-tick-allocations-in-refresh) | GC pressure, frame drops under load | Use index-based loops, pre-allocate |
| 5 | [Forgetting to advance the timeline](#5-forgetting-to-advance-the-timeline) | GSAP tweens never play, model state stalls | Call `timeline.time()` in `update()` |
| 6 | [Zero-duration GSAP tweens](#6-zero-duration-gsap-tweens) | `set()` callbacks skipped silently | Floor distance to avoid zero duration |
| 7 | [Auto-playing a GSAP timeline](#7-auto-playing-a-gsap-timeline) | Model advances on wall-clock time | Create timeline with `paused: true` |
| 8 | [Domain logic in a view](#8-domain-logic-in-a-view) | Untestable logic, broken layer separation | Move logic to the model |
| 9 | [View holding domain state](#9-view-holding-domain-state) | State lost on view recreation, untestable | Move state to the model |

---

## 1. Using `setTimeout` in a model

**Symptom:** Behaviour depends on real time, not model time. Tests that run
fast may pass, but tests on slow machines fail. Pausing the ticker does not
pause the model.

**Cause:** `setTimeout` and `setInterval` fire on wall-clock time, outside
the ticker's control.

**Fix:** Use a paused GSAP timeline advanced in `update()`, or track elapsed
time manually:

```ts
// Instead of setTimeout(() => explode(), 500):
let explosionTimer = 500;

update(deltaMs) {
    if (explosionTimer > 0) {
        explosionTimer -= deltaMs;
        if (explosionTimer <= 0) {
            explode();
        }
    }
}
```

See [Time Management](time-management.md).

## 2. Caching a binding at construction

**Symptom:** The view displays the initial value correctly but never updates
when the model changes (e.g. score stays at 0).

**Cause:** The binding's return value was captured once at construction and
never re-read.

**Fix:** Always read bindings inside `refresh()`:

```ts
// Wrong
const rows = bindings.getRows(); // frozen

// Correct
function refresh(): void {
    const rows = bindings.getRows(); // fresh each frame
}
```

See [Bindings in Depth](bindings-in-depth.md).

## 3. Pixel coordinates in a model

**Symptom:** Model tests break when screen resolution changes. Model is tied
to a specific rendering setup.

**Cause:** Position, size, or velocity expressed in pixels rather than domain
units.

**Fix:** Use domain-appropriate units (tiles, world-units, grid indices). Let
the view convert to pixels:

```ts
// Model: domain units
readonly x: number;  // world-units

// View: convert to pixels
container.position.x = bindings.getX() * SCALE;
```

See [Models (Learn)](../learn/models.md).

## 4. Per-tick allocations in `refresh()`

**Symptom:** Garbage collection pauses, frame drops under heavy load. Profiler
shows high allocation rate in refresh functions.

**Cause:** Array methods (`map`, `filter`, `slice`), template strings, spread
operators, or inline closures called every frame.

**Fix:** Use index-based `for` loops, arithmetic keys, and pre-allocated
structures:

```ts
// Wrong - allocates every frame
const positions = entities.map(e => e.position);

// Correct - no allocation
for (let i = 0; i < entities.length; i++) {
    views[i].position.set(entities[i].x, entities[i].y);
}
```

See [Hot Paths](hot-paths.md).

## 5. Forgetting to advance the timeline

**Symptom:** GSAP tweens are appended but never play. Model state stays at
initial values despite `update()` being called.

**Cause:** The timeline was created with `paused: true` (correct) but
`timeline.time()` is never called in `update()`.

**Fix:**

```ts
update(deltaMs) {
    timeline.time(timeline.time() + deltaMs * 0.001);
    // ... orchestration ...
}
```

See [Time Management](time-management.md).

## 6. Zero-duration GSAP tweens

**Symptom:** A `set()` call after a tween is silently skipped. State
transitions that should happen at the end of a movement never fire.

**Cause:** When `duration = distance / speed` and distance is zero, the tween
has zero duration. GSAP treats it as "already passed" on a paused timeline.

**Fix:** Floor the distance to ensure positive duration:

```ts
const dist = Math.abs(targetCol - state.x) + Math.abs(targetRow - state.y) || 0.001;
```

See [Time Management](time-management.md).

## 7. Auto-playing a GSAP timeline

**Symptom:** Model state advances on real time regardless of the ticker.
Pausing the game does not pause animations. Tests are non-deterministic.

**Cause:** Timeline created without `paused: true`, so GSAP's global ticker
drives it.

**Fix:**

```ts
// Wrong
const tl = gsap.timeline();

// Correct
const tl = gsap.timeline({ paused: true, autoRemoveChildren: true });
```

See [Time Management](time-management.md).

## 8. Domain logic in a view

**Symptom:** Game behaviour depends on the view existing. Removing or
replacing the view changes how the game plays.

**Cause:** The view contains collision checks, scoring logic, or state
transitions that belong in the model.

**Fix:** Move all domain logic to the model. The view should only read state
and update the presentation.

See [Views (Learn)](../learn/views.md).

## 9. View holding domain state

**Symptom:** State is lost when a view is destroyed and recreated (e.g. on
screen resize). Tests need a full rendering setup to verify behaviour.

**Cause:** Application state stored in view closures rather than in the
model.

**Fix:** Move the state to the model. Views should be replaceable without
losing any information the application depends on.

See [Presentation State](presentation-state.md) for the narrow exception
where views may hold cosmetic animation state.
