# Proposal: index-addressed `<List>`, with `<Switch>`

> Replace the reconciling `<List>` with one that knows only how many slots it
> holds and what is at each index. Add `<Switch>` for slots whose shape varies.
> Covers the supporting changes the JSX runtime needs, the Pixi 8 behaviour the
> design depends on, the hard dependency on visibility-gated `onRefresh`, and a
> migration path.

**Status:** proposed, not implemented. A working reference implementation of
`<List>` runs in [`src/demos/list-swap/`](../src/demos/list-swap/README.md). One
item here is already done: the cursor-aliasing defect described in section 2.2
has been fixed in the shipping `<List>` independently of this proposal.

**Related:** [Patterns guide](./006-list-patterns.md) - how to apply this to common
list shapes. [the `SlotList` proposal](./005-slot-list-proposal.md) - the
model-side collection designed to be projected by this component.

---

## 1. Summary

| | Current `<List>` | Proposed `<List>` |
| --- | --- | --- |
| Props | `of`, `to`, `version` | `length`, `item`, `children` |
| Knows about items | identity, order, contents | how many, and what is at an index |
| Reconciliation | zip-compare with bounded insert/delete heuristics | none |
| Steady-state cost | `N` identity comparisons per frame, or one with `version` | `N` visibility checks, one item lookup per slot |
| On reorder | 1 to 2 rebuilds per swap, about `N` on a re-sort | no structural work at all |
| Containers per item | 2 (slot wrapper plus item) | 1 |
| Item views bound by | item object captured in a closure | an accessor, re-read each frame |
| Empty or surplus slots | destroyed and rebuilt | hidden, and pruned by the refresh pass |

This is a proposal to *simplify*, not a claim that the current `<List>` is
broken. Section 2.4 states the case against this proposal, including the
measured behaviour of a proper keyed reconciler, which beats both designs on
reorder cost and is a legitimate alternative.

One new component comes with it:

- **`<Switch>`** covers slots whose *shape* varies. Index addressing cannot
  vary a slot's structure, so this is the companion construct that makes
  heterogeneous lists expressible. Without it the simpler `<List>` is not a
  superset of the current one.

An earlier draft also proposed `<Show>`. It is withdrawn (section 6): its whole
justification was that hidden subtrees still refresh, which visibility gating
in the refresh pass makes false.

This proposal has a **hard dependency** on that gating, and therefore on the
plugin rework. Section 7.5 states what it needs and why Pixi's own `onRender`
cannot provide it.

---

## 2. The case

### 2.1 Every list in the repo is already index-addressed

Seven games, zero reconcilers. The pattern is uniform:

```ts
// scramble/views/game-view.ts - repeated for bullets, bombs, rockets,
// UFOs, fuel tanks and explosions.
for (let i = 0; i < game.bullets.length; i++) {
    const idx = i;
    const c = createBulletView({
        getScreenX: () => (game.bullets[idx].worldCol - game.scrollCol) * TILE_SIZE,
        isActive: () => game.bullets[idx].isActive,
    });
}
```

`asteroids/views/game-view.ts` holds the one genuinely variable-length list. It
watches `length` and, on any change, destroys every view and rebuilds by index.
The proposed `<List>` is strictly better than that hand-roll, because it
appends instead of rebuilding.

`cactii/views/board-view/pieces-view.ts` is a drag-and-drop reorderable
*stateful* grid. It uses a fixed pool indexed by `row * GRID_COLS + col` and
keeps all drag, swap and settle state in a view model keyed by cell identity.
That is this proposal's recommended pattern, already in production.

The `of`/`version`/zip-compare machinery is used by exactly one file in the
repo: the tsx-pixi demo.

### 2.2 Where the current `<List>` is weak, measured

All numbers below are rebuild counts measured by instrumenting the `to`
callback, against the **fixed** implementation. A defect found while taking
these measurements is described at the end of this section and has already been
corrected.

| Mutation | Rebuilds | Ideal |
| --- | --- | --- |
| Append, truncate | 0 | 0 |
| Insert anywhere (head, middle, tail) | 1 | 1 |
| Remove anywhere | 0 | 0 |
| Move head to tail (n=10) | 1 | 0 |
| Adjacent swap (n=5) | 1 | 0 |
| Non-adjacent swap (n=5 and n=20) | 2 | 0 |
| Ten adjacent swaps (n=20) | 10 | 0 |
| Full reverse (n=6) | 5 | 0 |
| Full reverse (n=20) | 19 | 0 |

