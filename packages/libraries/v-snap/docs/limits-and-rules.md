# Limits and Rules

v-snap gives you the same images on every machine. To do that, it gives
up a few details, which this page lists. The page also lists the rules
your tests should follow, so that their images don't change from one run
to the next. [How It Works](how-it-works.md) explains why each limit is
there.

- [What the Images Leave Out](#what-the-images-leave-out)
- [Rules for Tests](#rules-for-tests)

## What the Images Leave Out

- **Images of HTML views have no text.** You see the layout and styling,
  but not the words. For a game's menus and panels, that's usually what
  matters, and it means a change of wording doesn't fail a test. If some
  words do matter, check them with an assertion.
- **HTML text is laid out as if every character were 0.625 em wide.**
  That's the width of each character in v-snap's blank font. So text may
  wrap, or be cut off with an ellipsis, at a different point than in your
  real font. Boxes that size themselves to fit their text may come out a
  different size too. A layout that looks right in the image can still
  overflow in the real page, and the other way round.
- **HTML views are captured at rest.** v-snap jumps each animation to its
  end, or removes it if it repeats forever. So an image shows where an
  animation ends, not a moment in the middle of it.
- **Canvas text is drawn in v-snap's own fonts,** one sans-serif and one
  monospace, not in the fonts your view asks for. If a character isn't in
  those fonts, such as ★ or an emoji, v-snap draws a box with the
  character's code point inside. So changing one such character to
  another still changes the image. Text that your view measures, to wrap
  or fit it, is measured in v-snap's own fonts too. So a line that
  overflows in your font may fit in the image.
- **Text that reaches a canvas without the canvas's own text calls
  (`fillText` and `strokeText`) is drawn by the system,** in the system's
  own fonts. One example is Pixi's `HTMLText`, which draws HTML through an
  SVG image. Its images can differ between machines, so leave it out of
  visual tests.
- **Rotated `<img>` elements look a little jagged.** v-snap draws them
  without smoothing, because arm64 processors round smoothed, rotated
  images differently from other processors.
- **Small differences pass.** A pixel passes if none of its colour
  channels differs by more than 2, on a scale of 0 to 255. A real change
  is almost never that small. On arm64 processors, Vitest's `-u` leaves
  such a reference alone, since those processors round a little
  differently. On other processors, `-u` writes the change to the
  reference.
- **Drawing is done in software,** on the processor. So it can differ a
  little from what a real graphics card draws.

## Rules for Tests

- **Don't leave global state changed, or depend on real time.** Either
  can make images change from one run to the next. Every canvas test file
  runs in one shared page, and the tests of an HTML test file share their
  page too. So a change that one test leaves behind affects the tests
  after it. That includes a `vi.mock` or a `vi.stubGlobal` that you don't
  undo.
- **If pixel-art and smooth tests share a Pixi texture, make it in the
  pose.** Pixi fixes a texture's sampling, sharp or smoothed, when it
  makes the texture. v-snap sets the default sampling from the test's
  `pixelArt` option as each pose starts. Say a module makes a texture once
  and caches it. The texture keeps the sampling of whichever test made
  it, so a later test of the other kind draws it differently. Its image
  then depends on which test ran first. A texture that sets its own
  sampling, such as a spritesheet's, draws the same in every test.
- **Give each canvas font a family that v-snap knows.** v-snap draws
  canvas text in one of its own fonts, the sans-serif one or the monospace
  one. It picks one by looking through your CSS font list, such as
  `'Arial, sans-serif'`, for the first family it knows. It knows every
  generic family, and common system fonts such as Arial, Helvetica, Segoe
  UI, Roboto, Consolas and Menlo. `monospace` and `ui-monospace` use the
  monospace font, and every other generic family uses the sans-serif
  font. So `'"Press Start 2P", monospace'` works, but `'"Press Start 2P"'`
  on its own fails its test. If you end each list with `sans-serif` or
  `monospace`, it always works.

To find a test that breaks the first rule, run the visual tests in a
random order, with `--sequence.shuffle`, as
[Running the Tests](running-tests.md#commands) shows.
