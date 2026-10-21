# Make Illegal States Unrepresentable (MISU)

> Shape a component's state so that a combination that makes no sense can't
> even be written. Instead of checking at run time that two flags never
> disagree, keep one value that says which state it is in. The compiler
> then rules out whole kinds of bug before the game ever runs.

**Previous:** [Design by Contract (DbC)](design-by-contract.md)

**Related:** [Architecture Overview](../index.md) ·
[Rules](../rules.md) ·
[Phase-Based Transitions](../../building-with-mvt/animating-transitions/phase-based-transitions.md) ·
[Single Source of Truth (SSOT)](single-source-of-truth.md)

**Note:** Examples are in TypeScript; see [why](index.md#examples-are-in-typescript).

---

## The Principle

Yaron Minsky of Jane Street gave the principle its name in his "Effective
ML" talk in 2010: **make illegal states unrepresentable**. A type describes
which values a variable can hold. Design it so that every value it allows
is a state that makes sense, and a state that doesn't make sense can't be
written down at all, by anyone, by mistake. ("Invalid" is a common variant
of "illegal"; they mean the same here.)

It picks up where the [Design by Contract](design-by-contract.md) page
leaves off. A contract states what must always be true of a
[component](../../reference/glossary.md), and an assertion checks it while
the game runs. A rule that the types enforce needs no assertion: the code
that would break it doesn't compile.

## Symptoms

The quick way to add a state is to add a flag. Here is a turret that
charges up, then fires at a target:

```ts
interface TurretState {
    isCharging: boolean;
    isFiring: boolean;
    chargeProgress: number;       // only meaningful while charging
    target: Enemy | undefined;    // only set while charging or firing
}
```

Four fields allow many combinations, and only three of them make sense:
idle, charging at a target, and firing at it. Now try a few ordinary
requests:

- **Draw the turret.** The view has to decide what to show when
  `isCharging` and `isFiring` are both true. That should never happen, but
  the type allows it, so someone has to handle it, or hope.
- **Add a cooldown after firing.** That is another flag, and more
  combinations. Every place that sets one flag must now remember to clear
  the others.
- **Test that firing clears the target.** The tests have to cover
  combinations that shouldn't exist, or trust that nothing ever produces
  them.

The same pattern across a game shows up as three symptoms:

- **Code guards against states that can't happen.** Or it doesn't, and
  one day they do.
- **Each new flag multiplies the cases.** Two flags make four
  combinations; three make eight. The legal ones stay few.
- **The rules live in every writer.** Nothing in the type says which
  combinations are allowed, so every piece of code that changes the state
  has to know.

## Applied to MVT: State Shaped to the Domain

### One union, not several flags

The same turret, with one value saying which state it is in, and each
state carrying only what belongs to it:

```ts
type TurretState =
    | { phase: 'idle' }
    | { phase: 'charging'; target: Enemy; progress: number }
    | { phase: 'firing'; target: Enemy };
```

Charging and firing at once can't be written. A target exists exactly when
there is one, and progress only while charging. TypeScript narrows on
`phase`: inside `if (state.phase === 'charging')`, it knows `progress` is
there, and outside it, it won't let you read it.

This shape is a **discriminated union**: a union of object types that
share one field, here `phase`, whose value says which of them a value is.
It is also called a *tagged union*, and in languages such as OCaml, F# and
Rust, where it is built in, a *variant* or *sum type*.

The shared field, the *discriminant*, can have any name. `kind` is the
most common; `type` would say the same, but is easily confused with
TypeScript's own types. `phase` suits the turret, because its states
follow one another over time.

States like these are everywhere in MVT's models, as a `phase` and, where
the phase takes time, one `progress` from 0 to 1.
[Phase-Based Transitions](../../building-with-mvt/animating-transitions/phase-based-transitions.md#why-a-single-progress-value)
shows why one progress value beats one per phase.
[Burrow Bust](https://github.com/yortus/mvt-games/tree/main/packages/sites/arcade/src/entries/burrow-bust)'s
rocks are `'stable'`, `'wobbling'`, `'falling'` or `'shattered'`, with one
`progress` through the current phase. The Arcade itself is `'browsing'`,
`'launching'`, `'revealing'` or `'playing'`, never two at once.

### Named values, not strings or numbers

A phase, a kind or a mode is a union of named values, never a plain
`string` or a numeric code ([M-domain](../rules.md#model-rules)). Burrow
Bust's tiles are:

```ts
type TileKind = 'surface' | 'dirt' | 'tunnel';
```

A typo, such as `'tunel'`, is a compile error. And a `switch` that handles
every case can be checked as complete, so adding a fourth kind can make the
compiler point at each `switch` that doesn't handle it yet:

```ts
function tileColour(kind: TileKind): number {
    switch (kind) {
        case 'surface': return SKY;
        case 'dirt': return EARTH;
        case 'tunnel': return SHADOW;
    }
}
```

This repo writes these as string-literal unions rather than `enum`s, a
convention of the [Style Guide](../../reference/style-guide.md); the
principle holds either way.

### Data that belongs to one kind lives in that kind

When different kinds of thing carry different data, each kind gets its own
shape. Neon Monsoon's
[stage events](https://github.com/yortus/mvt-games/blob/main/packages/sites/arcade/src/entries/neon-monsoon/data/stage-data.ts)
are a `SpawnEvent`, a `WarningEvent` or a `BossEvent`, a discriminated
union on `kind`. A spawn carries the
enemy, its path and its bullet patterns; a warning carries only its time.
A warning with a path can't be written, and code that handles a spawn
never has to check whether the enemy is there.

### State that only the owner can change

A model's interface exposes its state as `readonly`, and changes it only
through its own actions. Nothing outside can set an illegal combination;
each action moves the model from one legal state to another. What the
types can't express, the actions keep, and assertions check
([DbC](design-by-contract.md)).

Even `undefined` can say exactly what it means. The fruit machine's
`outcome` is "the current, or last, spin's result", typed
`SpinOutcome | undefined`, and documented as undefined before the first
spin. Code that reads it has to handle that case, because the type says
it exists.

## Practical Benefits

- **Bugs are caught before the game runs.** Code that would build an
  illegal state doesn't compile, so whole kinds of bug can't happen.
- **Fewer checks.** No assertion is needed for a state that can't be written,
  and a view that switches on a `phase` or a `kind` has no "impossible"
  branch.
- **The type is the documentation.** Reading `TurretState` tells you every
  state a turret can be in, and what each one holds.
- **Changes are guided.** Add a case to a union, and the compiler can
  point at each place that doesn't handle it yet.
- **Tests cover only real states.** There are no impossible combinations
  to test, or to forget to test.

## Practical Costs

- **On hot paths, at scale, it can cost too much.** A phase change for one
  model is too rare to matter. Thousands of entities each held as their
  own object are another matter. Neon Monsoon keeps its bullets as indices
  into typed arrays instead, which allocates nothing, but lets code read a
  bullet that no longer exists. The model documents the limit ("only
  meaningful for an index below `count`"); the
  [overview](index.md#when-principles-pull-against-each-other) walks through
  this trade.
- **Not every rule fits a type.** "Progress is between 0 and 1" or "the
  score never goes down" can't be written as a TypeScript type. Those stay
  as documented guarantees and assertions.
- **Union state is wordier to change.** Moving a turret from charging to
  firing replaces its whole state, rather than flipping a flag, and reading
  a field means narrowing first.
- **Interfaces are often flatter than the state.** A model usually exposes
  `phase` and `progress` as separate getters, simple for views to read, so
  `progress` exists even in phases that don't take time. It needs a settled
  value there, and its documentation should say what it is.
  [Open-Ended Phases](../../building-with-mvt/animating-transitions/open-ended-phases.md#why-progress-stays-at-1)
  holds it at 1, where the timed phase left it.

## Common Misreadings

- **Not "more types".** The aim is fewer possible states, not more type
  declarations. Sometimes the fix is deleting a field: a value that can be
  worked out from others can't disagree with them
  ([SSOT](single-source-of-truth.md)).
- **Not only for typed languages.** Keeping one value that names the
  state, instead of three booleans, rules out the same combinations in any
  language. Types add a
  check by the compiler on top.
- **Not instead of contracts.** Types state what they can; the rest stays
  in documented requirements and guarantees, checked by assertions.

## Checklist

Questions to ask of a design, or in a review:

- Are there two or more flags that should never be true together? Could
  they be one value that names the state, such as a `phase` or a `kind`?
- Is any field meaningful only in some states? Could it live only in those
  states?
- Is any phase, kind or mode a plain `string` or number, where a union of
  named values would list the options?
- Does every `switch` over a union handle every case, so the compiler can
  flag a new one?
- Can anything outside a model set its state directly?
- Is any stored value one that could be worked out from others, and so
  disagree with them?

## Rules It Underpins

| Rule | How it follows |
| --- | --- |
| [M-domain](../rules.md#model-rules) | States are named values from the domain (`'alive'`, `'exploding'`), so the set of possible states is written down, and nothing else can be stored |

## Further Reading

- Yaron Minsky,
  ["Effective ML Revisited"](https://blog.janestreet.com/effective-ml-revisited/),
  Jane Street blog (2011). The code from his 2010 "Effective ML" talk,
  including "make illegal states unrepresentable" and "code for
  exhaustiveness".
- Scott Wlaschin,
  ["Designing with types: Making illegal states unrepresentable"](https://fsharpforfunandprofit.com/posts/designing-with-types-making-illegal-states-unrepresentable/)
  (2013). A worked example, in F#, of turning a business rule into a type.

---

**Next:** [Design for Testability (DfT)](design-for-testability.md)
