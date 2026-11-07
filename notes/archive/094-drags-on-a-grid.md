# Proposal: Drags on a grid, handled one way

> Minotaur, Sudoku and Kwazy Cactii each follow a finger dragged over a grid
> with their own code, and each mixes that code with the game's own rules.
> This proposal splits drag handling into three layers: a Pixi helper that
> follows one pointer, a view model with no renderer that turns a pointer's
> path into steps between the places of a grid, and, in each entry, what
> those steps mean. The first two are shared, from the site kit. The third
> stays in the entry, wired where the top-level view connects controls to
> model actions.

**Status:** finished, 2026-11-07. Steps 1-6 in section 8 are done, with
unit tests, and every visual test's image unchanged. Playtested on a phone:
all three entries work well.

**Written:** 2026-11-07, against `main` at `dd3c1794`.

**Related:**
[Minotaur's gestures](../../packages/sites/puzzles/src/entries/minotaur/views/board-gestures-view-model.ts),
[Sudoku's gestures](../../packages/sites/puzzles/src/entries/sudoku/views/board-gestures-view-model.ts),
[Kwazy Cactii's pieces](../../packages/sites/arcade/src/entries/kwazy-cactii/views/board-view/pieces-view-model.ts),
the site kit's [`DragInputView`](../../packages/sites/site-kit/src/shared/drag-input-view.ts) and
[`SwipeInputView`](../../packages/sites/site-kit/src/shared/swipe-input-view.ts),
[Chapter 18](../../packages/sites/docs/chapters/18-growing-a-complex-view.md#example-a-press-that-turns-into-a-hold)
(a gesture in a view model).

| # | Decision | Section |
| --- | --- | --- |
| 1 | One Pixi helper, `listenToPointer`, follows one pointer over a container | 3 |
| 2 | One view model with no renderer, `createGridGesturesViewModel`, turns a path in cells into taps and steps between neighbouring places | 4 |
| 3 | What a step means (an edge, a cell selected, a swap) stays in the entry; game rules for it move to the top-level view | 5 |
| 4 | Kwazy Cactii's adjacency rule is asked of the model (`canSwap`), and its swap relay returns nothing | 6.3 |
| 5 | The site kit's drag and swipe views follow their pointer with the same helper | 6.4 |

## 1. What was there

| | Minotaur | Sudoku | Kwazy Cactii |
| --- | --- | --- | --- |
| Pointer wiring | 5 listeners in its board view | the same 5, copied | 4, with no `pointercancel` and no pointer id check |
| Units | cells | cells | pixels |
| Steps through places a fast drag skips | yes, four ways | no: a fast drag misses cells | not needed |
| How near a middle a drag must pass | cells 0.4, corners 0.32 | 0.38 | anywhere in the cell |
| Game logic inside | edges, corner geometry, draw or rub out from `markAt`, strokes | how a tap changes the selection, from `selection()` | the adjacency rule (repeating `trySwap`'s), a relay returning `boolean` |

Kwazy Cactii's two gaps were bugs: a second finger took over a drag, and a
cancelled touch (a phone's own gesture, say) left a drag that never ended.

Minotaur's view model did three jobs in one: following the pointer over a
grid (which lattice, how near counts, stepping through skipped places), the
maze's geometry (a step between cells crosses an edge, a step between
corners runs along one), and what a stroke means (its first edge decides
whether it draws or rubs out, and it is undone as one). Only the first is a
gesture.

## 2. The layers

1. **Following a pointer** (Pixi): which pointer, where it is in the
   container's pixels, and when it is let go or cancelled.
2. **Steps over a grid** (no renderer, in cells): taps, and steps from a
   place to a neighbouring place.
3. **What a step means** (the entry): a thin view model that turns steps
   into the entry's domain coordinates (edges, cells), and the game's rules
   for them, wired in the top-level view.

## 3. `listenToPointer`

In `@mvtjs/site-kit/shared`, beside the input views, named like
`listenToKeys`. It follows one pointer at a time, from a press on the target
until it is let go anywhere (`globalpointermove`, `pointerup`,
`pointerupoutside`), or cancelled. Positions are in the target's own
pixels. Without `onCancelled`, a cancel counts as letting go, as the drag
and swipe views want.

## 4. `createGridGesturesViewModel`

In `@mvtjs/site-kit/input`, since it needs no renderer. Positions are in
cells, so a test plays it directly.

- **Lattices.** A drag follows cells, or the corners where grid lines meet.
  With `lattice: 'nearest'`, a press nearer a corner than a cell's middle
  follows corners, as Minotaur's walls do. Places are numbered row by row:
  `cols` wide for cells, `cols + 1` for corners.
- **Reach.** A moving pointer reaches a place only near its middle
  (`cellReach`, `cornerReach`, half a cell by default, which is anywhere).
  The press itself starts at the place it lands in, or nearest.
- **Steps.** From the place reached last to the new one, one neighbour at a
  time, so a fast drag skips nothing. `four-way` goes the longer way first,
  for edges; `eight-way` steps diagonally too, so a drag past a corner takes
  no cell in.
- **Reports.** `onTapped(place, x, y)` for a press let go with no step,
  `onStepped(from, to)`, `onDragFinished()` and `onDragCancelled()`. Its
  state (`isPressed`, `lattice`, `pressedPlace`, `place`, `x`, `y`) lets
  presentation follow the finger, as Kwazy Cactii's dragged piece does.
- `isEnabled`, read at each press, ignores presses while it is false.
- No `update`: nothing is timed. A long press would follow Chapter 18.

One change of behaviour for Minotaur: the walk starts at the cell (or
corner) pressed in, even if the press is not near its middle. Before, it
started at the first place within reach. A press is a clear choice of cell,
so this reads as the player meant.

## 5. Where game rules go

What a control does is the view's concern, and the mapping to model actions
is wired in the top-level view, where it can be seen and changed. So:

- Minotaur's draw-or-rub-out rule is a stroke view model,
  `createStrokeViewModel`, which `PuzzleView` makes and wires to the
  puzzle's `startStroke`, `mark` and `finishStroke`. The board reports only
  `onDraggedOver(edge, mark)` and `onDragFinished()`.
- Sudoku's tap rule (take a cell out of several, clear the only one, or
  select it) is `findSelectionAfterTap`, which `PuzzleView` uses. The board
  reports `onCellTapped`, `onNoteLabelTapped` and `onCellsDragged`.
- Kwazy Cactii's adjacency rule is the model's, asked through `canSwap`.

## 6. Each entry

### 6.1 Minotaur

`MazeGrid` gains `edgeAlong(corner, other)`, beside `edgeBetween`: the
maze's geometry, with its corners numbered. The board's gestures view model
configures the shared one (`'nearest'`, `'four-way'`, reaches 0.4 and 0.32)
and turns each step into an edge. It knows nothing of marks.

### 6.2 Sudoku

The board's gestures view model configures the shared one (`'cells'`,
`'eight-way'`, reach 0.38), collects the cells a drag takes in, and finds a
tapped group note's label. A fast drag no longer skips a cell.

### 6.3 Kwazy Cactii

The pieces view model keeps its job, and its name (Chapter 18 links to it):
the pieces follow the drag, swap and settle. It drives the shared view
model in place of its own drag code, so it follows one pointer and ends a
cancelled drag without swapping. A piece slides towards the dragged one
only where the model says a swap could be made (`canSwap`). The swap relay
returns nothing, and the view model holds the swapped pieces in place while
the model plays out the swap it asked for.

One small change of behaviour: a drag that leaves the board keeps the last
cell it reached, so letting go just past the edge, over a neighbour, still
swaps. Before, a pointer off the board had no target.

### 6.4 The site kit's views

`DragInputView` and `SwipeInputView` follow their pointer with
`listenToPointer`. They behave as before.

## 7. Open questions

- **Places as numbers, or as rows and columns.** Numbers, as both puzzles
  already use them. Kwazy Cactii converts. Settled for now.
- **Where the view model lives.** In the site kit. It needs no renderer, so
  it could move to `@mvtjs/utils` once something outside the sites wants
  it.
- **Minotaur's stroke rule in the model.** The model already owns strokes,
  for undo. Keeping the rule in a view makes it a control's behaviour, which
  another view (a keyboard cursor, say) could do differently.
- **Tap to swap in Kwazy Cactii.** `onTapped` makes it cheap. A feature, not
  part of this.
- **Later.** Falling Sand's tank, Coral and the Boids' slider could follow
  their pointer with `listenToPointer`. Penrose Tiling's
  `gesture-tracker.ts` and Fractalscope's `pinch-tracker.ts`, for the DOM
  and two fingers, are near twins, and a candidate for a shared pinch
  tracker of their own.

## 8. Implementation steps

1. ~~`listenToPointer` and `createGridGesturesViewModel`, with unit tests.~~ Done.
2. ~~Minotaur: `edgeAlong`, the board's gestures, the stroke view model.~~ Done.
3. ~~Sudoku: the board's gestures, `findSelectionAfterTap`.~~ Done.
4. ~~Kwazy Cactii: the pieces view model on the shared one, `canSwap`.~~ Done.
5. ~~`DragInputView` and `SwipeInputView` on `listenToPointer`.~~ Done.
6. ~~Docs: Adding an Entry, and AGENTS.md's site kit folders.~~ Done.
