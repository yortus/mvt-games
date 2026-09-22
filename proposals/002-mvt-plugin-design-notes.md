# Design notes

> How the two passes work, what was tried and rejected, and what has been
> measured. The product document is [README.md](../src/pixi-mvt/README.md); this page assumes
> you have read it. [the appraisal](./003-mvt-plugin-appraisal.md) is an independent review of
> whether this repo should adopt any of it, and
> [the rework plan](./001-mvt-plugin-rework-plan.md) is the plan this implementation follows.

**Written against Pixi 8.16.0.**

## The requirement

This is the whole thing. Everything else is implementation detail.

- There is a graph whose nodes are Pixi `Container`s.
- *Some* nodes carry hooks.
- `updateScene(N, dt)` / `refreshScene(N)` may be called on **any** node at
  **any** time, and must run every corresponding hook in N's subtree, each
  exactly once, with every node called before its descendants.

There is no privileged root, no host, no ownership and no session. The answer
for N is a pure function of N's subtree, so any cache has to be node-local and
valid for whichever caller asks.

Sibling order is deliberately unspecified. A view whose hook depends on a
sibling's hook is reading another view's output rather than reading state, which
is cross-talk the architecture already rules out. Ancestors are different: a
parent legitimately sets a transform, layout or visibility that children read.

## Per-node memoisation

### State

Two fields per hook kind, both pure memoisation - derivable, discardable, and
correct for any caller by construction:

```ts
_mvtHasUpdate?: boolean;   // does my subtree contain any onUpdate? undefined = dirty
_mvtUpdate?: SubtreeInfo;   // preorder update list plus a skip table for SKIP_DESCENDANTS
_mvtHasRefresh?: boolean;
_mvtRefresh?: SubtreeInfo;  // preorder refresh list plus the same skip table
```

The lists are only populated on containers that have actually been driven,
typically one or two per application. The booleans are computed on every
container visited by a rebuild, which is what makes later prunes a single field
read.

### Algorithms

Shown for update; refresh is the identical code with `pass = REFRESH` against
the other pair of fields - the two passes are one implementation.
See [scene-passes.ts](../src/pixi-mvt/scene-passes.ts).

```ts
export function updateScene(node: Container, deltaMs: number): void {
    let info = node._mvtUpdate;
    if (info === undefined) {
        info = buildSubtreeInfo(node, UPDATE);
        node._mvtUpdate = info;
    }
    invokeSubtreeMethods(info, node, UPDATE, deltaMs);
}

// Walk the memoised list, each container before its descendants. A method that
// returns SKIP_DESCENDANTS jumps past its whole subtree in one step (via the
// skip table), having already run itself.
function invokeSubtreeMethods(info: SubtreeInfo, node: Container, pass: Pass, deltaMs: number): void {
    const { list, skip } = info;
    for (let i = 0; i < list.length;) {
        const target = list[i];
        if (!target.parent && target !== node) { i = skip[i]; continue; } // detached mid-pass
        const result = pass === UPDATE ? target.onUpdate?.(deltaMs) : target.onRefresh?.();
        i = result === SKIP_DESCENDANTS ? skip[i] : i + 1;
    }
}

// Preorder list of hooked containers, plus a skip table: ends[i] is the list
// index just past container i's subtree. Preorder makes a subtree contiguous,
// so one number per entry is enough to jump over it.
function collectSubtreeMethods(node: Container, pass: Pass, out: Container[], ends: number[]): void {
    const hook = pass === UPDATE ? node.onUpdate : node.onRefresh;
    let selfIndex = -1;
    if (hook !== undefined) {
        selfIndex = out.length;
        out.push(node);
        ends.push(0); // overwritten once this subtree is fully collected
    }
    const ch = node.children;
    for (let i = 0; i < ch.length; i++) {
        if (has(ch[i], pass)) collectSubtreeMethods(ch[i], pass, out, ends); // prune hookless subtrees
    }
    if (selfIndex !== -1) ends[selfIndex] = out.length;
}

function has(node: Container, pass: Pass): boolean {
    const cached = pass === UPDATE ? node._mvtHasUpdate : node._mvtHasRefresh;
    if (cached !== undefined) return cached;
    let found = (pass === UPDATE ? node.onUpdate : node.onRefresh) !== undefined;
    const ch = node.children;
    for (let i = 0; i < ch.length; i++) {
        if (has(ch[i], pass)) found = true; // no early exit, deliberately
    }
    if (pass === UPDATE) node._mvtHasUpdate = found;
    else node._mvtHasRefresh = found;
    return found;
}
```

### Invalidation

One climb per hook kind, stopping at the first container already dirty for that
kind. It lives in [mvt-container-mixin.ts](../src/pixi-mvt/mvt-container-mixin.ts), next to the
setters and wrappers that trigger it:

```ts
function invalidateUpdate(node: Container): void {
    let cursor: Container | null = node;
    while (cursor) {
        if (cursor._mvtHasUpdate === undefined && cursor._mvtUpdate === undefined) return;
        cursor._mvtHasUpdate = undefined;
        cursor._mvtUpdate = undefined;
        cursor = cursor.parent;
    }
}
```

Triggered by:

- **Structural mutation** (`addChild`, `addChildAt`, `removeChild`,
  `removeChildren`, `destroy`): invalidate **both** kinds, from the affected
  parent.
- **Hook assignment** (the `onUpdate` / `onRefresh` setters): invalidate **that
  kind only**, from the container itself.

The short-circuit relies on a per-kind invariant - *a container dirty for kind K
implies all its ancestors are dirty for K* - which the climb maintains
inductively. After the first mutation of a frame the chain to the top is already
dirty, so every subsequent mutation short-circuits on its first comparison.
Trees that have never been driven are permanently dirty, so an application that
never calls either function pays one comparison per mutation. That is the
measured ~0% in the README's cost table.

### Properties that fall out

- **Attaching any subtree is O(depth), not O(subtree).** Nothing walks the
  attached subtree; only the ancestor chain is invalidated.
- **Reparenting N does not invalidate N's own cache.** N's subtree is unchanged,
  so its lists stay valid; only the old and new parents' chains go dirty.
- **No retention.** Every reference points into the container's own subtree, so
  the state dies with the container and there is nothing to tear down. There is
  no `destroy()` on the plugin because there is nothing to destroy.

### Two traps, both load-bearing

- `has` **must not early-exit** on the first hooked child.
  Visiting all children is what caches all of them, and that cache is what makes
  later prunes O(1). An early exit silently degrades the design to O(subtree).
- `invalidate` must clear **both** fields of its kind together. They are
  maintained in lockstep and the short-circuit condition tests both.

## What this replaced

The first implementation had a scheduler object that owned a tree: a
`createSceneScheduler(root)` factory, a `_mvtOwner` stamp on every container so
mutations could be routed to "the" scheduler, two interchangeable list
strategies with slot indices and tombstones, a drain-the-tail loop, and an
`Application` plugin exposing `app.scene`. Roughly 40% more code than what
replaced it, and wrong.

### The ownership bug

One privileged host owning a subtree is not just unnecessary, it breaks as soon
as a second caller appears. Verified against the old implementation:

```
stage > menu > button(onUpdate)

updateScene(stage) -> button owner = stage; stage list = [button]  -> button runs
updateScene(menu)  -> button owner = menu (stolen); menu list = [button] -> runs
updateScene(stage) -> stage's list is non-empty so it never rebuilds;
                      the owner guard rejects button forever -> button SILENTLY STOPS
```

The call count froze and never recovered across repeated calls. No error,
nothing to diagnose. The new design holds no such state, so this cannot occur;
the regression test for it is *stays correct when overlapping containers are
driven alternately* in [scene-passes.test.ts](../src/pixi-mvt/scene-passes.test.ts), which the
old design fails.

### The accessor-shadowing defect

The mixin used to install lazily, inside the scheduler factory. Any hook
assigned **before** that call created an own data property that permanently
shadowed the prototype accessor, so the setter never fired again for that
container and invalidation was silently lost:

```ts
parent.onRefresh = () => {};
parent.onRefresh = undefined;
const s = createSceneScheduler(root);          // mixin installs here
parent.onRefresh = () => order.push('parent'); // bypasses the accessor
s.refresh();                                   // never called
```

The mixin now installs at module load, so importing the plugin at all is the
only ordering requirement, and ES modules evaluate imports before the importing
module's own code. A dev-mode assertion during each rebuild catches an own hook
property however it arrived, since `Object.defineProperty` and a dynamically
imported plugin can both still produce one.

### No Application plugin

`installMvtScenePlugin`, `mvtScenePlugin`, the `PixiMixins.Application`
augmentation and `app.scene` are all gone. The plugin was not shorter for the
user:

```ts
// with plugin                        // without
installMvtScenePlugin();              const app = new Application();
const app = new Application();        await app.init({ ... });
await app.init({ ... });              app.ticker.add((t) => {
app.ticker.add((t) => {                   updateScene(app.stage, t.deltaMS);
    app.scene.update(t.deltaMS);          refreshScene(app.stage);
    app.scene.refresh();              });
});
```

Identical line count, and cutting it removes a land-grab on the very generic
`app.scene`, one of only two files needing `this`, and an "install before init"
footgun that was gotcha #1 in the old quick start.

## Settled decisions

