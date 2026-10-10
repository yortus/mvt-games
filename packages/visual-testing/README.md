# @mvtjs/visual-testing

> Visual tests for views, made as convenient as unit tests. A visual test
> is a kind of snapshot test, also known as visual regression testing. A
> snapshot test compares a test's output with a saved copy, and a visual
> test compares an image. It builds a view in a known state, renders it to
> an image, and compares that image with a reference image, which is an
> accepted image committed beside the test file. To be as convenient as unit
> tests, visual tests must be fast, and must give the same result on every
> machine. This package runs hundreds of them in seconds. The images come
> out the same on Windows, Linux and macOS, and nothing needs installing
> beyond `npm ci`. It covers Pixi, three.js and HTML views. The package is
> private for now.

**Related:** [Visual Tests, in the MVT guide](../docs/building-with-mvt/iterating-with-confidence/visual-tests.md)

---

## Writing a Test

A test is a declaration in a `*.visual.ts` or `*.visual.tsx` file beside
the view. (A project can keep its tests elsewhere, as
[Choosing Where Files Go](#choosing-where-files-go) describes.) A Pixi or three.js view is declared with
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

`advanceTime({ models, views, totalMs })` advances a view with
presentation state, in frame-sized steps, before the test renders it to an
image.
[Visual Tests](../docs/building-with-mvt/iterating-with-confidence/visual-tests.md)
describes the options, HTML and three.js views, and how failures read.

### Tests, Actual Images and Reference Images

Each test renders its view to one image. This README keeps three terms
apart.

- A **test** is one `canvasTest` or `htmlTest` declaration. A test runs,
  and passes or fails.
- An **actual image** is the image that a test renders during a run.
- A **reference image**, or just a **reference**, is an image that has been
  accepted, and committed as a PNG file.

A test passes when its actual image matches its reference image. Where
something applies to both, such as an image's name or size, this README
says just "image".

An image's name comes from its test's full name. The full name is the
names of the test's `describe` blocks, followed by the test's own name.
Each run of characters other than letters, digits and dots becomes one
hyphen, and hyphens at either end are dropped. So the first test above,
whose full name is `HudView > at the start`, has the image name
`HudView-at-the-start`. By default, its reference image is that name with
`.png` added, in a folder named after the test file:
`__references__/hud-view.visual.tsx/HudView-at-the-start.png`, beside the
test file. Vitest's own screenshot features write to `__screenshots__`
folders, so this package uses a name of its own. That way, a file that
Vitest writes is never mistaken for a reference image.

An image name has no spaces, so it can be typed on a command line, and
failure messages give it. Two tests whose full names differ only in
punctuation would have the same image name, and share one reference
image. If any tests share a reference image, the run fails, and names
them.

### One Kind of Test in Each File

The tests run in a browser. Vitest loads each test file into a browser
page, much like a tab, and the views are drawn in that page. The two kinds
of test need their pages arranged differently.

- **Canvas tests share one page.** Every file of canvas tests runs in the
  same page, one file after another. The libraries load once, the shaders
  compile once, and one renderer draws every actual image. That is what
  lets hundreds of tests run in seconds.
- **Each file of HTML tests gets a fresh page.** This is because html views use stylesheets, which can't be unloaded from a page, so the fresh pages ensure that
each view gets only its own styles.

A file runs in one page, so it declares one kind of test only. When the
config loads, the package reads each file's declarations, and sends the
file to the right kind of page. A file that declares both kinds, or
neither, stops the run with an error.

## Configuration

A package that has visual tests needs three things.

1. A dev dependency on `@mvtjs/visual-testing`.
2. A `vitest.visual.config.ts` beside its `package.json`. It makes one
   Vitest project for each kind of page, and the reporter for the run's
   summary:

   ```ts
   import { defineConfig } from 'vitest/config';
   import { createVisualConfig } from '@mvtjs/visual-testing/node';

   export default defineConfig({
       test: createVisualConfig({ viteConfig: './vite.config.ts' }),
   });
   ```

   `viteConfig` is the package's own Vite config, for the plugins and
   aliases its views need. `maxPixels` sets the size budget, which is
   500,000 pixels (`DEFAULT_MAX_PIXELS`) by default.
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

### Choosing Where Files Go

Two options of `createVisualConfig` say where a project keeps its visual
test files and their reference images. Both are relative to the folder that
holds `vitest.visual.config.ts`.

- **`include`** is a list of globs for the test files. The default,
  `DEFAULT_INCLUDE`, is `['src/**/*.visual.{ts,tsx}']`.
- **`referencePath`** is a template for each reference image's path. Its
  variables are `{testFileDir}`, `{testFileName}`, `{testFilePath}` and
  `{imageName}`. The default, `DEFAULT_REFERENCE_PATH`, is
  `'{testFileDir}/__references__/{testFileName}/{imageName}.png'`.

`{imageName}` must appear once, in the file name, and the file name must
end in `.png`. A template that breaks these rules stops the run when the
config loads. Two other layouts are common.

```ts
// Tests in a visual-tests folder inside each view folder, with their
// reference images beside them:
//   src/hud/visual-tests/hud-view.test.ts
//   src/hud/visual-tests/HudView-at-the-start.png
createVisualConfig({
    include: ['src/**/visual-tests/*.test.ts'],
    referencePath: '{testFileDir}/{imageName}.png',
});

// Every reference image in one folder, which mirrors the source tree:
//   visual-references/src/hud/hud-view.visual.tsx/HudView-at-the-start.png
createVisualConfig({ referencePath: 'visual-references/{testFilePath}/{imageName}.png' });
```

The first layout names its tests `*.test.ts`, which a unit test run also
matches. So the package's unit test config must exclude them, for example
with `exclude: [...configDefaults.exclude, '**/visual-tests/**']`. Also,
any other PNG in a `visual-tests` folder would match the reference path,
and `check-references` would report it. Keep such files elsewhere, or give
the reference images a pattern of their own, such as
`'{testFileDir}/{imageName}.ref.png'`.

The package tells its reference images from other PNGs by the hash that
each one carries. So the check for references that no test uses never
deletes another PNG, whatever folder it is in. To change layout, change the
options, then run `visual-tests --update` once. Each test writes its
reference image at the new path, with the same pixels as before. The same
run deletes the old files, because no test uses them. This package's own
`fixtures/visual-tests-folders/` project uses the first layout, and its run
checks that layout end to end.

## Commands

| Command | What it does |
| --- | --- |
| `visual-tests` | Runs every test, and compares each actual image with its reference image. The first run downloads the browser |
| `visual-tests --image <name>` | Runs only the test with that image name. Failure messages give the name, and the option can be repeated |
| `visual-tests --sequence.shuffle` | Runs every test in a random order, which finds any test that depends on the ones before it. Vitest prints the order's seed, and adding `--sequence.seed=<seed>` repeats that order |
| `visual-tests --update` | Also writes each new or changed actual image as its reference image, and deletes reference images that no test uses |
| `visual-tests check-references` | Decodes every reference image, and checks its pixels against the hash it carries |

This package's own tests and calibration set run with
`npm run test:visual -w @mvtjs/visual-testing`. Its fixture project runs
with `npm run test:visual:fixture -w @mvtjs/visual-testing`, which takes
the same arguments as `visual-tests`. After a deliberate upgrade
of Playwright, `npm run test:visual:environment -w @mvtjs/visual-testing`
rewrites the browser's fingerprint and the calibration set's references.

## FAQ

### Q: Why use this instead of Playwright's screenshot tests?

It is up to 15x faster, and it needs no Docker. Just `npm ci` and run the
tests anywhere.

This package distinguishes between _canvas_ and _HTML_ tests. Canvas tests
(for Pixi, three.js etc.) are much faster because they read the image
directly from the renderer, while HTML tests still take screenshots and get
less speedup.

### Q: How does it achieve such high speed?

- **Canvas test files share one page.** Libraries load once, and shaders
  compile once.
- **Canvas tests take no screenshots.** The actual image is read straight
  from the renderer.
- **Hashes are compared first.** Only an actual image whose hash differs
  is further processed.

### Q: How does it achieve consistency across machines without Docker?

- **The browser** is always the same version of Chromium and draws in
  software (no graphics cards).
- **Settings** such as the colour profile, screen scale, locale and time
  zone are fixed.
- **Canvas text** is always drawn using a known font from this package.
- **HTML text** is set in a blank font, to sidestep text engine
  differences.
- **A tolerance** of 2 levels of 255 covers rounding on arm64 processors.

### Q: What's the catch?

Test images give up these details:

- **Images of HTML views have no text.** Layout and styling show, but the
  words don't. For a game's menus and panels, that is usually what
  matters, and a copy edit doesn't fail a test. Words that matter can be
  checked with assertions.
- **Canvas text uses the two test fonts,** not the view's own.
- **Rotated `<img>` elements look a little jagged,** because smooth
  sampling rounds differently on arm64 processors.
- **Differences of 2 levels or less pass.** A real change is almost never
  that small.
- **The drawing is software's,** so it can differ a little from a real
  graphics card.

Tests must also follow two rules:

- **Don't leave global state changed, or depend on real time.** Either can
  make images change from one run to the next. Canvas tests share one
  page, so a change that one test leaves behind affects the tests after it.
- **End each canvas font list with `sans-serif` or `monospace`.** Canvas
  text is drawn in this package's own sans-serif or monospace font,
  picked from the list. So `'"Press Start 2P", monospace'` works, but
  `'"Press Start 2P"'` alone fails its test.

## How It Is Laid Out

The tests run in a browser, and the browser talks to Node through Vitest's
browser commands. So the package has two sides, and the messages between
them are defined once, in `src/protocol.ts`.

| Folder | What it holds |
| --- | --- |
| `src/browser/` | The side that runs in the test page. It holds `canvasTest`, `htmlTest` and `advanceTime`, which the main entry point exports. It also holds the code that produces an image of each kind of view, and the page's setup. The setup seeds random numbers the same way every time, draws canvas text from two test fonts, and blanks HTML text |
| `src/node/` | The side that runs in Node. `@mvtjs/visual-testing/node` exports `createVisualConfig`. It also holds the layout, the browser commands, the PNG files, the comparison and the run's summary |
| `src/node/cli/` | The `visual-tests` command, its reference check, and the generator of the blank font |
| `src/browser/__references__/` | The references for the calibration set, and for this package's own tests |
| `fixtures/visual-tests-folders/` | A small project that keeps its tests in `visual-tests` folders, to check that layout |

`visual-environment.json` holds the browser's fingerprint, which every
machine's browser must match.

The Node entry point gives its TypeScript source both under the repo's
`@mvtjs/source` condition and as the default. Vitest bundles a config file
before it runs it, and the bundler knows no custom conditions. So the
default lets a package's config import this one. The command then runs
Vitest with tsx's loader, so that Node can run that TypeScript. The
command's `bin` entry is a small JavaScript file, which loads the command
through tsx.
