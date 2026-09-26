# Proposal: index-addressed `<List>`, with `<Switch>`

> Replace the reconciling `<List>` with one that knows only how many slots it
> holds and what is at each index. Add `<Switch>` for slots whose shape varies.
> Covers the supporting changes the JSX runtime needs, the Pixi 8 behaviour the
> design depends on, the hard dependency on the `SKIP_DESCENDANTS` sentinel, and
> a migration path.

**Status:** implemented, apart from step 8 of the migration (folding the
patterns guide into `docs/`, deferred until the JSX runtime graduates). The
index-addressed `<List>` is `src/pixi-jsx/list.ts`, `<Switch>` is
`src/pixi-jsx/switch.ts`, and sections 7.1 to 7.6 are all in the runtime. Both
JSX demos use them, including [`src/demos/list-swap/`](../../src/demos/list-swap/README.md),
whose local copy of an earlier `<List>` is deleted. The shipped `<List>`
differs from the section 4.3 reference implementation in two small ways; the
note at the end of section 4.3 explains both. Its props also changed after
implementation: a single `items` source replaced `length` and `item` (section
4.7). Construction in the JSX runtime is now inert (section 7.7), and
`<Switch>` shipped as `<Switch>`/`<Match>` rather than the `kind`/`cases` form
of section 5.2 (section 5.4).

**Related:** [Patterns guide](../../src/pixi-jsx/list-patterns.md) - how to apply this to common
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
| Empty or surplus slots | destroyed and rebuilt | hidden, and their subtree skipped by the refresh pass |

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
justification was that hidden subtrees still refresh, which a slot wrapper
returning `SKIP_DESCENDANTS` makes false.

This proposal has a **hard dependency** on that sentinel, and therefore on the
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
It is covered by regression tests in [`list.test.ts`](../../src/pixi-jsx/list.test.ts). Every
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
| `onRender` callbacks live in a flat per-render-group array, populated at `addChild`/`removeChild` time | `RenderGroup.addChild`, `addOnRender` | Refresh cost is proportional to the attached containers that have an `onRender` callback, independent of tree depth |
| `runOnRender` iterates that array unconditionally. **No display flag gates it.** Verified against `visible`, `renderable`, `alpha`, `culled`, `includeInBuild`, `measurable` and `RenderLayer` attach/detach, none of which alter the registry | `RenderGroup.runOnRender` | A flat registry has no parent links, so it structurally cannot skip a subtree. This is why subtree-skipping has to happen in a **walk**, which is what section 7.5 uses |
| `isRenderGroup` and `cacheAsTexture` move a subtree's `onRender` callbacks into a child render group | probe against `RenderGroup` | The callbacks are relocated, not disabled |
| `cacheAsTexture` does **not** suppress its own group's `onRender` callbacks. `runOnRender` runs before the early return; only nested render groups are skipped | `RenderGroupSystem._updateRenderGroups` | There is no flag-based way to park a subtree in place |
| `RenderGroup.removeChild` on a child that **is** a render group is O(1). It splices one entry from `renderGroupChildren` and returns without walking the subtree | `RenderGroup.removeChild` | Detach is far cheaper than a per-method `indexOf` for render-group children. But render groups get their own instruction set, so making every list slot one **breaks batching**, which is why this is not a route to cheap detaching |
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
     * occupied, because an empty slot's wrapper returns `SKIP_DESCENDANTS`, so
     * the refresh pass skips its subtree.
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
4. **Each slot owns its own visibility.** A slot's wrapper shows itself when
   `i < length()` and `item(i)` is not `undefined`, and hides itself otherwise.
