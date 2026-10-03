# Design notes

> How `updateView` and `refreshView` work, what was tried and rejected, and
> what has been measured. The product document is [README.md](./README.md); this page assumes
> you have read it. [the appraisal](../../../notes/archive/003-mvt-plugin-appraisal.md) is an independent review of
> whether this repo should adopt any of it, and
> [the rework plan](../../../notes/archive/001-mvt-plugin-rework-plan.md) is the plan this implementation follows.

**Written against Pixi 8.16.0.**

**Where the code is now.** Since proposal
[022](../../../notes/proposals/022-renderer-agnostic-jsx.md) phase 2, the
method lists described here are generic over any tree, in
[tick-api/tick-api.ts](../../utils/src/tick-api/tick-api.ts) in `@mvtjs/utils`, which the
three.js and DOM renderers use too: each renderer registers its node
prototype with `registerRenderer`. @mvtjs/pixi keeps what is Pixi's: the
structural wrappers, the destroy warning, and that registration. Invoking a
method list now calls the methods cached in it rather than reading each
container's method, as
[012](../../../notes/proposals/012-falling-sand-performance-findings.md) section
2 proposed. Views set their methods with `setUpdate` and `setRefresh`, and
hosts call `updateView` and `refreshView`, one set of functions for every
renderer (proposal [031](../../../notes/archive/031-tick-api-in-mvt-terms.md));
before that it was `setTickMethods` and `tickScene`, one pair per renderer
(task 028), and before that `onUpdate` / `onRefresh` accessors on `Container`
(see "Methods are set with `setUpdate` and `setRefresh`" below). The design
below is unchanged by these moves. The code samples show the algorithm before
the method cache, simplified; in `tick-api/tick-api.ts`, `updateSubtree` and
`refreshSubtree` are what `updateView` and `refreshView` run for a
renderer.

## The requirement

This is the whole thing. Everything else is implementation detail.

- There is a graph whose nodes are Pixi `Container`s.
- *Some* nodes have an update or refresh method, set with `setUpdate` or
  `setRefresh`.
- `updateView(N, deltaMs)` and `refreshView(N)` may be called on **any** node
  at **any** time, and each must run every corresponding method in N's
  subtree, each exactly once, with every node called before its
  descendants.

There is no privileged root, no host, no ownership and no session. The answer
for N is a pure function of N's subtree, so any cache has to be node-local and
valid for whichever caller asks.

Sibling order is deliberately unspecified. A view whose method depends on a
sibling's method is reading another view's output rather than reading state, which
is cross-talk the architecture already rules out. Ancestors are different: a
parent legitimately sets a transform, layout or visibility that children read.

## Cached method lists, per node

### State

Two fields per method kind, both pure caches - derivable, discardable, and
correct for any caller by construction:

```ts
_mvtSubtreeHasUpdate?: boolean;       // does my subtree contain any update method? undefined = cleared
_mvtUpdateMethodList?: MethodList;    // preorder update method list plus a skip table for SKIP_DESCENDANTS
_mvtSubtreeHasRefresh?: boolean;
_mvtRefreshMethodList?: MethodList;   // preorder refresh method list plus the same skip table
```

The lists are only populated on containers that have actually been driven,
typically one or two per application. The booleans are computed on every
container visited by a rebuild, which is what makes later prunes a single field
read.

### Algorithms

Shown for update; refresh is the identical code with `kind = REFRESH` against
the other pair of fields - the two are one implementation.
See [tick-api/tick-api.ts](../../utils/src/tick-api/tick-api.ts) in `@mvtjs/utils`.

