/**
 * What the last step did. A view captions it, and uses it with the model's
 * other state to show what happened.
 *
 * - `started`: a new puzzle is under way, and nothing is done yet.
 * - `grid-tried`: a whole puzzle was made and graded out of sight. If it
 *   came out at the level asked for, or the tries ran out, it is the one
 *   chosen, and its making is shown next.
 * - `seed-placed`: a random digit went into an empty cell.
 * - `search-tried`, `search-retreated`: the search put a digit in a cell,
 *   or took one out at a dead end. The phase says what the search is for.
 * - `fill-gave-up`: the search ran past its budget, so the grid is wiped.
 * - `fill-solved`: the search filled the grid.
 * - `dig-chosen`: the next cell in the dig order is up.
 * - `dig-held`: its row or column can't spare another given, so it stays.
 * - `dig-only-digit`: no other digit fits it, so it is dug out.
 * - `dig-testing`: another digit is put in it, and the search starts.
 * - `dig-test-failed`: with that digit, the puzzle has no solution.
 * - `dig-needed`: with that digit, the puzzle has a solution, so the cell
 *   stays.
 * - `dig-dug`: no other digit gave a solution, so it is dug out.
 * - `dig-enough`: the puzzle has come down to its target givens.
 * - `dig-done`: every cell has been tried.
 * - `shuffled`: one shuffle was made.
 * - `grade-marked`: the grader has pencilled in every digit that could go
 *   in each empty cell.
 * - `grade-step`: the grader took a step of reasoning.
 * - `grade-stuck`: no technique the grader knows makes progress, so the
 *   search finishes the puzzle.
 * - `finished`: the puzzle is made and graded.
 */
export type StepKind =
    | 'started'
    | 'grid-tried'
    | 'seed-placed'
    | 'search-tried'
    | 'search-retreated'
    | 'fill-gave-up'
    | 'fill-solved'
    | 'dig-chosen'
    | 'dig-held'
    | 'dig-only-digit'
    | 'dig-testing'
    | 'dig-test-failed'
    | 'dig-needed'
    | 'dig-dug'
    | 'dig-enough'
    | 'dig-done'
    | 'shuffled'
    | 'grade-marked'
    | 'grade-step'
    | 'grade-stuck'
    | 'finished';
