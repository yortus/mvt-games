# Proposal: an authoring-convention bridge between bindings-views and JSX

> MVT has two view-authoring conventions - imperative `bindings` (`get*`/`on*`)
> and JSX `props` (bare getters/`onXxx`). This proposes keeping both, authoring
> each in its own idiom, and crossing between them with a strongly-typed
> transform. The transform is a pure key-rename: the underlying values are
> identical, so it is total, reversible, and costs one construction-time pass.

**Status:** proposed, not implemented. A throwaway proof (section 11) has been
run and type-checked; nothing has been added to `src/`.

**Related:** [`src/pixi-jsx/`](../../src/pixi-jsx/index.ts) (the JSX runtime and its
prop model) and [001 - MVT plugin rework](../archive/001-mvt-plugin-rework-plan.md), now
implemented: the `mvt-container` mixin gives every `Container` uniform
`onUpdate`/`onRefresh` methods, which is what leaves accessor key naming as the
*only* divergence for this transform to bridge (section 6).

---

## 1. Summary

| | Imperative leaf view | JSX view |
| --- | --- | --- |
| Factory | `createFooView(bindings)` | `FooView(props)` (PascalCase) |
| Read accessor | `getThing(): T` | `thing: () => T` |
| Event handler | `onWaa(x): void` | `onWaa(x): void` |
| Return | `Container` | `Container` |
| Refresh method | `view.onRefresh = refresh` | per-prop `onRefresh` codegen |
| Update method (if stateful) | `view.onUpdate = update` | `view.onUpdate = update` |

The two conventions differ in exactly one respect that a machine can see: the
**key name** of a read accessor (`getThing` vs `thing`). Everything else - the
value at that key, the event-handler keys, optionality, function signatures - is
identical. That single fact is the whole basis of this proposal:

1. Keep both conventions. Author imperative leaf views with `bindings`; author
   JSX with bare props. Neither side changes.
2. Provide a strongly-typed transform, `PropsFromBindings<B>` /
   `BindingsFromProps<P>` plus two one-line runtime adapters, that renames keys
   at a construction boundary so a view written in one convention is consumable
   under the other.
3. Nothing else needs bridging. Since 001 shipped, presentation state rides on
   the mixin's `onUpdate` method and refresh on `onRefresh` - both uniform across
   the two conventions - so accessor key naming is the one remaining difference.

Net effect: zero migration of the 50 existing `*ViewBindings` interfaces, the
JSX runtime is untouched, and cross-consumption becomes a typed one-liner.

---

## 2. The two conventions today

### 2.1 Imperative bindings-view

A leaf view takes a `bindings` record of `get*` accessors and `on*` handlers,
and self-refreshes through a Pixi container method. From
[ghost-view.ts](../../src/games/pacman/views/ghost-view.ts):

```ts
export interface GhostViewBindings {
    getRow(): number;
    getCol(): number;
    getColor(): number;
    getTileSize(): number;
}

export function createGhostView(bindings: GhostViewBindings): Container {
    // ...
    view.onRefresh = refresh;
    return view;
}
```

This shape is pervasive: **50 `*ViewBindings` interfaces** across the cabinet,
`common/`, and every game (pacman, galaga, digdug, scramble, asteroids, cactii,
ik). It is the load-bearing convention of the repo.

### 2.2 JSX view

The same idea in JSX drops the `get` prefix - a prop is a bare getter - because
intrinsic elements already name their props after Pixi's own container
properties. From [demo-view.tsx](../../src/demos/tsx-pixi/demo-view.tsx) and the
runtime's prop model in [jsx-runtime.ts](../../src/pixi-jsx/jsx-runtime.ts):

```tsx
<container x={getPlayerX} y={getPlayerY} rotation={getPlayerAngle}>
    <graphics ref={drawPlayer} />
</container>
```

where `getPlayerX` is a getter closure over the model, wired in
[tsx-pixi-entry.ts](../../src/demos/tsx-pixi/tsx-pixi-entry.ts):

```ts
const view = createDemoView({
    getPlayerX: () => model.playerX,
    getPlayerY: () => model.playerY,
    // ...
    onCoinTap: (index) => model.collectCoin(index),
});
```

Note the same getter, `() => model.playerX`, is written into a `getPlayerX`
binding and read through an `x={...}` prop with no change. The two worlds
already exchange the identical function; only the key it lives under differs.

---

