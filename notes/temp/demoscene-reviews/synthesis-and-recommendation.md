# The Demoscene Demo: Synthesis and Recommendation

Written 2026-10-06, after the two independent reviews in this folder
([for merging](review-1-for-merging.md), [against merging](review-2-against-merging.md)),
against `vnext` at `fafee01` and `demoscene-demo` at `bd03ae1`. Paths below
are on the `demoscene-demo` branch, under `site/src/demos/demoscene/`, unless
they say otherwise.

## Corrections to the reviews

The reviews are saved verbatim. Their substance checks out, but some line
numbers in the test and `views/chip/` files point past the end of the file.
The ones checked:

- The `hasUpdate` assertion is `views/screen-view.test.ts:37`, not 197-200.
- The golden-frame snapshot is `views/painters/paint-show.test.ts:58`. The
  file is 70 lines, so the advocate's 216-235 and 251-267 can't be right.
- The module-level scratch buffers are `views/chip/compose-frame.ts:57-59`
  and `views/chip/multiplexer.ts:60-61`.
- The model-level pause is at `models/show-model.ts:43, 57, 94, 132-136` and
  the sprite-limit constants at `models/sprites-part-model.ts:30, 34`
  (both confirmed).
- The boot banner (`data/texts.ts:11`) is `**** MVT SHOW SYSTEM  V1.0 ****`,
  while 035 promises "no Commodore boot banner" (line 49).

## 1. Is the closeness to the VIC-II unacceptable?

**The rules didn't change after the branch was made.** The originality
section was already in `site/src/games/README.md` at the branch point
(`c3dcf5a`), and 035 says it follows those rules "from day one". The only
addition since is the `inspiredBy` credit. So the problem isn't new rules;
it's that 035 drew the line more loosely than the rules read.

**Copying the architecture doesn't break the rules as written.** They
protect creative work: titles, characters, art, music and levels. A 40x25
grid, 8 sprites per line or 24x21 sprites are technical facts, and emulating
hardware is legitimate. Three things are still a problem, though:

- **The boot screen is unacceptable as it stands.** `data/texts.ts` copies
  the C64 start-up screen line for line: the `**** ... ****` banner,
  `64K RAM SYSTEM`, `READY.`, then the stock `LOAD"...",1` /
  `SEARCHING FOR` / `FOUND` / `LOADING`, "in the familiar colours". That is
  "closely follow someone else's artwork, even reworked", and 035 itself
  promises "no boot banner".
- **It doesn't match the line 045 draws.** 045 "borrows no name, register
  map or filter curve" from the SID. 035's chip maps its structures to
  `$0400`/`$D800` (035 section 3.2), copies the real bitmap addressing and
  sprite size, and uses the Pepto palette, which is measured from the real
  chip. Whatever line the repo picks, the two chips should be on the same
  side of it, and by 045's standard 035 is on the wrong one.
- **The prose names C64 and VIC-II throughout.** The rules ask for
  describing by genre, and `inspiredBy` credits a game, not a machine.
  That's a gap in the rules to decide either way.

So it's acceptable legally, but inconsistent. A fantasy chip fixes all three
cleanly.

## 2. A fantasy video chip in a package

**What it fixes:**

- **Originality.** It would use its own palette, its own sprite size and no
  memory map, keeping only generic limits like "N sprites per line", in the
  spirit of 045.
- **Most of the critic's complexity bill.** The chip stops being 1,400 lines
  of hardware emulation inside an entry and becomes something a learner can
  treat as a black box. To the demo it is what Pixi is to every other entry:
  the thing being drawn to. The painters then become an ordinary MVT view
  targeting an unusual renderer.
- **A home for the hardware limits.** "Sprites per line" becomes a
  documented limit of the chip, which gives a clear rule: models don't
  import it.

**What it doesn't fix:**

