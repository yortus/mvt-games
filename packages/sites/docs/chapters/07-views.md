# Views

> A view turns the model's state into something the player sees or hears.
> It builds its output once, and then, every frame, its `refresh()` reads
> the state again and writes the output to match. A view doesn't keep any
> domain state or run a clock of its own, so you can delete it, replace
> it, or run the game without any views, and the game plays the same.

**Related:** [Models](04-models.md) · [The Tick](05-the-tick.md) ·
[Bindings](08-bindings.md) · [Presentation State](11-presentation-state.md) ·
[Writing Views in JSX](12-writing-views-in-jsx.md) ·
[MVT on One Page](../appendices/a-mvt-on-one-page.md#view-rules)

Here is a view of a bullet that looks reasonable at first. It reads the
bullet's position once, and then moves the sprite up a little on every
frame:

```ts
// Don't do this: the view runs its own animation
function BulletView(bindings: BulletViewBindings): Container {
    const view = new Container();
    view.position.set(bindings.x(), bindings.y());
    // ...draw the bullet...

    function refresh(): void {
        view.y -= BULLET_SPEED_PER_FRAME;
    }

    setRefresh(view, refresh);
    return view;
}
```

It works on the first playtest. Then the problems start:

- **On a 120 Hz screen,** `refresh()` runs twice as often, and the bullet
  flies twice as fast as the model's bullet.
- **When the game pauses,** the model's bullet stops. If anything keeps
  refreshing the view, such as a pause menu drawn over it, this bullet
  flies on.
- **When the model's bullet hits an enemy,** the view's bullet may be
  somewhere else. The two drifted apart, and the code didn't detect it.
- **In a test,** refreshing the view twice moves it twice. The picture
  depends on how many times you looked, not on the state of the game.

The model decides the bullet's position. The view's job is to show the
bullet at the model's position, every time it refreshes:

```ts
function refresh(): void {
    view.position.set(bindings.x(), bindings.y());
}
```

Now all four problems go away. The view can't drift, because it doesn't
keep any state that could drift. This chapter is about that one idea, and what
follows from it.

[§](#try-bullet-that-drifts) puts both views side by side, showing one
bullet from one model. The buttons on the right set how much time the
model receives each frame. The example starts in slow motion, so the
model's bullet moves at a quarter of its speed. The left view follows it.
The right view counts frames, not time, so its bullet flies on at full
speed, and the two are soon far apart. Press Paused, and the left bullet
stops while the right one carries on. Press Normal, and on a 60 Hz screen
the two roughly agree. On a faster screen, the right bullet races ahead
even then.

<TryIt example="bullet-that-drifts" file="views/drifting-bullet-view.ts" />

## The Role of a View

A view is a window onto the simulation. Each frame, it reads the current
state of the models and updates its output to match. The output is often a
picture, such as a Pixi container or some DOM elements, but MVT doesn't
restrict what it is. It could be a sound
([Chapter 20](20-sound-and-music.md)), a debug panel, or a log in a test.

You can open several windows onto the same model, and they all stay in
step, because each one reads the same state. You can close every window,
and the simulation runs on unchanged. A test, a headless replay or a
server can run the models without any views.

In [§](#try-lift-in-three-views), a lift is shown through three windows at
once: its shaft, a dial and a panel. Press 1, 2 or 3, or click a window's
button, to close that window or open it again. Close all three, wait a
moment, and open one. The lift carried on without them, and the new view
shows where it is on its first refresh.

<TryIt example="lift-in-three-views" file="views/lift-windows-view.ts" />

MVT has two requirements for a view:

1. **It refreshes.** Each frame, it reads the current state again and
   updates its output to match.
2. **It doesn't hold domain state or domain logic.**
   [Domain state](../appendices/b-glossary.md) is the state that decides
   what happens in the game: positions, scores, lives, phases. The view
   doesn't own any of it, enforce any rules, or decide what happens next.
   The models do that.

Everything else is your choice. Views can be functions or classes. They
can be Pixi containers, DOM elements or three.js objects. The ticker can
find their refresh methods by walking a tree, or call each one by hand.

When this book says a view is "stateless", it always means it doesn't
hold any *domain* state. A view does hold things. It holds its display
objects, which last from frame to frame. Some views also hold a little
state of their own for a fade or a smooth count-up, which the model
doesn't need to track. That is called presentation state, and
[Chapter 11](11-presentation-state.md) is all about it.

## A Minimal View

Here is the bullet view in full:

```ts
import { Container, Graphics } from 'pixi.js';
import { setRefresh } from '@mvtjs/pixi';

interface BulletViewBindings {
    x: () => number;
    y: () => number;
    isVisible: () => boolean;
}

function BulletView(bindings: BulletViewBindings): Container {
    const view = new Container();
    const gfx = new Graphics();
    gfx.circle(0, 0, 4).fill(0xffffff);
    view.addChild(gfx);

    function refresh(): void {
        view.visible = bindings.isVisible();
        view.position.set(bindings.x(), bindings.y());
    }

    setRefresh(view, refresh);
    return view;
}
```

The view does its work in two places:

- **When it's made,** it builds its display objects and draws what never
  changes, here a white circle.
- **In `refresh()`,** it reads the state it shows and writes it onto those
  objects: whether the bullet is visible, and where it is.

Everything the view reads comes from its
[bindings](../appendices/b-glossary.md), a plain object that's passed to
it when it's made. Each binding here is a function that returns a current
value, such as the bullet's `x`. The view doesn't depend on where the
values come from. They might come from a model, or from a test that
returns fixed numbers. Bindings also work in the other direction: a view
can receive functions to call when the player does something, such as
`onTapped`.
[Chapter 8](08-bindings.md) covers both kinds.

::: info In this book
A view is a function named for what it shows, such as `BulletView`. It
takes one bindings object and returns a Pixi `Container`. The name starts
with a capital letter so that the function can be used as a JSX tag
(`<BulletView ... />`) as well as called (`BulletView({ ... })`).

`setRefresh`, from `@mvtjs/pixi`, sets the view's refresh step on its
container. The ticker calls `refreshView` on the stage once per frame,
which finds every refresh method in the tree, wherever it is, and calls
it. So a parent never passes the call on to its children, for the reasons
in [Chapter 5](05-the-tick.md#trees-the-ticker-calls-only-the-roots).
:::

## The `refresh()` Contract

The ticker calls each view's `refresh()` once per frame, after every
model has updated (see [Chapter 5](05-the-tick.md)). So a view always reads
state that has finished changing for this frame. In return, `refresh()`
must follow three rules.

**It's reactive.** Every value that may change between frames is read
again in `refresh()`. It's never read once, when the view is made, and
kept. The first bullet view broke this rule: it read the position once,
and from then on it used its own copy. The one exception is a value
whose bindings type says the view reads it once, which
[Chapter 8](08-bindings.md#fixed-values-and-getters) explains.

**It's idempotent.** Calling `refresh()` twice with the same state
produces the same output as calling it once. This is why a test can
refresh a view and look at it, and a thumbnail can be drawn from one
refresh, without worrying about how many refreshes came before. A `+=` in
`refresh()` is the usual way this rule breaks.

**It's free of side effects.** `refresh()` reads state and writes the
presentation output. It doesn't change a model, send an event, or start a
transition. If it did, the picture on the screen would depend on when the
views happened to run, and one view could change what the next one reads in the
same frame.

These three are rules V-reactive, V-idempotent and V-readonly in
[Appendix A](../appendices/a-mvt-on-one-page.md#view-rules).

## Immediate-Mode Data Flow, Retained-Mode Output

Graphics code is often described as one of two kinds:

- **Immediate mode.** Each frame, the program draws everything from
  scratch, straight from its current data. The program doesn't keep
  anything from the last frame. Canvas 2D drawing and Dear ImGui work this way.
- **Retained mode.** A library keeps a tree of objects, such as Pixi's
  scene graph or a browser's DOM, and draws it each frame. The program
  builds the tree once, and changes the objects' properties as things move.

An MVT view combines the two. Its *data flow* is immediate mode:
`refresh()` reads all the state it shows, every frame, as if it were
drawing from scratch. The view doesn't subscribe to anything, and the
model doesn't send change notifications or partial updates. Its *output*
is retained mode: the view builds its display objects once, and
`refresh()` sets their properties. It doesn't tear them down and build new ones.

From immediate mode, the view gets correctness. After every `refresh()`,
the output matches the current state. The output can't be stale, because
the view didn't keep any old state, and the view can't miss an update,
because the model never sends one. From retained mode, it gets
efficiency. The view doesn't make display objects each frame, so the
engine doesn't have any garbage to collect. The objects last,
and only their properties are written.

The retained output is, in effect, a cache of the last `refresh()`. Like
any cache, it's only as good as the code that fills it. If you add a field
to the model and `refresh()` doesn't read it, the output keeps showing
whatever was there before. The reactive and idempotent rules guard
against that, because they require `refresh()` to read everything it
shows, every time.

Reading everything every frame sounds slow, but each read is a function
call, and at game scale, all of them together take a small part of a
frame. [Chapter 10](10-why-views-poll.md) explains why MVT polls rather
than pushes changes to views, and measures the performance cost.

## Doing Less Work in `refresh()`

Most of what `refresh()` does is fast: copy a number onto a property, set
a flag. Read those values directly, every frame. Some work takes longer,
such as making new text, or rebuilding a grid of tiles. When the value behind it
changes only now and then, doing that work on every frame wastes time.

The answer is to compare the value with the one you read last frame, and
do the work only when it differs. That's called change detection.
[Chapter 9](09-noticing-changes.md) teaches it in full. Here is one of its
tools, a computed value, which keeps a score label from making a new string
on every frame:

```ts
import { createComputed } from '@mvtjs/utils';

// Made once: it makes the text again only when the score changes
const scoreText = createComputed({ watch: bindings.score, compute: String });

function refresh(): void {
    label.text = scoreText();
}
```

Another way to do less work is to skip what can't be seen. A view's
`refresh()` may hide its own container and stop:

```ts
function refresh(): void {
    const isVisible = bindings.isVisible();
    view.visible = isVisible;
    if (!isVisible) return;
    view.position.set(bindings.x(), bindings.y());
}
```

Hiding a view doesn't stop its refresh method running, so it can show
itself again next frame. A plain `return` skips only the rest of this
view's own refresh, though. Its child views are still refreshed. To skip
a whole subtree, such as a hidden panel, return `SKIP_DESCENDANTS`, from
`@mvtjs/pixi`, instead. Then the views below it aren't refreshed on that
call.

## Concerns That Belong in a View

A view describes how things look, or sound. It turns domain state into
presentation:

- a position in the domain's units, such as tiles, into pixel coordinates
- a named state, such as `'dying'`, into a texture, a colour or an
  animation frame
- a count, such as lives left, into a row of icons
- a change in state, such as a phase beginning or a count rising, into a
  sound

And these concerns don't belong in a view:

| Doesn't belong in a view | Why |
| --- | --- |
| Domain state | It belongs to a model, so that there is one answer to every question about the game |
| Domain logic | Rules belong in models, where a test can check them without drawing anything |
| Wall-clock timers, such as `setTimeout` or `Date.now()` | Time reaches a view only through the ticker, so pausing, slowing down and tests all work |
| Animations that run by themselves | Anything that moves follows state read in `refresh()`, as the bullet now does |
| Writes to a model in `refresh()` | A view reads in `refresh()`. It reports the player's input through relay bindings ([Chapter 8](08-bindings.md)) |

Some views do need state of their own, such as the progress of a 300 ms
fade that the model doesn't track. That's presentation state, and the view
advances it in an `update(deltaMs)` step of its own, with the `deltaMs`
that the ticker passes in. [Chapter 11](11-presentation-state.md) shows
how, and describes a simple test for telling it apart from domain state:
[would the game still play correctly with the view deleted?](11-presentation-state.md#when-is-presentation-state-really-domain-state)

Views also compose into trees, and a view tree doesn't need to mirror the
model tree. [Chapter 13](13-composing-views.md) covers that.

## Writing the Body in JSX

You can also write a view's body in JSX, a syntax for building a tree of
objects from tags. Here is the bullet view again, with a JSX body:

```tsx
/** @jsxImportSource @mvtjs/pixi */
import type { Container } from 'pixi.js';

function BulletView(bindings: BulletViewBindings): Container {
    return (
        <graphics
            ref={(g) => g.circle(0, 0, 4).fill(0xffffff)}
            visible={bindings.isVisible}
            x={bindings.x}
            y={bindings.y}
        />
    );
}
```

Each attribute you give a function, such as `x={bindings.x}`, is read
again every frame, just as `refresh()` would read it, and that's all you
need to read the JSX samples in the next few chapters.
[Chapter 12](12-writing-views-in-jsx.md) teaches the rest, and when to
choose JSX over plain TypeScript.

## Releasing a View's Resources

Most views don't hold anything that outlives them. Their display objects
are destroyed along with them, and since views poll rather than
subscribe, they don't have any subscriptions to undo. A few views hold
something that isn't one of their display objects, and so isn't destroyed
with them:

- a listener on `window` or `document`, such as a keyboard handler
- a resource that several of its display objects share, such as one shape
  that many `Graphics` objects draw from
- a texture the view made itself
- a GSAP timeline

Release each one where you acquire it, so the two can't drift apart.

::: info In this book
A view releases these on Pixi's `'destroyed'` event, set up right where it
acquires them:

```ts
window.addEventListener('keydown', onKeyDown);
view.on('destroyed', () => {
    window.removeEventListener('keydown', onKeyDown);
});
```

In a JSX body, the `onDestroyed` attribute does the same for the element
it's on:

```tsx
const boidShape = new GraphicsContext()
    .poly([8, 0, -5, 4, -5, -4])
    .fill(0x44ccff);

return (
    <container onDestroyed={() => boidShape.destroy()}>
        {/* ...Graphics that all draw boidShape... */}
    </container>
);
```

Prefer the event to replacing the view's `destroy` method. Any number of
listeners can be added, each next to what it releases, and the listeners
don't need to call the original.
:::

::: warning Destroy with `{ children: true }`
Pixi's `destroy()` on its own detaches a container's children without
destroying them, so the containers below it never receive `'destroyed'`.
Whatever code ends a view's life should call `destroy({ children: true })`.
To catch a missed one, in development `@mvtjs/pixi` logs a warning when a
container is destroyed without `{ children: true }` while a container
below it has a `'destroyed'` listener, since that listener would never
run.
:::

## Updating and Refreshing Views with the `@mvtjs` Libraries

The ticker ticks only the root view, and a function walks the view tree
to reach the rest, as
[Chapter 5](05-the-tick.md#trees-the-ticker-calls-only-the-roots)
explained. Walking the tree has one more advantage. A view deep in the
tree takes part just by having its steps, and the views above it don't
need to reference it. When each parent forwards the tick by hand, adding
a view with an update step means changing every parent above it, and a
parent that doesn't forward the tick leaves the view frozen. Either way, a tick
looks the same from the ticker, however deep the trees go.

MVT requires the order, not a particular way of reaching every view.
The `@mvtjs` libraries walk the view tree for you. A view sets its two
steps on its own container, and the loop updates, then refreshes, the
whole stage.

| Function | Purpose | Called on |
| --- | --- | --- |
| `setUpdate(view, fn)` | Sets the view's `update(deltaMs)`, which moves its presentation state on | Views that have presentation state ([Chapter 11](11-presentation-state.md)) |
| `setRefresh(view, fn)` | Sets the view's `refresh()`, which reads state and writes output | Every view that shows state |
| `updateView(view, deltaMs)` | Calls every update step in `view`, each once, parents before children | The stage, once per frame, after the models |
| `refreshView(view)` | Calls every refresh step in `view`, each once, parents before children | The stage, once per frame, after `updateView` |

All four come from the renderer package you use: `@mvtjs/pixi`,
`@mvtjs/three` or `@mvtjs/html`. They work the same way for every
renderer.

- **A view includes its child views.** A view anywhere in the tree takes
  part just by setting its steps. Its parents don't need to reference
  it, or pass anything on. A view never calls its children's steps
  itself. If it did, they would run twice.
- **Children added during a refresh are refreshed too.** If a refresh
  step attaches a new child view, `refreshView` refreshes it before it
  returns, so a view is never drawn before its first refresh.
- **A subtree can be skipped.** Either step may return `SKIP_DESCENDANTS`
  to skip its container's descendants for that call, such as a panel that
  is hidden. Making a container invisible doesn't skip anything by
  itself.
- **The walk caches the steps it finds.** Each function keeps a list of
  the steps in the tree, and finds them again only when a view is added or
  removed. So hiding a subtree is faster than taking it out of the tree
  and putting it back.
- **Updates and refreshes are separate calls.** A loop can call
  `updateView` many times and `refreshView` once, which is how a
  thumbnail is made. The code that runs the loop can pause a game by
  leaving its container out of `updateView`, and still refresh it, as the
  pause in [§](05-the-tick.md#time-control) does.

### Why not Pixi's `onRender`?

Pixi's `onRender` runs once per draw, not once per tick, so a loop that
ticks several times per draw gets the wrong number of calls, and a test
without a renderer doesn't get any. The
[`@mvtjs/pixi` notes](https://github.com/yortus/mvt-games/blob/main/packages/libraries/pixi/src/README.md)
explain the differences in full.

## Common Mistakes

### A sprite that runs ahead of the model

A sprite runs too fast on a fast screen, keeps moving while the game is
paused, or ends up somewhere other than the model's position, as in the
first example. It happens because `view.x += speed` in `refresh()` feels
like the obvious way to animate. Put the position, or the animation's
progress, in the model, and set it in `refresh()`. If the animation is
purely cosmetic, it's presentation state instead
([Chapter 11](11-presentation-state.md)).

### A game that depends on which views exist

The game behaves differently depending on which views exist, or on their
order. A view is "helping" in `refresh()`, for example by clamping a value
it reads and writing it back to the model. Move the rule into the model,
and have the view only read.

### Slow work on every frame

A view makes new text, or redraws a whole grid, every frame, for a value
that changes once a minute. It happens because rebuilding everything is
the simplest correct code. Do the work only when the value changes, with
change detection ([Chapter 9](09-noticing-changes.md)).

## Summary

A view builds its output once and, every frame, reads the current state
and writes it onto that output. Its `refresh()` is reactive, idempotent
and free of side effects, so the output always matches the models, however
often you look. The data flow is immediate mode and the output is retained
mode, which gives you correctness without making new objects every frame.
A view doesn't own any domain state or run a clock of its own. When slow
work should run only on a change, change detection (Chapter 9) does it.
When a view needs a cosmetic state of its own, presentation state
(Chapter 11) does it. A view that holds a resource other than its display
objects, such as a window listener, releases it when the view is
destroyed.

## Further Reading

- Casey Muratori, "Immediate-Mode Graphical User Interfaces" (2005). The
  talk that named and popularised immediate-mode UI: drawing the interface
  from the program's current data on every frame, rather than keeping a
  tree of widgets in step with it.
