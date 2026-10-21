# Separation of Concerns (SoC)

> A game does three different jobs: it decides what is happening, it shows
> it, and it keeps time. MVT gives each job one owner (the model, the view
> and the ticker) and keeps them apart, so each can be understood, tested
> and changed without the others. Within each job, the same idea applies at
> a smaller scale: keep each component cohesive, and the components loosely
> coupled.

**Previous:** [The Principles Behind MVT](index.md)

**Related:** [Architecture Overview](../index.md) ·
[Rules](../rules.md) ·
[Single Source of Truth (SSOT)](single-source-of-truth.md)

**Note:** Examples are in TypeScript; see [why](index.md#examples-are-in-typescript).

---

## The Principle

Any program of real size does several different jobs at once. A **concern**
is one of those jobs: an area of work you can think about on its own, such
as reading the player's input, drawing the screen, or saving progress.

**Separation of concerns** means arranging code so that each concern lives
in one place, and can be read, tested and changed without thinking about
the others. Edsger Dijkstra coined the phrase in 1974, calling it "the only
available technique for effective ordering of one's thoughts". It is less a
rule than a habit of mind: before writing code, ask which concern it
belongs to.

## Symptoms

Mixing concerns is the obvious way to write code, and at first it feels
fine. Here is a frame of a tiny game written that way. A ship drifts right,
wraps around at the edge of the arena, and is drawn as a sprite.

```ts
let lastTime = performance.now();

function onFrame(now: number) {
    const deltaMs = now - lastTime;
    lastTime = now;

    shipX += SPEED * deltaMs;
    if (shipX > ARENA_WIDTH) shipX -= ARENA_WIDTH;

    shipSprite.x = shipX * PIXELS_PER_UNIT;

    requestAnimationFrame(onFrame);
}
```

It is short and it works. But each of its lines answers one of three quite
different questions:

| Lines | The question they answer | The concern |
| --- | --- | --- |
| `shipX += ...`, the wrap | What is happening? | **Domain**: the game's state and logic |
| `shipSprite.x = ...` | How is it shown? | **Presentation**: sprites, pixels, sound |
| `lastTime`, `deltaMs`, `requestAnimationFrame` | When, and how fast? | **Time**: the frame loop |

Now try a few ordinary requests against it:

- **Test the wrap.** You can't run `onFrame` without a sprite and a browser,
  and you can't make time pass on demand.
- **Pause the game.** The clock is read in the middle of the domain logic,
  so pausing means editing the domain logic.
- **Show the ship twice**, say on a minimap. The domain logic and the main
  sprite are in one function, so the minimap either copies the domain logic
  or hooks into the middle of it.

Each request is about one concern, and each forces you to untangle the
other two first. In a ten-line function that is easy. In a real game, with
the same tangle spread across hundreds of files, it shows up as three
familiar symptoms:

- **Every change touches code it shouldn't.** A designer tunes the ship's
  speed, an artist redraws it, someone adds slow motion to the debug menu.
  Three changes, for three reasons, by three people, and each edits code
  the other two depend on, with a risk of breaking something none of them
  meant to touch.
- **Testing needs everything running.** Domain logic could be tested by
  asserting values (after two seconds, the ship has wrapped), but tangled
  with drawing and a clock it can only be tested the hardest way: run the
  whole game and watch.
- **Each change is harder than the last.** Every new line has to fit around
  all three concerns at once, so the tangle grows, and so does the cost of
  the next change.

## Applied to MVT: Three Concerns, Three Owners

MVT separates the three concerns and gives each one an owner:

| Concern | Owner | Knows | Never knows |
| --- | --- | --- | --- |
| Domain | [Model](../models.md) | The game's state and logic, in domain units (tiles, metres) | Pixels, renderers, views, the clock |
| Presentation | [View](../views.md) | How to show state: sprites, layout, sound, easing | Domain logic, what happens next, the clock |
| Time | [Ticker](../ticker.md) | When each frame happens, how much time passed, the order of each frame | Domain logic, how anything is shown |

The same tiny game, separated:

```ts
// Domain: the model. No pixels, no clock.
const ship = {
    x: 0, // arena units
    update(deltaMs: number) {
        ship.x = (ship.x + SPEED * deltaMs) % ARENA_WIDTH;
    },
};

// Presentation: the view. No domain logic, no clock.
function refreshShipView() {
    shipSprite.x = ship.x * PIXELS_PER_UNIT;
}

// Time: the ticker. No domain logic, no drawing.
let lastTime = performance.now();
function onFrame(now: number) {
    const deltaMs = Math.min(now - lastTime, MAX_DELTA_MS);
    lastTime = now;
    ship.update(deltaMs);
    refreshShipView();
    requestAnimationFrame(onFrame);
}
```

It is a few lines longer. In return, each of the three requests now
touches one concern:

- **Test the wrap:** call `ship.update(...)` with any times you like and
  check `ship.x`. No sprite, no browser, no waiting.
- **Pause:** the ticker stops calling `ship.update`. The model doesn't
  change.
- **A minimap:** write a second view that reads `ship.x`. The model and the
  first view don't change.

Notice too that time now enters the model as a number, `deltaMs`, rather
than being read from a clock. That one change is what makes the model
testable and pausable, and the [Dependency Inversion](dependency-inversion.md)
page follows it further.

## Applied to MVT: Cohesion and Coupling

Separating the three concerns is the large-scale step. The same idea applies
again inside each one: a game's domain is many smaller concerns (the ship,
the asteroids, the score), and so is its presentation.

