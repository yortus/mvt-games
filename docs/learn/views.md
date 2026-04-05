# Views

> A view reads state and updates presentation. It holds no domain state,
> has no idea of time beyond the `refresh()` call, and is constructed once then
> updated every frame.

**Previous:** [Models](models.md) · **Next:** [The Ticker](ticker.md)

---

## What is a View?

A view is part of the presentation layer. It reads current model state and updates
its audio/visual output to match - e.g. a Pixi.js scene graph, a DOM element, or an audio
channel. A `refresh()` function runs each frame. Views are
**stateless** and **timeless** - they don't track what happened before, and
they don't decide what happens next.

In this project, views typically use Pixi.js containers and manage scene graphs. The examples
below reflect this, but the MVT pattern applies to any presentation target.

## A Minimal View

Here is a simple entity view that tracks a moving object's position (using
Pixi.js, as the rest of this project does):

```ts
interface EntityViewBindings {
    getX(): number;
    getY(): number;
    isVisible(): boolean;
}

function createEntityView(bindings: EntityViewBindings): Container {
    const view = new Container();
    const gfx = new Graphics();
    gfx.circle(0, 0, 4).fill(0xffffff);
    view.addChild(gfx);

    function refresh(): void {
        view.visible = bindings.isVisible();
        view.position.set(bindings.getX(), bindings.getY());
    }

    view.onRender = refresh;
    return view;
}
```

The view builds its display objects once at construction, then updates them
each frame in `refresh()`. All data comes from bindings - the view doesn't
know or care where the values originate.

The example above shows `get*()` bindings for pulling in state required by the view. Views may also
define `on*()` bindings for pushing user inputs received by the view back out - for example,
`onButtonTapped()` or `onSwipedUp()`. See
[Bindings](bindings.md) for the full pattern.

## What MVT Requires of Views

MVT imposes two architectural constraints on views:

1. **A refresh mechanism** - each frame, the view re-reads current state and
   updates its presentation to match. No stale caches, no autonomous
   animations.
2. **No domain state or logic** - views do not own application state, enforce
   rules, or decide what happens next. That belongs in models.

Everything else - whether you use factory functions or classes, Pixi.js
containers or DOM elements, `onRender` hooks or manual call sites - is a style
choice. The examples on this page use this repo's conventions (factory
functions, Pixi.js scene graphs, `onRender` hooks). See the
[Style Guide](../reference/style-guide.md) for this repo's specific
conventions.

## The `refresh()` Contract

A view's `refresh()` function is called once per frame, after all models have
been updated. It reads current state and updates the presentation to match.

Key principles:

- **Reactive** - all binding values must be re-read in `refresh()`, never
  cached at construction time. Binding values may change between frames.
- **Idempotent** - calling `refresh()` twice with the same model state
  produces the same visual result.
- **No side effects** - `refresh()` reads state and writes to the
  presentation layer. It does not mutate models, emit events, or trigger
  transitions.
- **Minimise work** - only update what changed. Use change detection for
  infrequent changes to avoid unnecessary rebuilds (see
  [Bindings](bindings.md)).

```ts
function refresh(): void {
    // Re-read bindings every frame - never cache these values
    const score = bindings.getScore();
    label.text = String(score);

    const opacity = bindings.getOpacity?.() ?? 1;
    container.alpha = opacity;
}
```

## Scene Graphs in Pixi.js

In this project, views work with Pixi.js containers and display objects. At
construction time, the view builds its scene graph - `Container`, `Graphics`,
`Text`, `Sprite`, and other display objects arranged in a tree. In `refresh()`,
the view updates properties on these objects (position, text, visibility, tint)
without tearing down and rebuilding the tree.

```ts
function createBulletView(bindings: BulletViewBindings): Container {
    const view = new Container();
    const gfx = new Graphics();
    view.addChild(gfx);

    // Draw once at construction
    gfx.circle(0, 0, 2).fill(0xffffff);

    function refresh(): void {
        const active = bindings.isActive();
        view.visible = active;
        if (!active) return;

        // Update position from bindings each frame
        view.position.set(bindings.getX(), bindings.getY());
    }

    view.onRender = refresh;
    return view;
}
```

The `onRender` property is Pixi's hook for per-frame updates. Setting it once
at construction time means the view's `refresh()` runs automatically whenever
the renderer draws a frame - no manual scheduling needed.

## What Does NOT Belong in a View

Views are the thinnest possible layer between model state and presentation:

| Forbidden                      | Why                                                   |
| ------------------------------ | ----------------------------------------------------- |
| Domain state                   | State belongs in models                               |
| Domain logic                   | Logic belongs in models                               |
| Timers (`setTimeout`, etc.)    | Time flows through models, not views                  |
| Autonomous animations          | Animations must be driven by model state or bindings  |
| Direct model imports           | Leaf views use bindings for decoupling                |

A good test: if you deleted the view and wrote a new one from scratch, would
the application still work correctly? If yes, the view is properly stateless.
If the view held state the rest of the application depended on, something is
in the wrong layer.

## Presentation State

Most views are pure projections of model state - they read values in
`refresh()` and update the scene graph. No state of their own is needed.

Occasionally a view needs its own state for a cosmetic transition that the
model doesn't track. A model is a standalone simulation that determines game
outcomes. It has no reason to track a 200ms death-flash overlay or a
smooth score count-up - those don't affect what happens next in the game.
But they do need timers and progress values that advance with time, so
the view maintains them.

A view with presentation state gains an `update(deltaMs)` method - the
same time-advancement concept used by models - so the ticker can advance
the view's state each frame:

```
Ticker loop:
  model.update(deltaMs)     -- domain state advances
  view.update(deltaMs)      -- view state advances (views that have it)
  view.refresh()            -- reads model + own state, writes to scene graph
```

When the presentation logic grows complex enough to warrant separate testing,
it can be extracted into a **view model** - a technique borrowed from the
MVVM architecture. The view model is a plain object with `update(deltaMs)`
and readable state, independently testable. The view creates and owns it
internally.

For the full guide on presentation state - what qualifies, how views own it,
when to extract a view model - see
[Presentation State](../guide/presentation-state.md).

## Two Kinds of Views

MVT distinguishes between two kinds of views based on how they access state:

| View kind                      | Receives             | Use case                           |
| ------------------------------ | -------------------- | ---------------------------------- |
| **Top-level application view** | Model(s) directly    | Application-specific, never reused |
| **Leaf / reusable view**       | Bindings object      | Reusable across contexts           |

**Top-level views** (like a game's main view) accept the model directly and
wire bindings for their child views. They are application-specific and have no
reuse scenario, so the full bindings interface would add verbosity without
benefit.

**Leaf views** (like an entity renderer, HUD panel, or overlay) accept a
`get*()`/`on*()` bindings object. This keeps them decoupled from any particular
model shape, making them reusable and independently testable with mock bindings.

The details of this pattern are covered in [Bindings](bindings.md).

---

**Next:** [The Ticker](ticker.md)
