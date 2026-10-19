# Open-Ended Phases

> Not every phase has a fixed duration. A popup stays open until the user
> dismisses it. A charging weapon holds until the button is released. This
> page shows how a model handles a phase with no end time, and why anything
> that moves during it, such as a looping bob or pulse, belongs to the view.

**Related:** [Phase-Based Transitions](phase-based-transitions.md) -
[Complex Sequences](complex-sequences.md) -
[Presentation State](../adding-visual-polish/presentation-state.md) -
[Reduced Motion](../adding-visual-polish/reduced-motion.md) -
[Time Management](../simulating-the-world/time-management.md)

---

*Assumes familiarity with [Phase-Based Transitions](phase-based-transitions.md).*

## The Problem

The [previous page](phase-based-transitions.md) introduced the `phase` +
`progress` pattern for transitions with fixed durations. A banner opens
over 300ms, displays for 2000ms, closes over 200ms. Every phase has a
known duration, so `progress` (0..1) always has a clear meaning.

But what about a popup that stays open until the player taps "OK"? Or a
treasure chest that opens and then stays open indefinitely? The `open`
phase has no duration, so there is nothing for its progress to measure.

## A Phase That Waits

An open-ended phase doesn't end on a timer. It ends when something else
happens, such as the player's command. So the model has nothing to time
while it lasts. It simply waits:

```ts
type ChestPhase = 'closed' | 'opening' | 'open' | 'closing';

interface ChestModel {
    readonly phase: ChestPhase;
    /** How far through opening or closing, 0..1. 1 when open or closed. */
    readonly progress: number;
    open: () => void;
    close: () => void;
    update: (deltaMs: number) => void;
}
```

During `opening` and `closing`, `progress` works as before. It advances
from 0 to 1 over a fixed duration. During `open` and `closed`, it stays
at 1.

```ts
const OPEN_DURATION_MS = 400;
const CLOSE_DURATION_MS = 300;

function createChestModel(): ChestModel {
    let phase: ChestPhase = 'closed';
    let elapsedMs = 0;
    let durationMs = 0;

    return {
        get phase() { return phase; },
        get progress() {
            if (durationMs <= 0) return 1;
            return Math.min(1, elapsedMs / durationMs);
        },

        open() {
            if (phase !== 'closed') return;
            beginPhase('opening', OPEN_DURATION_MS);
        },

        close() {
            if (phase !== 'open') return;
            beginPhase('closing', CLOSE_DURATION_MS);
        },

        update(deltaMs: number) {
            if (durationMs <= 0) return; // Open-ended: nothing to time
            elapsedMs += deltaMs;
            if (elapsedMs >= durationMs) advance();
        },
    };

    function beginPhase(next: ChestPhase, duration: number): void {
        phase = next;
        elapsedMs = 0;
        durationMs = duration;
    }

    function advance(): void {
        if (phase === 'opening') beginPhase('open', 0);
        else if (phase === 'closing') beginPhase('closed', 0);
    }
}
```

The key difference from the banner example is that `open` and `closed`
have a duration of 0. The model never auto-advances out of them. An
external trigger, `close()` or `open()`, is needed to move on.

### Why progress stays at 1

`open` is where `opening` ends, and `closed` is where `closing` ends. So
`progress` stays where the timed phase left it. There is nothing left to
wait for, so the phase counts as complete. That has two benefits:

- **Nothing jumps.** A view that reads `progress` sees 1 at the end of
  `opening` and still 1 in `open`. Had it dropped to 0, a view that forgot
  to check the phase would snap the chest shut for a frame.
- **It matches what animation libraries do.** A tween of zero length is
  finished as soon as it starts.

### Why not expose a clock from the model?

