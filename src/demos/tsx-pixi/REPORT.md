# TSX Pixi Views for MVT - Investigation Report

## Summary

This proof of concept demonstrates **declarative Pixi.js scene-graph construction using TSX** within the
MVT architecture. The approach renders the scene graph **once** from JSX, then uses **per-element
`onRender` callbacks with simple change detection** to keep display properties in sync with model state -
no diffing, no reconciliation, no reactive library.

## Quick start

```
npm run dev
```
Open http://localhost:5173/demos/tsx-pixi.html (port may vary).

The demo shows a bouncing player collecting static coins (visibility-bound) and dynamically spawning
stars (`<list>` element), with a score text binding.

---

## How it works

### JSX factory

TypeScript's `react-jsx` transform compiles TSX elements into calls to the custom `jsx()` function
exported from `jsx-runtime.ts`. The factory:

1. Creates the appropriate Pixi display object (`Container`, `Sprite`, `Text`, `Graphics`)
2. Iterates props, classifying each as **static** or **dynamic**:
   - Static values (numbers, strings, objects) are applied once at construction
   - Functions are treated as **getters** - called immediately for the initial value, then registered for
     per-frame polling
3. Adds children to the parent container
4. Wires up `onRender` for any element that has dynamic bindings

### Dynamic bindings and change detection

Each element with at least one function-valued prop gets an `onRender` callback that runs every frame
during Pixi's render traversal. The callback:

```ts
for (let i = 0; i < dynamics.length; i++) {
    const d = dynamics[i];
    const next = d.getter();
    if (next !== d.lastValue) {        // strict equality check
        d.lastValue = next;
        applyProp(el, d.key, next);
    }
}
```

This is the same principle as MVT's `watch()` pattern: poll, compare, update only on change. The change
detection prevents unnecessary Pixi property writes (particularly important for `Text.text` which
triggers layout measurement).

### What a declarative view looks like

```tsx
/** @jsxImportSource #pixi-jsx */

function createDemoView(bindings: DemoViewBindings): Container {
    return (
        <container>
            <text
                text={() => `Score: ${bindings.getScore()}`}
                x={12} y={8}
                style={{ fill: 0xffffff, fontSize: 20 }}
            />
            <container
                x={() => bindings.getPlayerX()}
                y={() => bindings.getPlayerY()}
            >
                <graphics draw={drawPlayer} />
            </container>
            <list
                of={bindings.getStars}
                view={(star: StarModel) => (
                    <container x={() => star.x} y={() => star.y}>
                        <graphics draw={drawStar} />
                    </container>
                )}
            />
        </container>
    );
}
```

**Convention:** Static props use literal values. Dynamic props use `() => expr` arrow functions.

---

## Elements supported

| Element       | Pixi class   | Notes |
|---------------|-------------|-------|
| `<container>` | `Container` | General grouping node |
| `<sprite>`    | `Sprite`    | `texture`, `tint`, `anchor` props |
| `<text>`      | `Text`      | `text` (string), `style` (object) props |
| `<graphics>`  | `Graphics`  | `draw` callback, optional `redraw` for per-frame re-draw |
| `<list>`      | `Container` | Dynamic children from `of` getter + `view` factory |

### Common props (all elements)

`x`, `y`, `alpha`, `visible`, `rotation`, `scale`, `pivotX`, `pivotY`, `label`, `width`, `height`

All accept either a static value or `() => value` getter.

---

## Design decisions and trade-offs

### 1. Render once, poll for changes (no virtual DOM / diffing)

This is a deliberate design choice aligned with MVT's ticker-based architecture. The scene graph is
built once from JSX, then `onRender` callbacks poll bindings at ~60fps. This avoids:
- Virtual DOM allocation and diffing overhead
- Subscription/unsubscription lifecycle management
- Re-render scheduling complexity

The cost is that **every dynamic getter is called every frame** even when values haven't changed. The
equality check (`!==`) is cheap for primitives, and the actual Pixi property write only happens on
change. For the typical game frame budget (~16ms), this is well within tolerance.

### 2. Function-valued props as the binding mechanism

