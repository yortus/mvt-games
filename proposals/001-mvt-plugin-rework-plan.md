# Rework Plan: pixi-mvt-plugin

> Implementation plan for reworking the spike. Written to be picked up cold in
> a fresh session - everything needed to start is in this file.
> Companions: [the appraisal](./003-mvt-plugin-appraisal.md) (independent review). The two
> documents this plan calls README.md and QUICK-START.md have since been
> swapped by section 11, and are now [the design notes](./002-mvt-plugin-design-notes.md) and
> [README.md](../src/pixi-mvt-plugin/README.md).

**Written:** 2026-09-18, against Pixi 8.16.0, branch `pixi-mvt-plugin`.

**Status: implemented**, sections 1 to 11. Section 12 (migrating the repo's own
games onto the hooks) and section 13 (follow-ups) are still open. What shipped
is described in [the design notes](./002-mvt-plugin-design-notes.md); the benchmark numbers there
are freshly measured and supersede the design-time baselines in section 10.

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

They are a matched pair in everything except gating, where section 3.5 makes
them deliberately asymmetric: `onUpdate` always fires, `onRefresh` skips hidden
subtrees. That is not an inconsistency but the distinction the two hooks exist
to draw. One **advances** state and must never skip a tick; the other
**projects** state and is idempotent, so skipping it while nothing can observe
the result costs nothing.

A sixth divergence from `onRender` follows from that: gating is only possible
in a walk. Pixi's registry is flat with no parent links, so it cannot prune a
subtree even in principle.

### 3.4 Hook signatures - settled, do not revisit

`onUpdate(deltaMs: number)`, never `onUpdate(ticker)`. A `Ticker` carries
`lastTime`, `elapsedMS` and `FPS`, which is the wall clock that MVT rule 1
exists to keep out. It also makes synthetic stepping awkward (tests,
thumbnails, replays), invites views to pick a different time base from their
models via `ticker.speed`, and would give the core a hard dependency on Pixi's
Ticker.

### 3.5 Gating - settled, do not revisit

**`onUpdate` never gates. `onRefresh` gates on visibility.**

`onUpdate` must not be gated: presentation state that stops advancing while
hidden is stale when it reappears, and gating would make state evolution a
function of whether something was drawn.

`onRefresh` is different in kind. It is idempotent and it projects rather than
advances, so skipping it costs nothing that the next visible frame does not
recover. A hidden subtree is refreshed to no observable effect, which for a
pooled list of a few hundred slots is the bulk of the pass.

An earlier draft settled this the other way, on two grounds. Both are now
answered:

- *"Pixi's folded `globalDisplayStatus` is computed during the render pass, so
  reading it from a refresh gives last frame's answer."* True, and verified:
  it is written only in `updateRenderGroupTransforms`. But it is the wrong
  field. `localDisplayStatus` is written eagerly by the `visible`, `renderable`
  and `culled` setters and is current at all times. A **walk** can fold it
  itself as it descends, one pass earlier than Pixi does. That is a capability
  Pixi's own `onRender` cannot have, because its registry is flat with no
  parent links.
- *"The cheap lever is already detachment."* Not for churn. Detaching sets
  `structureDidChange`, forces an instruction rebuild, and invalidates the
  memoised list in section 4, so it is paid twice. Visibility is not structure
  and invalidates nothing.

**The rule.** Descending the refresh walk, a node whose `localDisplayStatus`
lacks the visible bit is skipped along with its subtree, in O(1) via the skip
table in section 4.1. The node the pass starts on is never pruned, since
nothing above it runs.

**Ordering falls out correctly.** The walk is preorder, so a parent that sets a
child's visibility this frame is visited first, and the child is refreshed in
the same pass. There is no one-frame lag on reappearance.

#### The one thing gating requires of views

> **A view must not hide its own container.** Visibility, like position and
> scale, is set by the parent.

Otherwise a view that hides itself is pruned, its own hook stops running, and
nothing can ever turn it back on. Deadlock, silent, permanent.

This is already the repo's convention for position and scale, so gating
extends it to visibility rather than inventing a rule. It is also what makes
`<List>` work: the list sets each slot's visibility, and the list is never
pruned by its slots' state.

Three things make it stick:

- **JSX hoists it.** An element with a `visible` binding has that binding
  moved into its *parent's* generated refresh, so JSX authors keep writing
  `<sprite visible={...} />` and the convention holds mechanically. An element
  with no JSX parent keeps the binding, and the pass-root exemption covers the
  case where it is the root.
- **A dev-mode assertion catches the rest.** The walk records a node's
  visibility before running its hook and warns if the hook cleared it. That
  turns an invisible permanent failure into a named one, which matters most for
  imperative views the runtime cannot inspect.
- **Existing views need a small migration.** `scramble/views/bullet-view.ts`
  and its siblings currently do `view.visible = bindings.isActive()` inside
  their own refresh. Those move to the parent, which in `game-view.ts` is one
  assignment in a loop it already runs. Section 12 covers it.

To stop a subtree entirely, still detach or destroy it. To stop it *this
frame*, have its parent hide it.

## 4. Design: per-node memoisation

### 4.1 State

Two fields per hook kind, both pure memoisation - derivable, discardable, and
correct for any caller by construction:

```ts
_mvtHasUpdate?: boolean;      // does my subtree contain any onUpdate? undefined = dirty
_mvtUpdateList?: Container[]; // flat preorder list of hooked descendants
_mvtHasRefresh?: boolean;
_mvtRefresh?: RefreshIndex;   // list plus skip table, built and discarded together

interface RefreshIndex {
    readonly list: Container[];
    /** Per entry, the index just past its subtree. */
    readonly skip: Int32Array;
}
```

Refresh carries a skip table because only refresh gates (3.5). The list is
preorder, so an entry's descendants are contiguous, and recording where each
subtree ends turns "skip this hidden subtree" into one index assignment.

**The two are one field on purpose.** A skip table that could outlive the list
it indexes would be a second source of truth about the tree. Bundled, it is
derived from the list and cannot desync from it, and invalidation has one field
to clear rather than two it could clear inconsistently.

Worth being precise about what the skip table does *not* have to survive. It
indexes the list, not the scene graph. Once built, the list is immutable, so
`skip[i]` is always a valid index into it regardless of what the tree does
afterwards. Scene mutation invalidates the whole index (4.3) and both are
rebuilt together; mid-pass mutation (6.2) leaves the index stale in exactly the
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

Shown for update. Refresh runs the same collection against the other pair of
fields, and differs only in its drive loop, which gates on visibility:

```ts
const VISIBLE = 2;   // localDisplayStatus bit

export function refreshScene(node: Container): void {
    const { list, skip } = refreshIndexOf(node);

    for (let i = 0; i < list.length; ) {
        const target = list[i];

        // Detached mid-pass: skip its subtree too, not just the root of it.
        if (target.parent === null && target !== node) { i = skip[i]; continue; }

        // Hidden: prune the subtree. Never prune the node the pass started on,
        // which has no ancestor able to reveal it.
        if (i > 0 && (target.localDisplayStatus & VISIBLE) === 0) { i = skip[i]; continue; }

        target.onRefresh?.();
        i++;
    }
}
```

The fold is the subtle part. A hidden node must prune its **subtree**, not just
itself, or a locally-visible child of a hidden parent would refresh. Skipping
to `skip[i]` does the fold implicitly, since preorder makes a subtree
contiguous, and no ancestor stack is needed.

Two details worth keeping:

- **`i > 0` protects the pass root.** Nothing above it runs, so if it were
  pruned while hidden, nothing could reveal it. Every other entry has a visible
  ancestor by construction, since that ancestor is what let the walk reach it.
- **Mid-pass detach now skips the subtree**, where an earlier draft advanced by
  one and went on to refresh the detached node's descendants, whose own
  `parent` links are still intact. The skip table fixes a pre-existing wart for
  free.

```ts
export function updateScene(node: Container, deltaMs: number): void {
    let list = node._mvtUpdateList;
    if (list === undefined) {
        list = [];
        collect(node, list);
        node._mvtUpdateList = list;
    }
    for (let i = 0; i < list.length; i++) {
        const target = list[i];
        if (target.parent === null && target !== node) continue; // detached mid-pass
        const hook = target.onUpdate;
        if (hook === undefined) continue;
        hook(deltaMs);
    }
}

function collect(node: Container, out: Container[]): void {
    if (node.onUpdate !== undefined) out.push(node);
    const ch = node.children;
    for (let i = 0; i < ch.length; i++) {
        if (hasUpdate(ch[i])) collect(ch[i], out); // prune hookless subtrees
    }
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
        if (n._mvtHasUpdate === undefined && n._mvtUpdateList === undefined) return;
        n._mvtHasUpdate = undefined;
        n._mvtUpdateList = undefined;
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
- **A view must not hide its own container (3.5).** JSX hoisting and a dev-mode
  assertion cover most of it, but an imperative view that clears its own
  `visible` from inside its own hook will deadlock, and nothing in the type
  system prevents it. This is the one genuinely new rule gating introduces.

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
teaches". That part is **wrong** - QUICK-START's order works, because `collect`
reads the public property. The real trigger is reassignment after install on a
container hooked before install.

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

**Gating** (`refreshScene` only)

Containers are visible by default, so existing tests are unaffected and these
are the cases that have to be written deliberately.

8. A hidden node and its whole subtree are skipped, including a child left
   locally visible.
9. Revealing a node from its parent's hook refreshes the node in the **same**
   pass, not the next one.
10. The node the pass was called on refreshes even when hidden.
11. `updateScene` fires for hidden subtrees, proving the asymmetry in 3.5.
12. Dev mode warns when a hook clears its own container's visibility.
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
- **The `onRefresh` migration carries one mechanical change** that `onUpdate`
  does not. Views that hide themselves must stop (3.5). The current idiom is

  ```ts
  // scramble/views/bullet-view.ts, and five siblings
  function refresh(): void {
      const active = bindings.isActive();
      view.visible = active;          // moves to the parent
      if (!active) return;
      view.position.set(bindings.getScreenX(), bindings.getScreenY());
  }
  ```

  The visibility assignment moves up into `game-view.ts`, which already loops
  over those containers. The early-out then becomes unnecessary, because a
  hidden slot is not refreshed at all. Roughly a dozen views across the repo,
  and each one gets shorter.
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
2. **Migrating the 59 `onRender` sites to `onRefresh`**, once the `onUpdate`
   migration has settled.
3. **`onRender` versus `onRefresh` dispatch cost**, if the benchmark from
   section 10 shows anything surprising.

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
