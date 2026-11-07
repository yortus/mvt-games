# Growing a Complex View

> A polished game's views keep a lot of presentation state: fades, flashes,
> shakes, popups and particles, some of them timed against each other. Left
> in one view, they tangle into code that's hard to change safely. This
> chapter
> gives you a ladder of five ways to keep them in order, from the lightest
> to the heaviest: keep the state inline, split the view, reach for a
> helper, share a sequence, and last, extract a view model. Go only as far
> down the ladder as the view needs.

**Related:** [Presentation State](11-presentation-state.md) ·
[Composing Views](13-composing-views.md) ·
[Noticing Changes](09-noticing-changes.md) ·
[Time and Phases](06-time-and-phases.md) ·
[Testing Views](16-testing-views.md)

Here is a player's HUD a few weeks into a project. It started as a score.
Then the score was made to count up smoothly, the panel to flash red when
the player is hurt, and a status icon to bounce when the player picks up
a power-up:

```ts
function PlayerHudView(bindings: PlayerHudViewBindings): Container {
    // ... display objects ...

    let displayedScore = bindings.score(); // the score counting up
    let flashMs = FLASH_MS;                // the red flash
    let wasHurt = bindings.isHurt();       // to notice the hurt starting
    let bounceMs = BOUNCE_MS;              // the icon's bounce
    let wasBuffed = bindings.isBuffed();   // to notice the power-up

    function update(deltaMs: number) {
        // count the score up, run the flash, run the bounce,
        // all interleaved in one function
    }

    function refresh() {
        // reads all five variables and the bindings, so it's hard
        // to tell which state drives which display object
    }

    setUpdate(view, update);
    setRefresh(view, refresh);
    return view;
}
```

Each effect was a small, sensible change. Together they make a view where
every edit risks the other two effects, and the only way to test any of
them is to look at the screen. You need the presentation state, since it
makes a game feel polished. But you can arrange it
so that each piece is small enough to understand on its own.

## A Ladder of Five

Each of these steps adds a little structure, and takes a little more code
to write. Start at the top, and step down only when the one you're on stops
being enough:

1. **Keep a single effect inline.** One timer or one tween can live in the
   view.
2. **Split into sub-views.** Each independent effect gets a view of its
   own.
3. **Reach for a helper.** A small tested helper replaces hand-written
   timers for patterns that recur.
4. **Share a sequence.** Effects that overlap on one timeline share one
   clock.
5. **Extract a view model.** Rules that coordinate the effects move to a
   plain object you can test without a renderer.

## Keep a Single Effect Inline

Most presentation state is one value, such as a fade's progress or a
smoothed number. The sliding door in [Chapter 11](11-presentation-state.md)
keeps one number, moves it in `update`, and writes it in `refresh`, in
about a dozen lines. A helper or a separate object would add more code
than it saves. So keep a single effect inline, in the view that shows it.
The HUD above went wrong when it reached three effects, not one.

## Split Into Sub-Views

The HUD's three effects don't depend on each other. The score counts up
whether or not the panel flashes, and the icon bounces whatever the score
does. Effects like that are easiest to manage in three views:

```ts
function PlayerHudView(bindings: PlayerHudViewBindings): Container {
    const view = new Container();
    view.addChild(
        SmoothScoreView({ score: bindings.score }),
        HurtFlashView({ isHurt: bindings.isHurt }),
        StatusIconView({ isBuffed: bindings.isBuffed }),
    );
    return view;
}
```

Each sub-view keeps one piece of presentation state, notices one change and
writes one display object, in an `update` and a `refresh` of its own. You
can read each in a minute, and test each with a binding or two. The parent
only builds them. It doesn't call their steps, since the ticker calls
every view's steps wherever the view is in the tree, as
[Chapter 5](05-the-tick.md) explains.

This is the step you'll use most. Most effects in a game are independent
in this way, and splitting them is ordinary
[view composition](13-composing-views.md).

## Reach for a Helper

Some effects turn up again and again: fading something in and out as a
flag changes, flashing once as something starts, repeating while something
lasts. Writing the timers by hand each time is where small bugs creep in,
such as a fade that jumps when it reverses half way. A small helper, tested
once, does it the same way everywhere. Each helper here is presentation
state: you advance it in the view's `update`, and read its value in
`refresh`.

