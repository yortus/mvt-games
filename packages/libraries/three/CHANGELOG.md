# @mvtjs/three

## 0.5.0

### Minor Changes

- 0a722e0: A program must now load one copy of each @mvtjs package. A second copy throws an error as it loads, which names both copies and says how to keep one. Before, copies of the same version shared their state, and copies of different versions logged a warning. If you upgrade and see the error, run `npm ls @mvtjs/utils` to find the second copy, then `npm dedupe` or npm `overrides`, and in Vite, list the @mvtjs packages in `resolve.dedupe`. A test that resets its modules, with `vi.resetModules()` or `jest.resetModules()`, loads the packages again too, so keep it in a file of its own. `PROTOCOL`, `shareAcrossCopies` and `registerCopy` are no longer exported from `@mvtjs/utils`. See "Keep one copy" in its README.

### Patch Changes

- Updated dependencies [9b362b5]
- Updated dependencies [0a722e0]
  - @mvtjs/utils@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [d8b0431]
  - @mvtjs/utils@0.4.0

## 0.3.0

### Minor Changes

- d991d62: There is a new `advanceTime(ms, ...items)`, beside the tick API, and the renderer packages re-export it. It advances models and views by `ms` milliseconds, as a game loop does, in steps of 16 ms, for a test or any other run without a loop. An item is a view of an installed renderer, or anything with an `update` method, such as a model. Each step updates every model, then every view, each in the order given, then awaits a microtask, so that a model with an internal `await` moves on. A view is told apart by its renderer, so a view with an `update` method of its own is still updated as a view. It does not refresh, so refresh the views once afterwards. A test can use it to show a view with presentation state, such as a banner counting up, at a known moment: `await advanceTime(300, banner)`.

### Patch Changes

- Updated dependencies [d991d62]
- Updated dependencies [4023035]
- Updated dependencies [12cd9ed]
- Updated dependencies [4023035]
  - @mvtjs/utils@0.3.0

## 0.2.0

### Minor Changes

- 0b4770d: Pixi JSX: `tint` takes any colour Pixi does, CSS strings included, not only numbers; containers take a `mask`. HTML JSX: `<td>` and `<th>` take `colSpan` and `rowSpan`, there is an `<output>` element, `<input>` and `<textarea>` take `autocomplete`, and every element takes `spellcheck`. three.js: `createPointerPicker` takes a `dragThreshold`, past which a press is a drag and its click is not dispatched.

### Patch Changes

- @mvtjs/utils@0.2.0
