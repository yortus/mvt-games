# Proposal: a renderer-agnostic JSX base

> Split `src/pixi-jsx/` into a base that knows nothing about Pixi, and a Pixi
> part that is mostly data. The base keeps everything the runtime does today:
> inert construction, generated per-element refresh methods, `visible` with
> `SKIP_DESCENDANTS`, read counting, `<List>` and `<Switch>`. A JSX target (Pixi,
> HTML, three.js) supplies seven small operations on its scene graph and a
> table of its intrinsic elements, where each attribute says how it is written
> and how often. The same base then serves HTML and three.js, with the
> scene passes generalised to those trees as well. An earlier spike, 022a,
> tried this and shared only its function components; this proposal explains
> why its mechanism does not carry over, and shares the intrinsic elements too.

**Status:** implemented, as far as it can go before 011. Phases 1-4 are done
(2026-09-28/29): the base is `src/mvt-utils/jsx/`; the scene passes are generic, in
`src/mvt-utils/`, with 012's cached methods; a conformance suite runs
every JSX target both ways (a plain-object JSX target for tests served until the real
ones made it redundant); three.js is the second
real JSX target and HTML the third, and one demo uses both. Phase 1 measured
level with the old runtime (section 7.5.1); phase 2's costs and gains are in
step 8; phase 4's, in headless Chrome, in step 16. The build-time precompiler
of section 7.6, option B, is built, and phase 5 gave it section 12.1's
manifests, so it needs no configuration, and the directories are shaped
as the packages they will become (section 12). What remains of phase 5 is
moving them into packages, which waits for 011's workspace. The
code-generation options were first measured with a throwaway script
(section 7.5).

**Superseded in part, 2026-10-01** ([025](../archive/025-precompiler-or-two-builds.md)):
refresh methods no longer use generated code. Closures, made fast enough to
come within 1.1x to 1.3x of it, replaced generated code, the closure
fallback and the precompiler (section 7.7). Sections 7.2 to 7.6 and 12.1
describe what was removed; the last commit with it is tagged
`jsx-precompiler-last`.

**Written:** 2026-09-28, against the `vnext` working tree (the runtime as
changed by [021](../archive/021-jsx-and-teardown-quick-wins.md)), Pixi 8.16
(setter behaviour checked in an 8.15 install), three.js `Object3D.js` on its
`dev` branch, and spike 022a (section 2). The code-generation measurements in
section 7.5 were taken on Node 22.11 with Pixi 8.15.

**Related:** [jsx-runtime.ts](../../packages/pixi/src/jsx/jsx-runtime.ts),
[list.ts](../../packages/pixi/src/jsx/list.ts), [switch.ts](../../packages/pixi/src/jsx/switch.ts),
[Pixi JSX design notes](../../packages/pixi/src/jsx/design-notes.md),
[JSX base design notes](../../packages/utils/src/jsx/design-notes.md) (from
phase 1),
[pixi-mvt design notes](../../packages/pixi/src/design-notes.md),
[004](../archive/004-list-proposal.md) (`<List>` and `<Switch>`),
[011](./011-multi-package-repo.md) section 5.5 (later renderer packages),
[012](./012-falling-sand-performance-findings.md) section 2 (caching methods
in the scene-pass loop).

---

## 1. Summary

| # | Decision | Section |
| --- | --- | --- |
| 1 | Do not adopt spike 022a's mechanism. Its two refresh models, one per kind of renderer, leak into every shared component, and its manual one snapshots the tree at construction | 2 |
| 2 | One refresh model for every JSX target: methods on nodes, driven by memoised scene passes (`updateScene` / `refreshScene`), exactly as pixi-mvt does for Pixi today | 4, 9 |
| 3 | A JSX target is a plain record of seven scene-graph operations plus its `refreshScene`. Nothing else about a renderer reaches the base | 5 |
| 4 | Intrinsic elements are a table of element definitions. Each attribute is defined once, with how it is written (`fixed`, `everyFrame`, `onChange`, `onChangeNumber`, `event`) and the property it assigns or an apply function | 6 |
| 5 | The JSX types (`JSX.IntrinsicElements`) are derived from the same table, so behaviour and types cannot disagree | 6.5 |
| 6 | ~~The generated refresh methods stay, generalised: a property is assigned inline, as today, and any other write calls the attribute's apply function, passed in as a parameter. Only property names from element tables, checked to be identifiers, reach generated source~~ Superseded by 6c | 7.2, 7.5 |
| 6a | ~~Pages whose CSP forbids `new Function` get a closure fallback, measured at 6-16x slower refresh on Pixi as built, and a one-time warning in dev builds~~ Superseded by 6c | 7.4, 7.5.1 |
| 6b | ~~A build-time precompiler gives such pages the fast path too: built, and precompiles every bound element in this repo's JSX. A full JSX compiler is not pursued~~ Built, then removed by 6c | 7.6 |
| 6c | No generated code, and no precompiler: refresh methods are closures, with the refresh code written out as copies, one per shape and class of element with many elements, which V8 inlines as it did generated code. 1.1x to 1.3x slower than generated code on shapes of one class, faster across classes, level in the games and demos. Works under any Content Security Policy | 7.7 |
| 7 | `<List>` and `<Switch>` are written once, over the JSX target's operations, with unchanged semantics | 8 |
| 8 | The scene-pass core becomes generic over a tree. Pixi and three.js invalidate by wrapping their structural methods; the DOM by a `MutationObserver` whose records are taken synchronously at the start of each scene pass | 9 |
| 9 | Build a plain-object JSX target for tests first, and a conformance suite every JSX target must pass | 11.1, 16 |
| 10 | Phase 1 changes nothing observable: Pixi is the only JSX target, every existing test passes unchanged, and five benchmark suites stay within noise | 16 |

---

## 2. Spike 022a

### 2.1 What it is

Spike 022a has three runtimes, `pixi-jsx`, `html-jsx` and `three-jsx`, and
a shared `common-jsx` directory. The shared part is the control-flow
components only: `<For>`, `<Show>`, `<Dynamic>`, `<Switch>`/`<Match>` and
`<Portal>`. Each runtime builds a `RendererAdapter` and calls
`createCommonComponents(adapter)` once, destructuring the components it
returns:

```ts
export const { For, Show, Dynamic, Switch, Match, Portal } = createCommonComponents<Container>({
    label: 'pixi-jsx',
    createGroup: () => new Container(),
    insertChild: (parent, child, index) => { /* ... */ },
    deleteChild: (parent, child) => { parent.removeChild(child); child.destroy({ children: true }); },
    setVisible: (node, visible) => { node.visible = visible; },
    setRefreshMethod: (node, refresh) => { node.onRender = refresh; },
    onDestroy: (node, fn) => { /* overwrites node.destroy on the instance */ },
});
```

The adapter has two halves, as its header says: node operations, and "the
refresh model". The refresh model is one of two:

- **Renderer-driven** (Pixi): `setRefreshMethod` installs Pixi's `onRender`,
  and Pixi calls it. The adapter has no `getRefreshMethod`, and the shared
  components never refresh their children.
- **Manually propagated** (HTML, three.js): each node's refresh is a closure
  that runs its own bindings and then calls the refresh closures of its
  children, captured when they were appended. The adapter supplies
  `getRefreshMethod`, and every shared component calls it on the children it
  mounts and folds the results into its own refresh.

Update methods (`onUpdate`) are a third mechanism: a module-level `WeakMap`
keyed by node, aggregated the manual way on every renderer, Pixi included.

### 2.2 What it gets right

- It found the right seam for structure: a group node, insert, delete, set
  visibility, and a destroy hook. Section 5's JSX target is close to its node
  operations.
- The adapter is a plain record, and the shared code is generic over `Node`,
  with each runtime re-exporting typed aliases (`ForProps<T> =
  Common.ForProps<Container, T>`). Both carry over.
- The three.js runtime passes geometry and material as attributes, not as
  child elements the way react-three-fiber does, so JSX children stay one to
  one with scene-graph children. Section 10.3 keeps that.
- The HTML runtime uses layout-transparent groups (`display: contents`), and
  refuses to overwrite an `<input>` the user is typing in. Both ideas carry
  over, the second with a fix (section 10.2).
- three.js has no pointer events, and spike 022a adds a raycaster that finds
  the nearest ancestor with a handler. Section 10.3 keeps the idea and uses
  three's own `EventDispatcher` instead of a side table.

### 2.3 The mechanism: two refresh models are one too many

