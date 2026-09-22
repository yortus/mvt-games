# Rework Plan: pixi-mvt

> Implementation plan for reworking the spike. Written to be picked up cold in
> a fresh session - everything needed to start is in this file.
> Companions: [the appraisal](./003-mvt-plugin-appraisal.md) (independent review). The two
> documents this plan calls README.md and QUICK-START.md have since been
> swapped by section 11, and are now [the design notes](./002-mvt-plugin-design-notes.md) and
> [README.md](../src/pixi-mvt/README.md).

**Written:** 2026-09-18, against Pixi 8.16.0, branch `pixi-mvt-plugin`.

**Status: implemented**, sections 1 to 12. Section 12 (repo migration) is
complete: every game, the cabinet and the shared views in `src/common/` use
`onRefresh`, and Cactii's hand-forwarded `update` chain is now `onUpdate`. Each
game session runs `updateScene` over its own view, and `main.ts` runs one
`refreshScene` over the whole stage per tick, paused or not. The demos
(`src/demos/`, including the `pixi-jsx` runtime) still use `onRender` and
`StatefulPixiView`; the JSX runtime moves as step 1 of
[the `<List>` proposal](./004-list-proposal.md). The migration work still to do
is listed in section 13.1; the other section 13 follow-ups are untouched. The
plugin folder is now `src/pixi-mvt`. What shipped is described in
[the design notes](./002-mvt-plugin-design-notes.md); the benchmark numbers there
are freshly measured and supersede the design-time baselines in section 10.

**Superseded since implementation: the visibility gating in section 3.5 was
replaced by an explicit `SKIP_DESCENDANTS` sentinel.** A method returns the
sentinel to skip its own descendants for a frame, and both passes honour it
symmetrically. Nothing gates on `visible`, so the self-hide rule, its dev-only
`visible` setter guard, and the JSX `visible`-hoisting the gating design needed
are all gone; a view may set its own `visible` like any other presentation
output. Sections 3.5, 4.1 and 4.2 below are rewritten to the shipped sentinel,
and the pass-root and detach handling that once existed only to make gating safe
now fall out of the same skip table. The design notes are the authority.

---

## 1. Summary

The plugin gives every Pixi `Container` two optional hooks and two functions to
drive them across a scene:

```ts
container.onUpdate = (deltaMs) => { /* advance state over time */ };
container.onRefresh = () => { /* make the scene show current state */ };

updateScene(node, deltaMs); // runs every onUpdate in node's subtree
refreshScene(node);         // runs every onRefresh in node's subtree
```

Both passes visit a container before any of its descendants, run without a
renderer or a ticker, and cost microseconds on realistic scenes.

The rework keeps the hooks and replaces the machinery behind them. The current
implementation assumes one privileged "host" container owns a subtree; that
assumption is both unnecessary and **wrong**, and it causes a silent
data-corruption bug (section 4.6). It is replaced by per-node memoisation,
which is smaller, faster on realistic scenes, and correct by construction.

| Area | Disposition |
| --- | --- |
| `onUpdate` / `onRefresh` hooks | **Keep.** Unchanged, and both are first-class |
| Container mixin and structural wrappers | **Keep**, fix install order (7.1) |
| `SceneScheduler`, factory, `destroy`, host, `releaseScene` | **Delete** |
| Two list strategies, slot indices, tombstones, compaction | **Delete** |
| Application plugin, `app.scene` | **Delete** (section 5.1) |
| Benchmarks | **Rewrite** - current harness is invalid (7.2) |
| Docs | **Restructure** (section 11) |

Net effect is roughly a 40% code reduction with a faster, simpler core.

## 2. The requirement

This is the whole thing. Everything else is implementation detail.

- (a) There is a graph whose nodes are Pixi `Container`s.
- (b) *Some* nodes carry hooks.
- (c) `updateScene(N, dt)` / `refreshScene(N)` may be called on **any** node at
  **any** time, and must run every corresponding hook in N's subtree, each
  exactly once, with every node called before its descendants.

There is no privileged root, no host, no ownership and no session. The answer
for N is a pure function of N's subtree, so any cache must be node-local and
valid for whichever caller asks.

Sibling order is deliberately unspecified. A view whose hook depends on a
sibling's hook is reading another view's output rather than reading state.

## 3. The two hooks

### 3.1 `onUpdate(deltaMs)` - state advances

Advances anything time-dependent: a hit-flash timer, a recoil spring, a spin
angle, a smoothed counter. This is the half with no incumbent in Pixi at all.
Today the same job needs `Ticker.shared.add(fn)` plus remembering to remove it,
which leaks and keeps ghost animations running after teardown. Scoping it to
scene-graph membership deletes that whole bug class. Developers arriving from
Unity recognise `MonoBehaviour.Update` immediately.

