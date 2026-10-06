# Review: don't merge the MVT Megademo

## Verdict

Don't merge it into the Arcade. The craft is real: careful code, an honest README, and tests that check what matters. The trouble is what the reader gets out of it. Of roughly 3,500 lines of non-test code, about 50 are the MVT parts of the program: one `update`, one `seek`, one `setRefresh` and the top-level view's wiring. Everything else is a software emulation of an 8-bit video chip plus the 1980s effects drawn through it. To follow any of it, a reader needs around 30 retro-hardware and graphics concepts. The MVT lessons it claims are taught more simply, and in some cases more convincingly, by entries already in the repo. And in several places it muddies the rules the repo exists to teach: domain-level model units, child-model composition, bindings, who owns pause, and originality. It is a fine homage to the demoscene. It is not a good MVT example.

## The complexity bill

All paths below are under `site/src/demos/demoscene/` on `demoscene-demo`.

- **Size.** 3,465 non-test lines in 50 files:
  - data: 1,018 (the font alone is 545)
  - models: 933
  - `views/chip`: 486
  - `views/painters`: 755
  - top-level views: 254

  On top of that: 490 lines of tests, a 123-line README and a 585-line proposal. To be fair, raw size is mid-pack. Fruit Machine (4,307), Neon Monsoon (4,949) and Falling Sand (3,549) are all bigger. So size alone is not the problem.
- **Where the size goes.** 1,396 lines import or write the `VirtualChip`. The chip is the C64's video chip (the VIC-II), modelled down to its memory layout:
  - `bitmapIndex` reproduces the chip's cell-by-cell bitmap addressing (`views/chip/virtual-chip.ts:203-205`).
  - `composeFrame` decodes four display modes bit by bit (`views/chip/compose-frame.ts:288-362`).
  - The multiplexer hands out sprite slots the way raster interrupts did (`views/chip/multiplexer.ts`).
- **Concepts a reader must hold.** None of these is MVT:
  - **The machine:** PAL frame geometry (384 x 272, 50 Hz), screen memory versus colour memory, character sets, hires versus multicolour text and bitmaps, 24 x 21 sprites with X/Y expansion, sprite priority and shared colours, hardware slots versus a sprite pool, opened borders, and the Pepto palette.
  - **The effects:** raster bars, FLD, tech-tech, DYCP, sine scrollers, colour washes and cycling, fade tables, plasma, and tape-loader stripes.
  - **The 3D part:** back-face culling, flat shading, ordered dither, a depth buffer, triangle fill and a parallax starfield.

  The README needs a whole "Where it cheats" section (lines 80-92) just to say how this differs from real hardware.
- **Layers between model and pixels.** For a single frame, a reader traces: ShowModel, then a part model's getter, then a closure `elapsedIn` that reads the parent's clock, then `paintShow`'s dispatch, then a painter, then the chip's memory and registers, then `composeFrame` plus the multiplexer, then a fade table, then RGB, then the texture. Compare Falling Sand's `GrainPixelsView`. It does the same "one texture a frame" job in about 75 lines: model, then pixels, then upload.

## How much of this is about MVT?

Very little. Searching the demo for the tick API and `update(` finds three hits:

- `models/show-model.ts:135-137`: `update(deltaMs) { if (!isPaused) seek(timeMs + deltaMs); }`
- `views/screen-view.ts:77`: the demo's only `setRefresh`
- the entry's `update`, which forwards to the model

Everything else falls into two piles:

- **Animation curves written as getters.** For example, `logo-part-model.ts:45-75` and `sprites-part-model.ts:139-162` are sine-and-smoothstep functions of `elapsedMs()`.
- **Software rendering.** The chip and the painters.

The README even says the view tree was set aside on purpose. Because `refreshView` refreshes parents before children, "a parent could not compose its children's output" (README lines 47-49). So the 15 effects are plain `paint*(chip, model)` functions that MVT's view tree never sees. A reader comes away knowing how DYCP works, not how to structure an MVT app.

The repo also defines MVT as "an architecture for frame-based **interactive** applications" (`packages/docs/architecture/index.md:3`). This entry's own README opens with "Nothing to play" (line 4). Its headline lesson is "a model that is only a function of time", and that holds only because there is no input. That is the one kind of program the architecture says it is not mainly for.

## Already taught elsewhere, more simply

I checked each lesson the demo claims (`demoscene-entry.ts` techniques; README "What it shows") against the vnext entries and docs.

| Lesson the demo claims | Already taught by |
| --- | --- |
| A view as a pure projection, no state | Fruit Machine's `shownReelPosition`. Each of its views eases the reel landing "as a pure function of the model ... with no state of its own" (`entries/fruit-machine/README.md`). That is in an interactive app, where it is actually hard. |
| Pixel-buffer rendering, one texture a frame | Falling Sand's `grain-pixels-view.ts` uses the same `BufferImageSource` setup. The proposal admits it "copies" this view (035, header). |
| What belongs in the model (the "second view" test) | Fruit Machine ships four real views of one model: Pixi, three.js, HTML and a terminal. The demo only argues this with a "remastered" view that does not exist (README lines 36-42). |
| Leap-safe models: seek, pause, thumbnails | The docs' timer example in `building-with-mvt/simulating-the-world/time-management.md` ("Time Leap Safety") and `iterating-with-confidence/testing-models.md`. Host-level pause is already in `runner/entry-host.ts`. |
| Index-addressed, allocation-free reads (`ballColAt(i)`) | Neon Monsoon's `BulletField` (`xOf(i)`, typed arrays) and Falling Sand's grains (`colOf(id)`), both at much larger scale. |
| Deterministic randomness | Neon Monsoon's seeded generators and Fruit Machine's seeded spins. |

