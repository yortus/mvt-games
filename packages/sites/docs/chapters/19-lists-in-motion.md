# Lists in Motion

> When the items in a list slide into place, fade in as they arrive and
> fade out as they go, each item carries presentation state that the model
> doesn't track. A `<List>` slot shows whatever item is at its position,
> so that state has to be stored by the item, not by the slot. And a
> removed item has to stay around until it has finished leaving. Store the
> state by the item, and keep the item until its exit is done, and the
> slide happens without extra code: each item just eases toward wherever
> it now belongs.

**Related:** [Lists and Switches](14-lists-and-switches.md) ·
[Presentation State](11-presentation-state.md) ·
[Growing a Complex View](18-growing-a-complex-view.md) ·
[Hot Paths](24-hot-paths.md)

Here's a hand of cards. The model holds the hand as an array, and each
card view eases its own `x` toward its place in the row, and fades itself
in when it's built:

```tsx
<List items={model.hand}>
    {(card, index) => (
        <CardView label={() => card().label} targetX={index * PITCH} />
    )}
</List>
```

The player has five cards and plays the middle one, so the model splices
it out of the array. You'd like the played card to fade out where it
stood, and the two cards to its right to slide left to close the gap.
Here's what you see instead:

- The played card doesn't fade. Its label simply changes to the next
  card's.
- The two cards to its right don't slide. Each one jumps one place to the
  left.
- The card at the right end vanishes.

The cards don't animate at all, and you can't point to a bug in the code.
Each part is doing exactly what [Chapter 14](14-lists-and-switches.md) said it
would.

## Why the Cards Don't Slide or Fade

Follow the cards through the splice. Before it, slot 2 shows card C, slot 3
shows card D, and slot 4 shows card E. After it, the array is one shorter,
so this happens on the next frame:

1. Slot 2 now shows card D. The slot's view is the same view, and its eased
   `x` is already at slot 2's place, so D appears there at once. The
   view's code doesn't detect that its card changed.
2. Slot 3 now shows card E, in the same way.
3. Slot 4 is past the end of the array, so the list takes its view out of
   the tree. That's the view that was showing E, and it's removed without
   fading.
4. Card C isn't in any slot, so the list doesn't have a view to draw it
   fading out.

There are two problems here, and they need two fixes:

- **The presentation state follows the slot, not the card.** The eased `x`
  and the fade belong to a card, but they're kept in a slot's view, and a
  slot changes card. This is rule 2 of Chapter 14.
- **A removed card doesn't have a view to draw it.** The moment it leaves
  the model's collection, the slots stop holding it.

