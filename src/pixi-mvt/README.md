# pixi-mvt

> Per-frame logic that belongs to a container instead of to a ticker. For Pixi
> developers; no architecture knowledge assumed. See
> [the design notes](../../proposals/002-mvt-plugin-design-notes.md) for how it works and why it is built this
> way.

**Status: spike.** Used by its demo, every game and demo, the cabinet, the
shared views in `src/common/`, the `pixi-jsx` runtime and the playground.
Nothing in the repo refreshes through Pixi's `onRender` any more.

---

Two optional methods on every `Container`, and two functions that drive them
across a scene:

```ts
container.onUpdate = (deltaMs) => { /* advance state over time */ };
container.onRefresh = () => { /* make the scene show current state */ };

updateScene(app.stage, deltaMs); // runs every onUpdate in the subtree
refreshScene(app.stage);         // runs every onRefresh in the subtree
```

Both passes call a container before any of its descendants, run without a
renderer or a ticker, and cost microseconds on a realistic scene. That is the
core API: four names, plus one optional sentinel (`SKIP_DESCENDANTS`, below).

## `onUpdate`: state that moves on its own

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

With `onUpdate`, the angle is a local variable and the subscription disappears:

```ts
function createSpinner(): Container {
    const view = new Graphics().rect(-20, -20, 40, 40).fill(0x44aaff);
    let angle = 0;

    view.onUpdate = (deltaMs) => { angle += 0.002 * deltaMs; }; // state advances
    view.onRefresh = () => { view.rotation = angle; };          // scene matches state

    return view;
}
```

A container animates only while it is in the scene graph. There is nothing to
unsubscribe, nothing to forget, and no coupling to a global clock - the time is
an argument, so a test can pass it whatever it likes. Developers arriving from
Unity recognise `MonoBehaviour.Update` immediately.

## `onRefresh`: the scene catches up

Keeping a scene in sync with game state is normally a chore of remembering:
every place that changes `player.hp` also has to remember to resize the health
bar. `onRefresh` inverts that. It reads state and syncs the display to it:

```ts
const player = { hp: 100 };

healthBar.onRefresh = () => {
    const fraction = player.hp / 100;
    bar.scale.x = fraction;
    bar.tint = fraction > 0.5 ? GREEN : fraction > 0.2 ? YELLOW : RED;
};
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

Rule of thumb: if it changes state, it belongs in `onUpdate`. If it makes the
scene match state, it belongs in `onRefresh`.

## Wiring it up

Nothing is subscribed on your behalf. The frame is yours:

```ts
import { Application } from 'pixi.js';
import { refreshScene, updateScene } from './pixi-mvt';

const app = new Application();
await app.init({ width: 960, height: 600 });

app.ticker.add((ticker) => {
    model.update(ticker.deltaMS);            // your game state
    updateScene(app.stage, ticker.deltaMS);  // views advance their own state
    refreshScene(app.stage);                 // views sync from state
});
```

Every `onUpdate` in the scene finishes before any `onRefresh` starts, so no
frame is drawn from a half-updated world. That is a property of the loop above,
not something the library enforces, which is what makes the next part free:

```ts
app.ticker.add((ticker) => {
    if (!paused) {
        updateScene(app.stage, ticker.deltaMS * timeScale); // 0.25 is slow motion
    }
    refreshScene(app.stage); // runs either way
});

