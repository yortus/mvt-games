# @mvtjs/html

## 0.4.0

### Minor Changes

- d0ccccf: The HTML JSX has `<optgroup>`, to group a `<select>`'s options under a label. Its `label` and `disabled` can follow the model.
- d8b0431: Performance metrics work with any renderer. `@mvtjs/utils` has `createPerformanceMeter`, which measures a frame loop, and `createPerformanceHistory`, which holds metrics measured somewhere else, with the `PerformanceMetrics` type both share. `@mvtjs/pixi`'s `createPerformanceMetrics` is built on them, as before, and its GPU timer is `createGpuTimer`. `@mvtjs/html` has `PerfmonView`, a panel that shows the metrics, compact in a small box and larger in a roomy one.

### Patch Changes

- Updated dependencies [d8b0431]
  - @mvtjs/utils@0.4.0

## 0.3.0

### Minor Changes

- d991d62: There is a new `advanceTime(ms, ...items)`, beside the tick API, and the renderer packages re-export it. It advances models and views by `ms` milliseconds, as a game loop does, in steps of 16 ms, for a test or any other run without a loop. An item is a view of an installed renderer, or anything with an `update` method, such as a model. Each step updates every model, then every view, each in the order given, then awaits a microtask, so that a model with an internal `await` moves on. A view is told apart by its renderer, so a view with an `update` method of its own is still updated as a view. It does not refresh, so refresh the views once afterwards. A test can use it to show a view with presentation state, such as a banner counting up, at a known moment: `await advanceTime(300, banner)`.

### Patch Changes

- 9d87b9d: `value` and `valueAsNumber` are now skipped while focused only for text-like fields (text, number, date, `<textarea>`), so a refresh never overwrites what the user is typing. Sliders, colour pickers and `<select>` are now written even while focused, so a change the model makes elsewhere (such as a mute button setting a volume slider to 0) shows at once, not when the field loses focus.
  
  Such fields should report the user's changes through `onInput`. `onChange` fires only when a slider is let go or a colour picker closes, and until then each refresh puts the model's value back.
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