What does that leave as new? The VIC-II, the multiplexer and the effects. That is the demoscene part, not the MVT part.

## Where it muddies the message

1. **Hardware units and limits in the model (rule M-domain).** The README sets its own test: a remastered view "would not care about character sets, colour clash or sprite slots" (line 41). The models fail it:
   - `sprites-part-model.ts:29-34`: `BALLS_PER_RING = 8`, documented as "how many sprites the machine can show on one line". Next to it, `MIN_RING_GAP_ROWS = 22 / 8`, "just more than a sprite is tall (21 lines)".
   - `show-model.test.ts:89` asserts that the model keeps "the sprite rings far enough apart for the multiplexer". So the model's correctness is defined by a limit inside the view.
   - `boot-model.ts:18` exposes `loadingFrame`, "whole 50 Hz frames ... which the loading stripes change on".
   - `cycleOffset` (`plasma-part-model.ts:15`) and `washPhase` (`logo-part-model.ts:25`) are measured "in steps of the colour cycle", which is a palette.
   - Positions throughout are in 40 x 25 character rows and columns, which painters multiply by 8 to get lines.

   M-domain says models use domain terms, not colours or presentation units. This is the opposite, and the demo calls itself the model/view example.
2. **Composition turned inside out (M-composition).** The rule is that parent models delegate `update` to their children. Here the seven part models have no `update` at all. Each reads the parent's clock through a closure (`show-model.ts:115-125`, `elapsedIn` at lines 149-152). It works, but a newcomer would learn a pattern the docs never describe.
3. **No bindings to learn from.** There are no query or relay binding functions in the demo, apart from two inline keyboard handlers. `ScreenView` is not the top-level view, yet it takes the whole `ShowModel`. The painters take part-model interfaces directly. Bindings are one of the four pillars in `AGENTS.md`, and this demo is silent on them.
4. **A second pause.** `ShowModel` has its own `isPaused` and `togglePause` (`show-model.ts:43, 57, 132-136`), and `DemosceneView` reads the keyboard itself. On vnext, "Pausing is the host's call" (`AGENTS.md`), and no entry builds its own `KeyboardInputView`; input belongs to the runner (`runner/pixi-stage.ts:120`). So the port is not purely mechanical: pause and input need redesigning.
5. **Hot paths and idempotence.**
   - The README admits about 850 bytes allocated per frame and 29 young-generation collections a minute (lines 110-114).
   - Every getter recomputes its closed form on every read, which is the opposite of H-cost's "cache derived values". For example, `sortRingNearestFirst` calls `ballDepthAt` inside an insertion sort's inner loop (`paint-sprites-part.ts`), and `ballColAt`, `ballRowAt` and `ballDepthAt` each recompute `morphAt`.
   - Under `?debug`, `refresh` reads `performance.now()` (`screen-view.ts:83, 87`), so a frame depends on wall-clock time and is no longer idempotent (rule V-idempotent).
   - `compose-frame.ts:280-282` and `multiplexer.ts:478-479` keep mutable scratch buffers at module level, shared by every instance, instead of using the closure-scoped state the style guide prescribes.
6. **Originality is close to the line.** The boot banner follows the C64 start-up screen line for line:
   - `'**** MVT SHOW SYSTEM  V1.0 ****'`, `' 64K RAM SYSTEM ...'`, `'READY.'`
   - then the stock loader messages, word for word: `LOAD"...",1`, `SEARCHING FOR`, `FOUND`, `LOADING`
   - in "the familiar colours" (`data/texts.ts:9-24`)

   The proposal promises "No Commodore ... boot banner" (035 line 49), and the rules say not to "closely follow someone else's artwork, even reworked". The entry text and README also name "C64" and "VIC-II" throughout, while the prose rule asks for describing by genre. The rules were written for games and `inspiredBy`, and they don't fit a hardware homage. That leaves the owner a judgement call that no other entry forces.
7. **New jargon and new upkeep.** The README and proposal introduce "painters", "virtual chip", "FLD", "tech-tech", "DYCP" and "badlines" to a repo that tries hard not to coin terms. Upkeep grows too:
   - a hash snapshot test (`paint-show.test.ts:43`, snapshot of 7 opaque hashes) that breaks on any cosmetic tweak and says nothing about what is right;
   - a benchmark case;
   - a 585-line proposal.

   None of this connects to the docs, which never mention the demo.

## Strengths, and why they don't change the verdict

The code is tidy and well commented. The "Where it cheats" section is admirably honest. The test that checks "seeking agrees with playing" (`show-model.test.ts:41`) is excellent. The chip's per-frame work allocates nothing. The font and logo are drawn from scratch. And it would look great on the wall. But polish is not relevance. Every strength here is a strength of the homage, and the costs land on the repo's message: a reader who opens it to learn MVT has to wade through 1,400 lines of VIC-II emulation, and comes out with unclear ideas about model units, composition and pause. Since the MVT lessons are already taught elsewhere, the entry adds upkeep and dilutes the Arcade's focus without adding teaching value.

## If it must stay

Each of these would change my mind:

- **Move it out of the Arcade.** Ship it as a separate showcase or an article ("what a closed-form model buys you"), not as an entry that sits beside the teaching examples.
- **Or make it earn its place as an MVT lesson:**
  - Build the "remastered" second view the README describes, which would actually prove the model/view split.
  - Move all hardware units and limits out of the models: normalised screen positions, no sprite-slot choreography, no palette steps.
  - Drop the in-model pause in favour of the host's.
  - Cut it to two or three parts, so the chip shrinks to what those parts need.

Without one of these, I'd leave it on its branch.
