# Limits and Rules

v-snap gives the same images on every machine by giving up a few details,
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
- **HTML text is laid out as if every letter were 0.625 em wide,** which
  is the width of each letter of the blank font. So text wraps, is cut off
  with an ellipsis, and sizes the boxes that fit it, at other points than
  in the real font. A layout that is right in the image can still overflow
  in the page, and the other way round.
- **HTML views are captured at rest.** Animations are finished or
  cancelled, so an image shows where one ends, not a moment in it.
- **Canvas text uses the two test fonts,** not the view's own. A character
  that they lack, such as ★ or an emoji, is drawn as a box with its code
  point inside, so a change from one such character to another still
  changes the image. Text that a view measures, to wrap or fit it, is
  measured in the test fonts too, so a line that overflows in the view's
  own font may fit in the image.
- **Text that reaches a canvas in another way than its text calls is
  drawn by the system,** in the system's own fonts. Pixi's `HTMLText` is
  one example, since it draws HTML through an SVG image. Its images can
  differ between machines, so leave it out of visual tests.
- **Rotated `<img>` elements look a little jagged,** because smooth
  sampling rounds differently on arm64 processors.
- **Differences of 2 levels or less pass.** A real change is almost never
  that small. On a processor other than arm64, Vitest's `-u` still writes
  such a change to the reference.
- **Drawing is done in software,** so it can differ a little from what a
  real graphics card draws.

## Rules for Tests

- **Don't leave global state changed, or depend on real time.** Either can
  make images change from one run to the next. Canvas tests share one
  page, so a change that one test leaves behind affects the tests after it.
  That includes Vitest's `vi.mock` and `vi.stubGlobal`.
- **Make a Pixi texture in the pose, if pixel art and smooth tests share
  it.** A texture keeps the sampling that it was made with, which
  `pixelArt` sets as each pose starts. Say a module makes a texture once
  and caches it. The texture keeps the sampling of the test that made it,
  so a later test of the other kind draws it differently. Its image then
  depends on which test ran first. A texture whose sampling is set when it
  is made, such as a spritesheet's, draws the same in every test.
- **Give each canvas font list a family that v-snap knows.** Canvas text
  is drawn in v-snap's own sans-serif or monospace font. The first family
  in the list that v-snap knows picks which. It knows every generic
  family, and the common system fonts, such as Arial, Helvetica, Segoe UI,
  Roboto, Consolas and Menlo. `monospace` and `ui-monospace` are drawn in
  the monospace font. `sans-serif`, `serif`, `system-ui`, `ui-sans-serif`,
  `ui-serif`, `ui-rounded`, `cursive`, `fantasy`, `emoji`, `math` and
  `fangsong` are drawn in the sans-serif font. So
  `'"Press Start 2P", monospace'` works, but `'"Press Start 2P"'` alone
  fails its test. Ending each list with `sans-serif` or `monospace` always
  works.

A run in a random order, `vitest run -p "visual-*" --sequence.shuffle`,
finds a test that breaks the first rule.
