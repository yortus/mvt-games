# Working with `<List>`

> How to express common list shapes with an index-addressed `<List>`: fixed
> lists and grids, bullet layers and particle pools, lists that grow and
> shrink, lists whose items carry presentation state, and items whose shape
> varies. Each section gives the shape, a short example, and the cost.

**Related:** [Proposal](./004-list-proposal.md) - the design and its rationale.
[Demo](../src/demos/list-swap/README.md) - a runnable reordering example.
[the `SlotList` proposal](./005-slot-list-proposal.md) - the model-side
collection these patterns project.

---

## The model in one paragraph

`<List length={...}>` is told only how many items there are. Slot `N` renders
whatever the model holds at index `N`, and re-reads it every frame. Slots are
built once per index and retained forever; on shrink they are detached, not
destroyed. The list never inspects an item, never compares identities, and does
no structural work while the length is unchanged.

---

## The two rules

Everything in this guide follows from these.

**Rule 1. Nothing item-dependent may be captured at construction.**

Slot `i` will later hold a different item, and anything captured when the slot
was built will not update.

```tsx
// Wrong: the seed is baked in when the slot is built.
{(index) => <graphics ref={(g) => drawAsteroid(g, model.getRock(index).seed)} />}

// Right: the view redraws when its slot's occupant changes.
{(index) => <AsteroidShape getSeed={() => model.getRock(index).seed} />}
```

Values derived from `index` alone are constants and are fine to capture,
because `index` never changes for a slot. Values derived from the *item* are
not.

**Rule 2. Presentation state that must follow an item belongs in a view model,
keyed by item id.**