- **Size.** It shrinks the demo by about a third, not down to a small
  driver. The chip, font and palette (about 1,170 lines) move out. The
  models (933 lines) and painters (755 lines) stay, and the painters are the
  effect code. Getting to a small driver also means cutting parts.
- **The other problems.** It does nothing for the model-level pause, the
  hardware units in the models, the missing bindings or the allocation.

**A package with one consumer is speculative.** 045 justifies
`@mvtjs/sound` because every entry will use it. A video chip only the demo
uses doesn't meet that bar. The way to earn the package is to give it a
second consumer that fits the repo's message:

- A fantasy-chip view of an existing game, such as Galaxy Raiders, which 045
  already gives sound to. One model with a Pixi view and a chip view is the
  critic's top request ("build the second view"), and it's the best MVT
  lesson the chip could teach. Not yet checked: whether Galaxy Raiders'
  model would need changes for it.
- 045's open-question-9 Sound Test entry, which could draw its menus and
  voice scopes through the chip.

**One package or two: two.** Tree-shaking isn't the deciding factor:

- Entries load in their own chunks, so the video chip only ends up in the
  chunks that import it. ESM, `sideEffects: false` and subpath exports would
  guarantee it.
- 045 section 7.1 has the host own the sound chip, so it's loaded for every
  entry anyway.

The real question is whether the two belong together, and they share
nothing:

- **Owner:** the host owns the sound chip; a view owns the video chip.
- **Runtime:** an AudioWorklet versus a typed-array framebuffer uploaded to
  a texture.
- **Clock:** they keep time differently.

045 also presents `@mvtjs/sound` as every entry's sound, not as a retro
curiosity. A shared "fantasy machine" design note would give them a common
identity without coupling their releases.

## 3. Overall recommendation: somewhere in between, heavily changed

Don't merge the branch. Keep it as a reference, and rebuild a smaller second
version once the chip question is settled.

**Why not ditch it.** The closed-form model is a real lesson that no entry
teaches: a model that is a function of time, `update` as `seek(t + dt)`,
and a test that seeking agrees with playing. The critic's "already taught
elsewhere" table is convincing for pixel buffers, index-addressed reads and
seeded randomness, but weakest on exactly this point. The "MVT is for
interactive apps" objection is also weak, since `reordering-lists` is
non-interactive and already in the Arcade.

**Why not merge as is.** Both reviews agree on enough problems, from
opposite sides:

- a pause in the model, where vnext gives pause to the host
- hardware limits inside the models
- the missing second view
- about 850 bytes allocated a frame
- jargon that is never defined
- about 60% of the code being chip, painters and font

**What the second version would look like:**

1. **Sequencing.** 045 lands first. The fantasy video chip comes next, with
   a second consumer. The demo comes last, with music. Music also tests
   045's design: 045 keeps the song position in an audio view as
   presentation state, while this demo seeks freely. A demo whose music has
   to follow a seek is a good check that 045's music player can handle it.
2. **Cut to about four parts.**
   - Keep logo-and-scroller (the signature effects), sprites (the
     multiplexer and the whole-show no-drop test), credits, and perhaps
     plasma.
   - Drop the boot part (originality) and the 3D vectors part (about 370
     lines of rasteriser, the furthest from MVT).
3. **Apply the fixes both reviews agree on.**
   - Use the host's pause; keep left and right for skipping parts.
   - Express periods in beats.
   - No chip limits in models; the no-drop check becomes a view test.
   - Either make `ScreenView` the top-level view or give it bindings.
   - Fix the allocation and move the module-level scratch buffers into
     closures.
4. **Add the advocate's learner aids.**
   - A reading order and a "Try this" section.
   - A glossary.
   - A "Closed-form models" subsection in `time-management.md`, which is
     where the docs gain the most.
   - Cross-links with `reordering-lists`.
5. **Placement.** It goes in the Arcade, with its README saying plainly that
   it's an advanced showcase, not a first example.

If that sequence isn't worth funding, ditch it rather than merge it as is.
Merging now with only docs added is the one option to avoid.