### 3.2 `onRefresh()` - the scene catches up

Reads state and assigns to display objects, and nothing else. Running it twice
changes nothing, because it restates a fact rather than making a change.

Its value is that nothing ever has to *tell* the scene that state changed. No
dirty flags, no change events, no setter that also has to resize a rectangle.
State has one home, display objects are never the source of truth, and the
scene converges on it every frame.

### 3.3 Why not just use `onRender`?

**Recommendation: do not use `onRender` for state sync. Use `onRefresh`.**

`onRender` is not broken and this is not a criticism of it. It answers the
question *"I am about to be drawn."* `onRefresh` answers *"the state may have
changed."* Those are different questions, and they only give the same answer
when render cadence equals tick cadence and nothing in the tree is cached.

Five ways they diverge, in rough order of how likely they are to bite:

1. **`onRender` fires per render, not per tick.** A render-on-demand app
   (editors, tools, UI-heavy Pixi) may render zero or three times in a tick.
   Fixed-timestep simulation with interpolated rendering decouples the two by
   design. In both, sync happens at the wrong cadence or not at all. Pairing
   `onUpdate` with `onRender` quietly reintroduces exactly the render coupling
   that `onUpdate` exists to remove.
2. **`cacheAsTexture` silently suppresses it.** It is a mainstream perf tool -
   static backgrounds, tile layers, complex UI panels. The moment anyone caches
   a subtree, every `onRender` inside it stops firing. A teammate enabling
   caching for performance breaks someone else's sync, with no error.
3. **Render groups fragment its ordering.** `renderGroup: true` is Pixi 8's
   recommended tool for subtrees that move as a unit - cameras, parallax, HUDs.
   Each group keeps its own callback list.
4. **No renderer means no sync at all.** Headless scene-wide testing,
   server-side simulation, fast-forward and netcode rollback, snapshot
   generation. You can call one container's `onRender` by hand; you cannot do
   that for a composed scene of twenty nested views without writing the walk
   yourself, which is this plugin.
5. **A genuine ordering hole.** `onRender`'s registration list is append-only,
   so assigning it to an already-attached container whose descendants are
   already registered places the ancestor *after* them.

The positive case is simpler: `onUpdate` and `onRefresh` are a matched pair.
Same traversal, same ordering guarantee, same invalidation, same testability,
both driven by explicit calls at points you choose. Mixing `onUpdate` with
`onRender` means two mechanisms with different semantics, one of which you do
not control.

They are a matched pair in mechanics: same traversal, same ordering, same
invalidation, same skip table, same `SKIP_DESCENDANTS` sentinel. The only
asymmetry is one of intent. `onUpdate` **advances** state, so a subtree that
opts out with the sentinel freezes and is one frame stale on resume; `onRefresh`
**projects** state, so a subtree that opts out simply restates nothing until it
opts back in. Neither gates on visibility.

A sixth divergence from `onRender` is that a subtree can be skipped at all: the
sentinel jumps past a subtree in one step because the walk knows the tree's
shape. Pixi's registry is flat with no parent links, so it cannot skip a subtree
even in principle.

### 3.4 Hook signatures - settled, do not revisit

`onUpdate(deltaMs: number)`, never `onUpdate(ticker)`. A `Ticker` carries
`lastTime`, `elapsedMS` and `FPS`, which is the wall clock that MVT rule 1
exists to keep out. It also makes synthetic stepping awkward (tests,
thumbnails, replays), invites views to pick a different time base from their
models via `ticker.speed`, and would give the core a hard dependency on Pixi's
Ticker.

### 3.5 Skipping subtrees - settled, do not revisit

**Neither pass gates on visibility. A method may return `SKIP_DESCENDANTS` to
skip its own descendants for a frame.**

`onUpdate` must not be gated: presentation state that stops advancing while
hidden is stale when it reappears, and gating would make state evolution a
function of whether something was drawn. `onRefresh` could in principle skip
hidden subtrees - it is idempotent and projects rather than advances - but the
earlier draft that did this had to fold `localDisplayStatus` as it walked,
forbade a view from clearing its own `visible` (a pruned container drops out of
its own walk and deadlocks), and needed a dev-mode `visible` setter guard to
catch that. Restating a hidden fact is one method call that assigns a value
nobody draws, so dropping the gate makes the two passes the same walk and lets a
view set its own `visible` like any other presentation output.