5. **Hidden slots are not detached and not destroyed.** They stay in the tree,
   and their wrapper returns `SKIP_DESCENDANTS`, so the refresh pass skips their
   subtree (section 7.5).
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

    ensure(props.length());

    // The list's own method only grows the pool. Each slot resolves its own
    // presence, so there is no per-slot loop here.
    container.onRefresh = () => { ensure(props.length()); };

    return container;

    function ensure(length: number): void {
        while (slots.length < length) {
            const index = slots.length;

            // One container per item: the user's item view. The list wraps its
            // generated refresh (`ownRefresh`) with a presence check that runs
            // first - resolving the item, showing or hiding the slot, and
            // returning SKIP_DESCENDANTS when the slot is empty so `ownRefresh`
            // and the rest of the subtree are skipped. No item binding ever runs
            // past the end of the list. The item root must not carry its own
            // `visible` binding, since the list owns presence-visibility.
            const slot = props.children(() => items[index] as T, index);
            const ownRefresh = slot.onRefresh;
            slot.onRefresh = () => {
                const len = props.length();
                const item = index < len && props.item !== undefined ? props.item(index) : undefined;
                items[index] = item;
                const present = index < len && (props.item === undefined || item !== undefined);
                slot.visible = present; // Pixi's visible setter early-outs when unchanged.
                if (!present) return SKIP_DESCENDANTS;
                return ownRefresh?.();
            };

            slots[index] = slot;
            container.addChild(slot);
        }
    }
}
```

A newly grown slot is added during a pass, so by the plugin's mutation rule it
first refreshes on the next pass, one frame after it appears. Without an `item`
prop each slot's presence check reduces to a visibility write, and an unchanged
`length` grows nothing.

**Where the shipped implementation differs, and why.** `src/pixi-jsx/list.ts`
keeps every rule in section 4.2.

1. **Nothing happens at construction.** The list reads `items` and builds its
   slots on its first refresh, not when it is built, as does `<Switch>` with
   `kind()`. This follows from inert construction (section 7.7): an ancestor
   that skips the list, such as an unselected branch, must be able to keep a
   not-yet-valid `items` getter from running.
2. **A slot is refreshed as soon as it is built.** The plugin allows a method
   to drive a *different* container, so `list.ts` calls `refreshScene(slot)`
   straight after building it. There is no one-frame lag, and hand-written
   item views that only sync inside `onRefresh` are correct on their first
   frame. The running pass does not visit the slot again, because it was not
   in that pass's snapshot. `<Switch>` does the same when it attaches a
   branch, which also covers re-attaching a retained branch that did not
   refresh while it was detached.

It also reads `length()` once per frame in the list's own method, which the pass
runs before any slot, and shares it with every slot's presence check, rather
than calling `length()` once per slot.

### 4.4 Shrink policy: hide, never detach or destroy

Three options, and the `SKIP_DESCENDANTS` sentinel in the refresh pass decides
between them.

| Policy | Cost while parked | Churn cost | Safe |
| --- | --- | --- | --- |
| Destroy | none | allocation plus a JIT compile per element, per respawn | yes |
| Detach | none | structural change, instruction rebuild, and it **invalidates the memoised refresh list** | yes |
| **Hide** | one sentinel return, subtree skipped | a visibility write, which early-outs when unchanged | **yes, given the sentinel** |

Hiding used to be the unsafe option, because a hidden slot still refreshed and
its bindings ran past the end of the list. Now an empty slot's wrapper returns
`SKIP_DESCENDANTS`, so the pass skips the slot's subtree in one step and no item
binding runs past the end of the list. Hiding becomes the cheapest of the three
by a wide margin.

The decisive point against detaching is not the `indexOf` cost. It is that
detaching is a structural change, and the refresh pass memoises its traversal
into a flat list keyed on structure. Detaching a slot invalidates that memo and
forces a rebuild. Hiding does not: visibility is not structure, and the sentinel
skips the subtree without mutating the tree.

So slots are built once and never removed. There is no `trim()`, and no policy
to choose.

> **Revised 2026-09-25: detach the tail, hide the holes.** Measurement
> overturned half of this. A parked slot is not free: it still costs a refresh
> call per frame. After the falling-sand demo filled to 20,000 grains and was
> cleared to 180, its refresh pass took about 970 µs per frame, almost all of
> it parked slots; detaching them brought it to about 10 µs. So slots past
> `length` are now detached (kept, not destroyed) and reattached, not rebuilt,
> when the list grows back. Holes below `length` are still hidden, since the
> memo argument above still holds for them. The memo rebuild happens only when
> the length changes, and the `construction` suite's churning `SlotList` pool
> measured within noise of the hide-only version. Detached slots are destroyed
> with the list, since `destroy({ children: true })` no longer reaches them.

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

### 4.7 `items` replaced `length` and `item` (after implementation)

Sections 4.1 to 4.3 are the original design record. The shipped `<List>` takes
one prop in place of `length` and `item`:

```ts
export interface ListSource<T> {
    readonly length: number | (() => number);
    at(index: number): T | undefined;
}

