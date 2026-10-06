# Tick API: One Copy, or a Loud Failure

| Field    | Value      |
| -------- | ---------- |
| Priority | low        |
| Created  | 2026-10-06 |
| Updated  | 2026-10-06 |

## Description

Before the first publish, 011 built all five of 027 section 11.7's
mitigations for two copies of the @mvtjs packages in one program
([011's progress log](../../archive/011-multi-package-repo.md), "Two copies
in one program"). The centrepiece is mitigation 3: copies with the same
`PROTOCOL` share one core, so a second copy loaded by tooling (Vite reaching
a package by two paths, a linked package with its own `node_modules`) simply
works, and a second copy at another version shares the first one's code.

That is a lot of machinery for a case that good packaging already makes
rare, and that a user can always fix. This task removes the sharing and
keeps detection, made louder: a second copy throws at load, with the advice
on how to keep one copy. It relies on:

- **(a) good practice:** `@mvtjs/utils` is already a peer of every renderer
  package, and the READMEs say how to keep one copy (`npm ls`, `npm dedupe`,
  npm `overrides`, Vite's `resolve.dedupe`);
- **(b) loud failure:** a duplicate stops the program at load, rather than
  being worked around (same protocol) or warned about (another version or
  protocol).

### What exists today

- [copies.ts](../../../packages/utils/src/copies.ts): `PROTOCOL`,
  `shareAcrossCopies(host, name, create)` and `registerCopy(name, version)`,
  all three exported from `@mvtjs/utils`.
- [shared-state.ts](../../../packages/utils/src/tick-api/shared-state.ts):
  `methodAssignments` and the `tickCounter` object, kept in one object on
  `globalThis` so every copy of utils counts into it; registers utils' copy.
  It is the module utils' `sideEffects` keeps.
- [tick-api.ts](../../../packages/utils/src/tick-api/tick-api.ts): the
  dev-only `_mvtProtocol` field, set by `setUpdate` and `setRefresh` and
  checked on every node visit (`visit`, `warnOfForeignNode`,
  `hasWarnedOfForeignNode`), so a walk can warn of a node another protocol
  set up.
- Each renderer's mixin
  ([pixi](../../../packages/pixi/src/container-mixin.ts),
  [three](../../../packages/three/src/object3d-mixin.ts),
  [html](../../../packages/html/src/element-mixin.ts)) wraps its registration
  in `shareAcrossCopies` on the prototype it extends (three and html through
  an `ObjectCore` / `ElementCore` record), and calls `registerCopy` with the
  version it imports from its `package.json`.
- [skip-descendants.ts](../../../packages/utils/src/tick-api/skip-descendants.ts):
  `SKIP_DESCENDANTS` is `Symbol.for(...)` so every copy agrees.
- Tests: [copies.test.ts](../../../packages/utils/src/copies.test.ts), a
  `second-copy.test.ts` in each renderer, and the "nodes set up by an
  incompatible copy" block in
  [tick-api.test.ts](../../../packages/utils/src/tick-api/tick-api.test.ts).

### The plan

1. **utils claims the program.** A small guard, run once at load from the
   module `sideEffects` keeps, looks for a marker on `globalThis` and throws
   if one is there, naming both versions and how to keep one copy;
   otherwise it sets the marker with its version. This catches the case the
   renderers cannot: two copies of utils behind one renderer, which today
   would split `methodAssignments` and the counters silently.
2. **Renderers rely on `registerRenderer`'s existing throw.** It already
   throws when a prototype is registered twice. Call the registration
   directly at load (no `shareAcrossCopies`), and reword the message so it
   names the likely cause (two copies of the renderer package extending one
   class) and the fix. Two copies of a renderer that extend two copies of
   the underlying library (two `pixi.js`) register two prototypes and keep
   working, as now: their nodes never share a tree.
3. **Module-level state goes back to module level.** `methodAssignments`
   becomes a `let` in `tick-api.ts`; `tickCounter` a plain object in
   `tick-counter.ts`. `shared-state.ts` goes, and `sideEffects` moves to the
   guard's module.
4. **The protocol goes.** `PROTOCOL`, `_mvtProtocol`, the dev check in
   `visit` (which then becomes plain `fieldsOf`), and `warnOfForeignNode`.
   With one copy guaranteed, the `_mvt` fields can change layout in any
   release, with no rule to bump a number and rename them in step.
5. **Renderer cores flatten.** three and html export their destroy registry
   (and html its observer state) as ordinary module-level values; the
   `ObjectCore` / `ElementCore` records and their doc comments go. Renderers
   stop importing their `package.json`.
6. **`SKIP_DESCENDANTS`**: either keep `Symbol.for` (free, harmless) and drop
   only the comment about copies, or make it a plain `Symbol`. Keeping it
   costs nothing and helps the transition (see issue 5 below).
7. **Tests** become one "a second copy throws" test per package, using the
   same query-string trick the current tests use to load a second instance.
8. **Docs**: a short "Keep one copy" section in each package README (there
   is none today; the docs site has no install page), and the advice in the
   thrown message.
9. **A changeset**: removing three exports from `@mvtjs/utils` and turning a
   working (same-version) duplicate into a load error are breaking, so a
   minor bump while in 0.x.

## How Much Code Goes

Estimated from the files above, not yet measured on a branch. Lines include
doc comments, which are a large share of this code.

| Where | Removed | Added | Net |
| --- | --- | --- | --- |
| `copies.ts` | 112 | ~25 (the guard, its message, and the legacy key; issue 5) | ~-87 |
| `shared-state.ts` | 39 | ~3 (moved into `tick-api.ts` and `tick-counter.ts`) | ~-36 |
| `tick-api.ts` (protocol field, dev visit check, foreign-node warning, comments) | ~37 | ~6 (`methodAssignments` and its comment) | ~-31 |
| Other utils source (`index.ts` exports, comments in `skip-descendants.ts`, `tick-counter.ts`) | ~6 | 0 | ~-6 |
| Renderer mixins (pixi ~9, three ~18, html ~22) | ~49 | 0 | ~-49 |
| **Shipped source** | **~243** | **~34** | **~-209** |
| `copies.test.ts`, three `second-copy.test.ts`, the tick-api test block | ~283 | ~70 (a throw test per package) | ~-213 |
| **Total** | **~526** | **~104** | **~-420** |

The mitigations marked **(adopt)** below add back about 10 lines of shipped
source (the second message and the stored URL in the guard) and about 40
outside it (the website check, and the CSP test in its own file). That
leaves about 200 lines of shipped source and about 370 lines in all, net.

For scale: utils' tick API and `copies.ts` are about 1,240 lines of source,
so utils loses roughly 13% of that. `tick-api.ts` itself, the hot file,
loses only about 3%: the copy handling there is a field, two writes, and one
dev-only check per node visit.

What the lines undersell:

- **Three public exports gone** (`PROTOCOL`, `shareAcrossCopies`,
  `registerCopy`), which a third-party renderer would otherwise be expected
  to call.
- **One standing rule gone**: bump `PROTOCOL` and rename every `_mvt` field
  with any change to their layout or meaning.
- **One concept gone from every renderer**: "the core", made by whichever
  copy loads first, so code from one version may run under another's name.
- **Shipped bytes**: `dist/copies.js` is 3.7 KB unminified with comments;
  likely under 1 KB minified, a few hundred bytes gzipped (not measured).
- **Dev builds**: one branch less per node visit in every walk.

Worth doing for the simplicity, not the bytes. It is low priority because
nothing is broken today.

## Potential Issues

1. **A same-version duplicate that works today will throw.** The common
   cause, tooling loading one version twice, is exactly what mitigation 3
   made silent. Users hit an error on first run and must fix their install
   or bundler config. This is the deliberate trade, but it is the one most
   likely to generate issues. The message must say exactly what to do, and
   the READMEs must carry the same advice.
2. **Re-evaluating modules without resetting globals throws.** A marker on
   `globalThis`, or a registration on a prototype, outlives a re-run of the
   module that set it, and the guard cannot tell a re-run from a second
   copy. Concretely:
   - **In this repo:** [html-jsx.test.tsx](../../../packages/html/src/jsx/html-jsx.test.tsx)
     calls `vi.resetModules()` and re-imports `./jsx-runtime`, which
     re-evaluates `element-mixin.ts` and, since the libraries resolve to
     source and are inlined, utils' modules too. Today the shared core makes
     that harmless; after this task it throws. That test needs another way
     to get a runtime with `Function` blocked (its own test file, stubbing
     `Function` before the first import, is the obvious one).
   - **For users:** Jest's `jest.resetModules()` / `isolateModules`, and
     Vitest's `vi.resetModules()` on inlined dependencies, will throw on the
     second load. Vitest externalizes `node_modules` by default, so most
     Vitest users are unaffected; Jest users are not.
   - **HMR** that re-runs a library module without a full reload would
     throw. Consumers never edit `node_modules`, and this repo has no
     `import.meta.hot` code, so edits to the libraries fall back to a full
     reload; confirm that while doing the task.
3. **Independent bundles on one page.** Two separately built apps or widgets,
   each bundling its own `@mvtjs/utils`, share one `globalThis`, so the
   second throws, even with separate Pixi copies whose trees never meet.
   Today they share a core and work. With `@mvtjs/html` they really do
   collide (one `Element.prototype` per page). Rare for games; a deliberate
   loss, recorded so it is not rediscovered. An opt-out would put back some
   of what this task removes.
4. **Dev and production builds can differ.** Vite's dev server pre-bundles
   dependencies with esbuild; `vite build` resolves with Rollup. A duplicate
   that appears only in a production build would ship an app that throws on
   load for every player, with nothing seen in dev. Duplicates from
   pre-bundling are usually dev-only, which is the safer way round, but it
   cannot be ruled out. Options: throw only in dev and `console.error` in
   production (one more branch, and a split core then misbehaves silently),
   or throw always and lean on the docs. Recommended: throw always, since a
   split core's failures (missed mid-walk method changes, views never
   ticked) are worse to debug than a load error.
5. **Mixing with 0.2.x copies already published.** 0.2.x registers itself
   under `Symbol.for('mvtjs:copies')` and shares under
   `Symbol.for('mvtjs:@mvtjs/<pkg>:v1')`. If the new guard used only a new
   key, an old copy loaded first would go unnoticed for utils (the renderers
   would still collide on the prototype). So the guard should read and write
   the old `mvtjs:copies` record, which keeps its layout (`copies`,
   `warned`), and register with a protocol number other than 1, so an old copy
   loaded second warns of "incompatible copies" as it already does. About
   five lines, kept until 0.2.x is long gone.
6. **A hot-path change.** `methodAssignments` moves from a property of a
   shared object back to a module-level `let`, read on every walk entry and
   in the loop. 011 measured the move the other way as neutral, so this
   should be too, but measure it: interleaved A/B of `refresh-view`,
   `jsx-refresh`, `construction` and `html-refresh-view`, each side in its
   own worktree.
7. **The counters.** With sharing, every copy counted into one
   `tickCounter`; the perfmon read the same counts whichever copy it
   imported. After this task there is only one copy, so nothing changes,
   but the doc comments that promise cross-copy counting must go.
8. **Load-time errors are blunt.** An ES module that throws at evaluation
   stops the whole import graph: a blank page, with the error in the console.
   That is the intent, but the message is all the user gets, so it must
   stand alone (both versions, what was loaded twice, `npm ls`, `dedupe`,
   `overrides`, `resolve.dedupe`).
9. **Decisions this reverses.** 027 question 16 and 011's "Decided at the
   start" chose all five mitigations. This task reverses mitigations 3 and 5
   (sharing, and wrapping once, which followed from it), replaces 1 and 4 (a
   warning at load, and a dev warning per foreign node) with a throw at load,
   and keeps 2 (peers). Record that in the progress log when done.

## Mitigations for the Potential Issues

Numbered to match the issues. Each says what it costs, since the point of
the task is less code; the ones marked **(adopt)** are cheap enough to be
part of it, the rest are options to weigh.

1. **Same-version duplicates.**
   - **(adopt)** Tell the two causes apart in the message, since they have
     different fixes. Same version twice: the bundler reached the package by
     two paths (a linked package with its own `node_modules`, a dependency
     pre-bundled and also imported directly), so check `resolve.dedupe` and
     `optimizeDeps`. Two versions: the install nested a copy, so check
     `npm ls @mvtjs/utils`, then `npm dedupe` or `overrides`. One comparison
     of the stored version; no extra code paths.
   - **(adopt)** A copy-paste Vite snippet in each README's "Keep one copy"
     section: `resolve.dedupe` listing the four packages.
   - **(adopt)** Say it in the changeset, so the release notes warn anyone
     upgrading.
   - Optional: one release first that keeps the sharing but logs a
     `console.error` saying a duplicate will throw from the next release.
     Kinder to users, but it means shipping the task in two steps. With so
     few users in 0.x, probably not worth it.
2. **Re-evaluated modules.**
   - **(adopt)** Move the CSP test in `html-jsx.test.tsx` to its own test
     file that stubs `Function` before its first import of the runtime, so
     it needs no `vi.resetModules()`. Each Vitest file here runs in its own
     process, so the stub cannot leak.
   - **(adopt)** Name re-runs in the message ("or a test reset its modules,
     such as `jest.resetModules()`") and in the README section, with the fix:
     keep such tests in their own file, since Jest and Vitest give each file
     fresh globals.
   - **(adopt)** Check HMR by hand: edit `container-mixin.ts`,
     `element-mixin.ts` and a utils module under `npm run dev`, and confirm a
     full reload. If any is hot-updated instead, add
     `import.meta.hot?.decline()` to that module, which makes Vite reload the
     page for it (one line, and `undefined`-safe outside Vite's dev server).
3. **Independent bundles on one page.**
   - **(adopt)** Document the standard fixes: share the packages as
     singletons (Module Federation's `shared: { singleton: true }`, or an
     import map), or isolate each app in an `iframe`.
   - Option: detect the conflict where it happens rather than at load.
     Drop the `globalThis` guard; instead, `updateView`, `refreshView`,
     `setUpdate` and `setRefresh` check that the `_mvtRenderer` they read
     was made by their own copy of utils, and throw if not. Bundles whose
     trees never meet (two `pixi.js` copies) then work, and only a real mix
     fails. Cost: one identity comparison per call (not per node visit), and
     the failure moves from load to first use. `@mvtjs/html` still collides,
     since a page has one `Element.prototype`. Worth it only if someone
     needs it; recorded so the design is not worked out twice.
4. **Production-only duplicates.**
   - **(adopt)** A check in `packages/checks/` that the built website holds
     the guard exactly once (count its marker string across the emitted
     JavaScript). It guards this repo's own site, the nearest thing to a
     real consumer, and joins `npm run build` beside the home-page budget.
   - **(adopt)** In the README, suggest running the production build once
     (`vite preview`) after adding or upgrading an @mvtjs package.
5. **0.2.x copies.**
   - **(adopt)** The plan already covers it: the guard reads and writes the
     old `mvtjs:copies` record. Test both orders with a planted 0.2.x
     record, as `copies.test.ts` does today. For the renderers, both orders
     already throw: whichever copy registers second finds `_mvtRenderer` on
     the prototype. Test that once, with an old-style registration planted
     on a test prototype.
   - **(adopt)** Give the legacy code a removal trigger in its comment: at
     1.0, or when 0.2.x has no downloads worth counting.
6. **Hot path.**
   - **(adopt)** The A/B run is the mitigation. If the module-level `let` is
     slower, keep the object shape that 011 measured
     (`const state = { methodAssignments: 0 }`), unshared; it costs nothing
     in lines.
7. **Counters.** Nothing beyond the doc comments. The perfmon's tests read
   `tickCounter` and will show any change.
8. **Blunt load errors.**
   - **(adopt)** Store each copy's `import.meta.url` with its version on the
     marker, and put both in the message. Two paths (say,
     `node_modules/.vite/deps/...` and `node_modules/@mvtjs/utils/...`)
     find a duplicate faster than any advice. One field.
   - **(adopt)** Throw an `Error`, never only log, so Vite's error overlay
     shows it in dev. Prefix it `[mvt]`, as every other message is.
   - For the renderers, the message from `registerRenderer` names the class
     and the advice; it has no URL of its own unless a renderer passes one.
     Not worth an option: utils' guard fires first when both are
     duplicated, and a renderer duplicated alone is found with `npm ls`.
9. **Reversed decisions.**
   - **(adopt)** When done, add a line under 027 section 11.7 and in 011's
     progress log pointing here, and a "settled" entry in this task: sharing
     between copies was removed on purpose; reopen only if users report
     duplicates that config cannot fix.

## Acceptance Criteria

- [ ] `copies.ts` and `shared-state.ts` removed; `PROTOCOL`,
  `shareAcrossCopies` and `registerCopy` no longer exported
- [ ] A second copy of `@mvtjs/utils` throws at load, naming both versions
  and the fix; it also detects a 0.2.x copy, either order (issue 5)
- [ ] A second copy of each renderer that extends the same class throws at
  load, through `registerRenderer`, with the same advice
- [ ] `_mvtProtocol`, the dev check in `visit` and `warnOfForeignNode` gone
- [ ] three and html export their registries without a core record;
  renderers no longer import their `package.json`
- [ ] `sideEffects` in utils' `package.json` names the guard's module, and
  `npm run build:packages` passes (publint, attw, the view-type check)
- [ ] The `vi.resetModules()` test in `html-jsx.test.tsx` reworked so it
  does not load a second copy
- [ ] One "a second copy throws" test per package; the old copy tests removed
- [ ] A "Keep one copy" section in each package README
- [ ] The thrown message tells same-version and two-version duplicates
  apart, and names both copies' `import.meta.url`
- [ ] HMR checked by hand for the mixins and utils
- [ ] A check that the built website holds one copy of the guard, run by
  `npm run build`
- [ ] Benchmarks show no regression (issue 6)
- [ ] A changeset for the breaking change, saying how to keep one copy
- [ ] 027 section 11.7 and 011's progress log point here
- [ ] Actual lines removed recorded below, against the estimate

## Progress Log

- 2026-10-06: Created. Estimates from reading the current code; nothing
  built or measured. Added mitigations for each potential issue.