**The sentinel.** `SKIP_DESCENDANTS` is a unique symbol the plugin exports. A
method returns it to tell the pass to skip that container's descendants this
frame:

```ts
slot.onRefresh = () => {
    if (item === undefined) return SKIP_DESCENDANTS; // leave the empty slot's subtree alone
    // ...otherwise project item into the subtree
};
```

The container itself has already run, so it can stop returning the sentinel on a
later frame and the subtree resumes - no deadlock. The skip is O(1) via the skip
table in section 4.1, since preorder makes a subtree contiguous, and no ancestor
stack is needed. The node the pass starts on is never skipped by an outside
caller; a driven root that returns the sentinel still skips only its
descendants.

**Symmetric across both passes.** Skipping a branch's refresh saves the cost of
restating facts nobody will draw; skipping its update freezes that branch's
presentation state, which is then one frame stale when it resumes, exactly as a
paused world is. It is the mechanism `<List>` uses to leave an empty slot's
subtree alone: the slot wrapper returns the sentinel when its item is absent and
sets its own `visible` for drawing. To stop a subtree entirely, still detach or
destroy it.

## 4. Design: per-node memoisation

### 4.1 State

Two fields per hook kind, both pure memoisation - derivable, discardable, and
correct for any caller by construction:

```ts
_mvtHasUpdate?: boolean;   // does my subtree contain any onUpdate? undefined = dirty
_mvtUpdate?: SubtreeInfo;   // list plus skip table, built and discarded together
_mvtHasRefresh?: boolean;
_mvtRefresh?: SubtreeInfo;  // list plus skip table, built and discarded together

interface SubtreeInfo {
    readonly list: Container[];
    /** Per entry, the index just past its subtree. */
    readonly skip: Int32Array;
}
```

Both passes carry a skip table, because both honour `SKIP_DESCENDANTS` (3.5).
The list is preorder, so an entry's descendants are contiguous, and recording
where each subtree ends turns "skip this subtree" into one index assignment.

**The two are one field on purpose.** A skip table that could outlive the list
it indexes would be a second source of truth about the tree. Bundled, it is
derived from the list and cannot desync from it, and invalidation has one field
to clear rather than two it could clear inconsistently.

Worth being precise about what the skip table does *not* have to survive. It
indexes the list, not the scene graph. Once built, the list is immutable, so
`skip[i]` is always a valid index into it regardless of what the tree does
afterwards. Scene mutation invalidates the whole memo (4.3) and both are
rebuilt together; mid-pass mutation (6.2) leaves the memo stale in exactly the
way it was already stale, with no new failure mode.

One case that looks dangerous and is not: `sortChildren` reorders siblings, so
a freshly collected list would have a different order. The stale list keeps the
old order, and its skip table still describes *that* list correctly, so nothing
is skipped wrongly. Only refresh ordering among siblings is stale, and no hook
depends on it.

The lists are only populated on nodes that have actually been driven -
typically one or two per application. The booleans are computed on every node
visited by a rebuild, which is what makes later prunes O(1).

### 4.2 Algorithms

Both passes are one implementation, parameterised by which pair of fields and
which method they read. The invoke loop honours `SKIP_DESCENDANTS` and is
identical for update and refresh:

```ts
// pass = UPDATE | REFRESH
function invokeSubtreeMethods(info: SubtreeInfo, node: Container, pass: Pass, deltaMs: number): void {
    const { list, skip } = info;
    for (let i = 0; i < list.length; ) {
        const target = list[i];
        // Detached mid-pass: skip its whole subtree, whose internal parent
        // links are still intact. The driven root has no parent and is exempt.
        if (target.parent === null && target !== node) { i = skip[i]; continue; }
        const result = pass === UPDATE ? target.onUpdate?.(deltaMs) : target.onRefresh?.();
        i = result === SKIP_DESCENDANTS ? skip[i] : i + 1;
    }
}
```

Skipping to `skip[i]` drops the whole subtree, not just its root, since preorder
makes a subtree contiguous, and no ancestor stack is needed. The same one-line
jump serves both a returned sentinel and a mid-pass detach, so the pass-root
exemption and subtree-detach handling the gating draft treated as special cases
now fall out of one branch.

Collection is likewise shared, shown here for update:

```ts
export function updateScene(node: Container, deltaMs: number): void {
    let info = node._mvtUpdate;
    if (info === undefined) {
        info = buildSubtreeInfo(node, UPDATE);
        node._mvtUpdate = info;
    }
    invokeSubtreeMethods(info, node, UPDATE, deltaMs);
}

function collectSubtreeMethods(node: Container, out: Container[], ends: number[]): void {
    let selfIndex = -1;
    if (node.onUpdate !== undefined) {
        selfIndex = out.length;
        out.push(node);
        ends.push(0); // placeholder, backfilled below
    }
    const ch = node.children;
    for (let i = 0; i < ch.length; i++) {
        if (hasUpdate(ch[i])) collectSubtreeMethods(ch[i], out, ends); // prune hookless subtrees
    }
    if (selfIndex !== -1) ends[selfIndex] = out.length; // index just past this subtree
}

function hasUpdate(node: Container): boolean {
    const cached = node._mvtHasUpdate;
    if (cached !== undefined) return cached;
    let found = node.onUpdate !== undefined;
    const ch = node.children;
    for (let i = 0; i < ch.length; i++) {
        if (hasUpdate(ch[i])) found = true; // NOTE: no early exit, see 4.5
    }
    node._mvtHasUpdate = found;
    return found;
}
```

### 4.3 Invalidation

One climb per hook kind, stopping at the first node already dirty for that
kind:

```ts
function invalidateUpdate(node: Container | null): void {
    let n = node;
    while (n) {
        if (n._mvtHasUpdate === undefined && n._mvtUpdate === undefined) return;
        n._mvtHasUpdate = undefined;
        n._mvtUpdate = undefined;
        // Refresh clears `_mvtHasRefresh` and `_mvtRefresh`, the latter carrying
        // both the list and its skip table so they cannot be cleared apart.
        n = n.parent;
    }
}
```

Triggered by:

- **Structural mutation** (`addChild`, `addChildAt`, `removeChild`,
  `removeChildren`, `destroy`): invalidate **both** kinds, from the affected
  parent.
- **Hook assignment** (the `onUpdate` / `onRefresh` setters): invalidate **that
  kind only**, from the container itself.

The short-circuit relies on a per-kind invariant - *a node dirty for kind K
implies all its ancestors are dirty for K* - which the climb maintains
inductively.

After the first mutation of a frame the chain to the top is already dirty, so
every subsequent mutation short-circuits on its first comparison. Trees that
have never been driven are permanently dirty, so an application that never
calls either function pays one comparison per mutation.

### 4.4 Properties that fall out

- **Attaching any subtree is O(depth), not O(subtree).** Nothing walks the
  attached subtree; only the ancestor chain is invalidated. This subsumes what
  an earlier draft called the "hookless short-circuit optimisation", without
  that optimisation's correctness hole.
- **Reparenting N does not invalidate N's own cache.** N's subtree is
  unchanged, so its lists stay valid; only the old and new parents' chains go
  dirty.
- **No retention.** Every reference points into the node's own subtree, so
  state dies with the node and there is nothing to tear down.

### 4.5 Two implementation traps

- `hasUpdate` / `hasRefresh` **must not early-exit** on the first hooked child.
  Visiting all children is what caches all of them, and that cache is what makes
  later prunes O(1). An early exit silently degrades the design to O(subtree).
- `invalidate` must clear **both** fields of its kind together. They are
  maintained in lockstep and the short-circuit condition tests both.

### 4.6 The host bug this replaces

The current design stamps `_mvtOwner` on every container so mutations can route
to "the" scheduler. That breaks the moment a second caller appears. Verified:

```
stage > menu > button(onUpdate)

updateScene(stage) -> button._mvtHost = stage; stage list = [button]  -> button runs
updateScene(menu)  -> button._mvtHost = menu (stolen); menu list = [button] -> runs
updateScene(stage) -> stage's list is non-empty so it never rebuilds;
                      the host guard rejects button forever -> button SILENTLY STOPS
```

Measured: the call count froze and never recovered across repeated calls. No
error, nothing to diagnose. The new design holds no such state, so this cannot
occur. Section 9 lists the regression test, which the old design fails.

## 5. Public API

```ts
export function updateScene(node: Container, deltaMs: number): void;
export function refreshScene(node: Container): void;
// plus the Container.onUpdate / Container.onRefresh declarations
```

Four names, total.

### 5.1 No Application plugin

Cut `installMvtScenePlugin`, `mvtScenePlugin`, the `PixiMixins.Application`
augmentation and `app.scene`. It is not shorter for the user:

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
`app.scene`, one of only two files needing `this`, and the "install before
init" footgun that is currently gotcha #1 in QUICK-START.

## 6. Semantics

### 6.1 Ordering

Within a pass, every container runs before its descendants. Sibling order is
unspecified.

Across passes, "all updates finish before any refresh" is a property of the
caller's loop, not something the library enforces. That is deliberate: the
caller owns the frame, which is what makes pause, slow motion and single-step
one-liners rather than features.

