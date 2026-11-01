# Dependency Inversion Principle (DIP)

> A component never reaches out for the things it uses. It declares what
> it needs, as a small interface of its own, and the code that creates it
> supplies them. In MVT that covers everything a component depends on but
> doesn't own: other models, the random numbers it draws, and time itself,
> which arrives as `deltaMs`.

**Related:** [Why MVT](02-why-mvt.md) ·
[Rules](../appendices/a-mvt-on-one-page.md) ·
[Bindings](08-bindings.md) ·
[Time and Phases](06-time-and-phases.md)

---

## The Principle

Robert C. Martin set out the principle in 1996, in two parts:

> High-level modules should not depend on low-level modules. Both should
> depend on abstractions. Abstractions should not depend on details.
> Details should depend on abstractions.

Put plainly: a [component](../appendices/b-glossary.md) shouldn't import
the particular things it works with. It describes what it needs, as an
interface, and the code that creates it passes in an implementation. The usual
direction of dependency, from the component down to whatever it uses, is
turned around. Both now depend on the interface, and the interface belongs
to the component that uses it.

Passing a component its dependencies from outside is often called
**dependency injection**. It doesn't need a framework: a parameter will
do.

## Symptoms

Reaching out is the shortest way to get something. Here is a drone that
turns towards the player every second, with a little randomness, written
that way:

```ts
import { player } from '../game-state';

function createDroneModel() {
    let heading = 0;
    let lastTurnMs = performance.now();
    // ...x and y

    function update() {
        const nowMs = performance.now();
        if (nowMs - lastTurnMs > TURN_INTERVAL_MS) {
            lastTurnMs = nowMs;
            heading = Math.atan2(player.y - y, player.x - x) + (Math.random() - 0.5);
        }
        // ...move along heading
    }
    // ...
}
```

It works, and its signature doesn't declare any dependencies. In fact it
reaches for
three things: another module's live state (`player`), the clock
(`performance.now()`), and the global random source (`Math.random()`).
Now try a few ordinary requests:

- **Test that it turns towards its target.** The test has to set up the
  real `player`, wait a real second, and accept whatever random number
  comes out.
- **Pause the game.** The clock keeps running. When play resumes, the
  drone turns at once, because `performance.now()` has moved on by more
  than a second.
- **Make a drone that chases the ball.** The drone imports `player` by
  name, so a second kind of target means editing it, or copying it.

The same pattern across a game shows up as three symptoms:

- **Needs are hidden.** A component's signature doesn't say what it uses.
  You find out by reading every line, or when something breaks.
- **Components can't be tested alone.** Every test has to set up the real
  things that the component reaches for, and some of them, like the clock,
  can't be set up at all.
- **Changes ripple.** Renaming a field in `game-state` breaks the drone,
  and every other component that reaches into it.

## Applied to MVT: Declared Needs, Supplied from Outside

The same drone, declaring its needs instead:

```ts
interface DroneOptions {
    target: { readonly x: number; readonly y: number };
    random: () => number; // in [0, 1)
}

function createDroneModel({ target, random }: DroneOptions) {
    let heading = 0;
    let msUntilTurn = 0;
    // ...x and y

    function update(deltaMs: number) {
        msUntilTurn -= deltaMs;
        if (msUntilTurn <= 0) {
            msUntilTurn = TURN_INTERVAL_MS;
            heading = Math.atan2(target.y - y, target.x - x) + (random() - 0.5);
        }
        // ...move along heading, by SPEED * deltaMs
    }
    // ...
}
```

Its three needs now come in three declared ways: the target and the random
source as options, and time as the argument to `update`. Each of the
requests above becomes simple:

- **Test it:** start a drone at the origin, give it a target at
  `{ x: 10, y: 0 }` and a random source that always returns `0.5`, and call
  `update(TURN_INTERVAL_MS)`. Its heading is now exactly `0`, straight at
  the target.
- **Pause:** the ticker stops calling `update`, and time stops for the
  drone.
- **Chase the ball:** pass the ball as the target. Anything with an `x`
  and a `y` will do.

### Time is a dependency too

