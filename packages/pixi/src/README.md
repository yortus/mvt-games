# @mvtjs/pixi

> Per-frame logic that belongs to a container instead of to a ticker. For Pixi
> developers; no architecture knowledge assumed. See
> [the design notes](./design-notes.md) for how it works and why it is built this
> way.

**Status: adopted.** Used by every game and demo, the cabinet, the
shared views in `packages/website/src/shared/`, the Pixi JSX runtime and the playground.
Nothing in the repo refreshes through Pixi's `onRender` any more.

---

Two optional methods a `Container` can be given, and two functions that drive
them across a scene:

```ts
setUpdate(container, (deltaMs) => { /* advance state over time */ });
setRefresh(container, () => { /* make the scene show current state */ });

updateView(app.stage, deltaMs);  // every update method in the stage
refreshView(app.stage);          // then every refresh method
```

The two calls together are a **tick** of the stage. Both call a container
before any of its descendants, run without a renderer or a ticker, and cost
microseconds on a realistic scene. That is the core API: four names, plus one
optional sentinel (`SKIP_DESCENDANTS`, below). They are defined once in
`@mvtjs/utils`; this package registers Pixi's containers with them and
re-exports them, as `@mvtjs/three` and `@mvtjs/html` do for their trees.

Nothing is added to `Container`'s public surface. The methods live in private
fields, and nothing hands them back out: `hasUpdate(container)` and
`hasRefresh(container)` say whether a container has one, and the only way to
run them is `updateView` and `refreshView`.

## The update method: state that moves on its own

Most games have visuals that animate without affecting gameplay - a spinning
indicator, a hit flash, a recoil spring. That is localised state, and today Pixi
has nothing for it. It takes a ticker subscription and a matching
unsubscription that is easy to forget, which leaks and keeps ghost animations
running after teardown:

```ts
function createSpinner(): Container {
    const view = new Graphics().rect(-20, -20, 40, 40).fill(0x44aaff);

    const tick = (ticker: Ticker) => {
        view.rotation += 0.002 * ticker.deltaMS;
    };
    Ticker.shared.add(tick);
    view.on('destroyed', () => Ticker.shared.remove(tick));

    return view;
}
```

With an update method, the angle is a local variable and the subscription
disappears:

```ts
function createSpinner(): Container {
    const view = new Graphics().rect(-20, -20, 40, 40).fill(0x44aaff);
    let angle = 0;

    setUpdate(view, (deltaMs) => { angle += 0.002 * deltaMs; });  // state advances
    setRefresh(view, () => { view.rotation = angle; });           // scene matches state

    return view;
}
```

A container animates only while it is in the scene graph. There is nothing to
unsubscribe, nothing to forget, and no coupling to a global clock - the time is
an argument, so a test can pass it whatever it likes. Developers arriving from
Unity recognise `MonoBehaviour.Update` immediately.

## The refresh method: the scene catches up

Keeping a scene in sync with game state is normally a chore of remembering:
every place that changes `player.hp` also has to remember to resize the health
bar. A refresh method inverts that. It reads state and syncs the display to it:

```ts
const player = { hp: 100 };

setRefresh(healthBar, () => {
    const fraction = player.hp / 100;
    bar.scale.x = fraction;
    bar.tint = fraction > 0.5 ? GREEN : fraction > 0.2 ? YELLOW : RED;
});
```

The bar is now correct forever, and not because anything told it. A trap, a
healing potion, loading a save, a cheat typed into a debug console: none of them
need a line of code to keep the bar in sync, because the bar re-derives itself
from `player.hp` every frame. No dirty flags, no change events, no `setHp()`
that also has to remember to resize a rectangle. A whole category of stale
display bugs goes away.

It is the same split as the spinner, just bigger and public. `angle` is state
and `view.rotation` is the picture of it, exactly as `player.hp` is state and
`bar.scale.x` is the picture of it.

Rule of thumb: if it changes state, it belongs in the update method. If it
makes the scene match state, it belongs in the refresh method.

Each setter replaces the method before: `setRefresh(view, undefined)` clears
it.

## Wiring it up

Nothing is subscribed on your behalf. The frame is yours:

```ts
import { Application } from 'pixi.js';
import { refreshView, updateView } from '@mvtjs/pixi';

const app = new Application();
await app.init({ width: 960, height: 600 });

app.ticker.add((ticker) => {
    model.update(ticker.deltaMS);           // your game state
    updateView(app.stage, ticker.deltaMS);  // views advance their own state...
    refreshView(app.stage);                 // ...then sync from state
});
```

Every update method in the scene finishes before any refresh method starts, so
no frame is drawn from a half-updated world. The models advance first because
the loop above says so, not because the library enforces it, which is what
makes the next part free:

```ts
// The world sits out updateView while paused; the pause menu, outside it,
// keeps running. Both are refreshed either way.
setUpdate(world, () => (paused ? SKIP_DESCENDANTS : undefined));

app.ticker.add((ticker) => {
    const deltaMs = ticker.deltaMS * timeScale; // 0.25 is slow motion
    if (!paused) model.update(deltaMs);
    updateView(app.stage, deltaMs);
    refreshView(app.stage);
});

// and a single-step debug key is just:
onKeyPress('.', () => {
    model.update(16);
    updateView(world, 16);
    refreshView(world);
});
```

Pause, slow motion and single-stepping all fall out of that, and a paused frame
still draws correctly: menus opened while paused lay themselves out, sliders
track, and anything that changes state while the world is frozen shows up
immediately.

`updateView` and `refreshView` can be called on **any** container, at any
time, by more than one caller. Updating a branch is as valid as updating the
stage, which is what lets a test drive one view and an editor one panel. They
are separate calls, so a caller can update many times and refresh once, such
as for a thumbnail:

```ts
for (let t = 0; t < 2000; t += 16) updateView(view, 16);
refreshView(view);
```

In dev builds, a `deltaMs` that is not a finite number throws. A negative one
is allowed, for running time backwards.

## Why not `onRender`?

**Recommendation: do not use `onRender` for state sync. Use a refresh method.**

`onRender` is not broken, and this is not a criticism of it. It answers the
question *"I am about to be drawn"*. A refresh method answers *"the state may
have changed"*. Those are different questions, and they only give the same answer
when render cadence equals tick cadence and nothing in the tree is cached.

Five ways they diverge, in rough order of how likely they are to bite:

1. **`onRender` fires per render, not per tick.** A render-on-demand app
   (editors, tools, UI-heavy Pixi) may render zero or three times in a tick.
   Fixed-timestep simulation with interpolated rendering decouples the two by
   design. In both, sync happens at the wrong cadence or not at all. Pairing
   an update method with `onRender` quietly reintroduces exactly the render
   coupling that the update method exists to remove.
2. **`cacheAsTexture` silently suppresses it.** It is a mainstream performance
   tool - static backgrounds, tile layers, complex UI panels. The moment anyone
   caches a subtree, every `onRender` inside it stops firing. A teammate
   enabling caching for performance breaks someone else's sync, with no error.
3. **Render groups fragment its ordering.** `renderGroup: true` is Pixi 8's
   recommended tool for subtrees that move as a unit - cameras, parallax, HUDs.
   Each group keeps its own callback list.
4. **No renderer means no sync at all.** Headless scene-wide testing,
   server-side simulation, fast-forward and netcode rollback, thumbnail
   generation. You can call one container's `onRender` by hand; you cannot do
   that for a composed scene of twenty nested views without writing the walk
   yourself, which is what `refreshView` is.
5. **An ordering hole.** `onRender`'s registration list is append-only, so
   assigning it to an already-attached container whose descendants are already
   registered places the ancestor *after* them.

To be fair to it: `onRender`'s ordering is better than it is often described.
Whole subtrees are registered in preorder and nested render groups run
parent-first, so late attachment, reparenting and sibling reordering are all
fine. Point 5 is the one genuine hole, and @mvtjs/pixi closes it because
setting a method clears the cached method lists above the container.

The positive case is simpler: the update and refresh methods are a matched
pair. Same traversal, same ordering guarantee, same invalidation, same
testability, both driven by explicit calls at a point you choose. Mixing an
update method with `onRender` means two mechanisms with different semantics,
one of which you do not control.

## It composes in JSX

This is the one thing with no workaround. The
[`packages/pixi/src/jsx/`](./jsx/) runtime types `JSX.Element` as `Container`, and
`ListBindings.children` as `(item, index) => Container`. Every composition
point is therefore blind to a view that carries its own `update()` method: the
`& { update }` half of the type is erased the moment the value enters a JSX
tree, and `addChildren()` just calls `parent.addChild(child)`.

So an update-bearing view cannot simply be written into a scene. It has to be
built separately, outside the tree, so a reference survives for manual tick
forwarding, then spliced back in by `ref` or hoisted above the JSX entirely.
That is a second construction path running alongside the declarative one, and
it exists purely so somebody can reach a method.

With an update method set on the container, the problem disappears rather
than being worked around. An update-bearing view is an ordinary `Container`
that composes at any depth, inside a `<List>`, with no ref and no forwarding.
`updateView` finds it by walking the tree that JSX just built.

## Testing

`updateView` and `refreshView` are ordinary function calls, so a scene runs
with no `Application`, no renderer and no ticker.