### 6.2 Mid-pass mutation

The list is a snapshot taken at the start of the pass.

| A hook, during the pass... | Behaviour |
| --- | --- |
| adds a hooked child | Not in the snapshot; runs next frame (see 6.3) |
| removes a **later** container | Skipped by the `parent === null` guard |
| removes an **earlier** container | No effect this frame |
| clears a hook on a later container | Skipped by the `hook === undefined` guard |
| reparents a container within the same subtree | Called once, from its snapshot position |
| destroys a container | Same as removal; requires all five wrappers |
| calls the same pass re-entrantly on the same node | Dev-mode guard: throw |

### 6.3 Accepted limitations

- **No drain-the-tail in v1.** A container created by a hook starts on the next
  frame, so a spawning view may show one frame of constructor state. Revisit
  after v1 (section 13).
- **Dense-plus-churning scenes are slower than a naive walk.** When every node
  is hooked and the tree is dirtied every frame, pruning prunes nothing and the
  index is rebuilt every frame, so caching is pure overhead. Measured at 118µs
  versus 81µs for the naive walk on 2000 hooked containers with 100 swaps per
  frame. Two fixes were tried and neither worked (section 10). It is
  structural. Accept it: the realistic shape is the opposite, where the cache
  wins by 420x.
- **Direct `container.children` mutation bypasses everything.** Documented
  non-support.
- **A subtree skipped in the update pass is one frame stale on resume.**
  Returning `SKIP_DESCENDANTS` from `onUpdate` freezes that subtree's
  presentation state, so it shows the frame it froze on for one frame when it
  resumes, exactly as a paused world does. It is an opt-in for deliberately
  frozen subtrees, not a default.

## 7. Defects to fix

### 7.1 P0: accessor shadowing (verified, silent)

`installMvtContainerMixin()` currently runs lazily inside the scheduler
factory. Any hook assigned **before** install creates an own data property that
permanently shadows the prototype accessor, so the setter never fires again for
that container and invalidation is silently lost.

Verified repro - hook never called, no error:

```ts
parent.onRefresh = () => {};
parent.onRefresh = undefined;
const s = createSceneScheduler(root);          // mixin installs here
parent.onRefresh = () => order.push('parent'); // bypasses the accessor
s.refresh();                                   // never called
```

`Object.getOwnPropertyNames(parent)` confirms the own property.

**Fix:** install the mixin at module load. Add a dev-mode assertion that no
instance carries an own hook property, plus a regression test for the
reassign-after-install path.

The appraisal claims this is "the exact construction order QUICK-START
teaches". That part is **wrong** - QUICK-START's order works, because
`collectSubtreeMethods` reads the public property. The real trigger is
reassignment after install on a container hooked before install.

### 7.2 Benchmark harness is invalid

Results depend on declaration order, not on the code:

| | rebuild declared first | incremental declared first |
| --- | --- | --- |
| first declared | 109,415 hz | 109,303 hz |
| second declared | 40,887 hz | 41,570 hz |

The winner is whoever runs first, to three significant figures. **Every number
currently published in README.md is an artifact and must be deleted.**

**Fix:** one arm per process, as specified in section 10.

## 8. Implementation order

1. **Eager mixin install, dev shadowing assertion, regression test** (7.1).
   Correctness, and the only defect that bites users silently.
2. **Replace the scheduler with `updateScene` / `refreshScene`** and the four
   memo fields. Delete `scene-scheduler.ts`, both strategy files, the scheduler
   types in `mvt-types.ts`, and `mvt-application-plugin.ts`.
3. **Port and extend the test suite** (section 9), including the host-bug
   regression test that the old design fails.
4. **Rewrite the benchmarks**, one arm per process (section 10). Delete the old
   published numbers.
5. **Restructure the docs** (section 11).
6. **Rework the demo** - its strategy toggle and most stats disappear.

## 9. Test plan

Port the existing suite where it still applies, and add the following. Every
item below was run against a prototype during design, so all are known
achievable.

**Core** (run against both `updateScene` and `refreshScene`)

1. Calls every hook exactly once.
2. Runs a parent before its child.
3. **Can be driven from any node** - call on root, then a branch, assert the
   branch count is lower and correct, then call on root again and assert it is
   unchanged.
4. **Interleaved calls on overlapping nodes stay correct** - alternate
   `updateScene(branch)` and `updateScene(root)` five times, asserting the exact
   expected count each time. *This is the regression test for 4.6; the old
   design fails it.*
5. Stays correct across 20 frames of churn.
6. Drops a detached container, **and its descendants**, when detached mid-pass.
7. Prunes hookless subtrees - 20k nodes / 200 hooked yields exactly 203 calls.

