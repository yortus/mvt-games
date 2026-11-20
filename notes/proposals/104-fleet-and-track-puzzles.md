# Proposal: Two Line-Count Puzzles for the Puzzles Site

> Two new entries for the puzzles site. Both are well-known grid puzzles
> with a number beside every row and column. In the first, you find a fleet
> of straight ships, 1 to 4 cells long, hidden in a grid. Each number says
> how many cells of its row or column hold part of a ship. Ships never
> touch, not even diagonally. The puzzle is best known as Battleship
> Solitaire, and was invented in Argentina in 1982. In the second, you lay
> one track from an entrance on one edge of the grid to an exit on another.
> Each number says how many cells of its row or column the track passes
> through. The track never crosses itself. This puzzle is best known as
> Train Tracks, and its origin is less certain. Both are genres, like Sudoku
> and Stars. So it is fine to make our own, as long as the names, art and
> puzzles are ours. This proposal suggests a fresh theme for each. One is a
> harbour of moored boats (**Moorings**), and the other a river winding to
> the sea (**Meander**). Both are made fair by construction, the way 101
> and 102 did for Stars and Minotaur. A solver uses direct techniques only,
> and the maker adds givens until it finishes.

**Status:** built, awaiting review and a playtest. Both entries,
**Boats** and **River** (first named Moorings and Meander), were built on 2026-11-20 in the
`line-puzzles` worktree, and left uncommitted (section 15). The names
still need searching in the trademark registers.

**Written:** 2026-11-20, against `vnext` at `bf528841`. The history comes
from the sources linked in sections 2 and 8. The names were checked by web
searches only. The trademark registers (USPTO, TMview) are not yet searched.

