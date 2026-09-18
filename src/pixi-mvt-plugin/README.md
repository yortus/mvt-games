# pixi-mvt-plugin (spike)

Scene-wide `onUpdate(deltaMs)` and `onRefresh()` for Pixi containers, with a
traversal order MVT can rely on.

**Status: spike.** Nothing outside this folder and its demo imports it, and no
existing view has been migrated. The 60 files using `onRender` are untouched.

The demo lives in `src/pixi-mvt-plugin-demo/`, beside the plugin rather than
inside it. A demo is a consumer of the plugin, so nesting it would have forced
an ancestor-barrel import (`from '../index'`), which inverts the dependency
direction and is not done anywhere else in this repo.

New to this? Start with [QUICK-START.md](QUICK-START.md), which assumes Pixi
experience and no knowledge of MVT. This page is the design rationale.

## Running it

| Command                                        | What it does                          |
| ---------------------------------------------- | ------------------------------------- |
| `npx vitest run src/pixi-mvt-plugin*`           | 57 tests                              |
| `npx vitest bench --run src/pixi-mvt-plugin/`   | Strategy comparison                   |
| `npm run dev`, then `/spike/`                   | Visual demo                           |

The demo page is dev-server only. To include it in `npm run build`, add
`'spike': resolve(__dirname, 'spike/index.html')` to `rollupOptions.input` in
`vite.config.ts`. That edit has deliberately not been made.

## API

```ts
import { createSceneScheduler, installMvtScenePlugin } from './pixi-mvt-plugin';

// Core: works on any Container. No Application, no ticker, no renderer.
const scene = createSceneScheduler(root);
scene.update(16);
scene.refresh();

// Adapter: exposes app.scene, and subscribes to nothing.
installMvtScenePlugin();
const app = new Application();
await app.init({ mvtStrategy: 'incremental' });

app.ticker.add((ticker) => {
    model.update(ticker.deltaMS);
    app.scene.update(ticker.deltaMS);
    app.scene.refresh();
});
```

Any container can carry either hook:

```ts
view.onUpdate = (deltaMs) => { flashMs -= deltaMs; };
view.onRefresh = () => { view.position.set(bindings.getX(), bindings.getY()); };
```

## The ordering contract

**Every container is called before any of its descendants. Sibling order is
unspecified.**

Sibling order is left out on purpose. A view whose `refresh` depends on a
sibling's `refresh` is reading another view's presentation output rather than
the model, which is cross-talk MVT already rules out. Ancestors are different:
a parent legitimately sets a transform, layout or visibility that children read.

That weaker contract is what makes the rest of the design work:

- Pure sibling reorderings cannot invalidate a call list, so `swapChildren`,
  `sortChildren`, `setChildIndex` and `addChild`-to-move are not hooked at all.
  This matters, because Pixi calls `sortChildren` itself during rendering
  whenever `sortableChildren` is set.
- Attaching a subtree can append its hooks to the tail of the list. Every
  appended node's ancestors are either inside the appended block, and earlier in
  it because the block is in preorder, or were already in the list before the
  block started. So maintenance costs the size of the change, not the size of
  the scene.

The one thing this contract cannot express is bottom-up measurement, where a
parent sizes itself from its children's measured extents. Pixi bounds are
pull-based and computed at call time (`getLocalBounds` recomputes through
`checkChildrenDidChange`), so measuring your own children inside a single
`refresh` body is correct regardless of traversal order. Only measurement
*across* views lags by a tick, and the fix is for the view doing the measuring
to own the thing being measured.

## What `onRender` actually guarantees

Earlier in this spike `onRender` was described as having no ordering guarantee.
That was overstated, and the correction is worth recording.

`RenderGroup._onRenderContainers` is a flat append-ordered array, but the two
registration paths that matter (`RenderGroup.init` and `RenderGroup.addChild`)
both append whole subtrees in preorder, which preserves
ancestors-before-descendants for the same reason the incremental strategy does.
Nested render groups also run parent-first, since `_updateRenderGroups` recurses
into `renderGroupChildren` after calling `runOnRender`. So late attachment,
reparenting and sibling reordering are all fine under `onRender`.

The one genuine ordering hole is assigning `onRender` to an **already-attached**
container whose descendants are already registered: the setter appends, placing
the ancestor after its own descendants. The factory convention in this repo
dodges it, because views are built detached and hooked before being attached.

So the ordering argument is a weak reason to adopt this. The real reasons are:

1. There is no `update(deltaMs)` equivalent at all.
2. `onRender` requires a render. No renderer means no refresh, which rules out
   headless tests, and makes `generateThumbnails` work only incidentally.
3. `cacheAsTexture` silently suppresses it: `_updateRenderGroups` returns early
   for a cached group whose texture is current, and nested groups stop firing.
4. Refresh scheduling stays coupled to render internals.

