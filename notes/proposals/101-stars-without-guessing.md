# Proposal: Stars without guessing

> Every Stars puzzle should be solvable on paper by looking, never by
> supposing. Today's grader calls a puzzle fair if it falls to "looking
> ahead": place a star in your head, follow the rules, and see whether
> something breaks. That is guessing and backing up, done tidily, and it is
> what the player found themselves doing. This proposal grades with direct
> techniques only, the patterns a solver reads off the board as it stands,
> and makes every puzzle fair by construction: the maker grows regions
> round a layout of stars, then places a few **givens** (stars or dots
> printed on the grid) until the direct techniques finish the puzzle, and
> drops every given they can do without. A probe found that a 9x9 puzzle
> needs about 2 to 3 givens, and is made in about 20 ms, against 60 to
> 170 ms today. The slow step, proving a puzzle has one answer, goes away,
> since a puzzle the direct techniques finish can only have one. Even
> 12x12 is made in under a third of a second.

**Status:** built, uncommitted (section 9): steps 1 to 3, as one step,
since the grader, the maker and the levels couldn't land apart without
leaving Expert unfair. Left: timings on a phone, and a playtest.

**Written:** 2026-11-17, against `vnext` at `fdd3fbb8`, with Easy and
Medium already one star a line and the ring for groups in place (099,
section 10). Revised the same day at the user's word: no hints, and
consider givens. The probes were Vitest files beside the Stars models, not
kept in the repo. Times are in Node.