items: ListSource<T> | (() => ListSource<T>);
```

```tsx
<List items={getStars}>                  // an array, via a getter
<List items={model.tiles}>               // an array, by reference
<List items={bullets.slots}>             // a SlotList
<List items={hand.ordered}>              // an OrderedSlotList, logical order
<List items={{ length: () => model.enemyCount, at: (i) => model.getEnemy(i) }}>
```

- **The source shape is the one arrays already have.** `readonly T[]` is
  assignable to `ListSource<T>` under the repo's ES2022 lib, and calling
  `at(i)` costs nothing measurable in the list. Re-measured one design per
  process (the performance docs proposal, section 5.4): in a bare loop `at(i)`
  is about 0.2 ns per element slower than `[i]` (1.06 versus 0.86 ns), but
  inside `<List>`'s slot method the difference is within noise, under about 1 ns
  per slot. The first measurement, which found them equal (0.76 versus 0.77 ns),
  ran both in one process.
  `SlotList` and `OrderedSlotList` expose `slots` (and `ordered`) in the same
  shape, and dropped `slotCount`, `at`, `atSlotIndex` and `atOrdinal`, which
  those replaced (see the `SlotList` proposal).
- **A value is a fixed reference whose contents are read every frame; a getter
  re-reads the reference too.** Models in this repo mutate their collections
  in place, so the value form is usually right. A model that replaces its
  collection needs the getter form; passing a value there would silently keep
  reading the old collection.
- **Semantics are otherwise unchanged.** `at(i)` returning `undefined` is an
  empty slot, exactly as `item(i)` was, and it is still called once per slot
  per frame. `length` is now read once per frame from the resolved source.
- **`length` may be a number or a function.** Arrays and slot lists have a
  number. A function is called once per frame, following the runtime's rule
  that a function is live, so an inline literal can have a live length without
  accessor syntax (`get length() { ... }`). The literal is evaluated once, like
  every JSX prop, so it does not allocate per frame.
- **Index-only lists need a source.** Where the old API allowed
  `length={() => n}` with no `item`, a list now needs something to project:
  usually a collection the model already has (`model.cells`), otherwise a
  two-member object literal (`{ length: () => model.count, at: (i) => ... }`).
  The patterns guide shows both.

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

### 5.4 Shipped: `<Switch>`/`<Match>` (after implementation)

Sections 5.1 to 5.3 are the original design record. `kind`/`cases` shipped
first, was replaced before anything used it, and is gone. The shipped form, in
`src/pixi-jsx/switch.ts`:

```tsx
<Switch>
    <Match when={() => model.boss?.isEnraged === true}>
        <text text={() => `ENRAGED ${model.boss!.hp}`} />
    </Match>
    <Match when={() => model.boss !== undefined}>
        <text text={() => `HP ${model.boss!.hp}`} />
    </Match>
    <Match else>
        <text text="No boss" />
    </Match>
