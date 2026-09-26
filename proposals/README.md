# Proposals

Design work that is **not yet implemented**, or implemented only in part. Each
file is numbered so they stay together and in dependency order rather than
scattered next to the code they describe.

Nothing here is a description of how the repo currently works. For that, see
[docs/](../docs/index.md) and the README of the module in question.

| | Document | Status |
| --- | --- | --- |
| 001 | [MVT plugin rework plan](./001-mvt-plugin-rework-plan.md) | Implemented in `src/pixi-mvt/`; the section 3.5 visibility gating was superseded by the `SKIP_DESCENDANTS` sentinel. Everything in the repo migrated, including `pixi-jsx`, the playground and the `docs/` guide; section 13.1 is complete. Of the section 13 follow-ups, drain-the-tail remains open at lower priority; the rest are done or closed |
| 002 | [MVT plugin design notes](./002-mvt-plugin-design-notes.md) | Rationale for what was built |
| 003 | [MVT plugin appraisal](./003-mvt-plugin-appraisal.md) | Independent review of whether this repo needs it |
| 004 | [`<List>` proposal](./004-list-proposal.md) | **Implemented** in `src/pixi-jsx/` (`list.ts`, `switch.ts`, and runtime sections 7.1 to 7.6); both JSX demos migrated. Two small differences from the section 4.3 reference code are noted at the end of that section; a single `items` prop replaced `length`/`item` (section 4.7); and construction is inert (section 7.7). `<Switch>` shipped as `<Switch>`/`<Match>` (section 5.4). Only step 8 (folding 006 into `docs/`) remains, deferred until the JSX runtime graduates. Parked ideas and settled questions are in section 11 |
| 005 | [`SlotList` proposal](./005-slot-list-proposal.md) | **Implemented** in `src/common/slot-list/` (`SlotList` + `OrderedSlotList`, shipped as `releaseDelayMs`, with indexed access through array-shaped `slots` and `ordered` properties); adopted in `asteroids` and `scramble`, with a demo in `src/demos/ordered-list/`. The `<List>` projection (section 5.3) is `<List items={list.slots}>`, covered by tests in `src/pixi-jsx/list.test.ts`; no game uses it, because the games are not written in JSX |
| 006 | [`<List>` patterns guide](./006-list-patterns.md) | Usage guide for 004 and 005 |
| 007 | [Authoring-convention bridge](./007-authoring-convention-bridge.md) | Proposed. A strongly-typed key-rename transform between imperative `bindings` views and JSX `props` views, so each is authored in its own idiom and consumed under the other |
| 008 | [`Watch()` fluent builder](./008-watch-builder-spike.md) | Spike. One poll-based `Watch()` chain covering change detection (`watch`), memoised derivation (`derive`), reactions (`ReactionBuilder`) and uniform lists. The prototype and its tests are in `src/common/watch-builder.spike.ts`, not exported from the barrel. Recommends promotion; open questions and promotion work are in its "Handover: loose ends" section |
| 010 | [Performance docs proposal](./010-performance-docs-proposal.md) | **Implemented, and superseded as the place to find numbers.** Re-running its harness found the original push numbers were too low (section 4.6). The benchmarks are now consolidated in [`benchmarks/`](../benchmarks/README.md) (`npm run bench`), with results in the docs' Performance group |
| 011 | [Multi-package repo](./011-multi-package-repo.md) | Proposed. Splits the libraries into `@mvtjs/utils` and `@mvtjs/pixi` in a pnpm workspace, with the games, demos and playground as one private `site` package and a decluttered top level. Includes a tooling briefing, a Vite+ lint trial (it can enforce this repo's own formatting without Oxfmt), and an eight-phase migration plan |
| 012 | [Performance findings from the falling-sand demo](./012-falling-sand-performance-findings.md) | Proposed. Caching each container's method in the pixi-mvt pass loop (prototyped: 30-40% cheaper refresh in mixed scenes), a mixed-scene variant of the `scaling` benchmark, a docs note on Pixi render-group rebuilds, and a decision on the perfmon's unreliable GPU figure |
| 013 | [Does the MVT architecture limit game performance?](./013-mvt-performance-ceiling.md) | Analysis, estimated rather than measured. Concludes the architecture's one inherent cost is re-reading presented state every frame (about 1-2 ms per million items per core with flat data), and that the costs measured in this repo come from the implementation: about 5x from the language and runtime, about 25x from an object per game object and a scene graph |

## Reading order

**001** comes first because everything else depends on it. `onUpdate` and
`onRefresh` replace Pixi's `onRender` for MVT state sync, and the
`SKIP_DESCENDANTS` sentinel in section 3.5 is what lets 004 drop its guard
props.

**004** then **005** are a pair: an index-addressed `<List>` that does no
reconciliation, and the model-side collection designed to feed it. **006** is
how to use both, including a survey of 37 list scenarios and which of the three
shapes each one wants.

**002** and **003** are supporting material for 001 and can be skipped unless
you are weighing whether the plugin is worth having.

**007** and **008** are independent of the rest. 007 builds on 001 (uniform
`onUpdate`/`onRefresh` methods leave accessor naming as the only difference
between the two view conventions) and touches the JSX runtime from 004. 008
concerns the `watch()` change-detection helper in `src/common/`.

**010** stands alone. Read its section 4 before running or trusting any
benchmark in this repo.

**011** is about the repo rather than the architecture, and can be read on
its own. Its migration moves most of the paths the other proposals cite, which
keep their old paths as a historical record.

**012** follows on from 001 and 010. Its section 2 changes 001's pass loop,
and its section 3 qualifies the `scaling` numbers that came out of 010's
harness.

**013** builds on 012's measurements to ask whether MVT itself, rather than
this repo's implementation of it, limits performance. It can be read on its
own; section 3 separates what the architecture requires from what this repo
chose.

## Open items (handoff)

Everything known to be outstanding, with where each is recorded. Nothing here
is in progress.

| Item | Where it is recorded | Status |
| --- | --- | --- |
| Benchmarks in browsers, with rendering included | [`benchmarks/README.md`](../benchmarks/README.md), "What is excluded"; 010 section 8, items 1-2 | Open. Everything so far is V8 under Node with nothing rendered |
| Drain-the-tail (refresh containers added mid-pass on the same frame) | 001 section 13, item 1 | Open, lower priority: `<List>` and `<Switch>` already refresh what they build |
| Fold the `<List>` patterns guide into `docs/` | 004 section 9, step 8 | Deferred until the JSX runtime graduates |
| `range()` helper, accessor lint rule, `<List>` wrapper merge, typed `matchOn<T>()` | 004 section 11, items 1-4 | Parked, each with a trigger |
| Change-gate for idle subtrees (`refreshWhen`) | 010 section 8, item 5 | Parked, unmeasured |
| Hot path rules that cost nothing in V8 (`for...of` over arrays, returned tuples): keep, soften, or drop? `AGENTS.md` critical rule 5 still bans `for...of` outright | 010 section 9, step 7; the docs' Hot Paths page | Open decision |
| This repo's games allocate on the hot path: Pac-Man and Scramble about 2-3 KB per frame, International Karate about 1 KB | The `games-and-demos` suite in [`benchmarks/`](../benchmarks/README.md) | Open. Unexplored; the allocation benchmark can find where it comes from |
| The Boids demo allocates about 360 KB per frame, causing 88 garbage collections a minute (about 34 ms in total). Every game allocates under 3 KB | The `games-and-demos` suite in [`benchmarks/`](../benchmarks/README.md) | Open, high priority. Suspected, not yet confirmed by measurement: the flock model allocates nothing per frame, but the view clears and redraws all 200 boids into one Pixi `Graphics` every frame, and Pixi builds new shape data each time. A likely fix is a sprite per boid, positioned and rotated rather than redrawn. Separately, the model takes about 1 ms per frame comparing every pair of boids |
| CI benchmarking | 010 section 8, item 4 | Open question. Push memory cost (item 3) is now measured by the `memory` suite; browsers and rendering (items 1-2) are the row above |
| `Watch()` builder: six open design questions, docs to write, promotion and migration of ~38 `watch()` call sites | 008, "Handover: loose ends" | Open; decisions already made are listed there and should not be reopened. New input: the `change-detection` benchmark measures `watch()` at about 8 ns per watched value per frame, over three times comparing by hand (see the docs' Performance Measurements) |
| Barrel rule (`import/no-internal-modules`) crashes ESLint on its first real violation: the `'#common'` and `'#pixi-jsx'` allow entries compile to `false` | 011 section 11.1 | Open. Deliberately left for the restructure (011 phase 1); verify with a deliberate violation when fixing |
| Multi-package migration, and the Vite+ trial within it | 011 sections 9.3 and 12 | Proposed; no unresolved questions. Settled decisions are in section 13.2 |
| Cache each container's method in the pass loop, with a counter for methods assigned mid-pass | 012 sections 2.3-2.4 | Proposed; prototype measured, one test defines the remaining work |
| Mixed-scene variant of the `scaling` suite, and a best-case caveat on its numbers | 012 section 3.2 | Proposed |
| Docs note: text and graphics changes rebuild a Pixi render group | 012 section 4.2 | Proposed |
| The perfmon's GPU row misleads on NVIDIA laptop GPUs: drop it, or mark it indicative | 012 section 5.3 | Decision needed. Hypotheses already ruled out are in section 5.4 |
| Compare the workshop repo's falling-sand story on the same machine | 012 section 6 | Optional |
| Measure the TypeScript falling-sand view at 40-50k grains, to test the extrapolation in 013 | 013 section 8 | Proposed |
| Prototype a flat-array, instanced view of the falling-sand grains in TypeScript | 013 section 8 | Proposed. Tests 013's central claim |
| How MVT should treat gameplay-relevant state that lives on the GPU | 013 section 6.2 | Open question |
| Function members in types still use method syntax in 537 places across 120 files (about 310 in the games), against the style guide's "Function-Valued Properties in Types". Convert them, then enable `@typescript-eslint/method-signature-style` set to `'property'` | The style guide; count with `npx eslint --rule '{"@typescript-eslint/method-signature-style":["error","property"]}' src benchmarks scripts` | Open. Mechanical: the lint rule's auto-fix converts them all. Type-check afterwards, since the stricter parameter checks may surface real errors. They are most likely around `SlotList<T>` and `OrderedSlotList<T>` in `src/common/slot-list/`, which take `T` as a parameter: converted, a `SlotList<Asteroid>` is no longer accepted as a `SlotList<GameObject>`. Prefer fixing code that relies on this; failing that, add a narrow, documented exception for generic collection interfaces (as TypeScript's own `Array<T>` makes) |

Settled questions that should not be reopened without new information are in
004 section 11 (items 5-7), 004 section 5.4 ("Evolution") and 011 section 13.2.

## Related, but not proposals

- [`articles/can-pull-match-push.md`](../articles/can-pull-match-push.md) is a
  write-up of the `<List>` design for a general audience. Left where it is
  because it is a publication, not a plan.
- [`src/demos/list-swap/`](../src/demos/list-swap/README.md) is a runnable
  demonstration of the addressing model in 004, using the shipping `<List>`.