The adapter's split is where the design goes wrong. Every shared component has
to work under both models, so each carries code for both
(`getRefresh?.(child)`, "under the renderer-driven model both refreshers are
undefined"), and each behaves differently depending on which renderer runs it.
A component tested on HTML has not been tested on Pixi. Three specific
failures follow.

**Pixi's `onRender` does not skip hidden nodes.** The adapter contract says
"a hidden node must also be skipped by the refresh model - neither its
bindings nor its subtree run while hidden", and the Pixi control-flow header
says hidden `<Show>` branches "cost nothing". Neither is true. Pixi 8's
`RenderGroup.runOnRender` loops over every registered container and calls it,
visible or not (checked in 8.15; recorded for 8.16 in the
[pixi-jsx design notes](../../packages/pixi/src/jsx/design-notes.md)). So on Pixi,
every hidden branch keeps polling, and a binding such as `model.boss!.hp`
runs in a branch whose condition says the boss is absent. `onRender` is also
suppressed inside a `cacheAsTexture` group, and it runs during rendering
rather than before it. This repo left `onRender` for exactly these reasons.

**Manual propagation snapshots the tree at construction.** A parent captures
each child's refresh closure when it appends the child. Anything that happens
after that is invisible to it:

- a child whose refresh changes later (a `ref` that adds a step, a plain
  TypeScript view that assigns its refresh after it is composed, a lazily
  built branch);
- a child added imperatively after construction (`parent.appendChild`) is
  never refreshed;
- a subtree moved to another parent keeps being refreshed by its old parent's
  closure and not by its new one. `<Portal>` needs special wiring for this
  reason.

The update store says so in its own docs: `onUpdate(node, fn)` must be
called "during construction, before the node is composed into a parent".
That is an ordering rule the user must remember, of the kind the pixi-mvt
rework removed (its [design notes](../../packages/pixi/src/design-notes.md),
"The accessor-shadowing defect").

**The two mechanisms differ within one renderer.** On Pixi, refresh is driven
by `onRender` but update by the `WeakMap` aggregation, so a view's two
per-frame steps follow different rules about hidden nodes, ordering and
late changes.

pixi-mvt's model has none of these problems, because the tree itself is the
source of truth: a scene pass walks whatever is attached now (memoised, and
invalidated when the tree changes), in parent-before-child order, and a node
opts its subtree out explicitly with `SKIP_DESCENDANTS`. Section 9 shows that
model works on the DOM and on three.js as well, which removes the reason for
a second one.

### 2.4 The intrinsic elements share nothing

Each runtime has its own `jsx()`, around 450 lines each, and they are three
copies of one algorithm: call a component, build a fragment, or create an
element; loop over the attributes sorting getters from fixed values and
events; wire events; append children; aggregate refreshes; call `ref`. They
have already drifted:

| | Pixi | HTML | three.js |
| --- | --- | --- | --- |
| Per-frame refresh | Generated code | Closure loop over a bindings array | Closure loop over a bindings array |
| Writing a changed value | Inline assignment | `applyProp`'s `switch`, every write | `applyProp`'s `switch`, every write |
| Written every frame | All but a list of six | Only `style` | Only transforms |
| Loop style in the hot path | Index `for` | `for...of` | `for...of` |
| Leftovers | `NON_GETTER_PROPS` has `view` and `of`, from components that no longer exist; `onGlobalPointerDown/Up` are typed but Pixi never emits them | | |

The HTML and three.js loops break this repo's hot-path rule 5, and their
per-write `switch` is the dispatch the Pixi runtime's code generation exists
to avoid. None of this is anyone's fault: with nothing shared, each copy
improves on its own schedule.

### 2.5 Smaller defects

- **Eager construction.** Every getter is called while the element is built
  (`const initial = getter()`), including in branches that are not shown.
  This repo settled on inert construction
  ([004](../archive/004-list-proposal.md) section 7.7) because of exactly the
  `model.boss!.hp` case.
- **Instance `destroy` overwritten** by the Pixi adapter's `onDestroy`, the
  pattern [021](../archive/021-jsx-and-teardown-quick-wins.md) item 5 removed
  here.
- **The input guard loses corrections.** The HTML `value` binding skips its
  write while the field has focus, but still records the value as written. If
  the model then rejects or clamps what was typed, the field keeps showing
  the typed text until the model's value changes again (section 10.2).
- **Shared-material colour.** three.js `color` on a `<mesh>` writes
  `mesh.material.color`. With a material shared between meshes, which is how
  three.js scenes save GPU state, colouring one mesh colours them all.
- **Tuple transforms allocate.** `position={() => [x, y, z]}` builds an array
  every frame.
- **`<For>` diffs** by item identity, keyed or positional, and destroys and
  rebuilds views. This repo settled on index-addressed slots that never diff
  ([004](../archive/004-list-proposal.md)); the base carries `<List>` and
  `<Switch>`, not spike 022a's components.

### 2.6 Verdict

Keep the adapter-as-record idea, the generic-over-`Node` typing, and the
three.js and HTML details in 2.2. Replace the refresh half of the adapter
with one scene-pass model, and extend sharing from the control-flow components to
the whole runtime, intrinsic elements included.

---

## 3. What must not change

The base inherits these from the current runtime and its notes. They are
constraints on the design, not questions it reopens.

- **Children are built before their parent** (pixi-jsx design notes,
  section 1). No context, no cleanup scopes (sections 2 and 3).
- **Construction is inert.** No getter runs until the element's first
  refresh.
- **`visible` is evaluated first**, and a hidden element skips its other
  bindings and its subtree with `SKIP_DESCENDANTS`.
- **`onRefresh` runs after the element's bindings**, receives the element,
  is skipped while hidden, and may return `SKIP_DESCENDANTS`. `onUpdate`
  installs the element's update method. `onDestroyed` runs when the element
  is destroyed. `ref` runs last, for intrinsic elements and components alike.
- **The per-element refresh is generated code**, cached by binding shape,
  with no loops or dispatch at run time, and fractional watched numbers kept
  in a `Float64Array` to avoid boxing. Measured at 7.8 us per frame for 1000
  elements with three bindings, against 9.9 us for a shared body over an
  array (runtime header comment).
- **Read counting** counts exactly what it counts today.
- **`<List>` and `<Switch>` semantics** as shipped (004 sections 4.2 and 5.3,
  and the header comments of `list.ts` and `switch.ts`).

---

## 4. Architecture

Three layers. The arrows are imports.

```
  pixi-jsx  ──►  mvt-jsx (the base)  ──►  mvt-scene-passes (generic scene-pass core)
  html-jsx  ──►                      ──►  SKIP_DESCENDANTS, readCounter,
  three-jsx ──►                           UpdateMethod, RefreshMethod
     │
     └──►  pixi-mvt / html scene passes / three scene passes  ──►  mvt-scene-passes
```

- **The scene-pass core** (section 9) owns `SKIP_DESCENDANTS`, `UpdateMethod`,
  `RefreshMethod`, `readCounter`, and `createScenePasses(tree)`, which builds
  `updateScene` and `refreshScene` for any tree. It imports nothing.
- **The JSX base** (sections 5 to 8) owns the attribute helpers,
  `defineElements`, the runtime factory (`createJsx`), code generation,
  `createList`, `createSwitch`, and the shared JSX types. It depends on the
  scene-pass core's types and constants, and on nothing else.
- **A renderer package** (Pixi, HTML, three.js) owns its scene passes (the tree
  accessors, the method accessors on its node prototype, and invalidation),
  its JSX target record, its element table, and a `jsx-runtime` module with its
  `JSX` namespace.

A JSX target's `jsx-runtime.ts` is short:

```ts
/** The JSX runtime for Pixi. */
import { createJsx, createList, createSwitch, type IntrinsicElementsOf, type JsxChildren } from '../mvt-jsx';
import type { Container } from 'pixi.js';
import { pixiElements } from './pixi-elements';
import { pixiTarget } from './pixi-target';

export const { jsx, Fragment } = /* @__PURE__ */ createJsx({ target: pixiTarget, elements: pixiElements });
export const jsxs = jsx;
export const jsxDEV = jsx;

// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace JSX {
    type Element = Container;
    type IntrinsicElements = IntrinsicElementsOf<Container, typeof pixiElements>;
    interface ElementChildrenAttribute { children: JsxChildren<Container> }
}
```

`List`, `Switch` and `Match` are made the same way in the JSX target's barrel
(`createList({ target: pixiTarget })`, `createSwitch({ target: pixiTarget })`), each with its own
factory so a bundler can drop the ones a page does not import. The
spike's single `createCommonComponents` call cannot be tree-shaken.

---

## 5. The JSX target

### 5.1 Interface

Everything the base needs from a scene graph:

```ts
/** A scene graph a JSX runtime builds, and the operations the base needs on it. */
export interface JsxTarget<N extends SceneNode> {
    /** Names the runtime in error messages, e.g. `'pixi-mvt/jsx'`. */
    readonly name: string;

    /**
     * An empty node that groups its children without changing how they show:
     * not their layout, position or draw order. Used for fragments, and by
     * `<List>`, `<Switch>` and `<Match>`.
     */
    createGroup: () => N;
    /** Adds `child` after `parent`'s last child. */
    append: (parent: N, child: N) => void;
    /** Puts `next` where `current` is among `parent`'s children, and detaches `current`. */
    replace: (parent: N, current: N, next: N) => void;
    /** Detaches `parent`'s last `count` children, without destroying them. */
    detachTail: (parent: N, count: number) => void;

    /**
     * The `visible` attribute. The base evaluates it first, and skips a hidden
     * element's other bindings and subtree. `<List>` and `<Switch>` hide nodes
     * with it. A new node must start visible.
     */
    visible: ChangeableAttribute<N, boolean>;

    /** Destroys `node` and its subtree, running every `onDestroyed` callback in it, and detaches it. */
    destroy: (node: N) => void;
    /** Runs `callback` when `node` is destroyed, by `destroy` on it or on an ancestor. */
    onDestroyed: (node: N, callback: (node: N) => void) => void;

    /**
     * Adds an event listener, for event attributes. Called on a new element,
     * before its fixed attributes are applied, so it may set defaults that
     * make the listener work, and an attribute can still override them.
     */
    listen: (node: N, eventName: string, handler: (event: never) => void) => void;

    /** Runs every `onRefresh` in `node`'s subtree. For nodes built during a scene pass. */
    refreshScene: (node: N) => void;
}

/** A node the scene passes can drive: the two per-frame methods, as properties. */
export interface SceneNode {
    onUpdate: UpdateMethod | undefined;
    onRefresh: RefreshMethod | undefined;
}
```

Seven operations, plus `visible`, `name` and the scene-pass entry point, all
required, and all used by the base on every JSX target. Deliberately absent:

- **Positional insert.** The base only ever appends, replaces one node with
  another, or detaches a tail. `<List>` keeps its own slot array, so it never
  asks the scene graph where a child is. three.js has no `addChildAt` at all,
  and needs none of this.
- **Any refresh accessor.** Refresh and update methods are properties on the
  node (`SceneNode`), installed on the node prototype by the renderer's scene passes,
  exactly as pixi-mvt does for `Container`. The base reads and writes
  `el.onRefresh` directly. This is the core fix for 2.3: there is nothing to
  aggregate, so nothing to snapshot.
- **Remove-and-destroy as one operation.** The base never destroys a child it
  might need again; `<List>` detaches, and destroys only on its own
  destruction.
- **Text children.** Every child is a node, on every JSX target. Text is an
  attribute of an element (`<text text={...}>` on Pixi, `<span text={...}>`
  in HTML). Section 5.4 says what leaving text children out costs.
- **A hook before the first listener.** An earlier draft had an optional
  `beforeFirstListener` for Pixi's default `eventMode`. Ordering does the same
  job (5.2).

### 5.2 Why each operation has the shape it has

- **`detachTail`, not `remove(child)`.** `<List>` only ever drops a tail.
  Pixi's `removeChild` is an `indexOf` plus a `splice`, and `indexOf` scans
  from the front, so detaching 5,000 slots one at a time is quadratic. Pixi
  has `removeChildren(begin, end)`; the DOM removes `lastElementChild` in a
  loop; three.js splices its `children` array from the end.
- **`replace`, for filling a hole.** A `<List>` placeholder is swapped for
  its item view in place. Pixi: `addChildAt(next, getChildIndex(current))`
  then `removeChild(current)`. DOM: `current.replaceWith(next)`. three.js:
  `remove(current)` then `add(next)`, since order has no effect there.
- **`visible` as an attribute definition, not a function.** Its write mode
  differs by renderer. Pixi's setter returns at once when the value is
  unchanged, so writing it every frame is cheap. In the DOM, writing an
  attribute every frame is not, so HTML writes it only on change. Defining
  it like any other attribute (section 6) lets each JSX target say which.
- **`listen` runs before the fixed attributes.** A Pixi element is not
  hit-tested under Pixi's default `eventMode` (`'passive'`), so a handler on
  it would never fire. Today the runtime makes an element with a handler
  `'static'`, unless an `eventMode` attribute was given; all 15 handler
  attributes in the repo's JSX rely on this, and none sets `eventMode`. Pixi's
  `listen` sets `eventMode = 'static'` and adds the listener. Because the base
  calls `listen` before applying fixed attributes, an `eventMode` attribute
  is applied afterwards and wins, exactly as today, including `'passive'` on
  a container that listens only to events bubbling up from its children.
  `listen` sets it unconditionally rather than only when the mode is
  `'passive'`: Pixi's getter falls back to `EventSystem.defaultEventMode`,
  which an application can change, so a check would misread a fresh
  element. HTML and three.js listeners do not care about order.

### 5.3 The three JSX targets

| Operation | Pixi | HTML | three.js |
| --- | --- | --- | --- |
| Node type `N` | `Container` | `Element` | `Object3D` |
| `createGroup` | `new Container()` | `<mvt-group>` element (section 10.2) | `new Group()` |
| `append` | `addChild` | `appendChild` | `add` |
| `replace` | `addChildAt` + `removeChild` | `replaceWith` | `remove` + `add` |
| `detachTail` | `removeChildren(n - count, n)` | remove `lastElementChild`, `count` times | splice from the end |
| `visible` | `e.visible=v`, every frame | `e.hidden=!v`, on change | `e.visible=v`, every frame |
| `destroy` | `destroy({ children: true })` | shared registry walk, then `remove()` | shared registry walk, then `removeFromParent()` |
| `onDestroyed` | `on('destroyed', ...)` | shared registry | shared registry |
| `listen` | `eventMode = 'static'`, then `on(name, handler)` | `addEventListener` | `addEventListener` (three's `EventDispatcher`) |
| `refreshScene` | pixi-mvt | HTML scene passes | three scene passes |

Only Pixi has a destroy event of its own. The base provides a small registry
for the others: `createDestroyRegistry(children)` returns `destroy` and
`onDestroyed`, keeps callbacks in a `WeakMap`, and runs them parent first, the
order Pixi uses. Destroying is rare, so a walk of the subtree is fine.

### 5.4 No text children

Only HTML (and SVG, later) has text nodes. An earlier draft gave the JSX target
an optional `appendText` for them, so `<button>Reset</button>` would work.
It is left out, because nothing needs it, and adding it later breaks nothing.

What leaving it out means:

- **All text is an attribute**: `<button text="Reset" />`,
  `<span text={() => scoreText(model.score)} />`, as Pixi's
  `<text text={...}>` already is. The HTML `text` attribute writes to a
  `Text` node the element owns; that node is the attribute's own business,
  not a child the base knows about.
- **A string child does not compile.** `JSX.ElementChildrenAttribute`
  allows only nodes, so `<p>Hello</p>` is a type error at the call site, not
  a run-time surprise. A `{' '}` that a formatter inserts between elements
  is caught the same way.
- **Mixed inline text costs elements.**
  `<p>Score: <b>{n}</b> points</p>` becomes three children:
  `<span text="Score: " />`, `<b text={...} />`, `<span text=" points" />`.
  Game HUDs, panels and dev tools rarely mix text and elements inside one
  line, so this is expected to be rare.
- **An element has text or children, not both.** An element with a `text`
  attribute and children is an error in dev builds, so the two never fight
  over the element's content.
- **One node per child, on every JSX target.** The base's children handling has
  no branch for text, and the DOM scene passes (section 9.2) see child-list
  changes only when elements are added or removed.

What would reopen it: real HTML views in which mixed inline text is common
enough that the extra spans hurt. `appendText` would then be added as an
optional operation, and HTML's children type widened to accept strings and
numbers; no other JSX target changes.

---

## 6. Element tables

### 6.1 Attribute definitions

An attribute is defined once, with how it is written:

| Helper | Accepts | Written |
| --- | --- | --- |
| `fixed(writer)` | a value | once, at construction |
| `everyFrame(writer)` | a value or a getter | a getter's result every frame |
| `onChange(writer)` | a value or a getter | a getter's result when it differs from the last written (`!==`) |
| `onChangeNumber(writer)` | a value or a getter | as `onChange`, keeping the last value in a `Float64Array` (no boxing) |
| `event<E>(name)` | a handler | wired once, with the JSX target's `listen` |

The first four come from `attributesOf<E>()`, typed for one element type,
and each takes a writer, one of:

- **A property name** of `E`: `container.everyFrame('x')`. The value's type
  is the property's type. Generated refresh methods assign it inline
  (`e.x=`), as today's runtime does.
- **An apply function**, `(el, value) => void`, for any other write:
  `container.everyFrame((e, v: number) => { e.scale.set(v); })`. Generated
  refresh methods call it (section 7.2).

**Name a property wherever the write is a plain assignment.** Phase 1 first
shipped with apply functions only, after section 7.5's scratch benchmark
measured the call as free. The repo's own benchmarks disagreed: an apply
function is one function for every element kind that has the attribute, so
the write inside it sees all their shapes, and in a scene of many shapes V8
gives up on it. On the falling-sand demo's sprites, with `x`, `y` and `tint`
as apply functions, refresh was 10-43% slower than today's runtime. Assigned
inline, each generated method has its own feedback for the write. The
scratch benchmark had three element shapes, and missed this.

Property names come only from the table, and are checked to be identifiers
where the table is defined, so nothing a caller passes can reach generated
source (section 7.4).

Today, how each attribute is written is spread over three places: the
`WATCHED_ATTRIBUTES` and `FRACTIONAL_WATCHED_ATTRIBUTES` sets, the `switch`
in `applyAttribute`, and the `switch` in `attributeAssignment`, with the types
declared separately again. The table puts all four facts in one entry.

### 6.2 The Pixi table

A sketch; the real one covers every attribute in today's runtime.

```ts
const container = attributesOf<Container>();
const anchored = attributesOf<Sprite | Text>();
const sprite = attributesOf<Sprite>();
const text = attributesOf<Text>();
const graphics = attributesOf<Graphics>();

const containerAttributes = {
    x: container.everyFrame('x'),
    y: container.everyFrame('y'),
    alpha: container.everyFrame('alpha'),
    scale: container.everyFrame((e, v: number) => { e.scale.set(v); }),
    pivotX: container.everyFrame((e, v: number) => { e.pivot.x = v; }),
    cursor: container.everyFrame('cursor'),
    label: container.onChange('label'),
    hitArea: container.fixed('hitArea'),
    /**
     * How the element takes part in pointer events. Without it, an element
     * with an event handler attribute is made `'static'`.
     */
    eventMode: container.fixed('eventMode'),
    onPointerDown: event<FederatedPointerEvent>('pointerdown'),
    onWheel: event<FederatedWheelEvent>('wheel'),
    // ...
};

const anchorAttributes = {
    anchor: anchored.fixed((e, v: number) => { e.anchor.set(v); }),
    anchorX: anchored.fixed((e, v: number) => { e.anchor.x = v; }),
    anchorY: anchored.fixed((e, v: number) => { e.anchor.y = v; }),
};

export const pixiElements = defineElements({
    container: element(() => new Container(), containerAttributes),
    sprite: element(() => new Sprite(), {
        ...containerAttributes,
        ...anchorAttributes,
        texture: sprite.onChange('texture'),
        tint: sprite.onChange('tint'),
        width: sprite.onChangeNumber('width'),
        height: sprite.onChangeNumber('height'),
    }),
    text: element(() => new Text(), {
        ...containerAttributes,
        ...anchorAttributes,
        text: text.onChange('text'),
        style: text.onChange((e, v: Record<string, unknown>) => { Object.assign(e.style, v); }),
    }),
    graphics: element(() => new Graphics(), {
        ...containerAttributes,
        tint: graphics.onChange('tint'),
    }),
});
```

What falls out:

- `anchor` exists only on `<sprite>` and `<text>`, so `applyAttribute`'s
  runtime guards (`'anchor' in el`, `el instanceof Sprite`) go.
- A container-level attribute is valid on a `Sprite`, which is a
  `Container`. Sharing attributes between elements is a spread.
- `element` checks, in the type, that each attribute accepts the element
  `create` returns. `defineElements` rejects a table that defines an
  attribute the base provides (6.3). The runtime gives each definition a
  numeric id when it first resolves it (the code cache key, section 7.3).

### 6.3 The attributes every JSX target has

The base adds these to every intrinsic element of every JSX target. A table never
declares them:

| Attribute | Behaviour |
| --- | --- |
| `visible` | The JSX target's `visible` definition, evaluated first, skipping the rest when false |
| `onUpdate` | Installed as `el.onUpdate` |
| `onRefresh` | A step after the element's bindings, receiving the element |
| `onDestroyed` | Registered with the JSX target's `onDestroyed` |
| `ref` | Called with the element, last |
| `children` | Appended with the JSX target's `append`. Only nodes: a string child is a type error (5.4) |

These are the MVT parts of an element, and the same on every JSX target. That is
the point of the split: what the base owns is what MVT means by a view
element; what a JSX target owns is what its renderer means by one.

### 6.4 Attributes whose names are not known in advance

HTML has `data-*` and `aria-*`. A table may declare prefixes, each with a
function that makes a definition for a full name:

```ts
patterns: {
    'data-': (name) => html.onChange((e, v: string | number) => { e.setAttribute(name, String(v)); }),
    'aria-': (name) => html.onChange((e, v: string | number) => { e.setAttribute(name, String(v)); }),
},
```

(`html` is `attributesOf<Element>()`.) *As built in phase 4: the third
argument to `element`. The precompiler's manifest (12.1) records one
attribute per prefix, so a pattern's attributes must all be written the same
way, by apply functions.* The definition made for a name is cached per
element kind. Like every
definition, it reaches the generated code only as a parameter, so the name
never appears in generated source (section 7.4).

### 6.5 Types derived from the table

`IntrinsicElementsOf<N, typeof table>` maps each element definition to its
attribute type:

```ts
type AttributesOf<A> = {
    [K in keyof A]?:
        A[K] extends FixedAttribute<infer T> ? T
        : A[K] extends ChangeableAttribute<infer T> ? ValueOrGetter<T>
        : A[K] extends EventAttribute<infer E> ? (event: E) => void
        : never;
};

export type IntrinsicElementsOf<N, T> = {
    [K in keyof T]: T[K] extends ElementDefinition<infer E, infer A>
        ? AttributesOf<A> & MvtAttributes<E, N>
        : never;
};
```

`MvtAttributes<E, N>` types section 6.3's attributes, with `E` (the created
element's own type, from `create`'s return type) given to `ref`, `onRefresh`
and `onDestroyed`, as `BaseAttributes<T>` does today.

Because the mapped type is homomorphic, a JSDoc comment on a table entry
should show on hover in a `.tsx` file, as the comments on today's attribute
interfaces do (to confirm in phase 1). The alternative, keeping hand-written
attribute interfaces and checking the table against them with `satisfies`,
has better-looking declarations and two places to edit; see open question 2.

---

## 7. The runtime factory

### 7.1 `jsx`

`createJsx({ target, elements })` returns `{ jsx, Fragment }`. `jsx` is today's
algorithm with each Pixi reference replaced by a table lookup or a JSX target
operation:

1. A function type: call it, then `ref` on the result.
2. `Fragment`: `target.createGroup()`, then append the children.
3. A string type: look up its definition (unknown tags throw, naming the
   JSX target), and `create()` it.
4. `listen` for each event attribute, before any other attribute is applied,
   so a fixed attribute can override a default `listen` set (5.2).
5. For each other attribute, in source order:
   - base attributes (6.3) are held for later;
   - a function value for a changeable definition becomes a binding:
     `visible` first, then `everyFrame` bindings, then `onChange` ones, as
     today;
   - any other value is applied with the definition's `apply`;
   - a key with no definition throws, in every build (the Pixi runtime
     used to fall through to `el[key] = value`; see section 13), and so
     does a function given to an attribute that takes only a fixed value.
6. Append the children.
7. If there are bindings: install the generated refresh (7.2).
8. `onRefresh`, `onUpdate`, `onDestroyed`, then `ref`.

Today the runtime wires events after the attributes, and checks whether an
`eventMode` attribute was given; moving the events first replaces that
check, and the JSX target hook it would otherwise need.

### 7.2 Generated refresh, generalised

Today's factory takes the element, the skip sentinel, `UNSET`, the read
counter and the getters, and writes each value with an assignment built from
the attribute's name (`e.x=`, `e.scale.set(...)`). The generalised one keeps
the inline assignment for attributes defined by a property, and also takes
each binding's apply function, which it calls for the rest:

```js
// x (everyFrame, property), scale (everyFrame, apply), texture (onChange, property)
function (e, s, u, c, g0, a0, g1, a1, g2, a2) {
    var v2 = u;
    return function () {
        if (c.isCounting) c.count += 3;
        e.x = g0();
        a1(e, g1());
        var _2 = g2(); if (_2 !== v2) { v2 = _2; e.texture = _2; }
    };
}
```

Each factory is made for one sequence of definitions (section 7.3), so `a1`
is the same function in every method it makes, its call site is
monomorphic, and V8 inlines it. The write inside it, though, is shared by
every element with that attribute, which is why plain assignments name
their property (6.1).

`visible` generalises the same way. Today's code reads the value back
(`e.visible=g0(); if(!e.visible) return s;`), which relies on Pixi's getter.
The general form keeps the value in a local:

```js
var _v = g0(); if (_v !== vv) { vv = _v; <write> } if (!_v) return s;   // onChange (HTML)
var _v = g0(); <write>; if (!_v) return s;                              // everyFrame (Pixi, three.js)
```

### 7.3 One cache per JSX target

The generated factory depends on the bindings' shape: whether `visible` is
bound, and each binding's write kind and its property (or, for an apply
function, its attribute key), in order. The cache is keyed by that shape, per
JSX target, so two elements with the same shape share code, and two JSX targets never
do. As today, the cache is bounded by the binding shapes written in source.
(Phase 1 first keyed it by definition ids; the precompiler needed a key that
is the same at build time and run time, section 7.6.)

