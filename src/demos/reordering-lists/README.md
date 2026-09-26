# Reordering lists

One row of cards, held two ways: as a plain array and as an
`OrderedSlotList`. A script mutates both identically every 1.5 seconds (sort,
move, insert, remove, append), and tapping a card moves it to the front of
both. Each row is rendered by the same index-addressed `<List>`.

- **Top row: plain array, state kept per card id.** Reorders and inserts
  slide. A removed card vanishes, and the cards after it slide over its gap.
- **Bottom row: `OrderedSlotList`, state kept per storage slot.** Reorders and
  inserts slide, and a removed card fades and rises where it stood while the
  others close the gap.

## What it shows

**A reorder does no structural work.** `<List>` has no notion of item
identity: slot `N` renders whatever its source holds at `N`, re-read every
frame. Nothing is rebuilt, moved or destroyed; a list slot is only built or
detached when the length changes.

**Presentation state must be kept where it follows the card.** Each card eases
toward its position and fades in when it enters. That state cannot live with
the list slot, because in the array a card moves between indices. The two rows
keep it in the two places that do follow the card:

| | Plain array | `OrderedSlotList` |
| --- | --- | --- |
| Card identity | A dense id the model mints | The storage slot, stable for the card's lifetime |
| State stored by | Card id, republished per index each frame | Storage index, read directly by the `<List>` slot |
| New card noticed by | Not seen last frame | A different slot object in the storage slot |
| Position | Array index | `slot.ordinal` |
| Removed card | Gone at once | Keeps its slot for `releaseDelayMs`, no longer live |

In both, the slide is not an animation anyone wrote. After a reorder each card
is easing toward a different target, so it travels there.

**Exits need the model to keep the item.** An emptied list slot hides at once,
so a view can only animate a removal if the item is still there to render.
The `OrderedSlotList` keeps it for a release delay; the plain array cannot.

**Why the state is stored in arrays.** `update()` is a hot path, the same as
`refresh()`. A `Map<id, state>` would cost one hash lookup per card per frame.
Dense ids and storage indices both make the lookup an array index.

## Files

| File | Purpose |
|------|---------|
| [`card-row-model.ts`](./card-row-model.ts) | Domain: the row in both forms, the script, and move-to-front |
| [`array-row-view-model.ts`](./array-row-view-model.ts) | Presentation state for the array row, keyed by card id |
| [`slot-row-view-model.ts`](./slot-row-view-model.ts) | Presentation state for the `OrderedSlotList` row, keyed by storage index |
| [`card-row-view.tsx`](./card-row-view.tsx) | Both rows, and the card view they share |
| `*.test.ts` | Both forms stay in step; slide, entrance and exit behaviour of each view model |

See [the `<List>` patterns guide](../../pixi-jsx/list-patterns.md) for how to
apply both approaches, and
[the `SlotList` proposal](../../../notes/archive/005-slot-list-proposal.md)
(sections 5.2 and 6) for why `OrderedSlotList` exists.
