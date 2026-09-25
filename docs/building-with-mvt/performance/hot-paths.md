# Hot Paths

> Any code invoked every tick is on a hot path. `update()` in models and
> `refresh()` in views typically run 60 times per second or faster. Avoid
> unnecessary heap allocations and heavy computations in these functions.

**Related:** [Why Performance Matters](why-performance-matters.md) · [Models (Learn)](../simulating-the-world/models.md) · [Views (Learn)](../presenting-the-world/views.md) ·
[Change Detection](../reacting-to-changes/change-detection.md) · [Performance Measurements](measurements.md) ·
[Benchmarking Methods](benchmarking-methods.md)

---

*Assumes familiarity with [The Game Loop](../the-game-loop.md).*

## What Counts as a Hot Path

In MVT, the hot-path roots are:

- **`update(deltaMs)`** in models - called every frame by the ticker.
- **`refresh()`** in views - called every frame, after the models update. In
  this project, that is every `onRefresh` method, run by `refreshScene`.
- **`update(deltaMs)`** in views with presentation state - in this project,
  every `onUpdate` method, run by `updateScene`.
- **Everything they call** - helpers, binding accessors, and child model
  `update()` calls.

Code that runs only at construction time, on user input, or in response to
rare events is not on the hot path and does not need these considerations.

## Patterns to Avoid

These guidelines are not absolute rules - apply them where the allocation or
computation is genuinely per-tick. The goal is to avoid unnecessary work on
every frame while keeping code clear.

| Avoid | Prefer | Why | [Measured](measurements.md#the-hot-path-rules) in V8, per frame over 1000 game objects |
| --- | --- | --- | --- |
| `array.map()`, `.filter()`, `.slice()`, `[...arr]` | Index-based `for` loop, mutate in place | Each call allocates a new array | `.filter().map()`: 4x slower, 24 KB of garbage |
| `for...of` on arrays | `for (let i = 0; i < arr.length; i++)` | May allocate an iterator object | No difference: no iterator is allocated |
| Template-string keys (`` `${r},${c}` ``) | Arithmetic encoding (`r * cols + c`) | Allocates a new string every call | 16x slower, 48 KB of garbage |
| `Map<string, T>` / `Set<string>` for grids | Flat `T[]` indexed by `row * cols + col` | Does hashing and heap traversal | A `Map` with numeric keys: 2.4x slower, no garbage |
| Inline closures in hot functions | Hoisted functions or pre-bound references | Each call allocates a new function object | `forEach` with a new closure: no slower, 56 bytes |
| `Object.keys()` / `.values()` / `.entries()` | Direct property access or pre-cached key lists | Each call allocates a new array | `Object.values()`: 44x slower, 80 KB of garbage |
| Redundant recomputation | Cache previous values, early-out when unchanged | Unnecessary work for same result | Summing 1000 numbers every frame: 20x slower, though still cheap |
| Returning `[col, row]` tuples | Out-parameters or pre-allocated result objects | Avoids per-call array allocation | 1.2x slower, no garbage: the engine removes the array |

The last column comes from the `hot-path-rules` benchmark, which writes each
rule's two versions of the same work and measures both, in Node.js's V8
engine on one machine. Other engines may optimise differently, so treat the
ratios as a guide rather than a guarantee. The full numbers are in
[Performance Measurements - The Hot Path Rules](measurements.md#the-hot-path-rules).

The rules differ a great deal in what they are worth. Building strings, and
the arrays that `Object.keys()` and the array methods return, cost the most:
they run several times slower, and leave tens of kilobytes of garbage per frame
at 1000 game objects. In V8, `for...of` over an array and a returned `[col, row]` tuple cost
nothing extra, because the engine optimises the iterator and the array away.
They stay in the table because other engines have not been measured and may
not optimise them the same way, while the alternatives were no slower in V8.

## Quick Litmus Test

> "Does this line allocate a new object, array, string, or closure, and is
> it called every frame?"

If yes, consider refactoring. If the allocation happens at construction time
or on a rare event, it is fine.

## Examples

### Iterating a child model list

```ts
// Good - index-based loop, no allocation
update(deltaMs) {
    for (let i = 0; i < asteroids.length; i++) {
        asteroids[i].update(deltaMs);
    }
}
```

```ts
// Avoid in hot paths - allocates an inline closure each frame
update(deltaMs) {
    asteroids.forEach(a => a.update(deltaMs));
}
```

### Grid coordinate lookups

```ts
// Good - arithmetic key, no string allocation
const index = row * cols + col;
const tile = tiles[index];
```

```ts
// Avoid in hot paths - allocates a string and does hash lookup each frame
const key = `${row},${col}`;
const tile = tileMap.get(key);
```

### Avoiding repeated work

Some work is expensive but only needs redoing when a particular value changes:
redrawing a maze, laying out a block of text, rebuilding a list. Comparing that
value with last frame's is cheap, so check it and skip the work when it has not
changed:

```ts
// Good - redraw the maze only when the level changes
const watcher = watch({
    level: () => bindings.getLevel(),
});

function refresh(): void {
    const w = watcher.poll();
    if (w.level.changed) drawMaze(mazeGraphics, w.level.value);
}
```

```ts
// Avoid in hot paths - clears and redraws every wall, every frame
function refresh(): void {
    drawMaze(mazeGraphics, bindings.getLevel());
}
```

`watch()` reports a change on its first poll, so the maze is drawn on the first
frame too. See [Change Detection](../reacting-to-changes/change-detection.md).

### Text updates in `refresh()`

String assignment (`label.text = String(score)`) allocates a string on every
call. For continuous state (text that changes every frame), this is
unavoidable. For discrete state (text that changes rarely), use change
detection to skip the update:

```ts
let prevScore = -1;

function refresh(): void {
    const score = bindings.getScore();
    if (score !== prevScore) {
        prevScore = score;
        label.text = String(score);
    }
}
```

See [Change Detection](../reacting-to-changes/change-detection.md) for more on this pattern.