The `() => expr` convention is simple, explicit, and requires no framework magic. It naturally captures
MVT bindings in closure scope. The downside is that it's slightly more verbose than, say, a reactive
signal where you'd just pass `score` instead of `() => score`. But it's consistent with MVT's
pull-based philosophy and avoids introducing any reactive primitives.

**Gotcha:** The `ref` prop, event handlers (`on*`), and list props (`of`, `view`) must be excluded
from dynamic getter treatment. This is handled via a `NON_GETTER_PROPS` set.

### 3. `<list>` element for dynamic collections

The `<list of={getter} view={factory}>` element manages dynamic children. It reconciles the scene graph
against the current item array every tick using a **zip-compare** algorithm with reference equality.

**How it works:** Two indices walk the old and new arrays in parallel. When references match
(`items[ni] === prev[oi]`), both advance. On a mismatch, three cases are checked inline:

| Case | Detection | Cost |
|------|-----------|------|
| **Single insertion** | `items[ni+1] === prev[oi]` | One `addChildAt` |
| **Single deletion** | `items[ni] === prev[oi+1]` | One `removeChild` + destroy |
| **Replace (fallback)** | Neither of the above | Destroy + recreate at position, then loop continues |

After the main loop, remaining new items are appended and remaining old items are removed from the tail.

**Approach comparison:**

| Approach | No-change cost | Insert/delete | Reorder | Complexity |
|----------|---------------|---------------|---------|------------|
| **Length-only** | O(1) | Rebuild all | Not detected | Trivial |
| **Zip-compare** (current) | O(n) ref checks | Minimal (1 op) | Falls back to replace chain | Low |
| **Keyed** | O(n) map lookups | Minimal | Efficient (move) | Medium - maps, key functions |
| **Full diff (e.g. LIS)** | O(n) | Optimal | Optimal | High - LIS algorithm, move tracking |

**Why zip-compare is a good fit for games:**
- Most game lists are stable between ticks (no-change fast path is just n reference comparisons)
- Common mutations are append, remove-last, and single insert/delete - all handled optimally
- No key function needed - item identity is the object reference itself
- The replace fallback handles arbitrary changes correctly, just not optimally for bulk reorders
- Minimal code (~40 lines) with no data structures beyond a flat prev-snapshot array
- Multiple scattered changes each get detected independently as the loop progresses

### 4. `ref` prop for imperative access

The `ref` callback prop captures a reference to the created Pixi object after full construction
(children added, props applied). Each element type narrows the callback parameter:
`RefCallback<Sprite>` for `<sprite>`, `RefCallback<Graphics>` for `<graphics>`, etc.

This replaces the earlier `draw`/`redraw` approach for Graphics. Since `ref` receives the fully
constructed object, a Graphics ref callback can draw on it directly:

```tsx
<graphics ref={(g) => {
    g.circle(0, 0, 10).fill(0xff0000);
}} />
```

### 5. No external dependencies

The implementation uses only Pixi.js (already a project dependency). No React, no Solid, no custom
reactive library. TypeScript's built-in JSX support provides the compile-time transform.

### 6. Type safety

JSX elements are strongly typed through the `JSX.IntrinsicElements` interface. TypeScript validates:
- Element names (only `container`, `sprite`, `text`, `graphics`, `list` are valid)
- Prop names and types per element kind
- Return type is always `Container`

**One weakness:** The `<list>` element's `view` callback uses `any` for the item parameter because JSX
intrinsic elements cannot be generic. The workaround is explicit parameter annotation:
`view={(star: StarModel) => ...}`. An alternative would be a generic `List` function component
(`<List<StarModel> ...>`), which TypeScript does support, at the cost of the lowercase-HTML aesthetic.

---

## Configuration required

Three minimal changes to the project configuration:

1. **tsconfig.json** - add `"jsx": "react-jsx"` and `"jsxImportSource": "#pixi-jsx"`
2. **package.json** - add `#pixi-jsx/jsx-runtime` and `#pixi-jsx/jsx-dev-runtime` to the `imports` map
3. **vite.config.ts** - add the demo HTML as a build entry