### 7.4 Safety, and pages that forbid `new Function`

> Superseded by section 7.7: there is no generated code, and no fallback.

Today's generated code interpolates attribute names (`e.${key}=...`), and the
header argues this is safe because "attribute keys come from JSX intrinsic
element type definitions". That holds for keys written in source, but a
spread (`<container {...attributes}>`) can carry any key whose value is a
function, and the runtime does not check. The generalised generator
interpolates only property names from element tables, checked to be
identifiers where the table is defined; a key the table does not define
throws before it reaches the generator (7.1).

Some pages are served with a Content Security Policy that forbids
`new Function` (no `'unsafe-eval'` in `script-src`): pages embedded in some
portals, browser extension pages, Electron apps with a strict policy. For
them the base has a closure fallback: one generic refresh over arrays of
getters, apply functions and last values, with the same behaviour and the
same read counts. It is much slower than generated code: 6x to 16x on
refresh, on Pixi as built (section 7.5.1; the scratch benchmark in 7.5
measured 2.3x to 4.9x for a fallback with an apply function per attribute).
In the DOM, where each write costs far more than a read, the gap should
matter less, but that is unmeasured.

**Choosing.** The first element built with a binding tries `new Function`
once (`canGenerateCode`), and every JSX target uses the answer. A runtime can be
created with `canGenerateCode: false` to force the fallback, which is how
the tests run both paths. Node, the test runner and this repo's pages
all allow it.

