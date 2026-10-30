# @mvtjs/utils

Optional helpers for [MVT (Model-View-Ticker)](https://yortus.com/mvt-games/docs/),
a way of structuring games and interactive scenes so that state, presentation
and time stay apart. MVT is a pattern and needs no library. These helpers
make common parts of it shorter, and none of them needs a renderer:

- **Change detection:** `watch` polls values and reports which changed since
  the last poll, and whether each number went up or down; `memoiseLast`
  recomputes only when its argument changes.
- **Time-driven state:** tweens (`createBooleanTween`, `createEdgeTween`),
  sequences (`createSequence`, `createSequenceTracker`) and a metronome
  (`createMetronome`), all advanced by an `update(deltaMs)` call rather than
  a clock.
- **Collections:** `createSlotList` and `createOrderedSlotList`, which keep a
  stable slot per item, for views that pool what they draw.
- **The view tick API:** `updateView` and `refreshView`, which call the
  update and refresh methods that `setUpdate` and `setRefresh` give a view's
  nodes, for every installed renderer. Use them through a renderer package
  (`@mvtjs/pixi`, `@mvtjs/three`, `@mvtjs/html`), which registers its nodes
  and re-exports them.
- **Testing:** `advanceTime` moves models and views forward in time, one
  frame-sized step at a time, as a game loop would. A test can then check
  what happens after a few seconds without waiting for them.
- **Measuring performance:** `createPerformanceMeter` measures frames per
  second, the time each frame takes, and how much work the views do, from
  any frame loop that tells it when each frame starts and ends.
  `createPerformanceHistory` holds metrics that were measured somewhere
  else, such as in an iframe. `@mvtjs/html`'s `PerfmonView` shows either.
- **For renderer packages:** `registerRenderer`, which teaches the view tick
  API a new kind of tree, and, at `@mvtjs/utils/jsx`, the base that each
  renderer's JSX runtime is built on.

```sh
npm install @mvtjs/utils
```

## Keep one copy

A program must load one copy of `@mvtjs/utils`, and one of each renderer
package. The view tick API keeps its state in the package, such as the
counts that `tickCounter` reports. Two copies would each keep their own, and views
set up through one would be missed by the other. So a second copy throws an
error as it loads, saying what was loaded twice and from where.

Two copies get into a program in two ways, and each has its own fix:

- **Two versions.** The install nested a second copy, because two packages
  asked for versions that don't overlap. Run `npm ls @mvtjs/utils` to find
  it. Then `npm dedupe`, or add npm `overrides` so that every package gets
  the same version.
- **One version, twice.** The bundler reached the package by two paths,
  such as a linked package with its own `node_modules`, or a dependency
  that was pre-bundled and also imported directly. In Vite, list the
  packages in `resolve.dedupe`:

```ts
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
    resolve: {
        dedupe: [
            '@mvtjs/utils', '@mvtjs/pixi', '@mvtjs/three', '@mvtjs/html',
        ],
    },
});
```

A few other things load a package twice:

- **A test that resets its modules,** such as with `vi.resetModules()` or
  `jest.resetModules()`, then loads the package again in the same program.
  Keep such a test in a file of its own, since Vitest and Jest give each
  file a fresh start.
- **Two apps on one page that each bundle the package,** such as two
  widgets built apart. Share the packages between them as one copy, with an
  import map or Module Federation's `shared: { singleton: true }`, or give
  each app an `iframe` of its own.

Vite's dev server and its build find packages differently, so a duplicate
can appear in a build alone. After you add or upgrade an `@mvtjs` package,
run the production build once, with `vite build` and `vite preview`.

## Learn more

- [The guide and reference](https://yortus.com/mvt-games/docs/)

## License

MIT
