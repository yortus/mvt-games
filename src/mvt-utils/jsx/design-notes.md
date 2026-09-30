# Design notes

> Decisions about the renderer-agnostic JSX base that are not visible in its
> code: how it is split from each JSX target, why its refresh methods are
> generated code, and the features it deliberately lacks. How the runtime
> works is in the header comments of [create-jsx.ts](./create-jsx.ts),
> [refresh-builder.ts](./refresh-builder.ts), [list.ts](./list.ts) and
> [switch.ts](./switch.ts). The design and its measurements are in
> [022](../../../notes/proposals/022-renderer-agnostic-jsx.md); the design of
> `<List>` and `<Switch>` is in [004](../../../notes/archive/004-list-proposal.md).
> Pixi facts the Pixi JSX target relies on are in
> [its design notes](../../pixi-mvt/jsx/design-notes.md).

**Written:** 2026-09-28, when the base was split out of `src/pixi-mvt/jsx/`
(022 phase 1). Sections 1-4 were first written for the Pixi runtime, from a
comparison with other runtimes
([task 021](../../../notes/archive/021-jsx-and-teardown-quick-wins.md)), and
apply unchanged to every JSX target.

## Settled decisions

Do not reopen these without new information. Section 4 says what would count
for the first three.

### 1. Children are built before their parent

JSX compiles `<Parent><Child /></Parent>` to a call whose argument is the
already-built child: `jsx(Parent, { children: jsx(Child, {}) })`. So when a
component's body runs, its children already exist. `<Switch>` relies on this,
reading its `<Match>` children at construction, and so does `<List>` when it
is given its container.

SolidJS avoids this: its compiler wraps children in getters, so a parent runs
first and can set things up before its children are built. Both features
below depend on that ordering in Solid, which is why neither carries over as
it is.

### 2. No context providers

In Solid, a view reads a value from whichever ancestor provides it
(`useContext`). Here, `<Provider value={x}><Child /></Provider>` builds the
child before the provider runs, so a provider could only work in one of two
ways:

- **Function children** (`{() => <Child />}`) everywhere below a provider,
  which every caller would pay for in noise.
- **A lookup that climbs the parent chain** inside a getter. Construction is
  inert, so by a getter's first call the tree exists. But the lookup could
  never be used while building (to decide structure), and its answer changes
  if the view is moved to another parent.

Either way it would hide inputs. A view's bindings are its whole contract and
its test seam; a value looked up from wherever the view ends up is an input
that neither shows, and a missing one fails at run time rather than compile
time. The needs context meets are met instead by the four ways in
[Sharing What Many Views Need](../../../docs/building-with-mvt/presenting-the-world/view-composition.md#sharing-what-many-views-need):
imports, a function that makes views over shared things, handing over a built
child, and grouping shared bindings.

### 3. No cleanup scopes, for now

In Solid, `onCleanup` registers on the component being built, and runs when
that part of the tree is thrown away. There is little for it to do here:

- Few views hold anything to release. Views poll rather than subscribe, and
  rule 1 bans timers, which removes most of what Solid cleans up.
- Nothing is thrown away during play. `<List>` keeps every item view it
  builds, `<Switch>` keeps every branch, and the only thing either destroys is
  `<List>`'s own empty placeholders. A view is destroyed about once, when its
  session ends.

What there is (`window` listeners, a shared resource, a texture a view made,
a GSAP timeline) is released by the `onDestroyed` attribute in JSX, which the
JSX target runs when the element is destroyed (on Pixi, the `'destroyed'`
event). See
[Releasing What a View Holds](../../../docs/building-with-mvt/presenting-the-world/views.md#releasing-what-a-view-holds).

If scopes are added one day, two constraints follow from section 1:

- **Attach each component's cleanups to its own root node's destruction,
  not to a stack of owners.** With children built first, a stack would file
  a child's cleanups under whichever view's source contains the child, not
  under the parent it ends up in. Replacing that parent would then leak the
  child's cleanups until the outer view died. Attached to the component's
  own node, they run whenever it is destroyed, and the JSX target's destroy of a
  subtree does the rest.
- **Lazy builds have no owner.** A `<List>` item function and a `<Match>`
  function child run during a refresh, when no component is being built. A
  cleanup registered there directly has nowhere to go, and should throw in
  development builds rather than be silently dropped.

### 4. When to revisit

- **Cleanup scopes:** a component that throws subtrees away during play, such
  as one that rebuilds its subtree when a key changes. Destruction would then
  be routine rather than once per session, and releasing resources by hand in
  each subtree would become error-prone.
- **Context:** a deep, widget-heavy UI, such as a settings or inventory
  screen, where most leaves need the same few services and the views in
  between are many. Even then, try the four alternatives first.

### 5. One refresh model, and the target does not choose it

Every JSX target drives bindings the same way: each element's bindings are its
`onRefresh` method, run by its renderer's scene passes, parent before child, with
`SKIP_DESCENDANTS` to skip a subtree. A JSX target supplies only its scene-graph
operations and its `refreshScene` ([jsx-target.ts](./jsx-target.ts)).

Ruled out, from 022 section 2: a renderer's own per-object hook (Pixi's
`onRender` runs for hidden containers too), and refresh closures that capture
their children's refreshes at construction (anything that changes the tree
afterwards is missed). What would reopen it: a renderer whose tree cannot be
walked at all.

Every JSX target is held to the same behaviour by one conformance suite
([conformance/](./conformance/conformance-suite.ts)), run on Pixi with
generated code and with the fallback. A new JSX target adds a fixture, not
tests: each renderer's `jsx/conformance.test.ts` is one.

### 6. Intrinsic elements are data