The pattern is clear and narrow. The current `<List>` handles insertion,
removal, append and truncation **optimally**. It is weak on exactly one class
of mutation, **reorder**, where it costs one or two rebuilds per swap and
roughly `N` on a re-sort.

That weakness is inherent to the design, not a bug. The algorithm is a
single-pass zip-compare with a one-step lookahead, so it can recognise an
insertion or a deletion but has no way to recognise that an item *moved*.
A move looks like a mismatch, and a mismatch falls through to Replace, which
destroys the grandchild and rebuilds it. Any presentation state in that
subtree is lost with it.

So a list that re-sorts every frame, such as a live leaderboard, rebuilds
close to all of itself every frame. Because element construction compiles a
function (section 3), that is `N` JIT compiles per frame. That cost is an
amplifier contributed by this JSX runtime, not by reconciliation.

**A defect found while measuring, now fixed.** `prev` was serving as both the
old snapshot, read at the delete cursor, and the new snapshot, written at the
insert cursor. After a non-tail insertion the write cursor ran ahead of the
read cursor and clobbered entries that had not been compared yet, so every
remaining item fell through to Replace. A single insertion at the head of a
list of `N` cost `N + 1` rebuilds rather than 1, measured at 6, 11 and 21 for
`N` of 5, 10 and 20. The single-insert heuristic, the algorithm's signature
feature, therefore did not work at all for any insertion before the last
position. Removal was unaffected, because in the delete path the write cursor
stays behind the read cursor.

The fix is to double-buffer the snapshots and swap the buffers at the end of a
reconcile, which costs no allocation because both arrays persist across frames.
It is covered by regression tests in [`list.test.ts`](../src/pixi-jsx/list.test.ts). Every
number in the table above is post-fix.

### 2.3 Reconciliation is a workaround for stateful views

In a push-based runtime the view instance holds all the state and the framework
writes only on diff, so a wrong item-to-instance mapping produces output that
is wrong and stays wrong. Reconciliation is a correctness requirement there.

Under MVT every binding is re-read and re-written every frame, so a wrong
mapping is self-correcting on the next frame for anything that is a binding.
What is left over is a short list:

1. View-held cosmetic state, which architecture rule 2 permits.
2. Pixi per-instance state (`AnimatedSprite` playhead, geometry drawn once in a
   `ref`, filter uniforms, `cacheAsTexture`).
3. Pointer state (hover, capture, drag).
4. Structural shape, when items are heterogeneous. This is what `<Switch>` is
   for.

Items 1 to 3 are well served by keying presentation state to item identity in a
view model, which is opt-in, colocated with the state that needs it, and
testable without a renderer.

One case where index addressing is genuinely better rather than merely
equivalent: **a list re-derived from scratch each frame**, such as a navigation
overlay or a spatial query result. Its items have fresh object identities every
frame and usually no stable id to key on, so identity is not merely expensive
to track but undefined. An index-addressed list does not have to pretend
otherwise.

### 2.4 The case against this proposal

A keyed reconciler does not have the weakness in section 2.2, and the "guesswork"
framing that motivated this proposal does not survive contact with one.

A minimal keyed implementation is a `Map<key, Container>`, one pass, no
lookahead, no longest-increasing-subsequence machinery, about 35 lines. Given a
key function, the item-to-node mapping is **fully determined** by the current
array: keys that persist are reused, new keys are built, absent keys are
destroyed. Nothing is inferred about what happened between frames. Measured on
the same workloads as section 2.2:

| Mutation | Current `<List>` | Keyed reconciler |
| --- | --- | --- |
| Adjacent swap (n=5) | 1 | **0** |
| Non-adjacent swap (n=5) | 2 | **0** |
| Full reverse (n=6) | 5 | **0** |
| Insert at head (n=20) | 1 | **1** |

It also preserves the node instance across a reorder, so per-item view state
survives intact.

Three consequences worth stating plainly:

1. **Reconcilers do not have to guess.** Only *bounded heuristic* reconcilers
   like the current one do, and what they guess about is the shape of the
   mutation, which is a deliberate trade for a single-pass allocation-free
   algorithm. Section 2.2 is a criticism of one implementation, not of
   reconciliation.
