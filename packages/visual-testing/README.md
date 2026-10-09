# @mvtjs/visual-testing

> Visual tests for views, made as convenient as unit tests. A visual test
> is a kind of snapshot test, also known as visual regression testing. A
> snapshot test compares a test's output with a saved copy, and a visual
> test compares a picture. It builds a view in a known state, takes a
> picture of it, and compares the picture with a reference picture
> committed beside the test. To be as convenient as unit tests, visual
> tests must be fast, and must give the same result on every machine. This
> package runs hundreds of them in seconds. The pictures come out the same
> on Windows, Linux and macOS, and nothing needs installing beyond `npm ci`.
> It covers Pixi, three.js and HTML views. The package is private for now.

**Related:** [Visual Tests, in the MVT guide](../docs/building-with-mvt/iterating-with-confidence/visual-tests.md)

---

## Writing a Test

A test is a declaration in a `*.visual.ts` or `*.visual.tsx` file beside
the view. A Pixi or three.js view is declared with
`canvasTest(name, options?, pose)`, and an HTML view with
`htmlTest(name, options?, pose)`. The options (if any) come before the pose,
as they do in Vitest's `test`. The `pose` function's only job is to return a
view that has been arranged into the pose that the test describes.

```tsx
import { describe } from 'vitest';
import { canvasTest } from '@mvtjs/visual-testing';
import { HudView } from './hud-view';

describe('HudView', () => {
    canvasTest('at the start', () => HudView({ score: () => 0 }));
    canvasTest('a high score', () => HudView({ score: () => 98_765 }));
});
```

The reference for the first test is
`__screenshots__/hud-view.visual.tsx/HudView-at-the-start.png`, beside the
test file. `advanceTime({ models, views, totalMs })` advances a view with
presentation state, in frame-sized steps, before its picture is taken.
[Visual Tests](../docs/building-with-mvt/iterating-with-confidence/visual-tests.md)
describes the options, HTML and three.js views, and how failures read.

### One Kind of Test in Each File

The tests run in a browser. Vitest loads each test file into a browser
page, much like a tab, and the views are drawn in that page. The two kinds
of test need their pages arranged differently.

- **Canvas tests share one page.** Every file of canvas tests runs in the
  same page, one file after another. The libraries load once, the shaders
  compile once, and one renderer draws every picture. That is what lets
  hundreds of pictures take seconds.
- **Each file of HTML tests gets a fresh page.** This is because html views use stylesheets, which can't be unloaded from a page, so the fresh pages ensure that
each view gets only its own styles.

A file runs in one page, so it declares one kind of test only. When the
config loads, the package reads each file's declarations, and sends the
file to the right kind of page. A file that declares both kinds, or
neither, stops the run with an error.

## Setting Up a Package

A package that has visual tests needs three things.

1. A dev dependency on `@mvtjs/visual-testing`.
2. A `vitest.visual.config.ts` beside its `package.json`, which makes one
   Vitest project for each kind of page:

   ```ts
   import { defineConfig } from 'vitest/config';
   import {
       createVisualProject, createVisualReporters, DEFAULT_MAX_PIXELS,
   } from '@mvtjs/visual-testing/node';

   const options = {
       maxPixels: DEFAULT_MAX_PIXELS,
       viteConfig: './vite.config.ts',
   };

   export default defineConfig({
       test: {
           projects: [
               createVisualProject({ kind: 'canvas', ...options }),
               createVisualProject({ kind: 'html', ...options }),
           ],
           reporters: createVisualReporters(),
       },
   });
   ```

   `viteConfig` is the package's own Vite config, for the plugins and
   aliases its views need.
3. Scripts that run the package's command:

   ```json
   "test:visual": "visual-tests",
   "test:visual:update": "visual-tests --update",
   "test:visual:check-references": "visual-tests check-references"
   ```

### Why a Separate Config

Vitest can run Node projects and browser projects from one config, so the
visual projects *could* join a package's `vitest.config.ts`. They have a
config of their own for two reasons.

- **Unit tests stay fast, and need no browser.** A run with visual tests
  starts a browser, and its first run downloads one.
