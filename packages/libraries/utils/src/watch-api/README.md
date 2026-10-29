# Watching for Changes

> Three tools for noticing when a value changes: `watch`, `createReaction`
> and `createComputed`. They share one idea: you give them functions that
> read values, they read them each time you ask, and they tell you what
> changed since the last read. This guide shows each tool, with examples,
> and the rules all three follow.

---

## The idea: getters, read when you ask

Each tool watches **getters**: functions that return a value, such as a
view's query binding `bindings.phase`, or `() => model.score`. A getter must
return a primitive (a string, number, `bigint`, boolean, symbol, `null` or
`undefined`). Two reads are compared with `===`.

Nothing is pushed to you. A tool reads its getters only when you ask: when you
poll a watcher, call a reaction, or read a computed value. So you decide when
the reads happen, usually once in each step of your game loop.

| When you want | Use |
| --- | --- |
| A sound or an effect at one moment, such as a ship exploding | `createReaction` |
| The same, for each of a fixed set of things, such as three reels | `createReaction`, with an array |
| A value that's costly to work out, or a label for a JSX prop | `createComputed` |
| A structure kept up to date from other state | `createComputed`, with a default for its initial value |
| Checks mixed in with other logic in a step, with early returns | `watch` |
| Smooth change over time, such as an eased position | None of them: a view's update step |
| One cheap value, read every frame and used as it is | None of them: just read it |

## `createReaction`: do something when a value changes

A reaction is a function that you call on every step. Each call reads what it
watches, and runs `react` if the value changed in a way that `when` accepts.

```ts
const playDeath = createReaction({
    watch: bindings.phase,
    when: 'dying',
    react: () => sfx.play(SHIP_EXPLODE),
});

// In refresh, on every step:
playDeath();
```

`when` is a value, meaning "changed to this value", or a condition. Leave it
out to react to every change. The conditions are `increased`, `decreased` and
`changedFrom(value)`. For anything else, write your own:

```ts
const playLever = createReaction({
    watch: bindings.spins,
    when: increased,
    react: () => sfx.play(LEVER),
});
const playTick = createReaction({
    watch: bindings.seconds,
    when: (seconds, previous) => seconds < previous && seconds <= 10,
    react: () => sfx.play(TICK),
});
```

`react` is given the value now and the value before, so you can see what
happened between two reads:

```ts
const playShots = createReaction({
    watch: () => model.shotsFired,
    when: increased,
    react: (shots, previous) => {
        for (let i = previous; i < shots; i++) sfx.play(SHOT);
    },
});
```

Give it an array of getters, and it reacts to each one separately. Each
getter has its own memory, and `react` is told which one changed by its
index. Every getter in the array must return the same type, since they share
`when`.

```ts
const playStops = createReaction({
    watch: model.reels.map((reel) => () => reel.phase),
    when: 'settling',
    react: (_phase, _previous, index) => sfx.play(REEL_STOPS[index]),
});
```

To react to several values together, work out one value from them with
`createComputed`, and react to that.

## `createComputed`: a value worked out from others

A computed value works out its value on its first read, and again only when
something it watches has changed. Read it as often as you like.

```tsx
const scoreText = createComputed({
    watch: bindings.score,
    compute: (score) => `SCORE ${score}`,
});

<text text={scoreText} />
```

To work from several values, give it a record. `compute` gets their values by
name:

```ts
const grid = createComputed({
    watch: { cols: bindings.cols, rows: bindings.rows },
    compute: ({ cols, rows }) => buildGrid(cols, rows),
});
```

It's **lazy**. It reads nothing until you first read it, so one you never
read costs nothing.

### Keeping an object up to date

To update an object in place, rather than make a new one each time, give
`compute` a second parameter with a default. The default makes the object on
the first compute. Every later compute is given the last result to update and
return. You don't need to write any types: the parameter takes its type from
its default.

```ts
const cells = createComputed({
    watch: bindings.size,
    compute: (size, cells = createCells()) => resize(cells, size),
});
```

