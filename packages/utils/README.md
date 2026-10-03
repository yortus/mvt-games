# @mvtjs/utils

Optional helpers for [MVT (Model-View-Ticker)](https://yortus.com/mvt-games/docs/),
a way of structuring games and interactive scenes so that state, presentation
and time stay apart. MVT is a pattern and needs no library. These helpers
make common parts of it shorter, and none of them needs a renderer:

- **Change detection:** `watch` polls values and reports which changed since
  the last poll; `memoiseLast` recomputes only when its argument changes.
- **Time-driven state:** tweens (`createBooleanTween`, `createEdgeTween`) and
  sequences (`createSequence`, `createSequenceReaction`), all advanced by an
  `update(deltaMs)` call rather than a clock.
- **Collections:** `createSlotList` and `createOrderedSlotList`, which keep a
  stable slot per item, for views that pool what they draw.
- **The tick API:** `updateView` and `refreshView`, which call the update and
  refresh methods that `setUpdate` and `setRefresh` give a view's nodes, for
  every installed renderer. Use them through a renderer package
  (`@mvtjs/pixi`, `@mvtjs/three`, `@mvtjs/html`), which registers its nodes
  and re-exports them.
- **For renderer packages:** `registerRenderer`, which teaches the tick API a
  new kind of tree, and, at `@mvtjs/utils/jsx`, the base that each renderer's
  JSX runtime is built on.

```sh
npm install @mvtjs/utils
```

## Learn more

- [The guide and reference](https://yortus.com/mvt-games/docs/)

## License

MIT
