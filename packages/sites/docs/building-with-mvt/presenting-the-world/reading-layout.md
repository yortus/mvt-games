# Reading Layout Back

> A view writes presentation output, and reads state through its bindings.
> But sometimes what a view needs to know is only in the output: how tall a
> card turned out once its text wrapped, or where an element is drawn right
> now. This page shows when a view may read layout back from the page,
> where to do it, and what it costs.

**Related:** [Views](views.md) ·
[View Composition](view-composition.md) ·
[Presentation State](../adding-visual-polish/presentation-state.md) ·
[Taming Complex Views](../adding-visual-polish/taming-complex-views.md) ·
[Reduced Motion](../adding-visual-polish/reduced-motion.md)

---

*Assumes familiarity with [Views](views.md) and
[Presentation State](../adding-visual-polish/presentation-state.md).*

::: info The examples are for the web
This page's examples use the DOM: a `ResizeObserver`,
`getBoundingClientRect` and CSS. A browser lays the page out by itself, so
that's where reading layout back comes up most. Canvas renderers such as
Pixi and three.js lay nothing out for you, but they have the same kind of
measurement: how wide a piece of text is, or the bounds of a container
(Pixi's `getBounds()`). They work them out when you ask, which costs time
too. The same rules apply. Measure when something has changed, give the
numbers to a view model as input, and never keep them in the model.
:::

## The Problem

In MVT, data flows one way. The model holds state, the views read it, and
the views write the output. Nothing reads the output back.

Some layouts can't work that way. Picture a wall of cards in columns, like
a pinboard. Each card goes into the shortest column, so you need to know
how tall each card is. But a card's height depends on its text, its font
and the width of its column. Only the browser knows it, and only after it
has laid the card out.

The model can't help here. Card heights are pixels, and models hold
[domain coordinates](../simulating-the-world/models.md), not pixels. A
card's height also changes with the window, which the model knows nothing
about. So the view has to find out from the page.

## Measurements Are Input

The way through is to treat a measurement like the player's input. The page
reports it, something stores it, and the next frame uses it:

1. The browser lays out the cards.
2. An observer reports their sizes.
3. The view hands each size to a view model, which works out where every
   card goes.
4. In the next refresh, the view writes those positions.

A `ResizeObserver` does the reporting. The browser calls it after it lays
the page out, with the sizes that changed:

```ts
const observer = new ResizeObserver((records) => {
    for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const index = indexOfCard.get(record.target);
        if (index === undefined) continue;
        layout.setCardHeightAt(index, record.contentRect.height);
    }
});
```

Here `layout` is a [view model](../adding-visual-polish/taming-complex-views.md):
plain state and logic, owned by the view, that decides where each card goes.
It takes the measured heights as input, as a model takes the player's
presses. The view observes each card as it adds it, and disconnects the
observer when the view is destroyed.

Until a card has been measured, the layout uses an estimate, such as the
height of a card with a one-line title. So the first frame already has
somewhere to put everything, and the cards settle into place as the
measurements arrive.

## Why Not Measure in the Refresh Step?

It's tempting to read `offsetHeight` right where you need it, in the
refresh step. It works, but it can be slow, and it's worth knowing why.

A refresh step writes to the page: positions, classes and text. Each write
leaves the browser's layout out of date. Normally that's fine. The browser
works the layout out again once, just before it draws the frame. But if you
ask for a size before then, the browser can't wait. It has to work the
layout out at that moment, so that the size it gives you is correct. This
is called a forced layout.

Now picture a refresh step that goes through the cards in turn. It writes
one card's position, then reads the next card's height. Every read comes
straight after a write, so every read forces a layout. A wall of 50 cards
makes the browser lay the page out 50 times in one frame, instead of once.
On a big page, each of those layouts can take a millisecond or more, which
is enough to make the frame late.

An observer avoids that. The browser lays the page out once per frame
anyway, and the observer is told the sizes after that layout, for free. The
callback only stores numbers, so it writes nothing that would need another
layout. The positions follow one frame later, in the next refresh. Since the
layout eases each card towards its place, nobody sees that frame.

## Reading a Pose Once

There's a second, rarer case. Suppose a click on a card starts a
transition: the card's picture floats up and grows to fill the screen. The
transition must start exactly where the picture is drawn now. But the
picture may be part way through a CSS transition of its own, tilting as the
card is hovered. Only the page knows where it is at this moment.

So, as the transition starts, the view reads the pose from the page, once:

```ts
function poseOf(photo: HTMLElement): Rect {
    const { left, top, width, height } = photo.getBoundingClientRect();
    return { x: left, y: top, width, height };
}
```

The result becomes the starting point of the transition's presentation
state. From then on, the transition moves the picture itself, from its own
state, and never reads the page again.

This one read is fine, for three reasons. It happens once, at a moment the
view chooses, not every frame. It costs one forced layout, once. And nothing in
the model depends on it. If the read were a little off, the picture would
start from a slightly different place, and the game would play the same.

## When Reading Back Is Fine

| Fine | Avoid |
| --- | --- |
| Sizes reported by an observer, fed to a view model as input | Reading `offsetWidth` or `getBoundingClientRect` in every refresh |
| Reading a pose once, to start presentation state | Reading the pose every frame, to follow an element the view itself moves |
| Measurements kept in a view or a view model | Measurements kept in the model, which then holds pixels that depend on the screen |
| An estimate until the first measurement arrives | Waiting for a measurement before drawing anything |

The rule underneath is the same as for presentation state. A measurement
may change how something looks. It must never change what happens in the
game.

## Testing

Because the view model takes measurements through plain methods, a test
can pass it numbers directly. It needs no browser and no layout:

```ts
it('puts each card in the shortest column', () => {
    const layout = createCardWallLayout({ ...OPTIONS, count: 3 });
    // Room for two columns
    layout.setWidth(2 * COLUMN_WIDTH + GAP);
    layout.setCardHeightAt(0, 300);
    layout.setCardHeightAt(1, 100);
    layout.update(0);
    // The second column is shorter, so the third card goes under the second
    expect(layout.xAt(2)).toBe(layout.xAt(1));
});
```

The view itself, with its observer, is covered by a
[visual test](../iterating-with-confidence/visual-tests.md), which lays out
the real page.

## In This Repo

The Arcade's card wall does both. `card-wall-view.tsx` measures its width
and each card's height with a `ResizeObserver`, and reports them to its
layout view model, `card-wall-layout.ts`, which has tests of its own.
`photoPoseOf`, in `card-view.tsx`, reads a card's photo from the page as
the way into an entry starts:

- [`card-wall-view.tsx`](https://github.com/yortus/mvt-games/blob/main/packages/sites/arcade/src/arcade/views/card-wall-view.tsx)
- [`card-wall-layout.ts`](https://github.com/yortus/mvt-games/blob/main/packages/sites/arcade/src/arcade/views/card-wall-layout.ts)
  and its [tests](https://github.com/yortus/mvt-games/blob/main/packages/sites/arcade/src/arcade/views/card-wall-layout.test.ts)
- [`card-view.tsx`](https://github.com/yortus/mvt-games/blob/main/packages/sites/arcade/src/arcade/views/card-view.tsx)
