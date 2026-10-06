# Review: MVT Megademo (`demoscene-demo`, bd03ae1), the case for merging

## Verdict

Merge it, after a learner-focused pass. The demo teaches the far end of the MVT spectrum, which no current entry reaches: a model that is a pure function of time, so seeking is free, with a view that keeps no state and is tested to stay that way. It also does the clearest job in the repo of explaining when *not* to build a view per object. The MVT core is small and readable. The models are 933 lines and most part models run 50-90 lines of getters. The bulk of the code (the virtual chip, painters and font, about 2,500 lines) is retro-hardware material, and that is where a learner could drown. The fixes are mostly about guiding the reader: a reading order, exercises, docs cross-links, and a few simplifications that bring it in line with vnext. None of them changes the design.

## What this teaches that nothing else does

I checked all 13 entries in `packages/website/src/entries/` on vnext, plus the docs.

1. **A closed-form model, where seeking is play.** `ShowModel.update` is literally `seek(timeMs + deltaMs)` (`models/show-model.ts:136`). Every part-model getter is computed from `elapsedMs()`, and the randomness is a stateless hash (`models/show-math.ts:33-42`, used for the stars at `models/vectors-part-model.ts:65-70`). No entry on vnext has a `seek`: grepping `entries/` finds none. Every game model builds up state through GSAP timelines or integration. The docs only touch on the idea. `time-management.md` "Time Leap Safety" says leap-safe models exist and tells readers to step small when unsure. `open-ended-phases.md:148-155` shows a single stateless `Math.sin(elapsed)` bob. This demo scales that idea to a whole program and shows what it buys: part skipping at `models/show-model.ts:129-131`, and a test that plays in uneven steps and checks seek agrees (`show-model.test.ts:41-56`).

2. **The mirror image of an existing demo.** `reordering-lists` is the other scripted, non-interactive entry. Its README says "All motion is view-side presentation state; the model is instantaneous." The megademo puts all motion in the model and none in the view. Together they make a ready-made lesson on where motion belongs, and each README should link to the other.

3. **A view tested to keep no state.** `views/screen-view.test.ts:197-200` asserts `hasUpdate(view) === false`. No other test in the repo asserts this. Fruit Machine's `shownReelPosition` is a stateless easing helper, but nothing tests that a whole view stays stateless.

4. **Child models that read a parent's clock instead of being updated.** The part models have no `update`. Each gets `elapsedMs: () => number` from the show (`models/show-model.ts:115-125`), clamped by `elapsedIn` (`:149-152`). The docs' only composition pattern is "Parent-Child Delegation" (`model-composition.md:14-45`), and no entry does it this way.

5. **Why one view and painters, not a view tree.** The README section "One view and painters" grounds the choice in a real MVT constraint: `refreshView` refreshes parents first, so a parent cannot compose its children's output. `view-composition.md` "When 1:1 breaks down" never mentions refresh order. Falling Sand does upload one texture per frame, but it does not run several effects through one set of compositing rules. The chip also acts as a middle layer between the model and Pixi that you can test without Pixi: `compose-frame.test.ts` checks pixel colours from hand-built chip state.

6. **Choreography checked against a constraint across the whole show.** `views/painters/paint-show.test.ts:216-235` paints every 20 ms frame of the loop and fails with the time and part if any sprite is dropped. `paint-show.test.ts:251-267` adds golden-frame hashes. No other entry uses `toMatchSnapshot`, and none checks an invariant over an entire timeline.

7. **Domain units for something that isn't a board game.** Rule 6 is usually shown with grid games. Here the model speaks in character rows and columns, turns, beats and object space (`models/logo-part-model.ts:14-25`), and the README states a usable test for what belongs in the model: anything a second view would need.

## What works well for learners

- **The models are small and readable.** `logo-part-model.ts` is a handful of documented getters. `boot-model.ts` shows a phase machine as nothing more than `if (t < X) return ...`.
- **The tests read as specifications**, for example "is black at every change of part" and "keeps the sprite rings far enough apart for the multiplexer".
- **The README is honest.** It has a "Where it cheats" list and measured performance, including the allocation figure that doesn't flatter it.
- **`?debug` raster-time bars** make per-frame cost visible inside the demo, the way the era did (`screen-view.ts:145-156`).
- **Constraints live in the data shapes.** One colour byte per cell means colour clash cannot happen by accident (`views/chip/virtual-chip.ts:13-18`). It's a nice general lesson about types carrying rules.

## Recommended changes to help learners more

In priority order.

1. **Add a reading order and split the README in two.** Put a "Start here" path near the top: `data/script.ts` → `models/show-model.ts` → `models/logo-part-model.ts` → `views/painters/paint-show.ts` → `views/screen-view.ts`. Then add a one-line note that `views/chip/` is the retro-hardware layer and is optional for the MVT lesson. Separate "MVT lessons" from "C64 lessons". Also add a short pipeline diagram: model → painter → chip memory and registers → `composeFrame` → fade table → texture.

