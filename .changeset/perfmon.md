---
'@mvtjs/utils': minor
'@mvtjs/pixi': minor
'@mvtjs/html': minor
---

Performance metrics work with any renderer. `@mvtjs/utils` has `createPerformanceMeter`, which measures a frame loop, and `createPerformanceHistory`, which holds metrics measured somewhere else, with the `PerformanceMetrics` type both share. `@mvtjs/pixi`'s `createPerformanceMetrics` is built on them, as before, and its GPU timer is `createGpuTimer`. `@mvtjs/html` has `PerfmonView`, a panel that shows the metrics, compact in a small box and larger in a roomy one.
