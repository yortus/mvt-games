# Common Mistakes

> A quick-reference table of mistakes commonly made in MVT codebases, with
> symptoms, causes, and fixes.

**Related:** [Time Management](../simulating-the-world/time-management.md) · [Hot Paths](../performance/hot-paths.md) ·
[Why Performance Matters](../performance/why-performance-matters.md) · [Bindings in Depth](../presenting-the-world/bindings-in-depth.md)

---

*Assumes familiarity with [Models](../simulating-the-world/models.md) and [Views](../presenting-the-world/views.md).*

## Mistake Reference

| # | Mistake | Symptom | Fix |
|---|---------|---------|-----|
| 1 | [Using `setTimeout` in a model](#using-settimeout-in-a-model) | Non-deterministic behaviour, tests are flaky | Use paused GSAP timeline or manual timer |
| 2 | [Caching a binding at construction](#caching-a-binding-at-construction) | View shows stale data after model changes | Re-read bindings in `refresh()` |
| 3 | [Pixel coordinates in a model](#pixel-coordinates-in-a-model) | Model tied to screen resolution | Use domain units |
| 4 | [Avoidable work every frame](#avoidable-work-every-frame) | Stutter, high CPU usage, frames that slow down as the scene grows | Follow the hot path rules, skip inactive subtrees, reuse containers |
| 5 | [Forgetting to advance the timeline](#forgetting-to-advance-the-timeline) | GSAP tweens never play, model state stalls | Call `timeline.time()` in `update()` |
| 6 | [Zero-duration GSAP tweens](#zero-duration-gsap-tweens) | `set()` callbacks skipped silently | Floor distance to avoid zero duration |
| 7 | [Auto-playing a GSAP timeline](#auto-playing-a-gsap-timeline) | Model advances on wall-clock time | Create timeline with `paused: true` |
| 8 | [Domain logic in a view](#domain-logic-in-a-view) | Untestable logic, broken layer separation | Move logic to the model |
| 9 | [View holding domain state](#view-holding-domain-state) | State lost on view recreation, untestable | Move state to the model |

---

## Using `setTimeout` in a model

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

See [Time Management](../simulating-the-world/time-management.md).

## Caching a binding at construction

**Symptom:** The view displays the initial value correctly but never updates
when the model changes (e.g. score stays at 0).

**Cause:** The binding's return value is captured once at construction and
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

See [Bindings in Depth](../presenting-the-world/bindings-in-depth.md).

## Pixel coordinates in a model

**Symptom:** Model tests break when screen resolution changes. Model is tied
to a specific rendering setup.

**Cause:** Position, size, or velocity is expressed in pixels rather than
domain units.

**Fix:** Use domain-appropriate units (tiles, world-units, grid indices). Let
the view convert to pixels:

```ts
// Model: domain units
readonly x: number;  // world-units

// View: convert to pixels
container.position.x = bindings.getX() * SCALE;
```

See [Models (Learn)](../simulating-the-world/models.md).

## Avoidable work every frame

**Symptom:** Occasional stutter, from garbage collection pauses. High CPU
usage. Frames that get slower as the scene grows, even when little is
changing.

**Cause:** Code that runs every frame doing work it does not need to:

- **Allocating per game object:** building strings, calling
  `Object.values()`, or using array methods such as `.map()` and `.filter()`
  for every enemy, bullet or particle creates garbage every frame. With a
  thousand game objects that can be tens of kilobytes per frame, which the
  engine must pause to collect.
- **Repeating work that hasn't changed:** `update()` and `refresh()` run every
  frame, so do as little in them as the frame needs. For example, skip hidden
  or inactive parts of the scene by returning `SKIP_DESCENDANTS`, recompute a
  derived value only when its inputs change, and use
  [change detection](../reacting-to-changes/change-detection.md) to skip
  expensive updates when nothing has changed.
- **Rebuilding short-lived items:** building and destroying a container for
  each bullet or particle can be several times slower than reusing containers
  from a pool.

**Fix:** Follow the [hot path rules](../performance/hot-paths.md):

```ts
// Wrong - allocates every frame
const positions = enemies.map(e => e.position);

// Correct - no allocation
for (let i = 0; i < enemies.length; i++) {
    views[i].position.set(enemies[i].x, enemies[i].y);
}
```

Before rewriting anything, check what it actually costs: see
[Performance Measurements](../performance/measurements.md). Most games never
get near the limits ([Why Performance Matters](../performance/why-performance-matters.md)).

## Forgetting to advance the timeline

**Symptom:** GSAP tweens are appended but never play. Model state stays at
initial values despite `update()` being called.

**Cause:** The timeline is created with `paused: true` (correct), but
`timeline.time()` is never called in `update()`.

**Fix:**

```ts
update(deltaMs) {
    timeline.time(timeline.time() + deltaMs * 0.001);
    // ... orchestration ...
}
```

See [Time Management](../simulating-the-world/time-management.md).

## Zero-duration GSAP tweens

**Symptom:** A `set()` call after a tween is silently skipped. State
transitions that should happen at the end of a movement never fire.

**Cause:** When `duration = distance / speed` and distance is zero, the tween
has zero duration. GSAP treats it as "already passed" on a paused timeline.

**Fix:** Floor the distance to ensure positive duration:

```ts
const dist = Math.abs(targetCol - state.x) + Math.abs(targetRow - state.y) || 0.001;
```

See [Time Management](../simulating-the-world/time-management.md).

## Auto-playing a GSAP timeline

**Symptom:** Model state advances on real time regardless of the ticker.
Pausing the game does not pause animations. Tests are non-deterministic.

**Cause:** The timeline is created without `paused: true`, so GSAP's global
ticker drives it.

**Fix:**

```ts
// Wrong
const tl = gsap.timeline();

// Correct
const tl = gsap.timeline({ paused: true, autoRemoveChildren: true });
```

See [Time Management](../simulating-the-world/time-management.md).

## Domain logic in a view

**Symptom:** Game behaviour depends on the view existing. Removing or
replacing the view changes how the game plays.

**Cause:** The view contains collision checks, scoring logic, or state
transitions that belong in the model.

**Fix:** Move all domain logic to the model. The view should only read state
and update the presentation.

See [Views (Learn)](../presenting-the-world/views.md).

## View holding domain state

**Symptom:** State is lost when a view is destroyed and recreated (e.g. on
screen resize). Tests need a full rendering setup to verify behaviour.

**Cause:** Application state is stored in view closures rather than in the
model.

**Fix:** Move the state to the model. Views should be replaceable without
losing any information the application depends on.

See [Presentation State](../adding-visual-polish/presentation-state.md) for the narrow exception
where views may hold cosmetic animation state.
