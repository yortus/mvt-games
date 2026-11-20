# The Puzzles' Game Model, Undo and Seeds, in Shared

| Field    | Value      |
| -------- | ---------- |
| Priority | low        |
| Created  | 2026-11-20 |
| Updated  | 2026-11-20 |

## Description

Found in a review of Boats and River, the puzzles from
[104](../../proposals/104-fleet-and-track-puzzles.md).

Each of the six daily puzzles keeps its own copy of three models. The
copies are almost the same, apart from the puzzle's own names.

| File | Copies | Lines each |
| --- | --- | --- |
| `models/game-model.ts` | Boats, Minotaur, River, Rosette, Stars, Sudoku | 163 to 170 |
| `models/undo-history.ts` | Boats, River and Stars match. Minotaur's and Sudoku's differ | 45, 89, 102 |
| `models/find-puzzle-seed.ts` | all six | 20 to 22 |

So a fix to how a puzzle keeps its progress, restarts or plays its
walkthrough has to be made six times. Each new puzzle copies the files
again.

Every entry was kept self-contained on purpose, so this is worth doing only
if the shared version stays as easy to read as one copy is now. The
puzzles already share their calendar, records and way in, in
`packages/sites/puzzles/src/shared/models/`, so that is the natural home.

## Acceptance Criteria

- [ ] `createUndoHistory` is in `shared/models/`, and the puzzles whose
      copies match use it. Minotaur's and Sudoku's either use it too, or
      the reason they differ is written down.
- [ ] `findPuzzleSeed` is in `shared/models/`, with each puzzle's own game
      id passed in. Each puzzle's pinned seeds test still passes unchanged,
      so every player keeps their progress.
- [ ] A shared daily-puzzle game model, made from the puzzle's game id,
      levels, puzzle maker, puzzle model and walkthrough, replaces the six
      `game-model.ts` copies. If one puzzle needs more than the others, it
      wraps the shared model rather than copying it.
- [ ] Each puzzle's `game-model.test.ts` shrinks to what is its own, and
      the shared model has the tests the copies had in common.
- [ ] [Adding an Entry](../../../packages/sites/arcade/src/entries/README.md#a-puzzles-day-and-its-way-in)
      says to use the shared models.

## Progress Log

- 2026-11-20: Written, from the Boats and River review.
