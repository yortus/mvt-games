# Change Detection

> Poll every frame, and act only when a value changes. This project has three
> tools for that: reactions, watchers and computed values. This page covers
> reactions and watchers, and the four rules all three follow. Computed values
> have [a page of their own](computed-values.md).

**Previous:** [Reactivity: Why Polling](why-polling.md)
**Related:** [Computed Values](computed-values.md) -
[Events and Signals](events-and-signals.md) -
[Bindings (Learn)](../presenting-the-world/bindings.md) -
[Bindings in Depth](../presenting-the-world/bindings-in-depth.md) -
[Hot Paths](../performance/hot-paths.md) -
[Sound and Music](../presenting-the-world/sound.md)

---

*Assumes familiarity with [Bindings](../presenting-the-world/bindings.md) and [Views](../presenting-the-world/views.md).*

> **Terminology note:** "Change detection" here has its plain meaning:
> comparing a value with what it was before. It is not Angular's change
> detection cycle, or React's reconciliation of a virtual DOM. The idea
> behind them is the same, skipping work when nothing changed, but here you
> compare the values yourself.

## The Problem

Reading every binding every frame is always correct, but it isn't always
cheap. Some state changes every frame, such as the position of something
moving. Other state changes rarely, such as a score, a game's phase or a
board's size. When a rare change sets off costly work, such as rebuilding a
grid or making new text, doing that work on every frame wastes time.

## Comparing by Hand

The simplest way is to keep the last value yourself:

```ts
let shownScore = -1;

function refresh(): void {
    const score = bindings.score();
    if (score !== shownScore) {
        shownScore = score;
        label.text = String(score);
    }
}
```

This works well for one or two values. With more, it gets repetitive, and
it's easy to slip. The three tools below do the comparing for you.

## Three Tools, One Idea

Each tool watches **getters**: functions that return a value, such as a
view's [query binding](../../reference/glossary.md) `bindings.phase`, or
`() => model.score`. Each time you ask, a tool reads its getters, and
compares each value with the one it read last time, using `===`. Nothing is
pushed to you, so you decide when the reads happen: usually once in each
step of the game loop.

| What you want | Tool |
| --- | --- |
| A sound or an effect at one moment, such as a ship exploding | `createReaction` |
| The same, for each of a fixed set, such as three reels | `createReaction`, with an array |
| A value that's costly to work out, or a label for a JSX prop | `createComputed` |
| Checks mixed in with other logic in a step, with early returns | `watch` |
| Smooth change over time, such as an eased position | None of them: a view's update step |
| One cheap value, read every frame and used as it is | None of them: just read it |

These tools come from `@mvtjs/utils`. They're this project's helpers, not
part of MVT itself. The idea underneath, polling for changes and acting only
when values differ, works however you write it.

