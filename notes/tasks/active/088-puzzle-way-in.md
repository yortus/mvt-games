# One Way In for Every Puzzle

| Field    | Value      |
| -------- | ---------- |
| Priority | medium     |
| Created  | 2026-11-01 |
| Updated  | 2026-11-01 |

## Description

Make the way into a puzzle game the same in every game on the puzzles site,
for Sudoku and Minotaur now and for any game to come. Before this, Sudoku
had a tutorial of its own, which walked through making notes, and Minotaur
had a card of its rules.

- **A How to play card, for every game.** It shows a small example drawn by
  the game's own board, then the rules, then the controls, as a table of
  what each does and how. It has two buttons: Show me and Play. It shows by
  itself the first time a player opens any puzzle in the game, and again
  from a How to play button beside Undo.
- **A walkthrough, from Show me.** A card across the top gives one step at a
  time, with "step 2 of 5", while an arrow acts each step out on a practice
  puzzle. The practice puzzle stands in for the puzzle open, and is never
  kept.
- **Text written once.** Each game keeps its rules, controls and notes in
  `start/how-to-play.ts`. The card and the info panel both read it.
- **Shared code.** `packages/sites/puzzles/src/daily/` became
  `packages/sites/puzzles/src/shared/`. It holds the calendar and records,
  as before, and now the way in as well:
  - `createIntroModel`, with the phases hidden, card and walkthrough
  - `createWalkthroughModel`, whose steps are data, with demos of taps,
    double taps and drags on targets of each game's own kind
  - `IntroView`, `HowToPlayCardView`, `WalkthroughCardView`, and
    `PointerView`, Sudoku's arrow made generic
- **How to add a game.** The guide to adding an entry has a new section:
  "A Puzzle's Day and Its Way In".

## Acceptance Criteria

- [x] Every game's card shows by itself the first time a puzzle opens. The
      user chose this, for Sudoku too.
- [x] Sudoku's tutorial became its walkthrough: the same steps and demos.
- [x] Minotaur has a walkthrough: draw the path, draw a wall, rub out,
      undo, done.
- [x] One source for each game's text, read by the card and the info panel.
- [x] The shared parts are in `src/shared/`, which the user named.
- [x] Model, view and visual tests; the home page budget still passes.
- [ ] Playtested in a browser, on a phone and with a mouse.

## Progress Log

- 2026-11-01: Built at the user's word, after the user chose a card that
  shows the same way in every game, and the name `src/shared`.
  - Sudoku's tutorial model became data: `SUDOKU_WALKTHROUGH`, whose demos
    are worked out as before.
  - Sudoku's arrow became the shared `PointerView`, which builds its show
    from any list of touches, with Sudoku's timings.
  - The records' seen flag became `isIntroSeen`. It keeps the store key
    `:tutorial`, so a player who saw Sudoku's tutorial isn't shown the card.
  - Sudoku's "How to make notes" button and Minotaur's "Rules" button are
    both "How to play" now.
  - The shared screen size, `SCREEN_WIDTH` and `SCREEN_HEIGHT` (540 by
    768), is every puzzle's.
  - Each game's how-to-play text sits in a chunk of its own in the build,
    so the home page doesn't load it.
  - Tests: unit tests for the intro, the walkthrough, the arrow, and each
    game's walkthrough. Visual tests for the three shared views, and each
    game's card and walkthrough on its puzzle screen. Every old image is
    unchanged, apart from the button's label.
- 2026-11-01: At the user's word, Minotaur's drag no longer takes back its
  own marks as it goes back over them: a tap on a line is how to rub out.
  The note saying so is gone from its how-to-play text.
- 2026-11-01: Two changes at the user's word.
  - **The card shows as the game opens,** over the calendar, not after a
    day is chosen. `IntroView` moved from each puzzle's screen to the
    game's whole screen. A walkthrough started from the calendar plays on
    the puzzle's screen: the game's `phase` is `playing` while it plays,
    and the player is back on the calendar as it ends. The puzzle's screen
    says "Practice puzzle" (or maze) in place of the date while it plays.
    The card is now as tall as all it holds, centred on the screen, as
    Sudoku's five controls ran into its buttons.
  - **One way to fill a Sudoku cell: the keypad.** The user chose it over
    the picker. The picker is gone, with its double tap on a cell, its
    tick sound and its images. One cell the player filled in can be
    selected: double-tapping another digit changes it, and its own digit
    clears it (the model's new `clearCell`). A cell filled in alone stays
    selected, so it can be changed again.
- 2026-11-01: Two changes at the user's word.
  - **The same four levels in every puzzle:** Easy, Medium, Hard and Expert,
    as `PuzzleLevel`, `PUZZLE_LEVELS` and `LEVEL_NAMES` in `src/shared/`.
    Minotaur uses them as they were. Sudoku maps them onto Sudoku Digger's
    five (`GENERATOR_LEVELS`), whose own five stay, for the demo: Easy,
    Medium and Hard keep their seeds and puzzles, Expert is Hardest renamed,
    with its seeds, and Easiest is gone. The records take
    `formerLevelNames`, so what was kept under `hardest` is read as Expert.
    The pinned daily puzzles prove Expert's are Hardest's.
  - **Sudoku fills a cell by press and hold,** not a double tap. A tap on a
    key still pencils its digit in. Held for 450 ms with one cell
    selected, a key fills the cell, or clears it if the digit is there,
    with a bar filling along the key as it is held. The double-tap tracker
    and the keypad's taking back of a first tap's note are gone. The
    walkthrough's arrow shows a hold, a new kind of demo touch.
- 2026-11-01: The user found the walkthrough's hold looked like a tap. A
  hold now sends out no ripple. While it stays down, a faint ring sits
  round the touch, and a disc grows to fill it, over 1.1 seconds (it was
  0.7). That's the usual sign of a long press. The arrow's view model gives
  `holdProgress`, and a leg can touch down without a ripple (`touches`).
- 2026-11-01: At the user's word, the game shows the same hold ring as the
  demo, in place of the bar: `HoldRingView`, shared, at one size for both
  (`HOLD_RING_RADIUS`, 22 pixels, to fit a key). On the lit key, the one
  whose hold clears the cell, the ring is white on the blue.