**SKIP_DESCENDANTS** (both passes)

Containers run regardless of `visible`, so these are the cases to write
deliberately.

8. A method returning the sentinel skips its whole subtree, including a deeply
   nested descendant, on the same pass.
9. The container that returned the sentinel still ran; only its descendants
   were skipped.
10. A container that skipped its subtree recovers on a later pass with no
    rebuild, so nothing gets stuck.
11. The sentinel works in `updateScene` too, freezing a subtree's state advance.
12. Visibility gates neither pass: a hidden subtree still refreshes, and a view
    may set its own `visible` without deadlocking.
8. Reassigning a hook after module load still invalidates (regression for 7.1).
9. `refreshScene` is idempotent - three consecutive calls leave identical state.
10. The two passes are independent - assigning `onUpdate` does not invalidate
    the refresh list, and vice versa.

**Mid-pass mutation:** one test per row of the table in 6.2.

## 10. Benchmark plan

One arm per process. Report µs/frame, not hz. Baselines measured during design:

| Scenario | naive walk | **memo** | compiled closures |
| --- | --- | --- | --- |
| A: sparse 20k nodes / 200 hooked, static | 294 µs | **0.70 µs** | 1.36 µs |
| B: dense 2000, all hooked, static | 12.2 µs | **6.22 µs** | 9.10 µs |
| C: dense 2000, 100 swaps/frame | **81.0 µs** | 118 µs | 99.9 µs |
| D: 100 hookless 25-node subtrees attached/detached | 50.1 µs | 14.8 µs | **13.1 µs** |

Scenario A is the headline and the realistic shape: a large scene where few
containers carry hooks.

On scenario C, do not re-litigate without new information. Dispatching during
the rebuild was marginally *worse* (8,506 vs 8,993 hz) and reusing the array
rather than allocating is noise (building a 2000-entry index costs ~5.3µs
either way).

Add the two baselines the appraisal correctly identifies as missing:

- Dispatch cost versus Pixi's `onRender`, the incumbent.
- Cost of the structural wrappers on trees that never call either function.
  Previously ~1% (147,122 hz unpatched vs 145,459 hz patched). That number
  belongs in the README, because the monkey-patch is the main adoption
  objection and the objection is about trust, not speed.

## 11. Documentation

- QUICK-START.md becomes **README.md**. It is the better product document.
- Current README.md becomes **the design notes** (now 002). It is a good engineering log
  and a poor front page - it opens with retractions and buries the pitch.
- **Lead the pitch with `onUpdate`.** It fills a hole in Pixi with no incumbent.
  Introduce `onRefresh` second, as its matched partner.
- **Include the "why not `onRender`" section** from 3.3 as a first-class part
  of the docs, not a footnote. Readers will ask, and the honest answer is a
  selling point.
- **Promote the JSX composition argument into the pitch.** It is the strongest
  point in the appraisal and has no workaround: `pixi-jsx` types `JSX.Element`
  as `Container` and `ListProps.to` as `(item, index) => Container`, so the
  `& { update }` half of `StatefulPixiView` is erased at every composition
  point. An update-bearing view therefore cannot be written into a JSX scene
  without a parallel imperative construction path purely to keep a handle on
  `.update()`. With `onUpdate` it is an ordinary `Container` that composes at
  any depth, inside a `<List>`, with no ref and no forwarding.
- Document the mid-pass mutation table, the `children`-mutation bypass, and the
  measured ~1% unmanaged-tree overhead.

## 12. Repo migration

Separate from the product work, and deliberately incremental.

- **Migrate `scramble` first.** It has the deepest `update` forwarding chain
  (`scramble/views/game-view.ts:215` to `cactii/views/game-view.ts:20` to the
  game entry), so it is where the pain is most visible.
- **Do the `onUpdate` migration before the `onRefresh` one.** They are
  independent, and the 59 `view.onRender = refresh` sites can stay untouched
  indefinitely while `onUpdate` proves itself.
- **The `onRefresh` migration is mechanical: `view.onRender = refresh` becomes
  `view.onRefresh = refresh`.** Nothing gates on visibility, so a view that
  hides itself keeps working:

  ```ts
  // scramble/views/bullet-view.ts, and five siblings - unchanged in shape
  function refresh(): void {
      const active = bindings.isActive();
      view.visible = active;          // a view may set its own visible
      if (!active) return;
      view.position.set(bindings.getScreenX(), bindings.getScreenY());
  }
  ```

  A view whose subtree is expensive to refresh while hidden can also return
  `SKIP_DESCENDANTS` after `view.visible = false`, but for a shallow entity like
  this the early-out is enough. Roughly a dozen views across the repo, each a
  one-line hook rename.
