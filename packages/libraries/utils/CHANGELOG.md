# @mvtjs/utils

## 0.6.0

No changes in this release.

## 0.5.0

### Minor Changes

- 0a722e0: A program must now load one copy of each @mvtjs package. A second copy throws an error as it loads, which names both copies and says how to keep one. Before, copies of the same version shared their state, and copies of different versions logged a warning. If you upgrade and see the error, run `npm ls @mvtjs/utils` to find the second copy, then `npm dedupe` or npm `overrides`, and in Vite, list the @mvtjs packages in `resolve.dedupe`. A test that resets its modules, with `vi.resetModules()` or `jest.resetModules()`, loads the packages again too, so keep it in a file of its own. `PROTOCOL`, `shareAcrossCopies` and `registerCopy` are no longer exported from `@mvtjs/utils`. See "Keep one copy" in its README.

### Patch Changes

- 9b362b5: A `<List>` item view's update step now sees its slot's item as it is now. Before, it saw the item its slot showed at the last refresh, so in the frame after the model removed or replaced an item, the update step still got the old one. A slot emptied since the last refresh now skips its update steps at once.

## 0.4.0

### Minor Changes

- d8b0431: Performance metrics work with any renderer. `@mvtjs/utils` has `createPerformanceMeter`, which measures a frame loop, and `createPerformanceHistory`, which holds metrics measured somewhere else, with the `PerformanceMetrics` type both share. `@mvtjs/pixi`'s `createPerformanceMetrics` is built on them, as before, and its GPU timer is `createGpuTimer`. `@mvtjs/html` has `PerfmonView`, a panel that shows the metrics, compact in a small box and larger in a roomy one.

## 0.3.0

### Minor Changes

- d991d62: There is a new `advanceTime(ms, ...items)`, beside the tick API, and the renderer packages re-export it. It advances models and views by `ms` milliseconds, as a game loop does, in steps of 16 ms, for a test or any other run without a loop. An item is a view of an installed renderer, or anything with an `update` method, such as a model. Each step updates every model, then every view, each in the order given, then awaits a microtask, so that a model with an internal `await` moves on. A view is told apart by its renderer, so a view with an `update` method of its own is still updated as a view. It does not refresh, so refresh the views once afterwards. A test can use it to show a view with presentation state, such as a banner counting up, at a known moment: `await advanceTime(300, banner)`.
- 4023035: There is a new `createMetronome`, which returns a `Metronome`. A metronome counts beats at a tempo you can change, and does nothing itself. Set its `periodMs`, call its `update(deltaMs)` in a view's update step, and act each time its `count` rises. It suits anything that repeats while something lasts, such as a heartbeat that quickens, an alarm while fuel is low, or a blinking light. Its first beat comes as soon as it starts, not a period later.
- 4023035: A number watched with `watch` now has `increased` and `decreased`. `increased` is true when the number changed on this poll to a greater number than `previous`, and `decreased` is true when it changed to a lesser one. Both are false when nothing changed, and on the first poll, which has no previous value. So a view can write `if (w.shots.increased)` instead of `if (w.shots.changed && w.shots.value > (w.shots.previous ?? 0))`. Only numbers have them: reading `increased` on a watched string or boolean is a type error. Nothing else about `watch` has changed.

### Patch Changes

- 12cd9ed: `<List>`: an empty slot now skips its item view's update steps in `updateView`, as it already skipped its refresh in `refreshView`, so no update step sees an absent item. An update step sees the item its slot showed at its last refresh. Only a slot whose item view has an update step is gated, so a list without any costs no more than before.

## 0.2.0

No changes in this release.