At this scale, two older ideas do the work. A
[component](../../reference/glossary.md) (a model, a view, or a smaller
piece of either) is **cohesive** when its contents belong together: they
share state and change for the same reasons. Components are **loosely
coupled** when they depend on each other only through small, declared
interfaces. The **Single Responsibility Principle (SRP)**, from Robert C.
Martin, is cohesion taken to its limit, and Martin traces it to cohesion
himself. In his later wording, "a module should be responsible to one, and
only one, actor": one group of people whose requests change it. That
reading fits MVT closely, since game designers change models and artists
change views.

Splitting a component makes each piece more cohesive, but the pieces now have to
talk to each other, so coupling grows, and following one idea means jumping
between files. Split while the pieces would change for different reasons and
need little from each other. Stop when splitting further would only move the
tangle into the wiring between them.

In practice:

- **A model covers one cohesive part of the domain.**
  [Burrow Bust](https://github.com/yortus/mvt-games/tree/main/packages/sites/arcade/src/entries/burrow-bust)'s
  game model combines a digger model, a field model, and a model for each
  rock and each enemy, and handles what happens between them, such as a
  rock landing on an enemy. The rock model has one behaviour, its fall: it
  wobbles, drops and shatters. The enemy model has several (patrol,
  chase, ghosting, fire, inflation), but they all share the enemy's
  position, direction and phase, so splitting them would add more coupling
  than cohesion. If it grew, the fire sequence, which already runs on its
  own timeline, would be the first piece to split off.
- **A view covers one visual layer or effect.** The dug-out field, the digger, the
  rocks, the HUD. A parent view arranges them.
- **A function's steps can be read apart.** Putting steps in order is a job
  in itself, so a function that only calls a short list of named steps has
  enough to do. That works when each step can be understood from its name,
  without reading its code or the code around it. Steps that only make
  sense together belong in one function.

Two quick tests:

- Describe the component in one sentence. Where it needs an "and", check that
  the two halves share state and change together. "Falls once the dirt
  beneath it is dug away" needs none, since the wobble before the fall is
  part of falling. "Moves the digger and keeps the score" joins two halves
  that share nothing, so it is two components.
- Look at a view's [bindings](../bindings.md). A long list of loosely
  related bindings usually means several views in one.

## Practical Benefits

- **Domain logic runs without a screen.** A model can be tested, replayed
  and profiled on its own, in milliseconds, with no renderer at all.
- **One model, any number of views.** The
  [fruit machine demo](https://github.com/yortus/mvt-games/blob/main/packages/sites/arcade/src/entries/fruit-machine/README.md) is
  one model shown through four views at once: Pixi, three.js, an HTML
  panel and a text terminal. None of them knows the others exist.
- **Time control is free.** Pause, slow motion, fast forward, single-step
  and replay all live in the ticker, because nothing else reads a clock.
- **Bugs have an address.** "The score is wrong" is a model bug; "the score
  is drawn in the wrong place" is a view bug. You know which file to open.
- **Work in parallel.** Game logic and art can be built at the same time,
  against the same model interface.

## Practical Costs

Separation has costs, and it is worth knowing them up front.

- **More components, and wiring between them.** A model, a view, bindings and a
  ticker are more pieces than one function. In a tiny game the cost is
  visible; it pays for itself as the game grows, and the
  [Building with MVT](../../building-with-mvt/quickstart.md) guide shows how
  little ceremony it needs in practice.
- **Some things need a decision about which side they are on.** A red flash
  when the player is hit is presentation: no outcome depends on it. Two
  seconds of invulnerability after a hit is domain: it changes what happens
  next. The test is always the same: *would any domain outcome change if
  this were different, or missing?* If so, it belongs to the model. See
  [When Is Presentation State Really Domain State?](../../building-with-mvt/adding-visual-polish/presentation-state.md#when-is-presentation-state-really-domain-state)
- **The domain is described in its own units.** A model holds positions in
  tiles or arena units, not pixels, so every view converts. That
  conversion is one line, and it is what lets a second view draw at a
  different scale.
- **Concerns talk only through declared channels.** A view learns about the
  model only by reading it, and the model never calls the view. Something
  like "play a sound when a crate breaks" therefore needs the model to hold
  state the view can notice; [Change Detection](../../building-with-mvt/reacting-to-changes/change-detection.md)
  shows how.

## Common Misreadings

- **Not a folder layout.** Separation is about what each component knows, not
  where its file lives. This repo keeps a game's models and views side by
  side in one folder per game, and they are fully separated.
- **Not "views are dumb".** A view can hold a lot of logic: layout, easing,
  [presentation state](../../building-with-mvt/adding-visual-polish/presentation-state.md),
  even a view model of its own. What it can't hold is domain logic. The
  fruit machine's reels land with a bounce that lives entirely in the views
  ([`reel-landing.ts`](https://github.com/yortus/mvt-games/blob/main/packages/sites/arcade/src/entries/fruit-machine/views/shared/reel-landing.ts)):
  the model settles each reel in a straight line, and each view eases it its
  own way.
- **Not a game manager.** The ticker only keeps time. "If the game is over,
  show the menu" is domain logic, so it lives in a model's state, and a view
  shows whatever that state says.
- **Not more layers.** MVT has three concerns because a game has three
  kinds of job. Adding layers for their own sake (a service layer, a
  controller layer) adds wiring without separating anything new.

## Checklist

Questions to ask of a design, or in a review:

- For each piece of state: would any domain outcome change without it? If
  so, is it in a model?
- Does any model import anything about presentation: a renderer, pixels,
  colours, textures, sounds?
- Does any model read a clock, or schedule anything with a timer?
- Does any view decide something that changes what happens next?
- Does the ticker contain any decision about the game?
- Could you delete a view and write a new one from the same model state,
  without changing the model?
- Can you describe each model, view and function in one sentence, with any
  "and" joining things that share state?
- Did any split leave pieces that can only be understood together?

## Rules It Underpins

| Rule | How it follows |
| --- | --- |
| [M-isolation](../rules.md#model-rules) | The domain doesn't know about presentation or time |
| [M-domain](../rules.md#model-rules) | Domain state is described in domain units, leaving pixels to the presentation |
| [M-time](../rules.md#model-rules) | Time is the ticker's concern; it reaches the model only as `deltaMs` |
| [V-stateless](../rules.md#view-rules) | Domain state is the model's concern, not the view's |
| [V-output](../rules.md#view-rules) | Presentation is separate, so any presentation will do |
| [V-tree](../rules.md#view-rules) | Domain structure and presentation structure are separate concerns |
| [T-minimal](../rules.md#ticker-rules) | The ticker keeps time, and nothing else |

## Further Reading

- Edsger W. Dijkstra, "On the role of scientific thought" (EWD 447, 1974).
  The origin of the phrase.
- Edward Yourdon and Larry L. Constantine, *Structured Design* (1979).
  Coupling and cohesion.
- Robert C. Martin, *Agile Software Development: Principles, Patterns, and
  Practices* (2002). The Single Responsibility Principle.
- Robert C. Martin, *Clean Architecture* (2017), chapter 7. SRP restated as
  "responsible to one actor".
- John Ousterhout, *A Philosophy of Software Design* (2nd ed., 2021). Deep
  modules, and when to split code apart or keep it together.
- John Ousterhout and Robert C. Martin,
  ["A Philosophy of Software Design vs Clean Code"](https://github.com/johnousterhout/aposd-vs-clean-code#method-length)
  (2025). A written debate; its Method Length section argues both sides of
  how far to split, over one worked example.
- Robert Nystrom, *Game Programming Patterns* (2014), the Game Loop and
  Update Method chapters. The separation of time from the rest, as games
  practise it.

---

**Next:** [Single Source of Truth (SSOT)](single-source-of-truth.md)
