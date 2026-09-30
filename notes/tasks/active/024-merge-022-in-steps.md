# Merge 022's Changes in Reviewed Steps

| Field    | Value      |
| -------- | ---------- |
| Priority | high       |
| Created  | 2026-09-30 |
| Updated  | 2026-09-30 |

## Description

The work behind [022](../../proposals/022-renderer-agnostic-jsx.md) (a
renderer-agnostic JSX base, generic scene passes, three.js and HTML renderers,
a build-time precompiler, and the moves that shape `src/` as 011's packages)
was done as one uncommitted change set of about 260 files. It lands as the
series of commits below instead, each small enough to review, each depending
only on the steps before it, and each leaving lint, type-check, tests and the
build passing.

**How.** The full change set stays uncommitted in the main checkout
(`vnext-jsx`), as the reference. Each step is built in a worktree,
`../mvt-games-steps`, on the branch `vnext-jsx-steps` from `a438df9`: the
step's files are copied from the reference, verified, reviewed, then staged
and committed by hand. A step commits final versions of its files, except
where a file holds a later step's feature (a carve-out, listed in the step);
then it commits a version without it, and the later step adds it.

**Changes asked for in review** are made in the worktree and in the
reference, so later steps pick them up. A change to an already-committed
step is a fix-up step of its own (`4a`, say). Each is logged below. This
file and the notes index are kept in the worktree, and copied to the
reference at the end.

**Done when** the branch's tree matches the reference exactly (line endings
aside), and `vnext-jsx` can move to it.

## Steps

| # | Topic(s) | Files | Status |
| --- | --- | --- | --- |
| 1 | Barrel lint rule fix: escape the `#` allow-list entries, so a violation is reported instead of crashing ESLint (011 section 11.1). Also this task | 3 | In review |
| 2 | Split `common/`: renderer-agnostic helpers to `src/mvt-utils/`, `texture-registry` and `frame-stats` to `pixi-mvt`; the `#mvt-utils` alias; every importer, the benchmark driver's stub, docs | ~100 | |
| 3 | Generic scene passes: `SceneNode`, `SKIP_DESCENDANTS`, `read-counter` and `createScenePasses` (with 012's cached methods) in the base; pixi-mvt rebuilt on them | ~15 | |
| 4 | JSX base (`src/mvt-utils/jsx/`) and conformance suite; Pixi's JSX target moved to `src/pixi-mvt/jsx/`. The `#pixi-jsx` alias points at the new place, so importers do not change | ~30 | |
| 5 | Rename the alias `#pixi-jsx` to `#pixi-mvt/jsx` in pragmas, imports and docs; the barrel rule's `jsx` subpaths | ~40 | |
| 6 | Build-time precompiler: plugin, manifests, generator and drift tests, Pixi's manifest, the base's `registerRefreshFactories` hook, the opt-in in `vite.config.ts` | ~14 | |
| 7 | `jsx-refresh` benchmark suite | ~4 | |
| 8 | three.js renderer: `src/three-mvt/` (scene passes, destroy registry, pointer picker, JSX target, manifest); `three` dependencies | ~22 | |
| 9 | Flock in 3D demo (three.js only) | ~8 | |
| 10 | HTML renderer: `src/html-mvt/`; attribute patterns in the base; the `<List>` visibility conformance test; `happy-dom` | ~22 | |
| 11 | Browser benchmark mode and the `html-scene-passes` suite, with saved results | ~9 | |
| 12 | Flock demo's HTML panel | ~4 | |
| 13 | Proposal 022 and planning notes: 011, 012, 008, 023, 017 updates; notes index; glossary; source trees in `AGENTS.md`, `README.md`, project-structure. Archive this task | ~14 | |

**Carve-outs** (a step commits a version without the later feature):

- Attribute patterns (`data-*`, `aria-*`) in the JSX base and precompiler: step 10.
- The precompiler's `registerRefreshFactories` hook in the base, and each JSX target's one-line re-export: step 6.
- The conformance test "keeps a slot its own visible binding hides hidden when its item leaves and returns": step 10.
- The barrel rule's allow list grows with the aliases and subpaths each step adds.

**Verified for every step:** `npm run lint`; `tsc` for `src` and
`benchmarks`, and for `scripts/` and `vite.config.ts`, which the root
`tsconfig.json` does not include; `npm test`; `npm run build`. Also, per
step: a deliberate barrel violation reported (1); the precompiled build
(`MVT_JSX_PRECOMPILE=1`, from 6); a benchmark smoke run (7, 11); a
headless-Chrome screenshot of the demo (9, 12). Each file is checked against
the reference, carve-outs aside.

## Acceptance Criteria

- [ ] Steps 1-13 committed on `vnext-jsx-steps`, each verified before review
- [ ] Every change asked for in review made in the worktree and the reference, and logged
- [ ] The branch's tree matches the reference exactly, line endings aside
- [ ] `vnext-jsx` moved to the branch, and the reference's uncommitted changes discarded

## Progress Log

- 2026-09-30: Created, with the worktree `../mvt-games-steps` on
  `vnext-jsx-steps` from `a438df9`. Step 1 in review.