**Related:**
[Stars](../../packages/sites/puzzles/src/entries/stars/) and
[Minotaur](../../packages/sites/puzzles/src/entries/minotaur/) (the models for both),
the puzzles' [shared parts](../../packages/sites/puzzles/src/shared/index.ts),
[A Puzzle's Day and Its Way In](../../packages/sites/arcade/src/entries/README.md#a-puzzles-day-and-its-way-in),
the [originality rules](../../packages/sites/arcade/src/entries/README.md#originality),
[099](../archive/099-star-placement-puzzle.md) (Stars' proposal, whose shape this follows),
[101](../archive/101-stars-without-guessing.md) (direct techniques and givens),
[102](./102-minotaur-without-guessing.md) (the same for Minotaur).

| # | Decision or recommendation | Section |
| --- | --- | --- |
| 1 | Both puzzles are genres: leave out `inspiredBy`, and make our own | 3, 8 |
| 2 | Don't use "Battleship(s)" (Hasbro's mark), "Bimaru" or "Yubotu" | 3 |
| 3 | Don't use "Tracks" or "Train Tracks" either. They are probably free, but the originality rules ask for a title of our own | 8 |
| 4 | Fresh themes: boats moored in a harbour, and a river winding from a spring to the sea | 4, 10 |
| 5 | Names: **Moorings** and **Meander** (suggested; the user's choice) | 4, 10 |
| 6 | Every puzzle is fair by construction: lay out the answer, then add givens until a direct-technique solver finishes, then drop the givens it can do without | 5, 11 |
| 7 | Straight ships only, as in the classic. Shaped ships stay an open question | 1, 13 |
| 8 | The river is drawn by dragging through cells, with Minotaur's stroke, and fields are crossed out with a tap | 12 |
| 9 | Build Moorings first. It is the simpler solver, and the river's generator needs a spike | 14 |
| 10 | Make both beautiful: rich colours and cute cell symbols, such as little boats on blue sparkling water, and a river through a green flowery meadow (the user's wish, 2026-11-20) | 4, 10, 12 |

## Part I: The Fleet Puzzle

## 1. The Rules

- The grid has n rows and n columns. A fleet is listed beside it, such as
  one ship of 4 cells, two of 3, three of 2 and four of 1.
- Every ship is a straight line of cells, across or down. Place every ship
  of the fleet in the grid.
- Ships never touch, side to side or diagonally. Every cell around a ship
  is water.
- The number beside each row and column is how many of its cells hold part
  of a ship.
- Some cells may be given at the start: water, or a ship's part. A given
  part shows its shape: a whole one-cell ship, an end (which says which way
  the ship goes), or a middle.
- A good puzzle has exactly one answer, found without guessing.

The classic grid is 10x10 with the fleet above: one 4, two 3s, three 2s
and four 1s, 20 cells in all
([Wikipedia](https://en.wikipedia.org/wiki/Battleship_(puzzle))).
Publishers vary the grid and the fleet freely, and some use ships of other
shapes (bent, or Tetris-like). This proposal keeps straight ships, which
are what most players know, and leaves shaped ships as an open question
(section 13).

## 2. What It Is Called, and Where It Came From

| Name | Where | When |
| --- | --- | --- |
| Batalla Naval | Created by Jaime Poniachik with the editors of the Argentine magazine *Humor & Juegos* (Eduardo Abel Gimenez, Jorge Varlotta and Daniel Samoilovich) ([Wikipedia](https://en.wikipedia.org/wiki/Battleship_(puzzle)), [puzzles.wiki](https://www.puzzles.wiki/wiki/Battleship_(logic_puzzle))) | 1982 |
| Batalla Naval | *Juegos Para Gente De Mente*, then monthly in *Enigmas Lógicos* | From 1987 |
| Battleships | The first World Puzzle Championship, New York | 1992 |
| Battleship, Battleships | *Games* magazine, still a regular feature, then GMPuzzles, Conceptis, Krazydad, puzzleduel and many apps ([GMPuzzles](https://www.gmpuzzles.com/blog/?p=634)) | From 1993 |
| Bimaru | German-speaking countries, from a Swiss publisher (bimaru.ch); one source calls it a trademarked name | Since |
| Yubotu, Battleship Solitaire, Solitaire Battleships | Various | Since |

The puzzle borrows its look from the two-player pencil and paper game,
played since the early 20th century and sold as a board game, *Battleship*,
by Milton Bradley from 1967 and by Hasbro since 1984. The two games share a
grid and a fleet. They don't share a rule: the board game is guessing
shots, and the puzzle is pure logic.

One site credits Moshe Rubin with the puzzle. The other sources don't, and
Rubin is known for an early Windows version, *Fathom It!* (1997), so that
credit looks mistaken.

## 3. Is It Fine to Make Our Own?

Yes, within the originality rules, on the same footing as Sudoku, Minotaur
and Stars. This isn't legal advice, but the position is well settled:

- **The rules are an idea, and ideas aren't owned.** The US Copyright
  Office puts it plainly: copyright "does not extend to the idea for a
  game, its name or title, or the method or methods for playing it"
  ([FL 108, Games](https://www.copyright.gov/fls/fl108.pdf)). Courts in
  Europe and the UK take the same line on functionality.
- **A patent can't stand in the way.** The puzzle dates from 1982 and has
  been published by dozens of people since. Any patent would have expired
  long ago, and a search didn't turn one up.
- **What is owned, we don't copy.** Each published puzzle (a particular
  grid, fleet and clues) belongs to whoever made it, as does the art and
  any name used as a trademark. Every puzzle of ours comes from our
  generator, the art is drawn in the views, and the name is our own. Tests
  and walkthroughs use our own puzzles too, never one transcribed from a
  book or a site.

**The names to avoid.**

- **Battleship** is Hasbro's trademark for games, in several filings
  across the years (board, card, handheld and computer games). Some have
  lapsed, and a new one for entertainment was filed in July 2025. The plural,
  "Battleships", is used as the genre's name by many puzzle publishers, but
  it is close enough to Hasbro's mark that we shouldn't use it.
- **Bimaru** is one publisher's name for the puzzle, and may be a
  registered mark. **Yubotu** is likewise one publisher's.

So the entry leaves `inspiredBy` out, since the puzzle is a genre, not one
game, and describes itself in its details text as "a logic puzzle known
elsewhere as Battleship Solitaire". Naming the genre that way, in prose, is
how Sudoku, Minotaur and Stars do it, and is the descriptive use that the
originality rules allow.

## 4. A Fresh Theme: Moorings

The puzzle is usually dressed as a naval battle, which suits the board game
but not the puzzle. The puzzle doesn't fight a battle. It is a careful
search. A calmer
theme fits better, and explains the rules rather than borrowing them.

**A harbour from above.** The grid is a harbour, and the fleet is a day's
boats, each tied to its mooring. Boats keep clear of each other, so that
they can swing with the tide without bumping. That is why boats never
touch, not even corner to corner. The harbourmaster's numbers along the edges say
how many cells of each row and column hold a boat. You place the boats.

- The fleet by length: a dinghy (1), a skiff (2), a yacht (3) and a ferry
  (4), drawn as hulls seen from above, with a pointed bow at one end and a
  square stern at the other. Given ends still say only "an end", since
  which end is the bow is cosmetic: the view picks.
- Water is a soft ripple mark, so the player's "known water" reads as
  calm sea, not as a cross.
- The fleet list sits below the grid, one hull per boat, and a boat ticks
  off when a finished boat of its length is on the grid.

**The look.** The harbour should be a pleasure to look at, not a sheet of
graph paper. The water is a clear, sparkling blue, with small glints that
come and go. The boats are cute little hulls in cheerful colours, each
length its own colour, perhaps with a tiny cabin or mast, and a soft shadow
on the water. Section 12 says what both looks have in common.

**Moorings** is the suggested name. A web search didn't find a game by
that name. The closest are mooring games such as *Ship Mooring*, a docking game,
and *Lighthouse: Sail And Moor*. Other candidates:

- **Harbour**: plain, but very common.
- **Sonar**: a wreck dive, finding sunken wrecks on the sea floor from a
  sonar sweep along each row and column. A good fit for the numbers, but a
  common word in game titles.
- Ruled out: **Fathom** (*Fathom It!*, above), anything with "battle",
  "fleet" or "navy" in it, which keeps the war theme.

## 5. The Generator

The order that works for Stars and Minotaur works here: choose the answer
first, then make the clues fit it. Sketched, not spiked.

1. **Place the fleet.** Largest ship first, each at a random place and
   direction where it doesn't touch a ship already placed. A dead end starts
   again; at the classic density (20 cells in 100) that should be rare.
2. **Read the numbers** off the rows and columns.
3. **Add givens.** Run the solver of section 6. Where it stalls, give one
   cell from the answer, chosen among the cells still unknown, and run it
   again. Prefer water and ship's parts as each puzzle needs them, as Stars
   lets its givens be stars or crosses (101 section 5.3).
4. **Drop the givens it can do without**, in repeated passes, as Stars'
   maker does since 101: take each given away, and keep it away if the
   solver still finishes.

A puzzle that the solver finishes has one answer, because every step the
solver takes is forced. So the slow step of 099, counting answers to prove
there is only one, is never needed.

## 6. Solving Without Guessing

The solver works on cells, each unknown, water or ship, plus the shape of
each given part. It applies these direct techniques, each read off the
board as it stands, easiest first, and grades a puzzle by the hardest it
needed:

- **Diagonals.** The four cells diagonally beside any ship cell are water.
  This is the backbone of the puzzle: two ships can't touch at a corner,
  and one ship never turns.
- **Full lines.** A row or column with all its ship cells found is water
  elsewhere. One with exactly as many unknown cells as ship cells still
  needed is ship in all of them.
- **Shapes.** A given one-cell ship is ringed by water. A given end has a
  ship cell beyond it and water on its other three sides. A given middle
  has ship cells on two opposite sides; at the grid's edge, or beside known
  water, that says which two.
- **Finished boats.** A straight run of ship cells with water or the edge
  at both ends is a finished boat, and the cells beside it are water.
- **The fleet count.** Once every boat of a length is found, any run that
  would make another one is capped with water. And a run already longer
  than the boats still to place can't stay that length.
- **Where the big ones fit.** List the places the largest boat still to
  place could go, given the water so far and the room each line's number
  leaves. If there is one, it goes there. If every place covers a cell, that
  cell is ship. Players do this with the battleship first: it is reading
  the board, since it doesn't suppose a boat and follow what that causes.

Anything beyond these is "supposing a boat here, and seeing what breaks",
which 101 ruled guessing. Do not reopen that without new information.

## 7. Levels

The site's four levels. The fleets keep about a fifth of the grid as boat,
as the classic does. To be settled by the spike (section 14):

| Level | Grid | Fleet | Boat cells | Hardest technique |
| --- | --- | --- | --- | --- |
| Easy | 6x6 | 1 x 3, 2 x 2, 3 x 1 | 10 of 36 | Full lines and shapes |
| Medium | 8x8 | 1 x 4, 1 x 3, 2 x 2, 3 x 1 | 14 of 64 | The fleet count |
| Hard | 10x10 | 1 x 4, 2 x 3, 3 x 2, 4 x 1 | 20 of 100 | Where the big ones fit |
| Expert | 10x10 or 12x12 | the classic, or with a 5 added | 20 or 25 | Where the big ones fit, with fewer givens |

On the 540 by 768 screen, a 10x10 cell is about 46 px and a 12x12 cell
about 40 px, with room below the grid for the fleet list.

## Part II: The Track Puzzle

## 8. What It Is Called, and Where It Came From

| Name | Where | When |
| --- | --- | --- |
| Train Tracks | Credited, with an "I believe", to Philipp Hübner and his son Valentin, an Austrian team that sets logic puzzles for newspapers ([Bosbury History Resource](https://www.bosburyhistoryresource.org.uk/Puzzles/Train-Tracks/train-tracks1.html)), and called "a classic puzzle devised by Philipp Hübner" by a fan wiki ([Logic Puzzles Wiki](https://logic-puzzles.fandom.com/wiki/Train_Track)) | Unknown |
| Train Tracks | *The Times*, which has published books of them; puzzlemadness, Clarity Media, Krazydad and many apps | Since |
| Tracks | Simon Tatham's Portable Puzzle Collection, contributed by James Harvey ([its manual](https://www.chiark.greenend.org.uk/~sgtatham/puzzles/doc/tracks.html)), which gives the puzzle type's origin nowhere | Since |
| Railroad Shunting, Rail Maze | Various | Since |

The origin is the weakest part of this check. Every source agrees it is a
newspaper puzzle, not one of Nikoli's, and the one name that comes up is
Hübner's, always hedged. One page attributed it to Gyora Benedek (the
maker of Hidato). Other sources don't, and a search didn't find a train
puzzle of his. This doesn't change the answer below: whoever set it first, the
puzzle is published under its genre's name by many unrelated people.

**Is it fine to make our own?** Yes, for the reasons of section 3. The
rules are an idea, and we don't copy a published puzzle, its art or its
name.

**The names.** "Train Tracks" and "Tracks" look generic: a search found
them used descriptively by newspapers, publishers, sites and apps, and the
one related trademark found is *MEGA TRACKS*, for a train game, which we
wouldn't touch. They are probably free to use. But the originality rules
ask for a title of our own, and a fresh theme earns its own name. In prose,
the entry describes itself as "a logic puzzle known elsewhere as Train
Tracks".

## 9. The Rules

- The grid has n rows and n columns. Two cells on its edges are given: the
  entrance and the exit, each a piece of track leading off the grid.
- Lay one track from the entrance to the exit. Each cell holds a straight
  piece, a curve (a quarter turn), or is left empty.
- The track never crosses itself, never splits, and never forms a loop. It
  doesn't have to visit every cell. That is the difference from Minotaur,
  whose path fills the grid.
- The number beside each row and column is how many of its cells the track
  passes through.
- Some cells may be given at the start: a piece of track, or a cell the
  track doesn't use.
- A good puzzle has exactly one answer, found without guessing.

These match Tatham's rules ("only straight and 90 degree curved rails, and
the track may not cross itself") and the newspapers'.

## 10. A Fresh Theme: Meander

A railway is fine, but trains belong to the genre's name. A river fits the
rules just as well, and pairs with Moorings.

**A river from a spring to the sea.** The grid is a valley of fields. A
spring rises at one edge, and the river must reach the sea at another. A
river never crosses itself, never splits and never runs in a circle, and it
winds, so it doesn't fill the valley. The surveyor's numbers along the
edges say how many fields of each row and column the river runs through.
You draw the river.

- Pieces are reaches of river, straight or bending, drawn as water between
  soft banks. The spring and the sea are drawn at the two given ends.
- A field the player rules out is drawn as meadow, a few grass tufts,
  rather than a cross.
- When the river is finished, water flows down it from the spring to the
  sea, as the puzzles' celebration.

**The look.** The valley is a green, flowery meadow, with small flowers in
a few bright colours scattered over the grass. The river is the same
sparkling blue as Moorings' harbour, so the two puzzles look like
neighbours, with soft banks and glints on the water. The spring and the sea
are small, cute pictures of their own. The spring is a bubbling pool, and
the sea is a strip of beach with waves.

**Meander** is the suggested name: it is what a river's bends are called,
and says "winding" at once. A web search found a small browser game called
*MEANdEr* (a tile game from a 2021 forum challenge) and river games under
other names (*Braided*, *Longest River*). It didn't find one named
Meander alone.
Other candidates:

- **Burrow**: a mole's tunnel from one molehill to another, under a lawn.
  Charming, and the empty cells are lawn. A common word in game titles.
- **Canal**: plain, and a canal is dug, which suits the player's drawing.
- Ruled out: **Tracks**, **Train Tracks**, **Rail Maze**, which are the
  genre's names (section 8).

## 11. The Generator and the Solver

Choose the answer first, as before. Sketched, not spiked.

1. **Draw a river.** Pick the spring and the sea on the edges, then a
   random path between them that never touches itself. A loop-erased random
   walk (walk at random from the spring, and erase any loop as it forms,
   until you reach the sea) gives a fair, winding path. It is often short,
   so then grow it: take a straight step between two cells, and if the two
   cells beside them on one side are free, bend the path out through them,
   which adds two cells. Repeat until the river fills its target share of
   the grid, about 40 to 55% of the cells.
2. **Read the numbers.**
3. **Add givens, then drop the ones not needed**, exactly as in section 5.
   Givens are pieces of track, or empty cells.

The solver works on edges between cells, each unknown, river or blocked,
as Minotaur's does. Minotaur's maze solver already has two of the rules
below (a cell's crossings, and blocking a side that would close a loop),
so it is the starting point:

- **Cells.** A cell the river enters leaves by exactly one other side; the
  spring and the sea are ends. A cell with two river sides has its others
  blocked. A cell known to be empty has every side blocked.
- **Full lines.** A row or column with all its river cells found is empty
  elsewhere. One with exactly as many unknown cells as river cells still
  needed is river in all of them.
- **No dead ends.** A cell with only one side left open can't hold river,
  unless it is an end.
- **No loops.** A side that would join two parts of the river into a loop
  is blocked.
- **Crossings even or odd.** The river crosses the line between two
  neighbouring columns an odd number of times if the spring and the sea are
  on opposite sides of it, and an even number of times if they are on the
  same side. So when every crossing but one is settled, the last is too.
  The same goes for rows. Strong players use this; it reads the board as it
  stands.

Easy and Medium allow the first four; Hard and Expert need the crossing
count too, and fewer givens. Tatham's version avoids two neighbouring
clues of 1 by default. The spike should check whether ours needs that rule.

**Levels**, to be settled by the spike: Easy 6x6, Medium 8x8, Hard 10x10,
Expert 12x12, each with the river filling about half the grid.

## Part III: Both

## 12. Playing Them

Both follow Stars and Minotaur, so the puzzles feel like one family.

**Moorings**

- **Tap** a cell to cycle it: empty, water, boat, empty. Water comes first
  because it comes first in solving, as crosses do in Stars.
- **Drag** paints the mark the first cell became over the cells it goes
  over, so a sweep of water fills a finished row.
- **Boats shape themselves.** A boat cell is drawn as a dinghy, a bow, a
  stern or a midship from its neighbours, as on paper.
- **Help the eye.** A number turns quiet when its line is right, and red
  when it holds too many. Boats that touch at a corner, and a run longer
  than any boat left, show red. The fleet list ticks off finished boats.

**Meander**

- **Drag** through cells to draw the river, with Minotaur's stroke
  ([stroke-view-model.ts](../../packages/sites/puzzles/src/entries/minotaur/views/stroke-view-model.ts)):
  a drag that starts on river already drawn rubs it out, so a drag can't
  flicker between the two.
- **Tap** a cell to mark it as meadow, or to clear it.
- **Help the eye.** Numbers go quiet and red as in Moorings. A cell with
  three river sides, or a loop, shows red.

**How they look.** Both puzzles use beautiful colours and cute cell
symbols, which sections 4 and 10 describe. A few things apply to both:

- **The art is drawn in the repo**, in the views or a texture script, as
  the originality rules ask.
- **Clues stay clear.** The pictures must never hide the logic. The numbers,
  the givens and the red clashes stay easy to read on top of the colour.
  A given looks different from a player's mark at a glance.
- **Every theme.** The colours are checked in the site's Arcade, Dark and
  Light themes, and for colour blind players. Colour is never the only way
  to tell two things apart.
- **Sparkles are presentation state.** The glints on the water are
  cosmetic, so the views move them on in their update step, from `deltaMs`.
  They are kept small and slow, so they don't distract, and so they cost
  little on a phone.

**Both:** givens in ink and the player's marks in colour, as in Stars;
undo, one stroke at a time; saves in the browser; the shared daily records,
calendar and How to play card; a short walkthrough on a practice puzzle;
and a few soft Audio90 effects, levelled by loudness beside the other
puzzles'. Solved is when every number is met and the rules hold, which is
the same as matching the answer, since each puzzle has one.

## 13. Open Questions

1. **The names.** Moorings and Meander, or the alternatives of sections 4
   and 10? Whichever are chosen are searched in the trademark registers
   before they are adopted. (Minotaur, Moorings and Meander all start with
   M, which may matter on the card wall.)
2. **Shaped boats.** Straight boats only, as recommended, or an Expert
   level with bent boats? Shaped fleets need a different "where the big
   ones fit" and a different fleet list.
3. **Moorings' Expert.** A bigger grid (12x12, with a 5-cell boat), or the
   classic 10x10 with fewer givens and the hardest technique?
4. **Boat ends.** Is a given end piece clear enough as a hull's bow or
   stern, or should givens be drawn more plainly than the player's boats?
5. **Shared code.** Both puzzles show a number per line that goes quiet or
   red, as Minotaur's clues do. Minotaur and Stars each have their own
   `undo-history.ts`. These could move to the puzzles' shared parts as the
   two new entries land, or wait for a third copy.

## 14. Building Them

Where they go: `packages/sites/puzzles/src/entries/moorings/` and
`.../meander/` (the ids are stand-ins until the names are chosen).

**Steps, one entry at a time, each reviewed before the next:**

1. Settle the open questions, and search the chosen names.
2. **Moorings, the spike:** the fleet placer, the solver of section 6 and
   the givens, in Node. Measure the time per puzzle, the givens per puzzle
   and the share of puzzles at each grade, then settle the levels.
3. **Moorings, the models:** the puzzle maker and levels with seeds pinned
   (like Stars' `find-puzzle-seed.test.ts`), then the puzzle model (marks,
   undo, clashes, solved, saves) and the game model.
4. **Moorings, the views:** the board and its gestures, the fleet list, the
   walkthrough, the sound. Then the entry files, the catalogue, the details
   text, the thumbnail and share picture, and a playtest on a phone and with
   a mouse.
5. **Meander, the spike:** the river drawer of section 11 and the solver,
   starting from Minotaur's. Measure as in step 2. The river's shape is the
   main risk: check by eye that grown rivers wind, rather than zigzag in
   tight bends.
6. **Meander, the models and views**, as in steps 3 and 4.

**Tests**, as Stars' are, only where they earn their keep: each solver
against a brute-force count on small grids (every puzzle it finishes has
exactly one answer); seeds pinned; every level's puzzles graded at their
level, as a slow test; visual tests for each view.

## 15. Progress

- 2026-11-20: Proposed, with the originality check (sections 2, 3 and 8)
  and the designs. The generators aren't spiked yet.
- 2026-11-20: The user asked for beautiful colours and cute cell symbols,
  such as little boats on blue sparkling water and a river through a green
  flowery meadow. Added to sections 4, 10 and 12. Still not started.
- 2026-11-20: Both built, at the user's word, in the `line-puzzles`
  worktree (from `vnext` at `d38cc7a4`), uncommitted. The names are the
  suggested ones. Each has its models, views, sound, walkthrough, How to
  play card, visual tests, card picture and share picture, and is in the
  catalogue. The puzzles' card wall picture was retaken.
  - **Moorings.** Levels: Easy 6x6 (a 3, two 2s, three 1s, `rules`),
    Medium 8x8 (a 4, a 3, two 2s, three 1s, `fleet`), Hard and Expert
    10x10 with the classic fleet, `fleet` and `places`. So the Expert of
    open question 3 is the classic harbour, harder in kind. The techniques
    are as in section 6, with one more in `places`: a cell that every boat
    still to find misses is water. In Node, a puzzle is made in 0.4 ms on
    average at Easy, and 6 to 8 ms at the others, 29 ms at worst. Givens:
    1 to 3 at Easy, 2 to 13 at the others. Straight boats only (open
    question 2 left open). A lone printed middle is drawn as a square
    piece, since its boat's direction isn't shown.
  - **Meander.** The spring is always on the left edge and the sea on the
    bottom edge, as in Tatham's version, so the numbers go along the top
    and down the right. Levels: Easy 6x6 and Medium 8x8 (`rules`), Hard
    8x8 (`loops`), Expert 10x10 (`crossings`), the river filling 40 to 55%
    of the valley. The river drawer is section 11's: a loop-erased walk,
    then bends added. In Node, a puzzle is made in under 4 ms on average
    up to 8x8, and 28 ms at Expert, 74 ms at worst. Givens: 0 to 3 at
    Easy, up to 13 at Expert.
  - **Checked.** A search that shares no code with the solvers counts
    every puzzle's solutions. All 600 puzzles of 150 days at each level of
    each game have one, and the slow tests keep checking 30 days. That
    check found one bug on the way: Moorings' fleet technique read a cell
    it had just written in the same pass, and grew a boat that wasn't
    forced. Each technique now reads the board as its pass began.
  - **Left:** a playtest on a phone and with a mouse, a loudness check of
    the sounds beside the other puzzles', and the trademark searches.
- 2026-11-20: Renamed at the user's word, before the first playtest:
  Moorings is **Boats** and Meander is **River**, since Minotaur, Moorings
  and Meander made three M puzzles in a row (open question 1). The ids,
  folders, save keys and code names changed with them. Both are listed as
  BETA (`Boats BETA`, `River BETA`) until they have been playtested. The
  harbour and valley themes stay. The puzzles' card wall picture was
  retaken.
- 2026-11-20: Sounds rewritten for each theme, at the user's word. Boats:
  a lap of water, a wooden knock of a hull, a little ship's horn for a
  boat finished, a wave drawing back, hulls bumping, and the harbour's
  bell with a gull's call when solved. River: a bubble, a bird's chirp
  for a flower, a rustle of grass, pebbles plunking for a clash, and a
  rippling stream of bells with birdsong when solved. Each is levelled by
  loudness beside Stars' and Minotaur's: about -36 LUFS for frequent
  marks, -32 for the main mark and a clash, -29 for a boat finished, and
  -26 for solved. So the loudness check is done; the playtest and the
  trademark searches are left.
