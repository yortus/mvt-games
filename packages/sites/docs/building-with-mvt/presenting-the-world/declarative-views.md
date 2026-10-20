# Declarative Views

> Many views in this project are written in JSX, which lets you describe a
> view's tree and how its properties relate to the model, rather than spell
> out each step. This page explains what "declarative" means, how far JSX
> really gets you there, and where it stops helping.

**Previous:** [Bindings](bindings.md) · **Next:** [View Composition](view-composition.md)

**Related:** [Views](views.md#writing-the-body-in-jsx) ·
[Presenting Collections](collections.md) ·
[Style Guide: Writing the Body](../../reference/style-guide.md#writing-the-body) ·
[Performance Measurements](../performance/measurements.md)

---

*Assumes familiarity with [Views](views.md) and [Bindings](bindings.md).*

## What "Declarative" Means

Code is **imperative** when it lists the steps to take. Make a sprite. Add it
to the container. Every frame, copy the ship's position into it.

Code is **declarative** when it says what should be true, and leaves the steps
to something else. "This sprite sits where the ship is." Nothing in that
sentence says when to move the sprite, or how.

A spreadsheet is the classic example. When you type `=A1 * 2` into a cell, you
don't tell the spreadsheet to recalculate when `A1` changes. You state a
relationship, and the spreadsheet keeps it. SQL and CSS work the same way.

Two things about the word are worth knowing:

- **It's a spectrum, not a yes or no.** Most real code is declarative in some
  ways and imperative in others, so ask "declarative about what?"
- **It describes how you write code, not how it runs.** Underneath every
  spreadsheet is a program that recalculates cells, step by step.

In a view, you might declare two things. One is its **structure**: which
display objects it has, and how they nest. The other is its
**relationships**: which property of the output shows which value from the
model.

## MVT Views Are Halfway There Already

Declarative UI libraries work hard for one property: what's on screen always
matches the current state, often written as `UI = f(state)`.

An MVT view gets that property from polling, whatever its body looks like.
Its `refresh()` re-reads every value it shows, every frame (see
[Immediate-Mode Data Flow, Retained-Mode Output](../../architecture/views.md#immediate-mode-data-flow-retained-mode-output)).
There's no "when the score changes, update the label" anywhere.

So JSX doesn't make MVT views correct. Polling does that. JSX changes how you
write a view down, so the structure and the relationships are easier to see,
and harder to get wrong.

## The Same View, Both Ways

Here's a ship whose shield shows while it's shielded. Its bindings are `x`,
`y` and `isShielded`, all functions. First in plain TypeScript:

```ts
function ShipView(bindings: ShipViewBindings): Container {
    const view = new Container();
    const hull = new Sprite(shipTexture);
    hull.anchor.set(0.5);
    const shield = new Sprite(shieldTexture);
    shield.anchor.set(0.5);
    shield.alpha = 0.6;
    view.addChild(hull, shield);

    function refresh(): void {
        view.x = bindings.x();
        view.y = bindings.y();
        shield.visible = bindings.isShielded();
    }

    setRefresh(view, refresh);
    return view;
}
```

And in JSX:

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

Both build the same three Pixi objects, and do the same work each frame. The
difference is where things live in the source. In the first, the shield is
created near the top, added in the middle, and refreshed at the bottom. In
the second, everything about the shield is on one tag, and the nesting shows
the tree.

A plain value, such as `alpha={0.6}`, is set once, when the view is built. A
function, such as `visible={bindings.isShielded}`, is read again every frame.
You don't write a refresh function at all: the JSX runtime builds one from
the functions you gave it.

## What JSX Does for You

Everything JSX does, you can do by hand:

| The work | By hand | In JSX |
| --- | --- | --- |
| Build each display object and set what never changes | `new Sprite(...)`, then assignments | A tag, with plain values |
| Put objects in the tree, in order | `addChild` calls | Nesting |
| Re-read each changing value every frame | A `refresh()` that lists every one | A function given to the attribute |
| Skip a hidden subtree's work | `if (!visible) return SKIP_DESCENDANTS` | A `visible` function does it |
| Skip a costly write, such as a texture or a label's text, when the value hasn't changed | Keep the last value written, and compare | Attributes with costly writes, such as `texture` and `text`, compare for you. Cheap ones, such as `x`, are written every frame |
| Build child views and wire their bindings | A call, then `addChild` | A tag, with the bindings as attributes |
| Show a collection, reusing views as items come and go | A pool you manage | [`<List>`](collections.md) |
| Show one of several subtrees | Several containers, and code to show one | `<Switch>` and `<Match>` |
| Listen for input, and release things when the view goes | `on(...)`, `view.on('destroyed', ...)` | `onPointerTap={...}`, `onDestroyed={...}` |
| Catch a misspelt property, or a value of the wrong type | TypeScript checks it | TypeScript checks it |

The third row prevents a real bug. A hand-written view can set a property at
construction and never re-read it, and it looks fine until the model changes.
The architecture page calls the output "a cache of the last `refresh()`
call", and if `refresh()` doesn't read a value, the cache goes stale. In JSX, each read is written on
the property it updates, so there's no separate list to keep in step.

## Is a JSX View Really Declarative?

Partly. The parts that aren't declarative are where the surprises are.

### Where it is

- **The structure is declared.** The nesting in the source is the tree on
  screen.
- **Each function attribute is a standing relationship.** `x={bindings.x}`
  means "this container's `x` is always the ship's `x`", like a spreadsheet
  cell. You never say when to update it.
- **You don't order the writes.** The runtime decides when to write each
  attribute.

### Where it isn't

**Imperative escape hatches are part of the design.** Plenty of what a view
does isn't a tree of properties, so the runtime gives you three ways out.
`ref` hands you the built object once, to draw a `Graphics` shape or keep a
reference for later. `onRefresh` adds your own code to the object's refresh
step. `onUpdate` gives it an update method, for
[presentation state](../adding-visual-polish/presentation-state.md). Real
views use these often. The Arcade's card view keeps several of its elements
through `ref`, and places itself in an `onRefresh`. Those parts are
imperative steps inside a declarative frame.

**A function attribute is a formula you write in code.** A spreadsheet
formula can only compute a value. A function attribute can do anything,
such as count its calls or change the model. Whether it's really a
relationship, a value worked out from state with no side effects, is up to
you. JSX makes the refresh rules easy to keep, not automatic.

**The order still shows through.** In truly declarative code, the order
doesn't matter. Here it mostly doesn't. The runtime writes `visible` first,
then the attributes it writes every frame, then the ones it writes on a
change, then your `onRefresh`, and parents before children. But two
attributes that write the same Pixi state will fight. `width` works by
changing `scale.x`, so a `scale` function and a `width` function on one
sprite overwrite each other, and nothing warns you.

## How Much of a JSX View Is JSX?

Open a few of this repo's JSX views and you'll notice that in many of them,
the JSX is a small part of the file. Most of the code around it is plain,
imperative TypeScript. Two views show the range.

At one end is Fuel Run's top-level game view
(`packages/sites/arcade/src/entries/fuel-run/views/game-view.tsx`). It's
almost all JSX. It puts the terrain, the ship, a `<List>` for each kind of
projectile, the HUD and the overlays together, and wires their bindings to
the model. That's a tree of views with properties, which JSX describes well.

At the other end is the Arcade's card wall
(`packages/sites/arcade/src/arcade/views/card-wall-view.tsx`). Its JSX is a
single tag:

```tsx
return (
    <section
        class="card-wall"
        aria-label="Entries"
        ref={attach}
        onUpdate={update}
        onRefresh={refresh}
        onKeyDown={onKeyDown}
        onClick={onClick}
        onDestroyed={() => observer.disconnect()}
    >
        {cards}
    </section>
);
```

Almost every attribute hands work to a plain function, and those functions
are nearly all of the file. They move the cards, handle keys and clicks,
manage the keyboard focus, and run the attract mode that plays entries on
the cards while nobody's using the page.

Most views sit between these two. JSX can only describe things shaped like a
tree of objects with properties, and a view's job includes a lot that isn't:

- **Drawing.** A `Graphics` path is a sequence of steps.
- **Working out values,** such as a sky colour that shifts through the
  seasons, or where each card sits.
- **Doing costly work only when needed,** by keeping the last value drawn and
  comparing.
- **Presentation state,** such as a timer or a selection, advanced in an
  update method.
- **Working out what input means,** such as which card an arrow key moves to.
- **Talking to things that aren't a tree,** such as the keyboard focus or a
  `ResizeObserver`.
- **Constants and tables,** such as palettes, shapes and timings.

That's normal: declarative code in any system leans on imperative helpers for
the "how". But when you choose JSX for a view, you're choosing how to write
its tree and its properties. Unless the view is mostly a tree, like Fuel
Run's, the rest is the same code you'd write by hand, and that's where most
of a view's difficult parts are.

## How This Differs from React and Solid

JSX is only syntax. Each tag compiles to a function call, and the library
decides what that call does:

| Library | When your view function runs | How the screen learns about a change |
| --- | --- | --- |
| React | Again on every change | It compares the new tree with the old one, and applies the differences |
| Solid | Once | Its compiler wraps each JSX expression, so the expression runs again when a signal it read changes |
| MVT | Once | Every function attribute is read again every frame, and nothing tracks what it read. See [Why Polling](../reacting-to-changes/why-polling.md) |

If you've used React or Solid, two things here will catch you out. Both come
from the view being built once.

**A bare condition in the tree is checked once.** In React, the first form
below shows the paused view whenever the game is paused. In MVT, it's checked
only when the view is built:

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

To present a changing set of things, use `visible`, [`<List>`](collections.md)
or `<Switch>`. They build their children ahead of time, and show or hide them.

**A plain value is read once.** In React, `x={ship.x}` is fine, because the
whole view runs again when the ship moves. In MVT, the sprite never moves. To
read the value every frame, pass a function: `x={() => ship.x}`. Both forms
compile, because an intrinsic element's attributes accept either. A view's
own bindings are safer: if a binding is typed `() => number`, TypeScript
rejects a plain number.

Because tags compile to nested calls, a child is also built before its
parent. That's why there are no context providers, a React and Solid feature
that lets a view read a value from whichever ancestor provides it. A view's
inputs are its bindings, and only its bindings.
[View Composition](view-composition.md#shared-values-in-deeply-nested-views)
shows how to share what many views need without it.

## Pros and Cons

| | JSX | Plain TypeScript |
| --- | --- | --- |
| **Reading the structure** | The nesting is the tree | You piece it together from `addChild` calls |
| **Keeping refresh complete** | Each read sits on the property it writes | You keep `refresh()` in step by hand |
| **Hidden subtrees and costly writes** | Handled by `visible` and the attributes that compare | You write the checks |
| **Collections and choices** | `<List>` and `<Switch>` | You write the pool or the switching |
| **Control over per-frame work** | Each attribute is checked on its own | You decide, such as one change check that gates many writes |
| **Cost per container** | About 5-9 ns more per frame, and about 300 bytes more memory | The least there is |
| **Debugging** | Stack traces show the runtime's refresh methods, such as `refresh3Copy1`, with `g0()` for the first binding | Your own function, line by line |
| **Static or live** | A plain value where you meant a function is quietly read only once | Live values are the ones you wrote in `refresh()` |
| **Setup** | A `.tsx` file starting `/** @jsxImportSource @mvtjs/pixi */` | Nothing |

The costs come from [Performance Measurements](../performance/measurements.md).
A frame at 60fps is about 16.7 ms, so a few nanoseconds per container only
matter with tens of thousands of containers.

## Limitations

Some of these are design decisions, and some just aren't built yet.

- **The structure is fixed when the view is built.** `<Switch>` builds every
  branch up front, unless you give a `<Match>` a function child, such as
  `{() => <BossView />}`, which builds it the first time it's shown.
- **No keyed lists.** `<List>` reuses each position's view for whatever item
  is there. If items carry presentation state across a reorder, store it by
  the item's identity, as
  [Presenting Collections](collections.md#lists-whose-items-carry-presentation-state)
  shows.
- **No text children.** `<text>Score</text>` doesn't work. Text is an
  attribute: `<text text="Score" />`, or `text` on an HTML element.
- **Drawing has no tags.** `Graphics` paths are drawn in a `ref` (once) or an
  `onRefresh` (again when something changes).
- **Only the elements in the table.** Pixi has eight intrinsic elements, such
  as `container`, `sprite` and `text`. Anything else is built in code and
  passed in as a child. `AnimatedSprite` is left out on purpose, because it
  plays itself from Pixi's ticker: give a `sprite` a `texture` function
  instead.
- **A few attribute mistakes get past TypeScript,** such as those in a spread
  object (`<sprite {...look} />`), or HTML's `data-*` attributes. An
  attribute the element doesn't have still throws when the view is built.
- **No context providers and no cleanup scopes.** A view gets everything
  through its bindings, and releases what it holds with `onDestroyed` (see
  [Releasing What a View Holds](views.md#releasing-what-a-view-holds)).

## Choosing, and Mixing

JSX tends to suit views that are mostly a tree of display objects whose
properties come from the model: sprites, text, HUDs, overlays, and views that
put child views together or present collections. Plain TypeScript tends to
suit views that mostly draw, manage their own display objects each frame (a
pool, a ring buffer), or need tight control of each frame's work. The
[Style Guide](../../reference/style-guide.md#writing-the-body) has more.

You don't have to choose for a whole game, or even a whole view. Every view
is a function that takes bindings and returns a container, so callers can't
tell which kind they're using. Inside one file, you can switch between the
two as often as you like:

- **A JSX view can use a plain TypeScript view as a tag.**
- **A JSX view can step into code** with `ref`, `onRefresh` and `onUpdate`,
  as the card wall does for almost everything.
- **A JSX view can take objects built in code as children,** as the card
  wall does with `{cards}`, built by calling `CardView` for each entry.
- **A plain TypeScript view can use JSX for one part.** A JSX expression is
  just a value, a Pixi container here, so you can add it like any other
  child. Its refresh runs every frame, because `refreshView` finds every
  refresh method in the tree, however it got there:

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

> **Try it live:** <PlaygroundLink example="traffic-light-jsx" label="Traffic Light (JSX) in Playground" /> -
> the same view as <PlaygroundLink example="traffic-light" label="Traffic Light" />,
> written in JSX. Compare how each one shows the lit light.

---

**Next:** [View Composition](view-composition.md)
