# Noticing Changes

> Reading every value every frame is always correct, but some work is too
> slow to repeat sixty times a second. Change detection compares what you
> read now with what you read last time, and does the slow work only when
> they differ. You decide what counts as a change, so the model never
> has to send events. Moments that aren't a change of state, such as a
> shot fired, become changes when the model counts them.

**Related:** [Views](07-views.md) · [Bindings](08-bindings.md) ·
[Presentation State](11-presentation-state.md) ·
[Why Views Poll](10-why-views-poll.md) ·
[Sound and Music](20-sound-and-music.md) · [Hot Paths](24-hot-paths.md)

Here is a score label, written the obvious way:

```ts
// Makes a new string on every frame
function refresh(): void {
    label.text = `SCORE ${bindings.score()}`;
}
```

It's correct, and it follows the score however it changes. But the
template string makes a new string on every frame, sixty times a second,
for text that changes a few times a minute. Each one is
[garbage](24-hot-paths.md) for the JavaScript engine to collect later. Now
imagine the work is rebuilding a grid of tiles, rather than making a
string, and the waste is much larger.

The fix is to remember what you showed, and do the work only when the
value differs:

```ts
let shownScore = -1;

function refresh(): void {
    const score = bindings.score();
    if (score !== shownScore) {
        shownScore = score;
        label.text = `SCORE ${score}`;
    }
}
```

That's change detection: comparing a value with what it was before.
Comparing by hand works well for one or two values. With more, it gets
repetitive, and it's easy to slip, for example by forgetting to update
`shownScore`. Small tools can do the comparing for you.

## Three Tools, One Idea

