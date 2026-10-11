---
'@mvtjs/utils': minor
'@mvtjs/pixi': minor
'@mvtjs/three': minor
'@mvtjs/html': minor
---

There is a new `advanceTime(ms, ...items)`, beside the tick API, and the renderer packages re-export it. It advances models and views by `ms` milliseconds, as a game loop does, in steps of 16 ms, for a test or any other run without a loop. An item is a view of an installed renderer, or anything with an `update` method, such as a model. Each step updates every model, then every view, each in the order given, then awaits a microtask, so that a model with an internal `await` moves on. A view is told apart by its renderer, so a view with an `update` method of its own is still updated as a view. It does not refresh, so refresh the views once afterwards. A test can use it to show a view with presentation state, such as a banner counting up, at a known moment: `await advanceTime(300, banner)`.