- The case for migrating is the failure mode, not the line count. Adding a view
  with presentation state today needs four coordinated edits, and missing any
  link means the animation silently never advances - no error, no failing test,
  and nothing in the type system catches a missing forward in an intermediate
  view. Counted as lines deleted it is a bad trade (~15 lines); counted as
  eliminated silent-failure modes it is a good one.

## 13. Follow-ups after v1

Revisit once v1 is complete and has been used:

1. **Drain-the-tail.** Deferred from v1 (6.3). If one-frame-late spawning turns
   out to matter, the exact fix is a per-pass epoch stamped on each dispatched
   container, then after the loop rebuild and dispatch any entry whose epoch
   differs. Costs one integer write per hook per frame in the hot path, so it
   needs measuring against the numbers in section 10.
2. ~~**Migrating the 59 `onRender` sites to `onRefresh`**~~. Done for every
   game, the cabinet and `src/common/` (see section 13.1 for what is left).
3. **`onRender` versus `onRefresh` dispatch cost**, if the benchmark from
   section 10 shows anything surprising.

### 13.1 Remaining migration work

Found while completing section 12 on 2026-09-22. The games now follow this
wiring:

- Each `GameSession.update` runs `gameModel.update(deltaMs)` and then
  `updateScene(gameView, deltaMs)`, even in games with no `onUpdate` views yet,
  so a view added later cannot silently miss its ticks.
- `src/main.ts` runs one `refreshScene(app.stage)` per tick, paused or not, and
  one `refreshScene(tempStage)` before rendering each thumbnail. Sessions never
  refresh their own views.

The remaining items, roughly in priority order:

1. **Check the games by eye.** The migration passes type-check, lint and
   tests, but nobody has played it yet. The most likely places for a
   regression are:
   - Cactii's match effects (shake, flash, fireworks, banner) and dragging a
     piece, because that is where the `onUpdate` chain moved.
   - The pause menu while paused.
   - The cabinet thumbnails.
   - Any view that only ran while visible under `onRender`. Nothing gates on
     `visible` now, so hidden views refresh too.
2. **Rewrite the `docs/` guide to match.** The guide still teaches
   `view.onRender = refresh` and passing `update()` down by hand. That is about
   26 mentions across 9 pages. The main ones:
   - `docs/ai-agents/skill-mvt-view.md` (its "Using `onRender`" section and
     every example)
   - `docs/building-with-mvt/presenting-the-world/views.md`
   - `docs/building-with-mvt/adding-visual-polish/presentation-state.md` (the
     hand-forwarding example at its "How to Implement It" section)
   - `docs/building-with-mvt/quickstart.md` and
     `iterating-with-confidence/testing-views.md`

   Open question: should `docs/architecture/` (the language-neutral spec) and
   rule 2 in `AGENTS.md` keep describing presentation state as "the view gains
   an `update(deltaMs)` method"? That is still true in the abstract, and
   `onUpdate` is how this repo does it with Pixi. The probable answer is to
   keep the spec neutral and describe `onUpdate` in the Pixi-specific guide
   only. Decide that before rewriting anything.
3. **Migrate the demo host and non-JSX demos.** `src/demos/main.ts` drives
   `session.update` only and relies on `onRender` for refresh. Give it the same
   wiring as `src/main.ts`, then move:
   - `demos/boids/` (3 views)
   - `demos/ordered-list/ordered-list-view.ts` (`StatefulPixiView` becomes
     `onUpdate`)

   Mixing is safe in the meantime: `onRender` still fires during rendering, so
   nothing breaks while the two schemes coexist.
4. **The JSX demos wait for 004.** `pixi-jsx` (`jsx-runtime.ts`, `list.ts`),
   `demos/tsx-pixi/demo-view.tsx` and `demos/list-swap/` move with step 1 of
   [the `<List>` proposal](./004-list-proposal.md). `list-swap/list.ts` is a
   local copy that step 7 of that proposal deletes. Its `onRender` also relies
   on running before Pixi rebuilds draw instructions, so do not rename it on
   its own.
5. **Retire `StatefulPixiView`** from `src/common/` once items 3 and 4 have
   removed its last users (`demos/ordered-list/`, `demos/list-swap/`).
6. **Migrate the playground.** `src/playground/presets.ts` has 6
   `view.onRender = refresh` sites in preset source. Whatever runs presets in
   `src/playground/sandbox/` then needs to drive `refreshScene` too.
   Low priority, and separate from the rest.