This page covers reactions and watchers in full. Computed values have more
to them, so they get [the next page](computed-values.md), with a short
introduction [below](#computed-values-a-value-worked-out-from-others). The
rules on this page apply to all three.

## Reactions: Do Something When a Value Changes

A **reaction** is a function that you call on every step. Each call reads
the getter it watches, and runs `react` if the value changed in a way that
`when` accepts:

```ts
import { createReaction } from '@mvtjs/utils';

const playExplosionSoundWhenDying = createReaction({
    watch: bindings.phase,
    when: 'dying',
    react: () => sfx.play(SHIP_EXPLODE),
});

function refresh(): void {
    playExplosionSoundWhenDying();
}
```

`when` is a value, meaning "changed to this value", or a condition. Leave it
out to react to every change. The library has three conditions: `increased`,
`decreased` and `changedFrom(value)`. For anything else, write your own.
It's given the value now and the value before:

```ts
const playTickSoundInLastTenSeconds = createReaction({
    watch: bindings.secondsLeft,
    when: (seconds, previous) => seconds < previous && seconds <= 10,
    react: () => sfx.play(TICK),
});
```

`react` is given the same two values, so it can see what happened between
two reads.

Give a reaction an array of getters, and it reacts to each one separately.
Each getter has its own memory, and `react` is told which one changed by its
index. Every getter in the array must return the same type, since they share
`when`:

```ts
const playStopSoundWhenEachReelSettles = createReaction({
    watch: reels.map((reel) => () => reel.phase),
    when: 'settling',
    react: (_phase, _previous, index) => sfx.play(STOP_SOUNDS[index]),
});
```

**Name a reaction for what it does, and when.** Put the effect first, then
what sets it off: `updateTextureWhenPhaseChanges`,
`playPumpSoundWhenInflationRises`. Use `When` for a value that changes or
reaches a state, and `OnEach` for a count, where each rise is one event
(`playShotSoundOnEachShot`). Say `Sound` for a sound, and name a visual for
what it is, such as a texture, a popup or an animation. A short name like
`playPump` names the value watched, and leaves the reader guessing what
happens to it.

## Watchers: What Changed, for Logic in a Step

A **watcher** is for code that checks for changes as it goes, mixed in with
other work. You poll it once in each step, and the **reading** it returns
tells you what changed:

```ts
import { watch } from '@mvtjs/utils';

const watcher = watch({
    rows: bindings.rows,
    cols: bindings.cols,
    phase: bindings.phase,
});

function refresh(): void {
    const w = watcher.poll();
    if (w.rows.changed || w.cols.changed) {
        rebuildGrid(w.rows.current, w.cols.current);
    }
    if (w.phase.changedTo('game-over')) showFinalScore();
}
```

Each value in the reading has these members:

| Member | What it gives |
| --- | --- |
| `current` | The value read by this poll |
| `previous` | The value read by the last poll. Equal to `current` when nothing changed |
| `changed` | Whether the value differs from the last poll's |
| `changedTo(value)` | Whether it changed, to `value` |
| `changedFrom(value)` | Whether it changed, from `value` |
| `increased`, `decreased` | For a number or a `bigint` only: whether it changed to a greater or a lesser one |

Give `watch` one getter, and the reading is that getter's own. Give it a
record or an array, and the reading has one for each getter, by name or by
position. It also has `anyChanged`, which says whether any of them changed.

A watcher reuses its reading on every poll, so use the reading in the step
that polled it, and copy out any values you want to keep. In development, a
reading used after the next poll throws an error, to tell you.

## Computed Values: A Value Worked Out From Others

A **computed value** works out a value from what it watches, and works it
out again only when that changes. You read it by calling it, as often as you
like:

```ts
import { createComputed } from '@mvtjs/utils';

// Makes the text only when the score changes, not on every frame
const scoreText = createComputed({ watch: bindings.score, compute: String });

function refresh(): void {
    label.text = scoreText();
}
```

Unlike a reaction, a computed value doesn't need to be read on every step,
since it's always up to date when you read it. [Computed Values](computed-values.md)
covers it in full: working from several values, keeping an object up to
date, and watching a computed value.

## Which Shapes Each Tool Takes

All three tools take the same getters, but each takes only the shapes that
fit what it does with them:

| Shape | `createReaction` | `watch` | `createComputed` |
| --- | --- | --- | --- |
| One getter | `react(current, previous)` | Its reading | `compute(value)` |
| A record of getters | Refused | A reading for each, and `anyChanged` | One `compute(values)` when any changed |
| A fixed array of getters | `react` for each one that changed, with its index | A reading for each, and `anyChanged` | Refused: use a record |

A reaction treats each getter on its own, so it takes an array, whose index
says which one changed. A computed value treats its getters together, so it
takes a record, whose names read better than positions. To react to several
values together, work out one value from them with a computed value, and
react to that.

## The Four Rules

All three tools follow four rules. Each one has consequences for how you use
them.

### 1. A change is a difference between two reads

Two reads by the same tool that differ by `===` are one change, reported by
the later read. A tool knows only what it reads.

- **Nothing reacts because it was made.** A reaction or a watcher reads its
  getters when it's made, and that first read is its starting point, never a
  change. So a view draws its first state itself, when it's made. An audio
  view plays the sound for a state it starts in, such as a game's opening
  tune, when it's made, and its reactions then hear only what changes after
  that.
- **Call reactions and poll watchers on every step, unconditionally.** A
  reaction skipped on some steps compares with an older read, and can miss a
  change that came and went in between. This project's lint reports a
  reaction called, or a watcher polled, behind an `if` or after an early
  `return`. If you mean to leave a gap, disable the rule there, with a
  comment that says why.
- **Two rises between reads are one `increased`.** When every occurrence
  matters, have the model [count](#counts-moments-that-repeat) them, and
  react from `previous` to `current`.
- **Calling a reaction twice in a step is harmless.** The second call sees
  no change. Polling a watcher twice in a step is a mistake, though: the
  second reading says nothing changed. The lint reports that too.

::: info `NaN` is never equal to itself
Under `===`, `NaN` differs from every value, itself included. So a getter
that returns `NaN` reads as a change every time.
:::

### 2. A computed value is always up to date

Reading a computed value gives what `compute` would give from the values
now. You can read it at any time, any number of times, or never.
[Computed Values](computed-values.md) explains how.

### 3. Equal reads mean nothing changed

That's why every getter must return a primitive: a string, a number, a
`bigint`, a boolean, a symbol, `null` or `undefined`. An object or an array
changed in place would still be `===` to itself, so a change would go
unseen. A getter that returns an object throws an error, in production too.

To watch a structure, watch a primitive that changes with it:

```ts
// The number of enemies, not the array itself
const playWaveSoundWhenEnemiesRunOut = createReaction({
    watch: () => game.enemies.length,
    when: 0,
    react: () => sfx.play(WAVE_CLEARED),
});
```

A number that the model raises whenever a structure changes, called a
**version**, works for anything. A computed object has a version of its own
(see [Computed Values](computed-values.md#watching-a-computed-value)).

### 4. What a tool watches is fixed when it's made

A tool reads a record or an array for its getters once, when it's made. So
these tools don't follow a list whose items come and go, such as enemies or
bullets. [Presenting Collections](../presenting-the-world/collections.md)
and [Sound and Music](../presenting-the-world/sound.md#sound-for-a-collection)
show what to do instead.

An array made with `map` over model objects keeps reading those same
objects, even if the model replaces them. To follow the model, read through
it on every call:

```ts
// Reads model.reels[i] on every call, so it follows a replaced reel
const getters = model.reels.map((_, i) => () => model.reels[i].phase);
```

## Where to Read

A read reports the state as it is at that moment. So read where the state
you watch is final for the frame. In MVT, the order of each
[tick](../../reference/glossary.md) decides where that is:

- **In a view's refresh step,** all state is final, so watch anything.
- **In a view's update step,** the models' state is final, and so is the
  presentation state of the view's ancestors. The view's own presentation
  state is not, and neither is that of its children, so watch those in
  refresh.
- **In a model,** nothing is final while `update` runs. A model that watches
  should poll right after the changes it watches, at a point it chooses on
  purpose.

For example, a game model with a boss might watch the boss's phase. It polls
near the end of its update, after the boss has moved and the shots have
landed. Then the rules it runs on a change, such as turning bullets into
gems, never interrupt those steps:

```ts
function update(deltaMs: number): void {
    boss.update(deltaMs);
    hitBossWithShots();
    hitShipWithBoss();
    // Everything that can change the boss's phase has run
    const w = bossWatcher.poll();
    if (w.changedTo('defeated')) turnBulletsIntoGems();
}
```

## When to Use Change Detection

| Situation | Approach |
| --- | --- |
| Continuous state, such as a moving object's position | Read the binding directly. Detecting changes costs more than it saves |
| Rare changes, with cheap work, such as a text label | A computed value, or comparing by hand |
| Rare changes, with costly work, such as a rebuild | Essential: otherwise the work runs 60 times a second |

The test is simple. If detecting a change costs more than doing the work,
just do the work.

## Change Detection as Consumer-Defined Events

You can think of change detection as **events defined by whoever uses
them**. In an event system, the producer decides what counts as an event and
sends it. Every consumer has to subscribe, unsubscribe, and hope the
producer sends what it needs.

With change detection, the **consumer** decides what matters, by choosing
what to watch and what to do when it changes. The model doesn't need to
know anyone is watching:

```ts
// This view decided that a new phase matters.
// The model needed no "phase changed" event.
const showOverlayWhenPhaseChanges = createReaction({
    watch: bindings.phase,
    react: (phase) => showOverlay(phase),
});
```

A second view can watch the same binding and do something else, or ignore
it entirely. There's nothing to register, no coupling to the producer's
events, and no risk of missing an event or handling one twice.

### Counts: Moments That Repeat

A phase reports a change only when it becomes something else. Some moments
aren't a change of state at all: a ship that fires twice in a row is still a
ship that is flying. For moments like these, the model keeps a **count**,
and a view reacts each time it rises:

```ts
// In the model: one more each time it happens
shotsFired++;

// In a view: each rise is a shot
const playShotSoundOnEachShot = createReaction({
    watch: bindings.shotsFired,
    when: increased,
    react: () => sfx.play(SHOT),
});
```

- **Going back to 0** for a new game isn't a rise.
- **Several in one tick** are one rise. When every one matters, play from
  `previous` to `current`, as below. When the view needs details of what
  happened, such as how big a rock was, the model keeps the **last one's
  details** beside the count (`lastBrokenRockSize`).

```ts
const playShotSoundForEachShot = createReaction({
    watch: bindings.shotsFired,
    when: increased,
    react: (shots, previous) => {
        for (let i = previous; i < shots; i++) sfx.play(SHOT);
    },
});
```

A count is the model's half of a consumer-defined event. The model says how
many times something has happened, in its own terms, and knows nothing of
who watches. A count is plain state, so it's as easy to test as any other
state. [Sound and Music](../presenting-the-world/sound.md) relies on counts
throughout.

---

For the basics of bindings, see [Bindings (Learn)](../presenting-the-world/bindings.md).
For hot-path considerations, see [Hot Paths](../performance/hot-paths.md).

**Next:** [Computed Values](computed-values.md) - values worked out from
others, and worked out again only when those change