**A warning in dev builds: yes.** When the probe fails, dev builds log one
warning per page:

```
[mvt-utils/jsx] This page's Content Security Policy blocks new Function, so JSX
bindings are refreshed by a slower fallback (6-16x slower per bound element
on Pixi, measured). Add 'unsafe-eval' to script-src, or define
__MVT_JSX_EVAL__ as false to skip this check and this warning.
```

Without it, a large scene would simply run slower under one page's policy
than another's, with nothing to say why. The browser logs a CSP violation of
its own for the probe, but that says the code was refused, not that the
runtime carried on at a cost. Production builds stay silent. The probe
itself costs one violation per page load, which a page with a `report-uri`
receives as a report. An application that knows its policy forbids eval can
skip the probe with a build-time constant (`define: { __MVT_JSX_EVAL__:
false }` in Vite), which also skips the warning.

The conformance suite (section 16) runs every test both ways.

### 7.5 Measured: generated code against the alternatives

**Method.** A standalone script (not kept; phase 1 adds it to the benchmark
suites), run on Node 22.11 with Pixi 8.15, on an Intel Core Ultra 9 185H
(the machine 019 was measured on). One arm per process, five processes per arm,
interleaved. Each process builds its scene, runs 3,000 warm-up frames, then
times 40 batches of 200 frames and reports the median batch. Only the
refresh is timed, not the model's update. The refresh methods are called
from one plain loop, as 012 section 2's cached-method scene-pass loop would call
them.

**Scenes.**

- *Uniform*: containers binding `x`, `y` and `alpha`, all changing every
  frame. The scene the runtime header's 7.8 us figure comes from.
- *Mixed*: six element shapes in turn: containers with two and with four
  every-frame bindings; sprites with `x`, `y`, `tint` (changes every 60
  frames) and `width` (fractional, changes every frame); sprites with `x` and
  `texture` (every 60 frames); containers with `scale` and `pivotX`;
  graphics with `x`, `y` and `tint`.

**Arms.**

| Arm | What it is |
| --- | --- |
| `codegen` | Today's generator: inlined assignments |
| `codegen-apply` | Section 7.2's generator: calls to apply functions passed as parameters |
| `loop` | The fallback in 7.4: one shared refresh body looping over arrays |
| `steps` | An eval-free alternative: one closure per binding, each made by a factory written as its own literal per attribute, called in a loop |
| `hand` | Hand-written refresh methods, one per shape: the ceiling |

**Results**, microseconds per frame, median of five processes, and relative
to `codegen`:

| Arm | Uniform, 1,000 | Mixed, 1,000 | Uniform, 10,000 | Mixed, 10,000 |
| --- | --- | --- | --- | --- |
| `codegen` | 11.4 | 26.2 | 196 | 444 |
| `codegen-apply` | 11.5 (1.01x) | 25.4 (0.97x) | 201 (1.03x) | 414 (0.93x) |
| `loop` | 40.1 (3.52x) | 60.2 (2.29x) | 951 (4.85x) | 1,444 (3.25x) |
| `steps` | 26.4 (2.32x) | 48.5 (1.85x) | 350 (1.78x) | 1,043 (2.35x) |
| `hand` | 7.8 (0.69x) | 22.3 (0.85x) | 136 (0.69x) | 336 (0.76x) |

Run-to-run spread was within about 10% for every arm except `loop` at 10,000
(up to 20%).

**What it shows.**

1. **Apply calls cost little here: 0.93x to 1.03x** against inlined
   assignments. *Corrected in phase 1:* not in general. This scene has three
   element shapes; on the falling-sand demo, with many, apply functions for
   `x`, `y` and `tint` made refresh 10-43% slower, because each apply's write
   is shared by every element kind (6.1). Plain assignments are therefore
   defined by property, and assigned inline.
2. **Generated code is worth keeping.** Without it, refresh is 1.8x to 4.9x
   slower. The runtime header's 9.9 us against 7.8 us (27%) compared
   generated code with a shared body that still wrote each attribute inline;
   a body that is generic in its writes as well, which is what a fallback
   must be, is far slower.
3. **It is not allocation.** Minor garbage collections during the timed
   frames were the same for every arm (about 10 per 1,000 frames at 10,000
   elements, from the model and Pixi). The loop's cost is dispatch: its
   getter and apply call sites see every attribute's functions, so V8
   inlines neither. Ruled out; do not reopen without new information.
4. **`steps` gets under half of the gap back**, and only with a factory
   written by hand per attribute. Made by a helper, the factories would share
   one literal, and it would be the loop again.
5. **Hand-written code is 15-31% faster still.** That is the cost of calling
   getters at all, which the runtime header also measured.

In frame terms, at 60 frames a second (16.7 ms): at 1,000 bound elements the
fallback costs an extra 22-34 us per frame, 0.1-0.2% of the frame. At 10,000
it costs 0.6-1.0 ms, 4-6% of the frame, which matters only to scenes that
large.

### 7.5.1 Measured in phase 1: the runtime as built

**Against the current runtime.** An A/B run of the repo's own suites, on
the machine of 7.5 (Node 22.11, Pixi 8.16): the old runtime from a worktree
at HEAD, the new one from the working tree, in the order new, old, old, new,
three processes each time, so six processes per side per case. Medians,
new over old:

| Suite (cases) | First attempt: apply functions only | As built: properties inline | Unchanged code, as a control |
| --- | --- | --- | --- |
| `reactivity`, JSX (10) | 1.019x | 1.003x | 1.005x |
| `scaling`, JSX (8) | 1.015x | 0.982x | 1.002x |
| `construction`, JSX build | 0.874x | 0.842x (0.42 us against 0.50 us per container) | 1.00x |
| `construction`, `<List>` pools | 1.05x, 1.00x | 0.98x, 1.02x | |
| `memory`, JSX | allocation identical; 24 more bytes kept per container | identical, including kept bytes | |
| `falling-sand-scaling`, `objects-sprites`, refresh (10) | 1.10x to 1.43x (round 1) | 0.91x to 1.05x, 0.98x on average | |

- **The refactor costs nothing measurable, as built**, and builds JSX
  elements 16% faster: the old runtime checked all ten event names on
  every element; the new one looks up only the attributes given.
- **The first attempt regressed the falling-sand demo by 10-43%**, the one
  real scene of many element shapes. Section 6.1 has the cause and the fix.
  The uniform suites barely showed it (2%), which is why it needed the demo.
- Spreads were up to 25% on single cases, so read single rows loosely and
  the averages and the control more.

**The fallback, as built** (the new `jsx-refresh` suite: microseconds per
frame, model update included, median of five processes):

| Scene | Hand-written | Generated code | Fallback |
| --- | --- | --- | --- |
| Uniform, 1,000 | 13 | 16.1 | 252 |
| Uniform, 10,000 | 197 | 251 | 2,810 |
| Mixed, 1,000 | 28 | 33.1 | 263 |
| Mixed, 10,000 | 388 | 632 | 3,700 |

The fallback is 6x to 16x slower than generated code, not the 2.3x to 4.9x
of 7.5. That benchmark's fallback called an apply function written per
attribute; as built, an attribute defined by a property is written by the
fallback as `el[name] = value`, a keyed store that sees every name and every
element shape, and that V8 handles slowly when it reaches a setter, as all of
Pixi's do. Doing the store inline rather than through a call was tried, and
changed nothing (247 us against 252 us). An apply function per attribute
would restore 2.3x to 4.9x in the fallback, but it is exactly what makes
generated code slow on mixed scenes, so the two cannot both be fast without
writing each attribute twice. That makes option B below worth more than 7.6
first judged: under a CSP, a scene of 1,000 bound elements costs about
0.25 ms of refresh per frame, 1.5% of a 60 Hz frame, and one of 10,000 costs
3-4 ms.

### 7.6 Always taking the fast path?

> Superseded by section 7.7: option B was built (section 12.1), then removed
> when the closures came close enough to generated code.

The fast path is lost only where a page's CSP forbids `new Function`, and it
costs noticeably only in scenes with thousands of bound elements. Four ways
to close the gap were considered.

**A. Runtime generation with the fallback (recommended).** What 7.2 and 7.4
describe. Costs one small fallback, and running the conformance suite twice.
Pages that allow eval, which includes every page in this repo, lose nothing.

**B. A build-time precompiler that fills the factory cache (built).** A
Vite plugin, `scripts/vite-plugin-jsx-precompile.ts` (since removed),
that writes at build time the factories the runtime would generate at run
time. Designed here as parked; built on 2026-09-28, after phase 1 found the
fallback costs more than first measured (7.5.1). It is opt-in: the site's
Vite config adds it only when `MVT_JSX_PRECOMPILE` is `1` or `true`, for the
dev server, builds and the test runner alike, since only a page served under
a strict CSP needs it. As built:

- **It parses each `.tsx` module whose `@jsxImportSource` names a JSX target**
  (the TypeScript compiler API, loaded on first use), and finds its
  intrinsic elements.
- **It reads from the syntax which attributes the runtime will bind.** An
  arrow or function expression is a function; a literal, an object, an
  arithmetic expression is not; a local function declaration or `const` is
  resolved, following a parameter of the same name first. Anything else
  (`bindings.isVisible`, a parameter, a call) could be either, so it emits
  both variants, for up to four such attributes per element.
- **It uses the base's own source.** `refreshShapeKey` and
  `refreshFactorySource` moved to a pure module,
  `refresh-source.ts` (since removed), that the runtime
  and the plugin both call, so the two cannot drift. The plugin imports the
  JSX target's element table in Node, through the Vite config, to learn each
  attribute's write kind and property.
- **It registers per module, with no virtual module.** It puts
  `import { registerRefreshFactories } from '<importSource>/jsx-runtime'`
  and a call registering that module's factories after the pragma comment,
  on the comment's line, so no line of the module moves and the pragma stays
  the leading comment. A virtual module shared by every module would hold
  each shape once, but in dev it is loaded before the modules that fill it
  are transformed. Per module, shared shapes repeat, and compress well (the
  cost is below).
- **The runtime's cache key changed to make this possible.** Factories were
  keyed by definition ids, assigned in the order a runtime met them, which
  a build cannot know. They are now keyed by the shape itself: `visible` or
  not, then each binding's write kind and its property, or its attribute key
  for an apply function (`v|e.visible,e.x,c.label,`). Two definitions of one
  key with different apply functions would now share a factory, and its
  call site would see both; no table has any. The ids stay as a fast path:
  a runtime resolves each sequence of definition ids to a factory once, by
  shape, and caches that. Keying every element by shape made building a JSX
  element 40% slower (0.59 us against 0.42 us); with the fast path it is
  0.45 us, within noise of phase 1. A registration clears the fast path, so a
  module loaded later still takes effect.
