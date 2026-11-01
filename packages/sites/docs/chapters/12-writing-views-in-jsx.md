# Writing Views in JSX

> You can write a view's body in JSX. Each tag builds one display object,
> the nesting is the tree, and each function you give an attribute is read
> again every frame. JSX doesn't make a view correct, because polling
> already does that. Instead, JSX puts each read on the property it
> writes, so a read is hard to forget and the tree is easy to see. Where a
> view is mostly drawing or bookkeeping, plain TypeScript reads better, and
> you can mix the two freely.

**Related:** [Views](07-views.md) · [Bindings](08-bindings.md) ·
[Composing Views](13-composing-views.md) ·
[Lists and Switches](14-lists-and-switches.md) ·
[Measurements](../appendices/c-measurements.md)

[Chapter 7](07-views.md) gave a first look at JSX, enough to read the
samples since. This chapter has the rest. Here's a ship view in plain
TypeScript, written the way Chapter 7 writes views. The ship has a shield,
which shows while the model's `isShielded` is true:

```ts
function ShipView(bindings: ShipViewBindings): Container {
    const view = new Container();
    const hull = new Sprite({ texture: shipTexture, anchor: 0.5 });
    const shield = new Sprite({ texture: shieldTexture, anchor: 0.5 });
    shield.alpha = 0.6;
    shield.visible = bindings.isShielded(); // read once, while building
    view.addChild(hull, shield);

    function refresh(): void {
        view.x = bindings.x();
        view.y = bindings.y();
    }

    setRefresh(view, refresh);
    return view;
}
```

The first playtest goes well. The ship starts with its shield up, and the
shield shows. Then the shield wears off, and it stays on screen for the
rest of the game. The view read `isShielded` once, while it was being
built, and its `refresh()` never reads it again. Chapter 7 calls a view's
output a cache of its last `refresh()`, and a value that `refresh()`
doesn't read is a cache that never updates.

The fix is one line in `refresh()`. But the way the code is laid out made
the mistake easy to write. The shield is made near the top, given its value in
the middle, and refreshed (or not) at the bottom. To see that a read is
missing, you have to hold all three places in your head at once.

## The Same View in JSX

Here's the ship again, with its body written in JSX:

```tsx
/** @jsxImportSource @mvtjs/pixi */

function ShipView(bindings: ShipViewBindings): Container {
    return (
        <container x={bindings.x} y={bindings.y}>
            <sprite texture={shipTexture} anchor={0.5} />
            <sprite
                texture={shieldTexture}
                anchor={0.5}
                alpha={0.6}
                visible={bindings.isShielded}
            />
        </container>
    );
}
```

Both versions build the same three Pixi objects, and do the same work each
frame. The difference is where things are in the source. Everything about
the shield is on one tag, and the nesting shows the tree.

The JSX version doesn't have a `refresh()` at all. A plain value, such
as `alpha={0.6}`, is set once, when the view is built. A function, such
as `visible={bindings.isShielded}`, is a
[getter](../appendices/b-glossary.md), and it's read again every frame.
The JSX runtime builds the view's refresh step from the getters on the
attributes, so each read sits on the property it writes. To bring the shield bug
back, you'd have to call the getter yourself,
`visible={bindings.isShielded()}`, which is easier to spot than a missing
line, though TypeScript still accepts it. The view's interface hasn't
changed, so the code that calls it can't tell how its body is written.