Each tool watches **getters**: functions that take no arguments and return
a value, such as a view's
[query binding](../appendices/b-glossary.md) `bindings.phase`, or
`() => model.score`. Each time you call or poll a tool, it reads its
getters, and compares each value with the one it read last time, using
`===`. Values are never pushed to you, so you decide when the reads
happen: usually once a tick, in a view's refresh or update step. A
reaction does something when a value changes, a watcher reports what
changed to code in a step, and a computed value works a value out again
only when what it watches changes.
[When to Use Change Detection](#when-to-use-change-detection), near the
end of the chapter, helps you choose one, and shows when you don't need
any of them.

::: info In this book
`createReaction`, `watch` and `createComputed`, and the conditions
`increased`, `decreased` and `changedFrom`, come from `@mvtjs/utils`.
They're the `@mvtjs` libraries' helpers, not part of MVT. The idea underneath,
polling for changes and acting only when values differ, works however you
write it.
:::

Some examples below play sounds on `sfx`, a sound chip that the view
receives for sound effects, and one plays a song on `music`, a second chip for
songs. [Chapter 20](20-sound-and-music.md) covers views that play sound.
For now, `sfx.play(SHOT)` just means "play the shot sound".

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

`when` is either a value, meaning "changed to this value", or a condition.
Leave it out to react to every change. Three conditions are ready-made:
`increased`, `decreased` and `changedFrom(value)`. For anything else, write
your own. It receives the value now and the value before:

```ts
const playTickSoundInLastTenSeconds = createReaction({
    watch: bindings.secondsLeft,
    when: (seconds, previous) => seconds < previous && seconds <= 10,
    react: () => sfx.play(TICK),
});
```

`react` receives the same two values, so it can compare the two reads.

[§](#try-countdown-ticks) shows that tick at work, beside a second
reaction, which plays an alarm when the countdown's phase changes to
`'done'`. Each reaction also counts how often it has played, so you can
follow it with the sound off. In the last ten seconds, click to add five
more. The seconds rise, and the tick doesn't play, because the tick's
`when` accepts only a fall.

<TryIt example="countdown-ticks" file="views/countdown-view.ts" />

Give a reaction an array of getters, and it reacts to each one separately.
Each getter has its own memory, and `react` receives the index of the one
that changed. Every getter in the array must return the same type, since they
share one `when`:

```ts
const playStopSoundWhenEachReelSettles = createReaction({
    watch: reels.map((reel) => () => reel.phase),
    when: 'settling',
    react: (_phase, _previous, index) => sfx.play(STOP_SOUNDS[index]),
});
```

The `map` runs once, when the reaction is made, not every frame.

::: info In this book
A reaction is named for what it does, then what sets it off:
`updateTextureWhenPhaseChanges`, `playPumpSoundWhenInflationRises`. `When`
is for a value that changes or reaches a state, and `OnEach` is for a
count, where each rise is one event (`playShotSoundOnEachShot`). A sound
says `Sound`, and a visual is named for what it is, such as a texture, a
popup or an animation. A short name like `playPump` names the value
watched, and leaves the reader guessing what happens to it.
:::

## Watchers: What Changed, for Logic in a Step

A **watcher** is for code that checks for changes as it goes, mixed in with
other work. You poll it once in each step, and the **reading** it returns
describes what changed:

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

| Member | Value |
| --- | --- |
| `current` | The value read by this poll |
| `previous` | The value read by the last poll. Equal to `current` when the value hasn't changed |
| `changed` | Whether the value differs from the last poll's |
| `changedTo(value)` | Whether it changed, to `value` |
| `changedFrom(value)` | Whether it changed, from `value` |
| `increased`, `decreased` | For a number or a `bigint` only: whether it changed to a greater or a lesser one |

Give `watch` one getter, and the reading is that getter's own. Give it a
record or an array, and the reading has one for each getter, by name or by
position. It also has `anyChanged`, which says whether any of them changed.

A watcher reuses its reading on every poll, so that polling doesn't make
garbage. So use the reading in the step that polled it, and copy out any
values you want to keep. In development, a reading used after the next
poll throws an error, to tell you.

## Computed Values: A Value Worked Out From Others

A **computed value** works out a value from what it watches, and works it
out again only when that changes. Here is the score label once more:

```ts
import { createComputed } from '@mvtjs/utils';

const scoreText = createComputed({
    watch: bindings.score,
    compute: (score) => `SCORE ${score}`,
});

function refresh(): void {
    label.text = scoreText();
}
```

`createComputed` returns a function. Call it to read the value, as often as
you like. The template string now runs only when the score changes. A
computed value is a function that returns a value, so it's a getter too. In
a JSX view, you can pass it straight to an attribute, which reads it every
frame: `<text text={scoreText} />`.

Often `compute` is a function you already have. Pass it by name:

```ts
const livesText = createComputed({ watch: bindings.lives, compute: String });
```

When the text depends on a value that changes more often than the text
does, watch the value as the text shows it. A distance shown in whole
metres changes its text only when the whole number does:

```ts
const distanceText = createComputed({
    watch: () => Math.floor(bindings.distance()),
    compute: (metres) => `${metres} m`,
});
```

### Working from several values

To work from several values, give `watch` a record of getters. `compute`
receives their values by name, and runs again when any of them changes:

```ts
const grid = createComputed({
    watch: { cols: bindings.cols, rows: bindings.rows },
    compute: ({ cols, rows }) => buildGrid(cols, rows),
});
```

A computed value doesn't take an array of getters. A record's names say
what each value is, where an array's positions don't.

### A computed value is lazy

A computed value doesn't read anything when it's made. It reads its
getters and computes on its first read. On each later read, it reads its
getters again, and computes again only if one of the values changed.
Computed values in Vue and MobX work the same way. So a computed value
that you never read, such as a label on a panel that stays hidden,
doesn't take any time, and its getters don't need to be readable until
its first read. Unlike a reaction, it can be
read anywhere, any number of times, or only on some frames. A computed
value that reads itself while it computes throws an error.

### Keeping an object up to date

To update an object in place, rather than make a new one on each change,
give `compute` a second parameter with a default. The default makes the
object on the first compute. Every later compute receives the last
result, to update and return:

```ts
const cells = createComputed({
    watch: bindings.size,
    compute: (size, cells = createCells()) => resizeCells(cells, size),
});
```

The second parameter takes its type from its default.

### Reading state you don't watch

`compute` may read state that it doesn't watch, as long as something it
does watch changes whenever that state does. The usual case is a
**version**: a number that the model raises whenever a structure changes.

```ts
const occupiedCount = createComputed({
    watch: () => model.gridVersion,
    compute: () => countOccupied(model.grid),
});
```

Here, `compute` reads the whole grid, but watches only its version.
Watching something narrower, such as the number of things on the grid,
would miss a thing that changes its kind.

### Watching a computed value

A computed value that returns a primitive, such as `scoreText`, is a getter
like any other, so a reaction or a watcher can watch it:

```ts
const isInDanger = createComputed({
    watch: { fuel: bindings.fuel, isFlying: bindings.isFlying },
    compute: ({ fuel, isFlying }) => isFlying && fuel < LOW_FUEL,
});
const playAlarmSoundWhenInDanger = createReaction({
    watch: isInDanger,
    when: true,
    react: () => sfx.play(ALARM),
});
```

A reaction or a watcher reads what it watches as soon as it's made, so a
computed value it watches stops being lazy, and computes then.

A computed object can't be watched itself, since it may change in place and
still be `===` to itself. Watch its `version` instead. That's a number that
rises whenever the object may have changed. Reading it brings the value up
to date first:

```ts
const layOutWhenCellsChange = createReaction({
    watch: () => cells.version,
    react: () => layOut(cells()),
});
```

An object updated in place can't be compared with what it was, so its
version rises every time it's computed again.

## The Four Rules of Change Detection

All three tools follow four rules. Each one has consequences for how you
use them.

### A change is a difference between two reads

Two reads by the same tool that differ by `===` are one change, reported
by the later read. A tool has only its reads to compare. Four things
follow.

**A reaction never reacts to its first read.** A reaction or a watcher
reads its getters as it's made, and that first read is its starting point,
never a change. So a view made in the middle of a game doesn't play a
sound, or show an effect, for the state it starts in. Instead, the view
shows its first state itself, as it's made. When the starting state
should make a sound, such as a tune as a game begins, the view plays it
as it's made, and its reactions then respond only to changes after that:

```ts
// The view is made as the game starts, so it opens with the tune
if (bindings.phase() === 'playing') music.play(OPENING_TUNE);
```

**Call reactions and poll watchers on every step, unconditionally.** A
reaction skipped on some steps compares with an older read, and can miss a
change that came and went in between. Calling a reaction behind an `if`,
or after an early `return`, is the usual way this happens. If you really
mean to leave a gap, say why in a comment.

**Two rises between reads are one `increased`.** If a count goes from 3 to
5 between two reads, that's one change. When every occurrence matters, use
`previous` and `current`, as
[Several in one tick](#several-occurrences-in-one-tick) shows.

**Calling a reaction twice in a step is harmless.** The second call
doesn't find a change. Polling a watcher twice in a step is a mistake,
though: the second reading reports every value as unchanged.

::: info `NaN` is never equal to itself
Under `===`, `NaN` differs from every value, itself included. So a getter
that returns `NaN` reads as a change every time.
:::

### A computed value is always up to date

Reading a computed value returns what `compute` would return from the
current values, as [§](#a-computed-value-is-lazy) explains, however often
you read it.

### Equal reads mean the value hasn't changed

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

A version, which the model raises whenever a structure changes, works for
anything. A computed object has a version of its own, as
[Watching a computed value](#watching-a-computed-value) showed.

### A tool's getters are fixed when it's made

A tool reads a record or an array for its getters once, when it's made. So
these tools don't follow a list whose items come and go, such as enemies or
bullets. A count of what happened to them does that job, as
[the next section](#counts-moments-that-repeat) shows.
[Chapter 14](14-lists-and-switches.md) shows how to present such a list.

An array made with `map` over model objects keeps reading those same
objects, even if the model replaces them. To follow the model, read through
it on every call:

```ts
// Reads model.reels[i] on every call, so it follows a replaced reel
const reelPhases = model.reels.map((_, i) => () => model.reels[i].phase);
```

## Counts: Moments That Repeat

A phase reports a change only when it becomes something else. Some moments
aren't a change of state at all. A ship that fires is flying before it
fires, and still flying after, so its phase never changes. Fire twice in a
row, and every value that a view can read is the same as before.

For moments like these, the model keeps a
**[count](../appendices/b-glossary.md)**: a number that goes up by one each
time the moment happens. A view reacts each time it rises:

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

The model resets its counts for a new game. Going back to 0 isn't a rise,
so the reaction doesn't play a sound.

In [§](#try-shots-fired-count), a ship fires double shots, and two
reactions watch for them. One watches the ship's phase. The phase is still
`'firing'` from the first shot of each pair when the second is fired, so
that reaction misses the second shot. The other watches the count, and
detects every shot, even two in one tick, as
[Several in one tick](#several-occurrences-in-one-tick) shows. Click, or press Space,
to fire faster.

<TryIt example="shots-fired-count" file="views/shot-reactions-view.ts" />

The model's count records how many times something has happened, in its
own terms,
and each view decides which rises matter to it. That makes a count the
model's half of a consumer-defined event, an idea
[Chapter 10](10-why-views-poll.md) compares with events and signals.

### Finding the moment for a sound or effect

A sound or an effect belongs to a moment, such as a shot fired, the player
dying, or a coin collected. The view has to find that moment in the state
it polls:

| The moment | The model exposes | The view acts when |
| --- | --- | --- |
| A state begins, such as dying, or a stage cleared | A phase or a flag | It changes to that value |
| Something that can repeat, such as a shot or a coin | A count | It rises (`increased`) |
| Several at once, such as rocks breaking in one tick | A count, and the last one's details | It rises, once for the tick |

Most moments change a phase, such as the ship going from flying to dying,
so most don't need anything new in the model. A count is for the rest.

### Several occurrences in one tick

Two shots fired in the same [tick](../appendices/b-glossary.md) raise the
count by two, and the reaction detects one rise. When every one matters,
use the two values that `react` receives:

```ts
const playShotSoundOnEachShot = createReaction({
    watch: bindings.shotsFired,
    when: increased,
    react: (shots, previous) => {
        for (let i = previous; i < shots; i++) sfx.play(SHOT);
    },
});
```

### Details of the last occurrence

Sometimes the effect depends on what happened, not only that it did. A big
rock breaking should sound deeper than a small one. So beside the count,
the model keeps the last one's details, such as `lastBrokenRockSize`, and
the view reads them when the count rises. If several rocks break in one
tick, the view detects one break, with the last rock's size.

### Two changes, one moment

Sometimes one moment changes two values in the same tick. Suppose a ship
that comes back also gets a full tank, in the tick its phase returns to
playing. A view that played a respawn sound for the phase, and a refuel
sound for the fuel, would play two sounds for one moment. The surest fix is
for the model to count the moment itself, such as `fuelTanksDestroyed`, so
that the view plays the refuel only when that count rises. Otherwise, watch
the two values together with a
[watcher](#watchers-what-changed-for-logic-in-a-step), and play one sound.

### Things removed in the tick they finish

Suppose a rock breaks, and the model removes it in the same tick. The
rock's own view never shows the break, because by the next refresh the rock
is gone, and its view with it. So the model counts the breaks, and a view
that outlasts the rocks watches the count.

## Where to Poll for Changes

A read reports the state as it is at that moment. So read where the state
you watch is final for the frame. In MVT, the order of each tick decides
where that is:

- **In a view's refresh step,** all state is final, so watch anything.
- **In a view's update step,** which
  [Chapter 11](11-presentation-state.md#watching-for-a-change-in-update)
  introduces, less of the state is final. That chapter says what you can
  watch there.
- **In a model,** the state isn't final while `update` runs. A model
  that watches should poll right after the changes it watches, at a point
  chosen on purpose.

For example, a game model might poll a watcher of its boss's phase after
the boss has moved and the shots have landed:

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

Change detection is worth using only for some state. It helps to sort
state into three kinds, by how often it changes:

- **Continuous state** changes on most frames, such as a moving object's
  position. A view just reads it. Comparing it with the last read would
  take more time than it saves, since it has nearly always changed.
- **Static state** never changes while the game runs, such as a tile size.
  A view reads it once, as a fixed value
  ([Chapter 8](08-bindings.md#fixed-values-and-getters)).
- **Discrete state** changes now and then, such as a score or a phase.
  This is where change detection is worth using: wherever a change sets
  off slow work, or work that must happen once.

| Your situation | Approach |
| --- | --- |
| Continuous state, or one value that's quick to use as it is | Read it every frame, without a tool |
| Discrete state, with quick work, such as a text label | A computed value, or comparing by hand |
| Discrete state, with slow work, such as a rebuild | A computed value or a watcher. Without one, the work runs every frame |
| A sound or an effect at one moment, such as a ship exploding | A reaction |
| The same, for each of a fixed set, such as three reels | A reaction, with an array |
| Checks mixed in with other logic in a step, with early returns | A watcher |
| A structure rebuilt on one transition that your code already handles | Rebuild it in that code |
| Smooth change over time, such as a counter that rolls up | [Presentation state](11-presentation-state.md), advanced in the view's update step |

The test is simple. If detecting a change takes longer than doing the
work, just do the work.

## Common Mistakes

### A sound that sometimes doesn't play

A sound sometimes doesn't play, or plays a frame late. The reaction sits
behind an `if`, or after an early `return`, so when it does run, it
compares with an older read. Call every reaction, and poll every watcher,
on every step.

### An opening tune that never plays

The opening tune never plays, or the first phase's texture is never set.
A reaction's first read is its starting point, not a change, so it never
fires for the state the view starts in. Show, or play, the starting state
as the view is made.

### A tool that throws as it reads its getter

A reaction, watcher or computed value throws an error when it reads its
getter. The getter returns an object or an array, such as
`model.enemies`, which looks natural to watch. Watch a primitive that
changes with it instead, such as its length, or a version.

### A change on a grid that goes unseen

A view watches the number of things on a grid, and misses a thing that
changes its kind. The narrow value stayed the same while the structure
changed. Watch a version that the model raises on every change to the
grid.

### A second shot that doesn't play a sound

The second shot in a row doesn't play a sound. The view watches the ship's
phase, which didn't change. Have the model count the shots, and react
when the count rises.

### A watcher that reports the wrong values

A watcher's values are wrong, and in development it throws. Its reading
was kept past the next poll, which reuses it. Copy out what you need in
the step that polled.

## Summary

Change detection keeps a view fast where a rare change sets off slow
work. Each tool reads its getters when you call or poll it, and compares
with its last read using `===`. A reaction acts on a change, a watcher
reports what changed,
and a computed value works a value out again only when what it watches
changes. A change is a difference between two reads, so a reaction never
reacts to its first read, and must be called on every step. Getters return
primitives, and a version stands in for a structure. A moment that isn't a
change of state becomes one when the model counts it, with the last one's
details beside the count when the effect needs them. The consumer decides
what matters, and the model doesn't send events.
