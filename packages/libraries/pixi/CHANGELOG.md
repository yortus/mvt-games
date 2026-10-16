# @mvtjs/pixi

## 0.3.0

### Minor Changes

- d991d62: There is a new `advanceTime(ms, ...items)`, beside the tick API, and the renderer packages re-export it. It advances models and views by `ms` milliseconds, as a game loop does, in steps of 16 ms, for a test or any other run without a loop. An item is a view of an installed renderer, or anything with an `update` method, such as a model. Each step updates every model, then every view, each in the order given, then awaits a microtask, so that a model with an internal `await` moves on. A view is told apart by its renderer, so a view with an `update` method of its own is still updated as a view. It does not refresh, so refresh the views once afterwards. A test can use it to show a view with presentation state, such as a banner counting up, at a known moment: `await advanceTime(300, banner)`.

### Patch Changes

- e6deb21: `createTextureRegistry` now samples its spritesheet nearest-neighbour, as it always meant to. It passed that option in a form that Pixi 8's spritesheet loader ignores. So a sheet took whatever `TextureSource.defaultOptions.scaleMode` was when it loaded, and could look smooth or pixelated depending on what had run before.
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