A JSX target's elements are a table (`element`, `defineElements`), and each
attribute says how it is written: `fixed`, `everyFrame`, `onChange`,
`onChangeNumber` or `event`. `JSX.IntrinsicElements` is derived from the same
table (`IntrinsicElementsOf`), so the types cannot disagree with what the
runtime does.

The helpers come from `attributesOf<E>()`, typed for one element type, and
each takes one of two writers:

- **A property name** (`container.everyFrame('x')`), for a plain assignment.
  Its value type is the property's type. Generated refresh methods assign
  it inline (`e.x=`), so each generated method has its own V8 feedback for
  the write.
- **An apply function** (`container.everyFrame((e, v: number) => {
  e.scale.set(v); })`), for anything else. Generated methods call it.

**Name a property wherever the write is a plain assignment.** An apply
function is one function for every element kind that has the attribute, so
the write inside it sees all their shapes. In a scene of many shapes V8
gives up on it: with `x`, `y` and `tint` as apply functions, the
falling-sand demo's sprites refreshed 10-43% slower than with the old
runtime's inline assignments (022 section 7.5). The first version of the
base had only apply functions, on the strength of a benchmark with three
element shapes, where the call measured free; the demo showed otherwise.

Property names come only from tables, and are checked to be identifiers
where the table is defined. A key a caller passes that the table does not
define throws, and so does a function given to an attribute that takes only
a fixed value. Both fail at construction, not silently.

### 7. Refresh methods are generated code

Each distinct sequence of bound attribute definitions gets a refresh factory
generated with `new Function` and cached; each element's method assigns its
properties inline and calls its apply functions directly, with no loop and
no dispatch. Measured in 022 section 7.5 against the alternatives:

- **The eval-free fallback is 6x to 16x slower on refresh**, on Pixi, by
  the `jsx-refresh` suite (022 section 7.5.1). It is not allocation. Its call
  sites see every attribute's functions, so V8 inlines none of them, and a
  property is written with a dynamic keyed store (`el[name] = value`), which
  V8 handles slowly when it reaches a setter. Doing that store inline rather
  than through a call was tried, and changed nothing. With an apply function
  written per attribute, a scratch benchmark measured 2.3x to 4.9x, but
  those are what make generated code slow on mixed scenes (section 6).
- **Per-attribute step closures** recover part of that, and only with a
  factory written by hand per attribute. Not used.
- **Apply calls** cost 1-3% on a scene of one element shape, and much more
  on a scene of many (section 6). Hence property names wherever they fit.

Factories are cached by shape (`refreshShapeKey` in
[refresh-source.ts](./refresh-source.ts)): `visible` or not, then each
binding's write kind and its property, or its attribute key for an apply
function. The key is stable between build and run time, which the
precompiler needs; ids assigned in the order a runtime met definitions were
not. The ids stay as a fast path: each runtime resolves a sequence of
definition ids to a factory once, and every later element with that
sequence costs one short key and one lookup. Building the shape key for
every element instead made building a JSX element 40% slower (0.59 us
against 0.42 us per container).

The fallback exists for pages whose Content Security Policy forbids
`new Function`, and the build-time precompiler
([scripts/vite-plugin-jsx-precompile.ts](../../../scripts/vite-plugin-jsx-precompile.ts))
exists so they rarely need it. It is opt-in (`MVT_JSX_PRECOMPILE=1`), since
only such pages need it. It registers, per module, the factories that
module's elements need (`registerRefreshFactories`, which a JSX target's
runtime module must export). The runtime looks those up first and probes
`new Function` only for a shape it must generate, once per page
(`canGenerateCode`); dev builds warn once if the probe fails, and name each
shape that falls back on a page that uses the precompiler. Each registration
carries the `REFRESH_SOURCE_VERSION` it was made with, and a runtime ignores
any other, so a precompiler and a runtime from different releases never mix
code; `refresh-source.test.ts` pins what each version produces. An application
can define `__MVT_JSX_EVAL__` as `false` to skip the probe. A full JSX
compiler was considered and not built (022 section 7.6).

### 8. Events are wired before other attributes

A JSX target's `listen` may set a default that makes a listener work, and an
attribute applied afterwards can override it. Pixi uses this for
`eventMode`: `listen` makes the element `'static'`, and an `eventMode`
attribute still wins. This replaced a JSX target hook that ran before the first
listener.

### 9. No text children

Every child is a node, on every JSX target, and text is an attribute of an
element. Only HTML and SVG have text nodes; an `appendText` operation can be
added when a JSX target needs one (022 section 5.4).

### 11. The precompiler reads data, never a target

The build-time precompiler needs only what generated code depends on: for
each element, its attributes' write kinds and properties. A JSX target's
precompile manifest is that, as JSON, saved beside the JSX target and reached as
`<importSource>/precompile`, so the
precompiler finds it from a module's `@jsxImportSource` with no
configuration, and never loads a renderer in Node, where some install
themselves on load. In this repo the manifests are
saved by `npm run generate-precompile-manifests`, and a test fails when one
disagrees with its table; a published renderer package would make its own
when built (022 section 12.1). The manifest has its own format number, as
the refresh source has its version, so a precompiler reads only manifests it
understands. The code that makes and reads manifests is the precompiler's
(`scripts/jsx-precompile-manifest.ts`): the runtime knows nothing of them.
Its one entry point for pre-made code is `registerRefreshFactories`, one
registry for every JSX target, which each renderer's `jsx-runtime` re-exports for
the code the precompiler adds to modules.

## Accepted limitations

- **`<List container>` is trusted to be empty.** The JSX target has no
  operation to count children, so the base cannot check it.
- **No warning for attributes that write the same state.** On Pixi,
  `width` writes `scale.x`, so binding `scale` every frame and `width` on
  change loses the width from the second frame (022 section 13). Tables
  cannot declare such pairs yet.