You might be tempted to have the model count how long it has been `open`,
and expose that as `elapsedMs`, so that a view can animate while the
chest waits. It's worth asking what that number would do in the model.
None of the chest's phase changes or actions depend on it. The chest
moves on at the same moments, and `open()` and `close()` do the same
things, whatever the number says. If you deleted every view, the chest
would open and close exactly as before. That's the test from
[Presentation State](../adding-visual-polish/presentation-state.md#when-is-presentation-state-really-domain-state).
State that changes no outcome is presentation state, and
[the view rules](../../architecture/rules.md#view-rules) give it to the
view that needs it.

The model still times `opening` and `closing`, because those durations
decide when it moves on. It keeps that time to itself, and exposes
`progress`.

Moving the clock into the view costs you nothing. A view's timer advances
through `update(deltaMs)`, driven by the same ticker as the model, so you
keep everything the model's clock offered:

- **It's deterministic.** The same ticks give the same frames, in a test
  or a replay.
- **It doesn't depend on the frame rate.** The timer counts milliseconds,
  not frames.
- **It follows the game's time.** When the game pauses, slows down or
  steps one frame at a time, the view's update step does too.
- **It can restart with the phase.** The view sees a phase begin on the
  same tick the model begins it, so it can reset its timer there.

You also gain something. The view decides when its loop starts and stops,
as the next section shows.

## Cyclic Animations in Open-Ended Phases

Open-ended phases often pair with cyclic animations. A popup that stays open
might show a pulsing glow, a rotating icon, or a bobbing arrow. These
animations loop until the phase changes.

The loop is cosmetic, so the view keeps its own timer, advanced in its
update step. Here the popup bobs while it is open, and keeps bobbing as it
closes, so the bob doesn't jump back to the middle:

```ts
// -- Presentation state --
let bobMs = 0; // How long the popup has been bobbing

function update(deltaMs: number) {
    const phase = bindings.phase();
    if (phase === 'open' || phase === 'closing') bobMs += deltaMs;
    else bobMs = 0;
}

function refresh() {
    const phase = bindings.phase();
    const progress = bindings.progress();
    // Gentle bobbing cycle: 2 seconds per full bob
    const bob = Math.sin(bobMs / 2000 * Math.PI * 2) * 4;

    if (phase === 'closed') {
        popup.visible = false;
    }
    else if (phase === 'opening') {
        popup.visible = true;
        popup.alpha = progress;
        popup.scale.set(0.5 + 0.5 * progress);
        popup.position.y = BASE_Y;
    }
    else if (phase === 'open') {
        popup.visible = true;
        popup.alpha = 1;
        popup.scale.set(1);
        popup.position.y = BASE_Y + bob;
        // Pulsing glow: 3 seconds per full pulse
        glow.alpha = 0.3 + 0.2 * Math.sin(bobMs / 3000 * Math.PI * 2);
    }
    else if (phase === 'closing') {
        popup.visible = true;
        popup.alpha = 1 - progress;
        popup.scale.set(1 - 0.5 * progress);
        popup.position.y = BASE_Y + bob;
    }
}
```

The bob and the pulse are functions of `bobMs`, and `refresh()` stores
nothing.

The view also decides when its loop starts and stops. A clock kept by the
model would restart at 0 when `closing` began, and the popup would jump
back to the middle of its bob. Here, `bobMs` carries on through `closing`,
because that's how this view wants it to look.

`bobMs` starts at 0 when the view is made, so the view's first refresh is
correct even before its first update. See
[Start valid](../adding-visual-polish/presentation-state.md#start-valid-the-first-refresh-may-come-before-the-first-update).

### One timer for every cycle

You don't need a timer for each cycle, or a timer that wraps round at the
end of its period. One timer drives cycles of any period. Take the
remainder when you need a repeating 0..1 value:

```ts
const cycleT = (bobMs % 2000) / 2000; // 0..1, repeating every 2 seconds
```

### When the model already keeps a clock

Sometimes the model times part of a phase for its own reasons. A ship that
can't be hit for three seconds after it respawns keeps an invulnerability
timer, because collisions read it. A view may read that timer to flicker
the ship. The model isn't keeping time for the view there. The view is
only reading time the game needs anyway.

The test is the same as for any presentation state. If none of the model's
phase changes or actions depend on the clock, the view keeps it.

Each view's timer starts when that view sees the phase begin. Views that
exist when the phase begins see it on the same tick, so their loops stay in
step. A view made later in the phase starts its loop from 0. If that
matters, a parent view can keep one timer and pass it to its children as a
binding.

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

## When a Transition Decides When Play Starts

Picture a curtain that closes over the screen while the next level loads.
The level mustn't start while the curtain is still closed, or the player
would miss its first seconds. And the curtain mustn't open before the
level has loaded, or it would show an empty screen.

It's tempting to make the two wait on each other. The curtain, a view
model, holds closed until the model says it's ready. As it finishes
opening, it tells the model to start, through a binding such as
`onOpened: model.startLevel`. Avoid that design:

- **The model depends on its presentation.** It can't move on until a
  view calls it, so a test or a headless run has to stand in for the
  view.
- **The view gives the model orders.** A relay binding reports what the
  player did, and the model decides what that means. `onOpened` reports
  something the view did, so that the model will act on it.

The clue is that the curtain decides when play starts. Its timing changes
what happens in the game, so it's domain timing, like a "Get ready!" pause
before a level. So the model owns it, and the view follows, as it would
any [phase-based transition](phase-based-transitions.md). Here the
model's phases are an open-ended one and a timed one:

```ts
type LevelPhase = 'loading' | 'opening' | 'playing';
```

- **`'loading'` is open-ended.** It ends once the level has loaded, and
  `CLOSE_MS` has passed since it began. The wait for the time means a fast
  load can't cut the curtain's closing short. `progress` runs from 0 to 1
  over `CLOSE_MS`, then stays at 1 for as long as the load takes.
- **`'opening'` is timed.** It lasts `OPEN_MS`, and `progress` runs from
  0 to 1. The level is in place, but held still.
- **`'playing'`** begins when the curtain is fully open.

The model's update step moves between them, with nothing from the view:

```ts
update(deltaMs) {
    elapsedMs += deltaMs;
    if (phase === 'loading' && isLoaded && elapsedMs >= CLOSE_MS) {
        beginPhase('opening', OPEN_MS);
    }
    else if (phase === 'opening' && elapsedMs >= OPEN_MS) {
        beginPhase('playing', 0);
    }
    if (phase === 'playing') level.update(deltaMs);
},
```

Here the model does keep a clock in an open-ended phase, because a phase
change depends on it: `'loading'` can't end before `CLOSE_MS`. It still exposes
only `phase` and `progress`. The curtain's view draws from those. In
`'loading'`, it closes with `progress`, then stays closed with a cyclic
shimmer, as [above](#cyclic-animations-in-open-ended-phases), timed by the
view, for as long as the load takes. In `'opening'`, it opens with
`progress`.

A few things follow from that:

- **The durations are shared.** `CLOSE_MS` and `OPEN_MS` are the model's
  constants, and the view fits its animation to them. A player who asked
  for [less motion](../adding-visual-polish/reduced-motion.md) gets a fade
  over the same durations, so the game plays the same for them.
- **The view may still wait on presentation.** If the level's first frame
  isn't drawn yet as the curtain starts to open, the view can keep the
  opening dark for a frame. That's the view waiting on its renderer, which
  is fine. The model's clock doesn't wait for it.
- **Tests need no views.** A test loads the level, calls `advanceTime` past
  `CLOSE_MS` and `OPEN_MS`, and checks that the level is playing. A headless
  run, for a thumbnail or a benchmark, plays the same way.

Compare that with [When the View Owns the Open-Ended
Phase](#when-the-view-owns-the-open-ended-phase), where the popup is purely
cosmetic. The rule of thumb is this. If a transition changes when something
happens in the game, the model owns its timing. If it only changes how
things look, the view does.

## Combining Fixed and Open-Ended Phases

Most real components mix both kinds. The chest model above has two fixed
phases (`opening`, `closing`) and two open-ended phases (`open`, `closed`).
The pattern handles this naturally:

- Fixed phases: `durationMs > 0`, auto-advance when elapsed time reaches
  the duration, `progress` runs from 0 to 1.
- Open-ended phases: `durationMs` is 0, no auto-advance, wait for an
  external trigger, `progress` stays at 1.

No special handling is needed. The same `update()` method works for both.

## Summary

- For phases with **fixed durations**, use `progress` (0..1) as before.
- In a phase with **no fixed duration**, the model waits for a trigger.
  `progress` stays at 1, where the timed phase before it left off.
- The model keeps a clock only when its phase changes or actions depend
  on it. It doesn't count time just so that a view can animate.
- **Cyclic animations** are presentation state. The view keeps a timer,
  advances it in its update step, and derives each cycle from it
  (`Math.sin(bobMs / period * Math.PI * 2)`). One timer serves every cycle.
- A view may read a clock the model keeps for its own reasons, such as an
  invulnerability timer.
- When a transition decides **when play starts**, the model owns its
  timing, with an open-ended phase and a timed one, and the view follows.
  The view never tells the model to move on.

---

**Next:** [Complex Sequences](complex-sequences.md) - orchestrating
multiple overlapping effects with precise timing.
