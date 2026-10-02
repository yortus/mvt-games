# Design notes

> How the two scene passes work, what was tried and rejected, and what has been
> measured. The product document is [README.md](./README.md); this page assumes
> you have read it. [the appraisal](../../notes/archive/003-mvt-plugin-appraisal.md) is an independent review of
> whether this repo should adopt any of it, and
> [the rework plan](../../notes/archive/001-mvt-plugin-rework-plan.md) is the plan this implementation follows.

**Written against Pixi 8.16.0.**

**Where the code is now.** Since proposal
[022](../../notes/proposals/022-renderer-agnostic-jsx.md) phase 2, the walk
described here is generic over any tree, in
[src/mvt-utils/scene-passes.ts](../mvt-utils/scene-passes.ts)
(`createScenePasses`), which the three.js and DOM scene passes use too.
pixi-mvt keeps what is Pixi's: the structural wrappers, the destroy warning,
and `tickScene` / `setTickMethods` typed to containers. The walk also now
calls methods cached in the memoised list rather than reading each
container's method, as
[012](../../notes/proposals/012-falling-sand-performance-findings.md) section
2 proposed. Since task 028, views set their methods with `setTickMethods` and
hosts run both scene passes with `tickScene`; the `onUpdate` / `onRefresh`
accessors on `Container` are gone (see "Methods are set with
`setTickMethods`" below). The design below is unchanged by these moves. The
code samples show the walk before the method cache, with the names it has
inside `scene-passes.ts`, where `updateScene` and `refreshScene` are the
private functions `tickScene` runs.

## The requirement

This is the whole thing. Everything else is implementation detail.

- There is a graph whose nodes are Pixi `Container`s.
- *Some* nodes have an update or refresh method, set with `setTickMethods`.
- `tickScene({ root: N, deltaMs })` may be called on **any** node at **any**
  time, and each of its two scene passes must run every corresponding method
  in N's subtree, each exactly once, with every node called before its
  descendants.

There is no privileged root, no host, no ownership and no session. The answer
for N is a pure function of N's subtree, so any cache has to be node-local and
valid for whichever caller asks.

Sibling order is deliberately unspecified. A view whose method depends on a
sibling's method is reading another view's output rather than reading state, which
is cross-talk the architecture already rules out. Ancestors are different: a
parent legitimately sets a transform, layout or visibility that children read.

## Per-node memoisation

### State

Two fields per method kind, both pure memoisation - derivable, discardable, and
correct for any caller by construction:

```ts
_mvtSubtreeHasUpdate?: boolean;   // does my subtree contain any update method? undefined = dirty
_mvtUpdateWalk?: SubtreeWalk;   // preorder update list plus a skip table for SKIP_DESCENDANTS
_mvtSubtreeHasRefresh?: boolean;
_mvtRefreshWalk?: SubtreeWalk;  // preorder refresh list plus the same skip table
```

The lists are only populated on containers that have actually been driven,
typically one or two per application. The booleans are computed on every
container visited by a rebuild, which is what makes later prunes a single field
read.

### Algorithms

Shown for update; refresh is the identical code with `pass = REFRESH` against
the other pair of fields - the two scene passes are one implementation.
See [scene-passes.ts](../mvt-utils/scene-passes.ts) in `mvt-utils`.

```ts
export function updateScene(node: Container, deltaMs: number): void {
    let info = node._mvtUpdateWalk;
    if (info === undefined) {
        info = buildSubtreeWalk(node, UPDATE);
        node._mvtUpdateWalk = info;
    }
    invokeSubtreeMethods(info, node, UPDATE, deltaMs);
}

// Walk the memoised list, each container before its descendants. A method that
// returns SKIP_DESCENDANTS jumps past its whole subtree in one step (via the
// skip table), having already run itself.
function invokeSubtreeMethods(info: SubtreeWalk, node: Container, pass: Pass, deltaMs: number): void {
    const { list, skip } = info;
    for (let i = 0; i < list.length;) {
        const listed = list[i];
        if (!listed.parent && listed !== node) { i = skip[i]; continue; } // detached during the scene pass
        const result = pass === UPDATE ? listed._mvtUpdateMethod?.(deltaMs) : listed._mvtRefreshMethod?.();
        i = result === SKIP_DESCENDANTS ? skip[i] : i + 1;
    }
}

// Preorder list of the containers that have this scene pass's method, plus a skip table: ends[i] is the list
// index just past container i's subtree. Preorder makes a subtree contiguous,
// so one number per entry is enough to jump over it.
function collectSubtreeMethods(node: Container, pass: Pass, out: Container[], ends: number[]): void {
    const method = pass === UPDATE ? node._mvtUpdateMethod : node._mvtRefreshMethod;
    let selfIndex = -1;
    if (method !== undefined) {
        selfIndex = out.length;
        out.push(node);
        ends.push(0); // overwritten once this subtree is fully collected
    }
    const ch = node.children;
    for (let i = 0; i < ch.length; i++) {
        if (has(ch[i], pass)) collectSubtreeMethods(ch[i], pass, out, ends); // skip subtrees with no method for this scene pass
    }
    if (selfIndex !== -1) ends[selfIndex] = out.length;
}

function has(node: Container, pass: Pass): boolean {
    const cached = pass === UPDATE ? node._mvtSubtreeHasUpdate : node._mvtSubtreeHasRefresh;
    if (cached !== undefined) return cached;
    let found = (pass === UPDATE ? node._mvtUpdateMethod : node._mvtRefreshMethod) !== undefined;
    const ch = node.children;
    for (let i = 0; i < ch.length; i++) {
        if (has(ch[i], pass)) found = true; // no early exit, deliberately
    }
    if (pass === UPDATE) node._mvtSubtreeHasUpdate = found;
    else node._mvtSubtreeHasRefresh = found;
    return found;
}
```

### Invalidation

One climb per method kind, stopping at the first container already dirty for that
kind. It lives in [scene-passes.ts](../mvt-utils/scene-passes.ts) in
`mvt-utils`, next to the setters that trigger it; pixi-mvt's wrappers in
[container-mixin.ts](./container-mixin.ts) call it too:

```ts
function invalidateUpdate(node: Container): void {
    let cursor: Container | null = node;
    while (cursor) {
        if (cursor._mvtSubtreeHasUpdate === undefined && cursor._mvtUpdateWalk === undefined) return;
        cursor._mvtSubtreeHasUpdate = undefined;
        cursor._mvtUpdateWalk = undefined;
        cursor = cursor.parent;
    }
}
```

Triggered by:

- **Structural mutation** (`addChild`, `addChildAt`, `removeChild`,
  `removeChildren`, `destroy`): invalidate **both** kinds, from the affected
  parent.
- **Method assignment** (`setTickMethods`): invalidate **that kind only**, from
  the container itself.

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
  no `destroy()` in pixi-mvt because there is nothing to destroy.

### Two traps, both load-bearing

- `has` **must not early-exit** on the first child found to have the method.
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
the regression test for it is *stays correct when scene passes alternate
between overlapping containers* in
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

The mixin then moved to module load, so importing pixi-mvt at all is the
only ordering requirement, and ES modules evaluate imports before the importing
module's own code. A dev-mode assertion during each rebuild caught an own method
property however it arrived, since `Object.defineProperty` and a dynamic
import of pixi-mvt could both still produce one. Since task 028 there are no
accessors to shadow: methods are set only through `setTickMethods`, which
writes the private fields itself, so the defect and its assertion are both
gone.

### No Application plugin

`installMvtScenePlugin`, `mvtScenePlugin`, the `PixiMixins.Application`
augmentation and `app.scene` are all gone. The Application plugin was not
shorter for the user:

```ts
// with the Application plugin        // without
installMvtScenePlugin();              const app = new Application();
const app = new Application();        await app.init({ ... });
await app.init({ ... });              app.ticker.add((t) => {
app.ticker.add((t) => {                   tickScene({ root: app.stage, deltaMs: t.deltaMS });
    app.scene.update(t.deltaMS);      });
    app.scene.refresh();
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

**Neither scene pass gates on visibility.** Both scene passes run every
container in the subtree, visible or not. The update scene pass must never
gate: presentation state that stops advancing while hidden is stale when it
reappears, and gating would make state evolution a function of whether
something was drawn. The refresh scene pass could in principle skip hidden
subtrees - it is idempotent, so the next visible frame
recovers - but the earlier design that did this had to fold `localDisplayStatus`
as it walked, and forbade a view from clearing its own `visible` (a pruned
container drops out of its own walk and deadlocks), which in turn needed a
dev-mode `visible` setter guard to catch. Dropping the gate removed all of that:
the two scene passes are now the same walk, a view sets its own `visible` like any
other presentation output, and restating a hidden fact costs one method call
that assigns a value nobody draws.

**A method may return `SKIP_DESCENDANTS` to skip its subtree for a frame.** This
replaces visibility gating with an explicit, symmetric opt-in. The container has
already run when it returns the sentinel, so only its descendants are skipped -
in one step, through the skip table - and it can stop skipping on a later frame
with no deadlock. It is the mechanism a `<List>` slot uses to leave an empty
slot's subtree alone, and the mechanism a hidden branch uses to save the cost of
restating facts nobody will draw. In the update scene pass it freezes a
subtree's state advance, so there it is an opt-in for deliberately frozen
subtrees (which are then one frame stale on resume) rather than a routine tool;
the host's pause gate is one. The root a tick starts from is never skipped by
an outside caller.

**Re-entering a scene pass on the same container throws.** A method that ticks
the container already being refreshed would run the same list twice and, in
the usual case, recurse forever. Ticking a *different* container from a method
is legitimate (a nested refresh scene pass shares its outer one, so nothing
runs twice), so the guard is a small stack of the containers with a scene pass
in flight rather than a single flag. It is always on: one array push and pop
per scene pass, not per container.

**The refresh scene pass refreshes what its methods add; the update scene pass
does not update what its methods add.** A refresh scene pass covers the
subtree as it stands when it returns, not only as it stood when it started.
Without this, a view that builds children in its own refresh method shows
them unrefreshed for a frame: invisible in a running game, but the only frame
there is in a thumbnail or a refresh-once test. That is how Kwazy Cactii's
carousel thumbnail went blank. Its pieces view rebuilt its grid on the first
poll of a `watch()`, which reports every value changed, exactly as the
change-detection guide's own example does. `<List>` and `<Switch>` used to
refresh what they built by hand; they now rely on the refresh scene pass.

How it stays off the hot path:

- The walk records only what it **elides**: an entry detached before its turn
  (the entry and its descendants), an entry whose method was cleared earlier
  in the scene pass (the entry), and an entry that returned `SKIP_DESCENDANTS`
  (its descendants). Each elision goes in an `Int32Array` beside the list
  (`SubtreeWalk.elisions`), tagged with the scene pass's id. An entry run and
  stepped past records nothing, so the common path has no store at all. A
  first version marked every entry it ran, and measured 20% slower on the
  dense scene; recording only the elisions measured as noise.
- After the walk, one read of the root's memo says whether any method changed
  the subtree: every structural change and method assignment clears it, since
  the whole subtree was clean when the walk began. html-mvt hears of changes
  only when it asks, so `beforeScenePass` is called again first.
- Only then (`catchUpRefresh`) does it replay the walk from its elisions,
  marking each node that ran (`_mvtLastRefreshPass`), rebuild the list, and
  walk it running only the nodes it missed, skipping any subtree whose root
  returned `SKIP_DESCENDANTS` this scene pass. It repeats until a round changes nothing, and throws after 100
  rounds, which only methods adding nodes that add nodes without end reach.
- The rebuilt list is the memo the next frame would have rebuilt anyway, so a
  frame that changes the tree during a scene pass pays one replay and one short walk. The
  pool benchmark, which attaches containers during every refresh, measured the
  same before and after.
- Nested refresh scene passes share their outermost one's id and hand their
  walks to it, so a container a nested scene pass refreshed is not refreshed
  again.

The update scene pass does not do the same, on purpose. Each scene pass covers
what its method needs: refresh covers the tree as it stands when the scene pass
ends, since a refresh method is idempotent and what matters is that everything
drawn is current; update covers the time step for the containers that existed
when the scene pass began, since an update method advances time and a
container created during the scene pass did not exist for that time. The same
frame's refresh scene pass does see it.

Catching up the update scene pass too was considered and rejected:

- **It would break update's one rule.** Today a container's first update is
  the first update scene pass that begins after it exists, however it was
  created. Catching up would give this frame's `deltaMs` only to containers
  created during an update scene pass, a special case.
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

The rule that removes the hazard is for views, not the scene passes: a view's
first refresh must not depend on its update method having run, so presentation
state starts valid at construction. The presentation-state guide and the
mvt-view skill say so.

**Methods are set with `setTickMethods`, scenes are ticked with `tickScene`,
and the fields stay named.** Views and library code alike set a node's
methods with `setTickMethods(node, { update, refresh })`, and hosts run both
scene passes with `tickScene`. There is no second way: the `onUpdate` /
`onRefresh` accessors are gone, and the setters and scene passes underneath
are private to `scene-passes.ts`
([proposal 027](../../notes/archive/027-mvt-method-names.md), task 028).
Nothing is added to a node's public surface. Each renderer's prototype
carries the fields' defaults, including `_mvtInvalidators`, the invalidation
climbs of that renderer's scene passes, so `setTickMethods` works on any
renderer's nodes with no dispatch; a plain-object node is given them when a
walk first visits it. Views take both functions from their renderer
(`pixi-mvt`, `three-mvt`, `html-mvt`), which exports them typed to its own
node, so passing anything else is a type error; `mvt-utils` keeps an untyped
`setTickMethods` for the library's own code. The fields stay named `_mvt*`
properties of the node. One record object per node, a `WeakMap`, and
symbol-keyed fields were each measured, and each was slower or larger
(027 section 11.8).

**A method that declares a parameter wraps the one it replaces; there are no
getters.** `setTickMethods(node, { refresh: (own) => ... })` is given the
node's current refresh method, or `undefined`, and may call it; an update
method does the same with a second parameter, after `deltaMs`. The wrapper is bound to the method
it replaces once, when it is set, so the scene passes call every method the
same way, and a method that does not wrap costs nothing extra. The parameter
is found by the method's declared `length`, so a default-valued or rest
parameter does not count. `<List>`, `<Switch>` and the JSX `onRefresh`
attribute compose this way, so nothing hands out a node's method, which
would be a way to call a view's step by hand; `hasUpdate` / `hasRefresh`
answer whether a node has one. The refresh scene pass calls methods with
`undefined` rather than a placeholder `deltaMs`, so a refresh method with a
default-valued parameter sees its default.

## Accepted limitations

- **Dense-plus-churning scenes are slower than a naive walk.** When every
  container has a refresh method and the tree is dirtied every frame, pruning prunes
  nothing and the list is rebuilt every frame, so caching is pure overhead:
  65 us against 37 us on 2000 containers, all with a refresh method, and 100 swaps per frame. Two
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

The benchmark driver spawns one child process **per arm**, each running exactly
one implementation against one scenario. The scenes are now the `scene-passes`
suite in [benchmarks/](../../benchmarks/README.md)
(`benchmarks/suites/scene-passes.case.ts`), run with
`npm run bench -- scene-passes`; they were first written as
`src/pixi-mvt/scene-passes-benchmark.ts` with a driver in `scripts/`. Results
are microseconds per frame - not hz - reported as the median of a set of
batches, each batch sized from a warmup. One arm per process is also
what lets the `patched` and `unpatched` arms differ by whether pixi-mvt was
ever imported.

### Results

Measured with the original driver, which timed under `tsx`, on a Windows
laptop with Node 22. A frame is one refresh scene pass plus the scenario's
churn. Current numbers, from the consolidated suite, are in the pixi-mvt
README and the docs' Performance Measurements page.

| Scenario                                        | naive walk  | memo        | note                        |
| ----------------------------------------------- | ----------- | ----------- | --------------------------- |
| sparse: 20k containers, 200 with a refresh method, static | 224 us      | **0.50 us** | the realistic shape         |
| dense: 2k containers, all with a refresh method, static   | 10.4 us     | **4.5 us**  | nothing to prune            |
| churn: 2k, all with a refresh method, 100 swaps per frame | **36.5 us** | 65.3 us     | the case the memo loses     |
| attach: 100 subtrees of 25 nodes with no refresh method, re-attached | 45.5 us     | **9.8 us**  | O(depth), not O(subtree)    |

| Baseline                                        | incumbent   | pixi-mvt    |
| ----------------------------------------------- | ----------- | ----------- |
| dispatch: 2000 methods, Pixi `onRender` vs the refresh scene pass | 2.7 us      | 4.7 us      |
| mutation: 100 attach/detach on an unmanaged tree | 13.4 us     | 13.7 us     |

Notes on the two baselines, because both are adoption arguments rather than
performance ones:

- Pixi's `onRender` dispatch is a bare loop over an array calling a field. The
  scene pass loop added a detachment check and read the method through an
  accessor, which is under a nanosecond per container. Reading the backing
  fields directly instead was tried and measured as noise, so the public
  property read stayed at the time. The loop now calls methods cached in the
  memoised list (012 section 2), and there are no accessors.
- The structural wrappers cost an unmanaged tree nothing measurable. Every
  mutation on a tree nothing drives hits the invalidation short-circuit on its
  first comparison.

Run-to-run variance on the naive arms is wide (the sparse naive arm has been
seen anywhere between 182 us and 246 us across runs), so treat single-digit
percentage differences as noise. The conclusions above survive it by one to three orders of
magnitude.

## Style notes

Two style-guide rules needed a deliberate decision.

**`this`** is confined to the wrapped prototype methods, in
[container-mixin.ts](./container-mixin.ts) (and three-mvt's equivalent). A
wrapped prototype method cannot reach its instance without it. Methods themselves are invoked as plain calls with no receiver, so a
view's method stays an ordinary closure. The side effect is that a method defined as
a subclass prototype method would not see its instance, which costs nothing here
because the repo has no classes.

**`null`** appears nowhere in pixi-mvt's own surface: methods and memo fields are
all `undefined`. `Container.parent` is typed `Container | null` by Pixi, so the
three places that read it use a truthiness check rather than comparing.

## Pixi 8.16 facts this relies on

Recorded so they are not re-derived. All checked against `node_modules`.

- `extensions.mixin(Container, src)` is `Object.defineProperties(Target.prototype,
  getOwnPropertyDescriptors(src))`, which preserves accessors. pixi-mvt used it
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
  The workaround at [pause-menu-view.ts:33](../common/pause-menu-view.ts#L33)
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
