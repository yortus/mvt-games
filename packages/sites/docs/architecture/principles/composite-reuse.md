# Composite Reuse Principle (CRP)

> Build bigger components by combining smaller ones, never by extending
> them. This is the principle better known as "composition over
> inheritance". In MVT, models are built from smaller models, and views
> from smaller views, each created and wired by its parent. Each piece stays
> small, works on its own, and can be reused wherever it fits.

**Previous:** [Dependency Inversion Principle (DIP)](dependency-inversion.md)

**Related:** [Architecture Overview](../index.md) ·
[Rules](../rules.md) ·
[Model Composition](../../building-with-mvt/simulating-the-world/model-composition.md) ·
[View Composition](../../building-with-mvt/presenting-the-world/view-composition.md)

**Note:** Examples are in TypeScript; see [why](index.md#examples-are-in-typescript).

---

## The Principle

There are two common ways to reuse code. A class can **inherit** it: a
subclass is its parent, plus some changes. Or a
[component](../../reference/glossary.md) can **compose** it: it holds other
components, and uses them through their interfaces.

The Gang of Four put the principle in one line in *Design Patterns* (1994):
"Favor object composition over class inheritance." Kirk Knoernschild named
it the **Composite Reuse Principle** in *Java Design* (2002). (Robert
Martin's package principles include a *Common* Reuse Principle, also
abbreviated CRP. That one is about which classes belong in one package, and
is unrelated.)

Composition at every level of MVT is an instance of the **Composite**
pattern: a whole is used in the same way as each of its parts. A parent
model has an `update(deltaMs)`, just like its children, and a parent view
is a view, just like its children. So any whole can itself become a part of
something bigger. [Heritage](../heritage.md#hierarchical-composition)
describes the pattern; this page is about why MVT builds everything that
way.

## Symptoms

Inheritance is the obvious way to share behaviour between kinds of game
object. Here is a start:

```ts
class Actor {
    x = 0;
    update(deltaMs: number) { /* ...move */ }
}

class Walker extends Actor { /* ...walks along the ground */ }
class Shooter extends Actor { /* ...fires on a cooldown */ }
```

It reads well, and the first two enemies work. Now try a few ordinary
requests:

- **Add an enemy that walks and shoots.** It can extend `Walker` or
  `Shooter`, not both, so one of the two behaviours gets copied.
- **Make every actor slow down in water.** The change goes in `Actor`, and
  reaches every subclass. Any subclass that overrides `update` now has to be
  checked, because it depends on how `Actor` works, not just on what it
  offers.
- **Test the cooldown.** It lives inside `Shooter`, which is an `Actor`. To
  test the cooldown, you build a whole actor.

The same pattern across a game shows up as three symptoms:

- **The hierarchy doesn't fit the game.** Behaviours combine freely: walks,
  shoots, flies, can be popped. A tree of classes can only group them one
  way, and every new combination fights it.
- **A change at the root reaches every leaf.** A subclass depends on its
  parent's implementation, so a change inside the parent can break
  subclasses that never asked for it. This is often called the *fragile
  base class* problem.
- **Behaviour comes with an identity.** To get `Shooter`'s cooldown, you
  have to be a `Shooter`.

## Applied to MVT: Components Made of Components

### Models made of models

The same enemy, composed:

```ts
function createGruntModel(options: GruntOptions) {
    const walk = createWalkModel({ speed: options.speed });
    const gun = createGunModel({ cooldownMs: options.cooldownMs });

    return {
        get x() { return walk.x; },
        get shotsFired() { return gun.shotsFired; },
        update(deltaMs: number) {
            walk.update(deltaMs);
            gun.update(deltaMs);
        },
    };
}
```

A grunt that walks and shoots holds a walk and a gun. An enemy that only
shoots holds a gun. The gun is tested on its own, with nothing around it,
and slowing down in water is a change to the walk alone. The parent passes
time to each child, and handles anything that happens between them
([M-composition](../rules.md#model-rules)).

The games here are built this way.
[Crumb Chase](https://github.com/yortus/mvt-games/tree/main/packages/sites/arcade/src/entries/crumb-chase)'s
mouse and cats all move one tile at a time, but neither extends a shared
actor. Each holds a
[`TileMove`](https://github.com/yortus/mvt-games/blob/main/packages/sites/arcade/src/entries/crumb-chase/models/tile-move.ts),
a small model that slides a position to the next tile, with tests of its
own. The [fruit machine](https://github.com/yortus/mvt-games/blob/main/packages/sites/arcade/src/entries/fruit-machine/README.md)'s
model holds a reel model for each reel, a celebration model, a ways
evaluator and a seeded random source, and each of those has its own tests
too. The [DIP page](dependency-inversion.md#building-its-own-children)
explains why a parent building its own children like this is not a hidden
dependency.

### Views made of views

Views compose the same way. A parent view holds its child views, and wires
each one's bindings. The fruit machine's Pixi view is a backdrop, a
paytable, marquee lights, the reels, the win path, a juice burst, meters, a
win banner, the spin button and a game-over overlay, each a leaf view of
its own.

Leaf views written for one game are reused in others, by composing them
into a new tree, never by extending them. The Arcade's shared overlay view
and pixel text view appear in most of its games. Each entry
builds the view into its own tree and supplies its own bindings
([B-reusable](../rules.md#binding-rules)).

The JSX runtime's `<List>` and `<Switch>` are composition too. `<List>`
builds one item view per slot from a function you give it, and `<Switch>`
picks one of several subtrees, such as a different view for each
[kind of item](../../building-with-mvt/presenting-the-world/collections.md#items-of-different-kinds).
A parent can even hand a child a view that is already built, rather than
the bindings to build one
([Hand over a built child](../../building-with-mvt/presenting-the-world/view-composition.md#shared-values-in-deeply-nested-views)).

### Two trees, each composed for its own concern

Models compose to fit the domain; views compose to fit the screen. The two
trees need not match ([V-tree](../rules.md#view-rules)). The fruit machine
has one machine model and four view trees (Pixi, three.js, an HTML panel
and a terminal), each built from different leaf views. Burrow Bust's HUD
shows a score and lives held by the game model, and has no model of its
own. [Model-View Mapping](../../building-with-mvt/presenting-the-world/view-composition.md#model-view-mapping)
gives more cases. Bindings are what make this possible: a view reads what
it needs, wherever in the model tree it lives.

## Practical Benefits

- **Behaviours combine freely.** Any mix of pieces makes a new kind of
  game object, with no hierarchy to fit it into.
- **Each piece is tested alone.** `TileMove` has its own tests, and so do
  the fruit machine's reel and celebration models. The parent's tests can
  then use the real pieces.
- **Pieces are reused across games.** The shared overlay view is in most of
  the Arcade's games, because composing it asks nothing of them but its
  bindings.
- **Changes stay inside a piece.** Changing how a `TileMove` slides changes
  the mouse and the cats alike, through the same interface, and neither
  needs editing.
- **Trees can be rearranged.** A view can be moved, swapped or added without
  touching the model, and a model's children can be regrouped without
  touching the views that read the parent.

## Practical Costs

- **Forwarding.** A parent that exposes a child's state writes a getter for
  it (`get x() { return walk.x; }`), where inheritance would give it for
  free. In MVT this stays small: a parent exposes what its readers need,
  not everything its children have, and it can expose a child whole, as
  Burrow Bust's game model exposes its `digger`.
- **Wiring.** The parent builds each piece and connects them, which is more
  lines than `extends`. The [DIP page](dependency-inversion.md) covers why
  that wiring pays.
- **More, smaller pieces.** Following one behaviour can mean opening the
  piece it lives in. Compose where a piece can be understood and tested on
  its own, and stop there; the
  [SoC page](separation-of-concerns.md#applied-to-mvt-cohesion-and-coupling)
  says where splitting stops paying.

## Common Misreadings

- **Not "no reuse".** Reuse is the point of the principle; only the
  mechanism changes, from extending to holding.
- **Not "split everything".** A piece earns its place by being reusable or
  testable alone. Cohesion and coupling, on the SoC page, decide how big
  each piece is.
- **Not one tree.** The model tree and the view tree are composed
  separately, for different concerns, and usually differ.
- **Not a rival to an entity component system.** An ECS builds game
  objects from pieces of plain data (its "components", a different thing
  from MVT components), processed by separate systems. MVT composes models
  and views. The two work at different levels, and fit together: how a model
  stores its state inside is its own business. Falling Sand's
  [array grain grid](https://github.com/yortus/mvt-games/blob/main/packages/sites/arcade/src/entries/falling-sand/models/grain-grid/array-grain-grid.ts)
  keeps each field of every grain in its own typed array, "as an
  entity-component system would lay them out", behind the same `GrainGrid`
  interface as a version that keeps an object per grain. Neon Monsoon's
  bullet field stores its bullets the same way. The views read the model's
  interface either way, and nothing in them changes with the storage.

## Checklist

Questions to ask of a design, or in a review:

- Is any behaviour shared by extending something, rather than by holding a
  piece that does it?
- Can each piece a model or view is made of be built and tested on its own?
- Does any view tree copy the model tree's shape where the presentation
  doesn't need it?
- When a parent forwards a child's state, does it forward only what its
  readers need?
- Is any piece copied between games, rather than shared and composed?
- Does any view take a child's bindings only to pass them on, when it could
  take the built child instead?

## Rules It Underpins

| Rule | How it follows |
| --- | --- |
| [M-composition](../rules.md#model-rules) | A parent model holds its children, passes them time, and handles what happens between them |
| [V-tree](../rules.md#view-rules) | Models and views are each composed for their own concern, so their trees need not match |
| [B-reusable](../rules.md#binding-rules) | A leaf view declares its bindings, so any parent can compose it into its own tree |

## Further Reading

- Erich Gamma, Richard Helm, Ralph Johnson and John Vlissides, *Design
  Patterns* (1994). "Favor object composition over class inheritance", in
  chapter 1, and the Composite pattern.
- Kirk Knoernschild, *Java Design: Objects, UML, and Process* (2002). Names
  the Composite Reuse Principle.
- Robert Nystrom, *Game Programming Patterns* (2014), the Component
  chapter. Composition for game objects. A "component" there is a piece of
  one game object, not an MVT component.

---

**Next:** [Design by Contract (DbC)](design-by-contract.md)
