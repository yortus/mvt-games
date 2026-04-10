# Review: Kwazy Cactii Game Code

| Field    | Value      |
| -------- | ---------- |
| Priority | medium     |
| Created  | 2026-04-10 |
| Updated  | 2026-04-10 |

## Description

Code review of the Kwazy Cactii match-3 game module (`src/games/cactii/`),
performed using the project's
[code review skill](docs/ai-agents/skill-code-review.md) checklist.

**Overall impression:** Well-structured module. Architecture compliance is
strong - clean model/view separation, proper view model extraction for complex
presentation state, correct use of bindings and change detection. The findings
below are all refinements rather than fundamental issues.

## Findings

### 1. MVT Architecture Compliance

**H2 - Per-tick linear scan in `getCellAlpha`** (Medium)

In `pieces-view-model.ts`, `getCellAlpha` calls
`options.getMatchedCells().indexOf(cell)` for every cell every frame. On an 8x8
grid that is 64 `indexOf` lookups per frame, each scanning up to ~64 matched
cells. During the match phase this is O(cells x matchedCells).

**How to fix:** Pre-compute a `Set` or `Uint8Array` lookup of matched cell
indices once per frame in `update()`, then check membership in O(1). A flat
`Uint8Array(rowCount * colCount)` flagging matched positions avoids per-tick
allocation while keeping it H2-compliant.

**B3 - `onSwapRequested` binding is non-optional** (Low)

`BoardViewBindings` and `PiecesViewBindings` declare `onSwapRequested` as
required. Rule B3 says `on*` bindings should usually be optional, to allow the
view to be used in contexts where that input is ignored (e.g. a passive replay
viewer or storybook story).

**How to fix:** Make it optional: `onSwapRequested?(origin, target): boolean`
and guard the call site in the view model.

### 2. Software Engineering Principles

**Non-injectable randomness in `board-model.ts`** (Medium)

`randomKind()` uses `Math.random()` directly. This makes the board
non-deterministic and harder to test. Tests like "swap produces a match" rely on
`findSwappablePair()` to probe the random initial state, which is fragile - no
test can control or reproduce a specific board layout.

**How to fix:** Accept an optional `random: () => number` in
`BoardModelOptions` (defaulting to `Math.random`). Tests can then supply a
seeded PRNG for reproducible scenarios.

**Misleading name `phaseEndTime`** (Low)

In `board-model.ts`, `phaseEndTime` stores the phase *duration* in seconds, not
an end timestamp. `phaseDurationSec` would better convey what it holds and its
unit.

**How to fix:** Rename to `phaseDurationSec`.

**`EMPTY_CELL` sentinel has a real `kind`** (Low)

`EMPTY_CELL` is typed as `CactusCell` with `kind: 'astrophytum'`. Checked by
identity (`=== EMPTY_CELL`) so the kind value is harmless, but semantically
misleading if anyone accidentally reads `EMPTY_CELL.kind`. A JSDoc warning on
the sentinel would make the contract clearer.

### 3. MVT Patterns and Practices

All positive - well-applied patterns:

- **Advance-then-orchestrate:** `board-model.ts` advances `phaseElapsed`, then
  dispatches via `phaseFinishers[boardPhase]()`.
- **Delegation:** `GameModel.update()` delegates to `board.update(deltaMs)`.
- **Presentation state extraction:** Drag/swap/settle/match visual logic is
  properly extracted into `PiecesViewModel` with its own tests. The match
  sequence is created in `board-view.ts` and distributed via bindings - no child
  holds a reference to siblings.
- **Change detection:** `watch()` used appropriately for infrequent changes
  (kind, score, phase, grid size). Cheap per-frame reads (position, alpha) done
  directly.
- **Domain coordinates:** Models expose `row`/`col`. Views compute pixel
  positions via `gridX()`/`gridY()`.

### 4. Code Style

**Internal boolean `gameOver` lacks `is` prefix** (Low)

In `board-model.ts`, the private variable is `let gameOver = false` while the
public accessor is `isGameOver`. The style guide mandates `is`/`has`/`can` for
booleans.

**How to fix:** Rename the internal variable to `isGameOver`.

**Missing JSDoc on `PiecesViewModel` methods** (Low)

`PiecesViewModel` documents `dragOriginCell` but not `getCellX`, `getCellY`,
`getCellAlpha`, `startDrag`, `dragTo`, or `endDrag`. These are the public
contract and their semantics would benefit from brief JSDoc.

**`DUST_POOL_SIZE = 16` may be insufficient** (Low)

`match-effects-view.ts` pre-allocates 16 dust sprites. A single match phase
can contain many cells (e.g. two intersecting 5-runs or cascade chains). On an
8x8 board with cascading matches this could exceed 16. If 16 is a deliberate
quality cap, a comment would help.

## Summary Table

| Priority | Finding | Location |
| -------- | ------- | -------- |
| Medium | Per-tick `indexOf` scan in `getCellAlpha` | pieces-view-model.ts |
| Medium | Non-injectable `Math.random()` hampers test control | board-model.ts |
| Low | `phaseEndTime` stores a duration, not an end time | board-model.ts |
| Low | `onSwapRequested` binding should be optional (B3) | board-view.ts, pieces-view.ts |
| Low | Internal `gameOver` variable lacks `is` prefix | board-model.ts |
| Low | Missing JSDoc on `PiecesViewModel` public methods | pieces-view-model.ts |
| Low | `DUST_POOL_SIZE` cap undocumented | match-effects-view.ts |
| Low | `EMPTY_CELL` sentinel has a real `kind` value | common.ts |

## Acceptance Criteria

- [ ] Medium findings addressed (getCellAlpha scan, injectable randomness)
- [ ] Low findings triaged (fix or explicitly defer with rationale)
- [ ] `npx vitest run` passes after changes
- [ ] `npm run lint` passes after changes

## Progress Log

- 2026-04-10: Review completed and task created.
