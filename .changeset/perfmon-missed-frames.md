---
'@mvtjs/utils': minor
'@mvtjs/html': minor
---

The Perfmon has a new row, Missed: the share of the frames your display could have shown that went missing even though the main thread had time to spare. It shows when something other than your code is holding frames up, such as the browser drawing what you asked for, which CPU time can't see. It works for every renderer, including a 2D canvas, which has no GPU timer. `PerfmonView`'s explanation now says that its CPU row leaves that drawing out.

Breaking: `PerformanceSample` has a new `missedShare` value, from 0 to 1, and `METRIC_KINDS` has a new kind, so anything that builds a sample by hand for `createPerformanceHistory` needs to add it. `createPerformanceMeter` measures it for you.

`estimateFrameBudgetMs`, new in `@mvtjs/utils`, says how long a frame has on this display, from the frame rates in a history.
