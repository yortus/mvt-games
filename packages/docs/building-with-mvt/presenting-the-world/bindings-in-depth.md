# Bindings in Depth

> Advanced bindings topics: optional query and relay bindings, fixed and
> changeable binding values, and a decision framework for choosing how views
> access state.

**Related:** [Bindings (Learn)](bindings.md) · [Views (Learn)](views.md) ·
[View Composition](view-composition.md) · [Presenting Collections](collections.md)

---

*Assumes familiarity with [Bindings](bindings.md) and [Views](views.md).*

## Optional Relay Bindings

Relay bindings should usually be **optional**. A view reports user input, but
the consumer decides whether and how to respond. Not every consumer will use
every input. For example, a gamepad input view may report direction and fire
presses, but a simple game might only care about direction.

Declaring relay bindings as optional keeps the view usable in more contexts
without forcing callers to supply no-op handlers.

Inside the view, call optional relay bindings with optional chaining:

```ts
interface InputViewBindings {
    onDirectionChanged?: (dir: Direction) => void;
    onFireChanged?: (pressed: boolean) => void;
}

// In the view's event handler:
bindings.onDirectionChanged?.(dir);
bindings.onFireChanged?.(true);
```

## Optional Query Bindings

Query bindings may also be optional, but **only when there is one obvious
default value**. This applies to properties where omission clearly means "use
the standard value" rather than "the caller forgot to provide it."

When a query binding is optional, the view should document the default and
apply it with a nullish-coalescing fallback:

```ts
interface PanelViewBindings {
    label: () => string;         // required - no sensible default
    opacity?: () => number;      // optional - defaults to 1 (fully opaque)
    isVisible?: () => boolean;   // optional - defaults to true
}

// In the view's refresh():
const opacity = bindings.opacity?.() ?? 1;
const isVisible = bindings.isVisible?.() ?? true;
```

When in doubt, keep query bindings required. A missing binding is usually a
wiring bug, and TypeScript catching it at the call site is valuable.

## Fixed and Changeable Binding Values

A query binding's type says whether the view supports its value changing:

| Declared as        | Callers pass         | What it says about the view                                          |
| ------------------ | -------------------- | -------------------------------------------------------------------- |
| `() => T`          | A function           | Supports the value changing: calls it every refresh                  |
| `T`                | A fixed value        | Does not support the value changing: reads it once, at construction  |
| `ValueOrGetter<T>` | Whichever suits them | Supports the value changing, and accepts a fixed value too           |

### Changeable values

Most query bindings are functions, and the view follows them however their
values change. That is the flexible choice, and the right one for anything
read from model state: a view that follows a changing size or label can be
used in more places than one that assumes it never changes.

Supporting change has one cost: the view must re-read the value in
`refresh()` every frame, either by calling the binding directly or through
[change detection](../reacting-to-changes/change-detection.md), which keeps a
rarely-changing value cheap to follow. It must never read the value once at
construction and keep the result. (Nothing notifies the view of a change: MVT
polls rather than pushes, so re-reading is how a view follows a value.)

```ts
// Wrong - read once at construction, never re-read
function BadView(bindings: MyViewBindings): Container {
    const rows = bindings.rows(); // frozen forever
    // ...
}

// Correct - re-read every frame
function GoodView(bindings: MyViewBindings): Container {
    const view = new Container();

    function refresh(): void {
        const rows = bindings.rows(); // always current
        // ...
    }

    setRefresh(view, refresh);
    return view;
}
```

This guarantees that if the model replaces its internal state (e.g. on reset),
the view picks up the new values on the next frame without any manual
notification wiring. A view that declares a function but reads it only once
breaks that promise silently; if it cannot follow a change, it should declare
a fixed value instead.

### Fixed values

Some views are built around a value, though, such as the number of columns
in a ring buffer, or a size that shapes their whole layout. Following a change
to it means rebuilding the view's structure, which may not be worth writing
yet. Such a view can declare the value as a plain `T`. That is an honest
statement of a limitation: the view reads the value once, at construction,
and does not support it changing. Callers see the limitation in the type, and
cannot pass a function by mistake.

```ts
interface TerrainViewBindings {
    /** May change every frame. */
    scrollCol: () => number;
    /** Sizes the view's ring buffer of columns. Dynamic change is not supported. */
    visibleCols: number;
    tileSize: number;
}

function TerrainView(bindings: TerrainViewBindings): Container {
    const { visibleCols, tileSize } = bindings; // fixed values: read once
    // ...
    function refresh(): void {
        const scrollCol = bindings.scrollCol(); // followed every frame
        // ...
    }
}
```

A limitation declared this way can be relaxed later without breaking anyone.
Widening `T`, or `() => T`, to `ValueOrGetter<T>` leaves every call site
passing something the view accepts.

### In this project

- **Model state** is `() => T`: it changes, so the view must follow it.
- **A value the view does not support changing** is `T`, as a stated
  limitation, until supporting change is worth the work.
- **Views reused with both fixed and changing values**, like the shared views
  in `packages/website/src/shared/`, can take `ValueOrGetter<T>` from `@mvtjs/pixi`, which accepts
  a fixed value or a function. The JSX runtime's own attributes work this way:
  `x={12}` is set once, `x={() => model.x}` every frame.

The
[architecture page](../../architecture/bindings.md#fixed-and-changeable-binding-values)
covers the trade-offs in full, including why accepting both depends on the
language.

## Choosing How Views Access State

Not every view needs a full bindings interface. MVT recognises three access
patterns - choose by reuse potential and data-source complexity.

### Decision criteria

| View kind                                        | Access pattern                                                      | Rationale                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Top-level application view**                   | The model(s) itself                                                 | Application-specific; largest bindings surface; no reuse scenario   |
| **Reusable leaf view**                           | Query and relay bindings                                            | Small interface cost; genuine reuse; absorbs model-shape mismatches |
| **Static config** (tile size, screen dimensions) | Import from a data module (application-specific) or use a fixed query binding   | Never changes at runtime; not reactive state                        |

### Why top-level views skip bindings

An application's top-level view (the one that orchestrates all sub-views) is
the **least** likely to be reused elsewhere - it exists to wire this
application's specific sub-views together. It is also the view with the
**largest** bindings surface: every property in every collection would have
to be projected through indexed bindings. Letting it read model properties
directly eliminates that entire layer.

In this project, the top-level view takes the model as its one binding, and
wires its sub-views' bindings from model properties:

```ts
function GameView(bindings: GameViewBindings): Container {
    const { model } = bindings;
    const view = new Container();

    view.addChild(HudView({
        score: () => model.score.score,
        lives: () => model.score.lives,
    }));

    for (let i = 0; i < model.bullets.length; i++) {
        const bullet = model.bullets[i];
        view.addChild(BulletView({
            x: () => bullet.x,
            y: () => bullet.y,
        }));
    }

    return view;
}
```

A collection whose length changes is better projected with a `<List>`, which
reuses its item views as the collection grows and shrinks; see
[Presenting Collections](collections.md).

### Why leaf views use bindings

Smaller, focused views - views of single game objects, HUD panels, overlays - are natural
candidates for reuse. The bindings interface gives them an adapter layer: if a
model's property is named `posX` but the view expects `x`, only the wiring
changes - neither the model nor the view needs modifying. With direct
structural access, one or both would need to change.

---

For the basics of bindings, see [Bindings (Learn)](bindings.md).
