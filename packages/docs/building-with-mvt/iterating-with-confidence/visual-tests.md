# Visual Tests

> How this project tests what its views look like: a short function that
> builds a view in a known state, a picture of it compared with one
> committed beside the test, and one command to accept an intended change.
> Hundreds of pictures run in seconds, and give the same result on
> Windows, Linux and macOS, with nothing to install beyond `npm ci`.

**Previous:** [Testing Views](testing-views.md)
**Related:** [Testing](testing.md) -
[Testing Models](testing-models.md) -
[Presentation State](../adding-visual-polish/presentation-state.md)

---

*Assumes familiarity with [Testing Views](testing-views.md), which says
when a picture is the right test and when an assertion is.*

## Writing One

A visual test is one call to `visualTest(name, pose, options?)`, from
`#testing` (the website's test harness), in a `*.visual.tsx` file beside
the view. The pose is a function that builds the view, in the state to
photograph, and returns it:

```tsx
import { describe } from 'vitest';
import { visualTest } from '#testing';
import { BUTTON_RADIUS } from './pixi-layout';
import { type SpinButtonMode, SpinButtonView } from './spin-button-view';

const MODES: readonly SpinButtonMode[] = ['spin', 'stop', 'disabled'];

describe('SpinButtonView', () => {
    for (const mode of MODES) {
        visualTest(mode, () => SpinButtonView({ mode: () => mode, radius: BUTTON_RADIUS }), { artStyle: 'smooth' });
    }
});
```

The harness refreshes the view, draws it, and compares the picture with
its reference, `__screenshots__/spin-button-view.visual.tsx/SpinButtonView-spin.png`
beside the test. Fixed [bindings](../../reference/glossary.md) make the
picture the same every run: one picture per state the bindings can show.

### Presentation state

A view with an update step (a
[stateful view](../../reference/glossary.md)) is advanced in the pose with
`advanceTime`, also from `#testing`. It steps models, then views, in
frame-sized steps, as the ticker does (the same idea as
[`advanceTime` for models](testing-models.md#advancing-time)):

```tsx
visualTest('counting up, 300 ms in', async () => {
    let amount = 0;
    const view = WinBannerView({ isShown: () => true, amount: () => amount, caption: () => CAPTION });
    // The win arrives after the banner is built, and the count catches up over time
    amount = WIN;
    await advanceTime({ views: [view], totalMs: 300 });
    return view;
}, { artStyle: 'smooth' });
```

A top-level view is posed through its model: make the model, act on it,
and pass both to `advanceTime({ models: [model], views: [view], totalMs })`.

### Options

| Option | Default | Use |
| --- | --- | --- |
| `width`, `height` | The view's bounds, plus a margin | A fixed picture size, or a crop from the top left |
| `background` | One dark grey for every test | So transparent areas show |
| `artStyle` | `'pixel'` | `'smooth'` for a view drawn with antialiasing and smooth textures |

`artStyle` should say how the view's game draws it. `'pixel'` draws hard
edges at whole-pixel positions and samples textures nearest-neighbour;
`'smooth'` antialiases and samples smoothly. A smooth view tested as
pixel art comes out jagged: consistent, but not as the game shows it.

### HTML and three.js views

An **HTML view** is tested in a `*.html.visual.tsx` file, which runs in a
page of its own, since a stylesheet stays in a page once imported. Its
text is drawn blank (see below), so its picture shows layout and styling.
A view styled by its entry's layout needs that layout round it: make the
same containing elements in the pose.

A **three.js view** is tested in a `*.visual.tsx` file like a Pixi one,
with two more options: `camera`, which makes the camera the picture is
taken with, and `scene`, which dresses the scene the view is drawn in as
its entry does (background, environment map, tone mapping). Pass the
entry's own dressing function, so the test and the game cannot drift
apart. A view that brings its own lights needs none.

### Whole entries

Every entry also has a picture of its whole screen, at the moment its
thumbnail is taken, from `entries/entries.visual.tsx` (Pixi entries) and
`entries/entries.html.visual.tsx` (element entries). A new entry gets
one without writing anything. These catch what no single view's test
sees (layout, layering, a view left out of its parent), so they change
with almost any change to an entry.

## Running and Accepting

| Command | What it does |
| --- | --- |
| `npm run test:visual` | Compares every picture. The first run downloads the browser |
| `npm run test:visual -- --picture SpinButtonView-spin` | Runs the tests whose pictures have that name |
| `npm run test:visual:update` | Also writes every picture that changed, or is new, as its reference |
| `npm run test:visual:environment` | Also rewrites the environment's fingerprint and calibration pictures (below), after a deliberate browser upgrade |
| `npm run test:visual:check-references` | Decodes every reference and checks its pixels against the hash it carries |

A changed picture fails its test with how many pixels changed, by how
much, and where, and the paths of three files: the reference, the actual
picture and a diff (the reference dimmed, the changed pixels in red),
under `.vitest/visual/`. If the change is intended, the message gives
the command that accepts that picture alone. A reference whose pixels
still match is never rewritten, so an update changes only what changed.

A run with no filters is a full run: it also lists any reference no test
compared with, left by a test renamed or deleted, and fails. The update
deletes those instead.

### In CI

Every push runs the visual tests on Ubuntu. When Playwright's version or
the harness changes, they also run on Windows and macOS. Every week, all
three run the tests in a shuffled order, which shows that no picture
depends on the ones before it, and check every reference's hash. No CI
job writes references: whoever changes a view updates them on their own
machine, and reviews the pictures with the code. A changed picture fails
its job with a note per picture on the run's page, and the actual and
diff pictures are uploaded with it.

## How It Stays Fast

The target is unit-test speed: hundreds of pictures in seconds, so that
adding one costs nothing and running all of them is routine.

- **One page for the run.** Every test file runs in the same browser
  page (HTML files apart): the libraries load once, shaders compile once,
  and one renderer draws every picture.
- **No screenshots.** A Pixi or three.js picture is read straight from
  the renderer.
- **Hashes, not images.** The page hashes the pixels and compares the
  hash with the one each reference file carries in its first bytes. Only
  a picture that changed is sent to Node to be compared, written and
  diffed.
- **Big smooth pictures are drawn smaller.** A size budget (`maxPixels`
  in `vitest.visual.config.ts`, 500,000 pixels) caps each picture. A
  smooth view over it is drawn at half resolution (or a quarter...), and
  the run's summary lists it; pixel art and HTML over it fail, saying to
  crop the picture or pose part of the view.

The run ends with a summary: how long pictures took (median and 95th
percentile), the slowest, and how much the references take, so a slow
test or a big picture is noticed when it is added.

## How It Stays Consistent

The same picture must come out the same on every machine, or tests fail
for reasons that have nothing to do with the view. Everything that
differs between machines is pinned inside the browser, with no container
or virtual machine:

| What differs | How it is pinned |
| --- | --- |
| The browser | Playwright's Chromium, its version fixed by the lockfile |
| WebGL and 2D drawing | Software rendering (SwiftShader), and software compositing |
| Random numbers | `Math.random` seeded the same before every test |
| Canvas text | Drawn as shapes from test fonts by the harness, not by the system's font engine |
| HTML text | A blank font: every character an empty glyph, 0.625 em wide; font sizes rounded to quarter pixels |
| Unstyled text fields | 20 characters wide, not the font's average character width |
| Rotated images | Sampled nearest-neighbour |
| Processor rounding | A tolerance of 2 levels of 255 per channel, which arm64 processors need for blurs and rotations |

Before any picture is compared, each run checks a fingerprint of the
browser (`visual-environment.json`) and draws a calibration set: a few
pictures covering antialiasing, gradients, blur, textures, text and
three.js lighting. If they differ, the run stops at once with one error
naming what differs, instead of failing every test.

### The compromises

Each pin trades a little fidelity for consistency, in the tests only:

- **HTML pictures have no text.** They show every box, border, image,
  control and underline, but not the copy, its colour or its weight, and
  lines wrap where 0.625 em per character puts them, not where the real
  font would. Copy that matters is checked by assertions.
- **Canvas text comes from two test fonts**, standing in for the
  families a game asks for. A family no test font stands in for fails its
  test, saying to add it.
- **Rotated images look a little jagged.**
- **A change of 2 levels or less in every channel passes.** A real change
  is almost never that small.
