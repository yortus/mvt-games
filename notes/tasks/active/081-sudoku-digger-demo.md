# Sudoku Digger, a Demo of Making Sudoku Puzzles

| Field    | Value      |
| -------- | ---------- |
| Priority | medium     |
| Created  | 2026-10-30 |
| Updated  | 2026-10-30 |

## Description

A demo for the Arcade that makes Sudoku puzzles of five levels, from
Easiest to Evil, and shows each step as it happens. Its method follows a
paper from the 2008 MCM contest, "Sudoku Puzzles Generating: from Easy to
Evil" (Team #3485, <https://zhangroup.aporc.org/images/files/Paper_3485.pdf>):

1. **Seed.** Place 11 random digits that break no rule.
2. **Fill.** Solve the rest by search. If the search runs past its budget,
   wipe the grid and seed again (the paper's Las Vegas algorithm).
3. **Dig.** Visit the cells in the level's order: random for the two easiest
   levels, every other cell for Medium, an S-shaped path for Hard, and left
   to right, top to bottom for Evil. A cell is dug out only if the puzzle
   keeps enough givens, in total and in every row and column, and still has
   one solution. To check that, try each other digit in the cell, and search
   for a solution. Each cell is tried once, and a dug cell is never refilled.
4. **Shuffle.** Swap two digits everywhere, swap columns within a band,
   swap bands, and turn the grid. None of these changes how hard it is.
5. **Grade.** The paper grades a puzzle but never checks it, so this demo
   grades each finished puzzle by solving it the way a person would. It
   uses singles, hidden singles, locked candidates, pairs and triples, and
   the hardest step it needs sets the level. If logic alone gets stuck, the
   puzzle needs guesswork, and it is Evil. The grade is shown beside the
   level that was asked for, and they may differ.

Where it differs from the paper:

- The search fills the cell with the fewest choices first, not the next
  cell from the left. A check then takes tens of steps rather than
  hundreds of thousands, so each one can be watched.
- The grade comes from the logical solve, not the paper's weighted table.

Decided with the user on 2026-10-30:

- Named Sudoku Digger. "Sudoku Maker" is the name of a paid web tool that
  makes Sudoku puzzles, and of an older Linux program. "Sudoku Digger"
  found nothing as a game or a product. "Sudoku" is a trademark of Nikoli
  in Japan only, and generic elsewhere.
- Soft sound on the Audio90: ticks as digits are tried, a thud at a dead
  end, a chime when a cell is dug, a flourish when a puzzle is done.
- Built in the main checkout, uncommitted, on `vnext`.

## Acceptance Criteria

- [x] `packages/sites/arcade/src/entries/sudoku-digger/` with models, views,
      sounds and `start/`, listed in `catalogue.ts`
- [x] The model runs the algorithm one step at a time, with no wall-clock
      time and a seeded random source, and plays Step, Slow, Normal and Fast
- [x] Model tests: every puzzle has one solution and keeps its level's
      limits, the same seed gives the same puzzle, and the grader never
      places a wrong digit or rubs out a right one
- [ ] Views show each phase, with plain captions, and the controls work by
      touch and mouse (seen in visual tests; not yet played in a browser)
- [x] Sounds tested as Neon Monsoon's are: audible, unclipped, unchanged,
      and softer than -24 LUFS
- [x] Visual tests for the views, the whole-screen reference image, a
      thumbnail and a share picture
- [x] `npm run lint`, `npm run build`, `npm run test:unit` and
      `npm run test:visual` pass (three other entries' song tests time out
      under the full unit run, and pass alone)
- [x] Decide whether a puzzle that comes out easier than asked is shown as it
      is, or dug again until it matches: tried out of sight until it
      matches, decided with the user on 2026-10-30 (see below)

## Trying Puzzles Out of Sight

Each puzzle starts with a new phase, Try. One step makes and grades a whole
puzzle out of sight. The model notes its random numbers' state as each try
begins, and the first puzzle that grades at the level asked for is chosen.
The model then winds its random numbers back to that state and makes the
puzzle again, step by step, in sight, so the five phases show its making
exactly. The tried puzzles show dimmed, the counts their making leaves go
back to nothing so no sound or flash fires for them, and after 100 tries the
nearest is chosen instead.

To make every level turn up often, the levels were changed from the
paper's. Measured 2026-10-30, 60 puzzles per level, none falling back to
the nearest:

| Level | Hardest step needed | Dug (order, givens, fewest per line) | Tries: median, 90th percentile, most |
| --- | --- | --- | --- |
| Easiest | naked singles | random, 50-54, 5 | 1, 1, 1 |
| Easy | hidden singles | random, 28-31, 2 | 1, 3, 7 |
| Medium | locked candidates | snake, 24-28, 1 | 8, 28, 69 |
| Hard | any pair or triple | reading, 22-27, 0 | 9, 29, 89 |
| Evil | stuck: guesswork | random, 22-25, 0 | 2, 5, 7 |

A try takes 0.5 to 12 ms on average, and 69 ms at worst, once the search
keeps running sets of the digits each row, column and box holds, and takes a
single as soon as it finds one. Before that, puzzles dug close to the
minimum took seconds each.

## The Paper's Levels Don't Hold

Measured 2026-10-30, 25 puzzles per level at normal speed:

| Asked for | Graded | Givens | Time to make (median) |
| --- | --- | --- | --- |
| Easiest | Easiest 25 | 50-54 | 32 s |
| Easy | Easiest 25 | 37-49 | 39 s |
| Medium | Easiest 16, Easy 8, Evil 1 | 32-35 | 58 s |
| Hard | Easy 13, Easiest 4, Medium 3, Evil 5 | 28-31 | 76 s |
| Evil | Easy 19, Medium 4, Evil 2 | 23-28 | 97 s |

Every puzzle had one solution. But the paper's measures (fewer givens, fewer
in each line, a different dig order) don't make a puzzle harder to solve:
most come out Easy. The demo shows both levels, and its info text says so.
The alternative is to make puzzles silently, from a copy of the random
state, until one grades as asked, then replay that one on screen. Exact
matches for Easy are rare with 36 or more givens, so that would also need
the levels' givens ranges rethought.

## Progress Log

- 2026-10-30: Created. Read the paper, chose the name, and settled the plan
  above with the user.
- 2026-10-30: Built the entry: the step solver, the logic grader, the dig
  orders, the shuffles and the digger model; the grid, line counts, phase
  list, panel rows, buttons, captions and audio view; 14 sounds; 63 unit
  tests and 22 visual tests; the thumbnail and share picture. Measured the
  levels, above. Left: a playtest in the browser, and the decision on
  levels.
- 2026-10-30: The user chose to try puzzles out of sight until one matches.
  Added the Try phase, the replay by winding back the random numbers, two
  sounds (TRIED, CHOSEN), and new level settings, and made the search
  faster. 67 unit tests and 23 visual tests. Retook the thumbnail with the
  script's own dev server, as port 5173 was the docs-book worktree's
  server, which the script took for this checkout's (a loose end: the
  script could check the server it finds serves its own checkout). Left: a
  playtest in the browser.
