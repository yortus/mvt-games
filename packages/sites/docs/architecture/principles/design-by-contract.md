# Design by Contract (DbC)

> Every component states what it requires of its callers and what it
> guarantees in return, and fails loudly when either side is broken. A
> broken requirement is the caller's bug; a broken guarantee is the
> component's own. Either way, the program stops where the fault is, rather
> than carrying on and failing somewhere else.

**Previous:** [Composite Reuse Principle (CRP)](composite-reuse.md)

**Related:** [Architecture Overview](../index.md) ·
[Rules](../rules.md) ·
[Bindings](../bindings.md) ·
[Dependency Inversion Principle (DIP)](dependency-inversion.md)

**Note:** Examples are in TypeScript; see [why](index.md#examples-are-in-typescript).

---

## The Principle

Bertrand Meyer named the principle in 1986, for his Eiffel language, and
built it on a metaphor from business: a contract between a client and a
supplier. Each side has obligations, and each side benefits from the
other's.

- A **requirement** (Meyer's *precondition*) is what must be true before a
  call. Meeting it is the caller's obligation. In return, the
  [component](../../reference/glossary.md) doesn't have to handle anything
  outside it.
- A **guarantee** (a *postcondition*) is what will be true after the call.
  Keeping it is the component's obligation, and it is what the caller gets.
- An **invariant** is what is always true of the component, between calls.

This page takes them in that order, requirements before guarantees,
because that is the order they apply in time.

The contract is part of the component, not just documentation. Writing it down
before coding means *deciding* exactly what a component needs and promises.
*Checking it* in code turns a broken contract into an immediate, specific
failure, at the point where it happened.

## Symptoms

The easy way to handle a call that comes at the wrong time is to ignore
it. Suppose the [fruit machine](https://github.com/yortus/mvt-games/blob/main/packages/sites/arcade/src/entries/fruit-machine/README.md)'s
`spin()` did that:

```ts
spin() {
    if (phase !== 'idle') return; // quietly does nothing
    // ...take the bet, decide the result, start the reels
}
```

Nothing ever crashes. Now try a few ordinary requests:

- **Find out why the spin button sometimes does nothing.** A player taps
  it during the win display, and nothing happens or is reported. Finding
  the cause means reading every caller.
- **Let a spin during the win display skip it and spin again.** Some view
  calls `spin()` on every tap, and counts on extra taps being ignored.
  Changing the model breaks it, though nothing ever promised the quiet
  return.
- **Grey out the spin button when it won't work.** The view has to work
  out `phase === 'idle'` for itself. The rule now lives in two places, and
  they drift apart when the model's rule changes.

The same pattern across a game shows up as three symptoms:

- **Faults surface far from their cause.** A call that should have failed
  carries on, and the state it leaves behind fails later, somewhere else.
- **Accidents become promises.** Callers rely on whatever the code
  happens to do. Hyrum Wright put this as Hyrum's Law: "With a sufficient
  number of users of an API, it does not matter what you promise in the
  contract: all observable behaviors of your system will be depended on by
  somebody."
- **Callers guess.** With no stated requirement, each caller works out
  when a call is safe, and each works it out differently.

## Applied to MVT: Contracts Everywhere

### Requirements, then guarantees

The real fruit machine states both sides of every action in its interface:

```ts
/** True when `spin()` may be called: when idle. */
readonly canSpin: boolean;
/**
 * Take the bet, decide the result, and spin. Resolves with the result
 * once the machine is idle again (or the game is over): after the
 * reels land and any celebration ends. ...Needs `canSpin`.
 */
spin: () => Promise<SpinOutcome>;
```

The requirement is `canSpin`. The guarantee is the rest: take the bet,
decide the result, and resolve when the machine is idle again.

### A broken requirement throws

When the requirement isn't met, `spin()` doesn't return quietly. It throws:

```ts
spin() {
    assert(model.canSpin, () => `spin() needs canSpin, but the machine is ${phase}`);
    // ...
}
```

A call that breaks a requirement is a bug in the caller, and the sooner it
fails, the closer the failure is to the bug. A quiet return would also
widen the contract for good: by Hyrum's Law, some caller would soon rely on
it, and the requirement could never be enforced again.

For this to be fair, the caller has to be able to check the requirement
before calling. Meyer made that a rule: a requirement must use only what
the caller can see. So every action with a requirement has a matching
query that *is* the requirement, usually named after the action: `spin()`
and `canSpin`, `stop()` and `canStop`. The fruit machine's views check it,
and nothing else: they spin only `if (model.canSpin)`, and the panel greys
out its button with `disabled={() => !model.canSpin}`. The rule lives in
one place, in the model ([SSOT](single-source-of-truth.md)).

::: info Not every action needs a `can*` query
An action with no requirement needs no query: one that is always `true`
says nothing. And where the component already has a query that matches the
requirement exactly, no new one is needed. `SlotList`'s `insert()` requires
a free slot, and `isFull` already says whether there is one. A `stop()`
that needs the reels turning could likewise rely on an existing
`isSpinning`. What matters is that one query states the requirement
exactly, not what it is called.
:::

The work is in choosing the requirement. Not every call that does nothing
is a broken requirement:

- **No meaning in this state: a requirement.** `spin()` while the reels
  turn has no sensible meaning, so it gets a requirement, a `can*` query,
  and a throw.
- **A game meaning: documented behaviour.** Pressing fire while the gun
  cools down is a real event, and the game's rule is that nothing happens.
  That is a guarantee, written down on purpose, not a broken requirement.
  Neon Monsoon's
  [bullet field](https://github.com/yortus/mvt-games/blob/main/packages/sites/arcade/src/entries/neon-monsoon/models/bullet-field.ts)
  does this: `fire()` "returns false, and fires nothing, when the field is
  full, so an over-dense pattern thins out rather than failing."

### A broken guarantee throws too

A component that can't keep a guarantee throws too, rather than returning
something that looks like success. `@mvtjs/pixi`'s texture registry
guarantees a texture for every name it was given. If the spritesheet lacks
one, it throws, naming the texture and the sheet, rather than handing back
a placeholder that would show up later as a blank sprite. The same goes for
what a component requires when it is built: the fruit machine's model
asserts that its first reel has no wilds, because its win evaluation relies
on that.

::: tip `assert()`: a contract you can run
Each check on this page is one line, `assert(condition, message)` from
`@mvtjs/utils`, which throws with the message when the condition is false.
It reads as a statement of the contract, and runs as a check of it:

```ts
// A guarantee, in the texture registry
assert(texture, () => `Texture '${value}' not found after loading '${spritesheetUrl}'`);

// A requirement on what the fruit machine is built with
assert(!strips[0].includes('wild'), 'The first reel has no wilds: a way takes its picture from it');
```

A message built from values is passed as a function, so it is built only
on failure. In TypeScript, `assert` also narrows types: after
`assert(texture, ...)`, the compiler knows `texture` is defined.
:::

### Bindings are contracts

A view's [bindings](../bindings.md) are its contract with the rest of the
game ([B-contract](../rules.md#binding-rules)). Each query binding's type
says how strong a requirement it makes:

| Declared as | The view requires | The view guarantees |
| --- | --- | --- |
| `T` | A fixed value | Nothing about later changes |
| `() => T` | A function, even for a fixed value | To follow the value as it changes |
| `T \| (() => T)` (this repo's `ValueOrGetter<T>`) | Either | To follow it, when given a function |

A view that declares `() => T` but reads it only once has broken its own
guarantee ([V-reactive](../rules.md#view-rules)). Relay bindings are
usually optional ([B-optional](../rules.md#binding-rules)), which is a
view requiring less: it works whether or not anyone listens.

### Evolving a contract safely

A contract can change without breaking anyone in only two ways:

> **Require less, or guarantee more.**

A caller that met the old requirement still meets a weaker one, and a
caller that relied on the old guarantee still gets it. The reverse breaks
someone. The [Bindings](../bindings.md#fixed-values-and-getters)
page shows this for query bindings: widening a value-only binding to
accept either form leaves every caller working.

Three habits follow:

- **Require strictly at first.** A requirement can be loosened later, but
  never tightened.
- **Guarantee little at first.** A promise can be added later, but never
  withdrawn, and by Hyrum's Law, anything observable is a promise.
- **Leave room to grow.** An options object can take a new, optional field
  without breaking a caller; a fixed list of parameters cannot.

Each habit has a price. Neon Monsoon's `fire()` takes positional
parameters, not an options object, because it runs thousands of times a
second, and a new object on every call would leave thousands of objects a
second for the garbage collector. That gives up room to grow, on purpose,
for the [hot path](../../building-with-mvt/performance/hot-paths.md).

How much these habits matter depends on the work:

- **Maintaining a library**, such as the published `@mvtjs` packages, or
  views shared by several games. Its callers are in code its maintainers
  never see, so a contract changed the wrong way breaks them beyond reach.
  Here the habits are rules.
- **Making a game.** A game's own models are called only from the same
  repo, so a broken caller is one search and one edit away. Here the
  habits are good practice. The contracts themselves matter just as much.

The same rule has two better-known names. Barbara Liskov's **substitution
principle** applies it to replacements rather than versions: a stand-in
must require no more and guarantee no less. And Meyer's **open-closed
principle** asks that a component can be extended without being edited,
which a contract that only grows makes possible.

## Practical Benefits

- **Faults stop where they start.** A broken requirement throws in the
  caller that broke it, with a message that says what was needed.
- **The interface is the manual.** Each action states its requirement and
  its guarantee, so reading the interface is enough to use it correctly.
- **Tests write themselves.** A contract says what to check: the
  requirement's throw, and each guarantee.
  [Design for Testability](design-for-testability.md) takes this further.
- **Change is safe in two ways.** A component can grow, by requiring less
  or guaranteeing more, without a search for everyone it might upset.

## Practical Costs

- **Choosing requirements takes thought.** Each action needs a decision:
  is a call in this state meaningless, or does it have a game meaning?
  Get it wrong, and either players hit a throw where they expected nothing
  to happen, or a quiet return hides a bug.
- **Checks cost time.** An `assert` is cheap, but it runs on every call.
  On a hot path, a plain `if` and `throw` costs only the condition.
- **Throwing stops the game.** A broken contract in a released game
  crashes it, where a quiet return might have let it limp on. The trade is
  deliberate: the crash happens where the bug is, and gets fixed.

## Common Misreadings

- **Not defensive programming.** Defensive code checks everything,
  everywhere, and tries to recover. A contract checks once, at the
  boundary, and doesn't recover from a caller's bug: it reports it.
- **Not "every early return throws".** A call with a game meaning that
  does nothing is documented behaviour, and stays a quiet return.
- **Not just types.** A type states part of a contract: what kind of value
  goes in and comes out. The rest (`canSpin` must be true; the promise
  resolves when idle) lives in the documentation and the asserts. The next
  page, [MISU](illegal-states-unrepresentable.md), moves as much as it can
  into the types.

## Checklist

Questions to ask of a design, or in a review:

- Does each public action state its requirement and its guarantee?
- Does each action with a requirement have a query that is exactly that
  requirement (usually `can*`), and does the action assert it?
- Does any action return quietly when called at the wrong time? If so, is
  that a game rule, documented as such?
- Does any component return something that looks like success when it
  couldn't do what it promised?
- Do callers check that query, rather than repeating the rule behind it?
- Does any change to a contract require more, or guarantee less? Who
  might it break?

## Rules It Underpins

| Rule | How it follows |
| --- | --- |
| [B-contract](../rules.md#binding-rules) | A view's bindings are its contract: what it requires, and what it guarantees in return |
| [B-optional](../rules.md#binding-rules) | An optional relay binding is a view requiring less, so it works in more places |
| [V-reactive](../rules.md#view-rules) | A query binding declared as a function is a guarantee to follow changes, which reading it once would break |
| [T-cap](../rules.md#ticker-rules) | A model may require small steps of time; the ticker guarantees them, however long the gap since the last frame |

## Further Reading

- Bertrand Meyer, *Object-Oriented Software Construction* (1988; 2nd ed.,
  1997). Design by Contract in full, with preconditions, postconditions,
  invariants, and the open-closed principle.
- Bertrand Meyer, "Applying 'Design by Contract'", *IEEE Computer* (1992).
  A shorter introduction.
- Barbara Liskov and Jeannette Wing, "A Behavioral Notion of Subtyping",
  *ACM Transactions on Programming Languages and Systems* (1994). The
  substitution principle, stated in terms of contracts.
- Hyrum Wright, ["Hyrum's Law"](https://www.hyrumslaw.com/). Why every
  observable behaviour becomes part of the contract.

---

**Next:** [Make Illegal States Unrepresentable (MISU)](illegal-states-unrepresentable.md)
