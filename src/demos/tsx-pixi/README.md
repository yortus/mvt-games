# Declarative Pixi with TSX

This demo builds a Pixi.js scene graph declaratively using TSX syntax. A
custom JSX runtime maps lowercase elements like `<container>`, `<sprite>`,
`<text>`, and `<graphics>` directly to Pixi display objects - no React, no
virtual DOM, no reactive library.

## What's Covered

- Declarative scene-graph construction from TSX
- Static and dynamic props on `<container>`, `<sprite>`, `<text>`, `<graphics>`
- Dynamic child lists via `<List>`
- Memoized derived values via `memo()`
- Pointer event handling (`onPointerTap`, etc.)
- Callback refs for imperative access (`ref`)
- Type-safe JSX intrinsic element definitions

## How it works

The scene graph is rendered **once** from JSX. After that, dynamic props are
kept in sync with model state via per-frame polling and simple change
detection - the same ticker-driven approach used throughout MVT.

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
            <container x={bindings.getPlayerX} y={bindings.getPlayerY}>
                <graphics ref={drawPlayer} />
            </container>
            <List of={bindings.getStars} to={(star) => (
                <container x={() => star.x} y={() => star.y}>
                    <graphics ref={drawStar} />
                </container>
            )} />
        </container>
    );
}
```

## What's novel about this approach

**Values vs setters.** Props accept either a static value or a getter
function. Static values (`x={12}`) are applied once at construction. Getter
functions (`x={() => star.x}` or `x={bindings.getPlayerX}`) are polled each
frame. This is the only API - no signals, no subscriptions, no setState.

**Direct per-tick updates for cheap props.** Position, alpha, rotation, and
similar numeric props are cheap to write on a Pixi display object - just a
number assignment plus an internal dirty flag. The runtime sets these
unconditionally each frame without change detection, avoiding the overhead of
a cache lookup for something that costs almost nothing to apply.

**Watch for expensive props.** A few props (`text`, `style`, `texture`,
`width`, `height`) are expensive to set because they trigger layout
measurement or texture upload. These are treated like MVT's `watch()` pattern:
the getter is polled, the result is compared against the previous value with
strict equality, and the property is only written on change.

**No reconciliation.** Unlike React or similar frameworks, the JSX here is evaluated only once to build the real Pixi scene graph. There is no virtual DOM, no diffing pass, and
no re-rendering. Dynamic updates happen in-place through `onRender` callbacks.

**No reactive library.** The entire mechanism is plain polling. There are no
signals, observables, effects, or subscriptions. Change detection is a simple
`!==` check on the getter's return value. This fits naturally with MVT's
ticker loop and avoids the overhead of reactive dependency tracking.

**Typed dynamic lists.** The `<List>` function component manages a dynamic set
of children driven by a getter. TypeScript infers the item type from the `of`
prop and flows it into the `to` callback. Internally it uses a zip-compare
reconciliation algorithm optimized for common game mutations (append, remove,
single insert/delete) with object-identity comparison - no keys needed.

**Optimisation: Version-gated reconciliation.** The `<List>` component accepts an optional
`version` getter. When provided, the zip-compare reconciliation is skipped
entirely unless the version value has changed (by `===`). This collapses N
per-item identity checks into a single comparison on unchanged frames - useful
for lists that mutate infrequently. The model naturally knows when it mutates
the list, so providing a version counter is straightforward.

**Optimisation: Codegen'd refresh functions.** At construction time, the runtime builds a
specialized refresh function (via `new Function`) for each element's exact set
of bindings. This eliminates per-frame loop overhead, object lookups, and
switch dispatch - the generated function is a flat sequence of white-listed safe assignments. This is an optional optimisation just for added performance.

**Optimisation: Memoized getters.** The standalone `memo()` helper creates a cached getter with
automatic dependency tracking. It proxies a bindings object to discover which
methods the computation calls, then only recomputes when a tracked dependency
returns a different value. It's totally optional, but useful when a dynamic prop depends on an expensive derivation (e.g. string formatting).

## Source files

| File | Purpose |
|------|---------|
| [`src/pixi-jsx/jsx-runtime.ts`](../../../pixi-jsx/jsx-runtime.ts) | JSX factory - creates Pixi objects, classifies props, wires up per-frame refresh |
| [`src/pixi-jsx/list.ts`](../../../pixi-jsx/list.ts) | `<List>` component - typed dynamic children with zip-compare reconciliation |
| [`src/pixi-jsx/memo.ts`](../../../pixi-jsx/memo.ts) | `memo()` - memoized getter with automatic dependency tracking |
| [`demo-view.tsx`](./demo-view.tsx) | This demo's view - shows all the patterns in action |
| [`demo-model.ts`](./demo-model.ts) | This demo's model - bouncing player, coins, dynamic stars |
| [`tsx-pixi-entry.ts`](./tsx-pixi-entry.ts) | Demo entry point - wires model to view via bindings |