```ts
function updateSubtree(node: Container, deltaMs: number): void {
    let list = node._mvtUpdateMethodList;
    if (list === undefined) {
        list = buildMethodList(node, UPDATE);
        node._mvtUpdateMethodList = list;
    }
    invokeMethodList(list, node, UPDATE, deltaMs);
}

// Invoke the cached list, each container before its descendants. A method that
// returns SKIP_DESCENDANTS jumps past its whole subtree in one step (via the
// skip table), having already run itself.
function invokeMethodList(list: MethodList, node: Container, kind: MethodKind, deltaMs: number): void {
    const { nodes, skip } = list;
    for (let i = 0; i < nodes.length;) {
        const listed = nodes[i];
        if (!listed.parent && listed !== node) { i = skip[i]; continue; } // detached during the call
        const result = kind === UPDATE ? listed._mvtUpdateMethod?.(deltaMs) : listed._mvtRefreshMethod?.();
        i = result === SKIP_DESCENDANTS ? skip[i] : i + 1;
    }
}

// Preorder list of the containers that have this kind of method, plus a skip table: ends[i] is the list
// index just past container i's subtree. Preorder makes a subtree contiguous,
// so one number per entry is enough to jump over it.
function collectSubtreeMethods(node: Container, kind: MethodKind, out: Container[], ends: number[]): void {
    const method = kind === UPDATE ? node._mvtUpdateMethod : node._mvtRefreshMethod;
    let selfIndex = -1;
    if (method !== undefined) {
        selfIndex = out.length;
        out.push(node);
        ends.push(0); // overwritten once this subtree is fully collected
    }
    const ch = node.children;
    for (let i = 0; i < ch.length; i++) {
        if (has(ch[i], kind)) collectSubtreeMethods(ch[i], kind, out, ends); // skip subtrees with no method of this kind
    }
    if (selfIndex !== -1) ends[selfIndex] = out.length;
}

function has(node: Container, kind: MethodKind): boolean {
    const cached = kind === UPDATE ? node._mvtSubtreeHasUpdate : node._mvtSubtreeHasRefresh;
    if (cached !== undefined) return cached;
    let found = (kind === UPDATE ? node._mvtUpdateMethod : node._mvtRefreshMethod) !== undefined;
    const ch = node.children;
    for (let i = 0; i < ch.length; i++) {
        if (has(ch[i], kind)) found = true; // no early exit, deliberately
    }
    if (kind === UPDATE) node._mvtSubtreeHasUpdate = found;
    else node._mvtSubtreeHasRefresh = found;
    return found;
}
```

### Invalidation

One walk up the tree per method kind, stopping at the first container already
cleared for that kind. It lives in [tick-api/tick-api.ts](../../utils/src/tick-api/tick-api.ts)
in `@mvtjs/utils`, next to the setters that trigger it; @mvtjs/pixi's wrappers
in [container-mixin.ts](./container-mixin.ts) call it too, through the
`invalidate` that `registerRenderer` returns:

```ts
function invalidateUpdate(node: Container): void {
    let cursor: Container | null = node;
    while (cursor) {
        if (cursor._mvtSubtreeHasUpdate === undefined && cursor._mvtUpdateMethodList === undefined) return;
        cursor._mvtSubtreeHasUpdate = undefined;
        cursor._mvtUpdateMethodList = undefined;
        cursor = cursor.parent;
    }
}
```

Triggered by:

- **Structural mutation** (`addChild`, `addChildAt`, `removeChild`,
  `removeChildren`, `destroy`): invalidate **both** kinds, from the affected
  parent.
- **Method assignment** (`setUpdate`, `setRefresh`): invalidate **that kind
  only**, from the container itself.

The early stop relies on a per-kind invariant - *a container cleared for kind
K implies all its ancestors are cleared for K* - which the walk up maintains
inductively. After the first mutation of a frame the chain to the top is
already cleared, so every subsequent mutation stops on its first comparison.
Trees that have never been driven stay cleared, so an application that never
calls either function pays one comparison per mutation. That is the
measured ~0% in the README's cost table.

### Properties that fall out

- **Attaching any subtree is O(depth), not O(subtree).** Nothing walks the
  attached subtree; only the ancestor chain is invalidated.
- **Reparenting N does not invalidate N's own cache.** N's subtree is unchanged,
  so its lists stay valid; only the old and new parents' chains go dirty.
- **No retention.** Every reference points into the container's own subtree, so
  the state dies with the container and there is nothing to tear down. There is
  no `destroy()` in @mvtjs/pixi because there is nothing to destroy.

### Two traps, both load-bearing

- `has` **must not early-exit** on the first child found to have the method.
  Visiting all children is what caches all of them, and that cache is what makes
  later prunes O(1). An early exit silently degrades the design to O(subtree).