**`onUpdate(deltaMs: number)`, never `onUpdate(ticker)`.** A `Ticker` carries
`lastTime`, `elapsedMS` and `FPS`, which is the wall clock that MVT rule 1
exists to keep out. It also makes synthetic stepping awkward (tests, thumbnails,
replays), invites views to pick a different time base from their models via
`ticker.speed`, and would give the core a hard dependency on Pixi's `Ticker`.

**Neither pass gates on visibility.** Both passes run every container in the
subtree, visible or not. `onUpdate` must never gate: presentation state that
stops advancing while hidden is stale when it reappears, and gating would make
state evolution a function of whether something was drawn. `onRefresh` could in
principle skip hidden subtrees - it is idempotent, so the next visible frame
recovers - but the earlier design that did this had to fold `localDisplayStatus`
as it walked, and forbade a view from clearing its own `visible` (a pruned
container drops out of its own walk and deadlocks), which in turn needed a
dev-mode `visible` setter guard to catch. Dropping the gate removed all of that:
the two passes are now the same walk, a view sets its own `visible` like any
other presentation output, and restating a hidden fact costs one method call
that assigns a value nobody draws.

**A method may return `SKIP_DESCENDANTS` to skip its subtree for a frame.** This
replaces visibility gating with an explicit, symmetric opt-in. The container has
already run when it returns the sentinel, so only its descendants are skipped -
in one step, through the skip table - and it can stop skipping on a later frame
with no deadlock. It is the mechanism a `<List>` slot uses to leave an empty
slot's subtree alone, and the mechanism a hidden branch uses to save the cost of
restating facts nobody will draw. In the update pass it freezes a subtree's
state advance, so there it is an opt-in for deliberately frozen subtrees (which
are then one frame stale on resume) rather than a routine tool. The container a
pass is driven from is never skipped by an outside caller.

**Re-entering a pass on the same container throws.** A hook that calls
`refreshScene` on the container already being refreshed would run the same list
twice and, in the usual case, recurse forever. Driving a *different* container
from a hook is legitimate and is how a view refreshes something it has just
built, so the guard is a small stack of the containers with a pass in flight
rather than a single flag. It is always on: one array push and pop per pass, not
per container.

## Accepted limitations

- **No drain-the-tail.** The old implementation re-ran hooks on containers
  attached during a pass, up to four rounds. It is gone, so a container created
  by a hook starts on the next pass and a spawning view has to give its children
  their first frame itself. The exact fix, if it is ever wanted, is a per-pass
  epoch stamped on each dispatched container, then a rebuild-and-dispatch for
  any entry whose epoch differs. That costs one integer write per hook per frame
  in the hot path, so it needs measuring against the numbers below.
- **Dense-plus-churning scenes are slower than a naive walk.** When every
  container is hooked and the tree is dirtied every frame, pruning prunes
  nothing and the list is rebuilt every frame, so caching is pure overhead:
  65 us against 37 us on 2000 hooked containers with 100 swaps per frame. Two
  fixes were tried during design and neither worked - dispatching during the
  rebuild was marginally *worse*, and reusing the array rather than allocating
  is noise, because building a 2000-entry list costs about the same either way.
  It is structural. The realistic shape is the opposite one, where the cache
  wins by 450x.
- **Direct `container.children` mutation bypasses everything.** Documented
  non-support.

## Benchmarks

### The harness this replaced was invalid

The old `vitest bench` file measured declaration order, not code:

|                            | rebuild declared first | incremental declared first |
| -------------------------- | ---------------------- | -------------------------- |
| first declared             | 109,415 hz             | 109,303 hz                 |
| second declared            | 40,887 hz              | 41,570 hz                  |

The winner is whoever runs first, to three significant figures. Every number
published from it was an artifact, and all of them have been deleted.

### The method now

[scripts/bench-scene-passes.ts](../scripts/bench-scene-passes.ts) spawns one
child process **per arm**, each running exactly one implementation against one
scenario, with the scenes and the measurement in
[scene-passes-benchmark.ts](../src/pixi-mvt/scene-passes-benchmark.ts). Results are
microseconds per frame - not hz - reported as the median of seven batches, each
batch sized from a warmup to run for about 100ms. One arm per process is also
what lets the `patched` and `unpatched` arms differ by whether the plugin was
ever imported.

### Results

`npm run bench`, Windows laptop, Node 22. A frame is one pass plus the
scenario's churn.

| Scenario                                        | naive walk  | memo        | note                        |
| ----------------------------------------------- | ----------- | ----------- | --------------------------- |
| sparse: 20k containers, 200 hooked, static       | 224 us      | **0.50 us** | the realistic shape         |
| dense: 2k containers, all hooked, static         | 10.4 us     | **4.5 us**  | nothing to prune            |
| churn: 2k all hooked, 100 swaps per frame        | **36.5 us** | 65.3 us     | the case the memo loses     |
| attach: 100 hookless 25-node subtrees re-attached| 45.5 us     | **9.8 us**  | O(depth), not O(subtree)    |

