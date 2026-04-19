# Hot Paths

> Any code invoked every tick is on a hot path. `update()` in models and
> `refresh()` in views typically run 60 times per second or faster. Avoid
> unnecessary heap allocations and heavy computations in these functions.

**Related:** [Models (Learn)](../learn/models.md) · [Views (Learn)](../learn/views.md) ·
[Change Detection](change-detection.md)

---

*Assumes familiarity with [The Game Loop](../learn/game-loop.md).*

## What Counts as a Hot Path

In MVT, the hot-path roots are:

- **`update(deltaMs)`** in models - called every frame by the ticker.
- **`refresh()`** in views - called every frame by the renderer.
- **Everything they call** - helpers, binding accessors, child `update()` and
  `refresh()` calls.

Code that runs only at construction time, on user input, or in response to
rare events is not on the hot path and does not need these considerations.

## Patterns to Avoid

These guidelines are not absolute rules - apply them where the allocation or
computation is genuinely per-tick. The goal is to avoid unnecessary work on
every frame while keeping code clear.

| Avoid                                              | Prefer                                          | Why                                       |
| -------------------------------------------------- | ----------------------------------------------- | ----------------------------------------- |
| `array.map()`, `.filter()`, `.slice()`, `[...arr]` | Index-based `for` loop, mutate in place         | Each call allocates a new array           |
| `for...of` on arrays                               | `for (let i = 0; i < arr.length; i++)`          | May allocate an iterator object           |
| Template-string keys (`` `${r},${c}` ``)           | Arithmetic encoding (`r * cols + c`)            | Allocates a new string every call         |
| `Map<string, T>` / `Set<string>` for grids         | Flat `T[]` indexed by `row * cols + col`        | Does hashing and heap traversal      |
| Inline closures in hot functions                   | Hoisted functions or pre-bound references       | Each call allocates a new function object |
| `Object.keys()` / `.values()` / `.entries()`       | Direct property access or pre-cached key lists  | Each call allocates a new array           |
| Redundant recomputation                            | Cache previous values, early-out when unchanged | Unnecessary work for same result   |
| Returning `[col, row]` tuples                      | Out-parameters or pre-allocated result objects  | Avoids per-call array allocation          |

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

### Avoiding repeated traversal

If a value does not change every frame, compute it once and cache the result
instead of recomputing it in every `refresh()` call:

```ts
// Good - recompute only when the score list changes, read for free each frame
const watcher = watch({
    scoreCount: () => bindings.getScores().length,
});

let totalScore = 0;

function updateTotalScore() {
    totalScore = bindings.getScores().reduce((sum, score) => sum + score);
}

function refresh(): void {
    const w = watcher.poll();
    if (w.scoreCount.changed) updateTotalScore();
    label.text = String(totalScore);
}
```

```ts
// Avoid in hot paths - traverses the entire array every frame
function refresh(): void {
    let total = 0;
    for (let i = 0; i < scores.length; i++) {
        total += scores[i];
    }
    label.text = String(total);
}
```

### Text updates in `refresh()`

String assignment (`label.text = String(score)`) allocates a string on every
call. For text that changes every frame, this is unavoidable. For text that
changes rarely, use change detection to skip the update:

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

See [Change Detection](change-detection.md) for more on this pattern.
