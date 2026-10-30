# `watch`, Reactions and Computed Values

| Field    | Value      |
| -------- | ---------- |
| Priority | medium     |
| Created  | 2026-10-25 |
| Updated  | 2026-10-30 |

## Description

Replace `watch(...).poll()` and `memoiseLast` in `@mvtjs/utils` with three tools that share one core:

- **`watch`**, the core: change detection for logic inside a step, polled once per step.
- **`createReaction`**: an effect that runs each time it sees a change, for independent moments such as sounds.
- **`createComputed`**: a value that computes on its first read, and again only when what it watches has changed.

```ts
const playExplosionSoundWhenDying = createReaction({
    watch: bindings.phase,
    when: 'dying',
    react: () => sound.play(SHIP_EXPLODE),
});
const playLeverSoundOnEachSpin = createReaction({ watch: bindings.spins, when: increased, react: () => sound.play(LEVER) });
const playStopSoundWhenEachReelSettles = createReaction({
    watch: model.reels.map((reel) => () => reel.phase),
    when: 'settling',
    react: (_phase, _previous, index) => sound.play(chooseReelStop(index)),
});

const scoreText = createComputed({ watch: bindings.score, compute: (score) => `SCORE ${score}` });
const grid = createComputed({ watch: { cols: bindings.cols, rows: bindings.rows }, compute: ({ cols, rows }) => buildGrid(cols, rows) });
const cells = createComputed({ watch: bindings.size, compute: (size, cells = createCells()) => resize(cells, size) });

const watcher = watch({ phase: bindings.phase, lives: bindings.lives });
// in a step:
const w = watcher.poll();
if (w.phase.changedTo('dying')) sound.play(SHIP_EXPLODE);
```

