# Miscellaneous Loose Ends

| Field    | Value      |
| -------- | ---------- |
| Priority | medium     |
| Created  | 2026-09-26 |
| Updated  | 2026-09-26 |

## Description

Outstanding items left over from finished work. Each one came from a document
that is now archived, or from no document at all. Items that belong to an open
proposal are tracked in that proposal, not here.

Take an item out into its own task or proposal when it grows beyond a quick
fix. Tick it here and log where it went.

Settled questions that should not be reopened without new information are in
[004](../../archive/004-list-proposal.md) section 11 (items 5-7) and section 5.4
("Evolution").

### Fix

- **Boids allocates about 360 KB per frame** (high priority), causing 88
  garbage collections a minute (about 34 ms in total). Every game allocates
  under 3 KB. Suspected, not yet confirmed by measurement: the flock model
  allocates nothing per frame, but the view clears and redraws all 200 boids
  into one Pixi `Graphics` every frame, and Pixi builds new shape data each
  time. A likely fix is a sprite per boid, positioned and rotated rather than
  redrawn. Separately, the model takes about 1 ms per frame comparing every
  pair of boids. Measured by the `games-and-demos` suite in
  [benchmarks/](../../../benchmarks/README.md).
- **The games allocate on the hot path.** Pac-Man and Scramble about 2-3 KB
  per frame, International Karate about 1 KB. Unexplored; the allocation
  benchmark can find where it comes from.
- **Function members in types still use method syntax** in 537 places across
  120 files (about 310 in the games), against the style guide's
  "Function-Valued Properties in Types". Count them with
  `npx eslint --rule '{"@typescript-eslint/method-signature-style":["error","property"]}' src benchmarks scripts`.
  The lint rule's auto-fix converts them all; then enable the rule set to
  `'property'`. Type-check afterwards, since the stricter parameter checks may
  surface real errors. They are most likely around `SlotList<T>` and
  `OrderedSlotList<T>` in `src/common/slot-list/`, which take `T` as a
  parameter: converted, a `SlotList<Asteroid>` is no longer accepted as a
  `SlotList<GameObject>`. Prefer fixing code that relies on this; failing
  that, add a narrow, documented exception for generic collection interfaces
  (as TypeScript's own `Array<T>` makes).

### Decide

- **Hot path rules that cost nothing in V8.** The `hot-path-rules` suite
  found that `for...of` over an array and returning a `[col, row]` tuple cost
  nothing extra. The docs' Hot Paths page keeps both rules and says why, but
  `AGENTS.md` critical rule 5 still bans `for...of` outright. Keep, soften, or
  drop? From [010](../../archive/010-performance-docs-proposal.md) section 9,
  step 7.
- **Benchmarks in browsers, with rendering included.** Everything so far is V8
  under Node with nothing rendered. See `benchmarks/README.md`, "What is
  excluded", and 010 section 8, items 1-2.
- **CI benchmarking.** Timing noise on shared runners makes it hard; 010
  recommended treating the harness as an on-demand tool. 010 section 8, item
  4.

### Parked (pick up only when the trigger happens)

- **Drain-the-tail**: refresh containers added mid-pass on the same frame.
  Lower priority, because `<List>` and `<Switch>` already refresh what they
  build. Trigger: hand-written views start building children inside their
  methods. [001](../../archive/001-mvt-plugin-rework-plan.md) section 13, item 1.
- **Fold the `<List>` patterns guide into `docs/`.** The guide is
  [src/pixi-jsx/list-patterns.md](../../../src/pixi-jsx/list-patterns.md).
  Trigger: the JSX runtime graduates. 004 section 9, step 8.
- **`<List>` follow-ups**: a `range()` helper, a lint rule against calling
  the item accessor while building, merging the per-slot presence check into
  the item view's method, and a typed `matchOn<T>()`. Each names its trigger.
  004 section 11, items 1-4.
- **A change-gate for idle subtrees** (`refreshWhen`). Unmeasured. Trigger: an
  idle-heavy UI appears. 010 section 8, item 5.

## Acceptance Criteria

- [ ] Boids allocation fixed, or its cause measured and recorded
- [ ] Games' hot-path allocations found, and fixed or recorded
- [ ] Method-syntax members converted and `method-signature-style` enabled
- [ ] Hot path rules decision made, and `AGENTS.md` matches the docs
- [ ] Browser benchmarking and CI benchmarking each decided
- [ ] Parked items each still parked, or moved into their own task

## Progress Log

- 2026-09-26: Created from the "Open items" table in `proposals/README.md`
  when the finished proposals were archived.