### Reading state you don't watch

`compute` may read state that it doesn't watch, as long as something it does
watch changes whenever that state does. The usual case is a version: a
number that the model raises whenever its grid changes.

```ts
const occupied = createComputed({
    watch: () => model.gridVersion,
    compute: () => countOccupied(model.grid),
});
```

### Watching a computed value

A computed primitive, such as `scoreText`, is a getter like any other, so you
can watch it. A computed object can't be watched itself, since it may change
in place and still be `===` to itself. Watch its `version` instead, a number
that rises whenever the object may have changed:

```ts
const relayout = createReaction({
    watch: () => cells.version,
    react: () => layOut(cells()),
});
```

## `watch`: what changed, for logic in a step

A watcher is for code that checks for changes as it goes, mixed in with other
work. Poll it once in each step. The reading tells you, for each getter, its
`current` and `previous` values, whether it `changed`, and `changedTo(value)`
and `changedFrom(value)`. A number or a `bigint` also has `increased` and
`decreased`.

```ts
const watcher = watch({ phase: bindings.phase, lives: bindings.lives });

// In a step:
const w = watcher.poll();
if (w.phase.changedTo('dying')) sfx.play(SHIP_EXPLODE);
if (w.lives.decreased) flashLives();
```

Give it one getter, and the reading is that getter's own. Give it a record or
an array, and the reading has one for each getter, by name or by position,
and `anyChanged`, which says whether any of them changed.

A watcher reuses its reading on every poll. So use the reading in the step
that polled it, and copy out any values you want to keep. In development, a
reading used after the next poll throws, to tell you.

## The rules they all follow

**A change is a difference between two reads by the same tool.** That has a
few consequences:

- **Nothing reacts because it was made.** A watcher or a reaction reads its
  getters when it's made, as its starting point. So a view draws its first
  state itself, and a reaction never plays a sound just because the view
  appeared.
- **Call reactions and poll watchers on every step.** Skipped on some steps,
  a reaction compares with an older read. It can miss a change that came and
  went in between.
- **Two rises between reads are one `increased`.** When every occurrence
  matters, have the model count them, and react from `previous` to
  `current`, as `playShots` does above.
- **Calling a reaction twice in a step is harmless.** The second call sees no
  change.

**A computed value is always up to date.** Reading it gives what `compute`
would give from the values now.

**Equal reads mean nothing changed.** That's why getters must return
primitives: an object changed in place would stay equal to itself. To watch a
structure, watch a number that changes with it, such as a count or a version.
A getter that returns an object throws, in production too.

**What a tool watches is fixed when it's made.** A record or an array is read
for its getters once. So these tools don't follow a list whose items come and
go. An array made with `map` over model objects keeps reading those same
objects; `(_, i) => () => model.reels[i].phase` follows the model if it
replaces them.

**Where to read.** A read reports the state as it is at that moment. In a
view's refresh step, everything is final for the frame, so watch anything
there. In a model, poll right after the changes you watch.

## How it's built

| File | What it holds |
| --- | --- |
| [watch.ts](./watch.ts), [reaction.ts](./reaction.ts), [computed.ts](./computed.ts) | The three tools |
| [when-conditions.ts](./when-conditions.ts) | `increased`, `decreased` and `changedFrom` |
| [watched-getters.ts](./watched-getters.ts) | Turns what `watch` or `createComputed` was given (one getter, or a record or an array of them) into a `MutableWatched` for each getter |
| [error-checks/getter-checks.ts](./error-checks/getter-checks.ts) | The types that turn getters a tool can't use into a readable error on `watch` |
| [error-checks/reading-guard.ts](./error-checks/reading-guard.ts) | The development-only check that a reading isn't used after the next poll |
| [watched.ts](./watched.ts) | The types of a reading, and `MutableWatched`, the library's own writable copy of one for each watched getter, which all three tools are built on |

A value that hasn't changed costs a call of its getter and a comparison.
Nothing is written then, and a value is checked to be a primitive only when it
changes.
