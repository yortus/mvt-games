---
'v-snap': minor
---

v-snap is a Vitest plugin: `plugins: [vsnap()]` adds its projects when Vitest starts, so a config keeps its shape, and `vitest` runs the unit tests and the visual tests together. The plugin leaves the visual test files out of the config's own tests, and names a flat config's tests `unit`. Its `root` is Vitest's root by default. Vitest's `-p` filter can't pick the plugin's projects, so a part of the visual test files' paths picks them instead, such as `vitest visual-tests/` with the default `include`, and v-snap says so when a `-p` filter leaves them nothing to run in.

Breaking changes. `withVsnap()` is gone: move its `vsnap` options into `vsnap()` in `plugins`, and leave the rest of the config as it was. The function that returns the projects, for a config that lists its projects itself, is now `vsnapProjects()`, in place of `vsnap()`, and spreading `vsnap()` into `test.projects` is a type error. v-snap's projects now keep their own `include`, `exclude`, `setupFiles` and `browser`, and leave out the config's `includeSource`, `environment` and `environmentOptions`, so those settings may stay in a config's `test` block. The run no longer stops over them.