2. **"The model knows best how items move" argues for keys, not against
   reconciliation.** A `key` prop *is* the model handing identity to the list.
   Pushed to its conclusion, that insight asks for exactly what every keyed
   reconciler already asks for.
3. **For a small reorderable list with heavy per-item node state, a keyed
   reconciler is nicer to author against.** State simply stays in the node and
   no view model is required.

What survives, and is the actual case for this proposal:

- **Empirical, and the strongest point by far.** Seven games, zero reconcilers,
  every list index-bound (section 2.1). The machinery is unused. That is
  evidence about this codebase's workloads, not about reconciliation.
- **Per-frame refresh changes the cost baseline.** A keyed reconciler must
  still compare `N` keys every frame to learn that nothing changed. The
  proposed list compares one integer. The existing `version` prop already buys
  `O(1)`, so the honest win is the same best case without a staleness footgun
  and without requiring model cooperation. The magnitude is modest, and section
  4.6 quantifies it.
- **The view model is needed either way.** A keyed reconciler preserves a
  node's identity across a reorder but not its position, so an animated reorder
  still needs identity-keyed easing state. Reconciliation does not save that
  work.
- **Pull-model self-correction genuinely shrinks the stakes** (section 2.3),
  without eliminating the residue.
- **Less code and less surface.** Fewer props, one fewer container per item, no
  cursor-aliasing class of defect to have.

The real question is therefore **where identity-keyed state should live**: in
the scene graph, or in data. A reconciler puts it in the scene graph. MVT
pushes it into data, because views are meant to be thin projections and
presentation state is meant to be testable without a renderer. Once
identity-keyed state lives in a view model, the scene graph has no remaining
reason to track identity, and the list can be index-addressed.

That is an architectural argument with a real trade-off, not a performance
knockout. Adopt this proposal because the simpler primitive matches how this
repo already builds every list, not because reconciliation is unsound.

---

## 3. Pixi 8 behaviour this design depends on

All verified against the `pixi.js` version this repo pins. These are
load-bearing: if an upgrade changes any of them, revisit the design.

| Fact | Where | Consequence |
| --- | --- | --- |
| `onRender` hooks live in a flat per-render-group array, populated at `addChild`/`removeChild` time | `RenderGroup.addChild`, `addOnRender` | Refresh cost is proportional to attached hooked containers, independent of tree depth |
| `runOnRender` iterates that array unconditionally. **No display flag gates it.** Verified against `visible`, `renderable`, `alpha`, `culled`, `includeInBuild`, `measurable` and `RenderLayer` attach/detach, none of which alter the registry | `RenderGroup.runOnRender` | A flat registry has no parent links, so it structurally cannot prune. This is why gating has to happen in a **walk**, which is what section 7.5 uses |
| `isRenderGroup` and `cacheAsTexture` move a subtree's hooks into a child render group | probe against `RenderGroup` | The hooks are relocated, not disabled |
| `cacheAsTexture` does **not** suppress its own group's hooks. `runOnRender` runs before the early return; only nested render groups are skipped | `RenderGroupSystem._updateRenderGroups` | There is no flag-based way to park a subtree in place |
| `RenderGroup.removeChild` on a child that **is** a render group is O(1). It splices one entry from `renderGroupChildren` and returns without walking the subtree | `RenderGroup.removeChild` | Detach is far cheaper than a per-hook `indexOf` for render-group children. But render groups get their own instruction set, so making every list slot one **breaks batching**, which is why this is not a route to cheap detaching |
| `collectRenderables` returns early on `globalDisplayStatus < 7` | `collectRenderablesMixin` | Hidden subtrees cost nothing to draw |
| `set visible` sets `parentRenderGroup.structureDidChange = true` | `Container` | Toggling visibility forces the same instruction rebuild as `addChild`. Hiding is not cheaper than attaching |
| `set x`/`set y` go through `ObservablePoint`, which compares before storing | `ObservablePoint` | Writing an unchanged position costs a comparison, not a dirty-flag cascade |
| `runOnRender` runs before `_buildInstructions` within a frame | `RenderGroupSystem._updateRenderGroups` | Structural changes made inside `onRender` land in the same frame |
| `jsx()` calls `new Function` for every element with any dynamic binding | `jsx-runtime.ts`, `buildRefreshFn` | **Construction is the expensive operation.** Never destroy what can be reused |

