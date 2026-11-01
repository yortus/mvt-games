# Time and Phases

> Time reaches a model only as `deltaMs`, so everything a model does over
> time is built from that one number. An `update()` that advances its
> clocks first and then decides what comes next stays short as the model
> grows. A change that takes time is best described by one `phase` and
> one `progress`, which every view reads the same way. And the size of
> each step depends on the device, so a model must produce the same
> results at any step size up to the ticker's cap.

**Related:** [Models](04-models.md) · [The Tick](05-the-tick.md) ·
[Presentation State](11-presentation-state.md) ·
[Testing Models](15-testing-models.md) ·
[Timelines with GSAP](../appendices/e-timelines-with-gsap.md)

Here's an enemy that waits for the player, winds up, attacks, and then
cools down before it can attack again. Each phase has its own timer:

```ts
update(deltaMs) {
    if (state === 'idle') {
        if (isPlayerNear()) {
            state = 'windup';
            windupTimer = WINDUP_MS;
        }
    }
    else if (state === 'windup') {
        windupTimer -= deltaMs;
        if (windupTimer <= 0) {
            state = 'attack';
            attackTimer = ATTACK_MS;
        }
    }
    else if (state === 'attack') {
        attackTimer -= deltaMs;
        if (attackTimer <= 0) {
            state = 'cooldown';
            cooldownTimer = COOLDOWN_MS;
        }
    }
    // ...and another branch, and another timer, for every new phase
}
```

It works, but it grows badly. Every new phase adds a branch and a timer
to `update()`. The order of the phases is spread across the branches, so
you can't read it in one place. A view that shows how far the wind-up has
got must read `windupTimer`, and must also use `WINDUP_MS`, the value it
counts down from. And the timers of phases that have ended keep their old
values, so a view, or a later change to the code, can still read the
wrong one.

This chapter tidies it up with two ideas: an `update()` that advances
first and decides second, and one `phase` with one `progress` in place of
a timer for each phase.

## Advance, Then Orchestrate

Give `update()` two steps, always in the same order:

1. **Advance.** Move every clock and every child model forward by
   `deltaMs`, whatever state the model is in.
2. **Orchestrate.** Look at the state that results, and start whatever
   should come next.

Here's the enemy again, with one clock, `elapsedMs`, for whichever phase
is running:

```ts
update(deltaMs) {
    // 1. Advance
    elapsedMs += deltaMs;

    // 2. Orchestrate
    if (durationMs > 0 && elapsedMs >= durationMs) nextPhase();
    if (phase === 'idle' && isPlayerNear()) beginPhase('windup', WINDUP_MS);
},
```

`beginPhase` starts a phase and its clock. `nextPhase` holds the order of
the phases, in one place, and moves from each timed phase to the next.
The banner in the next section shows both in full.

This shape keeps `update()` short and flat, and it does the same thing
every frame. The sequence lives in one function you can read from top to
bottom, and a new phase is one more line in it. A state machine was never
the problem with the first version. Timers scattered through its branches
were.

The same two steps work for a parent model. It advances its children
first, then checks what they did to each other, as
[Chapter 4](04-models.md) showed.

## Phases and Progress

A banner slides in, stays for a while, then slides out. A door opens,
stays open, then closes. A power-up charges, holds at full power, then
fades. Each one moves through a fixed set of phases, and is in exactly
one of them at a time. During the phases where something changes, you
also need to know how far through the change it is.

### Start with a boolean

The simplest version is a boolean, such as a door's `isOpen`, which flips
between two states. If the game's rules don't depend on how long the door
takes to open, the boolean is all the model needs. The view can fade
between open and closed in its own time, as presentation state, which
[Chapter 11](11-presentation-state.md) covers.

But sometimes the rules do depend on it. A door that blocks the player
until it's fully open must track whether it's opening or open. Then the
model owns the transition, and it needs two values:

- **`phase`**, a string-literal union that says which phase is running.
- **`progress`**, a number from 0 to 1 that says how far through that
  phase the model is.

```ts
type BannerPhase = 'opening' | 'open' | 'closing' | 'closed';

export interface BannerModel {
    readonly phase: BannerPhase;
    /** How far through the phase, from 0 to 1. */
    readonly progress: number;
    readonly show: () => void;
    readonly update: (deltaMs: number) => void;
}
```

The phase says what is happening, and the progress says how far along it
is. Together, they describe the whole transition.

### Why a single progress value?

You might be tempted to give each phase that moves its own progress:

```ts
// Avoid this
export interface BannerModel {
    readonly openingProgress: number; // 0..1 while opening, else 0
    readonly closingProgress: number; // 0..1 while closing, else 0
    // ...
}
```

That causes three problems:

- **It's ambiguous.** When both values are 0, is the banner closed or
  open? You need more state to tell.
- **It has rules to keep.** Only one of the values may be above 0 at a
  time. The types don't say so, so a bug that breaks the rule is
  easy to write and hard to spot.
- **It grows.** Each new phase adds another property, and another rule.

One `phase` and one `progress` avoid all three. The phase is always
stated, the progress always refers to it, and the two values can't fall
out of step. Shaping state so that a combination that doesn't make sense
can't be written is a principle called
[Make Illegal States Unrepresentable](32-make-illegal-states-unrepresentable.md).

### The banner model

```ts
/** How long the banner takes to slide in, in ms. */
const OPEN_MS = 300;
/** How long the banner stays, once it's in, in ms. */
const SHOW_MS = 2000;
/** How long the banner takes to slide out, in ms. */
const CLOSE_MS = 200;

export function createBannerModel(): BannerModel {
    let phase: BannerPhase = 'closed';
    let elapsedMs = 0;
    let durationMs = 0;

    return {
        get phase() { return phase; },
        get progress() {
            if (durationMs <= 0) return 1;
            return Math.min(1, elapsedMs / durationMs);
        },

        show() {
            if (phase === 'closed') beginPhase('opening', OPEN_MS);
        },

        update(deltaMs) {
            if (phase === 'closed') return;
            elapsedMs += deltaMs;
            if (elapsedMs >= durationMs) nextPhase();
        },
    };

    function beginPhase(next: BannerPhase, ms: number): void {
        phase = next;
        elapsedMs = 0;
        durationMs = ms;
    }

    function nextPhase(): void {
        if (phase === 'opening') beginPhase('open', SHOW_MS);
        else if (phase === 'open') beginPhase('closing', CLOSE_MS);
        else if (phase === 'closing') beginPhase('closed', 0);
    }
}
```

