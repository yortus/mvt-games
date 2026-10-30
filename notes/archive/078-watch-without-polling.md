# Proposal: `watch` without polling

> Replace `watch(...).poll()` with a watch you simply read. A watch takes
> its sources, as today, and every read of it first brings it up to date
> for the current tick, once, by a clock that the view tick API keeps. So
> there is no `poll()` to forget, and no harm in reading twice. The watch
> itself is the reading: each source has `current`, `previous`, `changed`,
> and transitions such as `changedTo('settling')` and `increased`, which
> are false on the first tick, so a sound never plays because a view was
> made. One method, `compute`, memoises a costly value: it runs only when a
> source changed, and its `changed` means it ran. A second kind of source,
> `eachOf`, watches one value of each item in a list, so a view can play a
> sound for the reel that settled, by its index.

**Status:** superseded on 2026-10-25, before anything was built, by task
[079](079-watch-reactions-and-computed-values/task.md). Its clock was
rejected (079's "Settled Questions"), and its first-tick rule was replaced by
reading sources at construction. Kept for the record.

**Written:** 2026-10-23, against main at `5cd89d4`, in a design session
that compared five sketches (section 10). Nothing was measured.

**Related:**
[watch.ts](../../packages/libraries/utils/src/watch.ts) (today's `watch`),
[memoise-last.ts](../../packages/libraries/utils/src/memoise-last.ts),
[view-tick-api/](../../packages/libraries/utils/src/view-tick-api/),
[machine-audio-view.ts](../../packages/sites/arcade/src/entries/fruit-machine/views/audio/machine-audio-view.ts)
(the Fruit Machine's sound),
[reel-model.ts](../../packages/sites/arcade/src/entries/fruit-machine/models/reel-model.ts),
[Change Detection](../../packages/sites/docs/building-with-mvt/reacting-to-changes/change-detection.md),
[the change-detection benchmark](../../packages/tests/benchmarks/suites/change-detection.ts),
[008](./008-watch-builder-spike.md) (the `Watch()` builder spike, which
this would supersede) and [045](../archive/045-sound-chip.md), which gave
`watch` its `increased` and `decreased`.

| Decision | Recommendation | Section |
| --- | --- | --- |
| How a watch learns a tick has passed | A clock, read on every read of the watch. No `poll()` | 4 |
| Which clock | A step counter in the view tick API by default; any `() => number` as an option | 4.2, 4.3 |
| What the watch returns | The reading itself: one `Watched` for each source | 5 |
| What the first tick reports | `changed` is true; every transition is false | 5.2 |
| How a costly value is memoised | `compute(fn)`: runs only when a source changed, and `changed` means it ran | 6 |
| How a value depends on some sources only | A separate watch of just those sources | 6.3 |
| How a list is watched | `eachOf(list, select)`, a kind of source; slots tracked by index | 7 |
| Named triggers for sounds | Deferred: conditions read well enough at the call site | 11 |

---

## 1. The Problem

Today a view makes a watcher at construction and polls it in its refresh
step:

```ts
const watcher = watch({ phase: () => model.phase, spins: () => model.spinCount });
watcher.poll(); // so the first refresh hears only what changes after the view is made

function refresh(): void {
    const w = watcher.poll();
    if (w.spins.increased) sound.play(LEVER);
    if (w.phase.changed && w.phase.previous !== undefined) playPhase(w.phase.value);
}
```

There are four things to get wrong:

- **You must poll.** Values read without a `poll()` are last tick's, and
  nothing says so.
- **You must poll exactly once.** A second `poll()` in the same tick sees
  no change, so two parts of a view can't share one watcher.
- **The first poll is a change.** That is right for drawing, and wrong for
  sound: a view that plays on `changed` plays as it is made. Audio views
  avoid it by polling once at construction, or by testing
  `previous !== undefined`. About 70 bare `poll()` statements across the
  packages do the first.
- **Memoising is a second tool.** `memoiseLast`, used by 32 files, formats a
  value only when it changes. 008's builder proposed a `derive` that takes
  its last result and returns the next, and so must return that last result
  to say "unchanged": a rule easily missed.

Some cases have no good answer at all. The Fruit Machine's sound counts the
reels that are no longer spinning, and plays one thunk when the count
rises, because a watch can't say *which* reel landed. A sound that depends
on the reel needs per-item change detection.

## 2. Goals

A watch should be a declaration that:

- reads fairly naturally in English;
- formats well with the formatter;
- is strongly typed throughout, with types inferred from left to right;
- is short for the simple and common cases;
- handles complex cases by extending the simple forms, not by switching to
  new ones;
- lets you fall into a pit of success: no call you must remember, and no
  return value with a hidden meaning.

## 3. The Design at a Glance

```ts
watch(source, options?)     // one getter        → Watched<T>, with compute
watch(sources, options?)    // a record of them  → a Watched for each key, plus isFirstTick and anyChanged
watch(eachOf(list, select)) // one value per item → WatchedEach<V>

    .compute(fn)            // → Computed<R>: { current, changed, get }
```

Drawing when a value changes:

```ts
const score = watch(() => bindings.score());

function refresh(): void {
    if (score.changed) scoreText.text = formatScore(score.current);
}
```

Sounds:

```ts
const machine = watch({ phase: () => model.phase, spins: () => model.spinCount });

function refresh(): void {
    if (machine.spins.increased) sound.play(LEVER);
    if (machine.phase.changedTo('gameOver')) music.play(GAME_OVER);
}
```

A costly value, rebuilt only when the layout changes:

```ts
const grid = watch({ cols: () => cells.length, rows: () => countRows(cells) })
    .compute(({ cols, rows }) => buildGrid(cols, rows));

function refresh(): void {
    if (grid.changed) refreshLayout(grid.current);
}
```

A label for a JSX prop, formatted only when the score changes (what
`memoiseLast` does today):

```tsx
const scoreText = watch(() => bindings.score()).compute((score) => `SCORE ${score}`);
<text text={scoreText.get} />
```

## 4. Ticks Without `poll()`: the Clock

### 4.1 A read brings the watch up to date

Every property of a watch, and of everything made from it, is a getter
that first calls the watch's `sync()`:

```ts
function sync(): void {
    const t = clock();
    if (t === lastTick) return; // up to date for this tick already
    lastTick = t;
    // read every source and update its Watched, then run every compute whose sources changed
}
```

So a read is all it takes, and any number of reads in a tick see the same
reading. Two parts of a view, or a view and its view model, can share one
watch.

### 4.2 The default clock: a step counter

The view tick API keeps a counter that goes up as each outermost
`updateView` and each outermost `refreshView` begins. A call made from
inside one of their methods is not outermost, and `refreshView` already
tells the two apart (a nested call shares the outer one). `watch` reads
this counter when no clock is given, so inside views it needs nothing.

Update and refresh are separate steps, rather than one tick, because views
have presentation state. The Fruit Machine's sound watches
`() => clicks.count`, a metronome that its update step advances. If both
steps shared a clock value, a read in the update step would cache a
reading that the refresh step then saw, stale. With a step each, every
change is reported exactly once, to the first step that reads the watch
after it.

The counter is module state in `@mvtjs/utils`, which 044 guarantees is
loaded once.

### 4.3 Code outside views passes its own clock

```ts
const bossPhase = watch({ phase: () => boss.phase }, { clock: () => stepCount });
```

Two places need this today: the Arcade's own loop in
[main.ts](../../packages/sites/arcade/src/arcade/main.ts), and Neon
Monsoon's game model, which watches its boss's phase in its update. A model
must never use the default clock, since it counts view steps, and a lint
rule for model files should require the option (section 12).

### 4.4 Changes are measured between the ticks you read on

A watch read on ticks 4 and 6, but not 5, reports on tick 6 everything
since tick 4. Two rises in that gap are one `increased`. This is how
`poll()` works too, but it should be said plainly, because it now happens
without a visible call: a watch in a subtree skipped with
`SKIP_DESCENDANTS`, or behind a short-circuited `&&`, catches up when it is
next read.

A read between steps, in a pointer handler or at construction, gets the
reading of the last step, which is usually what is on screen.

## 5. The Reading

### 5.1 What each source gives

```ts
interface Watched<T> {
    readonly current: T;
    readonly previous: T | undefined;
    readonly changed: boolean;
    readonly changedTo: (value: T) => boolean;
    readonly changedFrom: (value: T) => boolean;
}

/** A number source also says which way it moved. */
interface WatchedNumber<T extends number> extends Watched<T> {
    readonly increased: boolean;
    readonly decreased: boolean;
}
```

A record's watch has one of these for each key, plus `isFirstTick` and
`anyChanged`. `current` replaces today's `value`. `changedTo` and
`changedFrom` take the source's own type, so `changedTo('bounce')` on a
reel's phase is a type error.

### 5.2 The first tick: transitions need a previous value

On the first tick a watch is read:

- `changed` is true, because the value is new to the watch;
- `isFirstTick` is true, and `previous` is `undefined`;
- every transition (`changedTo`, `changedFrom`, `increased`, `decreased`)
  is false, because a transition needs a value to move from.

This serves both kinds of view without priming. A view that draws on
`changed` draws its first state. A view that plays on a transition is
silent as it is made, even if the phase is already `'gameOver'`. An audio
view that wants any change after the first writes
`phase.changed && !machine.isFirstTick`.

### 5.3 Reserved names

`isFirstTick`, `anyChanged` and `compute` sit beside the source keys, so
the types forbid a source of those names:
`S & { isFirstTick?: never; anyChanged?: never; compute?: never }`.

## 6. `compute`

### 6.1 It runs only when a source changed

```ts
interface Computed<R> {
    readonly current: R;
    readonly changed: boolean;
    /** `current` as a function, safe to pass on its own, such as to a JSX prop. */
    readonly get: () => R;
}
```

`fn` runs on the first tick, and after that only on ticks where a source
changed. It receives plain values, not `Watched`s: the value itself for a
one-source watch, a values record for a record watch (pre-allocated and
updated in place), and a `readonly V[]` for `eachOf`.

### 6.2 `changed` means it ran

`changed` is true on the ticks `fn` ran. It does not compare results, so a
value rebuilt in place, such as a typed array, reports its change. `fn`
also receives its last result as a second argument, `previous`, for reuse
only. Nothing is signalled by returning it, so ignoring it is always safe.

### 6.3 Different inputs, a separate watch

A watch's sources are exactly its computes' inputs. A value that should
depend on `cols` alone is a watch of `cols` alone. There are no dependency
lists to keep in step with the code, and no gating by hand inside `fn`.
Two watches may read the same getter; it is read twice, which is cheap.

### 6.4 Computes run with the watch

A watch may have several computes, and each registers with it. `sync()`
runs every compute whose sources changed, whether or not it is read on
that tick. If computes ran only when read, one not read on the tick
something changed would miss that change for good, since the reading is
shared.

## 7. Lists

### 7.1 A fixed list needs nothing new

The Fruit Machine always has five reels, so one watch per reel, made at
construction, plays a sound for the reel that settled:

```ts
const reelPhases = model.reels.map((reel) => watch(() => reel.phase));

function refresh(): void {
    for (let i = 0; i < reelPhases.length; i++) {
        if (reelPhases[i].changedTo('settling')) sound.play(chooseReelStop(i));
    }
}
```

The `map` runs once, at construction. A reel already settling when the
view is made plays nothing (section 5.2). This is what the Fruit Machine
should use.

### 7.2 A list that grows and shrinks: `eachOf`

`eachOf(list, select)` is a second kind of source, allowed anywhere a
getter is:

```ts
eachOf(list: () => readonly T[], select: (item: T, index: number) => V): EachSource<T, V>

interface WatchedEach<V> {
    /** The list's length on this tick. */
    readonly count: number;
    /** The slot at `index`, a Watched with every member a single source has. */
    readonly at: (index: number) => Watched<V>;
    /** Whether any item changed, or the length did. */
    readonly changed: boolean;
}
```

```ts
const machine = watch({
    phase: () => model.phase,
    reels: eachOf(() => model.reels, (reel) => reel.phase),
});

function refresh(): void {
    const { reels } = machine;
    for (let i = 0; i < reels.count; i++) {
        if (reels.at(i).changedTo('settling')) sound.play(chooseReelStop(i));
    }
}
```

`watch(eachOf(...))` gives the `WatchedEach` directly, as `watch(getter)`
gives one `Watched`. In `compute`, the source arrives as a `readonly V[]`.

### 7.3 Rules, carried over from 008

- **A slot's history belongs to its index, not its item.** Right for
  fixed sets, pools, `SlotList` and lists that only grow. Wrong when items
  move between indices: pair `eachOf` with a `SlotList` when identity must
  survive reordering.
- **The first-tick rule applies to each slot.** A slot that appears, or
  reappears after the list shrank, gets a first reading: `changed` is true,
  and transitions are false. So a newly arrived item never triggers a
  sound, as the Sound and Music guide asks of an audio view in a `<List>`.

### 7.4 What per-reel sound changes in the Fruit Machine

Today's view plays one thunk however many reels land in a tick, and its
comment notes that a stop can land them all at once. One sound per reel
would play five together. A view could instead play the sound of the
highest index that settled. That is a sound-design choice, not an API one,
but it is the first thing to check (section 11).

## 8. Hot Paths

- Getters, `Watched` records and their `changedTo` closures are made once,
  at construction. `eachOf` makes a slot's record only when the list grows
  past its largest length so far, and reuses it after.
- A read on a tick already synced costs one clock call and one comparison.
- `sync()` loops by index, and allocates nothing.
- A `compute` allocates only if its `fn` does, and runs only on change.

Today's `watch` costs about 8 ns per watched value per frame in the
change-detection benchmark, over three times comparing by hand. The new
design adds a clock check per read; it must be measured against today's
before the migration (section 12).

## 9. MVT's Rules

Nothing changes in the rules. A watch reads a tick count, not wall-clock
time, and the count moves only when the ticker moves the views. A view
still reads state and writes presentation; the watch only remembers what it
read last. A model that watches its own parts passes its own clock, so
models still advance only through `update(deltaMs)`.

## 10. Alternatives Considered

Five sketches were compared against the goals in section 2.

1. **A staged builder**, `Watch().from(sources).derive(...)`, with `derive`
   taking nothing (the reading), a function (an accumulator) or a record
   (named sinks). Close to the first sketch, but `Watch()` with no
   arguments is ceremony, `derive`'s three meanings differ only by the
   shape of its argument, and the accumulator signalled "unchanged" by
   returning its last result.
2. **The watch is the reading**, with `compute`. Chosen: this proposal.
3. **Declarative filters**, `.signals({ died: { phase: { to: 'dying' } } })`.
   Nothing to get wrong, and typed against each source, but a small
   language of its own that can't combine conditions or compute values, and
   whose type errors are hard to read.
4. **One sentence per output**,
   `watchAll({ died: when(() => m.phase).changesTo('dying') })`. Reads best,
   and each output declares its own inputs, but shared sources are declared
   and read once per output, conditions across sources are awkward, and it
   drifts back to `ReactionBuilder`'s vocabulary.
5. **One config object**, `watch({ sources, compute, events })`. Labelled
   and easy to extend, but typing `compute` from its sibling `sources`
   relies on TypeScript's inference within one object literal, which breaks
   with method shorthand or key order, with baffling errors.

## 11. Settled Questions

Settled in the design session. Do not reopen without new information.

- **No `poll()` or `tick()` method.** A read brings the watch up to date by
  its clock.
- **The clock is an option, not a reserved source.** It is not a source:
  nothing needs its change information, and a reserved key would ban a name
  from every record.
- **Update and refresh are separate steps** of the default clock
  (section 4.2).
- **First tick:** `changed` true, transitions false (section 5.2).
- **One `sync()` brings every output of a watch up to date together**,
  never one output at a time (section 6.4).
- **`compute` runs only on change, and `changed` means it ran.** No return
  value signals anything (section 6.2).
- **Different inputs mean a separate watch**, not dependency lists
  (section 6.3).
- **List identity is positional** (from 008).
- **No reaction callbacks.** A view reads the watch and acts itself, which
  keeps `return` and early exits in the refresh step where they belong.

## 12. Open Questions

1. **Names.** `watch` or `track`; `compute`, `map` or `memo`; `eachOf`;
   `isFirstTick` or `isFirstRead`, since it means the watch's first read,
   not the app's; the step counter's name.
2. **Taking the baseline at construction.** A metronome that beats in the
   first update step has its first beat missed: the first read, in the
   following refresh, is the first tick, with no previous value. Today's
   views prime the watcher for this. Options: a `{ baseline: 'now' }`
   option that reads the sources at construction as the first tick, or a
   read at construction, which works because construction and the first
   refresh are different steps.
3. **Named triggers.** A boolean-only `.events({ died: (w) => ... })` could
   name conditions for reuse or tests. Deferred until call sites ask for it.
4. **The Fruit Machine's thunks.** One per reel, or one per tick for the
   highest reel that settled (section 7.4).
5. **What becomes of 008.** This answers its open questions on mapping
   terminals and list aggregates, and drops its reactions. Recommended:
   archive it as superseded by this proposal once this is accepted.

## 13. Implementation Steps

1. Add the step counter to the view tick API in `@mvtjs/utils`, and
   re-export it from the renderer packages, with tests that nested calls
   don't count and that update and refresh count separately.
2. Build the new `watch` under a working name beside today's, with
   `eachOf` and `compute`, and type tests (`@ts-expect-error`) for
   `changedTo`'s argument, the reserved names and `compute`'s values.
3. Add a case to the change-detection benchmark, and compare it with
   today's `watch` and with comparing by hand.
4. Migrate the call sites, a package at a time:
    - views that draw on `changed`: mechanical (`poll()` gone, `value`
      becomes `current`);
    - audio views: drop the priming `poll()`, and move to transitions or
      `changed && !isFirstTick`;
    - `memoiseLast` sites: `watch(...).compute(...)`;
    - the Arcade's `main.ts` and Neon Monsoon's game model: an explicit
      clock;
    - the Fruit Machine's sound: per-reel thunks, after open question 4.
5. A lint rule for model files: `watch` must be given a clock.
6. Rename the new `watch` to its final name, and remove today's `watch`,
   `memoiseLast` and 008's spike files.
7. Docs: the Change Detection guide (the clock, the first-tick rule,
   reading between ticks, `eachOf` and its slot rule), Sound and Music,
   `AGENTS.md`, the view and model skills, the glossary and `llms.txt`.
   A changeset for `@mvtjs/utils`: this is a breaking change.
8. Archive 008, and this proposal when done.