That last row decides the shrink policy in section 4.4.

---

## 4. `<List>`

### 4.1 API

```ts
export interface ListProps<T> {
    /** How many slots the list currently holds. */
    length: () => number;
    /**
     * Resolves the item at `index`, or `undefined` for an empty slot.
     * Called once per slot per frame by the list, and the result is cached for
     * that slot's bindings, so an item view costs one lookup however many
     * bindings it has.
     */
    item?: (index: number) => T | undefined;
    /**
     * Builds the slot for `index`. Called once per index, ever.
     * The accessor is non-optional: bindings only run while the slot is
     * occupied, because the list hides empty slots and the refresh pass prunes
     * hidden subtrees.
     */
    children: (item: () => T, index: number) => Container;
    /** Optional handle on the list's own container. Requires section 7.4. */
    ref?: (el: Container) => void;
}
```

```tsx
<List length={() => bullets.slotCount} item={(i) => bullets.at(i)}>
    {(slot) => (
        <sprite
            texture={bulletTexture}
            x={() => slot().value.x}
            y={() => slot().value.y}
        />
    )}
</List>
```

Function-as-children type-checks cleanly against the existing `jsx`/`jsxs`
signatures, so no `render={...}` prop is needed.

Passing an **accessor** rather than a value is the whole hint that the item is
re-read each frame. `(item, index)` reads as "here is your item"; `(item(),
index)` reads as "ask again". That distinction is what makes the
capture-at-construction mistake visible instead of natural.

### 4.2 Semantics - settled, do not revisit

1. The list never compares items. It calls `length()`, and `item(i)` when
   given one, and nothing else. It never stores an item, never diffs, and never
   reconciles.
2. `children(...)` is called at most once per index, for the lifetime of the
   list.
3. Slot `i` is always at child index `i`. Slots are added at the tail and
   **never removed**, so child order equals slot order with no sorting and no
   splicing.
4. **The list owns slot visibility.** A slot is visible when `i < length()` and
   `item(i)` is not `undefined`. Everything else is hidden.
5. **Hidden slots are not detached and not destroyed.** They stay in the tree,
   and the refresh pass prunes them because they are hidden (section 7.5).
6. Slot bindings therefore only run while the slot is occupied, so the item
   accessor is non-optional inside `children`.
7. `slots.length` is a high-water mark. It never shrinks, so the tree's
   structure stabilises after warm-up and never changes again.

### 4.3 Reference implementation

```ts
export function List<T>(props: ListProps<T>): Container {
    const container = new Container();

    // High-water-mark pool. Slots are built on first need and never removed.
    const slots: Container[] = [];

    // Resolved once per slot per frame, read by that slot's bindings.
    const items: (T | undefined)[] = [];

    sync();

    // The list's own hook runs before its descendants in the refresh pass, so
    // visibility set here is seen when the pass reaches the slots.
    container.onRefresh = sync;

    return container;

    function sync(): void {
        const length = props.length();

        while (slots.length < length) {
            const index = slots.length;
            const slot = props.children(() => items[index] as T, index);
            slots[index] = slot;
            container.addChild(slot);
        }

        for (let i = 0; i < slots.length; i++) {
            const item = i < length && props.item !== undefined
                ? props.item(i)
                : undefined;
            items[i] = item;
            // Pixi's visible setter early-outs when unchanged.
            slots[i].visible = i < length && (props.item === undefined || item !== undefined);
        }
    }
}
```

Without an `item` prop the per-slot loop reduces to a visibility write, and the
common case of an unchanged `length` costs one comparison per slot.

### 4.4 Shrink policy: hide, never detach or destroy

Three options, and visibility gating in the refresh pass decides between them.

| Policy | Cost while parked | Churn cost | Safe |
| --- | --- | --- | --- |
| Destroy | none | allocation plus a JIT compile per element, per respawn | yes |
| Detach | none | structural change, instruction rebuild, and it **invalidates the memoised refresh list** | yes |
| **Hide** | one visibility check, subtree pruned | a visibility write, which early-outs when unchanged | **yes, given gating** |

