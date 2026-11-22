# Publish `@mvtjs/pixi-3d`

| Field    | Value      |
| -------- | ---------- |
| Priority | low        |
| Created  | 2026-11-22 |
| Updated  | 2026-11-22 |

## Description

This task is stage 8 of [107](../../archive/107-complete-pixi-3d-jsx.md).
The package is built and checked as the published libraries are. Publint
and attw pass, and `build:packages` builds it. It stays private while
PixiJS 3D is new, though. `@pixi/3d` is pinned exactly, at 0.1.0, which was
nine days old when the package was completed.

Publish it once PixiJS 3D has a release past 0.1.0 that doesn't break the
package.

## Acceptance criteria

- [ ] Upgrade `@pixi/3d` to its newest release, in the package's peer range
      and in every site, the checks, the benchmarks and the playground.
- [ ] The element table's test, the conformance suite and the leak checks
      in each 3D entry's visual tests still pass. These tests catch a
      renamed option or a changed `destroy`.
- [ ] The findings in the package's design notes still hold. Check each one
      in the new release's source.
- [ ] Remove `"private": true`, set the version to the `@mvtjs` libraries'
      own, and widen the peer range on `@pixi/3d` if the release allows it.
- [ ] Add a changeset that names it, and list it with the libraries in
      `.changeset/README.md` and AGENTS.md.
- [ ] Publish its first version by hand, as `.changeset/README.md`'s "The
      first release" says, then set up trusted publishing for it.
- [ ] Add it to the dependencies of the playground's exported projects
      (`EXPORT_DEPENDENCIES` in `libraries/libraries.ts`).

## Progress log

- 2026-11-22: Created, as 107 finished.