Note: `"jsx": "react-jsx"` only activates for `.tsx` files. Existing `.ts` files are unaffected.
`erasableSyntaxOnly: true` does not conflict with JSX (JSX is a syntax extension, not a TypeScript
runtime feature).

The `@jsxImportSource #pixi-jsx` pragma at the top of each `.tsx` file makes the runtime explicit at the
file level, even though the global tsconfig covers it.

---

## Hot-path considerations

The per-frame `onRender` callbacks are hot-path code:

**Good:**
- No per-frame allocations in the polling loop (index-based `for`, pre-allocated `dynamics` array)
- Equality check avoids unnecessary property writes
- Each element manages only its own bindings (no tree-wide traversal)

**Trade-offs to watch:**
- Template-string getters like `` () => `Score: ${score}` `` allocate a new string each frame, but the
  `!==` comparison (which compares by value for strings) prevents the expensive `Text.text` setter from
  firing unless the string actually changed
- The `<list>` element calls `props.of()` every frame and zip-compares each item reference against
  the previous snapshot. If the getter allocates a new array (e.g., `Array.filter()`), this is a
  per-frame allocation - but the reference comparisons themselves are cheap. Callers should return a
  stable array reference with stable item references for the no-change fast path to skip entirely.

---

## Comparison: TSX view vs imperative view

### Imperative (current MVT pattern)
```ts
function createScoreView(bindings: ScoreViewBindings): Container {
    const view = new Container();
    const label = new Text({ text: '0', style: { fill: 0xffffff, fontSize: 20 } });
    view.addChild(label);
    view.onRender = () => { label.text = String(bindings.getScore()); };
    return view;
}
```

### Declarative (TSX approach)
```tsx
function createScoreView(bindings: ScoreViewBindings): Container {
    return (
        <container>
            <text text={() => String(bindings.getScore())} style={{ fill: 0xffffff, fontSize: 20 }} />
        </container>
    );
}
```

**Advantages of TSX:**
- Scene structure is immediately visible from indentation
- Less boilerplate (no `addChild` calls, no manual `onRender` wiring)
- Dynamic bindings are declared inline where the prop is used
- Easier to spot the full structure of complex views at a glance

**Advantages of imperative:**
- Full control over `onRender` logic (batching, conditional updates)
- No function-per-dynamic-prop overhead
- Can use `watch()` to batch change detection across multiple props
- More natural for complex conditional construction logic
- No JSX toolchain dependency

---

## Potential improvements

1. **Generic `<List>` component** - function component for full type inference on list items
2. **Conditional rendering** - `<show when={getter}>{children}</show>` element
3. **Batch change detection** - allow grouping multiple dynamic props into a single `watch()` call
4. **Child view composition** - support returning TSX from helper functions more naturally
5. **Keyed list reconciliation** - optional key function for efficient reorder handling (zip-compare
   covers common game patterns; keyed would add efficient moves for drag-reorder or sort scenarios)
6. **Object pooling for lists** - reuse destroyed display objects instead of creating new ones

---

## Conclusion

The TSX approach works well for MVT. It produces clean, readable view code with strong typing, while
the runtime stays pure MVT under the hood - no reactive library, no diffing, just direct Pixi scene
graph construction with ticker-polled change detection. The main trade-off is a small per-frame cost
for polling each dynamic binding, which is negligible for typical game view complexity.

The implementation requires zero external dependencies beyond what the project already uses (Pixi.js +
TypeScript JSX transform via Vite/esbuild). Configuration is minimal (3 lines in tsconfig, 2 lines in
package.json).

---

## Files

| File | Purpose |
|------|---------|
| `src/demos/tsx-pixi/jsx-runtime.ts` | JSX factory, types, change detection, list element |
| `src/demos/tsx-pixi/demo-model.ts` | Simple MVT model (bouncing player, coins, stars) |
| `src/demos/tsx-pixi/demo-view.tsx` | Demo view written in TSX with bindings pattern |
| `src/demos/tsx-pixi/demo.ts` | Entry point: Pixi app bootstrap + MVT ticker loop |
| `demos/tsx-pixi.html` | HTML page to run the demo |
