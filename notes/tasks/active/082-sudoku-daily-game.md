# Sudoku, a Game of Daily Puzzles with Doodled Notes

| Field    | Value      |
| -------- | ---------- |
| Priority | medium     |
| Created  | 2026-10-30 |
| Updated  | 2026-10-30 |

## Description

A game for the Arcade, `sudoku`: a Sudoku puzzle for every day, at each of
Sudoku Digger's five levels (081), made by the Digger's generator.

- **Daily puzzles.** Each puzzle's seed is the day's number (days since
  1 January 1970, by the date on the player's own clock) times five, plus
  the level's place. Every player gets the same puzzles on the same date,
  with no server, and a new day starts at their own midnight.
- **The calendar.** Tabs for the levels, and a month of days. Days from
  1 January 2026 to today can be played; later days cannot. A solved day
  is ticked, a started one pencilled, and today ringed.
- **Kept in the browser.** Under `mvt-arcade:sudoku:`: `records` (which
  puzzles are solved and started, named like `2026-10-30/medium`),
  `puzzle:<name>` (each puzzle's answers and doodles, checked against its
  givens on reading), and `level` (the tab chosen last). The Arcade's
  saved-game slot is not used, as it offers to resume one game.
- **Notes.** Tap a cell and pencil digits into it from a keypad of nine
  keys. Drag across cells in one row, column or box to note the digits
  they hold between them, as a group note across them, such as "2·8".
  Filling a cell takes it out of every group note. Undo takes back notes
  and answers. (Freehand doodling came first, then went: see the log.)
- **Filling in.** Double-tap a cell to open a number picker beside it, and
  choose a digit or Clear, or double-tap a digit's key with one cell
  selected. Digits that break a rule show in red.
- **Tutorial.** A walk through making notes, step by step, on a practice
  puzzle that is never kept. It plays the first time a puzzle opens, can
  be skipped, and plays again from the puzzle screen's How to make notes.
- **Sound.** Five soft Audio90 effects: the picker's tick, a digit's knock
  at its own note, a low double knock for a clash, an undo blip, and a
  solved chime. Notes are silent.

## Acceptance Criteria

- [x] The Digger exports a minimal generator, without growing the
      Arcade's first load.
- [x] Puzzles are the same for everyone on a day, at each level.
- [x] Past days back to 1 January 2026 play; future days do not.
- [x] Solved days are ticked, and kept between visits.
- [x] A tutorial the first time, which can be skipped and replayed.
- [x] Notes that are not drawn: pencil marks, and group notes across
      cells in one row, column or box.
- [x] A double tap fills in a cell, clearing its doodles.
- [x] Model, view and visual tests; thumbnail and share picture.
- [ ] Playtested in a browser, on a phone and with a mouse.

## Progress Log

- 2026-10-30: Created and built. The user chose the name "Sudoku" (after
  "Daily Sudoku" and "Sudoku Daily" were found in use) and the first day,
  1 January 2026. Models: day numbers, the puzzle (doodles, erasing,
  answers, clashes, undo, saves), the records, and the game. Views: the
  calendar, the day, the puzzle's screen, the board, the picker, buttons
  and the audio view. Then, at the user's request, strokes continue
  across cells. 82 tests in the entry (44 unit, 38 visual), the whole-screen
  test, and the home page budget pass. Left: a playtest in the browser.
- 2026-10-31: Freehand doodling proved fiddly on a phone. What the user
  wanted from it was notes across cells, such as a 2 and an 8 that must go
  in two neighbouring cells, in either order. Of five options offered, the
  user chose pencil marks plus group notes, keeping the pen. Added a Notes
  tool, the default: a tap selects a cell, a drag selects the cells it
  passes near the middle of, and a keypad of nine digits notes digits for
  the selection. One cell gets pencil marks; several in one row, column
  or box get a group note, drawn as tinted, ringed cells joined by a line
  and labelled "2·8". Tapping a label selects its cells. Notes are undone
  and saved like everything else, and fade once a cell of theirs is filled
  in. The screen grew to 540 by 768 for the keypad. 96 tests in the entry
  (55 unit, 41 visual). Left: a playtest in the browser, above all on a
  phone.
- 2026-10-31: The calendar follows the player's own time zone, not UTC,
  as the user asked: the starter reads today's date from the device's
  clock. A puzzle still belongs to its date, so players everywhere get the
  same puzzle for the same date, each at their own midnight.
- 2026-10-31: At the user's asking, group notes take no warm colours (they
  read as errors): violet, teal, olive, slate and petrol. Notes that share
  a cell no longer look joined: each takes a lane, its lines run from ring
  to ring rather than through the cells' middles, shifted to one side in a
  higher lane, and its rings nest inside the others' only in the cells
  they share. A note across a gap has its label half way along its line.
- 2026-10-31: The user preferred lines through the cells, so a note's lines
  run between its cells' middles again, stopping 0.14 of a cell short of
  each, so notes sharing a cell never meet there. Lanes still shift them
  to one side.
- 2026-10-31: Filling in a cell settles the group notes that hold its digit,
  as the user asked: the digit and the cell leave the note, a note with no
  digits left goes, and one left with a single cell becomes pencil marks
  there. A note that doesn't hold the digit stays, faded. Undo restores it.
- 2026-10-31: A group note never holds a filled cell, as the user asked:
  filling a cell takes it out of every note holding it, and the digit too
  if the note holds it; a save is cleaned the same way as it loads. Notes
  no longer fade. A note's line breaks where it crosses a filled digit,
  and its label moves along its lines to the nearest place that covers no
  filled digit.
