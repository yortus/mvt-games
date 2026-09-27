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
- **The games allocate on the hot path.** International Karate about 800
  bytes per frame, unexplored. Fixed so far, 2026-09-27:
  - Scramble, 2.7 KB to about 270 bytes, by 018's pilot migration; the likely
    causes were graphics redrawn every frame (each explosion, and the fuel
    bar while fuel drains), now scaled or resized instead.
  - Pac-Man, 2.1 KB to about 235 bytes. Measured first: 1.9 KB of it was the
    model, not the views. Pac-Man and the four ghosts each started a GSAP
    tween, and a `set`, for every one-tile step. Their moves are now a
    `TileMove` (`src/games/pacman/models/tile-move.ts`, with tests): a
    straight slide advanced by `update(deltaMs)` that allocates nothing, with
    the same semantics (linear, starting from wherever the actor is, and no
    time carried from one move to the next). The model now allocates nothing
    per frame.

  To split a game's allocation between its update and its refresh, the
  `games-and-demos` case file's `frame` can be made to skip one of the two;
  that is how Pac-Man's was found.
- ~~**Function members in types still use method syntax**~~ Done 2026-09-27,
  as part of 018's migrations: none are left, and `method-signature-style` is
  enforced on every TypeScript file. The variance errors expected below did
  not appear. Originally: method syntax in 537 places across
  120 files (about 310 in the games) as of 2026-09-26, against the style guide's
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
- ~~**Views that read a query binding's getter only once.**~~ Done
  2026-09-27, by 018's migrations. Each declared a query binding as a
  function but read it only at construction, which rule
  [V-reactive](../../../docs/architecture/rules.md#view-rules) forbids. Found
  by two sweeps (the second also caught reads inside constructor arguments):
  the overlay view's size; six Scramble views' sizes; Kwazy Cactii's
  `matchSequence` in five views; and, borderline, the asteroid view's radius
  and size, re-read only when its shape seed changed. All but the last are
  now fixed answers; the asteroid view now watches all three. Checked and
  live: the touch input, cabinet, cactus, and Dig Dug and Galaga enemy
  views.

- ~~**The overlay times its release with `requestAnimationFrame`.**~~ Done
  2026-09-27. It waited two animation frames before relaying
  `onRestartPressed(false)`, so that a model polling for the press would see
  it: wall-clock timing in a view. Now the release waits for the overlay's
  own `update(deltaMs)` step instead, which runs after the model's update in
  the same frame, so the model always sees the press first (with tests). The
  model-side fix suggested here was not taken: it would change seven games'
  input for restart alone, while every other button has the same race. See
  Decide.

- ~~**The cabinet view's zoom transitions play by themselves.**~~ Done
  2026-09-27. Its GSAP timelines are now paused and advanced by the view's
  `update(deltaMs)`, which `main.ts` now runs (`updateScene` over the
  cabinet view each tick; before, only game sessions ran it). Each timeline
  renders at time 0 when built, so its first frame shows every tween's start
  values. The carousel's eased scroll, which moved a fixed share of the way
  per refresh, so ran faster at higher frame rates, and in `refresh()`, now
  also advances in `update(deltaMs)`, scaled to match the old speed at
  60fps.

- **An interrupted `npm run bench -- all --save` empties every results
  file.** Stopping one partway through (2026-09-27, during its first suite)
  rewrote all nine `benchmarks/results/*.md` and `.json` files with their
  headers but no tables, removing about 4,000 lines; they were restored from
  git. A save should write only the suites that finished, or write nothing
  until the run is complete. Until then, save one suite at a time
  (`npm run bench -- <suite> --save`).

### Decide

- **Button presses shorter than a frame are missed.** The games' models see
  input by polling a pressed flag in their update, so a press and release
  that both arrive between two updates leave no trace. Real presses almost
  always last longer than a frame, and the overlay now guards its own
  (see Fix). A general fix would have each game's player input latch a
  press until the model has seen it. Worth it only if short presses turn out
  to be a problem in practice.

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
- [x] Method-syntax members converted and `method-signature-style` enabled
- [x] Views that read a getter only once fixed (V-reactive)
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
- 2026-09-27: Added the views that read a query binding's getter only once
  (Fix), found by sweeping the views for V-reactive violations after the
  architecture bindings page was rewritten in terms of query and relay
  bindings.
- 2026-09-27: 018's Scramble pilot fixed Scramble's six read-once views,
  three of which the first sweep had missed. Scramble's method-syntax members
  were converted in the same pass, and `method-signature-style` is enforced
  there. Scramble also now allocates about 270 bytes per frame, down from
  2.7 KB (see the hot-path allocation item).
- 2026-09-27: 018's migration of `common/` fixed the overlay's read-once
  size and converted `common/`'s method syntax; added the overlay's
  `requestAnimationFrame` item (Fix).
- 2026-09-27: 018's remaining migrations (demos, cabinet, six games)
  finished the read-once views and the method syntax, both now done. Added
  the cabinet's self-playing zoom transitions (Fix).
- 2026-09-27: Fixed Pac-Man's allocation (a model cause, not a view one), the
  overlay's `requestAnimationFrame` release, and the cabinet's self-playing
  transitions. Added the short-press question (Decide).