- `invalidate` must clear **both** fields of its kind together. They are
  maintained in lockstep and the early-stop condition tests both.

## What this replaced

The first implementation had a scheduler object that owned a tree: a
`createSceneScheduler(root)` factory, a `_mvtOwner` stamp on every container so
mutations could be routed to "the" scheduler, two interchangeable list
strategies with slot indices and tombstones, a drain-the-tail loop, and an
`Application` plugin exposing `app.scene`. Roughly 40% more code than what
replaced it, and wrong.

### The ownership bug

One privileged host owning a subtree is not just unnecessary, it breaks as soon
as a second caller appears. Verified against the old implementation, with the
names of the time:

```
stage > menu > button(onUpdate)

updateScene(stage) -> button owner = stage; stage list = [button]  -> button runs
updateScene(menu)  -> button owner = menu (stolen); menu list = [button] -> runs
updateScene(stage) -> stage's list is non-empty so it never rebuilds;
                      the owner guard rejects button forever -> button SILENTLY STOPS
```

The call count froze and never recovered across repeated calls. No error,
nothing to diagnose. The new design holds no such state, so this cannot occur;
the regression test for it is *stays correct when calls alternate between
overlapping containers* in
[container-mixin.test.ts](./container-mixin.test.ts), which the old
design fails.

### The accessor-shadowing defect

The mixin used to install lazily, inside the scheduler factory. Any method
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

The mixin then moved to module load, so importing @mvtjs/pixi at all is the
only ordering requirement, and ES modules evaluate imports before the importing
module's own code. A dev-mode assertion during each rebuild caught an own method
property however it arrived, since `Object.defineProperty` and a dynamic
import of @mvtjs/pixi could both still produce one. Since task 028 there are no
accessors to shadow: methods are set only through functions (now `setUpdate`
and `setRefresh`), which write the private fields themselves, so the defect
and its assertion are both gone.

### No Application plugin

`installMvtScenePlugin`, `mvtScenePlugin`, the `PixiMixins.Application`
augmentation and `app.scene` are all gone. The Application plugin was not
shorter for the user:

```ts
// with the Application plugin        // without
installMvtScenePlugin();              const app = new Application();
const app = new Application();        await app.init({ ... });
await app.init({ ... });              app.ticker.add((t) => {
app.ticker.add((t) => {                   updateView(app.stage, t.deltaMS);
    app.scene.update(t.deltaMS);          refreshView(app.stage);
    app.scene.refresh();              });
});
```

No longer to write without it, and cutting it removes a land-grab on the very generic
`app.scene`, one of only two files needing `this`, and an "install before init"
footgun that was gotcha #1 in the old quick start.

## Settled decisions

**An update method takes `deltaMs: number`, never a `Ticker`.** A `Ticker` carries
`lastTime`, `elapsedMS` and `FPS`, which is the wall clock that MVT rule 1
exists to keep out. It also makes synthetic stepping awkward (tests, thumbnails,
replays), invites views to pick a different time base from their models via
`ticker.speed`, and would give the core a hard dependency on Pixi's `Ticker`.

**Neither `updateView` nor `refreshView` gates on visibility.** Both run every
container in the subtree, visible or not. `updateView` must never gate:
presentation state that stops advancing while hidden is stale when it
reappears, and gating would make state evolution a function of whether
something was drawn. `refreshView` could in principle skip hidden subtrees -
it is idempotent, so the next visible frame recovers - but the earlier design
that did this had to fold `localDisplayStatus` as it walked, and forbade a
view from clearing its own `visible` (a pruned container drops out of its own
method list and deadlocks), which in turn needed a dev-mode `visible` setter
guard to catch. Dropping the gate removed all of that: the two are now one
implementation, a view sets its own `visible` like any other presentation
output, and restating a hidden fact costs one method call that assigns a
value nobody draws.

**A method may return `SKIP_DESCENDANTS` to skip its subtree for a frame.** This
replaces visibility gating with an explicit, symmetric opt-in. The container has
already run when it returns the sentinel, so only its descendants are skipped -
in one step, through the skip table - and it can stop skipping on a later frame
with no deadlock. It is the mechanism a `<List>` slot uses to leave an empty
slot's subtree alone, and the mechanism a hidden branch uses to save the cost of
restating facts nobody will draw. In `updateView` it freezes a subtree's
state advance, so there it is an opt-in for deliberately frozen subtrees
(which are then one frame stale on resume) rather than a routine tool; the
host's pause gate is one. The container a call starts from is never skipped
by an outside caller.