Hiding used to be the unsafe option, because a hidden slot still refreshed and
its bindings ran past the end of the list. With `onRefresh` gated on visibility
that is no longer true, and hiding becomes the cheapest of the three by a wide
margin.

The decisive point against detaching is not the `indexOf` cost. It is that
detaching is a structural change, and the refresh pass memoises its traversal
into a flat list keyed on structure. Detaching a slot invalidates that memo and
forces a rebuild. Hiding does not, because visibility is not structure.

So slots are built once and never removed. There is no `trim()`, and no policy
to choose.

### 4.5 The authoring rule this imposes

> An item view must not capture item data at construction time. Everything
> item-dependent must be a getter.

Slot `i` will later hold a different item, and anything captured at
construction will not update. The repo already follows this: the asteroid view
takes `getShapeSeed()` as a *binding* rather than a constructor argument,
precisely so it can redraw when a slot's occupant changes.

This is the entire discipline the design imposes, and it is checkable in
review.

### 4.6 Cost

Per frame, steady state: one `length()` call, then one `item(i)` call and one
visibility write per slot. Without an `item` prop it is one comparison per
slot.

That is `O(slots)` rather than the `O(1)` an earlier draft claimed, and the
honest comparison is not with `O(1)`. The same work used to happen anyway, as
one guard getter per element inside every slot. Moving it into the list means
it happens **once per slot instead of once per binding**, and the author cannot
forget it. An item view with five bindings now costs one lookup rather than
five.

Against a reconciler: `N` visibility checks here versus `N` identity or key
comparisons there, so the same order. The wins are that a hidden slot's
bindings do not run at all, that nothing is ever rebuilt on reorder, and that
there is no `version` prop to go stale. Keep the magnitude in proportion: item
refresh is `O(live items x bindings)` and dominates the frame under every
design discussed here.

The durable wins are smaller and less glamorous than the asymptotics suggest:

- The current `version`-gated best case, reached unconditionally, without the
  prop and without the hazard of a stale `version` silently freezing a list.
- No structural work on reorder, where the current implementation costs one or
  two rebuilds per swap.
- One fewer container per item. The slot wrapper exists only to make the
  Replace branch cheap, so with no Replace branch `N` containers leave the
  scene graph along with their transform and collection work.

---

## 5. `<Switch>`

### 5.1 Why a record rather than `<Match>` children

This runtime types `JSX.Element` as `Container`. A Solid-style
`<Match when={...}>` would have to return a descriptor object rather than a
`Container`, which breaks that typing. A record of builders avoids the problem
entirely, needs no runtime changes, and lets TypeScript check case coverage
against the union returned by `kind()`.

### 5.2 API and implementation

```ts
export interface SwitchProps<K extends string> {
    kind: () => K;
    cases: Readonly<Record<K, () => Container>>;
}

export function Switch<K extends string>(props: SwitchProps<K>): Container {
    const container = new Container();

    // Branches are built on first selection and retained, so switching back
    // and forth costs nothing after warm-up.
    const built: Partial<Record<K, Container>> = {};
    let currentKind: K | undefined;

    select();
    container.onRender = select;

    return container;

    function select(): void {
        // Hot path: one call and one comparison on unchanged frames.
        const kind = props.kind();
        if (kind === currentKind) return;

        if (currentKind !== undefined) {
            container.removeChild(built[currentKind] as Container);
        }

        let branch = built[kind];
        if (branch === undefined) {
            branch = props.cases[kind]();
            built[kind] = branch;
        }
        container.addChild(branch);
        currentKind = kind;
    }
}
```

```tsx
<List length={() => model.enemyCount}>
    {(index) => (
        <Switch
            kind={() => model.getEnemy(index).kind}
            cases={{
                asteroid: () => asteroidView(model, index),
                ufo: () => ufoView(model, index),
            }}
        />
    )}
</List>
```

### 5.3 Semantics - settled, do not revisit

1. `kind()` is polled every frame and compared with `!==`. Unchanged frames do
   nothing.
2. Each branch is built at most once and retained thereafter, detached when not
   selected.
3. `cases` must be exhaustive over the union `kind()` returns. TypeScript
   enforces this, so there is deliberately no runtime fallback: a missing case
   is a type error, not a runtime condition.