- **A registered shape needs no `new Function`.** The runtime looks up
  registered factories first, and probes `new Function` only for a shape it
  must generate, so a page whose shapes are all precompiled never probes,
  and under a strict CSP never reports a violation. A shape it did not
  foresee falls back as before, and in dev builds, on a page that uses the
  precompiler, the runtime names each such shape once.

Measured on this repo:

- **Coverage: every bound element.** 100 intrinsic elements in 24 modules,
  42 distinct shapes. One element is left to the runtime, for a spread
  attribute (`overlay-view.tsx`), and its spread carries only event
  handlers, so it has nothing to precompile. The plugin's tests run its
  analysis over every module under `src/`, register the result with the
  runtime the views use, then build the overlay view and run the
  falling-sand demo, and assert that no refresh code was made at run time.
  They do the plugin's work themselves, so they run whether or not it is
  opted in; without the registration, both assertions fail.
- **Cost: 1.9 KiB gzipped.** The site's JavaScript grows from 1,608 KiB to
  1,621 KiB (+0.8%), or from 500.8 KiB to 502.7 KiB gzipped (+0.4%).
- **Speed: the generated code, byte for byte.** Nothing to benchmark
  separately: a registered factory is the source the runtime would give
  `new Function`, and a test checks the runtime uses it with generation
  forbidden.

Not covered, and left to the runtime as the header of the plugin says:
elements with spread attributes, elements built by calling `jsx()` directly
from plain TypeScript, and code the playground compiles in the browser
(which runs it with `new Function`, so eval is allowed there anyway). The
benchmarks bundle with esbuild, not Vite, and run in Node, which allows
eval. After 011, the plugin would be an optional package for users who ship
under a strict CSP.

**C. A full JSX compiler (not pursued).** Compile intrinsic elements to
direct construction code with the refresh inlined, including the getters'
bodies (`x={() => item.x}` becomes `e.x = item.x`), as Solid's compiler does.
It is the only option that beats generated code everywhere, by the 15-31%
between `codegen` and `hand` in 7.5, because it removes the getter calls.
But it means writing a compiler that reproduces every runtime rule (children
first, inert construction, `visible` first, `ref` last, read counting, dev
checks), with source maps, while the runtime stays for the playground,
spreads and plain TypeScript; the conformance suite would have to run on
both. Refresh is rarely the largest cost in a frame (rendering usually is),
and the repo's measurements of whole games (`games-and-demos`) do not point
at it. What would reopen it: a profile of a real game in which JSX refresh is
among the top costs.

**D. Another way to run generated code without eval (ruled out).** Blob URL
modules and injected `<script>` elements need `script-src` allowances that a
policy strict enough to forbid eval also withholds. Without generating code,
the fastest design found is `steps` (7.5), which needs a hand-written factory
per attribute to reach even 1.8-2.4x.

---

### 7.7 Decided: one runtime, no generated code

Decided 2026-10-01 in task [025](../archive/025-precompiler-or-two-builds.md),
which has the evidence in full. Do not reopen without new information.

**What was decided.** Refresh methods are closures, everywhere: no
`new Function`, no probe, no dev warning, no `__MVT_JSX_EVAL__`, and no
precompiler (its Vite plugin, manifests, registration hook and version
checks). The last commit with them is tagged `jsx-precompiler-last`.

**Why.** Four options were weighed: keep the precompiler; two modes, as Pixi
has (generated code by default, an import for eval-free pages); both; or one
eval-free runtime. Pixi itself needs `'unsafe-eval'` unless the app imports
`pixi.js/unsafe-eval`, and throws without it; three.js, Solid and Preact
need none; about 5% of sites forbid eval through `script-src`, and Chrome
extension pages always do. The deciding evidence was speed: the closures
were made fast enough that a second path is not worth keeping.

**How the closures are fast** ([refresh-builder.ts](../../packages/utils/src/jsx/refresh-builder.ts)).
The first fallback was 6x to 16x slower than generated code (7.5.1). Three
causes were found, each measured:

1. **Writes V8 could not inline.** One keyed store, `el[name] = value`,
   shared by every property of every element, which V8 handles in its
   runtime when it reaches an accessor such as Pixi's `x`. Calling each
   property's setter, found once per prototype, made the fallback 4x to 6x
   faster, but V8 still cannot inline a setter called through `.call`.
2. **One set of call sites for every shape.** Refresh code shared by every
   element with the same number of bindings sees many getters and writes,
   and inlines none. Generated code had call sites per shape.
3. **Memory per element**, which dominates from about 5,000 elements:
   closures sharing one V8 context kept every slot alive, and each element
   had a typed array.

The fix for all three is copies. The refresh code for each number of
bindings, 1 to 6, is written out 17 times, in a module generated by
`scripts/generate-refresh-copies.ts` on install and before dev, build, test and
bench, and not checked in. A shape (its sequence of attribute definitions)
takes a copy of its own at its sixteenth element on one class of element,
while copies last; the rest share copy 0. A copy of one shape and class
assigns properties by name, a keyed store that sees one name and one class,
which V8 makes as fast as `el.x = value`; the shared copy calls setters.
Only a copy of its own may store by name: seeing seven classes, a keyed
store was 7x slower than generated code's.

**Two things tried and dropped.** Writes defined as functions in the
element tables (`(e, v) => { e.x = v; }`) matched generated code in every
isolated benchmark scene and were 30-50% slower in the falling-sand demo,
where one function writes `x` for every element of every class. Keying
copies by shape alone left a shape on many classes megamorphic; keyed by
class too, it beats generated code, which had one method per shape across
classes.

**Measured**, `refreshScene` or the whole frame as each suite reports it,
generated code against the closures, both with the element tables as they
are now (µs per frame, median of three processes; task 025, 2026-09-30):

| Scene | 1,000 | 10,000 | 50,000 |
| --- | --- | --- | --- |
| `jsx-refresh` uniform | 16.3 / 20.5 | 272 / 327 | 3,650 / 3,250 |
| `jsx-refresh` mixed | 31.8 / 36.8 | 646 / 747 | 6,410 / 7,040 |
| `jsx-refresh` eight kinds, one shape | 203 / 121 | 2,590 / 1,700 | 17,100 / 12,600 |
| Falling sand, settled | 27.9 / 36.1 | 486 / 463 | 4,840 / 5,520 |
| Falling sand, flipping | 37.8 / 45.6 | 632 / 810 | 5,740 / 6,720 |

The falling-sand demo as it ships, 128 against 124; the games, level, at
3-10 µs each. Building an element costs 5-10% more, and keeps about 3% more
memory. The residual, about 1.1x, is probably the per-write checks
generated code did not need (the kind of each slot, and the keyed store's
check of the name). The copies are 1.7 KB gzipped.

**Stack traces** name the copy: a binding that throws shows its getter,
then `refresh3Copy1` (three bindings, copy 1) at a line of
`refresh-copies.ts`, where `g0()` is the first binding. Generated code
showed only `eval ... <anonymous>`.

## 8. `<List>` and `<Switch>` on any JSX target

Both become factories over a JSX target, `createList({ target })` and
`createSwitch({ target })`, with every line of logic unchanged. The Pixi calls
they make map onto section 5's operations:

| Today | Generic |
| --- | --- |
| `new Container()` | `target.createGroup()` |
| `container.addChild(slot)` | `target.append(container, slot)` |
| `container.removeChildren(length, attachedCount)` | `target.detachTail(container, attachedCount - length)` |
| `removeChildAt(index)` + `addChildAt(slot, index)` | `target.replace(container, placeholder, slot)` |
| `slot.visible = isPresent` | `target.visible` write |
| `slot.destroy({ children: true })` | `target.destroy(slot)` |
| `container.on('destroyed', ...)` | `target.onDestroyed(container, ...)` |
| `refreshScene(slot)` | `target.refreshScene(slot)` |

`onRefresh` stays a property, and `readCounter` and `SKIP_DESCENDANTS` come
from the scene-pass core, so the rest of both files does not change. The
`matches` side table in `switch.ts` becomes one per `createSwitch` call.

In the steady state (no growth, no shrink, no change of presence) neither
component calls a JSX target operation, so the per-frame code is what it is now.

One addition, motivated by HTML but useful everywhere: **`<List>` may be
given its container.** `<List container={<ul class="menu" />} items={...}>`
builds its slots into the given element instead of a new group. In HTML that
keeps `ul > li` selectors and table structure (`<tbody>` directly holding
`<tr>`) intact; on Pixi it replaces the `ref` used today to set
`sortableChildren` on the list's own container. Children are built before
their parent, so the element exists when `<List>` runs. The list owns that
element's children, and the element must be empty. The base cannot check
that: the JSX target has no operation to count children.

---

## 9. The scene passes on any tree

The JSX base needs only `refreshScene` from a JSX target, and could stop there.
But the three JSX targets need scene passes, and 2.3 argues they should all have the
one pixi-mvt already has. The generic core is the current
`scene-passes.ts` with its two Pixi dependencies (`node.children` and
`node.parent`) turned into parameters.

### 9.1 The core

```ts
export interface SceneTree<N> {
    children: (node: N) => ArrayLike<N>;
    parent: (node: N) => N | null | undefined;
}

export interface ScenePasses<N> {
    updateScene: (node: N, deltaMs: number) => void;
    refreshScene: (node: N) => void;
    /** Clears both memos from `node` to the root. For a target's structural hooks. */
    invalidate: (node: N) => void;
    /** Installs `onUpdate` / `onRefresh` accessors and memo fields on a node prototype. */
    installMethods: (prototype: object) => void;
}

export function createScenePasses<N extends SceneNode>(tree: SceneTree<N>): ScenePasses<N>;
```

Everything else in pixi-mvt's design notes (the memo fields, the no-early-exit
rule in `has`, the invalidation short-circuit, the skip table, the check
for nodes detached during a scene pass, the re-entry guard) moves unchanged. Pixi keeps its structural
wrappers and its dev warning about destroying without `{ children: true }`.

This is also the natural point to land 012 section 2 (calling methods cached
in the memoised list rather than reading the accessor). In a page with two
renderers, the accessor read in the shared scene-pass loop would see node shapes from
two prototypes; cached methods avoid that read altogether.

### 9.2 Invalidation per renderer

The core needs to hear about every structural change. How depends on the
tree.

**Pixi:** unchanged. Wrappers on `addChild`, `addChildAt`, `removeChild`,
`removeChildren` and `destroy`.

**three.js:** wrappers on `Object3D.prototype.add`, `remove` and **`attach`**.
Checked against `Object3D.js` on `dev`: `removeFromParent` calls
`parent.remove`, and `clear` calls `remove(...children)`, so both are covered.
But `attach` does not call `add`: it calls `removeFromParent` and then pushes
onto `children` itself, so the new parent's side must be wrapped separately.
This is the same trap as Pixi's `addChildAt`, which splices without
`removeChild`. three.js also dispatches `childadded` and `childremoved`, but
listening needs a listener on every node, which pixi-mvt rejected for Pixi's
equivalent events.

**DOM:** wrapping `Node.prototype` methods would change behaviour for every
script on the page, and the surface is large (`appendChild`, `insertBefore`,
`append`, `prepend`, `before`, `after`, `replaceWith`, `replaceChildren`,
`innerHTML`, and more). Instead:

- One `MutationObserver` for the page, observing each driven node with
  `{ childList: true, subtree: true }` the first time it is driven.
- At the start of every scene pass, `observer.takeRecords()`, which returns the
  queued records synchronously and empties the queue, and `invalidate` from
  each record's `target` when it added or removed an `Element`. Text-only
  records are ignored: methods live on elements.
- The observer's callback does the same, for records that arrive between
  scene passes.

