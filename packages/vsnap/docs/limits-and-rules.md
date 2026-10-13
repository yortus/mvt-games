# Limits and Rules

vsnap gives the same images on every machine by giving up a few details,
which this page lists. It also lists the rules that tests follow, so that
their images don't change from one run to the next.
[How It Works](how-it-works.md) explains why each limit is there.

- [What the Images Leave Out](#what-the-images-leave-out)
- [Rules for Tests](#rules-for-tests)

## What the Images Leave Out

- **Images of HTML views have no text.** Layout and styling show, but the
  words don't. For a game's menus and panels, that is usually what
  matters, and a copy edit doesn't fail a test. Words that matter can be
  checked with assertions.
- **HTML views are captured at rest.** Animations are finished or
  cancelled, so an image shows where one ends, not a moment in it.
- **Canvas text uses the two test fonts,** not the view's own. A character
  that they lack, such as ★ or an emoji, is drawn as a box with its code
  point inside, so a change from one such character to another still
  changes the image.
- **Rotated `<img>` elements look a little jagged,** because smooth
  sampling rounds differently on arm64 processors.
- **Differences of 2 levels or less pass.** A real change is almost never
  that small.
- **The drawing is software's,** so it can differ a little from a real
  graphics card.

## Rules for Tests

- **Don't leave global state changed, or depend on real time.** Either can
  make images change from one run to the next. Canvas tests share one
  page, so a change that one test leaves behind affects the tests after it.
  That includes Vitest's `vi.mock` and `vi.stubGlobal`.
- **Make a Pixi texture in the pose, if pixel art and smooth tests share
  it.** A texture keeps the sampling that it was made with, which
  `pixelArt` sets as each pose starts. One that a module makes once and
  caches keeps the sampling of the test that made it, so a later test of the
  other kind would draw it differently, and its image would depend on which
  test ran first. A texture whose sampling is set when it is made, such as a
  spritesheet's, draws the same in every test.
- **Give each canvas font list a family that vsnap knows.** Canvas text
  is drawn in this package's own sans-serif or monospace font, picked by
  the first family in the list that vsnap knows. It knows the generic
  families (`sans-serif`, `serif`, `system-ui`, `monospace` and the like)
  and the common system fonts, such as Arial, Helvetica, Segoe UI, Roboto,
  Consolas and Menlo. Serif families are drawn sans-serif. So
  `'"Press Start 2P", monospace'` works, but `'"Press Start 2P"'` alone
  fails its test. Ending each list with `sans-serif` or `monospace` always
  works.

A run in a random order, `vitest run -p "visual-*" --sequence.shuffle`,
finds a test that breaks the first rule.
