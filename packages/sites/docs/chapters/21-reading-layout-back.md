# Reading Layout Back

> A view writes presentation output, and reads state through its bindings.
> But sometimes a value that a view uses is only in the output: how tall
> a card turned out once its text wrapped, or where an element is drawn
> right now. A view may read these back, if it treats each measurement as input:
> something reported after layout, kept in the view or a view model, and
> never in the model. Read in the wrong place, the same measurement can
> make the browser lay the page out dozens of times in one frame.

**Related:** [Views](07-views.md) ·
[Composing Views](13-composing-views.md) ·
[Presentation State](11-presentation-state.md) ·
[Growing a Complex View](18-growing-a-complex-view.md) ·
[Reduced Motion](22-reduced-motion.md)

In MVT, data flows one way. The model holds state, the views read it, and
the views write the output. Code never reads the output back.

Some layouts can't work that way. Picture a wall of cards in columns, like
a pinboard. Each card goes into the shortest column, so you need to know
how tall each card is. But a card's height depends on its text, its font
and the width of its column. Only the browser can measure it, and only
after it has laid the card out.

The model can't help here. Card heights are pixels, and models hold
[domain coordinates](04-models.md), not pixels. A card's height also
changes with the window, which the model doesn't track. So the view has
to measure it from the page.

This chapter's examples are for the web, since a browser lays the page out
by itself, and that's where reading layout back comes up most. The last
section shows that the same ideas apply on a canvas.

## Measurements Are Input

The way through is to treat a measurement like the player's input. The
page reports it, something stores it, and the next frame uses it:

1. The browser lays out the cards.
2. An observer reports their sizes.
3. The view passes each size to a view model, which works out where every
   card goes.
4. In the next refresh, the view writes those positions.

A `ResizeObserver` does the reporting. It's a browser object that you ask
to watch some elements. After each layout, the browser calls it with the
elements whose size changed:

```ts
const observer = new ResizeObserver((records) => {
    for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const index = indexOfCard.get(record.target);
        if (index === undefined) continue;
        layout.setCardHeightAt(index, record.borderBoxSize[0].blockSize);
    }
});
```

`borderBoxSize` is the card's whole height, padding and border included,
which is the room it takes up in its column. The older `contentRect`
leaves the padding and border out, so cards measured with it would
overlap.

Here `layout` is a [view model](18-growing-a-complex-view.md), from
Chapter 18: plain state and logic, owned by the view, that decides where
each card goes. It receives the measured heights as input, as a model
receives the player's presses. The view calls the observer's `observe`
for each card as it adds it, and disconnects the observer when the view
is destroyed.

The positions that the layout works out are
[presentation state](11-presentation-state.md). The layout can ease each
card towards its place in its `update`, and the view's `refresh` writes
where each card is now.

Until a card has been measured, the layout uses an estimate, such as the
height of a card with a one-line title. So the first frame already has
somewhere to put everything, and the cards settle into place as the
measurements arrive.

## Why Not Measure in the Refresh Step?

It's tempting to read a card's height right where you need it, in the
refresh step, from its `offsetHeight`, the height that the browser laid
it out at. It works, but it can be slow, and it's worth knowing why.

A refresh step writes to the page: positions, classes and text. Each write
leaves the browser's layout out of date. Normally that's fine. The browser
works the layout out again once, just before it draws the frame. But if you
ask for a size before then, the browser can't wait. It has to work the
layout out at that moment, so that the size it returns is correct. This
is called a **forced layout**.

Now picture a refresh step that goes through the cards in turn. It writes
one card's position, then reads the next card's height. Every read comes
straight after a write, so every read forces a layout. A wall of 50 cards
makes the browser lay the page out 50 times in one frame, instead of once.
On a big page, that's easily enough to make the frame late.

An observer avoids that. The browser lays the page out once per frame
anyway, and the browser passes the sizes to the observer after that
layout, without any extra layout. The callback only stores numbers, so it
doesn't write anything that would need another layout. The positions
follow one frame later, in the next refresh. Since the layout eases each
card towards its place, players don't notice that frame.

## Reading a Pose Once

There's a second, rarer case. Suppose a click on a card starts a
transition: the card's picture floats up and grows to fill the screen. The
transition must start exactly where the picture is drawn now. But the
picture may be part way through a CSS transition of its own, tilting as
the card is hovered. Only the page holds its position at this moment.

