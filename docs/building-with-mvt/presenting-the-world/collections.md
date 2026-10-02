# Presenting Collections

> Games show many things of the same kind at once: bullets, enemies, tiles,
> cards. This page shows how a view presents a collection like that with
> `<List>`, which gives each item a view and reuses those views as items come,
> go and move. It then works through common kinds of collection, from fixed
> grids to lists that reorder, each with an example and what it costs.

**Related:** [Views](views.md) · [View Composition](view-composition.md) ·
[Bindings in Depth](bindings-in-depth.md) ·
[Presentation State](../adding-visual-polish/presentation-state.md)

---

*Assumes familiarity with [Views](views.md), including
[writing the body in JSX](views.md#writing-the-body-in-jsx).*

## Why a List Needs Care

A view of one bullet is simple. A view of every bullet on screen has to keep
up with a collection that changes: bullets are fired and expire, enemies
spawn and die, cards are shuffled. The obvious approach, building a child view
for each new item and destroying it when the item goes, is costly when items
come and go every frame, and easy to get wrong when they move.

`<List>` takes a different approach. It keeps one child view per position in
the collection and reuses it: each frame, the view at position 3 shows
whatever item is at position 3 now. Views are built only when the collection
grows longer than it has been before, and are kept for as long as the list is.

## How `<List>` Works

```tsx
<List items={model.bullets}>
    {(bullet) => <BulletView x={() => bullet().x} y={() => bullet().y} />}
</List>
```

- **`items` is the collection to present**, and the `(bullet) => ...` function
  builds the view for one position. It is called once per position, the first
  time the collection is that long.
- **Each position is a slot.** The function receives an accessor, `bullet()`,
  rather than a bullet, because the item in a slot can change from one frame
  to the next. The accessor always returns the slot's current item.
- **An empty slot hides itself.** If the collection has no item at a position
  (`bullet() === undefined`), that slot's view is hidden, and none of its bindings run.
- **A shrinking list keeps its views.** Slots past the end are set aside, and
  put back when the list grows again.
- **Nothing is compared or rearranged.** When items move, each slot simply
  shows a different item. The list does no work of its own while the
  collection's length stays the same.

`items` can be anything with a `length` and an `at(index)`: an array, the
`slots` of a `SlotList`, the `slots` or `ordered` of an `OrderedSlotList` (both
from `@mvtjs/utils`), or an object literal such as
`{ length: () => model.count, at: (i) => model.enemyAt(i) }`. Pass the
collection itself when the model changes it in place, which is how models in
this project own their collections. Pass a function returning it
(`items={() => model.stars}`) when the model replaces it with a new one.

`List` is a view function like any other, so a view with a plain TypeScript
body can call it too: `List({ items: model.bullets.slots, children: (slot) => BulletView({ ... }) })`.

## Two Rules for Item Views

Because a slot's view is reused for whatever item is in the slot, an item
view has to follow two rules.

**Rule 1. Nothing item-dependent may be captured at construction.**

Slot `i` will later hold a different item, and anything captured when the slot
was built will not update.

```tsx
// Wrong: the seed is baked in when the slot is built.
{(rock) => <graphics ref={(g) => drawAsteroid(g, rock().seed)} />}

// Right: the view redraws when its slot's occupant changes.
{(rock) => <AsteroidShape seed={() => rock().seed} />}
```

Values derived from `index` alone are constants and are fine to capture,
because `index` never changes for a slot. Values derived from the *item* are
not.

Reading the item while the view is being built is fine, to set it up: a slot's
view is built the first time the slot holds an item, and `rock()` returns that
item. What the rule forbids is relying on it afterwards. Whatever the view
reads at construction, it must also follow when refreshing.

**Rule 2. Presentation state that belongs to an item must be keyed to the
item, not held by its slot.**

State kept in a slot's view stays with the slot. That is fine while each item
keeps its slot for its lifetime, as in a `SlotList`, provided the view resets
the state when a new item arrives. When items can move between slots, as in a
list that reorders or packs its items to the front, store the state by the
item's identity instead: an id the model gives each item, or a `SlotList`'s
storage index. A [view model](../adding-visual-polish/presentation-state.md)
is a natural home for that store when its logic deserves its own tests, but
the rule is about the key, not where the store lives. See
[Lists whose items carry presentation state](#lists-whose-items-carry-presentation-state).

## Which Kind of Collection Is It?

| Your list | How it behaves | Section |
| --- | --- | --- |
| Tilemap, board, hotbar, settings rows | Fixed length | [Fixed lists and grids](#fixed-lists-and-grids) |
| Bullets, particles, debris, explosions | Fixed pool; expired items leave gaps | [Bullet layers and pools](#bullet-layers-and-pools) |
| Loot drops, enemy waves, tower creeps | Grows and shrinks | [Lists that grow and shrink](#lists-that-grow-and-shrink) |
| Card hand, inventory, leaderboard, kanban | Reorders, items carry state | [Items carrying presentation state](#lists-whose-items-carry-presentation-state) |
| Mixed enemy types, mixed menu rows | Items of different kinds | [Items of different kinds](#items-of-different-kinds) |
| Long scrolling list, chat backlog | Windowed | [Windowed lists](#windowed-lists) |
| Nav overlay, selection rings, filtered results | Re-derived each frame | [Re-derived lists](#re-derived-lists) |

What matters is how the collection changes, not whether it belongs to a game
or a menu.

## Fixed Lists and Grids

The best case. The length is constant, so the list does one comparison per
frame and never touches structure after the first.

A grid is a fixed list with an index-to-cell mapping. Project the model's
row-major cell array, and derive `row` and `col` once, because `index` is
constant for a slot:

```tsx
<List items={model.cells}>
    {(cell, index) => {
        // Constants: derived from index, which never changes for this slot.
        const row = (index / GRID_COLS) | 0;
        const col = index % GRID_COLS;

        return (
            <sprite
                texture={() => tileTexture(cell().kind)}
                x={col * CELL_PX}
                y={row * CELL_PX}
            />
        );
    }}
</List>
```

`x` and `y` are plain values here, set once, because the layout is fixed.
Only the texture is a function.

**Resizing a grid** (a level change) is just a length change. Slots up to the
old high-water mark are reused; only genuinely new indices are built.

**Cost:** one call and one comparison per frame for the list, plus the item
refreshes.

## Bullet Layers and Pools

Items that come and go constantly, all of one kind, potentially thousands of
them. The model holds them in a `SlotList`, and the view is a projection of it with no guard of
any kind:

```tsx
<List items={model.bullets.slots}>
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

The model inserts into a free slot and removes when the bullet expires. A
slot's view is built the first time the slot holds a bullet, and never
destroyed.

### Empty slots cost one check, not one per binding

`<List>` owns slot visibility. It hides any slot whose `at(i)` is
`undefined`, and an empty slot returns `SKIP_DESCENDANTS`, so the refresh scene pass
skips its subtree and **the bindings above do not run for an empty slot.** That
is also why `slot()` needs no null check: it is only called while the slot is
occupied.

An empty slot therefore costs one `at(i)` lookup and one presence check per
frame, whatever the item view contains. Item views need no presence binding
of their own: Scramble's bullets, bombs, rockets and explosions are each a
`<List>` over a `SlotList`, and their views have only position bindings.

## Lists that Grow and Shrink

When capacity genuinely varies, let the length follow a changing count and keep the
live items packed at the front of the model's array.

```tsx
<List items={model.creeps}>
    {(creep) => <CreepView x={() => creep().x} y={() => creep().y} />}
</List>
```

How the model removes an item decides how many slots change item:

| Removal policy | Slots that change occupant | Use when |
| --- | --- | --- |
| Mark it inactive (`isActive = false`) | none | Items come and go often. Prefer this |
| Swap-remove (`a[i] = a[last]; a.pop()`) | two | Order does not matter |
| Splice | every slot after `i` | Order matters and the list is short |

Under a pull model all three render correctly, because every binding re-reads.
The difference is only how many slots change meaning, which matters when slots
carry presentation state.

**An exit animation needs the item kept around.** An emptied slot hides
instantly, so to animate an item out, something must keep it in the
collection until the animation is done. Either the model keeps it, with a
`dying` timer the view reads, or a `SlotList`'s release delay keeps its slot
while a view model fades it out as
[presentation state](../adding-visual-polish/presentation-state.md). Which to
choose depends on whether anything else in the game cares that the item is
leaving: if so, the model should know; if the fade is purely cosmetic, the view
can own it.

## Lists Whose Items Carry Presentation State

This is the case reconciliation is usually invoked for. Here it is handled by
keeping identity out of the scene graph and putting it in data instead. Note
that a keyed reconciler would preserve each item's node across a reorder but
not its position, so the easing state below is needed under either design.

Take a list with a `swap(a, b)`, where each item eases toward its slot and
pulses on arrival. If that state lives in the slot's closure it follows the
slot, and a swap cannot move anything: the slot's eased position is already
exactly where the slot is. Keyed to the item, each item is simply easing toward
a different target after the swap, so it slides there.

The state lives in a [view model](../adding-visual-polish/presentation-state.md):

```ts
// Cosmetic state per item, indexed by dense integer id. `update()` is a hot
// path, so this is an array index and never a hash lookup.
const cosmetics: TileCosmetic[] = [];

// Republished per slot each frame, so every view binding is one array read.
const slotX: number[] = [];

function update(deltaMs: number): void {
    const count = options.count();
    const ease = 1 - Math.exp(-EASE_RATE * deltaMs / 1000);

    for (let i = 0; i < count; i++) {
        const id = options.idAt(i);
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

function xAt(index: number): number {
    return slotX[index];
}
```

The view is then ordinary:

```tsx
<List items={model.tiles}>
    {(tile, index) => (
        <container x={() => vm.xAt(index)} scale={() => vm.scaleAt(index)}>
            <graphics ref={drawTileFace} />
            <text text={() => tile().label} x={17} y={10} style={TILE_STYLE} />
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

Kwazy Cactii's pieces view model
(`site/src/games/cactii/views/board-view/pieces-view-model.ts`) is the production
example.

### Keyed by storage index: `OrderedSlotList`

A list with an order of its own, such as a sortable table, a card hand or a
toast stack, can instead be held in an `OrderedSlotList`, with `<List>`
projecting its `slots` rather than its `ordered`. Each item keeps its storage
slot for its whole lifetime and carries its position as `slot.ordinal`, so the
storage index already is the item's identity:

```ts
// Cosmetic state per storage slot, indexed as `slots` is, one per slot.
const cosmetics: SlotCosmetic[] = [];

function update(deltaMs: number): void {
    const ease = 1 - Math.exp(-deltaMs / SMOOTH_MS);
    for (let i = 0; i < slots.length; i++) {
        const slot = slots.at(i);
        if (slot === undefined) continue;

        // A different slot object means a new item: start afresh, not from
        // wherever the slot's last item was.
        const cosmetic = cosmetics[i];
        if (cosmetic.owner !== slot) resetCosmetic(cosmetic, slot);

        if (slot.isLive) cosmetic.x += (slot.ordinal * PITCH - cosmetic.x) * ease;
        else cosmetic.alpha += (0 - cosmetic.alpha) * ease; // removed: fade out
    }
}
```

Compared with the array form:

- **No ids.** The model mints nothing, and one reference comparison per slot
  notices a new item.
- **No republication.** `<List>` slot `i` is storage slot `i`, so the view's
  bindings read `cosmetics[index]` directly.
- **Exits.** A removed item leaves the order at once, so the rest close the
  gap, but keeps its slot, no longer live, for the list's `releaseDelayMs`. Its
  view is still there to animate out. From a plain array, a removed item is
  simply gone.

The [reordering-lists demo](https://github.com/yortus/mvt-games/blob/main/site/src/demos/reordering-lists/README.md)
runs both forms side by side, driven by the same script.

### Drag and drop

Lift the dragged item out of the list and draw it separately, and bind the rest
of the gesture to the container, not the slot:

- `pointerdown` on the slot, because `index` is correct at the one instant that
  handler runs.
- `globalpointermove` and `pointerup` on the root, because the container under
  the cursor changes meaning as the list reorders.

The slot the item came from renders as a gap. This is how drag and drop is
built regardless of framework, so the constraint costs nothing.

## Items of Different Kinds

A slot's view is built once, so it cannot become a different kind of view when
a different kind of item arrives. Put a `<Switch>` inside the slot, with one
`<Match>` per kind:

```tsx
<List items={model.enemies}>
    {(enemy) => (
        <Switch>
            <Match when={() => enemy().kind === 'asteroid'}>
                <AsteroidShape seed={() => enemy().seed} />
            </Match>
            <Match when={() => enemy().kind === 'ufo'}>
                <sprite texture={ufoTexture} x={() => enemy().x} y={() => enemy().y} />
            </Match>
        </Switch>
    )}
</List>
```

- **The first `<Match>` whose `when` holds is shown**, or a final
  `<Match else>` if none does. Without one, nothing is shown.
- **Every branch is built up front and kept.** Switching only changes which one
  is visible, so it never restructures the scene, even when a slot's occupant
  changes kind every frame.
- **An unselected branch's bindings never run.** Construction is inert and the
  switch skips unselected branches, so a binding valid only for one kind (a
  UFO's shield, say) is safe to write.
- **Coverage is not checked at compile time.** Nothing tells you a kind has no
  `<Match>`. To make a missing case an error at runtime, give the switch a
  default branch whose child throws; a function child only runs when its
  branch is selected:
  `` <Match else>{() => { throw new Error(`Unhandled kind: ${enemy().kind}`); }}</Match> ``.
- **For a heavy branch in a long list,** building every branch in every slot
  costs memory. Pass a function as the `<Match>` child to build it on first
  selection instead: `<Match when={...}>{() => <HeavyView />}</Match>`.

## Windowed Lists

A long scrolling list renders a constant number of slots over a sliding offset.
This is one of the best cases for `<List>`: the length never changes,
so there is no structural work at all while scrolling.

The source is a two-member object literal, built once. Its `length` is a
constant, and `at` reads through the scroll offset:

```tsx
const visibleRows: ListSource<Row> = {
    length: VISIBLE_ROWS,
    at: (i) => model.rows.at(model.scrollRow + i),
};

<List items={visibleRows}>
    {(row, index) => (
        <text text={() => row().label} y={index * ROW_HEIGHT_PX} style={ROW_STYLE} />
    )}
</List>
```

Near the end of the data, `at` returns `undefined` for rows past the last one,
so those slots hide themselves. No guard is needed in the model.

The same trick covers a count with nothing to project: a source whose `at`
returns its index shows one slot per unit. Scramble's HUD draws its lives this
way, with `{ length: bindings.lives, at: (i) => i }`.

## Re-derived Lists

A nav overlay, selection rings, or a filtered result set recomputed each frame
produces all-new objects every frame. `<List>` does not care:
only the length matters structurally, so the list does nothing on frames where
the count is stable.

Keep an `items` getter allocation-free. It runs every frame:

```tsx
// Wrong: allocates a new array every frame.
<List items={() => model.items.filter((x) => x.isVisible)}>

// Right: the model maintains the derived collection as it mutates.
<List items={model.visibleItems}>
```

## Common Mistakes

| Mistake | Why it breaks | Instead |
| --- | --- | --- |
| Capturing item data when the slot is built | The slot's occupant changes later | Make it a getter (rule 1) |
| Holding per-item cosmetic state in the slot's view when items move between slots | It follows the slot, not the item | A store keyed by item id, or by storage index for a `SlotList` (rule 2) |
| `Map<id, state>` for that store | `update()` is a hot path | Array indexed by a dense integer id |
| Guarding each binding in a slot | `<List>` already hides empty slots, and an empty slot skips its subtree via `SKIP_DESCENDANTS` | Let the list do it. `slot()` is only called while occupied |
| Detaching a subtree to stop it refreshing | A structural change invalidates the memoised traversal | `visible={...}`, which returns `SKIP_DESCENDANTS` and invalidates nothing |
| An allocating `items` getter | Runs every frame | Have the model maintain the collection |
| Passing a value for a collection the model replaces | The list keeps reading the old one | Pass a function: `items={() => model.stars}` |
| Expecting an exit animation from a removed item | Emptied slots hide instantly | Keep the item around: in the model with a `dying` timer, or with a `SlotList` release delay while a view model fades it |
| Reading the model by `index` in a slot beyond the current length | Out of range | Read through the item accessor, which only runs while the slot is occupied |
