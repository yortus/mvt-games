# @mvtjs/pixi

## 0.10.0

### Minor Changes

- 162263a: `keepReleasedTextTextures`, new in `@mvtjs/pixi`, keeps a renderer's text textures for a while after their texts have gone. A view that is destroyed and built again then finds its texts' textures still there, rather than drawing and uploading each one again. Call it once, after the renderer starts, with a budget in pixels. When the kept textures would go over it, those released longest ago go first. Its `releaseAll` releases every kept texture, such as when a game ends, and destroying the renderer releases them too. Only texts that share a style can find their textures again, which JSX texts passed the same `style` object do.
- 9204f49: Needs pixi.js 8.23 or later, the version it's tested with. It used to accept 8.16.
- 162263a: In JSX, texts passed the same `style` object now share one Pixi `TextStyle`. So texts with the same string and style share one texture, drawn and kept on the GPU once. Before, every text made a style of its own, and so a texture of its own. `style` now replaces a text's style rather than merging into it. That differs only when a `style` getter switches between objects. Because the style is shared, changing it in code (`text.style.fill = ...`) changes every text passed the same object. For a style of its own, pass a text an inline object or a `TextStyle` of its own.
- 2ee9b17: Every JSX element now accepts an `owns` attribute. It lists the resources that your view made for the element, such as textures, geometries and materials. Each one is freed when the element is destroyed, so you don't need an `onDestroyed` to free them. Each renderer frees a resource its own way. `@mvtjs/pixi` destroys it, and destroys a texture's source with the texture. `@mvtjs/three` disposes it. `@mvtjs/html` aborts anything with an `abort()` method, such as an `AbortController`. It closes anything with a `close()` method, and destroys anything with a `destroy()` method. Each package exports the type that its `owns` attribute accepts as `OwnedResource`.
  
  An element table can now define creation attributes, with `creation()`, or with `creation({ required: true })` for one that the element can't be made without. They're for options that a renderer reads only in its constructor, such as the size of a batch. The runtime passes their values to the element's `create`.
  
  Breaking: `JsxTarget` has a new `release` function, which frees a resource that an `owns` attribute lists. A JSX target of your own needs to add it.

### Patch Changes

- Updated dependencies [2ee9b17]
  - @mvtjs/utils@0.10.0

## 0.9.0

### Patch Changes

- Updated dependencies [446eb59]
- Updated dependencies [8830b12]
  - @mvtjs/utils@0.9.0

## 0.8.0

### Patch Changes

- Updated dependencies [7ec36de]
- Updated dependencies [80cb13b]
- Updated dependencies [7ec36de]
  - @mvtjs/utils@0.8.0

## 0.7.0

### Patch Changes

- @mvtjs/utils@0.7.0

## 0.6.1

No changes in this release.

## 0.6.0

### Minor Changes

- c9e7256: `@mvtjs/pixi`'s `createPerformanceMetrics` is gone, with its `PixiPerformanceMetrics` and `PerformanceMetricsOptions` types. It only wired `createPerformanceMeter`, from `@mvtjs/utils`, to Pixi's ticker and renderer, and the four lines it hid are now in `@mvtjs/pixi`'s README. `createGpuTimer` stays.
  
  `@mvtjs/html`'s `PerfmonView` takes a function for `unmeasured` as well as a list, so the metrics it shows as n/a can change, such as in a page that runs one game and then another. Given a `title`, it has a title bar, with its (i) at the right end, as a window has. An `infoNote` adds a paragraph to the top of its explanation, such as how to move or close the panel in your page. The faint line that marks a frame's budget in its CPU and GPU graphs now follows the display, from the highest frame rate it has seen (8.3 ms on a 120 Hz screen), in place of a fixed 16.7 ms, and `frameBudgetMs` sets it.

### Patch Changes

- @mvtjs/utils@0.6.0

## 0.5.0

### Minor Changes

- 0a722e0: A program must now load one copy of each @mvtjs package. A second copy throws an error as it loads, which names both copies and says how to keep one. Before, copies of the same version shared their state, and copies of different versions logged a warning. If you upgrade and see the error, run `npm ls @mvtjs/utils` to find the second copy, then `npm dedupe` or npm `overrides`, and in Vite, list the @mvtjs packages in `resolve.dedupe`. A test that resets its modules, with `vi.resetModules()` or `jest.resetModules()`, loads the packages again too, so keep it in a file of its own. `PROTOCOL`, `shareAcrossCopies` and `registerCopy` are no longer exported from `@mvtjs/utils`. See "Keep one copy" in its README.

### Patch Changes

- Updated dependencies [9b362b5]
- Updated dependencies [0a722e0]
  - @mvtjs/utils@0.5.0

## 0.4.0

### Minor Changes

- d8b0431: Performance metrics work with any renderer. `@mvtjs/utils` has `createPerformanceMeter`, which measures a frame loop, and `createPerformanceHistory`, which holds metrics measured somewhere else, with the `PerformanceMetrics` type both share. `@mvtjs/pixi`'s `createPerformanceMetrics` is built on them, as before, and its GPU timer is `createGpuTimer`. `@mvtjs/html` has `PerfmonView`, a panel that shows the metrics, compact in a small box and larger in a roomy one.

### Patch Changes

- Updated dependencies [d8b0431]
  - @mvtjs/utils@0.4.0

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
