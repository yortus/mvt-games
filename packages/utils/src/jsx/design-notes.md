# Design notes

> The settled decisions behind the renderer-agnostic JSX base, and the
> evidence for each: for someone asking why it is built this way, or about to
> change it. How it works, built up from the basics, is in
> [the README](./README.md), and in detail in the header comments of
> [create-jsx.ts](./create-jsx.ts), [refresh-builder.ts](./refresh-builder.ts),
> [list.ts](./list.ts) and [switch.ts](./switch.ts). The design and its measurements are in
> [022](../../../../notes/proposals/022-renderer-agnostic-jsx.md); the design of
> `<List>` and `<Switch>` is in [004](../../../../notes/archive/004-list-proposal.md).
> Pixi facts the Pixi JSX target relies on are in
> [its design notes](../../../pixi/src/jsx/design-notes.md).

**Written:** 2026-09-28, when the base was split out of `packages/pixi/src/jsx/`
(022 phase 1). Sections 1-4 were first written for the Pixi runtime, from a
comparison with other runtimes
([task 021](../../../../notes/archive/021-jsx-and-teardown-quick-wins.md)), and
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
refresh method, called by `refreshView`, parent before child, with
`SKIP_DESCENDANTS` to skip a subtree. A JSX target supplies only its
scene-graph operations ([jsx-target.ts](./jsx-target.ts)); its renderer
registers its nodes with `registerRenderer`.

Ruled out, from 022 section 2: a renderer's own per-object hook (Pixi's
`onRender` runs for hidden containers too), and refresh closures that capture
their children's refreshes at construction (anything that changes the tree
afterwards is missed). What would reopen it: a renderer whose tree cannot be
walked at all.

Every JSX target is held to the same behaviour by one conformance suite
([conformance/](./conformance/conformance-suite.ts)), run on Pixi,
three.js and HTML, each with the shared copy of the refresh code and with every
shape's own copy (section 7). A new JSX
target adds a fixture, not tests: each renderer's `jsx/conformance.test.ts`
is one.

### 6. Intrinsic elements are data

A JSX target's elements are a table (`element`, `defineElements`), and each
attribute says how it is written: `fixed`, `everyFrame`, `onChange`,
`onChangeNumber` or `event`. `JSX.IntrinsicElements` is derived from the same
table (`IntrinsicElementsOf`), so the types cannot disagree with what the
runtime does.

The helpers come from `attributesOf<E>()`, typed for one element type, and
each takes one of two writers:

- **A property name** (`container.everyFrame('x')`), for a plain assignment.
  Its value type is the property's type. Refresh methods assign it by
  name in a shape's own copy of the refresh code (section 7), so each shape
  has its own V8 feedback for the write.
- **An apply function** (`container.everyFrame((e, v: number) => {
  e.scale.set(v); })`), for anything else. Refresh methods call it.

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

**Attributes whose names are not known in advance** (HTML's `data-*` and
`aria-*`) are an element's patterns: the third argument to `element`, a
function per prefix that makes the definition for a full name. The runtime
keeps what a pattern made, per element kind. A pattern makes no events, and no
pattern may match an attribute every element has. TypeScript never checks a hyphenated
JSX attribute against an index signature, so in JSX a pattern attribute's
value is unchecked; the pattern still gives it a contextual type.

### 7. Refresh methods need no generated code

Each element's refresh method is made from closures, with no `new Function`,
so the runtime works under any Content Security Policy, and there is one way
it runs, everywhere. How it is fast is in
[refresh-builder.ts](./refresh-builder.ts): the refresh code for each number
of bindings, 1 to 6, is written out many times, and a shape with many
elements on one class of element takes a copy of its own, whose call sites
and property stores see only that shape and class, so V8 inlines them. The
copies are `refresh-copies.ts`, generated by this package's
`scripts/generate-refresh-copies.ts` on install and before dev, build, test and
bench, and not checked in: they are repetitive, and the generator's template
is the readable form. A published package would ship them.

**Decided in task 025, over generated code** (do not reopen without new
information). The runtime used to generate each shape's refresh method with
`new Function`, fell back to closures on pages whose policy forbids it, and
had an opt-in build-time precompiler (a Vite plugin, a manifest per JSX
target, a registration hook in the runtime) to give such pages generated
code anyway. The closures were made fast enough to replace all of it:
measured on Pixi by the `jsx-refresh` and `falling-sand-scaling` suites,
from 1,000 to 200,000 elements, 1.1x to 1.3x slower than generated code
where each shape is on one class of element, and faster (0.6x to 0.75x)
where one shape is on many, since generated code kept one method per shape
across classes. In the repo's games and demos, as they ship, no difference.
The last commit with generated code and the precompiler is tagged
`jsx-precompiler-last`; 022 sections 7.4 to 7.6 and 12.1 describe them.

What was measured on the way, in task 025's progress log:

- **Three causes of the first closures' gap** (6x to 16x, then 1.4x to 2.6x):
  memory per element (closures sharing one V8 context, a typed array per
  element), writes V8 cannot inline (a setter called through `.call`), and
  one set of call sites shared by every shape.
- **A keyed store is fast only while it sees one name and few classes.** One
  `el[name] = value` shared by every property of every element was the first
  version's main cost. Seeing seven classes, a store by one name was 7x
  slower than generated code's; V8 handles a megamorphic keyed store to an
  accessor in its runtime. So only a shape's own copy assigns by name, and
  a shape takes one only at its sixteenth element (`ownCopyAt`); the shared
  copy calls setters, which is safe on any number of classes.
- **Writes defined as functions in the element table**
  (`(e, v) => { e.x = v; }`) were as fast as generated code in each
  benchmark scene alone, and 30-50% slower in the falling-sand demo, where
  one such function is shared by every element that binds `x`, of every
  class. Hence property names.
- **Apply calls** cost 1-3% on a scene of one element shape, and much more
  on a scene of many (section 6). Hence property names wherever they fit.

### 8. Events are wired before other attributes

A JSX target's `listen` may set a default that makes a listener work, and an
attribute applied afterwards can override it. Pixi uses this for
`eventMode`: `listen` makes the element `'static'`, and an `eventMode`
attribute still wins. This replaced a JSX target hook that ran before the first
listener.

### 9. No text children

Every child is a node, on every JSX target, and text is an attribute of an
element. Only HTML and SVG have text nodes; an `appendText` operation can be
added when a JSX target needs one (022 section 5.4). HTML's `text` attribute
writes a text node the element owns.

### 10. A target's `visible` must survive writes behind its back

`<List>` and `<Switch>` show and hide nodes with `visible.apply` directly.
An item view with a `visible` binding of its own is such a node, so a
`visible` written only on change would not see the list's writes: hidden by
its binding, emptied and hidden by the list, then shown by the list when its
item returns, it would stay shown, since its binding's value never changed.
So every JSX target's `visible` is written every frame: a plain assignment on
Pixi and three.js, and on HTML, where a write costs more, compared with the
element's `hidden` attribute first. The conformance suite has the case.

## Accepted limitations

- **`<List container>` is trusted to be empty.** The JSX target has no
  operation to count children, so the base cannot check it.
- **No warning for attributes that write the same state.** On Pixi,
  `width` writes `scale.x`, so binding `scale` every frame and `width` on
  change loses the width from the second frame (022 section 13). Tables
  cannot declare such pairs yet.
