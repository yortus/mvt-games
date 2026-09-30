# Design notes

> Pixi facts Pixi's JSX target relies on, and decisions specific to it. The
> JSX runtime itself (children built first, no context providers, no cleanup
> scopes, generated refresh methods, element tables) is the renderer-agnostic
> base, whose settled decisions are in
> [its design notes](../../mvt-utils/jsx/design-notes.md).

**Written:** 2026-09-28, against Pixi 8.16.0. The findings were first
recorded with the runtime's settled decisions
([task 021](../../../notes/archive/021-jsx-and-teardown-quick-wins.md)), which
moved to the base when it was split out
([022](../../../notes/proposals/022-renderer-agnostic-jsx.md) phase 1).

## Pixi's JSX target

[pixi-target.ts](./pixi-target.ts) is Pixi's scene graph as the base needs
it, and [pixi-elements.ts](./pixi-elements.ts) is Pixi's element table.

- **`visible` is written every frame.** Pixi's setter returns at once when
  the value is unchanged.
- **`listen` makes the element `'static'`**, unconditionally, before adding
  the listener. A container under Pixi's default event mode (`'passive'`) is
  not hit-tested, so a handler on it would never fire. The base wires events
  before other attributes, so an `eventMode` attribute still wins. The
  default is not tested for, because the `eventMode` getter falls back to
  `EventSystem.defaultEventMode`, which an application can change.
- **`detachTail` is one `removeChildren(begin, end)`.** Removing children one
  at a time scans the child list for each.
- **`width` and `height` are `onChangeNumber`**: often fractional, and Pixi
  applies them through the scale.
- **`label` and `style` are `onChange`**, so they accept getters, as the
  runtime always allowed, although they used to be typed as fixed values.
- **`jsx-runtime.ts` re-exports the base's `registerRefreshFactories`**, which
  the code the build-time precompiler adds to each `.tsx` module imports from
  `#pixi-mvt/jsx/jsx-runtime`. The precompiler learns this JSX target's
  elements from its manifest, `precompile-manifest.json`, reached as
  `#pixi-mvt/jsx/precompile`.

## Related findings

Recorded so they are not re-derived:

- Pixi's `Container.destroy` emits `'destroyed'`, passing the container,
  after detaching the children and before destroying them. Without
  `{ children: true }` the children are never destroyed, so their listeners
  never run; the pixi-mvt mixin warns about that in development builds (see
  [its design notes](../design-notes.md)).
- Pixi 8.16 emits `globalpointermove`, `globalmousemove` and
  `globaltouchmove`, and no other global pointer events. There is no
  `globalpointerdown` or `globalpointerup` to expose as attributes.
- Pixi's `onRender` runs for every registered container whether or not it is
  visible (`RenderGroup.runOnRender`). A runtime that drives bindings from
  `onRender` keeps polling hidden branches;
  this runtime uses pixi-mvt's `refreshScene` and `SKIP_DESCENDANTS` instead.
- Pixi's `width` setter writes `scale.x` (`measureMixin._setWidth`), and
  `height` writes `scale.y`. Binding `scale` and `width` on one element
  makes them fight: the every-frame `scale` wins from the second frame.
