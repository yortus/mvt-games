# The Book: Follow-Ons

| Field    | Value      |
| -------- | ---------- |
| Priority | low        |
| Created  | 2026-11-01 |
| Updated  | 2026-11-01 |

## Description

Proposal [075](../../archive/075-docs-as-a-book.md) turned the docs into one
book, *Building Web Games with MVT*: seven parts of numbered chapters, a
conclusion, and appendices A to H, with examples that run in the page and a
PDF printed on each deploy. What its section 13.1 left open is here, with
the chapters numbered as they are now. Each item can be done on its own, or
dropped.

### The owner's calls

- **Arcade models that drop leftover time.** Chapter 6 says a model
  produces the same results at any step size up to the ticker's cap. Three
  entries fall short, and only their comments say so. Crumb Chase's
  `TileMove` drops the time past each tile, so a cat's 250 ms tile takes
  about 267 ms at 30 Hz and 300 ms at 100 ms steps, and the cats lose
  ground on the mouse as the frame rate drops. Burrow Bust's digger and
  enemies start each move at the timeline's playhead, dropping up to a step
  a tile (its rocks weren't checked). The fruit machine's celebration starts
  on the update after the last reel lands. Fixing them changes how they
  play.
- **Positional arguments in the sequence API.** `createSequence(defs)` and
  `createSequenceTracker(sequence, handlers)` take positional arguments,
  against the one-options-object convention that the book teaches. Chapter
  18 says so in an "In this book" aside. Change the library (and then the
  aside), or keep them as a documented exception.
- **Kwazy Cactii's board progress.** Chapter 6 says plainly that the board
  model exposes a progress for each phase (`swapProgress`, `matchProgress`,
  `settleProgress`), the shape the chapter advises against. Move the board
  to one `progress`, and then simplify Chapter 6's example, or leave it.
- **`for...of` on arrays.** `AGENTS.md`'s rule 5 says never to use it.
  Appendix C measures it as taking no extra time or memory, and rule
  H-loops (Appendix A, taught in Chapter 24) asks for an index loop. Make
  them agree, one way or the other.
- **The book's length.** It's about 106,500 words, up from 97,000 at the
  end of the restructure, with Chapter 1, Appendix H and the conclusion
  added. Chapters 18, 9 and 14 are the longest, at 4,000 to 4,700 words
  each. Decide whether a tightening pass is wanted.

### Small fixes

- **Two meanings of "pose".** Chapter 21's "Reading a Pose Once" uses
  "pose" for where something is drawn on the page. Chapter 17, v-snap and
  the glossary use it for arranging a view into a state for its image.
  Rename Chapter 21's.
- **`@mvtjs/pixi`'s README figures.** Its "What it costs" section
  (`packages/libraries/pixi/src/README.md`) quotes older figures than
  Appendix C's. It's a package's own docs, so it states its figures without
  the book. Update them from the benchmark tables.
- **The libraries' READMEs name the docs.** They link to "the MVT
  documentation", which is now a book.
- **A link not checked.** Chapter 1's link to React Three Fiber's
  "Performance pitfalls" page was written from memory.
- **Numbers written into the examples' code.** Some durations and sizes are
  still inline, such as a hurt flash's 400 ms in Chapter 18's player HUD,
  rather than named as tunables. Name them if readers would try changing
  them. Some examples' `main.ts` also have a Project section after their
  Tunables, and others don't.

### The playground and the print

- **The embed's size.** Agree the measured sizes (129 KB gzipped at first,
  the renderer once it runs, 176 KB more on Edit), as task 061 asked. The
  embed now loads only its own example's files, so measure again first. If
  the first load should shrink, the TypeScript transpiler could load only on
  Edit, with the examples transpiled at build time.
- **A speed control in the embed.** The examples about time (Chapters 5
  and 6) would gain from slowing the run, as the playground can.
- **Projects that tick their own views.** The playground updates the whole
  stage with the real frame time after the project's `update`. So
  `book/pause-and-slow-motion` (Chapter 5) hides its game layer from that
  and updates it itself, with the scaled time. An option for a project to
  run its own view updates would remove the workaround.
- **Text measured in an example.** `book-examples.test.ts` runs in Node,
  where Pixi can't measure text, so Chapter 21 has one example, not one for
  "Measurements Are Input". Running that test in the browser would allow
  one.
- **Helpers the examples share.** A frame-time meter and a seeded random
  source are copied into each example that needs them, in the testing and
  performance chapters. The playground could offer them as a library that a
  project may import, or the copies, which keep each example whole, could
  stay.
- **An index for the PDF.** A printed book usually has one, and it would
  help the reference chapters. The text never refers to a figure by number,
  so captions without numbers read fine.
- **`book/shield-on-the-clock` uses `setTimeout`,** on purpose (Chapter 4's
  broken shield). Its still assumes the 3-second timer hasn't fired within
  the few milliseconds the still takes. If the still is ever flaky, take it
  before the timer is set.

## Acceptance Criteria

- [ ] Each item is done, or dropped with the reason.
- [ ] After a change to the book, the docs build passes, every section
      anchor resolves, and `npm run print -w @mvtjs/docs` prints without
      losing text.

## Progress Log

- **2026-11-01.** Created from 075's section 13.1 as 075 was archived. Its
  items for the merge, Part IV's place, Kwazy Cactii's random source
  (already in task 073) and publishing the PDF were done.