State held in a slot's closure follows the slot. If the list can reorder, that
is the wrong thing for it to follow. See
[Lists whose items carry presentation state](#lists-whose-items-carry-presentation-state).

---

## Pick the shape first

| Your list | Shape | Section |
| --- | --- | --- |
| Tilemap, board, hotbar, settings rows | Fixed length | [Fixed lists and grids](#fixed-lists-and-grids) |
| Bullets, particles, debris, explosions | Fixed pool, model tombstones | [Bullet layers and pools](#bullet-layers-and-pools) |
| Loot drops, enemy waves, tower creeps | Grows and shrinks | [Lists that grow and shrink](#lists-that-grow-and-shrink) |
| Card hand, inventory, leaderboard, kanban | Reorders, items carry state | [Items carrying presentation state](#lists-whose-items-carry-presentation-state) |
| Mixed enemy types, mixed menu rows | Shape varies per slot | [Items whose shape varies](#items-whose-shape-varies) |
| Long scrolling list, chat backlog | Windowed | [Windowed lists](#windowed-lists) |
| Nav overlay, selection rings, filtered results | Re-derived each frame | [Re-derived lists](#re-derived-lists) |

The axis that predicts behaviour is the mutation shape, not whether the list is
game-like or UI-like.

---

## Fixed lists and grids

The best case. The length getter returns a constant, so the list does one
comparison per frame and never touches structure after the first.

A grid is a fixed list with an index-to-cell mapping. Derive `row` and `col`
once, because `index` is constant for a slot:

```tsx
<List length={() => GRID_ROWS * GRID_COLS}>
    {(index) => {
        // Constants: derived from index, which never changes for this slot.
        const row = (index / GRID_COLS) | 0;
        const col = index % GRID_COLS;

        return (
            <sprite
                texture={() => tileTexture(model.getCell(row, col).kind)}
                x={col * CELL_PX}
                y={row * CELL_PX}
            />
        );
    }}
</List>
```

`x` and `y` are static values here, applied once, because the layout is fixed.
Only the texture is a getter.

**Resizing a grid** (a level change) is just a length change. Slots up to the
old high-water mark are reused; only genuinely new indices are built.

**Cost:** one call and one comparison per frame for the list, plus the item
refreshes.

---

## Bullet layers and pools

High churn, homogeneous items, potentially thousands of them. The shape is a
[`SlotList`](./005-slot-list-proposal.md) in the model, and the view is
a projection of it with no guard of any kind:

```tsx
<List length={() => bullets.slotCount} item={(i) => bullets.at(i)}>
    {(slot) => (
        <sprite
            texture={bulletTexture}
            anchor={0.5}
            x={() => slot().value.x}
            y={() => slot().value.y}
        />
    )}
</List>
```

The model inserts into a free slot and removes when the bullet expires. Slot
views are built once and never destroyed.

### Empty slots cost one check, not one per binding

`<List>` owns slot visibility. It hides any slot whose `item(i)` is
`undefined`, and an empty slot returns `SKIP_DESCENDANTS`, so the refresh pass
skips its subtree and **the bindings above do not run for an empty slot.** That
is also why `slot()` needs no null check: it is only called while the slot is
occupied.

An empty slot therefore costs one `item(i)` lookup and one presence check per
frame, whatever the item view contains. The saving grows with the size of the
item view rather than staying flat.

This replaces two older patterns. A per-element guard prop is unnecessary,
because the list guards once for the whole slot. And a hand-written leaf view,
which used to be the only way to share an early-out across props, buys nothing
here any more.

::: info
This depends on `onRefresh` and the `SKIP_DESCENDANTS` sentinel. Before that
landed, a hidden subtree still refreshed, and every binding needed its own
guard.
:::

---

## Lists that grow and shrink

When capacity genuinely varies, let the length follow a live count and keep the
live items packed at the front of the model's array.

```tsx
<List length={() => model.liveCreepCount}>
    {(index) => (
        <CreepView
            getX={() => model.getCreep(index).x}
            getY={() => model.getCreep(index).y}
        />
    )}
</List>
```

The model's removal policy decides how much slot meaning churns:

| Removal policy | Slots that change occupant | Use when |
| --- | --- | --- |
| Tombstone (`isActive = false`) | none | High churn. Prefer this |
| Swap-remove (`a[i] = a[last]; a.pop()`) | two | Order does not matter |
| Splice | every slot after `i` | Order matters and the list is short |

Under a pull model all three render correctly, because every binding re-reads.
The difference is only how many slots change meaning, which matters when slots
carry presentation state.

**Exit animations belong in the model.** A detached slot vanishes instantly.
If an item should fade out, keep it in the model array with a `dying` timer and
let the view read that. Under architecture rule 1 the model owns time, so an
exit animation was never the view's to own.

---

## Lists whose items carry presentation state

This is the case reconciliation is usually invoked for. Here it is handled by
keeping identity out of the scene graph and putting it in data instead. Note
that a keyed reconciler would preserve each item's node across a reorder but
not its position, so the easing state below is needed under either design.

Take a list with a `swap(a, b)`, where each item eases toward its slot and
pulses on arrival. If that state lives in the slot's closure it follows the
slot, and a swap cannot move anything: the slot's eased position is already
exactly where the slot is. Keyed to the item, each item is simply easing toward
a different target after the swap, so it slides there.

```ts
// Cosmetic state per item, indexed by dense integer id. `update()` is a hot
// path, so this is an array index and never a hash lookup.
const cosmetics: TileCosmetic[] = [];

// Republished per slot each frame, so every view binding is one array read.
const slotX: number[] = [];

function update(deltaMs: number): void {
    const count = options.getTileCount();
    const ease = 1 - Math.exp(-EASE_RATE * deltaMs / 1000);

    for (let i = 0; i < count; i++) {
        const id = options.getTileId(i);
        let cosmetic = cosmetics[id];
        if (cosmetic === undefined) {
            // Seed at the target so a new item does not slide in from nowhere.
            cosmetic = { x: slotTargetX(i), pulse: 0, slot: i };
            cosmetics[id] = cosmetic;
        }

        // Local, opt-in slot-change detection: one comparison, and the only
        // thing about the reorder the list itself does not know.
        if (cosmetic.slot !== i) {
            cosmetic.slot = i;
            cosmetic.pulse = 1;
        }

        cosmetic.x += (slotTargetX(i) - cosmetic.x) * ease;
        slotX[i] = cosmetic.x;
    }
}

function getX(index: number): number {
    return slotX[index];
}
```

The view is then ordinary:

```tsx
<List length={() => model.tileCount}>
    {(index) => (
        <container x={() => vm.getX(index)} scale={() => vm.getScale(index)}>
            <graphics ref={drawTileFace} />
            <text text={() => model.getTile(index).label} x={17} y={10} style={TILE_STYLE} />
        </container>
    )}
</List>
```

Three things make this work:

- **Dense integer ids.** The model mints them, so the cosmetic store is an
  array. `update()` runs every tick, so a `Map` would put a hash lookup on the
  hot path for every item, every frame.
- **Per-slot republication.** `update()` resolves identity once per item and
  writes into dense arrays. The view's bindings then cost one array index each,
  however many bindings an item has.
- **Nothing detects the swap.** The slide falls out of the targets changing.

`cactii/views/board-view/pieces-view-model.ts` is the production example, and
`src/demos/list-swap/` is the minimal one.

### Drag and drop

Lift the dragged item out of the list and draw it separately, and bind the rest
of the gesture to the container, not the slot:

- `pointerdown` on the slot, because `index` is correct at the one instant that
  handler runs.
- `globalpointermove` and `pointerup` on the root, because the container under
  the cursor changes meaning as the list reorders.

The slot the item came from renders as a gap. This is how drag and drop is
built regardless of framework, so the constraint costs nothing.

---

## Items whose shape varies

Index addressing cannot vary a slot's structure. Use `<Switch>` inside the
slot, which scopes any rebuild to the one slot whose kind changed:

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

Branches are built on first selection and retained, so alternating between them
is free after warm-up. `cases` must cover every member of the union `kind()`
returns; TypeScript enforces that.

For two or three variants that alternate rapidly, build all of them in the slot
and toggle `visible` instead. That avoids the instruction rebuild a structural
change triggers.

---

## Windowed lists

A long scrolling list renders a constant number of slots over a sliding offset.
This is one of the best cases for index addressing: the length never changes,
so there is no structural work at all while scrolling.

```tsx
<List length={() => VISIBLE_ROWS}>
    {(index) => (
        <text
            text={() => model.getRow(model.scrollRow + index).label}
            y={index * ROW_HEIGHT_PX}
            style={ROW_STYLE}
        />
    )}
</List>
```

Guard the accessor in the model so an offset near the end returns a blank row
rather than reading past the array.

---

## Re-derived lists

A nav overlay, selection rings, or a filtered result set recomputed each frame
produces all-new object identities every frame. Index addressing does not care:
only the length matters, so the list does nothing on frames where the count is
stable.

Keep the count getter allocation-free. This is a hot path:

```ts
// Wrong: allocates an array every frame.
length={() => items.filter((x) => x.isVisible).length}

// Right: the model maintains the count as it mutates.
length={() => model.visibleCount}
```

---

## Common mistakes

| Mistake | Why it breaks | Instead |
| --- | --- | --- |
| Capturing item data when the slot is built | The slot's occupant changes later | Make it a getter (rule 1) |
| Holding per-item cosmetic state in the slot closure | It follows the slot, not the item | View model keyed by item id (rule 2) |
| `Map<id, state>` for that store | `update()` is a hot path | Array indexed by a dense integer id |
| Guarding each binding in a slot | `<List>` already hides empty slots, and an empty slot skips its subtree via `SKIP_DESCENDANTS` | Let the list do it. `slot()` is only called while occupied |
| Detaching a subtree to stop it refreshing | A structural change invalidates the memoised traversal | `visible={...}`, whose codegen returns `SKIP_DESCENDANTS` and invalidates nothing |
| An allocating `length` getter | Runs every frame | Have the model maintain the count |
| Expecting an exit animation from a removed item | Detached slots vanish instantly | Keep the item in the model with a `dying` timer |
| Reading `items[index]` in a slot beyond the current length | Out of range | Fixed-capacity pool, or rely on detachment |