// and a single-step debug key is just:
onKeyPress('.', () => updateScene(app.stage, 16));
```

Pause, slow motion and single-stepping all fall out of that, and a paused frame
still draws correctly: menus opened while paused lay themselves out, sliders
track, and anything that changes state while the world is frozen shows up
immediately.

`updateScene` and `refreshScene` can be called on **any** container, at any
time, by more than one caller. Driving a branch is as valid as driving the
stage, which is what lets a test drive one view and an editor drive one panel.

## Why not `onRender`?

**Recommendation: do not use `onRender` for state sync. Use `onRefresh`.**

`onRender` is not broken, and this is not a criticism of it. It answers the
question *"I am about to be drawn"*. `onRefresh` answers *"the state may have
changed"*. Those are different questions, and they only give the same answer
when render cadence equals tick cadence and nothing in the tree is cached.

Five ways they diverge, in rough order of how likely they are to bite:

1. **`onRender` fires per render, not per tick.** A render-on-demand app
   (editors, tools, UI-heavy Pixi) may render zero or three times in a tick.
   Fixed-timestep simulation with interpolated rendering decouples the two by
   design. In both, sync happens at the wrong cadence or not at all. Pairing
   `onUpdate` with `onRender` quietly reintroduces exactly the render coupling
   that `onUpdate` exists to remove.
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
   yourself, which is this plugin.
5. **An ordering hole.** `onRender`'s registration list is append-only, so
   assigning it to an already-attached container whose descendants are already
   registered places the ancestor *after* them.

To be fair to it: `onRender`'s ordering is better than it is often described.
Whole subtrees are registered in preorder and nested render groups run
parent-first, so late attachment, reparenting and sibling reordering are all
fine. Point 5 is the one genuine hole, and this plugin closes it because
assigning a method goes through a setter that invalidates the cached list.

The positive case is simpler: `onUpdate` and `onRefresh` are a matched pair.
Same traversal, same ordering guarantee, same invalidation, same testability,
both driven by explicit calls at points you choose. Mixing `onUpdate` with
`onRender` means two mechanisms with different semantics, one of which you do
not control.

## It composes in JSX

This is the one thing with no workaround. The experimental
[`src/pixi-jsx/`](../pixi-jsx/) runtime types `JSX.Element` as `Container`, and
`ListProps.to` as `(item, index) => Container`. Every composition point is
therefore blind to a view that carries its own `update()` method: the
`& { update }` half of the type is erased the moment the value enters a JSX
tree, and `addChildren()` just calls `parent.addChild(child)`.

So an update-bearing view cannot simply be written into a scene. It has to be
built separately, outside the tree, so a reference survives for manual tick
forwarding, then spliced back in by `ref` or hoisted above the JSX entirely.
That is a second construction path running alongside the declarative one, and
it exists purely so somebody can reach a method.

With `onUpdate` the problem disappears rather than being worked around. An
update-bearing view is an ordinary `Container` that composes at any depth,
inside a `<List>`, with no ref and no forwarding. The pass finds it by walking
the tree that JSX just built.

## Testing

Both passes are ordinary function calls, so a scene runs with no `Application`,
no renderer and no ticker.

`onRefresh` is the easy one, because it is a pure projection of state. Set the
state, refresh once, assert on the scene. No frames, no time:

```ts
it('shows a hurt bar in amber', () => {
    player.hp = 30;
    refreshScene(healthBar);

    expect(bar.scale.x).toBeCloseTo(0.3);
    expect(bar.tint).toBe(0xddaa33);
});
```

`onUpdate` takes the time you give it:

```ts
import { Container } from 'pixi.js';
import { refreshScene, updateScene } from './pixi-mvt';