Per-slot `Switch` is a better factoring than shape-aware list reconciliation.
It scopes rebuild to the one slot whose kind changed, rather than making the
list responsible for structure it cannot see.

For two or three variants that alternate rapidly, building all of them in the
slot and toggling `visible` is cheaper still, because it avoids the instruction
rebuild a structural change triggers.

---

## 6. `<Show>`: withdrawn

An earlier draft proposed `<Show>` on the grounds that a hidden subtree still
runs every hook it contains, so detaching was the only way to stop a subtree
refreshing without destroying it.

Visibility gating in the refresh pass (section 7.5) makes that premise false.
`visible={() => ...}` now stops the subtree refreshing, and it does so without
a structural change and without invalidating the memoised traversal, both of
which detaching costs.

So `<Show>` is withdrawn, and a plain `visible` binding replaces every use of
it. This is a straight reduction: one fewer component, one fewer decision, and
the cheaper mechanism is also the more obvious one.

The one thing it did that `visible` cannot is **build its content lazily**, so
a panel that is never opened is never constructed. That is a real but narrow
benefit, worth revisiting only if a screen appears where construction cost
matters and the subtree is genuinely rarely shown. Until then it is machinery
for a problem nobody has.

::: info
Note the asymmetry with `<Switch>`, which survives. `<Switch>` earns its place
by choosing *which* subtree exists, which no binding can express. `<Show>` only
chose *whether* one refreshes, which a binding now expresses directly.
:::

---

## 7. Supporting runtime changes

### 7.1 Cache the generated refresh function

Recommended independently of the rest of this proposal.

`buildRefreshFn` calls `new Function` for every element with any dynamic
binding, so a three-element item view costs three JIT compiles to build.

The generated function is already parameterised over its getters and previous
values:

```js
const fn = new Function('e', 'g', 'v', lines.join('\n'));
return (el) => fn(el, getters, lastValues);
```

The source string depends only on the ordered cheap keys and the ordered
watched keys, so the compiled function can be shared across every element with
the same binding signature. Key a cache on those two key lists joined. The
per-element work then reduces to building the `getters` and `lastValues`
arrays.

This matters far more once `<List>` builds slots lazily, because construction
moves out of startup and into gameplay.

While in there: `setupDynamicRefresh` allocates two closures per element, the
`refresh` wrapper and the `onRender` arrow. Assigning
`el.onRender = () => fn(el, getters, lastValues)` directly costs one.

### 7.2 Remove dead entries from `NON_GETTER_PROPS`

`NON_GETTER_PROPS` lists `'view'`, `'of'` and `'ref'`. `of` disappears with
this proposal and `view` is not a prop on any current intrinsic element, so
only `ref` still earns its place. This set affects intrinsic elements only:
function components receive raw props and the runtime never classifies them.

### 7.3 Declare props that already work but are untyped

`zIndex` and `sortableChildren` reach Pixi through the default direct-set
branch in `applyProp`, and `anchor` on `<text>` works because `applyProp`
guards with `'anchor' in el` and Pixi 8 `Text` has an anchor. None of the three
is declared in the JSX prop types. Add `zIndex` and `sortableChildren` to
`BaseProps`, and `anchor` to `TextProps`.

`zIndex` becomes more useful under this proposal, as the alternative to lifting
an item out of a list in order to draw it on top.

### 7.4 Call `ref` for function components

`jsx()` returns `type(props)` immediately for function components, so `ref` is
never invoked for them. Since `JSX.Element` is always `Container`, the runtime
can handle `ref` uniformly after the component returns. Components should then
never consume `ref` themselves, to avoid a double call.

Without this, a caller cannot reach a `<List>`'s own container to set, for
example, `sortableChildren`.

### 7.5 `onRefresh` with visibility gating: a hard dependency

**This proposal depends on the [plugin rework plan](./001-mvt-plugin-rework-plan.md)**,
on two counts.

**Gating.** Sections 4.2, 4.4 and 6 all rest on hidden subtrees not refreshing.
Pixi's own `onRender` registry is flat, with no parent links, so it cannot
prune (section 3). The plugin's refresh pass is a **walk**, and a walk can fold
`localDisplayStatus` as it descends and skip a hidden subtree in O(1).
`onUpdate` stays ungated, because presentation state that stops advancing while
hidden is stale when it reappears.

