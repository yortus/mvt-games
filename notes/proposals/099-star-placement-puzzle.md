# Proposal: A Star Placement Puzzle for the Puzzles Site

> A new entry for the puzzles site. You get a square grid, n cells on a side,
> cut into n regions of irregular shape. You place stars so that every row,
> every column and every region holds exactly two, and no two stars touch,
> not even at a corner. The puzzle type is best known as Star Battle, a genre
> invented for the 2003 World Puzzle Championship, and is published by many
> people under several names. We make our own puzzles with a generator: lay
> out a valid set of stars first, grow the regions around them, then reshape
> the regions until only one answer is left. A spike found that two stars per
> line need a grid of at least 9x9 (an 8x8 has only two possible layouts,
> whatever its regions), and that a simple generator makes a 9x9 puzzle in
> about 14 ms and a 10x10 in about 200 ms. At 11x11 it is too slow as it
> stands, so the first step of the build is a faster solver, measured on a
> phone.

**Status:** spiked as a playable entry, **Stars**, at 9x9 only, with two
levels (section 10). Uncommitted. Not playtested yet.

**Written:** 2026-11-13, against `vnext` at `48b318f3`. The rules and names
come from the sources in section 2. The spike was a Node script (not in the
repo), untuned, as Minotaur's was.

**Related:**
[Minotaur](../../packages/sites/puzzles/src/entries/minotaur/) and
[Sudoku](../../packages/sites/puzzles/src/entries/sudoku/) (the models for this one),
the puzzles' [shared parts](../../packages/sites/puzzles/src/shared/index.ts),
[A Puzzle's Day and Its Way In](../../packages/sites/arcade/src/entries/README.md#a-puzzles-day-and-its-way-in),
the [originality rules](../../packages/sites/arcade/src/entries/README.md#originality),
[087](../archive/087-wall-maze-puzzle.md) (Minotaur's proposal, whose shape this follows),
[073](../tasks/backlog/073-models-take-their-random-source.md) (models take their random source).

| # | Decision or recommendation | Section |
| --- | --- | --- |
| 1 | The puzzle is a genre, like Sudoku: no `inspiredBy`, and it is fine to make our own | 2, 3 |
| 2 | Don't use "Two Not Touch" or "Queens". Named **Stars** (the user's choice, 2026-11-13) | 3 |
| 3 | Two stars in every line, as the rules above say. That makes 9x9 the smallest grid | 4.1 |
| 4 | Stars first, then regions: grow one half-region from each star, then pair neighbouring halves | 4.2 |
| 5 | Reshape regions to break a second answer, by moving a cell that is a star only in that answer | 4.3 |
| 6 | Reject puzzles that need guessing. Grade the rest by the reasoning they need, as well as by size | 5 |
| 7 | Levels 9x9, 10x10, 11x11 and 12x12, if a tuned generator is fast enough on a phone; otherwise Hard and Expert share a size and differ by reasoning | 6 |
| 8 | Tap cycles a cell through dot, star and empty. Drag paints dots. Nothing fills itself in | 7 |

## 1. The Rules

- The grid has n rows and n columns, and is cut into n regions. Each region
  is a group of cells joined side to side.
- Place stars so that every row, every column and every region holds
  exactly two.
- No two stars may touch, side to side or at a corner. So around every star
  is a ring of eight cells with no star in it.
- Every other cell is empty.
- A good puzzle has exactly one answer, found without guessing.

The number of stars per line is a parameter of the genre. One star per line
is common on small grids (5x5 to 9x9), and three or more on very large ones
(14x14 and up). This proposal uses two, as asked, and section 4.1 shows what
that means for the sizes.

## 2. What It Is Called, and Where It Came From

| Name | Where | When |
| --- | --- | --- |
| Star Battle | Created by Hans Eendebak (Netherlands) for the World Puzzle Championship in Arnhem ([GMPuzzles](https://www.gmpuzzles.com/blog/?p=350), [puzzles.wiki](https://www.puzzles.wiki/wiki/Star_Battle)) | 2003 |
| Star Battle | Krazydad, GMPuzzles, Puzzle Madness, braingle, puzzle-star-battle.com, and dozens of apps | Since |
| Two Not Touch | The New York Times, with puzzles from Krazydad ([Krazydad's blog](https://blog.krazydad.com/2020/04/20/two-not-touch-puzzles-in-the-new-york-times/)) | Since April 2020 |
| Queens | LinkedIn's daily game, the one-star version, with regions shown as colours | Since 2024 |
| Starstruck | An app by Two4tea, the one-star version | 2025 |

One site traces the idea a little further back, to Tim Peeters' "Cattle"
(1999), which also had regions and marked cells that couldn't touch. Either
way, the genre has spread widely under its first name, much as Sudoku did,
and many publishers print their own puzzles of this type. So, like Sudoku
and Minotaur, the entry should leave `inspiredBy` out, and describe the
puzzle in its details text by what it is: "a logic puzzle in which you place
stars that never touch, known elsewhere as Star Battle".

## 3. Is It Fine to Make Our Own?

Yes, within the originality rules. A puzzle's rules are an idea, and an idea
isn't anyone's to own. What does belong to someone is each published puzzle
(a particular grid and its regions), the art, and a name used as a
trademark. We copy none of them. Every puzzle comes from our generator, the
art is drawn in the views, and the name is our own. This isn't legal advice,
but it is the same footing as Sudoku, Minotaur and the rest of the puzzles
site.

The preliminary check found nothing that changes this:

- A web search found no registered mark for "Star Battle", and it found the
  name in use by many unrelated publishers and apps, as a genre's name is.
  The trademark registers (USPTO, TMview) are not yet searched.
- "Two Not Touch" is the New York Times' name for its own column, and
  "Queens" is LinkedIn's game. Neither is ours to use.

**The name.** Two ways to go:

- **Stars**: plain, says what you place, and is what many players call it.
  It follows Sudoku, whose entry is named for its genre. A word this common
  is weak as anyone's trademark for a star puzzle, but it is also hard to
  stand out with.
- **A name of our own**, as Minotaur and Rosette have. Candidates, with
  what a web search found:
  - **Starwright**: someone who makes a sky of stars, as Mazewright was a
    maker of mazes. No game by that name turned up.
  - **Asterism**: a pattern of stars that isn't a constellation, which is
    what a region is. Several small games already use it.
  - Ruled out: **Twin Stars** (Sanrio's Little Twin Stars characters),
    **Stargazer** (crowded), **Starstruck** (the app above), **Starlight**
    (a star puzzle app).

The id `stars` is used below as a stand-in. Whichever name is chosen is
searched in the trademark registers before it is adopted, as the originality
rules ask.

## 4. The Generator

### 4.1 Two stars per line need a 9x9 grid or larger

Stars that don't touch can't share any 2x2 square of cells. An n x n grid
needs 2n stars, and holds at most ceil(n/2)² stars that don't touch. That
bound rules out 6x6 (12 stars, room for 9). It allows 7x7 (14 stars, room
for 16), but the spike's search found no 7x7 layout once every row and
column must hold two. An 8x8 needs 16 stars and has room for exactly 16, so
every 2x2 square of a tiling of the grid holds one.

The spike counted every layout of stars with two per row and column and
none touching, ignoring regions:

| Grid | Layouts |
| --- | --- |
| 7x7 | 0 |
| 8x8 | 2 (mirror images of each other) |
| 9x9 | 664 |
| 10x10 | 146,510 |

So an 8x8 two-star puzzle is a trick: whatever its regions say, the answer
is one of two fixed patterns, and a player who has seen one has seen them
all. Two-star puzzles published elsewhere are mostly 10x10 (Krazydad's
are, for example). A 9x9 is tight but fair, and makes a good first level. Do not reopen 8x8 without new
information.

### 4.2 Stars first, then regions

The obvious order is to draw regions and then look for the stars. That is
the hard way round, as it was for Minotaur: most random regions have no
answer, or thousands.

The easy way round is to choose the answer first, then draw regions that
fit it:

1. **Lay out the stars.** Go row by row, choosing two columns at least two
   apart, not touching the row above, and keeping every column at two or
   fewer. A dead end backs up. The spike never needed more than a few
   milliseconds at any size.
2. **Grow half-regions.** Start one half-region at each of the 2n stars.
   Repeatedly pick a random empty cell next to a half-region and join it to
   one of its neighbours, until every cell belongs to one.
3. **Pair them.** Join each half-region to one of its neighbours, so the 2n
   halves become n regions of two stars each. This is a perfect matching on
   the halves' neighbour graph, found by a small search that always pairs
   the half with the fewest choices first.

Every region now holds exactly two stars, and the stars obey the rules, so
the puzzle has at least one answer: ours. Here is a 9x9 the spike made.
Letters are regions, and capitals are the stars:

```
c A a A a b b b b
c a d d d B b B b
C c d D d d d b b
c c c d f d D d E
i C c f F d e e e
i c c f h e E e G
i i F f H e e e g
I i i h h h g G g
i i I h h H h g g
```

### 4.3 Reshape until one answer is left

A solver counts answers, stopping at a cap (the spike used 10). If there is
more than one, take one of the others. Somewhere it has a star where ours
has none. Move that cell into a neighbouring region (so long as both regions
stay in one piece). The other answer now has one star too few in one region
and one too many in another, so it is broken, and ours, which has no star
there, still holds. Keep the change if the count didn't rise, and repeat.
After a set number of tries, start again from new stars.

The spike first moved random cells, which worked but was slow: 2.4 s per
10x10 puzzle on average. Moving a cell chosen to break another answer was
about ten times faster.

The solver works on cells, each unknown, star or empty. It applies the
rules until nothing changes, then guesses a cell both ways:

1. **Neighbours.** The eight cells around a star are empty.
2. **Full lines.** A row, column or region with two stars has no more. One
   with exactly as many unknown cells as stars still needed fills them all.
3. **Room.** A line that still needs two stars must have two unknown cells
   that don't touch. Two neighbouring rows (or columns) need four stars
   between them, and no two in neighbouring columns of the pair. These
   checks cost little and prune most of the search.

### 4.4 What it costs

Times are in Node, per finished puzzle, for 200 puzzles at 9x9, 120 at
10x10 and 40 at 11x11:

| Grid | Mean | Median | Worst | Fresh starts per puzzle |
| --- | --- | --- | --- | --- |
| 9x9 | 14 ms | 10 ms | 153 ms | 1.6 |
| 10x10 | 197 ms | 124 ms | 1.7 s | 3.9 |
| 11x11 | 3.6 s | 1.6 s | 20 s | 10.6 |
| 12x12 | over 3 minutes | | | |

At 12x12, eight puzzles hadn't finished after 25 minutes, so more than
3 minutes each. A phone may be several times slower. The cost is almost all in proving that
no second answer exists, which takes a full search. It rises steeply with
size, because the solver's rules are weak: they never use the regions
together, only one at a time. Things tried that didn't help: a lower cap
(3), more tries before starting again, and the band counting of section 5
inside the solver (stronger, but slower than the search it saved, as
written).

Two things should help, and are the first step of the build (section 9):

- **A tuned solver.** The spike copies arrays at every step and builds sets
  and closures freely. Rows as bit masks, with each cell's neighbours as a
  precomputed mask, make the rules a few bit operations each.
- **Generating by logic instead of counting.** If the reasoning solver of
  section 5 finishes the puzzle, the answer is unique, with no search to
  prove it. Reshape regions until it does, scored by how many cells it
  leaves unknown. The spike tried this, and it worked, but its reasoning
  solver was slower still (0.4 s at 9x9, 2.1 s at 10x10), so it needs the
  same tuning.

If neither gets 11x11 under about 100 ms at worst on a phone, the levels
change (section 6), or the puzzle is made off the frame and lands between
frames, as a load does. That is allowed by the rules (Critical Rule 1), but
it means a "making the puzzle" state that the other puzzles don't have.

## 5. How Hard Is It?

The spike graded each unique puzzle by the reasoning a solver needs to
finish it, trying the easier kinds first:

- **Basic**: the neighbours and full lines rules of section 4.3.
- **Bands**: counting. If k regions lie wholly inside k neighbouring rows,
  those rows' 2k stars are all in those regions, so the rest of the rows is
  empty. If k neighbouring rows are wholly covered by k regions, those
  regions have no stars outside the rows. The same for columns.
- **One look ahead**: "a star here would leave this region, or this pair of
  rows, without room". Each candidate star is tried with the basic rules and
  the room checks, and a contradiction makes it empty. Players call much of
  this the 2x2 rule: a pair of rows needing four stars, and only four 2x2
  squares with room, means one star in each.
- **Deeper look ahead**: the same, with the bands rules inside the try.
- **Search**: none of the above finishes it, so it needs guessing.

| Grid | Basic | Bands | One look ahead | Deeper look ahead | Search |
| --- | --- | --- | --- | --- | --- |
| 9x9 | 0% | 0% | 55% | 21% | 25% |
| 10x10 | 0% | 0% | 44% | 22% | 34% |
| 11x11 | 0% | 0% | 35% | 33% | 33% |

No puzzle fell to the basic rules or counting alone. The 2x2 reasoning of
"one look ahead" is the backbone of every two-star puzzle. So the
walkthrough must teach it (section 7).

Size alone is a fair grade here, since the share needing deeper reasoning
rises with size. But a level should also say what reasoning it allows, as
Minotaur's do: rejecting puzzles that need search costs a quarter to a third
of the attempts, and an easy level can insist on "one look ahead" at the
cost of half.

This grading is a first cut. A better one counts how many hard steps a
puzzle takes, not only the hardest kind, and names the steps the way
players do (2x2 squares, bands, regions squeezed into a line). Building it
well is part of the solver work in section 9.

## 6. Levels

Every puzzle has the site's four levels. Suggested, if the tuned generator
is fast enough:

| Level | Grid | Reasoning | Cell size on the 540-wide screen |
| --- | --- | --- | --- |
| Easy | 9x9 | One look ahead | about 56 px |
| Medium | 10x10 | One look ahead | about 50 px |
| Hard | 11x11 | Deeper look ahead | about 46 px |
| Expert | 12x12 | Deeper look ahead | about 42 px |

On a phone 390 points wide, a 12x12 cell is about 30 points, small but
tappable, and dragging dots helps (section 7). The screen stays 540 by 768,
like the other puzzles.

If 11x11 or 12x12 stays too slow, the fallback is 9x9, 10x10, 10x10 and
11x11, with Hard and Expert told apart by reasoning. Another option is an
Easy level with one star per line on a 6x6 or 7x7, which is very gentle,
but changes the rules between levels.

## 7. Playing It

What the player marks are cells: a star, a dot (a cell they know is empty),
or nothing. Experienced solvers mark far more dots than stars.

- **Tap** a cell to cycle it: empty, dot, star, empty. Dots come first
  because they come first in solving, as in LinkedIn's Queens.
- **Drag** to paint dots over empty cells. A drag that starts on a dot rubs
  dots out instead, as Minotaur's drags rub out their own marks.
- **No automatic fill.** Placing a star doesn't dot its neighbours, as
  Minotaur fills nothing in. This could be a setting later (section 8).
- **Help the eye.** Stars that touch, and a row, column or region with
  three stars, show in red. A line with its two stars goes quiet.
- **Regions** drawn as thick lines between cells, on the puzzles' paper,
  with an optional soft tint per region.
- **Solved** when every line has two stars and none touch. Since the puzzle
  has one answer, checking the rules is the same as checking the answer.
- **Undo**, and saves kept in the browser, with the shared daily records and
  calendar.
- **The way in.** The shared How to play card, and a walkthrough on a
  practice puzzle. Since 9x9 is the smallest two-star grid, the practice
  puzzle is a 9x9 with most stars already placed, and the walkthrough takes
  the player through the last few: a full line, the ring around a star, and
  one 2x2 squeeze.

## 8. Open Questions

1. ~~**The name.**~~ Stars, the user's choice.
2. **Levels.** The sizes of section 6, or the fallback? And is a one-star
   Easy level wanted, or should every level keep two stars?
3. ~~**12x12.**~~ Measured: over 3 minutes a puzzle with the spike's
   code (section 4.4). Out of reach without a much better generator.
4. **Region tints.** Thick borders only, as in print, or a soft colour per
   region, as LinkedIn's Queens does? Tints help on a phone, but need ten to
   twelve colours that stay distinct in every theme and for colour blind
   players.
5. **Automatic dots.** Leave them all to the player (recommended, as in
   Minotaur), or offer a setting?
6. **Region shapes.** The half-region growth makes blobby regions of two
   cells and up. Should a level limit how small or how stringy a region may
   be? Small regions make puzzles easier.

## 9. Building It

Where it goes: `packages/sites/puzzles/src/entries/<id>/`, like Minotaur.

**Models** (pure, unit tested):

- The grid's geometry: cells, rows, columns, each cell's neighbours as masks.
- The star layout maker and the region maker, from a random source passed
  in.
- The solver: the rules of section 4.3, the counting search, and the
  reasoning grades of section 5.
- The puzzle maker: lays out, grows, reshapes and grades until a puzzle fits
  the level.
- The puzzle the player is solving: marks, undo, clashes, solved, saves.
- The game: which puzzle is open, the levels and the shared daily records.

**Views**: the board (grid, regions, stars, dots, clashes), the tap and drag
gestures as a view model, the walkthrough's practice board, the audio view
(a few soft Audio90 effects, levelled by loudness beside the other puzzles'),
and the shared calendar and card.

**Tests**:

- The layout counts of section 4.1 (0, 2, 664 at 7x7, 8x8 and 9x9) are exact,
  and make a strong test of the layout maker's rules.
- The solver against brute force: every answer it reports breaks no rule,
  and on small sampled 9x9s its count matches a search over all 664 layouts.
- Seeds give the same puzzle every time, pinned like Minotaur's
  `find-puzzle-seed.test.ts`.
- Every level's puzzles are graded at their level, as a slow test.
- Visual tests for each view, a thumbnail, and a share picture.

**Steps:**

1. Settle the open questions (section 8), and search the chosen name.
2. The tuned solver and generator, measured in Node and on a phone. Settle
   the levels from what they measure.
3. The puzzle maker and levels, with seeds pinned.
4. The puzzle model: marks, undo, clashes, solved, saves.
5. The board and its gestures, then the rest of the views and the
   walkthrough.
6. Entry files, catalogue, details text, sound, thumbnail.
7. Playtest in a browser, on a phone and with a mouse.

## 10. Progress

- 2026-11-13: Proposed, with the preliminary originality check (sections 2
  and 3) and the spike (sections 4 and 5).
- 2026-11-13: The user named it **Stars**, and asked for a playable 9x9
  spike. Built in `packages/sites/puzzles/src/entries/stars/`, after
  Minotaur, and listed in the catalogue:
  - **Levels.** Two, both 9x9: Easy (one look ahead) and Medium (deep
    look ahead). Hard and Expert wait for bigger grids. Every level has
    its seed already, so adding them changes no puzzle.
  - **The maker**, as in section 4, on typed arrays: stars first,
    half-regions paired, cells moved to break other solutions, then
    graded. Counting bands once per call, not once per band, and emptying
    every cell one look finds rather than restarting after each, made
    grading four times faster. In Node: Easy 62 ms on average (worst
    330 ms), Medium 168 ms (worst about 1 s). Tried and dropped: band
    counting inside the solution counter (no faster), the look ahead
    inside it (5x slower), and reshaping by logic (7-16x slower). So
    opening a Medium puzzle can stall a phone for a few seconds, which is
    the first thing to fix.
  - **Playing**, as in section 7: a tap cycles none, dot, star; a drag
    dots empty cells, eight-way, or rubs dots out if it starts on one.
    Stars that touch, or crowd a line, show red. Regions are washed with
    soft tints, no two neighbours alike, and drawn round in ink. Undo,
    saves, the shared calendar, the How to play card over a solved puzzle,
    and a five-step walkthrough (dot, star, drag, undo, done). Six soft
    Audio90 effects of its own, not yet levelled by loudness.
  - **Tests**: the maker (unit sample and an 80-puzzle slow test, each
    checked for one solution and its grade), the puzzle model, the
    walkthrough, 7 visual tests, the whole-screen image, a thumbnail and
    share picture. The puzzles site's card wall picture was not retaken.