This catches every change, whoever makes it, with no prototype wrapping, and
gives the DOM the same scene-pass semantics as Pixi: a node attached during a
scene pass is not visited by it, and a node detached during one is skipped by
the live parent check (as built: `parentElement`, so a node moved into a
fragment counts as detached). `takeRecords` allocates one small array per scene pass, not per
node. To keep text changes from producing records at all, the HTML `text`
attribute writes `data` on a `Text` node it owns, rather than setting
`textContent`, which replaces the child and queues a record every time (and
is slower).

Method storage on the DOM: `installMethods(Element.prototype)` adds the
`onUpdate` / `onRefresh` accessors, as Pixi's mixin does on `Container`. That
is a global change to a built-in prototype, but it adds two accessors and
some `_mvt*` fields and wraps nothing. The alternative, functions such as
`setRefresh(el, fn)`, would make plain TypeScript views look different on
each renderer (open question 3).

### 9.3 A naive walk, considered

For the DOM, a scene pass could simply walk `firstElementChild` /
`nextElementSibling` every frame with no memo. HTML views in a game are small,
so it may well be fast enough. It is not recommended as the design, because
it changes the semantics `<List>` and `<Switch>` rely on: a slot attached
during a scene pass would be visited by that scene pass as well as refreshed by the list,
and the two behaviours would differ by renderer, which is spike 022a's
problem again. It is worth measuring against the memoised scene pass in phase 4.

---

## 10. Notes per renderer

### 10.1 Pixi

The JSX target is today's behaviour, moved:

- `jsx-runtime.ts` shrinks to section 4's sketch. The element table and the
  JSX target record become `pixi-elements.ts` and `pixi-target.ts`.
- pixi-mvt keeps its public API (`updateScene`, `refreshScene`,
  `SKIP_DESCENDANTS`, the `onUpdate` / `onRefresh` properties), built on the
  generic core, and re-exports the moved names from its barrel so no call
  site changes in phase 1.
- `Fragment` becomes one shared symbol, `Symbol.for('mvt-jsx.fragment')`.
- `listen` makes the element `'static'` before adding the listener (5.2).
  The existing test "eventMode attribute wins over the default an event
  handler attribute sets" is the contract, and passes unchanged.

### 10.2 HTML

- **Node type** `Element`, so SVG elements can be children later
  (section 11.2). `JSX.Element` is `HTMLElement`. *As built, `Element`:
  `<List>` and components return the node type, and TypeScript requires a
  component's return type to be `JSX.Element`.*
- **The table** is generated from tag lists with `HTMLElementTagNameMap`, so
  `ref` on `<input>` receives an `HTMLInputElement`:

  ```ts
  export const htmlElements = defineElements({
      ...elementsFor(['div', 'span', 'section', 'p', 'ul', 'li', /* ... */], globalAttributes),
      input: element(() => document.createElement('input'), { ...globalAttributes, ...formAttributes, type: fixed<InputType>() }),
      // ...
  });
  ```

- **Almost everything is `onChange`.** In the DOM, reads are cheap and writes
  are not: a write can invalidate style or layout even when the value is the
  same. Spike 022a reached the same conclusion.
- **`class`** is `onChange<string>`, applied as `className`. **`style`**
  is fixed. Changing styles go through `class`, or through CSS custom
  properties (open question 5).
- **`text`** is `onChange`, and writes to a `Text` node the element owns
  (sections 5.4 and 9.2). It is the only way to put text in an element.
- **`value` and `checked`** are `everyFrame`, compared against the element's
  live value, not the last written one, and skipped while the user is editing
  the field. Spike 022a compared with the last written value, so a model
  that rejects typed input never puts its value back (2.5). Comparing with
  the element costs a property read per frame and is correct.
- **Visibility** is the `hidden` property, on change. *As built, the
  `hidden` attribute (SVG elements have no `hidden` property), written every
  frame and compared with the element first: `<List>` writes visibility
  behind a binding's back, and an on-change write lost that (the
  conformance suite's "keeps a slot its own visible binding hides hidden"
  case, which failed with it).* It has the right
  meaning for assistive technology and needs no style. It loses to author CSS
  that sets `display` on the same element, which is a known property of
  `hidden`; the docs should say so.
- **Groups** are `<mvt-group>` elements, styled once with an injected rule,
  `mvt-group:not([hidden]) { display: contents }`. A custom tag makes groups
  recognisable in the devtools, and needs no inline style. The `:not` is
  required: the rule is author CSS, which would otherwise beat the browser's
  `[hidden] { display: none }`. Inside a shadow root, the rule must be
  adopted there as well.
- **Events:** `addEventListener`. Listeners on the element go with it when it
  is collected, so `destroy` removes none; only listeners on `window` or
  `document` need `onDestroyed`.
- **Refresh must not read layout.** Reading `offsetWidth` in a refresh after
  writes forces a synchronous layout. The docs for the HTML JSX target should say
  a refresh only writes.
- **Tests** need a DOM: `happy-dom` or `jsdom` as a dev dependency, used by
  the HTML tests only.
- *As built, also:* `valueAsNumber` on `<input>`, for a model's number with
  no string made per frame; `data-*` and `aria-*` through element patterns
  (6.4), which TypeScript does not check in JSX, since it never checks a
  hyphenated JSX attribute against an index signature; and the memoised walk
  rebuilds from a sibling walk rather than `children`, which was twice as
  slow to rebuild in Chrome. The DOM's transient observers cover a node
  removed from a watched subtree until its removal is processed; happy-dom
  has none, so its tests process a removal before changing the removed node.

### 10.3 three.js

- **Node type** `Object3D`. `createGroup` is `new Group()`. Child order has no
  visual effect, so `replace` is `remove` then `add`.
- **Transforms** are per axis, like Pixi's `x` and `scaleX`, because a view
  computes each from the model's domain coordinates (rule 6):
  `x`, `y`, `z` (applied to `e.position`), `rotationX`/`Y`/`Z`, and
  `scale` (`e.scale.setScalar(v)`) with `scaleX`/`Y`/`Z`. Whole-vector
  `position` and `quaternion` take any `{ x, y, z }` (or `{ x, y, z, w }`) the
  model owns, and `copy` it: no tuple is built per frame.
- **Geometry and material** are `onChange` attributes of `<mesh>`, as in the
  spike 022a. No `color` attribute on meshes: a material is shared state, and
  whoever owns it changes it (2.5).
- **Cameras** recompute their projection when `fov`, `near`, `far` or
  `aspect` change, so those are `onChange` with an `apply` that calls
  `updateProjectionMatrix()`. Two of them changing in one frame recompute it
  twice. That is rare enough to accept; open question 7 has a general fix.
- **Visibility** is `visible`, every frame. three's renderer does not descend
  into invisible objects, which agrees with `SKIP_DESCENDANTS`.
- **Why scene passes, not `onBeforeRender`:** three calls `onBeforeRender` only on
  objects it draws, after frustum culling, so a binding that moves an object
  back into view never runs (spike 022a found this too).
- **Events:** `Object3D` is an `EventDispatcher`, so `listen` is
  `addEventListener`. A picker (`createPointerPicker({ canvas, camera,
  scene })`) raycasts on pointer events and dispatches a `click`,
  `pointerover` or `pointerout` event on the hit object and each ancestor in
  turn, until a handler stops it. Handlers need no side table.
- **Destroying** runs `onDestroyed` callbacks and detaches. It does not
  dispose geometry, materials or textures, since the view does not know who
  else uses them; a view that made one releases it in `onDestroyed`, the same
  rule as a Pixi view with a `GraphicsContext`.
- **Tests** run in Node: the scene graph needs no WebGL.

---

## 11. Other renderers

### 11.1 A plain-object JSX target for tests (recommended, first)

Nodes are plain records: `{ kind, attributes, children, parent, visible,
onUpdate, onRefresh }`, with an element table that records each write. It
costs little and does three jobs:

- **It proves the base has no hidden Pixi dependency.** If `<List>` passes
  its tests on plain objects, the abstraction is real.
- **It is the conformance suite's reference JSX target.** The suite (section 16)
  is written against the JSX target interface and run on every JSX target.
- **It gives fast tests for views' structure**, and readable snapshots of a
  view's tree, without a renderer.

*Built in phase 2 and deleted after phase 5 (2026-09-30): by then three.js
and HTML proved the first job, three.js runs the suite in Node as fast as
plain objects did, and no view had used it for the third. The base's own
unit tests keep a small fake JSX target of their own.*

### 11.2 Good fits

- **SVG.** A retained tree in the DOM, attribute-heavy, good for vector HUDs,
  charts and editors. It reuses the DOM's scene passes and the HTML JSX target's structure
  operations; only element creation (`createElementNS`) and the table differ.
  Its tag names collide with HTML's (`a`, `title`, `text`), so it is its own
  `jsxImportSource` (`@mvtjs/html/svg`, say), with an `<svg>` element in the
  HTML table as the bridge.
- **Babylon.js** (`TransformNode` / `Node` tree, `parent` setter) and
  **PlayCanvas** (`Entity` tree, `addChild` / `removeChild`). Both are
  retained scene graphs with prototypes that can carry the method accessors.
- **Mixed renderers.** A Pixi element that holds an HTML view (Pixi 8's
  `DOMContainer`), or an HTML element that holds a canvas, can drive the
  other renderer's scene pass from its own `onRefresh`. Driving a different subtree
  from a method is already allowed; nothing new is needed but a small element
  definition on each side.

### 11.3 Poor fits

- **Immediate-mode drawing** (Canvas 2D, a hand-rolled WebGPU pass). JSX here
  builds a retained tree; with nothing retained there is no node to hold
  bindings. A tiny retained layer could be written, but it would be a
  renderer, not a JSX target.
- **Phaser.** Game objects live in a flat display list per scene, with
  `Container` as the exception, so most of the tree the scene passes walk would not
  exist.
- **Web Audio.** Its node graph is a directed graph, not a tree; per-frame
  parameter bindings are appealing, but the scene passes' parent-before-child
  order has no meaning there.

---

## 12. Where the code lives

**In this repo, before 011's split.** Each directory is shaped as the
package it will become: one base, and one per renderer, each renderer's JSX
support in a `jsx/` subdirectory, as each package will export it at `./jsx`
(decided 2026-09-30, after phase 5; earlier phases had `src/mvt-scene-passes/`,
`src/mvt-jsx/`, and a `src/<renderer>-jsx/` beside each `src/<renderer>-mvt/`):

| Directory | Contents | Becomes |
| --- | --- | --- |
| `src/mvt-utils/` | The generic scene-pass core: `SKIP_DESCENDANTS`, method types, `readCounter`, `createScenePasses`, `createDestroyRegistry`; and the renderer-agnostic helpers from `src/common/`: `watch`, `SlotList`, sequences, tweens, `memoiseLast` | `@mvtjs/utils` |
| `src/mvt-utils/jsx/` | The JSX base: attribute helpers, `defineElements`, `createJsx`, `createList`, `createSwitch`, `registerRefreshFactories`, shared types | `@mvtjs/utils/jsx` |
| `src/pixi-mvt/` | Pixi scene passes, on the core; the texture registry and frame stats, from `src/common/` | `@mvtjs/pixi` |
| `src/pixi-mvt/jsx/` | Pixi JSX target, element table, `jsx-runtime.ts`, the `List` / `Switch` instances, the precompile manifest | `@mvtjs/pixi/jsx` |
| `src/three-mvt/`, `src/three-mvt/jsx/` | three.js scene passes and pointer picker; its JSX target, element table, runtime and manifest | `@mvtjs/three`, `@mvtjs/three/jsx` |
| `src/html-mvt/`, `src/html-mvt/jsx/` | DOM scene passes; its JSX target, element table, runtime and manifest | `@mvtjs/html`, `@mvtjs/html/jsx` |
| `scripts/vite-plugin-jsx-precompile.ts`, `scripts/jsx-precompile-manifest.ts` | The build-time precompiler (7.6, option B), opt-in through the site's Vite config, and the manifests it reads (12.1) | `@mvtjs/jsx-precompile` |
| `src/mvt-utils/jsx/conformance/`, and `conformance.test.ts` in each renderer's `jsx/` | The conformance suite, which depends only on the base; each renderer's tests run it with a fixture for its JSX target | `@mvtjs/utils/jsx/conformance`, a test kit for JSX targets (`vitest` an optional peer), or a private workspace package |
| ~~`src/plain-jsx/`~~ | The plain-object JSX target for tests (11.1), from phase 2; deleted once redundant | |

