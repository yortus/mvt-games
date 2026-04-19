# Time Management

> Everything about how time flows in MVT models: the `deltaMs` contract,
> forbidden time mechanisms, GSAP timeline recipes, and the
> advance-then-orchestrate pattern.

**Related:** [Models](../learn/models.md) · [Hot Paths](hot-paths.md) ·
[Common Mistakes](common-mistakes.md)

---

*Assumes familiarity with [Models](../learn/models.md) and [The Game Loop](../learn/game-loop.md).*

## The `deltaMs` Contract (Recap)

Every model exposes an `update(deltaMs)` method. The ticker calls it once per
frame, passing the milliseconds elapsed since the last frame. This is the
**sole mechanism** by which time flows in a model.

The contract guarantees:

- **Determinism** - same sequence of `update(deltaMs)` calls produces the same
  state. Tests can replay exact frame sequences.
- **Ticker control** - the ticker can pause, slow down, speed up, or
  single-step time. Models stay in sync because they only ever see `deltaMs`.
- **Consistent snapshots** - between `update()` and `refresh()`, model state
  is stable. No background timer can mutate it mid-frame.

For the full introduction, see [Models](../learn/models.md).

## Forbidden Time Mechanisms

Models must never use wall-clock time or any mechanism that advances state
outside the ticker's control:

| Mechanism                          | Why it is forbidden                              |
| ---------------------------------- | ------------------------------------------------ |
| `setTimeout` / `setInterval`       | Fires on wall-clock time, not model time         |
| `requestAnimationFrame`            | Bypasses the ticker's `deltaMs` pipeline         |
| Auto-playing GSAP tweens           | GSAP's global ticker advances them independently |
| `Date.now()` / `performance.now()` | Wall-clock reads create non-determinism          |

Any approach that advances state exclusively through `update(deltaMs)` is
valid. A common pattern in this project is paused GSAP timelines advanced
manually (see below), but plain arithmetic or any other
mechanism can work as long as no wall-clock time leaks in.

## GSAP Timeline Recipe

Using GSAP inside a model is a **convenience, not a requirement**. A model can
advance state with plain arithmetic in `update()`. GSAP simply offers a
concise API for easing, sequencing, and multi-property transitions. The
timeline is a hidden implementation detail inside the factory closure - it is
never exposed on the model's public interface.

Note: GSAP is the library this project uses for tweening. Other codebases
using MVT could use a different tweening library, or none at all, without
affecting the architecture. The key MVT constraint is that any tweening
mechanism must be driven by `update(deltaMs)`, not by wall-clock time.

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
    // All tweens advance under explicit ticker control
}
```

This gives you the expressiveness of GSAP's timeline API while keeping all
state advancement under the ticker's explicit control. The single long-lived
timeline instance with `autoRemoveChildren` keeps memory tidy without manual
cleanup.

## Structuring `update()` - Advance then Orchestrate

When a model uses GSAP timelines, `update()` should follow a strict two-phase
pattern:

1. **Advance** - unconditionally advance every timeline and child model.
2. **Orchestrate** - check current state and trigger new sequences as needed.

`update()` must not contain detailed sequencing logic (manual timer arithmetic,
multi-step state machines). That work belongs in `schedule*()` helpers that
build timeline sequences declaratively.

```ts
// Good - advance + orchestrate
update(deltaMs) {
    const dt = 0.001 * deltaMs;
    moveTimeline.time(moveTimeline.time() + dt);
    attackTimeline.time(attackTimeline.time() + dt);

    // Orchestration: trigger next sequence when idle
    if (!state.moving) scheduleMove();
}
```

```ts
// Bad - manual sequencing inside update()
update(deltaMs) {
    if (state.phase === 'windup') {
        state.windupTimer -= deltaMs;
        if (state.windupTimer <= 0) {
            state.phase = 'attack';
            state.attackTimer = 500;
        }
    } else if (state.phase === 'attack') {
        state.attackTimer -= deltaMs;
        // ...increasingly tangled branches
    }
}
```

**Why this matters:**

- `schedule*()` helpers describe sequences declaratively using the timeline
  API - durations, easing, callbacks - in one place you can read top-to-bottom.
- `update()` stays short, flat, and easy to audit. Each frame it does the same
  thing: advance clocks, check a few predicates, maybe kick off new sequences.
- Multiple timelines (movement, attack, cooldown) advance independently,
  avoiding nested `if/else` chains that grow with every new behaviour.

## GSAP Best Practices

The patterns below address pitfalls specific to using GSAP with paused,
manually-advanced timelines in models. See also
[Common Mistakes](common-mistakes.md) for a quick-reference table.

### Use `autoRemoveChildren` and explicit positioning

Create paused timelines with `autoRemoveChildren: true` and position new
tweens explicitly at the current playhead:

```ts
const timeline = gsap.timeline({ paused: true, autoRemoveChildren: true });

