# Views

> A view reads state and updates presentation. It holds no domain state,
> has no idea of time beyond the `refresh()` call, and is constructed once
> then updated every frame.

**Previous:** [Models](../simulating-the-world/models.md) · **Next:** [Bindings](bindings.md)

---

## What is a View?

A view is a **window into the simulation**. Each frame, it reads current model
state and updates its audio/visual output to match - a Pixi.js scene graph, a
DOM element, an audio channel, or a debug panel. You could open multiple
windows (multiple views) onto the same model and they would all stay in sync.
You could close all windows and the simulation would keep running unchanged.

Views hold **no domain state** and are **timeless** - they don't track what
happened before, and they don't decide what happens next. A `refresh()`
function runs each frame. (Views *do* hold a retained scene graph and may
hold [presentation state](#presentation-state) for cosmetic transitions -
"stateless" always refers to domain state in MVT.)

In this project, views typically use Pixi.js containers and manage scene
graphs. The examples below reflect this, but the MVT pattern applies to any
presentation target. For the language-neutral specification, see
[Architecture: Views](../../architecture/views.md).

## A Minimal View

Here is a simple view that tracks a moving bullet's position (using
Pixi.js, as the rest of this project does):

```ts
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

    setTickMethods(view, { refresh });
    return view;
}
```

In this project a view is a function, named like `BulletView`, that takes one
bindings object and returns a Pixi container. It builds its display objects
once, then updates them each frame in `refresh()`. All data comes from
bindings - the view doesn't know or care where the values originate.

