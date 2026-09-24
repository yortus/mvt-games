# Reordering without reconciliation

Two rows of tiles driven by one model whose only mutation is `swap(a, b)`.
Both rows use the same index-addressed `<List>`. They differ in one line: what
their presentation state is attached to.

- **Top row (`keyBy: 'slot'`)** - state is attached to list position. A slot's
  eased position is already sitting exactly where that slot is, so a swap
  cannot move anything. The labels jump and nothing animates.
- **Bottom row (`keyBy: 'item'`)** - state is attached to tile id. After a swap
  each tile is easing toward a different slot, so the tiles slide past each
  other and pulse on arrival.

Tap a tile to swap it with the one to its right. Pairs also swap on a timer.

## What it shows

The list has no notion of item identity. `<List items={model.tiles}>` reads the
model's tile array; slot `N` renders whatever the array holds at index `N`
and re-reads it every frame. A swap rebuilds nothing, moves nothing and
destroys nothing - the list does no structural work at all, because the length
never changed.

Per-item presentation state lives in a view model, keyed by item id, rather
than in the slot's closure. A keyed reconciler would have preserved each slot's
node across the swap, but not its position, so the easing state below would be
needed either way:

```ts
// Cosmetic state, indexed by dense integer key. Array index, not a hash
// lookup, because this is read once per tile per frame.
const cosmetics: TileCosmetic[] = [];

// Local, opt-in slot-change detection: one comparison, and the only thing
// about the reorder the list itself does not know.
if (cosmetic.slot !== i) {
    cosmetic.slot = i;
    cosmetic.pulse = 1;
}

cosmetic.x += (i * targetBase - cosmetic.x) * ease;
```

The slide is not an animation anyone wrote. After a swap each tile is simply
easing toward a different target, so it travels there.

## Why the cosmetic store is an array

`update()` is a hot path, the same as `refresh()`. A `Map<id, state>` would
cost one hash lookup per item per frame. The model mints dense integer ids, so
the store is a plain array and the lookup is an array index.

## Files

| File | Purpose |
|------|---------|
| [`swap-model.ts`](./swap-model.ts) | Domain: an ordered list and `swap(a, b)` |
| [`swap-view-model.ts`](./swap-view-model.ts) | Presentation state, keyed by slot or by item id |
| [`swap-view.tsx`](./swap-view.tsx) | Both rows, built from one `tileRow` helper |
| [`swap-view-model.test.ts`](./swap-view-model.test.ts) | Slide and pulse under item keying, neither under slot keying |

The `<List>` itself is the shipping one in
[`src/pixi-jsx/list.ts`](../../pixi-jsx/list.ts). See
[the proposal](../../../proposals/004-list-proposal.md) for the design and
[the patterns guide](../../../proposals/006-list-patterns.md) for how to apply it.
