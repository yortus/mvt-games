---
'v-snap': minor
---

`withVsnap(config)`, from `v-snap/vitest`, adds v-snap's projects to a Vitest config as it is, with v-snap's options in the config, under `vsnap`. A flat config's unit test settings move into a `unit` project that leaves out the visual test files, so a project no longer restructures its config by hand. `...vsnap()` in `test.projects` still works.
