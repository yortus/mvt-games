# Proposal: A colour gradient swap puzzle on a Penrose tiling

> A new entry for the puzzles site. The picture is a smooth gradient of
> colour, laid over a Penrose-style rhombus tiling cut to a window's frame,
> one flat colour to each tile. Most of the pieces the frame cuts are locked in place. The rest are jumbled,
> and you drag a piece onto another to swap the two, until every colour is
> back where it belongs. Every puzzle comes from its day and level as a seed:
> the tiling's symmetry (5, 7, 8, 10 or 12-fold), the patch, the gradient and
> the jumble. Gradients are made, not chosen from a list, in a perceptual
> colour space (OKLCH), so how subtle a puzzle is becomes a number: how close
> the two most alike pieces are. Spikes on the Penrose demo's own tiling code
> measured the tile sizes each symmetry gives, and found a gradient shape
> that hits each level's subtlety in about 97% of draws, in milliseconds.

**Status:** proposed. Spiked (sections 3 and 4), then built whole as a
spike, **Rosette** (first called Glass Smith), and playtested five times. The third playtest cut
the tiling to a frame (section 3.6). The fifth gave each day its frame, and
freed the pieces the frame only trims. Nothing is merged.

**Written:** 2026-11-07, against `vnext` at `fbd613bd`. The spikes were Node
scripts (not in the repo) that ran the Penrose demo's
`multigrid-tiles.ts` unchanged, with OKLab conversions written for them.