**Hooks.** `<List>`, `<Switch>` and every element's generated refresh must use
`onRefresh`, not `onRender`, or they sit outside the gated pass entirely.

`<List>` sets slot visibility in its own hook, and the pass visits parents
before children, so a slot that becomes visible this frame is refreshed this
frame. There is no one-frame lag on reappearance.

**The rule gating asks of views:** a view must not hide its own container.
Otherwise it is pruned, its hook stops running, and nothing can turn it back
on. This is already the repo's convention for position and scale, and it is
exactly why `<List>` owns slot visibility rather than each slot owning its own.

**Update-bearing views** are the second reason the plugin matters.
`JSX.Element` is `Container`, so the `& { update }` half of `StatefulPixiView`
is erased the moment a view enters a JSX tree, and nothing retains a handle to
call `update(deltaMs)`. Today that is worked around by hoisting such views out
of the tree and forwarding ticks by hand. Since `<List>` builds slots during
gameplay, there is no construction site to hoist from.

Until `onUpdate` lands, keep per-item presentation state in a view model owned
by the view that *contains* the list, as `src/demos/list-swap/` does and
`cactii/views/board-view/` already does. That is the better factoring anyway,
because the state is then testable without Pixi.

### 7.6 Hoist `visible` bindings to the parent's refresh

Required by the rule in 7.5, and mechanical.

A `<sprite visible={() => ...} />` is, at runtime, an element clearing its own
visibility from its own hook, which is precisely the deadlock case. But the
runtime builds children before parents and has them in `props.children`, so it
can move a child's `visible` binding into the **parent's** generated refresh.

The author keeps writing `visible={...}` and never learns the rule, because the
convention holds mechanically. An element with no JSX parent keeps the binding,
which is safe when it is the node a refresh pass is called on, since the pass
never prunes its own root.

This is the one runtime change gating forces, and it costs a few lines in
`jsx()` where children are already being walked.

---

## 8. Accepted limitations

**A hard dependency on the plugin rework.** Sections 4.2, 4.4, 6 and 7.5 all
rest on visibility gating in `onRefresh`. Without it, hidden slots still
refresh, the item accessor has to become optional again, a per-element guard
comes back, and `<Show>` has to be reinstated. This is the largest risk in the
proposal and it is external to it.

**High-water-mark memory.** A list that peaks at 5000 items retains 5000 slots
for the life of the list. Hidden slots cost one visibility check each per frame
and nothing else, but they are resident. This is now a deliberate trade rather
than a policy choice: the alternative, detaching, invalidates the memoised
traversal on every change.

**No exit effects without a model-owned clock.** A slot whose item disappears
hides instantly. Something has to hold the item long enough to animate it out,
which is what `reuseDelayMs` in
[the `SlotList` proposal](./005-slot-list-proposal.md) exists for. Under
rule 1 the model owns time, so an exit animation was never the view's to own.

**Per-frame cost is `O(slots)`, not `O(1)`.** Section 4.6 sets out why that is
the honest comparison and where the work moved from.

**Heterogeneous lists depend on `<Switch>`.** Until it ships, the simpler
`<List>` is not a superset of the current one.

---

## 9. Migration

0. **Already landed.** The cursor-aliasing defect in section 2.2 is fixed and
   covered by [`list.test.ts`](../src/pixi-jsx/list.test.ts). That fix stands on its own and
   is independent of whether this proposal is adopted.
1. **Land `onRefresh` with visibility gating** in the plugin rework, and move
   the JSX runtime's generated refresh from `onRender` to `onRefresh`. This is
   a hard dependency (section 7.5), so nothing below can ship without it.
2. Land section 7.1 next. It is independent, it is a clear win, and it de-risks
   slot construction during gameplay.
3. Add `<Switch>` to `src/pixi-jsx/`. Purely additive.
4. Replace `list.ts` with the section 4.3 implementation and update the barrel.
   `ListProps` changes shape, so this is a breaking change to the module's
   public API.
5. Update `src/demos/tsx-pixi/demo-view.tsx`, the only consumer:

   ```tsx
   // before
   <List of={getStars} to={(star) => (
       <container x={() => star.x} y={() => star.y} alpha={() => star.alpha} />
   )} />

   // after
   <List length={() => getStars().length} item={(i) => getStars()[i]}>
       {(star) => (
           <container
               x={() => star().x}
               y={() => star().y}
               alpha={() => star().alpha}
           />
       )}
   </List>
   ```