| Baseline                                        | incumbent   | this plugin |
| ----------------------------------------------- | ----------- | ----------- |
| dispatch: 2000 hooks, Pixi `onRender` vs pass    | 2.7 us      | 4.7 us      |
| mutation: 100 attach/detach on an unmanaged tree | 13.4 us     | 13.7 us     |

Notes on the two baselines, because both are adoption arguments rather than
performance ones:

- Pixi's `onRender` dispatch is a bare loop over an array calling a field. The
  pass loop adds a detachment check and reads the hook through an accessor,
  which is under a nanosecond per container. Reading the backing fields directly
  instead was tried and measured as noise, so the public property read stayed.
- The structural wrappers cost an unmanaged tree nothing measurable. Every
  mutation on a tree nothing drives hits the invalidation short-circuit on its
  first comparison.

Run-to-run variance on the naive arms is wide (the sparse naive arm has been
seen anywhere between 182 us and 246 us across runs), so treat single-digit
percentage differences as noise. The conclusions above survive it by one to three orders of
magnitude.

## Style notes

Two style-guide rules needed a deliberate decision.

**`this`** is confined to [mvt-container-mixin.ts](../src/pixi-mvt/mvt-container-mixin.ts). A
prototype accessor and a wrapped prototype method cannot reach their instance
without it. Hooks themselves are invoked as plain calls with no receiver, so a
view's hook stays an ordinary closure. The side effect is that a hook defined as
a subclass prototype method would not see its instance, which costs nothing here
because the repo has no classes.

**`null`** appears nowhere in the plugin's own surface: hooks and memo fields are
all `undefined`. `Container.parent` is typed `Container | null` by Pixi, so the
three places that read it use a truthiness check rather than comparing.

## Pixi 8.16 facts this relies on

Recorded so they are not re-derived. All checked against `node_modules`.

- `extensions.mixin(Container, src)` is `Object.defineProperties(Target.prototype,
  getOwnPropertyDescriptors(src))`, which preserves accessors.
- `PixiMixins.Container` is declared **non-generic** by every shipped mixin even
  though `Container.d.ts` references `PixiMixins.Container<C>`. This survives
  only because of `skipLibCheck: true`. The plugin copies the shipped pattern
  rather than "fixing" it.
- `Container.prototype._onUpdate` already exists as Pixi's private transform
  callback, so the backing fields are `_mvtOnUpdate` / `_mvtOnRefresh`.
- Structural methods needing wrappers: `addChild`, `addChildAt`, `removeChild`,
  `removeChildren`, `destroy`. Everything else delegates to these.
  `addChildAt` splices a child out of its previous parent **without** calling
  `removeChild`, so it needs its own handling. `destroy` delegates to
  `removeChildren` and `removeFromParent`, and is wrapped only to clear the
  hooks - a container driven directly has no parent to be detached from.
- Pure sibling reorders (`swapChildren`, `sortChildren`, `setChildIndex`,
  `addChild` of an already-parented child) need **no** wrapper, since sibling
  order carries no guarantee. This matters: Pixi calls `sortChildren` itself
  during rendering whenever `sortableChildren` is set.
- `runOnRender` is called unconditionally and is **never gated on visibility**.
  The workaround at [pause-menu-view.ts:33](../src/common/pause-menu-view.ts#L33)
  ("outer stays visible so onRender fires") was never needed.
- `cacheAsTexture` suppresses `onRender` for nested groups: `_updateRenderGroups`
  returns early when a cached group's texture is current.
- `getLocalBounds` is pull-based and recomputes at call time via
  `checkChildrenDidChange`, so measuring your own children inside a single
  refresh body is correct regardless of traversal order. Only measurement
  *across* views lags by a tick, and the fix there is for the view doing the
  measuring to own the thing being measured.

## Open questions

- Should the wrappers be replaced by something less invasive? The event-based
  alternative (`childAdded` / `childRemoved`) is rejected here because catching
  every mutation needs a listener on every container, but it is worth revisiting
  if the wrapper set proves fragile across Pixi versions. The failure mode is
  silent staleness if a future Pixi version adds a structural method that does
  not delegate to these five.
- Should direct `container.children` mutation be detected in dev builds?
- Is drain-the-tail worth adding back, now that the cost of it is a per-pass
  epoch rather than a scheduler-sized machine? Nothing in this repo spawns views
  during a refresh, so there is no evidence either way yet.
- Is `onRefresh` worth gating behind an opt-in per container after all? The demo
  makes the per-entity cost visible; nothing has been measured on a real game.