## 3. The core insight: same value, different key

A bindings accessor `getRow(): number` has the type `() => number`. A JSX prop
`row: () => number` has the type `() => number`. They are the same value. An
event handler `onWaa(x): void` keeps its name in both worlds. Therefore the
transform between the two interfaces is a **pure key rename**, and the values
pass through untouched:

```
getRow  ->  row        (strip "get", uncapitalize)
onWaa   ->  onWaa      (unchanged)
```

Because values are never rewritten, the transform is:

- **reversible** - `row -> getRow` recovers the original exactly;
- **allocation-free per accessor** - the same function object is reused, not
  wrapped;
- **hot-path-safe** - it runs once, at view construction, never per frame.

This is what makes option 3 cheap. A transform that had to *widen* or *wrap*
values (say, adapt a `refresh()` protocol) would not round-trip and would risk
per-frame cost. This one does neither.

---

## 4. Why not standardise on one convention

Both single-convention options were considered and rejected on concrete
grounds, not taste.

### 4.1 MVT-only everywhere (bare `getThing` in JSX too) - not viable

Intrinsic JSX elements map bare prop names straight onto Pixi container
properties ([jsx-runtime.ts](../../src/pixi-jsx/jsx-runtime.ts) `applyProp`:
`x -> el.x`, `y -> el.y`, `alpha -> el.alpha`). You cannot write
`<container getX={...}>` without renaming Pixi's own properties and rewriting the
runtime. So a JSX tree would be forced to mix `<container x={...}>` with
`<Ghost getRow={...}>` - two naming rules inside one tag soup. This is a
mechanical blocker, not a preference.

### 4.2 JSX-only everywhere (bare `thing` in imperative code too) - too costly

Migrating 50 `*ViewBindings` interfaces plus the `memo()` helper (which proxies
bindings by method name, [memo.ts](../../src/pixi-jsx/memo.ts)) buys little and
loses signal: `get`/`on` distinguishes a poll-me accessor from an event handler
in a plain record, and `bindings.getRow()` reads more clearly than
`bindings.row()` at an imperative call site. There is also a hazard: the JSX
runtime treats only `onPointer*` as events; any other `on*` prop on an
*intrinsic* element is misclassified as a getter and polled. So a bare `on*`
convention is safe on function components but not universally.

**Conclusion:** each convention is right for its own medium. Keep both; bridge
them.

---

## 5. The design

### 5.1 Type transforms

```ts
// A prop may be a static literal or a getter polled each frame. This is the JSX
// runtime's existing prop model, renamed from `MaybeGetter` (section 8): `Maybe`
// conventionally means optionality, which this union has nothing to do with.
type ValueOrGetter<T> = T | (() => T);

// bindings interface -> JSX props interface (key rename only)
type PropsFromBindings<B> = {
    [K in keyof B as
        K extends `get${infer R}` ? Uncapitalize<R> :
        K extends `on${string}` ? K :
        K
    ]: B[K];
};

// JSX props interface -> bindings interface (the exact inverse)
type BindingsFromProps<P> = {
    [K in keyof P as
        K extends `on${string}` ? K :
        K extends `get${string}` ? K :
        `get${Capitalize<string & K>}`
    ]: P[K];
};
```

Both are homomorphic mapped types, so they **preserve optionality and
`readonly`** and keep each value's exact type (including event-handler
parameters). The pair round-trips:

```ts
BindingsFromProps<PropsFromBindings<B>>  is  B
```

Worked type (verified, section 11):

```ts
type GhostProps = PropsFromBindings<GhostViewBindings>;
// {
//     row(): number;
//     col(): number;
//     color(): number;
//     tileSize(): number;
//     onCoinTap?(index: number): void;   // optional + args preserved
// }
```

### 5.2 Runtime transforms

```ts
export function propsFromBindings<B extends object>(bindings: B): PropsFromBindings<B> {
    const out: Record<string, unknown> = {};
    for (const key in bindings) {
        const value = (bindings as Record<string, unknown>)[key];
        if (key.startsWith('get') && key.length > 3 && key[3] === key[3].toUpperCase()) {
            const rest = key.slice(3);
            out[rest.charAt(0).toLowerCase() + rest.slice(1)] = value;
        }
        else {
            out[key] = value; // on*, and any non-accessor key, pass through
        }
    }
    return out as PropsFromBindings<B>;
}

export function bindingsFromProps<P extends object>(props: P): BindingsFromProps<P> {
    const out: Record<string, unknown> = {};
    for (const key in props) {
        const value = (props as Record<string, unknown>)[key];
        if (key.startsWith('on') || key.startsWith('get')) {
            out[key] = value;
        }
        else {
            out['get' + key.charAt(0).toUpperCase() + key.slice(1)] = value;
        }
    }
    return out as BindingsFromProps<P>;
}
```

