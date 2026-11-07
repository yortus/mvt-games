# Presentation State

> Sometimes a view shows something that the model doesn't track: a door
> sliding open, a score rolling up to its new value, text that the player
> has half typed. That's presentation state. The view keeps it,
> advances it in an `update(deltaMs)` step of its own, with time from the
> ticker, and writes it out in `refresh()`. If the game would play the
> same with the view deleted, the state belongs in the view. If not, it
> belongs in a model.

**Related:** [Views](07-views.md) · [Time and Phases](06-time-and-phases.md) ·
[The Tick](05-the-tick.md) ·
[Growing a Complex View](18-growing-a-complex-view.md) ·
[Reduced Motion](22-reduced-motion.md) ·
[Two Kinds of State](02-why-mvt.md#two-kinds-of-state)

A spaceship game's model keeps track of whether a door is open, as a
boolean. The game's rules use only that boolean. The door view shows the
door when it's closed, and hides it when it's open, so it snaps in and out
from one frame to the next. You'd like its two halves to slide apart into
the walls over half a second instead.

The slide needs a number that says how far open the door is, and that
number has to move with time. A view doesn't have a clock, so it's
tempting to make one up in `refresh()`:

```ts
// Don't do this: the view invents its own time
function refresh(): void {
    const target = bindings.isOpen() ? 1 : 0;
    if (openness < target) openness = Math.min(target, openness + 16 / SLIDE_MS);
    if (openness > target) openness = Math.max(target, openness - 16 / SLIDE_MS);
    const slide = openness * PANEL_WIDTH;
    left.x = -slide;
    right.x = PANEL_WIDTH + slide;
}
```

That `16` is right only at 60 frames per second, and it breaks three
ways:

- **It isn't deterministic.** On a 120 Hz screen the slide runs twice as
  fast. A test that checks the door is half open after 250 ms passes or
  fails depending on how often it refreshes. Using `Date.now()` instead
  makes it depend on how fast the machine is.
- **It ignores pause and fast-forward.** If the game pauses but the view
  is still refreshed, the slide carries on. If the game runs at double speed
  for a replay, the slide doesn't.
- **It breaks the `refresh()` contract.** A `+=` in `refresh()` means two
  refreshes produce a different picture from one
  ([Chapter 7](07-views.md)).

The slide's progress is fine as an idea. It's only in the wrong step, with
the wrong clock. This chapter shows where it goes.

## Presentation State and Domain State

A model decides what happens in the game. Its state is
[domain state](../appendices/b-glossary.md): if you replayed the same
inputs without any view, every outcome would be the same. Most of the
time, a view just shows that state. A character's position on screen
follows the model's position, and a health bar shrinks as the model's
health goes down.

Sometimes a view shows something that the model doesn't need to track.
The door's slide is one. The model doesn't track it, because the game's
rules don't depend on whether the slide has finished. Replace the slide
with a snap, and the game plays exactly the same. State like this, which
exists only for how things are shown, is called
**[presentation state](../appendices/b-glossary.md)**, or cosmetic state.

Text being typed is another. While the player types a name for the high
score table, the field holds the text so far, and the caret's blink timer.
The model's name changes only when the player commits it, by pressing
Enter, so the model never receives the half-typed text.

Presentation state answers a different question from the model's state.
The model answers "is the door open?" The view answers "how far open is
the door on screen right now?" Only the view can answer that,
so keeping it there isn't a copy of anything. Presentation state may
follow domain state, but never the reverse, as
[Chapter 2](02-why-mvt.md#two-kinds-of-state) explains.

## When a View Needs Presentation State

The usual pattern is that the model changes in one step, and the view
shows the change gradually:

| The model | The view's presentation state | Why it's cosmetic |
| --- | --- | --- |
| A door's `isOpen` flips | A slide over 500 ms | The model's door is already open |
| The score jumps from 100 to 200 | A count rolling up to 200 | The model's score is already 200 |
| Three tiles match, and the board clears them | A shake, then a popup celebrating the match | The board has already cleared them |
| An enemy takes a hit | A brief red flash on its sprite | The game's rules don't depend on the flash |

::: tip Most animations don't need presentation state
They follow the model's values directly. A moving character reads the
model's position. A shrinking health bar reads the model's health. A ship
flickering while it can't be hit reads a flag and a timer that the model
keeps anyway, for its collisions. You need presentation state only when
the view adds a change over time that the model doesn't track.
:::

## A View's `update(deltaMs)`

A view with presentation state gets an `update(deltaMs)` step, like a
model's. The ticker calls it every frame, after the models update and
before the views refresh, and passes it the same `deltaMs` that the
models received ([Chapter 5](05-the-tick.md)):

```text
each tick:
    model.update(deltaMs)    -- domain state moves on
    view.update(deltaMs)     -- presentation state moves on
    view.refresh()           -- reads both, writes the output
```

Views without presentation state are unchanged. They don't have an update
step, only `refresh()`.

This mirrors a model on purpose. Both kinds of state get their time from
the ticker, so both pause, slow down and speed up together, and the views
never read the clock.

Here is the door again, done properly:

```ts
import { Container, Graphics } from 'pixi.js';
import { setRefresh, setUpdate } from '@mvtjs/pixi';

/** How long the door takes to slide open or shut, in ms. */
const SLIDE_MS = 500;

function DoorView(bindings: DoorViewBindings): Container {
    const view = new Container();
    const left = drawDoorPanel('left');
    const right = drawDoorPanel('right');
    const panels = new Container();
    panels.addChild(left, right);
    // The doorway's shape, which hides each half as it slides into the wall
    const doorway = new Graphics().rect(0, 0, DOOR_WIDTH, DOOR_HEIGHT).fill(0xffffff);
    panels.mask = doorway;
    view.addChild(panels, doorway);

    // Presentation state: how far open the door is on screen, from 0 (shut) to 1 (open)
    let openness = bindings.isOpen() ? 1 : 0;

    function update(deltaMs: number): void {
        const target = bindings.isOpen() ? 1 : 0;
        const step = deltaMs / SLIDE_MS;
        if (openness < target) openness = Math.min(target, openness + step);
        if (openness > target) openness = Math.max(target, openness - step);
    }

    function refresh(): void {
        // Each half slides its own width into the wall on its side
        const slide = openness * PANEL_WIDTH;
        left.x = -slide;
        right.x = PANEL_WIDTH + slide;
    }

    setUpdate(view, update);
    setRefresh(view, refresh);
    return view;
}
```

`update()` moves `openness` towards the model's state at a fixed rate,
using the `deltaMs` passed to it. `refresh()` turns it into the positions
of the door's two halves, and does only that. The mask, the doorway's
shape, hides each half as it slides into the wall. If the door flips
halfway through a slide, the slide turns round smoothly.

Run [§](#try-door-slide) to see `DoorView` beside a door that snaps, both
showing a door that opens and shuts on its own. Click, or press Space, to
open or shut it sooner, and do it twice quickly to see the slide turn
round. Then press Step, which pauses it, click, and press Step a few more
times. A paused example draws nothing until a step, so neither door moves on
the click. On the first Step, the snapping door jumps straight to its new
state, but the slide moves only as far as one tick allows. Press View code, and
change
`SLIDE_MS` to slow it down.

<TryIt example="door-slide" file="views/door-view.ts" />

::: info In this book
`setUpdate(view, update)`, from `@mvtjs/pixi`, sets a view's update step
on its container, as `setRefresh` sets its refresh step. In a JSX body,
the `onUpdate` attribute does the same. `updateView`, from
[Chapter 3](03-a-first-game.md#the-loop), calls every update step on the
stage. The ticker calls it once a tick, after the models and before
`refreshView`.
:::

### The jobs of `update` and `refresh`

The two steps split the work cleanly. `update()` advances presentation
state, and doesn't write anything else. `refresh()` writes all the presentation
output, from the model's state and the view's own. That includes the
output's structure: adding or removing child views and display objects is
output, so it happens in `refresh()`, or when the view is made, never in
`update()`. There are three reasons:

- **A view refreshed without an update still shows everything.** Tests
  often refresh a view once without updating it. Output written in
  `update()`, such as a child view created there, would be missing.
- **The output stays idempotent.** `refresh()` can run any number of times
  with the same result. Output written as a side effect of moving time on
  can't.
- **Frozen time freezes only state.** If the ticker skips a view's
  `update()`, for a paused part of the game, its presentation state stops
  moving, but its output still follows the model.

A view that spawns short-lived effects, such as particles, follows the same
split. `update()` moves a pool of particle records on, and `refresh()`
shows the pool as display objects.

A view's only source of time is the `deltaMs` passed to its `update()`.
Like a model's, a view's `update()` must accept a `deltaMs` of 0
([§](04-models.md#the-update-deltams-contract)). No time passes at 0, so a
timer mustn't fire then. This view lets out a bubble each time a wait runs
out, and the first wait starts at 0, so it returns early at 0. The early
return is safe, because `update()` doesn't write any output:

```ts
function update(deltaMs: number): void {
    // The wait for the first bubble starts at 0
    if (deltaMs === 0) return;
    msToNextBubble -= deltaMs;
    if (msToNextBubble > 0) return;
    msToNextBubble = BUBBLE_GAP_MS;
    letOutBubble();
}
```

### Why a view has two steps, not one

If you've used a game engine, you might expect a single step, which moves an
object on and then sets what's on screen. That works too, and many games are
built that way. [Appendix I](../appendices/i-why-update-and-refresh.md)
compares the two, and says why MVT keeps both.

### Presentation state is private

A view's presentation state lives in the view's own variables, and the view
returns only its container, so other views can't reach it. That's on
purpose. A view sees another's presentation state only if the owner passes
it down through a binding, never up or sideways.
[Chapter 18](18-growing-a-complex-view.md#sharing-one-sequence-across-sub-views)
shows a parent sharing a sequence this way. The owner is also the view that
moves that state on. Its update step runs before its children's, so every
child reads this tick's value.

### Watching for a change in `update`

Presentation state often starts when something in the model changes. A
flash starts when a count of hits rises, for example. The reactions from
[Chapter 9](09-noticing-changes.md) work in a view's update step as well
as in its refresh step, so the view can start its timer in the same step
that moves the timer on:

```ts
let flashMs = 0; // time left on the flash

const startFlashWhenHitsRise = createReaction({
    watch: () => model.hitsTaken,
    when: increased,
    react: () => {
        flashMs = FLASH_MS;
    },
});

function update(deltaMs: number): void {
    flashMs = Math.max(0, flashMs - deltaMs);
    startFlashWhenHitsRise();
}
```

Less of the state is final in a view's update step than in its refresh
step. Every model has updated, so the models' state is final. So is any
presentation state that the view's parent shares with it, because the
ticker updates parents before their children. But the view's own
presentation state isn't final until its update step ends, so watch that in
`refresh()`.

### Start valid: the first refresh may come before the first update

`openness` starts out matching the model, not at some value that the first
`update()` corrects. That's because a view's first `refresh()` can come
before its first `update()`:

- **A view made during the refresh step,** such as the view of a newly
  added enemy, or a grid rebuilt when its size changes, is refreshed on
  the frame it appears. Its first update is on the next frame. The update
  step moves on the views that existed when the frame began, and a view
  made after that doesn't have any time to catch up on.
- **Tests** often refresh a view once without updating it at all.

So set presentation state up when the view is made, from its bindings if
it depends on them. Never write a `refresh()` that's correct only once
`update()` has run.

A view with presentation state is added to its parent like any other
child, and its parent never calls its `update()`
([Chapter 5](05-the-tick.md#trees-the-ticker-calls-only-the-roots)).

[§](#try-score-roll-up) shows the score from the table above, rolling up
to meet the model's. The number on screen is presentation state. It starts
at the model's score, so the view's first refresh is right, and its update
step moves it on. Press View code, open `views/score-view.ts`, and change
`ROLL_MS` to make the roll slower or quicker.

<TryIt example="score-roll-up" file="views/score-view.ts" />

## Controls That Are Both Output and Input

A text field shows the model's state, and also lets the player change it.
So do a dropdown, a slider and a scrolled list, and games have them too,
such as the name entry on a high score table. A control like these has
both directions in one element, so three things need care:

1. **What's in progress stays in the view.** A dropdown's model stores
   only the item chosen. Whether the list is open, and which item is
   highlighted, are presentation state.
2. **A write from the model mustn't undo the player's edits.** If the view
   writes the model's value into a text field every frame, it overwrites
   what the player is typing. So the view doesn't write the value while
   the player is editing.
3. **A write that comes back as an event isn't the player's input.** Some
   elements report the view's own writes as if the player made them. In a
   browser, `scrollTo` fires `scroll`, and `history.back()` fires
   `popstate`, just as the Back button does. So the view tells the two
   apart. It can count the writes it makes and skip their events, or skip
   any input that already matches the model's state.

::: info In this book
The DOM JSX runtime in `@mvtjs/html` doesn't write a text field's `value`
while the field has the focus. A value the model changed in the meantime
shows once the field loses the focus.
:::

## Presentation State in Phases

[Chapter 6](06-time-and-phases.md#phases-and-progress) showed how a model
exposes a `phase`, and a `progress` from 0 to 1 through each timed phase.
In an open-ended phase, one that waits for something rather than ending
after a set time, the model doesn't time anything, and, for the reasons
in [Chapter 6](06-time-and-phases.md#why-the-model-doesn-t-expose-a-clock),
doesn't keep a clock just so that a view can animate.

That leaves the view's side. Anything that moves during an open-ended
phase, such as a gentle bob or a pulsing glow, is cosmetic. So the view
keeps its time, as presentation state.

### Cyclic animations in open-ended phases

A popup that stays open until the player taps it might bob up and down, and
pulse a glow, for as long as it's open. These loops repeat until the phase
changes.

The view keeps its own timer, advanced in its update step. Here the popup
bobs while it's open, and keeps bobbing as it closes, so that the bob
doesn't jump back to the middle:

```ts
/** How long the popup takes to bob up, down and back to the middle, in ms. */
const BOB_PERIOD_MS = 1000;
/** How far the popup bobs above and below where it rests, in pixels. */
const BOB_HEIGHT = 12;
/** How long one pulse of the glow takes, in ms. */
const PULSE_PERIOD_MS = 3000;

// Presentation state: how long the popup has been bobbing
let bobMs = 0;

function update(deltaMs: number): void {
    const phase = bindings.phase();
    if (phase === 'open' || phase === 'closing') bobMs += deltaMs;
    else bobMs = 0;
}

function refresh(): void {
    const phase = bindings.phase();
    const progress = bindings.progress();
    const bob = Math.sin((bobMs / BOB_PERIOD_MS) * Math.PI * 2) * BOB_HEIGHT;

    popup.visible = phase !== 'closed';
    if (phase === 'opening') {
        popup.alpha = progress;
        popup.scale.set(0.5 + 0.5 * progress);
        popup.y = BASE_Y;
    }
    else if (phase === 'open') {
        popup.alpha = 1;
        popup.scale.set(1);
        popup.y = BASE_Y + bob;
        const pulse = Math.sin((bobMs / PULSE_PERIOD_MS) * Math.PI * 2);
        glow.alpha = 0.3 + 0.2 * pulse;
    }
    else if (phase === 'closing') {
        popup.alpha = 1 - progress;
        popup.scale.set(1 - 0.5 * progress);
        popup.y = BASE_Y + bob;
    }
}
```

The bob and the pulse are both worked out from `bobMs`, and `refresh()`
doesn't store anything.

The view also decides when its loop starts and stops. Here, `bobMs`
carries on through `'closing'`, because this view is designed to look
that way. Another view of the same popup could do it differently, without
touching the model.

`bobMs` starts at 0 when the view is made, which is right for every phase,
so the view's first refresh is correct even before its first update.

Run [§](#try-bobbing-popup) to see that popup. Click to close it, and
click again to open it once it has closed. Its model takes a second and a
half to close it, slowly enough that you can watch it keep bobbing as it
shrinks away. Press View code, and try a bigger `BOB_HEIGHT`, or a shorter
`BOB_PERIOD_MS`.

<TryIt example="bobbing-popup" file="views/popup-view.ts" />

You keep every benefit of a model's clock. The timer is deterministic,
because the same ticks produce the same frames. It counts
milliseconds, not frames, so it doesn't depend on the frame rate. And it
pauses, slows down and steps one frame at a time with the rest of the
game.

Each view's timer starts on the tick when that view first reads the new
phase. Views that exist when the phase begins all read it on the same
tick, so their loops stay in step. A view made later in the phase starts
its loop from 0. If that matters, a parent view can keep one timer and
pass it to its children as a query binding.

### One timer for every cycle

You don't need a timer for each cycle, or a timer that wraps round at the
end of its period. One timer drives cycles of any period, as `bobMs` drives
both the bob and the pulse. Take the remainder when you need a repeating
value from 0 to 1:

```ts
const cycle = (bobMs % BOB_PERIOD_MS) / BOB_PERIOD_MS; // 0 to 1, repeating
```

### When the view owns the open-ended phase

If the game's rules don't depend on the phases at all, they can live in
the view, as presentation state
([Chapter 6](06-time-and-phases.md#who-owns-the-phases) says when). Here
a notification popup opens when the model has a notification, and closes
when it doesn't. The model has only a boolean, and the view keeps the
phases, with the same `phase` and `progress` pattern that a model would
use:

```ts
type PopupPhase = 'opening' | 'open' | 'closing' | 'closed';

const OPEN_MS = 200;
const CLOSE_MS = 150;

// Presentation state, starting to match the model
let phase: PopupPhase = bindings.hasNotification() ? 'open' : 'closed';
let elapsedMs = 0;
let durationMs = 0;

function update(deltaMs: number): void {
    elapsedMs += deltaMs;
    if (durationMs > 0 && elapsedMs >= durationMs) nextPhase();

    const shouldShow = bindings.hasNotification();
    if (shouldShow && phase === 'closed') beginPhase('opening', OPEN_MS);
    if (!shouldShow && phase === 'open') beginPhase('closing', CLOSE_MS);
}

function refresh(): void {
    const progress = durationMs > 0
        ? Math.min(1, elapsedMs / durationMs)
        : 1;
    // ...draw the popup from phase and progress, as above
}

function beginPhase(next: PopupPhase, phaseMs: number): void {
    phase = next;
    elapsedMs = 0;
    durationMs = phaseMs;
}

function nextPhase(): void {
    if (phase === 'opening') beginPhase('open', 0);
    else if (phase === 'closing') beginPhase('closed', 0);
}
```

The pattern is the same whether the phases live in the model or the view.
The differences are who starts each phase, and whether code outside the
view can read it.

## When Is Presentation State Really Domain State?

Presentation state that starts to affect what happens in the game belongs
in a model. Here is the test, the **delete-the-view test**: if you deleted
the view, would the game still play correctly? If it would, the view's
state is presentation state. If something would break, it's domain state
in the wrong place.

Ask it of each piece of state that the view keeps. The door's slide
passes: delete the door view, and the door still opens at the same
moment. A count of lives that the view adjusts by itself fails: delete the
view, and the player never loses a life. When other code reads the view's
state, or the state changes what the model does next, it fails the test
too.

## Trade-offs of Presentation State

Polished games need presentation state, and you can't avoid it entirely.
But it's a second kind of state in the view, and it makes the view more
complex. It moves
with time, it often has to notice when the model's state changes, and it
interacts with that state. That makes a view harder to read, harder to
test and harder to change. A view with one fade is fine. A view with a
fade, a bounce, a shake and a popup, each with its own timers and its own
rule for when to start, gets hard to follow quickly.

[Chapter 18](18-growing-a-complex-view.md) shows how to keep such a view
under control: by splitting it into smaller views, by using small helpers
for common transitions, and by moving the presentation logic into a **view
model**, a plain object with its own `update(deltaMs)` that the view owns,
and that you can test without drawing anything.

## Common Mistakes

### An animation that ignores the game's speed

An animation runs at different speeds on different screens, or carries on
through a pause. The view makes up its own time, because `+= 16` or
`Date.now()` in `refresh()` is the first thing that comes to mind. Give
the view an `update(deltaMs)` step that uses the `deltaMs` that the
ticker passes to it.

### A view that's missing pieces in a test

A view looks right in the game, but is missing pieces in a test, which
refreshes without updating. Some of its output is written
in `update()`. Move every write to the output, including adding and
removing children, into `refresh()`.

### A view that flashes the wrong state as it appears

A door flashes shut for one frame as its view appears, or a test's
picture shows a half-finished slide. The presentation state starts at a
default, and the first `update()` was meant to fix it. Start it from the
bindings, when the view is made.

### A game that changes when a view is removed

The game behaves differently, or breaks, when a view is removed or
replaced. The view keeps state that the game depends on, such as a count
of lives that it adjusts by itself. Move it to the model, as the
delete-the-view test shows.

## Summary

Presentation state is state that a view keeps only for how things are
shown, such as how far a door has slid open, or the text in a field being
edited. The game's outcomes don't depend on it. A view that has it gets
an `update(deltaMs)` step, which the ticker calls with the same `deltaMs`
that the models received. `update()` moves the state on, and doesn't
write any output. `refresh()` writes all the output, structure included.
The state starts valid when the view is made. During an open-ended phase,
the view keeps the timer for any loop, and one timer serves every cycle. If
deleting the view would change how the game plays, the state belongs in a
model.