**Calling `updateView` or `refreshView` on a container it is already inside
throws.** A method that refreshes the container already being refreshed would
invoke the same list twice and, in the usual case, recurse forever.
Refreshing a *different* container from a method is legitimate (a nested
`refreshView` shares its outer one, so nothing runs twice), so the guard is a
small stack of the containers with a call in flight rather than a single
flag. It is always on: one array push and pop per call, not per container.

**`refreshView` refreshes what its methods add; `updateView` does not update
what its methods add.** `refreshView` covers the subtree as it stands when it
returns, not only as it stood when it started.
Without this, a view that builds children in its own refresh method shows
them unrefreshed for a frame: invisible in a running game, but the only frame
there is in a thumbnail or a refresh-once test. That is how Kwazy Cactii's
carousel thumbnail went blank. Its pieces view rebuilt its grid on the first
poll of a `watch()`, which reports every value changed, exactly as the
change-detection guide's own example does. `<List>` and `<Switch>` used to
refresh what they built by hand; they now rely on `refreshView`.

How it stays off the hot path:

- Invoking a refresh method list records only what it **elides**: an entry
  detached before its turn (the entry and its descendants), an entry whose
  method was cleared earlier in the call (the entry), and an entry that
  returned `SKIP_DESCENDANTS` (its descendants). Each elision goes in an
  `Int32Array` beside the list (`MethodList.elisions`), tagged with the
  refresh's id. An entry run and stepped past records nothing, so the common
  path has no store at all. A first version marked every entry it ran, and
  measured 20% slower on the dense scene; recording only the elisions measured
  as noise.
- After the invocation, one read of the root's cached list says whether any
  method changed the subtree: every structural change and method assignment
  clears it, since the whole subtree was clean when the call began.
  @mvtjs/html hears of changes only when it asks, so its `flushChanges` is
  called again first.
- Only then (`catchUpRefresh`) does it replay the invocation from its
  elisions, marking each node that ran (`_mvtLastRefreshId`), rebuild the
  list, and invoke it running only the nodes it missed, skipping any subtree
  whose root returned `SKIP_DESCENDANTS` in this call. It repeats until a
  round changes nothing, and throws after 100 rounds, which only methods
  adding nodes that add nodes without end reach.
- The rebuilt list is the one the next frame would have rebuilt anyway, so a
  frame that changes the tree during `refreshView` pays one replay and one
  short invocation. The pool benchmark, which attaches containers during
  every refresh, measured the same before and after.
- Nested refreshes share their outermost one's id and hand their invoked
  lists to it, so a container a nested `refreshView` refreshed is not
  refreshed again.

`updateView` does not do the same, on purpose. Each covers what its methods
need: `refreshView` covers the tree as it stands when the call ends, since a
refresh method is idempotent and what matters is that everything drawn is
current; `updateView` covers the time step for the containers that existed
when the call began, since an update method advances time and a container
created during the call did not exist for that time. The same frame's
`refreshView` does see it.

Catching up in `updateView` too was considered and rejected:

- **It would break update's one rule.** Today a container's first update is
  the first `updateView` that begins after it exists, however it was created.
  Catching up would give this frame's `deltaMs` only to containers created
  during `updateView`, a special case.