Each is one `for...in` over a handful of keys, called once per view
construction. Nothing here runs on the tick.

### 5.3 Two adapter helpers

Most callers should not touch the raw transforms; they want to turn one kind of
view into the other. Two one-liners cover both directions:

```ts
import type { Container } from 'pixi.js';

// Expose a bindings-view as a JSX component: <Ghost row={...} col={...} />
export function componentFromView<B extends object>(
    view: (bindings: B) => Container,
): (props: PropsFromBindings<B>) => Container {
    return (props) => view(bindingsFromProps(props) as B);
}

// Expose a JSX component to imperative callers: createGhostView({ getRow, ... })
export function viewFromComponent<P extends object>(
    Component: (props: P) => Container,
): (bindings: BindingsFromProps<P>) => Container {
    return (bindings) => Component(propsFromBindings(bindings) as P);
}
```

### 5.4 Example: an existing bindings-view used in a JSX tree

No change to `createGhostView`. One adapter line, then idiomatic JSX:

```tsx
/** @jsxImportSource #pixi-jsx */
import { createGhostView } from '../pacman/views';
import { componentFromView } from '#common';

const Ghost = componentFromView(createGhostView);

// row/col/color/tileSize are the bare getter props derived from GhostViewBindings
export function createBoardView(model: BoardModel): Container {
    return (
        <container label="board">
            <List items={model.ghosts}>
                {(ghost, i) => (
                    <Ghost
                        row={() => ghost().row}
                        col={() => ghost().col}
                        color={() => GHOST_COLORS[i]}
                        tileSize={() => TILE_SIZE}
                    />
                )}
            </List>
        </container>
    );
}
```

At runtime `jsx(Ghost, props)` calls `Ghost(props)`, which renames the props back
to bindings and calls `createGhostView`. The returned container already wired its
own `onRefresh` method, so it refreshes inside the tree like any other node - the
JSX runtime adds no second refresh path for a function-component result.

### 5.5 Example: a JSX component used by imperative callers

```ts
import { viewFromComponent } from '#common';
import { StarField } from './star-field'; // (props: StarFieldProps) => Container

const createStarFieldView = viewFromComponent(StarField);

// imperative call site, ordinary bindings:
const stars = createStarFieldView({
    getCount: () => model.starCount,
    getSeed: () => model.seed,
});
parent.addChild(stars);
```

---

## 6. What the transform deliberately does not do

- **It does not touch the `onUpdate` axis - and no longer needs to.** When this
  was first drafted, presentation state lived in a `StatefulPixiView = Container
  & { update }`, whose `update` half was erased at the JSX boundary
  (`JSX.Element = Container`). Since 001 shipped that type is gone: every
  `Container` carries an `onUpdate` method from the mixin, driven by `updateScene`,
  so a stateful view - bindings or JSX - just sets `view.onUpdate` and composes
  natively. There is no intersection type to erase and nothing for the bridge to
  reconcile. The adapters pass the container through untouched, `onUpdate` and
  all.

- **It does not change how refresh is driven.** Both conventions now refresh
  through the mixin's `onRefresh` method (driven by `refreshScene`); the adapted
  view keeps the method it already installed. The bridge is naming-only; which pass
  ticks the tree is the host loop's business.

- **It does not wire non-pointer `on*` as events.** On intrinsic elements only
  `onPointer*` are events (section 4.2). A domain handler like `onCoinTap`
  belongs to a *component's* props, where the component decides what to do with
  it - which is exactly where the transform routes it.

---

## 7. Edge cases and guarantees

| Case | Behaviour |
| --- | --- |
| Optional accessor `getMessage?()` | `?` preserved -> `message?()` |
| `readonly` binding | preserved (homomorphic mapping) |
| Event args `onCoinTap(i: number)` | preserved verbatim, both directions |
| Function identity | same object reused; no per-accessor allocation |
| Acronyms `getURL` | `url`... `getURL` round-trips; `uRL` casing is cosmetic |
| Non-`get`/`on` key | passed through unchanged (lossless) |
| A value prop literally named `on...` | treated as a handler; reserve `on*` for handlers (already the repo convention) |
| Hot path | transform runs once at construction, never per frame |