2. **Add a "Try this" section that uses the existing tests as guardrails.** For example:
   - Set `BALLS_PER_RING` (`models/sprites-part-model.ts:30`) to 9. The no-drop test fails with the exact time, and `?debug` shows red lines.
   - Reorder `SHOW_SCRIPT` (`data/script.ts:21-29`). Everything still works, because parts are looked up by kind.
   - Add a counter that accumulates in a part model. The seek-versus-play test catches it.
   - Change `BEATS_PER_MINUTE` and see what re-times.

3. **Express the part models' periods in beats or bars.** `logo-part-model.ts:53,57,61,71,74` (9600, 1100, 4300, 1600, 70 ms), `plasma-part-model.ts` (2900, 4100, 6700...) and `sprites-part-model.ts` (5200, 4100, 1700) are raw milliseconds. Changing the tempo therefore re-times only some of the show, which undercuts "cut to a beat". Named constants in `MS_PER_BEAT` units also turn the exercises above into one-line edits. `credits-model.ts` takes `msPerBar` as an option while every other model imports `MS_PER_BAR`; pick one.

4. **Remove the model-level pause when porting.** vnext says "No entry knows about pause" (`packages/website/src/runner/pixi-stage.ts:83-84`; `entry-host.ts:28`). `ShowModel.isPaused` and `togglePause` (`show-model.ts:43,57,94,132-136`) and the Space binding (`views/demoscene-view.ts:33`) duplicate the host's pause and would teach the opposite. Keep left and right for `skipParts`, since that demonstrates free seeking.

5. **Make "what belongs in the model" concrete.** Either build a tiny second view, or leave a scaffold for one as an exercise. Even a Pixi `Graphics` view of just the sprites part, drawing 48 smooth circles from `ballColAt`, `ballRowAt` and `ballDepthAt`, would do. Fruit Machine proves "one model, many views", so link to it. Also name the one place the hardware leaks into the model: `MIN_RING_GAP_ROWS = 22 / 8`, "just more than a sprite is tall" (`sprites-part-model.ts:33-34`), and `BALLS_PER_RING` being "how many sprites the machine can show on one line". That contradicts the README's claim that the model "would not care about sprite slots". It is defensible, because a choreographer designs for the stage, but a learner deserves a paragraph explaining why.

6. **Add docs cross-links in both directions.**
   - In `time-management.md` "Time Leap Safety", cite this as the leap-safe-by-construction example, and add a short "Closed-form models" subsection.
   - In `model-composition.md`, add the clock-reading children pattern.
   - In `view-composition.md` "When 1:1 breaks down", add painters and the parents-first refresh order.
   - In `testing-views.md`, add golden-frame hashing and the `hasUpdate` assertion.
   - Link `reordering-lists/README.md` and this README to each other.

7. **Add a glossary.** FLD, DYCP, tech-tech, raster bar, multiplexer and multicolour mode are used everywhere without definitions. One line each in the README would do.

8. **Add a "How to add a part" checklist.** Adding a part means touching `PartKind` and `SHOW_SCRIPT`, a new part model, the field and index lookup in `show-model.ts:98-125`, a painter, and the `paintShow` branch (`paint-show.ts:217-226`). Write that down. It also invites the stretch effects (rotozoomer, twister) as learner projects.

9. **Fix or teach the allocation.** At 848 bytes a frame against 17-204 for the other demos (proposal section 12.2), a hot-path learner might copy the pattern. Either compute the busy parts into typed arrays once per update, or present it in the README as a measured exercise with the bench command.

10. **Smaller nits.**
    - `writeText` (`paint-helpers.ts`) takes six positional arguments plus an optional seventh.
    - Only one `ScreenView` test destroys its view (`screen-view.test.ts:194`).

## Risks to manage

- **It has never been seen in a browser.** Proposal section 12.3 says the glow filter, the keys and the thumbnail are unverified. Check them before merging.
- **The port is more than a move.** On vnext the old `DemoEntry` becomes `start/entry.ts` plus `start/load.ts`, and pause moves to the host (change 4).
- **Hardware material can crowd out the MVT lesson.** About 60% of the code is the chip, painters and font. Changes 1, 2 and 7 are what stop it reading as a C64 tutorial with MVT incidental.
- **The README's performance figures** will go stale; date them or point to the bench suite.

Files reviewed: everything under `site/src/demos/demoscene/` on the branch (extracted at `C:/Users/Troy/AppData/Local/Temp/claude/v--projects-mvt-games/09934ebe-4060-4e13-9c5c-f807d8e8384d/scratchpad/demoscene-branch/`), `notes/proposals/035-demoscene-demo.md`, all vnext entry READMEs and `start/entry.ts` files, `packages/website/src/runner/`, and the relevant pages under `packages/docs/building-with-mvt/`.
