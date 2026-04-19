# Complex Sequences

> Some effects cannot be expressed as a single phase with a single
> progress value. A match celebration involves a flash, a shake, dust
> clouds, fireworks, and a score popup - all overlapping with precise
> timing offsets. This page shows how to orchestrate complex multi-step
> sequences.

**Related:** [Phase-Based Transitions](phase-transitions.md) -
[Open-Ended Phases](open-ended-phases.md) -
[Taming Complex Views](managing-view-complexity.md) -
[Presentation State](presentation-state.md)

---

*Assumes familiarity with
[Phase-Based Transitions](phase-transitions.md) and
[Presentation State](presentation-state.md).*

## Beyond Single-Phase Transitions

The previous pages covered components with mutually-exclusive phases: the
banner is either opening, open, or closing. One phase at a time, one
progress value.

But some effects involve **multiple steps running simultaneously** with
different start times, different durations, and overlapping lifespans.
Consider what happens when tiles match in a match-3 game:

```
Time (ms):  0    100   200   300   400   500   600   700   800
            |     |     |     |     |     |     |     |     |
flash:      [===]
shake:        [===============]
dust:            [===================]
popup:              [=====================]
stars:                 [===============================]
```

The flash starts immediately and finishes in 100ms. The shake starts at
50ms and overlaps with the flash. The popup begins at 200ms while dust
and shake are still running. Stars start last and finish last.

You cannot model this as a single `phase` + `progress` pair. There is no
single phase - five things are happening at once, each with its own
timeline.

## The Sequence Concept

A **sequence** is a collection of named **steps**, each with a start time
and duration. The sequence itself has an overall duration (the latest
endpoint of any step). When started, it advances through elapsed time,
and each step independently reports whether it is active and how far
through its own duration it is.

```ts
interface Sequence {
    readonly steps: {
        readonly [name: string]: {
            readonly isActive: boolean; // per-step flag
            readonly progress: number;  // per-step 0..1
        };
    };
    readonly isActive: boolean;         // overall flag
    progress: number;                   // overall 0..1
    start(): void;
    update(deltaMs: number): void;
}
```

Each step is the familiar `progress` (0..1) pattern from
[Phase-Based Transitions](phase-transitions.md) - but now multiple steps
run in parallel with independent timelines.

## Defining a Sequence

A sequence is defined as a static list of step definitions:

```ts
const matchEffectSteps = [
    { name: 'flash',  startMs: 0,   durationMs: 100 },
    { name: 'shake',  startMs: 50,  durationMs: 400 },
    { name: 'dust',   startMs: 150, durationMs: 500 },
    { name: 'popup',  startMs: 200, durationMs: 600 },
    { name: 'stars',  startMs: 250, durationMs: 800 },
] as const;

const matchSequence = createSequence(matchEffectSteps);
```

The definitions are **declarative** - they describe the timeline
structure, not the visual effects. The sequence factory pre-computes
total duration and pre-allocates all step state. No per-tick allocations.

## Using Step Progress in Views

Each step's `progress` drives a piece of the visual effect. Views read
it in `refresh()` the same way they read any other binding:

```ts
function refresh() {
    const seq = bindings.getMatchSequence();

    // Flash: bright overlay that fades out
    if (seq.steps.flash.isActive) {
        flash.visible = true;
        flash.alpha = 1 - seq.steps.flash.progress;
    } else {
        flash.visible = false;
    }

    // Shake: oscillation that decays over the step's duration
    if (seq.steps.shake.isActive) {
        const amp = 10 * (1 - seq.steps.shake.progress);
        const freq = seq.steps.shake.progress * 30;
        container.position.x = Math.sin(freq) * amp;
    } else {
        container.position.x = 0;
    }
}
```

Each step's progress is independent. The flash reaches 1.0 and becomes
inactive while the shake is still at 0.3. The view handles each step in
its own branch with no coupling between them.

## Splitting Effects Across Sub-Views

A complex sequence often involves many visual layers: particles, overlays,
text popups, screen effects. Rather than handling all of them in one view,
**split each effect into its own sub-view** and distribute the sequence via
bindings.

The parent view creates the sequence and passes it to child views:

```ts
function createBoardView(bindings: BoardBindings): StatefulPixiView {
    const matchSequence = createSequence(MATCH_EFFECT_STEPS);

    const flash = createFlashOverlayView({
        getMatchSequence: () => matchSequence,
    });
    const shake = createShakeView({
        getMatchSequence: () => matchSequence,
    });
    const particles = createParticleView({
        getMatchSequence: () => matchSequence,
    });

    // ...

    return Object.assign(view, {
        update(deltaMs: number) {
            // Trigger and advance the shared sequence
            if (phaseChanged('matching')) matchSequence.start();
            matchSequence.update(deltaMs);
        },
    });
}
```

Each child view receives the sequence through its bindings and reads only
the steps it cares about. The flash view reads `steps.flash`. The shake
view reads `steps.shake`. No child knows about the other children or their
steps.