Run [§](#try-jsx-ship-shield) to see the JSX ship. Its shield wears off
after two seconds, and comes back when you click. The example adds one
thing to the listing: the shield turns round the ship while it's up.
That's [presentation state](11-presentation-state.md), an angle that an
`onUpdate` moves on (there's more on `onUpdate` in
[§](#stepping-out-into-code)), written by a `rotation` getter. Then try
bringing the bug back: change the shield's attribute to
`visible={bindings.isShielded()}`, and run it again. The shield stays up,
still turning, while the line at the top says the ship isn't shielded.

<TryIt example="jsx-ship-shield" file="views/ship-view.tsx" />

::: info In this book
MVT doesn't require JSX. The `@mvtjs` libraries have a small JSX runtime
for each renderer they support: `@mvtjs/pixi`, `@mvtjs/html` for the DOM, and
`@mvtjs/three` for three.js. All three share one base, in
`@mvtjs/utils/jsx`, so they behave the same way.
:::

## Setting Up a JSX File

A JSX body goes in a `.tsx` file. TypeScript compiles each tag into a
function call, and the comment on the file's first line sets which
library's functions it calls: `/** @jsxImportSource @mvtjs/pixi */` for
Pixi views, `@mvtjs/html` for DOM views, `@mvtjs/three` for three.js
views.

Tags come in two kinds:

- **A tag in lower case builds a display object.** `<sprite>` builds a
  Pixi `Sprite`. These are called intrinsic elements. Pixi has eight:
  `container`, `sprite`, `tilingSprite`, `nineSliceSprite`, `text`,
  `bitmapText`, `htmlText` and `graphics`.
- **A tag with a capital letter calls your own function.** `<ShipView ... />`
  calls `ShipView`, with the tag's attributes as its bindings object.

TypeScript only treats a tag as your own function if its name starts with
a capital letter. That's why views in this book are named `ShipView`, not
`createShipView`. The same function then works as a tag,
`<ShipView x={...} />`, and as a plain call, `ShipView({ x: ... })`.

Other JSX libraries call a tag's attributes *props*. On a view's tag, the
attributes are the view's bindings, and this book keeps that word.

## Fixed Values and Getters

Each attribute takes a fixed value or a getter, just as a view's query
bindings do ([Chapter 8](08-bindings.md#fixed-values-and-getters)). A fixed
value is set once, so it doesn't add any work per frame. A getter is
called every frame.

The runtime writes a getter's result in one of two ways, depending on the
write's performance cost:

- **Fast writes happen every frame.** `x`, `y`, `alpha`, `rotation` and
  `scale` are plain assignments, so comparing first would take longer than
  writing.
- **Slow writes happen only when the value changes.** Setting `texture`,
  `text`, `style`, `tint`, `width` or `height` makes Pixi do work even when
  the value is the same, so the runtime keeps the last value it wrote, and
  compares. You don't need to write those checks yourself.

A few attributes take only a fixed value, such as `anchor`, `hitArea`,
`mask` and `sortableChildren`. If you give one of them a function, the view
throws as it's built, rather than quietly reading the function once.

Getters never run while the view is being built. Each one first runs at its
element's first refresh, once the whole tree exists. That matters inside
the lists and switches of [Chapter 14](14-lists-and-switches.md): an
ancestor that hides an element keeps its getters from running at all.

A getter runs every frame, so it shouldn't do more work than a
`refresh()` would. Text is the usual trap, as
[A getter that builds a string every frame](#a-getter-that-builds-a-string-every-frame)
shows.

## Hiding a Subtree with `visible`

`visible` works a little differently from the other attributes. A `visible`
getter is read first. While it returns `false`, the element's other getters
don't run, and the elements below it aren't refreshed either: the element
returns [`SKIP_DESCENDANTS`](07-views.md#doing-less-work-in-refresh). A
hidden pause menu takes one read per frame, however much it holds.

This is the JSX form of the early `return` in Chapter 7's bullet view. Here
is that view with a JSX body:

```tsx
function BulletView(bindings: BulletViewBindings): Container {
    return (
        <graphics
            ref={(g) => g.circle(0, 0, 4).fill(0xffffff)}
            visible={bindings.isVisible}
            x={bindings.x}
            y={bindings.y}
        />
    );
}
```

The `ref` attribute draws the circle once. It's one of the ways out of the
tree, which the next section covers.

## Stepping Out into Code

Plenty of what a view does isn't a tree of properties. Four attributes let
you step out into ordinary code at the right moment:

- **`ref`** receives the element once it's built. Use it to draw a
  `Graphics` shape, or to keep a reference for later. On your own view's
  tag, `ref` receives whatever your function returned.
- **`onRefresh`** adds a step of your own to the element's refresh. It runs
  after the element's getters, and is skipped with them while the element
  is hidden. It receives the element.
- **`onUpdate`** sets an update method on the element, for
  [presentation state](11-presentation-state.md) that moves with time.
- **`onDestroyed`** runs when the element is destroyed. Use it to release
  anything the view holds that isn't destroyed with it (see
  [Releasing a View's Resources](07-views.md#releasing-a-view-s-resources)).

Here's `onRefresh` in a card whose face is drawn in its colour. Redrawing a
`Graphics` is slow, so the card redraws it only when the colour changes:

```tsx
function CardView(bindings: CardViewBindings): Container {
    let drawnColor = -1; // the colour the face was last drawn in

    return (
        <container x={bindings.x} y={bindings.y}>
            <graphics onRefresh={redrawFaceWhenColorChanges} />
            <text text={bindings.label} anchor={0.5} style={LABEL_STYLE} />
        </container>
    );

    function redrawFaceWhenColorChanges(g: Graphics): void {
        const color = bindings.color();
        if (color === drawnColor) return;
        drawnColor = color;
        g.clear().roundRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 10)
            .fill(color);
    }
}
```

Event attributes, such as `onPointerTap={...}`, work the same way: they
pass the event to your function.

Run [§](#try-jsx-card-on-refresh) to see four of those cards, one for each
player at a table, with the card of the player whose turn it is in gold. A
face is redrawn only when the turn moves on. On every other frame,
`redrawFaceWhenColorChanges` reads the colour, checks that the face is
already drawn in it, and returns. Click a card to give that player the
turn.

<TryIt example="jsx-card-on-refresh" file="views/card-view.tsx" />

## What JSX Does for You

Everything JSX does, you could do by hand. This table shows what each part
of the work looks like either way:

| The work | By hand | In JSX |
| --- | --- | --- |
| Build each display object, and set what never changes | `new Sprite(...)`, then assignments | A tag, with fixed values |
| Put objects in the tree, in order | `addChild` calls | Nesting |
| Read each changing value again every frame | A `refresh()` that lists every one | A getter on the attribute |
| Skip a hidden subtree's work | `return SKIP_DESCENDANTS` while hidden | A `visible` getter does it |
| Skip a slow write when the value hasn't changed | Keep the last value written, and compare | Attributes with slow writes compare for you |
| Build child views and wire their bindings | A call, then `addChild` | A tag, with the bindings as attributes |
| Show a collection, reusing views as items come and go | A pool you manage | `<List>`, in [Chapter 14](14-lists-and-switches.md) |
| Show one of several subtrees | Several containers, and code to show one | `<Switch>` and `<Match>`, also in Chapter 14 |
| Listen for input, and release things when the view goes | `on(...)`, `on('destroyed', ...)` | `onPointerTap={...}`, `onDestroyed={...}` |
| Catch a misspelt property, or a value of the wrong type | TypeScript checks it | TypeScript checks it |

The third row is the one that prevents the shield bug. In JSX, you don't
keep a separate list of reads complete by hand.

## Is a JSX View Really Declarative?

JSX is often called declarative. It's worth knowing what that means, and
how far it's true here, because the parts that aren't declarative are where
the surprises are.

Code is **imperative** when it lists the steps to take: make a sprite, add
it to the container, and every frame, copy the ship's position into it.
Code is **declarative** when it says what should be true, and leaves the
steps to something else: "this sprite sits where the ship is". Most real
code is some of each.

A JSX view is declarative in its structure, since the nesting in the
source is the tree on screen. Each getter on an attribute is a standing
relationship: `x={bindings.x}` means "this container's `x` is always the
ship's `x`", and you never say when to update it.

It stops being declarative in three places. The ways out into code, `ref`,
`onRefresh` and `onUpdate`, are imperative steps, and real views use them
often. A getter can do anything, such as change the model, so whether it's
really a relationship is up to you: JSX makes the
[refresh rules](07-views.md) easy to keep, not automatic. And the order of
writes still shows through when two attributes write the same state, as
[Two attributes that write the same state](#two-attributes-that-write-the-same-state)
shows.

## How Much of a View Is JSX?

Open a few JSX views in the Arcade's games and you'll notice that in
many of them, the JSX is a small part of the file. Fuel Run's top-level
game view
([`game-view.tsx`](https://github.com/yortus/mvt-games/blob/main/packages/sites/arcade/src/entries/fuel-run/views/game-view.tsx))
is almost all JSX: it puts the terrain, the ship, the projectiles, the HUD
and the overlays together, and wires their bindings to the model. At the
other end, a view can be a single tag whose `ref`, `onUpdate` and
`onRefresh` delegate nearly all the work to plain functions.

JSX can only describe things shaped like a tree of objects with
properties, and a view's job includes a lot that isn't. Drawing, working
out a value, advancing presentation state and handling input are all
code. So when you choose JSX for a view, you're choosing how to write its
tree and its properties. Unless the view is mostly a tree, the rest is the
same code you'd write by hand, and that's where most of a view's
difficult parts are.

## How This Differs from React and Solid

JSX is only syntax. Each tag compiles to a function call, and the library
decides what that call does:

| Library | When your view function runs | How a change reaches the screen |
| --- | --- | --- |
| React | Again on every change | It compares the new tree with the old one, and applies the differences |
| Solid | Once | Its compiler wraps each JSX expression, so the expression runs again when a signal it read changes |
| This book's libraries | Once | Every getter is read again every frame, and the runtime doesn't track what it read. [Chapter 10](10-why-views-poll.md) explains why |

If you've used React or Solid, two things here will catch you out, and
both come from the view being built once: a
[plain value](#a-property-stuck-at-its-first-value) and a
[bare condition in the tree](#a-part-of-the-view-that-never-appears-or-never-goes)
are each read only once. The `@mvtjs` JSX runtimes also don't have
context, the React and Solid feature that lets a view look up a value
from an ancestor, and [Chapter 13](13-composing-views.md#sharing-values-between-many-views)
explains why.

## Choosing Between JSX and Plain TypeScript

MVT doesn't require either kind of body, and callers can't tell which a
view uses, so you can choose whichever suits each view.

- **JSX tends to suit views that are mostly a tree of display objects whose
  properties follow the model.** Sprites, text, HUDs and overlays are like
  that, and so are views that put child views together or show
  collections. The structure reads at a glance, and the runtime writes the
  refresh step.
- **Plain TypeScript tends to suit views that mostly draw, or manage their
  own display objects,** such as a pool or a ring buffer. It also suits
  views that need tight control of each frame's work, such as one change
  check that gates many writes, and views of very many objects. The view
  calls Pixi directly, and a stack trace shows your own
  function, rather than the runtime's refresh methods.

JSX takes a little more time and memory per container than a
hand-written view, because its refresh is general. A frame at 60 frames a
second lasts about 16.7 ms, and the difference only starts to matter with
tens of thousands of containers.
[Appendix C](../appendices/c-measurements.md) has the figures.

## Mixing the Two

You don't have to choose for a whole game, or even a whole view. Every view
is a function that takes bindings and returns a container, and inside one
file you can switch between the two as often as you like:

- **A JSX view can use a plain TypeScript view as a tag.**
- **A JSX view can step into code** with `ref`, `onRefresh` and `onUpdate`.
- **A JSX view can take objects built in code as children,** such as
  `{cards}`, an array built by calling `CardView` for each card.
- **A plain TypeScript view can use JSX for one part.** A JSX expression is
  just a value, here a Pixi container, so you can add it like any other
  child. Its getters are still read every frame, because `refreshView`
  finds every refresh method in the tree, however it got there:

```tsx
function RadarView(bindings: RadarViewBindings): Container {
    const view = new Container();
    const sweep = new Graphics();
    view.addChild(sweep);
    view.addChild(<text text={bindings.label} x={4} y={4} />);

    setRefresh(view, () => {
        sweep.rotation = bindings.angle();
    });
    return view;
}
```

Pick whichever makes each part of a view easiest to read.

## Limitations

Some of these are design decisions, and some just aren't built yet.

- **Text can't be a child.** `<text>Score</text>` doesn't work. Text is an
  attribute: `<text text="Score" />`, or `text` on a DOM element.
- **Drawing doesn't have tags.** `Graphics` paths are drawn in a `ref` (once) or
  an `onRefresh` (again when something changes).
- **Only the intrinsic elements listed above have tags.** Anything else is
  built in code and passed in as a child. Pixi's `AnimatedSprite` is left
  out on purpose, because it plays itself from Pixi's own ticker, which
  would be a view animating on its own. Give a `sprite` a `texture` getter
  instead.
- **A few attribute mistakes get past TypeScript,** such as those in a
  spread object (`<sprite {...look} />`), or the DOM's `data-*` attributes.
  An attribute that the element doesn't have still throws as the view is
  built.

## Common Mistakes

### A property stuck at its first value

A sprite stays where the ship started: `x={ship.x}` passed a plain value
where you meant a getter. In React, that's fine, because the whole view
runs again when the ship moves. Here, the view is built once, so a plain
value is read once. It compiles, because an intrinsic element's
attributes accept either form. Pass a getter, `x={() => ship.x}`. A
view's own bindings are safer here: if a binding is typed `() => number`,
TypeScript rejects a plain number.

### A part of the view that never appears, or never goes

A condition written straight into the tree is checked once, as the view
is built, not every frame as it would be in React:

```tsx
// Chooses once, when the view is built, and never again
<container>
    {model.isPaused ? <PausedView /> : undefined}
</container>

// Shows or hides the view every frame, as the model changes
<container visible={() => model.isPaused}>
    <PausedView />
</container>
```

Use `visible`, or the `<List>` and `<Switch>` of
[Chapter 14](14-lists-and-switches.md), which build their children ahead
of time and show or hide them.

### A getter that builds a string every frame

``text={() => `Score ${model.score}`}`` shows the right text, but builds
a new string every frame, even when the score hasn't changed, and leaves
garbage for the collector. A [computed value](09-noticing-changes.md)
builds the string only when the score changes. It's a getter itself, so
it goes straight on the attribute:

```tsx
const scoreText = createComputed({
    watch: () => model.score,
    compute: (score) => `Score ${score}`,
});

<text text={scoreText} x={8} y={8} />
```

### Two attributes that write the same state

A sprite flickers between two sizes, or settles on the wrong one. Pixi's
`width` works by changing `scale.x`, so a `scale` getter and a `width`
getter on one sprite overwrite each other each frame, and you don't get a
warning. Pick one.

### A view that throws as it's built, naming an attribute

The view throws as it's built, with a message naming an attribute. You
gave a function to an attribute that takes only a fixed value, such as
`anchor`. Pass the value itself, or, if it must change, set it in an
`onRefresh`.

## Summary

A JSX body builds the same objects as a hand-written one, and does the same
work each frame. Its advantage is where things sit in the source: the
nesting is the tree, and each changing value is a getter on the property it
writes, so you don't keep a separate list of reads complete. A fixed
value is set once, a getter is read every frame, slow writes happen only
on a change, and an element hidden by `visible` skips its whole subtree.

Drawing, presentation state and input handling are still code, reached
through `ref`, `onRefresh`, `onUpdate` and `onDestroyed`. A view is built
once, so a bare condition or a plain value is read once. Choose JSX for
views that are mostly a tree, and plain TypeScript for views that mostly
draw or manage their own objects, and mix them wherever it helps.

## Further Reading

- TypeScript Handbook,
  ["JSX"](https://www.typescriptlang.org/docs/handbook/jsx.html). How
  TypeScript compiles tags, tells intrinsic elements from your own
  functions, and picks a runtime with `jsxImportSource`.
- React documentation,
  ["Writing Markup with JSX"](https://react.dev/learn/writing-markup-with-jsx).
  JSX as React uses it, where the view function runs again on every
  change.
- Solid documentation,
  ["Intro to Reactivity"](https://docs.solidjs.com/concepts/intro-to-reactivity).
  JSX built once, as here, but kept up to date by signals rather than by
  polling.
- Peter Van Roy and Seif Haridi, *Concepts, Techniques, and Models of
  Computer Programming* (2004). Explains what declarative programming is,
  and how it relates to the imperative kind.
