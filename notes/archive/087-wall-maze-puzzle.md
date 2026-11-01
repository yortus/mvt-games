# Proposal: A Wall Maze Puzzle for the Puzzles Site

> A new entry for the puzzles site. You get an empty grid with a start cell
> and an end cell, and numbers along the top and left edges. Each number is
> the length of a stretch of wall on one grid line. You draw the maze those
> numbers describe. Its single passage must run from start to end through
> every cell. The puzzle type is known as Build a Maze, Labyrinth or Missing
> Labyrinth. We make our own puzzles with a generator: draw a random path that
> visits every cell, read the clues off its walls, and keep the puzzle only
> if a solver finds exactly one solution. A spike measured that 92-96% of
> random paths give one solution at every size from 5x5 to 15x15, in
> milliseconds, so throwing a puzzle away and drawing another is cheap.

**Status:** implemented as Minotaur (`packages/sites/puzzles/src/entries/minotaur/`),
with the open questions answered (section 9). Playtested by the user,
2026-11-01, and finished. Its rules card later became the shared way in, in
task 088.

**Written:** 2026-11-01. The rules come from the sources in section 2. The
spike was a Node script (not in the repo), and it was checked against brute
force on 4x4, 5x5 and 5x6.

**Related:** [Sudoku](../../packages/sites/puzzles/src/entries/sudoku/), whose daily
calendar, records and seeds this could share.
[081](../tasks/active/081-sudoku-digger-demo.md) and
[082](../tasks/active/082-sudoku-daily-game.md). The
[originality rules](../../packages/sites/arcade/src/entries/README.md#originality).
[073](../tasks/backlog/073-models-take-their-random-source.md) (models take their
random source).

| # | Decision or recommendation | Section |
| --- | --- | --- |
| 1 | The puzzle is a genre, like Sudoku: no `inspiredBy`, and it is fine to make our own | 2, 3 |
| 2 | Don't call it Labyrinth. Pick our own name (Mazewright is a candidate) | 3 |
| 3 | The maze *is* the path: walls are every edge the path doesn't cross, so generation draws a path, not a maze | 4.1 |
| 4 | Start and end come from the path's ends, not chosen first | 4.2 |
| 5 | Random paths by backbite moves, then the clues, then a solver that counts up to two solutions | 4.2-4.4 |
| 6 | Reject puzzles that need guessing. Grade the rest by the reasoning they need, as well as by size | 4.5, 5 |
| 7 | All of it runs at once, in the model, seeded. No worker or precomputed puzzles | 4.6 |
| 8 | The player marks edges as wall or passage. Drawing the passage is the main control | 6 |

## 1. The Rules

The grid has R rows and C columns. Two cells are marked: S (start) and E
(end), anywhere in the grid.

- Every edge between two cells is either a **wall** or a **passage**. The
  outer border is all wall.
- The passages form a single path from S to E that visits every cell once.
  So S and E are dead ends, every other cell has exactly two passages, and
  there are no branches, crossings or loops.
- Each internal grid line has a clue: the lengths of its stretches of wall,
  in order, read top to bottom on vertical lines and left to right on
  horizontal lines. Stretches are separated by at least one passage, as in
  a nonogram (a paint-by-numbers puzzle). A line with no wall shows 0.
- The clues sit on the grid lines, not on the cells. An 8x8 grid has seven
  clues along the top and seven down the left. The outer border has none.
- A good puzzle has exactly one solution, found without guessing.

## 2. What It Is Called, and Where It Came From

| Name | Where | When |
| --- | --- | --- |
| Labyrinth | *Mehr als Sudoku*, a German puzzle magazine ([blog post](https://laboratorium.net/archive/2007/05/28/mehr_als_sudoku)) | Before May 2007 |
| Build a Maze | Credited to Riad Khanmagomedov (Russia), at the 10th 24-Hour Puzzle Championship ([WPC unofficial wiki](https://wpcunofficial.miraheze.org/wiki/Build_a_Maze)) | 2009 |
| Missing Labyrinth | An alias on the same wiki page | |
| Labyrinth | Puzzler Media's name for it, in the UK (same wiki page) | |
| Labyrinth | [naughtynathan.co.uk](https://www.naughtynathan.co.uk/?cat=11), with puzzles first printed in *Sudoku Xtra* | |

The origin is unclear. The wiki credits an inventor and dates the puzzle to
2009, but the 2007 blog post describes the same rules from a German magazine
two years earlier. The wiki may mean the puzzle's first contest. Several
other, unrelated puzzles are also called Labyrinth.

So we can't name one inventor with confidence, and the puzzle has spread
like a genre. Like Sudoku, the entry should leave `inspiredBy` out. It
should describe the puzzle in its details text by what it is: "a logic
puzzle in which you build a maze from clues on its walls, known elsewhere as
Build a Maze or Labyrinth".

## 3. Is It Fine to Make Our Own?

Yes, within the originality rules. A puzzle's rules are an idea, and many
publishers print their own puzzles of this type under different names. What
belongs to someone is each published puzzle (a particular grid and its
clues), the art, and a name used as a trademark. We copy none of them. Every
puzzle comes from our generator, the art is drawn in the views, and the name
is our own. This isn't legal advice, but it is the same footing as Sudoku
and nonograms, and the same footing the rest of the puzzles site stands on.

**The name.** "Labyrinth" is not ours to use. It is the English title of
Ravensburger's board game, it is a famous film, and it is Puzzler Media's
name for this exact puzzle. The originality rules ask for our own title,
searched as a game and in the trademark registers before it is adopted.
Candidates:

- **Mazewright**: a maker of mazes, which is what the player is. A web search
  found no game by that name. The trademark registers are not yet searched.
- **One Way Through**: says the rule. Longer.
- **Wallwork**: short, but says less.

## 4. The Generator

### 4.1 The maze is the path

The rules make the maze and the path the same thing. Every edge is either
crossed by the path or a wall, so once the path is known, every wall is
known. A maze generator (one that grows branching corridors) would make
branches, which the rules forbid. What we need is a random path that visits
every cell once: a *Hamiltonian path* on the grid. The walls are everything
it doesn't cross.

### 4.2 Draw a random path

The obvious order is to choose S and E first and then build a maze between
them. That is the hard way round. Finding a random path
between two fixed cells that visits every cell is a search, and some pairs
have no such path at all (on a 4x4, two cells of the same chessboard colour
never do).

The easy way round is to draw the path first and let its ends be S and E.
**Backbite moves** do this (M. L. Mansfield, *Unbiased sampling of lattice
Hamilton path ensembles*, J. Chem. Phys., 2006):

1. Start from a snake that runs back and forth across the rows.
2. Pick one end of the path, and one of the four directions from it. If
   that goes off the grid, or onto the cell next to it in the path, do
   nothing.
3. Otherwise, the neighbour is somewhere along the path. Join the end to
   it, and cut the path just before the neighbour. Reversing the piece that
   came loose makes it a path again, with a new end.
4. Repeat. The spike made 60 moves per cell.

Choosing among four directions, with off-grid choices wasted, matters.
The spike first chose among the end cell's real neighbours, which favours
ends at corners and edges. Its counts then disagreed with brute force. With
four directions, they agree (section 4.4).

If we want rules for where S and E may be (say, not side by side), keep
making moves until the ends qualify.

### 4.3 Read the clues

For each internal grid line, walk its edges and record each stretch of
walls. Done.

### 4.4 Check for exactly one solution

A solver works on edges, each one unknown, wall or passage. It applies
three rules until none changes anything:

1. **Lines.** Each grid line is a nonogram line, so we use a nonogram
   line solver. It finds every way to place the clue's stretches that agrees
   with the edges known so far. An edge that is a wall in every way is a
   wall, and one that is a passage in every way is a passage.
2. **Cells.** S and E need one passage, every other cell two. When a cell
   has all it needs, the rest of its edges are walls. When it has only just
   enough edges left, they are all passages.
3. **No loops.** An unknown edge between two cells already joined by
   passages would close a loop, so it is a wall. An edge that would join
   S's piece to E's piece before every cell is on it is a wall too.

When the rules stop, it guesses an unknown edge both ways and searches,
stopping at a second solution.

The spike checked this against brute force. It listed every path on small
grids and grouped them by their start, end and clues:

| Grid | Paths | One solution (brute force) | One solution (spike's sample) |
| --- | --- | --- | --- |
| 4x4 | 552 | 100% | 100% |
| 5x5 | 8,648 | 92.4% | 91.9% (3,000 sampled) |
| 5x6 | 53,992 | 94.3% | 94.7% (3,000 sampled) |

### 4.5 How hard is it?

The same spike also asked how much reasoning each unique puzzle needs:

- **Rules alone**: the three rules above, with no guessing.
- **Trying an edge**: for each unknown edge, try one value. If the rules then
  find a contradiction, the edge must have the other value. Repeat. Good
  solvers do this as "if this were a wall, that cell would be stuck".

| Grid | Paths | One solution | ...by rules alone | ...needing tries | Time per attempt |
| --- | --- | --- | --- | --- | --- |
| 6x6 | 1,000 | 95.2% | 94% of those | not measured | 0.4 ms |
| 7x7 | 1,000 | 96.4% | 95% | not measured | 0.6 ms |
| 8x8 | 300 | 91.7% | 92% | the other 8% | 0.9 ms |
| 10x10 | 150 | 96.0% | 79% | the other 21% | 2.1 ms |
| 12x12 | 80 | 95.0% | 46% | the other 54% | 4.7 ms |
| 15x15 | 40 | 95.0% | 13% | the other 87% | 11.3 ms |

(Times are in Node, for drawing the path, solving, and grading. A phone may
be several times slower.)

Every unique puzzle up to 15x15 in the sample was solved by trying edges, so
no sampled puzzle needed real guessing. A generator that rejects guessing
loses almost nothing.

Size alone is a weak grade: a 12x12 is about as likely to fall to the rules
alone as to need tries. So a level should say both its size and the
reasoning it needs. A hard level can insist on puzzles that need tries,
which, at 12x12, throws away about half the paths. That is still cheap.

### 4.6 Where it runs

Making a puzzle takes milliseconds, and the spike's code wasn't tuned (it
copies arrays on every move). So the model makes the puzzle when it needs
one, from a seed, with no worker and no puzzles made ahead of time. The
random source is passed in, as 073 asks, so a seed always gives the same
puzzle.

One thing to check when it is built: whether 60 moves per cell mix the path
well at the largest size. The brute-force match shows they do at 5x6. A
test can compare the length of straight runs against a much longer chain,
so no trace of the starting snake is left.

## 5. Levels

Suggested levels. These are open (section 8):

| Level | Grid | Reasoning |
| --- | --- | --- |
| Easy | 5x5 | Rules alone |
| Medium | 7x7 | Rules alone |
| Hard | 9x9 | Needs tries |
| Expert | 11x11 | Needs tries |

The screen sets a ceiling. Sudoku's screen is 540 by 768. A line of length
L can have up to L/2 stretches, so its clue can hold up to L/2 numbers. With
room for clues, an 11x11 grid has cells of about 36 pixels, which is fine
for dragging a path but small for tapping an edge. A portrait screen would
also suit tall grids (such as 9x12) better than square ones.

## 6. Playing It

What the player marks are edges, as in the solver: wall, passage, or not
yet known. Experienced solvers mark both, and the puzzle is solved when
every edge is marked to match.

- **Draw the passage.** Drag from cell to cell, and each step marks the
  edge between them as passage. Dragging back along it takes it out. This
  is the main control, and it works at small cell sizes.
- **Mark walls.** Either a Wall tool, so that a drag marks the edges it
  crosses as walls, or a tap on an edge. A tool is easier on a phone (as
  Sudoku found with its Notes tool).
- **Help the eye.** A clue goes dim when its line's walls match it, as in
  nonograms. Each cell's marks fill in for it where they must (a cell with
  its two passages has walls elsewhere). This automatic fill could be a
  setting.
- **Solved.** When the passage runs from S to E through every cell, the
  remaining edges are walls, and the puzzle is solved. Since it has one
  solution, checking the rules is the same as checking the answer.
- **Undo**, and saves kept in the browser, as in Sudoku.

## 7. Building It

Where it goes: `packages/sites/puzzles/src/entries/<id>/`, like Sudoku.

**Models** (pure, unit tested):

- The grid's geometry: cells, edges, the grid lines and their edges.
- The path maker: backbite moves, from a random source passed in.
- Clues from a path.
- The solver: the line solver, the cell and loop rules, the counting
  search, and the grading (rules alone, or tries).
- The puzzle maker: draws, solves and grades until a puzzle fits the level.
- The puzzle the player is solving: edge marks, undo, the clues' state,
  solved or not, saves.
- The game: which puzzle is open, the levels, records. If it is daily, it
  shares Sudoku's day numbers and calendar (section 8).

**Views**: the board (grid, clues, S and E, walls, passages), the drag
gestures as a view model, the tools, the audio view (a few soft Audio90
effects, like Sudoku's), and the calendar or level picker.

**Tests**:

- The solver against brute force: every path on a 4x4 has one solution,
  and 7,992 of the 8,648 on a 5x5 do. These counts are exact, so they make
  a strong test.
- Seeds give the same puzzle every time, pinned like Sudoku's
  `find-puzzle-seed.test.ts`.
- Every level's puzzles are graded at their level.
- Visual tests for each view, a thumbnail, and a share picture.

**Steps:**

1. Settle the open questions (section 8), and search the chosen name.
2. Geometry, path maker, clues and solver, with the brute-force tests.
3. The puzzle maker and levels, with seeds pinned.
4. The puzzle model: marks, undo, solved, saves.
5. The board and its gestures, then the rest of the views.
6. Entry files, catalogue, details text, sound, thumbnail.
7. Playtest in a browser, on a phone and with a mouse.

A later, separate idea: a demo that shows the generator at work, as Sudoku
Digger does for Sudoku. Backbite moves make a lively animation.

## 8. Open Questions

1. **The name.** Mazewright, another candidate, or one of yours?
2. **Daily or endless?** A puzzle a day at each level, with Sudoku's
   calendar, or a New Puzzle button? Daily play would move Sudoku's day
   numbers and calendar somewhere both entries can share.
3. **Levels.** The sizes and reasoning in section 5, and square grids or
   portrait ones?
4. **Walls.** A Wall tool, a tap on an edge, or both?
5. **Automatic fill.** Should the board fill in the edges a cell's marks
   force, or leave all of it to the player?
6. **Where S and E go.** Anywhere, or never side by side, or never on the
   border (as in the puzzles on naughtynathan.co.uk)?

## 9. Progress

- 2026-11-01: The user answered section 8. The name: Minotaur first, but the
  title is crowded (Bungie's *Minotaur: The Labyrinths of Crete*, *Minotaur
  Maze* on Steam, and *MINOS*, a 2026 maze-building game in which you are the
  Minotaur), so **Mazewright**, the user's fallback. **Daily**, with the
  daily parts shared, as every puzzle on the site will have them. The levels
  of section 5, square. The controls as recommended, with Sudoku as the
  model. **No automatic fill.** S and E **anywhere**.
- 2026-11-01: Built.
  - **Shared daily parts.** `packages/sites/puzzles/src/daily/` holds what
    Sudoku had for its calendar, made generic over a game's levels: day
    numbers, `createDailyRecords` (keys under `mvt-arcade:<game id>:`, so
    Sudoku's players keep their progress), `createDailyCalendar`, and
    `CalendarView`, `DayView`, `ButtonView`, the paper palette and
    `writeDate`. `SudokuModel` now has a `calendar` and a `puzzleLevel`.
    Every Sudoku image is unchanged.
  - **The generator**, as in section 4: backbite paths, the clues, and a
    solver of rules (a nonogram line pattern, cells, no loops), tries and
    search. Its counts match brute force on every path of a 4x4 and a 5x5
    (a test). A level takes only puzzles of its own reasoning, so Hard and
    Expert always need tries. Making a puzzle takes 0.4 ms on average at
    Easy and 8 ms at Expert, 43 ms at worst in 100 seeds (Node). Two days'
    puzzles are pinned in `find-puzzle-seed.test.ts`.
  - **Playing.** Two tools, Path and Wall, plus Undo and Rules. A path drag
    marks passages between the cells it passes through the middle of; a
    wall drag marks walls along the lines between the corners it passes; a
    tap marks the side of a cell it is near; going back over a stroke's own
    marks takes them back, and a drag that starts on a mark rubs marks out.
    Each drag or tap is one undo. Nothing fills itself in, but a clue fades
    once the walls on its line match it, and turns red when they can't fit;
    a cell turns red with too many passages, too many walls, or on a loop.
    Solved, every wall is drawn and the maze glows.
  - **Rules** in place of Sudoku's walk-through tutorial: a card with a
    small solved maze, shown the first time a puzzle opens, and again from
    Rules.
  - Six soft Audio90 effects, levelled by loudness beside Sudoku's: a
    pencil tick per passage, climbing a pentatonic scale through a stroke,
    a wall's knock, an eraser's brush, a clash, undo and a solved chime.
  - 62 tests in the entry (51 unit, 11 visual), plus the daily parts' own
    (12 unit, 17 visual, most moved from Sudoku), the whole-screen image, a
    thumbnail and share picture, and the puzzles' card wall again.
- 2026-11-01: Two changes at the user's word.
  - **No tools.** Where a drag starts says what it draws: nearer the middle
    of a cell than any corner, the path; nearer a corner, walls. A tap
    only rubs out: the wall or the passage nearest it, among the sides of
    the cell it is in, measured to the wall's line or the path's. The drag
    that rubbed out marks went. Dragging back over a stroke's own marks
    still takes them back. The Path and Wall buttons are gone, leaving
    Undo and Rules.
  - **Renamed Minotaur.** The user reopened the name: a figure from myth
    that many games use is nobody's to own. No registered MINOTAUR mark
    for video games turned up (only Konami's MINOTAUR'S TREASURE, for
    gambling machines), so it is the entry's name. The folder, id, store
    keys (`mvt-arcade:minotaur:`), types and images were all renamed;
    nothing had shipped, so no player loses progress.
- 2026-11-01: The user playtested Minotaur and found it excellent. Finished,
  and archived. Its rules card became the shared way in for every puzzle, in
  task 088, and `src/daily/` became `src/shared/`.