A module's pragma names the renderer's `jsx` subpath: `@jsxImportSource
#pixi-mvt/jsx` here, `@jsxImportSource @mvtjs/pixi/jsx` once published.
TypeScript and esbuild append `/jsx-runtime`, so the package exports
`./jsx/jsx-runtime` and `./jsx/jsx-dev-runtime`, and `./jsx/precompile`
beside them. A plain TypeScript view imports only a renderer's root, which
never re-exports its `jsx` subpath, so JSX stays optional to use.

**After 011:** one base package, `@mvtjs/utils`, and one package per
renderer, each depending on the base. The base holds the scene-pass core at
its root and the JSX base at `./jsx`, which only renderer packages and
authors of new JSX targets import. This proposal first put the JSX base in a
package of its own, `@mvtjs/jsx`; folding it into the base saves a package,
and loses little, since 011 gives every library one version anyway. The
cost accepted: the base package contains `new Function`, which some security
scanners flag in a package whether or not it runs. A bundle that never
imports `./jsx` leaves it out.

### 12.1 The precompiler

> Removed (section 7.7). The last commit with it is tagged
> `jsx-precompiler-last`.

The precompiler is build-time code: it runs in Node, while a bundler builds
the app or its dev server transforms a module, and nothing of it ships. What
it writes is ordinary code in the app's own modules. So it packages as a
tool beside the libraries, as 011 section 10 plans `@mvtjs/eslint-plugin`:

| Package | Contents | Depends on | Runs |
| --- | --- | --- | --- |
| `@mvtjs/utils` | The scene-pass core; the JSX base at `./jsx`, with `refresh-source` exported for the precompiler | nothing | anywhere |
| `@mvtjs/pixi` (and `html`, `three`) | Scene passes; at `./jsx` the JSX target, `./jsx/jsx-runtime` (which re-exports the base's `registerRefreshFactories`) and a `./jsx/precompile` manifest | `@mvtjs/utils`; `pixi.js` as a peer | browser |
| `@mvtjs/jsx-precompile` | The pure transform (`precompileModule`) at `.`, the Vite plugin at `./vite`, and what makes and reads manifests | `@mvtjs/utils`; `typescript` as a peer, `vite` as an optional peer | Node, at build time |

- **Its own package, not a subpath of the base.** The runtime packages
  stay browser-only, with no `typescript` or `vite` dependency, and no one
  pays for a tool they do not use. Opting in is installing it and adding it
  to the bundler's config; this repo's `MVT_JSX_PRECOMPILE` switch stays in
  the private site package, as the site's own choice.
- **`typescript` is a peer**, so the tool parses with the project's own
  TypeScript rather than a second copy. It parses `.tsx`; plain `.jsx` is a
  small extension (`ScriptKind.JSX`) for users without TypeScript.
- **It shares its source with the runtime, and a version guards the pair.**
  The shape key and the factory source come from one pure module,
  `refresh-source`, in `@mvtjs/utils/jsx`, and 011's one shared version keeps the
  two packages in step. A lockfile can still pair other versions, so each
  registration carries `REFRESH_SOURCE_VERSION`, and a runtime ignores
  factories of any other version and generates its own, with a warning in dev
  builds. A test pins what each version produces, so a change to either
  output fails until the version is bumped. Built, ahead of the packaging.
- **Each renderer package ships a precompile manifest.** Today the site's
  Vite config hands the plugin the Pixi element table by importing
  `src/pixi-jsx`, which loads `pixi.js` in Node and installs the pixi-mvt
  mixin on `Container`. That works for Pixi, and would not for HTML, whose
  scene passes install accessors on `Element.prototype`, with no DOM in Node. The
  plugin needs only data: per element, each attribute's write kind and
  property, and the `visible` attribute's. So each renderer package exports
  it at `./jsx/precompile`, generated from the element table when the package is
  built, with a test that fails if the two drift. It imports no renderer and
  has no side effects.
- **Configuration: none.** The plugin reads a module's `@jsxImportSource`
  and loads `<importSource>/precompile`; a module whose import source has no
  manifest is left alone. A user's Vite config is `plugins:
  [mvtJsxPrecompile()]`, and a new renderer package works with the plugin by
  shipping its manifest. The registration is imported from
  `<importSource>/jsx-runtime`, where JSX already resolves.
- **Bundlers other than Vite.** `precompileModule` is already a pure
  function of a module's source, so an esbuild, webpack or Bun adapter is a
  thin wrapper, to write if someone asks for one.

Moving there from today: the plugin and its unit tests move into the new
package; the test that this repo's views are fully precompiled stays with the
site, since it tests the site's views; the Pixi package gains its manifest,
and the site's Vite config drops its import of `src/pixi-jsx`.

*Built in phase 5, before the packages:* the manifests, and the plugin's
lookup of them. Each JSX target's manifest is JSON beside it
(`src/<renderer>-mvt/jsx/precompile-manifest.json`), reached as
`#<renderer>-mvt/jsx/precompile` through `package.json`'s `imports`, as a
package would export `./jsx/precompile`. `createPrecompileManifest`
(`scripts/jsx-precompile-manifest.ts`, with the precompiler, not in the base)
makes it from the JSX target and its table. Elements with the same attributes share one
record, which keeps HTML's under 20 KB. It carries its own format number,
checked by the plugin, as registrations carry the refresh source's version.
Until there is a package build to make them, they are saved by `npm run
generate-precompile-manifests`, and a test fails when a saved manifest
disagrees with its table. The plugin takes no options, and resolves
`<importSource>/precompile` with Vite's own resolver, as the module would
import it. A source that has none is left alone. The site's Vite config
imports no JSX target. The precompiled build is unchanged: the same 60 shapes,
and the same one element left to the runtime.

*The precompiler's footprint on the runtime*, audited after phase 5 and
reduced to one hook. The runtime knows nothing of manifests. It has one
entry point for pre-made code, `registerRefreshFactories`, in the base: one
registry for every JSX target, since generated code depends only on a binding
shape, with its version guard, a count, and one dev warning. Each renderer's
`jsx-runtime` re-exports it in one line, because the generated code imports
it from `<importSource>/jsx-runtime`: an app can always resolve that, but
under pnpm it cannot import the base, which it does not depend on itself.
Unused, the hook costs a map lookup the first time each binding shape is
built. The renderer carries one generated file, its manifest.

Open: the package's name (`@mvtjs/jsx-precompile` is proposed). ~~Whether
the manifest is generated at the package's build (proposed: data only, so
side-effect-free by construction) or read when the plugin starts from a
separate `./elements` entry, which would then have to promise never to import
the renderer.~~ Generated: data only, as proposed.

011 section 5.5 says this abstraction should wait for a second renderer,
because doing it earlier "would be guessing". This proposal is designed
against three concrete JSX targets and a working attempt at the same thing, which
is the information 011 was waiting for. Section 5.5 should link here when
this is accepted.

---

## 13. Found in the current runtime

Recorded so they are not lost, whatever happens to the rest:

1. **Generated code takes any key** whose value is a function, including keys
   from a spread (7.4). Unlikely to be exploitable, since a function cannot
   come from JSON. **Fixed in phase 1**: such a key throws as an unknown
   attribute, and only property names from element tables, checked to be
   identifiers, reach generated source.
2. **Binding both `scale` and `width` misbehaves.** Pixi's `width` setter
   writes `scale.x` (`measureMixin._setWidth`, checked in 8.15). `scale` is
   written every frame and `width` only on change, so from the second frame
   `scale` wins and the width is lost. The same holds for `scaleX` and
   `height`/`scaleY`. **Still open after phase 1** (the phase 1 tests met it
   by accident). A table can declare such pairs, and dev builds can warn
   when an element binds both.
3. **Types and behaviour disagree on some attributes.** `label` and `style`
   are typed as fixed values but listed in `WATCHED_ATTRIBUTES`, so a getter
   would work at run time and fail to compile. Unknown keys are typed out but
   applied at run time with `el[key] = value`. The table ends both. **Fixed
   in phase 1**, in favour of the runtime: an existing test binds `label` to a
   getter, so `label` and `style` are `onChange`, and their types now accept
   getters. Unknown keys throw.

---

## 14. Settled here

Do not reopen without new information.