::: info In this book
`createBooleanTween`, `createEdgeTween` and `createMetronome` come from
`@mvtjs/utils`. Each returns a plain object with an `update(deltaMs)`
method.
:::

### Tweening a boolean

A model often holds a flag, such as whether a door is open. The view needs
a number that moves smoothly between two values as the flag changes. A
boolean tween reads the flag and does that:

```ts
const doorAlpha = createBooleanTween({
    getSource: bindings.isDoorOpen,
    offValue: 1,         // closed: fully drawn
    onValue: 0,          // open: faded out
    onDurationMs: 300,
    offDurationMs: 200,
    onEasing: easeOutQuad,
});

setUpdate(view, doorAlpha.update);
setRefresh(view, () => {
    door.alpha = doorAlpha.value;
});
```

It starts at the value that matches the flag, so the first refresh is
right before any update has run. If the flag flips back half way through,
the tween turns round from where it is, rather than jumping.

### Playing once on a rising edge

Some effects play once as something starts, then return to rest, such as a
red flash as the player is hurt. An edge tween plays each time a flag turns
from `false` to `true`:

```ts
const hurtFlash = createEdgeTween({
    getSource: bindings.isHurt,
    triggerValue: 1,     // full flash as the hurt starts
    restValue: 0,        // invisible at rest
    durationMs: 150,
    easing: easeOutExpo,
});

setUpdate(view, hurtFlash.update);
setRefresh(view, () => {
    overlay.alpha = hurtFlash.value;
});
```

If the player is hurt again before the flash ends, it starts again from
the top.

### Repeating beats

Some effects repeat for as long as something lasts, such as a warning light
that blinks faster as the fuel runs out. A
**[metronome](../appendices/b-glossary.md)** keeps the beat for effects
like this. It counts beats at a tempo you can change, and doesn't do
anything else.

The view sets the metronome's `periodMs`, the time between beats, in its
update step, then calls `update`. The metronome adds one to its `count`
on each beat:

```ts
const blink = createMetronome();

setUpdate(view, (deltaMs) => {
    blink.periodMs = bindings.isFuelLow()
        ? computeBlinkPeriodMs(bindings.fuel())
        : 0;
    blink.update(deltaMs);
});
setRefresh(view, () => {
    warning.visible = blink.periodMs > 0 && blink.count % 2 === 1;
});
```

A few details make it easy to use:

- **The first beat comes at once,** on the first update with a period
  above 0, not a period later. So the first time the fuel runs low, the
  light comes on straight away. (The light shows on odd counts, so if the
  metronome stopped on an odd count, it starts again dark.)
- **The period can change on any tick,** so the blinking can quicken as
  the fuel runs out.
- **A period of 0 stops it,** as it starts, and so does a negative
  period. The next positive period starts it again, with a beat at once.
- **It moves only when you call `update`.** `updateView` skips a paused
  game's views, so the metronome stops with the game, and carries on
  from the same place when the game resumes.

The light reads the count directly. To do something once on each beat
instead, such as an engine puffing smoke, call a reaction in `refresh`
that acts each time the count rises, as
[Chapter 9](09-noticing-changes.md) shows for any count. Chapter 20 does
this for a heartbeat that plays a sound on each beat.

### Easing functions

An easing function turns steady progress, from 0 to 1, into curved
progress. An easing function makes a fade start fast and settle slowly,
or a popup overshoot and spring back. Each is a pure function that doesn't
keep any state, so it's the easiest kind of code to test and share:

```ts
function easeOutQuad(t: number): number {
    return t * (2 - t);
}

function easeOutExpo(t: number): number {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}
```

Every helper above takes one, and so can any progress value you compute
yourself.

### Benefits of helpers

With helpers, a view's `update` becomes a list of `helper.update(deltaMs)`
calls, and its `refresh` reads each helper's value. Each helper is tested
once, with known times and without a renderer, and a bug fixed in one is
fixed in every view that uses it.

