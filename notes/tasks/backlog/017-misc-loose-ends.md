# Miscellaneous Loose Ends

| Field    | Value      |
| -------- | ---------- |
| Priority | medium     |
| Created  | 2026-09-26 |
| Updated  | 2026-09-27 |

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

- ~~**Boids allocates about 360 KB per frame**~~ Done 2026-09-26: now about
  34 bytes, and about one collection a minute. Five causes, measured one at a
  time: the view redrawing every boid into one `Graphics` (about 270 KB; now
  a pooled `Graphics` per boid over a shared `GraphicsContext`), the sliders
  redrawing unchanged (about 50 KB; now gated on change), getters on the boid
  record making the model's writes box numbers (about 34 KB; now plain
  fields), a `random()` function called per boid (3.2 KB; now an inline
  generator over a `Uint32Array`), and Pixi's `rotation` setter (3.2 KB;
  boids are now turned with `skew`). The model still takes about
  0.5 ms per frame comparing every pair of boids.
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

### Investigate

- **Fractional numbers boxed depending on unrelated code.** Twice, writing a
  fractional number cost a 16-byte heap allocation that a standalone copy of
  the same code did not. V8 stores whole numbers up to about a billion
  without allocating, but can box a fractional number when it stores or
  passes one, and here whether it does depends on code nearby.
  - **Boids, `rotation`.** Setting `rotation` on the boids' pooled `Graphics`
    allocated 16 bytes per boid per frame, even when the value was unchanged,
    so the cost was in the call. 200 fresh `Graphics`, parented or not, with
    the whole app loaded or not, allocated nothing. Worked around by turning
    the boids with `skew` (see `boids-view.ts`).
  - **The `memory` suite's synced scene, fractional values.** With the `jsx`
    approach, the model's own `x += step` and `y += step` writes allocate
    about 32 bytes per changed item (32 KB per frame for 1000). With
    `hand-written`, nothing. It is not the JSX runtime: it stays with the view
    refresh removed, with static-only JSX, and with no JSX at all (closures
    over each item and a plain `Container`), but goes when the `jsx` approach
    runs the hand-written view code. A tidier standalone copy of the JSX setup
    allocates nothing. Reproduce with
    [`benchmarks/repro/fractional-boxing.ts`](../../../benchmarks/repro/fractional-boxing.ts)
    (`jsx` 32 KB per frame, `hand-written` 0, one per process; run both in one
    process and both allocate). Kept out of the suite until explained, so it
    is not read as a JSX cost.
  - **A clue from the attempt to add it to the suite.** Giving the synced
    scene a `values` option, with whole and fractional rules in two object
    literals of the same shape, made even the whole-number runs store boxed
    numbers: memory kept per container rose by about 48 bytes (three boxed
    numbers), and the "wasteful" approach's garbage from 97 to 161 KB per
    frame. Reading `step` and `offset` from an object whose fields also held
    fractions turned whole numbers fractional as far as V8 was concerned. The
    option was removed and the scene restored.
  - **Ruled out** (do not reopen without new information): hidden-class
    variety (all 200 boid `Graphics` share one map), field widening
    (`--trace-generalization` shows none for the fields involved), and, for
    the synced scene, deoptimisation (`--trace-deopt` shows none; its
    `changeItems` is optimised by TurboFan once, in both approaches, and stays
    so). The sampling heap profiler, with collected objects included,
    attributes the allocations to `refreshBoids` for boids, and to the synced
    scene's `frame`, which calls `changeItems`.
  - **Next steps.** Compare the optimised code of the allocating and the
    non-allocating versions (`--print-opt-code`, or Turbolizer with
    `--trace-turbo`), or ask on the V8 issue tracker with the synced-scene
    reproducer. If it proves to be something code can avoid, record the rule
    on the Hot Paths page.
- **Related, fixed:** the JSX runtime's watched props boxed fractional
  `width` and `height` values every frame (16 bytes per element), changed or
  not, because their last value lived in a closure variable that started as
  a symbol. They now use a `Float64Array` (see `FRACTIONAL_WATCHED_PROPS` in
  `src/pixi-jsx/jsx-runtime.ts`), guarded by the `memory` suite's
  `allocation-watched` table.

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

- [x] Boids allocation fixed, or its cause measured and recorded
- [ ] Games' hot-path allocations found, and fixed or recorded
- [ ] Method-syntax members converted and `method-signature-style` enabled
- [ ] Hot path rules decision made, and `AGENTS.md` matches the docs
- [ ] Browser benchmarking and CI benchmarking each decided
- [ ] Fractional-number boxing explained, and fixed or recorded as a rule
- [ ] Parked items each still parked, or moved into their own task

## Progress Log

- 2026-09-26: Created from the "Open items" table in `proposals/README.md`
  when the finished proposals were archived.
- 2026-09-26: Boids allocation fixed (361 KB to 34 bytes per frame); see the
  Fix item.
- 2026-09-27: Added the unexplained fractional-number boxing (Investigate),
  and fixed the related boxing in the JSX runtime's watched props.