This task supersedes [008](../008-watch-builder-spike.md) (the `Watch()` builder spike) and
[078](../078-watch-without-polling.md) (a watch read without polling), both archived, and the `derive`
spike on the `derive-util` branch (deleted on 2026-10-29, after its coverage was checked). The design came out of one
long session on 2026-10-23 to 2026-10-25 that compared many alternatives, and a second on 2026-10-29 that settled
list handling and the shapes each tool takes; section [Settled Questions](#settled-questions) records what was ruled
out and why.

A working prototype, with tests, type checks and a demo, was built in a scratch lab outside the repo. Its source is
kept in [prototype.md](prototype.md). It is the starting point for the implementation, but it predates the decisions
of 2026-10-29: its opening note lists where it differs from the design below.

## The Design

### Getters

A watch reads getters, each of which must give a primitive, compared with `===`. A computed primitive is a getter
like any other. A computed object is not: watch its version, `() => cells.version`, and read the object itself when
that changes (see [`createComputed`](#createcomputed)). The three tools take the same getters, but each takes only
the shapes that fit what it does with them:

| Shape | `watch` | `createComputed` | `createReaction` |
| --- | --- | --- | --- |
| One value: a getter (`bindings.phase`, `scoreText`) | Its `Watched` | `compute(value)` | `react(current, previous)` |
| A record (`{ cols: bindings.cols, rows: bindings.rows }`) | A `Watched` for each key, and `anyChanged` | Together: one `compute(record)` when any value changed | Refused |
| A fixed array (`reels.map((reel) => () => reel.phase)`) | A `Watched` for each element, and `anyChanged`. Types may differ, typed by position | Refused: use a record | Each: `when` and `react` for each element that changed. Every element gives the same type |

`watch` hands back a reading for every getter, and the caller treats them together (`anyChanged`) or one at a time.
`createComputed` treats its getters together, so it takes a record, whose names read better than positions.
`createReaction` treats each getter separately, so it takes an array, whose index says which one changed. No shape
means "together" in one tool and "each" in another.

- **Primitives only,** all of them: `Watchable` is `string | number | bigint | boolean | symbol | null | undefined`. A
  getter that returns an object or an array throws, saying to watch a primitive, such as a count or a version, or to
  compute the value and watch that. Objects compared by reference are out of scope, frozen ones included (see
  [Settled Questions](#settled-questions)). The check is always on, in production too, and runs on the first read
  and on each change: a read equal to the last one is a value that already passed it, so steady reads cost nothing.
- **`===` throughout,** with no exception for `NaN`, so a watched `NaN` reads as a change every time. The docs mention
  that at most in a callout, as a surprise of its standard semantics.
- **Records and arrays are fixed at construction.** An array made with `map` over model objects keeps reading those
  objects, even if the model replaces them; `(_, i) => () => model.reels[i].phase` follows replacements. Neither sees
  a change of length: lists whose items come and go are out of scope (see [List Handling](#list-handling)).
- **Empty records and arrays.** An empty literal (`watch: []`, `watch: {}`) is a type error. An empty record also
  throws. An array that is empty at run time is allowed and does nothing: a reaction never runs, and a watcher's reading
  is empty, with `anyChanged` false. An array made from data can be empty legitimately, such as one reaction per extra
  life in a mode that has none, and throwing would make every such author special-case it.

### `watch`: the core

`watch(getters)` returns a watcher whose `poll()` reads every getter and returns a reading:

- One getter: its `Watched`. A record or array: a `Watched` for each, plus `anyChanged`. An array's elements may give
  different types, each typed by its position, since nothing is shared between them.
- `Watched<T>` has `current`, `previous`, `changed`, `changedTo(value)` and `changedFrom(value)`. A number or a
  `bigint` also has `increased` and `decreased`. `previous` equals `current` when nothing changed.
- `anyChanged` is set as `poll()` compares, so code built on `watch` needs no second loop. A record can't have a key
  named `anyChanged`.
- The reading is updated in place: read it in the step that polled, and never keep it.
- **A kept reading throws in development.** With no clock, the library can't know where a step ends, but it can know
  when the next poll happens. So in development (`const DEV = import.meta.env?.DEV === true`, as the other libraries
  do), each `poll()` returns fresh proxies over the reading and over each `Watched` in it, and marks the last poll's
  proxies stale. A stale proxy throws on any use, with a message saying the reading was kept past the next poll and to
  copy out the values it needs. A proxy whose handler checks a flag is used rather than `Proxy.revocable`, whose
  error ("Cannot perform 'get' on a proxy that has been revoked") wouldn't say what went wrong. In production `poll()`
  returns the reading itself, and allocates nothing. What it can't catch: a reading kept and used before the next
  poll, or kept by a watcher that's never polled again. Values copied out are primitives, so they're always safe. Only
  `watch` needs it: `when` and `react` are given primitives. A reading's identity differs between development (new
  each poll) and production (the same object), which nothing should rely on.

### `createReaction`

`createReaction({ watch, when?, react })` returns a function, `() => void`, to call on every step, unconditionally.
Each call reads the getter, or each getter of an array, and runs `react` for each change that `when` accepts. Calling it
twice in a step is harmless: the second call sees no change.

- **`watch`** is one getter, or a fixed array of getters that all give the same type. An array works as one reaction
  per element, sharing `when` and `react`: each element has its own memory and its own baseline. Several `react` calls
  in one step are normal, in index order. The Fruit Machine's reels were the motivating example: a stop sound for
  each reel, chosen by its index (see the example above), though the game itself keeps one thunk per tick.
- A record is a type error and a runtime error: react to each value with its own reaction, or compute one value from
  them and react to that. An array whose getters give different types is a type error on `watch`, even for two
  different string unions, because they share `when`.
- **Parameters are positional:** `when(current, previous, index)` and `react(current, previous, index)`. With one
  value, `index` isn't declared, and is `undefined` at run time. The conditions that ignore it (`increased`,
  `decreased`, `changedFrom`) work unchanged with arrays.
- **`when`** is a value, meaning "changed to it", or a condition `(current, previous, index) => boolean`. The helpers
  are `increased`, `decreased` and `changedFrom(value)`. A condition combines several by hand:
  `(current, previous) => current < previous && current <= TICKING_SECONDS`, or
  `(current) => current === 'dying' || current === 'game-over'`. `increased` and `decreased` are generic over
  `number | bigint` (`<T extends number | bigint>`), so they accept either and still refuse other types, with the
  error on `when`. A value is checked against the getter's type. `when: undefined` throws, because it would silently
  mean any change; a change to `undefined` is written `when: (current) => current === undefined`.
- **A reaction is named for what it does and when,** effect first, then trigger: `updateTextureWhenPhaseChanges`,
  `playPumpSoundWhenInflationRises`. `...When...` suits a value that changes or reaches a state, and `...OnEach...` a
  count, where each rise is one event (`playShotSoundOnEachShot`). A sound says `Sound`, and a visual names what it
  is (a texture, a popup, an animation), so a name never leaves the reader guessing which one it is. A short name
  such as `playPump` or `showPhase` names the value watched, not what happens to it.
- **Overlapping sounds are not the API's concern.** When an early stop lands every reel in one tick, several stop
  sounds play together. Whether that's wanted, and spacing sounds out, belong to the reaction (which can keep its own
  state, such as when it last played, timed by the view's update step) or to the sound chip's handling of overlapping
  instances of one sound.

### `createComputed`

`createComputed({ watch, compute })` returns a `Computed<R>`: call it to read the value, as often as you like.

- **`watch`** is one value or a record. An array is a type error and a runtime error, saying to use a record.
- **It is lazy.** It reads its getters on its first read, not at construction, and computes then. On a later read it
  recomputes only if something it watches changed since the last read. A computed value that's never read costs
  nothing, and its getters needn't be readable when it's made. Lazy, cached computed values are the usual design
  (Vue, MobX), and the docs say so. Watching a computed value ends its laziness: a reaction or watcher reads its
  getters when it's made (invariant 1), so a computed value it watches computes then, and its getters must be readable
  by that time.
- **Maintaining an object:** give `compute` a second parameter with a default. The default makes the object on the
  first compute, and every later compute is given the last result, to update in place and return:
  `compute: (size, cells = createCells()) => resize(cells, size)`. No annotation is needed. A second parameter with no
  default is a type error.
- **`version`:** a number that rises whenever the value may have changed: when a primitive value changes, and on
  every recompute of an object, since an object maintained in place can't be compared with what it was. Reading it
  brings the value up to date. It's how a computed object is watched, since the object itself can't be watched:
  `createReaction({ watch: () => cells.version, react: () => relayout(cells()) })`, or, for one computed object built
  from another, `createComputed({ watch: () => grid.version, compute: () => grid().length })` (inputs and triggers,
  below). A computed primitive needs no version to be watched: it's a getter.
- **Inputs and triggers.** `compute` may read state that it doesn't watch, provided something it does watch changes
  whenever that state does. The usual case is a version from the model: watch `model.gridVersion`, and read the entities
  inside `compute`. Watching `list.length` instead would miss an entity changing kind. (The prototype's doc comment
  says `compute` "must depend only on what it's given"; that is too strict and must change.)
- **Aggregates over a fixed array**, such as how many reels have stopped, are a getter that loops, watched directly
  or fed to a computed value. A computed value over N getters would read all N on every read anyway, to know whether to
  recompute, so for a cheap aggregate it saves nothing. An expensive `compute` that needs each of N values (not just
  how many) is triggered by a version from the model.
- A computed value is a getter, so it goes straight into a JSX prop: `<text text={scoreText} />`.
- Reading itself while computing throws.
- **It replaces `memoiseLast` entirely.** Every call site in the 32 files passes a primitive worked out from bindings,
  the model or the view's presentation state, and that expression becomes the getter:
  `text={() => distanceText(Math.floor(model.distance))}` becomes `watch: () => Math.floor(model.distance)` and
  `text={distanceText}`. The Fruit Machine's `lastFor` (`memoiseLast` for an object, compared by reference) is out of
  scope, and stays that entry's own helper.

### Typing

Each factory has one signature, not overloads. It reads the shape from the `watch` argument with conditional types,
and a failed check gives a string-literal type that reads as the error message. Compared with overloads on 2026-10-29,
with TypeScript 5.9.3:

- **Errors land on the property that's wrong** (`watch`, `when` or `react`), with one message. With overloads, every
  error landed on the whole call, and a wrong `when` on one getter showed the array overload's irrelevant message
  first.
- **Mixed arrays are caught.** Overloads inferred `T` from the elements, and silently merged two string unions into
  one (`GamePhase | ReelPhase`). The single signature checks that every element of a literal array gives exactly the
  same type; an array from `map` has one element type already.
- **An empty literal is caught.** With overloads it wasn't, because the check saw the parameter's type, not the
  argument's.

The reaction's signature, as sketched (`when` also gets the index, which the sketch left out):

```ts
type Getter = () => Watchable;
type ReactionGetters = Getter | readonly Getter[];
type ValueIn<W> = W extends readonly (() => infer T)[] ? T : W extends () => infer T ? T : never;
type IsAllSame<W> = W extends readonly [() => infer F, ...(readonly unknown[])]
    ? { [I in keyof W]: W[I] extends () => infer R ? Equal<R, F> : false }[number] extends true
        ? true
        : false
    : W extends readonly (infer E)[]
      ? // Not a tuple, such as a literal array held in a variable: its getters' return types, each wrapped as [R],
        // collapse to one when they're the same, and stay a union when they differ
        true extends IsUnion<E extends () => infer R ? [R] : never>
          ? false
          : true
      : true;
type Checked<W> = W extends readonly []
    ? 'An empty array never reacts: give watch at least one getter'
    : IsAllSame<W> extends true
      ? W
      : 'Every getter in the array must give the same type, since they share `when`';

declare function createReaction<const W extends ReactionGetters>(options: {
    readonly watch: W & Checked<W>;
    readonly when?: When<NoInfer<ValueIn<W>>>;
    readonly react: (
        current: ValueIn<W>,
        previous: ValueIn<W>,
        ...index: W extends readonly unknown[] ? [index: number] : []
    ) => void;
}): Reaction;
```

It inferred every case tested: arrays from `map`, one getter, computed values (alone or in an array), and `react`
written before `watch`. (The sketch also accepted computed objects, compared by version; that was dropped afterwards,
see [Settled Questions](#settled-questions). A `Computed<R>` is a `() => R`, so a computed primitive fits `Getter`
and a computed object doesn't.) It refused a mixed array, two different string unions, an empty literal,
a record, a getter of an object, a wrong `when` value, `increased` on strings, and an `index` on one getter's `react`.

The branch for arrays that aren't tuples was added after the first sketch, which checked only tuples. Without it, a
literal array held in a variable, such as `const getters = [bindings.phase, reelPhase]`, typed
`((() => GamePhase) | (() => ReelPhase))[]`, got past and merged the two types, and so did a string with a number.
With the branch, checked on 2026-10-29, both are refused. These are accepted: `[bindings.lives, bindings.spins]` in a
variable, `[scoreText, bindings.label]`, an array from `map` whose getter gives a union, and an array declared as
`readonly (() => GamePhase | ReelPhase)[]`. Only `createReaction` needs it: `watch` allows mixed arrays, and
`createComputed` refuses arrays.

`watch` follows the same pattern, sketched and checked the same way on 2026-10-29:

```ts
type WatchGetters = Getter | { readonly [name: string]: Getter } | readonly Getter[];
type Checked<S> = S extends readonly []
    ? 'An empty array never changes: give watch at least one getter'
    : S extends Getter | readonly Getter[]
      ? S
      : [keyof S] extends [never]
        ? 'An empty record never changes: give watch at least one getter'
        : 'anyChanged' extends keyof S
          ? "A getter can't be called anyChanged: the reading uses that name"
          : S;

declare function watch<const S extends WatchGetters>(getters: S & Checked<S>): Watcher<S>;
```

- One getter's reading is its `Watched`, with no `anyChanged`, since `changed` already says it (the prototype adds
  `anyChanged` there: drop it).
- A record's reading has a `Watched` for each key, and `anyChanged`.
- A literal array is typed by position, so `[bindings.phase, bindings.lives, bindings.big]` reads as `Watched<Phase>`,
  `WatchedNumber`, `WatchedNumber`. An array from `map` reads as one type for every element. Both have `anyChanged`.
- A computed primitive is accepted as a getter.
- `watch([])`, `watch({})` and a key named `anyChanged` are refused, each with its own message.
- A getter of an object, alone or in a record, and a computed object are refused, with "`number[]` is not assignable
  to `Watchable`". The message also mentions the `anyChanged` message in a union, which is noise, but the line that
  explains is clear.
- Only an exactly numeric type gets `increased` and `decreased`: `() => number | undefined` reads as a `Watched`.

`createComputed` follows the same pattern, for one value or a record: the same check for an empty record, and an array
refused with a message saying to use a record. The type tests carry all these cases over.

### Invariants

Four things are always true of a watch. They replace the rules of the first session ("read at construction", "call
each reaction on every step", "watch only settled state", "a watch samples"), each of which had an exception: here,
an exception is either one part of the API doing its share to keep an invariant, or a consequence of one. Each
invariant gives how the API keeps it, and what follows for the author, which is the guidance the docs teach.

**1. A change is a difference between two consecutive reads by the same watch.** Two reads that differ by `===` are a
change, reported once, by the later read. A watch knows only what it reads.

- *How the API keeps it.* A watch's first read is its baseline, never a change. Reactions and watchers take it at
  construction, so they can see the first change after they're made: a reaction never runs because it was made. A
  computed value takes it at its first read, since it has nothing to report before then (it's lazy). An array
  reaction is one watch per element.
- *What follows.* A view draws its first state itself, and an audio view needs no priming poll. Between two reads
  nothing is seen: a change that reverts is missed, and two rises are one `increased`, so where every occurrence
  matters, the model counts them, and a reaction plays from `previous` to `current`. A watch read less often samples
  more coarsely: calling a reaction on every step, unconditionally, makes "since the last read" mean "since the last
  step", while a call behind an `if` or an early `return` widens its gap (lint reports a conditional call, so a gap
  someone intends takes a comment saying why). A gap can span different subjects: a `<List>` skips an empty slot's
  subtree, so when the slot fills again, the next read compares the new item with the old one, and the remedies are
  the [guidance for collections](#decided-collections-in-views). `NaN` differs from itself under `===`, so it reads as a
  change every time.

**2. A computed value is always current.** Reading it gives what `compute` would give from its getters' values now.

- *How the API keeps it.* The library recomputes on a read if any getter's value changed since the last read. The
  author's share is inputs and triggers: `compute` reads only what it watches, or state that a watched trigger changes
  along with.
- *What follows.* A computed value can be read at any time, any number of times, conditionally, or never. Laziness is
  how the library keeps it current at the least cost.

**3. Equal reads mean nothing changed.**

- *How the API keeps it.* Getters must give primitives, so equal means unchanged: an object changed in place would
  stay equal to itself, which is why a getter of an object throws, and why frozen objects were rejected (the freeze
  would be shallow, and invisible to the types). No getter is an exception, computed values included.
- *What follows.* To watch a structure, watch a primitive that changes with it, such as a count or a version. For a
  computed structure, that primitive is its version.

**4. What a watch reads is fixed when it's made.** The set of getters never changes after construction.

- *How the API keeps it.* Records and arrays are read once for their getters, at construction.
- *What follows.* Lists whose items come and go are out of scope (see [List Handling](#list-handling)). An array that
  is empty at run time watches nothing, for good. An array made with `map` over model objects keeps reading those
  objects; `(_, i) => () => model.reels[i].phase` follows the model's replacements. (An empty literal being a type
  error is a guard against a mistake, not an invariant.)

**Where to read: the tick, not the watch.** By invariant 1, a read reports the state as it is at that moment. Which
moments are final for a step is a property of MVT's tick: the model's state is final once the models have updated, a
view's presentation state once its update step has run, and everything in refresh. So in a refresh step, watch
anything. In a view's update step, the model's state and ancestors' presentation state are final; the view's own
presentation state, its descendants' and its siblings' are not, so watch those in refresh. In a model, nothing is
final during `update`, so a model that watches polls right after the changes it watches, at a moment it chooses on
purpose. Neon Monsoon's game model does: it polls its boss's phase near the end of each step, after `boss.update`,
`shootBoss` and `touchShip`, so the rules it then runs (bullets into gems, bonuses, explosions) never interrupt them.
Glue code polls where the tick puts it: the Arcade's `main.ts` polls right after `model.update`, before the entry and
the views.

### Which tool

| Need | Tool |
| --- | --- |
| A sound or effect for one moment | `createReaction` |
| A sound or effect for each of a fixed set, such as the reels | `createReaction`, with an array |
| Sounds for a collection whose items come and go | One audio view, reacting to counts the model keeps |
| A value that's costly, or a label for a JSX prop | `createComputed` |
| A structure maintained from other state | `createComputed`, with a default for `last`, triggered by a version |
| An aggregate over a fixed array (how many, any, all) | A getter that loops, watched or fed to a computed value |
| Logic inside a step that interleaves checks with other work and early returns | `watch` |
| A structure rebuilt only on an explicit transition, which code already handles | Rebuild it in that handler, not with a computed value |
| Continuous change over time (a smoothed counter, an eased position) | A view's update step, not a watch |
| A single primitive read every frame, cheap to use as it is | Neither: read it |

## List Handling

Decided by the maintainer on 2026-10-29. This section blocked the task until then.

### Decided: lists whose items come and go are out of scope

`watch`, `createReaction` and `createComputed` don't watch lists whose items come and go (enemies, pools). If that's
needed, it can be built and handled elsewhere. The prototype's `each` key, and `list.ts` behind it, were removed. The
reasons:

- **The benefits were unclear.** No call site in the repo watches one value of each item of such a list. They use
  item views in a `<List>`, counts kept by the model, or getters that count. The motivating examples in 008, 078 and
  the prototype were made up (enemies crossing a level), or were the Fruit Machine's reels, which are a fixed list.
- **The semantics were likely wrong.** Memory belonged to an index, so it was only right for items changed in place,
  added at the end, or removed from the end. A new object at an index was compared with the old one's last value. A
  removal from the middle, or a reorder, made shifted items report changes they didn't have, or miss ones they did,
  and the removed item reported nothing. 008's advice to pair it with a `SlotList` couldn't be followed: `each` took
  an array, and `SlotList.slots` is `{ length, at }`, with holes.
- **It greatly complicated the API,** with two more overloads on each factory, `WatchableKey` and `ValueAt`, an
  inference problem (a selector lambda placed after `react` or `compute` silently widened the callback's types to
  `Watchable`), and Prettier splitting a call with two arrow arguments (`eachOf(() => list, (item) => ...)`).
- **The performance was suboptimal for many use cases:** it read every item on every call, whatever had changed.

This settles the former questions on lists whose items come and go: how to watch one value of each item, identity
when items are removed or reordered, arrivals and departures, and watching such a list inside a step.

### Decided: fixed arrays

A fixed array is what the reels are: set at construction, never growing or shrinking. Reactions take one, with every
element of the same type, and handle each element separately; `watch` takes one, with types by position; computed
values don't (see [Getters](#getters)). Aggregates over one are getters that loop (see
[`createComputed`](#createcomputed)). The Fruit Machine's reel stops show what an array reaction is for, one sound per
reel, chosen by index; how stops that land together should sound is the reaction's or the chip's business. The game
keeps its one thunk per tick, which counts the landed reels instead.

### Decided: collections in views

Guidance for the docs (Sound and Music, and Presenting Collections), not API:

1. **The default: one audio view for the collection, reacting to counts the model keeps.** Galaxy Raiders already does
   this for the player's shots (`shotsFired`). Its enemies would work the same way:

   ```ts
   const playDive = createReaction({ watch: () => model.divesStarted, when: increased, react: () => sound.play(DIVE) });
   const playHits = createReaction({
       watch: ENEMY_KINDS.map((kind) => () => model.hitsOf(kind)),
       when: increased,
       react: (_count, _previous, index) => sound.play(HIT_SOUNDS[index]),
   });
   ```

   With no slots, there are no arrivals in a reused slot, no cross-item comparisons when the model packs or reorders
   its array, and no skipped empty slots. A count rises in the tick of the moment, so an item removed in that same
   tick is still heard. Two moments in one tick are one `increased`, or play from `previous` to `current` (invariant 1).
   The cost: the model keeps the counts, and per-item details (such as a position to pan by) come from "the last one's
   details" (`lastHitX`).
2. **Per-item audio views,** when each item's presentation matters, such as panning by position, or a sound that lasts
   as long as the item (which is presentation state, advanced in the update step, not a reaction):
   - **Made per item.** A new item gets a new view, so new reactions, whose baseline is taken at construction
     (invariant 1): an arrival is never a change. Identity comes from the view's lifetime, with nothing in the API. The
     repo's `<List>` reuses views by index, so this needs a container that makes views by item, such as a game view
     rebuilding its enemy layer for each wave; a keyed list component would be a separate decision. Making views per
     arrival suits enemies arriving by the wave, not high-churn pools such as bullets.
   - **Reused by a `<List>`.** A new item in a slot is compared with the slot's last item, so each reaction uses a
     `when` that an arrival can't trigger, such as `changedFrom(true)` for a loss of life, as the Sound and Music guide
     says today. An empty slot's subtree is skipped, so its reactions aren't read until it fills again (invariant 1).
3. **A moment in the tick an item is removed** can't be seen by any view of that item: the model counts it, in every
   case.

## Known Costs

- **Line length.** `createReaction` and `react:` make a typical sound reaction about 118 columns at 4-space indent;
  longer ones expand. An expanded options object is the intended multi-line form.
- **A view draws its initial state outside its reactions.** That follows from invariant 1, and is the price of a change
  always meaning a change.
- **An object's version is coarse:** every recompute counts. An author who needs finer signals can put their own
  versions in the result, and consumers watch those with a getter.
- **A computed object is watched through its version,** so a computed object built from another one is given the
  version, not the object, and reads the object inside `compute`. No call site does this today.
- **An expensive `compute` over each of N values needs a version from the model,** since computed values don't take
  arrays. No call site needs one.
- **The signatures are conditional types.** Hovers show `W & Checked<W>`, and giving one getter's `react` an `index`
  reports "Target signature provides too few arguments" with the conditional in the message.
- **A getter whose type is a subtype of another's is merged into the wider type** by TypeScript, before the check for
  mixed arrays sees it: `[bindings.phase, bindings.label]` in a variable becomes `(() => string)[]`, so `when` accepts
  any string. The type is honest, only wider, and no two domains are mixed. A literal array written inline is
  checked as a tuple, so it's refused there.
- **Array reactions name what they skip:** the reels write `(_phase, _previous, index)`.
- **A reaction in a reused `<List>` slot needs a `when` that an arrival can't trigger,** or the item's view must be
  made per item, or the sound belongs in one audio view with counts.

## Settled Questions

Decided in the design sessions. Do not reopen without new information.

- **No ambient clock.** A step counter in the view tick API (078) coupled `watch` to whatever drives the tick API. A
  microtask clock coupled it to the event loop, made models frame-rate dependent, and let reads outside a frame
  consume changes. Both rejected: a watch has no implicit coupling to an environment controlled elsewhere.
- **No hooks on view nodes.** A watch attached to a node and synced by the tick API was rejected as coupling the watch
  to the tick API, and it changed how JSX views must be written.
- **No generators.** A generator is `poll()` spelled `next()`, with new footguns: `for...of` hangs, destructuring
  closes it, and each call allocates.
- **The fluent chain** (`watch(getter).changesTo(...).react(...)`) formats well only at two calls and splits two arrow
  arguments; an options object holds several lambdas on one line, and the writer chooses the layout by putting a
  newline after `{`. Measured with Prettier 3.9.10.
- **Memory belongs to each instance,** not to one watcher per view, so two readers can't interfere.
- **Reactions and watchers read their getters at construction** (invariant 1), replacing 008's and 078's "the first
  poll is a change from nothing".
- **Effects and computations are separate factories.** A single output key can't serve both, because their first
  calls differ: an effect must not run until it sees a change, and a computation must have a value from its first
  read. Deciding by whether the function returns a value fails on effects that return one by accident, such as an
  assignment expression.
- **Each tool takes the shapes that fit it** (2026-10-29), replacing "a reaction watches one value; records and fixed
  arrays are aggregates". In a reaction, a record would distribute (one `react` per key) where in a computed value it
  aggregates: the same shape with opposite meanings, so a record reaction written to rebuild once would run twice when
  two keys changed together. Records would also bring back mixed types under one shared `when`. So reactions take
  arrays of one type, computed values take records, and `watch`, which hands back a reading for each getter and
  decides nothing, takes both.
- **`when` takes values or conditions;** there are no `to` and `from` keys, and no `changedTo` helper. A value reads
  best (`when: 'dying'`).
- **Positional parameters** for `when` and `react` (2026-10-29), not one object `{ current, previous, index }`. The
  object could be passed without allocating (each slot's own `Watched`, updated in place), and it would remove the
  placeholders in `(_phase, _previous, index)`. But its costs fall on the common case: callbacks lose their own names
  for things (`(level, previous) =>`, `(text) =>`), a callback that keeps the argument, or reads it after an `await`,
  sees it change on the next step, and prior art (MobX's `reaction`, Vue's `watch`) is positional.
- **One signature per factory, not overloads** (2026-10-29): see [Typing](#typing).
- **`===` throughout** (2026-10-29). The prototype treated `NaN` as equal to itself. That only stopped a getter that
  keeps returning `NaN` (nearly always a bug) from reading as a change every step, which hides the bug. It departed
  from IEEE 754 (and was neither `===` nor `Object.is`), made `changed` false while `current !== previous`, and
  disagreed with `when` values, which match with `===`.
- **Every primitive is watchable** (2026-10-29), `bigint` and `symbol` included, for complete and consistent coverage
  of primitives. `memoiseLast` already accepted both; the prototype's `Watchable` didn't. A `bigint` also gets
  `increased` and `decreased`, as a number does.
- **Computed values are lazy** (2026-10-29): see [`createComputed`](#createcomputed).
- **Empty records and arrays** (2026-10-29): see [Getters](#getters). An array empty at run time is allowed, because one
  made from data can be empty legitimately.
- **Primitives only; frozen objects rejected** (2026-10-29). Accepting an object only if `Object.isFrozen` (for
  objects a model replaces rather than changes, as `lastFor` handles) was considered. Rejected: TypeScript can't tell
  a frozen object from any other, and a freeze is shallow, so the footguns remain at type-check time and at run time.
- **No `identity` key and no `reset()` on reactions** (2026-10-29). Both target reactions in a reused `<List>` slot,
  which see a new item's values as a change. `identity` was an optional getter whose change makes a reaction take its
  current value as a new baseline without reacting, compared by reference, since an identity is never inspected.
  `reset()` was a method that does the same, called from a reaction to the item's id. Compared case by case, where
  they overlap `identity` is better: no call order to keep, no list of reactions to reset, no ids from the model when
  items are fresh objects, and each reaction stays independent, where `reset()` couples them. `reset()` is more
  general only for fixed arrays and imperative triggers, with no use case; for a subtree skipped while hidden, both
  need the same changing signal. Neither is needed: one audio view with counts, a view per item, or `when`s an arrival
  can't trigger cover the cases, and `watch` with a record can check an id (`w.id.changed`). If reopened, start from
  `identity`.
- **Invariants, not rules** (2026-10-29). The first session's four rules each had an exception. Restated as four
  invariants, the exceptions became parts of the API keeping an invariant, or consequences of one, and the rules
  became guidance that follows from them. "Watch only settled state" turned out to be a property of MVT's tick, not of
  `watch`. See [Invariants](#invariants).
- **Overlapping sounds are not the API's concern** (2026-10-29): see [`createReaction`](#createreaction).
- **Past tense everywhere:** `increased`, `changedFrom`, matching the reading's `changed` and today's `watch`.
- **Names:** `createReaction` with `react`, `createComputed` with `compute`, the key `watch` in both. Prior art matches:
  MobX's `reaction` doesn't run when made; Vue's and MobX's `computed` are lazy and cached. `createEffect` was
  rejected because Solid's, React's and Preact's effects track their own inputs and run when created. `from` as the key
  read wrongly for reactions, and clashed with `changedFrom`.
- **No `initial` key.** A default for `compute`'s second parameter does the same, with no annotation, because
  `Compute<C, R>` is typed with one parameter, so the second takes its type from its default. Declaring `last` in the
  type makes TypeScript fix the result type first, and it becomes `unknown`.
- **Lists whose items come and go are out of scope** (2026-10-29): see
  [List Handling](#decided-lists-whose-items-come-and-go-are-out-of-scope).
- **Versions are the library's,** not the author's: they can't be forgotten, and they make every computed object
  watchable the same way. Authors can still add their own for finer signals.
- **A computed object can't be watched; its version can** (2026-10-29). The first design accepted any computed value
  as a getter, compared by its version but reported as its value. That broke "primitives only" in the design's own API,
  and for an object maintained in place it reported the same object as `current` and `previous`, so `previous` was
  meaningless and `when` could only be a condition. Nothing needed it: no call site watches what `memoiseLast`
  returns, and the only consumer found, in the `derive-util` spike, is its demo counting its own recomputes. Now a
  getter must give a primitive, with no exception: a computed primitive is a getter, and a computed object is watched
  with `() => cells.version`. The core loses its special path for computed values.
- **No `all` and `any` helpers** (2026-10-29). They combined conditions on one getter. Today's combined conditions
  mix different getters (paused with phase, points with a round ending), which they can't express, and the one
  single-getter case, seconds that fell within a range, is as short written by hand. The names were poor too: `any` is
  TypeScript's top type, both are as generic as names get in a broad utilities package, and neither starts with a
  verb. Adding a helper later is a minor release, and removing one a breaking change, so they wait for real uses.
- **`createSequenceReaction` is renamed `createSequenceTracker`, with its behaviour kept** (2026-10-29; the name,
  open question 2, chosen 2026-10-30). It isn't a reaction in this task's sense: it calls each step's handler for its current phase at construction, and
  `active` on every frame while a step runs. That's right for its job, which is mostly drawing a sequence's phases:
  `active` draws from `progress`, and `inactive` mostly draws the rest state, so calling it at construction is how a
  view starts valid. Only `entering` is a one-off. Keeping the name would leave two "reactions" in `@mvtjs/utils` with
  opposite rules, and invariant 1 would need an exception for it. Keeping the name and bringing the behaviour into
  line was rejected: it would move every `active` handler into refresh code, make each view draw its initial state
  itself, lose a lifecycle API authors find cohesive, and, worst, change behaviour silently under an unchanged name,
  so code outside the repo would still compile but do something different.
- **The primitives check is always on** (2026-10-29), not only in development. It follows the repo's `assert`
  convention: checks always run, and only one too costly for a production build goes under `if (DEV)`. Run only on
  the first read and on each change, it costs one `typeof` per change. A getter that slips past the types (`any`, a
  cast, plain JavaScript) fails worst in production: a fresh object on every read is a change on every read, so a
  reaction plays every frame, and an object changed in place never reads as a change. Either can depend on data that
  development never reached. The cost is that a game stops on a throw where it might have run on, misbehaving; the
  one harmless case, an object always replaced and never changed, is the one the design already chose not to support.
- **Models may use all three tools** (2026-10-29), polled or called at a moment the model chooses: right after the
  changes it watches (see "Where to read", under [Invariants](#invariants)). A model's update is driven by `deltaMs`,
  with no clock, so every invariant holds there. Linting the tools out of models was rejected: comparing by hand is the
  same pattern with more code, so a ban would remove the tool and keep the pattern, with no invariant behind it.
  Having the boss report its own transitions, by a callback, was rejected too: a callback runs as the phase changes,
  inside `shootBoss` or `boss.update`, which is the timing Neon Monsoon avoids on purpose, and deferring it brings back
  a flag, which is polling again. A `createComputed` in a model, for a cached derived domain value, comes with it. The
  lint rules check models as they check every other file.
- **Lint checks local shapes, not step functions** (2026-10-29). Four rules, each a bug a single file can show, as
  errors, applied to every source file (views, view models, models, glue):
  1. Every watcher and reaction made is used: a watcher has `.poll()` called on it somewhere in the file, a reaction
     is called or passed on (to `setRefresh`, into an array), and a `createReaction(...)` whose result is discarded is
     an error.
  2. Nothing is made and used in one expression: `watch(x).poll()`, `createReaction({...})()` and
     `createComputed({...})()` make a fresh watch each time, which never reports a change or never caches.
  3. A watcher is polled at most once in a function body: a second poll always reports nothing changed. A reaction
     called twice is allowed, since that's harmless.
  4. A poll or a reaction call isn't conditional within its function: not inside an `if`, a ternary, `&&` or `||`,
     and not after an early `return`. A gap someone intends takes an `eslint-disable` comment saying why.

  A rule that knows step functions was rejected. Today's polls sit in at least five shapes (functions passed to
  `setRefresh` and `setUpdate`, inline callbacks, helpers wired through JSX's `onRefresh`, view models' own updates
  in other files, glue and models), so the list would be open-ended, and every shape it missed would be an error on
  correct code. No rules at all was rejected because a reaction never called, or a watcher made inline, fails
  silently. What the four can't see is a whole helper skipped on some steps, or a watcher polled by two helpers: the
  gap invariant 1 explains, and often intended, as when Neon Monsoon's step stops at game over. The repo's lint uses
  errors throughout, never warnings, with `eslint-disable` comments for intended exceptions, as `no-null` does.
- **No version on readings** (2026-10-29). A count of the changes one watch has seen would undercount (invariant 1),
  differ between two watches of one getter, and invite the view to count what the model should. `changed` says all one
  read can know. A computed value's version is different: it belongs to the computed value, the same for every reader.

## Coverage of Earlier Designs

Every use case and question raised in 008, 078 and the `derive-util` spike, and where this task answers it.

| From | Use case or question | Answer |
| --- | --- | --- |
| 008 | Change detection, checked by the caller | `watch().poll()` |
| 008 | Memoised derived values, rebuilt in place | `createComputed`, with a default for `last` |
| 008 | Reactions with `from` and `to` filters | `createReaction`, with `when` values and `changedFrom` |
| 008 | A uniform list, with a callback per item | A fixed array: `createReaction` with an array. A list whose items come and go: out of scope |
| 008 | "Did any enemy cross the threshold this frame?" (its open question 1) | Out of scope as list handling: the model counts crossings, or a getter counts |
| 008 | List detection inside a step: `count`, `changedCount`, `anyChanged`, `at(i)` | A fixed array: `watch` with an array. A list whose items come and go: out of scope |
| 008 | Positional list identity, and the slot-history rule | Out of scope |
| 008 | Per-key filters on a set (its open question 2) | Reactions take arrays, each element separately; records are for computed values and `watch` |
| 008 | `when` reads oddly before `derive` and `detect` (its open questions 3 to 5) | Settled names |
| 008 | Many reactions mean many calls in refresh (its open question 6) | Open question 1 |
| 008 | A mapping terminal, and derived values as JSX props, detached safely (its open question 7) | `Computed` is a getter made of closures |
| 008 | The first-poll rule, `from: PREVIOUS`, `runFirstTime` | Replaced by invariant 1: a first read is a baseline |
| 008 | Docs: poll once per frame; readings are reused, never kept; two watches read a getter twice | Docs step; a dev-only check for readings kept past the next poll |
| 008 | Replace `memoiseLast`? | Yes, with `createComputed`, entirely |
| 008 | Port `derive` from `derive-util`, its docs and demo | Superseded by `createComputed`; the branch is deleted (the derive-util rows below) |
| 008 | Is it faster than today's `watch`, measured at about 8 ns per value? | Benchmark step |
| 078 | Reading without `poll()`: a clock | Rejected (Settled Questions) |
| 078 | `previous` undefined on the first tick, transitions false | Replaced by invariant 1: `previous` is always defined |
| 078 | The metronome's first beat, which needed a baseline at construction (its open question 2) | Invariant 1 |
| 078 | Named triggers (its open question 3) | Each reaction is a named constant |
| 078 | The Fruit Machine's thunks: one per tick, or one per reel (its open question 4) | An array reaction can play one per reel, by index; the game keeps one per tick (2026-10-30) |
| 078 | What becomes of 008 (its open question 5) | Archived as superseded |
| 078 | Watching each item of a list (`eachOf`) | A fixed array (its section 7.1): `createReaction` with an array. A list whose items come and go: out of scope |
| 078 | Code outside views: the Arcade's `main.ts`, Neon Monsoon's model | `watch` polls explicitly anywhere, models included (Settled Questions) |
| 078 | Unit tests for views, standalone watches, view models and models | Views: unchanged, through `updateView` and `refreshView`. Reactions and computed values: call them |
| 078 | Hot paths: no allocation per call | Pre-allocated slots and readings, index loops; benchmark step |
| 078 | MVT's rules unchanged | Yes: no clock, no wall-clock time, nothing autonomous |
| Session | Composite conditions (`active && level > 3`) | A getter, or a computed value from a record |
| Session | Watching in an update step | Where to read: the tick (under Invariants) |
| Session | Spawn and despawn: a slot appearing or leaving | The model counts them, and one audio view reacts |
| Session 2 | A new item in a reused `<List>` slot | [Collections in views](#decided-collections-in-views) |
| Session 2 | Objects the model replaces rather than changes (`lastFor`) | Out of scope: primitives only |
| derive-util | Inputs that aren't triggers: a revision counter, with the structure read in `compute` | "Inputs and triggers", above |
| derive-util | Fresh allocation on resize, in place otherwise | Either works; the version rises on every recompute of an object |
| derive-util | A `changed` flag on the derived value | A reaction to, or a `watch` of, the computed value's version (or the value, for a primitive) |
| derive-util | `derive({ watch, initial, compute(previous, watched) })`, recomputing when a trigger changes | `createComputed` with a record; `initial` is the default for `compute`'s second parameter |
| derive-util | First poll: every trigger reports a change, and `compute` runs once | Lazy: it computes on its first read |
| derive-util | Used in views and in models | Models may use all three tools (Settled Questions) |
| derive-util | Its three derivations: an occupancy grid (sparse to dense), the active entities filtered and sorted, a histogram of kinds | Each a `createComputed` with a record of revisions and a default `last`. None read a trigger's `changed` or `previous` in `compute`, so values rather than readings lose nothing |
| derive-util | When not to derive | "Which tool", above, including its row for a structure rebuilt on an explicit transition |
| derive-util | Its docs page, Deriving Values, and the links and glossary entry pointing to it | Everything it taught is in this task; the page for computed values is written from it (docs criterion) |
| derive-util | Its demo, "Derive - Structure Transforms": three panels counting their recomputes | Dropped with the branch. A demo of computed values would be a new entry, not a port |

## Open Questions

1. **Calling many reactions.** A view with many reactions calls each in refresh. A helper that runs several (for
   example `runReactions(a, b, c)`, returning one function) would shorten that, or an indexed loop over an array does
   the same. Decide during migration, if call sites get noisy. **Settled (2026-10-30): no helper.** The most calls
   left in one step is six, and they read plainly; several counts with their own sounds became one array reaction.
2. **The new name for `createSequenceReaction`.** It's renamed, with its behaviour kept (see
   [Settled Questions](#settled-questions)). **Settled (2026-10-30): `createSequenceTracker`.** It keeps track of each
   step's phase from frame to frame, and the name suggests neither a reaction nor driving the sequence's time.
   Rejected: `createSequenceFollower` (reads as a disciple), and `Listener`, `Driver`, `Runner`, `Renderer` and
   `Binding`, which suggest a push, owning the time, or a term the repo already uses.

## Acceptance Criteria

- [x] **First:** the list design finalised, approved by the maintainer, and written into
      [List Handling](#list-handling), with the design and these criteria updated to match (2026-10-29)
- [x] `watch`, `createReaction`, `createComputed` and the conditions in `@mvtjs/utils`, in a directory of their own,
      `packages/libraries/utils/src/watch-api/`, with its own `index.ts` that the package's barrel re-exports, as
      `slot-list/` and `view-tick-api/` are, and their tests beside them, from the prototype brought up to the design
      (the differences are listed at the top of [prototype.md](prototype.md)), following the repo's conventions
      (single quotes, `null` handled by the lint rule's escape, checks through `assert`, and dev-only ones under
      `if (DEV)`), with `compute`'s doc comment corrected for inputs and triggers
- [x] The prototype's tests ported to Vitest, and its type checks to type tests, including every case in
      [Typing](#typing)
- [x] A dev-only check that throws when a reading is used after the next poll (see
      [`watch`: the core](#watch-the-core)), with tests that it throws in development and that production returns
      the reading itself
- [x] Lint: the four rules in [Settled Questions](#settled-questions) ("Lint checks local shapes"), as errors on
      every source file, in `packages/internal/eslint-plugin` with tests, and each call site that intends a gap given
      an `eslint-disable` comment saying why
- [x] A case in the change-detection benchmark, compared with today's `watch` and with comparing by hand, before
      the migration (2026-10-29), and saved after the migration (2026-10-30)
- [x] Every call site migrated: about 70 files import `watch`, 74 call `poll()`, and 32 use `memoiseLast`, across the
      Arcade, the playground's examples and starters, and the benchmarks (`change-detection`, `memory`). Views that
      relied on the first poll reporting a change now draw their first state at construction; audio views drop their
      priming polls. The Fruit Machine keeps one reel-stop thunk per tick, counting the landed reels. The Arcade's
      `main.ts` drops its priming poll, and keeps comparing `favouriteIds` and `soundSettings` by hand (objects the
      model replaces); Neon Monsoon's game model keeps its watcher, polled where it is
- [x] Today's `watch` and `memoiseLast` removed
- [x] 008's `watch-builder.spike.ts` and its test removed (2026-10-29)
- [x] `createSequenceReaction` renamed `createSequenceTracker` (open question 2), with its behaviour unchanged: its file, test, barrel export,
      the five Kwazy Cactii board views, the `@mvtjs/utils` README, and the docs page Complex Sequences (its term
      "sequence reaction" and its heading "Reacting to Step Lifecycle Events") (2026-10-30)
- [x] `derive-util` deleted, locally and on `origin`, superseded by `createComputed` with nothing ported: see
      [Coverage of Earlier Designs](#coverage-of-earlier-designs) (2026-10-29)
- [x] Docs: Change Detection rewritten for the three tools, the shapes each takes, and the invariants (with what
      follows from each, as guidance), and a section on watching in models (poll right after the changes you watch);
      a page for computed values, written from this task, saying they're lazy, and that watching one ends its
      laziness; Sound and Music and Presenting Collections updated with
      [the guidance for collections](#decided-collections-in-views); Why Polling and Events and Signals checked;
      `AGENTS.md` (its sound bullet names `watch` and `increased`), the view and model skills, the glossary and
      `llms.txt`
- [x] A changeset for `@mvtjs/utils`: a breaking change (2026-10-30; and one for the `createSequenceTracker` rename)

## Progress Log

### 2026-10-25

Created from the design session of 2026-10-23 to 2026-10-25, which superseded 008 and 078 (both archived today). The
prototype and its record are in [prototype.md](prototype.md). The session's lab, in a temporary folder, also held
type-only sketches of the rejected shapes (the chain, a single options object with `map`, and `react` and `derive`
with `to` and `from` keys); they are not kept.

Later the same day, list handling was taken out of the design, and the task blocked until it is decided: the
maintainer was not yet satisfied with it. The prototype's attempt at it stays in `prototype.md` as material for that
design.

### 2026-10-29

The maintainer ruled lists whose items come and go out of scope for these tools: unclear benefits, likely wrong
semantics, a much more complicated API, and poor performance for many uses. The `each` key and `list.ts` were removed
from [prototype.md](prototype.md), along with their tests, type checks and fixtures, and its demo now watches the
reels as a fixed array.

The rest of the session settled the design, and the task is no longer blocked:

- Each tool takes the shapes that fit it: reactions take one value or an array of one type, each element separately;
  computed values take one value or a record, together; `watch` takes all three.
- One signature per factory, chosen over overloads after type-checking both with TypeScript 5.9.3. The sketches were
  in a temporary folder; the signature is recorded in [Typing](#typing).
- Positional parameters, with the index third. `===` throughout, dropping the `NaN` exception. Computed values are
  lazy. Empty literals are type errors, empty records throw, and arrays empty at run time do nothing. Primitives only,
  `bigint` and `symbol` included.
- Lists in views: one audio view with counts from the model by default, and per-item views made per item, or reused
  with `when`s an arrival can't trigger. Overlapping sounds are left to the reaction or the chip.
- Rejected, with reasons in Settled Questions: an object argument for `when` and `react`, objects accepted only when
  frozen, an `identity` key, and `reset()`.

The rules for every watch were restated as four [invariants](#invariants), so that their exceptions became parts
of the API keeping them, or consequences of them. `bigint` gets `increased` and `decreased`, as a number does.

`memoiseLast` was checked call site by call site: `createComputed` replaces it entirely. The prototype's code still
predates these decisions; [prototype.md](prototype.md) lists the differences.

A readiness review later the same day settled what remained before implementing, each item decided by the
maintainer (reasons in Settled Questions):

- A computed object is not a source; its version is. Readings get no version.
- Watching a computed value ends its laziness, documented.
- `watch` gets one signature too, and a one-getter reading has no `anyChanged`. Reactions also refuse mixed arrays
  held in variables.
- No `all` and `any` helpers.
- `createSequenceReaction` is renamed `createSequenceTracker`, with its behaviour kept.
- In development, a reading kept past the next poll throws, through proxies. The primitives check is always on, run
  on changes only.
- Models may use all three tools. Lint checks four local shapes in every file, as errors.
- The `derive-util` branch was checked for coverage and deleted, locally and on `origin`, and 008's spike files were
  removed from `@mvtjs/utils`.

With that, the task is ready to implement. Open question 1 waits for the migration, and open question 2 is a name.

The task moved to `vnext` from the `watch` branch, renumbered from 075 to 079 (and its proposal from 074 to 078),
since `vnext` had used both numbers. The maintainer placed the implementation in
`packages/libraries/utils/src/watch-api/`.

The implementation began the same day, with the library as the first checkpoint for review, before the migration:

- **`packages/libraries/utils/src/watch-api/`:** `watched.ts` (the shared types, and the prototype's slot as
  `MutableWatched`, one plain object per watched getter, read again by one shared function, `rereadWatched`; "slot" was
  dropped because the package's `SlotList` means something else), `watched-getters.ts` (a getter, a record or an array
  of them, shared by `watch` and `createComputed`), `watch.ts`, `reaction.ts`, `computed.ts` and `when-conditions.ts`;
  `error-checks/getter-checks.ts` holds the type-level checks that give the readable errors, and
  `error-checks/reading-guard.ts` the development-only check for kept readings. A README in the folder explains the API
  with examples, so the JSDoc stays short. At the maintainer's review, the exports were cut to the values and two types,
  `Watcher` and `Computed`: the others are inlined into the signatures (the options, `() => void` for a reaction) or
  stay unexported. The package's barrel exports everything but `watch` and `Watcher`, whose names today's `watch` keeps
  until the migration swaps them. The design's "source" became "getters", in the code and in this task, the word the
  rest of the repo uses for them.
- **Changes from the prototype,** beyond the list at the top of [prototype.md](prototype.md): the "must be a getter"
  check moved into the slot, so every tool gives the same message; only `watch` refuses a key named `anyChanged`,
  since only its reading uses that name; and a computed value checks its shape (an array, an empty record) when it's
  made, though it reads its getters only on its first read.
- **Tests:** 58, with the type cases from [Typing](#typing) as `expectTypeOf` and `@ts-expect-error` checks in each
  test file. The production path of the kept-reading check is tested with `vi.stubEnv('DEV', false)` and a fresh
  import.
- **Lint:** `no-unused-watch`, `no-inline-watch`, `no-repeated-poll` and `no-conditional-poll`, applied to all
  TypeScript. They find the three factories by their imports from `@mvtjs/utils` (or a relative path, in the
  library), so Node's `watch` is left alone, and treat any `.poll()` with no arguments as a watcher's, which every
  one in the repo is. Test files are exempt from the last two, since a test stands in for several steps in one
  function. Today's code had four polls after an early `return`, in Burrow Bust's rock view, Fenceline's
  farm-fenced and wire views, and Galaxy Raiders' enemy view; each now polls before the `return`, and handles a
  change while hidden.
- **Benchmark:** `change-detection` gained `createReaction` (the discrete scenario, as each view's refresh method)
  and `createComputed` (the derived one, a record of all 8 inputs, read every frame). Not saved: a save wants a quiet
  machine. The prototype's slot, with a `sync` closure, a slot object and `changedTo` and `changedFrom` closures for
  every value, measured 8.8 µs and 130 µs per frame for 1000 views. Making each slot one plain object synced by one
  shared function, giving `changedTo` and `changedFrom` only to a watcher's states, and writing nothing on a steady
  read that follows a steady read, brought them to the numbers below (median of 2 runs, µs per frame):

  | Changed per frame | compare by hand | today's `watch()` | `createReaction` |
  | --- | --- | --- | --- |
  | 0% | 4.22 | 12.8 | 6.31 |
  | 1% | 4.27 | 13.1 | 6.52 |
  | 10% | 4.89 | 14.2 | 7.33 |

  | Changed per frame | recompute every frame | today's `watch()` | `createComputed` |
  | --- | --- | --- | --- |
  | 0% | 8.91 | 86.9 | 95.2 |
  | 10% | 8.07 | 83.7 | 94.2 |
  | 100% | 11.3 | 86.7 | 105 |

  A reaction costs half of today's `watch`. A computed value over 8 getters costs about 10% more than today's `watch`
  of 8, for the values record it keeps for `compute`, its guard against reading itself, and its laziness. A `try`
  around each read measured nothing. For a sum this cheap, recomputing every frame stays fastest, as before.

The migration followed, one file at a time, across the Arcade (its own views and `main.ts`, the shared touch
controls, and every entry), the playground (its app, three examples and the HTML starter) and the
`change-detection` benchmark. Today's `watch.ts` and `memoise-last.ts` and their tests were deleted, and the
package's barrel now exports the new `watch` and `Watcher`. Every test passes, with every reference image identical,
and lint, the four new rules included, is clean. What it settled:

- **First state, drawn when made.** Views that drew their first state on the old first poll now draw it as they're
  made: the touch controls build their buttons, HUDs draw their lives, Burrow Bust's field and enemy, Fenceline's
  fence, wire, meadow and story, Fuel Run's first section banner, Tune Tracker's title bar and tune list, and the
  playground's theme, pane sizes and preview. Priming polls went everywhere.
- **Audio views play their first state themselves.** A start jingle (Burrow Bust, Crumb Chase, Dojo Duel, Fenceline,
  Fuel Run, Galaxy Raiders, Kwazy Cactii) played on the old first poll, a change from nothing. A view made as the game
  starts now plays it as it's made, as a drawing view draws its first state. Kwazy Cactii's audio test, which looked
  for it on the first tick, now looks for it as the view is made. `AGENTS.md`'s "never on a state alone" needs this
  case in the docs step.
- **Which tool, in practice.** A sound for an independent moment became a reaction. Views whose checks depend on each
  other kept `watch`: the Arcade's and Neon Monsoon's audio, Galaxy Raiders' enemy audio (a hit takes priority over a
  dive), Dojo Duel's match audio, the Fruit Machine's terminal, and views that redraw once for several values
  (`anyChanged`). Every `memoiseLast` became a computed value passed straight to its prop, except one trivial
  `failure ?? ''` in the Arcade view, now read directly. A cheap value set on change became a plain read each frame,
  since Pixi's setters skip an unchanged value: Astrovoid's and Galaxy Raiders' ship visibility, Burrow Bust's digger,
  Crumb Chase's cat and mouse. Two module-level `memoiseLast`s (the playground's barrel note, the HTML starter's time)
  became computed values inside their views.
- **Open question 1, calling many reactions.** No helper is needed. Several counts that each play a sound became one
  array reaction with a table of sounds by index (Fenceline, Fuel Run), as did Dojo Duel's four rows of pips. The most
  calls left in one step is six, in the Fruit Machine's audio view, and they read plainly.
- **The Fruit Machine's reel stops were not made an array reaction.** The view plays one thunk however many reels land
  in a tick, by counting the landed reels, which is the "aggregate over a fixed array" case in this design. An array
  reaction would play one thunk per reel, several at once on an early stop. The maintainer kept it as it is
  (2026-10-30): the reels were an example of what array reactions are for, not a change the game needed.
- **Fixes found on the way:** Astrovoid's and Burrow Bust's HUDs laid themselves out only as the wave or level
  changed, though the layout follows the screen or tile size; both lay out every frame now (two `position.set`s).
- **Benchmark, after the swap:** the new `watch` of one getter measures 10.5 µs per frame for 1000 views, faster
  than today's 12.8, but a record of one getter measures 17.5. Building the record's reading as today's does
  changed nothing, and nor did dropping the call that hands the reading out; the cost is in the record's path, not
  yet found. The derived scenario's `watch` of 8 measures 92, against today's 87.
- **Reactions renamed for what they do and when** (see [`createReaction`](#createreaction)), in every view, the
  library's tests and README, and the lint rules' tests: `showPhase` became `updateTextureWhenPhaseChanges`,
  `playPump` became `playPumpSoundWhenInflationRises`, and so on. A one-line reaction longer than 120 characters
  now takes one line per option, so its `when` and `react` stay visible.
- **`createSequenceReaction` renamed `createSequenceTracker`** (open question 2): its file and test, the barrel, the
  five Kwazy Cactii board views, the `@mvtjs/utils` README and Complex Sequences, whose heading is now "Tracking a
  Sequence's Steps". Behaviour unchanged.
- **The Fruit Machine keeps one reel-stop thunk per tick** (the maintainer's call): the reels were an example of what
  array reactions are for, not a change the game needed. The design text and criterion now say so.
- **The record `watch` gap, found and fixed.** A standalone micro-benchmark (no Pixi, built for production) took the
  record's path apart. Two costs added up: each poll read three parallel arrays (getters, names, `Watched`s), and
  went through two closures made for each watcher (`reread`, then the reading's guard, an identity function in
  production), which V8 doesn't inline the way it does one shared function. Now each `MutableWatched` keeps its own
  getter and name, so `rereadWatched` takes the `Watched` alone and the arrays are gone; `watch` makes one poll for
  each shape, with the record's loop inside it, and wraps it in the guard only in development. Writing the loop inline
  in `createComputed` too gained nothing, so it keeps the shared `rereadEvery`. The change-detection benchmark, after
  (µs per frame for 1000 views; median of 2 runs):

  | Changed per frame | today's `watch()` (before) | new `watch()`, before the fix | new `watch()`, after |
  | --- | --- | --- | --- |
  | discrete 0% | 12.8 | 17.5 | 11.5 |
  | discrete 10% | 14.2 | not measured | 12.5 |
  | derived 0% (8 getters) | 87 | 92 | 65.9 |

  `createComputed` in the derived scenario measures 79, 85 and 109 at 0, 10 and 100%, from about 95 and 131.
- **Benchmarks saved** (2026-10-30): `change-detection` and `memory`, on a quiet machine. The new `watch()` allocates
  nothing per frame, as today's did. Performance Measurements now describes reactions and computed values beside
  `watch()`, with the new numbers: a reaction costs about 6 ns per frame, half of `watch()`, and a computed value of 8
  getters 76 µs per frame for 1000 views against `watch()`'s 67.
- **Docs** (2026-10-30). Change Detection rewritten: the three tools, which shapes each takes, the four rules with
  what follows from each, where to read (views and models), consumer-defined events and counts. A new page,
  Computed Values, between it and Events and Signals in the sidebar. Sound and Music moved to reactions; its list
  section is now "Sound for a Collection", with the guidance for collections, and links to it were updated. Also
  updated: Why Polling, Events and Signals, Presenting Collections, Views, View Composition, Hot Paths, Complex
  Sequences, Taming Complex Views, Command-Query Separation, the style guide (computed values, and how to name a
  reaction), Project Structure, the glossary (Computed value, Getter, Reaction, Version and Watcher; `memoiseLast`
  removed), the view, model and code-review skills (the model skill gained "Watching in a Model"), `AGENTS.md` (the
  sound bullet, and reaction names), `llms.txt`, the `@mvtjs/utils` README, and the traffic light example's
  description. The docs build, and every `page.md#anchor` link resolves except `glossary.md#tick` in The Game Loop,
  which was already broken (a glossary entry is a table row, with no anchor).
- **Changesets:** `watch-reactions-and-computed-values.md` and `sequence-tracker.md`, both minor (breaking, before
  1.0).
