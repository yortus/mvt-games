# Design notes

> Decisions about the JSX runtime that are not visible in its code: features
> it deliberately lacks, and why. How the runtime works is in the header
> comments of [jsx-runtime.ts](./jsx-runtime.ts), [list.ts](./list.ts) and
> [switch.ts](./switch.ts); the design of `<List>` and `<Switch>` is in
> [004](../../notes/archive/004-list-proposal.md).

**Written:** 2026-09-28, against Pixi 8.16.0, from a comparison with other runtimes
([task 021](../../notes/archive/021-jsx-and-teardown-quick-wins.md)).

## Settled decisions

Do not reopen these without new information. Section 4 says what would count.

### 1. Children are built before their parent

JSX compiles `<Parent><Child /></Parent>` to a call whose argument is the
already-built child: `jsx(Parent, { children: jsx(Child, {}) })`. So when a
component's body runs, its children already exist. `<Switch>` relies on this,
reading its `<Match>` children at construction.

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
- **A lookup that climbs `parent`** inside a getter. Construction is inert,
  so by a getter's first call the tree exists. But the lookup could never be
  used while building (to decide structure), and its answer changes if the
  view is moved to another parent.

Either way it would hide dependencies. Apart from constants it imports, a
view should depend only on what its bindings declare: they are the list of
what it needs, and what a test supplies. A value looked up at run time is a
dependency they do not show, and a missing one fails only when the view
runs. The needs context meets are met instead as
[Shared Values in Deeply Nested Views](../../docs/building-with-mvt/presenting-the-world/view-composition.md#shared-values-in-deeply-nested-views)
describes: importing constants, for views that belong to one game; and, for
views meant for reuse, handing over a built child, grouping shared bindings,
or making related views in one function.

### 3. No cleanup scopes, for now

In Solid, `onCleanup` registers on the component being built, and runs when
that part of the tree is thrown away. There is little for it to do here:

- Few views hold anything to release. Views poll rather than subscribe, and
  rule 1 bans timers, which removes most of what Solid cleans up.
- Nothing is thrown away during play. `<List>` keeps every item view it
  builds, `<Switch>` keeps every branch, and the only thing either destroys is
  `<List>`'s own empty placeholders. A view is destroyed about once, when its
  session ends.

What there is (`window` listeners, a shared `GraphicsContext`, a texture a
view made, a GSAP timeline) is released on Pixi's `'destroyed'` event, or the
`onDestroyed` attribute in JSX. See
[Releasing What a View Holds](../../docs/building-with-mvt/presenting-the-world/views.md#releasing-what-a-view-holds).

If scopes are added one day, two constraints follow from section 1:

- **Attach each component's cleanups to its own root container's
  `'destroyed'` event, not to a stack of owners.** With children built first,
  a stack would file a child's cleanups under whichever view's source
  contains the child, not under the parent it ends up in. Replacing that
  parent would then leak the child's cleanups until the outer view died.
  Attached to the component's own container, they run whenever it is
  destroyed, and Pixi's `destroy({ children: true })` cascade does the rest.
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

## Related findings

Recorded so they are not re-derived:

- Pixi's `Container.destroy` emits `'destroyed'`, passing the container,
  after detaching the children and before destroying them. Without
  `{ children: true }` the children are never destroyed, so their listeners
  never run; the pixi-mvt mixin warns about that in development builds (see
  [its design notes](../pixi-mvt/design-notes.md)).
- Pixi 8.16 emits `globalpointermove`, `globalmousemove` and
  `globaltouchmove`, and no other global pointer events. There is no
  `globalpointerdown` or `globalpointerup` to expose as attributes.
- Pixi's `onRender` runs for every registered container whether or not it is
  visible (`RenderGroup.runOnRender`). A runtime that drives bindings from
  `onRender` keeps polling hidden branches;
  this runtime uses the pixi-mvt refresh pass and `SKIP_DESCENDANTS` instead.
