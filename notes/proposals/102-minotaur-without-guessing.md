# Proposal: Minotaur without guessing

> Every Hard and Expert maze today needs a guess and a back up, by design.
> The maker keeps only mazes that need "tries": set an edge one way, follow
> the rules, and see whether something breaks. That is the look ahead that
> 101 ruled out as guessing for Stars. On the daily mazes, the rules
> settle about a third of the edges, sometimes under a tenth, and then
> stall, exactly as the playtest found. This proposal asks whether Stars'
> answer, givens printed on the grid, carries over. It does, and cheaply:
> a maze the rules can't finish needs one given edge, rarely two. But
> Minotaur doesn't need it. Unlike the daily Hard and Expert mazes, most
> random mazes are finished by the rules alone (about 90% up to 9x9, 75%
> at 11x11), so the maker can keep those instead, drawing again when one
> isn't, and the player sees nothing new. What Minotaur does need, once
> tries go, is a
> way to keep Hard and Expert harder in kind. The lever is the reverse of
> givens: **hide the clues the rules can do without**. About a third of
> them can go, and the rules then take about 70% more passes to finish.

**Status:** proposed. Nothing built.

**Written:** 2026-11-17, against `vnext` at `2ef9c043`, at the user's
request: "look at whether and how this givens technique can also be
applied to Minotaur. The aim is to require no backtracking there either."
The probes were a Vitest file beside the Minotaur models, not kept. Times
are in Node.

**Related:**
[101](../archive/101-stars-without-guessing.md) (Stars without guessing, where the
line between fair and guessing was drawn),
[087](../archive/087-wall-maze-puzzle.md) (Minotaur's proposal, whose
section 4.5 chose tries for the harder levels),
[the solver](../../packages/sites/puzzles/src/entries/minotaur/models/maze-solver.ts),
[the maker](../../packages/sites/puzzles/src/entries/minotaur/models/maze-puzzle.ts),
[the levels](../../packages/sites/puzzles/src/entries/minotaur/models/levels.ts).

| # | Decision or recommendation | Section |
| --- | --- | --- |
| 1 | Tries are guessing, by 101's line. Every level uses the rules alone | 1 |
| 2 | Givens would work, but aren't needed: drawing again is as cheap, and changes nothing the player sees | 2.2, 3.1 |
| 3 | Extra direct techniques (bridges, two-edge cuts) aren't worth adding: the rules leave them almost nothing to do | 2.3 |
| 4 | Hard and Expert hide the clues the rules can do without, shown as `?` | 2.4, 3.2 |
| 5 | Easy and Medium keep today's mazes exactly | 3.3 |

## 1. The Problem

The solver (`maze-solver.ts`) applies three rules until they settle:

- **Lines.** Each line's edges must follow its clue, as in a nonogram.
- **Cells.** S and E have one passage each, and every other cell two.
- **No loops.** An edge that would close a loop is a wall, and so is one
  that would join S's piece of the path to E's too soon.

When they stall, `applyTries` sets each unknown edge one way, applies the
rules until they settle, and if they break, the edge is the other way.
Hard and Expert keep only mazes that need this step (`levels.ts`:
`reasoning: 'tries'`), so every Hard and Expert maze needs it somewhere.

That is exactly what 101 calls look ahead: a supposition followed through
a chain of rules, then rubbed out. The player can't do it in their head
across a whole maze. They draw the edge in, follow it, and back up. By the
line drawn in 101, section 2, it is guessing. Easy and Medium already use
the rules alone, so they are fair today.

The three rules are fair by that line. The cell and loop rules read the
board as it stands. The line rule settles one line at a time against its
own clue, the standard step of every nonogram, with nothing followed
beyond the line.

The playtest, 2026-11-17: "many hard and expert Minotaur puzzles could
not be advanced through deduction alone. I needed to guess and
backtrack." That is what the maker asks for. The daily mazes, 40 days
from early November 2026 at each level, solved by the rules and then by
tries as the grader does:

| Level | Edges settled before the rules first stall | Range | Tries needed | Range |
| --- | --- | --- | --- | --- |
| Hard | 31% | 8-76% | 1.1 | 1-4 |
| Expert | 31% | 10-80% | 1.2 | 1-4 |

So a Hard or Expert maze typically gives up a third of its edges, then
needs one guess, followed through and backed up from, before the rules
can finish it.

## 2. Measured

Random mazes from today's path maker, with their clues read off, at each
size, before any level picks among them. 100 mazes a size up to 9x9, 60
at 11x11 and 13x13.

### 2.1 How many mazes the rules finish

| Grid | The rules finish it | Needs tries | Needs guessing |
| --- | --- | --- | --- |
| 5x5 | 91% | 4% | 5% |
| 7x7 | 92% | 5% | 3% |
| 9x9 | 88% | 11% | 1% |
| 11x11 | 75% | 22% | 3% |
| 13x13 | 40% | 52% | 8% |

This is the opposite of Stars, where no Expert puzzle was fair without
givens. In Minotaur, a maze that needs tries is the exception, and Hard
and Expert pick it out on purpose: they keep the 11% (9x9) and 22%
(11x11) and draw again for the rest.

### 2.2 Givens

A given here is an edge printed on the grid: a wall, or a piece of the
path. The probe used 101's maker: give a random unknown edge its value in
the solution until the rules finish, drop each given the rules can do
without, and keep the fewest of three tries.

| Grid | Givens, mean | Range | Walls among them | Made in, mean | Worst |
| --- | --- | --- | --- | --- | --- |
| 5x5 | 0.1 | 0-1 | 11% | 0.3 ms | 1 ms |
| 7x7 | 0.1 | 0-1 | 40% | 0.8 ms | 2 ms |
| 9x9 | 0.3 | 0-1 | 61% | 2.9 ms | 8 ms |
| 11x11 | 0.5 | 0-1 | 57% | 10 ms | 30 ms |
| 13x13 | 0.7 | 0-2 | 54% | 28 ms | 65 ms |