- 2026-10-31: Double-tapping a digit's key fills the one cell selected with
  it, as the user asked, taking back the mark the first tap made (the
  model's new `fillCell`). With several cells selected, a double tap just
  toggles the group note twice. The undo it makes is not heard.
- 2026-10-31: In place of breaking, a note's line now rises in a gentle arc
  over each run of filled cells it crosses, as the user asked, passing
  behind their digits: the board draws the notes under the digits, which
  is safe as no label covers a filled digit.
- 2026-10-31: The user found the notes enough, so doodling is gone: the
  pen, the eraser, strokes and their saves (an older save loads, its
  doodles ignored). The tools are now Undo and How to make notes. Added
  the tutorial: a practice puzzle (seed 7, Easiest) stands in for the
  puzzle open, and a card at the top walks through selecting a cell,
  pencilling two digits, linking two cells, noting a pair, and filling a
  cell, moving on as each is done, with a ring pulsing round the keypad
  where it asks for digits. Skip or Play ends it, marked as seen under
  `mvt-arcade:sudoku:tutorial`. 106 tests in the entry.
- 2026-10-31: Fixed a hang going back to the calendar: the puzzle's screen
  stays built, hidden, in its `<Switch>` branch, and its update steps go on
  running (a hidden branch skips refresh, not update), so the board's
  watcher read the closed puzzle and threw every frame. The screen now
  keeps reading the last puzzle open. The whole-screen test now builds the
  screen before going back. Added the tutorial's hand: the tutorial model
  works out a demo for each step on the puzzle as it stands (a cell with
  room for two marks, the closest two cells in a unit sharing two
  candidates, a naked single to fill), and `TutorialHandView` acts it out
  on a loop, with a ripple for each touch and a trail for a drag; the
  card's texts now explain what the hand does, and the keypad's ring is
  gone. `candidatesAt` added to the puzzle model. Renamed the Evil level
  Hardest, here and in Sudoku Digger. Group notes lost their cell tints and
  rings at the user's word: just the line and its label.
- 2026-10-31: At the user's word: the tutorial's card now gives imperatives
  that the hand acts out (the fill demo taps the cell, then double-taps
  its digit's key, which the hand can show, rather than the picker); the
  hand is redrawn from the back, with knuckles along the fist and a nail
  on the pointing finger. A group note's cells are joined as a path (fewest
  steps that aren't side by side, then shortest), drawn as one unbroken
  line with gaps only at its ends, so an L is an L; its label goes half
  way along, on an L's corner.
  Then simplified the hand to a flat tap-icon silhouette (finger, fist,
  thumb bump, one outline), as the detailed one still looked odd.
  Then, at the user's word, an arrow in place of the hand:
  `TutorialPointerView`, a small accent-blue cursor arrow outlined in
  white, with the same moves, ripples and trail.
- 2026-10-31: An MVT review of both Sudoku entries, then every finding
  worked through at the user's word:
  - `<Switch>` (`@mvtjs/utils`) now skips a hidden branch's update steps,
    as `<List>` does for an empty slot (changeset `switch-gates-updates`),
    so `PuzzleView` reads `model.puzzle!` with no workaround.
  - The daily puzzles are pinned by `find-puzzle-seed.test.ts`, and each
    level's seed is a fixed number, not its place in `LEVELS`.
  - `sudoku-digger/sudoku-grid/` holds what both entries share: the
    grid's rules, the levels, and drawing helpers. The Digger's barrel
    exports them, as it exports the generator, at the user's word (a site
    alias, `#sudoku-grid`, came first). Sudoku imports the Digger as
    `#sudoku-digger`, an alias in the Arcade's `package.json`. Home page 58.4 KB (was 57.0):
    with no models importing the Digger's `data/` (its sounds), the
    bundler splits five small shared chunks out of `main`.
  - `DiggerModel` is built from children (`createGridFiller`,
    `createCellDigger`, `createGridShuffler`, `createSearchLog`), each
    stepping and saying what it did; the parent paces them from one
    `STEP_MS` table, and exposes `trying`, `filling`, `search`, `digging`,
    `shuffling` and `grading` sub-records. Moments are `CellEvent` records
    (`count`, `cell`, `digit`). `choosePlayback` replaces the writable
    `playback`. The daily puzzles and every image are unchanged.
  - `GridView` is two view models (flashes, shuffle motion) and two layers
    (cell backgrounds, cell contents). `BoardView` is four layers, a
    gestures view model, a double-tap tracker shared with the keypad, and
    one group-note layout, computed as the notes change, that both the
    drawing and the label hit test read.
  - `PuzzleModel` stands on `group-notes.ts` (pure functions),
    `undo-history.ts` and `puzzle-save.ts`, which checks a save and ignores
    a bad one rather than repairing it (the code for saves that never
    shipped is gone).
  - The tutorial arrow's show is `createTutorialPointerViewModel`, one
    `Sequence` per kind of show, with a ripple step alongside each touch;
    `puzzle-layout.ts` places cells and keys for the keypad, the picker
    and the arrow. Two arrow images changed: the arrow now eases with the
    shared smoothstep.
  - `ButtonView` takes `ValueOrGetter` for its label, `isLit` and
    `isEnabled` (the last two optional), so Skip and Play are one button.
    The Digger's stats panel is built from a list.
  - Not done: typing JSX text styles as `TextStyleOptions` (the JSX `style`
    prop won't take it); the keypad's take-back still counts in
    `undosDone`.
