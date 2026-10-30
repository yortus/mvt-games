# Bindings

> Bindings are the contract between a view and the rest of the application.
> *Query bindings* read state; *relay bindings* report user input. This keeps
> views decoupled from models and independently testable.

**Previous:** [Views](views.md) · **Next:** [Declarative Views](declarative-views.md)

---

## What are Bindings?

A bindings object is a plain object that a view receives when it is built,
with two kinds of members:

| Kind               | Purpose             | Direction     | Example                                    |
| ------------------ | ------------------- | ------------- | ------------------------------------------ |
| **Query binding**  | Read current state  | Model -> View | `x: () => number`                          |
| **Relay binding**  | Report user input   | View -> Model | `onTapped: (x: number, y: number) => void` |

In this project, a query binding is named for what it returns (`x`, `score`,
`isVisible`), and a relay binding is `on` followed by what the user did
(`onTapped`, `onFirePressed`). That naming is a project convention, not an MVT
requirement; see
[Style Guide: Views and Bindings](../../reference/style-guide.md#views-and-bindings).
For the language-neutral specification, see
[Architecture: Bindings](../../architecture/bindings.md).

```mermaid
sequenceDiagram
    participant User
    participant View
    participant Bindings
    participant Model

    Note over View,Model: Every frame (driven by Ticker)
    View->>Bindings: x(), y()
    Bindings->>Model: read position
    Model-->>Bindings: 120, 80
    Bindings-->>View: 120, 80
    View->>View: update presentation

    Note over User,Model: On user input
    User->>View: tap screen
    View->>Bindings: onTapped(x, y)
    Bindings->>Model: handle tap
```

## A Minimal Example

A view that tracks a moving bullet's position:

```ts
interface BulletViewBindings {
    x: () => number;
    y: () => number;
    isVisible: () => boolean;
}

function BulletView(bindings: BulletViewBindings): Container {
    const view = new Container();
    const gfx = new Graphics();
    gfx.circle(0, 0, 4).fill(0xffffff);
    view.addChild(gfx);

    function refresh(): void {
        view.visible = bindings.isVisible();
        view.position.set(bindings.x(), bindings.y());
    }

    setRefresh(view, refresh);
    return view;
}
```

The bindings interface is a complete list of everything the view needs - no
hidden coupling, no guessing about dependencies.

## Query Bindings Read State, Relay Bindings Report User Input

The two kinds of bindings serve opposite directions:

**Query bindings** are usually functions, which the view calls every frame
in `refresh()`. Most take no arguments, like `x()`, and are called
[getters](../../reference/glossary.md). Some take arguments that pick a
value, like `tileKindAt(row, col)`. Each one returns the current value of
some state the view presents, typically read from a model. The view uses it
to update the presentation output.

**Relay bindings** are called in response to user input (key presses, taps,
mouse clicks). Each one reports what the user did, typically to a model
method, where it will be processed on the next `update()` call. Name a relay
binding for what the user did, not for what it should cause: `onFirePressed`
reports an input, where `onShoot` would decide what the input means, which is
the wiring's job, not the view's.

```ts
interface ButtonViewBindings {
    label: () => string;
    isEnabled: () => boolean;
    onClicked?: () => void;
}

interface DragViewBindings {
    x: () => number;
    y: () => number;
    onDragged?: (x: number, y: number) => void;
}
```

## Why Not Just Pass the Model?

Three concrete benefits of the bindings indirection:

- **Decoupling** - the view doesn't know which model (or mock) provides the
  data. Swap implementations freely.
- **Testability** - pass mock bindings returning fixed values; assert the view
  renders correctly without needing a real model.
- **Explicit dependencies** - the bindings type is a complete manifest of
  everything the view needs.

## Wiring Bindings

The code that constructs the view is responsible for wiring its bindings -
answering its query bindings from model properties and connecting its relay
bindings to model methods. This typically happens in a parent view:

```ts
function GameView(bindings: GameViewBindings): Container {
    const { model } = bindings;
    const view = new Container();

    // Wire HUD bindings from model properties
    view.addChild(
        HudView({
            score: () => model.score,
            lives: () => model.lives,
            wave: () => model.wave,
        }),
    );

    // Wire the ship's bindings from a child model
    view.addChild(
        ShipView({
            x: () => model.ship.x,
            y: () => model.ship.y,
            angle: () => model.ship.angle,
            isAlive: () => model.ship.isAlive,
            isThrusting: () => model.ship.isThrusting,
        }),
    );

    return view;
}
```

Each query binding here is a getter, an arrow function that reads a model
property. The child view doesn't know the model exists - it only sees its bindings
interface. The same wiring in a JSX body reads as a tree:

```tsx
function GameView(bindings: GameViewBindings): Container {
    const { model } = bindings;
    return (
        <container>
            <HudView
                score={() => model.score}
                lives={() => model.lives}
                wave={() => model.wave}
            />
            <ShipView
                x={() => model.ship.x}
                y={() => model.ship.y}
                angle={() => model.ship.angle}
                isAlive={() => model.ship.isAlive}
                isThrusting={() => model.ship.isThrusting}
            />
        </container>
    );
}
```

A view is the same function either way, so `HudView` works as a tag and as a
plain call, whichever kind of body `HudView` itself has.

## Functions Must Be Re-read Every Frame

A query binding given as a function may return a different value each
frame. A view must never call it once at construction and keep the result:

```ts
// Wrong - read once at construction, never updates
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

If the model replaces its internal state (e.g. on reset), the view
automatically picks up the new values on the next frame.

A view that does not support a value changing, such as a size its whole
layout is built around, says so in its bindings type. It takes a fixed
value, `rows: number`, rather than a getter, `rows: () => number`. That
states a limitation, which can be relaxed later without breaking callers.
A function with arguments has no fixed form, so a view that calls one less
often says so in the binding's doc comment instead. See
[Bindings in Depth](bindings-in-depth.md#fixed-values-and-functions).

## A Binding for Each Value, or the Whole Model

Not every view needs a binding for each value it shows. MVT recognises three access patterns:

| View kind                      | Access pattern                  | Rationale                                      |
| ------------------------------ | ------------------------------- | ---------------------------------------------- |
| **Top-level application view** | The model(s), as fixed values   | Application-specific; biggest bindings savings |
| **Leaf / reusable view**       | Query and relay bindings        | Small interface cost; genuine reuse potential  |
| **Static configuration**       | Ambient constants               | Never changes at runtime; not reactive state   |

**Top-level views** are the least likely to be reused - they exist to wire this
specific application's sub-views together. They're also the views with the
largest bindings surface area. Giving them the model itself as a binding, and
letting them read its properties, eliminates an entire adapter layer. The model
is a fixed value. The view reads the binding once, and reads the model's
properties on every refresh. In this project, that binding is named `model`
(`GameView({ model })`).

**Leaf views** (views of single game objects, HUD panels, overlays) are natural reuse
candidates. The bindings interface gives them an adapter layer: if a model's
property is named `posX` but the view expects `x`, only the wiring
changes.

For more on optional bindings, fixed values and getters, and
advanced access patterns, see [Bindings in Depth](bindings-in-depth.md).

---

**Next:** [Declarative Views](declarative-views.md)