- **One refresh model for every JSX target.** Renderer-driven refresh (`onRender`
  and similar hooks) is ruled out for the reasons in 2.3 and the pixi-mvt
  design notes. Manual propagation (each node's refresh closing over its
  children's) is ruled out because it snapshots the tree at construction.
  What would reopen it: a JSX target whose tree cannot be walked at all.
- **Intrinsic elements are data over one implementation.** Per-target copies
  of `jsx()` are ruled out; section 2.4 shows the drift they produce within
  weeks.
- **The base carries `<List>` and `<Switch>`, not diffing components.**
  004's settled semantics apply on every JSX target.
- **No positional insert in the JSX target.** The base never needs one (5.1).
- **Plain assignments are assigned inline, by property name.** Apply
  functions for them measured 10-43% slower on a scene of many element
  shapes (6.1). Other writes call an apply function; arbitrary source
  snippets in tables are not needed.
- **Generated code stays the primary path.** Every eval-free design measured
  was 1.8x to 4.9x slower on refresh in the scratch benchmark (7.5), and the
  fallback as built is 6x to 16x slower (7.5.1).
- **DOM invalidation does not wrap `Node.prototype` methods.** Too large a
  surface, and it changes behaviour for every script on the page.

---

## 15. Open questions

1. ~~**Names.** "Target" for the record in section 5 (the runtime's header
   already says it "targets Pixi.js scene-graph construction"; "renderer"
   clashes with Pixi's `Renderer`). `fixed`, `everyFrame`, `onChange`,
   `onChangeNumber` for the helpers. `mvt-jsx` and `mvt-scene-passes` for the
   directories.~~ Settled (2026-09-30): two terms, one meaning each. A
   **renderer** is Pixi, three.js or the DOM: the library that draws, and
   what a renderer package is named for. A **JSX target** is the record of
   section 5, a renderer's scene graph as the JSX base needs it; it is never
   called just "target" in prose. The alternatives: "renderer" for both, as
   Vue's and Solid's `createRenderer` and React's renderers do, clashes with
   Pixi's `Renderer` and three's `WebGLRenderer`; React's "host" is jargon
   from its internals; "render target" is a class in both libraries
   (`WebGLRenderTarget`, `RenderTarget`). The helpers' names stand, and the
   directories are section 12's.
2. **Types from the table, or checked against it?** Derived types (6.5) are
   one source of truth. Hand-written interfaces checked with `satisfies` keep
   declarations that read well in hover and in `.d.ts` files, at the cost of
   editing two places. Decide after seeing both in phase 1.
3. **DOM method storage.** Accessors on `Element.prototype` (recommended, for
   one way of writing views on every JSX target), or exported functions.
4. **Text children in HTML.** Left out (section 5.4). If they are added,
   function children as live text (`<span>{() => model.score}</span>`, as in
   Solid) should still not be: here a function child already means "build
   this lazily" (`<List>`, `<Match>`).
5. **Changing styles in HTML.** `class` covers most cases. Candidates for the
   rest: a `vars` attribute writing CSS custom properties, or per-property
   attributes. No case in the repo yet.
6. **Cost of two JSX targets in one page.** The shared `<List>` and `<Switch>`
   closures, and the scene-pass loop, will see two JSX targets' functions and nodes.
   V8 handles two shapes at a call site well; measure a three.js scene with an
   HTML panel in phase 4, and only act if it shows. *Measured in phase 4
   (step 16): 5% on an HTML list and 14% on a three.js list after the other
   JSX target's list has run, both inside the benchmark's own run-to-run noise
   of 10-13%. Not acted on.*
7. **An element-level commit step.** Attributes could mark their element
   dirty, and the generated code call the element definition's `commit` once
   at the end (three.js `updateProjectionMatrix`). Worth adding only when a
   second element needs it.
8. **`<Portal>` and a key-rebuild component** (021's follow-ups) would each
   be written once on the base. A portal needs an operation the JSX target does
   not have yet (render elsewhere, keep driving from here); design it when
   one is needed.

---

## 16. Implementation steps

Each phase ends with `npm run lint`, `npm run build` and `npm test` passing.

**Phase 1: the base, with Pixi as its only JSX target. No observable change.**

1. ~~Move `SKIP_DESCENDANTS`, `UpdateMethod`, `RefreshMethod` and
   `readCounter` into `src/mvt-utils/`; pixi-mvt re-exports them.~~ Done,
   with a `SceneNode` type for nodes that carry the two methods.
2. ~~Write `src/mvt-utils/jsx/`: attribute helpers, `defineElements`, the generalised
   generator and its closure fallback, `createJsx`, the shared types.~~ Done.
   The helpers came out as `attributesOf<E>()`, taking a property name or an
   apply function (6.1); the dev warning and `__MVT_JSX_EVAL__` are in.
3. ~~Write the Pixi table and JSX target; reduce `jsx-runtime.ts` to section 4's
   sketch.~~ Done: `pixi-elements.ts`, `pixi-target.ts`, both exported from
   `#pixi-mvt/jsx`.
4. ~~Turn `list.ts` and `switch.ts` into `createList` and `createSwitch` in the
   base, with the Pixi instances exported from `#pixi-mvt/jsx`. Add `<List
   container>`.~~ Done. The container is trusted to be empty; the base cannot
   count a JSX target's children (section 8).
5. ~~Every existing test in `src/pixi-mvt/jsx/` passes without edits (they are the
   contract), plus new tests for the table's dev checks and for section 13's
   items.~~ Done: all 697 tests passed unedited (one pixi-mvt test import
   moved), plus 19 new ones, 716 in all. `src/mvt-utils/jsx/create-jsx.test.ts`
   runs the base on a plain-object JSX target, and both it and
   `src/pixi-mvt/jsx/pixi-target.test.ts` check that generated code and the
   fallback write the same values with the same read counts. Section 13's
   item 2 is still open.
6. ~~Benchmarks within noise of the saved results: `reactivity`, `scaling`,
   `construction`, `memory` (bytes per frame, the boxing fix included) and
   `falling-sand-scaling`. Add section 7.5's comparison as a suite, with the
   generated, fallback and hand-written arms, so the fallback's cost is on
   record and re-measured with the others.~~ Done, as an A/B against the old
   runtime rather than the saved results, with results in section 7.5.1. The
   suite is `jsx-refresh`. Its results are not saved to `benchmarks/results/`
   yet: `--save` refuses filtered runs, and a full save takes about an hour.
7. ~~Update the pixi-jsx design notes and runtime header; add design notes for
   the base.~~ Done: the settled decisions moved to
   [src/mvt-utils/jsx/design-notes.md](../../packages/utils/src/jsx/design-notes.md), and
   [src/pixi-mvt/jsx/design-notes.md](../../packages/pixi/src/jsx/design-notes.md) keeps
   the Pixi facts.

**Phase 2: the generic scene passes and the JSX target for tests.**

8. ~~Extract `createScenePasses` from pixi-mvt; Pixi keeps its wrappers and
   warnings. `scene-passes` suite within noise. Land 012 section 2 here, or
   record why not.~~ Done, and 012 section 2 landed, at a measured cost the
   step did not foresee. `src/mvt-utils/scene-passes.ts` holds the
   walk, the method accessors (and with them the style guide's `this`
   exemption) and `SubtreeInfo<N>`; pixi-mvt keeps its type augmentation,
   structural wrappers, destroy warning, and `updateScene` / `refreshScene`
   over containers; `mvt-types.ts` is gone. All pixi-mvt tests passed
   unchanged. Measured against the old walk, in one session:
   - The generic shape itself costs nothing: with the old loop inside it,
     `dense` and `sparse` matched the old walk to within 2%.
   - 012's cached methods make the falling-sand demo's refresh 4-27% faster
     (about 20% on average, from 1,000 to 200,000 grains), a uniform scene
     16% slower (`dense`, about 0.4 ns per container), and a scene rebuilt
     every frame 16% slower (`churn`); the `scaling` suite came out level.
     Real scenes are mixed and rarely rebuilt, so the trade was taken; 012
     section 2.4 has the numbers, from an A/B against the old walk.
   - A shared helper reading a node's method stopped V8 inlining the
     accessor, and made `churn` 25% slower on its own; the reads are inline.
9. ~~Write the plain-object JSX target (11.1).~~ Done: `src/plain-jsx/`
   (deleted after phase 5, as redundant; see 11.1). Plain
   nodes are records made from one prototype carrying the scene passes'
   accessors, and record every attribute write. Renderers without a destroy of
   their own share a destroy registry, `createDestroyRegistry` in
   `src/mvt-utils/`.
10. ~~Write the conformance suite, parameterised by JSX target, from the behaviour
    in section 3: inert construction, `visible` skipping, `onRefresh` order,
    read counts, destroy callbacks, every `<List>` and `<Switch>` case. Run it
    on Pixi and on the JSX target for tests, with generated code and with the
    fallback. Move the target-independent `<List>` and `<Switch>` tests into
    it.~~ Done: `src/jsx-conformance/`, 62 tests per JSX target and code path.
    A fixture tells the suite, per JSX target, which element and attribute to
    probe for each write kind, and how to read children, parents, visibility
    and destruction. Pixi's `list.test.ts` and `switch.test.ts` moved into it
    whole, reworded to use the fixture; `jsx-runtime.test.ts` stays, for
    Pixi's own attributes.

**Phase 3: three.js.** Done (2026-09-28), against three r186.

11. ~~Add `three` as a dev dependency. Three scene passes (wrapping `add`, `remove`,
    `attach`), JSX target, table, picker.~~ Done, with `three` as a dependency
    rather than a dev dependency, since the demo ships it, and
    `@types/three` as a dev dependency. The split follows Pixi's:
    `src/three-mvt/` (scene passes on `Object3D`, with `destroyObject` and
    `onDestroyed`) and `src/three-mvt/jsx/` (JSX target, table, runtime, `<List>`,
    `<Switch>`, `createPointerPicker`), reached as `#three-mvt/jsx`. The wrappers
    were checked against the installed r186: `attach` still bypasses `add`.
12. ~~Conformance suite on three.js, in Node.~~ Done: all 124 pass, with no
    WebGL. three-mvt's own tests cover `add`, `remove`, `attach`, `clear`,
    `removeFromParent`, reparenting and `destroyObject`; the picker's run a
    real raycaster against a stand-in canvas.
13. ~~A small demo on an existing model, to see it working.~~ Done: "Boids in
    3D", at `site/demos/boids-3d/`, linked from the demos gallery. The boids
    demo's flock model, unchanged, drawn with `<List>` over cone meshes;
    clicking the ground adds boids, through the picker, and clicking a boid
    removes some. Its view is tested in Node (placement, following the flock,
    a picker click); its rendering has not been checked in a browser by
    these notes' author.

**Phase 4: HTML.** Done (2026-09-29).

14. ~~Add `happy-dom` (or `jsdom`) as a dev dependency for the HTML tests.
    HTML scene passes (`Element.prototype` accessors, the `MutationObserver`),
    JSX target, generated table, the `<mvt-group>` rule.~~ Done, with `happy-dom`.
    As with three.js, the split follows Pixi's: `src/html-mvt/` (scene passes
    on `Element`, `destroyElement`, `onDestroyed`) and `src/html-mvt/jsx/`
    (JSX target, table, runtime, `<List>`, `<Switch>`, `MVT_GROUP_CSS`), reached
    as `#html-mvt/jsx`. html-mvt loads without a DOM, so the precompiler reads the
    HTML table in Node; the precompiler handles patterns too. Where the build
    differs from section 10.2, the section says so in italics.
15. ~~Conformance suite on HTML, including with `new Function` unavailable,
    and the dev warning and `__MVT_JSX_EVAL__` (7.4).~~ Done: 126 tests, plus
    one new `<List>` case on every JSX target (section 10.2, visibility). A blocked `new Function`
    is a stubbed global under fresh module imports: bindings fall back, one
    dev warning, and with `__MVT_JSX_EVAL__` false, no probe and no warning.
16. ~~Measure the memoised DOM scene pass against a naive walk (9.3), and two
    JSX targets in one page (open question 6).~~ Done, in headless Chrome 154: the
    benchmark driver can now run a suite's cases in a page
    (`environment: 'browser'`), and the `html-scene-passes` suite's results
    are saved. Per frame, over rows of ten elements:
    - Every element with a method: memoised 7.4 µs for 1,000 elements, naive
      15 µs; 82 against 150 at 10,000.
    - One in twenty: 0.44 against 15 µs at 1,000; 4.7 against 150 at 10,000.
    - The tree changing every frame, so the memo is rebuilt every frame:
      memoised 50 µs at 1,000, naive 15; 472 against 148 at 10,000. That is
      about 45 ns per element per rebuild, after halving it (section 10.2),
      so the memo pays for itself unless most of a large tree changes every
      few frames. HTML panels in games rarely do; the recommendation stands.
    - Two JSX targets: see open question 6.
17. ~~A demo: an HTML panel beside a Pixi or three.js view of the same
    model.~~ Done: "Boids in 3D" gained a settings panel, sliders for the
    flock's size and steering weights, in HTML through `#html-mvt/jsx`, beside
    the three.js view. Each follows the model, so a boid count changed by a
    click in the scene moves its slider. Checked in headless Chrome (WebGL
    through SwiftShader): both views render.

**Phase 5: packaging.** Follow 011: the scene-pass core and the JSX base into
`@mvtjs/utils`, each JSX target into its renderer package at `./jsx`, and the
precompiler into `@mvtjs/jsx-precompile`, with a `./jsx/precompile` manifest
in each renderer package (section 12). ~~Update 011 section 5.5 to point
here.~~ Done, and updated again for the layout below.

18. ~~Precompile manifests, and a precompiler that needs no configuration
    (12.1).~~ Done (2026-09-29), ahead of 011, as 12.1 describes.
19. ~~Shape the directories as the packages: one base and one per
    renderer, with JSX at `jsx/`.~~ Done (2026-09-30), as section 12's table
    shows. The pragma is `#<renderer>-mvt/jsx`; the pointer picker moved to
    `three-mvt`'s root, since it is useful without JSX; the base's
    `jsx/`-subpath imports are allowed by the barrel rule, which was fixed on
    the way (011 section 11.1); `src/plain-jsx/` was deleted (11.1); and
    "renderer" and "JSX target" now have one meaning each (open question 1).
    And the precompiler's footprint was cut to one hook (12.1): the
    refresh-factory registry moved from each runtime to the base, and the
    manifest code from the base to `scripts/`.
20. Move the directories into packages, once 011's workspace exists, as
    section 12's table maps them. The manifests then come from each
    package's build, and `generate-precompile-manifests` goes. Not started:
    011 is proposed, not begun, and its phase 0 changes the package manager
    and CI. `src/common/`'s renderer-agnostic helpers moved into the base
    and its Pixi helpers into `src/pixi-mvt/` (2026-09-30), and the
    conformance suite into the base (above), so 011 moves directories, not
    files. The `-mvt` suffixes go with that move: the packages are
    `@mvtjs/utils`, `@mvtjs/pixi`, `@mvtjs/three` and `@mvtjs/html`, in
    `packages/<name>/`.
