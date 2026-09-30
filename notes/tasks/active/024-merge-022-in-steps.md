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
| 1 | Barrel lint rule fix: escape the `#` allow-list entries, so a violation is reported instead of crashing ESLint (011 section 11.1). Also this task | 3 | Done: `c3fddbf` |
| 2 | Split `common/`: renderer-agnostic helpers to `src/mvt-utils/`, `texture-registry` and `frame-stats` to `pixi-mvt`; the `#mvt-utils` alias; every importer, the benchmark driver's stub, docs | ~100 | Done: `9a1aa58` |
| 3 | Generic scene passes: `SceneNode`, `SKIP_DESCENDANTS`, `read-counter` and `createScenePasses` (with 012's cached methods) in the base; pixi-mvt rebuilt on them | ~15 | Done: `755ecab` |
| 4 | JSX base (`src/mvt-utils/jsx/`) and conformance suite; Pixi's JSX target moved to `src/pixi-mvt/jsx/`. The `#pixi-jsx` alias points at the new place, so importers do not change | ~30 | Done: `44b0287` |
| 5 | Rename the alias `#pixi-jsx` to `#pixi-mvt/jsx` in pragmas, imports and docs; the barrel rule's `jsx` subpaths | ~40 | Done: `aa5fac1` |
| 6 | Build-time precompiler: plugin, manifests, generator and drift tests, Pixi's manifest, the base's `registerRefreshFactories` hook, the opt-in in `vite.config.ts` | ~14 | Done: `680df08` |
| 7 | `jsx-refresh` benchmark suite | ~4 | Done: `77a2269` |
| 8 | three.js renderer: `src/three-mvt/` (scene passes, destroy registry, pointer picker, JSX target, manifest); `three` dependencies | ~22 | Done: `b4ec3ba` |
| 9 | Boids in 3D demo (three.js only) | ~8 | Done: `117a64e` |
| 10 | HTML renderer: `src/html-mvt/`; attribute patterns in the base; the `<List>` visibility conformance test; `happy-dom` | ~22 | Done: `c9ed69e` |
| 10a | Fix-up from review of step 10: the renderers' scene-pass glue de-duplicated (one-line type augmentations, each renderer's `scene-passes.ts` folded into its mixin, a `beforeScenePass` hook for the DOM), and single-line imports in files from steps 4, 6 and 8 | 22 | Done: `69a02fe` |
| 11 | Browser benchmark mode and the `html-scene-passes` suite, with saved results | ~9 | Done: `5d1c71b` |
| 12 | Boids in 3D demo's HTML panel | ~4 | In review |
| 13 | Proposal 022 and planning notes: 011, 012, 008, 023, 017 updates; notes index; glossary; source trees in `AGENTS.md`, `README.md`, project-structure. Archive this task | ~14 | |

**Carve-outs** (a step commits a version without the later feature):