**Related:**
[099](./099-star-placement-puzzle.md) (Stars' proposal),
[the solver](../../packages/sites/puzzles/src/entries/stars/models/star-solver.ts),
[the puzzle maker](../../packages/sites/puzzles/src/entries/stars/models/star-puzzle.ts),
[the levels](../../packages/sites/puzzles/src/entries/stars/models/levels.ts).

| # | Decision or recommendation | Section |
| --- | --- | --- |
| 1 | A fair step reads the board as it stands. Supposing a star and following what it causes is guessing, however tidy | 2 |
| 2 | No hints (the user's call) | 2 |
| 3 | Grade with named direct techniques only: neighbours, full lines, bands, pressure and 2x2 boxes | 3, 5.1 |
| 4 | Make puzzles with givens: grow regions, add givens until the direct techniques finish, then drop the ones not needed | 4.2, 5.2 |
| 5 | Drop the reshaping and the solution counter. A puzzle the direct techniques finish has one answer | 5.2 |
| 6 | Levels by grid and by the hardest technique a puzzle needs, with or without givens. Expert can be 10x10 or more again | 5.4 |
| 7 | Givens may be stars or dots, as each puzzle needs (the user's call) | 5.3, 7 |

## 1. The Problem

The player's playtest, 2026-11-17: "I rely on long chains of speculation
and backtracking to slowly rule in or out positions. On a paper version I
would expect to never be required to basically guess, and keep going, and
then backtrack. There should always be enough clues to progress the puzzle
without guessing."

The grader agrees with the player's experience, once you read it closely.
It solves in this order, and grades by the hardest step it needed
(`star-solver.ts`, `grade`):

1. The rules: neighbours, full lines, exact fits.
2. Bands: k regions inside k rows, or k rows covered by k regions.
3. **Look ahead**: for each open cell, suppose it holds a star, apply the
   rules until they settle, and if a row, column or region runs out of
   room, the cell is empty.
4. **Deep look ahead**: the same, with bands counted inside the
   supposition too.

Steps 3 and 4 never branch, so the grader called them "no guessing". But a
player can't apply the rules until they settle in their head across a
whole grid. They write the supposed star in, follow it, and rub it all out
when it fails. That is the chain of speculation and backtracking. Hard
puzzles need step 3 somewhere, and Expert puzzles need step 4.

## 2. What Counts as Fair

A fair step reads the board as it stands and concludes something about a
cell directly. It can look at a few cells together, as long as there is
nothing to follow afterwards.

The line is drawn here, and the user drew it: do not reopen without new
information.

- **Fair:** "this cell touches every open cell left in the green region, so
  a star here would leave green with none, so it is empty". The star's
  effect is only its own ring of eight cells, which you can see. Nothing
  is followed.
- **Not fair:** "suppose this cell is a star. Then this row is full, so
  that cell is empty, so that region must use this cell, which touches...".
  That is a chain, and a chain is a guess followed through.

**No hints.** The user doesn't want a Hint button. Settled; the grader
need not keep its steps for showing.

## 3. Direct Techniques

Each is a pattern players use and can name. The first three are what Easy
and Medium already use.

1. **Neighbours.** The eight cells round a star are empty.
2. **Full lines.** A row, column or region with all its stars has no
   more. One with only as many open cells as stars it still needs has a
   star in each.
3. **Bands.** If k regions lie wholly inside k rows side by side, those
   rows' stars are all theirs, so the rest of the rows is empty. If k rows
   are wholly covered by k regions, those regions have no stars outside
   the rows. The same for columns.
4. **Pressure.** A star at a cell would empty only its own ring of eight.
   If that would leave some row, column or region without room for the
   stars it still needs, the cell is empty. "Room" for two stars means two
   open cells that don't touch.
5. **2x2 boxes.** Two rows side by side need four stars (two stars a line),
   and a 2x2 box can hold at most one. Cover the rows' open cells with
   boxes, left to right. If it takes exactly four, each box holds exactly
   one star: a box with one open cell has its star, and a cell outside a box
   that touches every open cell left in it is empty. The same for columns.

Later, if puzzles need fewer givens or Expert needs a step up:

6. **Boxes in regions, and in wider bands.** A region that needs two stars
   and whose open cells fit in two boxes has a star in each. Three rows
   needing six stars, covered by six boxes, the same.
7. **Bands with pressure.** A cell whose ring would leave a band of k
   rows unable to hold its regions' stars.

## 4. Measured

### 4.1 Filtering today's puzzles

The first probe ran techniques 3 to 5 (with 1 and 2 always on) on puzzles
from today's maker, at each grade it serves, with no givens:

| Puzzles | Count | Bands | Bands, pressure | Bands, boxes | All three |
| --- | --- | --- | --- | --- | --- |
| Hard today: 9x9, one look ahead | 80 | 0% | 39% | 10% | 53% |
| Expert today: 9x9, deep look ahead | 40 | 0% | 0% | 0% | 0% |
| 10x10, one look ahead | 20 | 0% | 5% | 0% | 5% |

So filtering alone would serve a fair Hard (at 2.5 times today's cost),
but no fair Expert at all. That matches the playtest exactly.

### 4.2 Givens

A given is a cell printed on the grid at the start: a star where the
solution has one, or a dot where it has none. The second probe added
givens until techniques 1 to 5 finished the puzzle, picking each among the
cells the techniques had left open, then took each given away in turn and
put it back only if the techniques could no longer finish without it.

**Today's Expert puzzles** need just one given each, always a star, to
become fair: 15 of 15, even with bands and pressure alone.

**Regions as grown**, with no reshaping, so the puzzle on its own may have
many answers. Picks at random; "stars" means only stars may be given:

| Grid | Givens | Mean | Range | Needs boxes | Needs pressure, not boxes | Made in, mean | Worst |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 9x9 (60) | stars or dots | 2.8 | 0-6 | 32% | 68% | 23 ms | 66 ms |
| 9x9 (60) | stars | 2.1 | 0-4 | 18% | 80% | 11 ms | 18 ms |
| 10x10 (30) | stars or dots | 5.7 | 2-9 | 50% | 50% | 55 ms | 91 ms |
| 11x11 (20) | stars or dots | 8.5 | 5-13 | 35% | 65% | 119 ms | 165 ms |
| 12x12 (12) | stars or dots | 11.8 | 8-17 | 25% | 67% | 182 ms | 314 ms |
| 12x12 (12) | stars | 8.7 | 6-13 | 0% | 92% | 53 ms | 62 ms |

The times include laying out the stars and growing the regions: they are
the whole cost of a puzzle. For comparison, today's maker takes 60 ms on
average at 9x9 for Hard (worst 330 ms), 170 ms for Expert (worst about
1 s), 3.6 s at 11x11 (worst 20 s), and more than 3 minutes at 12x12.

Picking each given greedily, the one that leaves fewest cells open, gave
fewer givens (2.0 at 9x9, against 2.8 at random) at about 6 times the
cost.

What this says:

- **Givens make every puzzle fair by construction**, at every size tried.
- **They remove the slow step.** No reshaping, no counting of solutions,
  and no long tail: the worst case is close to the mean.
- **The givens are few at 9x9**, two or three cells of 81, and grow with
  the grid: about 12 of 144 cells at 12x12.
- **Difficulty is still there.** A third of 9x9 puzzles with givens still
  need 2x2 boxes, and half at 10x10. At 9x9 and 10x10, every one needs
  pressure or boxes; at 12x12, 8% need only bands.

## 5. The Design

### 5.1 The grader

`grade` applies the direct techniques in order, easiest first, and records
the hardest one it needed. It never supposes. A puzzle it finishes has
exactly one solution, since every step was forced. Look ahead and deep
look ahead are deleted.

### 5.2 The maker

From a seed, as now, so every player gets the same puzzle on a day:

1. Lay out the stars, and grow regions round them (as now).
2. Run the direct techniques, from the givens so far.
3. While cells are left open, give one of them, picked at random, its
   value in the solution, and run them again.
4. Take each given away, in a random order, and put it back only if the
   techniques can't finish without it. What is left is irreducible: every
   given is needed, though another set might be smaller.
5. Keep the puzzle if it needs the level's hardest technique (section
   5.4). Otherwise start again.

The reshaping loop and `countSolutions` go. They were most of the code's
cost and all of its long tail.

A few random tries of steps 3 and 4, keeping the fewest givens, would sit
between random picks and greedy ones, if fewer givens matter more than
time. Worth measuring once it is built.

### 5.3 Stars, dots, or both

Each has a cost. A given star rules out its ring of eight at once, so it
gives away more, but fewer are needed: 2.1 against 2.8 at 9x9, and at
12x12 with stars only, no puzzle needed boxes. A given dot says less,
looks quieter, and leaves more for the player to find, but more are
needed. Allowing both lets each puzzle use whichever its gap needs.

Recommendation: both, and let a level prefer one (section 7).

### 5.4 The levels

A level asks for its hardest technique at least once, so a harder level is
harder in kind as well as in size.

| Level | Grid | Stars a line | Techniques, hardest needed | Givens |
| --- | --- | --- | --- | --- |
| Easy | 6x6 | 1 | Neighbours, full lines, bands | As needed, often none |
| Medium | 8x8 | 1 | Neighbours, full lines, bands | As needed |
| Hard | 9x9 | 2 | + pressure | About 2 to 3 |
| Expert | 10x10 | 2 | + 2x2 boxes | About 6 |

Easy and Medium are already fair, but moving them onto the same maker
leaves one way to make a puzzle, and drops the counter for them too.

Expert at 10x10 brings back what the user first asked for, grid size
following difficulty, now that the size no longer costs seconds. It needs
boxes in half of all tries, so about 110 ms a puzzle. At 9x9 needing
boxes it would be about 70 ms.

Every day's puzzles change when this lands, so progress kept is dropped,
as the save checks the puzzle. Stars is a beta, so that is acceptable, but
it should land before it loses the label.

### 5.5 Showing the givens

A given is printed in ink, a star or a dot, darker than the player's pen
and pencil, so it reads as part of the puzzle. A tap on it does nothing,
and undo never takes it away. The puzzle's description, which a save is
checked against, includes the givens. A drag may still ring a group
through a given, since it is only a note.

## 6. Tests

- Each technique on small hand-made positions, with what it should
  conclude, and a position where it must not fire.
- **Soundness, over many puzzles:** run each technique alone, step by
  step, on puzzles with known solutions, and check it never empties a
  solution's star or stars an empty cell. One check over collected
  results, as a slow test.
- Every level's puzzles, over many seeds: the techniques finish them from
  their givens, every given is needed, and the level's hardest technique
  is needed. A slow test.
- Seeds still give the same puzzle, pinned.
- The timing of each level in Node, written into this proposal, and on a
  phone.

## 7. Questions, Answered

The user answered these on 2026-11-17:

1. **Givens are stars and dots**, either, as each puzzle needs.
2. **Expert is 10x10**, needing 2x2 boxes.
3. **How few givens:** as recommended, a few random tries of steps 3 and
   4, keeping the fewest givens.
4. **No one-cell regions.** One-star grids whose regions include a
   one-cell region are grown again.

## 8. Steps

1. ~~Techniques 4 and 5 in the solver, with their tests and the soundness
   test. Grade by technique, and delete look ahead.~~ Done.
2. ~~The maker with givens (5.2), the givens in the puzzle and its save, and
   drawn in ink (5.5). Delete the reshaping and the counter.~~ Done.
3. ~~The levels of 5.4, with timings in Node~~ and on a phone. Node done.
4. If Expert wants a step up, or givens are too many, techniques 6 and 7.

## 9. Progress

- 2026-11-17: Built, as steps 1 to 3 together.
  - **The solver** (`star-solver.ts`) knows only the direct techniques,
    `rules`, `bands`, `pressure` and `boxes`, and solves from givens up to
    a level's hardest, reporting the hardest it needed. Look ahead, deep
    look ahead, the reshaping and `countSolutions` are gone. A search
    counter lives on as test support, sharing nothing with the solver, to
    check each puzzle's one solution independently.
  - **The maker** (`star-puzzle.ts`, `find-givens.ts`) lays out stars,
    grows regions, finds givens three times at random (each pick among the
    cells left open, then each given dropped if not needed), keeps the
    fewest, and starts again if the level's hardest technique isn't
    needed. One-star grids with a one-cell region are grown again.
  - **Levels**: Easy 6x6 one star, up to bands, not required; Medium 8x8
    one star, bands required (so it is harder in kind than Easy, a choice
    made in the build); Hard 9x9 two stars, pressure required; Expert
    10x10 two stars, boxes required.
  - **Measured** in Node, 60 puzzles a level:

    | Level | Givens, mean | Range | Stars among them | Made in, mean | Worst |
    | --- | --- | --- | --- | --- | --- |
    | Easy | 1.9 | 0-4 | 76% | 0.9 ms | 3 ms |
    | Medium | 4.6 | 2-13 | 46% | 5 ms | 16 ms |
    | Hard | 2.2 | 0-4 | 62% | 16 ms | 29 ms |
    | Expert | 6.0 | 2-11 | 48% | 61 ms | 161 ms |

    Medium's top end, 13 givens on 64 cells, is the one to watch in a
    playtest: asking every Medium puzzle to need bands may be what costs
    it.
  - **Givens** start as marks, can't be changed or undone, are drawn in
    ink (a star, or a slightly bigger dot), and are part of the puzzle's
    description, which a save is checked against. Every day's puzzles
    changed, so progress kept is dropped again.
  - **Tests**: every level's puzzles, two seeds each in the unit test and
    30 in a slow test, checked for one solution by the independent
    counter, finished from their givens by the level's techniques, needing
    the hardest if asked, with every given needed. A slow soundness test
    runs each technique on 600 grown grids from part of a known solution,
    and checks it never contradicts it, and that each technique makes
    progress the ones before can't. A puzzle model test for givens. The
    How to play card, the details text, the showcase and every image were
    updated; the thumbnail and share picture were retaken.
- 2026-11-20: Second playtest: "single stars are way too easy and make the
  experience inconsistent", and "sometimes I feel like there's still trial
  and backtracking involved".
  - **Trial and error, checked.** No technique branches or follows a
    chain. But on 40 daily puzzles at each of Hard and Expert, the easy
    techniques stalled about 4 times a puzzle, each time needing
    pressure, which is a one-step supposition: picture a star and its
    ring. Over half of pressure's finds were the subtle form (a line
    needing two stars whose open cells left all touch). And at about one
    stall in ten, only one cell on the whole board could be found, a
    needle in a haystack that invites trying cells.
  - **The user's calls:** keep pressure's "room for two" form; and
    wherever the rules stall, there must be at least two cells to find.
    The solver now runs each technique allowed from the same board,
    easiest first, until they have found two cells between them, and
    counts fewer as stuck, so the maker prints a given there. It costs
    about half a given a puzzle.
  - **Two stars a line at every level.** 7x7 can't hold them (two rows
    side by side need four stars, and a 2x2 box holds one), so 8x8 is the
    smallest. Easy 8x8, up to bands, not required; Medium 8x8, pressure
    required; Hard 9x9, pressure required; Expert 10x10, boxes required.
    The example and practice puzzles are 8x8 too.
  - **Measured** in Node, 60 puzzles a level:

    | Level | Givens, mean | Range | Stars among them | Made in, mean | Worst |
    | --- | --- | --- | --- | --- | --- |
    | Easy | 2.8 | 1-4 | 77% | 2 ms | 6 ms |
    | Medium | 0.2 | 0-2 | 57% | 2 ms | 8 ms |
    | Hard | 2.4 | 1-4 | 69% | 17 ms | 31 ms |
    | Expert | 5.9 | 0-11 | 49% | 74 ms | 276 ms |

    Easy prints more givens than Medium, since it has fewer techniques to
    finish with. Every day's puzzles changed again.
  - **One star a line is gone from the code**, at the user's word: two
    stars a line is a fixed rule (`STARS_PER_LINE`, beside the grid), not
    a setting of the grid or the levels, and the one-star branch of region
    growing and its one-cell-region check are deleted. No puzzle changed.