[§](#try-hand-state-in-slots) runs that hand, with each card's state kept
in its slot's view. A second after the example starts, it plays the
middle card, C.
Click a card to play it, and press Deal to add one. A dealt card fades in
only when its slot is new, since a slot that shows a card again kept its
old view.

<TryIt example="hand-state-in-slots" file="views/card-view.tsx" />

## Keep a Removed Item Until It Has Gone

An emptied slot hides at once, so to animate an item out, something has to
keep it in the collection until the animation is done. There are two
places that can do it.

**The model can keep it.** It marks the item as leaving, with a timer, and
removes it when the timer runs out. The view reads the timer's progress,
and fades the item as it rises. Choose this when the game's rules depend
on the item leaving: a card that can't be played again while it fades, or
an enemy that still blocks a shot while it explodes.

**A slot list can keep it,** for its release delay, as
[Chapter 4](04-models.md#collections-of-models) shows. Choose this when
the exit is purely cosmetic. While the slot lingers, `slot.isLive` is
`false`, but the slot and its value are still there for the view to draw,
so the view can tell a leaving item from a live one. The model sets how
long the item lingers, and the view decides what happens during that
time.

Fuel Run uses this for its explosions, in a way you might not expect. It
puts each explosion in its slot list and removes it in the same call, so
the release delay is the explosion's whole life. The slot is never live,
but the explosion's view draws it until it's released.

## Storing State by Item

Rule 2 says to store an item's presentation state by something that moves
with the item. For a list held as a plain array, that's an id that the
model assigns to each item. For a list held in an `OrderedSlotList`, it's
the item's storage slot. Both put the state in a
[view model](18-growing-a-complex-view.md) that the list's parent view
owns, rather than in each slot's view.

### In a plain array: dense ids

The model assigns each card a **dense id**: a small whole number, from 0
up, without large gaps, so it can be used as an index into an array. The view
model keeps each card's state in an array, by id. Once per update, it walks
the hand in order, moves each card's state toward that card's place, and
copies the result into a second set of arrays, by position. The view's
getters then read those, by slot index:

```ts
function createHandViewModel(options: HandViewModelOptions): HandViewModel {
    const { count, idAt } = options;

    // Each card's state, by the card's dense id
    const cosmetics: CardCosmetic[] = [];
    // Each position's state, copied from its card's once per update
    const xAtIndex: number[] = [];
    const alphaAtIndex: number[] = [];
    let frame = 0;
    update(0); // so the first refresh has state to read

    return {
        xAt: (index) => xAtIndex[index],
        alphaAt: (index) => alphaAtIndex[index],
        update,
    };

    function update(deltaMs: number): void {
        frame += 1;
        const n = count();
        const ease = 1 - Math.exp(-deltaMs / SMOOTH_MS);
        for (let i = 0; i < n; i++) {
            const id = idAt(i);
            const targetX = i * PITCH;
            let cosmetic = cosmetics[id];
            if (cosmetic === undefined) {
                cosmetic = { x: targetX, alpha: 0, seenFrame: -1 };
                cosmetics[id] = cosmetic;
            }
            // Not in the hand last frame, so it's arriving: start it in
            // its place, transparent, not wherever it last was
            if (cosmetic.seenFrame !== frame - 1) {
                cosmetic.x = targetX;
                cosmetic.alpha = 0;
            }
            cosmetic.seenFrame = frame;

            cosmetic.x += (targetX - cosmetic.x) * ease;
            cosmetic.alpha += (1 - cosmetic.alpha) * ease;
            xAtIndex[i] = cosmetic.x;
            alphaAtIndex[i] = cosmetic.alpha;
        }
    }
}
```

The `update(0)` call at the start is there because a view's first refresh
can come before its first update, as
[Chapter 11](11-presentation-state.md) explains. The view itself is then
ordinary:

```tsx
const handLayout = createHandViewModel({
    count: () => model.hand.length,
    idAt: (index) => model.hand[index].id,
});

return (
    <container onUpdate={handLayout.update}>
        <List items={model.hand}>
            {(card, index) => (
                <CardView
                    label={() => card().label}
                    x={() => handLayout.xAt(index)}
                    alpha={() => handLayout.alphaAt(index)}
                />
            )}
        </List>
    </container>
);
```

The view model copies the state to each position once per update, so it
looks up each card's id once, and the view's getters each read one array
element by slot index. A card that wasn't seen last frame is arriving, so
it starts in its place, rather than sliding in from wherever its id's
state was left.
[§](#time-and-memory-costs-of-animated-lists) explains why the ids are
dense.

This fixes the sliding. When the middle card is spliced out, cards D and E
are each easing toward a new target, one place to the left, so they slide
there. A plain array can't give you the exit, though. Card C is gone from
the array, so the list doesn't have an item to draw it from, and it
vanishes.

[§](#try-hand-state-by-id) runs the hand with this view model. Watch D and
E slide left into C's place, and C simply vanish.

<TryIt example="hand-state-by-id" file="views/hand-view-model.ts" />

### In an `OrderedSlotList`: storage slots

An `OrderedSlotList`, made with `createOrderedSlotList` from
`@mvtjs/utils`, is a slot list with an order of its own. Each item keeps
its storage slot for its whole life, as in any slot list. It also has an
**ordinal**, its position in the order, which changes as items are moved,
inserted and removed:

```ts
const hand = createOrderedSlotList<Card>({ releaseDelayMs: EXIT_MS });

hand.append(card);     // at the end of the order
hand.move(0, 3);       // the first card moves to fourth place
hand.remove(slot);     // leaves the order now, keeps its slot for EXIT_MS
```

It has two collections that a view can show. `hand.ordered` lists the
live items in
order. `hand.slots` lists the storage slots, in storage order, including
removed items that are waiting to be released. Show `slots` with `<List>`,
and each list slot is one storage slot, which keeps its item for that
item's whole life. The storage index already is the item's identity, so
the view model stores the state by it:

```ts
function update(deltaMs: number): void {
    const ease = 1 - Math.exp(-deltaMs / SMOOTH_MS);
    for (let i = 0; i < slots.length; i++) {
        const slot = slots.at(i);
        if (slot === undefined) continue;
        let cosmetic = cosmetics[i];
        if (cosmetic === undefined) {
            cosmetic = { owner: undefined, x: 0, alpha: 0 };
            cosmetics[i] = cosmetic;
        }
        // A different slot object means a new card in this storage slot
        if (cosmetic.owner !== slot) {
            cosmetic.owner = slot;
            cosmetic.x = Math.max(slot.ordinal, 0) * PITCH;
            cosmetic.alpha = 0;
        }

        if (slot.isLive) {
            cosmetic.x += (slot.ordinal * PITCH - cosmetic.x) * ease;
            cosmetic.alpha += (1 - cosmetic.alpha) * ease;
        }
        else {
            // Removed, waiting for release: fade out where it stands
            cosmetic.alpha += (0 - cosmetic.alpha) * ease;
        }
    }
}
```

Compared with the array, this needs less:

- **It doesn't need ids.** The model doesn't add anything to the cards.
  Each new item gets a new slot object, so one comparison per slot detects
  a new card.
- **It doesn't need copying.** List slot `i` is storage slot `i`, so the
  view's getters read `cosmetics[index]` directly.
- **It has an exit.** A removed card leaves the order at once, so the cards
  after it close the gap. But it keeps its storage slot, no longer live, for
  the release delay. Its view is still there, so it fades out where it
  stood.

[§](#try-hand-state-by-slot) is the whole of the hand from the start of
the chapter, working: C fades where it stood, while D and E slide left
over it. Try playing the
card at the left end, and watch the whole row close up as it fades.

<TryIt example="hand-state-by-slot" file="views/hand-view-model.ts" />

### Choosing between them

Use a plain array when the model already holds one, and items don't need
to animate out. Use an `OrderedSlotList` for a small list with an order of
the player's choosing, whose items animate out: a hand of cards, a stack of
messages, a turn order. The
[Reordering Lists](https://github.com/yortus/mvt-games/tree/main/packages/sites/demos/src/entries/reordering-lists)
demo shows both side by side. A script changes both rows in the same way,
and tapping a card moves it to the front of both, so you can watch where
the two differ.

## Sliding Without Extra Code

Notice what the two view models don't do. They don't look for a reorder,
work out which card moved where, or start an animation. After a reorder, each
card is simply easing toward a different target, so it travels there. The
slide falls out of reading the targets afresh each frame.

This is also why a keyed list, as React has, wouldn't save you any work
here. A keyed list keeps each item's view across a reorder, so the view
moves with its item. But it moves the view straight to its new place. To
slide there, the view still needs an eased position, kept over time and
stored with the item. That's the same state as above, whichever kind of
list you use.

## Drag and Drop

Dragging an item to a new place in a list adds one more thing that moves
under you: as the item is dragged across the row, the items under the
pointer change slots. Three habits keep that straight.

- **Start the drag in the slot, and read the item at once.** A
  `pointerdown` handler on a slot's view runs at one instant, when the
  slot's item is the one under the pointer. Read `card()` there, and keep
  what you need, such as the card's id.
- **Follow and finish the drag on the list's container.** As the list
  reorders, the slot under the pointer shows a different item, so a slot's
  `pointermove` or `pointerup` handler can end up acting on the wrong
  card. Put them on the container instead. In Pixi, `globalpointermove`
  reaches it wherever the pointer goes.
- **Draw the dragged item separately.** The dragged item follows the
  pointer, which is presentation state, not the model's position, so the
  view keeps it. Draw the item above the rest, and let the slot it came
  from show as a gap. The model receives only the drop, through a relay
  binding such as `onCardDropped(id, toIndex)`.

```tsx
<container
    onGlobalPointerMove={(e) => drag.moveTo(e.global.x)}
    onPointerUp={() => drag.drop()}
    onPointerUpOutside={() => drag.drop()}
>
    <List items={model.hand} ref={(c) => { c.sortableChildren = true; }}>
        {(card, index) => (
            <CardView
                label={() => card().label}
                x={() => drag.xAt(index)}
                zIndex={() => drag.zIndexAt(index)}
                onPressed={() => drag.pickUp(card().id)}
            />
        )}
    </List>
</container>
```

Here `drag` is a view model that holds the drag. It keeps the dragged
card's id and the pointer's position, returns a raised `zIndex` for the
dragged card, and calls the relay binding when the card is dropped. The list's
`ref` receives the list's own container, which holds the cards, so that's
where Pixi's `sortableChildren` goes. `onPressed` is the card view's relay
binding for a `pointerdown` on the card.

This approach isn't special to `<List>`. Drag and drop is built this way
in most UI frameworks, because in all of them the thing under the pointer
changes as the list moves. Kwazy Cactii's board does the same on a grid
([`pieces-view.ts`](https://github.com/yortus/mvt-games/blob/main/packages/sites/arcade/src/entries/kwazy-cactii/views/board-view/pieces-view.ts)).

## Time and Memory Costs of Animated Lists

The state store adds a little work per item per frame, on a
[hot path](24-hot-paths.md). For a plain array, each card takes one call
to `idAt`, one array lookup, one comparison and a few sums. For an
`OrderedSlotList`, it's one lookup and one comparison. That's why the ids
are dense: the store can be an array, and an array index is far faster
than the hash lookup that a `Map` from id to state would put on that path
for every card, every frame.

Dense ids have a memory cost of their own. The store is as long as the
largest id you've used, so ids must stay small. If the model assigns
every new card a new id forever, the store grows forever. Assign ids from
a fixed set, as a deck of cards has, or reuse the ids of items that are
gone. Reusing is safe here, because a card that wasn't in the hand last
frame is started afresh.

An `OrderedSlotList` is made for small lists. Moving, inserting or removing
an item renumbers the items after it, so each takes time in proportion to
the list's length. A hand of cards is small enough that this doesn't
matter. A list of thousands of items that reorders every frame would be
slow.

A release delay keeps a removed item's slot in use. If the list has a
`maxSlots`, items waiting for release count toward it, so a list can be
full of items that are only fading out.

## Common Mistakes

### Items that jump instead of sliding

Items jump to their new places, and a new item takes over the old one's
fade. This happens when an item's presentation state is kept in its
slot's view, so the state stays with the slot as items move between
slots. Store it by the item instead: by a dense id, or by storage index
in a slot list.

### A removed item that vanishes at once

An emptied slot hides, so a removed item doesn't have a view left to draw
it.
Keep the item until its exit is done: in the model with a timer, or in a
slot list with a release delay.

### A new item that slides in from the last one's place

A new card slides in from where the last one stood, or arrives half
faded. It has picked up the old state left in its slot or under its id.
Detect that the item is new, because it wasn't seen last frame or its
slot object is different, and start it in its place.

### A drag that jumps to another card

Mid-drag, the drag jumps to another card, or drops the wrong one. Its
handlers are on a slot's view, and the slot's item changed as the list
reordered. Start the drag in the slot, then follow and finish it on the
list's container.

## Summary

A `<List>` slot shows whatever item is at its position, so state kept in a
slot's view stays with the slot when items move. To make items slide and
fade, store their presentation state by the item: by a dense id for a list
held as a plain array, or by storage index for a list held in an
`OrderedSlotList`, in arrays that a view model keeps. The slide then
happens without extra code: after a reorder, each item eases toward its
new place.

A removed item can only animate out if something keeps it. The model can
keep it with a timer, when the game's rules depend on the exit, or a slot
list can keep its slot for a release delay, when the exit is only for
show. For drag and drop,
read the item when the drag starts, follow the pointer on the list's
container, and keep the dragged item as presentation state until it's
dropped.

## Further Reading

- React documentation,
  ["Preserving and Resetting State"](https://react.dev/learn/preserving-and-resetting-state).
  How React ties a view's state to its position in the tree, which is the
  same problem as state in a slot's view, and how keys move it with the
  item.
- Paul Lewis, ["FLIP Your Animations"](https://aerotwist.com/blog/flip-your-animations/)
  (2015). Animating items to new places after a layout change, as a
  browser technique. The eased position above does the same job, every
  frame, without measuring the layout.
