# Skill: Writing MVT Views

> Self-contained instructions for writing a correct MVT view in this
> project. Load this file before writing or modifying view code.

---

## File Structure

**[project convention]** Each view file follows this internal ordering:

```ts
// ---------------------------------------------------------------------------
// Bindings (for reusable leaf views)
// ---------------------------------------------------------------------------

// Bindings interface - the contract between the view and the outside world

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

// createXxxView() factory function implementation

// ---------------------------------------------------------------------------
// Internals (if needed)
// ---------------------------------------------------------------------------

// Internal types, constants, and helpers used only inside this file
```

Exports (bindings interface, factory function) go above all internals.

## Two Kinds of Views

**[MVT requirement]** Views fall into two categories based on how they access
state:

| Kind                    | State access               | When to use                        |
| ----------------------- | -------------------------- | ---------------------------------- |
| **Reusable leaf view**  | `bindings` object          | Entity renderers, HUD panels, any view that could be reused across contexts |
| **Top-level app view**  | Model reference directly   | Application-specific root views that are never reused |

Leaf views define a bindings interface. Top-level views accept the model type
directly.

## The `refresh()` Contract

**[MVT requirement]** A view's `refresh()` function is called once per frame,
after all models have updated. It reads current state and updates the
presentation to match.

Key principles:

- **Reactive** - all binding values must be re-read in `refresh()`, never
  cached at construction time. Values may change between frames.
- **Idempotent** - calling `refresh()` twice with the same state produces
  the same result.
- **No side effects** - `refresh()` reads state and writes to the presentation
  layer. It does not mutate models, emit events, or trigger transitions.

## Bindings Pattern

**[MVT requirement for reusable views]** Reusable leaf views accept a
`bindings` object with:

- `get*()` - read-only state accessors (e.g. `getScore(): number`)
- `on*()` - user-input event handlers (e.g. `onDirectionChanged(dir): void`)

```ts
interface ScoreViewBindings {
    getScore(): number;
}

function createScoreView(bindings: ScoreViewBindings): Container {
    const view = new Container();
    const label = new Text({ text: '0', style: scoreStyle });
    view.addChild(label);

    function refresh(): void {
        label.text = String(bindings.getScore());
    }

    view.onRender = refresh;
    return view;
}
```

### Binding Rules

- **Never cache** binding values at construction time. Always call
  `bindings.get*()` inside `refresh()`.
- **`on*()` bindings should usually be optional.** This keeps views usable in
  more contexts without forcing no-op handlers.
- **Bindings are wired at the construction site** (typically a parent view).
  The view does not know how it is connected to the model.

## Scene Graph Construction

**[project convention]** Views in this project use Pixi.js. Build the scene
graph once at construction time, then update it each frame in `refresh()`:

```ts
function createEntityView(bindings: EntityViewBindings): Container {
    const view = new Container();
    const gfx = new Graphics();
    gfx.circle(0, 0, 4).fill(0xffffff);
    view.addChild(gfx);

    function refresh(): void {
        view.visible = bindings.isVisible();
        view.position.set(bindings.getX(), bindings.getY());
    }

    view.onRender = refresh;
    return view;
}
```

Key points:
- Create display objects (`Container`, `Graphics`, `Text`, `Sprite`) once.
- In `refresh()`, update properties (position, scale, alpha, visibility,
  text, tint) - do not recreate display objects.
- Return the root `Container`. The parent view adds it to its own container.

## Using `onRender`

**[project convention]** This project hooks `refresh()` to Pixi's `onRender`
callback, which fires once per frame during the render traversal:

```ts
view.onRender = refresh;
```

This avoids manual call-site management - the view refreshes automatically
as long as it is in the scene graph. When removed from the scene graph, the
callback stops firing.

## Change Detection (Watch)

**[project convention]** For bindings that change rarely but trigger expensive
work (rebuilding a grid, recreating child views), use the `watch()` helper:

```ts
import { watch } from '../../common';

const watcher = watch({
    rows: bindings.getRows,
    cols: bindings.getCols,
});

function refresh(): void {
    const w = watcher.poll();
    if (w.rows.changed || w.cols.changed) {
        rebuildGrid(w.rows.value, w.cols.value);
    }
    // Always update positions, etc.
    view.position.set(bindings.getX(), bindings.getY());
}
```

Use change detection for infrequent, expensive updates. For cheap per-frame
updates (position, alpha, visibility), read directly without watching.

## Presentation State

**[MVT requirement]** Most views are pure projections - read state, update
scene graph. Occasionally a view needs its own state for a cosmetic transition
that the model doesn't track (the model has no reason to track it because no
domain outcome depends on it).