The clock is the dependency that games reach for most, and MVT never lets
a model read it. Time arrives as a number, `deltaMs`, passed to `update` by
the ticker, which is the only MVT component that reads a clock
([M-time](../appendices/a-mvt-on-one-page.md#model-rules)). The
[SoC chapter](26-separation-of-concerns.md) showed the benefit: a model that
can be tested and paused. It is the same move as the drone's target, made
for time. The model doesn't call the clock; the ticker calls the model.

Random numbers are a dependency in the same way. The
[falling sand demo](https://github.com/yortus/mvt-games/blob/main/packages/sites/demos/src/entries/falling-sand/models/grain-grid/grain-grid.ts)
takes its random source as an option, and Neon Monsoon's game model takes
a seed, so that the same input replays the same game.

### Bindings are declared needs

A leaf view's [bindings](08-bindings.md) are the same idea, for
presentation. Burrow Bust's HUD view declares what it needs, as functions
it will call (abridged):

```ts
interface HudViewBindings {
    score: () => number;
    lives: () => number;
}
```

The game view, which builds the HUD, supplies them:
`score={() => model.score}`. The HUD doesn't import the model, and doesn't
depend on which model, if any, is behind the numbers. The bindings type belongs
to the view, not to the model: it is written for what the view needs, and
the wiring adapts the model to it
([B-contract](../appendices/a-mvt-on-one-page.md#binding-rules), [B-wiring](../appendices/a-mvt-on-one-page.md#binding-rules)).

In Alistair Cockburn's terms, from his "ports and adapters" (hexagonal)
architecture, a view's bindings type, taken as a whole, is its port to the
rest of the game: each binding is a member of it, not a port of its own.
The wiring where the view is built is one adapter for that port, and a
test that supplies plain values and small functions is another.

### Between models

Models declare their needs from each other in the same way.
[Burrow Bust](https://github.com/yortus/mvt-games/tree/main/packages/sites/arcade/src/entries/burrow-bust)'s
enemy model takes its chase target as an option:

```ts
/** Live reference to the chase target (typically the digger). */
chaseTarget: { readonly row: number; readonly col: number };
```

The game model passes the digger model in. The enemy never imports the
digger. It requires only a row and a column, so a test can pass
`{ row: 3, col: 4 }`, and a later version of the game could have enemies
chase something else entirely.

### Building its own children

One kind of dependency that a model does take directly: a parent model
imports
its children's factories and builds them itself. Burrow Bust's game model
imports `createFieldModel`, `createDiggerModel`, `createRockModel` and
`createEnemyModel`, and calls them. That looks like the reaching out this
chapter warns against, but it isn't, for three reasons:

- **It imports code, not state.** A factory makes a fresh child each time
  it is called. The drone's problem was reaching for a `player` that
  something else owned. A parent owns what it builds.
- **The child is part of the parent.** Code outside the game model never
  shares its digger. The children are how the game model does its job,
  built and replaced along with it (each new level builds new ones). They
  are an implementation detail, not a need. Declaring them as options
  would only push the job onto the code that creates the game model,
  which shouldn't need to reference a separate digger model at all.
- **The parent is where the wiring happens.** Some code has to create the
  concrete components and pass each one its dependencies, and in MVT that
  is the parent ([M-composition](../appendices/a-mvt-on-one-page.md#model-rules)). The
  game model creates the enemy and passes it the digger as its chase
  target. The enemy depends only on its declared need; only the parent
  references the digger that fills it.

Declare a child as a need instead when it has to vary: when the caller
should choose it (a different enemy brain on each level), when something
else owns or shares it, or when a test needs to replace it. And when a
child needs something from outside the game, such as random numbers, the
parent passes that need down, rather than the child reaching for it.

### Small declared needs

That last example shows two more principles at work, usually named on their
own:

- **The Interface Segregation Principle** (Martin): a component shouldn't depend
  on more of an interface than it uses. The enemy declares a row and a
  column, not the whole digger model, with its harpoon and its lives.
- **The Law of Demeter** (Lieberherr and Holland): a component should use
  what it receives, and not reach through it to things further away. A HUD
  that receives `lives` doesn't need `model.player.stats.lives`, and
  doesn't break when that path changes.

Both keep a declared need small, and a small need is easy to supply, easy
to replace in a test, and slow to change.

## Practical Benefits

- **Tests are simple to set up.** A component's needs are plain values and
  small functions, so a test supplies them directly: a fixed position, a
  random source that returns `0.5`, a `deltaMs` of exactly one second. A
  test doesn't need a library of test doubles, or a real game around the
  component.
- **Time control works without extra code.** Because time is supplied,
  the ticker can pause it, slow it down, speed it up or step it one frame
  at a time, and every model follows.
- **Replays are exact.** Seed the random source, record the input and the
  time steps, and the same game plays out again, frame for frame.
- **Components are reusable.** The enemy can chase anything with a row and a
  column, and the HUD can show any numbers. The enemy and the HUD don't
  reference what they're attached to.
- **Changes stop at the interface.** Renaming a field in the digger model
  changes one line of wiring in the game model. The enemy's code doesn't
  change.

## Practical Drawbacks

- **Wiring has to live somewhere.** Some code has to create each component
  and pass it its dependencies. In MVT that is the parent: the game model wires
  its children, and a parent view wires its children's bindings. Burrow
  Bust's game model holds several small functions that exist only to
  connect its children.
- **More to declare.** Each need is a parameter and a type, where reaching
  out was one import. TypeScript keeps this light: a need can be an inline
  type like `{ readonly row: number; readonly col: number }`, and any object
  of that shape fits, with no `implements` and no named interface. In a
  language whose interfaces must be declared and implemented by name, this
  takes more code.
- **The code is less direct to follow.** To find out what `isWalkable` does
  inside the digger, you look at the wiring in the game model, not at an
  import. Go-to-definition lands on the declared need, not on its
  implementation.

## Common Misreadings

- **Not "never import".** Importing code is fine; importing state is not.
  A model may import helper functions, data tables, constants and types,
  since they behave the same every time. It must not import anything that
  changes or comes from outside: another module's live
  variables, a shared game-state object, the clock, the global random
  source.
- **Not a framework.** Dependency injection is often sold with containers,
  decorators and registries. This book doesn't need or use any of them. A
  component takes its needs as options, and its parent passes them.
- **Not an interface in front of everything.** A top-level view may take
  its model directly ([B-reusable](../appendices/a-mvt-on-one-page.md#binding-rules)). It is
  written for one game and won't be reused, so a bindings layer would add
  wiring without any benefit. Declare needs where a component is reused, tested
  alone, or likely to change.
- **The interface belongs to the component that needs it.** A view's
  bindings are written for the view, not for the model whose state ends up
  behind them. The model doesn't implement them, or reference them; the
  wiring adapts the model to the view. In the same way, the enemy declares
  the chase target it needs, and the digger's code never references it.

## Checklist

Questions to ask of a design, or in a review:

- Does any model read a clock, call `Math.random()`, or touch anything
  else outside itself, instead of receiving it?
- Does any model or view import another module's live state?
- Can each component be built in a test from plain values and small functions?
- Does any component ask for a whole model when it uses one or two values from
  it?
- Does any component reach through what it receives, to something further
  away?
- Is each declared need written for the component that uses it, rather than
  copied from the component that supplies it?
- Does every model a component builds belong to it alone? If a child is
  shared, or must vary, is it declared as a need instead?

## Rules Built on DIP

| Rule | How it follows |
| --- | --- |
| [M-isolation](../appendices/a-mvt-on-one-page.md#model-rules) | A model declares what it needs, so it never reaches for a view, the ticker, or anything else |
| [M-time](../appendices/a-mvt-on-one-page.md#model-rules) | Time is a dependency, supplied as `deltaMs`, never read from a clock |
| [B-contract](../appendices/a-mvt-on-one-page.md#binding-rules) | A view's bindings type is the complete list of what it needs |
| [B-wiring](../appendices/a-mvt-on-one-page.md#binding-rules) | Needs are supplied where the view is built, by the code that creates it |
| [B-reusable](../appendices/a-mvt-on-one-page.md#binding-rules) | Reusable views declare their needs; a top-level view, used once, may take its model directly |

## Further Reading

- Robert C. Martin, "The Dependency Inversion Principle", *C++ Report*
  (1996). The original article.
- Robert C. Martin, *Agile Software Development: Principles, Patterns, and
  Practices* (2002). Chapters on the Dependency Inversion and Interface
  Segregation principles.
- Karl Lieberherr, Ian Holland and Arthur Riel, "Object-Oriented
  Programming: An Objective Sense of Style", *OOPSLA* (1988). The Law of
  Demeter.
- Alistair Cockburn,
  ["Hexagonal Architecture"](https://alistair.cockburn.us/hexagonal-architecture/)
  (2005). Ports and adapters: an application that can be driven equally by
  users, programs and tests.
