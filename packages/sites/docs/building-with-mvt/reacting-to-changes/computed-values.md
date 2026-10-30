# Computed Values

> A computed value is worked out from other values, and worked out again only
> when one of those changes. This page shows how to make one, how to keep an
> object up to date with one, and how to watch one. It's lazy: it does nothing
> until you first read it.

**Previous:** [Change Detection](change-detection.md)
**Related:** [Change Detection](change-detection.md) -
[Hot Paths](../performance/hot-paths.md) -
[Declarative Views](../presenting-the-world/declarative-views.md) -
[Events and Signals](events-and-signals.md)

---

*Assumes you've read [Change Detection](change-detection.md), which
introduces getters and the rules that every change-detection tool follows.*

## Why Compute Only on a Change

Some of what a view shows is worked out from the model, such as the text
`SCORE 1200` from a score of 1200. Working it out on every frame is correct,
but a template string makes a new string each time. That's
[garbage](../performance/hot-paths.md) for the engine to collect, sixty times
a second, for text that changes only now and then. A **computed value** works
out its value once, and again only when what it depends on changes.

## Making One

`createComputed` takes what to watch, and a `compute` function that works out
the value from it. It returns a function. Call it to read the value, as
often as you like:

```ts
import { createComputed } from '@mvtjs/utils';

const scoreText = createComputed({
    watch: bindings.score,
    compute: (score) => `SCORE ${score}`,
});

scoreText(); // 'SCORE 1200', worked out on this first read
scoreText(); // the same string, not worked out again
```

Because a computed value is a function that returns a value, it's a getter.
So in a JSX view, you can pass it straight to a prop, which reads it every
frame:

```tsx
<text text={scoreText} />
```

In a view written in plain TypeScript, read it in the refresh step:

```ts
function refresh(): void {
    label.text = scoreText();
}
```

Often `compute` is a function you already have. Pass it in by name:

```ts
const zoomText = createComputed({ watch: bindings.zoom, compute: formatZoom });
const livesText = createComputed({ watch: bindings.lives, compute: String });
```

When the text depends on a value that changes more often than the text does,
watch the value as the text shows it. A distance shown in whole metres
changes its text only when the whole number does:

```ts
const distanceText = createComputed({
    watch: () => Math.floor(bindings.distance()),
    compute: (metres) => `${metres} m`,
});
```

## Working From Several Values

To work from several values, give `watch` a record of getters. `compute` is
given their values by name, and runs again when any of them changes:

```ts
const grid = createComputed({
    watch: { cols: bindings.cols, rows: bindings.rows },
    compute: ({ cols, rows }) => buildGrid(cols, rows),
});
```

A computed value doesn't take an array of getters. A record's names say what
each value is, where an array's positions don't.

## It's Lazy

A computed value reads nothing when it's made. It reads its getters and
computes on its first read. On each later read, it reads its getters again,
and computes again only if one of the values changed. Most libraries with
computed values work this way, such as Vue and MobX.

That has some useful consequences:

- **A computed value you never read costs nothing.** A label on a panel that
  stays hidden is never worked out.
- **Its getters needn't be readable when it's made.** It can watch state that
  a view sets up later in its construction.
- **You can read it anywhere,** any number of times, or only on some frames.
  Unlike a reaction, a computed value has no reason to be read on every step:
  it's always up to date when you read it.

Watching a computed value ends its laziness. A reaction or a watcher reads
what it watches when it's made, so a computed value it watches computes
then.

A computed value that reads itself while it computes throws an error.

## Keeping an Object Up to Date

To update an object in place, rather than make a new one on each change, give
`compute` a second parameter with a default. The default makes the object on
the first compute. Every later compute is given the last result, to update
and return:

```ts
const cells = createComputed({
    watch: bindings.size,
    compute: (size, cells = createCells()) => resize(cells, size),
});
```

You don't need to write a type for the second parameter. It takes its type
from its default.

## Reading State You Don't Watch

`compute` may read state that it doesn't watch, as long as something it does
watch changes whenever that state does. The usual case is a **version**: a
number that the model raises whenever a structure changes.

```ts
const occupied = createComputed({
    watch: () => model.gridVersion,
    compute: () => countOccupied(model.grid),
});
```

Here, `compute` reads the whole grid, but watches only its version. Watching
something narrower, such as the number of entities, would be a mistake: an
entity that changes its kind leaves the number the same, so the computed
value would miss the change.

## Watching a Computed Value

A computed value that gives a primitive, such as `scoreText`, is a getter
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

A computed object can't be watched itself, since it may change in place and
still be `===` to itself. Watch its `version` instead. That's a number that
rises whenever the object may have changed. Reading it brings the value up to
date first:

```ts
const layOutWhenCellsChange = createReaction({
    watch: () => cells.version,
    react: () => layOut(cells()),
});
```

A computed object rebuilt in place can't be compared with what it was, so
its version rises every time it's computed again.

## Counting Over a Fixed Set

To work out something over a fixed set of things, such as how many reels
have stopped, write a getter that loops, and watch that:

```ts
function countStoppedReels(): number {
    let count = 0;
    for (let i = 0; i < reels.length; i++) {
        if (reels[i].phase === 'stopped') count++;
    }
    return count;
}

const stoppedText = createComputed({
    watch: countStoppedReels,
    compute: (count) => `${count} of ${reels.length} stopped`,
});
```

A computed value with a getter for each reel would read every getter on every
read anyway, to know whether to compute again. So for a cheap count, it would
save nothing.

## When Not to Use One

| Situation | Instead |
| --- | --- |
| A cheap value, used as it is, such as a position | Read it every frame |
| Something that should happen at a moment, such as a sound | A [reaction](change-detection.md#reactions-do-something-when-a-value-changes) |
| A structure rebuilt only on one transition, which your code already handles | Rebuild it in that code |
| Smooth change over time, such as a counter that rolls up | [Presentation state](../adding-visual-polish/presentation-state.md), advanced in the view's update step |

---

**Next:** [Events and Signals](events-and-signals.md) - why MVT polls, rather
than pushing changes to views