The progress is worked out from `elapsedMs` and `durationMs` each time
it's read, so it can't fall out of step with them. In `closed`, which
doesn't have a duration, it stays at 1, where `closing` left it, for the
reasons in [§](#why-progress-stays-at-1). `nextPhase()`
is the state machine: each timed phase names the phase that follows it,
in one place.

### Reading the phase and progress from a view

A view reads `phase` and `progress`, and turns them into what it shows:

```ts
function refresh(): void {
    const phase = bindings.phase();
    const progress = bindings.progress();

    banner.visible = phase !== 'closed';
    if (phase === 'opening') {
        banner.alpha = progress;
        banner.x = lerp(OFF_SCREEN_X, CENTRE_X, progress);
    }
    else if (phase === 'open') {
        banner.alpha = 1;
        banner.x = CENTRE_X;
    }
    else if (phase === 'closing') {
        banner.alpha = 1 - progress;
        banner.x = lerp(CENTRE_X, OFF_SCREEN_X, progress);
    }
}
```

`lerp(a, b, t)` blends from `a` to `b` as `t` goes from 0 to 1. The view
doesn't need a timer of its own.

[§](#try-banner-phases) runs the banner, with a readout below it that
shows only the values that the model exposes to its views. Watch the
progress run from 0 to 1 through each timed phase, and start again as the
next phase begins. Press Step during `opening`, which pauses it, then keep
pressing Step to move it on a frame at a time. Press `show()` to see it
again once it's closed.

<TryIt example="banner-phases" file="views/banner-view.ts" />

### Who owns the phases?

The banner keeps its phases in the model, but the phases don't always
belong there. That choice depends on whether the game's rules use them.

| Situation | Where the phases live |
| --- | --- |
| The game's rules depend on the phase, such as a door that blocks the player while it opens | The model |
| Other models depend on the timing, such as a chain of matches that waits for pieces to fall | The model |
| Several views must agree on the same progress | The model |
| The transition only decorates, such as a score popup sliding in | The view |

The rule of thumb is this. If a transition changes when something happens
in the game, the model owns its timing. If it only changes how things
look, the view does. When the phases live in a view, they're presentation
state, and they follow the same pattern there.
[Chapter 11](11-presentation-state.md) shows how.

Kwazy Cactii, the Arcade's match-three game, models its board with five
phases, such as `'swapping'`, `'matching'` and `'settling'`, where
settling can lead back to matching when new matches form. It exposes a
separate progress for each phase that moves, though, the shape that
[§](#why-a-single-progress-value) advises against, and a single
`progress` would serve it as well.

## Open-Ended Phases

Some phases don't have an end time. A popup stays open until the player
taps "OK". A treasure chest, once opened, stays open until something
closes it. A phase like this is an **open-ended phase**: it waits for
something to happen, rather than ending after a set time. It doesn't have
a duration, so its progress doesn't measure anything, and the model
doesn't time it.

```ts
/** How long the lid takes to open, in ms. */
const OPEN_MS = 400;
/** How long the lid takes to close, in ms. */
const CLOSE_MS = 300;

type ChestPhase = 'opening' | 'open' | 'closing' | 'closed';

export interface ChestModel {
    readonly phase: ChestPhase;
    /** How far through opening or closing, 0..1. 1 when open or closed. */
    readonly progress: number;
    readonly open: () => void;
    readonly close: () => void;
    readonly update: (deltaMs: number) => void;
}

export function createChestModel(): ChestModel {
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
            if (phase === 'closed') beginPhase('opening', OPEN_MS);
        },

        close() {
            if (phase === 'open') beginPhase('closing', CLOSE_MS);
        },

        update(deltaMs) {
            if (durationMs <= 0) return; // open-ended: the phase isn't timed
            elapsedMs += deltaMs;
            if (elapsedMs >= durationMs) nextPhase();
        },
    };

    function beginPhase(next: ChestPhase, ms: number): void {
        phase = next;
        elapsedMs = 0;
        durationMs = ms;
    }

    function nextPhase(): void {
        if (phase === 'opening') beginPhase('open', 0);
        else if (phase === 'closing') beginPhase('closed', 0);
    }
}
```

The difference from the banner is that `open` and `closed` have a
duration of 0. The model moves out of them only when `close()` or
`open()` is called. So the same `update()` handles both
kinds of phase:

- **A timed phase** has a duration above 0. Its `progress` runs from 0 to
  1, and the model moves on when its time is up.
- **An open-ended phase** has a duration of 0. Its `progress` stays at 1,
  and the model moves on only when an action is called.

Try the chest in [§](#try-chest-that-waits). Press `open()` and
`close()`, and watch the progress. It runs from 0 to 1 while the lid
moves, and stays at 1 while the chest is open or closed. Press `open()`
while the chest is closing, and the chest keeps closing, because the
model opens only a closed chest.

<TryIt example="chest-that-waits" file="models/chest-model.ts" />

### Why progress stays at 1

`open` is where `opening` ends, and `closed` is where `closing` ends. So
`progress` stays where the timed phase left it, and a view's output
doesn't jump. A view that reads `progress` sees 1 at the end of
`opening`, and still 1 in `open`. If it dropped to 0, a view that doesn't
check the phase would snap the chest shut for a frame. Animation
libraries work the same way: a tween with a length of 0 is finished as
soon as it starts.

### Why the model doesn't expose a clock

You might be tempted to have the model count how long the chest has been
open, and expose that as `elapsedMs`, so that a view can animate while the
chest waits. Then ask what that number would do in the model. The
chest's phase changes and actions don't depend on it. The chest moves on
at the same moments, and `open()` and `close()` do the same things,
whatever its value. That's the delete-the-view test, which
[Chapter 11](11-presentation-state.md#when-is-presentation-state-really-domain-state)
teaches in full: delete every view, and the chest opens and closes exactly
as before. State that doesn't change any outcome is presentation state,
and it belongs to the view that uses it.

The model still times `opening` and `closing`, because those durations
decide when it moves on. It keeps that time private, and exposes
`progress`. A model exposes a phase's time only when that time is domain
state, such as a phase that can't end before a minimum time, and doesn't
have a `progress` to expose, because it also waits for something else.

Anything that moves while an open-ended phase waits, such as a bobbing
arrow or a pulsing glow, is presentation state, so the view keeps its own
timer for it. [Chapter 11](11-presentation-state.md) shows how.

## When a Transition Decides When Play Starts

Picture a curtain that closes over the screen while the next level loads.
The level mustn't start while the curtain is still closed, or the player
would miss its first seconds. And the curtain mustn't open before the
level has loaded, or it would show an empty screen.

It's tempting to let the view time the curtain, and call the model to
start the level as the curtain finishes opening, through a binding such
as
`onOpened: model.startLevel`. Avoid that design. The model can't move on
until a view calls it, so a test has to stand in for the view. And the
binding reports something the view did, not something the player did.

The clue is that the curtain decides when play starts. Its timing changes
what happens in the game, so by the rule of thumb above, the model owns
it, and the view follows:

```ts
type LevelPhase = 'loading' | 'opening' | 'playing';

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

`'loading'` is open-ended: it waits for the level to load, but it also
can't end before `CLOSE_MS`, so a fast load can't cut the curtain's
closing short. This is why the model keeps a clock during it. It still
exposes only `phase` and `progress`, and the curtain's view draws from
those. The durations are the model's constants, and the view fits its
animation to them, so a player who asks for less motion, which
[Chapter 22](22-reduced-motion.md) covers later, gets a fade over the
same durations. A test loads the level, steps time past `CLOSE_MS` and
`OPEN_MS`, and checks that the level is playing, without any view.

## Steps of Different Sizes

You don't choose how big each step is. As
[Chapter 5](05-the-tick.md#the-delta-cap) showed, it's however long the
last frame took, from about 7 ms on a fast screen to the ticker's cap,
typically 100 ms. So a model must produce the same results at any step
size from 0 up to that cap. `update(deltaMs)` guarantees it, so the code
that calls `update` depends only on the cap, never on how the model is
written.

The banner breaks that guarantee, in a small way. When `opening` ends
partway through a step, `update` calls `nextPhase()`, which starts `open`
with `elapsedMs` back at 0. The rest of that step, the time after
`opening` ended, is lost. So each phase runs a little long, by up to a
whole step. That's a tiny delay at 144 Hz, a longer one on a phone at 30 Hz,
and up to a tenth of a second at every phase change when steps reach the
cap. The banner stays up longer on a slow phone than on a fast monitor.

The fix is to carry the time that's left into the next phase:

```ts
update(deltaMs) {
    if (phase === 'closed') return;
    elapsedMs += deltaMs;
    while (durationMs > 0 && elapsedMs >= durationMs) {
        const leftOverMs = elapsedMs - durationMs;
        nextPhase();
        elapsedMs = leftOverMs;
    }
},
```

It's a `while`, not an `if`, because one step can end more than one
phase, such as a flash shorter than a frame.

[§](#try-carry-over-cannon) shows the same mistake, and its fix, in a
cannon that fires a ball every 250 ms. The cannon on top starts its timer
again from 0 when it fires, as the banner does, so it drops the time left
over. The one below carries it over: it fires every shot that came due
during the step, and starts each ball as far along as it would have flown
since. Both cannons' models receive time in steps of the size you pick,
and the rings show where steps of 1 ms would put each ball.

The example starts with steps of 100 ms, as after a run of slow frames. The top
cannon fires every 300 ms instead of every 250, so its balls spread out
and stray from their rings. Pick 33 ms, then 16 ms and 7 ms: the smaller
the step, the less it strays, but it never quite keeps time. The bottom
cannon's balls sit in their rings at every step size.

<TryIt example="carry-over-cannon" file="models/carry-over-cannon-model.ts" />

Two other habits break the same guarantee, and have the same kind of fix:

1. **Checking a condition only at the end of each step,** such as whether
   a fast ball has passed a wall. A step can jump past the moment the
   check would have caught it. Check along the way, such as along the
   whole line the ball moved, or choose a cap small enough for your
   fastest object, as Chapter 5 explained.
2. **Doing something at a point in time,** such as firing on every beat.
   Do everything that came due during the step, as the bottom cannon
   fires every shot, rather than at most one.

To move a model further than the cap in one go, to fast-forward a game
or to test what happens after ten seconds, step it in pieces no bigger
than the cap. Then you never need to check whether a model could handle
a bigger step: its guarantee is enough.
[Chapter 15](15-testing-models.md#advancing-time) shows `advanceTime`, a
helper that does this in tests.

## Common Mistakes

### A progress for each phase

A view shows the wrong amount of a transition, or two progress values are
both 0 and the model doesn't say which phase is running. The model
exposes `openingProgress` and `closingProgress`, so it has to keep them
in step, and each view has to pick the right one. Expose one `phase` and
one `progress` instead, and work the progress out from the phase's clock.

### A clock kept only for a view

The model exposes how long a phase has lasted, but the model's own code
never reads it. A view animates during the phase, and the model was the
nearest place to keep time. Let the view keep that timer, as
presentation state ([Chapter 11](11-presentation-state.md)). Keep a clock
in the model only when a phase change or an action depends on it.

### A view that calls the model to move on

The game can't start a level, or finish a transition, without a view, and
tests need a stand-in view to call the model. The view times a transition
that the game depends on, then calls the model when it's done. If the
transition decides when something happens in the game, move its timing
into the model, as phases, and let the view follow.

## Summary

Time reaches a model only as `deltaMs`. Keep `update()` in two steps:
advance every clock and child first, then decide what comes next, with
the order of the phases in one function. Model a change that takes time
with one `phase`, a string-literal union, and one `progress` from 0 to 1,
worked out from the phase's clock. An open-ended phase doesn't have a
duration: the model moves on only when an action is called, and
`progress` stays at 1, where the timed phase before it left off. The
model keeps a clock only when its own phase changes or actions depend on
it. The view times anything that moves just for show while an open-ended
phase waits. When a transition decides when play starts, the model owns
its timing, and the view follows. A model must produce the same results
at any step size up to the ticker's cap, so when a timer or phase ends
partway through a step, carry the time left over into what comes next. To
move a model further, step it in pieces no bigger than the cap.