**Related:**
the Penrose demo's [multigrid tiles](../../packages/sites/demos/src/entries/penrose-tiling/models/multigrid-tiles.ts)
and [symmetries](../../packages/sites/demos/src/entries/penrose-tiling/data/constants.ts),
[Minotaur](../../packages/sites/puzzles/src/entries/minotaur/) (the newest puzzle, and the model for this one),
the puzzles' [shared parts](../../packages/sites/puzzles/src/shared/index.ts),
[A Puzzle's Day and Its Way In](../../packages/sites/arcade/src/entries/README.md#a-puzzles-day-and-its-way-in),
the [originality rules](../../packages/sites/arcade/src/entries/README.md#originality),
[087](../archive/087-wall-maze-puzzle.md) (Minotaur's proposal),
[094](../archive/094-drags-on-a-grid.md) (`listenToPointer`),
[073](../tasks/backlog/073-models-take-their-random-source.md) (models take their random source).

| # | Decision or recommendation | Section |
| --- | --- | --- |
| 1 | Our own take on a common kind of puzzle, crediting no one game. Named Rosette (renamed from Glass Smith on 2026-11-13): you mend jumbled windows | 2 |
| 2 | Move `multigrid-tiles.ts` into the puzzle, and have the Penrose demo import it, as Sudoku Digger imports Sudoku's generator | 3.1 |
| 3 | A patch is exactly N tiles, the N nearest the centre, so a level's size is exact and the same in every browser (replaced by the frame, which holds N tiles' worth of glass) | 3.2, 3.6 |
| 4 | A symmetry is allowed at a level only if its thinnest tile is at least 20 pixels wide there: 5, 7, 8, 10 and 12 at Easy and Medium, 5, 8 and 10 above | 3.3 |
| 5 | Neighbours come from the grid lines, not from matching corners | 3.4 |
| 6 | A puzzle's subtlety is its closest pair: the smallest colour difference between any two pieces, in OKLab | 4.2 |
| 7 | The gradient has a hue axis and a lightness axis, in OKLCH, with chroma a share of what the gamut allows. One scale is solved for, so the closest pair hits the level's target | 4.3, 4.4 |
| 8 | Four-corner gradients and per-tile gamut clipping are ruled out | 4.5 |
| 9 | A colour-blind setting makes each day's puzzle from the same seed with a lightness and blue-yellow gradient | 4.6 |
| 10 | A piece keeps its shape: it only swaps with a piece of the same shape, turned to fit (settled by the first playtest) | 5.1 |
| 11 | Locks hold the gradient's ends, then spread out, fewer at harder levels | 5.2 |
| 12 | The jumble moves every free piece among the tiles of its shape, and the fewest swaps that solve it are known | 5.3 |
| 13 | Drag to swap, or tap two pieces. A piece put in its place next to the locked pieces locks too, as a jigsaw piece stays put; elsewhere, nothing says it is right (settled by the second playtest) | 5.4, 7 |
| 14 | The tiling is cut to a window's frame, one of several outlines. The pieces the frame cuts are locked, and the window is mended from the frame in, with no locks inside (settled by the third playtest) | 3.6, 5.2 |
| 15 | Each day has one frame, at every level, the frames taking turns. A piece the frame only trims keeps its shape and moves (fifth playtest) | 3.6 |

## 1. The Rules

- The picture is a window: a rhombus tiling cut to a frame. Each tile shows
  one flat colour. Together they make a smooth gradient.
- The pieces the frame cuts deeply are locked. They are already right, and
  never move. A piece the frame only trims moves like the rest.
- Every other piece starts in the wrong place. Drag one onto another, and
  the two swap.
- The puzzle is solved when every piece is back where it came from. Since no
  two pieces are the same colour (section 4.2), that is the same as the
  gradient being smooth again.

The puzzle is the classic jumbled picture puzzle, in which you swap pieces
of a cut-up picture until it is whole. Here the picture is a gradient, which
you can reason about: each piece's colour says roughly where it goes, and the
locked pieces tell you which colours are at which ends.

## 2. Where It Comes From, and Originality

Swapping the pieces of a colour gradient back into order, with a few fixed
as clues, is a common kind of puzzle: many games and apps have done it, on
squares, hexagons and other grids, and gradient-only jigsaws are older still.
No one game owns it, and this isn't a remake of any of them, so the entry
credits none in `inspiredBy`. It is our own take on the kind, and its names,
in the code as well as on screen, are our own.

What is our own:

- **The tiling.** A patch of a rhombus tiling that never repeats, laid by de
  Bruijn's multigrid method, at a symmetry that changes every day.
- **Pieces that keep their shape** (section 5.1), and turn to fit as they
  swap.
- **The gradients.** Made from a seed by the rules of section 4, never
  chosen from a list or taken from any game's levels.
- **Daily puzzles** at the site's four levels, and the shared way in.
- **The look**, a leaded window, drawn in the views, in the site's own style.

**The story**, kept very simple. Windows come in with their glass
jumbled, for you to mend. Each day's
puzzle at each level is one window. A *pane* is a single piece of glass
set in the lead (in old leaded windows, the small diamond panes are called
quarries), so a whole puzzle is never a pane: the text and the code say
*window* for the puzzle and *piece* for each of its panes.

**The name: Rosette** (2026-11-13). A rosette is a round decorative
window or ornament, and Penrose tilings are known for their five-fold
rosette patterns, so the name suits both the glass and the tiling. The
user wanted a plain name, clear among the site's own entries, since the
puzzle is only for the site. Searched on the web on 2026-11-13: *Rosette
and Words* (a 2018 word search on Steam, earning pieces of rosettes),
*Rosette* (a 2011 two-player board game of placing rhombus tiles, and a
1975 board game, Go on a hexagonal grid), *Rosette Diceless* (a tabletop
role-playing game) and a tiny 2018 itch.io download. None is a colour
puzzle, and no trademark for games turned up.

The working name was **Glass Smith**, from 2026-11-08 until the rename. It
was found to be clear (below), but the user wanted a better one. Names
weighed for the rename, with what ruled them out: Colour Shift (clear, but
ordinary), Panes (*The Pane Puzzle*, a glass colour puzzle), Tints
(*tint.*, an Apple Arcade colour puzzle), Hues and Gradient (many
gradient-sorting apps by those names), Glazier, Sunlit, Glint and Mend
(clear, but not liked), and Leadlight (below).

"Leadlight", the word for a window of small
panes held in lead, suited the look perfectly, but it is taken:
*Leadlight* is a puzzle game on Steam (Error 300, 2025) about putting
stained-glass mosaics together, too close to this one to share a name.

Glass Smith, the working name, was searched on the web on 2026-11-08, as a game on Steam,
itch.io and the app stores, spelled as two words, as one (Glassmith) and
as GlassSmith. No game has the name. The nearest names are *Glass Forger*
(a 2025 game jam prototype about glass blowing, whose blurb mentions
becoming a glass smith), *The Artisan of Glimmith* (2026, logic puzzles
colouring stained glass), *The Artisan* (an app about restoring stained
glass windows) and *Glasswright* (itch.io). None shares the name, and only
the stained glass ones are puzzles, of other kinds. Glass smith is also an
everyday phrase for someone who works glass, used by glass businesses, so
the name says what you do without belonging to anyone. The trademark
registers are still to search before release, as the originality rules
ask.

## 3. The Picture: a Patch of a Rhombus Tiling

### 3.1 Reusing the demo's tiles

The Penrose demo's [`createMultigridTiles`](../../packages/sites/demos/src/entries/penrose-tiling/models/multigrid-tiles.ts)
does everything the puzzle needs. It lays every tile whose middle is within
a radius of a centre, at any of the demo's symmetries, and gives each
tile's corners, shape, direction, and the two grid lines it comes from. It
imports nothing and allocates nothing per lay.

The demos already depend on the puzzles (`@mvtjs/puzzles/sudoku-generator`),
so the puzzles can't import from the demos without a cycle. Do as Sudoku
did: move `multigrid-tiles.ts` and its test into the puzzle, export it from
the puzzles package (`@mvtjs/puzzles/multigrid-tiles`), and have the demo
import it from there. One copy, and the demo keeps its tests passing
unchanged. The demo's `SYMMETRIES` stay in the demo.

### 3.2 Exactly N tiles, the same in every browser

Replaced by the frame (section 3.6), which holds N tiles' worth of glass, so a window has a few more pieces than N. The frame's size is rounded to steps of 1/1024 tile edge, so that a last-bit difference between browsers can't change it. The rest of this section is how the round patch was made.

Laying by radius gives a count that jumps as the radius grows. A level
should have an exact number of pieces, and every player must get the same
tiles. So:

1. Lay a disc a little larger than needed.
2. Rank the tiles by the distance of their middles from the centre, ties
   broken by index, and keep the first N.
3. If the N-th and the next tile are almost the same distance from the
   centre (within 1e-9 tile edges), use N + 1 or N - 1 instead, so that no
   rounding difference can change which tile is in.

That last step matters. JavaScript's `Math.sin`, `Math.cos` and `Math.cbrt`
are allowed to differ in their last bit between browsers. The tiling's
corners come from them, so a tile right on the edge of the disc could be in
for one player and out for another. Keeping well away from such ties keeps
the puzzle the same everywhere. Section 8 says how this is tested.

**The rim.** The spike found tiles at the rim with only one neighbour.
They look stuck on, and they are easy pieces, since they have one colour to
match. After choosing the N tiles, drop any tile with fewer than two
neighbours and take the next nearest instead, until none is left.

### 3.3 Which symmetries

Every tile has sides one tile edge long, but the thinnest rhombi get very
thin at high symmetries. A thin tile is hard to see a colour in, and hard to
hit with a finger. The spike laid each symmetry at each size, scaled the
patch to fill a disc 500 pixels across (on the puzzles' 540 by 768 screen),
and measured the thinnest tile's width (its inscribed width, which is
`sin` of its narrowest corner angle, in tile edges):

| Symmetry | 30 tiles | 50 | 80 | 120 | 160 |
| --- | --- | --- | --- | --- | --- |
| 5 (Penrose) | 43.5 px | 33.5 | 28.1 | 23.1 | 20.4 |
| 7 | 30.1 | 26.1 | 20.6 | 16.9 | 15.3 |
| 8 | 48.4 | 41.7 | 32.3 | 27.1 | 24.4 |
| 9 | 24.5 | 19.2 | 15.9 | 13.4 | 11.7 |
| 10 | 42.9 | 33.5 | 26.7 | 22.9 | 20.0 |
| 11 | 19.7 | 16.5 | 13.4 | 11.2 | 10.0 |
| 12 | 36.4 | 27.4 | 23.5 | 19.2 | 17.9 |
| 13 | 16.8 | 14.1 | 11.2 | 9.3 | 8.4 |

The tile edge is about 70 pixels at 30 tiles and 35 at 160, for every
symmetry. Each tile has 3.1 to 3.7 neighbours on average. Laying 160 tiles,
radius search included, takes 0.4 ms.

**The rule:** a symmetry may be chosen at a level if its thinnest tile is at
least 20 pixels wide at that level's size. With the sizes of section 6, that
is 5, 7, 8, 10 and 12 at Easy and Medium, and 5, 8 and 10 at Hard and
Expert. A test checks the rule, so changing a level's size can't let a
too-thin symmetry in. 3 and 4 are left out: they repeat (cubes and squares),
and 4 is a plain square grid. 20 pixels is a guess to check on a phone
(section 10). On a phone 390 pixels wide, the screen is scaled to about
0.72, so the thinnest tile is about 14 CSS pixels.

How often each symmetry comes up is a choice (section 10). Weighting 5, the
true Penrose tiling, highest would make it the puzzle's signature.

### 3.4 Neighbours from the grid lines

The puzzle needs to know which tiles share an edge: to drop rim tiles, to
spread the locks (section 5.2), and to measure colour differences quickly
(section 4.4). Matching corners by rounded coordinates would work, but
rounding has edges of its own. The multigrid gives neighbours exactly. Every
tile is a crossing of two grid lines, and two tiles share an edge exactly
when their crossings are next to each other along one line. So sort each
line's crossings along it, and each neighbouring pair is a pair of
neighbouring tiles. Sort the crossings of the larger disc laid in section
3.2, before the N tiles are chosen, so that a tile left out between two
others doesn't make them look like neighbours. The tile set already gives each tile's lines and
crossing (`firstLines`, `secondLines`, `crossingXs`, `crossingYs`). The
demo's nudges keep any two crossings on a line apart, so the order never
depends on rounding.

### 3.5 Variety

Beyond the symmetry, each puzzle draws the grids' shift (which changes the
tiling's pattern near the centre), a small offset of the centre, so the
patch isn't always the most symmetric spot, and a rotation of the whole
picture.

### 3.6 The frame

The third playtest found that a round patch doesn't look like a window. Its
edge is jagged, and no window has that outline. Two ways out were weighed:
give the window a frame, or change the story to something the jagged
outline does look like (a quasicrystal, the fragment of a mosaic, a
suncatcher). Each new story either kept a weak link to what you see or
needed a new outline anyway. The frame keeps the story and the name, and
mock-ups of one day's puzzles (2026-11-09), cut to a rectangle, a round
arch, a pointed arch and a rose window, read as windows at once. So the
tiling is cut to a frame.

- **Frames.** A list of outlines, each convex, so a tile is cut by the
  frame simply (Sutherland-Hodgman clipping). Arches and circles are many
  short straight sides. All share one box, 0.9 as wide as high, the board's
  shape. There are 12 (2026-11-10): rectangle, round arch, hexagon (pointed
  at the top and bottom), pointed arch, oval, octagon, segmental arch (a
  shallow arc), rose (a circle), gable, Tudor arch (tight shoulders, then
  straight lines to a low point), diamond, and rounded rectangle. A shield,
  a pointed arch upside down, was tried and dropped. Each day has one frame,
  at every level, the frames taking turns
  (`findDayFrame`, asked for in the fifth playtest). Like the seeds, the
  turns must never change once players have windows made with them, so a
  longer list of frames needs a rule that leaves past days alone. A concave
  frame, such as a cross, would need another way of cutting.
- **Size.** The frame is scaled so that it holds as much glass as the
  level's count of whole tiles would cover, at the tiling's average tile.
  The pieces come to a few more than the count, since the cut ones are
  smaller.
- **The frame's pieces.** A piece the frame cuts deeply is locked from the
  start. Each is a shape of its own, so none could swap anyway. Together
  they hold most of the rim of the gradient, like the edge pieces of a
  jigsaw, so you mend the window from the frame in, as most people do a
  jigsaw, and the locks grow inwards from the frame (section 5.4).
- **Trimmed pieces.** The fifth playtest found too much of the edge solved
  from the start. So a piece the frame only trims, keeping at least 85% of
  its rhombus, with its middle at least 0.2 tile edges inside the frame,
  keeps its rhombus's shape, as though the frame hid a corner of it, and
  moves (`TRIM_SHARE` and `GRIP_ROOM`; a share over 1 locks every cut
  piece again). A sliver joins a trimmed piece only if it shares a side
  more than twice as long with it as with any cut piece, since a join makes
  a piece a shape of its own. Always preferring the cut piece joined some
  thin slivers by their short ends, leaving spikes of glass. About a
  quarter of the frame's pieces are trimmed: 4.7 of 20.5 at Easy, 9.8 of
  40.7 at Expert, over 40 days.
- **Slivers.** A cut piece smaller than 0.3 of an average whole piece joins
  the cut piece it shares the longest side with, so the frame holds no
  splinters of glass. The mock-ups first turned slivers into lead, which
  left dark wedges along the frame.
- **No locks inside.** The four end locks of section 5.2 showed which way
  the colours run, and the frame shows that now. Locks inside (landmarks)
  were a level setting, 0 at every level, and are now taken out.
- **Bigger pieces.** The round patch left nearly a third of the board
  empty, between its jagged edge and the board's. A frame fills the board,
  so at the same count, the tile edge grew from 49 to 59-70 pixels at
  Medium, and from 36 to 40-47 at Expert, in the mock-ups. Levels can take
  more pieces (section 10).
- **Fewer free pieces.** About a quarter to a third of the pieces are the
  frame's. At Medium, the mock-ups had 74-76 pieces, 21-25 of them the
  frame's, so 50-53 free, against 60 free in the round patch. The free
  pieces beside the frame have colour on two sides to go by, too.

## 4. The Colours

### 4.1 Why a perceptual colour space

In sRGB, the same step in the numbers can look large in one place and too
small to see in another. In **OKLab** (Björn Ottosson, 2020), equal
distances look about equally different, everywhere. **OKLCH** is the same
space in polar form: lightness L, chroma C (how colourful) and hue h, an
angle round the colour wheel. CSS Color 4 uses OKLab to measure colour
differences, and treats a difference of 0.02 as just noticeable (a JND)
when it maps colours into a gamut.

This is what makes subtlety something the generator can aim for: a
difference in OKLab means the same to the eye in any part of the picture.

### 4.2 Subtlety is the closest pair

The first spike coloured patches with gradients of a chosen width and
measured the average difference between neighbouring tiles. Averages turned
out to be the wrong measure. At Easy, with neighbours 0.041 apart on
average, the median puzzle's two most alike tiles were only 0.009 apart,
and 16% of puzzles had a pair under 0.005: in practice, two pieces of the
same colour. Swapping those two pieces would leave a picture that looks
solved and isn't.

So the measure is the **closest pair**: the smallest OKLab difference
between any two pieces in the puzzle. A level sets a target for it, and the
generator makes the picture fit. That also settles the rules' promise that
no two pieces are alike, and it is measured on the final colours, after
they are rounded to 8 bits per channel, since rounding moves a colour by up
to about 0.002 in OKLab.

The closest pairs were always neighbours, with their middles 0.59 to 0.95
tile edges apart (in the 150-tile patches measured, no two tile middles were
closer than 0.59 in 5 and 10-fold patches, or 0.71 in 8-fold ones), and they lay along a line of equal
lightness, where only the hue changes. Which leads to the shape of the
gradient.

### 4.3 The gradient's shape

The gradient has two axes across the picture, turned to a random angle:

- Along the **hue axis**, the hue sweeps round the wheel, from one end of the
  picture to the other.
- Along the **lightness axis**, lightness rises from dark to light.
- **Chroma** is a share (0.82 to 0.95, drawn) of the most the sRGB gamut
  allows at each tile's lightness and hue, so colours are vivid, like
  coloured glass, and no tile is ever pushed out of the gamut and clipped.

The two axes span the tiles themselves, not a square around the disc. (An
early version spanned the square, and wasted about 30% of each sweep on
corners with no tiles.)

The generator solves for one number, a scale that widens or narrows both
the hue sweep and the lightness span together, by bisection, until the
closest pair meets the level's target. If the sweep would pass 280 degrees,
or lightness would leave 0.34 to 0.93, the draw is thrown away and another
made. The spike, on 150 puzzles a level:

| Level | Tiles | Closest pair target | Draws kept | Hue sweep (median) | Lightness span (median) | Time per puzzle |
| --- | --- | --- | --- | --- | --- | --- |
| Easy | 40 | 0.030 | 98% | 143° | 0.29 | 1 ms |
| Medium | 70 | 0.022 | 96% | 149° | 0.30 | 2 ms |
| Hard | 110 | 0.016 | 97% | 138° | 0.28 | 4 ms |
| Expert | 150 | 0.012 | 100% | 121° | 0.24 | 6 ms |

(Node, unoptimised: it checks every pair of tiles at each step of the
bisection. Checking only neighbours inside the bisection, and every pair
once at the end, makes it several times faster. A phone may be several times
slower, which is still fine.)

Two things show in the table. Sweeps of 120 to 150 degrees are what any
level needs, so harder levels are harder mostly through their number of
pieces: more pieces across the same colours puts neighbours closer
together. And the closest pair is set by the hue axis, not by lightness. A
second spike widened the lightness span from 0.3 to 0.5 and the closest pair
barely moved. That's because every gradient has a line along which
lightness doesn't change, and there only hue tells two tiles apart.

### 4.4 What colour theory chooses

Within that shape, colour theory decides how each picture looks:

- **Where on the wheel** the sweep is centred: anywhere, uniformly.
- **Which way round** it goes: through the warm hues or the cool ones.
- **Its span**, which the scale settles. 120 to 150 degrees runs from a
  triad to a split complement: the sweep's two ends are a harmonious pair,
  with the hues between them running smoothly from one to the other.
- **Warm highlights, cool shadows**, the painter's rule: the hue leans a
  little (about 25 degrees) towards yellow at the light end and away from it
  at the dark end. The second spike used this. The third, whose numbers are
  in section 4.3, didn't. It needs measuring again once built.
- **Lightness in the middle of the range** (around 0.65), where the gamut is
  widest, so chroma stays high across the whole picture.

The two hues at the sweep's ends, the lean, and the light direction are
enough variety for a different-looking picture every day, at every level.
How it plays depends on that variety too: a player can't learn a fixed set
of palettes.

### 4.5 Ruled out

Do not reopen these without new information.

- **Four corner colours, blended across the picture.** This is the obvious
  design: pick four colours by a colour harmony, put one at each corner, and
  blend between them in OKLab. Any harmony wider than analogous (hues side
  by side on the wheel) puts opposite hues at the corners, and their
  average, the picture's middle, is grey: the spike measured a mean chroma
  of 0.000 for complementary and square corners, and 0.017 and 0.033 for
  split and triadic ones, against 0.13 at the corners. Analogous corners
  avoid the grey, but change so slowly that, scaled up far enough to tell
  pieces apart, they leave the gamut. Not one of 4,000 draws worked.
- **Clipping each tile into the gamut.** Lowering a too-vivid tile's chroma
  one tile at a time flattens the colours exactly where they are most
  vivid, and makes near-identical pairs. Choose chroma as a share of what
  the gamut allows instead (section 4.3).
- **Average difference between neighbours as the measure of subtlety.** It
  hides the pairs that make a puzzle impossible (section 4.2).

### 4.6 Colour blindness

About one man in twelve has red-green colour blindness. The spike simulated
it (Machado, Oliveira and Fernandes, 2009, at full strength) and measured
the closest pair as those players would see it. For the gradients of
section 4.3, it was about a tenth of the target: at Easy, a median of
0.0036 for deuteranopia and 0.0024 for protanopia, against 0.03. Such a
player can't solve them.

Two fixes were tried:

- **Sweeps between blue and yellow**, the difference red-green colour
  blindness keeps, through green or through red. They helped a little
  (0.0049), not enough.
- **Scoring the same gradients on the simulated colours** instead. No draw
  at any level reached its target.

What works is a different gradient, made for it: **lightness along one
axis, blue to yellow along the other**, with almost no red-green change.
Scored on the colours as simulated for both kinds of red-green colour
blindness, every level reached its target, keeping 21% to 99% of draws (the
rest leave the gamut), in about 10 ms. These pictures are plainer, two
colours meeting through a soft grey, but they can be solved.

So the recommendation is a **colour vision setting**, off by default. With
it on, each day's puzzle at each level is made from the same seed, the same
tiling, locks and jumble, with this second kind of gradient. Its progress
and records are kept apart from the usual puzzle's. Section 10 asks whether
to build it in the first release.

## 5. Pieces, Locks and the Jumble

### 5.1 A piece keeps its shape

Tiles come in several shapes, pointing many ways. This proposal first made
a piece just its colour, with the tiles' shapes staying where they were, a
frame the colours move through, so any piece could swap with any other. The
first playtest found that unplayable: even Easy took a long time, mostly
spent finding out that a thin piece could go into a fat tile. It breaks the
picture of a leaded window too, since a pane of glass can't change shape.

So a piece keeps its shape. It swaps only with a piece of the same shape,
pointing any way, and turns to fit as it moves. Pointing doesn't matter: a
piece that had to point the same way too would leave ten separate small
puzzles in a 5-fold patch, with each piece's shape and direction giving away
most of where it belongs. Two shapes in a 5-fold patch, three in a 7-fold,
up to six in a 12-fold, each its own jumble but one picture.

The model owns the rule (`canSwap(a, b)`, which `swap` checks), from each
tile's shape in the patch (`shapes`). A drag over a tile of another shape
outlines nothing and swaps nothing, and a tap on one picks it up instead.

Each tile is one flat colour, the gradient's colour at its middle. Drawing
each tile with its own slice of the gradient across it would make a wrong
piece's edges stand out, which is a much easier puzzle and a different one.

### 5.2 Locks

Since the third playtest, the frame's pieces are the locks (section 3.6),
and what follows was only for landmarks inside, a level setting that was 0 at
every level and has been taken out. It is kept as a record.

Locked pieces are the player's map of the gradient. The player needs both
ends of each axis to know which way the colours run, so locks are chosen in
two stages:

1. **The ends.** The tiles at the far ends of the hue axis and the
   lightness axis: four tiles, the picture's darkest, lightest and both hue
   extremes. They also stop the picture being solved as its mirror image.
2. **Spread out.** Then, again and again, the tile furthest (in steps
   between neighbours) from any locked tile, until the level's count is
   reached. No region is left without a landmark.

Fewer locks for each piece make a level harder. Suggested shares are in
section 6. A rule worth considering: never lock two neighbours, so each lock
tells the player something new.

### 5.3 The jumble

The free pieces are shuffled from the seed with every piece moved off its
own tile (a derangement): a piece that started in place would look locked,
or be a free answer. Each shape is shuffled among its own tiles, again until
none is home. A shape left with only one free piece, after the locks are
chosen, can't be jumbled, so that piece is locked as well: a lock or two
more than the level's count, now and then.

A jumble is a permutation, so the fewest swaps that solve it are known: the
number of free pieces, less the number of cycles in the permutation. The
puzzle can show it after solving: "Solved in 47 swaps. Fewest possible: 43."

### 5.4 Locks that grow

As in a jigsaw, where a piece fitted to the finished part stays put and
drops out of what you're still thinking about, a piece put in its place
next to a locked piece locks too. So does any piece in its place that this
joins up with, so the locked pieces grow as connected groups. A piece put in
its place away from every locked piece stays free and unmarked: rightness
shows only where it touches what is already known.

The locked set follows from where the pieces are: the starting locks, and
every piece in its place that connects to them through pieces in their
places. So it is worked out again after each swap, an undo unlocks what its
swap locked (the walkthrough's undo step relies on that), and a save needs
no record of locks.

Each free piece has a small white ring at its middle, over a faint dark
band so it shows on pale glass (a filled dot was tried first), and each locked group has lead half as wide
again round its outside, with the usual lead between its pieces. The rings
mark the pieces still to place, which reads right at every stage: early,
the few locked pieces are the ones without a ring; late, the rings pick out
the last few pieces. The heavier lead says which pieces belong together.

Four quieter marks were tried in playtests and dropped. A heavier lead
frame, one that pulsed, and a shimmering glow all marked the edge of a
locked area, which reads well early, when locked pieces are small islands,
but late, when the free pieces are the small islands, the same edge seemed
to mark the gaps. An edge looks the same from both sides. Raising the free
pieces, with a small shadow and a line of light on their top-left edges,
marked the right pieces, but was far too subtle to tell at a glance.

When a piece locks, once the pieces in flight have landed, its ring fades
and the heavier lead grows round it (280 ms). The whole group it joined lifts, shakes and
settles as one composite piece (480 ms), its glass and lead moving
together, growing and turning only as far as keeps its edge within a few
pixels, so a large group stays calm. All with a soft two-note chime
(`LOCKED`, about -27 LUFS, between a swap's clink and the solved chime).
The chime waits for the flight in the audio view's own update step, and is
left out when the swap solves the window.

## 6. Levels

| Level | Pieces | Closest pair (OKLab) | Locked | Symmetries |
| --- | --- | --- | --- | --- |
| Easy | 40 | 0.030 | 8 (20%) | 5, 7, 8, 10, 12 |
| Medium | 70 | 0.022 | 10 (14%) | 5, 7, 8, 10, 12 |
| Hard | 110 | 0.016 | 11 (10%) | 5, 8, 10 |
| Expert | 150 | 0.012 | 12 (8%) | 5, 8, 10 |

These are starting points to playtest. Two warnings:

- Expert's 0.012 is below CSS's just noticeable 0.02. Two large patches side
  by side can be told apart at smaller differences than that, which is why
  it is possible, but screens differ, and a phone's night mode or a dim
  screen makes it harder. Playtest on a phone before fixing it.
- The gap between tiles changes how hard the puzzle is: colours that touch
  are easiest to compare, and a wide dark gap makes small differences harder
  to see. Keep it a hairline, the same at every level.

## 7. Playing It

- **Drag to swap.** Press on a free piece and drag it. The piece lifts
  (drawn slightly larger, with a shadow, and on touch, drawn above the
  finger so the finger doesn't hide it). The tile under the pointer is
  outlined. Let go on a free tile and the two swap. Let go on a locked tile,
  off the picture, or where it started, and nothing changes. Pointer
  following uses `listenToPointer` from the site kit (094). Its other layer,
  `createGridGesturesViewModel`, is for grids, so this entry needs its own
  small view model: press, drag over tiles, drop.
- **Tap two pieces.** Tap one to pick it up, tap another to swap. Easier for
  thin tiles, and for players who find dragging hard. Tap it again to put it
  down.
- **Which tile is under the pointer** is a question about the tiling's
  geometry, in tile edges, so it is the model's (`tileAt(x, y)`), and the
  view turns pixels into tile edges first. A point in a rhombus test over
  160 tiles is cheap, and runs only on pointer events.
- **Free pieces** have a white ring, and locked groups heavier lead round
  them (section 5.4). Locked pieces don't respond to a press.
- **Hints about rightness only at the locks.** A piece put in its place
  next to the locked pieces locks (section 5.4), so it shows that it is
  right. Anywhere else, neither the picture nor the sound says whether one
  piece is in place. That would turn the puzzle into trial and error.
- **Undo**, a swap at a time, and saves kept in the browser.
- **Swaps counted**, with the fewest possible shown once solved (section 5.3).
- **Swapping, seen.** A dragged piece grows a little under the finger as
  it lifts. Let go on a tile of its shape, and it turns where it is to point
  the tile's way, then settles in, while the other piece lifts and flies
  across, turning as it goes. Two taps and undo send both pieces flying. A
  tile stands empty, dark lead, until its new piece lands. A piece let go
  where it can't swap settles back home.
- **Solved:** a celebration in two acts, once the last pieces land
  (chosen after the third playtest, from five ideas). First a ripple
  spreads from the piece swapped last, neighbour by neighbour, each piece
  popping and flashing with a sparkle at a corner, and as it reaches the
  frame the window pulses and light sweeps across it. Then the window steps
  back to 78%, making room for the floor, and the sun comes up behind it:
  the pieces light up from the middle out, the lead turns white, inside a
  rim that stays dark, with a soft glow along it that shimmers as glints
  travel slowly across, and beams of light, each the colour of the glass it
  shines through, come out below the window onto the floor, where the
  window's colours land in a soft, blurred pool, turned over and squashed
  as light from above and behind would cast them. Dust drifts down the
  beams, and they breathe slowly. In front of it all, shimmering god rays
  of warm sunlight fan out from the sun, above the window and to its left,
  added to what is beneath them, as light is: each sways a little, flickers,
  and carries a glint down its length now and then (asked for in the fourth
  playtest). About 3.5 seconds in all. A window opened
  already mended is shown whole, as it was before its celebration, with no
  sun (fifth playtest). (Grey lead looked dull; the
  glow, tried first for locked groups, suits a finished window, where it
  marks no boundary.)
- **Sound** on the Audio90, a few soft effects levelled by loudness beside
  Sudoku's and Minotaur's: a light clink of glass as a piece lifts, a
  fuller one as two swap, a softer one for undo, and a solved chime that
  climbs with the sweep of light.

As Minotaur does, gestures only report, and the top-level view wires them to
the model's actions, so the model's actions stay primitive (`swap(a, b)`,
guarded so that it refuses a locked tile, a tile with itself, or a tile of
another shape).

## 8. Daily Puzzles and Saves

Everything is shared with Sudoku and Minotaur through `packages/sites/puzzles/src/shared/`:
the four levels, `createDailyRecords` under the game's id,
`createDailyCalendar` and `CalendarView`, and the way in (`IntroView`, the
How to play card, and a walkthrough). Its seeds come from a
`findPuzzleSeed(day, level)` like Minotaur's, which must never change once
players have puzzles made from them.

**The random source.** Minotaur's `createRandom` (xorshift32) is what this
puzzle needs too. Move it to the shared models rather than copy it, since
two puzzles now use it, and pass it into the puzzle maker, as 073 asks.

**A save** holds a description of the puzzle and the arrangement: which
piece is on each tile. As Minotaur's does, it is ignored unless it was kept
for the same puzzle. The description is short: the symmetry, the count, and
a checksum of the tiles' colours and locks. So a puzzle made differently,
by a changed generator or a different browser, never takes on a save made
for another.

**The same in every browser.** Section 3.2 keeps the tiles the same. The
colours take the same care: the drawn values are rounded (hues to whole
degrees, the scale to steps of 1/1024), and decisions that compare floats
leave a margin. A test makes the same days' puzzles in Chromium, Firefox and
WebKit, through Playwright as the visual tests do, and checks they agree
exactly.

## 9. Building It

Where it goes: `packages/sites/puzzles/src/entries/<id>/`, beside Minotaur,
with the usual `start/`, `data/`, `models/` and `views/`.

**Models** (pure, unit tested):

- `multigrid-tiles.ts`, moved from the demo (section 3.1).
- The patch: exactly N tiles, rim pruning, neighbours from grid lines, and
  `tileAt(x, y)` (sections 3.2-3.4).
- Colour: OKLab and OKLCH to and from sRGB, the gamut's largest chroma, and
  the colour-blindness simulation used by the colour vision setting.
- The gradient maker: the field of section 4.3, the bisection on the
  closest pair, and the colour vision field of section 4.6.
- The puzzle maker: symmetry, patch, gradient, locks, jumble, from the
  level and a random source.
- The puzzle: which piece is on each tile, swaps, undo, swaps counted,
  pieces still out of place (kept as a count, so solved is known at once),
  saves.
- The game: the calendar, levels, records, the intro and the walkthrough,
  as Minotaur's.

Colours are the picture, so the model owns them, as 0xRRGGBB. They are sRGB
by construction, since the gamut they are made in is sRGB's, so every
screen shows the same puzzle, as closely as its calibration allows.

**Views:** the board, in plain TypeScript, since it mostly draws polygons:
one Pixi `Graphics` for the gaps and outlines, and the tiles' fills redrawn
only when the puzzle's `version` rises. The drag and tap gestures as a view
model. A lifted piece and the swap's short cross-fade, as presentation
state. The audio view. The game view in JSX, wiring the gestures to
`swap`. The calendar, card and walkthrough are the shared ones.

**The walkthrough**, on a small practice puzzle (about 20 pieces, 5-fold,
a wide gradient, from a fixed seed): drag a piece to where it belongs; tap
two pieces to swap them; the marked pieces are locked; finish the picture.
Its demos are drags and taps on tiles, from the puzzle's own solution.

**Tests:**

- The patch: exact counts at every level, no rim tile with one neighbour,
  neighbours from grid lines agree with matching corners, and the 20-pixel
  rule of section 3.3 for every symmetry allowed at every level.
- The gradient: every level's puzzles, over many seeds, meet their closest
  pair target after rounding to 8 bits, and stay in the gamut.
- The colour conversions against published OKLab test values.
- Seeds give the same puzzle every time, two days pinned, and the same in
  three browsers (section 8).
- The puzzle: swaps, undo, the locked guard, solved, the fewest swaps, saves
  read back and rejected.
- Visual tests for each view, a thumbnail and a share picture.

## 10. Open Questions

1. **The name.** Settled: Rosette (section 2), renamed from Glass
   Smith on 2026-11-13. The puzzle is for the site only, so a web search
   for clashes was enough.
2. **Credit.** Settled: none. It is our own take on a common kind of
   puzzle (section 2).
3. **Levels.** The sizes, closest pairs and lock counts of section 6 are
   first guesses for a playtest. Is Expert at 150 pieces too many for a
   phone?
4. **Symmetries.** Equal chances, or weight 5-fold, the real Penrose
   tiling, highest? And is 20 pixels the right width for the thinnest tile?
5. **Colour vision setting.** In the first release, or later? The spike
   shows it works, and it reuses everything but the gradient.
6. **The window's outline.** Settled by the third playtest: a frame
   (section 3.6), and each day has its frame, in turn, from 12. Still open:
   which of the 12 to keep, concave frames (arches of three lobes, an ogee,
   a cross), which need another way of cutting, and a rule that leaves past
   days' frames alone when the list changes after release.
7. **Swaps.** Show the fewest possible after solving, or keep it to the
   count? Keep a best per puzzle?
8. **Shapes.** Settled by the first playtest: a piece only swaps with one
   of its own shape (section 5.1). Swaps are now easier to find, so are the
   levels' closest pairs and piece counts still right?
9. **Small odd shapes.** How do the frame's smallest pieces look and play,
   once slivers have joined their neighbours? Playtest, and try other
   thresholds.
10. **Difficulty with a frame.** The frame gives the whole rim of the
    gradient, and the pieces beside it are easy. Retune the counts (pieces
    are bigger now, so more fit), and the closest pairs. Landmarks inside are
    taken out; bring them back only if a playtest asks. Playtest and think it through.

### Later ideas

Not for the first release, but worth keeping in mind:

- **A second gradient, or an image.** At harder levels, a second,
  contrasting gradient over the window, or a picture, so each piece's place
  is read from two things at once.
- **Globs.** Some pieces stuck together, so several neighbouring pieces move
  as one when dragged. A glob limits where its pieces can go, which can be
  used to rule out some solutions. What a glob swaps with is still to work
  out: perhaps only a matching group of the same shapes, laid out the same
  way.

## 11. Implementation Steps

1. Settle the open questions, and search the chosen name.
2. Move `multigrid-tiles.ts` into the puzzles package and point the Penrose
   demo at it. Its tests, and its visual tests' images, unchanged.
3. The patch: exact counts, rim pruning, neighbours, `tileAt`, and the
   symmetry rule, with tests.
4. Colour conversions, the gradient maker and its level targets, with tests
   over many seeds. Measure the warm lean (section 4.4) again.
5. Move `createRandom` into the shared models. The puzzle maker, seeds and
   two pinned days, and the three-browser check.
6. The puzzle model: swaps, undo, solved, the fewest swaps, saves.
7. The board view and its gestures, then the game view, sound and the
   way in.
8. Entry files, catalogue, details text, how to play, thumbnail and share
   picture.
9. Playtest with a mouse, and on a phone, at every level. Tune section 6.
10. The colour vision setting, if it isn't in step 4 to 7 already.