The refresh method is the easy one, because it is a pure projection of state.
Set the state, refresh once, assert on the scene. No frames, no time:

```ts
it('shows a hurt bar in amber', () => {
    player.hp = 30;
    refreshView(healthBar);

    expect(bar.scale.x).toBeCloseTo(0.3);
    expect(bar.tint).toBe(0xddaa33);
});
```

The update method takes the time you give it:

```ts
import { Container } from 'pixi.js';
import { refreshView, updateView } from '@mvtjs/pixi';

it('spins two radians per second', () => {
    const root = new Container();
    const spinner = createSpinner();
    root.addChild(spinner);

    updateView(root, 1000);
    refreshView(root);

    expect(spinner.rotation).toBeCloseTo(2);
});
```

Because you pass the time in, a thousand frames run instantly or one frame runs
at a time. The same trick covers promo shots, rewind and replay: step scene
time however you like, then render it.

## Rules of the road

**Ordering.** Every container runs before any of its descendants, so a parent
may create or configure descendants before their methods run. Sibling order is
deliberately unspecified, and the parent-first guarantee is structural, not a
data-flow promise: each method should be a pure state-to-output projection,
correct regardless of what siblings or descendants did in this call. A view
whose method depends on another view's output is reading a view instead of
reading state - and any data-dependent ordering (aggregating over
already-advanced children) belongs in the model's advance-then-orchestrate, not
in `updateView`.

**Gating.** Neither function gates on `visible`. Every container's method
runs every frame, visible or not: the update method because presentation state
that stops advancing while hidden is stale when it reappears, and the refresh
method because a refresh only restates a fact, which is cheap and keeps the two
symmetric. A view may therefore set its **own** `visible` - it is presentation
output like position and scale, and hiding a container never removes it from
its own method list.

**Skipping a subtree.** To skip a container's descendants for a frame, return the
`SKIP_DESCENDANTS` sentinel from its update or refresh method:

```ts
import { setRefresh, SKIP_DESCENDANTS } from '@mvtjs/pixi';

setRefresh(slot, () => {
    if (item === undefined) return SKIP_DESCENDANTS; // leave the empty slot's subtree alone
    // ...otherwise project item into the subtree
});
```

The container itself has already run, so only its descendants are skipped - it
can stop returning the sentinel on a later frame and the subtree resumes, with
no deadlock. It works the same in both functions: skipping a branch's refresh
saves the work of restating hidden facts, and skipping its update freezes that
branch's presentation state (which is then one frame stale when it resumes,
exactly as a paused world is). The container a call starts from is never
skipped by an outside caller; one that returns the sentinel still skips only
its descendants.

**Wrapping a method.** A method that declares a parameter for the method it
replaces is given that method, and wraps it: a refresh method with one or more
parameters, an update method with two or more. This is how `<List>` gates an
item view's own refresh:

```ts
setRefresh(slot, (own) => (isPresent() ? own?.() : SKIP_DESCENDANTS));
setUpdate(node, (deltaMs, own) => own?.(deltaMs));
```

It is bound once, when it is set, so every method is called the same way. A
default-valued or rest parameter does not count, and setting a method
afterwards, or clearing it, replaces the whole chain.

**Mutation during a call.** `updateView` and `refreshView` invoke a method
list taken before the first method ran. If a method changed the subtree during
`refreshView`, it then runs every refresh method the list missed before it
returns.

| An update or refresh method, during the call...       | Behaviour                                        |
| ----------------------------------------------------- | ------------------------------------------------ |
| adds a child that has a refresh method                | Refreshed before `refreshView` returns           |
| adds a child that has an update method                | Not in the list; updated from the next frame     |
| gives a container a refresh method                    | Refreshed before `refreshView` returns           |
| removes a **later** container                         | Skipped                                          |
| removes an **earlier** container                      | No effect this call                              |
| clears a later container's method                     | Skipped                                          |
| reparents a container in the same subtree             | Called once, from its listed position            |
| destroys a container                                  | Same as removing it                              |
| returns `SKIP_DESCENDANTS`                            | Its descendants are skipped for this call, including any added under it later in it |
| updates or refreshes a different container            | Allowed; a container it refreshes is not refreshed again by the outer call |
| updates or refreshes the same container again         | Throws                                           |

So a view may build children inside its own refresh method, and they are never
drawn unrefreshed; `<List>` and `<Switch>` in [`packages/pixi/src/jsx/`](./jsx/list.ts)
rely on this. A frame whose subtree changes during its refresh rebuilds the
method list then rather than on the next frame, so refreshing the missed
containers costs one extra invocation that runs only what was added.

The two functions deliberately cover different things, each what its methods
need:

- **`refreshView` covers the tree as it stands when it ends.** A refresh
  method is idempotent, so running it late is always safe, and what matters is
  that everything drawn is current.
- **`updateView` covers the time step for the containers that existed when it
  began.** An update method advances time, and a container created during the
  call did not exist for that time, so it starts advancing on the next frame.
  Giving it this frame's `deltaMs` would put it a frame ahead of the state its
  creator gave it.

So a view's first refresh can come before its first update, and a view must
start its presentation state valid at construction rather than rely on an
update having run.

**Both run every frame**, so do not allocate in them. Index-based loops, no
`array.map()`, no template strings.

**A refresh method must be safe to run twice.** Assign, never accumulate:
`view.x = ...`, not `view.x += ...`. Accumulate in the update method instead.

**Mutating `container.children` directly is not supported.** @mvtjs/pixi learns
about tree changes from `addChild`, `addChildAt`, `removeChild`,
`removeChildren` and `destroy`. Splicing the array behind their backs leaves a
stale method list.

## Counting a tick's work

`tickCounter` counts what ticks do. Some of it counts itself: the methods
`updateView` and `refreshView` call, the method lists they rebuild (a scene's
churn), and the node visits rebuilding them takes. The rest is reads: a
refresh that polls does work in proportion to what it reads, so code that
polls reports its own reads with `addReads`, which costs a flag check while
nothing is measuring.

```ts
import { addReads, countTick, refreshView, setRefresh } from '@mvtjs/pixi';

setRefresh(view, () => {
    for (let i = 0; i < dots.length; i++) drawDot(i, dots.at(i));
    addReads(dots.length);
});

const { reads, methodCalls, methodListRebuilds } = countTick(() => refreshView(app.stage));
```

The [JSX runtime](./jsx/) counts its reads itself: every
function attribute it calls, so a JSX scene is counted without any code of
its own.

`createPerformanceMetrics` samples `tickCounter` for one frame in each window,
alongside frame rate and CPU and GPU time, and the perfmon panel in
`packages/website/src/shared/` shows the results.

## What it costs

Measured with `npm run bench -- refresh-view`: each case in its own process,
bundled to plain JavaScript, microseconds per frame on a 2025 machine
(2026-10-02). A frame is one `refreshView` plus the scenario's changes to the
tree.

| Scenario                                                          | naive walk  | `refreshView` |
| ----------------------------------------------------------------- | ----------- | ------------- |
| 20k containers, 200 with a refresh method, static                 | 206 us      | **0.65 us**   |
| 2k containers, all with a refresh method, static                  | 9.3 us      | **5.6 us**    |
| 2k containers, all with a refresh method, 100 swaps/frame         | **28.9 us** | 127 us        |
| 100 subtrees of 25 containers with no refresh method, re-attached | 44.0 us     | **8.7 us**    |

The first row is the realistic shape - a large scene where few containers have
a refresh method - and it is why the method list is cached rather than walked.
The third row is the honest one: when every container has one *and* the tree
changes every frame, the method list is rebuilt every frame and the cache is
pure overhead. That case is structural and documented rather than fixed.

Three more worth having:

- **Dispatch against the incumbent.** 2000 methods through Pixi's own `onRender`
  list cost 1.9 us; the same 2000 through `refreshView` cost 5.6 us. The
  difference is about 2 ns per container, and buys the detachment check that
  makes removal during a call safe.
- **What the mixin costs a tree that never uses it.** 100 attach and
  detach pairs on an unmanaged tree: 11.4 us unpatched, 12.0 us patched, about
  6 ns per pair. Small, but measurable. The mixin's patching of
  `Container.prototype` is the main adoption objection, and the objection is
  about trust rather than speed, so the number is here.
- **Skipping subtrees.** 10k containers, each with a refresh method, in 100
  groups, 90 of them inactive: 128 us when the inactive groups are only
  hidden, 10.2 us when they return `SKIP_DESCENDANTS`.

The full results, and the other benchmarks, are in the docs'
[Performance Measurements](../../../docs/building-with-mvt/performance/measurements.md).

## Running it

| Command                              | What it does           |
| ------------------------------------ | ---------------------- |
| `npx vitest run packages/pixi/src`   | The tests, the JSX runtime's included |
| `npm run bench -- refresh-view`      | The table above        |

## Next

- [the design notes](./design-notes.md) - how the method lists are cached, what
  was tried and rejected, the benchmark method, and the open questions.
- [the appraisal](../../../notes/archive/003-mvt-plugin-appraisal.md) - an independent review of whether this repo
  should adopt it at all.
- Once game state outgrows a few closures, the rest of this repo shows the
  model-and-view split these two methods were designed for: the ticker updates
  the models, then updates and refreshes the views. You do not need it to use
  them.
