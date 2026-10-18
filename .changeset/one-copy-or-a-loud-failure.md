---
'@mvtjs/utils': minor
'@mvtjs/pixi': minor
'@mvtjs/three': minor
'@mvtjs/html': minor
---

A program must now load one copy of each @mvtjs package. A second copy throws an error as it loads, which names both copies and says how to keep one. Before, copies of the same version shared their state, and copies of different versions logged a warning. If you upgrade and see the error, run `npm ls @mvtjs/utils` to find the second copy, then `npm dedupe` or npm `overrides`, and in Vite, list the @mvtjs packages in `resolve.dedupe`. A test that resets its modules, with `vi.resetModules()` or `jest.resetModules()`, loads the packages again too, so keep it in a file of its own. `PROTOCOL`, `shareAcrossCopies` and `registerCopy` are no longer exported from `@mvtjs/utils`. See "Keep one copy" in its README.
