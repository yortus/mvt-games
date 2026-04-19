# Open-Ended Phases

> Not every phase has a fixed duration. A popup stays open until the user
> dismisses it. A charging weapon holds until the button is released. This
> page explores how to handle phases where `progress` has no obvious
> meaning, and how to pair them with cyclic animations.

**Related:** [Phase-Based Transitions](phase-transitions.md) -
[Complex Sequences](complex-sequences.md) -
[Presentation State](presentation-state.md) -
[Time Management](time-management.md)

---

*Assumes familiarity with [Phase-Based Transitions](phase-transitions.md).*

## The Problem

The [previous page](phase-transitions.md) introduced the `phase` +
`progress` pattern for transitions with fixed durations. A banner opens
over 300ms, displays for 2000ms, closes over 200ms. Every phase has a
known duration, so `progress` (0..1) always has a clear meaning.

But what about a popup that stays open until the player taps "OK"? Or a
treasure chest that opens and then stays open indefinitely? The `open`
phase has no duration. Progress from 0 to 1 has no meaning when the phase
lasts forever.

## Elapsed Time Instead of Progress

For open-ended phases, replace the concept of progress with **elapsed
time**. The model tracks how long the current phase has been active,
and consumers decide what to do with that number:

```ts
type ChestPhase = 'closed' | 'opening' | 'open' | 'closing';

interface ChestModel {
    readonly phase: ChestPhase;
    /** 0..1 progress for timed phases; 0 for open-ended phases. */
    readonly progress: number;
    /** Milliseconds elapsed in the current phase. */
    readonly elapsedMs: number;
    open(): void;
    close(): void;
    update(deltaMs: number): void;
}
```

During `opening` and `closing`, `progress` works as before - it advances
from 0 to 1 over a fixed duration. During `open` and `closed`, `progress`
stays at 0 (or is simply not meaningful), but `elapsedMs` keeps
counting.

```ts
const OPEN_DURATION_MS = 400;
const CLOSE_DURATION_MS = 300;

function createChestModel(): ChestModel {
    let phase: ChestPhase = 'closed';
    let phaseTimeMs = 0;
    let durationMs = 0;

    return {
        get phase() { return phase; },
        get progress() {
            if (durationMs <= 0) return 0;
            return Math.min(1, phaseTimeMs / durationMs);
        },
        get elapsedMs() { return phaseTimeMs; },

        open() {
            if (phase !== 'closed') return;
            beginPhase('opening', OPEN_DURATION_MS);
        },

        close() {
            if (phase !== 'open') return;
            beginPhase('closing', CLOSE_DURATION_MS);
        },

        update(deltaMs: number) {
            phaseTimeMs += deltaMs;
            if (durationMs > 0 && phaseTimeMs >= durationMs) advance();
        },
    };

    function beginPhase(next: ChestPhase, duration: number): void {
        phase = next;
        phaseTimeMs = 0;
        durationMs = duration;
    }

    function advance(): void {
        if (phase === 'opening') beginPhase('open', 0);
        else if (phase === 'closing') beginPhase('closed', 0);
    }
}
```

The key difference from the banner example: `open` and `closed` have a
duration of 0, meaning `progress` stays at 0 and the model never auto-advances
out of those phases. An external trigger (`close()` or `open()`) is required.
Meanwhile, `elapsedMs` keeps accumulating - useful for any time-based
behaviour during the phase.

## Cyclic Animations in Open-Ended Phases

Open-ended phases often pair with cyclic animations. A popup that stays open
might show a pulsing glow, a rotating icon, or a bobbing arrow. These
animations loop indefinitely until the phase changes.

Since the model exposes `elapsedMs`, the view can derive cyclic
motion directly:

```ts
function refresh() {
    const phase = bindings.getPhase();
    const progress = bindings.getProgress();
    const elapsed = bindings.getElapsedMs();

    if (phase === 'closed') {
        popup.visible = false;
    }
    else if (phase === 'opening') {
        popup.visible = true;
        popup.alpha = progress;
        popup.scale.set(0.5 + 0.5 * progress);
    }
    else if (phase === 'open') {
        popup.visible = true;
        popup.alpha = 1;
        // Gentle bobbing cycle: 2 seconds per full bob
        const bob = Math.sin(elapsed / 2000 * Math.PI * 2) * 4;
        popup.position.y = BASE_Y + bob;
        // Pulsing glow: 3 seconds per full pulse
        glow.alpha = 0.3 + 0.2 * Math.sin(elapsed / 3000 * Math.PI * 2);
    }
    else if (phase === 'closing') {
        popup.visible = true;
        popup.alpha = 1 - progress;
        popup.scale.set(1 - 0.5 * progress);
    }
}
```

The cyclic animation is derived purely from `elapsed` using `Math.sin`.
No presentation state is needed for the bob or pulse - they are stateless
functions of elapsed time.

This is a useful property: because `elapsedMs` resets to 0 when
entering the phase, the cycle always starts from a consistent position.
And because the view computes the animation from elapsed time rather than
accumulating its own timer, it is trivially deterministic and
frame-rate-independent.

## When the View Owns the Open-Ended Phase

If the open-ended phase is purely cosmetic - no game logic depends on
whether the popup is showing - the phase can live in the view as
presentation state:

```ts
// -- Presentation state --
let phase: PopupPhase = 'closed';
let elapsedMs = 0;
let durationMs = 0;

function update(deltaMs: number) {
    elapsedMs += deltaMs;
    if (durationMs > 0 && elapsedMs >= durationMs) advance();

    // Trigger from model state
    const shouldShow = bindings.hasNotification();
    if (shouldShow && phase === 'closed') beginPhase('opening', 200);
    if (!shouldShow && phase === 'open') beginPhase('closing', 150);
}
```

The same pattern applies whether the phase lives in the model or the view.
The only difference is who triggers the transitions and whether external
code can observe the phase.

## Combining Fixed and Open-Ended Phases

Most real components mix both kinds. The chest model above has two fixed
phases (`opening`, `closing`) and two open-ended phases (`open`, `closed`).
The pattern handles this naturally:

- Fixed phases: `durationMs > 0`, auto-advance when elapsed reaches
  duration, `progress` is meaningful.
- Open-ended phases: `durationMs` is 0, no auto-advance, wait for an
  external trigger, `elapsedMs` accumulates for cyclic animations.

No special handling is needed. The same `update()` method works for both.

## Elapsed Time vs. a Separate Cycle Timer

An alternative approach is to maintain a separate cycle timer that resets
on some period:

```ts
// Alternative - a separate cycle timer
let cycleMs = 0;
const CYCLE_PERIOD_MS = 2000;

function update(deltaMs: number) {
    cycleMs = (cycleMs + deltaMs) % CYCLE_PERIOD_MS;
}
```

This works, but `elapsedMs` already provides the same information.
The view can compute `elapsed % CYCLE_PERIOD_MS` itself:

```ts
const cycleT = (elapsed % 2000) / 2000; // 0..1 repeating
```

Unless the cycle needs to be synchronized across multiple consumers or
the model needs to know the cycle position, prefer deriving it from
elapsed time rather than maintaining a separate timer.

## Summary

- For phases with **fixed durations**, use `progress` (0..1) as before.
- For phases with **no fixed duration**, expose `elapsedMs` and let
  consumers derive cyclic or time-based behaviour.
- **Cyclic animations** are stateless functions of elapsed time
  (`Math.sin(elapsed / period * Math.PI * 2)`). No extra presentation
  state needed.
- The same model structure handles both fixed and open-ended phases -
  fixed phases auto-advance, open-ended phases wait for external triggers.
- Prefer deriving cycle values from `elapsedMs` rather than
  maintaining separate cycle timers.

---

**Next:** [Complex Sequences](complex-sequences.md) - orchestrating
multiple overlapping effects with precise timing.
