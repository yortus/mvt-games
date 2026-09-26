# 008 - `Watch()` fluent builder (spike)

> Status: **Spike / design investigation.** A working prototype lives in
> [`src/common/watch-builder.spike.ts`](../../src/common/watch-builder.spike.ts)
> with tests in
> [`src/common/watch-builder.spike.test.ts`](../../src/common/watch-builder.spike.test.ts)
> (tsc + eslint + vitest green). It is not exported from the `#common` barrel,
> and nothing else in `src/` imports it. Living under `src/` means
> `npm run build` type-checks it and `npm test` runs its tests.

## The question

Can one top-level builder - `Watch()` - grow a fluent chain that covers the
family of pull-based, per-frame change processors we keep re-deriving by hand,
from the simplest to the more complex, and read like an English description of
the operation?

Four capabilities are in scope:

1. **Change detection** - the current `watch(record).poll()` on this branch.
2. **Deriving memoised values** - `derive` (on the `derive-util` branch).
3. **Reacting to a change** - `ReactionBuilder` in the sibling `mvt-workshop`
   (`.when(fn).changes({from,to}).then(action)`).
4. **Watching a uniform list** - *new*: "did any of these (shortish) array items
   have their `level` cross above 10 this frame?" - with a per-index callback.

## The unifying insight

All four are the same shape: a thing you **construct once** and **poll every
frame** from `refresh()` / `update()`. They read one or more primitive sources,
compare against the previous value, and differ only in *what they do on a
change*:

| Capability | Terminal | Behaviour on change |
| --- | --- | --- |
| detect | `.detect()` | expose `{ changed, value, previous }` for you to check (or per-item values in list mode) |
| derive | `.derive()` | recompute + cache one memoised value |
| react | `.changes(...).then()` | run a side-effect callback |

Because the lifecycle is identical, every terminal shares one contract: it is
pull-based and exposes **`poll()`**. That single property is the spine of the
design - it keeps the builder honest with MVT's pull model (no wall-clock, no
autonomous callbacks; the ticker drives everything through `poll()`).

## Proposed surface

A single top-level builder, `Watch()` (capitalised like `ReactionBuilder`, so
linters format the chain as vertically-aligned calls). It splits immediately
into **single**, **set** or **list** mode via `.when(...)` / `.eachOf(...)`, then
flows through an optional transition filter to a terminal:

```text
Watch()
  .when(() => value)           -> SINGLE mode: one primitive value
  .when({ a, b })              -> SET mode:    a named record of triggers
  .eachOf(() => list).when((item, index) => value)  -> LIST mode
      .detect()                -> detector: poll it and check changes yourself
      .derive(initial, fn)     -> memoised structure
      .changes({ from?, to? }) -> reaction filter (argless: any change)
          .then(action)        -> reaction
```

A reaction always goes through `changes`, so it reads as a sentence: "when phase
changes, then ...". There is exactly one spelling per filter: `changes()` for
any change, `changes({ to })`, `changes({ from })`, `changes({ from, to })`.

**One rule everywhere: a value's first poll is a change from *nothing*.**
A private `seen` flag marks the first poll. It reports `changed` (with
`previous === undefined`), `.derive()` computes, and a reaction fires if its
filter accepts it. There is no opt-out modifier; `from` filters cover it.

**A change needs a new value. A `from` filter also needs a previous value, and
the first poll has none, so a `from` filter never fires on the first poll.**
`from: PREVIOUS` asks for nothing more - "any change after the first poll" - for
effects that must not fire on construction, like sounds.

| Filter | Requires | Fires on first poll? |
| --- | --- | --- |
| none (`changes()`), or `{ to }` | a change (and a match on `to`) | yes |
| `{ from: 'spinning' }` | a previous value equal to `'spinning'` | no |
| `{ from: PREVIOUS }` | a previous value, any value | no |

Because every `from` filter guarantees a previous value, `changes({ from: ... })`
narrows `previous` to `V` (via an overload); everywhere else it is
`V | undefined`. Reaction callbacks share one argument
order - `(value, previous)` for single mode, `(value, previous, item, index)` for
list mode (item before index, as in `array.map((item, index) => ...)`) - so the
two are prefix-compatible.