it('spins two radians per second', () => {
    const root = new Container();
    const spinner = createSpinner();
    root.addChild(spinner);

    updateScene(root, 1000);
    refreshScene(root);

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
correct regardless of what siblings or descendants did this pass. A view whose
method depends on another view's output is reading a view instead of reading
state - and any data-dependent ordering (aggregating over already-advanced
children) belongs in the model's advance-then-orchestrate, not a view pass.

**Gating.** Neither pass gates on `visible`. Every container's method runs every
frame, visible or not: `onUpdate` because presentation state that stops
advancing while hidden is stale when it reappears, and `onRefresh` because a
refresh only restates a fact, which is cheap and keeps the two passes symmetric.
A view may therefore set its **own** `visible` - it is presentation output like
position and scale, and hiding a container never removes it from its own walk.

**Skipping a subtree.** To skip a container's descendants for a frame, return the
`SKIP_DESCENDANTS` sentinel from its `onUpdate` or `onRefresh`:

```ts
import { SKIP_DESCENDANTS } from './pixi-mvt';

slot.onRefresh = () => {
    if (item === undefined) return SKIP_DESCENDANTS; // leave the empty slot's subtree alone
    // ...otherwise project item into the subtree
};
```

The container itself has already run, so only its descendants are skipped - it
can stop returning the sentinel on a later frame and the subtree resumes, with
no deadlock. It works the same on both passes: skipping a branch's refresh saves
the work of restating hidden facts, and skipping its update freezes that
branch's presentation state (which is then one frame stale when it resumes,
exactly as a paused world is). The container a pass is driven from is never
skipped by an outside caller; a driven root that returns the sentinel still
skips only its descendants.

**Mutation during a pass.** A pass walks a snapshot of the list taken before the
first method ran.

| An `onUpdate` or `onRefresh`, during the pass... | Behaviour                                    |
| ------------------------------------------------ | -------------------------------------------- |
| adds a child that has its own                    | Not in the snapshot; runs from the next pass |
| removes a **later** container                    | Skipped                                      |
| removes an **earlier** container                 | No effect this pass                          |
| clears a later container's                       | Skipped                                      |
| reparents a container in the same subtree        | Called once, from its snapshot position      |
| destroys a container                             | Same as removing it                          |
| returns `SKIP_DESCENDANTS`                       | Its descendants are skipped for this pass    |
| re-enters the same pass on the same node         | Throws                                       |

A view that builds children inside `onRefresh` therefore has to give them their
first frame itself, by refreshing them as it creates them. That is one line in
the one place that knows it is needed;
[the demo's entity view](../pixi-mvt-demo/swarm-view.ts) does it.

**Both run every frame**, so do not allocate in them. Index-based loops, no
`array.map()`, no template strings.

**`onRefresh` must be safe to run twice.** Assign, never accumulate:
`view.x = ...`, not `view.x += ...`. Accumulate in `onUpdate` instead.

**Mutating `container.children` directly is not supported.** The plugin learns
about tree changes from `addChild`, `addChildAt`, `removeChild`,
`removeChildren` and `destroy`. Splicing the array behind their backs leaves a
stale list.

## What it costs

Measured with `npm run bench -- scene-passes`: each case in its own process,
bundled to plain JavaScript, microseconds per frame on a 2025 machine
(2026-09-25). A frame is one pass plus the scenario's changes to the tree.

| Scenario                                                       | naive walk  | this plugin |
| -------------------------------------------------------------- | ----------- | ----------- |
| 20k containers, 200 with an `onRefresh`, static                | 200 us      | **0.60 us** |
| 2k containers, all with an `onRefresh`, static                 | 9.4 us      | **5.1 us**  |
| 2k containers, all with an `onRefresh`, 100 swaps/frame        | **36.0 us** | 91.0 us     |
| 100 subtrees of 25 containers with no `onRefresh`, re-attached | 42.3 us     | **9.6 us**  |

The first row is the realistic shape - a large scene where few containers have
an `onRefresh` - and it is why the list is cached rather than walked. The third row is
the honest one: when every container has one *and* the tree changes
every frame, the cache is rebuilt every frame and pure overhead. That case is
structural and documented rather than fixed.

Three more worth having:

- **Dispatch against the incumbent.** 2000 methods through Pixi's own `onRender`
  list cost 2.1 us; the same 2000 through `refreshScene` cost 5.1 us. The
  difference is about 1.5 ns per container, and buys the detachment check that
  makes mid-pass removal safe.
- **What the monkey-patch costs a tree that never uses it.** 100 attach and
  detach pairs on an unmanaged tree: 11.3 us unpatched, 12.1 us patched, about
  8 ns per pair. Small, but measurable. The patch is the main adoption
  objection, and the objection is about trust rather than speed, so the number
  is here.
- **Skipping subtrees.** 10k containers, each with an `onRefresh`, in 100 groups, 90 of them
  inactive: 126 us when the inactive groups are only hidden, 8.7 us when they
  return `SKIP_DESCENDANTS`.

The full results, and the other benchmarks, are in the docs'
[Performance Measurements](../../docs/building-with-mvt/performance/measurements.md).

## Running it

| Command                              | What it does           |
| ------------------------------------ | ---------------------- |
| `npx vitest run src/pixi-mvt*`        | 62 tests               |
| `npm run bench -- scene-passes`      | The table above        |
| `npm run dev`, then `/spike/`        | Visual demo            |

The demo page is dev-server only. To include it in `npm run build`, add
`'spike': resolve(__dirname, 'spike/index.html')` to `rollupOptions.input` in
`vite.config.ts`. That edit has deliberately not been made.

The demo lives in [`src/pixi-mvt-demo/`](../pixi-mvt-demo/),
beside the plugin rather than inside it: a demo is a consumer of the plugin, so
nesting it would force an ancestor-barrel import, which
[project-structure.md](../../docs/reference/project-structure.md) forbids.

## Next

- [the design notes](../../proposals/002-mvt-plugin-design-notes.md) - how the traversal is memoised, what was
  tried and rejected, the benchmark method, and the open questions.
- [the appraisal](../../proposals/003-mvt-plugin-appraisal.md) - an independent review of whether this repo
  should adopt it at all.
- Once game state outgrows a few closures, the rest of this repo shows the
  model-and-view split these two methods were designed for. You do not need it to
  use them.