So, as the transition starts, the view reads the picture's pose from the
page, once. `getBoundingClientRect` returns where an element is drawn on
the screen, and how big it is:

```ts
function measurePose(photo: HTMLElement): Rect {
    const { left, top, width, height } = photo.getBoundingClientRect();
    return { x: left, y: top, width, height };
}
```

The result becomes the starting point of the transition's presentation
state. From then on, the transition moves the picture itself, from its own
state, and never reads the page again.

This one read is fine, for three reasons:

- **It happens once,** at a moment the view chooses, not every frame.
- **It forces only one layout,** once.
- **The model doesn't depend on it.** If the read were a little off,
  the picture would start from a slightly different place, and the game
  would play the same.

A canvas can need the same one read. In [§](#try-card-pose-read-once), the
cards turn on a ring that only the view tracks. Click a card, and as it
starts to open, the view reads where the card is drawn, once, with Pixi's
`getBounds()`. The card flies out from there. Click again, and the view
reads the card's place once more, to fly back.

<TryIt example="card-pose-read-once" file="views/gallery-view.ts" />

## When Reading Layout Back Is Fine

| Fine | Avoid |
| --- | --- |
| Sizes reported by an observer, fed to a view model as input | Reading `offsetWidth` or `getBoundingClientRect` in every refresh |
| Reading a pose once, to start presentation state | Reading the pose every frame, to follow an element the view itself moves |
| Measurements kept in a view or a view model | Measurements kept in the model, which then holds pixels that depend on the screen |
| An estimate until the first measurement arrives | Waiting for a measurement before drawing anything |

The rule underneath is the same as for presentation state. A measurement
may change how something looks. It must never change what happens in the
game.

## Canvas Renderers Measure Too

Canvas renderers such as Pixi and three.js don't lay anything out for
you, so there isn't a page to read back. But they have the same kind of
measurement: how wide a piece of text is, or the bounds of a container,
such as Pixi's `getBounds()`. They work these out when you call them,
which takes time too, so the same rules apply. Measure when something has
changed, not on every refresh. Pass the numbers to a view model as
input. And never keep them in the model.

## Testing a Layout View Model

Because the view model receives measurements through plain methods, a
test can pass it numbers directly. It doesn't need a browser or a layout:

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
[visual test](17-visual-tests.md), which lays out the real page.

::: info In this book
The website's card wall, which lists the games on each of its pages,
does both. `card-wall-view.tsx` measures its width
and each card's height with a `ResizeObserver`, and reports them to its
layout view model, `card-wall-layout.ts`, which has tests of its own.
`card-view.tsx` reads a card's photo from the page once, as the photo
starts to grow from the card.

- [`card-wall-view.tsx`](https://github.com/yortus/mvt-games/blob/main/packages/sites/site-kit/src/arcade/views/card-wall-view.tsx)
- [`card-wall-layout.ts`](https://github.com/yortus/mvt-games/blob/main/packages/sites/site-kit/src/arcade/views/card-wall-layout.ts)
  and its [tests](https://github.com/yortus/mvt-games/blob/main/packages/sites/site-kit/src/arcade/views/card-wall-layout.test.ts)
- [`card-view.tsx`](https://github.com/yortus/mvt-games/blob/main/packages/sites/site-kit/src/arcade/views/card-view.tsx)
:::

## Summary

Data in MVT flows one way, but a view may read layout back when only the
page has the value. Treat each measurement as input: let an observer
report sizes after the browser's own layout, store them in a view model,
and write the positions in the next refresh. Read a pose from the page
once, to start a transition, and then let presentation state take over.
Never measure in every refresh, where each read after a write forces a
layout, and never keep measurements in the model. Until a measurement
arrives, draw from an estimate.

## Further Reading

- Paul Lewis, ["Avoid large, complex layouts and layout thrashing"](https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing)
  (web.dev). How reads after writes force layouts, and how to batch them.
- Paul Irish, ["What forces layout / reflow"](https://gist.github.com/paulirish/5d52fb081b3570c81e3a)
  (2015). The browser properties and methods that make the browser lay
  out the page on the spot.
