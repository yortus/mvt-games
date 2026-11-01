# Command-Query Separation (CQS)

> Every operation either answers a question about state or changes it, not
> both. In MVT, the query side is strict: reading a model never changes
> it, so any number of views can read it, in any order, and all read the
> same state. Each tick keeps the two sides apart: first the models change,
> then the views read.

**Related:** [Why MVT](02-why-mvt.md) ·
[Rules](../appendices/a-mvt-on-one-page.md) ·
[Bindings](08-bindings.md) ·
[The Tick](05-the-tick.md)

---

## The Principle

Bertrand Meyer named the principle in *Object-Oriented Software
Construction* (1988), alongside his Eiffel language. It sorts every
operation into one of two kinds:

- A **query** answers a question. It returns a value, and doesn't change
  any state that a caller can observe.
- A **command** changes state. It doesn't return a value.

It is often summed up as "asking a question should not change the answer."

The payoff is that queries are safe to call. Adding, removing or
reordering a query doesn't change anything else in the program. Only
commands need care, and with the two kinds kept apart, it's clear which
calls are commands. Martin Fowler's
short article on the principle puts the benefit this way: you can use
queries "with much more confidence, introducing them anywhere, changing
their order."

## Symptoms

When something happens in a model and a view needs to respond to it, it's
tempting to mix commands and queries. Suppose the
[fruit machine demo](https://github.com/yortus/mvt-games/blob/main/packages/sites/demos/src/entries/fruit-machine/README.md)
signalled to its views that a spin had started, with a flag that is
cleared when it is read:

```ts
// In the spin model: a query that returns true only once
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
  and consumes the `true` that the lever needed. Checking the game changes the
  game.
- **Show the flag in the control panel**, beside the machine's other flags.
  The panel reads it every frame, and the lever never swings again.

The same pattern elsewhere in a game shows up as three symptoms:

- **Order matters where it shouldn't.** When reading changes state, the
  result depends on which caller reads first. Reordering views, or adding
  one, changes what the others read.
- **Looking changes what you see.** Tests, logging, debug overlays and
  assertions all read state. If reading changes it, observing a bug can
  move it or hide it.
- **Every reader depends on every other.** Adding a reader is only safe
  once you know what the existing readers consume, and when.

## Applied to MVT: Queries Never Change State

The fix is to keep a trace that reading doesn't consume. The real fruit
machine keeps a [count](../appendices/b-glossary.md) of its spins, and each
reader notices the count rise. A
[reaction](09-noticing-changes.md)
stores the last value it read, and with `when: increased`, it acts only
when the count went up since then:

```ts
// In the spin model
let spinCount = 0;
const model = {
    get spinCount() { return spinCount; }, // a query: doesn't change state
    spin() { spinCount++; /* ... */ },     // a command
};

// In the lever view
const startSwingOnEachSpin = createReaction({
    watch: bindings.spinCount,
    when: increased,
    react: () => startSwing(),
});

function update(deltaMs: number) {
    startSwingOnEachSpin();
    updateSwing(deltaMs);
}
```

The fruit machine has four readers of that one count. Its
[audio view](https://github.com/yortus/mvt-games/blob/main/packages/sites/demos/src/entries/fruit-machine/views/audio/machine-audio-view.ts)
reacts to it exactly this way, to play the lever's sound. The
[lever view](https://github.com/yortus/mvt-games/blob/main/packages/sites/demos/src/entries/fruit-machine/views/three/lever-view.tsx)
does the same comparison by hand, to swing the lever. The terminal watches
the count to log each spin, and even records when a spin was started from
another view, and the panel shows it as a number. The readers don't affect
each other, because reading `spinCount` doesn't change any state. The last
value that each reader stores belongs to its view alone. The
[SSOT chapter](27-single-source-of-truth.md#common-misreadings) explains why
such a value is not a copy.
[Noticing Changes](09-noticing-changes.md) shows the pattern
in more detail.

Every query binding is a query in this sense.
[Chapter 8, Bindings](08-bindings.md), defines it that way: a
query binding never changes any state, and only returns a value. This is
why a view can read its query bindings any number of times.

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
Either way, commands never run while views are refreshing, which is when
it would matter.

### The tick: commands, then queries

The ticker runs the two kinds of operation in two phases. First, every
model updates: the commands. Then every view refreshes: the queries, each
view reading the models and writing its own output. Views with
[presentation state](11-presentation-state.md)
update in between, changing their own state, or reporting input through a
relay binding.

Because queries never change state, the views can refresh in any order,
and each one reads the same finished state. Views never see a world that
another view has half changed. That is how the
[goal](25-the-eight-principles.md#the-goal) holds in a game
redrawn sixty times a second:
views can be added, removed or reordered without referencing each other,
and every frame still shows one consistent world.

## Practical Benefits

- **Any number of views, in any order.** Adding a view can't change what
  another view reads. The fruit machine shows one model through four views,
  and any of them can be removed without affecting the others.
- **Reading is safe for every tool.** Tests, logging, debug overlays and
  assertions can read any model at any moment, and the game carries on
  exactly as it would have. This is also why
  [contracts](31-design-by-contract.md) can check state freely: an
  assertion that calls a query can't change the outcome it checks.
- **Refreshing is repeatable.** Since `refresh()` only reads models, running
  it twice from the same state produces the same output. A test can refresh a
  view once and look; a thumbnail can be drawn from a model that isn't
  running.
- **Changes have known entry points.** State changes in `update`, or in a
  command called from input. When a value is wrong, those are the places to
  look.

## Practical Drawbacks

- **Every event needs a trace.** A flag that returns true only once is the
  easy way to report that something happened, and CQS rules it out. Instead the
  model keeps something readable, such as a count, and each interested view
  watches it rise. It is a little more code than a flag, though a reaction
  keeps it to a few lines per view.
- **Some commands are handier with a return value.** In strict CQS, a
  command doesn't return a value, and a caller that needs the result calls
  a query afterwards. This repo relaxes that half: a command may report what it
  just did. Burrow Bust's `inflate()` returns whether the enemy popped, and
  the fruit machine's `spin()` returns a `Promise` of the spin's outcome.
  The condition is that the same result can also be read as state
  afterwards: the enemy's `phase` is `'popped'`, and the machine's
  `outcome` holds the result. The return value is a convenience, never the
  only way to get the result. The query half is never relaxed.
- **A random source is the one real exception.** A seeded random source's
  `next()` moves the sequence on, and returns a number that can't be read
  again afterwards. It is the classic exception, like popping a stack,
  which Fowler also allows. It stays harmless because it is private to a
  model: only the model's own commands call it, and the results they
  compute with it become readable state, such as the fruit machine's
  `outcome`. Views never call it, so reading a model still doesn't change
  any state.

## Common Misreadings

- **A query may keep a private cache.** A query must not change any state
  that a caller can observe. A query that stores its last result, to avoid
  recomputing it, is still a query, as long as callers can't tell the
  difference. Fowler's
  article makes the same point: the rule is about observable state.
- **A relay binding is not a command.** It reports what the player did,
  such as `onFirePressed`, and doesn't decide anything. The wiring decides which
  command, if any, it leads to. See
  [Bindings](08-bindings.md).
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

- Does any getter or query binding change any state that a caller could
  observe?
- Does any model clear, consume or reset state when it is read?
- If a second reader of any value were added, would both readers read the
  same value?
- Does any view change a model during `refresh()`?
- Does any command return a result that can't also be read from state
  afterwards?
- Is anything that both returns state and changes it, such as a random
  source, called only from inside commands?

## Rules Built on CQS

| Rule | How it follows |
| --- | --- |
| [V-readonly](../appendices/a-mvt-on-one-page.md#view-rules) | `refresh()` reads the models through queries, so it never changes them |
| [V-idempotent](../appendices/a-mvt-on-one-page.md#view-rules) | Queries never change state, so refreshing twice from the same state gives the same output |
| [V-refresh](../appendices/a-mvt-on-one-page.md#view-rules) | Views read after all models have updated: the query phase follows the command phase |
| [T-sequence](../appendices/a-mvt-on-one-page.md#ticker-rules) | Commands finish before queries begin, so views never see a half-updated world |
| [B-contract](../appendices/a-mvt-on-one-page.md#binding-rules) | Query bindings return values and relay bindings report input, and the bindings type says which is which |

## Further Reading

- Bertrand Meyer, *Object-Oriented Software Construction* (1988; 2nd ed.,
  1997). The origin of the principle, in the same book where Meyer sets out
  Design by Contract.
- Martin Fowler,
  ["Command Query Separation"](https://martinfowler.com/bliki/CommandQuerySeparation.html)
  (2005). A short case for the principle, the stack `pop()` exception, and
  why the rule is about observable state.