::: tip Why views are named like `BulletView`, not `createBulletView`
A JSX tag can call your own function only if its name starts with a capital
letter. Naming views in PascalCase means any view can be used as a tag
(`<BulletView ... />`) as well as called directly (`BulletView({ ... })`); see
[Writing the Body in JSX](#writing-the-body-in-jsx).
:::

The example above has only query bindings (`x`, `y`, `isVisible`), which the
view reads for the state it presents. Views may also have relay bindings,
which the view calls to report user input - for example, `onButtonTapped()`
or `onSwipedUp()`. See [Bindings](bindings.md) for the full pattern.

## What MVT Requires of Views

MVT imposes two architectural constraints on views:

1. **A refresh mechanism** - each frame, the view re-reads current state and
   updates its presentation to match. No stale caches, no autonomous
   animations.
2. **No domain state or logic** - views do not own application state, enforce
   rules, or decide what happens next. That belongs in models.

Everything else - whether you write views as functions or classes, Pixi.js
containers or DOM elements, refresh methods found by a scene walk or manual
call sites - is a style choice. The examples on this page use this repo's
conventions (a view is a function `XxxView(bindings)` returning a Pixi
container, with a refresh method set by `setTickMethods`). See the
[Style Guide](../../reference/style-guide.md#views-and-bindings) for this
repo's specific conventions.

## The `refresh()` Contract

A view's `refresh()` function is called once per frame, after all models have
been updated. It reads current state and updates the presentation to match.

Key principles:

- **Reactive** - every value that may change between frames must be re-read
  in `refresh()`, never cached at construction time. The one exception is a
  query binding the view declares as a fixed value: the view reads it once,
  and does not support it changing (see
  [Bindings in Depth](bindings-in-depth.md#fixed-and-changeable-binding-values)).
- **Idempotent** - calling `refresh()` twice with the same model state
  produces the same visual result.
- **No side effects** - `refresh()` reads state and writes to the
  presentation layer. It does not mutate models, emit events, or trigger
  transitions.
- **Minimise work** - only update what changed. Use change detection for
  infrequent changes to avoid unnecessary rebuilds (see
  [Bindings](bindings.md)).

```ts
// Created once: formats a score only when it differs from last frame's
const scoreText = memoiseLast((score: number) => String(score));

function refresh(): void {
    // Re-read bindings every frame - never cache these values
    label.text = scoreText(bindings.score());
    container.alpha = bindings.opacity?.() ?? 1;
}
```

`memoiseLast` (from `@mvtjs/utils`) keeps `refresh()` from building a new
string every frame: it runs `String(score)` only when the score changes.

## Scene Graphs in Pixi.js

In this project, views work with Pixi.js containers and display objects. At
construction time, the view builds its scene graph - `Container`, `Graphics`,
`Text`, `Sprite`, and other display objects arranged in a tree. In `refresh()`,
the view updates properties on these objects (position, text, visibility, tint)
without tearing down and rebuilding the tree.

This is a hybrid approach: the *data flow* is immediate-mode (`refresh()`
re-reads all state from scratch every frame), but the *output* is
retained-mode (the scene graph persists across frames and is mutated, not
recreated). You get immediate-mode correctness - no stale state, no
subscription bugs - with retained-mode efficiency - no per-frame object
allocation. For the full explanation, see
[Architecture: Views](../../architecture/views.md#immediate-mode-data-flow-retained-mode-output).

```ts
function BulletView(bindings: BulletViewBindings): Container {
    const view = new Container();
    const gfx = new Graphics();
    view.addChild(gfx);

    // Draw once at construction
    gfx.circle(0, 0, 2).fill(0xffffff);

    function refresh(): void {
        const isVisible = bindings.isVisible();
        view.visible = isVisible;
        if (!isVisible) return;

        // Update position from bindings each frame
        view.position.set(bindings.x(), bindings.y());
    }

    setTickMethods(view, { refresh });
    return view;
}
```

`setTickMethods`, from `@mvtjs/pixi`, sets the view's per-frame steps on
its container. Setting the refresh method once at construction means the
view's `refresh()` runs every frame, as long as the view is in the scene: the
host's `tickScene` call finds it wherever it sits in the tree, with no parent
passing calls on. See [The Game Loop](../the-game-loop.md#in-this-project-the-ticker-ticks-models-then-the-scene) for how the scene passes are
driven.

`refresh()` may set the view's own `visible`, as above; nothing about hiding a
view stops its refresh method running, so it can show itself again next frame. To also
skip refreshing everything below it while hidden, return `SKIP_DESCENDANTS`
from `refresh()` instead of plain `return`.

## Writing the Body in JSX

The views above build their display objects by hand and write their own
`refresh()`. This project also has a small JSX runtime (`packages/pixi/src/jsx/`) that
builds the same Pixi objects from tags, and writes the refresh step for you.
Here is the bullet view again, with a JSX body:

```tsx
/** @jsxImportSource @mvtjs/pixi/jsx */

function BulletView(bindings: BulletViewBindings): Container {
    return (
        <graphics
            ref={(g) => g.circle(0, 0, 2).fill(0xffffff)}
            visible={bindings.isVisible}
            x={bindings.x}
            y={bindings.y}
        />
    );
}
```

Each attribute given a function is re-read every frame, as `refresh()` would
re-read it; a plain value is set once. A `visible` function is read first,
and while it returns `false` the element's other attributes and everything
below it are skipped, as the hand-written version's early `return` does.
`ref` receives the element once it is built, here to draw it.

> **Try it live:** <PlaygroundLink preset="traffic-light-jsx" label="Traffic Light (JSX) in Playground" /> -
> a view written in JSX, next to the plain TypeScript
> <PlaygroundLink preset="traffic-light" label="Traffic Light" /> it matches.

Neither kind of body is required. Both give the same outside, a function
taking bindings and returning a container, so callers cannot tell which a
view uses, and a view can choose whichever suits it:

- **JSX** tends to suit views that are mostly a tree of display objects whose
  properties follow the model: sprites, text, a HUD, an overlay, and views
  that compose child views or project collections (see [Presenting Collections](collections.md)).
- **Plain TypeScript** tends to suit views whose work is mostly drawing, or
  managing their own display objects each frame (a pool, a ring buffer), and
  views that need tight control of what happens each frame.

The [Style Guide](../../reference/style-guide.md#writing-the-body) has more
on choosing, and the rest of this guide uses whichever reads better for each
example.

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
the application still work correctly? If yes, the view is properly
domain-stateless. If the view held state the rest of the application depended
on, something is in the wrong layer.

## Presentation State

Most views are pure projections of model state - they read values in
`refresh()` and update the scene graph. No state of their own is needed.

Occasionally a view needs its own state for a cosmetic transition that the
model doesn't track. A model is a standalone simulation that determines game
outcomes. It has no reason to track a 200ms death-flash overlay or a
smooth score count-up - those don't affect what happens next in the game.
But they do need timers and progress values that advance with time, so
the view maintains them.

A view with presentation state gains an `update(deltaMs)` step - the
same time-advancement concept used by models - so the ticker can advance
the view's state each frame:

```
Ticker loop:
  model.update(deltaMs)     -- domain state advances
  view.update(deltaMs)      -- view state advances (views that have it)
  view.refresh()            -- reads model + own state, writes to scene graph
```

In this project, that step is the view's update method
(`setTickMethods(view, { update, refresh })`, or the `onUpdate` attribute in
JSX), run by the update scene pass before any refresh method. Like the refresh
method, it is found wherever the view sits in the tree, so no parent has to
forward `update(deltaMs)` to it.

When the presentation logic grows complex enough to warrant separate testing,
it can be extracted into a **view model** - a technique borrowed from the
MVVM architecture. The view model is a plain object with `update(deltaMs)`
and readable state, independently testable. The view creates and owns it
internally.

For the full guide on presentation state - what qualifies, how views own it,
when to extract a view model - see
[Presentation State](../adding-visual-polish/presentation-state.md).

## Releasing What a View Holds

Most views hold nothing that outlives them. Their display objects are
destroyed along with them, and since views poll rather than subscribe, there
are no subscriptions to undo. A few views hold something that is not one of
their display objects, and so is not destroyed with them:

- a listener on `window` or `document`, such as a keyboard handler
- a resource several of its display objects share, such as a
  `GraphicsContext` many `Graphics` draw from
- a texture the view made itself
- a GSAP timeline

In this project a view releases these on Pixi's `'destroyed'` event, set up
right where it acquires them:

```ts
window.addEventListener('keydown', onKeyDown);
view.on('destroyed', () => window.removeEventListener('keydown', onKeyDown));
```

In a JSX body, the `onDestroyed` attribute does the same for the element it
is on:

```tsx
const boidShape = new GraphicsContext().poly([8, 0, -5, 4, -5, -4]).fill(0x44ccff);

return (
    <container onDestroyed={() => boidShape.destroy()}>
        {/* ...Graphics that all draw boidShape... */}
    </container>
);
```

Prefer the event to replacing the view's `destroy` method: any number of
listeners can be added, each next to what it releases, and none has to
remember to call the original.

::: warning Destroy with `{ children: true }`
Pixi's `destroy()` on its own detaches a container's children without
destroying them, so nothing below it hears `'destroyed'`. Whatever ends a
view's life, such as a game session's `destroy()`, should pass
`{ children: true }`. To catch a missed one, development builds log a
warning when a container is destroyed without `{ children: true }` while a
container below it has a `'destroyed'` listener, since that listener would
never run.
:::

## Two Kinds of Views

MVT distinguishes between two kinds of views based on how they access state:

| View kind                      | Receives             | Use case                           |
| ------------------------------ | -------------------- | ---------------------------------- |
| **Top-level application view** | Model(s) directly    | Application-specific, never reused |
| **Leaf / reusable view**       | Bindings object      | Reusable across contexts           |

**Top-level views** (like a game's main view) take the model itself and
wire bindings for their child views. They are application-specific and have no
reuse scenario, so a full bindings interface would add verbosity without
benefit. In this project a top-level view still has the same signature as
every other view, taking the model as its one binding: `GameView({ model })`.

**Leaf views** (like the view of a single ship or bullet, a HUD panel, or an
overlay) take query and relay bindings. This keeps them decoupled from any
particular model shape, making them reusable and independently testable with
mock bindings.

The details of this pattern are covered in [Bindings](bindings.md).