</Switch>
```

**Evolution.** An earlier shipped form took the default branch as a
`fallback` prop, as Solid does. It was replaced by `<Match else>`: one
mechanism instead of two, the default written after the cases as in a
`switch` statement, and the lazy function-child form available to it like any
other branch. The name follows Kotlin's `when` expression, whose default
branch is `else`. A subject-value form (`<Switch value={...}>` with
`<Match case="ufo">`) was considered and rejected: JSX types children
separately from their parent, so nothing could check a `case` against the
subject's type, whereas TypeScript does reject `enemy().kind === 'uof'` in a
`when` (error TS2367).

**Why the section 5.1 objection no longer applies.** `<Match>` returns a real
`Container` (the branch's wrapper) and records its `when` in a module-level
`WeakMap`, so `JSX.Element` stays `Container`. `<Switch>` reads its children's
entries from that table.

**Why plain JSX children are safe.** JSX builds children before parents, so
every branch exists before `<Switch>` does. With inert construction (section
7.7) that is harmless: no binding runs at construction, and `<Switch>`'s own
refresh, which runs before any branch, picks one branch and makes every other
return `SKIP_DESCENDANTS`. A binding such as `model.boss!.hp` therefore only
ever runs while its `when` holds.

**Semantics.**

1. `when`s are tested in order every frame, stopping at the first that holds;
   no `when` runs at construction. The winner is shown; otherwise the
   `<Match else>` branch if there is one; otherwise nothing. Showing nothing is
   often what is meant (a one-branch switch works as "show this when"), so it
   is not an error.
2. Every branch is built up front and retained. Switching sets `visible`; the
   scene is never restructured, so the old detach-and-attach and its
   refresh-on-attach are gone.
3. A newly selected branch refreshes on the frame it is selected, because the
   switch's refresh precedes its branches' in the same pass.
4. A `<Match>` child may be a function, built on the branch's first selection,
   for branches too heavy to build in every slot of a list.
5. A non-`<Match>` child throws at construction. A `<Match>` with no `<Switch>`
   around it throws on its first refresh, since nothing would ever hide it.
6. `<Match else>` is the default branch. Its props are typed as exclusive with
   `when`, so a `<Match>` with neither (a silent catch-all) or both does not
   compile. It must be the last `<Match>`, which also limits it to one; a
   switch that breaks that rule throws at construction, since any branch after
   it could never be shown.

**What was traded.** Against `kind`/`cases`: coverage is no longer checked by
TypeScript, and all branches are built up front (use a function child where
that matters). Coverage can be recovered at runtime by a default branch whose
child throws, since a function child only runs when its branch is selected:

```tsx
<Match else>{() => { throw new Error(`Unhandled kind: ${enemy().kind}`); }}</Match>
```

In return: any condition, plain JSX branches, a default branch, and switching
with no structural change. With only a few
cases, the per-frame cost (at most one `when` call per branch, plus a
visibility write when the selection changes) does not matter.

---

## 6. `<Show>`: withdrawn

An earlier draft proposed `<Show>` on the grounds that a hidden subtree still
runs every method it contains, so detaching was the only way to stop a subtree
refreshing without destroying it.

The `SKIP_DESCENDANTS` sentinel in the refresh pass (section 7.5) makes that
premise false. An element that returns the sentinel while hidden stops its
subtree refreshing, and it does so without a structural change and without
invalidating the memoised traversal, both of which detaching costs.

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

**Implemented, and measured.** The cache was `compiledRefreshCache` in
`jsx-runtime.ts` (since replaced, see below), and each element allocated one
closure. The saving was not where this section predicted. V8 already caches
compilation by source string, so building an element only got about 11%
cheaper (1.51 to 1.34 µs for three bindings). The real win was at refresh
time: every element with a given shape shared one function that warmed up and
got optimised once, rather than each new element starting cold. With 1000
items, replacing 100 of them every frame, a frame dropped from 412 to 257 µs
(about 38%). With no churn the two were close (86 versus 79 µs).

**Those figures were wrong in both places.** They were measured with the two
designs in one process, a method later shown to distort comparisons (the
performance docs proposal, section 4.1). The cached-body design no longer
exists, so the re-measurement (that proposal's section 5.4) toggles the cache
on the shipping cached-factory design instead, one design per process, three
getters per element:

| | Cached | Uncached |
| --- | --- | --- |
| Construction, per element | 0.42 µs | 1.35 µs |
| 1000 elements, 100 destroyed and rebuilt per frame | 403 µs | 511 µs |
| 1000 elements, no churn | 10.3 µs | 13.2 µs |

So caching the generated code makes construction about 3x cheaper, not 11%,
and saves about 21% under churn, not 38%. The prediction at the top of this
section, that construction is where the cache pays, was right after all.

**Revised: a cached factory instead of a cached body.** Each method used to call
the shared function, which called the getters through an array. The cache
(`refreshFactoryCache`) now holds a generated *factory* per signature. Called
once per element with the element and its getters as separate arguments, it
returns the element's method, which calls each getter it captured directly and
keeps each watched value in a closure local.

Measured on 1000 elements with three cheap bindings and no churn, **one design
per process**, bundled to plain JavaScript, four runs each:

| Design | Per frame |
| --- | --- |
| Shared body with a getter array (before) | 9.75-10.11 µs |
| Cached factory (now) | 7.78-7.83 µs |
| Hand-written methods | 5.55-5.70 µs |

About 21% faster, and the gap to hand-written methods halves, from about 4.3 to
about 2.2 ns per element. A CPU profile with inlining disabled attributes that
remainder to the three getter calls themselves, which a runtime cannot avoid
because getters are all it receives. The pass itself costs about 0.5 ns per
element over a plain loop, and there were no deoptimisations after warm-up.

**A measurement warning.** Earlier comparisons in this section ran several
designs in one Vitest process, and reported larger gains (about 28 to 13 µs)
plus about 5.6 ns per element of pass overhead that does not exist. Designs
run side by side in one process share V8's inline caches and distort each
other, as `scripts/bench-scene-passes.ts` already warns. Running under `tsx`
also made timings bimodal (8 to 18 µs between identical runs), because its
loader moves module loading into a worker thread. Trust only one-arm-per-process
numbers from bundled JavaScript.

While in there: `setupDynamicRefresh` allocates two closures per element, the
`refresh` wrapper and the `onRender` arrow. Assigning
`el.onRender = () => fn(el, getters, lastValues)` directly costs one.

### 7.2 Remove dead entries from `NON_GETTER_PROPS`

`NON_GETTER_PROPS` lists `'view'`, `'of'` and `'ref'`. `of` disappears with
this proposal and `view` is not a prop on any current intrinsic element, so
only `ref` still earns its place. This set affects intrinsic elements only:
function components receive raw props and the runtime never classifies them.

**Implemented.**

### 7.3 Declare props that already work but are untyped

`zIndex` and `sortableChildren` reach Pixi through the default direct-set
branch in `applyProp`, and `anchor` on `<text>` works because `applyProp`
guards with `'anchor' in el` and Pixi 8 `Text` has an anchor. None of the three
is declared in the JSX prop types. Add `zIndex` and `sortableChildren` to
`BaseProps`, and `anchor` to `TextProps`.

`zIndex` becomes more useful under this proposal, as the alternative to lifting
an item out of a list in order to draw it on top.

**Implemented.** `zIndex` accepts a getter; `sortableChildren` is static.

### 7.4 Call `ref` for function components

`jsx()` returns `type(props)` immediately for function components, so `ref` is
never invoked for them. Since `JSX.Element` is always `Container`, the runtime
can handle `ref` uniformly after the component returns. Components should then
never consume `ref` themselves, to avoid a double call.

Without this, a caller cannot reach a `<List>`'s own container to set, for
example, `sortableChildren`.

**Implemented**, and covered by a `ref` test in `list.test.ts`.

### 7.5 `onRefresh` with `SKIP_DESCENDANTS`: a hard dependency

**This proposal depends on the [plugin rework plan](./001-mvt-plugin-rework-plan.md)**,
on two counts.

**The sentinel.** Sections 4.2, 4.4 and 6 all rest on an empty or hidden slot
being able to skip its subtree's refresh. Pixi's own `onRender` registry is
flat, with no parent links, so it cannot skip a subtree (section 3). The
plugin's refresh pass is a **walk**, and a method that returns `SKIP_DESCENDANTS`
skips its subtree in O(1) via the pass's skip table. Nothing gates on `visible`,
so `onUpdate` and `onRefresh` stay symmetric; a subtree skipped in the update
pass simply freezes until it opts back in.

**Methods.** `<List>`, `<Switch>` and every element's generated refresh must use
`onRefresh`, not `onRender`, or they sit outside the pass the plugin drives.

Each slot is a wrapper container: its refresh returns `SKIP_DESCENDANTS` when its
item is absent, and sets its own `visible` for drawing. The pass visits parents
before children, so a slot that becomes present this frame is refreshed this
frame, with no one-frame lag on reappearance. Because nothing gates on
visibility, a slot that sets its own `visible = false` still runs its own method
next frame, so it can always reveal itself again.

**Update-bearing views** are the second reason the plugin matters.
`JSX.Element` is `Container`, so the `& { update }` half of `StatefulPixiView`
is erased the moment a view enters a JSX tree, and nothing retains a handle to
call `update(deltaMs)`. Today that is worked around by hoisting such views out
of the tree and forwarding ticks by hand. Since `<List>` builds slots during
gameplay, there is no construction site to hoist from.

`onUpdate` has since landed, and `StatefulPixiView` is gone, so an item view
can now carry its own presentation state inside a `<List>`. Keeping per-item
presentation state in a view model owned by the view that *contains* the list,
as `src/demos/list-swap/` and `cactii/views/board-view/` do, is still often
the better factoring, because the state is then testable without Pixi.

### 7.6 Codegen: `visible` first, then `SKIP_DESCENDANTS`

Mechanical, and local to each element's generated refresh.

An element with a `visible` binding evaluates it **first** in its own generated
refresh, assigns `this.visible`, and returns `SKIP_DESCENDANTS` when the result
is false, before running any other binding:

```ts
element.onRefresh = () => {
    element.visible = isVisible();
    if (!element.visible) return SKIP_DESCENDANTS;
    // ...the element's other bindings
};
```

The author keeps writing `visible={...}` and never thinks about the sentinel.
Setting its own `visible` is safe - nothing gates on it, so the element runs its
own method again next frame and can reveal itself - and returning the sentinel
saves the cost of refreshing a hidden subtree. An element with no `visible`
binding generates no such branch.

This is the one runtime change the sentinel asks of the JSX codegen, and it
costs a few lines in `buildRefreshFn` where the binding order is already fixed.

**Implemented.** `jsx()` moves a `visible` getter to the front of the cheap
bindings, whatever order the props were written in, and the compiled body
returns the sentinel (passed in as a parameter) when it is false. Covered by
`jsx-runtime.test.ts`.

### 7.7 Inert construction (added after implementation)

**Implemented.** `jsx()` applies static props at construction but calls no
getter. Each binding first runs on the element's first refresh; watched
bindings start from an `UNSET` sentinel so that refresh always writes. `<List>`
and `<Switch>` are inert too: they read `items` and `kind()`, and build slots
and branches, on their first refresh.

**Why.** TSX builds children before their parents, so a binding evaluated at
construction runs before any ancestor exists to skip it. A binding that is
only valid under some condition (`model.boss!.hp`, valid only while a boss
exists) would throw during construction even inside a hidden or unselected
subtree. Deferring the first evaluation to the refresh pass, where parents run
before children and can return `SKIP_DESCENDANTS`, means such a binding never
runs while its guard says no. This is what makes a `<Switch>`/`<Match>` with
plain JSX children safe.

**What it changed elsewhere.**

- `<List>` no longer seeds its item cache before `children()`, and no longer
  delays building an empty index. Every index below `length` is built on the
  refresh that first covers it, so slot `i` is child `i` again (rule 3 in
  full) and the per-frame check for unfilled holes is gone.
- Until its first refresh, a bound property holds Pixi's default. Nothing is
  drawn that way: hosts refresh the whole scene before every render, and
  `<List>`/`<Switch>` refresh what they build mid-pass. Code that reads a bound
  property straight after construction (measuring a `<text>`, say) must call
  `refreshScene` on the tree first. A `ref` callback sees defaults for the
  same reason.
- A `children` function must not call the item accessor while building, since
  the slot may be empty then. Calling it inside bindings is always safe.

**Cost.** None per frame. The first refresh does exactly the work
construction used to.

---

## 8. Accepted limitations

**A hard dependency on the plugin rework.** Sections 4.2, 4.4, 6 and 7.5 all
rest on the `SKIP_DESCENDANTS` sentinel in `onRefresh`. Without it, hidden slots
still refresh, the item accessor has to become optional again, a per-element
guard comes back, and `<Show>` has to be reinstated. This is the largest risk in
the proposal and it is external to it.

**High-water-mark memory.** A list that peaks at 5000 items retains 5000 slots
for the life of the list. Hidden slots cost one sentinel return each per frame
and nothing else, but they are resident. This is now a deliberate trade rather
than a policy choice: the alternative, detaching, invalidates the memoised
traversal on every change.

**No exit effects without a model-owned clock.** A slot whose item disappears
hides instantly. Something has to hold the item long enough to animate it out,
which is what `reuseDelayMs` in
[the `SlotList` proposal](./005-slot-list-proposal.md) exists for. Under
rule 1 the model owns time, so an exit animation was never the view's to own.

~~**Item roots cannot carry their own `visible` binding.**~~ Lifted by the
section 7.6 codegen. The list's presence check runs first and returns before
the item's own refresh when the slot is empty, so the item root's `visible`
binding only runs for an occupied slot, after the list has shown it. The two
compose as "present and visible", and neither overrides the other.

**Per-frame cost is `O(slots)`, not `O(1)`.** Section 4.6 sets out why that is
the honest comparison and where the work moved from.

~~**Heterogeneous lists depend on `<Switch>`.**~~ `<Switch>` has shipped.

---

## 9. Migration

0. **Already landed.** The cursor-aliasing defect in section 2.2 was fixed in
   the reconciling `<List>`. That `<List>`, and its regression test, have since
   been replaced by step 4.
1. **Done.** ~~Land `onRefresh` with `SKIP_DESCENDANTS`~~ in the plugin rework,
   and move the JSX runtime's generated refresh from `onRender` to
   `onRefresh`, with the section 7.6 codegen. The shipping `<List>`, the demo
   host (`src/demos/main.ts`) and every demo moved with it.
2. **Done.** ~~Land section 7.1 next.~~ Measured results are in that section.
3. **Done.** ~~Add `<Switch>` to `src/pixi-jsx/`.~~ With `switch.test.ts`.
   Sections 7.2 to 7.4 landed with it.
4. **Done.** ~~Replace `list.ts` with the section 4.3 implementation~~, with the
   three differences noted at the end of section 4.3. `list.test.ts` is
   rewritten for the new semantics.
5. **Done.** ~~Update `src/demos/tsx-pixi/demo-view.tsx`, the only consumer:~~

   ```tsx
   // before
   <List of={getStars} to={(star) => (
       <container x={() => star.x} y={() => star.y} alpha={() => star.alpha} />
   )} />

   // after (with the section 4.7 `items` prop)
   <List items={getStars}>
       {(star) => (
           <container
               x={() => star().x}
               y={() => star().y}
               alpha={() => star().alpha}
           />
       )}
   </List>
   ```

6. **Done.** ~~Update `src/demos/tsx-pixi/README.md` and that demo's
   `techniques` list.~~
7. **Done.** ~~Point `src/demos/list-swap/list.ts` at the barrel and delete the
   local copy.~~ Its tests went with it; `src/pixi-jsx/list.test.ts` covers the
   same ground under the hide-not-detach policy.
8. Fold [the patterns guide](../../src/pixi-jsx/list-patterns.md) into
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
2. ~~**Should hidden slots ever be reclaimed?**~~ Partly resolved: slots past
   `length` are now detached, so they cost nothing per frame (see the revision
   note in section 4.4). They are still kept for reuse rather than destroyed,
   so a list that peaked at 5000 still holds 5000 slots' memory.
3. **Should the slot index reach the item as a binding rather than a
   closed-over constant?** It is a constant by construction, so a getter would
   be pure overhead. Recommend not.
4. ~~**Is `kind` the right prop name for `<Switch>`?**~~ Moot: `<Switch>`
   shipped as `<Switch>`/`<Match>` with no `kind` prop (section 5.4).
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

   **Decided (2026-09-24): no keyed list for now.** `onUpdate` has since
   landed, so the fourth condition holds, but the other three do not.

## 11. Parked ideas and settled questions (handoff)

Recorded so a later session neither loses them nor re-litigates them. None is
scheduled; each names what would justify picking it up.

**Parked: pick up only when something needs it.**

1. **A `range(length)` helper for lists addressed only by index.** Today the
   idiom is a two-member source, `items={{ length: () => n, at: (i) => i }}`
   (documented on `ListSource` in `list.ts`). A helper would shorten it
   without weakening the type check. Trigger: the idiom appears in several
   views.
2. **A lint rule against calling the item accessor while building.** A
   `children` function must call `item()` only inside bindings and methods,
   because a slot may be empty when it is built (section 7.7). Nothing checks
   this mechanically. Trigger: the mistake happens in practice.
3. **Merging `<List>`'s per-slot presence check into the item view's method.**
   Each slot's wrapper calls the item view's own `onRefresh`: one extra call
   per slot per frame, likely a few nanoseconds. Unmeasured. Trigger: a
   profile of a large list shows it, measured one design per process as
   [the performance docs proposal](./010-performance-docs-proposal.md)
   section 4.1 requires.
4. **A typed `matchOn<T>()` factory for `case`-style matching.** The
   subject-value form of `<Switch>` was rejected because nothing could check a
   `case` against the subject's type (section 5.4). A factory such as
   `const EnemyMatch = matchOn<EnemyKind>()`, returning a `<Match>` whose
   `case` is typed `EnemyKind`, would restore the check at the cost of a
   declaration per union. Trigger: a real view wants `case` brevity.

**Settled: do not revisit without new information.**

5. **Children receive an item accessor, not the item.** A slot's `children()`
   runs once, and a closure keeps the value it was given, while the slot's
   occupant keeps changing (splices, reorders, `SlotList` reuse). Inert
   construction does not change this: it moves when bindings first run, not
   what they capture. Every way of passing a plain value was examined and
   rejected:
   - A permanent stand-in object whose properties read the current item: it
     lies about identity (`model.collect(item)` receives the stand-in), needs
     a fixed item shape, and cannot represent primitives.
   - A build-time rewrite of `item` to `item()`: it stops working silently
     when the children function is moved or wrapped, and adds a compiler step.
   - Permanent `Slot<T>` objects with a generation counter: they reintroduce
     the ABA problem `SlotList` exists to prevent (Scramble's `baseSlot` and
     the ordered-list demo both rely on fresh slot identity).
   - Rebuilding a slot when its occupant changes: that is a keyed list
     (question 5).
6. **`ListSource.at` stays required.** Every function has a numeric `length`
   (its arity), so with `at` optional, any function would type-check as a
   source and `items={() => model.count}` would compile and render nothing.
7. **`ListSource.length` is resolved once per frame, not normalised at
   construction.** A getter-form `items` can change which source, and so which
   kind of `length`, from frame to frame; and the check is one `typeof` per
   frame, not per slot.
