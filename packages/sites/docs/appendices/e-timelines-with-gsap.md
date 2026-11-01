# Timelines with GSAP

> GSAP's timelines describe a sequence of changes, with their timing and
> easing, in a few readable lines. A model can use one, as long as the
> timeline never plays by itself. You create it paused, move it forward
> from `update(deltaMs)`, and keep it hidden inside the model. This
> appendix shows the recipe, and the few pitfalls of driving a timeline by
> hand.

**Related:** [Time and Phases](../chapters/06-time-and-phases.md) ·
[Models](../chapters/04-models.md) ·
[Testing Models](../chapters/15-testing-models.md) ·
[Troubleshooting](f-troubleshooting.md)

[GSAP](https://gsap.com/) is a JavaScript animation library. Its tweens
change a property from one value to another over time, and its timelines
put tweens in order. Using it in a model is a convenience, not something
MVT requires. Plain arithmetic in `update()` can do everything that a
timeline does, as [Chapter 6](../chapters/06-time-and-phases.md) shows.
But a timeline can express "move to the next tile over 0.2 seconds, then
mark the move done" in two lines, with easing built in. Six of the
arcade's games use GSAP in their models this way: Astrovoid, Burrow Bust,
Dojo Duel, Fenceline, Fuel Run and Galaxy Raiders.

## Why a Model Needs a Paused Timeline

Left to itself, GSAP plays every timeline on its own clock, which runs
from the browser's `requestAnimationFrame`. A model that starts a
timeline that way has state that changes outside `update(deltaMs)`:

```ts
// Wrong: GSAP's own clock moves the digger
const timeline = gsap.timeline();
timeline.to(state, { col: 5, duration: 0.2 });
```

That breaks the model's contract. Pausing the game doesn't pause the
tween. A test can't step it. Two runs with the same input end
differently, because the tween moved on whenever the browser's clock
advanced.

The fix is to create the timeline paused, so GSAP's clock never advances
it, and to move its playhead yourself, in `update(deltaMs)`.

## The Recipe for a Paused Timeline

### Create the timeline once, paused

Create the timeline when the model is created, and keep it for the
model's life:

```ts
const timeline = gsap.timeline({
    paused: true,              // GSAP's own clock doesn't advance it
    autoRemoveChildren: true,  // finished tweens are removed for you
});
```

The timeline lives inside the factory function, beside the model's other
private state. It never appears on the model's interface. Views never
reference it, and could read the same state from a model that uses plain
arithmetic.

### Add tweens in `schedule` helpers

Each sequence gets a helper, named `schedule` and what it schedules,
which adds tweens to the timeline. Here's a simplified version of how
Burrow Bust's digger moves one tile:

```ts
function scheduleMove(): void {
    // ...work out nextRow and nextCol, or return if the way is blocked
    state.moving = true;
    const dist = Math.abs(nextCol - state.col)
        + Math.abs(nextRow - state.row) || 0.001;
    const duration = dist / speed; // speed is in tiles per second
    const t = timeline.time();

    timeline.to(
        state,
        { col: nextCol, row: nextRow, duration, ease: 'none' },
        t,
    );
    timeline.set(state, { moving: false }, t + duration);
}
```

The tween changes `state`, a private object that holds the digger's
values. The model's interface reads from it, through `get` accessors
such as `get col() { return state.col; }`.

`ease: 'none'` makes the digger move at a steady speed. GSAP's default
ease starts fast and slows down at the end, which suits a menu sliding
in, but not a digger walking from tile to tile.

The `|| 0.001` is there for a reason, which
[Zero-duration GSAP tweens](#zero-duration-gsap-tweens) explains.

### Advance the timeline in `update()`

Each tick, move the timeline's playhead on by `deltaMs`. GSAP measures
time in seconds, so divide by 1000:

```ts
update(deltaMs) {
    timeline.time(timeline.time() + deltaMs / 1000);
    // ...
},
```

Every tween on the timeline now moves forward with the game's time, and
pauses, slows down or steps with it.

## Advance, Then Orchestrate with GSAP

[Chapter 6](../chapters/06-time-and-phases.md) splits `update()` into two
steps: advance every clock, then decide what comes next. With timelines,
the clocks are the timelines, and the deciding starts new sequences
through the `schedule` helpers. Here is the shape of the digger's
`update()`:

```ts
update(deltaMs) {
    // 1. Advance every timeline
    const dt = deltaMs / 1000;
    timeline.time(timeline.time() + dt);
    harpoonTimeline.time(harpoonTimeline.time() + dt);

    // 2. Orchestrate: start the next move when the last one is done
    if (!state.moving && !state.harpoonExtended) scheduleMove();
},
```

The sequences themselves live in the helpers, where you can read each one
from top to bottom: how long it takes, how it eases, and what it sets at
the end. `update()` stays short and flat. A model with several sequences
running at once, such as moving and firing, has a timeline for each, and
advances them side by side, rather than nesting one inside the other's
branches.

[§](#try-digger-timeline) runs a digger built this way, with one timeline
for its moves and one for its harpoon. Click a tile to send it there, and
press Fire. Then press Step, which pauses the game, and keep pressing it
to move a frame at a time. Every tween stops and steps with the game,
since only `update()` moves the timelines.

<TryIt example="digger-timeline" file="models/digger-model.ts" />

## Explicit Positions and `autoRemoveChildren`

A tween's last argument is its position: where on the timeline it starts.
The recipe always passes one, the playhead's current time, `t`. That
matters because the playhead keeps moving for the model's whole life. A
tween added without a position goes at the end of whatever is already on
the timeline, which may be in the past, or long after now.

With explicit positions and `autoRemoveChildren`, one long-lived timeline
scales well.

- **Tweens can overlap.** Several tweens can run on one timeline at once,
  each at its own position.
- **Finished tweens are removed.** `autoRemoveChildren` removes each
  tween once the playhead has passed its end, so the timeline doesn't
  grow.
- **Cancelling is `clear()`.** To stop what's in progress, such as when
  the digger turns round halfway between tiles, call `timeline.clear()`.
  The playhead stays where it is, and the next tween starts there.

For a timeline that only ever runs one sequence at a time, there's a
simpler way. Call `timeline.clear().time(0)` before each new sequence, so
that its positions can be counted from 0 rather than from the playhead.
Burrow Bust's game model times its pauses between lives and levels this
way. Each time, it clears the timeline, then adds a `call()` at the
pause's length, in seconds. This way doesn't scale to tweens that
overlap, though, so count from the playhead as soon as two might.

## `set()` Rather Than `onComplete`

To change a value at a point in time, `timeline.set()` is shorter and
clearer than a callback:

```ts
// Clear: the change sits at its time in the timeline
timeline.to(state, { x: 5, duration: 0.2 }, t);
timeline.set(state, { arrived: true }, t + 0.2);
```

```ts
// Harder to read: the change is buried in a callback
timeline.to(state, {
    x: 5,
    duration: 0.2,
    onComplete() {
        state.arrived = true;
    },
}, t);
```

When the next step is more than setting values, such as losing a life
and loading the next level, `timeline.call()` runs a function at a
position. Burrow Bust's game model uses it to end its `'dying'` phase.

## Steps of Different Sizes with GSAP

A paused timeline is driven by `update()`, so it's as deterministic as
the rest of the model. A model that uses one must still meet the
guarantee that every model meets: it produces the same results at any
step size up to the ticker's cap, as
[§](../chapters/06-time-and-phases.md#steps-of-different-sizes) explains. The recipe above falls a little short of it.

The digger's `set()` marks a move done at a point in time, and that point
usually falls partway through a step. `update()` reads it only at the
end of the step, and `scheduleMove()` starts the next move at the playhead,
`timeline.time()`. The time between the two is lost. So each move runs
long by up to a step, and the digger walks a little slower at 30 frames a
second than at 144. It's the same mistake as the banner's in Chapter 6,
in GSAP's terms.

The fix is the same, too: carry the time left over. When a move follows
straight on from the last one, position it where the last one ended,
rather than at the playhead. GSAP then plays the part of it that's
already due.

A step bigger than the cap could overshoot a whole move, and the `set()`
at its end, before `update()` can start the next. Models aren't required
to handle a step that big, so a test moves a model like this on in steps
no bigger than the cap, with `advanceTime`, as
[Chapter 15](../chapters/15-testing-models.md#advancing-time) shows.

A view can use a paused timeline in the same way, for its presentation
state, advanced in its own update step. In Kwazy Cactii, the view model
behind the board's pieces does, for the pieces that a player drags.

## Common Mistakes

### Forgetting to advance the timeline

Tweens are added, but the objects never move. The model's state stays at
its first values, though `update()` is called every tick. The timeline
was created with `paused: true`, as it should be, but `update()` never
moves its playhead. Advance every timeline at the start of `update()`, as
[§](#advance-the-timeline-in-update) shows.

### Auto-playing a GSAP timeline

The model moves on in real time, whatever the ticker does. Pausing the
game doesn't pause it, and tests produce different results from run to
run.
The timeline was created without `paused: true`, so GSAP's own clock
plays it. Create every timeline in a model paused, as
[the recipe's first step](#create-the-timeline-once-paused) does.

### Zero-duration GSAP tweens

A `set()` that follows a tween never happens. A move never finishes, so
the next one never starts, and the object stops for good.

The duration was worked out as distance divided by speed, and the
distance was 0. A tween with a duration of 0, placed at the playhead of a
paused timeline, counts as already passed. GSAP skips it, and the `set()`
at the same time, on the next advance.

Give the distance a tiny floor, as the `|| 0.001` in
[`scheduleMove`](#add-tweens-in-schedule-helpers) does, so the tween
always lasts a little. At 8 tiles per second, that's 0.000125 s, well
within one tick. The floor keeps the code on its normal path, which is
simpler than a special case that snaps into place and returns early.
A move that takes an eighth of a millisecond is far too short to see.

## Further Reading

- GSAP documentation, ["Timeline"](https://gsap.com/docs/v3/GSAP/Timeline/).
  Positions, `time()`, `set()`, `call()`, `clear()` and the
  `autoRemoveChildren` option.
