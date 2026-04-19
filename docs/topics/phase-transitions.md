# Phase-Based Transitions

> Many game components cycle through a fixed set of phases - opening,
> open, closing, closed. This page shows how to model these transitions
> cleanly using a single `phase` value and a single `progress` number.

**Related:** [Presentation State](presentation-state.md) -
[Open-Ended Phases](open-ended-phases.md) -
[Complex Sequences](complex-sequences.md) -
[Time Management](time-management.md)

---

*Assumes familiarity with [Models](../learn/models.md) and
[Presentation State](presentation-state.md).*

## The Scenario

A banner slides in, stays visible for a while, then slides out. A door
opens, stays open for a duration, then closes. A power-up charges, holds
at full power, then discharges.

These all share the same structure: a component cycles through a fixed set
of **mutually-exclusive phases**. At any given moment, exactly one phase is
active. And for the phases that involve motion or change, you need to know
how far through that phase you are.

## Starting Simple: a Boolean

The simplest version of this is a boolean - `isOpen` - that flips between
two states. This works when the transition is instantaneous or when the
view handles the transition entirely as presentation state (see
[Presentation State](presentation-state.md)):

```ts
interface DoorModel {
    readonly isOpen: boolean;
    open(): void;
    close(): void;
    // ...
}
```

The view reads `isOpen` and fades between open and closed using its own
`fadeProgress`. Simple and effective for many cases.

But what if the model itself needs to know which phase it is in? What if
game logic depends on whether the door is mid-opening vs fully open? What
if the transition duration matters to the simulation?

## Adding Phase and Progress

When the model needs to track the transition, introduce two values:

- **`phase`** - a string literal union saying which phase is active
- **`progress`** - a number from 0 to 1 saying how far through that phase

```ts
type BannerPhase = 'closed' | 'opening' | 'open' | 'closing';

interface BannerModel {
    readonly phase: BannerPhase;
    readonly progress: number;
    show(): void;
    update(deltaMs: number): void;
}
```

The `phase` tells you *what* is happening. The `progress` tells you *how
far along* it is. Together they fully describe the component's transition
state.

### Why a single progress value?

You might be tempted to use separate progress properties for each phase:

```ts
// Avoid this
interface BannerModel {
    readonly openingProgress: number;   // 0..1 during opening, 0 otherwise
    readonly closingProgress: number;   // 0..1 during closing, 0 otherwise
    // ...
}
```

This creates several problems:

- **Ambiguity.** When both values are 0, is the banner closed or open? You
  need additional state to disambiguate.
- **Invariant maintenance.** You must ensure only one progress value is
  non-zero at a time. The phase is implicit rather than explicit, making
  bugs harder to spot.
- **Scaling.** Each new phase adds another progress property and another
  invariant to maintain.

A single `phase` + `progress` pair avoids all of this. The phase is always
explicit. The progress always refers to the current phase. There is nothing
to keep in sync.

## Implementation

Here is a banner model with four phases:

```ts
type BannerPhase = 'closed' | 'opening' | 'open' | 'closing';

interface BannerModel {
    readonly phase: BannerPhase;
    readonly progress: number;
    show(): void;
    update(deltaMs: number): void;
}

const OPEN_DURATION_MS = 300;
const DISPLAY_DURATION_MS = 2000;
const CLOSE_DURATION_MS = 200;

function createBannerModel(): BannerModel {
    let phase: BannerPhase = 'closed';
    let elapsedMs = 0;
    let durationMs = 0;

    return {
        get phase() { return phase; },
        get progress() {
            if (durationMs <= 0) return 0;
            return Math.min(1, elapsedMs / durationMs);
        },

        show() {
            beginPhase('opening', OPEN_DURATION_MS);
        },

        update(deltaMs: number) {
            if (phase === 'closed') return;
            elapsedMs += deltaMs;
            if (elapsedMs >= durationMs) advance();
        },
    };

    function beginPhase(next: BannerPhase, duration: number): void {
        phase = next;
        elapsedMs = 0;
        durationMs = duration;
    }

    function advance(): void {
        if (phase === 'opening') beginPhase('open', DISPLAY_DURATION_MS);
        else if (phase === 'open') beginPhase('closing', CLOSE_DURATION_MS);
        else if (phase === 'closing') beginPhase('closed', 0);
    }
}
```

Key points:

- **`phase` is always explicit.** You can read it at any time and know
  exactly what the model is doing.
- **`progress` is derived.** It is computed from `elapsedMs / durationMs`,
  so there is no extra state to keep in sync.
- **`advance()` is a simple state machine.** Each phase knows which phase
  comes next. The transitions are linear and predictable.
- **Durations are in the model.** The model owns the timing because the
  simulation depends on it (other code can react to phase changes).

### Reading it from a view

The view reads `phase` and `progress` and maps them to visual properties:

```ts
function refresh() {
    const phase = bindings.getPhase();
    const progress = bindings.getProgress();

    if (phase === 'closed') {
        banner.visible = false;
    }
    else if (phase === 'opening') {
        banner.visible = true;
        banner.alpha = progress;
        banner.position.x = lerp(OFF_SCREEN_X, CENTRE_X, progress);
    }
    else if (phase === 'open') {
        banner.visible = true;
        banner.alpha = 1;
        banner.position.x = CENTRE_X;
    }
    else if (phase === 'closing') {
        banner.visible = true;
        banner.alpha = 1 - progress;
        banner.position.x = lerp(CENTRE_X, OFF_SCREEN_X, progress);
    }
}
```

Each branch handles exactly one phase. The view is a pure function of
`phase` and `progress` - no timers, no edge detection, no presentation
state needed.

## When Should the Model Own the Phases?

The banner example puts phase and progress in the model. But this is not
always necessary. The decision depends on whether the simulation needs to
know about the transition.

| Situation | Where phases live |
|---|---|
| Game logic reacts to the phase (e.g. door blocks movement while opening) | Model |
| Other models depend on the transition timing (e.g. cascade chain) | Model |
| Multiple views need to agree on the same progress | Model |
| The transition is purely visual (e.g. a score popup sliding in) | View (presentation state) |
| Only one view cares about the transition | View (presentation state) |

When phases live in the view as presentation state, the same `phase` +
`progress` pattern applies - it just lives in the view's `update()` method
rather than the model. See [Presentation State](presentation-state.md) for
how views manage their own timed state.

## A Real Example: Match-3 Board Phases

The cactii match-3 game uses this pattern for its board model. The board
cycles through five mutually-exclusive phases:

```ts
type BoardPhase = 'idle' | 'swapping' | 'reversing' | 'matching' | 'settling';
```

Each phase has its own duration and progress. The model exposes
phase-specific progress values (`swapProgress`, `matchProgress`,
`settleProgress`) because different phases have different durations and
the view needs to interpolate different properties for each.

The `update()` method advances elapsed time and calls `advance()` when a
phase completes - exactly the same pattern as the banner example, just with
more phases and richer transition logic (matching triggers settling, settling
may cascade back into matching).

## Summary

- Use a **string literal union** for `phase` to make the current state
  explicit and exhaustive.
- Use a **single `progress`** value (0..1) for how far through the current
  phase.
- Let `progress` be **derived** from elapsed time and duration - not a
  separately maintained variable.
- Put phases in the **model** when the simulation depends on them; put
  them in the **view** when they are purely cosmetic.
- The `advance()` function is your state machine - each phase knows its
  successor.

---

**Next:** [Open-Ended Phases](open-ended-phases.md) - what happens when a
phase has no fixed duration.