The **condition** (`when`) is identical in every mode: any `Watchable` value
under `===` change detection, with the same `changes` filter. List
mode adds nothing to the condition - it only widens the *callbacks* with the
item, its `index`, and the previous value.

### 1. Change detection - `.detect()`

`.detect()` gives you the detector with no reaction attached, for call sites
that check changes themselves (typically views whose `refresh()` interleaves
change-gated blocks with per-frame work and early returns, like
`pause-menu-view.ts`):

```ts
const hp = Watch().when(() => m.hp).detect();
if (hp.poll().changed) drawBar(/* ... */);                      // also on the first poll
```

This is what today's `watch()` returns, with the same first-poll behaviour.
Detectors and `derive` have no filter step, so they always follow the first-poll
rule; no current call site needs otherwise (the code that must skip
construction is audio and effects code, which uses reactions). The terminals
are three verbs - `detect`, `derive`, `then` - returning a `Detector`, a
`Derived` and a `Reaction`.

The list mode's `.detect()` returns per-item watched values (see §4); set mode's
returns per-key watched values (see §5).

### 2. Derive

Single-trigger (a revision counter) or multi-trigger via a **record** - `compute`
reruns when any trigger changed, and on the first poll (matching today's
`derive`):

```ts
Watch().when({ rev: () => m.gridRevision, cols: () => m.cols })
    .derive(new Uint8Array(0), (derived, watched) => { /* rebuild in place */ return derived; });
```

Like `Array.reduce`, `compute` gets the last `derived` result (initially
`initial`) and returns the next one, mutated in place or fresh. `previous` keeps
its one meaning: the previous *watched* value.

`poll()` returns the value; `.changed` reports whether the last poll rebuilt.

### 3. React

The transition filter carried over from `ReactionBuilder`:

```ts
Watch().when(() => m.score).changes().then(updateLabel);                             // View: sync now and on change
Watch().when(() => m.phase).changes({ from: PREVIOUS, to: 'dead' }).then(playSound); // AudioView: silent on construction
Watch().when(() => m.reel).changes({ from: 'spinning', to: 'stopped' }).then(settle); // never fires on the first poll
```

Every terminal is a `{ poll() }` object. The filter is applied to the first
poll exactly as to any other - there is no bypass (unlike `ReactionBuilder`'s
`runFirstTime`, which fired regardless of the filter).

### 4. Uniform list

`.eachOf(list).when((item, index) => value)` enters list mode. **The condition is
the same as single mode** - any `Watchable` value, same `changes` filter. What
list mode adds is per-item callbacks carrying the item, its index, and the
previous value:

```ts
// "celebrate each enemy that just crossed the threshold" - boolean is just a value
Watch().eachOf(() => m.enemies).when((e) => e.level > 10)
    .changes({ to: true })
    .then((_value, _previous, enemy, index) => celebrate(enemy, index));

// a non-boolean condition uses the very same grammar
Watch().eachOf(() => m.units).when((u) => u.state)
    .changes({ from: 'idle', to: 'active' })
    .then((state, previous, unit, index) => onActivate(unit));
```

Every `changes` filter applies per item. The first-poll rule applies **per
slot**: on the first poll every slot gets its first poll, and so does any slot
that appears later (a spawned enemy already above level 10 fires
`changes({ to: true })`). A `from` filter
skips each slot's first poll, so `changes({ from: PREVIOUS, to: true })` fires
only on real crossings, for existing and newly-appeared slots alike. The action
signature is `(value, previous, item, index)` - the same leading `(value,
previous)` as single mode, widened with the item and its index (item before
index, matching `array.map`).

**A slot's history belongs to its index, not its item.** Each slot remembers the
last value seen at that array index, whatever item now occupies it. That is
exactly right for in-place mutation, fixed pools, `SlotList` and append-only
lists, and for arrays that are recreated with mostly the same contents (the array
reference is never consulted). It is wrong only when items move between indices:
removing or reordering mid-list compares each shifted item against its
predecessor's history (a spurious or missed change), and the removed item
produces no event. Keyed identity was ruled out, and treating a changed item
reference as a fresh slot only swaps a spurious change for a spurious first poll,
so the rule is documented rather than patched. **The `eachOf` JSDoc states it in
the spike; the promoted module's docs must state it too** (the change-detection
guide, alongside the `SlotList` pairing advice).

