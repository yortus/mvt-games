# Hot Paths

> Code that runs every tick is on a hot path: every model's `update`,
> every view's `update` and `refresh`, and everything they call. A few
> habits keep it fast. Don't allocate in it, loop with an index, do only
> the work that the frame needs, and do slow work only when the values it
> depends on change. The habits that matter most can make a line tens of
> times faster, and others don't make any difference in today's engines,
> so this chapter says which is which.

**Related:** [Why Performance Matters](23-why-performance-matters.md) ·
[Noticing Changes](09-noticing-changes.md) ·
[The Tick](05-the-tick.md) ·
[MVT on One Page](../appendices/a-mvt-on-one-page.md#hot-path-rules) ·
[Measurements](../appendices/c-measurements.md#the-hot-path-rules)

Here's a refresh step for a grid of tiles. It's short, and it reads well:

```ts
function refresh(): void {
    const dug = tiles.filter((tile) => tile.isDug);
    for (const tile of dug) {
        const sprite = spritesByKey.get(`${tile.row},${tile.col}`);
        if (sprite) sprite.alpha = 0;
    }
}
```

Every frame, it builds a new array, a new closure, and a new string for
every dug tile. Each of those is garbage a moment later. On a 20 by 20
grid that's a few hundred objects a frame, and the engine will pause the
game to clean them up. It also hashes each string to find its sprite,
which is slower than finding the sprite by number.

This code isn't wrong in itself. It's wrong for where it runs.

In [§](#try-dug-tiles-refresh), that refresh hides the dug tiles of a much
bigger field, about 17,000 tiles, as diggers wander through it. Once the
meter has warmed up, watch the time climb as more tiles are dug. Then
press View code, and in `main.ts` set `ALLOCATE_EVERY_TICK` to `false`.
The view switches to an index loop over sprites found by number, and its
time drops close to zero.

<TryIt example="dug-tiles-refresh" file="main.ts" />

## Code That Runs on a Hot Path

A [hot path](../appendices/b-glossary.md) is any code that runs every
tick. In MVT, that's:

- **A model's `update(deltaMs)`,** which runs every tick
  ([Chapter 5](05-the-tick.md)).
- **A view's `refresh()`,** which runs every tick, after the models have
  updated.
- **A view's `update(deltaMs)`,** for a view with
  [presentation state](11-presentation-state.md).
- **Everything those call:** helpers, query bindings, and child models'
  `update`.

Code that runs when something is built, when the player presses a key, or
when something rare happens is not on a hot path. It doesn't need any of
this chapter. Write it as clearly as you can.

## The Hot-Path Rules

Four rules keep a hot path fast. They're listed with the others in
[Appendix A](../appendices/a-mvt-on-one-page.md#hot-path-rules), named
H-alloc, H-loops, H-cost and H-change. They aren't laws. Apply them where
the work really does happen every tick, and keep code clear everywhere
else.

### H-alloc: don't allocate every tick

Creating an object, array, string or function is fast at the moment it
happens. The performance cost comes later, when the engine pauses to
reclaim it.
[Chapter 23](23-why-performance-matters.md) shows how that turns into
stutter. On a hot path, these are the common sources:

| Avoid | Prefer |
| --- | --- |
| Template-string keys, such as `` `${row},${col}` `` | A number worked out from the parts: `row * cols + col` |
| `array.map()`, `.filter()`, `.slice()`, `[...array]` | An index loop that writes into an array made once |
| `Object.keys()`, `.values()` and `.entries()` | Reading the properties directly, or a list of keys made once |
| A new closure each call, such as `forEach((a) => ...)` | A function defined once, outside the hot path |
| Returning a `[col, row]` tuple | Writing into a result object made once |

### H-loops: loop with an index, over structures made once

An index loop doesn't allocate anything, in any engine:

```ts
function update(deltaMs: number): void {
    for (let i = 0; i < asteroids.length; i++) {
        asteroids[i].update(deltaMs);
    }
}
```

The same loop written with `forEach` makes a new closure every tick:

```ts
function update(deltaMs: number): void {
    asteroids.forEach((asteroid) => asteroid.update(deltaMs));
}
```

A `for...of` loop creates an iterator object, at least in principle. V8,
the engine in Chrome and Node.js, optimises that object away, so in V8 it
doesn't take any extra time. Other engines haven't been measured. The index loop
is never slower, so it's the safe habit.

Make each structure that a hot path needs when the model or view is
built, and reuse it. An array of results, a scratch object for a
calculation, a pool of sprites: each can be made once and refilled every
tick.

[§](#try-sprite-pool) shows how much time a pool of sprites saves. A
fountain throws a few thousand sparks, and its view makes a new sprite for
every spark, every tick, and throws the old ones away. Press View code,
and in `main.ts` set `USE_POOL` to `true`. The view then reuses sprites
that it made once, and the meter shows the difference.

<TryIt example="sprite-pool" file="main.ts" />

### H-cost: do only the work that the frame needs

Prefer a lookup that takes the same time however big the collection, such
as an index into an array, to a search through it. Don't work out the
same thing twice in one tick, and don't work it out every tick if it
hasn't changed. That last one is common enough to have a
rule of its own.

Before you redraw a shape every tick, check whether drawing it once, then
scaling, tinting or resizing it, would do. A burst that grows and fades
can be one circle, drawn at full size, then scaled and faded. A bar that
fills can be a white sprite that's resized and tinted. Changing a
property is far faster than drawing again, and it doesn't make any
garbage.

### H-change: do slow work only on a change

Some work is slow, but only needs doing again when one value changes:
redrawing a maze, laying out a block of text, rebuilding a list.
Comparing that value with the last tick's is fast. So check it every
tick, and do the work only when it changed.

[Chapter 9](09-noticing-changes.md) teaches the tools for this. Here's
how one looks on a hot path. This view redraws its maze only when the
level changes:

```ts
drawMaze(mazeGraphics, bindings.level());

const redrawMazeWhenLevelChanges = createReaction({
    watch: bindings.level,
    react: (level) => drawMaze(mazeGraphics, level),
});

function refresh(): void {
    redrawMazeWhenLevelChanges();
}
```

The maze is drawn once as the view is built, because a reaction never
reacts to its first read. After that, the reaction reads the level every
tick, and calls `drawMaze` only on a tick when it differs.

Text is the most common case. Building a string allocates, so a label
that shows the score should build a new string only when the score
changes. A computed value
([Chapter 9](09-noticing-changes.md#computed-values-a-value-worked-out-from-others))
does that for you.

Change detection takes a little time every tick, so use it where the
work that it skips is slow. Text, drawing and changes to the scene are
worth it. A little arithmetic usually isn't. Checking each of a few
numbers for a change takes longer than adding them up again. A sum over a
thousand numbers can be different. Suppose the model keeps a version: a
number that rises whenever any of them changes. Then checking that one
number, and keeping the sum until it rises, is many times faster than
adding them all up again, as the table below shows.

::: info In this book
`createReaction` and `createComputed` come from `@mvtjs/utils`. A Pixi
`Text` also skips the work when it receives the same string again, but
checking for a change first is faster still, and it saves building the
string.
:::

## A Quick Test for Each Line

Ask this of each line in a hot path:

> Does this line make a new object, array, string or function, and does
> it run every tick?

If both are true, find a way to make it once. If it runs only when
something is built, or on a rare event, leave it as it is.

## How Much Each Rule Matters

The rules differ in how much they matter. Each pair below does the same
work two ways, over 1000 game objects, measured in V8. The sizes are
rough, and come from
[Appendix C](../appendices/c-measurements.md#the-hot-path-rules), which
has the exact figures.

| The pattern to avoid | Compared with the one to prefer |
| --- | --- |
| `Object.values()` for each object | About 30 times slower, and about 80 KB of garbage a frame |
| A template-string key into a `Map` | About 12 times slower, and about 48 KB of garbage a frame |
| `.filter().map()` | About 4 times slower, and about 24 KB of garbage a frame |
| Summing 1000 numbers every frame, rather than when a version changes | About 18 times slower, though still under half a microsecond |
| A `Map` with number keys, instead of an array | About 1.3 times slower, and no garbage |
| `forEach` with a new closure | No slower, and 56 bytes of garbage a frame |
| `for...of` over an array | No difference in V8: no slower, and no garbage |
| Returning a `[col, row]` tuple | No measurable difference in V8: the engine never builds the array |

Building strings, `Object.values()` and the array methods take the most
time. They run several times slower, and leave tens of kilobytes of
garbage a frame. `for...of` and a returned tuple don't take any extra time
in V8, because
the engine optimises the iterator and the array away. They stay in the
rules because other engines may not, and the alternatives are never
slower.

## Common Mistakes

### Setup code rewritten for speed it doesn't need

A setup function, a key handler or a level loader is rewritten with index
loops and scratch arrays, and it's harder to read than before. These run
once, or when the player acts, so the rewrite doesn't make the game any
faster. Keep them
clear, and save the rules for code that runs every tick.

### Code rewritten for speed that doesn't run any faster

Code is rewritten because it looks slow, and the game doesn't run any
faster.
Often the time was going somewhere else entirely. Measure first, as
[Appendix D](../appendices/d-measuring-performance.md) describes, and
change what the measurement points to.

### An index loop that still makes a closure every tick

An index loop is used, but it calls a helper that takes a callback,
written inline: `findNearest(enemies, (e) => e.isAlive)`. The closure is
made every tick. Define the callback once, outside the hot path.

### Hidden views that still take time every tick

A view that isn't shown still has its refresh step called every tick, and
in a large scene a group of inactive views can take more time than the
active ones. Hiding a container doesn't skip anything by itself. The view
above them should skip their steps while they're inactive, as
[Chapter 7](07-views.md#updating-and-refreshing-views-with-the-mvtjs-libraries)
shows with `SKIP_DESCENDANTS`.

## Summary

A hot path is code that runs every tick: models' and views' `update`,
views' `refresh`, and everything they call. Four rules keep it fast.
H-alloc: don't make new objects, arrays, strings or closures every tick.
H-loops: loop with an index, over structures made once. H-cost: do only
the work that the frame needs, with lookups by number rather than by
string. H-change: do slow work, such as drawing or building text, only
when the values it depends on change.

The rules differ a lot in how much they matter. Building strings and
arrays every tick takes the most time. Some patterns don't take any extra
time in V8, but stay in the rules because they're never slower. Code that
isn't on a hot path doesn't need the rules at all, so keep it clear.
