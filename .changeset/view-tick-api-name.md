---
'@mvtjs/utils': patch
---

The docs now call `updateView`, `refreshView`, `setUpdate`, `setRefresh` and what goes with them the view tick API, since they tick views only. A model needs no API to tick: you call its `update(deltaMs)`. `advanceTime` is a separate helper for tests, not part of the view tick API. Nothing you import has changed.