7. **Update 004's outdated wording.** Section 7.5 still says "Until `onUpdate`
   lands", but it has landed.

---

## Appendix A: Verified Pixi 8.16 facts

Recorded so they are not re-derived. All checked against `node_modules`.

- `extensions.mixin(Container, src)` is `Object.defineProperties(Target.prototype,
  getOwnPropertyDescriptors(src))` - preserves accessors.
  [Extensions.mjs:256](../node_modules/pixi.js/lib/extensions/Extensions.mjs#L256)
- `PixiMixins.Container` is declared **non-generic** by every shipped mixin even
  though `Container.d.ts` references `PixiMixins.Container<C>`. This survives
  only because of `skipLibCheck: true`. Copy the shipped pattern; do not "fix"
  it.
- `Container.prototype._onUpdate` already exists as Pixi's private transform
  callback, so backing fields must not use that name.
- `parent` is typed `Container | null`
  ([Container.d.ts:646](../node_modules/pixi.js/lib/scene/container/Container.d.ts#L646)) -
  one of the few places Pixi hands back `null`. Use a truthiness check there
  rather than comparing (Appendix C).
- Structural methods needing wrappers: `addChild`, `addChildAt`, `removeChild`,
  `removeChildren`, `destroy`. Everything else delegates to these.
  `addChildAt` splices a child out of its previous parent **without** calling
  `removeChild`, so it needs its own handling.
- Pure sibling reorders (`swapChildren`, `sortChildren`, `setChildIndex`,
  `addChild` of an already-parented child) need **no** wrapper, since sibling
  order carries no guarantee. This matters: Pixi calls `sortChildren` itself
  during rendering whenever `sortableChildren` is set.
- **`onRender` ordering, corrected.** The current README's claim that it has "no
  ordering guarantees" is overstated. `RenderGroup.init` and
  `RenderGroup.addChild` both append whole subtrees in preorder, which preserves
  ancestors-before-descendants, and nested render groups run parent-first
  ([RenderGroupSystem.mjs:91-113](../node_modules/pixi.js/lib/scene/container/RenderGroupSystem.mjs#L91-L113)).
  The one genuine hole is the late-assignment case in 3.3.
- `runOnRender` is called unconditionally, **never gated on visibility**. The
  workaround at [pause-menu-view.ts:33](../src/common/pause-menu-view.ts#L33)
  ("outer stays visible so onRender fires") was never needed.
- `cacheAsTexture` suppresses `onRender` for nested groups - `_updateRenderGroups`
  returns early when a cached group's texture is current.
- `getLocalBounds` is pull-based and recomputes at call time via
  `checkChildrenDidChange`, so measuring your own children inside a single
  refresh body is correct regardless of traversal order.

## Appendix B: File inventory

```
src/pixi-mvt-plugin/scene-scheduler.ts            254   delete
src/pixi-mvt-plugin/scene-scheduler.test.ts       569   port selectively
src/pixi-mvt-plugin/scene-scheduler.bench.ts      145   rewrite (invalid harness)
src/pixi-mvt-plugin/incremental-list-strategy.ts  104   delete
src/pixi-mvt-plugin/rebuild-list-strategy.ts       61   delete
src/pixi-mvt-plugin/mvt-application-plugin.ts      79   delete
src/pixi-mvt-plugin/mvt-types.ts                  123   shrink to hook types
src/pixi-mvt-plugin/mvt-container-mixin.ts        210   keep, fix install order
src/pixi-mvt-plugin/index.ts                       11   shrink to four exports
src/pixi-mvt-plugin-demo/                         663   rework toggle and stats
spike/index.html                                    -   dev-server demo page
```

The demo lives beside the plugin rather than inside it because it is a
*consumer*; nesting it would force an ancestor-barrel import, which
[project-structure.md](../docs/reference/project-structure.md) forbids at any
depth.

## Appendix C: Repo style rules that bit during the spike

Lint passing and AGENTS.md compliance are **not** sufficient. These live in
`docs/reference/style-guide.md` and ESLint does not enforce them:

- **No `null`** - use `undefined`. The repo has zero `=== null` comparisons.
  Read `null` only at third-party boundaries (`Container.parent`, DOM), with a
  truthiness check.
- **No `this`** - factory functions and closures. Justifiable only at a
  framework boundary with no alternative, such as a prototype accessor. Confine
  it to that file and say why.
- **No self-imports through a barrel at any depth** - not `'./index'`, and not
  `'../index'` from a subdirectory.
- No em-dashes; 4-space indentation; `Kind` not `Type`; string-literal unions.
