# Lists and Switches

> Games show many things of one kind at once: bullets, enemies, tiles,
> cards. `<List>` keeps a view for each position in a collection. It
> builds that view the first time the position holds an item, and from
> then on shows whatever item is there each frame. `<Switch>` shows one of
> several subtrees, all built up front. They never compare or rearrange
> items, and both skip whatever isn't shown, so an empty slot or an
> unchosen branch takes very little time. Because a slot's view is reused
> for whatever item is there, an item view must read its item through a
> function every frame, and must not keep anything about it from when it
> was built.

**Related:** [Models](04-models.md) ·
[Writing Views in JSX](12-writing-views-in-jsx.md) ·
[Composing Views](13-composing-views.md) ·
[Lists in Motion](19-lists-in-motion.md) ·
[Hot Paths](24-hot-paths.md)

Your shooter's ship fires a dozen bullets a second, and each one lasts a
second or two. The model keeps them in a slot list, as in
[Chapter 4](04-models.md#collections-of-models). Here's the first way most
people write the view of them. It keeps a `Map` from each bullet to its
view, builds a view for each new bullet, and destroys the view of each
bullet that's gone:

```ts
// This works, but does far more work than it needs to
function refresh(): void {
    model.bullets.forEachLive((bullet) => {
        if (!views.has(bullet)) addViewFor(bullet);
    });
    views.forEach((view, bullet) => {
        if (!isStillLive(bullet)) removeViewOf(bullet, view);
    });
}
```

The bullets show up, move and vanish, so it looks right. But look at what
it does. It builds and destroys Pixi objects a dozen times a second. Every
frame, it looks up every bullet in the `Map`, and `isStillLive` searches
the model's bullets once for every view, so the work grows with the square
of the number of bullets. And the `Map` is a second list of bullets, kept
in step with the model's by hand, which is exactly the kind of copy that
[Chapter 7](07-views.md) asks views not to keep.

`<List>` works the other way round. It doesn't follow items at all. It
keeps one view per position in the collection, and each frame, the view at
position 3 shows whatever item is at position 3.

## How `<List>` Works

Here's the bullet layer again, with a `<List>`:

```tsx
<List items={model.bullets.slots}>
    {(slot) => (
        <BulletView x={() => slot().value.x} y={() => slot().value.y} />
    )}
</List>
```

`items` is the collection to show, here the slot list's `slots`, and the
function inside the tag builds the view for one position. Each position
in a `<List>` is called a **slot**. A slot list has slots too, and here
the two line up: the list's slot 3 shows the slot list's slot 3. So the
list's item is the slot list's entry, and its `value` is the bullet. Five
things follow from working by slot:

- **A slot's view is built once.** The function is called the first time a
  slot holds an item, and its view is kept for as long as the list is.
- **The view receives a function, not an item.** `slot` is the slot's
  item accessor. The item in a slot can change from one frame to the next,
  so the view calls `slot()` each time it reads the item, and always gets
  the one that's there now.
- **An empty slot hides itself.** If a position doesn't hold an item, its
  view is hidden, and its getters don't run, as
  [§](#an-empty-slot-needs-only-one-check) explains.
- **A list that shrinks keeps its views.** Slots past the end are taken out
  of the container, so they don't take any time each frame, and they're
  put back, not rebuilt, when the list grows again.
- **Items are never compared or rearranged.** A `<List>` doesn't have
  keys, as React's lists do, to match each item with its view. When items
  move, each slot simply shows a different item. While the collection's length stays the
  same, the list itself does very little work.

The function inside the tag also receives the slot's index, as a second
argument. A slot's index never changes, so anything worked out from it is
a constant for that slot.

[§](#try-list-bullet-slots) runs the bullet layer. Below the play area, a
second `<List>` over the same slots fills a square for each slot that
holds a bullet now. Press and hold to fire faster, and watch the list
grow. Let go, and as the older bullets leave, gaps open where slots are
empty, and the list shrinks again.

<TryIt example="list-bullet-slots" file="views/shooter-view.tsx" />

::: info In this book
`List`, `Switch` and `Match` come from the JSX runtime of each renderer,
such as `@mvtjs/pixi`, which also exports the `ListSource` type.
:::

## Sources a List Can Show

`items` can be anything with a `length` and an `at(index)` that returns the
item at that index, or `undefined` for an empty slot. That's the shape of
`ListSource`, and arrays already have it. So does a slot list's `slots`,
which keeps each item in the same slot for its whole life.

Anything else needs only a small object with the two members. Its `length`
can be a number, or a function that the list calls once per frame:

```tsx
const enemies: ListSource<EnemyModel> = {
    length: () => model.enemyCount,
    at: (i) => model.enemyAt(i),
};
```

Build an object like this once, as the view is built, not in a getter.
Every frame, the list calls `length` once, and `at` once for each slot.

How you pass `items` depends on how the model owns its collection:

- **Pass the collection itself** when the model changes it in place, as
  models usually do: `items={model.bullets.slots}`, or an array such as
  `items={model.cells}`. The list holds on to it, and reads its contents
  again every frame.
- **Pass a getter** when the model replaces the collection with a new one:
  `items={() => model.stars}`. The list then reads which collection to
  show every frame, too. The getter should return a collection that the
  model has stored, not build a new one, because it runs every frame.

`List` is a view function like any other, so a view with a plain
TypeScript body can call it:

```ts
view.addChild(List({
    items: model.bullets.slots,
    children: (slot) => BulletView({
        x: () => slot().value.x,
        y: () => slot().value.y,
    }),
}));
```

## Two Rules for Item Views

A slot's view is reused for whatever item is in the slot, and that places
two requirements on every item view.

**Rule 1: a view must not keep anything that depends on the item from
when it was built.** Slot 3 will later hold a different item, and any
value that the view read from its first item won't change when the item
does:

```tsx
// Wrong: the seed is used once, as the slot's view is built
{(rock) => <graphics ref={(g) => drawAsteroid(g, rock().seed)} />}

// Right: the view follows the seed of whichever rock is in its slot
{(rock) => <AsteroidShape seed={() => rock().seed} />}
```

The second form needs `AsteroidShape` to redraw when its seed changes,
which it does with a check in its refresh, as any slow redraw does. A
value worked out from the slot's index alone is fine to keep, because the
index never changes. A value worked out from the item isn't.

Reading the item while the view is being built is fine, to set it up. A
slot's view is built the first time the slot holds an item, so `rock()`
returns that item. The rule forbids relying on it afterwards. If the
view reads a value as it's built, it must also read it again as it
refreshes.

**Rule 2: presentation state that belongs to an item must be stored by the
item, not by the slot.** Any state that a slot's view keeps, such as a
fade's progress, stays with the slot when its item changes. That's fine
while each item keeps its slot for its whole life, as items in a slot
list do, as long as the view resets the state when a new item arrives.
When items move between slots, as they do in a list that reorders, the
state has to be stored by something that moves with the item.
[Chapter 19](19-lists-in-motion.md) shows how, and how to animate an item
out after it's gone from the model.

A [reaction or a watcher](09-noticing-changes.md) in a slot's view is state
of this kind. When a new item arrives, the next call compares the new
item's value with the old item's, and treats the difference as a change.
And while a slot is empty, its view isn't refreshed, so its reactions
aren't called. For sounds, it's often easier not to play them from the
item views at all. The model counts each kind of moment, and one audio
view outside the list reacts to the counts.
[Chapter 20](20-sound-and-music.md#sound-for-a-collection) shows that, and
how a slot's view can play its own sounds safely.

## An Empty Slot Needs Only One Check

`<List>` decides whether each slot is shown. Each frame, before the slot's
view refreshes, the list looks up the slot's item with `at(i)`. If it's
`undefined`, the slot hides itself and returns
[`SKIP_DESCENDANTS`](07-views.md#updating-and-refreshing-views-with-the-mvtjs-libraries),
so `refreshView` skips everything below it. The item view's getters don't
run at all.

So an empty slot takes one lookup and one check per frame, however much
its view contains. This is also why `slot()` doesn't need a check for
`undefined`: the item view's getters only run while the slot has an item.
And this is why item views don't need an `isAlive` binding of their own.
Fuel Run's bullets, bombs, rockets and explosions are each a `<List>` over
a slot list, and their views don't have a binding that says whether the
item is there.

The list looks up each slot's item once per frame, and every getter in
the slot's view reads that same item through the accessor. An item view
with ten getters still takes only one lookup.

## Showing One of Several: `<Switch>`

`<List>` shows many of the same thing. `<Switch>` shows one of several
different things. Here's a game's screen, which is a title, the play area
or a game-over panel, depending on the phase:

```tsx
<Switch>
    <Match when={() => model.phase === 'title'}>
        <TitleView onStartPressed={() => model.startGame()} />
    </Match>
    <Match when={() => model.phase === 'game-over'}>
        <GameOverView score={() => model.score} />
    </Match>
    <Match else>
        <PlayAreaView model={model} />
    </Match>
</Switch>
```

Each `<Match>` is a branch. This is how a switch behaves:

- **The first branch whose `when` returns `true` is shown,** checked in
  order each frame. If every `when` returns `false`, a final
  `<Match else>` is shown. Without a `<Match else>`, the switch hides
  every branch, which is often what you mean.
- **Every branch is built up front, and kept.** Choosing a branch only
  changes which one is visible, so a switch never adds or removes anything
  from the tree, however often the choice changes.
- **A hidden branch doesn't take any time.** Its subtree is skipped, so
  its getters never run. Since getters don't run while a view is built, a
  getter in a branch can rely on its branch's `when` being true. A getter
  that reads the boss's health, in a branch shown only while there is a
  boss, never runs without one.
- **A heavy branch can be built when it's first needed.** Give the
  `<Match>` a function instead of children, such as
  `{() => <BossView />}`, and the branch is built the first time it's
  shown.

[§](#try-switch-game-phases) shows that screen, in a game of target
practice. Click to start a round, then click the target as often as you
can before the time runs out. The line in the corner names the model's
phase, so you can see which branch the switch picks.

<TryIt example="switch-game-phases" file="views/game-view.tsx" />

The runtime checks how you use them, and throws if something is wrong,
either as the view is built or when it first refreshes. A `<Match>` must
be a direct child of a `<Switch>`, and `<Match else>` must be the last
one, since a branch after it could never be shown.

The runtime doesn't check that you've covered every case, though. If a
new phase is added without a branch, the switch simply hides every branch
during that phase. To make a
missing case an error instead, give the switch a default branch whose
function throws. The function only runs if that branch is ever chosen:

```tsx
<Match else>
    {() => { throw new Error(`Unhandled phase: ${model.phase}`); }}
</Match>
```

When there's only one thing to show or hide, you don't need a switch.
A `visible` getter does it, as
[Chapter 12](12-writing-views-in-jsx.md) showed.

## Kinds of Collection

The way a collection changes matters more than whether it belongs to a
game or a menu. Here are the common kinds:

| Your list | How it changes | Where |
| --- | --- | --- |
| A tilemap, a board, a hotbar, settings rows | Fixed length | [Fixed lists and grids](#fixed-lists-and-grids) |
| Bullets, particles, debris, explosions | Items come and go, each in its own slot | [Pools of short-lived items](#pools-of-short-lived-items) |
| Loot drops, enemy waves | Grows and shrinks | [Lists that grow and shrink](#lists-that-grow-and-shrink) |
| Mixed enemy types, mixed menu rows | Items of different kinds | [Items of different kinds](#items-of-different-kinds) |
| A long scrolling list, a chat log | Only part of it is on screen | [Windowed lists](#windowed-lists) |
| A filtered list, selection rings | Worked out again from the model | [Lists worked out from the model](#lists-worked-out-from-the-model) |
| A card hand, an inventory, a leaderboard | Reorders, and items slide or fade | [Chapter 19](19-lists-in-motion.md) |

### Fixed lists and grids

This is the fastest case. The length never changes, so after the first
frame the list never adds or removes a slot.

A grid is a fixed list whose index identifies a cell. Show the model's cells in
row order, and work out each slot's row and column once, from its index:

```tsx
<List items={model.cells}>
    {(cell, index) => {
        // Constants for this slot, since its index never changes
        const row = Math.floor(index / GRID_COLS);
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

`x` and `y` are fixed values here, set once, because the layout never
changes. Only the texture is a getter.

When the next level has a bigger grid, that's just a longer list. Slots
that the list has already built are reused, and only the new slots are
built.

### Pools of short-lived items

Bullets and particles come and go all the time, all of one kind, sometimes
thousands at once. Hold them in a slot list in the model, and show its
`slots`, as the bullet layer in [How `<List>` Works](#how-list-works)
does, without any checks in the view. The model puts each new bullet in
a free slot, and removes it when it expires. A slot's view is built the
first time the slot holds a bullet, and never destroyed. After the first
few seconds of play, the list doesn't build any more views.

### Lists that grow and shrink

When the number of items really does vary, let the list follow the
length of the model's array:

```tsx
<List items={model.drops}>
    {(drop) => <LootDropView x={() => drop().x} y={() => drop().y} />}
</List>
```

How the model removes an item decides how many slots get a different
item:

| How the model removes an item | Slots that get a different item | Use it when |
| --- | --- | --- |
| Marks it inactive (`isActive = false`) | None | Items come and go often. Prefer this |
| Moves the last item into its place, then pops | One, the removed item's, and the last slot empties | The order doesn't matter |
| Splices it out | Every slot after it | The order matters, and the list is short |

When the model marks an item inactive, the item stays in its slot, so
its view hides itself with a getter such as
`visible={() => drop().isActive}`, and the model reuses the item later.

All three show the right items, because every getter reads the current
item every frame. They differ only in how many slots change item, and that
matters only when slots carry presentation state, which is
[Chapter 19](19-lists-in-motion.md)'s subject.

### Items of different kinds

A slot's view is built once, so it can't turn into a different kind of
view when a different kind of item arrives. Put a `<Switch>` inside the
slot, with one `<Match>` for each kind:

```tsx
<List items={model.enemies}>
    {(enemy) => (
        <Switch>
            <Match when={() => enemy().kind === 'asteroid'}>
                <AsteroidShape
                    x={() => enemy().x}
                    y={() => enemy().y}
                    seed={() => enemy().seed}
                />
            </Match>
            <Match when={() => enemy().kind === 'saucer'}>
                <sprite
                    texture={saucerTexture}
                    x={() => enemy().x}
                    y={() => enemy().y}
                />
            </Match>
        </Switch>
    )}
</List>
```

Every slot builds every branch, and keeps them. Choosing between them only
changes which is visible, so even a slot whose item changes kind every
frame never adds or removes anything. A getter that only makes sense for
one kind, such as a saucer's shield, is safe in that kind's branch.

[§](#try-list-mixed-enemies) runs that list. When an enemy leaves at the
left, the model moves the last enemy into its place, so that slot now
shows a different enemy. The squares below the sky are the slots, coloured
by the kind of enemy in each. Watch one change colour: its slot has
switched branches, and the list didn't build or remove any views.

<TryIt example="list-mixed-enemies" file="views/sky-view.tsx" />

Building every branch in every slot uses memory. For a heavy branch in a
long list, give the `<Match>` a function, so each slot builds that branch
only if it ever holds an item of that kind.

### Windowed lists

A long scrolling list shows a fixed number of rows, over an offset that
moves as you scroll. Its length never changes, so scrolling doesn't cause
any work in the list.

The source is a small object, built once. Its `length` is a constant, and
its `at` reads through the scroll offset:

```tsx
const visibleRows: ListSource<Row> = {
    length: VISIBLE_ROWS,
    at: (i) => model.rows.at(model.scrollRow + i),
};

<List items={visibleRows}>
    {(row, index) => (
        <text
            text={() => row().label}
            y={index * ROW_HEIGHT_PX}
            style={ROW_STYLE}
        />
    )}
</List>
```

Near the end of the data, `at` returns `undefined` for rows past the last
one, so those slots hide themselves. The model doesn't need a special
case.

The same idea covers a count that doesn't have items behind it. A source
whose `at` returns its index shows one slot for each unit. Fuel Run's HUD
draws the player's lives this way, with
`{ length: bindings.lives, at: (i) => i }`.

### Lists worked out from the model

A filtered list, or a ring around each selected unit, is worked out from
the model rather than stored as it is. If it's worked out afresh each
frame, every item is a new object every frame. That's fine for `<List>`.
Each slot simply shows whatever is at its index, so frames where the count
stays the same don't add any work for the list.

The performance cost is in working the list out. An `items` getter runs
every frame, so it must not build a new array:

```tsx
// Wrong: builds a new array every frame
<List items={() => model.units.filter((u) => u.isSelected)}>

// Right: the model keeps the selected units up to date as they change
<List items={model.selectedUnits}>
```

## Time and Memory Costs of Lists and Switches

`<List>` reads `items` and the length once per frame, then looks up each
slot's item once. A slot with an item takes as long as its view's getters
take, and an empty slot takes only the check described in
[§](#an-empty-slot-needs-only-one-check). Slots past the end don't take
any time, because they're out of the tree.

A slot's view is built once and kept for the life of the list, so memory
follows the longest the list has ever been, not its length now. That's the
point: a pool of a thousand bullets builds a thousand views once, and
never again. If a list is long once and short ever after, those views stay
built. They're out of the tree, so they use memory, but not time.

`<Switch>` calls each branch's `when` in order until one is true, so a
switch takes a few calls per frame. Each branch is built up front unless
you give it a function, so a switch of heavy branches uses their memory
whether or not they're ever shown.

## Common Mistakes

### A slot that shows its first item after the item changes

A slot shows its first item's look or data after its item changes. The
item view read something from the item as it was built, and never reads
it again. Make it a getter, as rule 1 says.

### Checks for an empty slot in every getter

The view works, but each getter in an item view checks whether its
slot is empty, and the checks are wasted. A getter in a slot only runs
while the slot has an item, so `slot()` is never `undefined` there. Leave
the checks out.

### Out-of-range errors, or the wrong item, in a slot's view

A slot's view throws an out-of-range error, or shows the wrong item, when
the slot is past the end or the items have moved. The view reads the
model by its `index`, rather than through the item accessor. Read through
the accessor.

### An `items` getter that builds a new array

An `items` getter such as `() => model.units.filter(...)` makes garbage
every frame, and work that grows with the list. Have the model keep the
collection up to date, as
[Lists worked out from the model](#lists-worked-out-from-the-model) shows.

### A list that keeps showing a replaced collection

The model replaces its collection with a new one, but the list keeps
showing the old one. The collection itself was passed to `items`, so the
list holds on to it. Pass a getter instead: `items={() => model.stars}`.

### A hidden subtree that makes things slower

Taking a subtree out of the tree to stop it refreshing makes things slower,
not faster, because each change to the tree's structure makes
`refreshView` find its refresh methods again. Hide it with a `visible`
getter, which skips it without changing the tree.

### A `<Match>` that throws

A `<Match>` throws, as the view is built or as it first refreshes. It sits
outside a `<Switch>`, or it's a `<Match else>` that isn't the last branch.
Put every `<Match>` directly in a `<Switch>`, with the default last.

Mistakes with presentation state in lists, such as a fade that follows the
slot instead of the item, are in [Chapter 19](19-lists-in-motion.md).

## Summary

`<List>` shows a collection by position. Each slot's view is built the
first time that slot holds an item, kept for the life of the list, and
given an accessor that returns the slot's item each frame. Empty slots
hide themselves and skip their whole subtree, so item views don't need
checks of their own. Anything with a `length` and an `at` can be a list's
source: an array, a slot list's `slots`, or a small object over the
model.

An item view must follow two rules: read the item through the accessor,
never from when the view was built, and store any presentation state of
the item's by the item, not the slot. `<Switch>` shows the first `<Match>`
whose `when` is true, from branches built up front, and skips the rest.
Together they cover fixed grids, pools, growing lists, windows, mixed
kinds and lists worked out from the model, without comparing or
rearranging anything.

## Further Reading

- Robert Nystrom, *Game Programming Patterns* (2014),
  ["Object Pool"](https://gameprogrammingpatterns.com/object-pool.html).
  Why games reuse objects rather than build and destroy them, as a list's
  slots do for views.
- React documentation,
  ["Rendering Lists"](https://react.dev/learn/rendering-lists). React's
  approach, the opposite of this one: each item has a key, and React
  matches items to views by key.
- Solid documentation,
  ["`<Index>`"](https://docs.solidjs.com/reference/components/index-component).
  A list by position, much like `<List>`, where each view gets its item as
  a function. Solid's `<For>` is the keyed kind.