This is the same [split-into-focused-sub-views](managing-view-complexity.md)
strategy from the previous section, applied to sequences. The sequence
object is the shared coordination mechanism - each sub-view reads its own
slice independently.

## Reacting to Step Lifecycle Events

Reading `isActive` and `progress` in `refresh()` works well for continuous
effects (fading, shaking, scaling). But some effects need **one-shot
actions** at specific moments: spawn particles when dust begins, set up
text when the popup enters, clean up when a step ends.

A **sequence reaction** bridges step state to lifecycle callbacks:

```ts
const updateEffects = createSequenceReaction(matchSequence, {
    dust: {
        entering: () => {
            // One-shot: position dust particles at matched cells
            positionDustAt(bindings.getMatchedCells());
        },
        active: (progress) => {
            // Continuous: expand and fade dust each frame
            for (let i = 0; i < dustPool.length; i++) {
                dustPool[i].scale.set(progress * MAX_RADIUS);
                dustPool[i].alpha = 1 - progress;
            }
        },
        inactive: () => {
            // Cleanup: hide all dust particles
            for (let i = 0; i < dustPool.length; i++) {
                dustPool[i].alpha = 0;
            }
        },
    },
    popup: {
        entering: () => {
            label.text = `+${bindings.getPoints()}`;
        },
        active: (progress) => {
            label.position.y = -RISE_PX * progress;
            label.alpha = 1 - progress * progress;
        },
        inactive: () => {
            label.alpha = 0;
        },
    },
});

// Call in refresh():
view.onRender = updateEffects;
```

The reaction tracks each step's phase (before, active, after) and fires
callbacks on transitions:

- **`entering`** - fires once when a step becomes active (the "rising
  edge"). Use for one-shot setup: positioning particles, setting text,
  starting sounds.
- **`active`** - fires every frame while the step is running, with the
  step's current progress. Use for continuous interpolation.
- **`inactive`** - fires once when a step returns to rest. Use for
  cleanup: hiding graphics, resetting positions.

The reaction is called inside `refresh()` (or `onRender`). It reads the
sequence's current state each frame and dispatches accordingly - no
subscriptions, no events, just polling.

## Triggering Sequences

A sequence is typically triggered by a model state change. The view (or
parent view) watches for the change and calls `start()`:

```ts
const phaseWatcher = watch({ phase: bindings.getPhase });

function update(deltaMs: number) {
    const { phase } = phaseWatcher.poll();
    if (phase.changed && phase.value === 'matching') {
        matchSequence.start();
    }
    matchSequence.update(deltaMs);
}
```

The sequence does not care what triggered it. `start()` resets to t=0
and begins advancing. If called mid-sequence, it restarts cleanly.

## Where Does the Sequence Live?

It depends on where the timing comes from.

### Self-timed sequences (presentation state)

Often the model exposes a simple phase (`'matching'`) but says nothing
about the visual choreography. The view creates a sequence, triggers it
on the phase change, and advances it with `update(deltaMs)`. The model
is unaware of the sequence - it is
[presentation state](presentation-state.md).

```
Model:  phase = 'matching', matchedCells = [...], cascadeStep = 2

                      ↓ (bindings)

Parent view:  creates matchSequence, triggers start() on phase change
              passes sequence to child views via bindings

  Flash view:     reads steps.flash.progress
  Shake view:     reads steps.shake.progress
  Particle view:  reads steps.dust.progress, steps.stars.progress
  Popup view:     reads steps.popup.progress
```

The model is unaware of the sequence. The child views are unaware of each
other. The parent view is the only place that knows the full picture.

### Model-driven sequences

Sometimes the model already provides timing - a phase with `progress`
(0..1) that advances over a known duration. The view wants multiple
overlapping visual effects mapped to different windows within that
progress.

This is **not** presentation state. The view holds no timing of its own -
it derives everything from the model's progress in `refresh()`. No
`update(deltaMs)` is needed.

A `Sequence`'s `progress` property is settable. Instead of advancing with
`update(deltaMs)`, the view writes the model's progress directly:

```ts
const clearSequence = createSequence([
    { name: 'flash',     startMs: 0,   durationMs: 150 },
    { name: 'shrink',    startMs: 100, durationMs: 500 },
    { name: 'particles', startMs: 200, durationMs: 600 },
    { name: 'fade',      startMs: 400, durationMs: 600 },
]);
```

The step timings define *proportions* - the absolute millisecond values
determine each step's window relative to the sequence's total duration.

In `refresh()`, set the sequence's progress from the model, then read
step state as usual:

```ts
function refresh() {
    clearSequence.progress = bindings.getProgress(); // 0..1 from the model

    if (clearSequence.steps.flash.isActive) {
        overlay.visible = true;
        overlay.alpha = 1 - clearSequence.steps.flash.progress;
    } else {
        overlay.visible = false;
    }

    sprite.scale.set(1 - clearSequence.steps.shrink.progress * 0.8);
    sprite.alpha = 1 - clearSequence.steps.fade.progress;
}
```

The same `Sequence` API works in both modes - the only difference is
whether time comes from `update(deltaMs)` or from setting `progress`
directly. Step `isActive` flags, per-step progress, and
`SequenceReaction` all work identically.

If the model slows down or pauses, the effects automatically follow.

## Looping Sequences

What if a sequence needs to repeat? A cycling idle animation, a repeating
warning pulse, a looping particle effect?

There are two approaches, depending on the use case.

### Cyclic effects from elapsed time

For simple repeating effects (bobbing, pulsing, rotating), you don't need
a sequence at all. Derive the animation from elapsed time, as described in
[Open-Ended Phases](open-ended-phases.md):

```ts
const bob = Math.sin(elapsed / 2000 * Math.PI * 2) * 4;
```

This is the simplest approach and should be preferred when the loop is a
single smooth cycle with no distinct steps.

### Restarting a sequence

For multi-step effects that need to repeat (e.g. a three-part warning
sequence that loops: flash, text, fade), restart the sequence when it
completes:

```ts
function update(deltaMs: number) {
    matchSequence.update(deltaMs);
    if (shouldLoop && !matchSequence.isActive) {
        matchSequence.start(); // restart from t=0
    }
}
```

The `start()` method resets all steps to their initial state, so the
reaction's `inactive` handlers fire (cleaning up) and the cycle begins
fresh. This is a clean approach: the sequence definition stays
declarative, and the looping logic is a single conditional in `update()`.

For sequences that need to loop a fixed number of times, track a counter:

```ts
let loopsRemaining = 3;

function update(deltaMs: number) {
    matchSequence.update(deltaMs);
    if (loopsRemaining > 0 && !matchSequence.isActive) {
        loopsRemaining--;
        matchSequence.start();
    }
}
```

### Partial loops and ping-pong

If only some steps should repeat while others play once, model it as two
separate sequences: one for the one-shot intro, one for the repeating
body. The intro sequence triggers the loop sequence on completion.

Ping-pong effects (forward then backward) are best modelled as a single
sequence with explicit forward and reverse steps:

```ts
const pingPong = createSequence([
    { name: 'forward', startMs: 0,   durationMs: 500 },
    { name: 'reverse', startMs: 500, durationMs: 500 },
]);
```

The view maps `forward.progress` to 0..1 and `reverse.progress` to 1..0.
When the sequence completes, restart it.

## A Real Example: Match-3 Celebration

The cactii match-3 game uses this pattern for its match celebration. The
board model enters the `matching` phase. The board view creates a shared
`Sequence` with 12 overlapping steps spanning over a second:

```
Time (ms):   0       200     400     600     800     1000
             |       |       |       |       |       |
flash:       [===]
fade:        [==============]
zoom:        [=====================================]
shake:         [=================]
bannerIn:         [=====]
fwLaunch:         [===========]
dust:             [=================]
popup:               [===================]
stars:                 [=============================]
bannerHold:              [=========]
fwBurst:                   [==============]
bannerOut:                                 [=======]
```

Six child views each handle their own slice:

- **Flash overlay** - reads `steps.flash`, peaks at 30% then fades
- **Shake container** - reads `steps.shake` and `steps.zoom`, oscillates
  and scales the board
- **Match effects** - reads `steps.dust`, `steps.popup`, `steps.stars`,
  spawns particles and score text
- **Firework view** - reads `steps.fireworkLaunch` and
  `steps.fireworkBurst`, launches and explodes particles
- **Banner view** - reads `steps.bannerIn`, `steps.bannerHold`,
  `steps.bannerOut`, slides a combo banner in and out
- **Pieces view** - reads `steps.fade`, fades matched tiles out

Each child uses `createSequenceReaction` to handle one-shot setup
(`entering`), continuous interpolation (`active`), and cleanup
(`inactive`). The parent view triggers `matchSequence.start()` when the
model enters the `matching` phase. Cascade intensity scales the effects -
higher cascades produce bigger shakes, more particles, and enable
fireworks and banners.

The model knows nothing about any of this. It tracks `phase`,
`matchedCells`, and `cascadeStep`. The entire celebration sequence is
presentation state.

## Summary

- **Sequences** orchestrate multiple overlapping steps with independent
  timelines. Each step has its own `isActive` and `progress` (0..1).
- **Define steps declaratively** as a list of `{ name, startMs,
  durationMs }`. The sequence factory pre-allocates all state.
- **Split effects across sub-views**, each reading only the steps it
  needs. The parent creates and distributes the sequence via bindings.
- **Sequence reactions** provide lifecycle callbacks (`entering`,
  `active`, `inactive`) for one-shot setup, continuous interpolation,
  and cleanup.
- **Self-timed sequences** are presentation state - the view owns the
  timing and triggers with `start()` on a model state change.
- **Model-driven sequences** set `sequence.progress` from a model's 0..1
  value. No presentation state, no `update(deltaMs)` - the same step
  API works in both modes.
- **Looping**: derive simple cycles from elapsed time; for multi-step
  loops, restart the sequence when it completes.

---

**See also:** [Taming Complex Views](managing-view-complexity.md) -
[Presentation State](presentation-state.md) -
[Phase-Based Transitions](phase-transitions.md)