- **It would advance new containers twice.** A spawner seeds its child from
  its own already-advanced state (a particle at the emitter's position);
  advancing the child by the same `deltaMs` puts it a frame ahead.
- **It fixes nothing visible.** The refresh catch-up already draws a new
  container correctly on its first frame.
- **It would not remove the hazard that motivates it.** A view whose
  refresh method reads state its update method computes would refresh from
  uninitialised state if created mid-update. But views are mostly created
  during refresh, where no update catch-up can help. Catching up with a
  `deltaMs` of 0 has the same gap and adds a contract to every update method.

The rule that removes the hazard is for views, not for `updateView`: a view's
first refresh must not depend on its update method having run, so presentation
state starts valid at construction. The presentation-state guide and the
mvt-view skill say so.

**Methods are set with `setUpdate` and `setRefresh`, views are updated and
refreshed with `updateView` and `refreshView`, and the fields stay named.**
Views and library code alike set a node's methods with the two setters, and
hosts call `updateView` and then `refreshView`. There is no second way: the
`onUpdate` / `onRefresh` accessors are gone
([proposal 027](../../../notes/archive/027-mvt-method-names.md), task 028),
and so is the per-renderer `setTickMethods` / `tickScene` pair that followed
them ([031](../../../notes/archive/031-tick-api-in-mvt-terms.md)). Nothing
is added to a node's public surface. Each renderer registers its node
prototype with `registerRenderer`, which puts the fields' defaults on it,
including `_mvtRenderer`: that renderer's `updateView` and `refreshView`, and
its walks up the tree. So the shared functions find a node's renderer in one
prototype read, and the setters clear the method lists above a node of any
renderer. They are typed to `View`, the union of the view types the installed
renderers declare in `RendererViews`, so passing anything else is a type
error; inside `@mvtjs/utils`, which installs no renderer, the library's own
code uses untyped versions. The fields stay named `_mvt*` properties of the
node. One record object per node, a `WeakMap`, and
symbol-keyed fields were each measured, and each was slower or larger
(027 section 11.8).

**A method that declares a parameter wraps the one it replaces; there are no
getters.** `setRefresh(node, (own) => ...)` is given the node's current
refresh method, or `undefined`, and may call it; an update method does the
same with a second parameter, after `deltaMs`. The wrapper is bound to the
method it replaces once, when it is set, so every method is called the same
way, and a method that does not wrap costs nothing extra. The parameter
is found by the method's declared `length`, so a default-valued or rest
parameter does not count. `<List>`, `<Switch>` and the JSX `onRefresh`
attribute compose this way, so nothing hands out a node's method, which
would be a way to call a view's step by hand; `hasUpdate` / `hasRefresh`
answer whether a node has one. `refreshView` calls methods with `undefined`
rather than a placeholder `deltaMs`, so a refresh method with a
default-valued parameter sees its default.

## Accepted limitations

- **Dense-plus-churning scenes are slower than a naive walk.** When every
  container has a refresh method and the tree is dirtied every frame, pruning prunes
  nothing and the list is rebuilt every frame, so caching is pure overhead:
  127 us against 29 us on 2000 containers, all with a refresh method, and 100 swaps per frame
  (2026-10-02; 65 us against 37 us when first measured, on Node 22). Two
  fixes were tried during design and neither worked - dispatching during the
  rebuild was marginally *worse*, and reusing the array rather than allocating
  is noise, because building a 2000-entry list costs about the same either way.
  It is structural. The realistic shape is the opposite one, where the cache
  wins by over 300x.
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

The benchmark driver spawns one child process **per arm**, each running exactly
one implementation against one scenario. The scenes are now the `refresh-view`
suite in [benchmarks/](../../../benchmarks/README.md)
(`benchmarks/suites/refresh-view.case.ts`), run with
`npm run bench -- refresh-view`; they were first written as
`src/pixi-mvt/scene-passes-benchmark.ts` with a driver in `scripts/`, before
the libraries became packages. Results
are microseconds per frame - not hz - reported as the median of a set of
batches, each batch sized from a warmup. One arm per process is also
what lets the `patched` and `unpatched` arms differ by whether @mvtjs/pixi was
ever imported.

### Results

Measured with the original driver, which timed under `tsx`, on a Windows
laptop with Node 22. A frame is one refresh of the whole tree plus the
scenario's churn. Current numbers, from the consolidated suite, are in the @mvtjs/pixi
README and the docs' Performance Measurements page.

| Scenario                                        | naive walk  | cached list | note                        |
| ----------------------------------------------- | ----------- | ----------- | --------------------------- |
| sparse: 20k containers, 200 with a refresh method, static | 224 us      | **0.50 us** | the realistic shape         |
| dense: 2k containers, all with a refresh method, static   | 10.4 us     | **4.5 us**  | nothing to prune            |
| churn: 2k, all with a refresh method, 100 swaps per frame | **36.5 us** | 65.3 us     | the case the cache loses    |
| attach: 100 subtrees of 25 nodes with no refresh method, re-attached | 45.5 us     | **9.8 us**  | O(depth), not O(subtree)    |

| Baseline                                        | incumbent   | @mvtjs/pixi    |
| ----------------------------------------------- | ----------- | ----------- |
| dispatch: 2000 methods, Pixi `onRender` vs `refreshView` | 2.7 us      | 4.7 us      |
| mutation: 100 attach/detach on an unmanaged tree | 13.4 us     | 13.7 us     |

Notes on the two baselines, because both are adoption arguments rather than
performance ones:

- Pixi's `onRender` dispatch is a bare loop over an array calling a field. The
  method list loop added a detachment check and read the method through an
  accessor, which is under a nanosecond per container. Reading the backing
  fields directly instead was tried and measured as noise, so the public
  property read stayed at the time. The loop now calls methods cached in the
  method list (012 section 2), and there are no accessors.
- The structural wrappers cost an unmanaged tree nothing measurable. Every
  mutation on a tree nothing drives hits the invalidation's early stop on its
  first comparison.

Run-to-run variance on the naive arms is wide (the sparse naive arm has been
seen anywhere between 182 us and 246 us across runs), so treat single-digit
percentage differences as noise. The conclusions above survive it by one to three orders of
magnitude.

## Style notes

Two style-guide rules needed a deliberate decision.

**`this`** is confined to the wrapped prototype methods, in
[container-mixin.ts](./container-mixin.ts) (and @mvtjs/three's equivalent). A
wrapped prototype method cannot reach its instance without it. Methods themselves are invoked as plain calls with no receiver, so a
view's method stays an ordinary closure. The side effect is that a method defined as
a subclass prototype method would not see its instance, which costs nothing here
because the repo has no classes.

**`null`** appears nowhere in @mvtjs/pixi's own surface: methods and cached-list fields are
all `undefined`. `Container.parent` is typed `Container | null` by Pixi, so the
three places that read it use a truthiness check rather than comparing.

## Pixi 8.16 facts this relies on

Recorded so they are not re-derived. All checked against `node_modules`.

- `extensions.mixin(Container, src)` is `Object.defineProperties(Target.prototype,
  getOwnPropertyDescriptors(src))`, which preserves accessors. @mvtjs/pixi used it
  for the `onUpdate` / `onRefresh` accessors; it now adds only private field
  defaults, with `Object.defineProperties` itself, and declares nothing on
  `PixiMixins.Container`.
- `Container.prototype._onUpdate` already exists as Pixi's private transform
  callback, so the backing fields are `_mvtUpdateMethod` / `_mvtRefreshMethod`.
- Structural methods needing wrappers: `addChild`, `addChildAt`, `removeChild`,
  `removeChildren`, `destroy`. Everything else delegates to these.
  `addChildAt` splices a child out of its previous parent **without** calling
  `removeChild`, so it needs its own handling. `destroy` delegates to
  `removeChildren` and `removeFromParent`, and is wrapped to clear the
  methods - a container driven directly has no parent to be detached from.
  In dev builds the wrapper also warns when a destroy without
  `{ children: true }` detaches a descendant that has a `'destroyed'`
  listener, since that listener will never run.
- `Container.destroy` emits `'destroyed'`, passing the container, after it
  detaches the children and before it destroys them. Pixi 8.16 adds no
  `'destroyed'` listeners of its own, so any the warning finds are ours.
- Pure sibling reorders (`swapChildren`, `sortChildren`, `setChildIndex`,
  `addChild` of an already-parented child) need **no** wrapper, since sibling
  order carries no guarantee. This matters: Pixi calls `sortChildren` itself
  during rendering whenever `sortableChildren` is set.
- `runOnRender` is called unconditionally and is **never gated on visibility**.
  The workaround at [pause-menu-view.ts:33](../../../site/src/shared/pause-menu-view.ts#L33)
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
- Is a refresh method worth gating behind an opt-in per container after all? The old spike demo
  made the per-entity cost visible; nothing has been measured on a real game.
