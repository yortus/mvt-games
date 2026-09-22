# Deriving Values

> `watch` reports *what changed*; `derive` reports *the value those changes
> produce*. The `derive()` helper builds a memoised structure that recomputes
> only when its triggers change, updating in place to stay off the hot path.

**Previous:** [Change Detection](change-detection.md)
**Related:** [Why Polling](why-polling.md), [Change Detection](change-detection.md), [Events and Signals](events-and-signals.md), [Hot Paths](../avoiding-pitfalls/hot-paths.md)

---

*Assumes familiarity with [Change Detection](change-detection.md) and the `watch()` helper.*

## The Problem

Some views and models need a *derived structure* - a value computed from other
state that is read every frame but only changes occasionally. A dense grid
built from a sparse list of entities, an ordered subset of a collection, a
histogram of counts. Rebuilding such a structure every frame is wasteful;
rebuilding it only when its inputs change is the goal.

[Change Detection](change-detection.md) with `watch()` gets you halfway: it
tells you *when* to rebuild. But it leaves the value itself, its storage, and
its first-time construction as ad-hoc code at each call site. `derive()`
standardises that pattern.

## `watch` and `derive` Are Duals

The two helpers are siblings, not substitutes:

| | Runs its callback | Produces | Best for |
| --- | --- | --- | --- |
| `watch()` | every poll | per-key change flags | side effects gated on change (set a tint, redraw) |
| `derive()` | only on a trigger change | one memoised value | a reusable derived structure that is read |

`derive()` is built on `watch()`: internally it watches a set of primitive
triggers and reruns your compute function only when one of them changes.

## The `derive()` Helper

`derive()` takes three things: the `watch` triggers, an `initial` value, and a
`compute` reducer. `poll()` returns the current value, recomputing it only when
a trigger changed:

```ts
const occupancy = derive({
    watch: {
        rev: () => model.gridRevision,
        rows: () => model.rows,
        cols: () => model.cols,
    },
    initial: new Uint8Array(0),
    compute(buffer, watched) {
        const cols = watched.cols.value;
        const size = watched.rows.value * cols;
        if (buffer.length !== size) buffer = new Uint8Array(size); // resize: fresh
        else buffer.fill(0);                                        // reuse in place
        const count = model.entityCount;
        for (let i = 0; i < count; i++) {
            const e = model.getEntity(i);
            buffer[e.row * cols + e.col] = KIND_CODES[e.kind];
        }
        return buffer;
    },
});

function refresh(): void {
    const grid = occupancy.poll();   // recomputed only when a trigger changed
    // ...render the grid...
}
```

The naming reuses the `watch` vocabulary: `watch` declares the triggers,
`watched` is the readings your `compute` receives.

| Field | Role |
| --- | --- |
| `watch` | Record of primitive getters. A change in any recomputes the value. |
| `initial` | The starting value, also passed as `previous` on the first computation. |
| `compute(previous, watched)` | Produces the current value. Mutate `previous` in place and return it, or return a fresh value. |

`poll()` returns the value; `changed` reports whether the most recent `poll()`
recomputed - useful when a downstream step should react only on a rebuild.

::: info Project convention
`derive()` is a helper specific to this project, layered on `watch()`. The
underlying idea - memoise a value and rebuild it only when its inputs change -
can be implemented however suits your codebase.
:::

## First-Poll Behaviour

On the first `poll()`, every trigger reports `changed`, so `compute` runs once
with `previous === initial`. The reducer treats an empty seed exactly like any
later update, so no separate construction path is needed.

## In-Place vs Fresh

Because `compute` runs off the hot path (only on a trigger change), it may
allocate when it must. Prefer mutating `previous` in place for large or
frequently-rebuilt structures, and return a fresh value only when you have to
(for example, when a buffer must be resized). The example above does both:
`fill(0)` on the common path, a new `Uint8Array` on a resize.

## Structure-to-Structure: The Revision Trigger

Triggers must be primitive `Watchable` values, so you cannot watch an array or
object directly (see the [Watchable restriction](change-detection.md#the-watchable-type-restriction)).
When a derivation depends on a structure that mutates *in place* - its
reference never changes - the model must expose a primitive signal instead: a
**revision counter** bumped on every content change.

```ts
// In the model:
let gridRevision = 0;
function moveEntity(/* ... */) { /* mutate */ gridRevision++; }
// get gridRevision() { return gridRevision; }
```

The derivation watches `gridRevision`; the heavy payload (the entity list) is
read from the closure inside `compute`. Watching `list.length` instead is a bug
magnet - an entity changing *kind* would not fire it. A revision is the honest
signal, and one counter covers both in-place mutation and wholesale
replacement.

Separating the two roles is the key idea: a value can be an *input to the
computation* (read in `compute`) without being a *trigger for recomputation*
(declared in `watch`).

## When Not to Use `derive`

| Situation | Use instead |
| --- | --- |
| A single primitive value (a score, a phase) | `watch()` - `derive` adds no value for one scalar |
| A side effect on change (set a tint, redraw a shape) | `watch()` - `derive` returns a value, it does not run effects |
| Continuous per-frame change (a smoothed counter, eased position) | A view's `update(deltaMs)` - that is time-driven presentation state |
| A structure rebuilt only on an explicit transition, not polled | Build it imperatively in the transition handler |

The rule of thumb: reach for `derive()` when the result is a *structure* or an
*expensive aggregate* that is *read every frame* but *changes rarely*.

## Live Demo

The **Derive - Structure Transforms** demo in the demos gallery shows one
churning model feeding three derivations - a sparse-to-dense occupancy grid, a
filtered and sorted active list, and a per-kind histogram. Each panel tallies
how often its structure recomputes, making the gating visible: the grid
recomputes on every move while the histogram sits still, because they watch
different triggers.

---

**Next:** [Events and Signals](events-and-signals.md)