- **The `visual-tests` command does work that a config can't.** It
  installs the browser if it is missing, and runs Vitest with tsx's loader.
  It also tells the run whether every test ran. The check for references
  that no test uses depends on that, and Vitest does not tell a reporter
  which filters a run had.

To run every test with one command, a package's `test` script can run its
unit tests, then `visual-tests`.

## Commands

| Command | What it does |
| --- | --- |
| `visual-tests` | Compares every picture. The first run downloads the browser |
| `visual-tests --picture <name>` | Runs only the tests whose pictures have that name |
| `visual-tests --update` | Also writes each new or changed picture as its reference, and deletes references that no test uses |
| `visual-tests check-references` | Decodes every reference, and checks its pixels against the hash it carries |

This package's own tests and calibration set run with
`npm run test:visual -w @mvtjs/visual-testing`. After a deliberate upgrade
of Playwright, `npm run test:visual:environment -w @mvtjs/visual-testing`
rewrites the browser's fingerprint and the calibration pictures.

## How It Is Laid Out

The tests run in a browser, and the browser talks to Node through Vitest's
browser commands. So the package has two sides, and the messages between
them are defined once, in `src/protocol.ts`.

| Folder | What it holds |
| --- | --- |
| `src/browser/` | The side that runs in the test page. It holds `canvasTest`, `htmlTest` and `advanceTime`, which the main entry point exports. It also holds the picture code for each kind of view, and the page's setup. The setup pins random numbers, draws canvas text from two test fonts, and blanks HTML text |
| `src/node/` | The side that runs in Node. `@mvtjs/visual-testing/node` exports its Vitest projects and reporters. It also holds the browser commands, the PNG files, the comparison and the run's summary |
| `src/node/cli/` | The `visual-tests` command, its reference check, and the generator of the blank font |
| `src/browser/__screenshots__/` | The calibration pictures, and the pictures of this package's own tests |

`visual-environment.json` holds the browser's fingerprint, which every
machine's browser must match.

The Node entry point gives its TypeScript source both under the repo's
`@mvtjs/source` condition and as the default. Vitest bundles a config file
before it runs it, and the bundler knows no custom conditions. So the
default lets a package's config import this one. The command then runs
Vitest with tsx's loader, so that Node can run that TypeScript. The
command's `bin` entry is a small JavaScript file, which loads the command
through tsx.

## Achieving Speed and Consistency

The goal of this package is to make visual tests as convenient as unit
tests. Adding one should take no more thought than adding a unit test, and
running all of them should be as routine. That asks two things of them.
They must be fast, and they must give the same result on every machine.
Each of the measures below meets one of those needs, and each has a cost.
The last part of this section lists the costs.

### Speed

On one developer machine, 1,000 pictures of real views took 12.7 s, start
up included. That is about 10 ms a picture. The obvious way, with a fresh
page for each test file and a screenshot of each picture, would take about
two minutes. On the same 100 pictures, the obvious way took 12.0 s, and
this package took 3.1 s. Four things make the difference.

- **One page runs every canvas test file.** The libraries load once, the
  shaders compile once, and one renderer draws every picture.
- **No screenshots are taken.** The harness reads a Pixi or three.js
  picture straight from the renderer. A screenshot costs about 90 ms.
- **Hashes are compared, not images.** The page computes a hash of each
  picture's pixels, which is a short string worked out from them. Each
  reference file carries the hash of its own pixels in its first bytes.
  Only a picture whose hash differs is sent to Node, to be compared and
  written.
- **Big smooth pictures are drawn smaller.** A smooth picture over the size
  budget (`maxPixels`, 500,000 pixels by default) is drawn at a lower
  resolution.

One step costs time to keep the shared page correct. Vite bundles every
library that the tests import before the run starts, because one found
during the run would be bundled again, and the files after it would load a
second copy. Vite finds those libraries by scanning the test files, and it
bundles them afresh on every run, so that a newly imported library is never
missed. That takes about a second, however many tests there are.

### Consistency: The Same on Every Machine, Without Docker