function scheduleMove(): void {
    const t = timeline.time();
    timeline.to(state, { x: nextCol, y: nextRow, duration, ease: 'none' }, t);
    timeline.set(state, { row: nextRow, col: nextCol, moving: false }, t + duration);
}
```

Benefits:

- **Scales to complex models** - multiple overlapping tweens can coexist on
  one timeline.
- **Explicit positioning** - every tween states exactly where it sits on the
  timeline. No implicit assumptions about the playhead being at 0.
- **Automatic cleanup** - completed tweens are removed without manual
  intervention.
- **Cancellation is just `clear()`** - to abort in-progress tweens (e.g.
  direction reversal), call `timeline.clear()`. No `time(0)` reset needed.

For very simple timelines that only ever run one sequence at a time,
`timeline.clear().time(0)` before each new sequence is a valid shortcut that
avoids explicit positioning entirely. This does not scale to timelines with
overlapping or concurrent tweens.

### Prefer `timeline.set()` over `onComplete` for state transitions

`timeline.set()` is more declarative and compact:

```ts
// Declarative - intent is clear in the timeline layout
timeline.to(state, { x: 5, duration: 0.2 });
timeline.set(state, { arrived: true }, 0.2);
```

```ts
// Imperative - harder to read
timeline.to(state, {
    x: 5,
    duration: 0.2,
    onComplete() {
        state.arrived = true;
    },
});
```

### Guard against zero-duration tweens

Tweens added to a paused, manually-advanced timeline must have a positive
duration. When a zero-duration `to()` and a `set()` are both placed at the
current playhead position, GSAP treats them as "already passed" and skips
them on the next `time()` advance.

A common way this arises is computing `duration = distance / speed` where
the distance can be zero:

```ts
// Can produce duration = 0, causing the set() to be skipped
const dist = Math.abs(nextCol - state.x) + Math.abs(nextRow - state.y);
const duration = dist / speed;

// Fix: floor the distance so the tween always has positive duration
const dist = Math.abs(nextCol - state.x) + Math.abs(nextRow - state.y) || 0.001;
const duration = dist / speed;
// At speed = 8, 0.001 / 8 = 0.000125 s - completes within one frame.
```

The `|| 0.001` idiom is preferable to early-return snapping because it stays
on the normal code path and the sub-frame duration is visually imperceptible.

## Time Leap Safety

Some models tolerate large time jumps (`model.update(5000)`) and produce the
same result as many small increments. Others do not. The difference depends on
how the model is implemented.

A model is **leap-safe** when its `update()` logic is purely arithmetic - no
phase transitions, no orchestration guards, no timeline callbacks. The simple
timer example in the testing section below is leap-safe: it subtracts `deltaMs`
from a counter and that works regardless of step size.

A model is **not leap-safe** when any of these apply:

1. **Early returns after phase changes** - a phase-guarded block may transition
   to a new phase and then `return`, so the new phase's logic only runs on
   the next tick.
2. **GSAP timelines with callbacks** - a huge time jump can overshoot a
   timeline's total duration, skipping `set()` / `call()` triggers.
3. **Orchestration guards** - patterns like `if (!state.moving) scheduleMove()`
   depend on intermediate ticks to observe the completed-move flag.

Do not assume a model is leap-safe unless you know its internals. When you
need to fast-forward a model that is not leap-safe (e.g. generating
thumbnails), step in small increments to preserve correct behaviour. See the
`stepMs` helper in [Testing](testing.md).

## Testing Time-Dependent Models

Because time flows only through `update(deltaMs)`, testing is deterministic.
Step models forward in controlled increments and assert state at each point.

Leap-safe models can be tested with direct `update()` calls of any size:

```ts
test('timer expires after full duration', () => {
    const timer = createTimerModel(3000);
    expect(timer.isExpired).toBe(false);

    timer.update(1000);
    expect(timer.remainingMs).toBe(2000);

    timer.update(2000);
    expect(timer.isExpired).toBe(true);
});
```

For models that are not leap-safe, use a helper that breaks a large time
advance into small increments so orchestration logic triggers correctly between
phases:

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

test('game transitions through phases', () => {
    const game = createGameModel(options);
    game.startWave();

    stepMs(game, 1600); // advance ~1.6 seconds in small increments
    expect(game.phase).toBe('playing');
});
```

No rendering context, no DOM, no timers - just function calls and assertions.

For more on testing, see [Testing](testing.md).
