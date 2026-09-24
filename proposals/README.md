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
| 010 | [Performance docs proposal](./010-performance-docs-proposal.md) | Proposed. Measurements done (polling costs, JSX runtime against hand-written hooks, polling against push, benchmarking pitfalls); the docs changes they support are not |

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

**010** stands alone. Read its section 4 before running or trusting any
benchmark in this repo.

## Open items (handoff)

Everything known to be outstanding, with where each is recorded. Nothing here
is in progress.

| Item | Where it is recorded | Status |
| --- | --- | --- |
| Performance docs: commit the benchmark harness, re-measure three figures, write the docs pages, rework `benchmarks/` | 010 section 9 | Next step: commit the harness (010 Appendix A) |
| Three figures in 004 measured with a flawed method | 010 section 5.4; flagged in place in 004 sections 4.7 and 7.1 | Re-measure one design per process |
| Stale references in `benchmarks/` (`npm run bench`, `reactivity.bench.ts`, `docs/reactivity-guide/comparison.md`) | 010 section 2 | Fix with the benchmark rework |
| Drain-the-tail (refresh containers added mid-pass on the same frame) | 001 section 13, item 1 | Open, lower priority: `<List>` and `<Switch>` already refresh what they build |
| Fold the `<List>` patterns guide into `docs/` | 004 section 9, step 8 | Deferred until the JSX runtime graduates |
| `range()` helper, accessor lint rule, `<List>` wrapper merge, typed `matchOn<T>()` | 004 section 11, items 1-4 | Parked, each with a trigger |
| Change-gate for idle subtrees (`refreshWhen`) | 010 section 8, item 5 | Parked, unmeasured |
| Browsers, rendering cost, push memory cost, CI benchmarking | 010 section 8, items 1-4 | Open questions |
| Duplicate task folder `tasks/active/002-documentation-overhaul/` | Here | Delete: the task is complete and archived in `tasks/archive/` |

Settled questions that should not be reopened without new information are in
004 section 11 (items 5-7) and 004 section 5.4 ("Evolution").

## Related, but not proposals

- [`articles/can-pull-match-push.md`](../articles/can-pull-match-push.md) is a
  write-up of the `<List>` design for a general audience. Left where it is
  because it is a publication, not a plan.
- [`src/demos/list-swap/`](../src/demos/list-swap/README.md) is a runnable
  demonstration of the addressing model in 004, using the shipping `<List>`.
