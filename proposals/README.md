# Proposals

Design work that is **not yet implemented**, or implemented only in part. Each
file is numbered so they stay together and in dependency order rather than
scattered next to the code they describe.

Nothing here is a description of how the repo currently works. For that, see
[docs/](../docs/index.md) and the README of the module in question.

| | Document | Status |
| --- | --- | --- |
| 001 | [MVT plugin rework plan](./001-mvt-plugin-rework-plan.md) | Implemented in `src/pixi-mvt/`; the section 3.5 visibility gating was superseded by the `SKIP_DESCENDANTS` sentinel. All games, the cabinet and `src/common/` migrated. What is left (a check by eye, updating `docs/`, the demos, `pixi-jsx`) is listed in section 13.1 |
| 002 | [MVT plugin design notes](./002-mvt-plugin-design-notes.md) | Rationale for what was built |
| 003 | [MVT plugin appraisal](./003-mvt-plugin-appraisal.md) | Independent review of whether this repo needs it |
| 004 | [`<List>` proposal](./004-list-proposal.md) | Proposed. Its dependency on 001 is met, so it is unblocked |
| 005 | [`SlotList` proposal](./005-slot-list-proposal.md) | **Implemented** in `src/common/slot-list/` (`SlotList` + `OrderedSlotList`, shipped as `releaseDelayMs`); adopted in `asteroids` and `scramble`, with a demo in `src/demos/ordered-list/`. Only the `<List>` projection (section 5.3) remains, pending 004 |
| 006 | [`<List>` patterns guide](./006-list-patterns.md) | Usage guide for 004 and 005 |

## Reading order

**001** comes first because everything else depends on it. `onUpdate` and
`onRefresh` replace Pixi's `onRender` for MVT state sync, and the visibility
gating added to section 3.5 is what lets 004 drop its guard props.

**004** then **005** are a pair: an index-addressed `<List>` that does no
reconciliation, and the model-side collection designed to feed it. **006** is
how to use both, including a survey of 37 list scenarios and which of the three
shapes each one wants.

**002** and **003** are supporting material for 001 and can be skipped unless
you are weighing whether the plugin is worth having.

## Related, but not proposals

- [`articles/can-pull-match-push.md`](../articles/can-pull-match-push.md) is a
  write-up of the `<List>` design for a general audience. Left where it is
  because it is a publication, not a plan.
- [`src/demos/list-swap/`](../src/demos/list-swap/README.md) is a runnable
  demonstration of the addressing model in 004. It carries a local copy of an
  earlier `<List>` until 004 replaces the shipping one (004 section 9, step 7).