Views with presentation state gain an `update(deltaMs)` method. The ticker
calls `view.update(deltaMs)` after models update. Parent views propagate
`update()` to children that have it.

When the presentation logic grows complex enough to warrant separate testing,
extract it into a **view model** - a technique borrowed from MVVM:
- The view model is a plain object with `update(deltaMs)` and readable state
- Created and owned by the view that uses it (an internal detail)
- Has no view or scene-graph dependencies (no Pixi.js imports)
- Independently testable

When multiple views share a view model, the nearest common parent creates
the view model and passes it to both views.

For the simplest cases (a single tweened value with trivial logic), inline
presentation state in the view is acceptable. The view gains an
`update(deltaMs)` method so the ticker can advance its state:

```ts
let displayedScore = 0;

function update(deltaMs: number): void {
    const target = bindings.getScore();
    const t = 1 - Math.pow(0.002, deltaMs / 1000);
    displayedScore += (target - displayedScore) * t;
    if (Math.abs(target - displayedScore) < 1) displayedScore = target;
}

function refresh(): void {
    label.text = String(Math.round(displayedScore));
}
```

As soon as the presentation state grows beyond a single value, or the timing
logic warrants unit testing, extract it into a view model. Never hardcode
frame deltas (`timerMs += 16`). Never compute `deltaMs` from `Date.now()`.

## Hot-Path Rules for `refresh()`

`refresh()` runs every tick (~60fps). Avoid per-tick heap allocations:

| Avoid                                   | Prefer                                         |
| --------------------------------------- | ---------------------------------------------- |
| `array.map()`, `.filter()`, `.slice()`  | Index-based `for` loop                         |
| `for...of` on arrays                    | `for (let i = 0; i < arr.length; i++)`         |
| Template-string keys                    | Arithmetic encoding (`r * cols + c`)           |
| Inline closures                         | Hoisted functions or pre-bound references      |
| `String()` conversion every frame       | Change detection to update text only on change |
| Spread (`[...arr]`)                     | Direct index access                            |

## Forbidden Patterns - Quick Reference

| Pattern                                    | Rule            | Fix                                           |
| ------------------------------------------ | --------------- | --------------------------------------------- |
| Domain state in a view                     | V-stateless     | Move to the model                             |
| Complex presentation logic in a view       | V-presentation  | Extract to a view model                       |
| Hardcoded frame delta (`timerMs += 16`)    | V-presentation  | Use `update(deltaMs)` on the view             |
| Caching binding values at construction     | V-reactive      | Read `get*()` inside `refresh()`              |
| Mutating models in `refresh()`             | V-readonly      | Use `on*()` bindings for input relay          |
| `setTimeout` / `setInterval` in a view     | V-stateless     | Use `update(deltaMs)` on the view             |
| Computing own deltaMs from `Date.now()`    | V-presentation  | Receive `deltaMs` from the ticker             |
| Using `class`                              | Style           | Factory function + plain record               |
| Using `enum` or const-object enum          | Style           | String-literal union                          |
| Using `null`                               | Style           | Use `undefined`                               |
| `array.map()` in `refresh()` hot path      | H-alloc         | Index-based `for` loop                        |

## Complete Minimal Example

A reusable entity view with position and visibility bindings:

```ts
import { Container, Graphics } from 'pixi.js';

// ---------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------

interface EntityViewBindings {
    getX(): number;
    getY(): number;
    isVisible(): boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function createEntityView(bindings: EntityViewBindings): Container {
    const view = new Container();
    const gfx = new Graphics();
    gfx.circle(0, 0, 4).fill(0xffffff);
    view.addChild(gfx);

    view.onRender = refresh;
    return view;

    function refresh(): void {
        view.visible = bindings.isVisible();
        view.position.set(bindings.getX(), bindings.getY());
    }
}
```

## Full References

- [Views (Learn)](../building-with-mvt/presenting-the-world/views.md) - introduction from scratch
- [Bindings (Learn)](../building-with-mvt/presenting-the-world/bindings.md) - the bindings pattern
- [Bindings in Depth](../building-with-mvt/presenting-the-world/bindings-in-depth.md) - advanced bindings topics
- [Change Detection](../building-with-mvt/reacting-to-changes/change-detection.md) - the Watch pattern
- [View Composition](../building-with-mvt/presenting-the-world/view-composition.md) - view hierarchies
- [Presentation State](../building-with-mvt/adding-visual-polish/presentation-state.md) - view models and presentation state
- [Architecture Rules](../architecture/rules.md) - all view rules (V-stateless through V-tree)
- [Style Guide](../reference/style-guide.md) - naming, formatting, file structure
- [Hot Paths](../building-with-mvt/avoiding-pitfalls/hot-paths.md) - performance rules for `refresh()`