So a maze the rules can't finish is one given edge away from fair, almost
always. Givens work. But drawing another maze works too, and costs less:
at 11x11, three draws in four are fair already, and a draw takes well
under a millisecond. Givens would also need ink for given walls and
paths, marks that can't be rubbed out, and a new part in the save. They
only start to pay at 13x13 and beyond, where most draws fail.

### 2.3 Other direct techniques

Two more techniques a person can apply by looking were tried, to see if
they could stand in for tries as Hard's and Expert's step up:

- **Bridges.** The path visits every cell, so if one edge is the only way
  into part of the maze, it is a passage.
- **Two-edge cuts.** If part of the maze has only two ways in and holds
  neither S nor E, the path must go in by one and out by the other, so
  both are passages. If it holds one end, exactly one of the two is used.

Both are sound, but the rules leave them almost nothing: among mazes the
rules can't finish, cuts finished one of the five at 7x7 and none at 9x9 and
up, and bridges none at any size. With givens, neither was ever the
hardest step a maze needed. Not worth the code.

### 2.4 Hiding clues

Minotaur's clues carry more than the rules need. The probe made each maze
fair (with a given in the rare case it needed one), then hid each line's
clue in turn, in a random order, keeping it hidden if the rules could
still finish without it. "Passes" counts how many times the rules sweep
the board before they finish, a rough measure of how long a person
works.

| Grid | Clues | Hidden, mean | Range | Passes, all clues | Passes, clues hidden | Made in, mean | Worst |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 5x5 | 8 | 4.4 | 3-6 | 3.7 | 5.6 | 0.5 ms | 3 ms |
| 7x7 | 12 | 5.1 | 4-7 | 5.9 | 9.8 | 2.2 ms | 4 ms |
| 9x9 | 16 | 5.7 | 2-8 | 8.0 | 13.0 | 7.4 ms | 15 ms |
| 11x11 | 20 | 6.5 | 4-9 | 10.8 | 18.3 | 21 ms | 36 ms |

Every maze tried could hide at least two clues, and every one stays fair
by construction: the rules still finish it from what is shown, so it has
one solution. The solving gets longer, and different in kind: a line with
no clue can only be worked from the cells and loops around it.

## 3. The Design

### 3.1 The maker

From a seed, as now:

1. Draw a random path, and read the clues off its walls (as now).
2. Run the rules. If they don't finish, draw again. This is today's loop,
   with "takes the reasoning asked for" replaced by "the rules finish it".
3. At Hard and Expert, hide clues (section 3.2).

`applyTries` and the `tries` and `guessing` grades go. The solver becomes
a plain "do the rules finish it" check. `countSolutions` moves into test
support, as Stars' counter did, to check each maze's one solution
independently.

### 3.2 Hiding clues

Visit the lines in a random order, from the same seed. Hide a line's clue
if the rules still finish without it, up to the level's most. A hidden
clue is drawn as `?` in the clue's place, so you can tell it from a line
with no wall at all. It never fades or turns red, since nothing can meet
or break it. The puzzle's description, which a save is checked against,
writes a hidden clue as `?` too.

### 3.3 The levels

| Level | Grid | Clues hidden | Today |
| --- | --- | --- | --- |
| Easy | 5x5 | None | The same mazes |
| Medium | 7x7 | None | The same mazes |
| Hard | 9x9 | Up to 3 | Changes |
| Expert | 11x11 | As many as the rules allow, about 6 of 20 | Changes |

Easy and Medium draw from the same seeds and keep the same test, so their
mazes don't change, nor do players' saves of them.

Hard and Expert change on every day. Days already solved stay ticked on
the calendar, since the records keep that apart from the saves, but a
Hard or Expert maze left half done starts afresh. Minotaur isn't a beta,
so this is worth a line in the details text.

### 3.4 What the player sees

At Easy and Medium, nothing. At Hard and Expert, some clues read `?`. The
How to play card gains a sentence: "A line marked ? has no clue: work it
out from the cells around it." The rules text loses nothing.

## 4. Tests

- Every level's mazes, over many seeds: the rules finish them from the
  clues shown, the independent counter finds one solution, and every
  hidden clue was hidden only where the rules still finish. A slow test,
  with two seeds a level in the unit test, as Stars has.
- Easy and Medium seeds give the same mazes as today, pinned.
- The solver against brute force on every 5x5 path, kept from today,
  with the grades reduced to "finished" and "not".
- A visual test of a board with hidden clues, and the How to play card.

## 5. Questions

1. **Hide clues at Hard and Expert, or leave them full and fair, harder
   only by size?** Recommended: hide them. Without it, Hard and Expert
   would just be bigger Mediums.
2. **How many at Hard?** Recommended: up to 3 of 16, against Expert's as
   many as allowed. A fixed most keeps Hard between Medium and Expert.
3. **`?`, or a blank?** Recommended: `?`, since a blank reads as a line
   with no walls, which is a real clue.
4. **Givens at all?** Recommended: not now. Keep them in reserve if Expert
   ever grows past 11x11, where most draws fail.

## 6. Steps

1. The solver with the rules alone, the maker drawing until they finish,
   and every level on it, with all clues shown. Easy and Medium are
   unchanged; Hard and Expert become fair but harder only by size.
2. Hidden clues: in the maker, the puzzle, its save and description, the
   board view, the How to play card and the details text.
3. Timings in Node and on a phone, and a playtest.