Pictures of the same view differ between machines for many reasons. The
graphics card and its driver draw differently. Each operating system has
its own fonts and its own text engine. Colour profiles, screen scaling and
even the processor's rounding play a part. The usual cure is to run the
browser in a Linux container, such as Docker, so that every machine draws
in the same environment. That needs Docker installed and running, which on
Windows and macOS means a virtual machine, and it makes every run slower to
start.

This package pins everything that differs inside the browser instead, so
the tests run natively, at full speed, on all three systems.

- **The browser** is Playwright's build of Chromium, pinned to one version.
- **WebGL and 2D canvases** are drawn in software (SwiftShader), and so is
  compositing, so no graphics card is involved.
- **Settings** such as the colour profile, the screen scale, the locale,
  the time zone and font hinting are fixed.
- **Random numbers** are seeded the same before every test.
- **Processor rounding** is covered by a tolerance of 2 levels of 255 in
  each colour channel. Processors with the arm64 architecture need it for
  blurs and rotations.

Before any picture is compared, each run checks a fingerprint of the
browser, and draws a calibration set of small pictures. If anything
differs, the run stops at once with one error, instead of failing every
test for the same reason.

### Text

Text is the hardest part. Each operating system lays text out and draws it
with its own engine, from its own fonts. The results differ by fractions
of a pixel, which is enough to move a line, or the edge of a box.

- **Canvas text** is drawn by the harness itself. It lays the text out with
  fontkit, a font library, and draws each letter as a shape, from one of
  two fonts that come with the package (Source Sans 3 and Source Code
  Pro). The font family that a view asks for is mapped to one of them. A
  family with no stand-in fails its test, with a message saying so.
- **HTML text** is laid out by the browser, and no setting makes the
  systems' engines agree. So HTML text is set in a blank font, in which
  every character is an empty glyph, 0.625 em wide. The layout stays, and
  no letters are drawn. Font sizes are also rounded to quarter pixels,
  because Linux scales fonts in 64ths of a pixel and the other systems do
  not.

### What Tests Must Avoid

A visual test is a unit test of a view, and the same discipline applies.
Each test must stand on its own. That matters even more here, because
canvas tests share one page, so whatever a test leaves behind is still
there for the tests after it.

- **Don't leave global state changed.** That includes module-level
  variables, patched prototypes, and library defaults. The harness resets
  random numbers, and Pixi's texture defaults, before every test.
- **Don't depend on real time.** A pose advances a view with
  `advanceTime`, never with timers or the clock.
- **Use font families that have a stand-in.** Canvas text in any other
  family fails, as described above.

Running the tests in a shuffled order (`--sequence.shuffle`) shows whether
any test depends on the ones before it.

### What It Gives Up

Each measure gives up a little accuracy for speed or consistency. The
costs affect the tests only, never the views.

- **HTML pictures have no text.** They show every box, border, image,
  control and underline, and the layout itself. They don't show the
  words, or the text's colour or weight, and lines wrap where 0.625 em per
  character puts them, not where the real font would. For many views,
  that is a fair trade, and in games it can even help. What matters in a
  game's HTML, such as its menus, panels and overlays, is mostly layout and
  styling. Words change for reasons that have nothing to do with how a view
  works, such as a copy edit or a translation, and a picture without words
  doesn't fail when they do. Words that matter can be checked with
  assertions.
- **Canvas text uses the two test fonts,** not the view's own. Pictures
  show where text is and how big it is, but not the real typeface.
- **Rotated images in HTML pictures look a little jagged.** They are
  sampled nearest-neighbour, because smooth sampling under a rotation
  rounds differently on arm64 processors.
- **A change of 2 levels or less in every channel passes.** A real change
  is almost never that small.
- **The drawing is software's, not a graphics card's.** A feature that
  SwiftShader draws differently from a graphics card is drawn the same way
  on every machine, but not quite as it looks on a real screen.

[Visual Tests](../docs/building-with-mvt/iterating-with-confidence/visual-tests.md)
describes the same measures from a test writer's point of view.

The fonts in `src/browser/fonts/` are under the SIL Open Font License,
whose text is beside them.
