---
'@mvtjs/pixi': minor
'@mvtjs/html': minor
---

`@mvtjs/pixi`'s `createPerformanceMetrics` is gone, with its `PixiPerformanceMetrics` and `PerformanceMetricsOptions` types. It only wired `createPerformanceMeter`, from `@mvtjs/utils`, to Pixi's ticker and renderer, and the four lines it hid are now in `@mvtjs/pixi`'s README. `createGpuTimer` stays.

`@mvtjs/html`'s `PerfmonView` takes a function for `unmeasured` as well as a list, so the metrics it shows as n/a can change, such as in a page that runs one game and then another. Given a `title`, it has a title bar, with its (i) at the right end, as a window has. An `infoNote` adds a paragraph to the top of its explanation, such as how to move or close the panel in your page. The faint line that marks a frame's budget in its CPU and GPU graphs now follows the display, from the highest frame rate it has seen (8.3 ms on a 120 Hz screen), in place of a fixed 16.7 ms, and `frameBudgetMs` sets it.