Incidentally, `runOnRender` is called unconditionally and has never been gated
on visibility, so the workaround at `src/common/pause-menu-view.ts:33` ("outer
stays visible so onRender fires") was never needed.

## Gating

Neither pass is gated on `visible`, `renderable`, culling, or whether a render
happened.

`onUpdate` must not be gated. It advances time-dependent cosmetic state, and
state that stops advancing while hidden is stale when it reappears. Worse,
gating it would make presentation state a function of whether something was
rendered. The way to stop it is to detach or destroy, which is explicit and
costs nothing per tick.

`onRefresh` could safely be gated, since it is required to be idempotent. It
isn't, for now, because the cheap lever is already detachment and because
Pixi's folded `globalDisplayStatus` is computed during the render pass, so
reading it from a refresh gives last frame's answer. If profiling later shows
per-entity refresh cost matters, the gate is a single predicate in the pass
loop and effective visibility should be computed during the walk rather than
borrowed from the renderer.

## Hook signature

`onUpdate(deltaMs: number)`, not `onUpdate(ticker)`. Passing a `Ticker` would be
more consistent with `ticker.add`, but it hands views `lastTime`, `elapsedMS`
and `FPS`, which is the wall clock that MVT rule 1 exists to keep out. It also
makes synthetic stepping (tests, thumbnails, replays) awkward, invites views to
pick a different time base from their models via `ticker.speed`, and would give
the core a hard dependency on Pixi's Ticker.

## Drain-the-tail

Each pass iterates a snapshot, so a container created by a hook is not in that
pass's list. Without help it would render one frame of constructor state, which
every entity-spawning view would hit.

After the main loop, the scheduler runs hooks on containers attached during the
pass, repeating up to `maxDrainRounds` (default 4) and warning in dev if the cap
is hit. Ancestors-first still holds: a drained container was attached under
something the pass already visited.

Known edge: detaching and re-attaching a container that sits *earlier* in the
list than the hook doing the mutating can run it twice in one pass. Reconciling
parents do not hit this, because their children always sit after them.

## Strategies

Both satisfy the same contract and are selected by option.

- **`rebuild`** marks the lists dirty on any membership change and re-walks the
  whole tree at the start of the next pass. About thirty lines.
- **`incremental`** appends attached subtrees, tombstones detached ones, and
  compacts when tombstones reach half the list. Never walks the whole tree after
  construction.

Measured on a 2000-container scene (`vitest bench`, one tick = churn + update +
refresh):

| Scenario                  | rebuild    | incremental | winner              |
| ------------------------- | ---------- | ----------- | ------------------- |
| Static scene              | 53,086 hz  | 51,700 hz   | tie (within noise)  |
| 5 swaps per tick          | 11,972 hz  | 21,841 hz   | incremental, 1.82x  |
| 100 swaps per tick        | 7,987 hz   | 12,614 hz   | incremental, 1.58x  |

Two findings worth flagging, because both contradict what was predicted before
measuring:

1. **The win is under 2x, not the order of magnitude expected.** Hook dispatch
   dominates a tick. Walking 2000 containers is expensive, but not next to
   dispatching 4000 hook calls, so removing the walk cannot buy more than it
   costs.
2. **The advantage shrinks as churn rises**, from 1.82x at 5 swaps to 1.58x at
   100. Both strategies pay the per-subtree ownership-stamping walk on attach
   and detach, and that shared cost grows with churn while the rebuild being
   avoided stays a fixed 2000-node walk.

Which is to say: `incremental` is the better default and the cost of keeping it
is a tombstone-and-compaction scheme, but `rebuild` is not the liability it
looked like on paper. If the complexity ever becomes a problem, dropping to
`rebuild` costs less than expected.

## How it works

`installMvtContainerMixin()` (called automatically) does two things:

1. `extensions.mixin(Container, ...)` adds `onUpdate` / `onRefresh` as
   **accessors**. Assignment is what lets a hook added to an already-attached
   container re-seat its subtree, which is what closes the `onRender` hole
   described above. The backing fields are `_mvtOnUpdate` / `_mvtOnRefresh`,
   because `Container.prototype._onUpdate` is already Pixi's private transform
   callback.
2. Wraps five membership-changing methods on `Container.prototype`:
   `addChild`, `addChildAt`, `removeChild`, `removeChildren`, `destroy`.
   Everything else funnels through them. `addChildAt` needs its own detach
   notification because, unlike `addChild`, it splices a child out of its
   previous parent directly instead of calling `removeChild`.

Each container in a managed tree carries a reference to its scheduler, so a
mutation routes to exactly one scheduler without searching, and a container
detached mid-pass is skipped by a single identity check in the pass loop.

Monkey-patching the host framework is the genuinely invasive part of this
design. Its failure mode is silent staleness if a future Pixi version adds a
structural method that does not delegate to these five. The tests cover each
wrapped path, and two of them were checked to fail when the corresponding guard
is removed.

## Style notes

Two style-guide rules needed a deliberate decision here.

**`this`** is confined to `mvt-container-mixin.ts` and
`mvt-application-plugin.ts`. A prototype accessor and a wrapped prototype method
cannot reach their instance without it, and Pixi calls application plugin
`init` / `destroy` bound to the `Application`. Hooks themselves are invoked as
plain calls with no receiver, so a view's hook stays an ordinary closure. The
side effect is that a hook defined as a subclass prototype method would not see
its instance, which costs nothing here because the repo has no classes.

**`null`** appears nowhere in the spike's own surface. Hooks, ownership and
tombstoned slots are all `undefined`. `Container.parent` is typed
`Container | null` by Pixi, so the handful of places that read it use a
truthiness check rather than comparing against `null`.

## Open questions

- Should the wrappers be replaced by something less invasive? The event-based
  alternative (`childAdded` / `childRemoved`) is rejected here because catching
  every mutation needs a listener on every container, but it is worth revisiting
  if the wrapper set proves fragile across Pixi versions.
- Nested schedulers (creating a scheduler rooted inside another scheduler's
  tree) are unsupported. The ownership stamp is last-writer-wins.
- Direct mutation of `container.children` bypasses everything. Should that be
  detected in dev builds?
- Is `refresh` worth gating behind an opt-in per container after all? The demo
  makes the cost visible; nothing has been measured on a real game yet.
