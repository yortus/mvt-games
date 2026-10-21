# Command-Query Separation (CQS)

> Every operation either answers a question about state or changes it, not
> both. In MVT, the answering side is strict: reading a model never changes
> it, so any number of views can read it, in any order, and all see the
> same thing. Each tick keeps the two sides apart: first the models change,
> then the views read.

**Previous:** [Single Source of Truth (SSOT)](single-source-of-truth.md)

**Related:** [Architecture Overview](../index.md) ·
[Rules](../rules.md) ·
[Bindings](../bindings.md) ·
[The Ticker](../ticker.md)

**Note:** Examples are in TypeScript; see [why](index.md#examples-are-in-typescript).

---

## The Principle

Bertrand Meyer named the principle in *Object-Oriented Software
Construction* (1988), alongside his Eiffel language. It sorts every
operation into one of two kinds:

- A **query** answers a question. It returns a value, and changes nothing
  anyone can observe.
- A **command** changes state. It returns nothing.

It is often summed up as "asking a question should not change the answer."

The payoff is that queries are safe to call. Adding, removing or
reordering a query changes nothing else in the program. Only commands need
care, and with the two kinds kept apart, it's clear which calls are
commands. Martin Fowler's
short article on the principle puts the benefit this way: you can use
queries "with much more confidence, introducing them anywhere, changing
their order."

## Symptoms

When something happens in a model and a view needs to hear about it, it's tempting to mix commands and queries. Suppose the
[fruit machine demo](https://github.com/yortus/mvt-games/blob/main/packages/sites/arcade/src/entries/fruit-machine/README.md)
let its views know a spin had started with a flag that is cleared when it
is read:

```ts
// In the spin model: a question that answers once
let spinStarted = false;
function takeSpinStarted(): boolean {
    const started = spinStarted;
    spinStarted = false;
    return started;
}

// In the lever view: swing when a spin starts
function update(deltaMs: number) {
    if (bindings.takeSpinStarted()) startSwing();
    updateSwing(deltaMs);
}
```

The lever swings, and the first playtest passes. Now try a few ordinary
requests:

- **Log each spin in the terminal view too.** The terminal also calls
  `takeSpinStarted()`. Whichever view reads first gets `true`, and the
  other gets `false`. Which one misses the spin depends on the order of the
  views in the tree.
- **Test that a spin starts.** The test calls `takeSpinStarted()` to check,
  and takes the answer the lever needed. Checking the game changes the
  game.
- **Show the flag in the control panel**, beside the machine's other flags.
  The panel reads it every frame, and the lever never swings again.

The same pattern elsewhere in a game shows up as three symptoms:

- **Order matters where it shouldn't.** When reading changes state, the
  result depends on who reads first. Reordering views, or adding one,
  changes what the others see.
- **Looking changes what you see.** Tests, logging, debug overlays and
  assertions all read state. If reading changes it, observing a bug can
  move it or hide it.
- **Every reader has to know about every other.** Adding a reader is only
  safe once you know what the existing readers take, and when.

## Applied to MVT: Queries Change Nothing

The fix is to keep a trace that reading doesn't consume. The real fruit
machine keeps a [count](../../reference/glossary.md) of its spins, and each
reader notices the count rise. `watch()` remembers the last value it saw,
and its `increased` flag says whether the count went up since the last
poll:

```ts
// In the spin model
let spinCount = 0;
const model = {
    get spinCount() { return spinCount; }, // a query: changes nothing
    spin() { spinCount++; /* ... */ },     // a command
};

// In the lever view
const watcher = watch({ spins: bindings.spinCount });

function update(deltaMs: number) {
    if (watcher.poll().spins.increased) startSwing();
    updateSwing(deltaMs);
}
```

The fruit machine has four readers of that one count. Its
[audio view](https://github.com/yortus/mvt-games/blob/main/packages/sites/arcade/src/entries/fruit-machine/views/audio/machine-audio-view.ts)
watches it exactly this way, to play the lever's sound. The
[lever view](https://github.com/yortus/mvt-games/blob/main/packages/sites/arcade/src/entries/fruit-machine/views/three/lever-view.tsx)
does the same comparison by hand, to swing the lever. The terminal watches
the count to log each spin, and even notes when a spin was started from
another view, and the panel shows it as a number. None of them affects the
others, because reading `spinCount` changes nothing. What each watcher
remembers belongs to its view alone; the
[SSOT page](single-source-of-truth.md#common-misreadings) explains why such
a value is not a copy. [Counts: Moments That Repeat](../../building-with-mvt/reacting-to-changes/change-detection.md#counts-moments-that-repeat)
shows the pattern in more detail.

Every query binding is a query in this sense. The
[Bindings](../bindings.md#query-bindings) page says it plainly: a query
binding "never changes anything; it only returns a value." That is what
lets a view read its query bindings as often as it likes.

### Where commands come from

In an MVT game, state changes for two reasons only: time passes, or the
player does something.

- **Time** arrives through `update(deltaMs)`. The ticker calls it on the
  models, and each model changes its own state, and its children's.
- **Input** arrives through relay bindings. A view reports what the player
  did (`onFirePressed`), and the wiring turns that into a command on a
  model. The fruit machine's views call `spin()` when the player presses
  SPIN.

Input events are handled between ticks. A view can also report something
from its own `update` step, such as a release it was waiting to send.
Either way, no command lands while views are refreshing, which is when it
would matter.

### The tick: commands, then queries

The ticker runs the two kinds of operation in two phases. First, every
model updates: the commands. Then every view refreshes: the queries, each
view reading the models and writing its own output. Views with
[presentation state](../../building-with-mvt/adding-visual-polish/presentation-state.md)
update in between, changing their own state, or reporting input through a
relay binding.

Because no query changes anything, the views can refresh in any order, and
each one sees the same finished state. No view sees a world that another
view has half changed. That is how the
[goal](index.md#the-goal) holds in a game redrawn sixty times a second:
views can be added, removed or reordered without knowing about each other,
and every frame still shows one consistent world.

## Practical Benefits

- **Any number of views, in any order.** Adding a view can't change what
  another view sees. The fruit machine shows one model through four views,
  and any of them can be removed without the others noticing.
- **Reading is safe for every tool.** Tests, logging, debug overlays and
  assertions can read any model at any moment, and the game carries on
  exactly as it would have. This is also what lets
  [contracts](design-by-contract.md) check state freely: an assertion that
  calls a query can't change the outcome it checks.
- **Refreshing is repeatable.** Since `refresh()` only reads models, running
  it twice from the same state gives the same output. A test can refresh a
  view once and look; a thumbnail can be drawn from a model that isn't
  running.
- **Changes have known entry points.** State changes in `update`, or in a
  command called from input. When a value is wrong, those are the places to
  look.

## Practical Costs

- **Every event needs a trace.** A flag that answers once is the easy way
  to report that something happened, and it is ruled out. Instead the
  model keeps something readable, such as a count, and each interested view
  watches it rise. It is a little more code than a flag, though `watch()`
  keeps it to a line or two per view.
- **Some commands are handier with an answer.** In strict CQS, a command returns
  nothing, and a caller who wants to know what happened asks a query
  afterwards. This repo relaxes that half: a command may report what it
  just did. Burrow Bust's `inflate()` returns whether the enemy popped, and
  the fruit machine's `spin()` returns a promise of the spin's outcome. The
  condition is that the same answer can also be read as state afterwards:
  the enemy's `phase` is `'popped'`, and the machine's `outcome` holds the
  result. The return value is a convenience, never the only way to find
  out. The query half is never relaxed.
- **A random source is the one real exception.** A seeded random source's
  `next()` moves the sequence on, and returns a number that can't be read
  again afterwards. It is the classic exception, like popping a stack,
  which Fowler also allows. It stays harmless because it is private to a
  model: only the model's own commands call it, and what they decide with
  it becomes readable state, such as the fruit machine's `outcome`. Views
  never call it, so reading a model still changes nothing.

## Common Misreadings

- **A query may keep a private cache.** What a query must not change is
  state anyone can observe. A query that remembers its last result to save
  recomputing it is still a query, as long as no caller can tell. Fowler's
  article makes the same point: the rule is about observable state.
- **A relay binding is not a command.** It reports what the player did,
  such as `onFirePressed`, and decides nothing. The wiring decides which
  command, if any, it leads to. See
  [Relay Bindings and Input Handling](../bindings.md#relay-bindings-and-input-handling).
- **A view that writes output is not breaking a query.** `refresh()`
  changes the view's own output; that is its job. Towards the models, it is
  read-only, and that is where CQS applies.
- **Not CQRS.** Command Query Responsibility Segregation, described by
  Greg Young and in
  [Fowler's article on it](https://martinfowler.com/bliki/CQRS.html), splits
  a system into separate models for reading and for writing. MVT keeps one
  model, which queries read and commands change. The names are related; the
  designs are not.

## Checklist

Questions to ask of a design, or in a review:

- Does any getter or query binding change anything a caller could observe?
- Does any model clear, consume or reset state when it is read?
- If a second reader of any value were added, would both readers see the
  same answer?
- Does any view change a model during `refresh()`?
- Does any command return an answer that can't also be read from state
  afterwards?
- Is anything that both answers and changes state, such as a random source,
  called only from inside commands?

## Rules It Underpins

| Rule | How it follows |
| --- | --- |
| [V-readonly](../rules.md#view-rules) | `refresh()` reads the models through queries, so it never changes them |
| [V-idempotent](../rules.md#view-rules) | Queries change nothing, so refreshing twice from the same state gives the same output |
| [V-refresh](../rules.md#view-rules) | Views read after all models have updated: the query phase follows the command phase |
| [T-sequence](../rules.md#ticker-rules) | Commands finish before queries begin, so no view sees a half-updated world |
| [B-contract](../rules.md#binding-rules) | Query bindings answer and relay bindings report, and the bindings type says which is which |

## Further Reading

- Bertrand Meyer, *Object-Oriented Software Construction* (1988; 2nd ed.,
  1997). The origin of the principle, in the same book where Meyer sets out
  Design by Contract.
- Martin Fowler,
  ["Command Query Separation"](https://martinfowler.com/bliki/CommandQuerySeparation.html)
  (2005). A short case for the principle, the stack `pop()` exception, and
  why the rule is about observable state.

---

**Next:** [Dependency Inversion Principle (DIP)](dependency-inversion.md)