- Attribute patterns (`data-*`, `aria-*`) in the JSX base and precompiler (manifest code, its tests, the plugin's tests): step 10.
- The precompiler's manifest list and repo sweep cover Pixi only until three.js and HTML exist: steps 8 and 10. `vite.config.ts` lacks the flock demo's build input until step 9.
- The precompiler's `registerRefreshFactories` hook in the base, and each JSX target's one-line re-export: step 6.
- The conformance test "keeps a slot its own visible binding hides hidden when its item leaves and returns", `JsxTarget.visible`'s note on it, and the base design notes' decision 10: step 10.
- The base design notes' decision 11 and precompiler passages, `refresh-source`'s version and the `precompiled` count: step 6.
- The base design notes' mentions of three.js and HTML: steps 8 and 10.
- The barrel rule's allow list grows with the aliases and subpaths each step adds.
- pixi-mvt's design notes leave out three-mvt and the DOM: steps 8 and 10.
- `SlotList`'s error message, reworded from "drive update()" to "call update() every tick": step 3, with the other "drive" rewording, so step 2's moves stay exact.

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
- 2026-09-30: Step 1 committed (`c3fddbf`). Step 2 in review: 22 files
  moved unchanged, 65 importers rewritten.
- 2026-09-30: Step 2 committed (`9a1aa58`). Step 3 in review; pixi-mvt's
  tests pass unchanged on the generic core, apart from one import.
- 2026-09-30: Review of step 3: `SceneNode`'s doc made renderer-neutral, in
  the worktree and the reference, so it is no longer a carve-out. The idea of
  one `_mvt` record per node instead of six `_mvt*` fields went to 017 as an
  experiment, for after the merge.
- 2026-09-30: Step 3 committed (`755ecab`). Step 4 in review: 801 tests (the
  conformance suite on Pixi, and the base's own). Found while building it,
  and fixed in the reference: pixi-mvt's JSX design notes still said the
  site's Vite config gives the precompiler its element table (since phase 5
  it reads the manifest); and the barrel rule's comment said "each target's
  tests" (now "each JSX target's").
- 2026-09-30: Review of step 4: factories take one named-params object.
  `createJsx({ target, elements, canGenerateCode })` (`JsxOptions<N>` gains
  `target` and `elements`), `createRefreshBuilder(RefreshBuilderOptions)`
  and, in the reference, `createPrecompileManifest({ target, elements })`;
  tests that passed `JsxOptions` for `canGenerateCode` pass a boolean. The
  rule is in the style guide's Factory Functions section and the code-style
  skill, in both trees. Then `createList({ target })` and
  `createSwitch({ target })` too (`ListOptions<N>`, `SwitchOptions<N>`);
  `createScenePasses(tree)` already takes a named-params object.
- 2026-09-30: Step 4 committed (`44b0287`). Step 5 in review: 58 uses of
  `#pixi-jsx` in 33 files renamed; 30 of them now match the reference.
- 2026-09-30: Step 5 committed (`aa5fac1`). Step 6 in review: 824 tests; the
  precompiled build precompiles 42 shapes in 24 modules (Pixi's views only).
- 2026-09-30: Review of step 6: kept the precompiler for now, and added
  task 025 (backlog) to decide between it and a Pixi-like two-mode runtime.
  025 lives in the worktree, with this task, until the end.
- 2026-09-30: Step 6 committed (`680df08`), with task 025. Step 7 in review.
- 2026-09-30: Step 7 committed (`77a2269`). Step 8 in review: 961 tests. Its
  `package-lock.json` is the reference's with `happy-dom` removed from the
  root and every package no longer reachable pruned (optional peers not
  followed); the result adds exactly `three`, `@types/three` and the latter's
  six dependencies, and `npm ls --package-lock-only --all` passes.
- 2026-09-30: Step 8 committed (`b4ec3ba`). Step 9 in review: 964 tests; the
  demo checked in headless Chrome (WebGL through SwiftShader).
- 2026-09-30: Review of step 9: the demo renamed from `flock-3d` to
  `boids-3d` ("Boids in 3D"), in both trees; its views keep their names,
  `FlockView` and `FlockPanelView`, after the `FlockModel` they show. Added
  task 026 (backlog): a demos screen for every renderer, built with HTML JSX.
- 2026-09-30: Step 9 committed (`117a64e`), with task 026. Step 10 in review: 1124
  tests; every carve-out that waited for HTML is resolved, and the step's 32
  files match the reference exactly.
- 2026-09-30: Step 10 committed (`c9ed69e`). Review asked for single-line
  imports (as for exports), fixed in step 10's own files before it was
  committed, and questioned the duplication across the three renderers'
  mixins; both are in fix-up step 10a, in review: the six glue files go from
  677 lines to 503.
- 2026-09-30: Review of 10a: each renderer's `scene-passes.ts` only
  re-exported its mixin's objects, so it is folded into the mixin, which now
  exports the functions itself; the objects are internal. The glue is now
  three files, 463 lines, down from six and 677.
- 2026-09-30: The renderers' `scene-passes.test.ts` renamed after the
  modules they now test (`container-mixin.test.ts`,
  `object3d-mixin.test.ts`, `element-mixin.test.ts`); 19 older Pixi test
  and banner names that said "pass" or "drive" now say "scene pass" and
  what happens.
- 2026-09-30: pixi-mvt's `mvt-container-mixin.ts` renamed `container-mixin.ts`,
  after the class it extends, like three-mvt's and html-mvt's mixins.
- 2026-09-30: Step 10a committed (`69a02fe`). Step 11 next.
- 2026-09-30: Step 11 set up: browser benchmark mode, the `html-scene-passes` suite and its saved results.
- 2026-09-30: Step 11 committed (`5d1c71b`). Step 12 set up: the Boids in 3D demo's HTML settings panel.