[§](#try-player-hud) is the HUD from the start of the chapter, split into
three sub-views. The score counts up inline, the flash uses an edge tween,
and the icon a boolean tween. Press the buttons in any order. Each effect
keeps its own state, so the effects never disturb each other. A hurt
player can't be hit again until the hurt wears off, and a power-up can't
start while one is working, so those buttons are greyed out until their
moment ends.

<TryIt example="player-hud" file="views/player-hud-view.ts" />

## Share a Sequence

Some effects don't fit one progress value. When tiles match in a match-3
game, five things happen at once, each starting at its own moment:

```
Time (ms):  0       200     400     600     800     1000
            |       |       |       |       |       |
flash:      [===]
shake:        [===============]
dust:             [===================]
popup:              [=======================]
stars:                [===============================]
```

The flash starts at once and is gone in 100 ms. The shake starts at 50 ms,
while the flash is still going. The popup starts while the dust and the
shake are running, and the stars start last and finish last.

A phase and a progress, as in [Chapter 6](06-time-and-phases.md), can't
describe this. The board isn't in one phase, because five things are
under way at once. Five separate timers, one in each sub-view, could
describe it, but they'd drift apart as soon as one started a frame late,
and the code wouldn't show that they belong together.

### Defining a sequence

A **sequence** is a list of named steps, each with a start time and a
duration, all on one clock. You define the steps as data:

```ts
const MATCH_STEPS = [
    { name: 'flash', startMs: 0, durationMs: 100 },
    { name: 'shake', startMs: 50, durationMs: 400 },
    { name: 'dust', startMs: 150, durationMs: 500 },
    { name: 'popup', startMs: 200, durationMs: 600 },
    { name: 'stars', startMs: 250, durationMs: 800 },
] as const;

const matchSequence = createSequence(MATCH_STEPS);
```

The steps define when each effect runs, but not how it looks. That stays
in the views. The sequence works out its total length, here 1050 ms, and
doesn't allocate anything as it moves on.

`start()` sets the sequence going from 0 ms, and `update(deltaMs)` moves it
on. While it runs, `isActive` is `true` and `progress` goes from 0 to 1.
Each step has an `isActive` and a `progress` of its own. A step's progress
is 0 before it starts, rises to 1 while it runs, and stays at 1 after.

::: info In this book
`createSequence` and `createSequenceTracker`, which comes next, are from
`@mvtjs/utils`. They break the convention this book teaches, of one
options object for a factory: both take positional arguments. A sequence
takes its steps, and a tracker takes a sequence and an object of functions
for each step. With `as const`, a sequence's type includes each step's
name,
so `matchSequence.steps.flash` is checked, and a misspelt step is an
error.
:::

### Reading a step's progress

Each step's progress drives one effect. A view reads it in `refresh`, as
it would any presentation state:

```ts
function refresh() {
    const { flash, shake } = matchSequence.steps;

    // A bright overlay that fades out
    overlay.visible = flash.isActive;
    overlay.alpha = 1 - flash.progress;

    // A shake that dies away over the step
    const strength = shake.isActive ? 10 * (1 - shake.progress) : 0;
    board.x = Math.sin(shake.progress * SHAKE_WAVES) * strength;
}
```

### Sharing one sequence across sub-views

Five effects in one view would bring back the tangled HUD. So split them
into sub-views, as before, and let them share the sequence. The parent
makes it, starts it and moves it on, and passes it to each child:

```ts
function BoardView(bindings: BoardViewBindings): Container {
    const matchSequence = createSequence(MATCH_STEPS);

    const view = new Container();
    view.addChild(
        FlashOverlayView({ matchSequence }),
        ShakeView({ matchSequence }),
        DustView({ matchSequence, cells: bindings.matchedCells }),
    );

    setUpdate(view, (deltaMs) => {
        // ... start the sequence when a match begins ...
        matchSequence.update(deltaMs);
    });
    return view;
}
```

Each child reads only the steps that it uses, and the children don't
reference each other. The children read this tick's sequence because the
ticker calls a view's update step before its children's, as it does for
anything that a parent shares, such as a view model. The sequence object
itself never changes, only its contents, so a child takes it as a fixed
value rather than a getter (see [Chapter 8](08-bindings.md)). A child can
declare only the steps it reads, so its bindings say exactly what it
depends on:

```ts
interface FlashOverlayViewBindings {
    /** The board's match sequence. The view reads it once. */
    readonly matchSequence: Sequence<'flash'>;
}
```

A `Sequence` with more steps fits this binding, since it has every member
the binding requires.

The view that makes the sequence is also the view that moves it on. Keep to
that for anything a parent shares with its children. The parent's update
step runs first, so every child reads this tick's value. If one child moved
the sequence on instead, the children that ran before it would read last
tick's value, and the children that ran after it would read this tick's.

### Tracking a sequence's steps

Some effects also need something done once, at a moment, such as placing
the dust as its step starts, or hiding it as it ends. A **sequence
tracker** does this. It keeps track of whether each step is before,
running or after, and calls the functions that you pass it as a step
changes phase:

```ts
const refreshEffects = createSequenceTracker(matchSequence, {
    dust: {
        entering: () => placeDustAt(bindings.matchedCells()),
        active: (progress) => {
            for (let i = 0; i < dust.length; i++) {
                dust[i].scale.set(progress * MAX_DUST_RADIUS);
                dust[i].alpha = 1 - progress;
            }
        },
        inactive: () => {
            for (let i = 0; i < dust.length; i++) dust[i].alpha = 0;
        },
    },
    popup: {
        entering: () => {
            label.text = String(bindings.points());
        },
        active: (progress) => {
            label.y = -RISE_PX * progress;
            label.alpha = 1 - progress * progress;
        },
        inactive: () => {
            label.alpha = 0;
        },
    },
});

setRefresh(view, refreshEffects);
```

The tracker calls each function at its moment:

- **`entering`** is called once, on the refresh where a step starts
  running. Use it for setup that should happen once, such as placing
  particles or setting text.
- **`active`** is called on every refresh while the step runs, with its
  progress, including the refresh where it starts.
- **`inactive`** is called once as the step comes to rest, including when
  a restart skips it back to its start, and once as the tracker is made.
  So every effect starts hidden, and the view is right on its first
  refresh. Use it to hide and reset things.

Each function is optional. The tracker reads the sequence each time you
call it. Apart from `active`, it calls a function only when a step has
changed phase, so a second call in the same frame doesn't repeat any
setup. Call it in
the refresh step, as the view's refresh or inside it.

### Starting a sequence with a reaction

A sequence usually starts when the model's state changes, such as the
board's phase becoming `'matching'`. A [reaction](09-noticing-changes.md)
notices that, in the view's update step, just before the sequence moves
on:

```ts
const startCelebrationWhenMatching = createReaction({
    watch: bindings.phase,
    when: 'matching',
    react: () => matchSequence.start(),
});

setUpdate(view, (deltaMs) => {
    startCelebrationWhenMatching();
    matchSequence.update(deltaMs);
});
```

Calling `start()` while the sequence runs starts it again from the top.

[§](#try-match-celebration) runs the whole celebration, with the steps
above shared by three sub-views of a board. Click a gem to make a match.
Then press Step, which pauses it, and Step through the next one a frame at
a time, to see each effect start at its own moment.

<TryIt example="match-celebration" file="views/board-view.ts" />

### Self-timed or model-driven sequences

Whether you need a sequence at all depends on what keeps the time.

Often the sequence is self-timed. The model exposes only that the board is
matching, not how a match looks. Then the sequence is the
view's [presentation state](11-presentation-state.md). The view starts it
on the change, and moves it on in its update step, as above. The model
doesn't reference the sequence, the child views don't reference each
other, and the parent view is the one place that holds the whole
picture.

Sometimes, though, the timing is model-driven. The model already keeps
the time, as a phase with a `progress` that goes from 0 to 1, because the
game's timing depends on it. Then the view should follow that progress,
so the effects slow down, speed up and pause with the model. A `Sequence`
keeps its own time, which only its `update` moves on, so it can't follow
the model, and you don't need one. Give each effect a window of the
model's progress instead, and work out how far through its window it is
in each refresh:

```ts
interface StepWindow {
    readonly start: number;
    readonly end: number;
}

// Each effect's window, as a part of the model's progress
const FLASH: StepWindow = { start: 0, end: 0.15 };
const SHRINK: StepWindow = { start: 0.1, end: 0.6 };
const FADE: StepWindow = { start: 0.4, end: 1 };

/** How far through a window, from 0 before it to 1 after it. */
function toWindowProgress(progress: number, span: StepWindow): number {
    const t = (progress - span.start) / (span.end - span.start);
    return t < 0 ? 0 : t > 1 ? 1 : t;
}

function refresh() {
    const progress = bindings.progress();

    const flash = toWindowProgress(progress, FLASH);
    overlay.visible = flash > 0 && flash < 1;
    overlay.alpha = 1 - flash;

    sprite.scale.set(1 - toWindowProgress(progress, SHRINK) * 0.8);
    sprite.alpha = 1 - toWindowProgress(progress, FADE);
}
```

This view doesn't keep any time of its own, so it doesn't have an update
step, and its effects can't drift from the model.

### Looping and restarting

For a repeating effect with distinct steps, such as a warning that
flashes, shows its text, then fades, start the sequence again when it
finishes:

```ts
setUpdate(view, (deltaMs) => {
    warningSequence.update(deltaMs);
    if (bindings.isWarning() && !warningSequence.isActive) {
        warningSequence.start();
    }
});
```

`start()` puts every step back before its start, so the tracker calls
each step's `inactive`, and the next pass begins cleanly. Watch for one
thing when a sequence restarts while it's still running. A step that
starts at 0 ms, and is running at the moment of the restart, never
stopped, so the tracker doesn't call its `entering` again. If an effect
needs its setup on every pass, give it a step that starts after 0 ms. For
a smooth cycle, such as bobbing, you don't need a sequence at all: a
timer and a `Math.sin` will do, as [Chapter 11](11-presentation-state.md)
shows.

### A real example: the match-3 celebration

Kwazy Cactii, the arcade's match-3 game, celebrates each match with one
shared sequence of twelve steps, a little over a second long. The board
view makes the sequence, starts it with a reaction as the board's phase
becomes `'matching'`, and moves it on in its update step. Six child views
each read their own steps, for the flash, the shake and zoom, the dust
and stars, the fireworks, a combo banner and the fading pieces, and most
of them use a sequence tracker. The model doesn't reference any of this.
It tracks
the phase, the matched cells and how many matches in a row the player has
made, and the whole celebration is presentation state. See
[`board-view.ts`](https://github.com/yortus/mvt-games/blob/main/packages/sites/arcade/src/entries/kwazy-cactii/views/board-view/board-view.ts)
and
[`match-sequence-defs.ts`](https://github.com/yortus/mvt-games/blob/main/packages/sites/arcade/src/entries/kwazy-cactii/views/board-view/match-sequence-defs.ts).

## Extract a View Model

A shared sequence is enough while the effects share only a timeline. Each
child reads its steps, and they aren't connected in any other way.
Sometimes the design requires more than that. Suppose it adds these
rules:

- Each match in a chain restarts the celebration, but the shake builds up
  from one match to the next, rather than starting again from the same
  strength.
- The combo banner appears from the third match in a chain, and stays
  until the chain ends, rather than sliding in and out with each restart.

Now the effects need state that outlives one pass of the sequence, and
rules that read it. You could write them into the parent view's update
step, but then the only way to test them is through display objects.

This is the time for a **[view model](../appendices/b-glossary.md)**: a
plain object that holds the presentation state and the rules that
coordinate it, with an `update(deltaMs)` and values that the view reads.
It doesn't hold display objects or import a renderer, so you can test it
on its own. The name comes from the ViewModel of Model-View-ViewModel
(MVVM), but MVT's is narrower. MVVM's ViewModel sits between the model and the view, and adapts
domain state for the view. An MVT view model is part of one view, which
makes and owns it, and holds only presentation state.

### When to extract a view model

Extract a view model when the effects follow rules that connect them, or
pieces of presentation state change each other, and you want to test
those rules without looking at the screen. View models should be rare.
Most views are well served by the first four steps. A view model is
worth it when the coordination itself is the hard part.

### Example: match effects with rules of their own

The view model keeps the sequence, and adds the two rules:

```ts
// match-effects-view-model.ts
export interface MatchEffectsViewModel {
    /** How far the board is shaken now, in pixels. */
    readonly shakePx: number;
    /** How far the score popup has risen and faded, from 0 to 1. */
    readonly popupProgress: number;
    /** True once this match's dust is due, until the next match. */
    readonly isDustDue: boolean;
    readonly isBannerShown: boolean;
    update: (deltaMs: number) => void;
}

export interface MatchEffectsViewModelOptions {
    /** Matches made in a row in this chain, and 0 between chains. */
    readonly cascadeStep: () => number;
}

export function createMatchEffectsViewModel(
    options: MatchEffectsViewModelOptions,
): MatchEffectsViewModel {
    const { cascadeStep } = options;
    const sequence = createSequence(MATCH_STEPS);
    let shakeStrengthPx = 0;
    let isBannerShown = false;

    const startCelebrationOnEachMatch = createReaction({
        watch: cascadeStep,
        when: increased,
        react: (step) => {
            sequence.start();
            shakeStrengthPx = Math.min(
                MAX_SHAKE_PX,
                shakeStrengthPx + SHAKE_PER_MATCH_PX,
            );
            if (step >= BANNER_FROM_CASCADE) isBannerShown = true;
        },
    });
    const endChainWhenCascadeResets = createReaction({
        watch: cascadeStep,
        when: 0,
        react: () => {
            shakeStrengthPx = 0;
            isBannerShown = false;
        },
    });

    return {
        get shakePx() {
            const { isActive, progress } = sequence.steps.shake;
            if (!isActive) return 0;
            const wave = Math.sin(progress * SHAKE_WAVES);
            return wave * shakeStrengthPx * (1 - progress);
        },
        get popupProgress() {
            return sequence.steps.popup.progress;
        },
        get isDustDue() {
            return sequence.steps.dust.progress > 0;
        },
        get isBannerShown() {
            return isBannerShown;
        },
        update: (deltaMs) => {
            startCelebrationOnEachMatch();
            endChainWhenCascadeResets();
            sequence.update(deltaMs);
        },
    };
}
```

The view makes the view model, sets its update as the view's update step,
and writes its values in `refresh`:

```ts
// board-view.ts
function BoardView(bindings: BoardViewBindings): Container {
    const matchEffects = createMatchEffectsViewModel({
        cascadeStep: bindings.cascadeStep,
    });
    // Places the dust once, as it falls due, not on every refresh
    const placeDustWhenDue = createReaction({
        watch: () => matchEffects.isDustDue,
        when: true,
        react: () => placeDustAt(bindings.matchedCells()),
    });

    const view = new Container();
    // ... the board, the popup, the dust and the banner ...

    setUpdate(view, matchEffects.update);
    setRefresh(view, refresh);
    return view;

    function refresh() {
        placeDustWhenDue();
        board.x = matchEffects.shakePx;
        popup.alpha = 1 - matchEffects.popupProgress;
        banner.visible = matchEffects.isBannerShown;
    }
}
```

Placing the dust is one-off setup, so a reaction does it as `isDustDue`
turns `true`, once per match, and `start()` turns it back to `false` for
the next one.

[§](#try-match-effects-view-model) puts the view model to work. Click gems
quickly, one after another. The shake grows with each match, and from the
third, the banner stays until you stop for a moment and the chain ends.

<TryIt example="match-effects-view-model" file="views/match-effects-view-model.ts" />

The real Kwazy Cactii keeps to the shared sequence for its celebration,
since its effects don't need rules like these. It does use a view model
for its pieces, which follow the player's drag, swap and settle into
place. That's logic enough to deserve tests of its own. See
[`pieces-view-model.ts`](https://github.com/yortus/mvt-games/blob/main/packages/sites/arcade/src/entries/kwazy-cactii/views/board-view/pieces-view-model.ts)
and its
[tests](https://github.com/yortus/mvt-games/blob/main/packages/sites/arcade/src/entries/kwazy-cactii/views/board-view/pieces-view-model.test.ts).

### Example: a press that turns into a hold

A puzzle's keypad fills in a digit when the player taps a key, and does
something else when the player holds the key down. The browser reports a
press and a release, but it doesn't report a hold, so the view has to notice
the hold itself. It has to time the hold in game time, so that a hold
doesn't finish while the game is paused. That means noticing it in an update
step. But an update step must never change a model, because other views are
still reading the model in the same tick.

A view model solves both problems. It times the press, and it reports the
hold after the frame:

```ts
export function createLongPressViewModel(
    options: LongPressViewModelOptions,
): LongPressViewModel {
    const { onTapped, onHeld } = options;
    let isDown = false;
    let isHoldDone = false;
    let heldMs = 0;

    return {
        press() {
            isDown = true;
            isHoldDone = false;
            heldMs = 0;
        },
        release() {
            const isTap = isDown && !isHoldDone;
            isDown = false;
            if (isTap) onTapped();
        },
        update(deltaMs) {
            if (!isDown || isHoldDone) return;
            heldMs += deltaMs;
            if (heldMs < HOLD_MS) return;
            isHoldDone = true;
            // Other views are still reading the model in this tick
            queueMicrotask(onHeld);
        },
        get holdProgress() {
            return isDown ? Math.min(1, heldMs / HOLD_MS) : 0;
        },
    };
}
```

`queueMicrotask` runs its function once the code that's running has
finished. A frame's code runs in one call from the browser, so `onHeld` runs
after the whole frame, at the point where a click would arrive. A release, which is an
ordinary event, calls `onTapped` straight away.

The view's own code stays small. It passes its pointer events to `press()`
and `release()`, ticks the view model with `setUpdate(view, gestures.update)`,
and draws a ring from `holdProgress`. It passes its own relay bindings to
the view model as options, so the view never calls a relay binding from a
step.

The timer looks like presentation state, but it isn't, because it affects the
game. It decides when the view reports the hold, just as the browser decides
when to report a click, so it's part of handling input. It stays in the view,
because what a control does is a view's concern. Where the timing is part
of the game logic, such as how fast a ship fires while the button is held,
it's domain state, and it goes in the model.

### Testing a view model

A view model is tested the way a model is: give it its inputs, call
`update` with known times, and check its values. You don't need a
renderer or display objects:

```ts
it('shows the banner from the third match in a chain', () => {
    let cascadeStep = 0;
    const effects = createMatchEffectsViewModel({
        cascadeStep: () => cascadeStep,
    });

    cascadeStep = BANNER_FROM_CASCADE - 1;
    effects.update(16);
    expect(effects.isBannerShown).toBe(false);

    cascadeStep = BANNER_FROM_CASCADE;
    effects.update(16);
    expect(effects.isBannerShown).toBe(true);
});
```

These tests pin down the rules, the part most likely to break. A
[visual test](17-visual-tests.md) checks how the effects look.

### Guidelines for view models

- **The rest of the game doesn't reference it.** If two sibling views
  need the same view model, their nearest common parent makes it and
  passes it to both.
- **It keeps the same time rules as a model.** It moves on only in
  `update(deltaMs)`, and never reads a clock.
- **It starts valid.** Its values must make sense before its first
  `update`, since a view's first refresh can come before its first update.
- **It lives in its own file,** beside its view, such as
  `match-effects-view-model.ts`, so a test can import it on its own. A
  factory makes it, named `createXxxViewModel`, taking one options object.

## Common Mistakes

### A view model whose update does one thing

This happens when you reach for a view model first. A view model for a
single fade adds a file, an interface and a test, and makes the fade
harder to find. Keep single effects inline, and split independent ones
into sub-views.

### Effects that start together, then drift apart

Five sub-views that each keep their own timer for one timeline drift
apart as soon as one starts a frame late, or is made after the others.
The flash and the shake stop lining up. Share one sequence, moved on by
the parent.

### Particles that pile up

Placing particles or setting text whenever a step is active repeats the
work every frame, and adds more particles each time. Two refreshes in a
row then don't leave the display the same. Do one-off setup in a
tracker's `entering`, or in a reaction to the change.

### Effects that stop matching the game when it pauses

If the model's phase has a progress, a sequence keeping its own time runs
on when the model pauses or slows. Map the model's progress to windows
instead, and don't keep any time in the view.

### A view model you can't test without a sprite

A view model that sets an `alpha` on a sprite needs one to be tested, and
writes output outside the refresh step. Give the view model values, and
let the view's `refresh` write them.

## Summary

Keep a complex view in order by taking the lightest step that works.
Keep a single effect inline, and split independent effects into
sub-views, which covers most cases. Use a helper for patterns that recur.
When effects overlap on one timeline, share a sequence between sub-views,
unless the model keeps the time, when you map its progress to windows
instead. Only when coordinating the effects needs rules of its own, move
the rules into a view model, which the view owns and you can test without
a renderer.

## Further Reading

- John Gossman, "Introduction to Model/View/ViewModel pattern for building
  WPF apps" (2005). The ViewModel that MVT's view model takes its name
  from. MVVM's adapts domain state for a view, where MVT's holds one
  view's presentation state.
- Robert Penner, *Robert Penner's Programming Macromedia Flash MX* (2002).
  The easing equations that most animation libraries still use, and the
  idea of easing as a function from progress to progress.