The list `.detect()` terminal returns `EachWatchedValues`: aggregate `count`,
`changedCount`, `anyChanged`, plus `at(index)` for a per-item
`EachWatchedItem` `{ item, index, changed, value, previous }`.

### 5. Set mode (record of triggers)

`.when({ a, b })` watches a named record; the terminals mirror today's
`watch({...})`:

```ts
Watch().when({ rows: () => m.rows, cols: () => m.cols }).detect().poll();  // WatchedValues, as today
Watch().when({ score: () => m.score, combo: () => m.combo }).changes().then((w) => { /* w.score.changed ... */ });
Watch().when({ score: () => m.score }).changes({ from: PREVIOUS }).then((w) => { /* not on construction */ });
```

Set mode has no per-key filters, so its `changes` takes either nothing (any key
changed) or `{ from: PREVIOUS }` (any key changed after the first poll). The
latter narrows
the readings to `WatchedValuesWithPrevious<S>`, where every key's `previous` is
`V`.

`.detect()` returns the per-key watched values that today's ~40 `watch({...}).poll()`
call sites already use, with the same first-poll behaviour, so they migrate onto
`Watch()` unchanged.

## Feasibility

Proven by the spike: all modes compile under `strict` + `verbatimModuleSyntax`,
lint clean, and pass 24 tests, including `@ts-expect-error` checks that
`previous` is `V` after any `from` filter and `V | undefined` otherwise (including
`{ to }`), in single, set and list mode. The chain infers types end-to-end
without annotations - `.when(...)` resolves single vs record by argument shape,
and `.eachOf()` carries the item type `T` into `.when((item, index) => ...)` and
on to the reaction action.

The implementation also got simpler: one core per mode computes
`changed = !seen || next !== last` and `previous = seen ? last : undefined`, and
exposes `firstPoll`; the filter test rejects any `from` on a first poll. No
terminal has its own first-poll branch, and there is no opt-out flag to thread
through.

**Hot-path clean.** No terminal allocates per poll. Each terminal pre-allocates
its tracking state and its result object once and mutates them in place; the list
mode keeps one `previous[]` per terminal (grown, never re-created). Loops are
index-based; no `map`/`for..of`/closures on the poll path. The per-item `visit`
closure is built once when the terminal is constructed, not per poll.

## Tradeoffs and open questions

Gotchas from tracing the first-poll rule through every path:

- **`changes({ to: x })` fires at construction if already `x`.** `undefined ->
  'dead'` is a transition to `'dead'`. Views usually want this (render the current
  state); audio and one-shot effects use `changes({ from: PREVIOUS, to: x })`.
  Migrating `ReactionBuilder` call sites: its default (`runFirstTime: false`)
  becomes `from: PREVIOUS`.
- **`from: PREVIOUS` looks redundant until you know the rule.** Every change
  seems to be "from the previous value"; the point is that the first poll has
  none. The change-detection guide must say so plainly (the wording in the
  first-poll section above is the draft).
- **`to`-only filters fire initially; `from` filters never do.** A defined `from`
  can't equal `undefined`, so `.changes({ from: 'spinning', to: 'stopped' })` is
  naturally silent at construction.
- **A value that starts `undefined` still gets a first change.** The first
  poll is flagged by a private `seen` boolean rather than by comparing to
  `undefined`, so an unset `selectedId` still fires and flags `changed` at
  construction. A micro-benchmark (2000 watchers x 5000 frames) put the flag
  ~13% *faster* than comparing to `undefined` and a private `Symbol` sentinel
  ~16% slower; the flag keeps `value`/`previous` fields free of a foreign type.
- **`from` filters never match a first poll.** `from: undefined` therefore
  means only "was really `undefined`, now isn't" (e.g. a target acquired).