6. Update `src/demos/tsx-pixi/README.md` and that demo's `techniques` list,
   which both currently advertise zip-compare reconciliation.
7. Point `src/demos/list-swap/list.ts` at the barrel and delete the local copy.
8. Fold [the patterns guide](./006-list-patterns.md) into
   `docs/building-with-mvt/` if and when the JSX runtime graduates from
   experimental. `docs/` currently makes no reference to `src/pixi-jsx/`.

---

## 10. Open questions

1. **Should we adopt a keyed reconciler instead?** It is the serious
   alternative and section 2.4 makes its case. It beats both designs on reorder
   cost and preserves per-item node state for free, at the price of `N` key
   comparisons per frame, a `key` prop, and more machinery. Recommend not, on
   the grounds that no list in the repo needs it and MVT wants identity-keyed
   state in view models anyway. That recommendation rests on how this repo
   builds views, so it should be revisited if that changes.
2. **Should hidden slots ever be reclaimed?** They are never detached or
   destroyed, so a list that peaks at 5000 holds 5000 slots for its lifetime,
   each costing one visibility check per frame. A `trim()` would reclaim them
   at the price of invalidating the memoised traversal. No workload in the repo
   peaks hard enough to need it. Recommend deferring.
3. **Should the slot index reach the item as a binding rather than a
   closed-over constant?** It is a constant by construction, so a getter would
   be pure overhead. Recommend not.
4. **Is `kind` the right prop name for `<Switch>`?** It follows the repo's
   "`Kind` over `Type`" convention and avoids `on*`, which the runtime treats
   as an event prefix on intrinsic elements.
5. **Should a `<KeyedList>` exist alongside the index-addressed one?**
   Question 1 asks whether to adopt keying *instead*. This asks whether to
   offer both, as Solid does with `<For>` and `<Index>`.

   Keying buys exactly one thing: a stable item-to-`Container` association
   maintained by the list. That protects the state an index-addressed slot
   cannot keep across a reorder: `Text` layout derived from item data,
   `Graphics` geometry built once in a `ref`, an `AnimatedSprite` playhead,
   and pointer capture mid-drag.

   The case against, in order of weight:

   - No list in the repo needs it. Bullets, particles, debris and enemy waves
     are pools with stable slots, so their occupants never change and keying
     buys nothing.
   - It costs `N` key comparisons per frame, which is exactly what section 4.6
     removes. A `version` gate recovers `O(1)` but the footgun is **worse than
     for the index-addressed list**: a stale gate there only loses structural
     updates, because every binding still re-reads and the screen stays
     correct. A stale gate on a keyed list stops the mapping being maintained,
     so it shows the wrong items indefinitely with nothing to correct it.
     Self-correction is the property keying gives up.
   - The strongest concrete case, a frequently re-sorting list of text rows,
     has a cheaper renderer-native fix. `BitmapText` updates from a glyph
     atlas with no measurement or texture upload, which is the standard answer
     to changing text in a game and needs no list machinery at all.
   - Its most attractive benefit, letting a row keep cosmetic state in its own
     closure so no view model is needed, **does not work until `onUpdate`
     lands** (section 7.5). A row holding state needs `update(deltaMs)`, and
     JSX currently erases that. Shipping keying first buys the costs without
     the payoff.
   - It does not remove the view model for the animated-reorder case. A keyed
     list preserves a node's identity but not its position, so the easing
     state is still required. It drops the per-slot republication step and
     adds a reactive index accessor, which is close to a wash.

   The case for is one real ergonomic win: the slot-versus-item mistake
   becomes unexpressible. Under index addressing it is natural to put per-item
   cosmetic state in the slot's closure, where it silently follows the
   position instead of the item, and nothing in the type system catches it.

   Recommend deferring, with a checkable trigger rather than deferral by
   instinct. Revisit when **all four** of these hold: a concrete screen
   reorders frequently; it carries per-item presentation that is expensive to
   re-derive; `BitmapText` or a texture swap does not solve it; and `onUpdate`
   has landed. At that point the case is measurable, and a `<KeyedList>` is
   roughly 40 lines on top of machinery that already exists.
