# Declarative Pixi with TSX

This demo builds a Pixi.js scene graph declaratively using TSX syntax. A
custom JSX runtime maps lowercase elements like `<container>`, `<sprite>`,
`<text>`, and `<graphics>` directly to Pixi display objects - no React, no
virtual DOM, no reactive library.

## What's Covered

- Declarative scene-graph construction from TSX
- Static and dynamic props on `<container>`, `<sprite>`, `<text>`, `<graphics>`
- Dynamic child lists via the index-addressed `<List>`, and conditional
  branches via `<Switch>`/`<Match>`
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
            <List items={bindings.getStars}>
                {(star) => (
                    <container x={() => star().x} y={() => star().y}>
                        <graphics ref={drawStar} />
                    </container>
                )}
            </List>
        </container>
    );
}
```

## What's novel about this approach

**Values vs setters.** Props accept either a static value or a getter
function. Static values (`x={12}`) are applied once at construction. Getter
functions (`x={() => star.x}` or `x={bindings.getPlayerX}`) are polled each
frame. This is the only API - no signals, no subscriptions, no setState.

**Inert construction.** Building the tree runs no getter. Each binding first
runs on the element's first refresh, once the whole tree exists, so a hidden
or skipped ancestor can keep a binding that is not yet valid (say,
`model.boss!.hp` while there is no boss) from ever running. The host refreshes
the scene before every render, so nothing is ever drawn before its bindings
have run.

**Direct per-tick updates for cheap props.** Position, alpha, rotation, and
similar numeric props are cheap to write on a Pixi display object - just a
number assignment plus an internal dirty flag. The runtime sets these
unconditionally each frame without change detection, avoiding the overhead of
a cache lookup for something that costs almost nothing to apply.

**Watch for expensive props.** A few props (`text`, `style`, `texture`,
`tint`, `width`, `height`) are expensive to set because they trigger layout
measurement, texture upload or colour parsing. These are treated like MVT's `watch()` pattern:
the getter is polled, the result is compared against the previous value with
strict equality, and the property is only written on change.

**No reconciliation.** Unlike React or similar frameworks, the JSX here is evaluated only once to build the real Pixi scene graph. There is no virtual DOM, no diffing pass, and
no re-rendering. Dynamic updates happen in-place through each element's
`onRefresh` method, driven by `refreshScene` from `src/pixi-mvt/`. An element
with a `visible` binding evaluates it first and, while hidden, skips its other
bindings and its whole subtree.

**No reactive library.** The entire mechanism is plain polling. There are no
signals, observables, effects, or subscriptions. Change detection is a simple
`!==` check on the getter's return value. This fits naturally with MVT's
ticker loop and avoids the overhead of reactive dependency tracking.

**Index-addressed lists.** The `<List>` function component reads `items`, a
source shaped like a read-only array (a `length` and an `at(i)`, which arrays
already have), or a getter returning one. It never compares items and never
reconciles: slot `i` shows whatever is at index `i` right now, re-read every
frame. When a star is spliced out of the middle of the array, the stars after
it simply show up one slot earlier, with no nodes rebuilt or moved. TypeScript
infers the item type from `items` and flows it into
the children function, which receives an accessor (`star()`) rather than a
value, as a reminder that the item is re-read each frame. Slots are built once
per index and kept; a slot with nothing in it hides and skips its whole
subtree, so its bindings never run, and slots past the end are detached until
the list grows back.

**Counting prop reads.** `propReadCounter` counts the prop reads the
runtime makes: getter props, `<List>` presence checks and `<Switch>`
conditions. It is off by default and costs a flag check per container while
off, so it is sampled rather than left on: `countPropReads(() =>
refreshScene(root))` counts one pass, and `createFrameStats` samples one frame
in each window for a perfmon. A hidden container counts only its `visible`
read, and a `memo()` getter counts as one.

**Optimisation: Codegen'd refresh functions.** The runtime generates a
specialized refresh factory (via `new Function`) for each distinct set of
bindings, and caches it. Each element gets its own small closure from that
factory, which calls its getters directly, so a refresh costs about the same
as a hand-written one. This eliminates per-frame loop overhead, object lookups, and
switch dispatch - the generated function is a flat sequence of white-listed safe assignments. This is an optional optimisation just for added performance.

**Optimisation: Memoized getters.** The standalone `memo()` helper creates a cached getter with
automatic dependency tracking. It proxies a bindings object to discover which
methods the computation calls, then only recomputes when a tracked dependency
returns a different value. It's totally optional, but useful when a dynamic prop depends on an expensive derivation (e.g. string formatting).

## Source files

| File | Purpose |
|------|---------|
| [`src/pixi-jsx/jsx-runtime.ts`](../../pixi-jsx/jsx-runtime.ts) | JSX factory - creates Pixi objects, classifies props, wires up per-frame refresh |
| [`src/pixi-jsx/list.ts`](../../pixi-jsx/list.ts) | `<List>` component - index-addressed dynamic children, no reconciliation |
| [`src/pixi-jsx/switch.ts`](../../pixi-jsx/switch.ts) | `<Switch>`/`<Match>` components - show the first branch whose condition holds |
| [`src/pixi-jsx/memo.ts`](../../pixi-jsx/memo.ts) | `memo()` - memoized getter with automatic dependency tracking |
| [`demo-view.tsx`](./demo-view.tsx) | This demo's view - shows all the patterns in action |
| [`demo-model.ts`](./demo-model.ts) | This demo's model - bouncing player, coins, dynamic stars |
| [`tsx-pixi-entry.ts`](./tsx-pixi-entry.ts) | Demo entry point - wires model to view via bindings |