- **No filter bypass on the first poll.** `ReactionBuilder({ runFirstTime:
  true })` fired regardless of its filter; `Watch()` applies the filter to the
  first poll like any other. The four real `ReactionBuilder` call sites in
  `mvt-workshop` all use the default (no first fire), so nothing relies on the
  bypass. Initial scene construction is state sync, which unfiltered
  `changes().then` already covers.
- **Newly-appeared list slots get a first poll.** Per-slot consistency means a
  slot that appears (or reappears after the list shrank) fires like a first poll.
  Items that shift between indices are covered by the slot-history rule in §4.
- **No opt-out for detectors or `derive`.** They have no filter step, so
  they always follow the first-poll rule. A root-level modifier can be added if
  a real need appears.

Other tradeoffs:

- **List identity is positional (decided).** List mode tracks slots by array
  index - no key function. A reorder or removal shifts indices, so pair list mode
  with a `SlotList` (stable storage index) when identity must survive reordering,
  exactly as the entity pools already do.
- **`.detect()` vs a pollable builder.** The detector is an explicit terminal.
  The alternative - making the `.when(...)` builder itself pollable - was
  rejected to keep "builder" and "result" distinct.
- **`changed` on structure-mutating derivations.** Unchanged from `derive`: the
  model must expose a **revision counter** because arrays/objects are not
  `Watchable`. The builder does not change that contract.

## Naming

The root is settled as **`Watch()`** - a capitalised builder factory (like
`ReactionBuilder`) whose call syntax nudges linters into a vertically-aligned
multi-line chain. The mode split (`.eachOf` / `.when`), the transition filter
(`changes`) and the terminals (`detect` / `derive` / `then`) are the spike's
working vocabulary. Decided: `then` stays (no thenable problems in ~2 years of
`ReactionBuilder` use) and has no alias; `becomes` was dropped in favour of
`changes({ to })`; argless `changes()` is required before `then`, because
"when phase then ..." doesn't read; `.build()` was renamed `.detect()` (a verb
alongside `derive` and `then`, reusing the docs' "change detection" term).

Terminal-name choices still open (any can be swapped without touching the
grammar):

| Slot | Working name | Alternatives |
| --- | --- | --- |
| declare value | `.when(select)` | `.of` - `.on` - `.watch` |
| detector | `.detect()` (decided) | - |
| derive | `.derive(init, fn)` | `.select` - `.map` - `.into` - `.compute` |
| transition | `.changes({from,to})` (argless: any change) | `.changesFrom(a).to(b)` |
| action | `.then(fn)` | - |
| any-previous sentinel | `from: PREVIOUS` | `ANY_PREVIOUS` - `ANYTHING` |

The read-through the spike commits to:

```ts
Watch().when(() => phase).changes({ from: PREVIOUS, to: 'dead' }).then(playSound)
Watch().eachOf(() => enemies).when(e => e.level > 10).changes({ to: true }).then((_v, _p, e, i) => celebrate(e, i))
Watch().when({ rev: () => gridRevision, cols: () => cols }).derive(seed, rebuild)
Watch().when(() => phase).detect()
```

## Recommendation

The `Watch()` builder is feasible and cheap, and it collapses three separate
vocabularies (`watch`, `derive`, `ReactionBuilder`) into one fluent chain.
Suggested path out of the spike:

1. Confirm the terminal-name choices in [Naming](#naming).
2. Document the first-poll rule and `from: PREVIOUS` (draft wording above) and
   the slot-history rule (§4) in the promoted module's docs.
3. Promote to a real module, and migrate `ReactionBuilder` / `derive` usages plus
   the existing `watch()` call sites onto it.

## Handover: loose ends

State at the end of the design session (2026-09-24): the spike and its 24 tests
are green and reflect every decision in this document. Work through the items
below in order; each is self-contained. Don't reopen the decisions listed first
without a new reason.

### Decided (don't re-litigate)

- One root `Watch()`; modes `.when(fn)` (single), `.when({...})` (set),
  `.eachOf(list).when(select)` (list). Terminals: `.detect()`, `.derive(initial,
  (derived, ...) => ...)`, `.changes(filter?).then(action)`. No `react`, no
  `becomes`, no direct `.then` on builders, no `exceptInitially`.
- First-poll rule: a first poll is a change from nothing (private `seen` flag,
  benchmarked faster than a sentinel). A `from` filter needs a previous value, so
  never fires on a first poll; `from: PREVIOUS` means "any previous value"; any
  `from` narrows `previous` to `V`. No first-poll filter bypass.
- List identity is positional (by array index, never by key); the rule "a slot's
  history belongs to its index, not its item" is documented, not patched.
- Callback argument order: `(value, previous)`, list adds `(item, index)`.

### Open design questions

1. **List mode has no aggregate reaction.** List `.then` fires once per changed
   item; set `.then` fires once per poll. "Did *any* enemy cross the threshold
   this frame?" - the original motivating example - needs either `.detect()`
   (`anyChanged` / `at(i)`) or a per-item reaction setting a flag. Decide whether
   to add an aggregate list reaction, and how it reads in the chain.
2. **Set mode `changes` accepts only nothing or `{ from: PREVIOUS }`.** There are
   no per-key filters. Confirm this is enough.
3. **`when` reads best for reactions.** "When rev... derive" and "when phase...
   detect" are a little implicit. Decide whether to accept this or find a better
   declaration verb (see the Naming table).
4. **Modes are selected two ways**: set by argument shape (`when({...})`), list
   by a method (`eachOf`). Confirm or make symmetric.
5. **Remaining naming choices** in the [Naming](#naming) table (`when`, `derive`,
   `changes`, `PREVIOUS`).
6. **Many reactions mean many `poll()` calls** in `refresh()`. Consider a
   grouping helper only if migration shows it gets noisy.

### Documentation to write (on promotion)

- Change-detection guide: the first-poll rule and `from: PREVIOUS` (draft
  wording in [Proposed surface](#proposed-surface)); the slot-history rule and
  the `SlotList` pairing (§4).
- Poll each terminal exactly once per frame (a second poll sees "no change"), and
  two terminals on the same getter read it twice.
- Watched-value objects are reused and mutated in place: never keep a reference
  across polls.
- Migration notes: `watch({...})` becomes `Watch().when({...}).detect()`;
  `ReactionBuilder` `runFirstTime: false` (its default) becomes
  `changes({ from: PREVIOUS, ... })`.
- Update references to `watch()` in `AGENTS.md`, the `docs/ai-agents/`
  skills, the glossary and `docs/public/llms.txt`.

### Promotion work

- Turn the spike (already in `src/common/`) into a real module: drop the
  `.spike` suffix, export it from the `#common` barrel, and keep the spike
  tests. Decide what happens to the existing
  `watch()` / `Watcher` in `src/common/watch.ts` (remove after migration, or keep
  as a deprecated alias).
- Migrate the ~38 files using `watch()`: simple sites to `.changes().then(...)`,
  interleaved ones (e.g. `src/common/pause-menu-view.ts`,
  `src/common/touch-input-view.ts`) to `.detect()`. Watch for `return` moving
  into a callback, where it no longer exits `refresh()`.
- Port `derive` from the `derive-util` branch: its docs
  (`docs/building-with-mvt/reacting-to-changes/deriving-values.md`) and demo
  (`src/demos/derive/`) onto `.derive(...)`.
- Port the four `ReactionBuilder` call sites in `mvt-workshop` (celebration view,
  two in `wheel-audio-view-2.ts`, `create-toggle-transition.ts`) if that repo
  adopts `Watch()`.

### Housekeeping

- ~~Add a row for 008 to [the notes README](../README.md).~~ Done.
- ~~Move the spike files from `proposals/` to `src/common/`.~~ Done
  (2026-09-24), so `npm run build` type-checks them.
- The first-poll benchmark was an inline Node script, not saved. Re-create it
  under `benchmarks/` if the number needs to be reproducible.

### New input since the design session

- The `change-detection` benchmark suite measures today's `watch()` at about
  8 ns per watched value per frame, over three times the cost of comparing by
  hand. See the docs' Performance Measurements page. Worth checking whether
  `Watch()` does better before promoting it.