The round-trip identity (`BindingsFromProps<PropsFromBindings<B>> is B`) is the
correctness anchor: because values are never rewritten and keys map bijectively,
converting and converting back is provably the identity, both at the type level
and at runtime.

---

## 8. API surface and placement

Small, and it lives with the other shared view helpers in
[`src/common/`](../../src/common/index.ts):

```ts
// src/common/view-convention.ts (new)
export type PropsFromBindings<B>;
export type BindingsFromProps<P>;
export function propsFromBindings<B>(bindings: B): PropsFromBindings<B>;
export function bindingsFromProps<P>(props: P): BindingsFromProps<P>;
export function componentFromView<B>(view): (props) => Container;
export function viewFromComponent<P>(Component): (bindings) => Container;
```

Re-exported from `#common`. No dependency on `#pixi-jsx`, so it does not couple
the common layer to the JSX runtime; `Container` is the only Pixi type it
references.

### Accompanying rename: `MaybeGetter` -> `ValueOrGetter`

One repo nit is fixed alongside this. The JSX runtime's prop-model type
[`MaybeGetter<T>`](../../src/pixi-jsx/jsx-runtime.ts) (`T | (() => T)`, used ~13
times there) is renamed to `ValueOrGetter<T>`. `Maybe` conventionally denotes
optionality (`T | None`); this union is "a value **or** a getter of that value",
which the new name states directly. This is a mechanical, no-behaviour rename and
does not depend on the rest of the proposal landing.

---

## 9. Adoption

- **Opt-in, zero forced migration.** Existing views and their 50 bindings
  interfaces are untouched. The bridge is used only where a cross-medium
  boundary actually exists.
- **When to reach for it:** (a) dropping an existing bindings leaf view into a
  JSX tree with idiomatic prop names; (b) exposing a JSX component to imperative
  game code. If a view is only ever consumed in one medium, do not wrap it.
- **Authoring rule stays simple:** imperative leaf views use `bindings`; JSX
  (intrinsics and components) use bare props; bridge at the boundary with
  `componentFromView` / `viewFromComponent`.

---

## 10. Alternatives considered

- **Standardise on one convention** - rejected in section 4 (intrinsics forbid
  MVT-only; a JSX-only migration is costly and lossy).
- **A build-time codegen** that emits a props interface from each bindings
  interface - more moving parts than a mapped type, and no runtime win since the
  rename is already O(keys) at construction.
- **Widen derived props to `ValueOrGetter<T>`** so a component can also take
  static literals (`x={12}`). Attractive for JSX-first authoring, but it breaks
  the round-trip (you can no longer tell a getter from a value on the way back).
  Left out of the core; if wanted, add it as a separate opt-in `Widen<...>`
  decorator rather than folding it into `PropsFromBindings`.
- **Do nothing** - keep hand-writing parallel interfaces and closures at every
  boundary, as [tsx-pixi-entry.ts](../../src/demos/tsx-pixi/tsx-pixi-entry.ts) does
  today. Fine at one demo's scale; the transform removes the boilerplate and the
  drift risk once more than a couple of views cross the boundary.

---

## 11. Proof

A throwaway `src/_scratch_transform_proof/proof.ts` was written with the exact
types and runtime from section 5, then type-checked with `tsc --noEmit` and run
with `tsx`. It asserted, at the type level:

- `PropsFromBindings<GhostViewBindings>` equals the hand-written `GhostProps`
  (bare keys, `onCoinTap?` optionality and its `index` argument preserved);
- `BindingsFromProps<GhostProps>` equals `GhostViewBindings` (round-trip);
- `GhostProps['row']` is assignable to `ValueOrGetter<number>` (so a derived prop
  drops into an intrinsic slot).

and at runtime:

- `getRow -> row`, `getTileSize -> tileSize` rename correctly; the old keys do
  not leak;
- `onCoinTap` survives both directions;
- `back.getRow === bindings.getRow` (same function object, no wrapping).

`tsc` reported only `noUnusedLocals` on the type-assertion aliases (expected -
they exist only to be checked); no assertion failed. The script printed
`proof ok 3 3`. The scratch file was then deleted; nothing was left in `src/`.
