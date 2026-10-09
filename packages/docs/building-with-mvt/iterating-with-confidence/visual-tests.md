# Visual Tests

> A visual test checks what a view looks like. It is a kind of
> [visual snapshot test](testing-views.md#visual-snapshot-testing), also
> known as visual regression testing. It builds the view in a known state,
> takes a picture of it, and compares the picture with a reference picture
> committed beside the test. In this project, hundreds of
> these tests run in seconds. They give the same result on Windows, Linux
> and macOS, and they need nothing installed beyond `npm ci`.

**Previous:** [Testing Views](testing-views.md)
**Related:** [Testing](testing.md) -
[Testing Models](testing-models.md) -
[Presentation State](../adding-visual-polish/presentation-state.md) -
[Sound and Music](../presenting-the-world/sound.md)

---

*Assumes familiarity with [Testing Views](testing-views.md). That page
says when a picture is the right test, and when an assertion is.*

## Writing a Visual Test

A visual test is one call to `visualTest(name, pose, options?)`. The call
goes in a `*.visual.tsx` file beside the view. `visualTest` comes from
`@mvtjs/visual-testing`, which is this repo's package for visual tests. The
`pose` argument is a function that builds the view in the state to
photograph, and returns it.

```tsx
import { describe } from 'vitest';
import { visualTest } from '@mvtjs/visual-testing';
import { BUTTON_RADIUS } from './pixi-layout';
import { type SpinButtonMode, SpinButtonView } from './spin-button-view';

const MODES: readonly SpinButtonMode[] = ['spin', 'stop', 'disabled'];

describe('SpinButtonView', () => {
    for (const mode of MODES) {
        visualTest(
            mode,
            () => SpinButtonView({ mode: () => mode, radius: BUTTON_RADIUS }),
            { artStyle: 'smooth' },
        );
    }
});
```

The harness refreshes the view, draws it, and compares the picture with
its reference. The reference for the first test is
`__screenshots__/spin-button-view.visual.tsx/SpinButtonView-spin.png`,
beside the test file. The view's [bindings](../../reference/glossary.md)
are fixed, so the picture is the same on every run. Write one test for
each state the bindings can show.

### Views With Presentation State

Some views have an update step, because they hold
[presentation state](../../reference/glossary.md). A pose advances such a
view with `advanceTime`, which also comes from `@mvtjs/visual-testing`. It steps the
models, then the views, in frame-sized steps, as the ticker does. It is the
same idea as [`advanceTime` for models](testing-models.md#advancing-time).

```tsx
visualTest('counting up, 300 ms in', async () => {
    let amount = 0;
    const view = WinBannerView({
        isShown: () => true,
        amount: () => amount,
        caption: () => CAPTION,
    });
    // The win arrives after the banner is built. The count then catches up.
    amount = WIN;
    await advanceTime({ views: [view], totalMs: 300 });
    return view;
}, { artStyle: 'smooth' });
```

A top-level view takes its model. To pose one, make the model, act on it,
and pass both to `advanceTime({ models: [model], views: [view], totalMs })`.

### Options

| Option | Default | Use |
| --- | --- | --- |
| `width`, `height` | The view's bounds, plus a margin | A fixed picture size. A size smaller than the view crops it from the top left |
| `background` | One dark grey for every test | The colour behind the view, so that transparent areas show |
| `artStyle` | `'pixel'` | `'smooth'` for a view that its game draws with antialiasing and smooth textures |

The `artStyle` option should say how the view's game draws it. The
`'pixel'` style draws hard edges at whole-pixel positions, and samples
textures nearest-neighbour. The `'smooth'` style antialiases edges and
samples textures smoothly. A smooth view tested as pixel art comes out
jagged. That picture is still consistent, but it is not what the game
shows.

### HTML and three.js Views

An HTML view is tested in a `*.html.visual.tsx` file. Each such file runs
in a page of its own, because a stylesheet stays in a page once it is
imported. The view's text is drawn blank, as explained below, so its
picture shows its layout and styling. Some views are styled by the layout
of the game around them. A pose for such a view builds the same containing
elements around it.

A three.js view is tested in a `*.visual.tsx` file, like a Pixi view. It
needs a `camera` option, which is a function that makes the camera for the
picture. Its `scene` option can set up the scene as the view's game does,
with a background, an environment map and tone mapping. Pass the game's
own setup function, so that the test and the game stay the same. A view
that brings its own lights needs no `scene` option.

### Whole Games

Every game and demo also has a picture of its whole screen, taken at the
moment its thumbnail is taken. In this project, a game or demo is called
an [entry](../../reference/glossary.md). Two test files make these
pictures for every entry in the catalogue: `entries/entries.visual.tsx`
for Pixi entries, and `entries/entries.html.visual.tsx` for the others. A
new entry gets its picture without any new code. These pictures catch
what a single view's test cannot see, such as layout, layering, or a view
left out of its parent. So they change with almost any change to an entry.

## Running Visual Tests

| Command | What it does |
| --- | --- |
| `npm run test:visual` | Compares every picture, the test harness's own first and then the website's. The first run downloads the browser |
| `npm run test:visual -- --picture SpinButtonView-spin` | Runs only the tests whose pictures have that name |
| `npm run test:visual:update` | Also writes each new or changed picture as its reference |
| `npm run test:visual:environment` | Also rewrites the browser's fingerprint and calibration pictures (see below). Run it only after upgrading Playwright on purpose |
| `npm run test:visual:check-references` | Decodes every reference, and checks its pixels against the hash it carries |

When a picture changes, its test fails. The message says how many pixels
changed, by how much, and where. It also gives the paths of three files
under `.vitest/visual/`. They are the reference, the actual picture, and a
diff. The diff shows the reference dimmed, with the changed pixels in
red. If the change is intended, the message gives the command that accepts
that picture alone. The update never rewrites a reference whose pixels
still match, so it changes only what changed.

These commands run from the repository's root. The package's
[README](https://github.com/yortus/mvt-games/blob/main/packages/visual-testing/README.md)
says how to give another package visual tests.

A run with no filters is a full run. A full run also lists every
reference that no test compared with, and fails. Such a reference was left
behind by a test that was renamed or deleted. The update deletes these
references instead.

### In CI

Every push runs the visual tests on Ubuntu. When Playwright's version or
the test harness changes, the tests also run on Windows and macOS. Once a
week, they run on all three systems in a shuffled order. That shows that
no picture depends on the tests before it. The weekly run also checks
every reference's hash.

No CI job writes references. Whoever changes a view updates its
references on their own machine, and commits them with the code, so that
reviewers see the pictures. When a picture changes, the CI job fails. The
run's page has a note for each changed picture, and the actual and diff
pictures are uploaded with the run.

## How the Tests Stay Fast

The aim is for visual tests to run at the speed of unit tests. Hundreds of
pictures should take seconds, so that adding one costs nothing.

- **One page runs every test file.** HTML files are the exception. The
  libraries load once, the shaders compile once, and one renderer draws
  every picture.
- **No screenshots are taken.** The harness reads a Pixi or three.js
  picture straight from the renderer.
- **Hashes are compared, not images.** The page computes a hash of the
  pixels, which is a short string worked out from them. Each reference
  file carries the hash of its own pixels in its first bytes. Only a
  picture whose hash differs is sent to Node, to be compared, written and
  diffed.
- **Big smooth pictures are drawn smaller.** The size budget is set by
  `maxPixels` in `vitest.visual.config.ts`, and is 500,000 pixels. A smooth
  view over the budget is drawn at half its resolution, or a quarter if
  needed. The run's summary lists each one. Pixel art and HTML over the
  budget fail instead. The message says to crop the picture, or to pose
  part of the view.

The run ends with a summary. It shows how long the pictures took, which
ones were slowest, and how much space the references take. So a slow test
or a big picture is noticed when it is added.

## How the Tests Stay Consistent

Each picture must come out the same on every machine. Otherwise tests
fail for reasons that have nothing to do with the view. The harness pins
everything that differs between machines inside the browser, so no
container or virtual machine is needed.

| What differs | How it is pinned |
| --- | --- |
| The browser | Playwright's Chromium. Its version is pinned exactly, in `package.json` |
| WebGL and 2D drawing | Software rendering (SwiftShader) and software compositing |
| Random numbers | `Math.random` is seeded the same before every test |
| Canvas text | The harness draws it as shapes from two test fonts, not with the system's fonts |
| HTML text | A blank font draws every character as an empty glyph, 0.625 em wide. Font sizes are rounded to quarter pixels |
| Unstyled text fields | They are 20 characters wide, not the font's average character width |
| Rotated images | They are sampled nearest-neighbour |
| Processor rounding | A tolerance of 2 levels of 255 per channel. Processors with the arm64 architecture need it for blurs and rotations |

Each run first checks a fingerprint of the browser, which the package keeps
in `visual-environment.json`. Then it draws a set of calibration pictures.
These cover antialiasing, gradients, blur, textures, text and three.js
lighting. If any of them differ, the run stops at once with one error that
names the difference. This saves a run from failing every test for the
same reason.

### The Compromises

Each pin gives up a little accuracy for consistency. The compromises
affect the tests only.

- **HTML pictures have no text.** They show every box, border, image,
  control and underline. They do not show the words, or the text's colour
  or weight. Lines wrap where 0.625 em per character puts them, not where
  the real font would. Assertions check the words that matter.
- **Canvas text uses two test fonts.** They stand in for the font families
  a game asks for. If a game asks for a family that no test font stands in
  for, its test fails and says to add the family.
- **Rotated images look a little jagged.**
- **A change of 2 levels or less in every channel passes.** A real change
  is almost never that small.

## Sounds Have the Same Kind of Test

An audio test checks a sound in the same way. It renders the sound in
memory, computes a hash of its samples, and compares the hash with a saved
reference. A change that alters the sound fails the test, until someone
has listened to it and accepted the new hash. See
[Audio Tests](https://github.com/yortus/mvt-games/blob/main/packages/audio/src/headless/README.md#audio-tests).
