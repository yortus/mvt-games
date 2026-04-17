# Bindings in Depth

> Advanced bindings topics: optional `get*()` and `on*()` members, reactive
> binding rules, and a decision framework for choosing how views access state.

**Related:** [Bindings (Learn)](../learn/bindings.md) · [Views (Learn)](../learn/views.md) ·
[View Composition](view-composition.md)

---

*Assumes familiarity with [Bindings](../learn/bindings.md) and [Views](../learn/views.md).*

## Optional `on*()` Bindings

`on*()` bindings should usually be **optional**. A view emits events for user
input, but the consumer decides whether and how to respond. Not every consumer
will use every event. For example, a gamepad input view may report direction
and fire events, but a simple game might only care about direction.

Declaring `on*()` members as optional keeps the view usable in more contexts
without forcing callers to supply no-op handlers.

Inside the view, call optional `on*()` bindings with optional chaining:

```ts
interface InputViewBindings {
    onDirectionChange?(dir: Direction): void;
    onFireChange?(pressed: boolean): void;
}

// In the view's event handler:
bindings.onDirectionChange?.(dir);
bindings.onFireChange?.(true);
```

## Optional `get*()` Bindings

`get*()` bindings may also be optional, but **only when there is one obvious
default value**. This applies to properties where omission clearly means "use
the standard value" rather than "the caller forgot to provide it."

When a `get*()` binding is optional, the view should document the default and
apply it with a nullish-coalescing fallback:

```ts
interface PanelViewBindings {
    getLabel(): string;         // required - no sensible default
    getOpacity?(): number;      // optional - defaults to 1 (fully opaque)
    getVisible?(): boolean;     // optional - defaults to true
}

// In the view's refresh():
const opacity = bindings.getOpacity?.() ?? 1;
const visible = bindings.getVisible?.() ?? true;
```

When in doubt, keep `get*()` bindings required. A missing accessor is usually
a wiring bug, and TypeScript catching it at the call site is valuable.

## Reactive Bindings

Bindings are **reactive** - their values may change between frames. A view must
never cache a binding's return value at construction time and assume it will
stay the same. Every value a view depends on must be re-evaluated in
`refresh()`, either by calling the binding directly or through change
detection (see [Change Detection](change-detection.md)).

```ts
// Wrong - cached at construction, never re-evaluated
function createBadView(bindings: MyBindings): Container {
    const rows = bindings.getRows(); // frozen forever
    // ...
}
```

```ts
// Correct - re-evaluated every frame
function createGoodView(bindings: MyBindings): Container {
    const container = new Container();

    function refresh(): void {
        const rows = bindings.getRows(); // always current
        // ...
    }

    container.onRender = refresh;
    return container;
}
```

This guarantees that if the model replaces its internal state (e.g. on reset),
the view automatically picks up the new values on the next frame without any
manual notification wiring.

## Choosing How Views Access State

Not every view needs a full `get*()`/`on*()` bindings interface. MVT
recognises three access patterns - choose by reuse potential and data-source
complexity.

### Decision criteria

| View kind                                        | Access pattern                                                     | Rationale                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------- |
| **Top-level application view**                   | Accept model(s) + config directly                                  | Application-specific; largest bindings surface; no reuse scenario   |
| **Reusable leaf view**                           | `get*()`/`on*()` bindings interface                                | Small interface cost; genuine reuse; absorbs model-shape mismatches |
| **Static config** (tile size, screen dimensions) | Import from a data module (application-specific) or plain parameter | Never changes at runtime; not reactive state                        |

### Why top-level views skip bindings

An application's top-level view (the one that orchestrates all sub-views) is
the **least** likely to be reused elsewhere - it exists to wire this
application's specific sub-views together. It is also the view with the
**largest** bindings surface: every property in every collection must be
projected through indexed accessors. Letting it read model properties directly
eliminates that entire layer.

Because the top-level view accesses models directly, it wires sub-view
bindings from model properties without an intermediate bindings interface:

```ts
function createGameView(game: GameModel): Container {
    const hudContainer = createHudView({
        getScore: () => game.score.score,
        getLives: () => game.score.lives,
    });

    for (let i = 0; i < game.entities.length; i++) {
        const entity = game.entities[i];
        createEntityView({
            getX: () => entity.x,
            getY: () => entity.y,
        });
    }
}
```

### Why leaf views use bindings

Smaller, focused views - entity renderers, HUD panels, overlays - are natural
candidates for reuse. The `get*()`/`on*()` bindings interface gives them an
adapter layer: if a model's property is named `posX` but the view expects
`getX()`, only the wiring changes - neither the model nor the view needs
modifying. With direct structural access, one or both would need to change.

---

For the basics of bindings, see [Bindings (Learn)](../learn/bindings.md).
